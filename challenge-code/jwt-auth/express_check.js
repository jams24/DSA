const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { createApp } = require("./solution.cjs");

(async () => {
  const secret = crypto.randomBytes(32).toString("hex");
  assert.throws(() => createApp({ secret: "short" }));
  const server = createApp({ secret }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const me = (token) => fetch(`${base}/me`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  try {
    assert.equal((await post("/register", { email: "ada@example.com", password: "short" })).status, 422);
    const reg = await post("/register", { email: "Ada@example.com", password: "correct horse" });
    assert.equal(reg.status, 201);
    const { id } = await reg.json();
    assert.equal((await post("/register", { email: "ada@example.com", password: "another one" })).status, 409);

    const bad = await post("/login", { email: "ada@example.com", password: "wrong password" });
    const unknown = await post("/login", { email: "nobody@example.com", password: "whatever1" });
    assert.equal(bad.status, 401);
    assert.deepEqual(await bad.json(), await unknown.json());

    const login = await post("/login", { email: "ada@example.com", password: "correct horse" });
    const { accessToken } = await login.json();
    const r = await me(accessToken);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { id, email: "ada@example.com" });

    assert.equal((await me()).status, 401);
    assert.equal((await me(jwt.sign({ sub: id }, "a-different-secret-that-is-long-enough!!"))).status, 401);
    assert.equal((await me(jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 10 }, secret))).status, 401);
    const unsigned = jwt.sign({ sub: id }, null, { algorithm: "none" });
    assert.equal((await me(unsigned)).status, 401);
    console.log("ok");
  } finally {
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
