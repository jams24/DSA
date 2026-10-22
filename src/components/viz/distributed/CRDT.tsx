"use client";

import { useState } from "react";
import { C, Narration, SmallBtn } from "../kit";

const R = ["A", "B", "C"];

interface Replica {
  gc: number[]; // G-Counter: one slot per replica
  lww: { v: number; t: number }; // naive last-writer-wins counter
  adds: [string, string][]; // OR-Set: (element, unique tag)
  removes: string[]; // removed tags
}

const empty = (): Replica => ({ gc: [0, 0, 0], lww: { v: 0, t: 0 }, adds: [], removes: [] });

function merge(a: Replica, b: Replica): Replica {
  const adds = [...a.adds];
  for (const x of b.adds) if (!adds.some((y) => y[1] === x[1])) adds.push(x);
  return {
    gc: a.gc.map((x, i) => Math.max(x, b.gc[i])),
    lww: a.lww.t >= b.lww.t ? a.lww : b.lww,
    adds,
    removes: [...new Set([...a.removes, ...b.removes])],
  };
}

const tag = () => Math.random().toString(36).slice(2, 7);

const ITEMS = ["🥛", "🍞", "🥚", "🧀"];

export default function CRDT() {
  const [reps, setReps] = useState<Replica[]>([empty(), empty(), empty()]);
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState(1);
  const [msg, setMsg] = useState("Three replicas start OFFLINE from each other (think phones in airplane mode). Make changes on different replicas, then sync.");

  function update(i: number, f: (r: Replica) => Replica, note: string) {
    setClock((c) => c + 1);
    setReps((all) => {
      let next = all.map((r, j) => (j === i ? f(r) : r));
      if (online) {
        const m = next.reduce(merge);
        next = next.map(() => m);
      }
      return next;
    });
    setMsg(note);
  }

  function sync() {
    setReps((all) => {
      const m = all.reduce(merge);
      return all.map(() => m);
    });
    setMsg("Synced: every replica merged every other's state. Merges are commutative, associative and idempotent, so order and duplicates don't matter — all replicas converge.");
  }

  const total = (r: Replica) => r.gc.reduce((a, b) => a + b, 0);
  const setOf = (r: Replica) => [...new Set(r.adds.filter(([, t]) => !r.removes.includes(t)).map(([e]) => e))];
  const trueClicks = reps.reduce((n, r, i) => n + r.gc[i], 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SmallBtn tone={online ? "good" : "danger"} onClick={() => setOnline((o) => !o)}>
          {online ? "🌐 connected (auto-merge)" : "✈️ offline (partitioned)"}
        </SmallBtn>
        <SmallBtn tone="primary" onClick={sync}>
          🔄 sync all replicas
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            setReps([empty(), empty(), empty()]);
            setMsg("Reset.");
          }}
        >
          reset
        </SmallBtn>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {reps.map((r, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-line bg-[#080c19] p-3">
            <div className="font-display font-semibold text-ink">📱 Replica {R[i]}</div>
            <div className="rounded-lg border border-line bg-panel p-2">
              <div className="flex items-center justify-between text-[11px] text-dim">
                <span>G-Counter (likes)</span>
                <span className="font-mono text-lg font-bold text-emerald">{total(r)}</span>
              </div>
              <div className="font-mono text-[10px] text-faint">slots [{r.gc.join(", ")}]</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-dim">
                <span>naive LWW counter</span>
                <span className="font-mono text-lg font-bold text-rose">{r.lww.v}</span>
              </div>
              <SmallBtn
                className="mt-2 w-full justify-center"
                tone="good"
                onClick={() =>
                  update(
                    i,
                    (x) => ({ ...x, gc: x.gc.map((v, j) => (j === i ? v + 1 : v)), lww: { v: x.lww.v + 1, t: clock } }),
                    `Replica ${R[i]} +1. The G-Counter only bumps its OWN slot; the naive counter overwrites a single number.`,
                  )
                }
              >
                👍 like
              </SmallBtn>
            </div>
            <div className="rounded-lg border border-line bg-panel p-2">
              <div className="text-[11px] text-dim">OR-Set (shopping list)</div>
              <div className="my-1 flex min-h-7 flex-wrap gap-1 text-lg">{setOf(r).map((e) => <span key={e}>{e}</span>)}</div>
              <div className="flex flex-wrap gap-1">
                {ITEMS.map((e) => {
                  const has = setOf(r).includes(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() =>
                        update(
                          i,
                          (x) =>
                            has
                              ? { ...x, removes: [...x.removes, ...x.adds.filter(([el]) => el === e).map(([, t]) => t)] }
                              : { ...x, adds: [...x.adds, [e, tag()]] },
                          has ? `Replica ${R[i]} removes ${e}: it tombstones only the add-tags it has SEEN. A concurrent add elsewhere (new tag) survives → add-wins.` : `Replica ${R[i]} adds ${e} with a unique tag.`,
                        )
                      }
                      className="rounded-md border px-1.5 py-0.5 text-sm"
                      style={{ borderColor: has ? C.bad : C.base }}
                      title={has ? "remove" : "add"}
                    >
                      {has ? "−" : "+"}
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Narration tone={reps.some((r) => r.lww.v < trueClicks) && reps.every((r) => total(r) === trueClicks) ? "warn" : "info"}>
        {msg} {reps.every((r) => total(r) === trueClicks) && trueClicks > 0 && reps.some((r) => r.lww.v < trueClicks) ? `Total real likes: ${trueClicks}. The G-Counter kept all of them; last-writer-wins LOST ${trueClicks - Math.max(...reps.map((r) => r.lww.v))}.` : ""}
      </Narration>
    </div>
  );
}
