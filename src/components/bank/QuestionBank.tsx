"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ExternalLink, Search } from "lucide-react";
import type { Frequency, PracticeProblem } from "@/content/types";
import { useCatalog } from "@/components/game/GameProvider";
import { QAItem } from "@/components/lesson/Interview";
import { Segmented } from "@/components/viz/kit";

export interface BankQA {
  worldId: string;
  lesson: string;
  href: string;
  q: string;
  freq?: Frequency;
  html: string;
}

export interface BankProblem extends PracticeProblem {
  worldId: string;
  topics: string[];
  href: string;
}

const PAGE = 40;

export function QuestionBank({ qas, problems }: { qas: BankQA[]; problems: BankProblem[] }) {
  const catalog = useCatalog();
  const [tab, setTab] = useState<"qa" | "code">("qa");
  const [world, setWorld] = useState("all");
  const [freq, setFreq] = useState<"all" | Frequency>("all");
  const [diff, setDiff] = useState<"all" | "Easy" | "Medium" | "Hard">("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const q = query.trim().toLowerCase();
  const filteredQa = useMemo(
    () =>
      qas.filter(
        (x) =>
          (world === "all" || x.worldId === world) &&
          (freq === "all" || x.freq === freq) &&
          (!q || x.q.toLowerCase().includes(q) || x.lesson.toLowerCase().includes(q)),
      ),
    [qas, world, freq, q],
  );
  const filteredProblems = useMemo(
    () =>
      problems.filter(
        (p) =>
          (world === "all" || p.worldId === world) &&
          (diff === "all" || p.difficulty === diff) &&
          (!q || p.title.toLowerCase().includes(q) || p.topics.some((t) => t.toLowerCase().includes(q))),
      ),
    [problems, world, diff, q],
  );
  const worldOf = (id: string) => catalog.find((w) => w.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            setLimit(PAGE);
          }}
          options={[
            { value: "qa", label: `Interview questions (${qas.length})` },
            { value: "code", label: `Coding problems (${problems.length})` },
          ]}
        />
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={tab === "qa" ? "Search questions, e.g. “consistent hashing”" : "Search problems or topics"}
            className="h-10 w-full rounded-xl border border-line-2 bg-panel pr-3 pl-9 text-sm text-ink outline-none placeholder:text-faint focus:border-cyan/60"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip on={world === "all"} onClick={() => setWorld("all")}>
          All worlds
        </Chip>
        {catalog.map((w) => (
          <Chip key={w.id} on={world === w.id} color={w.color} onClick={() => setWorld(w.id)}>
            {w.emoji} {w.title}
          </Chip>
        ))}
      </div>

      {tab === "qa" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "very-common", "common", "occasional"] as const).map((f) => (
              <Chip key={f} on={freq === f} onClick={() => setFreq(f)}>
                {f === "all" ? "Any frequency" : f === "very-common" ? "🔥 Very common" : f === "common" ? "Common" : "Occasional"}
              </Chip>
            ))}
          </div>
          <div className="text-sm text-faint">{filteredQa.length} questions</div>
          <div className="space-y-2.5">
            {filteredQa.slice(0, limit).map((x, i) => (
              <QAItem key={`${x.href}-${i}`} qa={x} context={`${worldOf(x.worldId)?.emoji ?? ""} ${x.lesson}`} />
            ))}
          </div>
          {filteredQa.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full rounded-xl border border-line-2 py-3 text-sm text-dim hover:text-ink">
              Show more ({filteredQa.length - limit} left)
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(["all", "Easy", "Medium", "Hard"] as const).map((d) => (
              <Chip key={d} on={diff === d} onClick={() => setDiff(d)}>
                {d === "all" ? "Any difficulty" : d}
              </Chip>
            ))}
          </div>
          <div className="text-sm text-faint">{filteredProblems.length} problems</div>
          <div className="panel divide-y divide-line overflow-hidden">
            {filteredProblems.slice(0, limit * 2).map((p) => (
              <div key={p.title} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={clsx("w-16 text-xs font-semibold", p.difficulty === "Easy" ? "text-emerald" : p.difficulty === "Medium" ? "text-amber" : "text-rose")}>{p.difficulty}</span>
                <div className="min-w-0 flex-1">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-ink hover:text-cyan">
                      {p.title} <ExternalLink size={12} className="text-faint" />
                    </a>
                  ) : (
                    <span className="text-ink">{p.title}</span>
                  )}
                  {p.note && <span className="ml-2 text-xs text-faint">{p.note}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.topics.map((t) => (
                    <Link key={t} href={p.href} className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-dim hover:text-ink">
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("rounded-full border px-3 py-1.5 text-xs transition", on ? "text-ink" : "border-line-2 text-dim hover:text-ink")}
      style={on ? { borderColor: color ?? "#0891b2", background: `${color ?? "#0891b2"}1f` } : undefined}
    >
      {children}
    </button>
  );
}
