"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, SmallBtn, Stat } from "../kit";

// A toy generational heap: Eden + two survivor spaces + Old. Objects have a lifetime in "ticks";
// the weak generational hypothesis (most objects die young) is baked into the random lifetimes.

interface Obj {
  id: number;
  age: number; // minor GCs survived
  ttl: number; // ticks left to live; Infinity = long-lived
  leak: boolean;
}

const EDEN = 12;
const SURV = 4;
const OLD = 16;
const TENURE = 3;

interface Heap {
  eden: Obj[];
  from: Obj[];
  to: Obj[];
  old: Obj[];
  tick: number;
  minor: number;
  major: number;
  promoted: number;
  freed: number;
  lastPause: string;
  oom: boolean;
}

const fresh = (): Heap => ({ eden: [], from: [], to: [], old: [], tick: 0, minor: 0, major: 0, promoted: 0, freed: 0, lastPause: "—", oom: false });
const alive = (o: Obj) => o.leak || o.ttl > 0;

export default function JavaGC() {
  const [h, setH] = useState<Heap>(fresh);
  const [note, setNote] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "Allocate objects into Eden, let time pass so short-lived ones die, then run a minor GC. Watch how few objects survive.",
    tone: "info",
  });
  const [leaky, setLeaky] = useState(false);
  const [auto, setAuto] = useState(false);
  const idRef = useRef(0);

  function minorGC(x: Heap, why: string): Heap {
    if (x.oom) return x;
    const candidates = [...x.eden, ...x.from].filter(alive);
    const dead = x.eden.length + x.from.length - candidates.length;
    const to: Obj[] = [];
    const promote: Obj[] = [];
    for (const o of candidates) {
      const aged = { ...o, age: o.age + 1 };
      if (aged.age >= TENURE || to.length >= SURV) promote.push(aged);
      else to.push(aged);
    }
    let old = x.old;
    let major = x.major;
    let freed = x.freed + dead;
    let extra = "";
    if (old.length + promote.length > OLD) {
      const liveOld = old.filter(alive);
      freed += old.length - liveOld.length;
      old = liveOld;
      major++;
      extra = " Old had no room for the promotions, so a full GC ran first: a much longer pause.";
      if (old.length + promote.length > OLD) {
        setNote({
          text: "java.lang.OutOfMemoryError: Java heap space. Old is full of objects that are still reachable, so no collector can free them. That's a memory leak: something (here a static cache) keeps references forever. Find it with a heap dump (jcmd <pid> GC.heap_dump) and look at what retains the most memory.",
          tone: "bad",
        });
        return { ...x, eden: [], from: to, old: [...old, ...promote].slice(0, OLD), major, freed, lastPause: "full GC failed", oom: true };
      }
    }
    old = [...old, ...promote];
    const pause = (0.3 + candidates.length * 0.4).toFixed(1);
    setNote({
      text: `${why}Minor GC: copied ${to.length} live object(s) into the empty survivor space, promoted ${promote.length} to Old, and reclaimed ${dead} dead object(s) without touching them. The cost scales with LIVE objects, not garbage, which is why young collections are fast.${extra}`,
      tone: extra ? "warn" : "good",
    });
    return { ...x, eden: [], from: to, to: [], old, minor: x.minor + 1, major, promoted: x.promoted + promote.length, freed, lastPause: extra ? `${(5 + old.length * 1.5).toFixed(0)} ms (full)` : `${pause} ms (young)` };
  }

  function majorGC(x: Heap): Heap {
    if (x.oom) return x;
    const live = x.old.filter(alive);
    const dead = x.old.length - live.length;
    const pause = (5 + x.old.length * 1.5).toFixed(0);
    setNote({
      text: `Major (old-generation) collection: marked the whole Old region, freed ${dead} object(s) and compacted the rest. It's slower than a minor GC because Old is big and mostly alive. G1 and ZGC do most of this work concurrently with your threads to keep pauses short.`,
      tone: "warn",
    });
    return { ...x, old: live, major: x.major + 1, freed: x.freed + dead, lastPause: `${pause} ms (old)` };
  }

  function allocate(x: Heap): Heap {
    if (x.oom) return x;
    let cur = x;
    if (cur.eden.length + 3 > EDEN) cur = minorGC(cur, "Eden is full, so the allocation triggers a GC. ");
    const objs: Obj[] = [];
    for (let i = 0; i < 3; i++) {
      const r = Math.random();
      const leak = leaky && Math.random() < 0.35;
      objs.push({ id: ++idRef.current, age: 0, leak, ttl: leak ? Infinity : r < 0.72 ? 1 + Math.floor(Math.random() * 2) : r < 0.95 ? 3 + Math.floor(Math.random() * 6) : Infinity });
    }
    if (cur === x) setNote({ text: "new Object() is just a pointer bump in Eden (a thread-local allocation buffer): a few nanoseconds, much cheaper than malloc.", tone: "info" });
    return { ...cur, eden: [...cur.eden, ...objs] };
  }

  function tick(x: Heap): Heap {
    const dec = (l: Obj[]) => l.map((o) => (o.leak ? o : { ...o, ttl: o.ttl - 1 }));
    return { ...x, eden: dec(x.eden), from: dec(x.from), old: dec(x.old), tick: x.tick + 1 };
  }

  const hRef = useRef(h);
  useEffect(() => {
    hRef.current = h;
  });
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => {
      const cur = hRef.current;
      if (cur.oom) {
        setAuto(false);
        return;
      }
      setH(tick(allocate(cur)));
    }, 700);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, leaky]);

  const used = h.eden.length + h.from.length + h.old.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SmallBtn tone="primary" onClick={() => setH(allocate(h))} disabled={h.oom}>
          new Object() × 3
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            setH(tick(h));
            setNote({ text: "Time passes: methods return, request objects go out of scope. Most young objects are now unreachable (grey). Nothing is freed yet: garbage just sits there until a collection.", tone: "info" });
          }}
          disabled={h.oom}
        >
          Time passes
        </SmallBtn>
        <SmallBtn tone="good" onClick={() => setH(minorGC(h, ""))} disabled={h.oom}>
          Minor GC
        </SmallBtn>
        <SmallBtn tone="danger" onClick={() => setH(majorGC(h))} disabled={h.oom}>
          Major GC
        </SmallBtn>
        <SmallBtn onClick={() => setAuto((a) => !a)} disabled={h.oom}>
          {auto ? "⏸ Stop" : "▶ Auto-run"}
        </SmallBtn>
        <label className="flex items-center gap-1.5 rounded-lg border border-line-2 px-2.5 text-xs text-dim">
          <input type="checkbox" checked={leaky} onChange={(e) => setLeaky(e.target.checked)} /> leak into a static cache
        </label>
        <SmallBtn
          onClick={() => {
            setAuto(false);
            setH(fresh());
            setNote({ text: "Fresh heap.", tone: "info" });
          }}
        >
          Reset
        </SmallBtn>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3 rounded-xl border-2 border-cyan/40 bg-cyan/[0.03] p-3">
          <div className="text-[10px] font-semibold tracking-wider text-cyan uppercase">Young generation</div>
          <Region title="Eden" cap={EDEN} objs={h.eden} />
          <div className="grid grid-cols-2 gap-3">
            <Region title="Survivor (from)" cap={SURV} objs={h.from} />
            <Region title="Survivor (to)" cap={SURV} objs={h.to} empty="empty: next GC copies here" />
          </div>
        </div>
        <div className="rounded-xl border-2 border-violet/40 bg-violet/[0.03] p-3">
          <div className="mb-3 text-[10px] font-semibold tracking-wider text-violet uppercase">Old generation (tenured)</div>
          <Region title={`Old: objects that survived ${TENURE} GCs`} cap={OLD} objs={h.old} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-dim">
        <Key color={C.active} label="age 0" />
        <Key color={C.sky} label="age 1" />
        <Key color={C.pivot} label="age 2+" />
        <Key color={C.bad} label="held by the leak" />
        <Key color={C.base} label="unreachable (garbage)" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="heap slots used" value={`${used}/${EDEN + SURV * 2 + OLD}`} />
        <Stat label="minor GCs" value={h.minor} color={C.done} />
        <Stat label="major GCs" value={h.major} color={C.bad} />
        <Stat label="promoted" value={h.promoted} color={C.pivot} />
        <Stat label="last pause" value={h.lastPause} color={C.compare} />
      </div>
      <Narration tone={note.tone}>{note.text}</Narration>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: color }} /> {label}
    </span>
  );
}

function Region({ title, cap, objs, empty }: { title: string; cap: number; objs: Obj[]; empty?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-dim">
        <span className="font-semibold text-ink">{title}</span>
        <span className="font-mono">
          {objs.length}/{cap}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1.5" style={{ minHeight: 40 }}>
        {objs.length === 0 && empty && <span className="self-center px-1 text-[10px] text-faint italic">{empty}</span>}
        {objs.map((o) => {
          const live = alive(o);
          const col = !live ? C.base : o.leak ? C.bad : o.age === 0 ? C.active : o.age === 1 ? C.sky : C.pivot;
          return (
            <span
              key={o.id}
              className={clsx("grid h-7 w-7 place-items-center rounded-md border-2 font-mono text-[10px] font-bold transition", !live && "opacity-50")}
              style={{ borderColor: col, background: live ? `${col}22` : "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 3px,#e2e8f0 3px,#e2e8f0 6px)", color: live ? C.text : C.faint }}
              title={live ? `age ${o.age}` : "garbage"}
            >
              {live ? o.age : "×"}
            </span>
          );
        })}
        {Array.from({ length: Math.max(0, cap - objs.length) }, (_, i) => (
          <span key={`e${i}`} className="h-7 w-7 rounded-md border border-dashed border-line" />
        ))}
      </div>
    </div>
  );
}
