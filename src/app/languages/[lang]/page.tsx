import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LANGUAGE_TRACKS, contentStats, getWorld } from "@/content";
import { LanguageProgress, LanguageRoadmap } from "@/components/world/LanguageRoadmap";
import { worldHref } from "@/lib/paths";

export function generateStaticParams() {
  return LANGUAGE_TRACKS.map((w) => ({ lang: w.id }));
}

export async function generateMetadata(props: PageProps<"/languages/[lang]">): Promise<Metadata> {
  const { lang } = await props.params;
  const w = getWorld(lang);
  return w ? { title: w.title, description: w.description } : {};
}

export default async function LanguagePage(props: PageProps<"/languages/[lang]">) {
  const { lang } = await props.params;
  const world = getWorld(lang);
  if (!world || world.track !== "language") notFound();
  const s = contentStats([world]);
  const idx = LANGUAGE_TRACKS.findIndex((w) => w.id === world.id);
  const others = LANGUAGE_TRACKS.filter((w) => w.id !== world.id);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8" style={{ "--accent": world.color } as React.CSSProperties}>
      <nav className="mb-6 text-sm text-faint">
        <Link href="/languages" className="hover:text-ink">
          ← Language Academy
        </Link>
      </nav>

      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: world.color }} />
        <div className="relative">
          <div className="font-pixel text-[10px] uppercase tracking-[0.25em]" style={{ color: world.color }}>
            Language track {idx + 1}
          </div>
          <h1 className="mt-3 flex items-center gap-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            <span className="animate-float text-5xl sm:text-6xl">{world.emoji}</span>
            {world.title}
          </h1>
          <p className="mt-2 text-lg font-medium text-ink">{world.subtitle}</p>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-dim">{world.description}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {[
              `📚 ${s.lessons} chapters`,
              `💻 ${s.samples} code samples`,
              `🛠 ${s.projects} guided projects`,
              `🧰 ${s.libraries} libraries`,
              `🔭 ${s.visualizers} interactive`,
              `🎤 ${s.interview} interview Q&As`,
              `❓ ${s.questions} quiz questions`,
            ].map((t) => (
              <span key={t} className="rounded-full border border-line-2 bg-panel-2 px-3 py-1 text-dim">
                {t}
              </span>
            ))}
          </div>
          <LanguageProgress worldId={world.id} />
        </div>
      </section>

      <section className="py-12">
        <LanguageRoadmap worldId={world.id} />
      </section>

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm">
        {others.map((o) => (
          <Link key={o.id} href={worldHref(o)} className="text-dim hover:text-ink">
            {o.emoji} {o.title} →
          </Link>
        ))}
      </div>
    </div>
  );
}
