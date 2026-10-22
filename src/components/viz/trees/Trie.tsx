"use client";

import { useMemo, useState } from "react";
import { C, Narration, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

interface TrieNode {
  id: number;
  ch: string;
  end: boolean;
  kids: Record<string, number>;
}

type Trie = Record<number, TrieNode>;

interface Frame {
  trie: Trie;
  hi: Record<number, string>;
  msg: string;
  found?: string[];
}

const clone = (t: Trie): Trie => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { ...v, kids: { ...v.kids } }]));

function build(words: string[]): Trie {
  const t: Trie = { 0: { id: 0, ch: "", end: false, kids: {} } };
  let id = 1;
  for (const w of words) {
    let cur = 0;
    for (const ch of w) {
      if (t[cur].kids[ch] === undefined) {
        t[id] = { id, ch, end: false, kids: {} };
        t[cur].kids[ch] = id++;
      }
      cur = t[cur].kids[ch];
    }
    t[cur].end = true;
  }
  return t;
}

function collect(t: Trie, id: number, prefix: string, out: string[]) {
  if (t[id].end) out.push(prefix);
  for (const ch of Object.keys(t[id].kids).sort()) collect(t, t[id].kids[ch], prefix + ch, out);
}

const SEED = ["car", "card", "care", "cat", "dog", "dot", "do"];

export default function TrieViz() {
  const [trie, setTrie] = useState<Trie>(() => build(SEED));
  const [word, setWord] = useState("cart");
  const [frames, setFrames] = useState<Frame[]>(() => [{ trie: build(SEED), hi: {}, msg: "A trie (prefix tree): each edge is a character; a green ring marks the end of a word. Shared prefixes share nodes." }]);
  const s = useStepper(frames, 600, true);

  function run(op: "insert" | "search" | "prefix") {
    const w = word.trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 10);
    if (!w) return;
    const t = clone(trie);
    const fr: Frame[] = [];
    let cur = 0;
    const path: number[] = [0];
    let nextId = Math.max(...Object.keys(t).map(Number)) + 1;
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      const child = t[cur].kids[ch];
      if (child === undefined) {
        if (op === "insert") {
          t[nextId] = { id: nextId, ch, end: false, kids: {} };
          t[cur].kids[ch] = nextId;
          cur = nextId++;
          path.push(cur);
          fr.push({ trie: clone(t), hi: { ...Object.fromEntries(path.map((p) => [p, C.compare])), [cur]: C.active }, msg: `No '${ch}' child — create a node for it.` });
          continue;
        }
        fr.push({ trie: clone(t), hi: Object.fromEntries(path.map((p) => [p, C.bad])), msg: `No edge for '${ch}' after "${w.slice(0, i)}" → "${w}" is ${op === "prefix" ? "not a prefix of any word" : "not in the trie"}.` });
        setFrames(fr);
        return;
      }
      cur = child;
      path.push(cur);
      fr.push({ trie: clone(t), hi: { ...Object.fromEntries(path.map((p) => [p, C.compare])), [cur]: C.active }, msg: `Follow '${ch}'.` });
    }
    if (op === "insert") {
      t[cur].end = true;
      fr.push({ trie: clone(t), hi: Object.fromEntries(path.map((p) => [p, C.done])), msg: `Mark the last node as end-of-word. Insert is O(L) for a word of length L — independent of how many words are stored.` });
      setTrie(t);
    } else if (op === "search") {
      fr.push({
        trie: clone(t),
        hi: Object.fromEntries(path.map((p) => [p, t[cur].end ? C.done : C.compare])),
        msg: t[cur].end ? `"${w}" found and its last node is marked end-of-word ✓` : `The path exists but the node isn't marked end-of-word, so "${w}" is only a prefix, not a stored word.`,
      });
    } else {
      const found: string[] = [];
      collect(t, cur, w, found);
      const sub: number[] = [];
      const walk = (id: number) => {
        sub.push(id);
        Object.values(t[id].kids).forEach(walk);
      };
      walk(cur);
      fr.push({ trie: clone(t), hi: { ...Object.fromEntries(sub.map((p) => [p, C.pivot])), ...Object.fromEntries(path.map((p) => [p, C.done])) }, found, msg: `Autocomplete: DFS the subtree under "${w}" → ${found.length} word(s).` });
    }
    setFrames(fr);
  }

  const f = s.frame;
  const { pos, W, H } = useMemo(() => {
    const pos: Record<number, { x: number; y: number }> = {};
    let leaf = 0;
    let maxD = 0;
    const place = (id: number, d: number): number => {
      maxD = Math.max(maxD, d);
      const kids = Object.keys(f.trie[id].kids).sort().map((ch) => f.trie[id].kids[ch]);
      if (!kids.length) {
        pos[id] = { x: leaf++, y: d };
        return pos[id].x;
      }
      const xs = kids.map((k) => place(k, d + 1));
      pos[id] = { x: (xs[0] + xs[xs.length - 1]) / 2, y: d };
      return pos[id].x;
    };
    place(0, 0);
    return { pos, W: Math.max(420, leaf * 46 + 40), H: (maxD + 1) * 56 + 30 };
  }, [f.trie]);
  const X = (id: number) => 30 + pos[id].x * 46;
  const Y = (id: number) => 24 + pos[id].y * 56;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={word} onChange={setWord} width="w-28" onEnter={() => run("insert")} />
        <SmallBtn tone="primary" onClick={() => run("insert")}>insert</SmallBtn>
        <SmallBtn onClick={() => run("search")}>search word</SmallBtn>
        <SmallBtn tone="good" onClick={() => run("prefix")}>autocomplete prefix</SmallBtn>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] scrollbar-thin">
        <svg width={W} height={H} className="block">
          {Object.values(f.trie).flatMap((n) =>
            Object.values(n.kids).map((k) => (
              <line key={`${n.id}-${k}`} x1={X(n.id)} y1={Y(n.id)} x2={X(k)} y2={Y(k)} stroke={f.hi[k] ?? C.base} strokeWidth={f.hi[k] ? 2.5 : 1.5} />
            )),
          )}
          {Object.values(f.trie).map((n) => {
            const color = f.hi[n.id];
            return (
              <g key={n.id}>
                <circle cx={X(n.id)} cy={Y(n.id)} r={15} fill={color ? `${color}2e` : C.baseFill} stroke={color ?? C.base} strokeWidth={2} />
                {n.end && <circle cx={X(n.id)} cy={Y(n.id)} r={19} fill="none" stroke={C.done} strokeWidth={1.5} strokeDasharray="3 2" />}
                <text x={X(n.id)} y={Y(n.id) + 4.5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={color ?? C.text} fontFamily="monospace">
                  {n.id === 0 ? "•" : n.ch}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {f.found && (
        <div className="flex flex-wrap gap-1.5">
          {f.found.map((w) => (
            <span key={w} className="rounded-md border border-violet/40 bg-violet/10 px-2 py-1 font-mono text-xs text-violet">
              {w}
            </span>
          ))}
        </div>
      )}
      <Narration>{f.msg}</Narration>
      <StepControls s={s} />
    </div>
  );
}
