"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Slider, Stat, StepControls, useStepper } from "../kit";

interface Frame {
  infected: number[]; // round each node got infected (-1 = not yet)
  round: number;
  contacts: [number, number][];
}

export default function Gossip() {
  const [n, setN] = useState(40);
  const [fanout, setFanout] = useState(2);
  const [seed, setSeed] = useState(7);

  const { frames, pos } = useMemo(() => {
    const rand = mulberry32(seed);
    const pos = Array.from({ length: n }, () => ({ x: 30 + rand() * 540, y: 25 + rand() * 250 }));
    const infected = Array(n).fill(-1);
    infected[0] = 0;
    const fr: Frame[] = [{ infected: [...infected], round: 0, contacts: [] }];
    for (let round = 1; round <= 20 && infected.some((r) => r < 0); round++) {
      const contacts: [number, number][] = [];
      const spreaders = infected.map((r, i) => (r >= 0 ? i : -1)).filter((i) => i >= 0);
      for (const i of spreaders) {
        for (let k = 0; k < fanout; k++) {
          const j = Math.floor(rand() * n);
          if (j === i) continue;
          contacts.push([i, j]);
          if (infected[j] < 0) infected[j] = round;
        }
      }
      fr.push({ infected: [...infected], round, contacts });
    }
    return { frames: fr, pos };
  }, [n, fanout, seed]);

  const s = useStepper(frames, 900);
  const f = s.frame;
  const count = f.infected.filter((r) => r >= 0).length;
  const curve = frames.map((fr) => fr.infected.filter((r) => r >= 0).length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-40">
          <Slider label="nodes" value={n} min={10} max={80} onChange={setN} />
        </div>
        <div className="w-40">
          <Slider label="fanout per round" value={fanout} min={1} max={4} onChange={setFanout} />
        </div>
        <button type="button" onClick={() => setSeed((x) => x + 1)} className="h-9 rounded-lg border border-line-2 bg-panel-3 px-3 text-xs text-ink">
          ↻ new random run
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="rounded-xl border border-line bg-[#f8fafd]">
          <svg viewBox="0 0 600 300" className="block w-full">
            {f.contacts.map(([a, b], i) => (
              <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} stroke={C.active} strokeOpacity={0.35} strokeWidth={1.2} />
            ))}
            {pos.map((p, i) => {
              const r = f.infected[i];
              const fresh = r === f.round && f.round > 0;
              const color = r < 0 ? C.base : i === 0 ? C.compare : C.active;
              return <circle key={i} cx={p.x} cy={p.y} r={fresh ? 8 : 6} fill={r < 0 ? "#f1f5f9" : `${color}`} stroke={color} strokeWidth={1.5} style={fresh ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined} />;
            })}
          </svg>
        </div>
        <div className="space-y-2">
          <Stat label="round" value={f.round} />
          <Stat label="nodes that know the update" value={`${count}/${n}`} color={C.active} />
          <Stat label="log₂(N) for comparison" value={Math.log2(n).toFixed(1)} color={C.pivot} />
          <div className="rounded-xl border border-line bg-panel p-2">
            <svg viewBox="0 0 200 60" className="w-full">
              <polyline
                points={curve.map((c, i) => `${(i / Math.max(1, curve.length - 1)) * 196 + 2},${58 - (c / n) * 54}`).join(" ")}
                fill="none"
                stroke={C.active}
                strokeWidth={2}
              />
              <circle cx={(s.i / Math.max(1, curve.length - 1)) * 196 + 2} cy={58 - (count / n) * 54} r={3.5} fill={C.compare} />
            </svg>
            <div className="text-center text-[10px] text-faint">S-curve: slow start, explosive middle, long tail</div>
          </div>
        </div>
      </div>
      <Narration>
        Each round, every informed node tells {fanout} random peer(s). The update reaches all {n} nodes in about O(log N) rounds with no coordinator and no single point of failure — how Cassandra and Consul spread membership and failure info.
      </Narration>
      <StepControls s={s} />
    </div>
  );
}
