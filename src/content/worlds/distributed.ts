import type { World } from "../types";
import { distributedPart2 } from "./distributed-2";

export const distributed: World = {
  id: "distributed",
  order: 6,
  title: "Consensus Nebula",
  subtitle: "CAP, consistency, clocks, replication, Raft, transactions & storage",
  description:
    "The almighty distributed systems: what breaks when computers talk over unreliable networks, and the protocols that make them agree anyway. This is what separates senior from staff-level interviews.",
  emoji: "🌌",
  color: "#a78bfa",
  boss: {
    name: "The Byzantine General",
    title: "Sender of Contradictory Orders",
    emoji: "🎖️",
    taunt: "I will tell each of your nodes something different. Let's see your cluster agree on ANYTHING.",
    defeat: "A majority of honest nodes... quorum reached... I am outvoted!",
  },
  lessons: [
    // ------------------------------------------------------------------ FUNDAMENTALS
    {
      id: "dist-fundamentals",
      title: "Why Distributed Systems Are Hard",
      tagline: "Partial failure, unreliable networks, and retries that make things worse.",
      difficulty: "intermediate",
      minutes: 15,
      visualizers: ["retries"],
      concept: `
## The core difficulty: partial failure
On one machine, things mostly work or crash entirely. In a distributed system, **some parts fail while others keep running**, and you often **can't tell** which. A request that times out may have: never arrived, been processed with the response lost, or still be running. This uncertainty is the root of nearly every hard problem in this world.

## The eight fallacies of distributed computing
1. The network is reliable. 2. Latency is zero. 3. Bandwidth is infinite. 4. The network is secure. 5. Topology doesn't change. 6. There is one administrator. 7. Transport cost is zero. 8. The network is homogeneous.
Every one of them has caused outages. Design as if each is false.

## Failure models
- **Crash-stop** — a node halts and never returns. **Crash-recovery** — it may come back with its durable state (most real systems).
- **Omission** — messages are lost. **Timing** — messages or processing are arbitrarily slow (GC pauses, overloaded hosts).
- **Byzantine** — nodes behave arbitrarily or maliciously (blockchains, aerospace). Most datacenter systems assume non-Byzantine faults.

## Timeouts are guesses
You can't distinguish a slow node from a dead one. Timeouts too short → false failure detection and needless failovers; too long → slow recovery. Use adaptive timeouts (based on observed latency percentiles), and **deadlines that propagate** through call chains (gRPC deadlines) so downstream work stops when the caller gave up.

## Retries, done right (see the simulator)
- Only retry **idempotent** operations — or make them idempotent with keys.
- **Exponential backoff with jitter** to avoid synchronized retry waves.
- **Retry budgets** (e.g. ≤ 10% extra traffic) and retrying at **one layer only** — retries at every layer multiply (3 layers × 3 retries = 27 attempts).
- **Circuit breakers**: after repeated failures stop calling the dependency for a while (open), probe occasionally (half-open), resume when healthy (closed). Fail fast instead of piling up threads.
- **Bulkheads**: isolate resources (thread pools, connection pools) per dependency so one slow service can't exhaust everything.
- **Load shedding & backpressure**: reject early when overloaded instead of queueing unboundedly.

## Idempotency is the superpower
If an operation can be safely applied twice, then "at-least-once + retry" becomes correct. Patterns: client-generated request IDs, conditional writes (\`IF version = 7\`), upserts, and naturally idempotent operations (set balance hold for order 42, not "subtract $10").

## Observability
Distributed traces (OpenTelemetry) stitch a request's path across services; metrics (RED: rate, errors, duration; USE: utilization, saturation, errors) and structured logs with correlation IDs are mandatory to debug anything.
`,
      keyPoints: [
        "Partial failure + uncertainty is the defining problem.",
        "A timeout doesn't tell you whether the operation happened.",
        "Retry only idempotent operations, with exponential backoff + jitter.",
        "Circuit breakers, bulkheads and load shedding stop cascades.",
        "Retry at one layer; propagate deadlines.",
      ],
      interview: [
        {
          q: "A request to another service timed out. What do you know?",
          a: "Almost nothing: the request may never have arrived, may have been processed and the response lost, or may still be in progress. That's why you need **idempotency** (so retrying is safe), a way to **query the outcome** (status endpoint, idempotency key lookup), and timeouts tuned to latency percentiles. For money or inventory, treat timeouts as UNKNOWN and reconcile rather than assume failure.",
          freq: "very-common",
        },
        {
          q: "What is a circuit breaker?",
          a: "A wrapper around calls to a dependency that tracks failures. **Closed**: calls pass through. After a failure threshold it **opens**: calls fail immediately (or use a fallback) without hitting the dependency, giving it time to recover and protecting the caller's threads. After a cool-down it goes **half-open** and lets a few trial requests through; success closes it, failure re-opens it. Popular in Hystrix/Resilience4j, Envoy outlier detection.",
          freq: "very-common",
        },
        {
          q: "Why add jitter to exponential backoff?",
          a: "Clients that failed at the same moment (e.g. during an outage) would otherwise retry at the same moments — 1s, 2s, 4s — creating synchronized waves that overload the recovering service again. Jitter randomizes each delay (\"full jitter\": random between 0 and the backoff cap), spreading the load evenly. AWS's analysis showed full jitter minimizes both total work and completion time.",
          freq: "common",
        },
        {
          q: "What is a cascading failure and how do you prevent it?",
          a: "One component slows or fails, its callers' requests pile up (threads, connections, queues), they slow down and fail, and the failure spreads upstream until the whole system is down — often amplified by retries. Prevention: timeouts everywhere, circuit breakers, bulkheads, limiting retries (budgets, single layer), load shedding with priorities, autoscaling with headroom, and graceful degradation (serve cached/partial results).",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A service call times out. The safest assumption is…",
          options: ["It failed", "It succeeded", "The outcome is unknown", "The network is down"],
          answer: 2,
          explain: "Request lost, response lost, or still running — you can't tell.",
        },
        {
          q: "Three service layers each retry 3 times. Worst-case attempts at the bottom layer per user request?",
          options: ["3", "9", "27", "81"],
          answer: 2,
          explain: "Retries multiply: 3 × 3 × 3. Retry at one layer only.",
        },
        {
          q: "Exponential backoff WITHOUT jitter still causes…",
          options: ["No problems", "Synchronized retry waves", "Lost writes", "Deadlocks"],
          answer: 1,
          explain: "Clients that failed together retry together.",
        },
        {
          q: "An open circuit breaker…",
          options: ["Retries faster", "Fails calls immediately without hitting the dependency", "Opens new connections", "Disables timeouts"],
          answer: 1,
          explain: "It gives the dependency room to recover and frees caller resources.",
        },
        {
          q: "Which operation is naturally idempotent?",
          options: ["balance -= 10", "INSERT a new order row with an auto-increment id", "SET status = 'PAID' WHERE order_id = 42", "Append an event to a log without an id"],
          answer: 2,
          explain: "Applying it twice leaves the same state.",
        },
      ],
    },

    // ------------------------------------------------------------------ CAP
    {
      id: "cap-pacelc",
      title: "CAP & PACELC",
      tagline: "When the network splits, you choose consistency or availability.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["cap"],
      concept: `
## The CAP theorem, stated precisely
For a replicated data store, during a **network Partition** you must choose:
- **Consistency** (linearizability): every read sees the most recent write, as if there were one copy; or
- **Availability**: every request to a non-failed node gets a (non-error) response.

You can't have both *while partitioned*. Partitions aren't optional in real networks, so "CA" isn't a real choice for distributed systems — the question is **what you do during a partition**.

- **CP** systems refuse (or block) requests on the minority side to avoid stale or conflicting data: ZooKeeper, etcd, Consul, HBase, Spanner, MongoDB (majority writes).
- **AP** systems keep serving on both sides and reconcile later: Cassandra, DynamoDB (eventually consistent reads), Riak, CouchDB, DNS.

Play with the simulator: cut the network, write on both sides in AP mode, then heal and watch last-write-wins drop a write.

## PACELC — the part CAP leaves out
Partitions are rare; latency is constant. **PACELC**: if **P**artitioned, choose **A** or **C**; **E**lse, choose **L**atency or **C**onsistency. Strong consistency needs coordination (quorums, consensus) on every write, which costs round trips — often cross-region.
- **PC/EC**: Spanner, etcd, ZooKeeper (consistency always).
- **PA/EL**: Cassandra, Dynamo (fast and available, eventually consistent).
- **PA/EC** and tunable systems: Cassandra/DynamoDB let you choose per query (\`QUORUM\` vs \`ONE\`, strongly consistent reads).

## Choosing per feature, not per company
A single product mixes both: shopping cart and likes can be AP (merge later), payments and inventory decrement need CP. Senior answers say *which data* needs *which guarantee* and *why*.

## Common misconceptions
- CAP's "consistency" ≠ ACID's "consistency" (integrity constraints).
- CAP availability means *every* non-failed node responds — many "highly available" CP systems still have >99.99% uptime because partitions are rare.
- It's not a 2-of-3 menu forever; it's a trade-off under partition.
`,
      keyPoints: [
        "During a partition: consistency OR availability.",
        "CP refuses minority-side requests; AP serves stale/conflicting data.",
        "PACELC: otherwise trade latency vs consistency.",
        "Choose guarantees per data type (likes vs payments).",
        "CAP consistency = linearizability, not ACID consistency.",
      ],
      interview: [
        {
          q: "Explain the CAP theorem with an example.",
          a: "Two replicas of a bank balance, a network partition between them, a withdrawal arrives at replica A. **CP**: A can't confirm with B, so it rejects (or waits) — no double spend, but unavailable. **AP**: A accepts, B may accept another withdrawal too — available, but the replicas diverge and you might overdraw; you reconcile when the partition heals. Since partitions happen, real systems choose a behaviour for that case, often per operation.",
          freq: "very-common",
        },
        {
          q: "Is Cassandra CP or AP?",
          a: "By default AP (and PA/EL under PACELC): any replica can accept writes, reads use quorums you configure, and conflicts resolve by last-write-wins timestamps. But consistency is **tunable per query**: with `QUORUM` reads and writes (R + W > N) you get read-your-writes on the overlapping replicas, and lightweight transactions (Paxos) give linearizable compare-and-set at higher latency. So the honest answer is \"it depends on the consistency level\".",
          freq: "common",
        },
        {
          q: "What does PACELC add to CAP?",
          a: "CAP only speaks about behaviour during partitions. PACELC adds the normal case: **Else**, you trade **Latency** against **Consistency** — synchronous replication/consensus adds round trips on every write. It explains why many systems choose weaker consistency even when the network is fine: to keep latency low, especially across regions.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "During a partition, a CP system on the minority side will…",
          options: ["Serve stale data", "Reject or block requests", "Elect two leaders", "Lose data silently"],
          answer: 1,
          explain: "It can't reach a majority, so it refuses rather than risk inconsistency.",
        },
        {
          q: "Which is a typical AP system?",
          options: ["etcd", "ZooKeeper", "Cassandra (default settings)", "Spanner"],
          answer: 2,
          explain: "Cassandra favors availability with tunable consistency.",
        },
        {
          q: "PACELC's 'ELC' part describes the trade-off…",
          options: ["During partitions", "When there is no partition: latency vs consistency", "Between CPU and memory", "Between reads and writes"],
          answer: 1,
          explain: "Coordination for consistency costs latency even without failures.",
        },
        {
          q: "\"CA\" (consistent + available, no partition tolerance) is…",
          options: ["The best choice", "Not a realistic option for distributed systems", "What Cassandra provides", "Required for banks"],
          answer: 1,
          explain: "Networks partition; you must decide how to behave when they do.",
        },
      ],
    },

    // ------------------------------------------------------------------ CONSISTENCY MODELS
    {
      id: "consistency-models",
      title: "Consistency Models",
      tagline: "From linearizable to eventual — and the client guarantees in between.",
      difficulty: "advanced",
      minutes: 15,
      visualizers: ["replication"],
      concept: `
## A ladder of guarantees (strongest first)
| Model | Guarantee | Cost | Example |
|---|---|---|---|
| **Linearizable** | behaves like a single copy; once a write completes, every later read (by anyone) sees it | consensus / quorum on every op | etcd, Spanner, ZooKeeper writes |
| **Sequential** | all nodes see operations in the same order, consistent with each client's program order (not real time) | | |
| **Causal** | causally related operations are seen in order by everyone; concurrent ones may differ | metadata (vector clocks) | MongoDB causal sessions, COPS |
| **Session guarantees** | per-client: read-your-writes, monotonic reads, monotonic writes, writes-follow-reads | routing / version tracking | most apps need these |
| **Eventual** | if writes stop, replicas converge eventually | cheapest | DNS, Cassandra ONE, S3 (historically) |

## Session guarantees in practice (try the simulator)
- **Read-your-writes**: after I update my profile, I see the update. Fix: read from the leader for a window after writing, or track the write's position (LSN/version) and only read replicas that caught up.
- **Monotonic reads**: I never see newer data then older data. Fix: stick a user to one replica, or carry a "last seen version".
- **Consistent prefix**: I never see an answer before its question (causal order across partitions).

## Linearizability vs serializability
- **Serializability** (databases): transactions behave as if executed one after another in *some* order — about multi-object transactions.
- **Linearizability** (distributed systems): single-object operations appear instantaneous and respect real-time order.
- **Strict serializability** = both (Spanner, FoundationDB, CockroachDB aims close).

## When do you need linearizability?
Leader election and locks (exactly one leader), uniqueness constraints (one user per username), "sell exactly 100 tickets", and any cross-channel race (an image uploaded, then a message saying "resize it" — the resizer must see the image). Everything else usually tolerates weaker, cheaper guarantees.
`,
      keyPoints: [
        "Linearizable = acts like one copy, respecting real time.",
        "Causal consistency preserves cause → effect order only.",
        "Session guarantees: read-your-writes, monotonic reads.",
        "Serializable (transactions) ≠ linearizable (single objects).",
        "Use the weakest model your feature tolerates.",
      ],
      interview: [
        {
          q: "What's the difference between linearizability and serializability?",
          a: "**Serializability** is an isolation property of *transactions* over many objects: the outcome equals some serial order of the transactions, which need not match real time. **Linearizability** is a recency guarantee on *single objects*: each operation appears to take effect atomically at some instant between its start and end, so once a write completes, all later reads see it. Strict serializability combines both. A serializable DB with async replicas can still serve stale reads.",
          freq: "common",
        },
        {
          q: "How do you provide read-your-writes on top of async replicas?",
          a: "Options: (1) route a user's reads to the leader for N seconds after they write (or always for their own data, like their profile); (2) record the replication log position of the user's last write (in a cookie/session) and only read from replicas that have applied at least that position (or wait); (3) use synchronous replication for that data. Across devices you need the version tracked server-side, not just in the browser.",
          freq: "common",
        },
        {
          q: "Give an example where eventual consistency causes a visible bug.",
          a: "A user posts a comment then refreshes and it's gone (read hit a lagging replica: read-your-writes violation). Or a reply appears before the message it replies to (causal violation across partitions). Or a counter jumps back and forth (monotonic reads violation). Fixes are session guarantees or causal consistency, not necessarily full linearizability.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Strongest of these consistency models?",
          options: ["Eventual", "Causal", "Linearizable", "Read-your-writes"],
          answer: 2,
          explain: "It behaves like a single up-to-date copy.",
        },
        {
          q: "\"I refreshed and saw an older version than before\" violates…",
          options: ["Read-your-writes", "Monotonic reads", "Durability", "Atomicity"],
          answer: 1,
          explain: "Time appeared to go backwards for that client.",
        },
        {
          q: "Pinning a user to a single replica provides…",
          options: ["Linearizability", "Monotonic reads", "Read-your-writes always", "Atomic commits"],
          answer: 1,
          explain: "Each subsequent read sees the same or newer state.",
        },
        {
          q: "Which feature truly needs linearizability?",
          options: ["Like counts", "Unique username registration", "News feed ordering", "View counters"],
          answer: 1,
          explain: "Two users must never both succeed in claiming the same name.",
        },
      ],
    },

    // ------------------------------------------------------------------ TIME & ORDERING
    {
      id: "time-ordering",
      title: "Time, Clocks & Ordering",
      tagline: "Physical clocks lie. Logical clocks capture causality.",
      difficulty: "advanced",
      minutes: 15,
      visualizers: ["clocks"],
      concept: `
## Why wall clocks can't order events
Each machine's quartz clock drifts (~tens of ppm), NTP corrects it with errors of milliseconds (more across the internet), and clocks can **jump backwards** after a sync or leap second. Two events on different machines with timestamps 3 ms apart cannot be reliably ordered. Using wall-clock timestamps for **last-write-wins** silently drops writes when clocks disagree.

## Happened-before (Lamport, 1978)
Event a → b if: they're on the same process and a came first; or a is the send of a message and b its receipt; or transitively. If neither a → b nor b → a, they're **concurrent** — neither could have influenced the other.

## Lamport clocks
Each process keeps a counter: increment on every event; attach it to messages; on receive, set \`L = max(L, msg) + 1\`.
- Guarantees: a → b ⇒ L(a) < L(b).
- **Not** the converse: L(a) < L(b) doesn't mean a caused b. Ties broken by process ID give a **total order** consistent with causality (used for mutual exclusion, total-order broadcast).

## Vector clocks
Each process keeps a vector with one counter per process: increment your own entry on each event; on receive take the element-wise max then increment yours.
- a → b **iff** V(a) ≤ V(b) element-wise and V(a) ≠ V(b). Otherwise **concurrent** — exactly what you need to detect conflicting writes (Dynamo, Riak).
- Cost: O(N) metadata per event; pruned or replaced by **version vectors** (per replica, not per client) and **dotted version vectors** in practice.

## Hybrid logical clocks & TrueTime
- **HLC** (CockroachDB, YugabyteDB): physical time + a logical counter — close to wall time, but preserves causality and never goes backwards.
- **TrueTime** (Spanner): GPS + atomic clocks expose an uncertainty interval [earliest, latest]; Spanner **waits out the uncertainty** (commit wait, ~ a few ms) before committing, which yields externally consistent (linearizable) transactions globally.

## Practical rules
Use logical ordering (sequence numbers from a leader, log offsets, version numbers) for correctness; use wall clocks only for human display and TTLs, with tolerance.
`,
      keyPoints: [
        "Wall clocks drift and jump — don't order distributed events by them.",
        "Lamport: a → b ⇒ L(a) < L(b), not the converse.",
        "Vector clocks detect concurrency: neither dominates ⇒ concurrent.",
        "HLC = physical + logical; TrueTime waits out clock uncertainty.",
        "Last-write-wins with wall clocks can silently lose writes.",
      ],
      interview: [
        {
          q: "Lamport clocks vs vector clocks?",
          a: "Lamport clocks are a single counter per process; they guarantee that if a happened before b then L(a) < L(b), and with tie-breaking give a total order, but you can't tell whether two events were concurrent. Vector clocks keep one counter per process; comparing vectors tells you exactly whether a → b, b → a, or they're concurrent — at the cost of O(N) size. Use Lamport for total ordering (e.g. mutual exclusion), vectors for conflict detection in multi-writer replication.",
          freq: "very-common",
        },
        {
          q: "Why is last-write-wins with timestamps dangerous?",
          a: "Clock skew means the 'later' write by wall time may actually have happened earlier, or two concurrent writes get arbitrary order — one is silently discarded. A node with a fast clock can make its writes win for minutes. LWW is acceptable for idempotent overwrites of independent data (caches, sensor readings), but for user data detect conflicts (vector clocks) and merge (CRDTs / application logic).",
          freq: "common",
        },
        {
          q: "How does Spanner achieve global external consistency?",
          a: "TrueTime returns an interval guaranteed to contain the true time (uncertainty ε, a few ms, from GPS and atomic clocks in each datacenter). A transaction picks a commit timestamp s ≥ TT.now().latest and then **waits until TT.now().earliest > s** before releasing locks/acknowledging (commit wait). Any transaction that starts after it in real time must get a later timestamp, so timestamp order matches real-time order across the globe. Combined with Paxos-replicated shards and 2PC, this gives strict serializability.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "If L(a) < L(b) for Lamport timestamps, then…",
          options: ["a caused b", "b caused a", "a may or may not have happened before b", "a and b are concurrent"],
          answer: 2,
          explain: "Lamport order is consistent with causality but can't prove it.",
        },
        {
          q: "Vector clocks [2,1,0] and [1,2,0] are…",
          options: ["First before second", "Second before first", "Concurrent", "Equal"],
          answer: 2,
          explain: "Neither is ≤ the other in every position.",
        },
        {
          q: "On receiving a message, a vector clock…",
          options: ["Resets to zero", "Takes the element-wise max, then increments its own entry", "Copies the sender's vector", "Adds the vectors"],
          answer: 1,
          explain: "Merge knowledge, then record the receive event.",
        },
        {
          q: "Spanner's 'commit wait' exists to…",
          options: ["Batch writes", "Wait out clock uncertainty so timestamps respect real time", "Elect a leader", "Replicate to replicas"],
          answer: 1,
          explain: "It trades a few ms of latency for external consistency.",
        },
      ],
    },

    // ------------------------------------------------------------------ REPLICATION & QUORUMS
    {
      id: "replication-quorums",
      title: "Replication & Quorums",
      tagline: "Leaders, leaderless replicas and the R + W > N rule.",
      difficulty: "advanced",
      minutes: 16,
      visualizers: ["quorum"],
      concept: `
## Why replicate
Durability (survive disk/machine loss), availability (keep serving through failures), read scaling, and latency (copies near users).

## Three replication styles
**Single-leader**: all writes through one leader that streams a log to followers. Simple, no write conflicts. Failover must avoid **split brain** (two leaders) — use consensus/leases/fencing. Postgres, MySQL, MongoDB, Kafka partitions.

**Multi-leader**: several leaders (e.g. one per region) accept writes and replicate to each other. Great for multi-region writes and offline clients, but **conflicts** happen and must be resolved: last-write-wins, merge functions, CRDTs, or app-level resolution. CouchDB, multi-region setups, collaborative editors.

**Leaderless** (Dynamo-style): clients write to and read from multiple replicas directly. Cassandra, Riak, DynamoDB (internally), Voldemort.

## Quorums (try the simulator)
With N replicas, write to W and read from R:
- **R + W > N** ⇒ every read set overlaps every write set ⇒ a read sees at least one copy of the latest acknowledged write (take the highest version).
- Typical N = 3, W = 2, R = 2: tolerates one unavailable replica for both reads and writes.
- W = N makes writes fragile (any failure blocks them); R = 1, W = 1 is fast but stale.

**Caveats**: concurrent writes still need conflict resolution; **sloppy quorums** (writing to stand-in nodes during failures, with **hinted handoff** later) improve availability but break the overlap guarantee; a write that failed (fewer than W acks) may still exist on some replicas.

## Keeping replicas in sync
- **Read repair**: on read, push the newest version to stale replicas you contacted.
- **Anti-entropy**: background comparison using **Merkle trees** — hash ranges hierarchically, compare roots, descend only into mismatching branches → sync with minimal data transfer.
- **Hinted handoff**: a stand-in node stores writes for a down replica and forwards them when it returns.

## Synchronous vs asynchronous
Sync replication: no data loss on leader failure, but a slow/dead follower stalls writes. Async: fast, but recent writes are lost on failover. **Semi-sync** (wait for one follower) is the common middle ground. State your **RPO** (data loss tolerated) and **RTO** (time to recover).
`,
      keyPoints: [
        "Single-leader (simple), multi-leader (conflicts), leaderless (quorums).",
        "R + W > N ⇒ reads overlap the latest write.",
        "N=3, W=2, R=2 tolerates one failure.",
        "Read repair, anti-entropy (Merkle trees), hinted handoff keep replicas converging.",
        "Async replication can lose acknowledged writes on failover.",
      ],
      interview: [
        {
          q: "Explain quorum reads and writes.",
          a: "With N copies, a write is acknowledged after W replicas store it and a read queries R replicas and returns the newest version among them. If R + W > N, any read set and write set share at least one replica, so the read observes the latest acknowledged write. Choosing W and R trades latency and availability: e.g. N=3, W=2, R=2 (balanced), W=3, R=1 (fast reads, fragile writes), W=1, R=3 (fast writes). Concurrent writes still need versioning/conflict resolution, and sloppy quorums weaken the guarantee.",
          freq: "very-common",
        },
        {
          q: "What is split brain and how do you prevent it?",
          a: "Two nodes both believe they're the leader (e.g. after a network partition plus a failover) and accept conflicting writes. Prevent it by requiring a **majority quorum** to elect a leader (only one side of a partition can have a majority — Raft/Paxos/ZooKeeper), using **leases** with bounded clocks so an old leader stops before a new one starts, and **fencing tokens** so storage rejects writes from a deposed leader. STONITH (shoot the other node in the head) in classic HA clusters.",
          freq: "very-common",
        },
        {
          q: "How do Merkle trees help replicas sync?",
          a: "Each replica builds a hash tree over its key ranges: leaves hash small ranges of keys, parents hash their children. Two replicas compare root hashes; if equal, they're in sync. If not, they compare children and descend only into subtrees whose hashes differ, quickly isolating the few divergent ranges to transfer. Dynamo and Cassandra use this for anti-entropy repair.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "N = 5. Which (R, W) guarantees reads see the latest write?",
          options: ["R=2, W=2", "R=3, W=3", "R=1, W=3", "R=2, W=3"],
          answer: 1,
          explain: "Only 3 + 3 = 6 > 5.",
        },
        {
          q: "With N=3, W=2, R=2, how many replica failures can reads AND writes tolerate?",
          options: ["0", "1", "2", "3"],
          answer: 1,
          explain: "Two of three must respond for each operation.",
        },
        {
          q: "Hinted handoff…",
          options: ["Elects a leader", "Stores writes for a down replica on a stand-in and forwards them later", "Compresses data", "Compares Merkle trees"],
          answer: 1,
          explain: "It keeps writes available during temporary failures.",
        },
        {
          q: "Multi-leader replication's main downside is…",
          options: ["No read scaling", "Write conflicts that must be resolved", "Single point of failure", "Cannot span regions"],
          answer: 1,
          explain: "Two leaders can accept conflicting writes concurrently.",
        },
      ],
    },

    // ------------------------------------------------------------------ CONSISTENT HASHING
    {
      id: "consistent-hashing",
      title: "Consistent Hashing",
      tagline: "Partition data across a changing set of nodes with minimal reshuffling.",
      difficulty: "intermediate",
      minutes: 12,
      visualizers: ["consistenthash"],
      concept: `
## The problem with mod N
\`server = hash(key) mod N\` spreads keys evenly — until N changes. Adding one server remaps ~N/(N+1) of all keys: a full data migration (or a cold cache stampeding the database).

## The ring
Map both **servers** and **keys** onto the same hash space arranged as a circle (e.g. 0 … 2³²−1). A key belongs to the **first server clockwise** from its position.
- Add a server: it takes over only the arc between itself and its predecessor → ~1/N of keys move, all from one neighbour.
- Remove a server: its arc goes to its successor.

## Virtual nodes
With one position per server, arcs are random lengths → badly unbalanced load (try vnodes = 1 in the simulator). Give each server **many virtual nodes** (100–256) scattered around the ring:
- load evens out (law of large numbers),
- a failed server's keys spread across **all** survivors instead of dumping on one neighbour,
- heterogeneous capacity: give bigger machines more vnodes.

## Replication on the ring
Store each key on the next **N distinct physical servers** clockwise (the "preference list") — skipping vnodes of servers already chosen. That's exactly Dynamo/Cassandra's design.

## Who uses it
Dynamo, Cassandra, Riak, Memcached clients (ketama), Envoy/NGINX consistent-hash load balancing, CDNs (cache affinity), Discord's chat routing.

## Alternatives
- **Rendezvous (highest-random-weight) hashing**: for each key, pick the server with the highest hash(key, server). Same minimal-movement property, no ring, O(N) per lookup.
- **Jump consistent hash** (Google): O(log N), no memory, but servers must be numbered 0..N−1 (no arbitrary removal).
- **Fixed logical partitions** (e.g. 4,096 slots, Redis Cluster's 16,384 hash slots) mapped to nodes by a table — move whole slots when rebalancing.
`,
      keyPoints: [
        "mod N remaps almost everything when N changes.",
        "Ring: key → next server clockwise; changes move ~1/N of keys.",
        "Virtual nodes balance load and spread failure impact.",
        "Replicate to the next N distinct physical nodes.",
        "Alternatives: rendezvous hashing, jump hash, fixed hash slots.",
      ],
      code: [
        {
          title: "Consistent hash ring with virtual nodes",
          variants: [
            {
              lang: "python",
              code: `
import bisect, hashlib

def h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)

class Ring:
    def __init__(self, vnodes=100):
        self.vnodes = vnodes
        self.keys = []          # sorted vnode positions
        self.owner = {}         # position -> server

    def add(self, server):
        for i in range(self.vnodes):
            pos = h(f"{server}#{i}")
            bisect.insort(self.keys, pos)
            self.owner[pos] = server

    def remove(self, server):
        for i in range(self.vnodes):
            pos = h(f"{server}#{i}")
            self.keys.remove(pos)
            del self.owner[pos]

    def get(self, key):
        i = bisect.bisect_left(self.keys, h(key)) % len(self.keys)   # wrap around
        return self.owner[self.keys[i]]

    def preference_list(self, key, n):
        """First n DISTINCT servers clockwise — for replication."""
        out, i = [], bisect.bisect_left(self.keys, h(key))
        while len(out) < n and len(out) < len(set(self.owner.values())):
            s = self.owner[self.keys[i % len(self.keys)]]
            if s not in out:
                out.append(s)
            i += 1
        return out
`,
            },
            {
              lang: "go",
              code: `
type Ring struct {
	positions []uint32          // sorted
	owner     map[uint32]string
}

func (r *Ring) Get(key string) string {
	h := crc32.ChecksumIEEE([]byte(key))
	i := sort.Search(len(r.positions), func(i int) bool { return r.positions[i] >= h })
	if i == len(r.positions) {
		i = 0 // wrap around the ring
	}
	return r.owner[r.positions[i]]
}
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Explain consistent hashing and why it's used.",
          a: "Hash servers and keys onto a ring; each key is owned by the first server clockwise. When a server joins or leaves, only the keys in the affected arc move — about K/N keys instead of nearly all of them with `hash mod N`. Virtual nodes (many positions per server) even out the load and spread a failed node's keys across all survivors. Used for partitioning data (Dynamo, Cassandra), caches (Memcached clients) and load balancing with affinity.",
          freq: "very-common",
        },
        {
          q: "Why do we need virtual nodes?",
          a: "With a single random position per server, the arcs between servers vary wildly in length, so some servers own several times more keys than others; and when a server fails, its whole load lands on one successor. Many virtual nodes per server make each server own many small arcs: load variance shrinks, failures spread evenly, and you can weight servers by capacity by giving them more vnodes.",
          freq: "very-common",
        },
        {
          q: "How does Redis Cluster partition keys?",
          a: "It uses **16,384 fixed hash slots**: `slot = CRC16(key) mod 16384`, and each master owns a subset of slots. Resharding moves slots (with their keys) between nodes; clients get MOVED/ASK redirects and cache the slot map. Hash tags `{user42}:cart` force related keys into the same slot for multi-key operations. It's a fixed-partition scheme rather than a ring, with the same minimal-movement benefit.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Adding one server to a ring of N servers moves roughly what fraction of keys?",
          options: ["All of them", "About 1/(N+1)", "Half", "None"],
          answer: 1,
          explain: "Only the new server's arc changes ownership.",
        },
        {
          q: "Virtual nodes primarily improve…",
          options: ["Lookup speed", "Load balance and failure spreading", "Security", "Hash quality"],
          answer: 1,
          explain: "Many small arcs per server even out ownership.",
        },
        {
          q: "For replication factor 3, a key is stored on…",
          options: ["3 random servers", "The next 3 distinct physical servers clockwise", "3 vnodes of the same server", "Every server"],
          answer: 1,
          explain: "Skip vnodes belonging to servers already chosen.",
        },
        {
          q: "A key lookup on a ring with M vnode positions costs…",
          options: ["O(1)", "O(log M) with binary search", "O(M²)", "O(K)"],
          answer: 1,
          explain: "Binary search the sorted positions.",
        },
      ],
    },

    // ------------------------------------------------------------------ RAFT
    {
      id: "consensus-raft",
      title: "Consensus: Raft & Paxos",
      tagline: "How a cluster agrees on one ordered log despite crashes and partitions.",
      difficulty: "advanced",
      minutes: 22,
      visualizers: ["raft"],
      concept: `
## What consensus gives you
A group of nodes agrees on a single value — or, repeatedly, on a **replicated log** of commands — such that:
- **Safety**: all nodes that decide, decide the same thing; decisions are never undone.
- **Liveness**: the system eventually makes progress while a **majority** is up and can communicate.

Feed the same log into identical state machines and every replica ends in the same state: **state machine replication**. That's how etcd, ZooKeeper, Consul, CockroachDB, TiKV, Kafka (KRaft) and Spanner's Paxos groups stay consistent.

## Why majorities
A cluster of **2f + 1** nodes tolerates **f** failures: any two majorities overlap in at least one node, so a new leader always meets someone who saw every committed entry. 3 nodes tolerate 1 failure, 5 tolerate 2. Even sizes add cost without extra tolerance (4 nodes still tolerate only 1). And the FLP result says no deterministic algorithm can guarantee termination in a fully asynchronous network with even one crash — real protocols use timeouts for liveness while never compromising safety.

## Raft in three parts (run the simulator!)
**1. Leader election.** Every node starts as a **follower**. If it hears no heartbeat before its **randomized election timeout** (e.g. 150–300 ms), it becomes a **candidate**: increments the **term**, votes for itself, sends RequestVote. A node grants at most one vote per term, and only to candidates whose log is **at least as up to date** as its own. A majority of votes → **leader**. Randomized timeouts make split votes rare.

**2. Log replication.** Clients send commands to the leader, which appends them to its log and sends **AppendEntries** (also used as heartbeats) carrying the previous entry's index and term. Followers reject if their log doesn't match at that point; the leader backs up and retries until logs agree, then overwrites the follower's conflicting suffix. Once an entry from the current term is stored on a **majority**, it's **committed**; the leader applies it and tells followers via the commit index.

**3. Safety.** Terms act as logical clocks: any message with a higher term makes a node step down. The election restriction (vote only for up-to-date logs) guarantees a new leader contains all committed entries. A partitioned old leader can't commit anything — it can't reach a majority — and its uncommitted entries are overwritten after the partition heals.

## Paxos in one paragraph
Paxos (Lamport) has **proposers**, **acceptors** and **learners**. Phase 1 (**prepare/promise**): a proposer picks a unique, increasing proposal number n and asks a majority of acceptors to promise to ignore lower numbers; they reply with any value they already accepted. Phase 2 (**accept/accepted**): the proposer sends value v — which must be the highest-numbered previously accepted value if any — and it's chosen once a majority accepts. **Multi-Paxos** elects a stable leader to skip phase 1 for subsequent slots, which ends up looking a lot like Raft. Raft was designed explicitly to be easier to understand and implement.

## Practical notes
- Consensus is **slow-ish** (a majority round trip per commit) — use it for metadata, coordination, leader election, configuration and critical state, not bulk data (or shard data into many consensus groups, as Spanner/CockroachDB do).
- Reads: serving from the leader is only linearizable if it confirms it's still leader (read index / heartbeat round, or leader leases with bounded clock drift).
- Membership changes need care (joint consensus or one-at-a-time changes).
- Logs grow forever without **snapshots** and log compaction.
`,
      keyPoints: [
        "2f + 1 nodes tolerate f crash failures; majorities always overlap.",
        "Raft: randomized election timeouts → leader with a majority of votes.",
        "Only candidates with up-to-date logs can win.",
        "Entries commit once stored on a majority in the leader's term.",
        "A minority partition can't commit; its uncommitted entries are discarded.",
      ],
      interview: [
        {
          q: "Walk me through Raft leader election.",
          a: "All nodes start as followers with randomized election timeouts. A follower that doesn't receive a heartbeat in time becomes a candidate: increments its term, votes for itself, and sends RequestVote with its last log index and term. Each node grants one vote per term, only if the candidate's log is at least as up to date. A candidate with a majority becomes leader and immediately sends heartbeats (empty AppendEntries) to suppress new elections. If it sees a higher term it steps down. Split votes simply time out and retry with new random timeouts.",
          freq: "very-common",
        },
        {
          q: "When is a log entry committed in Raft, and why does a partitioned leader not cause inconsistency?",
          a: "An entry is committed when the leader has replicated it to a majority of servers (and it's from the leader's current term). A leader stuck in a minority partition can append entries but never gets majority acknowledgements, so it never commits them; meanwhile the majority side elects a new leader with a higher term. When the partition heals, the old leader sees the higher term, steps down, and its uncommitted entries are overwritten by the new leader's log. Clients never received success for them.",
          freq: "very-common",
        },
        {
          q: "Why do consensus clusters usually have 3 or 5 nodes?",
          a: "Tolerating f failures needs 2f + 1 nodes. 3 nodes tolerate 1 failure, 5 tolerate 2. Adding more nodes increases fault tolerance but every write must reach a majority, so latency and load grow. Even numbers don't help (4 tolerates 1, like 3, but needs 3 acks). Five is common for production coordination services so you can lose one node during maintenance and still survive another failure.",
          freq: "common",
        },
        {
          q: "Raft vs Paxos?",
          a: "Both solve consensus with majority quorums and equivalent fault tolerance. Basic Paxos agrees on a single value with prepare/accept phases; Multi-Paxos optimizes with a stable leader but leaves many practical details (log management, membership changes) unspecified, which led to many divergent implementations. Raft specifies a complete replicated-log protocol with a strong leader, terms, log matching and election restrictions — designed for understandability. In practice Multi-Paxos and Raft behave similarly.",
          freq: "common",
        },
        {
          q: "How do you make reads linearizable in a Raft cluster?",
          a: "Reading from a follower may be stale; even the leader might have been deposed without knowing. Options: (1) put reads through the log (slow); (2) **ReadIndex**: the leader records its commit index, confirms leadership with a heartbeat round to a majority, waits until applied ≥ that index, then serves; (3) **leader leases**: assume leadership for a lease period shorter than the election timeout, relying on bounded clock drift — fastest but depends on clocks.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "A 5-node Raft cluster can tolerate how many crashed nodes?",
          options: ["1", "2", "3", "4"],
          answer: 1,
          explain: "A majority of 3 must remain.",
        },
        {
          q: "Why are Raft election timeouts randomized?",
          options: ["Security", "To make simultaneous candidacies (split votes) unlikely", "To save bandwidth", "To order log entries"],
          answer: 1,
          explain: "One node usually times out first and wins.",
        },
        {
          q: "A node votes for a candidate only if…",
          options: [
            "The candidate has the lowest id",
            "It hasn't voted this term and the candidate's log is at least as up to date",
            "The candidate is closest",
            "Always",
          ],
          answer: 1,
          explain: "This election restriction preserves committed entries.",
        },
        {
          q: "A leader isolated in a minority partition receives client writes. They are…",
          options: ["Committed immediately", "Never committed; later overwritten", "Replicated to the majority via gossip", "Lost only if the leader crashes"],
          answer: 1,
          explain: "Without a majority there's no commit.",
        },
        {
          q: "AppendEntries with no entries serves as…",
          options: ["A vote request", "A heartbeat", "A snapshot", "A client ack"],
          answer: 1,
          explain: "It tells followers the leader is alive and resets their timers.",
        },
      ],
    },

    ...distributedPart2,
  ],
};
