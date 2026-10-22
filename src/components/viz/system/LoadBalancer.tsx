"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, Segmented, Slider, SmallBtn, useSimLoop } from "../kit";

type Algo = "rr" | "wrr" | "least" | "random" | "iphash";

interface Server {
  name: string;
  speed: number;
  weight: number;
  up: boolean;
  served: number;
  failed: number;
}

interface Req {
  id: number;
  client: number;
  server: number;
  t0: number;
  proc: number;
  state: "travel" | "processing" | "failed";
}

const CLIENTS = [
  { ip: "203.0.113.7", y: 70 },
  { ip: "198.51.100.23", y: 165 },
  { ip: "192.0.2.91", y: 260 },
];
const SERVER_Y = [50, 130, 210, 290];
const LB = { x: 330, y: 165 };
const TRAVEL = 700;

const NOTES: Record<Algo, string> = {
  rr: "Round robin: each request goes to the next server in turn. Simple and fair — but it ignores that srv-3 is slow, so srv-3's queue grows.",
  wrr: "Weighted round robin: servers get turns in proportion to their weight (capacity). Good when you know server sizes up front.",
  least: "Least connections: send to the server with the fewest in-flight requests. Adapts automatically to slow servers and long requests.",
  random: "Random: surprisingly decent at scale, but short-term imbalance is visible. 'Power of two choices' (pick 2 at random, take the less loaded) fixes most of it.",
  iphash: "IP hash: the same client always lands on the same server (sticky sessions). Click a server to kill it and watch clients get remapped.",
};

function ipHash(ip: string) {
  let h = 0;
  for (const ch of ip) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

export default function LoadBalancer() {
  const [algo, setAlgo] = useState<Algo>("rr");
  const [rate, setRate] = useState(6);
  const [running, setRunning] = useState(false);
  const servers = useRef<Server[]>([
    { name: "srv-1", speed: 1.4, weight: 3, up: true, served: 0, failed: 0 },
    { name: "srv-2", speed: 1, weight: 2, up: true, served: 0, failed: 0 },
    { name: "srv-3", speed: 0.4, weight: 1, up: true, served: 0, failed: 0 },
    { name: "srv-4", speed: 1, weight: 2, up: true, served: 0, failed: 0 },
  ]);
  const reqs = useRef<Req[]>([]);
  const rr = useRef(0);
  const spawnAcc = useRef(0);
  const nextId = useRef(1);
  const now = useRef(0);
  const [, rerender] = useState(0);

  const active = (i: number) => reqs.current.filter((r) => r.server === i && r.state !== "failed").length;

  function pick(client: number): number {
    const s = servers.current;
    const up = s.map((x, i) => (x.up ? i : -1)).filter((i) => i >= 0);
    if (!up.length) return -1;
    if (algo === "rr") return up[rr.current++ % up.length];
    if (algo === "wrr") {
      const slots = up.flatMap((i) => Array(s[i].weight).fill(i));
      return slots[rr.current++ % slots.length];
    }
    if (algo === "least") return up.reduce((best, i) => (active(i) < active(best) ? i : best), up[0]);
    if (algo === "random") return up[Math.floor(Math.random() * up.length)];
    return up[ipHash(CLIENTS[client].ip) % up.length];
  }

  useSimLoop(running, (dt, t) => {
    now.current = t;
    spawnAcc.current += (dt / 1000) * rate;
    while (spawnAcc.current >= 1) {
      spawnAcc.current -= 1;
      const client = Math.floor(Math.random() * CLIENTS.length);
      const server = pick(client);
      if (server < 0) continue;
      const base = 1500 * (0.7 + Math.random() * 0.6);
      reqs.current.push({ id: nextId.current++, client, server, t0: t, proc: base / servers.current[server].speed, state: "travel" });
    }
    const keep: Req[] = [];
    for (const r of reqs.current) {
      const age = t - r.t0;
      if (r.state === "failed") {
        if (age < TRAVEL + 900) keep.push(r);
        continue;
      }
      if (!servers.current[r.server].up) {
        r.state = "failed";
        r.t0 = t - TRAVEL;
        servers.current[r.server].failed++;
        keep.push(r);
        continue;
      }
      if (age >= TRAVEL + r.proc) {
        servers.current[r.server].served++;
        continue;
      }
      r.state = age >= TRAVEL ? "processing" : "travel";
      keep.push(r);
    }
    reqs.current = keep;
  });

  function toggleServer(i: number) {
    servers.current[i].up = !servers.current[i].up;
    rerender((x) => x + 1);
  }

  function reset() {
    reqs.current = [];
    servers.current.forEach((s) => {
      s.served = 0;
      s.failed = 0;
      s.up = true;
    });
    rerender((x) => x + 1);
  }

  const t = now.current;
  const s = servers.current;
  const counts = s.map((_, i) => active(i));
  const maxActive = Math.max(4, ...counts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={algo}
          onChange={(a) => {
            setAlgo(a);
            rr.current = 0;
          }}
          options={[
            { value: "rr", label: "Round robin" },
            { value: "wrr", label: "Weighted RR" },
            { value: "least", label: "Least connections" },
            { value: "random", label: "Random" },
            { value: "iphash", label: "IP hash" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <div className="w-56">
          <Slider label="traffic (requests/sec)" value={rate} min={1} max={20} onChange={setRate} />
        </div>
        <SmallBtn onClick={reset}>reset</SmallBtn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#080c19] scrollbar-thin">
        <svg viewBox="0 0 760 340" className="block w-full min-w-[620px]">
          {CLIENTS.map((c, ci) => (
            <g key={ci}>
              <line x1={95} y1={c.y} x2={LB.x - 50} y2={LB.y} stroke="#26305a" strokeWidth={1.5} />
              <rect x={20} y={c.y - 22} width={76} height={44} rx={10} fill="#0f1529" stroke={C.sky} strokeOpacity={0.6} />
              <text x={58} y={c.y - 2} textAnchor="middle" fontSize="16">
                💻
              </text>
              <text x={58} y={c.y + 15} textAnchor="middle" fontSize="8.5" fill={C.muted} fontFamily="monospace">
                {c.ip}
              </text>
            </g>
          ))}
          {SERVER_Y.map((y, i) => (
            <line key={i} x1={LB.x + 50} y1={LB.y} x2={590} y2={y} stroke={s[i].up ? "#26305a" : "#3b1520"} strokeWidth={1.5} strokeDasharray={s[i].up ? undefined : "4 4"} />
          ))}
          <rect x={LB.x - 50} y={LB.y - 32} width={100} height={64} rx={14} fill="#1c1608" stroke={C.compare} strokeWidth={2} />
          <text x={LB.x} y={LB.y - 4} textAnchor="middle" fontSize="20">
            ⚖️
          </text>
          <text x={LB.x} y={LB.y + 18} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.text}>
            Load balancer
          </text>
          {SERVER_Y.map((y, i) => {
            const sv = s[i];
            return (
              <g key={sv.name} onClick={() => toggleServer(i)} className="cursor-pointer">
                <rect x={590} y={y - 28} width={150} height={56} rx={12} fill={sv.up ? "#141029" : "#2a0a12"} stroke={sv.up ? C.pivot : C.bad} strokeWidth={2} />
                <text x={606} y={y - 6} fontSize="12" fontWeight="600" fill={C.text}>
                  {sv.up ? "⚙️" : "💥"} {sv.name}
                </text>
                <text x={606} y={y + 10} fontSize="9.5" fill={C.muted}>
                  {sv.up ? `speed ${sv.speed}× · w${sv.weight}` : "DOWN (click to revive)"}
                </text>
                <text x={606} y={y + 22} fontSize="9.5" fill={C.done} fontFamily="monospace">
                  ✓{sv.served} {sv.failed ? `✗${sv.failed}` : ""}
                </text>
                <rect x={700} y={y - 18} width={30} height={36} rx={4} fill="#0b1020" stroke="#26305a" />
                <rect x={700} y={y + 18 - (36 * Math.min(counts[i], maxActive)) / maxActive} width={30} height={(36 * Math.min(counts[i], maxActive)) / maxActive} rx={4} fill={counts[i] > 6 ? C.bad : C.active} opacity={0.75} />
                <text x={715} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={C.text}>
                  {counts[i]}
                </text>
              </g>
            );
          })}
          {reqs.current.map((r) => {
            const age = t - r.t0;
            const c = CLIENTS[r.client];
            let x: number;
            let y: number;
            if (r.state === "failed") {
              x = 590;
              y = SERVER_Y[r.server];
              return (
                <text key={r.id} x={x - 12} y={y + 4} fontSize="12" fill={C.bad} opacity={Math.max(0, 1 - (age - TRAVEL) / 900)}>
                  ✗
                </text>
              );
            }
            if (age < TRAVEL / 2) {
              const p = age / (TRAVEL / 2);
              x = 96 + (LB.x - 50 - 96) * p;
              y = c.y + (LB.y - c.y) * p;
            } else if (age < TRAVEL) {
              const p = (age - TRAVEL / 2) / (TRAVEL / 2);
              x = LB.x + 50 + (590 - LB.x - 50) * p;
              y = LB.y + (SERVER_Y[r.server] - LB.y) * p;
            } else return null;
            const color = [C.sky, C.swap, C.lime][r.client];
            return <circle key={r.id} cx={x} cy={y} r={4.5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
          })}
        </svg>
      </div>
      <Narration>{NOTES[algo]}</Narration>
      <p className="text-xs text-faint">The bar next to each server is its number of in-flight requests. Click a server to take it down (health checks stop routing to it; its in-flight requests fail).</p>
    </div>
  );
}
