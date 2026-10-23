"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, PlayPause, Segmented, SmallBtn, Stat, useSimLoop } from "../kit";

type Strategy = "eager" | "coop";

interface Consumer {
  id: string;
  alive: boolean; // false = crashed, still in the group until the session times out
  diedAt: number;
}

interface Ev {
  t: number;
  text: string;
  tone: string;
}

const P = 6;
const RATE = 12; // records/s produced per partition
const CAP = 30; // records/s one consumer can process
const SESSION_MS = 4500; // session.timeout.ms (45 s by default; shortened)
const ROUND_MS = 1500; // one join/sync round
const COLORS = [C.active, C.pivot, C.compare, C.done, C.swap, C.sky, C.lime, C.orange];

function rangeAssign(members: string[]): (string | null)[] {
  const out: (string | null)[] = Array(P).fill(null);
  if (!members.length) return out;
  const sorted = [...members].sort();
  const per = Math.floor(P / sorted.length);
  const extra = P % sorted.length;
  let p = 0;
  sorted.forEach((m, i) => {
    const n = per + (i < extra ? 1 : 0);
    for (let k = 0; k < n; k++) out[p++] = m;
  });
  return out;
}

function stickyAssign(prev: (string | null)[], members: string[]): (string | null)[] {
  const out: (string | null)[] = Array(P).fill(null);
  if (!members.length) return out;
  const max = Math.ceil(P / members.length);
  const load = new Map(members.map((m) => [m, 0]));
  // keep current owners while they're under quota
  prev.forEach((o, p) => {
    if (o && load.has(o) && (load.get(o) ?? 0) < max) {
      out[p] = o;
      load.set(o, (load.get(o) ?? 0) + 1);
    }
  });
  // trim anyone above the floor if others are starving
  const min = Math.floor(P / members.length);
  for (let p = 0; p < P; p++) {
    if (out[p] !== null) continue;
    const m = [...load].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
    out[p] = m;
    load.set(m, (load.get(m) ?? 0) + 1);
  }
  for (const [m, n] of load) {
    if (n >= min) continue;
    const donor = [...load].sort((a, b) => b[1] - a[1])[0][0];
    const p = out.findIndex((o) => o === donor);
    if (p >= 0 && (load.get(donor) ?? 0) > min + 0) {
      out[p] = m;
      load.set(donor, (load.get(donor) ?? 0) - 1);
      load.set(m, n + 1);
    }
  }
  return out;
}

export default function Rebalance() {
  const [strategy, setStrategy] = useState<Strategy>("eager");
  const [running, setRunning] = useState(true);
  const t = useRef(0);
  const consumers = useRef<Consumer[]>([
    { id: "c1", alive: true, diedAt: 0 },
    { id: "c2", alive: true, diedAt: 0 },
  ]);
  const owner = useRef<(string | null)[]>(rangeAssign(["c1", "c2"]));
  const lag = useRef<number[]>(Array(P).fill(0));
  const reb = useRef<{ until: number; phase: 1 | 2; target: (string | null)[] } | null>(null);
  const count = useRef(0);
  const stoppedMs = useRef(0);
  const nextId = useRef(3);
  const events = useRef<Ev[]>([{ t: 0, text: "Group orders-svc: 2 consumers, 6 partitions", tone: C.muted }]);
  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: t.current, text, tone }, ...events.current].slice(0, 8);
  };

  const startRebalance = (why: string) => {
    const members = consumers.current.map((c) => c.id);
    count.current++;
    if (strategy === "eager") {
      owner.current = Array(P).fill(null);
      reb.current = { until: t.current + ROUND_MS, phase: 2, target: rangeAssign(members) };
      log(`${why} → EAGER rebalance: every consumer revokes ALL partitions and stops`, C.bad);
    } else {
      const target = stickyAssign(owner.current, members);
      const moving = owner.current.map((o, p) => (o !== null && o !== target[p] ? p : -1)).filter((p) => p >= 0);
      moving.forEach((p) => (owner.current[p] = null));
      reb.current = { until: t.current + ROUND_MS, phase: 1, target };
      log(`${why} → COOPERATIVE rebalance: only ${moving.length ? `P${moving.join(", P")}` : "unowned partitions"} revoked, the rest keep flowing`, C.compare);
    }
  };

  useSimLoop(running, (dt) => {
    t.current += dt;
    const now = t.current;
    const sec = dt / 1000;

    // crashed consumers leave the group when their session times out
    const expired = consumers.current.filter((c) => !c.alive && now - c.diedAt >= SESSION_MS);
    if (expired.length) {
      consumers.current = consumers.current.filter((c) => !expired.includes(c));
      owner.current = owner.current.map((o) => (o && expired.some((e) => e.id === o) ? null : o));
      startRebalance(`${expired.map((e) => e.id).join(", ")} missed heartbeats for session.timeout.ms`);
    }

    if (reb.current && now >= reb.current.until) {
      const r = reb.current;
      if (r.phase === 1) {
        // second round: hand the revoked partitions to their new owners
        reb.current = { until: now + ROUND_MS, phase: 2, target: r.target };
      } else {
        owner.current = r.target.map((m, p) => m ?? owner.current[p]);
        reb.current = null;
        log("Rebalance complete: new assignment active", C.done);
      }
    }

    // produce + consume
    const alive = new Set(consumers.current.filter((c) => c.alive).map((c) => c.id));
    const owned = new Map<string, number>();
    owner.current.forEach((o) => o && owned.set(o, (owned.get(o) ?? 0) + 1));
    let stopped = 0;
    for (let p = 0; p < P; p++) {
      lag.current[p] += RATE * sec;
      const o = owner.current[p];
      if (o && alive.has(o)) {
        const share = CAP / (owned.get(o) ?? 1);
        lag.current[p] = Math.max(0, lag.current[p] - share * sec);
      } else stopped++;
    }
    stoppedMs.current += stopped * dt;
  });

  const add = () => {
    const id = `c${nextId.current++}`;
    consumers.current = [...consumers.current, { id, alive: true, diedAt: 0 }];
    startRebalance(`${id} joins the group`);
  };
  const leave = (id: string) => {
    consumers.current = consumers.current.filter((c) => c.id !== id);
    owner.current = owner.current.map((o) => (o === id ? null : o));
    startRebalance(`${id} leaves cleanly (LeaveGroup)`);
  };
  const crash = (id: string) => {
    const c = consumers.current.find((x) => x.id === id);
    if (!c || !c.alive) return;
    c.alive = false;
    c.diedAt = t.current;
    log(`${id} crashed (kill -9). Its partitions stall until the session times out.`, C.bad);
  };
  const reset = () => {
    t.current = 0;
    consumers.current = [
      { id: "c1", alive: true, diedAt: 0 },
      { id: "c2", alive: true, diedAt: 0 },
    ];
    owner.current = rangeAssign(["c1", "c2"]);
    lag.current = Array(P).fill(0);
    reb.current = null;
    count.current = 0;
    stoppedMs.current = 0;
    nextId.current = 3;
    events.current = [{ t: 0, text: "Reset: 2 consumers, 6 partitions", tone: C.muted }];
  };

  const color = (id: string | null) => (id ? COLORS[(Number(id.slice(1)) - 1) % COLORS.length] : C.base);
  const totalLag = lag.current.reduce((a, b) => a + b, 0);
  const idle = consumers.current.filter((c) => c.alive && !owner.current.includes(c.id) && !reb.current).length;
  const tip = idle
    ? { tone: "warn" as const, text: `${idle} consumer(s) idle: a partition is consumed by at most one member of a group, so consumers beyond the partition count do nothing. Partition count caps a group's parallelism.` }
    : reb.current
      ? strategy === "eager"
        ? { tone: "bad" as const, text: "Stop-the-world: during an eager rebalance no partition is consumed, so lag grows on all of them. Large groups that rebalance often (deploys, autoscaling) suffer badly." }
        : { tone: "warn" as const, text: "Incremental cooperative rebalancing: two rounds, but only the partitions that actually move pause. Everything else keeps flowing." }
      : { tone: "info" as const, text: "Try both strategies: add a consumer, remove one cleanly, and crash one. A crash is worse than a clean leave because the group waits for session.timeout.ms first." };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: "eager", label: "Eager (range)" },
            { value: "coop", label: "Cooperative sticky" },
          ]}
        />
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn onClick={add} tone="good" disabled={consumers.current.length >= 8}>
          + add consumer
        </SmallBtn>
        <SmallBtn onClick={reset}>reset</SmallBtn>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="state" value={<span className="text-sm">{reb.current ? `Rebalancing (round ${reb.current.phase === 1 ? 1 : strategy === "coop" ? 2 : 1})` : "Stable"}</span>} color={reb.current ? C.compare : C.done} />
        <Stat label="rebalances" value={count.current} />
        <Stat label="total lag" value={Math.round(totalLag)} color={totalLag > 200 ? C.bad : C.text} />
        <Stat label="partition-seconds stopped" value={(stoppedMs.current / 1000).toFixed(0)} color={C.compare} />
      </div>

      <div className="flex flex-wrap gap-2">
        {consumers.current.map((c) => {
          const n = owner.current.filter((o) => o === c.id).length;
          return (
            <div key={c.id} className={clsx("rounded-xl border-2 bg-panel p-2", !c.alive && "opacity-60")} style={{ borderColor: color(c.id) }}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold" style={{ color: color(c.id) }}>
                  {c.id}
                </span>
                <span className="text-[10px] text-faint">{c.alive ? `${n} partition${n === 1 ? "" : "s"}` : `dead · ${Math.max(0, Math.ceil((SESSION_MS - (t.current - c.diedAt)) / 1000))}s to timeout`}</span>
              </div>
              {c.alive && (
                <div className="mt-1 flex gap-1">
                  <SmallBtn onClick={() => leave(c.id)} className="h-6 px-2 text-[10.5px]">
                    leave
                  </SmallBtn>
                  <SmallBtn onClick={() => crash(c.id)} tone="danger" className="h-6 px-2 text-[10.5px]">
                    crash
                  </SmallBtn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        {lag.current.map((l, p) => {
          const o = owner.current[p];
          const dead = o && !consumers.current.find((c) => c.id === o)?.alive;
          return (
            <div key={p} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-mono text-[11px] text-dim">P{p}</span>
              <span className="w-24 shrink-0 font-mono text-[11px]" style={{ color: o && !dead ? color(o) : C.bad }}>
                {o ? (dead ? `${o} (dead)` : o) : "unassigned"}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (l / 150) * 100)}%`, background: l > 60 ? C.bad : C.compare }} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-dim tabular-nums">{Math.round(l)}</span>
            </div>
          );
        })}
        <div className="text-right text-[10px] text-faint">consumer lag per partition (records)</div>
      </div>

      <Narration tone={tip.tone}>{tip.text}</Narration>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="space-y-0.5 font-mono text-[11px]">
          {events.current.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-faint tabular-nums">{(e.t / 1000).toFixed(1)}s</span>
              <span style={{ color: e.tone }}>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
