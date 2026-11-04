# DSA Quest ⚔️

**An interview-prep RPG.** Level up from Big-O to Raft consensus and LLM inference through interactive visualizations, real interview questions, quizzes and boss battles.

| World | Topics | Levels |
|---|---|---|
| 🌱 Foundation Fields | Big-O, arrays, hash tables, linked lists, stacks & queues, recursion | 6 |
| 🌳 Graph Grove | trees, BSTs, heaps, tries, BFS/DFS, Dijkstra, topological sort, union-find | 8 |
| ⛏️ Algorithm Caverns | sorting, binary search, dynamic programming, greedy, backtracking, bits | 6 |
| 🗝️ Pattern Dungeon | two pointers, sliding window, fast/slow, prefix sums, monotonic stack, intervals, top-k, DP & graph patterns | 9 |
| 🏙️ Skyline City | system design: estimation, load balancing, caching, databases, sharding, queues, rate limiting, APIs, CDNs + 7 case studies | 17 |
| 🌌 Consensus Nebula | distributed systems: CAP, consistency, clocks, quorums, consistent hashing, Raft, locks, 2PC/sagas, gossip, LSM/Bloom, CRDTs, stream processing, Dynamo | 14 |
| 🧠 Neural Citadel | AI inference: transformers, prefill/decode, KV cache, batching, quantization, speculative decoding, parallelism, roofline, FlashAttention, RAG, ML system design, LLM serving | 12 |
| ⚓ Container Harbor | infra, DevOps & SRE: what happens when you type a URL, TCP/UDP/HTTP/3, subnets & VPCs, Linux troubleshooting, containers, Kubernetes architecture & workloads, service mesh, CI/CD, cloud & Terraform, observability, SLOs & incidents, disaster recovery + a metrics-platform case study | 14 |
| 🤖 Agent Frontier | AI engineering: how frontier LLMs are built, reasoning models & test-time compute, MoE & long context, context engineering & prompt caching, tool use & MCP, agent harnesses, workflow patterns, multi-agent systems, agentic retrieval & memory, evals, prompt-injection security, LLMOps & fine-tuning + coding-agent and support-agent case studies | 14 |
| 🐳 Docker Dockyard | Docker from zero to production, explained for a 10-year-old and deep enough for interviews: why containers, the container lifecycle & exit codes, images/tags/digests & multi-platform, ports & config, Dockerfiles & the build context, layers & the build cache, CMD/ENTRYPOINT & PID 1 signals, multi-stage/non-root/secret-free images, volumes & bind mounts, networking & DNS, Compose, namespaces & cgroups, overlayfs copy-on-write, dockerd/containerd/runc & OCI, security (capabilities, docker.sock, rootless, scanning), production (OOM, health checks, restart policies, logs, debugging), CI/CD (test stages, tags, buildx, caching), two projects (ship a link shortener with Compose; build your own Docker in Python), the Docker interview. 51 Docker samples that run against a real engine | 20 |
| ☸️ Orchestration Citadel | Kubernetes in depth: pod lifecycle & probes, resources/QoS/scheduling, Services/DNS/Ingress/Gateway API/NetworkPolicy, ConfigMaps/Secrets/storage/StatefulSets, Helm/Kustomize/Argo CD, operators/RBAC/security, debugging Kubernetes | 7 |
| 🌊 Kafka Delta | Kafka engineering: the distributed log, producers (batching, acks, idempotence), replication & ISR, consumer groups & rebalancing, exactly-once & the outbox, segments/retention/compaction, Kafka Streams & Flink, Connect/Schema Registry/Debezium CDC, operating Kafka (KRaft, sizing, monitoring, DR), event-driven system design | 10 |
| 🖥️ Kernel Kingdom | operating systems from the power button up: kernel vs user mode, boot, system calls, processes & fork/exec (build a shell), threads, CPU scheduling, context switches, races & locks, semaphores & condition variables, deadlock & Banker's, memory layout, virtual memory & TLB, page replacement, allocators, file systems & inodes, disk scheduling & RAID, I/O models & epoll, IPC & signals, security (permissions, seccomp, ASLR), VMs vs containers (namespaces, cgroups), Linux debugging, the OS interview. 68 C, Python and shell samples that run on real Linux | 24 |
| ⚒️ Compiler Forge | compilers from first principles: the pipeline and the machine (registers, stack frames, calling conventions), lexing, regular expressions & automata (NFA→DFA, minimisation), grammars & ambiguity, recursive descent & Pratt parsing, LL(1) and LR parsing, scopes & symbol tables, type checking & Hindley–Milner inference, tree-walking interpreters & closures, bytecode VMs, build the Pebble interpreter, three-address code, CFGs & SSA, optimization & data-flow analysis, LLVM IR, x86-64 code generation, register allocation, linking & loading, runtimes & garbage collection, JIT compilation, build pebblec (Pebble → LLVM IR → native code), the compilers interview. 34 Python, C, LLVM IR and shell samples with real output | 22 |

Every level has five stages — **Learn → Visualize → Code → Interview → Quiz** — and every world ends with a **boss battle**.

### Language Academy

Four language tracks (`/languages`) take you from your first program to production code and the interview, in six parts: Foundations, Core, Advanced, Ecosystem, Projects and Interview.

| Track | What you learn | Chapters |
|---|---|---|
| ☕ Java | Java 25: types, classes, records and enums to inheritance and interfaces; exceptions; collections, generics, lambdas and streams; Maven, Gradle and JUnit; concurrency and virtual threads; the JVM, memory, GC and JIT; modern Java 17 to 25; the library toolbox and Spring Boot REST APIs. Projects: an expense tracker CLI and a Spring Boot REST API | 17 |
| ⚙️ C++ | C++23: values, references and pointers to RAII and smart pointers; the STL and algorithms; move semantics, templates and concepts; threads, atomics and coroutines; CMake, sanitizers and GoogleTest; libraries and web frameworks (Boost.Beast, Drogon, Crow). Projects: a persistent key-value store with crash recovery and a Boost.Beast JSON API | 18 |
| 🐹 Go | Go 1.24+: slices, maps, structs and embedding; interfaces, errors, generics and iterators; testing, benchmarks and fuzzing; goroutines, channels, context and errgroup; the scheduler, GC and pprof; modules, libraries and HTTP APIs with net/http, chi, Gin, Echo and Fiber. Projects: a concurrent link checker CLI and a production-style URL shortener API | 17 |
| 🐍 Python | Python 3.12 to 3.14: names, objects and mutability; collections, comprehensions, functions, closures and decorators; classes, dataclasses and the data model; exceptions, context managers, generators, type hints, pydantic and pytest; threads, processes, the GIL and asyncio; memory, the GC and profiling; pattern matching and what's new up to 3.14; uv, the library toolbox, WSGI/ASGI, FastAPI, Django, Flask and SQLAlchemy. Projects: a log-analytics CLI and a FastAPI + SQLAlchemy + JWT REST API | 18 |

Each chapter has explained code samples with their real output, a **Toolbox** of libraries (what each is for, when to pick it, a snippet) where it fits, step-by-step **Build** guides for the projects, interview questions, a quiz and a boss. In total: 70 chapters, 221 runnable samples, 8 guided projects, 233 libraries and 367 interview Q&As.

Plus the full **LeetCode Top Interview 150** study plan: all 150 problems grouped into 23 pattern categories, each linked to the lesson that teaches the pattern.

## Features

- **132 interactive visualizers**: step-through algorithm animations (sorting race, Dijkstra, DP tables, N-Queens…), live simulations (load balancer, rate limiters, Kafka consumer groups, Raft elections with partitions, quorums, retry storms, PagedAttention, continuous batching, a Kubernetes cluster you can break, an HPA autoscaler, deployment strategies, probes and CrashLoopBackOff, Argo CD drift, Kafka ISR failover, consumer rebalancing, exactly-once transactions, stream windows…), an on-call debugging drill, a broken-pod triage game, an agent-harness walkthrough, a prompt-injection playground, MoE routing, eval statistics, language internals (Java memory and GC, lazy streams, virtual threads, C++ pointers, smart pointers, move semantics and vtables, Go slices, channels and the scheduler, Python names and references, the GIL, the event loop and lazy generator pipelines), operating systems (CPU scheduling, a context switch, a race-condition playground, dining philosophers, the Banker's algorithm, address translation with a TLB, page replacement, a heap allocator, inodes and links, disk-arm scheduling, file permissions), compilers (a step-through lexer, DFAs, LL(1) and SLR parse tables, Pratt parsing, a bytecode stack machine, optimization passes to a fixpoint, linear-scan register allocation), Docker (a container lifecycle machine with signals, crashes, OOM kills and restart policies; copy-on-write overlayfs layers shared by two containers), and animated architecture diagrams.
- **Game layer**: XP, levels and titles, 1–3 stars per level, streaks, 40 achievements, boss battles with hearts and timers, daily challenge, 60-second rapid fire, spaced-repetition mock-interview flashcards, weekly and all-time leaderboards, chiptune sound effects.
- **LeetCode Top Interview 150** (`/leetcode-150`): all 150 problems (39 Easy / 93 Medium / 18 Hard). Each one has a hint, its key trick, a step-by-step approach, time/space complexity, the classic pitfall, a reference Python solution and a **step-through simulation** of the algorithm on its own page (`/leetcode-150/<slug>`). The simulations narrate every step on the LeetCode examples (arrays and pointers, sliding windows, hash maps, stacks, linked lists, trees, tries, graphs, recursion trees, DP tables), and you can type in your own input. Every category has a pattern guide (recognition signals, tricks, template code), plus a study plan, search and difficulty filters, and a solved tracker (+10 XP per problem, achievements at 25 / 75 / 150). The guides are generated by `npm run lc150:build`, which runs every solution against its tests first.
- **Coding challenges** (`/challenges`): 35 practical "build this" tasks of the kind companies give in live-coding rounds and take-homes. **Backend**: URL shortener API, rate limiter, REST CRUD with cursor pagination, idempotent payments, a resilient API client (retries, backoff, Retry-After), JWT auth, LRU cache with TTL, a transactional key-value store, a log analyzer. **Frontend** machine-coding: autocomplete, todo app, data table, accessible modal, tabs, accordion, star rating, file explorer, infinite scroll, OTP input, a useFetch hook, a carousel. **Language drills**: debounce, throttle, Promise.all, event emitter, deep clone, concurrency limits, retry decorators, context managers, generators, producer–consumer, worker pools, Java Streams, CompletableFuture. Each has the prompt, requirements, what's graded, an approach, edge cases, follow-ups and reference solutions in FastAPI, Express, Go, Java/Spring Boot, React + TypeScript and Vue. 65 of the solutions run against their own tests (`npm run challenges:test`).
- **Interview practice** (`/interview`): the parts of a loop that knowledge alone doesn't cover. **Behavioral** (`/interview/behavioral`): the STAR method, a story bank where you write 6–8 stories with live checks (spoken length, "I" vs "we", a number in the result, a lesson), coverage of 12 question themes and Amazon's 16 Leadership Principles, a timed out-loud practice drill, 30+ common questions with what they probe, worked example answers, and notes per company. **Mock interview** (`/interview/mock`): a timed 45-minute coding round (or a 60-minute practical build, or a 15-minute behavioral round) with phases, random interviewer interruptions, limited hints, an interviewer view for practicing with a friend, a big-tech style scorecard and a history of your scores. Stories and mock history stay in the browser.
- **Language Academy** (`/languages`): Java, C++, Go and Python tracks from beginner to advanced (see above). Every Java, C++ and Go sample with a `main`, and every Python sample, is compiled or run by `npm run languages:test`, and its printed output must match the page; each guided project is assembled from its steps and built and tested the same way.
- **Question bank**: every interview question with a model answer, filterable by world and frequency, plus 200+ curated LeetCode problems by topic.
- **Cheat sheets**: complexity tables, pattern recognition, latency numbers, estimation, system design template, distributed systems, AI inference formulas, infra/Kubernetes/SRE numbers, Docker, AI engineering & agents, operating systems and compilers.
- **Guest mode**: play without an account (progress in `localStorage`), then sign up and your progress is merged into the account.
- **Accounts**: sign in with username or email. Admin accounts see every level and boss unlocked.
- **Server-authoritative scoring** for signed-in players: quiz, boss, arena and daily answers are graded on the server with the same rules engine the client uses for guests.

## Tech stack

Next.js 16 (App Router, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Motion · Zustand · PostgreSQL + Prisma 6 · jose (JWT sessions) · bcryptjs · shiki (build-time syntax highlighting).

Course content is TypeScript data in `src/content` (versioned with the code and pre-rendered at build time). The database stores only players: users, progress, achievements, XP ledger and flashcard reviews.

## Getting started

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # then fill in DATABASE_URL and AUTH_SECRET
npm run db:push             # create tables (prisma db push)
npm run dev                 # http://localhost:3000
```

Environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | ≥ 32 random characters used to sign session cookies (`openssl rand -hex 32`) |

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npm run validate` (checks every lesson: quiz answer indices, diagram flows/edges, visualizer ids, boss question pools, and the LeetCode 150 list; it also traces all 150 simulations on every example and checks their answers, and checks the coding challenges).

Language Academy code lives in `src/content/languages/*.ts`. `npm run languages:test [filter]` compiles and runs every sample (Java 21+, a C++23 compiler, Go 1.24+, Python 3.12+) and checks its output, then builds each project from its steps and runs its `verify` command (which runs its tests). Python samples that define `test_` functions run under pytest. Point `LANG_JAVA`, `LANG_CXX`, `LANG_GO` and `LANG_PYTHON` at the toolchains if they aren't on your `PATH` (`LANG_PYTHON` can be a virtualenv's interpreter); missing toolchains are skipped, as are Python samples whose imports aren't installed for that interpreter and samples marked with a newer `minPython`. Samples that need third-party libraries are marked `noCheck` with the reason, and `LANG_NET=1` also runs the ones that download dependencies.

The same command also runs the operating-systems world's C, Python and shell samples (`npm run languages:test -- os`). C samples compile with `LANG_CC` (default `cc`) and must build cleanly under `-Wall -Wextra -Werror`. Samples marked `linux` (they use `/proc`, `epoll`, `seccomp`, namespaces, cgroups...) run natively on Linux, or in Docker on other systems when `LANG_LINUX_IMAGE` names a local image that has gcc and python3 (for example `LANG_LINUX_IMAGE=node:20`; the image is never pulled and runs without network). Samples marked `privileged` need root: they run in a `--privileged` container, or natively only as root, and are skipped otherwise.

The compilers world works the same way (`npm run languages:test -- compilers`). Its LLVM IR samples (`lang: "llvm"`) and the pebblec project need clang: `LANG_CLANG` (default `clang`) is used for them and exported to project tests as `$CLANG_CMD`, and they're skipped when it's missing. A project can continue an earlier one in the same world with `buildsOn: "<lesson id>"`: the earlier project's files are written first, so the pebblec compiler's tests run on top of the finished Pebble interpreter.

The Docker world's samples drive the local Docker engine (`npm run languages:test -- docker`). A sample marked `docker` is a bash script run on the host; its `files` (Dockerfile, app code, config) are shown as tabs on the page and written next to the script first. `images` lists the local images it needs: nothing is ever pulled, and a sample whose image is missing is skipped with the `docker pull` to run (the world uses `node:20`, `node:20-slim`, `postgres:16-alpine` and `ubuntu:24.04`). Output that legitimately changes between runs (IDs, PIDs, IPs, timings) is masked with the sample's `vary` regexes before comparing. Every container, network, volume and image a sample creates is named `quest-*` (`npm run validate` enforces it), and the runner removes them all before and after each sample. The Compose project runs its `smoke.sh` the same way (`docker: true` on the project), and the build-your-own-Docker project runs in a `--privileged` `LANG_LINUX_IMAGE` container.

Coding-challenge solutions live in `challenge-code/` as real source files. After editing one, run `npm run challenges:gen` to embed them into `src/content/challenges/code.generated.ts`, then `npm run challenges:test` to execute every solution against its test (Python, Node, Java 17+, Go 1.22+, and a strict `tsc` check for React components; a missing toolchain is skipped). The FastAPI/httpx/PyJWT and Express/jsonwebtoken solutions need those packages: point `CHALLENGE_PYTHON` at a Python that has them and `CHALLENGE_NODE_PATH` at a `node_modules` folder that has them.

### Admin accounts

Admins have every level and boss unlocked. Create one, or promote an existing account or reset its password, with:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
```

The password is stored only as a bcrypt hash. Pass the values as environment variables and never commit them.

## Project structure

```
prisma/schema.prisma            players, progress, achievements, XP ledger, flashcards
scripts/validate-content.ts     content linter (npm run validate)
scripts/create-admin.mts        create or promote an admin (npm run create-admin)
scripts/test-challenges.ts      runs every coding-challenge solution against its test
scripts/test-language-code.ts   compiles and runs every Language Academy sample and project (npm run languages:test)
challenge-code/                 coding-challenge solutions + tests (Python, JS, Java, Go, React, Vue)
src/app/                        pages + API route handlers
  worlds/[worldId]/[lessonId]   lesson page (statically generated)
  worlds/[worldId]/boss         boss battle
  languages/[lang]/[lessonId]   Language Academy chapter (Learn, Code, Toolbox, Build, Interview, Quiz)
  arena/{daily,rapid-fire,flashcards}
  api/{auth,me,action,daily,arena,leaderboard,profile}
src/content/
  types.ts                      Lesson / World / ArchDiagram schema
  worlds/*.ts                   all course content
  languages/*.ts                Java, C++, Go and Python tracks (samples, toolboxes, guided projects)
  cheatsheets.ts
  leetcode150.ts                LeetCode Top Interview 150 (problems, categories, hints)
  sims/                         LeetCode 150 step-through simulations, one module per category
  challenges/                   practical coding challenges (backend, frontend, language drills)
  interview.ts                  behavioral prep (STAR, themes, Amazon LPs, questions) + mock-interview phases and rubrics
src/lib/game/                   rules engine (XP, stars, streaks, achievements), shared by client & server
src/components/viz/             visualizers + registry.tsx (lazy-loaded by id)
```

## Adding a lesson

1. Add a `Lesson` object to the right file in `src/content/worlds/` (concept markdown, key points, code samples, interview Q&As, quiz, LeetCode problems).
2. Reference visualizers by id (`visualizers: ["sorting"]`) or add an animated architecture `diagram` (nodes, edges, flows).
3. New visualizer? Create a component in `src/components/viz/<area>/` and register it in `registry.tsx`.
4. Run `npm run validate`.

## Scoring rules

| Action | XP |
|---|---|
| Read a lesson / use a visualizer | +10 each (once) |
| Clear a quiz (≥ 50%) | +20, plus +20 per star (80% → 2★, 100% → 3★) |
| First boss win | +150 (+30 per extra heart left) |
| Daily challenge | +30 + 10 per correct answer (once per UTC day) |
| Arena / flashcards / boss replays | +5 per correct answer / +2 per review / +20, capped at 300 XP per day combined |
| Tick off a LeetCode 150 problem | +10 (taken back if you untick it) |
| Achievements | +25 to +500 |

## Deploying

**Docker (Deployzy or any container host):** the included `Dockerfile` builds the app and serves it on port 3000. Set `DATABASE_URL` and `AUTH_SECRET` as environment variables.

**Vercel:** import the repo, set `DATABASE_URL` and `AUTH_SECRET`, and deploy. `postinstall` runs `prisma generate`.

Either way, run `npm run db:push` against the production database once, and again after schema changes.
