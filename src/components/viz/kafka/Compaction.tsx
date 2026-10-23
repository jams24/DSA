"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, SmallBtn, Stat } from "../kit";

type Policy = "compact" | "delete";

interface Rec {
  off: number;
  key: string;
  val: string | null; // null = tombstone
  age: number; // hours since written
}

const KEYS = ["user:1", "user:2", "user:3", "user:4"];
const CITIES = ["Lagos", "Berlin", "Austin", "Tokyo", "Lima", "Oslo", "Pune", "Accra"];
const SEG = 5; // records per segment (segment.bytes, shrunk)
const RETENTION_H = 48; // retention.ms for delete policy
const TOMBSTONE_H = 24; // delete.retention.ms

const initial = (): Rec[] =>
  [
    ["user:1", "Lagos"],
    ["user:2", "Berlin"],
    ["user:1", "Austin"],
    ["user:3", "Tokyo"],
    ["user:2", "Lima"],
    ["user:4", "Oslo"],
    ["user:1", "Pune"],
    ["user:3", "Accra"],
  ].map(([key, val], i) => ({ off: i, key, val, age: (8 - i) * 6 }));

function segments(log: Rec[]): Rec[][] {
  // records are grouped by the segment their offset fell into when written
  const map = new Map<number, Rec[]>();
  for (const r of log) {
    const s = Math.floor(r.off / SEG);
    map.set(s, [...(map.get(s) ?? []), r]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

export default function Compaction() {
  const [policy, setPolicy] = useState<Policy>("compact");
  const [log, setLog] = useState<Rec[]>(initial);
  const [next, setNext] = useState(8);
  const [note, setNote] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "A compacted topic keeps at least the latest value for every key. Think of it as a table's changelog: replaying it rebuilds the table.",
    tone: "info",
  });

  const segs = segments(log);
  const activeSeg = Math.floor((next - 1) / SEG);
  const latest = new Map<string, Rec>();
  log.forEach((r) => latest.set(r.key, r));
  const table = KEYS.map((k) => [k, latest.get(k)?.val] as const).filter(([, v]) => v !== undefined);

  const append = (key: string, val: string | null) => {
    setLog((l) => [...l.map((r) => ({ ...r, age: r.age + 2 })), { off: next, key, val, age: 0 }]);
    setNext((n) => n + 1);
  };

  const clean = () => {
    if (policy === "delete") {
      const closed = segs.filter((s) => Math.floor(s[0].off / SEG) !== activeSeg);
      const expired = closed.filter((s) => Math.min(...s.map((r) => r.age)) >= RETENTION_H); // the newest record decides
      if (!expired.length) {
        setNote({ text: `No closed segment is older than retention.ms (${RETENTION_H} h). Deletion works on whole segments, by the age of their newest record.`, tone: "warn" });
        return;
      }
      const drop = new Set(expired.flat().map((r) => r.off));
      setLog((l) => l.filter((r) => !drop.has(r.off)));
      setNote({ text: `Deleted ${expired.length} whole segment(s), ${drop.size} records, regardless of key. With cleanup.policy=delete, old data simply ages out. Log start offset moves forward.`, tone: "good" });
      return;
    }
    // compaction: only closed segments are cleaned; keep the latest record per key across the log
    let removed = 0;
    let tombs = 0;
    const out = log.filter((r) => {
      const inActive = Math.floor(r.off / SEG) === activeSeg;
      if (inActive) return true;
      const newest = latest.get(r.key);
      if (newest && newest.off !== r.off) {
        removed++;
        return false;
      }
      if (r.val === null && r.age >= TOMBSTONE_H) {
        tombs++;
        return false;
      }
      return true;
    });
    setLog(out);
    setNote(
      removed || tombs
        ? { text: `The log cleaner removed ${removed} superseded record(s)${tombs ? ` and ${tombs} tombstone(s) older than delete.retention.ms` : ""}. Offsets never change: gaps are normal in compacted topics. The active segment is never compacted.`, tone: "good" }
        : { text: "Nothing to clean in closed segments. Records in the active (last) segment are left alone until it rolls.", tone: "warn" },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={policy}
          onChange={(p) => {
            setPolicy(p);
            setLog(initial());
            setNext(8);
            setNote(
              p === "compact"
                ? { text: "cleanup.policy=compact: keep the latest value per key. Used for changelogs, __consumer_offsets, CDC tables and Kafka Streams state.", tone: "info" }
                : { text: `cleanup.policy=delete: drop whole segments once they're older than retention.ms (${RETENTION_H} h here, 7 days by default) or the partition exceeds retention.bytes.`, tone: "info" },
            );
          }}
          options={[
            { value: "compact", label: "cleanup.policy = compact" },
            { value: "delete", label: "cleanup.policy = delete" },
          ]}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {KEYS.map((k) => (
          <SmallBtn key={k} onClick={() => append(k, CITIES[(next * 3 + k.length) % CITIES.length])} tone="primary">
            update {k}
          </SmallBtn>
        ))}
        <SmallBtn onClick={() => append("user:2", null)} tone="danger">
          tombstone user:2
        </SmallBtn>
        <SmallBtn onClick={() => setLog((l) => l.map((r) => ({ ...r, age: r.age + 12 })))}>+12 h</SmallBtn>
        <SmallBtn onClick={clean} tone="good">
          {policy === "compact" ? "run log cleaner" : "run retention check"}
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            setLog(initial());
            setNext(8);
          }}
        >
          reset
        </SmallBtn>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="records on disk" value={log.length} />
        <Stat label="log start offset" value={log[0]?.off ?? next} />
        <Stat label="next offset" value={next} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {segs.map((s) => {
          const id = Math.floor(s[0].off / SEG);
          const active = id === activeSeg;
          return (
            <div key={id} className={clsx("min-w-[9.5rem] shrink-0 rounded-xl border p-2", active ? "border-cyan bg-cyan/[0.05]" : "border-line bg-panel")}>
              <div className="mb-1 flex justify-between text-[10px]">
                <span className="font-mono text-faint">{String(id * SEG).padStart(8, "0")}.log</span>
                <span className={active ? "font-semibold text-cyan" : "text-faint"}>{active ? "active" : "closed"}</span>
              </div>
              <div className="space-y-0.5">
                {s.map((r) => {
                  const stale = latest.get(r.key)?.off !== r.off;
                  return (
                    <div
                      key={r.off}
                      className="flex justify-between gap-2 rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                      style={{ background: r.val === null ? `${C.bad}14` : stale ? "#f1f5f9" : `${C.done}14`, color: stale ? C.muted : C.text }}
                    >
                      <span>
                        {r.off}: {r.key}={r.val ?? "∅"}
                      </span>
                      <span className="text-faint">{r.age}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Table rebuilt by replaying the topic</div>
        <div className="flex flex-wrap gap-1.5">
          {table.map(([k, v]) => (
            <span key={k} className="rounded-md border border-line-2 px-2 py-1 font-mono text-[11px]">
              {k} → {v ?? <span className="text-rose">deleted</span>}
            </span>
          ))}
        </div>
      </div>
      <Narration tone={note.tone}>{note.text}</Narration>
    </div>
  );
}
