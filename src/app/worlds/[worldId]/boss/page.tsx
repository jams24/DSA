import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WORLDS, getWorld, worldQuestions } from "@/content";
import { BossBattle } from "@/components/game/BossBattle";

export function generateStaticParams() {
  return WORLDS.map((w) => ({ worldId: w.id }));
}

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/boss">): Promise<Metadata> {
  const { worldId } = await props.params;
  const w = getWorld(worldId);
  return w ? { title: `Boss: ${w.boss.name}` } : {};
}

export default async function BossPage(props: PageProps<"/worlds/[worldId]/boss">) {
  const { worldId } = await props.params;
  const world = getWorld(worldId);
  if (!world) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <BossBattle worldId={world.id} worldTitle={world.title} color={world.color} boss={world.boss} pool={worldQuestions(world.id)} />
    </div>
  );
}
