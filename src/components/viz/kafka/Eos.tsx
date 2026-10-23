"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type Mode = "amo" | "alo" | "eos";

interface Out {
  v: string;
  state: "committed" | "open" | "aborted" | "plain";
}

interface Frame {
  pos: number; // which input record the app is on
  committed: number; // consumer group's committed offset
  out: Out[];
  db: string[]; // what a read_committed (or plain) downstream consumer sees
  crash?: boolean;
  note: string;
  tone?: "info" | "good" | "bad" | "warn";
}

const INPUT = ["pay #41 $20", "pay #42 $35", "pay #43 $12"];
const fmt = (v: string) => `fee(${v.split(" ")[1]})`;

function build(mode: Mode): Frame[] {
  const f: Frame[] = [];
  let pos = 0;
  let committed = 0;
  let out: Out[] = [];
  const push = (note: string, tone?: Frame["tone"], crash?: boolean) => {
    const visible = out.filter((o) => (mode === "eos" ? o.state === "committed" : true)).map((o) => o.v);
    f.push({ pos, committed, out: out.map((o) => ({ ...o })), db: visible, crash, note, tone });
  };

  if (mode === "amo") {
    push("At-most-once: commit the offset first, then process. Simple and fast, but a crash between the two loses the record.");
    pos = 0;
    committed = 1;
    push("Poll pay #41 and immediately commit offset 1 (enable.auto.commit can do this for you on a timer, before you've processed anything).");
    out.push({ v: fmt(INPUT[0]), state: "plain" });
    push("Process it and produce the fee event. Good.", "good");
    pos = 1;
    committed = 2;
    push("Poll pay #42 and commit offset 2.");
    push("💥 The app crashes before producing the fee for #42.", "bad", true);
    pos = 2;
    push("On restart the consumer resumes from the committed offset 2. pay #42 is never processed: it's lost.", "bad");
    out.push({ v: fmt(INPUT[2]), state: "plain" });
    committed = 3;
    push("Use it only where losing a record is acceptable (metrics, logs sampling).", "warn");
    return f;
  }

  if (mode === "alo") {
    push("At-least-once: process, produce, and only then commit the offset. Nothing is lost, but a crash can replay records.");
    out.push({ v: fmt(INPUT[0]), state: "plain" });
    committed = 1;
    push("pay #41 → produce fee → commit offset 1.", "good");
    pos = 1;
    out.push({ v: fmt(INPUT[1]), state: "plain" });
    push("pay #42 → produce fee. The output is written and acked.");
    push("💥 Crash before committing offset 2.", "bad", true);
    push("On restart the group resumes from the last committed offset, 1, so pay #42 is read again.", "warn");
    out.push({ v: fmt(INPUT[1]), state: "plain" });
    committed = 2;
    push("…and the fee is produced a second time. Downstream sees a duplicate. This is Kafka's default behaviour.", "bad");
    pos = 2;
    out.push({ v: fmt(INPUT[2]), state: "plain" });
    committed = 3;
    push("Fix it downstream with idempotent consumers (dedupe on a key, upserts), or use transactions for Kafka-to-Kafka pipelines.", "info");
    return f;
  }

  push("Exactly-once (Kafka → Kafka): the producer has a transactional.id. Output records AND the consumer offsets are committed in one atomic transaction.");
  out.push({ v: fmt(INPUT[0]), state: "open" });
  push("beginTransaction(). Process pay #41, send the fee. It's written to the output partition but marked as part of an open transaction.");
  push("sendOffsetsToTransaction(offset 1): the input offset becomes part of the same transaction.");
  out = out.map((o) => ({ ...o, state: "committed" }));
  committed = 1;
  push("commitTransaction(): the transaction coordinator writes commit markers to every partition involved. Output and offset become visible together.", "good");
  pos = 1;
  out.push({ v: fmt(INPUT[1]), state: "open" });
  push("Next transaction: pay #42 → fee written (still uncommitted).");
  push("💥 Crash before commitTransaction().", "bad", true);
  out = out.map((o) => (o.state === "open" ? { ...o, state: "aborted" } : o));
  push("The restarted instance calls initTransactions() with the same transactional.id. That fences the old 'zombie' producer (epoch bump) and aborts its open transaction.", "warn");
  push("The aborted fee is still physically in the log, but consumers with isolation.level=read_committed skip it. The offset was never committed either, so pay #42 is reprocessed.", "info");
  out.push({ v: fmt(INPUT[1]), state: "committed" });
  committed = 2;
  push("pay #42 → fee, committed with offset 2 in one transaction. Downstream saw it exactly once.", "good");
  pos = 2;
  out.push({ v: fmt(INPUT[2]), state: "committed" });
  committed = 3;
  push("Caveat: exactly-once covers Kafka-to-Kafka only. Side effects outside Kafka (emails, a payment API, a DB write) still need idempotency keys or the outbox pattern.", "warn");
  return f;
}

export default function Eos() {
  const [mode, setMode] = useState<Mode>("alo");
  const frames = useMemo(() => build(mode), [mode]);
  const s = useStepper(frames, 2000);
  const f = s.frame;
  const counts = new Map<string, number>();
  f.db.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));

  return (
    <div className="space-y-4">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "amo", label: "At-most-once" },
          { value: "alo", label: "At-least-once" },
          { value: "eos", label: "Exactly-once (transactions)" },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">input topic: payments</div>
          <div className="space-y-1">
            {INPUT.map((v, i) => (
              <div key={v} className={clsx("flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[11px]", i === f.pos ? "border-cyan bg-cyan/10" : "border-line")}>
                <span>
                  <span className="text-faint">off {i}</span> {v}
                </span>
                {i < f.committed && <span className="text-[10px] text-emerald">✓ committed</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10.5px] text-dim">committed offset: {f.committed}</div>
        </div>

        <div className={clsx("rounded-xl border p-3", f.crash ? "border-rose bg-rose/[0.06]" : "border-line bg-panel")}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">output topic: fees (raw log)</div>
          <div className="space-y-1">
            {f.out.map((o, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[11px]"
                style={{ borderColor: o.state === "aborted" ? C.bad : o.state === "open" ? C.compare : "#e3e8f1", opacity: o.state === "aborted" ? 0.6 : 1 }}
              >
                <span className={o.state === "aborted" ? "line-through" : ""}>{o.v}</span>
                <span className="text-[10px]" style={{ color: o.state === "aborted" ? C.bad : o.state === "open" ? C.compare : o.state === "committed" ? C.done : C.faint }}>
                  {o.state === "plain" ? "" : o.state}
                </span>
              </div>
            ))}
            {f.out.length === 0 && <div className="text-xs text-faint italic">empty</div>}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">downstream sees {mode === "eos" ? "(read_committed)" : ""}</div>
          <div className="space-y-1">
            {[...counts].map(([v, n]) => (
              <div key={v} className={clsx("rounded-md border px-2 py-1 font-mono text-[11px]", n > 1 ? "border-rose bg-rose/10 text-rose" : "border-line text-ink")}>
                {v}
                {n > 1 ? ` ×${n} DUPLICATE` : ""}
              </div>
            ))}
            {INPUT.slice(0, f.pos)
              .filter((v) => !counts.has(fmt(v)))
              .map((v) => (
                <div key={v} className="rounded-md border border-dashed border-rose px-2 py-1 font-mono text-[11px] text-rose">
                  {fmt(v)} MISSING
                </div>
              ))}
          </div>
        </div>
      </div>

      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
