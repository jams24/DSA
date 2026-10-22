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
  // Trees & graphs
  traversal: { title: "Tree traversals", blurb: "Pre, in, post and level order — with the stack or queue that drives each.", C: lazy(() => import("./trees/Traversal")) },
  bst: { title: "Binary search tree", blurb: "Insert, search and all three delete cases. Then break it with sorted input.", C: lazy(() => import("./trees/BST")) },
  heap: { title: "Binary heap", blurb: "Sift up, sift down, O(n) heapify and heap sort on the backing array.", C: lazy(() => import("./trees/Heap")) },
  trie: { title: "Trie (prefix tree)", blurb: "Insert words, search, and autocomplete a prefix.", C: lazy(() => import("./trees/Trie")) },
  grid: { title: "BFS vs DFS vs A* on a grid", blurb: "Draw walls and watch each search explore. Then count islands.", C: lazy(() => import("./trees/GraphGrid")) },
  dijkstra: { title: "Dijkstra's algorithm", blurb: "Min-heap, relaxation and the shortest-path tree, step by step.", C: lazy(() => import("./trees/Dijkstra")) },
  topo: { title: "Topological sort (Kahn's algorithm)", blurb: "Order courses by prerequisites — and detect a cycle.", C: lazy(() => import("./trees/Topo")) },
  unionfind: { title: "Union-Find", blurb: "Union by rank and path compression on a live forest.", C: lazy(() => import("./trees/UnionFind")) },
  // Algorithms
  sorting: { title: "Sorting algorithms", blurb: "Step through six sorts, or race them on the same input.", C: lazy(() => import("./algorithms/Sorting")) },
  binarysearch: { title: "Binary search", blurb: "Exact match, lower bound, and binary search on the answer.", C: lazy(() => import("./algorithms/BinarySearch")) },
  dp: { title: "Dynamic programming tables", blurb: "Watch coin change, LCS and knapsack tables fill cell by cell.", C: lazy(() => import("./algorithms/DP")) },
  nqueens: { title: "Backtracking: N-Queens", blurb: "Place, prune, recurse, undo — the backtracking loop made visible.", C: lazy(() => import("./algorithms/NQueens")) },
  greedy: { title: "Greedy interval scheduling", blurb: "Three greedy rules, one correct. See which one wins.", C: lazy(() => import("./algorithms/Greedy")) },
  bits: { title: "Bit manipulation playground", blurb: "Flip bits, combine with AND/OR/XOR and try the classic tricks.", C: lazy(() => import("./algorithms/Bits")) },
  // Patterns
  twopointers: { title: "Two pointers", blurb: "Pair sums, container with most water and in-place dedupe.", C: lazy(() => import("./patterns/TwoPointers")) },
  slidingwindow: { title: "Sliding window", blurb: "Variable and fixed windows with a live hash map of counts.", C: lazy(() => import("./patterns/SlidingWindow")) },
  fastslow: { title: "Fast & slow pointers", blurb: "Floyd's tortoise and hare: detect a cycle, then find where it starts.", C: lazy(() => import("./patterns/FastSlow")) },
  prefixsum: { title: "Prefix sums", blurb: "O(1) range queries and counting subarrays with a hash map.", C: lazy(() => import("./patterns/PrefixSum")) },
  monostack: { title: "Monotonic stack", blurb: "Daily temperatures: every index pushed and popped once.", C: lazy(() => import("./patterns/MonoStack")) },
  intervals: { title: "Merge intervals", blurb: "Sort by start, then sweep and merge.", C: lazy(() => import("./patterns/Intervals")) },
};
