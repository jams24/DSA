import { arr, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "maximum-subarray": sim<[number[]]>(
    ["nums"],
    [
      [[-2, 1, -3, 4, -1, 2, 1, -5, 4], 6],
      [[1], 1],
      [[5, 4, -1, 7, 8], 23],
    ],
    (t, nums) => {
      let best = nums[0];
      let cur = nums[0];
      let start = 0;
      let bs = 0;
      let be = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(nums, {
              ptrs: { i },
              win: [start, i],
              tones: tones([range(bs, be + 1), "ok"], [[i], "cur"]),
            }),
            vars({ cur, best }),
          ],
          tone,
        );
      show(0, "Kadane: cur is the best sum of a subarray ENDING here. At each element either extend the previous run or start fresh, whichever is bigger.");
      for (let i = 1; i < nums.length; i++) {
        const x = nums[i];
        const fresh = x > cur + x;
        cur = fresh ? x : cur + x;
        if (fresh) start = i;
        if (cur > best) {
          best = cur;
          bs = start;
          be = i;
        }
        show(
          i,
          fresh
            ? `${x} alone beats extending (the previous run sum is negative): start a new run here. cur = ${cur}.`
            : `Extend the run with ${x}: cur = ${cur}.${best === cur && be === i ? " New best!" : ""}`,
        );
      }
      show(nums.length - 1, `Maximum subarray sum = ${best}.`, "good");
      return best;
    },
  ),

  "maximum-sum-circular-subarray": sim<[number[]]>(
    ["nums"],
    [
      [[1, -2, 3, -2], 3],
      [[5, -3, 5], 10],
      [[-3, -2, -3], -2],
    ],
    (t, nums) => {
      let total = 0;
      let curMax = 0;
      let curMin = 0;
      let bestMax = -Infinity;
      let bestMin = Infinity;
      const v = () =>
        vars({
          total,
          curMax,
          bestMax,
          curMin,
          bestMin: bestMin === Infinity ? "∞" : bestMin,
        });
      t.step("A circular subarray either doesn't wrap (normal Kadane max) or wraps around, which means it's the total MINUS some middle subarray. So run Kadane for both the max and the min.", [
        arr(nums),
        v(),
      ]);
      nums.forEach((x, i) => {
        curMax = Math.max(x, curMax + x);
        bestMax = Math.max(bestMax, curMax);
        curMin = Math.min(x, curMin + x);
        bestMin = Math.min(bestMin, curMin);
        total += x;
        t.step(`x = ${x}: best max run ${bestMax}, best min run ${bestMin}, total ${total}.`, [arr(nums, { ptrs: { i }, tones: tones([[i], "cur"]) }), v()]);
      });
      const ans = bestMax < 0 ? bestMax : Math.max(bestMax, total - bestMin);
      t.step(
        bestMax < 0
          ? `Every number is negative (best max ${bestMax} < 0). total − min would mean an empty subarray, so the answer is ${bestMax}.`
          : `Answer = max(no wrap ${bestMax}, wrap ${total} − ${bestMin} = ${total - bestMin}) = ${ans}.`,
        [arr(nums), v()],
        "good",
      );
      return ans;
    },
  ),
};
