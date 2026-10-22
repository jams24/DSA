"use client";

import { useMemo, useState } from "react";
import { C, Narration, Slider, Stat, StepControls, useStepper } from "../kit";

interface Frame {
  queens: number[]; // queens[row] = col
  try?: [number, number];
  conflict?: [number, number][];
  msg: string;
  tone?: "info" | "good" | "bad";
  placed: number;
  backtracks: number;
}

function solve(n: number) {
  const fr: Frame[] = [];
  const q: number[] = [];
  const cols = new Set<number>();
  const d1 = new Set<number>();
  const d2 = new Set<number>();
  let placed = 0;
  let backtracks = 0;
  let solutions = 0;
  let first: number[] | null = null;
  const LIMIT = 900;

  fr.push({ queens: [], msg: `Place ${n} queens so none attack each other. Go row by row; in each row try every column.`, placed, backtracks });
  const conflicts = (r: number, c: number) => q.map((qc, qr) => [qr, qc] as [number, number]).filter(([qr, qc]) => qc === c || qr - qc === r - c || qr + qc === r + c);

  const bt = (r: number): void => {
    if (r === n) {
      solutions++;
      if (!first) {
        first = [...q];
        fr.push({ queens: [...q], msg: `Solution found! Every row has a queen and nobody attacks anybody.`, tone: "good", placed, backtracks });
      }
      return;
    }
    for (let c = 0; c < n; c++) {
      const bad = cols.has(c) || d1.has(r - c) || d2.has(r + c);
      if (fr.length < LIMIT && !first) {
        fr.push(
          bad
            ? { queens: [...q], try: [r, c], conflict: conflicts(r, c), msg: `Row ${r}, col ${c}: attacked (same column or diagonal). Prune — skip it.`, tone: "bad", placed, backtracks }
            : { queens: [...q], try: [r, c], msg: `Row ${r}, col ${c} is safe. Place a queen and recurse into row ${r + 1}.`, placed, backtracks },
        );
      }
      if (bad) continue;
      q.push(c);
      cols.add(c);
      d1.add(r - c);
      d2.add(r + c);
      placed++;
      bt(r + 1);
      q.pop();
      cols.delete(c);
      d1.delete(r - c);
      d2.delete(r + c);
      if (!first && fr.length < LIMIT) {
        backtracks++;
        fr.push({ queens: [...q], msg: `Dead end below row ${r}. BACKTRACK: remove the queen at (${r}, ${c}) and try the next column.`, tone: "bad", placed, backtracks });
      }
    }
  };
  bt(0);
  fr.push({
    queens: first ?? [],
    msg: `${n}×${n} board has ${solutions} solution(s). Sets for columns and both diagonals (r−c, r+c) make each safety check O(1). Pruning keeps us far below n^n.`,
    tone: "good",
    placed,
    backtracks,
  });
  return { frames: fr, solutions };
}

export default function NQueens() {
  const [n, setN] = useState(5);
  const { frames, solutions } = useMemo(() => solve(n), [n]);
  const s = useStepper(frames, 380);
  const f = s.frame;
  const conflict = new Set((f.conflict ?? []).map(([r, c]) => `${r},${c}`));

  return (
    <div className="space-y-4">
      <div className="w-56">
        <Slider label="board size n" value={n} min={4} max={8} onChange={setN} />
      </div>
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="mx-auto grid w-[min(100%,360px)] gap-0.5 rounded-xl border border-line bg-[#080c19] p-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {Array.from({ length: n * n }, (_, k) => {
            const r = Math.floor(k / n);
            const c = k % n;
            const hasQ = f.queens[r] === c;
            const isTry = f.try?.[0] === r && f.try?.[1] === c;
            const isConflict = conflict.has(`${r},${c}`);
            const dark = (r + c) % 2 === 1;
            return (
              <div
                key={k}
                className="grid aspect-square place-items-center rounded-[4px] text-xl transition-colors duration-150 sm:text-2xl"
                style={{
                  background: isTry ? (f.tone === "bad" ? `${C.bad}55` : `${C.active}44`) : isConflict ? `${C.bad}33` : dark ? "#18213f" : "#111830",
                  boxShadow: isTry ? `inset 0 0 0 2px ${f.tone === "bad" ? C.bad : C.active}` : isConflict ? `inset 0 0 0 2px ${C.bad}` : undefined,
                }}
              >
                {hasQ ? "♛" : isTry && f.tone !== "bad" ? <span className="opacity-50">♛</span> : ""}
              </div>
            );
          })}
        </div>
        <div className="space-y-3">
          <Narration tone={f.tone}>{f.msg}</Narration>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="queens placed" value={f.placed} color={C.active} />
            <Stat label="backtracks" value={f.backtracks} color={C.bad} />
            <Stat label="total solutions" value={solutions} color={C.done} />
          </div>
          <div className="rounded-xl border border-line bg-panel p-3 font-mono text-xs leading-relaxed text-dim">
            <div className="text-faint"># the backtracking template</div>
            <div>def backtrack(state):</div>
            <div>&nbsp;&nbsp;if complete(state): record(); return</div>
            <div>&nbsp;&nbsp;for choice in choices(state):</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;if not valid(choice): continue&nbsp;&nbsp;<span className="text-rose"># prune</span></div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;make(choice)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;backtrack(state)</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;undo(choice)&nbsp;&nbsp;<span className="text-amber"># backtrack</span></div>
          </div>
        </div>
      </div>
      <StepControls s={s} />
    </div>
  );
}
