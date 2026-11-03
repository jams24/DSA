"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type GState = "running" | "runnable" | "blocked-send" | "blocked-recv" | "blocked-select" | "sleeping" | "done" | "leaked";
interface G {
  name: string;
  state: GState;
  detail?: string;
}
interface Chan {
  name: string;
  cap: number;
  buf: string[];
  closed: boolean;
  sendq: string[];
  recvq: string[];
}
interface Frame {
  line: number;
  gs: G[];
  chans: Chan[];
  note: string;
  tone: "info" | "good" | "bad" | "warn";
  out: string[];
  clock?: string;
}

const STATE: Record<GState, { label: string; color: string }> = {
  running: { label: "running", color: C.active },
  runnable: { label: "runnable", color: C.sky },
  "blocked-send": { label: "blocked: send", color: C.compare },
  "blocked-recv": { label: "blocked: receive", color: C.compare },
  "blocked-select": { label: "blocked: select", color: C.compare },
  sleeping: { label: "sleeping", color: C.pivot },
  done: { label: "finished", color: C.done },
  leaked: { label: "stuck forever (leak)", color: C.bad },
};

class B {
  gs: G[] = [];
  chans: Chan[] = [];
  out: string[] = [];
  frames: Frame[] = [];
  clock?: string;
  g(name: string, state: GState, detail?: string) {
    const ex = this.gs.find((x) => x.name === name);
    if (ex) Object.assign(ex, { state, detail });
    else this.gs.push({ name, state, detail });
  }
  ch(name: string, cap: number) {
    this.chans.push({ name, cap, buf: [], closed: false, sendq: [], recvq: [] });
  }
  c(name: string) {
    return this.chans.find((x) => x.name === name)!;
  }
  step(line: number, note: string, tone: Frame["tone"] = "info") {
    this.frames.push({ line, gs: structuredClone(this.gs), chans: structuredClone(this.chans), note, tone, out: [...this.out], clock: this.clock });
  }
}

interface Scenario {
  label: string;
  code: string;
  frames: Frame[];
}

function unbuffered(): Scenario {
  const b = new B();
  b.g("main", "running");
  b.ch("ch", 0);
  b.step(1, "An unbuffered channel has no storage at all. A send and a receive must meet: whoever arrives first waits for the other.");
  b.g("worker", "runnable");
  b.step(2, "go starts a goroutine. It's put on a run queue; main keeps going without waiting. Goroutines are cheap: ~2 KB of stack each.");
  b.g("main", "blocked-recv", "<-ch");
  b.c("ch").recvq = ["main"];
  b.step(5, "main reaches <-ch. Nobody is sending yet, so main parks in the channel's receive queue. The scheduler runs something else.", "warn");
  b.g("worker", "running");
  b.step(3, "The worker runs and sends 42.");
  b.c("ch").recvq = [];
  b.g("main", "runnable", "v = 42");
  b.g("worker", "done");
  b.step(3, "A receiver is waiting, so the runtime copies 42 straight into main's variable and marks main runnable. The send completes: this is a synchronization point, both sides know the handoff happened.", "good");
  b.g("main", "running", "v = 42");
  b.step(5, "main resumes with v = 42.");
  b.out.push("42");
  b.step(6, "If the worker had sent first, IT would have blocked in the send queue until main arrived. Same handoff, either order.", "good");
  return {
    label: "Unbuffered handoff",
    code: `ch := make(chan int)
go func() {
    ch <- 42            // waits for a receiver
}()
v := <-ch               // waits for a sender
fmt.Println(v)`,
    frames: b.frames,
  };
}

function buffered(): Scenario {
  const b = new B();
  b.g("main", "running");
  b.ch("ch", 2);
  b.step(1, "A buffered channel is a fixed-size queue (here 2 slots).");
  b.c("ch").buf = ["a"];
  b.step(2, "Sending into a buffer with free space doesn't block.");
  b.c("ch").buf = ["a", "b"];
  b.step(3, "Now the buffer is full.");
  b.g("drain", "runnable");
  b.step(4, "Start a goroutine that will receive one value.");
  b.g("main", "blocked-send", 'ch <- "c"');
  b.c("ch").sendq = ['main ("c")'];
  b.step(5, "The buffer is full, so main blocks in the send queue. Buffers absorb bursts; they don't remove the need for a receiver.", "warn");
  b.g("drain", "running");
  b.c("ch").buf = ["b", "c"];
  b.c("ch").sendq = [];
  b.g("main", "runnable");
  b.g("drain", "done", 'got "a"');
  b.step(4, 'drain takes "a" from the front. A sender is waiting, so its "c" moves into the freed slot and main is woken. FIFO order is preserved.', "good");
  b.g("main", "running");
  b.c("ch").buf = [];
  b.out.push("b c");
  b.step(6, "main receives the remaining two. Rule of thumb: use unbuffered for synchronization, a small buffer for decoupling bursty producers, and never a huge buffer to hide a slow consumer.");
  return {
    label: "Buffered queue",
    code: `ch := make(chan string, 2)
ch <- "a"              // doesn't block
ch <- "b"              // buffer now full
go func() { <-ch }()   // frees one slot
ch <- "c"              // blocks until then
fmt.Println(<-ch, <-ch)`,
    frames: b.frames,
  };
}

function closeRange(): Scenario {
  const b = new B();
  b.g("main", "running");
  b.ch("jobs", 3);
  b.step(1, "A channel of jobs with room for 3.");
  b.g("producer", "runnable");
  b.step(2, "Start the producer.");
  b.g("main", "blocked-recv", "range jobs");
  b.c("jobs").recvq = ["main"];
  b.step(6, "main starts ranging over jobs. The channel is empty, so it waits.");
  b.g("producer", "running");
  b.c("jobs").recvq = [];
  b.g("main", "runnable");
  b.c("jobs").buf = [];
  b.step(3, "The producer sends 1; main was waiting, so 1 goes straight to it.");
  b.c("jobs").buf = ["2", "3"];
  b.step(3, "2 and 3 fit in the buffer, no blocking.");
  b.c("jobs").closed = true;
  b.g("producer", "done");
  b.step(4, "close(jobs) means 'no more values'. Only the SENDER should close, and only once: sending on a closed channel, or closing twice, panics.", "warn");
  b.g("main", "running");
  b.out.push("got 1");
  b.step(7, "main prints the first job…");
  b.c("jobs").buf = [];
  b.out.push("got 2", "got 3");
  b.step(7, "…then drains the buffered values. Closing doesn't discard them.");
  b.step(9, "The buffer is empty AND the channel is closed, so the range loop ends. Without close, main would block forever here.", "good");
  b.out.push("0 false");
  b.step(9, "Receiving from a closed, empty channel never blocks: it returns the zero value and ok = false. That's how receivers detect 'done'.", "good");
  return {
    label: "close & range",
    code: `jobs := make(chan int, 3)
go func() {
    for i := 1; i <= 3; i++ { jobs <- i }
    close(jobs)
}()
for j := range jobs {
    fmt.Println("got", j)
}
v, ok := <-jobs
fmt.Println(v, ok)`,
    frames: b.frames,
  };
}

function selectTimeout(fixed: boolean): Scenario {
  const b = new B();
  b.clock = "t = 0s";
  b.g("main", "running");
  b.ch("result", fixed ? 1 : 0);
  b.step(1, fixed ? "This time the result channel has a buffer of 1." : "An unbuffered result channel.");
  b.g("call", "sleeping", "slow call: 2s");
  b.step(3, "A goroutine starts a slow call that takes 2 seconds.");
  b.ch("time.After", 1);
  b.g("main", "blocked-select", "result | timer");
  b.c("result").recvq = ["main"];
  b.c("time.After").recvq = ["main"];
  b.step(6, "select blocks until ONE of its cases can proceed. main waits on both channels at once.");
  b.clock = "t = 1s";
  b.c("time.After").buf = ["tick"];
  b.step(9, "After 1 second the timer channel delivers a value.");
  b.c("time.After").buf = [];
  b.c("result").recvq = [];
  b.c("time.After").recvq = [];
  b.g("main", "running");
  b.out.push("timeout");
  b.step(10, "select runs the ready case: main prints timeout and moves on. (If several cases are ready, select picks one at random.)");
  b.clock = "t = 2s";
  b.g("call", "running");
  b.step(4, "At 2s the slow call finishes and tries to send its result…");
  if (fixed) {
    b.c("result").buf = ["done"];
    b.g("call", "done");
    b.step(4, "…into the 1-slot buffer, which never blocks. The goroutine exits and the channel is garbage collected later. In real code, also pass a context so the slow call itself is cancelled.", "good");
  } else {
    b.g("call", "leaked", 'result <- "done"');
    b.c("result").sendq = ["call"];
    b.step(4, "…but nobody will ever receive again. The goroutine blocks forever: a goroutine leak. Its stack and everything it references stay in memory. Do this per request and the service slowly runs out of memory.", "bad");
  }
  return {
    label: fixed ? "select: leak fixed" : "select + timeout (leak!)",
    code: `result := make(chan string${fixed ? ", 1" : ""})
go func() {
    time.Sleep(2 * time.Second) // slow call
    result <- "done"
}()
select {
case r := <-result:
    fmt.Println(r)
case <-time.After(1 * time.Second):
    fmt.Println("timeout")
}`,
    frames: b.frames,
  };
}

function deadlock(): Scenario {
  const b = new B();
  b.g("main", "running");
  b.ch("ch", 0);
  b.step(1, "An unbuffered channel, and only one goroutine.");
  b.g("main", "blocked-send", "ch <- 1");
  b.c("ch").sendq = ["main"];
  b.step(2, "main sends, so it waits for a receiver. But the only code that receives is on the NEXT line, in the same goroutine.", "warn");
  b.g("main", "leaked", "ch <- 1");
  b.out.push("fatal error: all goroutines are asleep - deadlock!");
  b.step(2, "Every goroutine is blocked, so the runtime aborts the program. (It only detects TOTAL deadlock; if any other goroutine is alive, e.g. an HTTP server, you get a silent hang instead.) Fix: receive in another goroutine, or make(chan int, 1).", "bad");
  return {
    label: "Deadlock",
    code: `ch := make(chan int)
ch <- 1              // no receiver can ever run
fmt.Println(<-ch)`,
    frames: b.frames,
  };
}

export default function GoChannels() {
  const scenarios = useMemo(() => [unbuffered(), buffered(), closeRange(), selectTimeout(false), selectTimeout(true), deadlock()], []);
  const [idx, setIdx] = useState("0");
  const sc = scenarios[Number(idx)];
  const s = useStepper(sc.frames, 1700);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented value={idx} onChange={setIdx} options={scenarios.map((x, i) => ({ value: String(i), label: x.label }))} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <pre className="min-w-0 overflow-x-auto rounded-xl border border-line bg-[#f8fafc] py-2 font-mono text-[12px] leading-[1.7]">
          {sc.code.split("\n").map((ln, i) => (
            <div key={i} className={clsx("flex pr-3", f.line === i + 1 && "bg-amber/15")} style={f.line === i + 1 ? { boxShadow: `inset 3px 0 0 ${C.compare}` } : undefined}>
              <span className="w-7 shrink-0 pr-2 text-right text-faint select-none">{i + 1}</span>
              <span className="whitespace-pre text-[#334155]">{ln}</span>
            </div>
          ))}
        </pre>
        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 flex justify-between text-[10px] font-semibold tracking-wider text-faint uppercase">
              <span>Goroutines</span>
              {f.clock && <span className="font-mono text-ink">{f.clock}</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {f.gs.map((g) => {
                const st = STATE[g.state];
                return (
                  <div key={g.name} className="rounded-lg border-2 px-2.5 py-1.5" style={{ borderColor: st.color, background: `${st.color}0f` }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{g.name}</span>
                      <span className="text-[10px] font-semibold" style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    {g.detail && <div className="truncate font-mono text-[10px] text-dim">{g.detail}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          {f.chans.map((ch) => (
            <div key={ch.name} className="rounded-xl border border-line bg-panel p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-wider text-faint uppercase">
                <span>
                  chan {ch.name} · cap {ch.cap}
                </span>
                {ch.closed && <span className="rounded bg-rose/10 px-1.5 text-rose">closed</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {ch.cap === 0 ? (
                  <span className="text-xs text-faint italic">no buffer: senders and receivers meet directly</span>
                ) : (
                  Array.from({ length: ch.cap }, (_, i) => (
                    <span
                      key={i}
                      className="grid h-9 min-w-12 place-items-center rounded-md border-2 px-1.5 font-mono text-xs font-semibold"
                      style={{ borderColor: ch.buf[i] ? C.active : C.base, background: ch.buf[i] ? `${C.active}14` : "#f8fafc", color: ch.buf[i] ? C.text : C.faint }}
                    >
                      {ch.buf[i] ?? "·"}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <div className="text-dim">
                  sendq: <span className="text-ink">{ch.sendq.length ? ch.sendq.join(", ") : "—"}</span>
                </div>
                <div className="text-dim">
                  recvq: <span className="text-ink">{ch.recvq.length ? ch.recvq.join(", ") : "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      {f.out.length > 0 && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] px-3 py-2 font-mono text-[12px] text-[#e2e8f0]">
          {f.out.map((o, i) => (
            <div key={i} className={o.startsWith("fatal") ? "text-[#fda4af]" : undefined}>
              {o}
            </div>
          ))}
        </div>
      )}
      <StepControls s={s} />
    </div>
  );
}
