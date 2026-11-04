"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

// A bytecode stack machine, one instruction per step: the program counter, the operand stack,
// the variables and the output. The expression mode compiles what you type into bytecode first.
type Ins = { op: string; arg?: number | string };

const LOOP: Ins[] = [
  { op: "PUSH", arg: 0 },
  { op: "STORE", arg: "total" },
  { op: "PUSH", arg: 1 },
  { op: "STORE", arg: "i" },
  { op: "LOAD", arg: "i" },
  { op: "PUSH", arg: 4 },
  { op: "LE" },
  { op: "JUMP_IF_FALSE", arg: 17 },
  { op: "LOAD", arg: "total" },
  { op: "LOAD", arg: "i" },
  { op: "ADD" },
  { op: "STORE", arg: "total" },
  { op: "LOAD", arg: "i" },
  { op: "PUSH", arg: 1 },
  { op: "ADD" },
  { op: "STORE", arg: "i" },
  { op: "JUMP", arg: 4 },
  { op: "LOAD", arg: "total" },
  { op: "PRINT" },
  { op: "HALT" },
];
const LOOP_SRC = "total = 0; i = 1; while i <= 4 { total = total + i; i = i + 1; } print total";
const LOOP_NOTES: Record<number, string> = { 4: "loop:", 17: "end:" };

const BIN: Record<string, { op: string; f: (a: number, b: number) => number; sym: string }> = {
  "+": { op: "ADD", f: (a, b) => a + b, sym: "+" },
  "-": { op: "SUB", f: (a, b) => a - b, sym: "-" },
  "*": { op: "MUL", f: (a, b) => a * b, sym: "*" },
  "/": { op: "DIV", f: (a, b) => Math.floor(a / b), sym: "/" },
};
const OPS: Record<string, (a: number, b: number) => number> = {
  ...Object.fromEntries(Object.values(BIN).map((b) => [b.op, b.f])),
  LT: (a, b) => Number(a < b),
  LE: (a, b) => Number(a <= b),
};

// precedence climbing straight to bytecode: the code for the left side, the right side, then the operator
function compile(src: string): Ins[] | string {
  const toks = src.match(/\d+|[-+*/()]|\S/g) ?? [];
  let pos = 0;
  const code: Ins[] = [];
  const prec = (t: string | undefined) => (t === "+" || t === "-" ? 1 : t === "*" || t === "/" ? 2 : 0);
  const atom = (): string | null => {
    const t = toks[pos++];
    if (t === undefined) return "the expression ends too early";
    if (/^\d+$/.test(t)) {
      code.push({ op: "PUSH", arg: Number(t) });
      return null;
    }
    if (t === "(") {
      const e = expr(1);
      if (e) return e;
      if (toks[pos++] !== ")") return 'missing ")"';
      return null;
    }
    if (t === "-") {
      code.push({ op: "PUSH", arg: 0 });
      const e = atom();
      code.push({ op: "SUB" });
      return e;
    }
    return `unexpected "${t}"`;
  };
  const expr = (min: number): string | null => {
    const e = atom();
    if (e) return e;
    while (prec(toks[pos]) >= min && prec(toks[pos]) > 0) {
      const op = toks[pos++];
      const r = expr(prec(op) + 1);
      if (r) return r;
      code.push({ op: BIN[op].op });
    }
    return null;
  };
  const err = expr(1);
  if (err) return err;
  if (pos < toks.length) return `unexpected "${toks[pos]}"`;
  code.push({ op: "PRINT" }, { op: "HALT" });
  return code;
}

interface Frame {
  pc: number;
  stack: number[];
  vars: Record<string, number>;
  out: string[];
  msg: string;
  done: "no" | "ok" | "err";
  steps: number;
}

function execute(code: Ins[]): Frame[] {
  let pc = 0;
  const stack: number[] = [];
  const vars: Record<string, number> = {};
  const out: string[] = [];
  const frames: Frame[] = [{ pc, stack: [], vars: {}, out: [], msg: "pc = 0. The VM's loop: fetch the instruction at pc, decode its opcode, execute it, move pc on.", done: "no", steps: 0 }];
  const push = (msg: string, done: Frame["done"] = "no") =>
    frames.push({ pc, stack: [...stack], vars: { ...vars }, out: [...out], msg, done, steps: frames.length });
  for (let n = 0; n < 300; n++) {
    const ins = code[pc];
    const at = pc;
    switch (ins.op) {
      case "PUSH":
        stack.push(ins.arg as number);
        pc++;
        push(`${at}: PUSH ${ins.arg} puts the constant on top of the stack.`);
        break;
      case "LOAD":
        stack.push(vars[ins.arg as string] ?? 0);
        pc++;
        push(`${at}: LOAD ${ins.arg} pushes the variable's value, ${vars[ins.arg as string] ?? 0}.`);
        break;
      case "STORE":
        vars[ins.arg as string] = stack.pop()!;
        pc++;
        push(`${at}: STORE ${ins.arg} pops the top value, ${vars[ins.arg as string]}, into the variable.`);
        break;
      case "JUMP":
        pc = ins.arg as number;
        push(`${at}: JUMP ${ins.arg}: set pc to ${ins.arg}, back to the loop condition.`);
        break;
      case "JUMP_IF_FALSE": {
        const c = stack.pop()!;
        pc = c ? pc + 1 : (ins.arg as number);
        push(`${at}: JUMP_IF_FALSE pops ${c}. ${c ? "True, so fall through into the loop body." : `False, so jump to ${ins.arg}: the loop is over.`}`);
        break;
      }
      case "PRINT":
        out.push(String(stack.pop()));
        pc++;
        push(`${at}: PRINT pops the top value and prints it: ${out[out.length - 1]}.`);
        break;
      case "HALT":
        push(`${at}: HALT. The program ran ${frames.length - 1} instructions${stack.length ? "" : ", and the stack is empty again, as it should be"}.`, "ok");
        return frames;
      default: {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (ins.op === "DIV" && b === 0) {
          push(`${at}: DIV with ${b} on top: division by zero, a runtime error.`, "err");
          return frames;
        }
        const r = OPS[ins.op](a, b);
        stack.push(r);
        pc++;
        push(`${at}: ${ins.op} pops ${b} and ${a}, computes ${a} ${ins.op === "LT" ? "<" : ins.op === "LE" ? "<=" : Object.values(BIN).find((x) => x.op === ins.op)!.sym} ${b} = ${r}${ins.op === "LE" || ins.op === "LT" ? (r ? " (true)" : " (false)") : ""}, and pushes it.`);
      }
    }
  }
  push("Stopped after 300 steps.", "err");
  return frames;
}

const fmt = (i: Ins) => `${i.op}${i.arg !== undefined ? ` ${i.arg}` : ""}`;

export default function StackVM() {
  const [mode, setMode] = useState<"expr" | "loop">("expr");
  const [src, setSrc] = useState("(2 + 3) * 4 - 6 / 2");
  const code = useMemo(() => (mode === "loop" ? LOOP : compile(src.slice(0, 60))), [mode, src]);
  const frames = useMemo<Frame[]>(
    () => (typeof code === "string" ? [{ pc: -1, stack: [], vars: {}, out: [], msg: `Can't compile that: ${code}.`, done: "err", steps: 0 }] : execute(code)),
    [code],
  );
  const s = useStepper(frames, 650);
  const f = s.frame;
  const prog = typeof code === "string" ? [] : code;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "expr", label: "Compile an expression" },
          { value: "loop", label: "A while loop" },
        ]}
      />
      {mode === "expr" ? (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={src} onChange={setSrc} width="w-56" placeholder="e.g. 2 + 3 * 4" />
          {["(2 + 3) * 4 - 6 / 2", "2 + 3 * 4", "100 / (7 - 2 * 3) - -5", "8 / (2 - 2)"].map((p) => (
            <SmallBtn key={p} onClick={() => setSrc(p)}>
              {p}
            </SmallBtn>
          ))}
        </div>
      ) : (
        <p className="font-mono text-xs text-dim">{LOOP_SRC}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-panel p-2 font-mono text-xs">
          <div className="mb-1 text-[10px] tracking-wider text-faint uppercase">bytecode</div>
          {prog.map((ins, i) => (
            <div key={i} className="flex items-center gap-2 rounded px-1.5 py-0.5" style={{ background: i === f.pc ? `${C.active}1f` : undefined, color: i === f.pc ? C.text : C.muted }}>
              <span className="w-4 text-center" style={{ color: C.active }}>
                {i === f.pc ? "▶" : ""}
              </span>
              <span className="w-5 text-right text-faint">{i}</span>
              <span className="font-semibold" style={{ color: i === f.pc ? C.active : undefined }}>
                {fmt(ins)}
              </span>
              {mode === "loop" && LOOP_NOTES[i] && <span className="text-faint">; {LOOP_NOTES[i]}</span>}
            </div>
          ))}
        </div>
        <div className="flex flex-col rounded-xl border border-line bg-panel p-2">
          <div className="mb-1 text-[10px] tracking-wider text-faint uppercase">stack</div>
          <div className="flex flex-1 flex-col justify-end gap-1">
            {[...f.stack].reverse().map((v, i) => (
              <div
                key={f.stack.length - i}
                className="rounded-lg border py-1 text-center font-mono text-sm font-semibold"
                style={{ borderColor: i === 0 ? C.active : C.dim, background: i === 0 ? `${C.active}14` : "#ffffff" }}
              >
                {v}
              </div>
            ))}
            <div className="border-t-2 pt-0.5 text-center text-[9px] text-faint" style={{ borderColor: C.base }}>
              bottom
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-panel p-2">
            <div className="mb-1 text-[10px] tracking-wider text-faint uppercase">variables</div>
            {Object.keys(f.vars).length === 0 ? (
              <div className="font-mono text-xs text-faint">none yet</div>
            ) : (
              Object.entries(f.vars).map(([k, v]) => (
                <div key={k} className="font-mono text-xs">
                  {k} = <span className="font-semibold">{v}</span>
                </div>
              ))
            )}
          </div>
          <div className="rounded-xl border border-line bg-panel p-2">
            <div className="mb-1 text-[10px] tracking-wider text-faint uppercase">output</div>
            <div className="font-mono text-sm font-semibold" style={{ color: C.done }}>
              {f.out.join(" ") || <span className="text-xs font-normal text-faint">nothing yet</span>}
            </div>
          </div>
          <Stat label="instructions executed" value={f.steps} color={C.active} />
        </div>
      </div>

      <Narration tone={f.done === "ok" ? "good" : f.done === "err" ? "bad" : "info"}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
