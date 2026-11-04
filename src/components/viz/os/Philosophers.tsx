"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

// Five philosophers, five forks. Philosopher i needs fork i (left) and fork i+1 (right).
// Naive: everyone takes the left fork first -> circular wait -> deadlock.
// Ordered: always take the lower-numbered fork first. Waiter: at most 4 may hold forks at once.
type Mode = "naive" | "ordered" | "waiter";
type PState = "thinking" | "hungry" | "one" | "eating" | "full";
interface Phil {
  state: PState;
  meals: number;
  eatLeft: number;
  rest: number;
  waitingFor: number | null;
  waiterSaidNo: boolean;
}
interface Frame {
  phils: Phil[];
  forks: (number | null)[];
  actor: number | null;
  note: string;
  tone: "info" | "good" | "bad" | "warn";
  deadlock: boolean;
}
const N = 5;
const MEALS = 2;
const COLORS = [C.active, C.pivot, C.compare, C.swap, C.lime];

const forksOf = (i: number, mode: Mode): [number, number] => {
  const left = i;
  const right = (i + 1) % N;
  return mode === "ordered" ? [Math.min(left, right), Math.max(left, right)] : [left, right];
};
const side = (i: number, f: number) => (f === i ? "left" : "right");

function simulate(mode: Mode): Frame[] {
  const phils: Phil[] = Array.from({ length: N }, () => ({ state: "thinking", meals: 0, eatLeft: 0, rest: 0, waitingFor: null, waiterSaidNo: false }));
  const forks: (number | null)[] = Array(N).fill(null);
  const frames: Frame[] = [];
  const snap = (actor: number | null, note: string, tone: Frame["tone"] = "info", deadlock = false) =>
    frames.push({ phils: phils.map((p) => ({ ...p })), forks: [...forks], actor, note, tone, deadlock });
  snap(
    null,
    mode === "naive"
      ? "Five philosophers, five forks. Rule: pick up your LEFT fork, then your RIGHT fork, then eat. Each eats 2 meals. What could go wrong?"
      : mode === "ordered"
        ? "Same table, new rule: always pick up the LOWER-numbered fork first. For philosophers 0 to 3 that's still the left fork, but philosopher 4 must reach for fork 0 before fork 4."
        : "Same table, but a waiter now stands by: at most 4 philosophers may hold forks at once. With 5 forks and 4 people, someone can always get two.",
  );
  for (let round = 0; round < 60; round++) {
    let changed = false;
    for (let i = 0; i < N; i++) {
      const p = phils[i];
      const [first, second] = forksOf(i, mode);
      if (p.state === "full") continue;
      if (p.state === "thinking") {
        if (p.rest > 0) {
          p.rest--;
          changed = true;
          continue;
        }
        p.state = "hungry";
        changed = true;
        snap(i, `P${i} gets hungry 😋 and wants forks ${first} and ${second}.`);
      } else if (p.state === "hungry") {
        const holding = phils.filter((q) => q.state === "one" || q.state === "eating").length;
        if (mode === "waiter" && holding >= N - 1) {
          if (!p.waiterSaidNo) {
            p.waiterSaidNo = true;
            changed = true;
            snap(i, `P${i} wants to pick up a fork, but the waiter says "wait": 4 philosophers already hold forks.`, "warn");
          }
          continue;
        }
        p.waiterSaidNo = false;
        if (forks[first] === null) {
          forks[first] = i;
          p.state = "one";
          p.waitingFor = null;
          changed = true;
          snap(i, `P${i} picks up fork ${first} (${side(i, first)}).${mode === "ordered" && i === N - 1 ? " Lower number first: that's the RIGHT fork for P4." : ""}`);
        } else if (p.waitingFor !== first) {
          p.waitingFor = first;
          changed = true;
          snap(i, `P${i} reaches for fork ${first}, but P${forks[first]} has it. P${i} waits, holding nothing, which is harmless.`, "warn");
        }
      } else if (p.state === "one") {
        if (forks[second] === null) {
          forks[second] = i;
          p.state = "eating";
          p.eatLeft = 2;
          p.waitingFor = null;
          changed = true;
          snap(i, `P${i} picks up fork ${second} too and starts eating 🍝 (meal ${p.meals + 1}).`, "good");
        } else if (p.waitingFor !== second) {
          p.waitingFor = second;
          changed = true;
          snap(i, `P${i} holds fork ${first} and waits for fork ${second}, which P${forks[second]} is holding.`, "warn");
        }
      } else if (p.state === "eating") {
        p.eatLeft--;
        changed = true;
        if (p.eatLeft === 0) {
          forks[first] = null;
          forks[second] = null;
          p.meals++;
          p.state = p.meals >= MEALS ? "full" : "thinking";
          p.rest = 1;
          snap(i, `P${i} finishes meal ${p.meals} and puts both forks down.${p.state === "full" ? " P" + i + " is full 😊." : " Back to thinking 🤔."}`, "good");
        }
      }
    }
    if (phils.every((p) => p.state === "full")) {
      snap(null, `Everyone ate ${MEALS} meals. No deadlock: ${mode === "ordered" ? "with a global fork order, a circle of waiting can't form." : "the waiter never let all five hold one fork each."}`, "good");
      return frames;
    }
    if (!changed) {
      snap(
        null,
        "DEADLOCK 💀 Every philosopher holds one fork and waits for the next one, held by their neighbour: P0 → P1 → P2 → P3 → P4 → P0. All four Coffman conditions hold, and nobody will ever eat again.",
        "bad",
        true,
      );
      return frames;
    }
  }
  return frames;
}

const FACE: Record<PState, string> = { thinking: "🤔", hungry: "😋", one: "✋", eating: "🍝", full: "😊" };
const cx = 180;
const cy = 168;
const at = (deg: number, r: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
const philAngle = (i: number) => -90 + i * 72;
// fork i sits between philosopher i-1 and philosopher i
// shortest signed rotation from angle a to angle b, in degrees
const turn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
const forkAngle = (f: number) => -90 + f * 72 - 36;

export default function Philosophers() {
  const [mode, setMode] = useState<Mode>("naive");
  const frames = useMemo(() => simulate(mode), [mode]);
  const s = useStepper(frames, 900);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "naive", label: "Left fork first" },
          { value: "ordered", label: "Lowest fork first" },
          { value: "waiter", label: "A waiter (max 4)" },
        ]}
      />
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,360px)_1fr]">
        <svg viewBox="0 0 360 310" className="mx-auto w-full max-w-[360px]">
          <defs>
            <marker id="ph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={f.deadlock ? C.bad : C.compare} />
            </marker>
          </defs>
          <circle cx={cx} cy={cy} r={78} fill="#fef3c7" stroke="#d97706" strokeWidth={2} />
          <text x={cx} y={cy + 6} textAnchor="middle" fontSize={22}>
            🍝
          </text>
          {/* wait-for arrows: philosopher -> neighbour holding the fork they want */}
          {f.phils.map((p, i) => {
            if (p.waitingFor === null || p.state === "eating") return null;
            const holder = f.forks[p.waitingFor];
            if (holder === null || holder === i) return null;
            const a = at(philAngle(i), 112);
            const b = at(philAngle(holder), 112);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const k = 0.82;
            return (
              <line
                key={`w${i}`}
                x1={a.x + (mx - a.x) * 0.25}
                y1={a.y + (my - a.y) * 0.25}
                x2={a.x + (b.x - a.x) * k}
                y2={a.y + (b.y - a.y) * k}
                stroke={f.deadlock ? C.bad : C.compare}
                strokeWidth={2.5}
                strokeDasharray={f.deadlock ? undefined : "4 3"}
                markerEnd="url(#ph-arrow)"
              />
            );
          })}
          {f.forks.map((holder, k) => {
            // a held fork slides toward its holder
            const base = forkAngle(k);
            const deg = holder === null ? base : base + turn(base, philAngle(holder)) * 0.45;
            const inner = at(deg, holder === null ? 52 : 82);
            const outer = at(deg, holder === null ? 74 : 104);
            const color = holder === null ? C.muted : COLORS[holder];
            const label = at(deg, holder === null ? 42 : 72);
            return (
              <g key={`f${k}`}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={5} strokeLinecap="round" />
                <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
                  {k}
                </text>
              </g>
            );
          })}
          {f.phils.map((p, i) => {
            const c = at(philAngle(i), 125);
            const hot = f.actor === i;
            return (
              <g key={`p${i}`}>
                <circle cx={c.x} cy={c.y} r={24} fill="#ffffff" stroke={hot ? C.text : COLORS[i]} strokeWidth={hot ? 3.5 : 2.5} />
                <text x={c.x} y={c.y + 7} textAnchor="middle" fontSize={20}>
                  {p.waitingFor !== null && p.state !== "eating" ? "⏳" : FACE[p.state]}
                </text>
                <text x={c.x} y={c.y - 28} textAnchor="middle" fontSize={10} fontWeight={700} fill={COLORS[i]}>
                  P{i} · {p.meals}/{MEALS}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="space-y-3">
          <Narration tone={f.tone}>{f.note}</Narration>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="meals eaten" value={`${f.phils.reduce((x, p) => x + p.meals, 0)} / ${N * MEALS}`} color={C.done} />
            <Stat label="eating now" value={f.phils.filter((p) => p.state === "eating").length} color={C.active} />
            <Stat label="waiting" value={f.phils.filter((p) => p.waitingFor !== null && p.state !== "eating").length} color={f.deadlock ? C.bad : C.compare} />
          </div>
          <div className="text-xs text-faint">
            🤔 thinking · 😋 hungry · ✋ holds one fork · 🍝 eating · ⏳ waiting · 😊 full. Dashed arrows show who is waiting for whom; a closed red loop is a deadlock.
          </div>
        </div>
      </div>
      <StepControls s={s} />
    </div>
  );
}
