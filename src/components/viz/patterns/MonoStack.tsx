"use client";

import { useMemo, useState } from "react";
import { C, Narration, StepControls, randomInts, useStepper } from "../kit";

interface Frame {
  i: number;
  stack: number[];
  ans: (number | null)[];
  popped?: number;
  msg: string;
  tone?: "info" | "good";
}

export default function MonoStack() {
  const [temps, setTemps] = useState([73, 74, 75, 71, 69, 72, 76, 73]);

  const frames = useMemo<Frame[]>(() => {
    const n = temps.length;
    const ans: (number | null)[] = Array(n).fill(null);
    const st: number[] = [];
    const fr: Frame[] = [{ i: -1, stack: [], ans: [...ans], msg: "Daily Temperatures: for each day, how many days until a warmer one? Keep a stack of indices whose temperatures are DECREASING — days still waiting for an answer." }];
    for (let i = 0; i < n; i++) {
      fr.push({ i, stack: [...st], ans: [...ans], msg: `Day ${i}: ${temps[i]}°.` });
      while (st.length && temps[st[st.length - 1]] < temps[i]) {
        const j = st.pop()!;
        ans[j] = i - j;
        fr.push({ i, stack: [...st], ans: [...ans], popped: j, msg: `${temps[i]}° > ${temps[j]}° (day ${j}) → day ${j}'s answer is ${i} − ${j} = ${i - j}. Pop it.`, tone: "good" });
      }
      st.push(i);
      fr.push({ i, stack: [...st], ans: [...ans], msg: `Push day ${i}. The stack stays decreasing from bottom to top.` });
    }
    for (const j of st) ans[j] = 0;
    fr.push({ i: n, stack: [], ans: [...ans], msg: "Days left on the stack never see a warmer day → 0. Each index is pushed and popped at most once: O(n).", tone: "good" });
    return fr;
  }, [temps]);

  const s = useStepper(frames, 750);
  const f = s.frame;
  const max = Math.max(...temps);
  const min = Math.min(...temps) - 4;
  const onStack = new Set(f.stack);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="flex h-48 items-end gap-2">
          {temps.map((t, i) => {
            const color = i === f.i ? C.active : i === f.popped ? C.done : onStack.has(i) ? C.compare : i < f.i ? C.dim : C.base;
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                <span className="mb-1 font-mono text-[10px] text-dim">{t}°</span>
                <div className="w-full max-w-10 rounded-t-md transition-all" style={{ height: `${((t - min) / (max - min)) * 100}%`, background: color, boxShadow: color === C.active || color === C.done ? `0 0 10px ${color}` : undefined }} />
                <span className="mt-1 font-mono text-[10px] text-faint">d{i}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Stack (top ↑)</div>
          <div className="flex min-h-24 flex-col-reverse gap-1">
            {f.stack.map((j) => (
              <div key={j} className="rounded-md border border-amber/40 bg-amber/10 px-2 py-1 text-center font-mono text-xs text-amber">
                d{j} · {temps[j]}°
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">answer[]: days to wait</div>
          <div className="flex flex-wrap gap-1.5">
            {f.ans.map((a, i) => (
              <div key={i} className="grid h-10 w-10 place-items-center rounded-md border-2 font-mono text-sm" style={{ borderColor: a === null ? C.dim : C.done, color: a === null ? C.faint : C.done }}>
                {a ?? "?"}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} onShuffle={() => setTemps(randomInts(9, 60, 90))} />
    </div>
  );
}
