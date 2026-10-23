"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store usable from several components at once. Data stays in this
 * browser (it is personal practice material, not game progress), and every storage access is
 * wrapped so private mode or blocked storage just means nothing is remembered.
 */
export function createLocalStore<T>(key: string, fallback: T, isValid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let raw: string | null | undefined;
  let value = fallback;

  function read(): T {
    let next: string | null = null;
    try {
      next = localStorage.getItem(key);
    } catch {
      /* storage blocked */
    }
    if (next !== raw) {
      raw = next;
      try {
        const parsed: unknown = next === null ? fallback : JSON.parse(next);
        value = isValid(parsed) ? parsed : fallback;
      } catch {
        value = fallback;
      }
    }
    return value;
  }

  function write(next: T) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // can't persist: keep it in memory for this page view
      raw = JSON.stringify(next);
      value = next;
    }
    listeners.forEach((l) => l());
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => e.key === key && cb();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    use: () => useSyncExternalStore(subscribe, read, () => fallback),
    get: read,
    set: (update: T | ((prev: T) => T)) => write(typeof update === "function" ? (update as (prev: T) => T)(read()) : update),
  };
}
