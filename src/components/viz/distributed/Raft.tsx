"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { C, PlayPause, SmallBtn, useSimLoop } from "../kit";

type Role = "follower" | "candidate" | "leader";

interface Entry {
  term: number;
  cmd: string;
}

interface RNode {
  id: number;
  alive: boolean;
  role: Role;
  term: number;
  votedFor: number | null;
  votes: Set<number>;
  log: Entry[];
  commit: number; // highest committed index (1-based), 0 = none
  deadline: number; // election timeout deadline
  timeout: number; // length of the current timeout
  nextHb: number;
  nextIndex: number[];
  matchIndex: number[];
}

type Msg =
  | { kind: "vote"; term: number; from: number; to: number; lastIndex: number; lastTerm: number }
  | { kind: "voteResp"; term: number; from: number; to: number; granted: boolean }
  | { kind: "append"; term: number; from: number; to: number; prevIndex: number; prevTerm: number; entries: Entry[]; leaderCommit: number }
  | { kind: "appendResp"; term: number; from: number; to: number; success: boolean; match: number };

interface Flight {
  id: number;
  msg: Msg;
  sent: number;
  arrive: number;
}

const N = 5;
const HB = 1100;
const LAT = [450, 750];
const TIMEOUT = [3000, 5200];
const POS = Array.from({ length: N }, (_, i) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
  return { x: 260 + 170 * Math.cos(a), y: 215 + 170 * Math.sin(a) };
});
const TERM_COLORS = ["#cbd5e1", "#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706", "#ea580c", "#059669", "#0284c7", "#e11d48"];
const CMDS = ["x=1", "y=7", "x=3", "z=2", "y=9", "x=5", "w=4", "z=8"];

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function fresh(now: number): RNode[] {
  return Array.from({ length: N }, (_, id) => {
    const timeout = rand(TIMEOUT[0], TIMEOUT[1]);
    return { id, alive: true, role: "follower", term: 0, votedFor: null, votes: new Set(), log: [], commit: 0, deadline: now + timeout, timeout, nextHb: 0, nextIndex: Array(N).fill(1), matchIndex: Array(N).fill(0) };
  });
}

export default function Raft() {
  const [running, setRunning] = useState(false);
  const [partitioned, setPartitioned] = useState(false);
  const nodes = useRef<RNode[]>(fresh(0));
  const flights = useRef<Flight[]>([]);
  const events = useRef<{ t: number; text: string; tone: string }[]>([]);
  const now = useRef(0);
  const started = useRef(false);
  const fid = useRef(1);
  const cmdIdx = useRef(0);
  const [, force] = useState(0);

  const side = (i: number) => (i < 2 ? 0 : 1);
  const canTalk = (a: number, b: number) => !partitioned || side(a) === side(b);
  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: now.current, text, tone }, ...events.current].slice(0, 7);
  };
  const lastTerm = (n: RNode) => n.log[n.log.length - 1]?.term ?? 0;
  const resetTimer = (n: RNode, t: number) => {
    n.timeout = rand(TIMEOUT[0], TIMEOUT[1]);
    n.deadline = t + n.timeout;
  };
  const send = (msg: Msg, t: number) => {
    flights.current.push({ id: fid.current++, msg, sent: t, arrive: t + rand(LAT[0], LAT[1]) });
  };

  function stepDown(n: RNode, term: number, t: number) {
    if (n.role === "leader") log(`S${n.id + 1} sees term ${term} and steps down`, C.compare);
    n.term = term;
    n.role = "follower";
    n.votedFor = null;
    resetTimer(n, t);
  }

  function sendAppends(leader: RNode, t: number) {
    for (let p = 0; p < N; p++) {
      if (p === leader.id) continue;
      const prevIndex = leader.nextIndex[p] - 1;
      send({ kind: "append", term: leader.term, from: leader.id, to: p, prevIndex, prevTerm: leader.log[prevIndex - 1]?.term ?? 0, entries: leader.log.slice(prevIndex), leaderCommit: leader.commit }, t);
    }
    leader.nextHb = t + HB;
  }

  function deliver(m: Msg, t: number) {
    const n = nodes.current[m.to];
    if (!n.alive) return;
    if (m.term > n.term) stepDown(n, m.term, t);
    switch (m.kind) {
      case "vote": {
        const upToDate = m.lastTerm > lastTerm(n) || (m.lastTerm === lastTerm(n) && m.lastIndex >= n.log.length);
        const granted = m.term === n.term && (n.votedFor === null || n.votedFor === m.from) && upToDate;
        if (granted) {
          n.votedFor = m.from;
          resetTimer(n, t);
        }
        send({ kind: "voteResp", term: n.term, from: n.id, to: m.from, granted }, t);
        break;
      }
      case "voteResp": {
        if (n.role !== "candidate" || m.term !== n.term || !m.granted) break;
        n.votes.add(m.from);
        if (n.votes.size > N / 2) {
          n.role = "leader";
          n.nextIndex = Array(N).fill(n.log.length + 1);
          n.matchIndex = Array(N).fill(0);
          n.matchIndex[n.id] = n.log.length;
          log(`👑 S${n.id + 1} wins term ${n.term} with ${n.votes.size}/${N} votes`, C.done);
          sendAppends(n, t);
        }
        break;
      }
      case "append": {
        if (m.term < n.term) {
          send({ kind: "appendResp", term: n.term, from: n.id, to: m.from, success: false, match: 0 }, t);
          break;
        }
        if (n.role !== "follower") n.role = "follower";
        resetTimer(n, t);
        const okPrev = m.prevIndex === 0 || n.log[m.prevIndex - 1]?.term === m.prevTerm;
        if (!okPrev) {
          send({ kind: "appendResp", term: n.term, from: n.id, to: m.from, success: false, match: 0 }, t);
          break;
        }
        m.entries.forEach((e, k) => {
          const idx = m.prevIndex + k; // 0-based slot
          if (n.log[idx] && n.log[idx].term !== e.term) n.log.length = idx; // drop conflicting suffix
          if (!n.log[idx]) n.log[idx] = e;
        });
        const lastNew = m.prevIndex + m.entries.length;
        if (m.leaderCommit > n.commit) n.commit = Math.min(m.leaderCommit, lastNew);
        send({ kind: "appendResp", term: n.term, from: n.id, to: m.from, success: true, match: lastNew }, t);
        break;
      }
      case "appendResp": {
        if (n.role !== "leader" || m.term !== n.term) break;
        if (m.success) {
          n.matchIndex[m.from] = Math.max(n.matchIndex[m.from], m.match);
          n.nextIndex[m.from] = n.matchIndex[m.from] + 1;
          for (let idx = n.log.length; idx > n.commit; idx--) {
            const replicas = n.matchIndex.filter((x, p) => (p === n.id ? n.log.length : x) >= idx).length;
            if (replicas > N / 2 && n.log[idx - 1].term === n.term) {
              log(`✅ entry #${idx} (${n.log[idx - 1].cmd}) committed on a majority`, C.done);
              n.commit = idx;
              break;
            }
          }
        } else n.nextIndex[m.from] = Math.max(1, n.nextIndex[m.from] - 1);
        break;
      }
    }
  }

  useSimLoop(running, (dt) => {
    if (!started.current) {
      started.current = true;
      log("Cluster starts: everyone is a follower waiting for a heartbeat.");
    }
    now.current += dt;
    const t = now.current;
    // deliver arrived messages
    const pending: Flight[] = [];
    for (const f of flights.current) {
      if (f.arrive > t) pending.push(f);
      else if (canTalk(f.msg.from, f.msg.to) && nodes.current[f.msg.from].alive) deliver(f.msg, t);
    }
    flights.current = pending.filter((f) => canTalk(f.msg.from, f.msg.to));
    for (const n of nodes.current) {
      if (!n.alive) continue;
      if (n.role === "leader") {
        if (t >= n.nextHb) sendAppends(n, t);
      } else if (t >= n.deadline) {
        n.role = "candidate";
        n.term += 1;
        n.votedFor = n.id;
        n.votes = new Set([n.id]);
        resetTimer(n, t);
        log(`⏰ S${n.id + 1} timed out → candidate for term ${n.term}`, C.compare);
        for (let p = 0; p < N; p++) if (p !== n.id) send({ kind: "vote", term: n.term, from: n.id, to: p, lastIndex: n.log.length, lastTerm: lastTerm(n) }, t);
      }
    }
  });

  function clientRequest() {
    // clients on either side of a partition talk to whichever node they believe is leader
    const leaders = nodes.current.filter((n) => n.alive && n.role === "leader");
    if (!leaders.length) {
      log("Client request rejected: no leader right now (election in progress).", C.bad);
      force((x) => x + 1);
      return;
    }
    for (const l of leaders) {
      const cmd = CMDS[cmdIdx.current++ % CMDS.length];
      l.log.push({ term: l.term, cmd });
      l.matchIndex[l.id] = l.log.length;
      log(`📝 Client → leader S${l.id + 1} (term ${l.term}): append "${cmd}" at #${l.log.length}, not yet committed`, C.active);
      sendAppends(l, now.current);
    }
    force((x) => x + 1);
  }

  function toggleNode(i: number) {
    const n = nodes.current[i];
    n.alive = !n.alive;
    if (n.alive) {
      n.role = "follower";
      resetTimer(n, now.current);
      log(`🔌 S${i + 1} restarts as a follower (its log survived on disk)`, C.sky);
    } else log(`💥 S${i + 1} crashed${n.role === "leader" ? " — it was the leader!" : ""}`, C.bad);
    force((x) => x + 1);
  }

  function reset() {
    nodes.current = fresh(now.current);
    flights.current = [];
    events.current = [];
    started.current = false;
    setPartitioned(false);
    force((x) => x + 1);
  }

  const t = now.current;
  const maxLog = Math.max(6, ...nodes.current.map((n) => n.log.length));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn tone="primary" onClick={clientRequest} disabled={!running}>
          📝 client write
        </SmallBtn>
        <SmallBtn
          tone={partitioned ? "danger" : "default"}
          onClick={() => {
            setPartitioned((p) => !p);
            log(partitioned ? "🩹 Partition healed" : "✂️ Network partition: {S1, S2} | {S3, S4, S5}", partitioned ? C.done : C.bad);
          }}
          disabled={!running}
        >
          {partitioned ? "heal partition" : "✂️ partition network"}
        </SmallBtn>
        <SmallBtn onClick={reset}>reset</SmallBtn>
        <span className="text-xs text-faint">Click a server to crash / restart it.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
          <svg viewBox="0 0 520 430" className="block w-full">
            {partitioned && <line x1={150} y1={0} x2={330} y2={430} stroke={C.bad} strokeWidth={2} strokeDasharray="8 6" opacity={0.7} />}
            {POS.map((a, i) =>
              POS.map((b, j) => (j > i ? <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e2e8f0" strokeWidth={1} /> : null)),
            )}
            {flights.current.map((f) => {
              const a = POS[f.msg.from];
              const b = POS[f.msg.to];
              const p = Math.min(1, Math.max(0, (t - f.sent) / (f.arrive - f.sent)));
              const color =
                f.msg.kind === "vote" ? C.compare : f.msg.kind === "voteResp" ? (f.msg.granted ? C.done : C.bad) : f.msg.kind === "append" ? (f.msg.entries.length ? C.active : "#7dd3fc") : f.msg.success ? "#6ee7b7" : C.bad;
              const r = f.msg.kind === "append" && f.msg.entries.length ? 6 : 4;
              return <circle key={f.id} cx={a.x + (b.x - a.x) * p} cy={a.y + (b.y - a.y) * p} r={r} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
            })}
            {nodes.current.map((n, i) => {
              const p = POS[i];
              const color = !n.alive ? "#fecdd3" : n.role === "leader" ? C.done : n.role === "candidate" ? C.compare : C.sky;
              const frac = n.role === "leader" || !n.alive ? 0 : Math.max(0, Math.min(1, (n.deadline - t) / n.timeout));
              const R = 34;
              const circ = 2 * Math.PI * (R + 7);
              return (
                <g key={i} onClick={() => toggleNode(i)} className="cursor-pointer">
                  {n.alive && n.role !== "leader" && (
                    <circle cx={p.x} cy={p.y} r={R + 7} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={3} strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${p.x} ${p.y})`} />
                  )}
                  <circle cx={p.x} cy={p.y} r={R} fill={`${color}22`} stroke={color} strokeWidth={n.role === "leader" ? 4 : 2.5} style={n.role === "leader" ? { filter: `drop-shadow(0 0 12px ${C.done})` } : undefined} />
                  <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="15" fontWeight="bold" fill={n.alive ? C.text : C.faint}>
                    {n.role === "leader" ? "👑" : ""}S{i + 1}
                  </text>
                  <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="10" fill={n.alive ? C.muted : C.bad} fontFamily="monospace">
                    {n.alive ? `term ${n.term}` : "DOWN"}
                  </text>
                  <text x={p.x} y={p.y + 25} textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace">
                    {n.alive ? n.role : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-faint">Event log</div>
          {events.current.length === 0 && <div className="text-xs text-dim">Press Run. Ring around a follower = time left before it gives up on the leader.</div>}
          {events.current.map((e, i) => (
            <div key={`${e.t}-${i}`} className={clsx("text-xs leading-snug", i === 0 && "animate-pop")} style={{ color: e.tone, opacity: 1 - i * 0.1 }}>
              {e.text}
            </div>
          ))}
          <div className="border-t border-line pt-2 text-[10px] leading-relaxed text-faint">
            <span style={{ color: C.compare }}>●</span> RequestVote <span style={{ color: C.done }}>●</span> vote granted <span style={{ color: C.bad }}>●</span> rejected{" "}
            <span style={{ color: C.active }}>●</span> AppendEntries (big = carries entries)
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-3 scrollbar-thin">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Replicated logs (color = term · bright = committed)</div>
        <table className="border-separate border-spacing-1 font-mono text-[10px]">
          <tbody>
            {nodes.current.map((n, i) => (
              <tr key={i}>
                <td className="pr-2 text-dim">S{i + 1}</td>
                {Array.from({ length: maxLog }, (_, k) => {
                  const e = n.log[k];
                  const committed = k < n.commit;
                  return (
                    <td
                      key={k}
                      className="h-8 w-12 rounded-md border text-center"
                      style={{
                        borderColor: e ? TERM_COLORS[e.term % TERM_COLORS.length] : C.dim,
                        background: e ? `${TERM_COLORS[e.term % TERM_COLORS.length]}${committed ? "55" : "1a"}` : "transparent",
                        color: e ? (committed ? C.text : C.muted) : C.faint,
                        opacity: n.alive ? 1 : 0.45,
                      }}
                      title={e ? `term ${e.term}` : ""}
                    >
                      {e ? e.cmd : k + 1}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-dim">
        Try: crash the leader and watch a new election; partition the network and send writes — the 2-node side can&apos;t commit anything (no majority), while the 3-node side elects a leader and keeps going. Heal it and the minority&apos;s
        uncommitted entries are overwritten.
      </p>
    </div>
  );
}
