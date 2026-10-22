"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, SmallBtn, Stat } from "../kit";

const COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706", "#ea580c", "#059669", "#0284c7"];
const KEYS = Array.from({ length: 36 }, (_, i) => `key${i + 1}`);
const SPACE = 2 ** 32;

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // final avalanche so similar strings spread around the ring
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

function ring(servers: number[], vnodes: number) {
  return servers
    .flatMap((s) => Array.from({ length: vnodes }, (_, v) => ({ pos: fnv(`server-${s}-vn${v}`), s })))
    .sort((a, b) => a.pos - b.pos);
}

function owner(r: { pos: number; s: number }[], h: number) {
  return (r.find((x) => x.pos >= h) ?? r[0]).s;
}

export default function ConsistentHash() {
  const [servers, setServers] = useState([0, 1, 2, 3]);
  const [prev, setPrev] = useState<number[] | null>(null);
  const [vnodes, setVnodes] = useState(1);
  const [hover, setHover] = useState<string | null>(null);

  const cur = useMemo(() => ring(servers, vnodes), [servers, vnodes]);
  const old = useMemo(() => (prev ? ring(prev, vnodes) : null), [prev, vnodes]);
  const keys = useMemo(() => KEYS.map((k) => ({ k, h: fnv(k) })), []);
  const own = keys.map((x) => owner(cur, x.h));
  const ownOld = old ? keys.map((x) => owner(old, x.h)) : null;
  const moved = ownOld ? own.filter((o, i) => o !== ownOld[i]).length : 0;
  const load = servers.map((s) => own.filter((o) => o === s).length);

  const CX = 230;
  const CY = 230;
  const R = 180;
  const pt = (h: number, r = R) => {
    const a = (h / SPACE) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };

  function add() {
    const next = [0, 1, 2, 3, 4, 5, 6, 7].find((x) => !servers.includes(x));
    if (next === undefined) return;
    setPrev(servers);
    setServers([...servers, next]);
  }
  function remove(s: number) {
    if (servers.length <= 1) return;
    setPrev(servers);
    setServers(servers.filter((x) => x !== s));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SmallBtn tone="primary" onClick={add} disabled={servers.length >= 8}>
          ➕ add server
        </SmallBtn>
        <span className="text-xs text-faint">click a server chip to remove it</span>
        <div className="flex flex-wrap gap-1.5">
          {servers.map((s) => (
            <button key={s} type="button" onClick={() => remove(s)} className="rounded-full border px-2.5 py-1 font-mono text-xs" style={{ borderColor: COLORS[s], color: COLORS[s], background: `${COLORS[s]}1a` }}>
              S{s + 1} ✕
            </button>
          ))}
        </div>
        <div className="w-56">
          <Slider
            label="virtual nodes per server"
            value={vnodes}
            min={1}
            max={40}
            onChange={(v) => {
              setVnodes(v);
              setPrev(null);
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[460px_1fr]">
        <div className="rounded-xl border border-line bg-[#f8fafd]">
          <svg viewBox="0 0 460 460" className="block w-full">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#cbd5e1" strokeWidth={10} />
            {cur.map((v, i) => {
              const next = cur[(i + 1) % cur.length];
              // arc from this vnode to the next is owned by `next`
              const a0 = (v.pos / SPACE) * 2 * Math.PI - Math.PI / 2;
              let a1 = (next.pos / SPACE) * 2 * Math.PI - Math.PI / 2;
              if (a1 <= a0) a1 += 2 * Math.PI;
              const large = a1 - a0 > Math.PI ? 1 : 0;
              const p0 = { x: CX + R * Math.cos(a0), y: CY + R * Math.sin(a0) };
              const p1 = { x: CX + R * Math.cos(a1), y: CY + R * Math.sin(a1) };
              return <path key={i} d={`M ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`} fill="none" stroke={COLORS[next.s]} strokeOpacity={0.35} strokeWidth={10} />;
            })}
            {keys.map((x, i) => {
              const p = pt(x.h, R - 26);
              const isMoved = ownOld && ownOld[i] !== own[i];
              return (
                <g key={x.k} onMouseEnter={() => setHover(x.k)} onMouseLeave={() => setHover(null)}>
                  <circle cx={p.x} cy={p.y} r={isMoved ? 6 : 4.5} fill={COLORS[own[i]]} stroke={isMoved ? "#0f172a" : "none"} strokeWidth={2} style={isMoved ? { filter: "drop-shadow(0 0 4px #0f172a66)" } : undefined} />
                </g>
              );
            })}
            {cur.map((v, i) => {
              const p = pt(v.pos);
              return <rect key={i} x={p.x - 6} y={p.y - 6} width={12} height={12} rx={3} fill={COLORS[v.s]} stroke="#f5f7fb" strokeWidth={2} transform={`rotate(45 ${p.x} ${p.y})`} />;
            })}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize="13" fill={C.text} fontWeight="600">
              hash ring 0 … 2³²
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" fontSize="11" fill={C.muted}>
              {hover ?? "◆ server · ● key"}
            </text>
          </svg>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-panel p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Keys per server ({KEYS.length} keys)</div>
            <div className="space-y-1.5">
              {servers.map((s, i) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-mono" style={{ color: COLORS[s] }}>
                    S{s + 1}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-line">
                    <div className="h-full rounded transition-all duration-500" style={{ width: `${(load[i] / KEYS.length) * 100}%`, background: COLORS[s] }} />
                  </div>
                  <span className="w-6 text-right font-mono text-dim">{load[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="keys moved last change" value={ownOld ? `${moved} (${Math.round((moved / KEYS.length) * 100)}%)` : "—"} color={C.compare} />
            <Stat label="max / ideal load" value={`${Math.max(...load)} / ${(KEYS.length / servers.length).toFixed(1)}`} color={Math.max(...load) > (KEYS.length / servers.length) * 1.6 ? C.bad : C.done} />
          </div>
          <Narration tone={ownOld ? "good" : "info"}>
            {ownOld
              ? `Only keys between the new/removed server and its predecessor moved (outlined in white). With mod-N hashing nearly every key would have moved.`
              : vnodes === 1
                ? "With one position per server the arcs are very uneven — some servers own far more of the ring. Slide virtual nodes up to smooth the load."
                : `${vnodes} virtual nodes per server: each server owns many small arcs, so load evens out and a failed server's keys spread across all survivors.`}
          </Narration>
        </div>
      </div>
    </div>
  );
}
