import type { World } from "../types";
import { kubernetesPart2 } from "./kubernetes-2";

export const kubernetes: World = {
  id: "kubernetes",
  order: 10,
  title: "The Orchestration Citadel",
  subtitle: "Docker internals, container networking, Compose, then Kubernetes in depth: pods, scheduling, networking, state, GitOps, operators & debugging",
  description:
    "The deep dive after Container Harbor. Take docker run apart down to runc and the kernel, wire up container networks by hand, then go through Kubernetes the way platform, DevOps and SRE interviews do: probes and shutdown, requests and scheduling, Services and Ingress, StatefulSets and storage, Helm and Argo CD, operators and RBAC, and a broken-pod triage drill.",
  emoji: "☸️",
  color: "#2563eb",
  boss: {
    name: "The OOMKilled Hydra",
    title: "Warden of the Pending Queue",
    emoji: "🐉",
    taunt: "Cut off one pod and two more crash in its place! Your limits are too low, your probes too eager, and your Service selects nothing at all!",
    defeat: "Requests sized… probes tuned… endpoints ready… 0/0 pods pending. The citadel is yours, operator.",
  },
  lessons: [
    // ------------------------------------------------------------------ DOCKER ENGINE
    {
      id: "docker-internals",
      title: "Docker Engine Internals",
      tagline: "What docker run really does: dockerd, containerd, runc, images, layers and PID 1.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["dockerrun", "layers"],
      concept: `
## A container is a process
There is no "container" object in the Linux kernel. A container is an ordinary process started with:
- **namespaces**, which limit what it can see: its own PIDs, network stack, mounts, hostname, IPC and optionally users;
- **cgroups**, which limit what it can use: memory, CPU, PIDs and I/O;
- a **root filesystem** from an image, plus dropped **capabilities**, a **seccomp** profile and an AppArmor/SELinux profile.

Step through the visualizer to watch each piece get set up.

## The stack under docker run
| Component | Job |
|---|---|
| **docker CLI** | Turns commands into REST calls on \`/var/run/docker.sock\` |
| **dockerd** | The Docker API: images, builds, networks, volumes |
| **containerd** | Container lifecycle and image store (also used directly by Kubernetes) |
| **containerd-shim** | One per container. It is the container's parent, so daemons can restart without killing containers |
| **runc** | The OCI runtime. It creates namespaces and cgroups, then \`exec\`s your process and exits |

These pieces are standardised by the **OCI** (Open Container Initiative): the *image spec* defines what an image is, and the *runtime spec* defines how a bundle is run. That's why an image built by Docker runs on containerd, CRI-O or Podman, and why Kubernetes could remove **dockershim** (in 1.24) without breaking anyone's images.

## Images: manifests, layers and digests
An image is a **manifest** that lists a **config** blob (env, entrypoint, user) and an ordered list of **layer** tarballs. Everything is **content-addressed**: a layer's name is the SHA-256 of its content.
- Layers are shared: ten images built on the same base store that base once.
- A **tag** (\`nginx:1.27\`) is a movable pointer. A **digest** (\`nginx@sha256:…\`) is immutable. Deploy by digest when you need reproducibility.
- A **manifest list** (image index) maps one tag to per-architecture images, so \`amd64\` and \`arm64\` nodes each pull the right one.

At runtime, **overlayfs** stacks the read-only layers (lowerdir) under a fresh writable layer (upperdir). Writes use **copy-on-write** and vanish with the container, so persistent data belongs in volumes.

## Building good images
- **Order instructions from least to most frequently changing.** Copy the dependency manifest and install dependencies before copying source code, so code edits don't bust the dependency cache. The Docker build cache visualizer shows this.
- **Multi-stage builds**: compile in a fat builder image, copy only the artifact into a slim runtime (distroless, alpine, or \`scratch\` for static Go binaries). Images shrink from ~1 GB to ~20 MB, and so does the attack surface.
- **Run as non-root** (\`USER 10001\`), add a \`.dockerignore\` (keep \`.git\`, \`node_modules\` and secrets out of the build context), and never bake secrets into layers: deleting a file in a later layer doesn't remove it from the earlier one. Use BuildKit secret mounts.
- **Scan and sign**: scan for CVEs (Trivy, Grype), generate an SBOM, and sign images (cosign) so the cluster can verify what it runs.

## The PID 1 problem
The first process in a PID namespace is PID 1, and the kernel treats it specially: **signals with no handler are ignored**, and it must **reap zombie** children.
- Use the **exec form**: \`CMD ["node", "server.js"]\`. The shell form (\`CMD node server.js\`) runs \`/bin/sh -c\`, which becomes PID 1 and doesn't forward SIGTERM. \`docker stop\` then waits 10 seconds and SIGKILLs your app mid-request.
- If your app spawns children or doesn't handle SIGTERM, add a tiny init: \`docker run --init\` or \`tini\` as the entrypoint.

## Containers vs virtual machines
A VM virtualises **hardware** and runs its own kernel. Containers share the **host kernel**, so they start in milliseconds and pack densely, but isolation is weaker: a kernel exploit escapes every container on the host. For untrusted multi-tenant code, platforms use sandboxed runtimes: **gVisor** (a user-space kernel) or **Kata Containers / Firecracker** (lightweight micro-VMs per pod).
`,
      keyPoints: [
        "A container is a normal process with namespaces (what it sees) and cgroups (what it uses), plus a root filesystem.",
        "docker CLI → dockerd → containerd → shim → runc. runc sets up isolation, execs the app, then exits.",
        "Images are content-addressed layers. Tags move; digests don't. overlayfs adds a writable copy-on-write layer.",
        "Multi-stage builds, non-root users, .dockerignore and cache-friendly ordering make images small, safe and fast to build.",
        "Use the exec form for CMD/ENTRYPOINT so your app is PID 1 and receives SIGTERM; add --init/tini when needed.",
      ],
      code: [
        {
          title: "A production-grade multi-stage Dockerfile",
          note: "Dependencies are cached separately from source, the runtime image has no compiler or shell, and the app runs as non-root.",
          variants: [
            {
              lang: "dockerfile",
              code: `
# syntax=docker/dockerfile:1.7
FROM golang:1.23 AS build
WORKDIR /src
# 1. dependencies first: this layer is reused until go.mod/go.sum change
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
# 2. then the source
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \\
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# Runtime: ~2 MB base, no shell, no package manager
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
USER nonroot:nonroot
EXPOSE 8080
# exec form: /api is PID 1 and receives SIGTERM directly
ENTRYPOINT ["/api"]
`,
            },
          ],
        },
        {
          title: "Look under the hood",
          variants: [
            {
              lang: "bash",
              code: `
# Layers, sizes and the instruction that created each one
docker history --no-trunc myapp:1.4.0
docker image inspect myapp:1.4.0 --format '{{json .RootFS.Layers}}'

# The container is just a process on the host
docker run -d --name web --memory 256m --cpus 0.5 nginx:1.27
pid=$(docker inspect -f '{{.State.Pid}}' web)
ls -l /proc/$pid/ns                          # its namespaces
cat /sys/fs/cgroup/system.slice/docker-*.scope/memory.max   # its memory limit (cgroup v2)
nsenter -t $pid -n ip addr                   # enter only its network namespace

# Who is the parent? containerd-shim, not dockerd
ps -o pid,ppid,cmd -p $pid
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What is the difference between a container and a virtual machine?",
          a: "A **VM** emulates hardware; a hypervisor runs a full guest OS with its own kernel, so isolation is strong but each VM costs GBs of memory and boots in seconds to minutes. A **container** is a host process isolated with **namespaces** and limited with **cgroups**; all containers share the host kernel. They start in milliseconds and pack densely, but a kernel vulnerability can break isolation. In practice: containers for packaging and density, VMs (or micro-VMs like Firecracker, or gVisor) where you need a hard security boundary such as multi-tenant untrusted code. Kubernetes nodes are usually VMs running many containers.",
          freq: "very-common",
        },
        {
          q: "Explain what happens when you run docker run nginx.",
          a: "The CLI sends REST calls to **dockerd**. dockerd resolves the tag to a manifest digest and pulls any missing **layers** from the registry (content-addressed, verified by SHA-256). It hands the container spec to **containerd**, which unpacks layers into an **overlayfs** snapshot and writes an OCI bundle. containerd starts a **shim**, which calls **runc**. runc creates **namespaces** (pid, net, mnt, uts, ipc), a **cgroup** with the limits, drops capabilities, applies seccomp, sets up the root filesystem, and `exec`s the entrypoint as PID 1. Docker's networking creates a veth pair onto the docker0 bridge and iptables NAT rules for published ports. runc exits; the shim stays as the parent to collect logs and the exit code.",
          freq: "common",
        },
        {
          q: "How would you make a 1.2 GB Docker image small and secure?",
          a: "Use a **multi-stage build**: compile in a builder image and copy only the artifact into a minimal runtime (distroless or alpine; scratch for static binaries). Order instructions so dependency installs are cached separately from source. Add a **.dockerignore**. Remove build tools and package caches from the final stage. Run as a **non-root user**, use a read-only root filesystem where possible, and pin the base image by digest. Scan with Trivy/Grype in CI, produce an SBOM and sign the image. Never put secrets in layers (use BuildKit secret mounts), because deleting them in a later layer leaves them in the earlier one.",
          freq: "common",
        },
        {
          q: "Why doesn't my container stop gracefully on docker stop?",
          a: "`docker stop` sends **SIGTERM to PID 1** and SIGKILLs after 10 seconds. If the Dockerfile uses the **shell form** (`CMD npm start`), PID 1 is `/bin/sh`, which doesn't forward signals, so the app never sees SIGTERM. Even `npm start` itself may not forward it. Also, PID 1 ignores signals it has no handler for. Fixes: use the **exec form** (`CMD [\"node\", \"server.js\"]`), handle SIGTERM in the app (stop accepting, drain in-flight requests, close DB pools), and use `--init`/tini if the process spawns children, so zombies are reaped and signals are forwarded.",
          freq: "common",
        },
        {
          q: "Why did Kubernetes remove dockershim, and did Docker images stop working?",
          a: "Kubernetes talks to runtimes through the **CRI** (Container Runtime Interface). Docker Engine never implemented CRI, so Kubernetes maintained an adapter, **dockershim**, which was removed in 1.24. Clusters now use **containerd** or **CRI-O** directly, which is one less daemon (Docker itself uses containerd underneath). Images didn't break, because Docker builds standard **OCI images** that any OCI runtime can run. What broke were things that relied on the Docker socket on nodes, such as Docker-in-Docker builds in CI pods.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Which Linux feature limits how much memory a container can use?",
          options: ["Namespaces", "cgroups", "overlayfs", "seccomp"],
          answer: 1,
          explain: "cgroups limit resource usage (memory.max, cpu.max). Namespaces limit visibility, overlayfs provides the filesystem, and seccomp filters syscalls.",
        },
        {
          q: "Which component actually creates the namespaces and execs the container process?",
          options: ["The docker CLI", "dockerd", "runc", "The registry"],
          answer: 2,
          explain: "runc is the low-level OCI runtime. It sets up namespaces and cgroups, execs the entrypoint, then exits, leaving containerd-shim as the parent.",
        },
        {
          q: "You put `RUN rm /app/secret.pem` in a later layer. Is the secret gone from the image?",
          options: ["Yes, the file is deleted", "No, it's still in the earlier layer and anyone with the image can extract it", "Only if you use alpine", "Only with BuildKit"],
          answer: 1,
          explain: "Layers are immutable. A later layer only hides the file (a whiteout). Use BuildKit secret mounts so secrets never enter a layer.",
        },
        {
          q: "Your Dockerfile ends with `CMD node server.js`. What happens on docker stop?",
          options: [
            "Node receives SIGTERM and shuts down cleanly",
            "/bin/sh is PID 1, the app doesn't get SIGTERM, and it's SIGKILLed after the timeout",
            "The container restarts",
            "Docker sends SIGINT instead",
          ],
          answer: 1,
          explain: "The shell form wraps the command in /bin/sh -c, which becomes PID 1 and doesn't forward signals. Use the exec form: CMD [\"node\", \"server.js\"].",
        },
      ],
    },

    // ------------------------------------------------------------------ DOCKER NETWORKING
    {
      id: "docker-networking",
      title: "Container Networking, Volumes & Storage",
      tagline: "Bridges, veth pairs, NAT, embedded DNS, and where your data actually lives.",
      difficulty: "intermediate",
      minutes: 14,
      visualizers: ["dockernet"],
      concept: `
## Network drivers
| Driver | What you get | Use it for |
|---|---|---|
| **bridge** (default) | Private subnet on a Linux bridge; NAT to the outside | Most single-host workloads |
| **user-defined bridge** | Same, plus **DNS by container name** and isolation per network | Anything with more than one container (Compose uses this) |
| **host** | Shares the host's network namespace: no isolation, no NAT | High-throughput proxies, monitoring agents |
| **none** | Loopback only | Batch jobs that must not touch the network |
| **overlay** | VXLAN network spanning hosts | Swarm; in Kubernetes, CNI plugins play this role |
| **macvlan / ipvlan** | Container gets its own address on the physical LAN | Legacy apps that expect to be on the LAN |

## How the default bridge works
1. Docker creates a Linux bridge (\`docker0\`, or \`br-xxxx\` per user-defined network), which acts as a virtual switch.
2. Each container gets a **veth pair**, a virtual cable: one end is \`eth0\` inside the container's network namespace, and the other is attached to the bridge.
3. Outbound traffic is **masqueraded** (source NAT) to the host IP by an iptables rule.
4. \`-p 8080:80\` adds a **DNAT** rule: traffic to host:8080 is rewritten to container-ip:80. \`EXPOSE\` in a Dockerfile publishes nothing; it's documentation.

Step through each path in the visualizer.

## Service discovery
On user-defined networks, Docker runs an **embedded DNS server at 127.0.0.11**. Containers resolve each other by name (or by Compose service name and network alias). The legacy default bridge has no DNS, which is why \`--link\` existed. Containers on the same network talk to each other on **container ports directly**; publishing ports is only for traffic from outside the host.

## The two classic bugs
- **App binds to 127.0.0.1.** Inside a container, localhost is the container's own loopback. Requests arriving on eth0 get "connection refused". Bind to \`0.0.0.0\`.
- **"localhost" in a connection string.** \`DATABASE_URL=postgres://localhost:5432\` points at the app's own container. Use the service name (\`db\`), or \`host.docker.internal\` to reach the host from Docker Desktop.

## Storage
| Type | Lives in | Survives \`docker rm\`? | Use for |
|---|---|---|---|
| Writable layer | overlayfs upperdir | No | Scratch only |
| **Named volume** | \`/var/lib/docker/volumes\`, managed by Docker | Yes | Databases, anything persistent |
| **Bind mount** | Any host path | Yes (it's the host's file) | Source code in development, config files |
| **tmpfs** | Memory | No | Secrets, fast scratch space |

Volumes bypass the copy-on-write filesystem, so they're also much faster for write-heavy workloads. Watch out for **UID/GID ownership** with bind mounts: a container running as UID 10001 can't write a host directory owned by root.

## Logs and disk
Container stdout/stderr goes to the logging driver (\`json-file\` by default). Without \`max-size\`/\`max-file\` options, a chatty container can fill the host disk. \`docker system df\` shows where space goes, and \`docker system prune\` reclaims unused images, containers and build cache.
`,
      keyPoints: [
        "Bridge networking = Linux bridge + a veth pair per container + iptables NAT. -p creates a DNAT rule.",
        "User-defined networks give DNS by container name via 127.0.0.11. The default bridge doesn't.",
        "Containers on the same network reach each other on container ports; publishing is only for outside traffic.",
        "Bind to 0.0.0.0 inside containers, and never use localhost to reach another container.",
        "Named volumes persist and bypass overlayfs; bind mounts are for development; the writable layer is disposable.",
      ],
      code: [
        {
          title: "Networks and volumes by hand",
          variants: [
            {
              lang: "bash",
              code: `
# A user-defined network gives DNS by name and isolation
docker network create backend
docker volume create pgdata

docker run -d --name db --network backend \\
  -e POSTGRES_PASSWORD_FILE=/run/secrets/pg -v pgdata:/var/lib/postgresql/data postgres:17
docker run -d --name api --network backend -p 8080:3000 \\
  -e DATABASE_URL=postgres://app@db:5432/app myorg/api:1.4.0   # "db" resolves via 127.0.0.11

# Inspect the plumbing
docker network inspect backend --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\\n"}}{{end}}'
sudo iptables -t nat -L DOCKER -n          # the DNAT rule for -p 8080:3000
docker exec api cat /etc/resolv.conf       # nameserver 127.0.0.11

# Cap log growth for every container on this host
cat /etc/docker/daemon.json
# { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Two containers can't talk to each other by name. Why, and how do you fix it?",
          a: "Most likely they're on the **default bridge network**, which has no embedded DNS; name resolution only works on **user-defined networks** (Compose creates one per project). Fix: create a network and attach both containers (`docker network create app`, `--network app`), then use the container or service name. Other causes: they're on **different** user-defined networks (isolated by design), the target listens on 127.0.0.1 instead of 0.0.0.0, or the client is using the published host port instead of the container port.",
          freq: "common",
        },
        {
          q: "What does -p 8080:80 actually do at the kernel level?",
          a: "Docker adds an iptables **DNAT** rule in the nat table (PREROUTING/OUTPUT → DOCKER chain): packets to the host on port 8080 have their destination rewritten to the container's IP on port 80. The kernel then routes them over the bridge and the container's veth pair. **conntrack** records the translation so replies are rewritten back. Docker may also run `docker-proxy` for loopback traffic. Note `EXPOSE` does none of this; it's metadata.",
          freq: "common",
        },
        {
          q: "Volume vs bind mount: when do you use each?",
          a: "**Named volumes** are managed by Docker, portable across hosts' layouts, survive container removal, bypass the copy-on-write filesystem (fast), and are the right home for database files. **Bind mounts** map a specific host path into the container: perfect for live-reloading source code in development or injecting a config file, but they couple the container to the host's directory structure and file ownership. **tmpfs** is in memory, for secrets or scratch. In Kubernetes the equivalents are PVCs, hostPath (avoid) and emptyDir with medium: Memory.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Your API container's DATABASE_URL uses localhost:5432, and Postgres runs in another container. What happens?",
          options: ["It works through Docker's DNS", "It connects to port 5432 inside the API container itself, and fails", "It connects to the host's Postgres", "Docker rewrites localhost automatically"],
          answer: 1,
          explain: "Each container has its own network namespace and loopback. Use the database container's name on a shared network.",
        },
        {
          q: "What is 127.0.0.11 inside a container on a user-defined network?",
          options: ["The host", "The bridge gateway", "Docker's embedded DNS server", "The registry"],
          answer: 2,
          explain: "Docker's embedded DNS resolves container and service names on that network and forwards other queries upstream.",
        },
        {
          q: "Which statement about EXPOSE 8080 in a Dockerfile is true?",
          options: ["It publishes port 8080 on the host", "It opens the firewall", "It's documentation and metadata; it doesn't publish anything", "It's required for containers to talk to each other"],
          answer: 2,
          explain: "Only -p (or ports: in Compose) creates host port mappings. Containers on the same network can reach any listening port without EXPOSE.",
        },
        {
          q: "Which networking mode makes two containers unable to both listen on port 80?",
          options: ["bridge", "user-defined bridge", "host", "none"],
          answer: 2,
          explain: "With --network host, containers share the host's port space, so port conflicts are possible and -p is ignored.",
        },
      ],
    },

    // ------------------------------------------------------------------ COMPOSE
    {
      id: "docker-compose",
      title: "Docker Compose & Local Environments",
      tagline: "One file for the whole stack: services, networks, volumes, healthchecks and profiles.",
      difficulty: "beginner",
      minutes: 12,
      diagram: {
        title: "A Compose project",
        nodes: [
          { id: "dev", label: "Developer", sub: "localhost:8080", kind: "client", x: 90, y: 280 },
          { id: "web", label: "web", sub: "frontend · ports 8080:80", kind: "service", x: 320, y: 280 },
          { id: "api", label: "api", sub: "build: ./api · scale 2", kind: "service", x: 560, y: 180 },
          { id: "worker", label: "worker", sub: "same image, other command", kind: "worker", x: 560, y: 420 },
          { id: "db", label: "db", sub: "postgres:17 · volume pgdata", kind: "db", x: 840, y: 180 },
          { id: "redis", label: "redis", sub: "queue + cache", kind: "cache", x: 840, y: 420 },
        ],
        edges: [
          { from: "dev", to: "web", label: "published port" },
          { from: "web", to: "api", label: "http://api:3000" },
          { from: "api", to: "db", label: "db:5432" },
          { from: "api", to: "redis", label: "enqueue" },
          { from: "worker", to: "redis", label: "consume" },
          { from: "worker", to: "db" },
        ],
        flows: [
          {
            name: "docker compose up",
            path: ["db", "api", "web", "dev"],
            steps: [
              "Compose creates the project network and the pgdata volume, then starts db first. api has depends_on: db with condition: service_healthy, so it waits until pg_isready passes.",
              "api starts once db is healthy. It reaches the database as db:5432 through the embedded DNS. Nothing about the database is published to the host.",
              "web starts after api, and is the only service with a published port, so it's the only entry point from the laptop.",
            ],
          },
          {
            name: "A request through the stack",
            path: ["dev", "web", "api", "redis", "worker", "db"],
            steps: [
              "The browser hits localhost:8080, which Docker forwards to web:80.",
              "web proxies /api calls to http://api:3000. With two api replicas, DNS returns both IPs.",
              "api enqueues a slow job in Redis and returns 202 Accepted immediately.",
              "The worker (same image, different command) pops the job.",
              "It writes the result to Postgres. Data survives docker compose down because it lives in a named volume (down -v would delete it).",
            ],
          },
        ],
      },
      concept: `
## What Compose is for
Compose describes a **multi-container application** in one YAML file (\`compose.yaml\`) and runs it with \`docker compose up\`. It creates a **project network** (so services find each other by name), named **volumes**, and the containers, in dependency order. It's the standard way to run a full stack on a laptop or in CI integration tests.

## The building blocks
- **services**: each one is an image (or a \`build:\` context), plus command, env, ports, volumes, healthcheck and resource limits.
- **networks**: one default network per project. Add more to isolate tiers, for example a backend network that web can't join.
- **volumes**: named volumes for state. \`docker compose down\` keeps them; \`down -v\` deletes them.
- **depends_on** only orders **startup**, and by default doesn't wait for readiness. Use \`condition: service_healthy\` with a **healthcheck**, or your API will crash-loop while Postgres is still initialising.

## Configuration
- **Variables**: \`.env\` in the project directory is read for \`\${VAR}\` interpolation; \`env_file:\` injects variables into a container.
- **Override files**: \`compose.yaml\` + \`compose.override.yaml\` are merged automatically. Keep the base production-like and put dev conveniences (bind mounts, debug ports) in the override, or pick files with \`-f\`.
- **Profiles** turn optional services on: \`profiles: [debug]\` services start only with \`--profile debug\`.
- **Secrets**: \`secrets:\` mounts files at \`/run/secrets/<name>\`, which is better than environment variables (env leaks into \`docker inspect\`, crash dumps and child processes).
- **compose watch** syncs source into running containers or rebuilds when files change.

## Compose vs Kubernetes
Compose runs on **one host**, with no self-healing across machines, no rolling deploys and no autoscaling. That's fine for development, CI and small single-server apps. The concepts map directly to Kubernetes: service → Deployment + Service, volume → PVC, healthcheck → probes, env/secrets → ConfigMap/Secret. Keep Compose close to production (same images, same env var names) to avoid "works on my machine".
`,
      keyPoints: [
        "Compose = one YAML for a multi-container app on one host: services, networks, volumes.",
        "Services reach each other by service name on the project network; only publish what the host needs.",
        "depends_on orders startup only; add a healthcheck and condition: service_healthy to wait for readiness.",
        "Use override files and profiles for dev-only bits; secrets as files beat environment variables.",
        "Every Compose concept maps to a Kubernetes object, which makes it a good stepping stone.",
      ],
      code: [
        {
          title: "compose.yaml for a web + api + worker + Postgres + Redis stack",
          variants: [
            {
              lang: "yaml",
              code: `
services:
  web:
    image: myorg/web:1.4.0
    ports: ["8080:80"]            # the only published port
    depends_on: [api]

  api:
    build: ./api
    environment:
      DATABASE_URL: postgres://app@db:5432/app
      REDIS_URL: redis://redis:6379
    secrets: [db_password]
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }
    deploy:
      replicas: 2
      resources: { limits: { memory: 512m, cpus: "1.0" } }

  worker:
    build: ./api                   # same image, different command
    command: ["node", "worker.js"]
    depends_on: [redis, db]

  db:
    image: postgres:17
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes: [pgdata:/var/lib/postgresql/data]
    secrets: [db_password]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine

  adminer:                         # only with: docker compose --profile debug up
    image: adminer
    profiles: [debug]
    ports: ["8081:8080"]

volumes:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Your API container crashes on docker compose up because the database isn't ready, even though you set depends_on. Why?",
          a: "Plain `depends_on` only controls **start order**: it waits for the db container to be started, not for Postgres to accept connections. Add a **healthcheck** to db (`pg_isready`) and use `depends_on: { db: { condition: service_healthy } }`. Also make the app itself resilient: retry the DB connection with back-off on startup, because in production (Kubernetes) there's no start ordering at all.",
          freq: "common",
        },
        {
          q: "When is Docker Compose enough, and when do you need Kubernetes?",
          a: "Compose is enough for local development, CI integration tests, and small apps on a single server where some downtime on deploy or host failure is acceptable. You need an orchestrator like Kubernetes (or a managed alternative like ECS or Cloud Run) when you need **multiple hosts**, **self-healing** when a machine dies, **rolling or canary deploys** without downtime, **autoscaling**, service discovery and load balancing across nodes, or fine-grained multi-team access control. Kubernetes has a real operational cost, so a managed container platform is often the right middle ground.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "What does `docker compose down -v` do that `down` doesn't?",
          options: ["Stops containers verbosely", "Also deletes named volumes, so database data is lost", "Removes images", "Keeps the network"],
          answer: 1,
          explain: "down removes containers and networks; -v also removes the named volumes declared in the file.",
        },
        {
          q: "How does the api service reach Postgres in the example compose file?",
          options: ["localhost:5432", "The host's published port", "db:5432 via the project network's DNS", "An environment-injected IP address"],
          answer: 2,
          explain: "Compose puts all services on a project network where each service name resolves to its containers.",
        },
        {
          q: "Why are secrets mounted as files preferred over environment variables?",
          options: [
            "Files are encrypted at rest by Docker",
            "Environment variables leak through docker inspect, child processes, crash reports and logs",
            "Environment variables are limited to 64 bytes",
            "Compose doesn't support environment variables",
          ],
          answer: 1,
          explain: "Env vars are visible in many places. Files under /run/secrets are only readable inside the container.",
        },
      ],
    },

    // ------------------------------------------------------------------ POD LIFECYCLE
    {
      id: "pod-lifecycle",
      title: "Pod Lifecycle, Probes & Graceful Shutdown",
      tagline: "Startup, liveness and readiness probes, CrashLoopBackOff, init and sidecar containers, and zero-downtime termination.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["probes"],
      concept: `
## Phases and container states
A pod's **phase** is coarse: \`Pending\` (accepted, not yet running: scheduling or pulling images), \`Running\`, \`Succeeded\`, \`Failed\` or \`Unknown\` (node lost). The real detail is in each **container state**: \`Waiting\` (with a reason such as \`ContainerCreating\`, \`ImagePullBackOff\`, \`CrashLoopBackOff\`), \`Running\` or \`Terminated\` (with an exit code and reason such as \`OOMKilled\` or \`Error\`). The STATUS column in \`kubectl get pods\` shows the most interesting of these.

**restartPolicy** (\`Always\` for Deployments, \`OnFailure\`/\`Never\` for Jobs) decides what the kubelet does when a container exits. Restarts use an **exponential back-off**: 10 s, 20 s, 40 s… capped at 5 minutes, reset after 10 minutes of healthy running. That waiting state is **CrashLoopBackOff**. It's a symptom: the cause is in \`kubectl logs --previous\` and the exit code.

## Init and sidecar containers
- **Init containers** run to completion, in order, before app containers start: wait for a dependency, run migrations, fetch config.
- **Sidecars** (log shippers, proxies) run alongside the app. Native sidecars (an init container with \`restartPolicy: Always\`, stable since 1.33) start before the app and stop after it, which fixes old problems such as Jobs that never finished because the proxy kept running.

## The three probes
| Probe | Question | On failure |
|---|---|---|
| **startupProbe** | Has the app finished starting? | Keep waiting; restart only after the full budget |
| **livenessProbe** | Is the process stuck beyond repair? | **Restart** the container |
| **readinessProbe** | Can it serve traffic right now? | **Remove from Service endpoints**, no restart |

Probes can be \`httpGet\`, \`tcpSocket\`, \`exec\` or \`grpc\`, tuned by \`periodSeconds\`, \`timeoutSeconds\`, \`failureThreshold\` and \`initialDelaySeconds\`. Until the startup probe passes, the other two don't run.

## Probe anti-patterns
- **No startup probe on a slow starter.** Liveness kills the app before it ever finishes starting, forever. Use a startup probe with a generous budget (\`failureThreshold × periodSeconds\`) rather than a huge \`initialDelaySeconds\`, which also delays detection of real hangs.
- **Liveness that checks dependencies.** If liveness pings the database, a DB outage restarts every pod at once and turns a partial outage into a total one. Liveness checks only the process itself; dependency checks (if any) go in readiness.
- **Identical liveness and readiness.** A pod that is merely busy fails both, gets restarted, and the remaining pods take more load and fail too: a cascading restart storm.
- **Expensive probes.** A probe that runs a query every second on 300 pods is a load test you didn't plan.

## Graceful termination
When a pod is deleted (rolling update, scale-down, node drain), two things happen **in parallel**:
1. The endpoints controller removes the pod from Service endpoints, and every node's kube-proxy and every ingress controller must catch up.
2. The kubelet runs the **preStop** hook, then sends **SIGTERM** to PID 1 in each container, waits up to **terminationGracePeriodSeconds** (default 30 s), then SIGKILLs.

Because (1) takes time to propagate, a pod that exits immediately on SIGTERM still receives a few requests and they fail. That's the source of those mysterious 502s during deploys. The fix:
- a short \`preStop\` sleep (5–10 s) so traffic stops arriving before shutdown starts;
- the app handles SIGTERM: stop accepting connections, finish in-flight requests, close pools, exit;
- grace period longer than preStop + drain time.

**PodDisruptionBudgets** (\`minAvailable\` / \`maxUnavailable\`) stop voluntary disruptions such as node drains from taking down too many replicas at once.
`,
      keyPoints: [
        "CrashLoopBackOff is a symptom: read kubectl logs --previous and the exit code to find the cause.",
        "Startup probe protects slow starters; liveness restarts stuck processes; readiness gates traffic without restarting.",
        "Never check dependencies in liveness: a DB outage would restart every pod.",
        "Deletion removes endpoints and sends SIGTERM in parallel. Use a preStop sleep and handle SIGTERM to avoid 502s.",
        "PodDisruptionBudgets limit how many replicas voluntary disruptions (drains, upgrades) can take down.",
      ],
      code: [
        {
          title: "Probes and graceful shutdown done right",
          variants: [
            {
              lang: "yaml",
              code: `
apiVersion: apps/v1
kind: Deployment
metadata: { name: checkout }
spec:
  replicas: 4
  selector: { matchLabels: { app: checkout } }
  template:
    metadata: { labels: { app: checkout } }
    spec:
      terminationGracePeriodSeconds: 45        # > preStop + longest request
      initContainers:
        - name: migrate
          image: myorg/checkout:2.3.1
          command: ["./migrate", "up"]
      containers:
        - name: app
          image: myorg/checkout:2.3.1
          ports: [{ name: http, containerPort: 8080 }]
          startupProbe:                         # up to 30 × 5 s = 150 s to start
            httpGet: { path: /healthz, port: http }
            periodSeconds: 5
            failureThreshold: 30
          livenessProbe:                        # the process only, never dependencies
            httpGet: { path: /healthz, port: http }
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:                       # can I take traffic right now?
            httpGet: { path: /ready, port: http }
            periodSeconds: 5
            failureThreshold: 2
          lifecycle:
            preStop:
              sleep: { seconds: 10 }            # let endpoint removal propagate
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: checkout }
spec:
  maxUnavailable: 1
  selector: { matchLabels: { app: checkout } }
`,
            },
          ],
        },
        {
          title: "Handle SIGTERM in the app",
          variants: [
            {
              lang: "go",
              code: `
srv := &http.Server{Addr: ":8080", Handler: mux}
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatal(err)
    }
}()

stop := make(chan os.Signal, 1)
signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
<-stop                                   // preStop has already run by now

ready.Store(false)                       // fail readiness, just in case
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(ctx)                        // stop accepting, drain in-flight requests
db.Close()
`,
            },
            {
              lang: "javascript",
              code: `
const server = app.listen(8080, "0.0.0.0");

process.on("SIGTERM", () => {
  ready = false;                                   // /ready now returns 503
  server.close(async () => {                       // stop accepting, finish in-flight
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000).unref(); // hard stop before SIGKILL
});
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What's the difference between liveness, readiness and startup probes?",
          a: "**Readiness** answers \"can this pod take traffic now?\"; failing it removes the pod from Service endpoints but doesn't restart it (warming caches, temporarily overloaded, dependency down). **Liveness** answers \"is the process irrecoverably stuck?\"; failing it makes the kubelet **restart** the container (deadlocks). **Startup** protects slow-starting apps: liveness and readiness don't run until it passes, so a 60-second JVM boot isn't killed by liveness. Key rule: liveness must not depend on external dependencies, or a database blip restarts your whole fleet.",
          freq: "very-common",
        },
        {
          q: "Users see 502 errors during every rolling deployment. What's going on and how do you fix it?",
          a: "On pod deletion, **endpoint removal and SIGTERM happen in parallel**. kube-proxy rules, ingress controllers and load balancers take a moment to stop sending traffic, but the app exits immediately on SIGTERM, so in-flight and newly routed requests fail. Fixes: (1) a **preStop hook** that sleeps 5–15 s so routing updates first; (2) the app handles **SIGTERM gracefully**, stops accepting, drains in-flight requests and closes connections; (3) **terminationGracePeriodSeconds** larger than both; (4) a correct **readiness probe** plus `maxUnavailable: 0, maxSurge: 1` so new pods are ready before old ones go; (5) if behind a cloud LB, enable connection draining / pod readiness gates. Also check the app actually receives SIGTERM (exec form, PID 1).",
          freq: "very-common",
        },
        {
          q: "A pod is in CrashLoopBackOff. Walk me through debugging it.",
          a: "1) `kubectl describe pod` → look at **Last State: Terminated**, the **exit code** and Events. 2) `kubectl logs <pod> --previous` for the crashed attempt's output. 3) Interpret the exit code: **1** app error (config, missing env var, failed migration), **137** SIGKILL (OOMKilled if the reason says so, or a liveness kill), **139** segfault, **143** SIGTERM. 4) Check whether **liveness** is killing it (Events show \"Liveness probe failed\"): needs a startup probe or a less aggressive probe. 5) Check config: missing Secret/ConfigMap keys, wrong command/args, a read-only filesystem the app writes to. 6) If logs are empty, run the image with an overridden command (`kubectl debug` or `command: [sleep, infinity]`) and poke around.",
          freq: "very-common",
        },
        {
          q: "What is a PodDisruptionBudget and when doesn't it protect you?",
          a: "A PDB sets `minAvailable` or `maxUnavailable` for pods matching a selector. The **eviction API** honours it, so `kubectl drain`, cluster-autoscaler scale-down and node upgrades wait rather than evict too many replicas at once. It does **not** protect against involuntary disruptions: node crashes, OOM kills, kernel panics, or someone running `kubectl delete pod` directly (deletes bypass eviction). Also, a PDB with `maxUnavailable: 0` (or minAvailable = replicas) blocks drains forever, a common cause of stuck node upgrades.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "A readiness probe fails 3 times in a row. What does Kubernetes do?",
          options: ["Restarts the container", "Removes the pod from Service endpoints until it passes again", "Deletes the pod", "Reschedules it to another node"],
          answer: 1,
          explain: "Readiness only gates traffic. Restarts come from liveness (or startup) failures.",
        },
        {
          q: "Your liveness probe calls the database. The database goes down for 2 minutes. What happens?",
          options: ["Nothing, the pods keep serving", "Every pod gets restarted repeatedly, though restarting can't fix the database", "Only one pod restarts", "Kubernetes fails over the database"],
          answer: 1,
          explain: "Liveness failures restart containers. Dependency checks belong in readiness at most, never liveness.",
        },
        {
          q: "What's the default terminationGracePeriodSeconds?",
          options: ["5", "10", "30", "300"],
          answer: 2,
          explain: "30 seconds between SIGTERM (after preStop) and SIGKILL, unless you set it.",
        },
        {
          q: "What does an exit code of 137 tell you?",
          options: ["The app returned an error", "The process was killed with SIGKILL (128 + 9), often an OOM kill or a liveness kill", "A segmentation fault", "A graceful SIGTERM shutdown"],
          answer: 1,
          explain: "Exit codes above 128 mean killed by signal (code − 128). 9 is SIGKILL; check the Reason field for OOMKilled.",
        },
      ],
    },

    // ------------------------------------------------------------------ SCHEDULING & RESOURCES
    {
      id: "scheduling-resources",
      title: "Resources, QoS & Scheduling",
      tagline: "Requests vs limits, CPU throttling, OOM kills, QoS classes, affinity, taints and autoscaling nodes.",
      difficulty: "advanced",
      minutes: 18,
      visualizers: ["scheduler", "kube"],
      concept: `
## Requests vs limits
- **requests** are what the **scheduler** reserves. A pod lands only on a node whose allocatable capacity minus the *sum of requests* fits it. Actual usage is irrelevant to scheduling.
- **limits** are enforced by the **kernel** through cgroups at runtime.

The two resources behave very differently at the limit:
| | CPU (compressible) | Memory (incompressible) |
|---|---|---|
| Over the limit | **Throttled** by the CFS quota: slower, never killed | **OOM-killed** (exit 137, reason OOMKilled) |
| Requests also mean | A proportional share of CPU when the node is busy | Protection from eviction ranking |

CPU limits often hurt more than they help: a multi-threaded app can burn its 100 ms quota in the first 20 ms of a period and then stall for 80 ms, adding tail latency even on an idle node. A common policy is **memory request = limit, CPU request set, no CPU limit**. Watch \`container_cpu_cfs_throttled_periods_total\`.

## QoS classes and eviction
| Class | Rule | Evicted |
|---|---|---|
| **Guaranteed** | requests = limits for CPU and memory in every container | Last |
| **Burstable** | Some requests set | In between, by how far usage exceeds requests |
| **BestEffort** | No requests or limits | First |

Under node memory pressure, the kubelet **evicts** pods in roughly that order. Separately, the kernel OOM killer may kill a container that exceeds its own limit at any time.

Namespaces get guardrails from **LimitRange** (defaults and min/max per container) and **ResourceQuota** (totals per namespace).

## How the scheduler decides
For each pending pod: **filter** nodes that can't run it, **score** the rest, then **bind** to the best. The visualizer walks through it.
- **nodeSelector / nodeAffinity**: hard (required) or soft (preferred) rules on node labels: SSDs, GPU type, zone.
- **Taints and tolerations**: a taint repels pods that don't tolerate it. \`NoSchedule\` blocks new pods, \`PreferNoSchedule\` is soft, \`NoExecute\` also evicts running pods. Used to dedicate nodes (GPUs, system workloads). A toleration *permits* a node; it doesn't *attract* the pod, so pair it with a nodeSelector.
- **Pod affinity / anti-affinity**: place relative to other pods. Anti-affinity on \`kubernetes.io/hostname\` keeps replicas on different nodes.
- **topologySpreadConstraints**: spread evenly across zones or nodes with a \`maxSkew\`. It's the modern, cheaper way to spread replicas.
- **PriorityClass and preemption**: a high-priority pending pod can evict lower-priority pods to make room.

## Capacity that moves
- **Cluster Autoscaler** adds nodes when pods are Pending because nothing fits, and removes underused nodes. **Karpenter** provisions right-sized nodes directly from pending pods' requirements, usually faster and cheaper.
- **HPA** scales replicas from metrics (CPU *relative to requests*, so wrong requests mean wrong scaling). **VPA** recommends or sets requests from observed usage. Don't let HPA and VPA act on the same metric.
- Since 1.33, in-place pod resize (beta) can change a running pod's CPU/memory without recreating it.

## Right-sizing in practice
Set requests near **p90–p95 actual usage**, memory limit with headroom for spikes, and revisit with real metrics (VPA recommendations or Prometheus). Over-requesting wastes money (nodes look full but sit idle); under-requesting causes noisy neighbours, throttling and evictions.
`,
      keyPoints: [
        "The scheduler uses requests only; the kernel enforces limits. Requests drive cost and packing.",
        "Over the CPU limit = throttled. Over the memory limit = OOMKilled (exit 137).",
        "QoS: Guaranteed (requests = limits) is evicted last, BestEffort first.",
        "Scheduling = filter (resources, taints, affinity) → score → bind. Tolerations permit; selectors attract.",
        "Cluster Autoscaler/Karpenter react to Pending pods; HPA scales on usage relative to requests.",
      ],
      code: [
        {
          title: "Placement and resources for a zone-redundant API",
          variants: [
            {
              lang: "yaml",
              code: `
spec:
  priorityClassName: business-critical
  topologySpreadConstraints:
    - maxSkew: 1                                  # zones differ by at most 1 replica
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector: { matchLabels: { app: api } }
  affinity:
    podAntiAffinity:                              # prefer different nodes too
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            topologyKey: kubernetes.io/hostname
            labelSelector: { matchLabels: { app: api } }
  containers:
    - name: api
      image: myorg/api:3.2.0
      resources:
        requests: { cpu: 500m, memory: 768Mi }    # what the scheduler reserves
        limits:   { memory: 768Mi }               # no CPU limit: avoid throttling
---
# GPU nodes: tainted so only GPU workloads land there
# kubectl taint nodes gpu-1 nvidia.com/gpu=present:NoSchedule
spec:
  nodeSelector: { gpu: a100 }                     # attract
  tolerations:                                    # permit
    - { key: nvidia.com/gpu, operator: Exists, effect: NoSchedule }
`,
            },
          ],
        },
        {
          title: "Find what's wasting or starving capacity",
          variants: [
            {
              lang: "bash",
              code: `
kubectl describe node node-a | sed -n '/Allocated resources/,/Events/p'   # requests vs allocatable
kubectl top pods -A --sort-by=memory | head                               # real usage
kubectl get pods -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,QOS:.status.qosClass
kubectl get events -A --field-selector reason=FailedScheduling
kubectl get pods -A --field-selector status.phase=Pending
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Explain requests vs limits, and what happens when a container exceeds each.",
          a: "**Requests** are reservations used by the scheduler to place pods and by the kernel to share CPU proportionally under contention; they also influence eviction order. **Limits** are hard caps enforced by cgroups. Exceeding the **CPU limit** causes **throttling** via the CFS quota: the container just runs slower, which shows up as latency. Exceeding the **memory limit** gets the container **OOM-killed** (exit code 137, reason OOMKilled) and restarted. If usage exceeds requests without a limit and the **node** runs out of memory, the kubelet **evicts** pods, Burstable and BestEffort first. Many teams set memory request = limit, and CPU requests without CPU limits.",
          freq: "very-common",
        },
        {
          q: "A pod is stuck in Pending. How do you figure out why?",
          a: "`kubectl describe pod` → the **FailedScheduling** event says exactly which filters failed, e.g. `0/6 nodes are available: 3 Insufficient cpu, 2 node(s) had untolerated taint, 1 node(s) didn't match node affinity`. Then: **Insufficient cpu/memory** → requests too high, or the cluster is full and the autoscaler isn't adding nodes (check its logs, max size, quotas). **Taints** → add a toleration or use different nodes. **Affinity/selector** → a label typo or no node has it. **Topology spread / anti-affinity** → too strict for the number of nodes or zones. **Unbound PVC** → a storage issue (zone mismatch, no StorageClass). Also check ResourceQuota (that shows as a creation error on the ReplicaSet, not a Pending pod).",
          freq: "very-common",
        },
        {
          q: "What are taints and tolerations, and how do they differ from node affinity?",
          a: "A **taint** on a node repels pods; only pods with a matching **toleration** may schedule there (`NoSchedule`), may prefer not to (`PreferNoSchedule`), or are evicted if already running (`NoExecute`, also used by the node controller for NotReady nodes). It's a **node-side** mechanism to keep pods *off*. **Node affinity** is **pod-side**: the pod says which nodes it wants. They're complementary: to dedicate GPU nodes, taint them (keep others off) **and** give GPU pods a toleration plus a nodeSelector/affinity (pull them on). A toleration alone lets a pod land on any node, tainted or not.",
          freq: "common",
        },
        {
          q: "Why might you remove CPU limits from your containers?",
          a: "CPU limits are enforced per CFS period (100 ms): a multi-threaded process can consume its whole quota early in the period and then be **throttled** for the rest, even when the node has idle CPU. That adds latency spikes at p99 for no reason. With CPU **requests** set correctly, the kernel already guarantees each container its proportional share under contention, so limits mainly prevent *using idle capacity*. Counter-arguments: predictable performance for benchmarking, noisy-neighbour control in multi-tenant clusters, and Guaranteed QoS (which needs limits = requests, also enabling CPU pinning). Memory limits should stay, since memory can't be reclaimed by throttling.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "What does the scheduler compare against a node's allocatable capacity?",
          options: ["Current CPU usage", "The sum of pod requests", "The sum of pod limits", "The image size"],
          answer: 1,
          explain: "Scheduling is based purely on requests. A node at 5% real usage can be 'full' if its requests are allocated.",
        },
        {
          q: "A container exceeds its CPU limit. What happens?",
          options: ["It is OOM-killed", "It is throttled", "It is evicted", "The node is cordoned"],
          answer: 1,
          explain: "CPU is compressible: the CFS quota throttles it. Memory overruns are what get killed.",
        },
        {
          q: "Which pod has QoS class Guaranteed?",
          options: ["No requests or limits", "Requests set, no limits", "CPU and memory requests equal to limits in every container", "Only a memory limit"],
          answer: 2,
          explain: "Guaranteed requires requests = limits for both CPU and memory in all containers.",
        },
        {
          q: "You taint GPU nodes and add a toleration to your training pods. Why do some training pods still land on normal nodes?",
          options: ["Tolerations are ignored by default", "A toleration only permits tainted nodes; you also need a nodeSelector or affinity to attract the pod", "The taint effect must be NoExecute", "The GPU nodes need a PDB"],
          answer: 1,
          explain: "Taints keep other pods off; selectors/affinity pull your pods on. You need both.",
        },
      ],
    },
    ...kubernetesPart2,
  ],
};
