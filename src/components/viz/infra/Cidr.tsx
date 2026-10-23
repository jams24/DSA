"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Slider, SmallBtn, Stat, TextInput } from "../kit";

const PRESETS = ["10.0.0.0/16", "192.168.1.0/24", "172.31.0.0/16", "10.244.0.0/16", "10.0.5.77/20"];

const SPECIAL: { cidr: string; label: string }[] = [
  { cidr: "10.0.0.0/8", label: "Private (RFC 1918)" },
  { cidr: "172.16.0.0/12", label: "Private (RFC 1918)" },
  { cidr: "192.168.0.0/16", label: "Private (RFC 1918)" },
  { cidr: "100.64.0.0/10", label: "Carrier-grade NAT (RFC 6598)" },
  { cidr: "127.0.0.0/8", label: "Loopback" },
  { cidr: "169.254.0.0/16", label: "Link-local (cloud metadata lives at 169.254.169.254)" },
];

function parseIp(s: string): number | null {
  const parts = s.trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !(n >= 0 && n <= 255))) return null;
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

function parseCidr(s: string): { ip: number; prefix: number } | null {
  const m = s.trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if (!m) return null;
  const ip = parseIp(m[1]);
  const prefix = Number(m[2]);
  if (ip === null || prefix < 0 || prefix > 32) return null;
  return { ip, prefix };
}

const fmt = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const maskOf = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
const netOf = (ip: number, p: number) => (ip & maskOf(p)) >>> 0;

function classify(net: number, p: number) {
  for (const sp of SPECIAL) {
    const c = parseCidr(sp.cidr)!;
    if (p >= c.prefix && netOf(net, c.prefix) === c.ip) return { label: sp.label, private: true };
  }
  return { label: "Public, globally routable", private: false };
}

const SUBNET_NAMES = ["public-a", "public-b", "private-a", "private-b"];

export default function Cidr() {
  const [text, setText] = useState("10.0.0.0/16");
  const [split, setSplit] = useState("2");
  const [testText, setTestText] = useState("10.0.137.20");
  const parsed = parseCidr(text);
  const [last, setLast] = useState({ ip: parseIp("10.0.0.0")!, prefix: 16 });
  if (parsed && (parsed.ip !== last.ip || parsed.prefix !== last.prefix)) setLast(parsed);
  const { ip, prefix } = parsed ?? last;

  const mask = maskOf(prefix);
  const net = netOf(ip, prefix);
  const bcast = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const usable = prefix >= 31 ? (prefix === 31 ? 2 : 1) : total - 2;
  const kind = classify(net, prefix);
  const k = Math.min(Number(split), 30 - prefix);
  const childSize = 2 ** (32 - prefix - Math.max(k, 0));
  const children = k > 0 ? Array.from({ length: 2 ** k }, (_, i) => net + i * childSize) : [];
  const testIp = parseIp(testText);
  const inside = testIp !== null && netOf(testIp, prefix) === net;
  const bits = Array.from({ length: 32 }, (_, i) => (ip >>> (31 - i)) & 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={text} onChange={setText} width="w-44" placeholder="10.0.0.0/16" />
        {PRESETS.map((p) => (
          <SmallBtn key={p} onClick={() => setText(p)} tone={p === text ? "primary" : "default"}>
            {p}
          </SmallBtn>
        ))}
      </div>
      {!parsed && <p className="text-xs text-rose">Enter an address like 10.0.0.0/16 (showing the last valid one).</p>}
      <Slider label="Prefix length (network bits)" value={prefix} min={8} max={30} onChange={(v) => setText(`${fmt(ip)}/${v}`)} format={(v) => `/${v}`} />

      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-3">
        <div className="flex min-w-[520px] gap-2">
          {[0, 1, 2, 3].map((o) => (
            <div key={o} className="flex-1">
              <div className="mb-1 text-center font-mono text-xs text-dim">{(ip >>> (24 - o * 8)) & 255}</div>
              <div className="flex gap-0.5">
                {bits.slice(o * 8, o * 8 + 8).map((b, j) => {
                  const idx = o * 8 + j;
                  const isNet = idx < prefix;
                  return (
                    <div
                      key={j}
                      className="grid h-8 flex-1 place-items-center rounded font-mono text-xs font-semibold"
                      style={{ background: isNet ? `${C.active}22` : `${C.compare}1f`, color: isNet ? C.active : C.compare, boxShadow: idx === prefix - 1 ? `inset -2px 0 0 ${C.active}` : undefined }}
                    >
                      {b}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <span style={{ color: C.active }}>■ {prefix} network bits</span>
          <span style={{ color: C.compare }}>■ {32 - prefix} host bits</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="network" value={`${fmt(net)}/${prefix}`} />
        <Stat label="netmask" value={fmt(mask)} />
        <Stat label="addresses" value={total.toLocaleString()} color={C.active} />
        <Stat label="usable hosts" value={usable.toLocaleString()} color={C.done} />
        <Stat label="first host" value={prefix >= 31 ? fmt(net) : fmt(net + 1)} />
        <Stat label="last host" value={prefix >= 31 ? fmt(bcast) : fmt(bcast - 1)} />
        <Stat label="broadcast" value={fmt(bcast)} color={C.faint} />
        <Stat label="AWS usable" value={prefix <= 28 ? (total - 5).toLocaleString() : "n/a (min /28)"} color={C.compare} />
      </div>

      <Narration tone={ip !== net ? "warn" : kind.private ? "good" : "info"}>
        {ip !== net && (
          <>
            {fmt(ip)} has host bits set, so it isn&apos;t a network address. It belongs to <b>{fmt(net)}/{prefix}</b>.{" "}
          </>
        )}
        <b>{kind.label}.</b> Each extra prefix bit halves the block: /{prefix} holds {total.toLocaleString()} addresses, /{Math.min(prefix + 1, 32)} holds{" "}
        {(total / 2).toLocaleString()}. Clouds reserve some addresses per subnet (AWS: network, router, DNS, future use, broadcast = 5).
      </Narration>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-ink">Carve it into subnets</div>
          <Segmented
            value={split}
            onChange={setSplit}
            options={[
              { value: "1", label: "2" },
              { value: "2", label: "4" },
              { value: "3", label: "8" },
              { value: "4", label: "16" },
            ]}
          />
        </div>
        {k <= 0 ? (
          <p className="mt-3 text-sm text-dim">This block is too small to split further.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[460px] text-left font-mono text-xs">
              <thead className="text-faint">
                <tr>
                  <th className="py-1 font-medium">subnet</th>
                  <th className="py-1 font-medium">CIDR</th>
                  <th className="py-1 font-medium">range</th>
                  <th className="py-1 text-right font-medium">size</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c, i) => {
                  const hit = testIp !== null && netOf(testIp, prefix + k) === c;
                  return (
                    <tr key={c} className={clsx("border-t border-line", hit && "bg-emerald/[0.08]")}>
                      <td className="py-1.5 text-dim">{k === 2 ? SUBNET_NAMES[i] : `subnet-${i}`}</td>
                      <td className="py-1.5 font-semibold text-ink">
                        {fmt(c)}/{prefix + k}
                      </td>
                      <td className="py-1.5 text-dim">
                        {fmt(c)} – {fmt(c + childSize - 1)}
                      </td>
                      <td className="py-1.5 text-right text-dim">{childSize.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-dim">
          Is this IP inside?
          <TextInput value={testText} onChange={setTestText} width="w-36" />
          {testIp === null ? (
            <span className="text-rose">not an IPv4 address</span>
          ) : inside ? (
            <span className="font-semibold text-emerald">yes: (ip AND mask) = {fmt(net)}</span>
          ) : (
            <span className="font-semibold text-rose">
              no: (ip AND mask) = {fmt(netOf(testIp, prefix))} ≠ {fmt(net)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
