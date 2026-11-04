"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, SmallBtn, StepControls, TextInput, useStepper } from "../kit";

// Run a string through a DFA, one character per step: the current state, the edge taken,
// and accept or reject at the end. One table lookup per character, never any backtracking.
interface Edge {
  from: number;
  to: number;
  label: string;
  test: (ch: string) => boolean;
}
interface Machine {
  regex: string;
  states: { x: number; y: number }[];
  accept: number[];
  edges: Edge[];
  samples: string[];
  meaning: string[];
}

const letter = (ch: string) => /[a-z_]/i.test(ch);
const digit = (ch: string) => /[0-9]/.test(ch);

const MACHINES: Record<string, Machine> = {
  ident: {
    regex: "[a-z_][a-z0-9_]*",
    states: [
      { x: 150, y: 130 },
      { x: 420, y: 130 },
    ],
    accept: [1],
    edges: [
      { from: 0, to: 1, label: "letter or _", test: letter },
      { from: 1, to: 1, label: "letter, digit, _", test: (ch) => letter(ch) || digit(ch) },
    ],
    samples: ["count2", "x", "2fast", "snake_case", "a-b"],
    meaning: ["nothing read yet", "a valid name so far"],
  },
  number: {
    regex: "[0-9]+(\\.[0-9]+)?",
    states: [
      { x: 90, y: 130 },
      { x: 250, y: 130 },
      { x: 410, y: 130 },
      { x: 560, y: 130 },
    ],
    accept: [1, 3],
    edges: [
      { from: 0, to: 1, label: "digit", test: digit },
      { from: 1, to: 1, label: "digit", test: digit },
      { from: 1, to: 2, label: ".", test: (ch) => ch === "." },
      { from: 2, to: 3, label: "digit", test: digit },
      { from: 3, to: 3, label: "digit", test: digit },
    ],
    samples: ["3.14", "42", "7.", ".5", "1.2.3"],
    meaning: ["nothing read yet", "an integer", "digits and a dot: need a digit next", "a decimal number"],
  },
  abb: {
    regex: "(a|b)*abb",
    states: [
      { x: 90, y: 150 },
      { x: 250, y: 150 },
      { x: 410, y: 150 },
      { x: 570, y: 150 },
    ],
    accept: [3],
    edges: [
      { from: 0, to: 0, label: "b", test: (ch) => ch === "b" },
      { from: 0, to: 1, label: "a", test: (ch) => ch === "a" },
      { from: 1, to: 1, label: "a", test: (ch) => ch === "a" },
      { from: 1, to: 2, label: "b", test: (ch) => ch === "b" },
      { from: 2, to: 1, label: "a", test: (ch) => ch === "a" },
      { from: 2, to: 3, label: "b", test: (ch) => ch === "b" },
      { from: 3, to: 1, label: "a", test: (ch) => ch === "a" },
      { from: 3, to: 0, label: "b", test: (ch) => ch === "b" },
    ],
    samples: ["babb", "aabb", "abab", "abbabb", "abba"],
    meaning: ["no progress towards abb", "just seen a", "just seen ab", "just seen abb"],
  },
  mod3: {
    regex: "binary numbers divisible by 3",
    states: [
      { x: 130, y: 150 },
      { x: 330, y: 150 },
      { x: 530, y: 150 },
    ],
    accept: [0],
    edges: [0, 1, 2].flatMap((r) =>
      [0, 1].map((b) => ({ from: r, to: (2 * r + b) % 3, label: String(b), test: (ch: string) => ch === String(b) })),
    ),
    samples: ["110", "1001", "111", "10010", "101"],
    meaning: ["remainder 0", "remainder 1", "remainder 2"],
  },
};
const OPTIONS = [
  { value: "ident", label: "Identifiers" },
  { value: "number", label: "Numbers" },
  { value: "abb", label: "(a|b)*abb" },
  { value: "mod3", label: "Divisible by 3" },
];

interface Frame {
  i: number; // characters read
  state: number | null; // null = stuck (no edge)
  edge: number | null;
}

function run(m: Machine, input: string): Frame[] {
  const frames: Frame[] = [{ i: 0, state: 0, edge: null }];
  let q: number | null = 0;
  for (let i = 0; i < input.length && q !== null; i++) {
    const e = m.edges.findIndex((x) => x.from === q && x.test(input[i]));
    q = e < 0 ? null : m.edges[e].to;
    frames.push({ i: i + 1, state: q, edge: e < 0 ? null : e });
  }
  return frames;
}

const R = 26;

function EdgePath({ m, e, active }: { m: Machine; e: Edge; active: boolean }) {
  const a = m.states[e.from];
  const b = m.states[e.to];
  const color = active ? C.active : C.base;
  const w = active ? 3 : 1.6;
  if (e.from === e.to) {
    const p = `M ${a.x - 12} ${a.y - R + 4} C ${a.x - 34} ${a.y - 80}, ${a.x + 34} ${a.y - 80}, ${a.x + 12} ${a.y - R + 4}`;
    return (
      <g>
        <path d={p} fill="none" stroke={color} strokeWidth={w} markerEnd={`url(#dfa-arrow-${active ? "on" : "off"})`} />
        <text x={a.x} y={a.y - 72} fontSize={11} textAnchor="middle" fill={active ? C.active : C.muted} fontWeight={active ? 700 : 400}>
          {e.label}
        </text>
      </g>
    );
  }
  // curve every edge to one side, so a pair of opposite edges never overlaps
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const span = Math.abs(e.to - e.from);
  // long backward edges go underneath, at different depths, so they never cross the forward ones
  const bend = (span === 1 ? 28 : span === 2 ? 84 : 130) * (e.to < e.from && span > 1 ? -1 : 1);
  const cx = (a.x + b.x) / 2 + nx * bend;
  const cy = (a.y + b.y) / 2 + ny * bend;
  const start = { x: a.x + ((cx - a.x) / Math.hypot(cx - a.x, cy - a.y)) * R, y: a.y + ((cy - a.y) / Math.hypot(cx - a.x, cy - a.y)) * R };
  const end = { x: b.x + ((cx - b.x) / Math.hypot(cx - b.x, cy - b.y)) * (R + 3), y: b.y + ((cy - b.y) / Math.hypot(cx - b.x, cy - b.y)) * (R + 3) };
  return (
    <g>
      <path
        d={`M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`}
        fill="none"
        stroke={color}
        strokeWidth={w}
        markerEnd={`url(#dfa-arrow-${active ? "on" : "off"})`}
      />
      <text
        x={(a.x + b.x) / 4 + cx / 2}
        y={(a.y + b.y) / 4 + cy / 2 + (bend * ny > 0 ? 12 : -5)}
        fontSize={11}
        textAnchor="middle"
        fill={active ? C.active : C.muted}
        fontWeight={active ? 700 : 400}
      >
        {e.label}
      </text>
    </g>
  );
}

export default function Automata() {
  const [which, setWhich] = useState("abb");
  const m = MACHINES[which];
  const [input, setInput] = useState(MACHINES.abb.samples[0]);
  const text = input.slice(0, 24);
  const frames = useMemo(() => run(m, text), [m, text]);
  const s = useStepper(frames, 700);
  const f = s.frame;
  const finished = s.atEnd && (f.i === text.length || f.state === null);
  const accepted = finished && f.state !== null && m.accept.includes(f.state);
  const prev = s.i > 0 ? frames[s.i - 1].state : null;

  const pick = (v: string) => {
    setWhich(v);
    setInput(MACHINES[v].samples[0]);
  };

  let msg: string;
  if (s.i === 0) msg = `This DFA recognises ${m.regex}. It starts in q0 (${m.meaning[0]}). Each step reads one character and follows exactly one edge.`;
  else if (f.state === null) msg = `In q${prev}, read "${text[f.i - 1]}": there's no edge for it. The DFA is stuck, so the input is rejected right away.`;
  else msg = `In q${prev}, read "${text[f.i - 1]}": follow the edge to q${f.state} (${m.meaning[f.state]}).`;
  if (finished && f.state !== null)
    msg += accepted
      ? ` The input is used up and q${f.state} is an accepting state: ACCEPT.`
      : ` The input is used up, but q${f.state} isn't accepting: REJECT.`;

  return (
    <div className="space-y-4" style={{ fontVariantLigatures: "none" }}>
      <Segmented value={which} onChange={pick} options={OPTIONS} />
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={input} onChange={setInput} width="w-48" placeholder="input string" />
        {m.samples.map((x) => (
          <SmallBtn key={x} onClick={() => setInput(x)}>
            {x}
          </SmallBtn>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <svg viewBox="0 0 660 250" className="w-full min-w-[520px]">
          <defs>
            {(["on", "off"] as const).map((k) => (
              <marker key={k} id={`dfa-arrow-${k}`} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={k === "on" ? C.active : C.base} />
              </marker>
            ))}
          </defs>
          <line x1={m.states[0].x - 70} y1={m.states[0].y} x2={m.states[0].x - R - 4} y2={m.states[0].y} stroke={C.muted} strokeWidth={1.6} markerEnd="url(#dfa-arrow-off)" />
          <text x={m.states[0].x - 72} y={m.states[0].y - 8} fontSize={10} fill={C.faint}>
            start
          </text>
          {m.edges.map((e, i) => (
            <EdgePath key={i} m={m} e={e} active={f.edge === i} />
          ))}
          {m.states.map((p, q) => {
            const here = f.state === q;
            const fill = here ? (finished ? (accepted ? C.done : C.bad) : C.active) : "#ffffff";
            return (
              <g key={q}>
                <circle cx={p.x} cy={p.y} r={R} fill={fill} stroke={here ? fill : C.base} strokeWidth={2} />
                {m.accept.includes(q) && <circle cx={p.x} cy={p.y} r={R - 5} fill="none" stroke={here ? "#ffffff" : C.base} strokeWidth={1.6} />}
                <text x={p.x} y={p.y + 4} fontSize={13} textAnchor="middle" fontWeight={600} fill={here ? "#ffffff" : C.text}>
                  q{q}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-1 font-mono text-base">
        {[...text].map((ch, i) => (
          <span
            key={i}
            className="inline-flex h-9 w-8 items-center justify-center rounded-lg border"
            style={{
              borderColor: i === f.i - 1 ? C.active : C.dim,
              background: i < f.i ? (i === f.i - 1 ? `${C.active}22` : "#f1f5f9") : "#ffffff",
              color: i < f.i ? C.text : C.faint,
            }}
          >
            {ch}
          </span>
        ))}
        {text.length === 0 && <span className="text-sm text-faint">(empty string)</span>}
      </div>

      <Narration tone={finished ? (accepted ? "good" : "bad") : "info"}>{msg}</Narration>
      <StepControls s={s} />
      <p className="text-xs text-faint">
        Double circles are accepting states. However long the input, a DFA does one lookup per character: O(n) time, with no backtracking, which is why
        lexers and safe regex engines (RE2, Rust&apos;s regex) compile patterns into automata.
      </p>
    </div>
  );
}
