const assert = require("node:assert/strict");
const { promiseAll, promiseAllSettled, promiseRace, promiseAny } = require("./solution.cjs");
const delay = (ms, v, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms));

(async () => {
  assert.deepEqual(await promiseAll([delay(30, "a"), "b", delay(10, "c"), { then: (r) => r("d") }]), ["a", "b", "c", "d"]);
  assert.deepEqual(await promiseAll([]), []);
  await assert.rejects(promiseAll([delay(30, 1), delay(10, "boom", true)]), (e) => e === "boom");
  assert.deepEqual(await promiseAll(new Set([1, 2])), [1, 2]);

  assert.deepEqual(await promiseAllSettled([delay(10, 1), delay(5, "x", true)]), [
    { status: "fulfilled", value: 1 },
    { status: "rejected", reason: "x" },
  ]);
  assert.equal(await promiseRace([delay(30, "slow"), delay(5, "fast")]), "fast");
  assert.equal(await promiseAny([delay(5, "e1", true), delay(20, "ok"), delay(1, "e2", true)]), "ok");
  await assert.rejects(promiseAny([delay(5, "e1", true), Promise.reject("e2")]), (e) => e instanceof AggregateError && e.errors.join() === "e1,e2");
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
