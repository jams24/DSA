// Data model for the LeetCode 150 step-through simulations. A tracer runs the real algorithm and
// records a Frame (a narrated snapshot made of panels) at every interesting step; the player renders them.

export type Tone = "cur" | "cmp" | "ok" | "bad" | "alt" | "pick" | "dim";
export type Cell = string | number | boolean | null;

export interface ArrayPanel {
  kind: "array";
  label?: string;
  items: Cell[];
  /** named pointers -> index (out-of-range indexes are not drawn) */
  ptrs?: Record<string, number>;
  tones?: Record<number, Tone>;
  /** inclusive window [l, r] drawn as an outline */
  win?: [number, number] | null;
  /** draw numbers as vertical bars (heights) */
  bars?: boolean;
  /** water level per index (bars mode) */
  water?: number[];
}

export interface VarsPanel {
  kind: "vars";
  vars: Record<string, Cell>;
  hi?: string[];
}

export interface MapPanel {
  kind: "map";
  label: string;
  /** [key, value]; an empty value renders a set member */
  entries: [string, string][];
  hi?: string[];
}

export interface StackPanel {
  kind: "stack";
  label: string;
  items: string[];
  hi?: number[];
  queue?: boolean;
}

export interface GridPanel {
  kind: "grid";
  label?: string;
  cells: Cell[][];
  /** keyed "r,c" */
  tones?: Record<string, Tone>;
  rows?: string[];
  cols?: string[];
}

export interface TreeNode {
  id: string;
  label: string;
  tone?: Tone;
  tag?: string;
  kids: (TreeNode | null)[];
}

export interface TreePanel {
  kind: "tree";
  label?: string;
  root: TreeNode | null;
  /** binary trees keep left/right positions (in-order layout) */
  binary?: boolean;
}

export interface ListNode {
  id: string;
  val: Cell;
  next: string | null;
  tone?: Tone;
  rand?: string | null;
}

export interface ListPanel {
  kind: "list";
  label?: string;
  nodes: ListNode[];
  ptrs?: Record<string, string | null>;
}

export interface GraphPanel {
  kind: "graph";
  label?: string;
  nodes: { id: string; label?: string; tone?: Tone; tag?: string }[];
  edges: { a: string; b: string; label?: string; tone?: Tone }[];
  directed?: boolean;
}

export interface LinePanel {
  kind: "line";
  label?: string;
  rows: { label?: string; items: { s: number; e: number; tone?: Tone; text?: string }[] }[];
  marks?: { x: number; tone?: Tone; text?: string }[];
}

export interface OutPanel {
  kind: "out";
  label: string;
  items: string[];
  hi?: number[];
}

export type Panel = ArrayPanel | VarsPanel | MapPanel | StackPanel | GridPanel | TreePanel | ListPanel | GraphPanel | LinePanel | OutPanel;

export type FrameTone = "info" | "good" | "bad" | "warn";

export interface Frame {
  note: string;
  tone?: FrameTone;
  panels: Panel[];
}

export interface Sim {
  /** parameter names, in call order */
  params: string[];
  /** example inputs: each case is [...args, expected answer] */
  cases: unknown[][];
  run: (t: Tracer, ...args: never[]) => unknown;
}

export class TraceLimit extends Error {}

export class Tracer {
  frames: Frame[] = [];
  constructor(readonly max = 400) {}

  step(note: string, panels: Panel[], tone?: FrameTone) {
    if (this.frames.length >= this.max) throw new TraceLimit();
    this.frames.push({ note, tone, panels: structuredClone(panels) });
  }
}
