"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { hashString, mulberry32 } from "@/lib/random";
import { C, Narration, Segmented, Slider, Stat, StepControls, useStepper } from "../kit";

const E = 8;
type Topic = "prose" | "code" | "math" | "french";
const TOKENS: { t: string; topic: Topic }[] = [
  { t: "The", topic: "prose" },
  { t: " cat", topic: "prose" },
  { t: " sat", topic: "prose" },
  { t: "def", topic: "code" },
  { t: " fib", topic: "code" },
  { t: "(n", topic: "code" },
  { t: "):", topic: "code" },
  { t: " return", topic: "code" },
  { t: "∫", topic: "math" },
  { t: " x²", topic: "math" },
  { t: " dx", topic: "math" },
  { t: " =", topic: "math" },
  { t: " Merci", topic: "french" },
  { t: " beau", topic: "french" },
  { t: "coup", topic: "french" },
  { t: " !", topic: "prose" },
];
const PREFERS: Record<Topic, number[]> = { prose: [0, 3], code: [2, 5], math: [1, 6], french: [4, 7] };
const TOPIC_COLOR: Record<Topic, string> = { prose: C.sky, code: C.pivot, math: C.compare, french: C.swap };
// An unbalanced router drifts toward a few "popular" experts (they got more gradient, so they get more tokens)
const POPULARITY = [0, 0, 1.6, 0, 0, 1.3, 0, 0];

interface Route {
  experts: number[];
  weights: number[];
  dropped: boolean[];
}

function route(topK: number, balanced: boolean, capacityFactor: number) {
  const capacity = Math.max(1, Math.ceil((capacityFactor * TOKENS.length * topK) / E));
  const load = Array(E).fill(0);
  const routes: Route[] = TOKENS.map(({ t, topic }) => {
    const rand = mulberry32(hashString(t));
    const logits = Array.from({ length: E }, (_, e) => (rand() - 0.5) * 0.8 + (PREFERS[topic].includes(e) ? 1.6 : 0) + (balanced ? 0 : POPULARITY[e]));
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((v) => v / sum);
    const experts = probs
      .map((p, e) => ({ p, e }))
      .sort((a, b) => b.p - a.p)
      .slice(0, topK)
      .map((x) => x.e);
    const norm = experts.reduce((a, e) => a + probs[e], 0);
    const dropped = experts.map((e) => {
      if (load[e] >= capacity) return true;
      load[e]++;
      return false;
    });
    return { experts, weights: experts.map((e) => probs[e] / norm), dropped };
  });
  return { routes, capacity };
}

const PRESETS = [
  { name: "Mixtral 8×7B", experts: "8 experts, top-2", total: 46.7, active: 12.9 },
  { name: "DeepSeek-V3", experts: "256 routed + 1 shared, top-8", total: 671, active: 37 },
  { name: "Dense 70B", experts: "no experts", total: 70, active: 70 },
];

export default function MoE() {
  const [topK, setTopK] = useState("2");
  const [balanced, setBalanced] = useState(false);
  const [cf, setCf] = useState(1.25);
  const { routes, capacity } = useMemo(() => route(Number(topK), balanced, cf), [topK, balanced, cf]);
  const frames = useMemo(() => routes.map((_, i) => i), [routes]);
  const s = useStepper(frames, 650);
  const upto = routes.slice(0, s.i + 1);
  const load = Array(E).fill(0);
  let dropped = 0;
  upto.forEach((r) =>
    r.experts.forEach((e, j) => {
      if (r.dropped[j]) dropped++;
      else load[e]++;
    }),
  );
  const finalLoad = Array(E).fill(0);
  routes.forEach((r) => r.experts.forEach((e) => finalLoad[e]++)); // demand, including tokens that overflowed
  const totalDropped = routes.reduce((a, r) => a + r.dropped.filter(Boolean).length, 0);
  const imbalance = Math.max(...finalLoad) / ((TOKENS.length * Number(topK)) / E);
  const cur = routes[s.i];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={topK}
          onChange={setTopK}
          options={[
            { value: "1", label: "top-1 (Switch)" },
            { value: "2", label: "top-2 (Mixtral)" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={balanced} onChange={(e) => setBalanced(e.target.checked)} className="accent-[#059669]" />
          Load balancing (aux loss / per-expert bias)
        </label>
      </div>
      <Slider label="Capacity factor (slots per expert vs a perfectly even split)" value={cf} min={0.5} max={2} step={0.25} onChange={setCf} format={(v) => `${v}× → ${Math.max(1, Math.ceil((v * TOKENS.length * Number(topK)) / E))} slots each`} />

      <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
        <div className="flex flex-wrap gap-1">
          {TOKENS.map((tk, i) => (
            <span
              key={i}
              className={clsx("rounded-md border px-1.5 py-1 font-mono text-xs whitespace-pre transition", i === s.i ? "scale-110 shadow" : i > s.i && "opacity-40")}
              style={{ borderColor: `${TOPIC_COLOR[tk.topic]}66`, background: `${TOPIC_COLOR[tk.topic]}${i === s.i ? "30" : "12"}`, color: TOPIC_COLOR[tk.topic] }}
            >
              {tk.t}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: E }, (_, e) => {
            const j = cur.experts.indexOf(e);
            const hit = j >= 0;
            const drop = hit && cur.dropped[j];
            return (
              <div
                key={e}
                className="rounded-lg border p-2 text-center transition"
                style={{
                  borderColor: drop ? C.bad : hit ? C.active : "#e2e8f0",
                  background: drop ? `${C.bad}12` : hit ? `${C.active}14` : "#ffffff",
                }}
              >
                <div className="text-[10px] text-faint">expert</div>
                <div className="font-mono text-sm font-bold text-ink">E{e}</div>
                <div className="mt-1 h-14 overflow-hidden rounded bg-line">
                  <div className="relative h-full">
                    <div className="absolute bottom-0 w-full rounded transition-all" style={{ height: `${Math.min(100, (load[e] / capacity) * 100)}%`, background: load[e] >= capacity ? C.compare : C.done }} />
                  </div>
                </div>
                <div className="mt-1 font-mono text-[10px] text-dim">
                  {load[e]}/{capacity}
                </div>
                {hit && (
                  <div className="mt-0.5 font-mono text-[10px] font-semibold" style={{ color: drop ? C.bad : C.active }}>
                    {drop ? "dropped" : `w=${cur.weights[j].toFixed(2)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="busiest expert demand vs fair share" value={`${imbalance.toFixed(1)}×`} color={imbalance > 1.6 ? C.bad : C.done} />
        <Stat label="token-slots dropped" value={`${totalDropped} / ${TOKENS.length * Number(topK)}`} color={totalDropped ? C.bad : C.done} />
        <Stat label="dropped so far" value={dropped} />
      </div>
      <Narration tone={totalDropped ? "warn" : balanced ? "good" : "info"}>
        Token <b className="font-mono">{JSON.stringify(TOKENS[s.i].t)}</b> ({TOKENS[s.i].topic}) → {cur.experts.map((e, j) => `E${e}${cur.dropped[j] ? " (full, dropped)" : ""}`).join(" + ")}. The router is a tiny linear layer + softmax. Only the chosen experts&apos; FFNs run, so compute per token stays small while total parameters grow.{" "}
        {balanced
          ? "With balancing, experts specialise by topic and load is even."
          : "Without balancing, the router collapses onto a few popular experts: they overflow, tokens get dropped (passed through on the residual) and the other experts are wasted parameters."}
      </Narration>

      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <div key={p.name} className="rounded-xl border border-line bg-panel p-3 text-xs">
            <div className="font-semibold text-ink">{p.name}</div>
            <div className="text-faint">{p.experts}</div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full" style={{ width: `${(p.active / p.total) * 100}%`, background: C.active }} />
            </div>
            <div className="mt-1 font-mono text-dim">
              {p.active}B active / {p.total}B total ({Math.round((p.active / p.total) * 100)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
