from typing import Union

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.user_service import (
    get_user,
    update_two_factor_secret,
)

two_factor_router = APIRouter(tags=["2FA"])


def get_totp_code(secret_key: str):
    digest = hashes.Hash(hashes.SHA256())
    digest.update(b"secret")
    print(digest.finalize())
    pass


class CreateKeyResponse(BaseModel):
    key: str


class ErrorResponse(BaseModel):
    detail: str


@two_factor_router.post(
    "/create_key",
    description="Creates and returns a 2factor secret, Will create a new 2factor secret if the user already has a secret",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[CreateKeyResponse, ErrorResponse],
)
def create_key(user_id: int, db: Session = Depends(get_db)):
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    else:
        key: bytes = Fernet.generate_key()
        update_two_factor_secret(db, user_id, key.decode())
    return key.decode()
