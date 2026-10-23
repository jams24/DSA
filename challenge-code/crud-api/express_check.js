const assert = require("node:assert/strict");
const { createApp } = require("./solution.cjs");

(async () => {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (method, path, body) =>
    fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  try {
    let r = await send("POST", "/books", { title: "Dune", author: "Frank Herbert", year: 1965 });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get("location"), "/books/1");
    assert.deepEqual((await r.json()).tags, []);
    assert.equal((await send("POST", "/books", { title: "", author: "x", year: 1 })).status, 422);
    assert.equal((await send("POST", "/books", { title: "x", author: "y", year: 1, isbn: 1 })).status, 422);
    assert.equal((await send("POST", "/books", "{not json")).status, 400);

    for (let i = 2; i <= 7; i++) await send("POST", "/books", { title: `Book ${i}`, author: i % 2 ? "Ann" : "Bob", year: 2000 + i });
    const seen = [];
    let cursor = null;
    do {
      const page = await (await fetch(`${base}/books?limit=3${cursor ? `&cursor=${cursor}` : ""}`)).json();
      seen.push(...page.data.map((b) => b.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual((await (await fetch(`${base}/books?author=ann`)).json()).data.map((b) => b.id), [3, 5, 7]);
    assert.equal((await fetch(`${base}/books?limit=0`)).status, 422);

    r = await send("PATCH", "/books/1", { year: 1966 });
    const patched = await r.json();
    assert.equal(patched.year, 1966);
    assert.equal(patched.title, "Dune");
    assert.equal((await send("PATCH", "/books/1", { year: -1 })).status, 422);
    assert.equal((await send("DELETE", "/books/1")).status, 204);
    assert.equal((await fetch(`${base}/books/1`)).status, 404);
    console.log("ok");
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
