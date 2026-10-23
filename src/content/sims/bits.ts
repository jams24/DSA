import { arr, chars, need, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

const bits = (x: number, w = 8) => (x >>> 0).toString(2).padStart(w, "0").split("");
const width = (...xs: number[]) => Math.max(4, ...xs.map((x) => (x >>> 0).toString(2).length));

export const SIMS: Record<string, Sim> = {
  "add-binary": sim<[string, string]>(
    ["a", "b"],
    [
      ["11", "1", "100"],
      ["1010", "1011", "10101"],
    ],
    (t, a, b) => {
      need(/^[01]+$/.test(a) && /^[01]+$/.test(b), "a and b are binary strings");
      let i = a.length - 1;
      let j = b.length - 1;
      let carry = 0;
      const out: string[] = [];
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            chars(a, {
              label: "a",
              ptrs: i >= 0 ? { i } : {},
              tones: tones([range(i + 1, a.length), "dim"]),
            }),
            chars(b, {
              label: "b",
              ptrs: j >= 0 ? { j } : {},
              tones: tones([range(j + 1, b.length), "dim"]),
            }),
            arr([...out].reverse(), { label: "sum (built right to left)" }),
            vars({ carry }),
          ],
          tone,
        );
      show("Add from the rightmost bit like on paper: digit = sum % 2, carry = sum / 2.");
      while (i >= 0 || j >= 0 || carry) {
        let s = carry;
        const parts = [`carry ${carry}`];
        if (i >= 0) {
          s += Number(a[i]);
          parts.push(`a ${a[i]}`);
          i--;
        }
        if (j >= 0) {
          s += Number(b[j]);
          parts.push(`b ${b[j]}`);
          j--;
        }
        out.push(String(s % 2));
        carry = s >> 1;
        show(`${parts.join(" + ")} = ${s}: write ${s % 2}, carry ${carry}.`);
      }
      const res = out.reverse().join("");
      t.step(
        `${a} + ${b} = ${res}.`,
        [
          chars(res, {
            label: "sum",
            tones: tones([range(0, res.length), "ok"]),
          }),
        ],
        "good",
      );
      return res;
    },
  ),

  "reverse-bits": sim<[number]>(
    ["n"],
    [
      [43261596, 964176192],
      [2147483644, 1073741822],
    ],
    (t, n0) => {
      need(Number.isInteger(n0) && n0 >= 0 && n0 < 2 ** 32, "n is a 32-bit unsigned integer");
      let n = n0;
      let res = 0;
      t.step("32 times: shift the result left, copy n's lowest bit into it, then shift n right. n's bits come out in reverse order.", [
        arr(bits(n, 32), { label: "n" }),
        arr(bits(res, 32), { label: "result" }),
      ]);
      for (let k = 0; k < 32; k++) {
        const bit = n & 1;
        res = ((res << 1) | bit) >>> 0;
        n >>>= 1;
        if (k < 6 || k > 28 || k % 8 === 7)
          t.step(`Step ${k + 1}: low bit of n is ${bit}; result = (result << 1) | ${bit}.`, [
            arr(bits(n, 32), { label: "n", tones: { 31: "cur" } }),
            arr(bits(res, 32), {
              label: "result",
              tones: tones([range(31 - k, 32), "ok"], [[31], "cur"]),
            }),
            vars({ result: res }),
          ]);
      }
      t.step(
        `Reversed: ${res}.`,
        [
          arr(bits(n0, 32), { label: "n (original)" }),
          arr(bits(res, 32), {
            label: "result",
            tones: tones([range(0, 32), "ok"]),
          }),
        ],
        "good",
      );
      return res;
    },
  ),

  "number-of-1-bits": sim<[number]>(
    ["n"],
    [
      [11, 3],
      [128, 1],
      [2147483645, 30],
    ],
    (t, n0) => {
      need(Number.isInteger(n0) && n0 >= 0 && n0 < 2 ** 31, "n is a positive 31-bit integer");
      let n = n0;
      let count = 0;
      const w = width(n0);
      t.step("n & (n − 1) clears the LOWEST set bit. Count how many times you can do that before n reaches 0: one loop per 1-bit.", [arr(bits(n, w), { label: "n" }), vars({ count })]);
      while (n) {
        const low = w - 1 - Math.log2(n & -n);
        n &= n - 1;
        count++;
        t.step(`Clear the lowest 1 (position ${w - 1 - low} from the right). count = ${count}.`, [arr(bits(n, w), { label: "n", tones: { [low]: "bad" } }), vars({ count })]);
      }
      t.step(
        `${count} set bit${count === 1 ? "" : "s"}.`,
        [
          arr(bits(n0, w), {
            label: "n",
            tones: tones([bits(n0, w).flatMap((b, i) => (b === "1" ? [i] : [])), "ok"]),
          }),
          vars({ count }),
        ],
        "good",
      );
      return count;
    },
  ),

  "single-number": sim<[number[]]>(
    ["nums"],
    [
      [[2, 2, 1], 1],
      [[4, 1, 2, 1, 2], 4],
    ],
    (t, nums) => {
      need(
        nums.every((x) => Number.isInteger(x) && x >= 0 && x < 256),
        "use small non-negative integers for the visual",
      );
      let res = 0;
      t.step("XOR everything. x ^ x = 0 and x ^ 0 = x, so every pair cancels out and only the single number is left.", [arr(nums), arr(bits(res), { label: "res (binary)" }), vars({ res })]);
      nums.forEach((x, i) => {
        res ^= x;
        t.step(`res ^= ${x} (${bits(x).join("")}) → ${res}.`, [
          arr(nums, {
            ptrs: { i },
            tones: tones([range(0, i), "dim"], [[i], "cur"]),
          }),
          arr(bits(res), { label: "res (binary)" }),
          vars({ res }),
        ]);
      });
      t.step(
        `Only ${res} survives.`,
        [
          arr(nums, {
            tones: tones([nums.flatMap((x, i) => (x === res ? [i] : [])), "ok"]),
          }),
          vars({ res }),
        ],
        "good",
      );
      return res;
    },
  ),

  "single-number-ii": sim<[number[]]>(
    ["nums"],
    [
      [[2, 2, 3, 2], 3],
      [[0, 1, 0, 1, 0, 1, 99], 99],
    ],
    (t, nums) => {
      need(
        nums.every((x) => Number.isInteger(x) && x >= 0 && x < 256),
        "use small non-negative integers for the visual",
      );
      let ones = 0;
      let twos = 0;
      const show = (i: number, note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(nums, {
              ptrs: i >= 0 ? { i } : {},
              tones: tones([i >= 0 ? [i] : [], "cur"]),
            }),
            arr(bits(ones), { label: "ones: bits seen 1 time (mod 3)" }),
            arr(bits(twos), { label: "twos: bits seen 2 times (mod 3)" }),
            vars({ ones, twos }),
          ],
          tone,
        );
      show(-1, "Count each bit's appearances mod 3 with two bitmasks. A bit seen a third time is cleared from both, so numbers appearing 3 times vanish and 'ones' ends up holding the single number.");
      nums.forEach((x, i) => {
        ones = (ones ^ x) & ~twos;
        twos = (twos ^ x) & ~ones;
        show(i, `Add ${x}: ones = (ones ^ ${x}) & ~twos = ${ones}; twos = (twos ^ ${x}) & ~ones = ${twos}.`);
      });
      show(-1, `The single number is ones = ${ones}.`, "good");
      return ones;
    },
  ),

  "bitwise-and-of-numbers-range": sim<[number, number]>(
    ["left", "right"],
    [
      [5, 7, 4],
      [12, 15, 12],
      [1, 2147483647, 0],
    ],
    (t, left, right) => {
      need(Number.isInteger(left) && Number.isInteger(right) && left >= 0 && left <= right && right < 2 ** 31, "0 ≤ left ≤ right < 2^31");
      const w = width(right);
      let l = left;
      let r = right;
      let shift = 0;
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            arr(bits(l, w), {
              label: "left",
              tones: tones([range(w - shift, w), "dim"]),
            }),
            arr(bits(r, w), {
              label: "right",
              tones: tones([range(w - shift, w), "dim"]),
            }),
            vars({ shift }),
          ],
          tone,
        );
      show("Every bit below the common prefix of left and right flips somewhere in the range, so the AND is 0 there. Shift both right until they're equal, i.e. until only the common prefix is left.");
      while (l !== r) {
        l >>>= 1;
        r >>>= 1;
        shift++;
        show(`They differ: shift both right. shift = ${shift}.`);
      }
      const res = l << shift;
      show(`Equal at ${l}: shift the common prefix back left by ${shift} → ${res}.`, "good");
      return res;
    },
  ),
};
