"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, Stat } from "../kit";

const LENGTHS = [3, 12, 5, 8, 2, 10, 6, 4, 9, 3, 7, 5];
const COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#a3e635", "#fbbf24", "#fb923c", "#34d399", "#38bdf8", "#fb7185", "#c084fc", "#2dd4bf", "#facc15"];

interface Sched {
  grid: (number | null)[][]; // [slot][step] = request id
  finish: number[]; // completion step per request
  steps: number;
}

function staticBatch(slots: number): Sched {
  const grid: (number | null)[][] = Array.from({ length: slots }, () => []);
  const finish = Array(LENGTHS.length).fill(0);
  let t = 0;
  for (let b = 0; b < LENGTHS.length; b += slots) {
    const batch = LENGTHS.slice(b, b + slots);
    const longest = Math.max(...batch);
    for (let s = 0; s < slots; s++) {
      const id = b + s;
      for (let k = 0; k < longest; k++) grid[s][t + k] = id < LENGTHS.length && k < LENGTHS[id] ? id : null;
      if (id < LENGTHS.length) finish[id] = t + LENGTHS[id];
    }
    t += longest;
  }
  return { grid, finish, steps: t };
}

function continuous(slots: number): Sched {
  const grid: (number | null)[][] = Array.from({ length: slots }, () => []);
  const finish = Array(LENGTHS.length).fill(0);
  const remaining = [...LENGTHS];
  const active: (number | null)[] = Array(slots).fill(null);
  let next = 0;
  let t = 0;
  while (next < LENGTHS.length || active.some((a) => a !== null)) {
    for (let s = 0; s < slots; s++) if (active[s] === null && next < LENGTHS.length) active[s] = next++;
    for (let s = 0; s < slots; s++) {
      const id = active[s];
      grid[s][t] = id;
      if (id !== null) {
        remaining[id]--;
        if (remaining[id] === 0) {
          finish[id] = t + 1;
          active[s] = null;
        }
      }
    }
    t++;
  }
  return { grid, finish, steps: t };
}

function Chart({ s, title, color }: { s: Sched; title: string; color: string }) {
  const busy = s.grid.flat().filter((x) => x !== null && x !== undefined).length;
  const util = busy / (s.grid.length * s.steps);
  return (
    <div className="space-y-2 rounded-xl border bg-[#080c19] p-3" style={{ borderColor: `${color}55` }}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-sm font-semibold" style={{ color }}>
          {title}
        </span>
        <span className="font-mono text-[11px] text-dim">
          {s.steps} steps · {(util * 100).toFixed(0)}% GPU slots busy
        </span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="space-y-[2px]">
          {s.grid.map((row, slot) => (
            <div key={slot} className="flex gap-[2px]">
              <span className="w-12 shrink-0 font-mono text-[9px] leading-5 text-faint">slot {slot + 1}</span>
              {Array.from({ length: s.steps }, (_, t) => {
                const id = row[t];
                return (
                  <div
                    key={t}
                    className="h-5 w-5 shrink-0 rounded-[3px] text-center font-mono text-[8px] leading-5"
                    style={{
                      background: id === null || id === undefined ? "repeating-linear-gradient(45deg,#1a1222,#1a1222 3px,#100c18 3px,#100c18 6px)" : COLORS[id % COLORS.length],
                      color: "#06120a",
                    }}
                    title={id === null || id === undefined ? "idle (padding)" : `request ${id + 1}`}
                  >
                    {id !== null && id !== undefined && (t === 0 || row[t - 1] !== id) ? id + 1 : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Batching() {
  const [slots, setSlots] = useState(4);
  const st = useMemo(() => staticBatch(slots), [slots]);
  const ct = useMemo(() => continuous(slots), [slots]);
  const avg = (s: Sched) => s.finish.reduce((a, b) => a + b, 0) / s.finish.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Slider label="batch slots on the GPU" value={slots} min={2} max={6} onChange={setSlots} />
        </div>
        <div className="text-xs text-dim">12 requests with output lengths {LENGTHS.join(", ")} tokens. Each column = one decode step.</div>
      </div>
      <Chart s={st} title="Static batching" color={C.bad} />
      <Chart s={ct} title="Continuous (in-flight) batching" color={C.done} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="static: total steps" value={st.steps} color={C.bad} />
        <Stat label="continuous: total steps" value={ct.steps} color={C.done} />
        <Stat label="static: avg completion" value={avg(st).toFixed(1)} color={C.bad} />
        <Stat label="continuous: avg completion" value={avg(ct).toFixed(1)} color={C.done} />
      </div>
      <Narration>
        Static batching waits for the longest sequence in the batch — finished requests leave their slot idle (hatched) and new requests wait for the whole batch. Continuous batching (Orca, vLLM, TGI, TensorRT-LLM) schedules at every decode
        step: as soon as a sequence emits its end token, a waiting request takes its slot. Higher throughput AND lower average latency.
      </Narration>
    </div>
  );
}
