import type { Lesson } from "../types";

export const distributedPart2: Lesson[] = [
  // ------------------------------------------------------------------ LOCKS
  {
    id: "distributed-locks",
    title: "Leader Election, Leases & Fencing",
    tagline: "Distributed locks are harder than they look — GC pauses prove it.",
    difficulty: "advanced",
    minutes: 13,
    visualizers: ["fencing"],
    concept: `
## When you need one-at-a-time
A single active scheduler, one consumer per shard, exclusive file writer, "only one job runs this migration". Two common tools: **leader election** and **distributed locks** — both usually built on a consensus service (ZooKeeper, etcd, Consul) or a strongly consistent database.

## Leases, not forever-locks
A lock held by a process that crashes would block everyone forever, so locks are **leases**: valid for a TTL and renewed by heartbeats. If the holder dies, the lease expires and someone else can acquire it.

## The pause problem (step through the visualizer)
A lease holder can be paused for longer than the TTL — GC stop-the-world, VM live migration, swapping, a SIGSTOP, a slow disk. When it resumes it *believes* it still holds the lock, but the lease expired and another client acquired it. Both now write. Checking "do I still hold the lock?" right before writing doesn't help — the pause can happen between the check and the write.

## Fencing tokens
The lock service returns a **monotonically increasing token** with every grant (ZooKeeper's zxid / znode version, etcd's revision). Clients include it with every write; the **storage rejects writes with a token lower than the highest it has seen**. Safety no longer depends on timing — the resource enforces it.

## Redlock debate
Redis's Redlock acquires locks on a majority of independent Redis nodes with TTLs. Critics (Martin Kleppmann) point out it relies on bounded clock drift and pauses and provides no fencing tokens, so it's fine for **efficiency** locks (avoid doing work twice) but unsafe for **correctness** locks. Use ZooKeeper/etcd with fencing for correctness.

## Leader election recipes
- **etcd/Consul**: campaign by creating a key with a lease; the winner is the owner of the lowest revision key; others watch the key before them.
- **ZooKeeper**: ephemeral sequential znodes; lowest sequence number is leader; each node watches its predecessor (avoids herd effect).
- **Database**: \`UPDATE leader SET owner = me, expires = now() + 10s WHERE expires < now() OR owner = me\` — works if the DB is strongly consistent, but still needs fencing downstream.
- Kubernetes uses Lease objects for controller leader election.
`,
    keyPoints: [
      "Locks must be leases (TTL + renewals) so crashes don't block forever.",
      "Process pauses can outlast a lease — the holder doesn't know.",
      "Fencing tokens: storage rejects stale tokens.",
      "Use consensus-backed services (ZooKeeper/etcd) for correctness.",
      "Redlock: OK for efficiency, risky for correctness.",
    ],
    interview: [
      {
        q: "How would you implement a distributed lock?",
        a: "Use a consensus-backed store (etcd, ZooKeeper, Consul) rather than a single Redis: acquire by creating a key tied to a **lease** (TTL), keep it alive with heartbeats, release by deleting it; waiters watch the key. Every grant returns a monotonically increasing **fencing token** (etcd revision / zxid) that the client passes to the protected resource, which rejects writes with stale tokens. Mention that if the resource can't check tokens, the lock only gives best-effort mutual exclusion.",
        freq: "very-common",
      },
      {
        q: "Why isn't a lease with a TTL enough for safety?",
        a: "Because the client can be paused (GC, VM migration, page faults) for longer than the TTL without noticing. Meanwhile the lease expires and another client acquires it. When the first client resumes, it acts as if it still holds the lock — two writers. Clock drift makes the client's sense of 'my lease is still valid' unreliable too. Only enforcing at the resource (fencing tokens, or conditional writes on a version) closes the gap.",
        freq: "common",
      },
      {
        q: "How does ZooKeeper leader election avoid the herd effect?",
        a: "Each candidate creates an **ephemeral sequential** znode under /election. The lowest sequence number is the leader. Instead of everyone watching the leader's node (which would wake all candidates when it disappears), each node watches only its **immediate predecessor**. When a node's predecessor vanishes, only that one node wakes up and checks whether it's now the lowest. Ephemeral nodes disappear when the session dies, so crashed leaders are removed automatically.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "A fencing token must be…",
        options: ["Random", "Monotonically increasing per lock grant", "A timestamp from the client", "Secret"],
        answer: 1,
        explain: "Storage compares tokens to reject stale holders.",
      },
      {
        q: "Who enforces the fencing check?",
        options: ["The client", "The lock service only", "The protected storage/resource", "The load balancer"],
        answer: 2,
        explain: "Only the resource sees both writes and can order them.",
      },
      {
        q: "Why use leases instead of indefinite locks?",
        options: ["They're faster", "So a crashed holder doesn't block everyone forever", "They need no clocks", "They prevent GC pauses"],
        answer: 1,
        explain: "The lock frees itself when renewals stop.",
      },
      {
        q: "Redlock is generally considered unsafe for…",
        options: ["Rate limiting", "Avoiding duplicate cron runs for efficiency", "Correctness-critical mutual exclusion", "Caching"],
        answer: 2,
        explain: "It depends on timing assumptions and lacks fencing tokens.",
      },
    ],
  },

  // ------------------------------------------------------------------ TRANSACTIONS
  {
    id: "distributed-transactions",
    title: "Distributed Transactions: 2PC, Sagas & Outbox",
    tagline: "Atomicity across services and databases — and its price.",
    difficulty: "advanced",
    minutes: 18,
    visualizers: ["twophase"],
    concept: `
## The goal
Update several databases or services so that either **all** changes happen or **none** do — e.g. create an order, charge the card, reserve stock.

## Two-phase commit (2PC)
A **coordinator** runs:
1. **Prepare**: ask every participant to durably prepare (write changes + a PREPARED record, hold locks) and vote YES/NO.
2. **Commit/abort**: if all voted YES, log COMMIT and tell everyone; otherwise ABORT.

**Atomic**, but:
- **Blocking**: if the coordinator dies after participants vote YES, they hold locks until it recovers (they can't decide alone). Replicating the coordinator with consensus (Spanner, CockroachDB) removes this.
- **Latency & coupling**: two round trips, forced log writes, locks held across the network; every participant must be available.
- **XA** transactions across heterogeneous systems are notoriously fragile. 2PC is common *inside* one distributed database, rare *across* microservices.

## Sagas
A sequence of **local transactions**, each committing independently, with a **compensating transaction** for each step to semantically undo it if a later step fails (refund the charge, release the stock, cancel the order).
- **Orchestration**: a central saga orchestrator (workflow engine — Temporal, AWS Step Functions) tells each service what to do next. Easier to reason about and monitor.
- **Choreography**: services react to each other's events. Loosely coupled but the flow becomes hard to follow as it grows.
- **No isolation**: other transactions can see intermediate states — use status fields (PENDING), semantic locks, or design steps so reordering is harmless. Compensations must be **idempotent** and retryable; some actions (sending an email) can't be undone, so put them last.

## The dual-write problem & transactional outbox
"Update the database **and** publish an event" can't be atomic across two systems — a crash between them leaves them inconsistent. **Outbox**: write the event to an \`outbox\` table **in the same local transaction** as the state change; a relay (poller or CDC/Debezium on the WAL) publishes it to Kafka and marks it sent. At-least-once delivery → consumers dedupe by event ID (**inbox** table / idempotency).

## Choosing
- Single database? Use its transactions.
- Sharded database with built-in distributed transactions (Spanner, CockroachDB, Vitess with care)? Use them.
- Across microservices? **Sagas + outbox + idempotent consumers**, and accept eventual consistency with explicit intermediate states.
`,
    keyPoints: [
      "2PC: prepare/vote then commit/abort — atomic but blocking and slow.",
      "Sagas: local transactions + compensations, no global locks, no isolation.",
      "Orchestration (central workflow) vs choreography (events).",
      "Outbox pattern solves 'update DB and publish event' atomically.",
      "Compensations and consumers must be idempotent.",
    ],
    interview: [
      {
        q: "Explain two-phase commit and its main drawback.",
        a: "A coordinator asks all participants to **prepare** (persist changes and a prepared record, hold locks, vote YES/NO). If all vote YES it logs COMMIT and instructs everyone to commit; otherwise abort. The main drawback is **blocking**: participants that voted YES can't unilaterally decide, so a coordinator crash leaves them holding locks until it recovers. It also adds latency (two round trips, synchronous log writes) and couples availability of all participants. Consensus-replicated coordinators mitigate blocking.",
        freq: "very-common",
      },
      {
        q: "How do you implement an order flow across Order, Payment and Inventory services?",
        a: "A **saga**, typically orchestrated: create order (PENDING) → reserve inventory → charge payment (idempotency key = order ID) → confirm order. If any step fails, run compensations in reverse (refund, release stock, cancel order). Each service commits locally and publishes events via a **transactional outbox**; consumers are idempotent. The order's status makes intermediate states explicit to users. A workflow engine (Temporal) handles retries, timeouts and persistence of the saga state.",
        freq: "very-common",
      },
      {
        q: "What's the dual-write problem?",
        a: "Writing to two systems (e.g. a database and Kafka, or a DB and a cache/search index) without a shared transaction: if the process crashes or the second write fails after the first succeeds, they diverge permanently. Solutions: transactional outbox, change data capture from the DB log (the DB becomes the single source of truth and everything else is derived), or idempotent retries with reconciliation.",
        freq: "common",
      },
      {
        q: "Orchestration vs choreography for sagas?",
        a: "**Orchestration**: a central coordinator issues commands and tracks state — clear flow, easy monitoring and error handling, but the orchestrator is a central component that knows about every service. **Choreography**: each service listens for events and emits its own — decoupled and simple for short flows, but the overall process is implicit, harder to change and debug, and cyclic dependencies creep in. Most teams prefer orchestration for business-critical multi-step flows.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In 2PC, a participant that voted YES and lost contact with the coordinator…",
        options: ["Commits", "Aborts", "Must wait (blocked) for the decision", "Asks the client"],
        answer: 2,
        explain: "Others may have committed or aborted; it can't decide alone.",
      },
      {
        q: "A saga undoes a completed step by…",
        options: ["Rolling back the database", "Running a compensating transaction", "Waiting for a timeout", "Two-phase commit"],
        answer: 1,
        explain: "Each step already committed locally.",
      },
      {
        q: "Sagas do NOT provide…",
        options: ["Atomicity of outcome (eventually)", "Isolation between concurrent sagas", "Local ACID per step", "Compensation"],
        answer: 1,
        explain: "Intermediate states are visible to others.",
      },
      {
        q: "The transactional outbox guarantees that…",
        options: ["Events are delivered exactly once", "An event is published if and only if the state change committed (eventually)", "No consumer sees duplicates", "Kafka is never needed"],
        answer: 1,
        explain: "Same-transaction write + relay; delivery is still at-least-once.",
      },
    ],
  },

  // ------------------------------------------------------------------ GOSSIP
  {
    id: "gossip-membership",
    title: "Gossip, Membership & Failure Detection",
    tagline: "Spread information like a rumour and notice dead nodes without a coordinator.",
    difficulty: "intermediate",
    minutes: 11,
    visualizers: ["gossip"],
    concept: `
## Gossip (epidemic) protocols
Each node periodically picks a few random peers and exchanges state (membership lists, versions, metadata). Information spreads like an epidemic:
- reaches all N nodes in **O(log N) rounds**,
- each node does constant work per round,
- **no central coordinator**, robust to node and message loss.

Variants: **push** (send what you know), **pull** (ask what they know), **push-pull** (both — fastest convergence). Anti-entropy gossip compares digests (version vectors or Merkle trees) and transfers only differences.

## Where it's used
Cassandra and ScyllaDB (cluster membership, schema versions, token ownership), Consul/Serf (SWIM-based membership), Redis Cluster (cluster bus), DynamoDB's internal membership, Bitcoin transaction propagation, CRDT-based databases syncing state.

## Failure detection
**Heartbeats** with timeouts are the simplest detector, but all-to-all heartbeats cost O(N²) messages, and a fixed timeout is either trigger-happy or slow.
- **SWIM**: each round, ping one random member; if no ack, ask k other members to ping it indirectly (rules out a bad link between just two nodes); if still nothing, mark it **suspect**, gossip the suspicion, and declare it dead only after a suspicion timeout. Membership updates piggyback on pings. O(N) total messages per round.
- **Phi accrual detector** (Cassandra, Akka): instead of a yes/no timeout, compute a suspicion level φ from the distribution of recent heartbeat inter-arrival times; the application picks a threshold. Adapts to network jitter.

## Fundamental limit
In an asynchronous network a perfect failure detector is impossible — you can't distinguish slow from dead. Detectors are tuned for **completeness** (dead nodes eventually suspected) vs **accuracy** (live nodes rarely suspected). Pair them with safe protocols (consensus, fencing) so a false suspicion doesn't corrupt data.
`,
    keyPoints: [
      "Gossip spreads state to N nodes in O(log N) rounds, no coordinator.",
      "Push-pull converges fastest; digests minimize transfer.",
      "SWIM: random pings + indirect pings + suspicion before declaring death.",
      "Phi accrual: adaptive suspicion level instead of a fixed timeout.",
      "Perfect failure detection is impossible — design for false suspicions.",
    ],
    interview: [
      {
        q: "How does a gossip protocol work and why is it scalable?",
        a: "Every node periodically (e.g. every second) selects a small random set of peers and exchanges state, merging by version. Because each informed node infects others, the number of informed nodes grows exponentially and the whole cluster learns an update in O(log N) rounds. Per-node load is constant regardless of cluster size, there's no single point of failure, and random peer selection routes around failures automatically.",
        freq: "common",
      },
      {
        q: "How would you detect failed nodes in a 1,000-node cluster?",
        a: "Avoid all-to-all heartbeats (≈ 10⁶ messages per interval). Use **SWIM**-style probing: each node pings one random member per period; on timeout it asks a few other nodes to ping indirectly; persistent failure marks it **suspect**, which is gossiped and confirmed dead after a timeout (refutable by the node itself with a higher incarnation number). Use adaptive/phi-accrual thresholds to reduce false positives, and make sure downstream actions (failover) are safe even if a suspicion is wrong.",
        freq: "common",
      },
      {
        q: "Why use indirect pings in SWIM?",
        a: "A missing ack might mean the target is dead — or just that the link between the prober and target is congested. Asking k other members to ping the target on your behalf checks other network paths; if any of them gets an ack, the node is alive. This sharply reduces false positives without increasing per-node load much.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Gossip disseminates an update to N nodes in roughly…",
        options: ["O(1) rounds", "O(log N) rounds", "O(N) rounds", "O(N²) rounds"],
        answer: 1,
        explain: "Exponential spread, like an epidemic.",
      },
      {
        q: "SWIM marks an unresponsive node as…",
        options: ["Dead immediately", "Suspect first, dead after a timeout", "Leader", "Healthy"],
        answer: 1,
        explain: "Suspicion gives a slow node time to refute.",
      },
      {
        q: "The phi accrual detector outputs…",
        options: ["A boolean", "A continuous suspicion level based on heartbeat history", "A vector clock", "A Merkle root"],
        answer: 1,
        explain: "The application picks the threshold for 'dead'.",
      },
      {
        q: "Which database uses gossip for cluster membership?",
        options: ["PostgreSQL", "Cassandra", "SQLite", "MySQL"],
        answer: 1,
        explain: "Cassandra nodes gossip state every second.",
      },
    ],
  },

  // ------------------------------------------------------------------ STORAGE ENGINES
  {
    id: "storage-engines",
    title: "Storage Engines: LSM-Trees, B-Trees & Bloom Filters",
    tagline: "How databases actually lay bytes on disk — and why it matters for writes.",
    difficulty: "advanced",
    minutes: 16,
    visualizers: ["lsm", "bloom"],
    concept: `
## Two families
**B-trees** (Postgres, MySQL/InnoDB, most relational DBs): pages of sorted keys in a balanced tree; updates modify pages **in place** (with a write-ahead log for crash safety). Reads are fast and predictable (O(log n) page reads); random writes cause random I/O and page splits.

**LSM-trees** (Log-Structured Merge: Cassandra, RocksDB, LevelDB, ScyllaDB, HBase, InfluxDB): turn all writes into **sequential** I/O.
1. Append to a **write-ahead log** (durability).
2. Insert into an in-memory sorted **memtable**.
3. When full, flush it as an immutable sorted file: an **SSTable**.
4. Background **compaction** merges SSTables, keeping the newest version of each key and dropping deleted ones (**tombstones**).

Reads check the memtable, then SSTables from newest to oldest. To avoid touching every file, each SSTable has a **Bloom filter** (skip files that definitely don't contain the key) and a sparse index.

## Amplification trade-offs
| | B-tree | LSM-tree |
|---|---|---|
| Write amplification | moderate (page rewrites) | from compaction, but sequential |
| Read amplification | low | higher (several levels) |
| Space amplification | page fragmentation | stale versions until compaction |
| Best for | read-heavy, transactional | write-heavy, time series, logs |

**Compaction strategies**: size-tiered (merge similar-sized tables — write-friendly, more space) vs leveled (non-overlapping levels, ~10× growth per level — read/space-friendly, more write amplification).

## Bloom filters (try it)
A bit array of m bits and k hash functions. Insert: set the k bits. Query: if any bit is 0 → **definitely absent**; if all 1 → **maybe present**. No false negatives; false-positive rate ≈ (1 − e^(−kn/m))^k — about 1% with ~10 bits per element and k = 7. Can't delete (use counting Bloom filters or cuckoo filters).

Uses beyond LSM: avoid cache penetration (check a Bloom filter before the DB), "have I seen this URL?" in crawlers, Chrome's old malicious-URL check, join optimization in distributed queries.

## Other pieces worth knowing
- **WAL + checkpoints**: crash recovery in both families.
- **Column stores** (Parquet, ClickHouse, BigQuery): store each column contiguously, compress heavily, read only needed columns — analytics (OLAP) vs row stores for transactions (OLTP).
- **Inverted indexes** (Lucene/Elasticsearch): term → posting list of documents; built with LSM-like segment merging.
`,
    keyPoints: [
      "B-trees update in place: fast reads, random writes.",
      "LSM: WAL + memtable → SSTables → compaction: sequential writes.",
      "LSM reads check memtable then SSTables newest → oldest.",
      "Bloom filters: 'definitely not' or 'maybe', no false negatives.",
      "Deletes in LSM are tombstones purged during compaction.",
    ],
    interview: [
      {
        q: "LSM-tree vs B-tree — when would you choose each?",
        a: "**LSM** for write-heavy workloads (event logs, time series, messaging, metrics): writes are buffered in memory and flushed sequentially, giving very high ingest; the cost is read amplification (check multiple SSTables, mitigated by Bloom filters and compaction), background compaction I/O and space amplification. **B-trees** for read-heavy/transactional workloads needing predictable low-latency reads and range scans with in-place updates. Many systems expose both (MySQL InnoDB vs MyRocks).",
        freq: "very-common",
      },
      {
        q: "How does a Bloom filter work and what's its error mode?",
        a: "A bit array plus k hash functions. Adding an element sets k bits; checking tests the same k bits. If any is 0 the element is definitely absent; if all are 1 it's *probably* present — other elements may have set those bits (false positive). There are **no false negatives**. With m bits, n elements and optimal k ≈ (m/n) ln 2, the false positive rate ≈ (1 − e^(−kn/m))^k: ~10 bits per element gives ~1%. Standard Bloom filters don't support deletion.",
        freq: "very-common",
      },
      {
        q: "How are deletes handled in an LSM-tree?",
        a: "You can't modify immutable SSTables, so a delete writes a **tombstone** marker for the key. Reads that encounter the tombstone (newest-first) treat the key as deleted. Compaction eventually drops both the tombstone and older values — but only once it's merging into the oldest level containing that key (otherwise an older value could resurrect). Cassandra keeps tombstones for gc_grace_seconds so repairs can propagate deletes to all replicas.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In an LSM-tree, where does a new write go first (after the WAL)?",
        options: ["Directly into SSTables", "The in-memory memtable", "The Bloom filter only", "Level 1"],
        answer: 1,
        explain: "SSTables are immutable; writes are buffered in memory.",
      },
      {
        q: "A Bloom filter can produce…",
        options: ["False negatives only", "False positives only", "Both", "Neither"],
        answer: 1,
        explain: "'Maybe present' can be wrong; 'absent' never is.",
      },
      {
        q: "Compaction in an LSM-tree…",
        options: ["Compresses the WAL", "Merges SSTables, keeping newest versions and dropping tombstoned data", "Builds B-tree pages", "Replicates data"],
        answer: 1,
        explain: "It bounds read amplification and reclaims space.",
      },
      {
        q: "Which workload favours LSM-trees?",
        options: ["Read-mostly OLTP with small random reads", "High-volume writes like metrics and logs", "Tiny datasets", "Strictly in-memory caches"],
        answer: 1,
        explain: "Sequential flushes absorb huge write rates.",
      },
    ],
  },

  // ------------------------------------------------------------------ CRDTs
  {
    id: "crdts",
    title: "CRDTs & Conflict Resolution",
    tagline: "Data types that merge themselves — no coordination, guaranteed convergence.",
    difficulty: "advanced",
    minutes: 12,
    visualizers: ["crdt"],
    concept: `
## The conflict problem
Multi-leader and leaderless systems (and offline-first apps) accept concurrent writes on different replicas. When they sync, what's the result?
- **Last-write-wins (LWW)**: keep the write with the highest timestamp. Simple, but silently **discards** concurrent writes (the simulator's naive counter loses likes) and depends on clocks.
- **Application merge**: keep siblings (Riak, CouchDB) and let the app resolve — flexible but pushes complexity to every developer.
- **CRDTs**: data types whose merge is mathematically guaranteed to converge.

## CRDT = Conflict-free Replicated Data Type
State-based CRDTs define a **merge** that is **commutative, associative and idempotent** (a semilattice "join"). Replicas can exchange state in any order, any number of times, and all converge to the same value — **strong eventual consistency** without coordination.

Classics:
- **G-Counter** (grow-only): a vector with one slot per replica; increment your own slot; merge = element-wise max; value = sum.
- **PN-Counter**: two G-Counters (increments and decrements); value = P − N.
- **LWW-Register**: a value + timestamp; merge keeps the higher timestamp (still LWW, but explicit).
- **MV-Register**: keeps all concurrent values (like Dynamo's siblings).
- **G-Set / 2P-Set**: add-only set; two-phase set where removed elements can't be re-added.
- **OR-Set** (observed-remove): each add gets a unique tag; a remove deletes only the tags it has observed → a concurrent add survives (**add-wins**).
- **Sequence CRDTs** (RGA, Logoot, Yjs, Automerge) for collaborative text editing.

## Operation-based vs state-based
State-based (CvRDT) ship whole states (or deltas) — tolerant of duplicates and reordering. Operation-based (CmRDT) ship operations — smaller messages but need exactly-once, causal delivery.

## Where they're used
Riak data types, Redis Enterprise active-active (CRDB), Azure Cosmos DB multi-master, Figma/Linear-style multiplayer apps, Apple Notes, collaborative editors (Yjs, Automerge), shopping carts, distributed counters (likes, views).

## OT vs CRDT for collaborative editing
Operational Transformation (Google Docs) transforms concurrent operations against each other via a central server. CRDTs embed enough metadata (unique position IDs) to merge without a central transformer — better for peer-to-peer and offline.
`,
    keyPoints: [
      "LWW silently discards concurrent writes.",
      "CRDT merges are commutative, associative, idempotent → convergence.",
      "G-Counter: per-replica slots, merge by max, sum for value.",
      "OR-Set: unique tags per add; removes only observed tags (add-wins).",
      "Used in active-active databases and collaborative apps.",
    ],
    interview: [
      {
        q: "How would you implement a 'likes' counter replicated across regions with no coordination?",
        a: "A **PN-Counter** CRDT (or G-Counter if only increments): each region keeps a vector of per-region counts and only increments its own slot; replication merges by taking the element-wise max; the total is the sum. Merges are commutative, associative and idempotent, so regions can sync asynchronously in any order and always converge, with no lost increments — unlike last-write-wins on a single integer.",
        freq: "common",
      },
      {
        q: "What properties must a CRDT merge function have, and why?",
        a: "**Commutative** (merge(a,b) = merge(b,a)) so order of sync doesn't matter; **associative** (grouping doesn't matter) so replicas can merge via intermediaries; **idempotent** (merge(a,a) = a) so duplicated messages are harmless. Together they form a join semilattice, guaranteeing that all replicas that have received the same set of updates reach the same state — strong eventual consistency.",
        freq: "common",
      },
      {
        q: "How do collaborative editors like Google Docs or Figma handle concurrent edits?",
        a: "Google Docs uses **Operational Transformation**: edits are operations sent through a central server that transforms concurrent operations so they apply consistently (e.g. adjusting indices). Newer tools use **CRDTs** (Yjs, Automerge; Figma uses CRDT-inspired properties per object) where each character/object has a unique ID and merges are deterministic without a central transformer — enabling offline editing and peer-to-peer sync. Both also need presence, undo semantics and conflict UX.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "A G-Counter merges two replicas' vectors by…",
        options: ["Adding them", "Taking the element-wise maximum", "Keeping the newer one", "Averaging"],
        answer: 1,
        explain: "Max is idempotent; adding would double-count on repeated syncs.",
      },
      {
        q: "Last-write-wins on concurrent increments…",
        options: ["Keeps all increments", "Loses some increments", "Throws an error", "Requires consensus"],
        answer: 1,
        explain: "Only one replica's value survives.",
      },
      {
        q: "In an OR-Set, a remove concurrent with an add of the same element results in…",
        options: ["Element removed", "Element present (add wins)", "Undefined", "Both replicas diverge forever"],
        answer: 1,
        explain: "The remove only deletes tags it observed; the new add's tag survives.",
      },
      {
        q: "Strong eventual consistency means…",
        options: [
          "Linearizable reads",
          "Replicas that received the same updates are in the same state",
          "Writes are synchronous",
          "Only one replica accepts writes",
        ],
        answer: 1,
        explain: "Convergence without coordination.",
      },
    ],
  },

  // ------------------------------------------------------------------ BATCH & STREAM
  {
    id: "batch-stream",
    title: "Batch & Stream Processing",
    tagline: "MapReduce, Spark and Flink: computing over data that doesn't fit on one machine.",
    difficulty: "intermediate",
    minutes: 14,
    visualizers: ["mapreduce"],
    concept: `
## Batch processing
Process a large, bounded dataset and produce derived output (indexes, reports, ML features).

**MapReduce** (Google, Hadoop): **map** each input record to key–value pairs → **shuffle** (partition by key, sort, send over the network) → **reduce** all values for a key. Moves computation to the data, tolerates failures by re-running deterministic tasks, scales linearly. Drawbacks: every stage writes to disk; multi-step jobs chain many MapReduce rounds.

**Spark** keeps intermediate data in memory as **RDDs/DataFrames** with lineage for recovery, builds a DAG of stages, and optimizes queries (Catalyst) — typically 10–100× faster for iterative work. Data warehouses (BigQuery, Snowflake, Redshift) and lakehouses (Delta, Iceberg) run SQL over columnar files at massive scale.

**Key techniques**: partitioning by key, **combiners** (local pre-aggregation), broadcast joins (ship a small table to every worker) vs shuffle (sort-merge) joins, handling **skew** (salting hot keys).

## Stream processing
Process unbounded data continuously with low latency: fraud detection, real-time metrics, alerting, feature computation, CDC pipelines.
- Sources: Kafka/Kinesis logs. Engines: **Flink**, Kafka Streams, Spark Structured Streaming, Beam/Dataflow.
- **Event time vs processing time**: events arrive late and out of order (mobile clients offline). Use event-time **windows** (tumbling, sliding, session) and **watermarks** (an estimate that no events older than T are still coming) to decide when a window is complete; handle late data with allowed lateness or side outputs.
- **State**: aggregations and joins keep state; Flink checkpoints state snapshots (Chandy–Lamport-style barriers) for **exactly-once** state semantics, combined with transactional/idempotent sinks for end-to-end exactly-once.

## Architectures
- **Lambda**: a batch layer (accurate, slow) plus a speed layer (approximate, fast), merged at query time — duplicate logic is the main pain.
- **Kappa**: everything is a stream; reprocess history by replaying the log through a new version of the job.
- **CDC + streams**: the database's change log becomes the event stream that keeps caches, search indexes and analytics in sync — "turning the database inside out".
`,
    keyPoints: [
      "MapReduce: map → shuffle (by key) → reduce; re-run tasks on failure.",
      "Spark keeps intermediate data in memory with lineage.",
      "Streams: event-time windows + watermarks handle late data.",
      "Exactly-once in Flink = checkpointed state + transactional sinks.",
      "Lambda vs Kappa; CDC turns DB changes into streams.",
    ],
    interview: [
      {
        q: "Explain the MapReduce word count and what the shuffle does.",
        a: "Map: each mapper reads a chunk of text and emits (word, 1) for every word (optionally a combiner pre-sums per mapper). Shuffle: the framework partitions pairs by hash(word) mod R, sends each partition to its reducer over the network, and sorts/groups by key so each reducer receives (word, [1, 1, …]) for all occurrences of its words. Reduce: sum the list and output (word, count). The shuffle is usually the most expensive phase — network and disk heavy — which is why combiners and good partitioning matter.",
        freq: "common",
      },
      {
        q: "What are watermarks in stream processing?",
        a: "A watermark is a timestamp flowing with the stream asserting \"no more events with event time ≤ T are expected\". When the watermark passes a window's end, the engine can emit that window's result. Watermarks trade completeness for latency: aggressive ones emit early but drop/handle late events; conservative ones wait longer. Late events beyond the allowed lateness go to side outputs or trigger updated results.",
        freq: "common",
      },
      {
        q: "How would you compute 'top 10 trending hashtags in the last 5 minutes' in real time?",
        a: "Ingest tweets into Kafka partitioned by hashtag; a Flink job extracts hashtags and keeps counts in **sliding event-time windows** (5 min, sliding every 10 s) with watermarks for lateness; per-partition top-k with a heap, then a global top-k merge (a second stage with parallelism 1 or a two-level aggregation). For huge cardinality use Count-Min Sketch + heavy hitters. Results go to a cache/Redis sorted set served by an API.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In MapReduce, which phase moves data across the network grouped by key?",
        options: ["Map", "Shuffle", "Reduce", "Split"],
        answer: 1,
        explain: "Partition, transfer and sort by key.",
      },
      {
        q: "A combiner…",
        options: ["Joins two datasets", "Pre-aggregates map output locally to reduce shuffle size", "Replaces reducers", "Splits input files"],
        answer: 1,
        explain: "Send ('the', 2) instead of two ('the', 1).",
      },
      {
        q: "Event time is…",
        options: ["When the engine processed the event", "When the event actually happened at the source", "The Kafka offset", "The window size"],
        answer: 1,
        explain: "Correct analytics bucket by event time.",
      },
      {
        q: "Kappa architecture reprocesses history by…",
        options: ["Running a separate batch layer", "Replaying the log through a new stream job", "Querying the warehouse", "Using MapReduce"],
        answer: 1,
        explain: "One codebase: everything is a stream.",
      },
    ],
  },

  // ------------------------------------------------------------------ CASE: KV STORE
  {
    id: "case-kv-store",
    title: "Case Study: Distributed Key-Value Store",
    tagline: "Design Dynamo: partitioning, replication, quorums and repair in one system.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Dynamo-style key-value store",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 90, y: 280 },
        { id: "coord", label: "Coordinator", sub: "any node", kind: "service", x: 330, y: 280 },
        { id: "a", label: "Node A", sub: "replica 1", kind: "db", x: 620, y: 80 },
        { id: "b", label: "Node B", sub: "replica 2", kind: "db", x: 860, y: 200 },
        { id: "c", label: "Node C", sub: "replica 3 (down)", kind: "db", x: 860, y: 380 },
        { id: "d", label: "Node D", sub: "stand-in", kind: "db", x: 620, y: 490 },
      ],
      edges: [
        { from: "client", to: "coord" },
        { from: "coord", to: "a" },
        { from: "coord", to: "b" },
        { from: "coord", to: "c", dashed: true },
        { from: "coord", to: "d", label: "hinted" },
        { from: "a", to: "b", label: "gossip / Merkle", dashed: true },
        { from: "d", to: "c", label: "handoff", dashed: true },
      ],
      flows: [
        {
          name: "put(k, v) with W=2",
          path: ["client", "coord", "a", "coord", "b", "coord", "client"],
          steps: [
            "put('cart:42', v) reaches any node, which acts as coordinator (or a partition-aware client picks the right one).",
            "hash('cart:42') on the ring → preference list [A, B, C]. Send the write with a version (vector clock) to all three.",
            "A acks.",
            "B acks.",
            "Two acks = W reached.",
            "Success returned after W=2 of N=3 — C's ack isn't needed for latency.",
          ],
        },
        {
          name: "Write while C is down",
          path: ["client", "coord", "d", "c"],
          steps: [
            "Same write, but replica C is unreachable.",
            "Sloppy quorum: the next healthy node on the ring, D, accepts it with a hint 'this belongs to C'.",
            "When C recovers, D hands the write off (hinted handoff) and deletes its copy.",
          ],
        },
        {
          name: "get(k) with R=2",
          path: ["client", "coord", "a", "coord", "b", "coord", "client"],
          steps: [
            "get('cart:42').",
            "Read from replicas in the preference list.",
            "A returns version [A:2].",
            "B returns version [A:1] — older.",
            "Pick the newest by vector clock; if versions are concurrent, return both siblings for the client to merge. Read-repair B in the background.",
            "Return the value (and its context/version for the next write).",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
\`put(key, value)\`, \`get(key)\`; values up to ~1 MB; **always writable** (Amazon's shopping cart must accept writes even during failures); low latency at p99.9; horizontal scale to thousands of nodes; tunable consistency.

## 2. Partitioning
**Consistent hashing** with virtual nodes (previous lesson). Each key's **preference list** = the next N distinct physical nodes clockwise.

## 3. Replication & quorums
N = 3 replicas, configurable **W** and **R** (R + W > N for read-your-writes in the absence of sloppiness). Any node can coordinate a request. Latency is set by the W-th / R-th fastest replica, not the slowest.

## 4. Versioning & conflicts
Concurrent writes on different replicas create divergent versions. Dynamo attaches **vector clocks** (version vectors) to values; on read, if one version descends from another, keep the newer; if they're **concurrent**, return all **siblings** and let the application merge (the cart unions items). Cassandra instead uses per-cell **last-write-wins** timestamps (simpler, lossy under concurrency) or CRDT-like types.

## 5. Handling failures
- **Temporary**: **sloppy quorum** + **hinted handoff** keep writes available.
- **Permanent / drift**: **anti-entropy** with **Merkle trees** per key range to find and repair differences cheaply; **read repair** on reads.
- **Membership & failure detection**: **gossip**; nodes learn the ring and each other's health without a master.

## 6. Storage engine
Per node, an **LSM-tree** (memtable → SSTables → compaction) with Bloom filters — write-optimized, matching the workload. Commit log for durability.

## 7. Trade-offs to state out loud
- AP-leaning (PA/EL): stays available and fast, accepts temporary inconsistency.
- Sloppy quorums mean R + W > N doesn't strictly guarantee freshness.
- Siblings push conflict resolution to clients unless you use CRDTs.
- For strong consistency per key, add a consensus layer (e.g. Raft per partition, as in TiKV/CockroachDB) at higher latency.

This one design exercises almost every concept in this world — a favourite staff-level interview question.
`,
    keyPoints: [
      "Consistent hashing + vnodes → preference list of N nodes.",
      "Tunable N/R/W quorums; coordinator can be any node.",
      "Vector clocks detect concurrent versions; siblings or CRDT merges.",
      "Sloppy quorums + hinted handoff for availability; Merkle-tree anti-entropy for repair.",
      "Gossip for membership; LSM-tree per node.",
    ],
    interview: [
      {
        q: "Design a distributed key-value store like DynamoDB/Cassandra.",
        a: "Clarify API (get/put/delete), value size, consistency needs (tunable), scale and latency. Partition with **consistent hashing + virtual nodes**; replicate each key to N=3 nodes from its preference list. Writes/reads go through a coordinator that waits for **W/R** acks (e.g. 2/2). Version values with **vector clocks** (or LWW timestamps) to detect conflicts; resolve via siblings/CRDTs. Handle failures with **sloppy quorum + hinted handoff**, **read repair** and **Merkle-tree anti-entropy**; detect failures and spread membership with **gossip**. Each node uses an **LSM** engine with a commit log. Discuss trade-offs: AP behaviour, stale reads under sloppy quorums, hot keys, rebalancing, multi-DC replication (per-DC quorums like LOCAL_QUORUM).",
        freq: "very-common",
      },
      {
        q: "How does the store remain writable when replicas are down?",
        a: "**Sloppy quorums**: if a node in the key's preference list is unreachable, the coordinator writes to the next healthy node on the ring, tagging the write with a hint naming the intended owner. Once the owner is back, the stand-in forwards the data (**hinted handoff**). Writes succeed as long as any W nodes are reachable, at the cost of temporarily weaker read guarantees.",
        freq: "common",
      },
      {
        q: "Vector clocks vs last-write-wins for conflict handling?",
        a: "LWW keeps the value with the highest timestamp: simple and storage-light but silently drops concurrent writes and depends on clock sync. Vector clocks track causality per replica so the system can tell 'newer' from 'concurrent'; concurrent versions are kept as siblings for the application (or a CRDT) to merge — no lost updates but more complexity and metadata. Choose LWW for idempotent overwrites (sensor data, caches), vector clocks/CRDTs for user data like carts.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which component decides which nodes store a key?",
        options: ["A central master", "Consistent hashing over the ring (preference list)", "Random choice", "The client's IP"],
        answer: 1,
        explain: "The next N distinct nodes clockwise from the key's hash.",
      },
      {
        q: "Merkle trees are used for…",
        options: ["Leader election", "Efficiently finding divergent key ranges between replicas", "Encrypting values", "Load balancing"],
        answer: 1,
        explain: "Compare hashes top-down and sync only mismatched ranges.",
      },
      {
        q: "Hinted handoff improves…",
        options: ["Consistency", "Write availability during temporary failures", "Read latency", "Disk usage"],
        answer: 1,
        explain: "A stand-in node accepts writes on behalf of a down replica.",
      },
      {
        q: "Two concurrent versions of a key with vector clocks [A:2,B:1] and [A:1,B:2] should be…",
        options: ["Resolved by keeping the first", "Returned as siblings / merged", "Deleted", "Ordered by node name"],
        answer: 1,
        explain: "Neither descends from the other.",
      },
    ],
  },
];
