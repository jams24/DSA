/**
 * Run async tasks with at most `limit` in flight. Results keep input order.
 * Start `limit` workers; each one pulls the next index until the list is exhausted.
 */
async function promisePool(tasks, limit) {
  if (!(limit >= 1)) throw new RangeError("limit must be >= 1");
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    // JS is single-threaded, so `next++` can't race between workers
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results; // rejects on the first failure, like Promise.all
}

/** Same idea for a list of URLs, with a timeout per request and settled results. */
async function fetchAllLimited(urls, limit, timeoutMs = 5000) {
  const tasks = urls.map((url) => () =>
    fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((value) => ({ ok: true, value }), (error) => ({ ok: false, error: String(error) })),
  );
  return promisePool(tasks, limit);
}

module.exports = { promisePool, fetchAllLimited };
