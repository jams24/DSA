/** Flatten nested arrays up to `depth` levels (Infinity = fully), like Array.prototype.flat. */
function flatten(arr, depth = Infinity) {
  const out = [];
  // Iterative with an explicit stack, so very deep nesting can't overflow the call stack.
  const stack = [[arr, 0, depth]];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const [list, i, d] = top;
    if (i === list.length) {
      stack.pop();
      continue;
    }
    top[1]++;
    const item = list[i];
    if (Array.isArray(item) && d > 0) stack.push([item, 0, d - 1]);
    else out.push(item);
  }
  return out;
}

/** { a: { b: 1, c: [2] } } -> { "a.b": 1, "a.c.0": 2 } */
function flattenObject(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && Object.keys(value).length > 0) flattenObject(value, path, out);
    else out[path] = value;
  }
  return out;
}

/** The inverse: { "a.b": 1 } -> { a: { b: 1 } } */
function unflattenObject(flat) {
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node = out;
    keys.slice(0, -1).forEach((k) => (node = node[k] ??= {}));
    node[keys[keys.length - 1]] = value;
  }
  return out;
}

module.exports = { flatten, flattenObject, unflattenObject };
