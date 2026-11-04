"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, Copy, FileCode2 } from "lucide-react";
import { OutputBox } from "./LanguageTabs";

export interface RenderedSample {
  title: string;
  note?: string;
  variants: { lang: string; code: string; html: string }[];
  /** files the commands use (Dockerfile, app code ...), shown as tabs above them */
  files?: { path: string; lang: string; code: string; html: string }[];
  explainHtml?: string;
  output?: string;
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
  properties: "Config",
  xml: "XML",
  json: "JSON",
  cmake: "CMake",
  kotlin: "Kotlin",
  proto: "Protobuf",
  make: "Makefile",
  toml: "TOML",
  c: "C",
  asm: "Assembly",
  llvm: "LLVM IR",
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
      {sample.files && sample.files.length > 0 && <SampleFiles files={sample.files} />}
      {sample.files && sample.files.length > 0 && (
        <div className="px-4 pt-2.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Then run</div>
      )}
      <div className="code-block p-3" dangerouslySetInnerHTML={{ __html: active.html }} />
      {(sample.output || sample.explainHtml) && (
        <div className="space-y-3 border-t border-line bg-panel-2/40 px-4 py-4">
          {sample.output && <OutputBox output={sample.output} />}
          {sample.explainHtml && <div className="prose-quest prose-tight" dangerouslySetInnerHTML={{ __html: sample.explainHtml }} />}
        </div>
      )}
    </section>
  );
}

function SampleFiles({ files }: { files: NonNullable<RenderedSample["files"]> }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const f = files[Math.min(i, files.length - 1)];
  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-2 bg-panel-2/40 px-2 py-1.5">
        <span className="shrink-0 pl-1 text-[10px] font-semibold tracking-wider text-faint uppercase">Files</span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-thin">
          {files.map((x, k) => (
            <button
              key={x.path}
              type="button"
              onClick={() => setI(k)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[11px] transition",
                k === i ? "bg-panel-3 text-ink shadow-[inset_0_0_0_1px_#cbd5e1]" : "text-faint hover:text-ink",
              )}
            >
              <FileCode2 size={12} /> {x.path}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(f.code.trim());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line-2 text-dim hover:text-ink"
          aria-label={`Copy ${f.path}`}
        >
          {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
        </button>
      </div>
      <div className="code-block p-3" dangerouslySetInnerHTML={{ __html: f.html }} />
    </div>
  );
}
