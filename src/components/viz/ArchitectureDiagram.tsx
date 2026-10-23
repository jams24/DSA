"use client";

import { useMemo, useState } from "react";
import type { ArchDiagram, ArchNode, ArchNodeKind } from "@/content/types";
import { C, Narration, Segmented, StepControls, useStepper } from "./kit";

const KIND: Record<ArchNodeKind, { icon: string; color: string }> = {
  client: { icon: "💻", color: C.sky },
  dns: { icon: "🧭", color: C.muted },
  cdn: { icon: "🌐", color: C.active },
  lb: { icon: "⚖️", color: C.compare },
  gateway: { icon: "🚪", color: C.compare },
  service: { icon: "⚙️", color: C.pivot },
  worker: { icon: "🛠️", color: C.pivot },
  cache: { icon: "⚡", color: C.orange },
  db: { icon: "🗄️", color: C.done },
  queue: { icon: "📬", color: C.swap },
  storage: { icon: "🪣", color: C.lime },
  search: { icon: "🔎", color: C.sky },
  gpu: { icon: "🧮", color: C.lime },
  external: { icon: "🌍", color: C.muted },
  model: { icon: "🧠", color: C.active },
  node: { icon: "🖥️", color: C.sky },
  control: { icon: "🎛️", color: C.pivot },
  monitor: { icon: "📈", color: C.done },
  registry: { icon: "📦", color: C.orange },
};

const NW = 140;
const NH = 60;

function clip(a: ArchNode, b: ArchNode) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(dx ? NW / 2 / Math.abs(dx) : Infinity, dy ? NH / 2 / Math.abs(dy) : Infinity);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

export default function ArchitectureDiagram({ diagram }: { diagram: ArchDiagram }) {
  const [flowIdx, setFlowIdx] = useState(0);
  const flow = diagram.flows[flowIdx];
  const byId = useMemo(() => new Map(diagram.nodes.map((n) => [n.id, n])), [diagram.nodes]);
  const frames = useMemo(() => (flow ? flow.path.map((_, i) => i) : [0]), [flow]);
  const s = useStepper(frames, 1300, false);
  const step = s.frame;

  const at = flow ? byId.get(flow.path[step]) : undefined;
  const prev = flow && step > 0 ? flow.path[step - 1] : null;
  const cur = flow ? flow.path[step] : null;
  const visited = new Set(flow ? flow.path.slice(0, step + 1) : []);
  const isHopEdge = (from: string, to: string) => !!prev && ((from === prev && to === cur) || (from === cur && to === prev));

  return (
    <div className="space-y-4">
      {diagram.flows.length > 1 && (
        <Segmented
          value={String(flowIdx)}
          onChange={(v) => setFlowIdx(Number(v))}
          options={diagram.flows.map((f, i) => ({ value: String(i), label: f.name }))}
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] scrollbar-thin">
        <svg viewBox="0 0 1000 560" className="block w-full min-w-[720px]">
          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.faint} />
            </marker>
            <marker id="arch-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.active} />
            </marker>
            <pattern id="arch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#0f172a" strokeOpacity="0.05" />
            </pattern>
          </defs>
          <rect width="1000" height="560" fill="url(#arch-grid)" />
          {diagram.edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const p1 = clip(a, b);
            const p2 = clip(b, a);
            const hot = isHopEdge(e.from, e.to);
            return (
              <g key={i}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={hot ? C.active : "#94a3b8"}
                  strokeWidth={hot ? 2.5 : 1.5}
                  strokeDasharray={e.dashed || hot ? "6 5" : undefined}
                  markerEnd={`url(#${hot ? "arch-arrow-hot" : "arch-arrow"})`}
                  className={hot ? "animate-dash" : undefined}
                  style={hot ? { filter: `drop-shadow(0 0 4px ${C.active})` } : undefined}
                />
                {e.label && (
                  <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 6} textAnchor="middle" fontSize="11" fill={hot ? C.active : C.faint}>
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {diagram.nodes.map((n) => {
            const k = KIND[n.kind];
            const active = n.id === cur;
            const seen = visited.has(n.id);
            return (
              <g key={n.id} transform={`translate(${n.x - NW / 2} ${n.y - NH / 2})`}>
                <rect
                  width={NW}
                  height={NH}
                  rx={14}
                  fill={active ? `${k.color}2e` : "#ffffff"}
                  stroke={active ? k.color : seen ? `${k.color}99` : "#cbd5e1"}
                  strokeWidth={active ? 2.5 : 1.5}
                  style={active ? { filter: `drop-shadow(0 0 10px ${k.color})` } : undefined}
                />
                <text x={22} y={37} fontSize="20" textAnchor="middle">
                  {k.icon}
                </text>
                <text x={40} y={n.sub ? 27 : 35} fontSize="13" fontWeight="600" fill={C.text}>
                  {n.label}
                </text>
                {n.sub && (
                  <text x={40} y={44} fontSize="10.5" fill={C.muted}>
                    {n.sub}
                  </text>
                )}
              </g>
            );
          })}
          {at && (
            <circle
              r={9}
              cx={0}
              cy={0}
              fill={C.active}
              style={{
                transform: `translate(${at.x + NW / 2 - 4}px, ${at.y - NH / 2 + 4}px)`,
                transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                filter: `drop-shadow(0 0 8px ${C.active})`,
              }}
            />
          )}
        </svg>
      </div>
      {flow && (
        <>
          <Narration>
            <span className="mr-2 font-pixel text-[9px] text-cyan">
              {step === 0 ? "START" : `HOP ${step}/${flow.path.length - 1}`}
            </span>
            {step === 0 ? `${flow.name}: press play to follow the request through the system.` : flow.steps[step - 1]}
          </Narration>
          <StepControls s={s} />
        </>
      )}
    </div>
  );
}
