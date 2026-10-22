"use client";

import { useMemo } from "react";
import { C, Narration, StepControls, useStepper } from "../kit";

const SPLITS = ["the cat sat on the mat", "the dog sat on the log", "a cat and a dog"];
const REDUCERS = 2;

function h(w: string) {
  let x = 0;
  for (const ch of w) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return x % REDUCERS;
}

interface Frame {
  phase: number; // 0 input, 1 map, 2 combine, 3 shuffle, 4 reduce
  msg: string;
}

export default function MapReduce() {
  const mapped = SPLITS.map((s) => s.split(" ").map((w) => [w, 1] as [string, number]));
  const combined = mapped.map((pairs) => {
    const m = new Map<string, number>();
    for (const [w, c] of pairs) m.set(w, (m.get(w) ?? 0) + c);
    return [...m.entries()];
  });
  const shuffled = Array.from({ length: REDUCERS }, (_, r) => {
    const groups = new Map<string, number[]>();
    for (const pairs of combined) for (const [w, c] of pairs) if (h(w) === r) groups.set(w, [...(groups.get(w) ?? []), c]);
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
  const reduced = shuffled.map((g) => g.map(([w, cs]) => [w, cs.reduce((a, b) => a + b, 0)] as [string, number]));

  const frames = useMemo<Frame[]>(
    () => [
      { phase: 0, msg: "Word count over a huge corpus. The input is split into chunks stored across the cluster (HDFS/S3); one map task per split runs close to its data." },
      { phase: 1, msg: "MAP: each mapper reads its split and emits (word, 1) for every word. Mappers share nothing, so they scale out linearly." },
      { phase: 2, msg: "COMBINE (optional): each mapper pre-aggregates locally — ('the', 2) instead of two ('the', 1) — to cut network traffic in the shuffle." },
      { phase: 3, msg: `SHUFFLE: pairs are partitioned by hash(word) mod ${REDUCERS}, sent over the network and sorted, so every occurrence of a word lands on the same reducer.` },
      { phase: 4, msg: "REDUCE: each reducer sums the counts for its words and writes output. Failed tasks are simply re-run (outputs are deterministic). Spark keeps intermediate data in memory to go much faster." },
    ],
    [],
  );
  const s = useStepper(frames, 2200);
  const f = s.frame;
  const Pair = ({ w, c, r }: { w: string; c: number | string; r?: number }) => (
    <span className="rounded-md border px-1.5 py-0.5 font-mono text-[10.5px]" style={{ borderColor: r === undefined ? C.base : r === 0 ? C.active : C.swap, color: C.text, background: C.baseFill }}>
      {w}:{c}
    </span>
  );
  const col = (title: string, on: boolean, children: React.ReactNode) => (
    <div className="space-y-2 rounded-xl border p-2 transition-opacity duration-500" style={{ borderColor: on ? "#2a355d" : "#151b33", opacity: on ? 1 : 0.25 }}>
      <div className="text-[10px] uppercase tracking-wider text-faint">{title}</div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 overflow-x-auto rounded-xl border border-line bg-[#080c19] p-3 md:grid-cols-4">
        {col(
          "Input splits",
          true,
          SPLITS.map((sp, i) => (
            <div key={i} className="rounded-lg bg-panel px-2 py-1.5 font-mono text-[11px] text-dim">
              <span className="text-faint">split {i + 1}:</span> {sp}
            </div>
          )),
        )}
        {col(
          f.phase >= 2 ? "Map + combine" : "Map output",
          f.phase >= 1,
          (f.phase >= 2 ? combined : mapped).map((pairs, i) => (
            <div key={i} className="flex flex-wrap gap-1 rounded-lg bg-panel p-1.5">
              <span className="w-full text-[9px] text-faint">mapper {i + 1}</span>
              {pairs.map(([w, c], k) => (
                <Pair key={k} w={w} c={c} r={f.phase >= 3 ? h(w) : undefined} />
              ))}
            </div>
          )),
        )}
        {col(
          "Shuffle → reducer input",
          f.phase >= 3,
          shuffled.map((g, r) => (
            <div key={r} className="flex flex-wrap gap-1 rounded-lg bg-panel p-1.5">
              <span className="w-full text-[9px]" style={{ color: r === 0 ? C.active : C.swap }}>
                reducer {r + 1}
              </span>
              {g.map(([w, cs]) => (
                <Pair key={w} w={w} c={`[${cs.join(",")}]`} r={r} />
              ))}
            </div>
          )),
        )}
        {col(
          "Reduce output",
          f.phase >= 4,
          reduced.map((g, r) => (
            <div key={r} className="flex flex-wrap gap-1 rounded-lg bg-panel p-1.5">
              {g.map(([w, c]) => (
                <Pair key={w} w={w} c={c} r={r} />
              ))}
            </div>
          )),
        )}
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
