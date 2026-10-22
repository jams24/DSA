"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat, StepControls, TextInput, useStepper } from "../kit";

interface Frame {
  i: number;
  seen: Record<number, number>;
  count: number;
  hits: [number, number][];
  msg: string;
  tone?: "info" | "good";
}

export default function PrefixSum() {
  const [mode, setMode] = useState<"range" | "count">("range");
  const [raw, setRaw] = useState("3 4 -7 3 1 3 1 -4 -2 -2");
  const [k, setK] = useState("7");
  const nums = useMemo(() => raw.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite).slice(0, 14), [raw]);
  const prefix = useMemo(() => nums.reduce<number[]>((p, x) => [...p, p[p.length - 1] + x], [0]), [nums]);
  const [l, setL] = useState(2);
  const [r, setR] = useState(5);
  const L = Math.min(l, nums.length - 1);
  const Rr = Math.max(L, Math.min(r, nums.length - 1));

  const frames = useMemo<Frame[]>(() => {
    const K = Number(k) || 0;
    const seen: Record<number, number> = { 0: 1 };
    const hits: [number, number][] = [];
    const firstIdx: Record<number, number[]> = { 0: [0] };
    let count = 0;
    const fr: Frame[] = [{ i: 0, seen: { ...seen }, count, hits: [], msg: `Count subarrays summing to ${K}. A subarray (j, i] sums to k iff P[i] − P[j] = k, i.e. we need an earlier prefix equal to P[i] − k. Seed the map with {0: 1}.` }];
    for (let i = 1; i <= nums.length; i++) {
      const need = prefix[i] - K;
      const c = seen[need] ?? 0;
      if (c) for (const j of firstIdx[need] ?? []) hits.push([j, i - 1]);
      count += c;
      fr.push({ i, seen: { ...seen }, count, hits: [...hits], msg: `P[${i}] = ${prefix[i]}. Need an earlier prefix of ${prefix[i]} − ${K} = ${need}: seen ${c} time(s)${c ? ` → +${c} subarray(s)` : ""}.`, tone: c ? "good" : "info" });
      seen[prefix[i]] = (seen[prefix[i]] ?? 0) + 1;
      (firstIdx[prefix[i]] ??= []).push(i);
    }
    fr.push({ i: nums.length, seen: { ...seen }, count, hits: [...hits], msg: `Total: ${count} subarrays. One pass, O(n) time and space — works with negative numbers, unlike sliding window.`, tone: "good" });
    return fr;
  }, [nums, prefix, k]);

  const s = useStepper(frames, 900);
  const f = s.frame;
  const lastHit = f.hits[f.hits.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "range", label: "Range sum query" },
            { value: "count", label: "Subarray sum = k" },
          ]}
        />
        <TextInput value={raw} onChange={setRaw} width="w-56" />
        {mode === "count" && (
          <>
            <span className="text-xs text-dim">k</span>
            <TextInput value={k} onChange={setK} width="w-12" />
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-4 scrollbar-thin">
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-faint">nums</span>
            <span className="w-11 shrink-0" />
            {nums.map((v, i) => {
              const inRange = mode === "range" ? i >= L && i <= Rr : lastHit && i >= lastHit[0] && i <= lastHit[1] && f.tone === "good";
              const isCur = mode === "count" && i === f.i - 1;
              const color = inRange ? C.done : isCur ? C.active : C.base;
              return (
                <div key={i} className="grid h-10 w-11 shrink-0 place-items-center rounded-md border-2 font-mono text-sm" style={{ borderColor: color, background: color !== C.base ? `${color}22` : C.baseFill }}>
                  {v}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-faint">prefix P</span>
            {prefix.map((v, i) => {
              const hi = mode === "range" ? i === L || i === Rr + 1 : i === f.i;
              const color = mode === "range" ? (i === Rr + 1 ? C.compare : i === L ? C.swap : null) : hi ? C.active : i < f.i ? C.pivot : null;
              return (
                <div key={i} className="grid h-10 w-11 shrink-0 place-items-center rounded-md border-2 font-mono text-sm" style={{ borderColor: color ?? C.dim, color: color ?? C.muted, background: color ? `${color}1f` : "transparent" }}>
                  {v}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-faint">
            <span className="w-14 shrink-0 text-right">index</span>
            {prefix.map((_, i) => (
              <span key={i} className="w-11 shrink-0 text-center">
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>

      {mode === "range" ? (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Slider label="l" value={L} min={0} max={nums.length - 1} onChange={setL} />
            </div>
            <div className="w-48">
              <Slider label="r" value={Rr} min={L} max={nums.length - 1} onChange={setR} />
            </div>
          </div>
          <Narration tone="good">
            sum(nums[{L}..{Rr}]) = P[{Rr + 1}] − P[{L}] = {prefix[Rr + 1]} − {prefix[L]} = <b>{prefix[Rr + 1] - prefix[L]}</b>. Build P once in O(n); every query is then O(1).
          </Narration>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2">
            <span className="mr-1 text-[11px] text-faint">prefix counts:</span>
            {Object.entries(f.seen).map(([p, c]) => (
              <span key={p} className="rounded-md border border-violet/40 bg-violet/10 px-1.5 py-0.5 font-mono text-[11px] text-violet">
                {p}→{c}
              </span>
            ))}
          </div>
          <Narration tone={f.tone}>{f.msg}</Narration>
          <StepControls s={s} />
          <Stat label="subarrays found" value={f.count} color={C.done} />
        </>
      )}
    </div>
  );
}
