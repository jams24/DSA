import type { Catalog } from "@/content/types";
import { levelForXp } from "./levels";
import type { PlayerState } from "./engine";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  xp: number;
  check: (s: PlayerState, ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  catalog: Catalog;
  lessonKeys: string[];
  caseStudyKeys: string[];
}

export function isBossKey(key: string) {
  return key.startsWith("boss/");
}

function lessonEntries(s: PlayerState) {
  return Object.entries(s.progress).filter(([k]) => !isBossKey(k));
}

const completedCount = (s: PlayerState) => lessonEntries(s).filter(([, e]) => e.stars > 0).length;
const totalStars = (s: PlayerState) => lessonEntries(s).reduce((n, [, e]) => n + e.stars, 0);
const bossWins = (s: PlayerState) => Object.entries(s.progress).filter(([k, e]) => isBossKey(k) && e.stars > 0).length;

export function buildAchievements(catalog: Catalog): Achievement[] {
  const base: Achievement[] = [
    {
      id: "first-steps",
      name: "First Steps",
      description: "Complete your first lesson quiz.",
      emoji: "👣",
      xp: 25,
      check: (s) => completedCount(s) >= 1,
    },
    {
      id: "bookworm",
      name: "Bookworm",
      description: "Read 10 lessons end to end.",
      emoji: "📚",
      xp: 50,
      check: (s) => lessonEntries(s).filter(([, e]) => e.read).length >= 10,
    },
    {
      id: "visual-learner",
      name: "Visual Learner",
      description: "Play with 10 different visualizers.",
      emoji: "🔭",
      xp: 50,
      check: (s) => lessonEntries(s).filter(([, e]) => e.visualized).length >= 10,
    },
    {
      id: "perfectionist",
      name: "Perfectionist",
      description: "Ace a lesson quiz for 3 stars.",
      emoji: "💯",
      xp: 25,
      check: (s) => lessonEntries(s).some(([, e]) => e.stars === 3),
    },
    {
      id: "star-collector",
      name: "Star Collector",
      description: "Collect 50 stars across lessons.",
      emoji: "🌟",
      xp: 100,
      check: (s) => totalStars(s) >= 50,
    },
    {
      id: "triple-crown",
      name: "Triple Crown",
      description: "Earn 3 stars on 15 different lessons.",
      emoji: "👑",
      xp: 100,
      check: (s) => lessonEntries(s).filter(([, e]) => e.stars === 3).length >= 15,
    },
    {
      id: "boss-slayer",
      name: "Boss Slayer",
      description: "Defeat your first world boss.",
      emoji: "⚔️",
      xp: 50,
      check: (s) => bossWins(s) >= 1,
    },
    {
      id: "flawless",
      name: "Flawless Victory",
      description: "Defeat a boss without losing a single heart.",
      emoji: "🛡️",
      xp: 75,
      check: (s) => Object.entries(s.progress).some(([k, e]) => isBossKey(k) && e.stars === 3),
    },
    {
      id: "legend",
      name: "Legend of the Realms",
      description: "Defeat every world boss.",
      emoji: "🐉",
      xp: 300,
      check: (s, c) => c.catalog.every((w) => (s.progress[`boss/${w.id}`]?.stars ?? 0) > 0),
    },
    {
      id: "streak-3",
      name: "Kindling",
      description: "Keep a 3-day learning streak.",
      emoji: "🔥",
      xp: 30,
      check: (s) => s.bestStreak >= 3,
    },
    {
      id: "streak-7",
      name: "On Fire",
      description: "Keep a 7-day learning streak.",
      emoji: "☄️",
      xp: 75,
      check: (s) => s.bestStreak >= 7,
    },
    {
      id: "streak-30",
      name: "Unstoppable",
      description: "Keep a 30-day learning streak.",
      emoji: "🌋",
      xp: 300,
      check: (s) => s.bestStreak >= 30,
    },
    {
      id: "xp-1000",
      name: "Four Digits",
      description: "Earn 1,000 XP.",
      emoji: "💎",
      xp: 0,
      check: (s) => s.xp >= 1000,
    },
    {
      id: "xp-5000",
      name: "XP Hoarder",
      description: "Earn 5,000 XP.",
      emoji: "🏦",
      xp: 0,
      check: (s) => s.xp >= 5000,
    },
    {
      id: "level-10",
      name: "Double Digits",
      description: "Reach level 10.",
      emoji: "🔟",
      xp: 0,
      check: (s) => levelForXp(s.xp) >= 10,
    },
    {
      id: "daily-7",
      name: "Daily Devotee",
      description: "Finish 7 daily challenges.",
      emoji: "📅",
      xp: 75,
      check: (s) => (s.stats.dailyCount ?? 0) >= 7,
    },
    {
      id: "gladiator",
      name: "Gladiator",
      description: "Answer 100 questions correctly in the Arena.",
      emoji: "🏟️",
      xp: 100,
      check: (s) => (s.stats.arenaCorrect ?? 0) >= 100,
    },
    {
      id: "memory-palace",
      name: "Memory Palace",
      description: "Review 50 interview flashcards.",
      emoji: "🧠",
      xp: 75,
      check: (s) => (s.stats.reviews ?? 0) >= 50,
    },
    {
      id: "architect",
      name: "The Architect",
      description: "Complete 3 system design case studies.",
      emoji: "🏗️",
      xp: 100,
      check: (s, c) => c.caseStudyKeys.filter((k) => (s.progress[k]?.stars ?? 0) > 0).length >= 3,
    },
    {
      id: "completionist",
      name: "Completionist",
      description: "Complete every single lesson.",
      emoji: "🏆",
      xp: 500,
      check: (s, c) => c.lessonKeys.length > 0 && c.lessonKeys.every((k) => (s.progress[k]?.stars ?? 0) > 0),
    },
  ];

  const worldClears: Achievement[] = catalog.map((w) => ({
    id: `clear-${w.id}`,
    name: `${w.title} Cleared`,
    description: `Complete every lesson in ${w.title}.`,
    emoji: w.emoji,
    xp: 100,
    check: (s) => w.lessons.length > 0 && w.lessons.every((l) => (s.progress[l.key]?.stars ?? 0) > 0),
  }));

  return [...base, ...worldClears];
}

export function achievementContext(catalog: Catalog): AchievementContext {
  const lessons = catalog.flatMap((w) => w.lessons);
  return {
    catalog,
    lessonKeys: lessons.map((l) => l.key),
    caseStudyKeys: lessons.filter((l) => l.caseStudy).map((l) => l.key),
  };
}
