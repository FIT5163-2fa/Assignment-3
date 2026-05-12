import uvicorn  # Set to lazy when in python 3.15
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.adapters.db import init_db
from backend.routers.two_factor_router import two_factor_router


def create_app():
    tags_metadata = [{"name": "2FA", "description": "API for 2fa functionality"}]
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

    return app


app = create_app()
if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)
