import type { World } from "../types";
import { systemDesignCases } from "./system-design-cases";

export const systemDesign: World = {
  id: "system-design",
  order: 5,
  title: "Skyline City",
  subtitle: "Scalability building blocks & classic design interviews",
  description:
    "Learn the components every large system is built from — load balancers, caches, databases, queues, CDNs — then put them together in the case studies interviewers actually ask.",
  emoji: "🏙️",
  color: "#38bdf8",
  boss: {
    name: "The Titan of Scale",
    title: "Bringer of the Thundering Herd",
    emoji: "🦾",
    taunt: "One million requests per second just arrived. Your single Postgres instance looks... nervous.",
    defeat: "Sharded... cached... rate-limited... I've been horizontally scaled into oblivion!",
  },
  lessons: [
    // ------------------------------------------------------------------ FRAMEWORK
    {
      id: "sd-framework",
      title: "The System Design Interview",
      tagline: "A repeatable 45-minute structure and the anatomy of a scalable web app.",
      difficulty: "beginner",
      minutes: 15,
      diagram: {
        title: "Anatomy of a scalable web application",
        nodes: [
          { id: "client", label: "Client", sub: "web / mobile", kind: "client", x: 90, y: 280 },
          { id: "dns", label: "DNS", sub: "geo routing", kind: "dns", x: 90, y: 90 },
          { id: "cdn", label: "CDN", sub: "edge cache", kind: "cdn", x: 300, y: 90 },
          { id: "storage", label: "Object store", sub: "S3 / GCS", kind: "storage", x: 520, y: 90 },
          { id: "lb", label: "Load balancer", sub: "L7, TLS", kind: "lb", x: 300, y: 280 },
          { id: "app", label: "App servers", sub: "stateless × N", kind: "service", x: 520, y: 280 },
          { id: "cache", label: "Cache", sub: "Redis", kind: "cache", x: 760, y: 140 },
          { id: "db", label: "Primary DB", sub: "writes", kind: "db", x: 760, y: 280 },
          { id: "replica", label: "Read replicas", sub: "async copies", kind: "db", x: 760, y: 430 },
          { id: "queue", label: "Queue", sub: "SQS / Kafka", kind: "queue", x: 520, y: 450 },
          { id: "worker", label: "Workers", sub: "async jobs", kind: "worker", x: 300, y: 450 },
        ],
        edges: [
          { from: "client", to: "dns" },
          { from: "client", to: "cdn" },
          { from: "cdn", to: "storage", label: "origin" },
          { from: "client", to: "lb" },
          { from: "lb", to: "app" },
          { from: "app", to: "cache" },
          { from: "app", to: "db" },
          { from: "db", to: "replica", label: "replication", dashed: true },
          { from: "app", to: "replica" },
          { from: "app", to: "queue" },
          { from: "queue", to: "worker" },
          { from: "worker", to: "storage" },
        ],
        flows: [
          {
            name: "Read (cache hit)",
            path: ["client", "lb", "app", "cache", "app", "lb", "client"],
            steps: [
              "HTTPS request reaches the load balancer, which terminates TLS and picks a healthy app server.",
              "Any app server can handle it — they're stateless (sessions live in a cache or a signed token).",
              "Cache-aside: look up the key in Redis first.",
              "Hit! ~1 ms instead of a database round trip.",
              "Response goes back through the load balancer…",
              "…to the client. Most reads in a read-heavy system end here.",
            ],
          },
          {
            name: "Read (cache miss)",
            path: ["client", "lb", "app", "cache", "app", "replica", "app", "cache"],
            steps: [
              "Request routed to an app server.",
              "Check the cache first.",
              "Miss — the key isn't cached (or expired).",
              "Read from a replica to keep load off the primary.",
              "Replica returns the row (possibly slightly stale due to async replication).",
              "Populate the cache with a TTL so the next read is a hit.",
              "Response returns to the client (not shown).",
            ],
          },
          {
            name: "Write + async work",
            path: ["client", "lb", "app", "db", "app", "queue", "worker", "storage"],
            steps: [
              "A write (e.g. upload a profile photo) hits the load balancer.",
              "App server validates and authenticates the request.",
              "Commit the metadata to the primary database (the source of truth).",
              "Invalidate the related cache keys, then enqueue the slow part.",
              "Return 202 Accepted immediately; the queue buffers the job.",
              "A worker picks it up (resize images, send emails, update search) at its own pace.",
              "Results land in object storage, served later via the CDN.",
            ],
          },
          {
            name: "Static asset",
            path: ["client", "dns", "client", "cdn", "storage"],
            steps: [
              "DNS returns the address of the nearest CDN edge (GeoDNS / anycast).",
              "The client connects to that nearby edge.",
              "Edge cache hit → served in a few ms from a city near the user.",
              "On a miss, the edge fetches from the origin (object store) once and caches it.",
            ],
          },
        ],
      },
      concept: `
## What's being evaluated
System design interviews are open-ended on purpose. Interviewers look for:
1. **Scoping** — turning a vague prompt into concrete requirements.
2. **Trade-off reasoning** — every choice has a cost; say it out loud.
3. **Breadth** — knowing the building blocks and when each applies.
4. **Depth** — going deep on 1–2 hard parts.
5. **Communication** — driving the conversation, checking in, drawing clearly.

There is no single right answer. A defensible design with explicit trade-offs beats a "perfect" architecture recited from memory.

## The 45-minute structure
| Phase | Time | Output |
|---|---|---|
| Requirements | 5 min | functional + non-functional list, what's out of scope |
| Estimation | 3–5 min | QPS (read/write), storage, bandwidth |
| API | 3–5 min | core endpoints / RPCs |
| Data model | 5 min | entities, keys, access patterns, DB choice |
| High-level design | 10 min | boxes and arrows covering every requirement |
| Deep dives | 15 min | bottlenecks, scaling, consistency, failure handling |
| Wrap-up | 2–3 min | trade-offs recap, monitoring, future work |

## Functional vs non-functional requirements
- **Functional**: what the system does. *Users can post tweets; followers see them in a timeline.*
- **Non-functional**: how well. **Scale** (DAU, QPS), **latency** (p99 < 200 ms), **availability** (99.99%), **consistency** (can a timeline be a few seconds stale? can a bank balance?), **durability**, **cost**.

Non-functional requirements drive the architecture. "Strong consistency for payments, eventual consistency for likes" is the kind of sentence that earns points.

## The building blocks (this world covers each)
- **Load balancers** spread traffic over stateless servers.
- **Caches** absorb reads (cache-aside, write-through, TTLs, invalidation).
- **Databases** — SQL vs NoSQL, indexes, replication, sharding.
- **Message queues / logs** decouple producers from slow consumers.
- **CDNs and object storage** for static and large binary content.
- **Rate limiters** protect everything else.

## Stateless services scale horizontally
Keep app servers **stateless** — no user session in local memory — so any server can serve any request and you can add servers behind the load balancer freely. State lives in databases, caches and object stores, which are scaled with replication and partitioning.

> Click through the flows in the diagram: a cache hit, a miss, an async write, and a CDN asset. Almost every design you'll draw is a variation of this picture.
`,
      keyPoints: [
        "Clarify requirements before drawing anything.",
        "Non-functional requirements (scale, latency, consistency) drive the design.",
        "Follow: requirements → estimates → API → data model → high-level → deep dives.",
        "Stateless app tier + stateful data tier.",
        "Name trade-offs explicitly; there's no single right answer.",
      ],
      interview: [
        {
          q: "How do you start a system design interview?",
          a: "Don't draw yet. Restate the problem, then ask clarifying questions to pin down **functional requirements** (the 3–5 core features, explicitly mark what's out of scope) and **non-functional requirements** (users/DAU, read vs write ratio, latency targets, availability vs consistency, data retention). Then do quick estimates (QPS, storage). Write these on the board — you'll refer back to them to justify every decision.",
          freq: "very-common",
        },
        {
          q: "What does 'stateless service' mean and why does it matter?",
          a: "The server keeps no client-specific state between requests in local memory/disk; every request carries what's needed (e.g. a JWT) or state is fetched from a shared store (Redis, DB). Benefits: any instance can serve any request, so you can scale horizontally behind a load balancer, autoscale, deploy with rolling restarts and survive instance failures without losing sessions.",
          freq: "very-common",
        },
        {
          q: "Vertical vs horizontal scaling?",
          a: "**Vertical**: a bigger machine (more CPU/RAM). Simple, no code changes, but has a hard ceiling, gets expensive and remains a single point of failure. **Horizontal**: more machines. Near-unlimited and fault tolerant, but requires stateless design, load balancing and — for data — replication/sharding with their consistency challenges. Typical path: scale the database vertically as long as practical, scale the stateless tier horizontally from day one.",
          freq: "very-common",
        },
        {
          q: "How do you decide what to deep dive into?",
          a: "Pick the parts that are hardest **for this specific problem** and tie them to the non-functional requirements: fan-out for a news feed, consistency and idempotency for payments, real-time delivery for chat, geo-indexing for ride-hailing, storage and transcoding for video. Ask the interviewer: \"I'd like to go deeper on X because of Y — or is there an area you'd prefer?\"",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which is a NON-functional requirement?",
          options: ["Users can upload photos", "p99 read latency under 200 ms", "Users can follow each other", "Posts can have comments"],
          answer: 1,
          explain: "Latency is a quality attribute, not a feature.",
        },
        {
          q: "Why keep application servers stateless?",
          options: ["To save disk space", "So any instance can serve any request and you can scale horizontally", "Because databases require it", "To avoid caching"],
          answer: 1,
          explain: "State in a shared store lets the load balancer route freely.",
        },
        {
          q: "In cache-aside, on a cache miss the application…",
          options: ["Returns an error", "Reads from the DB, then writes the value into the cache", "Waits for the cache to fill itself", "Writes to the DB"],
          answer: 1,
          explain: "The app owns cache population: lazy loading.",
        },
        {
          q: "What should you do FIRST in a system design interview?",
          options: ["Draw the database schema", "Pick technologies", "Clarify requirements and scope", "Estimate costs in dollars"],
          answer: 2,
          explain: "Everything else depends on what you're actually building.",
        },
      ],
    },

    // ------------------------------------------------------------------ ESTIMATION
    {
      id: "estimation",
      title: "Back-of-the-Envelope Estimation",
      tagline: "Latency numbers, QPS and storage math in under five minutes.",
      difficulty: "beginner",
      minutes: 12,
      visualizers: ["latency", "estimator"],
      concept: `
## Why estimate?
Numbers decide architecture. 50 writes/second fits one Postgres box; 500,000 writes/second needs sharding and a write-optimized store. 10 GB fits in RAM; 10 PB means object storage and tiering. Estimation is not about precision — it's about getting the **order of magnitude** right, quickly and out loud.

## Numbers to memorize
- 1 day ≈ **86,400 s ≈ 10⁵ s**. So **1M requests/day ≈ 12 QPS**, 100M/day ≈ 1,200 QPS, 1B/day ≈ 12,000 QPS.
- Peak ≈ **2–3× average** (design for peak).
- 2¹⁰ ≈ thousand (KB), 2²⁰ ≈ million (MB), 2³⁰ ≈ billion (GB), 2⁴⁰ ≈ trillion (TB).
- Memory read ~100 ns · SSD random read ~100 µs · same-DC round trip ~0.5 ms · cross-continent ~100–150 ms.

## The template
\`\`\`
DAU                     = 100M
writes / user / day     = 2         → 200M writes/day ≈ 2,300 QPS avg, ~7K peak
read : write ratio      = 100 : 1   → ~230K read QPS avg
bytes / write           = 1 KB      → 200 GB/day → ~73 TB/year → ×3 replicas ≈ 220 TB/year
bandwidth (reads)       = 230K × 1 KB ≈ 230 MB/s egress
cache (80/20 rule)      = 20% of daily reads' working set
\`\`\`

## Turn numbers into decisions
- **Read-heavy** (≥ 10:1) → caching, read replicas, CDNs, denormalized views.
- **Write-heavy** → sharding, LSM-based stores (Cassandra, RocksDB), batching, queues.
- **Large blobs** (images, video) → object storage + CDN; keep only metadata in the DB.
- **Total storage** beyond a few TB per node → partitioning plus a retention policy.
- **Latency budget** — if you have 200 ms and a cross-region call costs 150 ms, you can't afford it synchronously.

## Rough capacity per node (order of magnitude)
Web server: 1k–10k simple RPS · Postgres/MySQL: ~10k simple reads/s, 1–5k writes/s · Redis: ~100k ops/s · Kafka broker: ~100k+ msgs/s (MB/s is the real limit). Use these to estimate **how many machines** you need — then add headroom.

> Play with the calculator: switch presets and watch how the read:write ratio changes which component becomes the bottleneck.
`,
      keyPoints: [
        "1M/day ≈ 12 QPS; design for 2–3× peak.",
        "QPS, storage, bandwidth, cache size — in that order.",
        "Memory ≈ 100 ns, SSD ≈ 100 µs, cross-continent ≈ 100 ms.",
        "Read-heavy → cache + replicas; write-heavy → sharding + LSM.",
        "Round aggressively and state your assumptions.",
      ],
      interview: [
        {
          q: "Estimate the storage needed for Twitter-like tweets for 5 years.",
          a: "Assume 200M DAU, ~2 tweets per user per day → 400M tweets/day. Tweet ≈ 300 B text + ~200 B metadata ≈ 0.5 KB → 200 GB/day ≈ 73 TB/year → ~365 TB for 5 years, ×3 replication ≈ 1.1 PB (media stored separately in object storage, far larger). Conclusion: tweets must be partitioned across many nodes; media goes to blob storage + CDN.",
          freq: "very-common",
        },
        {
          q: "How many servers do you need for 100K QPS?",
          a: "Depends on cost per request. If one server handles ~2K RPS for this endpoint (measure! CPU-bound JSON APIs often do 1–5K), you need 50 at full utilization; target ~50–60% utilization for headroom and failure tolerance → ~100 servers across ≥ 2–3 availability zones so losing a zone doesn't overload the rest. Then check the downstream: 100K QPS can't hit one database — caching must absorb most reads.",
          freq: "common",
        },
        {
          q: "Why do latency numbers matter in system design?",
          a: "They bound what's possible: memory is ~1,000× faster than SSD random reads, which are ~100× faster than HDD seeks; cross-region round trips (~100 ms) dominate any in-datacenter work. So you cache hot data in memory, read sequentially when possible, batch network calls, keep chatty services in the same region, and avoid synchronous cross-region calls in the request path.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "1 billion requests per day is roughly how many QPS on average?",
          options: ["~1,200", "~12,000", "~120,000", "~1 million"],
          answer: 1,
          explain: "10⁹ / 86,400 ≈ 11,574.",
        },
        {
          q: "Which is fastest?",
          options: ["SSD random read", "Main memory reference", "Same-datacenter round trip", "HDD seek"],
          answer: 1,
          explain: "~100 ns vs ~100 µs (SSD), ~500 µs (RTT), ~10 ms (HDD).",
        },
        {
          q: "100M writes/day × 1 KB each ≈ how much data per day?",
          options: ["100 MB", "10 GB", "100 GB", "10 TB"],
          answer: 2,
          explain: "10⁸ × 10³ B = 10¹¹ B = 100 GB.",
        },
        {
          q: "A 100:1 read:write ratio suggests…",
          options: ["Sharding writes first", "Heavy caching and read replicas", "A message queue for reads", "No database"],
          answer: 1,
          explain: "Reads dominate — take them off the primary.",
        },
      ],
    },

    // ------------------------------------------------------------------ LOAD BALANCING
    {
      id: "load-balancing",
      title: "Load Balancing",
      tagline: "Spread traffic, survive failures, and pick the right algorithm.",
      difficulty: "intermediate",
      minutes: 13,
      visualizers: ["loadbalancer"],
      concept: `
## What a load balancer does
It sits in front of a pool of servers and:
- **distributes** requests so no server is overloaded,
- runs **health checks** and stops routing to unhealthy instances,
- enables **zero-downtime deploys** (drain, replace, re-add),
- often **terminates TLS**, compresses, and adds observability.

## Layer 4 vs Layer 7
| | L4 (transport) | L7 (application) |
|---|---|---|
| Sees | IPs, ports, TCP/UDP | HTTP: paths, headers, cookies |
| Can do | fast forwarding, very high throughput | path-based routing, sticky cookies, rate limits, auth, retries |
| Examples | AWS NLB, LVS, Maglev | NGINX, Envoy, HAProxy, AWS ALB |

## Algorithms (try each in the simulator)
- **Round robin** — rotate through servers. Fair if servers and requests are uniform.
- **Weighted round robin** — bigger servers get more turns.
- **Least connections / least outstanding requests** — adapts to slow servers and long-lived requests. Usually the best default for heterogeneous workloads.
- **Random / power of two choices** — pick 2 servers at random, send to the less loaded: near-optimal with almost no coordination (used at massive scale).
- **IP hash / consistent hashing** — the same client (or key) maps to the same server: sticky sessions, cache affinity. Consistent hashing minimizes remapping when servers change.
- **Latency-aware / EWMA** — route by observed response times (Envoy, Finagle).

## Making the LB itself not a single point of failure
Run LBs in **active-passive** pairs with a floating IP (VRRP/keepalived) or **active-active** behind DNS / anycast. Cloud LBs are managed and distributed internally. Globally, **GeoDNS** or **anycast** routes users to the nearest region; each region has its own LB tier.

## Health checks and failure handling
- **Active**: periodic HTTP \`/healthz\` probes; mark down after N failures, up after M successes.
- **Passive** / outlier detection: eject hosts that return errors or time out.
- **Connection draining**: stop new requests to an instance being removed, let in-flight ones finish.
- **Retries** at the LB must be bounded and only for idempotent requests, with backoff — otherwise retries amplify an outage (see the Distributed world).

## Sticky sessions: avoid if you can
Session affinity makes scaling and failover uneven; a server crash logs users out. Prefer stateless servers with sessions in Redis or signed tokens. Use stickiness only for things like WebSocket connections or local caches where affinity is a performance optimization, not a correctness requirement.
`,
      keyPoints: [
        "L4 = fast packet forwarding; L7 = HTTP-aware routing.",
        "Least connections adapts to slow servers; round robin doesn't.",
        "Power of two choices: cheap and close to optimal.",
        "Health checks + draining enable failure tolerance and safe deploys.",
        "Avoid sticky sessions; keep servers stateless.",
      ],
      interview: [
        {
          q: "Round robin vs least connections — when does it matter?",
          a: "If all servers are identical and requests take similar time, round robin is fine. When servers differ in capacity, or request durations vary a lot (some long uploads, some quick reads), round robin keeps sending work to a struggling server and its queue grows. **Least connections** (or least outstanding requests) naturally sends less to slow/busy servers. Run the simulator: srv-3 is slow and drowns under round robin.",
          freq: "very-common",
        },
        {
          q: "How do you avoid the load balancer being a single point of failure?",
          a: "Redundancy at every level: multiple LB instances (active-active with ECMP/anycast or active-passive with a floating VIP and heartbeats), across availability zones; DNS with multiple records and health-checked failover between regions. Managed cloud LBs are already distributed. Also keep configuration in code and test failover regularly.",
          freq: "common",
        },
        {
          q: "What is the 'power of two choices'?",
          a: "Pick two servers uniformly at random and send the request to the one with fewer active requests. Pure random assignment has a max load of Θ(log n / log log n) above average; two choices drops it to Θ(log log n) — exponentially better — without global state. It's used in NGINX (`random two least_conn`), Envoy and many schedulers.",
          freq: "occasional",
        },
        {
          q: "L4 vs L7 load balancing?",
          a: "L4 balances TCP/UDP connections by IP and port without parsing payloads — extremely fast, protocol-agnostic, can't route by URL. L7 parses HTTP (or gRPC) — it can route `/api` vs `/static`, use headers/cookies, do retries, rate limiting, authentication and canary releases, at a higher CPU cost. Common setup: L4 at the edge for raw throughput, L7 proxies (Envoy/NGINX) behind it.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which algorithm adapts best to one server being much slower than the others?",
          options: ["Round robin", "Random", "Least connections", "IP hash"],
          answer: 2,
          explain: "Slow servers accumulate in-flight requests and get fewer new ones.",
        },
        {
          q: "Routing /images/* to one pool and /api/* to another requires…",
          options: ["L4 load balancing", "L7 load balancing", "DNS round robin", "Anycast"],
          answer: 1,
          explain: "Only an HTTP-aware balancer sees paths.",
        },
        {
          q: "Connection draining is used to…",
          options: ["Speed up TLS", "Let in-flight requests finish before removing a server", "Clear the cache", "Rebalance shards"],
          answer: 1,
          explain: "It enables zero-downtime deploys and scale-in.",
        },
        {
          q: "Why are sticky sessions discouraged?",
          options: ["They're slower to compute", "They tie users to a server, hurting balance and failover", "Browsers don't support cookies", "They break HTTPS"],
          answer: 1,
          explain: "A crashed server takes its users' sessions with it.",
        },
      ],
    },

    // ------------------------------------------------------------------ CACHING
    {
      id: "caching",
      title: "Caching",
      tagline: "The fastest request is the one that never reaches the database.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["cache"],
      concept: `
## Where caches live
Browser → CDN edge → reverse proxy / API gateway → **application cache (Redis, Memcached)** → database buffer pool → OS page cache → CPU caches. Each layer trades freshness for speed.

## Read strategies
- **Cache-aside (lazy loading)** — app checks cache; on miss reads DB and populates the cache. Most common. Only requested data is cached; first read is slow; stale data possible until TTL/invalidation.
- **Read-through** — the cache library itself loads from the DB on a miss (same behaviour, logic moved into the cache layer).

## Write strategies
| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Write-through** | write cache and DB synchronously | cache always fresh | slower writes, caches unread data |
| **Write-behind (write-back)** | write cache, flush to DB async | very fast writes | data loss risk if the cache dies |
| **Write-around** | write DB only, cache fills on read | avoids polluting cache | first read after write misses |
| **Invalidate on write** | write DB, delete cache key | simple, common with cache-aside | small race window |

**Delete, don't update**, cache keys on writes: concurrent updates can otherwise leave an older value in the cache. Even "delete after write" has a race (a slow reader re-populates stale data); mitigations: short TTLs, versioned keys, delayed double-delete, or change-data-capture (CDC) driven invalidation.

## Eviction policies
- **LRU** — evict least recently used. Great default for recency-heavy workloads; fooled by scans.
- **LFU** — evict least frequently used. Protects long-term hot keys; slow to adapt to shifts.
- **FIFO / random** — simple, sometimes good enough.
- Modern caches use hybrids (Redis approximated LRU/LFU, Caffeine's W-TinyLFU).
- **TTL** bounds staleness regardless of policy.

## The famous failure modes
- **Cache stampede (thundering herd)**: a hot key expires and thousands of requests hit the DB at once. Fixes: request coalescing / single-flight (one request recomputes, others wait), locks, **probabilistic early expiration**, serving stale-while-revalidate.
- **Cache penetration**: requests for keys that don't exist bypass the cache every time (often malicious). Fixes: cache negative results briefly, Bloom filter in front.
- **Cache avalanche**: many keys expire simultaneously, or the cache cluster restarts cold. Fixes: TTL jitter, warm-up, replicas, circuit breakers on the DB.
- **Hot keys**: one celebrity key overwhelms a single cache shard. Fixes: replicate the key across shards with a random suffix, local in-process cache, request coalescing.

## Distributed caches
Redis Cluster / Memcached shard keys with (consistent) hashing across nodes. Redis adds data structures (lists, sorted sets, HyperLogLog), persistence and replication; Memcached is simpler, multi-threaded, pure cache.
`,
      keyPoints: [
        "Cache-aside is the default: check cache → DB on miss → populate.",
        "On writes, delete the cache key rather than updating it.",
        "LRU for recency, LFU for long-term popularity; always add TTLs.",
        "Stampede → single-flight, early refresh, stale-while-revalidate.",
        "Penetration → negative caching / Bloom filters; avalanche → TTL jitter.",
      ],
      complexity: [
        { op: "LRU get / put (hash map + doubly linked list)", time: "O(1)" },
        { op: "LFU get / put (frequency buckets)", time: "O(1)" },
      ],
      code: [
        {
          title: "LRU cache in O(1) (LeetCode 146)",
          variants: [
            {
              lang: "python",
              code: `
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.data = OrderedDict()          # hash map + doubly linked list

    def get(self, key):
        if key not in self.data:
            return -1
        self.data.move_to_end(key)         # mark as most recently used
        return self.data[key]

    def put(self, key, value):
        self.data[key] = value
        self.data.move_to_end(key)
        if len(self.data) > self.cap:
            self.data.popitem(last=False)  # evict least recently used
`,
            },
            {
              lang: "javascript",
              code: `
class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map();                // Map preserves insertion order
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);                // re-insert as most recent
    return v;
  }
  put(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value);
  }
}
`,
            },
            {
              lang: "java",
              code: `
class LRUCache extends LinkedHashMap<Integer, Integer> {
    private final int cap;
    LRUCache(int capacity) {
        super(capacity, 0.75f, true);    // accessOrder = true
        this.cap = capacity;
    }
    public int get(int key) { return super.getOrDefault(key, -1); }
    public void put(int key, int value) { super.put(key, value); }
    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> e) {
        return size() > cap;
    }
}
`,
            },
          ],
        },
        {
          title: "Cache-aside with single-flight protection",
          variants: [
            {
              lang: "python",
              code: `
import json, random

def get_user(user_id, redis, db):
    key = f"user:{user_id}"
    cached = redis.get(key)
    if cached is not None:
        return json.loads(cached)
    # only one caller rebuilds; others briefly wait / retry
    if redis.set(f"lock:{key}", "1", nx=True, ex=5):
        try:
            user = db.fetch_user(user_id)
            ttl = 3600 + random.randint(0, 300)          # jitter avoids avalanches
            redis.set(key, json.dumps(user), ex=ttl)
            return user
        finally:
            redis.delete(f"lock:{key}")
    return db.fetch_user(user_id)                        # or sleep + retry the cache

def update_user(user_id, fields, redis, db):
    db.update_user(user_id, fields)
    redis.delete(f"user:{user_id}")                      # invalidate, don't update
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Design an LRU cache with O(1) get and put.",
          a: "Combine a **hash map** (key → node) with a **doubly linked list** ordered by recency. `get`: look up the node, unlink it and move it to the head, return its value. `put`: update or create the node at the head; if size exceeds capacity, remove the tail node and delete its key from the map. Sentinel head/tail nodes avoid edge cases. Both operations are O(1).",
          freq: "very-common",
        },
        {
          q: "How do you keep the cache consistent with the database?",
          a: "Typical approach: cache-aside reads + **invalidate (delete) the key after committing the DB write**, with a TTL as a safety net. Know the race: reader misses, reads old value from DB, writer updates DB and deletes key, reader then writes the old value into the cache. Mitigations: short TTLs, delayed second delete, versioned values (compare-and-set), or drive invalidation from the DB's change log (CDC, e.g. Debezium). For data that must be strongly consistent (balances), don't serve it from a cache at all.",
          freq: "very-common",
        },
        {
          q: "What is a cache stampede and how do you prevent it?",
          a: "When a popular key expires, many concurrent requests miss simultaneously and all hit the database, which can collapse under the burst. Prevention: **request coalescing / single-flight** (one recompute, others wait for it), a distributed lock around recomputation, **probabilistic early refresh** (refresh slightly before expiry with increasing probability), **stale-while-revalidate** (serve the old value while one worker refreshes), and TTL jitter to avoid synchronized expirations.",
          freq: "very-common",
        },
        {
          q: "Redis vs Memcached?",
          a: "Both are in-memory key-value caches. **Memcached**: simple strings, multi-threaded, no persistence, easy horizontal scaling — a pure cache. **Redis**: rich data structures (hashes, lists, sorted sets for leaderboards, streams, HyperLogLog, geo), persistence (RDB/AOF), replication, Lua scripting, pub/sub, clustering. Choose Redis when you need those features (rate limiting, queues, leaderboards); Memcached for a simple, very high-throughput object cache.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "On a write, the safest simple cache action is to…",
          options: ["Update the cached value", "Delete (invalidate) the cached key", "Do nothing, TTL will handle it", "Flush the whole cache"],
          answer: 1,
          explain: "Updating risks writing an out-of-order older value under concurrency.",
        },
        {
          q: "A looping scan over more keys than the cache holds makes LRU…",
          options: ["Hit every time", "Miss every time (thrashing)", "Behave like LFU", "Crash"],
          answer: 1,
          explain: "Each key is evicted just before it's needed again.",
        },
        {
          q: "Requests for non-existent IDs repeatedly bypassing the cache is called…",
          options: ["Cache stampede", "Cache penetration", "Cache avalanche", "Write-behind"],
          answer: 1,
          explain: "Fix with negative caching or a Bloom filter.",
        },
        {
          q: "Write-behind caching risks…",
          options: ["Slow writes", "Losing writes if the cache fails before flushing", "Stale reads only", "Higher DB load"],
          answer: 1,
          explain: "The DB is updated asynchronously.",
        },
        {
          q: "Adding random jitter to TTLs prevents…",
          options: ["Hot keys", "Many keys expiring at once (avalanche)", "Cache penetration", "Eviction"],
          answer: 1,
          explain: "Expirations spread out instead of synchronizing.",
        },
      ],
      problems: [
        { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "Medium" },
        { title: "LFU Cache", url: "https://leetcode.com/problems/lfu-cache/", difficulty: "Hard" },
      ],
    },

    // ------------------------------------------------------------------ DATABASES
    {
      id: "databases",
      title: "Databases, Indexes & Replication",
      tagline: "SQL vs NoSQL, how indexes work, and copies for scale and safety.",
      difficulty: "intermediate",
      minutes: 18,
      diagram: {
        title: "Primary–replica replication",
        nodes: [
          { id: "app", label: "App servers", sub: "read/write split", kind: "service", x: 140, y: 280 },
          { id: "primary", label: "Primary", sub: "all writes", kind: "db", x: 470, y: 150 },
          { id: "r1", label: "Replica A", sub: "same region", kind: "db", x: 800, y: 110 },
          { id: "r2", label: "Replica B", sub: "same region", kind: "db", x: 800, y: 280 },
          { id: "r3", label: "Replica C", sub: "other region (DR)", kind: "db", x: 800, y: 450 },
          { id: "proxy", label: "DB proxy", sub: "routing, failover", kind: "gateway", x: 470, y: 400 },
        ],
        edges: [
          { from: "app", to: "primary", label: "writes" },
          { from: "app", to: "proxy", label: "reads" },
          { from: "proxy", to: "r2" },
          { from: "proxy", to: "r3" },
          { from: "primary", to: "r1", label: "WAL stream", dashed: true },
          { from: "primary", to: "r2", dashed: true },
          { from: "primary", to: "r3", label: "async", dashed: true },
        ],
        flows: [
          {
            name: "Write",
            path: ["app", "primary", "r1"],
            steps: [
              "All writes go to the primary, which appends to its write-ahead log (WAL) and commits.",
              "The WAL is streamed to replicas. Async: the primary doesn't wait (fast, but a crash can lose recent writes). Sync/semi-sync: waits for ≥1 replica (safer, slower).",
            ],
          },
          {
            name: "Read from replica",
            path: ["app", "proxy", "r2", "proxy", "app"],
            steps: [
              "Reads go through a proxy that spreads them over replicas.",
              "Replica B serves the query — it may lag the primary by milliseconds to seconds (replication lag).",
              "Result returns via the proxy…",
              "…to the app. Read-your-own-writes needs care: route a user's reads to the primary right after they write, or wait for the replica to catch up.",
            ],
          },
          {
            name: "Failover",
            path: ["app", "proxy", "r3", "proxy", "app"],
            steps: [
              "The primary dies. Health checks / consensus (e.g. Patroni + etcd) notice.",
              "The most up-to-date replica is promoted to primary; others re-point to it.",
              "The proxy (or DNS) now routes writes to the new primary.",
              "Unreplicated async writes may be lost — a key RPO trade-off to mention.",
            ],
          },
        ],
      },
      concept: `
## SQL vs NoSQL — choose by access pattern
| | Relational (Postgres, MySQL) | NoSQL |
|---|---|---|
| Model | tables, schemas, joins | key-value (DynamoDB, Redis), document (MongoDB), wide-column (Cassandra, Bigtable), graph (Neo4j) |
| Transactions | ACID across rows/tables | often per-item/partition; some offer more |
| Scaling | vertical + read replicas; sharding is manual/extension (Citus, Vitess) | built-in horizontal partitioning |
| Strength | complex queries, integrity, flexible ad-hoc access | massive scale with **known** access patterns, flexible schema |

Default to a relational DB unless you have a concrete reason: huge write throughput, simple key-based access at scale, schemaless data, or multi-region active-active needs. "NoSQL because it scales" without numbers is a red flag.

## ACID and isolation levels
**A**tomicity, **C**onsistency, **I**solation, **D**urability. Isolation levels trade anomalies for concurrency: read committed (Postgres default) → repeatable read / snapshot isolation → serializable. Know the anomalies: dirty read, non-repeatable read, phantom, **lost update**, write skew. Use \`SELECT … FOR UPDATE\`, optimistic locking (version column), or serializable transactions for invariants like "don't double-book the seat".

## How indexes work
Without an index, a query scans every row: O(n). A **B+ tree index** keeps keys sorted in a shallow, wide tree (fan-out of hundreds): a lookup touches ~3–4 pages even for billions of rows, and range scans walk linked leaf pages.
- **Composite indexes** follow the **leftmost-prefix rule**: an index on \`(user_id, created_at)\` serves \`WHERE user_id = ? ORDER BY created_at\` but not \`WHERE created_at > ?\` alone.
- **Covering indexes** include all needed columns → no table lookup.
- **Cost**: every index slows writes and uses space. Index the queries you actually run (check \`EXPLAIN\`).
- **Hash indexes** for equality only; **LSM-trees** (Cassandra, RocksDB) for write-heavy workloads; **inverted indexes** for full-text search (Elasticsearch).

## Replication
- **Single-leader** (primary–replica): simple, the default. Writes don't scale, reads do; replicas lag.
- **Multi-leader**: writes in multiple regions; must resolve conflicts (last-write-wins, CRDTs, app logic).
- **Leaderless** (Dynamo, Cassandra): write to W of N replicas, read from R; R + W > N gives overlap (Distributed world).

**Replication lag** causes anomalies: reading your own write and not seeing it, or time going backwards between replicas. Fixes: read-your-writes routing, monotonic reads (stick a user to one replica), or synchronous replication for critical data.

## Normalization vs denormalization
Normalize to avoid duplicated data and update anomalies; **denormalize** (duplicate data, precompute aggregates, materialized views) when read performance matters more and you can keep copies in sync (often via events).
`,
      keyPoints: [
        "Pick SQL by default; NoSQL for known access patterns at huge scale.",
        "B+ tree indexes: O(log n) lookups, ordered range scans, slower writes.",
        "Composite indexes obey the leftmost-prefix rule.",
        "Replicas scale reads but lag — plan for read-your-writes.",
        "Async replication + failover can lose recent writes (RPO > 0).",
      ],
      interview: [
        {
          q: "When would you choose NoSQL over SQL?",
          a: "When the access patterns are simple and known in advance (get/put by key, time-series by partition), the scale exceeds what a single primary can handle (very high write throughput, many TB), you need built-in horizontal scaling or multi-region writes, or the data is naturally schemaless/document-shaped. Choose SQL when you need joins, complex/ad-hoc queries, multi-row transactions and strong integrity constraints — which covers most applications. Many systems use both (SQL for orders, Cassandra for activity logs, Redis for caching).",
          freq: "very-common",
        },
        {
          q: "How does a database index speed up queries, and what's the cost?",
          a: "A B+ tree index stores keys in sorted order in a balanced tree with high fan-out, so finding a key takes O(log n) page reads (~3–4 for billions of rows) instead of a full table scan, and range queries scan adjacent leaves. Costs: extra storage, slower inserts/updates/deletes (each index must be maintained), and the optimizer may ignore an index on low-selectivity columns. Index the columns in WHERE/JOIN/ORDER BY of frequent queries; respect the leftmost-prefix rule for composite indexes.",
          freq: "very-common",
        },
        {
          q: "What is replication lag and how does it affect users?",
          a: "Asynchronous replicas apply the primary's changes after a delay. A user who just updated their profile may read from a lagging replica and see the old value (violating read-your-writes), or see a comment appear then disappear when consecutive reads hit different replicas (violating monotonic reads). Fixes: read from the primary for a short window after a user's write (or for the user's own data), pin a user's session to one replica, track replication positions (LSN) and wait until the replica has caught up.",
          freq: "common",
        },
        {
          q: "Explain isolation levels and the 'lost update' problem.",
          a: "Two transactions read a counter (5), both add 1 and write 6 — one increment is lost. Under read committed this can happen. Solutions: atomic updates (`UPDATE … SET n = n + 1`), pessimistic locking (`SELECT … FOR UPDATE`), optimistic concurrency (version column, retry on conflict) or serializable isolation. Higher isolation levels prevent more anomalies (non-repeatable reads, phantoms, write skew) at the cost of concurrency and more aborts.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "An index on (user_id, created_at) helps which query?",
          options: ["WHERE created_at > X", "WHERE user_id = 7 ORDER BY created_at", "WHERE email = Y", "WHERE created_at = X OR user_id = 7 only"],
          answer: 1,
          explain: "Leftmost prefix user_id, then ordered by created_at within it.",
        },
        {
          q: "Read replicas primarily help scale…",
          options: ["Writes", "Reads", "Storage per node", "Transactions"],
          answer: 1,
          explain: "Every replica still receives every write.",
        },
        {
          q: "A user updates their bio and immediately sees the old one. Likely cause?",
          options: ["Index corruption", "Replication lag on a read replica", "Cache stampede", "Deadlock"],
          answer: 1,
          explain: "The read hit a replica that hadn't applied the write yet.",
        },
        {
          q: "Typical B+ tree lookups on a billion-row table touch about…",
          options: ["1 page", "3–4 pages", "30 pages", "a billion rows"],
          answer: 1,
          explain: "High fan-out keeps the tree very shallow.",
        },
        {
          q: "Which store is a wide-column database?",
          options: ["PostgreSQL", "Redis", "Cassandra", "Neo4j"],
          answer: 2,
          explain: "Cassandra (and Bigtable/HBase) are wide-column, LSM-based stores.",
        },
      ],
    },

    // ------------------------------------------------------------------ SHARDING
    {
      id: "sharding",
      title: "Sharding & Partitioning",
      tagline: "Split data across machines without creating hot spots.",
      difficulty: "advanced",
      minutes: 15,
      visualizers: ["sharding"],
      concept: `
## Why partition
When data or write throughput outgrows one machine, split it into **shards** (partitions), each owned by a different node (usually replicated too). Each shard handles a fraction of the data and load.

## Choosing a partitioning strategy
| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Hash** | shard = hash(key) mod N | even distribution | no range scans; mod N reshuffles everything when N changes |
| **Consistent hashing** | keys and nodes on a ring | adding a node moves ~1/N of keys | more complex; needs virtual nodes for balance |
| **Range** | key ranges per shard (A–F, G–M…) | efficient range scans | hot spots with skewed or sequential keys |
| **Directory / lookup** | a service maps key → shard | maximal flexibility | the directory is a dependency/bottleneck |
| **Geo / tenant** | by region or customer | data locality, isolation | uneven tenant sizes |

Try "add a shard" in the visualizer: mod-N moves most keys; consistent hashing moves only a fraction.

## Picking the shard key — the most important decision
A good shard key has **high cardinality**, **even access distribution**, and matches the **dominant query** so most requests touch one shard.
- Chat messages: shard by \`conversation_id\` (all messages of a chat together).
- Orders: by \`customer_id\` (customer's history on one shard) — but merchant analytics then needs scatter-gather.
- Time-series: \`(device_id, time_bucket)\` — never by raw timestamp alone (all writes hit the newest shard).

## Hot spots and celebrities
Even with hashing, one key can be hot (a celebrity's posts, a viral product). Mitigations: add a random suffix to spread a hot key over k sub-keys (and merge on read), cache aggressively, special-case known hot entities.

## The costs of sharding
- **Cross-shard queries** become scatter-gather (fan out, merge) — slower, more failure modes.
- **Cross-shard transactions** need 2PC or sagas (Distributed world).
- **Joins** across shards are expensive → denormalize or co-locate related data.
- **Rebalancing** moves data while serving traffic; use many small fixed partitions (e.g. 1,024 logical partitions mapped onto fewer physical nodes) so moving partitions is cheap.
- **Global secondary indexes** must themselves be partitioned (by term) or queried on every shard (local indexes).

## Before you shard
Exhaust cheaper options: better indexes, caching, read replicas, vertical scaling, archiving old data, splitting by feature/service (vertical partitioning). Sharding is powerful but operationally heavy. Tools like Vitess (MySQL), Citus (Postgres), or natively partitioned stores (DynamoDB, Cassandra, Spanner, CockroachDB) take on much of the work.
`,
      keyPoints: [
        "Shard key: high cardinality, even load, matches the main query.",
        "Hash for even spread; range for scans (beware sequential keys).",
        "mod N reshuffles on resize; consistent hashing moves ~1/N.",
        "Use many logical partitions over fewer nodes for easy rebalancing.",
        "Cross-shard joins/transactions are the price — design around them.",
      ],
      interview: [
        {
          q: "How would you choose a shard key for a chat application's messages?",
          a: "Queries are \"latest messages in conversation X\", so shard by **conversation_id** (hash for even spread) and cluster by message time within the partition. All of a conversation's messages live together → single-shard reads and ordered writes. Very large group chats could become hot; split them into time buckets `(conversation_id, month)`. Avoid sharding by sender (a conversation would scatter) or timestamp (hot newest shard).",
          freq: "very-common",
        },
        {
          q: "Why does `hash(key) mod N` cause problems when adding servers?",
          a: "Changing N changes the modulus for nearly every key: going from N to N+1 remaps about N/(N+1) of all keys, forcing a massive data migration (or, for caches, a cold cache and DB stampede). Consistent hashing places nodes and keys on a ring so a new node only takes keys from its neighbours (~1/(N+1) of the total). Alternatively, use a fixed large number of logical partitions and move whole partitions between nodes.",
          freq: "very-common",
        },
        {
          q: "How do you handle a hot partition?",
          a: "First detect it (per-partition metrics). Then: split the hot key with salting (`key#0..key#k`, writes pick a random suffix, reads gather all k), add caching in front, rate-limit abusive clients, use adaptive capacity (DynamoDB), split a hot range into smaller ranges, or move it to dedicated hardware. For time-ordered keys, prefix with a hash or bucket so writes spread.",
          freq: "common",
        },
        {
          q: "What problems does sharding introduce?",
          a: "Queries not keyed by the shard key need scatter-gather across all shards; joins across shards are expensive; multi-shard transactions need 2PC/sagas; secondary indexes must be local (scatter on read) or global (partitioned separately, async consistency); rebalancing data live is operationally risky; and backups, schema changes and monitoring multiply. That's why you exhaust caching, replicas and vertical scaling first.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Sharding a time-series table by raw timestamp ranges causes…",
          options: ["Even load", "All new writes hitting the latest shard", "Faster joins", "Fewer shards"],
          answer: 1,
          explain: "Sequential keys concentrate writes in one range.",
        },
        {
          q: "Going from 4 to 5 shards with hash mod N moves roughly what fraction of keys?",
          options: ["~20%", "~50%", "~80%", "0%"],
          answer: 2,
          explain: "About N/(N+1) = 4/5 of keys change shard.",
        },
        {
          q: "A good shard key should have…",
          options: ["Low cardinality", "High cardinality and even access", "Monotonically increasing values", "Few distinct values"],
          answer: 1,
          explain: "Otherwise data and load concentrate on a few shards.",
        },
        {
          q: "Querying by a non-shard-key attribute typically requires…",
          options: ["A single shard lookup", "Scatter-gather across shards (or a global index)", "A full backup", "Nothing special"],
          answer: 1,
          explain: "Without the key you don't know which shard holds the data.",
        },
      ],
    },

    // ------------------------------------------------------------------ MESSAGE QUEUES
    {
      id: "message-queues",
      title: "Message Queues & Event Streams",
      tagline: "Decouple services, absorb spikes and process work asynchronously.",
      difficulty: "intermediate",
      minutes: 15,
      visualizers: ["queue"],
      concept: `
## Why queues
Put a queue between a producer and a consumer and you get:
- **Decoupling** — producer doesn't know who consumes or whether they're up.
- **Load leveling** — bursts are buffered; consumers work at their own pace.
- **Async processing** — the user gets a fast response; slow work happens later.
- **Fan-out** — one event, many independent consumers (email, analytics, search indexing).

## Two families
| | Message queue (SQS, RabbitMQ) | Log / stream (Kafka, Kinesis, Pulsar) |
|---|---|---|
| Model | messages deleted after ack | append-only log retained for days |
| Consumers | compete for messages | each consumer group tracks its own **offset** |
| Replay | no | yes — rewind offsets |
| Ordering | best effort (FIFO queues limited) | ordered **within a partition** |
| Best for | task queues, work distribution | event sourcing, streaming, many independent readers |

## Kafka in one minute (play with the simulator)
- A **topic** is split into **partitions**; each partition is an ordered, replicated log.
- Producers choose the partition by **key hash** → all events for a key stay **in order**.
- A **consumer group** shares partitions: each partition is read by **exactly one** consumer in the group. Parallelism is capped by partition count — extra consumers sit idle.
- Consumers **commit offsets**; on restart they resume from the last commit. **Lag** = latest offset − committed offset: the key health metric.
- Adding partitions later changes \`hash(key) mod P\` → per-key ordering breaks across the change.

## Delivery guarantees
- **At-most-once**: commit before processing → may lose messages.
- **At-least-once**: process, then commit → may process duplicates after a crash. **The usual choice** — make consumers **idempotent** (dedupe by message id, upserts).
- **Exactly-once**: only within a closed system (Kafka transactions: consume-transform-produce atomically). End-to-end with external side effects, you build it from at-least-once + idempotency.

## Operational must-knows
- **Dead-letter queue (DLQ)** for messages that keep failing (poison messages) — don't block the partition forever.
- **Retries with backoff**; visibility timeouts (SQS) re-deliver unacknowledged messages.
- **Backpressure**: if lag grows, scale consumers (up to partitions), speed up processing, or shed load.
- **Ordering vs parallelism** trade-off: more partitions = more parallelism but ordering only within each.
- **Transactional outbox**: write the event to an outbox table in the same DB transaction as your state change, then relay it to the broker — avoids "DB committed but event lost".
`,
      keyPoints: [
        "Queues decouple, buffer spikes and enable async work.",
        "Task queue (delete on ack) vs log (retain + offsets + replay).",
        "Kafka orders per partition; key → partition preserves per-key order.",
        "One consumer per partition per group: partitions cap parallelism.",
        "At-least-once + idempotent consumers is the practical default.",
      ],
      interview: [
        {
          q: "Kafka vs RabbitMQ/SQS — how do you choose?",
          a: "Use **SQS/RabbitMQ** for task distribution: jobs consumed once and deleted, per-message acks, visibility timeouts, routing (RabbitMQ exchanges), simple ops. Use **Kafka** for high-throughput event streams that multiple independent consumers read, need **replay**, ordering per key, and retention (event sourcing, analytics pipelines, CDC). Kafka trades per-message features for throughput and durability of a partitioned log.",
          freq: "very-common",
        },
        {
          q: "How do you guarantee messages are processed exactly once?",
          a: "Truly exactly-once delivery across a network isn't possible in general; aim for **exactly-once effects**: use at-least-once delivery and make processing **idempotent** — dedupe by a unique message/event id stored with the result (in the same transaction), use upserts or conditional writes, design operations to be naturally idempotent (set status = PAID rather than add amount). Within Kafka, transactions + idempotent producers give exactly-once for consume→produce pipelines.",
          freq: "very-common",
        },
        {
          q: "Consumer lag keeps growing. What do you do?",
          a: "Diagnose: is it all partitions (consumers too slow overall) or one (hot key / poison message)? Then: scale out consumers (only helps up to the partition count), increase partitions for future parallelism (mind key ordering), optimize processing (batching, async I/O, fewer DB round trips), move slow side effects to another queue, send failing messages to a DLQ, and for a hot key consider re-keying. Alert on lag and time-lag, not just throughput.",
          freq: "common",
        },
        {
          q: "What is the transactional outbox pattern?",
          a: "Problem: you update the database and publish an event; if the process crashes between the two, they disagree (dual write). Outbox: in the **same DB transaction** as the state change, insert the event into an `outbox` table. A relay (polling or CDC like Debezium) reads the outbox and publishes to the broker, marking rows sent. Delivery is at-least-once, so consumers must be idempotent — but no event is ever lost or published for a rolled-back change.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A Kafka topic has 4 partitions and a consumer group has 6 consumers. How many are idle?",
          options: ["0", "2", "4", "6"],
          answer: 1,
          explain: "Each partition is assigned to at most one consumer in the group.",
        },
        {
          q: "How does Kafka preserve the order of events for a single user?",
          options: ["Global ordering of the topic", "Using the user id as the key so events land in one partition", "Timestamps on the consumer", "It doesn't"],
          answer: 1,
          explain: "Ordering is guaranteed within a partition only.",
        },
        {
          q: "With at-least-once delivery, consumers must be…",
          options: ["Stateless", "Idempotent", "Single-threaded", "In the same region"],
          answer: 1,
          explain: "Duplicates will happen after retries/crashes.",
        },
        {
          q: "Messages that repeatedly fail processing should go to…",
          options: ["/dev/null", "A dead-letter queue", "The front of the queue", "A new partition"],
          answer: 1,
          explain: "Isolate poison messages for inspection without blocking others.",
        },
        {
          q: "Consumer lag means…",
          options: ["Network latency", "How far committed offsets trail the latest offsets", "Disk usage", "Number of consumers"],
          answer: 1,
          explain: "It's the unprocessed backlog.",
        },
      ],
    },

    // ------------------------------------------------------------------ RATE LIMITING
    {
      id: "rate-limiting",
      title: "Rate Limiting",
      tagline: "Protect services from abuse, bursts and runaway clients.",
      difficulty: "intermediate",
      minutes: 14,
      visualizers: ["ratelimiter"],
      caseStudy: true,
      diagram: {
        title: "Distributed rate limiter at the API gateway",
        nodes: [
          { id: "client", label: "Client", sub: "API key / user / IP", kind: "client", x: 100, y: 280 },
          { id: "gw", label: "API gateway", sub: "rate-limit middleware", kind: "gateway", x: 360, y: 280 },
          { id: "redis", label: "Redis cluster", sub: "counters / buckets", kind: "cache", x: 640, y: 120 },
          { id: "rules", label: "Rules config", sub: "limits per plan", kind: "storage", x: 360, y: 90 },
          { id: "svc", label: "Backend services", kind: "service", x: 640, y: 420 },
        ],
        edges: [
          { from: "client", to: "gw" },
          { from: "gw", to: "redis", label: "atomic check (Lua)" },
          { from: "rules", to: "gw", label: "cached rules", dashed: true },
          { from: "gw", to: "svc" },
        ],
        flows: [
          {
            name: "Allowed",
            path: ["client", "gw", "redis", "gw", "svc"],
            steps: [
              "Request arrives with an API key. The gateway derives the limit key, e.g. rl:{apiKey}:{endpoint}.",
              "One atomic Lua script: refill tokens based on elapsed time, take one if available.",
              "A token was available → allowed. Response headers: X-RateLimit-Remaining, X-RateLimit-Reset.",
              "Forward to the backend service.",
            ],
          },
          {
            name: "Rejected",
            path: ["client", "gw", "redis", "gw", "client"],
            steps: [
              "Same request path…",
              "…but the bucket is empty.",
              "Reject without touching the backend.",
              "HTTP 429 Too Many Requests with Retry-After. Clients should back off with jitter.",
            ],
          },
        ],
      },
      concept: `
## Why and where
Rate limiting protects availability (one client can't starve others), controls cost, mitigates abuse (credential stuffing, scraping) and enforces pricing tiers. Enforce it as early as possible: **API gateway / edge** for global limits, plus per-service limits for internal protection.

## Algorithms (watch them race in the simulator)
| Algorithm | Idea | Burst behaviour | Memory |
|---|---|---|---|
| **Token bucket** | tokens refill at rate r up to capacity b; each request takes one | allows bursts up to b, then rate r | 2 numbers per key |
| **Leaky bucket** | requests queue and drain at a constant rate | smooths output completely | queue per key |
| **Fixed window counter** | count per clock window (e.g. per minute) | **boundary problem**: 2× limit around a window edge | 1 counter |
| **Sliding window log** | store timestamps, count those in the last W | exact | O(requests) per key |
| **Sliding window counter** | weighted current + previous window counts | close approximation | 2 counters |

Token bucket is the most common (AWS, Stripe, most API gateways) because it permits short bursts while bounding the long-run rate.

## Designing a distributed rate limiter
- **Where's the state?** Many gateway instances must share counts → a central fast store (Redis) with **atomic** operations (Lua script or \`INCR\` + \`EXPIRE\`), keyed by \`user/api-key/IP + endpoint\`.
- **Race conditions**: read-modify-write across instances double-counts or under-counts — atomicity fixes it.
- **Latency**: one Redis round trip per request (~0.5 ms in-region). Hot paths can use **local token buckets** with periodic sync (slightly over-admits) for lower latency.
- **Failure mode**: if Redis is down, **fail open** (allow; protect availability) or **fail closed** (deny; protect the backend) — a product decision.
- **Multi-region**: per-region limits, or async replication of counts and accept slight overage.
- **Rules**: per plan / endpoint / user tier, stored in config, cached in the gateway.
- **Client experience**: 429 + \`Retry-After\` + \`X-RateLimit-*\` headers; clients retry with exponential backoff and jitter.

## Related protections
Load shedding (drop low-priority work when overloaded), circuit breakers (stop calling a failing dependency), concurrency limits (bulkheads), and adaptive limits that react to latency (e.g. Netflix's concurrency-limits library).
`,
      keyPoints: [
        "Token bucket: bursts up to capacity, long-run rate r — the common default.",
        "Fixed windows allow ~2× bursts at boundaries.",
        "Distributed limiters need atomic updates in a shared store (Redis + Lua).",
        "Decide fail-open vs fail-closed explicitly.",
        "Return 429 with Retry-After; clients back off with jitter.",
      ],
      code: [
        {
          title: "Token bucket (single process) and Redis fixed-window",
          variants: [
            {
              lang: "python",
              code: `
import time

class TokenBucket:
    def __init__(self, capacity, refill_per_sec):
        self.capacity = capacity
        self.rate = refill_per_sec
        self.tokens = capacity
        self.last = time.monotonic()

    def allow(self, cost=1):
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

def allow_fixed_window(redis, key, limit, window_sec):
    bucket = f"rl:{key}:{int(time.time()) // window_sec}"
    count = redis.incr(bucket)            # atomic
    if count == 1:
        redis.expire(bucket, window_sec)
    return count <= limit
`,
            },
            {
              lang: "go",
              code: `
type TokenBucket struct {
	mu       sync.Mutex
	capacity float64
	rate     float64 // tokens per second
	tokens   float64
	last     time.Time
}

func (b *TokenBucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	b.tokens = math.Min(b.capacity, b.tokens+now.Sub(b.last).Seconds()*b.rate)
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Design a rate limiter for a public API.",
          a: "Clarify: limit by what (API key, user, IP), per endpoint or global, what limits (e.g. 100 req/min with bursts), hard vs soft, distributed across many gateway instances. Algorithm: **token bucket** per key. State in **Redis** with an atomic Lua script (refill + take), TTL on idle keys. Place it in the API gateway middleware; return 429 + Retry-After + remaining headers. Rules stored in a config service and cached locally. Discuss fail-open vs closed on Redis outages, hot keys (shard Redis by key), multi-region (local limits per region), and monitoring of rejects.",
          freq: "very-common",
        },
        {
          q: "What's wrong with a fixed-window counter?",
          a: "Bursts at window boundaries: with 100/minute, a client can send 100 requests at 12:00:59 and 100 more at 12:01:00 — 200 in two seconds, while each window looks compliant. Sliding window log is exact but stores every timestamp; the **sliding window counter** approximates it with the current window's count plus the previous window's count weighted by overlap, using O(1) memory.",
          freq: "common",
        },
        {
          q: "How do you avoid race conditions in a distributed rate limiter?",
          a: "Never do get-then-set from the application. Use atomic primitives in the shared store: Redis `INCR` (fixed window), or a **Lua script** that reads the bucket, refills, decrements and writes back atomically (Redis runs scripts single-threaded). Alternatives: Redis `CL.THROTTLE` (redis-cell module), or optimistic CAS loops. For extreme throughput, approximate with per-instance local buckets that each get a share of the global rate.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which algorithm allows short bursts but bounds the long-term rate?",
          options: ["Leaky bucket", "Token bucket", "Fixed window", "None"],
          answer: 1,
          explain: "Saved-up tokens permit bursts up to the bucket capacity.",
        },
        {
          q: "The correct HTTP status for a rate-limited request is…",
          options: ["403", "429", "503", "418"],
          answer: 1,
          explain: "429 Too Many Requests, ideally with Retry-After.",
        },
        {
          q: "Why use a Lua script in Redis for rate limiting?",
          options: ["Lua is faster than C", "It makes the read-modify-write atomic", "Redis requires Lua", "To persist data"],
          answer: 1,
          explain: "Concurrent gateway instances would otherwise race.",
        },
        {
          q: "With 100 req/min fixed windows, the worst-case burst across a boundary is…",
          options: ["100", "150", "~200", "Unlimited"],
          answer: 2,
          explain: "End of one window plus start of the next.",
        },
      ],
    },

    // ------------------------------------------------------------------ API DESIGN
    {
      id: "api-design",
      title: "API Design & Real-time Communication",
      tagline: "REST, gRPC, GraphQL, WebSockets — plus pagination and idempotency.",
      difficulty: "intermediate",
      minutes: 15,
      diagram: {
        title: "API gateway with sync and real-time paths",
        nodes: [
          { id: "web", label: "Web / mobile", kind: "client", x: 90, y: 200 },
          { id: "gw", label: "API gateway", sub: "auth, routing, limits", kind: "gateway", x: 330, y: 200 },
          { id: "users", label: "User service", sub: "REST/gRPC", kind: "service", x: 600, y: 80 },
          { id: "orders", label: "Order service", sub: "gRPC", kind: "service", x: 600, y: 230 },
          { id: "ws", label: "WebSocket gateway", sub: "persistent conns", kind: "gateway", x: 330, y: 440 },
          { id: "bus", label: "Event bus", sub: "Kafka", kind: "queue", x: 600, y: 440 },
          { id: "db", label: "Orders DB", kind: "db", x: 860, y: 230 },
        ],
        edges: [
          { from: "web", to: "gw", label: "HTTPS" },
          { from: "gw", to: "users" },
          { from: "gw", to: "orders" },
          { from: "orders", to: "db" },
          { from: "orders", to: "bus", label: "OrderShipped" },
          { from: "bus", to: "ws" },
          { from: "ws", to: "web", label: "push" },
        ],
        flows: [
          {
            name: "Create order (idempotent)",
            path: ["web", "gw", "orders", "db", "orders", "gw", "web"],
            steps: [
              "POST /v1/orders with an Idempotency-Key header (a UUID generated by the client).",
              "Gateway authenticates (JWT/OAuth), applies rate limits and routes to the order service over gRPC.",
              "In one transaction: insert the order and record the idempotency key with the response.",
              "Committed.",
              "201 Created with the order. A retry with the same key returns the stored response instead of creating a duplicate.",
              "The client gets a consistent answer even if the network dropped the first response.",
            ],
          },
          {
            name: "Real-time update",
            path: ["orders", "bus", "ws", "web"],
            steps: [
              "Later, the order ships; the order service publishes an event.",
              "The WebSocket gateway consumes events for users connected to it.",
              "It pushes the update over the user's open connection — no polling needed.",
            ],
          },
        ],
      },
      concept: `
## Choosing a style
| Style | Strengths | Weaknesses | Typical use |
|---|---|---|---|
| **REST** (JSON over HTTP) | simple, cacheable, universal tooling | over/under-fetching, chatty | public APIs, CRUD |
| **gRPC** (protobuf over HTTP/2) | fast, typed contracts, streaming | not browser-native, binary | service-to-service |
| **GraphQL** | client picks fields, one round trip | caching & rate limiting harder, N+1 risk | complex UIs, mobile |
| **WebSockets** | full-duplex, low latency | stateful connections to scale | chat, games, collaboration |
| **Server-Sent Events** | simple server → client stream over HTTP | one direction | notifications, LLM token streaming |
| **Long polling** | works everywhere | overhead, latency | fallback |
| **Webhooks** | server → server callbacks | delivery & security concerns | payment/event notifications |

## REST essentials
- Resources as nouns: \`GET /users/42/orders\`; verbs via HTTP methods.
- **Idempotency**: GET, PUT, DELETE are idempotent; POST is not → accept an **Idempotency-Key** for creates/payments.
- Status codes that mean something: 200/201/204, 400/401/403/404/409/422, 429, 500/503.
- **Versioning**: \`/v1/\` in the path or a header; never break existing clients.

## Pagination
- **Offset/limit** (\`?page=3\`): simple, but slow for deep pages (DB still scans skipped rows) and unstable when rows are inserted.
- **Cursor / keyset** (\`?after=<opaque cursor>\`): \`WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20\` — consistent and O(page size) with an index. Default for feeds and large lists.

## Idempotency keys in detail
Client generates a unique key per logical operation and reuses it on retries. The server stores \`key → (request hash, response)\` atomically with the operation; repeated requests return the saved response; a different payload with the same key → 422. Keys expire after ~24 hours. Essential for payments and any non-idempotent POST.

## Real-time at scale
WebSocket servers hold millions of long-lived connections — keep them in a dedicated **gateway tier** that only manages connections, with a registry (user → gateway) in Redis and a pub/sub or event bus to route messages to the right gateway. Use heartbeats to detect dead connections, and reconnect with backoff + resume tokens.

## Security basics
TLS everywhere, authentication (OAuth 2.0 / OIDC, JWTs with short expiry), authorization per resource, input validation, rate limiting, and never trusting client-supplied IDs without ownership checks (IDOR).
`,
      keyPoints: [
        "REST for public CRUD, gRPC between services, GraphQL for flexible UIs.",
        "WebSockets for bidirectional real-time; SSE for server push streams.",
        "POST isn't idempotent — use Idempotency-Key for creates/payments.",
        "Prefer cursor pagination over offsets for large/feeds.",
        "Version APIs; never break existing clients.",
      ],
      interview: [
        {
          q: "How do you make a POST request safe to retry?",
          a: "Require an **Idempotency-Key** header (client-generated UUID per logical operation). Server side, in the same transaction as the operation, store the key with a fingerprint of the request and the response. On a retry with the same key, return the stored response; if the payload differs, return an error. Handle concurrent duplicates with a unique constraint or lock on the key. Expire keys after a window (Stripe uses 24h).",
          freq: "very-common",
        },
        {
          q: "Offset vs cursor pagination?",
          a: "Offset (`LIMIT 20 OFFSET 10000`) makes the database walk and discard 10,000 rows — slow for deep pages — and if new rows are inserted between requests, items shift and users see duplicates or miss items. Cursor/keyset pagination encodes the last seen sort key (e.g. `(created_at, id)`) and queries `WHERE (created_at, id) < cursor ORDER BY … LIMIT 20` — O(limit) with an index and stable under inserts. Trade-off: no random 'jump to page 57'.",
          freq: "very-common",
        },
        {
          q: "WebSockets vs SSE vs long polling for a notifications feature?",
          a: "If the client only needs to **receive** updates, **SSE** is simplest: plain HTTP, auto-reconnect, works through most proxies. If the client also sends frequent messages (chat, multiplayer), use **WebSockets** for full duplex. Long polling is the compatibility fallback. At scale, all three need a connection-holding gateway tier, a registry of which server holds which user, and a pub/sub backbone to route events.",
          freq: "common",
        },
        {
          q: "REST vs gRPC for internal microservices?",
          a: "gRPC: binary protobuf (smaller, faster to parse), HTTP/2 multiplexing, generated clients with strict contracts, built-in streaming and deadlines — great for internal service-to-service calls. REST/JSON: human-readable, browser-native, trivially debuggable and cacheable — better for public APIs. Many companies use gRPC internally and expose REST/GraphQL at the edge via a gateway.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which HTTP method is NOT idempotent by definition?",
          options: ["GET", "PUT", "DELETE", "POST"],
          answer: 3,
          explain: "Repeating a POST may create duplicates.",
        },
        {
          q: "Best pagination for an infinite-scrolling feed with frequent inserts?",
          options: ["Offset/limit", "Cursor (keyset)", "Page numbers", "Random sampling"],
          answer: 1,
          explain: "Stable and efficient regardless of depth.",
        },
        {
          q: "Streaming LLM tokens from server to browser is commonly done with…",
          options: ["SMTP", "Server-Sent Events", "FTP", "Webhooks"],
          answer: 1,
          explain: "One-directional server → client streams over HTTP.",
        },
        {
          q: "GraphQL's main advantage is…",
          options: ["Better HTTP caching", "Clients request exactly the fields they need in one round trip", "Binary encoding", "No schema needed"],
          answer: 1,
          explain: "It solves over- and under-fetching.",
        },
      ],
    },

    // ------------------------------------------------------------------ CDN & STORAGE
    {
      id: "cdn-storage",
      title: "CDNs, DNS & Object Storage",
      tagline: "Serve bytes from close to the user and store blobs cheaply forever.",
      difficulty: "beginner",
      minutes: 12,
      diagram: {
        title: "Content delivery path",
        nodes: [
          { id: "user", label: "User in Lagos", kind: "client", x: 90, y: 300 },
          { id: "dns", label: "GeoDNS / anycast", kind: "dns", x: 90, y: 100 },
          { id: "edge", label: "Edge POP", sub: "nearest city", kind: "cdn", x: 360, y: 300 },
          { id: "shield", label: "Origin shield", sub: "regional cache", kind: "cdn", x: 620, y: 300 },
          { id: "origin", label: "Origin", sub: "object store", kind: "storage", x: 880, y: 300 },
          { id: "app", label: "App (signed URLs)", kind: "service", x: 620, y: 100 },
        ],
        edges: [
          { from: "user", to: "dns" },
          { from: "user", to: "edge" },
          { from: "edge", to: "shield", label: "miss" },
          { from: "shield", to: "origin", label: "miss" },
          { from: "user", to: "app", dashed: true },
          { from: "app", to: "origin", dashed: true },
        ],
        flows: [
          {
            name: "Edge hit",
            path: ["user", "dns", "user", "edge", "user"],
            steps: [
              "DNS resolves cdn.example.com to the closest edge (GeoDNS or anycast IP).",
              "The client gets an address ~20 ms away instead of ~200 ms.",
              "Edge cache hit for /img/cat.webp — served from the POP's RAM/SSD.",
              "Fast response; origin never sees the request.",
            ],
          },
          {
            name: "Edge miss",
            path: ["user", "edge", "shield", "origin", "shield", "edge", "user"],
            steps: [
              "Request reaches the edge…",
              "…which misses and asks the regional origin shield (collapses many edges' misses into one).",
              "Shield misses too; fetch from the origin bucket.",
              "Origin returns the object with Cache-Control headers.",
              "Shield caches it for other edges in the region.",
              "Edge caches it and serves the user; the next nearby user gets a hit.",
            ],
          },
          {
            name: "Private upload",
            path: ["user", "app", "origin"],
            steps: [
              "The app authenticates the user and returns a short-lived pre-signed upload URL.",
              "The client uploads the file directly to object storage — app servers never proxy the bytes.",
            ],
          },
        ],
      },
      concept: `
## DNS in system design
DNS translates names to IPs and is the first routing layer: **GeoDNS** returns region-specific answers, **weighted** records do gradual migrations, **health-checked failover** removes dead regions, and low **TTLs** allow faster changes (at the cost of more queries). **Anycast** advertises the same IP from many locations; routing delivers users to the nearest one (used by CDNs and public DNS resolvers).

## CDNs
A CDN is a globally distributed cache of HTTP responses at **edge POPs** (points of presence). Benefits: lower latency (physics — fewer kilometres), offloaded origin bandwidth, DDoS absorption, TLS termination near users.
- **Pull CDN** (most common): edges fetch from origin on first miss and cache per \`Cache-Control\`.
- **Push CDN**: you upload content proactively — good for large, predictable assets.
- **Cache keys** and **invalidation**: version file names (\`app.3f9a1c.js\`) for immutable assets with long TTLs; purge APIs for urgent changes.
- **Origin shield**: a mid-tier cache that collapses misses from many edges.
- Dynamic content can be accelerated too (optimized routes, TLS reuse, edge compute).

## Object storage (S3, GCS, Azure Blob)
Flat namespace of buckets and keys, virtually unlimited capacity, **11 nines of durability** via replication/erasure coding, cheap per GB, accessed over HTTP. Not a filesystem: no partial updates, higher latency than local disk, list operations are slow.
- Store **blobs** (images, video, backups, logs, ML datasets) in object storage, **metadata** in a database.
- **Pre-signed URLs** let clients upload/download directly with temporary credentials.
- **Multipart upload** for large files (parallel, resumable).
- **Storage classes / lifecycle rules**: hot → infrequent access → archive (Glacier) to cut costs.

## Putting it together
Upload: client → app (auth, get signed URL) → direct PUT to the bucket → event triggers processing (thumbnails, transcoding) → processed objects served through the CDN. This keeps app servers out of the heavy byte path entirely.
`,
      keyPoints: [
        "GeoDNS / anycast route users to the nearest region or edge.",
        "CDNs cache content at edges: lower latency, less origin load.",
        "Version static asset names for long TTLs and easy invalidation.",
        "Blobs in object storage, metadata in the database.",
        "Pre-signed URLs keep big uploads off your app servers.",
      ],
      interview: [
        {
          q: "How would you serve user-uploaded images efficiently worldwide?",
          a: "Client requests an upload URL; the app authenticates and returns a **pre-signed URL** to object storage; the client uploads directly. An event (S3 notification → queue) triggers workers to generate resized variants (thumbnails, WebP/AVIF). Store metadata (owner, keys, dimensions) in the DB. Serve images via a **CDN** with long cache TTLs and versioned keys; use signed CDN URLs for private images. Optionally use on-the-fly image resizing at the edge.",
          freq: "very-common",
        },
        {
          q: "How do you invalidate content cached in a CDN?",
          a: "Best: avoid invalidation by **versioning** URLs (content hash in the filename) so new content has a new URL and old objects can be cached 'forever'. For mutable URLs, set appropriate Cache-Control/TTL and use the CDN's purge API (by URL, prefix or surrogate key/tag) when content changes. Purges take seconds to propagate globally and some CDNs rate-limit them.",
          freq: "common",
        },
        {
          q: "Why not store images in the database?",
          a: "Large blobs bloat the DB, slow backups and replication, consume expensive storage and memory (buffer pool), and force app servers to stream bytes. Object storage is cheaper, more durable, scales without limits and integrates with CDNs. Keep only the object key and metadata in the DB.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Anycast routes a user to…",
          options: ["A random server", "The topologically nearest location advertising that IP", "The origin always", "The least loaded server globally"],
          answer: 1,
          explain: "The same IP is announced from many places; BGP picks the nearest.",
        },
        {
          q: "The cleanest way to update a cached JS bundle is…",
          options: ["Purge the CDN every deploy", "Use content-hashed filenames", "Set TTL to 0", "Disable the CDN"],
          answer: 1,
          explain: "New content → new URL; old caches never serve stale code.",
        },
        {
          q: "Where should a 2 GB video upload go?",
          options: ["Through the app server into Postgres", "Directly to object storage via a pre-signed multipart upload", "Into Redis", "Into the CDN cache"],
          answer: 1,
          explain: "Keep heavy bytes off the app tier; multipart makes it resumable.",
        },
        {
          q: "An origin shield reduces…",
          options: ["DNS latency", "The number of misses reaching the origin", "Storage cost", "TLS overhead"],
          answer: 1,
          explain: "Many edges share one regional cache layer.",
        },
      ],
    },

    ...systemDesignCases,
  ],
};
