import { arr, bnode, buildList, fmt, grid, gridTones, listPanel, lnode, need, RecTree, sim, stack, tones, treePanel, treeToLevel, vals, walk, type BNode, type LNode } from "@/lib/sim/build";
import type { Sim, Tone, TreeNode } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "convert-sorted-array-to-binary-search-tree": sim<[number[]]>(
    ["nums"],
    [
      [
        [-10, -3, 0, 5, 9],
        [0, -10, 5, null, -3, null, 9],
      ],
      [
        [1, 3],
        [1, null, 3],
      ],
      [
        [1, 2, 3, 4, 5, 6, 7],
        [4, 2, 6, 1, 3, 5, 7],
      ],
    ],
    (t, nums) => {
      let root: BNode | null = null;
      const tn: Record<string, Tone> = {};
      t.step(
        "The middle element becomes the root, so both halves have (almost) equal size. Recurse on the left half for the left subtree and the right half for the right: height-balanced by construction.",
        [arr(nums), treePanel(null)],
      );
      const build = (lo: number, hi: number, attach: (n: BNode) => void) => {
        if (lo > hi) return;
        const mid = Math.floor((lo + hi) / 2);
        const node = bnode(nums[mid]);
        if (!root) root = node;
        attach(node);
        tn[node.id] = "cur";
        t.step(`Range [${lo}..${hi}]: middle index ${mid} → node ${nums[mid]}.`, [
          arr(nums, {
            win: [lo, hi],
            ptrs: { mid },
            tones: tones([[mid], "cur"]),
          }),
          treePanel(root, { tones: tn }),
        ]);
        tn[node.id] = "ok";
        build(lo, mid - 1, (c) => (node.left = c));
        build(mid + 1, hi, (c) => (node.right = c));
      };
      build(0, nums.length - 1, () => {});
      t.step("Balanced BST built in O(n).", [arr(nums), treePanel(root, { tones: tn })], "good");
      return treeToLevel(root);
    },
  ),

  "sort-list": sim<[number[]]>(
    ["head"],
    [
      [
        [4, 2, 1, 3],
        [1, 2, 3, 4],
      ],
      [
        [-1, 5, 3, 4, 0],
        [-1, 0, 3, 4, 5],
      ],
    ],
    (t, values) => {
      need(values.length <= 12, "up to 12 values for the visual");
      const nodes = buildList(values);
      t.step("Merge sort fits linked lists: find the middle with slow/fast pointers, cut there, sort both halves recursively, then merge. O(n log n) time, no random access needed.", [
        listPanel(nodes),
      ]);
      const sort = (head: LNode | null): LNode | null => {
        if (!head || !head.next) return head;
        let slow = head;
        let fast: LNode | null = head.next;
        while (fast && fast.next) {
          slow = slow.next!;
          fast = fast.next.next;
        }
        const mid = slow.next;
        slow.next = null;
        t.step(`Split ${fmt(vals(head))} at the middle into ${fmt(vals(head))} and ${fmt(vals(mid))}.`, [
          listPanel(walk(head), {
            label: "left half",
            tones: Object.fromEntries(walk(head).map((n) => [n.id, "cmp" as Tone])),
          }),
          listPanel(walk(mid), {
            label: "right half",
            tones: Object.fromEntries(walk(mid).map((n) => [n.id, "alt" as Tone])),
          }),
        ]);
        let l = sort(head);
        let r = sort(mid);
        const ls = vals(l);
        const rs = vals(r);
        const dummy = lnode(0);
        let tail = dummy;
        while (l && r) {
          if (l.val <= r.val) {
            tail.next = l;
            l = l.next;
          } else {
            tail.next = r;
            r = r.next;
          }
          tail = tail.next;
        }
        tail.next = l || r;
        const merged = walk(dummy.next, 1000);
        t.step(`Merge sorted ${fmt(ls)} and ${fmt(rs)} → ${fmt(merged.map((n) => n.val))}.`, [
          listPanel(merged, {
            label: "merged",
            tones: Object.fromEntries(merged.map((n) => [n.id, "ok" as Tone])),
          }),
        ]);
        return dummy.next;
      };
      const res = sort(nodes[0] ?? null);
      t.step("Sorted.", [listPanel(walk(res, 1000))], "good");
      return vals(res);
    },
  ),

  "construct-quad-tree": sim<[number[][]]>(
    ["grid"],
    [
      [
        [
          [0, 1],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 0],
          [1, 1],
          [1, 1],
          [1, 0],
        ],
      ],
      [
        [
          [1, 1],
          [1, 1],
        ],
        [[1, 1]],
      ],
      [
        [
          [1, 1, 0, 0],
          [1, 1, 0, 0],
          [1, 1, 1, 1],
          [1, 1, 1, 1],
        ],
        [
          [0, 1],
          [1, 1],
          [1, 0],
          [1, 1],
          [1, 1],
        ],
      ],
    ],
    (t, g) => {
      const n = g.length;
      need(n >= 1 && n <= 8 && (n & (n - 1)) === 0 && g.every((r) => r.length === n && r.every((v) => v === 0 || v === 1)), "grid must be n×n of 0/1 with n a power of two ≤ 8");
      const tree = new RecTree("root");
      type Q = { leaf: boolean; val: number; kids: Q[] };
      const cells = (r: number, c: number, s: number) => Array.from({ length: s * s }, (_, k) => [r + Math.floor(k / s), c + (k % s)] as [number, number]);
      const build = (r: number, c: number, s: number, node: TreeNode): Q => {
        const first = g[r][c];
        const uniform = cells(r, c, s).every(([i, j]) => g[i][j] === first);
        node.label = uniform ? `leaf ${first}` : "split";
        node.tone = uniform ? "ok" : "cur";
        t.step(uniform ? `The ${s}×${s} block at (${r},${c}) is all ${first}: it becomes a leaf.` : `The ${s}×${s} block at (${r},${c}) is mixed: split it into 4 quadrants.`, [
          grid(g, {
            tones: gridTones([cells(r, c, s), uniform ? "ok" : "cur"]),
          }),
          tree.panel("quad tree"),
        ]);
        if (uniform) return { leaf: true, val: first, kids: [] };
        node.tone = "dim";
        const h = s / 2;
        const kids = [
          [r, c],
          [r, c + h],
          [r + h, c],
          [r + h, c + h],
        ].map(([a, b], i) => build(a, b, h, tree.add(node, ["TL", "TR", "BL", "BR"][i])));
        return { leaf: false, val: 1, kids };
      };
      const root = build(0, 0, n, tree.root);
      const out: ([number, number] | null)[] = [];
      const q: (Q | null)[] = [root];
      while (q.length) {
        const x = q.shift()!;
        if (!x) {
          out.push(null);
          continue;
        }
        out.push([x.leaf ? 1 : 0, x.val]);
        if (x.leaf) q.push(null, null, null, null);
        else q.push(...x.kids);
      }
      while (out.length && out[out.length - 1] === null) out.pop();
      t.step("Every block is uniform or split. Serialized level by level as [isLeaf, val].", [tree.panel("quad tree")], "good");
      return out;
    },
  ),

  "merge-k-sorted-lists": sim<[number[][]]>(
    ["lists"],
    [
      [
        [
          [1, 4, 5],
          [1, 3, 4],
          [2, 6],
        ],
        [1, 1, 2, 3, 4, 4, 5, 6],
      ],
      [[], []],
      [
        [[2], [], [1]],
        [1, 2],
      ],
    ],
    (t, lists) => {
      need(lists.length <= 6, "up to 6 lists for the visual");
      const heads: (LNode | null)[] = lists.map((l) => buildList(l)[0] ?? null);
      const heap: [number, number, LNode][] = [];
      heads.forEach((h, i) => {
        if (h) heap.push([h.val, i, h]);
      });
      const order = () => heap.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      order();
      const dummy = lnode(0);
      let tail: LNode = dummy;
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            ...heads.map((h, i) => listPanel(walk(h), { label: `list ${i}` })),
            stack(
              "min-heap (value, list)",
              [...heap].reverse().map(([v, i]) => `${v} (L${i})`),
            ),
            listPanel(walk(dummy.next, 1000), { label: "merged" }),
          ],
          tone,
        );
      show("Put the head of every list in a min-heap. Pop the smallest, append it, and push that node's successor. The heap never holds more than k nodes: O(N log k).");
      while (heap.length) {
        const [v, i, node] = heap.shift()!;
        heads[i] = node.next;
        tail.next = node;
        tail = node;
        tail.next = null;
        if (heads[i]) {
          heap.push([heads[i]!.val, i, heads[i]!]);
          order();
        }
        show(`Pop ${v} from list ${i} and append it.${heads[i] ? ` Push list ${i}'s next value ${heads[i]!.val}.` : ` List ${i} is exhausted.`}`);
      }
      show(lists.length ? "The heap is empty: every node is merged." : "No lists: the result is empty.", "good");
      return vals(dummy.next);
    },
  ),
};
