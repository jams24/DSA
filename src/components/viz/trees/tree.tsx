"use client";

import { C } from "../kit";

export interface TNode {
  id: number;
  val: number | string;
  left: number | null;
  right: number | null;
}

export type TreeMap = Record<number, TNode>;

export function layout(nodes: TreeMap, root: number | null) {
  const pos: Record<number, { x: number; y: number }> = {};
  let i = 0;
  let depth = 0;
  const walk = (id: number | null, d: number) => {
    if (id === null || !nodes[id]) return;
    walk(nodes[id].left, d + 1);
    pos[id] = { x: i++, y: d };
    depth = Math.max(depth, d);
    walk(nodes[id].right, d + 1);
  };
  walk(root, 0);
  return { pos, count: i, depth };
}

export function height(nodes: TreeMap, id: number | null): number {
  if (id === null || !nodes[id]) return 0;
  return 1 + Math.max(height(nodes, nodes[id].left), height(nodes, nodes[id].right));
}

export function TreeSvg({
  nodes,
  root,
  hi = {},
  badges = {},
  edgeHi = {},
  minWidth = 420,
  r = 18,
}: {
  nodes: TreeMap;
  root: number | null;
  hi?: Record<number, string>;
  badges?: Record<number, string>;
  edgeHi?: Record<number, string>; // keyed by child id
  minWidth?: number;
  r?: number;
}) {
  const { pos, count, depth } = layout(nodes, root);
  const colW = 48;
  const W = Math.max(minWidth, count * colW + 40);
  const H = (depth + 1) * 70 + 30;
  const px = (id: number) => 20 + colW / 2 + pos[id].x * ((W - 40 - colW) / Math.max(1, count - 1 || 1));
  const py = (id: number) => 30 + pos[id].y * 70;
  const ids = Object.keys(pos).map(Number);

  return (
    <svg width={W} height={H} className="block">
      {ids.map((id) =>
        (["left", "right"] as const).map((side) => {
          const c = nodes[id][side];
          if (c === null || pos[c] === undefined) return null;
          const color = edgeHi[c];
          return (
            <line
              key={`${id}-${side}`}
              x1={px(id)}
              y1={py(id)}
              x2={px(c)}
              y2={py(c)}
              stroke={color ?? C.base}
              strokeWidth={color ? 3 : 1.6}
              style={color ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
            />
          );
        }),
      )}
      {ids.map((id) => {
        const color = hi[id];
        return (
          <g key={id} style={{ transition: "all 0.3s" }}>
            <circle
              cx={px(id)}
              cy={py(id)}
              r={r}
              fill={color ? `${color}2e` : C.baseFill}
              stroke={color ?? C.base}
              strokeWidth={2}
              style={color ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
            />
            <text x={px(id)} y={py(id) + 4.5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={color ?? C.text} fontFamily="monospace">
              {nodes[id].val}
            </text>
            {badges[id] && (
              <text x={px(id)} y={py(id) - r - 6} textAnchor="middle" fontSize="10" fill={C.compare} fontFamily="monospace">
                {badges[id]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Builds a BST by inserting values in order. */
export function bstFrom(values: number[]): { nodes: TreeMap; root: number | null } {
  const nodes: TreeMap = {};
  let root: number | null = null;
  let id = 1;
  for (const v of values) {
    const n: TNode = { id: id++, val: v, left: null, right: null };
    nodes[n.id] = n;
    if (root === null) {
      root = n.id;
      continue;
    }
    let cur = root;
    for (;;) {
      const c = nodes[cur];
      if (v < (c.val as number)) {
        if (c.left === null) {
          c.left = n.id;
          break;
        }
        cur = c.left;
      } else {
        if (c.right === null) {
          c.right = n.id;
          break;
        }
        cur = c.right;
      }
    }
  }
  return { nodes, root };
}

export function cloneTree(nodes: TreeMap): TreeMap {
  return Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, { ...v }]));
}
