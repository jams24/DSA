"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Segmented } from "../kit";

type Op = "and" | "or" | "xor" | "shl" | "shr";
const OPS: { value: Op; label: string }[] = [
  { value: "and", label: "a & b" },
  { value: "or", label: "a | b" },
  { value: "xor", label: "a ^ b" },
  { value: "shl", label: "a << 1" },
  { value: "shr", label: "a >> 1" },
];

function BitRow({ value, label, onToggle, color, highlight }: { value: number; label: string; onToggle?: (bit: number) => void; color: string; highlight?: number[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-right font-mono text-xs text-dim">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 8 }, (_, k) => {
          const bit = 7 - k;
          const on = (value >> bit) & 1;
          const hi = highlight?.includes(bit);
          return (
            <button
              key={bit}
              type="button"
              disabled={!onToggle}
              onClick={() => onToggle?.(bit)}
              className={clsx("grid h-10 w-9 place-items-center rounded-md border-2 font-mono text-sm font-bold transition", onToggle && "hover:scale-105")}
              style={{
                borderColor: hi ? C.compare : on ? color : C.dim,
                background: on ? `${color}2a` : "transparent",
                color: on ? color : C.faint,
                boxShadow: hi ? `0 0 10px ${C.compare}` : undefined,
              }}
              aria-label={`bit ${bit}`}
            >
              {on}
            </button>
          );
        })}
      </div>
      <span className="w-12 font-mono text-sm text-ink tabular-nums">{value}</span>
    </div>
  );
}

export default function Bits() {
  const [a, setA] = useState(44);
  const [b, setB] = useState(25);
  const [op, setOp] = useState<Op>("xor");
  const res = op === "and" ? a & b : op === "or" ? a | b : op === "xor" ? a ^ b : op === "shl" ? (a << 1) & 255 : a >> 1;

  const lowest = a & -a;
  const steps: number[] = [];
  for (let x = a; x; x &= x - 1) steps.push(x);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented value={op} onChange={setOp} options={OPS} />
          <span className="text-xs text-faint">Click any bit to flip it.</span>
        </div>
        <div className="space-y-2 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-3 pl-[92px] font-mono text-[10px] text-faint">
            {Array.from({ length: 8 }, (_, k) => (
              <span key={k} className="w-9 text-center">
                2^{7 - k}
              </span>
            ))}
          </div>
          <BitRow value={a} label="a" color={C.active} onToggle={(bit) => setA((v) => v ^ (1 << bit))} />
          {(op === "and" || op === "or" || op === "xor") && <BitRow value={b} label="b" color={C.pivot} onToggle={(bit) => setB((v) => v ^ (1 << bit))} />}
          <div className="ml-[92px] h-px w-[316px] bg-line-2" />
          <BitRow value={res} label={OPS.find((o) => o.value === op)!.label} color={C.done} />
        </div>
        <p className="mt-3 text-xs text-dim">
          {op === "and" && "AND keeps a bit only if both are 1 — use it to test or clear bits (masking)."}
          {op === "or" && "OR sets a bit if either is 1 — use it to turn flags on."}
          {op === "xor" && "XOR is 1 where bits differ. x ^ x = 0 and x ^ 0 = x, so XOR-ing a list cancels pairs (Single Number)."}
          {op === "shl" && "Left shift multiplies by 2 (bits beyond the width fall off)."}
          {op === "shr" && "Right shift divides by 2, rounding down."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-2 font-display text-sm font-semibold text-ink">Tricks on a = {a}</div>
          <ul className="space-y-1.5 font-mono text-xs text-dim">
            <li>
              power of two? <span className="text-ink">a &gt; 0 &amp;&amp; (a &amp; (a−1)) == 0</span> → <span className={a > 0 && (a & (a - 1)) === 0 ? "text-emerald" : "text-rose"}>{String(a > 0 && (a & (a - 1)) === 0)}</span>
            </li>
            <li>
              lowest set bit <span className="text-ink">a &amp; −a</span> = <span className="text-amber">{lowest}</span>
            </li>
            <li>
              is bit 3 set? <span className="text-ink">(a &gt;&gt; 3) &amp; 1</span> = <span className="text-amber">{(a >> 3) & 1}</span>
            </li>
            <li>
              set bit 0 <span className="text-ink">a | 1</span> = {a | 1} · clear bit 2 <span className="text-ink">a &amp; ~4</span> = {a & ~4}
            </li>
            <li>
              popcount = <span className="text-amber">{steps.length}</span>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-2 font-display text-sm font-semibold text-ink">Brian Kernighan: x &amp;= x − 1 drops the lowest 1-bit</div>
          <div className="space-y-1 font-mono text-xs">
            {steps.map((x, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-5 text-faint">{i + 1}.</span>
                <span className="tracking-widest text-cyan">{x.toString(2).padStart(8, "0")}</span>
                <span className="text-faint">= {x}</span>
              </div>
            ))}
            <div className="flex gap-3">
              <span className="w-5 text-faint">✓</span>
              <span className="tracking-widest text-emerald">00000000</span>
              <span className="text-faint">→ {steps.length} set bits, one loop per 1-bit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
