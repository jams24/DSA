const assert = require("node:assert/strict");
const { createApp } = require("./solution.cjs");

(async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${base}/shorten`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    let r = await post({ url: "https://example.com/a" });
    assert.equal(r.status, 201);
    const { code, shortUrl } = await r.json();
    assert.equal(code.length, 7);
    assert.ok(shortUrl.endsWith(code));

    r = await post({ url: "https://example.com/a" });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).code, code);

    r = await fetch(`${base}/${code}`, { redirect: "manual" });
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("location"), "https://example.com/a");
    assert.equal((await (await fetch(`${base}/stats/${code}`)).json()).hits, 1);
    assert.equal((await fetch(`${base}/missing`)).status, 404);

    assert.equal((await post({ url: "ftp://example.com" })).status, 400);
    assert.equal((await post({ url: "https://example.com/b", alias: "promo" })).status, 201);
    assert.equal((await post({ url: "https://example.com/c", alias: "promo" })).status, 409);

    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await post({ url: `https://example.com/${i}` })).status);
    assert.ok(statuses.includes(429), String(statuses));
    console.log("ok");
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
