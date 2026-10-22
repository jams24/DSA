"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { BookOpen, Check, ChevronLeft, ChevronRight, Code2, Eye, MessagesSquare, Swords, Trophy } from "lucide-react";
import type { ArchDiagram, ComplexityRow, Difficulty, PracticeProblem, QuizQuestion } from "@/content/types";
import { useGame, usePlayer } from "@/lib/game/store";
import { DifficultyPill, Pill, Stars } from "@/components/ui";
import { DiagramSlot, VisualizerSlot } from "@/components/viz/VisualizerSlot";
import { useCatalog } from "@/components/game/GameProvider";
import { CodeSamples, type RenderedSample } from "./CodeSamples";
import { InterviewPanel, type RenderedQA } from "./Interview";
import { LessonQuiz } from "./LessonQuiz";

export interface LessonViewProps {
  worldId: string;
  lesson: {
    id: string;
    key: string;
    title: string;
    tagline: string;
    difficulty: Difficulty;
    minutes: number;
    visualizers: string[];
    diagram?: ArchDiagram;
    keyPoints: string[];
    complexity?: ComplexityRow[];
    quiz: QuizQuestion[];
    problems?: PracticeProblem[];
  };
  conceptHtml: string;
  interview: RenderedQA[];
  code: RenderedSample[];
  index: number;
  prev: { href: string; title: string } | null;
  next: { href: string; title: string };
}

type Tab = "learn" | "visualize" | "code" | "interview" | "quiz";

export function LessonView(props: LessonViewProps) {
  const { lesson, worldId, index } = props;
  const catalog = useCatalog();
  const world = catalog.find((w) => w.id === worldId);
  const player = usePlayer();
  const ready = useGame((s) => s.ready);
  const play = useGame((s) => s.play);
  const entry = player.progress[lesson.key];
  const accent = world?.color ?? "#22d3ee";

  const hasViz = lesson.visualizers.length > 0 || !!lesson.diagram;
  const tabs: { id: Tab; label: string; icon: typeof BookOpen; done: boolean }[] = [
    { id: "learn" as Tab, label: "Learn", icon: BookOpen, done: !!entry?.read },
    ...(hasViz ? [{ id: "visualize" as Tab, label: "Visualize", icon: Eye, done: !!entry?.visualized }] : []),
    ...(props.code.length ? [{ id: "code" as Tab, label: "Code", icon: Code2, done: false }] : []),
    { id: "interview" as Tab, label: "Interview", icon: MessagesSquare, done: false },
    { id: "quiz" as Tab, label: "Quiz", icon: Swords, done: (entry?.stars ?? 0) > 0 },
  ];

  const [tab, setTab] = useState<Tab>("learn");
  const [lang, setLang] = useState("python");

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    const t = setTimeout(() => {
      if (tabs.some((x) => x.id === fromHash)) setTab(fromHash);
      try {
        const l = localStorage.getItem("dq-lang");
        if (l) setLang(l);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(t: Tab) {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const sent = useRef<{ read: boolean; visualize: boolean }>({ read: false, visualize: false });
  function mark(kind: "read" | "visualize") {
    if (!ready || sent.current[kind]) return;
    if (kind === "read" ? entry?.read : entry?.visualized) return;
    sent.current[kind] = true;
    void play({ type: kind, lessonKey: lesson.key }, { type: kind, lessonKey: lesson.key });
  }

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== "learn" || !sentinel.current) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && mark("read"), { threshold: 1 });
    io.observe(sentinel.current);
    return () => io.disconnect();
  });

  const tabIdx = tabs.findIndex((t) => t.id === tab);
  const nextTab = tabs[tabIdx + 1];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6" style={{ "--accent": accent } as React.CSSProperties}>
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-faint">
        <Link href="/worlds" className="hover:text-ink">
          Worlds
        </Link>
        <span>/</span>
        <Link href={`/worlds/${worldId}`} className="hover:text-ink">
          {world?.emoji} {world?.title}
        </Link>
        <span>/</span>
        <span className="text-dim">
          Level {index + 1} of {world?.lessons.length}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <header className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md px-2 py-1 font-pixel text-[9px]" style={{ background: `${accent}22`, color: accent }}>
                LV {index + 1}
              </span>
              <DifficultyPill level={lesson.difficulty} />
              <Pill>⏱ {lesson.minutes} min</Pill>
              <Pill>✨ up to 100 XP</Pill>
              {ready && <Stars count={entry?.stars ?? 0} size={16} className="ml-1" />}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{lesson.title}</h1>
            <p className="mt-2 text-lg text-dim">{lesson.tagline}</p>
          </header>

          <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line/70 bg-bg/85 px-4 py-2 backdrop-blur-xl">
            <div className="flex gap-1 overflow-x-auto scrollbar-thin">
              {tabs.map((t, i) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => go(t.id)}
                    className={clsx(
                      "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                      tab === t.id ? "bg-panel-3 text-ink shadow-[inset_0_0_0_1px_var(--accent)]" : "text-dim hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <span
                      className={clsx("grid h-5 w-5 place-items-center rounded-md text-[10px]", t.done ? "bg-emerald text-[#04140d]" : "bg-line-2 text-dim")}
                    >
                      {t.done ? <Check size={12} /> : i + 1}
                    </span>
                    <Icon size={15} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {tab === "learn" && (
            <div className="space-y-8">
              <article className="prose-quest" dangerouslySetInnerHTML={{ __html: props.conceptHtml }} />
              <div className="panel neon-border p-5">
                <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-ink">
                  <Trophy size={16} style={{ color: accent }} /> Remember for the interview
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lesson.keyPoints.map((k) => (
                    <li key={k} className="flex gap-2 text-sm text-[#d5dbf0]">
                      <span style={{ color: accent }}>◆</span>
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
              {lesson.complexity && lesson.complexity.length > 0 && (
                <div className="panel overflow-x-auto p-5">
                  <h3 className="mb-3 font-display font-semibold text-ink">Complexity cheat sheet</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-faint">
                        <th className="pb-2">Operation</th>
                        <th className="pb-2">Time</th>
                        <th className="pb-2">Space</th>
                        <th className="pb-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lesson.complexity.map((r) => (
                        <tr key={r.op} className="border-t border-line">
                          <td className="py-2 pr-4 text-ink">{r.op}</td>
                          <td className="py-2 pr-4 font-mono text-cyan">{r.time}</td>
                          <td className="py-2 pr-4 font-mono text-violet">{r.space ?? "—"}</td>
                          <td className="py-2 text-dim">{r.note ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div ref={sentinel} />
            </div>
          )}

          {tab === "visualize" && (
            <div className="space-y-6">
              {lesson.diagram && <DiagramSlot diagram={lesson.diagram} onInteract={() => mark("visualize")} />}
              {lesson.visualizers.map((id) => (
                <VisualizerSlot key={id} id={id} onInteract={() => mark("visualize")} />
              ))}
            </div>
          )}

          {tab === "code" && <CodeSamples samples={props.code} preferred={lang} onPreferred={(l) => { setLang(l); try { localStorage.setItem("dq-lang", l); } catch {} }} />}

          {tab === "interview" && <InterviewPanel qas={props.interview} problems={lesson.problems} />}

          {tab === "quiz" && (
            <LessonQuiz
              lessonKey={lesson.key}
              quiz={lesson.quiz}
              nextHref={props.next.href}
              nextLabel={props.next.title}
              accent={accent}
            />
          )}

          {tab !== "quiz" && nextTab && (
            <div className="mt-10 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (tab === "learn") mark("read");
                  go(nextTab.id);
                }}
                className="group flex items-center gap-3 rounded-2xl border border-line-2 bg-panel-2 px-5 py-3 text-left transition hover:border-[var(--accent)]"
              >
                <span>
                  <span className="block text-xs text-faint">Next step</span>
                  <span className="font-display font-semibold text-ink">{nextTab.label}</span>
                </span>
                <ChevronRight className="text-dim transition group-hover:translate-x-1" />
              </button>
            </div>
          )}

          <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-line pt-6">
            {props.prev ? (
              <Link href={props.prev.href} className="flex max-w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-dim transition hover:bg-white/5 hover:text-ink">
                <ChevronLeft size={16} className="shrink-0" /> {props.prev.title}
              </Link>
            ) : (
              <span />
            )}
            <Link
              href={props.next.href}
              className="ml-auto flex max-w-full items-center gap-2 rounded-xl border border-line-2 bg-panel-3 px-4 py-2.5 text-sm text-ink shadow-[0_4px_0_0_rgb(0_0_0/0.5)] transition hover:border-faint active:translate-y-[2px]"
            >
              {props.next.title} <ChevronRight size={16} className="shrink-0" />
            </Link>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">{world?.emoji}</span>
                <span className="font-display text-sm font-semibold text-ink">{world?.title}</span>
              </div>
              <ol className="space-y-1">
                {world?.lessons.map((l, i) => {
                  const st = player.progress[l.key]?.stars ?? 0;
                  const current = l.id === lesson.id;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/worlds/${worldId}/${l.id}`}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                          current ? "bg-white/[0.06] text-ink" : "text-dim hover:bg-white/[0.04] hover:text-ink",
                        )}
                      >
                        <span
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold"
                          style={{ background: st > 0 ? accent : "#1e2747", color: st > 0 ? "#06120a" : "#9aa2c4" }}
                        >
                          {st > 0 ? "✓" : i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{l.title}</span>
                        {ready && st > 0 && <Stars count={st} size={9} />}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href={`/worlds/${worldId}/boss`}
                    className="mt-2 flex items-center gap-2 rounded-lg border border-rose/30 bg-rose/[0.06] px-2 py-2 text-sm text-rose hover:bg-rose/10"
                  >
                    <span>{world?.boss.emoji}</span>
                    <span className="flex-1 truncate">Boss: {world?.boss.name}</span>
                  </Link>
                </li>
              </ol>
            </div>
            <div className="panel p-4 text-xs text-dim">
              <div className="mb-2 font-display text-sm font-semibold text-ink">How to earn XP</div>
              <ul className="space-y-1.5">
                <li>📖 Read the lesson · <span className="text-cyan">+10</span></li>
                <li>🔭 Play with a visualizer · <span className="text-cyan">+10</span></li>
                <li>⚔️ Clear the quiz (≥50%) · <span className="text-cyan">+20</span></li>
                <li>⭐ Each star · <span className="text-cyan">+20</span></li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
