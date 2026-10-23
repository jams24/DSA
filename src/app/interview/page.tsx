import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, ListChecks, MessagesSquare, Timer } from "lucide-react";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Interview practice",
  description: "Prepare for the parts of a big-tech interview loop that knowledge alone doesn't cover: behavioral rounds (STAR stories, Amazon Leadership Principles) and performing under pressure (timed mock interviews with a scorecard).",
};

const LOOP = [
  { round: "Recruiter / phone screen", what: "30 min: background, motivation, sometimes a short coding problem.", href: "/interview/behavioral", cta: "Tell-me-about-yourself prep" },
  { round: "Coding rounds (2–3)", what: "45 min each: one or two DSA problems, solved live while explaining.", href: "/interview/mock", cta: "Timed coding mock" },
  { round: "Practical / machine coding", what: "Build an API or UI component in 60–90 min (common at many companies and for frontend roles).", href: "/challenges", cta: "Coding challenges" },
  { round: "System design (mid-level and up)", what: "45–60 min: design a service end to end and defend the trade-offs.", href: "/worlds", cta: "System design worlds" },
  { round: "Behavioral (1+, woven into every round at Amazon)", what: "Past examples in STAR form: conflict, failure, ownership, impact.", href: "/interview/behavioral", cta: "Behavioral prep" },
];

export default function InterviewHub() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-16">
      <SectionTitle eyebrow="Beyond knowledge" title="Interview practice">
        Knowing the material gets you halfway. The rest is telling your stories well and solving problems live, on a clock, while someone watches. Practice both here.
      </SectionTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/interview/behavioral" className="group panel p-6 transition hover:-translate-y-1 hover:border-cyan/40">
          <MessagesSquare className="text-violet" />
          <h3 className="mt-4 font-display text-xl font-semibold text-ink">Behavioral rounds</h3>
          <p className="mt-1 text-sm text-dim">Build 6–8 STAR stories with live feedback, see which questions they cover, learn all 16 Amazon Leadership Principles, and drill answers out loud against a timer.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan">
            Build your story bank <ArrowRight size={14} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link href="/interview/mock" className="group panel p-6 transition hover:-translate-y-1 hover:border-cyan/40">
          <Timer className="text-orange" />
          <h3 className="mt-4 font-display text-xl font-semibold text-ink">Mock interview simulator</h3>
          <p className="mt-1 text-sm text-dim">A real 45-minute round: random problem, phase timer, interviewer interruptions, limited hints, then a big-tech style scorecard. Works solo or with a friend as the interviewer.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan">
            Start a mock <ArrowRight size={14} className="transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <ListChecks size={20} className="text-cyan" /> What a typical big-tech loop looks like
        </h2>
        <p className="mt-1 text-sm text-dim">Formats vary by company and level, but most loops are built from these rounds. Each one links to where you practice it.</p>
        <ol className="mt-4 space-y-2">
          {LOOP.map((l, i) => (
            <li key={l.round} className="panel flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan/10 font-mono text-sm font-bold text-cyan">{i + 1}</span>
              <div className="min-w-0 flex-1 basis-60">
                <div className="font-semibold text-ink">{l.round}</div>
                <div className="text-sm text-dim">{l.what}</div>
              </div>
              <Link href={l.href} className="inline-flex items-center gap-1 text-sm font-semibold text-cyan hover:underline">
                <Code2 size={14} /> {l.cta}
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
