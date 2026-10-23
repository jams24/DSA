"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { BEHAVIORAL_QUESTIONS, THEMES, type ThemeId } from "@/content/interview";
import { storyStore } from "./stories";

export function QuestionList() {
  const stories = storyStore.use();
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const visible = BEHAVIORAL_QUESTIONS.filter((q) => !theme || q.themes.includes(theme));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={theme === t.id}
            onClick={() => setTheme(theme === t.id ? null : t.id)}
            className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold transition", theme === t.id ? "border-cyan bg-cyan/10 text-cyan" : "border-line-2 bg-panel text-dim hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-panel">
        {visible.map((q) => {
          const ready = stories.some((s) => s.themes.some((t) => q.themes.includes(t)));
          return (
            <li key={q.q} className="flex gap-3 p-4">
              <span className={clsx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", ready ? "bg-emerald" : "bg-line-2")} title={ready ? "You have a story for this" : "No story tagged for this yet"} />
              <div className="min-w-0">
                <div className="font-semibold text-ink">
                  {q.q} {q.common && <span className="ml-1 rounded bg-amber/10 px-1.5 py-0.5 align-middle text-[10px] font-bold text-amber uppercase">very common</span>}
                </div>
                <p className="mt-0.5 text-sm text-dim">{q.probing}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-faint">Green dot: a story in your bank is tagged with a matching theme.</p>
    </div>
  );
}
