"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { C, Narration, Segmented, SmallBtn, Stat } from "../kit";

const NINES = [99, 99.5, 99.9, 99.95, 99.99, 99.999];
const WINDOW_MIN = 30 * 24 * 60;

function dur(min: number): string {
  if (min >= 1440) return `${(min / 1440).toFixed(min >= 14400 ? 0 : 1)} d`;
  if (min >= 60) return `${(min / 60).toFixed(1)} h`;
  if (min >= 1) return `${min.toFixed(1)} min`;
  return `${(min * 60).toFixed(0)} s`;
}

interface Dep {
  name: string;
  a: number;
  redundant: boolean;
  critical: boolean;
}

function Nines() {
  const [deps, setDeps] = useState<Dep[]>([
    { name: "Load balancer", a: 99.99, redundant: false, critical: true },
    { name: "API service", a: 99.95, redundant: false, critical: true },
    { name: "Primary database", a: 99.95, redundant: false, critical: true },
    { name: "Cache", a: 99.9, redundant: false, critical: true },
    { name: "Payment provider", a: 99.5, redundant: false, critical: true },
  ]);
  const eff = (d: Dep) => (d.redundant ? 1 - Math.pow(1 - d.a / 100, 2) : d.a / 100);
  const total = deps.filter((d) => d.critical).reduce((a, d) => a * eff(d), 1);
  const down = (1 - total) * WINDOW_MIN;
  const update = (i: number, patch: Partial<Dep>) => setDeps((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[460px] text-left text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">availability</th>
              <th className="px-3 py-2 text-right font-medium">per year</th>
              <th className="px-3 py-2 text-right font-medium">per 30 days</th>
              <th className="px-3 py-2 text-right font-medium">per week</th>
              <th className="px-3 py-2 text-right font-medium">per day</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {NINES.map((n) => {
              const f = 1 - n / 100;
              return (
                <tr key={n} className="border-t border-line">
                  <td className="px-3 py-1.5 font-semibold text-ink">{n}%</td>
                  <td className="px-3 py-1.5 text-right">{dur(f * 525600)}</td>
                  <td className="px-3 py-1.5 text-right">{dur(f * WINDOW_MIN)}</td>
                  <td className="px-3 py-1.5 text-right">{dur(f * 10080)}</td>
                  <td className="px-3 py-1.5 text-right">{dur(f * 1440)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="text-sm font-semibold text-ink">Checkout depends on all of these</div>
        <div className="mt-3 space-y-2">
          {deps.map((d, i) => (
            <div key={d.name} className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line px-3 py-2 text-xs", !d.critical && "opacity-50")}>
              <span className="w-32 font-medium text-ink">{d.name}</span>
              <select value={d.a} onChange={(e) => update(i, { a: Number(e.target.value) })} className="rounded-md border border-line-2 bg-panel px-1.5 py-1 font-mono text-ink">
                {[99, 99.5, 99.9, 99.95, 99.99].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-dim">
                <input type="checkbox" checked={d.redundant} onChange={(e) => update(i, { redundant: e.target.checked })} className="accent-[#059669]" />
                2 independent copies
              </label>
              <label className="flex items-center gap-1.5 text-dim">
                <input type="checkbox" checked={!d.critical} onChange={(e) => update(i, { critical: !e.target.checked })} className="accent-[#0891b2]" />
                degrade gracefully without it
              </label>
              <span className="ml-auto font-mono text-dim">{(eff(d) * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="end-to-end availability" value={`${(total * 100).toFixed(3)}%`} color={total >= 0.999 ? C.done : C.bad} />
        <Stat label="expected downtime / 30 days" value={dur(down)} color={C.compare} />
      </div>
      <Narration tone={total >= 0.999 ? "good" : "warn"}>
        Serial dependencies multiply: 0.9999 × 0.9995 × 0.9995 × 0.999 × 0.995 ≈ 99.29%, worse than any single part. You can&apos;t promise more than your weakest hard dependency. Make it redundant (two copies fail together only (1 − a)² of the time, if their failures are independent: different AZs, providers, deploys) or take it off the critical path: serve from the DB on cache failure, queue payments and confirm later.
      </Narration>
    </div>
  );
}

interface Incident {
  id: number;
  name: string;
  rate: number; // fraction of requests failing
  minutes: number;
  day: number;
}

const PRESETS: Omit<Incident, "id" | "day">[] = [
  { name: "Full outage, 20 min", rate: 1, minutes: 20 },
  { name: "Bad deploy: 30% errors for 15 min", rate: 0.3, minutes: 15 },
  { name: "Partial: 5% errors for 3 h", rate: 0.05, minutes: 180 },
  { name: "Slow burn: 0.2% errors for 3 days", rate: 0.002, minutes: 4320 },
];

const ALERTS = [
  { label: "page: 1 h burn ≥ 14.4×", window: 60, burn: 14.4 },
  { label: "page: 6 h burn ≥ 6×", window: 360, burn: 6 },
  { label: "ticket: 3 d burn ≥ 1×", window: 4320, burn: 1 },
];

function Budget() {
  const [slo, setSlo] = useState("99.9");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [nextId, setNextId] = useState(1);
  const budgetFrac = 1 - Number(slo) / 100;
  const budgetMin = budgetFrac * WINDOW_MIN;

  const consumed = (x: Incident) => (x.rate * x.minutes) / budgetMin;
  const add = (p: (typeof PRESETS)[number]) => {
    const day = Math.min(27, 2 + incidents.length * 5);
    setIncidents((xs) => [...xs, { ...p, id: nextId, day }]);
    setNextId((n) => n + 1);
  };

  // remaining budget over the 30 days
  const pts: [number, number][] = [[0, 1]];
  let left = 1;
  for (const x of [...incidents].sort((a, b) => a.day - b.day)) {
    pts.push([x.day, left]);
    left -= consumed(x);
    pts.push([x.day + x.minutes / 1440, left]);
  }
  pts.push([30, left]);
  const W = 640;
  const H = 180;
  const minY = Math.min(-0.2, left - 0.1);
  const xx = (d: number) => 40 + (d / 30) * (W - 56);
  const yy = (v: number) => 16 + ((1 - v) / (1 - minY)) * (H - 40);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={slo} onChange={setSlo} options={["99", "99.5", "99.9", "99.95", "99.99"].map((v) => ({ value: v, label: `${v}%` }))} />
        <span className="text-xs text-dim">
          30-day error budget: <b className="text-ink">{(budgetFrac * 100).toFixed(2)}% of requests</b> ≈ {dur(budgetMin)} of full outage
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <SmallBtn key={p.name} onClick={() => add(p)} disabled={incidents.length >= 6} tone="danger">
            + {p.name}
          </SmallBtn>
        ))}
        {incidents.length > 0 && <SmallBtn onClick={() => setIncidents([])}>clear</SmallBtn>}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          <rect x={40} y={yy(0)} width={W - 56} height={H - 24 - yy(0)} fill={C.bad} opacity={0.08} />
          <line x1={40} x2={W - 16} y1={yy(0)} y2={yy(0)} stroke={C.bad} strokeDasharray="5 4" />
          <text x={W - 18} y={yy(0) + 12} textAnchor="end" fontSize="10" fill={C.bad}>
            budget exhausted: SLO missed
          </text>
          <polyline points={pts.map(([d, v]) => `${xx(d)},${yy(Math.max(v, minY))}`).join(" ")} fill="none" stroke={left >= 0 ? C.done : C.bad} strokeWidth={2.2} />
          {[1, 0.5].map((v) => (
            <text key={v} x={34} y={yy(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              {v * 100}%
            </text>
          ))}
          <text x={34} y={yy(0) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
            0%
          </text>
          {[0, 5, 10, 15, 20, 25, 30].map((d) => (
            <text key={d} x={xx(d)} y={H - 8} textAnchor="middle" fontSize="9" fill={C.faint}>
              day {d}
            </text>
          ))}
        </svg>
      </div>

      {incidents.length > 0 && (
        <div className="space-y-1.5">
          {incidents.map((x) => {
            const burn = x.rate / budgetFrac;
            const fired = ALERTS.filter((a) => (x.rate * Math.min(x.minutes, a.window)) / a.window / budgetFrac >= a.burn);
            return (
              <div key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-3 py-2 text-xs">
                <span className="font-medium text-ink">
                  Day {x.day}: {x.name}
                </span>
                <span className="font-mono text-dim">burn {burn >= 10 ? burn.toFixed(0) : burn.toFixed(1)}×</span>
                <span className="font-mono text-dim">{(consumed(x) * 100).toFixed(0)}% of budget</span>
                <span className={clsx("font-semibold", fired.length ? "text-rose" : "text-faint")}>{fired.length ? fired.map((a) => a.label.split(":")[0]).filter((v, i, arr) => arr.indexOf(v) === i).join(" + ") : "no alert"}</span>
                <button type="button" onClick={() => setIncidents((xs) => xs.filter((y) => y.id !== x.id))} className="ml-auto text-faint hover:text-ink" aria-label="Remove incident">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="budget remaining" value={`${Math.round(left * 100)}%`} color={left >= 0.25 ? C.done : left >= 0 ? C.compare : C.bad} />
        <Stat label="policy" value={left >= 0.25 ? "ship features" : left >= 0 ? "slow down" : "freeze launches"} color={left >= 0.25 ? C.done : left >= 0 ? C.compare : C.bad} />
      </div>
      <Narration tone={left < 0 ? "bad" : "info"}>
        Burn rate = error rate ÷ error budget. 1× spends exactly the budget in 30 days, while 14.4× spends 2% of it in one hour. Multi-window burn-rate alerts (Google SRE workbook) page on fast burns and open a ticket for slow ones, so a 0.2% trickle doesn&apos;t wake anyone at 3 AM but still gets fixed. Try the slow burn at 99.9%: it never pages, yet it quietly spends a fifth of the month&apos;s budget, so it opens a ticket instead.
      </Narration>
    </div>
  );
}

export default function Slo() {
  const [tab, setTab] = useState<"nines" | "budget">("budget");
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "budget", label: "Error budget & burn rate" },
          { value: "nines", label: "Nines & dependencies" },
        ]}
      />
      {tab === "nines" ? <Nines /> : <Budget />}
    </div>
  );
}
