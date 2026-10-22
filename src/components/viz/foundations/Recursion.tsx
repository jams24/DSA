"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat, StepControls, useStepper } from "../kit";

interface Node {
  id: number;
  n: number;
  depth: number;
  x: number;
  parent: number | null;
  memoHit: boolean;
}

interface Frame {
  visible: number;
  active: number;
  stack: number[];
  values: Record<number, number>;
  msg: string;
  memo: Record<number, number>;
}

function buildFrames(N: number, memoOn: boolean) {
  const nodes: Node[] = [];
  const frames: Frame[] = [];
  const values: Record<number, number> = {};
  const memo: Record<number, number> = {};
  const stack: number[] = [];
  let leaf = 0;

  // first pass: discover nodes in call order (pre-order) and compute x by leaf order
  function fib(n: number, depth: number, parent: number | null): number {
    const id = nodes.length;
    const node: Node = { id, n, depth, x: 0, parent, memoHit: false };
    nodes.push(node);
    stack.push(id);
    if (memoOn && memo[n] !== undefined) {
      node.memoHit = true;
      node.x = leaf++;
      values[id] = memo[n];
      frames.push({ visible: nodes.length, active: id, stack: [...stack], values: { ...values }, memo: { ...memo }, msg: `fib(${n}) is already in the memo table → return ${memo[n]} instantly, no recursion.` });
      stack.pop();
      return memo[n];
    }
    frames.push({ visible: nodes.length, active: id, stack: [...stack], values: { ...values }, memo: { ...memo }, msg: n <= 1 ? `fib(${n}) is a base case.` : `Call fib(${n}) → needs fib(${n - 1}) + fib(${n - 2}). Push a stack frame.` });
    let result: number;
    if (n <= 1) {
      node.x = leaf++;
      result = n;
    } else {
      const a = fib(n - 1, depth + 1, id);
      const b = fib(n - 2, depth + 1, id);
      const kids = nodes.filter((k) => k.parent === id);
      node.x = (kids[0].x + kids[kids.length - 1].x) / 2;
      result = a + b;
    }
    values[id] = result;
    if (memoOn) memo[n] = result;
    frames.push({ visible: nodes.length, active: id, stack: [...stack], values: { ...values }, memo: { ...memo }, msg: `fib(${n}) returns ${result}${n > 1 ? ` (${result - (n > 1 ? fibPlain(n - 2) : 0)} + ${fibPlain(n - 2)})` : ""}. Pop its stack frame.` });
    stack.pop();
    return result;
  }
  fib(N, 0, null);
  frames.push({ visible: nodes.length, active: -1, stack: [], values: { ...values }, memo: { ...memo }, msg: `Done: fib(${N}) = ${values[0]} using ${nodes.length} calls.${memoOn ? " Memoization turned exponential O(2ⁿ) into linear O(n)." : " Notice how the same subproblems are recomputed again and again — O(2ⁿ)."}` });
  return { nodes, frames, leaves: leaf };
}

function fibPlain(n: number): number {
  let a = 0,
    b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

export default function Recursion() {
  const [n, setN] = useState(5);
  const [memoOn, setMemoOn] = useState(false);
  const { nodes, frames, leaves } = useMemo(() => buildFrames(n, memoOn), [n, memoOn]);
  const s = useStepper(frames, 420);
  const f = s.frame;

  const W = Math.max(520, leaves * 46);
  const maxDepth = Math.max(...nodes.map((x) => x.depth));
  const H = (maxDepth + 1) * 62 + 30;
  const pos = (node: Node) => ({ x: 30 + (node.x / Math.max(1, leaves - 1)) * (W - 60), y: 30 + node.depth * 62 });
  const naiveCalls = useMemo(() => buildFrames(n, false).nodes.length, [n]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Slider label="n" value={n} min={2} max={7} onChange={setN} />
        </div>
        <Segmented
          value={memoOn ? "memo" : "plain"}
          onChange={(v) => setMemoOn(v === "memo")}
          options={[
            { value: "plain", label: "Plain recursion" },
            { value: "memo", label: "With memoization" },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] scrollbar-thin">
          <svg width={W} height={H} className="block">
            {nodes.slice(0, f.visible).map((node) => {
              if (node.parent === null) return null;
              const a = pos(nodes[node.parent]);
              const b = pos(node);
              return <line key={`l${node.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.base} strokeWidth={1.5} />;
            })}
            {nodes.slice(0, f.visible).map((node) => {
              const p = pos(node);
              const onStack = f.stack.includes(node.id);
              const done = f.values[node.id] !== undefined;
              const color = node.id === f.active ? C.active : node.memoHit ? C.pivot : onStack ? C.compare : done ? C.done : C.base;
              return (
                <g key={node.id}>
                  <circle cx={p.x} cy={p.y} r={17} fill={`${color}26`} stroke={color} strokeWidth={2} style={node.id === f.active ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill={C.text} fontFamily="monospace" fontWeight="bold">
                    f{node.n}
                  </text>
                  {done && (
                    <text x={p.x + 20} y={p.y - 12} fontSize="10" fill={C.done} fontFamily="monospace">
                      ={f.values[node.id]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Call stack</div>
          <div className="flex flex-col-reverse gap-1">
            {f.stack.map((id, i) => (
              <div key={i} className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: i === f.stack.length - 1 ? C.active : C.base, color: i === f.stack.length - 1 ? C.active : C.muted }}>
                fib({nodes[id].n})
              </div>
            ))}
            {!f.stack.length && <div className="text-xs text-faint">empty</div>}
          </div>
          {memoOn && (
            <>
              <div className="mt-4 mb-2 text-[10px] uppercase tracking-wider text-faint">Memo table</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(f.memo).map(([k, v]) => (
                  <span key={k} className="rounded border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-mono text-[10px] text-violet">
                    {k}:{v}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="calls this run" value={nodes.length} color={memoOn ? C.done : C.bad} />
        <Stat label="calls without memo" value={naiveCalls} color={C.bad} />
        <Stat label="max stack depth" value={maxDepth + 1} color={C.compare} />
      </div>
    </div>
  );
}
