"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

type Kind = "tumbling" | "hopping" | "session";

// event times (seconds) in the order they arrive at the stream processor
const EVENTS = [1, 3, 7, 12, 9, 15, 22, 4, 25, 31, 18, 33, 38];
const SIZE = 10;
const ADVANCE = 5;
const GAP = 5;
const SPAN = 42;

interface Win {
  start: number;
  end: number;
  count: number;
  closed: boolean;
  row: number;
}

interface Frame {
  i: number; // events processed so far
  streamTime: number;
  wins: Win[];
  dropped: number[];
  note: string;
  tone?: "info" | "good" | "bad" | "warn";
}

function windowsFor(t: number, kind: Kind): { start: number; end: number; row: number }[] {
  if (kind === "tumbling") {
    const s = Math.floor(t / SIZE) * SIZE;
    return [{ start: s, end: s + SIZE, row: 0 }];
  }
  const out: { start: number; end: number; row: number }[] = [];
  for (let s = Math.floor(t / ADVANCE) * ADVANCE; s > t - SIZE; s -= ADVANCE) if (s >= 0) out.push({ start: s, end: s + SIZE, row: (s / ADVANCE) % 2 });
  return out;
}

function build(kind: Kind, grace: number): Frame[] {
  const frames: Frame[] = [];
  let wins: Win[] = [];
  const dropped: number[] = [];
  let st = 0;
  const snap = (i: number, note: string, tone?: Frame["tone"]) => frames.push({ i, streamTime: st, wins: wins.map((w) => ({ ...w })), dropped: [...dropped], note, tone });
  const desc = kind === "tumbling" ? `fixed ${SIZE}s windows that don't overlap` : kind === "hopping" ? `${SIZE}s windows that start every ${ADVANCE}s, so each event lands in two` : `sessions that close after ${GAP}s of inactivity`;
  snap(0, `Counting clicks per user in ${desc}. Events arrive out of order; stream time = the largest event timestamp seen so far. Grace period: ${grace}s.`);

  EVENTS.forEach((t, k) => {
    st = Math.max(st, t);
    let msg = "";
    let tone: Frame["tone"] = "info";
    if (kind === "session") {
      if (t + GAP + grace < st) {
        dropped.push(t);
        msg = `Event at t=${t}s arrives when stream time is ${st}s. Any session it could join closed at ${t + GAP}s + ${grace}s grace. Dropped as late.`;
        tone = "bad";
      } else {
        const touching = wins.filter((w) => !w.closed && t >= w.start - GAP && t <= w.end + GAP);
        const merged: Win = { start: Math.min(t, ...touching.map((w) => w.start)), end: Math.max(t, ...touching.map((w) => w.end)), count: 1 + touching.reduce((a, w) => a + w.count, 0), closed: false, row: 0 };
        wins = [...wins.filter((w) => !touching.includes(w)), merged];
        msg = touching.length > 1 ? `t=${t}s bridges ${touching.length} sessions, so they MERGE into one: [${merged.start}s, ${merged.end}s]. Late data can rewrite session results.` : touching.length ? `t=${t}s is within ${GAP}s of an open session, which extends to [${merged.start}s, ${merged.end}s].` : `t=${t}s starts a new session.`;
        tone = touching.length > 1 ? "warn" : "info";
      }
      wins.forEach((w) => {
        if (!w.closed && st >= w.end + GAP + grace) w.closed = true;
      });
    } else {
      const targets = windowsFor(t, kind);
      const open = targets.filter((w) => st < w.end + grace);
      if (!open.length) {
        dropped.push(t);
        msg = `Event at t=${t}s belongs to [${targets.map((w) => `${w.start}–${w.end}`).join("], [")}], but stream time is ${st}s, past end + grace. The window is closed: dropped as late.`;
        tone = "bad";
      } else {
        for (const w of open) {
          const ex = wins.find((x) => x.start === w.start);
          if (ex) ex.count++;
          else wins.push({ ...w, count: 1, closed: false });
        }
        const late = t < st;
        msg = `t=${t}s → ${open.map((w) => `[${w.start}s, ${w.end}s)`).join(" and ")}${late ? ` (out of order, but still within ${grace ? `the ${grace}s grace period` : "an open window"})` : ""}.`;
        tone = late ? "warn" : "info";
      }
      wins.forEach((w) => {
        if (!w.closed && st >= w.end + grace) w.closed = true;
      });
    }
    const justClosed = wins.filter((w) => w.closed && !frames[frames.length - 1].wins.some((p) => p.start === w.start && p.closed));
    if (justClosed.length) msg += ` Stream time ${st}s closes ${justClosed.map((w) => `[${w.start}, ${w.end})`).join(", ")}: its final count is emitted (with suppress(untilWindowCloses)).`;
    snap(k + 1, msg, tone);
  });
  snap(EVENTS.length, `Done: ${dropped.length} event(s) dropped as late. A longer grace period accepts more late data but delays final results by that much. That's the latency vs completeness trade-off.`, dropped.length ? "warn" : "good");
  return frames;
}

const X = (t: number) => 20 + (t / SPAN) * 600;

export default function Windows() {
  const [kind, setKind] = useState<Kind>("tumbling");
  const [grace, setGrace] = useState<"0" | "5" | "15">("0");
  const frames = useMemo(() => build(kind, Number(grace)), [kind, grace]);
  const s = useStepper(frames, 1600);
  const f = s.frame;
  const current = f.i > 0 ? EVENTS[f.i - 1] : null;
  const rows = kind === "hopping" ? 2 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "tumbling", label: "Tumbling 10s" },
            { value: "hopping", label: "Hopping 10s / 5s" },
            { value: "session", label: "Session (gap 5s)" },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-dim">
          grace
          <Segmented
            value={grace}
            onChange={setGrace}
            options={[
              { value: "0", label: "0s" },
              { value: "5", label: "5s" },
              { value: "15", label: "15s" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="stream time" value={`${f.streamTime}s`} />
        <Stat label="events in" value={`${f.i}/${EVENTS.length}`} />
        <Stat label="dropped late" value={f.dropped.length} color={f.dropped.length ? C.bad : C.done} />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
        <svg viewBox={`0 0 640 ${110 + rows * 44}`} className="w-full" role="img" aria-label="Event-time windows">
          <line x1={X(0)} x2={X(SPAN)} y1={60} y2={60} stroke="#cbd5e1" />
          {Array.from({ length: SPAN / 5 + 1 }, (_, k) => k * 5).map((t) => (
            <g key={t}>
              <line x1={X(t)} x2={X(t)} y1={56} y2={64} stroke="#94a3b8" />
              <text x={X(t)} y={78} textAnchor="middle" fontSize={9} fill={C.faint}>
                {t}s
              </text>
            </g>
          ))}
          {/* stream time marker */}
          <line x1={X(f.streamTime)} x2={X(f.streamTime)} y1={14} y2={100 + rows * 44} stroke={C.pivot} strokeDasharray="4 3" />
          <text x={X(f.streamTime) + 4} y={22} fontSize={9} fill={C.pivot}>
            stream time
          </text>
          {EVENTS.slice(0, f.i).map((t, k) => {
            const isDropped = f.dropped.includes(t);
            const isCur = k === f.i - 1;
            return <circle key={k} cx={X(t)} cy={44 - (k % 2) * 10} r={isCur ? 7 : 5} fill={isDropped ? C.bad : C.active} stroke={isCur ? C.text : "none"} strokeWidth={1.5} opacity={isDropped ? 0.8 : 0.9} />;
          })}
          {current !== null && (
            <text x={X(current)} y={14} textAnchor="middle" fontSize={9} fontWeight={600} fill={C.text}>
              t={current}
            </text>
          )}
          {f.wins.map((w) => {
            const y = 92 + w.row * 44;
            const end = Math.min(SPAN, w.end);
            return (
              <g key={`${w.start}-${w.row}`}>
                <rect
                  x={X(w.start) + 1}
                  y={y}
                  width={Math.max(6, X(end) - X(w.start) - 2)}
                  height={34}
                  rx={6}
                  fill={w.closed ? "#ecfdf5" : "#ecfeff"}
                  stroke={w.closed ? C.done : C.active}
                  strokeWidth={1.5}
                  strokeDasharray={w.closed ? undefined : "5 3"}
                />
                <text x={(X(w.start) + X(end)) / 2} y={y + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.text}>
                  {w.count}
                </text>
                <text x={(X(w.start) + X(end)) / 2} y={y + 28} textAnchor="middle" fontSize={8.5} fill={w.closed ? C.done : C.active}>
                  {w.closed ? "final" : "open"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
