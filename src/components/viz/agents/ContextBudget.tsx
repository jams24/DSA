"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

type Tier = "small" | "mid" | "large";

// Illustrative $ per million tokens. Cache writes cost 1.25× input, cache reads 0.1× (Anthropic-style; providers differ).
const PRICES: Record<Tier, { label: string; input: number; output: number }> = {
  small: { label: "Small model ($1 / $5)", input: 1, output: 5 },
  mid: { label: "Mid model ($3 / $15)", input: 3, output: 15 },
  large: { label: "Large model ($15 / $75)", input: 15, output: 75 },
};
const WINDOW = 200_000;
const SUMMARY = 3_000;

interface Call {
  turn: number;
  input: number;
  compacted: boolean;
  cost: number;
  costNoCache: number;
}

function simulate(tier: Tier, prefix: number, perTurn: number, out: number, turns: number, compaction: boolean) {
  const p = PRICES[tier];
  const calls: Call[] = [];
  let context = prefix;
  let cached = 0;
  let cost = 0;
  let costNoCache = 0;
  let compactions = 0;
  let tokens = 0;
  for (let t = 1; t <= turns; t++) {
    context += perTurn;
    let compacted = false;
    if (compaction && context > 0.8 * WINDOW) {
      // one extra call summarizes the conversation, then the history is replaced by the summary
      cost += (cached * p.input * 0.1 + (context - cached) * p.input * 1.25 + SUMMARY * p.output) / 1e6;
      costNoCache += (context * p.input + SUMMARY * p.output) / 1e6;
      tokens += context;
      context = prefix + SUMMARY + perTurn;
      cached = prefix; // the static prefix is still cached
      compactions++;
      compacted = true;
    }
    const read = Math.min(cached, context);
    cost += (read * p.input * 0.1 + (context - read) * p.input * 1.25 + out * p.output) / 1e6;
    costNoCache += (context * p.input + out * p.output) / 1e6;
    tokens += context;
    calls.push({ turn: t, input: context, compacted, cost, costNoCache });
    context += out;
    cached = context - out; // everything sent this call is now a cached prefix
  }
  return { calls, cost, costNoCache, compactions, tokens, overflow: !compaction && calls.some((c) => c.input > WINDOW) };
}

export default function ContextBudget() {
  const [tier, setTier] = useState<Tier>("mid");
  const [prefix, setPrefix] = useState(12_000);
  const [perTurn, setPerTurn] = useState(4_000);
  const [out, setOut] = useState(400);
  const [turns, setTurns] = useState(50);
  const [compaction, setCompaction] = useState(true);
  const sim = useMemo(() => simulate(tier, prefix, perTurn, out, turns, compaction), [tier, prefix, perTurn, out, turns, compaction]);

  const W = 640;
  const H = 170;
  const x = (t: number) => 44 + ((t - 1) / Math.max(1, turns - 1)) * (W - 60);
  const maxIn = Math.max(WINDOW * 1.05, ...sim.calls.map((c) => c.input));
  const y = (v: number) => H - 22 - (v / maxIn) * (H - 34);
  const maxCost = Math.max(sim.costNoCache, 0.01);
  const yc = (v: number) => H - 22 - (v / maxCost) * (H - 34);
  const savings = 1 - sim.cost / sim.costNoCache;

  return (
    <div className="space-y-4">
      <Segmented value={tier} onChange={setTier} options={(Object.keys(PRICES) as Tier[]).map((k) => ({ value: k, label: PRICES[k].label }))} />
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Slider label="Static prefix (system + tools + docs)" value={prefix} min={1000} max={60000} step={1000} onChange={setPrefix} format={(v) => `${v / 1000}k tokens`} />
        <Slider label="New tokens per turn (tool results, messages)" value={perTurn} min={500} max={20000} step={500} onChange={setPerTurn} format={(v) => `${(v / 1000).toFixed(1)}k`} />
        <Slider label="Output tokens per turn" value={out} min={100} max={3000} step={100} onChange={setOut} />
        <Slider label="Agent turns (model calls)" value={turns} min={2} max={120} onChange={setTurns} />
      </div>
      <label className="flex items-center gap-2 text-xs text-dim">
        <input type="checkbox" checked={compaction} onChange={(e) => setCompaction(e.target.checked)} className="accent-[#0891b2]" />
        Auto-compact when the context passes 80% of a 200k window
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
          <div className="px-3 pt-2 text-[11px] font-semibold text-faint">input tokens sent per call</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            <line x1={44} x2={W - 16} y1={y(WINDOW)} y2={y(WINDOW)} stroke={C.bad} strokeDasharray="5 4" />
            <text x={W - 18} y={y(WINDOW) - 4} textAnchor="end" fontSize="10" fill={C.bad}>
              200k window
            </text>
            <polyline points={sim.calls.map((c) => `${x(c.turn)},${y(c.input)}`).join(" ")} fill="none" stroke={C.pivot} strokeWidth={2} />
            {sim.calls.filter((c) => c.compacted).map((c) => (
              <circle key={c.turn} cx={x(c.turn)} cy={y(c.input)} r={4} fill={C.active} />
            ))}
            <line x1={44} x2={W - 16} y1={H - 22} y2={H - 22} stroke="#cbd5e1" />
            <text x={38} y={y(0) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              0
            </text>
            <text x={38} y={y(100000) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              100k
            </text>
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={C.faint}>
              turn
            </text>
          </svg>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
          <div className="px-3 pt-2 text-[11px] font-semibold text-faint">cumulative cost</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            <polyline points={sim.calls.map((c) => `${x(c.turn)},${yc(c.costNoCache)}`).join(" ")} fill="none" stroke={C.compare} strokeWidth={2} />
            <polyline points={sim.calls.map((c) => `${x(c.turn)},${yc(c.cost)}`).join(" ")} fill="none" stroke={C.done} strokeWidth={2} />
            <line x1={44} x2={W - 16} y1={H - 22} y2={H - 22} stroke="#cbd5e1" />
            <text x={50} y={16} fontSize="10" fill={C.compare}>
              ━ no caching
            </text>
            <text x={130} y={16} fontSize="10" fill={C.done}>
              ━ prompt caching
            </text>
            <text x={38} y={yc(maxCost) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
              ${maxCost.toFixed(2)}
            </text>
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={C.faint}>
              turn
            </text>
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="input tokens processed" value={`${(sim.tokens / 1e6).toFixed(2)}M`} />
        <Stat label="cost without caching" value={`$${sim.costNoCache.toFixed(2)}`} color={C.compare} />
        <Stat label="cost with caching" value={`$${sim.cost.toFixed(2)}`} color={C.done} />
        <Stat label="compactions" value={sim.compactions} color={C.active} />
      </div>
      <Narration tone={sim.overflow ? "bad" : "info"}>
        {sim.overflow
          ? "Without compaction this session overflows the 200k window: the request fails or old turns get silently dropped. "
          : ""}
        Every call re-sends the whole conversation, so {turns} turns process {(sim.tokens / 1e6).toFixed(2)}M input tokens to produce only {((turns * out) / 1000).toFixed(0)}k output tokens. Caching
        turns the repeated prefix into cheap reads ({Math.round(savings * 100)}% saved here) and also cuts time-to-first-token. Keep the prefix byte-identical: system prompt → tools → static
        docs → conversation. A timestamp or a reordered tool list at the top invalidates the cache on every call.
      </Narration>
    </div>
  );
}
