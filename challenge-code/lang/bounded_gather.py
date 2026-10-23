import asyncio
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


async def gather_limited(factories: list[Callable[[], Awaitable[T]]], limit: int) -> list[T]:
    """Run coroutines with at most `limit` running at once; results keep input order.
    Pass factories (not coroutines) so nothing starts before it gets a slot."""
    sem = asyncio.Semaphore(limit)

    async def run(factory: Callable[[], Awaitable[T]]) -> T:
        async with sem:
            return await factory()

    return await asyncio.gather(*(run(f) for f in factories))


async def fetch_all(urls: list[str], limit: int, fetch: Callable[[str], Awaitable[T]], timeout: float = 5.0) -> list[T | Exception]:
    """Settled results: an exception object in place of each failure or timeout."""

    async def one(url: str):
        try:
            return await asyncio.wait_for(fetch(url), timeout)
        except Exception as e:  # noqa: BLE001 - we return the error instead of raising
            return e

    return await gather_limited([lambda u=u: one(u) for u in urls], limit)


# With httpx:
# async with httpx.AsyncClient() as client:
#     results = await fetch_all(urls, 10, lambda u: client.get(u))
