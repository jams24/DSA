"use client";

import { useMemo, useState } from "react";
import { C, Narration, SmallBtn, StepControls, useStepper } from "../kit";

const NODES = [
  { id: "A", x: 70, y: 170 },
  { id: "B", x: 200, y: 60 },
  { id: "C", x: 200, y: 280 },
  { id: "D", x: 350, y: 170 },
  { id: "E", x: 500, y: 60 },
  { id: "F", x: 500, y: 280 },
  { id: "G", x: 630, y: 170 },
];

const BASE_EDGES: [string, string, number][] = [
  ["A", "B", 4],
  ["A", "C", 2],
  ["B", "C", 1],
  ["B", "D", 5],
  ["C", "D", 8],
  ["C", "F", 10],
  ["D", "E", 2],
  ["D", "F", 6],
  ["E", "G", 3],
  ["F", "G", 1],
  ["B", "E", 12],
];

interface Frame {
  dist: Record<string, number>;
  done: string[];
  pq: [string, number][];
  cur?: string;
  edge?: [string, string];
  improved?: boolean;
  tree: Record<string, string>; // node -> parent
  msg: string;
}

function run(edges: [string, string, number][], src: string): Frame[] {
  const adj: Record<string, [string, number][]> = {};
  for (const n of NODES) adj[n.id] = [];
  for (const [a, b, w] of edges) {
    adj[a].push([b, w]);
    adj[b].push([a, w]);
  }
  const dist: Record<string, number> = Object.fromEntries(NODES.map((n) => [n.id, Infinity]));
  const parent: Record<string, string> = {};
  const done: string[] = [];
  dist[src] = 0;
  let pq: [string, number][] = [[src, 0]];
  const fr: Frame[] = [{ dist: { ...dist }, done: [], pq: [...pq], tree: {}, msg: `dist[${src}] = 0, everything else ∞. Push (${src}, 0) into the min-priority queue.` }];
  while (pq.length) {
    pq.sort((a, b) => a[1] - b[1]);
    const [u, d] = pq.shift()!;
    if (done.includes(u)) {
      fr.push({ dist: { ...dist }, done: [...done], pq: [...pq], cur: u, tree: { ...parent }, msg: `Pop (${u}, ${d}) — stale entry, ${u} is already finalized. Skip (lazy deletion).` });
      continue;
    }
    done.push(u);
    fr.push({ dist: { ...dist }, done: [...done], pq: [...pq], cur: u, tree: { ...parent }, msg: `Pop (${u}, ${d}): the smallest tentative distance. With non-negative weights it can never improve, so ${u} is final.` });
    for (const [v, w] of adj[u]) {
      if (done.includes(v)) continue;
      const nd = dist[u] + w;
      const improved = nd < dist[v];
      if (improved) {
        dist[v] = nd;
        parent[v] = u;
        pq = [...pq, [v, nd]];
      }
      fr.push({
        dist: { ...dist },
        done: [...done],
        pq: [...pq],
        cur: u,
        edge: [u, v],
        improved,
        tree: { ...parent },
        msg: improved ? `Relax ${u}→${v}: ${dist[u]} + ${w} = ${nd} beats the old distance. Update and push (${v}, ${nd}).` : `Relax ${u}→${v}: ${dist[u]} + ${w} = ${nd} is not better than ${dist[v]}. Ignore.`,
      });
    }
  }
  fr.push({ dist: { ...dist }, done: [...done], pq: [], tree: { ...parent }, msg: "Queue empty. Highlighted edges form the shortest-path tree. O((V + E) log V) with a binary heap." });
  return fr;
}

export default function Dijkstra() {
  const [edges, setEdges] = useState(BASE_EDGES);
  const [src, setSrc] = useState("A");
  const frames = useMemo(() => run(edges, src), [edges, src]);
  const s = useStepper(frames, 900);
  const f = s.frame;
  const pos = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const inTree = (a: string, b: string) => f.tree[b] === a || f.tree[a] === b;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">source:</span>
        {NODES.map((n) => (
          <SmallBtn key={n.id} tone={src === n.id ? "primary" : "default"} onClick={() => setSrc(n.id)}>
            {n.id}
          </SmallBtn>
        ))}
        <SmallBtn onClick={() => setEdges(BASE_EDGES.map(([a, b]) => [a, b, 1 + Math.floor(Math.random() * 12)]))}>random weights</SmallBtn>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
          <svg viewBox="0 0 700 340" className="block w-full min-w-[520px]">
            {edges.map(([a, b, w]) => {
              const hot = f.edge && ((f.edge[0] === a && f.edge[1] === b) || (f.edge[0] === b && f.edge[1] === a));
              const tree = inTree(a, b);
              const color = hot ? (f.improved ? C.done : C.bad) : tree ? C.compare : C.base;
              return (
                <g key={`${a}${b}`}>
                  <line x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke={color} strokeWidth={hot || tree ? 3.5 : 1.8} style={hot ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} />
                  <rect x={(pos[a].x + pos[b].x) / 2 - 12} y={(pos[a].y + pos[b].y) / 2 - 10} width={24} height={18} rx={5} fill="#0c1121" stroke={color} />
                  <text x={(pos[a].x + pos[b].x) / 2} y={(pos[a].y + pos[b].y) / 2 + 3.5} textAnchor="middle" fontSize="11" fill={C.text} fontFamily="monospace">
                    {w}
                  </text>
                </g>
              );
            })}
            {NODES.map((n) => {
              const isDone = f.done.includes(n.id);
              const isCur = f.cur === n.id;
              const color = isCur ? C.active : isDone ? C.done : n.id === src ? C.pivot : C.base;
              const d = f.dist[n.id];
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={24} fill={`${color}26`} stroke={color} strokeWidth={2.5} style={isCur ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined} />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill={C.text}>
                    {n.id}
                  </text>
                  <text x={n.x} y={n.y - 32} textAnchor="middle" fontSize="12" fontFamily="monospace" fill={d === Infinity ? C.faint : C.compare}>
                    {d === Infinity ? "∞" : d}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Min-heap (node, dist)</div>
            <div className="flex flex-wrap gap-1">
              {[...f.pq]
                .sort((a, b) => a[1] - b[1])
                .map(([n, d], i) => (
                  <span key={i} className="rounded-md border px-1.5 py-0.5 font-mono text-[11px]" style={{ borderColor: i === 0 ? C.active : C.base, color: f.done.includes(n) ? C.faint : C.text }}>
                    {n}:{d}
                  </span>
                ))}
              {!f.pq.length && <span className="text-xs text-faint">empty</span>}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">dist[] / parent</div>
            <table className="w-full font-mono text-xs">
              <tbody>
                {NODES.map((n) => (
                  <tr key={n.id} className={f.done.includes(n.id) ? "text-emerald" : "text-dim"}>
                    <td className="py-0.5">{n.id}</td>
                    <td>{f.dist[n.id] === Infinity ? "∞" : f.dist[n.id]}</td>
                    <td className="text-right">{f.tree[n.id] ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Narration tone={f.edge ? (f.improved ? "good" : "info") : "info"}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
