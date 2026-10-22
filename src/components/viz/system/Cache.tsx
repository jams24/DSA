"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Slider, StepControls, useStepper } from "../kit";

type Policy = "lru" | "lfu" | "fifo";

interface Frame {
  key: string | null;
  cache: { k: string; freq: number }[]; // ordered: most recent / first-in at index 0
  hit: boolean | null;
  evicted: string | null;
  hits: number;
  misses: number;
  msg: string;
}

const SEQS: Record<string, { label: string; seq: string[] }> = {
  zipf: { label: "Hot keys (Zipf-like)", seq: "A B A C A B D A E A B F A B C A G A B A".split(" ") },
  scan: { label: "Looping scan", seq: "A B C D E A B C D E A B C D E".split(" ") },
  shift: { label: "Popularity shift", seq: "A A A A B B B B C D C D C D E C D E C D".split(" ") },
};

function simulate(policy: Policy, seq: string[], cap: number): Frame[] {
  let cache: { k: string; freq: number; t: number }[] = [];
  let hits = 0;
  let misses = 0;
  const fr: Frame[] = [{ key: null, cache: [], hit: null, evicted: null, hits, misses, msg: `${policy.toUpperCase()} cache with capacity ${cap}. Each access is a read: hit = served from cache, miss = go to the database and insert.` }];
  seq.forEach((k, step) => {
    const found = cache.find((c) => c.k === k);
    let evicted: string | null = null;
    if (found) {
      hits++;
      found.freq++;
      if (policy === "lru") cache = [found, ...cache.filter((c) => c !== found)];
    } else {
      misses++;
      if (cache.length >= cap) {
        let victim: (typeof cache)[number];
        if (policy === "lfu") victim = [...cache].sort((a, b) => a.freq - b.freq || a.t - b.t)[0];
        else victim = cache[cache.length - 1];
        evicted = victim.k;
        cache = cache.filter((c) => c !== victim);
      }
      cache = [{ k, freq: 1, t: step }, ...cache];
    }
    const why = evicted ? ` Evict ${evicted} (${policy === "lru" ? "least recently used" : policy === "lfu" ? "least frequently used" : "oldest inserted"}).` : "";
    fr.push({
      key: k,
      cache: cache.map((c) => ({ k: c.k, freq: c.freq })),
      hit: !!found,
      evicted,
      hits,
      misses,
      msg: found ? `get(${k}) → HIT.${policy === "lru" ? " Move it to the front (most recent)." : policy === "lfu" ? ` Frequency → ${found.freq}.` : " FIFO doesn't reorder on hits."}` : `get(${k}) → MISS. Fetch from DB and insert.${why}`,
    });
  });
  return fr;
}

export default function Cache() {
  const [policy, setPolicy] = useState<Policy>("lru");
  const [seqId, setSeqId] = useState("zipf");
  const [cap, setCap] = useState(3);
  const seq = SEQS[seqId].seq;
  const frames = useMemo(() => simulate(policy, seq, cap), [policy, seq, cap]);
  const summary = useMemo(
    () =>
      (["lru", "lfu", "fifo"] as Policy[]).map((p) => {
        const last = simulate(p, seq, cap).at(-1)!;
        return { p, hits: last.hits, misses: last.misses };
      }),
    [seq, cap],
  );
  const s = useStepper(frames, 650);
  const f = s.frame;
  const total = f.hits + f.misses;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={policy}
          onChange={setPolicy}
          options={[
            { value: "lru", label: "LRU" },
            { value: "lfu", label: "LFU" },
            { value: "fifo", label: "FIFO" },
          ]}
        />
        <Segmented value={seqId} onChange={setSeqId} options={Object.entries(SEQS).map(([value, v]) => ({ value, label: v.label }))} />
        <div className="w-40">
          <Slider label="capacity" value={cap} min={2} max={5} onChange={setCap} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="mb-3 flex flex-wrap gap-1">
          {seq.map((k, i) => (
            <span
              key={i}
              className={clsx("grid h-7 w-7 place-items-center rounded-md border font-mono text-xs", i === s.i - 1 ? "font-bold" : "")}
              style={{
                borderColor: i === s.i - 1 ? (f.hit ? C.done : C.bad) : i < s.i - 1 ? C.dim : C.base,
                color: i < s.i - 1 ? C.faint : C.text,
                background: i === s.i - 1 ? `${f.hit ? C.done : C.bad}26` : "transparent",
              }}
            >
              {k}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 shrink-0 text-right text-[10px] uppercase tracking-wider text-faint">{policy === "fifo" ? "newest →" : policy === "lru" ? "MRU →" : "cache"}</span>
          <div className="flex gap-2">
            {Array.from({ length: cap }, (_, i) => {
              const c = f.cache[i];
              const isKey = c && c.k === f.key;
              return (
                <div
                  key={i}
                  className="grid h-16 w-16 place-items-center rounded-xl border-2 font-mono text-xl font-bold transition-all duration-300"
                  style={{
                    borderColor: isKey ? (f.hit ? C.done : C.active) : c ? C.base : C.dim,
                    borderStyle: c ? "solid" : "dashed",
                    background: isKey ? `${f.hit ? C.done : C.active}22` : c ? C.baseFill : "transparent",
                    color: C.text,
                  }}
                >
                  {c?.k ?? ""}
                  {c && policy === "lfu" && <span className="-mt-3 text-[9px] font-normal text-amber">×{c.freq}</span>}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-faint">{policy === "fifo" ? "← evicted first" : policy === "lru" ? "← LRU (evicted)" : ""}</span>
          {f.evicted && <span className="ml-2 rounded-md border border-rose/40 bg-rose/10 px-2 py-1 font-mono text-xs text-rose">evicted {f.evicted}</span>}
        </div>
      </div>
      <Narration tone={f.hit === null ? "info" : f.hit ? "good" : "bad"}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        {summary.map((x) => {
          const tot = x.hits + x.misses;
          const pct = tot ? Math.round((x.hits / tot) * 100) : 0;
          return (
            <div key={x.p} className={clsx("rounded-xl border px-3 py-2", x.p === policy ? "border-cyan/50 bg-cyan/[0.06]" : "border-line bg-panel")}>
              <div className="text-[10px] uppercase tracking-wider text-faint">{x.p} final hit ratio</div>
              <div className="font-mono text-lg font-semibold text-ink">{pct}%</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-emerald" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-faint">
        Current run: {f.hits} hits / {total} reads. Try the looping scan with capacity 3 — LRU and FIFO miss every single time (cache thrashing).
      </p>
    </div>
  );
}
