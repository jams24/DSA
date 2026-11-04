"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

// Classic optimization passes on straight-line three-address code, run in rounds until nothing
// changes (a fixpoint). Each step applies one pass and highlights exactly what it changed.
interface Ins {
  dst: string; // "" for print
  op: string; // "=", "+", "-", "*", "/", "<<", "print"
  a: string;
  b?: string;
}
const parseIns = (line: string): Ins => {
  const p = line.trim().split(/\s+/);
  if (p[0] === "print") return { dst: "", op: "print", a: p[1] };
  return p.length === 3 ? { dst: p[0], op: "=", a: p[2] } : { dst: p[0], op: p[3], a: p[2], b: p[4] };
};
const show = (i: Ins) => (i.op === "print" ? `print ${i.a}` : i.op === "=" ? `${i.dst} = ${i.a}` : `${i.dst} = ${i.a} ${i.op} ${i.b}`);
const isNum = (x: string | undefined) => x !== undefined && /^-?\d+$/.test(x);

const PROGRAMS: Record<string, { label: string; code: string[] }> = {
  mixed: {
    label: "A bit of everything",
    code: ["a = 4", "b = a * 2", "c = b", "d = x * 8", "e = x * 8", "f = d + e", "g = c + y", "t = g * 1", "u = f * 2", "dead = u * 99", "print t", "print u"],
  },
  fold: {
    label: "Folds away",
    code: ["w = 60", "h = 24", "area = w * h", "half = area / 2", "k = half * 1", "t1 = k + 0", "t2 = n * 16", "t3 = n * 16", "s = t2 + t3", "print t1", "print s"],
  },
};

type Pass = { name: string; what: string; run: (code: Ins[]) => { code: Ins[]; changed: Set<number>; removed: Set<number> } };

const same = (code: Ins[]) => code.map((i) => ({ ...i }));

const PASSES: Pass[] = [
  {
    name: "Constant propagation + folding",
    what: "Replace variables known to hold a constant with that constant, compute operations whose operands are all constants, and simplify x * 1, x + 0, x * 0.",
    run(code) {
      const out = same(code);
      const known = new Map<string, string>();
      const changed = new Set<number>();
      out.forEach((ins, i) => {
        const before = show(ins);
        const sub = (x: string | undefined) => (x !== undefined && known.has(x) ? known.get(x)! : x);
        ins.a = sub(ins.a)!;
        if (ins.b !== undefined) ins.b = sub(ins.b);
        if (ins.b !== undefined) {
          const { a, b, op } = ins;
          if (isNum(a) && isNum(b) && !(op === "/" && Number(b) === 0)) {
            const x = Number(a);
            const y = Number(b);
            const v = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : op === "/" ? Math.floor(x / y) : x << y;
            Object.assign(ins, { op: "=", a: String(v), b: undefined });
          } else if ((op === "*" && b === "1") || ((op === "+" || op === "-" || op === "<<") && b === "0")) Object.assign(ins, { op: "=", b: undefined });
          else if ((op === "*" && a === "1") || (op === "+" && a === "0")) Object.assign(ins, { op: "=", a: b, b: undefined });
          else if (op === "*" && (a === "0" || b === "0")) Object.assign(ins, { op: "=", a: "0", b: undefined });
        }
        if (ins.op === "=" && isNum(ins.a)) known.set(ins.dst, ins.a);
        if (show(ins) !== before) changed.add(i);
      });
      return { code: out, changed, removed: new Set() };
    },
  },
  {
    name: "Copy propagation",
    what: "After x = y, use y directly wherever x is read. The copy itself becomes dead.",
    run(code) {
      const out = same(code);
      const copy = new Map<string, string>();
      const changed = new Set<number>();
      out.forEach((ins, i) => {
        const before = show(ins);
        const sub = (x: string | undefined) => (x !== undefined && copy.has(x) ? copy.get(x)! : x);
        ins.a = sub(ins.a)!;
        if (ins.b !== undefined) ins.b = sub(ins.b);
        if (ins.op === "=" && !isNum(ins.a)) copy.set(ins.dst, ins.a);
        if (show(ins) !== before) changed.add(i);
      });
      return { code: out, changed, removed: new Set() };
    },
  },
  {
    name: "Common subexpression elimination",
    what: "If the same operation on the same operands was already computed, reuse that result instead of computing it again.",
    run(code) {
      const out = same(code);
      const seen = new Map<string, string>();
      const changed = new Set<number>();
      out.forEach((ins, i) => {
        if (ins.b === undefined) return;
        const ops = ins.op === "+" || ins.op === "*" ? [ins.a, ins.b].sort() : [ins.a, ins.b];
        const key = `${ins.op} ${ops.join(" ")}`;
        const prev = seen.get(key);
        if (prev) {
          Object.assign(ins, { op: "=", a: prev, b: undefined });
          changed.add(i);
        } else seen.set(key, ins.dst);
      });
      return { code: out, changed, removed: new Set() };
    },
  },
  {
    name: "Strength reduction",
    what: "Replace an expensive operation with a cheaper one: multiplying by a power of two becomes a left shift.",
    run(code) {
      const out = same(code);
      const changed = new Set<number>();
      out.forEach((ins, i) => {
        if (ins.op !== "*") return;
        const [v, k] = isNum(ins.b) ? [ins.a, Number(ins.b)] : isNum(ins.a) ? [ins.b!, Number(ins.a)] : ["", 0];
        if (v && k > 1 && (k & (k - 1)) === 0 && !isNum(v)) {
          Object.assign(ins, { op: "<<", a: v, b: String(Math.log2(k)) });
          changed.add(i);
        }
      });
      return { code: out, changed, removed: new Set() };
    },
  },
  {
    name: "Dead code elimination",
    what: "Walk backwards from what the program prints: an instruction whose result is never used afterwards can be deleted.",
    run(code) {
      const live = new Set<string>();
      const removed = new Set<number>();
      for (let i = code.length - 1; i >= 0; i--) {
        const ins = code[i];
        if (ins.op !== "print" && !live.has(ins.dst)) {
          removed.add(i);
          continue;
        }
        live.delete(ins.dst);
        for (const x of [ins.a, ins.b]) if (x !== undefined && !isNum(x)) live.add(x);
      }
      return { code: code.filter((_, i) => !removed.has(i)), changed: new Set(), removed };
    },
  },
];

interface Frame {
  title: string;
  what: string;
  rows: { text: string; state: "same" | "changed" | "removed" }[];
  count: number;
  round: number;
}

function optimize(start: Ins[]): Frame[] {
  const frames: Frame[] = [{ title: "The original code", what: "Straight-line three-address code: one operation per line. Press play to run the passes.", rows: start.map((i) => ({ text: show(i), state: "same" })), count: start.length, round: 0 }];
  let code = start;
  for (let round = 1; round <= 6; round++) {
    let any = false;
    for (const p of PASSES) {
      const r = p.run(code);
      if (r.changed.size === 0 && r.removed.size === 0) continue;
      any = true;
      // the passes never insert lines, so old and new code line up row by row
      const rows: Frame["rows"] = [];
      let j = 0;
      code.forEach((ins, i) => {
        if (r.removed.has(i)) rows.push({ text: show(ins), state: "removed" });
        else {
          rows.push({ text: show(r.code[j]), state: r.changed.has(i) ? "changed" : "same" });
          j++;
        }
      });
      frames.push({ title: p.name, what: p.what, rows, count: r.code.length, round });
      code = r.code;
    }
    if (!any) {
      frames.push({ title: "Fixpoint", what: `A whole round of passes changed nothing, so the optimizer stops. ${start.length} instructions became ${code.length}.`, rows: code.map((i) => ({ text: show(i), state: "same" })), count: code.length, round });
      break;
    }
  }
  return frames;
}

export default function Optimizer() {
  const [prog, setProg] = useState("mixed");
  const frames = useMemo(() => optimize(PROGRAMS[prog].code.map(parseIns)), [prog]);
  const s = useStepper(frames, 1300);
  const f = s.frame;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <Segmented value={prog} onChange={setProg} options={Object.entries(PROGRAMS).map(([value, p]) => ({ value, label: p.label }))} />
      <div className="flex flex-wrap gap-1.5">
        {PASSES.map((p) => (
          <span
            key={p.name}
            className="rounded-lg border px-2 py-1 text-[11px]"
            style={{ borderColor: p.name === f.title ? C.active : C.dim, color: p.name === f.title ? C.active : C.muted, fontWeight: p.name === f.title ? 600 : 400 }}
          >
            {p.name}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-panel p-3 font-mono text-sm">
        {f.rows.map((r, i) => (
          <div
            key={i}
            className="rounded px-2 py-0.5"
            style={{
              background: r.state === "changed" ? `${C.active}1a` : r.state === "removed" ? `${C.bad}12` : undefined,
              color: r.state === "removed" ? C.bad : r.state === "changed" ? C.text : C.muted,
              textDecoration: r.state === "removed" ? "line-through" : undefined,
              fontWeight: r.state === "changed" ? 600 : 400,
            }}
          >
            {r.text}
          </div>
        ))}
      </div>

      <Narration tone={f.title === "Fixpoint" ? "good" : "info"}>
        <span className="font-semibold">
          {f.title}
          {f.round > 0 && f.title !== "Fixpoint" ? ` (round ${f.round})` : ""}:{" "}
        </span>
        {f.what}
      </Narration>
      <StepControls s={s} />
      <div className="flex flex-wrap gap-3">
        <Stat label="instructions" value={f.count} color={C.active} />
        <Stat label="at the start" value={PROGRAMS[prog].code.length} color={C.muted} />
      </div>
      <p className="text-xs text-faint">
        Passes enable each other: folding creates copies, copy propagation makes code dead, and dead code elimination removes it. That&apos;s why compilers
        run their passes in rounds.
      </p>
    </div>
  );
}
