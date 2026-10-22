"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, Segmented, SmallBtn, useSimLoop } from "../kit";

type Policy = "random" | "ryw" | "sticky";

const LAGS = [0, 800, 3500]; // leader, follower 1, follower 2 (ms)
const NAMES = ["Leader", "Follower 1", "Follower 2"];
const NAMES_LIST = ["Ada", "Grace", "Linus", "Barbara", "Ken", "Margaret", "Dennis", "Radia"];

interface Write {
  t: number;
  version: number;
  name: string;
}
interface Read {
  t: number;
  replica: number;
  version: number;
  issues: string[];
}

export default function Replication() {
  const [running, setRunning] = useState(true);
  const [policy, setPolicy] = useState<Policy>("random");
  const now = useRef(0);
  const writes = useRef<Write[]>([{ t: -10_000, version: 1, name: "Ada" }]);
  const reads = useRef<Read[]>([]);
  const lastSeen = useRef(1);
  const lastWriteT = useRef(-Infinity);
  const myVersion = useRef(1);
  const [, force] = useState(0);

  useSimLoop(running, (dt) => {
    now.current += dt;
  }, 10);

  const versionAt = (replica: number) => {
    const visible = writes.current.filter((w) => w.t <= now.current - LAGS[replica]);
    return visible[visible.length - 1];
  };

  function write() {
    const version = writes.current[writes.current.length - 1].version + 1;
    writes.current.push({ t: now.current, version, name: NAMES_LIST[(version - 1) % NAMES_LIST.length] });
    lastWriteT.current = now.current;
    myVersion.current = version;
    force((x) => x + 1);
  }

  function read() {
    let replica: number;
    if (policy === "random") replica = Math.floor(Math.random() * 3);
    else if (policy === "ryw") replica = now.current - lastWriteT.current < Math.max(...LAGS) ? 0 : 1 + Math.floor(Math.random() * 2);
    else replica = 2; // pinned to one replica
    const w = versionAt(replica);
    const issues: string[] = [];
    if (w.version < myVersion.current) issues.push("read-your-writes violated");
    if (w.version < lastSeen.current) issues.push("monotonic reads violated (time went backwards)");
    lastSeen.current = Math.max(lastSeen.current, w.version);
    reads.current = [{ t: now.current, replica, version: w.version, issues }, ...reads.current].slice(0, 6);
    force((x) => x + 1);
  }

  const latest = writes.current[writes.current.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn tone="primary" onClick={write}>
          ✍️ update my profile name
        </SmallBtn>
        <SmallBtn tone="good" onClick={read}>
          👀 view my profile
        </SmallBtn>
        <Segmented
          value={policy}
          onChange={setPolicy}
          options={[
            { value: "random", label: "Read any replica" },
            { value: "ryw", label: "Read-your-writes routing" },
            { value: "sticky", label: "Sticky replica" },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {NAMES.map((n, i) => {
          const w = versionAt(i);
          const behind = latest.version - w.version;
          return (
            <div key={n} className="rounded-xl border bg-[#f8fafd] p-3" style={{ borderColor: i === 0 ? `${C.done}66` : behind ? `${C.compare}66` : "#e2e8f0" }}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">🗄️ {n}</span>
                <span className="font-mono text-faint">{i === 0 ? "writes here" : `lag ${LAGS[i] / 1000}s`}</span>
              </div>
              <div className="mt-2 font-display text-xl font-bold text-ink">{w.name}</div>
              <div className="font-mono text-xs" style={{ color: behind ? C.compare : C.done }}>
                v{w.version} {behind ? `(${behind} behind)` : "(up to date)"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 rounded-xl border border-line bg-panel p-3">
        <div className="text-[10px] uppercase tracking-wider text-faint">Your reads (newest first) — you last wrote v{myVersion.current}</div>
        {reads.current.length === 0 && <div className="text-xs text-dim">Update your name, then immediately view your profile a few times.</div>}
        {reads.current.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-faint">{NAMES[r.replica]}</span>
            <span className="text-ink">→ v{r.version}</span>
            {r.issues.length ? r.issues.map((x) => <span key={x} className="rounded border border-rose/40 bg-rose/10 px-1.5 text-rose">{x}</span>) : <span className="text-emerald">✓ consistent for you</span>}
          </div>
        ))}
      </div>
      <Narration tone={policy === "random" ? "warn" : "good"}>
        {policy === "random" && "Asynchronous replication + reading from any replica = eventual consistency. Right after a write you may see your old name, and consecutive reads can even go back in time."}
        {policy === "ryw" && "Read-your-writes: for a short window after you write, your reads go to the leader. Other users may still see the old value briefly — that's fine for a profile."}
        {policy === "sticky" && "Monotonic reads: always reading from the same replica means you never see time go backwards — but you may still not see your own latest write on a lagging replica."}
      </Narration>
    </div>
  );
}
