import type { World } from "../types";
import { kafkaPart2 } from "./kafka-2";

export const kafka: World = {
  id: "kafka",
  order: 11,
  title: "The Kafka Delta",
  subtitle: "Kafka engineering end to end: the log, producers, replication, consumer groups, exactly-once, storage, streams, Connect & CDC, operations and event-driven design",
  description:
    "Everything a Kafka or streaming-platform engineer gets asked. Start with the partitioned log, then tune producers, break replication on purpose, rebalance consumer groups, crash pipelines under each delivery guarantee, compact logs, window late events, wire up CDC with Debezium, size a cluster, and design event-driven systems that survive production.",
  emoji: "🌊",
  color: "#0f766e",
  boss: {
    name: "The Lag Leviathan",
    title: "Devourer of Offsets",
    emoji: "🦑",
    taunt: "Your ISR is shrinking, your consumers are rebalancing, and your lag is ten million deep. Every duplicate is mine!",
    defeat: "acks=all… idempotent… read_committed… lag zero. The delta flows clear. You are a true Kafka engineer.",
  },
  lessons: [
    // ------------------------------------------------------------------ FUNDAMENTALS
    {
      id: "kafka-fundamentals",
      title: "Kafka Fundamentals: The Distributed Log",
      tagline: "Topics, partitions, offsets, brokers and why an append-only log is so fast.",
      difficulty: "beginner",
      minutes: 14,
      visualizers: ["queue"],
      concept: `
## What Kafka is
Kafka is a **distributed, replicated, append-only commit log**. Producers append records; consumers read them **by position**, at their own pace, and the records stay for the retention period whether or not anyone has read them. That one design choice is what separates it from a traditional message queue:
| | Message queue (RabbitMQ, SQS) | Kafka |
|---|---|---|
| After consumption | Message is deleted (acked) | Record stays until retention |
| Multiple readers | Each message to one consumer (or copied per queue) | Any number of consumer groups, each with its own position |
| Replay | Not possible | Rewind offsets and reprocess |
| Ordering | Per queue, weakened by redelivery | Strict **per partition** |
| Sweet spot | Task distribution, per-message routing and acks | High-throughput event streams, fan-out, replay, stream processing |

## The data model
- A **topic** is a named stream (\`orders\`, \`page-views\`). It is split into **partitions**, the unit of parallelism, ordering and replication.
- Each partition is an ordered log. Every record gets a monotonically increasing **offset**.
- A **record** = key + value + headers + timestamp. The **key** decides the partition: same key → same partition → ordered relative to each other.
- **Brokers** are the servers. Each partition has one **leader** broker (which serves reads and writes) and follower replicas on other brokers.
- **Consumer groups** split partitions among their members. Each group tracks its own committed offsets in the internal \`__consumer_offsets\` topic.
- The cluster's metadata (topics, partitions, leaders, configs) is managed by a **KRaft** controller quorum. ZooKeeper was removed entirely in Kafka 4.0.

## Why it's fast
- **Sequential I/O**: appends to the end of segment files, and reads are mostly sequential too. Disks (even spinning ones) are fast at that.
- **The OS page cache** does the caching. Recent data is read from memory without Kafka managing a heap cache.
- **Zero-copy**: \`sendfile()\` moves bytes from page cache to the socket without copying them through user space (when TLS isn't in the way).
- **Batching and compression** end to end: producers send batches, brokers store them as-is, consumers fetch them in bulk.
- **Dumb broker, smart client**: brokers don't track per-message acknowledgements; consumers just remember an offset.

## Ordering and parallelism
Ordering is guaranteed **only within a partition**. A group can have at most one consumer per partition, so the **partition count caps consumer parallelism**. Choose keys so related events (all events for one order or one account) share a partition, and so load spreads evenly: a hot key creates a hot partition that no amount of consumers can fix.

Use the partitioned log visualizer to see keys hash to partitions and consumer groups track offsets and lag.
`,
      keyPoints: [
        "Kafka is a replicated append-only log: records stay for the retention period, and consumers track positions (offsets).",
        "Topic → partitions → ordered records with offsets. The key picks the partition.",
        "Ordering is per partition only; partition count caps a consumer group's parallelism.",
        "Speed comes from sequential I/O, the page cache, zero-copy, and batching end to end.",
        "Many consumer groups read the same data independently, and can rewind to replay it.",
      ],
      code: [
        {
          title: "First steps with the CLI",
          variants: [
            {
              lang: "bash",
              code: `
# Create a topic: 12 partitions, 3 replicas, writes need 2 in-sync copies
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders \\
  --partitions 12 --replication-factor 3 --config min.insync.replicas=2

kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
# Topic: orders Partition: 0 Leader: 2 Replicas: 2,3,1 Isr: 2,3,1 ...

# Produce keyed records (key:value)
kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders \\
  --property parse.key=true --property key.separator=:
> order-42:{"status":"created"}

# Consume from the beginning as part of a group, printing partition and offset
kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group audit \\
  --from-beginning --property print.key=true --property print.partition=true --property print.offset=true

# Where is each group, and how far behind?
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group audit
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Kafka vs RabbitMQ (or SQS): when would you choose each?",
          a: "**Kafka** is a durable, replayable **log**: high throughput (millions of events/s), many independent consumer groups reading the same stream, strict per-partition ordering, retention and **replay**, and a stream-processing ecosystem (Streams, Flink, Connect). Choose it for event streaming, CDC, analytics pipelines and event-driven microservices where several systems consume the same facts. **RabbitMQ/SQS** are **queues**: per-message acknowledgement, routing (exchanges, topics), delayed and priority messages, dead-letter handling built in, and messages vanish once processed. Choose them for task/work queues, RPC-style jobs and complex routing at moderate scale. Kafka 4.x adds share groups (queue-like consumption), which narrows the gap.",
          freq: "very-common",
        },
        {
          q: "How does Kafka guarantee ordering, and what breaks it?",
          a: "Order is guaranteed **within a partition**: records are appended and read in offset order. So put events that must stay ordered under the **same key**. Things that break it: using no key (records spread across partitions), **changing the partition count** (the key→partition mapping changes for new records), a producer with retries but **without idempotence** and more than one in-flight request (a retried batch can land after a later one; idempotence fixes this), and consumers that process records from one partition **concurrently** (e.g. a thread pool) without per-key ordering.",
          freq: "very-common",
        },
        {
          q: "Why is Kafka so fast even though it writes everything to disk?",
          a: "It's designed around how disks and operating systems work best: **append-only sequential writes** (no random seeks), reads served from the **OS page cache** for recent data, **zero-copy** transfer (`sendfile`) from page cache to network socket, and **batching + compression** from producer through broker to consumer, so per-record overhead is tiny. Brokers are simple: no per-message acks or indexes beyond a sparse offset index, and consumers keep their own position. Partitions spread load across brokers and disks.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A topic has 6 partitions. Your consumer group has 9 consumers. How many are actively consuming?",
          options: ["9", "6", "3", "1"],
          answer: 1,
          explain: "Each partition goes to at most one consumer in a group. The other 3 stay idle as hot standbys.",
        },
        {
          q: "Which records are guaranteed to be read in the order they were written?",
          options: ["All records in a topic", "Records in the same partition", "Records with the same timestamp", "Records from the same broker"],
          answer: 1,
          explain: "Kafka only orders within a partition. Use the same key to put related records in the same partition.",
        },
        {
          q: "What happens to a record after every consumer group has read it?",
          options: ["It's deleted immediately", "It stays until the topic's retention (time/size) or compaction removes it", "It moves to a dead-letter topic", "It's archived to ZooKeeper"],
          answer: 1,
          explain: "Consumption doesn't delete anything. That's what makes replay and new consumers possible.",
        },
        {
          q: "Since Kafka 4.0, what manages cluster metadata?",
          options: ["ZooKeeper", "The KRaft controller quorum", "etcd", "Each broker independently"],
          answer: 1,
          explain: "KRaft (Kafka Raft) replaced ZooKeeper; Kafka 4.0 removed ZooKeeper mode completely.",
        },
      ],
    },

    // ------------------------------------------------------------------ PRODUCERS
    {
      id: "kafka-producers",
      title: "Producers: Partitioning, Batching, Acks & Idempotence",
      tagline: "How a send() becomes a durable record, and every knob between latency, throughput and safety.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["producer"],
      concept: `
## The life of send()
1. **Serialize** key and value (bytes, JSON, Avro, Protobuf).
2. **Partition**: with a key, \`murmur2(key) % numPartitions\`; without a key, the built-in partitioner fills a batch for one partition before moving on ("sticky"), which makes bigger batches than round robin.
3. **Accumulate**: the record joins an in-memory **batch** for that partition (\`buffer.memory\`, default 32 MB total).
4. A background **sender thread** ships a batch when it reaches \`batch.size\` (16 KB default) or has waited \`linger.ms\` (5 ms by default since Kafka 4.0, 0 before). Batches for the same broker go in one request.
5. The **leader** appends the batch; depending on **acks**, it replies immediately or after followers have it.
6. The callback/future completes with the offset or an error. Retriable errors are **retried** until \`delivery.timeout.ms\` (2 min default) expires.

## Throughput vs latency
- **linger.ms** + **batch.size**: waiting a few milliseconds produces fuller batches → fewer requests, better compression, much higher throughput. For high-volume producers, 5–50 ms of linger and 64–256 KB batches is typical.
- **compression.type**: \`lz4\` or \`zstd\` usually; compression works on whole batches, so bigger batches compress better. Brokers store batches compressed as sent (when topic and producer codecs agree), and consumers decompress.
- **max.in.flight.requests.per.connection** (5 default): more requests in flight hide latency.

Play with these in the visualizer and watch requests per second and added latency.

## Durability: acks
| acks | The leader replies when… | Risk |
|---|---|---|
| **0** | Never waits (fire and forget) | Silent loss on any failure |
| **1** | The leader has written it | Loss if the leader dies before followers copy it |
| **all** (-1) | All **in-sync replicas** have it | None while ≥ \`min.insync.replicas\` copies exist |

\`acks=all\` only means "all *in-sync* replicas". If the ISR has shrunk to just the leader, that's one copy. Pair it with **\`min.insync.replicas=2\`** on the topic (with RF=3), so writes fail with NOT_ENOUGH_REPLICAS instead of silently becoming single-copy. Default producer settings since Kafka 3.0 are \`acks=all\` and idempotence on.

## Retries, duplicates and idempotence
A network timeout is ambiguous: the write may or may not have happened. Retrying can create **duplicates**, and with several in-flight requests, **reordering**. The **idempotent producer** (\`enable.idempotence=true\`) fixes both per partition: the broker assigns a **producer ID**, each batch carries a **sequence number**, and the broker discards duplicates and rejects out-of-order sequences. It's on by default and costs almost nothing.

Idempotence is per producer session and per partition. Atomic writes across partitions (and exactly-once read-process-write) need **transactions**, covered in the exactly-once lesson.

## Choosing keys
- Key by the entity whose events must stay ordered: \`orderId\`, \`accountId\`, \`deviceId\`.
- Watch for **skew**: a single huge customer key makes one hot partition. Options: a compound key (\`customerId + bucket\`) if strict per-customer order isn't needed, or a separate topic for the whale.
- **Adding partitions later** changes \`hash % N\` for every key, so new events for a key go to a different partition than old ones. Over-provision partitions up front for keyed topics.
`,
      keyPoints: [
        "A record is serialized, partitioned (hash of key), batched per partition, then sent by a background thread.",
        "linger.ms and batch.size trade a few ms of latency for far fewer, fuller, better-compressed requests.",
        "acks=all + min.insync.replicas=2 + RF=3 is the standard durable setup.",
        "Idempotent producers (default) prevent duplicates and reordering from retries, per partition.",
        "Keys decide ordering and load: avoid hot keys and avoid changing partition counts of keyed topics.",
      ],
      code: [
        {
          title: "A durable, high-throughput producer",
          variants: [
            {
              lang: "java",
              code: `
Properties p = new Properties();
p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "broker-1:9092,broker-2:9092");
p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, KafkaAvroSerializer.class);
p.put(ProducerConfig.ACKS_CONFIG, "all");                 // wait for the ISR
p.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);    // no dups, no reordering
p.put(ProducerConfig.LINGER_MS_CONFIG, 20);               // fuller batches
p.put(ProducerConfig.BATCH_SIZE_CONFIG, 128 * 1024);
p.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "zstd");
p.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 120_000); // total time incl. retries

try (var producer = new KafkaProducer<String, Order>(p)) {
    var record = new ProducerRecord<>("orders", order.id(), order);   // key = order id
    producer.send(record, (meta, err) -> {
        if (err != null) log.error("send failed after retries", err);  // alert / DLQ / fail request
        else log.debug("orders-{}@{}", meta.partition(), meta.offset());
    });
}
`,
            },
            {
              lang: "python",
              code: `
from confluent_kafka import Producer

p = Producer({
    "bootstrap.servers": "broker-1:9092,broker-2:9092",
    "acks": "all",
    "enable.idempotence": True,
    "linger.ms": 20,
    "batch.size": 131072,
    "compression.type": "zstd",
})

def on_delivery(err, msg):
    if err:
        log.error("delivery failed: %s", err)
    else:
        log.debug("%s-%d@%d", msg.topic(), msg.partition(), msg.offset())

p.produce("orders", key=order_id, value=payload, on_delivery=on_delivery)
p.poll(0)      # serve delivery callbacks
p.flush(10)    # on shutdown: wait for outstanding batches
`,
            },
          ],
        },
        {
          title: "Topic settings that make acks=all meaningful",
          variants: [
            {
              lang: "properties",
              code: `
# topic (or broker default) configuration
replication.factor=3
min.insync.replicas=2
unclean.leader.election.enable=false
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "How do you make sure a Kafka producer never loses an acknowledged message?",
          a: "Producer: `acks=all`, `enable.idempotence=true` (default in modern clients), generous `delivery.timeout.ms` with retries, and **handle the send callback/future**: a failed send must be surfaced (alert, retry at the app level, fail the request), not ignored. Topic: `replication.factor=3`, **`min.insync.replicas=2`** so an ack always means at least two copies, and `unclean.leader.election.enable=false` so an out-of-sync replica can't become leader and discard acked data. Operationally: spread replicas across racks/AZs (rack awareness), monitor under-replicated partitions, and flush the producer on shutdown.",
          freq: "very-common",
        },
        {
          q: "Explain linger.ms and batch.size. How would you tune a producer for throughput?",
          a: "Records are grouped into per-partition **batches**. A batch is sent when it reaches **batch.size** bytes or has waited **linger.ms**, whichever comes first. With `linger.ms=0`, batches are often tiny under moderate load, meaning many small requests, poor compression and high broker CPU. For throughput: raise `linger.ms` (10–50 ms), `batch.size` (64–256 KB), enable `compression.type=lz4/zstd`, keep `max.in.flight=5` with idempotence, ensure `buffer.memory` is large enough, and use keys/partitioner that fill batches (the sticky partitioner does this for keyless records). Measure: batch-size-avg, records-per-request, request-latency, and broker produce request rate.",
          freq: "common",
        },
        {
          q: "What does the idempotent producer guarantee, and what doesn't it?",
          a: "Each producer gets a **producer ID**, and each batch carries a **per-partition sequence number**. The broker keeps the last few sequence numbers per PID/partition and **drops duplicates** from retries and **rejects gaps**, so retries can't duplicate or reorder records within a partition, even with 5 in-flight requests. It does **not** cover: duplicates across producer restarts (new PID, unless you use a transactional.id), atomicity across multiple partitions or topics, or the consumer side (reprocessing after a crash). Those need **transactions** plus read_committed consumers, or idempotent consumers.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "With acks=all, RF=3 and min.insync.replicas=1, two followers fall out of the ISR. What does an acks=all write mean now?",
          options: ["It's rejected", "It's acknowledged with only the leader's copy", "It waits for the followers to come back", "It's written to all three anyway"],
          answer: 1,
          explain: "acks=all waits for the current ISR, which is just the leader. That's why min.insync.replicas=2 matters.",
        },
        {
          q: "Which setting stops retries from creating duplicate records in a partition?",
          options: ["acks=all", "enable.idempotence=true", "linger.ms=0", "compression.type=zstd"],
          answer: 1,
          explain: "The broker deduplicates by producer ID + sequence number.",
        },
        {
          q: "You double a keyed topic's partitions from 12 to 24. What happens to per-key ordering?",
          options: ["Nothing changes", "New records for a key may go to a different partition than its older records, breaking ordering across the change", "Kafka migrates old records automatically", "Keys are rehashed only for new topics"],
          answer: 1,
          explain: "The partition is hash(key) % N; changing N remaps keys. Existing data isn't moved.",
        },
        {
          q: "Raising linger.ms from 0 to 20 ms usually…",
          options: ["Lowers throughput", "Adds up to 20 ms latency but greatly increases batch size, compression and throughput", "Disables batching", "Makes acks=all unnecessary"],
          answer: 1,
          explain: "Waiting briefly lets batches fill, so far fewer, larger requests carry the same data.",
        },
      ],
    },

    // ------------------------------------------------------------------ REPLICATION
    {
      id: "kafka-replication",
      title: "Replication, ISR & Durability",
      tagline: "Leaders, followers, the in-sync replica set, high watermarks, and the exact conditions under which data is lost.",
      difficulty: "advanced",
      minutes: 16,
      visualizers: ["isr"],
      concept: `
## Leaders and followers
Each partition has **replication.factor** replicas on different brokers (ideally different racks/AZs). One is the **leader**; producers write to it and, by default, consumers read from it. **Followers** continuously **fetch** from the leader, exactly like consumers, and append to their own logs.

## The ISR (in-sync replicas)
A follower is **in sync** if it has caught up to the leader's log end within **replica.lag.time.max.ms** (30 s). Slow or dead followers are removed from the ISR, and re-added once they catch up. The ISR is what "acks=all" waits for and what leader elections choose from.

## LEO and the high watermark
- **Log end offset (LEO)**: the next offset each replica will write.
- **High watermark (HW)**: the highest offset replicated to **every ISR member**. Records below the HW are **committed**.
- **Consumers can only read up to the HW**, so they never see a record that could still be lost in a failover.

## Leader election
When a leader dies, the controller picks a new leader **from the ISR**, and bumps the **leader epoch**. Returning replicas compare epochs with the new leader and **truncate** any divergent, uncommitted tail before following again. That truncation is safe because those records were never committed (and never acknowledged with acks=all).

If **no ISR member is alive**:
- \`unclean.leader.election.enable=false\` (default): the partition stays **offline** until an ISR member returns. You choose consistency.
- \`true\`: an out-of-sync replica becomes leader. The partition is available again, but records it never copied, including **acknowledged** ones, are lost. You choose availability.

## The durability matrix
| Setting | Survives |
|---|---|
| RF=3, min.insync=2, acks=all, unclean=false | Losing any one broker with no data loss and writes still accepted |
| acks=1 | A leader crash before replication **loses acked writes** |
| min.insync=1 | A shrunken ISR makes acks=all single-copy |
| unclean=true | Trades committed data for availability |

The visualizer lets you produce, slow a follower down, kill the leader and flip unclean election to see each case.

## Other details worth knowing
- Kafka **doesn't fsync** each write by default; durability comes from **replication** across machines, not from local disk flushes. Correlated failures (a whole AZ losing power) are why rack awareness matters.
- **Rack awareness** (\`broker.rack\`) spreads replicas across AZs. **Follower fetching** (KIP-392, \`client.rack\`) lets consumers read from a replica in their own AZ, saving cross-AZ transfer costs.
- **Preferred leader**: the first replica in the list. After restarts, leadership is rebalanced back automatically (\`auto.leader.rebalance.enable\`).
- **Under-replicated partitions** and **ISR shrink/expand rates** are the key health signals.
`,
      keyPoints: [
        "Followers fetch from the leader. The ISR is the set of replicas caught up within replica.lag.time.max.ms.",
        "High watermark = offset replicated to all ISR members. Consumers only read below it.",
        "New leaders come from the ISR; returning replicas truncate their uncommitted tail.",
        "Unclean election trades acknowledged data for availability. Keep it off for important data.",
        "RF=3 + min.insync.replicas=2 + acks=all survives one broker loss without losing writes or rejecting them.",
      ],
      code: [
        {
          title: "Checking replication health",
          variants: [
            {
              lang: "bash",
              code: `
# Partitions whose ISR is smaller than the replica set
kafka-topics.sh --bootstrap-server b1:9092 --describe --under-replicated-partitions

# Partitions below min.insync.replicas (acks=all writes are failing)
kafka-topics.sh --bootstrap-server b1:9092 --describe --under-min-isr-partitions

# Partitions with no leader at all
kafka-topics.sh --bootstrap-server b1:9092 --describe --unavailable-partitions

# Move leadership back to preferred replicas after a rolling restart
kafka-leader-election.sh --bootstrap-server b1:9092 --election-type preferred --all-topic-partitions
`,
            },
          ],
        },
        {
          title: "Broker settings for durability across zones",
          variants: [
            {
              lang: "properties",
              code: `
broker.rack=us-east-1a                    # replicas spread across racks/AZs
default.replication.factor=3
min.insync.replicas=2
unclean.leader.election.enable=false
replica.lag.time.max.ms=30000
# let consumers read from a replica in their own AZ (KIP-392)
replica.selector.class=org.apache.kafka.common.replica.RackAwareReplicaSelector
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What is the ISR, and how does it relate to acks=all and min.insync.replicas?",
          a: "The **in-sync replica set** is the leader plus followers that have caught up to the leader within `replica.lag.time.max.ms`. With **acks=all**, the leader acknowledges a write once **every ISR member** has it, which advances the high watermark. Because the ISR can shrink (slow or dead followers), `acks=all` alone could mean only one copy; **min.insync.replicas** sets a floor: if the ISR is smaller, acks=all produce requests fail with NOT_ENOUGH_REPLICAS. With RF=3 and min.insync=2 you tolerate one replica down while still accepting writes, and every acked write is on at least two brokers.",
          freq: "very-common",
        },
        {
          q: "Under what conditions can Kafka lose data that a producer saw as acknowledged?",
          a: "(1) **acks=0 or acks=1**: the leader acks before followers replicate, then dies. (2) **min.insync.replicas=1** (or RF=1): acks=all can mean a single copy. (3) **Unclean leader election** enabled: an out-of-sync replica becomes leader and the others truncate to it. (4) **Correlated failures** without fsync: all replicas in one rack/AZ lose power before flushing the page cache, which is why rack awareness matters. (5) Retention or compaction misconfiguration deleting data before consumers read it (not \"loss\" in replication terms, but loss all the same). With RF=3, min.insync=2, acks=all, unclean=false and replicas across AZs, losing a single broker or AZ doesn't lose acked data.",
          freq: "common",
        },
        {
          q: "What is the high watermark and why can't consumers read past it?",
          a: "The HW is the offset up to which **all ISR replicas** have the data, i.e. the committed portion of the log. Records between the HW and the leader's log end are written on the leader but not yet replicated. If the leader died, the new leader might not have them, and they'd be truncated. Letting consumers read only below the HW guarantees they never process a record that later disappears, so all consumers see a consistent history across failovers. (Transactional consumers with read_committed are further limited to the last stable offset.)",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "When does a follower get removed from the ISR?",
          options: ["After one missed fetch", "When it hasn't caught up to the leader's log end within replica.lag.time.max.ms", "When its disk is 80% full", "When a consumer reads from it"],
          answer: 1,
          explain: "The ISR is time-based: lagging longer than replica.lag.time.max.ms (30 s default) drops it.",
        },
        {
          q: "The leader of a partition dies and all other replicas are out of sync. unclean.leader.election.enable=false. What happens?",
          options: ["The most recent follower becomes leader", "The partition is offline until an ISR member comes back", "Kafka restores from backup", "Producers switch to another partition"],
          answer: 1,
          explain: "Kafka prefers consistency by default: it won't elect a replica that may be missing committed data.",
        },
        {
          q: "What can a consumer read?",
          options: ["Everything on the leader up to its log end", "Only records below the high watermark", "Only records on followers", "Only compacted records"],
          answer: 1,
          explain: "Uncommitted records above the HW might be truncated in a failover, so they're hidden from consumers.",
        },
      ],
    },

    // ------------------------------------------------------------------ CONSUMERS
    {
      id: "kafka-consumers",
      title: "Consumer Groups, Offsets & Rebalancing",
      tagline: "How partitions are shared, when offsets are committed, why rebalances hurt, and how to keep lag at zero.",
      difficulty: "advanced",
      minutes: 17,
      visualizers: ["rebalance"],
      concept: `
## Consumer groups
Consumers with the same \`group.id\` share a topic's partitions: **each partition is assigned to exactly one member**. Different groups are independent and each sees every record. One broker acts as the **group coordinator**, tracking members via heartbeats and storing committed offsets in \`__consumer_offsets\`.

## The poll loop
\`\`\`
while running:
    records = consumer.poll(timeout)   # also sends heartbeats in the background
    process(records)
    commit offsets
\`\`\`
- **session.timeout.ms** (45 s): no heartbeat for this long → the member is considered dead.
- **max.poll.interval.ms** (5 min): if processing one batch takes longer than this between polls, the member is kicked out even though it's heartbeating. The classic cause of rebalance loops with slow processing: reduce \`max.poll.records\` or move work off the poll thread.

## Offsets and commits
The committed offset is the **next** record to read. When a consumer restarts or a partition moves, consumption resumes there.
- **Auto-commit** (\`enable.auto.commit=true\`, every 5 s) commits what \`poll\` returned, whether or not you finished processing it. A crash can then skip records (lost) or replay up to 5 s of them.
- **Manual commit after processing** gives **at-least-once**: a crash after processing but before committing replays records, so make processing **idempotent**.
- \`auto.offset.reset\` (\`latest\` / \`earliest\`) applies only when the group has **no committed offset** (new group, or offsets expired).
- Operators can **reset offsets** to replay or skip: \`kafka-consumer-groups.sh --reset-offsets --to-datetime …\`.

## Rebalancing
A rebalance reassigns partitions when members join, leave, crash, or the topic's partitions change.
- **Eager** protocol (range, round robin): every member **revokes all** partitions, the group agrees on a new assignment, then everyone resumes. Stop-the-world for the whole group.
- **Incremental cooperative** (\`CooperativeStickyAssignor\`): only partitions that actually move are revoked, over two rounds; everything else keeps flowing.
- **KIP-848**, the new consumer group protocol (GA in Kafka 4.0, \`group.protocol=consumer\`): the **broker** computes assignments and reconciles members incrementally, with no group-wide sync barrier. Rebalances become much cheaper and faster.
- **Static membership** (\`group.instance.id\`): a member that restarts within the session timeout gets its partitions back without a rebalance. Great for rolling deploys and Kubernetes StatefulSets.

Add, remove and crash consumers in the visualizer under each strategy.

## Lag
**Consumer lag** = log end offset − committed offset, per partition. It's *the* consumer health metric. Rising lag means consumers can't keep up: scale consumers (up to the partition count), speed up processing (batching, async I/O, fewer external calls per record), or add partitions. Alert on **lag in time** (how old is the oldest unprocessed record), not just in messages, because records per second vary.

## Parallelism beyond partitions
If processing is slow per record (an HTTP call each), one consumer per partition may not be enough. Options: more partitions; or process records **concurrently per key** within a consumer (e.g. Confluent's Parallel Consumer) while committing only offsets below the oldest unfinished record. Kafka 4.x **share groups** (KIP-932) offer queue-style consumption where many consumers share one partition with per-record acknowledgement.
`,
      keyPoints: [
        "Within a group, each partition goes to exactly one consumer; groups are independent of each other.",
        "Exceeding max.poll.interval.ms kicks a consumer out even while it heartbeats: keep each poll's work bounded.",
        "Commit after processing = at-least-once, so make processing idempotent. Auto-commit can lose or replay records.",
        "Eager rebalances stop the whole group; cooperative-sticky, static membership and KIP-848 minimise disruption.",
        "Lag (log end − committed offset) is the key metric; alert on lag in seconds.",
      ],
      code: [
        {
          title: "An at-least-once consumer with manual commits",
          variants: [
            {
              lang: "java",
              code: `
Properties p = new Properties();
p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "broker-1:9092");
p.put(ConsumerConfig.GROUP_ID_CONFIG, "billing");
p.put(ConsumerConfig.GROUP_INSTANCE_ID_CONFIG, System.getenv("POD_NAME")); // static membership
p.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
p.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 200);       // bound work per poll
p.put(ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG, CooperativeStickyAssignor.class.getName());

try (var consumer = new KafkaConsumer<String, Payment>(p)) {
    consumer.subscribe(List.of("payments"));
    while (running) {
        var records = consumer.poll(Duration.ofMillis(500));
        for (var r : records) {
            billing.applyIdempotently(r.key(), r.value());  // safe to replay
        }
        consumer.commitSync();                               // only after processing
    }
}
`,
            },
            {
              lang: "go",
              code: `
c, _ := kafka.NewConsumer(&kafka.ConfigMap{
    "bootstrap.servers":             "broker-1:9092",
    "group.id":                      "billing",
    "enable.auto.commit":            false,
    "auto.offset.reset":             "earliest",
    "partition.assignment.strategy": "cooperative-sticky",
})
c.SubscribeTopics([]string{"payments"}, nil)

for running {
    msg, err := c.ReadMessage(500 * time.Millisecond)
    if err != nil {
        continue // timeout or transient error
    }
    if err := applyIdempotently(msg); err != nil {
        sendToRetryTopic(msg, err) // don't block the partition forever
    }
    c.CommitMessage(msg) // at-least-once
}
`,
            },
          ],
        },
        {
          title: "Inspect and reset a group",
          variants: [
            {
              lang: "bash",
              code: `
kafka-consumer-groups.sh --bootstrap-server b1:9092 --describe --group billing
# TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG    CONSUMER-ID ...

# Replay everything since an incident started (the group must be stopped)
kafka-consumer-groups.sh --bootstrap-server b1:9092 --group billing --topic payments \\
  --reset-offsets --to-datetime 2026-10-20T14:00:00.000 --execute
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What triggers a consumer group rebalance, and how do you minimise its impact?",
          a: "Triggers: a member **joins** (scale-up, deploy), **leaves** cleanly, **crashes** (no heartbeat for `session.timeout.ms`), exceeds **`max.poll.interval.ms`** (slow processing), or the subscribed topics' **partition count** changes. Minimise impact: use the **cooperative-sticky** assignor (only moved partitions pause) or the new **KIP-848** protocol (broker-side incremental assignment); use **static membership** (`group.instance.id`) so restarts within the session timeout don't rebalance at all; bound per-poll work (`max.poll.records`) so you never exceed max.poll.interval; and make shutdown graceful (commit and close, which sends LeaveGroup).",
          freq: "very-common",
        },
        {
          q: "Consumer lag keeps growing. How do you diagnose and fix it?",
          a: "First check whether lag grows on **all partitions** (consumers too slow overall) or **a few** (hot keys / skewed partitions, or one stuck consumer). Check for **rebalance storms** (logs, rebalance rate) since nothing is consumed during eager rebalances, and for a **poison record** blocking a partition with endless retries. Fixes: scale consumers up to the partition count; speed up per-record work (batch DB writes, async I/O, cache lookups, avoid a synchronous HTTP call per record); move failing records to a **retry/DLQ topic** instead of blocking; increase partitions (mind keyed ordering); fix key skew. Alert on lag **in time**, and autoscale consumers on lag (KEDA's Kafka scaler) with max replicas = partitions.",
          freq: "very-common",
        },
        {
          q: "What's the difference between session.timeout.ms and max.poll.interval.ms?",
          a: "**session.timeout.ms** detects **dead processes**: heartbeats are sent from a background thread, and if none arrive within this window, the coordinator removes the member. **max.poll.interval.ms** detects **stuck or slow processing**: if the application doesn't call `poll()` again within this interval, the client itself leaves the group, even though the heartbeat thread is alive. Long processing per batch therefore causes rebalances without any crash. Lower `max.poll.records`, speed up processing, or (carefully) raise max.poll.interval.ms.",
          freq: "common",
        },
        {
          q: "How do you handle a message that always fails processing (a poison pill)?",
          a: "Never block the partition retrying forever, since all records behind it stall. Pattern: catch the error, retry a few times **in-process** for transient issues, then publish the record (with error metadata in headers) to a **retry topic** consumed with a delay, and after N attempts to a **dead-letter topic** for humans or tooling. Commit the original offset so the partition moves on. Caveat: this breaks strict per-key ordering for that key; if ordering matters, park subsequent records for the same key too. Also handle **deserialization errors** explicitly (e.g. ErrorHandlingDeserializer) since they otherwise crash the poll loop.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "With enable.auto.commit=true, the app crashes right after poll() returned records but before processing them. What happens?",
          options: [
            "They're always reprocessed",
            "If the auto-commit timer already fired, they're skipped (lost); otherwise reprocessed",
            "Kafka deletes them",
            "The broker re-sends them to another group",
          ],
          answer: 1,
          explain: "Auto-commit commits what poll returned on a timer, not what you processed. Commit manually after processing for at-least-once.",
        },
        {
          q: "Processing each batch takes 7 minutes with default settings. What happens?",
          options: ["Nothing", "The consumer exceeds max.poll.interval.ms (5 min), leaves the group and triggers a rebalance", "The broker deletes the batch", "The session timeout is extended automatically"],
          answer: 1,
          explain: "The client leaves the group if poll() isn't called within max.poll.interval.ms, even while heartbeating.",
        },
        {
          q: "What does static membership (group.instance.id) avoid?",
          options: ["Duplicate processing", "A rebalance when a member restarts within the session timeout", "Consumer lag", "Offset commits"],
          answer: 1,
          explain: "The coordinator recognises the returning instance and gives back its partitions without reshuffling the group.",
        },
        {
          q: "When does auto.offset.reset apply?",
          options: ["On every restart", "Only when the group has no valid committed offset for a partition", "After every rebalance", "When lag exceeds a threshold"],
          answer: 1,
          explain: "It's the fallback for new groups or expired/out-of-range offsets; otherwise consumption resumes from the committed offset.",
        },
      ],
    },

    // ------------------------------------------------------------------ EXACTLY ONCE
    {
      id: "kafka-eos",
      title: "Delivery Semantics, Transactions & the Outbox",
      tagline: "At-most-once, at-least-once, exactly-once: what each really means, and how to get end-to-end correctness.",
      difficulty: "advanced",
      minutes: 17,
      visualizers: ["eos"],
      concept: `
## The three guarantees
| | How | On a crash |
|---|---|---|
| **At-most-once** | Commit the offset, then process | Records can be **lost** |
| **At-least-once** | Process, then commit | Records can be **duplicated** |
| **Exactly-once** | Make output and offset commit atomic | Each record's effect appears once |

At-least-once is the default and the norm. "Exactly-once" in Kafka means **exactly-once processing within Kafka**: reading from Kafka, transforming, and writing back to Kafka. It is not exactly-once *delivery* to arbitrary external systems.

## Transactions
A transactional producer (with a stable **transactional.id**) can write to many partitions and commit the consumer's offsets **atomically**:
1. \`initTransactions()\` registers with a **transaction coordinator** and **fences** any older producer with the same transactional.id (a "zombie" from a previous instance) by bumping the epoch.
2. \`beginTransaction()\`, send output records, \`sendOffsetsToTransaction(offsets, groupMetadata)\`.
3. \`commitTransaction()\`: the coordinator runs a two-phase commit, writing **commit markers** into every partition involved. Or \`abortTransaction()\` writes abort markers.

Consumers with **\`isolation.level=read_committed\`** only see committed transactional records and stop at the **last stable offset** (the first still-open transaction). Aborted records stay in the log but are skipped. The visualizer crashes a pipeline mid-transaction to show this.

Kafka Streams does all of this for you with \`processing.guarantee=exactly_once_v2\`.

Costs: extra latency per transaction (commit markers, coordinator round trips), so commit every 100 ms–1 s rather than per record; read_committed consumers wait behind open transactions; and a misconfigured, long-running transaction can stall downstream consumers until it times out.

## Side effects outside Kafka
Sending an email, charging a card or writing to a database isn't part of a Kafka transaction. Two tools cover almost every case:
- **Idempotent consumers**: make the effect safe to repeat. Use the record's natural key or an event ID with a unique constraint (\`INSERT … ON CONFLICT DO NOTHING\`), upserts, or a "processed events" table updated in the same DB transaction as the business change. Pass an **idempotency key** to external APIs (payment providers support this).
- **Store offsets with the data**: write results and the consumed offset in one database transaction, and on startup seek to the stored offset instead of using Kafka's committed offset.

## The dual-write problem and the transactional outbox
A service that updates its database **and** publishes an event has two writes that can't be atomic: if it crashes in between, the DB and Kafka disagree, forever.

**Transactional outbox**: in the same local DB transaction as the business change, insert the event into an \`outbox\` table. A separate relay publishes outbox rows to Kafka, either by polling or (better) with **CDC**: Debezium tails the database's write-ahead log and publishes outbox inserts. Delivery is at-least-once, so consumers dedupe by event ID. The opposite direction, consuming then writing to a DB, uses an **inbox** table or idempotent upserts.
`,
      keyPoints: [
        "At-most-once loses, at-least-once duplicates; at-least-once + idempotent processing is the practical default.",
        "Kafka transactions atomically commit output records and consumer offsets; read_committed consumers skip aborted data.",
        "transactional.id fences zombie producers after restarts.",
        "Exactly-once covers Kafka → Kafka. External side effects need idempotency keys or offsets stored with the data.",
        "Avoid dual writes: use the transactional outbox (with CDC) to update a DB and publish events consistently.",
      ],
      code: [
        {
          title: "A transactional read-process-write loop",
          variants: [
            {
              lang: "java",
              code: `
producerProps.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "fees-" + instanceId); // stable per instance
consumerProps.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");
consumerProps.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

producer.initTransactions();                  // fences older producers with this id
consumer.subscribe(List.of("payments"));

while (running) {
    var records = consumer.poll(Duration.ofMillis(200));
    if (records.isEmpty()) continue;
    producer.beginTransaction();
    try {
        for (var r : records) producer.send(new ProducerRecord<>("fees", r.key(), feeFor(r.value())));
        producer.sendOffsetsToTransaction(nextOffsets(records), consumer.groupMetadata());
        producer.commitTransaction();         // output + offsets become visible together
    } catch (ProducerFencedException e) {
        throw e;                              // a newer instance took over: stop
    } catch (KafkaException e) {
        producer.abortTransaction();          // nothing visible; rewind and retry
        rewindToCommitted(consumer);
    }
}
`,
            },
          ],
        },
        {
          title: "Transactional outbox in the database",
          variants: [
            {
              lang: "sql",
              code: `
BEGIN;
  UPDATE orders SET status = 'PAID' WHERE id = 42;

  INSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload)
  VALUES (gen_random_uuid(), 'order', '42', 'OrderPaid',
          '{"orderId": 42, "amount": 35.00}');
COMMIT;
-- Debezium's outbox event router streams new outbox rows to the topic "order.events",
-- keyed by aggregate_id. Consumers dedupe on the outbox id.

-- Idempotent consumer side: the unique key makes replays harmless
INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING;
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Does Kafka support exactly-once delivery? Explain precisely.",
          a: "Kafka supports **exactly-once processing for Kafka-to-Kafka pipelines**: the **idempotent producer** removes duplicates from retries; **transactions** let a producer write to multiple partitions and commit consumer offsets atomically, with zombie fencing via `transactional.id`; and **read_committed** consumers only see committed data. Kafka Streams wraps this as `exactly_once_v2`. Once the pipeline touches an external system (a DB, an email, an API), Kafka can't make that effect exactly-once. You get **effectively-once** by combining at-least-once delivery with **idempotent** effects (dedupe keys, upserts, idempotency keys), or by storing offsets atomically with the output in the same database transaction.",
          freq: "very-common",
        },
        {
          q: "What is the dual-write problem and how does the outbox pattern solve it?",
          a: "A service that writes to its **database** and publishes to **Kafka** can't make both atomic: a crash between them leaves state and events inconsistent (order paid but no OrderPaid event, or an event for a rolled-back change). Publishing inside the DB transaction doesn't help either. The **transactional outbox**: write the event to an `outbox` table **in the same local transaction** as the business change. A relay (polling publisher, or **CDC with Debezium** reading the WAL/binlog) publishes outbox rows to Kafka. The DB commit is the single source of truth; delivery to Kafka is at-least-once, so consumers deduplicate by event ID. Delete or partition old outbox rows to keep the table small.",
          freq: "very-common",
        },
        {
          q: "What is a zombie producer and how does Kafka fence it?",
          a: "A producer instance that the system thinks is dead (it paused for a long GC, or got partitioned from the network) while a **replacement** has already started and taken over its work. If the zombie wakes up and keeps writing, you get duplicates or conflicting results. With transactions, both use the same **transactional.id**. When the new instance calls `initTransactions()`, the coordinator **bumps the producer epoch** and aborts any open transaction. Any later write or commit from the zombie carries the old epoch and is rejected with `ProducerFencedException`.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "A consumer processes records and then commits offsets. It crashes after processing but before committing. Which guarantee is this?",
          options: ["At-most-once", "At-least-once", "Exactly-once", "Best effort"],
          answer: 1,
          explain: "The records will be reprocessed after restart: no loss, possible duplicates.",
        },
        {
          q: "What does isolation.level=read_committed do?",
          options: ["Waits for all replicas before reading", "Hides records from aborted or still-open transactions", "Reads only compacted data", "Commits offsets automatically"],
          answer: 1,
          explain: "read_committed consumers read up to the last stable offset and skip aborted transactional records.",
        },
        {
          q: "Your consumer charges a credit card for each record. How do you avoid double charges on replays?",
          options: ["Use Kafka transactions", "Pass an idempotency key (e.g. the event ID) to the payment API and record processed IDs", "Set acks=all", "Use a compacted topic"],
          answer: 1,
          explain: "Kafka transactions can't cover external side effects. Make the effect idempotent.",
        },
        {
          q: "Which approach avoids the dual-write problem when a service updates Postgres and emits an event?",
          options: ["Publish to Kafka first, then write to Postgres", "Write to Postgres and an outbox table in one transaction, then relay the outbox to Kafka", "Use two-phase commit with the broker", "Publish inside a try/finally block"],
          answer: 1,
          explain: "The transactional outbox makes the DB commit the single atomic step; the relay delivers at-least-once.",
        },
      ],
    },
    ...kafkaPart2,
  ],
};
