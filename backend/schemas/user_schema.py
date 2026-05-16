from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr

from backend.adapters.models import UserRole


class CreateUser(BaseModel):
    username: Annotated[str, Field(min_length=1, max_length=255)]
    email: EmailStr
    password: Annotated[SecretStr, Field(min_length=8)]


class UpdateUserRole(BaseModel):
    role: UserRole


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole


class ErrorResponse(BaseModel):
    detail: str
