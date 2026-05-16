from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from config import get_settings
from backend.adapters.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="validate_2fa_key")
settings = get_settings()


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role.value,
        "exp": expire,
    }
    return jwt.encode(
        payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc


def get_current_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    return decode_access_token(token)
