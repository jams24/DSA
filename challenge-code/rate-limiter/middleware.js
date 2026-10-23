// Sliding-window *counter*: keep only two counters per client (this fixed window and the previous
// one) and weight the previous window by how much of it still overlaps the sliding window.
// Approximate, but O(1) memory and easy to store in Redis with INCR + EXPIRE.
function rateLimit({ limit, windowMs, key = (req) => req.ip, now = Date.now }) {
  const counters = new Map(); // key -> { window, current, previous }

  return function rateLimitMiddleware(req, res, next) {
    const t = now();
    const window = Math.floor(t / windowMs);
    const k = key(req);
    let c = counters.get(k);
    if (!c || c.window < window - 1) c = { window, current: 0, previous: 0 };
    else if (c.window === window - 1) c = { window, current: 0, previous: c.current };
    counters.set(k, c);

    const overlap = 1 - (t % windowMs) / windowMs; // share of the previous window still inside
    const estimate = c.previous * overlap + c.current;
    res.setHeader("RateLimit-Limit", String(limit));
    if (estimate + 1 > limit) {
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("Retry-After", String(Math.ceil((windowMs - (t % windowMs)) / 1000)));
      res.statusCode = 429;
      return res.end("rate limit exceeded");
    }
    c.current++;
    res.setHeader("RateLimit-Remaining", String(Math.max(0, Math.floor(limit - estimate - 1))));
    next();
  };
}

module.exports = { rateLimit };
// usage with Express: app.use(rateLimit({ limit: 100, windowMs: 60_000 }))
