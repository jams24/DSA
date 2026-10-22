"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

function gaussian(rand: () => number) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const BASE = (() => {
  const rand = mulberry32(11);
  return Array.from({ length: 512 }, () => gaussian(rand) * 0.02);
})();

export default function Quantization() {
  const [bits, setBits] = useState(4);
  const [outlier, setOutlier] = useState(false);
  const [scheme, setScheme] = useState<"tensor" | "group">("tensor");
  const weights = useMemo(() => (outlier ? BASE.map((w, i) => (i === 100 ? 0.6 : i === 333 ? -0.45 : w)) : BASE), [outlier]);

  const { deq, mse, levelsUsed, scaleShown } = useMemo(() => {
    const qmax = 2 ** (bits - 1) - 1;
    const group = scheme === "tensor" ? weights.length : 64;
    const deq: number[] = [];
    const used = new Set<string>();
    let firstScale = 0;
    for (let g = 0; g < weights.length; g += group) {
      const chunk = weights.slice(g, g + group);
      const scale = Math.max(...chunk.map(Math.abs)) / qmax || 1;
      if (g === 0) firstScale = scale;
      for (const w of chunk) {
        const q = Math.max(-qmax - 1, Math.min(qmax, Math.round(w / scale)));
        used.add(`${g}:${q}`);
        deq.push(q * scale);
      }
    }
    const mse = weights.reduce((a, w, i) => a + (w - deq[i]) ** 2, 0) / weights.length;
    return { deq, mse, levelsUsed: used.size / Math.ceil(weights.length / group), scaleShown: firstScale };
  }, [weights, bits, scheme]);

  const signal = weights.reduce((a, w) => a + w * w, 0) / weights.length;
  const sqnr = 10 * Math.log10(signal / Math.max(mse, 1e-12));
  // histogram
  const lo = -0.08;
  const hi = 0.08;
  const BINS = 48;
  const hist = (arr: number[]) => {
    const h = Array(BINS).fill(0);
    for (const w of arr) {
      if (w < lo || w > hi) continue;
      h[Math.min(BINS - 1, Math.floor(((w - lo) / (hi - lo)) * BINS))]++;
    }
    return h;
  };
  const h1 = hist(weights);
  const h2 = hist(deq);
  const hmax = Math.max(...h1, ...h2);
  const qmax = 2 ** (bits - 1) - 1;
  const levels = scheme === "tensor" ? Array.from({ length: 2 * qmax + 2 }, (_, k) => (k - qmax - 1) * scaleShown).filter((v) => v >= lo && v <= hi) : [];

  const mem = (params: number, b: number) => `${((params * b) / 8).toFixed(params * b < 80 ? 1 : 0)} GB`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Slider label="bits per weight" value={bits} min={2} max={8} onChange={setBits} />
        </div>
        <Segmented
          value={scheme}
          onChange={setScheme}
          options={[
            { value: "tensor", label: "Per-tensor scale" },
            { value: "group", label: "Per-group scale (64)" },
          ]}
        />
        <Segmented
          value={outlier ? "y" : "n"}
          onChange={(v) => setOutlier(v === "y")}
          options={[
            { value: "n", label: "Normal weights" },
            { value: "y", label: "Add 2 outliers" },
          ]}
        />
      </div>
      <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
        <svg viewBox="0 0 600 190" className="block w-full">
          {levels.map((v, i) => (
            <line key={i} x1={20 + ((v - lo) / (hi - lo)) * 560} x2={20 + ((v - lo) / (hi - lo)) * 560} y1={10} y2={170} stroke={C.compare} strokeOpacity={0.35} strokeDasharray="2 3" />
          ))}
          {h1.map((c, i) => (
            <rect key={`a${i}`} x={20 + (i / BINS) * 560 + 1} y={170 - (c / hmax) * 150} width={560 / BINS - 2} height={(c / hmax) * 150} fill={C.sky} opacity={0.35} />
          ))}
          {h2.map((c, i) => (
            <rect key={`b${i}`} x={20 + (i / BINS) * 560 + 3} y={170 - (c / hmax) * 150} width={560 / BINS - 6} height={(c / hmax) * 150} fill={C.swap} opacity={0.85} />
          ))}
          <line x1={20} x2={580} y1={170} y2={170} stroke="#cbd5e1" />
          <text x={20} y={185} fontSize="10" fill={C.faint}>
            −0.08
          </text>
          <text x={300} y={185} fontSize="10" fill={C.faint} textAnchor="middle">
            0
          </text>
          <text x={580} y={185} fontSize="10" fill={C.faint} textAnchor="end">
            +0.08
          </text>
        </svg>
        <div className="flex gap-4 text-[10px] text-faint">
          <span>
            <span style={{ color: C.sky }}>■</span> original FP16 weights
          </span>
          <span>
            <span style={{ color: C.swap }}>■</span> after quantize → dequantize
          </span>
          {scheme === "tensor" && (
            <span>
              <span style={{ color: C.compare }}>┊</span> representable levels
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="levels actually used" value={Math.round(levelsUsed)} color={C.compare} />
        <Stat label="signal / quant noise (dB)" value={sqnr.toFixed(1)} color={sqnr > 20 ? C.done : sqnr > 10 ? C.compare : C.bad} />
        <Stat label="7B model weights" value={mem(7, bits)} color={C.sky} />
        <Stat label="70B model weights" value={mem(70, bits)} color={C.sky} />
      </div>
      <Narration tone={outlier && scheme === "tensor" ? "bad" : "info"}>
        {outlier && scheme === "tensor"
          ? "One outlier stretches the per-tensor scale, so nearly all normal weights collapse onto a couple of levels around zero — quality craters. That's why real methods use per-channel/per-group scales (GPTQ, AWQ), keep outliers in higher precision (LLM.int8), or rotate weights to spread outliers (QuaRot/SpinQuant)."
          : `Symmetric quantization: scale = max|w| / ${qmax}; q = round(w / scale) stored in ${bits} bits; dequantize as q × scale. Fewer bits = less memory and bandwidth (faster decode), more rounding noise. INT8 is nearly lossless for most LLMs; 4-bit with group scales is the popular sweet spot.`}
      </Narration>
    </div>
  );
}
