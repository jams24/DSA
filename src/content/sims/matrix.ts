import { fmt, grid, gridTones, need, out, sim, vars } from "@/lib/sim/build";
import type { Sim, Tone } from "@/lib/sim/types";

const isRect = (m: unknown[][]) => m.length > 0 && m.every((r) => Array.isArray(r) && r.length === m[0].length && r.length > 0);

const SUDOKU_OK = [
  ["5", "3", ".", ".", "7", ".", ".", ".", "."],
  ["6", ".", ".", "1", "9", "5", ".", ".", "."],
  [".", "9", "8", ".", ".", ".", ".", "6", "."],
  ["8", ".", ".", ".", "6", ".", ".", ".", "3"],
  ["4", ".", ".", "8", ".", "3", ".", ".", "1"],
  ["7", ".", ".", ".", "2", ".", ".", ".", "6"],
  [".", "6", ".", ".", ".", ".", "2", "8", "."],
  [".", ".", ".", "4", "1", "9", ".", ".", "5"],
  [".", ".", ".", ".", "8", ".", ".", "7", "9"],
];

export const SIMS: Record<string, Sim> = {
  "valid-sudoku": sim<[string[][]]>(
    ["board"],
    [
      [SUDOKU_OK, true],
      [[["8", ...SUDOKU_OK[0].slice(1)], ...SUDOKU_OK.slice(1)], false],
    ],
    (t, board) => {
      need(board.length === 9 && board.every((r) => r.length === 9), "board must be 9×9");
      const seen = new Map<string, [number, number]>();
      const done: [number, number][] = [];
      const show = (note: string, extra: [Iterable<[number, number]>, Tone][] = [], tone?: "good" | "bad") =>
        t.step(
          note,
          [
            grid(
              board.map((r) => r.map((v) => (v === "." ? null : v))),
              { tones: gridTones([done, "dim"], ...extra) },
            ),
            vars({ "keys seen": seen.size }),
          ],
          tone,
        );
      show("One pass over the filled cells. Each digit claims three keys: (row, digit), (column, digit) and (box, digit). A key seen twice means a conflict.");
      let filled = 0;
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
          const v = board[r][c];
          if (v === ".") continue;
          const keys = [`row ${r} has ${v}`, `col ${c} has ${v}`, `box ${Math.floor(r / 3)},${Math.floor(c / 3)} has ${v}`];
          const clash = keys.find((k) => seen.has(k));
          if (clash) {
            show(
              `${v} at (${r},${c}) conflicts: "${clash}" was already claimed by (${seen.get(clash)!.join(",")}). Not valid.`,
              [
                [[seen.get(clash)!], "bad"],
                [[[r, c]], "bad"],
              ],
              "bad",
            );
            return false;
          }
          for (const k of keys) seen.set(k, [r, c]);
          done.push([r, c]);
          if (++filled <= 12 || filled % 6 === 0)
            show(`${v} at (${r},${c}): row ${r}, column ${c} and box ${Math.floor(r / 3)},${Math.floor(c / 3)} have no ${v} yet. Record all three keys.`, [[[[r, c]], "cur"]]);
        }
      show(`All ${filled} filled cells checked, no conflicts: valid.`, [[done, "ok"]], "good");
      return true;
    },
  ),

  "spiral-matrix": sim<[number[][]]>(
    ["matrix"],
    [
      [
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        [1, 2, 3, 6, 9, 8, 7, 4, 5],
      ],
      [
        [
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10, 11, 12],
        ],
        [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7],
      ],
    ],
    (t, m) => {
      need(isRect(m), "matrix must be a non-empty rectangle");
      const res: number[] = [];
      const seen: [number, number][] = [];
      let top = 0;
      let bottom = m.length - 1;
      let left = 0;
      let right = m[0].length - 1;
      const take = (r: number, c: number, dir: string) => {
        res.push(m[r][c]);
        seen.push([r, c]);
        t.step(`${dir}: take ${m[r][c]}.`, [grid(m, { tones: gridTones([seen, "ok"], [[[r, c]], "cur"]) }), vars({ top, bottom, left, right }), out("result", res)]);
      };
      t.step("Four boundaries shrink inward: walk the top row, the right column, the bottom row, the left column, and pull the matching boundary in after each.", [
        grid(m),
        vars({ top, bottom, left, right }),
        out("result", res),
      ]);
      while (top <= bottom && left <= right) {
        for (let c = left; c <= right; c++) take(top, c, "→ top row");
        top++;
        for (let r = top; r <= bottom; r++) take(r, right, "↓ right column");
        right--;
        if (top <= bottom) {
          for (let c = right; c >= left; c--) take(bottom, c, "← bottom row");
          bottom--;
        }
        if (left <= right) {
          for (let r = bottom; r >= top; r--) take(r, left, "↑ left column");
          left++;
        }
      }
      t.step(`Spiral order: ${fmt(res)}.`, [grid(m, { tones: gridTones([seen, "ok"]) }), out("result", res)], "good");
      return res;
    },
  ),

  "rotate-image": sim<[number[][]]>(
    ["matrix"],
    [
      [
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        [
          [7, 4, 1],
          [8, 5, 2],
          [9, 6, 3],
        ],
      ],
      [
        [
          [5, 1, 9, 11],
          [2, 4, 8, 10],
          [13, 3, 6, 7],
          [15, 14, 12, 16],
        ],
        [
          [15, 13, 2, 5],
          [14, 3, 4, 1],
          [12, 6, 8, 9],
          [16, 7, 10, 11],
        ],
      ],
    ],
    (t, m) => {
      const n = m.length;
      need(isRect(m) && m[0].length === n, "matrix must be square");
      t.step("Rotate 90° clockwise in place = transpose (flip over the main diagonal), then reverse every row.", [
        grid(m, {
          tones: gridTones([Array.from({ length: n }, (_, i) => [i, i] as [number, number]), "dim"]),
        }),
      ]);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          [m[i][j], m[j][i]] = [m[j][i], m[i][j]];
          t.step(`Transpose: swap (${i},${j}) ↔ (${j},${i}).`, [
            grid(m, {
              tones: gridTones([
                [
                  [i, j],
                  [j, i],
                ],
                "alt",
              ]),
            }),
          ]);
        }
      for (let i = 0; i < n; i++) {
        m[i].reverse();
        t.step(`Reverse row ${i}.`, [
          grid(m, {
            tones: gridTones([Array.from({ length: n }, (_, c) => [i, c] as [number, number]), "cur"]),
          }),
        ]);
      }
      t.step(
        "Rotated in place, O(1) extra space.",
        [
          grid(m, {
            tones: gridTones([m.flatMap((row, r) => row.map((_, c) => [r, c] as [number, number])), "ok"]),
          }),
        ],
        "good",
      );
      return m;
    },
  ),

  "set-matrix-zeroes": sim<[number[][]]>(
    ["matrix"],
    [
      [
        [
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 1],
        ],
        [
          [1, 0, 1],
          [0, 0, 0],
          [1, 0, 1],
        ],
      ],
      [
        [
          [0, 1, 2, 0],
          [3, 4, 5, 2],
          [1, 3, 1, 5],
        ],
        [
          [0, 0, 0, 0],
          [0, 4, 5, 0],
          [0, 3, 1, 0],
        ],
      ],
    ],
    (t, m) => {
      need(isRect(m), "matrix must be a non-empty rectangle");
      const R = m.length;
      const C = m[0].length;
      const markers = (): [number, number][] => [...Array.from({ length: R }, (_, r) => [r, 0] as [number, number]), ...Array.from({ length: C }, (_, c) => [0, c] as [number, number])];
      const firstRow = m[0].some((v) => v === 0);
      const firstCol = m.some((row) => row[0] === 0);
      const show = (note: string, cur: [number, number][] = [], tone?: "good") =>
        t.step(note, [grid(m, { tones: gridTones([markers(), "pick"], [cur, "cur"]) }), vars({ firstRowHasZero: firstRow, firstColHasZero: firstCol })], tone);
      show("Use the first row and first column as marker storage (purple), so no extra arrays are needed. First remember whether they contain a zero themselves.");
      for (let r = 1; r < R; r++)
        for (let c = 1; c < C; c++)
          if (m[r][c] === 0) {
            m[r][0] = 0;
            m[0][c] = 0;
            show(`Zero at (${r},${c}): mark its row in column 0 and its column in row 0.`, [
              [r, c],
              [r, 0],
              [0, c],
            ]);
          }
      for (let r = 1; r < R; r++)
        for (let c = 1; c < C; c++)
          if ((m[r][0] === 0 || m[0][c] === 0) && m[r][c] !== 0) {
            m[r][c] = 0;
            show(`(${r},${c}): its row or column is marked, so set it to 0.`, [[r, c]]);
          }
      if (firstRow) {
        m[0].fill(0);
        show(
          "Row 0 had a zero originally: zero the whole first row.",
          Array.from({ length: C }, (_, c) => [0, c]),
        );
      }
      if (firstCol) {
        for (const row of m) row[0] = 0;
        show(
          "Column 0 had a zero originally: zero the whole first column.",
          Array.from({ length: R }, (_, r) => [r, 0]),
        );
      }
      t.step("Done with O(1) extra space.", [grid(m)], "good");
      return m;
    },
  ),

  "game-of-life": sim<[number[][]]>(
    ["board"],
    [
      [
        [
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 1],
          [0, 0, 0],
        ],
        [
          [0, 0, 0],
          [1, 0, 1],
          [0, 1, 1],
          [0, 1, 0],
        ],
      ],
      [
        [
          [1, 1],
          [1, 0],
        ],
        [
          [1, 1],
          [1, 1],
        ],
      ],
    ],
    (t, b) => {
      need(isRect(b) && b.flat().every((v) => v === 0 || v === 1), "board must be a rectangle of 0s and 1s");
      const R = b.length;
      const C = b[0].length;
      const nb = (r: number, c: number) => {
        const res: [number, number][] = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && r + dr >= 0 && r + dr < R && c + dc >= 0 && c + dc < C) res.push([r + dr, c + dc]);
        return res;
      };
      const alive = () =>
        b
          .flatMap((row, r) => row.map((v, c) => [r, c, v] as const))
          .filter(([, , v]) => v & 1)
          .map(([r, c]) => [r, c] as [number, number]);
      t.step("Update in place with two bits per cell: bit 0 = alive now, bit 1 = alive next. Neighbours are counted from bit 0 only, so the update never reads half-changed values.", [
        grid(b, { tones: gridTones([alive(), "ok"]) }),
      ]);
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const ns = nb(r, c);
          const live = ns.filter(([y, x]) => b[y][x] & 1).length;
          const now = b[r][c] & 1;
          const next = (now && (live === 2 || live === 3)) || (!now && live === 3);
          if (next) b[r][c] |= 2;
          const why = now
            ? next
              ? `alive with ${live} live neighbours: survives`
              : `alive with ${live} live neighbour${live === 1 ? "" : "s"}: dies`
            : next
              ? "dead with exactly 3 live neighbours: born"
              : `dead with ${live}: stays dead`;
          t.step(`(${r},${c}) is ${why}. Cell value = ${b[r][c]} (next ${next ? 1 : 0}, now ${now}).`, [
            grid(b, {
              tones: gridTones([ns, "cmp"], [[[r, c]], next ? "ok" : "bad"]),
            }),
            vars({ "live neighbours": live }),
          ]);
        }
      for (const row of b) for (let c = 0; c < C; c++) row[c] >>= 1;
      t.step("Shift every cell right by one bit: the 'next' bit becomes the new state.", [grid(b, { tones: gridTones([alive(), "ok"]) })], "good");
      return b;
    },
  ),
};
