import { arr, bnode, buildTree, fmt, need, nodesOf, out, range, sim, stack, tones, treePanel, treeToLevel, vars, type BNode } from "@/lib/sim/build";
import type { Sim, Tone, TreePanel } from "@/lib/sim/types";

const tp = (root: BNode | null, tn: Record<string, Tone> = {}, tags: Record<string, string> = {}, label?: string): TreePanel => treePanel(root, { tones: tn, tags, label });
const find = (root: BNode | null, v: number) => nodesOf(root).find((n) => n.val === v) ?? null;

export const SIMS: Record<string, Sim> = {
  "maximum-depth-of-binary-tree": sim<[(number | null)[]]>(
    ["root"],
    [
      [[3, 9, 20, null, null, 15, 7], 3],
      [[1, null, 2], 2],
      [[1, 2, 3, 4, null, null, null, 5], 4],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      t.step("depth(node) = 1 + max(depth(left), depth(right)), and an empty subtree has depth 0. Post-order: children report first.", [tp(root)]);
      const depth = (n: BNode | null): number => {
        if (!n) return 0;
        tn[n.id] = "cur";
        t.step(`Visit ${n.val}: ask both children for their depth.`, [tp(root, tn, tags)]);
        const l = depth(n.left);
        const r = depth(n.right);
        const d = 1 + Math.max(l, r);
        tn[n.id] = "ok";
        tags[n.id] = `d=${d}`;
        t.step(`${n.val}: left ${l}, right ${r} → 1 + max = ${d}.`, [tp(root, tn, tags)]);
        return d;
      };
      const d = depth(root);
      t.step(`Max depth = ${d}.`, [tp(root, tn, tags)], "good");
      return d;
    },
  ),

  "same-tree": sim<[(number | null)[], (number | null)[]]>(
    ["p", "q"],
    [
      [[1, 2, 3], [1, 2, 3], true],
      [[1, 2], [1, null, 2], false],
      [[1, 2, 1], [1, 1, 2], false],
    ],
    (t, a, b) => {
      const P = buildTree(a);
      const Q = buildTree(b);
      const tn: Record<string, Tone> = {};
      const show = (note: string, tone?: "good" | "bad") => t.step(note, [tp(P, tn, {}, "p"), tp(Q, tn, {}, "q")], tone);
      show("Walk both trees in lockstep. At each pair: both empty → same; exactly one empty or different values → not the same.");
      const same = (x: BNode | null, y: BNode | null): boolean => {
        if (!x || !y) {
          if (x || y) {
            if (x) tn[x.id] = "bad";
            if (y) tn[y.id] = "bad";
            show(`One side has ${x ? x.val : y!.val} where the other side is empty: different shapes.`, "bad");
          }
          return x === y;
        }
        const eq = x.val === y.val;
        tn[x.id] = tn[y.id] = eq ? "ok" : "bad";
        show(eq ? `${x.val} = ${y.val}. Compare the left subtrees, then the right ones.` : `${x.val} ≠ ${y.val}: not the same.`, eq ? undefined : "bad");
        return eq && same(x.left, y.left) && same(x.right, y.right);
      };
      const res = same(P, Q);
      if (res) show("Every pair matched: the trees are the same.", "good");
      return res;
    },
  ),

  "invert-binary-tree": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [4, 2, 7, 1, 3, 6, 9],
        [4, 7, 2, 9, 6, 3, 1],
      ],
      [
        [2, 1, 3],
        [2, 3, 1],
      ],
      [[], []],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      t.step("Mirror the tree: at every node swap its left and right children, then do the same inside each child.", [tp(root)]);
      const inv = (n: BNode | null) => {
        if (!n) return;
        [n.left, n.right] = [n.right, n.left];
        tn[n.id] = "ok";
        t.step(`Swap the children of ${n.val}.`, [tp(root, { ...tn, [n.id]: "cur" })]);
        inv(n.left);
        inv(n.right);
      };
      inv(root);
      t.step(root ? "Every node's children are swapped: the tree is inverted." : "An empty tree inverts to itself.", [tp(root, tn)], "good");
      return treeToLevel(root);
    },
  ),

  "symmetric-tree": sim<[(number | null)[]]>(
    ["root"],
    [
      [[1, 2, 2, 3, 4, 4, 3], true],
      [[1, 2, 2, null, 3, null, 3], false],
    ],
    (t, level) => {
      const root = buildTree(level);
      need(root, "tree must not be empty");
      const tn: Record<string, Tone> = {};
      const show = (note: string, tone?: "good" | "bad") => t.step(note, [tp(root, tn)], tone);
      show("A tree is symmetric if its left and right subtrees are mirrors. Compare pairs from the outside in: (left.left, right.right) and (left.right, right.left).");
      const mirror = (a: BNode | null, b: BNode | null): boolean => {
        if (!a || !b) {
          if (a || b) {
            tn[(a ?? b)!.id] = "bad";
            show(`${(a ?? b)!.val} has no mirror partner: not symmetric.`, "bad");
          }
          return a === b;
        }
        const eq = a.val === b.val;
        tn[a.id] = tn[b.id] = eq ? "ok" : "bad";
        show(eq ? `${a.val} mirrors ${b.val}.` : `${a.val} ≠ ${b.val}: not symmetric.`, eq ? undefined : "bad");
        return eq && mirror(a.left, b.right) && mirror(a.right, b.left);
      };
      const res = mirror(root.left, root.right);
      if (res) show("Every mirrored pair matched: symmetric.", "good");
      return res;
    },
  ),

  "construct-binary-tree-from-preorder-and-inorder-traversal": sim<[number[], number[]]>(
    ["preorder", "inorder"],
    [
      [
        [3, 9, 20, 15, 7],
        [9, 3, 15, 20, 7],
        [3, 9, 20, null, null, 15, 7],
      ],
      [
        [1, 2, 4, 5, 3],
        [4, 2, 5, 1, 3],
        [1, 2, 3, 4, 5],
      ],
      [[-1], [-1], [-1]],
    ],
    (t, pre, ino) => {
      need(pre.length === ino.length && new Set(pre).size === pre.length, "two traversals of the same unique values");
      const index = new Map(ino.map((v, i) => [v, i]));
      let k = 0;
      let root: BNode | null = null;
      const tn: Record<string, Tone> = {};
      const show = (lo: number, hi: number, note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(pre, {
              label: "preorder",
              ptrs: k < pre.length ? { next: k } : {},
              tones: tones([range(0, k), "dim"]),
            }),
            arr(ino, { label: "inorder", win: lo <= hi ? [lo, hi] : null }),
            tp(root, tn),
          ],
          tone,
        );
      show(0, ino.length - 1, "Preorder lists every root before its subtrees. Find that root in inorder: everything to its left is the left subtree, everything to its right is the right subtree.");
      const rec = (lo: number, hi: number, attach: (n: BNode) => void, side: string) => {
        if (lo > hi) return;
        const v = pre[k++];
        need(index.has(v), `${v} is not in inorder`);
        const node = bnode(v);
        if (!root) root = node;
        tn[node.id] = "cur";
        attach(node);
        const mid = index.get(node.val)!;
        show(lo, hi, `Next preorder value ${node.val} is the root of inorder[${lo}..${hi}]${side}. It sits at inorder index ${mid}: left part ${lo}..${mid - 1}, right part ${mid + 1}..${hi}.`);
        tn[node.id] = "ok";
        rec(lo, mid - 1, (c) => (node.left = c), ` (left of ${node.val})`);
        rec(mid + 1, hi, (c) => (node.right = c), ` (right of ${node.val})`);
      };
      rec(0, ino.length - 1, () => {}, "");
      show(1, 0, "Every value placed: tree rebuilt in O(n) with the index map.", "good");
      return treeToLevel(root);
    },
  ),

  "construct-binary-tree-from-inorder-and-postorder-traversal": sim<[number[], number[]]>(
    ["inorder", "postorder"],
    [
      [
        [9, 3, 15, 20, 7],
        [9, 15, 7, 20, 3],
        [3, 9, 20, null, null, 15, 7],
      ],
      [
        [4, 2, 5, 1, 3],
        [4, 5, 2, 3, 1],
        [1, 2, 3, 4, 5],
      ],
      [[-1], [-1], [-1]],
    ],
    (t, ino, post) => {
      need(post.length === ino.length && new Set(post).size === post.length, "two traversals of the same unique values");
      const index = new Map(ino.map((v, i) => [v, i]));
      let k = post.length - 1;
      let root: BNode | null = null;
      const tn: Record<string, Tone> = {};
      const show = (lo: number, hi: number, note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(ino, { label: "inorder", win: lo <= hi ? [lo, hi] : null }),
            arr(post, {
              label: "postorder (read from the back)",
              ptrs: k >= 0 ? { next: k } : {},
              tones: tones([range(k + 1, post.length), "dim"]),
            }),
            tp(root, tn),
          ],
          tone,
        );
      show(0, ino.length - 1, "Postorder ends with the root, so read it backwards: root, then the RIGHT subtree, then the left. Split inorder at each root.");
      const rec = (lo: number, hi: number, attach: (n: BNode) => void, side: string) => {
        if (lo > hi) return;
        const v = post[k--];
        need(index.has(v), `${v} is not in inorder`);
        const node = bnode(v);
        if (!root) root = node;
        attach(node);
        tn[node.id] = "cur";
        const mid = index.get(v)!;
        show(lo, hi, `${v} is the root of inorder[${lo}..${hi}]${side}. Build its right part ${mid + 1}..${hi} first, then the left part ${lo}..${mid - 1}.`);
        tn[node.id] = "ok";
        rec(mid + 1, hi, (c) => (node.right = c), ` (right of ${v})`);
        rec(lo, mid - 1, (c) => (node.left = c), ` (left of ${v})`);
      };
      rec(0, ino.length - 1, () => {}, "");
      show(1, 0, "Tree rebuilt.", "good");
      return treeToLevel(root);
    },
  ),

  "populating-next-right-pointers-in-each-node-ii": sim<[(number | null)[]]>(
    ["root"],
    [
      [[1, 2, 3, 4, 5, null, 7], "[1,#,2,3,#,4,5,7,#]"],
      [[1, 2, 3, 4, 5, 6, 7], "[1,#,2,3,#,4,5,6,7,#]"],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tags: Record<string, string> = {};
      const tn: Record<string, Tone> = {};
      const tag = (n: BNode) => (tags[n.id] = `→${n.next ? n.next.val : "∅"}`);
      t.step("Use the level that's already linked to link the level below it, like walking a linked list. A dummy node collects the children in order, so no queue is needed: O(1) space.", [tp(root)]);
      let lvl: BNode | null = root;
      if (root) tag(root);
      while (lvl) {
        const dummy = bnode(0);
        let tail = dummy;
        let cur: BNode | null = lvl;
        while (cur) {
          for (const c of [cur.left, cur.right]) {
            if (!c) continue;
            tail.next = c;
            if (tail !== dummy) tag(tail);
            tail = c;
            tag(c);
            t.step(`Walking ${cur.val}'s level: link child ${c.val} after the previous child on the level below.`, [tp(root, { ...tn, [cur.id]: "cur", [c.id]: "ok" }, tags)]);
          }
          tn[cur.id] = "dim";
          cur = cur.next ?? null;
        }
        lvl = dummy.next ?? null;
      }
      const parts: string[] = [];
      for (let l: BNode | null = root; l;) {
        for (let c: BNode | null = l; c; c = c.next ?? null) parts.push(String(c.val));
        parts.push("#");
        let nextLevel: BNode | null = null;
        for (let c: BNode | null = l; c && !nextLevel; c = c.next ?? null) nextLevel = c.left ?? c.right ?? null;
        l = nextLevel;
      }
      t.step("Every node points to its right neighbour; the last node of each level points to null.", [tp(root, {}, tags)], "good");
      return `[${parts.join(",")}]`;
    },
  ),

  "flatten-binary-tree-to-linked-list": sim<[(number | null)[]]>(
    ["root"],
    [
      [
        [1, 2, 5, 3, 4, null, 6],
        [1, null, 2, null, 3, null, 4, null, 5, null, 6],
      ],
      [[0], [0]],
    ],
    (t, level) => {
      const root = buildTree(level);
      t.step(
        "Morris-style, O(1) space: if cur has a left subtree, hang cur's right subtree off the rightmost node of the left subtree, move the left subtree to the right, and continue down the right.",
        [tp(root)],
      );
      let cur = root;
      while (cur) {
        if (cur.left) {
          let pre = cur.left;
          while (pre.right) pre = pre.right;
          t.step(`${cur.val} has a left subtree. Its rightmost node is ${pre.val}, which comes right before ${cur.val}'s right subtree in preorder.`, [
            tp(root, { [cur.id]: "cur", [pre.id]: "pick" }),
          ]);
          pre.right = cur.right;
          cur.right = cur.left;
          cur.left = null;
          t.step(`Re-wire: ${pre.val}.right = old right subtree, ${cur.val}.right = old left subtree, ${cur.val}.left = null.`, [tp(root, { [cur.id]: "cur", [pre.id]: "pick" })]);
        } else t.step(`${cur.val} has no left subtree: just move right.`, [tp(root, { [cur.id]: "cur" })]);
        cur = cur.right;
      }
      t.step("The tree is now a right-leaning chain in preorder.", [tp(root, Object.fromEntries(nodesOf(root).map((n) => [n.id, "ok" as Tone])))], "good");
      return treeToLevel(root);
    },
  ),

  "path-sum": sim<[(number | null)[], number]>(
    ["root", "targetSum"],
    [
      [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1], 22, true],
      [[1, 2, 3], 5, false],
      [[], 0, false],
    ],
    (t, level, target) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      t.step(`Go down subtracting each node's value from the target. At a leaf, check whether what's left equals the leaf's value.`, [tp(root), vars({ targetSum: target })]);
      const dfs = (n: BNode | null, rest: number): boolean => {
        if (!n) return false;
        tn[n.id] = "cur";
        if (!n.left && !n.right) {
          const ok = rest === n.val;
          tn[n.id] = ok ? "ok" : "bad";
          t.step(
            `Leaf ${n.val}: need ${rest} here. ${ok ? "Match: a root-to-leaf path sums to the target!" : "No match, back up."}`,
            [tp(root, tn, tags), vars({ targetSum: target, need: rest })],
            ok ? "good" : undefined,
          );
          if (!ok) tn[n.id] = "dim";
          return ok;
        }
        tags[n.id] = `need ${rest - n.val}`;
        t.step(`At ${n.val}: the children must supply ${rest} − ${n.val} = ${rest - n.val}.`, [tp(root, tn, tags), vars({ targetSum: target, need: rest })]);
        const res = dfs(n.left, rest - n.val) || dfs(n.right, rest - n.val);
        tn[n.id] = res ? "ok" : "dim";
        return res;
      };
      const res = dfs(root, target);
      if (!res) t.step(root ? "No root-to-leaf path adds up to the target." : "Empty tree: no paths at all.", [tp(root, tn, tags)], "bad");
      return res;
    },
  ),

  "sum-root-to-leaf-numbers": sim<[(number | null)[]]>(
    ["root"],
    [
      [[1, 2, 3], 25],
      [[4, 9, 0, 5, 1], 1026],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      const found: number[] = [];
      t.step("Carry the number built so far down the tree: num = num × 10 + digit. Each leaf finishes one number; add them all up.", [tp(root), out("numbers", found)]);
      const dfs = (n: BNode | null, num: number): number => {
        if (!n) return 0;
        num = num * 10 + n.val;
        tags[n.id] = String(num);
        tn[n.id] = "cur";
        if (!n.left && !n.right) {
          found.push(num);
          tn[n.id] = "ok";
          t.step(`Leaf ${n.val} completes the number ${num}.`, [tp(root, tn, tags), out("numbers", found, [found.length - 1])]);
          return num;
        }
        t.step(`At ${n.val}: number so far = ${num}.`, [tp(root, tn, tags), out("numbers", found)]);
        const s = dfs(n.left, num) + dfs(n.right, num);
        tn[n.id] = "dim";
        return s;
      };
      const total = dfs(root, 0);
      t.step(`${found.join(" + ")} = ${total}.`, [tp(root, {}, tags), out("numbers", found)], "good");
      return total;
    },
  ),

  "binary-tree-maximum-path-sum": sim<[(number | null)[]]>(
    ["root"],
    [
      [[1, 2, 3], 6],
      [[-10, 9, 20, null, null, 15, 7], 42],
      [[-3], -3],
    ],
    (t, level) => {
      const root = buildTree(level);
      need(root, "tree must not be empty");
      let best = -Infinity;
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      t.step(
        "Post-order. Each node returns its best downward 'arm' (itself + the better child arm, negatives dropped to 0). A path that BENDS at the node is node + left arm + right arm: compare that with the best.",
        [tp(root), vars({ best: "−∞" })],
      );
      const gain = (n: BNode | null): number => {
        if (!n) return 0;
        const l = Math.max(gain(n.left), 0);
        const r = Math.max(gain(n.right), 0);
        const through = n.val + l + r;
        const better = through > best;
        best = Math.max(best, through);
        const up = n.val + Math.max(l, r);
        tn[n.id] = better ? "ok" : "cur";
        tags[n.id] = `↑${up}`;
        t.step(`${n.val}: arms left ${l}, right ${r}. Path bending here = ${through}${better ? ", a new best" : ""}. Return ${up} upward (one arm only).`, [tp(root, tn, tags), vars({ best })]);
        tn[n.id] = "dim";
        return up;
      };
      gain(root);
      t.step(`Maximum path sum = ${best}.`, [tp(root, {}, tags), vars({ best })], "good");
      return best;
    },
  ),

  "binary-search-tree-iterator": sim<[string[], (number | null)[]]>(
    ["ops", "root"],
    [
      [
        ["BSTIterator", "next", "next", "hasNext", "next", "hasNext", "next", "hasNext", "next", "hasNext"],
        [7, 3, 15, null, null, 9, 20],
        [null, 3, 7, true, 9, true, 15, true, 20, false],
      ],
      [
        ["BSTIterator", "next", "next", "next", "hasNext"],
        [2, 1, 3],
        [null, 1, 2, 3, false],
      ],
    ],
    (t, ops, level) => {
      const root = buildTree(level);
      const st: BNode[] = [];
      const res: unknown[] = [];
      const doneIds: Record<string, Tone> = {};
      const show = (note: string, hi?: BNode) =>
        t.step(note, [
          tp(root, {
            ...doneIds,
            ...Object.fromEntries(st.map((n) => [n.id, "pick" as Tone])),
            ...(hi ? { [hi.id]: "ok" as Tone } : {}),
          }),
          stack(
            "stack",
            st.map((n) => n.val),
          ),
          out("returned", res.map(fmt)),
        ]);
      const pushLeft = (n: BNode | null) => {
        for (; n; n = n.left) st.push(n);
      };
      ops.forEach((op) => {
        if (op === "BSTIterator") {
          pushLeft(root);
          res.push(null);
          show("A controlled in-order traversal: the stack holds the path of nodes still waiting to be visited. Start by pushing the whole left spine.");
        } else if (op === "next") {
          need(st.length, "next() called with no elements left");
          const n = st.pop()!;
          pushLeft(n.right);
          res.push(n.val);
          doneIds[n.id] = "dim";
          show(`next(): pop ${n.val}, the smallest unvisited value. ${n.right ? `Push the left spine of its right subtree.` : "It has no right subtree."} Amortized O(1).`, n);
        } else if (op === "hasNext") {
          res.push(st.length > 0);
          show(`hasNext(): the stack is ${st.length ? "not empty → true" : "empty → false"}.`);
        } else throw new Error(`unknown op ${op}`);
      });
      return res;
    },
  ),

  "count-complete-tree-nodes": sim<[(number | null)[]]>(
    ["root"],
    [
      [[1, 2, 3, 4, 5, 6], 6],
      [[1, 2, 3, 4, 5, 6, 7], 7],
      [[1], 1],
    ],
    (t, level) => {
      const root = buildTree(level);
      const tn: Record<string, Tone> = {};
      const tags: Record<string, string> = {};
      t.step(
        "In a complete tree, if the leftmost depth equals the rightmost depth the subtree is PERFECT: it has 2^h − 1 nodes, no need to visit them. Otherwise recurse into both children. O(log² n).",
        [tp(root)],
      );
      const count = (n: BNode | null): number => {
        if (!n) return 0;
        let lh = 0;
        let rh = 0;
        for (let l: BNode | null = n; l; l = l.left) lh++;
        for (let r: BNode | null = n; r; r = r.right) rh++;
        if (lh === rh) {
          const c = (1 << lh) - 1;
          for (const x of nodesOf(n)) tn[x.id] = "ok";
          tags[n.id] = `${c}`;
          t.step(`Subtree at ${n.val}: left height ${lh} = right height ${rh}, so it's perfect with 2^${lh} − 1 = ${c} nodes.`, [tp(root, tn, tags)]);
          return c;
        }
        tn[n.id] = "cur";
        t.step(`Subtree at ${n.val}: left height ${lh} ≠ right height ${rh}. Count 1 + both children.`, [tp(root, tn, tags)]);
        const c = 1 + count(n.left) + count(n.right);
        tn[n.id] = "ok";
        tags[n.id] = `${c}`;
        t.step(`Subtree at ${n.val} has ${c} nodes.`, [tp(root, tn, tags)]);
        return c;
      };
      const c = count(root);
      t.step(`${c} nodes.`, [tp(root, tn, tags)], "good");
      return c;
    },
  ),

  "lowest-common-ancestor-of-a-binary-tree": sim<[(number | null)[], number, number]>(
    ["root", "p", "q"],
    [
      [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 1, 3],
      [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 5, 4, 5],
      [[1, 2], 1, 2, 1],
    ],
    (t, level, pv, qv) => {
      const root = buildTree(level);
      const p = find(root, pv);
      const q = find(root, qv);
      need(p && q, "p and q must be values in the tree");
      const tn: Record<string, Tone> = { [p.id]: "pick", [q.id]: "pick" };
      const tags: Record<string, string> = {};
      t.step(`Each call returns p or q if it finds one in its subtree (or null). The first node that gets a non-null answer from BOTH sides is the lowest common ancestor.`, [tp(root, tn)]);
      const lca = (n: BNode | null): BNode | null => {
        if (!n) return null;
        if (n === p || n === q) {
          tags[n.id] = `↑${n.val}`;
          t.step(`Found ${n.val} (one of the targets): return it without looking below.`, [tp(root, { ...tn, [n.id]: "ok" }, tags)]);
          return n;
        }
        const l = lca(n.left);
        const r = lca(n.right);
        const res = l && r ? n : (l ?? r);
        tags[n.id] = res ? `↑${res.val}` : "↑∅";
        t.step(
          l && r
            ? `${n.val} gets ${l.val} from the left and ${r.val} from the right: it's the LCA.`
            : `${n.val}: left ${l ? l.val : "∅"}, right ${r ? r.val : "∅"} → pass up ${res ? res.val : "null"}.`,
          [tp(root, { ...tn, [n.id]: l && r ? "ok" : "cur" }, tags)],
        );
        return res;
      };
      const ans = lca(root)!;
      t.step(`LCA(${pv}, ${qv}) = ${ans.val}.`, [tp(root, { ...tn, [ans.id]: "ok" }, tags)], "good");
      return ans.val;
    },
  ),
};
