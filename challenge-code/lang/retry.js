const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * withRetry(fn, opts) returns a function that retries fn (sync or async) with exponential
 * backoff and full jitter. shouldRetry decides which errors are worth retrying.
 */
function withRetry(fn, { times = 3, baseMs = 100, maxMs = 5000, shouldRetry = () => true, wait = sleep } = {}) {
  return async function retried(...args) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (err) {
        if (attempt >= times - 1 || !shouldRetry(err)) throw err;
        await wait(Math.random() * Math.min(maxMs, baseMs * 2 ** attempt));
      }
    }
  };
}

module.exports = { withRetry };
