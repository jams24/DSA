import type { Lesson } from "../types";

// Kubernetes, part 6: two projects (shorty on Kubernetes, your own operator) and the interview lesson.

export const kubernetesPart6: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT 1: SHORTY ON KUBERNETES
  {
    id: "k8s-project-deploy",
    part: "Part 6 · Projects and interview",
    title: "Project: run shorty on Kubernetes",
    tagline: "Take the Docker world's link shortener to a cluster: a StatefulSet database with its own disk, a hardened Deployment with the right probes, a Service, an Ingress, a NetworkPolicy, a disruption budget and an autoscaler, all deployed with one kubectl apply -k and proven by a smoke test of 21 checks.",
    difficulty: "advanced",
    minutes: 75,
    diagram: {
      title: "shorty on Kubernetes",
      nodes: [
        { id: "user", label: "You", kind: "client", x: 80, y: 280, sub: "shorty.example.com" },
        { id: "ing", label: "Ingress", kind: "gateway", x: 250, y: 280, sub: "Traefik, host rule" },
        { id: "svc", label: "Service shorty", kind: "lb", x: 430, y: 280, sub: "ClusterIP :80" },
        { id: "pods", label: "shorty pods", kind: "service", x: 620, y: 280, sub: "2 to 6, non-root, read-only" },
        { id: "hpa", label: "HPA + PDB", kind: "monitor", x: 620, y: 80, sub: "70% CPU · minAvailable 1" },
        { id: "secret", label: "Secret db-password", kind: "storage", x: 620, y: 480, sub: "mounted as a file" },
        { id: "pg", label: "postgres-0", kind: "db", x: 840, y: 280, sub: "StatefulSet + headless Service" },
        { id: "pvc", label: "PVC data-postgres-0", kind: "storage", x: 840, y: 480, sub: "1Gi, outlives the pod" },
        { id: "np", label: "NetworkPolicy", kind: "gateway", x: 840, y: 80, sub: "only app=shorty → 5432" },
      ],
      edges: [
        { from: "user", to: "ing" },
        { from: "ing", to: "svc", label: "Host: shorty.example.com" },
        { from: "svc", to: "pods", label: "Ready pods only" },
        { from: "hpa", to: "pods", dashed: true, label: "scales, limits evictions" },
        { from: "secret", to: "pods", label: "/run/secrets/db" },
        { from: "secret", to: "pg", dashed: true },
        { from: "pods", to: "pg", label: "postgres:5432" },
        { from: "np", to: "pg", dashed: true },
        { from: "pg", to: "pvc" },
      ],
      flows: [
        {
          name: "kubectl apply -k .",
          path: ["secret", "pg", "pvc", "pg", "pods", "svc", "ing"],
          steps: [
            "Kustomize generates the db-password Secret and the init.sql ConfigMap (with hashed names) and applies everything to quest-shorty. postgres-0 mounts the password as a file.",
            "The StatefulSet's volumeClaimTemplate creates PVC data-postgres-0, and the storage provisioner gives it a disk.",
            "The disk is empty, so Postgres runs init.sql and creates the links table. pg_isready passes: postgres-0 is Ready.",
            "The shorty pods start. Their startup probe (/livez) gives them up to 60 s to connect to postgres:5432.",
            "/readyz runs SELECT 1 and passes, so each pod joins the Service's EndpointSlice and starts getting traffic.",
            "The ingress controller sees the Ingress and routes shorty.example.com to the Service.",
          ],
        },
        {
          name: "Follow a short link",
          path: ["user", "ing", "svc", "pods", "pg", "pvc"],
          steps: [
            "GET http://shorty.example.com/s2zn5f arrives at the ingress controller.",
            "The Host header matches the rule, so the request goes to Service shorty.",
            "kube-proxy picks one of the Ready pods.",
            "The app bumps the hit counter in Postgres. The NetworkPolicy lets it in because the pod has app=shorty.",
            "Postgres writes to its PersistentVolume, and the app answers 302 with the long URL.",
          ],
        },
        {
          name: "A database outage",
          path: ["pg", "pods", "svc"],
          steps: [
            "postgres-0 goes away. Queries fail, so /readyz fails, but /livez (the process only) still passes: nobody restarts the app.",
            "The pods turn NotReady and leave the EndpointSlice, so clients get a clean refusal, not half-broken answers. When Postgres is back they reconnect and return.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
In the Docker world you built **shorty**, a link shortener, and packed it into a lunchbox (an image) that runs next to its database on your computer. That's one kitchen with one cook. If the cook gets sick, nobody gets lunch.

Now you'll give shorty to the **robot city** from this world. You write down what you want: "two copies of shorty, always; one database that keeps its own cupboard; a front door called shorty.example.com; and only shorty may talk to the database". The robots do the rest. Kill a copy and they make a new one. Ship a new version and they swap copies one at a time, so nobody notices. Turn the database off and the shorty copies politely put up a "closed" sign instead of breaking. Turn it back on and they open again, and every link is still there because the database's cupboard (its disk) never left.

And just like in the Docker world, you'll finish with a test script that proves all of that, not just says it.

## What changes from Compose to Kubernetes
| In Compose | In Kubernetes | Why |
|---|---|---|
| \`services: api\` | a **Deployment** + a **Service** | copies, rolling updates, a stable name and load balancing |
| \`services: db\` + a named volume | a **StatefulSet** + a **volumeClaimTemplate** + a headless Service | a stable identity (\`postgres-0\`) and a disk that follows it |
| \`secrets: db_password\` | a **Secret** (from Kustomize's secretGenerator), mounted as a file | the same file, never an env var |
| \`db/init.sql\` bind mount | a **ConfigMap** mounted at \`/docker-entrypoint-initdb.d\` | config shipped with the manifests |
| \`healthcheck\` + \`depends_on: service_healthy\` | **startup, liveness and readiness probes** | no start order: each pod waits for what it needs and says when it's ready |
| \`ports: 8080:3000\` | an **Ingress** (host \`shorty.example.com\`) | one shared front door for many apps |
| the project network | the cluster network + a **NetworkPolicy** | everything can talk unless you say otherwise, so say otherwise |
| \`deploy.resources\` | requests and limits, a **HorizontalPodAutoscaler**, a **PodDisruptionBudget** | scheduling, scaling and safe node maintenance |
| \`docker compose up\` | \`kubectl apply -k .\` | Kustomize renders it all into one namespace |

## The one change to the app
In Compose, one health check was enough. Kubernetes asks two different questions, and mixing them up causes outages:
- **liveness**: "is this process broken beyond repair?" A failure **restarts** the container. Never check the database here: when the database blips, every copy would restart at once, and the outage gets worse.
- **readiness**: "can you serve right now?" A failure only **removes the pod from the Service** until it passes again. This is where the database check belongs.

So the app grows \`/livez\` (always 200 while the process works) and \`/readyz\` (runs \`SELECT 1\`), and learns to **reconnect** when its database connection breaks, instead of exiting. The startup probe covers the slow first connect.

## Getting your image into the cluster
A cluster runs images from **its own** image store or a registry, not from your laptop's Docker. kind, minikube and k3d have an "image load" command; Docker Desktop shares Docker's images; any real cluster pulls from a **registry** (build, tag \`registry.example.com/shorty:1.0\`, push, and use that name). \`k8s/smoke.sh\` handles the local cases for you.

## What you need
Docker, \`kubectl\`, and a local cluster: **kind**, **minikube**, **k3d**, Docker Desktop's Kubernetes or Rancher Desktop all work. The finished Docker project is your starting point; this project adds a \`kustomization.yaml\` and a \`k8s/\` folder, and changes one file in \`app/\`.`,
    keyPoints: [
      "Stateless app = Deployment + Service; database = StatefulSet + volumeClaimTemplate + headless Service.",
      "Liveness checks only the process; readiness checks dependencies. A database outage should make pods NotReady, not restart them.",
      "Secrets as mounted files, a non-root user, a read-only root filesystem and dropped capabilities are cheap and pass baseline/restricted.",
      "Rolling updates with maxUnavailable 0, readiness, a preStop pause and SIGTERM handling give zero failed requests during deploys.",
      "PDB protects availability during node drains; the HPA scales on CPU relative to requests; a NetworkPolicy fences off the database.",
      "kubectl apply -k deploys the whole stack; a smoke test proves self-healing, rollouts, outages and persistence.",
    ],
    interview: [
      {
        q: "How would you move a Docker Compose app to Kubernetes?",
        a: "Map each piece: stateless services → **Deployments** (with requests/limits, probes, a non-root securityContext) behind **Services**; databases → a **StatefulSet** with volumeClaimTemplates (or, better in production, a managed database or an operator); env and config files → **ConfigMaps**; secrets → **Secrets** from a secret manager (External Secrets, Sealed Secrets), mounted as files; published ports → an **Ingress** or Gateway; `depends_on` → readiness probes and retry logic in the app (Kubernetes has no start order). Package with **Kustomize** or **Helm**, add a PDB, an HPA and NetworkPolicies, push images to a registry, and deploy via CI or GitOps. Tools like Kompose can draft manifests, but you still review every one.",
        freq: "common",
      },
      {
        q: "Your app returns errors for a few seconds during every deploy. How do you fix it?",
        a: "Usually three gaps. (1) **Readiness**: without a readiness probe, new pods get traffic before they can serve; add one that checks real readiness. (2) **Termination**: when a pod is deleted, endpoint removal reaches kube-proxy and ingress controllers a moment *after* SIGTERM, so the app must keep serving briefly: add a `preStop` sleep of a few seconds and handle **SIGTERM** gracefully (stop accepting, finish in-flight requests, exit) within `terminationGracePeriodSeconds`. (3) **Capacity**: use `maxUnavailable: 0` / `maxSurge: 1` so capacity never drops, enough replicas, and a PDB. Also check long-lived connections (keep-alive, gRPC) are drained or rebalanced. Prove it with a load test that runs during a rollout, like this project's smoke test.",
        freq: "very-common",
      },
      {
        q: "Should you run your database on Kubernetes?",
        a: "It can work well, but it's a trade-off. **For**: one platform, one deploy workflow, StatefulSets with stable identity and PersistentVolumes, and mature **operators** (CloudNativePG, Zalando, Crunchy for Postgres) that handle replication, failover, backups and upgrades. **Against**: you own all of it (backups, restores, version upgrades, storage performance, failover testing), and node or storage issues become database incidents. For many teams a **managed database** (RDS, Cloud SQL) is the better default; running databases in-cluster makes sense with an operator, solid storage and people who will test restores. A single-replica StatefulSet like this project's is fine for learning and small internal tools, not for critical data.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "shorty's database goes down for a minute. With liveness on /livez and readiness on /readyz, what happens?",
        options: ["Every shorty pod restarts in a loop", "The pods go NotReady and leave the Service, then come back when the database returns", "Kubernetes restarts the database node", "Nothing: probes don't notice"],
        answer: 1,
        explain: "Readiness checks the dependency, so the pods stop getting traffic; liveness only checks the process, so they aren't restarted.",
      },
      {
        q: "Why does the Deployment use maxUnavailable: 0 and maxSurge: 1?",
        options: ["To save memory", "So a rollout adds a new pod and waits for it to be Ready before removing an old one", "To pin pods to one node", "Because the HPA requires it"],
        answer: 1,
        explain: "Capacity never drops below the desired count during the rollout.",
      },
      {
        q: "Why does Postgres run as a StatefulSet with a volumeClaimTemplate instead of a Deployment?",
        options: ["Deployments can't run databases", "It gets a stable name (postgres-0) and its own PersistentVolumeClaim that follows it across restarts", "StatefulSets are faster", "Secrets only work with StatefulSets"],
        answer: 1,
        explain: "Stable identity and per-pod storage are what StatefulSets add.",
      },
      {
        q: "The cluster says ErrImageNeverPull or ImagePullBackOff for quest-shorty-api:1.0, which you just built. Why?",
        options: ["The Dockerfile is wrong", "The cluster's nodes use their own image store or a registry, not your laptop's Docker images", "Kubernetes can't run Node.js", "The namespace is wrong"],
        answer: 1,
        explain: "Load the image into the cluster (kind load, minikube image load, k3d image import) or push it to a registry.",
      },
    ],
    project: {
      summary: `You'll take **shorty**, the link shortener from the Docker world's Compose project, and run it on Kubernetes. In five steps you make the app cluster-ready (separate liveness and readiness, reconnecting to the database), run Postgres as a **StatefulSet** with its own disk, deploy the app as a hardened **Deployment** behind a **Service** with a disruption budget and an autoscaler, open it to the world with an **Ingress** and fence off the database with a **NetworkPolicy**, and finish with \`k8s/smoke.sh\`: about 20 checks that deploy everything with one command, then kill pods, roll out a new version under load, take the database away and bring it back.

You need **Docker**, **kubectl** and a local cluster (kind, minikube, k3d, Docker Desktop or Rancher Desktop). You start from the finished Docker project: its files stay as they are, except \`app/server.js\`.`,
      skills: [
        "Translating a Compose stack into Deployments, StatefulSets, Services and an Ingress",
        "Separating liveness, readiness and startup probes",
        "Running a database with a StatefulSet and a PersistentVolumeClaim",
        "Generating ConfigMaps and Secrets with Kustomize",
        "Hardening pods: non-root, read-only, no capabilities, secrets as files",
        "Zero-downtime rollouts, PodDisruptionBudgets and autoscaling",
        "Restricting traffic with a NetworkPolicy",
        "Testing a deployment end to end from bash",
      ],
      tree: `shorty/
├── kustomization.yaml      # NEW: the whole stack, deployed with kubectl apply -k .
├── k8s/                    # NEW
│   ├── namespace.yaml      # quest-shorty, with Pod Security labels
│   ├── postgres.yaml       # headless Service + StatefulSet with its own disk
│   ├── shorty.yaml         # Deployment, Service, PodDisruptionBudget, HPA
│   ├── ingress.yaml        # http://shorty.example.com
│   ├── network-policy.yaml # only shorty may reach the database
│   ├── load.js             # nonstop requests, for the zero-downtime check
│   └── smoke.sh            # end-to-end test: about 20 checks in 8 stages
├── app/
│   ├── server.js           # CHANGED: /livez, /readyz, reconnects to the database
│   └── ...                 # Dockerfile, links.js, db.js, tests: unchanged
├── db/init.sql             # unchanged: now shipped as a ConfigMap
├── secrets/db_password.txt # generated, never committed: now shipped as a Secret
├── compose.yaml            # unchanged: Compose still works for local development
└── smoke.sh                # unchanged: the Compose smoke test`,
      steps: [
        {
          title: "1. Make the app ready for Kubernetes",
          explain: `Only \`app/server.js\` changes.
- **\`/livez\`** answers 200 as long as the process can answer at all. The liveness and startup probes use it. It never touches the database, so a database outage can't make Kubernetes restart every copy of shorty.
- **\`/readyz\`** runs \`SELECT 1\`. The readiness probe uses it: when the database is away, the pod leaves the Service until it's back. \`/health\` stays as an alias, so Compose's \`HEALTHCHECK\` still works.
- **Reconnecting**: in Compose, a dead database connection meant a crash and a restart. Now \`query()\` notices a broken connection (\`db.error\`), and the next request reconnects once. Several requests arriving together share one reconnect (the \`reconnecting\` promise).
- Health checks every 2 seconds would flood the log, so probe paths aren't logged.

Rebuild the image: the unit tests still run inside the build.`,
          files: [{ path: "app/server.js", lang: "javascript", code: `"use strict";
const fs = require("node:fs");
const http = require("node:http");
const { Client } = require("./db");
const { makeCode, isValidUrl } = require("./links");

// ---- configuration: everything comes from the environment (12-factor style)
const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.PUBLIC_URL ?? \`http://localhost:\${PORT}\`;
const config = {
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "shorty",
  database: process.env.DB_NAME ?? "shorty",
  // read the password from a mounted secret file if there is one
  password: process.env.DB_PASSWORD_FILE ? fs.readFileSync(process.env.DB_PASSWORD_FILE, "utf8").trim() : process.env.DB_PASSWORD,
};

// One connection, replaced when it breaks (the database restarted, a node was drained...).
// At startup we wait for the database; after that, a request that finds the connection broken
// reconnects once, and fails with 503 if the database is still away.
let db;
let reconnecting = null;
async function connect() {
  const client = new Client(config);
  await client.connect();
  db = client;
  console.log(\`connected to postgres at \${config.host}\`);
}
async function connectWithRetry(attempts = 30) {
  for (let i = 1; ; i++) {
    try {
      return await connect();
    } catch (err) {
      if (i === attempts) throw err;
      console.log(\`database not ready (\${err.code ?? err.message}), retry \${i}/\${attempts}\`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
async function query(sql, params) {
  if (db.error) {
    reconnecting ??= connect().finally(() => (reconnecting = null));
    await reconnecting;
  }
  return db.query(sql, params);
}

// ---- HTTP helpers
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : \`\${JSON.stringify(body)}\\n\`);
};
const readJson = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });

// ---- routes
async function handle(req, res) {
  const { pathname } = new URL(req.url, PUBLIC_URL);

  // liveness: is the process itself OK? Never checks the database, so a database outage
  // doesn't make Kubernetes restart every copy of the app.
  if (req.method === "GET" && pathname === "/livez") return send(res, 200, { status: "alive" });

  // readiness: can I serve requests right now? (/health is the same check, for Docker's HEALTHCHECK)
  if (req.method === "GET" && (pathname === "/readyz" || pathname === "/health")) {
    await query("SELECT 1");
    return send(res, 200, { status: "ok" });
  }

  if (req.method === "POST" && pathname === "/links") {
    const body = await readJson(req);
    if (!body || !isValidUrl(body.url)) return send(res, 400, { error: "send JSON like {\\"url\\": \\"https://...\\"}" });
    const [row] = await query("INSERT INTO links (code, url) VALUES ($1, $2) RETURNING code, url", [makeCode(), body.url]);
    return send(res, 201, { ...row, short: \`\${PUBLIC_URL}/\${row.code}\` });
  }

  if (req.method === "GET" && pathname === "/links") {
    return send(res, 200, await query("SELECT code, url, hits FROM links ORDER BY id"));
  }

  const code = /^\\/([a-z0-9]{6})$/.exec(pathname)?.[1];
  if (req.method === "GET" && code) {
    const [row] = await query("UPDATE links SET hits = hits + 1 WHERE code = $1 RETURNING url", [code]);
    return row ? send(res, 302, undefined, { location: row.url }) : send(res, 404, { error: "no such link" });
  }

  send(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res)
    .catch((err) => {
      console.error(\`\${req.method} \${req.url} failed: \${err.message}\`);
      if (!res.headersSent) send(res, 503, { error: "service unavailable" });
    })
    .finally(() => {
      if (!["/health", "/livez", "/readyz"].includes(req.url)) console.log(\`\${req.method} \${req.url} -> \${res.statusCode}\`);
    });
});

// ---- start, and stop gracefully on SIGTERM (docker stop, compose down, Kubernetes)
connectWithRetry()
  .then(() => server.listen(PORT, "0.0.0.0", () => console.log(\`shorty listening on \${PORT}\`)))
  .catch((err) => {
    console.error(\`giving up: \${err.message}\`);
    process.exit(1);
  });

process.on("SIGTERM", () => {
  console.log("SIGTERM: finishing in-flight requests, then exiting");
  server.close(() => {
    db?.end();
    process.exit(0);
  });
});` }],
          run: "docker build -t quest-shorty-api:1.0 app",
        },
        {
          title: "2. Postgres as a StatefulSet",
          explain: `- **\`namespace.yaml\`**: everything lives in \`quest-shorty\`, which enforces the \`baseline\` Pod Security level, so a privileged pod can't sneak in.
- **\`postgres.yaml\`**: a **headless** Service (\`clusterIP: None\`, so \`postgres\` resolves straight to the pod) and a **StatefulSet** with one replica. \`volumeClaimTemplates\` gives \`postgres-0\` its own PersistentVolumeClaim, \`data-postgres-0\`, which outlives the pod: delete the pod, and the new \`postgres-0\` gets the same disk. \`PGDATA\` points at a subfolder because some storage creates a \`lost+found\` folder that Postgres refuses to initialize over.
- The password comes from a Secret mounted as a file (\`POSTGRES_PASSWORD_FILE\`), and \`init.sql\` from a ConfigMap mounted where the image looks for init scripts. The readiness probe runs \`pg_isready\`.
- **\`kustomization.yaml\`** puts it all in the namespace and **generates** the ConfigMap from \`db/init.sql\` and the Secret from \`secrets/db_password.txt\`: the same files Compose uses. Their names get a content hash (\`db-password-8mg4t57ggt\`), so changing a file rolls the pods that use it.

Create the password file once (the Compose smoke test may already have made it), then apply:`,
          files: [
            { path: "k8s/namespace.yaml", lang: "yaml", code: `apiVersion: v1
kind: Namespace
metadata:
  name: quest-shorty
  labels:
    # refuse privileged pods; warn about anything that isn't fully hardened
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: baseline` },
            { path: "k8s/postgres.yaml", lang: "yaml", code: `# The database: a StatefulSet with one replica, so it keeps a stable name (postgres-0)
# and its own disk (a PersistentVolumeClaim made from volumeClaimTemplates).
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  clusterIP: None                    # headless: postgres-0.postgres resolves straight to the pod
  selector: { app: postgres }
  ports: [{ name: postgres, port: 5432 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector: { matchLabels: { app: postgres } }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      terminationGracePeriodSeconds: 30
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - { name: POSTGRES_USER, value: shorty }
            - { name: POSTGRES_DB, value: shorty }
            - { name: POSTGRES_PASSWORD_FILE, value: /run/secrets/db/password }
            - { name: PGDATA, value: /var/lib/postgresql/data/pgdata }   # a subfolder of the volume
          ports: [{ name: postgres, containerPort: 5432 }]
          readinessProbe:
            exec: { command: ["pg_isready", "-U", "shorty", "-d", "shorty"] }
            periodSeconds: 2
            failureThreshold: 3
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 512Mi }
          volumeMounts:
            - { name: data, mountPath: /var/lib/postgresql/data }
            - { name: init, mountPath: /docker-entrypoint-initdb.d, readOnly: true }
            - { name: password, mountPath: /run/secrets/db, readOnly: true }
      volumes:
        - name: init
          configMap: { name: db-init }
        - name: password
          secret: { secretName: db-password }
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        resources: { requests: { storage: 1Gi } }` },
            { path: "kustomization.yaml", lang: "yaml", code: `# Everything shorty needs on Kubernetes. Deploy with:  kubectl apply -k .
namespace: quest-shorty
resources:
  - k8s/namespace.yaml
  - k8s/postgres.yaml
configMapGenerator:
  - name: db-init                    # the same init.sql Compose uses
    files: [db/init.sql]
secretGenerator:
  - name: db-password                # the same password file too (never committed)
    files: [password=secrets/db_password.txt]
labels:
  - pairs: { app.kubernetes.io/part-of: shorty }` },
          ],
          run: `mkdir -p secrets && head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \\n' > secrets/db_password.txt
kubectl apply -k .
kubectl -n quest-shorty rollout status statefulset/postgres
kubectl -n quest-shorty get pods,pvc
kubectl -n quest-shorty exec postgres-0 -- psql -U shorty -c '\\d links'`,
          output: `namespace/quest-shorty created
configmap/db-init-h4bm944d8t created
secret/db-password-8mg4t57ggt created
service/postgres created
statefulset.apps/postgres created
Waiting for 1 pods to be ready...
partitioned roll out complete: 1 new pods have been updated...
NAME             READY   STATUS    RESTARTS   AGE
pod/postgres-0   1/1     Running   0          5s

NAME                                    STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
persistentvolumeclaim/data-postgres-0   Bound    pvc-e35f3b5a-29f0-48de-9c40-7a25ba4af865   1Gi        RWO            local-path     <unset>                 5s
                                       Table "public.links"
   Column   |           Type           | Collation | Nullable |              Default              
------------+--------------------------+-----------+----------+-----------------------------------
 id         | bigint                   |           | not null | nextval('links_id_seq'::regclass)
 code       | text                     |           | not null | 
 url        | text                     |           | not null | 
 hits       | integer                  |           | not null | 0
 created_at | timestamp with time zone |           | not null | now()
Indexes:
    "links_pkey" PRIMARY KEY, btree (id)
    "links_code_key" UNIQUE CONSTRAINT, btree (code)`,
        },
        {
          title: "3. The app: Deployment, Service, budget and autoscaler",
          explain: `**\`shorty.yaml\`** holds four objects.
- The **Deployment** runs 2 copies. \`maxSurge: 1, maxUnavailable: 0\` means a rollout first adds a new pod, waits until it's Ready, then removes an old one.
- Its **probes**: \`startupProbe\` gives the first connect up to 60 s; \`livenessProbe\` checks \`/livez\`; \`readinessProbe\` checks \`/readyz\` every 2 s.
- A \`preStop\` **sleep of 5 s** keeps the pod serving while its removal from the endpoints reaches every node, and only then sends SIGTERM, which the app already handles.
- **Security**: it runs as uid 1000 with a read-only root filesystem, no capabilities, no privilege escalation and the default seccomp profile, and the password is a mounted file.
- **Requests and limits**: 50m CPU and 64Mi requested, with a 128Mi memory limit and no CPU limit (it's never throttled).
- The **Service** gives the pods one stable name, \`shorty\`, port 80.
- The **PodDisruptionBudget** keeps at least one pod running during voluntary disruptions like \`kubectl drain\`.
- The **HorizontalPodAutoscaler** grows to 6 pods when average CPU passes 70% of the request.

Load the image into your cluster, add \`k8s/shorty.yaml\` to the resources, and apply. Then try it through a port-forward:`,
          files: [
            { path: "k8s/shorty.yaml", lang: "yaml", code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shorty
spec:
  replicas: 2
  selector: { matchLabels: { app: shorty } }
  strategy:
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }   # never fewer than 2 ready during a rollout
  template:
    metadata:
      labels: { app: shorty }
    spec:
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: quest-shorty-api:1.0
          ports: [{ name: http, containerPort: 3000 }]
          env:
            - { name: DB_HOST, value: postgres }
            - { name: DB_USER, value: shorty }
            - { name: DB_NAME, value: shorty }
            - { name: DB_PASSWORD_FILE, value: /run/secrets/db/password }   # a file, not an env var
            - { name: PUBLIC_URL, value: "http://shorty.example.com" }
          startupProbe:                       # up to 60 s to connect to the database at boot
            httpGet: { path: /livez, port: http }
            periodSeconds: 2
            failureThreshold: 30
          livenessProbe:                      # the process only: a database outage must not restart us
            httpGet: { path: /livez, port: http }
            periodSeconds: 10
          readinessProbe:                     # can I serve right now? (checks the database)
            httpGet: { path: /readyz, port: http }
            periodSeconds: 2
            failureThreshold: 2
          lifecycle:
            preStop:                          # keep serving while endpoint removal spreads, then SIGTERM
              sleep: { seconds: 5 }
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 128Mi }
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities: { drop: [ALL] }
          volumeMounts:
            - { name: password, mountPath: /run/secrets/db, readOnly: true }
      volumes:
        - name: password
          secret: { secretName: db-password }
---
apiVersion: v1
kind: Service
metadata:
  name: shorty
spec:
  selector: { app: shorty }
  ports: [{ name: http, port: 80, targetPort: http }]
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: shorty
spec:
  minAvailable: 1                      # node drains take at most one copy at a time
  selector: { matchLabels: { app: shorty } }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shorty
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: shorty }
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }` },
            { path: "kustomization.yaml", lang: "yaml", code: `# Everything shorty needs on Kubernetes. Deploy with:  kubectl apply -k .
namespace: quest-shorty
resources:
  - k8s/namespace.yaml
  - k8s/postgres.yaml
  - k8s/shorty.yaml
configMapGenerator:
  - name: db-init                    # the same init.sql Compose uses
    files: [db/init.sql]
secretGenerator:
  - name: db-password                # the same password file too (never committed)
    files: [password=secrets/db_password.txt]
labels:
  - pairs: { app.kubernetes.io/part-of: shorty }` },
          ],
          run: `kind load docker-image quest-shorty-api:1.0   # or: minikube image load / k3d image import (see load_image in smoke.sh)
kubectl apply -k .
kubectl -n quest-shorty rollout status deployment/shorty
kubectl -n quest-shorty get pods
kubectl -n quest-shorty port-forward service/shorty 8080:80 &
curl -s -X POST localhost:8080/links -H 'content-type: application/json' -d '{"url": "https://kubernetes.io"}'
curl -s localhost:8080/links`,
          output: `namespace/quest-shorty unchanged
configmap/db-init-h4bm944d8t unchanged
secret/db-password-8mg4t57ggt unchanged
service/postgres unchanged
service/shorty created
deployment.apps/shorty created
statefulset.apps/postgres configured
poddisruptionbudget.policy/shorty created
horizontalpodautoscaler.autoscaling/shorty created
Waiting for deployment "shorty" rollout to finish: 0 of 2 updated replicas are available...
Waiting for deployment "shorty" rollout to finish: 1 of 2 updated replicas are available...
deployment "shorty" successfully rolled out
NAME                      READY   STATUS    RESTARTS   AGE
postgres-0                1/1     Running   0          12s
shorty-5985745dbd-fjl9l   1/1     Running   0          2s
shorty-5985745dbd-r2h9p   1/1     Running   0          2s
{"code":"s2zn5f","url":"https://kubernetes.io","short":"http://shorty.example.com/s2zn5f"}

[{"code":"s2zn5f","url":"https://kubernetes.io","hits":0}]`,
        },
        {
          title: "4. The front door and the fence: Ingress and NetworkPolicy",
          explain: `- **\`ingress.yaml\`** routes \`http://shorty.example.com\` to the Service. It has no \`ingressClassName\`, so the cluster's default ingress controller takes it: Traefik on k3s and k3d, ingress-nginx on minikube (\`minikube addons enable ingress\`) or kind (install it first). To try it from your laptop, send the host name in a header: \`curl -H 'Host: shorty.example.com' http://<ingress address>/\`.
- **\`network-policy.yaml\`** selects the Postgres pods and allows ingress only from pods labelled \`app=shorty\`, on port 5432. Everything else is refused. It's only enforced if your cluster's network plugin supports NetworkPolicy (Calico, Cilium, k3s's built-in one; plain kind and minikube's default don't).
- This is the finished \`kustomization.yaml\`. You may see \`configured\` for objects you didn't change: \`kubectl apply\` (client-side) reports any patch it sends, even one that changes nothing; \`kubectl diff -k .\` shows the real differences (here, none).

Check the fence: a pod without the label is refused, and the same pod wearing shorty's label gets through. (Each probe waits 5 s, because a brand-new pod is only added to the policy's allowed set after a moment.)`,
          files: [
            { path: "k8s/ingress.yaml", lang: "yaml", code: `# The public entrance: http://shorty.example.com -> the shorty Service.
# No ingressClassName: the cluster's default ingress controller picks it up (Traefik on k3s).
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shorty
spec:
  rules:
    - host: shorty.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: shorty, port: { name: http } } }` },
            { path: "k8s/network-policy.yaml", lang: "yaml", code: `# Only shorty may talk to the database. Everything else in (or outside) the cluster is refused.
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-only-from-shorty
spec:
  podSelector: { matchLabels: { app: postgres } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: shorty } } }]
      ports: [{ protocol: TCP, port: 5432 }]` },
            { path: "kustomization.yaml", lang: "yaml", code: `# Everything shorty needs on Kubernetes. Deploy with:  kubectl apply -k .
namespace: quest-shorty
resources:
  - k8s/namespace.yaml
  - k8s/postgres.yaml
  - k8s/shorty.yaml
  - k8s/ingress.yaml
  - k8s/network-policy.yaml
configMapGenerator:
  - name: db-init                    # the same init.sql Compose uses
    files: [db/init.sql]
secretGenerator:
  - name: db-password                # the same password file too (created by k8s/smoke.sh, never committed)
    files: [password=secrets/db_password.txt]
labels:
  - pairs: { app.kubernetes.io/part-of: shorty }` },
          ],
          run: `kubectl apply -k .
kubectl -n quest-shorty get ingress
for label in app=stranger app=shorty; do
  kubectl -n quest-shorty run probe --rm -i --restart=Never --labels="$label" --image=node:20-slim -- node -e "
    setTimeout(() => require('net').connect(5432, 'postgres')
      .on('connect', function () { console.log('$label: connected'); this.destroy(); })
      .on('error', (e) => console.log('$label: ' + e.code)), 5000)"
done`,
          output: `namespace/quest-shorty unchanged
configmap/db-init-h4bm944d8t unchanged
secret/db-password-8mg4t57ggt unchanged
service/postgres unchanged
service/shorty unchanged
deployment.apps/shorty configured
statefulset.apps/postgres configured
poddisruptionbudget.policy/shorty configured
horizontalpodautoscaler.autoscaling/shorty unchanged
ingress.networking.k8s.io/shorty created
networkpolicy.networking.k8s.io/postgres-only-from-shorty created
NAME     CLASS     HOSTS                ADDRESS                            PORTS   AGE
shorty   traefik   shorty.example.com   172.18.0.2,172.18.0.3,172.18.0.4   80      5s
app=stranger: ECONNREFUSED
pod "probe" deleted from quest-shorty namespace
app=shorty: connected
pod "probe" deleted from quest-shorty namespace`,
        },
        {
          title: "5. Prove it: the smoke test",
          explain: `\`k8s/smoke.sh\` builds and loads the image, deploys everything with \`kubectl apply -k .\`, and checks the things that matter in production:
1. The rollout completes and 2 pods are Ready.
2. Shortening, redirecting, rejecting bad URLs and counting hits all work through the Service, from a pod inside the cluster.
3. The Ingress routes \`shorty.example.com\` (skipped if your cluster has no ingress controller).
4. **Security**: shorty runs as uid 1000 on a read-only filesystem, the password isn't in any env var, and other pods can't reach the database.
5. **Zero downtime**: \`load.js\` sends requests nonstop while a pod is killed **and** a rolling restart runs. Not one request may fail.
6. **An outage**: the database is scaled to zero. The shorty pods must go NotReady **without restarting**, then come back on their own, and the link created earlier must still exist (the PersistentVolume kept it).
7. **Autoscaling**: the HPA reads CPU metrics (needs metrics-server).

It deletes the namespace when it finishes; \`KEEP=1 bash k8s/smoke.sh\` leaves everything running so you can explore.`,
          files: [
            { path: "k8s/load.js", lang: "javascript", code: `// Calls shorty non-stop until /tmp/stop exists, then prints how many requests failed.
// Runs inside the cluster (in the smoke-test pod), so it goes through the Service like real traffic.
const fs = require("node:fs");
const http = require("node:http");
const get = () =>
  new Promise((resolve) => {
    const req = http.get({ host: "shorty", path: "/links", agent: false, timeout: 3000 }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode === 200));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
  });
(async () => {
  let ok = 0;
  let failed = 0;
  while (!fs.existsSync("/tmp/stop")) {
    if (await get()) ok++;
    else failed++;
  }
  console.log(\`\${ok + failed} requests, \${failed} failed\`);
})();` },
            { path: "k8s/smoke.sh", lang: "bash", code: `#!/usr/bin/env bash
# Deploy shorty to the cluster in your current kubectl context, test it end to end, then remove it.
# Needs: docker, kubectl, and a cluster (kind, minikube, k3d, Docker Desktop, k3s...). KEEP=1 leaves it running.
set -euo pipefail
cd "$(dirname "$0")/.."
NS=quest-shorty
IMAGE=quest-shorty-api:1.0
k() { kubectl -n "$NS" "$@"; }

pass() { echo "  ok: $1"; }
fail() {
  echo "  FAILED: $1" >&2
  k get pods -o wide >&2 || true
  k logs deployment/shorty --tail 20 >&2 || true
  exit 1
}
expect() { [ "$1" = "$2" ] && pass "$3" || fail "$3 (expected '$2', got '$1')"; }

# The cluster runs containers from its own image store, not your Docker's. Copy the image in.
load_image() {
  local ctx
  ctx=$(kubectl config current-context)
  case "$ctx" in
    kind-*) kind load docker-image "$1" --name "\${ctx#kind-}" > /dev/null ;;
    minikube) minikube image load "$1" ;;
    k3d-*) k3d image import "$1" --cluster "\${ctx#k3d-}" > /dev/null ;;
    docker-desktop | rancher-desktop | orbstack) ;; # these use Docker's own images: nothing to do
    k3s-quest) # the course's test cluster: k3s nodes running as Docker containers
      for node in $(docker ps --format '{{.Names}}' | grep '^k3s-quest-'); do
        docker save "$1" | docker exec -i "$node" ctr -n k8s.io images import - > /dev/null
      done ;;
    *) echo "Push $1 to a registry your cluster can pull from, and use that name in k8s/shorty.yaml." >&2; exit 1 ;;
  esac
}

# a random database password, created once and never committed (the same file Compose uses)
if [ ! -f secrets/db_password.txt ]; then
  mkdir -p secrets
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \\n' > secrets/db_password.txt
fi
[ "\${KEEP:-}" = 1 ] || trap 'kubectl delete namespace "$NS" --wait=false > /dev/null 2>&1 || true' EXIT

echo "1. build the image (the unit tests run inside the build) and load it into the cluster"
docker build -q -t "$IMAGE" app > /dev/null && pass "built $IMAGE"
load_image "$IMAGE" && pass "the cluster has the image"

echo "2. deploy everything with one command"
kubectl apply -k . > /dev/null
k rollout status statefulset/postgres --timeout=180s > /dev/null && pass "postgres-0 is ready"
k rollout status deployment/shorty --timeout=180s > /dev/null && pass "shorty rolled out"
expect "$(k get deployment shorty -o jsonpath='{.status.readyReplicas}')" "2" "2 shorty pods are ready"

# a pod inside the cluster to make requests from (it uses the same image: it already has node)
k run smoke --image="$IMAGE" --restart=Never --labels=app=smoke-test -- sleep 3600 > /dev/null
k wait --for=condition=Ready pod/smoke --timeout=120s > /dev/null
k cp k8s/load.js smoke:/tmp/load.js
call() { # METHOD PATH [JSON]: prints "STATUS BODY"; never throws
  k exec smoke -- node -e "
    fetch('http://shorty$2', { method: '$1', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: process.argv[1] || undefined })
      .then(async (r) => console.log(r.status, r.headers.get('location') || (await r.text()).trim()))
      .catch((e) => console.log('ERR', e.cause?.code || e.message))" "\${3:-}"
}

echo "3. use it through the Service"
created=$(call POST /links '{"url": "https://kubernetes.io/docs/concepts/"}')
code=$(echo "$created" | sed -nE 's/^201 .*"code":"([a-z0-9]{6})".*/\\1/p')
[ -n "$code" ] && pass "POST /links made a short code" || fail "no code in: $created"
expect "$(call GET "/$code")" "302 https://kubernetes.io/docs/concepts/" "the short link redirects"
expect "$(call POST /links '{"url": "javascript:alert(1)"}' | cut -d' ' -f1)" "400" "a bad URL is rejected"
expect "$(call GET /links | grep -o '"hits":[0-9]*')" '"hits":1' "the visit was counted"

echo "4. through the Ingress (http://shorty.example.com)"
lb=""
for _ in $(seq 1 30); do
  lb=$(k get ingress shorty -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
  [ -n "$lb" ] && break
  sleep 2
done
if [ -n "$lb" ]; then
  for _ in $(seq 1 30); do
    via=$(k exec smoke -- node -e "require('http').get({ host: '$lb', path: '/$code', agent: false, headers: { Host: 'shorty.example.com' } }, (r) => console.log(r.statusCode, r.headers.location))")
    [ "$via" = "302 https://kubernetes.io/docs/concepts/" ] && break
    sleep 1
  done
  expect "$via" "302 https://kubernetes.io/docs/concepts/" "the ingress controller routes shorty.example.com to shorty"
else
  echo "  skipped: no ingress controller gave the Ingress an address (install one, e.g. ingress-nginx)"
fi

echo "5. security"
pod=$(k get pods -l app=shorty -o name | head -n 1)
expect "$(k exec "$pod" -- id -u)" "1000" "shorty runs as a non-root user"
expect "$(k exec "$pod" -- sh -c 'touch /app/x 2>/dev/null && echo writable || echo read-only')" "read-only" "its filesystem is read-only"
expect "$(k exec "$pod" -- sh -c 'env | grep -ci password= || true')" "0" "the password is not in any environment variable"
k exec smoke -- node -e "require('net').connect(5432, 'postgres').on('connect', () => console.log('open')).on('error', () => console.log('blocked')).setTimeout(2000, function () { console.log('blocked'); this.destroy(); })" | grep -q blocked \\
  && pass "other pods can't reach the database (NetworkPolicy)" \\
  || echo "  warning: other pods CAN reach the database: this cluster's network plugin doesn't enforce NetworkPolicy"

echo "6. self-healing and zero-downtime deploys, under load"
k exec smoke -- rm -f /tmp/stop
k exec smoke -- node /tmp/load.js > load.out &
loader=$!
sleep 2
k delete "$pod" --wait=false > /dev/null                      # a pod dies...
k rollout status deployment/shorty --timeout=180s > /dev/null
k rollout restart deployment/shorty > /dev/null                # ...and a new version is deployed
k rollout status deployment/shorty --timeout=180s > /dev/null
sleep 6                                                         # let the last old pod finish shutting down
k exec smoke -- touch /tmp/stop
wait $loader
expect "$(sed -E 's/^[0-9]+ requests, //' load.out)" "0 failed" "no request failed while a pod died and a rollout ran ($(cut -d, -f1 load.out))"
expect "$(k get deployment shorty -o jsonpath='{.status.readyReplicas}')" "2" "back to 2 ready pods"

echo "7. a database outage: readiness, not liveness"
k scale statefulset/postgres --replicas=0 > /dev/null
k wait --for=delete pod/postgres-0 --timeout=120s > /dev/null
k wait --for=condition=Ready=false pods -l app=shorty --timeout=60s > /dev/null && pass "shorty pods went NotReady (out of the Service), not restarted"
restarts=$(k get pods -l app=shorty -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{" "}{end}')
expect "$restarts" "0 0 " "liveness didn't restart them"
k scale statefulset/postgres --replicas=1 > /dev/null
k rollout status statefulset/postgres --timeout=180s > /dev/null
k wait --for=condition=Ready pods -l app=shorty --timeout=120s > /dev/null && pass "they reconnected and are Ready again"
expect "$(call GET /links | grep -o "\\"code\\":\\"$code\\"")" "\\"code\\":\\"$code\\"" "the link survived: the data lives on the PersistentVolume"

echo "8. autoscaling is wired up"
if k wait --for=jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}' hpa/shorty --timeout=120s > /dev/null 2>&1; then
  pass "the HPA reads CPU usage (now $(k get hpa shorty -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}')% of requests) and keeps 2 to 6 pods"
else
  echo "  warning: the HPA has no CPU metrics: install metrics-server"
fi

rm -f load.out
echo "all checks passed"` },
          ],
          run: "bash k8s/smoke.sh",
          output: `1. build the image (the unit tests run inside the build) and load it into the cluster
  ok: built quest-shorty-api:1.0
  ok: the cluster has the image
2. deploy everything with one command
  ok: postgres-0 is ready
  ok: shorty rolled out
  ok: 2 shorty pods are ready
3. use it through the Service
  ok: POST /links made a short code
  ok: the short link redirects
  ok: a bad URL is rejected
  ok: the visit was counted
4. through the Ingress (http://shorty.example.com)
  ok: the ingress controller routes shorty.example.com to shorty
5. security
  ok: shorty runs as a non-root user
  ok: its filesystem is read-only
  ok: the password is not in any environment variable
  ok: other pods can't reach the database (NetworkPolicy)
6. self-healing and zero-downtime deploys, under load
  ok: no request failed while a pod died and a rollout ran (28002 requests)
  ok: back to 2 ready pods
7. a database outage: readiness, not liveness
  ok: shorty pods went NotReady (out of the Service), not restarted
  ok: liveness didn't restart them
  ok: they reconnected and are Ready again
  ok: the link survived: the data lives on the PersistentVolume
8. autoscaling is wired up
  ok: the HPA reads CPU usage (now 4% of requests) and keeps 2 to 6 pods
all checks passed`,
        },
      ],
      extensions: [
        "Replace the single Postgres pod with an operator such as CloudNativePG: three instances, automatic failover and backups to object storage",
        "Make it a Helm chart, or add Kustomize overlays for staging and prod with different replicas, hosts and resources",
        "Add TLS: cert-manager with a ClusterIssuer and a tls section on the Ingress",
        "Run the database migration as a Job (or an init container) instead of init.sql, so schema changes ship with releases",
        "Expose Prometheus metrics (requests, latency, errors) and scale on requests per second with KEDA or a custom metric",
        "Deploy it with Argo CD from a Git repository, and make CI bump the image tag with a pull request",
        "Add a default-deny NetworkPolicy for the whole namespace, then allow only the ingress controller → shorty → postgres paths",
      ],
      verify: "bash k8s/smoke.sh",
      buildsOn: "docker/dk-project-compose",
      k8s: true,
      images: ["node:20-slim", "postgres:16-alpine"],
    },
  },

  // ------------------------------------------------------------------ PROJECT 2: YOUR OWN OPERATOR
  {
    id: "k8s-project-controller",
    title: "Project: build your own operator",
    tagline: "Teach Kubernetes a new kind of object, Website, and write the controller that makes it real: a CRD with validation, least-privilege RBAC, informers and a work queue, level-triggered reconcile with server-side apply, owner references and status, in about 250 lines of standard-library Python.",
    difficulty: "advanced",
    minutes: 75,
    diagram: {
      title: "The Website operator",
      nodes: [
        { id: "you", label: "You", kind: "client", x: 90, y: 280, sub: "kubectl apply / delete" },
        { id: "crd", label: "CRD", kind: "registry", x: 320, y: 80, sub: "websites.quest.dsa.dev" },
        { id: "api", label: "kube-apiserver", kind: "control", x: 320, y: 280, sub: "schema, defaults, RBAC" },
        { id: "etcd", label: "etcd", kind: "db", x: 320, y: 480, sub: "Websites stored like built-ins" },
        { id: "proxy", label: "kubectl proxy --as", kind: "gateway", x: 540, y: 280, sub: "the operator's ServiceAccount" },
        { id: "op", label: "controller.py", kind: "control", x: 750, y: 280, sub: "informers → queue → reconcile" },
        { id: "deploy", label: "Deployment", kind: "service", x: 900, y: 100, sub: "website-blog" },
        { id: "svc", label: "Service", kind: "lb", x: 900, y: 460, sub: "website-blog:80" },
      ],
      edges: [
        { from: "you", to: "api" },
        { from: "crd", to: "api", label: "a new kind" },
        { from: "api", to: "etcd" },
        { from: "api", to: "proxy", label: "list, watch, apply" },
        { from: "proxy", to: "op" },
        { from: "op", to: "deploy", label: "server-side apply" },
        { from: "op", to: "svc", label: "server-side apply" },
      ],
      flows: [
        {
          name: "Install the CRD",
          path: ["crd", "api", "etcd"],
          steps: [
            "kubectl apply -f crd.yaml: the API server starts serving /apis/quest.dsa.dev/v1/namespaces/*/websites.",
            "Websites are stored in etcd like any built-in object, so kubectl get ws, RBAC and watches work at once.",
          ],
        },
        {
          name: "Create a Website",
          path: ["you", "api", "proxy", "op", "deploy"],
          steps: [
            "kubectl apply -f example.yaml: the API server checks it against the CRD's schema, fills in defaults and stores it.",
            "The operator's watch on websites (through kubectl proxy, as its ServiceAccount) delivers an ADDED event.",
            "The informer puts the name blog on the work queue, and a worker calls reconcile('blog').",
            "reconcile() applies the Deployment and Service built by desired.py, each owned by the Website, then writes status.ready.",
          ],
        },
        {
          name: "Someone edits the Deployment by hand",
          path: ["deploy", "op", "deploy"],
          steps: [
            "kubectl scale sets replicas to 5. The operator also watches the Deployments it manages; the ownerReference says which Website to reconcile.",
            "reconcile() applies the desired Deployment again, with force: replicas go back to 2. Drift corrected.",
          ],
        },
        {
          name: "Delete the Website",
          path: ["you", "api", "etcd"],
          steps: [
            "kubectl delete website blog: no finalizers, so the API server deletes it right away.",
            "It's gone from etcd. The garbage collector finds the Deployment and Service whose owner no longer exists and deletes them: the operator needs no delete code at all.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
All through this world, little robots did the work: one keeps the right number of pods, one rolls out new versions, one keeps Services' address lists up to date. Now you'll **build your own robot**.

First you invent a new word and teach it to Kubernetes: **Website**. After that, anyone can write a tiny note:

> I want a Website called blog, for blog.example.com, saying "Hello!", with 2 copies.

Then your robot reads those notes and does all the boring work: it makes a Deployment with 2 copies of a little web server that says "Hello!", and a Service so others can reach it. It writes back on the note: "ready: 2/2".

Your robot follows one simple rule, over and over: **look at what the note asks for, look at what exists, and fix the difference.** It never asks "what just happened?". So if someone messes with its Deployment by hand, or the robot was asleep when the note changed, it just looks again and fixes things. And when the note is thrown away, Kubernetes' cleaning robot removes everything your robot made, because each piece is labelled "belongs to: blog".

## The pieces
| File | What it is | Lesson |
|---|---|---|
| \`crd.yaml\` | the new kind, its schema (validation, a default) and its printer columns | Controllers, CRDs and operators |
| \`rbac.yaml\` | a ServiceAccount allowed exactly what the operator needs, in one namespace | RBAC, ServiceAccounts and Pod Security |
| \`desired.py\` | pure functions: Website in, Deployment and Service out | Deployments and Services |
| \`kube.py\` | a tiny API client: get, list, watch, server-side apply, patch | How a cluster works |
| \`controller.py\` | informers, a de-duplicating work queue and reconcile | Controllers, CRDs and operators |
| \`e2e.sh\` | proves create, update, drift, validation, restarts and deletion | |

## Why it's built this way
- **Level-triggered**: \`reconcile(name)\` takes only a name, reads the current Website, and makes the world match it. Events just say "look at this one again". Missed events, restarts and duplicates all heal the same way.
- **Server-side apply** (\`PATCH\` with \`application/apply-patch+yaml\`, a \`fieldManager\` and \`force=true\`): "make it look like this". It creates or updates in one call, and takes back fields someone changed by hand.
- **Owner references** make every object the operator creates belong to its Website, so deleting a Website deletes them (the garbage collector), and a change to them maps back to the Website to reconcile.
- **Status is separate**: the operator writes \`/status\` and users write \`spec\`; \`observedGeneration\` says which spec version the status describes.
- **Least privilege**: the operator runs as its ServiceAccount (here via \`kubectl proxy --as\`), so a bug can't touch Secrets or other namespaces.
- **Standard library only**: urllib, json, threading, queue. Real operators use client-go/controller-runtime (Go), kopf (Python) or the Java Operator SDK, which add caches, rate-limited queues, leader election and metrics, but the shape is the same.

## What you need
Python 3.9+, \`kubectl\` and any cluster where you can create CRDs (kind, minikube, k3d, Docker Desktop). No pip installs: the operator runs on your machine and reaches the cluster through \`kubectl proxy\`. Moving it into the cluster is an extension: a Deployment using the ServiceAccount, and \`https://kubernetes.default.svc\` with the mounted token instead of the proxy.`,
    keyPoints: [
      "A CRD adds a kind with schema validation, defaults, printer columns and a status sub-resource; invalid objects never reach the controller.",
      "Informers list then watch; events only enqueue names; a worker reconciles one name at a time from the current state.",
      "Reconcile is level-triggered and idempotent: compute desired objects from the spec, server-side apply them, write status.",
      "ownerReferences give deletion for free and map child changes back to the parent; finalizers are only for external resources.",
      "The operator gets its own ServiceAccount with a minimal Role; test with kubectl auth can-i --as.",
    ],
    interview: [
      {
        q: "Walk me through how you'd write a Kubernetes operator.",
        a: "1) Design the **API**: a CRD with a clear spec (what users want) and status (what the operator observed: conditions, observedGeneration), an OpenAPI schema with validation and defaults, printer columns. 2) **Reconcile loop** with controller-runtime/Kubebuilder (or kopf): watch the CR and owned resources via informers; on any event enqueue the key; reconcile reads the current object, computes desired children, creates/updates them (server-side apply), sets **ownerReferences**, and updates status. Make it **idempotent and level-triggered**, return errors to requeue with backoff. 3) Use **finalizers** only for external cleanup. 4) **RBAC** with least privilege, generated from markers. 5) Production concerns: leader election for HA, rate limiting, metrics, events, conversion webhooks when the API version changes, and envtest/e2e tests (create, update, drift, deletion, restart).",
        freq: "common",
      },
      {
        q: "What is server-side apply and why is it good for controllers?",
        a: "Server-side apply sends the **full desired state** of the fields you care about as a PATCH with `application/apply-patch+yaml` and a `fieldManager`. The API server merges it and records **field ownership** in `managedFields`. Benefits: create-or-update in one call (no get-then-update races), no clobbering of fields owned by others (an HPA's replicas, another controller's annotations), clear **conflicts** when two managers want the same field, and `force=true` lets a controller reclaim its fields to fix drift. Compared with client-side apply it doesn't need the last-applied annotation, and compared with update it doesn't need resourceVersion retries.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "The operator was stopped while someone changed a Website's replicas from 2 to 3. What happens when it starts again?",
        options: ["The change is lost forever", "Its informers list all Websites on startup, reconcile sees replicas 3 and updates the Deployment", "It only reacts to new events", "Kubernetes replays the missed event from a queue"],
        answer: 1,
        explain: "Level-triggered reconcile works from the current state, so missed events don't matter.",
      },
      {
        q: "Why doesn't the operator need any code to delete Deployments when a Website is deleted?",
        options: ["The CRD deletes them", "They carry an ownerReference to the Website, so the garbage collector deletes them", "Deployments expire", "kubectl deletes them"],
        answer: 1,
        explain: "Owner references plus the garbage collector handle cascading deletion.",
      },
      {
        q: "Someone creates a Website with replicas: 0, but the schema says minimum 1. Where is it rejected?",
        options: ["In the operator's reconcile", "By the API server, before it's stored", "By the Deployment controller", "It isn't rejected"],
        answer: 1,
        explain: "CRD schema validation runs in the API server, so the controller never sees invalid objects.",
      },
    ],
    project: {
      summary: `You'll build **website-operator**: a new Kubernetes kind, **Website**, and the controller that turns each Website into a Deployment and a Service, keeps them in line, and reports status. In five steps: the CRD and least-privilege RBAC, the desired-state functions with unit tests, a tiny API client (get, list, watch, server-side apply), the controller with informers, a work queue and reconcile, and \`e2e.sh\`, which proves creation, updates, drift correction, validation, restarts and garbage collection against a real cluster.

You need **Python 3.9+** and **kubectl** with a cluster where you can create CRDs. No packages to install.`,
      skills: [
        "Designing a CustomResourceDefinition: schema, defaults, validation, status, printer columns",
        "Least-privilege RBAC for a controller",
        "Talking to the Kubernetes API over plain HTTP: list, watch, server-side apply, status patches",
        "Informers and a de-duplicating work queue",
        "Level-triggered, idempotent reconciliation",
        "Owner references and garbage collection",
        "Testing a controller end to end",
      ],
      tree: `website-operator/
├── crd.yaml          # the Website kind: schema, default, printer columns, status
├── rbac.yaml         # namespace, ServiceAccount, Role, RoleBinding
├── example.yaml      # a Website to try
├── desired.py        # Website → Deployment + Service + status (pure functions)
├── test_desired.py   # unit tests for desired.py
├── kube.py           # a tiny Kubernetes API client (standard library only)
├── controller.py     # informers, work queue, reconcile
└── e2e.sh            # end-to-end test against your cluster`,
      steps: [
        {
          title: "1. The API: a CRD and the operator's permissions",
          explain: `- **\`crd.yaml\`** defines \`Website\` in the group \`quest.dsa.dev\`: \`domain\` must look like a host name, \`message\` is at most 200 characters, and \`replicas\` is 1 to 5, **defaulting to 1**. \`status\` is a separate sub-resource with \`ready\`, \`url\` and \`observedGeneration\`, and the printer columns make \`kubectl get websites\` show the domain and readiness.
- **\`rbac.yaml\`** creates the \`quest-websites\` namespace and the operator's identity: a ServiceAccount whose Role allows reading Websites, patching their status, and managing Deployments and Services, in this namespace only. No Secrets, no delete (the garbage collector deletes for us), nothing cluster-wide.
- **\`example.yaml\`** is a Website to play with.

Apply them. The Website is stored, but nothing happens yet: the READY column is empty because no controller is running.`,
          files: [
            { path: "crd.yaml", lang: "yaml", code: `# A new kind of object: Website. You write the spec; the operator makes it real and writes the status.
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: websites.quest.dsa.dev
spec:
  group: quest.dsa.dev
  scope: Namespaced
  names: { kind: Website, plural: websites, singular: website, shortNames: [ws] }
  versions:
    - name: v1
      served: true
      storage: true
      subresources:
        status: {}
      additionalPrinterColumns:
        - { name: Domain, type: string, jsonPath: .spec.domain }
        - { name: Ready, type: string, jsonPath: .status.ready }
        - { name: Age, type: date, jsonPath: .metadata.creationTimestamp }
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [domain, message]
              properties:
                domain: { type: string, pattern: '^[a-z0-9.-]+$' }
                message: { type: string, maxLength: 200 }
                replicas: { type: integer, minimum: 1, maximum: 5, default: 1 }
            status:
              type: object
              properties:
                ready: { type: string }              # "2/2"
                url: { type: string }
                observedGeneration: { type: integer }` },
            { path: "rbac.yaml", lang: "yaml", code: `# The operator's identity and exactly the permissions it needs, in one namespace. Nothing more.
apiVersion: v1
kind: Namespace
metadata: { name: quest-websites }
---
apiVersion: v1
kind: ServiceAccount
metadata: { name: website-operator, namespace: quest-websites }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: website-operator, namespace: quest-websites }
rules:
  - apiGroups: [quest.dsa.dev]
    resources: [websites]
    verbs: [get, list, watch]                  # read what people asked for
  - apiGroups: [quest.dsa.dev]
    resources: [websites/status]
    verbs: [patch]                             # report back
  - apiGroups: [apps]
    resources: [deployments]
    verbs: [get, list, watch, create, patch]   # make it happen
  - apiGroups: [""]
    resources: [services]
    verbs: [get, list, watch, create, patch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: website-operator, namespace: quest-websites }
subjects:
  - { kind: ServiceAccount, name: website-operator, namespace: quest-websites }
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: Role, name: website-operator }` },
            { path: "example.yaml", lang: "yaml", code: `apiVersion: quest.dsa.dev/v1
kind: Website
metadata:
  name: blog
  namespace: quest-websites
spec:
  domain: blog.example.com
  message: Hello from a Website made by my own operator!
  replicas: 2` },
          ],
          run: `kubectl apply -f crd.yaml -f rbac.yaml
kubectl wait --for=condition=Established crd/websites.quest.dsa.dev
kubectl apply -f example.yaml
kubectl -n quest-websites get websites
kubectl -n quest-websites get website blog -o jsonpath='{.spec}{"\\n"}'`,
          output: `customresourcedefinition.apiextensions.k8s.io/websites.quest.dsa.dev created
namespace/quest-websites created
serviceaccount/website-operator created
role.rbac.authorization.k8s.io/website-operator created
rolebinding.rbac.authorization.k8s.io/website-operator created
customresourcedefinition.apiextensions.k8s.io/websites.quest.dsa.dev condition met
website.quest.dsa.dev/blog created
NAME   DOMAIN             READY   AGE
blog   blog.example.com           0s
{"domain":"blog.example.com","message":"Hello from a Website made by my own operator!","replicas":2}`,
        },
        {
          title: "2. What should exist: desired.py",
          explain: `The heart of an operator is a function from **what was asked** to **what should exist**. Keep it pure (no network), and it's easy to test.
- \`deployment(website)\` and \`service(website)\` return complete objects named \`website-<name>\`, labelled \`app.kubernetes.io/managed-by: website-operator\`, and owned by the Website: \`ownerReferences\` with its \`uid\`, \`controller: true\` and \`blockOwnerDeletion\`.
- The pods run a one-line Node.js server that answers with \`$MESSAGE\`; the readiness probe waits until port 8080 accepts connections.
- \`status()\` turns the Deployment's \`readyReplicas\` into \`"2/2"\` and records which \`generation\` of the spec it describes.

The tests check the things that would silently break an operator: the selector must match the pod labels, the Service must select the pods, everything must be owned, and the default must be 1.`,
          files: [
            { path: "desired.py", lang: "python", code: `"""What the world should look like for one Website. Pure functions: no network, easy to test."""

MANAGER = "website-operator"
IMAGE = "node:20-slim"

# the tiny web server every Website runs; it serves $MESSAGE
SERVER = (
    "require('http').createServer((req, res) => res.end(process.env.MESSAGE + '\\\\n')).listen(8080);"
    "process.on('SIGTERM', () => process.exit(0))"
)


def name_for(website):
    return f"website-{website['metadata']['name']}"


def owner_reference(website):
    # "This object belongs to that Website": delete the Website, and the garbage collector deletes this too
    return {
        "apiVersion": website["apiVersion"],
        "kind": "Website",
        "name": website["metadata"]["name"],
        "uid": website["metadata"]["uid"],
        "controller": True,
        "blockOwnerDeletion": True,
    }


def labels(website):
    return {"app.kubernetes.io/managed-by": MANAGER, "quest.dsa.dev/website": website["metadata"]["name"]}


def deployment(website):
    spec = website["spec"]
    return {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": name_for(website),
            "namespace": website["metadata"]["namespace"],
            "labels": labels(website),
            "ownerReferences": [owner_reference(website)],
        },
        "spec": {
            "replicas": spec.get("replicas", 1),
            "selector": {"matchLabels": labels(website)},
            "template": {
                "metadata": {"labels": labels(website)},
                "spec": {
                    "containers": [
                        {
                            "name": "web",
                            "image": IMAGE,
                            "command": ["node", "-e", SERVER],
                            "env": [{"name": "MESSAGE", "value": spec["message"]}],
                            "ports": [{"containerPort": 8080}],
                            "readinessProbe": {"tcpSocket": {"port": 8080}, "periodSeconds": 2},
                        }
                    ]
                },
            },
        },
    }


def service(website):
    return {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": name_for(website),
            "namespace": website["metadata"]["namespace"],
            "labels": labels(website),
            "ownerReferences": [owner_reference(website)],
        },
        "spec": {"selector": labels(website), "ports": [{"port": 80, "targetPort": 8080}]},
    }


def status(website, deployment_obj):
    """The Website's status, from what its Deployment reports."""
    want = website["spec"].get("replicas", 1)
    ready = ((deployment_obj or {}).get("status") or {}).get("readyReplicas", 0)
    return {
        "ready": f"{ready}/{want}",
        "url": f"http://{name_for(website)}.{website['metadata']['namespace']}.svc",
        "observedGeneration": website["metadata"]["generation"],
    }` },
            { path: "test_desired.py", lang: "python", code: `import unittest

import desired

WEBSITE = {
    "apiVersion": "quest.dsa.dev/v1",
    "kind": "Website",
    "metadata": {"name": "blog", "namespace": "team-a", "uid": "1234", "generation": 3},
    "spec": {"domain": "blog.example.com", "message": "hello", "replicas": 2},
}


class DesiredTest(unittest.TestCase):
    def test_deployment_follows_the_spec(self):
        d = desired.deployment(WEBSITE)
        self.assertEqual(d["metadata"]["name"], "website-blog")
        self.assertEqual(d["spec"]["replicas"], 2)
        self.assertEqual(d["spec"]["template"]["spec"]["containers"][0]["env"], [{"name": "MESSAGE", "value": "hello"}])

    def test_selector_matches_the_pod_labels(self):
        d = desired.deployment(WEBSITE)
        self.assertEqual(d["spec"]["selector"]["matchLabels"], d["spec"]["template"]["metadata"]["labels"])

    def test_everything_is_owned_by_the_website(self):
        for obj in (desired.deployment(WEBSITE), desired.service(WEBSITE)):
            [ref] = obj["metadata"]["ownerReferences"]
            self.assertEqual((ref["kind"], ref["name"], ref["uid"], ref["controller"]), ("Website", "blog", "1234", True))

    def test_service_selects_the_pods(self):
        self.assertEqual(desired.service(WEBSITE)["spec"]["selector"], desired.labels(WEBSITE))

    def test_replicas_default_to_one(self):
        w = {**WEBSITE, "spec": {"domain": "x.example.com", "message": "hi"}}
        self.assertEqual(desired.deployment(w)["spec"]["replicas"], 1)

    def test_status(self):
        self.assertEqual(desired.status(WEBSITE, None)["ready"], "0/2")
        s = desired.status(WEBSITE, {"status": {"readyReplicas": 2}})
        self.assertEqual(s, {"ready": "2/2", "url": "http://website-blog.team-a.svc", "observedGeneration": 3})


if __name__ == "__main__":
    unittest.main()` },
          ],
          run: "python3 -m unittest -v test_desired",
          output: `test_deployment_follows_the_spec (test_desired.DesiredTest.test_deployment_follows_the_spec) ... ok
test_everything_is_owned_by_the_website (test_desired.DesiredTest.test_everything_is_owned_by_the_website) ... ok
test_replicas_default_to_one (test_desired.DesiredTest.test_replicas_default_to_one) ... ok
test_selector_matches_the_pod_labels (test_desired.DesiredTest.test_selector_matches_the_pod_labels) ... ok
test_service_selects_the_pods (test_desired.DesiredTest.test_service_selects_the_pods) ... ok
test_status (test_desired.DesiredTest.test_status) ... ok

----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK`,
        },
        {
          title: "3. Talking to the API: kube.py",
          explain: `The Kubernetes API is plain HTTP and JSON, so the standard library is enough.
- The client talks to **\`kubectl proxy\`**, which listens on localhost, adds your credentials and handles TLS. Inside a pod you'd call \`https://kubernetes.default.svc\` with the mounted ServiceAccount token instead (the RBAC lesson did exactly that).
- \`get()\` returns \`None\` for 404, which makes "does it exist?" checks simple.
- \`apply()\` is **server-side apply**: a PATCH with \`application/apply-patch+yaml\`, a \`fieldManager\` and \`force=true\`. One call creates or updates, the API server records which fields we own, and \`force\` takes them back from anyone who changed them.
- \`merge_patch()\` updates just the fields you send; we use it for \`/status\`.
- \`watch()\` opens \`?watch=true\` from a \`resourceVersion\` and yields one event per JSON line, with no timeout: the connection stays open as long as the server keeps it.

Try it with your own permissions: list the Websites, and ask for a Deployment that doesn't exist yet.`,
          files: [{ path: "kube.py", lang: "python", code: `"""A tiny Kubernetes API client: plain HTTP + JSON, standard library only.

It talks to \`kubectl proxy\`, which handles the login and TLS, so every call is a simple HTTP request.
(Inside a pod you'd use https://kubernetes.default.svc with the ServiceAccount token instead.)
"""
import json
import urllib.error
import urllib.request


class ApiError(Exception):
    def __init__(self, status, body):
        super().__init__(f"HTTP {status}: {body.get('message', body)}")
        self.status = status


class Kube:
    def __init__(self, base="http://127.0.0.1:8001"):
        self.base = base.rstrip("/")

    def request(self, method, path, body=None, content_type="application/json", stream=False):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method, headers={"Content-Type": content_type})
        try:
            resp = urllib.request.urlopen(req, timeout=None if stream else 30)
        except urllib.error.HTTPError as e:
            raw = e.read()
            raise ApiError(e.code, json.loads(raw) if raw.startswith(b"{") else {"message": raw.decode()}) from None
        return resp if stream else json.load(resp)

    def get(self, path):
        """The object, or None if it doesn't exist."""
        try:
            return self.request("GET", path)
        except ApiError as e:
            if e.status == 404:
                return None
            raise

    def apply(self, path, obj, manager):
        """Server-side apply: "make it look like this". Creates or updates, and the API server
        remembers which fields this manager owns. force=true takes them back from anyone who
        changed them by hand (that's how drift gets undone)."""
        return self.request("PATCH", f"{path}?fieldManager={manager}&force=true", obj, "application/apply-patch+yaml")

    def merge_patch(self, path, patch):
        return self.request("PATCH", path, patch, "application/merge-patch+json")

    def watch(self, path, resource_version):
        """Yield (type, object) for every change after resource_version, as the server streams them."""
        sep = "&" if "?" in path else "?"
        with self.request("GET", f"{path}{sep}watch=true&allowWatchBookmarks=true&resourceVersion={resource_version}", stream=True) as resp:
            for line in resp:
                event = json.loads(line)
                yield event["type"], event["object"]` }],
          run: `kubectl proxy --port=8001 &
python3 -c "
from kube import Kube
kube = Kube()
for w in kube.request('GET', '/apis/quest.dsa.dev/v1/namespaces/quest-websites/websites')['items']:
    print(w['metadata']['name'], w['spec'])
print(kube.get('/apis/apps/v1/namespaces/quest-websites/deployments/website-blog'))
"
kill %1`,
          output: `blog {'domain': 'blog.example.com', 'message': 'Hello from a Website made by my own operator!', 'replicas': 2}
None`,
        },
        {
          title: "4. The controller",
          explain: `- **Three informers**, one thread each: Websites, and the Deployments and Services the operator manages (selected by the \`managed-by\` label). Each **lists** once, enqueues everything, then **watches** from the list's \`resourceVersion\`. If the watch ends or reports an error (such as **410 Gone**, when the version is too old), it lists again: that's what makes restarts and network blips safe.
- Events never carry work themselves. They only **enqueue a name**: a Website's own name, or for a Deployment or Service, the Website named in its ownerReference. The \`queued\` set drops duplicates, so ten quick events become one reconcile.
- **\`reconcile(name)\`** reads the Website. If it's gone there's nothing to do (garbage collection cleans up). Otherwise it applies the desired Deployment and Service, then patches \`/status\` only if it changed, which avoids an endless loop of status updates waking itself up.
- A failed reconcile is **logged and retried** 2 s later; one bad object must never crash the operator.

Run it as its ServiceAccount: \`kubectl proxy --as=...\` impersonates it, so the operator gets exactly the Role's permissions, as it would in a pod. Leave it running, and watch the Website become ready.`,
          files: [{ path: "controller.py", lang: "python", code: `"""The Website operator: watch Websites (and what they own), and reconcile each one.

    python3 controller.py --namespace quest-websites --api http://127.0.0.1:8001

Level-triggered: reconcile() never asks "what changed?", only "what should exist, and does it?".
So a missed event, a restart or a manual edit are all fixed the same way.
"""
import argparse
import queue
import sys
import threading
import time

import desired
from kube import ApiError, Kube

GROUP = "/apis/quest.dsa.dev/v1"


def log(msg):
    print(msg, flush=True)


class Controller:
    def __init__(self, kube, namespace):
        self.kube = kube
        self.ns = namespace
        self.work = queue.Queue()  # names of Websites to reconcile
        self.queued = set()
        self.lock = threading.Lock()

    def paths(self, name=""):
        websites = f"{GROUP}/namespaces/{self.ns}/websites"
        return {
            "websites": websites,
            "website": f"{websites}/{name}",
            "deployment": f"/apis/apps/v1/namespaces/{self.ns}/deployments/website-{name}",
            "service": f"/api/v1/namespaces/{self.ns}/services/website-{name}",
        }

    def enqueue(self, name):
        with self.lock:  # one entry per name, however many events arrive
            if name in self.queued:
                return
            self.queued.add(name)
        self.work.put(name)

    # ---- the heart of it
    def reconcile(self, name):
        p = self.paths(name)
        website = self.kube.get(p["website"])
        if website is None:
            return  # deleted: the garbage collector removes what it owned (ownerReferences)
        self.kube.apply(p["deployment"], desired.deployment(website), desired.MANAGER)
        self.kube.apply(p["service"], desired.service(website), desired.MANAGER)
        new_status = desired.status(website, self.kube.get(p["deployment"]))
        if website.get("status") != new_status:
            self.kube.merge_patch(f"{p['website']}/status", {"status": new_status})
            log(f"{name}: ready {new_status['ready']}")

    def worker(self):
        while True:
            name = self.work.get()
            with self.lock:
                self.queued.discard(name)
            try:
                self.reconcile(name)
            except Exception as e:  # never die on one bad object: log it and retry later
                log(f"{name}: reconcile failed ({e}), retrying in 2s")
                threading.Timer(2, self.enqueue, [name]).start()

    # ---- informers: list once, then watch for changes; start over if the watch breaks
    def informer(self, path, to_name):
        while True:
            try:
                listing = self.kube.request("GET", path)
                for item in listing["items"]:
                    self.enqueue(to_name(item))
                for kind, obj in self.kube.watch(path, listing["metadata"]["resourceVersion"]):
                    if kind == "BOOKMARK":
                        continue
                    if kind == "ERROR":
                        break  # e.g. 410 Gone: our resourceVersion is too old, so list again
                    name = to_name(obj)
                    if name:
                        self.enqueue(name)
            except (ApiError, OSError) as e:
                log(f"watch {path} interrupted ({e}), restarting")
                time.sleep(1)

    def run(self):
        def owner(obj):
            # a Deployment or Service changed: reconcile the Website that owns it
            refs = obj["metadata"].get("ownerReferences", [])
            return next((r["name"] for r in refs if r["kind"] == "Website"), None)

        selector = f"?labelSelector=app.kubernetes.io/managed-by%3D{desired.MANAGER}"
        sources = [
            (self.paths()["websites"], lambda o: o["metadata"]["name"]),
            (f"/apis/apps/v1/namespaces/{self.ns}/deployments{selector}", owner),
            (f"/api/v1/namespaces/{self.ns}/services{selector}", owner),
        ]
        for path, to_name in sources:
            threading.Thread(target=self.informer, args=(path, to_name), daemon=True).start()
        threading.Thread(target=self.worker, daemon=True).start()
        log(f"website operator watching namespace {self.ns}")
        while True:
            time.sleep(60)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--namespace", required=True)
    ap.add_argument("--api", default="http://127.0.0.1:8001")
    args = ap.parse_args()
    try:
        Controller(Kube(args.api), args.namespace).run()
    except KeyboardInterrupt:
        sys.exit(0)` }],
          run: `kubectl proxy --port=8001 --as=system:serviceaccount:quest-websites:website-operator &
python3 controller.py --namespace quest-websites
# in another terminal:
kubectl -n quest-websites get websites,deployments,services`,
          output: `website operator watching namespace quest-websites
blog: ready 0/2
blog: ready 2/2
NAME                         DOMAIN             READY   AGE
website.quest.dsa.dev/blog   blog.example.com   2/2     5s

NAME                           READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/website-blog   2/2     2            2           2s

NAME                   TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE
service/website-blog   ClusterIP   10.43.34.81   <none>        80/TCP    2s`,
        },
        {
          title: "5. Prove it: e2e.sh",
          explain: `\`e2e.sh\` starts from nothing and checks every promise an operator makes:
1. The unit tests pass.
2. The CRD is installed, and the operator's ServiceAccount **can't** read Secrets or touch other namespaces.
3. The operator starts with the ServiceAccount's permissions.
4. A new Website gets an owned Deployment and Service, its status reaches 2/2, and the site serves its message.
5. Changing the spec rolls out the new message.
6. **Drift**: a manual \`kubectl scale\` is undone, and a deleted Service comes back.
7. **Validation**: \`replicas: 0\` is rejected by the API server; the operator never sees it.
8. **Level-triggered**: a change made while the operator is down is applied when it restarts, and the status catches up.
9. **Deletion**: deleting the Website removes the Deployment and Service through garbage collection.

It cleans up the namespace and the CRD when it exits, even if a check fails.`,
          files: [{ path: "e2e.sh", lang: "bash", code: `#!/usr/bin/env bash
# Unit tests, then the operator against the cluster in your current kubectl context. Needs python3 and kubectl.
set -euo pipefail
cd "$(dirname "$0")"
NS=quest-websites
SA=system:serviceaccount:$NS:website-operator
PORT=\${PORT:-8011}
k() { kubectl -n "$NS" "$@"; }

pass() { echo "  ok: $1"; }
fail() { echo "  FAILED: $1" >&2; tail -n 20 operator.log >&2 || true; exit 1; }
expect() { [ "$1" = "$2" ] && pass "$3" || fail "$3 (expected '$2', got '$1')"; }
eventually() { # DESCRIPTION EXPECTED COMMAND...: retry for up to 60 s
  local want=$2 desc=$1 got=""
  shift 2
  for _ in $(seq 1 120); do
    got=$("$@" 2> /dev/null || true)
    [ "$got" = "$want" ] && break
    sleep 0.5
  done
  expect "$got" "$want" "$desc"
}

operator_pid=""
start_operator() {
  python3 controller.py --namespace "$NS" --api "http://127.0.0.1:$PORT" >> operator.log 2>&1 &
  operator_pid=$!
}
cleanup() {
  for pid in $operator_pid \${proxy_pid:-}; do
    { kill "$pid" && wait "$pid"; } 2> /dev/null || true
  done
  kubectl delete namespace "$NS" --wait=false > /dev/null 2>&1 || true
  kubectl delete -f crd.yaml --wait=false > /dev/null 2>&1 || true
  rm -f operator.log
}
trap cleanup EXIT

echo "1. unit tests"
python3 -m unittest -q test_desired 2>&1 | tail -n 1 | grep -q '^OK' && pass "desired-state functions" || fail "unit tests"

echo "2. install the CRD and the operator's permissions"
kubectl apply -f crd.yaml > /dev/null
kubectl wait --for=condition=Established crd/websites.quest.dsa.dev --timeout=60s > /dev/null && pass "kind Website exists"
kubectl apply -f rbac.yaml > /dev/null
expect "$(kubectl auth can-i get secrets -n "$NS" --as="$SA")" "no" "the operator can't read Secrets"
expect "$(kubectl auth can-i create deployments -n default --as="$SA")" "no" "or touch other namespaces"

echo "3. start the operator, running with the ServiceAccount's permissions (kubectl proxy impersonates it)"
kubectl proxy --port="$PORT" --as="$SA" > /dev/null &
proxy_pid=$!
for _ in $(seq 1 50); do curl -s "localhost:$PORT/version" > /dev/null && break; sleep 0.1; done
start_operator
eventually "the operator is watching" "yes" sh -c "grep -q 'watching namespace' operator.log && echo yes"

echo "4. create a Website"
kubectl apply -f example.yaml > /dev/null
eventually "it made Deployment website-blog with 2 replicas" "2" k get deployment website-blog -o jsonpath='{.spec.replicas}'
expect "$(k get deployment website-blog -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}')" "Website/blog" "the Deployment is owned by the Website"
eventually "status reports 2/2 ready" "2/2" k get website blog -o jsonpath='{.status.ready}'
k run client --image=node:20-slim --restart=Never -- sleep 3600 > /dev/null
k wait --for=condition=Ready pod/client --timeout=120s > /dev/null
site() { k exec client -- node -e "fetch('http://website-blog', { signal: AbortSignal.timeout(2000) }).then((r) => r.text()).then((t) => process.stdout.write(t))"; }
eventually "the site serves its message" "Hello from a Website made by my own operator!" site

echo "5. change the Website: the operator rolls it out"
k patch website blog --type=merge -p '{"spec": {"message": "Version 2 is live"}}' > /dev/null
eventually "the new message is served" "Version 2 is live" site

echo "6. drift: someone edits what the operator manages by hand"
k scale deployment website-blog --replicas=5 > /dev/null
eventually "the operator puts replicas back to 2" "2" k get deployment website-blog -o jsonpath='{.spec.replicas}'
k delete service website-blog > /dev/null
eventually "a deleted Service is recreated" "website-blog" k get service website-blog -o jsonpath='{.metadata.name}'

echo "7. bad input never reaches the operator"
out=$(kubectl apply -f - 2>&1 <<YAML || true
apiVersion: quest.dsa.dev/v1
kind: Website
metadata: { name: broken, namespace: $NS }
spec: { domain: "Not Valid", message: hi, replicas: 0 }
YAML
)
echo "$out" | grep -q 'should be greater than or equal to 1' && pass "the API server rejected replicas: 0 (CRD schema)" || fail "schema: $out"

echo "8. level-triggered: changes made while the operator is down are picked up when it comes back"
kill "$operator_pid"
wait "$operator_pid" 2> /dev/null || true
k patch website blog --type=merge -p '{"spec": {"replicas": 3}}' > /dev/null
sleep 2
expect "$(k get deployment website-blog -o jsonpath='{.spec.replicas}')" "2" "nothing happens while it's down"
start_operator
eventually "after a restart it converges to 3 replicas" "3" k get deployment website-blog -o jsonpath='{.spec.replicas}'
eventually "status catches up: 3/3" "3/3" k get website blog -o jsonpath='{.status.ready}'

echo "9. delete the Website: the garbage collector removes everything it owned"
k delete website blog > /dev/null
eventually "the Deployment and Service are gone" "0" sh -c "kubectl -n $NS get deployments,services -l app.kubernetes.io/managed-by=website-operator --no-headers | wc -l | tr -d ' '"

echo "all checks passed"` }],
          run: "bash e2e.sh",
          output: `1. unit tests
  ok: desired-state functions
2. install the CRD and the operator's permissions
  ok: kind Website exists
  ok: the operator can't read Secrets
  ok: or touch other namespaces
3. start the operator, running with the ServiceAccount's permissions (kubectl proxy impersonates it)
  ok: the operator is watching
4. create a Website
  ok: it made Deployment website-blog with 2 replicas
  ok: the Deployment is owned by the Website
  ok: status reports 2/2 ready
  ok: the site serves its message
5. change the Website: the operator rolls it out
  ok: the new message is served
6. drift: someone edits what the operator manages by hand
  ok: the operator puts replicas back to 2
  ok: a deleted Service is recreated
7. bad input never reaches the operator
  ok: the API server rejected replicas: 0 (CRD schema)
8. level-triggered: changes made while the operator is down are picked up when it comes back
  ok: nothing happens while it's down
  ok: after a restart it converges to 3 replicas
  ok: status catches up: 3/3
9. delete the Website: the garbage collector removes everything it owned
  ok: the Deployment and Service are gone
all checks passed`,
        },
      ],
      extensions: [
        "Run the operator in the cluster: a Dockerfile, a Deployment with serviceAccountName, and in-cluster config (token, CA, kubernetes.default.svc) in kube.py",
        "Add conditions to the status (Available, Progressing, with reasons and lastTransitionTime) and record Kubernetes Events on the Website",
        "Create an Ingress for spec.domain, and a finalizer that removes a (pretend) DNS record before the Website is deleted",
        "Add leader election with a Lease object, so two copies of the operator can run and only one acts",
        "Rate-limit retries with exponential backoff per name, and resync every Website every few minutes",
        "Add a v2 of the API (say, spec.messages as a list) and a conversion webhook",
        "Rewrite it with kopf (Python) or Kubebuilder (Go) and compare what the framework gives you",
      ],
      verify: "bash e2e.sh",
      k8s: true,
      images: ["node:20-slim"],
    },
  },

  // ------------------------------------------------------------------ INTERVIEW
  {
    id: "k8s-interview",
    title: "The Kubernetes interview: putting it all together",
    tagline: "The question bank by topic, the kubectl commands to know cold, a troubleshooting map, the classic review-this-manifest exercise, design questions, and where to go after Kubernetes.",
    difficulty: "advanced",
    minutes: 35,
    diagram: {
      title: "The troubleshooting map",
      nodes: [
        { id: "you", label: "kubectl get pods", kind: "client", x: 90, y: 280, sub: "start here" },
        { id: "status", label: "STATUS + RESTARTS", kind: "monitor", x: 280, y: 280, sub: "the first clue" },
        { id: "pending", label: "Pending", kind: "control", x: 500, y: 70, sub: "describe → Events" },
        { id: "pull", label: "ImagePullBackOff", kind: "registry", x: 500, y: 210, sub: "name, tag, pull secret" },
        { id: "crash", label: "CrashLoopBackOff", kind: "worker", x: 500, y: 350, sub: "logs --previous, exit code" },
        { id: "ready", label: "Running, 0/1 Ready", kind: "service", x: 500, y: 490, sub: "readiness probe" },
        { id: "svc", label: "Service", kind: "lb", x: 740, y: 350, sub: "selector → EndpointSlice" },
        { id: "netpol", label: "NetworkPolicy", kind: "gateway", x: 740, y: 490, sub: "who may connect" },
        { id: "ing", label: "Ingress / Gateway", kind: "gateway", x: 900, y: 210, sub: "host, path, class" },
      ],
      edges: [
        { from: "you", to: "status" },
        { from: "status", to: "pending" },
        { from: "status", to: "pull" },
        { from: "status", to: "crash" },
        { from: "status", to: "ready" },
        { from: "ready", to: "svc", label: "not Ready = not an endpoint" },
        { from: "ing", to: "svc" },
        { from: "svc", to: "netpol" },
      ],
      flows: [
        {
          name: "A pod that won't schedule",
          path: ["you", "status", "pending"],
          steps: [
            "kubectl get pods: STATUS Pending, no node in -o wide.",
            "kubectl describe pod: the FailedScheduling event says why: Insufficient cpu or memory (requests), an untolerated taint, node affinity, or an unbound PersistentVolumeClaim.",
          ],
        },
        {
          name: "A pod that keeps crashing",
          path: ["you", "status", "crash"],
          steps: [
            "RESTARTS keeps climbing and STATUS shows CrashLoopBackOff: the container starts, then exits.",
            "kubectl logs --previous shows the last run's output; describe shows the exit code: 1 = app error, 137 = OOMKilled or killed by liveness, 143 = SIGTERM.",
          ],
        },
        {
          name: "Pods are fine, but no traffic arrives",
          path: ["ing", "svc", "ready", "svc", "netpol"],
          steps: [
            "Start at the entrance: does the Ingress rule's host and path point at the right Service and port, with the right class?",
            "kubectl get endpointslices -l kubernetes.io/service-name=web. Empty? The selector doesn't match the pod labels, or no pod is Ready.",
            "Pods Running but 0/1 Ready: the readiness probe fails. describe shows why; once it passes, the endpoints fill in.",
            "Endpoints are there but connections hang or are refused? A NetworkPolicy in the target namespace may block the caller.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've now met the whole **robot city**. You write **wishes** (YAML) and hand them to the **front desk** (the API server), which writes them in the **big book** (etcd). Robots (**controllers**) read the book and make the wishes come true: the right number of **pods** (boxes of containers), on the right **nodes** (computers), reachable by a **Service** (a name that always works), through a front door (**Ingress**), with **ConfigMaps** and **Secrets** handed in, **disks** that remember, guards for doors (**NetworkPolicies**) and key cards (**RBAC**). You even built your own robot.

An interview asks you to explain that city: first simply, then deeper. And very often: "something is broken; how would you find it?" That's the map in the diagram.

## The question bank
| Topic | What interviewers ask | Lesson |
|---|---|---|
| Why Kubernetes | What problem it solves, desired state, when not to use it | Why Kubernetes exists |
| Architecture | Control plane components, what happens on kubectl apply, etcd | How a cluster works |
| Pods | Pod vs container, labels and selectors, multi-container pods | Your first Pod, YAML and labels |
| Workloads | Deployment vs ReplicaSet, rolling updates, rollbacks | Deployments, ReplicaSets and rollouts |
| Networking | Service types, kube-proxy, DNS, headless Services | Services and DNS |
| Config | ConfigMaps vs Secrets, how Secrets are (not) protected, reloads | ConfigMaps and Secrets |
| Probes | Liveness vs readiness vs startup, graceful shutdown, exit codes | Pod lifecycle, probes and graceful shutdown |
| Batch | Jobs, CronJobs, DaemonSets | Jobs, CronJobs and DaemonSets |
| Resources | Requests vs limits, QoS, OOMKilled, throttling, quotas | Requests, limits and QoS |
| Scheduling | Affinity, taints and tolerations, spread, drain | Where pods land: the scheduler |
| Scaling | HPA, VPA, cluster autoscaler, KEDA | Autoscaling |
| Traffic | Ingress vs Gateway API vs LoadBalancer, TLS | Ingress and the Gateway API |
| Isolation | NetworkPolicies, default deny | NetworkPolicies |
| State | PV, PVC, StorageClass, StatefulSet | Volumes, PersistentVolumes and StatefulSets |
| Delivery | Helm vs Kustomize, GitOps, Argo CD | Kustomize, Helm and GitOps |
| Security | RBAC, ServiceAccounts, Pod Security, supply chain | RBAC, ServiceAccounts and Pod Security |
| Extending | Controllers, CRDs, operators, finalizers | Controllers, CRDs and operators |
| Troubleshooting | CrashLoopBackOff, Pending, no endpoints, stuck namespaces | Debugging Kubernetes |

## Commands to know cold
| Task | Command |
|---|---|
| What's running, and where | \`kubectl get pods -o wide\`, \`kubectl get all -n shop\`, \`-w\` to watch, \`-A\` for all namespaces |
| Why is it like that | \`kubectl describe pod web-7d4\` (Events at the bottom), \`kubectl get events --sort-by=.lastTimestamp\` |
| Logs | \`kubectl logs deploy/web -f\`, \`--previous\`, \`-c sidecar\`, \`-l app=web --prefix\` |
| Get inside | \`kubectl exec -it web-7d4 -- sh\`, \`kubectl debug -it web-7d4 --image=busybox --target=web\`, \`kubectl port-forward svc/web 8080:80\` |
| Deploy and roll back | \`kubectl apply -f\` / \`-k\`, \`kubectl diff\`, \`kubectl rollout status\` / \`history\` / \`undo deploy/web\`, \`kubectl rollout restart\` |
| Scale | \`kubectl scale deploy/web --replicas=5\`, \`kubectl autoscale\`, \`kubectl get hpa\` |
| Exact fields | \`-o yaml\`, \`-o jsonpath='{.status.podIP}'\`, \`-o custom-columns=...\`, \`kubectl explain pod.spec.containers.resources\` |
| Write YAML fast | \`kubectl create deploy web --image=nginx --dry-run=client -o yaml > web.yaml\` |
| Resources | \`kubectl top pods\`, \`kubectl top nodes\`, \`kubectl describe node\` (Allocated resources) |
| Permissions | \`kubectl auth can-i create pods --as=jane -n shop\`, \`kubectl auth can-i --list\` |
| Nodes | \`kubectl cordon\`, \`kubectl drain --ignore-daemonsets --delete-emptydir-data\`, \`kubectl uncordon\` |
| Contexts | \`kubectl config get-contexts\`, \`kubectl config use-context prod\`, \`kubectl config set-context --current --namespace=shop\` |

## The classic exercise: review this manifest
Many interviews hand you a Deployment and ask "what would you change before this goes to production?". The first sample below is a typical one. Try to find **ten** problems before reading the list; the second sample is the reviewed version, running on a cluster.

## Design questions
- **"Design a zero-downtime deployment."** Readiness probes, maxUnavailable 0, preStop + SIGTERM handling, PDBs, enough replicas spread across zones, backward-compatible database migrations (expand, then contract), and a canary or blue-green step (Argo Rollouts, Flagger, or Gateway API weights) for risky changes.
- **"How would you run many teams on one cluster?"** A namespace per team, RBAC through groups, ResourceQuotas and LimitRanges, default-deny NetworkPolicies, Pod Security \`restricted\`, admission policies (Kyverno, Gatekeeper or ValidatingAdmissionPolicy) for registries and labels, cost allocation by labels. Separate clusters for hard isolation.
- **"How do you upgrade a cluster?"** Read the deprecation notes and fix removed APIs first (\`kubectl convert\`, pluto), upgrade the control plane one minor version at a time, then node pools by surge or blue-green (cordon, drain respecting PDBs), with add-ons (CNI, CSI, ingress) checked for compatibility. Practise on staging.
- **"How do you handle secrets?"** A secret manager (Vault, AWS Secrets Manager) synced by External Secrets or the CSI driver, encryption at rest for etcd, RBAC that limits who reads Secrets, files rather than env vars, rotation without restarts where possible.
- **"Plan for disaster."** etcd snapshots (or a managed control plane), everything in Git (GitOps) so a cluster can be rebuilt, Velero for cluster objects and volumes, tested restores, multi-zone node pools and PDBs.

## Answering well
- **Simple first, then deeper.** "A Deployment keeps N copies of a pod running and replaces them gradually" first; ReplicaSets, the controller loop and the scheduler when they ask how.
- **Think in control loops.** Almost every "how does X work" answer is: something writes desired state to the API server, a controller notices and acts, status reports back.
- **Name the trade-off.** Limits protect neighbours but CPU limits throttle; StatefulSets give identity but you now own the database; a NetworkPolicy is useless if the CNI doesn't enforce it.
- **Debug out loud, in order.** STATUS, describe and its Events, logs and \`--previous\`, then the traffic path. Say what you'd check and why.
- **Bring a story.** A rollout that dropped requests until you added preStop, an OOMKilled pod that needed a bigger limit, a namespace stuck Terminating because of a finalizer.

## Where to go next
- **Certifications**: CKAD (developers: workloads, config, probes, Services) and CKA (administrators: clusters, networking, storage, troubleshooting) are hands-on exams that match this world closely; CKS adds security.
- **Go deeper**: the Kubernetes docs' concepts section; *Kubernetes in Action* and *Programming Kubernetes*; the Kubebuilder book for operators.
- **Practice**: put one of your own projects on a local cluster with probes, a PDB, an HPA and NetworkPolicies, then deploy it with Argo CD. Break things on purpose and fix them.
- **Around Kubernetes**: Prometheus and Grafana (metrics), OpenTelemetry (traces), a service mesh (Istio, Linkerd), Terraform for the cluster itself. The **Infrastructure** and **Distributed systems** worlds cover the ideas underneath.`,
    keyPoints: [
      "Explain simply first (desired state + controllers that converge), then go deeper on request (API server, etcd, scheduler, kubelet).",
      "Troubleshoot in order: STATUS → describe/Events → logs --previous → the traffic path (Ingress → Service → EndpointSlices → readiness → NetworkPolicy).",
      "A production Deployment: several replicas spread across nodes, a PDB, pinned images, requests and limits, three kinds of probes, graceful shutdown, a hardened securityContext, secrets as files.",
      "Never: :latest, plain-text secrets in manifests, privileged pods for apps, liveness probes that check dependencies, one replica for something that matters.",
      "Design answers combine the pieces: zero-downtime deploys, multi-tenancy, upgrades, secrets and disaster recovery.",
    ],
    code: [
      {
        title: "Review this Deployment",
        noCheck: "a deliberately bad manifest: finding its problems is the exercise",
        variants: [
          {
            lang: "yaml",
            code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:latest
          env:
            - name: DB_PASSWORD
              value: hunter2
          ports: [{ containerPort: 3000 }]
          livenessProbe:
            httpGet: { path: /health, port: 3000 }   # /health queries the database
          securityContext:
            privileged: true`,
          },
        ],
        explain: `Ten problems:
1. **\`replicas: 1\`**: every deploy, crash or node drain is an outage. Run at least 2 (3 is common).
2. **No spread and no PodDisruptionBudget**: even with more replicas, they can all land on one node, and a drain can evict them all at once. Add \`topologySpreadConstraints\` and a PDB.
3. **\`:latest\`**: you can't tell what's running, rollbacks don't roll anything back, and two nodes can run different code. Pin a version (or a digest).
4. **A password in plain text**: it's in Git, and in the Deployment for anyone who can read it. Use a Secret from a secret store, mounted as a file.
5. **No requests or limits**: the pod is \`BestEffort\`, so the scheduler places it blind, it's evicted first under pressure, and it can starve its neighbours. Set requests, and a memory limit.
6. **No readiness probe**: new pods get traffic before they can serve, and a rollout counts them as available too soon.
7. **The liveness probe checks the database**: a database blip restarts every pod at once. Liveness should check the process only; dependencies belong in readiness.
8. **No startup probe**: a slow start is killed by liveness before it's up, and the pod loops forever.
9. **\`privileged: true\`**: full access to the host's devices and kernel, so one bug becomes a node takeover. And it runs as **root** with a writable filesystem and every default capability. Set \`runAsNonRoot\`, \`readOnlyRootFilesystem\`, \`allowPrivilegeEscalation: false\` and drop \`ALL\`.
10. **No graceful shutdown**: no \`preStop\` pause and (probably) no SIGTERM handling, so in-flight requests fail on every deploy.

Bonus points: it uses the \`default\` ServiceAccount with its API token mounted (set \`automountServiceAccountToken: false\`), it has no namespace, and there's no Service, NetworkPolicy or HPA alongside it.`,
      },
      {
        title: "The reviewed version",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "deployment.yaml", lang: "yaml", code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata:
      labels: { app: api }
    spec:
      automountServiceAccountToken: false          # it never calls the Kubernetes API
      terminationGracePeriodSeconds: 30
      topologySpreadConstraints:                   # one copy per node, so losing a node loses one copy
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector: { matchLabels: { app: api } }
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: node:20-slim                      # your own image, pinned by version (or digest)
          command: ["node", "-e"]
          args:
            - |
              const fs = require("fs");
              const password = fs.readFileSync("/run/secrets/db/password", "utf8");
              require("http").createServer((req, res) => res.end(req.url + " ok\\n")).listen(3000);
              process.on("SIGTERM", () => process.exit(0));
          ports: [{ name: http, containerPort: 3000 }]
          startupProbe:                            # slow starts get up to 60 s
            httpGet: { path: /livez, port: http }
            periodSeconds: 2
            failureThreshold: 30
          livenessProbe:                           # the process only, never the database
            httpGet: { path: /livez, port: http }
          readinessProbe:                          # no traffic until it can serve
            httpGet: { path: /readyz, port: http }
            periodSeconds: 2
          lifecycle:
            preStop: { sleep: { seconds: 5 } }     # let endpoint removal spread before SIGTERM
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 128Mi }
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities: { drop: [ALL] }
          volumeMounts:
            - { name: db, mountPath: /run/secrets/db, readOnly: true }
      volumes:
        - name: db
          secret: { secretName: api-db }           # created from your secret store, never from git
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api
spec:
  maxUnavailable: 1
  selector: { matchLabels: { app: api } }` }],
        variants: [{ lang: "bash", code: `NS=quest-review
k() { kubectl -n "$NS" "$@"; }
kubectl create namespace "$NS" > /dev/null
k create secret generic api-db --from-literal=password=s3cret > /dev/null   # in real life: from your secret store
k apply -f deployment.yaml > /dev/null
k rollout status deployment/api --timeout=180s > /dev/null
pod=$(k get pods -l app=api -o name | head -n 1)

echo "ready:            $(k get deployment api -o jsonpath='{.status.readyReplicas}/{.spec.replicas}')"
echo "spread over:      $(k get pods -l app=api -o jsonpath='{range .items[*]}{.spec.nodeName}{"\\n"}{end}' | sort -u | wc -l | tr -d ' ') nodes"
echo "QoS class:        $(k get "$pod" -o jsonpath='{.status.qosClass}')"
echo "runs as uid:      $(k exec "$pod" -- id -u)"
echo "root filesystem:  $(k exec "$pod" -- sh -c 'touch /x 2> /dev/null && echo writable || echo read-only')"
echo "password in env:  $(k exec "$pod" -- sh -c 'env | grep -ci password || true') variables"
echo "API token:        $(k exec "$pod" -- sh -c 'ls /var/run/secrets/kubernetes.io/serviceaccount 2> /dev/null || echo not mounted')"
echo "PDB:              $(k get pdb api -o jsonpath='{.status.disruptionsAllowed}') pod may be evicted at a time"` }],
        explain: `- 3 replicas, one per node (\`topologySpreadConstraints\` with \`DoNotSchedule\`), and a PDB that lets a drain take one at a time.
- \`Burstable\` QoS: it requests what it needs, so the scheduler places it properly, and the memory limit caps it. (Equal requests and limits for every resource would make it \`Guaranteed\`.)
- It runs as uid 1000 on a read-only root filesystem, and it would pass the \`restricted\` Pod Security level.
- The password arrives as a file from a Secret, not an environment variable, and no API token is mounted because it never calls the Kubernetes API.
- Startup, liveness and readiness are separate probes, and \`preStop\` plus a SIGTERM handler make shutdowns clean.`,
        output: `ready:            3/3
spread over:      3 nodes
QoS class:        Burstable
runs as uid:      1000
root filesystem:  read-only
password in env:  0 variables
API token:        not mounted
PDB:              1 pod may be evicted at a time`,
      },
    ],
    interview: [
      {
        q: "What happens, end to end, when you run kubectl apply -f deployment.yaml?",
        a: "kubectl reads your kubeconfig, sends the object to the **API server** over TLS. The API server **authenticates** you (certificate, token, OIDC), **authorizes** with RBAC, runs **mutating admission** (defaults, injected sidecars), validates against the schema, runs **validating admission** (Pod Security, policies), and stores the Deployment in **etcd**. The **Deployment controller** (in kube-controller-manager) sees it via its watch and creates a **ReplicaSet**; the ReplicaSet controller creates **Pods** (no node yet). The **scheduler** watches unscheduled pods, filters and scores nodes (resources, affinity, taints, spread) and writes `nodeName`. That node's **kubelet** sees the pod, asks the container runtime (containerd via CRI) to pull the image and start containers, the CNI plugin gives it an IP, volumes are mounted, and probes start. When readiness passes, the **EndpointSlice controller** adds the pod to matching Services, and kube-proxy (or eBPF) on every node routes traffic to it. Status flows back to the API server all along.",
        freq: "very-common",
      },
      {
        q: "Deployment vs StatefulSet vs DaemonSet vs Job: when do you use each?",
        a: "**Deployment**: stateless, interchangeable replicas (web apps, APIs, workers); rolling updates, any pod can be replaced by any other. **StatefulSet**: pods that need a **stable identity** (ordinal names, stable DNS through a headless Service) and **their own storage** (volumeClaimTemplates), created and updated in order: databases, Kafka, ZooKeeper, Elasticsearch. **DaemonSet**: exactly **one pod per node** (or per matching node): log shippers, node exporters, CNI and CSI agents. **Job**: run to **completion** with retries and parallelism (migrations, batch work); **CronJob** runs Jobs on a schedule. A bare Pod is almost never right: nothing recreates it.",
        freq: "very-common",
      },
      {
        q: "A user says the app is slow since this morning. How do you investigate on Kubernetes?",
        a: "Scope first: which endpoints, all users or some, since when, and what changed (deploys: `kubectl rollout history`, config changes, node events, traffic). Then look at signals: latency and error dashboards per service; `kubectl top pods/nodes`; **CPU throttling** (`container_cpu_cfs_throttled_periods_total` - a tight CPU limit is a classic cause); restarts and **OOMKilled**; HPA at max replicas; pods Pending because the cluster is full; noisy neighbours on a node; dependencies (database, external APIs) and DNS latency (ndots, CoreDNS load). Compare healthy vs slow pods (one bad node?). Mitigate first (roll back, scale out, cordon a bad node), then find the root cause and write it up.",
        freq: "common",
      },
      {
        q: "How do you make an application highly available on Kubernetes?",
        a: "Several **replicas** (at least 2-3) spread across **nodes and zones** (topologySpreadConstraints or anti-affinity), a **PodDisruptionBudget** so drains and upgrades keep enough running, **readiness probes** and graceful shutdown so rollouts and failures don't drop requests, **requests** sized so pods are scheduled reliably (and a priority class for critical services), an **HPA** for load, a multi-zone cluster with a cluster autoscaler, and no single points of failure in dependencies (replicated or managed databases, multiple ingress controller replicas). Test it: kill pods, drain nodes, and watch error rates.",
        freq: "common",
      },
      {
        q: "What are the limitations of Kubernetes, or when would you not use it?",
        a: "It's a **complex platform**: networking, storage, security, upgrades and add-ons need real expertise, and managed services only remove part of that. For a small team with a few services, a PaaS (Cloud Run, App Runner, Fly.io, Heroku-style) or plain VMs with Docker Compose may be cheaper and faster. Stateful workloads are possible but you own their operations. Multi-cluster and multi-region need extra tooling. It also brings resource overhead (control plane, DaemonSets) and a large YAML and tooling surface. Kubernetes shines when you have many services, teams and environments, need portability, self-healing, autoscaling and a common deploy model.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which component decides which node a new pod runs on?",
        options: ["kubelet", "kube-scheduler", "kube-proxy", "etcd"],
        answer: 1,
        explain: "The scheduler filters and scores nodes and writes nodeName; the kubelet on that node then runs it.",
      },
      {
        q: "A pod is Running but the Service has no endpoints. What do you check first?",
        options: ["The node's disk", "The Service's selector against the pod's labels, and whether the pod is Ready", "The image tag", "etcd health"],
        answer: 1,
        explain: "Only Ready pods whose labels match the selector become endpoints.",
      },
      {
        q: "Which is the best liveness probe for a web app with a database?",
        options: ["A query against the database", "A cheap endpoint that only checks the process itself", "The same check as readiness", "No probe, ever"],
        answer: 1,
        explain: "Liveness restarts containers; checking dependencies there turns a database blip into restarts everywhere.",
      },
      {
        q: "In the reviewed Deployment, why does the pod have Burstable QoS rather than Guaranteed?",
        options: ["It runs as non-root", "Its requests and limits aren't equal for every resource (no CPU limit, memory request < limit)", "It has three replicas", "It mounts a Secret"],
        answer: 1,
        explain: "Guaranteed requires requests = limits for both CPU and memory in every container.",
      },
    ],
  },
];
