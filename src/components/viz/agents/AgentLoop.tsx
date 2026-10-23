"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Stat, StepControls, useStepper } from "../kit";

type Kind = "setup" | "user" | "tool_use" | "tool_result" | "permission" | "hook" | "subagent" | "compaction" | "answer";
type Seg = "system" | "tools" | "memory" | "messages" | "results";

interface Ev {
  kind: Kind;
  title: string;
  body: string;
  harness: string;
  add?: Partial<Record<Seg, number>>;
  set?: Partial<Record<Seg, number>>;
  out?: number; // a model call that produced this many output tokens
}

const WINDOW = 16_000;
const COMPACT_AT = 0.75;
const PRICE = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }; // $ per million tokens

const SEGS: { id: Seg; label: string; color: string }[] = [
  { id: "system", label: "system prompt", color: "#64748b" },
  { id: "tools", label: "tool schemas", color: C.compare },
  { id: "memory", label: "memory file", color: C.lime },
  { id: "messages", label: "messages & tool calls", color: C.pivot },
  { id: "results", label: "tool results", color: C.done },
];

const KIND: Record<Kind, { label: string; color: string }> = {
  setup: { label: "harness", color: "#64748b" },
  user: { label: "user", color: C.sky },
  tool_use: { label: "model → tool_use", color: C.compare },
  tool_result: { label: "tool_result", color: C.done },
  permission: { label: "permission", color: C.bad },
  hook: { label: "hook", color: C.orange },
  subagent: { label: "subagent", color: C.swap },
  compaction: { label: "compaction", color: C.active },
  answer: { label: "model → answer", color: C.text },
};

const SCRIPT: Ev[] = [
  {
    kind: "setup",
    title: "Harness assembles the first request",
    body: "system prompt: role, rules, environment (cwd, OS, git status)\ntools: Read · Edit · Bash · Grep · Task (JSON schemas)\nCLAUDE.md:\n  - run tests with pytest\n  - run `make lint` before finishing\n  - never edit migrations/",
    harness: "Before the model sees anything, the harness builds the context: its own system prompt, the tool definitions (built-in plus any MCP servers), project memory files and permission rules from settings.",
    add: { system: 2100, tools: 3400, memory: 600 },
  },
  {
    kind: "user",
    title: "“tests/test_dates.py fails since yesterday. Fix it.”",
    body: "user: tests/test_dates.py::test_add_days fails since yesterday. Fix it.",
    harness: "The user message is appended and the whole context is sent. Every model call re-sends everything above as input tokens, which is why prompt caching matters so much for agents.",
    add: { messages: 40 },
  },
  {
    kind: "tool_use",
    title: "Bash: reproduce the failure",
    body: 'thinking: reproduce the failure before touching code.\ntool_use Bash {"command": "pytest tests/test_dates.py -x -q"}',
    harness: "The model can't run anything. It only emits a structured request. The harness validates it against the Bash schema, finds the allow rule Bash(pytest:*) and runs it in the sandbox (repo-only writes, no network) without asking.",
    add: { messages: 120 },
    out: 120,
  },
  {
    kind: "tool_result",
    title: "1 failed",
    body: "F tests/test_dates.py::test_add_days\n  assert add_days(date(2026, 2, 28), 1) == date(2026, 3, 1)\n  src/dates.py:46: in add_days\nE ValueError: day is out of range for month\n1 failed in 0.21s   (exit code 1)",
    harness: "Stdout, stderr and the exit code go back to the model as a tool_result. A failing command is information, not a crash. The loop continues.",
    add: { results: 900 },
  },
  {
    kind: "tool_use",
    title: "Grep for the function",
    body: 'tool_use Grep {"pattern": "def add_days", "path": "src"}',
    harness: "Read-only tools are auto-approved. Agentic search (grep, glob, read) is how most coding agents find code. There's no vector index to go stale.",
    add: { messages: 60 },
    out: 60,
  },
  { kind: "tool_result", title: "src/dates.py:41", body: "src/dates.py:41:def add_days(d, n):", harness: "Small, precise results keep the context clean.", add: { results: 40 } },
  {
    kind: "tool_use",
    title: "Read the file (paged)",
    body: 'tool_use Read {"file_path": "src/dates.py", "offset": 30, "limit": 40}',
    harness: "Large files are read in pages (offset/limit) so a single read can't flood the window.",
    add: { messages: 70 },
    out: 70,
  },
  {
    kind: "tool_result",
    title: "the bug: February is always 29 days",
    body: "41 def add_days(d, n):\n42     day = d.day + n\n43     days_in_month = 29 if d.month == 2 else MONTH_DAYS[d.month]\n44     if day > days_in_month:\n45         return d.replace(month=d.month + 1, day=day - days_in_month)\n46     return d.replace(day=day)",
    harness: "File contents are usually the biggest consumer of context in coding sessions.",
    add: { results: 1600 },
  },
  {
    kind: "subagent",
    title: "Delegate: who else calls add_days?",
    body: 'thinking: changing month lengths may affect callers. Delegate the search.\ntool_use Task {"agent": "explore", "prompt": "find callers of add_days and MONTH_DAYS; report expectations"}',
    harness: "A subagent gets a fresh context window and a read-only tool set. It can burn 14k tokens exploring, and only its short final report returns to the main context. That's context isolation.",
    add: { messages: 150 },
    out: 150,
  },
  {
    kind: "tool_result",
    title: "Subagent report (14.2k explored → 310 returned)",
    body: "add_days is called from billing/cycle.py and reports/monthly.py; both expect calendar-correct dates.\nMONTH_DAYS is only used in src/dates.py.",
    harness: "The summary is all the main agent needs to decide. The raw search output never touches its window.",
    add: { results: 310 },
  },
  {
    kind: "tool_use",
    title: "Edit src/dates.py",
    body: "tool_use Edit src/dates.py\n- days_in_month = 29 if d.month == 2 else MONTH_DAYS[d.month]\n+ days_in_month = calendar.monthrange(d.year, d.month)[1]",
    harness: "Edits modify the user's files, so the harness asks first. A PreToolUse hook checks the path against protected globs (migrations/**): allowed.",
    add: { messages: 140 },
    out: 140,
  },
  {
    kind: "permission",
    title: "Allow Edit to src/dates.py?",
    body: "[ Yes ]   [ Yes, and don't ask again for this session ]   [ No, tell the agent what to do instead ]\n→ user picked Yes",
    harness: "Permission modes trade speed for control: ask every time, auto-accept edits, plan-only (no writes), or fully autonomous inside a sandbox. A checkpoint of the file is saved so the edit can be rewound.",
  },
  {
    kind: "hook",
    title: "Edited (+2 −1) · PostToolUse hook ran",
    body: "Edited src/dates.py (+2 −1)\nPostToolUse hook: ruff format src/dates.py → 1 file reformatted",
    harness: "Hooks are deterministic scripts the harness runs at lifecycle events (before or after tool calls, on stop). They enforce things you never want left to the model's judgment, and their output is fed back to it.",
    add: { results: 80 },
  },
  { kind: "tool_use", title: "Bash: full test suite", body: 'tool_use Bash {"command": "pytest -q"}', harness: "Allowed by the same pytest rule.", add: { messages: 50 }, out: 50 },
  {
    kind: "tool_result",
    title: "412 passed (output truncated)",
    body: "............................................ [ 98%]\n.......                                      [100%]\n412 passed, 3 warnings in 38.2s\n(output was 11.8k tokens → kept head + tail = 2.0k)",
    harness: "Tool output is capped. Without truncation, one noisy test run would eat most of this window.",
    add: { results: 2000 },
  },
  {
    kind: "tool_use",
    title: "Bash: make lint (from CLAUDE.md)",
    body: 'tool_use Bash {"command": "make lint"}',
    harness: "The model follows the project memory file loaded at the start. Memory files are how teams teach an agent their conventions once instead of every session.",
    add: { messages: 40 },
    out: 40,
  },
  {
    kind: "tool_result",
    title: "lint + types clean",
    body: "ruff check .  → All checks passed!\nmypy src      → Success: no issues found in 58 source files",
    harness: "The context is now past the compaction threshold.",
    add: { results: 1300 },
  },
  {
    kind: "compaction",
    title: "Auto-compaction at 81% of the window",
    body: "older turns → 600-token summary:\n  goal · root cause (Feb hard-coded to 29 days) · fix in src/dates.py\n  · callers checked · tests 412 passed · lint clean · remaining: report\nstale tool results cleared; last turn kept verbatim",
    harness: "Context rot is real: models get worse as the window fills with stale logs. The harness summarizes old turns (decisions, file paths, open TODOs) and clears raw tool output, freeing room to keep working. The cached prefix changes, so the next call pays a cache write.",
    set: { messages: 300, results: 900 },
  },
  {
    kind: "answer",
    title: "Final answer · stop_reason: end_turn",
    body: "Fixed add_days: February no longer assumes 29 days; it uses calendar.monthrange, so leap years are correct.\nFull suite: 412 passed. Lint and mypy clean. Callers in billing/cycle.py and reports/monthly.py now receive valid dates.",
    harness: "No tool calls in the response → the loop ends and control returns to the user. The transcript, tool trace, token usage and cost are logged for observability and evals.",
    add: { messages: 90 },
    out: 90,
  },
];

interface Frame {
  segs: Record<Seg, number>;
  calls: number;
  cost: number;
  costNoCache: number;
}

function simulate(): Frame[] {
  const segs: Record<Seg, number> = { system: 0, tools: 0, memory: 0, messages: 0, results: 0 };
  let calls = 0;
  let cost = 0;
  let costNoCache = 0;
  let cachedPrefix = 0;
  const total = () => Object.values(segs).reduce((a, b) => a + b, 0);
  return SCRIPT.map((ev) => {
    if (ev.out) {
      // the call sees everything before its own output
      const input = total();
      calls++;
      costNoCache += (input * PRICE.input + ev.out * PRICE.output) / 1e6;
      const write = Math.max(0, input - cachedPrefix);
      cost += (cachedPrefix * PRICE.cacheRead + write * PRICE.cacheWrite + ev.out * PRICE.output) / 1e6;
      cachedPrefix = input;
    }
    if (ev.set) {
      Object.assign(segs, ev.set);
      cachedPrefix = 0;
    }
    for (const [k, v] of Object.entries(ev.add ?? {})) segs[k as Seg] += v;
    return { segs: { ...segs }, calls, cost, costNoCache };
  });
}

export default function AgentLoop() {
  const frames = useMemo(() => simulate(), []);
  const s = useStepper(frames, 1500);
  const [open, setOpen] = useState<number | null>(null);
  const f = s.frame;
  const used = Object.values(f.segs).reduce((a, b) => a + b, 0);
  const ev = SCRIPT[s.i];
  const shown = SCRIPT.slice(0, s.i + 1)
    .map((e, i) => ({ e, i }))
    .reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="model calls" value={f.calls} color={C.pivot} />
        <Stat label="context used" value={`${(used / 1000).toFixed(1)}k / ${WINDOW / 1000}k`} color={used / WINDOW > COMPACT_AT ? C.bad : C.text} />
        <Stat label="cost (prompt caching)" value={`$${f.cost.toFixed(3)}`} color={C.done} />
        <Stat label="cost without caching" value={`$${f.costNoCache.toFixed(3)}`} color={C.compare} />
      </div>

      <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
        <div className="mb-1.5 flex justify-between text-[11px] text-faint">
          <span>context window (demo size: real windows are 200k–1M tokens, and long sessions fill them the same way)</span>
        </div>
        <div className="relative flex h-5 overflow-hidden rounded-md bg-line">
          {SEGS.map((sg) => (
            <div key={sg.id} className="h-full transition-all duration-500" style={{ width: `${(f.segs[sg.id] / WINDOW) * 100}%`, background: sg.color }} title={`${sg.label}: ${f.segs[sg.id]} tokens`} />
          ))}
          <div className="absolute top-0 h-full border-l-2 border-dashed border-rose" style={{ left: `${COMPACT_AT * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-dim">
          {SEGS.map((sg) => (
            <span key={sg.id} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: sg.color }} />
              {sg.label} {(f.segs[sg.id] / 1000).toFixed(1)}k
            </span>
          ))}
          <span className="text-rose">┆ auto-compact at {COMPACT_AT * 100}%</span>
        </div>
      </div>

      <div className="max-h-[360px] space-y-1.5 overflow-auto rounded-xl border border-line bg-panel p-2">
        {shown.map(({ e, i }) => {
          const k = KIND[e.kind];
          const expanded = i === s.i || open === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className={clsx("block w-full rounded-lg border px-3 py-2 text-left transition", i === s.i ? "border-cyan/50 bg-cyan/[0.05]" : "border-line hover:border-line-2")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold" style={{ color: k.color, background: `${k.color}17` }}>
                  {k.label}
                </span>
                <span className="text-xs font-medium text-ink">{e.title}</span>
                {e.out ? <span className="ml-auto font-mono text-[10px] text-faint">call #{frames[i].calls}</span> : null}
              </div>
              {expanded && <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-dim">{e.body}</pre>}
            </button>
          );
        })}
      </div>

      <StepControls s={s} />
      <Narration tone={ev.kind === "permission" || ev.kind === "compaction" ? "warn" : ev.kind === "answer" ? "good" : "info"}>
        <span className="font-semibold">Harness: </span>
        {ev.harness}
      </Narration>
    </div>
  );
}
