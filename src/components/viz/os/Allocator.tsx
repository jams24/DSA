"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, SmallBtn, Stat } from "../kit";

// A 1 KiB heap made of 64 units of 16 bytes. Allocate and free blocks with first, best or worst fit,
// watch splitting and coalescing, and see external fragmentation make a big request fail.
type Policy = "first" | "best" | "worst";
interface Block {
  start: number;
  size: number; // in 16-byte units
  id: string | null;
}
const UNITS = 64;
const UNIT = 16;
const COLORS = [C.active, C.pivot, C.compare, C.swap, C.lime, C.sky, C.orange];
const POLICIES: { value: Policy; label: string; how: string }[] = [
  { value: "first", label: "First fit", how: "takes the FIRST hole that's big enough" },
  { value: "best", label: "Best fit", how: "takes the SMALLEST hole that's big enough" },
  { value: "worst", label: "Worst fit", how: "takes the BIGGEST hole" },
];

function choose(heap: Block[], size: number, policy: Policy): number {
  const fits = heap.map((b, i) => ({ b, i })).filter(({ b }) => b.id === null && b.size >= size);
  if (!fits.length) return -1;
  if (policy === "first") return fits[0].i;
  const pick = fits.reduce((a, x) => (policy === "best" ? (x.b.size < a.b.size ? x : a) : x.b.size > a.b.size ? x : a));
  return pick.i;
}

function alloc(heap: Block[], size: number, id: string, policy: Policy): Block[] | null {
  const i = choose(heap, size, policy);
  if (i < 0) return null;
  const b = heap[i];
  const parts: Block[] = [{ start: b.start, size, id }];
  if (b.size > size) parts.push({ start: b.start + size, size: b.size - size, id: null }); // split
  return [...heap.slice(0, i), ...parts, ...heap.slice(i + 1)];
}

function free(heap: Block[], id: string): Block[] {
  const marked = heap.map((b) => (b.id === id ? { ...b, id: null } : b));
  const merged: Block[] = [];
  for (const b of marked) {
    const last = merged.at(-1);
    if (last && last.id === null && b.id === null) merged[merged.length - 1] = { ...last, size: last.size + b.size }; // coalesce
    else merged.push({ ...b });
  }
  return merged;
}

const holes = (heap: Block[]) => heap.filter((b) => b.id === null);
const fresh = (): Block[] => [{ start: 0, size: UNITS, id: null }];

// the same workload for every policy: a fixed pseudo-random mix of allocations and frees
function workload(policy: Policy) {
  let heap = fresh();
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const live: string[] = [];
  let failed = 0;
  for (let k = 0; k < 200; k++) {
    if (live.length && rnd() < 0.45) {
      const idx = Math.floor(rnd() * live.length);
      heap = free(heap, live[idx]);
      live.splice(idx, 1);
    } else {
      const size = 1 + Math.floor(rnd() * rnd() * 14);
      const next = alloc(heap, size, `w${k}`, policy);
      if (next) {
        heap = next;
        live.push(`w${k}`);
      } else failed++;
    }
  }
  return { failed, holes: holes(heap).length, largest: Math.max(0, ...holes(heap).map((h) => h.size)) * UNIT };
}

export default function Allocator() {
  const [policy, setPolicy] = useState<Policy>("first");
  const [heap, setHeap] = useState<Block[]>(fresh);
  const [size, setSize] = useState(6);
  const [next, setNext] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "An empty 1 KiB heap (64 slots of 16 bytes). Pick a size and press Allocate, then free some blocks to make holes.",
    tone: "info",
  });
  const compare = useMemo(() => POLICIES.map((p) => ({ ...p, ...workload(p.value) })), []);
  const free_ = holes(heap);
  const totalFree = free_.reduce((x, b) => x + b.size, 0);
  const largest = Math.max(0, ...free_.map((b) => b.size));
  const colorOf = (id: string) => COLORS[(id.charCodeAt(0) - 65) % COLORS.length];

  const doAlloc = (units: number, h = heap, n = next, p = policy): { heap: Block[]; n: number } => {
    const id = String.fromCharCode(65 + (n % 26)) + (n >= 26 ? String(Math.floor(n / 26)) : "");
    const r = alloc(h, units, id, p);
    if (!r) {
      setMsg({
        text:
          totalFreeOf(h) >= units
            ? `malloc(${units * UNIT}) FAILED, even though ${totalFreeOf(h) * UNIT} bytes are free in total: the largest hole is only ${largestOf(h) * UNIT} bytes. That's external fragmentation.`
            : `malloc(${units * UNIT}) FAILED: only ${totalFreeOf(h) * UNIT} bytes are free. The heap is simply full.`,
        tone: "bad",
      });
      return { heap: h, n };
    }
    const b = r.find((x) => x.id === id)!;
    const hole = h.find((x) => x.start === b.start)!;
    setMsg({
      text: `malloc(${units * UNIT}) → block ${id} at byte ${b.start * UNIT}. ${POLICIES.find((x) => x.value === p)!.label} ${POLICIES.find((x) => x.value === p)!.how} (${hole.size * UNIT} bytes)${hole.size > units ? `, and SPLITS off the remaining ${(hole.size - units) * UNIT} bytes as a smaller hole.` : ", which fits exactly."}`,
      tone: "good",
    });
    setLast(id);
    return { heap: r, n: n + 1 };
  };
  const doFree = (id: string) => {
    const before = holes(heap).length;
    const r = free(heap, id);
    const merged = before + 1 - holes(r).length;
    setHeap(r);
    setLast(null);
    setMsg({
      text: `free(${id}) gives its ${heap.find((b) => b.id === id)!.size * UNIT} bytes back.${merged > 0 ? ` It COALESCES with ${merged} free neighbour${merged > 1 ? "s" : ""} into one bigger hole.` : " Its neighbours are in use, so it stays a separate hole."}`,
      tone: "info",
    });
  };
  const scenario = () => {
    // fill the heap with blocks, then free every other one: lots of holes, none big
    let h = fresh();
    let n = 0;
    for (const u of [8, 6, 8, 6, 8, 6, 8, 6, 8]) {
      const r = alloc(h, u, String.fromCharCode(65 + n), policy);
      if (r) h = r;
      n++;
    }
    for (const id of ["B", "D", "F", "H"]) h = free(h, id);
    setHeap(h);
    setNext(n);
    setLast(null);
    setSize(12);
    setMsg({
      text: `Swiss cheese: blocks A to I filled the heap, then B, D, F and H were freed. Now ${totalFreeOf(h) * UNIT} bytes are free, but in holes of at most ${largestOf(h) * UNIT}. Try to allocate 192 bytes.`,
      tone: "warn",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented value={policy} onChange={setPolicy} options={POLICIES.map(({ value, label }) => ({ value, label }))} />
        <div className="w-48">
          <Slider label="request size" value={size} min={1} max={24} onChange={setSize} format={(v) => `${v * UNIT} bytes`} />
        </div>
        <SmallBtn
          tone="primary"
          onClick={() => {
            const r = doAlloc(size);
            setHeap(r.heap);
            setNext(r.n);
          }}
        >
          malloc({size * UNIT})
        </SmallBtn>
        <SmallBtn onClick={scenario}>Make Swiss cheese</SmallBtn>
        <SmallBtn
          tone="danger"
          onClick={() => {
            setHeap(fresh());
            setNext(0);
            setLast(null);
            setMsg({ text: "Empty heap again.", tone: "info" });
          }}
        >
          Reset
        </SmallBtn>
      </div>

      <div>
        <div className="flex h-14 overflow-hidden rounded-xl border-2" style={{ borderColor: C.base }}>
          {heap.map((b) => (
            <div
              key={`${b.start}-${b.id}`}
              title={`${b.id ? `block ${b.id}` : "free"}: ${b.size * UNIT} bytes at ${b.start * UNIT}`}
              className="relative flex min-w-0 flex-col items-center justify-center border-r border-white/70 text-[10px] font-bold last:border-r-0"
              style={{
                width: `${(b.size / UNITS) * 100}%`,
                background: b.id ? colorOf(b.id) : `repeating-linear-gradient(45deg, #f8fafc, #f8fafc 4px, #e2e8f0 4px, #e2e8f0 8px)`,
                color: b.id ? "#ffffff" : C.muted,
                outline: b.id && b.id === last ? `3px solid ${C.text}` : undefined,
                outlineOffset: -3,
              }}
            >
              <span className="truncate">{b.id ?? (b.size >= 4 ? "free" : "")}</span>
              {b.size >= 3 && <span className="truncate font-mono font-normal opacity-80">{b.size * UNIT}</span>}
            </div>
          ))}
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[9px] text-faint">
          <span>0</span>
          <span>512</span>
          <span>1024 bytes</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-faint">allocated (click to free):</span>
        {heap.filter((b) => b.id).length === 0 && <span className="text-xs text-faint">none</span>}
        {heap
          .filter((b) => b.id)
          .map((b) => (
            <button key={b.id} className="rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white hover:opacity-80" style={{ background: colorOf(b.id!) }} onClick={() => doFree(b.id!)}>
              free({b.id}) ✕
            </button>
          ))}
      </div>

      <Narration tone={msg.tone}>{msg.text}</Narration>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="free in total" value={`${totalFree * UNIT} B`} color={C.done} />
        <Stat label="largest hole" value={`${largest * UNIT} B`} color={largest < totalFree ? C.compare : C.done} />
        <Stat label="holes" value={free_.length} color={free_.length > 2 ? C.bad : C.text} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              <th className="px-2 py-1.5 text-left">same 200 random mallocs and frees</th>
              {compare.map((c) => (
                <th key={c.value} className="px-2 py-1.5 text-left" style={{ color: c.value === policy ? C.active : undefined }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-t border-line">
              <td className="px-2 py-1 font-sans text-faint">failed requests</td>
              {compare.map((c) => (
                <td key={c.value} className="px-2 py-1" style={{ color: c.failed === Math.min(...compare.map((x) => x.failed)) ? C.done : C.bad }}>
                  {c.failed}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-1 font-sans text-faint">holes at the end</td>
              {compare.map((c) => (
                <td key={c.value} className="px-2 py-1">
                  {c.holes}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function totalFreeOf(h: Block[]) {
  return holes(h).reduce((x, b) => x + b.size, 0);
}
function largestOf(h: Block[]) {
  return Math.max(0, ...holes(h).map((b) => b.size));
}
