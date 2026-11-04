import type { Lesson } from "../types";

// Docker, part 4: under the hood. Namespaces and cgroups, overlayfs, the engine, containerd, runc and OCI.

export const dockerPart4: Lesson[] = [
  // ------------------------------------------------------------------ NAMESPACES & CGROUPS
  {
    id: "docker-internals",
    part: "Part 4 · Under the hood",
    title: "What a container really is: namespaces and cgroups",
    tagline: "There is no \"container\" in the kernel: a process, seven kinds of namespaces, cgroup limits, capabilities and seccomp. See it from inside and outside, share namespaces like a Kubernetes pod, and build one with unshare.",
    difficulty: "intermediate",
    minutes: 30,
    visualizers: ["dockerrun"],
    concept: `## Explain it like I'm 10 🧸
A container is a normal program wearing two things:
- **Blinkers**, like a horse's: they limit what it can **see**. It sees only its own toys (files), its own friends (processes) and its own name tag (hostname). Those blinkers are **namespaces**.
- A **lunch budget**: "you may use this much memory and this much CPU, no more". That budget is a **cgroup**.

The program isn't really alone or small. It's running on the same computer as everything else, with the same kernel. It just can't see the others, and it can't take more than its share. Take off the blinkers and the budget, and it's an ordinary program again.

## There is no "container" in the kernel
Linux has no container object. A container is a **process** (and its children) started with:
- **namespaces**, which change what it can see;
- a **cgroup**, which limits what it can use;
- a **root filesystem** from the image (overlayfs, next lesson) set up with \`pivot_root\`;
- reduced privileges: dropped **capabilities**, a **seccomp** filter, an AppArmor or SELinux profile, and often \`no_new_privs\`.

Step through the visualizer to see which component sets up each piece when you type \`docker run\`.

## The namespaces
| Namespace | Isolates | Effect in a container |
|---|---|---|
| **pid** | process IDs | the app is PID 1 and sees only its own processes |
| **mnt** | mount points | its own root filesystem, \`/proc\`, volumes |
| **net** | network stack | its own interfaces, IPs, ports, routing table, firewall rules |
| **uts** | hostname | its own hostname |
| **ipc** | System V IPC, POSIX queues | can't touch other processes' shared memory |
| **user** | user and group IDs | root inside can map to an unprivileged user outside (rootless Docker, \`userns-remap\`) |
| **cgroup** | the cgroup tree view | sees its own cgroup as \`/\` |

They're created with the \`clone()\` or \`unshare()\` system calls, joined with \`setns()\`, and you can list a process's namespaces in \`/proc/PID/ns/\`. Two processes are in the same namespace when those links point to the same inode. Docker can **share** namespaces between containers: \`--network container:X\`, \`--pid container:X\`, \`--ipc\`. A Kubernetes **pod** is exactly that: several containers sharing net (and optionally pid and ipc) namespaces, held open by a tiny "pause" container.

## cgroups: the limits
Control groups (v2 on modern systems) are a filesystem at \`/sys/fs/cgroup\`. Each container gets a directory, and Docker writes your flags into its files:
| Flag | cgroup file | What happens at the limit |
|---|---|---|
| \`--memory 512m\` | \`memory.max\` | the kernel reclaims memory, then the **OOM killer** kills a process: exit 137, \`OOMKilled: true\` |
| \`--cpus 1.5\` | \`cpu.max\` (\`150000 100000\`) | the container is **throttled**: it gets 150 ms of CPU per 100 ms, never killed |
| \`--cpu-shares\` | \`cpu.weight\` | relative priority, only matters when CPUs are busy |
| \`--pids-limit 100\` | \`pids.max\` | \`fork()\` fails: protection against fork bombs |
| \`--device-read-bps\` ... | \`io.max\` | I/O is throttled |
Without flags, a container may use the whole machine. Kubernetes \`resources.limits\` are these same files.

## Root in a container is a reduced root
The kernel splits root's powers into ~40 **capabilities**. Docker keeps a short list (\`CHOWN\`, \`NET_BIND_SERVICE\`, \`KILL\`, \`SETUID\`...) and drops the dangerous ones (\`SYS_ADMIN\` for mounting, \`SYS_TIME\`, \`SYS_MODULE\`, \`NET_ADMIN\`...). A default **seccomp** profile blocks around 40 risky system calls on top. \`--privileged\` turns all of that off and gives the container every device: never use it for normal apps (Part 5).

## Why the kernel matters
All containers share the host kernel. That's why they're fast and light, and also why a kernel vulnerability can break isolation for every container on a host. Workloads that run untrusted code use stronger sandboxes: **gVisor** (a user-space kernel intercepting syscalls) or micro-VMs like **Firecracker** and **Kata Containers** (each container gets a tiny VM with its own kernel).`,
    keyPoints: [
      "A container is an ordinary process with namespaces (what it sees), a cgroup (what it uses), its own root filesystem and reduced privileges.",
      "pid, mnt, net, uts, ipc, user and cgroup namespaces; the same process has one PID inside the container and another on the host.",
      "Containers can share namespaces (--network/--pid container:X): that's what a Kubernetes pod is.",
      "docker run --memory, --cpus and --pids-limit become cgroup files: exceed memory and you're OOM-killed (137); exceed CPU and you're throttled.",
      "Root in a container has most capabilities dropped and a seccomp filter; all containers share the host kernel, so use gVisor or micro-VMs for untrusted code.",
    ],
    code: [
      {
        title: "One process, two PIDs",
        docker: true,
        images: ["node:20-slim"],
        vary: ["PID \\d+ is"],
        variants: [{ lang: "bash", code: `docker run -d --name quest-sleeper node:20-slim sleep 1234 > /dev/null

# Inside its PID namespace, sleep is process number 1...
echo "inside the container: PID 1 is '$(docker exec quest-sleeper cat /proc/1/cmdline | tr '\\0' ' ')'"

# ...but on the host (Docker's Linux machine) it's an ordinary process with an ordinary PID
pid=$(docker inspect -f '{{.State.Pid}}' quest-sleeper)
echo "on the host: PID $pid is '$(docker run --rm --pid host node:20-slim cat /proc/$pid/cmdline | tr '\\0' ' ')'"` }],
        explain: `- Inside its PID namespace, \`sleep 1234\` is process **1**.
- \`docker inspect -f '{{.State.Pid}}'\` gives its PID in the **host's** namespace: an ordinary number like any other process. (On Docker Desktop the "host" is the Linux VM.)
- \`--pid host\` runs a second container *without* a new PID namespace, so it can read the host's \`/proc\`, where it finds the very same \`sleep\` process. Nothing magic: just a process seen through two windows.`,
        output: `inside the container: PID 1 is 'sleep 1234 '
on the host: PID 8684 is 'sleep 1234 '`,
      },
      {
        title: "Share namespaces like a Kubernetes pod",
        docker: true,
        images: ["node:20-slim", "node:20"],
        vary: ["^\\s+\\d+ ps$"],
        variants: [{ lang: "bash", code: `ns() { docker run --rm "$@" node:20-slim readlink /proc/self/ns/pid /proc/self/ns/net | tr '\\n' ' '; }

docker run -d --name quest-main node:20-slim sleep 60 > /dev/null
main=$(docker exec quest-main readlink /proc/self/ns/pid /proc/self/ns/net | tr '\\n' ' ')
other=$(ns)
shared=$(ns --pid container:quest-main --network container:quest-main)

[ "$main" != "$other" ]  && echo "a new container gets NEW pid and net namespaces"
[ "$main" = "$shared" ]  && echo "--pid/--network container:X JOINS X's namespaces (that's a Kubernetes pod!)"

# Joined containers see each other's processes and share localhost
docker run --rm --pid container:quest-main node:20 ps -e -o pid,comm` }],
        explain: `- \`readlink /proc/self/ns/pid\` prints something like \`pid:[4026532412]\`: the namespace's inode number. Same number = same namespace.
- A normal new container gets new numbers. With \`--pid container:quest-main --network container:quest-main\` it **joins** quest-main's namespaces instead.
- The joined container sees quest-main's \`sleep\` as PID 1 next to its own \`ps\`, and they'd share \`localhost\` too. Kubernetes builds every pod this way, which is why containers in a pod talk over \`localhost\`.`,
        output: `a new container gets NEW pid and net namespaces
--pid/--network container:X JOINS X's namespaces (that's a Kubernetes pod!)
  PID COMMAND
    1 sleep
   21 ps`,
      },
      {
        title: "docker run flags are cgroup files",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# docker run flags become numbers in the container's cgroup files
docker run --rm --memory 64m --cpus 0.5 --pids-limit 50 node:20-slim sh -c '
  echo "memory.max = $(cat /sys/fs/cgroup/memory.max)   (64 MiB in bytes)"
  echo "cpu.max    = $(cat /sys/fs/cgroup/cpu.max)   (50 ms of CPU every 100 ms)"
  echo "pids.max   = $(cat /sys/fs/cgroup/pids.max)"'

# no flags = no limits
docker run --rm node:20-slim cat /sys/fs/cgroup/memory.max` }],
        explain: `- Inside the container, \`/sys/fs/cgroup\` is the container's own cgroup (thanks to the cgroup namespace), and its files hold the limits Docker wrote: 64 MiB, a CPU quota of 50 ms per 100 ms period, at most 50 processes.
- Without flags, \`memory.max\` is \`max\`: no limit at all. In production always set limits, or one leaky container can starve the whole machine.`,
        output: `memory.max = 67108864   (64 MiB in bytes)
cpu.max    = 50000 100000   (50 ms of CPU every 100 ms)
pids.max   = 50
max`,
      },
      {
        title: "A container without Docker",
        docker: true,
        images: ["node:20"],
        vary: ["^\\s+\\d+ ps$"],
        variants: [{ lang: "bash", code: `# A "container" without Docker: the unshare tool asks the kernel for new namespaces.
# (Run inside a privileged container, because creating namespaces needs root.)
docker run --rm --privileged node:20 unshare --uts --pid --fork --mount-proc bash -c '
  hostname tiny-box
  echo "hostname: $(hostname)"
  echo "my PID:   $$"
  ps -e -o pid,comm
  echo "(that is every process in this PID namespace)"'` }],
        explain: `- \`unshare\` (from util-linux) creates new namespaces and runs a command in them: \`--uts\` for the hostname, \`--pid --fork\` so the child is PID 1, \`--mount-proc\` to mount a fresh \`/proc\` that shows only the new namespace.
- The result behaves like a tiny container: its own hostname, PID 1, and a process list with only itself in it. We run it inside a \`--privileged\` container only because creating namespaces needs root.
- Add a root filesystem, a cgroup and \`pivot_root\` and you have a real container runtime. The final project builds exactly that in Python.`,
        output: `hostname: tiny-box
my PID:   1
  PID COMMAND
    1 bash
    4 ps
(that is every process in this PID namespace)`,
      },
    ],
    interview: [
      {
        q: "What is a container, technically?",
        a: "A regular Linux process tree isolated and constrained by kernel features: **namespaces** (pid, mnt, net, uts, ipc, user, cgroup) give it its own view of processes, mounts, network, hostname and IDs; a **cgroup** limits CPU, memory, PIDs and I/O; its **root filesystem** is an image unpacked via overlayfs and switched to with `pivot_root`; and its privileges are reduced with dropped **capabilities**, a **seccomp** syscall filter, an LSM profile (AppArmor/SELinux) and `no_new_privs`. A runtime like runc sets all of that up and execs the entrypoint. There is no kernel object called a container.",
        freq: "very-common",
      },
      {
        q: "What happens when a container exceeds its memory limit? Its CPU limit?",
        a: "**Memory** (`memory.max`) is a hard limit: the kernel first tries to reclaim (page cache), then invokes the **OOM killer** inside the cgroup, which SIGKILLs a process, typically the main one: exit code 137, `State.OOMKilled=true` (Kubernetes: `OOMKilled`). Swap is controlled separately. **CPU** (`cpu.max` quota/period) is compressible: the container is **throttled**, not killed; it just gets less CPU time per period, which shows up as latency (`nr_throttled` in `cpu.stat`). That's why tight CPU limits on latency-sensitive services cause p99 spikes.",
        freq: "very-common",
      },
      {
        q: "How do namespaces relate to Kubernetes pods?",
        a: "A pod is a group of containers that **share namespaces**: always the network namespace (one IP, shared `localhost` and port space), plus UTS and IPC, and optionally the PID namespace (`shareProcessNamespace`). The kubelet first starts a tiny **pause** (sandbox) container that owns those namespaces, then starts each app container joined to them, the same as `docker run --network container:pause`. That's why sidecars can reach the app on localhost and why two containers in a pod can't both bind port 8080.",
        freq: "common",
      },
      {
        q: "Are containers a security boundary?",
        a: "A reasonable one, but weaker than VMs. All containers share the **host kernel**, so a kernel or runtime bug (e.g. runc CVE-2019-5736, Dirty Pipe) can allow an escape, and misconfiguration easily removes the boundary: `--privileged`, mounting `/var/run/docker.sock`, extra capabilities like `SYS_ADMIN`, host namespaces, or sensitive host paths. Defense in depth: non-root users, user namespaces/rootless mode, dropped capabilities, seccomp/AppArmor, read-only root filesystems, patched kernels, and for untrusted multi-tenant code a sandbox runtime (gVisor) or micro-VMs (Firecracker, Kata).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which kernel feature makes a container's app see itself as PID 1?",
        options: ["cgroups", "The PID namespace", "seccomp", "overlayfs"],
        answer: 1,
        explain: "The PID namespace gives the container its own process numbering, starting at 1.",
      },
      {
        q: "Which feature enforces `--memory 512m`?",
        options: ["The mount namespace", "A cgroup (memory.max)", "A capability", "The image config"],
        answer: 1,
        explain: "cgroups limit resource usage; namespaces only limit visibility.",
      },
      {
        q: "A container with `--cpus 0.5` runs a CPU-heavy loop. What happens?",
        options: ["It's killed with exit 137", "It's throttled to half a CPU, never killed", "It gets all CPUs when idle", "Docker restarts it"],
        answer: 1,
        explain: "CPU is a compressible resource: exceeding the quota means waiting, not dying. Memory is the one that kills.",
      },
      {
        q: "What does `--network container:web` share with the web container?",
        options: ["Its filesystem", "Its network namespace: same IP and localhost", "Its image", "Its cgroup limits"],
        answer: 1,
        explain: "Joining a namespace is how pods and debug sidecars work.",
      },
      {
        q: "Why can a kernel vulnerability affect every container on a host?",
        options: ["Containers share the host kernel", "Containers share one filesystem", "Docker runs as root", "Images are shared"],
        answer: 0,
        explain: "There's one kernel for all containers. VMs and micro-VMs give each workload its own kernel.",
      },
    ],
  },

  // ------------------------------------------------------------------ OVERLAYFS
  {
    id: "dk-overlayfs",
    title: "Copy-on-write: how image layers stack",
    tagline: "overlayfs lowerdir, upperdir and merged; copy-up and whiteouts; why containers share images for free, why deletes don't shrink images, docker diff, docker commit, and storage drivers.",
    difficulty: "advanced",
    minutes: 25,
    visualizers: ["overlayfs"],
    concept: `## Explain it like I'm 10 🧸
Imagine a stack of **transparent sheets** on an overhead projector. The bottom sheets are the image's layers: printed, and you're not allowed to draw on them. On top, every container gets its **own blank sheet**. Looking down through the stack, you see one picture: everything on all the sheets.

- Want to **change** something drawn on a bottom sheet? You can't touch it, so you trace that part onto your top sheet and change your copy. Your copy now covers the old one. (**copy-up**)
- Want to **erase** something on a bottom sheet? You put a little **white sticker** over it on your top sheet. It's still printed underneath; you just can't see it. (**whiteout**)
- Throw the container away? You throw away **only your top sheet**. The printed sheets are reused by every other container.

That's why starting a container is instant, and why ten containers from one image take almost no extra disk space.

## overlayfs in one picture
Docker's default storage driver is **overlay2** (newer Docker Desktop versions use containerd's snapshotter, which also uses overlayfs). A mount combines:
- **lowerdir**: one or more read-only directories: the image layers, top to bottom;
- **upperdir**: a writable directory: the container's layer;
- **workdir**: scratch space the kernel needs for atomic operations;
- **merged**: the combined view, which becomes the container's \`/\`.

Rules:
- **Read**: a lookup goes from the top layer down and the first layer that has the file wins. Reading from the image costs nothing extra.
- **Write to an image file**: **copy-up**. The kernel copies the *whole* file into upperdir, then modifies the copy. Changing one byte of a 500 MB file copies 500 MB (once).
- **Create**: new files go straight into upperdir.
- **Delete an image file**: a **whiteout** (a character device with number 0/0) in upperdir hides it. Deleting a directory and recreating it uses an **opaque** directory marker.
- **Rename** of directories from lower layers is emulated (copy-up of everything), which is slow.

## Consequences you'll meet in real life
- **Containers are cheap**: 100 containers from one 1 GB image use 1 GB plus 100 thin upper layers.
- **Deleting in a later layer never shrinks an image**: a Dockerfile's \`RUN rm -rf /big\` just adds whiteouts. Clean up in the same \`RUN\`, or use multi-stage builds.
- **Write-heavy data doesn't belong in the container layer**: copy-up and the extra filesystem layer cost performance, and the data dies with the container. Databases go in **volumes**, which bypass overlayfs entirely.
- **\`docker diff\`** lists a container's upper layer: \`A\` added, \`C\` changed, \`D\` deleted.
- **\`docker commit\`** freezes the upper layer into a new image layer. Useful to capture a broken container for debugging; never the way to build images (unreproducible, invisible changes, whiteouts and junk included).
- **Layer count**: each layer is one more lowerdir to search; modern kernels handle dozens, but don't go wild.

## Where it lives
On a Linux host with the classic overlay2 driver: \`/var/lib/docker/overlay2/<id>/{diff,merged,work}\`, and \`docker inspect -f '{{json .GraphDriver.Data}}' CONTAINER\` prints the exact lowerdir/upperdir/merged paths. With the containerd image store, snapshots live under containerd's directory instead. Either way, \`docker system df\` shows the space used.`,
    keyPoints: [
      "overlayfs stacks read-only image layers (lowerdir) under a per-container writable layer (upperdir) into one merged view.",
      "Reads go top-down and are free; the first write to an image file copies the whole file up; deletes create whiteouts that only hide the file.",
      "Containers share image layers, so they start instantly and use little disk; docker rm discards only the upper layer.",
      "Deleting files in a later Dockerfile layer never makes an image smaller, and write-heavy data belongs in volumes, which bypass overlayfs.",
      "docker diff shows a container's changes; docker commit freezes them into an image layer (for debugging, not for building images).",
    ],
    code: [
      {
        title: "An overlay mount by hand",
        docker: true,
        images: ["node:20"],
        variants: [{ lang: "bash", code: `docker run --rm --privileged node:20 bash -c '
  # overlayfs needs its writable dirs on a normal filesystem, so use a tmpfs
  mount -t tmpfs tmpfs /mnt && cd /mnt
  mkdir lower upper work merged

  # the read-only "image layer"
  echo "from the image" > lower/a.txt
  echo "from the image" > lower/b.txt

  # stack it: lower (read-only) + upper (writable) = merged (what the container sees)
  mount -t overlay overlay -o lowerdir=lower,upperdir=upper,workdir=work merged

  echo "changed by the container" > merged/a.txt   # copy-up: a.txt is copied to upper, then changed
  rm merged/b.txt                                  # whiteout: a marker in upper hides b.txt
  echo "brand new" > merged/c.txt                  # new files go straight to upper

  echo "--- merged (the container view)"; ls merged; cat merged/a.txt
  echo "--- lower (the image: untouched)"; ls lower; cat lower/a.txt
  echo "--- upper (the container layer)";  ls -l upper | awk "NR > 1 {print \\$1, \\$NF}"'` }],
        explain: `- We build the same structure Docker builds for every container: \`lower\` plays the image layer, \`upper\` the container layer, \`merged\` the container's view. (Privileged only because \`mount\` needs root.)
- Writing \`merged/a.txt\` **copied it up**: \`upper/a.txt\` holds the new content, and \`lower/a.txt\` still says "from the image".
- Deleting \`merged/b.txt\` created a **whiteout** in upper: the \`c---------\` entry is a character device, which overlayfs treats as "this file is deleted". \`b.txt\` is still in \`lower\`.
- New files like \`c.txt\` exist only in \`upper\`.`,
        output: `--- merged (the container view)
a.txt
c.txt
changed by the container
--- lower (the image: untouched)
a.txt
b.txt
from the image
--- upper (the container layer)
-rw-r--r-- a.txt
c--------- b.txt
-rw-r--r-- c.txt`,
      },
      {
        title: "docker diff and docker commit",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# Change some files inside a container
docker run --name quest-diff node:20-slim sh -c '
  echo "hello" > /tmp/new.txt
  rm /etc/debian_version
  echo "Welcome, captain" >> /etc/issue'

# docker diff lists the container's writable layer: A = added, C = changed, D = deleted
docker diff quest-diff | sort

# docker commit freezes that layer into a new image (handy for debugging, but use a Dockerfile for real images)
docker commit quest-diff quest-snapshot > /dev/null
docker run --rm quest-snapshot cat /tmp/new.txt` }],
        explain: `- The container ran, changed three files and exited. Its upper layer is kept until \`docker rm\`, so \`docker diff\` can list it: **A**dded \`/tmp/new.txt\`, **C**hanged \`/etc/issue\`, **D**eleted \`/etc/debian_version\`, plus the directories whose contents changed.
- \`docker commit\` turns that upper layer into a new image, and a container from it sees \`/tmp/new.txt\`. It's a handy way to capture a broken container's state for later investigation; for real images, write a Dockerfile so the change can be reviewed and rebuilt.`,
        output: `A /tmp/new.txt
C /etc
C /etc/issue
C /tmp
D /etc/debian_version
hello`,
      },
    ],
    interview: [
      {
        q: "How does Docker's layered filesystem work?",
        a: "Images are ordered, read-only layers; at run time a union filesystem (usually **overlayfs**, via the overlay2 driver or containerd's overlayfs snapshotter) mounts them as `lowerdir`s with a fresh writable `upperdir` per container, exposing a `merged` view as the container's root. Reads are resolved top-down. The first write to a lower file triggers **copy-up** of the whole file into the upper layer; new files go straight there; deletions create **whiteout** entries (0/0 char devices, or opaque directory markers) that mask lower entries. Layers are shared between images and containers, so containers start instantly and only their changes use space; removing a container deletes just its upper layer.",
        freq: "common",
      },
      {
        q: "Why is writing a database's files into the container filesystem a bad idea?",
        a: "Three reasons. **Durability**: the writable layer is deleted with the container, so upgrades or re-creation lose the data. **Performance**: overlayfs adds copy-up (the first write to a big file copies it entirely) and an extra filesystem layer, and some operations (fsync patterns, renames of lower directories) are slow; volumes bypass overlayfs and write straight to the host filesystem. **Operability**: volumes can be backed up, moved, snapshotted and provided by drivers (cloud disks, NFS). So databases and other write-heavy state go in volumes.",
        freq: "common",
      },
      {
        q: "Why doesn't `RUN rm -rf /var/cache/apt` in its own layer reduce the image size?",
        a: "Layers are immutable and additive. The files were committed in an earlier layer; the later `RUN rm` only adds **whiteout** entries that hide them in the merged view, while the bytes still ship in the earlier layer's tarball. Remove temporary files in the **same** `RUN` that created them (`apt-get install ... && rm -rf /var/lib/apt/lists/*`), use BuildKit cache mounts for package caches, or use a multi-stage build so the final stage never contains them. `docker history` shows the per-layer sizes.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "A container modifies one line of a 200 MB file that came from the image. What happens on disk?",
        options: ["Only the changed line is stored", "The whole file is copied up into the container's layer, then modified", "The image layer is modified in place", "The write fails: image files are read-only"],
        answer: 1,
        explain: "overlayfs works on whole files: the first write copies the file into the upper layer.",
      },
      {
        q: "How does overlayfs delete a file that exists in a lower (image) layer?",
        options: ["It removes it from the image layer", "It creates a whiteout in the upper layer that hides it", "It marks the whole layer as deleted", "It can't: deletes fail"],
        answer: 1,
        explain: "Lower layers are read-only. A whiteout entry masks the file in the merged view.",
      },
      {
        q: "You start 50 containers from one 800 MB image. Roughly how much disk do they use?",
        options: ["50 × 800 MB", "800 MB plus each container's own changes", "Nothing", "800 MB / 50"],
        answer: 1,
        explain: "Image layers are shared read-only; each container only adds its upper layer.",
      },
      {
        q: "What does `docker diff` show?",
        options: ["Differences between two images", "Files added, changed and deleted in a container's writable layer", "Changes to the Dockerfile", "Network changes"],
        answer: 1,
        explain: "A, C and D entries come straight from the container's upper layer.",
      },
      {
        q: "Why don't volumes suffer from copy-up?",
        options: ["They're compressed", "They're mounted directly, bypassing overlayfs", "They're read-only", "They live in memory"],
        answer: 1,
        explain: "A volume is a separate mount of a real directory, so writes go straight to the host filesystem.",
      },
    ],
  },

  // ------------------------------------------------------------------ ENGINE & OCI
  {
    id: "dk-engine",
    title: "The engine: API, containerd, runc and OCI",
    tagline: "The docker CLI is an HTTP client: talk to the Engine API yourself, follow docker run through dockerd, containerd, the shim and runc, unpack an OCI image by hand, and see why Kubernetes doesn't need Docker.",
    difficulty: "advanced",
    minutes: 30,
    diagram: {
      title: "The stack under docker run",
      nodes: [
        { id: "cli", label: "docker CLI", kind: "client", x: 90, y: 280, sub: "an HTTP client" },
        { id: "sock", label: "docker.sock", kind: "gateway", x: 270, y: 280, sub: "Engine REST API" },
        { id: "dockerd", label: "dockerd", kind: "service", x: 450, y: 280, sub: "images, builds, networks, volumes" },
        { id: "registry", label: "Registry", kind: "registry", x: 450, y: 80, sub: "OCI distribution API" },
        { id: "containerd", label: "containerd", kind: "control", x: 650, y: 280, sub: "content store, snapshots, tasks" },
        { id: "shim", label: "containerd-shim", kind: "worker", x: 850, y: 280, sub: "one per container" },
        { id: "runc", label: "runc", kind: "worker", x: 850, y: 470, sub: "OCI runtime" },
        { id: "kernel", label: "Linux kernel", kind: "node", x: 600, y: 470, sub: "namespaces, cgroups, overlayfs" },
        { id: "kubelet", label: "kubelet", kind: "control", x: 650, y: 80, sub: "CRI: talks to containerd directly" },
      ],
      edges: [
        { from: "cli", to: "sock", label: "POST /containers/create" },
        { from: "sock", to: "dockerd" },
        { from: "dockerd", to: "registry", label: "pull" },
        { from: "dockerd", to: "containerd", label: "gRPC" },
        { from: "containerd", to: "shim" },
        { from: "shim", to: "runc", label: "create / start" },
        { from: "runc", to: "kernel", label: "clone, mount, pivot_root" },
        { from: "kubelet", to: "containerd", label: "CRI", dashed: true },
      ],
      flows: [
        {
          name: "docker run -d nginx",
          path: ["cli", "sock", "dockerd", "registry", "dockerd", "containerd", "shim", "runc", "kernel"],
          steps: [
            "The CLI turns the command into HTTP requests: create a container, then start it.",
            "They go over a unix socket to dockerd, the Docker daemon.",
            "If the image is missing, dockerd resolves the tag to a manifest digest and pulls the missing layers.",
            "Layers arrive verified by their sha256 digests and are unpacked into snapshots.",
            "dockerd hands the container to containerd: an OCI runtime spec plus a root filesystem snapshot.",
            "containerd starts a shim for this container. The shim, not the daemon, is the container's parent, so dockerd can restart without killing containers.",
            "The shim calls runc with the bundle (config.json + rootfs).",
            "runc creates the namespaces and cgroup, mounts the root filesystem, drops privileges, execs the entrypoint as PID 1, and exits.",
          ],
        },
        {
          name: "Kubernetes without Docker",
          path: ["kubelet", "containerd", "shim", "runc", "kernel"],
          steps: [
            "The kubelet speaks the Container Runtime Interface (CRI), which containerd implements directly. No dockerd involved.",
            "containerd pulls the same OCI images Docker built and starts a shim per container.",
            "The shim calls runc, the same runtime Docker uses.",
            "Same kernel features, same images: that's why removing dockershim in Kubernetes 1.24 broke nobody's images.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
When you order food in a big restaurant, you don't walk into the kitchen. You tell the **waiter** (the \`docker\` command). The waiter writes your order on a slip and hands it to the **head chef** (\`dockerd\`). The head chef plans the meal and gives the cooking to a **line cook** (\`containerd\`), who puts a **kitchen helper** at your table's station (the **shim**) and calls the specialist who actually lights the stove (\`runc\`). The stove is the **kernel**.

Because everyone speaks the same **standard order slips** (OCI), a different restaurant (Kubernetes) can use the same line cook and the same stove without the waiter or head chef at all.

## The CLI is just an HTTP client
\`docker\` sends REST calls to the **Docker Engine API**, served by \`dockerd\` on a unix socket (\`/var/run/docker.sock\` on Linux; Docker Desktop forwards one from your laptop) or over TCP with TLS. \`docker ps\` is \`GET /containers/json\`; \`docker run\` is \`POST /containers/create\` then \`POST /containers/{id}/start\`. SDKs (Go, Python), Compose, Testcontainers, CI plugins and Portainer all use the same API. \`DOCKER_HOST\` and \`docker context\` point the CLI at another engine, e.g. \`ssh://user@server\`.

**Access to the socket = root on the host.** Anyone who can call the API can start a \`--privileged\` container that mounts \`/\` from the host. Never mount \`docker.sock\` into containers you don't fully trust, never expose the API over TCP without TLS client certificates, and treat the \`docker\` group as equivalent to sudo.

## The layers under docker run
| Component | Job |
|---|---|
| **docker CLI** | parses commands, calls the API |
| **dockerd** | the Docker API: builds (BuildKit), images, networks, volumes, logs, restart policies |
| **containerd** | a general-purpose container daemon: content store (blobs), snapshots (overlayfs), images, tasks |
| **containerd-shim** | one per container: keeps stdio open, collects the exit code, lets daemons restart without killing containers |
| **runc** | the OCI runtime: reads \`config.json\`, sets up namespaces, cgroups, mounts, capabilities, seccomp, then execs PID 1 and exits |

Alternatives exist at every level: Podman (daemonless, rootless, compatible CLI), CRI-O (Kubernetes-only), crun and youki (runc alternatives in C and Rust), gVisor's \`runsc\` and Kata's runtime for sandboxing.

## The OCI standards
The **Open Container Initiative** standardizes three things, which is why all these tools interoperate:
- the **image spec**: an image is an *index* (per-platform list) → *manifests* → a *config* JSON + ordered *layer* tarballs, all content-addressed by sha256;
- the **runtime spec**: a *bundle* = a \`config.json\` (process, mounts, namespaces, cgroups, capabilities) + a root filesystem; \`runc run\` executes it;
- the **distribution spec**: the HTTP API registries implement for push and pull.

## Kubernetes and "dockershim"
Kubernetes talks to runtimes through the **CRI** (Container Runtime Interface). Docker Engine never implemented it, so Kubernetes carried an adapter called dockershim, removed in **1.24**. Clusters now run **containerd** or **CRI-O** directly. Images kept working because Docker builds standard OCI images. What broke was anything that used the node's Docker socket, like Docker-in-Docker CI builds; those moved to BuildKit, kaniko or buildah.

## Events and introspection
\`docker events\` streams everything the engine does (create, start, die, oom, health_status...), \`docker system info\` describes the engine (storage driver, cgroup version, runtimes), and \`docker system df\` the disk it uses.`,
    keyPoints: [
      "The docker CLI is an HTTP client for the Engine API on /var/run/docker.sock; Compose, SDKs and CI tools use the same API.",
      "docker run flows CLI → dockerd → containerd → shim → runc → kernel; runc sets up isolation, execs PID 1 and exits, and the shim stays as parent.",
      "OCI standardizes images (index, manifest, config, layers), runtimes (config.json + rootfs) and registries, so Docker, Podman, containerd and Kubernetes interoperate.",
      "Kubernetes uses containerd or CRI-O through the CRI; removing dockershim didn't break any images.",
      "Access to the Docker socket is root on the host: never mount it into untrusted containers or expose it without TLS.",
    ],
    code: [
      {
        title: "Talk to the Engine API yourself",
        docker: true,
        images: ["node:20-slim", "node:20"],
        vary: ["engine \\S+ API \\S+"],
        variants: [{ lang: "bash", code: `docker run -d --name quest-api-demo node:20-slim sleep 60 > /dev/null

# The docker CLI is just an HTTP client. Talk to the engine's API yourself, through its unix socket:
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock node:20 bash -c '
  api() { curl -s --unix-socket /var/run/docker.sock "http://localhost$1"; }
  api /version | python3 -c "import json, sys; v = json.load(sys.stdin); print(\\"engine\\", v[\\"Version\\"], \\"API\\", v[\\"ApiVersion\\"])"
  api "/containers/json?filters=%7B%22name%22%3A%5B%22quest-api-demo%22%5D%7D" |
    python3 -c "import json, sys; [print(c[\\"Names\\"][0], c[\\"Image\\"], c[\\"State\\"]) for c in json.load(sys.stdin)]"'` }],
        explain: `- We mount the engine's socket into a container and call the API with \`curl --unix-socket\`, exactly what the docker CLI does. \`/version\` is the same data as \`docker version\`.
- \`/containers/json?filters=...\` is \`docker ps --filter name=...\`: the filter is URL-encoded JSON.
- That container could just as easily have created a privileged container mounting the host's \`/\`. Mounting \`docker.sock\` gives full control of the host: only do it for tools you trust completely.`,
        output: `engine 28.5.1 API 1.51
/quest-api-demo node:20-slim running`,
      },
      {
        title: "Unpack an OCI image by hand",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM scratch
COPY hello.txt /hello.txt` },
          { path: "hello.txt", lang: "text", code: `Hello from inside an image layer!` },
          { path: "walk.js", lang: "javascript", code: `// Walk an OCI image layout: index.json -> manifest -> config + layers. Everything is a sha256 blob.
const fs = require("fs");
const zlib = require("zlib");

const blob = (digest) => fs.readFileSync(\`image/blobs/sha256/\${digest.slice(7)}\`);
const json = (digest) => JSON.parse(blob(digest));

const index = JSON.parse(fs.readFileSync("image/index.json"));
let manifest = json(index.manifests[0].digest);
if (manifest.manifests) {
  // a multi-platform index: pick the real image (not the build attestation)
  const pick = manifest.manifests.find((m) => m.platform?.architecture !== "unknown");
  manifest = json(pick.digest);
}
console.log("manifest:", manifest.mediaType);

const config = json(manifest.config.digest);
console.log("config:   os =", config.os + ", history =", config.history.map((h) => h.created_by.replace(/ # buildkit$/, "")).join(" | "));

for (const layer of manifest.layers) {
  let tar = blob(layer.digest);
  if (layer.mediaType.endsWith("gzip")) tar = zlib.gunzipSync(tar);
  // a tar file is 512-byte headers, each followed by the file's content
  for (let off = 0; off + 512 <= tar.length && tar[off]; ) {
    const name = tar.toString("utf8", off, off + 100).replace(/\\0.*$/s, "");
    const size = parseInt(tar.toString("utf8", off + 124, off + 136), 8);
    if (size > 0) console.log(\`layer:    \${name} -> \${tar.toString("utf8", off + 512, off + 512 + size).trim()}\`);
    off += 512 + Math.ceil(size / 512) * 512;
  }
}` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-oci . > /dev/null

# docker save writes the image as plain files: JSON documents and tarballs
mkdir image && docker save quest-oci | tar -x -C image
ls image

docker run --rm -v "$PWD":/w -w /w node:20-slim node walk.js` }],
        explain: `- \`docker save\` writes an image as an **OCI image layout**: \`oci-layout\`, \`index.json\` (the entry point) and \`blobs/sha256/<digest>\` (\`manifest.json\` is the older Docker format, kept for compatibility).
- \`walk.js\` follows the chain like a registry client or runtime would: index → manifest → config + layers. Every reference is a sha256 digest of the blob it points to. BuildKit also attaches a provenance *attestation* manifest, which the walker skips.
- The config records the OS and the build history; the single layer is a tarball (possibly gzipped) containing \`hello.txt\`. An image really is just JSON and tarballs.`,
        output: `blobs
index.json
manifest.json
oci-layout
manifest: application/vnd.oci.image.manifest.v1+json
config:   os = linux, history = COPY hello.txt /hello.txt
layer:    hello.txt -> Hello from inside an image layer!`,
      },
      {
        title: "Watch the engine's event stream",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `since=$(date +%s)
docker run --name quest-events node:20-slim true
docker rm quest-events > /dev/null
sleep 1

# Everything the engine does is published as an event (monitoring tools subscribe to these)
docker events --since "$since" --until "$(date +%s)" --filter container=quest-events --format '{{.Type}} {{.Action}}'` }],
        explain: `- \`docker run\` = create + attach (for output) + start. The process exits (**die**), and \`docker rm\` **destroy**s the container.
- Monitoring tools subscribe to this stream (without \`--until\`, it follows live) to react to crashes, OOM kills (\`oom\`) and health changes (\`health_status\`).`,
        output: `container create
container attach
container start
container die
container destroy`,
      },
    ],
    interview: [
      {
        q: "Explain what happens when you run `docker run nginx`.",
        a: "The CLI calls the Engine API on the unix socket. **dockerd** resolves `nginx` to `docker.io/library/nginx:latest`; if it isn't local, it fetches the image index, picks the manifest for the host platform and downloads missing layers (verified by sha256). It creates the container (config, writable layer, networking via its network driver) and asks **containerd** to start it; containerd prepares an overlayfs snapshot and an OCI bundle and starts a **containerd-shim**, which invokes **runc**. runc creates namespaces and the cgroup, sets up mounts and `pivot_root`, applies capabilities/seccomp/AppArmor, and execs nginx as PID 1, then exits. For bridge networking a veth pair joins the container to the bridge and NAT rules are added for published ports. The shim remains the parent, holding stdio for `docker logs` and collecting the exit code.",
        freq: "very-common",
      },
      {
        q: "What is the OCI, and why does it matter?",
        a: "The **Open Container Initiative** defines vendor-neutral specs: the **image spec** (index → manifest → config + content-addressed layer tarballs), the **runtime spec** (a bundle of `config.json` + root filesystem that runtimes like runc, crun, youki, runsc or Kata execute) and the **distribution spec** (the registry HTTP API). Because of it, images built by Docker, BuildKit, kaniko, buildah or Jib run on Docker, Podman, containerd, CRI-O and every cloud service, and registries are interchangeable. It's what let Kubernetes drop Docker Engine without breaking images.",
        freq: "common",
      },
      {
        q: "Why is mounting /var/run/docker.sock into a container dangerous?",
        a: "The socket is the full Docker Engine API, and dockerd runs as root. A process with access can create a container with `--privileged`, the host's PID/network namespaces and a bind mount of the host's `/`, then `chroot` into it: that's **root on the host**. So mounting the socket (common for CI runners, Traefik, Watchtower, Portainer) means fully trusting that container and everything that can compromise it. Mitigations: avoid it; use a socket proxy that allows only specific read-only endpoints; use rootless Docker; build images with daemonless builders (BuildKit rootless, kaniko, buildah) in CI.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "How does the docker CLI talk to the Docker daemon?",
        options: ["Through shared memory", "Over the Engine REST API, usually on the unix socket /var/run/docker.sock", "By running runc directly", "Through the registry"],
        answer: 1,
        explain: "The CLI is an HTTP client. Compose, SDKs and other tools use the same API.",
      },
      {
        q: "Which component creates the namespaces and execs the container's process?",
        options: ["The docker CLI", "dockerd", "runc", "The registry"],
        answer: 2,
        explain: "runc, the OCI runtime, does the low-level setup and exits; the shim stays as the parent.",
      },
      {
        q: "Why does each container have its own containerd-shim?",
        options: ["To compress logs", "So the container doesn't depend on dockerd/containerd staying up: daemons can restart without killing containers", "To pull images faster", "It's required by the kernel"],
        answer: 1,
        explain: "The shim is the container's parent: it holds stdio and collects the exit status.",
      },
      {
        q: "Kubernetes 1.24 removed dockershim. What happened to images built with Docker?",
        options: ["They had to be rebuilt", "Nothing: they're standard OCI images that containerd and CRI-O run", "They only run on Docker Desktop", "They were converted automatically"],
        answer: 1,
        explain: "Docker builds OCI images. Only things relying on the node's Docker socket broke.",
      },
      {
        q: "A monitoring container needs to list containers, so someone mounts docker.sock into it. What's the risk?",
        options: ["None, listing is read-only", "Whoever controls that container controls the Docker API, which is root on the host", "It slows Docker down", "It breaks networking"],
        answer: 1,
        explain: "The socket exposes the whole API. Use a filtering socket proxy, or avoid it.",
      },
    ],
  },
];
