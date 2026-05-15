from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr


class RegisterUser(BaseModel):
    username: Annotated[str, Field(min_length=1, max_length=255)]
    email: EmailStr
    password: Annotated[SecretStr, Field(min_length=8)]
