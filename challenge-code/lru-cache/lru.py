import threading
import time
from collections import OrderedDict
from typing import Callable, Generic, Hashable, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")
_MISSING = object()


class LRUCache(Generic[K, V]):
    """O(1) get/put. OrderedDict is a hash map plus a doubly linked list, so
    move_to_end and popitem(last=False) are both constant time."""

    def __init__(self, capacity: int, ttl: float | None = None, clock: Callable[[], float] = time.monotonic):
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity, self.ttl, self.clock = capacity, ttl, clock
        self.data: OrderedDict[K, tuple[V, float]] = OrderedDict()  # key -> (value, expires_at)
        self.lock = threading.Lock()
        self.hits = self.misses = 0

    def get(self, key: K, default=None):
        with self.lock:
            entry = self.data.get(key, _MISSING)
            if entry is _MISSING or entry[1] <= self.clock():
                if entry is not _MISSING:
                    del self.data[key]  # lazy expiry: drop stale entries when touched
                self.misses += 1
                return default
            self.data.move_to_end(key)  # most recently used goes to the back
            self.hits += 1
            return entry[0]

    def put(self, key: K, value: V, ttl: float | None = None) -> None:
        ttl = ttl if ttl is not None else self.ttl
        expires = self.clock() + ttl if ttl is not None else float("inf")
        with self.lock:
            self.data[key] = (value, expires)
            self.data.move_to_end(key)
            if len(self.data) > self.capacity:
                self.data.popitem(last=False)  # evict the least recently used (the front)

    def __len__(self) -> int:
        return len(self.data)
