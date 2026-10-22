"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck2, ChevronRight } from "lucide-react";
import { useGame, usePlayer } from "@/lib/game/store";
import { REWARDS, DAILY_SIZE, utcDay } from "@/lib/game/engine";

function untilMidnightUtc() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = next - now.getTime();
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  return `${h}h ${m}m`;
}

export function DailyBanner() {
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const [left, setLeft] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      setLeft(untilMidnightUtc());
      setToday(utcDay(new Date()));
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const claimed = ready && today ? player.stats.claims?.includes(`daily:${today}`) : false;
  const maxXp = REWARDS.dailyBase + DAILY_SIZE * REWARDS.dailyPerCorrect;

  return (
    <Link
      href="/arena/daily"
      className="group panel flex flex-wrap items-center gap-4 border-amber/30 bg-gradient-to-r from-amber/[0.08] via-transparent to-transparent p-5 transition hover:border-amber/60"
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber/40 bg-amber/10 text-amber">
        <CalendarCheck2 />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-pixel text-[9px] text-amber">DAILY CHALLENGE</div>
        <div className="font-display text-lg font-semibold text-ink">
          {claimed ? "Completed today — nice!" : `${DAILY_SIZE} questions from every world · up to +${maxXp} XP`}
        </div>
        <div className="text-xs text-dim">Same questions for every player today. New set in {left ?? "…"} (00:00 UTC).</div>
      </div>
      <span className="flex items-center gap-1 text-sm font-semibold text-amber">
        {claimed ? "Review" : "Play"} <ChevronRight size={16} className="transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
