"use client";

import { useMemo, useRef, useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat, StepControls, useStepper } from "../kit";

const R = 13;
const COLS = 24;
const N = R * COLS;
const ISLAND_COLORS = ["#65a30d", "#0891b2", "#db2777", "#d97706", "#7c3aed", "#ea580c", "#059669", "#0284c7", "#e11d48"];

type Algo = "bfs" | "dfs" | "astar";

interface Frame {
  visited: number; // how many of `order` are visited
  frontier: number[];
  path: number; // how many of `path` to show
  msg: string;
}

const nbrs = (i: number) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (c < COLS - 1) out.push(i + 1);
  if (r < R - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  return out;
};
const manhattan = (a: number, b: number) => Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) + Math.abs((a % COLS) - (b % COLS));

function defaultWalls() {
  const w = new Set<number>();
  for (let r = 2; r < R - 2; r++) w.add(r * COLS + 8);
  for (let r = 0; r < R - 4; r++) w.add(r * COLS + 15);
  for (let c = 9; c < 14; c++) w.add(8 * COLS + c);
  return w;
}

function search(walls: Set<number>, start: number, goal: number, algo: Algo) {
  const order: number[] = [];
  const frames: Frame[] = [];
  const prev = new Map<number, number>();
  const seen = new Set<number>([start]);
  let found = false;
  const label = algo === "bfs" ? "queue" : algo === "dfs" ? "stack" : "priority queue (f = g + h)";
  frames.push({ visited: 0, frontier: [start], path: 0, msg: `Start ${algo.toUpperCase()} with the source in a ${label}.` });

  if (algo === "astar") {
    const g = new Map<number, number>([[start, 0]]);
    const open: number[] = [start];
    const closed = new Set<number>();
    while (open.length) {
      open.sort((a, b) => g.get(a)! + manhattan(a, goal) - (g.get(b)! + manhattan(b, goal)) || manhattan(a, goal) - manhattan(b, goal));
      const cur = open.shift()!;
      if (closed.has(cur)) continue;
      closed.add(cur);
      order.push(cur);
      if (cur === goal) {
        found = true;
        break;
      }
      for (const n of nbrs(cur)) {
        if (walls.has(n) || closed.has(n)) continue;
        const ng = g.get(cur)! + 1;
        if (ng < (g.get(n) ?? Infinity)) {
          g.set(n, ng);
          prev.set(n, cur);
          open.push(n);
        }
      }
      frames.push({ visited: order.length, frontier: [...new Set(open)], path: 0, msg: `Expand the cell with the lowest g + h. The Manhattan heuristic pulls the search toward the target.` });
    }
  } else {
    const box: number[] = [start];
    while (box.length) {
      const cur = algo === "bfs" ? box.shift()! : box.pop()!;
      if (algo === "dfs" && order.includes(cur)) continue;
      order.push(cur);
      if (cur === goal) {
        found = true;
        break;
      }
      for (const n of nbrs(cur)) {
        if (walls.has(n)) continue;
        if (algo === "bfs") {
          if (seen.has(n)) continue;
          seen.add(n);
          prev.set(n, cur);
          box.push(n);
        } else if (!order.includes(n)) {
          prev.set(n, cur);
          box.push(n);
        }
      }
      frames.push({
        visited: order.length,
        frontier: [...box],
        path: 0,
        msg: algo === "bfs" ? "Dequeue the oldest cell, enqueue unseen neighbours. BFS expands in rings — distance order." : "Pop the newest cell and dive deeper. DFS finds *a* path, not necessarily the shortest.",
      });
    }
  }

  const path: number[] = [];
  if (found) {
    for (let c: number | undefined = goal; c !== undefined; c = prev.get(c)) path.unshift(c);
    for (let k = 1; k <= path.length; k += Math.max(1, Math.floor(path.length / 14))) {
      frames.push({ visited: order.length, frontier: [], path: k, msg: "Walk back through the parent pointers to rebuild the path." });
    }
  }
  frames.push({
    visited: order.length,
    frontier: [],
    path: path.length,
    msg: found
      ? `${algo.toUpperCase()} reached the target after exploring ${order.length} cells. Path length ${path.length - 1}${algo === "dfs" ? " — compare with BFS!" : " (shortest)."}`
      : "The target is unreachable — the walls cut it off.",
  });
  return { order, path, frames };
}

function islandsSearch(land: Set<number>) {
  const color = new Map<number, number>();
  const order: number[] = [];
  const frames: Frame[] = [{ visited: 0, frontier: [], path: 0, msg: "Scan every cell. Each unvisited land cell starts a new island, which a BFS flood fill colors completely." }];
  let islands = 0;
  for (let i = 0; i < N; i++) {
    if (!land.has(i) || color.has(i)) continue;
    const id = islands++;
    const q = [i];
    color.set(i, id);
    while (q.length) {
      const cur = q.shift()!;
      order.push(cur);
      for (const n of nbrs(cur)) {
        if (land.has(n) && !color.has(n)) {
          color.set(n, id);
          q.push(n);
        }
      }
      frames.push({ visited: order.length, frontier: [...q], path: islands, msg: `Flood-filling island #${islands}…` });
    }
  }
  frames.push({ visited: order.length, frontier: [], path: islands, msg: `${islands} islands. Every cell is visited a constant number of times: O(rows × cols).` });
  return { order, color, frames, islands };
}

export default function GraphGrid() {
  const [mode, setMode] = useState<"path" | "islands">("path");
  const [algo, setAlgo] = useState<Algo>("bfs");
  const [walls, setWalls] = useState<Set<number>>(defaultWalls);
  const [land, setLand] = useState<Set<number>>(() => randomLand());
  const start = 6 * COLS + 2;
  const goal = 6 * COLS + 21;
  const painting = useRef<null | boolean>(null);

  const result = useMemo(
    () => (mode === "path" ? { kind: "path" as const, ...search(walls, start, goal, algo) } : { kind: "islands" as const, ...islandsSearch(land) }),
    [mode, algo, walls, land, start, goal],
  );

  const s = useStepper(result.frames, 40);
  const f = s.frame;
  const visitedIdx = useMemo(() => {
    const m = new Map<number, number>();
    result.order.forEach((c, i) => m.set(c, i));
    return m;
  }, [result.order]);
  const frontier = new Set(f.frontier);
  const pathSet = new Set(result.kind === "path" ? result.path.slice(0, f.path) : []);

  function paint(i: number, add?: boolean) {
    if (mode !== "path" || i === start || i === goal) return;
    setWalls((w) => {
      const n = new Set(w);
      const on = add ?? !n.has(i);
      if (on) n.add(i);
      else n.delete(i);
      return n;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "path", label: "Shortest path" },
            { value: "islands", label: "Number of islands" },
          ]}
        />
        {mode === "path" ? (
          <>
            <Segmented
              value={algo}
              onChange={setAlgo}
              options={[
                { value: "bfs", label: "BFS" },
                { value: "dfs", label: "DFS" },
                { value: "astar", label: "A*" },
              ]}
            />
            <SmallBtn onClick={() => setWalls(new Set())}>clear walls</SmallBtn>
            <SmallBtn onClick={() => setWalls(randomWalls(start, goal))}>random maze</SmallBtn>
          </>
        ) : (
          <SmallBtn onClick={() => setLand(randomLand())}>new map</SmallBtn>
        )}
      </div>
      {mode === "path" && <div className="text-xs text-faint">Click or drag on the grid to draw walls, then press Play.</div>}

      <div
        className="grid touch-none gap-[2px] rounded-xl border border-line bg-[#f8fafd] p-2 select-none"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        onPointerUp={() => (painting.current = null)}
        onPointerLeave={() => (painting.current = null)}
      >
        {Array.from({ length: N }, (_, i) => {
          const vi = visitedIdx.get(i);
          const visited = vi !== undefined && vi < f.visited;
          let bg = "#f1f5f9";
          let border = "transparent";
          if (mode === "path") {
            if (walls.has(i)) bg = "#94a3b8";
            else if (pathSet.has(i)) bg = C.compare;
            else if (frontier.has(i)) border = C.swap;
            else if (visited) bg = `${C.active}${Math.max(30, 90 - Math.floor((vi! / Math.max(1, result.order.length)) * 60)).toString(16)}`;
          } else {
            if (!land.has(i)) bg = "#e0f2fe";
            else if (visited && result.kind === "islands") bg = ISLAND_COLORS[result.color.get(i)! % ISLAND_COLORS.length];
            else bg = "#d9f99d";
            if (frontier.has(i)) border = "#0f172a";
          }
          const label = mode === "path" && (i === start ? "S" : i === goal ? "T" : "");
          return (
            <div
              key={i}
              onPointerDown={(e) => {
                e.preventDefault();
                painting.current = !walls.has(i);
                paint(i, painting.current);
              }}
              onPointerEnter={() => painting.current !== null && paint(i, painting.current)}
              className="grid aspect-square place-items-center rounded-[3px] text-[9px] font-bold transition-colors duration-150"
              style={{
                background: label ? (i === start ? C.done : C.bad) : bg,
                boxShadow: border !== "transparent" ? `inset 0 0 0 2px ${border}` : undefined,
                color: "#ffffff",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      {mode === "path" ? (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="cells explored" value={f.visited} color={C.active} />
          <Stat label="frontier size" value={f.frontier.length} color={C.swap} />
          <Stat label="path length" value={result.kind === "path" && result.path.length ? result.path.length - 1 : "—"} color={C.compare} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="islands found" value={f.path} color={C.lime} />
          <Stat label="cells flooded" value={f.visited} />
        </div>
      )}
    </div>
  );
}

function randomLand() {
  const s = new Set<number>();
  for (let i = 0; i < N; i++) if (Math.random() < 0.42) s.add(i);
  return s;
}

function randomWalls(start: number, goal: number) {
  const s = new Set<number>();
  for (let i = 0; i < N; i++) if (Math.random() < 0.28 && i !== start && i !== goal) s.add(i);
  return s;
}
