import { chars, grid, gridTones, map, need, queue, set, sim, vars } from "@/lib/sim/build";
import type { Sim } from "@/lib/sim/types";

export const SIMS: Record<string, Sim> = {
  "snakes-and-ladders": sim<[number[][]]>(
    ["board"],
    [
      [
        [
          [-1, -1, -1, -1, -1, -1],
          [-1, -1, -1, -1, -1, -1],
          [-1, -1, -1, -1, -1, -1],
          [-1, 35, -1, -1, 13, -1],
          [-1, -1, -1, -1, -1, -1],
          [-1, 15, -1, -1, -1, -1],
        ],
        4,
      ],
      [
        [
          [-1, -1],
          [-1, 3],
        ],
        1,
      ],
      [
        [
          [-1, -1, -1],
          [-1, 9, 8],
          [-1, 8, 9],
        ],
        1,
      ],
    ],
    (t, board) => {
      const n = board.length;
      need(n >= 2 && n <= 8 && board.every((r) => r.length === n), "board must be square, 2..8");
      const pos = (sq: number): [number, number] => {
        const r = Math.floor((sq - 1) / n);
        const c = (sq - 1) % n;
        return [n - 1 - r, r % 2 === 0 ? c : n - 1 - c];
      };
      const target = n * n;
      const label = board.map((row) => row.map(() => ""));
      for (let sq = 1; sq <= target; sq++) {
        const [r, c] = pos(sq);
        label[r][c] = board[r][c] === -1 ? String(sq) : `${sq}→${board[r][c]}`;
      }
      const dist = new Map<number, number>([[1, 0]]);
      const q = [1];
      const show = (note: string, cur?: number, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            grid(label, {
              tones: gridTones([[...dist.keys()].map(pos), "ok"], [q.map(pos), "pick"], [cur ? [pos(cur)] : [], "cur"]),
            }),
            queue("queue", q),
            map("moves to reach", dist),
          ],
          tone,
        );
      show("Squares are numbered boustrophedon (zig-zag rows from the bottom). Each roll reaches the next 1–6 squares, following any snake or ladder. Fewest moves = BFS from square 1.");
      while (q.length) {
        const s = q.shift()!;
        if (s === target) {
          show(`Reached square ${target} in ${dist.get(s)} moves.`, s, "good");
          return dist.get(s)!;
        }
        const added: string[] = [];
        for (let nx = s + 1; nx <= Math.min(s + 6, target); nx++) {
          const [r, c] = pos(nx);
          const dest = board[r][c] !== -1 ? board[r][c] : nx;
          if (!dist.has(dest)) {
            dist.set(dest, dist.get(s)! + 1);
            q.push(dest);
            added.push(dest !== nx ? `${nx}→${dest}` : String(dest));
          }
        }
        show(`From ${s} (${dist.get(s)} moves): ${added.length ? `new squares ${added.join(", ")} at ${dist.get(s)! + 1} moves.` : "nothing new."}`, s);
      }
      show(`Square ${target} can't be reached.`, undefined, "bad");
      return -1;
    },
  ),

  "minimum-genetic-mutation": sim<[string, string, string[]]>(
    ["startGene", "endGene", "bank"],
    [
      ["AACCGGTT", "AACCGGTA", ["AACCGGTA"], 1],
      ["AACCGGTT", "AAACGGTA", ["AACCGGTA", "AACCGCTA", "AAACGGTA"], 2],
      ["AAAAACCC", "AACCCCCC", ["AAAACCCC", "AAACCCCC", "AACCCCCC"], 3],
    ],
    (t, start, end, bankArr) => {
      const bank = new Set(bankArr);
      need(bank.size <= 12, "keep the bank small for the visual");
      if (!bank.has(end)) {
        t.step(`${end} isn't in the bank, so it can never be reached.`, [set("bank", bank)]);
        t.step("Return −1.", [set("bank", bank)], "bad");
        return -1;
      }
      const seen = new Set([start]);
      const q: [string, number][] = [[start, 0]];
      const show = (note: string, cur?: string, tone?: "good" | "bad") =>
        t.step(
          note,
          [
            cur ? chars(cur, { label: "current gene" }) : chars(start, { label: "start" }),
            set("bank (valid genes)", bank, [...seen]),
            queue(
              "queue (gene, steps)",
              q.map(([g, s]) => `${g}, ${s}`),
            ),
          ],
          tone,
        );
      show("Each gene is a node; a mutation (change one letter to A, C, G or T) is an edge, but only to genes in the bank. Fewest mutations = BFS.");
      while (q.length) {
        const [g, steps] = q.shift()!;
        if (g === end) {
          show(`Reached ${end} after ${steps} mutation${steps === 1 ? "" : "s"}.`, g, "good");
          return steps;
        }
        const found: string[] = [];
        for (let i = 0; i < g.length; i++)
          for (const ch of "ACGT") {
            const nx = g.slice(0, i) + ch + g.slice(i + 1);
            if (bank.has(nx) && !seen.has(nx)) {
              seen.add(nx);
              q.push([nx, steps + 1]);
              found.push(nx);
            }
          }
        show(`${g} (${steps} steps): try all ${g.length} × 4 single-letter changes. ${found.length ? `In the bank and new: ${found.join(", ")}.` : "No new bank genes."}`, g);
      }
      show("The queue emptied without reaching the end gene: −1.", undefined, "bad");
      return -1;
    },
  ),

  "word-ladder": sim<[string, string, string[]]>(
    ["beginWord", "endWord", "wordList"],
    [
      ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"], 5],
      ["hit", "cog", ["hot", "dot", "dog", "lot", "log"], 0],
    ],
    (t, begin, end, list) => {
      const words = new Set(list);
      need(words.size <= 20, "keep the word list small for the visual");
      if (!words.has(end)) {
        t.step(`${end} isn't in the word list: no ladder exists.`, [set("words", words)]);
        t.step("Return 0.", [set("words", words)], "bad");
        return 0;
      }
      words.delete(begin);
      words.delete(end);
      let front = new Set([begin]);
      let back = new Set([end]);
      let steps = 1;
      const show = (note: string, tone?: "good" | "bad") => t.step(note, [set("front", front), set("back", back), set("unused words", words), vars({ "words in ladder so far": steps })], tone);
      show("Bidirectional BFS: grow from both ends and always expand the SMALLER frontier. They meet in the middle, exploring far fewer words than one-sided BFS.");
      while (front.size && back.size) {
        if (front.size > back.size) {
          [front, back] = [back, front];
          show("Swap so we expand the smaller frontier.");
        }
        const nxt = new Set<string>();
        for (const w of front)
          for (let i = 0; i < w.length; i++)
            for (const ch of "abcdefghijklmnopqrstuvwxyz") {
              const cand = w.slice(0, i) + ch + w.slice(i + 1);
              if (back.has(cand)) {
                show(`${w} → ${cand} touches the other frontier: the ladder is complete with ${steps + 1} words.`, "good");
                return steps + 1;
              }
              if (words.has(cand)) {
                words.delete(cand);
                nxt.add(cand);
              }
            }
        front = nxt;
        steps++;
        show(nxt.size ? `Expanded one level: ${[...nxt].join(", ")}.` : "The frontier is empty: no ladder.", nxt.size ? undefined : "bad");
      }
      return 0;
    },
  ),
};
