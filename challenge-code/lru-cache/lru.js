// A JS Map remembers insertion order, so deleting and re-inserting a key moves it to the end.
// The first key is then always the least recently used. Every operation is O(1).
class LRUCache {
  constructor(capacity, { ttlMs = Infinity, now = Date.now } = {}) {
    if (!(capacity > 0)) throw new RangeError("capacity must be positive");
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    if (e.expiresAt <= this.now()) return undefined; // expired: stays deleted
    this.map.set(key, e);
    return e.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + ttlMs });
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value);
    return this;
  }

  get size() {
    return this.map.size;
  }
}

module.exports = { LRUCache };
