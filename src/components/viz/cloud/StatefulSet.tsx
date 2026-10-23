"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Minus, Plus } from "lucide-react";
import { C, PlayPause, Segmented, SmallBtn, useSimLoop } from "../kit";

type Kind = "sts" | "deploy";
type Phase = "Pending" | "Starting" | "Ready" | "Terminating";

interface Pod {
  name: string;
  ord: number;
  phase: Phase;
  t: number;
  rows: number; // data held in an emptyDir (Deployment only)
}

interface Ev {
  text: string;
  tone: string;
}

const START = 1800;
const STOP = 1200;
const suffix = () => Math.random().toString(36).slice(2, 7);

export default function StatefulSet() {
  const [kind, setKind] = useState<Kind>("sts");
  const [replicas, setReplicas] = useState(3);
  const [running, setRunning] = useState(true);
  const pods = useRef<Pod[]>([]);
  const pvcs = useRef<Map<string, number>>(new Map());
  const events = useRef<Ev[]>([]);
  const now = useRef(0);
  const lastWrite = useRef(0);
  const inited = useRef<Kind | null>(null);

  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ text, tone }, ...events.current].slice(0, 7);
  };

  const init = (k: Kind, n: number) => {
    inited.current = k;
    pvcs.current = new Map();
    pods.current = Array.from({ length: n }, (_, i) => {
      const name = k === "sts" ? `db-${i}` : `db-7d9f-${suffix()}`;
      if (k === "sts") pvcs.current.set(`data-db-${i}`, 40 + i * 7);
      return { name, ord: i, phase: "Ready" as Phase, t: 0, rows: k === "deploy" ? 40 + i * 7 : 0 };
    });
    events.current = [{ text: k === "sts" ? "StatefulSet db: 3 pods, each with its own PVC from volumeClaimTemplates" : "Deployment db: 3 interchangeable pods, data in emptyDir", tone: C.muted }];
  };
  if (inited.current !== kind) init(kind, replicas);

  useSimLoop(running, (dt) => {
    now.current += dt;
    const t = now.current;
    const ps = pods.current;

    for (const p of ps) {
      if (p.phase === "Starting" && t - p.t >= START) {
        p.phase = "Ready";
        p.t = t;
        log(`${p.name} Ready${kind === "sts" ? ` (mounted data-${p.name}, ${pvcs.current.get(`data-${p.name}`) ?? 0} rows)` : ""}`, C.done);
      } else if (p.phase === "Pending" && kind === "deploy") {
        p.phase = "Starting";
        p.t = t;
      }
    }
    const gone = ps.filter((p) => p.phase === "Terminating" && t - p.t >= STOP);
    if (gone.length) {
      pods.current = ps.filter((p) => !gone.includes(p));
      gone.forEach((p) => log(`${p.name} terminated${kind === "deploy" && p.rows ? `, ${p.rows} rows in its emptyDir are gone` : ""}`, kind === "deploy" && p.rows ? C.bad : C.muted));
    }

    const live = pods.current.filter((p) => p.phase !== "Terminating");
    if (kind === "sts") {
      // OrderedReady: create the lowest missing ordinal only when every lower one is Ready
      const busy = pods.current.some((p) => p.phase !== "Ready");
      if (!busy) {
        const missing = Array.from({ length: replicas }, (_, i) => i).find((i) => !live.some((p) => p.ord === i));
        if (missing !== undefined) {
          const name = `db-${missing}`;
          const claim = `data-${name}`;
          const had = pvcs.current.has(claim);
          if (!had) pvcs.current.set(claim, 0);
          pods.current.push({ name, ord: missing, phase: "Starting", t, rows: 0 });
          log(`create ${name} → ${had ? `re-attach existing PVC ${claim}` : `new PVC ${claim}`}`, C.active);
        } else if (live.length > replicas) {
          const top = live.reduce((a, b) => (a.ord > b.ord ? a : b));
          top.phase = "Terminating";
          top.t = t;
          log(`scale down: delete highest ordinal ${top.name} first (PVC data-${top.name} is kept)`, C.compare);
        }
      }
    } else {
      if (live.length < replicas) {
        const p = { name: `db-7d9f-${suffix()}`, ord: -1, phase: "Starting" as Phase, t, rows: 0 };
        pods.current.push(p);
        log(`ReplicaSet creates ${p.name} (random name, empty emptyDir)`, C.active);
      } else if (live.length > replicas) {
        const v = live[Math.floor(Math.random() * live.length)];
        v.phase = "Terminating";
        v.t = t;
        log(`scale down: ${v.name} picked (any pod, in parallel)`, C.compare);
      }
    }

    // writes land on Ready pods every 400 ms
    if (t - lastWrite.current >= 400) {
      lastWrite.current = t;
      for (const p of pods.current) {
        if (p.phase !== "Ready") continue;
        if (kind === "sts") pvcs.current.set(`data-${p.name}`, (pvcs.current.get(`data-${p.name}`) ?? 0) + 1);
        else p.rows += 1;
      }
    }
  });

  const kill = (p: Pod) => {
    if (p.phase === "Terminating") return;
    p.phase = "Terminating";
    p.t = now.current;
    log(`kubectl delete pod ${p.name}`, C.bad);
  };

  const view = [...pods.current].sort((a, b) => (kind === "sts" ? a.ord - b.ord : a.name.localeCompare(b.name)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setReplicas(3);
          }}
          options={[
            { value: "sts", label: "StatefulSet" },
            { value: "deploy", label: "Deployment" },
          ]}
        />
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <div className="flex items-center gap-1 rounded-lg border border-line-2 bg-panel px-1">
          <button type="button" className="grid h-8 w-8 place-items-center text-dim hover:text-ink" onClick={() => setReplicas((d) => Math.max(0, d - 1))} aria-label="Scale down">
            <Minus size={14} />
          </button>
          <span className="px-1 font-mono text-xs text-ink">replicas: {replicas}</span>
          <button type="button" className="grid h-8 w-8 place-items-center text-dim hover:text-ink" onClick={() => setReplicas((d) => Math.min(6, d + 1))} aria-label="Scale up">
            <Plus size={14} />
          </button>
        </div>
        <SmallBtn
          onClick={() => {
            init(kind, 3);
            setReplicas(3);
          }}
        >
          reset
        </SmallBtn>
        <span className="text-xs text-faint">Click a pod to delete it.</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.map((p) => {
          const rows = kind === "sts" ? (pvcs.current.get(`data-${p.name}`) ?? 0) : p.rows;
          const col = p.phase === "Ready" ? C.done : p.phase === "Terminating" ? C.bad : C.compare;
          return (
            <button
              key={p.name + p.t}
              type="button"
              onClick={() => kill(p)}
              className={clsx("rounded-xl border-2 bg-panel p-2.5 text-left transition hover:shadow-sm", p.phase === "Terminating" && "opacity-60")}
              style={{ borderColor: `${col}88` }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-mono text-xs font-semibold text-ink">{p.name}</span>
                <span className="shrink-0 text-[10px] font-semibold" style={{ color: col }}>
                  {p.phase}
                </span>
              </div>
              {kind === "sts" && <div className="mt-0.5 font-mono text-[10px] text-faint">{p.name}.db.shop.svc</div>}
              <div className="mt-1.5 rounded-md bg-panel-2 px-2 py-1 font-mono text-[10.5px] text-dim">
                💾 {kind === "sts" ? `PVC data-${p.name}` : "emptyDir"} · {rows} rows
              </div>
            </button>
          );
        })}
      </div>

      {kind === "sts" && (
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">PersistentVolumeClaims (kubectl get pvc)</div>
          <div className="flex flex-wrap gap-1.5">
            {[...pvcs.current].map(([name, rows]) => {
              const bound = pods.current.some((p) => `data-${p.name}` === name && p.phase !== "Terminating");
              return (
                <span key={name} className="rounded-md border px-2 py-1 font-mono text-[11px]" style={{ borderColor: bound ? `${C.done}66` : "#cfd7e5", color: bound ? C.text : C.muted }}>
                  {name} · {rows} rows · {bound ? "in use" : "retained, unattached"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="space-y-0.5 font-mono text-[11px]">
          {events.current.map((e, i) => (
            <div key={i} style={{ color: e.tone }}>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
