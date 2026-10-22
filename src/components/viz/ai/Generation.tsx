"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

const PROMPT = ["Explain", "KV", "caching", "in", "one", "sentence", ":"];
const OUTPUT = ["Store", "past", "keys", "and", "values", "so", "each", "new", "token", "is", "cheap", "."];

interface Frame {
  step: number; // 0 = prefill
  computed: number[]; // token indices whose K/V were computed this step
  cached: number; // number of tokens with cached K/V before this step
  total: number; // tokens visible after this step
  work: number; // attention pair computations this step
  cumWork: number;
  msg: string;
}

function build(cache: boolean): Frame[] {
  const fr: Frame[] = [];
  const P = PROMPT.length;
  let cum = 0;
  // prefill: all prompt tokens at once, attention P*(P+1)/2 pairs (causal)
  const prefillWork = (P * (P + 1)) / 2;
  cum += prefillWork;
  fr.push({ step: 0, computed: PROMPT.map((_, i) => i), cached: 0, total: P + 1, work: prefillWork, cumWork: cum, msg: `PREFILL: all ${P} prompt tokens go through the model in ONE parallel forward pass (matrix-matrix, compute-bound). It produces the first output token “${OUTPUT[0]}”. Time to first token (TTFT) ends here.` });
  for (let g = 1; g < OUTPUT.length; g++) {
    const seq = P + g - 1; // index of the token processed this step (the previous output)
    if (cache) {
      const work = seq + 1; // its query attends to `seq` cached keys + itself
      cum += work;
      fr.push({ step: g, computed: [seq], cached: seq, total: seq + 2, work, cumWork: cum, msg: `DECODE step ${g}: only the newest token “${OUTPUT[g - 1]}” is processed. Its K/V are appended to the cache and its query attends to ${seq} cached keys + itself. Output “${OUTPUT[g]}”. Memory-bound: every step still streams all the weights.` });
    } else {
      const work = ((seq + 1) * (seq + 2)) / 2;
      cum += work;
      fr.push({ step: g, computed: Array.from({ length: seq + 1 }, (_, i) => i), cached: 0, total: seq + 2, work, cumWork: cum, msg: `No cache: step ${g} recomputes K/V for ALL ${seq + 1} tokens and the full causal attention again — work per step grows quadratically.` });
    }
  }
  fr.push({ ...fr[fr.length - 1], computed: [], msg: cache ? "Done. Total work grew linearly per step. The price: KV-cache memory that grows with every token of every concurrent sequence." : "Done — and wasteful. Every production inference engine uses a KV cache." });
  return fr;
}

export default function Generation() {
  const [cache, setCache] = useState(true);
  const frames = useMemo(() => build(cache), [cache]);
  const other = useMemo(() => build(!cache), [cache]);
  const s = useStepper(frames, 900);
  const f = s.frame;
  const tokens = [...PROMPT, ...OUTPUT];
  const computed = new Set(f.computed);
  const maxWork = Math.max(...frames.map((x) => x.work), ...other.map((x) => x.work));

  return (
    <div className="space-y-4">
      <Segmented
        value={cache ? "on" : "off"}
        onChange={(v) => setCache(v === "on")}
        options={[
          { value: "on", label: "With KV cache" },
          { value: "off", label: "Without KV cache" },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-4 scrollbar-thin">
        <div className="flex gap-1">
          {tokens.map((t, i) => {
            const visible = i < f.total;
            const isPrompt = i < PROMPT.length;
            const isComputed = computed.has(i);
            const isNew = i === f.total - 1 && !isPrompt;
            return (
              <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1" style={{ opacity: visible ? 1 : 0.15 }}>
                <div
                  className="w-full truncate rounded-md border px-1 py-1 text-center font-mono text-[10px]"
                  style={{ borderColor: isNew ? C.done : isPrompt ? C.sky : C.pivot, color: isNew ? C.done : C.text, background: isNew ? `${C.done}22` : "#ffffff" }}
                >
                  {t}
                </div>
                <div className="flex gap-0.5">
                  {["K", "V"].map((kv) => {
                    const hasKV = visible && i < f.total - 1;
                    return (
                      <div
                        key={kv}
                        className="grid h-6 w-6 place-items-center rounded font-mono text-[9px] font-bold transition-all duration-300"
                        style={{
                          background: !hasKV ? "transparent" : isComputed ? C.bad : cache ? `${C.active}55` : "#e2e8f0",
                          color: isComputed ? "#ffffff" : C.text,
                          border: `1px solid ${!hasKV ? "#e2e8f0" : isComputed ? C.bad : cache ? C.active : "#cbd5e1"}`,
                        }}
                      >
                        {hasKV ? kv : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-[10px] text-faint">
          <span>
            <span style={{ color: C.bad }}>■</span> computed this step
          </span>
          <span>
            <span style={{ color: C.active }}>■</span> read from KV cache
          </span>
          <span>
            <span style={{ color: C.sky }}>□</span> prompt
          </span>
          <span>
            <span style={{ color: C.pivot }}>□</span> generated
          </span>
        </div>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex h-24 items-end gap-1 rounded-xl border border-line bg-panel p-2">
          {frames.slice(0, -1).map((x, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end" title={`step ${i}: ${x.work}`}>
              <div className="rounded-t" style={{ height: `${(x.work / maxWork) * 100}%`, background: i === Math.min(s.i, frames.length - 2) ? C.compare : i === 0 ? C.sky : C.pivot, opacity: i <= s.i ? 1 : 0.3 }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-64 sm:grid-cols-1">
          <Stat label="attention work so far" value={f.cumWork} color={C.compare} />
          <Stat label={`total ${cache ? "without" : "with"} cache`} value={other[other.length - 1].cumWork} color={cache ? C.bad : C.done} />
        </div>
      </div>
    </div>
  );
}
