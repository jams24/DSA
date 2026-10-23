"use client";

import { useSyncExternalStore } from "react";

// "Practiced" marks live in this browser only. Challenges award no XP, so there is nothing
// for the server to verify or store.
const KEY = "dsa-quest:challenges-practiced";
const listeners = new Set<() => void>();
let cache: string | null = null;
let parsed: string[] = [];

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache) {
    cache = raw;
    try {
      const v: unknown = JSON.parse(raw ?? "[]");
      parsed = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      parsed = [];
    }
  }
  return parsed;
}

const EMPTY: string[] = [];

export function usePracticed(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => EMPTY,
  );
}

export function togglePracticed(slug: string) {
  const cur = read();
  const next = cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the toggle just won't persist */
  }
  listeners.forEach((l) => l());
}
