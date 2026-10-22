"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import type { QuizQuestion } from "@/content/types";
import { useGame } from "@/lib/game/store";
import { starsForScore, type Outcome } from "@/lib/game/engine";
import { sfx } from "@/lib/sound";
import { Button, LinkButton, Stars } from "@/components/ui";
import { QuestionCard } from "@/components/game/QuestionCard";

export function LessonQuiz({
  lessonKey,
  quiz,
  nextHref,
  nextLabel,
  accent,
}: {
  lessonKey: string;
  quiz: QuizQuestion[];
  nextHref: string;
  nextLabel: string;
  accent: string;
}) {
  const play = useGame((s) => s.play);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"ask" | "revealed" | "submitting" | "done">("ask");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [streak, setStreak] = useState(0);

  const q = quiz[idx];
  const correct = answers.filter((a, i) => a === quiz[i].answer).length;

  function choose(i: number) {
    if (phase !== "ask") return;
    setSelected(i);
    setAnswers((a) => [...a, i]);
    setPhase("revealed");
    if (i === q.answer) {
      sfx.correct();
      setStreak((s) => s + 1);
    } else {
      sfx.wrong();
      setStreak(0);
    }
  }

  async function next() {
    if (phase !== "revealed") return;
    if (idx < quiz.length - 1) {
      setIdx(idx + 1);
      setSelected(null);
      setPhase("ask");
      return;
    }
    setPhase("submitting");
    const all = answers;
    const right = all.filter((a, i) => a === quiz[i].answer).length;
    const o = await play({ type: "quiz", lessonKey, answers: all }, { type: "quiz", lessonKey, correct: right, total: quiz.length });
    setOutcome(o);
    setPhase("done");
    const stars = starsForScore(right, quiz.length);
    if (stars === 3) {
      sfx.victory();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: [accent, "#fbbf24", "#22d3ee", "#f472b6"] });
    } else if (stars === 0) sfx.defeat();
  }

  function retry() {
    setIdx(0);
    setAnswers([]);
    setSelected(null);
    setOutcome(null);
    setStreak(0);
    setPhase("ask");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (phase === "ask" && n >= 1 && n <= (quiz[idx]?.options.length ?? 0)) choose(n - 1);
      if (phase === "revealed" && e.key === "Enter") void next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (phase === "done") {
    const stars = outcome?.stars ?? starsForScore(correct, quiz.length);
    const pct = Math.round((correct / quiz.length) * 100);
    return (
      <div className="panel neon-border p-8 text-center" style={{ "--accent": accent } as React.CSSProperties}>
        <div className="font-pixel text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
          {stars === 3 ? "Flawless!" : stars > 0 ? "Level complete" : "Try again"}
        </div>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }} className="my-6 flex justify-center">
          <Stars count={stars} size={52} />
        </motion.div>
        <div className="font-display text-4xl font-bold text-ink">
          {correct}/{quiz.length}
          <span className="ml-2 text-lg text-dim">({pct}%)</span>
        </div>
        <p className="mt-2 text-sm text-dim">
          {stars === 0
            ? "You need 50% to clear the level. Review the lesson and try again — no penalty."
            : stars < 3
              ? "Cleared! Hit 100% for the third star."
              : "Every answer right. The interviewer is impressed."}
        </p>
        {outcome && outcome.xpGained > 0 && <div className="mt-4 font-display text-2xl font-bold text-cyan glow-text">+{outcome.xpGained} XP</div>}
        {outcome && outcome.xpGained === 0 && stars > 0 && <div className="mt-4 text-sm text-faint">No new XP — beat your best star count to earn more.</div>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={retry}>
            Retry quiz
          </Button>
          {stars > 0 && <LinkButton href={nextHref}>{nextLabel}</LinkButton>}
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-5 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {quiz.map((qq, i) => (
            <div
              key={i}
              className={clsx(
                "h-2 flex-1 rounded-full transition-colors",
                i < answers.length ? (answers[i] === qq.answer ? "bg-emerald" : "bg-rose") : i === idx ? "bg-cyan/60" : "bg-line",
              )}
            />
          ))}
        </div>
        {streak >= 2 && <span className="animate-pop font-pixel text-[9px] text-orange">🔥 x{streak}</span>}
        <span className="font-mono text-xs text-faint">
          {idx + 1}/{quiz.length}
        </span>
      </div>
      <QuestionCard key={idx} q={q} selected={selected} revealed={phase !== "ask"} onSelect={choose} />
      <div className="mt-6 flex items-center justify-between">
        <span className="hidden text-xs text-faint sm:block">Keys 1–{q.options.length} to answer · Enter to continue</span>
        <Button onClick={next} disabled={phase !== "revealed"} className="ml-auto">
          {phase === "submitting" ? "Saving…" : idx < quiz.length - 1 ? "Next question" : "Finish"}
        </Button>
      </div>
    </div>
  );
}
