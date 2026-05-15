from sqlalchemy.orm import Session
from typing import Union
from fastapi import APIRouter, Depends, HTTPException
from ..schemas.two_factor_schema import ErrorResponse, GetTOTPResponse
from ..schemas.user_schema import CreateUser
from ..routers.two_factor_router import _generate_totp
from backend.adapters.db import get_db
from backend.adapters.user_service import (
    get_user,
    create_user,
)

debug_router = APIRouter(tags=["Debug"])


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
    return create_user(
        db,
        user.username,
        user.email,
        user.password.get_secret_value(),
    )
