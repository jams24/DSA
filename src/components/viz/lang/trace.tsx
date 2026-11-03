"use client";

// A step-through "debugger view" shared by the language visualizers: source code with the current
// line highlighted, plus the call stack and heap after that line ran. Scenarios are written with a
// small builder (Tracer) that mutates state and snapshots it after every line.

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

export type Tone = "info" | "good" | "bad" | "warn";
export type ObjState = "live" | "new" | "hot" | "garbage" | "freed" | "leak";

export interface TVar {
  name: string;
  value?: string;
  /** id of the heap object this variable points at */
  ref?: string;
  hot?: boolean;
  /** dangling: points at memory that is gone */
  bad?: boolean;
}

export interface TFrame {
  fn: string;
  vars: TVar[];
}

export interface TRow {
  k: string;
  v?: string;
  ref?: string;
  hot?: boolean;
}

export interface TObj {
  id: string;
  title: string;
  /** small caption, e.g. an address or "string pool" */
  sub?: string;
  rows?: TRow[];
  cells?: (string | number | null)[];
  state: ObjState;
}

export interface TStep {
  lines: number[];
  stack: TFrame[];
  heap: TObj[];
  note: string;
  tone: Tone;
  out: string[];
}

export interface TScenario {
  label: string;
  code: string;
  steps: TStep[];
  stackTitle?: string;
  heapTitle?: string;
}

export class Tracer {
  stack: TFrame[] = [];
  heap: TObj[] = [];
  out: string[] = [];
  steps: TStep[] = [];

  frame(fn: string, vars: TVar[] = []) {
    this.stack.push({ fn, vars });
    return this.stack[this.stack.length - 1];
  }
  pop() {
    this.stack.pop();
  }
  top() {
    return this.stack[this.stack.length - 1];
  }
  v(name: string, frame = this.top()): TVar {
    const found = frame.vars.find((x) => x.name === name);
    if (found) return found;
    const nv: TVar = { name };
    frame.vars.push(nv);
    return nv;
  }
  /** set a variable to a plain value */
  set(name: string, value: string, frame = this.top()) {
    const x = this.v(name, frame);
    x.value = value;
    x.ref = undefined;
    x.bad = false;
    x.hot = true;
  }
  /** point a variable at a heap object */
  point(name: string, ref: string | undefined, frame = this.top(), value?: string) {
    const x = this.v(name, frame);
    x.ref = ref;
    x.value = value;
    x.bad = false;
    x.hot = true;
  }
  obj(o: Omit<TObj, "state"> & { state?: ObjState }) {
    const existing = this.heap.findIndex((h) => h.id === o.id);
    const full: TObj = { state: "new", ...o };
    if (existing >= 0) this.heap[existing] = full;
    else this.heap.push(full);
    return full;
  }
  get(id: string) {
    return this.heap.find((h) => h.id === id)!;
  }
  mark(id: string, state: ObjState) {
    this.get(id).state = state;
  }
  remove(id: string) {
    this.heap = this.heap.filter((h) => h.id !== id);
  }
  print(s: string) {
    this.out.push(s);
  }
  step(lines: number | number[], note: string, tone: Tone = "info") {
    this.steps.push({
      lines: Array.isArray(lines) ? lines : [lines],
      stack: structuredClone(this.stack),
      heap: structuredClone(this.heap),
      note,
      tone,
      out: [...this.out],
    });
    for (const f of this.stack) for (const x of f.vars) x.hot = false;
    for (const h of this.heap) {
      if (h.state === "new" || h.state === "hot") h.state = "live";
      for (const r of h.rows ?? []) r.hot = false;
    }
  }
}

export function scenario(label: string, code: string, build: (t: Tracer) => void, titles?: { stack?: string; heap?: string }): TScenario {
  const t = new Tracer();
  build(t);
  return { label, code, steps: t.steps, stackTitle: titles?.stack, heapTitle: titles?.heap };
}

const PALETTE = [C.active, C.swap, C.pivot, C.compare, C.done, C.orange, C.sky, C.lime];

const STATE_BADGE: Record<ObjState, { label: string; color: string } | null> = {
  live: null,
  new: { label: "new", color: C.done },
  hot: { label: "changed", color: C.compare },
  garbage: { label: "unreachable → GC", color: C.faint },
  freed: { label: "freed", color: C.faint },
  leak: { label: "leaked!", color: C.bad },
};

export function TraceViewer({ scenarios, baseMs = 1500 }: { scenarios: TScenario[]; baseMs?: number }) {
  const [idx, setIdx] = useState("0");
  const sc = scenarios[Number(idx)];
  const steps = sc.steps;
  const s = useStepper(steps, baseMs);
  const f = s.frame;

  const colorOf = useMemo(() => {
    const ids: string[] = [];
    for (const st of steps) for (const h of st.heap) if (!ids.includes(h.id)) ids.push(h.id);
    return (id: string) => PALETTE[Math.max(0, ids.indexOf(id)) % PALETTE.length];
  }, [steps]);
  const titleOf = (id: string) => f.heap.find((h) => h.id === id)?.title ?? id;
  const lines = sc.code.split("\n");

  return (
    <div className="space-y-4">
      {scenarios.length > 1 && <Segmented value={idx} onChange={setIdx} options={scenarios.map((x, i) => ({ value: String(i), label: x.label }))} />}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-[#f8fafc]">
          <div className="border-b border-line px-3 py-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Code</div>
          <pre className="overflow-x-auto py-2 font-mono text-[12px] leading-[1.7]">
            {lines.map((ln, i) => {
              const on = f.lines.includes(i + 1);
              return (
                <div key={i} className={clsx("flex pr-3", on && "bg-amber/15")} style={on ? { boxShadow: `inset 3px 0 0 ${C.compare}` } : undefined}>
                  <span className="w-8 shrink-0 pr-2 text-right text-faint select-none">{i + 1}</span>
                  <span className={clsx("whitespace-pre", on ? "text-ink" : "text-[#475569]")}>{ln || " "}</span>
                </div>
              );
            })}
          </pre>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-[10px] font-semibold tracking-wider text-faint uppercase">{sc.stackTitle ?? "Stack (top frame first)"}</div>
            {f.stack.length === 0 && <div className="text-xs text-faint italic">empty</div>}
            <div className="space-y-2">
              {[...f.stack].reverse().map((fr, k) => (
                <div key={`${fr.fn}-${k}`} className={clsx("rounded-lg border", k === 0 ? "border-cyan/50" : "border-line opacity-70")}>
                  <div className={clsx("px-2 py-1 font-mono text-[11px] font-semibold", k === 0 ? "bg-cyan/10 text-cyan" : "bg-panel-2 text-dim")}>{fr.fn}</div>
                  <div className="divide-y divide-line">
                    {fr.vars.length === 0 && <div className="px-2 py-1 text-[11px] text-faint italic">no locals yet</div>}
                    {fr.vars.map((x) => (
                      <div key={x.name} className={clsx("flex items-center justify-between gap-2 px-2 py-1 font-mono text-[11px]", x.hot && "bg-amber/10")}>
                        <span className="text-ink">{x.name}</span>
                        <VarValue x={x} color={x.ref ? colorOf(x.ref) : undefined} title={x.ref ? titleOf(x.ref) : undefined} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-[10px] font-semibold tracking-wider text-faint uppercase">{sc.heapTitle ?? "Heap"}</div>
            {f.heap.length === 0 && <div className="text-xs text-faint italic">nothing allocated</div>}
            <div className="grid gap-2 sm:grid-cols-2">
              {f.heap.map((h) => {
                const col = colorOf(h.id);
                const dead = h.state === "garbage" || h.state === "freed";
                const badge = STATE_BADGE[h.state];
                return (
                  <div
                    key={h.id}
                    className={clsx("min-w-0 rounded-lg border-2 transition", dead && "opacity-50", h.state === "freed" && "border-dashed")}
                    style={{ borderColor: h.state === "leak" ? C.bad : dead ? C.base : col, background: dead ? "#f8fafc" : `${col}0d` }}
                  >
                    <div className="flex items-center justify-between gap-1 px-2 pt-1">
                      <span className={clsx("truncate font-mono text-[11px] font-bold", h.state === "freed" && "line-through")} style={{ color: dead ? C.muted : col }}>
                        {h.title}
                      </span>
                      {badge && (
                        <span className="shrink-0 rounded px-1 text-[9px] font-semibold uppercase" style={{ color: badge.color, background: `${badge.color}1a` }}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {h.sub && <div className="px-2 font-mono text-[10px] text-faint">{h.sub}</div>}
                    {h.cells && (
                      <div className="flex flex-wrap gap-1 px-2 py-1.5">
                        {h.cells.map((c, i) => (
                          <span key={i} className="grid h-6 min-w-6 place-items-center rounded border border-line-2 bg-panel px-1 font-mono text-[11px] text-ink">
                            {c === null ? "·" : c}
                          </span>
                        ))}
                      </div>
                    )}
                    {h.rows && (
                      <div className="space-y-0.5 px-2 py-1.5">
                        {h.rows.map((r) => (
                          <div key={r.k} className={clsx("flex items-center justify-between gap-2 rounded font-mono text-[11px]", r.hot && "bg-amber/15")}>
                            <span className="text-dim">{r.k}</span>
                            {r.ref ? <RefChip color={colorOf(r.ref)} title={titleOf(r.ref)} /> : <span className="truncate text-ink">{r.v}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Narration tone={f.tone}>{f.note}</Narration>

      {steps.some((x) => x.out.length > 0) && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] px-3 py-2 font-mono text-[12px] text-[#e2e8f0]">
          <span className="text-[#64748b]">$ output</span>
          {f.out.map((o, i) => (
            <div key={i}>{o}</div>
          ))}
        </div>
      )}

      <StepControls s={s} />
    </div>
  );
}

function RefChip({ color, title }: { color: string; title: string }) {
  return (
    <span className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-md px-1.5 py-0.5 font-semibold" style={{ color, background: `${color}18` }}>
      → {title}
    </span>
  );
}

function VarValue({ x, color, title }: { x: TVar; color?: string; title?: string }) {
  if (x.bad)
    return (
      <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ color: C.bad, background: `${C.bad}14` }}>
        {x.value ?? "?"} ⚠ dangling
      </span>
    );
  if (x.ref && color && title)
    return (
      <span className="flex items-center gap-1.5">
        {x.value && <span className="text-faint">{x.value}</span>}
        <RefChip color={color} title={title} />
      </span>
    );
  return <span className="truncate text-ink">{x.value ?? "?"}</span>;
}
