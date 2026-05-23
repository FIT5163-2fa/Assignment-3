from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    app_name: str = "Best Chess 2FA Game"
    
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 60
    JWT_SETUP_EXPIRE_MINUTES: int = 10
    
    TOTP_DURATION_SEC: int = 15
    TOTP_DIGITS: int = 6
    TOTP_ISSUER: str = "Secure Chess"
    
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str


@lru_cache
def get_settings() -> Settings:
    return Settings()

