"use client";

import { useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat, StepControls, TextInput, useStepper } from "../kit";

const TOMB = "␡";
type Mode = "chaining" | "probing";

interface Frame {
  table: string[][]; // chaining: chain per bucket; probing: [] or [key]
  bucket?: number;
  keyHi?: string;
  color?: string;
  calc?: string;
  msg: string;
}

function hash(key: string) {
  let h = 0;
  for (const ch of key) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

const SEED = ["cat", "dog", "owl", "bee", "fox"];

function build(mode: Mode, keys: string[], m: number): string[][] {
  const t: string[][] = Array.from({ length: m }, () => []);
  for (const k of keys) {
    let b = hash(k) % m;
    if (mode === "chaining") t[b].push(k);
    else {
      while (t[b].length) b = (b + 1) % m;
      t[b] = [k];
    }
  }
  return t;
}

const copy = (t: string[][]) => t.map((c) => [...c]);

export default function HashTable() {
  const [mode, setMode] = useState<Mode>("chaining");
  const [table, setTable] = useState<string[][]>(() => build("chaining", SEED, 8));
  const [key, setKey] = useState("emu");
  const [probes, setProbes] = useState({ ops: 0, steps: 0 });
  const [frames, setFrames] = useState<Frame[]>([
    { table: build("chaining", SEED, 8), msg: "8 buckets, 5 keys. Each key's bucket = hash(key) mod 8. Insert, find or delete a key." },
  ]);
  const s = useStepper(frames, 650, true);

  const count = (t: string[][]) => t.reduce((n, c) => n + c.filter((k) => k !== TOMB).length, 0);
  const limit = mode === "chaining" ? 0.75 : 0.6;

  function switchMode(m: Mode) {
    const keys = table.flat().filter((k) => k !== TOMB);
    const t = build(m, keys, 8 * Math.max(1, Math.ceil(keys.length / (8 * (m === "chaining" ? 0.75 : 0.6)))));
    setMode(m);
    setTable(t);
    setFrames([{ table: t, msg: m === "chaining" ? "Separate chaining: each bucket holds a linked list of keys." : "Open addressing (linear probing): one key per slot; on collision, try the next slot." }]);
  }

  function run(op: "insert" | "find" | "delete") {
    const k = key.trim().slice(0, 8);
    if (!k) return;
    let t = copy(table);
    let m = t.length;
    const fr: Frame[] = [];
    const h = hash(k);
    let steps = 0;
    const calc = () => `hash("${k}") = ${h.toLocaleString()} → ${h.toLocaleString()} mod ${m} = ${h % m}`;
    let b = h % m;
    fr.push({ table: copy(t), bucket: b, color: C.active, calc: calc(), msg: `Hash the key, then take it modulo the table size to pick bucket ${b}.` });

    if (mode === "chaining") {
      const chain = t[b];
      let found = -1;
      for (let i = 0; i < chain.length; i++) {
        steps++;
        const hit = chain[i] === k;
        fr.push({ table: copy(t), bucket: b, keyHi: chain[i], color: hit ? C.done : C.compare, calc: calc(), msg: `Compare "${chain[i]}" with "${k}": ${hit ? "match!" : "no match, follow the chain."}` });
        if (hit) {
          found = i;
          break;
        }
      }
      if (op === "find") {
        fr.push({ table: copy(t), bucket: b, color: found >= 0 ? C.done : C.bad, calc: calc(), msg: found >= 0 ? `Found "${k}" after ${steps} comparison(s).` : `Reached the end of bucket ${b}'s chain: "${k}" is not in the table.` });
      } else if (op === "delete") {
        if (found >= 0) chain.splice(found, 1);
        fr.push({ table: copy(t), bucket: b, color: found >= 0 ? C.bad : C.faint, calc: calc(), msg: found >= 0 ? `Unlink "${k}" from the chain.` : `"${k}" not present — nothing to delete.` });
      } else {
        if (found >= 0) fr.push({ table: copy(t), bucket: b, keyHi: k, color: C.compare, calc: calc(), msg: `"${k}" already exists (a map would overwrite its value).` });
        else {
          chain.push(k);
          fr.push({
            table: copy(t),
            bucket: b,
            keyHi: k,
            color: C.done,
            calc: calc(),
            msg: chain.length > 1 ? `Collision! Bucket ${b} already had ${chain.length - 1} key(s); append "${k}" to its chain.` : `Bucket ${b} was empty; store "${k}" there.`,
          });
        }
      }
    } else {
      let found = -1;
      let firstFree = -1;
      for (let probe = 0; probe < m; probe++) {
        steps++;
        const slot = t[b];
        if (!slot.length) {
          fr.push({ table: copy(t), bucket: b, color: C.faint, calc: calc(), msg: `Slot ${b} is empty: the probe sequence stops here.` });
          if (firstFree < 0) firstFree = b;
          break;
        }
        if (slot[0] === TOMB) {
          if (firstFree < 0) firstFree = b;
          fr.push({ table: copy(t), bucket: b, color: C.pivot, calc: calc(), msg: `Slot ${b} holds a tombstone (a deleted key). Keep probing — the key could be further along.` });
        } else if (slot[0] === k) {
          found = b;
          fr.push({ table: copy(t), bucket: b, keyHi: k, color: C.done, calc: calc(), msg: `Slot ${b} holds "${k}": match!` });
          break;
        } else {
          fr.push({ table: copy(t), bucket: b, keyHi: slot[0], color: C.compare, calc: calc(), msg: `Slot ${b} holds "${slot[0]}" — collision. Probe the next slot (${(b + 1) % m}).` });
        }
        b = (b + 1) % m;
      }
      if (op === "find") {
        fr.push({ table: copy(t), bucket: found >= 0 ? found : b, color: found >= 0 ? C.done : C.bad, calc: calc(), msg: found >= 0 ? `Found "${k}" after ${steps} probe(s).` : `Hit an empty slot: "${k}" is not in the table.` });
      } else if (op === "delete") {
        if (found >= 0) {
          t[found] = [TOMB];
          fr.push({ table: copy(t), bucket: found, color: C.pivot, calc: calc(), msg: `Replace "${k}" with a tombstone. Emptying the slot outright would break probe chains of keys stored after it.` });
        } else fr.push({ table: copy(t), color: C.faint, msg: `"${k}" not present.` });
      } else if (found < 0 && firstFree >= 0) {
        t[firstFree] = [k];
        fr.push({ table: copy(t), bucket: firstFree, keyHi: k, color: C.done, calc: calc(), msg: `Store "${k}" in slot ${firstFree}${steps > 1 ? ` after ${steps} probes (clustering makes probe runs longer as the table fills)` : ""}.` });
      } else if (found >= 0) {
        fr.push({ table: copy(t), bucket: found, keyHi: k, color: C.compare, msg: `"${k}" already exists.` });
      }
    }

    if (op === "insert" && count(t) / m > limit) {
      const keys = t.flat().filter((x) => x !== TOMB);
      const nm = m * 2;
      fr.push({ table: copy(t), color: C.bad, msg: `Load factor ${count(t)}/${m} = ${(count(t) / m).toFixed(2)} exceeds ${limit}. Resize to ${nm} buckets and rehash every key (bucket = hash mod ${nm} changes!).` });
      t = build(mode, keys, nm);
      m = nm;
      fr.push({ table: copy(t), msg: `Rehashed into ${nm} buckets. Load factor now ${(count(t) / nm).toFixed(2)}. Like dynamic arrays, doubling keeps inserts amortized O(1).` });
    }

    setTable(t);
    setProbes((p) => ({ ops: p.ops + 1, steps: p.steps + steps }));
    setFrames(fr);
  }

  const f = s.frame;
  const n = count(f.table);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={mode}
          onChange={switchMode}
          options={[
            { value: "chaining", label: "Separate chaining" },
            { value: "probing", label: "Linear probing" },
          ]}
        />
        <TextInput value={key} onChange={setKey} placeholder="key" width="w-24" onEnter={() => run("insert")} />
        <SmallBtn tone="primary" onClick={() => run("insert")}>insert</SmallBtn>
        <SmallBtn onClick={() => run("find")}>find</SmallBtn>
        <SmallBtn tone="danger" onClick={() => run("delete")}>delete</SmallBtn>
      </div>

      {f.calc && <div className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-xs text-cyan">{f.calc}</div>}

      <div className="max-h-[420px] overflow-auto rounded-xl border border-line bg-[#080c19] p-3 scrollbar-thin">
        {mode === "chaining" ? (
          <div className="space-y-1.5">
            {f.table.map((chain, i) => {
              const active = f.bucket === i;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="grid h-9 w-11 shrink-0 place-items-center rounded-md border font-mono text-xs transition"
                    style={{ borderColor: active ? f.color : C.base, color: active ? f.color : C.muted, background: active ? `${f.color}22` : C.baseFill }}
                  >
                    {i}
                  </div>
                  <span className="text-faint">→</span>
                  {chain.length === 0 && <span className="font-mono text-xs text-faint">∅</span>}
                  {chain.map((k, j) => {
                    const hi = active && f.keyHi === k;
                    return (
                      <div key={`${k}-${j}`} className="flex items-center gap-2">
                        <span
                          className="rounded-md border px-2 py-1 font-mono text-xs transition"
                          style={{ borderColor: hi ? f.color : C.base, color: hi ? f.color : C.text, background: hi ? `${f.color}22` : C.baseFill, boxShadow: hi ? `0 0 10px ${f.color}55` : undefined }}
                        >
                          {k}
                        </span>
                        {j < chain.length - 1 && <span className="text-faint">→</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {f.table.map((slot, i) => {
              const active = f.bucket === i;
              const k = slot[0];
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="grid h-12 w-full place-items-center rounded-lg border-2 font-mono text-xs transition"
                    style={{
                      borderColor: active ? f.color : k ? C.base : C.dim,
                      background: active ? `${f.color}22` : k ? C.baseFill : "transparent",
                      color: k === TOMB ? C.pivot : active ? f.color : C.text,
                      borderStyle: k ? "solid" : "dashed",
                    }}
                  >
                    {k ?? ""}
                  </div>
                  <span className="font-mono text-[10px] text-faint">{i}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="keys" value={n} />
        <Stat label="load factor α" value={(n / f.table.length).toFixed(2)} color={n / f.table.length > limit ? C.bad : C.done} />
        <Stat label="avg comparisons" value={probes.ops ? (probes.steps / probes.ops).toFixed(2) : "–"} color={C.compare} />
      </div>
    </div>
  );
}
