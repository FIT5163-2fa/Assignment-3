from pydantic import BaseModel


class CreateKeyResponse(BaseModel):
    uri: str


class ErrorResponse(BaseModel):
    detail: str


class GetTOTPResponse(BaseModel):
    totp_code: int
