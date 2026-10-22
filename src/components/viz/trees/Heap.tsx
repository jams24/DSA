"use client";

import { useState } from "react";
import { C, Narration, Segmented, SmallBtn, StepControls, TextInput, randomInts, useStepper } from "../kit";
import { TreeSvg, type TreeMap } from "./tree";

interface Frame {
  arr: number[];
  hi: Record<number, string>;
  sorted?: number[];
  msg: string;
}

function toTree(arr: number[]): { nodes: TreeMap; root: number | null } {
  const nodes: TreeMap = {};
  arr.forEach((v, i) => {
    nodes[i] = { id: i, val: v, left: 2 * i + 1 < arr.length ? 2 * i + 1 : null, right: 2 * i + 2 < arr.length ? 2 * i + 2 : null };
  });
  return { nodes, root: arr.length ? 0 : null };
}

export default function Heap() {
  const [kind, setKind] = useState<"min" | "max">("min");
  const [arr, setArr] = useState<number[]>([3, 9, 5, 14, 11, 8, 7]);
  const [val, setVal] = useState("2");
  const [frames, setFrames] = useState<Frame[]>([{ arr: [3, 9, 5, 14, 11, 8, 7], hi: {}, msg: "A min-heap stored in an array: children of i live at 2i+1 and 2i+2, parent at ⌊(i−1)/2⌋. Every parent ≤ its children." }]);
  const s = useStepper(frames, 650, true);
  const better = (a: number, b: number) => (kind === "min" ? a < b : a > b);

  function siftDown(a: number[], i: number, n: number, fr: Frame[], extra: Partial<Frame> = {}) {
    for (;;) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let best = i;
      if (l < n && better(a[l], a[best])) best = l;
      if (r < n && better(a[r], a[best])) best = r;
      fr.push({ arr: [...a], hi: { [i]: C.compare, ...(l < n ? { [l]: C.pivot } : {}), ...(r < n ? { [r]: C.pivot } : {}) }, msg: `Compare ${a[i]} with its children${l < n ? ` ${a[l]}` : ""}${r < n ? ` and ${a[r]}` : ""}.`, ...extra });
      if (best === i) {
        fr.push({ arr: [...a], hi: { [i]: C.done }, msg: `${a[i]} is in place — heap property restored.`, ...extra });
        return;
      }
      [a[i], a[best]] = [a[best], a[i]];
      fr.push({ arr: [...a], hi: { [i]: C.swap, [best]: C.swap }, msg: `Swap with the ${kind === "min" ? "smaller" : "larger"} child (${a[i]}). Sift down continues.`, ...extra });
      i = best;
    }
  }

  function push() {
    const v = Number(val);
    if (!Number.isFinite(v) || arr.length >= 15) return;
    const a = [...arr, v];
    const fr: Frame[] = [{ arr: [...a], hi: { [a.length - 1]: C.active }, msg: `Append ${v} at the end (index ${a.length - 1}) to keep the tree complete.` }];
    let i = a.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      fr.push({ arr: [...a], hi: { [i]: C.active, [p]: C.compare }, msg: `Compare ${a[i]} with parent ${a[p]} (index ${p}).` });
      if (!better(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      fr.push({ arr: [...a], hi: { [p]: C.swap, [i]: C.swap }, msg: `${a[p]} ${kind === "min" ? "<" : ">"} ${a[i]} → swap up.` });
      i = p;
    }
    fr.push({ arr: [...a], hi: { [i]: C.done }, msg: `Sift-up finished at index ${i}. At most log₂(n) swaps: O(log n).` });
    setArr(a);
    setFrames(fr);
  }

  function pop() {
    if (!arr.length) return;
    const a = [...arr];
    const top = a[0];
    const fr: Frame[] = [{ arr: [...a], hi: { 0: C.bad }, msg: `Pop the ${kind} (${top}) from the root.` }];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      fr.push({ arr: [...a], hi: { 0: C.active }, msg: `Move the last element (${last}) to the root, then sift it down.` });
      siftDown(a, 0, a.length, fr);
    }
    fr.push({ arr: [...a], hi: {}, msg: `Removed ${top}. O(log n).` });
    setArr(a);
    setFrames(fr);
  }

  function heapify() {
    const a = randomInts(10, 1, 50);
    const fr: Frame[] = [{ arr: [...a], hi: {}, msg: "Random array. Floyd's heapify: sift down every non-leaf, from the last parent back to the root." }];
    for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) {
      fr.push({ arr: [...a], hi: { [i]: C.active }, msg: `Sift down index ${i} (${a[i]}).` });
      siftDown(a, i, a.length, fr);
    }
    fr.push({ arr: [...a], hi: {}, msg: "Heap built in O(n) total — most nodes are near the bottom and barely move. (n pushes would be O(n log n).)" });
    setArr(a);
    setFrames(fr);
  }

  function heapSort() {
    const a = [...arr];
    const fr: Frame[] = [{ arr: [...a], hi: {}, sorted: [], msg: `Heap sort: repeatedly swap the root to the end and shrink the heap.` }];
    const sorted: number[] = [];
    for (let end = a.length - 1; end > 0; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      sorted.unshift(end);
      fr.push({ arr: [...a], hi: { [end]: C.done }, sorted: [...sorted], msg: `Move ${a[end]} to its final position ${end}.` });
      siftDown(a, 0, end, fr, { sorted: [...sorted] });
    }
    fr.push({ arr: [...a], hi: {}, sorted: a.map((_, i) => i), msg: `Sorted ${kind === "min" ? "descending" : "ascending"} in place: O(n log n), O(1) extra space, not stable.` });
    setFrames(fr);
  }

  const f = s.frame;
  const { nodes, root } = toTree(f.arr);
  const sortedSet = new Set(f.sorted ?? []);
  const visible = Object.fromEntries(Object.entries(nodes).filter(([k]) => !sortedSet.has(Number(k))));
  for (const n of Object.values(visible)) {
    if (n.left !== null && sortedSet.has(n.left)) n.left = null;
    if (n.right !== null && sortedSet.has(n.right)) n.right = null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            const a = [...arr].sort((x, y) => (k === "min" ? x - y : y - x));
            setArr(a);
            setFrames([{ arr: a, hi: {}, msg: `Switched to a ${k}-heap (a sorted array is always a valid heap).` }]);
          }}
          options={[
            { value: "min", label: "Min-heap" },
            { value: "max", label: "Max-heap" },
          ]}
        />
        <TextInput value={val} onChange={setVal} width="w-14" onEnter={push} />
        <SmallBtn tone="primary" onClick={push}>push</SmallBtn>
        <SmallBtn tone="danger" onClick={pop}>pop {kind}</SmallBtn>
        <SmallBtn onClick={heapify}>heapify random</SmallBtn>
        <SmallBtn tone="good" onClick={heapSort}>heap sort</SmallBtn>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-2 scrollbar-thin">
        <TreeSvg nodes={visible} root={root !== null && !sortedSet.has(root) ? root : null} hi={f.hi} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel p-3 scrollbar-thin">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Backing array</div>
        <div className="flex gap-1">
          {f.arr.map((v, i) => {
            const color = f.hi[i] ?? (sortedSet.has(i) ? C.done : undefined);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="grid h-10 w-10 place-items-center rounded-md border-2 font-mono text-sm font-semibold transition"
                  style={{ borderColor: color ?? C.base, background: color ? `${color}22` : C.baseFill, color: color ?? C.text }}
                >
                  {v}
                </div>
                <span className="font-mono text-[10px] text-faint">{i}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
