"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { C, Narration, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

const CAP = 8;

interface Ring {
  slots: (number | null)[];
  head: number;
  tail: number;
  size: number;
}

interface BracketFrame {
  i: number;
  stack: string[];
  msg: string;
  tone: "info" | "good" | "bad";
}

const PAIRS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function bracketFrames(input: string): BracketFrame[] {
  const fr: BracketFrame[] = [{ i: -1, stack: [], msg: "Scan left to right. Push every opener; every closer must match the opener on top of the stack.", tone: "info" }];
  const st: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if ("([{".includes(ch)) {
      st.push(ch);
      fr.push({ i, stack: [...st], msg: `'${ch}' is an opener → push it.`, tone: "info" });
    } else if (PAIRS[ch]) {
      const top = st[st.length - 1];
      if (top === PAIRS[ch]) {
        st.pop();
        fr.push({ i, stack: [...st], msg: `'${ch}' matches top '${top}' → pop.`, tone: "good" });
      } else {
        fr.push({ i, stack: [...st], msg: top ? `'${ch}' does not match top '${top}' → INVALID.` : `'${ch}' but the stack is empty → INVALID.`, tone: "bad" });
        return fr;
      }
    } else {
      fr.push({ i, stack: [...st], msg: `'${ch}' is not a bracket, skip.`, tone: "info" });
    }
  }
  fr.push(
    st.length
      ? { i: input.length, stack: [...st], msg: `End of input but ${st.length} opener(s) never closed → INVALID.`, tone: "bad" }
      : { i: input.length, stack: [], msg: "End of input and the stack is empty → VALID. O(n) time, O(n) space.", tone: "good" },
  );
  return fr;
}

export default function StackQueue() {
  const [stack, setStack] = useState<{ id: number; v: number }[]>([
    { id: 1, v: 3 },
    { id: 2, v: 1 },
    { id: 3, v: 4 },
  ]);
  const [q, setQ] = useState<Ring>({ slots: [5, 9, 2, null, null, null, null, null], head: 0, tail: 3, size: 3 });
  const [val, setVal] = useState("7");
  const [log, setLog] = useState("Stacks are LIFO: last in, first out. Queues are FIFO: first in, first out.");
  const [expr, setExpr] = useState("{[()()]}");
  const frames = useMemo(() => bracketFrames(expr.slice(0, 24)), [expr]);
  const s = useStepper(frames, 600);
  const v = Number(val) || 0;

  const push = () => {
    if (stack.length >= 7) return setLog("Stack overflow! (we capped this one at 7)");
    setStack((st) => [...st, { id: Date.now(), v }]);
    setLog(`push(${v}): placed on top. O(1).`);
  };
  const pop = () => {
    if (!stack.length) return setLog("Stack underflow: pop() on an empty stack.");
    setLog(`pop() → ${stack[stack.length - 1].v}: the most recent item leaves first. O(1).`);
    setStack((st) => st.slice(0, -1));
  };
  const enqueue = () => {
    if (q.size === CAP) return setLog("Queue full: the ring buffer has no free slot (a dynamic queue would resize).");
    const slots = [...q.slots];
    slots[q.tail] = v;
    setQ({ slots, head: q.head, tail: (q.tail + 1) % CAP, size: q.size + 1 });
    setLog(`enqueue(${v}) at index ${q.tail}; tail = (tail + 1) mod ${CAP} = ${(q.tail + 1) % CAP}. O(1).`);
  };
  const dequeue = () => {
    if (!q.size) return setLog("Queue empty.");
    const slots = [...q.slots];
    const out = slots[q.head];
    slots[q.head] = null;
    setQ({ slots, head: (q.head + 1) % CAP, tail: q.tail, size: q.size - 1 });
    setLog(`dequeue() → ${out} from index ${q.head}; head wraps around with mod ${CAP}. No shifting needed: O(1).`);
  };

  const f = s.frame;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-dim">value</span>
        <TextInput value={val} onChange={setVal} width="w-16" />
        <SmallBtn tone="primary" onClick={push}>stack.push</SmallBtn>
        <SmallBtn onClick={pop}>stack.pop</SmallBtn>
        <span className="mx-1 h-5 w-px bg-line-2" />
        <SmallBtn tone="primary" onClick={enqueue}>queue.enqueue</SmallBtn>
        <SmallBtn onClick={dequeue}>queue.dequeue</SmallBtn>
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
          <div className="mb-2 text-center text-[10px] uppercase tracking-wider text-faint">Stack (LIFO)</div>
          <div className="mx-auto flex h-[300px] w-28 flex-col-reverse gap-1.5 rounded-b-xl border-x-2 border-b-2 border-line-2 p-1.5">
            <AnimatePresence initial={false}>
              {stack.map((it, i) => (
                <motion.div
                  key={it.id}
                  initial={{ y: -60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -60, opacity: 0 }}
                  className="grid h-9 place-items-center rounded-md border font-mono text-sm font-semibold"
                  style={{
                    borderColor: i === stack.length - 1 ? C.active : C.base,
                    background: i === stack.length - 1 ? `${C.active}22` : C.baseFill,
                    color: i === stack.length - 1 ? C.active : C.text,
                  }}
                >
                  {it.v}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="mt-2 text-center font-mono text-[11px] text-active" style={{ color: C.active }}>
            ↑ top
          </div>
        </div>

        <div className="rounded-xl border border-line bg-[#f8fafd] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-faint">Queue (FIFO) as a circular buffer, capacity {CAP}</div>
          <div className="grid grid-cols-8 gap-1.5">
            {q.slots.map((x, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-4 font-mono text-[10px] font-bold" style={{ color: C.done }}>
                  {i === q.head && q.size > 0 ? "head" : ""}
                </div>
                <motion.div
                  layout
                  className="grid h-11 w-full place-items-center rounded-md border-2 font-mono text-sm font-semibold"
                  style={{ borderColor: x === null ? C.dim : C.base, borderStyle: x === null ? "dashed" : "solid", background: x === null ? "transparent" : C.baseFill }}
                >
                  {x ?? ""}
                </motion.div>
                <div className="font-mono text-[10px] text-faint">{i}</div>
                <div className="h-4 font-mono text-[10px] font-bold" style={{ color: C.compare }}>
                  {i === q.tail ? "tail" : ""}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-dim">
            head = next item to dequeue, tail = next free slot. Both indices move forward and wrap with modulo, so the array is reused like a ring.
          </p>
        </div>
      </div>
      <Narration>{log}</Narration>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink">Classic use: valid brackets</span>
          <TextInput value={expr} onChange={setExpr} width="w-48" />
        </div>
        <div className="mb-3 flex flex-wrap gap-1 font-mono text-lg">
          {expr
            .slice(0, 24)
            .split("")
            .map((ch, i) => (
              <span
                key={i}
                className="grid h-9 w-8 place-items-center rounded-md border"
                style={{
                  borderColor: i === f.i ? (f.tone === "bad" ? C.bad : C.compare) : i < f.i ? C.dim : C.base,
                  color: i === f.i ? (f.tone === "bad" ? C.bad : C.compare) : i < f.i ? C.faint : C.text,
                  background: i === f.i ? `${f.tone === "bad" ? C.bad : C.compare}1f` : "transparent",
                }}
              >
                {ch}
              </span>
            ))}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-faint">stack:</span>
          <div className="flex min-h-9 gap-1">
            {f.stack.map((ch, i) => (
              <span key={i} className="grid h-9 w-8 place-items-center rounded-md border font-mono" style={{ borderColor: i === f.stack.length - 1 ? C.active : C.base, color: C.text, background: C.baseFill }}>
                {ch}
              </span>
            ))}
            {!f.stack.length && <span className="self-center font-mono text-xs text-faint">empty</span>}
          </div>
        </div>
        <Narration tone={f.tone}>{f.msg}</Narration>
        <div className="mt-3">
          <StepControls s={s} />
        </div>
      </div>
    </div>
  );
}
