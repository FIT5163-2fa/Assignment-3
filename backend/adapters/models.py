from enum import Enum as Enumeration
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, func, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.adapters.db import Base


class UserRole(str, Enumeration):
    USER = "user"
    ADMIN = "admin"


class PlayerSide(str, Enumeration):
    WHITE = "white"
    BLACK = "black"


class GameStatus(str, Enumeration):
    IN_PROGRESS = "in_progress"
    CHECKMATE = "checkmate"
    STALEMATE = "stalemate"
    INSUFFICIENT_MATERIAL = "insufficient_material"
    RESIGNED = "resigned"
    DRAW = "draw"


class GameResult(str, Enumeration):
    WHITE_WINS = "white_wins"
    BLACK_WINS = "black_wins"
    DRAW = "draw"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.USER, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    two_factor_secret: Mapped[bytes | None] = mapped_column(String(255), nullable=True)
    games: Mapped[list["Games"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Games(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    player_side: Mapped[PlayerSide] = mapped_column(
        Enum(PlayerSide), default=PlayerSide.WHITE, nullable=False
    )
    ai_depth: Mapped[int] = mapped_column(default=3, nullable=False)
    moves: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[GameStatus] = mapped_column(
        Enum(GameStatus), default=GameStatus.IN_PROGRESS, nullable=False
    )
    result: Mapped[GameResult | None] = mapped_column(Enum(GameResult), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="games")
