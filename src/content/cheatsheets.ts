export interface CheatSheet {
  id: string;
  title: string;
  emoji: string;
  md: string;
}

export const CHEATSHEETS: CheatSheet[] = [
  {
    id: "playbook",
    title: "Coding interview playbook",
    emoji: "🎯",
    md: `
A repeatable 45-minute script. Interviewers score **communication, problem solving, coding and verification** — not just "did it pass".

1. **Clarify (3–5 min).** Restate the problem. Ask about input size, value ranges, duplicates, negatives, empty input, sortedness, and expected output format. Write 1–2 examples, including an edge case.
2. **Brute force first (2 min).** State the obvious solution and its complexity. It proves you understand the problem and gives a baseline.
3. **Optimize (5–10 min).** Look for the bottleneck. Use the pattern table below. Say the target complexity out loud before coding.
4. **Plan.** Outline the steps in comments or bullet points. Get a nod from the interviewer.
5. **Code (15–20 min).** Clean names, small helpers, no premature micro-optimizations. Talk while you type.
6. **Test (5 min).** Walk through your example *line by line*, then the edge cases. Fix bugs calmly.
7. **Analyze.** Final time and space complexity, and what you'd do with more time (follow-ups).

> If you get stuck: say what you're thinking, try a smaller example, or solve a simpler version (sorted input, no duplicates) first.
`,
  },
  {
    id: "patterns",
    title: "Pattern recognition",
    emoji: "🧩",
    md: `
| If the problem says… | Try… |
|---|---|
| Sorted array, find pair / triplet | Two pointers |
| Contiguous subarray / substring with a constraint | Sliding window |
| Subarray sum equals k, range sums | Prefix sums + hash map |
| "Next greater / smaller", spans, histograms | Monotonic stack |
| Top / smallest k, k-th largest, merge k sorted | Heap |
| Sorted input, "minimum possible maximum", monotonic answer | Binary search (on the answer) |
| Overlapping intervals, meeting rooms | Sort by start (or end) + sweep |
| Linked list cycle, middle, k-th from end | Fast & slow pointers |
| Tree paths, depth, subtree properties | DFS (recursion) |
| Shortest path in unweighted graph / grid, levels | BFS |
| Weighted shortest path, non-negative weights | Dijkstra |
| Dependencies, prerequisites, build order | Topological sort |
| Connected components, "are these connected?" online | Union-Find |
| All combinations / permutations / subsets | Backtracking |
| Count ways, min / max cost, "can you reach" with overlap | Dynamic programming |
| Prefix lookups, autocomplete, word search | Trie |
| Frequent elements, dedup, O(1) lookup | Hash map / set |
| Bits, XOR tricks, subsets of small n (≤ 20) | Bit manipulation / bitmask DP |
| n ≤ 20 | Exponential is allowed: 2ⁿ backtracking or bitmask |
| n ≤ 10⁵ – 10⁶ | Aim for O(n log n) or O(n) |
`,
  },
  {
    id: "bigo",
    title: "Data structure complexity",
    emoji: "📊",
    md: `
| Structure | Access | Search | Insert | Delete | Notes |
|---|---|---|---|---|---|
| Array (dynamic) | O(1) | O(n) | O(1)* end / O(n) | O(n) | *amortized |
| Linked list | O(n) | O(n) | O(1) at node | O(1) at node | O(n) to find the node |
| Stack / Queue | — | O(n) | O(1) | O(1) | |
| Hash map / set | — | O(1) avg | O(1) avg | O(1) avg | O(n) worst |
| Balanced BST (TreeMap) | — | O(log n) | O(log n) | O(log n) | ordered |
| Binary heap | O(1) top | O(n) | O(log n) | O(log n) pop | heapify is O(n) |
| Trie | — | O(L) | O(L) | O(L) | L = key length |
| Union-Find | — | ≈O(1) | ≈O(1) | — | inverse Ackermann |
| Graph adj. list | — | O(V+E) traverse | O(1) edge | O(deg) | space O(V+E) |

### Sorting
| Algorithm | Best | Average | Worst | Space | Stable |
|---|---|---|---|---|---|
| Quicksort | n log n | n log n | n² | log n | No |
| Merge sort | n log n | n log n | n log n | n | Yes |
| Heap sort | n log n | n log n | n log n | 1 | No |
| Insertion sort | n | n² | n² | 1 | Yes |
| Counting / radix | n + k | n + k | n + k | n + k | Yes |
| Timsort (Python, Java objects) | n | n log n | n log n | n | Yes |

### Graph algorithms
| Algorithm | Time | Use for |
|---|---|---|
| BFS / DFS | O(V + E) | reachability, components, unweighted shortest path |
| Dijkstra (binary heap) | O((V + E) log V) | non-negative weighted shortest path |
| Bellman-Ford | O(V · E) | negative weights, detect negative cycles |
| Floyd-Warshall | O(V³) | all-pairs shortest paths, small V |
| Topological sort (Kahn) | O(V + E) | DAG ordering, cycle detection |
| Kruskal / Prim | O(E log V) | minimum spanning tree |
`,
  },
  {
    id: "latency",
    title: "Latency numbers",
    emoji: "⏱️",
    md: `
The classic table (Jeff Dean / Peter Norvig). Exact values have improved with modern hardware — **memorize the orders of magnitude**.

| Operation | Time | Human scale (×1 billion) |
|---|---|---|
| L1 cache reference | 0.5 ns | 0.5 s |
| Branch mispredict | 5 ns | 5 s |
| L2 cache reference | 7 ns | 7 s |
| Mutex lock/unlock | 25 ns | 25 s |
| Main memory reference | 100 ns | 1.7 min |
| Compress 1 KB (Snappy) | 3 µs | 50 min |
| Send 1 KB over 1 Gbps | 10 µs | 2.8 hours |
| Random 4 KB read from SSD | 150 µs | 1.7 days |
| Read 1 MB sequentially from memory | 250 µs | 2.9 days |
| Round trip in the same datacenter | 500 µs | 5.8 days |
| Read 1 MB sequentially from SSD | 1 ms | 11.6 days |
| HDD seek | 10 ms | 3.8 months |
| Read 1 MB sequentially from HDD | 20 ms | 7.7 months |
| Packet CA → Netherlands → CA | 150 ms | 4.8 years |

**Takeaways:** memory is ~100× faster than SSD random reads; sequential beats random everywhere; cross-region round trips (~100 ms+) dwarf everything inside a datacenter — design to minimize them.
`,
  },
  {
    id: "estimation",
    title: "Back-of-envelope numbers",
    emoji: "🧮",
    md: `
### Powers of two
| Power | Exact | Approx | Unit |
|---|---|---|---|
| 2¹⁰ | 1,024 | 1 thousand | KB |
| 2²⁰ | 1,048,576 | 1 million | MB |
| 2³⁰ | ~1.07 × 10⁹ | 1 billion | GB |
| 2⁴⁰ | ~1.1 × 10¹² | 1 trillion | TB |
| 2⁵⁰ | ~1.1 × 10¹⁵ | 1 quadrillion | PB |

### Time
- 1 day = 86,400 s ≈ **10⁵ s** · 1 month ≈ 2.6 × 10⁶ s · 1 year ≈ 3 × 10⁷ s
- **1 million requests/day ≈ 12 QPS**; 1 billion/day ≈ 12,000 QPS
- Peak traffic ≈ **2–3× average** (plan capacity for peak)

### Sizes
- char (ASCII) 1 B · int 4 B · long / timestamp 8 B · UUID 16 B
- a tweet-sized text row ≈ 300 B–1 KB · profile photo ≈ 200 KB · 1 min of 1080p video ≈ 50–100 MB

### Rough single-node capacity (order of magnitude)
- Stateless web/app server: 1k–10k simple RPS
- Relational DB (well indexed): ~10k reads/s, ~1–5k writes/s
- Redis: ~100k ops/s
- Kafka broker: ~100k+ msgs/s (MB/s is the real limit)

### Template
\`\`\`
QPS        = DAU × actions per user per day / 86,400   (× 2–3 for peak)
Storage    = new items per day × size × retention days × replication factor
Bandwidth  = QPS × payload size
Cache size = ~20% of daily read volume (80/20 rule)
\`\`\`
`,
  },
  {
    id: "system-design",
    title: "System design interview template",
    emoji: "🏙️",
    md: `
1. **Requirements (5 min).** Functional (what it does — 3 to 5 core features) and non-functional (scale, latency, availability vs consistency, durability). Agree on what's *out of scope*.
2. **Estimation (3 min).** QPS (read vs write), storage growth, bandwidth. Identify read-heavy vs write-heavy.
3. **API (3 min).** The main endpoints with request/response shapes. Pagination, idempotency keys for writes.
4. **Data model (5 min).** Entities, keys, access patterns → SQL vs NoSQL choice, indexes, partition key.
5. **High-level design (10 min).** Clients → DNS/CDN → load balancer → stateless services → cache → databases, plus queues/workers for async work. Draw it.
6. **Deep dives (15 min).** The 1–2 hardest parts: hot keys, fan-out, consistency, ordering, exactly-once, search, geo. Discuss trade-offs explicitly.
7. **Wrap up.** Bottlenecks, single points of failure, monitoring/alerting, how it evolves at 10× scale.

### Building-block checklist
- **Scale reads:** cache (Redis), read replicas, CDN, denormalization
- **Scale writes:** sharding/partitioning, async queues, batching, LSM-based stores
- **Availability:** replication, multiple AZs/regions, health checks, failover, graceful degradation
- **Consistency:** strong (leader + quorum/consensus) vs eventual (async replication) — say which and why
- **Async:** message queues (SQS/RabbitMQ) for tasks, logs (Kafka) for event streams
- **Protect the system:** rate limiting, timeouts, retries with exponential backoff + jitter, circuit breakers, backpressure
- **Unique IDs:** UUID, Snowflake (timestamp + machine + sequence), DB sequences per shard
- **Observability:** metrics, logs, traces; SLOs and alerts
`,
  },
  {
    id: "distributed",
    title: "Distributed systems cheat sheet",
    emoji: "🌌",
    md: `
- **CAP:** during a network **P**artition you must choose **C**onsistency (reject/blocked requests) or **A**vailability (serve possibly stale data). **PACELC:** *Else* (no partition) choose **L**atency or **C**onsistency.
- **Quorum:** N replicas, write to W, read from R. **R + W > N** ⇒ read and write sets overlap ⇒ reads see the latest acknowledged write (with caveats: sloppy quorums, concurrent writes). Typical: N=3, W=2, R=2.
- **Consensus (Raft/Paxos):** tolerates **f** crash failures with **2f + 1** nodes; needs a majority to make progress. Byzantine faults need **3f + 1**.
- **Consistency models (strong → weak):** linearizable → sequential → causal → read-your-writes / monotonic reads → eventual.
- **Clocks:** wall clocks drift; use **Lamport clocks** for a total order consistent with causality, **vector clocks** to detect concurrency, hybrid logical clocks (HLC) in practice; Spanner uses TrueTime with bounded uncertainty.
- **Partitioning:** hash (even spread, no range scans) vs range (range scans, hot spots). **Consistent hashing** moves only ~K/N keys when a node joins/leaves; virtual nodes smooth the load.
- **Replication:** single-leader (simple, write bottleneck), multi-leader (geo writes, conflicts), leaderless (Dynamo-style quorums, read repair, hinted handoff).
- **Transactions across services:** 2PC (atomic but blocking if the coordinator dies), **Sagas** (local transactions + compensations), **transactional outbox** for reliable event publishing.
- **Delivery semantics:** at-most-once, at-least-once (+ idempotent consumers = effectively once), exactly-once only within a closed system (e.g. Kafka transactions).
- **Failure detection:** heartbeats + timeouts, phi-accrual detectors, gossip membership (SWIM).
- **Locks & leases:** a lease can expire while the holder is paused (GC) — protect resources with **fencing tokens**.
- **Storage engines:** B-trees (read-optimized, in-place updates) vs **LSM-trees** (write-optimized: memtable → SSTables → compaction, Bloom filters to skip files).
`,
  },
  {
    id: "ai-inference",
    title: "AI inference cheat sheet",
    emoji: "🧠",
    md: `
### Memory
- **Weights** = parameters × bytes per parameter. FP32 = 4 B, FP16/BF16 = 2 B, FP8/INT8 = 1 B, INT4 = 0.5 B.
  - 7B @ FP16 ≈ **14 GB** · 70B @ FP16 ≈ **140 GB** · 70B @ INT4 ≈ **35 GB**
- **KV cache per token** = 2 (K and V) × layers × KV heads × head dim × bytes.
  - Llama-2-7B (32 layers, 32 heads × 128, FP16): 2 × 32 × 32 × 128 × 2 B = **512 KB/token** → 4k context ≈ 2 GB per sequence.
  - Grouped-query attention (e.g. 8 KV heads instead of 32) shrinks the cache 4×.
- Total ≈ weights + KV cache × concurrent sequences + activations/overhead (~10–20%).

### Compute and speed
- Forward pass ≈ **2 × params FLOPs per token**; training ≈ **6 × params × tokens**.
- **Prefill** (processing the prompt) is compute-bound and parallel across tokens.
- **Decode** (one token at a time) is **memory-bandwidth-bound**: every step must stream all weights from HBM. Upper bound at batch 1 ≈ bandwidth ÷ model bytes (H100 ≈ 3.35 TB/s ÷ 14 GB ≈ 240 tokens/s for a 7B FP16 model).
- Batching amortizes weight reads across sequences → much higher throughput, slightly higher per-token latency.

### Latency metrics
- **TTFT** (time to first token) — dominated by queueing + prefill.
- **TPOT / ITL** (time per output token / inter-token latency) — decode speed.
- **End-to-end** ≈ TTFT + TPOT × (output tokens − 1).
- **Throughput** — tokens/s across all users. **Goodput** — throughput that still meets latency SLOs.

### The optimization menu
| Technique | Helps |
|---|---|
| KV cache | avoids recomputing past tokens (decode O(n) per step instead of O(n²)) |
| PagedAttention (vLLM) | KV memory fragmentation → more concurrent sequences |
| Continuous batching | GPU utilization, throughput |
| Quantization (INT8/INT4, FP8) | memory, bandwidth, cost |
| Speculative decoding | latency (2–3× when the draft is often right) |
| FlashAttention | attention memory traffic, long context |
| Prefix caching | shared system prompts / RAG context |
| Tensor / pipeline parallelism | models bigger than one GPU |
| Disaggregated prefill/decode | isolate compute-bound vs memory-bound phases |

### Common GPUs (HBM capacity · bandwidth)
A100 40/80 GB · ~1.6–2 TB/s — H100 SXM 80 GB · 3.35 TB/s — H200 141 GB · 4.8 TB/s — L4 24 GB · 300 GB/s — RTX 4090 24 GB · ~1 TB/s
`,
  },
  {
    id: "infra",
    title: "Infra & SRE cheat sheet",
    emoji: "⚓",
    md: `
### Networking
- **Round trips before the first byte**: TCP 1 + TLS 1.3 1 (TLS 1.2: 2) + request 1. HTTP/3 (QUIC): 2 total, 1 with 0-RTT resumption.
- **CIDR**: /n leaves 32 − n host bits. /16 = 65,536 · /20 = 4,096 · /24 = 256 · /28 = 16. AWS reserves 5 per subnet.
- **Private ranges**: 10/8 · 172.16/12 · 192.168/16 · CGNAT 100.64/10 · metadata 169.254.169.254.
- **Throughput ≤ window ÷ RTT**. Bandwidth-delay product = bandwidth × RTT.
- **Ports**: 22 SSH · 53 DNS · 80/443 HTTP(S) · 3306 MySQL · 5432 Postgres · 6379 Redis · 9092 Kafka · 2379 etcd · 6443 k8s API · 9090 Prometheus.

### Linux triage (first 60 seconds)
\`uptime\` → \`dmesg -T | tail\` → \`vmstat 1\` → \`mpstat -P ALL 1\` → \`pidstat 1\` → \`iostat -xz 1\` → \`free -m\` → \`df -h\` / \`df -i\` → \`ss -s\` → \`sar -n TCP,ETCP 1\` → \`top\`.
- Exit **137** = SIGKILL (often OOM) · **143** = SIGTERM · load average counts **D-state** (I/O) tasks too.

### Deployments
Recreate (downtime) · Rolling (mixed versions) · Blue/green (2× capacity, instant rollback) · Canary (smallest blast radius) · Feature flags (deploy ≠ release) · Schema: **expand → migrate → contract**.

### SRE numbers
| SLO | Downtime / 30 days | / year |
|---|---|---|
| 99% | 7.2 h | 3.65 d |
| 99.9% | 43.2 min | 8.76 h |
| 99.95% | 21.6 min | 4.38 h |
| 99.99% | 4.3 min | 52.6 min |
| 99.999% | 26 s | 5.3 min |
- **Error budget** = 1 − SLO. **Burn rate** = error rate ÷ (1 − SLO). Page at 14.4× over 1 h or 6× over 6 h; ticket at 1× over 3 d.
- **Serial** availability multiplies (0.999³ ≈ 99.7%). **Redundant** independent copies: 1 − (1 − a)².
- **RTO** = time to recover, **RPO** = data you can lose. Backup/restore → pilot light → warm standby → active-active.

### Observability
Golden signals (latency, traffic, errors, saturation) · RED for services · USE for resources · histograms aggregate, summaries don't · never average percentiles · keep label cardinality bounded · propagate \`traceparent\`.
`,
  },
  {
    id: "docker",
    title: "Docker cheat sheet",
    emoji: "🐳",
    md: `
### Everyday commands
| Task | Command |
|---|---|
| Run in the background | \`docker run -d --name web -p 8080:3000 -v data:/data -e MODE=prod app:1.4.2\` |
| See everything | \`docker ps -a\` · \`docker images\` · \`docker volume ls\` · \`docker network ls\` · \`docker system df\` |
| Look inside | \`docker logs -f --tail 100 web\` · \`docker exec -it web sh\` · \`docker inspect web\` · \`docker stats\` |
| Stop / remove | \`docker stop web\` (SIGTERM, 10 s, SIGKILL) · \`docker rm -f web\` · \`docker system prune\` |
| Build and ship | \`docker build -t app:1.4.2 .\` · \`docker tag\` · \`docker push\` · \`docker buildx build --platform linux/amd64,linux/arm64 --push\` |
| Compose | \`docker compose up -d --build --wait\` · \`ps\` · \`logs -f\` · \`exec\` · \`down\` (\`-v\` deletes volumes) |

### Exit codes
**0** finished · **1** app error · **125** docker couldn't run it · **126** not executable · **127** command not found · **137** SIGKILL (OOM? check \`OOMKilled\`; or a stop timeout) · **143** SIGTERM handled.

### Dockerfile checklist
Pinned slim base · dependency manifests **before** source · \`npm ci\`/lockfile installs · cleanup in the **same** \`RUN\` · \`.dockerignore\` · multi-stage (build tools stay behind) · no secrets in layers (\`RUN --mount=type=secret\`) · \`USER\` non-root · exec-form \`CMD ["node", "server.js"]\` + a SIGTERM handler · \`HEALTHCHECK\` · OCI labels.

### Where things go
- **Code and dependencies**: the image. **Config**: environment variables. **Secrets**: mounted files. **Data**: named volumes (databases), bind mounts (dev code), tmpfs (scratch).
- **Networking**: user-defined networks give DNS by container/service name; \`localhost\` is the container itself; apps must listen on \`0.0.0.0\`; \`EXPOSE\` documents, \`-p\` publishes.

### Under the hood
Container = process + **namespaces** (pid, mnt, net, uts, ipc, user, cgroup) + **cgroup** limits (\`memory.max\` → OOM kill, \`cpu.max\` → throttling, \`pids.max\`) + **overlayfs** root (read-only image layers + a writable layer: copy-up, whiteouts) + dropped capabilities and seccomp. CLI → dockerd → containerd → shim → runc → kernel. Images are OCI: index → manifest → config + layers, all sha256-addressed.

### Never in production
\`:latest\` · \`--privileged\` · mounting \`docker.sock\` · secrets in \`ENV\` or layers · running as root · no memory limit · logs without rotation (json-file needs \`max-size\`).
`,
  },
  {
    id: "kubernetes",
    title: "Kubernetes cheat sheet",
    emoji: "☸️",
    md: `
### Everyday kubectl
| Task | Command |
|---|---|
| What's running, where | \`kubectl get pods -o wide\` · \`get all -n shop\` · \`-A\` all namespaces · \`-w\` watch · \`-l app=web\` |
| Why is it like that | \`kubectl describe pod web-7d4\` (Events at the bottom) · \`kubectl get events --sort-by=.lastTimestamp\` |
| Logs | \`kubectl logs deploy/web -f\` · \`--previous\` · \`-c sidecar\` · \`-l app=web --prefix\` |
| Get inside | \`kubectl exec -it web-7d4 -- sh\` · \`kubectl debug -it web-7d4 --image=busybox --target=web\` · \`kubectl port-forward svc/web 8080:80\` |
| Deploy | \`kubectl apply -f\` / \`-k\` · \`kubectl diff -k .\` · \`kubectl rollout status\` / \`history\` / \`undo\` / \`restart deploy/web\` |
| Exact fields | \`-o yaml\` · \`-o jsonpath='{.status.podIP}'\` · \`kubectl explain pod.spec.containers.resources\` |
| YAML fast | \`kubectl create deploy web --image=nginx:1.27 --dry-run=client -o yaml\` |
| Who may | \`kubectl auth can-i create pods -n shop --as=system:serviceaccount:shop:ci\` · \`--list\` |
| Nodes | \`kubectl top nodes\` · \`kubectl cordon\` · \`kubectl drain --ignore-daemonsets --delete-emptydir-data\` · \`kubectl uncordon\` |

### Pick the right object
Deployment (stateless copies) · StatefulSet (stable names + a disk each) · DaemonSet (one per node) · Job / CronJob (run to completion / on a schedule) · Service (stable name + load balancing) · Ingress / Gateway (HTTP front door) · ConfigMap / Secret (config, credentials) · PVC (storage) · HPA (scale on metrics) · PDB (limit voluntary evictions) · NetworkPolicy (who may connect) · Role + RoleBinding (who may do what).

### Troubleshooting
| Symptom | Look at |
|---|---|
| Pending | \`describe pod\` → FailedScheduling: Insufficient cpu/memory (requests), untolerated taint, affinity/selector, unbound PVC |
| ImagePullBackOff | image name/tag, registry auth (\`imagePullSecrets\`), rate limits, network |
| CrashLoopBackOff | \`logs --previous\` + exit code: 1 app error · 137 SIGKILL (OOMKilled or liveness) · 143 SIGTERM |
| CreateContainerConfigError | a missing Secret/ConfigMap or key |
| Running, 0/1 Ready | readiness probe: port, path, dependencies |
| Service unreachable | selector ↔ labels, \`kubectl get endpointslices\`, readiness, targetPort, NetworkPolicy, DNS (\`svc.ns.svc.cluster.local\`) |
| Stuck Terminating | finalizers (\`metadata.finalizers\`) waiting for a controller |

### Resources and scaling
- **Requests** schedule, **limits** enforce: CPU over limit → throttled, memory over limit → OOMKilled. QoS: Guaranteed (requests = limits) > Burstable > BestEffort (evicted first).
- **HPA**: desired = ceil(current × metric ÷ target), checked every 15 s, 5 min scale-down stabilization; CPU % is relative to **requests**.
- **Zero-downtime deploy**: readiness probe + maxUnavailable 0 + preStop sleep + SIGTERM handling + PDB + replicas spread across nodes/zones.

### Probes
**startup** (slow boot; others wait) · **liveness** (restart: check the process only, never dependencies) · **readiness** (in/out of the Service: dependencies belong here).

### Security baseline
Own ServiceAccount per app (\`automountServiceAccountToken: false\` if it never calls the API) · least-privilege Roles, no \`*\` · Pod Security \`restricted\`: runAsNonRoot, drop ALL, no privilege escalation, seccomp RuntimeDefault · readOnlyRootFilesystem · secrets as files from a secret manager · default-deny NetworkPolicies · pinned images (digests), scanned and signed.

### Never in production
\`:latest\` · \`privileged: true\` · secrets in manifests or Git · liveness probes that check the database · no requests · one replica of anything important · \`kubectl edit\` instead of Git.
`,
  },
  {
    id: "agents",
    title: "AI engineering & agents cheat sheet",
    emoji: "🤖",
    md: `
### Models
- **Training**: pretrain (next token, compute ≈ 6·N·D) → SFT → preference tuning (RLHF / DPO / RLAIF) → RL on verifiable rewards (reasoning, agents) → distillation.
- **MoE**: total params ≫ active params (top-k experts per token). **GQA / MLA** shrink the KV cache. **RoPE scaling** (YaRN) extends context. Effective context < advertised.
- **Reasoning / test-time compute**: thinking budgets, self-consistency (vote), best-of-N + verifier (≤ pass@N). Thinking tokens bill as output.

### Context engineering
- Order for caching: **system → tools → static docs → conversation → latest message**. No timestamps at the top.
- Agents: minimal non-overlapping tools · just-in-time retrieval · truncate tool output · compaction · notes / to-do files · sub-agents · memory files (CLAUDE.md / AGENTS.md).
- Structured output: JSON-schema / constrained decoding, then validate in code.

### Tools & MCP
- Function calling: the model emits {name, input}, **your code executes**, and you return a tool_result with the call id.
- MCP: host → one client per server → server, over JSON-RPC 2.0. Primitives: **tools / resources / prompts**, plus client-side **sampling / roots / elicitation**. Transports: **stdio** (local), **streamable HTTP** (remote, OAuth 2.1).
- Good tools: few and task-shaped, namespaced, clear docs, concise output, actionable errors, idempotent side effects.

### Agent harness checklist
Loop + budgets · tool registry · sandbox (fs + network) · permissions (allow / ask / deny, modes) · hooks for invariants · context manager (truncate, compact) · memory · sub-agents · checkpoints · streaming + interrupt · traces & cost.

### Patterns
Augmented LLM → prompt chaining → routing → parallelization (sectioning / voting) → orchestrator-workers → evaluator-optimizer → autonomous agent. Use the simplest one that passes evals.

### Retrieval
Hybrid (BM25 + dense) → **RRF** Σ 1/(60 + rank) → cross-encoder rerank → top 5–10. Contextual retrieval for chunks. Measure **recall@k** separately from answer quality.

### Evals
Code graders > LLM judge (watch position, verbosity and self-preference bias; calibrate vs humans) > humans for scale. Agents: grade end states, multiple trials, **pass@k = 1 − (1 − p)^k**, **pass^k = p^k**. 500 items at 70% ≈ ±4 pts (95% CI).

### Security
**Lethal trifecta**: private data + untrusted content + exfiltration channel. Break a leg. Least privilege · sandbox · policy enforced in code · approvals for external or irreversible actions · treat model output as untrusted · budgets against denial-of-wallet.

### LLMOps
Cost = in·p_in + out·p_out · cache prefixes · batch API ≈ half price · route / cascade · retries with backoff + jitter, fallbacks, timeouts · trace prompts, tokens, cost · prompt → RAG → fine-tune (LoRA / QLoRA ≈ < 1% trainable params).
`,
  },
  {
    id: "os",
    title: "Operating systems cheat sheet",
    emoji: "🖥️",
    md: `
### Processes & threads
- **Process** = address space + resources (fds, PID, credentials). **Thread** = registers + stack + TLS inside a process. Threads share heap, globals and fds.
- **fork** copies (copy-on-write) → **exec** replaces the program → parent **wait**s. Exited but not reaped = **zombie**; parent died = **orphan** (adopted by init).
- States: R running/runnable · S sleeping · D uninterruptible (disk) · T stopped · Z zombie.
- Context switch ≈ 1–5 µs + cold caches/TLB. Thread switch is cheaper (no page-table switch).

### Scheduling
FCFS (convoy effect) · SJF/SRTF (optimal average wait, needs prediction, starves long jobs) · Round Robin (quantum ≫ switch cost) · Priority (+ **aging** against starvation) · MLFQ · Linux **CFS/EEVDF** (lowest virtual runtime first, nice = weight). Turnaround = finish − arrival; waiting = turnaround − burst.

### Concurrency
- Race = unsynchronised access, at least one write. counter++ is load/add/store.
- **Mutex** (owned, sleeps) · **spinlock** (busy-waits, short sections) · **semaphore** (counter, no owner) · **condition variable** (always wait in a *while* loop) · **RW lock** · atomics/CAS.
- **Deadlock needs all 4**: mutual exclusion, hold and wait, no preemption, circular wait. Prevent with a global lock order; avoid with **Banker's**; detect with a wait-for graph cycle.

### Memory
- Virtual address = page number + offset (4 KiB pages: low 12 bits). Page table entry: frame, present, R/W/X, user, dirty, accessed.
- **TLB** caches translations. Multi-level tables (x86-64: 4 levels). Huge pages cut TLB misses.
- Page fault: **minor** (in RAM, just map) · **major** (read from disk) · **invalid** → SIGSEGV.
- Replacement: OPT (ideal) · LRU (approximated by **Clock**) · FIFO (**Belady's anomaly**). **Thrashing** = working sets > RAM.
- Stack (per thread, auto, ~8 MiB) vs heap (malloc: brk / mmap). Internal vs external fragmentation; buddy and slab allocators.

### Files, storage & I/O
- **inode** = metadata + block pointers (no name). Directory = name → inode. **Hard link** = another name, same inode; **symlink** = a file holding a path. rm = unlink a name.
- fd table → open file description (offset, flags) → inode. Page cache; **fsync** for durability; journaling for crash consistency.
- Disk arm: FCFS · SSTF · SCAN · C-SCAN · LOOK · C-LOOK. RAID 0 stripe · 1 mirror · 5 parity · 10 mirror+stripe.
- I/O models: blocking · non-blocking · multiplexing (**select / poll / epoll**, kqueue) · async (io_uring). DMA moves data without the CPU.
- IPC: pipe · FIFO · Unix socket (can pass fds) · shared memory (fastest, needs sync) · message queue · signals (SIGTERM can be caught, SIGKILL/SIGSTOP can't).

### Security & containers
- chmod: r=4 w=2 x=1 for owner/group/others; only the **first matching class** is checked; root skips. umask 022 → files 644, dirs 755. setuid 4000, setgid 2000, sticky 1000.
- Least privilege: drop privileges (setgroups → setgid → setuid), **capabilities**, seccomp, SELinux/AppArmor (MAC). NX + ASLR + canaries against memory bugs.
- VM = own kernel on a hypervisor (KVM, Xen, ESXi; VT-x + EPT). **Container** = host process + **namespaces** (pid, mnt, net, uts, ipc, user, cgroup, time) + **cgroups** (memory.max → OOM kill, exit 137; cpu.max → throttling) + overlayfs layers.

### Debugging Linux in 60 seconds
uptime · dmesg -T | tail · vmstat 1 · mpstat -P ALL 1 · pidstat 1 · iostat -xz 1 · free -m · sar -n DEV 1 · sar -n TCP,ETCP 1 · top. Then strace, lsof, ss, perf, eBPF tools. **USE**: utilisation, saturation, errors for every resource.
`,
  },
  {
    id: "compilers",
    title: "Compilers cheat sheet",
    emoji: "⚒️",
    md: `
### The pipeline
source → **lexer** (tokens) → **parser** (AST) → **semantic analysis** (scopes, types) → **IR** (three-address code, CFG, SSA) → **optimizer** → **back end** (instruction selection, scheduling, register allocation) → assembly → **assembler** (object file) → **linker** (executable) → **loader** (process).
- Front end = language-specific; back end = CPU-specific; the IR in the middle gives M languages × N CPUs with M + N parts (LLVM).
- gcc -E (preprocess) · -S (assembly) · -c (object file) · -save-temps -v (keep everything). clang -emit-llvm -S for LLVM IR.

### Lexing & automata
- Token = kind + lexeme + position. **Maximal munch**: longest match wins (\`<=\` over \`<\`, \`iffy\` is a name); ties go to the earlier rule (keywords before names).
- Regex → NFA (Thompson) → DFA (subset construction, up to 2ⁿ states) → minimal DFA (unique). DFA matching is O(n), no backtracking. Backtracking engines risk **ReDoS**.
- Regular languages can't count: balanced brackets need a grammar (a stack).

### Grammars & parsing
- Ambiguity (\`1 + 2 * 3\` with two trees) is fixed by precedence and associativity levels. Left recursion breaks recursive descent: rewrite as a loop.
- **Recursive descent**: one function per rule. **Pratt**: binding powers (left, right); right below left = right-associative (\`^\`, \`=\`).
- **LL(1)**: top-down, FIRST/FOLLOW, one lookahead token; a cell with two rules = conflict. **LR/LALR**: bottom-up shift/reduce, handles left recursion; yacc and bison. Shift/reduce and reduce/reduce conflicts.
- Parse tree keeps every token; AST keeps meaning.

### Semantic analysis & types
- Symbol table = stack of scopes (name → declaration). Lexical scoping: meaning is fixed where the code is written; a resolver records each use's scope depth.
- Static vs dynamic (when types are checked) · strong vs weak (implicit conversions). Error type to stop cascades.
- **Hindley–Milner**: fresh type variables, generate equations, **unify**; occurs check rejects infinite types; let-polymorphism generalises.

### Interpreters & VMs
- Tree-walker: evaluate(node) with environments (dict + parent link). Closure = function + its defining environment (heap, not stack). return via exception.
- Bytecode: compact, linear, cache-friendly. Stack VM (JVM, CPython, Wasm) vs register VM (Lua, Dalvik): fewer instructions vs simpler compiler. Backpatch forward jumps. Faster dispatch: computed goto, superinstructions, quickening.

### IR & optimization
- Basic block = straight-line code, one entry and one exit; CFG edges = jumps. **SSA**: every variable assigned once; **φ** merges values at joins; place φ at dominance frontiers.
- Constant folding/propagation · copy propagation · CSE/GVN · dead code elimination · **inlining** (enables everything else) · LICM · strength reduction · loop unrolling · vectorization · tail calls.
- Data-flow analysis: liveness (backward), reaching definitions (forward), iterate to a **fixpoint**.
- Undefined behaviour (signed overflow, null deref, out of bounds) lets the optimizer assume it never happens: \`x + 1 > x\` → true.
- LLVM: typed SSA IR, \`alloca\` + mem2reg instead of building SSA in the front end; opt runs passes; \`-O0/-O1/-O2/-O3/-Os\`, \`-flto\`, PGO.

### Back end
- x86-64 System V: args in rdi, rsi, rdx, rcx, r8, r9; result in rax; callee-saved rbx, rbp, r12–r15; rsp 16-byte aligned at every call. cqo + idiv: quotient rax, remainder rdx.
- Instruction selection = tile the IR tree (maximal munch, or optimal by dynamic programming). lea does address arithmetic in one instruction.
- **Register allocation**: interference graph colouring (Chaitin–Briggs: simplify, spill, select; coalescing) vs **linear scan** (fast, for JITs; spill the interval ending furthest away). Spill = store after def, load before use.
- Peephole: push/pop → mov, mov reg, 0 → xor, multiply by 2ᵏ → shift.

### Linking, runtimes & JITs
- Object file: .text .data .bss .rodata, symbols (T, D, B defined; U undefined), relocations. Linker: resolve each symbol to exactly one definition, then patch. "undefined reference" = missing definition; "multiple definition" = two strong definitions.
- Static (.a, copied in) vs dynamic (.so, loaded by ld.so; PLT stubs + GOT, lazy binding; -fPIC, PIE + ASLR). C++ **name mangling**; extern "C" turns it off.
- GC: reference counting (immediate, leaks cycles) · mark-sweep · mark-compact · copying (cost ∝ live objects) · **generational** (most objects die young; write barrier records old → young) · concurrent (tri-colour marking).
- vtable = per-class array of function pointers; zero-cost exceptions use unwind tables, paid only when throwing.
- JIT tiers: interpreter → baseline → optimizing (V8: Ignition, Sparkplug, Maglev, TurboFan; HotSpot: C1, C2). Type feedback → speculation behind **guards** → **deoptimization**. Inline caches (mono-, poly-, megamorphic), OSR, W^X.
`,
  },
  {
    id: "communication",
    title: "Talking like a senior engineer",
    emoji: "🗣️",
    md: `
- **Narrate trade-offs, not just choices.** "I'll use a hash map — O(n) extra space, but it takes us from O(n²) to O(n)."
- **Name the pattern.** "This is a sliding-window problem because we need the longest *contiguous* substring."
- **Quantify.** "At 10k QPS with 1 KB responses that's 10 MB/s — a single cache node handles that easily."
- **Say what you'd monitor.** Error rate, p99 latency, queue lag, cache hit ratio, replication lag.
- **Admit unknowns, then reason.** "I don't remember Kafka's exact limits, but partitions are the unit of parallelism, so…"
- **Close the loop.** Restate your final complexity, edge cases covered, and one improvement you'd make next.
`,
  },
];
