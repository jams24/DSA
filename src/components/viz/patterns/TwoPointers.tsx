"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, TextInput, randomInts, useStepper } from "../kit";

type Mode = "pair" | "water" | "dedupe";

interface Frame {
  l: number;
  r: number;
  best?: [number, number];
  bestVal?: number;
  write?: number;
  arr?: number[];
  msg: string;
  tone?: "info" | "good" | "bad";
}

export default function TwoPointers() {
  const [mode, setMode] = useState<Mode>("pair");
  const [arr, setArr] = useState(() => [...randomInts(12, 1, 30)].sort((a, b) => a - b));
  const [heights, setHeights] = useState(() => [1, 8, 6, 2, 5, 4, 8, 3, 7]);
  const [dups, setDups] = useState(() => [0, 0, 1, 1, 1, 2, 2, 3, 3, 4]);
  const [target, setTarget] = useState("30");

  const frames = useMemo<Frame[]>(() => {
    const fr: Frame[] = [];
    if (mode === "pair") {
      const t = Number(target);
      let l = 0;
      let r = arr.length - 1;
      fr.push({ l, r, msg: `Sorted array, target ${t}. Start with pointers at both ends.` });
      while (l < r) {
        const s = arr[l] + arr[r];
        if (s === t) {
          fr.push({ l, r, msg: `${arr[l]} + ${arr[r]} = ${t} ✓ Found the pair in O(n) time, O(1) space.`, tone: "good" });
          return fr;
        }
        const small = s < t;
        fr.push({ l, r, msg: `${arr[l]} + ${arr[r]} = ${s} ${small ? "<" : ">"} ${t} → ${small ? "need a bigger sum: move L right" : "need a smaller sum: move R left"}. Every pair skipped this way can't be the answer.`, tone: "info" });
        if (small) l++;
        else r--;
      }
      fr.push({ l, r, msg: `Pointers met — no pair sums to ${t}.`, tone: "bad" });
      return fr;
    }
    if (mode === "water") {
      let l = 0;
      let r = heights.length - 1;
      let best = 0;
      let bestPair: [number, number] = [l, r];
      fr.push({ l, r, best: bestPair, bestVal: 0, msg: "Container With Most Water: area = width × min(height[l], height[r]). Start as wide as possible." });
      while (l < r) {
        const area = (r - l) * Math.min(heights[l], heights[r]);
        if (area > best) {
          best = area;
          bestPair = [l, r];
        }
        const moveL = heights[l] < heights[r];
        fr.push({ l, r, best: bestPair, bestVal: best, msg: `Area = ${r - l} × min(${heights[l]}, ${heights[r]}) = ${area}${area === best ? " (new best)" : ""}. Move the SHORTER wall (${moveL ? "left" : "right"}) — keeping it can only shrink width without raising the limit.`, tone: area === best ? "good" : "info" });
        if (moveL) l++;
        else r--;
      }
      fr.push({ l, r, best: bestPair, bestVal: best, msg: `Done: max area ${best}. O(n) instead of checking all O(n²) pairs.`, tone: "good" });
      return fr;
    }
    const a = [...dups];
    let w = 1;
    fr.push({ l: 1, r: 1, write: 1, arr: [...a], msg: "Remove duplicates in place: slow pointer `write` marks where the next unique value goes; fast pointer scans." });
    for (let i = 1; i < a.length; i++) {
      if (a[i] !== a[w - 1]) {
        a[w] = a[i];
        w++;
        fr.push({ l: w - 1, r: i, write: w, arr: [...a], msg: `${a[i]} is new → copy it to index ${w - 1}, advance write.`, tone: "good" });
      } else fr.push({ l: w - 1, r: i, write: w, arr: [...a], msg: `${a[i]} duplicates the last kept value → skip.` });
    }
    fr.push({ l: w - 1, r: a.length - 1, write: w, arr: [...a], msg: `First ${w} slots hold the unique values. O(n) time, O(1) space.`, tone: "good" });
    return fr;
  }, [mode, arr, heights, dups, target]);

  const s = useStepper(frames, 800);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "pair", label: "Pair with target sum" },
            { value: "water", label: "Container with most water" },
            { value: "dedupe", label: "Remove duplicates" },
          ]}
        />
        {mode === "pair" && (
          <>
            <span className="text-xs text-dim">target</span>
            <TextInput value={target} onChange={setTarget} width="w-14" />
          </>
        )}
      </div>

      {mode === "water" ? (
        <div className="rounded-xl border border-line bg-[#080c19] p-4">
          <div className="relative flex h-56 items-end gap-2">
            {f.best && (
              <div
                className="absolute bottom-0 rounded-sm bg-sky/20 transition-all duration-300"
                style={{
                  left: `calc(${(f.best[0] / heights.length) * 100}% + ${100 / heights.length / 2}%)`,
                  width: `${((f.best[1] - f.best[0]) / heights.length) * 100}%`,
                  height: `${(Math.min(heights[f.best[0]], heights[f.best[1]]) / 9) * 100}%`,
                }}
              />
            )}
            {heights.map((h, i) => {
              const color = i === f.l ? C.compare : i === f.r ? C.swap : C.base;
              return (
                <div key={i} className="relative z-10 flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                  <div className="w-3 rounded-t transition-colors sm:w-4" style={{ height: `${(h / 9) * 100}%`, background: color, boxShadow: color !== C.base ? `0 0 10px ${color}` : undefined }} />
                  <span className="mt-1 font-mono text-[10px] text-faint">{h}</span>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setHeights(randomInts(9, 1, 9))} className="mt-2 text-xs text-dim hover:text-ink">
            ↻ new heights
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-4 scrollbar-thin">
          <div className="flex gap-1.5">
            {(f.arr ?? (mode === "pair" ? arr : dups)).map((v, i) => {
              const isL = i === f.l;
              const isR = i === f.r;
              const kept = mode === "dedupe" && f.write !== undefined && i < f.write;
              const out = mode === "pair" && (i < f.l || i > f.r);
              const color = isL && isR ? C.pivot : isL ? C.compare : isR ? C.swap : kept ? C.done : C.base;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-4 font-mono text-[10px] font-bold" style={{ color: C.compare }}>
                    {isL ? (mode === "dedupe" ? "w−1" : "L") : ""}
                  </div>
                  <div
                    className="grid h-11 w-10 place-items-center rounded-lg border-2 font-mono text-sm font-semibold transition-all"
                    style={{ borderColor: color, background: color !== C.base ? `${color}22` : C.baseFill, color: out ? C.faint : C.text, opacity: out ? 0.35 : 1 }}
                  >
                    {v}
                  </div>
                  <div className="h-4 font-mono text-[10px] font-bold" style={{ color: C.swap }}>
                    {isR ? (mode === "dedupe" ? "i" : "R") : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {mode === "pair" && (
            <button type="button" onClick={() => setArr([...randomInts(12, 1, 30)].sort((a, b) => a - b))} className="mt-2 text-xs text-dim hover:text-ink">
              ↻ new array
            </button>
          )}
          {mode === "dedupe" && (
            <button type="button" onClick={() => setDups([...randomInts(10, 0, 5)].sort((a, b) => a - b))} className="mt-2 text-xs text-dim hover:text-ink">
              ↻ new array
            </button>
          )}
        </div>
      )}
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      {mode === "water" && <Stat label="best area" value={f.bestVal ?? 0} color={C.sky} />}
    </div>
  );
}
