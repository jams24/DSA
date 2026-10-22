"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, SmallBtn } from "../kit";

const CANDIDATES: [string, number][] = [
  [" Paris", 9.1],
  [" a", 6.4],
  [" the", 6.0],
  [" located", 5.4],
  [" known", 5.0],
  [" Lyon", 3.9],
  [" beautiful", 3.6],
  [" home", 3.2],
  [" famous", 3.0],
  [" not", 2.4],
  [" Berlin", 1.8],
  [" pizza", 0.4],
];

export default function Sampling() {
  const [temp, setTemp] = useState(1);
  const [topK, setTopK] = useState(12);
  const [topP, setTopP] = useState(1);
  const [samples, setSamples] = useState<string[]>([]);

  const dist = useMemo(() => {
    const T = Math.max(0.05, temp);
    const scaled = CANDIDATES.map(([t, l]) => ({ t, l: l / T }));
    const max = Math.max(...scaled.map((x) => x.l));
    const ex = scaled.map((x) => ({ t: x.t, p: Math.exp(x.l - max) }));
    const sum = ex.reduce((a, b) => a + b.p, 0);
    const probs = ex.map((x) => ({ ...x, p: x.p / sum })).sort((a, b) => b.p - a.p);
    // keep tokens until cumulative mass reaches p (always at least the top one)
    const before = probs.map((_, i) => probs.slice(0, i).reduce((a, b) => a + b.p, 0));
    const kept = probs.map((x, i) => ({ ...x, keep: i < topK && before[i] < topP }));
    const keptSum = kept.filter((x) => x.keep).reduce((a, b) => a + b.p, 0);
    return kept.map((x) => ({ ...x, final: x.keep ? x.p / keptSum : 0 }));
  }, [temp, topK, topP]);

  function sample(n: number) {
    const out: string[] = [];
    for (let k = 0; k < n; k++) {
      let r = Math.random();
      for (const x of dist) {
        r -= x.final;
        if (r <= 0) {
          out.push(x.t);
          break;
        }
      }
    }
    setSamples((s) => [...out, ...s].slice(0, 60));
  }

  const counts = new Map<string, number>();
  for (const s of samples) counts.set(s, (counts.get(s) ?? 0) + 1);
  const entropy = -dist.reduce((a, x) => a + (x.final > 0 ? x.final * Math.log2(x.final) : 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-panel px-4 py-3 font-mono text-sm text-ink">
        “The capital of France is<span className="animate-blink text-cyan">▌</span>”
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Slider label="temperature" value={temp} min={0.1} max={2} step={0.05} onChange={setTemp} format={(v) => v.toFixed(2)} />
        </div>
        <div className="w-40">
          <Slider label="top-k" value={topK} min={1} max={12} onChange={setTopK} />
        </div>
        <div className="w-44">
          <Slider label="top-p (nucleus)" value={topP} min={0.1} max={1} step={0.05} onChange={setTopP} format={(v) => v.toFixed(2)} />
        </div>
        <SmallBtn tone="primary" onClick={() => sample(1)}>
          🎲 sample 1
        </SmallBtn>
        <SmallBtn onClick={() => sample(20)}>sample ×20</SmallBtn>
        <SmallBtn onClick={() => setSamples([])}>clear</SmallBtn>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-1.5 rounded-xl border border-line bg-[#f8fafd] p-3">
          {dist.map((x) => (
            <div key={x.t} className="flex items-center gap-2 text-xs" style={{ opacity: x.keep ? 1 : 0.35 }}>
              <span className="w-20 text-right font-mono text-ink">{x.t.trim()}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-line">
                <div className="absolute h-full rounded bg-violet/40" style={{ width: `${x.p * 100}%` }} />
                <div className="absolute h-full rounded bg-gradient-to-r from-cyan to-sky transition-all duration-300" style={{ width: `${x.final * 100}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-dim">{(x.final * 100).toFixed(1)}%</span>
              <span className="w-8 text-right font-mono text-faint">{counts.get(x.t) ?? ""}</span>
            </div>
          ))}
          <div className="pt-1 text-[10px] text-faint">violet = after temperature · cyan = after top-k/top-p renormalization · right column = times sampled</div>
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-panel p-3 text-xs text-dim">
          <div>
            <b className="text-ink">Entropy</b> of the final distribution: <span className="font-mono text-cyan">{entropy.toFixed(2)} bits</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {samples.slice(0, 30).map((s, i) => (
              <span key={i} className="rounded border border-line-2 px-1 font-mono text-[10px]" style={{ color: s === " Paris" ? C.done : C.compare }}>
                {s.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Narration>
        The model outputs logits; softmax(logits / T) turns them into probabilities. Low temperature sharpens toward greedy (always “Paris”) — good for factual answers and code. High temperature flattens the distribution — more creative and more wrong. Top-k keeps the k most likely tokens; top-p keeps the smallest set whose probability mass reaches p, adapting to how confident the model is.
      </Narration>
    </div>
  );
}
