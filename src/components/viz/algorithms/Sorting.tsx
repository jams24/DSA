"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat, StepControls, randomInts, useStepper } from "../kit";

type Algo = "bubble" | "selection" | "insertion" | "merge" | "quick" | "heap";

interface Frame {
  arr: number[];
  hi: Record<number, string>;
  sorted: number[];
  cmp: number;
  swp: number;
  msg: string;
}

const NAMES: Record<Algo, string> = {
  bubble: "Bubble",
  selection: "Selection",
  insertion: "Insertion",
  merge: "Merge",
  quick: "Quick",
  heap: "Heap",
};

const BIG_O: Record<Algo, string> = {
  bubble: "O(n²) · stable",
  selection: "O(n²) · not stable",
  insertion: "O(n²), O(n) if nearly sorted · stable",
  merge: "O(n log n) · O(n) space · stable",
  quick: "O(n log n) avg, O(n²) worst · in place",
  heap: "O(n log n) · O(1) space · not stable",
};

function generate(algo: Algo, input: number[]): Frame[] {
  const a = [...input];
  const n = a.length;
  const fr: Frame[] = [];
  let cmp = 0;
  let swp = 0;
  const sorted = new Set<number>();
  const push = (hi: Record<number, string>, msg: string) => fr.push({ arr: [...a], hi, sorted: [...sorted], cmp, swp, msg });
  const swap = (i: number, j: number) => {
    [a[i], a[j]] = [a[j], a[i]];
    swp++;
  };
  push({}, `${NAMES[algo]} sort on ${n} values. ${BIG_O[algo]}.`);

  if (algo === "bubble") {
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        cmp++;
        push({ [i]: C.compare, [i + 1]: C.compare }, `Compare ${a[i]} and ${a[i + 1]}.`);
        if (a[i] > a[i + 1]) {
          swap(i, i + 1);
          swapped = true;
          push({ [i]: C.swap, [i + 1]: C.swap }, "Out of order → swap. The largest value bubbles to the end.");
        }
      }
      sorted.add(end);
      if (!swapped) {
        for (let k = 0; k < end; k++) sorted.add(k);
        push({}, "No swaps in a full pass → already sorted. Early exit makes best case O(n).");
        break;
      }
    }
    sorted.add(0);
  } else if (algo === "selection") {
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) {
        cmp++;
        push({ [m]: C.pivot, [j]: C.compare }, `Scanning for the minimum: current min ${a[m]}, check ${a[j]}.`);
        if (a[j] < a[m]) m = j;
      }
      if (m !== i) swap(i, m);
      sorted.add(i);
      push({ [i]: C.done }, `Place the minimum (${a[i]}) at index ${i}. Always n²/2 comparisons, but only n swaps.`);
    }
    sorted.add(n - 1);
  } else if (algo === "insertion") {
    sorted.add(0);
    for (let i = 1; i < n; i++) {
      let j = i;
      push({ [i]: C.active }, `Insert ${a[i]} into the sorted prefix on its left.`);
      while (j > 0) {
        cmp++;
        if (a[j - 1] <= a[j]) {
          push({ [j]: C.done, [j - 1]: C.compare }, `${a[j - 1]} ≤ ${a[j]} → it's in place.`);
          break;
        }
        swap(j, j - 1);
        push({ [j - 1]: C.swap, [j]: C.swap }, `Shift ${a[j]} right; ${a[j - 1]} moves left.`);
        j--;
      }
      sorted.add(i);
    }
  } else if (algo === "merge") {
    const merge = (lo: number, mid: number, hi: number) => {
      const left = a.slice(lo, mid + 1);
      const right = a.slice(mid + 1, hi + 1);
      let i = 0;
      let j = 0;
      let k = lo;
      while (i < left.length && j < right.length) {
        cmp++;
        if (left[i] <= right[j]) a[k++] = left[i++];
        else a[k++] = right[j++];
        swp++;
        push({ [k - 1]: C.swap, ...range(lo, hi, C.pivot, k - 1) }, `Merge [${lo}..${hi}]: write the smaller head (${a[k - 1]}).`);
      }
      while (i < left.length) {
        a[k++] = left[i++];
        swp++;
        push({ [k - 1]: C.swap }, "Copy the leftovers.");
      }
      while (j < right.length) {
        a[k++] = right[j++];
        swp++;
        push({ [k - 1]: C.swap }, "Copy the leftovers.");
      }
    };
    const sort = (lo: number, hi: number) => {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      push(range(lo, hi, C.compare), `Split [${lo}..${hi}] into [${lo}..${mid}] and [${mid + 1}..${hi}].`);
      sort(lo, mid);
      sort(mid + 1, hi);
      merge(lo, mid, hi);
    };
    sort(0, n - 1);
    for (let k = 0; k < n; k++) sorted.add(k);
  } else if (algo === "quick") {
    const qs = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) {
        sorted.add(lo);
        return;
      }
      const p = a[hi];
      let i = lo;
      push({ [hi]: C.pivot }, `Partition [${lo}..${hi}] around pivot ${p} (last element, Lomuto scheme).`);
      for (let j = lo; j < hi; j++) {
        cmp++;
        push({ [hi]: C.pivot, [j]: C.compare, [i]: C.active }, `${a[j]} ${a[j] < p ? "<" : "≥"} ${p}${a[j] < p ? " → move it to the 'small' side." : ""}`);
        if (a[j] < p) {
          swap(i, j);
          i++;
        }
      }
      swap(i, hi);
      sorted.add(i);
      push({ [i]: C.done }, `Pivot ${p} lands at its final index ${i}. Everything left is smaller, right is larger.`);
      qs(lo, i - 1);
      qs(i + 1, hi);
    };
    qs(0, n - 1);
  } else {
    const sift = (i: number, size: number) => {
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < size) {
          cmp++;
          if (a[l] > a[m]) m = l;
        }
        if (r < size) {
          cmp++;
          if (a[r] > a[m]) m = r;
        }
        if (m === i) return;
        swap(i, m);
        push({ [i]: C.swap, [m]: C.swap }, "Sift down to restore the max-heap.");
        i = m;
      }
    };
    for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
    push({}, "Array is now a max-heap (largest at index 0).");
    for (let end = n - 1; end > 0; end--) {
      swap(0, end);
      sorted.add(end);
      push({ [end]: C.done }, `Move the max (${a[end]}) to index ${end}.`);
      sift(0, end);
    }
    sorted.add(0);
  }
  for (let k = 0; k < n; k++) sorted.add(k);
  push({}, `Sorted with ${cmp} comparisons and ${swp} ${algo === "merge" ? "writes" : "swaps"}.`);
  return fr;
}

function range(lo: number, hi: number, color: string, except?: number) {
  const o: Record<number, string> = {};
  for (let i = lo; i <= hi; i++) if (i !== except) o[i] = color;
  return o;
}

function Bars({ f, max, height = 220, showValues }: { f: Frame; max: number; height?: number; showValues?: boolean }) {
  const sorted = new Set(f.sorted);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {f.arr.map((v, i) => {
        const color = f.hi[i] ?? (sorted.has(i) ? C.done : C.base);
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
            <div
              className="w-full rounded-t-[3px] transition-[height] duration-150"
              style={{
                height: `${(v / max) * 100}%`,
                background: f.hi[i] ? color : sorted.has(i) ? `${C.done}aa` : `linear-gradient(${C.base}, #1e2747)`,
                boxShadow: f.hi[i] ? `0 0 10px ${color}` : undefined,
              }}
            />
            {showValues && <span className="mt-1 font-mono text-[9px] text-faint">{v}</span>}
          </div>
        );
      })}
    </div>
  );
}

const ALGOS: Algo[] = ["bubble", "selection", "insertion", "merge", "quick", "heap"];

export default function Sorting() {
  const [mode, setMode] = useState<"single" | "race">("single");
  const [algo, setAlgo] = useState<Algo>("quick");
  const [n, setN] = useState(20);
  const [input, setInput] = useState(() => randomInts(20, 5, 99));
  const [shape, setShape] = useState<"random" | "nearly" | "reversed">("random");

  const all = useMemo(() => Object.fromEntries(ALGOS.map((a) => [a, generate(a, input)])) as Record<Algo, Frame[]>, [input]);
  const raceFrames = useMemo(() => Array.from({ length: Math.max(...ALGOS.map((a) => all[a].length)) }, (_, i) => i), [all]);
  const single = useStepper(all[algo], Math.max(30, 2400 / Math.max(1, input.length * 3)));
  const race = useStepper(raceFrames, 25);
  const max = Math.max(...input);

  function regen(size = n, kind = shape) {
    let arr = randomInts(size, 5, 99);
    if (kind === "nearly") {
      arr = [...arr].sort((x, y) => x - y);
      for (let k = 0; k < Math.max(1, size / 8); k++) {
        const i = Math.floor(Math.random() * (size - 1));
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      }
    } else if (kind === "reversed") arr = [...arr].sort((x, y) => y - x);
    setInput(arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "single", label: "Step through one" },
            { value: "race", label: "🏁 Race all six" },
          ]}
        />
        {mode === "single" && <Segmented value={algo} onChange={setAlgo} options={ALGOS.map((a) => ({ value: a, label: NAMES[a] }))} />}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <Slider
            label="array size"
            value={n}
            min={8}
            max={40}
            onChange={(v) => {
              setN(v);
              regen(v);
            }}
          />
        </div>
        <Segmented
          value={shape}
          onChange={(k) => {
            setShape(k);
            regen(n, k);
          }}
          options={[
            { value: "random", label: "Random" },
            { value: "nearly", label: "Nearly sorted" },
            { value: "reversed", label: "Reversed" },
          ]}
        />
      </div>

      {mode === "single" ? (
        <>
          <div className="rounded-xl border border-line bg-[#080c19] p-4">
            <Bars f={single.frame} max={max} showValues={input.length <= 24} />
          </div>
          <Narration>{single.frame.msg}</Narration>
          <StepControls s={single} onShuffle={() => regen()} />
          <div className="grid grid-cols-3 gap-2">
            <Stat label="comparisons" value={single.frame.cmp} color={C.compare} />
            <Stat label={algo === "merge" ? "writes" : "swaps"} value={single.frame.swp} color={C.swap} />
            <Stat label="complexity" value={<span className="text-sm">{BIG_O[algo].split(" · ")[0]}</span>} color={C.pivot} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALGOS.map((a) => {
              const fr = all[a];
              const f = fr[Math.min(race.i, fr.length - 1)];
              const done = race.i >= fr.length - 1;
              return (
                <div key={a} className="rounded-xl border bg-[#080c19] p-3" style={{ borderColor: done ? `${C.done}66` : "#1e2747" }}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-display text-sm font-semibold text-ink">{NAMES[a]}</span>
                    <span className="font-mono text-[10px] text-faint">
                      {f.cmp} cmp · {fr.length} steps {done && "✓"}
                    </span>
                  </div>
                  <Bars f={f} max={max} height={110} />
                </div>
              );
            })}
          </div>
          <Narration>
            Same input, one step per tick. Watch O(n²) algorithms crawl on random data — then switch the input to “nearly sorted” and see insertion sort win.
          </Narration>
          <StepControls s={race} onShuffle={() => regen()} />
        </>
      )}
    </div>
  );
}
