import { arr, fmt, map, need, out, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

const digits = (x: number) => (x === 0 ? [] : String(x).split("").map(Number));

export const SIMS: Record<string, Sim> = {
  "palindrome-number": sim<[number]>(
    ["x"],
    [
      [121, true],
      [-121, false],
      [10, false],
      [1221, true],
    ],
    (t, x0) => {
      need(Number.isInteger(x0) && Math.abs(x0) < 2 ** 31, "x is a 32-bit integer");
      if (x0 < 0 || (x0 % 10 === 0 && x0 !== 0)) {
        t.step(`${x0} ${x0 < 0 ? "is negative: the '−' only appears on the left" : "ends in 0 but doesn't start with 0"}, so it can't read the same backwards.`, [vars({ x: x0 })]);
        t.step("false.", [vars({ x: x0 })], "bad");
        return false;
      }
      let x = x0;
      let rev = 0;
      t.step("Reverse only the second HALF of the digits (no string, no overflow): pop digits off x onto rev until rev ≥ x.", [arr(digits(x), { label: "x" }), arr(digits(rev), { label: "rev" })]);
      while (x > rev) {
        const d = x % 10;
        rev = rev * 10 + d;
        x = Math.floor(x / 10);
        t.step(`Move the last digit ${d} from x to rev.`, [arr(digits(x), { label: "x" }), arr(digits(rev), { label: "rev" }), vars({ x, rev })]);
      }
      const ok = x === rev || x === Math.floor(rev / 10);
      t.step(
        ok ? `x = ${x} and rev = ${rev} match${x !== rev ? " once rev drops its middle digit (odd length)" : ""}: palindrome.` : `${x} vs ${rev}: the halves differ.`,
        [vars({ x, rev })],
        ok ? "good" : "bad",
      );
      return ok;
    },
  ),

  "plus-one": sim<[number[]]>(
    ["digits"],
    [
      [
        [1, 2, 3],
        [1, 2, 4],
      ],
      [
        [4, 3, 2, 1],
        [4, 3, 2, 2],
      ],
      [
        [9, 9],
        [1, 0, 0],
      ],
    ],
    (t, d) => {
      t.step("Add 1 from the right. A digit below 9 just increments and we're done; a 9 becomes 0 and the carry moves left.", [arr(d)]);
      for (let i = d.length - 1; i >= 0; i--) {
        if (d[i] < 9) {
          d[i]++;
          t.step(`${d[i] - 1} < 9: make it ${d[i]}. No carry, done.`, [arr(d, { ptrs: { i }, tones: { [i]: "ok" } })], "good");
          return d;
        }
        d[i] = 0;
        t.step("9 + 1 = 10: write 0, carry 1 to the left.", [arr(d, { ptrs: { i }, tones: { [i]: "cmp" } })]);
      }
      const res = [1, ...d];
      t.step("Every digit was 9: prepend a 1.", [arr(res, { tones: { 0: "ok" } })], "good");
      return res;
    },
  ),

  "factorial-trailing-zeroes": sim<[number]>(
    ["n"],
    [
      [3, 0],
      [5, 1],
      [100, 24],
    ],
    (t, n0) => {
      need(Number.isInteger(n0) && n0 >= 0, "n is a non-negative integer");
      let n = n0;
      let count = 0;
      t.step(`Each trailing zero needs a 10 = 2 × 5, and 2s are plentiful, so count the 5s in ${n0}!: multiples of 5, plus an extra one for multiples of 25, of 125, …`, [vars({ n, zeros: count })]);
      let p = 5;
      while (n) {
        n = Math.floor(n / 5);
        count += n;
        if (n || count === 0) t.step(`${n} number${n === 1 ? "" : "s"} up to ${n0} ${n === 1 ? "is a multiple" : "are multiples"} of ${p}: +${n}. zeros = ${count}.`, [vars({ n, zeros: count })]);
        p *= 5;
      }
      t.step(`${n0}! ends in ${count} zero${count === 1 ? "" : "s"}.`, [vars({ zeros: count })], "good");
      return count;
    },
  ),

  sqrtx: sim<[number]>(
    ["x"],
    [
      [4, 2],
      [8, 2],
      [50, 7],
    ],
    (t, x) => {
      need(Number.isInteger(x) && x >= 0 && x < 2 ** 31, "x is a non-negative 32-bit integer");
      let lo = 0;
      let hi = x;
      t.step("Binary search for the largest m with m² ≤ x. Use the UPPER middle so lo = mid always makes progress.", [vars({ lo, hi })]);
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        const ok = mid * mid <= x;
        t.step(`mid = ${mid}: ${mid}² = ${mid * mid} ${ok ? "≤" : ">"} ${x} → ${ok ? `lo = ${mid}` : `hi = ${mid - 1}`}.`, [vars({ lo, mid, hi, "mid²": mid * mid })]);
        if (ok) lo = mid;
        else hi = mid - 1;
      }
      t.step(`√${x} rounded down = ${lo}.`, [vars({ answer: lo })], "good");
      return lo;
    },
  ),

  "powx-n": sim<[number, number]>(
    ["x", "n"],
    [
      [2, 10, 1024],
      [2.1, 3, 9.261],
      [2, -2, 0.25],
    ],
    (t, x0, n0) => {
      need(Number.isInteger(n0) && Math.abs(n0) < 2 ** 31, "n is a 32-bit integer");
      let x = x0;
      let n = n0;
      if (n < 0) {
        x = 1 / x;
        n = -n;
      }
      let result = 1;
      t.step(
        `Fast exponentiation: read n in binary (${n.toString(2)}). Square x at every step and multiply it into the result whenever the current bit is 1. O(log n) multiplications.${n0 < 0 ? " n is negative, so use 1/x and −n." : ""}`,
        [arr(n.toString(2).split(""), { label: "n in binary" }), vars({ x, result })],
      );
      let bit = 0;
      const w = n.toString(2).length;
      while (n) {
        const on = n & 1;
        if (on) result *= x;
        t.step(`Bit ${bit} is ${on}: ${on ? `result × ${fmt(x)} = ${fmt(result)}` : "skip"}. Then x = x² = ${fmt(x * x)}.`, [
          arr(n0 < 0 ? (-n0).toString(2).split("") : n0.toString(2).split(""), {
            label: "n in binary",
            tones: { [w - 1 - bit]: on ? "ok" : "dim" },
          }),
          vars({ x: fmt(x), result: fmt(result) }),
        ]);
        x *= x;
        n = Math.floor(n / 2);
        bit++;
      }
      t.step(`${x0}^${n0} = ${fmt(result)}.`, [vars({ result: fmt(result) })], "good");
      return Number(result.toFixed(5));
    },
  ),

  "max-points-on-a-line": sim<[number[][]]>(
    ["points"],
    [
      [
        [
          [1, 1],
          [2, 2],
          [3, 3],
        ],
        3,
      ],
      [
        [
          [1, 1],
          [3, 2],
          [5, 3],
          [4, 1],
          [2, 3],
          [1, 4],
        ],
        4,
      ],
    ],
    (t, pts) => {
      need(pts.length <= 12 && new Set(pts.map((p) => p.join(","))).size === pts.length, "up to 12 distinct points");
      const labels = pts.map((p) => `(${p.join(",")})`);
      if (pts.length <= 2) {
        t.step("Any one or two points lie on a line.", [arr(labels)]);
        t.step(`Answer ${pts.length}.`, [arr(labels)], "good");
        return pts.length;
      }
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
      let best = 0;
      t.step(
        "Fix each point as an anchor and count the slope to every later point. Store slopes as reduced fractions dy/dx (divide by the gcd, normalize the sign) so equal slopes hash equally, without floating point.",
        [arr(labels), vars({ best })],
      );
      pts.forEach(([x1, y1], i) => {
        const slopes = new Map<string, number>();
        for (const [x2, y2] of pts.slice(i + 1)) {
          let dx = x2 - x1;
          let dy = y2 - y1;
          const g = gcd(dx, dy);
          dx /= g;
          dy /= g;
          if (dx < 0 || (dx === 0 && dy < 0)) {
            dx = -dx;
            dy = -dy;
          }
          const key = `${dy}/${dx}`;
          slopes.set(key, (slopes.get(key) ?? 0) + 1);
        }
        if (!slopes.size) return;
        const top = Math.max(...slopes.values());
        best = Math.max(best, top + 1);
        const topKey = [...slopes].find(([, v]) => v === top)![0];
        t.step(`Anchor ${labels[i]}: the most common slope ${topKey} hits ${top} later point${top === 1 ? "" : "s"}, so ${top + 1} points share a line. best = ${best}.`, [
          arr(labels, {
            ptrs: { anchor: i },
            tones: tones([range(0, i), "dim"], [[i], "cur"]),
          }),
          map("slope (dy/dx) → count", slopes, [topKey]),
          vars({ best }),
        ]);
      });
      t.step(`At most ${best} points on one line.`, [arr(labels), out("answer", [best])], "good");
      return best;
    },
  ),
};
