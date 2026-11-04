import type { Lesson } from "../types";

// Docker, part 1: what containers are, running them, images, ports and configuration.

export const dockerPart1: Lesson[] = [
  // ------------------------------------------------------------------ WHY CONTAINERS
  {
    id: "dk-why",
    part: "Part 1 · Containers from zero",
    title: "Why containers exist",
    tagline: "\"It works on my machine\", lunchboxes and shipping containers: what Docker is, what an image and a container are, and how they differ from virtual machines.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "From your code to a running container, anywhere",
      nodes: [
        { id: "dev", label: "Your laptop", kind: "client", x: 100, y: 120, sub: "code + Dockerfile" },
        { id: "build", label: "docker build", kind: "worker", x: 330, y: 120, sub: "follows the recipe" },
        { id: "image", label: "Image", kind: "storage", x: 560, y: 120, sub: "app + everything it needs" },
        { id: "registry", label: "Registry", kind: "registry", x: 820, y: 120, sub: "Docker Hub, GHCR, ECR" },
        { id: "server", label: "A server", kind: "node", x: 820, y: 400, sub: "any Linux machine" },
        { id: "c1", label: "Container 1", kind: "service", x: 560, y: 330, sub: "a running copy" },
        { id: "c2", label: "Container 2", kind: "service", x: 560, y: 470, sub: "another copy" },
        { id: "cloud", label: "Kubernetes / cloud", kind: "control", x: 300, y: 400, sub: "runs thousands of them" },
      ],
      edges: [
        { from: "dev", to: "build", label: "source" },
        { from: "build", to: "image", label: "layers" },
        { from: "image", to: "registry", label: "docker push" },
        { from: "registry", to: "server", label: "docker pull" },
        { from: "server", to: "c1", label: "docker run" },
        { from: "server", to: "c2", label: "docker run" },
        { from: "registry", to: "cloud", label: "pull", dashed: true },
      ],
      flows: [
        {
          name: "Build once, run anywhere",
          path: ["dev", "build", "image", "registry", "server", "c1"],
          steps: [
            "You write your app and a Dockerfile: a recipe that says what your app needs (a Linux, Node.js, your files).",
            "docker build follows the recipe and produces an image: a frozen package of your app plus everything it needs.",
            "docker push uploads the image to a registry, a library of images.",
            "Any server with Docker downloads exactly the same image with docker pull.",
            "docker run starts a container from it. It behaves the same as on your laptop, because it carries its whole world with it.",
          ],
        },
        {
          name: "One image, many containers",
          path: ["image", "registry", "server", "c2"],
          steps: [
            "An image is like a cookie cutter: you make it once.",
            "Every server pulls the same cutter.",
            "Each docker run stamps out another container. Ten containers from one image share its files and each get their own scratch space.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You wrote a game on your computer. You send it to a friend, and it won't start: "missing Python 3.12", "wrong version of this library", "this only works on Windows". Your game works on **your** machine because your machine has all the right stuff installed. Your friend's doesn't.

Now imagine you could pack your game in a **lunchbox** together with everything it needs: the right Python, the right libraries, the right settings, even its own little operating system files. Your friend just opens the lunchbox and plays. Nothing to install, nothing to break. That lunchbox is a **container**.

Two more ideas and you know the basics:
- The **image** is the recipe card *and* the frozen meal: a read-only package with your app and everything it needs. You make it once.
- A **container** is one running copy made from an image. You can start ten containers from one image, like baking ten cakes from one recipe. Each one is separate: if one gets messy, the others don't care, and you can throw it away and make a fresh one in a second.

The name comes from **shipping containers**. Before them, every ship, train and truck loaded boxes, barrels and sacks differently, and it was slow and messy. After them, everything goes in the same standard box, and every crane in the world knows how to lift it. Docker made a standard box for software: every laptop, server and cloud knows how to run it.

## The problem Docker solves
Software depends on its environment: the language runtime and its version, system libraries, environment variables, files in the right places. When environments differ between a laptop, a CI server and production, you get the most famous bug in software: **"it works on my machine"**.

Docker packages the application **with** its environment into an **image**. Run the image anywhere and the app sees the same files, the same libraries and the same settings. The only thing it borrows from the host is the **Linux kernel**.

## Images, containers, registries
| Thing | What it is | Analogy |
|---|---|---|
| **Dockerfile** | A text recipe: start from this base, copy these files, run these commands | The recipe |
| **Image** | A read-only, layered package built from the Dockerfile | The frozen meal |
| **Container** | A running (or stopped) instance of an image, with its own writable scratch layer | One plate being eaten |
| **Registry** | A server that stores images: Docker Hub, GitHub (ghcr.io), AWS ECR, Google Artifact Registry | The supermarket |

## Containers are not virtual machines
A **virtual machine** pretends to be a whole computer: a hypervisor emulates hardware and runs a complete guest operating system with its **own kernel**. That's strong isolation, but each VM needs gigabytes of memory and takes a while to boot.

A **container** is just a **normal process** on the host, with fences around it:
- **namespaces** decide what it can *see*: its own process list (it thinks it's PID 1), its own network card, its own hostname and its own files;
- **cgroups** decide what it can *use*: how much memory and CPU;
- its files come from the **image**.

There's no second kernel, so a container starts in milliseconds and uses only the memory its program needs. You can run hundreds on one machine.

| | Virtual machine | Container |
|---|---|---|
| Starts in | seconds to minutes | milliseconds |
| Size | gigabytes (a whole OS) | megabytes (just your app's files) |
| Kernel | its own | shares the host's |
| Isolation | strong (hardware level) | good (kernel level) |
| Runs a different OS? | yes (Windows on Linux, ...) | no: Linux containers need a Linux kernel |

That last row is why **Docker Desktop** on a Mac or Windows laptop quietly runs one small Linux VM, and your containers run inside it. On a Linux server there's no VM at all.

## Why every job ad mentions it
Containers are how almost all server software ships today. Kubernetes runs containers. AWS ECS, Google Cloud Run and Azure Container Apps run containers. CI pipelines build and test inside containers. Developers use Docker Compose to start the whole stack (app, database, cache) with one command. Knowing Docker well (how to build small, secure images, how networking and storage work, how to debug a container that won't start) is now a basic skill for backend, DevOps, SRE, data and ML engineers.

## What this world covers
1. **Containers from zero**: running containers, images, ports and configuration.
2. **Building images**: Dockerfiles, layers and the build cache, PID 1 and signals, small and secure images.
3. **Data and networking**: volumes, networks and DNS, Docker Compose.
4. **Under the hood**: namespaces, cgroups, overlayfs, the engine and the OCI standards.
5. **Production**: security, limits, health checks, debugging and CI/CD.
6. **Projects**: ship a real app with Compose, then **build your own mini Docker** in Python.

Every sample in this world is a real command you can paste into a terminal, and its output was produced by actually running it. Install Docker Desktop (Mac, Windows) or Docker Engine (Linux), and check it works with \`docker version\`.`,
    keyPoints: [
      "Docker packages an app together with everything it needs, so it runs the same everywhere: no more \"works on my machine\".",
      "An image is a read-only package (built from a Dockerfile); a container is one running instance of it. Many containers can share one image.",
      "A container is a normal Linux process with namespaces (what it sees) and cgroups (what it uses). It shares the host's kernel.",
      "VMs virtualize hardware and run their own kernel; containers are lighter and faster but share the kernel. Docker Desktop runs a small Linux VM on Mac and Windows.",
      "Registries (Docker Hub, GHCR, ECR) store images; docker push and docker pull move them around.",
    ],
    code: [
      {
        title: "Three different computers in three seconds",
        note: "Every container is Linux, whatever your laptop runs.",
        docker: true,
        images: ["ubuntu:24.04", "node:20-slim"],
        vary: ["Ubuntu 24\\.04\\.\\d+ LTS", "v20\\.\\d+\\.\\d+"],
        variants: [{ lang: "bash", code: `# Three different "computers", each started in about a second.
# Every container runs Linux, even on a Mac or Windows laptop: Docker Desktop runs a small Linux VM for you.
docker run --rm ubuntu:24.04 grep PRETTY_NAME /etc/os-release
docker run --rm node:20-slim grep PRETTY_NAME /etc/os-release
docker run --rm node:20-slim node --version
docker run --rm ubuntu:24.04 uname -s` }],
        explain: `- \`docker run IMAGE COMMAND\` starts a container from an image and runs one command inside it. \`--rm\` deletes the container when the command finishes, so they don't pile up.
- The first two lines read the same file, \`/etc/os-release\`, in two containers and get two different answers: one container is Ubuntu, the other is Debian. Each container brings its **own files**.
- \`node --version\` works even if you've never installed Node.js: it lives inside the \`node:20-slim\` image.
- \`uname -s\` asks the **kernel** its name. It's always Linux, even on a Mac: containers share a Linux kernel, and Docker Desktop provides one in a small VM. If an image isn't on your machine yet, \`docker run\` downloads it first.`,
        output: `PRETTY_NAME="Ubuntu 24.04.5 LTS"
PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
v20.20.2
Linux`,
      },
      {
        title: "A container thinks it's alone",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `# Inside a container, your program thinks it's alone on the machine.
docker run --rm ubuntu:24.04 ps -e
echo ---
# It has its own hostname, its own network card and its own files.
docker run --rm --hostname lunchbox ubuntu:24.04 hostname
docker run --rm ubuntu:24.04 ls /` }],
        explain: `- \`ps -e\` lists **every** process the program can see. On your laptop that's hundreds. Inside the container it's one: \`ps\` itself, as **PID 1**. That's the PID **namespace** at work.
- \`--hostname lunchbox\` gives the container its own name (the UTS namespace), and \`ls /\` shows a complete Linux file tree that came from the image, not from your computer (the mount namespace).
- It's still a normal process on the host. The fences just change what it can see.`,
        output: `  PID TTY          TIME CMD
    1 ?        00:00:00 ps
---
lunchbox
bin
boot
dev
etc
home
lib
lib64
media
mnt
opt
proc
root
run
sbin
srv
sys
tmp
usr
var`,
      },
      {
        title: "Containers are disposable",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `# Write a file inside a container...
docker run --rm ubuntu:24.04 sh -c 'echo "my homework" > /note.txt && cat /note.txt'
# ...then look for it from a NEW container made from the same image.
docker run --rm ubuntu:24.04 cat /note.txt 2>&1
echo "exit code: $?"` }],
        explain: `- The first container writes \`/note.txt\` and reads it back fine.
- The second \`docker run\` makes a **new** container from the same image, with a fresh copy of the image's files, so the note isn't there. \`cat\` fails and its exit code (1) becomes the exit code of \`docker run\`.
- This is a feature: every container starts clean and identical. Data you want to keep goes in a **volume** (Part 3).`,
        output: `my homework
cat: /note.txt: No such file or directory
exit code: 1`,
      },
    ],
    interview: [
      {
        q: "What is Docker, and what problem does it solve?",
        a: "Docker is a platform for building, shipping and running applications in **containers**. It packages an app with its runtime, libraries and configuration into an **image**, so the same artifact runs identically on a laptop, in CI and in production. That removes environment drift (\"works on my machine\"), makes deployments repeatable and fast, lets many isolated apps share one host efficiently, and gives a standard unit that orchestrators like Kubernetes, ECS and Cloud Run can schedule.",
        freq: "very-common",
      },
      {
        q: "What's the difference between an image and a container?",
        a: "An **image** is a read-only template: a stack of filesystem layers plus metadata (default command, environment, user, ports). A **container** is a runtime instance of an image: the image's layers plus a thin **writable layer**, running as an isolated process with its own namespaces and cgroup. You can start many containers from one image; they share the image's layers on disk, and each one's changes stay in its own writable layer, which is deleted when the container is removed. The analogy is a class and its objects, or a program file and its running processes.",
        freq: "very-common",
      },
      {
        q: "How is a container different from a virtual machine?",
        a: "A **VM** virtualizes hardware: a hypervisor runs a full guest OS with its own kernel, so you get strong isolation but pay gigabytes of RAM and slow boots per VM. A **container** is a process on the host isolated with kernel features (namespaces for visibility, cgroups for resources) and sharing the host kernel, so it starts in milliseconds and adds almost no overhead. The trade-off is isolation strength: a kernel vulnerability can affect every container on the host, so untrusted multi-tenant workloads use VMs, micro-VMs (Firecracker, Kata) or user-space kernels (gVisor). In practice you run containers *on* VMs.",
        freq: "very-common",
      },
      {
        q: "Can you run a Windows or macOS app in a Linux container?",
        a: "No. Containers share the host's kernel, so a Linux container needs a Linux kernel and runs Linux binaries. Docker Desktop on macOS and Windows works by running a lightweight **Linux VM** and putting your containers in it. Windows has its own native Windows containers that need a Windows kernel. CPU architecture matters too: an image built for amd64 needs emulation on an arm64 machine, which is why multi-platform images exist.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Your app works on your laptop but crashes on the server with \"library not found\". How does Docker prevent this?",
        options: ["It installs the missing library on the server", "The app ships in an image that already contains its libraries", "It runs the app in a faster VM", "It rewrites the app to not need libraries"],
        answer: 1,
        explain: "The image carries the app's whole environment (runtime, libraries, config), so the server only needs Docker, not the right libraries.",
      },
      {
        q: "What is the relationship between an image and a container?",
        options: ["They're two names for the same thing", "A container is a running instance of an image; one image can start many containers", "An image is a running container that was paused", "A container is a compressed image"],
        answer: 1,
        explain: "The image is the read-only template; each docker run creates a new container from it, with its own writable layer.",
      },
      {
        q: "What does every container on a host share?",
        options: ["The same files", "The same hostname", "The host's Linux kernel", "The same process list"],
        answer: 2,
        explain: "Namespaces give each container its own files, hostname and processes, but they all run on the host's kernel. That's why containers are light, and why Linux containers need Linux.",
      },
      {
        q: "A container writes /note.txt, and you then run a new container from the same image. Is the file there?",
        options: ["Yes, containers share files", "No: each container starts from a fresh copy of the image's files", "Only if the image is ubuntu", "Only if you wait a few seconds"],
        answer: 1,
        explain: "Changes go to the container's own writable layer. A new container gets a new, empty one. Use volumes for data that must survive.",
      },
      {
        q: "Why does Docker Desktop on a Mac run a small virtual machine?",
        options: ["To make containers faster", "Containers need a Linux kernel, and macOS doesn't have one", "To store images", "It doesn't; macOS runs containers natively"],
        answer: 1,
        explain: "Linux containers share a Linux kernel. Docker Desktop provides one in a lightweight VM; on a Linux server there's no VM.",
      },
    ],
  },

  // ------------------------------------------------------------------ FIRST CONTAINERS
  {
    id: "dk-first-container",
    title: "Your first containers",
    tagline: "docker run, ps, logs, exec, stop and rm; detached vs interactive; the container lifecycle; and what exit codes 0, 125, 126, 127 and 137 mean.",
    difficulty: "beginner",
    minutes: 25,
    visualizers: ["containerlife"],
    concept: `## Explain it like I'm 10 🧸
A container is like a **toy robot** you made from a kit (the image).
- \`docker run\` builds a robot from the kit and switches it on.
- \`docker ps\` asks "which robots are switched on right now?"
- \`docker logs\` lets you read everything the robot has said.
- \`docker exec\` lets you reach inside a running robot and press another button.
- \`docker stop\` politely asks it to switch itself off ("please tidy up and stop"). If it doesn't listen, Docker pulls the battery out after 10 seconds.
- \`docker rm\` throws the robot away. You still have the kit, so you can build a new one any time.

When a robot stops, it leaves a little note with a number: **0** means "I finished my job, all good". Any other number means something went wrong, and the number tells you what.

## The commands you'll use every day
| Command | What it does |
|---|---|
| \`docker run IMAGE [CMD]\` | create + start a container (pulls the image first if needed) |
| \`docker run -d --name web IMAGE\` | run in the background ("detached") with a name you choose |
| \`docker run -it IMAGE bash\` | interactive: \`-i\` keeps input open, \`-t\` gives a terminal. Type \`exit\` to leave |
| \`docker run --rm IMAGE\` | delete the container automatically when it exits |
| \`docker ps\` / \`docker ps -a\` | running containers / all of them, stopped ones too |
| \`docker logs [-f] NAME\` | what the main process printed (\`-f\` follows live, like \`tail -f\`) |
| \`docker exec -it NAME sh\` | run another command (here a shell) inside a running container |
| \`docker stop NAME\` | SIGTERM, then SIGKILL after 10 s (\`-t\` changes the wait) |
| \`docker kill NAME\` | SIGKILL right away |
| \`docker start NAME\` / \`docker restart NAME\` | start a stopped container again / stop + start |
| \`docker rm NAME\` / \`docker rm -f NAME\` | delete a stopped container / force: kill it first |
| \`docker inspect NAME\` | everything Docker knows about it, as JSON (\`-f\` picks fields) |

Containers get a random name (\`eager_turing\`) and an ID (\`3f9a1c2b7e4d...\`) unless you pass \`--name\`. Any unique prefix of the ID works in commands.

## The lifecycle
A container moves through a few states. Try them in the visualizer:
- **created**: the container exists (config + writable layer) but nothing runs. \`docker create\` stops here.
- **running**: its main process (PID 1) is alive. **A container lives exactly as long as its main process.** When that process exits, the container stops.
- **paused**: frozen by the cgroup freezer; memory kept, no CPU used.
- **exited**: the process has ended. Its files and logs are still there, so you can \`docker logs\` it, \`docker start\` it again, or \`docker rm\` it.
- **removed**: gone, together with its writable layer.

That first rule surprises everyone once: \`docker run -d ubuntu\` exits immediately, because ubuntu's default command is \`bash\`, and bash with no terminal and nothing to read just exits. A web server keeps running because its process keeps running.

## Exit codes tell you what happened
| Code | Meaning |
|---|---|
| **0** | success |
| **1**, 2, ... | the app failed (its own error code) |
| **125** | Docker itself failed: bad flag, bad image name |
| **126** | the command exists but can't be executed (permissions, not a program) |
| **127** | command not found (a typo, or the binary isn't in the image) |
| **128 + N** | killed by signal N: **137** = SIGKILL (9): \`docker kill\`, a stop timeout, or the **OOM killer**; **143** = SIGTERM (15) |

When a container misbehaves, the first three things to check are always \`docker ps -a\` (its state and exit code), \`docker logs NAME\` (what it said before dying) and \`docker inspect NAME\` (\`State.OOMKilled\`, \`State.Error\`, the command it ran).`,
    keyPoints: [
      "docker run = create + start; -d runs in the background, --name names it, --rm cleans up when it exits, -it gives you an interactive shell.",
      "A container runs exactly as long as its main process (PID 1). When that process exits, the container stops.",
      "docker logs shows what PID 1 printed; docker exec runs another command inside a running container.",
      "docker stop sends SIGTERM, then SIGKILL after 10 s; docker kill sends SIGKILL immediately.",
      "Stopped containers keep their files and logs until docker rm. Exit codes: 125 Docker error, 126 not executable, 127 not found, 137 killed (often out of memory).",
    ],
    code: [
      {
        title: "run, ps, logs, exec, stop, rm",
        note: "The six commands behind almost everything you'll do.",
        docker: true,
        images: ["node:20-slim"],
        vary: ["Up (Less than a second|\\d+ seconds?)", "Exited \\(0\\) (Less than a second|\\d+ seconds?) ago"],
        variants: [{ lang: "bash", code: `# 1. run: start a web server in the background (-d) and give it a name
docker run -d --name quest-web node:20-slim node -e "
  const http = require('http');
  http.createServer((req, res) => res.end('hello from inside a container\\n')).listen(3000);
  console.log('server listening on port 3000');
  process.on('SIGTERM', () => { console.log('got SIGTERM, bye!'); process.exit(0); });
" > /dev/null
sleep 1

# 2. ps: what's running?
docker ps --filter name=quest-web --format '{{.Names}}  {{.Image}}  {{.Status}}'

# 3. logs: everything the program printed
docker logs quest-web

# 4. exec: run a second command inside the running container
docker exec quest-web node -e "fetch('http://localhost:3000').then(r => r.text()).then(t => process.stdout.write(t))"

# 5. stop, then look again with -a (all, including stopped)
docker stop quest-web > /dev/null
docker ps -a --filter name=quest-web --format '{{.Names}}  {{.Status}}'
docker logs quest-web | tail -n 1

# 6. rm: delete the stopped container
docker rm quest-web
[ -z "$(docker ps -aq --filter name=quest-web)" ] && echo "no containers left"` }],
        explain: `- \`-d\` returns at once and leaves the server running in the background. \`node -e "..."\` runs a tiny web server written inline, so we don't need any files yet.
- \`docker ps --filter ... --format ...\` picks our container and prints chosen fields. \`--format\` uses Go templates: \`{{.Names}}\`, \`{{.Status}}\` and friends.
- \`docker logs\` shows what the program printed to stdout and stderr. That's why container apps **log to stdout** instead of to files.
- \`docker exec\` starts a **second** process in the same container. It shares the container's network, so \`localhost:3000\` is the server.
- \`docker stop\` sends SIGTERM. Our server catches it, says goodbye and exits with 0, so the status is \`Exited (0)\`. The container still exists (\`ps -a\`) until \`docker rm\`.`,
        output: `quest-web  node:20-slim  Up 1 second
server listening on port 3000
hello from inside a container
quest-web  Exited (0) Less than a second ago
got SIGTERM, bye!
quest-web
no containers left`,
      },
      {
        title: "Walk a container through every state",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `state() { docker inspect -f '{{.State.Status}}' quest-life; }

docker create --name quest-life ubuntu:24.04 sleep 60 > /dev/null
echo "after create:   $(state)"
docker start quest-life > /dev/null
echo "after start:    $(state)"
docker pause quest-life > /dev/null
echo "after pause:    $(state)"
docker unpause quest-life > /dev/null
echo "after unpause:  $(state)"
docker kill quest-life > /dev/null
echo "after kill:     $(state), exit code $(docker inspect -f '{{.State.ExitCode}}' quest-life)"
docker start quest-life > /dev/null
echo "after start:    $(state) again (same container, same files)"
docker rm -f quest-life > /dev/null
docker inspect quest-life > /dev/null 2>&1 || echo "after rm:       gone for good"` }],
        explain: `- \`docker inspect -f '{{.State.Status}}'\` reads one field from the container's JSON description.
- \`create\` makes the container without starting it. \`pause\` freezes its processes in place; \`unpause\` thaws them.
- \`kill\` sends SIGKILL, which can't be caught: exit code 128 + 9 = **137**.
- \`start\` after that brings the **same** container back, with the same writable layer. Only \`rm\` really deletes it. \`rm -f\` kills it first if it's running.`,
        output: `after create:   created
after start:    running
after pause:    paused
after unpause:  running
after kill:     exited, exit code 137
after start:    running again (same container, same files)
after rm:       gone for good`,
      },
      {
        title: "Read the exit code",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `# The exit code of docker run is the exit code of the program inside...
docker run --rm ubuntu:24.04 true;             echo "true            -> $?"
docker run --rm ubuntu:24.04 sh -c 'exit 3';   echo "exit 3          -> $?"
# ...except for three codes that mean "the program never started"
docker run --rm ubuntu:24.04 no-such-program 2> /dev/null;  echo "missing program -> $?"
docker run --rm ubuntu:24.04 /etc/hostname 2> /dev/null;    echo "not executable  -> $?"
docker run --rm --no-such-flag ubuntu:24.04 2> /dev/null;   echo "bad docker flag -> $?"` }],
        explain: `- \`$?\` is the shell's "exit code of the last command". \`docker run\` passes through the code of the process inside, so scripts and CI can tell success from failure.
- **127**: there's no program called \`no-such-program\` in the image. **126**: \`/etc/hostname\` exists but isn't a program. **125**: \`docker\` itself rejected the command line, so no container ran at all.
- Memorize 137 too: it means the process was SIGKILLed, and in production that's usually the **out-of-memory killer** (Part 5).`,
        output: `true            -> 0
exit 3          -> 3
missing program -> 127
not executable  -> 126
bad docker flag -> 125`,
      },
    ],
    interview: [
      {
        q: "Why does my container exit immediately after docker run -d?",
        a: "A container lives only as long as its **main process (PID 1)**. If that process finishes, the container stops. Common causes: the image's default command is a shell (`bash`) that exits because there's no terminal attached; the app crashed on startup (check `docker logs` and the exit code in `docker ps -a`); or the app daemonizes itself (forks into the background and the foreground process exits, as `nginx` or `service x start` would without `daemon off`). Fix it by running the app in the **foreground** as PID 1. For a throwaway shell, use `docker run -it IMAGE bash`.",
        freq: "very-common",
      },
      {
        q: "What's the difference between docker stop and docker kill?",
        a: "`docker stop` sends **SIGTERM** to PID 1, giving the app a chance to shut down gracefully (finish requests, flush data, close connections), then sends **SIGKILL** after a grace period (10 s by default, `-t` to change it, or `STOPSIGNAL`/`stop_grace_period` in config). `docker kill` sends **SIGKILL** immediately (or another signal with `-s`). SIGKILL can't be caught, so the process dies at once and the exit code is 137. Prefer stop; use kill for a hung process.",
        freq: "common",
      },
      {
        q: "docker exec vs docker attach vs docker run: what's the difference?",
        a: "`docker run` creates and starts a **new** container. `docker exec` runs an **additional** process inside an already running container, sharing its namespaces: the standard way to get a debugging shell (`docker exec -it web sh`). `docker attach` connects your terminal to the **main process's** stdin/stdout, so typing Ctrl-C there sends the signal to PID 1 and can stop the container; it's rarely what you want. Note that `exec` processes aren't restarted and don't keep the container alive.",
        freq: "common",
      },
      {
        q: "A container exited with code 137. What does that tell you?",
        a: "137 = 128 + 9: the process was killed by **SIGKILL**. Three usual causes: `docker kill`/`docker rm -f`; `docker stop` timed out because the app ignored SIGTERM; or the kernel's **OOM killer** fired because the container exceeded its memory limit. Check `docker inspect -f '{{.State.OOMKilled}}' NAME`: true means it ran out of memory, so raise the limit or fix the leak. In Kubernetes the same thing shows as `OOMKilled` with exit code 137.",
        freq: "very-common",
      },
    ],
    quiz: [
      {
        q: "You run `docker run -d ubuntu:24.04` and it exits right away. Why?",
        options: ["The image is broken", "Its default command is bash, which exits immediately with no terminal attached", "-d is not a valid flag", "Ubuntu containers can't run in the background"],
        answer: 1,
        explain: "A container runs as long as its main process. bash with no terminal and nothing to do exits, so the container stops.",
      },
      {
        q: "Which command shows what a container's main process printed?",
        options: ["docker ps", "docker inspect", "docker logs", "docker exec"],
        answer: 2,
        explain: "docker logs shows the main process's stdout and stderr, even after the container has stopped.",
      },
      {
        q: "What does `docker stop web` do?",
        options: ["Deletes the container", "Sends SIGKILL immediately", "Sends SIGTERM, then SIGKILL if the process hasn't exited after 10 seconds", "Pauses the container"],
        answer: 2,
        explain: "stop is the graceful option: SIGTERM first, and SIGKILL only after the grace period.",
      },
      {
        q: "A container exited with code 127. What's the most likely cause?",
        options: ["Out of memory", "The command to run wasn't found in the image", "Docker was given a bad flag", "It was stopped with docker stop"],
        answer: 1,
        explain: "127 is the shell's \"command not found\". 125 is a Docker error, 126 \"not executable\", 137 SIGKILL.",
      },
      {
        q: "You stop a container and start it again with docker start. What happened to the files it wrote?",
        options: ["They're gone: start makes a new container", "They're still there: it's the same container with the same writable layer", "They moved to a volume", "Only files in /tmp survive"],
        answer: 1,
        explain: "start reuses the existing container. Only docker rm deletes the writable layer.",
      },
    ],
  },

  // ------------------------------------------------------------------ IMAGES
  {
    id: "dk-images",
    title: "Images, tags and registries",
    tagline: "What's inside an image, how names work (registry/repository:tag@digest), tags vs digests, pulling and pushing, multi-platform images, and cleaning up disk space.",
    difficulty: "beginner",
    minutes: 25,
    diagram: {
      title: "Where images live",
      nodes: [
        { id: "you", label: "You", kind: "client", x: 100, y: 280, sub: "docker CLI" },
        { id: "local", label: "Local image store", kind: "storage", x: 360, y: 280, sub: "docker images" },
        { id: "hub", label: "Docker Hub", kind: "registry", x: 680, y: 110, sub: "docker.io/library/node" },
        { id: "ghcr", label: "Your registry", kind: "registry", x: 680, y: 450, sub: "ghcr.io/you/shop" },
        { id: "index", label: "Image index", kind: "control", x: 880, y: 280, sub: "one tag → amd64 + arm64" },
      ],
      edges: [
        { from: "you", to: "local", label: "build · tag · run" },
        { from: "local", to: "hub", label: "pull" },
        { from: "local", to: "ghcr", label: "push / pull" },
        { from: "hub", to: "index", label: "node:20-slim" },
      ],
      flows: [
        {
          name: "docker pull node:20-slim",
          path: ["you", "local", "hub", "index"],
          steps: [
            "You ask for node:20-slim. The short name means docker.io/library/node:20-slim.",
            "Docker checks the local store first, then asks Docker Hub what the tag points to.",
            "The tag points to an image index listing one image per platform. Docker picks the one for your CPU and downloads only the layers you don't have yet.",
          ],
        },
        {
          name: "docker push ghcr.io/you/shop:1.4.2",
          path: ["you", "local", "ghcr"],
          steps: [
            "You tag your local image with the registry's address: docker tag shop ghcr.io/you/shop:1.4.2 (after docker login ghcr.io).",
            "docker push uploads the layers the registry doesn't have yet, then the manifest that lists them. Anyone with access can now pull exactly that image.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
An image is like a **LEGO set in a box**. Inside there are bags of pieces (the **layers**) and an instruction booklet (the **config**: what to run, which settings). The box has a **label** on the outside, like "node, version 20, small edition": that's the **tag**.

Tags are sticky notes. You can stick a second note on the same box ("my-favourite"), and you can move a note from an old box to a new one. That's why a tag like \`latest\` can mean a different box tomorrow. Every box also has a **serial number** printed on it that can never change: the **digest**. If you want exactly the same box every time, use the serial number.

A **registry** is the toy shop where boxes live. \`docker pull\` brings a box home, \`docker push\` puts yours on the shelf for others.

## Image names, decoded
\`ghcr.io/acme/shop:1.4.2\` has three parts:
- **registry**: \`ghcr.io\`. Leave it out and Docker assumes Docker Hub (\`docker.io\`).
- **repository**: \`acme/shop\`. Official images on Docker Hub live under \`library/\`, so \`node\` is really \`docker.io/library/node\`.
- **tag**: \`1.4.2\`. Leave it out and you get \`latest\`, which is just a tag name, not a promise of anything.

You can also pin a **digest**: \`node@sha256:2cf067cf...\`. A digest is the SHA-256 hash of the image's manifest, so it identifies the exact content and can never point to anything else.

## What's inside an image
An image is a small JSON **manifest** that lists:
- a **config**: the default command (\`CMD\`, \`ENTRYPOINT\`), environment variables, working directory, user, exposed ports, labels, and the history of how it was built;
- an ordered list of **layers**: tarballs of files. Each Dockerfile instruction that changes files adds one. At runtime they're stacked on top of each other (Part 4 shows how).

Every piece is **content-addressed**: its name is the hash of its bytes. So two images built on \`node:20-slim\` store its layers **once**, pulls only download layers you don't have, and corruption is detected.

## Tags move, digests don't
| | Tag (\`node:20\`) | Digest (\`node@sha256:...\`) |
|---|---|---|
| Human-friendly | yes | no |
| Can change | yes: \`node:20\` is updated with every Node 20.x release and security patch | never |
| Use for | development, reading | production deploys, reproducible builds |

A common production pattern: build an image, push it with an immutable tag like the git commit (\`shop:sha-3f9c2ab\`) and a version (\`shop:1.4.2\`), and deploy by digest or by the commit tag. **Never deploy \`latest\`**: you can't tell what's running or roll back to "the previous latest".

## One tag, many CPUs
Your laptop might be an Apple Silicon Mac (arm64) and your server an Intel machine (amd64). A tag like \`node:20-slim\` points to an **image index** (a "manifest list") with one image per platform, and Docker pulls the one that matches your CPU. You can ask for another with \`--platform linux/amd64\`; Docker runs it under emulation, which works but is slower. If an image exists for only one platform, running it on the other fails with \`exec format error\` (no emulation) or shows a platform warning. Part 5 shows how to build multi-platform images with \`docker buildx\`.

## Everyday image commands
| Command | What it does |
|---|---|
| \`docker pull node:20-slim\` | download (only missing layers) |
| \`docker images\` / \`docker image ls\` | list local images |
| \`docker image inspect IMAGE\` | the config and layers as JSON |
| \`docker history IMAGE\` | the instruction behind each layer, and its size |
| \`docker tag SRC NEW\` | add another name to an image |
| \`docker login REGISTRY\` then \`docker push NAME\` | upload |
| \`docker rmi IMAGE\` | remove a tag (the image goes when its last tag does and no container uses it) |
| \`docker system df\` | disk used by images, containers, volumes and build cache |
| \`docker image prune\` / \`docker system prune\` | delete unused images / everything unused |

## Choosing a base image
Start from an **official image** (\`node\`, \`python\`, \`golang\`, \`postgres\`, \`nginx\`) or a vendor's verified image. Prefer the **slim** variants (Debian with fewer packages) or **alpine** (tiny, but uses musl libc instead of glibc, which occasionally breaks native libraries). For compiled languages, ship on **distroless** or even \`scratch\` (Part 2). Pin a specific version tag (\`node:20.18-slim\`) rather than \`node\` or \`latest\`.`,
    keyPoints: [
      "An image name is registry/repository:tag. No registry means Docker Hub; no tag means latest, which is only a convention.",
      "An image is a manifest pointing to a config (command, env, user...) and an ordered list of content-addressed layers.",
      "Tags are movable labels; digests (sha256:...) identify exact content. Deploy by digest or by an immutable tag, never latest.",
      "One tag can point to an index with images for several CPU architectures; Docker pulls the one matching your machine.",
      "Layers are shared between images and only missing ones are downloaded. docker system df and prune keep disk usage in check.",
    ],
    code: [
      {
        title: "A tag is a sticky note",
        docker: true,
        images: ["node:20-slim"],
        vary: ["[0-9a-f]{12}"],
        variants: [{ lang: "bash", code: `# A tag is a sticky note on an image. Add a second note to the same image:
docker tag node:20-slim quest-node:my-label

short_id() { docker image inspect -f '{{.Id}}' "$1" | cut -c 8-19; }
echo "node:20-slim       -> $(short_id node:20-slim)"
echo "quest-node:my-label -> $(short_id quest-node:my-label)"

# Removing a tag only peels off the sticky note; the image stays.
docker rmi quest-node:my-label
echo "node:20-slim       -> $(short_id node:20-slim)"` }],
        explain: `- \`docker tag\` doesn't copy anything: both names show the **same image ID** (the first 12 characters of its digest).
- \`docker rmi\` on one name prints \`Untagged\`: it peeled off a note. The image itself is deleted only when its last tag is removed and no container uses it.
- This is also how pushing works: you tag a local image with your registry's address (\`ghcr.io/you/app:1.0\`), then \`docker push\` that name.`,
        output: `node:20-slim       -> 2cf067cfed83
quest-node:my-label -> 2cf067cfed83
Untagged: quest-node:my-label
node:20-slim       -> 2cf067cfed83`,
      },
      {
        title: "Look inside an image",
        docker: true,
        images: ["node:20-slim"],
        vary: ["layers:\\s+\\d+", "NODE_VERSION=\\S+", "YARN_VERSION=\\S+"],
        variants: [{ lang: "bash", code: `# An image is a stack of read-only layers plus a small config: what to run, where, with which env.
docker image inspect node:20-slim --format 'layers:      {{len .RootFS.Layers}}'
docker image inspect node:20-slim --format 'default cmd: {{json .Config.Cmd}}'
docker image inspect node:20-slim --format 'entrypoint:  {{json .Config.Entrypoint}}'
docker image inspect node:20-slim --format '{{range .Config.Env}}env:         {{println .}}{{end}}'` }],
        explain: `- \`docker image inspect\` prints the image's config as JSON; \`--format\` picks fields with Go templates (\`len\`, \`json\` and \`range\` are template functions).
- \`RootFS.Layers\` lists the layer digests: this image is a stack of a few tarballs.
- The config says what a container does when you don't give it a command: run \`docker-entrypoint.sh node\`. The **entrypoint** wraps the **cmd** (Part 2 explains both).
- The environment variables are baked into the image and every container inherits them. That's how \`PATH\` finds \`node\`.`,
        output: `layers:      5
default cmd: ["node"]
entrypoint:  ["docker-entrypoint.sh"]
env:         PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
env:         NODE_VERSION=20.20.2
env:         YARN_VERSION=1.22.22`,
      },
      {
        title: "One tag, the right CPU",
        docker: true,
        images: ["node:20-slim", "ubuntu:24.04"],
        vary: ["linux/(arm64|amd64)", "^(aarch64|x86_64)$"],
        variants: [{ lang: "bash", code: `# Images are built for one CPU architecture. A tag like node:20-slim points to an index
# with one image per platform, and Docker pulls the one that matches your machine.
docker image inspect node:20-slim --format 'node:20-slim is built for {{.Os}}/{{.Architecture}}'
docker run --rm node:20-slim uname -m

# You can ask for another platform; Docker runs it under emulation (slower, but it works).
docker run --rm --platform linux/amd64 ubuntu:24.04 uname -m` }],
        explain: `- On an Apple Silicon Mac this prints \`arm64\` / \`aarch64\`; on an Intel or AMD machine, \`amd64\` / \`x86_64\`. Same tag, different image, chosen for your CPU.
- \`--platform linux/amd64\` forces the Intel version. On an arm64 machine Docker runs it through an emulator: it works, it's just slower. That's handy for testing an image you'll deploy to amd64 servers.
- If you build an image on an M-series Mac and push it, it's **arm64-only** by default, and an amd64 server will fail with \`exec format error\`. Build for both with \`docker buildx build --platform linux/amd64,linux/arm64\` (Part 5).`,
        output: `node:20-slim is built for linux/arm64
aarch64
x86_64`,
      },
    ],
    interview: [
      {
        q: "What's the difference between an image tag and a digest? Which should production use?",
        a: "A **tag** is a mutable, human-readable pointer (`node:20`, `shop:1.4.2`, `latest`): the registry can move it to a new image at any time. A **digest** (`sha256:...`) is the hash of the image manifest, so it always identifies exactly the same content. Production should deploy something **immutable**: the digest, or a tag that your process guarantees is never overwritten (the git SHA). That gives reproducible deploys, reliable rollbacks and an audit trail of what ran. Avoid `latest`: it's not even guaranteed to be the newest image, it's just the default tag name.",
        freq: "very-common",
      },
      {
        q: "How are images stored and transferred efficiently?",
        a: "An image is a **manifest** listing a config blob and an ordered list of **layer** blobs, each addressed by the SHA-256 of its content. Because identical content has an identical address, layers are **deduplicated**: images sharing a base store and transfer it once. `docker pull` fetches the manifest, then downloads only layers missing locally (in parallel, compressed); `docker push` uploads only layers the registry lacks (cross-repository mounts avoid even that). Content addressing also verifies integrity: a corrupted download won't match its digest.",
        freq: "common",
      },
      {
        q: "Your image runs on your M-series Mac but fails on the server with \"exec format error\". Why?",
        a: "The image was built for **arm64** (your Mac's architecture) and the server is **amd64**, so its binaries are for the wrong CPU. Fix: build a **multi-platform** image with `docker buildx build --platform linux/amd64,linux/arm64 --push`, which produces an image index with both variants (using QEMU emulation or native builders for each), or build for the target only with `--platform linux/amd64`. Check what an image supports with `docker buildx imagetools inspect` or `docker image inspect --format '{{.Architecture}}'`.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What does the image name `node:20-slim` expand to?",
        options: ["node.org/20-slim", "docker.io/library/node:20-slim", "localhost/node:20-slim", "github.com/node/20-slim"],
        answer: 1,
        explain: "No registry means Docker Hub (docker.io), and official images live under library/.",
      },
      {
        q: "You deploy `shop:latest` today and again next week. Is it the same image?",
        options: ["Always", "Not necessarily: latest is a movable tag", "Only on Linux", "Only if the registry is Docker Hub"],
        answer: 1,
        explain: "Tags can be moved to a new image at any time. Pin a digest or an immutable tag for reproducible deploys.",
      },
      {
        q: "Two of your images are both built FROM node:20-slim. How many copies of node:20-slim's layers are stored?",
        options: ["Two", "One: layers are content-addressed and shared", "None", "It depends on the tag"],
        answer: 1,
        explain: "Identical layers have identical digests, so they're stored and downloaded once.",
      },
      {
        q: "What happens when you run `docker rmi` on one of two tags pointing to the same image?",
        options: ["The image is deleted", "Only that tag is removed; the image stays because another tag points to it", "Both tags are removed", "Docker refuses"],
        answer: 1,
        explain: "rmi untags. The image's data is removed only when no tags (and no containers) reference it.",
      },
      {
        q: "What is an image index (manifest list)?",
        options: ["A list of all images on Docker Hub", "One tag mapping to images for several platforms (amd64, arm64...)", "The image's layer history", "A search index of image names"],
        answer: 1,
        explain: "It lets one tag serve every CPU architecture: Docker picks the matching image when it pulls.",
      },
    ],
  },

  // ------------------------------------------------------------------ PORTS & ENV
  {
    id: "dk-ports-env",
    title: "Ports, environment and configuration",
    tagline: "Publish ports with -p, why apps must listen on 0.0.0.0, configure containers with -e and --env-file, and the 12-factor way to keep config out of images.",
    difficulty: "beginner",
    minutes: 20,
    visualizers: ["dockernet"],
    concept: `## Explain it like I'm 10 🧸
Every container lives in its own little house with its own front doors (ports). Port 3000 is a door **inside** the container's house. Your laptop is a different house, with its own doors.

\`-p 8080:3000\` is like building a **tunnel**: "when someone knocks on door 8080 of my laptop, lead them through the tunnel to door 3000 of the container". Without the tunnel, nobody outside the container can reach it.

There's one trap. If the app inside says "I'll only answer people who are already **inside my house**" (that's listening on \`127.0.0.1\`, "localhost"), then visitors coming through the tunnel are ignored, because they arrive from outside. The app has to say "I'll answer anyone who knocks" (\`0.0.0.0\`).

Settings are like **notes you slip under the door** when the container starts: "your colour is blue", "the database is over there". Same image, different notes, different behaviour. That's **environment variables**.

## Publishing ports
A container has its own network namespace, so a server listening on port 3000 inside it isn't reachable from your laptop until you **publish** the port:

| Flag | Meaning |
|---|---|
| \`-p 8080:3000\` | host port 8080 → container port 3000, on every host interface |
| \`-p 127.0.0.1:8080:3000\` | only from this machine (safer on a server) |
| \`-p 3000\` | a random free host port; find it with \`docker port NAME\` |
| \`-p 5353:53/udp\` | UDP instead of TCP |
| \`-P\` | publish every \`EXPOSE\`d port to random host ports |

The order is always **host:container** ("outside:inside"). \`EXPOSE 3000\` in a Dockerfile publishes nothing: it's documentation (and what \`-P\` uses).

Under the hood, on Linux Docker adds a NAT rule that rewrites packets arriving at host:8080 to container-ip:3000. The visualizer's \`-p 8080:80\` path shows each hop.

**Security note:** \`-p 8080:3000\` listens on *all* interfaces, and Docker's NAT rules bypass simple host firewalls like \`ufw\`. A database published as \`-p 5432:5432\` on a cloud server is on the internet. Bind to \`127.0.0.1\`, or don't publish at all and let other containers reach it over a Docker network (Part 3).

## Listen on 0.0.0.0
Inside a container, \`localhost\`/\`127.0.0.1\` means the **container's own loopback**. Traffic forwarded from a published port arrives on the container's network card (\`eth0\`), so an app bound to 127.0.0.1 never sees it: you get "connection reset" or "empty reply". Bind to **0.0.0.0** (all interfaces). Many frameworks default to localhost in development mode: Flask (\`--host 0.0.0.0\`), Vite (\`--host\`), Rails (\`-b 0.0.0.0\`), Next.js dev (\`-H 0.0.0.0\`).

## Configuration with environment variables
The **12-factor app** rule: keep configuration (database URLs, feature flags, log levels) **out of the image** and pass it in at run time. One image then runs unchanged in development, staging and production.
- \`-e NAME=value\` sets one variable; \`-e NAME\` copies it from your shell.
- \`--env-file app.env\` loads a file of \`NAME=value\` lines (no quotes, no \`export\`).
- \`ENV\` in a Dockerfile sets **defaults**; anything given at run time overrides them.
- Order of precedence: \`-e\` > \`--env-file\` > the image's \`ENV\`.

Environment variables are fine for ordinary settings but a poor home for **secrets**: they show up in \`docker inspect\`, in \`/proc/*/environ\`, in crash reports and in child processes. Part 5 covers mounting secrets as files.

## Other run-time settings worth knowing
- \`-v\` / \`--mount\`: attach storage (Part 3).
- \`--network\`: which network to join (Part 3).
- \`--restart unless-stopped\`: restart automatically after crashes and reboots (Part 5).
- \`--memory 512m --cpus 1.5\`: resource limits (Part 4 and 5).
- \`-w /app\`: the working directory; \`-u 1000\`: the user to run as.`,
    keyPoints: [
      "Containers are reachable from outside only through published ports: -p HOST:CONTAINER, e.g. -p 8080:3000.",
      "EXPOSE in a Dockerfile only documents a port; it doesn't publish anything.",
      "Apps in containers must listen on 0.0.0.0, not 127.0.0.1, or forwarded traffic never reaches them.",
      "Published ports listen on all interfaces and bypass simple host firewalls: bind to 127.0.0.1 or don't publish internal services.",
      "Pass configuration at run time with -e and --env-file (they override the image's ENV), so one image works in every environment.",
    ],
    code: [
      {
        title: "Publish a port and call the app from your laptop",
        docker: true,
        images: ["node:20-slim"],
        files: [{ path: "server.js", lang: "javascript", code: `const http = require("http");

const greeting = process.env.GREETING || "Hello";
const server = http.createServer((req, res) => {
  res.end(\`\${greeting} from container \${process.env.HOSTNAME}! You asked for \${req.url}\\n\`);
});

// 0.0.0.0 means "every network card", including the one Docker forwards traffic to.
server.listen(3000, "0.0.0.0", () => console.log("listening on 0.0.0.0:3000"));` }],
        variants: [{ lang: "bash", code: `# -p 8080:3000   = "when someone knocks on port 8080 of my laptop, send them to port 3000 in the container"
# -v $PWD:/app  = make this folder (with server.js) visible inside the container at /app
docker run -d --name quest-hello --hostname box1 -p 8080:3000 -e GREETING=Howdy \\
  -v "$PWD":/app node:20-slim node /app/server.js > /dev/null
sleep 1

curl -s http://localhost:8080/
curl -s http://localhost:8080/pizza
docker port quest-hello
docker logs quest-hello` }],
        explain: `- \`-v "$PWD":/app\` makes this folder (with \`server.js\`) appear inside the container at \`/app\`, so we can run our own code without building an image yet. That's a **bind mount** (Part 3).
- \`-p 8080:3000\` connects the laptop's port 8080 to the container's 3000. \`curl localhost:8080\` goes through that tunnel.
- \`-e GREETING=Howdy\` changes the app's behaviour without touching its code. \`--hostname box1\` sets \`process.env.HOSTNAME\`.
- \`docker port\` shows the mappings: the same port is published on IPv4 (\`0.0.0.0\`) and IPv6 (\`[::]\`).`,
        output: `Howdy from container box1! You asked for /
Howdy from container box1! You asked for /pizza
3000/tcp -> 0.0.0.0:8080
3000/tcp -> [::]:8080
listening on 0.0.0.0:3000`,
      },
      {
        title: "The 127.0.0.1 trap",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# The classic bug: the app listens on 127.0.0.1 ("only me") instead of 0.0.0.0 ("everyone").
docker run -d --name quest-shy -p 8081:3000 node:20-slim node -e "
  require('http').createServer((q, s) => s.end('hi\\n')).listen(3000, '127.0.0.1');" > /dev/null
sleep 1

curl -s --max-time 3 http://localhost:8081/ || echo "from the laptop: request failed"
# From inside the container, localhost is the container itself, so it works there:
docker exec quest-shy node -e "fetch('http://127.0.0.1:3000').then(r => r.text()).then(t => process.stdout.write('from inside: ' + t))"` }],
        explain: `- The server listens on \`127.0.0.1\`, the container's private loopback. The port is published, but forwarded traffic arrives on the container's \`eth0\`, where nothing is listening, so the request from the laptop fails.
- From **inside** the container, 127.0.0.1 is the container itself, so \`docker exec\` reaches the server fine. That's why this bug is so confusing: "it works when I test it in the container!"
- Fix: \`listen(3000, "0.0.0.0")\`, or the equivalent flag for your framework.`,
        output: `from the laptop: request failed
from inside: hi`,
      },
      {
        title: "Configure with -e and --env-file",
        docker: true,
        images: ["node:20-slim"],
        files: [{ path: "app.env", lang: "properties", code: `# one VAR=value per line; no quotes needed
APP_COLOR=blue
APP_MODE=production
APP_WORKERS=4` }],
        variants: [{ lang: "bash", code: `show='console.log(\`color=\${process.env.APP_COLOR} mode=\${process.env.APP_MODE} workers=\${process.env.APP_WORKERS}\`)'

# 1. one variable at a time with -e
docker run --rm -e APP_COLOR=red node:20-slim node -e "$show"
# 2. a whole file with --env-file
docker run --rm --env-file app.env node:20-slim node -e "$show"
# 3. both: -e wins over the file, so you can override one setting
docker run --rm --env-file app.env -e APP_MODE=debug node:20-slim node -e "$show"` }],
        explain: `- The same image, three configurations. Unset variables are simply \`undefined\` in the app.
- \`--env-file\` reads \`NAME=value\` lines; comment lines start with \`#\`. Keep real env files out of git (and out of images: list them in \`.dockerignore\`).
- When both are given, \`-e\` wins: handy for overriding one setting from a shared file.`,
        output: `color=red mode=undefined workers=undefined
color=blue mode=production workers=4
color=blue mode=debug workers=4`,
      },
    ],
    interview: [
      {
        q: "Your app runs in a container with -p 8080:3000, but curl localhost:8080 fails. How do you debug it?",
        a: "Work from the inside out. 1) `docker ps`: is the container running, and is the mapping `0.0.0.0:8080->3000/tcp` there? 2) `docker logs`: did the app start, and on which port? 3) `docker exec NAME curl -s localhost:3000` (or `wget`/a language one-liner): does it answer inside? 4) If it answers inside but not outside, it's almost always bound to **127.0.0.1** instead of 0.0.0.0. 5) Check the port order (`-p host:container`, not reversed), that the app's port matches the container side, and that nothing else holds host port 8080. On a remote server also check cloud security groups.",
        freq: "very-common",
      },
      {
        q: "What's the difference between EXPOSE and -p?",
        a: "`EXPOSE` is image **metadata**: it documents which port the app listens on and is used by `docker run -P` to publish exposed ports to random host ports. It opens nothing by itself. `-p` (or `ports:` in Compose) actually **publishes** a port: it creates the host → container forwarding (NAT rules on Linux). Containers on the same Docker network can reach each other on any listening port without either.",
        freq: "common",
      },
      {
        q: "How should you pass configuration to a containerized app?",
        a: "Follow 12-factor: build **one immutable image** and inject configuration at run time, typically as **environment variables** (`-e`, `--env-file`, Compose `environment:`/`env_file:`, Kubernetes ConfigMaps). Keep defaults in the image's `ENV`, and fail fast at startup if required settings are missing. For **secrets**, prefer files mounted at run time (Docker/Compose secrets, Kubernetes Secrets as volumes, a secrets manager) over env vars, which leak through `docker inspect`, `/proc`, logs and crash dumps. Never bake configuration or secrets into the image.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In `-p 8080:3000`, which number is the container's port?",
        options: ["8080", "3000", "Both", "Neither: it's a range"],
        answer: 1,
        explain: "The order is host:container. Traffic to the host's 8080 is forwarded to the container's 3000.",
      },
      {
        q: "An app listens on 127.0.0.1:3000 inside a container started with -p 8080:3000. What happens when you open localhost:8080?",
        options: ["It works", "The request fails: forwarded traffic arrives on eth0, not the container's loopback", "Docker rewrites the app's address", "It works only with --network host"],
        answer: 1,
        explain: "Inside the container, 127.0.0.1 is the container's own loopback. Listen on 0.0.0.0.",
      },
      {
        q: "What does EXPOSE 3000 in a Dockerfile do?",
        options: ["Publishes port 3000 on the host", "Opens the firewall", "Documents the port (and is used by -P); it publishes nothing", "Makes the app listen on 3000"],
        answer: 2,
        explain: "Only -p/-P (or ports: in Compose) publish ports.",
      },
      {
        q: "The image sets ENV MODE=production. You run it with --env-file app.env (MODE=staging) and -e MODE=debug. What is MODE?",
        options: ["production", "staging", "debug", "It's an error"],
        answer: 2,
        explain: "-e beats --env-file, which beats the image's ENV defaults.",
      },
      {
        q: "Why is `-p 5432:5432` for a database on a cloud server risky?",
        options: ["It's slower", "It listens on all interfaces, and Docker's NAT rules can bypass simple host firewalls, exposing the database", "Postgres doesn't support it", "It disables authentication"],
        answer: 1,
        explain: "Bind to 127.0.0.1 or don't publish: other containers can reach the database over a Docker network.",
      },
    ],
  },
];
