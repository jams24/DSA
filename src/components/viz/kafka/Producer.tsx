"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Slider, Stat, StepControls, useStepper } from "../kit";

type Tab = "batch" | "idem";
type Acks = "0" | "1" | "all";
type Codec = "none" | "lz4" | "zstd";

const RATIO: Record<Codec, number> = { none: 1, lz4: 2.1, zstd: 3.2 };
const PARTITIONS = 12;
const MSG = 1; // KB per record
const RTT = 1.5; // ms producer ↔ broker
const REPL = 4; // ms for followers to fetch (acks=all)

function Batching() {
  const [rate, setRate] = useState(20000); // records/s total
  const [linger, setLinger] = useState(5);
  const [batchKb, setBatchKb] = useState(64);
  const [acks, setAcks] = useState<Acks>("all");
  const [codec, setCodec] = useState<Codec>("lz4");

  const perPart = rate / PARTITIONS; // records/s per partition
  const fillMs = ((batchKb / MSG) / perPart) * 1000; // time to fill a batch
  const waitMs = Math.min(linger, fillMs);
  const recsPerBatch = Math.max(1, Math.min(batchKb / MSG, (perPart * Math.max(waitMs, 0.05)) / 1000));
  const reqPerSec = rate / recsPerBatch;
  const sendMs = acks === "0" ? 0 : acks === "1" ? RTT : RTT + REPL;
  const latency = waitMs + sendMs;
  const wireMBs = (rate * MSG) / 1024 / RATIO[codec];
  const bound = fillMs < linger ? "batch.size" : "linger.ms";

  const tone = reqPerSec > 50000 ? "bad" : acks !== "all" ? "warn" : "good";
  const msg =
    reqPerSec > 50000
      ? `${Math.round(reqPerSec).toLocaleString()} produce requests/s, with ~${recsPerBatch.toFixed(1)} records each. Tiny batches waste CPU on brokers and clients. Raise linger.ms a little: a few ms of latency buys far fewer, fuller batches.`
      : acks === "0"
        ? "acks=0: fire and forget. Lowest latency, but a broker crash or network blip loses data silently. Only for metrics you can afford to drop."
        : acks === "1"
          ? "acks=1: the leader acks once it has written the record. If the leader dies before followers copy it, an acknowledged record is lost."
          : `Batches close on ${bound} (fill time ${fillMs.toFixed(1)} ms vs linger ${linger} ms). acks=all waits for every in-sync replica, so with min.insync.replicas=2 an acked record survives a broker loss.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Slider label="producer rate (records/s)" value={rate} min={1000} max={200000} step={1000} onChange={setRate} format={(v) => v.toLocaleString()} />
        <Slider label="linger.ms" value={linger} min={0} max={100} onChange={setLinger} format={(v) => `${v} ms`} />
        <Slider label="batch.size" value={batchKb} min={16} max={1024} step={16} onChange={setBatchKb} format={(v) => `${v} KB`} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-dim">
          acks
          <Segmented value={acks} onChange={setAcks} options={(["0", "1", "all"] as Acks[]).map((v) => ({ value: v, label: v }))} />
        </div>
        <div className="flex items-center gap-2 text-xs text-dim">
          compression.type
          <Segmented value={codec} onChange={setCodec} options={(["none", "lz4", "zstd"] as Codec[]).map((v) => ({ value: v, label: v }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="records / batch" value={recsPerBatch.toFixed(1)} />
        <Stat label="requests / s" value={Math.round(reqPerSec).toLocaleString()} color={reqPerSec > 50000 ? C.bad : C.text} />
        <Stat label="added latency" value={`${latency.toFixed(1)} ms`} color={latency > 50 ? C.compare : C.text} />
        <Stat label="on the wire" value={`${wireMBs.toFixed(1)} MB/s`} />
      </div>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">One partition&apos;s batch over time</div>
        <div className="flex h-8 items-stretch gap-0.5">
          {Array.from({ length: Math.min(60, Math.ceil(recsPerBatch)) }, (_, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ background: C.active, opacity: 0.35 + 0.65 * (i / Math.max(1, recsPerBatch)) }} />
          ))}
          {recsPerBatch < 60 && <div className="rounded-sm border border-dashed border-line-2" style={{ flex: Math.max(0, Math.min(60, batchKb / MSG) - recsPerBatch) }} />}
        </div>
        <div className="mt-1 text-[10.5px] text-faint">
          filled {Math.min(100, (recsPerBatch / (batchKb / MSG)) * 100).toFixed(0)}% of batch.size before sending · {PARTITIONS} partitions · 1 KB records
        </div>
      </div>
      <Narration tone={tone}>{msg}</Narration>
    </div>
  );
}

interface IFrame {
  log: { seq: number; dup?: boolean }[];
  wire: string;
  note: string;
  tone?: "info" | "good" | "bad" | "warn";
}

function idemFrames(on: boolean): IFrame[] {
  const f: IFrame[] = [];
  const log: IFrame["log"] = [{ seq: 0 }, { seq: 1 }];
  const push = (wire: string, note: string, tone?: IFrame["tone"]) => f.push({ log: log.map((x) => ({ ...x })), wire, note, tone });
  push("", on ? "enable.idempotence=true (the default since Kafka 3.0). The broker gives the producer an id (PID), and every batch carries the PID + a sequence number per partition." : "enable.idempotence=false with retries > 0: the classic way to get duplicates.");
  push(`Produce batch seq=2 ${on ? "(PID 4711)" : ""}`, "The producer sends batch seq=2 and waits for the ack.");
  log.push({ seq: 2 });
  push("broker → ack ✗ (network timeout)", "The leader writes it to the log, but the ack is lost on the way back. The producer can't tell 'never arrived' from 'arrived, ack lost'.", "warn");
  push(`retry batch seq=2 ${on ? "(PID 4711)" : ""}`, "delivery.timeout.ms hasn't expired, so the producer retries the same batch.");
  if (on) push("broker → ack ✓ (duplicate, already have seq=2)", "The broker remembers the last 5 sequence numbers per PID and partition. seq=2 is already in the log, so it acks without writing again. No duplicate, and ordering is kept even with max.in.flight=5.", "good");
  else {
    log.push({ seq: 2, dup: true });
    push("broker → ack ✓ (written twice)", "Without idempotence the broker just appends again. The log now holds the record twice and every consumer processes it twice.", "bad");
  }
  push("", on ? "Idempotence covers one producer session and one partition. For atomic writes across partitions and read-process-write pipelines, you need transactions (exactly-once lesson)." : "It also breaks ordering: with several in-flight requests, a retried batch can land after a later one. Turn idempotence on: it's free and on by default in modern clients.", on ? "info" : "bad");
  return f;
}

function Idempotence() {
  const [on, setOn] = useState<"on" | "off">("on");
  const frames = useMemo(() => idemFrames(on === "on"), [on]);
  const s = useStepper(frames, 1800);
  const f = s.frame;
  return (
    <div className="space-y-4">
      <Segmented
        value={on}
        onChange={setOn}
        options={[
          { value: "on", label: "enable.idempotence = true" },
          { value: "off", label: "idempotence off, retries on" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">producer ↔ broker</div>
          <div className="min-h-[2.5rem] font-mono text-xs text-ink">{f.wire || "…"}</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">partition 0 log</div>
          <div className="flex flex-wrap gap-1">
            {f.log.map((r, i) => (
              <span key={i} className={clsx("rounded-md border px-2 py-1 font-mono text-[11px]", r.dup ? "border-rose bg-rose/10 text-rose" : "border-line-2 text-ink")}>
                off {i} · seq {r.seq}
                {r.dup ? " DUP" : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}

export default function Producer() {
  const [tab, setTab] = useState<Tab>("batch");
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "batch", label: "Batching, acks & compression" },
          { value: "idem", label: "Retries & idempotence" },
        ]}
      />
      {tab === "batch" ? <Batching /> : <Idempotence />}
    </div>
  );
}
