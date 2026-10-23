import type { Metadata } from "next";
import { WORLDS } from "@/content";
import { LC150 } from "@/content/leetcode150";
import { LC_GUIDE, LC_PATTERNS } from "@/content/leetcode150-guide";
import { highlight } from "@/lib/markdown";
import { LeetCode150, type GuideRef, type LessonRef, type PatternRef } from "@/components/bank/LeetCode150";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "LeetCode Top Interview 150",
  description: "All 150 problems from LeetCode's Top Interview 150 study plan, each with its key trick, approach, a step-by-step simulation, complexity, pitfalls and a tested solution, plus a pattern guide per category.",
};

export default async function LeetCode150Page() {
  const lessons: Record<string, LessonRef> = {};
  for (const w of WORLDS)
    for (const l of w.lessons) lessons[`${w.id}/${l.id}`] = { href: `/worlds/${w.id}/${l.id}`, title: l.title, emoji: w.emoji, color: w.color };

  // the list page carries the explanations; full solutions live on each problem's own page
  const guides: Record<string, GuideRef> = {};
  for (const [slug, g] of Object.entries(LC_GUIDE)) guides[slug] = { trick: g.trick, steps: g.steps, time: g.time, space: g.space, pitfall: g.pitfall };

  const patterns: Record<string, PatternRef> = Object.fromEntries(
    await Promise.all(
      Object.entries(LC_PATTERNS).map(async ([category, p]) => [category, { recognize: p.recognize, tips: p.tips, template: p.template, templateHtml: await highlight(p.template, "python") }] as const),
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <SectionTitle eyebrow="LeetCode study plan" title="Top Interview 150">
        Every problem from LeetCode&apos;s Top Interview 150, grouped by pattern. Each problem comes with its key trick, the approach, complexity, the classic pitfall and a tested solution. Learn the pattern, solve it on LeetCode, then tick it off here for +10 XP.
      </SectionTitle>
      <LeetCode150 categories={LC150} lessons={lessons} guides={guides} patterns={patterns} />
    </div>
  );
}
