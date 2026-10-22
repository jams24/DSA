"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

type Method = "mod" | "range" | "consistent";

const KEYS = Array.from({ length: 48 }, (_, i) => i + 1);
const COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706", "#ea580c", "#059669", "#0284c7", "#e11d48"];
const VNODES = 40;

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function assign(method: Method, n: number): number[] {
  if (method === "mod") return KEYS.map((k) => fnv(`user:${k}`) % n);
  if (method === "range") return KEYS.map((k) => Math.min(n - 1, Math.floor(((k - 1) / KEYS.length) * n)));
  const ring = Array.from({ length: n }, (_, s) => Array.from({ length: VNODES }, (_, v) => ({ pos: fnv(`shard-${s}#${v}`), s }))).flat().sort((a, b) => a.pos - b.pos);
  return KEYS.map((k) => {
    const h = fnv(`user:${k}`);
    const node = ring.find((r) => r.pos >= h) ?? ring[0];
    return node.s;
  });
}

const NOTES: Record<Method, string> = {
  mod: "hash(key) mod N spreads keys evenly — but change N and almost every key maps somewhere new. That's a full reshuffle of your data.",
  range: "Range partitioning keeps adjacent keys together (great for range scans) — but monotonically increasing keys (timestamps, auto-increment IDs) send ALL new writes to the last shard: a hot spot.",
  consistent: "Consistent hashing places shards (×40 virtual nodes each) on a ring; a key goes to the next shard clockwise. Adding a shard only steals ~1/(N+1) of the keys.",
};

export default function Sharding() {
  const [method, setMethod] = useState<Method>("mod");
  const [n, setN] = useState(4);
  const [added, setAdded] = useState(false);
  const before = useMemo(() => assign(method, n), [method, n]);
  const after = useMemo(() => assign(method, n + 1), [method, n]);
  const current = added ? after : before;
  const shards = added ? n + 1 : n;
  const moved = KEYS.filter((_, i) => before[i] !== after[i]).length;
  const counts = Array.from({ length: shards }, (_, s) => current.filter((x) => x === s).length);
  const mean = KEYS.length / shards;
  const spread = Math.round(Math.sqrt(counts.reduce((a, c) => a + (c - mean) ** 2, 0) / shards) * 10) / 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          value={method}
          onChange={(m) => {
            setMethod(m);
            setAdded(false);
          }}
          options={[
            { value: "mod", label: "hash mod N" },
            { value: "range", label: "Range" },
            { value: "consistent", label: "Consistent hashing" },
          ]}
        />
        <div className="w-44">
          <Slider
            label="shards N"
            value={n}
            min={2}
            max={7}
            onChange={(v) => {
              setN(v);
              setAdded(false);
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => setAdded((a) => !a)}
          className="h-9 rounded-lg border border-amber/50 bg-amber/10 px-3 text-sm font-semibold text-amber hover:bg-amber/20"
        >
          {added ? `↩ back to ${n} shards` : `➕ add shard #${n + 1}`}
        </button>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${shards}, minmax(0, 1fr))` }}>
        {Array.from({ length: shards }, (_, s) => (
          <div key={s} className="rounded-xl border bg-[#f8fafd] p-2" style={{ borderColor: `${COLORS[s]}55` }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold" style={{ color: COLORS[s] }}>
                🗄️ shard {s + 1}
              </span>
              <span className="font-mono text-[10px] text-faint">{counts[s]}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {KEYS.map((k, i) =>
                current[i] === s ? (
                  <span
                    key={k}
                    className="rounded px-1 py-0.5 font-mono text-[9px] transition-all"
                    style={{
                      background: added && before[i] !== after[i] ? `${C.compare}33` : "#f1f5f9",
                      color: added && before[i] !== after[i] ? C.compare : C.muted,
                      boxShadow: added && before[i] !== after[i] ? `0 0 0 1px ${C.compare}` : undefined,
                    }}
                    title={`user:${k}`}
                  >
                    {k}
                  </span>
                ) : null,
              )}
            </div>
            {method === "range" && (
              <div className="mt-2 rounded bg-panel px-1.5 py-1 text-[9px] text-faint">
                ids {Math.round((s / shards) * KEYS.length) + 1}–{Math.round(((s + 1) / shards) * KEYS.length)}
                {s === shards - 1 && <span className="ml-1 text-rose">🔥 all new writes</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <Narration tone={added ? (moved / KEYS.length > 0.5 ? "bad" : "good") : "info"}>
        {added ? `Adding one shard moved ${moved} of ${KEYS.length} keys (${Math.round((moved / KEYS.length) * 100)}%). Ideal minimum is ~${Math.round(100 / (n + 1))}%. ` : ""}
        {NOTES[method]}
      </Narration>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="keys moved on +1 shard" value={`${Math.round((moved / KEYS.length) * 100)}%`} color={moved / KEYS.length > 0.5 ? C.bad : C.done} />
        <Stat label="ideal (1/(N+1))" value={`${Math.round(100 / (n + 1))}%`} color={C.pivot} />
        <Stat label="load imbalance (σ)" value={spread} color={C.compare} />
      </div>
    </div>
  );
}
