import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { CORE_WORLDS, getLesson, getWorld } from "@/content";
import { isLanguage, lessonHref } from "@/lib/paths";
import { LessonPageBody } from "@/components/lesson/LessonPage";

export function generateStaticParams() {
  return CORE_WORLDS.flatMap((w) => w.lessons.map((l) => ({ worldId: w.id, lessonId: l.id })));
}

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/[lessonId]">): Promise<Metadata> {
  const { worldId, lessonId } = await props.params;
  const found = getLesson(worldId, lessonId);
  return found ? { title: found.lesson.title, description: found.lesson.tagline } : {};
}

export default async function LessonPage(props: PageProps<"/worlds/[worldId]/[lessonId]">) {
  const { worldId, lessonId } = await props.params;
  const world = getWorld(worldId);
  if (world && isLanguage(world)) permanentRedirect(lessonHref(world, lessonId));
  return <LessonPageBody worldId={worldId} lessonId={lessonId} />;
}
