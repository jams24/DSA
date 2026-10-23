const assert = require("node:assert/strict");
const { groupBy, topCustomers, countByStatus, perCategoryCustomer } = require("./solution.cjs");

const orders = [
  { id: "o1", customer: "ada", category: "books", amountCents: 3000, status: "PAID" },
  { id: "o2", customer: "bob", category: "games", amountCents: 6000, status: "PAID" },
  { id: "o3", customer: "ada", category: "games", amountCents: 4550, status: "PAID" },
  { id: "o4", customer: "cy", category: "books", amountCents: 50000, status: "REFUNDED" },
  { id: "o5", customer: "bob", category: "books", amountCents: 1000, status: "PENDING" },
];
assert.deepEqual(topCustomers(orders, 2), [["ada", 7550], ["bob", 6000]]);
assert.deepEqual(countByStatus(orders), { PAID: 3, REFUNDED: 1, PENDING: 1 });
assert.deepEqual(perCategoryCustomer(orders).books, { ada: 1, cy: 1, bob: 1 });
assert.deepEqual([...groupBy([1, 2, 3, 4], (n) => n % 2)].map(([k, v]) => [k, v]), [[1, [1, 3]], [0, [2, 4]]]);
console.log("ok");
