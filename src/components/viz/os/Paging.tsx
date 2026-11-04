"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

// Address translation lab: 16-bit virtual addresses = 4-bit page number + 12-bit offset (4 KiB pages).
// Each access walks: split -> TLB -> page table -> (page fault?) -> permission check -> physical address.
interface PTE {
  kind: "code" | "data" | "heap" | "stack" | "none";
  present: boolean;
  frame: number | null;
  writable: boolean;
  onDisk: boolean; // not present, but its contents are in swap
}
interface Sim {
  pt: PTE[];
  frames: (number | "B" | null)[]; // which of our pages is in each frame; "B" = another process
  tlb: { vpn: number; frame: number }[]; // most recently used last
  clock: number; // for picking a victim frame
  lastUse: number[]; // per frame
}
type Hl = "split" | "tlb" | "pt" | "fault" | "perm" | "phys";
interface Frame {
  sim: Sim;
  hl: Hl;
  vpn: number;
  offset: number;
  frame: number | null;
  tlbHit: boolean | null;
  note: string;
  tone: "info" | "good" | "bad" | "warn";
}

const KIND_COLOR: Record<PTE["kind"], string> = { code: C.active, data: C.lime, heap: C.pivot, stack: C.compare, none: C.dim };
const hex = (n: number, w = 4) => "0x" + n.toString(16).toUpperCase().padStart(w, "0");
const TLB_SIZE = 4;

function start(): Sim {
  const pt: PTE[] = Array.from({ length: 16 }, () => ({ kind: "none" as const, present: false, frame: null, writable: false, onDisk: false }));
  pt[0] = { kind: "code", present: true, frame: 3, writable: false, onDisk: false };
  pt[1] = { kind: "code", present: true, frame: 6, writable: false, onDisk: false };
  pt[2] = { kind: "data", present: true, frame: 1, writable: true, onDisk: false };
  pt[3] = { kind: "data", present: false, frame: null, writable: true, onDisk: true };
  pt[4] = { kind: "heap", present: true, frame: 0, writable: true, onDisk: false };
  pt[14] = { kind: "stack", present: false, frame: null, writable: true, onDisk: false };
  pt[15] = { kind: "stack", present: true, frame: 5, writable: true, onDisk: false };
  return { pt, frames: [4, 2, null, 0, "B", 15, 1, null], tlb: [], clock: 0, lastUse: [1, 2, 0, 3, 0, 4, 5, 0] };
}

const clone = (s: Sim): Sim => ({ pt: s.pt.map((p) => ({ ...p })), frames: [...s.frames], tlb: s.tlb.map((t) => ({ ...t })), clock: s.clock, lastUse: [...s.lastUse] });

function access(prev: Sim, vaddr: number, write: boolean): { frames: Frame[]; next: Sim } {
  const s = clone(prev);
  const vpn = (vaddr >> 12) & 0xf;
  const offset = vaddr & 0xfff;
  const out: Frame[] = [];
  const push = (hl: Hl, note: string, tone: Frame["tone"] = "info", frame: number | null = null, tlbHit: boolean | null = null) =>
    out.push({ sim: clone(s), hl, vpn, offset, frame, tlbHit, note, tone });
  s.clock++;
  const verb = write ? "write" : "read";
  push("split", `The program wants to ${verb} ${hex(vaddr)}. The MMU splits it: the top 4 bits are the page number (${vpn}), the low 12 bits are the offset inside the page (${hex(offset, 3)}).`);

  const hit = s.tlb.find((t) => t.vpn === vpn);
  let frame: number;
  if (hit) {
    frame = hit.frame;
    s.tlb = [...s.tlb.filter((t) => t.vpn !== vpn), hit];
    push("tlb", `TLB HIT: page ${vpn} → frame ${frame}, found in one cycle. No page-table walk needed.`, "good", frame, true);
  } else {
    push("tlb", `TLB MISS: page ${vpn} isn't in the TLB, so the MMU walks the page table in memory (slow: extra memory reads).`, "warn", null, false);
    const e = s.pt[vpn];
    if (e.kind === "none") {
      push("pt", `Page table entry ${vpn} is INVALID: nothing is mapped there. The CPU raises a page fault, the kernel finds no mapping and sends SIGSEGV. Segmentation fault!`, "bad");
      return { frames: out, next: prev };
    }
    if (!e.present) {
      push("pt", `Entry ${vpn} exists but the PRESENT bit is 0. Page fault! The CPU stops the instruction and jumps into the kernel.`, "warn");
      // find a frame: a free one, or evict the least recently used of our pages
      let f = s.frames.findIndex((x) => x === null);
      let evictNote = "";
      if (f < 0) {
        const ours = s.frames.map((x, i) => ({ x, i })).filter(({ x }) => typeof x === "number");
        f = ours.sort((a, b) => s.lastUse[a.i] - s.lastUse[b.i])[0].i;
        const victim = s.frames[f] as number;
        s.pt[victim] = { ...s.pt[victim], present: false, frame: null, onDisk: true };
        s.tlb = s.tlb.filter((t) => t.vpn !== victim);
        evictNote = ` No free frame, so the kernel evicts page ${victim} (least recently used) from frame ${f}${s.pt[victim].writable ? ", writing it to swap" : ""}.`;
      }
      const major = e.onDisk;
      s.frames[f] = vpn;
      s.pt[vpn] = { ...e, present: true, frame: f, onDisk: false };
      push(
        "fault",
        major
          ? `MAJOR fault: page ${vpn} was swapped out to disk.${evictNote} The process sleeps while the disk reads it into frame ${f} (milliseconds), then the entry is marked present.`
          : `MINOR fault: page ${vpn} is new stack memory that was never touched (demand paging).${evictNote} The kernel zero-fills frame ${f} and maps it. Microseconds, no disk.`,
        major ? "warn" : "info",
        f,
      );
    }
    frame = s.pt[vpn].frame!;
    push("pt", `Page table entry ${vpn}: present, frame ${frame}, ${s.pt[vpn].writable ? "writable" : "READ-ONLY"}. The MMU caches this translation in the TLB.`, "info", frame);
    if (s.tlb.length >= TLB_SIZE) s.tlb.shift();
    s.tlb.push({ vpn, frame });
  }
  if (write && !s.pt[vpn].writable) {
    push("perm", `Permission check: this is a WRITE, but page ${vpn} (${s.pt[vpn].kind}) is read-only. Protection fault → SIGSEGV. That's how the OS stops programs from overwriting their own code.`, "bad", frame);
    return { frames: out, next: s };
  }
  s.lastUse[frame] = s.clock;
  const phys = (frame << 12) | offset;
  push("phys", `Physical address = frame ${frame} × 4096 + offset ${hex(offset, 3)} = ${hex(phys)}. The ${verb} goes to RAM (through the caches). The program never sees this number.`, "good", frame);
  return { frames: out, next: s };
}

const PRESETS: { label: string; addr: number; write: boolean }[] = [
  { label: "read code 0x0A10", addr: 0x0a10, write: false },
  { label: "read 0x0A14 (same page)", addr: 0x0a14, write: false },
  { label: "write data 0x2004", addr: 0x2004, write: true },
  { label: "read swapped 0x3100", addr: 0x3100, write: false },
  { label: "write new stack 0xE0F0", addr: 0xe0f0, write: true },
  { label: "write to code 0x0010", addr: 0x0010, write: true },
  { label: "read 0x9000 (unmapped)", addr: 0x9000, write: false },
];

export default function Paging() {
  const [sim, setSim] = useState<Sim>(start);
  const [run, setRun] = useState<{ frames: Frame[] } | null>(null);
  const [text, setText] = useState("0x4ABC");
  const [mode, setMode] = useState<"read" | "write">("read");
  const intro = useMemo<Frame[]>(
    () => [
      {
        sim: start(),
        hl: "split",
        vpn: -1,
        offset: 0,
        frame: null,
        tlbHit: null,
        note: "This process has 16 virtual pages of 4 KiB and the machine has 8 physical frames. Pick an access below and step through what the MMU and the kernel do.",
        tone: "info",
      },
    ],
    [],
  );
  const frames = run?.frames ?? intro;
  const s = useStepper(frames, 1300, run !== null);
  const f = s.frame;
  const v = f.sim;

  const go = (addr: number, write: boolean) => {
    const r = access(sim, addr, write);
    setSim(r.next);
    setRun({ frames: r.frames });
  };
  const parsed = Number.parseInt(text.trim().replace(/^0x/i, ""), 16);
  const valid = /^(0x)?[0-9a-f]{1,4}$/i.test(text.trim()) && parsed >= 0 && parsed <= 0xffff;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <SmallBtn key={p.label} onClick={() => go(p.addr, p.write)}>
            {p.label}
          </SmallBtn>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <TextInput value={text} onChange={setText} placeholder="0x4ABC" width="w-28" onEnter={() => valid && go(parsed, mode === "write")} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "read", label: "read" },
            { value: "write", label: "write" },
          ]}
        />
        <SmallBtn tone="primary" disabled={!valid} onClick={() => go(parsed, mode === "write")}>
          Access it
        </SmallBtn>
        <SmallBtn
          tone="danger"
          onClick={() => {
            setSim(start());
            setRun(null);
          }}
        >
          Reset
        </SmallBtn>
      </div>

      {f.vpn >= 0 && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <span className="text-faint">virtual</span>
          <span className="rounded-md px-2 py-1 font-bold text-white" style={{ background: f.hl === "split" ? C.pivot : C.active }}>
            page {f.vpn.toString(16).toUpperCase()}
          </span>
          <span className="rounded-md border-2 px-2 py-1" style={{ borderColor: C.lime }}>
            offset {f.offset.toString(16).toUpperCase().padStart(3, "0")}
          </span>
          {f.frame !== null && (
            <>
              <span className="text-faint">→ physical</span>
              <span className="rounded-md px-2 py-1 font-bold text-white" style={{ background: f.hl === "phys" ? C.done : C.base }}>
                frame {f.frame}
              </span>
              <span className="rounded-md border-2 px-2 py-1" style={{ borderColor: C.lime }}>
                offset {f.offset.toString(16).toUpperCase().padStart(3, "0")}
              </span>
            </>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1fr]">
        <div className="rounded-xl border-2 p-2.5" style={{ borderColor: f.hl === "tlb" ? (f.tlbHit ? C.done : C.compare) : C.dim }}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">TLB ({TLB_SIZE} entries)</div>
          <div className="space-y-1 font-mono text-xs">
            {Array.from({ length: TLB_SIZE }, (_, i) => v.tlb[i]).map((t, i) => (
              <div key={i} className="flex justify-between rounded border border-line px-2 py-0.5" style={{ background: t && t.vpn === f.vpn && f.hl === "tlb" && f.tlbHit ? `${C.done}22` : undefined }}>
                <span>{t ? `page ${t.vpn.toString(16).toUpperCase()}` : "–"}</span>
                <span className="text-faint">{t ? `frame ${t.frame}` : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-faint">Bottom = most recently used. A full TLB drops the oldest.</div>
        </div>

        <div className="rounded-xl border-2 p-2.5" style={{ borderColor: f.hl === "pt" || f.hl === "fault" ? C.compare : C.dim }}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Page table (in RAM)</div>
          <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
            {v.pt.map((e, i) => {
              const hot = i === f.vpn && (f.hl === "pt" || f.hl === "fault" || f.hl === "perm");
              return (
                <div
                  key={i}
                  className="rounded border px-1 py-0.5"
                  style={{ borderColor: hot ? C.text : `${KIND_COLOR[e.kind]}88`, borderWidth: hot ? 2 : 1, background: e.kind === "none" ? "transparent" : `${KIND_COLOR[e.kind]}14` }}
                >
                  <div className="flex justify-between">
                    <b>{i.toString(16).toUpperCase()}</b>
                    <span style={{ color: KIND_COLOR[e.kind] }}>{e.kind === "none" ? "" : e.kind}</span>
                  </div>
                  <div className="text-faint">
                    {e.kind === "none" ? "invalid" : e.present ? `F${e.frame} ${e.writable ? "RW" : "R"}` : e.onDisk ? "on disk" : "not yet"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border-2 p-2.5" style={{ borderColor: f.hl === "phys" ? C.done : C.dim }}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Physical RAM (8 frames)</div>
          <div className="space-y-1 font-mono text-xs">
            {v.frames.map((x, i) => (
              <div
                key={i}
                className="flex justify-between rounded border px-2 py-0.5"
                style={{
                  borderColor: i === f.frame ? C.text : C.dim,
                  borderWidth: i === f.frame ? 2 : 1,
                  background: typeof x === "number" ? `${KIND_COLOR[v.pt[x].kind]}1c` : x === "B" ? "#94a3b822" : undefined,
                }}
              >
                <span className="text-faint">frame {i}</span>
                <span>{x === null ? "free" : x === "B" ? "process B" : `page ${x.toString(16).toUpperCase()}`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Narration tone={f.tone}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
