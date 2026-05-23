from typing import Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.adapters.db import get_db
from backend.adapters.jwt import (
    create_setup_token,
    get_access_token_payload,
)
from backend.adapters.models import User, UserRole
from backend.adapters.user_service import (
    authenticate_user,
    count_admin_users,
    create_user,
    delete_user,
    get_all_users,
    get_user,
    get_user_by_email,
    get_user_by_username,
    remove_two_factor_secret,
    update_user_role,
)
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
        two_factor_set=user.two_factor_secret is not None,
    )


def _require_admin(payload: dict) -> None:
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _is_admin(payload: dict) -> bool:
    return payload.get("role") == "admin"


def _token_user_id(payload: dict) -> int:
    return int(payload["sub"])


def _require_admin_or_self(payload: dict, user_id: int) -> None:
    if not _is_admin(payload) and _token_user_id(payload) != user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user")


def _ensure_unique_user(db: Session, user: CreateUser) -> None:
    if get_user_by_username(db, user.username) is not None:
        raise HTTPException(status_code=409, detail="Username already exists")
    if get_user_by_email(db, str(user.email)) is not None:
        raise HTTPException(status_code=409, detail="Email already exists")


@user_router.post(
    "",
    description="Creates a user with the default USER role",
    responses={
        409: {"description": "Username or email already exists"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def create_app_user(user: CreateUser, db: Session = Depends(get_db)) -> UserResponse:
    _ensure_unique_user(db, user)
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

    two_factor_set = authenticated_user.two_factor_secret is not None
    return LoginResponse(
        user_id=authenticated_user.id,
        username=authenticated_user.username,
        two_factor_set=two_factor_set,
        setup_token=None if two_factor_set else create_setup_token(authenticated_user),
    )


@user_router.get(
    "",
    description="Returns users. Admins receive all users; users receive only themselves.",
    responses={
        404: {"description": "User not found"},
    },
    response_model=list[Union[AdminUserResponse, UserResponse]],
)
def get_app_users(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> list[Union[AdminUserResponse, UserResponse]]:
    if _is_admin(payload):
        return [_admin_user_response(user) for user in get_all_users(db)]

    user = get_user(db, _token_user_id(payload))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return [_user_response(user)]


@user_router.get(
    "/by_username/{username}",
    description="Returns a user by username. Admins receive sensitive user information.",
    responses={
        403: {"description": "Cannot access another user"},
        404: {"description": "User not found"},
    },
    response_model=Union[AdminUserResponse, UserResponse, ErrorResponse],
)
def get_app_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> Union[AdminUserResponse, UserResponse]:
    user = get_user_by_username(db, username)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _require_admin_or_self(payload, user.id)
    if _is_admin(payload):
        return _admin_user_response(user)
    return _user_response(user)


@user_router.get(
    "/{user_id}",
    description="Returns a user by user id. Admins receive sensitive user information.",
    responses={
        403: {"description": "Cannot access another user"},
        404: {"description": "User not found"},
    },
    response_model=Union[AdminUserResponse, UserResponse, ErrorResponse],
)
def get_app_user(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> Union[AdminUserResponse, UserResponse]:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    _require_admin_or_self(payload, user.id)
    if _is_admin(payload):
        return _admin_user_response(user)
    return _user_response(user)


@user_router.put(
    "/{user_id}/role",
    description="Updates a user's role. Admin only.",
    responses={
        403: {"description": "Admin access required"},
        404: {"description": "User not found"},
        409: {"description": "Cannot demote the last admin"},
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
    existing_user = get_user(db, user_id)
    if existing_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if (
        existing_user.role == UserRole.ADMIN
        and user_role.role != UserRole.ADMIN
        and count_admin_users(db) <= 1
    ):
        raise HTTPException(status_code=409, detail="Cannot demote the last admin")

    user = update_user_role(db, user_id, user_role.role)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)


@user_router.delete(
    "/{user_id}/2fa",
    description="Resets a user's 2FA secret. Admin only.",
    responses={
        403: {"description": "Admin access required"},
        404: {"description": "User not found"},
    },
    response_model=Union[UserResponse, ErrorResponse],
)
def reset_app_user_two_factor(
    user_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_access_token_payload),
) -> UserResponse:
    _require_admin(payload)
    user = remove_two_factor_secret(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user)


@user_router.delete(
    "/{user_id}",
    description="Deletes a user. Admins can delete anyone; users can delete only their own account.",
    responses={
        403: {"description": "Cannot delete another user's account"},
        404: {"description": "User not found"},
        409: {"description": "Cannot delete the last admin"},
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

    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.ADMIN and count_admin_users(db) <= 1:
        raise HTTPException(status_code=409, detail="Cannot delete the last admin")

    deleted = delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")

    return True
