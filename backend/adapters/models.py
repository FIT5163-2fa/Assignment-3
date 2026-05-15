import sqlalchemy
from enum import Enum
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from backend.adapters.db import Base


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        sqlalchemy.Enum(UserRole), default=UserRole.USER, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    two_factor_secret: Mapped[bytes | None] = mapped_column(String(255), nullable=True)
