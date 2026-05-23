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

            token = data.get("access_token")
            if not token:
                self._send_json_response(403, {"detail": "Missing access token"})
                return
            try:
                import jwt as _jwt
                from config import get_settings

                _settings = get_settings()
                claims = _jwt.decode(
                    token,
                    _settings.JWT_SECRET_KEY,
                    algorithms=[_settings.JWT_ALGORITHM],
                )
            except Exception:
                self._send_json_response(
                    403, {"detail": "Invalid or expired access token"}
                )
                return

            if claims.get("role") != "user":
                self._send_json_response(
                    403, {"detail": "Chess login requires USER role"}
                )
                return

            try:
                received["result"] = LoginCallbackResult(
                    state=state,
                    user_id=int(claims["sub"]),
                    username=str(claims["username"]),
                    role=str(claims["role"]),
                    access_token=str(token),
                )
            except (KeyError, TypeError, ValueError):
                self._send_json_response(400, {"detail": "Malformed token claims"})
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
        print("=" * 70)
        print("FIT5163 Chess Game - 2FA login required.")
        print("A browser window should open. If it does NOT, copy this")
        print("URL into your browser manually:")
        print()
        print(f"  {login_url}")
        print()
        print("Waiting for you to log in...")
        print("=" * 70)

        webbrowser.open(login_url)
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if finished.wait(timeout=0.2):
                print("Login successful - opening the chess board.")
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
