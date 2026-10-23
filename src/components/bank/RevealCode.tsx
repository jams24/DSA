"use client";

import { useState } from "react";
import { Check, Copy, Eye } from "lucide-react";

/** Pre-highlighted code that stays hidden until the reader chooses to look. */
export function RevealCode({ html, code, label = "Show solution", hidden = true }: { html: string; code: string; label?: string; hidden?: boolean }) {
  const [open, setOpen] = useState(!hidden);
  const [copied, setCopied] = useState(false);

  if (!open)
    return (
      <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line-2 bg-panel-2 px-4 py-8 text-center">
        <p className="max-w-md text-sm text-dim">Try it yourself first: 20–25 minutes, then the hint, then the trick. Reading code you haven&apos;t attempted teaches far less.</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan/50 bg-cyan/10 px-4 text-sm font-semibold text-cyan hover:bg-cyan/20"
        >
          <Eye size={15} /> {label}
        </button>
      </div>
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-lg border border-line-2 bg-panel text-dim hover:text-ink"
        aria-label="Copy code"
      >
        {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
      </button>
      <div className="code-block rounded-xl border border-line p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
