import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, ExternalLink, Lightbulb, Sparkles } from "lucide-react";
import { getLessonByKey } from "@/content";
import { LC150, lcUrl } from "@/content/leetcode150";
import { LC_GUIDE, LC_PATTERNS } from "@/content/leetcode150-guide";
import { highlight } from "@/lib/markdown";
import { RevealCode } from "@/components/bank/RevealCode";
import { SolveToggle } from "@/components/bank/SolveToggle";

const ALL = LC150.flatMap((c) => c.problems.map((p) => ({ ...p, category: c.category, lesson: c.lesson })));

const DIFF_CLS = { Easy: "text-emerald border-emerald/40 bg-emerald/10", Medium: "text-amber border-amber/40 bg-amber/10", Hard: "text-rose border-rose/40 bg-rose/10" };

export function generateStaticParams() {
  return ALL.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/leetcode-150/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = ALL.find((x) => x.slug === slug);
  const g = LC_GUIDE[slug];
  return p && g ? { title: `${p.id}. ${p.title}: trick, approach & solution`, description: g.trick } : {};
}

export default async function ProblemGuidePage(props: PageProps<"/leetcode-150/[slug]">) {
  const { slug } = await props.params;
  const index = ALL.findIndex((x) => x.slug === slug);
  if (index < 0) notFound();
  const p = ALL[index];
  const g = LC_GUIDE[slug];
  const pattern = LC_PATTERNS[p.category];
  const lesson = getLessonByKey(p.lesson);
  const [codeHtml, templateHtml] = await Promise.all([highlight(g.code, "python"), highlight(pattern.template, "python")]);
  const prev = ALL[index - 1];
  const next = ALL[index + 1];
  const inCategory = ALL.filter((x) => x.category === p.category);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-dim">
        <Link href="/leetcode-150" className="hover:text-ink">
          LeetCode 150
        </Link>
        <span>/</span>
        <span>{p.category}</span>
        <span>/</span>
        <span className="text-ink">
          {inCategory.findIndex((x) => x.slug === slug) + 1} of {inCategory.length}
        </span>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${DIFF_CLS[p.difficulty]}`}>{p.difficulty}</span>
          <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-xs text-dim">{p.category}</span>
          <span className="font-mono text-xs text-faint">#{p.id}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">{p.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <SolveToggle slug={slug} />
          <a
            href={lcUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-panel px-4 text-sm font-semibold text-ink hover:border-cyan/50"
          >
            Solve on LeetCode <ExternalLink size={14} />
          </a>
        </div>
      </header>

      <div className="mt-8 space-y-5">
        <details className="panel group p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-amber">
            <Lightbulb size={16} /> Stuck? Open a small hint first
          </summary>
          <p className="mt-2 text-sm text-dim">{p.hint}</p>
        </details>

        <section className="rounded-2xl border border-cyan/30 bg-cyan/[0.05] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan uppercase">
            <Sparkles size={14} /> The key trick
          </div>
          <p className="mt-2 text-base leading-relaxed text-ink">{g.trick}</p>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Approach</h2>
          <ol className="mt-3 space-y-2">
            {g.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-dim">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan/10 font-mono text-xs font-bold text-cyan">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1 font-mono text-ink">time {g.time}</span>
            <span className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1 font-mono text-ink">space {g.space}</span>
          </div>
        </section>

        <section className="flex gap-3 rounded-2xl border border-amber/40 bg-amber/[0.06] p-4 text-sm leading-relaxed">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
          <div>
            <div className="font-semibold text-ink">Classic pitfall</div>
            <p className="mt-0.5 text-dim">{g.pitfall}</p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">Reference solution (Python, tested)</h2>
          <RevealCode html={codeHtml} code={g.code} />
        </section>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">Pattern: {p.category}</h2>
            {lesson && (
              <Link href={`/worlds/${p.lesson}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline">
                <BookOpen size={14} /> Lesson: {lesson.lesson.title}
              </Link>
            )}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold tracking-wide text-faint uppercase">Recognize it when…</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-dim">
                {pattern.recognize.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-faint uppercase">Tricks that transfer</div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-dim">
                {pattern.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <RevealCode html={templateHtml} code={pattern.template} hidden={false} />
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/leetcode-150/${prev.slug}`} className="panel flex min-w-0 items-center gap-3 p-4 text-sm hover:border-cyan/40">
            <ArrowLeft size={16} className="shrink-0 text-faint" />
            <span className="min-w-0">
              <span className="block text-xs text-faint">Previous</span>
              <span className="block truncate font-semibold text-ink">
                {prev.id}. {prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/leetcode-150/${next.slug}`} className="panel flex min-w-0 items-center justify-end gap-3 p-4 text-right text-sm hover:border-cyan/40">
            <span className="min-w-0">
              <span className="block text-xs text-faint">Next</span>
              <span className="block truncate font-semibold text-ink">
                {next.id}. {next.title}
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-faint" />
          </Link>
        )}
      </div>
    </div>
  );
}
