import { arr, grid, need, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim, Tracer } from "@/lib/sim/types";

/** half-open lower bound: first index with nums[i] >= x */
function lower(t: Tracer, nums: number[], x: number, what: string) {
  let lo = 0;
  let hi = nums.length;
  const show = (note: string, mid?: number) =>
    t.step(note, [
      arr(nums, {
        ptrs: mid === undefined ? { lo, hi } : { lo, mid, hi },
        win: lo < hi ? [lo, hi - 1] : null,
        tones: tones([range(0, lo), "dim"], [range(hi, nums.length), "dim"], [mid === undefined ? [] : [mid], "cmp"]),
      }),
      vars({ lo, hi, [what]: x }),
    ]);
  show(`Find the first index whose value is ≥ ${x}. The answer always stays inside [lo, hi).`);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] < x) {
      show(`nums[${mid}] = ${nums[mid]} < ${x}: the answer is to the right, lo = ${mid + 1}.`, mid);
      lo = mid + 1;
    } else {
      show(`nums[${mid}] = ${nums[mid]} ≥ ${x}: mid could be the answer, hi = ${mid}.`, mid);
      hi = mid;
    }
  }
  return lo;
}

export const SIMS: Record<string, Sim> = {
  "search-insert-position": sim<[number[], number]>(
    ["nums", "target"],
    [
      [[1, 3, 5, 6], 5, 2],
      [[1, 3, 5, 6], 2, 1],
      [[1, 3, 5, 6], 7, 4],
    ],
    (t, nums, target) => {
      const i = lower(t, nums, target, "target");
      t.step(`lo = hi = ${i}: ${nums[i] === target ? "target found there" : "that's where target would be inserted"}.`, [arr(nums, { ptrs: { answer: i }, tones: tones([[i], "ok"]) })], "good");
      return i;
    },
  ),

  "search-a-2d-matrix": sim<[number[][], number]>(
    ["matrix", "target"],
    [
      [
        [
          [1, 3, 5, 7],
          [10, 11, 16, 20],
          [23, 30, 34, 60],
        ],
        3,
        true,
      ],
      [
        [
          [1, 3, 5, 7],
          [10, 11, 16, 20],
          [23, 30, 34, 60],
        ],
        13,
        false,
      ],
    ],
    (t, m, target) => {
      need(m.length && m.every((r) => r.length === m[0].length), "matrix must be a rectangle");
      const R = m.length;
      const C = m[0].length;
      let lo = 0;
      let hi = R * C - 1;
      const cellTones = (mid?: number) => {
        const tn: Record<string, "dim" | "cmp" | "ok"> = {};
        for (let k = 0; k < R * C; k++) if (k < lo || k > hi) tn[`${Math.floor(k / C)},${k % C}`] = "dim";
        if (mid !== undefined) tn[`${Math.floor(mid / C)},${mid % C}`] = m[Math.floor(mid / C)][mid % C] === target ? "ok" : "cmp";
        return tn;
      };
      t.step(`Read row by row, the matrix is one sorted list of ${R * C} values. Binary search on index k, where cell = (k ÷ ${C}, k mod ${C}).`, [
        grid(m, { tones: cellTones() }),
        vars({ lo, hi, target }),
      ]);
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = m[Math.floor(mid / C)][mid % C];
        if (v === target) {
          t.step(`k = ${mid} → (${Math.floor(mid / C)},${mid % C}) = ${v}. Found it.`, [grid(m, { tones: cellTones(mid) }), vars({ lo, hi, mid })], "good");
          return true;
        }
        t.step(`k = ${mid} → (${Math.floor(mid / C)},${mid % C}) = ${v} ${v < target ? "<" : ">"} ${target}: discard the ${v < target ? "left" : "right"} half.`, [
          grid(m, { tones: cellTones(mid) }),
          vars({ lo, hi, mid }),
        ]);
        if (v < target) lo = mid + 1;
        else hi = mid - 1;
      }
      t.step(`The range is empty: ${target} isn't in the matrix.`, [grid(m, { tones: cellTones() }), vars({ lo, hi })], "bad");
      return false;
    },
  ),

  "find-peak-element": sim<[number[]]>(
    ["nums"],
    [
      [[1, 2, 3, 1], 2],
      [[1, 2, 1, 3, 5, 6, 4], 5],
    ],
    (t, nums) => {
      let lo = 0;
      let hi = nums.length - 1;
      const show = (note: string, mid?: number, tone?: "good") =>
        t.step(
          note,
          [
            arr(nums, {
              bars: true,
              ptrs: mid === undefined ? { lo, hi } : { lo, mid, hi },
              win: [lo, hi],
              tones: tones([mid === undefined ? [] : [mid, mid + 1], "cmp"]),
            }),
          ],
          tone,
        );
      show("Compare nums[mid] with its right neighbour. If the slope goes UP, a peak must exist to the right (the values can't rise forever). Otherwise one exists at mid or to its left.");
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] < nums[mid + 1]) {
          show(`${nums[mid]} < ${nums[mid + 1]}: uphill to the right, lo = ${mid + 1}.`, mid);
          lo = mid + 1;
        } else {
          show(`${nums[mid]} > ${nums[mid + 1]}: downhill, so a peak is at mid or left of it. hi = ${mid}.`, mid);
          hi = mid;
        }
      }
      t.step(`lo = hi = ${lo}: nums[${lo}] = ${nums[lo]} is a peak.`, [arr(nums, { bars: true, tones: tones([[lo], "ok"]) })], "good");
      return lo;
    },
  ),

  "search-in-rotated-sorted-array": sim<[number[], number]>(
    ["nums", "target"],
    [
      [[4, 5, 6, 7, 0, 1, 2], 0, 4],
      [[4, 5, 6, 7, 0, 1, 2], 3, -1],
      [[1], 0, -1],
    ],
    (t, nums, target) => {
      let lo = 0;
      let hi = nums.length - 1;
      const show = (note: string, mid?: number, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            arr(nums, {
              ptrs: mid === undefined ? { lo, hi } : { lo, mid, hi },
              win: lo <= hi ? [lo, hi] : null,
              tones: tones([range(0, lo), "dim"], [range(hi + 1, nums.length), "dim"], [mid === undefined ? [] : [mid], nums[mid ?? 0] === target ? "ok" : "cmp"]),
            }),
            vars({ target }),
          ],
          tone,
        );
      show("A rotated sorted array: at any mid, at least one half is properly sorted. Check whether target lies inside that sorted half; if not, it's in the other one.");
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) {
          show(`nums[${mid}] = ${target}. Found.`, mid, "good");
          return mid;
        }
        if (nums[lo] <= nums[mid]) {
          const inLeft = nums[lo] <= target && target < nums[mid];
          show(`Left half [${nums[lo]}..${nums[mid]}] is sorted. ${target} ${inLeft ? "is" : "isn't"} in it → search ${inLeft ? "left" : "right"}.`, mid);
          if (inLeft) hi = mid - 1;
          else lo = mid + 1;
        } else {
          const inRight = nums[mid] < target && target <= nums[hi];
          show(`Right half [${nums[mid]}..${nums[hi]}] is sorted. ${target} ${inRight ? "is" : "isn't"} in it → search ${inRight ? "right" : "left"}.`, mid);
          if (inRight) lo = mid + 1;
          else hi = mid - 1;
        }
      }
      show(`${target} isn't in the array: −1.`, undefined, "bad");
      return -1;
    },
  ),

  "find-first-and-last-position-of-element-in-sorted-array": sim<[number[], number]>(
    ["nums", "target"],
    [
      [[5, 7, 7, 8, 8, 10], 8, [3, 4]],
      [[5, 7, 7, 8, 8, 10], 6, [-1, -1]],
      [[2, 2, 2], 2, [0, 2]],
    ],
    (t, nums, target) => {
      const first = lower(t, nums, target, "x");
      if (first === nums.length || nums[first] !== target) {
        t.step(`The first value ≥ ${target} ${first === nums.length ? "doesn't exist" : `is ${nums[first]}`}, not ${target}: it's absent. [−1, −1].`, [arr(nums)], "bad");
        return [-1, -1];
      }
      t.step(`First ${target} is at ${first}. The last one is just before the first value ≥ ${target + 1}: run the same search again.`, [arr(nums, { tones: tones([[first], "ok"]) })]);
      const last = lower(t, nums, target + 1, "x") - 1;
      t.step(
        `Range = [${first}, ${last}]. Two O(log n) searches.`,
        [
          arr(nums, {
            win: [first, last],
            tones: tones([range(first, last + 1), "ok"]),
          }),
        ],
        "good",
      );
      return [first, last];
    },
  ),

  "find-minimum-in-rotated-sorted-array": sim<[number[]]>(
    ["nums"],
    [
      [[3, 4, 5, 1, 2], 1],
      [[4, 5, 6, 7, 0, 1, 2], 0],
      [[11, 13, 15, 17], 11],
    ],
    (t, nums) => {
      let lo = 0;
      let hi = nums.length - 1;
      const show = (note: string, mid?: number) =>
        t.step(note, [
          arr(nums, {
            ptrs: mid === undefined ? { lo, hi } : { lo, mid, hi },
            win: [lo, hi],
            tones: tones([mid === undefined ? [] : [mid, hi], "cmp"]),
          }),
        ]);
      show("Compare nums[mid] with nums[hi]. If mid is bigger, the drop (the minimum) is to the right of mid. Otherwise mid..hi is sorted and the minimum is at mid or to its left.");
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] > nums[hi]) {
          show(`${nums[mid]} > ${nums[hi]}: the rotation point is right of mid. lo = ${mid + 1}.`, mid);
          lo = mid + 1;
        } else {
          show(`${nums[mid]} ≤ ${nums[hi]}: mid..hi is sorted, minimum is at mid or left. hi = ${mid}.`, mid);
          hi = mid;
        }
      }
      t.step(`Minimum = nums[${lo}] = ${nums[lo]}.`, [arr(nums, { tones: tones([[lo], "ok"]) })], "good");
      return nums[lo];
    },
  ),

  "median-of-two-sorted-arrays": sim<[number[], number[]]>(
    ["nums1", "nums2"],
    [
      [[1, 3], [2], 2],
      [[1, 2], [3, 4], 2.5],
      [[1, 3, 8, 9, 15], [7, 11, 18, 19, 21, 25], 11],
    ],
    (t, nums1, nums2) => {
      need(nums1.length + nums2.length > 0, "at least one value overall");
      const [A, B] = nums1.length <= nums2.length ? [nums1, nums2] : [nums2, nums1];
      const m = A.length;
      const n = B.length;
      const half = (m + n + 1) >> 1;
      let lo = 0;
      let hi = m;
      t.step(
        `Binary-search a cut in the SHORTER array A. If A gives i elements to the left half, B must give j = ${half} − i. The cut is right when everything on the left ≤ everything on the right.`,
        [arr(A, { label: "A (shorter)" }), arr(B, { label: "B" }), vars({ half })],
      );
      for (;;) {
        const i = (lo + hi) >> 1;
        const j = half - i;
        const al = i > 0 ? A[i - 1] : -Infinity;
        const ar = i < m ? A[i] : Infinity;
        const bl = j > 0 ? B[j - 1] : -Infinity;
        const br = j < n ? B[j] : Infinity;
        const f = (x: number) => (x === Infinity ? "∞" : x === -Infinity ? "−∞" : x);
        const panels = [
          arr(A, {
            label: "A (shorter)",
            tones: tones([range(0, i), "pick"], [range(i, m), "alt"]),
          }),
          arr(B, {
            label: "B",
            tones: tones([range(0, j), "pick"], [range(j, n), "alt"]),
          }),
          vars({
            i,
            j,
            Aleft: f(al),
            Aright: f(ar),
            Bleft: f(bl),
            Bright: f(br),
          }),
        ];
        if (al <= br && bl <= ar) {
          const ans = (m + n) % 2 ? Math.max(al, bl) : (Math.max(al, bl) + Math.min(ar, br)) / 2;
          t.step(
            `Cut i = ${i}, j = ${j} works: ${f(al)} ≤ ${f(br)} and ${f(bl)} ≤ ${f(ar)}. ${(m + n) % 2 ? `Odd total: median = max of the left side = ${ans}.` : `Even total: median = (max left + min right) / 2 = ${ans}.`}`,
            panels,
            "good",
          );
          return ans;
        }
        t.step(al > br ? `A's left max ${al} > B's right min ${br}: A gives too many, move the cut left.` : `B's left max ${bl} > A's right min ${ar}: A gives too few, move the cut right.`, panels);
        if (al > br) hi = i - 1;
        else lo = i + 1;
      }
    },
  ),
};
