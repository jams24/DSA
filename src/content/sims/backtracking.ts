import { fmt, grid, gridTones, need, out, RecTree, sim, vars } from "@/lib/sim/build";
import type { Sim, TreeNode } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "letter-combinations-of-a-phone-number": sim<[string]>(
    ["digits"],
    [
      ["23", ["ad", "ae", "af", "bd", "be", "bf", "cd", "ce", "cf"]],
      ["7", ["p", "q", "r", "s"]],
      ["", []],
    ],
    (t, digits) => {
      need(/^[2-9]{0,3}$/.test(digits), "up to 3 digits from 2-9 for the visual");
      const phone: Record<string, string> = {
        "2": "abc",
        "3": "def",
        "4": "ghi",
        "5": "jkl",
        "6": "mno",
        "7": "pqrs",
        "8": "tuv",
        "9": "wxyz",
      };
      const res: string[] = [];
      const tree = new RecTree("start");
      if (!digits) {
        t.step("No digits, so there are no combinations.", [out("combinations", res)]);
        t.step("Return [].", [out("combinations", res)], "good");
        return res;
      }
      t.step("Backtracking: at depth i choose one letter for digits[i], recurse, then undo the choice and try the next letter.", [tree.panel("recursion tree"), out("combinations", res)]);
      const bt = (i: number, path: string, node: TreeNode) => {
        if (i === digits.length) {
          res.push(path);
          node.tone = "ok";
          t.step(`All ${digits.length} digits chosen: record "${path}".`, [tree.panel("recursion tree"), out("combinations", res, [res.length - 1])]);
          return;
        }
        for (const ch of phone[digits[i]]) {
          const kid = tree.add(node, path + ch, "cur");
          if (i + 1 < digits.length) t.step(`Digit '${digits[i]}' → try '${ch}'.`, [tree.panel("recursion tree"), out("combinations", res)]);
          bt(i + 1, path + ch, kid);
          if (kid.tone === "cur") kid.tone = "dim";
        }
      };
      bt(0, "", tree.root);
      t.step(`${res.length} combinations.`, [tree.panel("recursion tree"), out("combinations", res)], "good");
      return res;
    },
  ),

  combinations: sim<[number, number]>(
    ["n", "k"],
    [
      [
        4,
        2,
        [
          [1, 2],
          [1, 3],
          [1, 4],
          [2, 3],
          [2, 4],
          [3, 4],
        ],
      ],
      [3, 3, [[1, 2, 3]]],
      [1, 1, [[1]]],
    ],
    (t, n, k) => {
      need(n >= 1 && n <= 6 && k >= 1 && k <= n, "1 ≤ k ≤ n ≤ 6 for the visual");
      const res: number[][] = [];
      const path: number[] = [];
      const tree = new RecTree("[]");
      t.step("Choose numbers in increasing order so each set appears once. Prune: stop the loop early when there aren't enough numbers left to reach k.", [
        tree.panel("recursion tree"),
        out("combinations", []),
      ]);
      const bt = (start: number, node: TreeNode) => {
        if (path.length === k) {
          res.push([...path]);
          node.tone = "ok";
          t.step(`${k} numbers chosen: record ${fmt(path)}.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt), [res.length - 1])]);
          return;
        }
        for (let x = start; x <= n - (k - path.length) + 1; x++) {
          path.push(x);
          const kid = tree.add(node, fmt(path), "cur");
          if (path.length < k) t.step(`Add ${x}: path ${fmt(path)}.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt))]);
          bt(x + 1, kid);
          if (kid.tone === "cur") kid.tone = "dim";
          path.pop();
        }
      };
      bt(1, tree.root);
      t.step(`C(${n}, ${k}) = ${res.length} combinations.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt))], "good");
      return res;
    },
  ),

  permutations: sim<[number[]]>(
    ["nums"],
    [
      [
        [1, 2, 3],
        [
          [1, 2, 3],
          [1, 3, 2],
          [2, 1, 3],
          [2, 3, 1],
          [3, 1, 2],
          [3, 2, 1],
        ],
      ],
      [
        [0, 1],
        [
          [0, 1],
          [1, 0],
        ],
      ],
      [[1], [[1]]],
    ],
    (t, nums) => {
      need(nums.length >= 1 && nums.length <= 4, "1 to 4 numbers for the visual");
      const res: number[][] = [];
      const path: number[] = [];
      const used = nums.map(() => false);
      const tree = new RecTree("[]");
      t.step("At each level pick any number not used yet (a 'used' array tracks that), recurse, then un-pick it. n! leaves.", [tree.panel("recursion tree"), out("permutations", [])]);
      const bt = (node: TreeNode) => {
        if (path.length === nums.length) {
          res.push([...path]);
          node.tone = "ok";
          t.step(`Full permutation ${fmt(path)}.`, [tree.panel("recursion tree"), out("permutations", res.map(fmt), [res.length - 1])]);
          return;
        }
        nums.forEach((x, i) => {
          if (used[i]) return;
          used[i] = true;
          path.push(x);
          const kid = tree.add(node, fmt(path), "cur");
          if (path.length < nums.length) t.step(`Pick ${x}: ${fmt(path)}.`, [tree.panel("recursion tree"), out("permutations", res.map(fmt))]);
          bt(kid);
          if (kid.tone === "cur") kid.tone = "dim";
          path.pop();
          used[i] = false;
        });
      };
      bt(tree.root);
      t.step(`${res.length} permutations.`, [tree.panel("recursion tree"), out("permutations", res.map(fmt))], "good");
      return res;
    },
  ),

  "combination-sum": sim<[number[], number]>(
    ["candidates", "target"],
    [
      [[2, 3, 6, 7], 7, [[2, 2, 3], [7]]],
      [
        [2, 3, 5],
        8,
        [
          [2, 2, 2, 2],
          [2, 3, 3],
          [3, 5],
        ],
      ],
      [[2], 1, []],
    ],
    (t, cands, target) => {
      need(cands.every((c) => c > 0) && target <= 20, "positive candidates, target ≤ 20 for the visual");
      cands.sort((a, b) => a - b);
      const res: number[][] = [];
      const path: number[] = [];
      const tree = new RecTree(`need ${target}`);
      t.step("Sort the candidates. Recurse with start = i (not i + 1) so a number can be reused, and break as soon as a candidate exceeds what's left: everything after it is bigger.", [
        tree.panel("recursion tree"),
        out("combinations", []),
      ]);
      const bt = (start: number, remain: number, node: TreeNode) => {
        if (remain === 0) {
          res.push([...path]);
          node.tone = "ok";
          t.step(`Sum hits ${target} exactly: record ${fmt(path)}.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt), [res.length - 1])]);
          return;
        }
        for (let i = start; i < cands.length; i++) {
          const c = cands[i];
          if (c > remain) {
            const cut = tree.add(node, `${c}✗`, "bad");
            t.step(`${c} > ${remain} left: prune this and every larger candidate.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt))]);
            cut.tone = "dim";
            break;
          }
          path.push(c);
          const kid = tree.add(node, `+${c}=${target - remain + c}`, "cur");
          t.step(`Take ${c}: path ${fmt(path)}, ${remain - c} left.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt))]);
          bt(i, remain - c, kid);
          if (kid.tone === "cur") kid.tone = "dim";
          path.pop();
        }
      };
      bt(0, target, tree.root);
      t.step(`${res.length} combination${res.length === 1 ? "" : "s"}.`, [tree.panel("recursion tree"), out("combinations", res.map(fmt))], "good");
      return res;
    },
  ),

  "n-queens-ii": sim<[number]>(
    ["n"],
    [
      [4, 2],
      [1, 1],
      [5, 10],
    ],
    (t, n) => {
      need(Number.isInteger(n) && n >= 1 && n <= 6, "n must be 1..6 for the visual");
      const board: (string | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
      const cols = new Set<number>();
      const diag = new Set<number>();
      const anti = new Set<number>();
      let count = 0;
      const queens = () =>
        board
          .flatMap((row, r) => row.map((v, c) => [r, c, v] as const))
          .filter(([, , v]) => v === "♛")
          .map(([r, c]) => [r, c] as [number, number]);
      const attacked = (): [number, number][] => {
        const res: [number, number][] = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (board[r][c] !== "♛" && (cols.has(c) || diag.has(r - c) || anti.has(r + c))) res.push([r, c]);
        return res;
      };
      const show = (note: string, tone?: "good") =>
        t.step(
          note,
          [
            grid(board, {
              tones: gridTones([attacked(), "dim"], [queens(), "pick"]),
            }),
            vars({ solutions: count }),
          ],
          tone,
        );
      show("Place one queen per row. Sets of used columns, diagonals (r − c) and anti-diagonals (r + c) make each safety check O(1). Grey squares are under attack.");
      const bt = (r: number) => {
        if (r === n) {
          count++;
          show(`All ${n} queens placed: solution #${count}. Backtrack to find more.`, "good");
          return;
        }
        for (let c = 0; c < n; c++) {
          if (cols.has(c) || diag.has(r - c) || anti.has(r + c)) continue;
          cols.add(c);
          diag.add(r - c);
          anti.add(r + c);
          board[r][c] = "♛";
          if (r + 1 < n) show(`Row ${r}: column ${c} is safe, place a queen.`);
          bt(r + 1);
          board[r][c] = null;
          cols.delete(c);
          diag.delete(r - c);
          anti.delete(r + c);
          if (r + 1 < n) show(`Remove the queen at (${r},${c}) and try the next column.`);
        }
      };
      bt(0);
      show(`${n}-queens has ${count} solution${count === 1 ? "" : "s"}.`, "good");
      return count;
    },
  ),

  "generate-parentheses": sim<[number]>(
    ["n"],
    [
      [3, ["((()))", "(()())", "(())()", "()(())", "()()()"]],
      [1, ["()"]],
      [2, ["(())", "()()"]],
    ],
    (t, n) => {
      need(Number.isInteger(n) && n >= 1 && n <= 4, "n must be 1..4 for the visual");
      const res: string[] = [];
      const tree = new RecTree("''");
      t.step("Only build strings that stay valid: add '(' while fewer than n are open, add ')' only while it would close an open one. No invalid string is ever generated.", [
        tree.panel("recursion tree"),
        out("results", res),
      ]);
      const bt = (s: string, open: number, closed: number, node: TreeNode) => {
        if (s.length === 2 * n) {
          res.push(s);
          node.tone = "ok";
          t.step(`Length ${2 * n}: record "${s}".`, [tree.panel("recursion tree"), out("results", res, [res.length - 1])]);
          return;
        }
        if (open < n) {
          const kid = tree.add(node, s + "(", "cur");
          t.step(`${open} < ${n} opened: add '('.`, [tree.panel("recursion tree"), out("results", res)]);
          bt(s + "(", open + 1, closed, kid);
          if (kid.tone === "cur") kid.tone = "dim";
        }
        if (closed < open) {
          const kid = tree.add(node, s + ")", "cur");
          t.step(`${closed} closed < ${open} opened: add ')'.`, [tree.panel("recursion tree"), out("results", res)]);
          bt(s + ")", open, closed + 1, kid);
          if (kid.tone === "cur") kid.tone = "dim";
        }
      };
      bt("", 0, 0, tree.root);
      t.step(`${res.length} valid strings (the ${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} Catalan number).`, [tree.panel("recursion tree"), out("results", res)], "good");
      return res;
    },
  ),

  "word-search": sim<[string[][], string]>(
    ["board", "word"],
    [
      [
        [
          ["A", "B", "C", "E"],
          ["S", "F", "C", "S"],
          ["A", "D", "E", "E"],
        ],
        "ABCCED",
        true,
      ],
      [
        [
          ["A", "B", "C", "E"],
          ["S", "F", "C", "S"],
          ["A", "D", "E", "E"],
        ],
        "SEE",
        true,
      ],
      [
        [
          ["A", "B", "C", "E"],
          ["S", "F", "C", "S"],
          ["A", "D", "E", "E"],
        ],
        "ABCB",
        false,
      ],
    ],
    (t, board, word) => {
      need(board.length > 0 && board.every((r) => r.length === board[0].length), "board must be a rectangle");
      need(word.length > 0 && word.length <= 10, "word must be 1..10 letters");
      const R = board.length;
      const C = board[0].length;
      const path: [number, number][] = [];
      const show = (note: string, bad?: [number, number], tone?: "good" | "bad") =>
        t.step(
          note,
          [
            grid(board, {
              tones: gridTones([path, "ok"], [bad ? [bad] : [], "bad"]),
            }),
            vars({ word, matched: word.slice(0, path.length) || "''" }),
          ],
          tone,
        );
      show("Try each cell as a start. DFS to neighbours matching the next letter, marking cells on the current path so they aren't reused, and unmark on the way back.");
      const dfs = (r: number, c: number, i: number): boolean => {
        if (i === word.length) return true;
        if (r < 0 || r >= R || c < 0 || c >= C || board[r][c] !== word[i]) return false;
        const ch = board[r][c];
        path.push([r, c]);
        board[r][c] = "#";
        show(`(${r},${c}) = '${ch}' matches word[${i}].`);
        const found = dfs(r + 1, c, i + 1) || dfs(r - 1, c, i + 1) || dfs(r, c + 1, i + 1) || dfs(r, c - 1, i + 1);
        board[r][c] = ch;
        if (!found) {
          path.pop();
          show(`Dead end after '${ch}' at (${r},${c}): backtrack.`, [r, c]);
        }
        return found;
      };
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++)
          if (board[r][c] === word[0] && dfs(r, c, 0)) {
            show(`Found "${word}" along the green path.`, undefined, "good");
            return true;
          }
      show(`"${word}" can't be traced on the board.`, undefined, "bad");
      return false;
    },
  ),
};
