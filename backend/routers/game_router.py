from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.game_service import (
    append_game_move,
    create_game,
    delete_game,
    finish_game,
    get_game,
    get_games_by_user,
    update_game,
)
from backend.adapters.jwt import get_access_token_payload
from backend.adapters.models import Games
from backend.adapters.user_service import get_user
from backend.schemas.game_schema import (
    AppendMove,
    CreateGame,
    ErrorResponse,
    FinishGame,
    GameMovesResponse,
    GameResponse,
    UpdateGame,
)

game_router = APIRouter(prefix="/games", tags=["Games"])


def _join_moves(moves: list[str]) -> str:
    # Store move arrays as one whitespace-separated string in SQLite.
    return " ".join(moves)


def _split_moves(moves: str) -> list[str]:
    return moves.split() if moves else []


def _game_response(game: Games) -> GameResponse:
    return GameResponse(
        id=game.id,
        user_id=game.user_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=_split_moves(game.moves),
        status=game.status,
        result=game.result,
        created_at=game.created_at,
        updated_at=game.updated_at,
    )


def _token_user_id(payload: dict) -> int:
    return int(payload["sub"])


def _get_owned_game(db: Session, game_id: int, payload: dict) -> Games:
    game = get_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.user_id != _token_user_id(payload):
        raise HTTPException(status_code=403, detail="Cannot access another user's game")
    return game


@game_router.post(
    "",
    description="Creates a chess game for a user",
    responses={
        403: {"description": "Cannot create a game for another user"},
        404: {"description": "User not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def create_chess_game(
    game: CreateGame,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameResponse:
    if game.user_id != _token_user_id(payload):
        raise HTTPException(
            status_code=403,
            detail="Cannot create a game for another user",
        )

    user = get_user(db, game.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    created_game = create_game(
        db,
        user_id=game.user_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=_join_moves(game.moves),
    )
    return _game_response(created_game)


@game_router.get(
    "",
    description="Returns chess games for the current user",
    response_model=list[GameResponse],
)
def get_chess_games(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> list[GameResponse]:
    return [
        _game_response(game) for game in get_games_by_user(db, _token_user_id(payload))
    ]


@game_router.get(
    "/{game_id}",
    description="Returns a chess game by game id",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def get_chess_game(
    game_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameResponse:
    game = _get_owned_game(db, game_id, payload)
    return _game_response(game)


@game_router.get(
    "/{game_id}/moves",
    description="Returns moves for a chess game",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
    response_model=Union[GameMovesResponse, ErrorResponse],
)
def get_chess_game_moves(
    game_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameMovesResponse:
    game = _get_owned_game(db, game_id, payload)
    return GameMovesResponse(game_id=game.id, moves=_split_moves(game.moves))


@game_router.put(
    "/{game_id}",
    description="Updates a chess game",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def update_chess_game(
    game_id: int,
    game: UpdateGame,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameResponse:
    _get_owned_game(db, game_id, payload)
    updated_game = update_game(
        db,
        game_id=game_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=_join_moves(game.moves) if game.moves is not None else None,
        status=game.status,
        result=game.result,
    )
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.post(
    "/{game_id}/moves",
    description="Appends one move to a chess game",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def append_chess_game_move(
    game_id: int,
    move: AppendMove,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameResponse:
    _get_owned_game(db, game_id, payload)
    updated_game = append_game_move(db, game_id, move.move)
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.post(
    "/{game_id}/finish",
    description="Marks a chess game as finished",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def finish_chess_game(
    game_id: int,
    game: FinishGame,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> GameResponse:
    _get_owned_game(db, game_id, payload)
    updated_game = finish_game(
        db,
        game_id=game_id,
        status=game.status,
        result=game.result,
    )
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.delete(
    "/{game_id}",
    description="Deletes a chess game",
    responses={
        403: {"description": "Cannot access another user's game"},
        404: {"description": "Game not found"},
    },
)
def delete_chess_game(
    game_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> bool:
    _get_owned_game(db, game_id, payload)
    deleted = delete_game(db, game_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Game not found")

    return True
