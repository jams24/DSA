const assert = require("node:assert/strict");
const { LRUCache } = require("./solution.cjs");

let t = 0;
const c = new LRUCache(2);
c.set("a", 1).set("b", 2);
assert.equal(c.get("a"), 1);
c.set("c", 3);
assert.equal(c.get("b"), undefined);
c.set("a", 10).set("d", 4);
assert.equal(c.get("c"), undefined);
assert.equal(c.get("a"), 10);
assert.equal(c.size, 2);

const tc = new LRUCache(5, { ttlMs: 1000, now: () => t });
tc.set("x", 1).set("y", 2, 5000);
t = 999;
assert.equal(tc.get("x"), 1);
t = 1000;
assert.equal(tc.get("x"), undefined);
assert.equal(tc.get("y"), 2);
assert.equal(tc.size, 1);
assert.throws(() => new LRUCache(0), RangeError);
console.log("ok");
