const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

class ApiError extends Error {}

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
/** exponential backoff with full jitter */
const backoff = (attempt, baseMs = 200, capMs = 5000) => Math.random() * Math.min(capMs, baseMs * 2 ** attempt);

async function getJson(url, { maxAttempts = 4, timeoutMs = 5000, sleep = sleepMs } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const last = attempt === maxAttempts - 1;
    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      // network failure or timeout (AbortSignal.timeout rejects with a TimeoutError)
      if (last) throw new ApiError(`GET ${url} failed after ${maxAttempts} attempts: ${err.name}`);
      await sleep(backoff(attempt));
      continue;
    }
    if (res.ok) return res.json();
    if (!RETRYABLE.has(res.status) || last) throw new ApiError(`GET ${url} returned ${res.status}`);
    await res.body?.cancel(); // free the connection before waiting
    const hint = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(hint) && hint > 0 ? Math.min(hint, 30) * 1000 : backoff(attempt));
  }
}

/** Follow ?page=N until next_page is null. An async generator lets callers stop early. */
async function* allItems(baseUrl, opts) {
  for (let page = 1; page != null; ) {
    const data = await getJson(`${baseUrl}/items?page=${page}`, opts);
    yield* data.items;
    page = data.next_page;
  }
}

module.exports = { getJson, allItems, ApiError };
// usage: for await (const item of allItems("https://api.example.com")) { ... }
