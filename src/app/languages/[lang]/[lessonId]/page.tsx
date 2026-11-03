import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANGUAGE_TRACKS, getLesson } from "@/content";
import { LessonPageBody } from "@/components/lesson/LessonPage";

export function generateStaticParams() {
  return LANGUAGE_TRACKS.flatMap((w) => w.lessons.map((l) => ({ lang: w.id, lessonId: l.id })));
}

export async function generateMetadata(props: PageProps<"/languages/[lang]/[lessonId]">): Promise<Metadata> {
  const { lang, lessonId } = await props.params;
  const found = getLesson(lang, lessonId);
  return found ? { title: `${found.lesson.title} · ${found.world.title}`, description: found.lesson.tagline } : {};
}

export default async function LanguageLessonPage(props: PageProps<"/languages/[lang]/[lessonId]">) {
  const { lang, lessonId } = await props.params;
  if (!LANGUAGE_TRACKS.some((w) => w.id === lang)) notFound();
  return <LessonPageBody worldId={lang} lessonId={lessonId} />;
}
