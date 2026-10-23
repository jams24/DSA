const assert = require("node:assert/strict");
const { debounce } = require("./solution.cjs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const calls = [];
  const d = debounce((x) => calls.push(x), 40);
  d(1);
  d(2);
  d(3);
  await sleep(20);
  d(4);
  assert.deepEqual(calls, []);
  await sleep(70);
  assert.deepEqual(calls, [4], "only the last call of the burst runs");

  const lead = [];
  const l = debounce((x) => lead.push(x), 40, { leading: true });
  l("a");
  l("b");
  l("c");
  assert.deepEqual(lead, ["a"]);
  await sleep(70);
  assert.deepEqual(lead, ["a", "c"], "leading + trailing");
  l("d");
  await sleep(70);
  assert.deepEqual(lead, ["a", "c", "d"], "a single call is not repeated on the trailing edge");

  const obj = { n: 0, inc: debounce(function () { this.n++; }, 10) };
  obj.inc();
  await sleep(30);
  assert.equal(obj.n, 1, "keeps this");

  const c = [];
  const cd = debounce((x) => c.push(x), 30);
  cd(1);
  cd.cancel();
  cd(2);
  cd.flush();
  assert.deepEqual(c, [2]);
  await sleep(50);
  assert.deepEqual(c, [2], "flush does not run again later");
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
