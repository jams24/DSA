"use client";

import { useState } from "react";
import { C, Narration, Slider, Stat } from "../kit";

// H100 SXM, dense BF16
const PEAK = 989; // TFLOP/s
const BW = 3.35; // TB/s
const RIDGE = PEAK / BW; // FLOP per byte

export default function Roofline() {
  const [batch, setBatch] = useState(1);
  const [prompt, setPrompt] = useState(1024);

  // For a dense model with FP16 weights: FLOPs ≈ 2·P·tokens, bytes ≈ 2·P (weights read once per forward)
  // → arithmetic intensity ≈ tokens processed per forward pass.
  const decodeAI = batch;
  const prefillAI = prompt;
  const perf = (ai: number) => Math.min(PEAK, BW * ai);
  const W = 620;
  const H = 280;
  const xLog = (ai: number) => 50 + ((Math.log10(ai) - 0) / 5) * (W - 70); // AI from 1 to 1e5
  const yLog = (tf: number) => H - 30 - ((Math.log10(tf) - 0) / 3.2) * (H - 50); // 1 .. ~1600 TFLOPs
  const roof = Array.from({ length: 101 }, (_, i) => {
    const ai = 10 ** ((i / 100) * 5);
    return `${xLog(ai)},${yLog(perf(ai))}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <Slider label="decode batch size" value={batch} min={1} max={512} onChange={setBatch} />
        </div>
        <div className="w-56">
          <Slider label="prompt length (prefill)" value={Math.log2(prompt)} min={6} max={14} onChange={(v) => setPrompt(2 ** v)} format={() => prompt.toLocaleString()} />
        </div>
      </div>
      <div className="rounded-xl border border-line bg-[#f8fafd] p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {[1, 10, 100, 1000].map((tf) => (
            <g key={tf}>
              <line x1={50} x2={W - 20} y1={yLog(tf)} y2={yLog(tf)} stroke="#e9eef5" />
              <text x={44} y={yLog(tf) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
                {tf}
              </text>
            </g>
          ))}
          {[1, 10, 100, 1000, 10000, 100000].map((ai) => (
            <g key={ai}>
              <line x1={xLog(ai)} x2={xLog(ai)} y1={20} y2={H - 30} stroke="#e9eef5" />
              <text x={xLog(ai)} y={H - 16} textAnchor="middle" fontSize="9" fill={C.faint}>
                {ai >= 1000 ? `${ai / 1000}k` : ai}
              </text>
            </g>
          ))}
          <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="10" fill={C.muted}>
            arithmetic intensity (FLOPs per byte moved from HBM)
          </text>
          <text x={12} y={H / 2} fontSize="10" fill={C.muted} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">
            TFLOP/s
          </text>
          <polyline points={roof} fill="none" stroke={C.compare} strokeWidth={2.5} />
          <line x1={xLog(RIDGE)} x2={xLog(RIDGE)} y1={yLog(PEAK)} y2={H - 30} stroke={C.compare} strokeDasharray="4 4" opacity={0.5} />
          <text x={xLog(RIDGE) + 4} y={yLog(PEAK) + 14} fontSize="9" fill={C.compare}>
            ridge ≈ {Math.round(RIDGE)} FLOP/B
          </text>
          <text x={xLog(3)} y={yLog(perf(3)) - 10} fontSize="9.5" fill={C.compare} transform={`rotate(-38 ${xLog(3)} ${yLog(perf(3)) - 10})`}>
            memory-bound: {BW} TB/s × AI
          </text>
          <text x={xLog(3000)} y={yLog(PEAK) - 6} fontSize="9.5" fill={C.compare}>
            compute-bound: {PEAK} TFLOP/s
          </text>
          {[
            { ai: decodeAI, c: C.swap, l: `decode, batch ${batch}` },
            { ai: prefillAI, c: C.active, l: `prefill, ${prompt} tokens` },
          ].map((p) => (
            <g key={p.l}>
              <circle cx={xLog(Math.min(1e5, p.ai))} cy={yLog(perf(p.ai))} r={7} fill={p.c} style={{ filter: `drop-shadow(0 0 6px ${p.c})` }} />
              <text x={xLog(Math.min(1e5, p.ai)) + 10} y={yLog(perf(p.ai)) + 16} fontSize="10" fill={p.c}>
                {p.l}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="decode: achievable TFLOP/s" value={perf(decodeAI).toFixed(0)} color={C.swap} />
        <Stat label="decode: % of peak compute" value={`${((perf(decodeAI) / PEAK) * 100).toFixed(1)}%`} color={decodeAI < RIDGE ? C.bad : C.done} />
        <Stat label="prefill: achievable TFLOP/s" value={perf(prefillAI).toFixed(0)} color={C.active} />
        <Stat label="bound" value={decodeAI < RIDGE ? "decode is memory-bound" : "decode is compute-bound"} color={C.compare} />
      </div>
      <Narration tone={decodeAI < RIDGE ? "warn" : "good"}>
        Roofline model for an H100: performance = min(peak compute, bandwidth × arithmetic intensity). A forward pass reads every weight once; with FP16 weights it does ~2 FLOPs per weight per token, so intensity ≈ number of tokens
        processed together. Decoding one sequence processes 1 token → ~1 FLOP/byte → the GPU idles waiting on memory ({((BW / PEAK) * 100).toFixed(1)}% of peak). Batching more sequences moves decode right toward the ridge — that&apos;s why
        batching (and quantization, which cuts bytes) dominates inference throughput, while prefill is already compute-bound.
      </Narration>
    </div>
  );
}
