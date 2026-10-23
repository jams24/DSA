import type { Metadata } from "next";
import { CHALLENGES, STACKS, TRACKS, challengeStacks } from "@/content/challenges";
import { ChallengeList, type ChallengeCard } from "@/components/challenges/ChallengeList";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Practical coding challenges",
  description:
    "The build-something tasks companies actually give: backend APIs (URL shortener, rate limiter, auth, idempotent payments), frontend machine-coding components, and language drills in Python, JavaScript, Java, Go, React and Vue, each with tested reference solutions.",
};

export default function ChallengesPage() {
  const cards: ChallengeCard[] = CHALLENGES.map((c) => ({
    slug: c.slug,
    title: c.title,
    track: c.track,
    difficulty: c.difficulty,
    frequency: c.frequency,
    format: c.format,
    time: c.time,
    summary: c.summary,
    stacks: challengeStacks(c),
  }));
  const solutions = CHALLENGES.reduce((n, c) => n + c.solutions.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-16">
      <SectionTitle eyebrow="Practical rounds" title="Coding challenges">
        Not puzzles: the things interviewers ask you to <em>build</em>. APIs for backend roles, UI components for frontend machine-coding rounds, and language drills for phone screens. {CHALLENGES.length} challenges, {solutions} reference
        solutions, each one executed or type-checked against its own test.
      </SectionTitle>
      <ChallengeList challenges={cards} tracks={TRACKS} stacks={STACKS} />
    </div>
  );
}
