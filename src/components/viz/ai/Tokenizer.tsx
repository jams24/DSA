"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, TextInput } from "../kit";

const CORPUS = "low low low low lower lower newest newest newest widest widest low";
const COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706", "#ea580c", "#059669", "#0284c7", "#e11d48"];

function learn(corpus: string, merges: number) {
  const words = corpus.trim().split(/\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  let tokenized = [...counts.entries()].map(([w, c]) => ({ toks: [...w, "_"], count: c }));
  const learned: { pair: [string, string]; freq: number }[] = [];
  for (let m = 0; m < merges; m++) {
    const pairs = new Map<string, number>();
    for (const { toks, count } of tokenized)
      for (let i = 0; i < toks.length - 1; i++) {
        const k = `${toks[i]}\u0000${toks[i + 1]}`;
        pairs.set(k, (pairs.get(k) ?? 0) + count);
      }
    if (!pairs.size) break;
    const [best, freq] = [...pairs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (freq < 2) break;
    const [a, b] = best.split("\u0000") as [string, string];
    learned.push({ pair: [a, b], freq });
    tokenized = tokenized.map(({ toks, count }) => {
      const out: string[] = [];
      for (let i = 0; i < toks.length; i++) {
        if (i < toks.length - 1 && toks[i] === a && toks[i + 1] === b) {
          out.push(a + b);
          i++;
        } else out.push(toks[i]);
      }
      return { toks: out, count };
    });
  }
  return { learned, tokenized };
}

function encode(word: string, learned: { pair: [string, string] }[]) {
  let toks = [...word, "_"];
  for (const { pair } of learned) {
    const out: string[] = [];
    for (let i = 0; i < toks.length; i++) {
      if (i < toks.length - 1 && toks[i] === pair[0] && toks[i + 1] === pair[1]) {
        out.push(pair[0] + pair[1]);
        i++;
      } else out.push(toks[i]);
    }
    toks = out;
  }
  return toks;
}

export default function Tokenizer() {
  const [corpus, setCorpus] = useState(CORPUS);
  const [merges, setMerges] = useState(6);
  const [probe, setProbe] = useState("lowest slower");
  const { learned, tokenized } = useMemo(() => learn(corpus.toLowerCase().replace(/[^a-z\s]/g, ""), merges), [corpus, merges]);
  const probeToks = probe
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => encode(w, learned));
  const colorOf = (t: string) => COLORS[[...t].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % COLORS.length];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-dim">
          training corpus
          <TextInput value={corpus} onChange={setCorpus} width="w-[420px] max-w-full" />
        </label>
        <div className="w-52">
          <Slider label="merges learned" value={merges} min={0} max={12} onChange={setMerges} />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Merge rules (in order)</div>
          <ol className="space-y-1 font-mono text-xs">
            {learned.map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-faint">{i + 1}.</span>
                <span className="text-dim">
                  {m.pair[0]} + {m.pair[1]}
                </span>
                <span className="text-faint">→</span>
                <span style={{ color: colorOf(m.pair[0] + m.pair[1]) }}>{m.pair[0] + m.pair[1]}</span>
                <span className="ml-auto text-[10px] text-faint">×{m.freq}</span>
              </li>
            ))}
            {!learned.length && <li className="text-faint">none yet — every token is a single character</li>}
          </ol>
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-[#f8fafd] p-3">
          <div className="text-[10px] uppercase tracking-wider text-faint">Training words after merging (_ marks end of word)</div>
          <div className="flex flex-wrap gap-3">
            {tokenized.map(({ toks, count }, i) => (
              <div key={i} className="flex items-center gap-0.5">
                {toks.map((t, j) => (
                  <span key={j} className="rounded px-1 py-0.5 font-mono text-xs" style={{ background: `${colorOf(t)}26`, color: colorOf(t), border: `1px solid ${colorOf(t)}55` }}>
                    {t}
                  </span>
                ))}
                <span className="ml-1 text-[10px] text-faint">×{count}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-faint">
              Tokenize new text <TextInput value={probe} onChange={setProbe} width="w-48" />
            </div>
            <div className="flex flex-wrap gap-3">
              {probeToks.map((toks, i) => (
                <div key={i} className="flex gap-0.5">
                  {toks.map((t, j) => (
                    <span key={j} className="rounded px-1 py-0.5 font-mono text-xs" style={{ background: `${colorOf(t)}26`, color: colorOf(t), border: `1px solid ${colorOf(t)}55` }}>
                      {t}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-dim">
              {probeToks.flat().length} tokens for {probe.replace(/\s/g, "").length} characters
            </div>
          </div>
        </div>
      </div>
      <Narration>
        Byte-Pair Encoding starts from characters and repeatedly merges the most frequent adjacent pair. Frequent words become single tokens, rare words split into reusable pieces (unseen “slower” still tokenizes). Real tokenizers learn ~32K–200K merges over bytes, so any string is representable.
        Token counts drive cost, context limits and latency.
      </Narration>
      <div className="text-xs text-faint" style={{ color: C.faint }}>
        Rule of thumb: ~4 characters ≈ 1 token for English text; code, numbers and non-English text usually need more tokens per word.
      </div>
    </div>
  );
}
