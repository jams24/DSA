import { arr, chars, grid, gridTones, need, range, sim, tones, vars } from "@/lib/sim/build";
import type { Cell, Sim, Tone } from "@/lib/sim/types";

const isRect = (m: unknown[][]) => m.length > 0 && m.every((r) => Array.isArray(r) && r.length === m[0].length && r.length > 0);
const table = <T extends Cell>(R: number, C: number, v: T) => Array.from({ length: R }, () => Array<T | null>(C).fill(v));
const done = (R: number, C: number, r: number, c: number) => {
  const res: [number, number][] = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (i < r || (i === r && j < c)) res.push([i, j]);
  return res;
};

export const SIMS: Record<string, Sim> = {
  triangle: sim<[number[][]]>(
    ["triangle"],
    [
      [[[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]], 11],
      [[[-10]], -10],
    ],
    (t, tri) => {
      need(tri.length <= 10 && tri.every((r, i) => r.length === i + 1), "row i must have i + 1 numbers, up to 10 rows");
      const dp = [...tri[tri.length - 1]];
      const best: (number | null)[][] = tri.map((r, i) => (i === tri.length - 1 ? [...r] : r.map(() => null)));
      t.step("Bottom-up: start from the last row, then each cell's best path = its value + the smaller of the two cells below it. The top ends up holding the answer.", [
        grid(tri, { label: "triangle" }),
        grid(best, {
          label: "best path sum from here down",
          tones: gridTones([tri[tri.length - 1].map((_, c) => [tri.length - 1, c] as [number, number]), "ok"]),
        }),
      ]);
      for (let r = tri.length - 2; r >= 0; r--)
        tri[r].forEach((v, i) => {
          const pick = Math.min(dp[i], dp[i + 1]);
          dp[i] = v + pick;
          best[r][i] = dp[i];
          t.step(`(${r},${i}): ${v} + min(${best[r + 1][i]}, ${best[r + 1][i + 1]}) = ${dp[i]}.`, [
            grid(tri, {
              label: "triangle",
              tones: gridTones([[[r, i]], "cur"]),
            }),
            grid(best, {
              label: "best path sum from here down",
              tones: gridTones(
                [
                  [
                    [r + 1, i],
                    [r + 1, i + 1],
                  ],
                  "cmp",
                ],
                [[[r, i]], "ok"],
              ),
            }),
            arr(dp, {
              label: "1-D dp row (what the code stores)",
              ptrs: { i },
            }),
          ]);
        });
      t.step(
        `Minimum path sum = ${dp[0]}.`,
        [
          grid(best, {
            label: "best path sum from here down",
            tones: gridTones([[[0, 0]], "ok"]),
          }),
        ],
        "good",
      );
      return dp[0];
    },
  ),

  "minimum-path-sum": sim<[number[][]]>(
    ["grid"],
    [
      [
        [
          [1, 3, 1],
          [1, 5, 1],
          [4, 2, 1],
        ],
        7,
      ],
      [
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        12,
      ],
    ],
    (t, g) => {
      need(isRect(g) && g.length * g[0].length <= 64, "a rectangle of up to 64 cells");
      const R = g.length;
      const C = g[0].length;
      const dp = table(R, C, null as number | null);
      t.step("You can only move right or down, so dp[r][c] = grid[r][c] + min(cell above, cell to the left). The code keeps just one row of this table.", [
        grid(g, { label: "grid" }),
        grid(dp, { label: "dp: cheapest cost to reach" }),
      ]);
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const up = r ? dp[r - 1][c]! : Infinity;
          const left = c ? dp[r][c - 1]! : Infinity;
          const from = r === 0 && c === 0 ? 0 : Math.min(up, left);
          dp[r][c] = g[r][c] + from;
          const src: [number, number][] = r === 0 && c === 0 ? [] : up <= left ? [[r - 1, c]] : [[r, c - 1]];
          t.step(r === 0 && c === 0 ? `Start: dp[0][0] = ${g[0][0]}.` : `(${r},${c}): ${g[r][c]} + min(above ${up === Infinity ? "—" : up}, left ${left === Infinity ? "—" : left}) = ${dp[r][c]}.`, [
            grid(g, { label: "grid", tones: gridTones([[[r, c]], "cur"]) }),
            grid(dp, {
              label: "dp: cheapest cost to reach",
              tones: gridTones([done(R, C, r, c), "dim"], [src, "cmp"], [[[r, c]], "ok"]),
            }),
          ]);
        }
      t.step(`Cheapest path = ${dp[R - 1][C - 1]}.`, [grid(dp, { label: "dp", tones: gridTones([[[R - 1, C - 1]], "ok"]) })], "good");
      return dp[R - 1][C - 1];
    },
  ),

  "unique-paths-ii": sim<[number[][]]>(
    ["obstacleGrid"],
    [
      [
        [
          [0, 0, 0],
          [0, 1, 0],
          [0, 0, 0],
        ],
        2,
      ],
      [
        [
          [0, 1],
          [0, 0],
        ],
        1,
      ],
      [
        [
          [0, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 0, 1],
          [0, 0, 0, 0],
        ],
        4,
      ],
    ],
    (t, g) => {
      need(isRect(g) && g.length * g[0].length <= 64 && g.flat().every((v) => v === 0 || v === 1), "a rectangle of 0/1, up to 64 cells");
      const R = g.length;
      const C = g[0].length;
      const dp = table(R, C, null as number | null);
      const rocks: [number, number][] = [];
      g.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) rocks.push([r, c]);
        }),
      );
      t.step("Paths into a cell = paths into the cell above + paths into the cell to the left. An obstacle has 0 paths.", [
        grid(
          g.map((row) => row.map((v) => (v ? "🪨" : ""))),
          { label: "grid" },
        ),
        grid(dp, { label: "dp: number of paths" }),
      ]);
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          let note: string;
          if (g[r][c] === 1) {
            dp[r][c] = 0;
            note = `(${r},${c}) is an obstacle: 0 paths.`;
          } else if (!r && !c) {
            dp[r][c] = 1;
            note = "The start has 1 path.";
          } else {
            const up = r ? dp[r - 1][c]! : 0;
            const left = c ? dp[r][c - 1]! : 0;
            dp[r][c] = up + left;
            note = `(${r},${c}): above ${up} + left ${left} = ${dp[r][c]}.`;
          }
          t.step(note, [
            grid(dp, {
              label: "dp: number of paths",
              tones: gridTones(
                [rocks, "bad"],
                [
                  r || c
                    ? (
                        [
                          [r - 1, c],
                          [r, c - 1],
                        ] as [number, number][]
                      ).filter(([a, b]) => a >= 0 && b >= 0)
                    : [],
                  "cmp",
                ],
                [[[r, c]], g[r][c] ? "bad" : "ok"],
              ),
            }),
          ]);
        }
      t.step(
        `${dp[R - 1][C - 1]} unique path${dp[R - 1][C - 1] === 1 ? "" : "s"}.`,
        [
          grid(dp, {
            label: "dp",
            tones: gridTones([rocks, "bad"], [[[R - 1, C - 1]], "ok"]),
          }),
        ],
        "good",
      );
      return dp[R - 1][C - 1];
    },
  ),

  "longest-palindromic-substring": sim<[string]>(
    ["s"],
    [
      ["babad", "bab"],
      ["cbbd", "bb"],
      ["forgeeksskeegfor", "geeksskeeg"],
    ],
    (t, s) => {
      need(s.length >= 1 && s.length <= 24, "1..24 characters for the visual");
      let best: [number, number] = [0, 1];
      t.step("Every palindrome mirrors around a centre: a single character (odd length) or the gap between two (even length). Expand outwards from all 2n − 1 centres. O(n²) time, O(1) space.", [
        chars(s),
      ]);
      const expand = (l: number, r: number) => {
        while (l >= 0 && r < s.length && s[l] === s[r]) {
          l--;
          r++;
        }
        return [l + 1, r] as [number, number];
      };
      for (let i = 0; i < s.length; i++)
        for (const [l, r] of [expand(i, i), expand(i, i + 1)]) {
          const better = r - l > best[1] - best[0];
          if (better) best = [l, r];
          if (r > l)
            t.step(`Centre ${r - l === 1 || (r - l) % 2 === 1 ? `at ${i}` : `between ${i} and ${i + 1}`}: expands to "${s.slice(l, r)}" (length ${r - l}).${better ? " New longest!" : ""}`, [
              chars(s, {
                win: [l, r - 1],
                tones: tones([range(best[0], best[1]), "ok"], [[i], "cur"]),
              }),
              vars({ best: s.slice(best[0], best[1]) }),
            ]);
        }
      const res = s.slice(best[0], best[1]);
      t.step(`Longest palindrome: "${res}".`, [chars(s, { tones: tones([range(best[0], best[1]), "ok"]) })], "good");
      return res;
    },
  ),

  "interleaving-string": sim<[string, string, string]>(
    ["s1", "s2", "s3"],
    [
      ["aabcc", "dbbca", "aadbbcbcac", true],
      ["aabcc", "dbbca", "aadbbbaccc", false],
      ["ab", "c", "acb", true],
    ],
    (t, s1, s2, s3) => {
      const m = s1.length;
      const n = s2.length;
      need(m <= 8 && n <= 8, "s1 and s2 up to 8 characters for the visual");
      if (m + n !== s3.length) {
        t.step(`|s1| + |s2| = ${m + n} but |s3| = ${s3.length}: impossible.`, [chars(s3, { label: "s3" })]);
        t.step("false.", [chars(s3, { label: "s3" })], "bad");
        return false;
      }
      const dp = table(m + 1, n + 1, null as boolean | null);
      const show = (note: string, i = -1, j = -1, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            grid(
              dp.map((row) => row.map((v) => (v === null ? null : v ? "T" : "F"))),
              {
                label: "dp[i][j]: can s1[:i] + s2[:j] form s3[:i+j]?",
                rows: ["", ...s1],
                cols: ["", ...s2],
                tones: gridTones([dp.flatMap((row, a) => row.flatMap((v, b) => (v ? [[a, b] as [number, number]] : []))), "ok"], [i >= 0 ? [[i, j]] : [], dp[i]?.[j] ? "ok" : "bad"]),
              },
            ),
            chars(s3, { label: "s3", ptrs: i + j > 0 ? { k: i + j - 1 } : {} }),
          ],
          tone,
        );
      show("dp[i][j] is true if the next char of s3 (s3[i+j−1]) can come from s1 (with dp[i−1][j] true) or from s2 (with dp[i][j−1] true).");
      for (let i = 0; i <= m; i++)
        for (let j = 0; j <= n; j++) {
          if (!i && !j) {
            dp[0][0] = true;
            show("Two empty prefixes form the empty prefix of s3: dp[0][0] = true.", 0, 0);
            continue;
          }
          const k = i + j - 1;
          const a = i > 0 && !!dp[i - 1][j] && s1[i - 1] === s3[k];
          const b = j > 0 && !!dp[i][j - 1] && s2[j - 1] === s3[k];
          dp[i][j] = a || b;
          show(
            a
              ? `s3[${k}] = '${s3[k]}' comes from s1[${i - 1}]: true.`
              : b
                ? `s3[${k}] = '${s3[k]}' comes from s2[${j - 1}]: true.`
                : `s3[${k}] = '${s3[k]}' can't be matched from a true neighbour: false.`,
            i,
            j,
          );
        }
      const ok = !!dp[m][n];
      show(ok ? "dp[m][n] is true: s3 is an interleaving." : "dp[m][n] is false: s3 is not an interleaving.", m, n, ok ? "good" : "bad");
      return ok;
    },
  ),

  "edit-distance": sim<[string, string]>(
    ["word1", "word2"],
    [
      ["horse", "ros", 3],
      ["intention", "execution", 5],
    ],
    (t, w1, w2) => {
      const m = w1.length;
      const n = w2.length;
      need(m <= 10 && n <= 10, "words up to 10 characters for the visual");
      const dp = table(m + 1, n + 1, null as number | null);
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      const perCell = m * n <= 42;
      const show = (note: string, i = -1, j = -1, src: [number, number][] = [], tone?: "good") =>
        t.step(
          note,
          [
            grid(dp, {
              label: "dp[i][j]: edits to turn word1[:i] into word2[:j]",
              rows: ["", ...w1],
              cols: ["", ...w2],
              tones: gridTones([src, "cmp"], [i >= 0 ? [[i, j]] : [], "ok"]),
            }),
          ],
          tone,
        );
      show(
        "dp[i][j] = edits to turn the first i letters of word1 into the first j of word2. The first row and column are pure inserts / deletes. Same letters: copy the diagonal. Different: 1 + min(replace ↖, delete ↑, insert ←).",
      );
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (w1[i - 1] === w2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
            if (perCell) show(`'${w1[i - 1]}' = '${w2[j - 1]}': no edit needed, copy the diagonal ${dp[i][j]}.`, i, j, [[i - 1, j - 1]]);
          } else {
            dp[i][j] = 1 + Math.min(dp[i - 1][j]!, dp[i][j - 1]!, dp[i - 1][j - 1]!);
            if (perCell)
              show(`'${w1[i - 1]}' ≠ '${w2[j - 1]}': 1 + min(replace ${dp[i - 1][j - 1]}, delete ${dp[i - 1][j]}, insert ${dp[i][j - 1]}) = ${dp[i][j]}.`, i, j, [
                [i - 1, j - 1],
                [i - 1, j],
                [i, j - 1],
              ]);
          }
        }
        if (!perCell) show(`Row ${i} ('${w1[i - 1]}') filled.`, i, n);
      }
      show(`Edit distance = ${dp[m][n]}.`, m, n, [], "good");
      return dp[m][n];
    },
  ),

  "best-time-to-buy-and-sell-stock-iii": sim<[number[]]>(
    ["prices"],
    [
      [[3, 3, 5, 0, 0, 3, 1, 4], 6],
      [[1, 2, 3, 4, 5], 4],
      [[7, 6, 4, 3, 1], 0],
    ],
    (t, prices) => {
      let b1 = -Infinity;
      let s1 = 0;
      let b2 = -Infinity;
      let s2 = 0;
      const f = (x: number) => (x === -Infinity ? "−∞" : x);
      t.step("Four states, each the best balance so far: after the 1st buy, 1st sell, 2nd buy, 2nd sell. Each day, every state either stays or makes its one transition from the previous state.", [
        arr(prices, { bars: true }),
        vars({ buy1: f(b1), sell1: s1, buy2: f(b2), sell2: s2 }),
      ]);
      prices.forEach((p, i) => {
        b1 = Math.max(b1, -p);
        s1 = Math.max(s1, b1 + p);
        b2 = Math.max(b2, s1 - p);
        s2 = Math.max(s2, b2 + p);
        t.step(`Day ${i}, price ${p}: buy1 = max(buy1, −${p}); sell1 = max(sell1, buy1 + ${p}); buy2 = max(buy2, sell1 − ${p}); sell2 = max(sell2, buy2 + ${p}).`, [
          arr(prices, {
            bars: true,
            ptrs: { day: i },
            tones: { [i]: "cur" },
          }),
          vars({ buy1: b1, sell1: s1, buy2: b2, sell2: s2 }, ["sell2"]),
        ]);
      });
      t.step(`Max profit with at most two trades = ${s2}.`, [vars({ sell2: s2 })], "good");
      return s2;
    },
  ),

  "best-time-to-buy-and-sell-stock-iv": sim<[number, number[]]>(
    ["k", "prices"],
    [
      [2, [2, 4, 1], 2],
      [2, [3, 2, 6, 5, 0, 3], 7],
      [1, [3, 2, 6, 5, 0, 3], 4],
    ],
    (t, k, prices) => {
      need(Number.isInteger(k) && k >= 0 && k <= 6, "k must be 0..6 for the visual");
      if (2 * k >= prices.length) {
        const total = prices.slice(1).reduce((a, p, i) => a + Math.max(0, p - prices[i]), 0);
        t.step(`2k = ${2 * k} ≥ ${prices.length} days: the trade limit can never bind, so just collect every upward move.`, [arr(prices, { bars: true })]);
        t.step(`Profit = ${total}.`, [arr(prices, { bars: true }), vars({ profit: total })], "good");
        return total;
      }
      const buy = Array(k + 1).fill(-Infinity);
      const sell = Array(k + 1).fill(0);
      const f = (x: number) => (x === -Infinity ? "−∞" : x);
      const panel = (hi?: number) =>
        grid([buy.slice(1).map(f), sell.slice(1)], {
          label: "best balance per transaction #",
          rows: ["buy", "sell"],
          cols: range(1, k + 1).map(String),
          tones: hi === undefined ? {} : { [`1,${k - 1}`]: "ok" as Tone },
        });
      t.step(`Generalize the 2-trade version: buy[j] / sell[j] = best balance after the j-th buy / sell. buy[j] comes from sell[j−1], sell[j] from buy[j].`, [arr(prices, { bars: true }), panel()]);
      prices.forEach((p, i) => {
        for (let j = 1; j <= k; j++) {
          buy[j] = Math.max(buy[j], sell[j - 1] - p);
          sell[j] = Math.max(sell[j], buy[j] + p);
        }
        t.step(`Day ${i}, price ${p}: update every buy[j] and sell[j].`, [arr(prices, { bars: true, ptrs: { day: i }, tones: { [i]: "cur" } }), panel()]);
      });
      t.step(`Max profit with at most ${k} trades = ${sell[k]}.`, [panel(k)], "good");
      return sell[k];
    },
  ),

  "maximal-square": sim<[string[][]]>(
    ["matrix"],
    [
      [
        [
          ["1", "0", "1", "0", "0"],
          ["1", "0", "1", "1", "1"],
          ["1", "1", "1", "1", "1"],
          ["1", "0", "0", "1", "0"],
        ],
        4,
      ],
      [
        [
          ["0", "1"],
          ["1", "0"],
        ],
        1,
      ],
      [
        [
          ["1", "1", "1"],
          ["1", "1", "1"],
          ["1", "1", "1"],
        ],
        9,
      ],
    ],
    (t, mtx) => {
      need(isRect(mtx) && mtx.length * mtx[0].length <= 64, 'a rectangle of "0"/"1", up to 64 cells');
      const R = mtx.length;
      const C = mtx[0].length;
      const dp = table(R, C, null as number | null);
      let best = 0;
      let bestAt: [number, number] = [0, 0];
      t.step("dp[r][c] = side of the largest all-1 square whose BOTTOM-RIGHT corner is (r,c) = 1 + min(above, left, diagonal). The smallest neighbour limits how far the square can grow.", [
        grid(mtx, { label: "matrix" }),
        grid(dp, { label: "dp: square side ending here" }),
      ]);
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (mtx[r][c] === "0") dp[r][c] = 0;
          else dp[r][c] = 1 + Math.min(r ? dp[r - 1][c]! : 0, c ? dp[r][c - 1]! : 0, r && c ? dp[r - 1][c - 1]! : 0);
          if (dp[r][c]! > best) {
            best = dp[r][c]!;
            bestAt = [r, c];
          }
          const sq: [number, number][] = [];
          for (let a = 0; a < (dp[r][c] ?? 0); a++) for (let b = 0; b < (dp[r][c] ?? 0); b++) sq.push([r - a, c - b]);
          if (mtx[r][c] === "1")
            t.step(`(${r},${c}): 1 + min(above, left, diagonal) = ${dp[r][c]}${dp[r][c] === best && bestAt[0] === r && bestAt[1] === c ? ", the biggest so far" : ""}.`, [
              grid(mtx, { label: "matrix", tones: gridTones([sq, "ok"]) }),
              grid(dp, {
                label: "dp: square side ending here",
                tones: gridTones(
                  [
                    (
                      [
                        [r - 1, c],
                        [r, c - 1],
                        [r - 1, c - 1],
                      ] as [number, number][]
                    ).filter(([a, b]) => a >= 0 && b >= 0),
                    "cmp",
                  ],
                  [[[r, c]], "ok"],
                ),
              }),
              vars({ best }),
            ]);
        }
      const sq: [number, number][] = [];
      for (let a = 0; a < best; a++) for (let b = 0; b < best; b++) sq.push([bestAt[0] - a, bestAt[1] - b]);
      t.step(`Largest square has side ${best}, area ${best * best}.`, [grid(mtx, { label: "matrix", tones: gridTones([sq, "ok"]) }), vars({ area: best * best })], "good");
      return best * best;
    },
  ),
};
