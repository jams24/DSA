import type { Challenge } from "./types";

export const BACKEND: Challenge[] = [
  {
    slug: "url-shortener-api",
    title: "URL shortener API",
    track: "backend",
    difficulty: "Medium",
    frequency: "Very common",
    format: "Live or take-home",
    time: "60–90 min",
    summary: "POST a long URL, get a short code back; GET the code to redirect. Add hit stats and a per-client rate limit.",
    prompt: `Build a small HTTP service that shortens URLs.

- \`POST /shorten\` with \`{"url": "https://...", "alias"?: "promo"}\` returns \`{"code", "short_url"}\`.
- \`GET /{code}\` redirects to the original URL and counts the hit.
- \`GET /stats/{code}\` returns the URL and its hit count.
- Each client may create at most 10 links per minute.

Keep everything in memory, but structure it so a database could replace the maps later.`,
    requirements: [
      "Only absolute http(s) URLs are accepted (400 otherwise)",
      "Codes are short, URL-safe, and unpredictable; collisions are handled",
      "Shortening the same URL twice returns the same code (200, not 201)",
      "Custom alias: validated, and 409 if already taken",
      "Redirect with 302 and count the hit; unknown codes return 404",
      "Rate limit creates per client: 429 with a Retry-After header",
    ],
    graded: [
      "Correct status codes (201 vs 200, 302, 400, 404, 409, 429)",
      "Input validation at the boundary",
      "Thread safety of the shared maps",
      "How you'd scale it: ID generation, storage, caching hot codes",
      "Tests that cover the edge cases, not just the happy path",
    ],
    approach: [
      "Two maps: code → {url, hits} for redirects, and url → code so repeat requests are idempotent.",
      "Generate a 7-character code from a 62-symbol alphabet with a cryptographic RNG (62⁷ ≈ 3.5 trillion), and retry on the rare collision.",
      "A sliding-window log per client IP (timestamps in the last 60 s) enforces the create limit.",
      "Validate the URL with a real parser, not a regex: check scheme ∈ {http, https} and a non-empty host.",
      "Keep handlers thin: parse → validate → call a small service → map the result to a status code.",
    ],
    edgeCases: [
      "Alias that collides with a generated code, or with a route such as 'stats'",
      "javascript: or ftp: URLs, and URLs with no host",
      "Two concurrent creates of the same URL",
      "Client behind a proxy: req.ip is the proxy unless you trust X-Forwarded-For",
    ],
    followUps: [
      "Scale to billions of links: base62 of a distributed counter (or Snowflake IDs) vs random codes",
      "301 vs 302: a permanent redirect is cached by browsers, so you lose hit counts",
      "Put a cache (Redis) in front of the code → URL lookup; reads vastly outnumber writes",
      "Expiring links, and deleting links that point at malware",
    ],
    solutions: [
      { stack: "Python", label: "FastAPI", lang: "python", file: "url-shortener/fastapi_app.py", run: "python-deps", test: "url-shortener/fastapi_check.py" },
      { stack: "JavaScript", label: "Node + Express", lang: "javascript", file: "url-shortener/express.js", run: "node-deps", test: "url-shortener/express_check.js" },
      { stack: "Go", label: "Go net/http", lang: "go", file: "url-shortener/server.go", run: "go", test: "url-shortener/server_check.go" },
      {
        stack: "Java",
        label: "Spring Boot",
        lang: "java",
        file: "url-shortener/SpringBoot.java",
        notes: "Needs a Spring Boot 3 project (spring-boot-starter-web), so it is not executed by the test runner. It mirrors the tested versions.",
      },
    ],
  },
  {
    slug: "rate-limiter",
    title: "Rate limiter",
    track: "backend",
    difficulty: "Medium",
    frequency: "Very common",
    format: "Live coding",
    time: "45 min",
    summary: "allowRequest(clientId): at most K requests per T seconds. Then a token bucket, then HTTP middleware.",
    prompt: `Implement \`allow(client_id) -> bool\` that permits at most **K = 3** requests per **T = 10** seconds for each client.

Then discuss the trade-offs of other algorithms and wire one into an HTTP server as middleware that answers **429 Too Many Requests**.`,
    requirements: [
      "Clients are limited independently",
      "The window slides: a request is counted for exactly T seconds",
      "O(1) amortized per call",
      "Safe to call from many threads at once",
      "Testable without sleeping: inject the clock",
    ],
    graded: [
      "Picking an algorithm and naming its trade-offs",
      "Correct boundary behavior (a request exactly T seconds old has expired)",
      "Concurrency: the check and the record must be one atomic step",
      "Injectable clock for deterministic tests",
    ],
    approach: [
      "Sliding-window log: a deque of timestamps per client. Pop from the front while older than T, allow if fewer than K remain, then append. Exact, but stores up to K timestamps per client.",
      "Token bucket: store (tokens, last_refill). On each call add elapsed × rate tokens (capped at capacity) and spend one. O(1) memory and allows short bursts.",
      "Sliding-window counter: keep only this window's and the previous window's counts, and weight the previous one by how much of it still overlaps. Approximate, O(1), easy in Redis.",
      "Fixed window (one counter per minute) is the simplest, but allows 2K requests across a window boundary.",
      "For HTTP, key by client (IP, API key or user id), and return 429 with Retry-After and RateLimit-* headers.",
    ],
    edgeCases: [
      "Request exactly at the window boundary (>= T has expired)",
      "Memory growth from millions of one-off clients: evict idle keys",
      "Clock going backwards: use a monotonic clock",
      "Several app servers: per-process state no longer works",
    ],
    followUps: [
      "Distributed limiter: Redis INCR + EXPIRE, or a Lua script for an atomic token bucket",
      "Different limits per plan (free vs paid) and per endpoint",
      "Where to enforce it: API gateway vs application vs both",
    ],
    solutions: [
      { stack: "Python", label: "Python (sliding log + token bucket)", lang: "python", file: "rate-limiter/limiter.py", run: "python", test: "rate-limiter/limiter_check.py" },
      { stack: "Java", label: "Java (thread-safe)", lang: "java", file: "rate-limiter/RateLimiter.java", run: "java", test: "rate-limiter/RateLimiterMain.java" },
      { stack: "Go", label: "Go middleware", lang: "go", file: "rate-limiter/middleware.go", run: "go", test: "rate-limiter/middleware_check.go" },
      { stack: "JavaScript", label: "Express middleware", lang: "javascript", file: "rate-limiter/middleware.js", run: "node", test: "rate-limiter/middleware_check.js" },
    ],
  },
  {
    slug: "rest-crud-api",
    title: "REST CRUD API with validation and pagination",
    track: "backend",
    difficulty: "Easy",
    frequency: "Very common",
    format: "Take-home",
    time: "2–4 h",
    summary: "The classic take-home: a Books resource with create, list, read, update, delete, validation and cursor pagination.",
    prompt: `Build a REST API for a \`books\` resource (\`title\`, \`author\`, \`year\`, \`tags\`).

- \`POST /books\`, \`GET /books\`, \`GET /books/{id}\`, \`PATCH /books/{id}\`, \`DELETE /books/{id}\`
- \`GET /books\` supports \`?limit=\`, \`?cursor=\` and \`?author=\`.
- Return sensible status codes and error bodies.`,
    requirements: [
      "201 + Location header on create; 204 on delete; 404 for missing ids",
      "Validation errors return 422 (or 400) with a readable message per field",
      "PATCH changes only the fields that were sent",
      "Cursor pagination with a next_cursor that is null on the last page",
      "Unknown fields and malformed JSON are rejected",
    ],
    graded: [
      "REST conventions: nouns, methods, status codes",
      "Validation at the edge, not scattered through the code",
      "Pagination that stays correct while rows are inserted or deleted",
      "Project structure, a README, and tests",
    ],
    approach: [
      "Define the schema once (Pydantic model, or a zod/hand-written validator) and use it for create; a version with every field optional for PATCH.",
      "Keyset pagination: sort by id, return rows with id > cursor, and encode the last id as an opaque base64 cursor.",
      "Fetch limit + 1 rows: if you get the extra one, there is a next page.",
      "Centralize errors: one handler maps not-found and validation errors to JSON responses.",
    ],
    edgeCases: [
      "limit=0, limit=10000 or a negative limit",
      "A tampered or garbage cursor",
      "PATCH with an empty body, or with an invalid value for one field",
      "Deleting the same id twice",
    ],
    followUps: [
      "Offset vs cursor pagination: OFFSET 100000 scans and skips 100k rows, and shifts when rows are inserted",
      "Optimistic concurrency with ETag / If-Match",
      "Swap the in-memory map for Postgres: repository layer, migrations, transactions",
    ],
    solutions: [
      { stack: "Python", label: "FastAPI + Pydantic", lang: "python", file: "crud-api/fastapi_app.py", run: "python-deps", test: "crud-api/fastapi_check.py" },
      { stack: "JavaScript", label: "Node + Express", lang: "javascript", file: "crud-api/express.js", run: "node-deps", test: "crud-api/express_check.js" },
    ],
  },
  {
    slug: "idempotent-payments",
    title: "Idempotent payments endpoint",
    track: "backend",
    difficulty: "Hard",
    frequency: "Common",
    format: "Live or take-home",
    time: "60 min",
    summary: "POST /payments with an Idempotency-Key: a retried request must never charge the card twice.",
    prompt: `Clients call \`POST /payments\` with \`{"amount", "currency"}\` and an \`Idempotency-Key\` header.
Networks fail, so clients retry. Make sure a retried request **never** charges twice, and returns the same response as the first attempt.`,
    requirements: [
      "Same key + same body → replay the stored response, without charging again",
      "Same key + different body → 422",
      "Same key while the first request is still running → 409",
      "A failure that definitely didn't charge releases the key so the client can retry",
      "Keys expire after 24 h",
    ],
    graded: [
      "Atomic check-and-claim of the key (the race is the whole point)",
      "Fingerprinting the request body",
      "Thinking about partial failure: what if the charge succeeded but saving the result failed?",
      "Money as integer minor units, never floats",
    ],
    approach: [
      "Store key → {fingerprint, state, response}. Claim the key as in_progress *before* the side effect.",
      "The claim must be atomic: a lock in-process, or INSERT … ON CONFLICT DO NOTHING / a unique index in a database.",
      "On success store the response; a replay returns it with an Idempotent-Replayed header.",
      "Fingerprint = hash of the canonical request body, so a reused key with a different amount is caught.",
    ],
    edgeCases: [
      "Two identical requests arriving at the same millisecond",
      "Processor timeout: the charge may or may not have happened, so reconcile instead of releasing the key",
      "Server crash between charging and saving the response",
    ],
    followUps: [
      "How Stripe does it: keys scoped per account, kept for 24 h",
      "Outbox pattern so the payment row and the event are written in one transaction",
      "Exactly-once is impossible over a network; at-least-once delivery plus idempotency gives the same effect",
    ],
    solutions: [
      { stack: "JavaScript", label: "Node + Express", lang: "javascript", file: "idempotent-payments/express.js", run: "node-deps", test: "idempotent-payments/express_check.js" },
      { stack: "Python", label: "FastAPI (async)", lang: "python", file: "idempotent-payments/fastapi_app.py", run: "python-deps", test: "idempotent-payments/fastapi_check.py" },
    ],
  },
  {
    slug: "resilient-api-client",
    title: "Resilient API client: retries, backoff, pagination",
    track: "backend",
    difficulty: "Medium",
    frequency: "Very common",
    format: "Live coding",
    time: "45–60 min",
    summary: "Fetch every page of a flaky third-party API, with timeouts, retries, exponential backoff and Retry-After.",
    prompt: `A partner API returns \`GET /items?page=N\` → \`{"items": [...], "next_page": N+1 | null}\`.
It sometimes times out, returns 503, or rate-limits you with **429 + Retry-After**.

Write a client that returns all items, retrying only what is worth retrying.`,
    requirements: [
      "A timeout on every request",
      "Retry network errors, timeouts, 408, 429 and 5xx, up to 4 attempts",
      "Exponential backoff with jitter; honor Retry-After when present",
      "Do not retry other 4xx errors (they will fail again)",
      "Follow pagination until next_page is null",
    ],
    graded: [
      "Which errors are retryable, and why",
      "Jitter, so many clients don't retry in lockstep",
      "Testability: inject the sleep function and a fake transport",
      "Clean separation between retry policy and pagination",
    ],
    approach: [
      "Loop over attempts. On success return; on a non-retryable status fail fast; otherwise sleep and try again.",
      "Backoff: random(0, min(cap, base × 2^attempt)), known as full jitter.",
      "If the server sent Retry-After (in seconds), wait that long instead, with a sane upper bound.",
      "Pagination is a plain loop on top of the retrying GET, or an async generator so callers can stop early.",
    ],
    edgeCases: [
      "Retry-After given as an HTTP date instead of seconds",
      "A POST is not safe to retry unless it is idempotent",
      "Cancellation: stop retrying when the caller gives up (context / AbortSignal)",
      "Huge responses: cap the body size you read",
    ],
    followUps: [
      "Circuit breaker: stop calling a dependency that keeps failing",
      "Retry budgets, so retries can't multiply load during an outage",
      "Concurrency: fetch pages in parallel when the API gives page counts",
    ],
    solutions: [
      { stack: "Python", label: "Python + httpx", lang: "python", file: "api-client/client.py", run: "python-deps", test: "api-client/client_check.py" },
      { stack: "JavaScript", label: "Node fetch", lang: "javascript", file: "api-client/client.js", run: "node", test: "api-client/client_check.js" },
      { stack: "Go", label: "Go net/http + context", lang: "go", file: "api-client/client.go", run: "go", test: "api-client/client_check.go" },
      { stack: "Java", label: "Java HttpClient", lang: "java", file: "api-client/ApiClient.java", run: "java", test: "api-client/ApiClientMain.java" },
    ],
  },
  {
    slug: "jwt-auth-api",
    title: "Auth API: register, login, JWT-protected route",
    track: "backend",
    difficulty: "Medium",
    frequency: "Very common",
    format: "Take-home",
    time: "1–2 h",
    summary: "Sign-up and login with properly hashed passwords, short-lived JWTs, and a protected /me endpoint.",
    prompt: `Build \`POST /register\`, \`POST /login\` and \`GET /me\`.
Login returns a bearer token; \`/me\` returns the current user only with a valid token.`,
    requirements: [
      "Passwords hashed with a slow, salted KDF (scrypt, bcrypt or argon2), never stored or logged in plain text",
      "Login errors don't reveal whether the email exists",
      "Tokens expire (15 min here) and the signing algorithm is pinned",
      "The JWT secret comes from configuration, not source code",
      "401 with WWW-Authenticate for a missing, bad or expired token",
    ],
    graded: [
      "Security basics: hashing, constant-time comparison, no user enumeration",
      "Correct use of the JWT library (verify, not decode; pinned algorithm)",
      "Middleware / dependency for auth instead of copy-pasted checks",
      "Status codes: 201, 401, 409, 422",
    ],
    approach: [
      "Hash: random 16-byte salt + scrypt(password, salt) → store 'salt:hash'. Verify by re-hashing and comparing in constant time.",
      "For unknown emails, still verify against a dummy hash so response time doesn't leak which emails exist.",
      "Sign {sub: user_id, exp} with HS256; verify with algorithms=['HS256'] so an 'alg: none' token is rejected.",
      "One requireAuth middleware (Express) or Depends(current_user) (FastAPI) guards every protected route.",
    ],
    edgeCases: [
      "Email case: Ada@x.com and ada@x.com are the same account",
      "Token for a user that was deleted",
      "Very long passwords (cap the length to avoid KDF denial of service)",
    ],
    followUps: [
      "Refresh tokens: long-lived, rotated, stored server-side so they can be revoked",
      "Where to keep tokens in a browser: httpOnly cookie vs localStorage (XSS vs CSRF)",
      "Rate-limit /login against credential stuffing",
      "Sessions vs JWTs: when a server-side session is simpler",
    ],
    solutions: [
      { stack: "JavaScript", label: "Express + jsonwebtoken", lang: "javascript", file: "jwt-auth/express.js", run: "node-deps", test: "jwt-auth/express_check.js" },
      { stack: "Python", label: "FastAPI + PyJWT", lang: "python", file: "jwt-auth/fastapi_app.py", run: "python-deps", test: "jwt-auth/fastapi_check.py" },
    ],
  },
  {
    slug: "lru-cache-ttl",
    title: "LRU cache with TTL",
    track: "backend",
    difficulty: "Medium",
    frequency: "Very common",
    format: "Live coding",
    time: "30–45 min",
    summary: "O(1) get/put with least-recently-used eviction, per-entry expiry, and thread safety.",
    prompt: `Implement a cache with a fixed capacity:
- \`get(key)\` returns the value or nothing, and marks the key as recently used.
- \`put(key, value, ttl?)\` inserts or updates; when full, evict the least recently used key.
- Entries older than their TTL behave as if absent.

Both operations must be O(1).`,
    requirements: ["O(1) get and put", "Evict the least recently used entry when over capacity", "Per-entry TTL with lazy expiry", "Safe for concurrent use", "Clock injectable for tests"],
    graded: [
      "Knowing the hash map + doubly linked list structure, and why each half is needed",
      "Using the language's built-in (OrderedDict, LinkedHashMap, Map order) and explaining what it does",
      "Locking: get also mutates (it moves the key), so it needs the lock too",
    ],
    approach: [
      "A hash map gives O(1) lookup of a node; a doubly linked list keeps recency order and allows O(1) unlink and move-to-front.",
      "Python: OrderedDict.move_to_end + popitem(last=False). Java: LinkedHashMap(accessOrder=true) + removeEldestEntry. JS: Map keeps insertion order, so delete + set moves a key to the end.",
      "TTL: store expires_at with the value and treat expired entries as misses on read (lazy expiry).",
    ],
    edgeCases: ["put on an existing key (update value and recency, size unchanged)", "capacity 0 or negative", "Expired entries filling the cache: add a periodic sweep if memory matters"],
    followUps: ["LFU instead of LRU", "Sharding the lock to reduce contention", "Distributed cache: Redis maxmemory-policy allkeys-lru", "Cache stampede: many misses for the same key at once"],
    solutions: [
      { stack: "Python", label: "Python (OrderedDict)", lang: "python", file: "lru-cache/lru.py", run: "python", test: "lru-cache/lru_check.py" },
      { stack: "Java", label: "Java (LinkedHashMap)", lang: "java", file: "lru-cache/LruCache.java", run: "java", test: "lru-cache/LruCacheMain.java" },
      { stack: "Go", label: "Go (generics + container/list)", lang: "go", file: "lru-cache/lru.go", run: "go", test: "lru-cache/lru_check.go" },
      { stack: "JavaScript", label: "JavaScript (Map)", lang: "javascript", file: "lru-cache/lru.js", run: "node", test: "lru-cache/lru_check.js" },
    ],
  },
  {
    slug: "kv-store-transactions",
    title: "In-memory key-value store with transactions",
    track: "backend",
    difficulty: "Medium",
    frequency: "Common",
    format: "Live coding",
    time: "45–60 min",
    summary: "SET, GET, DELETE, COUNT, plus nested BEGIN / ROLLBACK / COMMIT. A favorite at fintech and infra companies.",
    prompt: `Implement a database that reads commands:
\`SET key value\`, \`GET key\`, \`DELETE key\`, \`COUNT value\` (how many keys hold value),
\`BEGIN\`, \`ROLLBACK\` (undo the innermost open transaction), \`COMMIT\` (make all open transactions permanent).

Print \`NULL\` for a missing key and \`NO TRANSACTION\` when there is nothing to roll back or commit.`,
    requirements: ["All operations O(1) (COUNT too)", "Transactions nest", "ROLLBACK only undoes the innermost transaction", "COMMIT closes every open transaction"],
    graded: ["Data structure choice for undo", "Getting nested rollback right", "Keeping the COUNT index consistent through rollbacks", "Clean command parsing"],
    approach: [
      "Keep the live data in a map plus a value → count map so COUNT is O(1).",
      "Each BEGIN pushes an undo log: key → value before this transaction first touched it (absent = None).",
      "ROLLBACK pops the top log and restores those values (without logging the restore). COMMIT clears all logs, since changes were applied as they happened.",
    ],
    edgeCases: [
      "Rollback of a key the parent never touched (the classic bug: don't log the undo into the parent)",
      "DELETE then SET in the same transaction",
      "ROLLBACK or COMMIT with no transaction",
    ],
    followUps: ["Copy-on-write snapshots instead of undo logs: which is cheaper and when?", "Persistence: write-ahead log", "Isolation between concurrent clients (MVCC)"],
    solutions: [
      { stack: "Python", label: "Python", lang: "python", file: "kv-store/kv.py", run: "python", test: "kv-store/kv_check.py" },
      { stack: "JavaScript", label: "JavaScript", lang: "javascript", file: "kv-store/kv.js", run: "node", test: "kv-store/kv_check.js" },
      { stack: "Java", label: "Java", lang: "java", file: "kv-store/KvStore.java", run: "java", test: "kv-store/KvStoreMain.java" },
    ],
  },
  {
    slug: "log-analyzer",
    title: "Access log analyzer",
    track: "backend",
    difficulty: "Easy",
    frequency: "Common",
    format: "Live or take-home",
    time: "45 min",
    summary: "Stream a huge access log: top endpoints, error rate, p95 latency per endpoint, malformed lines counted.",
    prompt: `Given an access log (one request per line):
\`203.0.113.9 - - [10/Oct/2026:13:55:36 +0000] "GET /api/users/42 HTTP/1.1" 200 512 0.123\`

Report total requests, the 5xx error rate, and the top-k endpoints with their p95 latency.
\`/api/users/42\` and \`/api/users/7\` count as the same endpoint. The file may be larger than memory.`,
    requirements: ["Read line by line (streaming)", "Skip and count malformed lines", "Normalize ids in paths to :id and drop query strings", "Top-k by count with deterministic tie-breaking", "Nearest-rank p95 latency in ms"],
    graded: ["Regex parsing with named groups", "Streaming instead of reading the whole file", "Correct percentile", "Using the right structures (Counter, heap for top-k)"],
    approach: [
      "One regex per line; on no match, count it as malformed and move on.",
      "Normalize: strip the query string and replace numeric or UUID segments with :id.",
      "Accumulate counts and latencies per endpoint; top-k via a heap (O(n log k)) or a sort of the distinct endpoints.",
      "p95: sort the latencies and take index ceil(0.95 × n) − 1.",
    ],
    edgeCases: ["Empty file", "Lines with a '-' byte count", "Very long lines", "Windows line endings"],
    followUps: ["Too many latencies to keep: t-digest or HDR histogram", "Process several files in parallel and merge the counters", "Real-time: a sliding window over the last 5 minutes"],
    solutions: [
      { stack: "Python", label: "Python", lang: "python", file: "log-analyzer/analyze.py", run: "python", test: "log-analyzer/analyze_check.py" },
      { stack: "Go", label: "Go (bufio.Scanner)", lang: "go", file: "log-analyzer/analyze.go", run: "go", test: "log-analyzer/analyze_check.go" },
      { stack: "JavaScript", label: "Node (readline stream)", lang: "javascript", file: "log-analyzer/analyze.js", run: "node", test: "log-analyzer/analyze_check.js" },
    ],
  },
];
