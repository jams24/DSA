const assert = require("node:assert/strict");
const { deepClone } = require("./solution.cjs");

const sym = Symbol("s");
class Point {
  constructor(x) {
    this.x = x;
  }
  norm() {
    return Math.abs(this.x);
  }
}
const src = { n: 1, s: "x", nested: { arr: [1, { y: 2 }] }, d: new Date(0), r: /a+/gi, m: new Map([["k", { v: 1 }]]), set: new Set([1, 2]), p: new Point(-3), [sym]: "sym", f: () => 1 };
src.self = src;
src.nested.back = src.nested;

const c = deepClone(src);
assert.notEqual(c, src);
assert.notEqual(c.nested, src.nested);
assert.notEqual(c.nested.arr[1], src.nested.arr[1]);
assert.deepEqual(c.nested.arr, [1, { y: 2 }]);
assert.ok(c.d instanceof Date && c.d.getTime() === 0 && c.d !== src.d);
assert.ok(c.r instanceof RegExp && c.r.flags === "gi" && c.r !== src.r);
assert.notEqual(c.m.get("k"), src.m.get("k"));
assert.deepEqual(c.m.get("k"), { v: 1 });
assert.ok(c.set.has(2) && c.set !== src.set);
assert.equal(c.p.norm(), 3, "prototype kept");
assert.equal(c[sym], "sym");
assert.equal(c.f, src.f);
assert.equal(c.self, c, "cycle points at the copy");
assert.equal(c.nested.back, c.nested);
assert.equal(deepClone(5), 5);
assert.equal(deepClone(null), null);
console.log("ok");
