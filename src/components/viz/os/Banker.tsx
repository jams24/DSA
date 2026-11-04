"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, SmallBtn, StepControls, useStepper } from "../kit";

// The Banker's algorithm on the classic textbook state: ask for resources, then watch the safety
// check pretend to run processes one by one to decide whether the request keeps the system safe.
type Vec = [number, number, number];
const RES = ["A", "B", "C"];
const MAX: Vec[] = [
  [7, 5, 3],
  [3, 2, 2],
  [9, 0, 2],
  [2, 2, 2],
  [4, 3, 3],
];
const START_ALLOC: Vec[] = [
  [0, 1, 0],
  [2, 0, 0],
  [3, 0, 2],
  [2, 1, 1],
  [0, 0, 2],
];
const START_AVAIL: Vec = [3, 3, 2];
const PRESETS: { p: number; req: Vec }[] = [
  { p: 1, req: [1, 0, 2] },
  { p: 4, req: [3, 3, 0] },
  { p: 0, req: [0, 2, 0] },
];

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const le = (a: Vec, b: Vec) => a.every((x, i) => x <= b[i]);
const fmt = (v: Vec) => `(${v.join(", ")})`;

interface Frame {
  work: Vec;
  finished: number[];
  look: number | null;
  fits: boolean | null;
  note: string;
  tone: "info" | "good" | "bad" | "warn";
}

function safety(avail: Vec, alloc: Vec[], intro: string): { frames: Frame[]; safe: boolean; order: number[] } {
  const need = alloc.map((a, i) => sub(MAX[i], a));
  let work: Vec = [...avail];
  const finished: number[] = [];
  const frames: Frame[] = [{ work, finished: [], look: null, fits: null, note: `${intro} Safety check: start with work = available = ${fmt(work)}. Find a process whose remaining need fits.`, tone: "info" }];
  let progress = true;
  while (progress) {
    progress = false;
    for (let p = 0; p < alloc.length; p++) {
      if (finished.includes(p)) continue;
      if (le(need[p], work)) {
        const before = work;
        work = add(work, alloc[p]);
        finished.push(p);
        progress = true;
        frames.push({
          work,
          finished: [...finished],
          look: p,
          fits: true,
          note: `P${p} needs ${fmt(need[p])} ≤ work ${fmt(before)}: it could finish. When it does, it returns its ${fmt(alloc[p])}, so work = ${fmt(work)}.`,
          tone: "good",
        });
      } else {
        frames.push({ work, finished: [...finished], look: p, fits: false, note: `P${p} needs ${fmt(need[p])}, more than work ${fmt(work)}. Not yet: skip it for now.`, tone: "info" });
      }
    }
  }
  const safe = finished.length === alloc.length;
  frames.push({
    work,
    finished: [...finished],
    look: null,
    fits: null,
    note: safe
      ? `SAFE ✅ Everyone can finish in the order ${finished.map((p) => `P${p}`).join(" → ")}. That's a safe sequence.`
      : `UNSAFE ❌ Stuck with work = ${fmt(work)}: nobody left can be sure to finish (${[0, 1, 2, 3, 4]
          .filter((p) => !finished.includes(p))
          .map((p) => `P${p}`)
          .join(", ")}). Not a deadlock yet, but one could happen.`,
    tone: safe ? "good" : "bad",
  });
  return { frames, safe, order: finished };
}

interface Outcome {
  alloc: Vec[];
  avail: Vec;
  frames: Frame[];
  verdict: string;
  tone: "info" | "good" | "bad" | "warn";
}

export default function Banker() {
  const [alloc, setAlloc] = useState<Vec[]>(START_ALLOC);
  const [avail, setAvail] = useState<Vec>(START_AVAIL);
  const [who, setWho] = useState("1");
  const [req, setReq] = useState<Vec>([1, 0, 2]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const initial = useMemo(() => safety(START_AVAIL, START_ALLOC, "The starting state.").frames, []);
  const shown = { alloc: outcome?.alloc ?? alloc, avail: outcome?.avail ?? avail };
  const frames = outcome?.frames ?? initial;
  const s = useStepper(frames, 1100);
  const f = s.frame;
  const need = shown.alloc.map((a, i) => sub(MAX[i], a));

  const ask = (p: number, r: Vec) => {
    setWho(String(p));
    setReq(r);
    const n = sub(MAX[p], alloc[p]);
    if (!le(r, n)) {
      setOutcome({ alloc, avail, frames: [{ work: avail, finished: [], look: p, fits: false, note: `P${p} asked for ${fmt(r)}, but it declared it would only ever need ${fmt(n)} more. That's an error: the request is rejected.`, tone: "bad" }], verdict: "error", tone: "bad" });
      return;
    }
    if (!le(r, avail)) {
      setOutcome({ alloc, avail, frames: [{ work: avail, finished: [], look: p, fits: false, note: `P${p} asked for ${fmt(r)}, but only ${fmt(avail)} is free right now. P${p} must WAIT until others release resources.`, tone: "warn" }], verdict: "wait", tone: "warn" });
      return;
    }
    const tryAlloc = alloc.map((a, i) => (i === p ? add(a, r) : a)) as Vec[];
    const tryAvail = sub(avail, r);
    const check = safety(tryAvail, tryAlloc, `Pretend to give P${p} ${fmt(r)}: available would drop to ${fmt(tryAvail)}.`);
    if (check.safe) {
      setAlloc(tryAlloc);
      setAvail(tryAvail);
      setOutcome({ alloc: tryAlloc, avail: tryAvail, frames: check.frames, verdict: "granted", tone: "good" });
    } else {
      setOutcome({ alloc: tryAlloc, avail: tryAvail, frames: [...check.frames.slice(0, -1), { ...check.frames.at(-1)!, note: `${check.frames.at(-1)!.note} So the request is DENIED and rolled back: P${p} must wait.` }], verdict: "denied", tone: "bad" });
    }
  };
  const finish = (p: number) => {
    const back = alloc[p];
    const nextAlloc = alloc.map((a, i) => (i === p ? ([0, 0, 0] as Vec) : a));
    const nextAvail = add(avail, back);
    setAlloc(nextAlloc);
    setAvail(nextAvail);
    setOutcome({ alloc: nextAlloc, avail: nextAvail, frames: safety(nextAvail, nextAlloc, `P${p} finishes and returns ${fmt(back)}.`).frames, verdict: "", tone: "info" });
  };
  const reset = () => {
    setAlloc(START_ALLOC);
    setAvail(START_AVAIL);
    setOutcome(null);
  };

  const cell = (v: Vec, hl?: string) => (
    <span className="font-mono" style={{ color: hl }}>
      {v.join(" ")}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-faint">Try:</span>
        {PRESETS.map((x) => (
          <SmallBtn key={x.p} onClick={() => ask(x.p, x.req)}>
            P{x.p} asks {fmt(x.req)}
          </SmallBtn>
        ))}
        <SmallBtn tone="danger" onClick={reset}>
          Reset
        </SmallBtn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[440px] text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              <th className="px-2 py-1.5 text-left">process</th>
              <th className="px-2 py-1.5 text-left">has (A B C)</th>
              <th className="px-2 py-1.5 text-left">max</th>
              <th className="px-2 py-1.5 text-left">still needs</th>
              <th className="px-2 py-1.5 text-left">safety check</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {shown.alloc.map((a, p) => {
              const look = f.look === p;
              const order = f.finished.indexOf(p);
              return (
                <tr key={p} className="border-t border-line" style={{ background: look ? `${f.fits ? C.done : C.compare}18` : undefined }}>
                  <td className="px-2 py-1 font-bold">P{p}</td>
                  <td className="px-2 py-1">{cell(a)}</td>
                  <td className="px-2 py-1">{cell(MAX[p], C.faint)}</td>
                  <td className="px-2 py-1">{cell(need[p], look ? (f.fits ? C.done : C.bad) : undefined)}</td>
                  <td className="px-2 py-1">{order >= 0 ? <span style={{ color: C.done }}>✓ finishes #{order + 1}</span> : look ? <span style={{ color: C.bad }}>doesn&apos;t fit yet</span> : <span className="text-faint">–</span>}</td>
                  <td className="px-2 py-1 text-right">
                    {a.some((x) => x > 0) && outcome?.verdict !== "denied" && (
                      <button className="rounded border border-line px-1.5 py-0.5 text-[10px] text-dim hover:text-ink" onClick={() => finish(p)}>
                        finish
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: C.base }}>
          <div className="text-[10px] tracking-wider text-faint uppercase">available {outcome?.verdict === "denied" ? "(if granted)" : ""}</div>
          <div className="font-mono text-lg font-bold text-ink">{fmt(shown.avail)}</div>
        </div>
        <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: C.pivot }}>
          <div className="text-[10px] tracking-wider text-faint uppercase">work (pretend free)</div>
          <div className="font-mono text-lg font-bold" style={{ color: C.pivot }}>
            {fmt(f.work)}
          </div>
        </div>
        <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: outcome?.verdict ? (outcome.tone === "good" ? C.done : outcome.tone === "warn" ? C.compare : C.bad) : C.dim }}>
          <div className="text-[10px] tracking-wider text-faint uppercase">last request</div>
          <div className="text-sm font-bold text-ink">{outcome?.verdict ? `P${who} ${fmt(req)}: ${outcome.verdict}` : "none yet"}</div>
        </div>
      </div>

      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />

      <div className="rounded-xl border border-line p-3">
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-faint uppercase">Make your own request</div>
        <div className="flex flex-wrap items-end gap-3">
          <Segmented value={who} onChange={setWho} options={[0, 1, 2, 3, 4].map((p) => ({ value: String(p), label: `P${p}` }))} />
          {RES.map((r, k) => (
            <div key={r} className="w-40">
              <Slider
                label={r}
                value={req[k]}
                min={0}
                max={5}
                onChange={(v) => setReq((q) => q.map((x, i) => (i === k ? v : x)) as Vec)}
              />
            </div>
          ))}
          <SmallBtn tone="primary" onClick={() => ask(Number(who), req)}>
            Ask the banker
          </SmallBtn>
        </div>
      </div>
    </div>
  );
}
