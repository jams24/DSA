"use client";

import { STAR, THEMES, type StarKey, type ThemeId } from "@/content/interview";
import { createLocalStore } from "./localStore";

export interface Story {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  themes: ThemeId[];
  lps: string[];
  updated: number;
}

const THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

function isStories(v: unknown): v is Story[] {
  return (
    Array.isArray(v) &&
    v.every((s) => s && typeof s === "object" && typeof s.id === "string" && STAR.every((f) => typeof s[f.key] === "string") && Array.isArray(s.themes) && s.themes.every((t: unknown) => THEME_IDS.has(String(t))) && Array.isArray(s.lps))
  );
}

export const storyStore = createLocalStore<Story[]>("dsa-quest:star-stories", [], isStories);

export const newStory = (): Story => ({ id: crypto.randomUUID(), title: "", situation: "", task: "", action: "", result: "", themes: [], lps: [], updated: Date.now() });

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const WPM = 140; // a comfortable interview speaking pace

export interface StoryCheck {
  ok: boolean;
  text: string;
}

export function analyzeStory(s: Story) {
  const counts = Object.fromEntries(STAR.map((f) => [f.key, words(s[f.key])])) as Record<StarKey, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const seconds = Math.round((total / WPM) * 60);
  const share = (k: StarKey) => (total ? counts[k] / total : 0);
  const we = (s.action.match(/\bwe\b/gi) ?? []).length;
  const i = (s.action.match(/\bI\b/g) ?? []).length;

  const checks: StoryCheck[] = total
    ? [
        { ok: seconds >= 60 && seconds <= 210, text: seconds < 60 ? "Too short: under a minute when spoken. Add detail to the Action." : seconds > 210 ? "Too long: over 3½ minutes spoken. Trim the setup." : "Length is right: 1 to 3½ minutes spoken." },
        { ok: share("situation") + share("task") <= 0.35, text: share("situation") + share("task") <= 0.35 ? "Setup (S + T) is concise." : "Setup is long: keep Situation + Task under about a third." },
        { ok: share("action") >= 0.4, text: share("action") >= 0.4 ? "Action is the core of the story." : "Action is thin: it should be the biggest part (about 60%)." },
        { ok: i >= we, text: i >= we ? `Action says "I" ${i}× vs "we" ${we}×.` : `Action says "we" ${we}× but "I" only ${i}×. Make your own steps explicit.` },
        { ok: /\d/.test(s.result), text: /\d/.test(s.result) ? "Result includes a number." : "Result has no number. Quantify it (%, ms, hours saved, users)." },
        { ok: /learn|lesson|differently|next time|now i/i.test(s.result), text: /learn|lesson|differently|next time|now i/i.test(s.result) ? "Ends with a lesson learned." : "Add what you learned or would do differently." },
        { ok: s.themes.length > 0, text: s.themes.length ? `Tagged with ${s.themes.length} theme${s.themes.length === 1 ? "" : "s"}.` : "Tag the themes this story can answer." },
      ]
    : [];
  return { counts, total, seconds, checks, score: checks.filter((c) => c.ok).length };
}

export function storyToMarkdown(stories: Story[]) {
  const label = (id: ThemeId) => THEMES.find((t) => t.id === id)?.label ?? id;
  return stories
    .map((s) =>
      [
        `## ${s.title || "Untitled story"}`,
        s.themes.length ? `_Themes: ${s.themes.map(label).join(", ")}_` : "",
        s.lps.length ? `_Amazon LPs: ${s.lps.join(", ")}_` : "",
        ...STAR.map((f) => `**${f.label}.** ${s[f.key].trim() || "…"}`),
      ]
        .filter(Boolean)
        .join("\n\n"),
    )
    .join("\n\n---\n\n");
}
