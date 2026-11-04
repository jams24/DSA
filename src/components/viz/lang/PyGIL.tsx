"use client";

import { useMemo, useState } from "react";
import { C, Legend, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

// Discrete-time model of 4 tasks on a 4-core machine. Each task is a list of phases:
// "c" = one tick of Python bytecode (needs a core, and the GIL where there is one), "i" = one tick
// of waiting on I/O (sleeping in a syscall: needs neither).

type Mode = "seq" | "threads" | "nogil" | "procs" | "async";
type Work = "cpu" | "io";
type Cell = "run" | "gil" | "io" | "spawn" | "queued" | "done";

const CORES = 4;
const TASKS = 4;
const PLAN: Record<Work, string> = { cpu: "cccc", io: "ciiiiic" };

const COLOR: Record<Cell, string> = { run: C.active, gil: C.compare, io: C.pivot, spawn: C.orange, queued: "#f1f5f9", done: "transparent" };

interface Sim {
  grid: Cell[][]; // [task][tick]
  owner: string[]; // per tick: who held the GIL / how many cores were busy
  ticks: number;
}

function simulate(mode: Mode, work: Work): Sim {
  const left = Array.from({ length: TASKS }, () => PLAN[work].split(""));
  const grid: Cell[][] = Array.from({ length: TASKS }, () => []);
  const owner: string[] = [];
  let spawn = mode === "procs" ? 1 : 0; // process start-up + pickling the arguments
  let rr = 0; // round-robin pointer for the GIL / the event loop
  let current = -1; // asyncio: coroutine currently running (runs until it awaits)
  for (let tick = 0; tick < 64 && left.some((p) => p.length); tick++) {
    const cells: Cell[] = Array(TASKS).fill("done");
    if (spawn > 0) {
      spawn--;
      for (let k = 0; k < TASKS; k++) cells[k] = "spawn";
      owner.push("spawning");
    } else if (mode === "seq") {
      const k = left.findIndex((p) => p.length);
      for (let j = 0; j < TASKS; j++) cells[j] = left[j].length ? "queued" : "done";
      const ph = left[k].shift()!;
      cells[k] = ph === "c" ? "run" : "io";
      owner.push(ph === "c" ? `T${k + 1}` : "idle");
    } else {
      // tasks waiting on I/O make progress regardless
      const wantCpu: number[] = [];
      for (let k = 0; k < TASKS; k++) {
        if (!left[k].length) continue;
        if (left[k][0] === "i") {
          cells[k] = "io";
        } else wantCpu.push(k);
      }
      let runners: number[];
      if (mode === "threads") {
        // one GIL: a single thread runs bytecode per tick; the GIL is handed over every switch interval
        const order = [...wantCpu.filter((k) => k >= rr), ...wantCpu.filter((k) => k < rr)];
        runners = order.slice(0, 1);
        if (runners.length) rr = (runners[0] + 1) % TASKS;
      } else if (mode === "async") {
        // cooperative: the running coroutine keeps the thread until it awaits (hits an I/O phase)
        if (current >= 0 && wantCpu.includes(current)) runners = [current];
        else {
          const order = [...wantCpu.filter((k) => k >= rr), ...wantCpu.filter((k) => k < rr)];
          runners = order.slice(0, 1);
          if (runners.length) {
            current = runners[0];
            rr = (current + 1) % TASKS;
          }
        }
      } else runners = wantCpu.slice(0, CORES);
      for (const k of wantCpu) cells[k] = runners.includes(k) ? "run" : mode === "async" ? "queued" : "gil";
      owner.push(mode === "threads" || mode === "async" ? (runners.length ? `T${runners[0] + 1}` : "idle") : `${runners.length}/${CORES}`);
      // advance: I/O ticks of everyone, CPU ticks of the runners
      for (let k = 0; k < TASKS; k++) {
        if (!left[k].length) continue;
        if (left[k][0] === "i" || runners.includes(k)) left[k].shift();
        if (mode === "async" && k === current && left[k][0] !== "c") current = -1;
      }
    }
    for (let k = 0; k < TASKS; k++) grid[k].push(cells[k]);
  }
  return { grid, owner, ticks: owner.length };
}

const MODES: { value: Mode; label: string }[] = [
  { value: "seq", label: "Sequential" },
  { value: "threads", label: "Threads + GIL" },
  { value: "nogil", label: "Free-threaded (3.13t+)" },
  { value: "procs", label: "Processes" },
  { value: "async", label: "asyncio" },
];

const NOTES: Record<Mode, Record<Work, string>> = {
  seq: {
    cpu: "One task after another: 4 tasks × 4 ticks of computation = 16 ticks, using 1 of the 4 cores. This is the baseline to beat.",
    io: "While a task waits for the network or disk, the whole program waits with it: the core sits idle for 5 of every 7 ticks. 28 ticks in total.",
  },
  threads: {
    cpu: "Four threads, but only the thread holding the GIL (Global Interpreter Lock) can run Python bytecode, so they take turns (the GIL is handed over every 5 ms by default). Still 16 ticks: no speed-up for pure-Python CPU work, and in real life contention makes it slightly slower.",
    io: "A thread releases the GIL while it blocks in I/O (socket reads, file reads, time.sleep, most C extensions doing heavy work). So the waits overlap and the total drops from 28 to 10 ticks. Threads are a fine tool for I/O-bound work.",
  },
  nogil: {
    cpu: "The free-threaded build (python3.13t / 3.14t, PEP 703) removes the GIL, so four threads run bytecode on four cores at once: 4 ticks. It's officially supported from 3.14 but still optional; single-threaded code runs a little slower and some C extensions aren't ready yet.",
    io: "No GIL to wait for: all four tasks compute in parallel, wait in parallel, and finish in 7 ticks.",
  },
  procs: {
    cpu: "multiprocessing / ProcessPoolExecutor: each process has its own interpreter and its own GIL, so they compute in true parallel. You pay start-up and pickling (arguments and results are serialized between processes): 1 + 4 = 5 ticks. The standard answer for CPU-bound Python on a normal (GIL) build.",
    io: "Works, but it's overkill for waiting: processes cost memory and start-up time, and the data crossing between them must be pickled. 8 ticks here; threads or asyncio are lighter for I/O.",
  },
  async: {
    cpu: "asyncio runs every coroutine on ONE thread and only switches at an await. CPU work has no awaits, so each task hogs the event loop until it finishes: 16 ticks, and nothing else (no other request, no timer) runs meanwhile. Never do heavy CPU work inside a coroutine: offload it with asyncio.to_thread or a process pool.",
    io: "Each coroutine runs until it awaits I/O, then the event loop runs the next ready one. The waits overlap: 10 ticks, like threads, but with thousands of tasks costing a few KB each instead of an OS thread each, and no locks needed between awaits.",
  },
};

export default function PyGIL() {
  const [mode, setMode] = useState<Mode>("threads");
  const [work, setWork] = useState<Work>("cpu");
  const sim = useMemo(() => simulate(mode, work), [mode, work]);
  const base = useMemo(() => simulate("seq", work).ticks, [work]);
  const frames = useMemo(() => Array.from({ length: sim.ticks + 1 }, (_, i) => i), [sim]);
  const s = useStepper(frames, 380);
  const shown = s.frame;
  const done = shown >= sim.ticks;
  const runCells = sim.grid.reduce((n, row) => n + row.slice(0, shown).filter((c) => c === "run").length, 0);
  const util = shown ? Math.round((runCells / (shown * CORES)) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Segmented value={work} onChange={setWork} options={[{ value: "cpu", label: "CPU-bound work" }, { value: "io", label: "I/O-bound work" }]} />
        <Segmented value={mode} onChange={setMode} options={MODES} />
      </div>
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-faint uppercase">
          4 tasks on a 4-core machine · each {work === "cpu" ? "computes for 4 ticks" : "computes 1 tick, waits on I/O 5 ticks, computes 1 tick"}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="inline-block min-w-full">
            {sim.grid.map((row, k) => (
              <div key={k} className="flex items-center gap-2 py-0.5">
                <span className="w-14 shrink-0 font-mono text-[11px] text-dim">{mode === "procs" ? `proc ${k + 1}` : mode === "async" ? `coro ${k + 1}` : `T${k + 1}`}</span>
                <div className="flex gap-[2px]">
                  {row.map((c, t) => (
                    <span
                      key={t}
                      className="h-5 w-4 shrink-0 rounded-[3px] transition-opacity"
                      style={{
                        background: COLOR[c],
                        opacity: t < shown ? 1 : 0.08,
                        border: c === "queued" ? `1px solid ${C.base}` : c === "done" ? `1px dashed ${C.dim}` : "none",
                      }}
                      title={`tick ${t + 1}: ${c}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 border-t border-line pt-1.5">
              <span className="w-14 shrink-0 font-mono text-[10px] text-faint">{mode === "threads" ? "GIL" : mode === "async" ? "loop" : mode === "seq" ? "CPU" : "cores"}</span>
              <div className="flex gap-[2px]">
                {sim.owner.map((o, t) => (
                  <span key={t} className="grid h-5 w-4 shrink-0 place-items-center font-mono text-[7px] text-dim" style={{ opacity: t < shown ? 1 : 0.15 }}>
                    {o === "spawning" ? "…" : o === "idle" ? "·" : o.replace("/4", "")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Legend
        items={[
          { color: C.active, label: "running Python code" },
          { color: C.compare, label: "ready, but waiting for the GIL" },
          { color: C.pivot, label: "waiting on I/O (GIL released)" },
          { color: C.orange, label: "starting a process" },
          { color: C.base, label: "not started / not scheduled" },
        ]}
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="ticks" value={done ? sim.ticks : shown} />
        <Stat label="speed-up vs sequential" value={done ? `${(base / sim.ticks).toFixed(1)}×` : "…"} color={done && base / sim.ticks > 1.5 ? C.done : C.compare} />
        <Stat label="core utilization" value={`${util}%`} />
      </div>
      <Narration tone={done ? (base / sim.ticks > 1.5 ? "good" : "warn") : "info"}>
        {done ? NOTES[mode][work] : "Press play to run the four tasks. Switch between CPU-bound and I/O-bound work, and between the five ways Python can run them."}
      </Narration>
      <StepControls s={s} />
    </div>
  );
}
