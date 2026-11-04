import type { Lesson } from "../types";

// Docker, part 5: production. Security, running containers reliably, and Docker in CI/CD.

export const dockerPart5: Lesson[] = [
  // ------------------------------------------------------------------ SECURITY
  {
    id: "dk-security",
    part: "Part 5 · Production",
    title: "Container security",
    tagline: "Capabilities, seccomp and AppArmor, non-root users, read-only filesystems, why --privileged and docker.sock are root on the host, secrets that don't leak, rootless Docker, and scanning images for known vulnerabilities.",
    difficulty: "advanced",
    minutes: 30,
    diagram: {
      title: "How a container gets broken out of, and what stops it",
      nodes: [
        { id: "attacker", label: "Attacker", kind: "external", x: 90, y: 280, sub: "finds a bug in your app" },
        { id: "app", label: "Your container", kind: "service", x: 300, y: 280, sub: "non-root? read-only? caps dropped?" },
        { id: "sock", label: "docker.sock", kind: "gateway", x: 520, y: 110, sub: "mounted into the container" },
        { id: "dockerd", label: "dockerd (root)", kind: "control", x: 760, y: 110, sub: "does whatever the API asks" },
        { id: "kernel", label: "Shared kernel", kind: "node", x: 520, y: 460, sub: "seccomp filters syscalls" },
        { id: "host", label: "The host", kind: "node", x: 870, y: 300, sub: "every container, every secret" },
        { id: "registry", label: "Base image", kind: "registry", x: 300, y: 470, sub: "packages with known CVEs?" },
        { id: "scanner", label: "Scanner", kind: "monitor", x: 90, y: 470, sub: "Trivy, Docker Scout, Grype" },
      ],
      edges: [
        { from: "attacker", to: "app", label: "exploit" },
        { from: "app", to: "sock" },
        { from: "sock", to: "dockerd" },
        { from: "dockerd", to: "host", label: "--privileged -v /:/host" },
        { from: "app", to: "kernel", label: "syscalls" },
        { from: "kernel", to: "host", label: "kernel bug" },
        { from: "registry", to: "app", label: "FROM" },
        { from: "scanner", to: "registry", label: "scan", dashed: true },
      ],
      flows: [
        {
          name: "Escape through docker.sock",
          path: ["attacker", "app", "sock", "dockerd", "host"],
          steps: [
            "The attacker gets code running in your container through a bug in the app.",
            "Someone mounted /var/run/docker.sock into it \"so the app can see other containers\".",
            "The socket is the full Docker API, served by a daemon running as root.",
            "One API call starts a privileged container that mounts the host's / and chroots into it: game over. Never mount the socket into anything you don't fully trust.",
          ],
        },
        {
          name: "Kernel exploit",
          path: ["attacker", "app", "kernel", "host"],
          steps: [
            "Inside the container, the attacker tries a kernel bug.",
            "All containers share one kernel. seccomp blocks rare syscalls, dropped capabilities and a non-root user remove most attack paths, AppArmor/SELinux confine the rest.",
            "If a kernel bug still works, it breaks every container on the host. Patch kernels, and run untrusted code in gVisor or micro-VMs.",
          ],
        },
        {
          name: "Vulnerable base image",
          path: ["scanner", "registry", "app"],
          steps: [
            "In CI, a scanner lists every package in the image and checks it against vulnerability databases.",
            "Images built on an old base inherit its holes. Rebuild regularly on a patched base, and keep images small: fewer packages, fewer CVEs.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Think of a container as a **hotel room**. The hotel (the computer) has many rooms, and all guests share the same building, pipes and electricity (the kernel).

A good hotel:
- gives guests a **room key, not the master key**: the app runs as a normal user, with most "superpowers" removed;
- **glues the furniture down**: the room can't be changed (a read-only filesystem), except a small scratch pad (\`/tmp\`);
- **never leaves the master key in a room**: that's what mounting \`docker.sock\` or using \`--privileged\` does;
- **checks deliveries at the door**: images are scanned for known bad parts before they come in;
- **keeps secrets in the safe, not on the door**: passwords live in files, not written on the environment variables everyone can read.

## Layers of defense
A container breakout usually needs several mistakes at once. Each layer removes some:
| Layer | What it does | How |
|---|---|---|
| **Non-root user** | a compromised app isn't root inside, so file permissions protect the rest | \`USER node\` in the Dockerfile, \`--user 1000\` |
| **Capabilities** | root's powers split into ~40 pieces; Docker keeps 14 by default | \`--cap-drop ALL --cap-add NET_BIND_SERVICE\` |
| **seccomp** | blocks ~40 dangerous syscalls (\`kexec_load\`, \`mount\` without SYS_ADMIN, \`keyctl\`...) | on by default; never use \`--security-opt seccomp=unconfined\` |
| **AppArmor / SELinux** | mandatory access control profile for the process | on by default on Ubuntu/RHEL hosts |
| **no-new-privileges** | setuid binaries (\`sudo\`, \`su\`) can't raise privileges | \`--security-opt no-new-privileges\` |
| **Read-only root** | malware can't install tools or change your code | \`--read-only --tmpfs /tmp\` |
| **Resource limits** | one container can't starve the host (fork bombs, memory leaks) | \`--memory\`, \`--pids-limit\`, \`--cpus\` |
| **User namespaces** | root in the container maps to an unprivileged UID on the host | rootless Docker, Podman, \`userns-remap\` |

## The big mistakes
- **\`--privileged\`**: every capability, every device in \`/dev\`, no seccomp, no AppArmor. Root in a privileged container is root on the host: it can mount the host's disks. Use it only for things like Docker-in-Docker or system tools you fully trust, and prefer adding the one capability you need.
- **Mounting \`/var/run/docker.sock\`**: the Docker API is root on the host (previous lesson).
- **Bind-mounting sensitive host paths**: \`-v /:/host\`, \`-v /etc:/etc\`.
- **Host namespaces**: \`--network host\`, \`--pid host\` remove isolation.
- **Secrets in images or env vars**: anything in a layer can be extracted from the image forever, and environment variables show up in \`docker inspect\`, \`/proc/*/environ\`, crash reports and child processes. Use build secrets (\`RUN --mount=type=secret\`) and mount runtime secrets as files (Compose \`secrets:\`, Kubernetes Secrets as volumes, a vault).
- **Old base images**: CVEs pile up; rebuild often.

## Rootless Docker and Podman
In **rootless mode**, the Docker daemon itself runs as your normal user, inside a user namespace. A container escape then lands as an unprivileged user, not root. Some features are limited (ports below 1024 need a sysctl, some storage and network drivers). **Podman** is rootless and daemonless by default and accepts the same commands (\`alias docker=podman\` mostly works).

## Supply chain
- Use **official or verified** base images, pinned by version (\`node:20.18-slim\`) or, for full reproducibility, by digest (\`node:20-slim@sha256:...\`).
- **Scan** images in CI (Trivy, Grype, Docker Scout, the registry's own scanner) and fail the build on fixable critical issues.
- Produce an **SBOM** (software bill of materials) and **provenance** attestations (\`docker buildx build --sbom=true --provenance=true\`), and **sign** images (cosign / Sigstore) so clusters can refuse unsigned ones.
- **Minimal images** (slim, distroless, scratch) have fewer packages to be vulnerable.

## A hardened \`docker run\`
\`\`\`bash
docker run -d --name api \\
  --user 1000:1000 --read-only --tmpfs /tmp \\
  --cap-drop ALL --security-opt no-new-privileges \\
  --memory 256m --pids-limit 200 --cpus 1 \\
  -v /srv/secrets/db_password:/run/secrets/db_password:ro \\
  -p 8080:3000 shop-api:1.4.2
\`\`\`
The Compose project at the end of this world uses the same settings.`,
    keyPoints: [
      "Defense in depth: non-root USER, dropped capabilities, the default seccomp and AppArmor profiles, no-new-privileges, a read-only root and resource limits.",
      "--privileged, a mounted docker.sock, host namespaces and bind mounts of / are each effectively root on the host.",
      "Secrets in image layers are extractable forever, and environment variables leak through inspect and /proc: mount secrets as files and use build secrets.",
      "Rootless Docker and Podman run the daemon as a normal user, so an escape doesn't land as root.",
      "Pin and scan base images in CI, keep images minimal, and add SBOMs, provenance and signatures.",
    ],
    code: [
      {
        title: "Root in a container is a reduced root",
        docker: true,
        images: ["node:20-slim"],
        vary: ["\\d+ \\(vs \\d+ normally\\)"],
        variants: [{ lang: "bash", code: `# "root" in a container is a root with most superpowers (capabilities) removed.
# try "FLAGS" "COMMAND": run COMMAND as root in a fresh container and print the first line it says
try() { docker run --rm $1 node:20-slim sh -c "($2) 2>&1 | head -n 1"; }

echo "chown as container root:      $(try "" 'touch /f && chown nobody /f && echo allowed')"
echo "same with --cap-drop ALL:     $(try "--cap-drop ALL" 'touch /f && chown nobody /f && echo allowed')"
echo "mount a filesystem:           $(try "" 'mount -t tmpfs none /mnt && echo allowed')"
echo "change the system clock:      $(try "" 'date -s 2000-01-01 > /dev/null && echo allowed')"
echo "devices with --privileged:    $(docker run --rm --privileged node:20-slim ls /dev | wc -l | tr -d ' ') (vs $(docker run --rm node:20-slim ls /dev | wc -l | tr -d ' ') normally)"` }],
        explain: `- Container root can still \`chown\`: \`CAP_CHOWN\` is one of the 14 capabilities Docker keeps. With \`--cap-drop ALL\`, even root can't.
- Mounting filesystems needs \`CAP_SYS_ADMIN\` and changing the clock needs \`CAP_SYS_TIME\`. Docker drops both, so root in the container is refused.
- \`--privileged\` gives the container every device on the host (\`/dev\` grows from a handful of entries to all disks and terminals), plus every capability. That's why it's so dangerous.
- Real services usually need **no** capabilities at all: run them with \`--cap-drop ALL\` and add back only what's needed (e.g. \`NET_BIND_SERVICE\` to listen on port 80 as non-root).`,
        output: `chown as container root:      allowed
same with --cap-drop ALL:     chown: changing ownership of '/f': Operation not permitted
mount a filesystem:           mount: /mnt: permission denied.
change the system clock:      date: cannot set date: Operation not permitted
devices with --privileged:    167 (vs 15 normally)`,
      },
      {
        title: "A read-only container",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# --read-only: the container can't modify its own filesystem (malware can't drop files),
# --tmpfs /tmp: except for a small scratch folder in memory
docker run --rm --read-only --tmpfs /tmp node:20-slim sh -c '
  echo "write to /app: $(touch /app.txt 2>&1 || true)"
  echo x > /tmp/scratch && echo "write to /tmp: ok"'` }],
        explain: `- \`--read-only\` mounts the container's root filesystem read-only. If an attacker gets in, they can't download tools into it or change your code.
- Most apps need somewhere to write temporary files: \`--tmpfs /tmp\` gives a small in-memory folder. Real data goes to volumes.
- It also proves your container is truly stateless, which makes it safe to delete and recreate at any time.`,
        output: `write to /app: touch: cannot touch '/app.txt': Read-only file system
write to /tmp: ok`,
      },
      {
        title: "Why secrets don't belong in environment variables",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# Secrets in environment variables are visible to anyone who can run docker inspect...
docker run -d --name quest-leak -e DB_PASSWORD=hunter2 node:20-slim sleep 60 > /dev/null
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' quest-leak | grep PASSWORD

# ...and to every process in the container, through /proc
docker exec quest-leak sh -c 'tr "\\0" "\\n" < /proc/1/environ | grep PASSWORD'

# A secret mounted as a file doesn't show up in inspect's env at all
echo "hunter2" > db_password.txt
docker run -d --name quest-file -v "$PWD/db_password.txt":/run/secrets/db_password:ro node:20-slim sleep 60 > /dev/null
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' quest-file | grep -q PASSWORD || echo "quest-file: no PASSWORD in its environment"` }],
        explain: `- Anyone who can run \`docker inspect\` (or read your Compose file, CI logs, or crash reports that dump the environment) sees \`DB_PASSWORD\`.
- Inside the container, every process can read \`/proc/1/environ\`, and child processes inherit the variable.
- A secret mounted as a read-only **file** (\`/run/secrets/...\`) isn't in the config at all; the app reads it when it starts. That's what Compose \`secrets:\`, Docker Swarm secrets and Kubernetes Secret volumes do, and why many official images accept \`*_FILE\` variables like \`POSTGRES_PASSWORD_FILE\`.`,
        output: `DB_PASSWORD=hunter2
DB_PASSWORD=hunter2
quest-file: no PASSWORD in its environment`,
      },
    ],
    interview: [
      {
        q: "How would you harden a container for production?",
        a: "Start with the image: minimal base (slim/distroless), pinned and regularly rebuilt, scanned in CI, no secrets in layers, a non-root `USER`. At run time: `--cap-drop ALL` plus only the capabilities needed, keep the default seccomp and AppArmor/SELinux profiles, `no-new-privileges`, `--read-only` with a tmpfs for scratch space, memory/CPU/PID limits, no `--privileged`, no docker.sock or sensitive host mounts, no host namespaces, secrets mounted as files. On the host: patched kernel, rootless Docker or user-namespace remapping, restricted access to the Docker group. In Kubernetes the same ideas are `securityContext` (runAsNonRoot, readOnlyRootFilesystem, capabilities, seccompProfile), Pod Security Standards and admission policies.",
        freq: "very-common",
      },
      {
        q: "What does `--privileged` actually do, and why is it dangerous?",
        a: "It grants all capabilities, gives access to all host devices (`/dev/sda`, etc.), disables the seccomp and AppArmor/SELinux confinement, and makes some kernel filesystems writable. Root inside a privileged container can mount the host's disk, load kernel modules, or manipulate cgroups, so it is effectively **root on the host**: there is no isolation left besides namespaces that it can easily leave. Legitimate uses are narrow (Docker-in-Docker, some system agents); the usual fix is to add the specific capability or device needed (`--cap-add`, `--device`).",
        freq: "common",
      },
      {
        q: "How should containers get secrets?",
        a: "Never bake them into images: layers are permanent and anyone who can pull the image can extract them (even if a later layer deletes the file). For build-time secrets (private registry tokens, npm tokens) use BuildKit secret mounts (`RUN --mount=type=secret,id=npmrc`), which never enter a layer. At run time, prefer **files** mounted from a secret store (Compose/Swarm secrets, Kubernetes Secrets as volumes, Vault agent, cloud secret managers with CSI drivers) over environment variables, which leak through `docker inspect`, `/proc/*/environ`, logs, crash dumps and child processes. Rotate secrets, and limit who can read them.",
        freq: "common",
      },
      {
        q: "What is rootless Docker?",
        a: "Running the Docker daemon (and containers) as an unprivileged user inside a **user namespace**, instead of as root. UID 0 in the container maps to the user's subordinate UIDs on the host, so a container escape gives an attacker only that unprivileged user. Trade-offs: binding ports below 1024 needs a sysctl or capability, networking uses a user-space stack (slirp4netns/pasta) with some overhead, and a few features (some storage drivers, cgroup controls on older systems) are limited. Podman offers the same model by default and is daemonless.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Which is effectively root on the host?",
        options: ["A container running as USER node", "A container with docker.sock mounted", "A container with --read-only", "A container with --cap-drop ALL"],
        answer: 1,
        explain: "The socket is the full Docker API, run by a root daemon: it can start a privileged container mounting the host.",
      },
      {
        q: "Why is container root refused when it tries to mount a filesystem?",
        options: ["Containers have no root user", "Docker drops CAP_SYS_ADMIN and seccomp blocks it", "The filesystem is full", "mount isn't installed"],
        answer: 1,
        explain: "Capabilities split root's powers, and Docker keeps only a safe subset.",
      },
      {
        q: "A Dockerfile copies `.npmrc` with a token, runs `npm ci`, then `RUN rm .npmrc`. Is the token safe?",
        options: ["Yes, it was deleted", "No: it's still in the earlier layer, which anyone with the image can extract", "Yes, layers are encrypted", "Only if the image is private"],
        answer: 1,
        explain: "Use `RUN --mount=type=secret` so the token never enters a layer.",
      },
      {
        q: "What does `--read-only` protect against?",
        options: ["Network attacks", "An attacker writing tools or modifying code inside the container's filesystem", "Reading secrets", "Memory leaks"],
        answer: 1,
        explain: "The root filesystem can't be changed. Combine with --tmpfs /tmp for scratch space.",
      },
      {
        q: "What does an image scanner like Trivy check?",
        options: ["That the app's tests pass", "Every package in the image against known-vulnerability (CVE) databases", "Network latency", "Dockerfile formatting"],
        answer: 1,
        explain: "Run it in CI and fail builds on fixable critical vulnerabilities.",
      },
    ],
  },

  // ------------------------------------------------------------------ RUNNING IN PRODUCTION
  {
    id: "dk-production",
    title: "Running containers in production",
    tagline: "Memory limits and the OOM killer, health checks, restart policies, graceful shutdown, logs that don't fill the disk, docker stats, exit codes, and debugging slim containers with a toolbox sidecar.",
    difficulty: "advanced",
    minutes: 30,
    visualizers: ["containerlife"],
    concept: `## Explain it like I'm 10 🧸
Running a container in production is like being the **lifeguard at a pool**.
- You set **rules**: nobody may take more than their share of the pool (memory and CPU limits). Someone who grabs too much space gets taken out (the OOM killer).
- You **check on swimmers** every few seconds: "Are you OK?" If someone doesn't answer twice in a row, they're in trouble (a **health check**).
- If a swimmer gets tired and climbs out, you can send them back in automatically, but not forever (a **restart policy**).
- At closing time you **blow the whistle** and give everyone time to get out calmly, instead of pulling them out (graceful shutdown with SIGTERM).
- You keep a **logbook**, but you tear out old pages so it doesn't fill the whole office (log rotation).

Use the visualizer to try the events: make the app hit its memory limit, crash, or the daemon restart, under different restart policies.

## Limits: always set them
Without limits a container can use all the host's memory and CPU. Set:
- \`--memory\` (and \`--memory-swap\` equal to it to disable swap). Exceeding it means the **OOM killer**: exit **137**, \`OOMKilled: true\` in \`docker inspect\`. Remember that runtimes need room beyond the heap: give Node \`--max-old-space-size\` below the limit, and use container-aware JVM flags (\`-XX:MaxRAMPercentage\`).
- \`--cpus\`: exceeding it means **throttling** (slower), not death.
- \`--pids-limit\`: protects against fork bombs and runaway thread creation.

## Health checks
"The process is running" doesn't mean "the app works": it may be deadlocked or have lost its database. A \`HEALTHCHECK\` runs a command inside the container every interval; after \`retries\` failures the status becomes **unhealthy**.
- \`docker ps\` and \`docker inspect\` show \`starting\`, \`healthy\` or \`unhealthy\`, and Compose's \`depends_on: condition: service_healthy\` waits for it.
- Plain Docker does **not** restart unhealthy containers by itself; orchestrators (Swarm, Kubernetes liveness probes, autoheal tools) act on it.
- Use a cheap endpoint (\`/health\`) and a tool that exists in the image (slim images have no \`curl\`; use the runtime itself, as in the sample).
- Kubernetes splits it into **liveness** (restart me), **readiness** (don't send me traffic) and **startup** probes.

## Restart policies
| Policy | Restarts when | After the daemon (or machine) restarts |
|---|---|---|
| \`no\` (default) | never | stays stopped |
| \`on-failure[:N]\` | the exit code is not 0, at most N times | stays stopped |
| \`always\` | it stops for any reason (except \`docker stop\`) | starts again |
| \`unless-stopped\` | like always | starts again, unless you stopped it by hand |
Docker waits longer between each restart (it doubles the delay, from 100 ms up to a minute) so a crash loop doesn't eat the CPU. For servers, \`unless-stopped\` is the usual choice; for batch jobs, \`on-failure\`.

## Graceful shutdown
\`docker stop\` sends **SIGTERM**, waits (10 s by default, \`--stop-timeout\` or Compose \`stop_grace_period\` to change it), then SIGKILL. The app should stop accepting new requests, finish in-flight ones, close database connections and exit 0. That requires the app to be PID 1 or behind an init (\`--init\`, tini) that forwards signals: see the CMD/ENTRYPOINT lesson.

## Logs
Containers should log to **stdout/stderr**, not to files inside the container. The engine captures the streams with a **logging driver**:
- the default \`json-file\` driver **never rotates** unless told to: a chatty container can fill the disk. Set \`--log-opt max-size=10m --log-opt max-file=3\`, or globally in \`/etc/docker/daemon.json\` (or use the \`local\` driver, which rotates and compresses by default);
- other drivers send logs to journald, syslog, fluentd, AWS CloudWatch, GCP Logging...; in Kubernetes the kubelet manages log files and agents ship them;
- \`docker logs -f --since 10m --tail 100 web\` reads them.

## Watching and debugging
- \`docker stats\`: live CPU, memory (against the limit), network and disk I/O per container.
- \`docker inspect\` \`.State\`: \`ExitCode\`, \`OOMKilled\`, \`RestartCount\`, \`Health.Log\` (the last health check outputs).
- \`docker events\`: die, oom, health_status...
- **Exit codes**: 0 = success, 1 = app error, 125 = Docker couldn't run it, 126 = not executable, 127 = command not found, 137 = SIGKILL (OOM or \`docker kill\` or stop timeout), 143 = SIGTERM handled by exiting.
- **Slim images have no tools**: no \`ps\`, \`curl\`, or shell in distroless. Don't add them to production images. Instead, run a **toolbox** container that joins the target's namespaces (\`--pid container:X --network container:X\`), as in the sample. Kubernetes has the same thing built in: \`kubectl debug -it pod --image=busybox --target=app\` (ephemeral containers).

## One concern per container
Run one main process per container (web server, worker, database), each with its own limits, logs, health and scaling. Configure them through environment and mounted files (the same image in every environment), keep them stateless, and let volumes or managed services hold the data.`,
    keyPoints: [
      "Always set memory, CPU and PID limits: memory overruns are OOM-killed (137), CPU overruns are throttled.",
      "HEALTHCHECK reports starting/healthy/unhealthy; Compose can wait for it, but plain Docker doesn't restart unhealthy containers.",
      "Restart policies: no, on-failure[:N], always, unless-stopped, with growing delays between restarts.",
      "Log to stdout/stderr and configure rotation (json-file doesn't rotate by default); watch with docker stats, inspect and events.",
      "Debug slim images with a toolbox container that joins their pid and network namespaces (kubectl debug in Kubernetes).",
    ],
    code: [
      {
        title: "Hitting the memory limit",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# A program that keeps grabbing memory, in a container limited to 64 MiB (and no swap)
docker run --name quest-oom --memory 64m --memory-swap 64m node:20-slim node -e "
  const hog = [];
  setInterval(() => { hog.push(Buffer.alloc(8 * 1024 * 1024, 1)); }, 50);   // 8 MiB more every 50 ms"
echo "exit code: $?"
docker inspect -f 'OOMKilled: {{.State.OOMKilled}}' quest-oom` }],
        explain: `- The program grabs 8 MiB more every 50 ms. The cgroup says 64 MiB and \`--memory-swap 64m\` forbids swapping, so within a fraction of a second the kernel's **OOM killer** kills it.
- The exit code is **137** = 128 + 9 (SIGKILL): the process got no chance to clean up. \`OOMKilled: true\` tells you it was the memory limit and not a \`docker kill\`.
- In Kubernetes this shows up as \`OOMKilled\` in \`kubectl describe pod\`. The fix is either a bigger limit or a memory leak to hunt down.`,
        output: `exit code: 137
OOMKilled: true`,
      },
      {
        title: "A health check that notices a sick app",
        docker: true,
        images: ["node:20-slim"],
        vary: ["Up \\d+ seconds?"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
COPY server.js .
# Every second, ask the app "are you OK?". 2 failures in a row = unhealthy.
HEALTHCHECK --interval=1s --timeout=1s --retries=2 \\
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]` },
          { path: "server.js", lang: "javascript", code: `const http = require("http");
let broken = false;

http
  .createServer((req, res) => {
    if (req.url === "/break") broken = true; // simulate a stuck database connection
    res.statusCode = req.url === "/health" && broken ? 500 : 200;
    res.end(broken ? "sick\\n" : "fine\\n");
  })
  .listen(3000);` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-health . > /dev/null
docker run -d --name quest-doc quest-health > /dev/null
health() { docker inspect -f '{{.State.Health.Status}}' quest-doc; }

echo "just started: $(health)"
sleep 3
echo "after 3 s:    $(health)"
docker exec quest-doc node -e "fetch('http://localhost:3000/break')"
sleep 4
echo "after /break: $(health)"
docker ps --filter name=quest-doc --format '{{.Names}}: {{.Status}}'` }],
        explain: `- A new container is \`starting\` until its first successful check. It becomes \`healthy\` as soon as one check passes.
- Calling \`/break\` makes the app return 500 on \`/health\`, like an app that lost its database but whose process is still running. After 2 failed checks in a row it's \`unhealthy\`, and \`docker ps\` shows it.
- The process is still running: Docker alone doesn't restart it. Orchestrators (and Kubernetes liveness probes) do.
- The check uses \`node -e "fetch(...)"\` because the slim image has no \`curl\`.`,
        output: `just started: starting
after 3 s:    healthy
after /break: unhealthy
quest-doc: Up 7 seconds (unhealthy)`,
      },
      {
        title: "Restart policies and crash loops",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# A program that crashes every time, with a policy of "restart on failure, at most 3 times"
docker run -d --name quest-crashy --restart on-failure:3 node:20-slim node -e "
  console.log('starting...'); process.exit(1);" > /dev/null
sleep 5

docker inspect -f 'restarts: {{.RestartCount}}, status: {{.State.Status}}, exit code: {{.State.ExitCode}}' quest-crashy
docker logs quest-crashy | sort | uniq -c | sed 's/^ *//'` }],
        explain: `- The app crashes with exit code 1 immediately. \`on-failure:3\` restarts it at most 3 times, so it ran 4 times in total, then Docker gives up and leaves it \`exited\`.
- Logs survive restarts (it's the same container), which is why the line appears 4 times.
- Between attempts Docker waits longer and longer (100 ms, 200 ms, 400 ms...), so a crash loop doesn't burn the CPU. Kubernetes calls this state \`CrashLoopBackOff\`.`,
        output: `restarts: 3, status: exited, exit code: 1
4 starting...`,
      },
      {
        title: "Debug a slim container with a toolbox",
        docker: true,
        images: ["node:20-slim", "node:20"],
        variants: [{ lang: "bash", code: `# A slim app container: no ps, no curl, no debugging tools inside
docker run -d --name quest-app node:20-slim node -e "
  require('http').createServer((q, s) => s.end('app is alive\\n')).listen(3000);" > /dev/null
sleep 1
docker exec quest-app sh -c 'ps; curl --version' 2>&1 | head -n 2

# Attach a toolbox container to the SAME pid and network namespaces
docker run --rm --pid container:quest-app --network container:quest-app node:20 sh -c '
  ps -e -o pid,comm | head -n 2
  curl -s localhost:3000'` }],
        explain: `- The production image is slim: no \`ps\`, no \`curl\`. That's good for security and size, and bad for debugging.
- Instead of installing tools into it, start a **toolbox** container from a bigger image that joins the app's **pid** and **network** namespaces. It sees the app's processes (\`node\` is PID 1) and reaches it on \`localhost\`.
- Kubernetes does the same with \`kubectl debug -it my-pod --image=busybox --target=app\`, and Docker Desktop with \`docker debug\`.`,
        output: `sh: 1: ps: not found
sh: 1: curl: not found
  PID COMMAND
    1 node
app is alive`,
      },
    ],
    interview: [
      {
        q: "A container keeps exiting with code 137. How do you investigate?",
        a: "137 = 128 + 9: the process was **SIGKILLed**. Check `docker inspect -f '{{.State.OOMKilled}}'` (or `kubectl describe pod` showing `OOMKilled`): if true, it exceeded its memory limit, so look at `docker stats`/metrics for growth, heap settings (Node `--max-old-space-size`, JVM `MaxRAMPercentage` must leave headroom below the limit), leaks, or simply too low a limit. If not OOM, something sent SIGKILL: `docker kill`, or `docker stop` (or a Kubernetes termination) whose grace period expired because the app ignored SIGTERM, often because it isn't PID 1 behind a shell. Check `docker events` and the host's kernel log (`dmesg`) for OOM messages.",
        freq: "very-common",
      },
      {
        q: "What's the difference between a liveness and a readiness probe (or a Docker HEALTHCHECK)?",
        a: "A Docker `HEALTHCHECK` just reports a status (`starting`, `healthy`, `unhealthy`) that tools act on: Compose `depends_on: service_healthy`, Swarm replaces unhealthy tasks, plain Docker does nothing. Kubernetes separates the questions: **liveness** = is the process stuck? failing restarts the container; **readiness** = can it serve traffic now? failing removes the pod from Service endpoints without restarting it (warming caches, dependency down, overloaded); **startup** = has slow initialization finished? it holds off the other probes. Liveness checks should be cheap and not depend on downstream services, or a database blip restarts your whole fleet.",
        freq: "very-common",
      },
      {
        q: "Your host's disk fills up with Docker data. Where does it go and how do you fix it?",
        a: "`docker system df` breaks it down. Usual suspects: **container logs** with the json-file driver, which doesn't rotate by default (set `max-size`/`max-file` in `daemon.json` or per container, or use the `local` driver); **dangling images** and old tags from repeated builds (`docker image prune`, `-a` for unused); **build cache** (`docker builder prune`); **stopped containers** (`docker container prune`); **unused volumes** (`docker volume prune`, carefully: that's data). Automate pruning on CI hosts, and log to stdout so the engine controls retention.",
        freq: "common",
      },
      {
        q: "How do you debug a distroless or slim container that has no shell?",
        a: "Don't add tools to the image. Start a debug container that shares its namespaces: `docker run -it --pid container:app --network container:app nicolaka/netshoot` (or any toolbox image) to see its processes, `/proc/1/root` for its filesystem, and its network on localhost. In Kubernetes use **ephemeral containers**: `kubectl debug -it pod/app --image=busybox --target=app`. Also: `docker logs`, `docker inspect` (State, Health.Log), `docker cp` to pull files out, `docker diff`, and `docker commit` of a broken container into an image to examine offline.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "A container exits with 137 and `OOMKilled: true`. What happened?",
        options: ["It crashed with a bug", "It exceeded its memory limit and the kernel killed it", "Someone ran docker stop", "It exited successfully"],
        answer: 1,
        explain: "137 = SIGKILL; OOMKilled confirms the memory limit was the cause.",
      },
      {
        q: "A container's HEALTHCHECK is failing and its status is `unhealthy`. What does plain Docker do?",
        options: ["Restarts it", "Deletes it", "Nothing besides reporting the status", "Stops sending it traffic"],
        answer: 2,
        explain: "Orchestrators act on health; plain Docker only reports it (Compose can wait for healthy).",
      },
      {
        q: "Which restart policy brings a server back after the machine reboots, but not if you stopped it by hand?",
        options: ["no", "on-failure", "unless-stopped", "on-failure:3"],
        answer: 2,
        explain: "unless-stopped remembers a manual stop; always would start it again.",
      },
      {
        q: "Why can the default json-file logging driver fill a disk?",
        options: ["It compresses badly", "It doesn't rotate logs unless max-size/max-file are set", "It logs twice", "It stores logs in memory"],
        answer: 1,
        explain: "Configure rotation in daemon.json or per container, or use the local driver.",
      },
      {
        q: "How do you run `ps` against a slim container that doesn't contain it?",
        options: ["Install procps into the production image", "Run a toolbox container with --pid container:app", "It's impossible", "Use docker build"],
        answer: 1,
        explain: "Joining the pid namespace shows the app's processes without changing its image.",
      },
    ],
  },

  // ------------------------------------------------------------------ CI/CD
  {
    id: "dk-ci",
    title: "Docker in CI/CD",
    tagline: "Run tests inside the image, tag every build so you can trace it back to a commit, build one image for Intel and ARM with buildx, cache layers between CI runs, scan, push to a registry, and deploy by digest.",
    difficulty: "advanced",
    minutes: 25,
    diagram: {
      title: "From git push to a running container",
      nodes: [
        { id: "dev", label: "Developer", kind: "client", x: 90, y: 280, sub: "git push / tag v1.4.2" },
        { id: "ci", label: "CI runner", kind: "worker", x: 270, y: 280, sub: "GitHub Actions, GitLab CI" },
        { id: "buildkit", label: "buildx / BuildKit", kind: "service", x: 480, y: 280, sub: "amd64 + arm64" },
        { id: "test", label: "test stage", kind: "worker", x: 480, y: 80, sub: "--target test" },
        { id: "cache", label: "Layer cache", kind: "cache", x: 480, y: 480, sub: "type=gha / registry" },
        { id: "registry", label: "Registry", kind: "registry", x: 700, y: 280, sub: "ghcr.io, ECR, Docker Hub" },
        { id: "scan", label: "Scanner", kind: "monitor", x: 700, y: 480, sub: "Trivy" },
        { id: "prod", label: "Production", kind: "node", x: 890, y: 280, sub: "pulls image@sha256:..." },
      ],
      edges: [
        { from: "dev", to: "ci" },
        { from: "ci", to: "buildkit" },
        { from: "buildkit", to: "test" },
        { from: "buildkit", to: "cache", label: "cache-from / to" },
        { from: "buildkit", to: "scan", label: "scan before push" },
        { from: "buildkit", to: "registry", label: "push" },
        { from: "registry", to: "prod", label: "pull by digest" },
      ],
      flows: [
        {
          name: "A commit becomes a deployment",
          path: ["dev", "ci", "buildkit", "test", "buildkit", "scan", "buildkit", "registry", "prod"],
          steps: [
            "A push or a version tag starts the pipeline on a fresh CI machine.",
            "The runner asks BuildKit to build the Dockerfile.",
            "First the test stage: the tests run inside the same environment the app ships in. A failure stops everything.",
            "Tests passed; the release stage is built (mostly from cache).",
            "The image is scanned for known vulnerabilities before anyone can deploy it.",
            "Clean: BuildKit builds for amd64 and arm64 in one go.",
            "The image is pushed with immutable tags (sha-3f9c2ab, 1.4.2) and a digest.",
            "Production deploys that exact digest. Rolling back = deploying the previous digest.",
          ],
        },
        {
          name: "Why CI builds stay fast",
          path: ["ci", "buildkit", "cache", "buildkit", "registry"],
          steps: [
            "Each CI job starts on an empty machine with no local layer cache.",
            "BuildKit imports the cache from the last run (GitHub Actions cache or a registry).",
            "Unchanged layers (base image, npm ci when the lockfile didn't change) are reused, not rebuilt.",
            "Only changed layers are built and uploaded; the new cache is exported for the next run.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Imagine a **cookie factory**. Every time the recipe changes:
1. A machine bakes a **test cookie** and a taster checks it. Bad taste? The line stops and nothing goes to the shops.
2. If it's good, the machine bakes the real batch and puts it in a **box with a label**: the recipe version and the exact day it was made.
3. A safety inspector checks the box for anything dangerous.
4. The box goes to the **warehouse** (the registry), and the shops (servers) take that exact box.

If customers complain, the shop can go back to **yesterday's box**, because every box was labelled and kept.

## Build once, run everywhere
The image built in CI is the **same artifact** that goes to staging and production: you don't rebuild per environment, you change configuration (environment variables, mounted files). That's the main reason teams adopt Docker in pipelines.

## Test inside the image
A \`test\` stage in the Dockerfile runs the tests with exactly the OS, runtime and dependencies you ship. \`docker build --target test\` fails when a test fails, which fails the CI job. The release stage doesn't include the test files. For tests that need real databases or queues, **Testcontainers** (Java, Go, Node, Python, .NET...) starts throwaway containers from your test code, and \`docker compose up\` can run a full integration environment in CI.

## Tags: names for builds
- **\`:sha-3f9c2ab\`** (the git commit): unique, never moves. You can always trace a running container back to its code.
- **\`:1.4.2\`** (semver) for releases, plus moving tags like \`:1.4\` and \`:1\` for people who want updates.
- **\`:main\`** or \`:latest\` for "the newest build": fine for development, **dangerous in production**. A tag is just a pointer and can move, so two servers deploying \`:latest\` an hour apart may run different code, and rollbacks are guesswork.
- The **digest** (\`@sha256:...\`) identifies the exact content. Kubernetes and Compose deployments that pin digests are fully reproducible.
- OCI **labels** (\`org.opencontainers.image.revision\`, \`.version\`, \`.source\`) record the provenance inside the image.

## Multi-platform images
Laptops and cloud servers increasingly use **ARM** (Apple Silicon, AWS Graviton) as well as x86. \`docker buildx build --platform linux/amd64,linux/arm64 --push\` builds both and pushes one tag whose **index** points to both manifests; each machine pulls its own. The non-native one is built under QEMU emulation (slow for heavy compiles) unless you add native builders, or cross-compile in a stage that runs on the build platform (\`FROM --platform=$BUILDPLATFORM\`, with \`TARGETARCH\` as a build arg). Go and Rust cross-compile easily.

## Caching in CI
CI machines start empty, so without a cache every build reinstalls everything. BuildKit can export and import its cache:
- \`type=gha\`: the GitHub Actions cache;
- \`type=registry,ref=ghcr.io/me/app:buildcache\`: a cache image in your registry (works on any CI);
- \`type=inline\`: cache metadata inside the image itself.
\`mode=max\` caches the intermediate stages too, not just the final ones. A good Dockerfile order (lockfile before source) matters even more here.

## Registries
Docker Hub (rate limits on anonymous pulls), GitHub Container Registry (\`ghcr.io\`, with \`GITHUB_TOKEN\`), AWS ECR, Google Artifact Registry, Azure ACR, GitLab, Harbor (self-hosted). Use short-lived credentials from CI (OIDC) rather than long-lived passwords, set retention policies so old images get cleaned up, and mirror the base images you depend on.

## The whole pipeline
The GitHub Actions workflow below does all of it: tests in the test stage, a vulnerability scan, tags from git, a two-platform build with a CI cache, SBOM and provenance attestations, and a push only for main and version tags. Deployment then pins the pushed digest (Kubernetes manifests updated by a GitOps tool like Argo CD, \`docker compose pull && up -d\` on a server, or a cloud service like ECS or Cloud Run).`,
    keyPoints: [
      "Build the image once in CI and promote the same artifact through environments; only configuration changes.",
      "Run tests in a Dockerfile test stage so a failing test fails the build.",
      "Tag with the git SHA and semver for traceability, deploy by digest, and avoid :latest in production.",
      "docker buildx builds multi-platform images (amd64 + arm64) behind one tag; caches (gha, registry) keep CI builds fast.",
      "Scan before pushing, add SBOM and provenance, use short-lived registry credentials.",
    ],
    code: [
      {
        title: "Tests that stop a bad build",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim AS base
WORKDIR /app
COPY math.js .

# test stage: runs the tests. If they fail, the build fails.
FROM base AS test
COPY math.test.js .
RUN node --test

# release stage: what we ship (no tests inside)
FROM base AS release
CMD ["node", "-e", "console.log(require('./math').add(40, 2))"]` },
          { path: "math.js", lang: "javascript", code: `exports.add = (a, b) => a + b;` },
          { path: "math.test.js", lang: "javascript", code: `const test = require("node:test");
const assert = require("node:assert");
const { add } = require("./math");

test("adds two numbers", () => assert.strictEqual(add(2, 3), 5));` },
        ],
        variants: [{ lang: "bash", code: `# CI step 1: run the tests inside the exact image environment
docker build -q --target test -t quest-ci:test . > /dev/null && echo "tests passed"

# CI step 2: build the release image (only if the tests passed)
docker build -q --target release -t quest-ci:release . > /dev/null
docker run --rm quest-ci:release

# Now break the code and watch the build stop
echo 'exports.add = (a, b) => a - b;' > math.js
docker build -q --target test -t quest-ci:test . > /dev/null 2>&1 || echo "tests failed: build stopped, nothing gets shipped"` }],
        explain: `- \`--target test\` builds only up to the \`test\` stage, where \`RUN node --test\` runs the tests. If any test fails, the \`RUN\` fails, the build fails, and so does the CI job.
- The release stage starts again from \`base\`, so the test file isn't shipped.
- After we break \`add\`, the test stage fails and nothing gets built or pushed. In a real pipeline that's a red build on the pull request.`,
        output: `tests passed
42
tests failed: build stopped, nothing gets shipped`,
      },
      {
        title: "Tags and labels that trace a build to its commit",
        docker: true,
        images: ["node:20-slim"],
        files: [{ path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
# Values passed in at build time with --build-arg
ARG VERSION=dev
ARG GIT_SHA=unknown
# Standard OCI labels: anyone can find out what's inside and where it came from
LABEL org.opencontainers.image.version=$VERSION \\
      org.opencontainers.image.revision=$GIT_SHA \\
      org.opencontainers.image.source=https://github.com/example/shop
ENV APP_VERSION=$VERSION
CMD ["node", "-e", "console.log('running version', process.env.APP_VERSION)"]` }],
        variants: [{ lang: "bash", code: `# What a CI pipeline does on every commit: build once, tag it several ways
sha=3f9c2ab
docker build -q -t quest-shop:1.4.2 --build-arg VERSION=1.4.2 --build-arg GIT_SHA=$sha . > /dev/null
docker tag quest-shop:1.4.2 quest-shop:sha-$sha      # exact build, never changes
docker tag quest-shop:1.4.2 quest-shop:1.4           # moves to the newest 1.4.x

docker images quest-shop --format '{{.Repository}}:{{.Tag}}' | sort
docker run --rm quest-shop:sha-$sha
docker image inspect quest-shop:1.4 --format '{{range $k, $v := .Config.Labels}}{{$k}} = {{$v}}{{println}}{{end}}'` }],
        explain: `- \`--build-arg\` passes the version and commit into the build; \`ARG\` receives them, and \`LABEL\` and \`ENV\` store them in the image.
- One build, three tags: \`1.4.2\` (the release), \`sha-3f9c2ab\` (this exact commit; never reused), and \`1.4\` (moves forward with each patch release). All three point to the same image ID.
- The OCI labels let anyone run \`docker image inspect\` on a running image and find the commit and repository it came from. CI tools like \`docker/metadata-action\` generate these automatically.`,
        output: `quest-shop:1.4
quest-shop:1.4.2
quest-shop:sha-3f9c2ab
running version 1.4.2
org.opencontainers.image.revision = 3f9c2ab
org.opencontainers.image.source = https://github.com/example/shop
org.opencontainers.image.version = 1.4.2`,
      },
      {
        title: "A complete GitHub Actions pipeline",
        noCheck: "runs on GitHub Actions: it needs a GitHub runner, a registry login and network access",
        variants: [{ lang: "yaml", code: `# .github/workflows/image.yml: test, scan, build for two CPU types and push, on every commit
name: image
on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:

permissions:
  contents: read
  packages: write # lets GITHUB_TOKEN push to ghcr.io

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-qemu-action@v3 # emulates arm64 on this x86 runner
      - uses: docker/setup-buildx-action@v3 # a BuildKit builder

      # 1. The test stage of the Dockerfile: if a test fails, the job stops here
      - name: Test
        uses: docker/build-push-action@v6
        with:
          target: test
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # 2. Build the release image locally and look for known vulnerabilities
      - name: Build to scan
        uses: docker/build-push-action@v6
        with:
          load: true
          tags: shop:scan
          cache-from: type=gha
      - name: Scan
        uses: aquasecurity/trivy-action@0.28.0 # in real pipelines, pin third-party actions to a commit SHA
        with:
          image-ref: shop:scan
          severity: CRITICAL,HIGH
          ignore-unfixed: true
          exit-code: "1"

      # 3. Tags: sha-3f9c2ab on every commit, 1.4.2 and 1.4 for a v1.4.2 git tag, main for the branch
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=ref,event=branch

      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      # 4. One image for Intel/AMD and ARM servers, pushed only from main and tags
      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          platforms: linux/amd64,linux/arm64
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true` }],
        explain: `- **setup-qemu** and **setup-buildx** prepare a BuildKit builder that can also build arm64 images on an x86 runner.
- **Test** builds the \`test\` stage (the previous sample); a failing test fails the job.
- **Build to scan** loads the release image into the runner's Docker, and **Trivy** fails the job if it finds a fixable critical or high vulnerability.
- **metadata-action** computes tags (\`sha-...\`, \`1.4.2\`, \`1.4\`, \`main\`) and OCI labels from the git event.
- **Build and push** builds both platforms, pushes only for main and version tags (pull requests just build), and attaches an SBOM and provenance.
- \`cache-from/cache-to: type=gha\` stores layers in the GitHub Actions cache, so unchanged steps are skipped on the next run.`,
      },
    ],
    interview: [
      {
        q: "Why shouldn't you deploy `:latest` to production?",
        a: "A tag is a mutable pointer. `:latest` (or any moving tag) means different servers, or the same server after a restart or reschedule, can pull **different images**, so you can't tell what's running, reproduce a bug, or roll back reliably. With `IfNotPresent` pull policies, nodes may also keep running stale copies. Use immutable tags (git SHA, semver) and ideally deploy by **digest** (`image@sha256:...`), which identifies the exact content; record the digest in your deployment manifests (GitOps) so rollback is a revert.",
        freq: "very-common",
      },
      {
        q: "How do you build images for both x86 and ARM?",
        a: "With **buildx** (BuildKit): `docker buildx build --platform linux/amd64,linux/arm64 -t repo/app:1.0 --push .` builds each platform and pushes a multi-platform **image index** (manifest list) under one tag; clients pull the manifest matching their architecture. Non-native platforms are built via QEMU emulation (simple but slow for compiles), via native builder nodes (`docker buildx create --append` with an ARM machine, or cloud builders), or by **cross-compiling**: `FROM --platform=$BUILDPLATFORM` for the build stage and `TARGETOS`/`TARGETARCH` args to compile for the target, then copy the binary into a target-platform runtime stage.",
        freq: "common",
      },
      {
        q: "How do you keep Docker builds fast in CI?",
        a: "Start with the Dockerfile: dependency manifests before source code so the install layer is cached, a small context with `.dockerignore`, multi-stage builds, BuildKit cache mounts (`RUN --mount=type=cache,target=/root/.npm`). CI runners start cold, so **export and import the BuildKit cache**: `cache-to/cache-from` with `type=gha`, `type=registry` (a cache ref in the registry) or `type=inline`, with `mode=max` to include intermediate stages. Also: persistent/self-hosted builders, pulling base images from a nearby mirror, and building only what changed in monorepos.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In CI, which tag lets you find the exact commit an image came from?",
        options: [":latest", ":sha-3f9c2ab (the git SHA)", ":stable", ":main"],
        answer: 1,
        explain: "SHA tags are unique and never move. Labels record it inside the image too.",
      },
      {
        q: "What does `docker build --target test` do?",
        options: ["Runs the container's tests after deploying", "Builds the Dockerfile only up to the stage named test", "Builds for a test platform", "Pushes to a test registry"],
        answer: 1,
        explain: "A failing RUN in that stage fails the build, and so the CI job.",
      },
      {
        q: "What's inside a multi-platform image tag?",
        options: ["A single image that runs everywhere", "An index pointing to one manifest per platform", "Two tags", "A virtual machine"],
        answer: 1,
        explain: "Each machine pulls the manifest for its own OS and CPU architecture.",
      },
      {
        q: "Why export the BuildKit cache in CI?",
        options: ["CI runners start empty, so without it every layer is rebuilt", "It's required for pushing", "It makes images smaller", "It encrypts layers"],
        answer: 0,
        explain: "type=gha or type=registry caches carry layers between runs.",
      },
      {
        q: "What's the most reproducible way to reference an image in a deployment?",
        options: ["By :latest", "By digest (image@sha256:...)", "By image ID prefix", "By the build date"],
        answer: 1,
        explain: "A digest identifies the content itself; tags can move.",
      },
    ],
  },
];
