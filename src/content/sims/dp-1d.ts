import { arr, chars, need, range, sim, tones, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "climbing-stairs": sim<[number]>(
    ["n"],
    [
      [2, 2],
      [3, 3],
      [6, 13],
    ],
    (t, n) => {
      need(Number.isInteger(n) && n >= 1 && n <= 30, "n must be 1..30");
      const ways: (number | null)[] = [1, 1, ...Array(n - 1).fill(null)];
      t.step("The last move onto step i came from step i−1 (a 1-step) or step i−2 (a 2-step), so ways[i] = ways[i−1] + ways[i−2]. Fibonacci! ways[0] = ways[1] = 1.", [
        arr(ways, { label: "ways[i]", tones: { 0: "ok", 1: "ok" } }),
      ]);
      for (let i = 2; i <= n; i++) {
        ways[i] = ways[i - 1]! + ways[i - 2]!;
        t.step(`ways[${i}] = ways[${i - 1}] + ways[${i - 2}] = ${ways[i - 1]} + ${ways[i - 2]} = ${ways[i]}.`, [
          arr(ways, {
            label: "ways[i]",
            ptrs: { i },
            tones: tones([[i - 1, i - 2], "cmp"], [[i], "ok"]),
          }),
        ]);
      }
      t.step(`${ways[n]} distinct ways. Only the last two values are needed, so O(1) space.`, [arr(ways, { label: "ways[i]", tones: { [n]: "ok" } })], "good");
      return ways[n];
    },
  ),

  "house-robber": sim<[number[]]>(
    ["nums"],
    [
      [[1, 2, 3, 1], 4],
      [[2, 7, 9, 3, 1], 12],
    ],
    (t, nums) => {
      const best: (number | null)[] = nums.map(() => null);
      let prev = 0;
      let cur = 0;
      t.step("best(i) = max(skip house i → best(i−1), rob it → best(i−2) + nums[i]). Two running values are enough.", [
        arr(nums, { label: "nums", bars: true }),
        arr(best, { label: "best loot up to here" }),
        vars({ prev, cur }),
      ]);
      nums.forEach((x, i) => {
        const rob = prev + x;
        const skip = cur;
        [prev, cur] = [cur, Math.max(cur, rob)];
        best[i] = cur;
        t.step(`House ${i} (${x}): rob it → ${rob}, skip it → ${skip}. Best = ${cur}.`, [
          arr(nums, {
            label: "nums",
            bars: true,
            ptrs: { i },
            tones: tones([[i], rob >= skip ? "ok" : "dim"]),
          }),
          arr(best, { label: "best loot up to here", tones: { [i]: "cur" } }),
          vars({ prev, cur }),
        ]);
      });
      t.step(`Maximum loot = ${cur}.`, [arr(best, { label: "best loot up to here" }), vars({ answer: cur })], "good");
      return cur;
    },
  ),

  "word-break": sim<[string, string[]]>(
    ["s", "wordDict"],
    [
      ["leetcode", ["leet", "code"], true],
      ["applepenapple", ["apple", "pen"], true],
      ["catsandog", ["cats", "dog", "sand", "and", "cat"], false],
    ],
    (t, s, dict) => {
      need(dict.length > 0 && s.length <= 20, "non-empty dictionary, s up to 20 characters");
      const words = new Set(dict);
      const maxLen = Math.max(...dict.map((w) => w.length));
      const dp: boolean[] = [true, ...Array(s.length).fill(false)];
      const show = (note: string, win: [number, number] | null, i: number, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            chars(s, {
              win,
              tones: tones([win ? range(win[0], win[1] + 1) : [], dp[i] && win ? "ok" : "cmp"]),
            }),
            arr(
              dp.map((b) => (b ? "T" : "F")),
              {
                label: "dp[i]: can s[0..i) be split?",
                ptrs: { i },
                tones: tones([dp.flatMap((b, k) => (b ? [k] : [])), "ok"]),
              },
            ),
          ],
          tone,
        );
      show("dp[i] is true when the first i characters split into dictionary words: some earlier dp[j] is true AND s[j..i) is a word. dp[0] = true (empty prefix).", null, 0);
      for (let i = 1; i <= s.length; i++) {
        let found = -1;
        for (let j = Math.max(0, i - maxLen); j < i; j++)
          if (dp[j] && words.has(s.slice(j, i))) {
            dp[i] = true;
            found = j;
            break;
          }
        show(
          found >= 0 ? `dp[${i}] = true: dp[${found}] is true and "${s.slice(found, i)}" is a word.` : `dp[${i}] = false: no split point j gives a word s[j..${i}).`,
          found >= 0 ? [found, i - 1] : null,
          i,
        );
      }
      const ok = dp[s.length];
      show(ok ? "dp[n] is true: the whole string splits into words." : "dp[n] is false: no valid split.", null, s.length, ok ? "good" : "bad");
      return ok;
    },
  ),

  "coin-change": sim<[number[], number]>(
    ["coins", "amount"],
    [
      [[1, 2, 5], 11, 3],
      [[2], 3, -1],
      [[1], 0, 0],
    ],
    (t, coins, amount) => {
      need(amount >= 0 && amount <= 30 && coins.every((c) => c > 0), "amount 0..30 and positive coins for the visual");
      const INF = amount + 1;
      const dp = [0, ...Array(amount).fill(INF)];
      const show = (a: number, note: string, from: number[] = [], tone?: "good" | "bad") =>
        t.step(
          note,
          [
            arr(
              dp.map((v) => (v === INF ? "∞" : v)),
              {
                label: "dp[a]: fewest coins for amount a",
                ptrs: a >= 0 ? { a } : {},
                tones: tones([from, "cmp"], [a >= 0 ? [a] : [], "ok"]),
              },
            ),
            vars({ coins: `[${coins.join(",")}]` }),
          ],
          tone,
        );
      show(-1, "Unbounded knapsack: dp[a] = 1 + min over coins c of dp[a − c]. dp[0] = 0, everything else starts at ∞.");
      for (let a = 1; a <= amount; a++) {
        const from: number[] = [];
        for (const c of coins)
          if (c <= a) {
            from.push(a - c);
            dp[a] = Math.min(dp[a], dp[a - c] + 1);
          }
        show(a, dp[a] === INF ? `Amount ${a} can't be made with these coins.` : `Amount ${a}: best is 1 + min(${from.map((f) => `dp[${f}]`).join(", ")}) = ${dp[a]}.`, from);
      }
      const ans = dp[amount] === INF ? -1 : dp[amount];
      show(amount, ans < 0 ? `${amount} is unreachable: −1.` : `Fewest coins for ${amount} = ${ans}.`, [], ans < 0 ? "bad" : "good");
      return ans;
    },
  ),

  "longest-increasing-subsequence": sim<[number[]]>(
    ["nums"],
    [
      [[10, 9, 2, 5, 3, 7, 101, 18], 4],
      [[0, 1, 0, 3, 2, 3], 4],
      [[7, 7, 7, 7], 1],
    ],
    (t, nums) => {
      const tails: number[] = [];
      t.step(
        "Patience sorting: tails[k] = the smallest possible tail of an increasing subsequence of length k+1. For each x, binary-search the first tail ≥ x and replace it (or append if x is bigger than all). O(n log n).",
        [arr(nums), arr(tails, { label: "tails" })],
      );
      nums.forEach((x, i) => {
        let lo = 0;
        let hi = tails.length;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (tails[m] < x) lo = m + 1;
          else hi = m;
        }
        const append = lo === tails.length;
        const old = tails[lo];
        tails[lo] = x;
        t.step(
          append ? `${x} is bigger than every tail: append. Length ${tails.length}.` : `First tail ≥ ${x} is ${old} at position ${lo}: replace it with ${x} (a smaller tail is easier to extend).`,
          [
            arr(nums, {
              ptrs: { i },
              tones: tones([range(0, i), "dim"], [[i], "cur"]),
            }),
            arr(tails, {
              label: "tails",
              tones: { [lo]: append ? "ok" : "alt" },
            }),
          ],
        );
      });
      t.step(
        `LIS length = ${tails.length}. (tails is not itself a subsequence, only its length matters.)`,
        [
          arr(tails, {
            label: "tails",
            tones: tones([range(0, tails.length), "ok"]),
          }),
        ],
        "good",
      );
      return tails.length;
    },
  ),
};
