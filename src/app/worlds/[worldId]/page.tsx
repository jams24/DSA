import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WORLDS, getWorld } from "@/content";
import { WorldMap } from "@/components/world/WorldMap";
import { WorldHeaderStats } from "@/components/world/WorldHeaderStats";

export function generateStaticParams() {
  return WORLDS.map((w) => ({ worldId: w.id }));
}

export async function generateMetadata(props: PageProps<"/worlds/[worldId]">): Promise<Metadata> {
  const { worldId } = await props.params;
  const w = getWorld(worldId);
  return w ? { title: w.title, description: w.description } : {};
}

export default async function WorldPage(props: PageProps<"/worlds/[worldId]">) {
  const { worldId } = await props.params;
  const world = getWorld(worldId);
  if (!world) notFound();

  const quizCount = world.lessons.reduce((n, l) => n + l.quiz.length, 0);
  const vizCount = world.lessons.filter((l) => l.visualizers?.length || l.diagram).length;
  const idx = WORLDS.findIndex((w) => w.id === world.id);
  const prev = WORLDS[idx - 1];
  const next = WORLDS[idx + 1];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8" style={{ "--accent": world.color } as React.CSSProperties}>
      <nav className="mb-6 text-sm text-faint">
        <Link href="/worlds" className="hover:text-ink">
          ← All worlds
        </Link>
      </nav>

      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: world.color }} />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full opacity-10 blur-3xl" style={{ background: world.color }} />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-[0.25em]" style={{ color: world.color }}>
              World {world.order}
            </div>
            <h1 className="mt-3 flex items-center gap-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              <span className="animate-float text-5xl sm:text-6xl">{world.emoji}</span>
              {world.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-dim">{world.description}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-line-2 bg-panel-2 px-3 py-1 text-dim">📚 {world.lessons.length} levels</span>
              <span className="rounded-full border border-line-2 bg-panel-2 px-3 py-1 text-dim">🔭 {vizCount} interactive</span>
              <span className="rounded-full border border-line-2 bg-panel-2 px-3 py-1 text-dim">❓ {quizCount} quiz questions</span>
            </div>
            <WorldHeaderStats worldId={world.id} />
          </div>
          <div className="rounded-2xl border border-rose/30 bg-gradient-to-b from-rose/10 to-transparent p-5">
            <div className="font-pixel text-[9px] text-rose">FINAL BOSS</div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-5xl">{world.boss.emoji}</span>
              <div>
                <div className="font-display text-lg font-bold text-ink">{world.boss.name}</div>
                <div className="text-xs text-rose/80">{world.boss.title}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-dim italic">“{world.boss.taunt}”</p>
            <Link
              href={`/worlds/${world.id}/boss`}
              className="mt-5 flex h-10 items-center justify-center rounded-xl bg-gradient-to-b from-rose to-pink text-sm font-semibold text-[#ffffff] shadow-[0_4px_0_0_#9f1239] active:translate-y-0.5"
            >
              ⚔️ Enter boss battle
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14">
        <WorldMap worldId={world.id} />
      </section>

      <div className="flex justify-between gap-3 border-t border-line pt-6 text-sm">
        {prev ? (
          <Link href={`/worlds/${prev.id}`} className="text-dim hover:text-ink">
            ← {prev.emoji} {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/worlds/${next.id}`} className="text-dim hover:text-ink">
            {next.emoji} {next.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
