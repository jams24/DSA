const assert = require("node:assert/strict");
const { withRetry } = require("./solution.cjs");

(async () => {
  const waits = [];
  let n = 0;
  const flaky = withRetry(
    async (x) => {
      if (++n < 3) throw Object.assign(new Error("down"), { code: "ECONNRESET" });
      return x * 2;
    },
    { times: 4, baseMs: 100, wait: async (ms) => void waits.push(ms) },
  );
  assert.equal(await flaky(21), 42);
  assert.equal(n, 3);
  assert.ok(waits.length === 2 && waits[0] <= 100 && waits[1] <= 200);

  n = 0;
  const picky = withRetry(
    () => {
      n++;
      throw new TypeError("bug");
    },
    { shouldRetry: (e) => e.code === "ECONNRESET", wait: async () => {} },
  );
  await assert.rejects(picky(), TypeError);
  assert.equal(n, 1);

  n = 0;
  const always = withRetry(() => {
    n++;
    throw new Error("still down");
  }, { times: 3, wait: async () => {} });
  await assert.rejects(always(), /still down/);
  assert.equal(n, 3);
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
