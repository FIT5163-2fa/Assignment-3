from sqlalchemy.orm import Session

from backend.adapters.db import User


def create_user(
    db: Session, username: str, two_factor_secret: str | None = None
) -> User:
    user = User(username=username, two_factor_secret=two_factor_secret)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_all_users(db: Session) -> list[User]:
    return db.query(User).all()


def update_two_factor_secret(db: Session, user_id: int, secret: str) -> User | None:
    user = get_user(db, user_id)
    if not user:
        return None
    user.two_factor_secret = secret
    db.commit()
    db.refresh(user)
    return user


def remove_two_factor_secret(db: Session, user_id: int) -> User | None:
    return update_two_factor_secret(db, user_id, None)


def delete_user(db: Session, user_id: int) -> bool:
    user = get_user(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True
