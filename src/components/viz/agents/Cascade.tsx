"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Slider } from "../kit";

const SMALL_EASY = 0.94;
const LARGE_EASY = 0.97;
const LARGE_HARD = 0.88;
const FALSE_ESCALATION = 0.05;
const ROUTER_COST = 0.1; // a classifier call, in units of one small-model call

export default function Cascade() {
  const [easy, setEasy] = useState(0.7);
  const [smallHard, setSmallHard] = useState(0.45);
  const [router, setRouter] = useState(0.85);
  const [catchRate, setCatchRate] = useState(0.8);
  const [ratio, setRatio] = useState(20);
  const hard = 1 - easy;

  const cascadeClass = (s: number, L: number) => ({
    q: s * (1 - FALSE_ESCALATION) + s * FALSE_ESCALATION * L + (1 - s) * catchRate * L,
    esc: s * FALSE_ESCALATION + (1 - s) * catchRate,
  });
  const ce = cascadeClass(SMALL_EASY, LARGE_EASY);
  const ch = cascadeClass(smallHard, LARGE_HARD);

  const rows = [
    { name: "Always large", q: easy * LARGE_EASY + hard * LARGE_HARD, cost: ratio, color: C.pivot },
    { name: "Always small", q: easy * SMALL_EASY + hard * smallHard, cost: 1, color: C.sky },
    {
      name: "Router (classify, then pick)",
      q: easy * (router * SMALL_EASY + (1 - router) * LARGE_EASY) + hard * (router * LARGE_HARD + (1 - router) * smallHard),
      cost: easy * (router + (1 - router) * ratio) + hard * (router * ratio + (1 - router)) + ROUTER_COST,
      color: C.compare,
    },
    { name: "Cascade (small first, escalate)", q: easy * ce.q + hard * ch.q, cost: 1 + (easy * ce.esc + hard * ch.esc) * ratio, color: C.done },
  ];
  const large = rows[0];
  // cheapest strategy whose quality is within 2 points of always using the large model
  const best = rows.filter((r) => r.q >= large.q - 0.02).sort((a, b) => a.cost - b.cost)[0];

  const W = 640;
  const H = 220;
  const minQ = Math.min(...rows.map((r) => r.q)) - 0.03;
  const maxQ = Math.max(...rows.map((r) => r.q)) + 0.02;
  const x = (c: number) => 60 + (c / (ratio * 1.08)) * (W - 90);
  const y = (q: number) => H - 30 - ((q - minQ) / (maxQ - minQ)) * (H - 50);

  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Slider label="Easy share of traffic" value={easy} min={0} max={1} step={0.05} onChange={setEasy} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Small model accuracy on hard requests" value={smallHard} min={0.2} max={0.85} step={0.05} onChange={setSmallHard} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Router picks the right model" value={router} min={0.5} max={1} step={0.05} onChange={setRouter} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Cascade check catches small-model errors" value={catchRate} min={0} max={1} step={0.05} onChange={setCatchRate} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Large model price ÷ small model price" value={ratio} min={3} max={60} onChange={setRatio} format={(v) => `${v}×`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          <line x1={60} x2={W - 24} y1={H - 30} y2={H - 30} stroke="#cbd5e1" />
          <line x1={60} x2={60} y1={14} y2={H - 30} stroke="#cbd5e1" />
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={C.faint}>
            cost per request (× small-model call) →
          </text>
          <text x={14} y={H / 2} fontSize="10" fill={C.faint} transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">
            quality →
          </text>
          {rows.map((r) => (
            <g key={r.name}>
              <circle cx={x(r.cost)} cy={y(r.q)} r={8} fill={r.color} opacity={0.85} />
              <text x={x(r.cost) + (x(r.cost) > W - 200 ? -12 : 12)} y={y(r.q) + 4} textAnchor={x(r.cost) > W - 200 ? "end" : "start"} fontSize="10.5" fontWeight={600} fill={r.color}>
                {r.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">strategy</th>
              <th className="px-3 py-2 text-right font-medium">quality</th>
              <th className="px-3 py-2 text-right font-medium">cost vs always-large</th>
              <th className="px-3 py-2 text-right font-medium">vs always-large</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.name} className={clsx("border-t border-line", r === best && "bg-emerald/[0.06] font-semibold")}>
                <td className="px-3 py-1.5 font-sans" style={{ color: r.color }}>
                  {r.name}
                </td>
                <td className="px-3 py-1.5 text-right">{(r.q * 100).toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">{Math.round((r.cost / large.cost) * 100)}%</td>
                <td className="px-3 py-1.5 text-right">{r === large ? "–" : `${r.q >= large.q ? "+" : ""}${((r.q - large.q) * 100).toFixed(1)} pts`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Narration tone="info">
        Most production traffic is easy, so paying frontier prices for every request wastes money. A <b>router</b> classifies the request up front: cheap, but its mistakes send hard questions to the small model. A <b>cascade</b> always tries the small model and escalates when a check fails (a verifier, schema validation, tests, a confidence score). It needs a reliable check, and it pays double on escalations. Here the cheapest option within 2 points of always-large quality is <b>{best.name.toLowerCase()}</b> at {Math.round((best.cost / large.cost) * 100)}% of the cost. Validate any routing change with evals on real traffic, not intuition.
      </Narration>
    </div>
  );
}
