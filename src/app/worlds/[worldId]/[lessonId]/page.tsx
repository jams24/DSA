import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WORLDS, getLesson } from "@/content";
import { highlight, renderMarkdown } from "@/lib/markdown";
import { LessonView } from "@/components/lesson/LessonView";

export function generateStaticParams() {
  return WORLDS.flatMap((w) => w.lessons.map((l) => ({ worldId: w.id, lessonId: l.id })));
}

export async function generateMetadata(props: PageProps<"/worlds/[worldId]/[lessonId]">): Promise<Metadata> {
  const { worldId, lessonId } = await props.params;
  const found = getLesson(worldId, lessonId);
  return found ? { title: found.lesson.title, description: found.lesson.tagline } : {};
}

export default async function LessonPage(props: PageProps<"/worlds/[worldId]/[lessonId]">) {
  const { worldId, lessonId } = await props.params;
  const found = getLesson(worldId, lessonId);
  if (!found) notFound();
  const { world, lesson, index } = found;

  const [conceptHtml, interview, code] = await Promise.all([
    renderMarkdown(lesson.concept),
    Promise.all(lesson.interview.map(async (qa) => ({ q: qa.q, freq: qa.freq, html: await renderMarkdown(qa.a) }))),
    Promise.all(
      (lesson.code ?? []).map(async (s) => ({
        title: s.title,
        note: s.note,
        variants: await Promise.all(s.variants.map(async (v) => ({ lang: v.lang, code: v.code, html: await highlight(v.code, v.lang) }))),
      })),
    ),
  ]);

  const prevLesson = world.lessons[index - 1];
  const nextLesson = world.lessons[index + 1];

  return (
    <LessonView
      worldId={world.id}
      index={index}
      lesson={{
        id: lesson.id,
        key: `${world.id}/${lesson.id}`,
        title: lesson.title,
        tagline: lesson.tagline,
        difficulty: lesson.difficulty,
        minutes: lesson.minutes,
        visualizers: lesson.visualizers ?? [],
        diagram: lesson.diagram,
        keyPoints: lesson.keyPoints,
        complexity: lesson.complexity,
        quiz: lesson.quiz,
        problems: lesson.problems,
      }}
      conceptHtml={conceptHtml}
      interview={interview}
      code={code}
      prev={prevLesson ? { href: `/worlds/${world.id}/${prevLesson.id}`, title: prevLesson.title } : null}
      next={
        nextLesson
          ? { href: `/worlds/${world.id}/${nextLesson.id}`, title: `Next: ${nextLesson.title}` }
          : { href: `/worlds/${world.id}/boss`, title: `Fight ${world.boss.name}` }
      }
    />
  );
}
