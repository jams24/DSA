"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import confetti from "canvas-confetti";
import { Heart } from "lucide-react";
import type { Boss, PooledQuestion } from "@/content/types";
import { BOSS_HEARTS, BOSS_HP, type Outcome } from "@/lib/game/engine";
import { useGame } from "@/lib/game/store";
import { shuffle } from "@/lib/random";
import { sfx } from "@/lib/sound";
import { Button, LinkButton, Stars } from "@/components/ui";
import { QuestionCard } from "./QuestionCard";

const SECONDS = 25;

type Phase = "intro" | "ask" | "revealed" | "won" | "lost";

export function BossBattle({ worldId, worldTitle, color, boss, pool }: { worldId: string; worldTitle: string; color: string; boss: Boss; pool: PooledQuestion[] }) {
  const play = useGame((s) => s.play);
  const [deck, setDeck] = useState<PooledQuestion[]>([]);
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(BOSS_HP);
  const [hearts, setHearts] = useState(BOSS_HEARTS);
  const [phase, setPhase] = useState<Phase>("intro");
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ id: string; choice: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [fx, setFx] = useState<{ kind: "hit" | "hurt"; n: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [combo, setCombo] = useState(0);
  const submitted = useRef(false);

  const q = deck[i];

  function start() {
    setDeck(shuffle(pool).slice(0, BOSS_HP + BOSS_HEARTS - 1));
    setI(0);
    setHp(BOSS_HP);
    setHearts(BOSS_HEARTS);
    setAnswers([]);
    setSelected(null);
    setOutcome(null);
    setCombo(0);
    setTimeLeft(SECONDS);
    submitted.current = false;
    setPhase("ask");
    sfx.click();
  }

  async function finish(all: { id: string; choice: number }[], won: boolean, heartsLeft: number) {
    if (submitted.current) return;
    submitted.current = true;
    setPhase(won ? "won" : "lost");
    if (won) {
      sfx.victory();
      const colors = [color, "#fbbf24", "#22d3ee", "#f472b6"];
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 }, colors });
      setTimeout(() => confetti({ particleCount: 90, spread: 120, origin: { y: 0.4 }, colors }), 400);
    } else sfx.defeat();
    const o = await play({ type: "boss", worldId, answers: all }, { type: "boss", worldId, won, heartsLeft });
    setOutcome(o);
  }

  function answer(choice: number) {
    if (phase !== "ask" || !q) return;
    setSelected(choice);
    setPhase("revealed");
    const right = choice === q.answer;
    const all = [...answers, { id: q.id, choice }];
    setAnswers(all);
    if (right) {
      sfx.hit();
      setCombo((c) => c + 1);
      setHp((h) => h - 1);
      setFx({ kind: "hit", n: Date.now() });
    } else {
      sfx.hurt();
      setCombo(0);
      setHearts((h) => h - 1);
      setFx({ kind: "hurt", n: Date.now() });
    }
  }

  function advance() {
    if (phase !== "revealed") return;
    const all = answers;
    if (hp <= 0) return void finish(all, true, hearts);
    if (hearts <= 0) return void finish(all, false, 0);
    setI((x) => x + 1);
    setSelected(null);
    setTimeLeft(SECONDS);
    setPhase("ask");
  }

  // countdown
  useEffect(() => {
    if (phase !== "ask") return;
    if (timeLeft <= 0) {
      const t = setTimeout(() => answer(-1), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setTimeLeft((s) => s - 1);
      if (timeLeft <= 6) sfx.tick();
    }, 1000);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (phase === "ask" && q && n >= 1 && n <= q.options.length) answer(n - 1);
      if (phase === "revealed" && e.key === "Enter") advance();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (pool.length < BOSS_HP + BOSS_HEARTS) {
    return <div className="panel p-8 text-center text-dim">This world needs more quiz questions before its boss can fight.</div>;
  }

  if (phase === "intro") {
    return (
      <div className="panel relative overflow-hidden p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgb(251_113_133/0.18),transparent_60%)]" />
        <div className="relative">
          <div className="font-pixel text-[10px] tracking-[0.3em] text-rose">A WILD BOSS APPEARS</div>
          <div className="my-6 animate-float text-8xl sm:text-9xl">{boss.emoji}</div>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{boss.name}</h1>
          <div className="mt-1 text-rose/80">{boss.title}</div>
          <p className="mx-auto mt-5 max-w-md text-dim italic">“{boss.taunt}”</p>
          <div className="mx-auto mt-8 grid max-w-md gap-2 text-left text-sm text-dim sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel-2 p-3">⚔️ Land <b className="text-ink">{BOSS_HP} hits</b> to win</div>
            <div className="rounded-xl border border-line bg-panel-2 p-3">❤️ You have <b className="text-ink">{BOSS_HEARTS} hearts</b></div>
            <div className="rounded-xl border border-line bg-panel-2 p-3">⏱ <b className="text-ink">{SECONDS}s</b> per question</div>
          </div>
          <Button size="lg" variant="danger" className="mt-8" onClick={start}>
            Fight!
          </Button>
          <p className="mt-3 text-xs text-faint">Questions are drawn from every level in {worldTitle}.</p>
        </div>
      </div>
    );
  }

  if (phase === "won" || phase === "lost") {
    const won = phase === "won";
    return (
      <div className={clsx("panel p-8 text-center sm:p-12", won ? "neon-border" : "")} style={{ "--accent": won ? "#34d399" : "#fb7185" } as React.CSSProperties}>
        <div className={clsx("font-pixel text-xs tracking-[0.3em]", won ? "text-emerald" : "text-rose")}>{won ? "VICTORY" : "DEFEATED"}</div>
        <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className={clsx("my-6 text-8xl", won && "grayscale")}>
          {won ? "🏆" : boss.emoji}
        </motion.div>
        <p className="mx-auto max-w-md text-dim italic">“{won ? boss.defeat : boss.taunt}”</p>
        {won && (
          <div className="mt-5 flex justify-center">
            <Stars count={hearts} size={44} />
          </div>
        )}
        {outcome && outcome.xpGained > 0 && <div className="mt-4 font-display text-3xl font-bold text-cyan glow-text">+{outcome.xpGained} XP</div>}
        {outcome?.capped && <div className="mt-2 text-xs text-faint">Daily replay XP cap reached — come back tomorrow for more.</div>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant={won ? "secondary" : "danger"} onClick={start}>
            {won ? "Fight again" : "Rematch"}
          </Button>
          <LinkButton href={`/worlds/${worldId}`} variant="secondary">
            Back to {worldTitle}
          </LinkButton>
          {won && <LinkButton href="/worlds">Next world</LinkButton>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* arena */}
      <div className={clsx("panel relative overflow-hidden p-5 sm:p-6", fx?.kind === "hurt" && "animate-shake")} key={fx?.kind === "hurt" ? fx.n : "arena"}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(251_113_133/0.15),transparent_55%)]" />
        <div className="relative grid grid-cols-[1fr_auto] items-center gap-6">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-display font-semibold text-ink">{boss.name}</span>
                <span className="font-mono text-rose">
                  {hp}/{BOSS_HP} HP
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: BOSS_HP }, (_, k) => (
                  <div key={k} className={clsx("h-3.5 flex-1 rounded-sm transition-all duration-500", k < hp ? "bg-gradient-to-b from-rose to-[#be123c] shadow-[0_0_8px_#fb7185]" : "bg-line")} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-dim">You</span>
              <div className="flex gap-1">
                {Array.from({ length: BOSS_HEARTS }, (_, k) => (
                  <Heart key={k} size={22} className={clsx("transition", k < hearts ? "fill-rose text-rose drop-shadow-[0_0_6px_#fb7185]" : "text-line-2")} />
                ))}
              </div>
              {combo >= 2 && <span className="animate-pop font-pixel text-[9px] text-orange">COMBO x{combo}</span>}
            </div>
          </div>
          <div className="relative grid h-24 w-24 place-items-center sm:h-28 sm:w-28">
            <motion.div
              key={fx?.kind === "hit" ? fx.n : "idle"}
              initial={fx?.kind === "hit" ? { x: 16, rotate: 12, filter: "brightness(3)" } : false}
              animate={{ x: 0, rotate: 0, filter: "brightness(1)" }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="text-7xl sm:text-8xl"
            >
              {boss.emoji}
            </motion.div>
            <AnimatePresence>
              {fx?.kind === "hit" && (
                <motion.span
                  key={fx.n}
                  initial={{ y: 0, opacity: 1, scale: 0.6 }}
                  animate={{ y: -50, opacity: 0, scale: 1.4 }}
                  transition={{ duration: 0.9 }}
                  className="absolute top-0 font-pixel text-sm text-amber"
                >
                  {combo >= 3 ? "CRIT!" : "-1"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* question */}
      {q && (
        <div className="panel p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-md bg-panel-3 px-2 py-1 text-[11px] text-dim">{q.lessonTitle}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className={clsx("h-full rounded-full transition-[width] duration-1000 ease-linear", timeLeft <= 6 ? "bg-rose" : "bg-amber")}
                style={{ width: `${phase === "ask" ? (timeLeft / SECONDS) * 100 : 0}%` }}
              />
            </div>
            <span className={clsx("w-8 text-right font-mono text-sm tabular-nums", timeLeft <= 6 ? "text-rose" : "text-dim")}>{phase === "ask" ? timeLeft : "–"}</span>
          </div>
          <QuestionCard key={q.id} q={q} selected={selected} revealed={phase === "revealed"} onSelect={answer} />
          <div className="mt-6 flex justify-end">
            <Button onClick={advance} disabled={phase !== "revealed"} variant={hp <= 0 || hearts <= 0 ? "danger" : "primary"}>
              {hp <= 0 ? "Finish him!" : hearts <= 0 ? "See result" : "Next attack"}
            </Button>
          </div>
        </div>
      )}
      <div className="text-center text-xs text-faint">
        <Link href={`/worlds/${worldId}`} className="hover:text-ink">
          Flee the battle
        </Link>
      </div>
    </div>
  );
}
