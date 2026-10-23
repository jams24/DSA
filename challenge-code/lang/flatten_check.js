const assert = require("node:assert/strict");
const { flatten, flattenObject, unflattenObject } = require("./solution.cjs");

assert.deepEqual(flatten([1, [2, [3, [4]], 5]]), [1, 2, 3, 4, 5]);
assert.deepEqual(flatten([1, [2, [3, [4]], 5]], 1), [1, 2, [3, [4]], 5]);
assert.deepEqual(flatten([[], [[]], 0]), [0]);
let deep = [1];
for (let i = 0; i < 100000; i++) deep = [deep];
assert.deepEqual(flatten(deep), [1], "no stack overflow");

const nested = { a: { b: 1, c: [2, { d: 3 }] }, e: null, f: {}, g: "x" };
assert.deepEqual(flattenObject(nested), { "a.b": 1, "a.c.0": 2, "a.c.1.d": 3, e: null, f: {}, g: "x" });
assert.deepEqual(unflattenObject({ "a.b": 1, "a.c": 2, d: 3 }), { a: { b: 1, c: 2 }, d: 3 });
console.log("ok");
