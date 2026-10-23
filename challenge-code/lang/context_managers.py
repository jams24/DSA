import time
from contextlib import contextmanager
from typing import Iterator


class Timer:
    """Class form: __enter__ runs at the start of the with-block, __exit__ always runs at the end,
    even if the block raised. Returning False (or None) from __exit__ lets the exception propagate."""

    def __init__(self, label: str, log: list[str] | None = None):
        self.label, self.log = label, log if log is not None else []
        self.elapsed = 0.0

    def __enter__(self) -> "Timer":
        self.start = time.perf_counter()
        return self  # bound to the name after `as`

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.elapsed = time.perf_counter() - self.start
        status = "failed" if exc_type else "ok"
        self.log.append(f"{self.label} {status} in {self.elapsed * 1000:.0f}ms")
        return False  # never swallow exceptions by accident


@contextmanager
def transaction(db: dict) -> Iterator[dict]:
    """Generator form: code before `yield` is setup, after it is teardown. Work on a copy and
    only publish it if the block finishes without an exception (all-or-nothing)."""
    draft = dict(db)
    try:
        yield draft
    except Exception:
        raise  # discard the draft; the original dict is untouched
    else:
        db.clear()
        db.update(draft)


@contextmanager
def suppress_and_log(*exc_types: type[BaseException], log: list[str]):
    """Swallow only the listed exceptions, like contextlib.suppress, but record them."""
    try:
        yield
    except exc_types as e:
        log.append(f"suppressed {type(e).__name__}: {e}")
