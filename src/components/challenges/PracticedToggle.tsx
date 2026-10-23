"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import { togglePracticed, usePracticed } from "./practiced";

export function PracticedToggle({ slug }: { slug: string }) {
  const done = usePracticed().includes(slug);
  return (
    <button
      type="button"
      onClick={() => togglePracticed(slug)}
      aria-pressed={done}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition",
        done ? "border-emerald bg-emerald text-white" : "border-line-2 bg-panel text-ink hover:border-emerald",
      )}
    >
      <Check size={16} strokeWidth={3} className={done ? "" : "text-faint"} />
      {done ? "Practiced" : "Mark practiced"}
    </button>
  );
}
