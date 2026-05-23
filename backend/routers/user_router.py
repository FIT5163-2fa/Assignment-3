from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.game_service import get_games_by_user
from backend.adapters.jwt import (
    create_setup_token,
    get_access_token_payload,
    get_optional_token_payload,
)
from backend.adapters.models import Games, User
from backend.adapters.user_service import (
    authenticate_user,
    create_user,
    delete_user,
    get_all_users,
    get_user,
    get_user_by_username,
    update_user_role,
)
from backend.schemas.game_schema import GameResponse
from backend.schemas.user_schema import (
    AdminUserResponse,
    CreateUser,
    ErrorResponse,
    LoginResponse,
    LoginUser,
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
        role=user.role,
    )


def _admin_user_response(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        username=user.username,
        hashed_email=user.hashed_email,
        role=user.role,
        hashed_password=user.hashed_password,
        two_factor_secret=user.two_factor_secret if user.two_factor_secret else None,
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


def _require_admin(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _is_admin(payload: dict | None) -> bool:
    return payload is not None and payload.get("role") == "admin"


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


@user_router.post(
    "/login",
    description="Authenticates a user by email and password before 2FA",
    responses={
        401: {"description": "Invalid email or password"},
    },
    response_model=Union[LoginResponse, ErrorResponse],
)
def login_app_user(user: LoginUser, db: Session = Depends(get_db)) -> LoginResponse:
    authenticated_user = authenticate_user(
        db,
        str(user.email),
        user.password.get_secret_value(),
    )
    if authenticated_user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return LoginResponse(
        user_id=authenticated_user.id,
        username=authenticated_user.username,
        two_factor_set=authenticated_user.two_factor_secret is not None,
        setup_token=create_setup_token(authenticated_user),
    )


@user_router.get(
    "",
    description="Returns all users. Admins receive sensitive user information.",
    response_model=list[Union[AdminUserResponse, UserResponse]],
)
def get_app_users(
    db: Session = Depends(get_db),
    payload: dict | None = Depends(get_optional_token_payload),
) -> list[Union[AdminUserResponse, UserResponse]]:
    if _is_admin(payload):
        return [_admin_user_response(user) for user in get_all_users(db)]
    return [_user_response(user) for user in get_all_users(db)]


@user_router.get(
    "/by_username/{username}",
    description="Returns a user by username. Admins receive sensitive user information.",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[AdminUserResponse, UserResponse, ErrorResponse],
)
def get_app_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    payload: dict | None = Depends(get_optional_token_payload),
) -> Union[AdminUserResponse, UserResponse]:
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if _is_admin(payload):
        return _admin_user_response(user)
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
    description="Returns a user by user id. Admins receive sensitive user information.",
    responses={
        404: {"description": "User not found"},
    },
    response_model=Union[AdminUserResponse, UserResponse, ErrorResponse],
)
def get_app_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict | None = Depends(get_optional_token_payload),
) -> Union[AdminUserResponse, UserResponse]:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if _is_admin(payload):
        return _admin_user_response(user)
    return _user_response(user)


@user_router.put(
    "/{user_id}/role",
    description="Updates a user's role. Admin only.",
    responses={
        403: {"description": "Admin access required"},
        404: {"description": "User not found"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def update_app_user_role(
    user_id: int,
    user_role: UpdateUserRole,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> UserResponse:
    _require_admin(payload)
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
    description="Deletes a user. Admins can delete anyone; users can delete only their own account.",
    responses={
        403: {"description": "Cannot delete another user's account"},
        404: {"description": "User not found"},
    },
)
def delete_app_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> bool:
    token_user_id = int(payload["sub"])
    is_admin = payload.get("role") == "admin"
    if not is_admin and token_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete another user's account",
        )

    deleted = delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")

    return True
