"use client";

import { useMemo } from "react";
import { clsx } from "clsx";
import { C, Narration, StepControls, useStepper } from "../kit";

interface P {
  id: string;
  m: string | null;
  run: string | null;
  q: string[];
}
interface Frame {
  ps: P[];
  global: string[];
  syscall: { g: string; m: string }[];
  netpoll: string[];
  parked: string[];
  idleM: string[];
  hot: string[];
  title: string;
  note: string;
  tone: "info" | "good" | "bad" | "warn";
}

function build(): Frame[] {
  const frames: Frame[] = [];
  const ps: P[] = [
    { id: "P0", m: "M0", run: "main", q: [] },
    { id: "P1", m: null, run: null, q: [] },
  ];
  let global: string[] = [];
  let syscall: Frame["syscall"] = [];
  let netpoll: string[] = [];
  let parked: string[] = [];
  let idleM: string[] = [];
  const push = (title: string, note: string, hot: string[] = [], tone: Frame["tone"] = "info") =>
    frames.push({ ps: structuredClone(ps), global: [...global], syscall: [...syscall], netpoll: [...netpoll], parked: [...parked], idleM: [...idleM], hot, title, note, tone });

  push(
    "G, M and P",
    "Three pieces. G = a goroutine (its stack, starting at ~2 KB, plus saved registers). M = an OS thread. P = a 'processor': the right to run Go code, with its own local run queue. There are GOMAXPROCS Ps (default: the number of CPUs; container CPU limits are respected since Go 1.25). An M must hold a P to run a G.",
  );
  ps[0].q = ["G1", "G2", "G3", "G4", "G5", "G6"];
  push("go work(i) × 6", "main starts six goroutines. Each `go` statement just allocates a G and puts it on the CURRENT P's local run queue. No OS thread is created: that's why a million goroutines is fine.", ["G1", "G2", "G3", "G4", "G5", "G6"]);
  ps[1].m = "M1";
  ps[1].q = ["G4", "G5", "G6"];
  ps[0].q = ["G1", "G2", "G3"];
  push("Work stealing", "P1 has nothing to do. An idle P first checks its own queue, then the global queue and the network poller, then STEALS half of another P's queue. Load balances itself without a central lock.", ["G4", "G5", "G6"], "good");
  parked = ["main (wg.Wait)"];
  ps[0].run = "G1";
  ps[0].q = ["G2", "G3"];
  ps[1].run = "G4";
  ps[1].q = ["G5", "G6"];
  push("main blocks, Gs run", "main calls wg.Wait() and is parked (it costs nothing while it waits). Both Ps now run goroutines in parallel on two OS threads.", ["G1", "G4"]);
  syscall = [{ g: "G1", m: "M0" }];
  ps[0].m = "M2";
  ps[0].run = "G2";
  ps[0].q = ["G3"];
  push(
    "Blocking syscall → hand-off",
    "G1 makes a blocking system call (say, reading a file). The OS blocks thread M0 with it. The runtime detaches P0 from M0 and hands it to another thread (M2, created or taken from the idle pool), so the other goroutines keep running.",
    ["G1", "M2", "G2"],
    "warn",
  );
  netpoll = ["G4 (conn.Read)"];
  ps[1].run = "G5";
  ps[1].q = ["G6"];
  push(
    "Network I/O → netpoller",
    "G4 reads from a socket with no data yet. Network I/O doesn't block a thread: G4 is parked and its file descriptor registered with epoll/kqueue. P1's thread immediately runs G5. This is how one Go server handles 100k connections on a few threads.",
    ["G4", "G5"],
    "good",
  );
  syscall = [];
  idleM = ["M0"];
  global = ["G1"];
  push("Syscall returns", "G1's syscall finishes. M0 tries to grab a P; none is free, so G1 goes on the global run queue and M0 parks in the idle-thread pool.", ["G1", "M0"]);
  netpoll = [];
  ps[1].q = ["G6", "G4"];
  push("Data arrives", "The socket becomes readable. The netpoller marks G4 runnable and it goes back on a run queue, exactly where it left off.", ["G4"], "good");
  global = ["G1", "G5"];
  ps[1].run = "G6";
  ps[1].q = ["G4"];
  push(
    "Preemption",
    "G5 is a tight CPU loop that has run for over 10 ms. The sysmon background thread notices and preempts it with a signal (asynchronous preemption, Go 1.14+), so one hot goroutine can't starve the others. G5 goes to the global queue.",
    ["G5", "G6"],
    "warn",
  );
  global = ["G5"];
  ps[0].run = "G1";
  ps[0].q = ["G3"];
  push(
    "Fairness",
    "Every 61st scheduling round a P checks the global queue first, so goroutines there can't starve. P0 picks up G1. The scheduler keeps every P busy while there's runnable work, without you managing a single thread.",
    ["G1"],
    "good",
  );
  return frames;
}

function Chip({ g, hot, tone = C.active }: { g: string; hot: boolean; tone?: string }) {
  return (
    <span
      className={clsx("inline-flex h-7 items-center rounded-md border-2 px-2 font-mono text-[11px] font-semibold transition", hot && "scale-110")}
      style={{ borderColor: hot ? C.compare : tone, background: hot ? `${C.compare}22` : `${tone}12`, color: C.text }}
    >
      {g}
    </span>
  );
}

export default function GoScheduler() {
  const frames = useMemo(() => build(), []);
  const s = useStepper(frames, 2600);
  const f = s.frame;
  const hot = (x: string) => f.hot.includes(x);

  return (
    <div className="space-y-4">
      <div className="font-display text-lg font-semibold text-ink">{f.title}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {f.ps.map((p) => (
          <div key={p.id} className="rounded-xl border-2 border-cyan/40 bg-cyan/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-cyan">{p.id}</span>
              {p.m ? <Chip g={`thread ${p.m}`} hot={hot(p.m)} tone={C.pivot} /> : <span className="text-[11px] text-faint italic">no thread (idle)</span>}
            </div>
            <div className="mt-3 text-[10px] font-semibold tracking-wider text-faint uppercase">Running</div>
            <div className="mt-1 h-8">{p.run ? <Chip g={p.run} hot={hot(p.run)} tone={C.done} /> : <span className="text-xs text-faint">—</span>}</div>
            <div className="mt-2 text-[10px] font-semibold tracking-wider text-faint uppercase">Local run queue</div>
            <div className="mt-1 flex min-h-8 flex-wrap gap-1">
              {p.q.length ? p.q.map((g) => <Chip key={g} g={g} hot={hot(g)} />) : <span className="text-xs text-faint">empty</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Global run queue", items: f.global, tone: C.active },
          { t: "Blocked in syscall (holds a thread)", items: f.syscall.map((x) => `${x.g} on ${x.m}`), tone: C.bad },
          { t: "Netpoller (no thread held)", items: f.netpoll, tone: C.sky },
          { t: "Parked / idle threads", items: [...f.parked, ...f.idleM.map((m) => `thread ${m}`)], tone: C.faint },
        ].map((box) => (
          <div key={box.t} className="rounded-xl border border-line bg-panel p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">{box.t}</div>
            <div className="flex min-h-7 flex-wrap gap-1">
              {box.items.length ? box.items.map((g) => <Chip key={g} g={g} hot={f.hot.some((h) => g.startsWith(h) || g.endsWith(h))} tone={box.tone} />) : <span className="text-xs text-faint">—</span>}
            </div>
          </div>
        ))}
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
