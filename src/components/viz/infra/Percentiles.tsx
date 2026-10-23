"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

const N = 4000;
const MAX_MS = 2100;
const BIN = 30;

function samples(seed: number, tailPct: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    if (rand() < tailPct / 100) {
      out.push(600 + rand() * 1400); // GC pause, cache miss, retry…
      continue;
    }
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
    out.push(80 * Math.exp(0.35 * z));
  }
  return out.sort((a, b) => a - b);
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ms = (v: number) => `${Math.round(v)} ms`;

const MARKERS = [
  { key: "mean", label: "mean", color: C.compare },
  { key: "p50", label: "p50", color: C.done },
  { key: "p90", label: "p90", color: C.sky },
  { key: "p99", label: "p99", color: C.bad },
  { key: "p999", label: "p99.9", color: C.pivot },
] as const;

function Distribution() {
  const [tail, setTail] = useState(2);
  const data = useMemo(() => samples(7, tail), [tail]);
  const stats = { mean: mean(data), p50: pct(data, 50), p90: pct(data, 90), p99: pct(data, 99), p999: pct(data, 99.9) };
  const bins = useMemo(() => {
    const b = Array(Math.ceil(MAX_MS / BIN)).fill(0);
    for (const v of data) b[Math.min(b.length - 1, Math.floor(v / BIN))]++;
    return b;
  }, [data]);
  const serverA = useMemo(() => samples(11, 0.5), []);
  const merged = useMemo(() => [...serverA, ...data].sort((a, b) => a - b), [serverA, data]);
  const avgOfP99 = (pct(serverA, 99) + stats.p99) / 2;
  const trueP99 = pct(merged, 99);

  const W = 640;
  const H = 220;
  const maxC = Math.sqrt(Math.max(...bins));
  const x = (v: number) => 30 + (v / MAX_MS) * (W - 46);
  const y = (c: number) => H - 24 - (Math.sqrt(c) / maxC) * (H - 60);

  return (
    <div className="space-y-4">
      <Slider label="Slow tail (GC pauses, cache misses, retries)" value={tail} min={0} max={10} step={0.5} onChange={setTail} format={(v) => `${v}% of requests`} />
      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {bins.map((c, i) => (c ? <rect key={i} x={x(i * BIN) + 0.5} y={y(c)} width={x(BIN) - x(0) - 1} height={H - 24 - y(c)} fill={C.active} opacity={0.55} /> : null))}
          {MARKERS.map((mk, i) => {
            const v = stats[mk.key];
            return (
              <g key={mk.key}>
                <line x1={x(v)} x2={x(v)} y1={20} y2={H - 24} stroke={mk.color} strokeWidth={1.6} strokeDasharray={mk.key === "mean" ? "4 3" : undefined} />
                <text x={x(v) + 3} y={14 + (i % 3) * 11} fontSize="10" fontWeight={700} fill={mk.color}>
                  {mk.label}
                </text>
              </g>
            );
          })}
          <line x1={30} x2={W - 16} y1={H - 24} y2={H - 24} stroke="#cbd5e1" />
          {[0, 250, 500, 1000, 1500, 2000].map((v) => (
            <text key={v} x={x(v)} y={H - 8} textAnchor="middle" fontSize="9" fill={C.faint}>
              {v}ms
            </text>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {MARKERS.map((mk) => (
          <Stat key={mk.key} label={mk.label} value={ms(stats[mk.key])} color={mk.color} />
        ))}
      </div>
      <Narration tone={tail >= 2 ? "warn" : "info"}>
        {tail === 0
          ? "A clean distribution: mean ≈ median. Now add a slow tail."
          : `${tail}% of requests are slow. The median barely moves (${ms(stats.p50)}), the mean drifts to ${ms(stats.mean)}, describing no real request, and p99 jumps to ${ms(stats.p99)}. One page load makes dozens of requests, so most users feel the tail. Alert on p99, not the average.`}
      </Narration>
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="text-sm font-semibold text-ink">You can&apos;t average percentiles</div>
        <p className="mt-1 text-xs text-dim">Two servers each take half the traffic: A is healthy (0.5% tail), B has the tail above.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="p99 server A" value={ms(pct(serverA, 99))} />
          <Stat label="p99 server B" value={ms(stats.p99)} />
          <Stat label="average of the p99s" value={ms(avgOfP99)} color={C.compare} />
          <Stat label="true p99 of all traffic" value={ms(trueP99)} color={C.done} />
        </div>
        <p className="mt-3 text-xs text-dim">
          The average of percentiles is a number with no meaning. Aggregate the underlying <b>histograms</b> (sum the bucket counts, then compute the quantile), which is what Prometheus{" "}
          <code className="font-mono">histogram_quantile(0.99, sum by (le) (rate(..._bucket[5m])))</code> does.
        </p>
      </div>
    </div>
  );
}

function FanOut() {
  const [n, setN] = useState(100);
  const [p, setP] = useState(1);
  const [hedge, setHedge] = useState(false);
  const q = p / 100;
  const slow = (k: number, h: boolean) => 1 - Math.pow(1 - (h ? q * q : q), k);
  const W = 640;
  const H = 200;
  const x = (k: number) => 40 + ((k - 1) / 199) * (W - 56);
  const y = (v: number) => H - 24 - v * (H - 40);
  const curve = (h: boolean) => Array.from({ length: 200 }, (_, i) => `${x(i + 1)},${y(slow(i + 1, h))}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Slider label="Backends each request fans out to" value={n} min={1} max={200} onChange={setN} />
        <Slider label="Chance one backend call is slow (> its p99)" value={p} min={0.1} max={5} step={0.1} onChange={setP} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <label className="flex items-center gap-2 text-xs text-dim">
        <input type="checkbox" checked={hedge} onChange={(e) => setHedge(e.target.checked)} className="accent-[#0891b2]" />
        Hedged requests: if a backend hasn&apos;t answered by its p95, send a copy to another replica and take whichever answers first
      </label>
      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={40} x2={W - 16} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
              <text x={34} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
                {v * 100}%
              </text>
            </g>
          ))}
          <polyline points={curve(false)} fill="none" stroke={C.bad} strokeWidth={2} />
          {hedge && <polyline points={curve(true)} fill="none" stroke={C.done} strokeWidth={2} />}
          <line x1={x(n)} x2={x(n)} y1={16} y2={H - 24} stroke={C.text} strokeDasharray="3 3" />
          <circle cx={x(n)} cy={y(slow(n, false))} r={4.5} fill={C.bad} />
          {hedge && <circle cx={x(n)} cy={y(slow(n, true))} r={4.5} fill={C.done} />}
          {[1, 50, 100, 150, 200].map((k) => (
            <text key={k} x={x(k)} y={H - 8} textAnchor="middle" fontSize="9" fill={C.faint}>
              {k}
            </text>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="user requests that are slow" value={`${(slow(n, false) * 100).toFixed(1)}%`} color={C.bad} />
        <Stat label={hedge ? "with hedging (~5% extra load)" : "with hedging"} value={hedge ? `${(slow(n, true) * 100).toFixed(2)}%` : "–"} color={C.done} />
      </div>
      <Narration tone={slow(n, false) > 0.3 ? "bad" : "info"}>
        A user request waits for its slowest backend. P(slow) = 1 − (1 − {p.toFixed(1)}%)<sup>{n}</sup> = {(slow(n, false) * 100).toFixed(1)}%. With 100 backends at 1% each, 63% of user requests hit a tail, so at scale the backend&apos;s p99 becomes the user&apos;s median (&quot;The Tail at Scale&quot;, Dean &amp; Barroso). Fixes: hedged or tied requests, fewer fan-out hops, and cutting the tail itself (GC tuning, request timeouts, isolating background work).
      </Narration>
    </div>
  );
}

export default function Percentiles() {
  const [tab, setTab] = useState<"dist" | "fan">("dist");
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "dist", label: "Latency distribution" },
          { value: "fan", label: "Fan-out & tail at scale" },
        ]}
      />
      {tab === "dist" ? <Distribution /> : <FanOut />}
    </div>
  );
}
