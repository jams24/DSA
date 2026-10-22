"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, Segmented, Slider, SmallBtn, useSimLoop } from "../kit";

const LIMIT = 5; // requests per window / bucket capacity
const WINDOW = 2000; // ms
const REFILL = LIMIT / (WINDOW / 1000); // tokens per second (same average rate)
const SPAN = 10_000; // ms of history shown

type Lane = "token" | "fixed" | "sliding";

interface Ev {
  t: number;
  ok: boolean;
}

export default function RateLimiter() {
  const [running, setRunning] = useState(false);
  const [pattern, setPattern] = useState<"steady" | "bursty">("bursty");
  const [rate, setRate] = useState(3);
  const now = useRef(0);
  const acc = useRef(0);
  const burstClock = useRef(0);
  const events = useRef<Record<Lane, Ev[]>>({ token: [], fixed: [], sliding: [] });
  const tokens = useRef(LIMIT);
  const fixed = useRef({ start: 0, count: 0 });
  const log = useRef<number[]>([]);
  const totals = useRef<Record<Lane, { ok: number; no: number }>>({ token: { ok: 0, no: 0 }, fixed: { ok: 0, no: 0 }, sliding: { ok: 0, no: 0 } });

  function arrive(t: number) {
    // token bucket
    const tbOk = tokens.current >= 1;
    if (tbOk) tokens.current -= 1;
    // fixed window
    if (t - fixed.current.start >= WINDOW) fixed.current = { start: Math.floor(t / WINDOW) * WINDOW, count: 0 };
    const fwOk = fixed.current.count < LIMIT;
    if (fwOk) fixed.current.count++;
    // sliding window log
    log.current = log.current.filter((x) => x > t - WINDOW);
    const swOk = log.current.length < LIMIT;
    if (swOk) log.current.push(t);
    const rec = (lane: Lane, ok: boolean) => {
      events.current[lane].push({ t, ok });
      totals.current[lane][ok ? "ok" : "no"]++;
    };
    rec("token", tbOk);
    rec("fixed", fwOk);
    rec("sliding", swOk);
  }

  useSimLoop(running, (dt, t) => {
    if (!now.current) {
      fixed.current.start = Math.floor(t / WINDOW) * WINDOW;
    }
    now.current = t;
    tokens.current = Math.min(LIMIT, tokens.current + (dt / 1000) * REFILL);
    if (pattern === "steady") {
      acc.current += (dt / 1000) * rate;
      while (acc.current >= 1) {
        acc.current -= 1;
        arrive(t);
      }
    } else {
      burstClock.current += dt;
      if (burstClock.current > 3200) {
        burstClock.current = 0;
        const n = 4 + Math.floor(Math.random() * 6);
        for (let k = 0; k < n; k++) arrive(t - (n - 1 - k) * 25);
      }
      acc.current += (dt / 1000) * 0.6;
      while (acc.current >= 1) {
        acc.current -= 1;
        arrive(t);
      }
    }
    for (const lane of Object.keys(events.current) as Lane[]) events.current[lane] = events.current[lane].filter((e) => e.t > t - SPAN);
  });

  function burst(n: number) {
    const t = now.current || performance.now();
    for (let k = 0; k < n; k++) arrive(t - (n - 1 - k) * 20);
  }

  const t = now.current;
  const lanes: { id: Lane; title: string; desc: string }[] = [
    { id: "token", title: "Token bucket", desc: `capacity ${LIMIT}, refills ${REFILL}/s — allows short bursts up to the bucket size, then the average rate.` },
    { id: "fixed", title: "Fixed window counter", desc: `${LIMIT} per ${WINDOW / 1000}s window — cheap, but a burst straddling a boundary can let ${LIMIT * 2} through almost at once.` },
    { id: "sliding", title: "Sliding window log", desc: `${LIMIT} in any rolling ${WINDOW / 1000}s — exact, but stores a timestamp per request (the sliding-window counter approximates it with two counters).` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <Segmented
          value={pattern}
          onChange={setPattern}
          options={[
            { value: "bursty", label: "Bursty traffic" },
            { value: "steady", label: "Steady traffic" },
          ]}
        />
        {pattern === "steady" && (
          <div className="w-52">
            <Slider label="requests / sec" value={rate} min={1} max={8} onChange={setRate} />
          </div>
        )}
        <SmallBtn tone="danger" onClick={() => burst(10)} disabled={!running}>
          💥 send a burst of 10
        </SmallBtn>
      </div>

      <div className="space-y-3">
        {lanes.map((lane) => {
          const tot = totals.current[lane.id];
          return (
            <div key={lane.id} className="rounded-xl border border-line bg-[#080c19] p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-sm font-semibold text-ink">{lane.title}</span>
                <span className="font-mono text-[11px]">
                  <span className="text-emerald">✓ {tot.ok}</span> · <span className="text-rose">✗ {tot.no}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-10 flex-1 overflow-hidden rounded-lg bg-panel">
                  {lane.id === "fixed" &&
                    Array.from({ length: Math.ceil(SPAN / WINDOW) + 1 }, (_, k) => {
                      const boundary = Math.floor(t / WINDOW) * WINDOW - k * WINDOW;
                      const x = 100 - ((t - boundary) / SPAN) * 100;
                      return x >= 0 ? <div key={k} className="absolute top-0 h-full w-px bg-amber/40" style={{ left: `${x}%` }} /> : null;
                    })}
                  {lane.id === "sliding" && <div className="absolute top-0 h-full bg-violet/10" style={{ left: `${100 - (WINDOW / SPAN) * 100}%`, right: 0 }} />}
                  {events.current[lane.id].map((e, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full"
                      style={{ left: `${100 - ((t - e.t) / SPAN) * 100}%`, background: e.ok ? C.done : C.bad, boxShadow: `0 0 6px ${e.ok ? C.done : C.bad}` }}
                    />
                  ))}
                  <span className="absolute right-1 bottom-0.5 font-mono text-[9px] text-faint">now</span>
                </div>
                <div className="w-20 shrink-0 text-center">
                  {lane.id === "token" && (
                    <div className="relative mx-auto h-10 w-10 overflow-hidden rounded-b-xl border-2 border-t-0 border-sky">
                      <div className="absolute bottom-0 w-full bg-sky/50 transition-all" style={{ height: `${(tokens.current / LIMIT) * 100}%` }} />
                      <span className="relative font-mono text-[10px] leading-10 text-ink">{tokens.current.toFixed(1)}</span>
                    </div>
                  )}
                  {lane.id === "fixed" && (
                    <span className="font-mono text-xs text-amber">
                      {fixed.current.count}/{LIMIT}
                      <br />
                      <span className="text-[9px] text-faint">this window</span>
                    </span>
                  )}
                  {lane.id === "sliding" && (
                    <span className="font-mono text-xs text-violet">
                      {log.current.filter((x) => x > t - WINDOW).length}/{LIMIT}
                      <br />
                      <span className="text-[9px] text-faint">last {WINDOW / 1000}s</span>
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-dim">{lane.desc}</p>
            </div>
          );
        })}
      </div>
      <Narration>All three limiters see exactly the same requests (green = allowed, red = rejected with HTTP 429). Same average limit, very different behaviour under bursts.</Narration>
    </div>
  );
}
