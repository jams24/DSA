import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANGUAGE_TRACKS, getWorld, worldQuestions } from "@/content";
import { BossBattle } from "@/components/game/BossBattle";

export function generateStaticParams() {
  return LANGUAGE_TRACKS.map((w) => ({ lang: w.id }));
}

export async function generateMetadata(props: PageProps<"/languages/[lang]/boss">): Promise<Metadata> {
  const { lang } = await props.params;
  const w = getWorld(lang);
  return w ? { title: `Boss: ${w.boss.name}` } : {};
}

export default async function LanguageBossPage(props: PageProps<"/languages/[lang]/boss">) {
  const { lang } = await props.params;
  const world = getWorld(lang);
  if (!world || world.track !== "language") notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <BossBattle worldId={world.id} worldTitle={world.title} color={world.color} boss={world.boss} pool={worldQuestions(world.id)} />
    </div>
  );
}
