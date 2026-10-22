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
