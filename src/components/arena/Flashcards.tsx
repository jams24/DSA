"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { motion } from "motion/react";
import { Eye, ThumbsDown, ThumbsUp, Timer } from "lucide-react";
import type { Frequency } from "@/content/types";
import { useGame, usePlayer } from "@/lib/game/store";
import { sfx } from "@/lib/sound";
import { useCatalog } from "@/components/game/GameProvider";
import { FREQ } from "@/components/lesson/Interview";
import { Button } from "@/components/ui";

interface Card {
  id: string;
  worldId: string;
  lessonTitle: string;
  q: string;
  html: string;
  freq?: Frequency;
}

export function Flashcards({ cards }: { cards: Card[] }) {
  const catalog = useCatalog();
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const play = useGame((s) => s.play);
  const [world, setWorld] = useState<string>("all");
  const [onlyCommon, setOnlyCommon] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [session, setSession] = useState({ knew: 0, missed: 0 });
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, [current]);

  const pool = useMemo(
    () => cards.filter((c) => (world === "all" || c.worldId === world) && (!onlyCommon || c.freq === "very-common")),
    [cards, world, onlyCommon],
  );
  const due = useMemo(
    () => pool.filter((c) => !player.cards[c.id] || Date.parse(player.cards[c.id].dueAt) <= now),
    [pool, player.cards, now],
  );
  const mastered = pool.filter((c) => (player.cards[c.id]?.box ?? 0) >= 4).length;
  const card = cards.find((c) => c.id === current) ?? null;

  function draw() {
    const fresh = due.filter((c) => c.id !== current);
    const list = fresh.length ? fresh : due;
    // prefer cards seen before (box 1 = missed) then new ones
    const sorted = [...list].sort((a, b) => (player.cards[a.id]?.box ?? 9) - (player.cards[b.id]?.box ?? 9));
    const pick = sorted.slice(0, 8)[Math.floor(Math.random() * Math.min(8, sorted.length))];
    setCurrent(pick?.id ?? null);
    setRevealed(false);
    setSeconds(0);
  }

  useEffect(() => {
    if (!card || revealed) return;
    const t = setTimeout(() => setSeconds((s) => s + 1), 1000);
    return () => clearTimeout(t);
  });

  async function grade(knew: boolean) {
    if (!card) return;
    if (knew) sfx.correct();
    else sfx.wrong();
    setSession((s) => ({ knew: s.knew + (knew ? 1 : 0), missed: s.missed + (knew ? 0 : 1) }));
    void play({ type: "review", cardId: card.id, knew }, { type: "review", cardId: card.id, knew });
    draw();
  }

  const w = card ? catalog.find((x) => x.id === card.worldId) : null;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="font-pixel text-[10px] tracking-widest text-pink">MOCK INTERVIEW</div>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Interview flashcards</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-dim">
          Answer out loud as if an interviewer asked you, then reveal the model answer and be honest. Cards you know come back less often (Leitner spaced repetition).
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <select
          value={world}
          onChange={(e) => {
            setWorld(e.target.value);
            setCurrent(null);
          }}
          className="h-9 rounded-lg border border-line-2 bg-panel px-3 text-sm text-ink"
        >
          <option value="all">All worlds</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setOnlyCommon((v) => !v);
            setCurrent(null);
          }}
          className={clsx("h-9 rounded-lg border px-3 text-sm", onlyCommon ? "border-orange/60 bg-orange/10 text-orange" : "border-line-2 text-dim")}
        >
          🔥 Very common only
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: "due now", v: ready ? due.length : "…", c: "text-amber" },
          { k: "in deck", v: pool.length, c: "text-ink" },
          { k: "mastered", v: ready ? mastered : "…", c: "text-emerald" },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-line bg-panel px-3 py-2">
            <div className={clsx("font-mono text-xl font-semibold", s.c)}>{s.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-faint">{s.k}</div>
          </div>
        ))}
      </div>

      {!card ? (
        <div className="panel p-10 text-center">
          {due.length ? (
            <>
              <p className="text-dim">{due.length} cards ready for review.</p>
              <Button size="lg" className="mt-5" onClick={draw} disabled={!ready}>
                Start interview
              </Button>
            </>
          ) : (
            <p className="text-dim">Nothing due in this deck right now — come back later or pick another world. 🎉</p>
          )}
        </div>
      ) : (
        <motion.div key={card.id} initial={{ rotateX: -12, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-xs">
            <span>{w?.emoji}</span>
            <span style={{ color: w?.color }}>{w?.title}</span>
            <span className="text-faint">· {card.lessonTitle}</span>
            {card.freq && <span className={clsx("ml-auto rounded-full border px-2 py-0.5", FREQ[card.freq].cls)}>{FREQ[card.freq].label}</span>}
          </div>
          <div className="p-6 sm:p-8">
            <div className="font-pixel text-[9px] text-violet">INTERVIEWER ASKS</div>
            <h2 className="mt-3 font-display text-xl leading-snug font-semibold text-ink sm:text-2xl">{card.q}</h2>
            {!revealed ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button onClick={() => setRevealed(true)}>
                  <Eye size={16} /> Reveal model answer
                </Button>
                <span className="flex items-center gap-1.5 font-mono text-sm text-faint">
                  <Timer size={14} /> {seconds}s thinking
                </span>
              </div>
            ) : (
              <>
                <div className="prose-quest mt-6 rounded-xl border border-line bg-panel-2/60 p-5 text-[15px]" dangerouslySetInnerHTML={{ __html: card.html }} />
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => grade(false)} className="flex items-center justify-center gap-2 rounded-xl border-2 border-rose/50 bg-rose/10 py-3 font-semibold text-rose hover:bg-rose/20">
                    <ThumbsDown size={17} /> I missed key points
                  </button>
                  <button type="button" onClick={() => grade(true)} className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald/50 bg-emerald/10 py-3 font-semibold text-emerald hover:bg-emerald/20">
                    <ThumbsUp size={17} /> I nailed it
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
      {(session.knew > 0 || session.missed > 0) && (
        <div className="text-center text-sm text-dim">
          This session: <span className="text-emerald">{session.knew} nailed</span> · <span className="text-rose">{session.missed} to review</span>
        </div>
      )}
    </div>
  );
}
