"use client";

import { useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

function PassK() {
  const [p, setP] = useState(0.7);
  const [k, setK] = useState(8);
  const at = (n: number) => 1 - Math.pow(1 - p, n);
  const all = (n: number) => Math.pow(p, n);
  const W = 640;
  const H = 210;
  const x = (n: number) => 46 + ((n - 1) / 19) * (W - 70);
  const y = (v: number) => H - 26 - v * (H - 44);
  const pts = (f: (n: number) => number) => Array.from({ length: 20 }, (_, i) => `${x(i + 1)},${y(f(i + 1))}`).join(" ");
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Slider label="Success rate of one attempt" value={p} min={0.05} max={0.99} step={0.01} onChange={setP} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Attempts (k)" value={k} min={1} max={20} onChange={setK} />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={46} x2={W - 24} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
              <text x={40} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
                {v * 100}%
              </text>
            </g>
          ))}
          <polyline points={pts(at)} fill="none" stroke={C.done} strokeWidth={2.2} />
          <polyline points={pts(all)} fill="none" stroke={C.bad} strokeWidth={2.2} />
          <line x1={x(k)} x2={x(k)} y1={14} y2={H - 26} stroke={C.text} strokeDasharray="3 3" />
          {[1, 5, 10, 15, 20].map((n) => (
            <text key={n} x={x(n)} y={H - 10} textAnchor="middle" fontSize="9" fill={C.faint}>
              k={n}
            </text>
          ))}
          <text x={52} y={16} fontSize="10" fill={C.done}>
            ━ pass@k: at least one of k succeeds
          </text>
          <text x={290} y={16} fontSize="10" fill={C.bad}>
            ━ pass^k: all k succeed
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="one attempt" value={`${Math.round(p * 100)}%`} />
        <Stat label={`pass@${k}`} value={`${(at(k) * 100).toFixed(1)}%`} color={C.done} />
        <Stat label={`pass^${k}`} value={`${(all(k) * 100).toFixed(1)}%`} color={C.bad} />
      </div>
      <Narration tone={all(k) < 0.3 ? "warn" : "info"}>
        Pick the metric that matches how the product is used. A coding assistant that can retry until the tests pass cares about <b>pass@k</b>. A customer-service agent that talks to {k} different customers needs to get it right every time, so it cares about <b>pass^k</b> (τ-bench popularised this). At {Math.round(p * 100)}% per attempt, the same agent looks {(at(k) * 100).toFixed(0)}% reliable or {(all(k) * 100).toFixed(0)}% reliable depending on which you report.
      </Narration>
    </div>
  );
}

function Noise() {
  const [n, setN] = useState(500);
  const [a, setA] = useState(0.7);
  const [b, setB] = useState(0.73);
  const se = (p: number) => Math.sqrt((p * (1 - p)) / n);
  const diff = b - a;
  const seDiff = Math.sqrt(se(a) ** 2 + se(b) ** 2);
  const z = diff / seDiff;
  const significant = Math.abs(z) > 1.96;
  const needed = diff === 0 ? Infinity : Math.ceil(((1.96 + 0.84) ** 2 * (a * (1 - a) + b * (1 - b))) / diff ** 2);
  const W = 640;
  const H = 120;
  const lo = Math.max(0, Math.min(a, b) - 0.15);
  const hi = Math.min(1, Math.max(a, b) + 0.15);
  const x = (v: number) => 40 + ((v - lo) / (hi - lo)) * (W - 80);
  const bar = (p: number, yy: number, color: string, label: string) => (
    <g>
      <line x1={x(Math.max(lo, p - 1.96 * se(p)))} x2={x(Math.min(hi, p + 1.96 * se(p)))} y1={yy} y2={yy} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.35} />
      <circle cx={x(p)} cy={yy} r={6} fill={color} />
      <text x={x(p)} y={yy - 11} textAnchor="middle" fontSize="10" fontWeight={700} fill={color}>
        {label} {(p * 100).toFixed(1)}% ± {(1.96 * se(p) * 100).toFixed(1)}
      </text>
    </g>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Slider label="Eval items" value={n} min={50} max={5000} step={50} onChange={setN} />
        <Slider label="Model A score" value={a} min={0.3} max={0.95} step={0.01} onChange={setA} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Model B score" value={b} min={0.3} max={0.95} step={0.01} onChange={setB} format={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {bar(a, 44, C.sky, "A")}
          {bar(b, 92, C.pivot, "B")}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="difference" value={`${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)} pts`} />
        <Stat label="z-score" value={z.toFixed(2)} color={significant ? C.done : C.bad} />
        <Stat label="items to detect it (80% power)" value={Number.isFinite(needed) ? needed.toLocaleString() : "∞"} color={C.compare} />
      </div>
      <Narration tone={significant ? "good" : "warn"}>
        {significant
          ? `With ${n} items the ${(Math.abs(diff) * 100).toFixed(1)}-point gap is statistically significant (|z| > 1.96).`
          : `With ${n} items a ${(Math.abs(diff) * 100).toFixed(1)}-point gap is within noise: the 95% intervals overlap heavily. You'd need ~${Number.isFinite(needed) ? needed.toLocaleString() : "∞"} items to trust it.`}{" "}
        A 500-task benchmark like SWE-bench Verified has a ±4-point interval around 70%, so many leaderboard &quot;wins&quot; are noise. Report confidence intervals, compare models on the <i>same</i> items (paired tests are more sensitive), and run several trials per item because the model is random too.
      </Narration>
    </div>
  );
}

export default function Evals() {
  const [tab, setTab] = useState<"pass" | "noise">("pass");
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "pass", label: "pass@k vs pass^k" },
          { value: "noise", label: "Is the improvement real?" },
        ]}
      />
      {tab === "pass" ? <PassK /> : <Noise />}
    </div>
  );
}
