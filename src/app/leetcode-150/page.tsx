import type { Metadata } from "next";
import { WORLDS } from "@/content";
import { LC150 } from "@/content/leetcode150";
import { LeetCode150, type LessonRef } from "@/components/bank/LeetCode150";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "LeetCode Top Interview 150",
  description: "All 150 problems from LeetCode's Top Interview 150 study plan, with hints, pattern lessons and a solved tracker.",
};

export default function LeetCode150Page() {
  const lessons: Record<string, LessonRef> = {};
  for (const w of WORLDS)
    for (const l of w.lessons) lessons[`${w.id}/${l.id}`] = { href: `/worlds/${w.id}/${l.id}`, title: l.title, emoji: w.emoji, color: w.color };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <SectionTitle eyebrow="LeetCode study plan" title="Top Interview 150">
        Every problem from LeetCode&apos;s Top Interview 150, grouped by pattern. Learn the pattern in its lesson, solve on LeetCode, then tick it off here for +10 XP.
      </SectionTitle>
      <LeetCode150 categories={LC150} lessons={lessons} />
    </div>
  );
}
