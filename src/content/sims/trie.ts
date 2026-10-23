import { fmt, grid, gridTones, need, out, sim } from "@/lib/sim/build";
import type { Sim, Tone, TreeNode, TreePanel } from "@/lib/sim/types";

interface TNode {
  kids: Map<string, TNode>;
  end: string | null;
}
const mk = (): TNode => ({ kids: new Map(), end: null });

function panel(root: TNode, hi: Record<string, Tone> = {}, label = "trie (purple = end of a word)"): TreePanel {
  const conv = (n: TNode, path: string, ch: string): TreeNode => ({
    id: `p${path}`,
    label: ch,
    tone: hi[path] ?? (n.end !== null ? "pick" : undefined),
    kids: [...n.kids].map(([c, k]) => conv(k, path + c, c)),
  });
  return { kind: "tree", label, root: conv(root, "", "·") };
}

function insert(root: TNode, w: string, end: string = w) {
  let n = root;
  for (const ch of w) {
    if (!n.kids.has(ch)) n.kids.set(ch, mk());
    n = n.kids.get(ch)!;
  }
  n.end = end;
}

/** shared op runner for the two design problems */
function runOps(
  t: Parameters<Sim["run"]>[0],
  ops: string[],
  args: string[][],
  intro: string,
  handlers: Record<string, (root: TNode, s: string, show: (note: string, hi?: Record<string, Tone>) => void) => unknown>,
) {
  const root = mk();
  const res: unknown[] = [];
  const show = (note: string, hi: Record<string, Tone> = {}) => t.step(note, [panel(root, hi), out("returned", res.map(fmt))]);
  ops.forEach((op, i) => {
    if (i === 0) {
      res.push(null);
      show(intro);
      return;
    }
    const h = handlers[op];
    need(h, `unknown op ${op}`);
    const r = h(root, args[i][0], show);
    res.push(r === undefined ? null : r);
    if (r !== undefined) show(`${op}("${args[i][0]}") → ${r}.`);
  });
  return res;
}

const pathTones = (w: string, tone: Tone) => Object.fromEntries([...w].map((_, i) => [w.slice(0, i + 1), tone]));

export const SIMS: Record<string, Sim> = {
  "implement-trie-prefix-tree": sim<[string[], string[][]]>(
    ["ops", "args"],
    [
      [
        ["Trie", "insert", "search", "search", "startsWith", "insert", "search"],
        [[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"]],
        [null, null, true, false, true, null, true],
      ],
      [
        ["Trie", "insert", "insert", "startsWith", "search", "search"],
        [[], ["car"], ["cat"], ["ca"], ["ca"], ["cat"]],
        [null, null, null, true, false, true],
      ],
    ],
    (t, ops, args) => {
      const walk = (root: TNode, s: string) => {
        let n: TNode | undefined = root;
        for (const ch of s) n = n?.kids.get(ch);
        return n;
      };
      return runOps(t, ops, args, "Each edge is one character; shared prefixes share a path. A flag on a node marks where a whole word ends.", {
        insert: (root, w, show) => {
          insert(root, w);
          show(`insert("${w}"): follow existing characters, create the missing ones, flag the last node as a word end.`, pathTones(w, "ok"));
          return undefined;
        },
        search: (root, w, show) => {
          const n = walk(root, w);
          show(
            n ? `search("${w}"): the path exists; ${n.end !== null ? "and its last node is a word end" : "but its last node is NOT a word end"}.` : `search("${w}"): the path breaks off.`,
            pathTones(w, n && n.end !== null ? "ok" : "bad"),
          );
          return !!n && n.end !== null;
        },
        startsWith: (root, w, show) => {
          const n = walk(root, w);
          show(`startsWith("${w}"): ${n ? "the whole path exists, which is enough for a prefix" : "the path breaks off"}.`, pathTones(w, n ? "ok" : "bad"));
          return !!n;
        },
      });
    },
  ),

  "design-add-and-search-words-data-structure": sim<[string[], string[][]]>(
    ["ops", "args"],
    [
      [
        ["WordDictionary", "addWord", "addWord", "addWord", "search", "search", "search", "search"],
        [[], ["bad"], ["dad"], ["mad"], ["pad"], ["bad"], [".ad"], ["b.."]],
        [null, null, null, null, false, true, true, true],
      ],
      [
        ["WordDictionary", "addWord", "addWord", "search", "search"],
        [[], ["at"], ["and"], ["a."], [".n."]],
        [null, null, null, true, true],
      ],
    ],
    (t, ops, args) =>
      runOps(t, ops, args, "A trie where '.' in a search matches any character: at a dot, try every child (DFS with backtracking).", {
        addWord: (root, w, show) => {
          insert(root, w);
          show(`addWord("${w}").`, pathTones(w, "ok"));
          return undefined;
        },
        search: (root, w, show) => {
          const tried: Record<string, Tone> = {};
          const dfs = (n: TNode, i: number, path: string): boolean => {
            if (i === w.length) {
              tried[path] = n.end !== null ? "ok" : "bad";
              return n.end !== null;
            }
            const opts = w[i] === "." ? [...n.kids.keys()] : n.kids.has(w[i]) ? [w[i]] : [];
            for (const ch of opts) {
              tried[path + ch] = "cur";
              show(`search("${w}"): character ${i} is '${w[i]}'${w[i] === "." ? `, try '${ch}'` : ""}.`, { ...tried });
              if (dfs(n.kids.get(ch)!, i + 1, path + ch)) {
                tried[path + ch] = "ok";
                return true;
              }
              tried[path + ch] = "dim";
            }
            return false;
          };
          return dfs(root, 0, "");
        },
      }),
  ),

  "word-search-ii": sim<[string[][], string[]]>(
    ["board", "words"],
    [
      [
        [
          ["o", "a", "a", "n"],
          ["e", "t", "a", "e"],
          ["i", "h", "k", "r"],
          ["i", "f", "l", "v"],
        ],
        ["oath", "pea", "eat", "rain"],
        ["oath", "eat"],
      ],
      [
        [
          ["a", "b"],
          ["c", "d"],
        ],
        ["abcb"],
        [],
      ],
    ],
    (t, board, words) => {
      need(board.length > 0 && board.every((r) => r.length === board[0].length), "board must be a rectangle");
      const R = board.length;
      const C = board[0].length;
      const root = mk();
      for (const w of words) insert(root, w);
      const found: string[] = [];
      const path: [number, number][] = [];
      const show = (note: string, tone?: "good") =>
        t.step(note, [grid(board, { tones: gridTones([path, "cur"]) }), panel(root, {}, "trie of the words (pruned as they're found)"), out("found", found)], tone);
      show("Put every word in a trie, then DFS from each cell, following the trie as you go. One walk checks all words at once, and found words are pruned from the trie.");
      const dfs = (r: number, c: number, parent: TNode) => {
        const ch = board[r][c];
        const node = parent.kids.get(ch)!;
        path.push([r, c]);
        if (node.end !== null) {
          found.push(node.end);
          show(`The path spells "${node.end}", a word end in the trie. Found it!`);
          node.end = null;
        } else show(`'${ch}' continues a trie path.`);
        board[r][c] = "#";
        for (const [a, b] of [
          [r + 1, c],
          [r - 1, c],
          [r, c + 1],
          [r, c - 1],
        ])
          if (a >= 0 && a < R && b >= 0 && b < C && node.kids.has(board[a][b])) dfs(a, b, node);
        board[r][c] = ch;
        path.pop();
        if (!node.kids.size && node.end === null) parent.kids.delete(ch);
      };
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (root.kids.has(board[r][c])) dfs(r, c, root);
      show(`Found ${found.length ? found.join(", ") : "nothing"}.`, "good");
      return found;
    },
  ),
};
