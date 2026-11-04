"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat, StepControls, useStepper } from "../kit";

// Linear-scan register allocation (Poletto and Sarkar), one live interval per step: expire the
// intervals that have ended, take a free register, or spill whichever interval ends furthest away.
interface Line {
  text: string;
  def: string;
  uses: string[];
}
const PROGRAMS: Record<string, { label: string; lines: Line[] }> = {
  lesson: {
    label: "The lesson's program",
    lines: [
      { text: "a = load x", def: "a", uses: [] },
      { text: "b = load y", def: "b", uses: [] },
      { text: "c = a + b", def: "c", uses: ["a", "b"] },
      { text: "d = a * 2", def: "d", uses: ["a"] },
      { text: "e = c + d", def: "e", uses: ["c", "d"] },
      { text: "f = b - 1", def: "f", uses: ["b"] },
      { text: "g = e * f", def: "g", uses: ["e", "f"] },
      { text: "return g", def: "", uses: ["g"] },
    ],
  },
  loop: {
    label: "A busier one",
    lines: [
      { text: "i = 0", def: "i", uses: [] },
      { text: "n = load N", def: "n", uses: [] },
      { text: "s = 0", def: "s", uses: [] },
      { text: "p = load base", def: "p", uses: [] },
      { text: "t = i * 8", def: "t", uses: ["i"] },
      { text: "q = p + t", def: "q", uses: ["p", "t"] },
      { text: "v = load q", def: "v", uses: ["q"] },
      { text: "s2 = s + v", def: "s2", uses: ["s", "v"] },
      { text: "j = i + 1", def: "j", uses: ["i"] },
      { text: "c = j < n", def: "c", uses: ["j", "n"] },
      { text: "return s2, c", def: "", uses: ["s2", "c"] },
    ],
  },
};
const REG_COLORS = [C.sky, C.done, C.pivot, C.orange, C.swap, C.lime];

interface Iv {
  name: string;
  start: number;
  end: number;
}
function intervals(lines: Line[]): Iv[] {
  const out: Iv[] = [];
  lines.forEach((l, i) => {
    if (l.def) out.push({ name: l.def, start: i, end: i });
  });
  lines.forEach((l, i) => {
    for (const u of l.uses) out.find((v) => v.name === u)!.end = i; // live until the last use
  });
  return out;
}

interface Frame {
  at: number; // index of the interval being placed, -1 before the first
  where: Record<string, string>; // name -> "R1".. or "stack"
  active: string[];
  free: string[];
  msg: string;
  spilled: string[];
}

function scan(ivs: Iv[], k: number): Frame[] {
  const regs = Array.from({ length: k }, (_, i) => `R${i + 1}`);
  let free = [...regs];
  let active: Iv[] = [];
  const where: Record<string, string> = {};
  const spilled: string[] = [];
  const frames: Frame[] = [
    { at: -1, where: {}, active: [], free: [...free], spilled: [], msg: `Sort the live intervals by start and walk them in order, with ${k} register${k > 1 ? "s" : ""}. Each step places one interval.` },
  ];
  ivs.forEach((iv, idx) => {
    const gone = active.filter((a) => a.end <= iv.start);
    active = active.filter((a) => a.end > iv.start);
    gone.forEach((g) => free.push(where[g.name]));
    let msg = gone.length ? `${gone.map((g) => g.name).join(" and ")} ${gone.length > 1 ? "have" : "has"} ended by ${iv.start}: free ${gone.map((g) => where[g.name]).join(" and ")}. ` : "";
    if (free.length) {
      where[iv.name] = free[0];
      free = free.slice(1);
      msg += `${iv.name} (${iv.start}–${iv.end}) takes the free register ${where[iv.name]}.`;
      active = [...active, iv].sort((a, b) => a.end - b.end);
    } else {
      const victim = active[active.length - 1]; // ends furthest away
      const busy = active.map((a) => a.name).join(", ");
      if (victim.end > iv.end) {
        where[iv.name] = where[victim.name];
        where[victim.name] = "stack";
        spilled.push(victim.name);
        active = [...active.slice(0, -1), iv].sort((a, b) => a.end - b.end);
        msg += `No register is free. Of ${busy}, ${victim.name} ends furthest away (at ${victim.end}), later than ${iv.name} (at ${iv.end}). Spill ${victim.name} to the stack and give ${iv.name} its register, ${where[iv.name]}.`;
      } else {
        where[iv.name] = "stack";
        spilled.push(iv.name);
        msg += `No register is free, and ${iv.name} ends at ${iv.end}, later than every active interval: spill ${iv.name} itself.`;
      }
    }
    frames.push({ at: idx, where: { ...where }, active: active.map((a) => a.name), free: [...free], spilled: [...spilled], msg });
  });
  const last = frames[frames.length - 1];
  last.msg += spilled.length
    ? ` Done: ${spilled.join(", ")} live${spilled.length > 1 ? "" : "s"} on the stack, so every use costs a load and every definition a store.`
    : " Done: every variable got a register, and registers were reused as intervals ended.";
  return frames;
}

export default function RegAlloc() {
  const [prog, setProg] = useState("lesson");
  const [k, setK] = useState(2);
  const lines = PROGRAMS[prog].lines;
  const ivs = useMemo(() => intervals(lines), [lines]);
  const frames = useMemo(() => scan(ivs, k), [ivs, k]);
  const s = useStepper(frames, 1100);
  const f = s.frame;
  const pressure = Math.max(...lines.map((_, p) => ivs.filter((v) => v.start <= p && (v.end > p || v.start === p)).length));
  const cur = f.at >= 0 ? ivs[f.at] : null;
  const regColor = (r: string | undefined) => (r && r !== "stack" ? REG_COLORS[(Number(r.slice(1)) - 1) % REG_COLORS.length] : C.bad);

  const W = 640;
  const ROW = 24;
  const LEFT = 150;
  const X = (i: number) => LEFT + (i / (lines.length - 1)) * (W - LEFT - 20);
  const H = 30 + ivs.length * ROW;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <div className="flex flex-wrap items-end gap-4">
        <Segmented value={prog} onChange={setProg} options={Object.entries(PROGRAMS).map(([value, p]) => ({ value, label: p.label }))} />
        <div className="w-48">
          <Slider label="registers" value={k} min={1} max={6} onChange={setK} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        <div className="rounded-xl border border-line bg-panel p-2 font-mono text-xs">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 rounded px-1 py-0.5" style={{ background: cur && (cur.start === i || cur.end === i) ? `${C.active}14` : undefined }}>
              <span className="w-4 text-right text-faint">{i}</span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[460px]">
            {lines.map((_, i) => (
              <g key={i}>
                <line x1={X(i)} x2={X(i)} y1={16} y2={H - 4} stroke="#eef2f7" />
                <text x={X(i)} y={12} fontSize={9} textAnchor="middle" fill={C.faint}>
                  {i}
                </text>
              </g>
            ))}
            {cur && <line x1={X(cur.start)} x2={X(cur.start)} y1={16} y2={H - 4} stroke={C.active} strokeDasharray="4 3" />}
            {ivs.map((v, i) => {
              const placed = f.where[v.name];
              const y = 28 + i * ROW;
              const color = placed ? regColor(placed) : C.base;
              return (
                <g key={v.name}>
                  <text x={12} y={y + 4} fontSize={12} fontFamily="monospace" fill={C.text} fontWeight={cur?.name === v.name ? 700 : 400}>
                    {v.name}
                  </text>
                  <text x={52} y={y + 4} fontSize={10} fontFamily="monospace" fill={placed ? color : C.faint}>
                    {placed ?? "?"}
                  </text>
                  <rect
                    x={X(v.start) - 5}
                    y={y - 7}
                    width={Math.max(10, X(v.end) - X(v.start) + 10)}
                    height={14}
                    rx={7}
                    fill={placed ? (placed === "stack" ? `${C.bad}26` : `${color}40`) : "#f1f5f9"}
                    stroke={placed ? color : C.base}
                    strokeDasharray={placed === "stack" ? "4 3" : undefined}
                    strokeWidth={cur?.name === v.name ? 2.4 : 1.2}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: k }, (_, i) => `R${i + 1}`).map((r) => {
          const holder = f.active.find((n) => f.where[n] === r);
          return (
            <div key={r} className="min-w-20 rounded-xl border px-3 py-1.5 font-mono text-xs" style={{ borderColor: regColor(r), background: holder ? `${regColor(r)}1f` : undefined }}>
              <span className="font-semibold" style={{ color: regColor(r) }}>
                {r}
              </span>{" "}
              {holder ?? <span className="text-faint">free</span>}
            </div>
          );
        })}
        <div className="rounded-xl border border-dashed px-3 py-1.5 font-mono text-xs" style={{ borderColor: C.bad }}>
          <span className="font-semibold" style={{ color: C.bad }}>
            stack
          </span>{" "}
          {f.spilled.length ? f.spilled.join(", ") : <span className="text-faint">empty</span>}
        </div>
      </div>

      <Narration tone={s.atEnd ? (f.spilled.length ? "warn" : "good") : "info"}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="flex flex-wrap gap-3">
        <Stat label="register pressure" value={pressure} color={C.compare} />
        <Stat label="spilled" value={f.spilled.length} color={f.spilled.length ? C.bad : C.done} />
      </div>
      <p className="text-xs text-faint">
        Register pressure is the most variables live at once. With at least that many registers nothing spills; with fewer, something must live in memory.
      </p>
    </div>
  );
}
