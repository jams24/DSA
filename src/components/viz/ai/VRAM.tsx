"use client";

import { useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

const MODELS = {
  "llama2-7b": { label: "Llama-2-7B", params: 6.74, layers: 32, heads: 32, kv: 32, dim: 128 },
  "llama3-8b": { label: "Llama-3-8B", params: 8.03, layers: 32, heads: 32, kv: 8, dim: 128 },
  "mixtral": { label: "Mixtral 8×7B", params: 46.7, layers: 32, heads: 32, kv: 8, dim: 128 },
  "llama3-70b": { label: "Llama-3-70B", params: 70.6, layers: 80, heads: 64, kv: 8, dim: 128 },
} as const;
type ModelId = keyof typeof MODELS;

const GPUS = [
  { name: "L4", mem: 24, bw: 0.3 },
  { name: "RTX 4090", mem: 24, bw: 1.0 },
  { name: "A100 80GB", mem: 80, bw: 2.0 },
  { name: "H100 80GB", mem: 80, bw: 3.35 },
  { name: "H200", mem: 141, bw: 4.8 },
];

const WBYTES = { fp16: 2, int8: 1, int4: 0.5 } as const;

export default function VRAM() {
  const [model, setModel] = useState<ModelId>("llama3-8b");
  const [wq, setWq] = useState<keyof typeof WBYTES>("fp16");
  const [kvBytes, setKvBytes] = useState<2 | 1>(2);
  const [ctx, setCtx] = useState(8192);
  const [batch, setBatch] = useState(8);
  const m = MODELS[model];

  const weightsGB = m.params * WBYTES[wq];
  const kvPerToken = 2 * m.layers * m.kv * m.dim * kvBytes; // bytes
  const kvGB = (kvPerToken * ctx * batch) / 1e9;
  const overhead = 0.1 * (weightsGB + kvGB) + 1;
  const total = weightsGB + kvGB + overhead;
  const mha = (2 * m.layers * m.heads * m.dim * kvBytes * ctx * batch) / 1e9;
  const h100 = GPUS[3];
  // decode upper bound: each step streams the weights once (shared by the batch) + each sequence's KV
  const tokPerSec = (h100.bw * 1000) / (weightsGB + kvGB);
  const perSeq = tokPerSec;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented value={model} onChange={setModel} options={Object.entries(MODELS).map(([value, x]) => ({ value: value as ModelId, label: x.label }))} />
        <Segmented
          value={wq}
          onChange={setWq}
          options={[
            { value: "fp16", label: "Weights FP16" },
            { value: "int8", label: "INT8/FP8" },
            { value: "int4", label: "INT4" },
          ]}
        />
        <Segmented
          value={String(kvBytes) as "2" | "1"}
          onChange={(v) => setKvBytes(Number(v) as 2 | 1)}
          options={[
            { value: "2", label: "KV FP16" },
            { value: "1", label: "KV FP8" },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="w-60">
          <Slider label="context length (tokens)" value={Math.log2(ctx)} min={10} max={17} onChange={(v) => setCtx(2 ** v)} format={() => ctx.toLocaleString()} />
        </div>
        <div className="w-52">
          <Slider label="concurrent sequences" value={batch} min={1} max={64} onChange={setBatch} />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="flex h-8 overflow-hidden rounded-lg bg-line">
          {[
            { v: weightsGB, c: C.pivot, l: "weights" },
            { v: kvGB, c: C.active, l: "KV cache" },
            { v: overhead, c: C.faint, l: "activations/overhead" },
          ].map((seg) => (
            <div key={seg.l} className="h-full transition-all duration-500" style={{ width: `${(seg.v / total) * 100}%`, background: seg.c }} title={`${seg.l}: ${seg.v.toFixed(1)} GB`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-dim">
          <span>
            <span style={{ color: C.pivot }}>■</span> weights {weightsGB.toFixed(1)} GB
          </span>
          <span>
            <span style={{ color: C.active }}>■</span> KV cache {kvGB.toFixed(1)} GB
          </span>
          <span>
            <span style={{ color: C.faint }}>■</span> overhead {overhead.toFixed(1)} GB
          </span>
          <span className="ml-auto font-mono text-ink">total ≈ {total.toFixed(1)} GB</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-5">
          {GPUS.map((g) => {
            const n = Math.ceil(total / (g.mem * 0.92));
            return (
              <div key={g.name} className="rounded-lg border px-2 py-1.5 text-center" style={{ borderColor: n === 1 ? `${C.done}66` : "#e2e8f0" }}>
                <div className="text-[11px] text-ink">{g.name}</div>
                <div className="font-mono text-xs" style={{ color: n === 1 ? C.done : n <= 2 ? C.compare : C.bad }}>
                  {n === 1 ? "fits on 1" : `needs ${n}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="KV per token" value={`${(kvPerToken / 1024).toFixed(0)} KB`} color={C.active} />
        <Stat label={`KV if no GQA (${m.heads} KV heads)`} value={`${mha.toFixed(1)} GB`} color={m.kv < m.heads ? C.bad : C.muted} />
        <Stat label="H100 decode ceiling / seq" value={`~${Math.round(perSeq)} tok/s`} color={C.compare} />
        <Stat label="H100 aggregate ceiling" value={`~${Math.round(perSeq * batch).toLocaleString()} tok/s`} color={C.done} />
      </div>
      <Narration>
        KV cache per token = 2 (K and V) × layers × KV heads × head dim × bytes = 2 × {m.layers} × {m.kv} × {m.dim} × {kvBytes} B. It grows linearly with context length AND with the number of concurrent sequences — at long context it
        dwarfs the weights. {m.kv < m.heads ? `This model uses grouped-query attention (${m.kv} KV heads for ${m.heads} query heads), shrinking the cache ${m.heads / m.kv}×.` : "Llama-2-7B uses full multi-head attention: one K/V per query head."} Decode
        speed is bounded by memory bandwidth: every step must read the weights plus each sequence&apos;s KV cache from HBM.
      </Narration>
    </div>
  );
}
