"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

// A log-processing pipeline, built twice: with generators (lazy) and with lists (eager).
const LINES = ["INFO", "ERROR", "INFO", "WARN", "ERROR", "INFO", "ERROR", "INFO"];
type Status = "waiting" | "read" | "kept" | "dropped" | "never";
type StageId = "source" | "parse" | "filter" | "take" | "result";
type Mode = "lazy" | "eager";

interface Frame {
  at: StageId | null;
  dir: "pull" | "yield" | null;
  item: string | null;
  status: Status[];
  read: number;
  parsed: number;
  held: number; // values alive in memory across the pipeline
  peak: number;
  sizes: Partial<Record<StageId, number>>; // eager mode: list length per stage
  result: string[];
  note: string;
  tone: "info" | "good" | "bad" | "warn";
}

const label = (i: number) => `L${i + 1}:${LINES[i]}`;

function build(mode: Mode): Frame[] {
  const frames: Frame[] = [];
  const status: Status[] = LINES.map(() => "waiting");
  let read = 0;
  let parsed = 0;
  let held = 0;
  let peak = 0;
  const sizes: Partial<Record<StageId, number>> = {};
  const result: string[] = [];
  const push = (at: StageId | null, dir: Frame["dir"], item: string | null, note: string, tone: Frame["tone"] = "info") => {
    peak = Math.max(peak, held);
    frames.push({ at, dir, item, status: [...status], read, parsed, held, peak, sizes: { ...sizes }, result: [...result], note, tone });
  };

  if (mode === "lazy") {
    push(null, null, null, "Creating the generators runs NOTHING: each line of code just builds a paused generator object. Work starts when list() asks islice for its first value.");
    for (let i = 0; i < LINES.length; i++) {
      push("take", "pull", null, i === 0 ? "list() calls next() on islice, which calls next() on the filter, which calls next() on the parser, which calls next() on read_lines. The request travels UP the pipeline." : "list() wants another value: next() travels up the pipeline again.");
      read++;
      held = 1;
      status[i] = "read";
      push("source", "yield", label(i), `read_lines resumes, reads line ${i + 1} from the file and yields it. Then it pauses again, keeping its place in the file.`);
      parsed++;
      push("parse", "yield", LINES[i], `The parser turns it into a record (level ${LINES[i]}) and yields it downstream. Only this one value is in flight.`);
      if (LINES[i] !== "ERROR") {
        status[i] = "dropped";
        held = 0;
        push("filter", null, LINES[i], `level == "ERROR" is false: the filter drops it and immediately asks the parser for the next record.`);
        continue;
      }
      status[i] = "kept";
      push("filter", "yield", LINES[i], `An ERROR: the filter yields it to islice.`);
      result.push(label(i));
      held = result.length;
      push("take", "yield", label(i), `islice passes it on (${result.length} of 2) and list() stores it.`, "good");
      if (result.length === 2) {
        for (let k = i + 1; k < LINES.length; k++) status[k] = "never";
        held = result.length;
        push("result", null, null, `islice has its 2 items and stops asking. Lines ${i + 2} to ${LINES.length} are NEVER read: ${read} lines read and parsed instead of ${LINES.length}. On a 50 GB file with an error near the top, the program finishes instantly using a few hundred bytes.`, "good");
        break;
      }
    }
  } else {
    push(null, null, null, "With list comprehensions every stage is computed IN FULL, immediately, and kept in memory before the next stage starts.");
    for (let i = 0; i < LINES.length; i++) {
      read++;
      status[i] = "read";
    }
    sizes.source = LINES.length;
    held = LINES.length;
    push("source", null, null, `lines = read_lines(...) as a list: all ${LINES.length} lines are read into memory. (A real log could be millions of lines: gigabytes of RAM before anything else happens.)`, "warn");
    parsed = LINES.length;
    sizes.parse = LINES.length;
    held += LINES.length;
    push("parse", null, null, `records = [parse(l) for l in lines]: ${LINES.length} more objects. The lines list is still alive too, so memory doubles.`, "warn");
    LINES.forEach((lv, i) => (status[i] = lv === "ERROR" ? "kept" : "dropped"));
    const errs = LINES.map((lv, i) => (lv === "ERROR" ? i : -1)).filter((i) => i >= 0);
    sizes.filter = errs.length;
    held += errs.length;
    push("filter", null, null, `errors = [r for r in records if ...]: every record is checked, giving ${errs.length} errors.`, "warn");
    for (const i of errs.slice(0, 2)) result.push(label(i));
    sizes.take = 2;
    push("take", null, null, `errors[:2] finally takes the 2 we wanted. We read and parsed all ${LINES.length} lines and held ${held} objects at the peak, to use 2 of them. That's fine for small data; use generators when data is large, infinite, or you might stop early.`, "bad");
    push("result", null, null, "Same answer, very different cost: lists are eager (all work up front, O(n) memory, reusable), generators are lazy (work on demand, O(1) memory, single pass).", "info");
  }
  return frames;
}

const STAGES: { id: StageId; lazy: string; eager: string }[] = [
  { id: "source", lazy: "lines = read_lines(path)", eager: "lines = list(read_lines(path))" },
  { id: "parse", lazy: "records = (parse(l) for l in lines)", eager: "records = [parse(l) for l in lines]" },
  { id: "filter", lazy: "errors = (r for r in records if r.level == 'ERROR')", eager: "errors = [r for r in records if r.level == 'ERROR']" },
  { id: "take", lazy: "first = islice(errors, 2)", eager: "first = errors[:2]" },
  { id: "result", lazy: "print(list(first))", eager: "print(first)" },
];

export default function PyGenerators() {
  const [mode, setMode] = useState<Mode>("lazy");
  const frames = useMemo(() => build(mode), [mode]);
  const s = useStepper(frames, 1200);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "lazy", label: "Generators (lazy)" },
          { value: "eager", label: "Lists (eager)" },
        ]}
      />

      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">access.log</div>
        <div className="flex flex-wrap gap-1.5">
          {LINES.map((lv, i) => {
            const st = f.status[i];
            const col = st === "kept" ? C.done : st === "dropped" ? C.bad : st === "read" ? C.compare : st === "never" ? C.base : C.active;
            return (
              <div
                key={i}
                className={clsx("rounded-lg border-2 px-2 py-1 text-center font-mono text-[11px] font-semibold transition", st === "never" && "opacity-40")}
                style={{ borderColor: col, background: `${col}14`, color: st === "never" ? C.faint : C.text }}
              >
                <div className="text-[9px] text-dim">line {i + 1}</div>
                {lv}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-dim">
          <span style={{ color: C.done }}>■ an ERROR we keep</span>
          <span style={{ color: C.bad }}>■ filtered out</span>
          <span style={{ color: C.compare }}>■ read, in flight</span>
          <span style={{ color: C.faint }}>■ never read</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {STAGES.map((st) => {
          const on = f.at === st.id;
          const size = f.sizes[st.id];
          return (
            <div
              key={st.id}
              className={clsx("flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 transition", on && "shadow-sm")}
              style={{ borderColor: on ? C.compare : C.base, background: on ? `${C.compare}14` : "transparent" }}
            >
              <code className="min-w-0 font-mono text-[11px] break-all text-ink sm:text-xs">{mode === "lazy" ? st.lazy : st.eager}</code>
              <span className="shrink-0 font-mono text-[11px] font-bold" style={{ color: on && f.dir === "pull" ? C.pivot : C.text }}>
                {mode === "eager"
                  ? size !== undefined
                    ? `list of ${size}`
                    : ""
                  : on && f.dir === "pull"
                    ? "▲ next()"
                    : on && f.item
                      ? `▼ ${f.item}`
                      : st.id === "result" && f.result.length
                        ? `[${f.result.length} items]`
                        : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="lines read" value={`${f.read} / ${LINES.length}`} color={C.active} />
        <Stat label="parse calls" value={f.parsed} color={C.pivot} />
        <Stat label="peak objects held" value={f.peak} color={f.peak > 4 ? C.bad : C.done} />
        <Stat label="result" value={f.result.length ? f.result.map((r) => r.split(":")[0]).join(", ") : "–"} color={C.done} />
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
