"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { AMAZON_LPS, BEHAVIORAL_QUESTIONS, type ThemeId } from "@/content/interview";
import { storyStore } from "./stories";
import { clock, useStopwatch } from "./useStopwatch";

const SELF_CHECK = ["Opened with a one-line headline", "Situation + Task took under 30 seconds", "Said \"I\" for my own actions", "Explained at least one decision I made", "Gave a number or concrete change in the Result", "Ended with a lesson", "Finished within 3 minutes"];

type Q = { q: string; themes: ThemeId[]; tag?: string };
const POOL: Record<"common" | "amazon", Q[]> = {
  common: BEHAVIORAL_QUESTIONS.filter((q) => q.themes.length && !q.q.startsWith("Tell me about yourself") && !q.q.startsWith("Why do you") && !q.q.startsWith("Where do you")),
  amazon: AMAZON_LPS.map((lp) => ({ q: lp.question, themes: lp.themes, tag: lp.name })),
};

export function PracticeDrill() {
  const stories = storyStore.use();
  const [pool, setPool] = useState<"common" | "amazon">("common");
  const [index, setIndex] = useState<number | null>(null);
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const sw = useStopwatch();
  const q = index === null ? null : POOL[pool][index % POOL[pool].length];
  const matches = q ? stories.filter((s) => s.themes.some((t) => q.themes.includes(t)) || (q.tag && s.lps.includes(q.tag))) : [];

  const next = () => {
    const n = POOL[pool].length;
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === index) i = (i + 1) % n;
    setIndex(i);
    setChecks(new Set());
    sw.reset();
  };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["common", "amazon"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pool === p}
            onClick={() => {
              setPool(p);
              setIndex(null);
              sw.reset();
            }}
            className={clsx("rounded-lg border px-3 py-1.5 text-sm font-semibold", pool === p ? "border-ink bg-ink text-white" : "border-line-2 text-dim hover:text-ink")}
          >
            {p === "common" ? "Common questions" : "Amazon LP questions"}
          </button>
        ))}
        <button type="button" onClick={next} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-cyan px-3 text-sm font-semibold text-white hover:brightness-110">
          <Shuffle size={15} /> {q ? "Next question" : "Give me a question"}
        </button>
      </div>

      {q ? (
        <div className="mt-4">
          {q.tag && <div className="text-xs font-semibold text-orange">{q.tag}</div>}
          <p className="mt-1 font-display text-xl font-semibold text-ink">“{q.q}”</p>

          <div className="mt-3 text-sm text-dim">
            {matches.length ? (
              <>
                Stories that fit: <span className="font-semibold text-ink">{matches.map((s) => s.title || "Untitled").join(", ")}</span>
              </>
            ) : (
              "None of your stories are tagged for this yet. Answer with your best match, then tag it in the story bank."
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={clsx("font-mono text-3xl font-bold tabular-nums", sw.elapsed > 180 ? "text-rose" : sw.elapsed > 150 ? "text-amber" : "text-ink")}>{clock(sw.elapsed)}</span>
            <button type="button" onClick={sw.running ? sw.pause : sw.start} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-2 bg-panel px-3 text-sm font-semibold text-ink hover:border-cyan/50">
              {sw.running ? <Pause size={15} /> : <Play size={15} />} {sw.running ? "Pause" : sw.elapsed ? "Resume" : "Start answering out loud"}
            </button>
            <button type="button" onClick={sw.reset} className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 text-dim hover:text-ink" aria-label="Reset timer">
              <RotateCcw size={15} />
            </button>
            <span className="text-xs text-faint">Target: 2–3 minutes. Say it out loud; reading in your head doesn&apos;t count.</span>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold tracking-wide text-faint uppercase">After you answer: self-check</div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {SELF_CHECK.map((c, i) => (
                <label key={c} className="flex cursor-pointer items-start gap-2 text-sm text-dim">
                  <input
                    type="checkbox"
                    checked={checks.has(i)}
                    onChange={() =>
                      setChecks((prev) => {
                        const n = new Set(prev);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className="mt-0.5 accent-emerald-600"
                  />
                  {c}
                </label>
              ))}
            </div>
            {checks.size > 0 && (
              <p className={clsx("mt-2 text-sm font-semibold", checks.size === SELF_CHECK.length ? "text-emerald" : "text-dim")}>
                {checks.size === SELF_CHECK.length ? "Interview-ready answer. Do it again tomorrow with a different story." : `${checks.size}/${SELF_CHECK.length}. Answer again and fix the unchecked ones.`}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-dim">Get a random question, pick a story from your bank, and answer it out loud against the clock. Five reps a day for a week makes a big difference.</p>
      )}
    </div>
  );
}
