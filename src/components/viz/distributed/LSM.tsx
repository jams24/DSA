"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, SmallBtn, TextInput } from "../kit";

interface Row {
  k: string;
  v: string;
  tomb?: boolean;
}
type Table = { id: number; rows: Row[] };

const MEM_CAP = 4;
const L0_CAP = 3;
let tableId = 1;

const sorted = (rows: Row[]) => [...rows].sort((a, b) => a.k.localeCompare(b.k));

export default function LSM() {
  const [mem, setMem] = useState<Row[]>([]);
  const [l0, setL0] = useState<Table[]>([]);
  const [l1, setL1] = useState<Table | null>(null);
  const [key, setKey] = useState("c");
  const [val, setVal] = useState("7");
  const [trace, setTrace] = useState<{ where: string; result: "hit" | "skip" | "miss" | "bloom" }[]>([]);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({ text: "Writes go to an in-memory memtable (after appending to a write-ahead log). When it fills, it's flushed to an immutable sorted file: an SSTable.", tone: "info" });

  function write(row: Row) {
    let m = [...mem.filter((r) => r.k !== row.k), row];
    let newL0 = l0;
    let newL1 = l1;
    let text = row.tomb ? `delete(${row.k}) writes a TOMBSTONE — deletes are just writes too.` : `put(${row.k}, ${row.v}) → WAL append + memtable insert. O(log n) in memory, sequential disk I/O only.`;
    let tone: "info" | "good" | "bad" | "warn" = "info";
    if (m.length >= MEM_CAP) {
      newL0 = [{ id: tableId++, rows: sorted(m) }, ...l0];
      m = [];
      text += ` Memtable full → flushed to a new L0 SSTable (one big sequential write).`;
      tone = "warn";
    }
    if (newL0.length >= L0_CAP) {
      const merged = new Map<string, Row>();
      for (const r of newL1?.rows ?? []) merged.set(r.k, r);
      for (const t of [...newL0].reverse()) for (const r of t.rows) merged.set(r.k, r); // newer tables overwrite
      const live = sorted([...merged.values()].filter((r) => !r.tomb));
      const dropped = merged.size - live.length;
      newL1 = { id: tableId++, rows: live };
      newL0 = [];
      text += ` L0 has ${L0_CAP} tables → COMPACTION merges them into L1, keeping only the newest version of each key${dropped ? ` and purging ${dropped} tombstoned key(s)` : ""}.`;
      tone = "good";
    }
    setMem(m);
    setL0(newL0);
    setL1(newL1);
    setTrace([]);
    setMsg({ text, tone });
  }

  function get() {
    const k = key.trim().toLowerCase().slice(0, 2);
    if (!k) return;
    const tr: typeof trace = [];
    const found = (r: Row | undefined, where: string) => {
      if (!r) return false;
      tr.push({ where, result: "hit" });
      setTrace(tr);
      setMsg({ text: r.tomb ? `get(${k}) hit a tombstone in ${where} → key is deleted; stop searching older levels.` : `get(${k}) = ${r.v}, found in ${where} after checking ${tr.length} place(s). Newest data wins, so search newest → oldest.`, tone: r.tomb ? "warn" : "good" });
      return true;
    };
    if (found(mem.find((r) => r.k === k), "memtable")) return;
    tr.push({ where: "memtable", result: "miss" });
    for (const t of l0) {
      const has = t.rows.some((r) => r.k === k);
      if (!has) {
        tr.push({ where: `L0·sst${t.id}`, result: "bloom" });
        continue;
      }
      if (found(t.rows.find((r) => r.k === k), `L0·sst${t.id}`)) return;
    }
    if (l1) {
      if (!l1.rows.some((r) => r.k === k)) tr.push({ where: `L1·sst${l1.id}`, result: "bloom" });
      else if (found(l1.rows.find((r) => r.k === k), `L1·sst${l1.id}`)) return;
    }
    setTrace(tr);
    setMsg({ text: `get(${k}) → not found. Bloom filters let us skip every SSTable without touching disk.`, tone: "info" });
  }

  function randomWrites() {
    const keys = "abcdefgh";
    write({ k: keys[Math.floor(Math.random() * keys.length)], v: String(Math.floor(Math.random() * 90) + 10) });
  }

  const Chip = ({ r }: { r: Row }) => (
    <span className={clsx("rounded-md border px-1.5 py-0.5 font-mono text-[11px]", r.k === key.trim().toLowerCase() && "ring-1 ring-amber")} style={{ borderColor: r.tomb ? C.bad : C.base, color: r.tomb ? C.bad : C.text, background: C.baseFill }}>
      {r.k}:{r.tomb ? "🪦" : r.v}
    </span>
  );
  const traceOf = (where: string) => trace.find((t) => t.where === where);
  const badge = (where: string) => {
    const t = traceOf(where);
    if (!t) return null;
    const map = { hit: ["found", C.done], miss: ["miss", C.faint], skip: ["skip", C.faint], bloom: ["bloom: no", C.pivot] } as const;
    const [label, color] = map[t.result];
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color, border: `1px solid ${color}` }}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">key</span>
        <TextInput value={key} onChange={setKey} width="w-12" />
        <span className="text-xs text-dim">value</span>
        <TextInput value={val} onChange={setVal} width="w-14" />
        <SmallBtn tone="primary" onClick={() => key.trim() && write({ k: key.trim().toLowerCase().slice(0, 2), v: val.slice(0, 4) })}>
          put
        </SmallBtn>
        <SmallBtn tone="danger" onClick={() => key.trim() && write({ k: key.trim().toLowerCase().slice(0, 2), v: "", tomb: true })}>
          delete
        </SmallBtn>
        <SmallBtn tone="good" onClick={get}>
          get
        </SmallBtn>
        <SmallBtn onClick={randomWrites}>random write</SmallBtn>
      </div>
      <div className="space-y-3 rounded-xl border border-line bg-[#f8fafd] p-4">
        <div className="rounded-xl border border-cyan/40 bg-cyan/[0.05] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="font-semibold text-cyan">⚡ Memtable (RAM, sorted)</span>
            <span className="text-faint">
              {mem.length}/{MEM_CAP}
            </span>
            {badge("memtable")}
          </div>
          <div className="flex min-h-7 flex-wrap gap-1.5">
            {sorted(mem).map((r) => (
              <Chip key={r.k} r={r} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber/40 bg-amber/[0.04] p-3">
          <div className="mb-2 text-xs font-semibold text-amber">
            💾 Level 0 SSTables (newest first, may overlap) · {l0.length}/{L0_CAP}
          </div>
          <div className="flex flex-wrap gap-2">
            {l0.map((t) => (
              <div key={t.id} className="rounded-lg border border-line-2 bg-panel p-2">
                <div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-faint">
                  sst{t.id} {badge(`L0·sst${t.id}`)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.rows.map((r) => (
                    <Chip key={r.k} r={r} />
                  ))}
                </div>
              </div>
            ))}
            {!l0.length && <span className="text-xs text-faint">empty</span>}
          </div>
        </div>
        <div className="rounded-xl border border-violet/40 bg-violet/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet">
            🗄️ Level 1 (compacted, non-overlapping) {l1 && badge(`L1·sst${l1.id}`)}
          </div>
          <div className="flex flex-wrap gap-1">{l1 ? l1.rows.map((r) => <Chip key={r.k} r={r} />) : <span className="text-xs text-faint">empty</span>}</div>
        </div>
      </div>
      <Narration tone={msg.tone}>{msg.text}</Narration>
      <p className="text-xs text-faint">LSM-trees (Cassandra, RocksDB, LevelDB, ScyllaDB) turn random writes into sequential ones; the price is read amplification (check several places) and background compaction. B-trees (Postgres, MySQL) update pages in place: faster reads, slower random writes.</p>
    </div>
  );
}
