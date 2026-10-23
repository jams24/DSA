import secrets
import string
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

ALPHABET = string.ascii_letters + string.digits
CODE_LEN = 7
RATE_LIMIT, WINDOW_S = 10, 60.0  # at most 10 creates per client per minute

app = FastAPI()
links: dict[str, dict] = {}  # code -> {"url": ..., "hits": ...}
by_url: dict[str, str] = {}  # url -> code, so shortening the same URL twice is idempotent
recent: dict[str, deque] = defaultdict(deque)  # client -> timestamps of recent creates


class ShortenIn(BaseModel):
    url: str
    alias: str | None = None


def allow(client: str) -> bool:
    """Sliding-window log: drop timestamps older than the window, then count."""
    now = time.monotonic()
    q = recent[client]
    while q and now - q[0] >= WINDOW_S:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return False
    q.append(now)
    return True


def valid_url(url: str) -> bool:
    p = urlparse(url)
    return p.scheme in ("http", "https") and bool(p.netloc)


def new_code() -> str:
    while True:  # 62^7 ≈ 3.5e12 codes, so collisions are rare; retry if one happens
        code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))
        if code not in links:
            return code


@app.post("/shorten", status_code=201)
def shorten(body: ShortenIn, request: Request, response: Response):
    client = request.client.host if request.client else "unknown"
    if not allow(client):
        raise HTTPException(429, "rate limit exceeded", headers={"Retry-After": str(int(WINDOW_S))})
    if not valid_url(body.url):
        raise HTTPException(400, "url must be an absolute http(s) URL")
    if body.alias is not None:
        if not (3 <= len(body.alias) <= 32 and body.alias.isalnum()):
            raise HTTPException(400, "alias must be 3-32 letters or digits")
        if body.alias in links:
            raise HTTPException(409, "alias already taken")
        code = body.alias
    elif body.url in by_url:
        response.status_code = 200
        code = by_url[body.url]
    else:
        code = new_code()
        by_url[body.url] = code
    links.setdefault(code, {"url": body.url, "hits": 0})
    return {"code": code, "short_url": f"{request.base_url}{code}", "url": body.url}


@app.get("/stats/{code}")
def stats(code: str):
    if code not in links:
        raise HTTPException(404, "unknown code")
    return {"code": code, **links[code]}


@app.get("/{code}")
def follow(code: str):
    link = links.get(code)
    if link is None:
        raise HTTPException(404, "unknown code")
    link["hits"] += 1
    return RedirectResponse(link["url"], status_code=302)
