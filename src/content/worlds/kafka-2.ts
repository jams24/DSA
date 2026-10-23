import type { Lesson } from "../types";

export const kafkaPart2: Lesson[] = [
  // ------------------------------------------------------------------ STORAGE
  {
    id: "kafka-storage",
    title: "Storage Internals: Segments, Retention & Compaction",
    tagline: "How a partition lives on disk, how data ages out, and how compacted topics become tables.",
    difficulty: "intermediate",
    minutes: 14,
    visualizers: ["compaction"],
    concept: `
## A partition on disk
Each partition is a directory of **segments**. A segment is a \`.log\` file of record batches plus a sparse \`.index\` (offset → file position) and \`.timeindex\` (timestamp → offset). Files are named after their first offset, e.g. \`00000000000000368769.log\`.
- Only the last, **active segment** is written to. It **rolls** to a new one at \`segment.bytes\` (1 GB) or \`segment.ms\` (7 days).
- Finding offset N = binary search the segment names, then the sparse index, then a short scan. That's why seeking is cheap.
- Retention and compaction work on **closed segments only**: the active segment is never deleted or compacted.

## cleanup.policy=delete
Whole segments are deleted once their **newest** record is older than \`retention.ms\` (7 days default), or when the partition exceeds \`retention.bytes\` (unlimited by default). Consequences: data can live somewhat longer than the retention time (until its segment closes and expires), and a low-traffic topic with a large \`segment.ms\` keeps data far longer than you think.

## cleanup.policy=compact
A compacted topic keeps **at least the latest record for every key**. Older values for the same key are removed by the background **log cleaner**. The result is a changelog you can replay to rebuild a table, which is what makes these possible:
- \`__consumer_offsets\` (latest offset per group/partition)
- Kafka Streams **state store changelogs** and **KTables**
- **CDC** topics where the key is the row's primary key
- Configuration or reference data that services load at startup

Details that interviewers like:
- **Tombstones**: a record with a key and a **null value** means "delete this key". After compaction it's kept for \`delete.retention.ms\` (24 h) so slow consumers see the delete, then removed.
- **Offsets never change**. A compacted log has gaps, and ordering of surviving records is preserved.
- \`min.compaction.lag.ms\` guarantees a minimum time before a record can be compacted away; \`max.compaction.lag.ms\` bounds how long a dirty record can wait. \`min.cleanable.dirty.ratio\` controls how eagerly the cleaner runs.
- \`cleanup.policy=compact,delete\` does both: latest per key, but nothing older than retention.

Try both policies in the visualizer: update keys, send a tombstone, roll time forward, run the cleaner.

## Tiered storage
With **tiered storage** (KIP-405, production-ready since Kafka 3.9), closed segments are copied to object storage (S3, GCS) and deleted from local disk after \`local.retention.ms\`. Brokers keep only hot data locally, so retention can be months without huge disks, and broker replacement or rebalancing moves far less data. Reading old data fetches it from the remote tier. A newer generation of "diskless" Kafka-compatible systems (WarpStream, AutoMQ, and the diskless-topics proposal for Apache Kafka) goes further and writes directly to object storage, trading latency for much lower cross-AZ replication cost.

## Sizing quick math
Disk per broker ≈ write throughput × retention × replication factor ÷ broker count, plus headroom (aim to stay under ~60–70% full). The sizing calculator in the operations lesson does this for you.
`,
    keyPoints: [
      "A partition is a set of segment files with sparse offset and time indexes; only the active segment is written.",
      "delete policy drops whole closed segments by age (retention.ms) or size (retention.bytes).",
      "compact policy keeps the latest value per key, giving a replayable table; offsets never change.",
      "A tombstone (null value) deletes a key and survives for delete.retention.ms so consumers see it.",
      "Tiered storage moves closed segments to object storage, decoupling retention from local disk.",
    ],
    code: [
      {
        title: "Topic configs for each use case",
        variants: [
          {
            lang: "bash",
            code: `
# Event stream: keep 7 days
kafka-topics.sh --bootstrap-server b1:9092 --create --topic clicks --partitions 48 \\
  --replication-factor 3 --config retention.ms=604800000

# Changelog / table: latest value per key, deletes visible for a day
kafka-topics.sh --bootstrap-server b1:9092 --create --topic customer-profiles --partitions 12 \\
  --replication-factor 3 --config cleanup.policy=compact \\
  --config min.compaction.lag.ms=3600000 --config delete.retention.ms=86400000

# Long retention without big disks (tiered storage enabled on the cluster)
kafka-configs.sh --bootstrap-server b1:9092 --alter --entity-type topics --entity-name audit-log \\
  --add-config remote.storage.enable=true,retention.ms=31536000000,local.retention.ms=86400000

# Look inside a segment
kafka-dump-log.sh --files /var/lib/kafka/clicks-0/00000000000000000000.log --print-data-log | head
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What is log compaction and when would you use it?",
        a: "With `cleanup.policy=compact`, Kafka guarantees to keep **at least the most recent record for each key**, removing older ones in the background (closed segments only). Deleting a key is done with a **tombstone** (null value), kept for `delete.retention.ms` so consumers can observe it. Offsets don't change, so compacted logs have gaps. Use it when the topic represents the **current state of entities**: CDC streams keyed by primary key, KTable/state-store changelogs, `__consumer_offsets`, user profiles or config that new consumers should be able to load in full. Don't use it for event streams where every event matters (clicks, payments): that needs time-based retention.",
        freq: "common",
      },
      {
        q: "Retention is 7 days, yet you can still read 12-day-old records. Why?",
        a: "Retention deletes **whole segments**, and only **closed** ones, based on the **newest** record in each segment. A low-volume partition's active segment might not roll until `segment.ms` (7 days) or `segment.bytes` (1 GB), so it can hold records up to ~7 days old before it even becomes eligible, then another 7 days of retention. Lower `segment.ms` (e.g. 1 day) for tighter retention, which is important for compliance (GDPR deletes). Also check retention.check.interval and whether tiered/remote storage has its own retention.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Which segment is never deleted or compacted?",
        options: ["The oldest segment", "The active (last) segment", "Segments with tombstones", "Segments on the leader"],
        answer: 1,
        explain: "Retention and the log cleaner only touch closed segments.",
      },
      {
        q: "How do you delete a key from a compacted topic?",
        options: ["kafka-topics --delete-key", "Produce a record with that key and a null value (a tombstone)", "Lower retention.ms", "Reset the consumer offsets"],
        answer: 1,
        explain: "Tombstones mark keys as deleted; after delete.retention.ms the tombstone itself is removed.",
      },
      {
        q: "After compaction, what happens to the offsets of surviving records?",
        options: ["They're renumbered from 0", "They stay the same, leaving gaps", "They're shifted to the end", "They're moved to a new partition"],
        answer: 1,
        explain: "Offsets are permanent identifiers; compaction just removes records, leaving gaps.",
      },
    ],
  },

  // ------------------------------------------------------------------ STREAMS
  {
    id: "kafka-streams",
    title: "Stream Processing: Kafka Streams & Flink",
    tagline: "Streams vs tables, stateful aggregations, windows, event time, late data and joins.",
    difficulty: "advanced",
    minutes: 18,
    visualizers: ["windows"],
    concept: `
## Streams and tables
- A **stream** (KStream) is an unbounded sequence of independent events: "Alice clicked", "Alice clicked again".
- A **table** (KTable) is the latest value per key: "Alice's balance is 30".
- They're two views of the same thing (**stream–table duality**): aggregating a stream gives a table, and a table's changelog is a stream. That's also why compacted topics back tables.

## Kafka Streams
A **Java library**, not a cluster: your app embeds it and scales by running more instances. Under the hood:
- The topology is split into **tasks**, one per input partition. Instances in the same \`application.id\` share tasks through the consumer group protocol.
- **State stores** (RocksDB by default) live locally on each instance and are backed by **compacted changelog topics**, so a task that moves to another instance rebuilds its state from the changelog. **Standby replicas** keep warm copies to make failover fast.
- \`groupBy\` on a new key writes to an internal **repartition topic** so all records for a key reach the same task.
- \`processing.guarantee=exactly_once_v2\` gives transactional exactly-once across reads, state updates and writes.

## Time
- **Event time**: when it happened (the record timestamp). **Processing time**: when you see it. Mobile and IoT data arrives minutes or hours late and out of order, so windows must use event time to be correct.
- Kafka Streams tracks **stream time** (the max timestamp seen per task). Flink uses **watermarks**: a declaration that "no events older than T are expected any more".
- **Grace period**: how long after a window ends late events are still accepted. Longer grace = more complete results but later final output. Events later than that are dropped (or sent to a side output in Flink).

## Windows
| Window | Shape | Example |
|---|---|---|
| **Tumbling** | Fixed size, no overlap | Orders per minute |
| **Hopping** | Fixed size, overlapping (advance < size) | 5-minute moving average every minute |
| **Sliding** | Defined by the time difference between events | Joins within 10 s of each other |
| **Session** | Per-key activity separated by an inactivity gap | User sessions with 30 min timeout |

Windows emit updates as data arrives; \`suppress(untilWindowCloses)\` (or emit-final strategy) emits only the final result. Step through all three in the visualizer, with different grace periods.

## Joins
- **Stream–stream**: windowed (orders joined with payments within 10 minutes). Both sides are buffered in state.
- **Stream–table**: enrich each event with the current table value (click + user profile). Not windowed.
- **Table–table**: a continuously updated joined view.
- Join inputs must be **co-partitioned**: same key, same number of partitions, same partitioner. Otherwise repartition first, or use a **GlobalKTable** (fully replicated to every instance, for small reference data).

## Kafka Streams vs Flink (and others)
| | Kafka Streams | Apache Flink |
|---|---|---|
| Deployment | A library inside your service | A cluster (JobManager + TaskManagers), often managed |
| Sources/sinks | Kafka in, Kafka out | Kafka, files, databases, many connectors |
| State & recovery | RocksDB + changelog topics | RocksDB + distributed checkpoints/savepoints |
| Strengths | Simple ops, microservice-friendly | Large stateful jobs, rich event-time semantics, SQL, batch + stream |

ksqlDB and Flink SQL let you write the same logic in SQL. Spark Structured Streaming is micro-batch based and popular where Spark is already the data platform.
`,
    keyPoints: [
      "Streams are events, tables are latest-per-key; aggregating a stream makes a table and a table's changelog is a stream.",
      "Kafka Streams is a library: tasks per partition, local RocksDB state backed by compacted changelog topics.",
      "Use event time; late, out-of-order events are handled by grace periods (Streams) or watermarks (Flink).",
      "Tumbling, hopping, sliding and session windows; suppress to emit only final results.",
      "Joins need co-partitioned inputs, or a repartition, or a GlobalKTable for small reference data.",
    ],
    code: [
      {
        title: "Windowed counts with a grace period (Kafka Streams)",
        variants: [
          {
            lang: "java",
            code: `
StreamsBuilder b = new StreamsBuilder();

KStream<String, Click> clicks = b.stream("clicks");                // key = userId
KTable<String, Profile> profiles = b.table("customer-profiles");    // compacted topic

clicks
    .join(profiles, (click, profile) -> click.withCountry(profile.country()))  // stream–table enrichment
    .groupBy((user, click) -> click.country())                     // repartition by country
    .windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofMinutes(1), Duration.ofSeconds(30)))
    .count(Materialized.as("clicks-per-country"))                  // RocksDB + changelog topic
    .suppress(Suppressed.untilWindowCloses(Suppressed.BufferConfig.unbounded()))  // final counts only
    .toStream()
    .map((w, n) -> KeyValue.pair(w.key(), new CountryCount(w.key(), w.window().start(), n)))
    .to("clicks-per-country-1m");

Properties p = new Properties();
p.put(StreamsConfig.APPLICATION_ID_CONFIG, "click-analytics");
p.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG, StreamsConfig.EXACTLY_ONCE_V2);
p.put(StreamsConfig.NUM_STANDBY_REPLICAS_CONFIG, 1);               // warm state for fast failover
new KafkaStreams(b.build(), p).start();
`,
          },
        ],
      },
      {
        title: "The same idea in Flink SQL",
        variants: [
          {
            lang: "sql",
            code: `
CREATE TABLE clicks (
  user_id STRING,
  country STRING,
  ts TIMESTAMP(3),
  WATERMARK FOR ts AS ts - INTERVAL '30' SECOND        -- tolerate 30 s of lateness
) WITH ('connector' = 'kafka', 'topic' = 'clicks', 'format' = 'avro-confluent' /* ... */);

SELECT window_start, country, COUNT(*) AS clicks
FROM TABLE(TUMBLE(TABLE clicks, DESCRIPTOR(ts), INTERVAL '1' MINUTE))
GROUP BY window_start, window_end, country;
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Explain event time vs processing time, and how a streaming system handles late data.",
        a: "**Event time** is when the event happened (embedded timestamp); **processing time** is when the processor sees it. They diverge because of network delays, offline mobile devices, retries and backfills, and events arrive **out of order**. Correct windowed results need event time. The system tracks progress in event time (**stream time** in Kafka Streams, **watermarks** in Flink) and keeps windows open for a **grace period/allowed lateness** after they end. Late events within grace update the result; events beyond it are dropped or routed to a side output for correction. The trade-off is **completeness vs latency**: longer grace means more accurate but later final results.",
        freq: "very-common",
      },
      {
        q: "How does Kafka Streams keep state fault-tolerant?",
        a: "Each task's state lives in a local **state store** (RocksDB), and every update is also written to a **compacted changelog topic** in Kafka. If an instance dies, its tasks move to other instances (via the consumer group), which **restore** the store by replaying the changelog, and resume from committed offsets. **Standby replicas** keep shadow copies up to date on other instances so failover doesn't need a full replay. With **exactly_once_v2**, the input offsets, state changelog writes and output records are committed in one transaction, so a crash never leaves state and output out of sync.",
        freq: "common",
      },
      {
        q: "What does co-partitioning mean, and why does a join need it?",
        a: "Two topics are co-partitioned when they're keyed by the **same key**, have the **same number of partitions**, and use the **same partitioner**, so key K is in partition P of both. A Kafka Streams task processes partition P of both inputs, so a join can only find matches that live in the same task. If topics aren't co-partitioned, re-key/repartition one side (an internal repartition topic) first, or use a **GlobalKTable**, which replicates a whole (small) table to every instance and supports joins on any field.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "You need 'unique users per 5 minutes, updated every minute'. Which window?",
        options: ["Tumbling 5 min", "Hopping 5 min with 1 min advance", "Session with 5 min gap", "Global window"],
        answer: 1,
        explain: "Hopping windows overlap: each window is 5 minutes long and a new one starts every minute.",
      },
      {
        q: "An event arrives 40 s after its 1-minute tumbling window ended. The grace period is 30 s. What happens in Kafka Streams?",
        options: ["It updates the window", "It's dropped as late", "It opens a new window", "The application crashes"],
        answer: 1,
        explain: "Once stream time passes window end + grace, the window is closed and late records are dropped.",
      },
      {
        q: "Where does Kafka Streams keep the state of a count() aggregation durable?",
        options: ["Only in memory", "In a compacted changelog topic backing the local RocksDB store", "In ZooKeeper", "In the consumer offsets"],
        answer: 1,
        explain: "Local RocksDB for speed, a changelog topic for recovery.",
      },
      {
        q: "Which is a session window?",
        options: ["Fixed 10-minute buckets", "Activity for one key until it's idle for longer than a gap", "Overlapping windows every minute", "Events within 10 s of each other across two streams"],
        answer: 1,
        explain: "Session windows have no fixed size; they grow with activity and close after an inactivity gap.",
      },
    ],
  },

  // ------------------------------------------------------------------ CONNECT & CDC
  {
    id: "kafka-connect-cdc",
    title: "Kafka Connect, Schema Registry & CDC",
    tagline: "Move data in and out without code, keep schemas compatible, and stream every database change with Debezium.",
    difficulty: "intermediate",
    minutes: 15,
    diagram: {
      title: "CDC pipeline: Postgres → Kafka → search, warehouse and cache",
      nodes: [
        { id: "app", label: "Orders service", sub: "writes rows + outbox", kind: "service", x: 90, y: 280 },
        { id: "pg", label: "Postgres", sub: "WAL (logical replication)", kind: "db", x: 290, y: 280 },
        { id: "debezium", label: "Debezium source", sub: "Kafka Connect worker", kind: "worker", x: 490, y: 280 },
        { id: "sr", label: "Schema Registry", sub: "Avro / Protobuf schemas", kind: "registry", x: 490, y: 80 },
        { id: "kafka", label: "Kafka", sub: "dbserver.public.orders", kind: "queue", x: 690, y: 280 },
        { id: "es", label: "Elasticsearch sink", sub: "search index", kind: "search", x: 900, y: 120 },
        { id: "s3", label: "S3 / Iceberg sink", sub: "data lake", kind: "storage", x: 900, y: 280 },
        { id: "cache", label: "Cache updater", sub: "consumer service", kind: "cache", x: 900, y: 440 },
      ],
      edges: [
        { from: "app", to: "pg", label: "INSERT/UPDATE" },
        { from: "pg", to: "debezium", label: "replication slot" },
        { from: "debezium", to: "sr", label: "register", dashed: true },
        { from: "debezium", to: "kafka", label: "change events" },
        { from: "kafka", to: "es" },
        { from: "kafka", to: "s3" },
        { from: "kafka", to: "cache" },
      ],
      flows: [
        {
          name: "An order is updated",
          path: ["app", "pg", "debezium", "sr", "debezium", "kafka", "es"],
          steps: [
            "The service runs UPDATE orders SET status='SHIPPED'. It doesn't know Kafka exists, so there's no dual write.",
            "Postgres records the change in its write-ahead log. Debezium reads it through a logical replication slot, in commit order.",
            "Debezium builds a change event (before, after, op=u, source position) and the converter makes sure the Avro schema is registered.",
            "The registry returns a schema ID; the record carries just that 4-byte ID instead of the full schema.",
            "The event lands in topic dbserver.public.orders, keyed by the primary key, so all changes to one row stay in order.",
            "The Elasticsearch sink connector upserts the document by key. Search reflects the change within seconds.",
          ],
        },
        {
          name: "Add a new consumer later",
          path: ["kafka", "s3"],
          steps: ["A new S3/Iceberg sink starts from the earliest offset (or a fresh Debezium snapshot) and backfills the data lake without touching the database."],
        },
      ],
    },
    concept: `
## Kafka Connect
A framework (and runtime) for **moving data between Kafka and other systems** with configuration instead of code.
- **Source connectors** pull from systems into Kafka (databases via CDC, files, SaaS APIs). **Sink connectors** push from Kafka out (S3, data warehouses, Elasticsearch, databases).
- **Workers** run in **distributed mode** as a cluster; connectors are split into **tasks** spread across workers, and their configs, offsets and status are stored in Kafka topics. You manage them over a REST API.
- **Converters** serialise data (JSON, Avro, Protobuf); **Single Message Transforms (SMTs)** do light per-record changes (rename fields, route topics, mask PII). Heavy logic belongs in a stream processor.
- **Error handling**: \`errors.tolerance=all\` with \`errors.deadletterqueue.topic.name\` sends bad records to a **DLQ** instead of killing the task.

## Schemas and the Schema Registry
Producers and consumers are deployed independently, so the data format is a **contract**. A **Schema Registry** stores versioned schemas (Avro, Protobuf, JSON Schema) per subject (usually per topic). Serializers register the schema and prefix each message with a magic byte + **schema ID**; deserializers fetch and cache schemas by ID.

**Compatibility modes** enforce safe evolution at registration time:
| Mode | Allowed changes | Upgrade order |
|---|---|---|
| **BACKWARD** (default) | Delete fields, add **optional** fields (with defaults) | Consumers first |
| **FORWARD** | Add fields, delete optional fields | Producers first |
| **FULL** | Add or remove optional fields only | Either |
| *_TRANSITIVE | Same, checked against all versions, not just the last | |

Renaming a field or changing its type is a breaking change: create a new field (or a new topic) and migrate.

## Change Data Capture (CDC)
**Log-based CDC** reads the database's own replication log (Postgres WAL via logical decoding, MySQL binlog, MongoDB oplog) and emits a change event for every insert, update and delete, in commit order. **Debezium** is the standard open-source implementation, running as Connect source connectors.
- Events carry **before and after** images, the operation and source metadata (transaction ID, log position).
- An initial **snapshot** captures existing rows, then streaming continues from the log position. Incremental snapshots allow re-snapshotting tables without stopping.
- Compared to polling (\`SELECT … WHERE updated_at > ?\`), log-based CDC catches **deletes**, doesn't miss quick successive updates, and adds almost no load to the database.
- Watch out: a Postgres **replication slot** that isn't being consumed makes the database **retain WAL** forever and can fill its disk. Monitor slot lag.

Typical uses: the **outbox pattern**, keeping **search indexes and caches** in sync, feeding a **data lake/warehouse**, and **strangler-fig migrations** from a monolith's database to new services.
`,
    keyPoints: [
      "Kafka Connect moves data in (source) and out (sink) by configuration; workers run tasks and store state in Kafka.",
      "Use a DLQ for bad records, SMTs for light transforms, and a stream processor for real logic.",
      "Schema Registry + compatibility rules make data a versioned contract; BACKWARD is the default (upgrade consumers first).",
      "Debezium does log-based CDC: every insert/update/delete in commit order, including deletes, with low DB load.",
      "Monitor replication slots: an idle slot makes Postgres keep WAL until the disk fills.",
    ],
    code: [
      {
        title: "Register a Debezium Postgres connector with the outbox router",
        variants: [
          {
            lang: "bash",
            code: `
curl -s -X PUT http://connect:8083/connectors/orders-cdc/config \\
  -H 'Content-Type: application/json' -d '{
  "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
  "database.hostname": "orders-db",
  "database.dbname": "orders",
  "database.user": "\${secrets:cdc/user}",
  "database.password": "\${secrets:cdc/password}",
  "plugin.name": "pgoutput",
  "slot.name": "orders_cdc",
  "topic.prefix": "orders",
  "table.include.list": "public.outbox",
  "transforms": "outbox",
  "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
  "key.converter": "org.apache.kafka.connect.storage.StringConverter",
  "value.converter": "io.confluent.connect.avro.AvroConverter",
  "value.converter.schema.registry.url": "http://schema-registry:8081",
  "errors.tolerance": "all",
  "errors.deadletterqueue.topic.name": "dlq.orders-cdc"
}'

curl -s http://connect:8083/connectors/orders-cdc/status | jq '.tasks[].state'
`,
          },
        ],
      },
      {
        title: "A backward-compatible schema change",
        variants: [
          {
            lang: "text",
            code: `
// v1
{ "type": "record", "name": "Order", "fields": [
  { "name": "id", "type": "string" },
  { "name": "amount", "type": "double" }
]}

// v2: new optional field WITH a default → BACKWARD compatible
{ "type": "record", "name": "Order", "fields": [
  { "name": "id", "type": "string" },
  { "name": "amount", "type": "double" },
  { "name": "currency", "type": "string", "default": "USD" }
]}
// A v2 consumer reading v1 data fills currency = "USD". Renaming "amount" would be rejected.
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What is CDC, and why is log-based CDC better than polling the database?",
        a: "Change Data Capture turns database changes into a stream of events. **Polling** (`WHERE updated_at > last_seen`) misses **deletes**, misses intermediate updates between polls, needs an indexed timestamp column on every table, and adds query load. **Log-based CDC** (Debezium reading the Postgres WAL or MySQL binlog) captures **every** insert, update and delete, **in commit order**, with before/after images and transaction metadata, at low overhead, and without changing the application. Costs: connector operations, schema changes flow downstream, and replication slots must be monitored so the database doesn't retain WAL forever.",
        freq: "common",
      },
      {
        q: "How do you evolve message schemas without breaking consumers?",
        a: "Use a **Schema Registry** with a compatibility mode enforced at registration (CI can check too). Under **BACKWARD** (default): add fields only with **defaults**, remove fields freely; upgrade **consumers first**, since new consumers can read old data. Never rename or change types in place: add a new field, dual-write for a while, migrate consumers, then remove the old one. For truly breaking changes, create a **new topic version** (`orders.v2`) and run both until consumers migrate. Prefer Avro/Protobuf over schemaless JSON for anything shared between teams.",
        freq: "common",
      },
      {
        q: "A sink connector keeps failing on a few malformed records. What do you do?",
        a: "Configure Connect's error handling: `errors.tolerance=all`, `errors.deadletterqueue.topic.name=dlq.<connector>`, and `errors.deadletterqueue.context.headers.enable=true` so the DLQ records include the failure reason; add `errors.log.enable`. The task keeps going; you alert on DLQ volume, fix the producer or add a transform, and replay the DLQ when fixed. Note the DLQ covers conversion/transformation and sink put errors; for source-side issues, fix at the source. Also check if the failures are schema mismatches, which a Schema Registry compatibility rule would have caught earlier.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Under BACKWARD compatibility, which change is allowed?",
        options: ["Renaming a field", "Changing a field from string to int", "Adding a new field with a default value", "Adding a required field without a default"],
        answer: 2,
        explain: "New consumers must read old data, so new fields need defaults.",
      },
      {
        q: "Why does Debezium capture deletes while timestamp polling doesn't?",
        options: ["Polling is too slow", "A deleted row no longer exists to be selected, but the delete is recorded in the transaction log", "Debezium uses triggers", "Deletes are stored in Kafka by default"],
        answer: 1,
        explain: "Log-based CDC reads the WAL/binlog, which records every change including deletes.",
      },
      {
        q: "A Debezium connector for Postgres has been stopped for a week. What's the risk?",
        options: ["None", "The replication slot keeps WAL on the database server, which can fill its disk", "Kafka deletes the topic", "Schemas expire"],
        answer: 1,
        explain: "Postgres retains WAL for unconsumed replication slots. Monitor slot lag and drop abandoned slots.",
      },
    ],
  },

  // ------------------------------------------------------------------ OPERATIONS
  {
    id: "kafka-operations",
    title: "Operating Kafka: KRaft, Sizing, Monitoring & Multi-Region",
    tagline: "Run Kafka in production: control plane, capacity planning, the metrics that matter, upgrades and disaster recovery.",
    difficulty: "advanced",
    minutes: 17,
    visualizers: ["kafkasizing"],
    concept: `
## KRaft: the control plane
Since Kafka 4.0, cluster metadata is managed by a **KRaft** quorum: 3 (or 5) **controller** nodes run Raft over an internal metadata log (\`__cluster_metadata\`), and brokers replicate that log. Compared to ZooKeeper this means one system to run, faster controller failover, and support for millions of partitions. In production, run controllers as **dedicated nodes** (separate from brokers) and spread them across AZs. Migrating an old cluster means moving to KRaft on a 3.x release before upgrading to 4.x.

## Capacity planning
Size for the **highest** of three constraints:
1. **Disk**: write rate × retention × replication factor, with ~40% headroom. Tiered storage changes the picture completely for long retention.
2. **Network**: brokers receive writes × RF (leaders + replication) and send writes × (number of consumer groups) + replication traffic. Network is often the real bottleneck, and cross-AZ replication traffic is often the biggest cloud bill item.
3. **Partitions**: enough for target throughput per partition and consumer parallelism, with growth room, but not thousands per broker without reason (each costs file handles, memory and recovery time).

Use the calculator to see which constraint binds for your numbers.

## Partition count rules of thumb
- partitions ≥ max(target throughput ÷ per-partition producer throughput, target throughput ÷ per-partition consumer throughput).
- Over-provision for keyed topics (adding partitions later remaps keys), within reason.
- More partitions = more parallelism, but also longer leader elections, more open files and smaller batches per partition.

## The metrics that matter
| Metric | Why |
|---|---|
| **UnderReplicatedPartitions** / UnderMinIsr | Replication falling behind, or acks=all writes failing |
| **OfflinePartitionsCount** | Partitions with no leader: an outage |
| **ActiveControllerCount** | Exactly 1 across the cluster |
| **Consumer lag** (records and seconds) | Consumers keeping up? (Burrow, kafka-lag-exporter, Prometheus exporters) |
| Request latency (produce/fetch p99), request queue time | Broker saturation |
| Network and request handler idle %, disk usage, ISR shrink/expand rate | Capacity and flapping replicas |

## Day-2 operations
- **Rebalancing partitions** across brokers after adding nodes: \`kafka-reassign-partitions\` with throttles, or **Cruise Control**, which continuously balances load and handles broker add/remove.
- **Rolling upgrades/restarts**: one broker at a time, waiting for under-replicated partitions to return to zero in between, with controlled shutdown so leadership moves cleanly.
- **Quotas** per client or user (bytes/s, request rate) protect the cluster from a noisy producer.
- **Security**: TLS everywhere, SASL (SCRAM, OAuth/OIDC, mTLS) for authentication, **ACLs** for topic-level authorization, and encrypted disks.
- On Kubernetes, the **Strimzi** operator manages brokers, topics, users and upgrades as custom resources.

## Multi-region and disaster recovery
- **Stretched cluster** across 3 AZs in one region: the standard high-availability setup (synchronous replication, rack awareness).
- **Across regions**: asynchronous replication with **MirrorMaker 2** (built on Connect; replicates topics, configs, ACLs and translates **consumer offsets** via checkpoints) or vendor features such as cluster linking. Patterns: **active-passive** (DR failover, accept RPO of seconds), **active-active** (each region writes to local topics, mirrored to the others with a region prefix to avoid loops; consumers read both).
- Failover runbooks must handle **offset translation** and **duplicates** (consumers should be idempotent), and be rehearsed.

## Managed or self-hosted?
Managed services (Confluent Cloud, Amazon MSK, Aiven, Redpanda Cloud, WarpStream and others) remove most of this list. Self-hosting makes sense with strong in-house expertise, special compliance needs, or a scale where it's clearly cheaper.
`,
    keyPoints: [
      "KRaft replaced ZooKeeper (4.0): run 3–5 dedicated controllers across AZs.",
      "Size for the tightest of disk (write × retention × RF), network (replication + fan-out) and partitions.",
      "Watch under-replicated/offline partitions, active controller count, consumer lag in seconds, and request latency.",
      "Rebalance with Cruise Control or throttled reassignment; roll restarts one broker at a time.",
      "Cross-region DR uses async replication (MirrorMaker 2) with offset translation and idempotent consumers.",
    ],
    code: [
      {
        title: "KRaft controller and broker configuration",
        variants: [
          {
            lang: "properties",
            code: `
# controller-1.properties (dedicated controller)
process.roles=controller
node.id=1
controller.quorum.bootstrap.servers=ctl-1:9093,ctl-2:9093,ctl-3:9093
listeners=CONTROLLER://:9093

# broker-101.properties
process.roles=broker
node.id=101
broker.rack=us-east-1a
controller.quorum.bootstrap.servers=ctl-1:9093,ctl-2:9093,ctl-3:9093
listeners=SASL_SSL://:9092
inter.broker.listener.name=SASL_SSL
default.replication.factor=3
min.insync.replicas=2
num.partitions=12
auto.create.topics.enable=false
`,
          },
        ],
      },
      {
        title: "Grow the cluster safely",
        variants: [
          {
            lang: "bash",
            code: `
# Generate a plan to spread topics onto new brokers 104-106
kafka-reassign-partitions.sh --bootstrap-server b1:9092 --generate \\
  --topics-to-move-json-file topics.json --broker-list 101,102,103,104,105,106 > plan.json

# Execute with a replication throttle so client traffic isn't starved (50 MB/s)
kafka-reassign-partitions.sh --bootstrap-server b1:9092 --execute \\
  --reassignment-json-file plan.json --throttle 50000000

kafka-reassign-partitions.sh --bootstrap-server b1:9092 --verify --reassignment-json-file plan.json
# --verify also removes the throttle once everything has moved
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "How do you decide how many partitions a topic needs?",
        a: "Start from **throughput**: partitions ≥ target MB/s ÷ what one partition can sustain for the **producer** (often ~10 MB/s) and for **one consumer instance** (often the real limit, depending on processing cost). Then **parallelism**: max consumers in a group = partitions, so plan for peak consumer count. Add **growth headroom** (1–2 years), especially for **keyed** topics, because increasing partitions later remaps keys and breaks per-key ordering across the change. Upper bounds: each partition replica costs memory, file handles and failover time, so avoid thousands per broker without need. Typical answers land between 6 and a few hundred per topic.",
        freq: "very-common",
      },
      {
        q: "What would you monitor on a Kafka cluster, and what would page you?",
        a: "**Page**: OfflinePartitionsCount > 0, UnderMinIsrPartitionCount > 0 (acks=all writes failing), ActiveControllerCount ≠ 1, **consumer lag in seconds** above SLO for critical groups, disk usage > ~85%. **Ticket/dashboard**: under-replicated partitions (sustained), ISR shrink/expand rate (flapping), produce/fetch p99 latency and request queue time, network/request handler idle ratio, broker CPU and page cache hit ratio, partition and leader skew across brokers, client errors (NOT_ENOUGH_REPLICAS, throttling), and Connect task failures / DLQ rates. Plus end-to-end latency probes (produce a canary record, measure until consumed).",
        freq: "common",
      },
      {
        q: "How would you set up disaster recovery for Kafka across two regions?",
        a: "Within a region, a cluster stretched over **3 AZs** with RF=3, rack awareness and min.insync=2 handles AZ loss with no data loss. Across regions, replicate **asynchronously** with **MirrorMaker 2** (or a managed equivalent): topics, configs, ACLs, and **consumer group offsets** translated via checkpoints. **Active-passive**: consumers run in the primary; on failover, start them in the DR region from translated offsets, accepting an RPO of seconds and some duplicates (so consumers must be idempotent). **Active-active**: producers write locally, topics are mirrored with region prefixes (us.orders, eu.orders) to avoid loops, and consumers read both. Document and **rehearse** failover and failback, including DNS/bootstrap changes for clients.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "With RF=3, how much disk does 100 MB/s of writes need for 7 days of retention (before headroom)?",
        options: ["~60 TB", "~180 TB", "~20 TB", "~1.8 PB"],
        answer: 1,
        explain: "100 MB/s × 604,800 s ≈ 60 TB, × 3 replicas ≈ 180 TB.",
      },
      {
        q: "Which metric indicates acks=all producers are getting errors right now?",
        options: ["UnderReplicatedPartitions", "UnderMinIsrPartitionCount", "BytesInPerSec", "ActiveControllerCount"],
        answer: 1,
        explain: "Below min.insync.replicas, acks=all writes fail with NOT_ENOUGH_REPLICAS.",
      },
      {
        q: "What does MirrorMaker 2's checkpointing provide during a regional failover?",
        options: ["Synchronous replication", "Translated consumer group offsets for the target cluster", "Exactly-once across regions", "Automatic DNS failover"],
        answer: 1,
        explain: "Offsets differ between clusters; MM2 checkpoints map them so consumers resume close to where they left off.",
      },
    ],
  },

  // ------------------------------------------------------------------ DESIGN
  {
    id: "kafka-design",
    title: "Kafka in System Design: Event-Driven Patterns",
    tagline: "Event notification vs state transfer, event sourcing, CQRS, sagas, retries and DLQs, as you'd present them in an interview.",
    difficulty: "advanced",
    minutes: 18,
    caseStudy: true,
    diagram: {
      title: "Event-driven order platform",
      nodes: [
        { id: "client", label: "Checkout API", sub: "POST /orders", kind: "client", x: 90, y: 280 },
        { id: "orders", label: "Order service", sub: "DB + outbox", kind: "service", x: 290, y: 280 },
        { id: "events", label: "orders.events", sub: "keyed by orderId", kind: "queue", x: 500, y: 280 },
        { id: "payments", label: "Payment service", sub: "idempotent consumer", kind: "service", x: 730, y: 100 },
        { id: "inventory", label: "Inventory service", sub: "reserve stock", kind: "service", x: 730, y: 280 },
        { id: "retry", label: "retry + DLQ topics", sub: "orders.retry.1m · orders.dlq", kind: "queue", x: 730, y: 460 },
        { id: "view", label: "Order view (CQRS)", sub: "Elasticsearch / Redis", kind: "search", x: 930, y: 190 },
        { id: "lake", label: "Analytics", sub: "Flink → Iceberg", kind: "storage", x: 930, y: 400 },
      ],
      edges: [
        { from: "client", to: "orders" },
        { from: "orders", to: "events", label: "outbox → CDC" },
        { from: "events", to: "payments" },
        { from: "events", to: "inventory" },
        { from: "inventory", to: "retry", label: "on failure", dashed: true },
        { from: "events", to: "view" },
        { from: "events", to: "lake" },
        { from: "payments", to: "events", label: "PaymentCaptured" },
      ],
      flows: [
        {
          name: "Place an order (choreographed saga)",
          path: ["client", "orders", "events", "inventory", "events", "payments", "events", "view"],
          steps: [
            "The order is saved as PENDING with an OrderPlaced row in the outbox, in one DB transaction. The API returns 202 with the order ID.",
            "CDC relays the outbox row to orders.events, keyed by orderId so every event for this order is ordered.",
            "Inventory consumes OrderPlaced and reserves stock, deduplicating on event ID.",
            "It emits StockReserved (via its own outbox) to the stream.",
            "Payments sees StockReserved and charges the card with the order ID as the idempotency key.",
            "It emits PaymentCaptured. Orders marks the order CONFIRMED.",
            "The read model (CQRS) projects every event into a query-optimised view for 'my orders' pages.",
          ],
        },
        {
          name: "Payment fails: compensate",
          path: ["payments", "events", "inventory", "retry"],
          steps: [
            "The card is declined: Payments emits PaymentFailed. No distributed transaction, just another event.",
            "Inventory consumes PaymentFailed and releases the reservation: a compensating action.",
            "If the inventory DB is briefly down, the event goes to a delayed retry topic, then to the DLQ after N attempts, without blocking other orders.",
          ],
        },
      ],
    },
    concept: `
## When Kafka belongs in a design
Reach for it when you have **high-volume events**, **several independent consumers** of the same data, a need to **replay** or rebuild state, **stream processing**, or to **decouple** services in time (the producer shouldn't care whether consumers are up). Don't add it for a simple request/response call, or for a low-volume job queue where SQS or RabbitMQ is simpler.

## Four kinds of events
- **Event notification**: "OrderPlaced {id}". Small; consumers call back for details. Loose coupling, but chatty and the source must stay available.
- **Event-carried state transfer**: the event carries the data consumers need, so they keep a local copy and never call back. Bigger events, eventual consistency, great autonomy.
- **Event sourcing**: the event log *is* the source of truth; current state is derived by replaying events (with snapshots). Full audit history and time travel, at the cost of schema evolution and replay complexity.
- **CQRS**: separate the write model from read models, which are **projections** built from the event stream into stores optimised for queries (Elasticsearch, Redis, a denormalised table).

## Sagas instead of distributed transactions
A business process spanning services (order → inventory → payment → shipping) can't use a single ACID transaction. A **saga** is a sequence of local transactions, each publishing an event; failures trigger **compensating actions** (release stock, refund).
- **Choreography**: each service reacts to events. Simple and decoupled, but the overall flow is implicit and harder to trace.
- **Orchestration**: a coordinator (a service or a workflow engine such as Temporal) tells each participant what to do next. Explicit, easier to monitor and change, with a central component.

## Reliability patterns (say these out loud in interviews)
- **Transactional outbox + CDC** for publishing (no dual writes).
- **Idempotent consumers**: dedupe on event ID; every effect safe to repeat.
- **Keys for ordering**: key by the entity (orderId) so its events stay ordered.
- **Retry topics with delay + DLQ**, so a poison message never blocks a partition. Alert on DLQ volume and build tooling to replay it.
- **Schema Registry** with compatibility checks so producers can't break consumers.
- **Consumer lag SLOs** and autoscaling consumers on lag.

## Sizing in an interview
State the numbers: e.g. 50k events/s × 1 KB = 50 MB/s in; RF=3 → 150 MB/s replicated; 7 days → ~90 TB stored; 3 consumer groups → 150 MB/s out; ~48 partitions so each handles ~1 MB/s with room for 4× growth and enough consumer parallelism. Then name the bottleneck and how you'd scale it.

## Common pitfalls
- Using Kafka as a database for ad-hoc queries (it's a log: build a projection instead).
- Huge messages (default max 1 MB): put blobs in object storage and send a reference (the claim-check pattern).
- A topic per customer or per entity (partitions don't scale like that): use keys.
- Treating events as commands without ownership: each topic should have one owning team and a documented schema.
`,
    keyPoints: [
      "Use Kafka for high-volume, multi-consumer, replayable event streams, not for simple request/response or small job queues.",
      "Notification vs event-carried state vs event sourcing; CQRS builds read models from the stream.",
      "Sagas replace distributed transactions: local transactions + events + compensations (choreography or orchestration).",
      "Outbox + CDC, idempotent consumers, entity keys, retry topics + DLQ, and a schema registry make it reliable.",
      "In interviews, size it: throughput × RF, retention storage, fan-out, partition count, and the bottleneck.",
    ],
    code: [
      {
        title: "Retry topics and a DLQ without blocking the partition",
        variants: [
          {
            lang: "python",
            code: `
RETRY_TOPICS = ["orders.retry.1m", "orders.retry.10m"]
DLQ = "orders.dlq"

def handle(msg):
    attempt = int(dict(msg.headers() or []).get("attempt", b"0"))
    try:
        if seen(msg_id(msg)):            # idempotency: skip replays
            return
        reserve_stock(msg)
        mark_seen(msg_id(msg))
    except TransientError as e:
        target = RETRY_TOPICS[attempt] if attempt < len(RETRY_TOPICS) else DLQ
        producer.produce(target, key=msg.key(), value=msg.value(),
                         headers={"attempt": str(attempt + 1), "error": str(e)[:500],
                                  "origin": f"{msg.topic()}-{msg.partition()}@{msg.offset()}"})
    except PermanentError as e:          # bad data: straight to the DLQ
        producer.produce(DLQ, key=msg.key(), value=msg.value(), headers={"error": str(e)[:500]})
    # either way, commit and move on: the partition is never blocked
    consumer.commit(message=msg, asynchronous=False)
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Design an order processing system using Kafka. How do you guarantee consistency across services?",
        a: "Each service owns its database. **Orders** writes the order and an `OrderPlaced` event to an **outbox** in one transaction; **CDC** (Debezium) publishes it to `orders.events`, **keyed by orderId** so each order's events are ordered. **Inventory** and **Payments** are **idempotent consumers** (dedupe on event ID, payment idempotency key = orderId) and publish their own results via their own outboxes. The flow is a **saga**: on `PaymentFailed`, inventory runs a **compensating** release. Consistency is **eventual**, with an explicit state machine on the order (PENDING → CONFIRMED / CANCELLED) and timeouts for stuck sagas. Failures go to **retry topics and a DLQ**. A **CQRS** projection serves queries. Mention schemas in a registry, lag monitoring, and sizing (events/s, partitions, retention).",
        freq: "very-common",
      },
      {
        q: "Choreography vs orchestration for sagas: which would you pick?",
        a: "**Choreography** (services react to each other's events): no central component, very decoupled, great for short flows with few participants. But the business process is implicit, spread across services; it's hard to answer 'where is order 42 stuck?', and adding steps means touching several services. **Orchestration** (a coordinator, often a workflow engine like Temporal, or a dedicated saga service): the flow is explicit and versioned, timeouts and compensations live in one place, and observability is easy; the cost is a central component that must be highly available, plus some coupling to it. Rule of thumb: choreography for 2–3 steps, orchestration for long, branching or business-critical processes.",
        freq: "common",
      },
      {
        q: "When would you NOT use Kafka?",
        a: "When the problem is simple **request/response** (use HTTP/gRPC); a **low-volume work queue** with per-message acks, delays and priorities (SQS, RabbitMQ, or a database-backed queue are simpler); you need **ad-hoc queries** over the data (use a database; Kafka is a log); **strict global ordering** across all events at high volume; very **large payloads** (use object storage + references); or the team can't operate it and there's no managed option in budget. Also avoid it when synchronous consistency is required by the business (e.g. 'the balance must be updated before responding') without a design for eventual consistency.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Why key order events by orderId?",
        options: ["It compresses better", "All events for one order land in the same partition, so they're processed in order", "Kafka requires keys", "It enables exactly-once automatically"],
        answer: 1,
        explain: "Ordering is per partition; same key → same partition.",
      },
      {
        q: "A saga step fails after earlier steps committed. What undoes the earlier steps?",
        options: ["A distributed rollback by Kafka", "Compensating actions triggered by a failure event", "Kafka transactions across databases", "Consumer offset reset"],
        answer: 1,
        explain: "Sagas use compensations (release stock, refund) instead of a global transaction.",
      },
      {
        q: "What's the claim-check pattern?",
        options: ["Checking consumer lag before producing", "Storing a large payload in object storage and putting only a reference in the Kafka message", "Verifying schemas at the broker", "Committing offsets after a database write"],
        answer: 1,
        explain: "Kafka's default max message size is ~1 MB; large blobs belong in object storage.",
      },
      {
        q: "Which is a CQRS read model?",
        options: ["The outbox table", "A projection built from the event stream into a store optimised for queries", "The __consumer_offsets topic", "A dead-letter topic"],
        answer: 1,
        explain: "CQRS separates writes from read-optimised views built by consuming events.",
      },
    ],
  },
];
