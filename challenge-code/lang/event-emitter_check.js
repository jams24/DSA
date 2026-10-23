const assert = require("node:assert/strict");
const { EventEmitter } = require("./solution.cjs");

const e = new EventEmitter();
const log = [];
const a = (x) => log.push(`a${x}`);
const unsubB = e.on("msg", (x) => log.push(`b${x}`));
e.on("msg", a);
e.once("msg", (x) => log.push(`once${x}`));
assert.equal(e.emit("msg", 1), true);
assert.deepEqual(log, ["b1", "a1", "once1"]);
e.emit("msg", 2);
assert.deepEqual(log.slice(3), ["b2", "a2"]);
unsubB();
e.off("msg", a);
assert.equal(e.listenerCount("msg"), 0);
assert.equal(e.emit("msg", 3), false);

const self = new EventEmitter();
const order = [];
const first = () => {
  order.push("first");
  self.off("x", second); // removing a later listener mid-emit doesn't skip or crash
};
const second = () => order.push("second");
self.on("x", first);
self.on("x", second);
self.emit("x");
assert.deepEqual(order, ["first", "second"]);
self.emit("x");
assert.deepEqual(order, ["first", "second", "first"]);

const dup = new EventEmitter();
let n = 0;
const inc = () => n++;
dup.on("y", inc);
dup.on("y", inc);
dup.off("y", inc);
dup.emit("y");
assert.equal(n, 1);
console.log("ok");
