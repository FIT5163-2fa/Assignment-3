from __future__ import annotations

import json
import secrets
import threading
import time
import webbrowser
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlencode


@dataclass
class LoginCallbackResult:
    state: str
    user_id: int
    username: str
    role: str
    access_token: str


class LoginCallbackError(Exception):
    pass


def wait_for_login_callback(
    frontend_url: str = "http://localhost:5173",
    host: str = "127.0.0.1",
    port: int = 0,
    timeout_seconds: int = 300,
) -> LoginCallbackResult:
    state = secrets.token_urlsafe(32)
    received: dict[str, Any] = {}
    finished = threading.Event()

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self._send_empty_response(204)

        def do_GET(self):
            if self.path == "/health":
                self._send_json_response(200, {"ok": True})
                return
            self._send_json_response(404, {"detail": "Not found"})

        def do_POST(self):
            if self.path != "/callback":
                self._send_json_response(404, {"detail": "Not found"})
                return

            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(content_length).decode("utf-8")
                data = json.loads(body)
            except (ValueError, json.JSONDecodeError):
                self._send_json_response(400, {"detail": "Invalid JSON body"})
                return

            if data.get("state") != state:
                self._send_json_response(403, {"detail": "Invalid state"})
                return

            # The callback does NOT verify the JWT here. It only carries
            # the token back to the chess game. The chess game then calls
            # the backend with this token, and the BACKEND verifies the
            # signature. This way the JWT secret key only ever exists in
            # the backend - the chess game and this callback never need
            # it. A missing token is rejected early; a forged token will
            # be rejected by the backend on the verification call.
            try:
                received["result"] = LoginCallbackResult(
                    state=state,
                    user_id=int(data["user_id"]),
                    username=str(data["username"]),
                    role=str(data["role"]),
                    access_token=str(data["access_token"]),
                )
            except (KeyError, TypeError, ValueError):
                self._send_json_response(400, {"detail": "Missing user details"})
                return

            finished.set()
            self._send_json_response(200, {"ok": True})

        def log_message(self, format, *args):
            return

        def _send_empty_response(self, status_code: int):
            self.send_response(status_code)
            self._send_cors_headers()
            self.end_headers()

        def _send_json_response(self, status_code: int, body: dict[str, Any]):
            response_body = json.dumps(body).encode("utf-8")
            self.send_response(status_code)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)

        def _send_cors_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    server = ThreadingHTTPServer((host, port), CallbackHandler)
    callback_url = f"http://{host}:{server.server_port}/callback"
    login_url = _build_login_url(frontend_url, state, callback_url)

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    try:
        webbrowser.open(login_url)
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if finished.wait(timeout=0.2):
                return received["result"]
        raise LoginCallbackError("Timed out waiting for 2FA login callback")
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


def _build_login_url(frontend_url: str, state: str, callback_url: str) -> str:
    separator = "&" if "?" in frontend_url else "?"
    query = urlencode({"state": state, "callback_url": callback_url})
    return f"{frontend_url}{separator}{query}"


def verify_login_with_backend(
    result: LoginCallbackResult,
    backend_url: str = "http://127.0.0.1:8000",
) -> bool:
    """
    Ask the backend to verify the JWT from the login callback, and
    confirm the account is allowed to play chess.

    The chess game calls this before opening the board. It sends the
    token to a protected backend endpoint as a Bearer token. The
    backend verifies the JWT signature with its own secret key:

        200  -> token is genuine and signed by the backend
        401  -> token is forged, tampered, or expired        -> deny

    On a 200 we also check the role from the backend's response:
    only a normal USER may open the chess board. An ADMIN token is
    rejected here - admins use the web admin dashboard, not the game.

    The JWT secret key never leaves the backend. The chess game only
    learns "valid user" or "not" from the response.
    """
    import json
    import urllib.error
    import urllib.request

    endpoint = f"{backend_url}/users/by_username/{result.username}"
    request = urllib.request.Request(
        endpoint,
        headers={"Authorization": f"Bearer {result.access_token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status != 200:
                print(f"[verify] backend returned status {response.status}")
                return False
            body = json.loads(response.read().decode("utf-8"))
            print(f"[verify] backend response: {body}")
            role = body.get("role")
            print(f"[verify] role from backend: {role!r}")
            # Only a normal USER may play chess. Admins are turned away.
            return role == "user"
    except urllib.error.HTTPError as exc:
        # 401 (bad token), 403, 404, etc. -> verification failed.
        print(f"[verify] HTTPError {exc.code}: {exc.reason}")
        try:
            print(f"[verify] error body: {exc.read().decode('utf-8')}")
        except Exception:
            pass
        return False
    except urllib.error.URLError as exc:
        raise LoginCallbackError(
            f"Could not reach the backend to verify login: {exc}"
        )
