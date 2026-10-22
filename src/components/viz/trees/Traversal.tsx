"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";
import { TreeSvg, bstFrom, type TreeMap } from "./tree";

type Order = "pre" | "in" | "post" | "level";

interface Frame {
  hi: Record<number, string>;
  out: (number | string)[];
  side: (number | string)[]; // stack (DFS) or queue (BFS) contents
  msg: string;
}

function framesFor(nodes: TreeMap, root: number | null, order: Order): Frame[] {
  const out: (number | string)[] = [];
  const fr: Frame[] = [];
  const done = new Set<number>();
  const hiBase = () => Object.fromEntries([...done].map((d) => [d, C.done]));

  if (order === "level") {
    const q: number[] = root !== null ? [root] : [];
    fr.push({ hi: {}, out: [], side: q.map((x) => nodes[x].val), msg: "Level order (BFS): start with the root in a queue." });
    let level = 0;
    while (q.length) {
      const size = q.length;
      fr.push({ hi: Object.fromEntries(q.map((x) => [x, C.pivot])), out: [...out], side: q.map((x) => nodes[x].val), msg: `Level ${level}: the queue holds exactly this level's ${size} node(s).` });
      for (let k = 0; k < size; k++) {
        const id = q.shift()!;
        done.add(id);
        out.push(nodes[id].val);
        const kids = [nodes[id].left, nodes[id].right].filter((c): c is number => c !== null);
        q.push(...kids);
        fr.push({ hi: { ...hiBase(), [id]: C.active }, out: [...out], side: q.map((x) => nodes[x].val), msg: `Dequeue ${nodes[id].val}, visit it, enqueue its children${kids.length ? ` (${kids.map((c) => nodes[c].val).join(", ")})` : " (none)"}.` });
      }
      level++;
    }
    fr.push({ hi: hiBase(), out: [...out], side: [], msg: `Done: ${out.join(" → ")}. O(n) time, O(width) queue space.` });
    return fr;
  }

  const stack: number[] = [];
  const name = { pre: "Preorder (node, left, right)", in: "Inorder (left, node, right)", post: "Postorder (left, right, node)" }[order];
  fr.push({ hi: {}, out: [], side: [], msg: `${name}. Recursion keeps the path from the root on the call stack.` });
  const visit = (id: number) => {
    done.add(id);
    out.push(nodes[id].val);
    fr.push({ hi: { ...hiBase(), [id]: C.active }, out: [...out], side: stack.map((x) => nodes[x].val), msg: `Visit ${nodes[id].val} → output it.` });
  };
  const dfs = (id: number | null) => {
    if (id === null) return;
    stack.push(id);
    fr.push({ hi: { ...hiBase(), ...Object.fromEntries(stack.map((s) => [s, C.compare])) }, out: [...out], side: stack.map((x) => nodes[x].val), msg: `Enter ${nodes[id].val}.` });
    if (order === "pre") visit(id);
    dfs(nodes[id].left);
    if (order === "in") visit(id);
    dfs(nodes[id].right);
    if (order === "post") visit(id);
    stack.pop();
  };
  dfs(root);
  const tip = order === "in" ? " On a BST, inorder gives sorted order!" : order === "post" ? " Postorder is how you delete a tree or compute subtree sizes." : " Preorder is how you serialize / copy a tree.";
  fr.push({ hi: hiBase(), out: [...out], side: [], msg: `Done: ${out.join(" → ")}.${tip}` });
  return fr;
}

const DEFAULT = [8, 4, 12, 2, 6, 10, 14, 1, 7];

export default function Traversal() {
  const [order, setOrder] = useState<Order>("in");
  const [values, setValues] = useState(DEFAULT);
  const { nodes, root } = useMemo(() => bstFrom(values), [values]);
  const frames = useMemo(() => framesFor(nodes, root, order), [nodes, root, order]);
  const s = useStepper(frames, 600);
  const f = s.frame;

  function shuffle() {
    const set = new Set<number>();
    while (set.size < 9) set.add(1 + Math.floor(Math.random() * 30));
    setValues([...set]);
  }

  return (
    <div className="space-y-4">
      <Segmented
        value={order}
        onChange={setOrder}
        options={[
          { value: "pre", label: "Preorder" },
          { value: "in", label: "Inorder" },
          { value: "post", label: "Postorder" },
          { value: "level", label: "Level order (BFS)" },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-2 scrollbar-thin">
        <TreeSvg nodes={nodes} root={root} hi={f.hi} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">Output</div>
          <div className="flex min-h-8 flex-wrap gap-1">
            {f.out.map((v, i) => (
              <span key={i} className="rounded-md border border-emerald/40 bg-emerald/10 px-2 py-1 font-mono text-xs text-emerald">
                {v}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-faint">{order === "level" ? "Queue (front → back)" : "Call stack (root → current)"}</div>
          <div className="flex min-h-8 flex-wrap gap-1">
            {f.side.map((v, i) => (
              <span key={i} className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: order === "level" ? C.pivot : C.compare, color: order === "level" ? C.pivot : C.compare }}>
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} onShuffle={shuffle} />
    </div>
  );
}
