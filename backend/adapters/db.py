from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    # Import models before create_all so SQLAlchemy registers every table.
    from backend.adapters.models import UserRole
    from backend.adapters.user_service import (
        create_user,
        get_user_by_email,
        update_user_role,
    )
    from config import get_settings

    Base.metadata.create_all(bind=engine)

    settings = get_settings()
    db = SessionLocal()
    try:
        # Bootstrap is idempotent so app restarts do not create duplicate admins.
        admin_user = get_user_by_email(db, settings.ADMIN_EMAIL)
        if admin_user:
            if admin_user.role != UserRole.ADMIN:
                update_user_role(db, admin_user.id, UserRole.ADMIN)
            return

        admin_username = settings.ADMIN_EMAIL.split("@", maxsplit=1)[0]
        create_user(
            db,
            username=admin_username,
            email=settings.ADMIN_EMAIL,
            plain_password=settings.ADMIN_PASSWORD,
            role=UserRole.ADMIN,
        )
    finally:
        db.close()
