"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

interface Frame {
  cells: (number | null)[];
  hi: Record<number, string>;
  msg: string;
  ghost?: (number | null)[]; // old block while resizing
}

interface Arr {
  data: number[];
  cap: number;
}

function snapshot(data: (number | null)[], cap: number): (number | null)[] {
  return Array.from({ length: cap }, (_, i) => (i < data.length ? data[i] : null));
}

export default function DynamicArray() {
  const [arr, setArr] = useState<Arr>({ data: [7, 3, 9], cap: 4 });
  const [frames, setFrames] = useState<Frame[]>([{ cells: snapshot([7, 3, 9], 4), hi: {}, msg: "A dynamic array: size 3, capacity 4. Try push, insert, remove." }]);
  const [val, setVal] = useState("42");
  const [idx, setIdx] = useState("1");
  const [ops, setOps] = useState(0);
  const [moves, setMoves] = useState(0);
  const s = useStepper(frames, 450, true);

  function run(kind: "push" | "insert" | "remove" | "pop" | "get") {
    const v = Number(val);
    const i = Number(idx);
    const data = [...arr.data];
    let cap = arr.cap;
    const fr: Frame[] = [];
    let cost = 0;

    const growIfFull = () => {
      if (data.length < cap) return;
      const old = snapshot(data, cap);
      const newCap = cap * 2;
      fr.push({ cells: snapshot([], newCap), ghost: old, hi: {}, msg: `Full! size = capacity = ${cap}. Allocate a new block with capacity ${newCap}.` });
      for (let k = 0; k < data.length; k++) {
        fr.push({
          cells: snapshot(data.slice(0, k + 1), newCap),
          ghost: old,
          hi: { [k]: C.swap },
          msg: `Copy element ${k} (${data[k]}) into the new block. Copies so far: ${k + 1}.`,
        });
        cost++;
      }
      cap = newCap;
      fr.push({ cells: snapshot(data, cap), hi: {}, msg: `Old block freed. Resizing cost ${data.length} copies — but it only happens after doubling, so the cost amortizes to O(1) per push.` });
    };

    if (kind === "get") {
      if (!(i >= 0 && i < data.length)) return;
      fr.push({ cells: snapshot(data, cap), hi: { [i]: C.active }, msg: `arr[${i}] → address = base + ${i} × 8 bytes. One arithmetic step: O(1) random access. Value = ${data[i]}.` });
      cost = 1;
    } else if (kind === "push") {
      if (!Number.isFinite(v)) return;
      growIfFull();
      data.push(v);
      cost++;
      fr.push({ cells: snapshot(data, cap), hi: { [data.length - 1]: C.done }, msg: `Write ${v} at index ${data.length - 1}. size = ${data.length}, capacity = ${cap}.` });
    } else if (kind === "pop") {
      if (!data.length) return;
      const x = data.pop();
      cost++;
      fr.push({ cells: snapshot([...data, x!], cap), hi: { [data.length]: C.bad }, msg: `Remove the last element (${x}). Nothing shifts: O(1).` });
      fr.push({ cells: snapshot(data, cap), hi: {}, msg: `size = ${data.length}.` });
    } else if (kind === "insert") {
      if (!Number.isFinite(v) || !(i >= 0 && i <= data.length)) return;
      growIfFull();
      const work: (number | null)[] = [...data, null];
      fr.push({ cells: snapshot(work, cap), hi: { [i]: C.compare }, msg: `Insert ${v} at index ${i}: every element from ${i} onward must shift right first.` });
      for (let k = data.length - 1; k >= i; k--) {
        work[k + 1] = work[k];
        work[k] = null;
        cost++;
        fr.push({ cells: snapshot(work, cap), hi: { [k + 1]: C.swap }, msg: `Shift arr[${k}] → arr[${k + 1}].` });
      }
      data.splice(i, 0, v);
      cost++;
      fr.push({ cells: snapshot(data, cap), hi: { [i]: C.done }, msg: `Write ${v} at index ${i}. ${data.length - 1 - i} shifts: insertion is O(n) in the worst case.` });
    } else if (kind === "remove") {
      if (!(i >= 0 && i < data.length)) return;
      const work: (number | null)[] = [...data];
      fr.push({ cells: snapshot(work, cap), hi: { [i]: C.bad }, msg: `Remove index ${i} (${data[i]}): the gap must be closed by shifting left.` });
      work[i] = null;
      for (let k = i + 1; k < data.length; k++) {
        work[k - 1] = work[k];
        work[k] = null;
        cost++;
        fr.push({ cells: snapshot(work, cap), hi: { [k - 1]: C.swap }, msg: `Shift arr[${k}] → arr[${k - 1}].` });
      }
      data.splice(i, 1);
      fr.push({ cells: snapshot(data, cap), hi: {}, msg: `Done. size = ${data.length}.` });
    }

    setArr({ data, cap });
    setOps((o) => o + 1);
    setMoves((m) => m + cost);
    setFrames(fr);
  }

  const f = s.frame;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">value</span>
        <TextInput value={val} onChange={setVal} width="w-16" />
        <span className="text-xs text-dim">index</span>
        <TextInput value={idx} onChange={setIdx} width="w-14" />
        <SmallBtn tone="primary" onClick={() => run("push")}>push(value)</SmallBtn>
        <SmallBtn onClick={() => run("insert")}>insert(index, value)</SmallBtn>
        <SmallBtn onClick={() => run("remove")}>remove(index)</SmallBtn>
        <SmallBtn onClick={() => run("pop")}>pop()</SmallBtn>
        <SmallBtn onClick={() => run("get")}>get(index)</SmallBtn>
      </div>

      <div className="space-y-3 overflow-x-auto rounded-xl border border-line bg-[#080c19] p-4 scrollbar-thin">
        {f.ghost && (
          <div className="opacity-50">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-faint">old block</div>
            <Cells cells={f.ghost} hi={{}} />
          </div>
        )}
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-faint">
            {f.ghost ? "new block" : "memory block"} · capacity {f.cells.length}
          </div>
          <Cells cells={f.cells} hi={f.hi} />
        </div>
      </div>

      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="size" value={arr.data.length} />
        <Stat label="capacity" value={arr.cap} color={C.pivot} />
        <Stat label="operations" value={ops} />
        <Stat label="avg moves / op" value={ops ? (moves / ops).toFixed(2) : "–"} color={C.compare} />
      </div>
    </div>
  );
}

function Cells({ cells, hi }: { cells: (number | null)[]; hi: Record<number, string> }) {
  return (
    <div className="flex gap-1.5">
      {cells.map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className={clsx(
              "grid h-12 w-12 place-items-center rounded-lg border-2 font-mono text-sm font-semibold transition-all duration-300",
              c === null && "border-dashed",
            )}
            style={{
              borderColor: hi[i] ?? (c === null ? C.dim : C.base),
              background: hi[i] ? `${hi[i]}22` : c === null ? "transparent" : C.baseFill,
              color: hi[i] ?? C.text,
              boxShadow: hi[i] ? `0 0 14px ${hi[i]}66` : undefined,
            }}
          >
            {c ?? ""}
          </div>
          <span className="font-mono text-[10px] text-faint">{i}</span>
        </div>
      ))}
    </div>
  );
}
