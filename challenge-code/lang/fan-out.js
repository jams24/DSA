/** Resolve to `fallback` if the promise rejects or takes longer than `ms`. */
function withFallback(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, ms, fallback)));
  return Promise.race([promise.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

/** Fetch three dependencies in parallel; only the profile is required. */
async function loadDashboard({ profile, orders, recommendations }) {
  const [p, o, r] = await Promise.all([
    profile(), // no fallback: a failure here rejects the whole dashboard
    withFallback(orders(), 300, []),
    withFallback(recommendations(), 200, "popular-items"),
  ]);
  return { profile: p, orders: o, recommendations: r };
}

module.exports = { withFallback, loadDashboard };
