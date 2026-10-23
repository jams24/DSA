import { arr, buildTree, fmt, need, out, range, sim, stack, tones, treePanel, vars } from "@/lib/sim/build";
import type { Sim, TreePanel } from "@/lib/sim/types";

/** binary heap on an array, ordered by `less` */
class Heap<T> {
  items: T[] = [];
  constructor(private less: (a: T, b: T) => boolean) {}
  get size() {
    return this.items.length;
  }
  peek() {
    return this.items[0];
  }
  push(x: T) {
    const a = this.items;
    a.push(x);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): T {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

const heapTree = (items: number[], label: string): TreePanel => ({
  ...treePanel(buildTree(items)),
  label,
});

export const SIMS: Record<string, Sim> = {
  "kth-largest-element-in-an-array": sim<[number[], number]>(
    ["nums", "k"],
    [
      [[3, 2, 1, 5, 6, 4], 2, 5],
      [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4, 4],
    ],
    (t, nums, k) => {
      need(k >= 1 && k <= nums.length, "1 ≤ k ≤ length");
      const h = new Heap<number>((a, b) => a < b);
      t.step(`Keep a MIN-heap of the ${k} largest values seen so far. Whenever it grows past k, pop the smallest. At the end its root is the kth largest. O(n log k).`, [
        arr(nums),
        heapTree([], "min-heap"),
      ]);
      nums.forEach((x, i) => {
        h.push(x);
        let note = `Push ${x}.`;
        if (h.size > k) note += ` Size ${h.size} > ${k}: pop the smallest, ${h.pop()}.`;
        t.step(note, [
          arr(nums, {
            ptrs: { i },
            tones: tones([range(0, i), "dim"], [[i], "cur"]),
          }),
          heapTree(h.items, `min-heap (size ≤ ${k})`),
          vars({ root: h.peek() }),
        ]);
      });
      t.step(`The root ${h.peek()} is the ${k}th largest.`, [heapTree(h.items, "min-heap")], "good");
      return h.peek();
    },
  ),

  ipo: sim<[number, number, number[], number[]]>(
    ["k", "w", "profits", "capital"],
    [
      [2, 0, [1, 2, 3], [0, 1, 1], 4],
      [3, 0, [1, 2, 3], [0, 1, 2], 6],
    ],
    (t, k, w, profits, capital) => {
      need(profits.length === capital.length, "profits and capital must match");
      const projects = capital.map((c, i) => [c, profits[i]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const h = new Heap<number>((a, b) => a > b);
      let i = 0;
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(
              projects.map(([c, p]) => `${c}→${p}`),
              {
                label: "projects sorted by capital (capital→profit)",
                ptrs: i < projects.length ? { next: i } : {},
                tones: tones([range(0, i), "dim"]),
              },
            ),
            stack(
              "affordable profits (max-heap)",
              [...h.items].sort((a, b) => a - b),
            ),
            vars({ capital: w, "projects left": k }),
          ],
          tone,
        );
      show(
        "Sort projects by required capital. Each round: move every project you can now afford into a max-heap of profits, then do the most profitable one. Greedy works because capital only grows.",
      );
      for (let round = 0; round < k; round++) {
        while (i < projects.length && projects[i][0] <= w) h.push(projects[i++][1]);
        if (!h.size) {
          show("No affordable project left: stop early.");
          break;
        }
        const p = h.pop();
        w += p;
        show(`Round ${round + 1}: unlock everything needing ≤ ${w - p}, then take the best profit ${p}. Capital = ${w}.`);
      }
      show(`Final capital = ${w}.`, "good");
      return w;
    },
  ),

  "find-k-pairs-with-smallest-sums": sim<[number[], number[], number]>(
    ["nums1", "nums2", "k"],
    [
      [
        [1, 7, 11],
        [2, 4, 6],
        3,
        [
          [1, 2],
          [1, 4],
          [1, 6],
        ],
      ],
      [
        [1, 1, 2],
        [1, 2, 3],
        2,
        [
          [1, 1],
          [1, 1],
        ],
      ],
    ],
    (t, a, b, k) => {
      need(a.length && b.length && k >= 1, "both arrays non-empty, k ≥ 1");
      type E = [number, number, number];
      const h = new Heap<E>((x, y) => x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2]))));
      for (let i = 0; i < Math.min(k, a.length); i++) h.push([a[i] + b[0], i, 0]);
      const res: number[][] = [];
      const show = (note: string, cur?: E, tone?: "good") =>
        t.step(
          note,
          [
            arr(a, { label: "nums1", ptrs: cur ? { i: cur[1] } : {} }),
            arr(b, { label: "nums2", ptrs: cur ? { j: cur[2] } : {} }),
            stack(
              "min-heap (sum: i, j)",
              [...h.items].sort((x, y) => y[0] - x[0]).map(([s, i, j]) => `${s}: ${i},${j}`),
            ),
            out("pairs", res.map(fmt)),
          ],
          tone,
        );
      show("Think of a sorted grid of sums nums1[i] + nums2[j]. Seed the heap with (i, 0) for each row; each time you pop (i, j), push its right neighbour (i, j+1). Like merging k sorted lists.");
      while (h.size && res.length < k) {
        const e = h.pop();
        const [, i, j] = e;
        res.push([a[i], b[j]]);
        if (j + 1 < b.length) h.push([a[i] + b[j + 1], i, j + 1]);
        show(`Pop the smallest sum ${e[0]} = ${a[i]} + ${b[j]}.${j + 1 < b.length ? ` Push (${i}, ${j + 1}).` : ""}`, e);
      }
      show(`The ${res.length} smallest pairs.`, undefined, "good");
      return res;
    },
  ),

  "find-median-from-data-stream": sim<[string[], number[][]]>(
    ["ops", "args"],
    [
      [
        ["MedianFinder", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
        [[], [1], [2], [], [3], []],
        [null, null, null, 1.5, null, 2],
      ],
      [
        ["MedianFinder", "addNum", "addNum", "addNum", "addNum", "findMedian", "addNum", "findMedian"],
        [[], [6], [10], [2], [6], [], [5], []],
        [null, null, null, null, null, 6, null, 6],
      ],
    ],
    (t, ops, args) => {
      const low = new Heap<number>((a, b) => a > b);
      const high = new Heap<number>((a, b) => a < b);
      const res: unknown[] = [];
      const show = (note: string) =>
        t.step(note, [
          stack(
            "low half (max-heap, top = largest)",
            [...low.items].sort((a, b) => a - b),
          ),
          stack(
            "high half (min-heap, top = smallest)",
            [...high.items].sort((a, b) => b - a),
          ),
          out("returned", res.map(fmt)),
        ]);
      ops.forEach((op, i) => {
        if (op === "MedianFinder") {
          res.push(null);
          show("Two heaps split the numbers in half: a max-heap for the lower half and a min-heap for the upper half. The median lives at their tops.");
        } else if (op === "addNum") {
          const x = args[i][0];
          low.push(x);
          high.push(low.pop());
          if (high.size > low.size) low.push(high.pop());
          res.push(null);
          show(`addNum(${x}): push into low, move low's max to high (keeps every low ≤ every high), then rebalance so low has the same size or one more.`);
        } else if (op === "findMedian") {
          need(low.size, "findMedian on an empty stream");
          const m = low.size > high.size ? low.peek() : (low.peek() + high.peek()) / 2;
          res.push(m);
          show(low.size > high.size ? `Odd count: median = top of low = ${m}.` : `Even count: median = (${low.peek()} + ${high.peek()}) / 2 = ${m}.`);
        } else throw new Error(`unknown op ${op}`);
      });
      return res;
    },
  ),
};
