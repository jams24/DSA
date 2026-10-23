import asyncio
import time

from solution import fetch_all, gather_limited

active = peak = 0


async def job(i: int, delay: float) -> int:
    global active, peak
    active += 1
    peak = max(peak, active)
    await asyncio.sleep(delay)
    active -= 1
    return i


async def main():
    t0 = time.perf_counter()
    out = await gather_limited([lambda i=i, d=d: job(i, d) for i, d in enumerate([0.05, 0.01, 0.03, 0.02, 0.04])], 2)
    assert out == [0, 1, 2, 3, 4] and peak == 2, (out, peak)
    assert time.perf_counter() - t0 < 0.14

    async def fake_fetch(url: str) -> str:
        if url == "bad":
            raise ValueError("boom")
        if url == "slow":
            await asyncio.sleep(1)
        return url.upper()

    res = await fetch_all(["a", "bad", "slow", "d"], 2, fake_fetch, timeout=0.05)
    assert res[0] == "A" and res[3] == "D"
    assert isinstance(res[1], ValueError) and isinstance(res[2], (asyncio.TimeoutError, TimeoutError))


asyncio.run(main())
print("ok")
