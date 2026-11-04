import type { Lesson } from "../types";

// Docker, part 3: data and networking. Volumes and bind mounts, container networks and DNS, Compose.

export const dockerPart3: Lesson[] = [
  // ------------------------------------------------------------------ VOLUMES
  {
    id: "dk-volumes",
    part: "Part 3 · Data and networking",
    title: "Volumes and bind mounts: keeping data",
    tagline: "Why container files vanish, named volumes vs bind mounts vs tmpfs, read-only mounts, backups and restores, file ownership, and the mount that hides your files.",
    difficulty: "beginner",
    minutes: 25,
    visualizers: ["dockernet"],
    concept: `## Explain it like I'm 10 🧸
A container is like a hotel room. You can unpack and scatter your things everywhere, but when you check out (\`docker rm\`), the cleaners throw away everything you left. The next guest gets a perfectly clean room.

So where do you keep things you want to keep? In a **locker** downstairs that belongs to you, not to the room. Any room can open it, and it's still there after you check out. That locker is a **volume**.

A **bind mount** is different: it's like a magic window from the hotel room straight into a drawer **at your own home**. Whatever you put in through the window lands at home, and if someone at home changes the drawer, you see it in the room instantly. Great for working on your homework (code) live.

## Three kinds of mounts
| | Named volume | Bind mount | tmpfs |
|---|---|---|---|
| Syntax | \`-v pgdata:/var/lib/postgresql/data\` | \`-v "$PWD/src":/app/src\` | \`--tmpfs /tmp\` |
| Lives | in Docker's storage (\`/var/lib/docker/volumes\`) | anywhere on the host | in memory |
| Managed by | Docker (\`docker volume ls/inspect/rm\`) | you | nobody: gone when the container stops |
| Survives \`docker rm\` | **yes** | yes (it's your folder) | no |
| Use for | databases, uploads, anything persistent | source code in development, config files | scratch space, secrets |

Rule of thumb: **production data in named volumes, development code in bind mounts**.

The long form \`--mount type=volume,src=pgdata,dst=/var/lib/postgresql/data\` (or \`type=bind\`, \`type=tmpfs\`) is more explicit, and errors instead of silently creating things when a source is missing. Add \`:ro\` (or \`readonly\`) to make a mount read-only for the container.

## Why volumes, and not just the container's filesystem?
- The container's **writable layer** is deleted with the container, and is tied to that one container.
- It's a copy-on-write filesystem (overlayfs), which is slower for heavy writes like a database's.
- Volumes **bypass** overlayfs, survive container replacement (upgrading Postgres = new container, same volume) and can be backed up, shared between containers, or provided by drivers (NFS, cloud disks).

## Two behaviours that surprise people
1. **A new, empty named volume is pre-filled** with whatever the image has at that path, the first time it's mounted. That's how a fresh \`node_modules\` volume gets the image's modules.
2. **A bind mount (or a non-empty volume) hides** what the image has at that path. Mount your source folder over \`/app\` and the \`node_modules\` the image installed there disappear: the classic "Cannot find module" in development. The common fix is an extra anonymous volume for that subfolder (\`-v /app/node_modules\`).

## File ownership
Docker doesn't translate users for bind mounts on Linux: a file created by root in the container is owned by **root** on the host, and a container running as UID 1000 can't write to a host folder owned by someone else. Fix it by running the container with your UID (\`-u "$(id -u):$(id -g)"\`), by \`chown\`-ing the folder, or by using named volumes. Docker Desktop on Mac and Windows hides most of this by mapping files to your user.

## Backups
Volumes are just directories, so back them up with any container: mount the volume and a host folder, and \`tar\` one into the other. For databases, prefer the database's own tool (\`pg_dump\`, \`mysqldump\`) or stop the database first, so you don't copy files mid-write.

## Housekeeping
\`docker volume ls\`, \`docker volume inspect NAME\`, \`docker volume rm NAME\`, and \`docker volume prune\` (removes volumes no container uses; careful). \`docker rm -v\` also removes a container's **anonymous** volumes.`,
    keyPoints: [
      "A container's own files disappear with docker rm; anything you want to keep goes in a volume.",
      "Named volumes are managed by Docker and are right for databases and other persistent data; bind mounts map a host folder (great for live code in development); tmpfs lives in memory.",
      "Volumes bypass the copy-on-write filesystem, survive container replacement and can be backed up with a throwaway container and tar.",
      "A new empty named volume is pre-filled from the image; a bind mount hides what the image had at that path.",
      "Bind mounts keep host file ownership: watch UIDs when the container runs as non-root. Use :ro for mounts the container shouldn't change.",
    ],
    code: [
      {
        title: "A named volume outlives its containers",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `# Without a volume, files die with the container (remember the homework?).
# A named volume is a folder Docker keeps for you, outside any container.
docker volume create quest-notes

docker run --rm -v quest-notes:/data ubuntu:24.04 sh -c 'echo "note 1" >> /data/notes.txt'
docker run --rm -v quest-notes:/data ubuntu:24.04 sh -c 'echo "note 2" >> /data/notes.txt'
docker run --rm -v quest-notes:/data ubuntu:24.04 cat /data/notes.txt

docker volume ls --filter name=quest- --format '{{.Name}} (driver: {{.Driver}})'
docker volume rm quest-notes` }],
        explain: `- Three different containers, all \`--rm\`, all gone the moment they finish. The notes survive because they live in the volume \`quest-notes\`, mounted at \`/data\` each time.
- \`docker volume create\` is optional: \`-v name:/path\` creates a missing volume on first use. Creating it explicitly documents intent and catches typos.
- The volume is removed only when you say so: \`docker volume rm\` (or \`docker compose down -v\`).`,
        output: `quest-notes
note 1
note 2
quest-notes (driver: local)
quest-notes`,
      },
      {
        title: "A bind mount: live edits, no rebuild",
        docker: true,
        images: ["node:20-slim"],
        files: [{ path: "site/index.html", lang: "text", code: `<h1>Version 1</h1>` }],
        variants: [{ lang: "bash", code: `# A bind mount puts a folder from YOUR computer inside the container.
# :ro = read-only for the container
docker run -d --name quest-site -p 8080:3000 -v "$PWD/site":/srv:ro node:20-slim node -e "
  const fs = require('fs');
  require('http').createServer((q, s) => s.end(fs.readFileSync('/srv/index.html'))).listen(3000);" > /dev/null
sleep 1
curl -s localhost:8080

# Edit the file on your computer: the container sees it at once, no rebuild
echo "<h1>Version 2</h1>" > site/index.html
curl -s localhost:8080

# The container can't change your files
docker exec quest-site sh -c 'echo hacked > /srv/index.html' 2>&1 || echo "(the write was refused)"` }],
        explain: `- \`-v "$PWD/site":/srv:ro\` shows the host folder \`site/\` inside the container at \`/srv\`. Bind mounts need an **absolute** host path, hence \`$PWD\`.
- Changing the file on the host changes what the running container serves. That's the development workflow: edit code on your laptop, and the containerized app (often with a file watcher like \`node --watch\` or \`nodemon\`) picks it up.
- \`:ro\` makes the mount read-only inside the container, so the app can't modify your files, even as root.`,
        output: `<h1>Version 1</h1>
<h1>Version 2</h1>
sh: 1: cannot create /srv/index.html: Read-only file system
(the write was refused)`,
      },
      {
        title: "Back up and restore a volume",
        docker: true,
        images: ["ubuntu:24.04"],
        variants: [{ lang: "bash", code: `docker volume create quest-db > /dev/null
docker run --rm -v quest-db:/data ubuntu:24.04 sh -c 'echo "alice,42" > /data/users.csv; echo "bob,7" >> /data/users.csv'

# Backup: a throwaway container mounts the volume AND this folder, and tars one into the other
docker run --rm -v quest-db:/data -v "$PWD":/backup ubuntu:24.04 tar -czf /backup/db-backup.tgz -C /data .
ls *.tgz

# Disaster: the volume is deleted
docker volume rm quest-db > /dev/null

# Restore into a brand-new volume
docker volume create quest-db-restored > /dev/null
docker run --rm -v quest-db-restored:/data -v "$PWD":/backup ubuntu:24.04 tar -xzf /backup/db-backup.tgz -C /data
docker run --rm -v quest-db-restored:/data ubuntu:24.04 cat /data/users.csv` }],
        explain: `- The trick: a **throwaway container** mounts both the volume (at \`/data\`) and the current folder (at \`/backup\`), and runs \`tar\` between them. No need to know where Docker stores volumes on disk.
- Restoring is the same in reverse, into a fresh volume. Real databases should be dumped with their own tools (\`pg_dump\`) or stopped first, so the copy is consistent.`,
        output: `db-backup.tgz
alice,42
bob,7`,
      },
      {
        title: "Pre-filled volumes vs hiding bind mounts",
        docker: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# The image already has files in /usr/local/lib/node_modules (npm itself).

# A NEW named volume is pre-filled with the image's files the first time it's mounted...
docker run --rm -v quest-mods:/usr/local/lib/node_modules node:20-slim ls /usr/local/lib/node_modules

# ...but a bind mount (or a non-empty volume) HIDES them. The folder looks empty:
mkdir -p empty
docker run --rm -v "$PWD/empty":/usr/local/lib/node_modules node:20-slim ls /usr/local/lib/node_modules
echo "(nothing above: npm is hidden, not deleted)"` }],
        explain: `- A brand-new named volume mounted over a folder that has content in the image is **initialized with a copy** of that content, so npm and corepack appear.
- A bind mount of an empty host folder **hides** the image's folder instead: the files are still in the image, just covered up.
- This explains the classic dev bug: mounting your project over \`/app\` hides the \`node_modules\` installed during the build.`,
        output: `corepack
npm
(nothing above: npm is hidden, not deleted)`,
      },
    ],
    interview: [
      {
        q: "Volume vs bind mount: when do you use each?",
        a: "**Named volumes** are created and managed by Docker, independent of the host's directory layout, survive container removal, bypass the copy-on-write filesystem (better write performance), can use drivers (NFS, cloud block storage) and get pre-populated from the image. Use them for databases and other persistent state. **Bind mounts** map a specific host path: ideal for live-reloading source code in development and injecting individual config files, but they couple the container to the host's paths and file ownership, and they hide whatever the image had at that path. **tmpfs** mounts are in-memory for scratch data and secrets. In Kubernetes the analogues are PVCs, hostPath (avoid) and emptyDir (medium: Memory).",
        freq: "very-common",
      },
      {
        q: "How do you persist and back up a database running in Docker?",
        a: "Store its data directory in a **named volume** (`-v pgdata:/var/lib/postgresql/data`), never in the container's writable layer, so upgrades are \"new container, same volume\". For backups use the database's logical dump tool from a container on the same network or via `docker exec` (`pg_dump`, `mysqldump`) on a schedule, or physical backups with the database stopped or in backup mode; then copy dumps off the host. A generic volume backup is `docker run --rm -v pgdata:/data -v $PWD:/backup alpine tar czf /backup/pg.tgz -C /data .`. Test restores regularly, and in production consider managed databases or volume snapshots.",
        freq: "common",
      },
      {
        q: "In development, mounting your code into the container breaks with \"Cannot find module\". Why?",
        a: "The image ran `npm ci` into `/app/node_modules`, then `-v $PWD:/app` bind-mounted your project over `/app`, **hiding** everything the image had there, including `node_modules` (your host might not have one, or has one built for macOS). Fixes: add an anonymous or named volume just for that subfolder (`-v /app/node_modules`, or a `node_modules:` volume in Compose), which takes precedence and is pre-filled from the image; install dependencies outside the mounted path; or use Compose `develop.watch` to sync files instead of mounting.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Where should a production database container keep its data?",
        options: ["In the container's writable layer", "In a named volume", "In the image", "In /tmp"],
        answer: 1,
        explain: "Named volumes survive container replacement and bypass the copy-on-write layer.",
      },
      {
        q: "What does `-v \"$PWD/site\":/srv:ro` do?",
        options: ["Creates a named volume called site", "Bind-mounts the host folder site/ at /srv, read-only for the container", "Copies site/ into the image", "Mounts /srv onto the host"],
        answer: 1,
        explain: "An absolute host path makes it a bind mount; :ro makes it read-only.",
      },
      {
        q: "You run `docker rm` on a container that used `-v data:/data`. What happens to the volume?",
        options: ["It's deleted with the container", "It stays until you remove it explicitly", "It becomes read-only", "It's moved to the image"],
        answer: 1,
        explain: "Named volumes are independent of containers. docker volume rm (or compose down -v) deletes them.",
      },
      {
        q: "You bind-mount an empty folder over /app/node_modules. What does the container see there?",
        options: ["The image's node_modules", "An empty folder: the bind mount hides the image's files", "A merged view", "An error"],
        answer: 1,
        explain: "Bind mounts cover whatever the image had at that path. Only a new empty named volume is pre-filled.",
      },
      {
        q: "Which mount type is best for secrets and scratch data that must never touch the disk?",
        options: ["Named volume", "Bind mount", "tmpfs", "The writable layer"],
        answer: 2,
        explain: "tmpfs lives in memory and disappears when the container stops.",
      },
    ],
  },

  // ------------------------------------------------------------------ NETWORKING
  {
    id: "docker-networking",
    title: "Container networking",
    tagline: "Bridge networks, DNS by container name, why the default bridge is different, isolating tiers with several networks, host and none modes, aliases, and how -p works under the hood.",
    difficulty: "intermediate",
    minutes: 30,
    visualizers: ["dockernet"],
    concept: `## Explain it like I'm 10 🧸
Think of a Docker **network** as a **walkie-talkie channel**. Containers on the same channel can talk to each other, and they can call each other **by name**: "api, are you there?". A built-in **phonebook** (Docker's DNS) knows everybody's name on that channel.

Containers on a different channel can't hear you at all. That's useful: you can put the database on a private channel that only the API listens to, so even if the website gets hacked, it can't reach the database directly.

The default channel (the one you get if you don't pick one) is old and has **no phonebook**, so names don't work there. Always make your own channel.

## Network drivers
| Driver | What you get | Use for |
|---|---|---|
| **bridge** (user-defined) | a private subnet on a virtual switch, **DNS by container name**, isolation per network | almost everything on one host (Compose creates one per project) |
| default \`bridge\` | the same, but **no DNS by name** | legacy; avoid |
| **host** | no network isolation: the container uses the host's network directly; \`-p\` is ignored | maximum performance, tools that need the host's interfaces (Linux only) |
| **none** | only a loopback interface | jobs that must not touch the network |
| **overlay** | a network spanning several hosts (VXLAN) | Docker Swarm (Kubernetes uses CNI plugins instead) |
| **macvlan / ipvlan** | the container gets its own address on the physical LAN | legacy apps that must look like a real machine |

## How a bridge network works
1. Docker creates a Linux **bridge** (a virtual switch) for the network, with a subnet like 172.18.0.0/16.
2. Each container gets a **veth pair**, a virtual cable: one end is \`eth0\` inside the container's network namespace, the other plugs into the bridge.
3. Outbound traffic to the internet is **NATed** (masqueraded) to the host's address.
4. Published ports (\`-p 8080:3000\`) add a **DNAT** rule: packets to host:8080 are rewritten to container-ip:3000.

Step through each path in the visualizer.

## Service discovery: DNS
On user-defined networks, every container's resolver points to Docker's **embedded DNS server at 127.0.0.11**. It answers with the IP of the container that has that **name**, **network alias** (\`--network-alias\`) or Compose **service name**, and forwards everything else to the host's DNS. Container IPs change whenever a container is recreated, so **always use names, never IPs**. If several containers share an alias, DNS returns all their IPs (basic round-robin load balancing).

## Talking between containers
- Containers on the same network reach each other on **container ports directly**: \`http://api:3000\`. Publishing (\`-p\`) is only for traffic from outside Docker.
- A container can join several networks (\`docker network connect\`). Use that to build tiers: \`web\` on \`front\` and \`back\`, \`db\` only on \`back\`.
- \`--network container:other\` makes a container share another's network namespace: same IP, same \`localhost\`. That's exactly how containers in a **Kubernetes pod** share networking, and how debugging sidecars work.
- To reach a service on your **laptop** from a container, use \`host.docker.internal\` (Docker Desktop; on Linux add \`--add-host host.docker.internal:host-gateway\`).

## The three classic bugs
1. **The app listens on 127.0.0.1**: unreachable from other containers and from published ports. Listen on 0.0.0.0.
2. **\`localhost\` in a connection string**: \`DATABASE_URL=postgres://localhost:5432\` points at the app's *own* container. Use the service name: \`postgres://db:5432\`.
3. **Containers on the default bridge**, or on two different networks: names don't resolve. Put them on one user-defined network.

## Commands
\`docker network create NAME\`, \`ls\`, \`inspect\` (subnet, connected containers and their IPs), \`connect\`/\`disconnect\`, \`rm\`, \`prune\`. Inside a container, \`getent hosts NAME\` shows what DNS returns, and \`cat /etc/resolv.conf\` shows the resolver.`,
    keyPoints: [
      "Always create a user-defined network: containers on it resolve each other by name through Docker's DNS at 127.0.0.11. The default bridge has no DNS.",
      "Containers on one network talk on container ports directly (http://api:3000); -p is only for traffic from outside Docker.",
      "Networks isolate: a container can only reach containers on networks it has joined, so split tiers (front/back) across networks.",
      "Bridge networking = a virtual switch + a veth pair per container + NAT; -p adds a DNAT rule. host shares the host's stack; none has only loopback.",
      "Never use localhost or IP addresses to reach another container: use its name or alias. --network container:X shares a network namespace, like a Kubernetes pod.",
    ],
    code: [
      {
        title: "Find a container by name",
        docker: true,
        images: ["node:20-slim", "node:20"],
        vary: ["172\\.\\d+\\.\\d+\\.\\d+"],
        variants: [{ lang: "bash", code: `# A user-defined network: containers on it can find each other BY NAME
docker network create quest-net > /dev/null

docker run -d --name quest-api --network quest-net node:20-slim node -e "
  require('http').createServer((q, s) => s.end('hi from the api container\\n')).listen(3000);" > /dev/null
sleep 1

# A second container on the same network calls the first one by its name
docker run --rm --network quest-net node:20 curl -s http://quest-api:3000

# Who answers the name lookups? Docker's built-in DNS server
docker run --rm --network quest-net node:20 grep nameserver /etc/resolv.conf
docker run --rm --network quest-net node:20 getent hosts quest-api` }],
        explain: `- Both containers join \`quest-net\`. The second one calls \`http://quest-api:3000\`, using the container's **name** as a hostname and the **container** port. Nothing is published.
- \`/etc/resolv.conf\` in the container points to \`127.0.0.11\`, Docker's embedded DNS, which knows every container on the network.
- \`getent hosts\` shows the answer: the api container's current IP on this network. It will change if the container is recreated, which is exactly why you use the name.`,
        output: `hi from the api container
nameserver 127.0.0.11
172.18.0.2      quest-api`,
      },
      {
        title: "The default bridge has no DNS",
        docker: true,
        images: ["node:20-slim", "node:20"],
        variants: [{ lang: "bash", code: `# The same thing on the DEFAULT network (no --network flag): no DNS by name
docker run -d --name quest-lonely node:20-slim node -e "
  require('http').createServer((q, s) => s.end('hi\\n')).listen(3000);" > /dev/null
sleep 1
docker run --rm node:20 curl -s --max-time 3 http://quest-lonely:3000 || echo "curl failed: the default bridge has no DNS for container names"` }],
        explain: `- Without \`--network\`, containers land on the legacy default \`bridge\` network. They could reach each other by IP, but **names don't resolve**.
- Fix: \`docker network create\` once, then \`--network\` on every container (Compose does this for you).`,
        output: `curl failed: the default bridge has no DNS for container names`,
      },
      {
        title: "Two networks, two tiers",
        docker: true,
        images: ["node:20-slim", "node:20"],
        variants: [{ lang: "bash", code: `# Two networks: the web tier and the data tier
docker network create quest-front > /dev/null
docker network create quest-back > /dev/null

serve='require("http").createServer((q, s) => s.end(process.env.HOSTNAME + " ok\\n")).listen(3000)'
docker run -d --name quest-db  --hostname db  --network quest-back node:20-slim node -e "$serve" > /dev/null
docker run -d --name quest-web --hostname web --network quest-front node:20-slim node -e "$serve" > /dev/null
docker network connect quest-back quest-web          # web is on BOTH networks
sleep 1

try() { docker run --rm --network "$1" node:20 curl -s --max-time 2 "http://$2:3000" || echo "can't reach $2"; }
echo "from the front network:"; try quest-front quest-web; try quest-front quest-db
echo "from the back network:";  try quest-back quest-web;  try quest-back quest-db` }],
        explain: `- \`quest-db\` is only on the back network. \`quest-web\` starts on the front network and is then **also** connected to the back one with \`docker network connect\`.
- A client on the front network reaches web but **can't even resolve** the database: a compromised frontend can't talk to it directly. From the back network both answer.
- Compose expresses the same thing with \`networks:\` per service.`,
        output: `from the front network:
web ok
can't reach quest-db
from the back network:
web ok
db ok`,
      },
      {
        title: "Network modes and aliases",
        docker: true,
        images: ["node:20-slim", "node:20"],
        variants: [{ lang: "bash", code: `# Which network cards does a container get?
nics='console.log(Object.keys(require("os").networkInterfaces()).join(" "))'
echo "bridge (default): $(docker run --rm node:20-slim node -e "$nics")"
echo "none:             $(docker run --rm --network none node:20-slim node -e "$nics")"

# Two containers sharing one name: Docker's DNS returns both (simple load balancing)
docker network create quest-lb > /dev/null
docker run -d --name quest-s1 --network quest-lb --network-alias search node:20-slim sleep 60 > /dev/null
docker run -d --name quest-s2 --network quest-lb --network-alias search node:20-slim sleep 60 > /dev/null
echo "\\"search\\" resolves to $(docker run --rm --network quest-lb node:20 getent ahostsv4 search | awk '{print $1}' | sort -u | wc -l | tr -d ' ') addresses"` }],
        explain: `- A normal container gets a loopback (\`lo\`) and one virtual card (\`eth0\`). \`--network none\` leaves only \`lo\`: no way in or out.
- Two containers with \`--network-alias search\` share a DNS name, and a lookup returns **both** addresses. Clients that pick one at random get simple load balancing (Compose replicas work this way).`,
        output: `bridge (default): lo eth0
none:             lo
"search" resolves to 2 addresses`,
      },
    ],
    interview: [
      {
        q: "Two containers can't reach each other by name. Why, and how do you fix it?",
        a: "Most likely they're on the **default bridge network**, which has no embedded DNS: name resolution only works on **user-defined networks** (Compose creates one per project). Fix: `docker network create app` and start both with `--network app`, then use the container name, alias or Compose service name. Other causes: they're on **different** networks (isolated by design: connect one to the other's network), the server listens on 127.0.0.1 instead of 0.0.0.0, the client uses the host's published port instead of the container port, or the client cached an old IP (always use names).",
        freq: "very-common",
      },
      {
        q: "What happens at the network level when you run a container with -p 8080:80?",
        a: "With the bridge driver, the container's network namespace is connected to a Linux bridge via a **veth pair**. Publishing adds an iptables (or nftables) **DNAT** rule: TCP packets arriving at the host on port 8080 have their destination rewritten to the container's IP and port 80, and the kernel routes them across the bridge. **conntrack** remembers the translation so replies are rewritten back. Docker may also run `docker-proxy` for loopback/hairpin traffic. Outbound traffic is masqueraded (SNAT) to the host IP. Because these rules sit in the nat table, they bypass simple host firewalls like ufw's INPUT rules.",
        freq: "common",
      },
      {
        q: "When would you use --network host?",
        a: "When you need the host's network stack directly: maximum throughput or lowest latency (no NAT or bridge), very many ports, or tools that must see the host's interfaces (monitoring agents, network utilities, some service-discovery or multicast software). The trade-offs: no network isolation, port conflicts with the host and other host-mode containers, `-p` is ignored, and it only behaves this way on Linux (on Docker Desktop it's the VM's network). For normal services, a user-defined bridge plus published ports is the right default.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "What resolves container names on a user-defined network?",
        options: ["The host's /etc/hosts", "Docker's embedded DNS server at 127.0.0.11", "A public DNS server", "Nothing: you must use IPs"],
        answer: 1,
        explain: "Each container's resolver points to Docker's DNS, which knows the names, aliases and service names on its networks.",
      },
      {
        q: "Your API container uses DATABASE_URL=postgres://localhost:5432 and Postgres runs in another container. What happens?",
        options: ["It works through Docker's DNS", "It connects to port 5432 inside the API container itself, and fails", "It reaches the host's Postgres", "Docker rewrites localhost automatically"],
        answer: 1,
        explain: "Each container has its own loopback. Use the database's container or service name.",
      },
      {
        q: "Containers A and B are on the same user-defined network. How should A call B's web server on container port 3000?",
        options: ["http://localhost:3000", "http://B:3000", "Publish B with -p and call the host's port", "http://127.0.0.11:3000"],
        answer: 1,
        explain: "Same network = direct access by name on the container port. Publishing is for traffic from outside.",
      },
      {
        q: "web is on networks front and back; db is only on back; a client is only on front. Can the client reach db?",
        options: ["Yes, through web", "No: it's not on any network db is on", "Yes, all networks are connected", "Only with -p"],
        answer: 1,
        explain: "Network membership is the isolation boundary. The client can't even resolve db's name.",
      },
      {
        q: "What does `--network container:web` do?",
        options: ["Puts the container on a network named web", "Shares web's network namespace: same IP and the same localhost", "Copies web's network settings", "Connects to web over SSH"],
        answer: 1,
        explain: "This is how containers in a Kubernetes pod share networking, and how debug sidecars attach.",
      },
    ],
  },

  // ------------------------------------------------------------------ COMPOSE
  {
    id: "docker-compose",
    title: "Docker Compose: a whole stack in one file",
    tagline: "Services, networks and volumes in compose.yaml; depends_on with healthchecks; environment and .env; up, down, logs and exec; profiles, overrides, watch and secrets.",
    difficulty: "intermediate",
    minutes: 30,
    diagram: {
      title: "A Compose project",
      nodes: [
        { id: "dev", label: "Your browser", kind: "client", x: 100, y: 280, sub: "localhost:8080" },
        { id: "web", label: "web", kind: "service", x: 340, y: 280, sub: "ports 8080:3000" },
        { id: "api", label: "api", kind: "service", x: 580, y: 160, sub: "build: ./api" },
        { id: "counter", label: "counter", kind: "worker", x: 580, y: 420, sub: "healthcheck /health" },
        { id: "db", label: "db", kind: "db", x: 840, y: 160, sub: "postgres:16 · volume pgdata" },
        { id: "vol", label: "volumes", kind: "storage", x: 840, y: 420, sub: "pgdata, counts" },
      ],
      edges: [
        { from: "dev", to: "web", label: "published port" },
        { from: "web", to: "api", label: "http://api:3000" },
        { from: "web", to: "counter", label: "http://counter:4000" },
        { from: "api", to: "db", label: "db:5432" },
        { from: "db", to: "vol" },
        { from: "counter", to: "vol" },
      ],
      flows: [
        {
          name: "docker compose up",
          path: ["vol", "db", "api", "web", "dev"],
          steps: [
            "Compose creates the project's network and named volumes first, then starts the services with no dependencies: db and counter.",
            "api has depends_on: db with condition: service_healthy, so Compose waits until db's healthcheck (pg_isready) passes before starting it.",
            "web starts once its dependencies are up. It finds them by service name through the project network's DNS.",
            "web is the only service with ports:, so it's the only one your browser can reach.",
          ],
        },
        {
          name: "A request through the stack",
          path: ["dev", "web", "counter", "vol"],
          steps: [
            "The browser calls localhost:8080, which Docker forwards to web's port 3000.",
            "web calls http://counter:4000 by service name: no IPs, no published ports.",
            "counter saves the new count in its named volume, so it survives docker compose down (but not down -v).",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Starting one container takes one long \`docker run\` command. A real app needs four or five: the website, the API, the database, a cache... Typing all those commands, in the right order, with the right settings, every day? No thanks.

**Docker Compose** is like the **sheet music for an orchestra**. One file (\`compose.yaml\`) says who plays (the services), which instruments they need (images), how they talk to each other (networks), what they keep (volumes), and who has to be ready before whom. Then one command, \`docker compose up\`, and the whole orchestra plays. \`docker compose down\` and everyone packs up.

## The file
\`\`\`yaml
services:              # one entry per container (or group of identical containers)
  web:
    build: ./web       # build from ./web/Dockerfile ...
    image: shop-web:1  # ... and name the result (or just use an existing image)
    ports: ["8080:3000"]
    environment:
      API_URL: http://api:3000
    depends_on:
      api: { condition: service_healthy }
  api:
    image: shop-api:1
    volumes: ["uploads:/data"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 5s
volumes:
  uploads:
\`\`\`
Each service accepts nearly every \`docker run\` option as YAML: \`image\`, \`build\`, \`command\`, \`entrypoint\`, \`environment\`, \`env_file\`, \`ports\`, \`volumes\`, \`networks\`, \`restart\`, \`user\`, \`read_only\`, \`healthcheck\`, \`deploy.resources.limits\`, \`init\`...

## What Compose creates
- A **project** named after the folder (or \`name:\` at the top, or \`-p\`). Everything is prefixed with it: containers \`shop-web-1\`, network \`shop_default\`, volume \`shop_uploads\`.
- A **default network** for the project: every service can reach every other **by service name**.
- The named **volumes** you declared.
- The containers, in dependency order.

## depends_on: ordering vs readiness
\`depends_on: [db]\` only waits for the db **container to start**, not for Postgres to accept connections; that takes a few seconds, during which your API crashes. Add a \`healthcheck\` to db and use \`condition: service_healthy\`. (\`service_completed_successfully\` waits for one-off jobs like migrations.) Even so, make your app **retry** its connections: in production, especially on Kubernetes, nothing guarantees start order.

## Everyday commands
| Command | What it does |
|---|---|
| \`docker compose up -d\` | create and start everything in the background |
| \`docker compose up -d --build\` | rebuild images first |
| \`docker compose up -d --wait\` | ...and wait until services are running/healthy (great in CI) |
| \`docker compose ps\` | the project's containers, states and health |
| \`docker compose logs -f api\` | follow one service's logs |
| \`docker compose exec db psql -U shop\` | run a command in a running service |
| \`docker compose run --rm api npm test\` | a one-off container for a service |
| \`docker compose restart api\` / \`stop\` / \`start\` | lifecycle |
| \`docker compose down\` | remove containers and networks (**volumes kept**) |
| \`docker compose down -v\` | ...and the named volumes (all data gone) |
| \`docker compose config\` | the final merged file, with variables filled in |

After editing \`compose.yaml\`, \`up -d\` again: Compose recreates only the services whose configuration changed.

## Configuration and variables
- \`environment:\` sets variables in the container; \`env_file:\` loads them from a file.
- \`\${VAR}\` in the YAML is **interpolated** from your shell or from a \`.env\` file next to \`compose.yaml\`: \`image: shop-api:\${TAG:-latest}\`. (Two different things that both say "env"!)
- **Profiles**: \`profiles: [debug]\` services start only with \`--profile debug\` (admin UIs, mail catchers).
- **Override files**: \`compose.override.yaml\` is merged automatically. Keep \`compose.yaml\` close to production and put dev conveniences (bind mounts, debug ports) in the override, or select files with \`-f\`.
- **\`develop: watch\`** (\`docker compose watch\`) syncs source changes into containers or rebuilds them, a modern alternative to bind-mounting code.
- **Secrets**: \`secrets:\` mounts files at \`/run/secrets/NAME\`; images like Postgres read \`POSTGRES_PASSWORD_FILE\`. Better than plain environment variables, which leak into \`docker inspect\`.

## Compose vs Kubernetes
Compose runs one project on **one host**. There's no self-healing across machines, no rolling updates without downtime, no autoscaling. That's perfect for development, CI integration tests and small single-server apps. The concepts map directly to Kubernetes: service → Deployment + Service, volume → PersistentVolumeClaim, healthcheck → probes, environment/secrets → ConfigMap/Secret.`,
    keyPoints: [
      "Compose describes a multi-container app in compose.yaml and runs it with docker compose up: services, networks, volumes.",
      "Each project gets its own network; services reach each other by service name. Only publish what your laptop needs.",
      "depends_on only orders startup; add a healthcheck and condition: service_healthy to wait for readiness, and still make apps retry.",
      "docker compose down keeps named volumes; down -v deletes them (and all their data).",
      "Use .env interpolation, profiles, override files, watch and file-based secrets to keep one compose file working for dev, CI and small deployments.",
    ],
    code: [
      {
        title: "Two services, one volume",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "compose.yaml", lang: "yaml", code: `# Two services that talk to each other by name, plus a volume that outlives them.
services:
  web:
    image: node:20-slim
    command: ["node", "/app/web.js"]
    volumes:
      - ./web.js:/app/web.js:ro
    ports:
      - "8080:3000"          # the only door in from your laptop
    environment:
      COUNTER_URL: http://counter:4000   # "counter" = the service name below
    depends_on:
      counter:
        condition: service_healthy       # wait until counter's healthcheck passes

  counter:
    image: node:20-slim
    command: ["node", "/app/counter.js"]
    volumes:
      - ./counter.js:/app/counter.js:ro
      - counts:/data                     # named volume: the count survives restarts
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 1s
      retries: 20

volumes:
  counts:` },
          { path: "web.js", lang: "javascript", code: `const http = require("http");

http
  .createServer(async (req, res) => {
    // Ask the counter service (another container) for the next number
    const r = await fetch(\`\${process.env.COUNTER_URL}/next\`, { method: "POST" });
    const { count } = await r.json();
    res.end(\`You are visitor number \${count}\\n\`);
  })
  .listen(3000, () => console.log("web ready on 3000"));` },
          { path: "counter.js", lang: "javascript", code: `const fs = require("fs");
const http = require("http");

const FILE = "/data/count.txt";
let count = fs.existsSync(FILE) ? Number(fs.readFileSync(FILE, "utf8")) : 0;

http
  .createServer((req, res) => {
    if (req.url === "/health") return res.end("ok");
    count += 1;
    fs.writeFileSync(FILE, String(count)); // saved in the volume
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ count }));
  })
  .listen(4000, () => console.log(\`counter ready, starting from \${count}\`));` },
        ],
        variants: [{ lang: "bash", code: `# -p names the project; --wait returns once every service is running and healthy
docker compose -p quest-visits up -d --wait 2> /dev/null

curl -s localhost:8080
curl -s localhost:8080
docker compose -p quest-visits ps --format '{{.Service}}: {{.State}} {{.Health}}'

# down removes the containers and the network, but KEEPS named volumes...
docker compose -p quest-visits down 2> /dev/null
docker compose -p quest-visits up -d --wait 2> /dev/null
curl -s localhost:8080                       # ...so the count continues
docker compose -p quest-visits logs counter --no-log-prefix

# down -v also deletes the volumes: a fresh start
docker compose -p quest-visits down -v 2> /dev/null` }],
        explain: `- \`up -d --wait\` starts the project and blocks until every service is running (and healthy, if it has a healthcheck). \`counter\` starts first; \`web\` waits for its healthcheck because of \`condition: service_healthy\`.
- \`web\` calls \`http://counter:4000\`: the **service name** is the hostname, and port 4000 isn't published at all.
- \`down\` deletes both containers and the network, but the \`counts\` volume stays, so after the next \`up\` the counter continues at 3. \`down -v\` wipes it.
- We mount the scripts into stock \`node:20-slim\` containers to keep the sample short; the project lesson builds real images with \`build:\`.`,
        output: `You are visitor number 1
You are visitor number 2
counter: running healthy
web: running 
You are visitor number 3
counter ready, starting from 2`,
      },
      {
        title: "Postgres with an init script and a healthcheck",
        docker: true,
        images: ["postgres:16-alpine"],
        files: [
          { path: "compose.yaml", lang: "yaml", code: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: change-me     # in real life: a secret, not a literal
      POSTGRES_DB: shop
    volumes:
      - pgdata:/var/lib/postgresql/data                  # the database files live here
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro  # runs once, on first start
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shop -d shop"]
      interval: 1s
      retries: 30

volumes:
  pgdata:` },
          { path: "init.sql", lang: "sql", code: `CREATE TABLE products (
  id    serial PRIMARY KEY,
  name  text NOT NULL,
  price numeric(8, 2) NOT NULL
);

INSERT INTO products (name, price) VALUES
  ('Rubber duck', 4.99),
  ('Whale plushie', 19.50);` },
        ],
        variants: [{ lang: "bash", code: `docker compose -p quest-pg up -d --wait 2> /dev/null

# Run psql INSIDE the db container: no database tools needed on your laptop
sql() { docker compose -p quest-pg exec -T db psql -U shop -d shop -At -c "$1"; }

sql "SELECT name || ' costs ' || price FROM products ORDER BY id"
sql "INSERT INTO products (name, price) VALUES ('Container ship', 999.00)"

# Throw the container away and make a new one: the data lives in the volume
docker compose -p quest-pg down 2> /dev/null
docker compose -p quest-pg up -d --wait 2> /dev/null
sql "SELECT count(*) || ' products after a restart' FROM products"

docker compose -p quest-pg down -v 2> /dev/null` }],
        explain: `- The official Postgres image runs every file in \`/docker-entrypoint-initdb.d/\` **once**, when its data directory is empty. That's how the table and two rows exist on first start.
- \`pg_isready\` in the healthcheck makes \`--wait\` (and \`depends_on: condition: service_healthy\`) wait until Postgres really accepts connections.
- \`docker compose exec -T db psql ...\` runs the client **inside** the db container. \`-T\` turns off the terminal so it works in scripts.
- After \`down\` and \`up\` the third product is still there: the database files live in the \`pgdata\` volume. Notice that the database port is never published; other services would reach it as \`db:5432\`.`,
        output: `Rubber duck costs 4.99
Whale plushie costs 19.50
INSERT 0 1
3 products after a restart`,
      },
    ],
    interview: [
      {
        q: "Your API crashes on docker compose up because the database isn't ready, even with depends_on. Why?",
        a: "Plain `depends_on` controls **start order** only: Compose waits for the db container to be *started*, not for Postgres to accept connections, which can take seconds (longer on first init). Add a **healthcheck** to db (`pg_isready -U ...`) and `depends_on: { db: { condition: service_healthy } }`. Also make the app resilient: retry the connection with backoff at startup and on failure, because in production (Kubernetes, ECS) there's no startup ordering and databases restart. One-off migrations can use `condition: service_completed_successfully`.",
        freq: "very-common",
      },
      {
        q: "What's the difference between `docker compose down`, `down -v` and `stop`?",
        a: "`stop` stops the containers but keeps them (start them again with `start`). `down` stops and **removes** the containers and the project's networks, but keeps named volumes and images, so data survives. `down -v` additionally removes the named volumes declared in the file (and anonymous ones), deleting the data; `--rmi all/local` also removes images. In CI, `down -v` gives a clean slate between runs; in development, think twice before `-v` on a database.",
        freq: "common",
      },
      {
        q: "When is Docker Compose enough, and when do you need Kubernetes?",
        a: "Compose is enough for local development, CI integration tests, demos and small apps on a **single server** where brief downtime on deploys or host failure is acceptable. You need an orchestrator (Kubernetes, or a managed platform like ECS, Cloud Run, Fly.io) when you need **multiple hosts**, **self-healing** when a machine dies, **rolling/canary deploys** without downtime, **autoscaling**, service discovery and load balancing across nodes, or fine-grained multi-team access control. Kubernetes has a real operational cost, so a managed container platform is often the pragmatic middle ground.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In the Compose file, how does web reach the counter service?",
        options: ["http://localhost:4000", "http://counter:4000 (the service name, on the project network)", "Through counter's published port", "Through an IP in an environment variable"],
        answer: 1,
        explain: "Compose puts all services on a project network where each service name resolves to its containers.",
      },
      {
        q: "What does `docker compose down -v` do that `down` doesn't?",
        options: ["Prints more output", "Also deletes the named volumes, so their data is lost", "Removes images", "Keeps the network"],
        answer: 1,
        explain: "down removes containers and networks; -v also removes volumes.",
      },
      {
        q: "Why use `condition: service_healthy` with depends_on?",
        options: ["It restarts unhealthy services", "It waits until the dependency's healthcheck passes, not just until its container starts", "It's required for networking", "It makes builds faster"],
        answer: 1,
        explain: "A started container isn't necessarily ready. The healthcheck defines \"ready\".",
      },
      {
        q: "Where does `${TAG}` in `image: shop:${TAG}` get its value?",
        options: ["From the container's environment", "From your shell or the .env file next to compose.yaml, when Compose reads the file", "From the image's ENV", "From docker inspect"],
        answer: 1,
        explain: "Interpolation happens on the host when the file is parsed. environment: sets variables inside containers.",
      },
      {
        q: "Postgres's /docker-entrypoint-initdb.d/init.sql runs when?",
        options: ["Every time the container starts", "Once, when the data directory (volume) is empty", "On every docker compose exec", "Never: you must run it manually"],
        answer: 1,
        explain: "Init scripts run only for a fresh database. To rerun them, remove the volume (down -v).",
      },
    ],
  },
];
