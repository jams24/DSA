"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import confetti from "canvas-confetti";
import type { PooledQuestion } from "@/content/types";
import type { Outcome } from "@/lib/game/engine";
import { useGame, usePlayer } from "@/lib/game/store";
import { sfx } from "@/lib/sound";
import { useCatalog } from "@/components/game/GameProvider";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Button, LinkButton } from "@/components/ui";

export function DailyChallenge() {
  const catalog = useCatalog();
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const play = useGame((s) => s.play);
  const [data, setData] = useState<{ day: string; questions: PooledQuestion[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [phase, setPhase] = useState<"ask" | "revealed" | "done">("ask");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    fetch("/api/daily")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || !ready) return <div className="shimmer panel h-96" />;
  const claimed = player.stats.claims?.includes(`daily:${data.day}`);
  const q = data.questions[idx];
  const world = (id: string) => catalog.find((w) => w.id === id);

  function choose(i: number) {
    if (phase !== "ask") return;
    setAnswers((a) => [...a, i]);
    setPhase("revealed");
    if (i === q.answer) sfx.correct();
    else sfx.wrong();
  }

  async function next() {
    if (!data) return;
    if (idx < data.questions.length - 1) {
      setIdx(idx + 1);
      setPhase("ask");
      return;
    }
    setPhase("done");
    const correct = answers.filter((a, i) => a === data.questions[i].answer).length;
    if (!claimed) {
      const o = await play({ type: "daily", answers }, { type: "daily", day: data.day, correct, total: data.questions.length });
      setOutcome(o);
    }
    if (correct === data.questions.length) {
      sfx.victory();
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    }
  }

  const correct = answers.filter((a, i) => a === data.questions[i]?.answer).length;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="font-pixel text-[10px] tracking-widest text-amber">DAILY CHALLENGE · {data.day}</div>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Five questions. Every world.</h1>
        {claimed && phase !== "done" && <p className="mt-2 text-sm text-dim">You already claimed today&apos;s reward — this run is practice.</p>}
      </div>

      {phase === "done" ? (
        <div className="panel neon-border p-8 text-center" style={{ "--accent": "#fbbf24" } as React.CSSProperties}>
          <div className="font-display text-5xl font-bold text-ink">
            {correct}/{data.questions.length}
          </div>
          <div className="mt-6 flex justify-center gap-2">
            {data.questions.map((qq, i) => (
              <span key={i} className={clsx("h-3 w-10 rounded-full", answers[i] === qq.answer ? "bg-emerald" : "bg-rose")} />
            ))}
          </div>
          {outcome?.xpGained ? <div className="mt-5 font-display text-2xl font-bold text-cyan glow-text">+{outcome.xpGained} XP</div> : null}
          <p className="mt-3 text-sm text-dim">Come back after 00:00 UTC for a new set and keep your streak alive. 🔥 {player.streak}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/arena/rapid-fire" variant="secondary">
              Try Rapid Fire
            </LinkButton>
            <LinkButton href="/worlds">Back to the worlds</LinkButton>
          </div>
        </div>
      ) : (
        <div className="panel p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            {data.questions.map((qq, i) => (
              <span
                key={i}
                className={clsx(
                  "h-2 flex-1 rounded-full",
                  i < answers.length ? (answers[i] === qq.answer ? "bg-emerald" : "bg-rose") : i === idx ? "bg-amber/70" : "bg-line",
                )}
              />
            ))}
          </div>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span>{world(q.worldId)?.emoji}</span>
            <span style={{ color: world(q.worldId)?.color }}>{world(q.worldId)?.title}</span>
            <span className="text-faint">· {q.lessonTitle}</span>
          </div>
          <QuestionCard key={q.id} q={q} selected={phase === "revealed" ? answers[idx] : null} revealed={phase === "revealed"} onSelect={choose} />
          <div className="mt-6 flex justify-end">
            <Button onClick={next} disabled={phase !== "revealed"}>
              {idx < data.questions.length - 1 ? "Next" : "Finish"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
