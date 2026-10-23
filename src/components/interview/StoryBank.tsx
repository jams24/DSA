"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, Copy, Download, FilePlus2, Plus, Trash2, X } from "lucide-react";
import { AMAZON_LPS, EXAMPLE_STORIES, STAR, THEMES, type ThemeId } from "@/content/interview";
import { analyzeStory, newStory, storyStore, storyToMarkdown, type Story } from "./stories";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Editor({ story, onChange, onDelete, onClose }: { story: Story; onChange: (s: Story) => void; onDelete: () => void; onClose: () => void }) {
  const a = analyzeStory(story);
  const set = (patch: Partial<Story>) => onChange({ ...story, ...patch, updated: Date.now() });
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <input
          value={story.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Short name, e.g. “The slow checkout page”"
          aria-label="Story title"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-2 bg-panel px-3 font-display font-semibold text-ink outline-none focus:border-cyan"
        />
        <button type="button" onClick={onDelete} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-2 text-dim hover:border-rose hover:text-rose" aria-label="Delete story">
          <Trash2 size={16} />
        </button>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-2 text-dim hover:text-ink" aria-label="Close editor">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {STAR.map((f) => (
          <label key={f.key} className="block">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-cyan/10 font-mono text-xs font-bold text-cyan">{f.letter}</span>
              <span className="font-semibold text-ink">{f.label}</span>
              <span className="text-xs text-faint">
                {f.share} · {a.counts[f.key]} words
              </span>
            </span>
            <span className="mt-1 block text-xs text-dim">{f.guide}</span>
            <textarea
              value={story[f.key]}
              onChange={(e) => set({ [f.key]: e.target.value })}
              placeholder={f.prompt}
              rows={f.key === "action" ? 6 : 3}
              className="mt-1.5 w-full rounded-xl border border-line-2 bg-panel px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-cyan"
            />
          </label>
        ))}
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold tracking-wide text-faint uppercase">Questions this story can answer</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={story.themes.includes(t.id)}
              onClick={() => set({ themes: toggle(story.themes, t.id) })}
              className={clsx("rounded-lg border px-2.5 py-1 text-xs font-semibold transition", story.themes.includes(t.id) ? "border-cyan bg-cyan/10 text-cyan" : "border-line-2 text-dim hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-dim hover:text-ink">Amazon Leadership Principles ({story.lps.length} tagged)</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AMAZON_LPS.map((lp) => (
              <button
                key={lp.name}
                type="button"
                aria-pressed={story.lps.includes(lp.name)}
                onClick={() => set({ lps: toggle(story.lps, lp.name) })}
                className={clsx("rounded-lg border px-2 py-1 text-xs transition", story.lps.includes(lp.name) ? "border-orange bg-orange/10 font-semibold text-orange" : "border-line-2 text-dim hover:text-ink")}
              >
                {lp.name}
              </button>
            ))}
          </div>
        </details>
      </div>

      {a.total > 0 && (
        <div className="mt-5 rounded-xl border border-line bg-panel-2 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-ink">Story check</span>
            <span className="font-mono text-xs text-dim">
              ≈ {fmtTime(a.seconds)} spoken · {a.score}/{a.checks.length} checks
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {a.checks.map((c) => (
              <li key={c.text} className={clsx("flex gap-2 text-sm", c.ok ? "text-dim" : "text-ink")}>
                <span className={clsx("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white", c.ok ? "bg-emerald" : "bg-amber")}>{c.ok ? "✓" : "!"}</span>
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StoryBank() {
  const stories = storyStore.use();
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const current = stories.find((s) => s.id === editing);

  const coverage = THEMES.map((t) => ({ ...t, n: stories.filter((s) => s.themes.includes(t.id)).length }));
  const covered = coverage.filter((c) => c.n > 0).length;
  const lpCovered = AMAZON_LPS.filter((lp) => stories.some((s) => s.lps.includes(lp.name) || lp.themes.some((t) => s.themes.includes(t)))).length;

  const add = (s: Story) => {
    storyStore.set((prev) => [...prev, s]);
    setEditing(s.id);
  };
  const addExample = () => {
    const ex = EXAMPLE_STORIES[stories.length % EXAMPLE_STORIES.length];
    add({ ...newStory(), title: `${ex.title} (example: replace with yours)`, situation: ex.situation, task: ex.task, action: ex.action, result: ex.result, themes: [...ex.themes] });
  };
  const exportMd = () => storyToMarkdown(stories);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => add(newStory())} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan px-4 text-sm font-semibold text-white hover:brightness-110">
          <Plus size={16} /> New story
        </button>
        <button type="button" onClick={addExample} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-panel px-4 text-sm font-semibold text-ink hover:border-cyan/50">
          <FilePlus2 size={16} /> Start from an example
        </button>
        {stories.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(exportMd());
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-panel px-3 text-sm text-dim hover:text-ink"
            >
              {copied ? <Check size={15} className="text-emerald" /> : <Copy size={15} />} Copy as Markdown
            </button>
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([exportMd()], { type: "text/markdown" }));
                const link = Object.assign(document.createElement("a"), { href: url, download: "star-stories.md" });
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-panel px-3 text-sm text-dim hover:text-ink"
            >
              <Download size={15} /> Download
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-faint">Stories are saved in this browser only. Use Download to keep a copy.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <div className="text-xs font-semibold tracking-wide text-faint uppercase">Stories</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            {stories.length}
            <span className="text-base font-medium text-faint"> / 6–8</span>
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs font-semibold tracking-wide text-faint uppercase">Themes covered</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            {covered}
            <span className="text-base font-medium text-faint"> / {THEMES.length}</span>
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-xs font-semibold tracking-wide text-faint uppercase">Amazon LPs reachable</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            {lpCovered}
            <span className="text-base font-medium text-faint"> / {AMAZON_LPS.length}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {coverage.map((c) => (
          <span
            key={c.id}
            title={c.story}
            className={clsx("rounded-lg border px-2 py-1 text-xs", c.n ? "border-emerald/40 bg-emerald/10 font-semibold text-emerald" : "border-dashed border-line-2 text-faint")}
          >
            {c.label}
            {c.n > 0 && ` · ${c.n}`}
          </span>
        ))}
      </div>

      {current && (
        <div className="mt-5">
          <Editor
            story={current}
            onChange={(s) => storyStore.set((prev) => prev.map((x) => (x.id === s.id ? s : x)))}
            onDelete={() => {
              storyStore.set((prev) => prev.filter((x) => x.id !== current.id));
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        </div>
      )}

      {stories.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {stories
            .filter((s) => s.id !== editing)
            .map((s) => {
              const a = analyzeStory(s);
              return (
                <button key={s.id} type="button" onClick={() => setEditing(s.id)} className="panel p-4 text-left transition hover:border-cyan/40">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{s.title || "Untitled story"}</span>
                    <span className={clsx("shrink-0 font-mono text-xs", a.checks.length && a.score === a.checks.length ? "text-emerald" : "text-faint")}>
                      {a.checks.length ? `${a.score}/${a.checks.length}` : "empty"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-dim">{s.situation || "No situation yet."}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.themes.map((t) => (
                      <span key={t} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-dim">
                        {THEMES.find((x) => x.id === t)?.label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
        </div>
      )}
      {stories.length === 0 && (
        <div className="mt-5 rounded-xl border border-dashed border-line-2 bg-panel-2 p-6 text-center text-sm text-dim">
          No stories yet. Start with your proudest project, then a failure, then a conflict. Those three alone answer about half of all behavioral questions.
        </div>
      )}
    </div>
  );
}

export const themeLabel = (id: ThemeId) => THEMES.find((t) => t.id === id)?.label ?? id;
