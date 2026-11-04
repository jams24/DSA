"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Hammer, Sparkles } from "lucide-react";
import type { CatalogLesson, CatalogWorld, Stage } from "@/content/types";
import { useGame, useIsAdmin, usePlayer } from "@/lib/game/store";
import { nextInWorld, worldProgress } from "@/lib/game/progress";
import { bossHref, lessonHref, worldHref } from "@/lib/paths";
import { useCatalog } from "@/components/game/GameProvider";
import { STAGES } from "@/components/world/stages";
import { DifficultyPill, LinkButton, ProgressBar, Stars } from "@/components/ui";

function stageOf(l: CatalogLesson): Stage {
  return l.stage ?? "Core";
}

export function LanguageRoadmap({ worldId }: { worldId: string }) {
  const world = useCatalog().find((w) => w.id === worldId);
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const admin = useIsAdmin();
  if (!world) return null;
  const accent = world.color;
  const next = ready ? nextInWorld(world, player) : null;
  const prog = worldProgress(world, player);
  let n = 0;
  const numbered = new Map(world.lessons.map((l) => [l.id, ++n]));

  return (
    <div className="space-y-12">
      {STAGES.map((st, si) => {
        const lessons = world.lessons.filter((l) => stageOf(l) === st.id);
        if (!lessons.length) return null;
        const done = lessons.filter((l) => (player.progress[l.key]?.stars ?? 0) > 0).length;
        return (
          <section key={st.id}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: `${accent}55`, background: `${accent}12`, color: accent }}>
                  <st.icon size={20} />
                </span>
                <div>
                  <div className="font-pixel text-[9px] tracking-widest" style={{ color: accent }}>
                    PART {si + 1}
                  </div>
                  <h2 className="font-display text-2xl font-bold text-ink">{st.id}</h2>
                  <p className="text-sm text-dim">{st.blurb}</p>
                </div>
              </div>
              {ready && (
                <span className="font-mono text-xs text-faint">
                  {done}/{lessons.length} cleared
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((l) => (
                <ChapterCard key={l.id} world={world} lesson={l} num={numbered.get(l.id) ?? 0} isNext={next?.id === l.id} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="panel relative overflow-hidden border-rose/30 p-6">
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-rose/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="text-6xl">{world.boss.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[9px] text-rose">FINAL BOSS</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">{world.boss.name}</div>
            <div className="text-sm text-dim">
              {world.boss.title} · questions from every chapter. {prog.boss > 0 ? "Defeated." : admin ? "Unlocked (admin)." : "Clear the chapters first, or be brave."}
            </div>
          </div>
          <LinkButton href={bossHref(world)} variant="danger" size="lg">
            ⚔️ Fight
          </LinkButton>
        </div>
      </section>
    </div>
  );
}

function ChapterCard({ world, lesson, num, isNext }: { world: CatalogWorld; lesson: CatalogLesson; num: number; isNext: boolean }) {
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const stars = player.progress[lesson.key]?.stars ?? 0;
  const done = ready && stars > 0;
  const accent = world.color;
  return (
    <Link
      href={lessonHref(world, lesson.id)}
      className={clsx("group panel relative flex flex-col p-4 transition hover:-translate-y-0.5", isNext && "neon-border")}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-pixel text-[9px]"
          style={{ background: done ? accent : `${accent}18`, color: done ? "#fff" : accent }}
        >
          {done ? "✓" : num}
        </span>
        <DifficultyPill level={lesson.difficulty} />
        {lesson.kind === "project" && <Badge color="#059669">🛠 project</Badge>}
        {lesson.kind === "toolbox" && <Badge color="#7c3aed">🧰 toolbox</Badge>}
        {isNext && (
          <span className="ml-auto rounded-md px-1.5 py-0.5 font-pixel text-[8px] text-[#fff]" style={{ background: accent }}>
            NEXT
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display font-semibold text-ink group-hover:underline">{lesson.title}</h3>
      <p className="mt-1 flex-1 text-sm text-dim">{lesson.tagline}</p>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-faint">
        <span>⏱ {lesson.minutes} min</span>
        {lesson.hasVisualizer && <span>🔭 interactive</span>}
        {ready && stars > 0 && <Stars count={stars} size={11} className="ml-auto" />}
      </div>
    </Link>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: `${color}55`, background: `${color}12`, color }}>
      {children}
    </span>
  );
}

export function LanguageProgress({ worldId }: { worldId: string }) {
  const world = useCatalog().find((w) => w.id === worldId);
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  if (!world) return null;
  const p = worldProgress(world, player);
  const next = nextInWorld(world, player);
  return (
    <div className="mt-8 max-w-xl">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-dim">Track progress</span>
        <span className="font-mono text-ink">{ready ? `${p.done}/${p.total} · ${p.stars}/${p.maxStars} ★` : "…"}</span>
      </div>
      <ProgressBar value={ready ? p.pct : 0} color={world.color} />
      <div className="mt-5">
        {next ? (
          <LinkButton href={lessonHref(world, next.id)} size="lg">
            {p.done === 0 ? `Start chapter 1: ${next.title}` : `Continue: ${next.title}`}
          </LinkButton>
        ) : (
          <LinkButton href={bossHref(world)} size="lg" variant="danger">
            Every chapter cleared — fight the boss!
          </LinkButton>
        )}
      </div>
    </div>
  );
}

/** Cards for the /languages hub, with live progress. */
export function LanguageCards({ extras }: { extras: Record<string, { versions: string; jobs: string; projects: string[]; libraries: number; samples: number }> }) {
  const catalog = useCatalog().filter((w) => w.track === "language");
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {catalog.map((w) => {
        const p = worldProgress(w, player);
        const next = nextInWorld(w, player);
        const x = extras[w.id];
        return (
          <div key={w.id} className="panel relative flex flex-col overflow-hidden p-6" style={{ "--accent": w.color } as React.CSSProperties}>
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: w.color }} />
            <div className="relative flex items-center gap-4">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border text-4xl" style={{ borderColor: `${w.color}55`, background: `${w.color}12` }}>
                {w.emoji}
              </span>
              <div className="min-w-0">
                <div className="font-pixel text-[9px] tracking-widest" style={{ color: w.color }}>
                  {x?.versions}
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">{w.title}</h2>
                <p className="text-sm text-dim">{w.subtitle}</p>
              </div>
            </div>
            <p className="relative mt-4 text-sm leading-relaxed text-dim">{w.description}</p>
            {x && (
              <>
                <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "chapters", v: w.lessons.length },
                    { k: "code samples", v: x.samples },
                    { k: "libraries", v: x.libraries },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl border border-line bg-panel-2/60 px-2 py-2">
                      <div className="font-display text-xl font-bold text-ink">{s.v}</div>
                      <div className="text-[10px] tracking-wider text-faint uppercase">{s.k}</div>
                    </div>
                  ))}
                </div>
                <div className="relative mt-4 text-sm">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-faint uppercase">
                    <Hammer size={12} /> You&apos;ll build
                  </div>
                  <ul className="space-y-1">
                    {x.projects.map((pr) => (
                      <li key={pr} className="flex gap-2 text-[#334155]">
                        <span style={{ color: w.color }}>◆</span>
                        {pr.replace(/^Project: /, "")}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative mt-4 flex gap-2 text-xs text-dim">
                  <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: w.color }} />
                  <span>{x.jobs}</span>
                </div>
              </>
            )}
            <div className="relative mt-auto pt-6">
              <div className="mb-1.5 flex justify-between text-xs text-faint">
                <span>{ready ? `${p.done}/${p.total} chapters` : `${p.total} chapters`}</span>
                {ready && p.boss > 0 && <span className="text-emerald">boss defeated</span>}
              </div>
              <ProgressBar value={ready ? p.pct : 0} color={w.color} height={6} />
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href={worldHref(w)} size="sm">
                  Open roadmap
                </LinkButton>
                {ready && next && p.done > 0 && (
                  <LinkButton href={lessonHref(w, next.id)} size="sm" variant="secondary">
                    Continue
                  </LinkButton>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
