"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, TextInput, useStepper } from "../kit";

type Mode = "unique" | "fixed" | "minwin";

interface Frame {
  l: number;
  r: number; // inclusive, -1 = empty
  counts: Record<string, number>;
  best: [number, number] | null;
  bestVal: number | string;
  msg: string;
  tone?: "info" | "good" | "bad";
}

export default function SlidingWindow() {
  const [mode, setMode] = useState<Mode>("unique");
  const [text, setText] = useState("abcabcbbxyz");
  const [nums, setNums] = useState("2 1 5 1 3 2 7 1 4");
  const [k, setK] = useState("3");
  const [need, setNeed] = useState("abc");
  const [hay, setHay] = useState("adobecodebanc");

  const frames = useMemo<Frame[]>(() => {
    const fr: Frame[] = [];
    if (mode === "unique") {
      const s = text.slice(0, 18);
      const counts: Record<string, number> = {};
      let l = 0;
      let best: [number, number] | null = null;
      let bestLen = 0;
      fr.push({ l: 0, r: -1, counts: {}, best: null, bestVal: 0, msg: "Longest substring without repeating characters. Expand R; when a duplicate enters, shrink L until the window is valid again." });
      for (let r = 0; r < s.length; r++) {
        const ch = s[r];
        counts[ch] = (counts[ch] ?? 0) + 1;
        fr.push({ l, r, counts: { ...counts }, best, bestVal: bestLen, msg: `Expand: add '${ch}'.${counts[ch] > 1 ? ` Now '${ch}' appears twice → invalid.` : ""}`, tone: counts[ch] > 1 ? "bad" : "info" });
        while (counts[ch] > 1) {
          counts[s[l]]--;
          if (!counts[s[l]]) delete counts[s[l]];
          fr.push({ l: l + 1, r, counts: { ...counts }, best, bestVal: bestLen, msg: `Shrink: drop '${s[l]}' from the left.` });
          l++;
        }
        if (r - l + 1 > bestLen) {
          bestLen = r - l + 1;
          best = [l, r];
          fr.push({ l, r, counts: { ...counts }, best, bestVal: bestLen, msg: `Valid window "${s.slice(l, r + 1)}" of length ${bestLen} — new best.`, tone: "good" });
        }
      }
      fr.push({ l, r: s.length - 1, counts: { ...counts }, best, bestVal: bestLen, msg: `Answer ${bestLen}. Each character enters and leaves the window at most once → O(n).`, tone: "good" });
      return fr;
    }
    if (mode === "fixed") {
      const a = nums.split(/[\s,]+/).filter(Boolean).map(Number).slice(0, 16);
      const K = Math.max(1, Math.min(a.length, Number(k) || 1));
      let sum = 0;
      for (let i = 0; i < K; i++) sum += a[i];
      let best = sum;
      let bestRange: [number, number] = [0, K - 1];
      fr.push({ l: 0, r: K - 1, counts: {}, best: bestRange, bestVal: best, msg: `Fixed window of size ${K}. First window sum = ${sum}.` });
      for (let r = K; r < a.length; r++) {
        sum += a[r] - a[r - K];
        const better = sum > best;
        if (better) {
          best = sum;
          bestRange = [r - K + 1, r];
        }
        fr.push({ l: r - K + 1, r, counts: {}, best: bestRange, bestVal: best, msg: `Slide: + ${a[r]} − ${a[r - K]} → sum ${sum}${better ? " (new best)" : ""}. O(1) per step instead of re-summing k items.`, tone: better ? "good" : "info" });
      }
      fr.push({ l: bestRange[0], r: bestRange[1], counts: {}, best: bestRange, bestVal: best, msg: `Max sum of any ${K} consecutive values = ${best}. O(n).`, tone: "good" });
      return fr;
    }
    // minimum window substring
    const s = hay.slice(0, 20);
    const t = need.slice(0, 6);
    const want: Record<string, number> = {};
    for (const ch of t) want[ch] = (want[ch] ?? 0) + 1;
    const have: Record<string, number> = {};
    let formed = 0;
    const required = Object.keys(want).length;
    let l = 0;
    let best: [number, number] | null = null;
    let bestLen = Infinity;
    fr.push({ l: 0, r: -1, counts: {}, best: null, bestVal: "∞", msg: `Minimum window of "${s}" containing all of "${t}". Expand until valid, then shrink while it stays valid.` });
    for (let r = 0; r < s.length; r++) {
      const ch = s[r];
      have[ch] = (have[ch] ?? 0) + 1;
      if (want[ch] && have[ch] === want[ch]) formed++;
      fr.push({ l, r, counts: { ...have }, best, bestVal: bestLen === Infinity ? "∞" : bestLen, msg: `Expand with '${ch}'. Requirements met: ${formed}/${required}.` });
      while (formed === required) {
        if (r - l + 1 < bestLen) {
          bestLen = r - l + 1;
          best = [l, r];
          fr.push({ l, r, counts: { ...have }, best, bestVal: bestLen, msg: `Valid window "${s.slice(l, r + 1)}" (length ${bestLen}) — record it, then try to shrink.`, tone: "good" });
        }
        const out = s[l];
        have[out]--;
        if (want[out] && have[out] < want[out]) formed--;
        l++;
        fr.push({ l, r, counts: { ...have }, best, bestVal: bestLen, msg: `Shrink: drop '${out}'.${want[out] && have[out] < want[out] ? " That broke a requirement — expand again." : ""}`, tone: want[out] && have[out] < want[out] ? "bad" : "info" });
      }
    }
    fr.push({ l, r: s.length - 1, counts: { ...have }, best, bestVal: bestLen === Infinity ? "∞" : bestLen, msg: best ? `Answer: "${s.slice(best[0], best[1] + 1)}". O(|s| + |t|).` : "No window contains every required character.", tone: best ? "good" : "bad" });
    return fr;
  }, [mode, text, nums, k, need, hay]);

  const s = useStepper(frames, 650);
  const f = s.frame;
  const items: string[] = mode === "unique" ? text.slice(0, 18).split("") : mode === "fixed" ? nums.split(/[\s,]+/).filter(Boolean).slice(0, 16) : hay.slice(0, 20).split("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "unique", label: "Longest unique substring" },
            { value: "fixed", label: "Max sum of size k" },
            { value: "minwin", label: "Minimum window substring" },
          ]}
        />
        {mode === "unique" && <TextInput value={text} onChange={setText} width="w-40" />}
        {mode === "fixed" && (
          <>
            <TextInput value={nums} onChange={setNums} width="w-44" />
            <span className="text-xs text-dim">k</span>
            <TextInput value={k} onChange={setK} width="w-12" />
          </>
        )}
        {mode === "minwin" && (
          <>
            <TextInput value={hay} onChange={setHay} width="w-40" />
            <span className="text-xs text-dim">needs</span>
            <TextInput value={need} onChange={setNeed} width="w-16" />
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-4 scrollbar-thin">
        <div className="relative flex gap-1">
          {items.map((ch, i) => {
            const inWin = i >= f.l && i <= f.r;
            const inBest = f.best && i >= f.best[0] && i <= f.best[1];
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="grid h-11 w-9 place-items-center rounded-lg border-2 font-mono text-sm font-semibold transition-all duration-200"
                  style={{
                    borderColor: inWin ? C.active : C.dim,
                    background: inWin ? `${C.active}22` : "transparent",
                    color: inWin ? C.text : C.faint,
                    boxShadow: inBest ? `inset 0 -3px 0 ${C.done}` : undefined,
                  }}
                >
                  {ch}
                </div>
                <div className="h-4 font-mono text-[10px] font-bold">
                  {i === f.l && <span style={{ color: C.compare }}>L</span>}
                  {i === f.r && <span style={{ color: C.swap }}>{i === f.l ? "/R" : "R"}</span>}
                </div>
              </div>
            );
          })}
        </div>
        {mode !== "fixed" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(f.counts).map(([ch, n]) => (
              <span key={ch} className="rounded-md border border-line-2 px-2 py-0.5 font-mono text-[11px] text-dim">
                {ch}:{n}
              </span>
            ))}
            <span className="text-[11px] text-faint">← window counts (hash map)</span>
          </div>
        )}
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="window size" value={Math.max(0, f.r - f.l + 1)} color={C.active} />
        <Stat label={mode === "fixed" ? "best sum" : mode === "unique" ? "best length" : "best window length"} value={f.bestVal} color={C.done} />
      </div>
    </div>
  );
}
