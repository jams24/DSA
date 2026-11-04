"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, SmallBtn, StepControls, TextInput, parseNums, useStepper } from "../kit";

// Disk-arm scheduling: the head's path across cylinders 0..199 for six classic algorithms.
type Algo = "fcfs" | "sstf" | "scan" | "cscan" | "look" | "clook";
const MAX = 199;
const ALGOS: { value: Algo; label: string; idea: string }[] = [
  { value: "fcfs", label: "FCFS", idea: "serve requests in arrival order" },
  { value: "sstf", label: "SSTF", idea: "always go to the closest request" },
  { value: "scan", label: "SCAN", idea: "sweep up to the edge, then back down (a lift)" },
  { value: "cscan", label: "C-SCAN", idea: "sweep up to the edge, jump to 0, sweep up again" },
  { value: "look", label: "LOOK", idea: "like SCAN, but turn around at the last request" },
  { value: "clook", label: "C-LOOK", idea: "like C-SCAN, but jump from the last request to the lowest" },
];
const DEFAULT = "98 183 37 122 14 124 65 67";

// each stop: the cylinder, and whether it serves a request (edges and jumps don't)
function plan(q: number[], h: number, algo: Algo): { c: number; serves: boolean }[] {
  const up = q.filter((c) => c >= h).sort((a, b) => a - b);
  const down = q.filter((c) => c < h).sort((a, b) => b - a);
  const S = (cs: number[]) => cs.map((c) => ({ c, serves: true }));
  switch (algo) {
    case "fcfs":
      return S(q);
    case "sstf": {
      const left = [...q];
      const out: number[] = [];
      let at = h;
      while (left.length) {
        const nxt = left.reduce((a, b) => (Math.abs(b - at) < Math.abs(a - at) ? b : a));
        out.push(nxt);
        left.splice(left.indexOf(nxt), 1);
        at = nxt;
      }
      return S(out);
    }
    case "scan":
      return [...S(up), ...(down.length ? [{ c: MAX, serves: false }] : []), ...S(down)];
    case "cscan":
      return [...S(up), ...(down.length ? [{ c: MAX, serves: false }, { c: 0, serves: false }] : []), ...S([...down].reverse())];
    case "look":
      return [...S(up), ...S(down)];
    case "clook":
      return [...S(up), ...S([...down].reverse())];
  }
}
const total = (h: number, stops: { c: number }[]) => stops.reduce((acc, s, i) => acc + Math.abs(s.c - (i ? stops[i - 1].c : h)), 0);

export default function DiskArm() {
  const [algo, setAlgo] = useState<Algo>("sstf");
  const [text, setText] = useState(DEFAULT);
  const [head, setHead] = useState(53);
  const queue = useMemo(() => (parseNums(text, 12) ?? parseNums(DEFAULT)!).map((n) => Math.max(0, Math.min(MAX, n))), [text]);
  const stops = useMemo(() => plan(queue, head, algo), [queue, head, algo]);
  const frames = useMemo(() => Array.from({ length: stops.length + 1 }, (_, i) => i), [stops]);
  const s = useStepper(frames, 650);
  const k = s.frame; // stops taken so far
  const moved = total(head, stops.slice(0, k));
  const compare = useMemo(() => ALGOS.map((a) => ({ ...a, t: total(head, plan(queue, head, a.value)) })), [queue, head]);
  const best = Math.min(...compare.map((c) => c.t));
  const W = 600;
  const X = (c: number) => 20 + (c / MAX) * (W - 40);
  const rowH = 26;
  const H = 50 + stops.length * rowH;
  const pts = [{ c: head, serves: false }, ...stops].slice(0, k + 1).map((p, i) => `${X(p.c)},${40 + i * rowH}`);
  const served = new Set(stops.slice(0, k).filter((p) => p.serves).map((p) => p.c));
  const last = k > 0 ? stops[k - 1] : null;
  const info = ALGOS.find((a) => a.value === algo)!;

  return (
    <div className="space-y-4">
      <Segmented value={algo} onChange={setAlgo} options={ALGOS.map(({ value, label }) => ({ value, label }))} />
      <div className="flex flex-wrap items-end gap-3">
        <TextInput value={text} onChange={setText} width="w-64" placeholder="cylinders 0-199" />
        <SmallBtn onClick={() => setText(DEFAULT)}>Textbook queue</SmallBtn>
        <div className="w-44">
          <Slider label="head starts at" value={head} min={0} max={MAX} onChange={setHead} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]">
          <line x1={X(0)} x2={X(MAX)} y1={22} y2={22} stroke={C.base} strokeWidth={2} />
          {[0, 50, 100, 150, 199].map((c) => (
            <text key={c} x={X(c)} y={14} fontSize={9} textAnchor="middle" fill={C.faint}>
              {c}
            </text>
          ))}
          {queue.map((c, i) => (
            <g key={i}>
              <line x1={X(c)} x2={X(c)} y1={22} y2={H - 6} stroke={served.has(c) ? `${C.done}33` : "#e2e8f0"} strokeDasharray="2 3" />
              <circle cx={X(c)} cy={22} r={4.5} fill={served.has(c) ? C.done : C.compare} />
            </g>
          ))}
          <polyline points={pts.join(" ")} fill="none" stroke={C.active} strokeWidth={2.5} strokeLinejoin="round" />
          {[{ c: head, serves: false }, ...stops].slice(0, k + 1).map((p, i) => (
            <g key={i}>
              <circle cx={X(p.c)} cy={40 + i * rowH} r={i === k ? 6 : 3.5} fill={i === 0 ? C.pivot : p.serves ? C.active : C.faint} />
              <text x={X(p.c) + (p.c > 170 ? -8 : 8)} y={44 + i * rowH} fontSize={10} textAnchor={p.c > 170 ? "end" : "start"} fill={C.text}>
                {p.c}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <Narration tone={s.atEnd ? "good" : "info"}>
        {k === 0
          ? `${info.label}: ${info.idea}. The head starts at ${head}; orange dots are waiting requests.`
          : s.atEnd
            ? `Done: the head moved ${moved} cylinders in total with ${info.label}.`
            : `Move ${Math.abs(last!.c - (k > 1 ? stops[k - 2].c : head))} cylinders to ${last!.c}${last!.serves ? " and serve that request" : last!.c === 0 ? ": jump back to the start (no requests served on the way)" : ": the edge of the disk, then turn"}. Total so far: ${moved}.`}
      </Narration>
      <StepControls s={s} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {compare.map((c) => (
          <div key={c.value} className="rounded-xl border px-2.5 py-1.5" style={{ borderColor: c.value === algo ? C.active : C.dim }}>
            <div className="text-[10px] tracking-wider text-faint uppercase">{c.label}</div>
            <div className="font-mono text-base font-semibold" style={{ color: c.t === best ? C.done : C.text }}>
              {c.t}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
