"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type Cell = number | null;
interface Arr {
  id: string;
  cells: Cell[];
  dead?: boolean;
}
interface Sl {
  name: string;
  arr: string;
  off: number;
  len: number;
  cap: number;
}
interface Frame {
  line: number;
  arrays: Arr[];
  slices: Sl[];
  hot: string[]; // "arrId:index"
  note: string;
  tone: "info" | "good" | "bad" | "warn";
  out: string[];
}

const COLORS: Record<string, string> = { s: C.active, a: C.pivot, b: C.swap, c: C.done };

class B {
  arrays: Arr[] = [];
  slices: Sl[] = [];
  frames: Frame[] = [];
  hot: string[] = [];
  out: string[] = [];
  n = 0;
  arr(cells: Cell[]) {
    const id = `arr${++this.n}`;
    this.arrays.push({ id, cells: [...cells] });
    return id;
  }
  slice(name: string, arr: string, off: number, len: number, cap: number) {
    this.slices = [...this.slices.filter((s) => s.name !== name), { name, arr, off, len, cap }];
  }
  get(name: string) {
    return this.slices.find((s) => s.name === name)!;
  }
  write(arr: string, i: number, v: number) {
    this.arrays.find((a) => a.id === arr)!.cells[i] = v;
    this.hot.push(`${arr}:${i}`);
  }
  /** Go's append: in place when it fits, otherwise grow (double while small) and copy. */
  append(name: string, ...vals: number[]) {
    const s = this.get(name);
    if (s.len + vals.length <= s.cap) {
      vals.forEach((v, k) => this.write(s.arr, s.off + s.len + k, v));
      this.slice(name, s.arr, s.off, s.len + vals.length, s.cap);
      return false;
    }
    const need = s.len + vals.length;
    let cap = Math.max(1, s.cap * 2);
    if (cap < need) cap = need;
    const old = this.arrays.find((a) => a.id === s.arr)!;
    const cells: Cell[] = Array(cap).fill(null);
    for (let k = 0; k < s.len; k++) cells[k] = old.cells[s.off + k];
    vals.forEach((v, k) => (cells[s.len + k] = v));
    const id = this.arr(cells);
    for (let k = s.len; k < need; k++) this.hot.push(`${id}:${k}`);
    this.slice(name, id, 0, need, cap);
    return true;
  }
  gc() {
    for (const a of this.arrays) a.dead = !this.slices.some((s) => s.arr === a.id);
  }
  step(line: number, note: string, tone: Frame["tone"] = "info") {
    this.gc();
    this.frames.push({ line, arrays: structuredClone(this.arrays), slices: structuredClone(this.slices), hot: this.hot, note, tone, out: [...this.out] });
    this.hot = [];
  }
  str(name: string) {
    const s = this.get(name);
    const a = this.arrays.find((x) => x.id === s.arr)!;
    return `[${a.cells.slice(s.off, s.off + s.len).join(" ")}]`;
  }
}

interface Scenario {
  label: string;
  code: string;
  frames: Frame[];
}

function growth(): Scenario {
  const b = new B();
  const code = `s := make([]int, 0, 2)
s = append(s, 1)
s = append(s, 2)
s = append(s, 3)   // full: new array
s = append(s, 4)
s = append(s, 5)   // full again
fmt.Println(len(s), cap(s))`;
  b.slice("s", b.arr([null, null]), 0, 0, 2);
  b.step(1, "A slice is a 3-word header: a pointer into a backing array, a length and a capacity. make([]int, 0, 2) allocates an array of 2 and a header with len 0, cap 2.");
  b.append("s", 1);
  b.step(2, "append writes into the spare capacity and returns a header with len 1. No allocation.");
  b.append("s", 2);
  b.step(3, "len 2, cap 2: the array is full.");
  b.append("s", 3);
  b.step(4, "No room. append allocates a NEW array (double the capacity while the slice is small), copies the 2 elements, adds 3, and returns a header pointing at the new array. The old array is now garbage. That's why you must write s = append(s, …).", "warn");
  b.append("s", 4);
  b.step(5, "Fits in the spare capacity: no allocation.");
  b.append("s", 5);
  b.step(6, "Full again: grow to 8 and copy. Doubling makes append amortized O(1). If you know the final size, make([]int, 0, n) avoids every reallocation.", "warn");
  b.out.push("5 8");
  b.step(7, "len is how many elements you can index; cap is how far you can append before Go must reallocate.", "good");
  return { label: "append & growth", code, frames: b.frames };
}

function sharing(): Scenario {
  const b = new B();
  const code = `a := []int{1, 2, 3, 4, 5}
b := a[1:3]         // [2 3]  len 2  cap 4
b[0] = 20           // changes a[1] too
b = append(b, 99)   // overwrites a[3]!
b = append(b, 7, 8) // past cap: new array
b[0] = -1           // a is not affected now
fmt.Println(a, b)`;
  const arr = b.arr([1, 2, 3, 4, 5]);
  b.slice("a", arr, 0, 5, 5);
  b.step(1, "A slice literal: a backing array of 5 and a header with len 5, cap 5.");
  b.slice("b", arr, 1, 2, 4);
  b.step(2, "Re-slicing a[1:3] copies NOTHING. b is a new header pointing into the SAME array: starting at index 1, len 2, and cap runs to the end of the array (4).", "warn");
  b.write(arr, 1, 20);
  b.step(3, "Writing b[0] writes a[1]. Two slices, one array.", "warn");
  b.append("b", 99);
  b.step(4, "The classic bug: b has spare capacity, so append writes in place, into a[3], silently changing a. a is now [1 20 3 99 5].", "bad");
  b.append("b", 7, 8);
  b.step(5, "Now len 3 + 2 > cap 4, so append allocates a fresh array for b. From here on, a and b are independent.");
  const s = b.get("b");
  b.write(s.arr, s.off, -1);
  b.step(6, "Writing b[0] no longer touches a.");
  b.out.push(`${b.str("a")} ${b.str("b")}`);
  b.step(7, "Whether append shares or copies depends on capacity, which is easy to forget. When a function receives a slice and appends, assume it might clobber the caller's data.", "good");
  return { label: "Shared array gotcha", code, frames: b.frames };
}

function safe(): Scenario {
  const b = new B();
  const code = `a := []int{1, 2, 3, 4, 5}
b := a[1:3:3]       // len 2, cap 2
b = append(b, 99)   // must copy: a is safe
c := make([]int, len(a))
n := copy(c, a)
fmt.Println(a, b, c, n)`;
  const arr = b.arr([1, 2, 3, 4, 5]);
  b.slice("a", arr, 0, 5, 5);
  b.step(1, "Same starting array.");
  b.slice("b", arr, 1, 2, 2);
  b.step(2, "The full slice expression a[low:high:max] also limits capacity: cap = max − low = 2. b can see 2 elements and has no spare room.");
  b.append("b", 99);
  b.step(3, "append can't write in place, so it copies into a new array. a is untouched. Use a[i:j:j] when you hand out a sub-slice that someone may append to.", "good");
  const c = b.arr([0, 0, 0, 0, 0]);
  b.slice("c", c, 0, 5, 5);
  b.step(4, "make allocates a zeroed array of the same length.");
  for (let i = 0; i < 5; i++) b.write(c, i, i + 1);
  b.step(5, "copy(dst, src) copies min(len(dst), len(src)) elements and returns that count. c is a fully independent copy (slices.Clone(a) does the same in one call).");
  b.out.push(`${b.str("a")} ${b.str("b")} ${b.str("c")} 5`);
  b.step(6, "Three slices, three arrays, no aliasing.", "good");
  return { label: "Safe slicing & copy", code, frames: b.frames };
}

export default function GoSlices() {
  const scenarios = useMemo(() => [growth(), sharing(), safe()], []);
  const [idx, setIdx] = useState("0");
  const sc = scenarios[Number(idx)];
  const s = useStepper(sc.frames, 1600);
  const f = s.frame;
  const live = f.arrays.filter((a) => !a.dead || f.hot.some((h) => h.startsWith(`${a.id}:`)));
  const shown = [...live, ...f.arrays.filter((a) => a.dead && !live.includes(a))];

  return (
    <div className="space-y-4">
      <Segmented value={idx} onChange={setIdx} options={scenarios.map((x, i) => ({ value: String(i), label: x.label }))} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <pre className="min-w-0 overflow-x-auto rounded-xl border border-line bg-[#f8fafc] py-2 font-mono text-[12px] leading-[1.7]">
          {sc.code.split("\n").map((ln, i) => (
            <div key={i} className={clsx("flex pr-3", f.line === i + 1 && "bg-amber/15")} style={f.line === i + 1 ? { boxShadow: `inset 3px 0 0 ${C.compare}` } : undefined}>
              <span className="w-7 shrink-0 pr-2 text-right text-faint select-none">{i + 1}</span>
              <span className="whitespace-pre text-[#334155]">{ln}</span>
            </div>
          ))}
        </pre>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {f.slices.map((sl) => (
              <div key={sl.name} className="rounded-lg border-2 px-2 py-1 font-mono text-[11px]" style={{ borderColor: COLORS[sl.name], background: `${COLORS[sl.name]}10` }}>
                <b style={{ color: COLORS[sl.name] }}>{sl.name}</b> {"{"}ptr: {sl.arr}[{sl.off}], len: {sl.len}, cap: {sl.cap}
                {"}"}
              </div>
            ))}
          </div>
          {shown.map((a) => {
            const users = f.slices.filter((sl) => sl.arr === a.id);
            return (
              <div key={a.id} className={clsx("rounded-xl border border-line bg-panel p-3", a.dead && "opacity-45")}>
                <div className="mb-1.5 flex justify-between text-[10px] font-semibold tracking-wider text-faint uppercase">
                  <span>
                    backing array {a.id} · {a.cells.length} slots
                  </span>
                  {a.dead && <span>unreferenced → GC</span>}
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${a.cells.length}, 2.4rem)` }}>
                    {a.cells.map((c, i) => {
                      const hot = f.hot.includes(`${a.id}:${i}`);
                      return (
                        <div key={i} className="text-center">
                          <div
                            className={clsx("grid h-9 place-items-center rounded-md border-2 font-mono text-sm font-semibold transition", hot && "scale-110")}
                            style={{ borderColor: hot ? C.compare : C.base, background: hot ? `${C.compare}22` : c === null ? "#f8fafc" : "#fff", color: c === null ? C.faint : C.text }}
                          >
                            {c === null ? "·" : c}
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] text-faint">{i}</div>
                        </div>
                      );
                    })}
                    {users.map((sl, k) => (
                      <div key={sl.name} className="relative h-6" style={{ gridColumn: `${sl.off + 1} / span ${sl.cap}`, gridRow: 2 + k }}>
                        <div className="absolute inset-x-0 top-3.5 flex h-2">
                          <div className="h-full rounded-l-full" style={{ width: `${(sl.len / sl.cap) * 100}%`, background: COLORS[sl.name], borderRadius: sl.len === sl.cap ? 999 : undefined }} />
                          <div className="h-full flex-1 rounded-r-full border-2 border-dashed" style={{ borderColor: COLORS[sl.name], display: sl.len === sl.cap ? "none" : undefined }} />
                        </div>
                        <span className="absolute top-0 left-0.5 font-mono text-[10px] leading-none font-bold" style={{ color: COLORS[sl.name] }}>
                          {sl.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-3 text-[11px] text-dim">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-6 rounded-full bg-cyan" /> len (visible elements)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-6 rounded-full border-2 border-dashed border-cyan" /> spare cap (append room)
            </span>
          </div>
        </div>
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      {f.out.length > 0 && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0f172a] px-3 py-2 font-mono text-[12px] text-[#e2e8f0]">
          {f.out.map((o, i) => (
            <div key={i}>{o}</div>
          ))}
        </div>
      )}
      <StepControls s={s} />
    </div>
  );
}
