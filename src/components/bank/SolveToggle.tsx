"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";
import { REWARDS } from "@/lib/game/engine";
import { useGame, usePlayer } from "@/lib/game/store";
import { sfx } from "@/lib/sound";

/** Tick a LeetCode 150 problem as solved (same action and XP as the list page). */
export function SolveToggle({ slug }: { slug: string }) {
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const play = useGame((s) => s.play);
  const [pending, setPending] = useState(false);
  const solved = ready && (player.stats.solved ?? []).includes(slug);

  async function toggle() {
    if (!ready || pending) return;
    const next = !solved;
    if (next) sfx.correct();
    else sfx.click();
    setPending(true);
    await play({ type: "solve", slug, solved: next }, { type: "solve", slug, solved: next });
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!ready || pending}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-xl border-2 px-4 text-sm font-semibold transition disabled:opacity-60",
        solved ? "border-emerald bg-emerald text-white" : "border-line-2 bg-panel text-ink hover:border-emerald",
      )}
    >
      <Check size={16} strokeWidth={3} className={solved ? "" : "text-faint"} />
      {solved ? "Solved" : `Mark solved (+${REWARDS.solve} XP)`}
    </button>
  );
}
