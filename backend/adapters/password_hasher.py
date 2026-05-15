from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib import PasswordHash

# Uses Argon2
password_hash = PasswordHash([Argon2Hasher()])


def hash_password(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)