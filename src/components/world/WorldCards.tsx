"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useGame, usePlayer } from "@/lib/game/store";
import { worldProgress } from "@/lib/game/progress";
import { useCatalog } from "@/components/game/GameProvider";
import { ProgressBar, Stars } from "@/components/ui";

export function WorldCards({ large = false }: { large?: boolean }) {
  const catalog = useCatalog();
  const player = usePlayer();
  const ready = useGame((s) => s.ready);

  return (
    <div className={clsx("grid gap-4", large ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {catalog.map((w) => {
        const p = worldProgress(w, player);
        const cleared = p.total > 0 && p.done === p.total;
        return (
          <Link
            key={w.id}
            href={`/worlds/${w.id}`}
            className="group panel relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1"
            style={{ "--accent": w.color } as React.CSSProperties}
          >
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-25 blur-3xl transition group-hover:opacity-50"
              style={{ background: w.color }}
            />
            <div className="relative flex items-start gap-4">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-3xl transition group-hover:scale-110 group-hover:rotate-3"
                style={{ borderColor: `${w.color}55`, background: `${w.color}14`, boxShadow: `0 0 24px -8px ${w.color}` }}
              >
                {w.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-pixel text-[9px] uppercase tracking-widest" style={{ color: w.color }}>
                  World {w.order}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">{w.title}</h3>
                <p className="mt-0.5 text-sm text-dim">{w.subtitle}</p>
              </div>
            </div>
            {large && <p className="relative mt-4 text-sm leading-relaxed text-dim">{w.description}</p>}
            <div className="relative mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-faint">
                  {ready ? `${p.done}/${p.total} levels` : `${p.total} levels`}
                  {cleared && <span className="ml-2 text-emerald">✓ cleared</span>}
                </span>
                {ready && <Stars count={Math.round((p.stars / Math.max(1, p.maxStars)) * 3)} size={12} />}
              </div>
              <ProgressBar value={ready ? p.pct : 0} color={w.color} height={6} />
            </div>
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-line bg-panel-2/70 px-3 py-2 text-xs">
              <span className="text-lg">{w.boss.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-dim">
                Boss: <span className="text-ink">{w.boss.name}</span>
              </span>
              {ready && p.boss > 0 ? <span className="text-emerald">defeated</span> : <span className="text-faint">awaits</span>}
            </div>
          </Link>
        );
      })}
      <Link
        href="/arena"
        className="group panel relative flex flex-col justify-between overflow-hidden border-dashed p-5 transition duration-300 hover:-translate-y-1 hover:border-amber/60"
      >
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber/20 opacity-30 blur-3xl transition group-hover:opacity-60" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber/40 bg-amber/10 text-3xl transition group-hover:scale-110 group-hover:-rotate-3">
            🏟️
          </div>
          <div>
            <div className="font-pixel text-[9px] uppercase tracking-widest text-amber">Bonus realm</div>
            <h3 className="mt-1 font-display text-lg font-bold text-ink">The Arena</h3>
            <p className="mt-0.5 text-sm text-dim">Daily challenge, rapid fire, mock interview cards & boss rush.</p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-1.5 text-[11px] text-dim">
          {["📅 Daily", "⚡ Rapid fire", "🃏 Flashcards", "⚔️ Boss rush"].map((m) => (
            <span key={m} className="rounded-full border border-line-2 bg-panel-2 px-2 py-0.5">
              {m}
            </span>
          ))}
        </div>
      </Link>
    </div>
  );
}
