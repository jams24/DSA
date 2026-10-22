"use client";

import Link from "next/link";
import { useGame, usePlayer } from "@/lib/game/store";
import { Stars } from "@/components/ui";

export function BossList({ bosses }: { bosses: { worldId: string; worldTitle: string; color: string; name: string; emoji: string; title: string }[] }) {
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {bosses.map((b) => {
        const stars = player.progress[`boss/${b.worldId}`]?.stars ?? 0;
        return (
          <Link
            key={b.worldId}
            href={`/worlds/${b.worldId}/boss`}
            className="panel flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-rose/50"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-rose/30 bg-rose/[0.08] text-3xl">{b.emoji}</span>
            <div className="min-w-0">
              <div className="truncate font-display font-semibold text-ink">{b.name}</div>
              <div className="truncate text-xs" style={{ color: b.color }}>
                {b.worldTitle}
              </div>
              <div className="mt-1">{ready && stars > 0 ? <Stars count={stars} size={11} /> : <span className="text-[11px] text-faint">undefeated</span>}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
