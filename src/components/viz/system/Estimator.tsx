"use client";

import { useState } from "react";
import { C, Segmented, Stat } from "../kit";

interface Inputs {
  dau: number; // millions
  writes: number; // per user per day
  readRatio: number; // reads per write
  size: number; // bytes per write
  years: number;
  replicas: number;
  peak: number;
}

const PRESETS: Record<string, { label: string; v: Inputs; note: string }> = {
  twitter: { label: "Twitter-like feed", v: { dau: 200, writes: 2, readRatio: 100, size: 1000, years: 5, replicas: 3, peak: 3 }, note: "Read-heavy: timelines are read far more than tweets are written." },
  shortener: { label: "URL shortener", v: { dau: 10, writes: 1, readRatio: 100, size: 500, years: 10, replicas: 3, peak: 2 }, note: "Tiny rows, massive read amplification — cache the hot links." },
  chat: { label: "Chat app", v: { dau: 500, writes: 40, readRatio: 1, size: 200, years: 2, replicas: 3, peak: 3 }, note: "Write-heavy and fan-out on delivery; storage grows fast." },
  photos: { label: "Photo sharing", v: { dau: 100, writes: 0.5, readRatio: 50, size: 2_000_000, years: 5, replicas: 3, peak: 2 }, note: "Blob storage + CDN dominate the cost; metadata is small." },
};

function bytes(n: number) {
  const u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString()} ${u[i]}`;
}

function qps(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n < 10 ? 1 : 0);
}

export default function Estimator() {
  const [preset, setPreset] = useState("twitter");
  const [v, setV] = useState<Inputs>(PRESETS.twitter.v);
  const set = (k: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: Math.max(0, Number(e.target.value) || 0) }));

  const writesPerDay = v.dau * 1e6 * v.writes;
  const wqps = writesPerDay / 86400;
  const rqps = wqps * v.readRatio;
  const storagePerDay = writesPerDay * v.size;
  const total = storagePerDay * 365 * v.years * v.replicas;
  const egress = rqps * v.size;

  const fields: { k: keyof Inputs; label: string; step?: number }[] = [
    { k: "dau", label: "Daily active users (millions)" },
    { k: "writes", label: "Writes per user per day", step: 0.5 },
    { k: "readRatio", label: "Reads per write" },
    { k: "size", label: "Bytes per write" },
    { k: "years", label: "Retention (years)" },
    { k: "replicas", label: "Replication factor" },
    { k: "peak", label: "Peak / average ratio", step: 0.5 },
  ];

  return (
    <div className="space-y-4">
      <Segmented
        value={preset}
        onChange={(p) => {
          setPreset(p);
          setV(PRESETS[p].v);
        }}
        options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))}
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2.5 rounded-xl border border-line bg-panel p-4">
          {fields.map((f) => (
            <label key={f.k} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-dim">{f.label}</span>
              <input
                type="number"
                step={f.step ?? 1}
                value={v[f.k]}
                onChange={set(f.k)}
                className="h-8 w-28 rounded-lg border border-line-2 bg-bg px-2 text-right font-mono text-ink outline-none focus:border-cyan/60"
              />
            </label>
          ))}
          <p className="pt-1 text-xs text-faint">{PRESETS[preset]?.note}</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="write QPS (avg)" value={qps(wqps)} color={C.swap} />
            <Stat label="write QPS (peak)" value={qps(wqps * v.peak)} color={C.swap} />
            <Stat label="read QPS (peak)" value={qps(rqps * v.peak)} color={C.active} />
            <Stat label="new data / day" value={bytes(storagePerDay)} color={C.compare} />
            <Stat label={`storage over ${v.years}y ×${v.replicas}`} value={bytes(total)} color={C.compare} />
            <Stat label="read egress (avg)" value={`${bytes(egress)}/s`} color={C.pivot} />
          </div>
          <div className="rounded-xl border border-line bg-[#f8fafd] p-4 font-mono text-xs leading-relaxed text-dim">
            <div>
              writes/day = {v.dau}M users × {v.writes} = <span className="text-ink">{qps(writesPerDay)}</span>
            </div>
            <div>
              write QPS = writes/day ÷ 86,400 s ≈ <span className="text-ink">{qps(wqps)}</span> → ×{v.peak} peak = <span className="text-ink">{qps(wqps * v.peak)}</span>
            </div>
            <div>
              read QPS = write QPS × {v.readRatio} ≈ <span className="text-ink">{qps(rqps)}</span>
            </div>
            <div>
              storage = writes/day × {bytes(v.size)} × 365 × {v.years} × {v.replicas} replicas ≈ <span className="text-ink">{bytes(total)}</span>
            </div>
            <div className="mt-2 text-faint">
              {rqps * v.peak > 50_000 ? "→ Reads exceed what a single DB handles: add caching + read replicas." : "→ A single well-indexed primary with a cache could handle the reads."}{" "}
              {wqps * v.peak > 5_000 ? "Writes need sharding or a write-optimized store." : "Write volume fits a single primary."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
