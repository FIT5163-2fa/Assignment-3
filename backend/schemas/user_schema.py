from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

from backend.adapters.models import UserRole


class CreateUser(BaseModel):
    username: Annotated[str, Field(min_length=1, max_length=255)]
    email: EmailStr
    password: Annotated[SecretStr, Field(min_length=8)]


class LoginUser(BaseModel):
    email: EmailStr
    password: SecretStr


class LoginResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: int
    username: str
    two_factor_set: bool
    setup_token: str
    token_type: str = "bearer"


class UpdateUserRole(BaseModel):
    role: UserRole


class UserResponse(BaseModel):
    id: int
    username: str
    role: UserRole


class AdminUserResponse(UserResponse):
    hashed_email: str
    hashed_password: str
    two_factor_secret: bytes | None


class ErrorResponse(BaseModel):
    detail: str
