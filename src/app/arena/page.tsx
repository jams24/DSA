import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, Layers, Zap } from "lucide-react";
import { WORLDS, allFlashcards } from "@/content";
import { DAILY_SIZE, REWARDS } from "@/lib/game/engine";
import { SectionTitle } from "@/components/ui";
import { BossList } from "@/components/arena/BossList";

export const metadata: Metadata = { title: "Arena", description: "Daily challenge, rapid fire, mock interview flashcards and boss rush." };

export default function ArenaPage() {
  const cards = allFlashcards().length;
  const modes = [
    {
      href: "/arena/daily",
      icon: CalendarCheck2,
      color: "#d97706",
      title: "Daily Challenge",
      text: `${DAILY_SIZE} questions drawn from every world. Same set for everyone today.`,
      reward: `up to +${REWARDS.dailyBase + DAILY_SIZE * REWARDS.dailyPerCorrect} XP · once a day`,
    },
    {
      href: "/arena/rapid-fire",
      icon: Zap,
      color: "#0891b2",
      title: "Rapid Fire",
      text: "60 seconds on the clock. Answer as many as you can. Pick the worlds to draw from.",
      reward: `+${REWARDS.arenaPerCorrect} XP per correct answer`,
    },
    {
      href: "/arena/flashcards",
      icon: Layers,
      color: "#db2777",
      title: "Mock Interview Cards",
      text: `${cards} real interview questions with model answers, scheduled by spaced repetition.`,
      reward: `+${REWARDS.review} XP per review`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10">
      <SectionTitle eyebrow="The Arena" title="Train like it's interview day">
        Arena modes mix questions from every world. Arena, flashcard and boss-replay XP shares a daily cap of {REWARDS.dailyCap} XP so the leaderboard rewards learning, not
        grinding.
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        {modes.map((m) => (
          <Link key={m.href} href={m.href} className="group panel relative overflow-hidden p-6 transition hover:-translate-y-1" style={{ "--accent": m.color } as React.CSSProperties}>
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition group-hover:opacity-40" style={{ background: m.color }} />
            <div className="relative">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border" style={{ borderColor: `${m.color}66`, background: `${m.color}14`, color: m.color }}>
                <m.icon />
              </div>
              <h2 className="mt-5 font-display text-xl font-bold text-ink">{m.title}</h2>
              <p className="mt-2 text-sm text-dim">{m.text}</p>
              <div className="mt-5 font-pixel text-[9px]" style={{ color: m.color }}>
                {m.reward}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <section className="pt-16">
        <SectionTitle eyebrow="Boss rush" title="Rematch any boss" />
        <BossList bosses={WORLDS.map((w) => ({ worldId: w.id, worldTitle: w.title, color: w.color, ...w.boss }))} />
      </section>
    </div>
  );
}
