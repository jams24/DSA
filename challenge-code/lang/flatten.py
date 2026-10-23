from collections.abc import Iterable, Iterator
from typing import Any


def flatten(items: Iterable[Any], depth: float = float("inf")) -> Iterator[Any]:
    """Lazily flatten nested lists/tuples. Strings are iterable but must not be split into characters."""
    for item in items:
        if isinstance(item, (list, tuple)) and depth > 0:
            yield from flatten(item, depth - 1)
        else:
            yield item


def flatten_dict(d: dict, prefix: str = "", sep: str = ".") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in d.items():
        path = f"{prefix}{sep}{key}" if prefix else str(key)
        if isinstance(value, dict) and value:
            out.update(flatten_dict(value, path, sep))
        else:
            out[path] = value
    return out
