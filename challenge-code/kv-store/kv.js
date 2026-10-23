// Nested transactions via undo logs: each BEGIN pushes a Map of key -> value-before-first-write
// (undefined = the key didn't exist). ROLLBACK replays the top log; COMMIT drops every log.
class TransactionalKV {
  #data = new Map();
  #counts = new Map(); // value -> how many keys hold it, so COUNT is O(1)
  #undo = [];

  #write(key, value, log = true) {
    const top = this.#undo[this.#undo.length - 1];
    if (log && top && !top.has(key)) top.set(key, this.#data.get(key));
    const old = this.#data.get(key);
    if (old !== undefined) this.#counts.set(old, this.#counts.get(old) - 1);
    if (value === undefined) this.#data.delete(key);
    else {
      this.#data.set(key, value);
      this.#counts.set(value, (this.#counts.get(value) ?? 0) + 1);
    }
  }

  set(key, value) {
    this.#write(key, value);
  }
  get(key) {
    return this.#data.get(key);
  }
  delete(key) {
    if (!this.#data.has(key)) return false;
    this.#write(key, undefined);
    return true;
  }
  count(value) {
    return this.#counts.get(value) ?? 0;
  }
  begin() {
    this.#undo.push(new Map());
  }
  rollback() {
    const log = this.#undo.pop();
    if (!log) return false;
    for (const [key, value] of log) this.#write(key, value, false);
    return true;
  }
  commit() {
    if (!this.#undo.length) return false;
    this.#undo = [];
    return true;
  }
}

module.exports = { TransactionalKV };
