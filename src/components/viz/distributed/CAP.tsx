"use client";

import { useState } from "react";
import { C, Narration, Segmented, SmallBtn } from "../kit";

type Mode = "cp" | "ap";
interface NodeState {
  value: string;
  version: number;
  writer: string;
}

const NODES = [
  { id: "A", x: 150, y: 90 },
  { id: "B", x: 150, y: 250 },
  { id: "C", x: 470, y: 170 },
];

export default function CAP() {
  const [mode, setMode] = useState<Mode>("cp");
  const [partition, setPartition] = useState(false);
  const [state, setState] = useState<NodeState[]>(() => NODES.map(() => ({ value: "🟦 blue", version: 1, writer: "init" })));
  const [log, setLog] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }[]>([{ text: "Three replicas of one value. Clients on the left talk to A, the client on the right talks to C.", tone: "info" }]);
  const [counter, setCounter] = useState(1);
  const colors = ["🟥 red", "🟩 green", "🟨 yellow", "🟪 purple", "🟧 orange"];

  const push = (text: string, tone: "info" | "good" | "bad" | "warn") => setLog((l) => [{ text, tone }, ...l].slice(0, 5));
  const reach = (i: number) => (partition ? (i === 2 ? [2] : [0, 1]) : [0, 1, 2]);

  function write(at: number) {
    const value = colors[counter % colors.length];
    const side = reach(at);
    if (mode === "cp" && side.length < 2) {
      push(`✗ Write at ${NODES[at].id} REJECTED: it can only reach ${side.length}/3 replicas, no majority. CP chooses consistency over availability.`, "bad");
      return;
    }
    const version = Math.max(...state.map((s) => s.version)) + 1;
    setCounter((c) => c + 1);
    setState((st) => st.map((s, i) => (side.includes(i) ? { value, version, writer: NODES[at].id } : s)));
    push(
      partition
        ? mode === "cp"
          ? `✓ Write ${value} at ${NODES[at].id} committed on the majority side (${side.map((i) => NODES[i].id).join(", ")}). C is cut off and won't serve stale data.`
          : `✓ Write ${value} accepted at ${NODES[at].id} on its side only. The replicas now DISAGREE — AP stays available but diverges.`
        : `✓ Write ${value} at ${NODES[at].id} replicated to all three nodes.`,
      partition && mode === "ap" ? "warn" : "good",
    );
  }

  function read(at: number) {
    const side = reach(at);
    if (mode === "cp" && side.length < 2) {
      push(`✗ Read at ${NODES[at].id} REJECTED (error / timeout): can't confirm it has the latest value without a majority.`, "bad");
      return;
    }
    const s = state[at];
    const newest = Math.max(...state.map((x) => x.version));
    push(s.version < newest ? `⚠ Read at ${NODES[at].id} returned ${s.value} (v${s.version}) — STALE. The latest is v${newest} on the other side.` : `✓ Read at ${NODES[at].id} returned ${s.value} (v${s.version}).`, s.version < newest ? "warn" : "good");
  }

  function heal() {
    setPartition(false);
    const winner = [...state].sort((a, b) => b.version - a.version)[0];
    const diverged = new Set(state.map((s) => s.value)).size > 1;
    setState((st) => st.map(() => ({ ...winner })));
    push(diverged ? `🩹 Healed. Replicas disagreed → last-write-wins keeps ${winner.value} (v${winner.version}); the other side's write is LOST. (CRDTs or app-level merges avoid that.)` : "🩹 Healed. Replicas already agree.", diverged ? "warn" : "good");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "cp", label: "CP (consistency)" },
            { value: "ap", label: "AP (availability)" },
          ]}
        />
        {partition ? (
          <SmallBtn tone="good" onClick={heal}>
            🩹 heal partition
          </SmallBtn>
        ) : (
          <SmallBtn
            tone="danger"
            onClick={() => {
              setPartition(true);
              push("✂️ Network partition! {A, B} can't talk to {C}.", "bad");
            }}
          >
            ✂️ cut the network
          </SmallBtn>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-line bg-[#080c19]">
          <svg viewBox="0 0 620 340" className="block w-full">
            {[
              [0, 1],
              [0, 2],
              [1, 2],
            ].map(([a, b]) => {
              const cut = partition && (a === 2 || b === 2);
              return <line key={`${a}${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke={cut ? C.bad : "#2a355d"} strokeWidth={cut ? 2 : 2.5} strokeDasharray={cut ? "6 6" : undefined} opacity={cut ? 0.6 : 1} />;
            })}
            {partition && (
              <g>
                <line x1={330} y1={20} x2={300} y2={320} stroke={C.bad} strokeWidth={3} strokeDasharray="10 6" />
                <text x={318} y={18} fontSize="18">
                  ⚡
                </text>
              </g>
            )}
            {NODES.map((n, i) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={46} fill="#0f1529" stroke={C.pivot} strokeWidth={2.5} />
                <text x={n.x} y={n.y - 12} textAnchor="middle" fontSize="13" fontWeight="bold" fill={C.text}>
                  {n.id}
                </text>
                <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize="13" fill={C.text}>
                  {state[i].value}
                </text>
                <text x={n.x} y={n.y + 26} textAnchor="middle" fontSize="10" fill={C.muted} fontFamily="monospace">
                  v{state[i].version}
                </text>
              </g>
            ))}
            <text x={40} y={175} fontSize="26">
              🧑‍💻
            </text>
            <text x={560} y={180} fontSize="26">
              👩‍💻
            </text>
          </svg>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <SmallBtn tone="primary" onClick={() => write(0)}>
              write at A
            </SmallBtn>
            <SmallBtn tone="primary" onClick={() => write(2)}>
              write at C
            </SmallBtn>
            <SmallBtn onClick={() => read(0)}>read at A</SmallBtn>
            <SmallBtn onClick={() => read(2)}>read at C</SmallBtn>
          </div>
          <div className="space-y-1.5 rounded-xl border border-line bg-panel p-3">
            {log.map((l, i) => (
              <div key={i} className="text-xs leading-snug" style={{ color: l.tone === "bad" ? C.bad : l.tone === "warn" ? C.compare : l.tone === "good" ? C.done : C.muted, opacity: 1 - i * 0.15 }}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Narration tone={partition ? "warn" : "info"}>
        {partition
          ? mode === "cp"
            ? "CP: the majority side {A, B} keeps working; the minority (C) refuses requests rather than risk returning stale data. Think ZooKeeper, etcd, HBase, Spanner."
            : "AP: every node keeps answering, even with stale data, and both sides accept writes. Consistency is restored after healing. Think Cassandra, DynamoDB (default), Riak."
          : "No partition: the system can be both consistent and available. CAP only forces the choice WHILE the network is partitioned (and PACELC adds: otherwise you trade latency vs consistency)."}
      </Narration>
    </div>
  );
}
