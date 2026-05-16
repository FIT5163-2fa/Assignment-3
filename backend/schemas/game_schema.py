from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from backend.adapters.models import GameResult, GameStatus, PlayerSide


class CreateGame(BaseModel):
    user_id: int
    player_side: PlayerSide = PlayerSide.WHITE
    ai_depth: Annotated[int, Field(ge=1, le=10)] = 3
    moves: str = ""


class UpdateGame(BaseModel):
    player_side: PlayerSide | None = None
    ai_depth: Annotated[int | None, Field(ge=1, le=10)] = None
    moves: str | None = None
    status: GameStatus | None = None
    result: GameResult | None = None
    final_fen: Annotated[str | None, Field(max_length=128)] = None


class AppendMove(BaseModel):
    move: str


class FinishGame(BaseModel):
    status: GameStatus
    result: GameResult | None = None
    final_fen: Annotated[str | None, Field(max_length=128)] = None


class GameResponse(BaseModel):
    id: int
    user_id: int
    player_side: PlayerSide
    ai_depth: int
    moves: str
    status: GameStatus
    result: GameResult | None
    final_fen: str | None
    created_at: datetime
    updated_at: datetime


class GameMovesResponse(BaseModel):
    game_id: int
    moves: str


class ErrorResponse(BaseModel):
    detail: str
