"use client";

import { useMemo, useState } from "react";
import { C, Narration, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

// Pratt parsing, one decision per step: the call stack of parse_expr(min_bp), the token under the
// cursor, and the binding-power comparison that decides whether an operator belongs to this call.
type Node = { op: string; kids: Node[] } | { leaf: string };

const INFIX: Record<string, [number, number]> = { "+": [10, 11], "-": [10, 11], "*": [20, 21], "/": [20, 21], "^": [31, 30] };
const PREFIX_MINUS = 25;
const PRESETS = ["1 + 2 * 3", "8 - 3 - 2", "2 ^ 3 ^ 2", "-2 ^ 2 + a * (b - c)", "(1 + 2) * 3", "1 + * 2"];

function tokenize(src: string): string[] | string {
  const out: string[] = [];
  const re = /\s*([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[-+*/^()])/y;
  let i = 0;
  while (i < src.length && !/^\s*$/.test(src.slice(i))) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) return src.slice(i).trim()[0];
    out.push(m[1]);
    i = re.lastIndex;
  }
  return out;
}

const sexpr = (n: Node | null): string => (n === null ? "…" : "leaf" in n ? n.leaf : `(${n.op} ${n.kids.map(sexpr).join(" ")})`);

interface Call {
  min: number;
  left: Node | null;
}
interface Frame {
  pos: number;
  calls: Call[];
  msg: string;
  tone: "info" | "good" | "bad";
  tree: Node | null;
}

function parse(toks: string[]): Frame[] {
  const frames: Frame[] = [];
  const calls: Call[] = [];
  let pos = 0;
  const snap = (msg: string, tone: Frame["tone"] = "info", tree: Node | null = null) =>
    frames.push({ pos, calls: calls.map((c) => ({ ...c })), msg, tone, tree });
  class Fail extends Error {}

  function expr(min: number): Node {
    const me: Call = { min, left: null };
    calls.push(me);
    snap(`parse_expr(${min}): ${min === 0 ? "the top-level call accepts any operator." : `only operators with a left power of at least ${min} may join this call.`}`);
    const t = toks[pos];
    let left: Node;
    if (t === undefined) {
      snap("Syntax error: the expression ended where a value was expected.", "bad");
      throw new Fail();
    } else if (/^[A-Za-z_0-9]/.test(t)) {
      pos++;
      left = { leaf: t };
      me.left = left;
      snap(`Prefix position: "${t}" is a value, so it's the start of the left side.`);
    } else if (t === "(") {
      pos++;
      snap('Prefix position: "(" starts a group. Parse a whole expression inside it with parse_expr(0).');
      left = expr(0);
      if (toks[pos] !== ")") {
        snap(`Syntax error: expected ")" but found ${toks[pos] ?? "the end"}.`, "bad");
        throw new Fail();
      }
      pos++;
      me.left = left;
      snap('Matched ")": the group is one value, as if it were a single number.');
    } else if (t === "-") {
      pos++;
      snap(`Prefix "-" (negation): parse its operand with parse_expr(${PREFIX_MINUS}). That's tighter than * but looser than ^, so -2 ^ 2 is -(2 ^ 2).`);
      left = { op: "neg", kids: [expr(PREFIX_MINUS)] };
      me.left = left;
      snap(`Build ${sexpr(left)}.`);
    } else {
      snap(`Syntax error: "${t}" can't start an expression.`, "bad");
      throw new Fail();
    }
    for (;;) {
      const op = toks[pos];
      if (op === undefined || op === ")") {
        calls.pop();
        snap(`${op === ")" ? '")" isn\'t an infix operator' : "No more tokens"}: return ${sexpr(left)} to the caller.`);
        return left;
      }
      const bp = INFIX[op];
      if (!bp) {
        snap(`Syntax error: expected an operator, found "${op}".`, "bad");
        throw new Fail();
      }
      const [l, r] = bp;
      if (l < min) {
        calls.pop();
        snap(`"${op}" has left power ${l}, less than ${min}: it belongs to an outer call. Return ${sexpr(left)}.`);
        return left;
      }
      pos++;
      snap(`"${op}" has left power ${l} ≥ ${min}: it takes ${sexpr(left)} as its left operand. Parse its right side with parse_expr(${r})${l > r ? ": right power below left, so it's right-associative" : ""}.`);
      const right = expr(r);
      left = { op, kids: [left, right] };
      me.left = left;
      snap(`Build ${sexpr(left)} and look for another operator.`);
    }
  }

  snap("Start: call parse_expr(0) on the whole token stream.");
  try {
    const tree = expr(0);
    if (pos < toks.length) {
      snap(`Syntax error: unexpected "${toks[pos]}" after a complete expression.`, "bad");
    } else snap(`Done: ${sexpr(tree)}. Every operator landed exactly where its binding powers said.`, "good", tree);
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
  }
  return frames;
}

// a tidy tree drawing: leaves spread evenly, parents centred over their children
function layout(n: Node, depth = 0, next = { x: 0 }): { n: Node; x: number; y: number; kids: ReturnType<typeof layout>[] } {
  if ("leaf" in n) return { n, x: next.x++, y: depth, kids: [] };
  const kids = n.kids.map((k) => layout(k, depth + 1, next));
  return { n, x: kids.reduce((a, k) => a + k.x, 0) / kids.length, y: depth, kids };
}

function Tree({ tree }: { tree: Node }) {
  const root = layout(tree);
  const all: ReturnType<typeof layout>[] = [];
  const walk = (p: ReturnType<typeof layout>) => {
    all.push(p);
    p.kids.forEach(walk);
  };
  walk(root);
  const maxX = Math.max(...all.map((p) => p.x));
  const maxY = Math.max(...all.map((p) => p.y));
  const W = Math.max(240, (maxX + 1) * 56);
  const X = (x: number) => 28 + (maxX ? (x / maxX) * (W - 56) : (W - 56) / 2);
  const Y = (y: number) => 26 + y * 56;
  return (
    <svg viewBox={`0 0 ${W} ${Y(maxY) + 26}`} className="mx-auto w-full" style={{ maxWidth: W }}>
      {all.flatMap((p, i) => p.kids.map((k, j) => <line key={`${i}-${j}`} x1={X(p.x)} y1={Y(p.y)} x2={X(k.x)} y2={Y(k.y)} stroke={C.base} strokeWidth={1.6} />))}
      {all.map((p, i) => {
        const leaf = "leaf" in p.n;
        const label = "leaf" in p.n ? p.n.leaf : p.n.op === "neg" ? "−" : p.n.op;
        return (
          <g key={i}>
            <circle cx={X(p.x)} cy={Y(p.y)} r={16} fill={leaf ? "#ffffff" : `${C.active}1f`} stroke={leaf ? C.base : C.active} strokeWidth={1.6} />
            <text x={X(p.x)} y={Y(p.y) + 4} fontSize={12} textAnchor="middle" fontWeight={600} fill={leaf ? C.text : C.active}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Pratt() {
  const [src, setSrc] = useState(PRESETS[0]);
  const toks = useMemo(() => tokenize(src.slice(0, 60)), [src]);
  const frames = useMemo<Frame[]>(
    () => (typeof toks === "string" ? [{ pos: 0, calls: [], msg: `"${toks}" isn't a token: use numbers, names, + - * / ^ and parentheses.`, tone: "bad", tree: null }] : parse(toks)),
    [toks],
  );
  const s = useStepper(frames, 800);
  const f = s.frame;
  const list = typeof toks === "string" ? [] : toks;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={src} onChange={setSrc} width="w-56" placeholder="e.g. 1 + 2 * 3" />
        {PRESETS.map((p) => (
          <SmallBtn key={p} onClick={() => setSrc(p)}>
            {p}
          </SmallBtn>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 font-mono text-sm">
        {list.map((t, i) => (
          <span
            key={i}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2"
            style={{ borderColor: i === f.pos ? C.active : C.dim, background: i === f.pos ? `${C.active}18` : i < f.pos ? "#f1f5f9" : "#ffffff", color: i < f.pos ? C.faint : C.text }}
          >
            {t}
          </span>
        ))}
        <span className="text-[10px] text-faint" style={{ color: f.pos >= list.length ? C.active : undefined }}>
          end
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="text-[10px] tracking-wider text-faint uppercase">call stack (innermost at the bottom)</div>
          <div className="min-h-16 space-y-1 rounded-xl border border-line bg-panel p-2 font-mono text-xs">
            {f.calls.length === 0 && <div className="text-faint">(no calls running)</div>}
            {f.calls.map((c, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1"
                style={{ marginLeft: i * 14, background: i === f.calls.length - 1 ? `${C.active}14` : "#f8fafc", border: `1px solid ${i === f.calls.length - 1 ? `${C.active}55` : C.dim}` }}
              >
                <span style={{ color: C.active }}>parse_expr({c.min})</span>
                <span className="text-faint">left =</span>
                <span style={{ color: C.text }}>{sexpr(c.left)}</span>
              </div>
            ))}
          </div>
        </div>
        <table className="h-fit border-collapse text-center font-mono text-[11px]">
          <thead>
            <tr className="text-faint">
              <th className="border border-line px-2 py-1">op</th>
              <th className="border border-line px-2 py-1">left</th>
              <th className="border border-line px-2 py-1">right</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(INFIX).map(([op, [l, r]]) => (
              <tr key={op} style={{ background: list[f.pos - 1] === op || list[f.pos] === op ? `${C.compare}14` : undefined }}>
                <td className="border border-line px-2 py-1 font-semibold">{op}</td>
                <td className="border border-line px-2 py-1">{l}</td>
                <td className="border border-line px-2 py-1">{r}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-line px-2 py-1 font-semibold">prefix −</td>
              <td className="border border-line px-2 py-1 text-faint">·</td>
              <td className="border border-line px-2 py-1">{PREFIX_MINUS}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      {f.tree && (
        <div className="rounded-xl border border-line bg-panel p-2">
          <Tree tree={f.tree} />
        </div>
      )}
    </div>
  );
}
