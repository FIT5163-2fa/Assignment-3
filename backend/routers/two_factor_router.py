import base64
import time
from math import floor
from typing import Union

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, hmac
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.user_service import (
    get_user,
    update_two_factor_secret,
)

two_factor_router = APIRouter(tags=["2FA"])

TOTP_DURATION_SEC = 15


class CreateKeyResponse(BaseModel):
    key: bytes


class ErrorResponse(BaseModel):
    detail: str


class GetTOTPResponse(BaseModel):
    totp_code: int


def _generate_totp(user) -> int:
    # HMAC Hash
    secret = base64.urlsafe_b64decode(user.two_factor_secret)
    digest = hmac.HMAC(secret, hashes.SHA256())
    # Calculate Counter floor(unix_time/totp_duration)
    counter = floor(int(time.time()) / TOTP_DURATION_SEC)
    # Format hash output as a 8 byte big-endian number
    digest.update(counter.to_bytes(8, "big"))
    hash = digest.finalize()

    # Get last 4 bits to get offset
    lsb = hash[-1] & 0b1111
    # Calculate Offset
    offset = hash[lsb : lsb + 4]
    # Mask off top bit
    offset = int.from_bytes(offset, "big") & 0x7FFFFFFF

    return offset % 10**6


@two_factor_router.get(
    "/DEBUG_get_2fa_key",
    description="Returns the TOTP password for a given user_id",
    responses={
        404: {"description": "User or 2fa secret not found"},
    },
    response_model=Union[GetTOTPResponse, ErrorResponse],
)
def get_totp_code(user_id: int, db: Session = Depends(get_db)) -> GetTOTPResponse:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.two_factor_secret:
        return GetTOTPResponse(totp_code=_generate_totp(user))
    else:
        raise HTTPException(status_code=404, detail="No two factor secret not found")


@two_factor_router.get(
    "/validate_2fa_key",
    description="Checks if supplied 2fa code is correct",
)
def validate_2fa_key(
    user_id: int, user_totp: int, db: Session = Depends(get_db)
) -> bool:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.two_factor_secret:
        return user_totp == _generate_totp(user)
    else:
        raise HTTPException(status_code=404, detail="No two factor secret not found")


@two_factor_router.post(
    "/create_key",
    description="Creates and returns a 2factor secret, Will create a new 2factor secret if the user already has a secret",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[CreateKeyResponse, ErrorResponse],
)
def create_key(user_id: int, db: Session = Depends(get_db)) -> CreateKeyResponse:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    else:
        key: bytes = Fernet.generate_key()
        update_two_factor_secret(db, user_id, key)
        return CreateKeyResponse(key=key)


@two_factor_router.post(
    "/DEBUG_CREATE_USER",
)
def DEBUG_CREATE_USER(username: str, db: Session = Depends(get_db)):
    from backend.adapters.user_service import create_user

    return create_user(db, username)
