"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

type Pattern = "ramp" | "spike" | "wave";

const STEP = 15; // seconds between HPA evaluations
const MINUTES = 30;
const STEPS = (MINUTES * 60) / STEP;
const POD_RPS = 100; // what one pod serves at 100% of its CPU request
const MAX_REPLICAS = 40;

function traffic(p: Pattern, sec: number): number {
  const m = sec / 60;
  if (p === "ramp") {
    if (m < 3) return 200;
    if (m < 15) return 200 + ((m - 3) / 12) * 2200;
    if (m < 22) return 2400;
    return 2400 - ((m - 22) / 8) * 1800;
  }
  if (p === "spike") return m >= 8 && m < 14 ? 2600 : 400;
  return 1000 + 700 * Math.sin((2 * Math.PI * m) / 6);
}

interface Row {
  sec: number;
  load: number;
  capacity: number;
  replicas: number;
  ready: number;
  dropped: number;
}

function simulate(p: Pattern, target: number, startup: number, minR: number, stabMin: number) {
  const tgt = target / 100;
  const first = Math.max(minR, Math.ceil(traffic(p, 0) / (POD_RPS * tgt)));
  let pods: number[] = Array(first).fill(-Infinity); // ready-at times
  const recs: { sec: number; n: number }[] = [];
  const rows: Row[] = [];
  let flaps = 0;
  let lastDir = 0;
  for (let k = 0; k <= STEPS; k++) {
    const sec = k * STEP;
    const load = traffic(p, sec);
    const ready = pods.filter((r) => r <= sec).length;
    const capacity = ready * POD_RPS;
    const served = Math.min(load, capacity);
    rows.push({ sec, load, capacity, replicas: pods.length, ready, dropped: load - served });

    // HPA: desired = ceil(current × currentUtilization / target), measured over ready pods only
    const util = ready ? served / capacity : 1;
    const current = pods.length;
    let want = ready ? Math.ceil((ready * util) / tgt) : current;
    if (ready && Math.abs(util / tgt - 1) <= 0.1) want = current; // 10% tolerance
    want = Math.max(minR, Math.min(MAX_REPLICAS, want));
    recs.push({ sec, n: want });
    let next = current;
    if (want > current) next = Math.min(want, Math.max(current * 2, current + 4));
    else if (want < current) {
      const recent = recs.filter((r) => r.sec > sec - stabMin * 60).map((r) => r.n);
      next = Math.min(current, Math.max(want, ...recent));
    }
    if (next > current) pods = [...pods, ...Array(next - current).fill(sec + startup)];
    else if (next < current) pods = [...pods].sort((a, b) => b - a).slice(current - next); // drop not-ready pods first
    const dir = Math.sign(next - current);
    if (dir && lastDir && dir !== lastDir) flaps++;
    if (dir) lastDir = dir;
  }
  const total = rows.reduce((a, r) => a + r.load, 0);
  const dropped = rows.reduce((a, r) => a + r.dropped, 0);
  const podMinutes = rows.reduce((a, r) => a + r.replicas, 0) * (STEP / 60);
  const util = rows.reduce((a, r) => a + (r.load - r.dropped), 0) / Math.max(1, rows.reduce((a, r) => a + r.capacity, 0));
  return { rows, droppedPct: (dropped / total) * 100, podMinutes, util: util * 100, peak: Math.max(...rows.map((r) => r.replicas)), flaps };
}

export default function Autoscaler() {
  const [pattern, setPattern] = useState<Pattern>("spike");
  const [target, setTarget] = useState(60);
  const [startup, setStartup] = useState(60);
  const [minR, setMinR] = useState(3);
  const [stab, setStab] = useState(5);
  const sim = useMemo(() => simulate(pattern, target, startup, minR, stab), [pattern, target, startup, minR, stab]);

  const W = 640;
  const H = 230;
  const maxY = Math.max(...sim.rows.map((r) => Math.max(r.load, r.capacity))) * 1.08;
  const x = (sec: number) => 40 + (sec / (MINUTES * 60)) * (W - 56);
  const y = (v: number) => H - 26 - (v / maxY) * (H - 44);
  const H2 = 90;
  const maxR = Math.max(...sim.rows.map((r) => r.replicas)) + 2;
  const y2 = (v: number) => H2 - 18 - (v / maxR) * (H2 - 28);
  const stepLine = (get: (r: Row) => number, yy: (v: number) => number) =>
    sim.rows.map((r, i) => `${i ? "L" : "M"}${x(r.sec)},${yy(i ? get(sim.rows[i - 1]) : get(r))} L${x(r.sec)},${yy(get(r))}`).join(" ");

  return (
    <div className="space-y-4">
      <Segmented
        value={pattern}
        onChange={setPattern}
        options={[
          { value: "spike", label: "Flash spike" },
          { value: "ramp", label: "Morning ramp" },
          { value: "wave", label: "Oscillating load" },
        ]}
      />
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Slider label="Target CPU utilization" value={target} min={30} max={90} step={5} onChange={setTarget} format={(v) => `${v}%`} />
        <Slider label="Pod startup → ready" value={startup} min={15} max={180} step={15} onChange={setStartup} format={(v) => `${v} s`} />
        <Slider label="minReplicas" value={minR} min={1} max={12} onChange={setMinR} />
        <Slider label="Scale-down stabilization window" value={stab} min={0} max={10} onChange={setStab} format={(v) => `${v} min`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {sim.rows.map((r) =>
            r.dropped > 0 ? <rect key={r.sec} x={x(r.sec)} y={y(r.load)} width={x(STEP) - x(0) + 0.5} height={y(r.capacity) - y(r.load)} fill={C.bad} opacity={0.22} /> : null,
          )}
          <path d={stepLine((r) => r.capacity, y)} fill="none" stroke={C.done} strokeWidth={2} />
          <polyline points={sim.rows.map((r) => `${x(r.sec)},${y(r.load)}`).join(" ")} fill="none" stroke={C.text} strokeWidth={1.6} />
          <line x1={40} x2={W - 16} y1={H - 26} y2={H - 26} stroke="#cbd5e1" />
          {[0, 5, 10, 15, 20, 25, 30].map((m) => (
            <text key={m} x={x(m * 60)} y={H - 10} textAnchor="middle" fontSize="9" fill={C.faint}>
              {m}m
            </text>
          ))}
          {[0, 1000, 2000].map((v) => (
            <text key={v} x={34} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              {v / 1000}k
            </text>
          ))}
          <text x={46} y={16} fontSize="10" fill={C.text}>
            ━ requests/s
          </text>
          <text x={132} y={16} fontSize="10" fill={C.done}>
            ━ capacity of ready pods
          </text>
          <text x={272} y={16} fontSize="10" fill={C.bad}>
            ■ overloaded (dropped / slow)
          </text>
        </svg>
        <svg viewBox={`0 0 ${W} ${H2}`} className="block w-full border-t border-line">
          <path d={stepLine((r) => r.replicas, y2)} fill="none" stroke={C.pivot} strokeWidth={1.8} />
          <path d={stepLine((r) => r.ready, y2)} fill="none" stroke={C.active} strokeWidth={1.4} strokeDasharray="4 3" />
          <line x1={40} x2={W - 16} y1={H2 - 18} y2={H2 - 18} stroke="#cbd5e1" />
          <text x={46} y={12} fontSize="10" fill={C.pivot}>
            ━ replicas
          </text>
          <text x={110} y={12} fontSize="10" fill={C.active}>
            ┅ ready
          </text>
          <text x={34} y={y2(sim.peak) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
            {sim.peak}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="requests dropped" value={`${sim.droppedPct.toFixed(1)}%`} color={sim.droppedPct > 2 ? C.bad : C.done} />
        <Stat label="pod-minutes (cost)" value={Math.round(sim.podMinutes)} color={C.pivot} />
        <Stat label="avg utilization" value={`${sim.util.toFixed(0)}%`} />
        <Stat label="scale flaps" value={sim.flaps} color={sim.flaps > 4 ? C.compare : C.text} />
      </div>
      <Narration tone={sim.droppedPct > 2 ? "bad" : sim.flaps > 4 ? "warn" : "good"}>
        {sim.droppedPct > 2
          ? `The HPA reacts, but new pods need ${startup} s to become ready and each step can at most double the replicas, so ${sim.droppedPct.toFixed(1)}% of requests hit overloaded pods. Remedies: a lower target (more headroom), faster startup (smaller images, lazy init), higher minReplicas before known peaks (scheduled scaling), or queue-based scaling (KEDA) that sees demand before CPU does.`
          : sim.flaps > 4
            ? `Capacity keeps up, but replicas changed direction ${sim.flaps} times: thrashing. Each scale-down is followed by a scale-up that pays the startup cost again. The scale-down stabilization window (default 5 min) uses the highest recommendation in the window to damp this.`
            : `Healthy: capacity tracks demand with ${sim.droppedPct.toFixed(1)}% dropped at ${sim.util.toFixed(0)}% average utilization. The trade-off is cost: a lower target or higher minReplicas buys safety with idle pods (${Math.round(sim.podMinutes)} pod-minutes here).`}
      </Narration>
    </div>
  );
}
