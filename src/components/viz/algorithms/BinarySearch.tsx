"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

type Mode = "exact" | "lower" | "answer";

interface Frame {
  lo: number;
  hi: number;
  mid: number | null;
  found?: number;
  msg: string;
  tone?: "info" | "good" | "bad";
  check?: { mid: number; days: number; ok: boolean };
}

function sortedRandom(n: number) {
  const s = new Set<number>();
  while (s.size < n) s.add(1 + Math.floor(Math.random() * 99));
  return [...s].sort((a, b) => a - b);
}

const PILES = [30, 11, 23, 4, 20];
const HOURS = 6;
const hoursAt = (k: number) => PILES.reduce((h, p) => h + Math.ceil(p / k), 0);

export default function BinarySearch() {
  const [mode, setMode] = useState<Mode>("exact");
  const [arr, setArr] = useState(() => sortedRandom(16));
  const [target, setTarget] = useState("42");

  const frames = useMemo<Frame[]>(() => {
    const fr: Frame[] = [];
    if (mode === "answer") {
      let lo = 1;
      let hi = Math.max(...PILES);
      fr.push({ lo, hi, mid: null, msg: `Koko eats bananas: piles [${PILES.join(", ")}], ${HOURS} hours. Find the minimum speed k. Answers range over [1, ${hi}] and feasibility is monotonic: if k works, k+1 works too.` });
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const h = hoursAt(mid);
        const ok = h <= HOURS;
        fr.push({ lo, hi, mid, check: { mid, days: h, ok }, msg: `Try k = ${mid}: needs ${h} hours → ${ok ? `feasible, so the answer is ≤ ${mid} (hi = mid)` : `too slow, answer > ${mid} (lo = mid + 1)`}.`, tone: ok ? "good" : "bad" });
        if (ok) hi = mid;
        else lo = mid + 1;
      }
      fr.push({ lo, hi, mid: lo, found: lo, msg: `lo == hi == ${lo}: the minimum feasible speed. log₂(${Math.max(...PILES)}) ≈ ${Math.ceil(Math.log2(Math.max(...PILES)))} checks instead of trying every speed.`, tone: "good" });
      return fr;
    }
    const t = Number(target);
    if (mode === "exact") {
      let lo = 0;
      let hi = arr.length - 1;
      fr.push({ lo, hi, mid: null, msg: `Search for ${t} in a sorted array. lo = 0, hi = ${hi}.` });
      while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        if (arr[mid] === t) {
          fr.push({ lo, hi, mid, found: mid, msg: `arr[${mid}] = ${t}. Found!`, tone: "good" });
          return fr;
        }
        const less = arr[mid] < t;
        fr.push({ lo, hi, mid, msg: `mid = ${lo} + (${hi} − ${lo}) / 2 = ${mid}. arr[mid] = ${arr[mid]} ${less ? "<" : ">"} ${t} → discard the ${less ? "left" : "right"} half.` });
        if (less) lo = mid + 1;
        else hi = mid - 1;
      }
      fr.push({ lo, hi, mid: null, msg: `lo (${lo}) > hi (${hi}): not found. ${t} would be inserted at index ${lo}.`, tone: "bad" });
      return fr;
    }
    // lower bound: first index with arr[i] >= t
    let lo = 0;
    let hi = arr.length;
    fr.push({ lo, hi: hi - 1, mid: null, msg: `Lower bound: first index with value ≥ ${t}. Half-open range [lo, hi) = [0, ${hi}).` });
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const ge = arr[mid] >= t;
      fr.push({ lo, hi: hi - 1, mid, msg: `arr[${mid}] = ${arr[mid]} ${ge ? "≥" : "<"} ${t} → ${ge ? "mid could be the answer, keep it: hi = mid" : "answer is right of mid: lo = mid + 1"}.` });
      if (ge) hi = mid;
      else lo = mid + 1;
    }
    fr.push({ lo, hi: hi - 1, mid: null, found: lo < arr.length ? lo : undefined, msg: lo < arr.length ? `lo == hi == ${lo}: first value ≥ ${t} is ${arr[lo]}. (Python: bisect_left, C++: lower_bound)` : `Every value is < ${t}: lower bound is the end (${lo}).`, tone: "good" });
    return fr;
  }, [mode, arr, target]);

  const s = useStepper(frames, 1000);
  const f = s.frame;
  const max = Math.max(...PILES);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "exact", label: "Find exact" },
            { value: "lower", label: "Lower bound" },
            { value: "answer", label: "Search the answer space" },
          ]}
        />
        {mode !== "answer" && (
          <>
            <span className="text-xs text-dim">target</span>
            <TextInput value={target} onChange={setTarget} width="w-16" />
            <SmallBtn onClick={() => setArr(sortedRandom(16))}>new array</SmallBtn>
          </>
        )}
      </div>

      {mode !== "answer" ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-4 scrollbar-thin">
          <div className="flex gap-1.5">
            {arr.map((v, i) => {
              const out = i < f.lo || i > f.hi;
              const isMid = i === f.mid;
              const isFound = i === f.found;
              const color = isFound ? C.done : isMid ? C.active : out ? C.dim : C.base;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-4 font-mono text-[10px] font-bold">
                    {i === f.lo && <span style={{ color: C.compare }}>lo</span>}
                  </div>
                  <div
                    className="grid h-12 w-11 place-items-center rounded-lg border-2 font-mono text-sm font-semibold transition-all duration-300"
                    style={{ borderColor: color, color: out ? C.faint : isMid || isFound ? color : C.text, background: isMid || isFound ? `${color}22` : out ? "transparent" : C.baseFill, opacity: out ? 0.4 : 1 }}
                  >
                    {v}
                  </div>
                  <span className="font-mono text-[10px] text-faint">{i}</span>
                  <div className="h-4 font-mono text-[10px] font-bold">
                    {isMid && <span style={{ color: C.active }}>mid</span>}
                    {i === f.hi && !isMid && <span style={{ color: C.swap }}>hi</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-line bg-[#080c19] p-4">
          <div className="flex items-end gap-2">
            {PILES.map((p, i) => (
              <div key={i} className="flex flex-1 flex-col items-center">
                <div className="w-full rounded-t-md bg-gradient-to-t from-amber/70 to-amber" style={{ height: (p / max) * 90 }} />
                <span className="mt-1 font-mono text-[10px] text-faint">{p} 🍌</span>
              </div>
            ))}
          </div>
          <div className="relative h-10">
            <div className="absolute top-4 right-0 left-0 h-2 rounded-full bg-line" />
            <div
              className="absolute top-4 h-2 rounded-full bg-cyan/40 transition-all duration-500"
              style={{ left: `${((f.lo - 1) / (max - 1)) * 100}%`, width: `${((f.hi - f.lo) / (max - 1)) * 100}%` }}
            />
            {f.mid !== null && (
              <div className="absolute top-0 -translate-x-1/2 transition-all duration-500" style={{ left: `${((f.mid - 1) / (max - 1)) * 100}%` }}>
                <div className="rounded bg-cyan px-1.5 font-mono text-[10px] font-bold text-[#03131a]">k={f.mid}</div>
              </div>
            )}
          </div>
          <div className="flex justify-between font-mono text-[10px] text-faint">
            <span>speed 1</span>
            <span>speed {max}</span>
          </div>
        </div>
      )}
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="search space" value={Math.max(0, f.hi - f.lo + 1)} color={C.active} />
        <Stat label="steps so far" value={s.i} color={C.compare} />
        <Stat label="max steps ⌈log₂ n⌉+1" value={Math.ceil(Math.log2((mode === "answer" ? max : arr.length) + 1))} color={C.pivot} />
      </div>
    </div>
  );
}
