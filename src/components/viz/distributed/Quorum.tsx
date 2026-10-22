"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Slider, SmallBtn, Stat } from "../kit";

interface Replica {
  version: number;
  value: string;
  up: boolean;
}

const VALUES = ["🍎", "🍌", "🍒", "🍇", "🥝", "🍑", "🍍", "🥥", "🍉", "🍋"];

export default function Quorum() {
  const [n, setN] = useState(5);
  const [w, setW] = useState(3);
  const [r, setR] = useState(3);
  const [readRepair, setReadRepair] = useState(true);
  const [reps, setReps] = useState<Replica[]>(() => Array.from({ length: 7 }, () => ({ version: 1, value: VALUES[0], up: true })));
  const [latest, setLatest] = useState(1);
  const [touched, setTouched] = useState<{ kind: "write" | "read"; ids: number[] } | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({ text: "N replicas hold a value with a version number. Write to W of them, read from R of them, and take the highest version.", tone: "info" });
  const [stats, setStats] = useState({ reads: 0, stale: 0, failed: 0 });

  const W = Math.min(w, n);
  const R = Math.min(r, n);
  const active = reps.slice(0, n);
  const alive = active.map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
  const pick = (k: number) => [...alive].sort(() => Math.random() - 0.5).slice(0, k);

  function write() {
    if (alive.length < W) {
      setMsg({ text: `Write FAILED: only ${alive.length} replicas reachable, need W = ${W}. (Sloppy quorums / hinted handoff would accept it on stand-in nodes.)`, tone: "bad" });
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setTouched(null);
      return;
    }
    const v = latest + 1;
    const ids = pick(W);
    setReps((all) => all.map((x, i) => (ids.includes(i) ? { ...x, version: v, value: VALUES[(v - 1) % VALUES.length] } : x)));
    setLatest(v);
    setTouched({ kind: "write", ids });
    setMsg({ text: `Wrote v${v} ${VALUES[(v - 1) % VALUES.length]} — acknowledged once ${W} replicas stored it. The other ${n - W} still hold old versions until anti-entropy catches up.`, tone: "info" });
  }

  function read() {
    if (alive.length < R) {
      setMsg({ text: `Read FAILED: only ${alive.length} replicas reachable, need R = ${R}.`, tone: "bad" });
      setStats((s) => ({ ...s, failed: s.failed + 1 }));
      setTouched(null);
      return;
    }
    const ids = pick(R);
    const best = ids.reduce((b, i) => (active[i].version > active[b].version ? i : b), ids[0]);
    const got = active[best];
    const fresh = got.version === latest;
    const staleOnes = ids.filter((i) => active[i].version < got.version);
    if (readRepair && staleOnes.length) setReps((all) => all.map((x, i) => (staleOnes.includes(i) ? { ...x, version: got.version, value: got.value } : x)));
    setTouched({ kind: "read", ids });
    setStats((s) => ({ reads: s.reads + 1, stale: s.stale + (fresh ? 0 : 1), failed: s.failed }));
    setMsg({
      text: fresh
        ? `Read ${R} replicas → newest is v${got.version} ${got.value}: the latest write ✓${readRepair && staleOnes.length ? ` Read repair updated ${staleOnes.length} stale replica(s).` : ""}`
        : `STALE READ: the ${R} replicas contacted only had up to v${got.version}, but v${latest} was acknowledged. R + W = ${R + W} ≤ N = ${n}, so the read and write sets didn't overlap.`,
      tone: fresh ? "good" : "bad",
    });
  }

  function antiEntropy() {
    setReps((all) => all.map((x, i) => (i < n && x.up ? { ...x, version: latest, value: VALUES[(latest - 1) % VALUES.length] } : x)));
    setTouched(null);
    setMsg({ text: "Anti-entropy (background Merkle-tree sync) brought every live replica up to date — eventual consistency.", tone: "good" });
  }

  const overlap = R + W > n;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-36">
          <Slider label="N replicas" value={n} min={3} max={7} onChange={setN} />
        </div>
        <div className="w-36">
          <Slider label="W (write quorum)" value={W} min={1} max={n} onChange={setW} />
        </div>
        <div className="w-36">
          <Slider label="R (read quorum)" value={R} min={1} max={n} onChange={setR} />
        </div>
        <label className="flex items-center gap-2 text-xs text-dim">
          <input type="checkbox" checked={readRepair} onChange={(e) => setReadRepair(e.target.checked)} />
          read repair
        </label>
      </div>
      <div className={clsx("inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-sm", overlap ? "border-emerald/50 bg-emerald/10 text-emerald" : "border-rose/50 bg-rose/10 text-rose")}>
        R + W = {R + W} {overlap ? ">" : "≤"} N = {n} → {overlap ? "every read overlaps the latest write" : "stale reads possible"}
      </div>
      <div className="flex flex-wrap gap-2">
        <SmallBtn tone="primary" onClick={write}>
          ✍️ write new value
        </SmallBtn>
        <SmallBtn tone="good" onClick={read}>
          👀 read
        </SmallBtn>
        <SmallBtn onClick={antiEntropy}>🔄 anti-entropy sync</SmallBtn>
      </div>

      <div className="flex flex-wrap justify-center gap-3 rounded-xl border border-line bg-[#080c19] p-5">
        {active.map((x, i) => {
          const hit = touched?.ids.includes(i);
          const color = !x.up ? C.bad : hit ? (touched!.kind === "write" ? C.active : C.done) : x.version === latest ? C.pivot : C.base;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setReps((all) => all.map((y, j) => (j === i ? { ...y, up: !y.up } : y)))}
              className="flex w-24 flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 transition"
              style={{ borderColor: color, background: `${color}14`, boxShadow: hit ? `0 0 16px ${color}66` : undefined, opacity: x.up ? 1 : 0.6 }}
            >
              <span className="text-3xl">{x.up ? x.value : "💥"}</span>
              <span className="font-mono text-xs" style={{ color: x.version === latest ? C.done : C.muted }}>
                v{x.version}
              </span>
              <span className="text-[10px] text-faint">replica {i + 1}</span>
            </button>
          );
        })}
      </div>
      <Narration tone={msg.tone}>{msg.text}</Narration>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="reads" value={stats.reads} />
        <Stat label="stale reads" value={stats.stale} color={stats.stale ? C.bad : C.done} />
        <Stat label="failed ops" value={stats.failed} color={stats.failed ? C.compare : C.text} />
      </div>
      <p className="text-xs text-faint">Click a replica to crash/revive it. Try N=5, W=1, R=1 (fast, often stale) vs W=3, R=3 (always fresh, tolerates 2 failures) vs W=5 (any single failure blocks writes).</p>
    </div>
  );
}
