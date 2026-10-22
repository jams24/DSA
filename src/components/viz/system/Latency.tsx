"use client";

import { useState } from "react";
import { C, Segmented } from "../kit";

const ROWS = [
  { op: "L1 cache reference", ns: 0.5, tier: "cpu" },
  { op: "Branch mispredict", ns: 5, tier: "cpu" },
  { op: "L2 cache reference", ns: 7, tier: "cpu" },
  { op: "Mutex lock/unlock", ns: 25, tier: "cpu" },
  { op: "Main memory reference", ns: 100, tier: "mem" },
  { op: "Compress 1 KB with Snappy", ns: 3_000, tier: "mem" },
  { op: "Send 1 KB over 1 Gbps network", ns: 10_000, tier: "net" },
  { op: "Read 4 KB randomly from SSD", ns: 150_000, tier: "disk" },
  { op: "Read 1 MB sequentially from memory", ns: 250_000, tier: "mem" },
  { op: "Round trip within same datacenter", ns: 500_000, tier: "net" },
  { op: "Read 1 MB sequentially from SSD", ns: 1_000_000, tier: "disk" },
  { op: "HDD seek", ns: 10_000_000, tier: "disk" },
  { op: "Read 1 MB sequentially from HDD", ns: 20_000_000, tier: "disk" },
  { op: "Packet CA → Netherlands → CA", ns: 150_000_000, tier: "net" },
];

const TIER = {
  cpu: { color: C.done, label: "CPU" },
  mem: { color: C.active, label: "Memory" },
  net: { color: C.pivot, label: "Network" },
  disk: { color: C.compare, label: "Storage" },
};

function fmt(ns: number) {
  if (ns < 1000) return `${ns} ns`;
  if (ns < 1e6) return `${ns / 1000} µs`;
  if (ns < 1e9) return `${ns / 1e6} ms`;
  return `${ns / 1e9} s`;
}

function human(ns: number) {
  const s = ns; // 1 ns → 1 s
  if (s < 60) return `${s} seconds`;
  if (s < 3600) return `${(s / 60).toFixed(1)} minutes`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 30) return `${(s / 86400).toFixed(1)} days`;
  if (s < 86400 * 365) return `${(s / 86400 / 30).toFixed(1)} months`;
  return `${(s / 86400 / 365).toFixed(1)} years`;
}

export default function Latency() {
  const [mode, setMode] = useState<"real" | "human">("real");
  const maxLog = Math.log10(ROWS[ROWS.length - 1].ns / 0.5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "real", label: "Real latency" },
            { value: "human", label: "If 1 ns were 1 second" },
          ]}
        />
        <div className="flex gap-3 text-xs text-dim">
          {Object.values(TIER).map((t) => (
            <span key={t.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl border border-line bg-[#080c19] p-4">
        {ROWS.map((r) => {
          const w = (Math.log10(r.ns / 0.5) / maxLog) * 100;
          const t = TIER[r.tier as keyof typeof TIER];
          return (
            <div key={r.op} className="grid grid-cols-[minmax(0,240px)_1fr_110px] items-center gap-3 text-sm">
              <span className="truncate text-dim">{r.op}</span>
              <div className="h-5 overflow-hidden rounded bg-line/50">
                <div className="h-full rounded transition-all duration-500" style={{ width: `${Math.max(2, w)}%`, background: `linear-gradient(90deg, ${t.color}66, ${t.color})` }} />
              </div>
              <span className="text-right font-mono text-xs" style={{ color: t.color }}>
                {mode === "real" ? fmt(r.ns) : human(r.ns)}
              </span>
            </div>
          );
        })}
        <p className="pt-2 text-xs text-faint">Bars use a logarithmic scale — each step right is roughly 10× slower. Numbers are the classic Dean/Norvig figures; know the orders of magnitude.</p>
      </div>
    </div>
  );
}
