"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat, StepControls, useStepper } from "../kit";

type Algo = "reno" | "tahoe";
type Event = "dupack" | "timeout" | null;

interface Frame {
  r: number;
  cwnd: number;
  ssthresh: number;
  event: Event;
  note: string;
}

const ROUNDS = 44;
const TIMEOUT_ROUND = 30;

function simulate(algo: Algo, capacity: number, ssthresh0: number, withTimeout: boolean): Frame[] {
  let cwnd = 1;
  let ssthresh = ssthresh0;
  const frames: Frame[] = [{ r: 0, cwnd, ssthresh, event: null, note: "The connection starts with cwnd = 1 segment (modern stacks start at 10). The sender may have at most cwnd unacknowledged segments in flight." }];
  for (let r = 1; r <= ROUNDS; r++) {
    let event: Event = null;
    let note: string;
    const prev = cwnd;
    if (withTimeout && r === TIMEOUT_ROUND) {
      event = "timeout";
      ssthresh = Math.max(Math.floor(prev / 2), 2);
      cwnd = 1;
      note = `Retransmission timeout: nothing is getting through. Both algorithms set ssthresh = ${prev}/2 = ${ssthresh}, reset cwnd to 1 and slow-start again.`;
    } else if (prev > capacity) {
      event = "dupack";
      ssthresh = Math.max(Math.floor(prev / 2), 2);
      if (algo === "reno") {
        cwnd = ssthresh;
        note = `cwnd ${prev} exceeded what the path can hold, a router queue overflowed and dropped a segment. 3 duplicate ACKs mean later segments still arrive, so Reno halves: ssthresh = cwnd = ${ssthresh} (fast retransmit + fast recovery). Multiplicative decrease.`;
      } else {
        cwnd = 1;
        note = `cwnd ${prev} overflowed a router queue and a segment was dropped. Tahoe treats every loss the same way: ssthresh = ${ssthresh}, cwnd back to 1, slow start again.`;
      }
    } else if (prev < ssthresh) {
      cwnd = Math.min(prev * 2, ssthresh);
      note =
        cwnd === ssthresh
          ? `Slow start reached ssthresh (${ssthresh}). From now on: congestion avoidance, +1 segment per round trip.`
          : `Slow start: each ACK adds 1 segment, so cwnd doubles every round trip: ${prev} → ${cwnd}. "Slow" only compared to blasting everything at once.`;
    } else {
      cwnd = prev + 1;
      note = `Congestion avoidance: additive increase, +1 segment per round trip (${prev} → ${cwnd}), gently probing for spare bandwidth.`;
    }
    frames.push({ r, cwnd, ssthresh, event, note });
  }
  return frames;
}

export default function Congestion() {
  const [algo, setAlgo] = useState<Algo>("reno");
  const [capacity, setCapacity] = useState(40);
  const [ssthresh0, setSsthresh0] = useState(64);
  const [withTimeout, setWithTimeout] = useState(true);
  const frames = useMemo(() => simulate(algo, capacity, ssthresh0, withTimeout), [algo, capacity, ssthresh0, withTimeout]);
  const s = useStepper(frames, 450);
  const f = s.frame;
  const shown = frames.slice(0, s.i + 1);
  const avg = shown.reduce((a, x) => a + Math.min(x.cwnd, capacity), 0) / shown.length;
  const losses = shown.filter((x) => x.event).length;

  const W = 640;
  const H = 260;
  const maxY = Math.max(70, ...frames.map((x) => x.cwnd)) + 4;
  const x = (r: number) => 40 + (r / ROUNDS) * (W - 60);
  const y = (v: number) => H - 28 - (v / maxY) * (H - 50);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={algo}
          onChange={setAlgo}
          options={[
            { value: "reno", label: "TCP Reno (fast recovery)" },
            { value: "tahoe", label: "TCP Tahoe" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={withTimeout} onChange={(e) => setWithTimeout(e.target.checked)} className="accent-[#0891b2]" />
          Timeout at round {TIMEOUT_ROUND}
        </label>
      </div>
      <div className="flex flex-wrap gap-4">
        <Slider label="Path capacity (BDP + router buffer)" value={capacity} min={12} max={60} onChange={setCapacity} format={(v) => `${v} segments`} />
        <Slider label="Initial ssthresh" value={ssthresh0} min={8} max={64} step={4} onChange={setSsthresh0} />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          <line x1={40} x2={W - 20} y1={y(capacity)} y2={y(capacity)} stroke={C.compare} strokeDasharray="6 4" />
          <text x={W - 22} y={y(capacity) - 5} textAnchor="end" fontSize="10" fill={C.compare}>
            path capacity: more is dropped
          </text>
          <polyline
            points={shown.map((p) => `${x(p.r)},${y(Math.min(p.ssthresh, maxY))}`).join(" ")}
            fill="none"
            stroke={C.pivot}
            strokeDasharray="3 3"
            strokeWidth={1.4}
          />
          <polyline points={shown.map((p) => `${x(p.r)},${y(p.cwnd)}`).join(" ")} fill="none" stroke={C.active} strokeWidth={2.2} />
          {shown.map((p) =>
            p.event ? (
              <g key={p.r}>
                <circle cx={x(p.r - 1)} cy={y(frames[p.r - 1].cwnd)} r={6} fill="none" stroke={p.event === "timeout" ? C.bad : C.swap} strokeWidth={2} />
                <text x={x(p.r - 1)} y={y(frames[p.r - 1].cwnd) - 10} textAnchor="middle" fontSize="9" fontWeight={700} fill={p.event === "timeout" ? C.bad : C.swap}>
                  {p.event === "timeout" ? "timeout" : "3 dup ACKs"}
                </text>
              </g>
            ) : null,
          )}
          <circle cx={x(f.r)} cy={y(f.cwnd)} r={4.5} fill={C.active} />
          <line x1={40} x2={W - 20} y1={H - 28} y2={H - 28} stroke="#cbd5e1" />
          <line x1={40} x2={40} y1={14} y2={H - 28} stroke="#cbd5e1" />
          {[0, 10, 20, 30, 40].map((r) => (
            <text key={r} x={x(r)} y={H - 12} textAnchor="middle" fontSize="9" fill={C.faint}>
              {r}
            </text>
          ))}
          <text x={W / 2} y={H - 1} textAnchor="middle" fontSize="9" fill={C.faint}>
            round trips
          </text>
          {[0, 20, 40, 60].map((v) => (
            <text key={v} x={34} y={y(v) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              {v}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <span>
          <span className="font-semibold" style={{ color: C.active }}>
            ━
          </span>{" "}
          cwnd (segments in flight)
        </span>
        <span>
          <span className="font-semibold" style={{ color: C.pivot }}>
            ┅
          </span>{" "}
          ssthresh
        </span>
      </div>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="cwnd" value={f.cwnd} color={C.active} />
        <Stat label="ssthresh" value={f.ssthresh} color={C.pivot} />
        <Stat label="avg delivered / RTT" value={avg.toFixed(1)} color={C.done} />
      </div>
      <Narration tone={f.event === "timeout" ? "bad" : f.event ? "warn" : "info"}>
        <span className="font-semibold">Round {f.r}. </span>
        {f.note}
        {s.atEnd && ` ${losses} loss event${losses === 1 ? "" : "s"}. Compare Reno and Tahoe: Reno's sawtooth stays near capacity, Tahoe keeps falling back to 1.`}
      </Narration>
    </div>
  );
}
