const assert = require("node:assert/strict");
const http = require("node:http");
const { getJson, allItems, ApiError } = require("./solution.cjs");

const hits = {};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/slow") return setTimeout(() => res.end("{}"), 500);
  if (url.pathname === "/missing") return res.writeHead(404).end();
  const page = Number(url.searchParams.get("page"));
  hits[page] = (hits[page] ?? 0) + 1;
  if (page === 1 && hits[page] === 1) return res.writeHead(503).end();
  if (page === 2 && hits[page] === 1) return res.writeHead(429, { "retry-after": "2" }).end();
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ items: [page * 10], next_page: page < 3 ? page + 1 : null }));
});

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const slept = [];
  const sleep = async (ms) => void slept.push(ms);
  try {
    const items = [];
    for await (const item of allItems(base, { sleep })) items.push(item);
    assert.deepEqual(items, [10, 20, 30]);
    assert.deepEqual(hits, { 1: 2, 2: 2, 3: 1 });
    assert.ok(slept[0] <= 200 && slept[1] === 2000, String(slept));

    await assert.rejects(getJson(`${base}/missing`, { sleep }), ApiError);
    const before = slept.length;
    await assert.rejects(getJson(`${base}/slow`, { sleep, timeoutMs: 50, maxAttempts: 2 }), ApiError);
    assert.equal(slept.length, before + 1, "a timeout is retried");
    console.log("ok");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
