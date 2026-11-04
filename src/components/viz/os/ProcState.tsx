"use client";

import { useState } from "react";
import { C, Narration, SmallBtn, Stat } from "../kit";

// A sandbox for the five-state process model: create processes, dispatch them onto one CPU,
// preempt them, block them on I/O, wake them, and let them exit and be reaped.
type State = "new" | "ready" | "running" | "waiting" | "zombie";
interface Proc {
  pid: number;
  state: State;
  color: string;
  ran: number;
}
const COLORS = [C.active, C.pivot, C.compare, C.swap, C.lime, C.sky, C.orange];
const BOX: Record<State, { x: number; y: number; label: string; sub: string }> = {
  new: { x: 20, y: 40, label: "New", sub: "being created" },
  ready: { x: 175, y: 40, label: "Ready", sub: "waiting for a CPU" },
  running: { x: 330, y: 40, label: "Running", sub: "on the CPU (max 1)" },
  zombie: { x: 485, y: 40, label: "Terminated", sub: "zombie until reaped" },
  waiting: { x: 250, y: 190, label: "Waiting", sub: "blocked on I/O" },
};
const W = 135;
const H = 92;

export default function ProcState() {
  const [procs, setProcs] = useState<Proc[]>([
    { pid: 101, state: "ready", color: COLORS[0], ran: 0 },
    { pid: 102, state: "ready", color: COLORS[1], ran: 0 },
  ]);
  const [queue, setQueue] = useState<number[]>([101, 102]); // ready queue order
  const [waitQ, setWaitQ] = useState<number[]>([]);
  const [next, setNext] = useState(103);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "Two processes are ready and the CPU is idle. Press “Dispatch” to let the scheduler put one on the CPU.",
    tone: "info",
  });
  const [switches, setSwitches] = useState(0);

  const running = procs.find((p) => p.state === "running");
  const news = procs.filter((p) => p.state === "new");
  const zombies = procs.filter((p) => p.state === "zombie");
  const set = (pid: number, state: State, extra: Partial<Proc> = {}) => setProcs((ps) => ps.map((p) => (p.pid === pid ? { ...p, state, ...extra } : p)));

  const create = () => {
    if (procs.length >= 7) return setMsg({ text: "That's enough processes for one screen. Let some exit first.", tone: "warn" });
    const pid = next;
    setProcs((ps) => [...ps, { pid, state: "new", color: COLORS[(pid - 101) % COLORS.length], ran: 0 }]);
    setNext(pid + 1);
    setMsg({ text: `fork() created PID ${pid}. The kernel is building its PCB and address space: state NEW.`, tone: "info" });
  };
  const admit = () => {
    const p = news[0];
    if (!p) return;
    set(p.pid, "ready");
    setQueue((q) => [...q, p.pid]);
    setMsg({ text: `PID ${p.pid} is fully set up and joins the back of the ready queue: NEW → READY.`, tone: "info" });
  };
  const dispatch = () => {
    if (running) return setMsg({ text: `The CPU is busy with PID ${running.pid}. Only one process can run per CPU core at a time.`, tone: "bad" });
    const pid = queue[0];
    if (pid === undefined) return setMsg({ text: "The ready queue is empty: the CPU runs the idle task until something becomes ready.", tone: "warn" });
    setQueue((q) => q.slice(1));
    set(pid, "running", { ran: (procs.find((p) => p.pid === pid)?.ran ?? 0) + 1 });
    setSwitches((n) => n + 1);
    setMsg({ text: `The scheduler picks PID ${pid} from the front of the ready queue, restores its registers and jumps into it: READY → RUNNING (a context switch).`, tone: "good" });
  };
  const preempt = () => {
    if (!running) return setMsg({ text: "Nothing is running, so there's nothing to preempt.", tone: "bad" });
    set(running.pid, "ready");
    setQueue((q) => [...q, running.pid]);
    setMsg({ text: `Timer interrupt! PID ${running.pid}'s time slice is used up. The kernel saves its registers and puts it at the BACK of the ready queue: RUNNING → READY (involuntary). Now press Dispatch.`, tone: "warn" });
  };
  const block = () => {
    if (!running) return setMsg({ text: "Only a running process can ask for I/O.", tone: "bad" });
    set(running.pid, "waiting");
    setWaitQ((w) => [...w, running.pid]);
    setMsg({ text: `PID ${running.pid} calls read() on the disk. The data isn't there yet, so it sleeps: RUNNING → WAITING (voluntary). The CPU is free for someone else.`, tone: "info" });
  };
  const ioDone = () => {
    const pid = waitQ[0];
    if (pid === undefined) return setMsg({ text: "No process is waiting for I/O.", tone: "bad" });
    setWaitQ((w) => w.slice(1));
    set(pid, "ready");
    setQueue((q) => [...q, pid]);
    setMsg({ text: `The disk raises an interrupt: PID ${pid}'s data has arrived. It becomes READY, not running: it must queue for the CPU like everyone else (WAITING → READY).`, tone: "good" });
  };
  const exit = () => {
    if (!running) return setMsg({ text: "Only a running process can call exit().", tone: "bad" });
    set(running.pid, "zombie");
    setMsg({ text: `PID ${running.pid} calls exit(0). Its memory is freed, but its PCB stays with the exit status until the parent calls wait(): a ZOMBIE.`, tone: "warn" });
  };
  const reap = () => {
    const z = zombies[0];
    if (!z) return setMsg({ text: "There are no zombies to reap.", tone: "bad" });
    setProcs((ps) => ps.filter((p) => p.pid !== z.pid));
    setMsg({ text: `The parent calls waitpid(${z.pid}) and reads its exit status. The PCB is freed and PID ${z.pid} can be reused.`, tone: "good" });
  };

  const inBox = (s: State) => {
    if (s === "ready") return queue.map((pid) => procs.find((p) => p.pid === pid)!).filter(Boolean);
    if (s === "waiting") return waitQ.map((pid) => procs.find((p) => p.pid === pid)!).filter(Boolean);
    return procs.filter((p) => p.state === s);
  };
  const arrow = (x1: number, y1: number, x2: number, y2: number, label: string, lx: number, ly: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.base} strokeWidth={2} markerEnd="url(#ps-arrow)" />
      <text x={lx} y={ly} fontSize={10} fill={C.muted} textAnchor="middle">
        {label}
      </text>
    </g>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 640 300" className="w-full min-w-[520px]">
          <defs>
            <marker id="ps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.base} />
            </marker>
          </defs>
          {arrow(155, 86, 173, 86, "admit", 164, 30)}
          {arrow(310, 72, 328, 72, "dispatch", 319, 30)}
          {arrow(330, 108, 312, 108, "", 0, 0)}
          <text x={321} y={150} fontSize={10} fill={C.muted} textAnchor="middle">
            preempt
          </text>
          {arrow(465, 86, 483, 86, "exit", 474, 30)}
          {arrow(385, 132, 360, 188, "I/O or wait", 405, 165)}
          {arrow(275, 188, 245, 132, "I/O done", 228, 165)}
          {(Object.keys(BOX) as State[]).map((s) => {
            const b = BOX[s];
            const items = inBox(s);
            const hot = s === "running" && running;
            return (
              <g key={s}>
                <rect x={b.x} y={b.y} width={W} height={H} rx={14} fill={hot ? `${C.done}12` : "#ffffff"} stroke={hot ? C.done : C.base} strokeWidth={2} />
                <text x={b.x + W / 2} y={b.y + 18} fontSize={13} fontWeight={700} textAnchor="middle" fill={C.text}>
                  {b.label}
                </text>
                <text x={b.x + W / 2} y={b.y + 32} fontSize={9.5} textAnchor="middle" fill={C.faint}>
                  {b.sub}
                </text>
                {items.map((p, i) => (
                  <g key={p.pid} transform={`translate(${b.x + 22 + (i % 4) * 30}, ${b.y + 54 + Math.floor(i / 4) * 26})`}>
                    <circle r={12} fill={p.color} opacity={s === "zombie" ? 0.45 : 1} />
                    <text y={4} fontSize={9} fontWeight={700} textAnchor="middle" fill="#ffffff">
                      {p.pid}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2">
        <SmallBtn onClick={create}>fork(): new process</SmallBtn>
        <SmallBtn onClick={admit} disabled={!news.length}>
          Admit
        </SmallBtn>
        <SmallBtn tone="primary" onClick={dispatch}>
          Dispatch
        </SmallBtn>
        <SmallBtn onClick={preempt} disabled={!running}>
          Timer interrupt
        </SmallBtn>
        <SmallBtn onClick={block} disabled={!running}>
          read() from disk
        </SmallBtn>
        <SmallBtn onClick={ioDone} disabled={!waitQ.length}>
          Disk interrupt: I/O done
        </SmallBtn>
        <SmallBtn tone="danger" onClick={exit} disabled={!running}>
          exit()
        </SmallBtn>
        <SmallBtn tone="good" onClick={reap} disabled={!zombies.length}>
          Parent wait(): reap
        </SmallBtn>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="on the CPU" value={running ? `PID ${running.pid}` : "idle"} color={running ? C.done : C.faint} />
        <Stat label="ready queue" value={queue.length ? queue.join(" → ") : "empty"} color={C.active} />
        <Stat label="waiting on I/O" value={waitQ.length} color={C.compare} />
        <Stat label="dispatches" value={switches} color={C.pivot} />
      </div>
      <Narration tone={msg.tone}>{msg.text}</Narration>
    </div>
  );
}
