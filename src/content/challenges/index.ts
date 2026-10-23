import { BACKEND } from "./backend";
import { FRONTEND } from "./frontend";
import { LANGUAGE } from "./languages";
import type { Challenge, Track } from "./types";

export type { Challenge, Solution, Track } from "./types";

export const CHALLENGES: Challenge[] = [...BACKEND, ...FRONTEND, ...LANGUAGE];

export const TRACKS: Record<Track, { label: string; blurb: string }> = {
  backend: { label: "Backend", blurb: "Build an API or service: endpoints, validation, rate limits, auth, retries." },
  frontend: { label: "Frontend", blurb: "Machine-coding rounds: build a UI component that works with mouse, keyboard and screen readers." },
  language: { label: "Language drills", blurb: "Utility functions and concurrency patterns that test how well you know a language." },
};

/** Stacks in display order. */
export const STACKS = ["Python", "JavaScript", "Java", "Go", "React", "Vue"] as const;

export const challengeStacks = (c: Challenge) => [...new Set(c.solutions.map((s) => s.stack))];
