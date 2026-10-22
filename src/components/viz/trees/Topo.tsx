"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

const NODES = [
  { id: "Intro", x: 80, y: 60 },
  { id: "Arrays", x: 80, y: 200 },
  { id: "Lists", x: 250, y: 60 },
  { id: "Hashing", x: 250, y: 200 },
  { id: "Trees", x: 420, y: 60 },
  { id: "Graphs", x: 420, y: 200 },
  { id: "DP", x: 590, y: 130 },
  { id: "Interview", x: 590, y: 270 },
];

const DAG: [string, string][] = [
  ["Intro", "Lists"],
  ["Intro", "Arrays"],
  ["Arrays", "Hashing"],
  ["Lists", "Trees"],
  ["Hashing", "Trees"],
  ["Hashing", "Graphs"],
  ["Trees", "Graphs"],
  ["Trees", "DP"],
  ["Graphs", "DP"],
  ["Graphs", "Interview"],
  ["DP", "Interview"],
];

interface Frame {
  indeg: Record<string, number>;
  queue: string[];
  out: string[];
  cur?: string;
  edge?: [string, string];
  msg: string;
  tone?: "info" | "good" | "bad";
}

function kahn(edges: [string, string][]): Frame[] {
  const indeg: Record<string, number> = Object.fromEntries(NODES.map((n) => [n.id, 0]));
  const adj: Record<string, string[]> = Object.fromEntries(NODES.map((n) => [n.id, []]));
  for (const [a, b] of edges) {
    adj[a].push(b);
    indeg[b]++;
  }
  const q = NODES.filter((n) => indeg[n.id] === 0).map((n) => n.id);
  const out: string[] = [];
  const fr: Frame[] = [{ indeg: { ...indeg }, queue: [...q], out: [], msg: `Count incoming edges. Courses with in-degree 0 have no prerequisites: queue = [${q.join(", ")}].` }];
  while (q.length) {
    const u = q.shift()!;
    out.push(u);
    fr.push({ indeg: { ...indeg }, queue: [...q], out: [...out], cur: u, msg: `Take ${u} (all its prerequisites are done) and append it to the order.` });
    for (const v of adj[u]) {
      indeg[v]--;
      if (indeg[v] === 0) q.push(v);
      fr.push({ indeg: { ...indeg }, queue: [...q], out: [...out], cur: u, edge: [u, v], msg: `Remove edge ${u}→${v}: in-degree of ${v} drops to ${indeg[v]}${indeg[v] === 0 ? " → enqueue it." : "."}` });
    }
  }
  const stuck = NODES.filter((n) => !out.includes(n.id)).map((n) => n.id);
  fr.push(
    stuck.length
      ? { indeg: { ...indeg }, queue: [], out: [...out], msg: `Queue empty but ${stuck.join(", ")} still have prerequisites: there is a CYCLE. No valid order exists (Course Schedule → false).`, tone: "bad" }
      : { indeg: { ...indeg }, queue: [], out: [...out], msg: `All ${out.length} nodes ordered: a valid topological order. O(V + E).`, tone: "good" },
  );
  return fr;
}

export default function Topo() {
  const [cyclic, setCyclic] = useState(false);
  const edges = useMemo<[string, string][]>(() => (cyclic ? [...DAG, ["DP", "Hashing"]] : DAG), [cyclic]);
  const frames = useMemo(() => kahn(edges), [edges]);
  const s = useStepper(frames, 750);
  const f = s.frame;
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <div className="space-y-4">
      <Segmented
        value={cyclic ? "cycle" : "dag"}
        onChange={(v) => setCyclic(v === "cycle")}
        options={[
          { value: "dag", label: "Valid DAG" },
          { value: "cycle", label: "Add a cycle (DP → Hashing)" },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
        <svg viewBox="0 0 680 330" className="block w-full min-w-[520px]">
          <defs>
            <marker id="topo-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {edges.map(([a, b]) => {
            const A = pos[a];
            const B = pos[b];
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const len = Math.hypot(dx, dy);
            const hot = f.edge?.[0] === a && f.edge?.[1] === b;
            const gone = f.out.includes(a);
            const back = a === "DP" && b === "Hashing";
            return (
              <line
                key={`${a}${b}`}
                x1={A.x + (dx / len) * 44}
                y1={A.y + (dy / len) * 22}
                x2={B.x - (dx / len) * 46}
                y2={B.y - (dy / len) * 24}
                stroke={hot ? C.active : back ? C.bad : gone ? C.dim : C.muted}
                strokeWidth={hot ? 3 : 1.6}
                strokeDasharray={back ? "5 4" : undefined}
                markerEnd="url(#topo-arrow)"
              />
            );
          })}
          {NODES.map((n) => {
            const done = f.out.includes(n.id);
            const queued = f.queue.includes(n.id);
            const color = f.cur === n.id ? C.active : done ? C.done : queued ? C.compare : C.base;
            return (
              <g key={n.id}>
                <rect x={n.x - 44} y={n.y - 20} width={88} height={40} rx={12} fill={`${color}22`} stroke={color} strokeWidth={2} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={C.text}>
                  {n.id}
                </text>
                <circle cx={n.x + 44} cy={n.y - 20} r={10} fill="#0c1121" stroke={color} />
                <text x={n.x + 44} y={n.y - 16} textAnchor="middle" fontSize="10" fontFamily="monospace" fill={color}>
                  {f.indeg[n.id]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Queue (in-degree 0)</div>
          <div className="flex min-h-7 flex-wrap gap-1">
            {f.queue.map((q) => (
              <span key={q} className="rounded-md border border-amber/40 bg-amber/10 px-2 py-0.5 text-xs text-amber">
                {q}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Topological order</div>
          <div className="flex min-h-7 flex-wrap gap-1">
            {f.out.map((q, i) => (
              <span key={q} className="rounded-md border border-emerald/40 bg-emerald/10 px-2 py-0.5 text-xs text-emerald">
                {i + 1}. {q}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
