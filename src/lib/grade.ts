// Server-side grading: turns what the browser submitted (raw answers) into a trusted GameAction.

import { buildCatalog, dailyQuestions, getLessonByKey, getQuestion, getWorld } from "@/content";
import type { Catalog } from "@/content/types";
import { LC150_SLUGS } from "@/content/leetcode150";
import type { ActionRequest } from "./api-schemas";
import { simulateBoss } from "./game/boss";
import { type GameAction, utcDay } from "./game/engine";

let catalogCache: Catalog | null = null;
export function catalog(): Catalog {
  return (catalogCache ??= buildCatalog());
}

export type Graded = { action: GameAction; detail?: Record<string, unknown> } | { error: string };

export function grade(req: ActionRequest, now: Date): Graded {
  switch (req.type) {
    case "read":
    case "visualize":
      if (!getLessonByKey(req.lessonKey)) return { error: "Unknown lesson" };
      return { action: { type: req.type, lessonKey: req.lessonKey } };

    case "quiz": {
      const found = getLessonByKey(req.lessonKey);
      if (!found) return { error: "Unknown lesson" };
      const quiz = found.lesson.quiz;
      if (req.answers.length !== quiz.length) return { error: "Answer every question" };
      const correct = quiz.filter((q, i) => q.answer === req.answers[i]).length;
      return { action: { type: "quiz", lessonKey: req.lessonKey, correct, total: quiz.length } };
    }

    case "boss": {
      if (!getWorld(req.worldId)) return { error: "Unknown world" };
      const seen = new Set<string>();
      const results: boolean[] = [];
      for (const a of req.answers) {
        const q = getQuestion(a.id);
        if (!q || q.worldId !== req.worldId || seen.has(a.id)) return { error: "Invalid question" };
        seen.add(a.id);
        results.push(q.answer === a.choice);
      }
      const sim = simulateBoss(results);
      return { action: { type: "boss", worldId: req.worldId, won: sim.won, heartsLeft: sim.heartsLeft }, detail: { ...sim } };
    }

    case "arena": {
      const seen = new Set<string>();
      let correct = 0;
      for (const a of req.answers) {
        const q = getQuestion(a.id);
        if (!q || seen.has(a.id)) continue;
        seen.add(a.id);
        if (q.answer === a.choice) correct++;
      }
      return { action: { type: "arena", correct, total: seen.size } };
    }

    case "daily": {
      const day = utcDay(now);
      const qs = dailyQuestions(day);
      if (req.answers.length !== qs.length) return { error: "Answer every question" };
      const correct = qs.filter((q, i) => q.answer === req.answers[i]).length;
      return { action: { type: "daily", day, correct, total: qs.length } };
    }

    case "solve":
      if (!LC150_SLUGS.has(req.slug)) return { error: "Unknown problem" };
      return { action: { type: "solve", slug: req.slug, solved: req.solved } };

    case "review": {
      const [lessonKey, idx] = req.cardId.split("~");
      const found = lessonKey ? getLessonByKey(lessonKey) : undefined;
      if (!found || !(Number(idx) >= 0 && Number(idx) < found.lesson.interview.length)) return { error: "Unknown card" };
      return { action: { type: "review", cardId: req.cardId, knew: req.knew } };
    }
  }
}
