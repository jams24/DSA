"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type Scenario = "2pc-ok" | "2pc-no" | "2pc-crash" | "saga-ok" | "saga-fail";

interface Frame {
  coord: string;
  parts: string[];
  msgs: { to: number; up?: boolean; label: string; color: string }[];
  msg: string;
  tone?: "info" | "good" | "bad" | "warn";
}

const PARTS = ["Orders DB", "Payments DB", "Inventory DB"];
const SAGA = ["Order service", "Payment service", "Inventory service"];

const STATE_COLOR = (s: string) =>
  s.includes("COMMIT") || s.includes("DONE") || s.includes("APPROVED") || s.includes("✓")
    ? C.done
    : s.includes("ABORT") || s.includes("FAIL") || s.includes("CANCEL") || s.includes("✗")
      ? C.bad
      : s.includes("PREPARED") || s.includes("PENDING") || s.includes("RESERVED") || s.includes("CHARGED")
        ? C.compare
        : s.includes("BLOCKED") || s.includes("CRASH") || s.includes("?")
          ? C.pivot
          : C.muted;

function build(sc: Scenario): Frame[] {
  const all = (label: string, color: string, up = false) => [0, 1, 2].map((to) => ({ to, label, color, up }));
  if (sc.startsWith("2pc")) {
    const fr: Frame[] = [
      { coord: "IDLE", parts: ["idle", "idle", "idle"], msgs: [], msg: "Two-phase commit: a coordinator makes three databases commit one transaction atomically — all or nothing." },
      { coord: "PREPARING", parts: ["idle", "idle", "idle"], msgs: all("PREPARE", C.active), msg: "Phase 1 (voting): coordinator writes 'begin' to its log and sends PREPARE to every participant." },
    ];
    if (sc === "2pc-no") {
      fr.push({ coord: "PREPARING", parts: ["PREPARED 🔒", "PREPARED 🔒", "✗ VOTE NO"], msgs: [0, 1, 2].map((to) => ({ to, up: true, label: to === 2 ? "NO" : "YES", color: to === 2 ? C.bad : C.done })), msg: "Orders and Payments durably prepare (locks held, ready to commit). Inventory is out of stock → votes NO.", tone: "bad" });
      fr.push({ coord: "ABORT", parts: ["PREPARED 🔒", "PREPARED 🔒", "ABORTED"], msgs: all("ABORT", C.bad), msg: "One NO is enough: the coordinator logs ABORT and tells everyone.", tone: "bad" });
      fr.push({ coord: "ABORTED", parts: ["ABORTED", "ABORTED", "ABORTED"], msgs: [], msg: "Everyone rolls back and releases locks. Atomicity preserved: nothing was charged or shipped.", tone: "good" });
      return fr;
    }
    fr.push({ coord: "PREPARING", parts: ["PREPARED 🔒", "PREPARED 🔒", "PREPARED 🔒"], msgs: [0, 1, 2].map((to) => ({ to, up: true, label: "YES", color: C.done })), msg: "Each participant writes its changes + a PREPARED record to its WAL, holds locks, and votes YES. A YES is a promise: 'I can commit no matter what'." });
    if (sc === "2pc-crash") {
      fr.push({ coord: "💥 CRASHED", parts: ["PREPARED 🔒", "PREPARED 🔒", "PREPARED 🔒"], msgs: [], msg: "The coordinator crashes before sending the decision.", tone: "bad" });
      fr.push({ coord: "💥 CRASHED", parts: ["BLOCKED ? 🔒", "BLOCKED ? 🔒", "BLOCKED ? 🔒"], msgs: [], msg: "Participants are stuck: they voted YES so they can't abort on their own (others may have committed), and they can't commit without the decision. Locks stay held — other transactions on these rows wait.", tone: "bad" });
      fr.push({ coord: "RECOVERING", parts: ["BLOCKED ? 🔒", "BLOCKED ? 🔒", "BLOCKED ? 🔒"], msgs: all("decision?", C.pivot), msg: "Only when the coordinator recovers (and reads its log) can it resend the decision. This blocking is 2PC's famous weakness — mitigated by replicating the coordinator with consensus (e.g. Spanner runs 2PC over Paxos groups).", tone: "warn" });
      fr.push({ coord: "COMMITTED", parts: ["COMMITTED", "COMMITTED", "COMMITTED"], msgs: all("COMMIT", C.done), msg: "Recovered coordinator found all YES votes logged → COMMIT. Correct, but everything was blocked meanwhile.", tone: "good" });
      return fr;
    }
    fr.push({ coord: "COMMIT", parts: ["PREPARED 🔒", "PREPARED 🔒", "PREPARED 🔒"], msgs: all("COMMIT", C.done), msg: "Phase 2 (decision): all YES → the coordinator durably logs COMMIT (the point of no return) and broadcasts it." });
    fr.push({ coord: "COMMITTED", parts: ["COMMITTED", "COMMITTED", "COMMITTED"], msgs: [0, 1, 2].map((to) => ({ to, up: true, label: "ack", color: C.muted })), msg: "Participants commit, release locks and ack. Cost: 2 round trips + forced log writes, and locks held across the network — fine inside one database cluster, painful across microservices.", tone: "good" });
    return fr;
  }
  const fr: Frame[] = [
    { coord: "START", parts: ["idle", "idle", "idle"], msgs: [], msg: "Saga: a sequence of LOCAL transactions, each in its own service and DB, coordinated by an orchestrator. No distributed locks." },
    { coord: "step 1", parts: ["order PENDING", "idle", "idle"], msgs: [{ to: 0, label: "CreateOrder", color: C.active }], msg: "T1: Order service creates the order in state PENDING and commits locally." },
    { coord: "step 2", parts: ["order PENDING", "idle", "items RESERVED"], msgs: [{ to: 2, label: "Reserve", color: C.active }], msg: "T2: Inventory reserves the items and commits locally." },
  ];
  if (sc === "saga-ok") {
    fr.push({ coord: "step 3", parts: ["order PENDING", "CHARGED", "items RESERVED"], msgs: [{ to: 1, label: "Charge", color: C.active }], msg: "T3: Payment charges the card (idempotency key = order id)." });
    fr.push({ coord: "DONE ✓", parts: ["order APPROVED ✓", "CHARGED ✓", "items SHIPPED ✓"], msgs: [{ to: 0, label: "Approve", color: C.done }], msg: "All steps succeeded → the order is APPROVED. Between steps, other readers could see intermediate states (no isolation) — design the UI and states for it.", tone: "good" });
    return fr;
  }
  fr.push({ coord: "step 3", parts: ["order PENDING", "✗ CARD DECLINED", "items RESERVED"], msgs: [{ to: 1, label: "Charge", color: C.active }], msg: "T3 fails: the card is declined. We can't roll back T1 and T2 — they already committed in other databases.", tone: "bad" });
  fr.push({ coord: "compensating", parts: ["order PENDING", "✗ CARD DECLINED", "items RELEASED"], msgs: [{ to: 2, label: "C2: Release", color: C.compare }], msg: "Run COMPENSATING transactions in reverse order. C2: release the reserved items.", tone: "warn" });
  fr.push({ coord: "compensated", parts: ["order CANCELLED", "✗ CARD DECLINED", "items RELEASED"], msgs: [{ to: 0, label: "C1: Cancel", color: C.compare }], msg: "C1: mark the order CANCELLED and notify the user. The system is consistent again — semantically undone, not rolled back. Compensations must be idempotent and retryable.", tone: "good" });
  return fr;
}

export default function TwoPhase() {
  const [sc, setSc] = useState<Scenario>("2pc-ok");
  const frames = useMemo(() => build(sc), [sc]);
  const s = useStepper(frames, 1600);
  const f = s.frame;
  const saga = sc.startsWith("saga");
  const names = saga ? SAGA : PARTS;
  const PX = [130, 330, 530];
  const coordColor = STATE_COLOR(f.coord);

  return (
    <div className="space-y-4">
      <Segmented
        value={sc}
        onChange={setSc}
        options={[
          { value: "2pc-ok", label: "2PC ✓" },
          { value: "2pc-no", label: "2PC: a NO vote" },
          { value: "2pc-crash", label: "2PC: coordinator crash" },
          { value: "saga-ok", label: "Saga ✓" },
          { value: "saga-fail", label: "Saga: payment fails" },
        ]}
      />
      <div className="rounded-xl border border-line bg-[#080c19]">
        <svg viewBox="0 0 660 330" className="block w-full">
          <defs>
            <marker id="tp-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {names.map((_, i) => (
            <line key={i} x1={330} y1={92} x2={PX[i]} y2={232} stroke="#1e2747" strokeWidth={2} />
          ))}
          {f.msgs.map((m, i) => {
            const x1 = m.up ? PX[m.to] : 330;
            const y1 = m.up ? 230 : 95;
            const x2 = m.up ? 330 : PX[m.to];
            const y2 = m.up ? 98 : 228;
            const mx = (x1 + x2) / 2 + (m.up ? 18 : -18);
            const my = (y1 + y2) / 2;
            return (
              <g key={`${s.i}-${i}`} className="animate-pop">
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={m.color} strokeWidth={2.5} markerEnd="url(#tp-arrow)" />
                <rect x={mx - 36} y={my - 10} width={72} height={20} rx={6} fill="#0c1121" stroke={m.color} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={m.color}>
                  {m.label}
                </text>
              </g>
            );
          })}
          <rect x={250} y={30} width={160} height={62} rx={14} fill={`${coordColor}1f`} stroke={coordColor} strokeWidth={2.5} />
          <text x={330} y={56} textAnchor="middle" fontSize="13" fontWeight="bold" fill={C.text}>
            {saga ? "🎼 Saga orchestrator" : "🧭 Coordinator"}
          </text>
          <text x={330} y={77} textAnchor="middle" fontSize="11" fill={coordColor} fontFamily="monospace">
            {f.coord}
          </text>
          {names.map((n, i) => {
            const color = STATE_COLOR(f.parts[i]);
            return (
              <g key={n}>
                <rect x={PX[i] - 85} y={232} width={170} height={66} rx={14} fill={`${color}1a`} stroke={color} strokeWidth={2} />
                <text x={PX[i]} y={258} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={C.text}>
                  {saga ? "⚙️" : "🗄️"} {n}
                </text>
                <text x={PX[i]} y={281} textAnchor="middle" fontSize="11" fill={color} fontFamily="monospace">
                  {f.parts[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
