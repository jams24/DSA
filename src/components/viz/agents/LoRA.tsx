"use client";

import { useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

type Size = "1b" | "8b" | "70b";
type Target = "qv" | "attn" | "all";

// Llama-3-style shapes: layers, hidden size, MLP size, K/V projection width (grouped-query attention)
const MODELS: Record<Size, { label: string; layers: number; d: number; ffn: number; kv: number; params: number }> = {
  "1b": { label: "1B", layers: 16, d: 2048, ffn: 8192, kv: 512, params: 1.24e9 },
  "8b": { label: "8B", layers: 32, d: 4096, ffn: 14336, kv: 1024, params: 8.03e9 },
  "70b": { label: "70B", layers: 80, d: 8192, ffn: 28672, kv: 1024, params: 70.6e9 },
};
const RANKS = [4, 8, 16, 32, 64, 128, 256];
const GB = 1e9;

function loraParams(size: Size, target: Target, r: number) {
  const { layers, d, ffn, kv } = MODELS[size];
  const q = r * (d + d);
  const k = r * (d + kv);
  const v = r * (d + kv);
  const o = r * (d + d);
  const mlp = 3 * r * (d + ffn); // gate, up, down
  const perLayer = target === "qv" ? q + v : target === "attn" ? q + k + v + o : q + k + v + o + mlp;
  return perLayer * layers;
}

export default function LoRA() {
  const [size, setSize] = useState<Size>("8b");
  const [target, setTarget] = useState<Target>("all");
  const [ri, setRi] = useState(2);
  const r = RANKS[ri];
  const m = MODELS[size];
  const trainable = loraParams(size, target, r);
  const full = (m.params * 16) / GB; // bf16 weights + grads, fp32 master copy + Adam moments
  const lora = (m.params * 2 + trainable * 16) / GB;
  const qlora = (m.params * 0.55 + trainable * 16) / GB; // NF4 weights + quantization constants
  const rows = [
    { name: "Full fine-tune (AdamW, mixed precision)", gb: full, color: C.bad },
    { name: "LoRA (frozen bf16 base)", gb: lora, color: C.compare },
    { name: "QLoRA (frozen 4-bit base)", gb: qlora, color: C.done },
  ];
  const maxGb = Math.max(full, 90);
  const pct = (gb: number) => Math.min(100, (gb / maxGb) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Segmented value={size} onChange={setSize} options={(Object.keys(MODELS) as Size[]).map((k) => ({ value: k, label: `Llama-style ${MODELS[k].label}` }))} />
        <Segmented
          value={target}
          onChange={setTarget}
          options={[
            { value: "qv", label: "q, v only" },
            { value: "attn", label: "all attention" },
            { value: "all", label: "all linear layers" },
          ]}
        />
      </div>
      <Slider label="LoRA rank r" value={ri} min={0} max={RANKS.length - 1} onChange={setRi} format={(i) => `r = ${RANKS[i]}`} />

      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs text-dim">
          <div className="grid h-24 w-24 place-items-center rounded-lg border-2 border-line-2 bg-panel-3 text-center">
            W<br />
            <span className="text-[10px] text-faint">
              {m.d}×{m.d}
              <br />
              frozen
            </span>
          </div>
          <span className="text-lg text-ink">+</span>
          <div className="grid h-24 place-items-center rounded-lg border-2 text-center" style={{ width: Math.max(10, Math.min(40, r / 4)), borderColor: C.done, background: `${C.done}1a` }}>
            <span className="text-[10px]" style={{ color: C.done }}>
              B
            </span>
          </div>
          <span className="text-ink">·</span>
          <div className="grid w-24 place-items-center rounded-lg border-2 text-center" style={{ height: Math.max(10, Math.min(40, r / 4)), borderColor: C.done, background: `${C.done}1a` }}>
            <span className="text-[10px]" style={{ color: C.done }}>
              A
            </span>
          </div>
          <span className="max-w-[16rem] text-[11px] leading-snug">
            W&apos; = W + (α/r)·B·A, where B is {m.d}×{r} and A is {r}×{m.d}. Only A and B train: {(2 * m.d * r).toLocaleString()} values instead of {(m.d * m.d).toLocaleString()} for this one matrix.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="trainable params" value={trainable >= 1e9 ? `${(trainable / 1e9).toFixed(2)}B` : `${(trainable / 1e6).toFixed(1)}M`} color={C.done} />
        <Stat label="% of the model" value={`${((trainable / m.params) * 100).toFixed(2)}%`} />
        <Stat label="adapter file (bf16)" value={`${((trainable * 2) / 1e6).toFixed(0)} MB`} color={C.active} />
        <Stat label="full checkpoint (bf16)" value={`${((m.params * 2) / GB).toFixed(0)} GB`} color={C.faint} />
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-panel p-4">
        <div className="text-[11px] font-semibold tracking-wide text-faint uppercase">GPU memory for weights + gradients + optimizer (before activations)</div>
        {rows.map((row) => (
          <div key={row.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs sm:grid-cols-[230px_1fr_70px]">
            <span className="text-ink">{row.name}</span>
            <span className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1">
              <span className="block h-full rounded-full" style={{ width: `${pct(row.gb)}%`, background: row.color }} />
            </span>
            <span className="text-right font-mono text-dim">{row.gb >= 100 ? row.gb.toFixed(0) : row.gb.toFixed(1)} GB</span>
          </div>
        ))}
        <div className="pt-1 text-[11px] text-faint">
          Fits on: 24 GB consumer GPU → {rows.filter((x) => x.gb < 20).map((x) => x.name.split(" (")[0]).join(", ") || "none"} · 80 GB H100 → {rows.filter((x) => x.gb < 70).map((x) => x.name.split(" (")[0]).join(", ") || "none"} (leaving room for activations)
        </div>
      </div>
      <Narration tone="info">
        Full fine-tuning needs ~16 bytes per parameter (weights, gradients, an fp32 master copy and two Adam moments), so {m.label} needs ~{full.toFixed(0)} GB before activations, spread across several GPUs. LoRA freezes the base and trains small low-rank adapters, so optimizer state shrinks to almost nothing, and QLoRA also stores the frozen base in 4-bit. Adapters are tiny files, and one server can host hundreds of them on a single base model (multi-LoRA serving). Rank 8–64 on all linear layers is a common default. Quality depends far more on your data than on r.
      </Narration>
    </div>
  );
}
