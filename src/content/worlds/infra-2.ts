import type { Lesson } from "../types";

export const infraPart2: Lesson[] = [
  // ------------------------------------------------------------------ SERVICE MESH
  {
    id: "service-mesh",
    title: "Proxies, API Gateways & Service Mesh",
    tagline: "Who handles TLS, retries, routing and identity: the app, a gateway, or a sidecar.",
    difficulty: "advanced",
    minutes: 15,
    diagram: {
      title: "API gateway at the edge, service mesh inside",
      nodes: [
        { id: "client", label: "Mobile / web", kind: "client", x: 90, y: 280 },
        { id: "gw", label: "API gateway", sub: "authn · rate limit · routing", kind: "gateway", x: 300, y: 280 },
        { id: "orders", label: "orders + Envoy", sub: "sidecar proxy", kind: "service", x: 540, y: 280 },
        { id: "payments", label: "payments + Envoy", sub: "2 replicas", kind: "service", x: 800, y: 140 },
        { id: "inventory", label: "inventory + Envoy", sub: "v1 + v2 canary", kind: "service", x: 800, y: 420 },
        { id: "istiod", label: "Mesh control plane", sub: "istiod: config + certs", kind: "control", x: 540, y: 80 },
        { id: "telemetry", label: "Metrics & traces", sub: "Prometheus · Jaeger", kind: "monitor", x: 540, y: 480 },
      ],
      edges: [
        { from: "client", to: "gw", label: "HTTPS" },
        { from: "gw", to: "orders" },
        { from: "orders", to: "payments", label: "mTLS" },
        { from: "orders", to: "inventory", label: "mTLS" },
        { from: "istiod", to: "orders", label: "xDS", dashed: true },
        { from: "istiod", to: "payments", dashed: true },
        { from: "istiod", to: "inventory", dashed: true },
        { from: "orders", to: "telemetry", dashed: true },
      ],
      flows: [
        {
          name: "North-south request",
          path: ["client", "gw", "orders", "payments", "orders", "gw", "client"],
          steps: [
            "POST /checkout with a JWT. The gateway terminates TLS, validates the token, applies per-client rate limits and routes by path.",
            "Forwarded to the orders service. The pod's sidecar receives it first (iptables redirects all traffic through Envoy).",
            "orders calls payments. The app speaks plain HTTP to localhost, and its sidecar opens an mTLS connection to a healthy payments replica, with a timeout and retry budget from mesh config.",
            "The payments sidecar verifies the caller's SPIFFE identity (only orders may call /charge) and returns the response.",
            "orders responds. Both sidecars emit metrics and spans (latency, status, source/destination identity) without app code.",
            "The gateway returns the response to the client.",
          ],
        },
        {
          name: "Canary via traffic splitting",
          path: ["istiod", "orders", "inventory", "orders", "telemetry"],
          steps: [
            "An operator applies a routing rule: 90% of inventory traffic to v1, 10% to v2. istiod translates it into Envoy config and pushes it to every sidecar (xDS).",
            "orders' sidecar now sends 1 in 10 inventory calls to v2 pods. No app change, no new load balancer.",
            "Responses come back from both versions.",
            "Per-version error rate and latency are compared. Promote by changing the weights, or roll back by setting v2 to 0%.",
          ],
        },
        {
          name: "A slow replica",
          path: ["orders", "payments", "orders", "payments", "orders"],
          steps: [
            "The sidecar calls payments-1 with a 300 ms per-try timeout.",
            "payments-1 is stuck in a long GC pause and the timeout fires.",
            "The sidecar retries once on payments-2. After repeated failures, outlier detection ejects payments-1 from the pool for a while.",
            "Success: the app saw one slightly slower call instead of an error. Retries are budgeted so they can't snowball into a storm.",
          ],
        },
      ],
    },
    concept: `
## Proxies in one minute
- A **forward proxy** acts for clients (corporate egress, outbound filtering). A **reverse proxy** acts for servers: clients talk to it, and it picks a backend (NGINX, HAProxy, Envoy). It terminates TLS, load-balances, caches, compresses, retries and enforces limits.
- Traffic entering the system is **north-south**. Traffic between services is **east-west**.

## API gateway (the edge)
A reverse proxy specialized for APIs at the north-south boundary:
- **Authentication** (JWT/OAuth validation, API keys), coarse **authorization**
- **Rate limiting & quotas** per client or plan, request size limits, WAF rules
- **Routing** by host, path, header or version; protocol translation (REST ↔ gRPC)
- **Aggregation / BFF** (backend-for-frontend): one call fans out to several services for a mobile screen
- Observability: access logs, request IDs, metrics
Examples: Kong, Envoy Gateway, AWS API Gateway, Apigee. Keep business logic *out* of the gateway, or it becomes a distributed monolith.

## Service discovery
Instances come and go, so callers need the current list. **Client-side** discovery: the caller queries a registry (Consul, Eureka) and load-balances itself (smart clients, gRPC). **Server-side**: the caller hits a stable name or VIP and the platform routes (Kubernetes Services, cloud LBs). DNS-based discovery is simple but cached TTLs can send traffic to dead instances.

## Service mesh
Every service needs the same plumbing: mTLS, retries, timeouts, circuit breaking, load balancing, metrics, tracing. Re-implementing it in every language's library is inconsistent and slow to upgrade. A mesh moves it into the network layer:
- **Data plane**: a proxy next to every instance (classic **sidecar** Envoy in each pod). iptables (or eBPF) redirects all inbound and outbound traffic through it.
- **Control plane** (istiod, Linkerd's control plane): watches the platform for services and endpoints, distributes routing config (xDS), and acts as a **certificate authority** issuing short-lived workload identities (**SPIFFE** IDs) for mTLS.
What you get: **zero-trust networking** (encrypt and authenticate every hop, authorize by identity rather than IP), **uniform telemetry** (golden signals per service pair), **traffic management** (canaries, mirroring, fault injection), and **resilience policy** (timeouts, retry budgets, outlier detection) without changing code.

## The costs
- **Latency**: two extra proxy hops per call (~0.5–2 ms each at p99) and CPU/memory for thousands of sidecars.
- **Operational complexity**: one more distributed system to upgrade and debug. A bad config push can break everything at once.
- **Retries in two places**: if both the app and the mesh retry, attempts multiply. Pick one layer.
Newer designs reduce the sidecar tax: **ambient / sidecarless** mesh (per-node L4 proxy + optional L7 waypoints) and **eBPF**-based dataplanes (Cilium).

## When do you need one?
Probably not for 5 services. Consider it when you have many services in several languages, compliance requires mTLS everywhere, or you keep re-implementing the same resilience logic. Start with a gateway + good client libraries + Kubernetes Services, and add a mesh when the pain is real.
`,
    keyPoints: [
      "Reverse proxies terminate TLS, load-balance, retry and enforce limits in front of servers.",
      "The API gateway owns north-south concerns: auth, rate limits, routing, aggregation.",
      "Mesh = sidecar data plane + control plane pushing config and issuing mTLS identities.",
      "Mesh benefits: mTLS everywhere, uniform telemetry, traffic splitting, retries and timeouts as config.",
      "Costs: extra hops, resource overhead, complexity, and retries multiplying across layers.",
    ],
    code: [
      {
        title: "Istio: canary split, timeouts, retries and outlier detection",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata: { name: inventory }
spec:
  hosts: [inventory]
  http:
    - timeout: 2s                     # overall deadline for the call
      retries:
        attempts: 2
        perTryTimeout: 300ms
        retryOn: connect-failure,refused-stream,unavailable,5xx
      route:
        - destination: { host: inventory, subset: v1 }
          weight: 90
        - destination: { host: inventory, subset: v2 }
          weight: 10                  # canary
---
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata: { name: inventory }
spec:
  host: inventory
  trafficPolicy:
    tls: { mode: ISTIO_MUTUAL }       # mTLS with mesh-issued identities
    outlierDetection:                 # passive health checking / circuit breaking
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:
    - { name: v1, labels: { version: v1 } }
    - { name: v2, labels: { version: v2 } }
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What is a service mesh and what problems does it solve?",
        a: "A dedicated infrastructure layer for service-to-service communication: a proxy (usually Envoy) beside each service instance intercepts all traffic (the **data plane**), configured by a **control plane** that also issues workload certificates. It solves cross-cutting concerns uniformly, without changing app code: **mTLS** and identity-based authorization between services (zero trust), **traffic management** (canaries, weighted routing, mirroring, fault injection), **resilience** (timeouts, retries with budgets, circuit breaking/outlier detection) and **observability** (per-hop metrics, access logs, trace spans). Trade-offs: added latency and resource cost per hop, operational complexity, and a powerful control plane that can break everything with one bad push.",
        freq: "common",
      },
      {
        q: "API gateway vs service mesh vs load balancer: what's the difference?",
        a: "A **load balancer** distributes connections or requests across instances of one service (L4 or L7). An **API gateway** is a north-south edge component for external clients: authentication, rate limiting, quotas, request routing and transformation, API keys, sometimes aggregation. A **service mesh** handles east-west traffic between internal services: mTLS, retries, timeouts, traffic splitting and telemetry on every hop. They overlap (all are often built on Envoy) and are commonly used together: LB → gateway → mesh-managed services.",
        freq: "common",
      },
      {
        q: "How would you implement mutual TLS between 200 microservices?",
        a: "Manually managing certificates for 200 services doesn't scale, so automate identity: a CA (mesh control plane, SPIFFE/SPIRE, or cert-manager) issues **short-lived certificates** (hours) to each workload, bound to its identity (service account), and rotates them automatically. With a mesh, sidecars handle the handshakes transparently, and you roll out in permissive mode (accept plaintext and mTLS), verify all traffic is mTLS in telemetry, then switch to strict mode. Then add **authorization policies** by identity (only `orders` may call `payments` POST /charge). Without a mesh, use libraries plus SPIFFE workload API, at the cost of per-language work.",
        freq: "occasional",
      },
      {
        q: "Where should retries live: in the client library, the mesh, or the gateway?",
        a: "In **one** place per hop, as close to the failing call as possible, with a budget. If the gateway retries 3×, the mesh retries 3× and the app retries 3×, one user request can become 27 attempts against a struggling service. Prefer mesh or client-library retries for idempotent calls with per-try timeouts, exponential backoff with jitter, and a retry budget (e.g. at most 10–20% extra load). Make the outermost layers not retry, or only on connection failures. Always pair retries with an overall deadline that propagates downstream.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In a sidecar mesh, what actually performs the mTLS handshake?",
        options: ["The application", "The sidecar proxy", "The control plane", "The API gateway"],
        answer: 1,
        explain: "The app talks plaintext to its local proxy, and the proxies handle mTLS between pods.",
      },
      {
        q: "The mesh control plane's jobs include…",
        options: ["Serving user requests", "Distributing proxy config and issuing workload certificates", "Storing application data", "Building container images"],
        answer: 1,
        explain: "Data flows through the proxies. The control plane configures them and acts as CA.",
      },
      {
        q: "Traffic between internal services is called…",
        options: ["North-south", "East-west", "Ingress", "Egress"],
        answer: 1,
        explain: "North-south crosses the system boundary; east-west stays inside.",
      },
      {
        q: "The biggest risk of adding mesh retries to apps that already retry is…",
        options: ["Higher TLS cost", "Multiplied attempts during outages (retry storms)", "Lost metrics", "DNS failures"],
        answer: 1,
        explain: "Retries at several layers multiply. Keep one layer and a budget.",
      },
      {
        q: "Outlier detection in Envoy…",
        options: ["Ejects hosts that keep failing from the load-balancing pool", "Detects anomalies in logs", "Blocks bad IPs", "Scales pods"],
        answer: 0,
        explain: "It's passive health checking, a form of circuit breaking per host.",
      },
    ],
  },

  // ------------------------------------------------------------------ CI/CD
  {
    id: "cicd-deploys",
    title: "CI/CD & Deployment Strategies",
    tagline: "From commit to production safely: pipelines, rollouts, rollbacks and schema changes.",
    difficulty: "intermediate",
    minutes: 16,
    visualizers: ["rollout"],
    concept: `
## CI: keep main always releasable
**Continuous integration** = every change merges to the main branch frequently (at least daily), and every commit triggers an automated pipeline: build → lint/static analysis → unit tests → security scans (dependencies, secrets, containers) → integration tests → **one immutable artifact** (an image tagged with the git SHA).
- **Trunk-based development** with short-lived branches beats long-lived feature branches (merge hell). Hide unfinished work behind **feature flags**.
- **Fast feedback**: under 10 minutes. Parallelize, cache dependencies and build layers, run the slow suites later in the pipeline.
- **Flaky tests** destroy trust. Quarantine and fix them; never "just re-run".

## CD: delivery vs deployment
- **Continuous delivery**: every green build *can* be released with one click.
- **Continuous deployment**: every green build *is* released automatically.
- **Build once, deploy many**: the same artifact is promoted dev → staging → prod. Only configuration differs. Rebuilding per environment means you never deployed what you tested.

## Deployment strategies (try them in the visualizer)
| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Recreate** | Stop all old, start all new | Simple, no mixed versions | Downtime |
| **Rolling** | Replace instances in batches (maxSurge/maxUnavailable) | No downtime, little extra capacity | Mixed versions, slow rollback, a bad version can reach everyone |
| **Blue/green** | Full new stack beside the old, then switch traffic | Instant cutover and rollback | 2× capacity during deploys, every user switches at once |
| **Canary** | Small % of traffic to the new version, analyze, increase | Smallest blast radius, decisions from real metrics | Slower, needs good metrics and traffic splitting |
| **Shadow / dark launch** | Mirror production traffic to the new version, discard responses | Zero user risk | Side effects must be suppressed, double load |
**Progressive delivery** (Argo Rollouts, Flagger, Spinnaker) automates canaries: shift 5% → run analysis comparing the canary's error rate and latency against the baseline → promote or **automatically roll back**.

## Rollbacks and feature flags
Rollback must be **fast, rehearsed and boring**: redeploy the previous artifact, without rebuilding. Feature flags decouple **deploy** (code is in production) from **release** (users see it), enable gradual rollouts by user segment, and provide a kill switch faster than any deploy. Clean up old flags; they're tech debt with a blast radius.

## Database migrations: expand and contract
Code and schema can't change atomically together, and during a rolling deploy old and new code run at the same time. So never make a breaking schema change in one step:
1. **Expand**: add the new column or table (nullable), deploy code that writes to both old and new.
2. **Migrate**: backfill existing rows in batches.
3. Switch reads to the new structure.
4. **Contract**: once nothing uses the old column, drop it in a later release.
Every step is backward compatible and individually reversible. Beware of long locks on big tables (use online schema change tools).

## GitOps
Git holds the desired state of every environment. An agent in the cluster (**Argo CD**, **Flux**) continuously pulls and reconciles (Kubernetes' control-loop idea applied to deployment). Benefits: an audit trail via commits and PRs, rollback = git revert, drift detection, and no CI credentials with cluster-admin access.

## Measuring delivery: DORA metrics
**Deployment frequency**, **lead time for changes** (commit → production), **change failure rate**, **time to restore service**. Elite teams deploy on demand with low failure rates. Speed and stability improve *together* when changes are small.

## Supply-chain security
Pin dependencies, scan them, sign artifacts (cosign) and verify signatures at deploy time, generate provenance (SLSA), and use short-lived OIDC credentials for CI instead of long-lived cloud keys.
`,
    keyPoints: [
      "CI: small frequent merges to trunk, fast pipeline, one immutable artifact per commit.",
      "Build once, promote the same artifact through environments.",
      "Canary + automated analysis gives the smallest blast radius. Blue/green gives the fastest rollback.",
      "Feature flags separate deploy from release and act as kill switches.",
      "Schema changes: expand → migrate → contract, so old and new code both work.",
      "DORA: deploy frequency, lead time, change failure rate, time to restore.",
    ],
    code: [
      {
        title: "CI pipeline and a progressive canary",
        variants: [
          {
            lang: "yaml",
            code: `
# .github/workflows/ci.yml: test, build once, push an image tagged by commit SHA
name: ci
on: [push]
permissions: { contents: read, id-token: write, packages: write }   # OIDC, no stored cloud keys
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npm test -- --ci
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          push: \${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/acme/api:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
---
# Argo Rollouts: canary with automated analysis and rollback
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: api }
spec:
  strategy:
    canary:
      steps:
        - setWeight: 5
        - analysis: { templates: [{ templateName: error-rate }] }   # fails → automatic rollback
        - setWeight: 25
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 10m }
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Compare rolling, blue/green and canary deployments.",
        a: "**Rolling** replaces instances in batches: no extra environment and no downtime, but old and new versions serve simultaneously, a bad build progressively reaches everyone unless health checks catch it, and rollback is another rollout. **Blue/green** stands up a full parallel environment and flips the router: instant cutover and instant rollback (flip back), clean version separation, but double capacity and every user moves at once. **Canary** sends a small slice of real traffic to the new version, compares its metrics against the baseline, and increases gradually: smallest blast radius and data-driven decisions, but slower, and it needs traffic splitting and good SLIs. Many teams combine them: canary analysis on top of rolling infrastructure, with feature flags for user-facing changes.",
        freq: "very-common",
      },
      {
        q: "How do you deploy a database schema change with zero downtime?",
        a: "Use **expand/contract** (parallel change) so every intermediate state works with both old and new code, because during a rolling deploy both versions run. Example, renaming `name` to `full_name`: (1) add `full_name` nullable and deploy code that writes both columns; (2) backfill in small batches to avoid long locks and replication lag; (3) deploy code that reads `full_name`; (4) stop writing `name`; (5) drop `name` in a later release. Avoid locking DDL on big tables (use online migration tools like gh-ost or pg_repack-style approaches, `CREATE INDEX CONCURRENTLY`), make migrations separate deploy steps, and keep them reversible.",
        freq: "very-common",
      },
      {
        q: "What's the difference between continuous delivery and continuous deployment?",
        a: "Both keep the main branch releasable with automated build and test pipelines. **Continuous delivery**: every passing build is deployable, but a human decides when to release (a button or a scheduled release). **Continuous deployment**: every passing build goes to production automatically, with no manual gate, relying on strong tests, canaries, automated rollback and feature flags to control exposure. Continuous deployment requires more automation maturity but gives smaller, safer, more frequent changes.",
        freq: "common",
      },
      {
        q: "A deploy just caused errors in production. What do you do?",
        a: "**Mitigate first**: roll back to the last known-good artifact (or kill-switch the feature flag) instead of debugging live. Rollbacks should be one command and practiced. Communicate in the incident channel and status page if users are affected. Confirm recovery with metrics. Then investigate: what changed, why didn't tests, canary analysis or alerts catch it earlier? Write a blameless postmortem with action items: add the missing test, tighten canary analysis thresholds, add an SLO alert, make the change smaller next time. If the deploy included an irreversible migration, rolling forward with a fix may be the only option, which is why migrations must be backward compatible.",
        freq: "common",
      },
      {
        q: "What is GitOps?",
        a: "Operating infrastructure and deployments by declaring the desired state in Git and letting an automated agent reconcile the live system to match it. With Argo CD or Flux, an in-cluster controller **pulls** manifests from the repo and applies them, continuously correcting drift. Changes happen through pull requests (review, audit trail), rollback is `git revert`, and CI never needs cluster credentials (it only pushes images and updates manifests). It's the Kubernetes reconciliation model applied to delivery.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which strategy has the smallest blast radius for a bad release?",
        options: ["Recreate", "Rolling", "Blue/green", "Canary with automated analysis"],
        answer: 3,
        explain: "Only a small percentage of traffic sees the new version before it's judged.",
      },
      {
        q: "Which strategy needs roughly double capacity during the deploy?",
        options: ["Rolling", "Canary", "Blue/green", "Recreate"],
        answer: 2,
        explain: "The full green environment runs alongside blue until cutover.",
      },
      {
        q: "'Build once, deploy many' means…",
        options: ["One deploy per day", "The same artifact is promoted through every environment", "Monorepo", "One build server"],
        answer: 1,
        explain: "Rebuilding per environment means production runs something you never tested.",
      },
      {
        q: "During a rolling deploy, why must schema changes be backward compatible?",
        options: ["Databases require it", "Old and new code versions run at the same time", "Rollbacks are impossible", "For performance"],
        answer: 1,
        explain: "Hence expand → migrate → contract.",
      },
      {
        q: "Which is NOT a DORA metric?",
        options: ["Deployment frequency", "Lead time for changes", "Lines of code per day", "Change failure rate"],
        answer: 2,
        explain: "The four keys: frequency, lead time, change failure rate, time to restore.",
      },
    ],
    problems: [{ title: "Course Schedule II", url: "https://leetcode.com/problems/course-schedule-ii/", difficulty: "Medium", note: "Build order of pipeline stages / Terraform's resource DAG." }],
  },

  // ------------------------------------------------------------------ CLOUD + IAC
  {
    id: "cloud-iac",
    title: "Cloud Architecture & Infrastructure as Code",
    tagline: "Regions, AZs, managed services, IAM and Terraform: building infrastructure you can rebuild.",
    difficulty: "intermediate",
    minutes: 16,
    diagram: {
      title: "A multi-AZ web stack, provisioned by Terraform",
      nodes: [
        { id: "users", label: "Users", kind: "client", x: 80, y: 300 },
        { id: "dns", label: "DNS", sub: "health-checked", kind: "dns", x: 80, y: 110 },
        { id: "cdn", label: "CDN + WAF", kind: "cdn", x: 260, y: 300 },
        { id: "alb", label: "Load balancer", sub: "spans both AZs", kind: "lb", x: 440, y: 300 },
        { id: "appA", label: "App · AZ-a", sub: "auto scaling group", kind: "service", x: 640, y: 190 },
        { id: "appB", label: "App · AZ-b", sub: "auto scaling group", kind: "service", x: 640, y: 420 },
        { id: "dbA", label: "DB primary · AZ-a", sub: "managed Postgres", kind: "db", x: 880, y: 190 },
        { id: "dbB", label: "DB standby · AZ-b", sub: "synchronous replica", kind: "db", x: 880, y: 420 },
        { id: "s3", label: "Object storage", sub: "assets, backups", kind: "storage", x: 260, y: 500 },
        { id: "tf", label: "Terraform in CI", sub: "plan on PR, apply on merge", kind: "control", x: 440, y: 70 },
        { id: "state", label: "Remote state", sub: "versioned + locked", kind: "storage", x: 660, y: 40 },
        { id: "cloud", label: "Cloud provider API", kind: "external", x: 880, y: 40 },
      ],
      edges: [
        { from: "users", to: "dns" },
        { from: "users", to: "cdn" },
        { from: "cdn", to: "alb" },
        { from: "cdn", to: "s3", label: "static" },
        { from: "alb", to: "appA" },
        { from: "alb", to: "appB" },
        { from: "appA", to: "dbA" },
        { from: "appB", to: "dbA" },
        { from: "dbA", to: "dbB", label: "sync" },
        { from: "appB", to: "dbB", label: "after failover", dashed: true },
        { from: "tf", to: "state" },
        { from: "tf", to: "cloud" },
      ],
      flows: [
        {
          name: "Normal request",
          path: ["users", "dns", "users", "cdn", "alb", "appA", "dbA", "appA", "alb", "cdn", "users"],
          steps: [
            "Resolve app.example.com.",
            "DNS returns the CDN edge closest to the user.",
            "TLS terminates at the edge, and the WAF filters bots and injection attempts. Static assets are served from cache.",
            "Dynamic requests go to the regional load balancer, which spans both availability zones.",
            "Routed to a healthy instance (here in AZ-a). Instances are stateless and identical: cattle, not pets.",
            "Query the primary database.",
            "Result returned.",
            "Response to the load balancer.",
            "Back through the edge (which may cache it if headers allow).",
            "Done, typically in tens of milliseconds.",
          ],
        },
        {
          name: "AZ-a goes down",
          path: ["alb", "appB", "dbA", "dbB", "appB", "alb"],
          steps: [
            "Health checks to AZ-a fail, so the load balancer sends everything to AZ-b. The auto scaling group launches replacement capacity in AZ-b.",
            "The app's connections to the primary database in AZ-a fail.",
            "The managed database promotes the synchronous standby in AZ-b (typically 1–2 minutes) and repoints its DNS endpoint.",
            "Apps reconnect to the same endpoint name, so no config change is needed. No committed data is lost because replication was synchronous.",
            "Serving again from one AZ. Size each AZ so the survivors can carry the full load (N+1), or you degrade during an AZ outage.",
          ],
        },
        {
          name: "terraform apply",
          path: ["tf", "state", "tf", "cloud", "tf", "state"],
          steps: [
            "Acquire the state lock so two applies can never run concurrently.",
            "Read the state: Terraform's record of which real resources correspond to which config blocks.",
            "Refresh and plan: compare config with reality. The plan (+ create, ~ update, - destroy) was reviewed in the pull request.",
            "Apply: call the cloud API in dependency order (a DAG: VPC → subnets → load balancer → instances), in parallel where possible.",
            "Write the new state (versioned, so it can be recovered) and release the lock.",
          ],
        },
      ],
    },
    concept: `
## The cloud's failure domains
- A **region** is a geographic area (us-east-1, europe-west1) with several **availability zones** (AZs): separate datacenters with independent power, cooling and networking, a few milliseconds apart.
- Deploy across **at least 2–3 AZs** for high availability: AZ failures happen. Multi-**region** is for disaster recovery, data residency and global latency, and costs much more complexity (see the DR lesson).
- Many services are **zonal** (VMs, disks), some are **regional** (load balancers, object storage, managed DBs with standbys), a few are **global** (DNS, CDN, IAM).

## Choosing compute
| | VMs | Containers (k8s/ECS) | Serverless functions |
|---|---|---|---|
| Control | Full OS | Image + orchestrator | Code only |
| Scaling | Minutes | Seconds | Milliseconds, to zero |
| Ops burden | Highest | Medium | Lowest |
| Limits | None | Few | Timeouts, cold starts, statelessness |
| Cost profile | Pay for provisioned | Pay for nodes | Pay per request (cheap when spiky, pricey when constant) |

Prefer **managed services** (databases, queues, caches) unless running the thing yourself is a competitive advantage. Undifferentiated heavy lifting is where on-call pain comes from.

## Shared responsibility
The provider secures the cloud (hardware, hypervisor, physical sites). You secure what you put **in** it: IAM, network rules, encryption settings, OS patches on VMs, your code and data. Most breaches are misconfigurations: public buckets, over-privileged keys, open security groups.

## IAM: least privilege
- Humans use SSO with MFA and short sessions, never long-lived access keys.
- Workloads use **roles** (instance profiles, workload identity / IRSA in Kubernetes, OIDC for CI) that issue short-lived credentials automatically.
- Grant the minimum actions on the minimum resources, separate accounts or projects per environment (blast radius), and audit with access logs.
- Secrets go in a secrets manager with rotation, never in code, AMIs, images or Terraform state in plain text.

## Infrastructure as Code
Declare infrastructure in version-controlled files and let a tool make reality match:
- **Terraform / OpenTofu** (multi-cloud, HCL), **CloudFormation / CDK** (AWS), **Pulumi** (general-purpose languages), Crossplane (Kubernetes-native).
- **plan → review → apply**: run \`plan\` in CI on every pull request so reviewers see exactly what will be created, changed or **destroyed**, then \`apply\` from CI on merge.
- **State** maps config to real resource IDs. Store it remotely (S3/GCS + locking), encrypt it (it can contain secrets), and never edit it by hand except via \`terraform state\` commands or \`import\` blocks.
- **Drift**: someone clicks in the console and reality diverges. Detect it with scheduled plans, prevent it with read-only console access in prod.
- **Modules** for reuse, separate state per environment and per component (small blast radius, faster plans), pinned provider versions.
- \`prevent_destroy\` and deletion protection on databases. A typo in a plan can drop prod.

## Immutable infrastructure
Don't SSH in and patch servers (snowflakes drift). Bake a new image (AMI or container), roll it out, and destroy the old instances. Servers are **cattle, not pets**: any one can be replaced at any time. Configuration management tools (Ansible, Chef) are still used for mutable fleets and bootstrap.

## Cost is an architecture concern
Rightsize (most instances are oversized), autoscale, use **spot/preemptible** capacity for fault-tolerant work (up to ~90% cheaper), commit to savings plans or reserved capacity for the baseline, watch **data egress and cross-AZ traffic** (often surprisingly large), add lifecycle rules for object storage, and tag everything for cost allocation.
`,
    keyPoints: [
      "Spread across ≥ 2–3 AZs, and size each so the survivors carry the full load.",
      "Prefer managed services and roles with short-lived credentials over static keys.",
      "IaC: plan in PR, apply from CI, remote locked encrypted state, detect drift.",
      "Immutable infrastructure: replace servers, don't patch them by hand.",
      "Shared responsibility: misconfiguration is your problem, and the top cause of breaches.",
      "Cost levers: rightsizing, autoscaling, spot, commitments, and watching egress.",
    ],
    code: [
      {
        title: "Terraform: remote state, a module, guarded resources",
        variants: [
          {
            lang: "hcl",
            code: `
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {                      # remote, versioned, encrypted state
    bucket       = "acme-terraform-state"
    key          = "prod/web/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true               # state locking: no concurrent applies
  }
}

module "network" {
  source   = "./modules/network"      # reusable VPC module (subnets per AZ, NAT, routes)
  cidr     = "10.10.0.0/16"
  az_count = 3
}

resource "aws_db_instance" "main" {
  identifier          = "prod-main"
  engine              = "postgres"
  instance_class      = "db.r6g.large"
  multi_az            = true          # synchronous standby in another AZ
  storage_encrypted   = true
  deletion_protection = true
  backup_retention_period = 14
  db_subnet_group_name    = module.network.db_subnet_group
  manage_master_user_password = true  # password lives in Secrets Manager, not in state

  lifecycle {
    prevent_destroy = true            # a bad plan can't drop the database
  }
}
`,
          },
          {
            lang: "bash",
            code: `
# The everyday IaC loop
terraform fmt -check && terraform validate
terraform plan -out=tfplan            # in CI on every PR; post the summary as a comment
terraform show -no-color tfplan | grep -E '^\\s+# .* will be (destroyed|replaced)'   # flag destructive changes
terraform apply tfplan                # only from CI after merge, using the reviewed plan

# Drift detection: exit code 2 means reality no longer matches the code
terraform plan -detailed-exitcode -lock=false
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "How would you make a web application highly available within one cloud region?",
        a: "Eliminate single points of failure across **availability zones**: a regional load balancer spanning 3 AZs; stateless app instances in an auto scaling group (or Kubernetes nodes) spread across AZs, with health checks and enough capacity that losing one AZ still covers peak (N+1); a managed database with a **synchronous standby in another AZ** and automatic failover (plus read replicas if needed); sessions and caches externalized to a replicated store; object storage (regional) for files; NAT gateways per AZ; and infrastructure defined in code so anything can be recreated. Test it: kill instances and simulate AZ loss in game days. For regional failures you need a multi-region DR strategy.",
        freq: "very-common",
      },
      {
        q: "What is Terraform state, and what can go wrong with it?",
        a: "State is Terraform's mapping between resources in your configuration and real resource IDs in the cloud, plus cached attributes. Plans are computed by comparing config, state and reality. Problems: **concurrent applies** corrupting it (use a remote backend with locking), **local state** lost or not shared (use remote, versioned storage), **secrets in state** (encrypt it and restrict access), **drift** when people change resources manually (detect with scheduled plans), and huge monolithic states that are slow and risky (split by environment and component). Recovery tools: `terraform import`/import blocks, `state mv` for refactors, and restoring a previous state version.",
        freq: "common",
      },
      {
        q: "VMs, containers or serverless: how do you choose?",
        a: "Consider the workload shape and team. **Serverless functions**: event-driven, spiky or low-traffic workloads, glue code, scheduled jobs. No servers to manage and scales to zero, but cold starts, execution time limits, per-request costs that add up under constant load, and harder local testing. **Containers on an orchestrator**: long-running services, consistent packaging, efficient bin-packing, good for many microservices, but you operate the platform (or use a managed one like ECS/Cloud Run/GKE Autopilot). **VMs**: legacy apps, special kernels or hardware, licensing, or stateful systems you manage directly. Many architectures mix them: containers for core services, functions for events, managed services for data.",
        freq: "common",
      },
      {
        q: "How do you give an application running in the cloud access to a database password or an S3 bucket securely?",
        a: "No static credentials in code, images or environment files. Give the workload an **identity**: an IAM role via an instance profile, Kubernetes workload identity (IRSA/GKE Workload Identity) or OIDC federation for CI, which issues **short-lived credentials** automatically. Grant that role least-privilege access (this bucket prefix, these actions). For secrets that must exist (a DB password), store them in a **secrets manager** with rotation, fetch them at startup or mount them via a CSI driver, and prefer IAM database authentication where supported. Audit access with cloud logs.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Availability zones are…",
        options: ["Different cloud providers", "Isolated datacenters within one region", "Edge cache locations", "Separate accounts"],
        answer: 1,
        explain: "Independent power and networking, but close enough for synchronous replication.",
      },
      {
        q: "Why store Terraform state remotely with locking?",
        options: ["It's faster", "To share it and prevent concurrent applies from corrupting it", "Required by AWS", "To hide it from git"],
        answer: 1,
        explain: "Two simultaneous applies with stale state can create duplicate or orphaned resources.",
      },
      {
        q: "Best way for a pod to access an S3 bucket?",
        options: ["Access keys in an env var", "Keys baked into the image", "Workload identity / IAM role with short-lived credentials", "Make the bucket public"],
        answer: 2,
        explain: "No long-lived secrets to leak or rotate.",
      },
      {
        q: "Under the shared responsibility model, who is responsible for an open security group?",
        options: ["The cloud provider", "The customer", "Both equally", "Nobody"],
        answer: 1,
        explain: "The provider secures the infrastructure. Configuration is yours.",
      },
      {
        q: "'Cattle, not pets' means…",
        options: ["Use more small servers", "Servers are disposable and replaced rather than hand-repaired", "Name servers after animals", "Avoid containers"],
        answer: 1,
        explain: "Immutable, identical, automatically replaced instances.",
      },
    ],
  },

  // ------------------------------------------------------------------ OBSERVABILITY
  {
    id: "observability",
    title: "Observability: Metrics, Logs & Traces",
    tagline: "Know what's broken and why: golden signals, percentiles, cardinality and tracing.",
    difficulty: "intermediate",
    minutes: 17,
    visualizers: ["percentiles"],
    concept: `
## Monitoring vs observability
**Monitoring** answers known questions ("is CPU > 90%?"). **Observability** is being able to ask *new* questions about a system's behavior from its outputs, without shipping new code, which you need for the failure you didn't predict. The main signals are **metrics**, **logs**, **traces** (and increasingly continuous **profiles**).

## What to measure
- **Four golden signals** (Google SRE) for every user-facing service: **latency**, **traffic**, **errors**, **saturation**.
- **RED** for request-driven services: **R**ate, **E**rrors, **D**uration.
- **USE** for resources (CPU, disk, NIC, pools): **U**tilization, **S**aturation, **E**rrors.
Measure at the edge (what users experience) and at every dependency boundary.

## Metrics
Cheap, aggregatable numbers over time, identified by a name + **labels**:
- **Counter** (only goes up: requests, errors), so you graph its \`rate()\`. **Gauge** (goes up and down: queue depth, memory). **Histogram** (bucketed observations: latency, sizes), which can be **aggregated across instances** and turned into percentiles. **Summary** (client-side quantiles), which **can't** be aggregated.
- **Prometheus** scrapes (pulls) \`/metrics\` endpoints, stores time series, and evaluates PromQL rules and alerts. Push gateways and OpenTelemetry collectors cover short-lived jobs and push models.
- **Cardinality** is the silent killer: each unique label combination is a separate time series. A \`user_id\` or \`request_id\` label creates millions of series and takes down your metrics system. Put high-cardinality data in logs and traces.

## Percentiles, not averages (see the visualizer)
Latency distributions are long-tailed. The **mean** describes no real request, and a slow tail hides inside it. Track **p50, p90, p99, p99.9**. **You can't average percentiles** across instances or time windows: aggregate the histograms, then compute the quantile. And remember fan-out: if a page calls 100 backends, the backend's p99 is roughly the user's median.

## Logs
- **Structured** (JSON) with consistent fields: timestamp, level, service, **trace_id**, request ID, user/tenant (if allowed), and message.
- Centralize them (Loki, Elasticsearch/OpenSearch, cloud logging), set retention by value, sample noisy debug logs, and never log secrets or personal data you aren't allowed to keep.
- Logs are the most expensive signal per byte. Use metrics for counting and logs for details.

## Distributed tracing
A **trace** follows one request across services as a tree of **spans** (operation, start, duration, attributes, status). **Context propagation** carries the trace ID in headers (W3C \`traceparent\`) through every hop, including queues.
- **OpenTelemetry** is the vendor-neutral standard for traces, metrics and logs (SDKs + collector), exportable to Jaeger, Tempo, Honeycomb, Datadog and others.
- **Sampling**: **head-based** (decide at the start, e.g. keep 1%: cheap but may miss rare errors) vs **tail-based** (buffer complete traces and keep the slow or failed ones: smarter, needs a collector tier).
- **Exemplars** link a latency spike on a metrics graph to an example trace, and trace IDs in logs link traces to log lines. That linkage turns three tools into one investigation.

## Alerting that people trust
- **Alert on symptoms** (SLO burn: users are affected) rather than causes (CPU high). Causes belong on dashboards for diagnosis.
- Every page must be **urgent, actionable and real**. Each alert links to a runbook and a dashboard.
- Tune or delete noisy alerts. Alert fatigue is how real pages get ignored.
- **Meta-monitoring**: something outside the system must alert when monitoring itself is down (a "dead man's switch" heartbeat alert).
`,
    keyPoints: [
      "Golden signals: latency, traffic, errors, saturation. RED for services, USE for resources.",
      "Counters → rate(); histograms aggregate across instances, summaries don't.",
      "Cardinality: never put unbounded values (user IDs) in metric labels.",
      "Use p50/p99/p99.9, never averages, and don't average percentiles.",
      "Traces need context propagation. OpenTelemetry is the standard. Tail sampling keeps the interesting ones.",
      "Page on symptoms with runbooks. Diagnose causes on dashboards.",
    ],
    code: [
      {
        title: "Instrumenting a service and alerting on it",
        variants: [
          {
            lang: "python",
            code: `
import time
from prometheus_client import Counter, Histogram, start_http_server
from opentelemetry import trace

REQUESTS = Counter("http_requests_total", "Requests", ["route", "status"])
LATENCY = Histogram(
    "http_request_duration_seconds", "Request latency", ["route"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
)
tracer = trace.get_tracer("checkout")

def handle_checkout(req):
    start = time.perf_counter()
    status = "500"
    with tracer.start_as_current_span("checkout", attributes={"cart.items": len(req.items)}):
        try:
            charge(req)          # child spans are created in the payments client
            status = "200"
            return {"ok": True}
        finally:
            # labels are bounded: route + status code, never user ids
            REQUESTS.labels("/checkout", status).inc()
            LATENCY.labels("/checkout").observe(time.perf_counter() - start)

start_http_server(9100)   # Prometheus scrapes http://host:9100/metrics
`,
          },
          {
            lang: "yaml",
            code: `
# Prometheus rules: p99 from aggregated histograms + a symptom-based alert
groups:
  - name: checkout
    rules:
      - record: route:latency_seconds:p99_5m
        expr: |
          histogram_quantile(0.99,
            sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
      - alert: CheckoutErrorRateHigh
        expr: |
          sum(rate(http_requests_total{route="/checkout", status=~"5.."}[5m]))
            / sum(rate(http_requests_total{route="/checkout"}[5m])) > 0.02
        for: 5m
        labels: { severity: page }
        annotations:
          summary: "Checkout 5xx above 2% for 5 minutes"
          runbook: "https://runbooks.example.com/checkout-errors"
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What's the difference between metrics, logs and traces, and when do you use each?",
        a: "**Metrics** are numeric time series aggregated at collection time: cheap to store and query, great for dashboards, alerting and trends, but they lose individual detail and must keep label cardinality low. **Logs** are discrete event records with arbitrary detail: good for the specifics of what happened (an error message, a request's parameters), but expensive at volume and hard to aggregate. **Traces** record a single request's path through services as timed spans: they show *where* time went and which dependency failed in a distributed call graph. Typical flow: an alert fires on a metric → an exemplar or dashboard leads to slow traces → the trace ID finds the relevant logs.",
        freq: "very-common",
      },
      {
        q: "Why shouldn't you use average latency, and why can't you average p99s?",
        a: "Latency is long-tailed: a few slow requests (GC, cache misses, retries) barely move the median but represent real users, and users making many requests per page almost certainly hit the tail. The average blends them into a number no request actually experienced, hiding regressions. Percentiles describe the experience: p50 the typical case, p99 the bad case. Percentiles aren't linear, so the p99 of the combined traffic isn't the mean of each server's p99 (one server with a bad tail can dominate). Aggregate **histograms** (sum bucket counts across instances and time), then compute the quantile.",
        freq: "common",
      },
      {
        q: "What is metric cardinality and why does it matter?",
        a: "Each unique combination of metric name and label values is a separate time series that must be indexed, held in memory and stored. Cardinality = the product of the label value counts. `http_requests_total{route, status, method}` might be 50 × 6 × 4 = 1,200 series, fine. Add `user_id` with a million users and you get a billion series: ingestion slows, memory explodes and queries time out, often taking down monitoring during the incident you need it for. Keep labels bounded (route templates, not raw URLs), put high-cardinality data in logs and traces, and enforce per-tenant series limits.",
        freq: "common",
      },
      {
        q: "How does distributed tracing work?",
        a: "When a request enters the system, a **trace ID** is created (or continued from the incoming `traceparent` header). Each unit of work records a **span** with its own ID, parent span ID, name, start time, duration, attributes and status. When a service calls another (HTTP, gRPC, or a message on a queue), it **propagates the context** in headers or message metadata, so the downstream span links to its parent. Spans are exported asynchronously (OpenTelemetry SDK → collector → backend), which reassembles the tree for a waterfall view. Sampling keeps costs manageable: head-based at the entry point, or tail-based in the collector to keep errors and slow traces.",
        freq: "common",
      },
      {
        q: "What makes a good alert?",
        a: "It fires when **users are affected or soon will be** (symptoms like SLO error-budget burn, not CPU at 80%), it's **actionable** (there's something a human should do now), it's **urgent** enough to justify interrupting someone (otherwise make it a ticket), it has **few false positives**, and it links to a **runbook** and dashboard. Use multi-window burn-rate alerts for SLOs, route by severity, group related alerts to avoid storms, and regularly review: delete alerts nobody acts on. Monitor the monitoring with a heartbeat alert routed outside the system.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which metric type can be correctly aggregated across instances into a percentile?",
        options: ["Summary", "Histogram", "Gauge", "Average"],
        answer: 1,
        explain: "Sum the bucket counts, then compute the quantile. Summaries' quantiles can't be combined.",
      },
      {
        q: "Which label would cause a cardinality explosion?",
        options: ["status_code", "http_method", "user_id", "region"],
        answer: 2,
        explain: "Unbounded values create a separate time series per value.",
      },
      {
        q: "The USE method checks…",
        options: ["Users, Sessions, Errors", "Utilization, Saturation, Errors", "Uptime, Speed, Efficiency", "Usage, Spend, Events"],
        answer: 1,
        explain: "For every resource. RED (rate, errors, duration) is for services.",
      },
      {
        q: "Tail-based sampling is better than head-based at…",
        options: ["Reducing CPU in the app", "Keeping traces of rare errors and slow requests", "Simplicity", "Lower memory in the collector"],
        answer: 1,
        explain: "It decides after the trace completes, so it can keep the interesting ones.",
      },
      {
        q: "Which should page an on-call engineer?",
        options: ["CPU at 85% on one node", "Checkout error budget burning 14× faster than allowed", "Disk 60% full", "A deploy started"],
        answer: 1,
        explain: "Page on user-facing symptoms. The others are dashboard or ticket material.",
      },
    ],
    problems: [
      { title: "Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", difficulty: "Hard", note: "Streaming percentiles: two heaps." },
      { title: "Sliding Window Median", url: "https://leetcode.com/problems/sliding-window-median/", difficulty: "Hard" },
    ],
  },

  // ------------------------------------------------------------------ SRE
  {
    id: "sre-slos",
    title: "SRE: SLIs, SLOs, Error Budgets & Incidents",
    tagline: "Define 'reliable enough', spend the budget wisely, and run incidents like a pro.",
    difficulty: "intermediate",
    minutes: 16,
    visualizers: ["slo"],
    concept: `
## SLI → SLO → SLA
- **SLI** (indicator): a measured ratio of good events to valid events. "Fraction of HTTP requests that return non-5xx in < 300 ms", "fraction of data less than 5 minutes stale".
- **SLO** (objective): the target for an SLI over a window. "99.9% of checkout requests succeed in < 300 ms over 30 days." An internal engineering goal.
- **SLA** (agreement): a contract with customers, with **consequences** (credits) if broken. Always looser than the SLO, so you hear the alarm before you owe money.

## Why not 100%?
Users can't tell 99.99% from 100% through their own flaky Wi-Fi and phones, and each extra nine costs roughly 10× more (redundancy, process, slower releases). 100% also means **never changing anything**. Pick the SLO from what users actually need, and measure as close to the user as possible.

## Error budgets
**Budget = 1 − SLO.** At 99.9% over 30 days you may "spend" 0.1% of requests, about **43 minutes** of full outage. The budget turns reliability into a shared, objective decision:
- Budget left → ship features, run experiments, take risks.
- Budget burning fast → **error budget policy** kicks in: freeze risky launches, prioritize reliability work, until back in compliance.
This ends the dev-vs-ops argument: both sides agreed on the number in advance.

## Burn-rate alerting (try the visualizer)
**Burn rate** = observed error rate ÷ budgeted error rate. 1× uses exactly the budget over the window, and 14.4× burns 2% of a 30-day budget in an hour. The **multi-window, multi-burn-rate** approach (Google SRE workbook):
| Severity | Long window | Burn rate | Budget spent |
|---|---|---|---|
| Page | 1 h (confirmed over 5 min) | 14.4× | 2% |
| Page | 6 h (confirmed over 30 min) | 6× | 5% |
| Ticket | 3 days (confirmed over 6 h) | 1× | 10% |
Fast burns wake someone up. Slow leaks become tickets. The short confirmation window makes alerts reset quickly after recovery.

## Availability math
- **Serial dependencies multiply**: A (99.9%) → B (99.9%) → C (99.9%) ≈ 99.7%. You can't exceed your weakest hard dependency.
- **Redundancy**: two independent copies of 99% are both down only 1% × 1% = 0.01% of the time → 99.99%. "Independent" is the hard part (shared deploys, config, regions, DNS).
- Remove hard dependencies: cache, degrade gracefully, make calls asynchronous.
- MTBF (mean time between failures), MTTD (to detect), MTTR (to recover). Availability ≈ MTBF ÷ (MTBF + MTTR). Cutting **MTTR** (fast detection, rollback, failover) is usually cheaper than preventing every failure.

## Incident response
1. **Detect** (symptom alerts, SLO burn) and **declare** early. It's cheap to downgrade.
2. **Roles**: an **Incident Commander** coordinates and decides (doesn't type fixes), an **Ops/tech lead** investigates and mitigates, a **Comms lead** updates stakeholders and the status page on a cadence, and a **scribe** keeps the timeline.
3. **Mitigate first**: roll back, fail over, shed load, disable the feature flag, scale up. Understanding comes later.
4. **Communicate**: regular updates with what's known, impact, next update time.
5. **Resolve**, then monitor for recurrence.

## Blameless postmortems
Written for significant incidents: impact, timeline, detection, response, **root cause and contributing factors**, what went well, where we got lucky, and **action items with owners and dates**. Blameless means assuming people acted reasonably with the information they had, and fixing the system that let a human error reach production. Share them widely. Learning compounds.

## Toil and on-call health
**Toil** is manual, repetitive, automatable work that scales with traffic. Google SRE caps it at ~50% of an engineer's time; the rest goes to engineering that removes it. Healthy on-call: a few actionable pages per shift, follow-the-sun or reasonable rotations, compensation, and every page reviewed.
`,
    keyPoints: [
      "SLI = good/valid events. SLO = internal target. SLA = contract, looser than the SLO.",
      "Error budget = 1 − SLO. Spend it on velocity, and freeze launches when it's gone.",
      "Burn rate = error rate ÷ budget rate. Use multi-window alerts: 14.4× pages fast, 1× tickets.",
      "Serial availability multiplies down. Independent redundancy multiplies failures down.",
      "Incidents: declare early, Incident Commander + roles, mitigate before root-causing.",
      "Blameless postmortems with owned action items turn incidents into improvements.",
    ],
    code: [
      {
        title: "An SLO and its burn rate",
        variants: [
          {
            lang: "yaml",
            code: `
# SLO definition (Sloth / OpenSLO style). Tooling generates the recording rules and burn-rate alerts.
version: prometheus/v1
service: checkout
slos:
  - name: requests-availability
    objective: 99.9                     # 30-day window by default
    description: "Checkout requests succeed"
    sli:
      events:
        error_query: sum(rate(http_requests_total{route="/checkout",status=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_requests_total{route="/checkout"}[{{.window}}]))
    alerting:
      name: CheckoutAvailability
      page_alert: { labels: { severity: page } }        # 14.4x/1h and 6x/6h
      ticket_alert: { labels: { severity: ticket } }    # 3x/1d and 1x/3d
`,
          },
          {
            lang: "python",
            code: `
def burn_rate(errors: int, total: int, slo: float) -> float:
    """How many times faster than 'allowed' we are spending the error budget."""
    if total == 0:
        return 0.0
    error_rate = errors / total
    budget = 1 - slo                    # e.g. 0.001 for 99.9%
    return error_rate / budget

def should_page(long_window, short_window, slo=0.999, threshold=14.4):
    # Both windows must burn fast: the long one proves it's significant,
    # the short one proves it's still happening (so the alert resets quickly).
    return (burn_rate(*long_window, slo) >= threshold and
            burn_rate(*short_window, slo) >= threshold)

# 1 h: 2,000 errors of 120,000 requests; 5 min: 180 of 10,000
print(burn_rate(2_000, 120_000, 0.999))                     # 16.7x
print(should_page((2_000, 120_000), (180, 10_000)))         # True
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Explain SLI, SLO and SLA with an example.",
        a: "For a checkout API: the **SLI** is the proportion of valid checkout requests that return a non-5xx response within 300 ms, measured at the load balancer. The **SLO** is that this SLI is at least 99.9% over a rolling 30 days, an internal target that drives alerting and prioritization. The **SLA** is the external contract: 99.5% monthly availability, or customers get a 10% credit. The SLA is looser than the SLO so engineering reacts long before contractual penalties apply. The 0.1% gap below 100% is the **error budget**.",
        freq: "very-common",
      },
      {
        q: "What is an error budget and how does it change how a team works?",
        a: "The error budget is the allowed unreliability: 1 − SLO over the window (99.9% over 30 days ≈ 43 minutes of full outage, or 0.1% of requests). While budget remains, the team can deploy frequently, run experiments and accept risk. When it's exhausted (or burning too fast), an agreed **error budget policy** applies: pause feature launches, focus on reliability fixes, require extra review for risky changes. It aligns product and SRE on one objective number instead of opinions, and makes \"is it reliable enough?\" a data question.",
        freq: "common",
      },
      {
        q: "You're the on-call engineer and get paged at 3 AM for elevated errors. Walk me through it.",
        a: "Acknowledge the page and assess impact on the SLO dashboard: how many users, which endpoints, since when. If it's significant, **declare an incident**, open a channel, take Incident Commander or pull in help. Check **what changed** (deploys, config, feature flags, traffic, dependencies) because most incidents follow a change. **Mitigate first**: roll back the deploy, disable the flag, fail over, shed load or scale. Communicate status at regular intervals, and update the status page if customers notice. Once stable, verify the metrics are back to baseline, hand off or document, and schedule a **blameless postmortem** with action items. Don't attempt a risky root-cause fix at 3 AM if a safe mitigation exists.",
        freq: "very-common",
      },
      {
        q: "Your service depends on five services, each 99.9% available. What availability can you offer?",
        a: "If all are hard dependencies in series and failures are independent: 0.999⁵ ≈ **99.5%**, lower than any single dependency. To do better: make dependencies **soft** (cache their responses, serve stale or degraded results, make calls async via a queue), add **redundancy** across independent failure domains (two independent 99.9% copies → 99.9999% if truly independent), use timeouts and circuit breakers so a slow dependency doesn't become your outage, and negotiate SLOs with dependency owners. Your SLO must be realistic given the dependency tree.",
        freq: "common",
      },
      {
        q: "What makes a postmortem blameless, and why does it matter?",
        a: "It focuses on **how the system allowed the failure**, not who made the mistake. People act reasonably given their information, tools and pressures, so \"human error\" is a starting point for questions (why was the dangerous command easy, why didn't the deploy pipeline catch it, why did detection take 40 minutes?), not a conclusion. Blame makes people hide information, and you lose the details you need to prevent recurrence. A good postmortem has impact, a timeline, contributing factors, what went well and where we got lucky, and concrete, owned, tracked action items, and it's shared widely.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "99.9% availability over 30 days allows about…",
        options: ["4 minutes", "43 minutes", "7 hours", "3.6 days"],
        answer: 1,
        explain: "0.1% × 43,200 minutes ≈ 43.2 minutes.",
      },
      {
        q: "Which should be strictest?",
        options: ["The SLA", "The SLO", "They should be equal", "Neither: aim for 100%"],
        answer: 1,
        explain: "The internal SLO is tighter so you react before contractual penalties.",
      },
      {
        q: "Error rate 1% with a 99.9% SLO is a burn rate of…",
        options: ["0.1×", "1×", "10×", "100×"],
        answer: 2,
        explain: "0.01 ÷ 0.001 = 10× faster than the budget allows.",
      },
      {
        q: "Three serial hard dependencies at 99.9% each give roughly…",
        options: ["99.9%", "99.7%", "99.99%", "97%"],
        answer: 1,
        explain: "0.999³ ≈ 0.997.",
      },
      {
        q: "During a major incident the Incident Commander should mainly…",
        options: ["Write the fix", "Coordinate, decide and keep communication flowing", "Write the postmortem", "Find who caused it"],
        answer: 1,
        explain: "The IC keeps the big picture. Others investigate and mitigate.",
      },
      {
        q: "First priority when a bad deploy causes errors?",
        options: ["Find the root cause", "Mitigate (roll back), then investigate", "Write a postmortem", "Add more logging"],
        answer: 1,
        explain: "Restore service first. Understanding can wait for users to be fine.",
      },
    ],
  },

  // ------------------------------------------------------------------ DISASTER RECOVERY
  {
    id: "disaster-recovery",
    title: "Disaster Recovery, Multi-Region & Chaos Engineering",
    tagline: "RTO, RPO and the price of each nine: backups, failover, cells and breaking things on purpose.",
    difficulty: "advanced",
    minutes: 16,
    diagram: {
      title: "Warm standby across two regions",
      nodes: [
        { id: "users", label: "Users", kind: "client", x: 80, y: 290 },
        { id: "dns", label: "Global DNS / anycast", sub: "health-checked failover", kind: "dns", x: 280, y: 290 },
        { id: "lbE", label: "LB · us-east", sub: "primary region", kind: "lb", x: 500, y: 130 },
        { id: "appE", label: "App · us-east", sub: "full capacity", kind: "service", x: 720, y: 130 },
        { id: "dbE", label: "DB primary · us-east", kind: "db", x: 920, y: 130 },
        { id: "lbW", label: "LB · eu-west", sub: "standby region", kind: "lb", x: 500, y: 450 },
        { id: "appW", label: "App · eu-west", sub: "scaled down", kind: "service", x: 720, y: 450 },
        { id: "dbW", label: "DB replica · eu-west", sub: "async, seconds behind", kind: "db", x: 920, y: 450 },
        { id: "backup", label: "Backups", sub: "cross-region, immutable", kind: "storage", x: 920, y: 290 },
      ],
      edges: [
        { from: "users", to: "dns" },
        { from: "dns", to: "lbE" },
        { from: "dns", to: "lbW", dashed: true },
        { from: "lbE", to: "appE" },
        { from: "appE", to: "dbE" },
        { from: "lbW", to: "appW" },
        { from: "appW", to: "dbW" },
        { from: "dbE", to: "dbW", label: "async replication" },
        { from: "dbE", to: "backup", label: "snapshots + WAL" },
        { from: "backup", to: "dbW", dashed: true },
      ],
      flows: [
        {
          name: "Normal operation",
          path: ["users", "dns", "lbE", "appE", "dbE", "dbW"],
          steps: [
            "Users resolve the app's name.",
            "DNS answers with the healthy primary region (short TTL, health checks every few seconds).",
            "The us-east load balancer routes to the app tier.",
            "Reads and writes hit the primary database.",
            "Changes stream asynchronously to eu-west. Replication lag (a few seconds) is the RPO you'd lose in a sudden regional failure.",
          ],
        },
        {
          name: "Region failure → failover",
          path: ["dns", "lbW", "appW", "dbW", "appW", "lbW"],
          steps: [
            "us-east health checks fail. After a few consecutive failures (and ideally a human or automated decision to avoid flapping), DNS answers with eu-west. Clients honor the TTL, so a 60 s TTL means a minute or more of stragglers.",
            "Traffic arrives at the standby region. Autoscaling ramps the scaled-down app tier to full size. Pre-warming capacity is what makes 'warm' standby faster than 'pilot light'.",
            "The replica is promoted to primary. Writes from the last few seconds before the failure may be lost (RPO > 0 with async replication). Old-primary writes must be fenced so it can't come back as a second leader (split brain).",
            "The app now reads and writes in eu-west.",
            "Service restored. RTO = detection + decision + DNS propagation + promotion + scale-up. Practice it, because untested failover usually fails.",
          ],
        },
        {
          name: "Restore from backup",
          path: ["dbE", "backup", "dbW"],
          steps: [
            "Snapshots and continuous WAL/binlog archiving go to immutable, cross-region (ideally cross-account) storage. Ransomware and a fat-fingered DROP TABLE replicate instantly, but backups don't.",
            "Point-in-time recovery: restore the last snapshot, then replay the log up to just before the bad event. Test restores regularly and measure how long they take. That time is your real RTO for data corruption.",
          ],
        },
      ],
    },
    concept: `
## Two numbers drive every DR decision
- **RTO** (Recovery Time Objective): how long until service is restored.
- **RPO** (Recovery Point Objective): how much data (in time) you can afford to lose.
Ask the business, per system: payments may need RPO ≈ 0 and RTO of minutes, while an analytics dashboard can lose a day and come back tomorrow. Lower RTO/RPO costs exponentially more.

## Replication is not a backup
Replication copies **mistakes** instantly: a bad migration, a \`DELETE\` without \`WHERE\`, ransomware. You need **backups** too:
- **3-2-1**: 3 copies, on 2 different media, with 1 off-site. Modern: immutable (object lock), in a separate account and region.
- **Point-in-time recovery**: full snapshots + continuous log archiving (WAL/binlog), so you can restore to 14:31:59, just before the mistake.
- **Test restores** on a schedule. A backup you've never restored is a hope, not a backup. Measure restore time, because that is your real RTO for data-loss incidents.

## DR strategies (cheapest → fastest)
| Strategy | Standby region runs… | RTO | RPO | Cost |
|---|---|---|---|---|
| **Backup & restore** | Nothing; rebuild from IaC + backups | Hours–days | Hours (last backup) | $ |
| **Pilot light** | Data replication + minimal core; compute off | Tens of minutes | Seconds–minutes | $$ |
| **Warm standby** | A scaled-down but working copy | Minutes | Seconds | $$$ |
| **Multi-site active-active** | Full capacity, serving traffic | ~0 (reroute) | ~0 to seconds | $$$$ |
Infrastructure as Code is what makes the cheaper options viable: you can't rebuild a region from memory.

## Multi-region data is the hard part
- **Async replication** (most common): low write latency, RPO > 0, and failover must handle lost writes.
- **Synchronous** cross-region: RPO 0, but every write pays the inter-region RTT (70+ ms across the Atlantic).
- **Active-active writes** need conflict handling: partition data by home region (each user's data has one writable region), CRDTs, or last-writer-wins (lossy). Or use globally consistent databases (Spanner, CockroachDB) that use consensus and pay latency on writes.
- **Split brain**: if the old primary comes back and still accepts writes, you have two leaders. Fence it (revoke credentials, STONITH, epoch numbers).

## Failover mechanics
DNS failover (health checks + short TTLs, but some clients cache too long), anycast/global load balancers (faster, no DNS caching issue), client-side region lists. Decide in advance whether failover is **automatic** (fast, but risks flapping or false positives) or **human-triggered with a one-click runbook** (slower, safer for data stores). Failing back is often harder than failing over: re-sync data first.

## Limiting blast radius
- **Cell-based architecture**: split the system into independent cells (each a full stack serving a subset of customers). A bad deploy or poison-pill request takes out one cell, not everyone. Deploy cell by cell.
- **Shuffle sharding**: give each customer a random subset of workers, so a noisy or malicious customer only shares a small fraction of capacity with any other customer.
- **Static stability**: the data plane keeps working when the control plane is down. Don't make recovery depend on the thing that failed (e.g. needing to launch instances during an outage of the instance-launching service, or your DR runbook living on the wiki in the dead region).
- Watch for **hidden global dependencies**: one region's IAM/DNS/control plane, a single CI system, a third-party SaaS.

## Chaos engineering
Prove resilience instead of assuming it:
1. Define **steady state** (SLIs, e.g. checkout success rate).
2. Hypothesize: "if we kill one AZ's instances, steady state holds."
3. Inject the failure (terminate instances, add latency, drop a dependency, fill a disk) with a **small blast radius** and an abort button.
4. Compare, fix what broke, expand the scope.
Tools: Chaos Monkey (Netflix), AWS FIS, Gremlin, Litmus/Chaos Mesh for Kubernetes. **Game days** rehearse whole scenarios (region evacuation) with real people and runbooks. They're how teams discover that the failover script needs a credential nobody has.
`,
    keyPoints: [
      "RTO = time to recover, RPO = data you can lose. Set them per system with the business.",
      "Replication isn't backup: keep immutable, off-site, point-in-time backups and test restores.",
      "Backup/restore → pilot light → warm standby → active-active: faster recovery, higher cost.",
      "Async cross-region replication means RPO > 0 and split-brain risk, so fence the old primary.",
      "Cells, shuffle sharding and static stability limit blast radius.",
      "Chaos engineering: steady state, hypothesis, small blast radius, then expand.",
    ],
    code: [
      {
        title: "Test the restore, not just the backup",
        variants: [
          {
            lang: "bash",
            code: `
#!/usr/bin/env bash
# Nightly restore drill: restore yesterday's backup into a scratch instance,
# run sanity checks, record how long it took (your real RTO), then clean up.
set -euo pipefail
START=$(date +%s)
TARGET="restore-drill-$(date +%Y%m%d)"

aws rds restore-db-instance-to-point-in-time \\
  --source-db-instance-identifier prod-main \\
  --target-db-instance-identifier "$TARGET" \\
  --restore-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \\
  --db-instance-class db.r6g.large --no-multi-az

aws rds wait db-instance-available --db-instance-identifier "$TARGET"
HOST=$(aws rds describe-db-instances --db-instance-identifier "$TARGET" \\
  --query 'DBInstances[0].Endpoint.Address' --output text)

# Sanity checks: the data is there and recent
psql "host=$HOST dbname=app user=drill" -c "select count(*) from orders where created_at > now() - interval '2 hours';"

echo "restore_drill_seconds $(( $(date +%s) - START ))" | curl --data-binary @- http://pushgateway:9091/metrics/job/restore_drill
aws rds delete-db-instance --db-instance-identifier "$TARGET" --skip-final-snapshot
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What are RTO and RPO, and how do they influence architecture?",
        a: "**RTO** is the maximum acceptable time to restore service after a disaster. **RPO** is the maximum acceptable data loss measured in time. They select the strategy: RPO of 24 h allows nightly backups, RPO of seconds requires continuous replication, and RPO 0 requires synchronous replication (paying write latency). RTO of days allows rebuilding from IaC and backups, RTO of minutes needs a warm standby with automated or one-click failover, and near-zero RTO needs active-active. Each step is much more expensive, so set them per system with the business, and validate them in drills because the documented RTO is often fiction.",
        freq: "very-common",
      },
      {
        q: "Design a disaster recovery plan for a critical service in one cloud region.",
        a: "Agree on RTO/RPO first (say 15 min / 1 min). Then: **infrastructure as code** that can stand the stack up in a second region; **data**: async cross-region database replication (RPO ≈ seconds) plus immutable cross-account backups with point-in-time recovery for corruption scenarios; a **warm standby** region running a scaled-down copy with the same images and config; **failover**: health-checked DNS or a global load balancer, a runbook (ideally one command) to promote the replica, fence the old primary and scale up; **dependencies** audited for hidden single-region ties (secrets, CI, auth, third parties); **regular game days** that actually fail over, measuring real RTO/RPO; and a failback procedure. Monitor replication lag as an SLI.",
        freq: "common",
      },
      {
        q: "Active-active multi-region: what makes it hard?",
        a: "Writes. If two regions accept writes to the same data, you need conflict resolution: route each user or tenant to a single **home region** for writes (partitioning, the most common approach), use **CRDTs** or merge logic, accept **last-writer-wins** (and lost updates), or use a **globally consistent database** (Spanner, CockroachDB) where writes pay cross-region consensus latency. Also: global uniqueness (IDs, usernames), cache invalidation across regions, sticky sessions vs failover, capacity (each region must absorb the others' load), data residency laws, and operating two of everything. The payoff is near-zero RTO and lower latency for global users.",
        freq: "common",
      },
      {
        q: "What is chaos engineering? Isn't breaking production irresponsible?",
        a: "It's running **controlled experiments** to verify the system tolerates turbulent conditions: define steady state with SLIs, hypothesize that steady state holds under a failure (an instance dies, a dependency adds 500 ms, an AZ disappears), inject it with a minimal blast radius and automatic abort conditions, and learn from the difference. Failures will happen in production anyway, at 3 AM and at full scale. Chaos engineering moves the discovery to a planned time, with everyone watching and a stop button. Start in staging and with game days, then graduate to small, automated production experiments as confidence grows.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "RPO measures…",
        options: ["How long recovery takes", "How much data (in time) you can lose", "Requests per operation", "Replica count"],
        answer: 1,
        explain: "RTO = time to recover. RPO = data loss window.",
      },
      {
        q: "Why isn't database replication a backup?",
        options: ["It's too slow", "It replicates deletes and corruption too", "It's not encrypted", "Replicas can't be read"],
        answer: 1,
        explain: "A DROP TABLE reaches the replica in milliseconds. You need point-in-time backups.",
      },
      {
        q: "Which DR strategy keeps a scaled-down but running copy of the stack?",
        options: ["Backup & restore", "Pilot light", "Warm standby", "Active-active"],
        answer: 2,
        explain: "Pilot light keeps only data and minimal core running; warm standby can serve after scaling up.",
      },
      {
        q: "After failing over to a replica, the old primary comes back and accepts writes. This is…",
        options: ["Read repair", "Split brain", "Sharding", "Graceful degradation"],
        answer: 1,
        explain: "Two leaders diverge. Fence the old primary.",
      },
      {
        q: "Cell-based architecture primarily reduces…",
        options: ["Latency", "Blast radius", "Cost", "Code size"],
        answer: 1,
        explain: "A failure or bad deploy affects one cell's customers, not everyone.",
      },
    ],
  },

  // ------------------------------------------------------------------ CASE STUDY
  {
    id: "case-monitoring",
    title: "Case Study: Metrics & Alerting Platform",
    tagline: "Design Datadog / Prometheus at scale: ingestion, time-series storage, queries and alerts.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "Metrics platform (Prometheus / Mimir / Datadog-style)",
      nodes: [
        { id: "agents", label: "Agents & exporters", sub: "on every host / pod", kind: "client", x: 90, y: 280 },
        { id: "gw", label: "Ingest gateway", sub: "auth · limits · validation", kind: "gateway", x: 280, y: 280 },
        { id: "kafka", label: "Write log", sub: "Kafka, partitioned by series", kind: "queue", x: 470, y: 280 },
        { id: "ing", label: "Ingesters", sub: "in-memory head + WAL, RF=3", kind: "service", x: 660, y: 280 },
        { id: "s3", label: "Object storage", sub: "2 h blocks, years of data", kind: "storage", x: 880, y: 280 },
        { id: "compactor", label: "Compactor", sub: "merge · downsample · retain", kind: "worker", x: 880, y: 480 },
        { id: "query", label: "Query frontend", sub: "split · cache · fan-out", kind: "service", x: 660, y: 80 },
        { id: "grafana", label: "Dashboards", sub: "Grafana", kind: "client", x: 880, y: 80 },
        { id: "rules", label: "Rule evaluator", sub: "recording + alert rules", kind: "worker", x: 470, y: 80 },
        { id: "am", label: "Alertmanager", sub: "group · dedupe · route", kind: "service", x: 280, y: 80 },
        { id: "pager", label: "PagerDuty / Slack", kind: "external", x: 90, y: 80 },
      ],
      edges: [
        { from: "agents", to: "gw", label: "push / remote-write" },
        { from: "gw", to: "kafka" },
        { from: "kafka", to: "ing" },
        { from: "ing", to: "s3", label: "flush blocks" },
        { from: "s3", to: "compactor" },
        { from: "query", to: "ing", label: "recent" },
        { from: "query", to: "s3", label: "historical" },
        { from: "grafana", to: "query" },
        { from: "rules", to: "query" },
        { from: "rules", to: "am" },
        { from: "am", to: "pager" },
      ],
      flows: [
        {
          name: "Write path",
          path: ["agents", "gw", "kafka", "ing", "s3", "compactor"],
          steps: [
            "Agents scrape local exporters every 10–15 s and send compressed batches of samples (series labels + timestamp + value) to the nearest ingest endpoint.",
            "The gateway authenticates the tenant, enforces rate and series-cardinality limits (rejecting a team that just added user_id as a label), and appends the samples to a durable log partitioned by series hash, so bursts are absorbed and ingester restarts lose nothing.",
            "Each ingester owns a shard of series (consistent hashing, replication factor 3). Recent samples live in an in-memory head block, compressed with Gorilla encoding (~1.4 bytes/sample), with a WAL for crash recovery.",
            "Every 2 hours the head is cut into an immutable block (chunks + label index) and uploaded to object storage: cheap, durable, effectively infinite.",
            "The compactor merges small blocks into larger ones, deduplicates the 3 replicas, builds 5 m and 1 h downsampled rollups, and deletes data past retention.",
          ],
        },
        {
          name: "Dashboard query",
          path: ["grafana", "query", "ing", "query", "s3", "query", "grafana"],
          steps: [
            "A dashboard asks: p99 latency by service for the last 7 days.",
            "The query frontend splits it by day (cached results are reused), then queries ingesters for the last ~2 hours…",
            "…which answer from memory.",
            "…and reads older days from object-storage blocks, using the label index (postings lists) to find matching series and downsampled data for long ranges.",
            "Partial results are merged, deduplicated across replicas and aggregated (sum by le, then histogram_quantile).",
            "Rendered in a few hundred milliseconds. Per-query limits on series and samples stop one heavy query from hurting everyone.",
          ],
        },
        {
          name: "Alert fires",
          path: ["rules", "query", "rules", "am", "pager"],
          steps: [
            "Every 30–60 s the rule evaluator runs each tenant's alert expressions (e.g. checkout SLO burn rate > 14.4 over 1 h and 5 m).",
            "The condition holds for its 'for' duration, so the alert moves from pending to firing.",
            "Firing alerts are sent to an Alertmanager cluster (replicated, gossiping to deduplicate).",
            "It groups related alerts (one page for 50 failing pods, not 50 pages), applies silences and inhibitions, routes by labels (team, severity) and sends notifications with the runbook link. A heartbeat alert to an external service proves the pipeline itself is alive.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: ingest metrics from every host and service, query them (dashboards, ad-hoc), evaluate alert rules and notify, multi-tenant.
**Non-functional**: very high write throughput, near-real-time (data queryable within ~seconds), recent data fast, history cheap, highly available (especially alerting: monitoring must be up when everything else is down), cardinality protection.

## 2. Estimation
- 50,000 hosts × 2,000 series each = **100M active series**.
- Scraped every 10 s → **10M samples/s** ingested.
- Raw sample = 16 bytes (8-byte timestamp + 8-byte float). With Gorilla compression ≈ **1.4 bytes** → 10M × 1.4 B = 14 MB/s ≈ **1.2 TB/day**, ×3 replicas before compaction dedup.
- Hot head in memory: ~2 h of samples across the ingester fleet, plus index (labels can dominate memory, which is why cardinality matters).
- Reads: dashboards are mostly recent and aggregated. Alerts evaluate thousands of rules per minute.

## 3. Data model and API
A **series** is identified by a metric name + sorted label set (\`http_requests_total{service="checkout", status="500"}\`). A **sample** is (timestamp, float64). Ingestion: push (Prometheus remote-write, OTLP, StatsD) or pull (scrape). Query: PromQL-like language over label matchers, range functions (\`rate\`), aggregations and quantiles.

## 4. Write path (see the diagram)
- Stateless gateways for auth, limits and validation → **Kafka** (or replicated ingesters directly) as a buffer.
- **Ingesters** shard series by hash with a replication factor of 3. Each keeps a mutable **head block** in memory plus a **WAL**.
- **Time-series compression (Gorilla, Facebook 2015)**: timestamps are regular, so store the **delta-of-delta** (usually 0 → 1 bit). Consecutive values are similar, so store the **XOR** with the previous value (mostly leading and trailing zeros). Result ≈ 12× smaller.
- Every 2 h the head becomes an **immutable block** (compressed chunks + an **inverted index** from label=value → postings list of series IDs) uploaded to **object storage**.

## 5. Storage lifecycle
- **Compaction**: merge 2 h blocks into 12 h, 24 h and larger blocks (fewer files and index lookups), dedupe replicas.
- **Downsampling**: keep raw data ~15 days, 5-minute rollups (min/max/sum/count) for months, 1-hour rollups for years. A 1-year graph never touches raw samples.
- Object storage makes long retention cheap and lets query and storage scale independently (Thanos, Cortex/Mimir, M3 follow this design).

## 6. Read path
Query frontends split long ranges into intervals, **cache** results (yesterday doesn't change), shard queries by series, and fan out to ingesters (recent data) and store gateways (blocks). The label index intersects postings lists for matchers like \`{service="checkout", status=~"5.."}\`. Protect the system with per-tenant limits on series touched, samples scanned and query time.

## 7. Alerting
Rule evaluators run recording rules (precompute expensive aggregations) and alert rules on a schedule. Firing alerts go to a replicated **Alertmanager**: group, deduplicate, silence, inhibit (no "service down" page when the "cluster down" alert is already firing), route by team and severity. Alerting should depend on as little as possible (evaluate close to ingestion and keep it in-region), and **meta-monitoring** watches the watcher: a constantly-firing heartbeat alert to an external service, which pages if it stops arriving.

## 8. Deep dives interviewers like
- **Cardinality explosions**: per-tenant series limits at the gateway, top-N cardinality reports, dropping or relabeling labels on ingest.
- **Push vs pull**: pull gives you up/down detection for free and lets the server control load. Push works for short-lived jobs, serverless and through NAT. Big systems support both.
- **Late and out-of-order samples**: accept within a window into the head, reject older ones.
- **Multi-tenancy**: tenant ID on every series, fair queuing in queries, isolation of noisy neighbors (shuffle sharding of tenants onto ingesters).
- **High availability for alerts**: two independent rule-evaluation paths, or Alertmanager replicas deduplicating the same alert.
`,
    keyPoints: [
      "100M series × 10 s scrape ≈ 10M samples/s: shard series across replicated ingesters.",
      "Gorilla compression (delta-of-delta timestamps, XOR values) ≈ 1.4 bytes/sample.",
      "In-memory head + WAL → immutable 2 h blocks with an inverted label index → object storage.",
      "Compaction and downsampling: raw for days, rollups for months and years.",
      "Query frontend splits, caches and fans out, with per-tenant limits for safety.",
      "Alertmanager groups, dedupes, silences and routes, and meta-monitoring watches it.",
    ],
    code: [
      {
        title: "Delta-of-delta timestamp encoding (the Gorilla idea)",
        variants: [
          {
            lang: "python",
            code: `
def encode_timestamps(ts):
    """Return the first timestamp, the first delta, then delta-of-deltas.
    Regular scrapes make almost every delta-of-delta 0, which Gorilla stores in 1 bit."""
    if len(ts) < 2:
        return ts
    out = [ts[0], ts[1] - ts[0]]
    prev_delta = ts[1] - ts[0]
    for a, b in zip(ts[1:], ts[2:]):
        delta = b - a
        out.append(delta - prev_delta)
        prev_delta = delta
    return out

def xor_values(values):
    """Consecutive float64s from a gauge are similar, so their XOR is mostly zero bits.
    Gorilla stores only the meaningful middle bits."""
    import struct
    bits = [struct.unpack(">Q", struct.pack(">d", v))[0] for v in values]
    return [bits[0]] + [a ^ b for a, b in zip(bits, bits[1:])]

ts = [1700000000, 1700000010, 1700000020, 1700000030, 1700000041, 1700000050]
print(encode_timestamps(ts))   # [1700000000, 10, 0, 0, 1, -2]  → mostly tiny numbers
print([hex(x) for x in xor_values([42.0, 42.0, 42.5])][1:])   # ['0x0', '0x400000000000']
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Design a metrics monitoring and alerting system like Datadog or Prometheus at scale.",
        a: "Clarify the scale (e.g. 100M active series, 10 s resolution → 10M samples/s), retention (raw 15 days, rollups for a year), query latency and multi-tenancy. **Write path**: agents push batches to stateless gateways (auth, rate and cardinality limits) → a partitioned log for buffering → **ingesters** sharded by series hash with replication factor 3, holding an in-memory head with Gorilla compression and a WAL → every 2 h flush **immutable blocks** (chunks + inverted label index) to **object storage**; a **compactor** merges, dedupes, downsamples and enforces retention. **Read path**: query frontends split and cache by time range and fan out to ingesters (recent) and block stores (historical), with per-tenant query limits. **Alerting**: rule evaluators run on a schedule → a replicated Alertmanager groups, dedupes, silences and routes to PagerDuty/Slack, plus external heartbeat monitoring. Discuss cardinality control, push vs pull, late data and HA of the alerting path.",
        freq: "common",
      },
      {
        q: "Why is time-series data compressible, and how does Gorilla compression work?",
        a: "Samples arrive at regular intervals and values change slowly. **Timestamps**: store the delta-of-delta: with a 10 s interval the delta is always 10, so the delta-of-delta is 0 and encoded in a single bit, with small variable-length codes for jitter. **Values**: XOR each float64 with the previous one. Similar values share sign, exponent and high mantissa bits, so the XOR has long runs of leading and trailing zeros, and only the meaningful bits are stored (identical values cost 1 bit). Facebook's paper reported ~1.37 bytes per 16-byte sample, about 12× compression, which is what makes keeping recent data in memory affordable.",
        freq: "occasional",
      },
      {
        q: "How do you protect a shared metrics system from one team's cardinality explosion?",
        a: "Enforce **per-tenant limits** at ingestion: maximum active series, samples per second, labels per series, label value length. Reject or drop over-limit series with clear errors and metrics so teams notice. Provide **cardinality analysis** (top metrics and labels by series count) and alert teams before they hit limits. Support **relabeling** rules to drop or aggregate offending labels at the edge. Isolate tenants with **shuffle sharding** so one tenant's overload only affects a few ingesters. On the read side, limit series and samples per query. Educate: IDs belong in logs and traces, not metric labels.",
        freq: "occasional",
      },
      {
        q: "Push vs pull for metrics collection?",
        a: "**Pull** (Prometheus scraping): the server controls the rate and can't be flooded, a target that stops answering is detected automatically (`up == 0`), and targets are discovered from the platform (Kubernetes API). But it needs network reachability into every target and is awkward for short-lived jobs. **Push** (StatsD, OTLP, remote-write, agents): works through NAT and firewalls, for batch jobs, serverless and edge devices, and agents can buffer and batch, but you need separate liveness detection and protection against floods. At scale, hybrids are common: local agents scrape (pull) nearby targets and push batches to the central system.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "100M active series scraped every 10 s produce how many samples per second?",
        options: ["1M", "10M", "100M", "1B"],
        answer: 1,
        explain: "100,000,000 ÷ 10 = 10,000,000 samples/s.",
      },
      {
        q: "Gorilla compresses timestamps by storing…",
        options: ["Full timestamps", "Delta-of-deltas", "XOR of timestamps", "Only the first timestamp"],
        answer: 1,
        explain: "Regular intervals make delta-of-delta almost always 0.",
      },
      {
        q: "Why downsample old metrics?",
        options: ["Raw data is inaccurate", "Long-range queries and storage get cheaper", "Required by PromQL", "To increase cardinality"],
        answer: 1,
        explain: "A 1-year graph doesn't need 10-second resolution.",
      },
      {
        q: "Alertmanager's grouping feature…",
        options: ["Creates alert rules", "Combines related alerts into one notification", "Stores metrics", "Computes percentiles"],
        answer: 1,
        explain: "One page for 50 failing pods instead of 50 pages.",
      },
      {
        q: "How do you detect that the alerting pipeline itself is broken?",
        options: ["You can't", "An always-firing heartbeat alert checked by an external service", "More dashboards", "Lower scrape intervals"],
        answer: 1,
        explain: "A dead man's switch: silence means something is wrong.",
      },
    ],
    problems: [
      { title: "Design Hit Counter", url: "https://leetcode.com/problems/design-hit-counter/", difficulty: "Medium", note: "Premium: counting events in a sliding time window." },
      { title: "Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/", difficulty: "Medium", note: "Binary search over timestamps, the core of time-series lookups." },
    ],
  },
];
