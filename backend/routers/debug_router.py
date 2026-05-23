from sqlalchemy.orm import Session
from typing import Union
from fastapi import APIRouter, Depends, HTTPException
from backend.schemas.two_factor_schema import (
    ErrorResponse,
    GetTOTPResponse,
    TokenResponse,
)
from backend.schemas.user_schema import CreateUser
from backend.routers.two_factor_router import _generate_totp
from backend.adapters.jwt import create_access_token
from backend.adapters.db import get_db
from backend.adapters.user_service import (
    get_user,
    get_user_by_email,
    create_user,
)
from config import get_settings

debug_router = APIRouter(tags=["Debug"])
settings = get_settings()


@debug_router.get(
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


@debug_router.post(
    "/DEBUG_CREATE_USER",
)
def DEBUG_CREATE_USER(user: CreateUser, db: Session = Depends(get_db)):
    try:
        return create_user(
            db,
            user.username,
            user.email,
            user.password.get_secret_value(),
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@debug_router.post(
    "/DEBUG_ADMIN_TOKEN",
    description="DEBUG ONLY: Returns a bearer token for the configured admin user without 2FA",
    responses={
        404: {"description": "Admin user not found"},
    },
    response_model=Union[TokenResponse, ErrorResponse],
)
def DEBUG_ADMIN_TOKEN(db: Session = Depends(get_db)) -> TokenResponse:
    user = get_user_by_email(db, settings.ADMIN_EMAIL)
    if user is None:
        raise HTTPException(status_code=404, detail="Admin user not found")

    return TokenResponse(access_token=create_access_token(user))
