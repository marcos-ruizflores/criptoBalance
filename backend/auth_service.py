from datetime import datetime
from typing import Optional
from uuid import uuid4
import bcrypt
from backend.db import users_col


def to_public(user: dict) -> dict:
    u = {**user}
    u.pop("password_hash", None)
    if "_id" in u:
        u["_id"] = str(u["_id"])
    return u


def create_user(email: str, password: str, name: Optional[str] = None, phone: Optional[str] = None) -> dict:
    email = (email or "").strip().lower()
    if not email or not password:
        raise ValueError("Email y password requeridos")
    if len(password.encode("utf-8")) > 72:
        raise ValueError("La contraseña no puede superar 72 caracteres")
    if users_col().find_one({"email": email}):
        raise ValueError("El usuario ya existe")
    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    doc = {
        "email": email,
        "name": (name or "").strip() or None,
        "phone": (phone or "").strip() or None,
        "password_hash": pwd_hash,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }
    users_col().insert_one(doc)
    return to_public(doc)


def authenticate_user(email: str, password: str) -> Optional[dict]:
    email = (email or "").strip().lower()
    user = users_col().find_one({"email": email})
    if not user:
        return None
    if not _password_matches(password, user.get("password_hash", "")):
        return None
    users_col().update_one({"_id": user["_id"]}, {"$set": {"last_login_at": datetime.utcnow()}})
    return to_public(user)


def _password_matches(password: str, stored_hash: str) -> bool:
    # bcrypt only looks at 72 bytes and the library refuses anything longer
    raw = (password or "").encode("utf-8")
    if not stored_hash or len(raw) > 72:
        return False
    try:
        return bcrypt.checkpw(raw, stored_hash.encode("utf-8"))
    except ValueError:
        return False


def issue_token(user: dict) -> str:
    # Throwaway demo token (not a JWT). Swap for something persistent if needed.
    return str(uuid4())
