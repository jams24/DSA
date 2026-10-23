"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, SmallBtn, Stat } from "../kit";

interface Case {
  status: string;
  get: string;
  clue: string;
  options: string[];
  answer: number;
  fix: string;
}

const CASES: Case[] = [
  {
    status: "ImagePullBackOff",
    get: "NAME                   READY   STATUS             RESTARTS   AGE\ncheckout-6c8f9-x2l7q   0/1     ImagePullBackOff   0          3m",
    clue: `$ kubectl describe pod checkout-6c8f9-x2l7q
Events:
  Warning  Failed   kubelet  Failed to pull image "registry.acme.io/checkout:v2.4.0":
           rpc error: code = NotFound desc = manifest unknown
  Normal   BackOff  kubelet  Back-off pulling image "registry.acme.io/checkout:v2.4.0"`,
    options: ["The node is out of disk", "The image tag doesn't exist in the registry", "The container crashed on start", "The readiness probe is failing"],
    answer: 1,
    fix: "\"manifest unknown\" means the registry has no such tag: usually a typo or CI never pushed it. A 401/403 would instead point to a missing imagePullSecret. Fix the tag (better: deploy by digest), and check `crane ls` or the registry UI. The kubelet retries with exponential back-off, so once the image exists the pod recovers on its own.",
  },
  {
    status: "CrashLoopBackOff",
    get: "NAME                  READY   STATUS             RESTARTS      AGE\nbilling-7d4b8-m9p2c   0/1     CrashLoopBackOff   6 (2m ago)    9m",
    clue: `$ kubectl logs billing-7d4b8-m9p2c --previous
Error: environment variable STRIPE_API_URL is required
    at loadConfig (/app/config.js:14:11)

$ kubectl describe pod billing-7d4b8-m9p2c
    Last State:  Terminated   Reason: Error   Exit Code: 1`,
    options: ["The liveness probe kills it", "The app exits on startup because config is missing", "The node is NotReady", "It ran out of memory"],
    answer: 1,
    fix: "Exit code 1 plus a startup error in `kubectl logs --previous` (the logs of the crashed attempt; plain `logs` may show the new, empty attempt). The app exits, the kubelet restarts it with 10 s, 20 s, 40 s… back-off up to 5 min. Add the missing env var from a ConfigMap/Secret. CrashLoopBackOff is a symptom, not a cause: always read the previous logs and the exit code.",
  },
  {
    status: "OOMKilled",
    get: "NAME                  READY   STATUS      RESTARTS     AGE\nreports-5f6d7-q8w3n   0/1     OOMKilled   3 (40s ago)  15m",
    clue: `$ kubectl describe pod reports-5f6d7-q8w3n
    Last State:  Terminated
      Reason:    OOMKilled
      Exit Code: 137
    Limits:    memory: 512Mi
    Requests:  memory: 512Mi`,
    options: ["The CPU limit throttled it", "The node evicted it for disk pressure", "It exceeded its memory limit and the kernel killed it", "SIGTERM from a rolling update"],
    answer: 2,
    fix: "Exit 137 = 128 + 9 (SIGKILL). With Reason OOMKilled, the container hit its cgroup memory.max (the limit). Check real usage with `kubectl top pod` / your metrics, then raise the limit or fix the leak. For JVMs, size the heap from the container (-XX:MaxRAMPercentage=75) instead of a hard-coded -Xmx larger than the limit. CPU limits throttle; they never kill.",
  },
  {
    status: "Pending",
    get: "NAME              READY   STATUS    RESTARTS   AGE\nml-train-0        0/1     Pending   0          12m",
    clue: `$ kubectl describe pod ml-train-0
Events:
  Warning  FailedScheduling  default-scheduler
    0/6 nodes are available: 2 node(s) had untolerated taint
    {nvidia.com/gpu: present}, 4 Insufficient nvidia.com/gpu.`,
    options: ["The image is too big to pull", "No node satisfies the pod's scheduling constraints", "The PVC is still provisioning", "The namespace's quota is exceeded"],
    answer: 1,
    fix: "Pending + FailedScheduling means the scheduler found no feasible node. Here the GPU nodes are tainted and the pod has no toleration, and the other nodes have no GPUs. Add the toleration (and a nodeSelector so it targets GPU nodes). If the message said Insufficient cpu, the Cluster Autoscaler (or Karpenter) should add a node; if it doesn't, check its logs and max node count.",
  },
  {
    status: "Pending",
    get: "NAME          READY   STATUS    RESTARTS   AGE\npostgres-0    0/1     Pending   0          6m",
    clue: `$ kubectl describe pod postgres-0
  Warning  FailedScheduling  pod has unbound immediate PersistentVolumeClaims
$ kubectl get pvc
NAME              STATUS    VOLUME   CAPACITY   STORAGECLASS
data-postgres-0   Pending                       fast-ssd`,
    options: ["The PVC can't be bound: the StorageClass doesn't exist or can't provision", "The pod has no CPU requests", "postgres-1 must start first", "The image needs a pull secret"],
    answer: 0,
    fix: "The pod waits for its PersistentVolumeClaim. `kubectl describe pvc data-postgres-0` usually says why: StorageClass fast-ssd doesn't exist (typo, or a class from another cloud), the CSI driver isn't installed, or quota is exhausted. Fix the storageClassName or install the provisioner. Remember volumeClaimTemplates can't be edited in place on an existing StatefulSet.",
  },
  {
    status: "CreateContainerConfigError",
    get: "NAME                 READY   STATUS                       RESTARTS   AGE\nauth-58c9d-r4t6y     0/1     CreateContainerConfigError   0          2m",
    clue: `$ kubectl describe pod auth-58c9d-r4t6y
  Warning  Failed  kubelet  Error: secret "auth-jwt-keys" not found`,
    options: ["The app crashed", "A Secret or ConfigMap referenced by the pod doesn't exist", "The image is wrong", "The node has no IP addresses left"],
    answer: 1,
    fix: "The kubelet can't even build the container config, because an env/envFrom/volume refers to a Secret or ConfigMap that's missing (or a key inside it is missing). Usually: created in another namespace, or the External Secrets/Sealed Secrets sync failed. Create it and the kubelet retries automatically. Mark optional references with optional: true if they really are optional.",
  },
  {
    status: "Running 0/1",
    get: "NAME                READY   STATUS    RESTARTS   AGE\nweb-6b7c8-k1j9h     0/1     Running   0          10m",
    clue: `$ kubectl describe pod web-6b7c8-k1j9h
    Readiness:  http-get http://:8080/healthz
  Warning  Unhealthy  kubelet  Readiness probe failed: Get "http://10.244.2.7:8080/healthz":
           dial tcp 10.244.2.7:8080: connect: connection refused
$ kubectl logs web-6b7c8-k1j9h
Listening on http://127.0.0.1:3000`,
    options: ["The Service selector is wrong", "The probe hits the wrong port and the app only listens on localhost", "The node is overloaded", "The liveness probe is too aggressive"],
    answer: 1,
    fix: "The app listens on 127.0.0.1:3000, but the probe (and the Service) target the pod IP on 8080. Two bugs: bind to 0.0.0.0 and align containerPort/targetPort/probe port (use a named port like http to avoid drift). Because only readiness fails, the pod isn't restarted; it just never receives traffic, and the rollout hangs until progressDeadlineSeconds.",
  },
  {
    status: "Running, no traffic",
    get: `$ kubectl get endpointslices -l kubernetes.io/service-name=api
NAME        ADDRESSTYPE   PORTS     ENDPOINTS   AGE
api-x8k2p   IPv4          <unset>   <unset>     20m
$ kubectl get pods -l app=api
NAME              READY   STATUS    RESTARTS
api-7c9d-2kp4m    1/1     Running   0`,
    clue: `$ kubectl get svc api -o yaml | grep -A2 selector
  selector:
    app: api-server
$ kubectl get pod api-7c9d-2kp4m --show-labels
LABELS   app=api,pod-template-hash=7c9d`,
    options: ["CoreDNS is down", "The Service selector doesn't match the pod labels", "NetworkPolicy blocks it", "kube-proxy is not running"],
    answer: 1,
    fix: "Healthy pods but the Service has no endpoints: its selector (app=api-server) matches no pod (app=api). Fix the selector or the labels. Always check `kubectl get endpointslices` first when a Service gives connection refused or 503s: empty endpoints means a selector mismatch or no Ready pods.",
  },
];

export default function PodStatus() {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => CASES.map(() => false));
  const c = CASES[i];

  const choose = (k: number) => {
    if (pick !== null) return;
    setPick(k);
    if (k === c.answer && !done[i]) setScore((x) => x + 1);
    setDone((d) => d.map((v, j) => (j === i ? true : v)));
  };
  const go = (n: number) => {
    setI((n + CASES.length) % CASES.length);
    setPick(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="incident" value={`${i + 1}/${CASES.length}`} />
        <Stat label="solved" value={score} color={C.done} />
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <Stat label="status" value={<span className="text-sm break-all">{c.status}</span>} color={C.bad} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {CASES.map((x, k) => (
          <button
            key={k}
            type="button"
            onClick={() => go(k)}
            className={clsx("h-7 rounded-md border px-2 font-mono text-[10.5px] transition", k === i ? "border-cyan bg-cyan/10 text-cyan" : done[k] ? "border-emerald/40 text-emerald" : "border-line-2 text-dim")}
          >
            {x.status}
          </button>
        ))}
      </div>

      <pre className="overflow-x-auto rounded-xl border border-line bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">
        <span className="text-[#7dd3fc]">$ kubectl get pods</span>
        {"\n"}
        {c.get}
        {"\n\n"}
        {c.clue}
      </pre>

      <div className="text-sm font-semibold text-ink">What&apos;s the root cause?</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {c.options.map((o, k) => {
          const right = pick !== null && k === c.answer;
          const wrong = pick === k && k !== c.answer;
          return (
            <button
              key={o}
              type="button"
              onClick={() => choose(k)}
              disabled={pick !== null}
              className={clsx(
                "rounded-xl border-2 px-3 py-2 text-left text-sm transition",
                right ? "border-emerald bg-emerald/10 text-ink" : wrong ? "border-rose bg-rose/10 text-ink" : "border-line-2 bg-panel text-dim hover:border-cyan/50 hover:text-ink",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>

      {pick !== null && <Narration tone={pick === c.answer ? "good" : "bad"}>{(pick === c.answer ? "Correct. " : "Not quite. ") + c.fix}</Narration>}

      <div className="flex gap-2">
        <SmallBtn onClick={() => go(i - 1)}>← previous</SmallBtn>
        <SmallBtn onClick={() => go(i + 1)} tone="primary">
          next incident →
        </SmallBtn>
      </div>
    </div>
  );
}
