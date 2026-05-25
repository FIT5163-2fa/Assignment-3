import uvicorn
from init import app
from login_callback import wait_for_login_callback, LoginCallbackError
from chess_game import launch_chess
import threading

def start_server():
    uvicorn.run(app, host="localhost", port=8000)

if __name__ == "__main__":
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    try:
        result = wait_for_login_callback()
    except LoginCallbackError as exc:
        raise SystemExit(f"2FA login failed or timed out: {exc}")

    launch_chess({"username": result.username}, ai_depth=3)
