"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, PlayPause, Segmented, SmallBtn, Stat, useSimLoop } from "../kit";

type Acks = "1" | "all";

interface Rec {
  id: number;
  epoch: number;
}

interface Broker {
  id: number;
  up: boolean;
  slow: boolean;
  log: Rec[];
  caughtUpAt: number; // last time this follower matched the leader's LEO
}

interface Ev {
  t: number;
  text: string;
  tone: string;
}

const FETCH_MS = 500;
const LAG_MAX = 3000; // replica.lag.time.max.ms (30 s by default; shortened)
const MIN_ISR = 2;

export default function Isr() {
  const [running, setRunning] = useState(true);
  const [acks, setAcks] = useState<Acks>("all");
  const [unclean, setUnclean] = useState(false);
  const t = useRef(0);
  const brokers = useRef<Broker[]>([1, 2, 3].map((id) => ({ id, up: true, slow: false, log: [0, 1, 2].map((i) => ({ id: i, epoch: 0 })), caughtUpAt: 0 })));
  const leader = useRef<number | null>(1);
  const epoch = useRef(0);
  const isr = useRef<number[]>([1, 2, 3]);
  const hw = useRef(3);
  const nextId = useRef(3);
  const pending = useRef<{ id: number; acks: Acks }[]>([]);
  const acked = useRef<Set<number>>(new Set([0, 1, 2]));
  const lost = useRef(0);
  const lastFetch = useRef(0);
  const events = useRef<Ev[]>([{ t: 0, text: "Topic orders, partition 0: replication.factor=3, min.insync.replicas=2", tone: C.muted }]);
  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: t.current, text, tone }, ...events.current].slice(0, 8);
  };
  const B = (id: number) => brokers.current[id - 1];

  const elect = () => {
    const live = isr.current.filter((id) => B(id).up && id !== leader.current);
    if (live.length) {
      const next = live.reduce((a, b) => (B(a).log.length >= B(b).log.length ? a : b));
      leader.current = next;
      epoch.current++;
      log(`Controller elects broker ${next} from the ISR (leader epoch ${epoch.current})`, C.active);
      return;
    }
    const outOfSync = brokers.current.filter((b) => b.up && b.id !== leader.current);
    if (unclean && outOfSync.length) {
      const next = outOfSync[0];
      leader.current = next.id;
      epoch.current++;
      isr.current = [next.id];
      hw.current = next.log.length;
      log(`UNCLEAN election: out-of-sync broker ${next.id} becomes leader. Records it never copied are gone.`, C.bad);
      return;
    }
    leader.current = null;
    log("No in-sync replica alive: partition OFFLINE (unclean.leader.election.enable=false). Waiting for an ISR member to return.", C.bad);
  };

  const truncate = (b: Broker, to: number) => {
    const cut = b.log.slice(to);
    if (!cut.length) return;
    b.log = b.log.slice(0, to);
    const lostAcked = cut.filter((r) => acked.current.has(r.id)).length;
    if (lostAcked) {
      lost.current += lostAcked;
      log(`Broker ${b.id} truncates ${cut.length} record(s) to the new leader's log: ${lostAcked} of them had been ACKED. Data loss.`, C.bad);
    } else log(`Broker ${b.id} truncates ${cut.length} uncommitted record(s) above the high watermark`, C.compare);
  };

  useSimLoop(running, (dt) => {
    t.current += dt;
    const now = t.current;
    const L = leader.current;

    if (L === null) {
      // wait for an ISR member to come back
      const back = isr.current.find((id) => B(id).up);
      if (back) {
        leader.current = back;
        epoch.current++;
        log(`Broker ${back} (an ISR member) is back and becomes leader. Partition online.`, C.done);
      }
      return;
    }
    const lead = B(L);

    if (now - lastFetch.current >= FETCH_MS) {
      lastFetch.current = now;
      for (const b of brokers.current) {
        if (b.id === L) continue;
        if (!b.up || b.slow) continue;
        // follower fetch: first reconcile divergence (truncate to the leader's log), then copy
        let common = 0;
        while (common < b.log.length && common < lead.log.length && b.log[common].id === lead.log[common].id) common++;
        if (common < b.log.length) truncate(b, common);
        if (b.log.length < lead.log.length) b.log = [...b.log, ...lead.log.slice(b.log.length, b.log.length + 4)];
        if (b.log.length === lead.log.length) b.caughtUpAt = now;
      }
      // ISR maintenance on the leader
      for (const b of brokers.current) {
        if (b.id === L) continue;
        const caught = b.up && b.log.length === lead.log.length;
        if (caught) b.caughtUpAt = now;
        const inIsr = isr.current.includes(b.id);
        if (inIsr && now - b.caughtUpAt > LAG_MAX) {
          isr.current = isr.current.filter((x) => x !== b.id);
          log(`Broker ${b.id} lagged > replica.lag.time.max.ms: removed from ISR`, C.compare);
        } else if (!inIsr && caught && b.up) {
          isr.current = [...isr.current, b.id].sort();
          log(`Broker ${b.id} caught up: back in the ISR`, C.done);
        }
      }
      if (!isr.current.includes(L)) isr.current = [...isr.current, L].sort();
      // high watermark = smallest LEO across the ISR
      const newHw = Math.min(...isr.current.map((id) => B(id).log.length));
      if (newHw > hw.current) hw.current = newHw;
      // acks=all requests complete once the HW passes them
      pending.current = pending.current.filter((p) => {
        const idx = lead.log.findIndex((r) => r.id === p.id);
        if (idx >= 0 && idx < hw.current) {
          acked.current.add(p.id);
          return false;
        }
        return true;
      });
    }
  });

  const produce = () => {
    const L = leader.current;
    if (L === null) {
      log("Produce failed: LEADER_NOT_AVAILABLE. The partition is offline.", C.bad);
      return;
    }
    if (acks === "all" && isr.current.length < MIN_ISR) {
      log(`Produce rejected: NOT_ENOUGH_REPLICAS (ISR=${isr.current.length} < min.insync.replicas=${MIN_ISR}). Availability traded for durability.`, C.bad);
      return;
    }
    const id = nextId.current++;
    B(L).log.push({ id, epoch: epoch.current });
    if (acks === "1") {
      acked.current.add(id);
      log(`acks=1: record ${id} acked as soon as leader ${L} wrote it`, C.compare);
    } else {
      pending.current.push({ id, acks });
      log(`acks=all: record ${id} written on leader, waiting for the ISR`, C.active);
    }
  };

  const kill = (id: number) => {
    const b = B(id);
    b.up = false;
    log(`Broker ${id} crashed`, C.bad);
    if (leader.current === id) {
      isr.current = isr.current.filter((x) => x !== id);
      pending.current = [];
      elect();
    }
  };
  const revive = (id: number) => {
    const b = B(id);
    b.up = true;
    b.slow = false;
    log(`Broker ${id} restarted. It fetches from the leader and truncates any divergent tail.`, C.active);
    const L = leader.current;
    if (L !== null && L !== id) {
      // truncate to the high watermark first (pre-KIP-101 behaviour simplified), then follow
      const lead = B(L);
      let common = 0;
      while (common < b.log.length && common < lead.log.length && b.log[common].id === lead.log[common].id) common++;
      truncate(b, common);
    }
  };

  const reset = () => {
    t.current = 0;
    brokers.current = [1, 2, 3].map((id) => ({ id, up: true, slow: false, log: [0, 1, 2].map((i) => ({ id: i, epoch: 0 })), caughtUpAt: 0 }));
    leader.current = 1;
    epoch.current = 0;
    isr.current = [1, 2, 3];
    hw.current = 3;
    nextId.current = 3;
    pending.current = [];
    acked.current = new Set([0, 1, 2]);
    lost.current = 0;
    lastFetch.current = 0;
    events.current = [{ t: 0, text: "Reset: replication.factor=3, min.insync.replicas=2", tone: C.muted }];
  };

  const L = leader.current;
  const maxLen = Math.max(...brokers.current.map((b) => b.log.length));
  const tip =
    lost.current > 0
      ? { tone: "bad" as const, text: `${lost.current} acknowledged record(s) lost. That's what acks=1 or unclean leader election costs. Use acks=all + min.insync.replicas=2 + RF=3 and keep unclean election off for data you can't lose.` }
      : L === null
        ? { tone: "bad" as const, text: "Offline: Kafka refuses to elect a replica that might be missing committed data. Restart an ISR broker, or (if you accept data loss) allow unclean election." }
        : isr.current.length < MIN_ISR
          ? { tone: "warn" as const, text: "ISR is below min.insync.replicas, so acks=all writes are rejected. Consumers can still read up to the high watermark." }
          : { tone: "info" as const, text: "Consumers can only read up to the high watermark (HW): the offset every ISR member has. Records above it are uncommitted. Try: slow down a follower, then kill the leader." };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn onClick={produce} tone="primary">
          produce record
        </SmallBtn>
        <div className="flex items-center gap-1.5 text-xs text-dim">
          acks
          <Segmented value={acks} onChange={setAcks} options={[{ value: "1", label: "1" }, { value: "all", label: "all" }]} />
        </div>
        <SmallBtn onClick={() => setUnclean((x) => !x)} tone={unclean ? "danger" : "default"}>
          unclean.leader.election: {unclean ? "true" : "false"}
        </SmallBtn>
        <SmallBtn onClick={reset}>reset</SmallBtn>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="leader" value={L === null ? "none" : `broker ${L}`} color={L === null ? C.bad : C.text} />
        <Stat label="ISR" value={`{${isr.current.join(",")}}`} color={isr.current.length < MIN_ISR ? C.bad : C.done} />
        <Stat label="high watermark" value={hw.current} />
        <Stat label="acked records lost" value={lost.current} color={lost.current ? C.bad : C.done} />
      </div>

      <div className="space-y-2">
        {brokers.current.map((b) => {
          const isL = b.id === L;
          const inIsr = isr.current.includes(b.id);
          return (
            <div key={b.id} className={clsx("rounded-xl border p-2.5", !b.up ? "border-rose/40 bg-rose/[0.05]" : "border-line bg-panel")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-ink">broker {b.id}</span>
                {isL && <span className="rounded bg-cyan/10 px-1.5 text-[10px] font-bold text-cyan">LEADER</span>}
                {!isL && b.up && <span className="text-[10px] text-faint">follower</span>}
                <span className="text-[10px] font-semibold" style={{ color: !b.up ? C.bad : inIsr ? C.done : C.compare }}>
                  {!b.up ? "DOWN" : inIsr ? "in ISR" : "out of sync"}
                </span>
                <span className="text-[10px] text-faint">LEO {b.log.length}</span>
                <span className="ml-auto flex gap-1">
                  {b.up ? (
                    <>
                      {!isL && (
                        <SmallBtn onClick={() => {
                            b.slow = !b.slow;
                            log(b.slow ? `Broker ${b.id} stops fetching (GC pauses, a slow disk)` : `Broker ${b.id} fetching again`, b.slow ? C.compare : C.muted);
                          }} className="h-7 px-2">
                          {b.slow ? "speed up" : "slow down"}
                        </SmallBtn>
                      )}
                      <SmallBtn onClick={() => kill(b.id)} tone="danger" className="h-7 px-2">
                        kill
                      </SmallBtn>
                    </>
                  ) : (
                    <SmallBtn onClick={() => revive(b.id)} tone="good" className="h-7 px-2">
                      restart
                    </SmallBtn>
                  )}
                </span>
              </div>
              <div className="mt-2 flex gap-0.5 overflow-x-auto pb-1">
                {Array.from({ length: Math.max(maxLen, 1) }, (_, i) => {
                  const r = b.log[i];
                  const committed = i < hw.current;
                  return (
                    <div key={i} className="relative">
                      <div
                        className="grid h-7 w-7 shrink-0 place-items-center rounded font-mono text-[10px]"
                        style={{
                          background: !r ? "transparent" : committed ? `${C.done}22` : `${C.compare}22`,
                          border: `1px ${r ? "solid" : "dashed"} ${!r ? "#e3e8f1" : committed ? C.done : C.compare}`,
                          color: C.text,
                        }}
                        title={r ? `offset ${i}, record ${r.id}, epoch ${r.epoch}` : undefined}
                      >
                        {r ? r.id : ""}
                      </div>
                      {i === hw.current - 1 && <div className="absolute top-0 -right-[2px] h-7 w-[3px] rounded" style={{ background: C.pivot }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-3 text-[10.5px] text-faint">
          <span>
            <span style={{ color: C.done }}>■</span> committed (below HW)
          </span>
          <span>
            <span style={{ color: C.compare }}>■</span> uncommitted
          </span>
          <span>
            <span style={{ color: C.pivot }}>▌</span> high watermark
          </span>
        </div>
      </div>

      <Narration tone={tip.tone}>{tip.text}</Narration>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="space-y-0.5 font-mono text-[11px]">
          {events.current.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-faint tabular-nums">{(e.t / 1000).toFixed(1)}s</span>
              <span style={{ color: e.tone }}>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
