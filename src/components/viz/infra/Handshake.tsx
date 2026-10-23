"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, StepControls, useStepper } from "../kit";

type Proto = "h1" | "h2" | "h3" | "h3-0rtt";
type Lane = "c" | "d" | "s";
type Phase = "dns" | "tcp" | "tls" | "http";

interface Msg {
  from: Lane;
  to: Lane;
  label: string;
  phase: Phase;
  note: string;
  t0: number;
  t1: number;
}

const SERVER_MS = 30;
const RESOLVER_RTT = 20;

const PROTOS: { value: Proto; label: string }[] = [
  { value: "h1", label: "HTTP/1.1 + TLS 1.2" },
  { value: "h2", label: "HTTP/2 + TLS 1.3" },
  { value: "h3", label: "HTTP/3 (QUIC)" },
  { value: "h3-0rtt", label: "HTTP/3 0-RTT resume" },
];

const PHASE_COLOR: Record<Phase, string> = { dns: C.muted, tcp: C.sky, tls: C.pivot, http: C.done };
const PHASE_LABEL: Record<Phase, string> = { dns: "DNS", tcp: "TCP", tls: "TLS / QUIC handshake", http: "HTTP" };
const LANE_X: Record<Lane, number> = { c: 80, d: 300, s: 580 };

function build(proto: Proto, rtt: number, dnsCached: boolean): Msg[] {
  const half = rtt / 2;
  const out: Msg[] = [];
  let t = 0;
  const send = (from: Lane, to: Lane, label: string, phase: Phase, note: string, oneWay = half) => {
    out.push({ from, to, label, phase, note, t0: t, t1: t + oneWay });
    t += oneWay;
  };
  const think = () => {
    t += SERVER_MS;
  };

  if (!dnsCached) {
    send("c", "d", "A? shop.example.com", "dns", "Not in the browser or OS cache, so the stub resolver asks the recursive resolver (your ISP's, or 1.1.1.1 / 8.8.8.8), which is usually close by.", RESOLVER_RTT / 2);
    send("d", "c", "A 93.184.216.34 (TTL 300)", "dns", "The resolver answers from its cache. A cold resolver would first walk root → .com → example.com's authoritative servers, adding more round trips.", RESOLVER_RTT / 2);
  }

  if (proto === "h1" || proto === "h2") {
    send("c", "s", "SYN", "tcp", "TCP three-way handshake: the client picks an initial sequence number and asks to connect.");
    send("s", "c", "SYN-ACK", "tcp", "The server acknowledges and sends its own sequence number. One full round trip gone and no application data has moved yet.");
  }

  if (proto === "h1") {
    send("c", "s", "ACK + ClientHello", "tls", "The ACK completes TCP. The TLS 1.2 ClientHello (supported ciphers, a random nonce) goes right behind it.");
    send("s", "c", "ServerHello, Certificate, ServerHelloDone", "tls", "The server picks a cipher suite and sends its certificate chain. The client verifies it up to a trusted root CA.");
    send("c", "s", "ClientKeyExchange, ChangeCipherSpec, Finished", "tls", "ECDHE key exchange. Both sides can now derive the same session keys.");
    send("s", "c", "ChangeCipherSpec, Finished", "tls", "TLS 1.2 costs two round trips. Only now may the client send its request.");
    send("c", "s", "GET / HTTP/1.1", "http", "The actual request finally leaves, three round trips after the first SYN.");
    think();
    send("s", "c", "HTTP/1.1 200 OK", "http", "First byte. HTTP/1.1 allows one in-flight request per connection, so browsers open ~6 connections per host, and each one pays this setup cost.");
  } else if (proto === "h2") {
    send("c", "s", "ACK + ClientHello + key_share", "tls", "TLS 1.3 sends a key share in the first message, guessing the group (usually X25519), so it can finish in one round trip.");
    send("s", "c", "ServerHello + {Cert, CertVerify, Finished}", "tls", "The server returns its key share and everything else, already encrypted. Handshake complete after one round trip.");
    send("c", "s", "{Finished} + GET / (stream 1)", "http", "The client's Finished and the HTTP/2 request travel together. HTTP/2 multiplexes many requests as streams over this one connection.");
    think();
    send("s", "c", "HEADERS 200 + DATA", "http", "First byte after three round trips (TCP 1 + TLS 1 + HTTP 1). All streams share one TCP byte stream, so one lost packet stalls every stream (TCP head-of-line blocking).");
  } else if (proto === "h3") {
    send("c", "s", "Initial: ClientHello + key_share", "tls", "QUIC runs over UDP and merges the transport handshake with TLS 1.3, so there is no separate TCP round trip.");
    send("s", "c", "Initial + Handshake: ServerHello … Finished", "tls", "Connection and encryption are established together after one round trip.");
    send("c", "s", "Finished + GET / (stream 0)", "http", "The request goes out immediately. QUIC streams are independent: a lost packet only stalls its own stream.");
    think();
    send("s", "c", "HTTP/3 200 OK", "http", "First byte after two round trips. QUIC connections also survive network changes (Wi-Fi → 4G) because they're identified by connection IDs, not the IP/port 4-tuple.");
  } else {
    send("c", "s", "ClientHello (PSK) + 0-RTT: GET /", "http", "Resuming a recent session: the request is encrypted with a pre-shared key from last time and sent in the very first flight.");
    think();
    send("s", "c", "ServerHello … Finished + 200 OK", "http", "First byte after one round trip. Catch: an attacker can replay 0-RTT data, so servers only accept it for idempotent requests like GET.");
  }
  return out;
}

export default function Handshake() {
  const [proto, setProto] = useState<Proto>("h1");
  const [rtt, setRtt] = useState(100);
  const [dnsCached, setDnsCached] = useState(false);

  const msgs = build(proto, rtt, dnsCached);
  const frames = useMemo(() => build(proto, 100, dnsCached).map((_, i) => i), [proto, dnsCached]);
  const s = useStepper(frames, 1100);
  const cur = msgs[s.frame] ?? msgs[0];
  const total = msgs[msgs.length - 1].t1;

  const W = 660;
  const H = 400;
  const top = 50;
  const y = (t: number) => top + (t / total) * (H - top - 24);
  const tickStep = total > 500 ? 100 : total > 200 ? 50 : 25;

  const compare = PROTOS.map((p) => {
    const m = build(p.value, rtt, dnsCached);
    const end = m[m.length - 1].t1;
    const dns = dnsCached ? 0 : RESOLVER_RTT;
    return { ...p, end, rtts: Math.round((end - dns - SERVER_MS) / rtt) };
  });
  const maxEnd = Math.max(...compare.map((c) => c.end));

  return (
    <div className="space-y-4">
      <Segmented value={proto} onChange={setProto} options={PROTOS} />
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="Round-trip time to the server" value={rtt} min={10} max={300} step={10} onChange={setRtt} format={(v) => `${v} ms`} />
        <label className="flex items-center gap-2 pb-1 text-xs text-dim">
          <input type="checkbox" checked={dnsCached} onChange={(e) => setDnsCached(e.target.checked)} className="accent-[#0891b2]" />
          DNS answer already cached
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-[560px]">
          {(["c", "d", "s"] as Lane[]).map((l) => (
            <g key={l} opacity={l === "d" && dnsCached ? 0.35 : 1}>
              <text x={LANE_X[l]} y={22} textAnchor="middle" fontSize="12" fontWeight={600} fill={C.text}>
                {l === "c" ? "Browser" : l === "d" ? "DNS resolver" : "Server"}
              </text>
              <line x1={LANE_X[l]} x2={LANE_X[l]} y1={top - 14} y2={H - 16} stroke="#cbd5e1" strokeDasharray="4 4" />
            </g>
          ))}
          {Array.from({ length: Math.floor(total / tickStep) + 1 }, (_, k) => k * tickStep).map((t) => (
            <g key={t}>
              <line x1={30} x2={36} y1={y(t)} y2={y(t)} stroke={C.faint} />
              <text x={28} y={y(t) + 3} textAnchor="end" fontSize="9" fill={C.faint}>
                {t}
              </text>
            </g>
          ))}
          <text x={8} y={top - 20} fontSize="9" fill={C.faint}>
            ms
          </text>
          {msgs.slice(0, s.frame + 1).map((m, i) => {
            const x1 = LANE_X[m.from];
            const x2 = LANE_X[m.to];
            const y1 = y(m.t0);
            const y2 = y(m.t1);
            const col = PHASE_COLOR[m.phase];
            const active = i === s.frame;
            const dir = x2 > x1 ? 1 : -1;
            // nearly flat arrows (the DNS hop) would stack their labels, so put replies underneath
            const labelY = y2 - y1 < 18 && dir < 0 ? (y1 + y2) / 2 + 14 : (y1 + y2) / 2 - 5;
            return (
              <g key={i} opacity={active ? 1 : 0.75}>
                <line x1={x1} y1={y1} x2={x2 - dir * 6} y2={y2} stroke={col} strokeWidth={active ? 2.4 : 1.5} />
                <polygon points={`${x2},${y2} ${x2 - dir * 9},${y2 - 4} ${x2 - dir * 9},${y2 + 4}`} fill={col} />
                <text
                  x={(x1 + x2) / 2}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={active ? 700 : 500}
                  fill={col}
                  stroke="#f8fafd"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {m.label}
                </text>
              </g>
            );
          })}
          {s.atEnd && (
            <g>
              <line x1={40} x2={W - 20} y1={y(total)} y2={y(total)} stroke={C.done} strokeDasharray="5 4" />
              <text x={W - 22} y={y(total) - 6} textAnchor="end" fontSize="11" fontWeight={700} fill={C.done}>
                first byte at {Math.round(total)} ms
              </text>
            </g>
          )}
        </svg>
      </div>

      <StepControls s={s} />
      <Narration tone={s.atEnd ? "good" : "info"}>
        <span className="font-semibold" style={{ color: PHASE_COLOR[cur.phase] }}>
          {PHASE_LABEL[cur.phase]} · t = {Math.round(cur.t1)} ms.{" "}
        </span>
        {cur.note}
      </Narration>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-3 text-xs font-semibold tracking-wide text-faint uppercase">Time to first byte at {rtt} ms RTT</div>
        <div className="space-y-2">
          {compare.map((c) => (
            <button key={c.value} type="button" onClick={() => setProto(c.value)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-left text-xs sm:grid-cols-[150px_1fr_110px]">
              <span className={c.value === proto ? "font-semibold text-ink" : "text-dim"}>{c.label}</span>
              <span className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1">
                <span className="block h-full rounded-full" style={{ width: `${(c.end / maxEnd) * 100}%`, background: c.value === proto ? C.active : C.base }} />
              </span>
              <span className="text-right font-mono text-dim tabular-nums">
                {Math.round(c.end)} ms · {c.rtts} RTT
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
