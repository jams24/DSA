// URLs for worlds and language tracks. Language tracks are worlds too (same XP, stars and bosses),
// but they live under /languages so the campaign and the language academy stay separate.

interface WorldRef {
  id: string;
  track?: "language";
}

export const isLanguage = (w: WorldRef | undefined) => w?.track === "language";

export function worldHref(w: WorldRef): string {
  return isLanguage(w) ? `/languages/${w.id}` : `/worlds/${w.id}`;
}

export function lessonHref(w: WorldRef, lessonId: string): string {
  return `${worldHref(w)}/${lessonId}`;
}

export function bossHref(w: WorldRef): string {
  return `${worldHref(w)}/boss`;
}
