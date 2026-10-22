import type { Metadata } from "next";
import { WORLDS } from "@/content";
import { renderMarkdown } from "@/lib/markdown";
import { QuestionBank, type BankProblem, type BankQA } from "@/components/bank/QuestionBank";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Question Bank",
  description: "Commonly asked interview questions with model answers, plus curated LeetCode practice by topic.",
};

export default async function QuestionsPage() {
  const qas: BankQA[] = [];
  const problems = new Map<string, BankProblem>();

  for (const w of WORLDS) {
    for (const l of w.lessons) {
      const href = `/worlds/${w.id}/${l.id}`;
      for (const qa of l.interview) {
        qas.push({ worldId: w.id, lesson: l.title, href, q: qa.q, freq: qa.freq, html: await renderMarkdown(qa.a) });
      }
      for (const p of l.problems ?? []) {
        const existing = problems.get(p.title);
        if (existing) {
          if (!existing.topics.includes(l.title)) existing.topics.push(l.title);
        } else problems.set(p.title, { ...p, worldId: w.id, topics: [l.title], href });
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <SectionTitle eyebrow="Question bank" title="Everything they might ask you">
        {qas.length} interview questions with model answers and {problems.size} hand-picked coding problems, tagged by topic and how often they come up.
      </SectionTitle>
      <QuestionBank qas={qas} problems={[...problems.values()]} />
    </div>
  );
}
