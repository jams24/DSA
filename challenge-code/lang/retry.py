import functools
import random
import time
from typing import Callable, TypeVar

T = TypeVar("T")


def retry(
    times: int = 3,
    on: tuple[type[BaseException], ...] = (Exception,),
    base_delay: float = 0.1,
    max_delay: float = 5.0,
    sleep: Callable[[float], None] = time.sleep,
):
    """Decorator factory: retry the wrapped function on the given exceptions with exponential
    backoff and full jitter. The last exception is re-raised unchanged."""
    if times < 1:
        raise ValueError("times must be >= 1")

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(fn)  # keep the name, docstring and signature of fn
        def wrapper(*args, **kwargs) -> T:
            for attempt in range(times):
                try:
                    return fn(*args, **kwargs)
                except on:
                    if attempt == times - 1:
                        raise
                    sleep(random.uniform(0, min(max_delay, base_delay * 2**attempt)))
            raise AssertionError("unreachable")

        wrapper.retry_times = times  # type: ignore[attr-defined]
        return wrapper

    return decorator


# @retry(times=5, on=(ConnectionError, TimeoutError))
# def fetch_profile(user_id): ...
