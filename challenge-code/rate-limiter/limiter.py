import threading
import time
from collections import defaultdict, deque
from typing import Callable

Clock = Callable[[], float]


class SlidingWindowLimiter:
    """Exact: keep each client's request timestamps from the last `window` seconds.
    Memory is O(limit) per client."""

    def __init__(self, limit: int, window: float, clock: Clock = time.monotonic):
        self.limit, self.window, self.clock = limit, window, clock
        self.log: dict[str, deque[float]] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, client: str) -> bool:
        now = self.clock()
        with self.lock:
            q = self.log[client]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True

    def retry_after(self, client: str) -> float:
        """Seconds until the oldest request leaves the window (0 if a request would pass now)."""
        with self.lock:
            q = self.log[client]
            if len(q) < self.limit:
                return 0.0
            return max(0.0, q[0] + self.window - self.clock())


class TokenBucket:
    """O(1) memory per client. Tokens refill continuously at `rate` per second up to
    `capacity`, so short bursts are allowed but the long-run rate is capped."""

    def __init__(self, capacity: float, rate: float, clock: Clock = time.monotonic):
        self.capacity, self.rate, self.clock = capacity, rate, clock
        self.buckets: dict[str, tuple[float, float]] = {}  # client -> (tokens, last refill)
        self.lock = threading.Lock()

    def allow(self, client: str, cost: float = 1.0) -> bool:
        now = self.clock()
        with self.lock:
            tokens, last = self.buckets.get(client, (self.capacity, now))
            tokens = min(self.capacity, tokens + (now - last) * self.rate)
            ok = tokens >= cost
            self.buckets[client] = (tokens - cost if ok else tokens, now)
            return ok
