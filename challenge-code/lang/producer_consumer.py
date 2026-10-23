import queue
import threading
from typing import Callable, Iterable, TypeVar

T = TypeVar("T")
R = TypeVar("R")
_DONE = object()  # poison pill


def run_pipeline(sources: list[Iterable[T]], consumers: int, work: Callable[[T], R], capacity: int = 8) -> list[R]:
    """Bounded queue between producer and consumer threads. put() blocks when full
    (backpressure); get() blocks when empty. One poison pill per consumer shuts them down."""
    q: queue.Queue = queue.Queue(maxsize=capacity)
    results: list[R] = []
    lock = threading.Lock()

    def produce(items: Iterable[T]) -> None:
        for item in items:
            q.put(item)

    def consume() -> None:
        while (item := q.get()) is not _DONE:
            r = work(item)
            with lock:  # list.append is atomic in CPython, but don't rely on that
                results.append(r)

    producers = [threading.Thread(target=produce, args=(s,)) for s in sources]
    workers = [threading.Thread(target=consume) for _ in range(consumers)]
    for t in producers + workers:
        t.start()
    for t in producers:
        t.join()
    for _ in workers:
        q.put(_DONE)
    for t in workers:
        t.join()
    return results
