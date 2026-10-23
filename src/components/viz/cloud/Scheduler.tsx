"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

interface KNode {
  name: string;
  zone: string;
  cpu: number; // allocatable millicores
  mem: number; // allocatable MiB
  usedCpu: number;
  usedMem: number;
  labels: string[];
  taint?: string;
  apps: string[]; // app labels of pods already on the node
  image: boolean; // image already cached on node
}

const NODES: KNode[] = [
  { name: "node-a", zone: "us-east-1a", cpu: 4000, mem: 8192, usedCpu: 3200, usedMem: 5000, labels: ["disk=ssd"], apps: ["web"], image: true },
  { name: "node-b", zone: "us-east-1a", cpu: 4000, mem: 8192, usedCpu: 1000, usedMem: 2048, labels: [], apps: ["web", "cache"], image: false },
  { name: "node-c", zone: "us-east-1b", cpu: 4000, mem: 8192, usedCpu: 1800, usedMem: 3072, labels: ["disk=ssd"], apps: [], image: true },
  { name: "gpu-1", zone: "us-east-1b", cpu: 8000, mem: 32768, usedCpu: 500, usedMem: 1024, labels: ["gpu=a100"], taint: "nvidia.com/gpu=present:NoSchedule", apps: [], image: false },
];

interface Spec {
  label: string;
  cpu: number;
  mem: number;
  limits: string;
  selector?: string;
  toleration?: string;
  antiAffinity?: string; // don't share a node with this app
  yaml: string;
  qos: string;
}

const SPECS: Record<string, Spec> = {
  web: {
    label: "web replica",
    cpu: 500,
    mem: 512,
    limits: "limits: memory 512Mi",
    antiAffinity: "web",
    qos: "Burstable (requests set, CPU limit unset)",
    yaml: `resources:
  requests: { cpu: 500m, memory: 512Mi }
  limits:   { memory: 512Mi }
affinity:
  podAntiAffinity:   # one web pod per node
    requiredDuringScheduling…:
    - topologyKey: kubernetes.io/hostname
      labelSelector: { app: web }`,
  },
  ssd: {
    label: "database (needs SSD)",
    cpu: 1000,
    mem: 2048,
    limits: "limits = requests",
    selector: "disk=ssd",
    qos: "Guaranteed (limits = requests for CPU and memory)",
    yaml: `nodeSelector:
  disk: ssd
resources:
  requests: { cpu: "1", memory: 2Gi }
  limits:   { cpu: "1", memory: 2Gi }`,
  },
  gpu: {
    label: "GPU training job",
    cpu: 2000,
    mem: 16384,
    limits: "limits: nvidia.com/gpu 1",
    selector: "gpu=a100",
    toleration: "nvidia.com/gpu",
    qos: "Burstable",
    yaml: `nodeSelector:
  gpu: a100
tolerations:
- key: nvidia.com/gpu
  operator: Exists
  effect: NoSchedule
resources:
  requests: { cpu: "2", memory: 16Gi }
  limits:   { nvidia.com/gpu: 1 }`,
  },
  big: {
    label: "oversized pod",
    cpu: 3500,
    mem: 6144,
    limits: "no limits",
    qos: "Burstable",
    yaml: `resources:
  requests: { cpu: 3500m, memory: 6Gi }
# no toleration for the GPU node's taint`,
  },
};

type Mark = { ok: boolean; why: string } | undefined;
interface Frame {
  phase: "start" | "filter" | "score" | "bind" | "pending";
  checks: Record<string, Mark[]>;
  scores: Record<string, number | undefined>;
  winner?: string;
  note: string;
  tone?: "info" | "good" | "bad" | "warn";
}

const FILTERS = ["NodeResourcesFit", "TaintToleration", "NodeAffinity", "InterPodAntiAffinity"];

function build(spec: Spec): Frame[] {
  const frames: Frame[] = [];
  const checks: Record<string, Mark[]> = Object.fromEntries(NODES.map((n) => [n.name, FILTERS.map(() => undefined)]));
  const scores: Record<string, number | undefined> = {};
  const snap = (f: Omit<Frame, "checks" | "scores">) => frames.push({ ...f, checks: JSON.parse(JSON.stringify(checks)), scores: { ...scores } });

  snap({ phase: "start", note: `A new pod (${spec.label}) has no spec.nodeName, so it sits in the scheduler's queue. The scheduler only looks at requests, never at actual usage. Requests: ${spec.cpu}m CPU, ${spec.mem}Mi memory.` });

  const fail: string[] = [];
  FILTERS.forEach((flt, fi) => {
    for (const n of NODES) {
      if (checks[n.name].some((m) => m && !m.ok)) continue;
      let m: Mark;
      if (flt === "NodeResourcesFit") {
        const freeCpu = n.cpu - n.usedCpu;
        const freeMem = n.mem - n.usedMem;
        m = freeCpu < spec.cpu ? { ok: false, why: `Insufficient cpu (${freeCpu}m free)` } : freeMem < spec.mem ? { ok: false, why: `Insufficient memory (${freeMem}Mi free)` } : { ok: true, why: `${freeCpu}m / ${freeMem}Mi free` };
      } else if (flt === "TaintToleration") {
        m = n.taint && !(spec.toleration && n.taint.startsWith(spec.toleration)) ? { ok: false, why: `untolerated taint ${n.taint.split("=")[0]}` } : { ok: true, why: n.taint ? "taint tolerated" : "no taints" };
      } else if (flt === "NodeAffinity") {
        m = spec.selector && !n.labels.includes(spec.selector) ? { ok: false, why: `no label ${spec.selector}` } : { ok: true, why: spec.selector ? `has ${spec.selector}` : "no selector" };
      } else {
        m = spec.antiAffinity && n.apps.includes(spec.antiAffinity) ? { ok: false, why: `already runs app=${spec.antiAffinity}` } : { ok: true, why: spec.antiAffinity ? `no app=${spec.antiAffinity} here` : "no rules" };
      }
      checks[n.name][fi] = m;
      if (!m.ok) fail.push(m.why);
    }
    const alive = NODES.filter((n) => !checks[n.name].some((x) => x && !x.ok)).length;
    const blurb: Record<string, string> = {
      NodeResourcesFit: "Does the node have enough unrequested CPU and memory? Sum of requests already on the node + this pod's requests must fit in allocatable.",
      TaintToleration: "Taints repel pods. A pod may land on a tainted node only if it tolerates the taint. This is how GPU or dedicated nodes are reserved.",
      NodeAffinity: "nodeSelector / nodeAffinity: the node must carry the required labels. Preferred (soft) rules only affect scoring.",
      InterPodAntiAffinity: "Required anti-affinity: do not place this pod on a node (topologyKey) that already runs matching pods. Spreads replicas across failure domains.",
    };
    snap({ phase: "filter", note: `Filter ${fi + 1}/4 · ${flt}: ${blurb[flt]} ${alive} node(s) still feasible.` });
  });

  const feasible = NODES.filter((n) => !checks[n.name].some((m) => m && !m.ok));
  if (feasible.length === 0) {
    const counts = new Map<string, number>();
    for (const w of fail) {
      const key = w.replace(/ \(.*\)/, "");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const msg = [...counts].map(([k, v]) => `${v} ${k}`).join(", ");
    snap({ phase: "pending", note: `0/${NODES.length} nodes are available: ${msg}. The pod stays Pending and this message shows in kubectl describe pod. Fix: lower requests, add capacity (the Cluster Autoscaler reacts to exactly this), or add a toleration.`, tone: "bad" });
    return frames;
  }

  for (const n of feasible) {
    const cpuFree = 1 - (n.usedCpu + spec.cpu) / n.cpu;
    const memFree = 1 - (n.usedMem + spec.mem) / n.mem;
    const least = Math.round(((cpuFree + memFree) / 2) * 100);
    const balanced = Math.round((1 - Math.abs(cpuFree - memFree)) * 100);
    const img = n.image ? 20 : 0;
    scores[n.name] = least + balanced + img;
  }
  snap({ phase: "score", note: "Scoring: each plugin rates every feasible node 0–100, then the weighted scores are summed. LeastAllocated prefers emptier nodes, BalancedAllocation prefers even CPU/memory use, ImageLocality favours nodes that already have the image." });

  const winner = feasible.reduce((a, b) => ((scores[a.name] ?? 0) >= (scores[b.name] ?? 0) ? a : b)).name;
  snap({ phase: "bind", winner, note: `${winner} has the highest score. The scheduler writes a Binding (pod.spec.nodeName = ${winner}) to the API server. The kubelet on ${winner} sees it and starts the containers. The scheduler never starts anything itself.`, tone: "good" });
  return frames;
}

export default function Scheduler() {
  const [key, setKey] = useState<keyof typeof SPECS>("web");
  const spec = SPECS[key];
  const frames = useMemo(() => build(spec), [spec]);
  const s = useStepper(frames, 1800);
  const f = s.frame;
  const maxScore = Math.max(1, ...Object.values(f.scores).map((x) => x ?? 0));

  return (
    <div className="space-y-4">
      <Segmented value={key} onChange={setKey} options={Object.entries(SPECS).map(([k, v]) => ({ value: k, label: v.label }))} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">Pod spec</div>
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink">{spec.yaml}</pre>
          <div className="mt-2 text-[11px] text-dim">
            QoS class: <span className="font-semibold text-ink">{spec.qos}</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {NODES.map((n) => {
            const marks = f.checks[n.name];
            const out = marks.some((m) => m && !m.ok);
            const win = f.winner === n.name;
            const sc = f.scores[n.name];
            return (
              <div
                key={n.name}
                className="rounded-xl border-2 p-2.5 transition"
                style={{ borderColor: win ? C.done : out ? `${C.bad}66` : "#e3e8f1", background: win ? `${C.done}0f` : out ? `${C.bad}08` : "#fff" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink">{n.name}</span>
                  <span className="text-[10px] text-faint">{n.zone}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                  {n.labels.map((l) => (
                    <span key={l} className="rounded bg-panel-3 px-1 font-mono text-dim">
                      {l}
                    </span>
                  ))}
                  {n.taint && <span className="rounded bg-amber/10 px-1 font-mono text-amber">taint {n.taint.split(":")[1]}</span>}
                  {n.apps.map((a) => (
                    <span key={a} className="rounded bg-sky/10 px-1 font-mono text-sky">
                      pod app={a}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full" style={{ width: `${(n.usedCpu / n.cpu) * 100}%`, background: C.active }} />
                </div>
                <div className="text-[10px] text-faint">
                  cpu requested {n.usedCpu}m / {n.cpu}m · mem {n.usedMem}/{n.mem}Mi
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {FILTERS.map((flt, i) => {
                    const m = marks[i];
                    return (
                      <div key={flt} className="flex gap-1.5 text-[10.5px]">
                        <span className="w-3 shrink-0 font-bold" style={{ color: !m ? C.faint : m.ok ? C.done : C.bad }}>
                          {!m ? "·" : m.ok ? "✓" : "✗"}
                        </span>
                        <span className="text-dim">
                          <span className="font-mono">{flt}</span>
                          {m && <span className={m.ok ? "text-faint" : "text-rose"}> {m.why}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {sc !== undefined && (
                  <div className="mt-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-faint">score</span>
                      <span className="font-mono font-semibold text-ink">{sc}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full" style={{ width: `${(sc / maxScore) * 100}%`, background: win ? C.done : C.pivot }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>
      <StepControls s={s} />
    </div>
  );
}
