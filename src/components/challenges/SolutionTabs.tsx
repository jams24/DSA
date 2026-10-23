"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { RevealCode } from "@/components/bank/RevealCode";

export interface SolutionView {
  label: string;
  stack: string;
  file: string;
  code: string;
  html: string;
  verified: "tested" | "type-checked" | null;
  notes?: string;
  test?: { file: string; code: string; html: string };
}

export function SolutionTabs({ solutions }: { solutions: SolutionView[] }) {
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const s = solutions[active];

  return (
    <div>
      <div role="tablist" aria-label="Solutions" className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
        {solutions.map((x, i) => (
          <button
            key={x.file}
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              setActive(i);
              setShowTest(false);
            }}
            className={clsx(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition",
              i === active ? "border-cyan bg-cyan/10 text-cyan" : "border-line-2 bg-panel text-dim hover:text-ink",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-2 mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-faint">{s.file}</span>
        {s.verified && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-emerald/40 bg-emerald/10 px-2 py-0.5 font-semibold text-emerald"
            title={s.verified === "tested" ? "Executed against its test with `npm run challenges:test`" : "Type-checked in strict mode with `npm run challenges:test`"}
          >
            <ShieldCheck size={12} /> {s.verified === "tested" ? "Tested" : "Type-checked"}
          </span>
        )}
        {s.test && revealed && (
          <button type="button" onClick={() => setShowTest((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-line-2 px-2 py-0.5 font-semibold text-dim hover:text-ink">
            <FlaskConical size={12} /> {showTest ? "Show solution" : "Show its test"}
          </button>
        )}
      </div>
      {s.notes && <p className="mb-2 text-sm text-dim">{s.notes}</p>}

      {revealed ? (
        showTest && s.test ? (
          <RevealCode key={`${s.file}-test`} html={s.test.html} code={s.test.code} hidden={false} />
        ) : (
          <RevealCode key={s.file} html={s.html} code={s.code} hidden={false} />
        )
      ) : (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line-2 bg-panel-2 px-4 py-8 text-center">
          <p className="max-w-md text-sm text-dim">Build it yourself first, inside the time box. Then compare: the reference shows one clean way to meet every requirement above.</p>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan/50 bg-cyan/10 px-4 text-sm font-semibold text-cyan hover:bg-cyan/20"
          >
            Show reference solutions
          </button>
        </div>
      )}
    </div>
  );
}
