"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

// A context switch, step by step: process A runs, the timer interrupts, A's registers go into its
// PCB, the kernel switches page tables, restores B and returns to user mode. Then B blocks on read().
type Regs = { pc: string; sp: string; rax: string };
interface Frame {
  mode: "user" | "kernel";
  running: "A" | "B" | "kernel";
  cpu: Regs;
  pcbA: Regs | null;
  pcbB: Regs;
  table: "A" | "B";
  tlb: "warm" | "flushed" | "tagged";
  hl: ("cpu" | "pcbA" | "pcbB" | "table" | "mode")[];
  note: string;
  tone: "info" | "good" | "warn" | "bad";
}

const A1: Regs = { pc: "0x401a20", sp: "0x7ffd...e0", rax: "41" };
const A2: Regs = { pc: "0x401a24", sp: "0x7ffd...e0", rax: "42" };
const B0: Regs = { pc: "0x5520c8", sp: "0x7ff3...10", rax: "7" };
const B1: Regs = { pc: "0x5520d0", sp: "0x7ff3...10", rax: "8" };
const K: Regs = { pc: "kernel", sp: "kstack", rax: "–" };

function build(sameProcess: boolean): Frame[] {
  const f: Frame[] = [];
  const nameB = sameProcess ? "thread B" : "process B";
  const tlbAfter = sameProcess ? "warm" : "tagged";
  f.push({ mode: "user", running: "A", cpu: A1, pcbA: null, pcbB: B0, table: "A", tlb: "warm", hl: ["cpu"], note: `${sameProcess ? "Thread" : "Process"} A is running in user mode, adding numbers. ${nameB} is ready but waiting; its registers are saved in its PCB.`, tone: "info" });
  f.push({ mode: "user", running: "A", cpu: A2, pcbA: null, pcbB: B0, table: "A", tlb: "warm", hl: ["cpu"], note: "A executes another instruction: rax becomes 42 and the program counter moves on.", tone: "info" });
  f.push({ mode: "kernel", running: "kernel", cpu: A2, pcbA: null, pcbB: B0, table: "A", tlb: "warm", hl: ["mode"], note: "⏰ Timer interrupt! The CPU finishes the current instruction, switches to KERNEL mode and jumps to the kernel's interrupt handler. A doesn't get a say.", tone: "warn" });
  f.push({ mode: "kernel", running: "kernel", cpu: K, pcbA: A2, pcbB: B0, table: "A", tlb: "warm", hl: ["pcbA", "cpu"], note: "The kernel SAVES A's registers (PC, SP, rax and the rest) into A's PCB, the bookmark it needs to resume later.", tone: "info" });
  f.push({ mode: "kernel", running: "kernel", cpu: K, pcbA: A2, pcbB: B0, table: "A", tlb: "warm", hl: [], note: `A's time slice is used up, so the scheduler picks the next task to run: ${nameB}.`, tone: "info" });
  if (sameProcess) {
    f.push({ mode: "kernel", running: "kernel", cpu: K, pcbA: A2, pcbB: B0, table: "A", tlb: "warm", hl: ["table"], note: "A and B are threads of the SAME process, so they share one address space: no page-table switch, and the TLB stays warm. That's why switching threads is cheaper.", tone: "good" });
  } else {
    f.push({ mode: "kernel", running: "kernel", cpu: K, pcbA: A2, pcbB: B0, table: "B", tlb: tlbAfter, hl: ["table"], note: "B is a different process, so the kernel loads B's page-table root (CR3 on x86, TTBR0 on ARM). Now the same virtual addresses mean B's memory. TLB entries for A are useless to B: tagged with a PCID they can stay, otherwise they're flushed.", tone: "warn" });
  }
  f.push({ mode: "kernel", running: "kernel", cpu: B0, pcbA: A2, pcbB: B0, table: sameProcess ? "A" : "B", tlb: tlbAfter, hl: ["cpu", "pcbB"], note: "The kernel RESTORES B's registers from B's PCB: B's program counter, stack pointer and rax are back in the CPU.", tone: "info" });
  f.push({ mode: "user", running: "B", cpu: B0, pcbA: A2, pcbB: B0, table: sameProcess ? "A" : "B", tlb: tlbAfter, hl: ["mode"], note: "Return to USER mode: B continues exactly where it stopped, as if nothing happened. The whole switch took a few microseconds.", tone: "good" });
  f.push({ mode: "user", running: "B", cpu: B1, pcbA: A2, pcbB: B0, table: sameProcess ? "A" : "B", tlb: tlbAfter, hl: ["cpu"], note: "B runs for a while. Its first memory accesses miss in the caches and TLB, which were filled with A's data. That hidden cost often exceeds the switch itself.", tone: "info" });
  f.push({ mode: "kernel", running: "kernel", cpu: B1, pcbA: A2, pcbB: B0, table: sameProcess ? "A" : "B", tlb: tlbAfter, hl: ["mode"], note: "B calls read() on a socket with no data yet. That's a system call: kernel mode again. The data isn't there, so B must sleep: a VOLUNTARY switch.", tone: "warn" });
  f.push({ mode: "kernel", running: "kernel", cpu: K, pcbA: A2, pcbB: B1, table: sameProcess ? "A" : "B", tlb: tlbAfter, hl: ["pcbB"], note: "B's registers are saved into B's PCB and B is marked WAITING. The scheduler picks A again.", tone: "info" });
  f.push({ mode: "kernel", running: "kernel", cpu: A2, pcbA: A2, pcbB: B1, table: "A", tlb: sameProcess ? "warm" : "tagged", hl: ["table", "cpu"], note: sameProcess ? "Same address space, so just restore A's registers." : "Switch back to A's page tables, then restore A's registers.", tone: "info" });
  f.push({ mode: "user", running: "A", cpu: A2, pcbA: A2, pcbB: B1, table: "A", tlb: sameProcess ? "warm" : "tagged", hl: ["mode", "cpu"], note: "A resumes at 0x401a24 with rax = 42, exactly where the timer stopped it. Neither program ever noticed it was paused.", tone: "good" });
  return f;
}

function RegBox({ title, regs, hot, dim }: { title: string; regs: Regs | null; hot: boolean; dim?: boolean }) {
  return (
    <div className={clsx("rounded-xl border-2 p-2.5 transition", dim && "opacity-60")} style={{ borderColor: hot ? C.compare : C.dim, background: hot ? `${C.compare}10` : "transparent" }}>
      <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">{title}</div>
      {regs ? (
        <div className="space-y-0.5 font-mono text-xs">
          {(["pc", "sp", "rax"] as const).map((r) => (
            <div key={r} className="flex justify-between gap-2">
              <span className="text-faint">{r}</span>
              <span className="text-ink">{regs[r]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-faint">(not saved yet: A is running)</div>
      )}
    </div>
  );
}

export default function CtxSwitch() {
  const [kind, setKind] = useState<"process" | "thread">("process");
  const frames = useMemo(() => build(kind === "thread"), [kind]);
  const s = useStepper(frames, 1300);
  const f = s.frame;
  const who = kind === "thread" ? "Thread" : "Process";

  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: "process", label: "Switch between two processes" },
          { value: "thread", label: "Between two threads" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-xl border-2 p-3" style={{ borderColor: f.hl.includes("mode") ? C.pivot : C.base }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-faint uppercase">CPU</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: f.mode === "kernel" ? C.bad : C.done }}>
              {f.mode === "kernel" ? "KERNEL MODE" : "USER MODE"}
            </span>
          </div>
          <div className="mb-2 text-sm text-ink">
            running: <b>{f.running === "kernel" ? "the kernel" : `${who} ${f.running}`}</b>
          </div>
          <RegBox title="registers" regs={f.cpu} hot={f.hl.includes("cpu")} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border px-2 py-1" style={{ borderColor: f.hl.includes("table") ? C.compare : C.dim }}>
              <div className="text-[10px] text-faint">page tables (CR3)</div>
              <div className="font-mono text-ink">{kind === "thread" ? "shared (A+B)" : `process ${f.table}`}</div>
            </div>
            <div className="rounded-lg border px-2 py-1" style={{ borderColor: C.dim }}>
              <div className="text-[10px] text-faint">TLB</div>
              <div className="font-mono" style={{ color: f.tlb === "warm" ? C.done : C.compare }}>
                {f.tlb}
              </div>
            </div>
          </div>
        </div>
        <RegBox title={`PCB of ${who.toLowerCase()} A`} regs={f.pcbA} hot={f.hl.includes("pcbA")} dim={f.running === "A"} />
        <RegBox title={`PCB of ${who.toLowerCase()} B`} regs={f.pcbB} hot={f.hl.includes("pcbB")} dim={f.running === "B"} />
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
