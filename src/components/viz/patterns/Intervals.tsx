"use client";

import { useMemo, useState } from "react";
import { C, Narration, StepControls, useStepper } from "../kit";

type Iv = [number, number];

interface Frame {
  sorted: Iv[];
  cur: number;
  merged: Iv[];
  msg: string;
  tone?: "info" | "good";
}

const T = 20;

function randomIntervals(): Iv[] {
  const out: Iv[] = [];
  for (let k = 0; k < 7; k++) {
    const s = Math.floor(Math.random() * 16);
    out.push([s, Math.min(T, s + 1 + Math.floor(Math.random() * 5))]);
  }
  return out;
}

export default function Intervals() {
  const [input, setInput] = useState<Iv[]>([
    [8, 10],
    [1, 3],
    [2, 6],
    [15, 18],
    [9, 12],
    [16, 17],
    [4, 5],
  ]);

  const frames = useMemo<Frame[]>(() => {
    const sorted = [...input].sort((a, b) => a[0] - b[0]);
    const merged: Iv[] = [];
    const fr: Frame[] = [{ sorted, cur: -1, merged: [], msg: "Merge overlapping intervals. Step 1: sort by start time — then overlapping intervals are adjacent." }];
    sorted.forEach(([s, e], i) => {
      const last = merged[merged.length - 1];
      if (!last || s > last[1]) {
        merged.push([s, e]);
        fr.push({ sorted, cur: i, merged: merged.map((m) => [...m] as Iv), msg: last ? `[${s}, ${e}] starts after ${last[1]} → no overlap, start a new merged interval.` : `Take [${s}, ${e}] as the first merged interval.` });
      } else {
        const prevEnd = last[1];
        last[1] = Math.max(prevEnd, e);
        fr.push({ sorted, cur: i, merged: merged.map((m) => [...m] as Iv), msg: `[${s}, ${e}] starts at ${s} ≤ ${prevEnd} (current end) → overlap. ${e > prevEnd ? `Extend the end to ${e}.` : "It's fully contained; end stays."}`, tone: "good" });
      }
    });
    fr.push({ sorted, cur: -1, merged: merged.map((m) => [...m] as Iv), msg: `${input.length} intervals → ${merged.length} merged. O(n log n) for the sort, O(n) sweep.`, tone: "good" });
    return fr;
  }, [input]);

  const s = useStepper(frames, 900);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-line bg-[#080c19] p-4">
        <div className="text-[10px] uppercase tracking-wider text-faint">Sorted input</div>
        <div className="space-y-1">
          {f.sorted.map(([a, b], i) => (
            <div key={i} className="relative h-6">
              <div
                className="absolute h-full rounded-md border-2 px-1.5 font-mono text-[10px] leading-5 transition-all"
                style={{
                  left: `${(a / T) * 100}%`,
                  width: `${((b - a) / T) * 100}%`,
                  minWidth: 34,
                  borderColor: i === f.cur ? C.active : i < f.cur || f.cur === -1 ? C.base : C.dim,
                  background: i === f.cur ? `${C.active}33` : C.baseFill,
                  color: C.text,
                }}
              >
                {a}–{b}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 text-[10px] uppercase tracking-wider text-faint">Merged output</div>
        <div className="relative h-8">
          {f.merged.map(([a, b], i) => (
            <div
              key={i}
              className="absolute h-full rounded-md border-2 px-1.5 font-mono text-[11px] leading-7 font-semibold transition-all duration-300"
              style={{ left: `${(a / T) * 100}%`, width: `${((b - a) / T) * 100}%`, minWidth: 34, borderColor: C.done, background: `${C.done}33`, color: C.text }}
            >
              {a}–{b}
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-line pt-1 font-mono text-[10px] text-faint">
          {Array.from({ length: T / 2 + 1 }, (_, i) => (
            <span key={i}>{i * 2}</span>
          ))}
        </div>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} onShuffle={() => setInput(randomIntervals())} />
    </div>
  );
}
