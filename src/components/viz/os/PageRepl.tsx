"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, SmallBtn, StepControls, TextInput, parseNums, useStepper } from "../kit";

// Page replacement, the textbook table: one column per memory reference, one row per frame.
type Algo = "fifo" | "lru" | "opt" | "clock";
interface Col {
  page: number;
  mem: (number | null)[];
  refBits: number[];
  hand: number;
  fault: boolean;
  slot: number; // where the page is (hit) or was put (fault)
  victim: number | null;
  note: string;
}

const ALGOS: { value: Algo; label: string }[] = [
  { value: "fifo", label: "FIFO" },
  { value: "lru", label: "LRU" },
  { value: "opt", label: "OPT" },
  { value: "clock", label: "Clock" },
];
const CLASSIC = "7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1";
const BELADY = "1 2 3 4 1 2 5 1 2 3 4 5";
const LOOP = "0 1 2 3 4 0 1 2 3 4 0 1 2 3 4";

function run(refs: number[], n: number, algo: Algo): Col[] {
  const mem: (number | null)[] = Array(n).fill(null);
  const loadedAt: number[] = Array(n).fill(-1);
  const usedAt: number[] = Array(n).fill(-1);
  const ref: number[] = Array(n).fill(0);
  let hand = 0;
  const cols: Col[] = [];
  refs.forEach((page, t) => {
    const at = mem.indexOf(page);
    if (at >= 0) {
      usedAt[at] = t;
      ref[at] = 1;
      cols.push({ page, mem: [...mem], refBits: [...ref], hand, fault: false, slot: at, victim: null, note: `Page ${page} is already in frame ${at}: a HIT. ${algo === "lru" ? "It becomes the most recently used." : algo === "clock" ? "Its reference bit is set to 1." : "Nothing changes."}` });
      return;
    }
    const empty = mem.indexOf(null);
    let slot: number;
    let victim: number | null = null;
    let why = "";
    if (empty >= 0) {
      slot = empty;
      why = `There's a free frame (${slot}), so no eviction is needed.`;
    } else if (algo === "fifo") {
      slot = loadedAt.indexOf(Math.min(...loadedAt));
      victim = mem[slot];
      why = `FIFO evicts page ${victim}, the one loaded earliest (at step ${loadedAt[slot] + 1}).`;
    } else if (algo === "lru") {
      slot = usedAt.indexOf(Math.min(...usedAt));
      victim = mem[slot];
      why = `LRU evicts page ${victim}: it was last used at step ${usedAt[slot] + 1}, longer ago than the others.`;
    } else if (algo === "opt") {
      const rest = refs.slice(t + 1);
      const next = mem.map((p) => (rest.indexOf(p!) < 0 ? Infinity : rest.indexOf(p!)));
      slot = next.indexOf(Math.max(...next));
      victim = mem[slot];
      why = next[slot] === Infinity ? `OPT evicts page ${victim}: it's never used again.` : `OPT looks into the future: page ${victim} isn't needed for ${next[slot] + 1} more steps, the longest wait.`;
    } else {
      const skipped: number[] = [];
      while (ref[hand % n]) {
        ref[hand % n] = 0;
        skipped.push(mem[hand % n]!);
        hand++;
      }
      slot = hand % n;
      hand++;
      victim = mem[slot];
      why = `${skipped.length ? `The clock hand gives page${skipped.length > 1 ? "s" : ""} ${skipped.join(", ")} a second chance (clearing the bit), then ` : "The clock hand "}evicts page ${victim}, whose reference bit is 0.`;
    }
    mem[slot] = page;
    loadedAt[slot] = t;
    usedAt[slot] = t;
    ref[slot] = 1;
    cols.push({ page, mem: [...mem], refBits: [...ref], hand: hand % n, fault: true, slot, victim, note: `Page ${page} isn't in memory: PAGE FAULT. ${why}` });
  });
  return cols;
}

export default function PageRepl() {
  const [algo, setAlgo] = useState<Algo>("lru");
  const [n, setN] = useState(3);
  const [text, setText] = useState(CLASSIC);
  const refs = useMemo(() => parseNums(text, 30) ?? parseNums(CLASSIC, 30)!, [text]);
  const cols = useMemo(() => run(refs, n, algo), [refs, n, algo]);
  const frames = useMemo(() => [null, ...cols.map((_, i) => i)], [cols]);
  const s = useStepper(frames, 700);
  const upto = s.frame === null ? -1 : s.frame;
  const faults = cols.slice(0, upto + 1).filter((c) => c.fault).length;
  const totals = useMemo(() => ALGOS.map((a) => ({ ...a, f: run(refs, n, a.value).filter((c) => c.fault).length })), [refs, n]);
  const fewer = useMemo(() => (n > 1 ? run(refs, n - 1, algo).filter((c) => c.fault).length : null), [refs, n, algo]);
  const cur = upto >= 0 ? cols[upto] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented value={algo} onChange={setAlgo} options={ALGOS} />
        <div className="w-44">
          <Slider label="frames of RAM" value={n} min={1} max={6} onChange={setN} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={text} onChange={setText} width="w-72" placeholder="page numbers, e.g. 1 2 3 1" />
        <SmallBtn onClick={() => setText(CLASSIC)}>Classic</SmallBtn>
        <SmallBtn onClick={() => setText(BELADY)}>Belady&apos;s anomaly</SmallBtn>
        <SmallBtn onClick={() => setText(LOOP)}>Loop of 5</SmallBtn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line p-2">
        <table className="border-separate border-spacing-0.5 font-mono text-xs">
          <tbody>
            <tr>
              <td className="pr-2 text-[10px] text-faint">ref</td>
              {cols.map((c, i) => (
                <td key={i} className="h-7 w-7 min-w-7 text-center font-bold" style={{ color: i === upto ? C.text : i < upto ? C.muted : C.faint, textDecoration: i === upto ? "underline" : undefined }}>
                  {c.page}
                </td>
              ))}
            </tr>
            {Array.from({ length: n }, (_, r) => (
              <tr key={r}>
                <td className="pr-2 text-[10px] text-faint">
                  F{r}
                  {algo === "clock" && cur && cur.hand === r ? " ◀" : ""}
                </td>
                {cols.map((c, i) => {
                  const shown = i <= upto;
                  const v = c.mem[r];
                  const isNew = c.fault && c.slot === r;
                  return (
                    <td
                      key={i}
                      className="h-7 w-7 min-w-7 rounded text-center"
                      style={{
                        background: !shown ? "transparent" : isNew ? `${C.bad}22` : c.slot === r ? `${C.done}22` : v === null ? "transparent" : "#f1f5f9",
                        color: isNew ? C.bad : c.slot === r ? C.done : C.text,
                        fontWeight: c.slot === r ? 700 : 400,
                        outline: i === upto ? `1px solid ${C.base}` : undefined,
                      }}
                    >
                      {shown && v !== null ? (
                        <>
                          {v}
                          {algo === "clock" && <sup className="text-[8px] text-faint">{c.refBits[r]}</sup>}
                        </>
                      ) : (
                        ""
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="pr-2 text-[10px] text-faint">fault</td>
              {cols.map((c, i) => (
                <td key={i} className="text-center font-bold" style={{ color: C.bad }}>
                  {i <= upto && c.fault ? "F" : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Narration tone={!cur ? "info" : cur.fault ? "warn" : "good"}>
        {cur
          ? `Step ${upto + 1}: ${cur.note}`
          : `${refs.length} memory references and ${n} frame${n > 1 ? "s" : ""} of RAM. Red = page fault (load from disk), green = hit. Press play.`}
      </Narration>
      <StepControls s={s} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {totals.map((t) => (
          <div key={t.value} className="rounded-xl border px-3 py-2" style={{ borderColor: t.value === algo ? C.active : C.dim }}>
            <div className="text-[10px] tracking-wider text-faint uppercase">{t.label}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: t.f === Math.min(...totals.map((x) => x.f)) ? C.done : C.text }}>
              {t.value === algo ? `${faults} / ${t.f}` : t.f} <span className="text-xs text-faint">faults</span>
            </div>
          </div>
        ))}
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: fewer !== null && fewer < totals.find((t) => t.value === algo)!.f ? C.bad : C.dim }}>
          <div className="text-[10px] tracking-wider text-faint uppercase">{ALGOS.find((a) => a.value === algo)!.label} with {n - 1} frame{n - 1 === 1 ? "" : "s"}</div>
          <div className="font-mono text-lg font-semibold">
            {fewer ?? "–"} <span className="text-xs text-faint">{fewer !== null && fewer < totals.find((t) => t.value === algo)!.f ? "fewer! (Belady)" : "faults"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
