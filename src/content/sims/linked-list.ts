import { buildList, lnode, listPanel, map, need, out, sim, vals, vars, walk, type LNode } from "@/lib/sim/build";
import type { ListPanel, Sim, Tone } from "@/lib/sim/types";

/** list panel where the dummy node is labelled "D" */
function lp(nodes: LNode[], o: Parameters<typeof listPanel>[1] = {}, dummies: LNode[] = []): ListPanel {
  const p = listPanel(nodes, o);
  for (const n of p.nodes) if (dummies.some((d) => d.id === n.id)) n.val = "D";
  return p;
}

const toneMap = (...groups: [LNode[] | (LNode | null | undefined)[], Tone][]) => {
  const t: Record<string, Tone> = {};
  for (const [ns, tone] of groups) for (const n of ns) if (n) t[n.id] = tone;
  return t;
};

export const SIMS: Record<string, Sim> = {
  "linked-list-cycle": sim<[number[], number]>(
    ["head", "pos"],
    [
      [[3, 2, 0, -4], 1, true],
      [[1, 2], 0, true],
      [[1, 2, 3, 4], -1, false],
    ],
    (t, values, pos) => {
      const nodes = buildList(values);
      need(pos >= -1 && pos < nodes.length, "pos must be -1 or an index into the list");
      if (pos >= 0 && nodes.length) nodes[nodes.length - 1].next = nodes[pos];
      let slow: LNode | null = nodes[0] ?? null;
      let fast: LNode | null = nodes[0] ?? null;
      const show = (note: string, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            lp(nodes, {
              ptrs: { slow, fast },
              tones: toneMap([[slow], "cmp"], [[fast], "alt"]),
            }),
          ],
          tone,
        );
      show(
        `Floyd's tortoise and hare: slow moves 1 step, fast moves 2. ${pos >= 0 ? `(The tail links back to index ${pos}.)` : "(No cycle in this input.)"} If there's a loop, fast laps slow and they meet.`,
      );
      while (fast && fast.next) {
        slow = slow!.next;
        fast = fast.next.next;
        if (slow === fast) {
          show(`slow and fast meet at node ${slow!.val}: there's a cycle.`, "good");
          return true;
        }
        show(`slow → ${slow!.val}, fast → ${fast ? fast.val : "null"}.`);
      }
      show("fast fell off the end of the list: no cycle.", "bad");
      return false;
    },
  ),

  "add-two-numbers": sim<[number[], number[]]>(
    ["l1", "l2"],
    [
      [
        [2, 4, 3],
        [5, 6, 4],
        [7, 0, 8],
      ],
      [
        [9, 9, 9, 9, 9, 9, 9],
        [9, 9, 9, 9],
        [8, 9, 9, 9, 0, 0, 0, 1],
      ],
      [[0], [0], [0]],
    ],
    (t, a, b) => {
      const A = buildList(a);
      const B = buildList(b);
      let p: LNode | null = A[0] ?? null;
      let q: LNode | null = B[0] ?? null;
      const dummy = lnode(0);
      let cur = dummy;
      let carry = 0;
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [lp(A, { label: "l1", ptrs: { l1: p } }), lp(B, { label: "l2", ptrs: { l2: q } }), lp(walk(dummy), { label: "result", tones: toneMap([[cur], "ok"]) }, [dummy]), vars({ carry })],
          tone,
        );
      show("Digits are stored in reverse, so the head is the ones place. Add column by column like on paper, carrying into the next node.");
      while (p || q || carry) {
        const s = carry + (p?.val ?? 0) + (q?.val ?? 0);
        const pv = p?.val ?? 0;
        const qv = q?.val ?? 0;
        const old = carry;
        carry = Math.floor(s / 10);
        cur.next = lnode(s % 10);
        cur = cur.next;
        show(`${pv} + ${qv} + carry ${old} = ${s}: write ${s % 10}, carry ${carry}.`);
        p = p?.next ?? null;
        q = q?.next ?? null;
      }
      const res = vals(dummy.next);
      show(`Result ${JSON.stringify(res)}.`, "good");
      return res;
    },
  ),

  "merge-two-sorted-lists": sim<[number[], number[]]>(
    ["list1", "list2"],
    [
      [
        [1, 2, 4],
        [1, 3, 4],
        [1, 1, 2, 3, 4, 4],
      ],
      [[], [0], [0]],
      [
        [2, 5, 7],
        [1, 3],
        [1, 2, 3, 5, 7],
      ],
    ],
    (t, a, b) => {
      const A = buildList(a);
      const B = buildList(b);
      let p: LNode | null = A[0] ?? null;
      let q: LNode | null = B[0] ?? null;
      const dummy = lnode(0);
      let tail = dummy;
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            lp(
              [dummy, ...walk(dummy.next)],
              {
                label: "merged",
                ptrs: { tail },
                tones: toneMap([walk(dummy.next), "ok"]),
              },
              [dummy],
            ),
            lp(walk(p), { label: "list1 (rest)", ptrs: { list1: p } }),
            lp(walk(q), { label: "list2 (rest)", ptrs: { list2: q } }),
          ],
          tone,
        );
      show("A dummy head avoids special cases. Repeatedly splice the smaller front node onto the tail.");
      while (p && q) {
        if (p.val <= q.val) {
          tail.next = p;
          p = p.next;
        } else {
          tail.next = q;
          q = q.next;
        }
        tail = tail.next;
        tail.next = null;
        show(`Take ${tail.val}, the smaller front value.`);
      }
      tail.next = p || q;
      p = q = null;
      show("One list ran out: attach the rest of the other in one step.", "good");
      return vals(dummy.next);
    },
  ),

  "copy-list-with-random-pointer": sim<[(number | null)[][]]>(
    ["head"],
    [
      [
        [
          [7, null],
          [13, 0],
          [11, 4],
          [10, 2],
          [1, 0],
        ],
        [
          [7, null],
          [13, 0],
          [11, 4],
          [10, 2],
          [1, 0],
        ],
      ],
      [
        [
          [1, 1],
          [2, 1],
        ],
        [
          [1, 1],
          [2, 1],
        ],
      ],
    ],
    (t, spec) => {
      need(
        spec.every((x) => Array.isArray(x) && x.length === 2),
        "each node looks like [val, randomIndex or null]",
      );
      const orig = buildList(spec.map((x) => x[0] as number));
      orig.forEach((n, i) => (n.random = spec[i][1] === null ? null : orig[spec[i][1] as number]));
      const clone = new Map<LNode, LNode>();
      const copies: LNode[] = [];
      const show = (note: string, cur?: LNode, tone?: "good") =>
        t.step(
          note,
          [
            {
              ...listPanel(orig, {
                label: "original (dashed = random)",
                random: true,
                ptrs: cur ? { cur } : {},
                tones: toneMap([[cur], "cur"]),
              }),
            },
            { ...listPanel(copies, { label: "copy", random: true }) },
            map("old → new", new Map([...clone].map(([o, c]) => [`#${orig.indexOf(o)}`, `copy of ${c.val}`]))),
          ],
          tone,
        );
      show("Pass 1: create a copy of every node and store old → new in a hash map. Pass 2: wire next and random through the map.");
      for (const n of orig) {
        const c = lnode(n.val);
        clone.set(n, c);
        copies.push(c);
        show(`Copy node ${n.val}.`, n);
      }
      for (const n of orig) {
        const c = clone.get(n)!;
        c.next = n.next ? clone.get(n.next)! : null;
        c.random = n.random ? clone.get(n.random)! : null;
        show(`Wire copy of ${n.val}: next → copy of ${n.next?.val ?? "null"}, random → copy of ${n.random?.val ?? "null"}.`, n);
      }
      show("A deep copy with no pointers back into the original list.", undefined, "good");
      return copies.map((c) => [c.val, c.random ? copies.indexOf(c.random) : null]);
    },
  ),

  "reverse-linked-list-ii": sim<[number[], number, number]>(
    ["head", "left", "right"],
    [
      [[1, 2, 3, 4, 5], 2, 4, [1, 4, 3, 2, 5]],
      [[5], 1, 1, [5]],
      [[1, 2, 3, 4, 5, 6], 1, 6, [6, 5, 4, 3, 2, 1]],
    ],
    (t, values, left, right) => {
      const nodes = buildList(values);
      need(left >= 1 && left <= right && right <= nodes.length, "need 1 ≤ left ≤ right ≤ length");
      const dummy = lnode(0, nodes[0]);
      let prev = dummy;
      const show = (note: string, cur?: LNode | null, nxt?: LNode | null, tone?: "good") =>
        t.step(note, [lp(walk(dummy), { ptrs: { prev, cur, nxt }, tones: toneMap([[nxt], "alt"]) }, [dummy])], tone);
      for (let i = 0; i < left - 1; i++) prev = prev.next!;
      const cur = prev.next!;
      show(`Walk prev to the node before position ${left}. Then repeatedly take the node after cur and move it to the front of the section (right after prev): head insertion.`, cur);
      for (let i = 0; i < right - left; i++) {
        const nxt = cur.next!;
        cur.next = nxt.next;
        nxt.next = prev.next;
        prev.next = nxt;
        show(`Move ${nxt.val} to the front of the section.`, cur, nxt);
      }
      show(`Positions ${left}..${right} are reversed in one pass.`, null, null, "good");
      return vals(dummy.next);
    },
  ),

  "reverse-nodes-in-k-group": sim<[number[], number]>(
    ["head", "k"],
    [
      [[1, 2, 3, 4, 5], 2, [2, 1, 4, 3, 5]],
      [[1, 2, 3, 4, 5], 3, [3, 2, 1, 4, 5]],
    ],
    (t, values, k) => {
      need(k >= 1, "k must be ≥ 1");
      const nodes = buildList(values);
      const dummy = lnode(0, nodes[0] ?? null);
      let gp = dummy;
      const show = (note: string, group: LNode[] = [], tone?: "good") => t.step(note, [lp(walk(dummy), { ptrs: { groupPrev: gp }, tones: toneMap([group, "cur"]) }, [dummy]), vars({ k })], tone);
      show("For each block of k nodes: check that k nodes exist, reverse them in place, then reconnect the block between groupPrev and the node after it.");
      for (;;) {
        let kth: LNode | null = gp;
        const group: LNode[] = [];
        for (let i = 0; i < k && kth; i++) {
          kth = kth.next;
          if (kth) group.push(kth);
        }
        if (!kth) {
          show(`Fewer than ${k} nodes remain: leave them as they are.`, group, "good");
          return vals(dummy.next);
        }
        const groupNext: LNode | null = kth.next;
        show(`Next block: ${group.map((n) => n.val).join(", ")}.`, group);
        let prev: LNode | null = groupNext;
        let cur: LNode | null = gp.next;
        while (cur !== groupNext) {
          const nx: LNode | null = cur!.next;
          cur!.next = prev;
          prev = cur;
          cur = nx;
        }
        const first = gp.next!;
        gp.next = kth;
        gp = first;
        show(
          `Reversed to ${group
            .map((n) => n.val)
            .reverse()
            .join(", ")} and reconnected. groupPrev moves to ${first.val}, the block's new tail.`,
          group,
        );
      }
    },
  ),

  "remove-nth-node-from-end-of-list": sim<[number[], number]>(
    ["head", "n"],
    [
      [[1, 2, 3, 4, 5], 2, [1, 2, 3, 5]],
      [[1], 1, []],
      [[1, 2], 1, [1]],
    ],
    (t, values, n) => {
      const nodes = buildList(values);
      need(n >= 1 && n <= nodes.length, "n must be between 1 and the list length");
      const dummy = lnode(0, nodes[0]);
      let fast: LNode | null = dummy;
      let slow = dummy;
      const show = (note: string, tone?: "good", bad?: LNode | null) => t.step(note, [lp(walk(dummy), { ptrs: { slow, fast }, tones: toneMap([[bad], "bad"]) }, [dummy])], tone);
      show(`Give fast a head start of n + 1 = ${n + 1} steps. When fast falls off the end, slow is just before the node to delete.`);
      for (let i = 0; i <= n; i++) fast = fast!.next;
      show(`fast is ${n + 1} steps ahead.`);
      while (fast) {
        fast = fast.next;
        slow = slow.next!;
        show("Move both one step.");
      }
      const del = slow.next;
      show(`fast is null. slow.next (${del!.val}) is the ${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} from the end: unlink it.`, undefined, del);
      slow.next = del!.next;
      show("Removed in one pass.", "good");
      return vals(dummy.next);
    },
  ),

  "remove-duplicates-from-sorted-list-ii": sim<[number[]]>(
    ["head"],
    [
      [
        [1, 2, 3, 3, 4, 4, 5],
        [1, 2, 5],
      ],
      [
        [1, 1, 1, 2, 3],
        [2, 3],
      ],
    ],
    (t, values) => {
      const nodes = buildList(values);
      const dummy = lnode(0, nodes[0] ?? null);
      let prev = dummy;
      let head: LNode | null = nodes[0] ?? null;
      const gone: LNode[] = [];
      const show = (note: string, tone?: "good") =>
        t.step(note, [lp([dummy, ...nodes], { ptrs: { prev, head }, tones: toneMap([gone, "dim"]) }, [dummy]), lp(walk(dummy), { label: "result so far" }, [dummy])], tone);
      show("prev is the last node we're sure to keep. If head starts a run of duplicates, skip the whole run and link prev past it.");
      while (head) {
        if (head.next && head.val === head.next.val) {
          const v = head.val;
          gone.push(head);
          while (head.next && head.val === head.next.val) {
            head = head.next;
            gone.push(head);
          }
          prev.next = head.next;
          show(`${v} appears more than once: drop every copy. prev.next skips to ${head.next?.val ?? "null"}.`);
        } else {
          prev = prev.next!;
          show(`${head.val} is unique: keep it, prev moves to it.`);
        }
        head = head.next;
      }
      show("Only values that appeared exactly once remain.", "good");
      return vals(dummy.next);
    },
  ),

  "rotate-list": sim<[number[], number]>(
    ["head", "k"],
    [
      [[1, 2, 3, 4, 5], 2, [4, 5, 1, 2, 3]],
      [[0, 1, 2], 4, [2, 0, 1]],
    ],
    (t, values, k0) => {
      const nodes = buildList(values);
      if (!nodes.length) {
        t.step("Empty list.", [lp([])]);
        t.step("Nothing to rotate.", [lp([])], "good");
        return [];
      }
      const n = nodes.length;
      const tail = nodes[n - 1];
      const k = k0 % n;
      t.step(`Length n = ${n}, so rotating by ${k0} is the same as by ${k0} mod ${n} = ${k}.`, [lp(nodes, { ptrs: { head: nodes[0], tail } }), vars({ n, k })]);
      if (k === 0) {
        t.step("k mod n = 0: the list is unchanged.", [lp(nodes)], "good");
        return values;
      }
      tail.next = nodes[0];
      t.step("Close the list into a ring: tail.next = head.", [lp(nodes, { ptrs: { tail } }), vars({ n, k })]);
      const newTail = nodes[n - k - 1];
      const newHead = newTail.next!;
      t.step(`The new tail is n − k − 1 = ${n - k - 1} steps from the head (${newTail.val}); the new head follows it (${newHead.val}).`, [
        lp(nodes, {
          ptrs: { newTail, newHead },
          tones: toneMap([[newHead], "ok"]),
        }),
        vars({ n, k }),
      ]);
      newTail.next = null;
      t.step("Break the ring after the new tail.", [lp(walk(newHead), { ptrs: { head: newHead } })], "good");
      return vals(newHead);
    },
  ),

  "partition-list": sim<[number[], number]>(
    ["head", "x"],
    [
      [[1, 4, 3, 2, 5, 2], 3, [1, 2, 2, 4, 3, 5]],
      [[2, 1], 2, [1, 2]],
    ],
    (t, values, x) => {
      const nodes = buildList(values);
      const before = lnode(0);
      const after = lnode(0);
      let b = before;
      let a = after;
      let head: LNode | null = nodes[0] ?? null;
      const show = (note: string, cur?: LNode | null, tone?: "good") =>
        t.step(
          note,
          [
            lp(walk(head), { label: "input (rest)", ptrs: { head } }),
            lp(walk(before), { label: `< ${x}`, tones: toneMap([[cur], "cur"]) }, [before]),
            lp(walk(after), { label: `≥ ${x}`, tones: toneMap([[cur], "cur"]) }, [after]),
          ],
          tone,
        );
      show(`Build two lists with dummy heads: nodes < ${x} and nodes ≥ ${x}, each keeping the original order. Then join them.`);
      while (head) {
        const node: LNode = head;
        head = head.next;
        node.next = null;
        if (node.val < x) {
          b.next = node;
          b = node;
        } else {
          a.next = node;
          a = node;
        }
        show(`${node.val} ${node.val < x ? "<" : "≥"} ${x}: append to the ${node.val < x ? "first" : "second"} list.`, node);
      }
      a.next = null;
      b.next = after.next;
      const res = before.next;
      t.step("Link the end of the small list to the start of the big list.", [lp(walk(res), { label: "result" })], "good");
      return vals(res);
    },
  ),

  "lru-cache": sim<[string[], number[][]]>(
    ["ops", "args"],
    [
      [
        ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
        [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
        [null, null, null, 1, null, -1, null, -1, 3, 4],
      ],
      [
        ["LRUCache", "put", "put", "put", "get", "put", "get"],
        [[2], [1, 10], [2, 20], [1, 15], [2], [3, 30], [1]],
        [null, null, null, null, 20, null, -1],
      ],
    ],
    (t, ops, args) => {
      let cap = 0;
      const order: [number, number][] = [];
      const res: unknown[] = [];
      const show = (note: string, hiKey?: number, tone: Tone = "cur") => {
        const nodes = order.map(([k, v], i) => ({
          id: `k${k}`,
          val: `${k}:${v}`,
          next: i + 1 < order.length ? `k${order[i + 1][0]}` : null,
          tone: k === hiKey ? tone : undefined,
        }));
        t.step(note, [
          {
            kind: "list",
            label: "most recent ← → least recent",
            nodes,
            ptrs: order.length
              ? {
                  MRU: `k${order[0][0]}`,
                  LRU: `k${order[order.length - 1][0]}`,
                }
              : {},
          },
          map("map (key → node)", new Map(order.map(([k]) => [k, `node ${k}`])), hiKey === undefined ? [] : [hiKey]),
          out(
            "returned",
            res.map((r) => (r === null ? "null" : String(r))),
          ),
        ]);
      };
      ops.forEach((op, i) => {
        const a = args[i];
        if (op === "LRUCache") {
          cap = a[0];
          need(cap >= 1, "capacity must be ≥ 1");
          res.push(null);
          show(`Capacity ${cap}. A hash map finds nodes in O(1); a doubly linked list keeps them in recency order so moving and evicting are O(1) too.`);
        } else if (op === "get") {
          const idx = order.findIndex(([k]) => k === a[0]);
          if (idx < 0) {
            res.push(-1);
            show(`get(${a[0]}): not in the map → −1.`);
          } else {
            const [node] = order.splice(idx, 1);
            order.unshift(node);
            res.push(node[1]);
            show(`get(${a[0]}) = ${node[1]}. Using it makes it the most recent: move it to the front.`, a[0], "ok");
          }
        } else if (op === "put") {
          const [k, v] = a;
          const idx = order.findIndex(([kk]) => kk === k);
          if (idx >= 0) order.splice(idx, 1);
          order.unshift([k, v]);
          res.push(null);
          if (order.length > cap) {
            show(`put(${k}, ${v}) at the front. Now ${order.length} > capacity ${cap}...`, k, "ok");
            const [lk] = order[order.length - 1];
            show(`...so evict the least recently used key ${lk} from the tail.`, lk, "bad");
            order.pop();
            show(`Evicted ${lk}.`);
          } else show(`put(${k}, ${v}): ${idx >= 0 ? "update the value and " : ""}put it at the front.`, k, "ok");
        } else throw new Error(`unknown op ${op}`);
      });
      return res;
    },
  ),
};
