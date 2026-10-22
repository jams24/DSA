"use client";

import { useState } from "react";
import { C, Narration, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

interface LL {
  order: number[]; // display order (left → right)
  vals: Record<number, number>;
  links: Record<number, number | null>;
  head: number | null;
}

interface Frame extends LL {
  ptrs: Record<string, number | null>;
  hi: Record<number, string>;
  msg: string;
}

let nextId = 100;

function fromValues(vals: number[]): LL {
  const ids = vals.map(() => nextId++);
  return {
    order: ids,
    vals: Object.fromEntries(ids.map((id, i) => [id, vals[i]])),
    links: Object.fromEntries(ids.map((id, i) => [id, ids[i + 1] ?? null])),
    head: ids[0] ?? null,
  };
}

function normalize(l: LL): LL {
  const order: number[] = [];
  for (let c = l.head; c !== null && order.length < 50; c = l.links[c]) order.push(c);
  return { ...l, order };
}

const clone = (l: LL): LL => ({ order: [...l.order], vals: { ...l.vals }, links: { ...l.links }, head: l.head });

const NODE_W = 76;
const GAP = 44;
const X0 = 30;

export default function LinkedList() {
  const [list, setList] = useState<LL>(() => fromValues([4, 8, 15, 16]));
  const [val, setVal] = useState("23");
  const [idx, setIdx] = useState("2");
  const [frames, setFrames] = useState<Frame[]>(() => [{ ...fromValues([4, 8, 15, 16]), ptrs: {}, hi: {}, msg: "A singly linked list: each node stores a value and a pointer to the next node." }]);
  const s = useStepper(frames, 750, true);

  function run(op: "head" | "tail" | "at" | "delete" | "reverse") {
    const l = clone(list);
    const fr: Frame[] = [];
    const push = (ptrs: Record<string, number | null>, hi: Record<number, string>, msg: string) =>
      fr.push({ ...clone(l), ptrs: { head: l.head, ...ptrs }, hi, msg });
    const v = Number(val);

    if (op === "head" || (op === "at" && Number(idx) <= 0) || (op === "tail" && l.head === null)) {
      if (!Number.isFinite(v)) return;
      const id = nextId++;
      l.vals[id] = v;
      l.links[id] = null;
      l.order = [id, ...l.order];
      push({ new: id }, { [id]: C.active }, `Create a node holding ${v}.`);
      l.links[id] = l.head;
      push({ new: id }, { [id]: C.active }, "Point new.next at the current head.");
      l.head = id;
      push({}, { [id]: C.done }, "Move head to the new node. No traversal: O(1).");
    } else if (op === "tail" || op === "at") {
      if (!Number.isFinite(v)) return;
      const target = op === "tail" ? Infinity : Number(idx);
      let curr = l.head!;
      let pos = 0;
      push({ curr }, { [curr]: C.compare }, op === "tail" ? "Without a tail pointer we must walk to the last node." : `Walk to node ${target - 1} (the node before the insertion point).`);
      while (l.links[curr] !== null && pos < target - 1) {
        curr = l.links[curr]!;
        pos++;
        push({ curr }, { [curr]: C.compare }, `curr = curr.next (position ${pos}).`);
      }
      const id = nextId++;
      l.vals[id] = v;
      l.links[id] = null;
      const at = l.order.indexOf(curr) + 1;
      l.order.splice(at, 0, id);
      push({ curr, new: id }, { [curr]: C.compare, [id]: C.active }, `Create node ${v}.`);
      l.links[id] = l.links[curr];
      push({ curr, new: id }, { [curr]: C.compare, [id]: C.active }, "new.next = curr.next (so we don't lose the rest of the list).");
      l.links[curr] = id;
      push({ curr }, { [id]: C.done }, `curr.next = new. The walk was O(n); the relinking itself is O(1).`);
    } else if (op === "delete") {
      if (!Number.isFinite(v) || l.head === null) return;
      let prev: number | null = null;
      let curr: number | null = l.head;
      while (curr !== null && l.vals[curr] !== v) {
        push({ prev, curr }, { [curr]: C.compare }, `${l.vals[curr]} ≠ ${v}, keep walking.`);
        prev = curr;
        curr = l.links[curr];
      }
      if (curr === null) {
        push({ prev }, {}, `Reached null: ${v} is not in the list.`);
      } else {
        push({ prev, curr }, { [curr]: C.bad }, `Found ${v}.`);
        if (prev === null) {
          l.head = l.links[curr];
          push({ curr }, { [curr]: C.bad }, "It's the head: move head to head.next.");
        } else {
          l.links[prev] = l.links[curr];
          push({ prev, curr }, { [curr]: C.bad, [prev]: C.active }, "prev.next = curr.next — the node is now unreachable.");
        }
        l.order = l.order.filter((x) => x !== curr);
        delete l.links[curr];
        push({}, {}, "The garbage collector (or free()) reclaims the orphaned node.");
      }
    } else if (op === "reverse") {
      let prev: number | null = null;
      let curr: number | null = l.head;
      push({ prev, curr }, {}, "Reverse in place with three pointers: prev = null, curr = head.");
      while (curr !== null) {
        const nxt: number | null = l.links[curr];
        push({ prev, curr, next: nxt }, { [curr]: C.compare }, "Save next = curr.next before we overwrite it.");
        l.links[curr] = prev;
        push({ prev, curr, next: nxt }, { [curr]: C.swap }, "Flip the arrow: curr.next = prev.");
        prev = curr;
        curr = nxt;
        push({ prev, curr }, { ...(prev !== null ? { [prev]: C.done } : {}) }, "Advance: prev = curr, curr = next.");
      }
      l.head = prev;
      push({}, {}, "curr is null, so prev is the new head. O(n) time, O(1) extra space.");
    }

    setList(normalize(l));
    setFrames(fr);
  }

  const f = s.frame;
  const width = Math.max(1, f.order.length) * (NODE_W + GAP) + X0 * 2;
  const xOf = (id: number) => X0 + f.order.indexOf(id) * (NODE_W + GAP);
  const ptrLabels: Record<number, string[]> = {};
  for (const [name, id] of Object.entries(f.ptrs)) if (id !== null && id !== undefined && name !== "head") (ptrLabels[id] ??= []).push(name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">value</span>
        <TextInput value={val} onChange={setVal} width="w-16" />
        <span className="text-xs text-dim">index</span>
        <TextInput value={idx} onChange={setIdx} width="w-14" />
        <SmallBtn tone="primary" onClick={() => run("head")}>insert head</SmallBtn>
        <SmallBtn onClick={() => run("tail")}>insert tail</SmallBtn>
        <SmallBtn onClick={() => run("at")}>insert at index</SmallBtn>
        <SmallBtn tone="danger" onClick={() => run("delete")}>delete value</SmallBtn>
        <SmallBtn tone="good" onClick={() => run("reverse")}>reverse</SmallBtn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
        <svg width={width} height={190} className="block">
          <defs>
            <marker id="ll-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.muted} />
            </marker>
          </defs>
          {f.order.map((id) => {
            const to = f.links[id];
            const x = xOf(id);
            if (to === null || to === undefined) {
              return (
                <text key={`n${id}`} x={x + NODE_W + 8} y={84} fill={C.faint} fontSize="12" fontFamily="monospace">
                  ∅
                </text>
              );
            }
            const tx = xOf(to);
            if (tx > x) {
              return <line key={`e${id}`} x1={x + NODE_W - 12} y1={80} x2={tx - 2} y2={80} stroke={C.muted} strokeWidth={1.8} markerEnd="url(#ll-arrow)" />;
            }
            const mid = (x + tx + NODE_W) / 2;
            return (
              <path
                key={`e${id}`}
                d={`M${x + 20} 100 Q ${mid} 150 ${tx + NODE_W / 2} 102`}
                fill="none"
                stroke={C.swap}
                strokeWidth={1.8}
                markerEnd="url(#ll-arrow)"
              />
            );
          })}
          {f.head !== null && f.order.includes(f.head) && (
            <g>
              <text x={xOf(f.head) + NODE_W / 2} y={30} fill={C.active} fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                head
              </text>
              <line x1={xOf(f.head) + NODE_W / 2} y1={36} x2={xOf(f.head) + NODE_W / 2} y2={56} stroke={C.active} strokeWidth={1.8} markerEnd="url(#ll-arrow)" />
            </g>
          )}
          {f.order.map((id) => {
            const x = xOf(id);
            const color = f.hi[id];
            return (
              <g key={id} style={{ transition: "transform 0.4s" }}>
                <rect x={x} y={60} width={NODE_W} height={40} rx={9} fill={color ? `${color}22` : C.baseFill} stroke={color ?? C.base} strokeWidth={2} />
                <line x1={x + NODE_W - 22} y1={60} x2={x + NODE_W - 22} y2={100} stroke={color ?? C.base} strokeWidth={1.5} />
                <circle cx={x + NODE_W - 11} cy={80} r={3} fill={C.muted} />
                <text x={x + (NODE_W - 22) / 2} y={85} textAnchor="middle" fill={color ?? C.text} fontSize="15" fontWeight="bold" fontFamily="monospace">
                  {f.vals[id]}
                </text>
                {(ptrLabels[id] ?? []).map((name, k) => (
                  <text key={name} x={x + NODE_W / 2} y={124 + k * 14} textAnchor="middle" fill={name === "curr" ? C.compare : name === "prev" ? C.done : name === "new" ? C.active : C.swap} fontSize="11" fontFamily="monospace" fontWeight="bold">
                    ↑ {name}
                  </text>
                ))}
              </g>
            );
          })}
          {f.order.length === 0 && (
            <text x={30} y={85} fill={C.faint} fontSize="13">
              head → ∅ (empty list)
            </text>
          )}
        </svg>
      </div>
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
