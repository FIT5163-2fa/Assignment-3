from pydantic import BaseModel

from backend.schemas.user_schema import UserResponse


class CreateKeyResponse(BaseModel):
    uri: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ValidateTwoFactorResponse(BaseModel):
    user: UserResponse
    token: TokenResponse


class ErrorResponse(BaseModel):
    detail: str


class GetTOTPResponse(BaseModel):
    totp_code: int
