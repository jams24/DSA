"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, PlayPause, Segmented, Slider, SmallBtn, Stat, useSimLoop } from "../kit";

type Scenario = "healthy" | "slow" | "deadlock" | "crash";

const SCEN: Record<Scenario, { label: string; warmup: number; hangAt?: number; exitAt?: number; hint: string }> = {
  healthy: { label: "Healthy app", warmup: 4, hint: "Starts in 4 s and stays healthy. Try the DB-down button." },
  slow: { label: "Slow start (45 s)", warmup: 45, hint: "A JVM app that needs 45 s to warm up. Turn the startup probe off and watch liveness kill it." },
  deadlock: { label: "Deadlocks at 30 s", warmup: 4, hangAt: 30, hint: "The process stays up but stops answering after 30 s. Only a liveness probe can fix this." },
  crash: { label: "Crashes on boot", warmup: 4, exitAt: 2, hint: "Exits with code 1 after 2 s (a missing env var). Watch the back-off double." },
};

const PERIOD = 5; // probe period, seconds (default is 10; shortened for the demo)
const FAIL = 3; // failureThreshold for liveness/readiness
const STARTUP_FAIL = 12; // 12 × 5 s = 60 s to start
const SIM_SPEED = 8; // simulated seconds per real second

type CState = "Running" | "Waiting" | "Terminated";

interface Ctr {
  state: CState;
  reason: string;
  startedAt: number;
  restarts: number;
  backoffUntil: number;
  started: boolean; // startup probe passed (or no startup probe)
  ready: boolean;
  liveFails: number;
  readyFails: number;
  startFails: number;
  nextProbe: number;
  last: { startup?: boolean; liveness?: boolean; readiness?: boolean };
}

const fresh = (t: number, restarts = 0): Ctr => ({
  state: "Running",
  reason: "",
  startedAt: t,
  restarts,
  backoffUntil: 0,
  started: false,
  ready: false,
  liveFails: 0,
  readyFails: 0,
  startFails: 0,
  nextProbe: t + PERIOD,
  last: {},
});

interface Ev {
  t: number;
  text: string;
  tone: string;
}

export default function Probes() {
  const [scenario, setScenario] = useState<Scenario>("slow");
  const [startupProbe, setStartupProbe] = useState(true);
  const [initialDelay, setInitialDelay] = useState(10);
  const [dbDown, setDbDown] = useState(false);
  const [liveChecksDb, setLiveChecksDb] = useState(false);
  const [running, setRunning] = useState(false);

  const t = useRef(0);
  const c = useRef<Ctr>(fresh(0));
  const hist = useRef<string[]>([]);
  const lastSec = useRef(0);
  const events = useRef<Ev[]>([]);
  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: t.current, text, tone }, ...events.current].slice(0, 8);
  };

  const reset = () => {
    t.current = 0;
    c.current = fresh(0);
    hist.current = [];
    lastSec.current = 0;
    events.current = [{ t: 0, text: "Container created and started", tone: C.active }];
  };
  if (events.current.length === 0) reset();

  const restart = (why: string) => {
    const k = c.current;
    const delay = Math.min(300, 10 * 2 ** k.restarts);
    k.state = "Waiting";
    k.reason = "CrashLoopBackOff";
    k.ready = false;
    k.backoffUntil = t.current + delay;
    k.restarts += 1;
    log(`${why} · back-off ${delay}s before restart #${k.restarts}`, C.bad);
  };

  useSimLoop(running, (dt) => {
    t.current += (dt / 1000) * SIM_SPEED;
    const now = t.current;
    const k = c.current;
    const sc = SCEN[scenario];

    if (k.state === "Waiting") {
      if (now >= k.backoffUntil) {
        c.current = fresh(now, k.restarts);
        log(`Back-off over: container restarted (restarts=${k.restarts})`, C.active);
      }
    } else if (k.state === "Running") {
      const up = now - k.startedAt;
      if (sc.exitAt !== undefined && up >= sc.exitAt) {
        k.state = "Terminated";
        k.reason = "Error (exit code 1)";
        k.ready = false;
        log("Process exited with code 1", C.bad);
        restart("Container terminated");
      } else if (now >= k.nextProbe) {
        k.nextProbe = now + PERIOD;
        const listening = up >= sc.warmup;
        const hung = sc.hangAt !== undefined && up >= sc.hangAt;
        const alive = listening && !hung && !(liveChecksDb && dbDown);
        const readyOk = listening && !hung && !dbDown;
        const useStartup = startupProbe;
        if (useStartup && !k.started) {
          k.last.startup = listening && !hung;
          if (k.last.startup) {
            k.started = true;
            log(`startupProbe passed after ${Math.round(up)}s: liveness and readiness take over`, C.done);
          } else if (++k.startFails >= STARTUP_FAIL) {
            log(`startupProbe failed ${STARTUP_FAIL}× (60 s budget)`, C.bad);
            restart("Killed by startupProbe");
            return;
          }
        } else {
          if (!useStartup) k.started = true;
          // readiness: gates traffic, never restarts
          k.last.readiness = readyOk;
          if (readyOk) {
            k.readyFails = 0;
            if (!k.ready) log("Readiness OK: pod added to Service endpoints", C.done);
            k.ready = true;
          } else if (++k.readyFails >= FAIL && k.ready) {
            k.ready = false;
            log(`Readiness failed ${FAIL}×: removed from endpoints (no restart)`, C.compare);
          }
          // liveness: restarts, honours initialDelaySeconds when there is no startup probe
          if (useStartup || up >= initialDelay) {
            k.last.liveness = alive;
            if (alive) k.liveFails = 0;
            else if (++k.liveFails >= FAIL) {
              log(`Liveness failed ${FAIL}×: kubelet kills the container`, C.bad);
              restart("Killed by livenessProbe");
              return;
            }
          }
        }
      }
    }

    const sec = Math.floor(now);
    while (lastSec.current < sec) {
      lastSec.current++;
      const st = c.current;
      hist.current.push(st.state !== "Running" ? "down" : st.ready ? "ready" : "notready");
      if (hist.current.length > 180) hist.current.shift();
    }
  });

  const k = c.current;
  const up = k.state === "Running" ? Math.round(t.current - k.startedAt) : 0;
  const statusText = k.state === "Waiting" ? `CrashLoopBackOff (${Math.ceil(k.backoffUntil - t.current)}s)` : k.state === "Running" ? (k.ready ? "Running 1/1" : "Running 0/1") : k.reason;
  const statusColor = k.state !== "Running" ? C.bad : k.ready ? C.done : C.compare;
  const fmt = (x: number) => `${Math.floor(x / 60)}m${String(Math.floor(x % 60)).padStart(2, "0")}s`;

  const tip =
    scenario === "slow" && !startupProbe && initialDelay < 45
      ? { tone: "bad" as const, text: `Liveness starts at ${initialDelay}s but the app needs 45s. It will be killed before it ever starts. Add a startup probe (or raise initialDelaySeconds, which also delays detection of real hangs).` }
      : liveChecksDb && dbDown
        ? { tone: "bad" as const, text: "Liveness checks the database, so a DB outage restarts every pod at once. Restarting can't fix a dependency. Keep dependency checks in readiness only." }
        : dbDown
          ? { tone: "warn" as const, text: "DB down: readiness fails, so the pod leaves the Service endpoints and gets no traffic. Liveness stays green, so there's no pointless restart." }
          : { tone: "info" as const, text: SCEN[scenario].hint };

  return (
    <div className="space-y-4">
      <Segmented
        value={scenario}
        onChange={(v) => {
          setScenario(v);
          reset();
        }}
        options={(Object.keys(SCEN) as Scenario[]).map((s) => ({ value: s, label: SCEN[s].label }))}
      />
      <div className="flex flex-wrap items-end gap-3">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn onClick={() => setStartupProbe((x) => !x)} tone={startupProbe ? "good" : "default"}>
          startupProbe: {startupProbe ? "on" : "off"}
        </SmallBtn>
        <SmallBtn onClick={() => setDbDown((x) => !x)} tone={dbDown ? "danger" : "default"}>
          {dbDown ? "DB is down: restore" : "Take the DB down"}
        </SmallBtn>
        <SmallBtn onClick={() => setLiveChecksDb((x) => !x)} tone={liveChecksDb ? "danger" : "default"}>
          liveness checks DB: {liveChecksDb ? "yes ✗" : "no ✓"}
        </SmallBtn>
        <SmallBtn onClick={reset}>reset</SmallBtn>
        {!startupProbe && <Slider label="liveness initialDelaySeconds" value={initialDelay} min={0} max={60} step={5} onChange={setInitialDelay} format={(v) => `${v}s`} />}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="pod status" value={<span className="text-sm">{statusText}</span>} color={statusColor} />
        <Stat label="restarts" value={k.restarts} color={k.restarts ? C.bad : C.text} />
        <Stat label="uptime" value={fmt(up)} />
        <Stat label="in Service endpoints" value={k.ready ? "yes" : "no"} color={k.ready ? C.done : C.compare} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["startup", "startupProbe", startupProbe ? (k.started ? "passed" : `${k.startFails}/${STARTUP_FAIL} failed`) : "not configured", "Holds off the other probes until the app has started."],
            ["liveness", "livenessProbe", `${k.liveFails}/${FAIL} failed`, "Fails → restart the container."],
            ["readiness", "readinessProbe", `${k.readyFails}/${FAIL} failed`, "Fails → remove from Service endpoints."],
          ] as const
        ).map(([key, name, count, what]) => {
          const r = k.last[key];
          const active = key === "startup" ? startupProbe && !k.started && k.state === "Running" : k.started && k.state === "Running";
          return (
            <div key={key} className={clsx("rounded-xl border p-3", active ? "border-line bg-panel" : "border-line bg-panel-2 opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{name}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: r === undefined || !active ? C.base : r ? C.done : C.bad }} />
              </div>
              <div className="mt-1 font-mono text-[11px] text-dim">{count}</div>
              <div className="mt-1 text-[11px] text-faint">{what}</div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[10px] text-faint">
          <span>last {hist.current.length}s of simulated time ({SIM_SPEED}× speed)</span>
          <span className="flex gap-3">
            <span style={{ color: C.done }}>■ ready</span>
            <span style={{ color: C.compare }}>■ running, not ready</span>
            <span style={{ color: C.bad }}>■ down</span>
          </span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-md border border-line bg-panel-2">
          {hist.current.map((h, i) => (
            <div key={i} className="h-full flex-1" style={{ background: h === "ready" ? C.done : h === "notready" ? C.compare : C.bad, opacity: 0.85 }} />
          ))}
        </div>
      </div>

      <Narration tone={tip.tone}>{tip.text}</Narration>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">kubectl get events</div>
        <div className="space-y-0.5 font-mono text-[11px]">
          {events.current.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-12 shrink-0 text-faint tabular-nums">{fmt(e.t)}</span>
              <span style={{ color: e.tone }}>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
