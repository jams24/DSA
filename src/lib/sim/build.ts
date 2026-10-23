// Small builders so each problem's tracer reads like the algorithm it animates.
import type { ArrayPanel, Cell, GridPanel, LinePanel, ListPanel, MapPanel, OutPanel, Sim, StackPanel, Tone, Tracer, TreeNode, TreePanel, VarsPanel } from "./types";

/** Declare a simulation. Each case is [...args, expected answer]; the validator checks run() against it. */
export function sim<A extends unknown[]>(params: string[], cases: NoInfer<[...A, unknown]>[], run: (t: Tracer, ...args: A) => unknown): Sim {
  return { params, cases, run: run as unknown as Sim["run"] };
}

export function need(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export function fmt(x: unknown): string {
  if (x === null || x === undefined) return "null";
  if (typeof x === "number") return Number.isInteger(x) || !Number.isFinite(x) ? String(x) : String(Number(x.toFixed(4)));
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return `[${x.map((v) => (typeof v === "string" ? `"${v}"` : fmt(v))).join(",")}]`;
  return String(x);
}

export const arr = (items: Cell[], o: Omit<ArrayPanel, "kind" | "items"> = {}): ArrayPanel => ({ kind: "array", items, ...o });
export const chars = (s: string, o: Omit<ArrayPanel, "kind" | "items"> = {}): ArrayPanel => arr([...s], o);
export const vars = (v: Record<string, unknown>, hi?: string[]): VarsPanel => ({
  kind: "vars",
  vars: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "number" || typeof x === "boolean" || x === null ? x : fmt(x)])),
  hi,
});
export const grid = (cells: Cell[][], o: Omit<GridPanel, "kind" | "cells"> = {}): GridPanel => ({ kind: "grid", cells, ...o });
export const stack = (label: string, items: unknown[], hi?: number[]): StackPanel => ({ kind: "stack", label, items: items.map(fmt), hi });
export const queue = (label: string, items: unknown[], hi?: number[]): StackPanel => ({ kind: "stack", label, items: items.map(fmt), hi, queue: true });
export const out = (label: string, items: unknown[], hi?: number[]): OutPanel => ({ kind: "out", label, items: items.map(fmt), hi });
export const line = (rows: LinePanel["rows"], o: Omit<LinePanel, "kind" | "rows"> = {}): LinePanel => ({ kind: "line", rows, ...o });

export function map(label: string, m: Map<unknown, unknown> | Record<string, unknown>, hi: unknown[] = []): MapPanel {
  const entries = m instanceof Map ? [...m.entries()] : Object.entries(m);
  return { kind: "map", label, entries: entries.map(([k, v]) => [fmt(k), fmt(v)]), hi: hi.map(fmt) };
}

export function set(label: string, s: Iterable<unknown>, hi: unknown[] = []): MapPanel {
  return { kind: "map", label, entries: [...s].map((k) => [fmt(k), ""]), hi: hi.map(fmt) };
}

/** tones for a set of indexes, later entries win */
export function tones(...groups: [Iterable<number>, Tone][]): Record<number, Tone> {
  const t: Record<number, Tone> = {};
  for (const [idx, tone] of groups) for (const i of idx) t[i] = tone;
  return t;
}

export const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

export function gridTones(...groups: [Iterable<[number, number]>, Tone][]): Record<string, Tone> {
  const t: Record<string, Tone> = {};
  for (const [cells, tone] of groups) for (const [r, c] of cells) t[`${r},${c}`] = tone;
  return t;
}

// ------------------------------------------------------------------ binary trees (LeetCode level order)

export interface BNode {
  id: string;
  val: number;
  left: BNode | null;
  right: BNode | null;
  next?: BNode | null;
}

let uid = 0;
export function bnode(val: number, left: BNode | null = null, right: BNode | null = null): BNode {
  return { id: `b${uid++}`, val, left, right };
}

export function buildTree(level: (number | null)[]): BNode | null {
  need(Array.isArray(level), "tree must be a level-order array like [3,9,20,null,null,15,7]");
  if (!level.length || level[0] === null) return null;
  let n = 0;
  const mk = (v: number): BNode => {
    need(typeof v === "number", "tree values must be numbers or null");
    return { id: `t${n++}`, val: v, left: null, right: null };
  };
  const root = mk(level[0]);
  const q = [root];
  let i = 1;
  while (q.length && i < level.length) {
    const node = q.shift()!;
    const l = level[i++];
    if (l !== null && l !== undefined) q.push((node.left = mk(l)));
    const r = level[i++];
    if (i <= level.length && r !== null && r !== undefined) q.push((node.right = mk(r)));
  }
  return root;
}

export function treeToLevel(root: BNode | null): (number | null)[] {
  const res: (number | null)[] = [];
  const q: (BNode | null)[] = [root];
  while (q.length) {
    const n = q.shift()!;
    res.push(n ? n.val : null);
    if (n) q.push(n.left, n.right);
  }
  while (res.length && res[res.length - 1] === null) res.pop();
  return res;
}

export function treePanel(root: BNode | null, o: { tones?: Record<string, Tone>; tags?: Record<string, string>; label?: string } = {}): TreePanel {
  const conv = (n: BNode | null, depth: number): TreeNode | null => {
    if (!n || depth > 12) return null;
    const kids = [conv(n.left, depth + 1), conv(n.right, depth + 1)];
    return { id: n.id, label: String(n.val), tone: o.tones?.[n.id], tag: o.tags?.[n.id], kids: kids[0] || kids[1] ? kids : [] };
  };
  return { kind: "tree", label: o.label, root: conv(root, 0), binary: true };
}

export function nodesOf(root: BNode | null): BNode[] {
  const res: BNode[] = [];
  const q = root ? [root] : [];
  while (q.length) {
    const n = q.shift()!;
    res.push(n);
    if (n.left) q.push(n.left);
    if (n.right) q.push(n.right);
  }
  return res;
}

// ------------------------------------------------------------------ n-ary trees (tries, recursion trees)

export class RecTree {
  root: TreeNode;
  private n = 0;
  constructor(label: string) {
    this.root = { id: "r0", label, kids: [] };
  }
  add(parent: TreeNode, label: string, tone?: Tone): TreeNode {
    const node: TreeNode = { id: `r${++this.n}`, label, tone, kids: [] };
    parent.kids.push(node);
    return node;
  }
  panel(label?: string): TreePanel {
    return { kind: "tree", label, root: this.root };
  }
}

// ------------------------------------------------------------------ linked lists

export interface LNode {
  id: string;
  val: number;
  next: LNode | null;
  random?: LNode | null;
}

let lid = 0;
export function lnode(val: number, next: LNode | null = null): LNode {
  return { id: `l${lid++}`, val, next };
}

export function buildList(vals: number[]): LNode[] {
  need(Array.isArray(vals) && vals.every((v) => typeof v === "number"), "a linked list is an array of numbers like [1,2,3]");
  const nodes = vals.map((v) => lnode(v));
  nodes.forEach((n, i) => (n.next = nodes[i + 1] ?? null));
  return nodes;
}

export function walk(head: LNode | null, cap = 60): LNode[] {
  const res: LNode[] = [];
  const seen = new Set<LNode>();
  for (let n = head; n && !seen.has(n) && res.length < cap; n = n.next) {
    seen.add(n);
    res.push(n);
  }
  return res;
}

export const vals = (head: LNode | null) => walk(head, 10_000).map((n) => n.val);

export function listPanel(nodes: LNode[], o: { ptrs?: Record<string, LNode | null | undefined>; tones?: Record<string, Tone>; label?: string; random?: boolean } = {}): ListPanel {
  const ids = new Set(nodes.map((n) => n.id));
  return {
    kind: "list",
    label: o.label,
    nodes: nodes.map((n) => ({
      id: n.id,
      val: n.val,
      next: n.next && ids.has(n.next.id) ? n.next.id : null,
      tone: o.tones?.[n.id],
      rand: o.random ? (n.random && ids.has(n.random.id) ? n.random.id : null) : undefined,
    })),
    ptrs: o.ptrs ? Object.fromEntries(Object.entries(o.ptrs).map(([k, v]) => [k, v ? v.id : null])) : undefined,
  };
}
