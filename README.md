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

Every level has five stages — **Learn → Visualize → Code → Interview → Quiz** — and every world ends with a **boss battle**.

Plus the full **LeetCode Top Interview 150** study plan: all 150 problems grouped into 23 pattern categories, each linked to the lesson that teaches the pattern.

## Features

- **59 interactive visualizers**: step-through algorithm animations (sorting race, Dijkstra, DP tables, N-Queens…), live simulations (load balancer, rate limiters, Kafka consumer groups, Raft elections with partitions, quorums, retry storms, PagedAttention, continuous batching…) and animated system-design architecture diagrams.
- **Game layer**: XP, levels and titles, 1–3 stars per level, streaks, 30 achievements, boss battles with hearts and timers, daily challenge, 60-second rapid fire, spaced-repetition mock-interview flashcards, weekly and all-time leaderboards, chiptune sound effects.
- **LeetCode Top Interview 150** (`/leetcode-150`): all 150 problems (39 Easy / 93 Medium / 18 Hard) with a hint each, search and difficulty filters, a "learn the pattern" link per category, and a solved tracker (+10 XP per problem, achievements at 25 / 75 / 150).
- **Question bank**: every interview question with a model answer, filterable by world and frequency, plus 200+ curated LeetCode problems by topic.
- **Cheat sheets**: complexity tables, pattern recognition, latency numbers, estimation, system design template, distributed systems and AI inference formulas.
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

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npm run validate` (checks every lesson: quiz answer indices, diagram flows/edges, visualizer ids, boss question pools, and the LeetCode 150 list).

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
src/app/                        pages + API route handlers
  worlds/[worldId]/[lessonId]   lesson page (statically generated)
  worlds/[worldId]/boss         boss battle
  arena/{daily,rapid-fire,flashcards}
  api/{auth,me,action,daily,arena,leaderboard,profile}
src/content/
  types.ts                      Lesson / World / ArchDiagram schema
  worlds/*.ts                   all course content
  cheatsheets.ts
  leetcode150.ts                LeetCode Top Interview 150 (problems, categories, hints)
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
