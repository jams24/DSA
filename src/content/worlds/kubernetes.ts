import type { World } from "../types";
import { kubernetesPart2 } from "./kubernetes-2";

export const kubernetes: World = {
  id: "kubernetes",
  order: 11,
  title: "The Orchestration Citadel",
  subtitle: "Kubernetes in depth: pod lifecycle, scheduling, networking, state, GitOps, operators & debugging",
  description:
    "The deep dive after Container Harbor and Docker Dockyard. Go through Kubernetes the way platform, DevOps and SRE interviews do: probes and shutdown, requests and scheduling, Services and Ingress, StatefulSets and storage, Helm and Argo CD, operators and RBAC, and a broken-pod triage drill.",
  emoji: "☸️",
  color: "#2563eb",
  boss: {
    name: "The OOMKilled Hydra",
    title: "Warden of the Pending Queue",
    emoji: "🐉",
    taunt: "Cut off one pod and two more crash in its place! Your limits are too low, your probes too eager, and your Service selects nothing at all!",
    defeat: "Requests sized… probes tuned… endpoints ready… 0/0 pods pending. The citadel is yours, operator.",
  },
  lessons: [
    // ------------------------------------------------------------------ POD LIFECYCLE
    {
      id: "pod-lifecycle",
      title: "Pod Lifecycle, Probes & Graceful Shutdown",
      tagline: "Startup, liveness and readiness probes, CrashLoopBackOff, init and sidecar containers, and zero-downtime termination.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["probes"],
      concept: `
## Phases and container states
A pod's **phase** is coarse: \`Pending\` (accepted, not yet running: scheduling or pulling images), \`Running\`, \`Succeeded\`, \`Failed\` or \`Unknown\` (node lost). The real detail is in each **container state**: \`Waiting\` (with a reason such as \`ContainerCreating\`, \`ImagePullBackOff\`, \`CrashLoopBackOff\`), \`Running\` or \`Terminated\` (with an exit code and reason such as \`OOMKilled\` or \`Error\`). The STATUS column in \`kubectl get pods\` shows the most interesting of these.

**restartPolicy** (\`Always\` for Deployments, \`OnFailure\`/\`Never\` for Jobs) decides what the kubelet does when a container exits. Restarts use an **exponential back-off**: 10 s, 20 s, 40 s… capped at 5 minutes, reset after 10 minutes of healthy running. That waiting state is **CrashLoopBackOff**. It's a symptom: the cause is in \`kubectl logs --previous\` and the exit code.

## Init and sidecar containers
- **Init containers** run to completion, in order, before app containers start: wait for a dependency, run migrations, fetch config.
- **Sidecars** (log shippers, proxies) run alongside the app. Native sidecars (an init container with \`restartPolicy: Always\`, stable since 1.33) start before the app and stop after it, which fixes old problems such as Jobs that never finished because the proxy kept running.

## The three probes
| Probe | Question | On failure |
|---|---|---|
| **startupProbe** | Has the app finished starting? | Keep waiting; restart only after the full budget |
| **livenessProbe** | Is the process stuck beyond repair? | **Restart** the container |
| **readinessProbe** | Can it serve traffic right now? | **Remove from Service endpoints**, no restart |

Probes can be \`httpGet\`, \`tcpSocket\`, \`exec\` or \`grpc\`, tuned by \`periodSeconds\`, \`timeoutSeconds\`, \`failureThreshold\` and \`initialDelaySeconds\`. Until the startup probe passes, the other two don't run.

## Probe anti-patterns
- **No startup probe on a slow starter.** Liveness kills the app before it ever finishes starting, forever. Use a startup probe with a generous budget (\`failureThreshold × periodSeconds\`) rather than a huge \`initialDelaySeconds\`, which also delays detection of real hangs.
- **Liveness that checks dependencies.** If liveness pings the database, a DB outage restarts every pod at once and turns a partial outage into a total one. Liveness checks only the process itself; dependency checks (if any) go in readiness.
- **Identical liveness and readiness.** A pod that is merely busy fails both, gets restarted, and the remaining pods take more load and fail too: a cascading restart storm.
- **Expensive probes.** A probe that runs a query every second on 300 pods is a load test you didn't plan.

## Graceful termination
When a pod is deleted (rolling update, scale-down, node drain), two things happen **in parallel**:
1. The endpoints controller removes the pod from Service endpoints, and every node's kube-proxy and every ingress controller must catch up.
2. The kubelet runs the **preStop** hook, then sends **SIGTERM** to PID 1 in each container, waits up to **terminationGracePeriodSeconds** (default 30 s), then SIGKILLs.

Because (1) takes time to propagate, a pod that exits immediately on SIGTERM still receives a few requests and they fail. That's the source of those mysterious 502s during deploys. The fix:
- a short \`preStop\` sleep (5–10 s) so traffic stops arriving before shutdown starts;
- the app handles SIGTERM: stop accepting connections, finish in-flight requests, close pools, exit;
- grace period longer than preStop + drain time.

**PodDisruptionBudgets** (\`minAvailable\` / \`maxUnavailable\`) stop voluntary disruptions such as node drains from taking down too many replicas at once.
`,
      keyPoints: [
        "CrashLoopBackOff is a symptom: read kubectl logs --previous and the exit code to find the cause.",
        "Startup probe protects slow starters; liveness restarts stuck processes; readiness gates traffic without restarting.",
        "Never check dependencies in liveness: a DB outage would restart every pod.",
        "Deletion removes endpoints and sends SIGTERM in parallel. Use a preStop sleep and handle SIGTERM to avoid 502s.",
        "PodDisruptionBudgets limit how many replicas voluntary disruptions (drains, upgrades) can take down.",
      ],
      code: [
        {
          title: "Probes and graceful shutdown done right",
          variants: [
            {
              lang: "yaml",
              code: `
apiVersion: apps/v1
kind: Deployment
metadata: { name: checkout }
spec:
  replicas: 4
  selector: { matchLabels: { app: checkout } }
  template:
    metadata: { labels: { app: checkout } }
    spec:
      terminationGracePeriodSeconds: 45        # > preStop + longest request
      initContainers:
        - name: migrate
          image: myorg/checkout:2.3.1
          command: ["./migrate", "up"]
      containers:
        - name: app
          image: myorg/checkout:2.3.1
          ports: [{ name: http, containerPort: 8080 }]
          startupProbe:                         # up to 30 × 5 s = 150 s to start
            httpGet: { path: /healthz, port: http }
            periodSeconds: 5
            failureThreshold: 30
          livenessProbe:                        # the process only, never dependencies
            httpGet: { path: /healthz, port: http }
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:                       # can I take traffic right now?
            httpGet: { path: /ready, port: http }
            periodSeconds: 5
            failureThreshold: 2
          lifecycle:
            preStop:
              sleep: { seconds: 10 }            # let endpoint removal propagate
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: checkout }
spec:
  maxUnavailable: 1
  selector: { matchLabels: { app: checkout } }
`,
            },
          ],
        },
        {
          title: "Handle SIGTERM in the app",
          variants: [
            {
              lang: "go",
              code: `
srv := &http.Server{Addr: ":8080", Handler: mux}
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal(err)
    }
}()

stop := make(chan os.Signal, 1)
signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
<-stop                                   // preStop has already run by now

ready.Store(false)                       // fail readiness, just in case
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(ctx)                        // stop accepting, drain in-flight requests
db.Close()
`,
            },
            {
              lang: "javascript",
              code: `
const server = app.listen(8080, "0.0.0.0");

process.on("SIGTERM", () => {
  ready = false;                                   // /ready now returns 503
  server.close(async () => {                       // stop accepting, finish in-flight
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000).unref(); // hard stop before SIGKILL
});
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What's the difference between liveness, readiness and startup probes?",
          a: "**Readiness** answers \"can this pod take traffic now?\"; failing it removes the pod from Service endpoints but doesn't restart it (warming caches, temporarily overloaded, dependency down). **Liveness** answers \"is the process irrecoverably stuck?\"; failing it makes the kubelet **restart** the container (deadlocks). **Startup** protects slow-starting apps: liveness and readiness don't run until it passes, so a 60-second JVM boot isn't killed by liveness. Key rule: liveness must not depend on external dependencies, or a database blip restarts your whole fleet.",
          freq: "very-common",
        },
        {
          q: "Users see 502 errors during every rolling deployment. What's going on and how do you fix it?",
          a: "On pod deletion, **endpoint removal and SIGTERM happen in parallel**. kube-proxy rules, ingress controllers and load balancers take a moment to stop sending traffic, but the app exits immediately on SIGTERM, so in-flight and newly routed requests fail. Fixes: (1) a **preStop hook** that sleeps 5–15 s so routing updates first; (2) the app handles **SIGTERM gracefully**, stops accepting, drains in-flight requests and closes connections; (3) **terminationGracePeriodSeconds** larger than both; (4) a correct **readiness probe** plus `maxUnavailable: 0, maxSurge: 1` so new pods are ready before old ones go; (5) if behind a cloud LB, enable connection draining / pod readiness gates. Also check the app actually receives SIGTERM (exec form, PID 1).",
          freq: "very-common",
        },
        {
          q: "A pod is in CrashLoopBackOff. Walk me through debugging it.",
          a: "1) `kubectl describe pod` → look at **Last State: Terminated**, the **exit code** and Events. 2) `kubectl logs <pod> --previous` for the crashed attempt's output. 3) Interpret the exit code: **1** app error (config, missing env var, failed migration), **137** SIGKILL (OOMKilled if the reason says so, or a liveness kill), **139** segfault, **143** SIGTERM. 4) Check whether **liveness** is killing it (Events show \"Liveness probe failed\"): needs a startup probe or a less aggressive probe. 5) Check config: missing Secret/ConfigMap keys, wrong command/args, a read-only filesystem the app writes to. 6) If logs are empty, run the image with an overridden command (`kubectl debug` or `command: [sleep, infinity]`) and poke around.",
          freq: "very-common",
        },
        {
          q: "What is a PodDisruptionBudget and when doesn't it protect you?",
          a: "A PDB sets `minAvailable` or `maxUnavailable` for pods matching a selector. The **eviction API** honours it, so `kubectl drain`, cluster-autoscaler scale-down and node upgrades wait rather than evict too many replicas at once. It does **not** protect against involuntary disruptions: node crashes, OOM kills, kernel panics, or someone running `kubectl delete pod` directly (deletes bypass eviction). Also, a PDB with `maxUnavailable: 0` (or minAvailable = replicas) blocks drains forever, a common cause of stuck node upgrades.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A readiness probe fails 3 times in a row. What does Kubernetes do?",
          options: ["Restarts the container", "Removes the pod from Service endpoints until it passes again", "Deletes the pod", "Reschedules it to another node"],
          answer: 1,
          explain: "Readiness only gates traffic. Restarts come from liveness (or startup) failures.",
        },
        {
          q: "Your liveness probe calls the database. The database goes down for 2 minutes. What happens?",
          options: ["Nothing, the pods keep serving", "Every pod gets restarted repeatedly, though restarting can't fix the database", "Only one pod restarts", "Kubernetes fails over the database"],
          answer: 1,
          explain: "Liveness failures restart containers. Dependency checks belong in readiness at most, never liveness.",
        },
        {
          q: "What's the default terminationGracePeriodSeconds?",
          options: ["5", "10", "30", "300"],
          answer: 2,
          explain: "30 seconds between SIGTERM (after preStop) and SIGKILL, unless you set it.",
        },
        {
          q: "What does an exit code of 137 tell you?",
          options: ["The app returned an error", "The process was killed with SIGKILL (128 + 9), often an OOM kill or a liveness kill", "A segmentation fault", "A graceful SIGTERM shutdown"],
          answer: 1,
          explain: "Exit codes above 128 mean killed by signal (code − 128). 9 is SIGKILL; check the Reason field for OOMKilled.",
        },
      ],
    },

    // ------------------------------------------------------------------ SCHEDULING & RESOURCES
    {
      id: "scheduling-resources",
      title: "Resources, QoS & Scheduling",
      tagline: "Requests vs limits, CPU throttling, OOM kills, QoS classes, affinity, taints and autoscaling nodes.",
      difficulty: "advanced",
      minutes: 18,
      visualizers: ["scheduler", "kube"],
      concept: `
## Requests vs limits
- **requests** are what the **scheduler** reserves. A pod lands only on a node whose allocatable capacity minus the *sum of requests* fits it. Actual usage is irrelevant to scheduling.
- **limits** are enforced by the **kernel** through cgroups at runtime.

The two resources behave very differently at the limit:
| | CPU (compressible) | Memory (incompressible) |
|---|---|---|
| Over the limit | **Throttled** by the CFS quota: slower, never killed | **OOM-killed** (exit 137, reason OOMKilled) |
| Requests also mean | A proportional share of CPU when the node is busy | Protection from eviction ranking |

CPU limits often hurt more than they help: a multi-threaded app can burn its 100 ms quota in the first 20 ms of a period and then stall for 80 ms, adding tail latency even on an idle node. A common policy is **memory request = limit, CPU request set, no CPU limit**. Watch \`container_cpu_cfs_throttled_periods_total\`.

## QoS classes and eviction
| Class | Rule | Evicted |
|---|---|---|
| **Guaranteed** | requests = limits for CPU and memory in every container | Last |
| **Burstable** | Some requests set | In between, by how far usage exceeds requests |
| **BestEffort** | No requests or limits | First |

Under node memory pressure, the kubelet **evicts** pods in roughly that order. Separately, the kernel OOM killer may kill a container that exceeds its own limit at any time.

Namespaces get guardrails from **LimitRange** (defaults and min/max per container) and **ResourceQuota** (totals per namespace).

## How the scheduler decides
For each pending pod: **filter** nodes that can't run it, **score** the rest, then **bind** to the best. The visualizer walks through it.
- **nodeSelector / nodeAffinity**: hard (required) or soft (preferred) rules on node labels: SSDs, GPU type, zone.
- **Taints and tolerations**: a taint repels pods that don't tolerate it. \`NoSchedule\` blocks new pods, \`PreferNoSchedule\` is soft, \`NoExecute\` also evicts running pods. Used to dedicate nodes (GPUs, system workloads). A toleration *permits* a node; it doesn't *attract* the pod, so pair it with a nodeSelector.
- **Pod affinity / anti-affinity**: place relative to other pods. Anti-affinity on \`kubernetes.io/hostname\` keeps replicas on different nodes.
- **topologySpreadConstraints**: spread evenly across zones or nodes with a \`maxSkew\`. It's the modern, cheaper way to spread replicas.
- **PriorityClass and preemption**: a high-priority pending pod can evict lower-priority pods to make room.

## Capacity that moves
- **Cluster Autoscaler** adds nodes when pods are Pending because nothing fits, and removes underused nodes. **Karpenter** provisions right-sized nodes directly from pending pods' requirements, usually faster and cheaper.
- **HPA** scales replicas from metrics (CPU *relative to requests*, so wrong requests mean wrong scaling). **VPA** recommends or sets requests from observed usage. Don't let HPA and VPA act on the same metric.
- Since 1.33, in-place pod resize (beta) can change a running pod's CPU/memory without recreating it.

## Right-sizing in practice
Set requests near **p90–p95 actual usage**, memory limit with headroom for spikes, and revisit with real metrics (VPA recommendations or Prometheus). Over-requesting wastes money (nodes look full but sit idle); under-requesting causes noisy neighbours, throttling and evictions.
`,
      keyPoints: [
        "The scheduler uses requests only; the kernel enforces limits. Requests drive cost and packing.",
        "Over the CPU limit = throttled. Over the memory limit = OOMKilled (exit 137).",
        "QoS: Guaranteed (requests = limits) is evicted last, BestEffort first.",
        "Scheduling = filter (resources, taints, affinity) → score → bind. Tolerations permit; selectors attract.",
        "Cluster Autoscaler/Karpenter react to Pending pods; HPA scales on usage relative to requests.",
      ],
      code: [
        {
          title: "Placement and resources for a zone-redundant API",
          variants: [
            {
              lang: "yaml",
              code: `
spec:
  priorityClassName: business-critical
  topologySpreadConstraints:
    - maxSkew: 1                                  # zones differ by at most 1 replica
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector: { matchLabels: { app: api } }
  affinity:
    podAntiAffinity:                              # prefer different nodes too
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            topologyKey: kubernetes.io/hostname
            labelSelector: { matchLabels: { app: api } }
  containers:
    - name: api
      image: myorg/api:3.2.0
      resources:
        requests: { cpu: 500m, memory: 768Mi }    # what the scheduler reserves
        limits:   { memory: 768Mi }               # no CPU limit: avoid throttling
---
# GPU nodes: tainted so only GPU workloads land there
# kubectl taint nodes gpu-1 nvidia.com/gpu=present:NoSchedule
spec:
  nodeSelector: { gpu: a100 }                     # attract
  tolerations:                                    # permit
    - { key: nvidia.com/gpu, operator: Exists, effect: NoSchedule }
`,
            },
          ],
        },
        {
          title: "Find what's wasting or starving capacity",
          variants: [
            {
              lang: "bash",
              code: `
kubectl describe node node-a | sed -n '/Allocated resources/,/Events/p'   # requests vs allocatable
kubectl top pods -A --sort-by=memory | head                               # real usage
kubectl get pods -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,QOS:.status.qosClass
kubectl get events -A --field-selector reason=FailedScheduling
kubectl get pods -A --field-selector status.phase=Pending
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Explain requests vs limits, and what happens when a container exceeds each.",
          a: "**Requests** are reservations used by the scheduler to place pods and by the kernel to share CPU proportionally under contention; they also influence eviction order. **Limits** are hard caps enforced by cgroups. Exceeding the **CPU limit** causes **throttling** via the CFS quota: the container just runs slower, which shows up as latency. Exceeding the **memory limit** gets the container **OOM-killed** (exit code 137, reason OOMKilled) and restarted. If usage exceeds requests without a limit and the **node** runs out of memory, the kubelet **evicts** pods, Burstable and BestEffort first. Many teams set memory request = limit, and CPU requests without CPU limits.",
          freq: "very-common",
        },
        {
          q: "A pod is stuck in Pending. How do you figure out why?",
          a: "`kubectl describe pod` → the **FailedScheduling** event says exactly which filters failed, e.g. `0/6 nodes are available: 3 Insufficient cpu, 2 node(s) had untolerated taint, 1 node(s) didn't match node affinity`. Then: **Insufficient cpu/memory** → requests too high, or the cluster is full and the autoscaler isn't adding nodes (check its logs, max size, quotas). **Taints** → add a toleration or use different nodes. **Affinity/selector** → a label typo or no node has it. **Topology spread / anti-affinity** → too strict for the number of nodes or zones. **Unbound PVC** → a storage issue (zone mismatch, no StorageClass). Also check ResourceQuota (that shows as a creation error on the ReplicaSet, not a Pending pod).",
          freq: "very-common",
        },
        {
          q: "What are taints and tolerations, and how do they differ from node affinity?",
          a: "A **taint** on a node repels pods; only pods with a matching **toleration** may schedule there (`NoSchedule`), may prefer not to (`PreferNoSchedule`), or are evicted if already running (`NoExecute`, also used by the node controller for NotReady nodes). It's a **node-side** mechanism to keep pods *off*. **Node affinity** is **pod-side**: the pod says which nodes it wants. They're complementary: to dedicate GPU nodes, taint them (keep others off) **and** give GPU pods a toleration plus a nodeSelector/affinity (pull them on). A toleration alone lets a pod land on any node, tainted or not.",
          freq: "common",
        },
        {
          q: "Why might you remove CPU limits from your containers?",
          a: "CPU limits are enforced per CFS period (100 ms): a multi-threaded process can consume its whole quota early in the period and then be **throttled** for the rest, even when the node has idle CPU. That adds latency spikes at p99 for no reason. With CPU **requests** set correctly, the kernel already guarantees each container its proportional share under contention, so limits mainly prevent *using idle capacity*. Counter-arguments: predictable performance for benchmarking, noisy-neighbour control in multi-tenant clusters, and Guaranteed QoS (which needs limits = requests, also enabling CPU pinning). Memory limits should stay, since memory can't be reclaimed by throttling.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "What does the scheduler compare against a node's allocatable capacity?",
          options: ["Current CPU usage", "The sum of pod requests", "The sum of pod limits", "The image size"],
          answer: 1,
          explain: "Scheduling is based purely on requests. A node at 5% real usage can be 'full' if its requests are allocated.",
        },
        {
          q: "A container exceeds its CPU limit. What happens?",
          options: ["It is OOM-killed", "It is throttled", "It is evicted", "The node is cordoned"],
          answer: 1,
          explain: "CPU is compressible: the CFS quota throttles it. Memory overruns are what get killed.",
        },
        {
          q: "Which pod has QoS class Guaranteed?",
          options: ["No requests or limits", "Requests set, no limits", "CPU and memory requests equal to limits in every container", "Only a memory limit"],
          answer: 2,
          explain: "Guaranteed requires requests = limits for both CPU and memory in all containers.",
        },
        {
          q: "You taint GPU nodes and add a toleration to your training pods. Why do some training pods still land on normal nodes?",
          options: ["Tolerations are ignored by default", "A toleration only permits tainted nodes; you also need a nodeSelector or affinity to attract the pod", "The taint effect must be NoExecute", "The GPU nodes need a PDB"],
          answer: 1,
          explain: "Taints keep other pods off; selectors/affinity pull your pods on. You need both.",
        },
      ],
    },
    ...kubernetesPart2,
  ],
};
