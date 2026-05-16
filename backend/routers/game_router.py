from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.game_service import (
    append_game_move,
    create_game,
    delete_game,
    finish_game,
    get_all_games,
    get_game,
    get_games_by_user,
    update_game,
)
from backend.adapters.models import Games
from backend.adapters.user_service import get_user, get_user_by_username
from backend.schemas.game_schema import (
    AppendMove,
    CreateGame,
    ErrorResponse,
    FinishGame,
    GameMovesResponse,
    GameResponse,
    UpdateGame,
)

game_router = APIRouter(tags=["Games"])


def _game_response(game: Games) -> GameResponse:
    return GameResponse(
        id=game.id,
        user_id=game.user_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=game.moves,
        status=game.status,
        result=game.result,
        final_fen=game.final_fen,
        created_at=game.created_at,
        updated_at=game.updated_at,
    )


@game_router.post(
    "/games",
    description="Creates a chess game for a user",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def create_chess_game(game: CreateGame, db: Session = Depends(get_db)) -> GameResponse:
    user = get_user(db, game.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    created_game = create_game(
        db,
        user_id=game.user_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=game.moves,
    )
    return _game_response(created_game)


@game_router.get(
    "/games",
    description="Returns all chess games",
    response_model=list[GameResponse],
)
def get_chess_games(db: Session = Depends(get_db)) -> list[GameResponse]:
    return [_game_response(game) for game in get_all_games(db)]


@game_router.get(
    "/games/{game_id}",
    description="Returns a chess game by game id",
    responses={
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def get_chess_game(game_id: int, db: Session = Depends(get_db)) -> GameResponse:
    game = get_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(game)


@game_router.get(
    "/games/{game_id}/moves",
    description="Returns moves for a chess game",
    responses={
        404: {"description": "Game not found"},
    },
    response_model=Union[GameMovesResponse, ErrorResponse],
)
def get_chess_game_moves(
    game_id: int, db: Session = Depends(get_db)
) -> GameMovesResponse:
    game = get_game(db, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return GameMovesResponse(game_id=game.id, moves=game.moves)


@game_router.get(
    "/users/{user_id}/games",
    description="Returns chess games for a user id",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[list[GameResponse], ErrorResponse],
)
def get_chess_games_by_user_id(
    user_id: int, db: Session = Depends(get_db)
) -> list[GameResponse]:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return [_game_response(game) for game in get_games_by_user(db, user_id)]


@game_router.get(
    "/users/by_username/{username}/games",
    description="Returns chess games for a username",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[list[GameResponse], ErrorResponse],
)
def get_chess_games_by_username(
    username: str, db: Session = Depends(get_db)
) -> list[GameResponse]:
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return [_game_response(game) for game in get_games_by_user(db, user.id)]


@game_router.put(
    "/games/{game_id}",
    description="Updates a chess game",
    responses={
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def update_chess_game(
    game_id: int, game: UpdateGame, db: Session = Depends(get_db)
) -> GameResponse:
    updated_game = update_game(
        db,
        game_id=game_id,
        player_side=game.player_side,
        ai_depth=game.ai_depth,
        moves=game.moves,
        status=game.status,
        result=game.result,
        final_fen=game.final_fen,
    )
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.post(
    "/games/{game_id}/moves",
    description="Appends one move to a chess game",
    responses={
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def append_chess_game_move(
    game_id: int, move: AppendMove, db: Session = Depends(get_db)
) -> GameResponse:
    updated_game = append_game_move(db, game_id, move.move)
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.post(
    "/games/{game_id}/finish",
    description="Marks a chess game as finished",
    responses={
        404: {"description": "Game not found"},
    },
    response_model=Union[GameResponse, ErrorResponse],
)
def finish_chess_game(
    game_id: int, game: FinishGame, db: Session = Depends(get_db)
) -> GameResponse:
    updated_game = finish_game(
        db,
        game_id=game_id,
        status=game.status,
        result=game.result,
        final_fen=game.final_fen,
    )
    if updated_game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return _game_response(updated_game)


@game_router.delete(
    "/games/{game_id}",
    description="Deletes a chess game",
    responses={
        404: {"description": "Game not found"},
    },
)
def delete_chess_game(game_id: int, db: Session = Depends(get_db)) -> bool:
    deleted = delete_game(db, game_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Game not found")

    return True
