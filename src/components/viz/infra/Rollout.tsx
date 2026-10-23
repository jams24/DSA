"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

type Strategy = "recreate" | "rolling" | "bluegreen" | "canary";

interface Minute {
  v1: number;
  v2: number;
  starting: number; // pods booting (not serving)
  share: number; // fraction of traffic on v2
  down: boolean;
  note: string;
}

const REQ = 10_000; // requests per minute
const BAD_ERR = 0.3;
const BASE_ERR = 0.001;
const ALERT = 0.05;
const MINUTES = 10;

const LABEL: Record<Strategy, string> = { recreate: "Recreate", rolling: "Rolling update", bluegreen: "Blue / green", canary: "Canary + auto-rollback" };

const m = (v1: number, v2: number, share: number, note: string, extra: Partial<Minute> = {}): Minute => ({ v1, v2, starting: 0, share, down: false, note, ...extra });

function plan(s: Strategy, bad: boolean): Minute[] {
  const start = m(10, 0, 0, "10 pods of v1 serving all traffic. Deploying v2.");
  let out: Minute[];
  if (s === "recreate") {
    out = [
      start,
      m(0, 0, 0, "Recreate terminates every v1 pod first. Nothing is serving: this is downtime.", { down: true }),
      m(0, 0, 0, "v2 pods are pulling images and starting. Still down.", { down: true, starting: 10 }),
      m(0, 10, 1, bad ? "v2 is live for 100% of users, and 30% of requests fail." : "v2 is live. Simple, and the two versions never run side by side, but you paid with an outage."),
    ];
    if (bad)
      out.push(
        m(0, 10, 1, "The error-rate alert fires. The on-call decides to roll back."),
        m(0, 0, 0, "Rolling back with Recreate means another full outage.", { down: true }),
        m(0, 0, 0, "v1 pods starting…", { down: true, starting: 10 }),
        m(10, 0, 0, "Back on v1 after two outages plus two minutes of errors at full blast radius."),
      );
  } else if (s === "rolling") {
    out = [
      start,
      m(8, 2, 0.2, bad ? "maxSurge 2, maxUnavailable 0: 2 v2 pods pass their readiness probe and join. But the bug returns 500s, which readiness probes don't catch. 20% of traffic hits v2." : "maxSurge 2, maxUnavailable 0: two v2 pods start and become ready before two v1 pods are removed. Capacity never drops.", { starting: 2 }),
      m(6, 4, 0.4, bad ? "The rollout keeps going on its own. Overall error rate is now 12%: the alert fires and pages the on-call." : "Swap two more. Both versions serve traffic side by side, so v1 and v2 must be compatible (APIs, DB schema).", { starting: 2 }),
      m(4, 6, 0.6, bad ? "The human is still reading the dashboard while the rollout continues: 60% on v2." : "60% on v2.", { starting: 2 }),
    ];
    if (bad)
      out.push(
        m(6, 4, 0.4, "kubectl rollout undo deploy/web: rolling back, two pods at a time.", { starting: 2 }),
        m(8, 2, 0.2, "Rolling back…", { starting: 2 }),
        m(10, 0, 0, "Back on v1. No downtime, but a large share of users saw errors for several minutes."),
      );
    else out.push(m(2, 8, 0.8, "80% on v2.", { starting: 2 }), m(0, 10, 1, "Rollout complete with zero downtime, using only 2 extra pods at any moment."));
  } else if (s === "bluegreen") {
    out = [
      m(10, 0, 0, "Blue (v1, 10 pods) serves all traffic."),
      m(10, 0, 0, "Green (v2, 10 pods) is started alongside it: double the capacity, double the cost during the deploy.", { starting: 10 }),
      m(10, 10, 0, "Green is ready. Smoke tests run against it without any user traffic."),
      m(10, 10, 1, bad ? "The router or load balancer flips 100% of traffic to green at once, and the bug hits every user." : "The router flips 100% of traffic to green at once. Instant cutover, no version mixing."),
    ];
    if (bad)
      out.push(
        m(10, 10, 1, "The alert fires. Blue is still running and warm…"),
        m(10, 10, 0, "Flip back: rollback is a single switch and takes seconds."),
        m(10, 0, 0, "Green is torn down for debugging. Two minutes of full-blast errors, but the fastest recovery."),
      );
    else out.push(m(10, 10, 1, "Blue stays up for a while as an instant rollback target."), m(0, 10, 1, "Blue is scaled down. Done."));
  } else {
    out = [start, m(10, 1, 0.05, bad ? "One canary pod gets 5% of traffic. Automated analysis compares its error rate and latency against the v1 baseline." : "One canary pod gets 5% of traffic. Automated analysis compares its metrics against the v1 baseline.")];
    if (bad)
      out.push(
        m(10, 1, 0.05, "Canary error rate is 30% vs a 0.1% baseline: the analysis fails."),
        m(10, 0, 0, "Automatic rollback: the canary is removed. Only 5% of traffic saw errors, for two minutes, and no human was needed."),
      );
    else
      out.push(
        m(9, 3, 0.25, "Analysis passed: promote to 25%."),
        m(6, 6, 0.5, "Still healthy: 50%."),
        m(0, 10, 1, "100% on v2. Slower than the others, but every step was gated on real production metrics."),
      );
  }
  while (out.length < MINUTES) out.push({ ...out[out.length - 1], note: out[out.length - 1].note.startsWith("Steady") ? out[out.length - 1].note : "Steady state." });
  return out;
}

const errRate = (x: Minute, bad: boolean) => (x.down ? 1 : x.share * (bad ? BAD_ERR : BASE_ERR) + (1 - x.share) * BASE_ERR);

function summary(s: Strategy, bad: boolean) {
  const p = plan(s, bad);
  return {
    failed: Math.round(p.reduce((a, x) => a + errRate(x, bad) * REQ, 0)),
    downtime: p.filter((x) => x.down).length,
    peak: Math.max(...p.map((x) => x.v1 + x.v2 + x.starting)),
  };
}

export default function Rollout() {
  const [strategy, setStrategy] = useState<Strategy>("rolling");
  const [bad, setBad] = useState(true);
  const frames = useMemo(() => plan(strategy, bad), [strategy, bad]);
  const s = useStepper(frames, 1300);
  const f = s.frame;
  const shown = frames.slice(0, s.i + 1);
  const failed = Math.round(shown.reduce((a, x) => a + errRate(x, bad) * REQ, 0));
  const rate = errRate(f, bad);
  const v2Color = bad ? C.bad : C.pivot;

  const boxes = [
    ...Array.from({ length: f.v1 }, () => "v1"),
    ...Array.from({ length: f.v2 }, () => "v2"),
    ...Array.from({ length: f.starting }, () => "boot"),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={strategy} onChange={setStrategy} options={(Object.keys(LABEL) as Strategy[]).map((k) => ({ value: k, label: LABEL[k] }))} />
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={bad} onChange={(e) => setBad(e.target.checked)} className="accent-[#e11d48]" />
          v2 has a bug (30% of its requests fail)
        </label>
      </div>

      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-ink">Minute {s.i}</span>
          <span className={clsx("rounded-full px-2 py-0.5 font-semibold", f.down ? "bg-rose/15 text-rose" : "bg-emerald/10 text-emerald")}>{f.down ? "DOWN" : "serving"}</span>
        </div>
        <div className="mt-3 flex min-h-[2.5rem] flex-wrap gap-1.5">
          {boxes.map((b, i) => (
            <span
              key={i}
              className="grid h-9 w-11 place-items-center rounded-lg border text-[11px] font-bold"
              style={{
                borderColor: b === "v1" ? `${C.sky}88` : b === "v2" ? `${v2Color}88` : "#cbd5e1",
                background: b === "v1" ? `${C.sky}1a` : b === "v2" ? `${v2Color}1a` : "#f1f5f9",
                color: b === "v1" ? C.sky : b === "v2" ? v2Color : C.faint,
              }}
            >
              {b === "boot" ? "…" : b}
            </span>
          ))}
          {boxes.length === 0 && <span className="text-sm text-rose">no pods serving</span>}
        </div>
        <div className="mt-4 text-[11px] text-faint">Traffic split</div>
        <div className="mt-1 flex h-4 overflow-hidden rounded-full bg-line">
          {!f.down && (
            <>
              <div className="h-full transition-all duration-500" style={{ width: `${(1 - f.share) * 100}%`, background: C.sky }} />
              <div className="h-full transition-all duration-500" style={{ width: `${f.share * 100}%`, background: v2Color }} />
            </>
          )}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
          <span>v1 {f.down ? 0 : Math.round((1 - f.share) * 100)}%</span>
          <span>v2 {f.down ? 0 : Math.round(f.share * 100)}%</span>
        </div>
        <div className="mt-4 flex h-16 items-end gap-1">
          {frames.map((x, i) => {
            const r = errRate(x, bad);
            return (
              <div key={i} className="relative flex-1" title={`minute ${i}: ${(r * 100).toFixed(1)}% errors`}>
                <div className="rounded-t" style={{ height: `${Math.max(2, Math.min(1, r / 0.35) * 56)}px`, background: i <= s.i ? (r > ALERT ? C.bad : C.done) : "#e2e8f0" }} />
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-[10px] text-faint">error rate per minute (red = above the 5% alert threshold)</div>
      </div>

      <StepControls s={s} />
      <Narration tone={f.down || rate > ALERT ? "bad" : s.atEnd ? "good" : "info"}>{f.note}</Narration>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="error rate now" value={`${(rate * 100).toFixed(1)}%`} color={rate > ALERT ? C.bad : C.done} />
        <Stat label="failed requests" value={failed.toLocaleString()} color={failed > 1000 ? C.bad : C.text} />
        <Stat label="pods running" value={f.v1 + f.v2 + f.starting} color={C.pivot} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">All strategies, {bad ? "buggy" : "healthy"} v2</div>
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="text-faint">
            <tr>
              <th className="py-1 font-medium">strategy</th>
              <th className="py-1 text-right font-medium">failed requests</th>
              <th className="py-1 text-right font-medium">downtime</th>
              <th className="py-1 text-right font-medium">peak pods</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {(Object.keys(LABEL) as Strategy[]).map((k) => {
              const r = summary(k, bad);
              return (
                <tr key={k} className={clsx("border-t border-line", k === strategy && "font-semibold text-ink")}>
                  <td className="py-1.5 font-sans">{LABEL[k]}</td>
                  <td className="py-1.5 text-right">{r.failed.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{r.downtime} min</td>
                  <td className="py-1.5 text-right">{r.peak}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
