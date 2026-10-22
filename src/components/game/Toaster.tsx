"use client";

import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useGame } from "@/lib/game/store";
import { titleForLevel } from "@/lib/game/levels";
import { sfx } from "@/lib/sound";
import { Button } from "@/components/ui";

export function Toaster() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            onClick={() => dismiss(t.id)}
            className={clsx(
              "pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-2xl backdrop-blur-md",
              t.kind === "xp" && "border-cyan/40 bg-[#062a33]/90",
              t.kind === "achievement" && "border-amber/50 bg-[#2a1e05]/95",
              t.kind === "info" && "border-line-2 bg-panel-2/95",
              t.kind === "error" && "border-rose/50 bg-[#2a0a12]/95",
            )}
          >
            {t.emoji && <span className={clsx("text-2xl", t.kind === "achievement" && "animate-pop")}>{t.emoji}</span>}
            <span className="min-w-0">
              {t.kind === "achievement" && (
                <span className="block font-pixel text-[9px] uppercase tracking-widest text-amber">Achievement unlocked</span>
              )}
              <span
                className={clsx(
                  "block font-display font-bold",
                  t.kind === "xp" ? "text-lg text-cyan glow-text" : "text-sm text-ink",
                )}
              >
                {t.title}
              </span>
              {t.body && <span className="block text-xs text-dim">{t.body}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function LevelUpModal() {
  const levelUp = useGame((s) => s.levelUp);
  const clear = useGame((s) => s.clearLevelUp);

  useEffect(() => {
    if (!levelUp) return;
    sfx.levelUp();
    const end = Date.now() + 900;
    const colors = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#a3e635"];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [levelUp]);

  return (
    <AnimatePresence>
      {levelUp && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={clear}
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -4 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="panel neon-border relative w-full max-w-sm overflow-hidden p-8 text-center"
            style={{ "--accent": "#fbbf24" } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-pixel text-xs uppercase tracking-[0.3em] text-amber">Level up!</div>
            <div className="my-5 flex items-center justify-center gap-4 font-pixel">
              <span className="text-2xl text-faint">{levelUp.from}</span>
              <span className="text-dim">→</span>
              <span className="glow-text text-6xl text-amber">{levelUp.to}</span>
            </div>
            <div className="font-display text-xl font-bold text-ink">{titleForLevel(levelUp.to)}</div>
            <p className="mt-2 text-sm text-dim">New title unlocked. Keep climbing.</p>
            <Button className="mt-6 w-full" onClick={clear}>
              Continue
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
