"use client";

import { useState } from "react";
import { C, Narration, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";
import { TreeSvg, bstFrom, cloneTree, height, type TreeMap } from "./tree";

interface Tree {
  nodes: TreeMap;
  root: number | null;
}

interface Frame extends Tree {
  hi: Record<number, string>;
  msg: string;
}

let nextId = 1000;

export default function BST() {
  const [tree, setTree] = useState<Tree>(() => bstFrom([50, 30, 70, 20, 40, 60, 80, 35, 65]));
  const [val, setVal] = useState("45");
  const [frames, setFrames] = useState<Frame[]>(() => [{ ...bstFrom([50, 30, 70, 20, 40, 60, 80, 35, 65]), hi: {}, msg: "Binary search tree: left subtree < node < right subtree, at every node." }]);
  const s = useStepper(frames, 700, true);

  function run(op: "insert" | "search" | "delete") {
    const v = Number(val);
    if (!Number.isFinite(v)) return;
    const nodes = cloneTree(tree.nodes);
    let root = tree.root;
    const fr: Frame[] = [];
    const snap = (hi: Record<number, string>, msg: string) => fr.push({ nodes: cloneTree(nodes), root, hi, msg });

    // walk down
    let parent: number | null = null;
    let cur = root;
    const path: number[] = [];
    while (cur !== null && nodes[cur].val !== v) {
      path.push(cur);
      const goLeft = v < (nodes[cur].val as number);
      snap(Object.fromEntries(path.map((p) => [p, p === cur ? C.compare : C.dim])), `${v} ${goLeft ? "<" : ">"} ${nodes[cur].val} → go ${goLeft ? "left" : "right"}.`);
      parent = cur;
      cur = goLeft ? nodes[cur].left : nodes[cur].right;
    }

    if (op === "search") {
      if (cur === null) snap({}, `Fell off the tree: ${v} is not present. Visited ${path.length} node(s) — O(height).`);
      else snap({ [cur]: C.done }, `Found ${v} after ${path.length + 1} comparisons. Search is O(h): O(log n) when balanced, O(n) when skewed.`);
    } else if (op === "insert") {
      if (cur !== null) snap({ [cur]: C.compare }, `${v} is already in the tree (no duplicates here).`);
      else {
        const id = nextId++;
        nodes[id] = { id, val: v, left: null, right: null };
        if (parent === null) root = id;
        else if (v < (nodes[parent].val as number)) nodes[parent].left = id;
        else nodes[parent].right = id;
        snap({ [id]: C.done }, `Empty spot found: attach ${v} as a new leaf${parent !== null ? ` (${v < (nodes[parent].val as number) ? "left" : "right"} child of ${nodes[parent].val})` : " (new root)"}.`);
      }
    } else {
      if (cur === null) snap({}, `${v} not found — nothing to delete.`);
      else {
        const node = nodes[cur];
        const replaceChild = (p: number | null, oldId: number, newId: number | null) => {
          if (p === null) root = newId;
          else if (nodes[p].left === oldId) nodes[p].left = newId;
          else nodes[p].right = newId;
        };
        if (node.left === null || node.right === null) {
          const child = node.left ?? node.right;
          snap({ [cur]: C.bad, ...(child !== null ? { [child]: C.active } : {}) }, child === null ? `Case 1: ${v} is a leaf → just remove it.` : `Case 2: ${v} has one child → splice the child into its place.`);
          replaceChild(parent, cur, child);
          delete nodes[cur];
          snap(child !== null ? { [child]: C.done } : {}, "Done. BST property preserved.");
        } else {
          snap({ [cur]: C.bad }, `Case 3: ${v} has two children. Replace it with its inorder successor (smallest value in the right subtree).`);
          let sp = cur;
          let succ = node.right;
          const sPath = [succ];
          snap({ [cur]: C.bad, [succ]: C.compare }, `Step right to ${nodes[succ].val}, then go left as far as possible…`);
          while (nodes[succ].left !== null) {
            sp = succ;
            succ = nodes[succ].left!;
            sPath.push(succ);
            snap({ [cur]: C.bad, [succ]: C.compare }, `…left to ${nodes[succ].val}.`);
          }
          snap({ [cur]: C.bad, [succ]: C.pivot }, `Successor is ${nodes[succ].val}. Copy it into the deleted node's slot.`);
          node.val = nodes[succ].val;
          const succRight = nodes[succ].right;
          if (sp === cur) nodes[sp].right = succRight;
          else nodes[sp].left = succRight;
          delete nodes[succ];
          snap({ [cur]: C.done }, `Remove the successor's old node (it had at most a right child). ${v} is gone; ordering still holds.`);
        }
      }
    }
    setTree({ nodes, root });
    setFrames(fr);
  }

  function preset(kind: "balanced" | "skewed" | "random") {
    let vals: number[];
    if (kind === "balanced") vals = [50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45];
    else if (kind === "skewed") vals = [10, 20, 30, 40, 50, 60, 70];
    else {
      const set = new Set<number>();
      while (set.size < 10) set.add(1 + Math.floor(Math.random() * 99));
      vals = [...set];
    }
    const t = bstFrom(vals);
    setTree(t);
    setFrames([{ ...t, hi: {}, msg: kind === "skewed" ? "Inserting sorted values creates a 'linked list' — height n, so every operation degrades to O(n). Balanced trees (AVL, red-black) rotate to prevent this." : `Inserted ${vals.join(", ")}.` }]);
  }

  const f = s.frame;
  const count = Object.keys(f.nodes).length;
  const h = height(f.nodes, f.root);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={val} onChange={setVal} width="w-16" onEnter={() => run("insert")} />
        <SmallBtn tone="primary" onClick={() => run("insert")}>insert</SmallBtn>
        <SmallBtn onClick={() => run("search")}>search</SmallBtn>
        <SmallBtn tone="danger" onClick={() => run("delete")}>delete</SmallBtn>
        <span className="mx-1 h-5 w-px bg-line-2" />
        <SmallBtn onClick={() => preset("balanced")}>balanced</SmallBtn>
        <SmallBtn onClick={() => preset("skewed")}>sorted inserts</SmallBtn>
        <SmallBtn onClick={() => preset("random")}>random</SmallBtn>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-2 scrollbar-thin">
        <TreeSvg nodes={f.nodes} root={f.root} hi={f.hi} />
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="nodes" value={count} />
        <Stat label="height" value={h} color={h > Math.ceil(Math.log2(count + 1)) + 1 ? C.bad : C.done} />
        <Stat label="ideal height ⌈log₂(n+1)⌉" value={Math.ceil(Math.log2(count + 1))} color={C.pivot} />
      </div>
    </div>
  );
}
