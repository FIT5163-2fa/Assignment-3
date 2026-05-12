import time
from math import floor
from typing import Union

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, hmac
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.user_service import (
    get_user,
    update_two_factor_secret,
)

two_factor_router = APIRouter(tags=["2FA"])

TOTP_DURATION_SEC = 15


@two_factor_router.get(
    "/get_2fa_key",
)
def get_totp_code(user_id: int, db: Session = Depends(get_db)):
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.two_factor_secret:
        # HMAC Hash
        digest = hmac.HMAC(user.two_factor_secret, hashes.SHA256())
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

        # TOTP Code mod to mask only needed number of digits
        return offset % 10**6
    else:
        raise HTTPException(status_code=404, detail="No two factor secret not found")


class CreateKeyResponse(BaseModel):
    key: bytes


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
        update_two_factor_secret(db, user_id, key)
    return key
