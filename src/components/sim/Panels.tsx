"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { ArrayPanel, GraphPanel, GridPanel, LinePanel, ListPanel, MapPanel, OutPanel, Panel, StackPanel, Tone, TreeNode, TreePanel, VarsPanel } from "@/lib/sim/types";
import { C } from "@/components/viz/kit";

export const TONE: Record<Tone, string> = {
  cur: C.active,
  cmp: C.compare,
  ok: C.done,
  bad: C.bad,
  alt: C.swap,
  pick: C.pivot,
  dim: C.base,
};

const PTR_COLORS = [C.active, C.compare, C.swap, C.pivot, C.done, C.orange, C.sky];

function cellStyle(tone?: Tone) {
  if (!tone) return { borderColor: C.base, background: "#ffffff", color: C.text };
  if (tone === "dim") return { borderColor: C.dim, background: C.baseFill, color: C.faint };
  const c = TONE[tone];
  return { borderColor: c, background: `${c}1f`, color: C.text, boxShadow: `0 0 0 1px ${c}55` };
}

const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "T" : "F") : String(v));

function Frame({ label, children, wide }: { label?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={clsx("min-w-0 rounded-xl border border-line bg-[#f8fafd] p-3", wide ? "basis-full" : "flex-auto")}>
      {label && <div className="mb-2 text-[11px] font-semibold tracking-wide text-faint uppercase">{label}</div>}
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ arrays

function ArrayView({ p }: { p: ArrayPanel }) {
  const n = p.items.length;
  const w = n > 20 ? 28 : n > 14 ? 34 : 40;
  const gap = 4;
  const step = w + gap;
  const ptrs = Object.entries(p.ptrs ?? {}).filter(([, i]) => i >= 0 && i < n);
  const stackAt: Record<number, number> = {};
  const placed = ptrs.map(([name, i], k) => ({ name, i, k, row: (stackAt[i] = (stackAt[i] ?? -1) + 1) }));
  const ptrRows = Math.max(0, ...placed.map((x) => x.row + 1));
  const nums = p.items.map((v) => (typeof v === "number" ? v : 0));
  const max = Math.max(1, ...nums, ...(p.water ?? []));
  const barH = 120;
  const bodyH = p.bars ? barH + 18 : w;

  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      <div className="relative" style={{ width: Math.max(n * step - gap, 40), minHeight: 16 + bodyH + ptrRows * 17 + 4 }}>
        <div className="flex" style={{ gap }}>
          {p.items.map((_, i) => (
            <span key={i} className="text-center font-mono text-[10px] text-faint" style={{ width: w }}>
              {i}
            </span>
          ))}
        </div>
        {p.bars ? (
          <div className="flex items-end" style={{ gap, height: barH }}>
            {p.items.map((v, i) => {
              const h = (nums[i] / max) * (barH - 4);
              const wl = p.water?.[i] ?? 0;
              const wh = Math.max(0, ((wl - nums[i]) / max) * (barH - 4));
              const st = cellStyle(p.tones?.[i]);
              return (
                <div key={i} className="flex flex-col justify-end" style={{ width: w, height: barH }}>
                  {wh > 0 && <div className="rounded-t-sm transition-all duration-300" style={{ height: wh, background: "#38bdf8aa" }} />}
                  <div className="rounded-t-md border-2 transition-all duration-300" style={{ height: Math.max(h, 3), ...st, background: p.tones?.[i] ? st.background : "#e2e8f0" }} title={show(v)} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex" style={{ gap }}>
            {p.items.map((v, i) => (
              <div
                key={i}
                className="grid place-items-center rounded-lg border-2 font-mono text-[13px] font-semibold transition-colors duration-300"
                style={{ width: w, height: w, ...cellStyle(p.tones?.[i]), fontSize: show(v).length > 3 ? 10 : undefined }}
              >
                {show(v)}
              </div>
            ))}
          </div>
        )}
        {p.bars && (
          <div className="flex" style={{ gap }}>
            {p.items.map((v, i) => (
              <span key={i} className="text-center font-mono text-[11px] text-dim" style={{ width: w }}>
                {show(v)}
              </span>
            ))}
          </div>
        )}
        {p.win && p.win[1] >= p.win[0] && (
          <div
            className="pointer-events-none absolute rounded-xl border-2 border-dashed transition-all duration-300"
            style={{ borderColor: C.active, left: p.win[0] * step - 3, width: (p.win[1] - p.win[0] + 1) * step - gap + 6, top: 13, height: (p.bars ? barH : w) + 6, background: `${C.active}0d` }}
          />
        )}
        {placed.map(({ name, i, k, row }) => (
          <span
            key={name}
            className="absolute -translate-x-1/2 font-mono text-[11px] font-bold whitespace-nowrap transition-all duration-300"
            style={{ left: i * step + w / 2, top: 16 + bodyH + 3 + row * 17, color: PTR_COLORS[k % PTR_COLORS.length] }}
          >
            ▲{name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ small panels

function VarsView({ p }: { p: VarsPanel }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(p.vars).map(([k, v]) => (
        <span
          key={k}
          className={clsx(
            "inline-flex items-baseline gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs transition-colors",
            p.hi?.includes(k) ? "border-amber/60 bg-amber/10" : "border-line-2 bg-panel",
          )}
        >
          <span className="text-faint">{k}</span>
          <span className="font-semibold text-ink">{v === null ? "null" : typeof v === "boolean" ? String(v) : v}</span>
        </span>
      ))}
    </div>
  );
}

function MapView({ p }: { p: MapPanel }) {
  if (!p.entries.length) return <div className="font-mono text-xs text-faint">∅ empty</div>;
  return (
    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
      {p.entries.map(([k, v], i) => (
        <span
          key={`${k}-${i}`}
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs transition-colors",
            p.hi?.includes(k) ? "border-amber/70 bg-amber/15" : "border-line-2 bg-panel",
          )}
        >
          <span className="font-semibold text-ink">{k}</span>
          {v !== "" && (
            <>
              <span className="text-faint">→</span>
              <span className="text-dim">{v}</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function StackView({ p }: { p: StackPanel }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
      <span className="shrink-0 text-[10px] text-faint uppercase">{p.queue ? "front" : "bottom"}</span>
      {p.items.length === 0 && <span className="font-mono text-xs text-faint">∅ empty</span>}
      {p.items.map((it, i) => {
        const top = p.queue ? i === 0 : i === p.items.length - 1;
        return (
          <span
            key={i}
            className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border-2 px-2 font-mono text-xs font-semibold transition-colors"
            style={cellStyle(p.hi?.includes(i) ? "ok" : top ? "cur" : undefined)}
          >
            {it}
          </span>
        );
      })}
      {p.items.length > 0 && <span className="shrink-0 text-[10px] text-faint uppercase">{p.queue ? "back" : "← top"}</span>}
    </div>
  );
}

function OutView({ p }: { p: OutPanel }) {
  if (!p.items.length) return <div className="font-mono text-xs text-faint">nothing yet</div>;
  return (
    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
      {p.items.map((it, i) => (
        <span key={i} className="rounded-lg border px-2 py-1 font-mono text-xs font-semibold text-ink" style={cellStyle(p.hi?.includes(i) ? "ok" : undefined)}>
          {it}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ grid

function GridView({ p }: { p: GridPanel }) {
  const R = p.cells.length;
  const Cn = Math.max(0, ...p.cells.map((r) => r.length));
  const w = Cn > 12 ? 26 : Cn > 8 ? 30 : 36;
  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        {p.cols && (
          <thead>
            <tr>
              {p.rows && <th />}
              {p.cols.map((c, j) => (
                <th key={j} className="font-mono text-[11px] font-medium text-faint" style={{ width: w }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: R }, (_, r) => (
            <tr key={r}>
              {p.rows && <th className="pr-1 text-right font-mono text-[11px] font-medium whitespace-nowrap text-faint">{p.rows[r]}</th>}
              {Array.from({ length: Cn }, (_, c) => {
                const v = p.cells[r][c];
                return (
                  <td
                    key={c}
                    className="rounded-md border-2 text-center font-mono font-semibold transition-colors duration-300"
                    style={{ width: w, height: w, minWidth: w, fontSize: show(v).length > 3 ? 9 : 12, ...cellStyle(p.tones?.[`${r},${c}`]) }}
                  >
                    {show(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ trees

function TreeView({ p }: { p: TreePanel }) {
  if (!p.root) return <div className="font-mono text-xs text-faint">empty tree</div>;
  const pos = new Map<TreeNode, { x: number; y: number }>();
  const all: TreeNode[] = [];
  let x = 0;
  let depth = 0;
  let maxLabel = 1;
  const visit = (n: TreeNode, d: number) => {
    all.push(n);
    depth = Math.max(depth, d);
    maxLabel = Math.max(maxLabel, n.label.length);
  };
  if (p.binary) {
    const walk = (n: TreeNode | null, d: number) => {
      if (!n) return;
      visit(n, d);
      walk(n.kids[0] ?? null, d + 1);
      pos.set(n, { x: x++, y: d });
      walk(n.kids[1] ?? null, d + 1);
    };
    walk(p.root, 0);
  } else {
    const walk = (n: TreeNode, d: number): number => {
      visit(n, d);
      const kids = n.kids.filter((k): k is TreeNode => !!k);
      const xs = kids.map((k) => walk(k, d + 1));
      const at = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : x++;
      pos.set(n, { x: at, y: d });
      return at;
    };
    walk(p.root, 0);
  }
  const nodeW = Math.max(32, maxLabel * 7.4 + 14);
  const slot = nodeW + (p.binary ? 8 : 6);
  const cols = Math.max(1, ...[...pos.values()].map((v) => v.x + 1));
  const W = cols * slot + 16;
  const lvl = 62;
  const H = (depth + 1) * lvl + 10;
  const px = (n: TreeNode) => 8 + slot / 2 + pos.get(n)!.x * slot;
  const py = (n: TreeNode) => 22 + pos.get(n)!.y * lvl;

  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      <svg width={W} height={H} className="mx-auto block">
        {all.map((n) =>
          n.kids.map((k) => {
            if (!k || !pos.has(k)) return null;
            const c = k.tone && k.tone !== "dim" && n.tone && n.tone !== "dim" ? TONE[k.tone] : C.base;
            return <line key={`${n.id}-${k.id}`} x1={px(n)} y1={py(n)} x2={px(k)} y2={py(k)} stroke={c} strokeWidth={c === C.base ? 1.6 : 2.6} className="transition-all duration-300" />;
          }),
        )}
        {all.map((n) => {
          const st = cellStyle(n.tone);
          return (
            <g key={n.id} className="transition-all duration-300">
              <rect x={px(n) - nodeW / 2} y={py(n) - 15} width={nodeW} height={30} rx={15} fill={n.tone ? (n.tone === "dim" ? C.baseFill : `${TONE[n.tone]}26`) : "#ffffff"} stroke={st.borderColor} strokeWidth={2} />
              <text x={px(n)} y={py(n) + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fontFamily="var(--font-jbmono), monospace" fill={st.color}>
                {n.label}
              </text>
              {n.tag && (
                <text x={px(n)} y={py(n) + 29} textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily="var(--font-jbmono), monospace" fill={C.pivot}>
                  {n.tag}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ linked lists

function ListView({ p, uid }: { p: ListPanel; uid: string }) {
  const gapX = 74;
  const bw = 44;
  const cy = 46;
  const at = new Map(p.nodes.map((n, i) => [n.id, i]));
  const X = (i: number) => 14 + i * gapX + bw / 2;
  const ptrs = Object.entries(p.ptrs ?? {});
  const nullPtrs = ptrs.filter(([, v]) => v === null || !at.has(v));
  const live = ptrs.filter(([, v]) => v !== null && at.has(v));
  const stackAt: Record<string, number> = {};
  const W = Math.max(120, p.nodes.length * gapX + 30);
  const rows = Math.max(1, ...Object.values(live.reduce<Record<string, number>>((acc, [, v]) => ((acc[v!] = (acc[v!] ?? 0) + 1), acc), {})));
  const H = cy + 22 + 34 + rows * 15;
  const marker = `arrow-${uid}`;

  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      {p.nodes.length === 0 && <div className="font-mono text-xs text-faint">empty list</div>}
      {p.nodes.length > 0 && (
        <svg width={W} height={H} className="block">
          <defs>
            <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {p.nodes.map((n, i) => {
            if (n.next === null) {
              return (
                <text key={`n${n.id}`} x={X(i) + bw / 2 + 6} y={cy - 12} fontSize="10" fill={C.faint} fontFamily="monospace">
                  ∅
                </text>
              );
            }
            const j = at.get(n.next)!;
            if (j === i + 1 || j === i - 1) {
              const dir = j - i;
              return <line key={`n${n.id}`} x1={X(i) + (dir * bw) / 2} y1={cy} x2={X(j) - (dir * bw) / 2 - dir * 2} y2={cy} stroke={C.muted} strokeWidth={1.6} markerEnd={`url(#${marker})`} />;
            }
            const up = j > i;
            const h = 16 + Math.min(Math.abs(j - i), 6) * 4;
            const y0 = up ? cy - 16 : cy + 16;
            return <path key={`n${n.id}`} d={`M${X(i)},${y0} C${X(i)},${up ? y0 - h : y0 + h} ${X(j)},${up ? y0 - h : y0 + h} ${X(j)},${y0 + (up ? -2 : 2)}`} fill="none" stroke={C.muted} strokeWidth={1.6} markerEnd={`url(#${marker})`} />;
          })}
          {p.nodes.map((n, i) => {
            if (!n.rand) return null;
            const j = at.get(n.rand);
            if (j === undefined) return null;
            const h = 24 + Math.abs(j - i) * 3;
            return <path key={`r${n.id}`} d={`M${X(i) + 6},${cy + 16} C${X(i) + 6},${cy + 16 + h} ${X(j) - 6},${cy + 16 + h} ${X(j) - 6},${cy + 18}`} fill="none" stroke={C.pivot} strokeDasharray="4 3" strokeWidth={1.3} markerEnd={`url(#${marker})`} />;
          })}
          {p.nodes.map((n, i) => {
            const st = cellStyle(n.tone);
            return (
              <g key={n.id}>
                <rect x={X(i) - bw / 2} y={cy - 16} width={bw} height={32} rx={9} fill={n.tone ? (n.tone === "dim" ? C.baseFill : `${TONE[n.tone]}26`) : "#ffffff"} stroke={st.borderColor} strokeWidth={2} className="transition-all duration-300" />
                <text x={X(i)} y={cy + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--font-jbmono), monospace" fill={st.color}>
                  {show(n.val)}
                </text>
              </g>
            );
          })}
          {live.map(([name, v], k) => {
            const row = (stackAt[v!] = (stackAt[v!] ?? -1) + 1);
            return (
              <text key={name} x={X(at.get(v!)!)} y={cy + 34 + (p.nodes.some((n) => n.rand) ? 22 : 0) + row * 15} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="var(--font-jbmono), monospace" fill={PTR_COLORS[ptrs.findIndex(([nm]) => nm === name) % PTR_COLORS.length]} className="transition-all duration-300">
                ▲{name}
              </text>
            );
          })}
          {nullPtrs.length > 0 && (
            <text x={10} y={H - 4} fontSize="10.5" fontFamily="var(--font-jbmono), monospace" fill={C.faint}>
              {nullPtrs.map(([k]) => k).join(", ")} → null
            </text>
          )}
        </svg>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ graphs

function GraphView({ p, uid }: { p: GraphPanel; uid: string }) {
  const n = p.nodes.length;
  const maxLabel = Math.max(1, ...p.nodes.map((x) => (x.label ?? x.id).length));
  const r = Math.max(16, maxLabel * 3.8 + 8);
  const R = Math.max(70, (n * (r * 2 + 18)) / (2 * Math.PI));
  const W = 2 * R + 2 * r + 60;
  const H = 2 * R + 2 * r + 40;
  const cx = W / 2;
  const cy = H / 2;
  const pos = new Map(p.nodes.map((nd, i) => [nd.id, { x: cx + R * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n)), y: cy + R * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n)) }]));
  const marker = `garrow-${uid}`;
  return (
    <div className="overflow-x-auto pb-1 scrollbar-thin">
      <svg width={W} height={H} className="mx-auto block">
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
          </marker>
        </defs>
        {p.edges.map((e, i) => {
          const a = pos.get(e.a);
          const b = pos.get(e.b);
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const c = e.tone ? TONE[e.tone] : C.base;
          const x1 = a.x + (dx / len) * r;
          const y1 = a.y + (dy / len) * r;
          const x2 = b.x - (dx / len) * (r + 2);
          const y2 = b.y - (dy / len) * (r + 2);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={e.tone ? 2.6 : 1.5} markerEnd={p.directed ? `url(#${marker})` : undefined} className="transition-all duration-300" />
              {e.label && (
                <text x={(x1 + x2) / 2 + (dy / len) * 9} y={(y1 + y2) / 2 - (dx / len) * 9 + 4} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.muted} fontFamily="var(--font-jbmono), monospace">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {p.nodes.map((nd) => {
          const q = pos.get(nd.id)!;
          const st = cellStyle(nd.tone);
          return (
            <g key={nd.id}>
              <circle cx={q.x} cy={q.y} r={r} fill={nd.tone ? (nd.tone === "dim" ? C.baseFill : `${TONE[nd.tone]}26`) : "#ffffff"} stroke={st.borderColor} strokeWidth={2} className="transition-all duration-300" />
              <text x={q.x} y={q.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill={st.color} fontFamily="var(--font-jbmono), monospace">
                {nd.label ?? nd.id}
              </text>
              {nd.tag && (
                <text x={q.x} y={q.y + r + 13} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={C.pivot} fontFamily="var(--font-jbmono), monospace">
                  {nd.tag}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ number line (intervals)

function LineView({ p }: { p: LinePanel }) {
  const xs = [...p.rows.flatMap((r) => r.items.flatMap((it) => [it.s, it.e])), ...(p.marks ?? []).map((m) => m.x)];
  const lo = Math.min(0, ...xs);
  const hi = Math.max(lo + 1, ...xs);
  const W = 560;
  const padL = 70;
  const padR = 16;
  const sx = (v: number) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const rowH = 26;
  const H = p.rows.length * rowH + 34;
  const span = hi - lo;
  const tick = span <= 24 ? 1 : span <= 60 ? 5 : Math.ceil(span / 10);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / tick) * tick; v <= hi; v += tick) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full max-w-[640px]">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={4} x2={sx(v)} y2={H - 22} stroke="#e2e8f0" strokeWidth={1} />
          <text x={sx(v)} y={H - 8} textAnchor="middle" fontSize="10" fill={C.faint} fontFamily="monospace">
            {v}
          </text>
        </g>
      ))}
      {p.rows.map((row, ri) => (
        <g key={ri}>
          <text x={4} y={ri * rowH + 22} fontSize="10.5" fontWeight="600" fill={C.muted}>
            {row.label}
          </text>
          {row.items.map((it, k) => {
            const c = it.tone ? TONE[it.tone] : C.muted;
            const x1 = sx(it.s);
            const w = Math.max(6, sx(it.e) - x1);
            return (
              <g key={k}>
                <rect x={x1} y={ri * rowH + 9} width={w} height={17} rx={5} fill={`${c}2e`} stroke={c} strokeWidth={1.6} className="transition-all duration-300" />
                {it.text && w > 26 && (
                  <text x={x1 + w / 2} y={ri * rowH + 21.5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={C.text} fontFamily="monospace">
                    {it.text}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
      {(p.marks ?? []).map((m, i) => {
        const c = m.tone ? TONE[m.tone] : C.bad;
        return (
          <g key={i}>
            <line x1={sx(m.x)} y1={2} x2={sx(m.x)} y2={H - 22} stroke={c} strokeWidth={2} strokeDasharray="4 3" />
            {m.text && (
              <text x={sx(m.x) + 3} y={10} fontSize="10" fontWeight="700" fill={c}>
                {m.text}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function PanelView({ p, uid }: { p: Panel; uid: string }) {
  switch (p.kind) {
    case "array":
      return (
        <Frame label={p.label} wide>
          <ArrayView p={p} />
        </Frame>
      );
    case "vars":
      return (
        <Frame>
          <VarsView p={p} />
        </Frame>
      );
    case "map":
      return (
        <Frame label={p.label}>
          <MapView p={p} />
        </Frame>
      );
    case "stack":
      return (
        <Frame label={p.label}>
          <StackView p={p} />
        </Frame>
      );
    case "out":
      return (
        <Frame label={p.label}>
          <OutView p={p} />
        </Frame>
      );
    case "grid":
      return (
        <Frame label={p.label}>
          <GridView p={p} />
        </Frame>
      );
    case "tree":
      return (
        <Frame label={p.label} wide>
          <TreeView p={p} />
        </Frame>
      );
    case "list":
      return (
        <Frame label={p.label} wide>
          <ListView p={p} uid={uid} />
        </Frame>
      );
    case "graph":
      return (
        <Frame label={p.label}>
          <GraphView p={p} uid={uid} />
        </Frame>
      );
    case "line":
      return (
        <Frame label={p.label} wide>
          <LineView p={p} />
        </Frame>
      );
  }
}
