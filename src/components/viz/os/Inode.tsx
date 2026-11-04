"use client";

import { useState } from "react";
import { C, Narration, SmallBtn, Stat } from "../kit";

// A tiny Unix file system: one directory, an inode table, and 24 disk blocks of 1 KiB.
// Inodes have 4 direct block pointers and 1 single-indirect pointer.
interface INode {
  ino: number;
  type: "dir" | "file" | "symlink";
  links: number;
  size: number; // KiB for files, bytes of the path for symlinks
  direct: number[];
  indirect: number | null;
  more: number[]; // block numbers stored inside the indirect block
  target?: string;
  color: string;
}
interface FS {
  dir: { name: string; ino: number }[];
  inodes: Record<number, INode>;
  blocks: (number | null)[]; // owning inode of each block
  nextIno: number;
  counters: { file: number; hard: number; soft: number };
}
const BLOCKS = 24;
const DIRECT = 4;
const PALETTE = [C.active, C.pivot, C.compare, C.swap, C.lime, C.sky, C.orange];

function start(): FS {
  const blocks: (number | null)[] = Array(BLOCKS).fill(null);
  blocks[0] = 2;
  [3, 4].forEach((b) => (blocks[b] = 12));
  [5, 6, 9].forEach((b) => (blocks[b] = 13));
  return {
    dir: [
      { name: "notes.txt", ino: 12 },
      { name: "photo.png", ino: 13 },
    ],
    inodes: {
      2: { ino: 2, type: "dir", links: 2, size: 1, direct: [0], indirect: null, more: [], color: C.muted },
      12: { ino: 12, type: "file", links: 1, size: 2, direct: [3, 4], indirect: null, more: [], color: PALETTE[0] },
      13: { ino: 13, type: "file", links: 1, size: 3, direct: [5, 6, 9], indirect: null, more: [], color: PALETTE[1] },
    },
    blocks,
    nextIno: 14,
    counters: { file: 1, hard: 1, soft: 1 },
  };
}

const clone = (f: FS): FS => ({
  dir: f.dir.map((d) => ({ ...d })),
  inodes: Object.fromEntries(Object.entries(f.inodes).map(([k, v]) => [k, { ...v, direct: [...v.direct], more: [...v.more] }])),
  blocks: [...f.blocks],
  nextIno: f.nextIno,
  counters: { ...f.counters },
});

export default function Inode() {
  const [fs, setFs] = useState<FS>(start);
  const [sel, setSel] = useState("notes.txt");
  const [hot, setHot] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "good" | "bad" | "warn" }>({
    text: "A directory with two files. Click a name to select it, then try the buttons. Notice the names live in the directory, and everything else lives in the inode.",
    tone: "info",
  });
  const entry = fs.dir.find((d) => d.name === sel);
  const freeBlocks = fs.blocks.filter((b) => b === null).length;

  const say = (text: string, tone: "info" | "good" | "bad" | "warn" = "info", blocks: number[] = []) => {
    setMsg({ text, tone });
    setHot(blocks);
  };
  // follow a symlink (one level) to the inode it names
  const resolve = (f: FS, name: string): INode | null => {
    const e = f.dir.find((d) => d.name === name);
    if (!e) return null;
    const n = f.inodes[e.ino];
    return n.type === "symlink" ? resolve(f, n.target!) : n;
  };

  const touch = () => {
    if (fs.dir.length >= 8) return say("The directory's single block is full (8 entries here). Remove something first.", "warn");
    const f = clone(fs);
    const name = `file${f.counters.file++}.txt`;
    const ino = f.nextIno++;
    f.inodes[ino] = { ino, type: "file", links: 1, size: 0, direct: [], indirect: null, more: [], color: PALETTE[(ino - 12) % PALETTE.length] };
    f.dir.push({ name, ino });
    setFs(f);
    setSel(name);
    say(`touch ${name}: the kernel allocates a free inode (#${ino}) with size 0 and NO data blocks, then adds the entry "${name} → ${ino}" to the directory's data block.`, "good", [0]);
  };

  const append = () => {
    if (!entry) return;
    const f = clone(fs);
    const target = resolve(f, sel);
    if (!target) return say(`${sel} is a symlink to a name that no longer exists, so there's nothing to write to: "No such file or directory".`, "bad");
    const via = f.inodes[entry.ino].type === "symlink" ? ` (${sel} is a symlink, so the kernel follows it to inode #${target.ino})` : "";
    const need = target.direct.length < DIRECT || target.indirect !== null ? 1 : 2;
    const free = f.blocks.map((b, i) => (b === null ? i : -1)).filter((i) => i >= 0);
    if (free.length < need) return say("The disk is full: no free blocks left. rm something to free its blocks.", "bad");
    let text: string;
    let touched: number[];
    if (target.direct.length < DIRECT) {
      const b = free[0];
      f.blocks[b] = target.ino;
      target.direct.push(b);
      text = `Append 1 KiB${via}: find a free block in the bitmap (block ${b}), write the data there, and store "${b}" in direct pointer ${target.direct.length} of inode #${target.ino}.`;
      touched = [b];
    } else {
      if (target.indirect === null) {
        target.indirect = free[0];
        f.blocks[free[0]] = target.ino;
        free.shift();
        text = `All ${DIRECT} direct pointers are used${via}! The kernel allocates an INDIRECT block (${target.indirect}) that holds a list of more block numbers, then a data block (${free[0]}) whose number goes into that list.`;
      } else {
        text = `Append 1 KiB${via}: the direct pointers are full, so the new block's number (${free[0]}) is added to the list inside indirect block ${target.indirect}. Reading this part of the file costs one extra block read.`;
      }
      f.blocks[free[0]] = target.ino;
      target.more.push(free[0]);
      touched = [target.indirect, free[0]];
    }
    target.size += 1;
    setFs(f);
    say(text, "good", touched);
  };

  const hardLink = () => {
    if (!entry) return;
    if (fs.dir.length >= 8) return say("The directory is full. Remove something first.", "warn");
    const f = clone(fs);
    const k = f.counters.hard++;
    const name = k === 1 ? "backup" : `backup${k}`;
    f.dir.push({ name, ino: entry.ino });
    f.inodes[entry.ino].links++;
    setFs(f);
    say(`ln ${sel} ${name}: just a new directory entry "${name} → ${entry.ino}". No data is copied, no new inode. Inode #${entry.ino} now has ${f.inodes[entry.ino].links} links, and both names are equally "the file".`, "good", [0]);
  };

  const symLink = () => {
    if (!entry) return;
    if (fs.dir.length >= 8) return say("The directory is full. Remove something first.", "warn");
    const f = clone(fs);
    const k = f.counters.soft++;
    const name = k === 1 ? "shortcut" : `shortcut${k}`;
    const ino = f.nextIno++;
    f.inodes[ino] = { ino, type: "symlink", links: 1, size: sel.length, direct: [], indirect: null, more: [], target: sel, color: PALETTE[(ino - 12) % PALETTE.length] };
    f.dir.push({ name, ino });
    setFs(f);
    say(`ln -s ${sel} ${name}: a NEW inode (#${ino}) of type symlink whose content is just the text "${sel}" (${sel.length} bytes, small enough to live inside the inode). It points at a NAME, not at an inode.`, "good", [0]);
  };

  const rm = () => {
    if (!entry) return;
    const f = clone(fs);
    f.dir = f.dir.filter((d) => d.name !== sel);
    const n = f.inodes[entry.ino];
    n.links--;
    let text = `rm ${sel} calls unlink(): the entry is removed from the directory and inode #${n.ino}'s link count drops to ${n.links}.`;
    let freed: number[] = [];
    if (n.links === 0) {
      freed = [...n.direct, ...(n.indirect !== null ? [n.indirect] : []), ...n.more];
      freed.forEach((b) => (f.blocks[b] = null));
      delete f.inodes[n.ino];
      text += freed.length ? ` No names are left, so the inode and its ${freed.length} block${freed.length > 1 ? "s" : ""} (${freed.join(", ")}) are marked free. (The bytes stay on disk until overwritten!)` : " No names are left, so the inode is freed.";
    } else {
      text += " Other names still point here, so the data stays.";
    }
    const dangling = f.dir.filter((d) => f.inodes[d.ino].type === "symlink" && f.inodes[d.ino].target === sel).map((d) => d.name);
    if (dangling.length) text += ` ${dangling.join(" and ")} still contain${dangling.length === 1 ? "s" : ""} the path "${sel}", which now leads nowhere: dangling.`;
    setFs(f);
    setSel(f.dir[0]?.name ?? "");
    say(text, n.links === 0 ? "warn" : "info", freed);
  };

  const cat = () => {
    if (!entry) return;
    const n = fs.inodes[entry.ino];
    const t = resolve(fs, sel);
    if (!t) return say(`cat ${sel}: it's a symlink to "${n.target}", which doesn't exist any more. "No such file or directory".`, "bad");
    const blocks = [...t.direct, ...(t.indirect !== null ? [t.indirect] : []), ...t.more];
    const path = n.type === "symlink" ? `${sel} is a symlink: read its content ("${n.target}"), look that name up in the directory → inode #${t.ino}. ` : `Look up "${sel}" in the directory → inode #${t.ino}. `;
    say(
      t.size === 0 ? `${path}The inode says size 0: nothing to read.` : `${path}Read the inode, then blocks ${t.direct.join(", ")}${t.indirect !== null ? `, then indirect block ${t.indirect} to find ${t.more.join(", ")}` : ""}: ${t.size} KiB.`,
      "info",
      blocks,
    );
  };

  const live = Object.values(fs.inodes).filter((n) => n.type !== "dir");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SmallBtn onClick={touch}>touch (new file)</SmallBtn>
        <SmallBtn tone="primary" onClick={append} disabled={!entry}>
          append 1 KiB to {sel || "…"}
        </SmallBtn>
        <SmallBtn onClick={hardLink} disabled={!entry}>
          ln (hard link)
        </SmallBtn>
        <SmallBtn onClick={symLink} disabled={!entry}>
          ln -s (symlink)
        </SmallBtn>
        <SmallBtn onClick={cat} disabled={!entry}>
          cat
        </SmallBtn>
        <SmallBtn tone="danger" onClick={rm} disabled={!entry}>
          rm
        </SmallBtn>
        <SmallBtn
          onClick={() => {
            setFs(start());
            setSel("notes.txt");
            say("Back to the start.");
          }}
        >
          Reset
        </SmallBtn>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
        <div className="rounded-xl border-2 p-2.5" style={{ borderColor: C.base }}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">directory / (inode #2, block 0)</div>
          <div className="space-y-1 font-mono text-xs">
            {fs.dir.map((d) => {
              const n = fs.inodes[d.ino];
              return (
                <button
                  key={d.name}
                  onClick={() => setSel(d.name)}
                  className="flex w-full items-center justify-between rounded-md border px-2 py-1 text-left"
                  style={{ borderColor: d.name === sel ? C.text : C.dim, borderWidth: d.name === sel ? 2 : 1 }}
                >
                  <span className="truncate">
                    {d.name}
                    {n.type === "symlink" ? <span className="text-faint"> → {n.target}</span> : ""}
                  </span>
                  <span className="rounded px-1.5 font-bold text-white" style={{ background: n.color }}>
                    #{d.ino}
                  </span>
                </button>
              );
            })}
            {fs.dir.length === 0 && <div className="text-faint">(empty)</div>}
          </div>
        </div>

        <div className="rounded-xl border-2 p-2.5" style={{ borderColor: C.base }}>
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">inode table</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {live.map((n) => (
              <div key={n.ino} className="rounded-lg border-2 p-1.5 font-mono text-[11px]" style={{ borderColor: n.color }}>
                <div className="flex justify-between font-bold" style={{ color: n.color }}>
                  <span>inode #{n.ino}</span>
                  <span>{n.type}</span>
                </div>
                <div className="text-faint">
                  links {n.links} · {n.type === "symlink" ? `${n.size} B: "${n.target}"` : `${n.size} KiB`}
                </div>
                {n.type === "file" && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {Array.from({ length: DIRECT }, (_, i) => (
                      <span key={i} className="rounded border border-line px-1" style={{ color: n.direct[i] !== undefined ? C.text : C.faint }}>
                        {n.direct[i] ?? "·"}
                      </span>
                    ))}
                    <span className="rounded border border-dashed px-1" style={{ borderColor: C.base, color: n.indirect !== null ? C.text : C.faint }}>
                      ind {n.indirect ?? "·"}
                      {n.more.length ? ` → [${n.more.join(",")}]` : ""}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">disk blocks (1 KiB each)</div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
          {fs.blocks.map((owner, i) => {
            const n = owner !== null ? fs.inodes[owner] : null;
            const isInd = n && n.indirect === i;
            return (
              <div
                key={i}
                className="flex h-9 flex-col items-center justify-center rounded-md border font-mono text-[9px]"
                style={{
                  background: n ? (isInd ? `repeating-linear-gradient(45deg, ${n.color}55, ${n.color}55 3px, ${n.color}22 3px, ${n.color}22 6px)` : `${n.color}40`) : "transparent",
                  borderColor: hot.includes(i) ? C.text : n ? n.color : C.dim,
                  borderWidth: hot.includes(i) ? 2 : 1,
                }}
              >
                <span className="text-faint">{i}</span>
                <span className="font-bold">{n ? (n.type === "dir" ? "dir" : isInd ? "ptrs" : `#${n.ino}`) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Narration tone={msg.tone}>{msg.text}</Narration>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="names" value={fs.dir.length} />
        <Stat label="inodes in use" value={Object.keys(fs.inodes).length} color={C.active} />
        <Stat label="free blocks" value={`${freeBlocks} / ${BLOCKS}`} color={C.done} />
      </div>
    </div>
  );
}
