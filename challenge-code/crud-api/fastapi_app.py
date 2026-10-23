import base64
import itertools
import threading
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, Field

app = FastAPI()
books: dict[int, dict] = {}
ids = itertools.count(1)
lock = threading.Lock()


class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=100)
    year: int = Field(ge=0, le=2100)
    tags: list[str] = Field(default_factory=list, max_length=10)


class BookPatch(BaseModel):
    """Every field optional: PATCH changes only what is sent."""

    title: str | None = Field(None, min_length=1, max_length=200)
    author: str | None = Field(None, min_length=1, max_length=100)
    year: int | None = Field(None, ge=0, le=2100)
    tags: list[str] | None = Field(None, max_length=10)


def encode_cursor(last_id: int) -> str:
    return base64.urlsafe_b64encode(str(last_id).encode()).decode()


def decode_cursor(cursor: str) -> int:
    try:
        return int(base64.urlsafe_b64decode(cursor.encode()).decode())
    except ValueError:
        raise HTTPException(400, "invalid cursor")


def get_or_404(book_id: int) -> dict:
    if book_id not in books:
        raise HTTPException(404, f"book {book_id} not found")
    return books[book_id]


@app.post("/books", status_code=201)
def create(book: BookIn, response: Response):
    with lock:
        book_id = next(ids)
        books[book_id] = {"id": book_id, **book.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    response.headers["Location"] = f"/books/{book_id}"
    return books[book_id]


@app.get("/books")
def list_books(limit: int = Query(20, ge=1, le=100), cursor: str | None = None, author: str | None = None):
    """Cursor (keyset) pagination: stable under inserts and deletes, unlike ?page=N with OFFSET."""
    after = decode_cursor(cursor) if cursor else 0
    rows = [b for b in sorted(books.values(), key=lambda b: b["id"]) if b["id"] > after]
    if author:
        rows = [b for b in rows if b["author"].lower() == author.lower()]
    page = rows[:limit]
    has_more = len(rows) > limit
    return {"data": page, "next_cursor": encode_cursor(page[-1]["id"]) if has_more else None}


@app.get("/books/{book_id}")
def read(book_id: int):
    return get_or_404(book_id)


@app.patch("/books/{book_id}")
def update(book_id: int, patch: BookPatch):
    with lock:
        book = get_or_404(book_id)
        book.update(patch.model_dump(exclude_unset=True))
        return book


@app.delete("/books/{book_id}", status_code=204)
def delete(book_id: int):
    with lock:
        get_or_404(book_id)
        del books[book_id]
