"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";

export interface RenderedSample {
  title: string;
  note?: string;
  variants: { lang: string; code: string; html: string }[];
}

const LANG_LABEL: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
  sql: "SQL",
  yaml: "YAML",
  bash: "Bash",
  dockerfile: "Dockerfile",
  hcl: "Terraform",
  text: "Text",
};

export function CodeSamples({ samples, preferred, onPreferred }: { samples: RenderedSample[]; preferred: string; onPreferred: (l: string) => void }) {
  return (
    <div className="space-y-6">
      {samples.map((s, i) => (
        <Sample key={i} sample={s} preferred={preferred} onPreferred={onPreferred} />
      ))}
    </div>
  );
}

function Sample({ sample, preferred, onPreferred }: { sample: RenderedSample; preferred: string; onPreferred: (l: string) => void }) {
  const [copied, setCopied] = useState(false);
  const active = sample.variants.find((v) => v.lang === preferred) ?? sample.variants[0];

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="font-display font-semibold text-ink">{sample.title}</h3>
          {sample.note && <p className="text-xs text-dim">{sample.note}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line-2 bg-panel p-0.5">
            {sample.variants.map((v) => (
              <button
                key={v.lang}
                type="button"
                onClick={() => onPreferred(v.lang)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  v.lang === active.lang ? "bg-panel-3 text-cyan" : "text-faint hover:text-ink",
                )}
              >
                {LANG_LABEL[v.lang] ?? v.lang}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(active.code.trim());
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line-2 text-dim hover:text-ink"
            aria-label="Copy code"
          >
            {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          </button>
        </div>
      </header>
      <div className="code-block p-3" dangerouslySetInnerHTML={{ __html: active.html }} />
    </section>
  );
}
