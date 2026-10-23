const assert = require("node:assert/strict");
const { loadDashboard } = require("./solution.cjs");
const after = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

(async () => {
  const t0 = Date.now();
  const d = await loadDashboard({ profile: () => after(50, "ada"), orders: () => after(50, ["o1"]), recommendations: () => after(50, "for-you") });
  assert.deepEqual(d, { profile: "ada", orders: ["o1"], recommendations: "for-you" });
  assert.ok(Date.now() - t0 < 130, "parallel");

  const degraded = await loadDashboard({ profile: async () => "ada", orders: async () => { throw new Error("down"); }, recommendations: () => after(1000, "late") });
  assert.deepEqual(degraded, { profile: "ada", orders: [], recommendations: "popular-items" });

  await assert.rejects(loadDashboard({ profile: async () => { throw new Error("auth down"); }, orders: async () => [], recommendations: async () => "r" }), /auth down/);
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
