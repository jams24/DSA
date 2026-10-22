"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Zap } from "lucide-react";
import type { PooledQuestion } from "@/content/types";
import type { Outcome } from "@/lib/game/engine";
import { useGame } from "@/lib/game/store";
import { sfx } from "@/lib/sound";
import { useCatalog } from "@/components/game/GameProvider";
import { Button, InlineMd } from "@/components/ui";

const DURATION = 60;

export function RapidFire() {
  const catalog = useCatalog();
  const play = useGame((s) => s.play);
  const [worlds, setWorlds] = useState<string[]>([]);
  const [phase, setPhase] = useState<"setup" | "loading" | "play" | "done">("setup");
  const [deck, setDeck] = useState<PooledQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<{ id: string; choice: number }[]>([]);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [left, setLeft] = useState(DURATION);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [best, setBest] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    try {
      const b = Number(localStorage.getItem("dq-rapid-best") ?? 0);
      const t = setTimeout(() => setBest(b), 0);
      return () => clearTimeout(t);
    } catch {}
  }, []);

  async function start() {
    setPhase("loading");
    const res = await fetch(`/api/arena?n=80&worlds=${worlds.join(",")}`);
    const { questions } = await res.json();
    setDeck(questions);
    setIdx(0);
    setAnswers([]);
    setOutcome(null);
    setLeft(DURATION);
    done.current = false;
    setPhase("play");
  }

  async function finish(all: { id: string; choice: number }[]) {
    if (done.current) return;
    done.current = true;
    setPhase("done");
    const correct = all.filter((a) => deck.find((q) => q.id === a.id)?.answer === a.choice).length;
    if (correct > best) {
      setBest(correct);
      try {
        localStorage.setItem("dq-rapid-best", String(correct));
      } catch {}
    }
    sfx.victory();
    if (all.length) setOutcome(await play({ type: "arena", answers: all }, { type: "arena", correct, total: all.length }));
  }

  useEffect(() => {
    if (phase !== "play") return;
    if (left <= 0) {
      const t = setTimeout(() => finish(answers), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  });

  function choose(choice: number) {
    if (phase !== "play" || flash) return;
    const q = deck[idx];
    const right = choice === q.answer;
    const all = [...answers, { id: q.id, choice }];
    setAnswers(all);
    setFlash(right ? "right" : "wrong");
    if (right) sfx.correct();
    else sfx.wrong();
    setTimeout(() => {
      setFlash(null);
      if (idx + 1 >= deck.length) void finish(all);
      else setIdx((i) => i + 1);
    }, right ? 250 : 650);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (phase === "play" && n >= 1 && n <= 4) choose(n - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const correct = answers.filter((a) => deck.find((q) => q.id === a.id)?.answer === a.choice).length;

  if (phase === "setup" || phase === "loading") {
    return (
      <div className="panel p-6 text-center sm:p-10">
        <Zap size={44} className="mx-auto text-cyan drop-shadow-[0_0_12px_#0891b2]" />
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">Rapid Fire</h1>
        <p className="mx-auto mt-2 max-w-md text-dim">{DURATION} seconds. Answer as many as you can — wrong answers cost you time, not points. Keys 1–4 work.</p>
        <div className="mt-7">
          <div className="mb-2 text-xs text-faint">Draw questions from (none selected = all worlds)</div>
          <div className="flex flex-wrap justify-center gap-2">
            {catalog.map((w) => {
              const on = worlds.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWorlds((ws) => (on ? ws.filter((x) => x !== w.id) : [...ws, w.id]))}
                  className={clsx("rounded-full border px-3 py-1.5 text-sm transition", on ? "text-ink" : "border-line-2 text-dim hover:text-ink")}
                  style={on ? { borderColor: w.color, background: `${w.color}22` } : undefined}
                >
                  {w.emoji} {w.title}
                </button>
              );
            })}
          </div>
        </div>
        {best > 0 && <div className="mt-6 font-pixel text-[10px] text-amber">PERSONAL BEST: {best}</div>}
        <Button size="lg" className="mt-7" onClick={start} disabled={phase === "loading"}>
          {phase === "loading" ? "Loading…" : "Start the clock"}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const wrong = answers.filter((a) => deck.find((q) => q.id === a.id)?.answer !== a.choice);
    return (
      <div className="space-y-5">
        <div className="panel neon-border p-8 text-center" style={{ "--accent": "#0891b2" } as React.CSSProperties}>
          <div className="font-pixel text-[10px] tracking-widest text-cyan">TIME!</div>
          <div className="mt-4 font-display text-6xl font-bold text-ink">{correct}</div>
          <div className="text-dim">
            correct out of {answers.length} answered · {answers.length ? Math.round((correct / answers.length) * 100) : 0}% accuracy
          </div>
          {correct >= best && correct > 0 && <div className="mt-3 font-pixel text-[10px] text-amber">NEW PERSONAL BEST!</div>}
          {outcome && outcome.xpGained > 0 && <div className="mt-4 font-display text-2xl font-bold text-cyan glow-text">+{outcome.xpGained} XP</div>}
          {outcome?.capped && <div className="mt-2 text-xs text-faint">Daily Arena XP cap reached.</div>}
          <Button className="mt-6" onClick={() => setPhase("setup")}>
            Play again
          </Button>
        </div>
        {wrong.length > 0 && (
          <div className="panel p-5">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">Review your misses</h2>
            <div className="space-y-4">
              {wrong.map((a) => {
                const q = deck.find((x) => x.id === a.id)!;
                return (
                  <div key={a.id} className="rounded-xl border border-line bg-panel-2/60 p-4 text-sm">
                    <div className="font-medium text-ink">
                      <InlineMd text={q.q} />
                    </div>
                    <div className="mt-2 text-emerald">
                      ✓ <InlineMd text={q.options[q.answer]} />
                    </div>
                    {a.choice >= 0 && (
                      <div className="text-rose">
                        ✗ <InlineMd text={q.options[a.choice]} />
                      </div>
                    )}
                    <div className="mt-2 text-dim">
                      <InlineMd text={q.explain} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const q = deck[idx];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={clsx("font-pixel text-2xl tabular-nums", left <= 10 ? "text-rose" : "text-cyan")}>{left}s</div>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
          <div className={clsx("h-full transition-[width] duration-1000 ease-linear", left <= 10 ? "bg-rose" : "bg-cyan")} style={{ width: `${(left / DURATION) * 100}%` }} />
        </div>
        <div className="font-pixel text-sm text-emerald">✓ {correct}</div>
      </div>
      <div
        className={clsx(
          "panel p-5 transition sm:p-7",
          flash === "right" && "border-emerald shadow-[0_0_30px_-8px_#059669]",
          flash === "wrong" && "animate-shake border-rose",
        )}
      >
        <div className="mb-3 text-xs text-faint">{q.lessonTitle}</div>
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
          <InlineMd text={q.q} />
        </h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              className={clsx(
                "rounded-xl border-2 px-4 py-3 text-left text-sm transition",
                flash && i === q.answer ? "border-emerald bg-emerald/10" : "border-line-2 bg-panel-2 hover:border-cyan/60",
              )}
            >
              <span className="mr-2 font-pixel text-[9px] text-faint">{i + 1}</span>
              <InlineMd text={o} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
