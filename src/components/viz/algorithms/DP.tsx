"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, TextInput, useStepper } from "../kit";

type Mode = "coins" | "lcs" | "knapsack";

interface Frame {
  table: (number | null)[][];
  cur?: [number, number];
  deps: [number, number][];
  path: [number, number][];
  msg: string;
  tone?: "info" | "good";
}

const ITEMS = [
  { name: "📷", w: 1, v: 1 },
  { name: "🎧", w: 3, v: 4 },
  { name: "💻", w: 4, v: 5 },
  { name: "🎸", w: 5, v: 7 },
];
const CAP = 7;

function coinFrames(coins: number[], amount: number): { frames: Frame[]; rows: string[]; cols: string[] } {
  const dp: (number | null)[] = Array(amount + 1).fill(null);
  const fr: Frame[] = [];
  const snap = (cur: number | undefined, deps: number[], msg: string, path: number[] = [], tone?: "good") =>
    fr.push({ table: [dp.map((x) => (x === Infinity ? -1 : x))], cur: cur === undefined ? undefined : [0, cur], deps: deps.map((d) => [0, d]), path: path.map((p) => [0, p]), msg, tone });
  dp[0] = 0;
  snap(0, [], `dp[a] = fewest coins summing to a. Base case: dp[0] = 0. Coins: [${coins.join(", ")}].`);
  const from: number[] = Array(amount + 1).fill(-1);
  for (let a = 1; a <= amount; a++) {
    let best = Infinity;
    for (const c of coins) {
      if (c > a || dp[a - c] === null || dp[a - c] === Infinity) continue;
      const cand = (dp[a - c] as number) + 1;
      snap(a, [a - c], `dp[${a}]: use coin ${c} → dp[${a - c}] + 1 = ${cand}${cand < best ? (best === Infinity ? "" : ` (better than ${best})`) : ` (not better than ${best})`}.`);
      if (cand < best) {
        best = cand;
        from[a] = c;
      }
    }
    dp[a] = best;
    snap(a, [], best === Infinity ? `dp[${a}] = ∞ — unreachable.` : `dp[${a}] = ${best}.`);
  }
  const path: number[] = [];
  const used: number[] = [];
  for (let a = amount; a > 0 && from[a] > 0; a -= from[a]) {
    path.push(a);
    used.push(from[a]);
  }
  path.push(0);
  snap(undefined, [], `Answer: ${dp[amount]} coins (${used.join(" + ")}). Greedy (largest coin first) would pick ${greedy(coins, amount)} — DP explores every choice. O(amount × coins).`, path, "good");
  return { frames: fr, rows: ["dp"], cols: Array.from({ length: amount + 1 }, (_, i) => String(i)) };
}

function greedy(coins: number[], amount: number) {
  const cs = [...coins].sort((a, b) => b - a);
  const used: number[] = [];
  let a = amount;
  for (const c of cs)
    while (a >= c) {
      a -= c;
      used.push(c);
    }
  return a === 0 ? `${used.length} coins (${used.join(" + ")})` : "nothing valid";
}

function lcsFrames(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp: (number | null)[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)));
  const fr: Frame[] = [{ table: dp.map((r) => [...r]), deps: [], path: [], msg: `dp[i][j] = LCS length of "${a}"[0..i) and "${b}"[0..j). Row 0 and column 0 are 0 (empty prefix).` }];
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = (dp[i - 1][j - 1] as number) + 1;
        fr.push({ table: dp.map((r) => [...r]), cur: [i, j], deps: [[i - 1, j - 1]], path: [], msg: `'${a[i - 1]}' == '${b[j - 1]}' → diagonal + 1 = ${dp[i][j]}.` });
      } else {
        dp[i][j] = Math.max(dp[i - 1][j] as number, dp[i][j - 1] as number);
        fr.push({ table: dp.map((r) => [...r]), cur: [i, j], deps: [[i - 1, j], [i, j - 1]], path: [], msg: `'${a[i - 1]}' ≠ '${b[j - 1]}' → max(top ${dp[i - 1][j]}, left ${dp[i][j - 1]}) = ${dp[i][j]}.` });
      }
    }
  const path: [number, number][] = [];
  let i = m;
  let j = n;
  let s = "";
  while (i > 0 && j > 0) {
    path.push([i, j]);
    if (a[i - 1] === b[j - 1]) {
      s = a[i - 1] + s;
      i--;
      j--;
    } else if ((dp[i - 1][j] as number) >= (dp[i][j - 1] as number)) i--;
    else j--;
  }
  fr.push({ table: dp.map((r) => [...r]), deps: [], path, msg: `LCS length ${dp[m][n]}: "${s}". Trace back from the corner: diagonal moves are matched letters. O(m·n) time and space (O(min) space if you only need the length).`, tone: "good" });
  return { frames: fr, rows: ["∅", ...a.split("")], cols: ["∅", ...b.split("")] };
}

function knapFrames() {
  const n = ITEMS.length;
  const dp: (number | null)[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: CAP + 1 }, () => (i === 0 ? 0 : null)));
  const fr: Frame[] = [{ table: dp.map((r) => [...r]), deps: [], path: [], msg: `dp[i][w] = best value using the first i items with capacity w. Each item: skip it, or take it once (0/1).` }];
  for (let i = 1; i <= n; i++) {
    const { w: wi, v: vi, name } = ITEMS[i - 1];
    for (let w = 0; w <= CAP; w++) {
      const skip = dp[i - 1][w] as number;
      if (wi > w) {
        dp[i][w] = skip;
        fr.push({ table: dp.map((r) => [...r]), cur: [i, w], deps: [[i - 1, w]], path: [], msg: `${name} (w${wi}) doesn't fit in ${w} → copy from above: ${skip}.` });
      } else {
        const take = (dp[i - 1][w - wi] as number) + vi;
        dp[i][w] = Math.max(skip, take);
        fr.push({ table: dp.map((r) => [...r]), cur: [i, w], deps: [[i - 1, w], [i - 1, w - wi]], path: [], msg: `${name}: skip = ${skip}, take = dp[${i - 1}][${w - wi}] + ${vi} = ${take} → ${dp[i][w]}.` });
      }
    }
  }
  const path: [number, number][] = [];
  const chosen: string[] = [];
  let w = CAP;
  for (let i = n; i > 0; i--) {
    path.push([i, w]);
    if (dp[i][w] !== dp[i - 1][w]) {
      chosen.unshift(ITEMS[i - 1].name);
      w -= ITEMS[i - 1].w;
    }
  }
  fr.push({ table: dp.map((r) => [...r]), deps: [], path, msg: `Best value ${dp[n][CAP]} with ${chosen.join(" + ")}. Where the value changed vs the row above, the item was taken. O(n·W) — pseudo-polynomial.`, tone: "good" });
  return { frames: fr, rows: ["∅", ...ITEMS.map((it) => `${it.name} w${it.w} $${it.v}`)], cols: Array.from({ length: CAP + 1 }, (_, i) => String(i)) };
}

export default function DP() {
  const [mode, setMode] = useState<Mode>("coins");
  const [a, setA] = useState("ABCBDAB");
  const [b, setB] = useState("BDCAB");
  const { frames, rows, cols } = useMemo(() => {
    if (mode === "coins") return coinFrames([1, 3, 4], 10);
    if (mode === "lcs") return lcsFrames(a.toUpperCase().slice(0, 9) || "A", b.toUpperCase().slice(0, 9) || "B");
    return knapFrames();
  }, [mode, a, b]);
  const s = useStepper(frames, 420);
  const f = s.frame;
  const key = (r: number, c: number) => `${r},${c}`;
  const deps = new Set(f.deps.map(([r, c]) => key(r, c)));
  const path = new Set(f.path.map(([r, c]) => key(r, c)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "coins", label: "Coin change (1-D)" },
            { value: "lcs", label: "Longest common subsequence" },
            { value: "knapsack", label: "0/1 knapsack" },
          ]}
        />
        {mode === "lcs" && (
          <>
            <TextInput value={a} onChange={setA} width="w-24" />
            <TextInput value={b} onChange={setB} width="w-24" />
          </>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] p-3 scrollbar-thin">
        <table className="border-separate border-spacing-1 font-mono text-xs">
          <thead>
            <tr>
              <th />
              {cols.map((c, j) => (
                <th key={j} className="px-1 pb-1 text-center font-normal text-faint">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f.table.map((row, r) => (
              <tr key={r}>
                <th className="pr-2 text-right font-normal whitespace-nowrap text-faint">{rows[r]}</th>
                {row.map((v, c) => {
                  const isCur = f.cur?.[0] === r && f.cur?.[1] === c;
                  const isDep = deps.has(key(r, c));
                  const onPath = path.has(key(r, c));
                  const color = isCur ? C.active : isDep ? C.compare : onPath ? C.done : null;
                  return (
                    <td
                      key={c}
                      className="h-9 min-w-9 rounded-md border text-center transition-all duration-200"
                      style={{
                        borderColor: color ?? (v === null ? C.dim : C.base),
                        background: color ? `${color}2a` : v === null ? "transparent" : C.baseFill,
                        color: color ?? (v === null ? C.faint : C.text),
                        boxShadow: isCur ? `0 0 12px ${C.active}` : undefined,
                      }}
                    >
                      {v === null ? "" : v === -1 ? "∞" : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Narration tone={f.tone}>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
