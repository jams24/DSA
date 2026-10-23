const assert = require("node:assert/strict");
const { throttle } = require("./solution.cjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const calls = [];
  const t = throttle((x) => calls.push(x), 50);
  t(1); // runs now
  t(2);
  t(3); // becomes the trailing call
  assert.deepEqual(calls, [1]);
  await sleep(80);
  assert.deepEqual(calls, [1, 3]);
  await sleep(80);
  t(4); // cooldown over: runs now
  assert.deepEqual(calls, [1, 3, 4]);

  // fired every 10ms for 200ms, it should run about 200/50 + 1 times, not 20
  const n = [];
  const tt = throttle(() => n.push(Date.now()), 50);
  const iv = setInterval(tt, 10);
  await sleep(200);
  clearInterval(iv);
  await sleep(80);
  assert.ok(n.length >= 4 && n.length <= 6, `ran ${n.length} times`);
  for (let i = 1; i < n.length; i++) assert.ok(n[i] - n[i - 1] >= 45, "spacing");

  const c = [];
  const ct = throttle((x) => c.push(x), 30);
  ct(1);
  ct(2);
  ct.cancel();
  await sleep(50);
  assert.deepEqual(c, [1]);
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
