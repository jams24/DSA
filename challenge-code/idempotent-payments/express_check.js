const assert = require("node:assert/strict");
const { createApp } = require("./solution.cjs");

(async () => {
  let charges = 0;
  let failNext = false;
  const charge = async () => {
    await new Promise((r) => setTimeout(r, 50)); // slow processor, so concurrent requests overlap
    if (failNext) {
      failNext = false;
      throw new Error("processor down");
    }
    return { ref: `ch_${++charges}` };
  };
  const server = createApp({ charge }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const pay = (key, body) =>
    fetch(`${base}/payments`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await pay(null, { amount: 500, currency: "USD" })).status, 400);
    assert.equal((await pay("k0", { amount: -1, currency: "USD" })).status, 422);

    const first = await pay("k1", { amount: 500, currency: "USD" });
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    const retry = await pay("k1", { amount: 500, currency: "USD" });
    assert.equal(retry.status, 201);
    assert.equal(retry.headers.get("idempotent-replayed"), "true");
    assert.deepEqual(await retry.json(), firstBody);
    assert.equal(charges, 1, "a retry must not charge again");

    assert.equal((await pay("k1", { amount: 999, currency: "USD" })).status, 422);

    const [a, b] = await Promise.all([pay("k2", { amount: 100, currency: "EUR" }), pay("k2", { amount: 100, currency: "EUR" })]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal(charges, 2);

    failNext = true;
    assert.equal((await pay("k3", { amount: 100, currency: "EUR" })).status, 502);
    assert.equal((await pay("k3", { amount: 100, currency: "EUR" })).status, 201, "a failed attempt releases the key");
    console.log("ok");
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
