import type { Lesson } from "../types";

// Kubernetes, part 3: resources and scheduling. Requests, limits and QoS; where pods land; autoscaling.

export const kubernetesPart3: Lesson[] = [
  // ------------------------------------------------------------------ RESOURCES
  {
    id: "scheduling-resources",
    part: "Part 3 · Resources and scheduling",
    title: "Requests, limits and QoS",
    tagline: "What the scheduler reserves vs what the kernel enforces: CPU throttling, OOMKilled, QoS classes, Pending pods, LimitRanges and ResourceQuotas.",
    difficulty: "intermediate",
    minutes: 22,
    diagram: {
      title: "Where requests and limits act",
      nodes: [
        { id: "pod", label: "Pod spec", kind: "client", x: 110, y: 120, sub: "requests + limits" },
        { id: "quota", label: "Admission", kind: "gateway", x: 340, y: 120, sub: "LimitRange, ResourceQuota" },
        { id: "sched", label: "Scheduler", kind: "control", x: 580, y: 120, sub: "sums REQUESTS per node" },
        { id: "node", label: "Node", kind: "node", x: 820, y: 120, sub: "allocatable CPU/memory" },
        { id: "kubelet", label: "kubelet", kind: "node", x: 820, y: 320, sub: "cgroups from LIMITS" },
        { id: "cpu", label: "CPU over limit", kind: "monitor", x: 560, y: 470, sub: "throttled (slower)" },
        { id: "mem", label: "Memory over limit", kind: "monitor", x: 860, y: 480, sub: "OOMKilled (137)" },
        { id: "evict", label: "Node pressure", kind: "worker", x: 300, y: 380, sub: "evict BestEffort first" },
      ],
      edges: [
        { from: "pod", to: "quota", label: "create" },
        { from: "quota", to: "sched", label: "defaults filled" },
        { from: "sched", to: "node", label: "bind if it fits" },
        { from: "node", to: "kubelet" },
        { from: "kubelet", to: "cpu" },
        { from: "kubelet", to: "mem" },
        { from: "kubelet", to: "evict", dashed: true },
      ],
      flows: [
        {
          name: "A pod's resources, from YAML to kernel",
          path: ["pod", "quota", "sched", "node", "kubelet", "cpu"],
          steps: [
            "The pod is created. A LimitRange fills in missing requests and limits; a ResourceQuota rejects it if the namespace's budget would be exceeded.",
            "The scheduler only looks at requests: a node fits if allocatable minus the requests of pods already there covers the new pod's requests.",
            "The pod is bound to that node.",
            "The kubelet turns limits into cgroup settings: a CPU quota and a memory maximum.",
            "Above its CPU limit the container is throttled: it runs slower but keeps going.",
          ],
        },
        {
          name: "Memory runs out",
          path: ["kubelet", "mem"],
          steps: [
            "A container that goes over its own memory limit is killed by the kernel's OOM killer at once: exit 137, reason OOMKilled. The kubelet restarts it.",
          ],
        },
        {
          name: "The node runs out",
          path: ["kubelet", "evict"],
          steps: [
            "If the whole node runs low on memory or disk, the kubelet evicts pods to save it: BestEffort first, then Burstable pods using more than they requested, Guaranteed last.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
A bus has 50 seats. Before the trip, every family **books** seats: "we need 4". The driver adds up the bookings and only lets a family on if there are enough unbooked seats left. Those bookings are **requests**. The driver doesn't care how many people actually sit down; only the bookings count.

Then there are rules during the trip. "No family may take more than 6 seats, even if the bus is empty." Those are **limits**. What happens when you break one depends on what you're using:
- **CPU** is like *time with the bus's microphone*. If your family wants it too much, you're told to wait your turn: you get **slowed down** (throttled), but you stay on the bus.
- **Memory** is like *seats*. If your family spreads out over more seats than allowed, you're **thrown off the bus** (OOMKilled), right away, no warning.

And if the bus is overfull and something has to give, the families who booked nothing (**BestEffort**) are asked to leave first, and the families who booked exactly what they use (**Guaranteed**) are asked last.

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

## Units
- CPU in cores: \`1\` = one core, \`250m\` = a quarter of a core ("m" is milli). A CPU limit of \`200m\` means 20 ms of CPU time per 100 ms period.
- Memory in bytes with binary suffixes: \`64Mi\`, \`1Gi\`. (\`M\` and \`G\` are powers of 10. \`128M\` is about 122 Mi: a classic small surprise.)
- Node **allocatable** = capacity minus what's reserved for the OS and the kubelet. That's what the scheduler fills.

## Pending: nothing fits
A pod whose requests don't fit on any node stays **Pending**, with a FailedScheduling event like \`0/3 nodes are available: 3 Insufficient cpu\`. Note that it's the **sum of requests** that counts: nodes can look idle in monitoring and still be "full". Fixes: lower the requests (if they're too high), add nodes (cluster autoscaler), or free capacity.

## Guardrails for namespaces
- A **LimitRange** sets per-container defaults (\`defaultRequest\`, \`default\` for limits) and min/max. Containers that don't say anything get the defaults, so no pod is accidentally BestEffort.
- A **ResourceQuota** caps a namespace's **totals**: number of pods, sum of CPU and memory requests and limits, number of Services or PVCs. A pod that would go over is **rejected at creation** (\`exceeded quota\`), which for a Deployment shows up as a ReplicaSet that can't create pods: check \`kubectl describe rs\`.
- With a quota on \`requests.cpu\`, every pod *must* declare CPU requests (or get them from a LimitRange), or it's rejected.

## Right-sizing in practice
Set requests near **p90–p95 actual usage**, memory limit with headroom for spikes, and revisit with real metrics (VPA recommendations or Prometheus). Over-requesting wastes money (nodes look full but sit idle); under-requesting causes noisy neighbours, throttling and evictions.

\`kubectl top pods\` and \`kubectl top nodes\` show current usage from **metrics-server**: a quick look, not history. For right-sizing, use Prometheus (or your cloud's monitoring) over days, or the VPA's recommendations.`,
    keyPoints: [
      "Requests are reservations the scheduler adds up; limits are enforced by the kernel through cgroups.",
      "Over the CPU limit: throttled (slower). Over the memory limit: OOMKilled, exit 137.",
      "QoS: Guaranteed (requests = limits) is evicted last, Burstable in between, BestEffort (nothing set) first.",
      "Pending with 'Insufficient cpu' means the sum of requests doesn't fit, whatever the actual usage.",
      "LimitRange gives containers defaults and bounds; ResourceQuota caps a namespace's totals and rejects pods that exceed them.",
    ],
    code: [
      {
        title: "Three QoS classes",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-qos > /dev/null
pod() {   # name, then the resources block as JSON
  kubectl -n quest-qos run "$1" --image=node:20-slim --overrides="{\\"spec\\": {\\"containers\\": [{\\"name\\": \\"$1\\", \\"image\\": \\"node:20-slim\\", \\"command\\": [\\"sleep\\", \\"3600\\"], \\"resources\\": $2}]}}" > /dev/null
}
pod guaranteed '{"requests": {"cpu": "100m", "memory": "64Mi"}, "limits": {"cpu": "100m", "memory": "64Mi"}}'
pod burstable  '{"requests": {"cpu": "50m",  "memory": "32Mi"}, "limits": {"memory": "128Mi"}}'
pod besteffort '{}'
# requests: what the scheduler reserves for you.  limits: the most you may use.
# Together they decide your Quality-of-Service class: who gets evicted first when a node runs out of memory.
kubectl -n quest-qos get pods -o custom-columns='POD:.metadata.name,QOS-CLASS:.status.qosClass,REQUESTS:.spec.containers[0].resources.requests,LIMITS:.spec.containers[0].resources.limits' --sort-by=.metadata.name` }],
        explain: `- \`--overrides\` lets \`kubectl run\` take a piece of pod spec as JSON; in a real manifest these are the \`resources:\` blocks.
- **Guaranteed**: every container has requests equal to limits for both CPU and memory.
- **Burstable**: something is set, but not equal everywhere. Here no CPU limit, which many teams prefer (see "Requests vs limits" above).
- **BestEffort**: nothing at all. Cheapest to schedule, first to go under memory pressure.
- Kubernetes computes \`status.qosClass\` for you; you only choose the numbers.`,
        output: `POD          QOS-CLASS    REQUESTS                    LIMITS
besteffort   BestEffort   <none>                      <none>
burstable    Burstable    map[cpu:50m memory:32Mi]    map[memory:128Mi]
guaranteed   Guaranteed   map[cpu:100m memory:64Mi]   map[cpu:100m memory:64Mi]`,
      },
      {
        title: "OOMKilled",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-oom > /dev/null
# Memory limit 64Mi, but the app tries to hold 200 MB
kubectl -n quest-oom apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: hungry }
spec:
  restartPolicy: Never
  containers:
    - name: app
      image: node:20-slim
      command: ["node", "-e", "const keep = []; for (let i = 0; i < 200; i++) { keep.push(Buffer.alloc(1024 * 1024, 1)); console.log(i + 1, 'MB'); }"]
      resources:
        requests: { memory: 64Mi }
        limits: { memory: 64Mi }
YAML
kubectl -n quest-oom wait --for=jsonpath='{.status.phase}'=Failed pod/hungry --timeout=120s > /dev/null
# The kernel's OOM killer ends it with SIGKILL (exit 137 = 128 + signal 9). No warning, no cleanup.
kubectl -n quest-oom get pod hungry -o jsonpath='reason: {.status.containerStatuses[0].state.terminated.reason}, exit code: {.status.containerStatuses[0].state.terminated.exitCode}{"\\n"}'
last=$(kubectl -n quest-oom logs hungry | tail -n 1 | cut -d' ' -f1)
[ "$last" -lt 64 ] && echo "it got to fewer than 64 MB before being killed"` }],
        explain: `- The app allocates 1 MB at a time, aiming for 200 MB, with a 64Mi limit. Node.js itself needs memory too, so it's killed well before 64 MB of buffers.
- **OOMKilled, exit code 137**: the kernel sent SIGKILL. The app gets no chance to log, flush or clean up, which is why the last log line is just a number.
- Fix: raise the limit to what the app really needs, or make the app use less (for the JVM and Node.js, also tell the runtime its heap budget: \`-Xmx\`, \`--max-old-space-size\`, so it collects garbage before the kernel steps in).`,
        output: `reason: OOMKilled, exit code: 137
it got to fewer than 64 MB before being killed`,
      },
      {
        title: "Pending: the requests don't fit",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-pending > /dev/null
# Ask for 100 CPU cores. No node has that many free, so the pod can't be placed anywhere.
kubectl -n quest-pending run greedy --image=node:20-slim --overrides='{"spec": {"containers": [{"name": "greedy", "image": "node:20-slim", "command": ["sleep", "3600"], "resources": {"requests": {"cpu": "100"}}}]}}' > /dev/null
kubectl -n quest-pending wait --for=jsonpath='{.status.conditions[?(@.type=="PodScheduled")].reason}'=Unschedulable pod/greedy --timeout=60s > /dev/null
kubectl -n quest-pending get pod greedy -o custom-columns='NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName'
# The scheduler says exactly why (in describe, this is the Events section at the bottom):
kubectl -n quest-pending get events --field-selector reason=FailedScheduling -o jsonpath='{.items[0].message}{"\\n"}' | sed -E 's/\\. .*/./'
# Every node offers far fewer cores than that:
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name} {.status.allocatable.cpu}{"\\n"}{end}' \\
  | awk '{ v = $2; if (v ~ /m$/) v = v / 1000; print "  " $1 ": " (v < 100 ? "less than 100 CPUs allocatable" : v) }'

# Fix the request and the pod gets scheduled. (Pod resources can't be edited in place, so: delete, recreate.)
kubectl -n quest-pending delete pod greedy --wait=false > /dev/null
kubectl -n quest-pending run modest --image=node:20-slim --overrides='{"spec": {"containers": [{"name": "modest", "image": "node:20-slim", "command": ["sleep", "3600"], "resources": {"requests": {"cpu": "100m"}}}]}}' > /dev/null
kubectl -n quest-pending wait --for=condition=Ready pod/modest --timeout=120s > /dev/null
kubectl -n quest-pending get pod modest -o custom-columns='NAME:.metadata.name,STATUS:.status.phase,CPU-REQUEST:.spec.containers[0].resources.requests.cpu'` }],
        explain: `- A request of 100 CPUs fits nowhere, so the pod stays Pending with no node.
- The scheduler's message says how many nodes were rejected and why: here all 3 for \`Insufficient cpu\`. You'll see it in \`kubectl describe pod\` under Events.
- A pod's resources can't be edited in place (except with the newer in-place resize feature), so the fix is a new pod. With a Deployment you'd change the template and it rolls out.`,
        output: `NAME     STATUS    NODE
greedy   Pending   <none>
0/3 nodes are available: 3 Insufficient cpu.
  quest-server: less than 100 CPUs allocatable
  quest-worker-1: less than 100 CPUs allocatable
  quest-worker-2: less than 100 CPUs allocatable
NAME     STATUS    CPU-REQUEST
modest   Running   100m`,
      },
      {
        title: "A team budget: ResourceQuota and LimitRange",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-team > /dev/null
kubectl -n quest-team apply -f - <<'YAML'
# A budget for the whole namespace (one team)...
apiVersion: v1
kind: ResourceQuota
metadata: { name: team-budget }
spec:
  hard:
    pods: "3"
    requests.cpu: 300m
    requests.memory: 256Mi
---
# ...and defaults for containers that forget to set requests and limits
apiVersion: v1
kind: LimitRange
metadata: { name: defaults }
spec:
  limits:
    - type: Container
      defaultRequest: { cpu: 100m, memory: 64Mi }
      default: { cpu: 200m, memory: 128Mi }
YAML
for i in 1 2 3 4; do
  kubectl -n quest-team run "app-$i" --image=node:20-slim -- sleep 3600 2>&1 | sed -E 's/^Error from server \\(Forbidden\\): pods "app-4" is forbidden: (exceeded quota: team-budget).*/app-4 rejected: \\1/'
done
kubectl -n quest-team get pod app-1 -o jsonpath='app-1 was given: requests={.spec.containers[0].resources.requests} limits={.spec.containers[0].resources.limits}{"\\n"}'
kubectl -n quest-team get resourcequota team-budget -o jsonpath='used: pods {.status.used.pods}/{.status.hard.pods}, cpu {.status.used.requests\\.cpu}/{.status.hard.requests\\.cpu}, memory {.status.used.requests\\.memory}/{.status.hard.requests\\.memory}{"\\n"}'` }],
        explain: `- The pods were created with no resources at all, and the **LimitRange** filled in 100m/64Mi requests and 200m/128Mi limits.
- The **ResourceQuota** allows 3 pods and 300m of CPU requests in the namespace. The 4th pod is rejected by the API server at creation: it never even reaches the scheduler.
- \`kubectl describe resourcequota\` shows used vs hard for every resource. Quotas are how platform teams share a cluster fairly between teams.`,
        output: `resourcequota/team-budget created
limitrange/defaults created
pod/app-1 created
pod/app-2 created
pod/app-3 created
app-4 rejected: exceeded quota: team-budget
app-1 was given: requests={"cpu":"100m","memory":"64Mi"} limits={"cpu":"200m","memory":"128Mi"}
used: pods 3/3, cpu 300m/300m, memory 192Mi/256Mi`,
      },
      {
        title: "Real usage with kubectl top",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-top > /dev/null
# Two pods: one idle, one spinning in a busy loop but capped at 200m (a fifth of a CPU core)
kubectl -n quest-top run idle --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-top run busy --image=node:20-slim --overrides='{"spec": {"containers": [{"name": "busy", "image": "node:20-slim", "command": ["node", "-e", "while (true) {}"], "resources": {"limits": {"cpu": "200m"}}}]}}' > /dev/null
kubectl -n quest-top wait --for=condition=Ready pod/idle pod/busy --timeout=120s > /dev/null

# metrics-server samples real usage every few seconds; give it time to see both pods
for _ in $(seq 1 120); do [ "$(kubectl -n quest-top top pods --no-headers 2>/dev/null | wc -l | tr -d ' ')" = 2 ] && break; sleep 2; done
sleep 20
kubectl -n quest-top top pods --no-headers | sort | while read -r name cpu mem; do
  m=\${cpu%m}
  if [ "$m" -ge 150 ] && [ "$m" -le 230 ]; then use="about 200m: held at its limit (throttled)"
  elif [ "$m" -le 10 ]; then use="about 0m"
  else use="$cpu (unexpected)"; fi
  echo "$name: CPU $use"
done` }],
        explain: `- \`while (true) {}\` would use a whole core, but the 200m limit holds it at about a fifth of one: the kernel throttles it. On a real service, throttling shows up as slow responses, not errors.
- \`kubectl top\` needs **metrics-server** (installed on most clusters; on kind and minikube, add it). It reports recent usage from the kubelets, refreshed every 15 seconds or so.
- The busy pod has no CPU request here, so the HPA (lesson 11) couldn't compute a percentage for it: HPA utilization is usage **divided by requests**.`,
        output: `busy: CPU about 200m: held at its limit (throttled)
idle: CPU about 0m`,
      },
    ],
    interview: [
      {
        q: "Explain requests vs limits, and what happens when a container exceeds each.",
        a: "**Requests** are reservations used by the scheduler to place pods and by the kernel to share CPU proportionally under contention; they also influence eviction order. **Limits** are hard caps enforced by cgroups. Exceeding the **CPU limit** causes **throttling** via the CFS quota: the container just runs slower, which shows up as latency. Exceeding the **memory limit** gets the container **OOM-killed** (exit code 137, reason OOMKilled) and restarted. If usage exceeds requests without a limit and the **node** runs out of memory, the kubelet **evicts** pods, Burstable and BestEffort first. Many teams set memory request = limit, and CPU requests without CPU limits.",
        freq: "very-common",
      },
      {
        q: "Why might you remove CPU limits from your containers?",
        a: "CPU limits are enforced per CFS period (100 ms): a multi-threaded process can consume its whole quota early in the period and then be **throttled** for the rest, even when the node has idle CPU. That adds latency spikes at p99 for no reason. With CPU **requests** set correctly, the kernel already guarantees each container its proportional share under contention, so limits mainly prevent *using idle capacity*. Counter-arguments: predictable performance for benchmarking, noisy-neighbour control in multi-tenant clusters, and Guaranteed QoS (which needs limits = requests, also enabling CPU pinning). Memory limits should stay, since memory can't be reclaimed by throttling.",
        freq: "occasional",
      },
      {
        q: "How do you stop one team from using the whole shared cluster?",
        a: "Per-team **namespaces** with a **ResourceQuota** (caps on total requests/limits for CPU and memory, pod count, Services, PVCs, LoadBalancers) and a **LimitRange** (default requests and limits so nothing is BestEffort, plus per-container min/max). Add **PriorityClasses** so critical system pods win when capacity is short, RBAC so teams only act in their namespaces, and node pools with taints for special hardware. Then watch usage vs requests and give teams cost reports (Kubecost, OpenCost), since over-requesting is the usual way a cluster 'fills up'.",
        freq: "common",
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
        q: "Which QoS class is evicted first under node memory pressure?",
        options: ["Guaranteed", "Burstable", "BestEffort", "System"],
        answer: 2,
        explain: "Pods without requests or limits have no reservation to protect them.",
      },
      {
        q: "A namespace has a ResourceQuota on requests.cpu. You create a pod without any CPU request and there's no LimitRange. What happens?",
        options: ["It's scheduled as BestEffort", "The API server rejects it: it must specify CPU requests", "It gets 1 CPU by default", "It waits in Pending"],
        answer: 1,
        explain: "With a compute quota, every pod must declare those resources (or get defaults from a LimitRange).",
      },
    ],
  },

  // ------------------------------------------------------------------ SCHEDULING
  {
    id: "k8s-scheduling",
    title: "Where pods land: the scheduler",
    tagline: "nodeSelector and affinity, taints and tolerations, spreading replicas across nodes and zones, and cordon, drain and PodDisruptionBudgets.",
    difficulty: "intermediate",
    minutes: 22,
    visualizers: ["scheduler", "kube"],
    concept: `## Explain it like I'm 10 🧸
Picture the seating plan for a class trip. The teacher (the **scheduler**) places each kid (each **pod**) at a table (a **node**) using a few rules:
- "Kids who get carsick sit at a table near the window": the pod **asks** for a kind of table (a **nodeSelector** or **node affinity**: "I want a node with an SSD").
- Some tables have a sign: "Reserved for the band" (a **taint**). Nobody sits there unless they carry a band pass (a **toleration**). A pass lets you sit there, but doesn't force you to.
- "Twins, don't sit together, so one cold doesn't knock out both" (pod **anti-affinity** or **topology spread**: copies of the same app on different nodes or zones).

When a table needs repairs, the teacher puts a "closed" sign on it (**cordon**) and asks its kids to move (**drain**). A **PodDisruptionBudget** is the rule "at least 3 of the choir must be in the room at all times": the teacher can only move choir kids one by one, as long as enough stay.

## How the scheduler decides
For each pending pod: **filter** nodes that can't run it, **score** the rest, then **bind** to the best. The visualizer walks through it.
- **nodeSelector / nodeAffinity**: hard (required) or soft (preferred) rules on node labels: SSDs, GPU type, zone.
- **Taints and tolerations**: a taint repels pods that don't tolerate it. \`NoSchedule\` blocks new pods, \`PreferNoSchedule\` is soft, \`NoExecute\` also evicts running pods. Used to dedicate nodes (GPUs, system workloads). A toleration *permits* a node; it doesn't *attract* the pod, so pair it with a nodeSelector.
- **Pod affinity / anti-affinity**: place relative to other pods. Anti-affinity on \`kubernetes.io/hostname\` keeps replicas on different nodes.
- **topologySpreadConstraints**: spread evenly across zones or nodes with a \`maxSkew\`. It's the modern, cheaper way to spread replicas.
- **PriorityClass and preemption**: a high-priority pending pod can evict lower-priority pods to make room.

## Hard and soft rules
Most placement rules come in two strengths:
- **required** (\`requiredDuringSchedulingIgnoredDuringExecution\`, \`whenUnsatisfiable: DoNotSchedule\`, \`NoSchedule\` taints): if it can't be met, the pod stays **Pending**;
- **preferred** (\`preferred...\`, \`ScheduleAnyway\`, \`PreferNoSchedule\`): the scheduler tries, and places the pod anyway if it can't.

"IgnoredDuringExecution" means rules are only checked when placing a pod: relabel a node later and running pods stay where they are. (The **descheduler** project can move them.) Prefer soft rules unless breaking the rule is worse than not running at all.

## Spreading replicas
Three replicas on one node is one node failure away from an outage. Two tools:
- **pod anti-affinity**: "not on a node (or zone) that already runs a pod with label X". Required anti-affinity on \`kubernetes.io/hostname\` gives at most one per node, as the third sample shows, and leaves extra replicas Pending.
- **topologySpreadConstraints**: "keep the count per zone (or node) within \`maxSkew\` of each other". Cheaper to compute, works with any replica count, and is what you want for zones (\`topology.kubernetes.io/zone\`).

## Taints in practice
| Taint effect | New pods without a toleration | Running pods without one |
|---|---|---|
| \`NoSchedule\` | not scheduled | stay |
| \`PreferNoSchedule\` | avoided if possible | stay |
| \`NoExecute\` | not scheduled | **evicted** (after \`tolerationSeconds\` if set) |

Kubernetes itself taints nodes: \`node.kubernetes.io/not-ready\` and \`unreachable\` (NoExecute: that's how pods leave dead nodes, after the default 300-second toleration), \`memory-pressure\`, \`disk-pressure\`, \`unschedulable\` (cordoned). Control-plane nodes usually carry \`node-role.kubernetes.io/control-plane:NoSchedule\`.

## Node maintenance: cordon, drain, PDB
- \`kubectl cordon NODE\`: mark it unschedulable. Running pods stay.
- \`kubectl drain NODE --ignore-daemonsets --delete-emptydir-data\`: cordon, then **evict** every pod through the Eviction API. Evictions respect **PodDisruptionBudgets**; a drain that would break a budget waits and retries.
- \`kubectl uncordon NODE\`: open it again.

A **PodDisruptionBudget** (\`minAvailable\` or \`maxUnavailable\` for pods matching a selector) limits **voluntary** disruptions: drains, cluster upgrades, the autoscaler removing nodes. It doesn't protect against crashes or node failures, and a PDB that allows zero disruptions (\`minAvailable\` equal to the replica count) blocks node upgrades forever. Use \`maxUnavailable: 1\` or a percentage.

## Priority and preemption
A **PriorityClass** gives pods a priority number. When a high-priority pod can't fit, the scheduler may **preempt** (evict) lower-priority pods to make room. Clusters ship with \`system-cluster-critical\` and \`system-node-critical\` for their own components. Use it to protect production from batch jobs, carefully: a misconfigured high default priority can evict everything else.`,
    keyPoints: [
      "The scheduler filters nodes (resources, selectors, affinity, taints), scores the rest and binds the pod to the best.",
      "nodeSelector/node affinity attract pods to nodes; taints repel pods without a matching toleration. A toleration permits, it doesn't attract.",
      "Spread replicas with topologySpreadConstraints (zones) or anti-affinity (one per node); required rules leave pods Pending when they can't be met.",
      "cordon stops new pods; drain evicts existing ones through the Eviction API, which respects PodDisruptionBudgets.",
      "A PDB only limits voluntary disruptions; minAvailable equal to replicas blocks every drain.",
    ],
    code: [
      {
        title: "nodeSelector: ask for a kind of node",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-sel > /dev/null
# Nodes have labels too. Mark one node as having a fast SSD...
kubectl label node quest-worker-2 quest-disk=ssd > /dev/null
kubectl get nodes -L quest-disk --no-headers | awk '{printf "%-15s disk=%s\\n", $1, ($6 == "" ? "-" : $6)}'

# ...and ask for it. 4 replicas, all must land on a node with quest-disk=ssd
kubectl -n quest-sel apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: db-cache }
spec:
  replicas: 4
  selector: { matchLabels: { app: db-cache } }
  template:
    metadata: { labels: { app: db-cache } }
    spec:
      terminationGracePeriodSeconds: 1
      nodeSelector:
        quest-disk: ssd
      containers:
        - { name: cache, image: node:20-slim, command: ["sleep", "3600"] }
YAML
kubectl -n quest-sel rollout status deployment/db-cache --timeout=120s > /dev/null
kubectl -n quest-sel get pods -o jsonpath='{range .items[*]}{.spec.nodeName}{"\\n"}{end}' | sort | uniq -c | awk '{print $1 " pods on " $2}'` }],
        explain: `- Nodes have labels like everything else. Clusters add many automatically (\`kubernetes.io/hostname\`, \`kubernetes.io/arch\`, \`topology.kubernetes.io/zone\`, instance type); you add your own.
- \`nodeSelector\` is the simplest hard rule: only nodes with **all** these labels. All 4 replicas land on the one SSD node.
- \`nodeAffinity\` does the same with operators (\`In\`, \`NotIn\`, \`Exists\`, \`Gt\`) and soft preferences with weights.`,
        output: `quest-server    disk=-
quest-worker-1  disk=-
quest-worker-2  disk=ssd
4 pods on quest-worker-2`,
      },
      {
        title: "Taints and tolerations",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-taint > /dev/null
# A taint is a "keep out" sign on a node. This one is reserved for GPU work.
kubectl taint node quest-worker-2 quest-gpu=true:NoSchedule > /dev/null

deploy() {   # name, replicas, extra pod spec (YAML, indented 6)
  kubectl -n quest-taint apply -f - > /dev/null <<YAML
apiVersion: apps/v1
kind: Deployment
metadata: { name: $1 }
spec:
  replicas: $2
  selector: { matchLabels: { app: $1 } }
  template:
    metadata: { labels: { app: $1 } }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - { name: app, image: node:20-slim, command: ["sleep", "3600"] }
$3
YAML
  kubectl -n quest-taint rollout status deployment/$1 --timeout=120s > /dev/null
}
on_gpu() { kubectl -n quest-taint get pods -l app=$1 --field-selector spec.nodeName=quest-worker-2 -o name | wc -l | tr -d ' '; }

# Ordinary pods stay off the tainted node
deploy web 9 ""
echo "web:     $(on_gpu web) of 9 pods on the tainted node"

# A pod that TOLERATES the taint may go there; with a nodeSelector it MUST go there
deploy trainer 2 "      tolerations:
        - { key: quest-gpu, operator: Equal, value: \\"true\\", effect: NoSchedule }
      nodeSelector:
        kubernetes.io/hostname: quest-worker-2"
echo "trainer: $(on_gpu trainer) of 2 pods on the tainted node"
kubectl get node quest-worker-2 -o jsonpath='{range .spec.taints[*]}taint on quest-worker-2: {.key}={.value}:{.effect}{"\\n"}{end}'` }],
        explain: `- \`kubectl taint node quest-worker-2 quest-gpu=true:NoSchedule\` puts up the "reserved" sign. Nine ordinary pods all avoid it.
- The trainer pods **tolerate** the taint and also select that node. Without the nodeSelector they might land anywhere: a toleration only removes the barrier.
- Remove a taint by adding a minus sign: \`kubectl taint node quest-worker-2 quest-gpu-\`.`,
        output: `web:     0 of 9 pods on the tainted node
trainer: 2 of 2 pods on the tainted node
taint on quest-worker-2: quest-gpu=true:NoSchedule`,
      },
      {
        title: "One replica per node",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-spread > /dev/null
# "Never put two of these on the same node", so losing one node never takes out two replicas
kubectl -n quest-spread apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      terminationGracePeriodSeconds: 1
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector: { matchLabels: { app: api } }
              topologyKey: kubernetes.io/hostname       # "same node" = same value of this node label
      containers:
        - { name: api, image: node:20-slim, command: ["sleep", "3600"] }
YAML
kubectl -n quest-spread rollout status deployment/api --timeout=120s > /dev/null
kubectl -n quest-spread get pods -o jsonpath='{range .items[*]}{.spec.nodeName}{"\\n"}{end}' | sort | uniq -c | awk '{print $1 " api pod on " $2}'

# A 4th replica has nowhere to go: every node already has one
kubectl -n quest-spread scale deployment/api --replicas=4 > /dev/null
sleep 3
kubectl -n quest-spread get pods --field-selector=status.phase=Pending -o name | wc -l | awk '{print $1 " pod Pending"}'
kubectl -n quest-spread get events --field-selector reason=FailedScheduling -o jsonpath='{.items[0].message}{"\\n"}' | sed -E 's/\\. .*/./'` }],
        explain: `- Required pod anti-affinity with \`topologyKey: kubernetes.io/hostname\`: no two \`app=api\` pods on the same node. With 3 nodes, 3 replicas fit exactly.
- The 4th replica has nowhere to go and stays **Pending**: that's the cost of a *required* rule. For "spread out if you can", use \`preferredDuringScheduling...\` or a topology spread constraint with \`whenUnsatisfiable: ScheduleAnyway\`.
- Change \`topologyKey\` to \`topology.kubernetes.io/zone\` and the same rule means "one per zone".`,
        output: `1 api pod on quest-server
1 api pod on quest-worker-1
1 api pod on quest-worker-2
1 pod Pending
0/3 nodes are available: 3 node(s) didn't match pod anti-affinity rules.`,
      },
      {
        title: "Drain a node, with a PodDisruptionBudget",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-drain > /dev/null
# 3 replicas kept OFF the control-plane node, and a budget: "at least 3 must always be up"
kubectl -n quest-drain apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      terminationGracePeriodSeconds: 1
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions: [{ key: node-role.kubernetes.io/control-plane, operator: DoesNotExist }]
      containers:
        - { name: web, image: node:20-slim, command: ["sleep", "3600"] }
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: web }
spec:
  minAvailable: 3
  selector: { matchLabels: { app: web } }
YAML
kubectl -n quest-drain rollout status deployment/web --timeout=120s > /dev/null
running() { kubectl -n quest-drain get pods -l app=web --field-selector=status.phase=Running -o name | wc -l | tr -d ' '; }
on_node() { kubectl -n quest-drain get pods -l app=web --field-selector spec.nodeName=$1 -o name | wc -l | tr -d ' '; }
echo "before:   $(running) running, $(on_node quest-server) on the control plane"
# Pick a worker that runs at least one of them
node=$(kubectl -n quest-drain get pods -l app=web -o jsonpath='{.items[0].spec.nodeName}')

# Maintenance on the node: cordon (no new pods) + evict its pods. The budget blocks the eviction.
kubectl drain $node --pod-selector=app=web --timeout=10s 2>&1 | grep -oE 'Cannot evict pod as it would violate the pod.s disruption budget' | head -n 1
kubectl get node $node -o jsonpath='node unschedulable: {.spec.unschedulable}{"\\n"}'

# Relax the budget to "at most 1 down at a time" and the drain goes through
kubectl -n quest-drain patch pdb web --type=json -p='[{"op": "remove", "path": "/spec/minAvailable"}, {"op": "add", "path": "/spec/maxUnavailable", "value": 1}]' > /dev/null
kubectl drain $node --pod-selector=app=web --timeout=120s > /dev/null 2>&1 && echo "drained"
kubectl -n quest-drain rollout status deployment/web --timeout=120s > /dev/null
echo "after:    $(running) running, $(on_node $node) on the drained node"
kubectl uncordon $node > /dev/null && echo "uncordoned: the node takes new pods again"` }],
        explain: `- The PDB says all 3 replicas must stay available, so **no** voluntary eviction is allowed. \`kubectl drain\` cordons the node, then keeps retrying the eviction and gives up after the timeout. Real clusters hit this during upgrades.
- \`--pod-selector\` limits the drain to our pods, so this sample doesn't disturb the cluster's own components. A real drain also needs \`--ignore-daemonsets\` (DaemonSet pods can't move) and often \`--delete-emptydir-data\`.
- With \`maxUnavailable: 1\` the drain evicts one pod at a time; the Deployment recreates each on the remaining worker, and the drain finishes.
- \`kubectl uncordon\` reopens the node. Existing pods don't move back by themselves.`,
        output: `before:   3 running, 0 on the control plane
Cannot evict pod as it would violate the pod's disruption budget
node unschedulable: true
drained
after:    3 running, 0 on the drained node
uncordoned: the node takes new pods again`,
      },
    ],
    interview: [
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
        q: "How do you make sure a service survives the loss of a node or a whole zone?",
        a: "Run at least 2-3 replicas and **spread** them: `topologySpreadConstraints` on `topology.kubernetes.io/zone` (maxSkew 1) and on `kubernetes.io/hostname`, or pod anti-affinity. Size so the remaining zones can carry the load (N+1). Add a **PodDisruptionBudget** (`maxUnavailable: 1`) so drains and upgrades take one at a time, readiness probes so traffic leaves dying pods fast, and make sure dependencies (databases, volumes) are multi-zone too: a zonal PVC pins its pod to one zone. Test it: drain a node, cordon a zone, watch the error rate.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "You taint GPU nodes and add a toleration to your training pods. Why do some training pods still land on normal nodes?",
        options: ["Tolerations are ignored by default", "A toleration only permits tainted nodes; you also need a nodeSelector or affinity to attract the pod", "The taint effect must be NoExecute", "The GPU nodes need a PDB"],
        answer: 1,
        explain: "Taints keep other pods off; selectors/affinity pull your pods on. You need both.",
      },
      {
        q: "A Deployment has 3 replicas and a PDB with minAvailable: 3. You drain a node running one of them. What happens?",
        options: ["The pod is evicted anyway", "The drain keeps retrying and never evicts it until the PDB allows it", "The PDB is deleted", "The node is force-deleted"],
        answer: 1,
        explain: "Evictions that would violate the budget are refused. minAvailable equal to replicas blocks every voluntary disruption.",
      },
      {
        q: "Which taint effect also evicts pods already running on the node?",
        options: ["NoSchedule", "PreferNoSchedule", "NoExecute", "NoEvict"],
        answer: 2,
        explain: "NoExecute evicts running pods that don't tolerate it (after tolerationSeconds if set).",
      },
      {
        q: "Required pod anti-affinity on kubernetes.io/hostname, 3 nodes, 5 replicas. How many pods are Pending?",
        options: ["0", "2", "3", "5"],
        answer: 1,
        explain: "At most one per node, so 3 run and 2 can't be placed.",
      },
      {
        q: "kubectl cordon NODE does what?",
        options: ["Evicts all pods", "Marks the node unschedulable; running pods stay", "Deletes the node", "Restarts the kubelet"],
        answer: 1,
        explain: "drain = cordon + evict. cordon alone only stops new pods from landing there.",
      },
    ],
  },

  // ------------------------------------------------------------------ AUTOSCALING
  {
    id: "k8s-autoscaling",
    title: "Autoscaling",
    tagline: "The Horizontal Pod Autoscaler under real load, its formula and its stabilization windows, plus VPA, KEDA and node autoscaling.",
    difficulty: "intermediate",
    minutes: 18,
    visualizers: ["hpa"],
    concept: `## Explain it like I'm 10 🧸
An ice-cream shop has a rule: "if the queue gets long, open another counter; if the counters stand empty for a while, close one". The manager doesn't guess. Every few minutes they look at how busy each server is and do the maths: "each server is twice as busy as I'd like, so I need twice as many servers".

They're also careful. They open counters **quickly** when the queue grows, but they **wait a while** before closing them, because if they close a counter the moment it's quiet, and the next bus of tourists arrives a minute later, they'd have to open it again. That waiting is the **stabilization window**.

The **Horizontal Pod Autoscaler** (HPA) is that manager for pods: it adds or removes copies based on how busy they are. If there's no room left in the shop for another counter, a different manager, the **cluster autoscaler**, rents more space (adds nodes).

## The HPA formula
Every 15 seconds the HPA reads a metric (usually from metrics-server) and computes:

\`\`\`
desired = ceil( currentReplicas × currentValue / targetValue )
\`\`\`

For CPU, the value is **utilization**: usage divided by the pod's CPU **request**. 4 pods at 90% with a 60% target: \`ceil(4 × 90 / 60) = 6\`. Details that matter:
- pods with no CPU request can't be scaled on CPU utilization (there's nothing to divide by);
- a 10% tolerance avoids tiny adjustments;
- not-yet-ready pods are treated cautiously, so a slow-starting pod doesn't trigger more scaling;
- with several metrics, the HPA takes the **largest** answer.

## Behavior: how fast up, how slow down
\`spec.behavior\` tunes it. The defaults: scale **up** immediately (up to doubling, or +4 pods, every 15 s); scale **down** only to the highest recommendation of the last **300 seconds** (\`stabilizationWindowSeconds\`). You can add policies like "remove at most 10% of pods per minute". The sample shortens scale-down to 20 seconds so you don't wait 5 minutes.

## Autoscaling at three levels (try the visualizer)
- **HPA**: \`desired = ceil(current × currentMetric / target)\`, evaluated every 15 s with a 10% tolerance. Scale-ups are fast (up to double, or +4 pods, per step). Scale-downs wait for a **stabilization window** (5 min by default) to avoid flapping. It scales on CPU or memory, or custom and external metrics (RPS, queue depth via **KEDA**).
- **VPA** adjusts requests and limits per pod (by recreating pods). Don't run it on the same metric as the HPA.
- **Cluster Autoscaler / Karpenter** add nodes when pods are Pending for lack of capacity and remove underused nodes.
The HPA only helps if new pods become ready faster than load grows. Slow startup + a high target = dropped requests during spikes, so keep headroom or pre-scale for known peaks.

## Scaling on the right signal
CPU is a proxy. Better signals are often closer to the user or the work:
- **requests per second** or **latency** (custom metrics through Prometheus Adapter);
- **queue length** or **consumer lag** (external metrics, usually through **KEDA**, which can also scale to zero and back);
- for workers, KEDA can create **Jobs** per batch of messages.

## Things that bite
- **Wrong requests, wrong scaling.** Utilization is relative to requests: requests set 4× too high means the HPA thinks pods are idle.
- **Slow startup.** If pods take 2 minutes to become ready, the HPA reacts 2 minutes late. Keep headroom (a lower target), pre-scale before known peaks, or make startup faster.
- **minReplicas too low.** One pod is one crash away from an outage and has no warm capacity. Use at least 2 for anything user-facing.
- **Don't fight the HPA.** If an HPA manages a Deployment, remove \`replicas\` from your manifests (or GitOps tool), or every deploy resets the count.
- **HPA + VPA on the same metric** fight each other; use the VPA in recommendation mode, or for memory only.`,
    keyPoints: [
      "HPA: desired = ceil(current × currentValue / target), every 15 s, with a 10% tolerance.",
      "CPU utilization is usage divided by requests: no requests, no CPU scaling; wrong requests, wrong scaling.",
      "Scale-up is fast; scale-down waits for a stabilization window (300 s by default) to avoid flapping.",
      "VPA right-sizes requests; Cluster Autoscaler or Karpenter add nodes for Pending pods; KEDA scales on queues and events, even to zero.",
      "Leave replicas out of manifests managed by an HPA, keep minReplicas ≥ 2 for user-facing services, and mind startup time.",
    ],
    code: [
      {
        title: "An HPA under real load",
        note: "Four clients hammer a CPU-hungry app; the HPA adds pods, then removes them when the load stops.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-hpa > /dev/null
# A web app where every request costs ~20ms of CPU. It requests 100m (a tenth of a core) per pod.
kubectl -n quest-hpa apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 1
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: web
          image: node:20-slim
          command: ["node", "-e", "require('http').createServer((q, s) => { const t = Date.now(); while (Date.now() - t < 20) {} s.end('done'); }).listen(8080)"]
          resources:
            requests: { cpu: 100m }
            limits: { cpu: 500m }
---
apiVersion: v1
kind: Service
metadata: { name: web }
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080 }]
---
# Keep average CPU near 50% of the request, with 1 to 5 pods
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: web }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 50 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 20     # default is 300s; short so the demo doesn't take 5 minutes
YAML
kubectl -n quest-hpa rollout status deployment/web --timeout=120s > /dev/null
replicas() { kubectl -n quest-hpa get deployment web -o jsonpath='{.spec.replicas}'; }
# the HPA needs a first CPU reading before it can act
kubectl -n quest-hpa wait --for=jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' hpa/web --timeout=180s > /dev/null
echo "quiet:       $(replicas) replica"

# Rush hour: 4 clients calling non-stop
kubectl -n quest-hpa create deployment load --image=node:20-slim --replicas=4 -- \\
  node -e "const go = () => fetch('http://web').then(r => r.text()).catch(() => {}).finally(go); go(); go();" > /dev/null
for _ in $(seq 1 90); do [ "$(replicas)" -ge 3 ] && break; sleep 2; done
[ "$(replicas)" -ge 3 ] && echo "under load:  scaled up to 3 or more replicas (max 5)"
kubectl -n quest-hpa get hpa web -o jsonpath='{range .status.conditions[?(@.type=="AbleToScale")]}{.type}={.status}{"\\n"}{end}'

# Rush hour is over
kubectl -n quest-hpa delete deployment load > /dev/null
for _ in $(seq 1 120); do [ "$(replicas)" = 1 ] && break; sleep 2; done
echo "quiet again: back to $(replicas) replica"
kubectl -n quest-hpa get events --field-selector involvedObject.kind=HorizontalPodAutoscaler,reason=SuccessfulRescale -o jsonpath='{range .items[*]}{.message}{"\\n"}{end}' \\
  | sed -E 's/New size: [0-9]+; reason: (cpu resource utilization \\(percentage of request\\) above target|All metrics below target)/\\1/' | sort -u` }],
        explain: `- Each request burns about 20 ms of CPU. The pod requests 100m, so one pod serving non-stop is at several hundred percent "utilization" (capped by its 500m limit).
- The HPA aims for 50% of requests on average. Under load it computes a much bigger number and scales up, capped at \`maxReplicas: 5\`; the Service spreads the load across the new pods.
- When the load generator is deleted, usage drops; after the (shortened) 20-second stabilization window, the HPA scales back to \`minReplicas: 1\`.
- The **SuccessfulRescale** events record each decision and its reason. \`kubectl get hpa -w\` shows the numbers live; \`kubectl describe hpa\` shows the conditions (AbleToScale, ScalingActive, ScalingLimited).
- The exact replica count under load depends on the machine's speed, which is why the sample only checks "3 or more".`,
        output: `quiet:       1 replica
under load:  scaled up to 3 or more replicas (max 5)
AbleToScale=True
quiet again: back to 1 replica
All metrics below target
cpu resource utilization (percentage of request) above target`,
      },
    ],
    interview: [
      {
        q: "How does the Horizontal Pod Autoscaler decide how many replicas to run?",
        a: "Every 15 s it computes `desired = ceil(currentReplicas × currentMetricValue / targetValue)`, e.g. 4 pods at 90% CPU with a 60% target → ceil(4 × 90/60) = 6. It ignores changes within a 10% tolerance, treats not-yet-ready pods conservatively, clamps to min/max, and applies **behavior** policies: scale-up can be fast (by default up to 100% or 4 pods per 15 s), while scale-down uses a **stabilization window** (300 s by default, taking the highest recommendation in the window) to prevent flapping. Utilization is relative to **requests**, so wrong requests mean wrong scaling. For queue-driven or bursty workloads, scale on external metrics (queue depth, RPS) with KEDA.",
        freq: "common",
      },
      {
        q: "HPA, VPA, Cluster Autoscaler, Karpenter, KEDA: what does each do and how do they fit together?",
        a: "**HPA** changes the number of pod replicas from metrics (CPU/memory utilization vs requests, custom or external metrics). **VPA** changes pods' requests and limits from observed usage (by evicting and recreating them, or recommendation-only); don't let it act on the metric the HPA scales on. **Cluster Autoscaler** adds nodes from predefined node groups when pods are Pending for lack of capacity, and removes underused nodes. **Karpenter** (AWS-born) does node autoscaling by provisioning right-sized instances straight from pending pods' requirements and consolidating, usually faster and cheaper. **KEDA** is an event-driven scaler that feeds external metrics (queue length, Kafka lag, cron) to an HPA and can scale to and from zero. Together: KEDA/HPA set replicas, VPA sets per-pod size, Karpenter/CA make room.",
        freq: "common",
      },
      {
        q: "Traffic spikes and users get errors for a minute before the HPA catches up. What can you do?",
        a: "The pipeline is slow: metrics are sampled every ~15 s, the HPA syncs every 15 s, then pods must be scheduled (maybe waiting for new **nodes**: minutes), pull images and pass readiness. Fixes: lower the target utilization to keep **headroom**; raise **minReplicas** for peak hours (KEDA cron scaler, scheduled scaling); speed up startup (smaller images, pre-pulled images, lazy init, startup probes tuned); keep spare node capacity with low-priority 'balloon' pods that get preempted; scale on a leading signal like RPS or queue depth instead of CPU; and use `behavior.scaleUp` policies that allow bigger steps.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "HPA: 5 pods at 80% CPU, target 50%. Desired replicas?",
        options: ["5", "7", "8", "10"],
        answer: 2,
        explain: "ceil(5 × 80/50) = ceil(8) = 8.",
      },
      {
        q: "Pods are Pending with 'Insufficient memory'. Which autoscaler helps?",
        options: ["HPA", "VPA", "Cluster Autoscaler / Karpenter", "None"],
        answer: 2,
        explain: "The pods exist but no node fits them, so more nodes are needed.",
      },
      {
        q: "Your pods have no CPU requests. An HPA targeting 60% CPU utilization will…",
        options: ["Use the CPU limit instead", "Be unable to compute utilization for them", "Assume 1 core", "Scale to maxReplicas"],
        answer: 1,
        explain: "Utilization is usage / request. Without requests the HPA reports it can't get the metric.",
      },
      {
        q: "Why does the HPA wait before scaling down?",
        options: ["To save API calls", "The stabilization window avoids flapping when load briefly dips", "Pods can't be deleted quickly", "Metrics-server is slow"],
        answer: 1,
        explain: "By default it uses the highest recommendation from the last 5 minutes.",
      },
    ],
  },
];
