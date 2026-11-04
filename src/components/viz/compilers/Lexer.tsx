"use client";

import { useMemo, useState } from "react";
import { C, Legend, Narration, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

// A hand-written lexer, one token per step: maximal munch, the keyword table, skipped
// whitespace and comments, and lexical errors.
type Kind = "keyword" | "name" | "number" | "string" | "op" | "punct" | "comment" | "error" | "eof";

const KEYWORDS = new Set(["let", "if", "else", "while", "fn", "return", "print", "true", "false", "nil"]);
const OPS2 = ["<=", ">=", "==", "!=", "&&", "||", "->"];
const OPS1 = "+-*/%<>=!";
const PUNCT = "(){}[];,.";
const COLOR: Record<Kind, string> = {
  keyword: C.pivot,
  name: C.sky,
  number: C.orange,
  string: C.done,
  op: C.swap,
  punct: C.muted,
  comment: C.faint,
  error: C.bad,
  eof: C.faint,
};
const PRESETS = [
  { label: "A statement", src: "let total = count >= 10 + rate * 2; // sum" },
  { label: "Maximal munch", src: "a<=b<c==d!=e=f" },
  { label: "Keywords vs names", src: "if iffy while whilst return returned" },
  { label: "Strings", src: 'print "hi there", "tab\\tbed", 42;' },
  { label: "Errors", src: 'let x = 12abc @ "open' },
];

interface Tok {
  kind: Kind;
  text: string;
  start: number;
  end: number;
  note: string;
  skipped: number;
}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const word = (j: number) => j < src.length && /[A-Za-z0-9_]/.test(src[j]);
  for (;;) {
    const ws = i;
    while (i < src.length && /\s/.test(src[i])) i++;
    const skipped = i - ws;
    if (i >= src.length) {
      out.push({ kind: "eof", text: "", start: i, end: i, skipped, note: "End of input: the lexer hands the parser one last EOF token, so it knows the program is over." });
      return out;
    }
    const start = i;
    const c = src[i];
    let kind: Kind;
    let note: string;
    if (src.startsWith("//", i)) {
      while (i < src.length && src[i] !== "\n") i++;
      kind = "comment";
      note = "\"//\" starts a comment: skip to the end of the line. No token comes out, so the parser never sees comments.";
    } else if (/[A-Za-z_]/.test(c)) {
      while (word(i)) i++;
      const w = src.slice(start, i);
      kind = KEYWORDS.has(w) ? "keyword" : "name";
      note =
        kind === "keyword"
          ? `Read letters and digits for as long as possible: "${w}". It's in the keyword table, so it's the keyword ${w}.`
          : `Read letters and digits for as long as possible: "${w}". It's not in the keyword table, so it's a name.${[...KEYWORDS].some((kw) => w.startsWith(kw)) ?" (Maximal munch: it starts with a keyword, but the longest match wins.)" : ""}`;
    } else if (/[0-9]/.test(c)) {
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      if (word(i)) {
        while (word(i)) i++;
        kind = "error";
        note = `"${src.slice(start, i)}": a number glued to letters isn't a valid token. Lexical error at column ${start + 1}.`;
      } else {
        kind = "number";
        note = `Read digits for as long as they last: the number ${src.slice(start, i)}.`;
      }
    } else if (c === '"') {
      i++;
      while (i < src.length && src[i] !== '"' && src[i] !== "\n") i += src[i] === "\\" ? 2 : 1;
      if (i < src.length && src[i] === '"') {
        i++;
        kind = "string";
        note = `A string: read up to the closing quote${src.slice(start, i).includes("\\") ? ", treating a backslash and the character after it as one escape" : ""}.`;
      } else {
        i = Math.min(i, src.length);
        kind = "error";
        note = `Unterminated string: the input ended before the closing quote. The error points at the opening quote, column ${start + 1}, where the problem began.`;
      }
    } else if (OPS2.includes(src.slice(i, i + 2))) {
      i += 2;
      kind = "op";
      note = `Maximal munch: check the two-character operators first. "${src.slice(start, i)}" matches, so it wins over a lone "${c}".`;
    } else if (OPS1.includes(c)) {
      i++;
      kind = "op";
      note = `"${c}": an operator.${"<>=!".includes(c) ? ` The next character doesn't make a longer operator, so "${c}" stands alone.` : ""}`;
    } else if (PUNCT.includes(c)) {
      i++;
      kind = "punct";
      note = `"${c}": punctuation.`;
    } else {
      i++;
      kind = "error";
      note = `"${c}" can't start any token: lexical error at column ${start + 1}. Real lexers report it and skip the character, so they can keep looking for more errors.`;
    }
    out.push({ kind, text: src.slice(start, i), start, end: i, note, skipped });
  }
}

export default function Lexer() {
  const [src, setSrc] = useState(PRESETS[0].src);
  const toks = useMemo(() => lex(src.slice(0, 120)), [src]);
  const frames = useMemo(() => Array.from({ length: toks.length + 1 }, (_, i) => i), [toks]);
  const s = useStepper(frames, 800);
  const k = s.frame; // tokens finished
  const cur = k > 0 ? toks[k - 1] : null;
  const owner = useMemo(() => {
    const m: number[] = Array(src.length).fill(-1);
    toks.forEach((t, ti) => {
      for (let j = t.start; j < t.end; j++) m[j] = ti;
    });
    return m;
  }, [toks, src.length]);
  const done = toks.slice(0, k).filter((t) => t.kind !== "comment");
  const errors = done.filter((t) => t.kind === "error").length;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={src} onChange={setSrc} width="w-full sm:w-96" placeholder="type some code" />
        {PRESETS.map((p) => (
          <SmallBtn key={p.label} onClick={() => setSrc(p.src)}>
            {p.label}
          </SmallBtn>
        ))}
      </div>

      <div className="flex flex-wrap gap-y-1 rounded-xl border border-line bg-panel p-3 font-mono text-sm">
        {[...src.slice(0, 120)].map((ch, j) => {
          const ti = owner[j];
          const t = ti >= 0 ? toks[ti] : null;
          const isCur = cur !== null && ti === k - 1;
          const isDone = ti >= 0 && ti < k;
          const color = t && isDone ? COLOR[t.kind] : C.muted;
          return (
            <span
              key={j}
              className="inline-flex h-7 w-[1.15rem] items-center justify-center rounded-[3px]"
              style={{
                color: ch === " " ? C.dim : color,
                background: isCur ? `${color}22` : undefined,
                boxShadow: isCur ? `inset 0 -2px 0 ${color}` : undefined,
                fontWeight: isDone ? 600 : 400,
                textDecoration: t?.kind === "comment" && isDone ? "line-through" : undefined,
              }}
            >
              {ch === " " ? "·" : ch}
            </span>
          );
        })}
        <span className="inline-flex h-7 items-center px-1 text-[10px] text-faint" style={{ color: cur?.kind === "eof" ? C.active : undefined }}>
          EOF
        </span>
      </div>

      <Narration tone={cur?.kind === "error" ? "bad" : s.atEnd ? "good" : "info"}>
        {cur === null
          ? "The lexer reads the source left to right and groups characters into tokens. Press play to watch it, one token per step."
          : `${cur.skipped > 0 ? `Skip ${cur.skipped} whitespace character${cur.skipped > 1 ? "s" : ""}. ` : ""}${cur.note}`}
      </Narration>
      <StepControls s={s} />

      <div className="flex flex-wrap gap-1.5">
        {done.map((t, i) => (
          <span key={i} className="rounded-lg border px-2 py-1 font-mono text-[11px]" style={{ borderColor: `${COLOR[t.kind]}66`, color: COLOR[t.kind] }}>
            {t.kind === "eof" ? "EOF" : `${t.kind} ${JSON.stringify(t.text)}`}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Stat label="tokens" value={done.filter((t) => t.kind !== "error").length} color={C.active} />
        <Stat label="errors" value={errors} color={errors ? C.bad : C.done} />
        <Legend
          items={(["keyword", "name", "number", "string", "op", "punct", "error"] as Kind[]).map((kd) => ({ color: COLOR[kd], label: kd }))}
        />
      </div>
    </div>
  );
}
