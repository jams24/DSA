"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented } from "../kit";

const TOKENS = ["The", "cat", "sat", "on", "the", "mat", "because", "it", "was", "tired"];
type Head = "coref" | "prev" | "first";

const BOOST: Record<string, number> = {
  "2-1": 2.2, // sat → cat
  "5-3": 1.4, // mat → on
  "5-4": 1.6, // mat → the
  "6-2": 1.5, // because → sat
  "7-1": 3.2, // it → cat
  "8-7": 2.2, // was → it
  "9-7": 2.0, // tired → it
  "9-1": 1.8, // tired → cat
};

function scores(head: Head, i: number, j: number) {
  if (head === "prev") return j === i - 1 ? 4 : j === i ? 1.5 : 0;
  if (head === "first") return j === 0 ? 3.2 : j === i ? 1 : 0;
  return (BOOST[`${i}-${j}`] ?? 0) + (j === i ? 1 : 0) - 0.15 * Math.abs(i - j);
}

export default function Attention() {
  const [head, setHead] = useState<Head>("coref");
  const [causal, setCausal] = useState(true);
  const [q, setQ] = useState(7);
  const [temp, setTemp] = useState(1);

  const weights = useMemo(
    () =>
      TOKENS.map((_, i) => {
        const raw = TOKENS.map((__, j) => (causal && j > i ? -Infinity : scores(head, i, j) / temp));
        const max = Math.max(...raw);
        const ex = raw.map((s) => (s === -Infinity ? 0 : Math.exp(s - max)));
        const sum = ex.reduce((a, b) => a + b, 0);
        return ex.map((e) => e / sum);
      }),
    [head, causal, temp],
  );

  const row = weights[q];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={head}
          onChange={setHead}
          options={[
            { value: "coref", label: "Head 1: who is 'it'?" },
            { value: "prev", label: "Head 2: previous token" },
            { value: "first", label: "Head 3: attention sink" },
          ]}
        />
        <Segmented
          value={causal ? "causal" : "full"}
          onChange={(v) => setCausal(v === "causal")}
          options={[
            { value: "causal", label: "Causal mask (decoder)" },
            { value: "full", label: "No mask (encoder)" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-dim">
          softmax temperature
          <input type="range" className="neon-range w-28" min={0.3} max={3} step={0.1} value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
          <span className="font-mono text-ink">{temp.toFixed(1)}</span>
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-3 scrollbar-thin">
          <table className="border-separate border-spacing-[2px] font-mono text-[10px]">
            <thead>
              <tr>
                <th className="pr-1 text-right font-normal text-faint">query ↓ key →</th>
                {TOKENS.map((t, j) => (
                  <th key={j} className="h-14 w-8 align-bottom font-normal text-dim">
                    <div className="origin-bottom-left translate-x-3 -rotate-45 whitespace-nowrap">{t}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weights.map((r, i) => (
                <tr key={i} onClick={() => setQ(i)} className="cursor-pointer">
                  <td className={clsx("pr-2 text-right", i === q ? "text-cyan" : "text-dim")}>{TOKENS[i]}</td>
                  {r.map((w, j) => (
                    <td
                      key={j}
                      className="h-7 w-8 rounded-[3px] text-center"
                      style={{
                        background: causal && j > i ? "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px)" : `rgba(8, 145, 178, ${Math.min(1, w * 1.4)})`,
                        outline: i === q ? `1px solid ${C.active}` : undefined,
                        color: w > 0.45 ? "#ffffff" : "#64748b",
                      }}
                      title={w.toFixed(3)}
                    >
                      {w >= 0.995 ? "1" : w > 0.08 ? w.toFixed(2).slice(1) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-xs text-dim">
              Query token: <b className="text-cyan">“{TOKENS[q]}”</b> — where does it look? (click a row)
            </div>
            <div className="space-y-1">
              {row.map((w, j) => (
                <div key={j} className="flex items-center gap-2 text-xs">
                  <span className="w-14 text-right font-mono text-dim">{TOKENS[j]}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-line">
                    <div className="h-full rounded bg-gradient-to-r from-cyan to-violet transition-all duration-300" style={{ width: `${w * 100}%` }} />
                  </div>
                  <span className="w-10 font-mono text-faint">{(w * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-panel p-3 font-mono text-xs leading-relaxed text-dim">
            Attention(Q, K, V) = softmax(Q·Kᵀ / √d<sub>k</sub> + mask) · V
            <div className="mt-1 text-[11px] text-faint">Each row is a probability distribution; the output for “{TOKENS[q]}” is the weighted average of the value vectors of the tokens it attends to.</div>
          </div>
        </div>
      </div>
      <Narration>
        {head === "coref" && "This head resolves references: “it” puts most of its weight on “cat”. Real models learn heads like this without being told."}
        {head === "prev" && "A 'previous token' head — simple, but combined with other heads it enables induction (copying patterns seen earlier)."}
        {head === "first" && "Many heads dump attention on the first token when nothing is relevant — an 'attention sink'. Long-context tricks (StreamingLLM) keep it in the cache for that reason."}{" "}
        {causal ? "The causal mask hides future tokens (hatched), which is what lets decoders generate left to right and cache past keys/values." : "Without a mask every token sees the whole sequence, as in BERT-style encoders."}
      </Narration>
    </div>
  );
}
