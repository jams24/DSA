"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type El = "user" | "lb" | "ingress" | "fe" | "batch" | "dns" | "ipt" | "cni" | "api1" | "api2" | "np";
type Mode = "clusterip" | "ingress" | "policy" | "headless";

interface Frame {
  on: El[];
  note: string;
  packet?: string;
  tone?: "info" | "good" | "bad" | "warn";
  blocked?: boolean;
}

const BOX: Record<El, { x: number; y: number; w: number; h: number; label: string; sub?: string }> = {
  user: { x: 10, y: 20, w: 110, h: 46, label: "user", sub: "198.51.100.4" },
  lb: { x: 150, y: 20, w: 150, h: 46, label: "cloud load balancer", sub: "34.120.8.9:443" },
  ingress: { x: 40, y: 130, w: 150, h: 50, label: "ingress-nginx pod", sub: "10.244.1.3" },
  fe: { x: 40, y: 200, w: 150, h: 50, label: "frontend pod", sub: "10.244.1.5 app=frontend" },
  batch: { x: 40, y: 270, w: 150, h: 46, label: "batch pod", sub: "10.244.1.8 app=batch" },
  dns: { x: 215, y: 270, w: 120, h: 46, label: "CoreDNS", sub: "svc 10.96.0.10" },
  ipt: { x: 215, y: 165, w: 120, h: 70, label: "kube-proxy rules", sub: "iptables / IPVS" },
  cni: { x: 360, y: 165, w: 70, h: 70, label: "CNI", sub: "overlay" },
  api1: { x: 460, y: 140, w: 150, h: 56, label: "api pod (node-2)", sub: "10.244.2.7:8080" },
  api2: { x: 460, y: 230, w: 150, h: 56, label: "api pod (node-3)", sub: "10.244.3.9:8080" },
  np: { x: 360, y: 20, w: 250, h: 46, label: "NetworkPolicy api-allow", sub: "ingress from app=frontend :8080" },
};

const LINKS: [El, El][] = [
  ["user", "lb"],
  ["lb", "ingress"],
  ["ingress", "ipt"],
  ["fe", "ipt"],
  ["fe", "dns"],
  ["batch", "ipt"],
  ["ipt", "cni"],
  ["cni", "api1"],
  ["cni", "api2"],
];

const SCEN: Record<Mode, { label: string; table: [string, string][]; frames: Frame[] }> = {
  clusterip: {
    label: "pod → Service (ClusterIP)",
    table: [
      ["Service api", "ClusterIP 10.96.44.12:80 → targetPort 8080"],
      ["EndpointSlice", "10.244.2.7:8080 ✓ ready, 10.244.3.9:8080 ✓ ready"],
      ["DNS", "api.shop.svc.cluster.local → 10.96.44.12"],
    ],
    frames: [
      { on: ["fe"], note: "The frontend calls http://api/orders. The pod's /etc/resolv.conf has search domains (shop.svc.cluster.local, svc.cluster.local…), so the short name api expands within the namespace.", packet: "GET http://api/orders" },
      { on: ["fe", "dns"], note: "CoreDNS answers api.shop.svc.cluster.local with the Service's ClusterIP. Note ndots:5: names with fewer than 5 dots try every search domain first, a common source of extra DNS load.", packet: "A? api.shop.svc.cluster.local → 10.96.44.12", tone: "good" },
      { on: ["fe", "ipt"], note: "The ClusterIP is virtual: no interface owns it and you can't ping it. kube-proxy on every node watches Services and EndpointSlices and programs iptables (or IPVS / eBPF with Cilium) rules for it.", packet: "10.244.1.5:51000 → 10.96.44.12:80" },
      { on: ["ipt"], note: "The rule picks one ready endpoint at random (iptables uses probability rules per endpoint) and DNATs the packet to that pod's IP and targetPort. Load balancing happens per connection, not per request.", packet: "10.244.1.5:51000 → 10.244.3.9:8080", tone: "warn" },
      { on: ["ipt", "cni", "api2"], note: "The CNI plugin (Calico, Cilium, Flannel, AWS VPC CNI) routes pod-to-pod across nodes: every pod gets a unique, routable IP, with no NAT between pods. That's the Kubernetes network model.", packet: "10.244.1.5:51000 → 10.244.3.9:8080", tone: "good" },
      { on: ["api2", "ipt", "fe"], note: "The reply is un-NATed by conntrack on the way back, so the frontend sees it from 10.96.44.12:80. Because balancing is per connection, long-lived HTTP/2 or gRPC connections stick to one pod: use client-side balancing or a mesh for those.", tone: "info" },
    ],
  },
  ingress: {
    label: "internet → Ingress",
    table: [
      ["Service ingress-nginx", "type LoadBalancer → 34.120.8.9"],
      ["Ingress rule", "shop.example.com /api → service api:80"],
      ["TLS", "cert from Secret shop-tls (cert-manager)"],
    ],
    frames: [
      { on: ["user", "lb"], note: "shop.example.com resolves to a cloud load balancer, created because the ingress controller's Service is type: LoadBalancer. One LB serves every host and path in the cluster.", packet: "198.51.100.4 → 34.120.8.9:443" },
      { on: ["lb", "ingress"], note: "The LB forwards to the ingress controller pods (via NodePorts or directly to pod IPs). The controller is just a reverse proxy (nginx, Envoy, Traefik) that watches Ingress objects and rewrites its config.", packet: "→ 10.244.1.3:443" },
      { on: ["ingress"], note: "It terminates TLS using the certificate in the referenced Secret, then matches Host: shop.example.com and path /api against Ingress rules. This is L7 routing, which a plain Service (L4) can't do.", packet: "GET /api/orders Host: shop.example.com", tone: "warn" },
      { on: ["ingress", "ipt", "cni", "api1"], note: "Most controllers skip the ClusterIP and send straight to endpoint IPs from the EndpointSlice, so they can do their own balancing, retries and sticky sessions.", packet: "10.244.1.3 → 10.244.2.7:8080", tone: "good" },
      { on: ["ingress"], note: "Gateway API is Ingress's successor: Gateway (owned by the platform team) and HTTPRoute (owned by app teams) split responsibilities, and support header matching, traffic splitting and more without vendor annotations.", tone: "info" },
    ],
  },
  policy: {
    label: "NetworkPolicy",
    table: [
      ["podSelector", "app=api"],
      ["policyTypes", "Ingress"],
      ["from", "podSelector app=frontend, port 8080"],
    ],
    frames: [
      { on: ["np"], note: "By default every pod can reach every other pod in the cluster. A NetworkPolicy selecting app=api flips those pods to default-deny for ingress, except what the policy allows.", tone: "warn" },
      { on: ["fe", "ipt", "cni", "np", "api1"], note: "frontend (app=frontend) → api:8080 matches the allow rule. The CNI plugin enforces it (Calico/Cilium do; plain Flannel ignores NetworkPolicies, silently).", packet: "10.244.1.5 → 10.244.2.7:8080 ✓", tone: "good" },
      { on: ["batch", "ipt", "cni", "np"], note: "The batch pod is compromised and tries the api. Its labels don't match, so the packet is dropped. The connection just times out, which is what a policy drop looks like when debugging.", packet: "10.244.1.8 → 10.244.2.7:8080 ✗ dropped", tone: "bad", blocked: true },
      { on: ["np"], note: "Common gotcha: if you also add an Egress default-deny, remember to allow DNS (UDP/TCP 53 to kube-dns), or every lookup fails. Start with a namespace default-deny, then allow each flow explicitly.", tone: "info" },
    ],
  },
  headless: {
    label: "headless Service",
    table: [
      ["Service db", "clusterIP: None"],
      ["DNS db", "→ 10.244.2.7, 10.244.3.9 (all pod IPs)"],
      ["StatefulSet", "db-0.db.shop.svc.cluster.local → one pod"],
    ],
    frames: [
      { on: ["fe", "dns"], note: "A headless Service (clusterIP: None) has no virtual IP and no kube-proxy rules. DNS returns the pod IPs directly.", packet: "A? db.shop.svc → 10.244.2.7, 10.244.3.9" },
      { on: ["fe", "cni", "api1"], note: "The client picks a pod and connects directly. Combined with a StatefulSet each pod also gets its own stable name, db-0.db, so a client can always reach the primary.", packet: "10.244.1.5 → 10.244.2.7 (db-0)", tone: "good" },
      { on: ["dns"], note: "Use it for databases, Kafka brokers and anything with client-side discovery, where the client must address specific replicas rather than any replica.", tone: "info" },
    ],
  },
};

export default function K8sNet() {
  const [mode, setMode] = useState<Mode>("clusterip");
  const sc = SCEN[mode];
  const frames = useMemo(() => sc.frames, [sc]);
  const s = useStepper(frames, 2200);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented value={mode} onChange={setMode} options={(Object.keys(SCEN) as Mode[]).map((m) => ({ value: m, label: SCEN[m].label }))} />

      <div className="overflow-hidden rounded-xl border border-line bg-panel-2">
        <svg viewBox="0 0 620 330" className="w-full" role="img" aria-label="Kubernetes service networking diagram">
          <rect x={30} y={118} width={315} height={205} rx={12} fill="none" stroke="#cbd5e1" strokeDasharray="5 4" />
          <text x={38} y={112} fontSize={10} fill={C.faint}>
            node-1
          </text>
          {LINKS.map(([p, q]) => {
            const A = BOX[p];
            const B = BOX[q];
            const on = f.on.includes(p) && f.on.includes(q);
            return (
              <line
                key={p + q}
                x1={A.x + A.w / 2}
                y1={A.y + A.h / 2}
                x2={B.x + B.w / 2}
                y2={B.y + B.h / 2}
                stroke={on ? (f.blocked ? C.bad : C.active) : "#cbd5e1"}
                strokeWidth={on ? 3 : 1.4}
                strokeDasharray={on && f.blocked && q === "cni" ? "6 4" : undefined}
              />
            );
          })}
          {(Object.keys(BOX) as El[]).map((k) => {
            const b = BOX[k];
            const on = f.on.includes(k);
            const col = on ? (f.blocked && (k === "np" || k === "batch") ? C.bad : C.active) : C.text;
            if (k === "np" && mode !== "policy") return null;
            return (
              <g key={k}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={on ? "#ecfeff" : "#ffffff"} stroke={on ? col : "#cbd5e1"} strokeWidth={on ? 2.5 : 1.2} />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 2} textAnchor="middle" fontSize={11} fontWeight={600} fill={on ? col : C.text}>
                  {b.label}
                </text>
                {b.sub && (
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 12} textAnchor="middle" fontSize={8.5} fill={C.muted} fontFamily="monospace">
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
        <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">Objects in play</div>
        <div className="grid gap-1 sm:grid-cols-3">
          {sc.table.map(([k, v]) => (
            <div key={k} className="font-mono text-[11px]">
              <span className="font-semibold text-violet">{k}</span> <span className="text-dim">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <StepControls s={s} />
    </div>
  );
}
