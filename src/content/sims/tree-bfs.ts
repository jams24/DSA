import { buildTree, fmt, out, queue, sim, treePanel, type BNode } from "@/lib/sim/build";
import type { Sim, Tone } from "@/lib/sim/types";

/** Level-by-level BFS shared by the four problems; `finish` turns one level's values into the reported row. */
function bfs(t: Parameters<Sim["run"]>[0], level: (number | null)[], intro: string, finish: (vals: number[], depth: number) => { row: unknown; note: string }, label: string) {
  const root = buildTree(level);
  const res: unknown[] = [];
  const tn: Record<string, Tone> = {};
  let q: BNode[] = root ? [root] : [];
  const show = (note: string, cur: BNode[] = [], tone?: "good") =>
    t.step(
      note,
      [
        treePanel(root, {
          tones: {
            ...tn,
            ...Object.fromEntries(q.map((n) => [n.id, "pick" as Tone])),
            ...Object.fromEntries(cur.map((n) => [n.id, "cur" as Tone])),
          },
        }),
        queue(
          "queue",
          q.map((n) => n.val),
        ),
        out(label, res.map(fmt), res.length ? [res.length - 1] : []),
      ],
      tone,
    );
  show(intro);
  let depth = 0;
  while (q.length) {
    const lvl = q;
    q = [];
    for (const n of lvl) {
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
    }
    const { row, note } = finish(
      lvl.map((n) => n.val),
      depth,
    );
    res.push(row);
    show(`Level ${depth}: the queue held ${lvl.length} node${lvl.length === 1 ? "" : "s"} (${lvl.map((n) => n.val).join(", ")}). ${note} Their children form the next level.`, lvl);
    for (const n of lvl) tn[n.id] = "dim";
    depth++;
  }
  show(`Done: ${fmt(res)}.`, [], "good");
  return res;
}

export const SIMS: Record<string, Sim> = {
  "binary-tree-right-side-view": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [1, 2, 3, null, 5, null, 4],
        [1, 3, 4],
      ],
      [
        [1, 2, 3, 4, null, null, null, 5],
        [1, 3, 4, 5],
      ],
      [
        [1, null, 3],
        [1, 3],
      ],
    ],
    (t, level) =>
      bfs(
        t,
        level,
        "BFS one level at a time. The LAST node of each level is the one you'd see from the right.",
        (v) => ({
          row: v[v.length - 1],
          note: `The rightmost is ${v[v.length - 1]}.`,
        }),
        "right side view",
      ),
  ),

  "average-of-levels-in-binary-tree": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [3, 9, 20, null, null, 15, 7],
        [3, 14.5, 11],
      ],
      [
        [3, 9, 20, 15, 7],
        [3, 14.5, 11],
      ],
    ],
    (t, level) =>
      bfs(
        t,
        level,
        "BFS one level at a time: the queue length at the start of a level is exactly that level's size. Average = sum / size.",
        (v) => {
          const avg = v.reduce((a, b) => a + b, 0) / v.length;
          return {
            row: avg,
            note: `Average = ${v.join(" + ")} / ${v.length} = ${fmt(avg)}.`,
          };
        },
        "averages",
      ),
  ),

  "binary-tree-level-order-traversal": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [3, 9, 20, null, null, 15, 7],
        [[3], [9, 20], [15, 7]],
      ],
      [
        [1, 2, 3, 4, 5],
        [[1], [2, 3], [4, 5]],
      ],
      [[1], [[1]]],
    ],
    (t, level) =>
      bfs(
        t,
        level,
        "BFS with a queue. Snapshot the queue's size at the start of each level so you know exactly how many nodes belong to it.",
        (v) => ({ row: v, note: `Record ${fmt(v)}.` }),
        "levels",
      ),
  ),

  "binary-tree-zigzag-level-order-traversal": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [3, 9, 20, null, null, 15, 7],
        [[3], [20, 9], [15, 7]],
      ],
      [
        [1, 2, 3, 4, null, null, 5],
        [[1], [3, 2], [4, 5]],
      ],
      [[1], [[1]]],
    ],
    (t, level) =>
      bfs(
        t,
        level,
        "Plain BFS by levels, then reverse every other level. The queue itself never changes direction.",
        (v, d) =>
          d % 2
            ? {
                row: [...v].reverse(),
                note: `Odd level: reverse it to ${fmt([...v].reverse())}.`,
              }
            : { row: v, note: `Even level: keep ${fmt(v)} left to right.` },
        "zigzag",
      ),
  ),
};
