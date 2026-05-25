import uvicorn
from init import app
from chess_game import launch_chess, attempt_login
import threading

def start_server():
    uvicorn.run(app, host="localhost", port=8000)

if __name__ == "__main__":
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    result = attempt_login()
    launch_chess({"username": result.username})
