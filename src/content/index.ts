// Server-side entry point to the course. Client components never import this module
// directly; they receive the slices they need (catalog, lesson, question pools) as props.

import { hashString, mulberry32, sample } from "@/lib/random";
import { DAILY_SIZE } from "@/lib/game/engine";
import type { Catalog, FlashCard, Lesson, PooledQuestion, World } from "./types";
import { foundations } from "./worlds/foundations";
import { treesGraphs } from "./worlds/trees-graphs";
import { algorithms } from "./worlds/algorithms";
import { patterns } from "./worlds/patterns";
import { systemDesign } from "./worlds/system-design";
import { distributed } from "./worlds/distributed";
import { aiInference } from "./worlds/ai-inference";
import { infra } from "./worlds/infra";
import { agents } from "./worlds/agents";

export const WORLDS: World[] = [foundations, treesGraphs, algorithms, patterns, systemDesign, distributed, aiInference, infra, agents].sort(
  (a, b) => a.order - b.order,
);

export function getWorld(worldId: string): World | undefined {
  return WORLDS.find((w) => w.id === worldId);
}

export function getLesson(worldId: string, lessonId: string): { world: World; lesson: Lesson; index: number } | undefined {
  const world = getWorld(worldId);
  if (!world) return undefined;
  const index = world.lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return undefined;
  return { world, lesson: world.lessons[index], index };
}

export function getLessonByKey(key: string) {
  const [worldId, lessonId] = key.split("/");
  return lessonId ? getLesson(worldId, lessonId) : undefined;
}

export function buildCatalog(): Catalog {
  return WORLDS.map((w) => ({
    id: w.id,
    order: w.order,
    title: w.title,
    subtitle: w.subtitle,
    description: w.description,
    emoji: w.emoji,
    color: w.color,
    boss: w.boss,
    lessons: w.lessons.map((l) => ({
      id: l.id,
      key: `${w.id}/${l.id}`,
      title: l.title,
      tagline: l.tagline,
      difficulty: l.difficulty,
      minutes: l.minutes,
      caseStudy: l.caseStudy,
      hasVisualizer: !!(l.visualizers?.length || l.diagram),
    })),
  }));
}

let poolCache: PooledQuestion[] | null = null;
let poolIndex: Map<string, PooledQuestion> | null = null;

export function allQuestions(): PooledQuestion[] {
  if (!poolCache) {
    poolCache = WORLDS.flatMap((w) =>
      w.lessons.flatMap((l) =>
        l.quiz.map((q, i) => ({ ...q, id: `${w.id}/${l.id}#${i}`, worldId: w.id, lessonTitle: l.title })),
      ),
    );
    poolIndex = new Map(poolCache.map((q) => [q.id, q]));
  }
  return poolCache;
}

export function getQuestion(id: string): PooledQuestion | undefined {
  allQuestions();
  return poolIndex!.get(id);
}

export function worldQuestions(worldId: string): PooledQuestion[] {
  return allQuestions().filter((q) => q.worldId === worldId);
}

/** The same five questions for everyone on a given UTC day. */
export function dailyQuestions(day: string): PooledQuestion[] {
  return sample(allQuestions(), DAILY_SIZE, mulberry32(hashString(`daily:${day}`)));
}

export function allFlashcards(): FlashCard[] {
  return WORLDS.flatMap((w) =>
    w.lessons.flatMap((l) =>
      l.interview.map((qa, i) => ({
        id: `${w.id}/${l.id}~${i}`,
        worldId: w.id,
        lessonTitle: l.title,
        q: qa.q,
        a: qa.a,
        freq: qa.freq,
      })),
    ),
  );
}

export function contentStats() {
  const lessons = WORLDS.flatMap((w) => w.lessons);
  const visualizers = new Set(lessons.flatMap((l) => l.visualizers ?? []));
  return {
    worlds: WORLDS.length,
    lessons: lessons.length,
    visualizers: visualizers.size + lessons.filter((l) => l.diagram).length,
    questions: lessons.reduce((n, l) => n + l.quiz.length, 0),
    interview: lessons.reduce((n, l) => n + l.interview.length, 0),
    problems: lessons.reduce((n, l) => n + (l.problems?.length ?? 0), 0),
  };
}
