const assert = require("node:assert/strict");
const { rateLimit } = require("./solution.cjs");

let t = 0;
const mw = rateLimit({ limit: 3, windowMs: 10_000, now: () => t });
const call = (ip) => {
  const headers = {};
  const res = { statusCode: 200, setHeader: (k, v) => (headers[k] = v), end: () => {} };
  let passed = false;
  mw({ ip }, res, () => (passed = true));
  return { passed, status: passed ? 200 : res.statusCode, headers };
};

assert.deepEqual([call("a"), call("a"), call("a"), call("a")].map((r) => r.passed), [true, true, true, false]);
assert.equal(call("a").headers["Retry-After"], "10");
assert.ok(call("b").passed);
t = 15_000; // halfway into the next window: previous count 3 weighs 1.5
const r = [call("a"), call("a")];
assert.deepEqual(r.map((x) => x.passed), [true, false]);
t = 40_000; // long idle: everything resets
assert.ok(call("a").passed);
console.log("ok");
