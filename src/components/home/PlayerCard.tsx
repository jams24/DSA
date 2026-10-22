"use client";

import Link from "next/link";
import { Flame, Star, Swords, Trophy } from "lucide-react";
import { useGame, usePlayer } from "@/lib/game/store";
import { levelInfo } from "@/lib/game/levels";
import { nextLesson, overallProgress } from "@/lib/game/progress";
import { useCatalog } from "@/components/game/GameProvider";
import { Avatar, LinkButton, ProgressBar } from "@/components/ui";

export function PlayerCard() {
  const catalog = useCatalog();
  const player = usePlayer();
  const user = useGame((s) => s.user);
  const ready = useGame((s) => s.ready);
  const info = levelInfo(player.xp);
  const prog = overallProgress(catalog, player);

  if (!ready) return <div className="shimmer panel h-[340px]" />;

  return (
    <div className="panel neon-border relative overflow-hidden p-6" style={{ "--accent": "#a78bfa" } as React.CSSProperties}>
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-violet/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <Avatar avatar={user?.avatar ?? "wizard"} size={64} />
        <div className="min-w-0">
          <div className="font-pixel text-[9px] text-violet">PLAYER 1</div>
          <div className="truncate font-display text-xl font-bold text-ink">{user?.username ?? "Guest Adventurer"}</div>
          <div className="text-sm text-amber">{info.title}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-pixel text-[9px] text-faint">LEVEL</div>
          <div className="font-pixel text-3xl text-amber glow-text">{info.level}</div>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="mb-1.5 flex justify-between text-xs text-dim">
          <span>{player.xp.toLocaleString()} XP</span>
          <span>
            {info.current}/{info.needed} to LV {info.level + 1}
          </span>
        </div>
        <ProgressBar value={info.pct} color="#a78bfa" height={10} />
      </div>
      <div className="relative mt-5 grid grid-cols-4 gap-2 text-center">
        {[
          { icon: Flame, label: "streak", value: player.streak, color: "#fb923c" },
          { icon: Star, label: "stars", value: prog.stars, color: "#fbbf24" },
          { icon: Swords, label: "bosses", value: prog.bosses, color: "#fb7185" },
          { icon: Trophy, label: "badges", value: player.achievements.length, color: "#34d399" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-panel-2/80 px-1 py-2.5">
            <s.icon size={16} className="mx-auto" style={{ color: s.color }} />
            <div className="mt-1 font-mono text-lg font-semibold text-ink">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-faint">{s.label}</div>
          </div>
        ))}
      </div>
      {!user && (
        <div className="relative mt-5 rounded-xl border border-cyan/30 bg-cyan/[0.06] p-3 text-xs text-dim">
          Playing as a guest — progress lives in this browser.{" "}
          <Link href="/login" className="font-semibold text-cyan hover:underline">
            Create a free account
          </Link>{" "}
          to save it, climb the leaderboard and sync across devices.
        </div>
      )}
      {user && (
        <div className="relative mt-5 text-xs text-dim">
          Course progress: <span className="text-ink">{prog.done}</span>/{prog.total} levels ({Math.round(prog.pct)}%)
        </div>
      )}
    </div>
  );
}

export function ContinueButton() {
  const catalog = useCatalog();
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const next = ready ? nextLesson(catalog, player) : null;
  const started = Object.keys(player.progress).length > 0;

  if (!ready || !next) {
    return (
      <LinkButton href="/worlds" size="lg">
        {ready ? "Revisit the worlds" : "Start your quest"}
      </LinkButton>
    );
  }
  return (
    <LinkButton href={`/worlds/${next.world.id}/${next.lesson.id}`} size="lg">
      {started ? `Continue: ${next.lesson.title}` : "Press start ▶"}
    </LinkButton>
  );
}
