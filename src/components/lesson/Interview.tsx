"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { Frequency, PracticeProblem } from "@/content/types";

export interface RenderedQA {
  q: string;
  html: string;
  freq?: Frequency;
}

export const FREQ: Record<Frequency, { label: string; cls: string }> = {
  "very-common": { label: "🔥 Very common", cls: "border-orange/40 bg-orange/10 text-orange" },
  common: { label: "Common", cls: "border-sky/40 bg-sky/10 text-sky" },
  occasional: { label: "Occasional", cls: "border-line-2 bg-panel-2 text-dim" },
};

export function QAItem({ qa, defaultOpen = false, context }: { qa: RenderedQA; defaultOpen?: boolean; context?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={clsx("rounded-xl border transition", open ? "border-line-2 bg-panel-2/70" : "border-line bg-panel/60 hover:border-line-2")}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <span className="mt-0.5 font-pixel text-[9px] text-violet">Q</span>
        <span className="flex-1">
          <span className="block font-medium text-ink">{qa.q}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {qa.freq && <span className={clsx("rounded-full border px-2 py-0.5 text-[10px]", FREQ[qa.freq].cls)}>{FREQ[qa.freq].label}</span>}
            {context && <span className="rounded-full border border-line-2 px-2 py-0.5 text-[10px] text-faint">{context}</span>}
          </span>
        </span>
        <ChevronDown size={18} className={clsx("mt-0.5 shrink-0 text-faint transition", open && "rotate-180")} />
      </button>
      {open && <div className="prose-quest border-t border-line px-4 py-4 text-[15px]" dangerouslySetInnerHTML={{ __html: qa.html }} />}
    </div>
  );
}

export function InterviewPanel({ qas, problems }: { qas: RenderedQA[]; problems?: PracticeProblem[] }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 text-sm text-dim">
          Say your answer out loud first, then open the model answer. Interviewers grade the reasoning, not just the conclusion.
        </p>
        <div className="space-y-2.5">
          {qas.map((qa, i) => (
            <QAItem key={i} qa={qa} />
          ))}
        </div>
      </div>
      {problems && problems.length > 0 && (
        <div>
          <h3 className="mb-3 font-display text-lg font-semibold text-ink">Practice on LeetCode</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {problems.map((p) => (
              <a
                key={p.title}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-line bg-panel/60 px-4 py-3 transition hover:border-cyan/40"
              >
                <span
                  className={clsx(
                    "w-16 shrink-0 text-xs font-semibold",
                    p.difficulty === "Easy" ? "text-emerald" : p.difficulty === "Medium" ? "text-amber" : "text-rose",
                  )}
                >
                  {p.difficulty}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{p.title}</span>
                  {p.note && <span className="block truncate text-xs text-faint">{p.note}</span>}
                </span>
                <ExternalLink size={14} className="shrink-0 text-faint group-hover:text-cyan" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
