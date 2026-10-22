"use client";

import { useMemo } from "react";
import { C, Narration, Stat, StepControls, useStepper } from "../kit";

const BLOCKS = 48; // KV memory, in blocks of 16 tokens
const BLOCK = 16;
const MAX_LEN = 192; // tokens a contiguous allocator must reserve per request (max_seq_len)
const RESERVE = MAX_LEN / BLOCK;
const COLORS = ["#0891b2", "#7c3aed", "#db2777", "#65a30d", "#d97706", "#ea580c", "#059669", "#0284c7", "#e11d48", "#9333ea"];
const REQS = [
  { prompt: 30, out: 40 },
  { prompt: 20, out: 90 },
  { prompt: 50, out: 30 },
  { prompt: 12, out: 60 },
  { prompt: 40, out: 20 },
  { prompt: 25, out: 70 },
  { prompt: 18, out: 45 },
  { prompt: 35, out: 25 },
  { prompt: 22, out: 55 },
  { prompt: 28, out: 35 },
];
const STEP_TOKENS = 10; // tokens generated per request per frame (to keep frames short)

interface Mem {
  owner: (number | null)[];
  used: (number | null)[]; // tokens actually filled in that block
}
interface Frame {
  contiguous: Mem;
  paged: Mem;
  cRunning: number;
  pRunning: number;
  cDone: number;
  pDone: number;
  t: number;
}

function simulate(): Frame[] {
  const frames: Frame[] = [];
  type R = { id: number; len: number; target: number; blocks: number[] };
  const run = (mode: "c" | "p") => {
    const owner: (number | null)[] = Array(BLOCKS).fill(null);
    const used: (number | null)[] = Array(BLOCKS).fill(null);
    let queue = REQS.map((r, id) => ({ id, len: r.prompt, target: r.prompt + r.out, blocks: [] as number[] }));
    const active: R[] = [];
    let done = 0;
    const snaps: { mem: Mem; running: number; done: number }[] = [];
    const free = () => owner.map((o, i) => (o === null ? i : -1)).filter((i) => i >= 0);
    for (let t = 0; t < 40; t++) {
      // admit
      for (;;) {
        const r = queue[0];
        if (!r) break;
        if (mode === "c") {
          // need RESERVE contiguous free blocks
          let start = -1;
          for (let i = 0; i + RESERVE <= BLOCKS; i++) if (owner.slice(i, i + RESERVE).every((o) => o === null)) {
            start = i;
            break;
          }
          if (start < 0) break;
          r.blocks = Array.from({ length: RESERVE }, (_, k) => start + k);
        } else {
          const need = Math.ceil(r.len / BLOCK);
          const f = free();
          if (f.length < need + 1) break; // keep a block of headroom
          r.blocks = f.slice(0, need);
        }
        r.blocks.forEach((b) => (owner[b] = r.id));
        active.push(r);
        queue = queue.slice(1);
      }
      // record usage
      for (const r of active) {
        r.blocks.forEach((b, k) => {
          used[b] = Math.max(0, Math.min(BLOCK, r.len - k * BLOCK));
        });
      }
      snaps.push({ mem: { owner: [...owner], used: [...used] }, running: active.length, done });
      if (!queue.length && !active.length) break;
      // generate tokens, grow, finish
      for (const r of [...active]) {
        r.len = Math.min(r.target, r.len + STEP_TOKENS);
        if (mode === "p") {
          while (Math.ceil(r.len / BLOCK) > r.blocks.length) {
            const f = free();
            if (!f.length) break;
            owner[f[0]] = r.id;
            r.blocks.push(f[0]);
          }
        }
        if (r.len >= r.target) {
          r.blocks.forEach((b) => {
            owner[b] = null;
            used[b] = null;
          });
          active.splice(active.indexOf(r), 1);
          done++;
        }
      }
    }
    return snaps;
  };
  const c = run("c");
  const p = run("p");
  const n = Math.max(c.length, p.length);
  for (let t = 0; t < n; t++) {
    const cs = c[Math.min(t, c.length - 1)];
    const ps = p[Math.min(t, p.length - 1)];
    frames.push({ contiguous: cs.mem, paged: ps.mem, cRunning: cs.running, pRunning: ps.running, cDone: cs.done, pDone: ps.done, t });
  }
  return frames;
}

function Grid({ mem, title, color, running, done }: { mem: Mem; title: string; color: string; running: number; done: number }) {
  const reserved = mem.owner.filter((o) => o !== null).length;
  const filled = mem.used.reduce((a: number, u) => a + (u ?? 0), 0);
  return (
    <div className="space-y-2 rounded-xl border bg-[#f8fafd] p-3" style={{ borderColor: `${color}55` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-sm font-semibold" style={{ color }}>
          {title}
        </span>
        <span className="font-mono text-[11px] text-dim">
          running {running} · finished {done} · {reserved ? Math.round((filled / (reserved * BLOCK)) * 100) : 0}% of allocated memory holds real tokens
        </span>
      </div>
      <div className="relative grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
        {running === 0 && done === REQS.length && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-md bg-[#f8fafd]/70 font-display text-sm font-semibold text-emerald">✓ all {REQS.length} requests finished</div>
        )}
        {mem.owner.map((o, i) => {
          const u = mem.used[i] ?? 0;
          return (
            <div key={i} className="relative h-6 overflow-hidden rounded-[3px] border" style={{ borderColor: o === null ? "#e2e8f0" : `${COLORS[o]}88`, background: "#ffffff" }}>
              {o !== null && (
                <>
                  <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(251,113,133,.18) 3px,rgba(251,113,133,.18) 6px)" }} />
                  <div className="absolute inset-y-0 left-0" style={{ width: `${(u / BLOCK) * 100}%`, background: COLORS[o] }} />
                  <span className="absolute inset-0 grid place-items-center font-mono text-[8px] text-[#ffffff]">{u ? `R${o + 1}` : ""}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PagedKV() {
  const frames = useMemo(() => simulate(), []);
  const s = useStepper(frames, 700);
  const f = s.frame;
  return (
    <div className="space-y-4">
      <div className="text-xs text-dim">
        GPU KV-cache memory: {BLOCKS} blocks × {BLOCK} tokens. 10 requests arrive with different prompt and output lengths (unknown in advance). Hatched red = memory reserved but not holding tokens.
      </div>
      <Grid mem={f.contiguous} title={`Contiguous: reserve max_seq_len (${MAX_LEN} tokens) per request`} color={C.bad} running={f.cRunning} done={f.cDone} />
      <Grid mem={f.paged} title="PagedAttention: allocate 16-token blocks on demand" color={C.done} running={f.pRunning} done={f.pDone} />
      <StepControls s={s} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="contiguous: concurrent reqs" value={f.cRunning} color={C.bad} />
        <Stat label="paged: concurrent reqs" value={f.pRunning} color={C.done} />
        <Stat label="contiguous: finished" value={f.cDone} color={C.bad} />
        <Stat label="paged: finished" value={f.pDone} color={C.done} />
      </div>
      <Narration>
        Pre-allocating a contiguous region for the maximum length wastes most of it (internal fragmentation) and leaves unusable gaps (external fragmentation), so few requests fit. vLLM&apos;s PagedAttention stores the KV cache in fixed-size blocks mapped by a per-request block table — like virtual memory pages — so waste is under one block per sequence, batch sizes grow 2–4×, and identical prefixes (system prompts, beam search) can share blocks copy-on-write.
      </Narration>
    </div>
  );
}
