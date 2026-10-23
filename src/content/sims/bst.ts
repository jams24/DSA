import { buildTree, need, out, sim, stack, treePanel, vars, type BNode } from "@/lib/sim/build";
import type { Sim, Tone } from "@/lib/sim/types";

/** Iterative in-order walk; `visit` returns true to stop early. */
function inorder(
  t: Parameters<Sim["run"]>[0],
  root: BNode | null,
  intro: string,
  visit: (n: BNode, seen: number[]) => { note: string; stop?: boolean; tone?: "good" },
  extra: () => Record<string, unknown>,
) {
  const st: BNode[] = [];
  const seen: number[] = [];
  const tn: Record<string, Tone> = {};
  const show = (note: string, cur?: BNode, tone?: "good") =>
    t.step(
      note,
      [
        treePanel(root, {
          tones: {
            ...tn,
            ...Object.fromEntries(st.map((n) => [n.id, "pick" as Tone])),
            ...(cur ? { [cur.id]: "cur" as Tone } : {}),
          },
        }),
        stack(
          "stack",
          st.map((n) => n.val),
        ),
        out("in-order so far", seen, seen.length ? [seen.length - 1] : []),
        vars(extra()),
      ],
      tone,
    );
  show(intro);
  let node: BNode | null = root;
  while (st.length || node) {
    while (node) {
      st.push(node);
      node = node.left;
    }
    const n = st.pop()!;
    seen.push(n.val);
    const r = visit(n, seen);
    tn[n.id] = "ok";
    show(r.note, n, r.tone);
    if (r.stop) return;
    node = n.right;
  }
}

export const SIMS: Record<string, Sim> = {
  "minimum-absolute-difference-in-bst": sim<[(number | null)[]]>(
    ["root"],
    [
      [[4, 2, 6, 1, 3], 1],
      [[1, 0, 48, null, null, 12, 49], 1],
      [[10, 5, 20, null, null, 15, 30], 5],
    ],
    (t, level) => {
      const root = buildTree(level);
      let prev: number | null = null;
      let best = Infinity;
      inorder(
        t,
        root,
        "In-order traversal of a BST visits values in sorted order, so the closest pair is always two neighbours in that order. Compare each value with the previous one.",
        (n) => {
          const note = prev === null ? `First value ${n.val}.` : `${n.val} − ${prev} = ${n.val - prev}.${n.val - prev < best ? " New smallest gap." : ""}`;
          if (prev !== null) best = Math.min(best, n.val - prev);
          prev = n.val;
          return { note };
        },
        () => ({ prev, best: best === Infinity ? "∞" : best }),
      );
      t.step(`Minimum difference = ${best}.`, [vars({ best })], "good");
      return best;
    },
  ),

  "kth-smallest-element-in-a-bst": sim<[(number | null)[], number]>(
    ["root", "k"],
    [
      [[3, 1, 4, null, 2], 1, 1],
      [[5, 3, 6, 2, 4, null, null, 1], 3, 3],
    ],
    (t, level, k0) => {
      const root = buildTree(level);
      let k = k0;
      let ans: number | null = null;
      need(k0 >= 1, "k must be ≥ 1");
      inorder(
        t,
        root,
        `In-order visits BST values smallest first. Count visits and stop at the ${k0}${k0 === 1 ? "st" : k0 === 2 ? "nd" : k0 === 3 ? "rd" : "th"} one; no need to walk the rest.`,
        (n) => {
          k--;
          if (k === 0) {
            ans = n.val;
            return {
              note: `Visit #${k0} is ${n.val}: that's the answer.`,
              stop: true,
              tone: "good",
            };
          }
          return { note: `Visit ${n.val}; ${k} more to go.` };
        },
        () => ({ "remaining k": k }),
      );
      need(ans !== null, "k is larger than the tree");
      return ans;
    },
  ),

  "validate-binary-search-tree": sim<[(number | null)[]]>(
    ["root"],
    [
      [[2, 1, 3], true],
      [[5, 1, 4, null, null, 3, 6], false],
      [[5, 4, 6, null, null, 3, 7], false],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      const b = (x: number) => (x === Infinity ? "∞" : x === -Infinity ? "−∞" : String(x));
      t.step("Checking only parent vs child isn't enough: every node must fit inside the (low, high) range set by ALL its ancestors. Going left tightens high; going right tightens low.", [
        treePanel(root),
      ]);
      const ok = (n: BNode | null, lo: number, hi: number): boolean => {
        if (!n) return true;
        tags[n.id] = `(${b(lo)},${b(hi)})`;
        const fits = lo < n.val && n.val < hi;
        tn[n.id] = fits ? "ok" : "bad";
        t.step(
          fits ? `${n.val} is inside (${b(lo)}, ${b(hi)}). ✓` : `${n.val} is outside (${b(lo)}, ${b(hi)}): an ancestor's rule is broken. Not a BST.`,
          [treePanel(root, { tones: tn, tags })],
          fits ? undefined : "bad",
        );
        return fits && ok(n.left, lo, n.val) && ok(n.right, n.val, hi);
      };
      const res = ok(root, -Infinity, Infinity);
      if (res) t.step("Every node fits its range: valid BST.", [treePanel(root, { tones: tn, tags })], "good");
      return res;
    },
  ),
};
