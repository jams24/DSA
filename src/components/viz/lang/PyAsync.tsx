"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

// Step-through of the asyncio event loop: which coroutine is running, which tasks are ready,
// which are suspended (on a timer, I/O or another task), and the loop's clock.

type Tone = "info" | "good" | "bad" | "warn";
interface Wait {
  name: string;
  why: string;
}
interface Frame {
  lines: number[];
  clock: number;
  running: string | null;
  ready: string[];
  waiting: Wait[];
  out: string[];
  note: string;
  tone: Tone;
  frozen?: boolean;
}

class Loop {
  clock = 0;
  running: string | null = null;
  ready: string[] = [];
  waiting: Wait[] = [];
  out: string[] = [];
  frozen = false;
  frames: Frame[] = [];
  run(name: string) {
    this.ready = this.ready.filter((r) => r !== name);
    this.waiting = this.waiting.filter((w) => w.name !== name);
    this.running = name;
  }
  suspend(why: string) {
    if (this.running) this.waiting.push({ name: this.running, why });
    this.running = null;
  }
  finish() {
    this.running = null;
  }
  wake(name: string) {
    this.waiting = this.waiting.filter((w) => w.name !== name);
    this.ready.push(name);
  }
  step(lines: number | number[], note: string, tone: Tone = "info") {
    this.frames.push({
      lines: Array.isArray(lines) ? lines : [lines],
      clock: this.clock,
      running: this.running,
      ready: [...this.ready],
      waiting: this.waiting.map((w) => ({ ...w })),
      out: [...this.out],
      note,
      tone,
      frozen: this.frozen,
    });
  }
}

const FETCH = `import asyncio

async def fetch(name, delay):
    print(f"start {name}")
    await asyncio.sleep(delay)
    print(f"done {name}")
    return name.lower()
`;

interface Scenario {
  label: string;
  code: string;
  frames: Frame[];
}

function taskGroup(): Scenario {
  const code = `${FETCH}
async def main():
    async with asyncio.TaskGroup() as tg:
        a = tg.create_task(fetch("A", 2))
        b = tg.create_task(fetch("B", 1))
    print(a.result(), b.result())

asyncio.run(main())`;
  const l = new Loop();
  l.ready.push("main()");
  l.step(15, "asyncio.run creates an event loop, wraps main() in a Task and puts it on the ready queue. Calling an async function only creates a coroutine object; nothing runs until the loop drives it.");
  l.run("main()");
  l.step([9, 10], "The loop takes the first ready task and runs it until it reaches an await. main enters the TaskGroup.");
  l.ready.push("Task A");
  l.step(11, "create_task wraps fetch('A', 2) in a Task and puts it on the ready queue. It does NOT run yet: main is still running.");
  l.ready.push("Task B");
  l.step(12, "Same for B. Two tasks are queued.");
  l.suspend("TaskGroup: until A and B finish");
  l.step(10, "At the end of the async with block, the TaskGroup awaits all its tasks, so main suspends and hands control back to the loop. This is the moment the queued tasks get to run.", "warn");
  l.run("Task A");
  l.out.push("start A");
  l.step(4, "The loop runs Task A, which prints 'start A'.");
  l.suspend("timer: wake at t=2.0s");
  l.step(5, "await asyncio.sleep(2) registers a timer and suspends A. Awaiting is the ONLY point where a coroutine gives up the thread.");
  l.run("Task B");
  l.out.push("start B");
  l.step(4, "Next ready task: B prints 'start B'.");
  l.suspend("timer: wake at t=1.0s");
  l.step(5, "B suspends on a 1-second timer. Nothing is ready now.");
  l.clock = 1;
  l.wake("Task B");
  l.step(5, "With nothing ready, the loop blocks in the OS selector (epoll on Linux, kqueue on macOS) until the earliest timer or socket event. At t=1.0s B's timer fires and B becomes ready.", "info");
  l.run("Task B");
  l.out.push("done B");
  l.step([6, 7], "B resumes right after its await, prints 'done B' and returns 'b'. Its Task is now done.", "good");
  l.finish();
  l.clock = 2;
  l.wake("Task A");
  l.step(5, "t=2.0s: A's timer fires.");
  l.run("Task A");
  l.out.push("done A");
  l.step([6, 7], "A prints 'done A' and returns 'a'. Both of the group's tasks are done...", "good");
  l.finish();
  l.wake("main()");
  l.step(10, "...so the TaskGroup wakes main up.");
  l.run("main()");
  l.out.push("a b");
  l.step(13, "main prints the results. Total time: 2 seconds, the longest wait, not 1 + 2 = 3. If any task had raised, the TaskGroup would cancel the others and raise an ExceptionGroup.", "good");
  l.finish();
  l.step(15, "main returns, so asyncio.run cancels anything left, closes the loop and returns main's result.");
  return { label: "TaskGroup: concurrent", code, frames: l.frames };
}

function sequential(): Scenario {
  const code = `${FETCH}
async def main():
    a = await fetch("A", 2)
    b = await fetch("B", 1)
    print(a, b)

asyncio.run(main())`;
  const l = new Loop();
  l.ready.push("main()");
  l.step(14, "Same fetch, but main awaits each call directly instead of creating tasks.");
  l.run("main()");
  l.step(10, "Awaiting a coroutine runs it inline, inside main's task. No new task is scheduled.");
  l.out.push("start A");
  l.step([10, 4], "fetch('A') starts running as part of main: 'start A'.");
  l.suspend("timer: wake at t=2.0s (inside fetch A)");
  l.step(5, "It hits await asyncio.sleep(2), and the whole main task suspends. B hasn't even been created: there is nothing else to run.", "warn");
  l.clock = 2;
  l.wake("main()");
  l.run("main()");
  l.out.push("done A");
  l.step([6, 7], "t=2.0s: main resumes, A finishes and returns 'a'.");
  l.out.push("start B");
  l.step([11, 4], "Only now does fetch('B') start.");
  l.suspend("timer: wake at t=3.0s (inside fetch B)");
  l.step(5, "Another wait, again with the loop idle.", "warn");
  l.clock = 3;
  l.wake("main()");
  l.run("main()");
  l.out.push("done B");
  l.step([6, 7], "t=3.0s: B finishes.");
  l.out.push("a b");
  l.step(12, "3 seconds: async code that awaits one thing at a time is just sequential code with extra syntax. Concurrency comes from tasks: TaskGroup, create_task or gather.", "bad");
  return { label: "await one by one", code, frames: l.frames };
}

function blocking(): Scenario {
  const code = `import asyncio, time

async def heartbeat():
    for _ in range(3):
        print("tick")
        await asyncio.sleep(0.5)

async def slow_handler():
    time.sleep(1.5)          # blocks the loop!
    print("handled")

async def main():
    async with asyncio.TaskGroup() as tg:
        tg.create_task(heartbeat())
        tg.create_task(slow_handler())

asyncio.run(main())`;
  const l = new Loop();
  l.ready.push("main()");
  l.step(17, "A heartbeat that should tick every 0.5 s, and a handler that does 1.5 s of blocking work.");
  l.run("main()");
  l.ready.push("heartbeat", "slow_handler");
  l.step([13, 14, 15], "main schedules both tasks...");
  l.suspend("TaskGroup");
  l.step(13, "...and suspends until they finish.");
  l.run("heartbeat");
  l.out.push("tick");
  l.step([4, 5], "heartbeat prints its first 'tick' at t=0.");
  l.suspend("timer: wake at t=0.5s");
  l.step(6, "It sleeps cooperatively until t=0.5s.");
  l.run("slow_handler");
  l.frozen = true;
  l.step(9, "slow_handler calls time.sleep(1.5). That's a regular blocking call, not an await: the thread (and with it the whole event loop) is stuck inside it.", "bad");
  l.clock = 0.5;
  l.step(9, "t=0.5s: the heartbeat's timer is due, but the loop can't run anything: it only regains control when the running coroutine awaits or returns. Every other request this server is handling is frozen too.", "bad");
  l.clock = 1.5;
  l.frozen = false;
  l.out.push("handled");
  l.step(10, "t=1.5s: the blocking call returns; 'handled' is printed and the task finishes.");
  l.finish();
  l.wake("heartbeat");
  l.run("heartbeat");
  l.out.push("tick");
  l.step([4, 5], "Only now does the overdue heartbeat run: its second tick comes a whole second late.", "warn");
  l.suspend("timer: wake at t=2.0s");
  l.clock = 2;
  l.wake("heartbeat");
  l.run("heartbeat");
  l.out.push("tick");
  l.step([4, 5], "t=2.0s: the last tick, on time again.");
  l.step(9, "Fixes: use the async version of the call (await asyncio.sleep, an async HTTP or DB driver), or move blocking work off the loop with await asyncio.to_thread(func) (a thread pool), or a process pool for CPU-heavy work. asyncio's debug mode (PYTHONASYNCIODEBUG=1) logs callbacks that block for more than 100 ms.", "good");
  return { label: "Blocking the loop", code, frames: l.frames };
}

const SCENARIOS = [taskGroup(), sequential(), blocking()];

function Chip({ name, color, sub }: { name: string; color: string; sub?: string }) {
  return (
    <span className="inline-flex max-w-full flex-col rounded-lg border px-2 py-1 font-mono text-[11px]" style={{ borderColor: `${color}66`, background: `${color}12`, color }}>
      <span className="truncate font-semibold">{name}</span>
      {sub && <span className="truncate text-[10px] text-dim">{sub}</span>}
    </span>
  );
}

export default function PyAsync() {
  const [idx, setIdx] = useState("0");
  const sc = SCENARIOS[Number(idx)];
  const s = useStepper(sc.frames, 1700);
  const f = s.frame;
  const lines = sc.code.split("\n");

  return (
    <div className="space-y-4">
      <Segmented value={idx} onChange={setIdx} options={SCENARIOS.map((x, i) => ({ value: String(i), label: x.label }))} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-[#f8fafc]">
          <div className="border-b border-line px-3 py-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Code</div>
          <pre className="overflow-x-auto py-2 font-mono text-[12px] leading-[1.7]">
            {lines.map((ln, i) => {
              const on = f.lines.includes(i + 1);
              return (
                <div key={i} className={clsx("flex pr-3", on && "bg-amber/15")} style={on ? { boxShadow: `inset 3px 0 0 ${C.compare}` } : undefined}>
                  <span className="w-8 shrink-0 pr-2 text-right text-faint select-none">{i + 1}</span>
                  <span className={clsx("whitespace-pre", on ? "text-ink" : "text-[#475569]")}>{ln || " "}</span>
                </div>
              );
            })}
          </pre>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-panel px-3 py-2">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">Event loop clock</span>
            <span className="font-mono text-lg font-semibold tabular-nums" style={{ color: f.frozen ? C.bad : C.text }}>
              t = {f.clock.toFixed(1)}s{f.frozen && " · blocked"}
            </span>
          </div>
          <div className="rounded-xl border-2 p-3" style={{ borderColor: f.frozen ? C.bad : f.running ? C.active : C.base }}>
            <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Running on the thread</div>
            {f.running ? <Chip name={f.running} color={f.frozen ? C.bad : C.active} sub={f.frozen ? "stuck in a blocking call" : undefined} /> : <span className="text-xs text-faint italic">nothing: the loop is waiting in the selector</span>}
          </div>
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Ready queue (FIFO)</div>
            <div className="flex flex-wrap gap-1.5">
              {f.ready.length ? f.ready.map((r) => <Chip key={r} name={r} color={C.done} />) : <span className="text-xs text-faint italic">empty</span>}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Suspended (awaiting)</div>
            <div className="flex flex-wrap gap-1.5">
              {f.waiting.length ? f.waiting.map((w) => <Chip key={w.name} name={w.name} sub={w.why} color={C.pivot} />) : <span className="text-xs text-faint italic">none</span>}
            </div>
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] px-3 py-2 font-mono text-[12px] text-[#e2e8f0]">
        <span className="text-[#64748b]">$ python main.py</span>
        {f.out.map((o, i) => (
          <div key={i}>{o}</div>
        ))}
      </div>
      <StepControls s={s} />
    </div>
  );
}
