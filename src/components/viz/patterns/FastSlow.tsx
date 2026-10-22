"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, Stat, StepControls, useStepper } from "../kit";

interface Frame {
  slow: number;
  fast: number;
  phase: 1 | 2 | 3;
  msg: string;
  tone?: "info" | "good";
}

export default function FastSlow() {
  const [tail, setTail] = useState(3);
  const [cycle, setCycle] = useState(6);
  const n = tail + cycle;
  const next = (i: number) => (i + 1 < n ? i + 1 : tail);

  const frames = useMemo<Frame[]>(() => {
    const fr: Frame[] = [];
    let slow = 0;
    let fast = 0;
    fr.push({ slow, fast, phase: 1, msg: `A list of ${n} nodes whose last node points back to node ${tail}. Slow moves 1 step, fast moves 2.` });
    let steps = 0;
    do {
      slow = next(slow);
      fast = next(next(fast));
      steps++;
      fr.push({ slow, fast, phase: 1, msg: slow === fast ? `They meet at node ${slow} after ${steps} steps → there IS a cycle (fast would have hit null otherwise).` : `Step ${steps}: slow → ${slow}, fast → ${fast}. Inside the cycle the gap closes by 1 each step.`, tone: slow === fast ? "good" : "info" });
    } while (slow !== fast && steps < 60);
    slow = 0;
    fr.push({ slow, fast, phase: 2, msg: "Phase 2: move slow back to the head. Now advance BOTH one step at a time." });
    while (slow !== fast) {
      slow = next(slow);
      fast = next(fast);
      fr.push({ slow, fast, phase: 2, msg: slow === fast ? `They meet at node ${slow}: the start of the cycle. (head→start distance = meeting point→start distance, mod cycle length.)` : `slow → ${slow}, fast → ${fast}.`, tone: slow === fast ? "good" : "info" });
    }
    fr.push({ slow, fast, phase: 3, msg: `Cycle starts at node ${slow}, length ${cycle}. O(n) time, O(1) space — no hash set needed.`, tone: "good" });
    return fr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tail, cycle]);

  const s = useStepper(frames, 750);
  const f = s.frame;

  // layout: tail along a line, cycle on a circle
  const R = 34 + cycle * 9;
  const cx = 70 + tail * 70 + R;
  const cy = 130;
  const pos = (i: number) => {
    if (i < tail) return { x: 50 + i * 70, y: cy };
    const k = i - tail;
    const ang = Math.PI + (2 * Math.PI * k) / cycle;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  };
  const W = cx + R + 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Slider label="nodes before the cycle" value={tail} min={0} max={6} onChange={setTail} />
        </div>
        <div className="w-48">
          <Slider label="cycle length" value={cycle} min={3} max={10} onChange={setCycle} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
        <svg width={W} height={cy * 2} className="block">
          <defs>
            <marker id="fs-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {Array.from({ length: n }, (_, i) => {
            const a = pos(i);
            const b = pos(next(i));
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            return <line key={i} x1={a.x + (dx / len) * 19} y1={a.y + (dy / len) * 19} x2={b.x - (dx / len) * 21} y2={b.y - (dy / len) * 21} stroke={i === n - 1 ? C.pivot : C.base} strokeWidth={1.8} markerEnd="url(#fs-arrow)" />;
          })}
          {Array.from({ length: n }, (_, i) => {
            const p = pos(i);
            const isS = f.slow === i;
            const isF = f.fast === i;
            const color = isS && isF ? C.done : isS ? C.compare : isF ? C.swap : i === tail ? C.pivot : C.base;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={17} fill={`${color}24`} stroke={color} strokeWidth={2} style={isS || isF ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined} />
                <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="bold" fill={C.text} fontFamily="monospace">
                  {i}
                </text>
                {isS && (
                  <text x={p.x} y={p.y - 25} textAnchor="middle" fontSize="15">
                    🐢
                  </text>
                )}
                {isF && (
                  <text x={p.x + (isS ? 16 : 0)} y={p.y + 36} textAnchor="middle" fontSize="15">
                    🐇
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="phase" value={f.phase === 1 ? "detect" : f.phase === 2 ? "find start" : "done"} color={C.active} />
        <Stat label="🐢 slow at" value={f.slow} color={C.compare} />
        <Stat label="🐇 fast at" value={f.fast} color={C.swap} />
      </div>
    </div>
  );
}
