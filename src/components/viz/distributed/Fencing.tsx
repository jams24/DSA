"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

interface Ev {
  lane: number; // 0 lock service, 1 client A, 2 client B, 3 storage
  step: number;
  label: string;
  color: string;
  to?: number;
}

interface Frame {
  upto: number;
  storage: string;
  maxToken: number;
  msg: string;
  tone?: "info" | "good" | "bad" | "warn";
}

const LANES = ["🔐 Lock service", "🅰️ Client A", "🅱️ Client B", "🗄️ Storage"];

export default function Fencing() {
  const [fenced, setFenced] = useState(true);

  const { events, frames } = useMemo(() => {
    const events: Ev[] = [
      { lane: 1, step: 0, label: "acquire lease", color: C.active, to: 0 },
      { lane: 0, step: 1, label: "granted · token 33 · TTL 10s", color: C.done, to: 1 },
      { lane: 1, step: 2, label: "⏸ GC pause (15 s)", color: C.pivot },
      { lane: 0, step: 3, label: "lease 33 expired", color: C.compare },
      { lane: 2, step: 4, label: "acquire lease", color: C.active, to: 0 },
      { lane: 0, step: 5, label: "granted · token 34", color: C.done, to: 2 },
      { lane: 2, step: 6, label: "write 'B' (token 34)", color: C.active, to: 3 },
      { lane: 1, step: 7, label: "wakes, still thinks it holds the lock", color: C.pivot },
      { lane: 1, step: 8, label: "write 'A' (token 33)", color: C.bad, to: 3 },
    ];
    const frames: Frame[] = [
      { upto: -1, storage: "—", maxToken: 0, msg: "Two clients must not write the same file at once, so they use a lock with a lease (auto-expiring after 10 s)." },
      { upto: 0, storage: "—", maxToken: 0, msg: "Client A asks the lock service for the lease." },
      { upto: 1, storage: "—", maxToken: 0, msg: "Granted with fencing token 33 — a number that increases every time the lock is granted." },
      { upto: 2, storage: "—", maxToken: 0, msg: "A hits a long stop-the-world GC pause (or a VM migration, or a slow disk). It doesn't know time has passed.", tone: "warn" },
      { upto: 3, storage: "—", maxToken: 0, msg: "The lease expires at the lock service. From the service's point of view A is gone.", tone: "warn" },
      { upto: 4, storage: "—", maxToken: 0, msg: "Client B asks for the lock…" },
      { upto: 5, storage: "—", maxToken: 0, msg: "…and correctly gets it, with token 34." },
      { upto: 6, storage: "B", maxToken: 34, msg: "B writes. Storage remembers the highest token it has seen: 34.", tone: "good" },
      { upto: 7, storage: "B", maxToken: 34, msg: "A wakes up. Its local view: 'I hold the lock' — it has no way to know otherwise without checking.", tone: "warn" },
      fenced
        ? { upto: 8, storage: "B", maxToken: 34, msg: "A writes with token 33. Storage sees 33 < 34 and REJECTS it. Data is safe — the resource itself enforces the lock.", tone: "good" }
        : { upto: 8, storage: "A 💥", maxToken: 34, msg: "Without fencing, storage accepts A's write and silently clobbers B's. Both clients believed they held the lock — a lease alone cannot prevent this.", tone: "bad" },
    ];
    return { events, frames };
  }, [fenced]);

  const s = useStepper(frames, 1500);
  const f = s.frame;
  const X = (step: number) => 150 + step * 58;
  const Y = (lane: number) => 50 + lane * 70;

  return (
    <div className="space-y-4">
      <Segmented
        value={fenced ? "y" : "n"}
        onChange={(v) => setFenced(v === "y")}
        options={[
          { value: "y", label: "With fencing tokens" },
          { value: "n", label: "Lease only (unsafe)" },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
        <svg viewBox="0 0 700 300" className="block w-full min-w-[620px]">
          <defs>
            <marker id="fence-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {LANES.map((l, i) => (
            <g key={l}>
              <text x={10} y={Y(i) + 4} fontSize="11.5" fill={C.text}>
                {l}
              </text>
              <line x1={135} y1={Y(i)} x2={690} y2={Y(i)} stroke="#1e2747" strokeWidth={2} />
            </g>
          ))}
          {fenced && f.maxToken > 0 && (
            <text x={680} y={Y(3) + 22} textAnchor="end" fontSize="10" fill={C.compare} fontFamily="monospace">
              max token seen: {f.maxToken}
            </text>
          )}
          <text x={680} y={Y(3) - 10} textAnchor="end" fontSize="11" fill={f.storage.includes("💥") ? C.bad : C.done} fontFamily="monospace">
            file = {f.storage}
          </text>
          {events.map((e, i) => {
            if (i > f.upto) return null;
            const x = X(e.step);
            const y = Y(e.lane);
            const rejected = fenced && i === 8;
            return (
              <g key={i} className="animate-pop">
                {e.to !== undefined && (
                  <line x1={x} y1={y} x2={x + 52} y2={Y(e.to) + (Y(e.to) > y ? -8 : 8)} stroke={rejected ? C.bad : e.color} strokeWidth={2} markerEnd="url(#fence-arrow)" strokeDasharray={rejected ? "5 4" : undefined} />
                )}
                <circle cx={x} cy={y} r={6} fill={e.color} />
                <text x={x} y={y + (e.lane === 3 ? 22 : -12)} textAnchor="middle" fontSize="9.5" fill={e.color}>
                  {e.label}
                </text>
                {rejected && (
                  <text x={x + 52} y={Y(3) + 22} textAnchor="middle" fontSize="11" fontWeight="bold" fill={C.bad}>
                    ✗ 33 &lt; 34
                  </text>
                )}
              </g>
            );
          })}
          {f.upto >= 2 && f.upto < 7 && <rect x={X(2) - 6} y={Y(1) - 4} width={X(7) - X(2)} height={8} rx={4} fill={C.pivot} opacity={0.35} />}
        </svg>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
