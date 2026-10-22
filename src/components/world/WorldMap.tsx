"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Check, Lock } from "lucide-react";
import { useGame, useIsAdmin, usePlayer } from "@/lib/game/store";
import { nextInWorld, worldProgress } from "@/lib/game/progress";
import { useCatalog } from "@/components/game/GameProvider";
import { Stars } from "@/components/ui";

const ROW = 128;
const TOP = 70;

export function WorldMap({ worldId }: { worldId: string }) {
  const catalog = useCatalog();
  const world = catalog.find((w) => w.id === worldId);
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const admin = useIsAdmin();
  if (!world) return null;

  const accent = world.color;
  const next = ready ? nextInWorld(world, player) : null;
  const prog = worldProgress(world, player);
  const count = world.lessons.length + 1; // + boss
  const height = TOP * 2 + (count - 1) * ROW;
  const xOf = (i: number) => 50 + 24 * Math.sin(i * 1.15);
  const yOf = (i: number) => TOP + i * ROW;

  let d = `M ${xOf(0)} ${yOf(0)}`;
  for (let i = 1; i < count; i++) {
    const my = (yOf(i - 1) + yOf(i)) / 2;
    d += ` C ${xOf(i - 1)} ${my}, ${xOf(i)} ${my}, ${xOf(i)} ${yOf(i)}`;
  }
  const doneCount = world.lessons.findIndex((l) => (player.progress[l.key]?.stars ?? 0) === 0);
  const reached = ready ? (doneCount === -1 ? count - 1 : doneCount) : 0;
  let dDone = `M ${xOf(0)} ${yOf(0)}`;
  for (let i = 1; i <= reached; i++) {
    const my = (yOf(i - 1) + yOf(i)) / 2;
    dDone += ` C ${xOf(i - 1)} ${my}, ${xOf(i)} ${my}, ${xOf(i)} ${yOf(i)}`;
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl" style={{ height }}>
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
        <path d={d} fill="none" stroke="#e2e8f0" strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {reached > 0 && (
          <path
            d={dDone}
            fill="none"
            stroke={accent}
            strokeWidth={6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
          />
        )}
      </svg>

      {world.lessons.map((l, i) => {
        const stars = player.progress[l.key]?.stars ?? 0;
        const done = ready && stars > 0;
        const isNext = next?.id === l.id;
        const left = xOf(i);
        const labelRight = left < 50 || (left === 50 && i % 2 === 0);
        return (
          <div key={l.id} className="absolute" style={{ left: `${left}%`, top: yOf(i), transform: "translate(-50%, -50%)" }}>
            <Link
              href={`/worlds/${world.id}/${l.id}`}
              className={clsx(
                "relative grid h-[72px] w-[72px] place-items-center rounded-full border-4 transition duration-200 hover:scale-110",
                isNext && "animate-pulse-ring",
              )}
              style={
                {
                  "--glow": accent,
                  borderColor: done || isNext ? accent : "#cbd5e1",
                  background: done ? `radial-gradient(circle at 35% 30%, ${accent}, ${accent}99 60%, ${accent}55), #f1f5f9` : isNext ? `linear-gradient(${accent}22, ${accent}22), #f1f5f9` : "#f1f5f9",
                  boxShadow: done ? `0 6px 0 0 ${accent}55, 0 0 24px -4px ${accent}` : "0 6px 0 0 #cbd5e1",
                } as React.CSSProperties
              }
              aria-label={`Level ${i + 1}: ${l.title}`}
            >
              {done ? (
                <Check size={30} strokeWidth={3} className="text-[#ffffff]" />
              ) : (
                <span className="font-pixel text-sm" style={{ color: isNext ? accent : "#64748b" }}>
                  {i + 1}
                </span>
              )}
              {isNext && (
                <span
                  className="absolute -top-8 animate-float rounded-lg px-2 py-1 font-pixel text-[8px] whitespace-nowrap text-[#ffffff]"
                  style={{ background: accent }}
                >
                  {prog.done === 0 ? "START" : "NEXT"}
                </span>
              )}
            </Link>
            <div
              className={clsx(
                "absolute top-1/2 w-[min(33vw,240px)] -translate-y-1/2",
                labelRight ? "left-[calc(100%+16px)] text-left" : "right-[calc(100%+16px)] text-right",
              )}
            >
              <Link href={`/worlds/${world.id}/${l.id}`} className="group block">
                <div className="font-display text-sm font-semibold text-ink group-hover:underline sm:text-base">{l.title}</div>
                <div className="hidden text-xs text-dim sm:block">{l.tagline}</div>
                <div className={clsx("mt-1 flex items-center gap-2", labelRight ? "" : "justify-end")}>
                  {ready && <Stars count={stars} size={11} />}
                  {l.hasVisualizer && <span className="text-[10px] text-faint">🔭 interactive</span>}
                </div>
              </Link>
            </div>
          </div>
        );
      })}

      {/* boss */}
      {(() => {
        const i = count - 1;
        const left = xOf(i);
        const beaten = ready && prog.boss > 0;
        const allDone = admin || (ready && prog.done === prog.total);
        return (
          <div className="absolute" style={{ left: `${left}%`, top: yOf(i), transform: "translate(-50%, -50%)" }}>
            <Link
              href={`/worlds/${world.id}/boss`}
              className={clsx(
                "relative grid h-24 w-24 place-items-center rounded-3xl border-4 text-5xl transition hover:scale-110",
                allDone && !beaten && "animate-pulse-ring",
              )}
              style={
                {
                  "--glow": "#e11d48",
                  borderColor: beaten ? "#059669" : "#e11d48",
                  background: beaten ? "#34d39922" : "radial-gradient(circle, #fb718544, #fff1f2)",
                  boxShadow: "0 8px 0 0 #fda4af, 0 0 40px -6px #e11d48",
                } as React.CSSProperties
              }
              aria-label={`Boss battle: ${world.boss.name}`}
            >
              <span className={clsx(!beaten && "animate-float")}>{world.boss.emoji}</span>
              {!allDone && !beaten && (
                <span className="absolute -right-2 -bottom-2 grid h-7 w-7 place-items-center rounded-full border border-line-2 bg-panel text-faint">
                  <Lock size={13} />
                </span>
              )}
            </Link>
            <div className={clsx("absolute top-1/2 w-[min(33vw,240px)] -translate-y-1/2", left < 50 ? "left-[calc(100%+16px)]" : "right-[calc(100%+16px)] text-right")}>
              <div className="font-pixel text-[9px] text-rose">BOSS BATTLE</div>
              <div className="font-display font-bold text-ink">{world.boss.name}</div>
              <div className="text-xs text-dim">{beaten ? <Stars count={prog.boss} size={11} /> : admin ? "Unlocked (admin)" : allDone ? "You're ready. Fight!" : "Clear the levels first (or be brave)."}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
