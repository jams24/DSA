import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Compass, ListChecks, Scale, Sparkles, TriangleAlert } from "lucide-react";
import { CHALLENGES, TRACKS } from "@/content/challenges";
import { CODE } from "@/content/challenges/code.generated";
import { highlight, renderMarkdown } from "@/lib/markdown";
import { PracticedToggle } from "@/components/challenges/PracticedToggle";
import { SolutionTabs, type SolutionView } from "@/components/challenges/SolutionTabs";

const DIFF_CLS = { Easy: "text-emerald border-emerald/40 bg-emerald/10", Medium: "text-amber border-amber/40 bg-amber/10", Hard: "text-rose border-rose/40 bg-rose/10" };

const langOf = (file: string) => ({ py: "python", js: "javascript", go: "go", java: "java", tsx: "tsx", vue: "vue" })[file.split(".").pop() ?? ""] ?? "text";

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/challenges/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = CHALLENGES.find((x) => x.slug === slug);
  return c ? { title: `${c.title}: coding challenge`, description: c.summary } : {};
}

function List({ items, icon: Icon, title, tone }: { items: string[]; icon: typeof Compass; title: string; tone: string }) {
  return (
    <section className="panel p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Icon size={18} className={tone} /> {title}
      </h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2 text-sm leading-relaxed text-dim">
            <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current ${tone}`} />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ChallengePage(props: PageProps<"/challenges/[slug]">) {
  const { slug } = await props.params;
  const index = CHALLENGES.findIndex((x) => x.slug === slug);
  if (index < 0) notFound();
  const c = CHALLENGES[index];
  const prev = CHALLENGES[index - 1];
  const next = CHALLENGES[index + 1];

  const [promptHtml, solutions] = await Promise.all([
    renderMarkdown(c.prompt),
    Promise.all(
      c.solutions.map(async (s): Promise<SolutionView> => {
        const code = CODE[s.file];
        const test = s.test ? CODE[s.test] : undefined;
        return {
          label: s.label,
          stack: s.stack,
          file: s.file,
          code,
          html: await highlight(code, s.lang),
          verified: s.run === "tsc" ? "type-checked" : s.run && s.test ? "tested" : null,
          notes: s.notes,
          test: s.test && test ? { file: s.test, code: test, html: await highlight(test, langOf(s.test)) } : undefined,
        };
      }),
    ),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-16">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-dim">
        <Link href="/challenges" className="hover:text-ink">
          Coding challenges
        </Link>
        <span>/</span>
        <span className="text-ink">{TRACKS[c.track].label}</span>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${DIFF_CLS[c.difficulty]}`}>{c.difficulty}</span>
          <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-dim">{c.frequency}</span>
          <span className="rounded-full border border-line-2 px-2.5 py-0.5 text-dim">{c.format}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-0.5 text-dim">
            <Clock size={11} /> {c.time}
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">{c.title}</h1>
        <p className="mt-2 text-dim">{c.summary}</p>
        <div className="mt-4">
          <PracticedToggle slug={c.slug} />
        </div>
      </header>

      <div className="mt-8 space-y-5">
        <section className="rounded-2xl border border-cyan/30 bg-cyan/[0.05] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan uppercase">
            <Sparkles size={14} /> The task
          </div>
          <div className="prose-quest mt-3" dangerouslySetInnerHTML={{ __html: promptHtml }} />
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <List items={c.requirements} icon={ListChecks} title="Requirements" tone="text-cyan" />
          <List items={c.graded} icon={Scale} title="What you're graded on" tone="text-violet" />
        </div>

        <section className="panel p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Compass size={18} className="text-emerald" /> Approach
          </h2>
          <ol className="mt-3 space-y-2">
            {c.approach.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm leading-relaxed text-dim">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald/10 font-mono text-xs font-bold text-emerald">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <List items={c.edgeCases} icon={TriangleAlert} title="Edge cases to handle" tone="text-amber" />
          <List items={c.followUps} icon={ArrowRight} title="Likely follow-up questions" tone="text-rose" />
        </div>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Reference solutions</h2>
          <SolutionTabs solutions={solutions} />
        </section>
      </div>

      <div className="mt-10 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/challenges/${prev.slug}`} className="panel flex min-w-0 items-center gap-3 p-4 text-sm hover:border-cyan/40">
            <ArrowLeft size={16} className="shrink-0 text-faint" />
            <span className="min-w-0">
              <span className="block text-xs text-faint">Previous</span>
              <span className="block truncate font-semibold text-ink">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/challenges/${next.slug}`} className="panel flex min-w-0 items-center justify-end gap-3 p-4 text-right text-sm hover:border-cyan/40">
            <span className="min-w-0">
              <span className="block text-xs text-faint">Next</span>
              <span className="block truncate font-semibold text-ink">{next.title}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-faint" />
          </Link>
        )}
      </div>
    </div>
  );
}
