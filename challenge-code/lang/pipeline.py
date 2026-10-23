import json
from collections import Counter
from itertools import islice
from typing import Iterable, Iterator

# Each stage is a generator: it pulls one item at a time from the previous stage, so the
# pipeline uses O(1) memory however large the input is, and stops reading as soon as the
# consumer stops asking (e.g. take(...) below).


def read_lines(chunks: Iterable[str]) -> Iterator[str]:
    """Re-split arbitrary text chunks (as a socket or file read gives them) into lines."""
    buf = ""
    for chunk in chunks:
        buf += chunk
        *lines, buf = buf.split("\n")
        yield from lines
    if buf:
        yield buf


def parse_json(lines: Iterable[str], errors: list[str]) -> Iterator[dict]:
    for n, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            errors.append(f"line {n}: invalid JSON")


def only_errors(events: Iterable[dict]) -> Iterator[dict]:
    return (e for e in events if e.get("level") == "error")  # a generator expression is a stage too


def batched(items: Iterable, size: int) -> Iterator[list]:
    it = iter(items)
    while batch := list(islice(it, size)):
        yield batch


def take(items: Iterable, n: int) -> list:
    return list(islice(items, n))


def top_services(events: Iterable[dict], k: int) -> list[tuple[str, int]]:
    return Counter(e["service"] for e in events).most_common(k)
