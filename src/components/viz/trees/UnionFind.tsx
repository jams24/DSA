"use client";

import { useState } from "react";
import { C, Narration, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

const N = 10;

interface Frame {
  parent: number[];
  rank: number[];
  hi: Record<number, string>;
  msg: string;
}

export default function UnionFind() {
  const [parent, setParent] = useState(() => Array.from({ length: N }, (_, i) => i));
  const [rank, setRank] = useState(() => Array(N).fill(0));
  const [a, setA] = useState("1");
  const [b, setB] = useState("2");
  const [frames, setFrames] = useState<Frame[]>([
    { parent: Array.from({ length: N }, (_, i) => i), rank: Array(N).fill(0), hi: {}, msg: "Ten elements, each its own set (every node is its own root). union(a, b) merges sets; find(x) returns the set's root." },
  ]);
  const s = useStepper(frames, 700, true);

  function findWithFrames(p: number[], x: number, fr: Frame[], r: number[], label: string) {
    const path = [x];
    while (p[path[path.length - 1]] !== path[path.length - 1]) path.push(p[path[path.length - 1]]);
    const root = path[path.length - 1];
    fr.push({ parent: [...p], rank: [...r], hi: { ...Object.fromEntries(path.map((n) => [n, C.compare])), [root]: C.done }, msg: `${label}: follow parents ${path.join(" → ")}. Root is ${root}.` });
    if (path.length > 2) {
      for (const n of path.slice(0, -1)) p[n] = root;
      fr.push({ parent: [...p], rank: [...r], hi: { ...Object.fromEntries(path.map((n) => [n, C.pivot])), [root]: C.done }, msg: `Path compression: point every node on that path directly at ${root}. Future finds are ~O(1).` });
    }
    return root;
  }

  function doUnion() {
    const x = Number(a);
    const y = Number(b);
    if (!(x >= 0 && x < N && y >= 0 && y < N)) return;
    const p = [...parent];
    const r = [...rank];
    const fr: Frame[] = [];
    const rx = findWithFrames(p, x, fr, r, `find(${x})`);
    const ry = findWithFrames(p, y, fr, r, `find(${y})`);
    if (rx === ry) {
      fr.push({ parent: [...p], rank: [...r], hi: { [rx]: C.bad }, msg: `${x} and ${y} already share root ${rx}. In Kruskal's MST or cycle detection, this edge would form a CYCLE.` });
    } else {
      let [big, small] = r[rx] >= r[ry] ? [rx, ry] : [ry, rx];
      if (r[rx] === r[ry]) [big, small] = [rx, ry];
      p[small] = big;
      if (r[big] === r[small]) r[big]++;
      fr.push({ parent: [...p], rank: [...r], hi: { [big]: C.done, [small]: C.active }, msg: `Union by rank: attach the shorter tree's root (${small}) under the taller one (${big}). Trees stay shallow: O(log n) height even without compression.` });
    }
    setParent(p);
    setRank(r);
    setFrames(fr);
  }

  function doFind() {
    const x = Number(a);
    if (!(x >= 0 && x < N)) return;
    const p = [...parent];
    const fr: Frame[] = [];
    findWithFrames(p, x, fr, rank, `find(${x})`);
    setParent(p);
    setFrames(fr);
  }

  function reset() {
    const p = Array.from({ length: N }, (_, i) => i);
    setParent(p);
    setRank(Array(N).fill(0));
    setFrames([{ parent: p, rank: Array(N).fill(0), hi: {}, msg: "Reset: ten singleton sets." }]);
  }

  function chain() {
    // build a deliberately tall chain without union-by-rank to show compression
    const p = [0, 0, 1, 2, 3, 4, 6, 7, 8, 9];
    setParent(p);
    setRank([4, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setFrames([{ parent: p, rank: [4, 0, 0, 0, 0, 0, 0, 0, 0, 0], hi: {}, msg: "A tall chain 5→4→3→2→1→0 (what naive unions can build). Try find(5) to watch path compression flatten it." }]);
    setA("5");
  }

  const f = s.frame;
  // layout forest: roots in a row, children below
  const children: Record<number, number[]> = {};
  f.parent.forEach((p, i) => {
    if (p !== i) (children[p] ??= []).push(i);
  });
  const roots = f.parent.map((p, i) => (p === i ? i : -1)).filter((i) => i >= 0);
  const pos: Record<number, { x: number; y: number }> = {};
  let col = 0;
  const place = (n: number, d: number): number => {
    const kids = children[n] ?? [];
    if (!kids.length) {
      pos[n] = { x: col++, y: d };
      return pos[n].x;
    }
    const xs = kids.map((k) => place(k, d + 1));
    pos[n] = { x: (xs[0] + xs[xs.length - 1]) / 2, y: d };
    return pos[n].x;
  };
  roots.forEach((r) => {
    place(r, 0);
    col += 0.4;
  });
  const maxY = Math.max(...Object.values(pos).map((p) => p.y));
  const W = Math.max(480, col * 56 + 40);
  const H = (maxY + 1) * 66 + 30;
  const X = (n: number) => 32 + pos[n].x * 56;
  const Y = (n: number) => 28 + pos[n].y * 66;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">a</span>
        <TextInput value={a} onChange={setA} width="w-12" />
        <span className="text-xs text-dim">b</span>
        <TextInput value={b} onChange={setB} width="w-12" />
        <SmallBtn tone="primary" onClick={doUnion}>union(a, b)</SmallBtn>
        <SmallBtn onClick={doFind}>find(a)</SmallBtn>
        <SmallBtn onClick={chain}>tall chain demo</SmallBtn>
        <SmallBtn tone="danger" onClick={reset}>reset</SmallBtn>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] scrollbar-thin">
        <svg width={W} height={H} className="block">
          {f.parent.map((p, i) =>
            p !== i && pos[i] && pos[p] ? <line key={`e${i}`} x1={X(i)} y1={Y(i)} x2={X(p)} y2={Y(p)} stroke={f.hi[i] === C.pivot ? C.pivot : C.base} strokeWidth={2} /> : null,
          )}
          {f.parent.map((p, i) => {
            const color = f.hi[i] ?? (p === i ? C.sky : undefined);
            return (
              <g key={i}>
                <circle cx={X(i)} cy={Y(i)} r={17} fill={color ? `${color}26` : C.baseFill} stroke={color ?? C.base} strokeWidth={2} />
                <text x={X(i)} y={Y(i) + 4.5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={C.text} fontFamily="monospace">
                  {i}
                </text>
                {p === i && (
                  <text x={X(i)} y={Y(i) - 22} textAnchor="middle" fontSize="9" fill={C.faint} fontFamily="monospace">
                    rank {f.rank[i]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3 font-mono text-xs scrollbar-thin">
        <div className="flex gap-1">
          <span className="w-14 text-faint">index</span>
          {f.parent.map((_, i) => (
            <span key={i} className="w-7 text-center text-faint">
              {i}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="w-14 text-faint">parent</span>
          {f.parent.map((p, i) => (
            <span key={i} className="w-7 text-center" style={{ color: f.hi[i] ?? C.text }}>
              {p}
            </span>
          ))}
        </div>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="disjoint sets" value={roots.length} color={C.sky} />
        <Stat label="tallest tree" value={maxY + 1} color={C.compare} />
      </div>
    </div>
  );
}
