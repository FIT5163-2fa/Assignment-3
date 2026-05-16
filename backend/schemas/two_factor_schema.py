from pydantic import BaseModel


class CreateKeyResponse(BaseModel):
    uri: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ErrorResponse(BaseModel):
    detail: str


class GetTOTPResponse(BaseModel):
    totp_code: int
