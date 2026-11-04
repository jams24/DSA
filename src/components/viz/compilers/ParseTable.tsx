"use client";

import { useMemo, useState } from "react";
import { C, Narration, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

// Table-driven parsing of arithmetic, step by step: an LL(1) predictive parser (top-down: expand
// the nonterminal on top of the stack) and an SLR parser (bottom-up: shift tokens, reduce handles).
const TERMS = ["id", "+", "*", "(", ")", "$"] as const;
type Term = (typeof TERMS)[number];

function tokenize(src: string): { toks: Term[]; bad: string | null } {
  const toks: Term[] = [];
  const re = /\s*(?:([A-Za-z_][A-Za-z0-9_]*|[0-9]+)|([+*()]))/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) return { toks, bad: src.slice(i).trim()[0] };
    toks.push(m[1] ? "id" : (m[2] as Term));
    i = re.lastIndex;
  }
  toks.push("$");
  return { toks, bad: null };
}

const PRESETS = ["id + id * id", "(a + b) * c", "x * (y + 2) + z", "a + * b", "(a + b"];

// ---------------------------------------------------------------- LL(1)
const NONTERMS = ["E", "E'", "T", "T'", "F"] as const;
const LL: Record<string, Partial<Record<Term, string[]>>> = {
  E: { id: ["T", "E'"], "(": ["T", "E'"] },
  "E'": { "+": ["+", "T", "E'"], ")": [], $: [] },
  T: { id: ["F", "T'"], "(": ["F", "T'"] },
  "T'": { "+": [], "*": ["*", "F", "T'"], ")": [], $: [] },
  F: { id: ["id"], "(": ["(", "E", ")"] },
};
const rhs = (r: string[]) => (r.length ? r.join(" ") : "ε");

interface LLFrame {
  stack: string[];
  pos: number;
  cell: [string, Term] | null;
  msg: string;
  status: "run" | "ok" | "err";
}

function runLL(toks: Term[]): LLFrame[] {
  const stack = ["$", "E"];
  let pos = 0;
  const frames: LLFrame[] = [{ stack: [...stack], pos, cell: null, msg: "Start with $ and the start symbol E on the stack. The top of the stack is on the right.", status: "run" }];
  for (let guard = 0; guard < 200; guard++) {
    const top = stack[stack.length - 1];
    const a = toks[pos];
    if (top === "$" && a === "$") {
      frames.push({ stack: [...stack], pos, cell: null, msg: "Both the stack and the input are down to $: ACCEPT. The rules used, in order, are a leftmost derivation.", status: "ok" });
      break;
    }
    if (!(top in LL)) {
      if (top === a) {
        stack.pop();
        pos++;
        frames.push({ stack: [...stack], pos, cell: null, msg: `The top of the stack is the terminal ${top} and so is the next token: match, and move on.`, status: "run" });
        continue;
      }
      frames.push({ stack: [...stack], pos, cell: null, msg: `Syntax error: expected ${top}, but the next token is ${a}.`, status: "err" });
      break;
    }
    const rule = LL[top][a];
    if (!rule) {
      frames.push({ stack: [...stack], pos, cell: [top, a], msg: `Syntax error: the table has no rule for ${top} when the next token is ${a}. The cell is empty.`, status: "err" });
      break;
    }
    stack.pop();
    for (let j = rule.length - 1; j >= 0; j--) stack.push(rule[j]);
    frames.push({
      stack: [...stack],
      pos,
      cell: [top, a],
      msg: `${top} is on top and the next token is ${a}: the table says ${top} → ${rhs(rule)}. Pop ${top}${rule.length ? " and push the right side, reversed, so its first symbol is on top" : "; it derives nothing here"}.`,
      status: "run",
    });
  }
  return frames;
}

// ---------------------------------------------------------------- SLR (the Dragon Book's numbering)
const RULES: [string, string[]][] = [
  ["E'", ["E"]],
  ["E", ["E", "+", "T"]],
  ["E", ["T"]],
  ["T", ["T", "*", "F"]],
  ["T", ["F"]],
  ["F", ["(", "E", ")"]],
  ["F", ["id"]],
];
const S = (n: number) => `s${n}`;
const Rd = (n: number) => `r${n}`;
const ACTION: Partial<Record<Term, string>>[] = [
  { id: S(5), "(": S(4) },
  { "+": S(6), $: "acc" },
  { "+": Rd(2), "*": S(7), ")": Rd(2), $: Rd(2) },
  { "+": Rd(4), "*": Rd(4), ")": Rd(4), $: Rd(4) },
  { id: S(5), "(": S(4) },
  { "+": Rd(6), "*": Rd(6), ")": Rd(6), $: Rd(6) },
  { id: S(5), "(": S(4) },
  { id: S(5), "(": S(4) },
  { "+": S(6), ")": S(11) },
  { "+": Rd(1), "*": S(7), ")": Rd(1), $: Rd(1) },
  { "+": Rd(3), "*": Rd(3), ")": Rd(3), $: Rd(3) },
  { "+": Rd(5), "*": Rd(5), ")": Rd(5), $: Rd(5) },
];
const GOTO: Record<number, Record<string, number>> = { 0: { E: 1, T: 2, F: 3 }, 4: { E: 8, T: 2, F: 3 }, 6: { T: 9, F: 3 }, 7: { F: 10 } };

function note(st: number, act: string, a: Term): string {
  if (st === 2 && act === "r2" && a === "+")
    return " State 2 could also continue T → T • * F, but + can follow E and * can't, so it reduces. With * next it would shift instead: that's precedence, built into the table.";
  if (st === 9 && act === "r1" && a === "+") return " Reducing E + T before shifting the next + groups it as (a + b) + c: + is left-associative.";
  return "";
}

interface LRFrame {
  states: number[];
  syms: string[];
  pos: number;
  cell: [number, string] | null;
  msg: string;
  status: "run" | "ok" | "err";
}

function runLR(toks: Term[]): LRFrame[] {
  const states = [0];
  const syms: string[] = [];
  let pos = 0;
  const frames: LRFrame[] = [{ states: [...states], syms: [...syms], pos, cell: null, msg: "Start in state 0 with an empty stack. Each step looks up ACTION[state on top, next token].", status: "run" }];
  for (let guard = 0; guard < 200; guard++) {
    const st = states[states.length - 1];
    const a = toks[pos];
    const act = ACTION[st][a];
    if (!act) {
      frames.push({ states: [...states], syms: [...syms], pos, cell: [st, a], msg: `Syntax error: ACTION[${st}, ${a}] is empty. No valid program can continue like this.`, status: "err" });
      break;
    }
    if (act === "acc") {
      frames.push({ states: [...states], syms: [...syms], pos, cell: [st, a], msg: "ACTION says accept: the whole input reduced to E. The reductions, read backwards, are a rightmost derivation.", status: "ok" });
      break;
    }
    if (act[0] === "s") {
      const to = Number(act.slice(1));
      states.push(to);
      syms.push(a);
      pos++;
      const why = (st === 2 || st === 9) && a === "*" ? " Shifting the * now, before reducing what's below it, is what makes * bind tighter than +." : "";
      frames.push({ states: [...states], syms: [...syms], pos, cell: [st, a], msg: `ACTION[${st}, ${a}] = shift ${to}: push the token ${a} and go to state ${to}.${why}`, status: "run" });
      continue;
    }
    const [lhs, body] = RULES[Number(act.slice(1))];
    states.splice(states.length - body.length);
    syms.splice(syms.length - body.length);
    const under = states[states.length - 1];
    const to = GOTO[under][lhs];
    states.push(to);
    syms.push(lhs);
    frames.push({
      states: [...states],
      syms: [...syms],
      pos,
      cell: [st, a],
      msg: `ACTION[${st}, ${a}] = reduce by rule ${act.slice(1)}, ${lhs} → ${body.join(" ")}: pop ${body.length} symbol${body.length > 1 ? "s" : ""}, uncovering state ${under}; GOTO[${under}, ${lhs}] = ${to}.${note(st, act, a)}`,
      status: "run",
    });
  }
  return frames;
}

// ---------------------------------------------------------------- UI
const cellCls = "border border-line px-2 py-1 text-center font-mono text-[11px]";

function InputRow({ toks, pos }: { toks: Term[]; pos: number }) {
  return (
    <div className="flex flex-wrap gap-1 font-mono text-xs">
      {toks.map((t, i) => (
        <span
          key={i}
          className="rounded-md border px-2 py-1"
          style={{ borderColor: i === pos ? C.active : C.dim, color: i < pos ? C.faint : C.text, background: i === pos ? `${C.active}18` : undefined, textDecoration: i < pos ? "line-through" : undefined }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export default function ParseTable({ mode }: { mode: "ll" | "lr" }) {
  const [src, setSrc] = useState(PRESETS[0]);
  const { toks, bad } = useMemo(() => tokenize(src.slice(0, 60)), [src]);
  const frames = useMemo<(LLFrame | LRFrame | null)[]>(() => (bad ? [null] : mode === "ll" ? runLL(toks) : runLR(toks)), [mode, toks, bad]);
  const s = useStepper(frames, 750);
  const f = s.frame;
  const ll = mode === "ll" ? (frames as LLFrame[]) : [];
  const lr = mode === "lr" ? (frames as LRFrame[]) : [];

  const llRules = ll.slice(1, s.i + 1).filter((x) => x.cell && LL[x.cell[0]][x.cell[1]]).map((x) => `${x.cell![0]} → ${rhs(LL[x.cell![0]][x.cell![1]]!)}`);
  const lrRules =
      lr
        .slice(1, s.i + 1)
        .map((x) => (x.cell ? ACTION[x.cell[0]][x.cell[1] as Term] : undefined))
        .filter((a): a is string => !!a && a[0] === "r")
        .map((a) => {
          const [l, b] = RULES[Number(a.slice(1))];
          return `${l} → ${b.join(" ")}`;
        });

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={src} onChange={setSrc} width="w-56" placeholder="e.g. a + b * c" />
        {PRESETS.map((p) => (
          <SmallBtn key={p} onClick={() => setSrc(p)}>
            {p}
          </SmallBtn>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-dim">
        {(mode === "ll"
          ? ["E → T E'", "E' → + T E' | ε", "T → F T'", "T' → * F T' | ε", "F → ( E ) | id"]
          : RULES.slice(1).map(([l, b], n) => `${n + 1}: ${l} → ${b.join(" ")}`)
        ).map((r) => (
          <span key={r} className="rounded-md border border-line bg-panel px-2 py-0.5">
            {r}
          </span>
        ))}
      </div>

      {bad || !f ? (
        <Narration tone="bad">{`"${bad}" isn't a token here. Use names or numbers, +, *, and parentheses.`}</Narration>
      ) : (
        <>
          <InputRow toks={toks} pos={f.pos} />
          <div className={mode === "lr" ? "grid gap-4 lg:grid-cols-[1fr_auto]" : "space-y-4"}>
            <div className="space-y-2">
              <div className="text-[10px] tracking-wider text-faint uppercase">stack (top on the right)</div>
              <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-xl border border-line bg-panel p-2 font-mono text-xs">
                {"stack" in f
                  ? f.stack.map((x, i) => (
                      <span key={i} className="rounded-md px-2 py-1" style={{ background: x in LL ? `${C.pivot}1a` : "#f1f5f9", color: x in LL ? C.pivot : C.text }}>
                        {x}
                      </span>
                    ))
                  : f.states.map((st, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="rounded-md px-2 py-1" style={{ background: /^[ETF]$/.test(f.syms[i - 1]) ? `${C.pivot}1a` : "#f1f5f9", color: /^[ETF]$/.test(f.syms[i - 1]) ? C.pivot : C.text }}>
                            {f.syms[i - 1]}
                          </span>
                        )}
                        <span className="rounded-md px-1.5 py-1 text-[10px]" style={{ background: `${C.active}18`, color: C.active }}>
                          {st}
                        </span>
                      </span>
                    ))}
              </div>
              <Narration tone={f.status === "ok" ? "good" : f.status === "err" ? "bad" : "info"}>{f.msg}</Narration>
              <StepControls s={s} />
            </div>

            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className={cellCls} />
                    {TERMS.map((t) => (
                      <th key={t} className={cellCls} style={{ color: C.muted }}>
                        {t}
                      </th>
                    ))}
                    {mode === "lr" &&
                      ["E", "T", "F"].map((n) => (
                        <th key={n} className={cellCls} style={{ color: C.pivot }}>
                          {n}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {mode === "ll"
                    ? NONTERMS.map((n) => (
                        <tr key={n}>
                          <th className={cellCls} style={{ color: C.pivot }}>
                            {n}
                          </th>
                          {TERMS.map((t) => {
                            const hit = f.cell?.[0] === n && f.cell?.[1] === t;
                            const r = LL[n][t];
                            return (
                              <td key={t} className={cellCls} style={{ background: hit ? (r ? `${C.active}26` : `${C.bad}22`) : undefined, color: hit ? C.text : C.muted, fontWeight: hit ? 700 : 400 }}>
                                {r ? `→ ${rhs(r)}` : ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    : ACTION.map((row, st) => (
                        <tr key={st}>
                          <th className={cellCls} style={{ color: C.active }}>
                            {st}
                          </th>
                          {TERMS.map((t) => {
                            const hit = f.cell?.[0] === st && f.cell?.[1] === t;
                            const v = row[t];
                            return (
                              <td
                                key={t}
                                className={cellCls}
                                style={{
                                  background: hit ? (v ? `${C.active}26` : `${C.bad}22`) : undefined,
                                  color: v?.[0] === "s" ? C.sky : v?.[0] === "r" ? C.orange : C.done,
                                  fontWeight: hit ? 700 : 400,
                                }}
                              >
                                {v ?? ""}
                              </td>
                            );
                          })}
                          {["E", "T", "F"].map((n) => (
                            <td key={n} className={cellCls} style={{ color: C.pivot }}>
                              {GOTO[st]?.[n] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <Stat label="steps" value={s.i} color={C.active} />
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 py-2">
              <div className="text-[10px] tracking-wider text-faint uppercase">{mode === "ll" ? "rules expanded (top-down)" : "reductions (bottom-up)"}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px] text-dim">
                {(mode === "ll" ? llRules : lrRules).map((r, i) => (
                  <span key={i} className="rounded bg-panel-3 px-1.5 py-0.5">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
