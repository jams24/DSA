import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Gauge, Users } from "lucide-react";
import { CHALLENGES } from "@/content/challenges";
import { AMAZON_LPS, BEHAVIORAL_QUESTIONS, PEER_PLATFORMS, PRESSURE_TIPS } from "@/content/interview";
import { LC150 } from "@/content/leetcode150";
import { LC_GUIDE } from "@/content/leetcode150-guide";
import { MockInterview, type MockChallenge, type MockProblem } from "@/components/interview/MockInterview";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mock interview simulator",
  description: "Practice performing under pressure: a timed 45-minute coding round (or a practical build or behavioral round) with phases, interviewer interruptions, limited hints, and a big-tech style scorecard. Solo or with a partner.",
};

export default function MockPage() {
  const problems: MockProblem[] = LC150.flatMap((c) => c.problems.map((p) => ({ slug: p.slug, title: p.title, difficulty: p.difficulty, category: c.category, hint: p.hint, trick: LC_GUIDE[p.slug]?.trick ?? p.hint })));
  const challenges: MockChallenge[] = CHALLENGES.filter((c) => c.track !== "language").map((c) => ({ slug: c.slug, title: c.title, difficulty: c.difficulty, summary: c.summary, requirements: c.requirements }));
  const questions = [...BEHAVIORAL_QUESTIONS.filter((q) => q.q.startsWith("Tell me about a time")).map((q) => q.q), ...AMAZON_LPS.map((lp) => lp.question)];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-16">
      <nav className="text-sm text-dim">
        <Link href="/interview" className="hover:text-ink">
          Interview practice
        </Link>{" "}
        / <span className="text-ink">Mock interview</span>
      </nav>
      <div className="mt-4">
        <SectionTitle eyebrow="Performance under pressure" title="Mock interview simulator">
          Knowing a solution isn&apos;t the same as producing it in 45 minutes while explaining your thinking to a stranger. This runs a realistic round: a random problem, a clock, phases, interruptions and a scorecard.
        </SectionTitle>
      </div>

      <MockInterview problems={problems} challenges={challenges} questions={questions} />

      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <Gauge size={22} className="text-cyan" /> Staying sharp under pressure
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRESSURE_TIPS.map((t) => (
            <div key={t.title} className="panel p-4">
              <h3 className="font-semibold text-ink">{t.title}</h3>
              <p className="mt-1 text-sm text-dim">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <Users size={22} className="text-cyan" /> Practice with a real person
        </h2>
        <p className="mt-1 text-sm text-dim">This simulator builds the habits; a human interviewer tests them. Aim for 5–10 live mocks before a real loop.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PEER_PLATFORMS.map((p) => (
            <div key={p.name} className="panel p-4">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan hover:underline">
                  {p.name} <ExternalLink size={13} />
                </a>
              ) : (
                <div className="font-semibold text-ink">{p.name}</div>
              )}
              <p className="mt-1 text-sm text-dim">{p.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-cyan/30 bg-cyan/[0.05] p-4 text-sm text-dim">
          <span className="font-semibold text-ink">Running a mock with a friend: </span>
          one of you starts a round here and turns on the interviewer view. The interviewer reads the problem aloud, answers clarifying questions, stays quiet unless you&apos;re stuck for about 10 minutes, asks the follow-ups listed, and fills
          in the scorecard at the end. Then swap roles: interviewing others is one of the fastest ways to learn what a strong answer looks like.
        </div>
      </section>
    </div>
  );
}
