"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

const N = 160;
const CLUSTERS = [
  { x: 140, y: 110, label: "sports" },
  { x: 430, y: 90, label: "finance" },
  { x: 300, y: 250, label: "cooking" },
  { x: 520, y: 260, label: "travel" },
  { x: 110, y: 270, label: "tech" },
];

function build(seed: number) {
  const rand = mulberry32(seed);
  const pts = Array.from({ length: N }, (_, i) => {
    const c = CLUSTERS[i % CLUSTERS.length];
    const r = Math.sqrt(rand()) * 85;
    const a = rand() * Math.PI * 2;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) * 0.8, c: i % CLUSTERS.length };
  });
  // navigable small-world graph: M nearest neighbours + a few long-range links
  const M = 6;
  const nbrs = pts.map((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, M)
      .map((x) => x.j);
    return near;
  });
  for (let i = 0; i < N; i += 8) {
    const j = Math.floor(rand() * N);
    if (j !== i) {
      nbrs[i].push(j);
      nbrs[j].push(i);
    }
  }
  return { pts, nbrs };
}

const COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706"];

export default function VectorSearch() {
  const [mode, setMode] = useState<"brute" | "graph">("graph");
  const [k, setK] = useState(5);
  const [query, setQuery] = useState({ x: 330, y: 200 });
  const { pts, nbrs } = useMemo(() => build(5), []);

  const dist = (i: number) => Math.hypot(pts[i].x - query.x, pts[i].y - query.y);
  const truth = useMemo(
    () =>
      pts
        .map((_, i) => i)
        .sort((a, b) => dist(a) - dist(b))
        .slice(0, k),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, k, pts],
  );

  const graph = useMemo(() => {
    // greedy beam search (ef = k * 2) from a fixed entry point
    const ef = Math.max(k * 2, 8);
    const entry = 0;
    const visited = new Set<number>([entry]);
    let evaluated = 1;
    const candidates = [entry];
    let results = [entry];
    const path: number[] = [entry];
    while (candidates.length) {
      candidates.sort((a, b) => dist(a) - dist(b));
      const c = candidates.shift()!;
      const worst = results.length >= ef ? dist(results[results.length - 1]) : Infinity;
      if (dist(c) > worst) break;
      path.push(c);
      for (const n of nbrs[c]) {
        if (visited.has(n)) continue;
        visited.add(n);
        evaluated++;
        if (results.length < ef || dist(n) < dist(results[results.length - 1])) {
          candidates.push(n);
          results = [...results, n].sort((a, b) => dist(a) - dist(b)).slice(0, ef);
        }
      }
    }
    const found = results.slice(0, k);
    return { found, evaluated, visited, path };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, k, nbrs]);

  const found = mode === "brute" ? truth : graph.found;
  const recall = found.filter((i) => truth.includes(i)).length / k;
  const evaluated = mode === "brute" ? N : graph.evaluated;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "brute", label: "Exact (brute force)" },
            { value: "graph", label: "ANN: graph search (HNSW-style)" },
          ]}
        />
        <div className="w-40">
          <Slider label="k nearest" value={k} min={1} max={12} onChange={setK} />
        </div>
        <span className="text-xs text-faint">Click anywhere on the map to move the query embedding.</span>
      </div>
      <div className="rounded-xl border border-line bg-[#f8fafd]">
        <svg
          viewBox="0 0 640 360"
          className="block w-full cursor-crosshair"
          onClick={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            setQuery({ x: ((e.clientX - r.left) / r.width) * 640, y: ((e.clientY - r.top) / r.height) * 360 });
          }}
        >
          {mode === "graph" &&
            nbrs.flatMap((ns, i) => ns.filter((j) => j > i).map((j) => <line key={`${i}-${j}`} x1={pts[i].x} y1={pts[i].y} x2={pts[j].x} y2={pts[j].y} stroke="#d5dce6" strokeWidth={0.8} />))}
          {mode === "graph" &&
            graph.path.slice(1).map((n, i) => {
              const a = pts[graph.path[i]];
              const b = pts[n];
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.compare} strokeWidth={2} opacity={0.9} />;
            })}
          {CLUSTERS.map((c) => (
            <text key={c.label} x={c.x} y={c.y - 70} textAnchor="middle" fontSize="11" fill={C.faint}>
              {c.label}
            </text>
          ))}
          {pts.map((p, i) => {
            const hit = found.includes(i);
            const checked = mode === "brute" || graph.visited.has(i);
            return <circle key={i} cx={p.x} cy={p.y} r={hit ? 6 : 3.5} fill={hit ? COLORS[p.c] : checked ? `${COLORS[p.c]}88` : "#cbd5e1"} stroke={hit ? "#0f172a" : "none"} strokeWidth={1.5} />;
          })}
          {found.map((i) => (
            <line key={`q${i}`} x1={query.x} y1={query.y} x2={pts[i].x} y2={pts[i].y} stroke="#0f172a" strokeOpacity={0.3} strokeDasharray="3 3" />
          ))}
          <g transform={`translate(${query.x} ${query.y})`}>
            <circle r={9} fill={C.bad} style={{ filter: `drop-shadow(0 0 8px ${C.bad})` }} />
            <text y={4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff">
              q
            </text>
          </g>
          {mode === "graph" && <circle cx={pts[0].x} cy={pts[0].y} r={8} fill="none" stroke={C.compare} strokeWidth={2} />}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="distance computations" value={`${evaluated} / ${N}`} color={mode === "brute" ? C.bad : C.done} />
        <Stat label={`recall@${k}`} value={`${Math.round(recall * 100)}%`} color={recall === 1 ? C.done : C.compare} />
        <Stat label="search hops (graph)" value={mode === "graph" ? graph.path.length - 1 : "—"} color={C.compare} />
      </div>
      <Narration>
        {mode === "brute"
          ? "Exact k-NN compares the query with every vector: perfect recall, O(N·d) per query — fine for thousands of vectors, too slow for hundreds of millions."
          : "HNSW-style search walks a proximity graph greedily from an entry point (yellow ring), always moving toward neighbours closer to the query, keeping a small candidate list. It touches a fraction of the vectors and usually finds almost all true neighbours: approximate nearest neighbour (ANN) search trades a little recall for orders-of-magnitude speed. Real HNSW adds hierarchical layers for long jumps."}
      </Narration>
    </div>
  );
}
