"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Segmented, Slider } from "../kit";

const FUNCS = [
  { id: "1", label: "O(1)", color: C.done, f: () => 1, log10: () => 0 },
  { id: "logn", label: "O(log n)", color: C.sky, f: (n: number) => Math.log2(Math.max(n, 1)), log10: (n: number) => Math.log10(Math.max(Math.log2(n), 1)) },
  { id: "n", label: "O(n)", color: C.lime, f: (n: number) => n, log10: (n: number) => Math.log10(n) },
  {
    id: "nlogn",
    label: "O(n log n)",
    color: C.compare,
    f: (n: number) => n * Math.log2(Math.max(n, 1)),
    log10: (n: number) => Math.log10(n) + Math.log10(Math.max(Math.log2(n), 1)),
  },
  { id: "n2", label: "O(n²)", color: C.orange, f: (n: number) => n * n, log10: (n: number) => 2 * Math.log10(n) },
  { id: "2n", label: "O(2ⁿ)", color: C.bad, f: (n: number) => 2 ** n, log10: (n: number) => n * Math.log10(2) },
] as const;

const W = 640;
const H = 300;
const PAD = { l: 48, r: 16, t: 16, b: 32 };

function formatOps(log10: number) {
  if (log10 < 6) return Math.round(10 ** log10).toLocaleString();
  return `10^${log10.toFixed(1)}`;
}

/** Wall-clock time if one operation takes 1 ns. */
function formatTime(log10Ops: number) {
  const log10s = log10Ops - 9;
  if (log10s > 17.64) return "longer than the age of the universe";
  const s = 10 ** log10s;
  if (s < 1e-6) return `${(s * 1e9).toFixed(0)} ns`;
  if (s < 1e-3) return `${(s * 1e6).toFixed(1)} µs`;
  if (s < 1) return `${(s * 1e3).toFixed(1)} ms`;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 3.15e7) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / 3.15e7).toExponential(1)} years`;
}

export default function BigO() {
  const [n, setN] = useState(20);
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const [on, setOn] = useState<Record<string, boolean>>({ "1": true, logn: true, n: true, nlogn: true, n2: true, "2n": true });
  const [exp, setExp] = useState(6);

  const curves = useMemo(() => {
    const maxLinear = n * n;
    const maxLog = Math.log10(2 ** n);
    const yOf = (v: number) => {
      if (scale === "linear") return Math.min(v / maxLinear, 1.08);
      return Math.max(0, Math.log10(Math.max(v, 1)) / Math.max(maxLog, 1));
    };
    return FUNCS.map((fn) => {
      const pts: string[] = [];
      for (let k = 0; k <= 120; k++) {
        const x = 1 + ((n - 1) * k) / 120;
        const y = yOf(fn.f(x));
        if (y > 1.08) break;
        pts.push(`${PAD.l + ((x - 1) / (n - 1)) * (W - PAD.l - PAD.r)},${H - PAD.b - y * (H - PAD.t - PAD.b)}`);
      }
      return { ...fn, d: pts.length ? `M${pts.join("L")}` : "" };
    });
  }, [n, scale]);

  const bigN = 10 ** exp;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={scale}
          onChange={setScale}
          options={[
            { value: "linear", label: "Linear y-axis" },
            { value: "log", label: "Log y-axis" },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          {FUNCS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOn((o) => ({ ...o, [f.id]: !o[f.id] }))}
              className={clsx("rounded-full border px-2.5 py-1 font-mono text-xs transition", on[f.id] ? "" : "opacity-35")}
              style={{ borderColor: `${f.color}66`, color: f.color, background: `${f.color}14` }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line
              key={g}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={H - PAD.b - g * (H - PAD.t - PAD.b)}
              y2={H - PAD.b - g * (H - PAD.t - PAD.b)}
              stroke={C.dim}
              strokeDasharray="3 5"
            />
          ))}
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke={C.base} />
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={C.base} />
          <text x={W / 2} y={H - 8} fill={C.faint} fontSize="11" textAnchor="middle">
            input size n (1 … {n})
          </text>
          <text x={14} y={H / 2} fill={C.faint} fontSize="11" textAnchor="middle" transform={`rotate(-90 14 ${H / 2})`}>
            operations {scale === "log" ? "(log)" : ""}
          </text>
          {curves.map(
            (c) =>
              on[c.id] &&
              c.d && (
                <path
                  key={c.id}
                  d={c.d}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${c.color})` }}
                />
              ),
          )}
        </svg>
      </div>
      <Slider label="Zoom: largest n on chart" value={n} min={4} max={40} onChange={setN} />

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display font-semibold text-ink">How long would it take?</div>
            <div className="text-xs text-dim">Assume a fast machine: 1 operation = 1 nanosecond.</div>
          </div>
          <div className="w-64">
            <Slider label="n" value={exp} min={1} max={9} onChange={setExp} format={(e) => (10 ** e).toLocaleString()} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCS.map((f) => {
            const l = f.log10(bigN);
            const bad = l - 9 > 0.5;
            return (
              <div key={f.id} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-sm font-semibold" style={{ color: f.color }}>
                    {f.label}
                  </span>
                  <span className="font-mono text-[11px] text-faint">{formatOps(l)} ops</span>
                </div>
                <div className={clsx("mt-1 text-sm", bad ? "text-rose" : "text-ink")}>{formatTime(l)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
