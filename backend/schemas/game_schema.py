from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from backend.adapters.models import GameResult, GameStatus, PlayerSide

MoveString = Annotated[str, Field(min_length=3, max_length=5)]


class CreateGame(BaseModel):
    user_id: int
    player_side: PlayerSide = PlayerSide.WHITE
    ai_depth: Annotated[int, Field(ge=1, le=10)] = 3
    moves: list[MoveString] = Field(default_factory=list)


class UpdateGame(BaseModel):
    player_side: PlayerSide | None = None
    ai_depth: Annotated[int | None, Field(ge=1, le=10)] = None
    moves: list[MoveString] | None = None
    status: GameStatus | None = None
    result: GameResult | None = None


class AppendMove(BaseModel):
    move: MoveString


class FinishGame(BaseModel):
    status: GameStatus
    result: GameResult | None = None


class GameResponse(BaseModel):
    id: int
    user_id: int
    player_side: PlayerSide
    ai_depth: int
    moves: list[str]
    status: GameStatus
    result: GameResult | None
    created_at: datetime
    updated_at: datetime


class GameMovesResponse(BaseModel):
    game_id: int
    moves: list[str]


class ErrorResponse(BaseModel):
    detail: str
