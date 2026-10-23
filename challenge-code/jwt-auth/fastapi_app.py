import hashlib
import hmac
import os
import re
import secrets
import time
import uuid

import jwt  # PyJWT
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

SECRET = os.environ.get("JWT_SECRET") or secrets.token_hex(32)  # random per process if unset (dev only)
TOKEN_TTL_S = 15 * 60
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

app = FastAPI()
users: dict[str, dict] = {}  # email -> {"id", "email", "password_hash"}
bearer = HTTPBearer(auto_error=False)


class Credentials(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, _ = stored.split(":")
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt_hex)), stored)


DUMMY_HASH = hash_password(secrets.token_hex(8))  # equalizes timing for unknown emails


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    unauthorized = HTTPException(401, "invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        claims = jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])  # pin the algorithm
    except jwt.InvalidTokenError:
        raise unauthorized
    user = next((u for u in users.values() if u["id"] == claims.get("sub")), None)
    if user is None:
        raise unauthorized
    return user


@app.post("/register", status_code=201)
def register(body: Credentials):
    email = body.email.lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "invalid email")
    if email in users:
        raise HTTPException(409, "email already registered")
    users[email] = {"id": str(uuid.uuid4()), "email": email, "password_hash": hash_password(body.password)}
    return {"id": users[email]["id"], "email": email}


@app.post("/login")
def login(body: Credentials):
    user = users.get(body.email.lower())
    ok = verify_password(body.password, user["password_hash"] if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "invalid email or password")
    now = int(time.time())
    token = jwt.encode({"sub": user["id"], "iat": now, "exp": now + TOKEN_TTL_S}, SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "expires_in": TOKEN_TTL_S}


@app.get("/me")
def me(user: dict = Depends(current_user)):
    return {"id": user["id"], "email": user["email"]}
