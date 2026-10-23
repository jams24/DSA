import { arr, chars, fmt, out, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

const alnum = (c: string) => /[a-z0-9]/i.test(c);
const sp = (s: string) => [...s].map((c) => (c === " " ? "␣" : c));

export const SIMS: Record<string, Sim> = {
  "valid-palindrome": sim<[string]>(
    ["s"],
    [
      ["A man, a plan, a canal: Panama", true],
      ["race a car", false],
      [" ", true],
    ],
    (t, s) => {
      let l = 0;
      let r = s.length - 1;
      const done = new Set<number>();
      const skip = new Set<number>();
      const show = (note: string, tone?: "good" | "bad", bad = false) =>
        t.step(note, [arr(sp(s), { ptrs: l <= r ? { l, r } : {}, tones: tones([skip, "dim"], [done, "ok"], [l < r ? [l, r] : [], bad ? "bad" : "cmp"]) })], tone);
      show("Two pointers from both ends. Skip anything that isn't a letter or digit, and compare the rest case-insensitively.");
      while (l < r) {
        if (!alnum(s[l])) {
          skip.add(l++);
          show(`'${s[l - 1]}' isn't alphanumeric: move l right.`);
        } else if (!alnum(s[r])) {
          skip.add(r--);
          show(`'${s[r + 1]}' isn't alphanumeric: move r left.`);
        } else if (s[l].toLowerCase() !== s[r].toLowerCase()) {
          show(`'${s[l]}' ≠ '${s[r]}', so it's not a palindrome.`, "bad", true);
          return false;
        } else {
          done.add(l).add(r);
          l++;
          r--;
          show(`'${s[l - 1]}' matches '${s[r + 1]}'. Move both pointers inward.`);
        }
      }
      show("The pointers met without a mismatch: it's a palindrome.", "good");
      return true;
    },
  ),

  "is-subsequence": sim<[string, string]>(
    ["s", "t"],
    [
      ["abc", "ahbgdc", true],
      ["axc", "ahbgdc", false],
    ],
    (tr, s, t) => {
      let i = 0;
      const hit: number[] = [];
      tr.step("Walk through t once. Pointer i marks the next character of s we still need; advance it whenever t gives us that character.", [chars(s, { label: "s", ptrs: { i } }), chars(t, { label: "t" })]);
      for (let j = 0; j < t.length; j++) {
        const match = i < s.length && s[i] === t[j];
        if (match) {
          hit.push(j);
          i++;
        }
        tr.step(match ? `t[${j}] = '${t[j]}' is the next character we need. i → ${i}.` : `t[${j}] = '${t[j]}' isn't '${s[i] ?? "—"}': skip it.`, [chars(s, { label: "s", ptrs: { i }, tones: tones([range(0, i), "ok"]) }), chars(t, { label: "t", ptrs: { j }, tones: tones([hit, "ok"], [match ? [] : [j], "dim"]) })]);
      }
      const ok = i === s.length;
      tr.step(ok ? `All ${s.length} characters of s were found in order: true.` : `Only ${i} of ${s.length} characters were found: false.`, [chars(s, { label: "s", tones: tones([range(0, i), "ok"], [range(i, s.length), "bad"]) }), chars(t, { label: "t", tones: tones([hit, "ok"]) })], ok ? "good" : "bad");
      return ok;
    },
  ),

  "two-sum-ii-input-array-is-sorted": sim<[number[], number]>(
    ["numbers", "target"],
    [
      [[2, 7, 11, 15], 9, [1, 2]],
      [[2, 3, 4], 6, [1, 3]],
      [[-1, 0], -1, [1, 2]],
    ],
    (t, nums, target) => {
      let l = 0;
      let r = nums.length - 1;
      t.step("Sorted array: start at both ends. Too small → move l right to grow the sum. Too big → move r left to shrink it.", [arr(nums, { ptrs: { l, r } }), vars({ target })]);
      while (l < r) {
        const s = nums[l] + nums[r];
        if (s === target) {
          t.step(`${nums[l]} + ${nums[r]} = ${target}. Found it! Return 1-based [${l + 1}, ${r + 1}].`, [arr(nums, { ptrs: { l, r }, tones: tones([[l, r], "ok"]) }), vars({ sum: s, target })], "good");
          return [l + 1, r + 1];
        }
        t.step(s < target ? `${nums[l]} + ${nums[r]} = ${s} < ${target}: too small, move l right.` : `${nums[l]} + ${nums[r]} = ${s} > ${target}: too big, move r left.`, [arr(nums, { ptrs: { l, r }, tones: tones([[l, r], "cmp"]) }), vars({ sum: s, target })]);
        if (s < target) l++;
        else r--;
      }
      t.step("The pointers met: no pair adds up to target.", [arr(nums), vars({ target })], "bad");
      return [];
    },
  ),

  "container-with-most-water": sim<[number[]]>(
    ["height"],
    [
      [[1, 8, 6, 2, 5, 4, 8, 3, 7], 49],
      [[1, 1], 1],
      [[4, 3, 2, 1, 4], 16],
    ],
    (t, h) => {
      let l = 0;
      let r = h.length - 1;
      let best = 0;
      let bestPair: [number, number] = [0, 0];
      t.step("Start with the widest container. Area = width × the SHORTER wall. Moving the taller wall can never help, so always move the shorter one.", [arr(h, { bars: true, ptrs: { l, r } }), vars({ best })]);
      while (l < r) {
        const area = (r - l) * Math.min(h[l], h[r]);
        const better = area > best;
        if (better) {
          best = area;
          bestPair = [l, r];
        }
        const water = h.map((_, i) => (i >= l && i <= r ? Math.min(h[l], h[r]) : 0));
        t.step(`Width ${r - l} × min(${h[l]}, ${h[r]}) = ${area}${better ? ", a new best" : ""}. ${h[l] < h[r] ? "Left wall is shorter: move l." : "Right wall is shorter or equal: move r."}`, [arr(h, { bars: true, water, ptrs: { l, r }, tones: tones([[l, r], better ? "ok" : "cmp"]) }), vars({ area, best }, better ? ["best"] : [])]);
        if (h[l] < h[r]) l++;
        else r--;
      }
      t.step(`Max area = ${best}, between walls ${bestPair[0]} and ${bestPair[1]}.`, [arr(h, { bars: true, tones: tones([bestPair, "ok"]) }), vars({ best })], "good");
      return best;
    },
  ),

  "3sum": sim<[number[]]>(
    ["nums"],
    [
      [[-1, 0, 1, 2, -1, -4], [[-1, -1, 2], [-1, 0, 1]]],
      [[0, 1, 1], []],
      [[0, 0, 0, 0], [[0, 0, 0]]],
    ],
    (t, nums) => {
      t.step("Sort first. Then fix each nums[i] and run two-sum with two pointers on the part to its right, looking for −nums[i].", [arr(nums)]);
      nums.sort((a, b) => a - b);
      const res: number[][] = [];
      const show = (i: number, l: number, r: number, note: string, tone?: "good", hit = false) => t.step(note, [arr(nums, { ptrs: l < r ? { i, l, r } : { i }, tones: tones([[i], "pick"], [l < r ? [l, r] : [], hit ? "ok" : "cmp"]) }), out("triplets", res.map((x) => fmt(x)), hit ? [res.length - 1] : [])], tone);
      show(0, 0, 0, `Sorted: ${fmt(nums)}.`);
      for (let i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) {
          show(i, 0, 0, `nums[${i}] = ${nums[i]} > 0: everything to the right is positive too, so no more triplets. Stop.`);
          break;
        }
        if (i && nums[i] === nums[i - 1]) {
          show(i, 0, 0, `nums[${i}] = ${nums[i]} repeats the previous anchor. Skip it to avoid duplicate triplets.`);
          continue;
        }
        let l = i + 1;
        let r = nums.length - 1;
        while (l < r) {
          const s = nums[i] + nums[l] + nums[r];
          if (s < 0) {
            show(i, l, r, `${nums[i]} + ${nums[l]} + ${nums[r]} = ${s} < 0: move l right.`);
            l++;
          } else if (s > 0) {
            show(i, l, r, `${nums[i]} + ${nums[l]} + ${nums[r]} = ${s} > 0: move r left.`);
            r--;
          } else {
            res.push([nums[i], nums[l], nums[r]]);
            show(i, l, r, `${nums[i]} + ${nums[l]} + ${nums[r]} = 0. Record it, move both pointers, and skip repeated values at l.`, undefined, true);
            l++;
            r--;
            while (l < r && nums[l] === nums[l - 1]) l++;
          }
        }
      }
      t.step(`${res.length} unique triplet${res.length === 1 ? "" : "s"}. O(n²) time.`, [arr(nums), out("triplets", res.map((x) => fmt(x)))], "good");
      return res;
    },
  ),
};
