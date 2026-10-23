// Step-through simulations for the LeetCode 150 problems, one module per category so each
// problem page only downloads the tracers for its own category.
import type { Sim } from "@/lib/sim/types";

type SimModule = { SIMS: Record<string, Sim> };

export const SIM_LOADERS: Record<string, () => Promise<SimModule>> = {
  "Array / String": () => import("./array-string"),
  "Two Pointers": () => import("./two-pointers"),
  "Sliding Window": () => import("./sliding-window"),
  Matrix: () => import("./matrix"),
  Hashmap: () => import("./hashmap"),
  Intervals: () => import("./intervals"),
  Stack: () => import("./stack"),
  "Linked List": () => import("./linked-list"),
  "Binary Tree General": () => import("./tree-general"),
  "Binary Tree BFS": () => import("./tree-bfs"),
  "Binary Search Tree": () => import("./bst"),
  "Graph General": () => import("./graph"),
  "Graph BFS": () => import("./graph-bfs"),
  Trie: () => import("./trie"),
  Backtracking: () => import("./backtracking"),
  "Divide & Conquer": () => import("./divide-conquer"),
  "Kadane's Algorithm": () => import("./kadane"),
  "Binary Search": () => import("./binary-search"),
  Heap: () => import("./heap"),
  "Bit Manipulation": () => import("./bits"),
  Math: () => import("./math"),
  "1D DP": () => import("./dp-1d"),
  "Multidimensional DP": () => import("./dp-multi"),
};
