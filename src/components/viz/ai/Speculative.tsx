"use client";

import { useMemo, useState } from "react";
import { mulberry32 } from "@/lib/random";
import { C, Narration, Slider, Stat, StepControls, useStepper } from "../kit";

const TEXT = "Speculative decoding lets a small draft model guess several tokens that the large model then checks all at once in a single forward pass".split(" ");

interface Round {
  start: number;
  proposed: number; // tokens proposed by the draft
  accepted: number; // how many draft tokens were accepted
}

export default function Speculative() {
  const [k, setK] = useState(4);
  const [alpha, setAlpha] = useState(0.75);
  const [seed, setSeed] = useState(3);

  const rounds = useMemo(() => {
    const rand = mulberry32(seed);
    const out: Round[] = [];
    let pos = 0;
    while (pos < TEXT.length) {
      const proposed = Math.min(k, TEXT.length - pos);
      let accepted = 0;
      while (accepted < proposed && rand() < alpha) accepted++;
      out.push({ start: pos, proposed, accepted });
      pos += accepted + 1; // the target always contributes one token (correction or bonus)
    }
    return out;
  }, [k, alpha, seed]);

  const frames = useMemo(() => [-1, ...rounds.map((_, i) => i)], [rounds]);
  const s = useStepper(frames, 1200);
  const cur = s.frame;
  const done = cur < 0 ? 0 : Math.min(TEXT.length, rounds[cur].start + rounds[cur].accepted + 1);
  const expected = (1 - alpha ** (k + 1)) / (1 - alpha);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Slider label="draft tokens per round (k)" value={k} min={1} max={8} onChange={setK} />
        </div>
        <div className="w-52">
          <Slider label="acceptance rate α" value={alpha} min={0.3} max={0.95} step={0.05} onChange={setAlpha} format={(v) => v.toFixed(2)} />
        </div>
        <button type="button" onClick={() => setSeed((x) => x + 1)} className="h-9 rounded-lg border border-line-2 bg-panel-3 px-3 text-xs text-ink">
          ↻ new run
        </button>
      </div>
      <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="flex flex-wrap gap-1">
          {TEXT.map((w, i) => {
            const roundIdx = rounds.findIndex((r) => i >= r.start && i <= r.start + r.accepted);
            const r = rounds[roundIdx];
            const shown = cur >= 0 && roundIdx <= cur && roundIdx >= 0;
            const isBonus = r && i === r.start + r.accepted;
            const color = !shown ? "#e2e8f0" : isBonus ? C.active : C.done;
            return (
              <span key={i} className="rounded-md border px-1.5 py-0.5 font-mono text-xs transition-all" style={{ borderColor: color, color: shown ? C.text : C.faint, background: shown ? `${color}22` : "transparent" }}>
                {w}
              </span>
            );
          })}
        </div>
        {cur >= 0 && (
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-xs">
            <div className="text-dim">
              Round {cur + 1}: draft proposed {rounds[cur].proposed} tokens; the target verified them in <b className="text-ink">one</b> forward pass.
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: rounds[cur].proposed }, (_, j) => (
                <span
                  key={j}
                  className="rounded border px-1.5 py-0.5 font-mono"
                  style={{
                    borderColor: j < rounds[cur].accepted ? C.done : C.bad,
                    color: j < rounds[cur].accepted ? C.done : C.bad,
                    textDecoration: j >= rounds[cur].accepted ? "line-through" : undefined,
                  }}
                >
                  {j < rounds[cur].accepted ? TEXT[rounds[cur].start + j] : "guess"}
                </span>
              ))}
              <span className="rounded border px-1.5 py-0.5 font-mono" style={{ borderColor: C.active, color: C.active }}>
                + {TEXT[rounds[cur].start + rounds[cur].accepted] ?? ""} (from target)
              </span>
            </div>
          </div>
        )}
      </div>
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="tokens generated" value={`${done}/${TEXT.length}`} />
        <Stat label="target passes (spec)" value={cur + 1} color={C.done} />
        <Stat label="target passes (normal)" value={done} color={C.bad} />
        <Stat label="expected tokens/pass" value={expected.toFixed(2)} color={C.compare} />
      </div>
      <Narration>
        Decoding is memory-bound, so verifying k tokens costs about the same as generating one. A cheap draft (a small model, n-gram lookup, Medusa heads or EAGLE) guesses k tokens; the target scores them in one pass, keeps the longest
        prefix that matches its own distribution (rejection sampling keeps the output distribution exactly unchanged), and adds one token of its own. Expected tokens per pass = (1 − α^(k+1)) / (1 − α). Big win when α is high (code,
        boilerplate); little when the draft guesses badly.
      </Narration>
    </div>
  );
}
