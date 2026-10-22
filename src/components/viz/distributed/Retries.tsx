"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Segmented, Stat } from "../kit";

type Policy = "none" | "immediate" | "fixed" | "exp" | "jitter";

const TICKS = 300; // 100 ms each → 30 s
const CLIENTS = 220;
const CAPACITY = 30;
const OUTAGE: [number, number] = [20, 60];
const MAX_ATTEMPTS = 7;

const LABEL: Record<Policy, string> = {
  none: "No retries",
  immediate: "Retry immediately",
  fixed: "Fixed 1 s delay",
  exp: "Exponential backoff",
  jitter: "Exponential + jitter",
};

function simulate(policy: Policy) {
  const rand = mulberry32(42);
  const next = Array.from({ length: CLIENTS }, () => Math.floor(rand() * 10));
  const attempt = Array(CLIENTS).fill(0);
  const load: number[] = [];
  let failed = 0;
  let gaveUp = 0;
  let recoveredAt = -1;
  for (let t = 0; t < TICKS; t++) {
    const senders = [];
    for (let c = 0; c < CLIENTS; c++) if (next[c] === t) senders.push(c);
    load.push(senders.length);
    const down = t >= OUTAGE[0] && t < OUTAGE[1];
    // when overloaded, a random subset fails
    const okCount = down ? 0 : Math.min(senders.length, CAPACITY);
    const order = senders.sort(() => rand() - 0.5);
    order.forEach((c, i) => {
      const ok = i < okCount;
      if (ok) {
        attempt[c] = 0;
        next[c] = t + 8 + Math.floor(rand() * 5);
        return;
      }
      failed++;
      attempt[c]++;
      if (policy === "none" || attempt[c] > MAX_ATTEMPTS) {
        if (policy !== "none") gaveUp++;
        attempt[c] = 0;
        next[c] = t + 8 + Math.floor(rand() * 5);
        return;
      }
      const base = 2 * 2 ** (attempt[c] - 1); // 200 ms, 400 ms, 800 ms …
      const delay =
        policy === "immediate" ? 1 : policy === "fixed" ? 10 : policy === "exp" ? Math.min(base, 80) : 1 + Math.floor(rand() * Math.min(base, 80));
      next[c] = t + delay;
    });
    if (t > OUTAGE[1] && recoveredAt < 0 && senders.length <= CAPACITY && load.slice(-10).every((x) => x <= CAPACITY)) recoveredAt = t;
  }
  return { load, failed, gaveUp, recoveredAt, peak: Math.max(...load) };
}

export default function Retries() {
  const [policy, setPolicy] = useState<Policy>("immediate");
  const all = useMemo(() => Object.fromEntries((Object.keys(LABEL) as Policy[]).map((p) => [p, simulate(p)])) as Record<Policy, ReturnType<typeof simulate>>, []);
  const sim = all[policy];
  const maxY = Math.max(...Object.values(all).map((s) => s.peak), CAPACITY * 2);
  const W = 640;
  const H = 220;
  const x = (t: number) => 30 + (t / TICKS) * (W - 40);
  const y = (v: number) => H - 20 - (v / maxY) * (H - 40);

  return (
    <div className="space-y-4">
      <Segmented value={policy} onChange={setPolicy} options={(Object.keys(LABEL) as Policy[]).map((p) => ({ value: p, label: LABEL[p] }))} />
      <div className="overflow-hidden rounded-xl border border-line bg-[#080c19]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          <rect x={x(OUTAGE[0])} y={10} width={x(OUTAGE[1]) - x(OUTAGE[0])} height={H - 30} fill={C.bad} opacity={0.12} />
          <text x={x(OUTAGE[0]) + 4} y={24} fontSize="10" fill={C.bad}>
            outage
          </text>
          <line x1={30} x2={W - 10} y1={y(CAPACITY)} y2={y(CAPACITY)} stroke={C.compare} strokeDasharray="6 4" />
          <text x={W - 12} y={y(CAPACITY) - 5} textAnchor="end" fontSize="10" fill={C.compare}>
            server capacity
          </text>
          <polyline points={sim.load.map((v, t) => `${x(t)},${y(v)}`).join(" ")} fill="none" stroke={C.active} strokeWidth={1.6} />
          <line x1={30} x2={W - 10} y1={H - 20} y2={H - 20} stroke="#2a355d" />
          {[0, 5, 10, 15, 20, 25, 30].map((s) => (
            <text key={s} x={x(s * 10)} y={H - 6} textAnchor="middle" fontSize="9" fill={C.faint}>
              {s}s
            </text>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="peak requests / 100 ms" value={sim.peak} color={sim.peak > CAPACITY * 2 ? C.bad : C.text} />
        <Stat label="failed attempts" value={sim.failed.toLocaleString()} color={C.bad} />
        <Stat label="clients gave up" value={sim.gaveUp} color={C.compare} />
        <Stat label="stable again at" value={sim.recoveredAt < 0 ? "never" : `${(sim.recoveredAt / 10).toFixed(1)} s`} color={sim.recoveredAt < 0 || sim.recoveredAt > 120 ? C.bad : C.done} />
      </div>
      <Narration tone={policy === "jitter" ? "good" : policy === "immediate" || policy === "fixed" ? "bad" : "info"}>
        {policy === "none" && "Without retries every request during the outage simply fails — users see errors, but the server isn't hammered."}
        {policy === "immediate" && "Immediate retries multiply traffic exactly when the server is weakest. After recovery the backlog arrives at once, overloads it again, causes more failures… a retry storm."}
        {policy === "fixed" && "A fixed delay still synchronizes clients: everyone who failed together retries together, producing waves that keep exceeding capacity."}
        {policy === "exp" && "Exponential backoff spaces attempts out, but clients that failed at the same moment still retry at the same moments — visible spikes."}
        {policy === "jitter" && "Exponential backoff with full jitter (random delay in [0, base·2ⁿ]) de-synchronizes clients: load stays smooth and the service recovers fastest. Add retry budgets and circuit breakers on top."}
      </Narration>
    </div>
  );
}
