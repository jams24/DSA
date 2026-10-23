"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Slider, Stat } from "../kit";

const NS = [1, 2, 4, 8, 16, 32, 64];
const TRIALS = 3000;

/** Monte Carlo accuracy of majority voting over n samples. Wrong answers are spread over `spread` distinct values. */
function majority(p: number, spread: number, n: number, seed: number): number {
  const rand = mulberry32(seed);
  let wins = 0;
  const counts = new Array(spread + 1);
  for (let t = 0; t < TRIALS; t++) {
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      if (rand() < p) counts[0]++;
      else counts[1 + Math.floor(rand() * spread)]++;
    }
    let best = 0;
    for (let a = 1; a <= spread; a++) if (counts[a] > best) best = counts[a];
    if (counts[0] > best) wins++;
    else if (counts[0] === best) {
      const tied = 1 + counts.slice(1).filter((c: number) => c === best).length;
      if (rand() < 1 / tied) wins++;
    }
  }
  return wins / TRIALS;
}

export default function Reasoning() {
  const [p, setP] = useState(0.45);
  const [spread, setSpread] = useState(4);
  const [verifier, setVerifier] = useState(0.9);
  const [n, setN] = useState(16);
  const vote = useMemo(() => NS.map((k) => majority(p, spread, k, 17 + k)), [p, spread]);
  const passAt = (k: number) => 1 - Math.pow(1 - p, k);
  // a verifier that recognises a correct candidate with probability `verifier` (and otherwise picks a wrong one)
  const best = (k: number) => passAt(k) * verifier;
  const idx = NS.indexOf(n);

  const W = 640;
  const H = 230;
  const x = (k: number) => 50 + (Math.log2(k) / 6) * (W - 80);
  const y = (v: number) => H - 26 - v * (H - 44);
  const line = (vals: number[]) => NS.map((k, i) => `${x(k)},${y(vals[i])}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Slider label="Chance one sample is correct" value={p} min={0.1} max={0.9} step={0.05} onChange={setP} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Distinct wrong answers (1 = errors all agree)" value={spread} min={1} max={10} onChange={setSpread} />
        <Slider label="Verifier / reward model accuracy" value={verifier} min={0.5} max={1} step={0.05} onChange={setVerifier} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Samples per question (N)" value={idx} min={0} max={NS.length - 1} onChange={(i) => setN(NS[i])} format={(i) => `N = ${NS[i]}`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={50} x2={W - 24} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
              <text x={44} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
                {v * 100}%
              </text>
            </g>
          ))}
          <polyline points={line(NS.map(passAt))} fill="none" stroke={C.faint} strokeDasharray="4 4" strokeWidth={1.4} />
          <polyline points={line(NS.map(() => p))} fill="none" stroke={C.muted} strokeWidth={1.6} />
          <polyline points={line(vote)} fill="none" stroke={C.pivot} strokeWidth={2.2} />
          <polyline points={line(NS.map(best))} fill="none" stroke={C.done} strokeWidth={2.2} />
          <line x1={x(n)} x2={x(n)} y1={14} y2={H - 26} stroke={C.text} strokeDasharray="3 3" />
          {NS.map((k) => (
            <text key={k} x={x(k)} y={H - 10} textAnchor="middle" fontSize="9" fill={C.faint}>
              {k}
            </text>
          ))}
          <text x={56} y={16} fontSize="10" fill={C.pivot}>
            ━ majority vote
          </text>
          <text x={150} y={16} fontSize="10" fill={C.done}>
            ━ best-of-N + verifier
          </text>
          <text x={290} y={16} fontSize="10" fill={C.faint}>
            ┅ pass@N (any correct)
          </text>
          <text x={430} y={16} fontSize="10" fill={C.muted}>
            ━ single sample
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="single sample" value={`${Math.round(p * 100)}%`} />
        <Stat label={`majority of ${n}`} value={`${Math.round(vote[idx] * 100)}%`} color={C.pivot} />
        <Stat label={`best of ${n} + verifier`} value={`${Math.round(best(n) * 100)}%`} color={C.done} />
        <Stat label="compute cost" value={`${n}×`} color={C.compare} />
      </div>
      <Narration tone={vote[idx] < p ? "bad" : "info"}>
        {spread === 1 && p < 0.5
          ? "When every wrong sample gives the same wrong answer (a systematic misconception), voting amplifies the error: more samples make it worse."
          : `Majority voting (self-consistency) works when correct reasoning paths agree and wrong ones scatter. Even at ${Math.round(p * 100)}% per sample, the plurality answer is usually right.`}{" "}
        A verifier (unit tests, a proof checker, a reward model) can beat voting because it only needs one correct sample, up to the pass@N ceiling. Reasoning models get much of this gain inside one long chain of thought: RL on verifiable rewards teaches them to explore, check and backtrack, and a thinking budget sets how much test-time compute they spend.
      </Narration>
    </div>
  );
}
