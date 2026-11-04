"use client";

import { useEffect, useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat } from "../kit";

// Two threads each run counter++ (load, add, store) on one shared counter. You choose who runs next.
// With the lock off, some orders lose an update; with it on, every order gives the right answer.
type T = "A" | "B";
type Op = "lock" | "load" | "add" | "store" | "unlock";
const START = 5;
const PROG: Record<"off" | "on", Op[]> = {
  off: ["load", "add", "store"],
  on: ["lock", "load", "add", "store", "unlock"],
};
const ASM: Record<Op, string> = {
  lock: "lock(m)",
  load: "r = counter",
  add: "r = r + 1",
  store: "counter = r",
  unlock: "unlock(m)",
};
const COLOR: Record<T, string> = { A: C.active, B: C.pivot };

interface Sim {
  pc: Record<T, number>;
  reg: Record<T, number | null>;
  blocked: Record<T, boolean>;
  counter: number;
  holder: T | null;
  log: { t: T; text: string }[];
  msg: string;
  tone: "info" | "good" | "bad" | "warn";
}

const fresh = (lock: boolean): Sim => ({
  pc: { A: 0, B: 0 },
  reg: { A: null, B: null },
  blocked: { A: false, B: false },
  counter: START,
  holder: null,
  log: [],
  msg: lock
    ? "The lock is ON: each thread must lock(m) before touching the counter. Try any order you like and see if you can still lose an update."
    : `Both threads want to add 1 to the counter (${START}). The right answer is ${START + 2}. Click “Step A” and “Step B” in any order, or play a preset.`,
  tone: "info",
});

function apply(s: Sim, t: T, lock: boolean): Sim {
  const prog = PROG[lock ? "on" : "off"];
  const other: T = t === "A" ? "B" : "A";
  if (s.pc[t] >= prog.length) return { ...s, msg: `Thread ${t} has already finished.`, tone: "warn" };
  const op = prog[s.pc[t]];
  const n: Sim = { ...s, pc: { ...s.pc }, reg: { ...s.reg }, blocked: { ...s.blocked }, log: [...s.log] };
  let text = "";
  switch (op) {
    case "lock":
      if (s.holder === other) {
        if (s.blocked[t]) {
          n.msg = `Thread ${t} is still asleep: ${other} holds the lock. Only ${other} can make progress now.`;
          n.tone = "warn";
          return n;
        }
        n.blocked[t] = true;
        n.msg = `Thread ${t} tries lock(m), but ${other} holds it. ${t} goes to sleep (blocked) until ${other} unlocks. It can't touch the counter in between.`;
        n.tone = "warn";
        n.log.push({ t, text: "lock(m): blocked" });
        return n;
      }
      n.holder = t;
      n.blocked[t] = false;
      text = "lock(m): got it";
      n.msg = `Thread ${t} takes the lock. Until it unlocks, it's the only one allowed in the critical section.`;
      break;
    case "load":
      n.reg[t] = s.counter;
      text = `r = counter → ${s.counter}`;
      n.msg = `Thread ${t} LOADS the counter into its own register: r = ${s.counter}.${s.reg[other] !== null && s.pc[other] < prog.indexOf("store") + 1 && !lock ? ` Uh-oh: ${other} also loaded ${s.reg[other]} and hasn't stored yet.` : ""}`;
      break;
    case "add":
      n.reg[t] = (s.reg[t] ?? 0) + 1;
      text = `r = r + 1 → ${n.reg[t]}`;
      n.msg = `Thread ${t} adds 1 in its register: r = ${n.reg[t]}. The counter in memory is still ${s.counter}.`;
      break;
    case "store":
      n.counter = s.reg[t] ?? s.counter;
      text = `counter = r → ${n.counter}`;
      n.msg =
        n.counter === s.counter
          ? `Thread ${t} STORES ${n.counter}, but the counter was already ${s.counter}. ${t}'s +1 just overwrote ${other}'s +1 with the same number.`
          : `Thread ${t} STORES ${n.counter} back to memory.`;
      n.tone = n.counter === s.counter ? "bad" : "info";
      break;
    case "unlock":
      n.holder = null;
      text = "unlock(m)";
      n.msg = `Thread ${t} unlocks.${s.blocked[other] ? ` ${other} is woken up and can try lock(m) again.` : ""}`;
      if (s.blocked[other]) n.blocked[other] = false;
      break;
  }
  n.pc[t]++;
  n.log.push({ t, text });
  if (n.pc.A >= prog.length && n.pc.B >= prog.length) {
    const ok = n.counter === START + 2;
    n.msg = ok
      ? `Both threads finished and the counter is ${n.counter}. Correct! ${lock ? "The lock made the three steps act like one." : "This order was lucky: one thread finished before the other loaded."}`
      : `Both threads finished, but the counter is ${n.counter}, not ${START + 2}. An update was LOST: both loaded ${START} before either stored. That's a race condition.`;
    n.tone = ok ? "good" : "bad";
  }
  return n;
}

// How many of the possible orders (interleavings) lose an update without the lock?
function countLosing(): { total: number; losing: number } {
  let total = 0;
  let losing = 0;
  const walk = (s: Sim, a: number, b: number) => {
    if (a === 3 && b === 3) {
      total++;
      if (s.counter !== START + 2) losing++;
      return;
    }
    if (a < 3) walk(apply(s, "A", false), a + 1, b);
    if (b < 3) walk(apply(s, "B", false), a, b + 1);
  };
  walk(fresh(false), 0, 0);
  return { total, losing };
}

const ODDS = countLosing();

const PRESETS: Record<"off" | "on", { label: string; steps: T[] }[]> = {
  off: [
    { label: "Unlucky order", steps: ["A", "B", "A", "B", "A", "B"] },
    { label: "Lucky order", steps: ["A", "A", "A", "B", "B", "B"] },
  ],
  on: [
    { label: "Unlucky order", steps: ["A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "B", "B", "B", "B"] },
    { label: "Lucky order", steps: ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B"] },
  ],
};

export default function Race() {
  const [lock, setLock] = useState<"off" | "on">("off");
  const [sim, setSim] = useState<Sim>(() => fresh(false));
  const [script, setScript] = useState<T[]>([]);
  const prog = PROG[lock];
  const odds = ODDS;
  const done = sim.pc.A >= prog.length && sim.pc.B >= prog.length;

  useEffect(() => {
    if (!script.length) return;
    const id = setTimeout(() => {
      setSim((s) => (s.pc[script[0]] >= prog.length ? s : apply(s, script[0], lock === "on")));
      setScript((q) => q.slice(1));
    }, 750);
    return () => clearTimeout(id);
  }, [script, lock, prog.length]);

  const reset = (l = lock) => {
    setScript([]);
    setSim(fresh(l === "on"));
  };
  const play = (steps: T[]) => {
    setSim(fresh(lock === "on"));
    setScript(steps);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={lock}
          onChange={(v) => {
            setLock(v);
            reset(v);
          }}
          options={[
            { value: "off", label: "No lock" },
            { value: "on", label: "With a lock" },
          ]}
        />
        {PRESETS[lock].map((p) => (
          <SmallBtn key={p.label} onClick={() => play(p.steps)} disabled={script.length > 0}>
            ▶ {p.label}
          </SmallBtn>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {(["A", "B"] as T[]).map((t, k) => (
          <div key={t} className={k === 1 ? "sm:order-3" : ""}>
            <div className="rounded-xl border-2 p-3" style={{ borderColor: sim.blocked[t] ? C.compare : COLOR[t] }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: COLOR[t] }}>
                  Thread {t}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: sim.pc[t] >= prog.length ? C.done : sim.blocked[t] ? C.compare : COLOR[t] }}>
                  {sim.pc[t] >= prog.length ? "finished" : sim.blocked[t] ? "blocked" : "ready"}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-line font-mono text-xs">
                {prog.map((op, i) => (
                  <div
                    key={op}
                    className="flex items-center gap-2 border-b border-line px-2 py-1 last:border-b-0"
                    style={{ background: i === sim.pc[t] ? `${COLOR[t]}18` : undefined, color: i < sim.pc[t] ? C.faint : C.text }}
                  >
                    <span className="w-3">{i === sim.pc[t] ? "▶" : i < sim.pc[t] ? "✓" : ""}</span>
                    {ASM[op]}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-faint">register r</span>
                <span className="font-mono text-base font-bold" style={{ color: COLOR[t] }}>
                  {sim.reg[t] ?? "–"}
                </span>
              </div>
              <SmallBtn tone="primary" className="mt-2 w-full" onClick={() => setSim((s) => apply(s, t, lock === "on"))} disabled={script.length > 0 || sim.pc[t] >= prog.length}>
                Step {t}
              </SmallBtn>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-center justify-center gap-2 sm:order-2">
          <div className="text-[10px] font-semibold tracking-wider text-faint uppercase">shared memory</div>
          <div className="rounded-2xl border-2 px-6 py-3 text-center" style={{ borderColor: done ? (sim.counter === START + 2 ? C.done : C.bad) : C.base }}>
            <div className="text-[10px] text-faint">counter</div>
            <div className="font-mono text-3xl font-bold text-ink tabular-nums">{sim.counter}</div>
          </div>
          {lock === "on" && (
            <div className="rounded-lg border px-3 py-1 text-xs" style={{ borderColor: sim.holder ? COLOR[sim.holder] : C.dim }}>
              🔒 lock m: <b style={{ color: sim.holder ? COLOR[sim.holder] : C.faint }}>{sim.holder ? `held by ${sim.holder}` : "free"}</b>
            </div>
          )}
          <SmallBtn onClick={() => reset()}>Reset</SmallBtn>
        </div>
      </div>

      <Narration tone={sim.tone}>{sim.msg}</Narration>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-line p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">What happened, in order</div>
          {sim.log.length ? (
            <ol className="space-y-0.5 font-mono text-xs">
              {sim.log.map((l, i) => (
                <li key={i}>
                  <span className="text-faint">{i + 1}.</span> <b style={{ color: COLOR[l.t] }}>{l.t}</b> {l.text}
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-xs text-faint">Nothing yet.</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 self-start">
          <Stat label="expected" value={START + 2} color={C.done} />
          <Stat label="orders that lose an update (no lock)" value={`${odds.losing} of ${odds.total}`} color={C.bad} />
        </div>
      </div>
    </div>
  );
}
