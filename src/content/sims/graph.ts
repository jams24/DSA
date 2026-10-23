import { fmt, grid, gridTones, map, need, out, queue, sim, vars } from "@/lib/sim/build";
import type { GraphPanel, Sim, Tone } from "@/lib/sim/types";

const isRect = (m: unknown[][]) => m.length > 0 && m.every((r) => Array.isArray(r) && r.length === m[0].length && r.length > 0);
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function topo(t: Parameters<Sim["run"]>[0], n: number, pre: number[][], want: "bool" | "order") {
  need(Number.isInteger(n) && n >= 1 && n <= 12, "numCourses must be 1..12 for the visual");
  need(
    pre.every((p) => p.length === 2 && p.every((x) => x >= 0 && x < n)),
    "each prerequisite is [course, pre] with valid course numbers",
  );
  const g: number[][] = Array.from({ length: n }, () => []);
  const indeg = Array(n).fill(0);
  for (const [c, p] of pre) {
    g[p].push(c);
    indeg[c]++;
  }
  const done: number[] = [];
  const q: number[] = [];
  for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
  const panel = (cur?: number): GraphPanel => ({
    kind: "graph",
    directed: true,
    nodes: Array.from({ length: n }, (_, i) => ({
      id: String(i),
      tone: (i === cur ? "cur" : done.includes(i) ? "ok" : q.includes(i) ? "pick" : undefined) as Tone | undefined,
      tag: `in ${indeg[i]}`,
    })),
    edges: pre.map(([c, p]) => ({
      a: String(p),
      b: String(c),
      tone: done.includes(p) ? ("dim" as Tone) : undefined,
    })),
  });
  const show = (note: string, cur?: number, tone?: "good" | "bad") => t.step(note, [panel(cur), queue("ready (in-degree 0)", q), out(want === "order" ? "order" : "taken", done)], tone);
  show(`Kahn's algorithm. An arrow pre → course means "take pre first". in-degree = number of unmet prerequisites. Start with every course that has none: ${q.length ? q.join(", ") : "none"}.`);
  while (q.length) {
    const c = q.shift()!;
    done.push(c);
    const freed: number[] = [];
    for (const nx of g[c])
      if (--indeg[nx] === 0) {
        q.push(nx);
        freed.push(nx);
      }
    show(
      `Take course ${c}. ${g[c].length ? `Its dependents ${g[c].join(", ")} each lose one prerequisite${freed.length ? `; ${freed.join(", ")} become${freed.length === 1 ? "s" : ""} ready` : ""}.` : "Nothing depends on it."}`,
      c,
    );
  }
  const ok = done.length === n;
  show(
    ok ? `All ${n} courses taken${want === "order" ? `: order ${fmt(done)}` : ""}.` : `Only ${done.length} of ${n} courses could be taken: the rest are stuck in a cycle.`,
    undefined,
    ok ? "good" : "bad",
  );
  return want === "bool" ? ok : ok ? done : [];
}

export const SIMS: Record<string, Sim> = {
  "number-of-islands": sim<[string[][]]>(
    ["grid"],
    [
      [
        [
          ["1", "1", "1", "1", "0"],
          ["1", "1", "0", "1", "0"],
          ["1", "1", "0", "0", "0"],
          ["0", "0", "0", "0", "0"],
        ],
        1,
      ],
      [
        [
          ["1", "1", "0", "0", "0"],
          ["1", "1", "0", "0", "0"],
          ["0", "0", "1", "0", "0"],
          ["0", "0", "0", "1", "1"],
        ],
        3,
      ],
    ],
    (t, g) => {
      need(isRect(g), 'grid must be a rectangle of "1" and "0"');
      const R = g.length;
      const C = g[0].length;
      const label: string[][] = g.map((row) => row.map((v) => (v === "1" ? "1" : "·")));
      let count = 0;
      const cur: [number, number][] = [];
      const sunk: [number, number][] = [];
      const show = (note: string, at?: [number, number], tone?: "good") =>
        t.step(
          note,
          [
            grid(label, {
              tones: gridTones(
                [
                  g
                    .flatMap((row, r) => row.map((v, c) => [r, c, v] as const))
                    .filter(([, , v]) => v !== "1" && v !== "#")
                    .map(([r, c]) => [r, c] as [number, number]),
                  "dim",
                ],
                [sunk, "ok"],
                [cur, "pick"],
                [at ? [at] : [], "cur"],
              ),
            }),
            vars({ islands: count }),
          ],
          tone,
        );
      show("Scan every cell. Each time you hit unvisited land, that's a new island: flood-fill all land connected to it (marking it visited) so it's never counted again.");
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (g[r][c] !== "1") continue;
          count++;
          g[r][c] = "#";
          label[r][c] = `#${count}`;
          cur.length = 0;
          cur.push([r, c]);
          show(`Unvisited land at (${r},${c}): island #${count}. Flood-fill from here.`, [r, c]);
          const st: [number, number][] = [[r, c]];
          while (st.length) {
            const [i, j] = st.pop()!;
            for (const [di, dj] of DIRS) {
              const a = i + di;
              const b = j + dj;
              if (a >= 0 && a < R && b >= 0 && b < C && g[a][b] === "1") {
                g[a][b] = "#";
                label[a][b] = `#${count}`;
                cur.push([a, b]);
                st.push([a, b]);
                show(`(${a},${b}) is connected land: part of island #${count}.`, [a, b]);
              }
            }
          }
          sunk.push(...cur);
          cur.length = 0;
        }
      show(`${count} island${count === 1 ? "" : "s"}. Every cell was visited at most twice: O(rows × cols).`, undefined, "good");
      return count;
    },
  ),

  "surrounded-regions": sim<[string[][]]>(
    ["board"],
    [
      [
        [
          ["X", "X", "X", "X"],
          ["X", "O", "O", "X"],
          ["X", "X", "O", "X"],
          ["X", "O", "X", "X"],
        ],
        [
          ["X", "X", "X", "X"],
          ["X", "X", "X", "X"],
          ["X", "X", "X", "X"],
          ["X", "O", "X", "X"],
        ],
      ],
      [
        [
          ["O", "O", "X"],
          ["X", "O", "X"],
          ["X", "X", "O"],
        ],
        [
          ["O", "O", "X"],
          ["X", "O", "X"],
          ["X", "X", "O"],
        ],
      ],
      [
        [
          ["X", "X", "X"],
          ["X", "O", "X"],
          ["X", "X", "X"],
        ],
        [
          ["X", "X", "X"],
          ["X", "X", "X"],
          ["X", "X", "X"],
        ],
      ],
    ],
    (t, b) => {
      need(isRect(b), 'board must be a rectangle of "X" and "O"');
      const R = b.length;
      const C = b[0].length;
      const safe = () =>
        b
          .flatMap((row, r) => row.map((v, c) => [r, c, v] as const))
          .filter(([, , v]) => v === "S")
          .map(([r, c]) => [r, c] as [number, number]);
      const show = (note: string, at?: [number, number], tone?: "good") =>
        t.step(
          note,
          [
            grid(b, {
              tones: gridTones([safe(), "ok"], [at ? [at] : [], "cur"]),
            }),
          ],
          tone,
        );
      show("Flip the question: an 'O' survives only if it connects to the border. Flood-fill from every border 'O' and mark those safe (S). Every other 'O' is surrounded.");
      const st: [number, number][] = [];
      for (let r = 0; r < R; r++) st.push([r, 0], [r, C - 1]);
      for (let c = 0; c < C; c++) st.push([0, c], [R - 1, c]);
      while (st.length) {
        const [r, c] = st.pop()!;
        if (r < 0 || r >= R || c < 0 || c >= C || b[r][c] !== "O") continue;
        b[r][c] = "S";
        show(`(${r},${c}) is an 'O' reachable from the border: mark it safe.`, [r, c]);
        for (const [dr, dc] of DIRS) st.push([r + dr, c + dc]);
      }
      const flipped: [number, number][] = [];
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (b[r][c] === "O") flipped.push([r, c]);
          b[r][c] = b[r][c] === "S" ? "O" : "X";
        }
      t.step(
        `Final pass: safe cells go back to 'O', everything else becomes 'X'. ${flipped.length} surrounded cell${flipped.length === 1 ? " was" : "s were"} captured.`,
        [grid(b, { tones: gridTones([flipped, "bad"]) })],
        "good",
      );
      return b;
    },
  ),

  "clone-graph": sim<[number[][]]>(
    ["adjList"],
    [
      [
        [
          [2, 4],
          [1, 3],
          [2, 4],
          [1, 3],
        ],
        [
          [2, 4],
          [1, 3],
          [2, 4],
          [1, 3],
        ],
      ],
      [
        [[2], [1, 3], [2]],
        [[2], [1, 3], [2]],
      ],
      [[[]], [[]]],
    ],
    (t, adj) => {
      const n = adj.length;
      need(n >= 1 && n <= 12 && adj.every((nb) => nb.every((v) => v >= 1 && v <= n)), "adjList is 1-indexed neighbour lists");
      const clones = new Map<number, number[]>();
      const q: number[] = [1];
      clones.set(1, []);
      const edges = adj.flatMap((nb, i) => nb.filter((v) => v > i + 1).map((v) => ({ a: String(i + 1), b: String(v) })));
      const show = (note: string, cur?: number, tone?: "good") =>
        t.step(
          note,
          [
            {
              kind: "graph",
              label: "original",
              nodes: adj.map((_, i) => ({
                id: String(i + 1),
                tone: (i + 1 === cur ? "cur" : clones.has(i + 1) ? "ok" : undefined) as Tone | undefined,
              })),
              edges,
            },
            map("old → clone's neighbours", new Map([...clones].map(([k, v]) => [k, fmt(v)]))),
            queue("queue", q),
          ],
          tone,
        );
      show("BFS. A hash map from each original node to its clone doubles as the visited set: create a clone the first time you see a node, then copy each edge.");
      while (q.length) {
        const cur = q.shift()!;
        const fresh: number[] = [];
        for (const nb of adj[cur - 1]) {
          if (!clones.has(nb)) {
            clones.set(nb, []);
            q.push(nb);
            fresh.push(nb);
          }
          clones.get(cur)!.push(nb);
        }
        show(`Visit ${cur}: link its clone to clones of ${adj[cur - 1].join(", ") || "nothing"}.${fresh.length ? ` First time seeing ${fresh.join(", ")}: clone and enqueue.` : ""}`, cur);
      }
      show("Every node and edge copied.", undefined, "good");
      return adj.map((_, i) => clones.get(i + 1) ?? []);
    },
  ),

  "evaluate-division": sim<[string[][], number[], string[][]]>(
    ["equations", "values", "queries"],
    [
      [
        [
          ["a", "b"],
          ["b", "c"],
        ],
        [2, 3],
        [
          ["a", "c"],
          ["b", "a"],
          ["a", "e"],
          ["a", "a"],
          ["x", "x"],
        ],
        [6, 0.5, -1, 1, -1],
      ],
      [
        [
          ["a", "b"],
          ["b", "c"],
          ["bc", "cd"],
        ],
        [1.5, 2.5, 5],
        [
          ["a", "c"],
          ["c", "b"],
          ["bc", "cd"],
          ["cd", "bc"],
        ],
        [3.75, 0.4, 5, 0.2],
      ],
    ],
    (t, eqs, values, queries) => {
      need(eqs.length === values.length && eqs.length <= 10, "one value per equation");
      const g = new Map<string, Map<string, number>>();
      eqs.forEach(([a, b], i) => {
        if (!g.has(a)) g.set(a, new Map());
        if (!g.has(b)) g.set(b, new Map());
        g.get(a)!.set(b, values[i]);
        g.get(b)!.set(a, 1 / values[i]);
      });
      const res: number[] = [];
      const panel = (seen: Set<string>, cur?: string): GraphPanel => ({
        kind: "graph",
        directed: true,
        nodes: [...g.keys()].map((id) => ({
          id,
          tone: (id === cur ? "cur" : seen.has(id) ? "ok" : undefined) as Tone | undefined,
        })),
        edges: eqs.map(([a, b], i) => ({ a, b, label: `×${fmt(values[i])}` })),
      });
      t.step("Turn each equation a / b = v into a weighted edge a → b (×v) and b → a (×1/v). Then a / c is the product of the weights along any path from a to c: BFS.", [
        panel(new Set()),
        out("answers", res),
      ]);
      for (const [src, dst] of queries) {
        if (!g.has(src) || !g.has(dst)) {
          res.push(-1);
          t.step(`${src} / ${dst}: ${!g.has(src) ? src : dst} never appears in an equation → −1.`, [panel(new Set()), out("answers", res, [res.length - 1])]);
          continue;
        }
        const seen = new Set([src]);
        const q: [string, number][] = [[src, 1]];
        let ans = -1;
        while (q.length) {
          const [node, acc] = q.shift()!;
          t.step(`${src} / ${dst}: at ${node} with running product ${fmt(acc)}.`, [
            panel(seen, node),
            queue(
              "queue (node, product)",
              q.map(([a, v]) => `${a}, ${fmt(v)}`),
            ),
            out("answers", res),
          ]);
          if (node === dst) {
            ans = acc;
            break;
          }
          for (const [nb, w] of g.get(node)!)
            if (!seen.has(nb)) {
              seen.add(nb);
              q.push([nb, acc * w]);
            }
        }
        res.push(ans);
        t.step(ans === -1 ? `${dst} is not reachable from ${src} → −1.` : `${src} / ${dst} = ${fmt(ans)}.`, [panel(seen), out("answers", res, [res.length - 1])]);
      }
      t.step(`Answers: ${fmt(res)}.`, [panel(new Set()), out("answers", res)], "good");
      return res.map((x) => Number(x.toFixed(10)));
    },
  ),

  "course-schedule": sim<[number, number[][]]>(
    ["numCourses", "prerequisites"],
    [
      [2, [[1, 0]], true],
      [
        2,
        [
          [1, 0],
          [0, 1],
        ],
        false,
      ],
      [
        4,
        [
          [1, 0],
          [2, 0],
          [3, 1],
          [3, 2],
        ],
        true,
      ],
    ],
    (t, n, pre) => topo(t, n, pre, "bool"),
  ),

  "course-schedule-ii": sim<[number, number[][]]>(
    ["numCourses", "prerequisites"],
    [
      [2, [[1, 0]], [0, 1]],
      [
        4,
        [
          [1, 0],
          [2, 0],
          [3, 1],
          [3, 2],
        ],
        [0, 1, 2, 3],
      ],
      [
        3,
        [
          [0, 1],
          [1, 2],
          [2, 0],
        ],
        [],
      ],
    ],
    (t, n, pre) => topo(t, n, pre, "order"),
  ),
};
