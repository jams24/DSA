import random
import time
from typing import Callable

import httpx

RETRYABLE = {408, 429, 500, 502, 503, 504}


class ApiError(Exception):
    pass


def backoff(attempt: int, base: float = 0.2, cap: float = 5.0) -> float:
    """Exponential backoff with full jitter: random in [0, min(cap, base * 2^attempt)].
    Jitter spreads retries out so many clients don't hammer a recovering server in lockstep."""
    return random.uniform(0, min(cap, base * 2**attempt))


def retry_after_seconds(value: str | None) -> float | None:
    if value and value.strip().isdigit():
        return float(value)
    return None  # (an HTTP-date is also legal; treat it like "no hint" here)


def get_json(client: httpx.Client, url: str, *, params=None, max_attempts: int = 4, sleep: Callable[[float], None] = time.sleep):
    for attempt in range(max_attempts):
        last = attempt == max_attempts - 1
        try:
            r = client.get(url, params=params)
        except httpx.TransportError as e:  # connection errors and timeouts
            if last:
                raise ApiError(f"GET {url} failed after {max_attempts} attempts: {e!r}") from e
            sleep(backoff(attempt))
            continue
        if r.status_code < 400:
            return r.json()
        if r.status_code not in RETRYABLE or last:
            raise ApiError(f"GET {url} returned {r.status_code}: {r.text[:200]}")
        hint = retry_after_seconds(r.headers.get("Retry-After"))
        sleep(min(hint, 30.0) if hint is not None else backoff(attempt))
    raise AssertionError("unreachable")


def fetch_all_items(client: httpx.Client, path: str = "/items", **kw) -> list:
    """Follow ?page=N until the server says there is no next page."""
    items, page = [], 1
    while page is not None:
        data = get_json(client, path, params={"page": page}, **kw)
        items.extend(data["items"])
        page = data.get("next_page")
    return items


# usage:
# with httpx.Client(base_url="https://api.example.com", timeout=httpx.Timeout(5.0)) as client:
#     items = fetch_all_items(client)
