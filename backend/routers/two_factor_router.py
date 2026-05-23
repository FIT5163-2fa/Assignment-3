import base64
import time
from math import floor
from typing import Union
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, hmac
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.jwt import (
    create_access_token,
    create_validate_token,
    get_setup_token_payload,
    get_validate_token_payload,
)
from backend.adapters.user_service import (
    get_user,
    update_two_factor_secret,
)
from backend.schemas.two_factor_schema import (
    CreateKeyResponse,
    ErrorResponse,
    TokenResponse,
    ValidateTwoFactorResponse,
)
from backend.schemas.user_schema import UserResponse
from config import get_settings

two_factor_router = APIRouter(tags=["2FA"])
settings = get_settings()


def _generate_totp(user) -> int:
    # HMAC Hash
    secret = user.two_factor_secret
    digest = hmac.HMAC(secret, hashes.SHA256())
    # Calculate Counter floor(unix_time/totp_duration)
    counter = floor(int(time.time()) / settings.TOTP_DURATION_SEC)
    # Format hash output as a 8 byte big-endian number
    digest.update(counter.to_bytes(8, "big"))
    hash = digest.finalize()

    # Get last 4 bits to get offset
    lsb = hash[-1] & 0b1111
    # Calculate Offset
    offset = hash[lsb : lsb + 4]
    # Mask off top bit
    offset = int.from_bytes(offset, "big") & 0x7FFFFFFF

    return offset % 10**settings.TOTP_DIGITS


def _create_totp_uri(user, secret: bytes) -> str:
    label = quote(f"{settings.TOTP_ISSUER}:{user.username}")
    # Authenticator apps expect the URI secret to be base32.
    secret_base32 = base64.b32encode(secret).decode("ascii").rstrip("=")
    params = urlencode(
        {
            "secret": secret_base32,
            "issuer": settings.TOTP_ISSUER,
            "algorithm": "SHA256",
            "digits": settings.TOTP_DIGITS,
            "period": settings.TOTP_DURATION_SEC,
        }
    )
    return f"otpauth://totp/{label}?{params}"


@two_factor_router.get(
    "/validate_2fa_key",
    description="Checks if supplied 2fa code is correct",
    responses={
        401: {"description": "Invalid two factor code"},
        404: {"description": "User or 2fa secret not found"},
    },
    response_model=Union[ValidateTwoFactorResponse, ErrorResponse],
)
def validate_2fa_key(
    user_id: int,
    user_totp: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_validate_token_payload),
) -> ValidateTwoFactorResponse:
    if int(payload["sub"]) != user_id:
        raise HTTPException(status_code=403, detail="Token does not match user")
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.two_factor_secret:
        if user_totp == _generate_totp(user):
            return ValidateTwoFactorResponse(
                user=UserResponse(
                    id=user.id,
                    username=user.username,
                    role=user.role,
                ),
                token=TokenResponse(access_token=create_access_token(user)),
            )
        raise HTTPException(status_code=401, detail="Invalid two factor code")
    else:
        raise HTTPException(status_code=404, detail="No two factor secret not found")


@two_factor_router.post(
    "/create_key",
    description="Creates and returns a 2factor otpauth URI",
    responses={
        401: {"description": "Invalid setup token"},
        404: {"description": "User not found"},
        409: {"description": "User already has a two factor secret"},
    },
    response_model=Union[CreateKeyResponse, ErrorResponse],
)
def create_key(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_setup_token_payload),
) -> CreateKeyResponse:
    user_id = int(payload["sub"])
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.two_factor_secret:
        raise HTTPException(
            status_code=409,
            detail="User already has a two factor secret",
        )
    key: bytes = Fernet.generate_key()  # Crypto Secure
    update_two_factor_secret(db, user_id, key)
    user = get_user(db, user_id)
    return CreateKeyResponse(
        uri=_create_totp_uri(user, key),
        validate_token=create_validate_token(user),
    )
