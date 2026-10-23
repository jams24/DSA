// Amounts are integer cents: floating-point dollars would drift (0.1 + 0.2 !== 0.3).

/** Generic groupBy. (Object.groupBy / Map.groupBy exist in Node 21+, but interviewers ask you to write it.) */
function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function topCustomers(orders, n) {
  const revenue = new Map();
  for (const o of orders) if (o.status === "PAID") revenue.set(o.customer, (revenue.get(o.customer) ?? 0) + o.amountCents);
  return [...revenue].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).slice(0, n);
}

function countByStatus(orders) {
  return orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {});
}

function perCategoryCustomer(orders) {
  const out = {};
  for (const [category, list] of groupBy(orders, (o) => o.category)) {
    out[category] = Object.fromEntries([...groupBy(list, (o) => o.customer)].map(([c, l]) => [c, l.length]));
  }
  return out;
}

module.exports = { groupBy, topCustomers, countByStatus, perCategoryCustomer };
