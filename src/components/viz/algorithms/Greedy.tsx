"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

type Rule = "end" | "start" | "short";

interface Iv {
  id: number;
  s: number;
  e: number;
}

interface Frame {
  order: number[];
  cur?: number;
  chosen: number[];
  rejected: number[];
  lastEnd: number;
  msg: string;
  tone?: "info" | "good" | "bad";
}

const SEED: Iv[] = [
  { id: 0, s: 0, e: 10 },
  { id: 1, s: 1, e: 4 },
  { id: 2, s: 3, e: 5 },
  { id: 3, s: 4, e: 7 },
  { id: 4, s: 6, e: 9 },
  { id: 5, s: 8, e: 11 },
  { id: 6, s: 10, e: 13 },
  { id: 7, s: 12, e: 14 },
  { id: 8, s: 13, e: 16 },
];
const T = 16;

function run(ivs: Iv[], rule: Rule): Frame[] {
  const sorted = [...ivs].sort((a, b) => (rule === "end" ? a.e - b.e : rule === "start" ? a.s - b.s : a.e - a.s - (b.e - b.s) || a.s - b.s));
  const order = sorted.map((i) => i.id);
  const label = { end: "earliest END time", start: "earliest START time", short: "SHORTEST duration" }[rule];
  const fr: Frame[] = [{ order, chosen: [], rejected: [], lastEnd: -Infinity, msg: `Greedy rule: sort meetings by ${label}, then take each one that doesn't overlap what we already took.` }];
  const chosen: Iv[] = [];
  const rejected: number[] = [];
  for (const iv of sorted) {
    const ok = chosen.every((c) => iv.e <= c.s || iv.s >= c.e);
    if (ok) chosen.push(iv);
    else rejected.push(iv.id);
    fr.push({
      order,
      cur: iv.id,
      chosen: chosen.map((c) => c.id),
      rejected: [...rejected],
      lastEnd: Math.max(...chosen.map((c) => c.e)),
      msg: ok ? `[${iv.s}, ${iv.e}) fits → take it.` : `[${iv.s}, ${iv.e}) overlaps a chosen meeting → skip.`,
      tone: ok ? "good" : "bad",
    });
  }
  const verdict =
    rule === "end"
      ? `${chosen.length} meetings — optimal. Finishing earliest always leaves the most room for the rest (exchange argument). O(n log n).`
      : `${chosen.length} meetings. Compare with "earliest end" — this rule can be fooled by one long early meeting${rule === "short" ? " or a short meeting that blocks two others" : ""}.`;
  fr.push({ order, chosen: chosen.map((c) => c.id), rejected, lastEnd: 0, msg: verdict, tone: rule === "end" ? "good" : "info" });
  return fr;
}

export default function Greedy() {
  const [rule, setRule] = useState<Rule>("end");
  const frames = useMemo(() => run(SEED, rule), [rule]);
  const s = useStepper(frames, 800);
  const f = s.frame;
  const optimal = useMemo(() => run(SEED, "end").at(-1)!.chosen.length, []);

  return (
    <div className="space-y-4">
      <Segmented
        value={rule}
        onChange={setRule}
        options={[
          { value: "end", label: "Sort by end time ✓" },
          { value: "start", label: "Sort by start time" },
          { value: "short", label: "Shortest first" },
        ]}
      />
      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="relative space-y-1.5">
          {f.order.map((id) => {
            const iv = SEED[id];
            const chosen = f.chosen.includes(id);
            const rejected = f.rejected.includes(id);
            const isCur = f.cur === id;
            const color = chosen ? C.done : rejected ? C.bad : isCur ? C.active : C.base;
            return (
              <div key={id} className="relative h-7">
                <div
                  className="absolute h-full rounded-md border-2 px-2 font-mono text-[11px] leading-6 transition-all duration-300"
                  style={{
                    left: `${(iv.s / T) * 100}%`,
                    width: `${((iv.e - iv.s) / T) * 100}%`,
                    borderColor: color,
                    background: `${color}${chosen ? "55" : "22"}`,
                    color: rejected ? C.faint : C.text,
                    opacity: rejected ? 0.5 : 1,
                    boxShadow: isCur ? `0 0 12px ${color}` : undefined,
                  }}
                >
                  {iv.s}–{iv.e}
                </div>
              </div>
            );
          })}
          <div className="mt-2 flex justify-between border-t border-line pt-1 font-mono text-[10px] text-faint">
            {Array.from({ length: T / 2 + 1 }, (_, i) => (
              <span key={i}>{i * 2}</span>
            ))}
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="meetings chosen" value={f.chosen.length} color={C.done} />
        <Stat label="optimal answer" value={optimal} color={C.pivot} />
      </div>
    </div>
  );
}
