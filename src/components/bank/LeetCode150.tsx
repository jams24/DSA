"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Check, ExternalLink, Lightbulb, Search } from "lucide-react";
import { lcUrl, type LcCategory, type LcDifficulty } from "@/content/leetcode150";
import { REWARDS } from "@/lib/game/engine";
import { useGame, usePlayer } from "@/lib/game/store";
import { sfx } from "@/lib/sound";
import { ProgressBar, ProgressRing } from "@/components/ui";

export interface LessonRef {
  href: string;
  title: string;
  emoji: string;
  color: string;
}

const DIFF_CLS: Record<LcDifficulty, string> = {
  Easy: "text-emerald",
  Medium: "text-amber",
  Hard: "text-rose",
};

export function LeetCode150({ categories, lessons }: { categories: LcCategory[]; lessons: Record<string, LessonRef> }) {
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const play = useGame((s) => s.play);
  const user = useGame((s) => s.user);
  const solved = useMemo(() => new Set(ready ? (player.stats.solved ?? []) : []), [player.stats.solved, ready]);
  const [query, setQuery] = useState("");
  const [diff, setDiff] = useState<"all" | LcDifficulty>("all");
  const [hideSolved, setHideSolved] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [hints, setHints] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const all = categories.flatMap((c) => c.problems);
  const byDiff = (d: LcDifficulty) => {
    const ps = all.filter((p) => p.difficulty === d);
    return { total: ps.length, done: ps.filter((p) => solved.has(p.slug)).length };
  };
  const doneCount = all.filter((p) => solved.has(p.slug)).length;
  const nextUp = all.find((p) => !solved.has(p.slug));

  const q = query.trim().toLowerCase();
  const visible = categories
    .filter((c) => !category || c.category === category)
    .map((c) => ({
      ...c,
      problems: c.problems.filter(
        (p) =>
          (diff === "all" || p.difficulty === diff) &&
          (!hideSolved || !solved.has(p.slug)) &&
          (!q || p.title.toLowerCase().includes(q) || String(p.id) === q || c.category.toLowerCase().includes(q)),
      ),
    }))
    .filter((c) => c.problems.length);

  async function toggle(slug: string) {
    if (!ready || pending.has(slug)) return;
    const next = !solved.has(slug);
    if (next) sfx.correct();
    else sfx.click();
    setPending((s) => new Set(s).add(slug));
    await play({ type: "solve", slug, solved: next }, { type: "solve", slug, solved: next });
    setPending((s) => {
      const n = new Set(s);
      n.delete(slug);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      {/* summary */}
      <div className="panel grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="flex items-center gap-4">
          <ProgressRing value={(doneCount / all.length) * 100} size={96} stroke={8} color="#d97706">
            <div className="text-center">
              <div className="font-display text-2xl font-bold text-ink">{ready ? doneCount : "…"}</div>
              <div className="text-[10px] text-faint">of {all.length}</div>
            </div>
          </ProgressRing>
          <div>
            <div className="font-display text-lg font-semibold text-ink">{doneCount === all.length ? "All 150 solved 🥇" : "Problems solved"}</div>
            <div className="text-sm text-dim">+{REWARDS.solve} XP each · achievements at 25, 75 and 150</div>
            {nextUp && (
              <a href={lcUrl(nextUp.slug)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline">
                Next up: {nextUp.id}. {nextUp.title} <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
        <div className="grid content-center gap-3">
          {(["Easy", "Medium", "Hard"] as const).map((d) => {
            const s = byDiff(d);
            return (
              <div key={d} className="grid grid-cols-[64px_1fr_56px] items-center gap-3 text-sm">
                <span className={clsx("font-semibold", DIFF_CLS[d])}>{d}</span>
                <ProgressBar value={(s.done / s.total) * 100} color={d === "Easy" ? "#059669" : d === "Medium" ? "#d97706" : "#e11d48"} height={8} />
                <span className="text-right font-mono text-xs text-dim">
                  {s.done}/{s.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!user && ready && (
        <div className="rounded-xl border border-cyan/30 bg-cyan/[0.06] px-4 py-3 text-sm text-dim">
          Playing as a guest — your ticks are saved in this browser.{" "}
          <Link href="/login?next=/leetcode-150" className="font-semibold text-cyan hover:underline">
            Sign in
          </Link>{" "}
          to keep them across devices.
        </div>
      )}

      {/* filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, number or category"
              className="h-10 w-full rounded-xl border border-line-2 bg-panel pr-3 pl-9 text-sm text-ink outline-none placeholder:text-faint focus:border-cyan/60"
            />
          </div>
          {(["all", "Easy", "Medium", "Hard"] as const).map((d) => (
            <Chip key={d} on={diff === d} onClick={() => setDiff(d)}>
              {d === "all" ? "Any difficulty" : d}
            </Chip>
          ))}
          <Chip on={hideSolved} onClick={() => setHideSolved((v) => !v)}>
            Hide solved
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!category} onClick={() => setCategory(null)}>
            All categories
          </Chip>
          {categories.map((c) => {
            const done = c.problems.filter((p) => solved.has(p.slug)).length;
            return (
              <Chip key={c.category} on={category === c.category} onClick={() => setCategory(category === c.category ? null : c.category)}>
                {c.category}{" "}
                <span className={clsx("ml-1 font-mono", done === c.problems.length ? "text-emerald" : "text-faint")}>
                  {done}/{c.problems.length}
                </span>
              </Chip>
            );
          })}
        </div>
      </div>

      {/* lists */}
      {visible.length === 0 && <div className="panel p-8 text-center text-dim">No problems match these filters.</div>}
      {visible.map((c) => {
        const full = categories.find((x) => x.category === c.category)!;
        const done = full.problems.filter((p) => solved.has(p.slug)).length;
        const lesson = lessons[c.lesson];
        return (
          <section key={c.category} className="panel overflow-hidden">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
              <h2 className="font-display text-lg font-semibold text-ink">{c.category}</h2>
              <span className="font-mono text-xs text-dim">
                {done}/{full.problems.length}
              </span>
              <div className="w-24">
                <ProgressBar value={(done / full.problems.length) * 100} color={lesson?.color ?? "#0891b2"} height={6} />
              </div>
              {lesson && (
                <Link href={lesson.href} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-2.5 py-1 text-xs text-dim transition hover:border-cyan/50 hover:text-ink">
                  {lesson.emoji} Learn the pattern: <span className="font-semibold text-ink">{lesson.title}</span>
                </Link>
              )}
            </header>
            <ul className="divide-y divide-line">
              {c.problems.map((p) => {
                const isDone = solved.has(p.slug);
                const showHint = hints.has(p.slug);
                return (
                  <li key={p.slug} className={clsx("px-4 py-2.5 transition", isDone && "bg-emerald/[0.04]")}>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggle(p.slug)}
                        disabled={!ready || pending.has(p.slug)}
                        aria-label={isDone ? `Mark ${p.title} unsolved` : `Mark ${p.title} solved`}
                        className={clsx(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition",
                          isDone ? "border-emerald bg-emerald text-white" : "border-line-2 bg-panel hover:border-emerald",
                          pending.has(p.slug) && "opacity-50",
                        )}
                      >
                        {isDone && <Check size={14} strokeWidth={3} />}
                      </button>
                      <span className="w-10 shrink-0 font-mono text-xs text-faint">{p.id}</span>
                      <a
                        href={lcUrl(p.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className={clsx("min-w-0 flex-1 truncate text-sm hover:text-cyan", isDone ? "text-dim line-through decoration-emerald/60" : "text-ink")}
                      >
                        {p.title}
                      </a>
                      <span className={clsx("hidden w-16 text-xs font-semibold sm:block", DIFF_CLS[p.difficulty])}>{p.difficulty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHints((h) => {
                            const n = new Set(h);
                            if (n.has(p.slug)) n.delete(p.slug);
                            else n.add(p.slug);
                            return n;
                          })
                        }
                        className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-lg transition", showHint ? "bg-amber/15 text-amber" : "text-faint hover:bg-slate-900/5 hover:text-ink")}
                        aria-label="Show hint"
                        title="Show hint"
                      >
                        <Lightbulb size={15} />
                      </button>
                      <a href={lcUrl(p.slug)} target="_blank" rel="noreferrer" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-slate-900/5 hover:text-cyan" aria-label="Open on LeetCode">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                    {showHint && (
                      <div className="mt-2 ml-[4.75rem] animate-pop rounded-lg border border-amber/30 bg-amber/[0.06] px-3 py-2 text-sm text-[#92400e]">
                        <span className="sm:hidden">
                          <span className={clsx("mr-1 font-semibold", DIFF_CLS[p.difficulty])}>{p.difficulty}.</span>
                        </span>
                        {p.hint}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("rounded-full border px-3 py-1.5 text-xs transition", on ? "border-cyan bg-cyan/10 text-ink" : "border-line-2 bg-panel text-dim hover:text-ink")}
    >
      {children}
    </button>
  );
}
