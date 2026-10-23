class EventEmitter {
  #listeners = new Map(); // event -> array of { fn, once }

  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, []);
    this.#listeners.get(event).push({ fn, once: false });
    return () => this.off(event, fn); // returning an unsubscribe function is handy in React effects
  }

  once(event, fn) {
    this.on(event, fn);
    this.#listeners.get(event).at(-1).once = true;
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const list = this.#listeners.get(event);
    if (!list) return;
    const i = list.findIndex((l) => l.fn === fn);
    if (i >= 0) list.splice(i, 1); // remove only one registration, like Node's EventEmitter
    if (list.length === 0) this.#listeners.delete(event);
  }

  emit(event, ...args) {
    const list = this.#listeners.get(event);
    if (!list) return false;
    // Iterate over a copy: a listener may call off() or on() while we're looping.
    for (const l of [...list]) {
      if (l.once) this.off(event, l.fn);
      l.fn.apply(this, args);
    }
    return true;
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.length ?? 0;
  }
}

module.exports = { EventEmitter };
