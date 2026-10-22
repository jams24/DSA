"use client";

import { useState } from "react";
import { C, Narration, Segmented, Slider } from "../kit";

type Mode = "data" | "tensor" | "pipeline" | "expert";
const GPU_COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d"];

function Gpu({ i, children, label }: { i: number; children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-xl border-2 bg-[#ffffff] p-2" style={{ borderColor: `${GPU_COLORS[i]}88` }}>
      <div className="mb-1.5 flex justify-between font-mono text-[10px]" style={{ color: GPU_COLORS[i] }}>
        <span>🧮 GPU {i}</span>
        <span className="text-faint">{label}</span>
      </div>
      {children}
    </div>
  );
}

const Layer = ({ label, color, faded }: { label: string; color: string; faded?: boolean }) => (
  <div className="rounded px-1.5 py-1 text-center font-mono text-[9.5px]" style={{ background: `${color}${faded ? "12" : "33"}`, color: faded ? C.faint : C.text, border: `1px solid ${color}${faded ? "22" : "66"}` }}>
    {label}
  </div>
);

export default function Parallelism() {
  const [mode, setMode] = useState<Mode>("tensor");
  const [micro, setMicro] = useState(4);
  const stages = 4;
  const T = micro + stages - 1;
  const bubble = (stages - 1) / (micro + stages - 1);

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "data", label: "Data parallel" },
          { value: "tensor", label: "Tensor parallel" },
          { value: "pipeline", label: "Pipeline parallel" },
          { value: "expert", label: "Expert parallel (MoE)" },
        ]}
      />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((g) => (
          <Gpu key={g} i={g} label={mode === "data" ? `requests ${g * 8}–${g * 8 + 7}` : mode === "pipeline" ? `stage ${g + 1}` : mode === "tensor" ? "¼ of every matrix" : `experts ${g * 2}, ${g * 2 + 1}`}>
            <div className="space-y-1">
              {Array.from({ length: 8 }, (_, l) => {
                if (mode === "data") return <Layer key={l} label={`layer ${l + 1} (full)`} color={GPU_COLORS[g]} />;
                if (mode === "pipeline") return <Layer key={l} label={`layer ${l + 1}`} color={GPU_COLORS[g]} faded={Math.floor(l / 2) !== g} />;
                if (mode === "tensor") return <Layer key={l} label={`layer ${l + 1} · cols ${g + 1}/4`} color={GPU_COLORS[g]} />;
                return <Layer key={l} label={l % 2 === 0 ? `attn ${Math.floor(l / 2) + 1} (replicated)` : `MoE: E${g * 2} E${g * 2 + 1}`} color={l % 2 === 0 ? "#64748b" : GPU_COLORS[g]} />;
              })}
            </div>
          </Gpu>
        ))}
      </div>

      {mode === "pipeline" && (
        <div className="space-y-2 rounded-xl border border-line bg-[#f8fafd] p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span className="text-xs text-dim">Forward-pass schedule (GPipe-style): micro-batches flow through 4 stages</span>
            <div className="w-44">
              <Slider label="micro-batches" value={micro} min={1} max={12} onChange={setMicro} />
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            {Array.from({ length: stages }, (_, st) => (
              <div key={st} className="flex gap-[2px] py-[1px]">
                <span className="w-14 shrink-0 font-mono text-[9px] leading-6 text-faint">stage {st + 1}</span>
                {Array.from({ length: T }, (_, t) => {
                  const m = t - st;
                  const busy = m >= 0 && m < micro;
                  return (
                    <div key={t} className="grid h-6 w-7 shrink-0 place-items-center rounded-[3px] font-mono text-[9px]" style={{ background: busy ? GPU_COLORS[st] : "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px)", color: "#ffffff" }}>
                      {busy ? `m${m + 1}` : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="font-mono text-xs" style={{ color: bubble > 0.3 ? C.bad : C.done }}>
            bubble (idle) fraction = (p − 1) / (m + p − 1) = {(bubble * 100).toFixed(0)}%
          </div>
        </div>
      )}

      <Narration>
        {mode === "data" && "Data parallelism: every GPU holds a full copy of the model and serves different requests (inference replicas) or different batch shards (training, then all-reduce gradients). Simple and scales throughput — but only works if the whole model fits on one GPU. ZeRO/FSDP shard optimizer state and weights to stretch it for training."}
        {mode === "tensor" && "Tensor parallelism (Megatron-LM): each weight matrix is split across GPUs (columns for the first matmul, rows for the second), every GPU computes part of every layer, and an all-reduce combines results after each block. Cuts per-GPU memory AND per-token latency, but needs very fast interconnect (NVLink) — usually kept within one node (TP = 2–8)."}
        {mode === "pipeline" && "Pipeline parallelism: consecutive layers live on different GPUs (stages) and activations flow stage to stage. Little communication (only activations between neighbours) so it works across nodes — but stages idle while the pipeline fills and drains (the 'bubble'). More micro-batches shrink the bubble; interleaved schedules (1F1B) help in training."}
        {mode === "expert" && "Mixture-of-Experts: each MoE layer has many expert FFNs, and a router sends each token to its top-k (e.g. 2 of 8). Experts are spread across GPUs and tokens are exchanged with all-to-all communication. Total parameters are huge (Mixtral 8×7B ≈ 47B) but each token only activates ~13B, so compute per token stays small — memory still has to hold every expert."}
      </Narration>
    </div>
  );
}
