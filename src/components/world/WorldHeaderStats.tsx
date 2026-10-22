"use client";

import { useGame, useIsAdmin, usePlayer } from "@/lib/game/store";
import { nextInWorld, worldProgress } from "@/lib/game/progress";
import { useCatalog } from "@/components/game/GameProvider";
import { LinkButton, ProgressBar } from "@/components/ui";

export function WorldHeaderStats({ worldId }: { worldId: string }) {
  const world = useCatalog().find((w) => w.id === worldId);
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const admin = useIsAdmin();
  if (!world) return null;
  const p = worldProgress(world, player);
  const next = nextInWorld(world, player);

  return (
    <div className="mt-8 max-w-xl">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-dim">World progress</span>
        <span className="font-mono text-ink">{ready ? `${p.done}/${p.total} · ${p.stars}/${p.maxStars} ★` : "…"}</span>
      </div>
      <ProgressBar value={ready ? p.pct : 0} color={world.color} />
      {admin && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-amber">
          👑 Admin — every level and boss in this world is unlocked
        </div>
      )}
      <div className="mt-5">
        {next ? (
          <LinkButton href={`/worlds/${world.id}/${next.id}`} size="lg">
            {p.done === 0 ? "Start level 1" : `Continue: ${next.title}`}
          </LinkButton>
        ) : (
          <LinkButton href={`/worlds/${world.id}/boss`} size="lg" variant="danger">
            All levels cleared — fight the boss!
          </LinkButton>
        )}
      </div>
    </div>
  );
}
