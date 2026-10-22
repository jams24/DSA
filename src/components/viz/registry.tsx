"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function Loading() {
  return <div className="shimmer h-72 rounded-xl border border-line bg-panel-2" />;
}

type Loader = () => Promise<{ default: ComponentType }>;
const lazy = (load: Loader) => dynamic(load, { ssr: false, loading: Loading });

interface Entry {
  title: string;
  blurb: string;
  C: ComponentType;
}

export const VISUALIZERS: Record<string, Entry> = {
  // Foundations
  bigo: { title: "Growth of functions", blurb: "Toggle curves and feel how fast each complexity class explodes.", C: lazy(() => import("./foundations/BigO")) },
  array: { title: "Dynamic array", blurb: "Watch shifting on insert/delete and doubling on resize.", C: lazy(() => import("./foundations/DynamicArray")) },
  hashtable: { title: "Hash table", blurb: "Hash keys into buckets, collide, probe and rehash.", C: lazy(() => import("./foundations/HashTable")) },
  linkedlist: { title: "Linked list", blurb: "Insert, delete and reverse by rewiring pointers.", C: lazy(() => import("./foundations/LinkedList")) },
  stackqueue: { title: "Stack & queue", blurb: "LIFO vs FIFO, a ring-buffer queue and the bracket matcher.", C: lazy(() => import("./foundations/StackQueue")) },
  recursion: { title: "Recursion tree & call stack", blurb: "See every call of fib(n), then prune it with memoization.", C: lazy(() => import("./foundations/Recursion")) },
};
