"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, Segmented, Slider, SmallBtn, Stat, useSimLoop } from "../kit";

// Discrete-time model of a server handling requests that are mostly waiting on I/O
// (a database call): CPU 1 tick → I/O 8 ticks → CPU 1 tick. 4 CPU cores.

const CORES = 4;
const IO = 8;
type Phase = "queued" | "cpu1" | "io" | "cpu2" | "done";
interface Task {
  id: number;
  phase: Phase;
  left: number; // ticks left in io
  thread: number; // platform thread index, -1 if none
  waiting: boolean; // ready for a core
}
interface Sim {
  tasks: Task[];
  tick: number;
  running: number[]; // task ids on cores this tick
  busyTicks: number;
  finishedAt: number | null;
}

function init(n: number): Sim {
  return { tasks: Array.from({ length: n }, (_, i) => ({ id: i, phase: "queued", left: 0, thread: -1, waiting: false })), tick: 0, running: [], busyTicks: 0, finishedAt: null };
}

function step(s: Sim, mode: "platform" | "virtual", pool: number): Sim {
  if (s.finishedAt !== null) return s;
  const tasks = s.tasks.map((t) => ({ ...t }));
  // 1. I/O progresses; finished I/O makes the task ready for CPU again
  for (const t of tasks)
    if (t.phase === "io") {
      t.left--;
      if (t.left <= 0) {
        t.phase = "cpu2";
        t.waiting = true;
      }
    }
  // 2. hand queued tasks a thread
  if (mode === "platform") {
    const used = new Set(tasks.filter((t) => t.thread >= 0 && t.phase !== "done").map((t) => t.thread));
    for (const t of tasks) {
      if (t.phase !== "queued") continue;
      let free = -1;
      for (let k = 0; k < pool; k++)
        if (!used.has(k)) {
          free = k;
          break;
        }
      if (free < 0) break;
      used.add(free);
      t.thread = free;
      t.phase = "cpu1";
      t.waiting = true;
    }
  } else {
    for (const t of tasks)
      if (t.phase === "queued") {
        t.phase = "cpu1";
        t.waiting = true;
      }
  }
  // 3. cores run up to CORES ready tasks for one tick
  const ready = tasks.filter((t) => t.waiting);
  const run = ready.slice(0, CORES);
  for (const t of run) {
    t.waiting = false;
    if (t.phase === "cpu1") {
      t.phase = "io";
      t.left = IO;
    } else if (t.phase === "cpu2") {
      t.phase = "done";
      t.thread = -1;
    }
  }
  const done = tasks.every((t) => t.phase === "done");
  return { tasks, tick: s.tick + 1, running: run.map((t) => t.id), busyTicks: s.busyTicks + run.length, finishedAt: done ? s.tick + 1 : null };
}

const COLOR: Record<Phase | "ready", string> = { queued: C.base, cpu1: C.compare, io: C.pivot, cpu2: C.compare, done: C.done, ready: C.compare };

export default function JavaThreads() {
  const [mode, setMode] = useState<"platform" | "virtual">("platform");
  const [pool, setPool] = useState(8);
  const [n, setN] = useState(120);
  const [runningSim, setRunningSim] = useState(false);
  const sim = useRef<Sim>(init(120));
  const acc = useRef(0);
  const [results, setResults] = useState<{ label: string; ticks: number }[]>([]);

  function reset(nextN = n) {
    sim.current = init(nextN);
    acc.current = 0;
    setRunningSim(false);
  }

  useSimLoop(
    runningSim,
    (dt) => {
      acc.current += dt;
      while (acc.current >= 70) {
        acc.current -= 70;
        sim.current = step(sim.current, mode, pool);
        if (sim.current.finishedAt !== null) {
          const label = mode === "platform" ? `${pool} platform threads` : "virtual threads";
          const ticks = sim.current.finishedAt;
          setResults((r) => [{ label: `${label}, ${n} requests`, ticks }, ...r].slice(0, 4));
          setRunningSim(false);
          break;
        }
      }
    },
    20,
  );

  const s = sim.current;
  const count = (p: Phase) => s.tasks.filter((t) => t.phase === p).length;
  const blockedThreads = mode === "platform" ? s.tasks.filter((t) => t.phase === "io" && t.thread >= 0).length : 0;
  const util = s.tick ? Math.round((s.busyTicks / (s.tick * CORES)) * 100) : 0;

  const note =
    s.finishedAt !== null
      ? mode === "platform"
        ? `Done in ${s.finishedAt} ticks with ${pool} threads. CPU was busy only ${util}% of the time: threads spent most of their life blocked on I/O, and every blocked platform thread is an OS thread (≈1 MB stack) doing nothing. Throughput is capped at pool size ÷ request time.`
        : `Done in ${s.finishedAt} ticks. Every request got its own virtual thread. When one blocks on I/O, the JVM unmounts it from its carrier thread and runs another, so the 4 carriers stay busy (${util}% CPU). Same simple blocking code, far higher throughput.`
      : mode === "platform"
        ? "Platform threads: one OS thread per in-flight request. A thread that waits for the database still occupies its slot, so requests queue up behind the pool even though the CPUs are idle."
        : "Virtual threads (Java 21+): cheap threads managed by the JVM, scheduled onto a few carrier OS threads. Blocking I/O parks the virtual thread instead of the OS thread.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            reset();
          }}
          options={[
            { value: "platform", label: "Fixed pool of platform threads" },
            { value: "virtual", label: "One virtual thread per request" },
          ]}
        />
        <PlayPause running={runningSim} onToggle={() => (s.finishedAt !== null ? (reset(), setRunningSim(true)) : setRunningSim((r) => !r))} />
        <SmallBtn onClick={() => reset()}>Reset</SmallBtn>
      </div>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        <Slider
          label="requests"
          value={n}
          min={40}
          max={240}
          step={20}
          onChange={(v) => {
            setN(v);
            reset(v);
          }}
        />
        {mode === "platform" && (
          <Slider
            label="thread pool size"
            value={pool}
            min={4}
            max={64}
            step={4}
            onChange={(v) => {
              setPool(v);
              reset();
            }}
          />
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">4 CPU cores {mode === "virtual" && "(= 4 carrier threads)"}</div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: CORES }, (_, i) => {
            const id = s.running[i];
            return (
              <div key={i} className="rounded-lg border-2 px-2 py-2 text-center font-mono text-xs" style={{ borderColor: id !== undefined ? C.compare : C.base, background: id !== undefined ? `${C.compare}18` : "#f8fafc" }}>
                {id !== undefined ? `req #${id}` : "idle"}
              </div>
            );
          })}
        </div>
      </div>

      {mode === "platform" && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">
            Thread pool · {blockedThreads}/{pool} blocked on I/O
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: pool }, (_, k) => {
              const t = s.tasks.find((x) => x.thread === k && x.phase !== "done");
              const col = !t ? C.base : t.phase === "io" ? C.pivot : C.compare;
              return <span key={k} className="h-4 w-4 rounded" style={{ background: t ? col : "#f1f5f9", border: `1px solid ${col}` }} title={t ? `thread ${k}: ${t.phase}` : `thread ${k}: idle`} />;
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Requests</div>
        <div className="flex flex-wrap gap-[3px]">
          {s.tasks.map((t) => (
            <span key={t.id} className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[t.phase] }} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-dim">
          <span style={{ color: C.faint }}>■ waiting for a thread ({count("queued")})</span>
          <span style={{ color: C.compare }}>■ needs / using CPU ({count("cpu1") + count("cpu2")})</span>
          <span style={{ color: C.pivot }}>■ blocked on I/O ({count("io")})</span>
          <span style={{ color: C.done }}>■ done ({count("done")})</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="ticks elapsed" value={s.tick} />
        <Stat label="CPU busy" value={`${util}%`} color={util > 70 ? C.done : C.compare} />
        <Stat label="finished" value={`${count("done")}/${s.tasks.length}`} color={C.done} />
      </div>
      <Narration tone={s.finishedAt !== null ? (mode === "virtual" ? "good" : "warn") : "info"}>{note}</Narration>
      {results.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-3 text-xs">
          <div className="mb-1 font-semibold text-ink">Your runs</div>
          {results.map((r, i) => (
            <div key={i} className="flex justify-between font-mono text-dim">
              <span>{r.label}</span>
              <span className="text-ink">{r.ticks} ticks</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
