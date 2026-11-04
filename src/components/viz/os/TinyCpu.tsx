"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

// A toy CPU with three registers, a program counter and an instruction register, stepping through
// fetch -> decode -> execute for every instruction.
type Reg = "A" | "B" | "C";
type Instr =
  | { op: "LOAD"; r: Reg; n: number }
  | { op: "ADD"; r: Reg; s: Reg }
  | { op: "INC" | "DEC"; r: Reg }
  | { op: "JLT"; r: Reg; s: Reg; to: number }
  | { op: "JNZ"; r: Reg; to: number }
  | { op: "HALT" };

const PROGRAMS: Record<string, { label: string; goal: string; code: Instr[] }> = {
  sum: {
    label: "Add 1 to 5",
    goal: "A = 1 + 2 + 3 + 4 + 5",
    code: [
      { op: "LOAD", r: "A", n: 0 },
      { op: "LOAD", r: "B", n: 1 },
      { op: "LOAD", r: "C", n: 6 },
      { op: "ADD", r: "A", s: "B" },
      { op: "INC", r: "B" },
      { op: "JLT", r: "B", s: "C", to: 3 },
      { op: "HALT" },
    ],
  },
  mul: {
    label: "Multiply 3 × 4",
    goal: "A = 4 + 4 + 4 (multiplying by adding)",
    code: [
      { op: "LOAD", r: "A", n: 0 },
      { op: "LOAD", r: "B", n: 3 },
      { op: "LOAD", r: "C", n: 4 },
      { op: "ADD", r: "A", s: "C" },
      { op: "DEC", r: "B" },
      { op: "JNZ", r: "B", to: 3 },
      { op: "HALT" },
    ],
  },
};

const text = (i: Instr) => {
  switch (i.op) {
    case "LOAD":
      return `LOAD ${i.r}, ${i.n}`;
    case "ADD":
      return `ADD  ${i.r}, ${i.s}`;
    case "INC":
    case "DEC":
      return `${i.op}  ${i.r}`;
    case "JLT":
      return `JLT  ${i.r}, ${i.s}, @${i.to}`;
    case "JNZ":
      return `JNZ  ${i.r}, @${i.to}`;
    case "HALT":
      return "HALT";
  }
};

const meaning = (i: Instr) => {
  switch (i.op) {
    case "LOAD":
      return `"Put the number ${i.n} into register ${i.r}."`;
    case "ADD":
      return `"Add register ${i.s} to register ${i.r}." The ALU (the CPU's calculator) will do the maths.`;
    case "INC":
      return `"Add 1 to register ${i.r}."`;
    case "DEC":
      return `"Take 1 away from register ${i.r}."`;
    case "JLT":
      return `"If ${i.r} is less than ${i.s}, jump back to instruction ${i.to}." This is how loops work: change the PC.`;
    case "JNZ":
      return `"If ${i.r} is not zero, jump back to instruction ${i.to}."`;
    case "HALT":
      return `"Stop."`;
  }
};

type Phase = "start" | "fetch" | "decode" | "execute" | "done";
interface Frame {
  phase: Phase;
  pc: number;
  ir: number | null;
  regs: Record<Reg, number>;
  changed: (Reg | "PC")[];
  alu: string | null;
  cycles: number;
  note: string;
  tone: "info" | "good" | "warn";
}

function build(code: Instr[], goal: string): Frame[] {
  const frames: Frame[] = [];
  const regs: Record<Reg, number> = { A: 0, B: 0, C: 0 };
  let pc = 0;
  let cycles = 0;
  const push = (f: Omit<Frame, "regs" | "pc" | "cycles">) => frames.push({ ...f, regs: { ...regs }, pc, cycles });
  push({ phase: "start", ir: null, changed: [], alu: null, note: `Goal: ${goal}. The program sits in memory as numbered instructions. The PC (program counter) says which one is next: 0.`, tone: "info" });
  for (let guard = 0; guard < 60; guard++) {
    const at = pc;
    const ins = code[at];
    push({ phase: "fetch", ir: at, changed: [], alu: null, note: `FETCH: copy instruction ${at} ("${text(ins)}") from memory into the instruction register (IR).`, tone: "info" });
    pc = at + 1;
    cycles++;
    push({ phase: "decode", ir: at, changed: ["PC"], alu: null, note: `DECODE: work out what it means: ${meaning(ins)} The PC already moved on to ${pc}.`, tone: "info" });
    let alu: string | null = null;
    const changed: (Reg | "PC")[] = [];
    let note = "";
    switch (ins.op) {
      case "LOAD":
        regs[ins.r] = ins.n;
        changed.push(ins.r);
        note = `EXECUTE: register ${ins.r} = ${ins.n}.`;
        break;
      case "ADD": {
        const before = regs[ins.r];
        regs[ins.r] = before + regs[ins.s];
        alu = `${before} + ${regs[ins.s]} = ${regs[ins.r]}`;
        changed.push(ins.r);
        note = `EXECUTE: the ALU computes ${alu} and stores it in ${ins.r}.`;
        break;
      }
      case "INC":
      case "DEC":
        regs[ins.r] += ins.op === "INC" ? 1 : -1;
        alu = `${ins.op === "INC" ? regs[ins.r] - 1 : regs[ins.r] + 1} ${ins.op === "INC" ? "+" : "−"} 1 = ${regs[ins.r]}`;
        changed.push(ins.r);
        note = `EXECUTE: ${ins.r} is now ${regs[ins.r]}.`;
        break;
      case "JLT":
      case "JNZ": {
        const taken = ins.op === "JLT" ? regs[ins.r] < regs[ins.s] : regs[ins.r] !== 0;
        alu = ins.op === "JLT" ? `${regs[ins.r]} < ${regs[ins.s]} ? ${taken ? "yes" : "no"}` : `${regs[ins.r]} ≠ 0 ? ${taken ? "yes" : "no"}`;
        if (taken) {
          pc = ins.to;
          changed.push("PC");
        }
        note = taken ? `EXECUTE: the test is true, so the PC is overwritten with ${ins.to}: go round the loop again.` : `EXECUTE: the test is false, so no jump: carry on to ${pc}.`;
        break;
      }
      case "HALT":
        push({ phase: "done", ir: at, changed: [], alu: null, note: `HALT. Finished in ${cycles} instructions: A = ${regs.A}. A real 4 GHz CPU does about 4 billion cycles per second, and finishes several instructions per cycle.`, tone: "good" });
        return frames;
    }
    push({ phase: "execute", ir: at, changed, alu, note, tone: changed.includes("PC") ? "warn" : "info" });
  }
  return frames;
}

const PHASES: Phase[] = ["fetch", "decode", "execute"];

export default function TinyCpu() {
  const [prog, setProg] = useState("sum");
  const p = PROGRAMS[prog];
  const frames = useMemo(() => build(p.code, p.goal), [p]);
  const s = useStepper(frames, 900);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented value={prog} onChange={setProg} options={Object.entries(PROGRAMS).map(([value, v]) => ({ value, label: v.label }))} />

      <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Memory: the program</div>
          <div className="overflow-hidden rounded-xl border border-line">
            {p.code.map((ins, i) => {
              const isPc = f.pc === i && f.phase !== "done";
              const isIr = f.ir === i;
              return (
                <div
                  key={i}
                  className={clsx("flex items-center gap-3 border-b border-line px-3 py-1.5 font-mono text-xs last:border-b-0 transition")}
                  style={{ background: isIr ? `${C.active}18` : undefined }}
                >
                  <span className="w-5 text-right text-faint">{i}</span>
                  <span className="flex-1 text-ink">{text(ins)}</span>
                  {isPc && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: C.compare }}>
                      PC
                    </span>
                  )}
                  {isIr && f.phase !== "start" && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: C.active }}>
                      IR
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-1.5">
            {PHASES.map((ph) => (
              <div
                key={ph}
                className="flex-1 rounded-lg border-2 py-1.5 text-center text-[11px] font-bold tracking-wider uppercase transition"
                style={{ borderColor: f.phase === ph ? C.pivot : C.dim, color: f.phase === ph ? C.pivot : C.faint, background: f.phase === ph ? `${C.pivot}12` : "transparent" }}
              >
                {ph}
              </div>
            ))}
          </div>
          <div className="rounded-xl border-2 p-3" style={{ borderColor: C.base }}>
            <div className="mb-2 text-[10px] font-semibold tracking-wider text-faint uppercase">CPU</div>
            <div className="grid grid-cols-4 gap-2">
              {(["A", "B", "C"] as Reg[]).map((r) => (
                <div
                  key={r}
                  className="rounded-lg border-2 px-2 py-1.5 text-center transition"
                  style={{ borderColor: f.changed.includes(r) ? C.done : C.dim, background: f.changed.includes(r) ? `${C.done}14` : "transparent" }}
                >
                  <div className="text-[10px] text-faint">reg {r}</div>
                  <div className="font-mono text-lg font-bold text-ink tabular-nums">{f.regs[r]}</div>
                </div>
              ))}
              <div
                className="rounded-lg border-2 px-2 py-1.5 text-center transition"
                style={{ borderColor: f.changed.includes("PC") ? C.compare : C.dim, background: f.changed.includes("PC") ? `${C.compare}14` : "transparent" }}
              >
                <div className="text-[10px] text-faint">PC</div>
                <div className="font-mono text-lg font-bold text-ink tabular-nums">{f.phase === "done" ? "–" : f.pc}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-line px-2 py-1.5">
                <div className="text-[10px] text-faint">IR (instruction register)</div>
                <div className="font-mono text-xs text-ink">{f.ir === null ? "–" : text(p.code[f.ir])}</div>
              </div>
              <div className="rounded-lg border px-2 py-1.5" style={{ borderColor: f.alu ? C.pivot : C.dim }}>
                <div className="text-[10px] text-faint">ALU</div>
                <div className="font-mono text-xs" style={{ color: f.alu ? C.pivot : C.faint }}>
                  {f.alu ?? "idle"}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="instructions run" value={f.cycles} color={C.active} />
            <Stat label="register A" value={f.regs.A} color={C.done} />
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
