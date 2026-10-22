"use client";

import { useState } from "react";
import { C, Narration, SmallBtn } from "../kit";

const P = 3;
const LANE_Y = [60, 150, 240];
const NAMES = ["P1", "P2", "P3"];
const LANE_C = [C.sky, C.swap, C.lime];

interface Ev {
  id: number;
  p: number;
  kind: "local" | "send" | "recv";
  lamport: number;
  vc: number[];
  from?: number; // send event id for receives
}

function happenedBefore(a: number[], b: number[]) {
  return a.every((x, i) => x <= b[i]) && a.some((x, i) => x < b[i]);
}

const EXAMPLE: [string, number, number?][] = [
  ["local", 0],
  ["send", 0, 1],
  ["local", 2],
  ["local", 1],
  ["send", 1, 2],
  ["send", 2, 0],
  ["local", 0],
  ["local", 1],
];

export default function Clocks() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [sel, setSel] = useState<number[]>([]);

  function apply(list: Ev[], kind: "local" | "send", p: number, to?: number): Ev[] {
    const last = (q: number) => [...list].reverse().find((e) => e.p === q);
    const prev = last(p);
    const L = (prev?.lamport ?? 0) + 1;
    const vc = [...(prev?.vc ?? Array(P).fill(0))];
    vc[p]++;
    const id = list.length;
    const e: Ev = { id, p, kind, lamport: L, vc };
    const out = [...list, e];
    if (kind === "send" && to !== undefined) {
      const rp = last(to);
      const rvc = (rp?.vc ?? Array(P).fill(0)).map((x, i) => Math.max(x, vc[i]));
      rvc[to]++;
      out.push({ id: id + 1, p: to, kind: "recv", lamport: Math.max(rp?.lamport ?? 0, L) + 1, vc: rvc, from: id });
    }
    return out;
  }

  const add = (kind: "local" | "send", p: number, to?: number) => {
    setEvents((list) => apply(list, kind, p, to));
    setSel([]);
  };

  const loadExample = () => {
    let list: Ev[] = [];
    for (const [k, p, to] of EXAMPLE) list = apply(list, k as "local" | "send", p, to);
    setEvents(list);
    setSel([]);
  };

  const toggleSel = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));

  const X = (id: number) => 50 + id * 62;
  const W = Math.max(560, X(events.length) + 40);

  let relation = "Pick two events (click them) to compare their clocks.";
  let tone: "info" | "good" | "bad" | "warn" = "info";
  if (sel.length === 2) {
    const [a, b] = sel.map((i) => events[i]);
    const name = (e: Ev) => `${NAMES[e.p]}·e${e.id + 1}`;
    if (happenedBefore(a.vc, b.vc)) {
      relation = `${name(a)} → ${name(b)}: a happened before b (every vector entry ≤, at least one <). Lamport agrees: ${a.lamport} < ${b.lamport}.`;
      tone = "good";
    } else if (happenedBefore(b.vc, a.vc)) {
      relation = `${name(b)} → ${name(a)}: b happened before a. Lamport agrees: ${b.lamport} < ${a.lamport}.`;
      tone = "good";
    } else {
      relation = `${name(a)} ∥ ${name(b)}: CONCURRENT — neither vector dominates. Lamport still orders them (${a.lamport} vs ${b.lamport}), which is why Lamport clocks can't detect concurrency.`;
      tone = "warn";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {NAMES.map((n, p) => (
          <SmallBtn key={n} onClick={() => add("local", p)}>
            {n} local event
          </SmallBtn>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {NAMES.flatMap((n, p) =>
          NAMES.map((m, q) =>
            p === q ? null : (
              <SmallBtn key={`${p}${q}`} tone="primary" onClick={() => add("send", p, q)}>
                {n} ✉ {m}
              </SmallBtn>
            ),
          ),
        )}
        <SmallBtn tone="good" onClick={loadExample}>
          load example
        </SmallBtn>
        <SmallBtn tone="danger" onClick={() => setEvents([])}>
          clear
        </SmallBtn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] scrollbar-thin">
        <svg width={W} height={300} className="block">
          <defs>
            <marker id="clk-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {LANE_Y.map((y, p) => (
            <g key={p}>
              <line x1={30} y1={y} x2={W - 10} y2={y} stroke={LANE_C[p]} strokeOpacity={0.35} strokeWidth={2} />
              <text x={8} y={y + 4} fontSize="12" fontWeight="bold" fill={LANE_C[p]}>
                {NAMES[p]}
              </text>
            </g>
          ))}
          {events
            .filter((e) => e.kind === "recv")
            .map((e) => {
              const s = events[e.from!];
              return <line key={`m${e.id}`} x1={X(s.id)} y1={LANE_Y[s.p]} x2={X(e.id) - 6} y2={LANE_Y[e.p] + (LANE_Y[e.p] > LANE_Y[s.p] ? -10 : 10)} stroke={C.muted} strokeWidth={1.5} markerEnd="url(#clk-arrow)" />;
            })}
          {events.map((e) => {
            const on = sel.includes(e.id);
            const color = on ? C.compare : LANE_C[e.p];
            return (
              <g key={e.id} onClick={() => toggleSel(e.id)} className="cursor-pointer">
                <circle cx={X(e.id)} cy={LANE_Y[e.p]} r={on ? 10 : 8} fill={e.kind === "local" ? "#ffffff" : color} stroke={color} strokeWidth={2.5} />
                <text x={X(e.id)} y={LANE_Y[e.p] - 16} textAnchor="middle" fontSize="10" fill={C.text} fontFamily="monospace">
                  L{e.lamport}
                </text>
                <text x={X(e.id)} y={LANE_Y[e.p] + 24} textAnchor="middle" fontSize="9.5" fill={on ? C.compare : C.muted} fontFamily="monospace">
                  [{e.vc.join(",")}]
                </text>
              </g>
            );
          })}
          {!events.length && (
            <text x={60} y={290} fontSize="12" fill={C.faint}>
              Add events with the buttons above — or load the example.
            </text>
          )}
        </svg>
      </div>
      <Narration tone={tone}>{relation}</Narration>
      <div className="grid gap-2 text-xs text-dim sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-3">
          <b className="text-ink">Lamport clock</b> (L): local/send → L+1; receive → max(local, message) + 1. Gives a total order consistent with causality, but L(a) &lt; L(b) does <i>not</i> prove a caused b.
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <b className="text-ink">Vector clock</b> [P1,P2,P3]: increment your own slot; on receive take the element-wise max, then increment. a → b iff a ≤ b everywhere and differs somewhere; otherwise concurrent.
        </div>
      </div>
    </div>
  );
}
