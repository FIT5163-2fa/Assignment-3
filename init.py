from functools import lru_cache
import config
import uvicorn  # Set to lazy when in python 3.15
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.adapters.db import init_db
from backend.routers.two_factor_router import two_factor_router
from backend.routers.debug_router import debug_router
from backend.routers.game_router import game_router
from backend.routers.user_router import user_router


def create_app():
    tags_metadata = [
        {"name": "2FA", "description": "API for 2fa functionality"},
        {"name": "Debug", "description": "Debug endpoints for development"},
        {"name": "Games", "description": "API for chess game persistence"},
        {"name": "Users", "description": "API for user management"},
    ]
    app = FastAPI(openapi_tags=tags_metadata)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup():
        init_db()

    app.include_router(two_factor_router)
    app.include_router(debug_router)
    app.include_router(user_router)
    app.include_router(game_router)
    return app

@lru_cache
def get_settings() -> config.Settings:
    return config.Settings()  # ty:ignore[missing-argument]


app = create_app()
if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
