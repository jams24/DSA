"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Eye, EyeOff, Flag, Lightbulb, MessageSquareWarning, Pause, Play, SkipForward, Trash2, X } from "lucide-react";
import { NUDGES, PHASES, RUBRIC, SIGNALS, type MockKind } from "@/content/interview";
import { createLocalStore } from "./localStore";
import { clock, useStopwatch } from "./useStopwatch";

export interface MockProblem {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  hint: string;
  trick: string;
}
export interface MockChallenge {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  summary: string;
  requirements: string[];
}

interface Session {
  id: string;
  at: number;
  kind: MockKind;
  title: string;
  seconds: number;
  hints: number;
  scores: Record<string, number>;
  avg: number;
  notes: string;
}

const isSessions = (v: unknown): v is Session[] => Array.isArray(v) && v.every((s) => s && typeof s === "object" && typeof s.id === "string" && typeof s.avg === "number" && typeof s.kind === "string");
const history = createLocalStore<Session[]>("dsa-quest:mock-history", [], isSessions);

const KINDS: { id: MockKind; label: string; text: string }[] = [
  { id: "coding", label: "Coding (DSA)", text: "A random LeetCode 150 problem, 45 minutes" },
  { id: "practical", label: "Practical build", text: "A random coding challenge, 60 minutes" },
  { id: "behavioral", label: "Behavioral", text: "Three questions, 15 minutes" },
];

const signalFor = (avg: number) => [...SIGNALS].reverse().find((s) => avg >= s.min)!;
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

type Stage = { name: "setup" } | { name: "live" } | { name: "score"; seconds: number };

export function MockInterview({ problems, challenges, questions }: { problems: MockProblem[]; challenges: MockChallenge[]; questions: string[] }) {
  const sessions = history.use();
  const [kind, setKind] = useState<MockKind>("coding");
  const [difficulty, setDifficulty] = useState<"Any" | "Easy" | "Medium" | "Hard">("Medium");
  const [nudgesOn, setNudgesOn] = useState(true);
  const [stage, setStage] = useState<Stage>({ name: "setup" });

  // the drawn round
  const [problem, setProblem] = useState<MockProblem | null>(null);
  const [challenge, setChallenge] = useState<MockChallenge | null>(null);
  const [asked, setAsked] = useState<string[]>([]);

  const [phase, setPhase] = useState(0);
  const [phaseStart, setPhaseStart] = useState(0);
  const [hints, setHints] = useState(0);
  const [nudgeAt, setNudgeAt] = useState<number[]>([]);
  const [nudge, setNudge] = useState<string | null>(null);
  const [interviewerView, setInterviewerView] = useState(false);
  const [scratch, setScratch] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const sw = useStopwatch();

  const phases = PHASES[kind];
  const totalMin = phases.reduce((n, p) => n + p.minutes, 0);
  const budgetEnd = phases.slice(0, phase + 1).reduce((n, p) => n + p.minutes * 60, 0);
  const inPhase = sw.elapsed - phaseStart;
  const remaining = totalMin * 60 - sw.elapsed;

  // Interviewer interruptions: fire when the clock passes each scheduled moment.
  const due = nudgesOn && stage.name === "live" && nudgeAt.length > 0 && sw.elapsed >= nudgeAt[0];
  useEffect(() => {
    if (!due) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the clock crossing a scheduled time
    setNudge(pick(NUDGES[kind]));
    setNudgeAt((n) => n.slice(1));
  }, [due, kind]);

  const start = () => {
    if (kind === "coding") {
      const pool = problems.filter((p) => difficulty === "Any" || p.difficulty === difficulty);
      setProblem(pick(pool.length ? pool : problems));
    } else if (kind === "practical") {
      const pool = challenges.filter((c) => difficulty === "Any" || c.difficulty === difficulty);
      setChallenge(pick(pool.length ? pool : challenges));
    } else setAsked(shuffle(questions).slice(0, 3));
    // a nudge roughly every 4–7 minutes, not in the first 3
    const times: number[] = [];
    for (let t = 180 + Math.random() * 120; t < totalMin * 60 - 60; t += 240 + Math.random() * 180) times.push(Math.round(t));
    setNudgeAt(times);
    setNudge(null);
    setPhase(0);
    setPhaseStart(0);
    setHints(0);
    setScratch("");
    setScores({});
    setNotes("");
    setInterviewerView(false);
    sw.reset();
    setStage({ name: "live" });
    sw.start();
  };

  const finish = () => {
    sw.pause();
    setStage({ name: "score", seconds: sw.elapsed });
  };

  const title = kind === "coding" ? problem?.title : kind === "practical" ? challenge?.title : "Behavioral round";
  const rubric = RUBRIC[kind];
  const avg = rubric.every((d) => scores[d.key]) ? rubric.reduce((n, d) => n + scores[d.key], 0) / rubric.length : null;

  const save = () => {
    if (avg === null || stage.name !== "score") return;
    history.set((prev) => [{ id: crypto.randomUUID(), at: Date.now(), kind, title: title ?? "", seconds: stage.seconds, hints, scores, avg, notes: notes.trim() }, ...prev].slice(0, 100));
    setStage({ name: "setup" });
  };

  const trend = useMemo(() => sessions.slice(0, 10).reverse(), [sessions]);

  if (stage.name === "setup")
    return (
      <div className="space-y-6">
        <div className="panel p-4 sm:p-5">
          <div className="text-xs font-semibold tracking-wide text-faint uppercase">Round type</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={clsx("rounded-xl border-2 p-3 text-left transition", kind === k.id ? "border-cyan bg-cyan/5" : "border-line-2 hover:border-cyan/40")}
              >
                <div className="font-semibold text-ink">{k.label}</div>
                <div className="mt-0.5 text-xs text-dim">{k.text}</div>
              </button>
            ))}
          </div>

          {kind !== "behavioral" && (
            <>
              <div className="mt-4 text-xs font-semibold tracking-wide text-faint uppercase">Difficulty</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["Easy", "Medium", "Hard", "Any"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={clsx("rounded-lg border px-3 py-1.5 text-sm font-semibold", difficulty === d ? "border-ink bg-ink text-white" : "border-line-2 text-dim hover:text-ink")}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-dim">
            <input type="checkbox" checked={nudgesOn} onChange={(e) => setNudgesOn(e.target.checked)} className="mt-0.5 accent-cyan-600" />
            <span>
              <span className="font-semibold text-ink">Interviewer interruptions.</span> Every few minutes a question pops up, like a real interviewer asking about complexity or edge cases mid-flow. Answer it out loud before you
              dismiss it.
            </span>
          </label>

          <button type="button" onClick={start} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan px-5 font-semibold text-white hover:brightness-110">
            <Play size={17} /> Start {totalMin}-minute mock
          </button>
          <p className="mt-2 text-xs text-faint">Practicing with a friend? Start the round, then switch on the interviewer view on their screen (or yours, turned away).</p>
        </div>

        {sessions.length > 0 && (
          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-ink">Your mock history</h3>
              <button type="button" onClick={() => history.set([])} className="inline-flex items-center gap-1 text-xs text-faint hover:text-rose">
                <Trash2 size={13} /> Clear
              </button>
            </div>
            <div className="mt-3 flex h-20 items-end gap-1.5" aria-label="Average score of your last 10 mocks">
              {trend.map((s) => (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-1" title={`${s.title}: ${s.avg.toFixed(1)}/4`}>
                  <div className={clsx("w-full rounded-t", s.avg >= 3.25 ? "bg-emerald" : s.avg >= 2.5 ? "bg-amber" : "bg-rose/70")} style={{ height: `${(s.avg / 4) * 64}px` }} />
                </div>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {sessions.slice(0, 8).map((s) => {
                const sig = signalFor(s.avg);
                return (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">{s.title}</span> <span className="text-xs text-faint">· {new Date(s.at).toLocaleDateString()} · {clock(s.seconds)} · {s.hints} hint{s.hints === 1 ? "" : "s"}</span>
                      {s.notes && <span className="block text-xs text-dim">Improve: {s.notes}</span>}
                    </span>
                    <span className={clsx("font-semibold", sig.cls)}>
                      {s.avg.toFixed(1)} · {sig.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );

  if (stage.name === "score") {
    const reveal = kind === "coding" && problem ? `/leetcode-150/${problem.slug}` : kind === "practical" && challenge ? `/challenges/${challenge.slug}` : "/interview/behavioral";
    return (
      <div className="panel p-4 sm:p-5">
        <h3 className="font-display text-xl font-semibold text-ink">Score yourself like an interviewer would</h3>
        <p className="mt-1 text-sm text-dim">
          {title} · {clock(stage.seconds)} of {totalMin}:00 · {hints} hint{hints === 1 ? "" : "s"} used. Be honest: a generous score here only hides what to fix. If a partner watched, let them score.
        </p>
        <div className="mt-4 space-y-4">
          {rubric.map((d) => (
            <fieldset key={d.key}>
              <legend className="font-semibold text-ink">{d.label}</legend>
              <div className="mt-1.5 grid gap-1.5 sm:grid-cols-4">
                {d.anchors.map((a, i) => (
                  <label
                    key={a}
                    className={clsx("cursor-pointer rounded-lg border p-2 text-xs transition", scores[d.key] === i + 1 ? "border-cyan bg-cyan/10 text-ink" : "border-line-2 text-dim hover:border-cyan/40")}
                  >
                    <input type="radio" name={d.key} className="sr-only" checked={scores[d.key] === i + 1} onChange={() => setScores((s) => ({ ...s, [d.key]: i + 1 }))} />
                    <span className="font-mono font-bold">{i + 1}</span> {a}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {avg !== null && (
          <p className="mt-4 text-sm">
            Average <span className="font-mono font-bold">{avg.toFixed(2)}</span> / 4 → <span className={clsx("font-semibold", signalFor(avg).cls)}>{signalFor(avg).label}</span>. Big-tech loops usually need mostly 3s and 4s across every round.
          </p>
        )}
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">One thing to do better next time</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. state complexity before coding; test the empty input" className="mt-1.5 h-10 w-full rounded-xl border border-line-2 bg-panel px-3 text-sm text-ink outline-none focus:border-cyan" />
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={avg === null} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            Save to history
          </button>
          <Link href={reveal} className="inline-flex h-10 items-center rounded-xl border border-line-2 bg-panel px-4 text-sm font-semibold text-ink hover:border-cyan/50">
            {kind === "behavioral" ? "Work on your stories" : "Review the solution"}
          </Link>
          <button type="button" onClick={() => setStage({ name: "setup" })} className="inline-flex h-10 items-center rounded-xl px-3 text-sm text-dim hover:text-ink">
            Discard
          </button>
        </div>
      </div>
    );
  }

  const cur = phases[phase];
  return (
    <div className="space-y-4">
      <div className="panel sticky top-[72px] z-20 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className={clsx("font-mono text-3xl font-bold tabular-nums", remaining < 0 ? "text-rose" : remaining < 300 ? "text-amber" : "text-ink")} aria-live="off">
            {clock(remaining)}
          </span>
          <span className="text-xs text-faint">{remaining < 0 ? "over time" : "left"}</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button type="button" onClick={sw.running ? sw.pause : sw.start} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 text-sm font-semibold text-ink">
              {sw.running ? <Pause size={15} /> : <Play size={15} />} {sw.running ? "Pause" : "Resume"}
            </button>
            {kind !== "behavioral" && (
              <button
                type="button"
                onClick={() => setHints((h) => h + 1)}
                disabled={hints >= 2}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber/50 bg-amber/10 px-3 text-sm font-semibold text-amber disabled:opacity-50"
              >
                <Lightbulb size={15} /> Hint ({2 - hints} left)
              </button>
            )}
            <button type="button" onClick={finish} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
              <Flag size={15} /> End &amp; score
            </button>
          </div>
        </div>
        <ol className="mt-3 flex gap-1" aria-label="Phases">
          {phases.map((p, i) => (
            <li key={p.name} className="min-w-0 basis-0" style={{ flexGrow: p.minutes }}>
              <div className={clsx("h-1.5 rounded-full", i < phase ? "bg-emerald" : i === phase ? "bg-cyan" : "bg-line")} />
              <div className={clsx("mt-1 truncate text-[11px]", i === phase ? "font-semibold text-ink" : "text-faint")}>
                {p.name} · {p.minutes}m
              </div>
            </li>
          ))}
        </ol>
      </div>

      {nudge && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-violet/50 bg-violet/[0.06] p-4">
          <MessageSquareWarning size={20} className="mt-0.5 shrink-0 text-violet" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold tracking-wide text-violet uppercase">Interviewer</div>
            <p className="mt-0.5 font-semibold text-ink">“{nudge}”</p>
            <p className="mt-0.5 text-xs text-dim">Answer out loud, then carry on where you were.</p>
          </div>
          <button type="button" onClick={() => setNudge(null)} className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:text-ink" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-cyan/30 bg-cyan/[0.05] p-4 sm:p-5">
            {kind === "coding" && problem && (
              <>
                <div className="text-xs font-semibold text-cyan">
                  {problem.difficulty} · {problem.category}
                </div>
                <h3 className="mt-1 font-display text-2xl font-bold text-ink">{problem.title}</h3>
                <a href={`https://leetcode.com/problems/${problem.slug}/`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-cyan hover:underline">
                  Open the problem statement on LeetCode ↗
                </a>
                <p className="mt-1 text-xs text-dim">Solve it in the editor there or below, without running the code until the Test phase.</p>
              </>
            )}
            {kind === "practical" && challenge && (
              <>
                <div className="text-xs font-semibold text-cyan">{challenge.difficulty} · practical build</div>
                <h3 className="mt-1 font-display text-2xl font-bold text-ink">{challenge.title}</h3>
                <p className="mt-1 text-sm text-dim">{challenge.summary}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-dim">
                  {challenge.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
            {kind === "behavioral" && (
              <>
                <div className="text-xs font-semibold text-cyan">Question {Math.min(phase + 1, 3)} of 3</div>
                <h3 className="mt-1 font-display text-2xl font-bold text-ink">“{asked[Math.min(phase, asked.length - 1)]}”</h3>
              </>
            )}
            {hints > 0 && problem && (
              <div className="mt-3 space-y-1 rounded-xl border border-amber/40 bg-amber/[0.07] p-3 text-sm">
                <p>
                  <span className="font-semibold text-amber">Hint:</span> {problem.hint}
                </p>
                {hints > 1 && (
                  <p>
                    <span className="font-semibold text-amber">Key trick:</span> {problem.trick}
                  </p>
                )}
              </div>
            )}
            {hints > 0 && challenge && (
              <p className="mt-3 rounded-xl border border-amber/40 bg-amber/[0.07] p-3 text-sm">
                <span className="font-semibold text-amber">Hint:</span> {hints > 1 ? "Open the challenge page's Approach section." : "Get the main flow working end to end before any validation or polish."}
              </p>
            )}
          </section>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-faint uppercase">Scratchpad (not saved, like a shared doc)</span>
            <textarea
              value={scratch}
              onChange={(e) => setScratch(e.target.value)}
              spellCheck={false}
              rows={14}
              placeholder={kind === "behavioral" ? "Jot your STAR bullet points…" : "Examples, approach, then code. No autocomplete, just like many real interviews."}
              className="mt-1.5 w-full rounded-xl border border-line-2 bg-panel p-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-cyan"
            />
          </label>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-display font-semibold text-ink">{cur.name}</h4>
              <span className={clsx("font-mono text-sm", sw.elapsed > budgetEnd ? "text-rose" : "text-dim")}>
                {clock(inPhase)} / {cur.minutes}:00
              </span>
            </div>
            <p className="mt-1 text-sm text-dim">{cur.goal}</p>
            <ul className="mt-2 space-y-1.5">
              {cur.checklist.map((c) => (
                <li key={c} className="flex gap-2 text-sm text-ink">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                  {c}
                </li>
              ))}
            </ul>
            {sw.elapsed > budgetEnd && <p className="mt-2 text-xs font-semibold text-rose">Over this phase&apos;s budget. Wrap up and move on.</p>}
            {phase < phases.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setPhase((p) => p + 1);
                  setPhaseStart(sw.elapsed);
                }}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-2 bg-panel px-3 text-sm font-semibold text-ink hover:border-cyan/50"
              >
                <SkipForward size={15} /> Next: {phases[phase + 1].name}
              </button>
            ) : (
              <button type="button" onClick={finish} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
                <Flag size={15} /> Finish
              </button>
            )}
          </div>

          <div className="panel p-4">
            <button type="button" onClick={() => setInterviewerView((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-dim hover:text-ink">
              {interviewerView ? <EyeOff size={15} /> : <Eye size={15} />} {interviewerView ? "Hide" : "Show"} interviewer view
            </button>
            {interviewerView ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-xs text-rose">For the person playing the interviewer. The candidate shouldn&apos;t look.</p>
                {problem && (
                  <div>
                    <div className="font-semibold text-ink">Expected solution</div>
                    <p className="text-dim">{problem.trick}</p>
                    <p className="mt-1 text-xs text-faint">Give the hint only after about 10 minutes of being stuck, and the trick only if still stuck.</p>
                  </div>
                )}
                {challenge && (
                  <p className="text-dim">
                    Reference approach and solutions:{" "}
                    <Link href={`/challenges/${challenge.slug}`} target="_blank" className="font-semibold text-cyan hover:underline">
                      challenge page ↗
                    </Link>
                  </p>
                )}
                <div>
                  <div className="font-semibold text-ink">Ask during the round</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-dim">
                    {NUDGES[kind].slice(0, 5).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-ink">Score on</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-dim">
                    {rubric.map((d) => (
                      <li key={d.key}>
                        {d.label}: strong = {d.anchors[3].toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-faint">Practicing with someone? They open this to see the expected answer, the follow-up questions to ask and how to score you.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
