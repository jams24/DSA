import type { Metadata } from "next";
import { CHEATSHEETS } from "@/content/cheatsheets";
import { renderMarkdown } from "@/lib/markdown";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cheat Sheets",
  description: "Big-O tables, pattern recognition, latency numbers, estimation, system design template, distributed systems and AI inference formulas.",
};

export default async function CheatSheetsPage() {
  const sheets = await Promise.all(CHEATSHEETS.map(async (s) => ({ ...s, html: await renderMarkdown(s.md) })));
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10">
      <SectionTitle eyebrow="Pocket guide" title="Cheat sheets">
        The night-before-the-interview review. Everything here is expanded on inside the worlds.
      </SectionTitle>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {sheets.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-dim hover:bg-white/5 hover:text-ink">
                <span>{s.emoji}</span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>
        <div className="min-w-0 space-y-8">
          {sheets.map((s) => (
            <section key={s.id} id={s.id} className="panel scroll-mt-24 p-5 sm:p-8">
              <h2 className="mb-5 flex items-center gap-3 font-display text-2xl font-bold text-ink">
                <span>{s.emoji}</span>
                {s.title}
              </h2>
              <div className="prose-quest" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
