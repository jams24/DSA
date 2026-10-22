// The game rules. Pure functions only: the client runs them for guests, the server runs the
// exact same code for signed-in players, so XP / stars / streaks always agree.

import type { Catalog } from "@/content/types";
import { achievementContext, buildAchievements, isBossKey } from "./achievements";
import { levelForXp } from "./levels";

export interface ProgressEntry {
  read: boolean;
  visualized: boolean;
  bestScore: number;
  stars: number;
  completedAt?: string | null;
}

export interface CardState {
  box: number;
  dueAt: string;
  reviews: number;
}

export interface PlayerStats {
  arenaCorrect?: number;
  dailyCount?: number;
  reviews?: number;
  /** capped XP bucket (arena, flashcards, boss replays) for the current UTC day */
  capDay?: string;
  capXp?: number;
  /** recent once-per-day claims, e.g. "daily:2026-10-22" */
  claims?: string[];
  /** LeetCode Top Interview 150 slugs the player has marked solved */
  solved?: string[];
}

export interface PlayerState {
  xp: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  progress: Record<string, ProgressEntry>;
  achievements: string[];
  cards: Record<string, CardState>;
  stats: PlayerStats;
}

export type GameAction =
  | { type: "read"; lessonKey: string }
  | { type: "visualize"; lessonKey: string }
  | { type: "quiz"; lessonKey: string; correct: number; total: number }
  | { type: "boss"; worldId: string; won: boolean; heartsLeft: number }
  | { type: "arena"; correct: number; total: number }
  | { type: "daily"; day: string; correct: number; total: number }
  | { type: "review"; cardId: string; knew: boolean }
  | { type: "solve"; slug: string; solved: boolean };

export interface XpGrant {
  amount: number;
  reason: string;
}

export interface Outcome {
  state: PlayerState;
  grants: XpGrant[];
  xpGained: number;
  newAchievements: string[];
  levelUp: { from: number; to: number } | null;
  stars?: number;
  starsImproved?: boolean;
  alreadyClaimed?: boolean;
  capped?: boolean;
}

export const REWARDS = {
  read: 10,
  visualize: 10,
  complete: 20,
  star: 20,
  bossFirstWin: 150,
  bossStar: 30,
  bossReplay: 20,
  arenaPerCorrect: 5,
  review: 2,
  dailyBase: 30,
  dailyPerCorrect: 10,
  dailyCap: 300,
  guestExtraCap: 500,
  solve: 10,
} as const;

export const BOSS_HP = 8;
export const BOSS_HEARTS = 3;
export const DAILY_SIZE = 5;

/** Leitner box -> minutes until the card is due again */
const BOX_DELAY_MIN = [0, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 21];

export function emptyState(): PlayerState {
  return {
    xp: 0,
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    progress: {},
    achievements: [],
    cards: {},
    stats: {},
  };
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDay(d);
}

export function starsForScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (correct / total) * 100;
  if (pct >= 100) return 3;
  if (pct >= 80) return 2;
  if (pct >= 50) return 1;
  return 0;
}

/** XP a single progress entry is worth. Used to merge guest progress safely. */
export function entryXp(key: string, e: ProgressEntry): number {
  if (isBossKey(key)) return e.stars > 0 ? REWARDS.bossFirstWin + (e.stars - 1) * REWARDS.bossStar : 0;
  return (
    (e.read ? REWARDS.read : 0) +
    (e.visualized ? REWARDS.visualize : 0) +
    (e.stars > 0 ? REWARDS.complete : 0) +
    e.stars * REWARDS.star
  );
}

function blankEntry(): ProgressEntry {
  return { read: false, visualized: false, bestScore: 0, stars: 0, completedAt: null };
}

function clone(s: PlayerState): PlayerState {
  return {
    ...s,
    progress: Object.fromEntries(Object.entries(s.progress).map(([k, v]) => [k, { ...v }])),
    achievements: [...s.achievements],
    cards: Object.fromEntries(Object.entries(s.cards).map(([k, v]) => [k, { ...v }])),
    stats: { ...s.stats, claims: [...(s.stats.claims ?? [])], solved: [...(s.stats.solved ?? [])] },
  };
}

function touchStreak(s: PlayerState, today: string) {
  if (s.lastActiveDay === today) return;
  s.streak = s.lastActiveDay === previousDay(today) ? s.streak + 1 : 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.lastActiveDay = today;
}

/** Grants XP from the daily-capped bucket; returns what was actually granted. */
function capped(s: PlayerState, today: string, amount: number): number {
  if (s.stats.capDay !== today) {
    s.stats.capDay = today;
    s.stats.capXp = 0;
  }
  const allowed = Math.max(0, Math.min(amount, REWARDS.dailyCap - (s.stats.capXp ?? 0)));
  s.stats.capXp = (s.stats.capXp ?? 0) + allowed;
  return allowed;
}

function finish(
  before: PlayerState,
  s: PlayerState,
  grants: XpGrant[],
  catalog: Catalog,
  extra: Partial<Outcome> = {},
): Outcome {
  const achievements = buildAchievements(catalog);
  const ctx = achievementContext(catalog);
  const newAchievements: string[] = [];
  // achievements can grant XP that unlocks XP-based achievements, so iterate to a fixed point
  for (let changed = true; changed; ) {
    changed = false;
    for (const a of achievements) {
      if (s.achievements.includes(a.id) || !a.check(s, ctx)) continue;
      s.achievements.push(a.id);
      newAchievements.push(a.id);
      if (a.xp > 0) {
        s.xp += a.xp;
        grants.push({ amount: a.xp, reason: `achievement:${a.id}` });
      }
      changed = true;
    }
  }
  const from = levelForXp(before.xp);
  const to = levelForXp(s.xp);
  return {
    state: s,
    grants,
    xpGained: s.xp - before.xp,
    newAchievements,
    levelUp: to > from ? { from, to } : null,
    ...extra,
  };
}

export function applyAction(state: PlayerState, action: GameAction, catalog: Catalog, now = new Date()): Outcome {
  const s = clone(state);
  const today = utcDay(now);
  const grants: XpGrant[] = [];
  const grant = (amount: number, reason: string) => {
    if (amount <= 0) return;
    s.xp += amount;
    grants.push({ amount, reason });
  };
  touchStreak(s, today);

  switch (action.type) {
    case "read":
    case "visualize": {
      const e = (s.progress[action.lessonKey] ??= blankEntry());
      const field = action.type === "read" ? "read" : "visualized";
      if (!e[field]) {
        e[field] = true;
        grant(REWARDS[action.type], `${action.type}:${action.lessonKey}`);
      }
      return finish(state, s, grants, catalog);
    }

    case "quiz": {
      const e = (s.progress[action.lessonKey] ??= blankEntry());
      const total = Math.max(1, action.total);
      const correct = Math.max(0, Math.min(action.correct, total));
      const pct = Math.round((correct / total) * 100);
      const stars = starsForScore(correct, total);
      const prevStars = e.stars;
      e.bestScore = Math.max(e.bestScore, pct);
      if (stars > prevStars) {
        if (prevStars === 0) {
          e.completedAt = now.toISOString();
          grant(REWARDS.complete, `complete:${action.lessonKey}`);
        }
        grant((stars - prevStars) * REWARDS.star, `stars:${action.lessonKey}`);
        e.stars = stars;
      }
      return finish(state, s, grants, catalog, { stars, starsImproved: stars > prevStars });
    }

    case "boss": {
      const key = `boss/${action.worldId}`;
      const e = (s.progress[key] ??= blankEntry());
      const stars = action.won ? Math.max(1, Math.min(BOSS_HEARTS, action.heartsLeft)) : 0;
      const prevStars = e.stars;
      if (stars > prevStars) {
        if (prevStars === 0) {
          e.completedAt = now.toISOString();
          grant(REWARDS.bossFirstWin, `boss:${action.worldId}`);
          grant((stars - 1) * REWARDS.bossStar, `boss-stars:${action.worldId}`);
        } else {
          grant((stars - prevStars) * REWARDS.bossStar, `boss-stars:${action.worldId}`);
        }
        e.stars = stars;
        e.bestScore = Math.round((stars / BOSS_HEARTS) * 100);
      } else if (action.won) {
        const got = capped(s, today, REWARDS.bossReplay);
        grant(got, `boss-replay:${action.worldId}`);
        return finish(state, s, grants, catalog, { stars, starsImproved: false, capped: got < REWARDS.bossReplay });
      }
      return finish(state, s, grants, catalog, { stars, starsImproved: stars > prevStars });
    }

    case "arena": {
      const correct = Math.max(0, Math.min(action.correct, action.total));
      s.stats.arenaCorrect = (s.stats.arenaCorrect ?? 0) + correct;
      const want = correct * REWARDS.arenaPerCorrect;
      const got = capped(s, today, want);
      grant(got, "arena");
      return finish(state, s, grants, catalog, { capped: got < want });
    }

    case "daily": {
      const claim = `daily:${action.day}`;
      if (action.day !== today || s.stats.claims?.includes(claim)) {
        return finish(state, s, grants, catalog, { alreadyClaimed: true });
      }
      const correct = Math.max(0, Math.min(action.correct, action.total));
      s.stats.claims = [...(s.stats.claims ?? []), claim].slice(-30);
      s.stats.dailyCount = (s.stats.dailyCount ?? 0) + 1;
      grant(REWARDS.dailyBase + correct * REWARDS.dailyPerCorrect, claim);
      return finish(state, s, grants, catalog);
    }

    case "solve": {
      // symmetric so toggling can't farm XP: +10 when marked solved, −10 when unmarked
      const solved = new Set(s.stats.solved ?? []);
      if (action.solved && !solved.has(action.slug)) {
        solved.add(action.slug);
        grant(REWARDS.solve, `lc150:${action.slug}`);
      } else if (!action.solved && solved.has(action.slug)) {
        solved.delete(action.slug);
        s.xp = Math.max(0, s.xp - REWARDS.solve);
        grants.push({ amount: -REWARDS.solve, reason: `lc150-undo:${action.slug}` });
      }
      s.stats.solved = [...solved];
      return finish(state, s, grants, catalog);
    }

    case "review": {
      const prev = s.cards[action.cardId] ?? { box: 1, dueAt: now.toISOString(), reviews: 0 };
      const box = action.knew ? Math.min(5, prev.box + 1) : 1;
      s.cards[action.cardId] = {
        box,
        reviews: prev.reviews + 1,
        dueAt: new Date(now.getTime() + BOX_DELAY_MIN[box] * 60_000).toISOString(),
      };
      s.stats.reviews = (s.stats.reviews ?? 0) + 1;
      const got = capped(s, today, REWARDS.review);
      grant(got, "flashcard");
      return finish(state, s, grants, catalog, { capped: got < REWARDS.review });
    }
  }
}

/** Valid progress keys: every lesson key plus one boss key per world. */
export function validProgressKeys(catalog: Catalog): Set<string> {
  const keys = new Set<string>();
  for (const w of catalog) {
    keys.add(`boss/${w.id}`);
    for (const l of w.lessons) keys.add(l.key);
  }
  return keys;
}

/**
 * Folds progress a player earned as a guest (localStorage) into their account. XP from
 * lessons/bosses is recomputed from the merged entries, so replaying a sync never
 * double-counts; other guest XP (arena, dailies) is accepted up to a fixed cap.
 */
export function mergeGuest(
  server: PlayerState,
  guest: PlayerState,
  catalog: Catalog,
  now = new Date(),
  isValidSlug: (slug: string) => boolean = () => false,
): Outcome {
  const s = clone(server);
  const grants: XpGrant[] = [];
  const valid = validProgressKeys(catalog);

  let guestEntryXp = 0;
  let delta = 0;
  for (const [key, raw] of Object.entries(guest.progress ?? {})) {
    if (!valid.has(key) || !raw) continue;
    const g: ProgressEntry = {
      read: !!raw.read,
      visualized: !!raw.visualized,
      bestScore: Math.max(0, Math.min(100, Math.round(Number(raw.bestScore) || 0))),
      stars: Math.max(0, Math.min(3, Math.round(Number(raw.stars) || 0))),
      completedAt: raw.completedAt ?? null,
    };
    guestEntryXp += entryXp(key, g);
    const cur = s.progress[key] ?? blankEntry();
    const merged: ProgressEntry = {
      read: cur.read || g.read,
      visualized: cur.visualized || g.visualized,
      bestScore: Math.max(cur.bestScore, g.bestScore),
      stars: Math.max(cur.stars, g.stars),
      completedAt: cur.completedAt ?? g.completedAt ?? (Math.max(cur.stars, g.stars) > 0 ? now.toISOString() : null),
    };
    delta += entryXp(key, merged) - entryXp(key, cur);
    s.progress[key] = merged;
  }
  if (delta > 0) {
    s.xp += delta;
    grants.push({ amount: delta, reason: "guest-progress" });
  }

  const guestSolved = (guest.stats?.solved ?? []).filter((x) => typeof x === "string" && isValidSlug(x));
  const solved = new Set(s.stats.solved ?? []);
  const newlySolved = guestSolved.filter((x) => !solved.has(x));
  newlySolved.forEach((x) => solved.add(x));
  s.stats.solved = [...solved];
  if (newlySolved.length) {
    s.xp += newlySolved.length * REWARDS.solve;
    grants.push({ amount: newlySolved.length * REWARDS.solve, reason: "guest-lc150" });
  }

  const ach = buildAchievements(catalog);
  const guestAchXp = (guest.achievements ?? []).reduce((n, id) => n + (ach.find((a) => a.id === id)?.xp ?? 0), 0);
  const extra = Math.min(
    REWARDS.guestExtraCap,
    Math.max(0, Math.round(Number(guest.xp) || 0) - guestEntryXp - guestAchXp - guestSolved.length * REWARDS.solve),
  );
  if (extra > 0) {
    s.xp += extra;
    grants.push({ amount: extra, reason: "guest-extra" });
  }

  for (const [id, c] of Object.entries(guest.cards ?? {})) {
    if (!c || typeof id !== "string" || id.length > 200) continue;
    const cur = s.cards[id];
    if (!cur || (c.reviews ?? 0) > cur.reviews) {
      s.cards[id] = {
        box: Math.max(1, Math.min(5, Math.round(Number(c.box) || 1))),
        reviews: Math.max(0, Math.round(Number(c.reviews) || 0)),
        dueAt: isNaN(Date.parse(c.dueAt)) ? now.toISOString() : new Date(c.dueAt).toISOString(),
      };
    }
  }

  const gs = guest.stats ?? {};
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  s.stats.arenaCorrect = Math.max(s.stats.arenaCorrect ?? 0, num(gs.arenaCorrect));
  s.stats.dailyCount = Math.max(s.stats.dailyCount ?? 0, num(gs.dailyCount));
  s.stats.reviews = Math.max(s.stats.reviews ?? 0, num(gs.reviews));
  const claims = new Set([...(s.stats.claims ?? []), ...(gs.claims ?? []).filter((c) => typeof c === "string")]);
  s.stats.claims = [...claims].sort().slice(-30);

  const today = utcDay(now);
  if (guest.lastActiveDay && guest.lastActiveDay <= today && guest.lastActiveDay > (s.lastActiveDay ?? "")) {
    s.lastActiveDay = guest.lastActiveDay;
    s.streak = Math.min(num(guest.streak), 3650);
  }
  s.bestStreak = Math.max(s.bestStreak, s.streak, Math.min(num(guest.bestStreak), 3650));

  return finish(server, s, grants, catalog);
}
