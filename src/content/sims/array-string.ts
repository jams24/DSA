import { arr, chars, fmt, grid, map, need, out, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim, Tone } from "@/lib/sim/types";

const sp = (s: string) => [...s].map((c) => (c === " " ? "␣" : c));

export const SIMS: Record<string, Sim> = {
  "merge-sorted-array": sim<[number[], number, number[], number]>(
    ["nums1", "m", "nums2", "n"],
    [
      [[1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3, [1, 2, 2, 3, 5, 6]],
      [[4, 5, 6, 0, 0, 0], 3, [1, 2, 3], 3, [1, 2, 3, 4, 5, 6]],
      [[0], 0, [1], 1, [1]],
    ],
    (t, nums1, m, nums2, n) => {
      need(nums1.length === m + n, "nums1 must hold m values followed by n placeholder zeros");
      let i = m - 1;
      let j = n - 1;
      let k = m + n - 1;
      const show = (note: string, tone?: "good") =>
        t.step(note, [arr(nums1, { label: "nums1", ptrs: { i, k }, tones: tones([range(k + 1, m + n), "ok"], [i >= 0 ? [i] : [], "cmp"]) }), arr(nums2, { label: "nums2", ptrs: { j }, tones: tones([range(j + 1, n), "dim"], [j >= 0 ? [j] : [], "cmp"]) }), vars({ i, j, k })], tone);
      show("Fill nums1 from the BACK. k is the last free slot; i and j point at the largest value not yet placed in each array.");
      while (j >= 0) {
        if (i >= 0 && nums1[i] > nums2[j]) {
          const v = nums1[i];
          nums1[k] = v;
          i--;
          k--;
          show(`nums1[i] = ${v} is bigger than nums2[j] = ${nums2[j]}, so ${v} goes to slot ${k + 1}. Move i left.`);
        } else {
          const v = nums2[j];
          nums1[k] = v;
          j--;
          k--;
          show(i >= 0 ? `nums2[j] = ${v} ≥ nums1[i] = ${nums1[i]}, so ${v} goes to slot ${k + 1}. Move j left.` : `nums1 is used up, so copy nums2[j] = ${v} into slot ${k + 1}.`);
        }
      }
      show(`j < 0: every value from nums2 is placed. Whatever remains in nums1 was already in the right spot. Result ${fmt(nums1)}.`, "good");
      return nums1;
    },
  ),

  "remove-element": sim<[number[], number]>(
    ["nums", "val"],
    [
      [[3, 2, 2, 3], 3, 2],
      [[0, 1, 2, 2, 3, 0, 4, 2], 2, 5],
    ],
    (t, nums, val) => {
      let k = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(note, [arr(nums, { ptrs: i < nums.length ? { i, k } : { k }, tones: tones([range(0, k), "ok"], [i < nums.length ? [i] : [], nums[i] === val ? "bad" : "cur"]) }), vars({ val, k })], tone);
      show(0, `k = 0 is the next write slot. Read every value with i and keep only those ≠ ${val}.`);
      for (let i = 0; i < nums.length; i++) {
        const x = nums[i];
        if (x !== val) {
          nums[k] = x;
          k++;
          show(i, `nums[${i}] = ${x} is kept: write it to slot ${k - 1}, then k = ${k}.`);
        } else show(i, `nums[${i}] = ${x} equals val, so skip it. k stays ${k}.`);
      }
      show(nums.length, `Done. The first k = ${k} slots hold the kept values.`, "good");
      return k;
    },
  ),

  "remove-duplicates-from-sorted-array": sim<[number[]]>(
    ["nums"],
    [
      [[1, 1, 2], 2],
      [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4], 5],
    ],
    (t, nums) => {
      let k = 1;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(note, [arr(nums, { ptrs: i < nums.length ? { i, k } : { k }, tones: tones([range(0, k), "ok"], [i < nums.length ? [i] : [], "cur"], [k > 0 && i < nums.length ? [k - 1] : [], "cmp"]) }), vars({ k, "last kept": nums[k - 1] })], tone);
      show(1, "The first value is always kept (k = 1). Duplicates sit next to each other, so compare each value with the last one kept, nums[k−1].");
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[k - 1]) {
          nums[k] = nums[i];
          k++;
          show(i, `${nums[i]} ≠ last kept ${nums[k - 2]} → new value. Write it at slot ${k - 1}.`);
        } else show(i, `${nums[i]} = last kept → duplicate, skip.`);
      }
      show(nums.length, `k = ${k} unique values: ${fmt(nums.slice(0, k))}.`, "good");
      return k;
    },
  ),

  "remove-duplicates-from-sorted-array-ii": sim<[number[]]>(
    ["nums"],
    [
      [[1, 1, 1, 2, 2, 3], 5],
      [[0, 0, 1, 1, 1, 1, 2, 3, 3], 7],
    ],
    (t, nums) => {
      const src = [...nums];
      let k = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(note, [arr(src, { label: "read (original)", ptrs: i < src.length ? { i } : {}, tones: tones([i < src.length ? [i] : [], "cur"]) }), arr(nums, { label: "nums (written)", ptrs: { k }, tones: tones([range(0, k), "ok"], [k >= 2 && i < src.length ? [k - 2] : [], "cmp"]) }), vars({ k })], tone);
      show(0, "Allow each value twice: keep x unless it equals nums[k−2]. If it did, x would be the third copy.");
      for (let i = 0; i < src.length; i++) {
        const x = src[i];
        if (k < 2 || x !== nums[k - 2]) {
          const why = k < 2 ? "one of the first two" : `${x} ≠ nums[k−2] = ${nums[k - 2]}`;
          nums[k] = x;
          k++;
          show(i, `${why} → keep ${x} at slot ${k - 1}.`);
        } else show(i, `${x} = nums[k−2] → a third copy. Skip it.`);
      }
      show(src.length, `k = ${k}: ${fmt(nums.slice(0, k))}.`, "good");
      return k;
    },
  ),

  "majority-element": sim<[number[]]>(
    ["nums"],
    [
      [[3, 2, 3], 3],
      [[2, 2, 1, 1, 1, 2, 2], 2],
    ],
    (t, nums) => {
      let cand: number | null = null;
      let count = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(note, [arr(nums, { ptrs: i < nums.length ? { i } : {}, tones: tones([range(0, nums.length).filter((j) => j < i && nums[j] === cand), "pick"], [i < nums.length ? [i] : [], "cur"]) }), vars({ candidate: cand, count }, ["count"])], tone);
      show(0, "Boyer–Moore voting: the candidate gains a vote from equal values and loses one from different values. The majority can't be voted out.");
      for (let i = 0; i < nums.length; i++) {
        const x = nums[i];
        let note = "";
        if (count === 0) {
          cand = x;
          note = `count is 0, so ${x} becomes the new candidate. `;
        }
        count += x === cand ? 1 : -1;
        show(i, note + (x === cand ? `${x} votes for the candidate: count = ${count}.` : `${x} votes against candidate ${cand}: count = ${count}.`));
      }
      show(nums.length, `The candidate left standing is ${cand}, the majority element.`, "good");
      return cand;
    },
  ),

  "rotate-array": sim<[number[], number]>(
    ["nums", "k"],
    [
      [[1, 2, 3, 4, 5, 6, 7], 3, [5, 6, 7, 1, 2, 3, 4]],
      [[-1, -100, 3, 99], 2, [3, 99, -1, -100]],
    ],
    (t, nums, k0) => {
      const n = nums.length;
      need(n > 0, "nums must not be empty");
      const k = k0 % n;
      const rev = (lo: number, hi: number, phase: string) => {
        const win: [number, number] = [lo, hi];
        t.step(`${phase}: reverse indexes ${lo}..${hi}.`, [arr(nums, { win, ptrs: { lo, hi }, tones: tones([[lo, hi], "cmp"]) }), vars({ k })]);
        while (lo < hi) {
          [nums[lo], nums[hi]] = [nums[hi], nums[lo]];
          t.step(`Swap positions ${lo} and ${hi}.`, [arr(nums, { win, ptrs: { lo, hi }, tones: tones([[lo, hi], "alt"]) }), vars({ k })]);
          lo++;
          hi--;
        }
      };
      t.step(`Rotate right by k = ${k0}${k0 !== k ? ` (k mod n = ${k})` : ""}. Trick: reverse everything, then reverse the first k and the last n−k separately.`, [arr(nums), vars({ k })]);
      rev(0, n - 1, "Step 1");
      if (k > 0) rev(0, k - 1, "Step 2");
      rev(k, n - 1, "Step 3");
      t.step(`Rotated in place with O(1) extra space: ${fmt(nums)}.`, [arr(nums, { tones: tones([range(0, n), "ok"]) }), vars({ k })], "good");
      return nums;
    },
  ),

  "best-time-to-buy-and-sell-stock": sim<[number[]]>(
    ["prices"],
    [
      [[7, 1, 5, 3, 6, 4], 5],
      [[7, 6, 4, 3, 1], 0],
    ],
    (t, prices) => {
      let low = Infinity;
      let lowAt = -1;
      let best = 0;
      let bestPair: [number, number] | null = null;
      for (let d = 0; d < prices.length; d++) {
        const p = prices[d];
        let note: string;
        if (p < low) {
          low = p;
          lowAt = d;
          note = `Day ${d}: price ${p} is the cheapest so far. That's the best day to have bought.`;
        } else if (p - low > best) {
          best = p - low;
          bestPair = [lowAt, d];
          note = `Day ${d}: selling at ${p} after buying at ${low} earns ${best}, a new best.`;
        } else note = `Day ${d}: selling at ${p} earns ${p - low}, not better than ${best}.`;
        t.step(note, [arr(prices, { bars: true, ptrs: { buy: lowAt, day: d }, tones: tones([bestPair ?? [], "ok"], [[lowAt], "pick"], [[d], "cur"]) }), vars({ lowest: low, best })]);
      }
      t.step(`One pass, tracking the lowest price so far. Max profit = ${best}.`, [arr(prices, { bars: true, tones: tones([bestPair ?? [], "ok"]) }), vars({ lowest: low, best })], "good");
      return best;
    },
  ),

  "best-time-to-buy-and-sell-stock-ii": sim<[number[]]>(
    ["prices"],
    [
      [[7, 1, 5, 3, 6, 4], 7],
      [[1, 2, 3, 4, 5], 4],
      [[7, 6, 4, 3, 1], 0],
    ],
    (t, prices) => {
      let total = 0;
      const ups: number[] = [];
      t.step("Unlimited trades: you collect every single upward move. Any long climb is just the sum of its daily steps.", [arr(prices, { bars: true }), vars({ profit: 0 })]);
      for (let i = 1; i < prices.length; i++) {
        const gain = prices[i] - prices[i - 1];
        if (gain > 0) {
          total += gain;
          ups.push(i - 1, i);
        }
        t.step(gain > 0 ? `${prices[i - 1]} → ${prices[i]} goes up: buy yesterday, sell today, +${gain}.` : `${prices[i - 1]} → ${prices[i]} doesn't go up: skip.`, [arr(prices, { bars: true, ptrs: { i }, tones: tones([ups, "ok"], [[i - 1, i], gain > 0 ? "ok" : "bad"]) }), vars({ gain, profit: total }, ["profit"])]);
      }
      t.step(`Total profit = ${total}.`, [arr(prices, { bars: true, tones: tones([ups, "ok"]) }), vars({ profit: total })], "good");
      return total;
    },
  ),

  "jump-game": sim<[number[]]>(
    ["nums"],
    [
      [[2, 3, 1, 1, 4], true],
      [[3, 2, 1, 0, 4], false],
    ],
    (t, nums) => {
      let reach = 0;
      const show = (i: number, note: string, tone?: "good" | "bad") =>
        t.step(note, [arr(nums, { ptrs: { i }, win: [0, Math.min(reach, nums.length - 1)], tones: tones([range(0, Math.min(reach, nums.length - 1) + 1), "ok"], [[i], i > reach ? "bad" : "cur"]) }), vars({ i, reach })], tone);
      for (let i = 0; i < nums.length; i++) {
        if (i > reach) {
          show(i, `Index ${i} is beyond the farthest reachable index ${reach}. We're stuck.`, "bad");
          return false;
        }
        const before = reach;
        reach = Math.max(reach, i + nums[i]);
        show(i, `From ${i} we can jump up to ${nums[i]} steps, reaching ${i + nums[i]}. ${reach > before ? `Farthest reach grows to ${reach}.` : `Farthest reach stays ${reach}.`}`);
        if (reach >= nums.length - 1) {
          show(i, `The reach covers the last index (${nums.length - 1}). We can make it.`, "good");
          return true;
        }
      }
      return true;
    },
  ),

  "jump-game-ii": sim<[number[]]>(
    ["nums"],
    [
      [[2, 3, 1, 1, 4], 2],
      [[2, 3, 0, 1, 4], 2],
    ],
    (t, nums) => {
      let jumps = 0;
      let end = 0;
      let far = 0;
      let start = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(note, [arr(nums, { ptrs: { i, end, far }, win: [start, Math.min(end, nums.length - 1)], tones: tones([[Math.min(far, nums.length - 1)], "pick"], [[i], "cur"]) }), vars({ jumps, end, far })], tone);
      show(0, "BFS by levels: the dashed window is every index reachable with the current number of jumps. Scan it to find how far the NEXT jump can go.");
      for (let i = 0; i < nums.length - 1; i++) {
        far = Math.max(far, i + nums[i]);
        if (i === end) {
          jumps++;
          start = end + 1;
          end = far;
          show(i, `Reached the end of this level, so we must jump. jumps = ${jumps}; the next level ends at far = ${far}.`);
        } else show(i, `Inside this level: from ${i} we could reach ${i + nums[i]}. far = ${far}.`);
      }
      show(nums.length - 1, `The last index is inside level ${jumps}. Minimum jumps = ${jumps}.`, "good");
      return jumps;
    },
  ),

  "h-index": sim<[number[]]>(
    ["citations"],
    [
      [[3, 0, 6, 1, 5], 3],
      [[1, 3, 1], 1],
    ],
    (t, citations) => {
      t.step("Sort citations from most to least cited. h is the largest number such that the top h papers each have at least h citations.", [arr(citations, { bars: true })]);
      citations.sort((a, b) => b - a);
      let h = 0;
      t.step(`Sorted: ${fmt(citations)}.`, [arr(citations, { bars: true }), vars({ h })]);
      while (h < citations.length && citations[h] >= h + 1) {
        h++;
        t.step(`Paper #${h} has ${citations[h - 1]} ≥ ${h} citations, so the top ${h} papers all have at least ${h}. h = ${h}.`, [arr(citations, { bars: true, ptrs: { h: h - 1 }, tones: tones([range(0, h), "ok"]) }), vars({ h })]);
      }
      if (h < citations.length) t.step(`Paper #${h + 1} has only ${citations[h]} < ${h + 1} citations. Stop.`, [arr(citations, { bars: true, ptrs: { h }, tones: tones([range(0, h), "ok"], [[h], "bad"]) }), vars({ h })]);
      t.step(`h-index = ${h}.`, [arr(citations, { bars: true, tones: tones([range(0, h), "ok"]) }), vars({ h })], "good");
      return h;
    },
  ),

  "insert-delete-getrandom-o1": sim<[string[], number[][]]>(
    ["ops", "args"],
    [
      [
        ["RandomizedSet", "insert", "remove", "insert", "getRandom", "remove", "insert", "getRandom"],
        [[], [1], [2], [2], [], [1], [2], []],
        [null, true, false, true, 1, true, false, 2],
      ],
      [
        ["RandomizedSet", "insert", "insert", "insert", "remove", "getRandom"],
        [[], [10], [20], [30], [10], []],
        [null, true, true, true, true, 30],
      ],
    ],
    (t, ops, args) => {
      const pos = new Map<number, number>();
      const valsArr: number[] = [];
      const res: unknown[] = [];
      let seed = 1;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const show = (note: string, hiIdx: number[] = [], hiKeys: number[] = [], tone: Tone = "cur") =>
        t.step(note, [arr(valsArr, { label: "vals (array)", tones: tones([hiIdx, tone]) }), map("pos (value → index)", pos, hiKeys), out("returned", res.map((r) => fmt(r)))]);
      ops.forEach((op, k) => {
        const v = args[k]?.[0];
        if (op === "RandomizedSet") {
          res.push(null);
          show("An array gives O(1) random picks; a hash map from value to index gives O(1) lookups. Use both.");
        } else if (op === "insert") {
          if (pos.has(v)) {
            res.push(false);
            show(`insert(${v}): already present, return false.`, [pos.get(v)!], [v], "bad");
          } else {
            pos.set(v, valsArr.length);
            valsArr.push(v);
            res.push(true);
            show(`insert(${v}): append to the array and record its index ${valsArr.length - 1}.`, [valsArr.length - 1], [v], "ok");
          }
        } else if (op === "remove") {
          if (!pos.has(v)) {
            res.push(false);
            show(`remove(${v}): not present, return false.`);
          } else {
            const i = pos.get(v)!;
            const last = valsArr[valsArr.length - 1];
            show(`remove(${v}): it sits at index ${i}. Removing from the middle would be O(n), so move the LAST value (${last}) into its slot.`, [i, valsArr.length - 1], [v, last], "cmp");
            valsArr[i] = last;
            pos.set(last, i);
            valsArr.pop();
            pos.delete(v);
            res.push(true);
            show(`Pop the tail and delete ${v} from the map. ${last !== v ? `${last} now lives at index ${i}.` : ""}`, i < valsArr.length ? [i] : [], [last], "ok");
          }
        } else if (op === "getRandom") {
          need(valsArr.length > 0, "getRandom on an empty set");
          const i = Math.floor(rnd() * valsArr.length);
          res.push(valsArr[i]);
          show(`getRandom(): pick a random index (${i}) of the array → ${valsArr[i]}. Every element is equally likely.`, [i], [], "pick");
        } else throw new Error(`unknown op ${op}`);
      });
      return res;
    },
  ),

  "product-of-array-except-self": sim<[number[]]>(
    ["nums"],
    [
      [[1, 2, 3, 4], [24, 12, 8, 6]],
      [[-1, 1, 0, -3, 3], [0, 0, 9, 0, 0]],
    ],
    (t, nums) => {
      const n = nums.length;
      const res = Array<number | null>(n).fill(null);
      let left = 1;
      t.step("answer[i] = (product of everything LEFT of i) × (product of everything RIGHT of i). No division needed.", [arr(nums, { label: "nums" }), arr(res, { label: "answer" }), vars({ left })]);
      for (let i = 0; i < n; i++) {
        res[i] = left;
        t.step(`Pass 1 →: answer[${i}] = product of nums[0..${i - 1}] = ${left}.`, [arr(nums, { label: "nums", ptrs: { i }, tones: tones([range(0, i), "pick"], [[i], "cur"]) }), arr(res, { label: "answer", tones: tones([[i], "cur"]) }), vars({ left })]);
        left *= nums[i];
      }
      let right = 1;
      for (let i = n - 1; i >= 0; i--) {
        res[i] = (res[i] as number) * right;
        t.step(`Pass 2 ←: multiply answer[${i}] by the product right of it (${right}) → ${res[i]}.`, [arr(nums, { label: "nums", ptrs: { i }, tones: tones([range(i + 1, n), "alt"], [[i], "cur"]) }), arr(res, { label: "answer", tones: tones([range(i + 1, n), "ok"], [[i], "cur"]) }), vars({ right })]);
        right *= nums[i];
      }
      t.step(`answer = ${fmt(res)} in O(n) time and O(1) extra space (the output array doesn't count).`, [arr(nums, { label: "nums" }), arr(res, { label: "answer", tones: tones([range(0, n), "ok"]) })], "good");
      return res;
    },
  ),

  "gas-station": sim<[number[], number[]]>(
    ["gas", "cost"],
    [
      [[1, 2, 3, 4, 5], [3, 4, 5, 1, 2], 3],
      [[2, 3, 4], [3, 4, 3], -1],
    ],
    (t, gas, cost) => {
      need(gas.length === cost.length, "gas and cost must have the same length");
      const net = gas.map((g, i) => g - cost[i]);
      const total = net.reduce((a, b) => a + b, 0);
      t.step("At each station you gain gas[i] and spend cost[i] to reach the next one, so only the net gas − cost matters.", [arr(gas, { label: "gas" }), arr(cost, { label: "cost" }), arr(net, { label: "gas − cost" })]);
      const panels = (i: number, start: number, tank: number) => [arr(gas, { label: "gas" }), arr(cost, { label: "cost" }), arr(net, { label: "gas − cost", ptrs: i >= 0 ? { i, start } : { start }, win: i >= start ? [start, i] : null, tones: tones([range(0, start), "dim"], [i >= 0 ? [i] : [], net[i] < 0 ? "bad" : "cur"]) }), vars({ start, tank, total })];
      t.step(`Total gas − total cost = ${total}. ${total < 0 ? "Negative, so no start can work: return −1." : "Not negative, so a valid start exists. Find it in one pass."}`, panels(-1, 0, 0), total < 0 ? "bad" : undefined);
      if (total < 0) return -1;
      let tank = 0;
      let start = 0;
      for (let i = 0; i < gas.length; i++) {
        tank += net[i];
        if (tank < 0) {
          t.step(`Tank goes negative at station ${i}. No start from ${start}..${i} can pass ${i}, so restart from ${i + 1} with an empty tank.`, panels(i, start, tank), "warn");
          start = i + 1;
          tank = 0;
        } else t.step(`Station ${i}: tank = ${tank}. Still going.`, panels(i, start, tank));
      }
      t.step(`Start at station ${start}.`, panels(-1, start, tank), "good");
      return start;
    },
  ),

  candy: sim<[number[]]>(
    ["ratings"],
    [
      [[1, 0, 2], 5],
      [[1, 2, 2], 4],
      [[1, 3, 4, 5, 2], 11],
    ],
    (t, ratings) => {
      const n = ratings.length;
      const c = Array(n).fill(1);
      t.step("Everyone starts with 1 candy. Two sweeps: left→right fixes 'higher than left neighbour', right→left fixes 'higher than right neighbour'.", [arr(ratings, { label: "ratings", bars: true }), arr(c, { label: "candies" })]);
      for (let i = 1; i < n; i++) {
        const up = ratings[i] > ratings[i - 1];
        if (up) c[i] = c[i - 1] + 1;
        t.step(up ? `→ ${ratings[i]} > ${ratings[i - 1]}, so child ${i} gets one more than the left: ${c[i]}.` : `→ ${ratings[i]} is not higher than ${ratings[i - 1]}, so leave it at ${c[i]}.`, [arr(ratings, { label: "ratings", bars: true, ptrs: { i }, tones: tones([[i - 1], "cmp"], [[i], "cur"]) }), arr(c, { label: "candies", tones: tones([[i], up ? "ok" : "dim"]) })]);
      }
      for (let i = n - 2; i >= 0; i--) {
        const down = ratings[i] > ratings[i + 1];
        const before = c[i];
        if (down) c[i] = Math.max(c[i], c[i + 1] + 1);
        t.step(down ? `← ${ratings[i]} > ${ratings[i + 1]}: need more than ${c[i + 1]}. max(${before}, ${c[i + 1] + 1}) = ${c[i]}.` : `← ${ratings[i]} is not higher than ${ratings[i + 1]}, no change.`, [arr(ratings, { label: "ratings", bars: true, ptrs: { i }, tones: tones([[i + 1], "cmp"], [[i], "cur"]) }), arr(c, { label: "candies", tones: tones([[i], down && c[i] !== before ? "ok" : "dim"]) })]);
      }
      const sum = c.reduce((a, b) => a + b, 0);
      t.step(`Minimum candies = ${sum}.`, [arr(ratings, { label: "ratings", bars: true }), arr(c, { label: "candies", tones: tones([range(0, n), "ok"]) })], "good");
      return sum;
    },
  ),

  "trapping-rain-water": sim<[number[]]>(
    ["height"],
    [
      [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], 6],
      [[4, 2, 0, 3, 2, 5], 9],
    ],
    (t, height) => {
      let l = 0;
      let r = height.length - 1;
      let lmax = 0;
      let rmax = 0;
      let water = 0;
      const lvl = [...height];
      const show = (note: string, tone?: "good", cur?: number) => t.step(note, [arr(height, { bars: true, water: lvl, ptrs: { l, r }, tones: tones([cur === undefined ? [] : [cur], "cur"]) }), vars({ lmax, rmax, water })], tone);
      show("Water above a bar = min(tallest bar to its left, tallest to its right) − its height. Two pointers: always move the SHORTER side, because its max is the bottleneck.");
      while (l < r) {
        if (height[l] < height[r]) {
          lmax = Math.max(lmax, height[l]);
          const w = lmax - height[l];
          water += w;
          lvl[l] = height[l] + w;
          show(`Left is shorter (${height[l]} < ${height[r]}), so the right side is at least as tall and lmax = ${lmax} decides. Bar ${l} holds ${w}.`, undefined, l);
          l++;
        } else {
          rmax = Math.max(rmax, height[r]);
          const w = rmax - height[r];
          water += w;
          lvl[r] = height[r] + w;
          show(`Right is shorter or equal (${height[r]} ≤ ${height[l]}), so rmax = ${rmax} decides. Bar ${r} holds ${w}.`, undefined, r);
          r--;
        }
      }
      show(`Pointers met. Total trapped water = ${water}.`, "good");
      return water;
    },
  ),

  "roman-to-integer": sim<[string]>(
    ["s"],
    [
      ["III", 3],
      ["LVIII", 58],
      ["MCMXCIV", 1994],
    ],
    (t, s) => {
      const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      need([...s].every((c) => c in v), "use only the letters I V X L C D M");
      const values = [...s].map((c) => v[c]);
      const signs: Record<number, Tone> = {};
      let total = 0;
      t.step("Read left to right. A symbol smaller than the one after it is subtracted (the IV, IX, XC… cases); otherwise it's added.", [chars(s), arr(values, { label: "value" }), vars({ total })]);
      for (let i = 0; i < s.length; i++) {
        const sub = i + 1 < s.length && values[i] < values[i + 1];
        total += sub ? -values[i] : values[i];
        signs[i] = sub ? "bad" : "ok";
        t.step(sub ? `${s[i]} (${values[i]}) < ${s[i + 1]} (${values[i + 1]}), so subtract: total = ${total}.` : `${s[i]} = ${values[i]}, add it: total = ${total}.`, [chars(s, { ptrs: { i }, tones: signs }), arr(values, { label: "value", tones: signs }), vars({ total }, ["total"])]);
      }
      t.step(`${s} = ${total}.`, [chars(s, { tones: signs }), arr(values, { label: "value", tones: signs }), vars({ total })], "good");
      return total;
    },
  ),

  "integer-to-roman": sim<[number]>(
    ["num"],
    [
      [3749, "MMMDCCXLIX"],
      [58, "LVIII"],
      [1994, "MCMXCIV"],
    ],
    (t, num0) => {
      need(Number.isInteger(num0) && num0 >= 1 && num0 <= 3999, "num must be an integer from 1 to 3999");
      const pairs: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
      let num = num0;
      let res = "";
      const table = (c: number, tone: Tone) => grid([pairs.map((p) => p[1]), pairs.map((p) => p[0])], { rows: ["symbol", "value"], tones: c < 0 ? {} : { [`0,${c}`]: tone, [`1,${c}`]: tone } });
      t.step("Greedy: walk the 13 symbols from largest to smallest, including the 6 subtractive pairs (CM, CD, XC, XL, IX, IV), and take each as many times as it fits.", [table(-1, "cur"), vars({ num, roman: res || "''" })]);
      pairs.forEach(([value, sym], c) => {
        const count = Math.floor(num / value);
        if (!count) return;
        num -= count * value;
        res += sym.repeat(count);
        t.step(`${value} (${sym}) fits ${count}×: append ${sym.repeat(count)}, ${num} left.`, [table(c, "ok"), vars({ num, roman: res }, ["roman"])]);
      });
      t.step(`${num0} = ${res}.`, [table(-1, "cur"), vars({ num, roman: res })], "good");
      return res;
    },
  ),

  "length-of-last-word": sim<[string]>(
    ["s"],
    [
      ["Hello World", 5],
      ["   fly me   to   the moon  ", 4],
      ["luffy is still joyboy", 6],
    ],
    (t, s) => {
      need(s.trim().length > 0, "s needs at least one word");
      let i = s.length - 1;
      let n = 0;
      const word: number[] = [];
      const show = (note: string, tone?: "good") => t.step(note, [arr(sp(s), { ptrs: i >= 0 ? { i } : {}, tones: tones([range(i + 1, s.length).filter((j) => s[j] === " "), "dim"], [word, "ok"], [i >= 0 ? [i] : [], "cur"]) }), vars({ length: n })], tone);
      show("Scan from the END: skip trailing spaces, then count letters until the next space.");
      while (s[i] === " ") {
        i--;
        show("Trailing space, skip.");
      }
      while (i >= 0 && s[i] !== " ") {
        word.push(i);
        n++;
        i--;
        show(`Letter '${s[i + 1]}': length = ${n}.`);
      }
      show(`Hit ${i < 0 ? "the start" : "a space"}. The last word has length ${n}.`, "good");
      return n;
    },
  ),

  "longest-common-prefix": sim<[string[]]>(
    ["strs"],
    [
      [["flower", "flow", "flight"], "fl"],
      [["dog", "racecar", "car"], ""],
      [["interview", "internet", "interval", "internal"], "inter"],
    ],
    (t, strs) => {
      need(strs.length > 0, "strs needs at least one string");
      let prefix = strs[0];
      t.step(`Start with the whole first word "${prefix}" as the candidate prefix, then shrink it until every other word starts with it.`, [chars(prefix, { label: "prefix" }), out("strs", strs, [0])]);
      for (let k = 1; k < strs.length; k++) {
        const s = strs[k];
        while (!s.startsWith(prefix)) {
          t.step(`"${s}" doesn't start with "${prefix}". Drop the last character.`, [chars(prefix, { label: "prefix", tones: { [prefix.length - 1]: "bad" } }), chars(s, { label: `strs[${k}]`, tones: tones([range(0, Math.min(prefix.length, s.length)).filter((j) => s[j] === prefix[j]), "ok"]) }), out("strs", strs, [k])]);
          prefix = prefix.slice(0, -1);
        }
        t.step(`"${s}" starts with "${prefix}". ✓`, [chars(prefix, { label: "prefix", tones: tones([range(0, prefix.length), "ok"]) }), chars(s, { label: `strs[${k}]`, tones: tones([range(0, prefix.length), "ok"]) }), out("strs", strs, [k])]);
      }
      t.step(prefix ? `Longest common prefix = "${prefix}".` : "No common prefix: the answer is the empty string.", [chars(prefix, { label: "prefix", tones: tones([range(0, prefix.length), "ok"]) }), out("strs", strs)], "good");
      return prefix;
    },
  ),

  "reverse-words-in-a-string": sim<[string]>(
    ["s"],
    [
      ["the sky is blue", "blue is sky the"],
      ["  hello world  ", "world hello"],
      ["a good   example", "example good a"],
    ],
    (t, s) => {
      const words = s.split(" ").filter(Boolean);
      t.step("Split on runs of spaces. That drops the leading, trailing and repeated spaces in one go.", [arr(sp(s), { label: "s" }), arr(words, { label: "words" })]);
      let lo = 0;
      let hi = words.length - 1;
      while (lo < hi) {
        [words[lo], words[hi]] = [words[hi], words[lo]];
        t.step(`Reverse the word list: swap "${words[hi]}" and "${words[lo]}".`, [arr(words, { label: "words", ptrs: { lo, hi }, tones: tones([[lo, hi], "alt"]) })]);
        lo++;
        hi--;
      }
      const res = words.join(" ");
      t.step(`Join with single spaces: "${res}".`, [arr(words, { label: "words", tones: tones([range(0, words.length), "ok"]) }), arr(sp(res), { label: "result" })], "good");
      return res;
    },
  ),

  "zigzag-conversion": sim<[string, number]>(
    ["s", "numRows"],
    [
      ["PAYPALISHIRING", 3, "PAHNAPLSIIGYIR"],
      ["PAYPALISHIRING", 4, "PINALSIGYAHRPI"],
      ["ABCDE", 2, "ACEBD"],
    ],
    (t, s, numRows) => {
      need(Number.isInteger(numRows) && numRows >= 1 && numRows <= 8, "numRows must be 1..8");
      if (numRows === 1 || numRows >= s.length) {
        t.step("With one row (or more rows than letters) the zigzag is the string itself.", [chars(s)], "good");
        return s;
      }
      const rows = Array(numRows).fill("");
      const cols = Math.ceil(s.length / (2 * numRows - 2)) * (numRows - 1) + 1;
      const board = Array.from({ length: numRows }, () => Array(cols).fill(null) as (string | null)[]);
      let r = 0;
      let step = 1;
      let col = 0;
      t.step("Walk the string, bouncing a row index between the top and bottom row. Each letter goes into its row's bucket.", [chars(s), grid(board), vars({ row: r, step })]);
      for (let k = 0; k < s.length; k++) {
        rows[r] += s[k];
        board[r][col] = s[k];
        const at = [r, col];
        t.step(`'${s[k]}' goes to row ${r}.${r === 0 && k > 0 ? " Top row: bounce down." : r === numRows - 1 ? " Bottom row: bounce up." : ""}`, [chars(s, { ptrs: { k }, tones: tones([range(0, k), "dim"], [[k], "cur"]) }), grid(board, { rows: rows.map((_, i) => `row ${i}`), tones: { [`${at[0]},${at[1]}`]: "cur" } }), vars({ row: r, step: r === 0 ? 1 : r === numRows - 1 ? -1 : step })]);
        if (r === 0) step = 1;
        else if (r === numRows - 1) step = -1;
        r += step;
        if (step === -1) col++;
      }
      const res = rows.join("");
      t.step(`Read the rows top to bottom: ${rows.map((x) => `"${x}"`).join(" + ")} = "${res}".`, [grid(board, { rows: rows.map((_, i) => `row ${i}`) }), chars(res, { label: "result", tones: tones([range(0, res.length), "ok"]) })], "good");
      return res;
    },
  ),

  "find-the-index-of-the-first-occurrence-in-a-string": sim<[string, string]>(
    ["haystack", "needle"],
    [
      ["sadbutsad", "sad", 0],
      ["leetcode", "leeto", -1],
      ["hello", "ll", 2],
    ],
    (t, hay, needle) => {
      const n = hay.length;
      const m = needle.length;
      need(m > 0, "needle must not be empty");
      t.step(`Slide a window of length ${m} across the haystack and compare it with the needle character by character.`, [chars(hay, { label: "haystack" }), chars(needle, { label: "needle" })]);
      for (let i = 0; i + m <= n; i++) {
        let j = 0;
        while (j < m && hay[i + j] === needle[j]) j++;
        const ok = j === m;
        t.step(ok ? `Window at ${i} matches all ${m} characters. Found it.` : `Window at ${i}: ${j} character${j === 1 ? "" : "s"} match, then '${hay[i + j]}' ≠ '${needle[j]}'. Slide by one.`, [chars(hay, { label: "haystack", ptrs: { i }, win: [i, i + m - 1], tones: tones([range(i, i + j), "ok"], [ok ? [] : [i + j], "bad"]) }), chars(needle, { label: "needle", tones: tones([range(0, j), "ok"], [ok ? [] : [j], "bad"]) })], ok ? "good" : undefined);
        if (ok) return i;
      }
      t.step("No window matched: return −1.", [chars(hay, { label: "haystack" }), chars(needle, { label: "needle" })], "bad");
      return -1;
    },
  ),

  "text-justification": sim<[string[], number]>(
    ["words", "maxWidth"],
    [
      [["This", "is", "an", "example", "of", "text", "justification."], 16, ["This    is    an", "example  of text", "justification.  "]],
      [["What", "must", "be", "acknowledgment", "shall", "be"], 16, ["What   must   be", "acknowledgment  ", "shall be        "]],
    ],
    (t, words, maxWidth) => {
      need(words.every((w) => w.length <= maxWidth), "every word must fit in maxWidth");
      const res: string[] = [];
      let line: string[] = [];
      let letters = 0;
      const show = (k: number, note: string, tone?: "good") => t.step(note, [arr(words, { label: "words", ptrs: k < words.length ? { k } : {}, tones: tones([range(0, k), "dim"], [k < words.length ? [k] : [], "cur"]) }), out("current line", line), out("result", res.map((r) => `|${r.replace(/ /g, "·")}|`)), vars({ letters, "+ min gaps": Math.max(0, line.length - 1), maxWidth })], tone);
      words.forEach((w, k) => {
        if (letters + w.length + line.length > maxWidth) {
          const gaps = line.length - 1 || 1;
          for (let i = 0; i < maxWidth - letters; i++) line[i % gaps] += " ";
          res.push(line.join(""));
          show(k, `"${w}" doesn't fit (${letters} letters + ${w.length} + ${line.length} spaces > ${maxWidth}). Spread the ${maxWidth - letters} spaces round-robin, leftmost gaps first, and emit the line.`);
          line = [];
          letters = 0;
        }
        line.push(w);
        letters += w.length;
        show(k, `Add "${w}" to the current line (${letters} letters so far).`);
      });
      const last = line.join(" ").padEnd(maxWidth, " ");
      res.push(last);
      line = [];
      show(words.length, "The last line is left-justified: single spaces, padded on the right.", "good");
      return res;
    },
  ),
};
