import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, Building2, Library, Mic, NotebookPen, Sparkles } from "lucide-react";
import { AMAZON_LPS, BEHAVIORAL_PITFALLS, COMPANY_NOTES, EXAMPLE_STORIES, STAR, STAR_TIPS, THEMES } from "@/content/interview";
import { PracticeDrill } from "@/components/interview/PracticeDrill";
import { QuestionList } from "@/components/interview/QuestionList";
import { StoryBank } from "@/components/interview/StoryBank";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Behavioral interview prep: STAR stories & Amazon Leadership Principles",
  description: "Build 6–8 STAR stories with live feedback, map them to common behavioral questions and Amazon's 16 Leadership Principles, read worked examples, and practice answering out loud against a timer.",
};

function H2({ icon: Icon, children, id }: { icon: typeof Sparkles; children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="flex scroll-mt-20 items-center gap-2 font-display text-2xl font-bold text-ink">
      <Icon size={22} className="text-cyan" /> {children}
    </h2>
  );
}

const TOC = [
  ["star", "The STAR method"],
  ["bank", "Your story bank"],
  ["practice", "Practice out loud"],
  ["questions", "Common questions"],
  ["amazon", "Amazon Leadership Principles"],
  ["examples", "Worked examples"],
  ["companies", "By company"],
] as const;

export default function BehavioralPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 pb-16">
      <nav className="text-sm text-dim">
        <Link href="/interview" className="hover:text-ink">
          Interview practice
        </Link>{" "}
        / <span className="text-ink">Behavioral</span>
      </nav>
      <div className="mt-4">
        <SectionTitle eyebrow="Every loop has one" title="Behavioral rounds">
          Every big-tech loop includes behavioral questions, and at Amazon they come up in every round. Strong engineers fail them by rambling or saying &quot;we&quot;. The fix is preparation: 6–8 real stories in STAR format, each mapped to several
          question themes, practiced out loud.
        </SectionTitle>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-lg border border-line-2 bg-panel px-2.5 py-1 text-xs font-semibold text-dim hover:text-ink">
            {label}
          </a>
        ))}
      </div>

      <section className="mt-10">
        <H2 icon={Sparkles} id="star">
          The STAR method
        </H2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAR.map((s) => (
            <div key={s.key} className="panel p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-cyan">{s.letter}</span>
                <span className="font-semibold text-ink">{s.label}</span>
                <span className="ml-auto font-mono text-xs text-faint">{s.share}</span>
              </div>
              <p className="mt-2 text-sm text-dim">{s.guide}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {STAR_TIPS.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-dim">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BEHAVIORAL_PITFALLS.map((p) => (
            <div key={p.title} className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/[0.06] p-4 text-sm">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
              <div>
                <div className="font-semibold text-ink">{p.title}</div>
                <p className="mt-0.5 text-dim">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <H2 icon={NotebookPen} id="bank">
          Your story bank
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">
          Write 6–8 stories that together cover these {THEMES.length} themes. Each story gets live checks: length when spoken, &quot;I&quot; vs &quot;we&quot;, a number in the result, a lesson at the end.
        </p>
        <StoryBank />
      </section>

      <section className="mt-12">
        <H2 icon={Mic} id="practice">
          Practice out loud
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">Reading your stories isn&apos;t practice. Say them, against the clock, and check yourself afterwards.</p>
        <PracticeDrill />
      </section>

      <section className="mt-12">
        <H2 icon={Library} id="questions">
          Common behavioral questions
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">What each question is really probing for. Filter by theme to see which questions one story can answer.</p>
        <QuestionList />
      </section>

      <section className="mt-12">
        <H2 icon={BookOpenCheck} id="amazon">
          Amazon&apos;s 16 Leadership Principles
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">
          Amazon interviewers are each assigned principles to assess, and the Bar Raiser digs deepest. Have 1–2 stories per principle. Names are Amazon&apos;s; the summaries are ours, so read{" "}
          <a href="https://www.amazon.jobs/content/en/our-workplace/leadership-principles" target="_blank" rel="noreferrer" className="font-semibold text-cyan hover:underline">
            Amazon&apos;s own page
          </a>{" "}
          before your loop.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {AMAZON_LPS.map((lp, i) => (
            <div key={lp.name} className="panel p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-bold text-orange">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display font-semibold text-ink">{lp.name}</h3>
              </div>
              <p className="mt-1 text-sm text-dim">{lp.meaning}</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-ink">They listen for: </span>
                <span className="text-dim">{lp.listenFor}</span>
              </p>
              <p className="mt-1 text-sm text-ink italic">“{lp.question}”</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <H2 icon={Sparkles} id="examples">
          Worked example answers
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">Realistic answers for a software engineer, each about 2–3 minutes spoken. Use them for shape, not content: interviewers can tell a borrowed story within two follow-up questions.</p>
        <div className="space-y-4">
          {EXAMPLE_STORIES.map((s) => (
            <details key={s.title} className="panel group p-5">
              <summary className="cursor-pointer list-none">
                <div className="text-xs font-semibold text-violet">{s.question}</div>
                <div className="mt-1 font-display text-lg font-semibold text-ink group-open:text-cyan">{s.title}</div>
              </summary>
              <div className="mt-4 space-y-3">
                {STAR.map((f) => (
                  <p key={f.key} className="text-sm leading-relaxed text-dim">
                    <span className="mr-1.5 font-semibold text-ink">{f.label}:</span>
                    {s[f.key]}
                  </p>
                ))}
                <p className="rounded-xl border border-emerald/40 bg-emerald/[0.06] p-3 text-sm text-dim">
                  <span className="font-semibold text-emerald">Why it works: </span>
                  {s.why}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <H2 icon={Building2} id="companies">
          How it differs by company
        </H2>
        <p className="mt-1 mb-4 text-sm text-dim">A general guide; formats change, so ask your recruiter what your loop includes. Recruiters are happy to tell you.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {COMPANY_NOTES.map((c) => (
            <div key={c.company} className="panel p-4">
              <h3 className="font-display font-semibold text-ink">{c.company}</h3>
              <p className="mt-1 text-sm text-dim">{c.format}</p>
              <p className="mt-2 text-sm">
                <span className="font-semibold text-ink">Focus: </span>
                <span className="text-dim">{c.focus}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
