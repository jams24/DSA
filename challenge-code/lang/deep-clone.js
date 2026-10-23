/**
 * Deep copy that handles nested objects/arrays, Date, RegExp, Map, Set, and circular references.
 * (In modern runtimes structuredClone does this natively, but it throws on functions and
 * drops class prototypes; interviewers want to see you handle the cases yourself.)
 */
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value; // primitives and functions are shared
  if (seen.has(value)) return seen.get(value); // cycle or shared reference: reuse the copy

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy); // register before recursing, or a cycle would loop forever
    for (const [k, v] of value) copy.set(deepClone(k, seen), deepClone(v, seen));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const v of value) copy.add(deepClone(v, seen));
    return copy;
  }

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  // Reflect.ownKeys includes symbol keys; we copy own enumerable properties only
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc?.enumerable) copy[key] = deepClone(value[key], seen);
  }
  return copy;
}

module.exports = { deepClone };
