"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

const SOURCE = [3, 8, 1, 6, 9, 4, 7];
type Status = "waiting" | "rejected" | "passed" | "never";
type StageId = "source" | "filter" | "sorted" | "map" | "limit" | "collect";

interface Frame {
  at: StageId | null;
  item: number | null;
  status: Status[];
  filterCalls: number;
  mapCalls: number;
  buffer: number[];
  result: number[];
  note: string;
  tone: "info" | "good" | "bad" | "warn";
}

function build(sorted: boolean): Frame[] {
  const frames: Frame[] = [];
  const status: Status[] = SOURCE.map(() => "waiting");
  let filterCalls = 0;
  let mapCalls = 0;
  let buffer: number[] = [];
  const result: number[] = [];
  const push = (at: StageId | null, item: number | null, note: string, tone: Frame["tone"] = "info") =>
    frames.push({ at, item, status: [...status], filterCalls, mapCalls, buffer: [...buffer], result: [...result], note, tone });

  push(null, null, "Building the pipeline runs NOTHING. filter, map and limit are lazy intermediate operations: they only describe the work. The terminal operation toList() starts it.");

  if (!sorted) {
    for (let i = 0; i < SOURCE.length; i++) {
      const x = SOURCE[i];
      push("source", x, i === 0 ? "toList() pulls the first element from the source. Elements travel through the whole pipeline ONE AT A TIME (vertically), not stage by stage." : `Pull the next element: ${x}.`);
      filterCalls++;
      if (x <= 4) {
        status[i] = "rejected";
        push("filter", x, `filter(n > 4) → false. ${x} is dropped right here; map never sees it.`);
        continue;
      }
      push("filter", x, `filter(n > 4) → true. ${x} continues down the pipe.`);
      mapCalls++;
      push("map", x * 10, `map(n * 10) turns ${x} into ${x * 10}.`);
      status[i] = "passed";
      result.push(x * 10);
      push("limit", x * 10, `limit(2) lets it through (${result.length} of 2) and it's added to the list.`, "good");
      if (result.length === 2) {
        for (let k = i + 1; k < SOURCE.length; k++) status[k] = "never";
        push("collect", null, `limit(2) is satisfied, so the stream SHORT-CIRCUITS: ${SOURCE.slice(i + 1).join(", ")} are never even read. ${filterCalls} filter calls and ${mapCalls} map calls instead of 7 and 4. On an infinite stream (Stream.iterate) this is what makes it terminate.`, "good");
        break;
      }
    }
  } else {
    for (let i = 0; i < SOURCE.length; i++) {
      const x = SOURCE[i];
      filterCalls++;
      if (x <= 4) {
        status[i] = "rejected";
        push("filter", x, `filter(n > 4) rejects ${x}.`);
      } else {
        status[i] = "passed";
        buffer.push(x);
        push("sorted", x, `${x} passes the filter and is BUFFERED by sorted(). sorted() can't emit anything until it has seen every element: the smallest might be last.`, "warn");
      }
    }
    buffer = [...buffer].sort((a, b) => a - b);
    push("sorted", null, `Source exhausted: all 7 elements went through filter. sorted() sorts its buffer: [${buffer.join(", ")}]. Stateful operations (sorted, distinct) are barriers that need O(n) memory.`, "warn");
    while (result.length < 2) {
      const x = buffer.shift()!;
      mapCalls++;
      push("map", x * 10, `Now elements flow again, lazily: map turns ${x} into ${x * 10}.`);
      result.push(x * 10);
      push("limit", x * 10, `limit(2): ${result.length} of 2.`, "good");
    }
    push("collect", null, `limit short-circuits the part AFTER sorted(): only ${mapCalls} map calls. But filter ran ${filterCalls} times. Where you put sorted() matters; filter before you sort so the barrier holds fewer elements.`, "good");
  }
  return frames;
}

export default function JavaStreams() {
  const [mode, setMode] = useState<"lazy" | "sorted">("lazy");
  const frames = useMemo(() => build(mode === "sorted"), [mode]);
  const s = useStepper(frames, 1300);
  const f = s.frame;
  const stages: { id: StageId; label: string }[] = [
    { id: "source", label: "source" },
    { id: "filter", label: ".filter(n -> n > 4)" },
    ...(mode === "sorted" ? [{ id: "sorted" as StageId, label: ".sorted()" }] : []),
    { id: "map", label: ".map(n -> n * 10)" },
    { id: "limit", label: ".limit(2)" },
    { id: "collect", label: ".toList()" },
  ];

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "lazy", label: "filter → map → limit" },
          { value: "sorted", label: "…with sorted() in the middle" },
        ]}
      />
      <pre className="overflow-x-auto rounded-xl border border-line bg-[#f8fafc] px-3 py-2 font-mono text-[12px] text-[#334155]">
        {`List<Integer> out = Stream.of(${SOURCE.join(", ")})\n    .filter(n -> n > 4)${mode === "sorted" ? "\n    .sorted()" : ""}\n    .map(n -> n * 10)\n    .limit(2)\n    .toList();`}
      </pre>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Source elements</div>
        <div className="flex flex-wrap gap-1.5">
          {SOURCE.map((x, i) => {
            const st = f.status[i];
            const cur = f.at === "source" && f.item === x && st === "waiting";
            const col = st === "passed" ? C.done : st === "rejected" ? C.bad : st === "never" ? C.base : cur ? C.compare : C.active;
            return (
              <div key={i} className={clsx("grid h-10 w-10 place-items-center rounded-lg border-2 font-mono text-sm font-bold transition", st === "never" && "opacity-40", cur && "scale-110")} style={{ borderColor: col, background: `${col}14`, color: st === "never" ? C.faint : C.text }}>
                {x}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-dim">
          <span style={{ color: C.done }}>■ made it</span>
          <span style={{ color: C.bad }}>■ filtered out</span>
          <span style={{ color: C.faint }}>■ never read</span>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-1.5">
        {stages.map((st, i) => {
          const on = f.at === st.id;
          return (
            <div key={st.id} className="flex items-center gap-1.5">
              <div className={clsx("min-w-[6.5rem] rounded-xl border-2 px-2.5 py-2 transition", on && "shadow-sm")} style={{ borderColor: on ? C.compare : C.base, background: on ? `${C.compare}14` : "#fff" }}>
                <div className="font-mono text-[10px] text-dim">{st.label}</div>
                <div className="mt-1 h-6 font-mono text-base font-bold text-ink">
                  {st.id === "sorted" ? (f.buffer.length ? `[${f.buffer.join(",")}]` : "") : on && f.item !== null ? f.item : st.id === "collect" ? `[${f.result.join(", ")}]` : ""}
                </div>
              </div>
              {i < stages.length - 1 && <span className="text-faint">→</span>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="filter calls" value={f.filterCalls} color={C.active} />
        <Stat label="map calls" value={f.mapCalls} color={C.pivot} />
        <Stat label="result" value={`[${f.result.join(", ")}]`} color={C.done} />
      </div>
      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
