const assert = require("node:assert/strict");
const http = require("node:http");
const { promisePool, fetchAllLimited } = require("./solution.cjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let active = 0;
  let peak = 0;
  const tasks = [50, 10, 30, 20, 5, 40].map((ms, i) => async () => {
    active++;
    peak = Math.max(peak, active);
    await sleep(ms);
    active--;
    return i;
  });
  const t0 = Date.now();
  assert.deepEqual(await promisePool(tasks, 2), [0, 1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
  assert.ok(Date.now() - t0 < 155, "should overlap work");
  assert.deepEqual(await promisePool([], 3), []);
  await assert.rejects(promisePool([async () => 1, async () => { throw new Error("x"); }], 2), /x/);

  let inFlight = 0;
  let maxInFlight = 0;
  const server = http.createServer(async (req, res) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(20);
    inFlight--;
    if (req.url === "/bad") return res.writeHead(500).end();
    res.end(JSON.stringify({ path: req.url }));
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = await fetchAllLimited([`${base}/a`, `${base}/bad`, `${base}/c`, `${base}/d`, `${base}/e`], 2);
  server.close();
  assert.deepEqual(out.map((r) => r.ok), [true, false, true, true, true]);
  assert.equal(out[2].value.path, "/c");
  assert.ok(maxInFlight <= 2, `max in flight ${maxInFlight}`);
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
