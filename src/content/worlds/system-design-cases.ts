import type { Lesson } from "../types";

export const systemDesignCases: Lesson[] = [
  // ------------------------------------------------------------------ URL SHORTENER
  {
    id: "case-url-shortener",
    title: "Case Study: URL Shortener",
    tagline: "The warm-up question: IDs, encoding, caching and redirects.",
    difficulty: "intermediate",
    minutes: 18,
    caseStudy: true,
    diagram: {
      title: "URL shortener (bit.ly / TinyURL)",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 80, y: 280 },
        { id: "lb", label: "Load balancer", kind: "lb", x: 260, y: 280 },
        { id: "write", label: "Shorten API", sub: "POST /urls", kind: "service", x: 470, y: 150 },
        { id: "read", label: "Redirect service", sub: "GET /{code}", kind: "service", x: 470, y: 410 },
        { id: "ids", label: "ID allocator", sub: "counter ranges", kind: "service", x: 700, y: 60 },
        { id: "cache", label: "Cache", sub: "hot codes", kind: "cache", x: 700, y: 300 },
        { id: "db", label: "KV store", sub: "code → long URL", kind: "db", x: 900, y: 180 },
        { id: "clicks", label: "Click stream", sub: "Kafka", kind: "queue", x: 700, y: 500 },
        { id: "olap", label: "Analytics", sub: "ClickHouse", kind: "db", x: 900, y: 500 },
      ],
      edges: [
        { from: "client", to: "lb" },
        { from: "lb", to: "write" },
        { from: "lb", to: "read" },
        { from: "write", to: "ids", label: "next id" },
        { from: "write", to: "db" },
        { from: "read", to: "cache" },
        { from: "read", to: "db" },
        { from: "read", to: "clicks", dashed: true },
        { from: "clicks", to: "olap" },
      ],
      flows: [
        {
          name: "Shorten a URL",
          path: ["client", "lb", "write", "ids", "write", "db", "write", "lb", "client"],
          steps: [
            "POST /urls {long_url} reaches the load balancer.",
            "Routed to a stateless shorten-API instance.",
            "Get a unique numeric ID. Each instance leases a block of 1,000 IDs from a counter (ZooKeeper/DB sequence) so this is usually a local increment.",
            "Base62-encode the ID: 125 → '21' … 7 chars cover 62⁷ ≈ 3.5 trillion URLs.",
            "Store code → {long_url, owner, created_at, expires_at}. Writes are rare compared to reads.",
            "Return the short URL.",
            "Back through the load balancer…",
            "201 Created: https://sho.rt/aZ3k9Qx",
          ],
        },
        {
          name: "Redirect (cache hit)",
          path: ["client", "lb", "read", "cache", "read", "clicks"],
          steps: [
            "GET /aZ3k9Qx — this path is ~100× more frequent than shortening.",
            "Routed to the redirect service.",
            "Look up the code in Redis. Hot links (viral posts) live here; LRU handles the long tail.",
            "Hit → respond 302 Found with Location: <long URL> (302 keeps analytics; 301 lets browsers cache and skip us).",
            "Fire-and-forget a click event (ip, user agent, referrer) to Kafka — never slow the redirect for analytics.",
          ],
        },
        {
          name: "Redirect (cache miss)",
          path: ["client", "lb", "read", "cache", "read", "db", "read", "cache"],
          steps: [
            "Request for a less popular code.",
            "Redirect service handles it.",
            "Cache miss.",
            "Fall back to the key-value store.",
            "Point lookup by primary key: single-digit milliseconds.",
            "Populate the cache with a TTL, then redirect.",
            "Next request for this code is a hit.",
          ],
        },
        {
          name: "Analytics pipeline",
          path: ["read", "clicks", "olap"],
          steps: [
            "Click events are appended to a partitioned log, decoupled from the redirect latency.",
            "Consumers aggregate into a columnar store for dashboards (clicks per day, country, referrer).",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: shorten a long URL; redirect a short code to the original; optional custom alias, expiration, click analytics.
**Non-functional**: very low redirect latency (p99 < 50 ms), high availability for reads (a dead link breaks every tweet that used it), short codes must be unique and not guessable for private links (optional).

## 2. Estimates
- 100M new URLs/month ≈ **40 writes/s**; read:write ≈ 100:1 → **~4,000 redirects/s** average, ~10–20K peak.
- 5 years × 1.2B/year = 6B URLs × ~500 B ≈ **3 TB** — fits a modest sharded KV store; the hot set fits in cache.

## 3. API
\`\`\`
POST /v1/urls      { long_url, custom_alias?, expires_at? }  → 201 { code, short_url }
GET  /{code}       → 302 Location: long_url   (404 / 410 if missing or expired)
GET  /v1/urls/{code}/stats → click counts
\`\`\`

## 4. Generating codes — the core deep dive
| Approach | How | Trade-offs |
|---|---|---|
| **Counter + Base62** | unique integer → base62 string | no collisions; sequential codes are guessable (shuffle bits or use a bijective scramble); counter must be distributed (pre-allocated ranges per server) |
| **Hash the URL** (MD5/SHA → take 7 chars) | deterministic | collisions must be detected & retried; same URL → same code (dedupe, but leaks) |
| **Random 7 chars** | random from 62⁷ | check-and-insert with a unique constraint; collisions rare until the space fills |
| **Snowflake IDs** | timestamp + machine + sequence | 64-bit → 11 base62 chars, longer codes |

**Base62**: 62⁶ ≈ 56.8 billion, 62⁷ ≈ 3.5 trillion — 7 characters is plenty.

## 5. Data model
Key-value: \`code (PK) → long_url, user_id, created_at, expires_at\`. Access is always by primary key → DynamoDB / Cassandra / sharded Postgres all work. Optional index \`(user_id, created_at)\` for "my links".

## 6. Scaling reads
- **Cache** hot codes in Redis (or even at the CDN/edge for 301s).
- **301 vs 302**: 301 is cached by browsers — fewer hits on you but you lose click analytics and can't change the target. Most shorteners use 302 (or 307).
- Shard the KV store by \`hash(code)\`; replicate across AZs.

## 7. Extras interviewers probe
Custom aliases (check uniqueness, reserve words), expirations (lazy delete on read + background cleanup), abuse (malware URL scanning, rate limits per user), analytics via async event stream, multi-region active-active reads.
`,
    keyPoints: [
      "Read-heavy (~100:1): cache + KV store keyed by code.",
      "Counter + Base62 avoids collisions; pre-allocate ID ranges per server.",
      "7 base62 characters ≈ 3.5 trillion codes.",
      "302 keeps analytics; 301 is cached by browsers.",
      "Never put analytics in the redirect's critical path — emit events async.",
    ],
    code: [
      {
        title: "Base62 encoding and range-based ID allocation",
        variants: [
          {
            lang: "python",
            code: `
ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def base62(n: int) -> str:
    if n == 0:
        return ALPHABET[0]
    out = []
    while n:
        n, r = divmod(n, 62)
        out.append(ALPHABET[r])
    return "".join(reversed(out))

class IdAllocator:
    """Each app server leases a block of IDs so most allocations are local."""
    def __init__(self, db, block=1000):
        self.db, self.block = db, block
        self.next = self.end = 0

    def next_id(self):
        if self.next >= self.end:
            # atomic: UPDATE counters SET value = value + block RETURNING value
            self.end = self.db.increment("url_counter", self.block)
            self.next = self.end - self.block
        self.next += 1
        return self.next
`,
          },
          {
            lang: "go",
            code: `
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func Base62(n uint64) string {
	if n == 0 {
		return "0"
	}
	var buf [11]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = alphabet[n%62]
		n /= 62
	}
	return string(buf[i:])
}
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "How do you generate unique short codes at scale without collisions?",
        a: "Use a **distributed counter with range allocation**: a central store (DB sequence, ZooKeeper, Redis INCRBY) hands each app server a block of IDs (e.g. 1,000 at a time); the server increments locally and Base62-encodes. No collisions, minimal coordination, and a server crash only wastes its unused block. To avoid guessable sequential codes, pass the integer through a reversible permutation (e.g. a Feistel cipher / multiplicative inverse mod 62⁷) before encoding. Alternatives: random codes with a unique-constraint insert-and-retry, or hashing with collision handling.",
        freq: "very-common",
      },
      {
        q: "301 or 302 redirect?",
        a: "**301 (permanent)** lets browsers and proxies cache the redirect — less load, faster for repeat visitors, but you can't track subsequent clicks or change/expire the destination reliably. **302/307 (temporary)** sends every click through you — better analytics and control at the cost of more traffic. Most commercial shorteners use 302; mention the trade-off explicitly.",
        freq: "common",
      },
      {
        q: "How would you handle a link that suddenly goes viral?",
        a: "The redirect path is a single key lookup, so the cache absorbs it — but one key can still overload one Redis shard. Add a small **in-process LRU** on each redirect server (milliseconds of staleness is fine), replicate hot keys, or push the redirect to the **CDN edge** (cache the 302 response for a short TTL). Analytics stays async via Kafka so the spike doesn't hit the database.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "How many distinct codes do 7 Base62 characters give?",
        options: ["~62 million", "~3.5 billion", "~3.5 trillion", "~10⁷"],
        answer: 2,
        explain: "62⁷ ≈ 3.52 × 10¹².",
      },
      {
        q: "Why lease ID ranges to each server instead of calling the counter per request?",
        options: ["Security", "To avoid a round trip and a hot spot on every write", "Base62 requires it", "To make codes random"],
        answer: 1,
        explain: "Most allocations become local increments.",
      },
      {
        q: "Click analytics should be recorded…",
        options: ["Synchronously before redirecting", "Asynchronously via an event stream", "Only in the browser", "Never"],
        answer: 1,
        explain: "Keep the redirect path fast; process events later.",
      },
      {
        q: "Which data store access pattern dominates?",
        options: ["Range scans by date", "Point lookups by code", "Full-text search", "Graph traversals"],
        answer: 1,
        explain: "Every redirect is a primary-key lookup.",
      },
    ],
  },

  // ------------------------------------------------------------------ NEWS FEED
  {
    id: "case-news-feed",
    title: "Case Study: News Feed (Twitter/Instagram)",
    tagline: "Fan-out on write vs read, and the celebrity problem.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Home timeline with hybrid fan-out",
      nodes: [
        { id: "client", label: "Client", kind: "client", x: 70, y: 280 },
        { id: "lb", label: "API gateway", kind: "gateway", x: 230, y: 280 },
        { id: "post", label: "Post service", kind: "service", x: 430, y: 130 },
        { id: "feed", label: "Feed service", kind: "service", x: 430, y: 430 },
        { id: "posts", label: "Posts store", sub: "sharded by post id", kind: "db", x: 660, y: 60 },
        { id: "q", label: "Fan-out queue", sub: "Kafka", kind: "queue", x: 660, y: 210 },
        { id: "fan", label: "Fan-out workers", kind: "worker", x: 880, y: 210 },
        { id: "graph", label: "Social graph", sub: "followers", kind: "db", x: 880, y: 60 },
        { id: "tl", label: "Timeline cache", sub: "Redis list per user", kind: "cache", x: 660, y: 430 },
      ],
      edges: [
        { from: "client", to: "lb" },
        { from: "lb", to: "post" },
        { from: "lb", to: "feed" },
        { from: "post", to: "posts" },
        { from: "post", to: "q" },
        { from: "q", to: "fan" },
        { from: "fan", to: "graph" },
        { from: "fan", to: "tl", label: "push ids" },
        { from: "feed", to: "tl" },
        { from: "feed", to: "posts", label: "hydrate + celebs" },
      ],
      flows: [
        {
          name: "Publish (fan-out on write)",
          path: ["client", "lb", "post", "posts", "post", "q", "fan", "graph", "fan", "tl"],
          steps: [
            "User with 300 followers posts a photo (media already uploaded to object storage).",
            "Post service validates and assigns a time-sortable ID (Snowflake).",
            "Persist the post: this is the source of truth.",
            "Acknowledge to the user immediately…",
            "…and enqueue a fan-out job.",
            "Workers consume the event.",
            "Fetch follower IDs (paginated for large accounts).",
            "For each follower…",
            "…LPUSH the post ID onto their timeline list (trimmed to ~800 entries). Reads become trivial.",
          ],
        },
        {
          name: "Read home timeline",
          path: ["client", "lb", "feed", "tl", "feed", "posts", "feed", "lb", "client"],
          steps: [
            "User opens the app: GET /timeline?cursor=…",
            "Feed service handles it.",
            "Read the precomputed list of post IDs: O(1), ~1 ms.",
            "Merge in recent posts from followed celebrities (not fanned out — see below).",
            "Hydrate IDs into full posts (multi-get, mostly from cache) and apply ranking.",
            "Filter blocked/deleted content, attach like counts.",
            "Return a page plus a cursor for infinite scroll.",
            "Rendered on the client.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: post (text/media), follow users, view a home timeline of followed accounts' posts (reverse chronological or ranked), like/comment.
**Non-functional**: timeline loads fast (p99 < 200 ms), highly available, **eventual consistency is fine** (a post appearing a few seconds late is OK), massively read-heavy.

## 2. Estimates
300M DAU, each opens the feed ~10×/day → 3B timeline reads/day ≈ **35K QPS** (~100K peak). Posts: ~1 per user per day → ~3.5K writes/s. Average 200 followers → **700K timeline inserts/s** if we fan out everything.

## 3. The core decision: fan-out on write vs read
| | Fan-out on **write** (push) | Fan-out on **read** (pull) |
|---|---|---|
| On post | insert post ID into every follower's timeline | just store the post |
| On read | read one precomputed list | query every followee's recent posts and merge |
| Read latency | excellent | slow for users following many |
| Write cost | huge for accounts with millions of followers | trivial |
| Wasted work | timelines of inactive users | none |

**Hybrid (what Twitter did)**: push for normal users; for **celebrities** (> ~10K–100K followers) don't fan out — merge their recent posts at read time. Also skip fan-out to inactive users and rebuild their timeline on login.

## 4. Data model
- **posts**: \`post_id (Snowflake, time-sortable) → author_id, text, media_keys, created_at\` — sharded by post_id.
- **follows**: \`(follower_id, followee_id)\` with indexes both ways (or a graph store).
- **timeline cache**: Redis list per user of the newest ~800 post IDs.
- **counters** (likes): sharded counters or a separate counter service with async aggregation.

## 5. Ranking
Chronological is easy; ranked feeds add a ranking service: candidate generation (followed posts + recommendations) → feature lookup → ML model scoring → re-ranking for diversity. Discuss briefly unless the interviewer wants ML depth (see the AI world's ML system design lesson).

## 6. Deep dives to offer
- **Celebrity problem** (hybrid fan-out).
- **Pagination**: cursor = last seen post ID (Snowflake IDs sort by time).
- **Media**: pre-signed uploads to object storage, CDN delivery, async transcoding/thumbnailing.
- **Consistency**: user should see their own post immediately → insert into own timeline synchronously or merge on read.
- **Hot reads**: cache hydrated posts; viral posts are read millions of times.
- **Deletes / edits**: tombstones filtered at read time rather than chasing every timeline copy.
`,
    keyPoints: [
      "Read-heavy + eventual consistency OK → precompute timelines.",
      "Fan-out on write for most users, on read for celebrities (hybrid).",
      "Timelines store post IDs; hydrate from a post cache on read.",
      "Snowflake IDs give time ordering and natural cursors.",
      "Keep the posting path fast: persist, ack, fan out asynchronously.",
    ],
    interview: [
      {
        q: "Push or pull model for a news feed?",
        a: "Push (fan-out on write) makes reads O(1) by precomputing each follower's timeline — ideal because reads dominate — but a celebrity with 50M followers would trigger 50M writes per post. Pull computes the feed at read time by merging followees' posts — cheap writes, expensive reads. The standard answer is a **hybrid**: push for regular users, pull for celebrities and merge at read time, and skip fan-out for inactive users.",
        freq: "very-common",
      },
      {
        q: "How do you paginate a feed that changes constantly?",
        a: "Cursor-based pagination keyed by a time-sortable ID: `GET /timeline?max_id=<last post id seen>` returns posts strictly older than the cursor. New posts arriving at the top don't shift pages. For 'new posts since', use `since_id`. Offset pagination would duplicate or skip items as the list grows.",
        freq: "common",
      },
      {
        q: "How do you show a user their own post immediately if fan-out is async?",
        a: "Read-your-own-writes: on publish, synchronously insert the post into the author's own timeline (or have the client optimistically render it), and at read time merge the author's latest posts from the post store. Followers can tolerate seconds of delay; the author can't.",
        freq: "common",
      },
      {
        q: "How do you store the follower graph for fast fan-out?",
        a: "A follows table sharded by `follower_id` (\"whom do I follow\") and a second copy sharded by `followee_id` (\"who follows me\" — used for fan-out), kept consistent via events. Fan-out workers page through followers in chunks and process in parallel. Graph databases are unnecessary for one-hop queries at this scale; Twitter used FlockDB/MySQL, Meta uses TAO.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "The 'celebrity problem' refers to…",
        options: ["Slow image uploads", "Fan-out on write being too expensive for accounts with millions of followers", "Celebrities posting too often", "Cache penetration"],
        answer: 1,
        explain: "One post would create millions of timeline writes.",
      },
      {
        q: "Timelines in the cache typically store…",
        options: ["Full post JSON", "Post IDs only", "Images", "Follower lists"],
        answer: 1,
        explain: "IDs are small; hydrate from a shared post cache on read.",
      },
      {
        q: "Which consistency level is acceptable for followers' timelines?",
        options: ["Linearizable", "Eventual (seconds of delay is fine)", "Serializable", "None needed"],
        answer: 1,
        explain: "A slightly late post is acceptable; availability matters more.",
      },
      {
        q: "Snowflake IDs are useful here because they…",
        options: ["Are random", "Sort by creation time and are generated without coordination", "Are short", "Hide the author"],
        answer: 1,
        explain: "Timestamp-prefixed IDs make natural cursors.",
      },
    ],
  },

  // ------------------------------------------------------------------ CHAT
  {
    id: "case-chat",
    title: "Case Study: Chat System (WhatsApp/Slack)",
    tagline: "Persistent connections, message ordering, delivery receipts and offline users.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Real-time chat",
      nodes: [
        { id: "alice", label: "Alice", sub: "online", kind: "client", x: 80, y: 120 },
        { id: "bob", label: "Bob", sub: "online / offline", kind: "client", x: 80, y: 440 },
        { id: "gw1", label: "WS gateway 1", kind: "gateway", x: 300, y: 120 },
        { id: "gw2", label: "WS gateway 2", kind: "gateway", x: 300, y: 440 },
        { id: "chat", label: "Chat service", sub: "seq numbers", kind: "service", x: 520, y: 280 },
        { id: "store", label: "Message store", sub: "Cassandra", kind: "db", x: 760, y: 160 },
        { id: "reg", label: "Session registry", sub: "user → gateway", kind: "cache", x: 760, y: 400 },
        { id: "push", label: "Push service", sub: "APNs / FCM", kind: "external", x: 520, y: 500 },
      ],
      edges: [
        { from: "alice", to: "gw1", label: "WebSocket" },
        { from: "bob", to: "gw2", label: "WebSocket" },
        { from: "gw1", to: "chat" },
        { from: "chat", to: "store" },
        { from: "chat", to: "reg" },
        { from: "chat", to: "gw2", label: "route" },
        { from: "chat", to: "push" },
        { from: "push", to: "bob", dashed: true },
      ],
      flows: [
        {
          name: "Send (recipient online)",
          path: ["alice", "gw1", "chat", "store", "chat", "reg", "chat", "gw2", "bob"],
          steps: [
            "Alice sends {client_msg_id, conversation_id, text} over her open WebSocket.",
            "Her gateway forwards it to the chat service.",
            "Assign a per-conversation sequence number and persist (partition key = conversation_id).",
            "Ack to Alice → ✓ (sent). The client_msg_id makes retries idempotent.",
            "Where is Bob connected? Look up the session registry.",
            "Bob is on gateway 2.",
            "Forward the message to gateway 2 (direct RPC or pub/sub channel).",
            "Delivered over Bob's socket; Bob's client acks → ✓✓ (delivered) flows back to Alice.",
          ],
        },
        {
          name: "Send (recipient offline)",
          path: ["alice", "gw1", "chat", "store", "chat", "reg", "chat", "push", "bob"],
          steps: [
            "Alice sends a message.",
            "Forwarded to the chat service.",
            "Persisted with the next sequence number.",
            "Acked to Alice.",
            "Registry lookup…",
            "…no active session for Bob.",
            "Send a push notification instead.",
            "When Bob reconnects, his client syncs: 'give me messages after seq N' for each conversation.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: 1:1 and group chat, online/offline delivery, message history, delivery/read receipts, presence (online/last seen), media attachments, multi-device.
**Non-functional**: low latency (< 200–500 ms end-to-end), messages never lost, **ordered within a conversation**, high availability, huge connection counts.

## 2. Estimates
500M DAU × 40 messages/day = 20B messages/day ≈ **230K messages/s** average. 100 bytes each ≈ 2 TB/day. Concurrent connections: tens of millions → each gateway holds ~100K–1M WebSocket connections.

## 3. Connections
Clients keep a **persistent WebSocket** (or MQTT) connection to a **gateway** tier that only manages sockets. A **session registry** (Redis) maps \`user/device → gateway\`. Heartbeats detect dead connections; clients reconnect with backoff and resume.

## 4. Message flow and ordering
- The client generates a \`client_msg_id\` (UUID) → retries are deduplicated.
- The chat service assigns a **per-conversation sequence number** (monotonic counter per conversation, or Snowflake IDs + conversation partition) — the order everyone displays.
- Persist first, then ack the sender, then deliver.
- Receipts: sent (server persisted) → delivered (recipient device acked) → read.

## 5. Storage
Write-heavy, append-only, read by conversation and time → **wide-column store** (Cassandra/ScyllaDB/HBase): partition key \`conversation_id\` (+ time bucket for huge groups), clustering key \`seq\` descending. Discord moved billions of messages to Cassandra then ScyllaDB for exactly this pattern.

## 6. Offline users and sync
If the recipient has no live session → push notification (APNs/FCM). On reconnect the client sends its last seen \`seq\` per conversation and pulls everything newer. This **sync-by-cursor** design also handles multi-device and flaky networks.

## 7. Group chat
Small groups (≤ ~500): fan out to each member's gateway. Very large channels (Slack/Discord servers): store once, members pull or receive via pub/sub topics per channel; unread counts computed lazily.

## 8. Presence
Heartbeat every ~30 s into Redis with a TTL; presence changes are fanned out only to contacts who are online and interested (subscribe on chat open) — global presence fan-out is extremely expensive.

## 9. Security
End-to-end encryption (Signal protocol): the server routes ciphertext and can't read messages; keys live on devices. Multi-device complicates key management.
`,
    keyPoints: [
      "WebSocket gateways + a registry mapping users to gateways.",
      "Persist → ack sender → deliver; client_msg_id dedupes retries.",
      "Order by per-conversation sequence numbers.",
      "Wide-column store partitioned by conversation_id.",
      "Offline: push notification, then sync by last seen seq on reconnect.",
    ],
    interview: [
      {
        q: "How do you guarantee message ordering in a chat?",
        a: "Global ordering is unnecessary and expensive; users only need **order within a conversation**. Route all writes for a conversation through one logical sequencer (e.g. the conversation's partition leader, or an atomic counter keyed by conversation) that assigns increasing sequence numbers; persist with that seq; clients display by seq, not by arrival time or device clock. Messages that arrive out of order are buffered or inserted by seq.",
        freq: "very-common",
      },
      {
        q: "How do you make sure no message is lost if the network drops?",
        a: "At-least-once delivery with idempotency: the client retries until it receives a server ack; the `client_msg_id` lets the server dedupe. The server persists before acking. Delivery to recipients is tracked with acks; unacked messages are resent, and on reconnect the client syncs everything after its last seen sequence number. The durable message store, not the socket, is the source of truth.",
        freq: "very-common",
      },
      {
        q: "How does the server know which gateway a user is connected to?",
        a: "Gateways register `user_id/device_id → gateway_id` in a fast shared store (Redis) on connect, refreshed by heartbeats and removed on disconnect/TTL expiry. The chat service looks up recipients and forwards to the right gateway via RPC or per-gateway pub/sub channels. Consistent hashing of users to gateways is an alternative but complicates mobile reconnects.",
        freq: "common",
      },
      {
        q: "Why Cassandra (wide-column) for messages rather than Postgres?",
        a: "The workload is enormous append-only writes and reads of 'latest N messages in conversation X'. Cassandra's LSM storage gives high write throughput, partitions are distributed automatically by `conversation_id`, and clustering by seq makes 'latest N' a sequential read. Postgres works at smaller scale but needs manual sharding at billions of messages/day. Trade-off: no multi-row transactions or ad-hoc queries.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which connection type best supports server-pushed chat messages?",
        options: ["Short polling", "WebSocket", "SMTP", "FTP"],
        answer: 1,
        explain: "Persistent, bidirectional, low latency.",
      },
      {
        q: "A good partition key for the message table is…",
        options: ["sender_id", "message timestamp", "conversation_id", "random UUID"],
        answer: 2,
        explain: "Reads are 'messages in a conversation'.",
      },
      {
        q: "When the recipient is offline, the system…",
        options: ["Drops the message", "Stores it and sends a push notification; the client syncs on reconnect", "Retries the socket forever", "Emails the user"],
        answer: 1,
        explain: "Durable store + sync by cursor.",
      },
      {
        q: "client_msg_id is used to…",
        options: ["Encrypt the message", "Deduplicate retried sends", "Order messages globally", "Find the gateway"],
        answer: 1,
        explain: "The server ignores repeats of an already-stored id.",
      },
    ],
  },

  // ------------------------------------------------------------------ VIDEO
  {
    id: "case-video-streaming",
    title: "Case Study: Video Streaming (YouTube/Netflix)",
    tagline: "Upload, transcode, adaptive bitrate and the CDN that carries it all.",
    difficulty: "advanced",
    minutes: 18,
    caseStudy: true,
    diagram: {
      title: "Video upload and playback",
      nodes: [
        { id: "creator", label: "Creator", kind: "client", x: 80, y: 110 },
        { id: "upload", label: "Upload service", sub: "signed multipart", kind: "service", x: 290, y: 110 },
        { id: "raw", label: "Raw bucket", kind: "storage", x: 500, y: 50 },
        { id: "tq", label: "Transcode queue", kind: "queue", x: 500, y: 190 },
        { id: "tc", label: "Transcoders", sub: "240p → 4K, HLS", kind: "worker", x: 720, y: 190 },
        { id: "out", label: "Segments bucket", sub: "2–6 s chunks", kind: "storage", x: 900, y: 320 },
        { id: "meta", label: "Metadata DB", kind: "db", x: 500, y: 360 },
        { id: "api", label: "Video API", sub: "manifests", kind: "service", x: 290, y: 410 },
        { id: "viewer", label: "Viewer", kind: "client", x: 80, y: 410 },
        { id: "cdn", label: "CDN", kind: "cdn", x: 720, y: 500 },
      ],
      edges: [
        { from: "creator", to: "upload" },
        { from: "creator", to: "raw", label: "direct PUT", dashed: true },
        { from: "upload", to: "tq" },
        { from: "tq", to: "tc" },
        { from: "tc", to: "raw" },
        { from: "tc", to: "out" },
        { from: "tc", to: "meta" },
        { from: "viewer", to: "api" },
        { from: "api", to: "meta" },
        { from: "viewer", to: "cdn" },
        { from: "cdn", to: "out", label: "origin" },
      ],
      flows: [
        {
          name: "Upload & transcode",
          path: ["creator", "upload", "creator", "raw", "tc", "out", "tc", "meta"],
          steps: [
            "Creator asks to upload; the service creates a video record (status=UPLOADING) and returns pre-signed multipart URLs.",
            "The client uploads chunks in parallel directly…",
            "…to the raw bucket (resumable; the app never proxies gigabytes).",
            "Upload complete → a job is queued; transcoders fetch the raw file and split it into segments processed in parallel (a DAG of tasks).",
            "Each segment is encoded at multiple bitrates/resolutions and codecs (H.264, VP9, AV1) and packaged as HLS/DASH.",
            "When all renditions finish…",
            "…metadata is updated: status=READY, manifest URLs, thumbnails, duration.",
          ],
        },
        {
          name: "Playback (adaptive bitrate)",
          path: ["viewer", "api", "meta", "api", "viewer", "cdn", "out"],
          steps: [
            "Viewer opens a video; the API checks permissions and region rights.",
            "Fetch metadata and the master manifest URL.",
            "Return the manifest listing renditions (240p…4K).",
            "The player starts with a low bitrate for fast startup…",
            "…and requests 4-second segments from the nearest CDN edge, switching quality as measured bandwidth changes.",
            "Popular segments are almost always edge hits; misses go back to the origin bucket.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: upload videos, process them, stream to any device, search/recommendations (usually out of scope), view counts, comments.
**Non-functional**: smooth playback (fast start, minimal rebuffering), global scale, high availability for streaming, uploads can be processed asynchronously (minutes is fine), storage and bandwidth **cost** matter enormously.

## 2. Estimates
500 hours of video uploaded per minute (YouTube's public figure) → each hour stored in ~10 renditions. Viewing: billions of hours/day. **Egress bandwidth is the dominant cost** → CDN (often ISP-embedded caches like Netflix Open Connect).

## 3. Upload pipeline
1. Pre-signed **multipart** upload directly to object storage (resumable, parallel).
2. Event → **transcoding pipeline**: split the source into segments, transcode segments in **parallel** across many workers, then assemble. Model it as a DAG (inspect → split → encode × renditions → package → thumbnail → done).
3. Produce **adaptive bitrate** ladders: e.g. 240p/360p/480p/720p/1080p/4K × codecs, packaged as **HLS** (\`.m3u8\` + \`.ts/fMP4\`) or **DASH** (\`.mpd\`).
4. Update metadata status; notify the creator.

## 4. Playback
The player downloads a **manifest**, then fetches short segments (2–6 s) over plain HTTP from the CDN, choosing the bitrate per segment based on measured throughput and buffer level (**ABR**). Plain HTTP segments are what make CDN caching work so well.

## 5. Storage tiers
Hot (popular) content on CDN edges and SSD origins; long-tail videos in cheaper storage classes; raw originals archived. Popularity is extremely skewed — a small fraction of videos get most views.

## 6. Other deep dives
- **View counting** at scale: approximate/batched counters, dedupe per user-session, async aggregation via a stream.
- **Live streaming**: ingest (RTMP/SRT/WebRTC) → real-time transcoding → low-latency HLS/DASH chunks (latency vs stability trade-off).
- **DRM** and signed URLs for paid content.
- **Pre-positioning**: push tomorrow's popular titles to edge caches overnight (Netflix).
`,
    keyPoints: [
      "Upload directly to object storage with pre-signed multipart URLs.",
      "Transcode segments in parallel into an adaptive bitrate ladder.",
      "HLS/DASH = manifest + small HTTP segments → CDN-friendly.",
      "Players adapt bitrate per segment to bandwidth.",
      "Bandwidth/egress cost dominates → CDNs and storage tiering.",
    ],
    interview: [
      {
        q: "What is adaptive bitrate streaming and why does it matter?",
        a: "The video is encoded at several bitrates/resolutions and cut into short segments. The player downloads a manifest listing these renditions and, for each segment, picks the best quality its current bandwidth and buffer can sustain — dropping quality instead of stalling when the network degrades, and climbing back up when it improves. It enables fast start (begin low), smooth playback on mobile networks, and efficient CDN caching because segments are plain HTTP files.",
        freq: "very-common",
      },
      {
        q: "How would you speed up transcoding of a 2-hour 4K upload?",
        a: "Split the source into GOP-aligned chunks (e.g. 10–60 s), transcode chunks **in parallel** across many workers for each rendition, then concatenate/package. Prioritize the renditions needed for playback first (e.g. 360p/720p) so the video can go live early while 4K/AV1 finish later. Use a workflow engine/DAG with retries per chunk, spot instances for cost, and hardware encoders (GPUs/ASICs) where available.",
        freq: "common",
      },
      {
        q: "Where does most of the cost of a video platform go, and how do you reduce it?",
        a: "Bandwidth/egress (serving bytes) and storage of many renditions. Reduce with CDNs and **ISP-embedded caches** (Netflix Open Connect), better codecs (VP9/AV1 cut bits 30–50% at equal quality), per-title encoding ladders, storing rarely watched renditions in cold tiers or transcoding them on demand, and deleting unused renditions of long-tail content.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "HLS and DASH deliver video as…",
        options: ["One large file over UDP", "A manifest plus short HTTP segments", "WebSocket frames", "Peer-to-peer only"],
        answer: 1,
        explain: "Small HTTP files are easy to cache on CDNs.",
      },
      {
        q: "Transcoding should be…",
        options: ["Synchronous in the upload request", "Asynchronous and parallelized across segments", "Done in the browser", "Skipped"],
        answer: 1,
        explain: "It's slow and CPU-heavy; split and fan out.",
      },
      {
        q: "A player starts at low quality mainly to…",
        options: ["Save storage", "Minimize startup time", "Avoid DRM", "Reduce CDN cost"],
        answer: 1,
        explain: "Small first segments arrive fast; quality ramps up.",
      },
      {
        q: "The dominant operational cost for streaming is usually…",
        options: ["Database writes", "Egress bandwidth", "DNS queries", "Authentication"],
        answer: 1,
        explain: "Serving video bytes to viewers.",
      },
    ],
  },

  // ------------------------------------------------------------------ RIDE HAILING
  {
    id: "case-ride-hailing",
    title: "Case Study: Ride Hailing (Uber/Lyft)",
    tagline: "Millions of moving drivers, geospatial indexes and real-time matching.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Ride matching",
      nodes: [
        { id: "rider", label: "Rider app", kind: "client", x: 80, y: 130 },
        { id: "driver", label: "Driver app", kind: "client", x: 80, y: 430 },
        { id: "gw", label: "Gateway", sub: "HTTP + WebSocket", kind: "gateway", x: 280, y: 280 },
        { id: "loc", label: "Location service", sub: "pings every ~4 s", kind: "service", x: 500, y: 430 },
        { id: "geo", label: "Geo index", sub: "H3 / geohash cells", kind: "cache", x: 740, y: 430 },
        { id: "match", label: "Matching", sub: "dispatch", kind: "service", x: 500, y: 130 },
        { id: "price", label: "Pricing", sub: "ETA + surge", kind: "service", x: 740, y: 60 },
        { id: "trip", label: "Trip service", sub: "state machine", kind: "service", x: 740, y: 250 },
        { id: "db", label: "Trips DB", kind: "db", x: 920, y: 250 },
      ],
      edges: [
        { from: "rider", to: "gw" },
        { from: "driver", to: "gw" },
        { from: "gw", to: "loc" },
        { from: "loc", to: "geo" },
        { from: "gw", to: "match" },
        { from: "match", to: "geo", label: "nearby drivers" },
        { from: "match", to: "price" },
        { from: "match", to: "trip" },
        { from: "trip", to: "db" },
      ],
      flows: [
        {
          name: "Driver location update",
          path: ["driver", "gw", "loc", "geo"],
          steps: [
            "Each online driver sends (lat, lng, heading, status) every ~4 seconds over a persistent connection.",
            "The gateway forwards to the location service (≈ 1M+ updates/second globally).",
            "Convert the point to an H3/geohash cell and update the in-memory index: cell → set of available drivers (with TTL). Old cell membership is removed.",
          ],
        },
        {
          name: "Request a ride",
          path: ["rider", "gw", "match", "price", "match", "geo", "match", "trip", "db", "trip", "match", "gw", "driver"],
          steps: [
            "Rider requests a ride from A to B.",
            "Routed to the matching service for the rider's region (city-sharded).",
            "Quote: ETA and price, including surge for this area's supply/demand.",
            "Rider confirms the price.",
            "Query the rider's cell plus neighbouring rings for available drivers.",
            "Rank candidates by ETA on the road network (not straight-line distance), rating, acceptance rate.",
            "Create the trip (state REQUESTED) with an idempotency key.",
            "Persist it.",
            "Trip saved.",
            "Offer the trip to the best driver (lock them for ~10 s so two riders can't grab the same driver).",
            "Through the gateway…",
            "…push the offer to the driver's app. Accept → state ACCEPTED; timeout/decline → offer the next driver.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: riders request rides and see nearby cars; drivers share location and accept trips; match riders to drivers; ETAs and pricing; trip lifecycle; payments (often out of scope).
**Non-functional**: matching within seconds, location freshness (seconds), high availability in each city, **no double-booking** of a driver, scale to millions of concurrent drivers.

## 2. Estimates
5M active drivers × 1 update / 4 s ≈ **1.25M location writes/s** — overwrites of ephemeral data, so keep it **in memory**, not in a relational DB. Ride requests: ~20M/day ≈ 230/s average with sharp peaks (concerts, rain).

## 3. Geospatial indexing — the core deep dive
"Find available drivers within 2 km" can't be a table scan.
- **Geohash**: interleave lat/lng bits into a string; shared prefix ≈ nearby. Simple, works with key-value stores; edge effects near cell boundaries → also query neighbouring cells.
- **Quadtree**: recursively split space where density is high; good for uneven density; harder to update with constantly moving points.
- **H3 (Uber)**: hexagonal hierarchical cells — uniform neighbour distances, easy "k rings" around a cell.
- **Redis GEO** (geohash in a sorted set) or in-memory sharded indexes keyed by cell.

Updates: on each ping, move the driver between cells if needed; entries expire if pings stop.

## 4. Matching and consistency
- Candidates from nearby cells → rank by **road-network ETA** (routing engine), not crow-flies distance.
- **Prevent double dispatch**: atomically reserve the driver (compare-and-set on driver state, or a short lease/lock) before offering; release on decline/timeout.
- **Trip state machine**: REQUESTED → ACCEPTED → ARRIVED → IN_PROGRESS → COMPLETED / CANCELLED, persisted durably; transitions are idempotent.

## 5. Sharding by geography
Partition matching and location services **by city/region** — riders and drivers interact locally, so most operations stay within one shard; hot cities get more capacity. Uber's Ringpop used consistent hashing over cells.

## 6. More deep dives
- **Surge pricing**: per-cell supply/demand computed in near real time from location + request streams.
- **ETA service**: routing on a road graph with live traffic (contraction hierarchies, ML corrections).
- **Reliability**: if a region's DB is down, trips in progress must continue — keep trip state replicated; clients cache state.
- **Location history** for receipts/safety: stream pings to Kafka → cheap storage, not the hot index.
`,
    keyPoints: [
      "Driver locations are high-volume, ephemeral → in-memory geo index.",
      "Geohash / quadtree / H3 cells; always search neighbouring cells too.",
      "Rank by road ETA, not straight-line distance.",
      "Atomically reserve a driver to prevent double dispatch.",
      "Shard by city/region — interactions are local.",
    ],
    interview: [
      {
        q: "How do you find nearby drivers efficiently?",
        a: "Index drivers by spatial cell: geohash prefix, quadtree node or H3 hexagon. Keep `cell → set(driver_id)` in memory (Redis GEO or a sharded in-memory service), updated on each location ping and expired when pings stop. For a query, compute the rider's cell and its neighbours (to handle boundary effects), gather candidates, then filter by exact distance and rank by road ETA. Lookup cost depends on candidates in a few cells, not on the total number of drivers.",
        freq: "very-common",
      },
      {
        q: "Geohash vs quadtree?",
        a: "**Geohash** encodes a fixed grid into strings — trivial to store in any KV/sorted store and shard by prefix, but cells are uniform regardless of density and neighbours across prefix boundaries need extra lookups. **Quadtrees** adapt cell size to density (dense downtown split finely, rural areas coarse) and support k-nearest queries well, but rebalancing with millions of moving points is complex. Uber's **H3** hexagons add uniform adjacency. With constantly moving drivers, a fixed grid (geohash/H3) is usually simpler to update.",
        freq: "common",
      },
      {
        q: "How do you avoid assigning the same driver to two riders?",
        a: "Make the driver's availability a single source of truth with an atomic transition: `UPDATE drivers SET state='OFFERED', trip_id=X WHERE id=D AND state='AVAILABLE'` (or Redis SETNX/Lua, or the driver's owning shard serializes offers). Only the winner proceeds; others pick the next candidate. Offers carry a lease timeout so declined/ignored offers release the driver.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Where should high-frequency driver location updates live?",
        options: ["A normalized SQL table with fsync per write", "An in-memory geospatial index (plus async history log)", "Object storage", "The CDN"],
        answer: 1,
        explain: "They're ephemeral, overwritten every few seconds and read by locality.",
      },
      {
        q: "Why query neighbouring geohash cells?",
        options: ["To double-check results", "A nearby driver may sit just across a cell boundary", "Geohash requires it", "To compute surge"],
        answer: 1,
        explain: "Proximity doesn't respect cell edges.",
      },
      {
        q: "A sensible top-level shard key for matching is…",
        options: ["rider_id", "city / region", "trip_id", "driver rating"],
        answer: 1,
        explain: "Riders and drivers interact locally.",
      },
      {
        q: "Candidates should be ranked by…",
        options: ["Straight-line distance", "Road-network ETA", "Driver ID", "Random"],
        answer: 1,
        explain: "A driver 500 m away across a river may be 15 minutes away.",
      },
    ],
  },

  // ------------------------------------------------------------------ PAYMENTS
  {
    id: "case-payments",
    title: "Case Study: Payment System",
    tagline: "Idempotency, double-entry ledgers and never charging twice.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Payment processing",
      nodes: [
        { id: "client", label: "Checkout", kind: "client", x: 80, y: 280 },
        { id: "api", label: "Payment API", sub: "Idempotency-Key", kind: "gateway", x: 280, y: 280 },
        { id: "idem", label: "Idempotency store", kind: "db", x: 280, y: 80 },
        { id: "svc", label: "Payment service", sub: "state machine", kind: "service", x: 500, y: 280 },
        { id: "risk", label: "Risk engine", sub: "fraud scoring", kind: "service", x: 500, y: 80 },
        { id: "psp", label: "Card network / PSP", kind: "external", x: 760, y: 80 },
        { id: "ledger", label: "Ledger", sub: "double-entry", kind: "db", x: 760, y: 280 },
        { id: "outbox", label: "Outbox → Kafka", kind: "queue", x: 500, y: 470 },
        { id: "recon", label: "Reconciliation", sub: "daily vs PSP files", kind: "worker", x: 760, y: 470 },
      ],
      edges: [
        { from: "client", to: "api" },
        { from: "api", to: "idem" },
        { from: "api", to: "svc" },
        { from: "svc", to: "risk" },
        { from: "svc", to: "psp", label: "authorize / capture" },
        { from: "svc", to: "ledger" },
        { from: "svc", to: "outbox" },
        { from: "outbox", to: "recon" },
        { from: "recon", to: "psp", dashed: true },
        { from: "recon", to: "ledger", dashed: true },
      ],
      flows: [
        {
          name: "Charge a card",
          path: ["client", "api", "idem", "api", "svc", "risk", "svc", "psp", "svc", "ledger", "svc", "outbox"],
          steps: [
            "POST /payments {amount: 4999, currency: 'USD', card_token} with Idempotency-Key: 7f3a….",
            "Atomically claim the key. New → continue. Seen before → return the stored result (no second charge).",
            "Key claimed with status IN_PROGRESS.",
            "Create a payment record: state CREATED. Amounts are integers in minor units — never floats.",
            "Score the transaction for fraud (velocity, device, amount, geography).",
            "Approved by risk.",
            "Authorize with the PSP, passing OUR idempotency key so their side dedupes retries too. Use a timeout.",
            "AUTHORIZED. If the call timed out, the state is UNKNOWN — query the PSP later rather than retrying blindly.",
            "Write balanced ledger entries: debit customer receivable, credit merchant payable — append-only, sum to zero.",
            "Commit payment state + ledger + outbox event in one DB transaction.",
            "The outbox relay publishes PaymentSucceeded to Kafka for fulfilment, emails and analytics.",
          ],
        },
        {
          name: "Client retry after timeout",
          path: ["client", "api", "idem", "api", "client"],
          steps: [
            "The client's request timed out (but the charge may have succeeded!). It retries with the SAME Idempotency-Key.",
            "Look up the key.",
            "Found with a stored response → no new charge.",
            "Return the original result. Charged exactly once.",
          ],
        },
        {
          name: "Reconciliation",
          path: ["outbox", "recon", "psp", "recon", "ledger"],
          steps: [
            "Settled payment events accumulate.",
            "Daily, reconciliation pulls the PSP's settlement report…",
            "…and compares every transaction and fee with our records.",
            "Mismatches (missing, duplicated, wrong amounts) are flagged for automatic fixes or human review. Money systems trust, but verify.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: accept payments (cards, wallets), refunds, payouts to merchants, payment status, receipts.
**Non-functional**: **correctness above all** — never lose or double-charge money; strong consistency for balances; auditability (every cent traceable); high availability; PCI-DSS compliance (never store raw card numbers — use the PSP's tokens).

## 2. Idempotency end to end
Networks fail *after* the money moved. Every write is retried, so every write must be idempotent:
- Clients send an **Idempotency-Key**; the server stores key → result atomically with the operation.
- Pass a deterministic idempotency key to the **PSP** too, so retries to the card network don't double-charge.
- Consumers of payment events dedupe by event id.

## 3. Payment state machine
\`CREATED → AUTHORIZED → CAPTURED → SETTLED\`, with \`FAILED\`, \`CANCELLED\`, \`REFUNDED\`, and crucially **\`UNKNOWN\`** when a PSP call times out. Never assume failure on a timeout — reconcile by querying the PSP (by your idempotency key) before retrying.

## 4. Double-entry ledger
Every movement is recorded as entries that **sum to zero**: debit one account, credit another. The ledger is **append-only** (corrections are new reversing entries, never updates), so balances are derived and auditable. Store money as **integer minor units** (cents) with a currency code — floating point loses cents.

## 5. Consistency across services
Charging the card (external), updating the ledger and emitting events can't share one transaction:
- Use the **transactional outbox** for events.
- Use **sagas** for multi-step flows (reserve inventory → charge → ship; compensate with refund/release on failure).
- **Reconciliation** jobs compare internal records with PSP settlement files daily; discrepancies are expected and must be handled.

## 6. Other deep dives
- **Exactly-once effects** = at-least-once + idempotency + reconciliation.
- **Retries** with exponential backoff and jitter; distinguish retryable (timeouts, 5xx) from non-retryable (card declined) errors.
- **Fraud/risk** scoring synchronous for authorization, ML-based, with manual review queues.
- **Multi-currency / FX**, **payouts** batching, **webhooks** from PSPs (verify signatures, handle out-of-order and duplicate deliveries).
- **Security**: tokenization, encryption, least-privilege, audit logs.
`,
    keyPoints: [
      "Idempotency keys at every hop — including toward the PSP.",
      "Timeouts mean UNKNOWN, not failed: reconcile before retrying.",
      "Double-entry, append-only ledger; integer minor units.",
      "Outbox for events; sagas for multi-step flows.",
      "Daily reconciliation against the PSP catches what code misses.",
    ],
    interview: [
      {
        q: "How do you guarantee a customer is never charged twice?",
        a: "Layered defence: (1) the client sends an **Idempotency-Key** and the API stores key → outcome atomically, returning the stored result on retries; (2) the payment service passes a deterministic idempotency key to the PSP so their side dedupes; (3) timeouts move the payment to UNKNOWN and a resolver queries the PSP instead of re-charging; (4) unique constraints on (merchant, order_id); (5) daily reconciliation against PSP settlement reports to detect and refund any duplicates.",
        freq: "very-common",
      },
      {
        q: "What is a double-entry ledger and why use it?",
        a: "Every financial event is recorded as at least two entries (debits and credits) across accounts that sum to zero — money is moved, never created or destroyed. Entries are immutable and append-only; balances are sums of entries; mistakes are fixed with compensating entries. This gives a full audit trail, makes invariants checkable (total of all accounts = 0) and is how accountants and banks have worked for centuries.",
        freq: "very-common",
      },
      {
        q: "The call to the payment provider times out. What do you do?",
        a: "Don't assume it failed and don't blindly retry with a new request. Mark the payment **UNKNOWN**, then either retry **with the same idempotency key** (safe if the PSP supports idempotency) or query the PSP for the transaction status. Resolve via webhook or a background poller with backoff. Show the user a 'processing' state rather than an error. Reconciliation catches any remaining inconsistencies.",
        freq: "common",
      },
      {
        q: "Why should money never be stored as a float?",
        a: "Binary floating point can't represent most decimal fractions exactly (0.1 + 0.2 ≠ 0.3), so rounding errors accumulate across millions of transactions. Store integer minor units (cents) with a currency code (and know which currencies have 0 or 3 decimal places), or use a decimal type with fixed precision.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "A PSP request times out. The payment's state should become…",
        options: ["FAILED", "SUCCEEDED", "UNKNOWN until reconciled", "Deleted"],
        answer: 2,
        explain: "The charge may have succeeded; verify before acting.",
      },
      {
        q: "Ledger entries for one transaction must…",
        options: ["Be updated in place", "Sum to zero (debits = credits)", "Use floats", "Be stored in the cache"],
        answer: 1,
        explain: "Double-entry bookkeeping keeps money conserved.",
      },
      {
        q: "To publish 'PaymentSucceeded' reliably after committing, use…",
        options: ["A fire-and-forget HTTP call", "The transactional outbox pattern", "A cron job that guesses", "Two-phase commit with Kafka"],
        answer: 1,
        explain: "Event row in the same transaction, relayed afterwards.",
      },
      {
        q: "$49.99 should be stored as…",
        options: ["49.99 (float)", "4999 (integer cents) + currency", "'49.99' string only", "50"],
        answer: 1,
        explain: "Integers in minor units avoid rounding errors.",
      },
    ],
  },

  // ------------------------------------------------------------------ AUTOCOMPLETE
  {
    id: "case-autocomplete",
    title: "Case Study: Search Autocomplete",
    tagline: "Top-k suggestions per prefix in milliseconds, rebuilt from query logs.",
    difficulty: "intermediate",
    minutes: 15,
    caseStudy: true,
    visualizers: ["trie"],
    diagram: {
      title: "Typeahead suggestions",
      nodes: [
        { id: "box", label: "Search box", sub: "debounced", kind: "client", x: 80, y: 220 },
        { id: "edge", label: "CDN / edge cache", sub: "hot prefixes", kind: "cdn", x: 300, y: 220 },
        { id: "api", label: "Suggest API", kind: "service", x: 520, y: 220 },
        { id: "trie", label: "Trie servers", sub: "top-k per node", kind: "search", x: 760, y: 220 },
        { id: "logs", label: "Query log", sub: "Kafka", kind: "queue", x: 520, y: 450 },
        { id: "agg", label: "Aggregator", sub: "counts, decay", kind: "worker", x: 760, y: 450 },
        { id: "snap", label: "Trie snapshots", kind: "storage", x: 920, y: 330 },
      ],
      edges: [
        { from: "box", to: "edge" },
        { from: "edge", to: "api", label: "miss" },
        { from: "api", to: "trie" },
        { from: "box", to: "logs", label: "searches", dashed: true },
        { from: "logs", to: "agg" },
        { from: "agg", to: "snap" },
        { from: "snap", to: "trie", label: "load" },
      ],
      flows: [
        {
          name: "Type a prefix",
          path: ["box", "edge", "api", "trie", "api", "edge", "box"],
          steps: [
            "User types 'sys' — the client debounces (~100–150 ms) and caches earlier prefixes locally.",
            "Very common prefixes are answered by the edge cache with a short TTL.",
            "Miss → the suggest API routes by prefix to the right trie shard.",
            "Walk 3 nodes and return the top-k list precomputed at that node: O(prefix length).",
            "Response: ['system design', 'systemctl', 'sysadmin', …].",
            "Cached at the edge for other users typing the same prefix, and rendered in under ~50 ms end to end.",
          ],
        },
        {
          name: "Learn from searches",
          path: ["box", "logs", "agg", "snap", "trie"],
          steps: [
            "Completed searches (not every keystroke) are logged asynchronously.",
            "A streaming/batch job aggregates counts with time decay so trends rise and fade.",
            "Periodically build a new trie with top-k lists at each node and write a snapshot.",
            "Trie servers load the new snapshot and swap atomically — no locks on the read path.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
Return the top 5–10 suggestions for a prefix as the user types; ranked by popularity (and possibly personalization, freshness, safety filtering); **< 100 ms** end to end; very high QPS (every keystroke); suggestions can lag reality by minutes to hours.

## 2. Estimates
10M DAU × 10 searches × ~6 keystrokes after debouncing ≈ 600M requests/day ≈ **7K QPS** avg, 20K+ peak. Distinct queries: hundreds of millions, but suggestions only need the popular head.

## 3. Data structure: trie with top-k at each node
A naive trie answers "all words with this prefix" by DFS — too slow for short prefixes like "a". Instead **precompute and store the top-k completions at every node**. Query = walk the prefix (O(L)) and return the cached list. Memory grows, but you can cap depth, prune rare queries and store query IDs rather than strings.

## 4. Build pipeline (offline / near-line)
Logs of completed searches → aggregation (count per query over a window with time decay) → build trie → compute top-k bottom-up (a node's top-k is the best of its children's top-k plus itself) → snapshot → servers load and atomically swap. Updates every few minutes to hours; trending queries can be blended in from a separate real-time counter.

## 5. Serving at scale
- **Shard** by prefix (first 1–2 characters, weighted by traffic) or replicate the whole trie if it fits in memory.
- **Cache** results for hot prefixes at the CDN edge and in the client (typing "s", "sy", "sys" — earlier responses can filter locally).
- **Debounce** keystrokes and cancel in-flight requests for stale prefixes.

## 6. Extras
Personalization (blend global with user history), multi-language, spell correction (edit distance / n-gram), filtering offensive or legally sensitive suggestions, and A/B testing ranking.
`,
    keyPoints: [
      "Store top-k completions at every trie node → O(prefix) queries.",
      "Rebuild offline from logs with time-decayed counts; swap snapshots.",
      "Cache hot prefixes at the edge and client; debounce keystrokes.",
      "Shard by prefix weighted by traffic.",
      "Suggestions can be minutes stale — optimize the read path.",
    ],
    interview: [
      {
        q: "Why store top-k results at each trie node?",
        a: "Without it, a query for a short prefix must traverse a huge subtree to find the most popular completions — far too slow at keystroke QPS. Precomputing the top-k at every node turns each query into a walk of L characters plus returning a stored list: O(L). The cost is memory and a rebuild step, which is acceptable because popularity changes slowly relative to read volume.",
        freq: "very-common",
      },
      {
        q: "How do you keep suggestions fresh with trending topics?",
        a: "Two layers: the bulk trie rebuilt periodically from aggregated logs (hourly/daily, with exponential time decay so old popularity fades), plus a **real-time** stream job (e.g. Flink) counting recent queries in sliding windows; at query time blend the trie's top-k with trending candidates matching the prefix. Swap new trie snapshots atomically (build offline, load, flip a pointer).",
        freq: "common",
      },
      {
        q: "How would you reduce load from every keystroke?",
        a: "Client-side debouncing and request cancellation, client caching of previous prefixes, CDN/edge caching of popular prefixes (short TTL), returning results for the next few likely characters, and only sending a request after 1–2 characters. Server side, keep the trie in memory and replicate it widely since reads dominate.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "With top-k stored per node, a query for prefix of length L costs…",
        options: ["O(N) words", "O(L)", "O(L log N)", "O(k · N)"],
        answer: 1,
        explain: "Walk L nodes, return the cached list.",
      },
      {
        q: "How is the trie usually updated?",
        options: ["On every keystroke synchronously", "Rebuilt periodically from aggregated logs and swapped in", "Never", "By the client"],
        answer: 1,
        explain: "Batch rebuilds keep the read path lock-free.",
      },
      {
        q: "Client-side debouncing means…",
        options: ["Retrying failed requests", "Waiting briefly after typing stops before sending a request", "Compressing responses", "Encrypting queries"],
        answer: 1,
        explain: "Fewer requests for intermediate prefixes.",
      },
    ],
  },
];
