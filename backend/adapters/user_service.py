from sqlalchemy.orm import Session
from password_hasher import hash_password, verify_password
from models import User


def create_user(
    db: Session,
    username: str,
    email: str,
    plain_password: str,
    two_factor_secret: str | None = None,
) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(plain_password),
        two_factor_secret=two_factor_secret,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_all_users(db: Session) -> list[User]:
    return db.query(User).all()


def update_two_factor_secret(db: Session, user_id: int, secret: bytes) -> User | None:
    user = get_user(db, user_id)
    if not user:
        return None
    user.two_factor_secret = secret
    db.commit()
    db.refresh(user)
    return user


def remove_two_factor_secret(db: Session, user_id: int) -> User | None:
    user = get_user(db, user_id)
    if not user:
        return None
    user.two_factor_secret = None
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = get_user(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user
