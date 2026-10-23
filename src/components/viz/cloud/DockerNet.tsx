"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type El = "internet" | "eth0" | "nat" | "bridge" | "vethA" | "vethB" | "a" | "b" | "dns" | "vol";
type Mode = "inbound" | "dns" | "outbound" | "host" | "volume";

interface Frame {
  on: El[];
  note: string;
  packet?: string;
  tone?: "info" | "good" | "bad" | "warn";
}

const SCEN: Record<Mode, { label: string; table: [string, string][]; frames: Frame[] }> = {
  inbound: {
    label: "-p 8080:80 (inbound)",
    table: [
      ["DNAT", "tcp dpt:8080 → 172.18.0.2:80"],
      ["FORWARD", "ACCEPT to br-app for published ports"],
      ["MASQUERADE", "172.18.0.0/16 out eth0"],
    ],
    frames: [
      { on: ["internet"], note: "A client on the internet sends a request to the host's IP on port 8080. Nothing in the container listens on the host; port 8080 exists only as a NAT rule.", packet: "203.0.113.7:51544 → 192.168.1.10:8080" },
      { on: ["internet", "eth0"], note: "The packet arrives on the host's eth0. Before routing, it passes the iptables nat PREROUTING chain, which jumps to Docker's DOCKER chain.", packet: "203.0.113.7:51544 → 192.168.1.10:8080" },
      { on: ["eth0", "nat"], note: "The DNAT rule created by -p 8080:80 rewrites the destination to the container's IP and port. conntrack remembers the mapping so the reply can be rewritten back.", packet: "203.0.113.7:51544 → 172.18.0.2:80", tone: "warn" },
      { on: ["nat", "bridge"], note: "The routing table says 172.18.0.0/16 lives on the br-app bridge, so the kernel forwards the packet there. The bridge acts like a virtual switch.", packet: "203.0.113.7:51544 → 172.18.0.2:80" },
      { on: ["bridge", "vethA"], note: "The bridge sends it out the host end of container A's veth pair. A veth pair is a virtual cable: what goes in one end comes out the other.", packet: "203.0.113.7:51544 → 172.18.0.2:80" },
      { on: ["vethA", "a"], note: "It comes out as eth0 inside container A's network namespace, where nginx listens on :80. The reply goes back the same way and conntrack rewrites the source to 192.168.1.10:8080.", packet: "203.0.113.7:51544 → 172.18.0.2:80", tone: "good" },
      { on: ["a"], note: "Common bug: the app listens on 127.0.0.1 instead of 0.0.0.0. Inside a container, localhost is the container's own loopback, so traffic arriving on eth0 is refused. Always bind to 0.0.0.0 in containers.", tone: "bad" },
    ],
  },
  dns: {
    label: "container → container",
    table: [
      ["DNS 127.0.0.11", "api → 172.18.0.3 (service name)"],
      ["DNS 127.0.0.11", "db → 172.18.0.4"],
      ["default bridge", "no DNS: names don't resolve"],
    ],
    frames: [
      { on: ["a"], note: "Container A (web) calls http://api:3000. On a user-defined network (what Compose creates), the name api is resolvable. On the legacy default bridge it is not.", packet: "GET http://api:3000/users" },
      { on: ["a", "dns"], note: "A's /etc/resolv.conf points to 127.0.0.11, Docker's embedded DNS server. It answers names of containers and Compose services on the same network, and forwards anything else to the host's resolvers.", packet: "DNS query: api → ?" },
      { on: ["dns", "a"], note: "Answer: 172.18.0.3. If the service has several replicas, the embedded DNS returns all of their IPs (simple round robin).", packet: "api = 172.18.0.3", tone: "good" },
      { on: ["a", "vethA", "bridge"], note: "The packet leaves A's eth0 through the veth pair into the bridge. No NAT and no published port is involved: containers on the same network reach each other's container ports directly.", packet: "172.18.0.2:40112 → 172.18.0.3:3000" },
      { on: ["bridge", "vethB", "b"], note: "The bridge switches it to B's veth, and api receives it on port 3000. Publishing a port with -p is only for traffic from outside the host.", packet: "172.18.0.2:40112 → 172.18.0.3:3000", tone: "good" },
      { on: ["b"], note: "Isolation: containers on different user-defined networks cannot reach each other. Put the database on a backend network that only the api joins, and web cannot reach it at all.", tone: "info" },
    ],
  },
  outbound: {
    label: "container → internet",
    table: [
      ["route (in container)", "default via 172.18.0.1"],
      ["MASQUERADE", "src 172.18.0.0/16 → 192.168.1.10"],
      ["ip_forward", "net.ipv4.ip_forward = 1"],
    ],
    frames: [
      { on: ["b"], note: "The api container calls an external API. Its default route points to the bridge's gateway IP 172.18.0.1, which is the host.", packet: "172.18.0.3:38810 → 93.184.215.14:443" },
      { on: ["b", "vethB", "bridge"], note: "The packet crosses the veth pair into the bridge and reaches the host's network stack. IP forwarding must be enabled on the host (Docker turns it on).", packet: "172.18.0.3:38810 → 93.184.215.14:443" },
      { on: ["bridge", "nat"], note: "Private 172.18.x addresses aren't routable on the internet, so the POSTROUTING MASQUERADE rule rewrites the source to the host's IP (source NAT).", packet: "192.168.1.10:38810 → 93.184.215.14:443", tone: "warn" },
      { on: ["nat", "eth0", "internet"], note: "The packet leaves through eth0. Replies come back to the host, conntrack matches them and rewrites the destination back to 172.18.0.3.", packet: "192.168.1.10:38810 → 93.184.215.14:443", tone: "good" },
    ],
  },
  host: {
    label: "--network host",
    table: [
      ["network namespace", "shared with the host"],
      ["-p flags", "ignored"],
      ["port 80", "taken on the host itself"],
    ],
    frames: [
      { on: ["a"], note: "With --network host the container gets no network namespace of its own. It shares the host's interfaces, IPs and port space. No bridge, no veth, no NAT.", tone: "warn" },
      { on: ["internet", "eth0", "a"], note: "A request to 192.168.1.10:80 goes straight to the process. That is the fastest path (no NAT or bridge hops), useful for high-throughput proxies or monitoring agents.", packet: "203.0.113.7:51544 → 192.168.1.10:80", tone: "good" },
      { on: ["a"], note: "The costs: two containers cannot both listen on :80, -p is ignored, and the container can see every host interface. --network none is the opposite extreme: only a loopback, for jobs that need no network at all.", tone: "bad" },
    ],
  },
  volume: {
    label: "volumes & bind mounts",
    table: [
      ["named volume", "pgdata → /var/lib/postgresql/data"],
      ["bind mount", "./src → /app/src (dev only)"],
      ["tmpfs", "/tmp in memory"],
    ],
    frames: [
      { on: ["b"], note: "A container's writable layer is deleted with the container. A database that writes there loses everything on docker rm or on every redeploy.", tone: "bad" },
      { on: ["b", "vol"], note: "A named volume (-v pgdata:/var/lib/postgresql/data) is a directory managed by Docker under /var/lib/docker/volumes. It is mounted over that path and bypasses the overlay filesystem, so it is fast and survives the container.", tone: "good" },
      { on: ["a", "vol"], note: "A bind mount (-v ./src:/app/src) maps a host path into the container. Great for live-reload in development, but it ties the container to that host's file layout and UID/GID ownership.", tone: "info" },
      { on: ["vol"], note: "In production on Kubernetes, the same idea becomes a PersistentVolumeClaim backed by network storage, so the data can follow the pod to another node.", tone: "info" },
    ],
  },
};

const BOX: Record<El, { x: number; y: number; w: number; h: number; label: string; sub?: string }> = {
  internet: { x: 10, y: 20, w: 120, h: 50, label: "Internet", sub: "203.0.113.7" },
  eth0: { x: 170, y: 20, w: 130, h: 50, label: "host eth0", sub: "192.168.1.10" },
  nat: { x: 340, y: 20, w: 140, h: 50, label: "iptables / conntrack", sub: "DNAT · MASQUERADE" },
  dns: { x: 510, y: 20, w: 120, h: 50, label: "embedded DNS", sub: "127.0.0.11" },
  bridge: { x: 170, y: 120, w: 460, h: 40, label: "bridge br-app", sub: "172.18.0.1/16" },
  vethA: { x: 210, y: 180, w: 110, h: 26, label: "veth (A)" },
  vethB: { x: 460, y: 180, w: 110, h: 26, label: "veth (B)" },
  a: { x: 190, y: 230, w: 150, h: 56, label: "container A: web", sub: "eth0 172.18.0.2" },
  b: { x: 440, y: 230, w: 150, h: 56, label: "container B: api", sub: "eth0 172.18.0.3" },
  vol: { x: 10, y: 230, w: 150, h: 56, label: "volume pgdata", sub: "/var/lib/docker/volumes" },
};

export default function DockerNet() {
  const [mode, setMode] = useState<Mode>("inbound");
  const sc = SCEN[mode];
  const frames = useMemo(() => sc.frames, [sc]);
  const s = useStepper(frames, 2200);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented value={mode} onChange={setMode} options={(Object.keys(SCEN) as Mode[]).map((m) => ({ value: m, label: SCEN[m].label }))} />

      <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
        <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Docker host networking diagram">
          <rect x={160} y={8} width={476} height={288} rx={14} fill="none" stroke="#cbd5e1" strokeDasharray="5 4" />
          <text x={630} y={290} textAnchor="end" fontSize={10} fill={C.faint}>
            Docker host
          </text>
          {[
            ["vethA", "bridge"],
            ["vethB", "bridge"],
            ["a", "vethA"],
            ["b", "vethB"],
            ["eth0", "nat"],
            ["nat", "bridge"],
            ["internet", "eth0"],
          ].map(([p, q]) => {
            const A = BOX[p as El];
            const B = BOX[q as El];
            const on = f.on.includes(p as El) && f.on.includes(q as El);
            return (
              <line
                key={p + q}
                x1={A.x + A.w / 2}
                y1={A.y + A.h / 2}
                x2={B.x + B.w / 2}
                y2={B.y + B.h / 2}
                stroke={on ? C.active : "#cbd5e1"}
                strokeWidth={on ? 3 : 1.5}
              />
            );
          })}
          {(Object.keys(BOX) as El[]).map((k) => {
            const b = BOX[k];
            const on = f.on.includes(k);
            const hidden = mode === "host" && (k === "bridge" || k === "vethA" || k === "vethB" || k === "nat");
            return (
              <g key={k} opacity={hidden ? 0.2 : 1}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={on ? "#ecfeff" : "#ffffff"} stroke={on ? C.active : "#cbd5e1"} strokeWidth={on ? 2.5 : 1.2} />
                <text x={b.x + b.w / 2} y={b.y + (b.sub ? b.h / 2 - 2 : b.h / 2 + 4)} textAnchor="middle" fontSize={11} fontWeight={600} fill={on ? C.active : C.text}>
                  {b.label}
                </text>
                {b.sub && (
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 12} textAnchor="middle" fontSize={9} fill={C.muted} fontFamily="monospace">
                    {b.sub}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {f.packet && (
        <div className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-xs break-all text-ink">
          <span className="mr-2 text-faint">packet</span>
          {f.packet}
        </div>
      )}
      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Rules in play</div>
        <div className="grid gap-1 sm:grid-cols-3">
          {sc.table.map(([k, v]) => (
            <div key={k + v} className="font-mono text-[11px]">
              <span className="font-semibold text-violet">{k}</span> <span className="text-dim">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <StepControls s={s} />
    </div>
  );
}
