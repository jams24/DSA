"use client";

import { useState } from "react";
import { C, Narration, Slider, SmallBtn, Stat, TextInput } from "../kit";

const M = 32;

function hashes(word: string, k: number): number[] {
  // double hashing: h_i = h1 + i * h2
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (const ch of word) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    h2 = ((h2 << 5) + h2 + ch.charCodeAt(0)) >>> 0;
  }
  return Array.from({ length: k }, (_, i) => (h1 + i * (h2 | 1)) % M);
}

export default function Bloom() {
  const [k, setK] = useState(3);
  const [bits, setBits] = useState<number[]>(() => Array(M).fill(0));
  const [added, setAdded] = useState<string[]>([]);
  const [word, setWord] = useState("alice");
  const [probe, setProbe] = useState<{ word: string; idx: number[]; result: "maybe" | "no"; truth: boolean } | null>(null);
  const [hiAdd, setHiAdd] = useState<number[]>([]);

  function insert() {
    const w = word.trim().toLowerCase();
    if (!w || added.includes(w)) return;
    const idx = hashes(w, k);
    setBits((b) => b.map((x, i) => (idx.includes(i) ? 1 : x)));
    setAdded((a) => [...a, w]);
    setHiAdd(idx);
    setProbe(null);
  }
  function check() {
    const w = word.trim().toLowerCase();
    if (!w) return;
    const idx = hashes(w, k);
    setProbe({ word: w, idx, result: idx.every((i) => bits[i]) ? "maybe" : "no", truth: added.includes(w) });
    setHiAdd([]);
  }
  function reset(newK = k) {
    setK(newK);
    setBits(Array(M).fill(0));
    setAdded([]);
    setProbe(null);
    setHiAdd([]);
  }

  const n = added.length;
  const fp = Math.pow(1 - Math.exp((-k * n) / M), k);
  const fill = bits.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <TextInput value={word} onChange={setWord} width="w-32" onEnter={insert} />
        <SmallBtn tone="primary" onClick={insert}>
          add
        </SmallBtn>
        <SmallBtn tone="good" onClick={check}>
          might contain?
        </SmallBtn>
        <SmallBtn onClick={() => reset()}>clear</SmallBtn>
        <div className="ml-2 w-44">
          <Slider label="hash functions k" value={k} min={1} max={5} onChange={(v) => reset(v)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-4 scrollbar-thin">
        <div className="grid min-w-[560px] grid-cols-16 gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
          {bits.map((b, i) => {
            const probed = probe?.idx.includes(i);
            const color = hiAdd.includes(i) ? C.active : probed ? (b ? C.done : C.bad) : b ? C.pivot : C.dim;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className="grid h-10 w-full place-items-center rounded-md border-2 font-mono text-sm font-bold transition" style={{ borderColor: color, background: b ? `${color}33` : "transparent", color: b ? C.text : C.faint }}>
                  {b}
                </div>
                <span className="font-mono text-[9px] text-faint">{i}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {added.map((w) => (
            <span key={w} className="rounded-md border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[11px] text-violet">
              {w}
            </span>
          ))}
          {!added.length && <span className="text-xs text-faint">empty set — add a few words, then test words you didn&apos;t add</span>}
        </div>
      </div>
      <Narration tone={probe ? (probe.result === "no" ? "good" : probe.truth ? "good" : "bad") : "info"}>
        {probe
          ? probe.result === "no"
            ? `"${probe.word}": bit(s) ${probe.idx.filter((i) => !bits[i]).join(", ")} are 0 → DEFINITELY not in the set. No false negatives, ever.`
            : probe.truth
              ? `"${probe.word}": all ${k} bits set → probably in the set (and it is).`
              : `"${probe.word}": all ${k} bits set but it was never added → FALSE POSITIVE. Other words happened to set those bits.`
          : hiAdd.length
            ? `Added: set bits ${hiAdd.join(", ")}. The filter never stores the word itself.`
            : "A Bloom filter answers 'definitely not' or 'maybe' using a bit array and k hash functions — tiny memory, no false negatives."}
      </Narration>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="items n" value={n} />
        <Stat label="bits set" value={`${fill}/${M}`} color={C.pivot} />
        <Stat label="false-positive rate ≈ (1−e^(−kn/m))^k" value={`${(fp * 100).toFixed(1)}%`} color={fp > 0.1 ? C.bad : C.done} />
      </div>
    </div>
  );
}
