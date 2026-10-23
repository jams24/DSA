"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Minus, Plus } from "lucide-react";
import { C, PlayPause, SmallBtn, Stat, useSimLoop } from "../kit";

type Phase = "Pending" | "ContainerCreating" | "Running" | "Terminating";

interface Pod {
  id: string;
  node: number | null;
  phase: Phase;
  ready: boolean;
  t: number;
  reason?: string;
}

interface KNode {
  name: string;
  ready: boolean;
  cordoned: boolean;
  failedAt: number | null;
  evicted: boolean;
}

interface Ev {
  t: number;
  text: string;
  tone: string;
}

const CPU = 2000; // allocatable millicores per node
const POD_CPU = 500;
const START_MS = 1600; // image pull + container start
const READY_MS = 1200; // until the readiness probe passes
const TERMINATE_MS = 1400; // graceful shutdown
const EVICT_MS = 6000; // shortened: real clusters wait ~40 s + a 5 min toleration
const CONTROLLER_MS = 600;
const SCHEDULER_MS = 400;
const MAX_NODES = 5;

const suffix = () => Math.random().toString(36).slice(2, 7);

function initial() {
  const nodes: KNode[] = [1, 2, 3].map((i) => ({ name: `node-${i}`, ready: true, cordoned: false, failedAt: null, evicted: false }));
  const pods: Pod[] = Array.from({ length: 6 }, (_, i) => ({ id: `web-${suffix()}`, node: i % 3, phase: "Running", ready: true, t: 0 }));
  return { nodes, pods };
}

export default function Kube() {
  const [running, setRunning] = useState(false);
  const [desired, setDesired] = useState(6);
  const init = useRef<ReturnType<typeof initial> | null>(null);
  if (!init.current) init.current = initial();
  const nodes = useRef<KNode[]>(init.current.nodes);
  const pods = useRef<Pod[]>(init.current.pods);
  const events = useRef<Ev[]>([{ t: 0, text: "Deployment web: 6/6 pods ready. Press Run, then break things.", tone: C.muted }]);
  const now = useRef(0);
  const lastCtl = useRef(0);
  const lastSched = useRef(0);
  const ctlFlash = useRef(-1e9);
  const schedFlash = useRef(-1e9);
  const [, force] = useState(0);

  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: now.current, text, tone }, ...events.current].slice(0, 9);
  };
  const used = (i: number) => pods.current.filter((p) => p.node === i).length * POD_CPU;

  useSimLoop(running, (dt) => {
    now.current += dt;
    const t = now.current;

    // node lifecycle controller: evict pods from nodes that stay NotReady
    nodes.current.forEach((n, i) => {
      if (!n.ready && n.failedAt !== null && !n.evicted && t - n.failedAt >= EVICT_MS) {
        n.evicted = true;
        const victims = pods.current.filter((p) => p.node === i && p.phase !== "Terminating");
        victims.forEach((p) => {
          p.phase = "Terminating";
          p.t = t;
        });
        log(`${n.name} NotReady too long: evicting ${victims.length} pod(s)`, C.bad);
      }
    });

    // kubelets
    for (const p of pods.current) {
      if (p.node === null || !nodes.current[p.node].ready) continue;
      if (p.phase === "ContainerCreating" && t - p.t >= START_MS) {
        p.phase = "Running";
        p.t = t;
      } else if (p.phase === "Running" && !p.ready && t - p.t >= READY_MS) {
        p.ready = true;
      }
    }
    pods.current = pods.current.filter((p) => !(p.phase === "Terminating" && t - p.t >= TERMINATE_MS));

    // ReplicaSet controller: make actual match desired
    if (t - lastCtl.current >= CONTROLLER_MS) {
      lastCtl.current = t;
      const active = pods.current.filter((p) => p.phase !== "Terminating");
      const diff = desired - active.length;
      if (diff > 0) {
        for (let k = 0; k < diff; k++) pods.current.push({ id: `web-${suffix()}`, node: null, phase: "Pending", ready: false, t });
        log(`ReplicaSet: ${active.length} of ${desired} exist, created ${diff} pod(s)`, C.active);
        ctlFlash.current = t;
      } else if (diff < 0) {
        const rank = (p: Pod) => (p.node === null ? 0 : !p.ready ? 1 : 2);
        const victims = [...active].sort((a, b) => rank(a) - rank(b) || b.t - a.t).slice(0, -diff);
        victims.forEach((p) => {
          p.phase = "Terminating";
          p.t = t;
        });
        log(`ReplicaSet: ${active.length} exist but ${desired} desired, deleting ${-diff}`, C.compare);
        ctlFlash.current = t;
      }
    }

    // scheduler: filter nodes, then score (least allocated wins)
    if (t - lastSched.current >= SCHEDULER_MS) {
      lastSched.current = t;
      for (const p of pods.current) {
        if (p.phase !== "Pending") continue;
        let notReady = 0;
        let cordoned = 0;
        let full = 0;
        let best = -1;
        nodes.current.forEach((n, i) => {
          if (!n.ready) notReady++;
          else if (n.cordoned) cordoned++;
          else if (CPU - used(i) < POD_CPU) full++;
          else if (best < 0 || used(i) < used(best)) best = i;
        });
        if (best >= 0) {
          p.node = best;
          p.phase = "ContainerCreating";
          p.t = t;
          p.reason = undefined;
          log(`Scheduled ${p.id} → ${nodes.current[best].name}`, C.pivot);
          schedFlash.current = t;
        } else {
          const parts = [
            notReady && `${notReady} node(s) had untolerated taint {node.kubernetes.io/unreachable}`,
            cordoned && `${cordoned} node(s) were unschedulable`,
            full && `${full} Insufficient cpu`,
          ].filter(Boolean);
          const reason = `0/${nodes.current.length} nodes are available: ${parts.join(", ")}.`;
          if (p.reason !== reason) log(`FailedScheduling ${p.id}: ${reason}`, C.bad);
          p.reason = reason;
        }
      }
    }
  });

  const act = (fn: () => void) => {
    fn();
    force((x) => x + 1);
  };

  const killPod = (p: Pod) =>
    act(() => {
      if (p.phase === "Terminating") return;
      p.phase = "Terminating";
      p.t = now.current;
      p.ready = false;
      log(`Pod ${p.id} deleted (crash / kubectl delete)`, C.swap);
    });

  const toggleNode = (i: number) =>
    act(() => {
      const n = nodes.current[i];
      if (n.ready) {
        n.ready = false;
        n.failedAt = now.current;
        n.evicted = false;
        pods.current.forEach((p) => {
          if (p.node === i) p.ready = false;
        });
        log(`${n.name} stopped heartbeating → NotReady. Its pods are pulled from Service endpoints.`, C.bad);
      } else {
        n.ready = true;
        n.failedAt = null;
        log(`${n.name} is back: Ready`, C.done);
      }
    });

  const cordon = (i: number) =>
    act(() => {
      const n = nodes.current[i];
      n.cordoned = !n.cordoned;
      log(n.cordoned ? `kubectl cordon ${n.name}: no new pods land here` : `kubectl uncordon ${n.name}`, C.compare);
    });

  const drain = (i: number) =>
    act(() => {
      const n = nodes.current[i];
      n.cordoned = true;
      const victims = pods.current.filter((p) => p.node === i && p.phase !== "Terminating");
      victims.forEach((p) => {
        p.phase = "Terminating";
        p.t = now.current;
        p.ready = false;
      });
      log(`kubectl drain ${n.name}: cordoned, evicting ${victims.length} pod(s) gracefully`, C.compare);
    });

  const addNode = () =>
    act(() => {
      if (nodes.current.length >= MAX_NODES) return;
      nodes.current.push({ name: `node-${nodes.current.length + 1}`, ready: true, cordoned: false, failedAt: null, evicted: false });
      log(`Cluster autoscaler: node-${nodes.current.length} joined`, C.done);
    });

  const reset = () =>
    act(() => {
      const fresh = initial();
      nodes.current = fresh.nodes;
      pods.current = fresh.pods;
      events.current = [{ t: 0, text: "Cluster reset: 6/6 pods ready.", tone: C.muted }];
      now.current = 0;
      lastCtl.current = 0;
      lastSched.current = 0;
      setDesired(6);
    });

  const all = pods.current;
  const readyCount = all.filter((p) => p.ready && p.phase === "Running").length;
  const pending = all.filter((p) => p.phase === "Pending");
  const t = now.current;
  const flash = (at: number) => t - at < 450;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-panel px-1">
          <button type="button" className="grid h-8 w-8 place-items-center text-dim hover:text-ink" onClick={() => setDesired((d) => Math.max(0, d - 1))} aria-label="Scale down">
            <Minus size={14} />
          </button>
          <span className="px-1 font-mono text-xs text-ink">replicas: {desired}</span>
          <button type="button" className="grid h-8 w-8 place-items-center text-dim hover:text-ink" onClick={() => setDesired((d) => Math.min(16, d + 1))} aria-label="Scale up">
            <Plus size={14} />
          </button>
        </div>
        <SmallBtn onClick={addNode} disabled={nodes.current.length >= MAX_NODES} tone="good">
          + add node
        </SmallBtn>
        <SmallBtn onClick={reset}>reset</SmallBtn>
        <span className="text-xs text-faint">Click a pod to kill it.</span>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-panel-2 p-2 text-[11px]">
        <span className="px-1 py-1 font-semibold text-dim">Control plane</span>
        {[
          { label: "kube-apiserver", on: flash(ctlFlash.current) || flash(schedFlash.current) },
          { label: "etcd", on: flash(ctlFlash.current) || flash(schedFlash.current) },
          { label: "controller-manager", on: flash(ctlFlash.current) },
          { label: "kube-scheduler", on: flash(schedFlash.current) },
        ].map((c) => (
          <span
            key={c.label}
            className="rounded-md border px-2 py-1 font-mono transition"
            style={{ borderColor: c.on ? C.pivot : "#e2e8f0", background: c.on ? `${C.pivot}1f` : "#ffffff", color: c.on ? C.pivot : C.muted }}
          >
            {c.label}
          </span>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.current.map((n, i) => {
          const mine = all.filter((p) => p.node === i);
          const req = used(i);
          return (
            <div key={n.name} className={clsx("rounded-xl border p-3", n.ready ? "border-line bg-panel" : "border-rose/40 bg-rose/[0.05]")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-ink">🖥️ {n.name}</span>
                <span className="text-[10px] font-semibold" style={{ color: !n.ready ? C.bad : n.cordoned ? C.compare : C.done }}>
                  {!n.ready ? "NotReady" : n.cordoned ? "Ready,SchedulingDisabled" : "Ready"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (req / CPU) * 100)}%`, background: req >= CPU ? C.compare : C.active }} />
              </div>
              <div className="mt-1 text-[10px] text-faint">
                cpu requests {req}m / {CPU}m
              </div>
              <div className="mt-2 grid min-h-[3.75rem] grid-cols-2 gap-1">
                {mine.map((p) => (
                  <PodChip key={p.id} p={p} nodeReady={n.ready} onClick={() => killPod(p)} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <SmallBtn onClick={() => toggleNode(i)} tone={n.ready ? "danger" : "good"} className="h-7 px-2">
                  {n.ready ? "fail node" : "recover"}
                </SmallBtn>
                <SmallBtn onClick={() => cordon(i)} className="h-7 px-2" disabled={!n.ready}>
                  {n.cordoned ? "uncordon" : "cordon"}
                </SmallBtn>
                <SmallBtn onClick={() => drain(i)} className="h-7 px-2" disabled={!n.ready}>
                  drain
                </SmallBtn>
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber/40 bg-amber/[0.06] p-3">
          <div className="text-xs font-semibold text-amber">Pending ({pending.length})</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {pending.map((p) => (
              <PodChip key={p.id} p={p} nodeReady onClick={() => killPod(p)} />
            ))}
          </div>
          {pending[0].reason && <div className="mt-2 font-mono text-[10px] text-dim">{pending[0].reason}</div>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_2fr]">
        <Stat label="desired" value={desired} />
        <Stat label="ready" value={`${readyCount}/${desired}`} color={readyCount >= desired ? C.done : C.compare} />
        <Stat label="pending" value={pending.length} color={pending.length ? C.compare : C.text} />
        <div className="col-span-3 h-[132px] overflow-hidden rounded-xl border border-line bg-panel px-3 py-2 font-mono text-[10.5px] leading-relaxed sm:col-span-1">
          {events.current.map((e, k) => (
            <div key={k} className="truncate" style={{ color: e.tone, opacity: 1 - k * 0.08 }}>
              <span className="text-faint">{(e.t / 1000).toFixed(1).padStart(5)}s </span>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PodChip({ p, nodeReady, onClick }: { p: Pod; nodeReady: boolean; onClick: () => void }) {
  const status = !nodeReady && p.phase !== "Terminating" ? "Unknown" : p.phase === "Running" && !p.ready ? "Running 0/1" : p.phase === "Running" ? "Running 1/1" : p.phase;
  const color =
    status === "Unknown" ? C.muted : p.phase === "Terminating" ? C.bad : p.phase === "Pending" ? C.compare : p.phase === "ContainerCreating" ? C.sky : p.ready ? C.done : C.active;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${p.id}: ${status}. Click to kill.`}
      className={clsx("rounded-md border px-1.5 py-1 text-left font-mono text-[10px] leading-tight transition hover:scale-[1.03]", p.phase === "Terminating" && "opacity-50")}
      style={{ borderColor: `${color}66`, background: `${color}14`, color }}
    >
      <div className="font-semibold">{p.id}</div>
      <div className="opacity-80">{status}</div>
    </button>
  );
}
