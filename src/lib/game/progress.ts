import type { Catalog, CatalogLesson, CatalogWorld } from "@/content/types";
import type { PlayerState } from "./engine";

export function lessonStars(p: PlayerState, key: string) {
  return p.progress[key]?.stars ?? 0;
}

export function worldProgress(world: CatalogWorld, p: PlayerState) {
  const total = world.lessons.length;
  const done = world.lessons.filter((l) => lessonStars(p, l.key) > 0).length;
  const stars = world.lessons.reduce((n, l) => n + lessonStars(p, l.key), 0);
  const boss = lessonStars(p, `boss/${world.id}`);
  return { total, done, stars, maxStars: total * 3, boss, pct: total ? (done / total) * 100 : 0 };
}

export function overallProgress(catalog: Catalog, p: PlayerState) {
  const lessons = catalog.flatMap((w) => w.lessons);
  const done = lessons.filter((l) => lessonStars(p, l.key) > 0).length;
  const stars = lessons.reduce((n, l) => n + lessonStars(p, l.key), 0);
  const bosses = catalog.filter((w) => lessonStars(p, `boss/${w.id}`) > 0).length;
  return { total: lessons.length, done, stars, bosses, pct: lessons.length ? (done / lessons.length) * 100 : 0 };
}

/** First unfinished lesson in course order (or null when everything is done). */
export function nextLesson(catalog: Catalog, p: PlayerState): { world: CatalogWorld; lesson: CatalogLesson } | null {
  for (const world of catalog)
    for (const lesson of world.lessons) if (lessonStars(p, lesson.key) === 0) return { world, lesson };
  return null;
}

export function nextInWorld(world: CatalogWorld, p: PlayerState): CatalogLesson | null {
  return world.lessons.find((l) => lessonStars(p, l.key) === 0) ?? null;
}
