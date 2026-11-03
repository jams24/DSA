// Server half of a lesson page, shared by /worlds/[worldId]/[lessonId] and /languages/[lang]/[lessonId].
// Renders all markdown and code to HTML at build time, then hands plain data to the client LessonView.

import { notFound } from "next/navigation";
import { getLesson } from "@/content";
import { highlight, renderMarkdown } from "@/lib/markdown";
import { bossHref, lessonHref } from "@/lib/paths";
import { LessonView } from "./LessonView";
import type { RenderedProject, RenderedToolbox } from "./LanguageTabs";

export async function LessonPageBody({ worldId, lessonId }: { worldId: string; lessonId: string }) {
  const found = getLesson(worldId, lessonId);
  if (!found) notFound();
  const { world, lesson, index } = found;

  const [conceptHtml, interview, code, project, toolbox] = await Promise.all([
    renderMarkdown(lesson.concept),
    Promise.all(lesson.interview.map(async (qa) => ({ q: qa.q, freq: qa.freq, html: await renderMarkdown(qa.a) }))),
    Promise.all(
      (lesson.code ?? []).map(async (s) => ({
        title: s.title,
        note: s.note,
        variants: await Promise.all(s.variants.map(async (v) => ({ lang: v.lang, code: v.code, html: await highlight(v.code, v.lang) }))),
        explainHtml: s.explain ? await renderMarkdown(s.explain) : undefined,
        output: s.output,
      })),
    ),
    lesson.project ? renderProject(lesson.project) : Promise.resolve(undefined),
    lesson.toolbox ? renderToolbox(lesson.toolbox) : Promise.resolve(undefined),
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
        stage: lesson.stage,
      }}
      conceptHtml={conceptHtml}
      interview={interview}
      code={code}
      project={project}
      toolbox={toolbox}
      prev={prevLesson ? { href: lessonHref(world, prevLesson.id), title: prevLesson.title } : null}
      next={nextLesson ? { href: lessonHref(world, nextLesson.id), title: `Next: ${nextLesson.title}` } : { href: bossHref(world), title: `Fight ${world.boss.name}` }}
    />
  );
}

async function renderProject(p: NonNullable<import("@/content/types").Lesson["project"]>): Promise<RenderedProject> {
  return {
    summaryHtml: await renderMarkdown(p.summary),
    skills: p.skills,
    treeHtml: await highlight(p.tree, "text"),
    extensions: p.extensions,
    steps: await Promise.all(
      p.steps.map(async (s) => ({
        title: s.title,
        explainHtml: await renderMarkdown(s.explain),
        files: await Promise.all(s.files.map(async (f) => ({ path: f.path, lang: f.lang, code: f.code, html: await highlight(f.code, f.lang) }))),
        runHtml: s.run ? await highlight(s.run, "bash") : undefined,
        run: s.run,
        output: s.output,
      })),
    ),
  };
}

async function renderToolbox(groups: NonNullable<import("@/content/types").Lesson["toolbox"]>): Promise<RenderedToolbox> {
  return Promise.all(
    groups.map(async (g) => ({
      category: g.category,
      blurb: g.blurb,
      libs: await Promise.all(
        g.libs.map(async (l) => ({
          name: l.name,
          what: l.what,
          when: l.when,
          tag: l.tag,
          snippet: l.snippet ? { lang: l.snippet.lang, code: l.snippet.code, html: await highlight(l.snippet.code, l.snippet.lang) } : undefined,
        })),
      ),
    })),
  );
}
