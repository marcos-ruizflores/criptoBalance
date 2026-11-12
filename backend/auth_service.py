import re
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from backend.config import JWT_SECRET, JWT_TTL_HOURS
from backend.db import users_col

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8


def to_public(user: dict) -> dict:
    u = {**user}
    u.pop("password_hash", None)
    if "_id" in u:
        u["_id"] = str(u["_id"])
    return u


def create_user(email: str, password: str, name: Optional[str] = None, phone: Optional[str] = None) -> dict:
    email = (email or "").strip().lower()
    password = password or ""
    if not EMAIL_RE.match(email):
        raise ValueError("El email no es válido")
    if len(password) < MIN_PASSWORD:
        raise ValueError(f"La contraseña debe tener al menos {MIN_PASSWORD} caracteres")
    if len(password.encode("utf-8")) > 72:
        raise ValueError("La contraseña no puede superar 72 caracteres")
    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    doc = {
        "email": email,
        "name": (name or "").strip() or None,
        "phone": (phone or "").strip() or None,
        "password_hash": pwd_hash,
        "created_at": datetime.utcnow(),
        "last_login_at": None,
    }
    try:
        users_col().insert_one(doc)
    except DuplicateKeyError:
        raise ValueError("Ya existe una cuenta con ese email")
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
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user["_id"]), "iat": now, "exp": now + timedelta(hours=JWT_TTL_HOURS)}
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


def user_from_token(token: str) -> Optional[dict]:
    """Returns the user behind a valid token, or None if it's bad, expired or the user is gone."""
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"require": ["sub", "exp"]})
        oid = ObjectId(claims["sub"])
    except Exception:
        return None
    user = users_col().find_one({"_id": oid})
    return to_public(user) if user else None


class LoginLimiter:
    """Small in-memory cap on failed logins per IP. Good enough for a single instance."""

    def __init__(self, max_failures: int = 10, window_s: int = 900):
        self.max_failures = max_failures
        self.window_s = window_s
        self._failures = defaultdict(deque)

    def _recent(self, key: str) -> deque:
        q = self._failures[key]
        cutoff = time.monotonic() - self.window_s
        while q and q[0] < cutoff:
            q.popleft()
        return q

    def blocked(self, key: str) -> bool:
        return len(self._recent(key)) >= self.max_failures

    def fail(self, key: str):
        self._recent(key).append(time.monotonic())

    def reset(self, key: str):
        self._failures.pop(key, None)
