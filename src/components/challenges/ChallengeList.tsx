"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Check, Clock, Search } from "lucide-react";
import type { Challenge, Track } from "@/content/challenges/types";
import { usePracticed } from "./practiced";

export type ChallengeCard = Pick<Challenge, "slug" | "title" | "track" | "difficulty" | "frequency" | "format" | "time" | "summary"> & { stacks: string[] };

const DIFF_CLS = { Easy: "text-emerald", Medium: "text-amber", Hard: "text-rose" };
const TRACK_CLS: Record<Track, string> = { backend: "#7c3aed", frontend: "#0891b2", language: "#ea580c" };
const FREQ_RANK = { "Very common": 0, Common: 1, Occasional: 2 };

export function ChallengeList({ challenges, tracks, stacks }: { challenges: ChallengeCard[]; tracks: Record<Track, { label: string; blurb: string }>; stacks: readonly string[] }) {
  const practiced = usePracticed();
  const [track, setTrack] = useState<Track | "all">("all");
  const [stack, setStack] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return challenges
      .filter((c) => (track === "all" || c.track === track) && (!stack || c.stacks.includes(stack)) && (!q || `${c.title} ${c.summary}`.toLowerCase().includes(q)))
      .sort((a, b) => FREQ_RANK[a.frequency] - FREQ_RANK[b.frequency]);
  }, [challenges, track, stack, query]);
  const done = challenges.filter((c) => practiced.includes(c.slug)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "backend", "frontend", "language"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            aria-pressed={track === t}
            className={clsx("rounded-xl border px-3.5 py-2 text-sm font-semibold transition", track === t ? "border-ink bg-ink text-white" : "border-line-2 bg-panel text-dim hover:text-ink")}
          >
            {t === "all" ? "All" : tracks[t].label}
            <span className="ml-1.5 text-xs opacity-70">{t === "all" ? challenges.length : challenges.filter((c) => c.track === t).length}</span>
          </button>
        ))}
        <span className="ml-auto text-sm text-dim">
          <span className="font-semibold text-emerald">{done}</span> / {challenges.length} practiced
        </span>
      </div>
      {track !== "all" && <p className="mt-3 text-sm text-dim">{tracks[track].blurb}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search challenges"
            aria-label="Search challenges"
            className="h-10 w-full rounded-xl border border-line-2 bg-panel pr-3 pl-9 text-sm text-ink outline-none focus:border-cyan"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by language or framework">
          {stacks.map((s) => (
            <button
              key={s}
              onClick={() => setStack(stack === s ? null : s)}
              aria-pressed={stack === s}
              className={clsx("rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition", stack === s ? "border-cyan bg-cyan/10 text-cyan" : "border-line-2 bg-panel text-dim hover:text-ink")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visible.map((c) => {
          const isDone = practiced.includes(c.slug);
          return (
            <Link
              key={c.slug}
              href={`/challenges/${c.slug}`}
              className="group panel flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-cyan/40"
              style={{ borderLeft: `3px solid ${TRACK_CLS[c.track]}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-ink group-hover:text-cyan">{c.title}</h3>
                {isDone && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald text-white" title="Practiced">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-dim">{c.summary}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs">
                <span className={clsx("font-semibold", DIFF_CLS[c.difficulty])}>{c.difficulty}</span>
                <span className="text-faint">{c.frequency}</span>
                <span className="inline-flex items-center gap-1 text-faint">
                  <Clock size={11} /> {c.time}
                </span>
                <span className="text-faint">{c.format}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.stacks.map((s) => (
                  <span key={s} className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono text-[11px] text-dim">
                    {s}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
      {visible.length === 0 && <p className="mt-8 text-center text-sm text-dim">No challenges match these filters.</p>}
    </div>
  );
}
