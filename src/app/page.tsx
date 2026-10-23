import Link from "next/link";
import { BookOpen, Brain, Code2, Eye, Layers, ListChecks, Network, Swords, Trophy, Zap } from "lucide-react";
import { contentStats } from "@/content";
import { ContinueButton, PlayerCard } from "@/components/home/PlayerCard";
import { DailyBanner } from "@/components/home/DailyBanner";
import { WorldCards } from "@/components/world/WorldCards";
import { LinkButton, SectionTitle } from "@/components/ui";

const LOOP = [
  { icon: BookOpen, title: "Learn", text: "Short, interview-focused explanations with the trade-offs spelled out.", color: "#65a30d" },
  { icon: Eye, title: "Visualize", text: "Step through animated algorithms and live system simulations.", color: "#0891b2" },
  { icon: Code2, title: "Code", text: "Clean reference implementations in Python, JavaScript and Java.", color: "#7c3aed" },
  { icon: Brain, title: "Interview", text: "The questions interviewers actually ask, with model answers.", color: "#db2777" },
  { icon: Swords, title: "Quiz & Boss", text: "Earn stars, then defeat each world's boss to prove mastery.", color: "#e11d48" },
];

export default function Home() {
  const stats = contentStats();
  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* hero */}
      <section className="grid items-center gap-10 pt-12 pb-16 lg:grid-cols-[1.25fr_1fr] lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/[0.07] px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />
            <span className="font-pixel text-[9px] tracking-widest text-cyan">
              PRESS START<span className="animate-blink">_</span>
            </span>
          </div>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] font-bold tracking-tight text-ink sm:text-6xl">
            Level up from <span className="bg-gradient-to-r from-lime to-emerald bg-clip-text text-transparent">arrays</span> to{" "}
            <span className="bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">Raft consensus</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-dim">
            DSA Quest is an interview-prep RPG. Clear levels in data structures, algorithms, system design, distributed systems, AI inference, DevOps/SRE and AI agents — with
            interactive visualizations, real interview questions and boss battles.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ContinueButton />
            <LinkButton href="/arena" variant="secondary" size="lg">
              <Swords size={18} /> Enter the Arena
            </LinkButton>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Levels", v: stats.lessons },
              { k: "Interactive labs", v: stats.visualizers },
              { k: "Quiz questions", v: stats.questions },
              { k: "Interview Q&As", v: stats.interview },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-line bg-panel/60 px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-faint">{s.k}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <PlayerCard />
      </section>

      <DailyBanner />

      {/* worlds */}
      <section className="pt-20">
        <SectionTitle eyebrow="World select" title="Nine worlds. One offer letter.">
          Start in Foundation Fields or warp straight to the realm your next interview needs. Every world ends with a boss.
        </SectionTitle>
        <WorldCards />
      </section>

      {/* loop */}
      <section className="pt-20">
        <SectionTitle eyebrow="How a level works" title="Learn it. See it. Code it. Defend it." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map((s, i) => (
            <div key={s.title} className="panel relative p-5">
              <div className="absolute top-4 right-4 font-pixel text-[10px] text-faint">0{i + 1}</div>
              <div className="grid h-11 w-11 place-items-center rounded-xl border" style={{ borderColor: `${s.color}55`, background: `${s.color}14`, color: s.color }}>
                <s.icon size={20} />
              </div>
              <h3 className="mt-4 font-display font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-dim">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* modes */}
      <section className="pt-20">
        <SectionTitle eyebrow="Game modes" title="Beyond the campaign" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[
            { href: "/leetcode-150", icon: ListChecks, title: "LeetCode Top 150", text: "All 150 with the key trick, a step-by-step simulation, pitfalls and tested solutions.", color: "#ea580c" },
            { href: "/arena/rapid-fire", icon: Zap, title: "Rapid Fire", text: "60 seconds. As many correct answers as you can.", color: "#d97706" },
            { href: "/arena/flashcards", icon: Layers, title: "Mock Interview Cards", text: "Spaced-repetition flashcards of real interview questions.", color: "#db2777" },
            { href: "/questions", icon: Network, title: "Question Bank", text: "Every interview question and LeetCode problem, searchable.", color: "#0891b2" },
            { href: "/leaderboard", icon: Trophy, title: "Leaderboard", text: "Weekly and all-time XP rankings.", color: "#059669" },
          ].map((m) => (
            <Link key={m.href} href={m.href} className="group panel p-5 transition hover:-translate-y-1" style={{ "--accent": m.color } as React.CSSProperties}>
              <m.icon style={{ color: m.color }} className="transition group-hover:scale-110" />
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{m.title}</h3>
              <p className="mt-1 text-sm text-dim">{m.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
