from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.game_service import get_games_by_user
from backend.adapters.models import Games, User
from backend.adapters.user_service import (
    create_user,
    delete_user,
    get_all_users,
    get_user,
    get_user_by_username,
    update_user_role,
)
from backend.schemas.game_schema import GameResponse
from backend.schemas.user_schema import (
    CreateUser,
    ErrorResponse,
    UpdateUserRole,
    UserResponse,
)

user_router = APIRouter(prefix="/users", tags=["Users"])


def _split_moves(moves: str) -> list[str]:
    return moves.split() if moves else []


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
    )


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


@user_router.post(
    "",
    description="Creates a user with the default USER role",
    response_model=UserResponse,
)
def create_app_user(user: CreateUser, db: Session = Depends(get_db)) -> UserResponse:
    created_user = create_user(
        db,
        user.username,
        user.email,
        user.password.get_secret_value(),
    )
    return _user_response(created_user)


@user_router.get(
    "",
    description="Returns all users",
    response_model=list[UserResponse],
)
def get_app_users(db: Session = Depends(get_db)) -> list[UserResponse]:
    return [_user_response(user) for user in get_all_users(db)]


@user_router.get(
    "/by_username/{username}",
    description="Returns a user by username",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def get_app_user_by_username(
    username: str, db: Session = Depends(get_db)
) -> UserResponse:
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)


@user_router.get(
    "/by_username/{username}/games",
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


@user_router.get(
    "/{user_id}",
    description="Returns a user by user id",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def get_app_user(user_id: int, db: Session = Depends(get_db)) -> UserResponse:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)


@user_router.put(
    "/{user_id}/role",
    description="Updates a user's role",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def update_app_user_role(
    user_id: int, user_role: UpdateUserRole, db: Session = Depends(get_db)
) -> UserResponse:
    user = update_user_role(db, user_id, user_role.role)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)


@user_router.get(
    "/{user_id}/games",
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


@user_router.delete(
    "/{user_id}",
    description="Deletes a user",
    responses={
        404: {"description": "User not found"},
    },
)
def delete_app_user(user_id: int, db: Session = Depends(get_db)) -> bool:
    deleted = delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")

    return True
