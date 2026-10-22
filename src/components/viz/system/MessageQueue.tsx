"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, Slider, SmallBtn, useSimLoop } from "../kit";

const KEY_COLORS = ["#0891b2", "#db2777", "#65a30d", "#d97706", "#7c3aed", "#ea580c"];
const KEYS = ["alice", "bob", "carol", "dave", "erin", "frank"];
const SHOW = 22;

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

interface Partition {
  log: number[]; // key index per offset (we keep the tail only)
  base: number; // offset of log[0]
  end: number; // next offset to write
  committed: number;
}

export default function MessageQueue() {
  const [running, setRunning] = useState(false);
  const [P, setP] = useState(3);
  const [consumers, setConsumers] = useState(2);
  const [prodRate, setProdRate] = useState(8);
  const [consRate, setConsRate] = useState(3);
  const parts = useRef<Partition[]>(Array.from({ length: 3 }, () => ({ log: [], base: 0, end: 0, committed: 0 })));
  const prodAcc = useRef(0);
  const consAcc = useRef<number[]>([]);
  const rrCursor = useRef<number[]>([]);
  const [, force] = useState(0);

  // range assignor: contiguous blocks of partitions per consumer
  const assignment: number[][] = Array.from({ length: consumers }, () => []);
  for (let p = 0; p < P; p++) {
    const per = Math.floor(P / consumers);
    const extra = P % consumers;
    let c = 0;
    let start = 0;
    for (; c < consumers; c++) {
      const size = per + (c < extra ? 1 : 0);
      if (p < start + size) break;
      start += size;
    }
    if (c < consumers) assignment[c].push(p);
  }

  useSimLoop(running, (dt) => {
    prodAcc.current += (dt / 1000) * prodRate;
    while (prodAcc.current >= 1) {
      prodAcc.current -= 1;
      const k = Math.floor(Math.random() * KEYS.length);
      const p = parts.current[hash(KEYS[k]) % parts.current.length];
      p.log.push(k);
      p.end++;
      if (p.log.length > 400) {
        p.log.splice(0, 200);
        p.base += 200;
      }
    }
    assignment.forEach((ps, c) => {
      if (!ps.length) return;
      consAcc.current[c] = (consAcc.current[c] ?? 0) + (dt / 1000) * consRate;
      while (consAcc.current[c] >= 1) {
        consAcc.current[c] -= 1;
        // round-robin over this consumer's partitions that have backlog
        const cur = rrCursor.current[c] ?? 0;
        for (let k = 0; k < ps.length; k++) {
          const p = parts.current[ps[(cur + k) % ps.length]];
          if (p.committed < p.end) {
            p.committed++;
            rrCursor.current[c] = (cur + k + 1) % ps.length;
            break;
          }
        }
      }
    });
  });

  function resize(newP: number) {
    parts.current = Array.from({ length: newP }, () => ({ log: [], base: 0, end: 0, committed: 0 }));
    setP(newP);
    force((x) => x + 1);
  }

  const totalLag = parts.current.reduce((n, p) => n + (p.end - p.committed), 0);
  const idle = assignment.filter((a) => !a.length).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <div className="w-36">
          <Slider label="partitions" value={P} min={1} max={6} onChange={resize} />
        </div>
        <div className="w-36">
          <Slider label="consumers in group" value={consumers} min={1} max={6} onChange={setConsumers} />
        </div>
        <div className="w-40">
          <Slider label="produce msgs/s" value={prodRate} min={1} max={20} onChange={setProdRate} />
        </div>
        <div className="w-44">
          <Slider label="each consumer msgs/s" value={consRate} min={1} max={10} onChange={setConsRate} />
        </div>
        <SmallBtn onClick={() => resize(P)}>clear topic</SmallBtn>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_200px]">
        <div className="space-y-2 rounded-xl border border-line bg-[#f8fafd] p-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-faint">
            <span>topic “orders” — producer partitions by hash(user) mod {P}</span>
            <span>offset →</span>
          </div>
          {parts.current.map((p, i) => {
            const from = Math.max(p.base, p.end - SHOW);
            const lag = p.end - p.committed;
            const owner = assignment.findIndex((a) => a.includes(i));
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-[11px] text-dim">P{i}</span>
                <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden rounded-md bg-panel px-1">
                  {Array.from({ length: p.end - from }, (_, k) => {
                    const off = from + k;
                    const key = p.log[off - p.base];
                    const consumed = off < p.committed;
                    return (
                      <div
                        key={off}
                        className="h-6 w-3 shrink-0 rounded-[3px]"
                        style={{ background: KEY_COLORS[key], opacity: consumed ? 0.25 : 1, outline: off === p.committed ? `2px solid #0f172a` : undefined }}
                        title={`offset ${off} · ${KEYS[key]}`}
                      />
                    );
                  })}
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-[10px]" style={{ color: lag > 15 ? C.bad : lag > 5 ? C.compare : C.done }}>
                  lag {lag} {owner >= 0 ? `· C${owner + 1}` : "· —"}
                </span>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            {KEYS.map((k, i) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-dim">
                <span className="h-2 w-2 rounded-sm" style={{ background: KEY_COLORS[i] }} />
                {k} → P{hash(k) % P}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 rounded-xl border border-line bg-panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-faint">Consumer group</div>
          {assignment.map((ps, c) => (
            <div key={c} className="flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: ps.length ? `${C.pivot}66` : C.dim, opacity: ps.length ? 1 : 0.5 }}>
              <span className="text-ink">⚙️ C{c + 1}</span>
              <span className="font-mono text-[10px] text-dim">{ps.length ? ps.map((p) => `P${p}`).join(", ") : "idle"}</span>
            </div>
          ))}
        </div>
      </div>
      <Narration tone={totalLag > 30 ? "bad" : idle ? "warn" : "info"}>
        {idle
          ? `${idle} consumer(s) are idle: a partition is consumed by at most ONE consumer in a group, so parallelism is capped by the partition count.`
          : totalLag > 30
            ? `Lag is growing (${totalLag} unprocessed). Consumers can't keep up — add consumers (up to ${P}), add partitions, or make processing faster.`
            : `Messages with the same key always land in the same partition, so per-user order is preserved. Each consumer commits an offset (white outline) — the data stays in the log after it's read.`}
      </Narration>
    </div>
  );
}
