import type { Lesson } from "../types";

// Docker, part 2: building images. Dockerfiles, layers and the cache, PID 1, small and secure images.

export const dockerPart2: Lesson[] = [
  // ------------------------------------------------------------------ DOCKERFILE
  {
    id: "dk-dockerfile",
    part: "Part 2 · Building images",
    title: "Your first Dockerfile",
    tagline: "Every instruction explained line by line (FROM, WORKDIR, COPY, RUN, ENV, EXPOSE, CMD), build time vs run time, the build context and .dockerignore.",
    difficulty: "beginner",
    minutes: 30,
    diagram: {
      title: "What docker build does",
      nodes: [
        { id: "folder", label: "Your folder", kind: "client", x: 100, y: 280, sub: "Dockerfile + code" },
        { id: "ignore", label: ".dockerignore", kind: "gateway", x: 300, y: 130, sub: "filters what's sent" },
        { id: "builder", label: "BuildKit", kind: "worker", x: 520, y: 280, sub: "runs each instruction" },
        { id: "base", label: "Base image", kind: "registry", x: 520, y: 470, sub: "FROM node:20-slim" },
        { id: "cache", label: "Build cache", kind: "cache", x: 740, y: 130, sub: "reuses unchanged steps" },
        { id: "image", label: "Your image", kind: "storage", x: 860, y: 340, sub: "base + new layers + config" },
      ],
      edges: [
        { from: "folder", to: "ignore", label: "build context" },
        { from: "ignore", to: "builder", label: "files to COPY" },
        { from: "base", to: "builder", label: "starting layers" },
        { from: "builder", to: "cache", label: "lookup" },
        { from: "builder", to: "image", label: "layers" },
      ],
      flows: [
        {
          name: "docker build -t hello .",
          path: ["folder", "ignore", "builder", "cache", "builder", "image"],
          steps: [
            "The dot is the build context: this folder. Docker gathers it up to send to the builder...",
            "...minus everything .dockerignore excludes (node_modules, .git, secrets).",
            "For each instruction, BuildKit first checks: have I done exactly this before, on exactly the same input?",
            "If yes it reuses the layer (CACHED). If not it runs the instruction and saves the result as a new layer.",
            "The result: the base image's layers, plus one new layer per file-changing instruction, plus a config saying what to run.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
A **Dockerfile** is a **recipe card** for making your lunchbox. Each line is one step:
1. "Start with a lunchbox that already has a sandwich in it" (\`FROM node:20-slim\`: start from an image that already has Node.js).
2. "Put everything in the big pocket" (\`WORKDIR /app\`).
3. "Add my apple" (\`COPY server.js .\`).
4. "Cut the apple into slices now, so it's ready later" (\`RUN ...\`: do work **while packing**).
5. "When someone opens the box, they should eat the apple" (\`CMD ...\`: what happens **when it's opened**).

\`docker build\` follows the recipe and gives you a packed lunchbox (the image). \`docker run\` opens one.

The most important difference to remember: **RUN happens once, while you pack**. **CMD happens every time someone opens a lunchbox.**

## The instructions
| Instruction | When it runs | What it does |
|---|---|---|
| \`FROM image\` | build | the starting point: every Dockerfile begins with one |
| \`WORKDIR /app\` | build | sets (and creates) the current directory for the following instructions and for the container |
| \`COPY src dest\` | build | copies files from the **build context** into the image (\`--chown\`, \`--from\` for other stages) |
| \`RUN command\` | build | runs a command and saves the filesystem changes as a layer: install packages, compile code |
| \`ENV KEY=value\` | build + run | sets environment variables for later instructions *and* for containers |
| \`ARG NAME=default\` | build only | a variable you pass with \`--build-arg\`; gone at run time |
| \`EXPOSE 3000\` | metadata | documents the port the app listens on |
| \`USER node\` | build + run | which user runs later instructions and the container |
| \`CMD ["node", "server.js"]\` | run | the default command for containers (one per image; the last wins) |
| \`ENTRYPOINT [...]\` | run | the fixed program; CMD becomes its default arguments (next lessons) |
| \`HEALTHCHECK\`, \`LABEL\`, \`STOPSIGNAL\`, \`VOLUME\`, \`SHELL\` | metadata | health probes, labels, the stop signal... |

\`COPY\` vs \`ADD\`: \`ADD\` can also fetch URLs and auto-extract tar files. That magic surprises people, so use \`COPY\` unless you specifically want extraction.

## The build context and .dockerignore
In \`docker build -t hello .\`, the final \`.\` is the **build context**: the folder whose files \`COPY\` can see. Paths in \`COPY\` are relative to it, and you can't \`COPY ../secret\` from outside it. The Dockerfile itself is found at \`./Dockerfile\` unless you pass \`-f\`.

A \`.dockerignore\` file (same syntax as \`.gitignore\`) keeps files out of the context. Always ignore:
- \`node_modules\`, \`venv\`, \`target\`, \`dist\`: dependencies and build outputs should be built *inside* the image, for the image's OS;
- \`.git\`: large, and changes on every commit, which breaks the cache;
- \`.env\`, keys, credentials: anything copied into an image can be read by anyone who has the image;
- logs and editor junk.

## Shell form vs exec form
\`RUN\`, \`CMD\` and \`ENTRYPOINT\` accept two syntaxes:
- **shell form**: \`RUN apt-get update && apt-get install -y curl\`, run as \`/bin/sh -c "..."\`, so you get variables, \`&&\`, pipes and globs;
- **exec form**: \`CMD ["node", "server.js"]\`, a JSON array, run directly with no shell in between.

Use the shell form for \`RUN\` (it's convenient) and the **exec form for CMD and ENTRYPOINT**. Why that matters is the PID 1 lesson.

## Writing RUN lines well
- Combine related commands in one \`RUN\` and clean up in the **same** line, because each RUN is a layer and files deleted in a later layer still take space:
  \`RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*\`
- Pin versions of what you install where it matters, so rebuilding next month gives the same result.
- Make builds non-interactive (\`-y\`, \`DEBIAN_FRONTEND=noninteractive\`) because nobody is there to answer prompts.

## Building and tagging
\`docker build -t name:tag .\` builds and names the image. Useful flags: \`-f path/Dockerfile\`, \`--build-arg KEY=value\`, \`--target stage\`, \`--no-cache\`, \`--progress=plain\` (full output), \`--platform\`, \`-q\` (only print the image ID). Modern Docker uses **BuildKit**, which runs independent steps in parallel, caches aggressively and supports secret and cache mounts.`,
    keyPoints: [
      "A Dockerfile is a recipe: FROM a base, then WORKDIR, COPY, RUN, ENV... and finally CMD for what containers run.",
      "RUN executes once at build time and its result is saved in the image; CMD runs every time a container starts.",
      "The build context (the . in docker build .) is what COPY can see; .dockerignore keeps node_modules, .git and secrets out of it.",
      "Use the exec form (JSON array) for CMD and ENTRYPOINT; the shell form for RUN is fine.",
      "Each RUN is a layer: install and clean up in the same RUN, and prefer COPY over ADD.",
    ],
    code: [
      {
        title: "Build an image, run it twice",
        docker: true,
        images: ["node:20-slim"],
        vary: ["v20\\.\\d+\\.\\d+"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `# 1. Start from an image that already has Node.js installed
FROM node:20-slim

# 2. Every instruction after this runs in /app (Docker creates it)
WORKDIR /app

# 3. RUN happens once, while the image is being BUILT. Its result is saved in the image.
RUN echo "built with Node $(node --version)" > build-info.txt

# 4. Copy our program from this folder (the build context) into the image
COPY server.js .

# 5. Default settings; anyone can override them with docker run -e
ENV PORT=3000 GREETING=Hello

# 6. Documentation only: "this app listens on 3000". It doesn't publish anything.
EXPOSE 3000

# 7. CMD happens every time a CONTAINER starts
CMD ["node", "server.js"]` },
          { path: "server.js", lang: "javascript", code: `const fs = require("fs");
const http = require("http");

const info = fs.readFileSync("build-info.txt", "utf8").trim();
const port = Number(process.env.PORT);

http
  .createServer((req, res) => res.end(\`\${process.env.GREETING}! I was \${info}.\\n\`))
  .listen(port, "0.0.0.0", () => console.log(\`listening on \${port}\`));` },
        ],
        variants: [{ lang: "bash", code: `# Build an image from the Dockerfile in this folder (.) and name it quest-hello
docker build -q -t quest-hello . > /dev/null
docker images quest-hello --format '{{.Repository}}:{{.Tag}}'

# Run it twice: same image, two containers, different settings
docker run -d --name quest-a -p 8080:3000 quest-hello > /dev/null
docker run -d --name quest-b -p 8081:3000 -e GREETING=Bonjour quest-hello > /dev/null
sleep 1
curl -s http://localhost:8080
curl -s http://localhost:8081

# Each instruction left a record in the image's history (newest first)
docker history quest-hello --format '{{.CreatedBy}}' | head -n 6` }],
        explain: `- \`docker build -t quest-hello .\` reads \`./Dockerfile\` and names the result. \`-q\` keeps the output quiet; drop it to watch each step.
- \`RUN echo ... > build-info.txt\` ran **once**, during the build: both containers report the same build-time text without running it again.
- The two containers come from one image but get different settings: \`ENV GREETING=Hello\` is the default, and \`-e GREETING=Bonjour\` overrides it for one container.
- \`docker history\` lists one entry per instruction, newest first. \`RUN\` in shell form was stored as \`/bin/sh -c ...\`; \`COPY\`, \`ENV\`, \`EXPOSE\` and \`CMD\` are recorded too (the metadata ones add no files).`,
        output: `quest-hello:latest
Hello! I was built with Node v20.20.2.
Bonjour! I was built with Node v20.20.2.
CMD ["node" "server.js"]
EXPOSE [3000/tcp]
ENV PORT=3000 GREETING=Hello
COPY server.js . # buildkit
RUN /bin/sh -c echo "built with Node $(node …
WORKDIR /app`,
      },
      {
        title: "The build context and .dockerignore",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "shop/Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
COPY . .
CMD ["ls", "-A", "/app"]` },
          { path: "shop/.dockerignore", lang: "text", code: `# Never send these to the builder
.git
node_modules
*.log
.env` },
          { path: "shop/package.json", lang: "json", code: `{ "name": "ctx-demo" }` },
          { path: "shop/src/app.js", lang: "javascript", code: `console.log("hi")` },
        ],
        variants: [{ lang: "bash", code: `cd shop
# Some junk that piles up in every real project folder:
mkdir -p node_modules/left-pad && echo "module.exports = () => {}" > node_modules/left-pad/index.js
echo "DB_PASSWORD=hunter2" > .env
echo "lots of debug output" > debug.log

echo "--- in the folder (the build context):"
ls -A
docker build -q -t quest-ctx . > /dev/null
echo "--- inside the image, after COPY . . :"
docker run --rm quest-ctx` }],
        explain: `- \`COPY . .\` copies the whole build context... except what \`.dockerignore\` lists. The leaked password in \`.env\`, the host's \`node_modules\` and the log file never reach the builder.
- Without the ignore file, every image would carry your local secrets, and every tiny log change would invalidate the build cache.
- The \`Dockerfile\` and \`.dockerignore\` themselves were copied in. Harmless here, but you can list them in \`.dockerignore\` too, or better, \`COPY\` only the folders you need (\`COPY src/ ./src/\`).`,
        output: `--- in the folder (the build context):
.dockerignore
.env
Dockerfile
debug.log
node_modules
package.json
src
--- inside the image, after COPY . . :
.dockerignore
Dockerfile
package.json
src`,
      },
    ],
    interview: [
      {
        q: "What's the difference between RUN, CMD and ENTRYPOINT?",
        a: "`RUN` executes a command **at build time** and commits the resulting filesystem changes as a new layer: installing packages, compiling. `CMD` and `ENTRYPOINT` are **run-time** metadata: what a container executes when it starts. `ENTRYPOINT` is the fixed executable; `CMD` provides default arguments to it (or the whole command if there's no entrypoint). Arguments after the image name in `docker run` replace `CMD`; `--entrypoint` replaces `ENTRYPOINT`. Only the last CMD/ENTRYPOINT in a Dockerfile counts.",
        freq: "very-common",
      },
      {
        q: "COPY vs ADD?",
        a: "Both copy files from the build context into the image. `ADD` additionally downloads remote URLs and automatically extracts local tar archives (gzip/bzip2/xz). That implicit behaviour is surprising and makes builds less predictable, and remote downloads aren't cached by content the way you'd expect, so best practice is to use `COPY` for everything and use `ADD` only when you explicitly want tar extraction. For downloads, `RUN curl ... && verify checksum` gives more control.",
        freq: "common",
      },
      {
        q: "What is the build context, and why does .dockerignore matter?",
        a: "The build context is the directory (or URL/tarball) given to `docker build`; it's sent to the builder and is the only place `COPY`/`ADD` can read from. `.dockerignore` excludes paths from it. It matters for **speed** (not shipping gigabytes of `node_modules` or `.git`), **cache correctness** (irrelevant files changing would invalidate `COPY . .`), **correctness** (host-built dependencies for the wrong OS sneaking in) and **security** (`.env` files, SSH keys and credentials ending up in an image layer that anyone with the image can extract).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "When does `RUN npm ci` execute?",
        options: ["Every time a container starts", "Once, while the image is being built", "Only when you run docker exec", "When the image is pushed"],
        answer: 1,
        explain: "RUN is a build-time step; its result is saved in a layer. CMD is what runs at container start.",
      },
      {
        q: "In `docker build -t app .`, what is the `.`?",
        options: ["The image name", "The build context: the folder COPY can read from", "The current container", "The Dockerfile's name"],
        answer: 1,
        explain: "The last argument is the build context. Docker looks for ./Dockerfile in it unless you pass -f.",
      },
      {
        q: "Why should node_modules be in .dockerignore?",
        options: ["Docker can't copy folders", "Dependencies should be installed inside the image for its OS; copying the host's is slow, may break, and busts the cache", "npm forbids it", "It makes the image run as root"],
        answer: 1,
        explain: "Install dependencies in the image (RUN npm ci). The host's node_modules may contain native binaries built for another OS.",
      },
      {
        q: "Which form should CMD use?",
        options: ["Shell form: CMD node server.js", "Exec form: CMD [\"node\", \"server.js\"]", "Either, they're identical", "CMD must use ENTRYPOINT"],
        answer: 1,
        explain: "The exec form runs your program directly as PID 1, so it receives signals like SIGTERM. The shell form wraps it in /bin/sh.",
      },
      {
        q: "You write `RUN apt-get install -y build-essential` and in the next line `RUN apt-get remove -y build-essential`. Is the image smaller?",
        options: ["Yes, the packages are removed", "No: the first layer still contains them; the second only hides them", "Only with --no-cache", "Only on alpine"],
        answer: 1,
        explain: "Layers are additive. Install and clean up in the same RUN, or use a multi-stage build.",
      },
    ],
  },

  // ------------------------------------------------------------------ LAYERS & CACHE
  {
    id: "dk-layers-cache",
    title: "Layers and the build cache",
    tagline: "How each instruction becomes a layer, exactly when the cache is reused or invalidated, why instruction order makes builds 50x faster, and cache mounts for package managers.",
    difficulty: "intermediate",
    minutes: 25,
    visualizers: ["layers"],
    concept: `## Explain it like I'm 10 🧸
Imagine building a tower of LEGO bricks, one brick per recipe step, and taking a **photo** after each brick. Next time you build the same tower, you look at your photos: "step 1 is the same as last time? Use the photo, skip it. Step 2 the same? Skip it." You only start building for real at the **first step that changed**, and from then on you must rebuild every brick above it, because they were sitting on the old one.

So the trick is: put the bricks that **never change** at the bottom, and the ones that change **all the time** (your code) at the top. Then most rebuilds only redo the top brick.

## Layers
Every instruction that changes files (\`RUN\`, \`COPY\`, \`ADD\`) produces a **layer**: a tarball of exactly the files it added, changed or deleted. Metadata instructions (\`ENV\`, \`CMD\`, \`EXPOSE\`...) change only the config. An image is its base's layers plus yours, stacked in order.

Layers are **immutable and additive**: a later layer can hide a file from an earlier one, but never shrink it. That's why \`RUN rm\` in a separate step doesn't make an image smaller.

## How the cache decides
For each instruction, in order, BuildKit computes a **cache key** from:
- the cache key of the previous step (so everything is chained),
- the instruction text itself (\`RUN npm ci\`),
- for \`COPY\`/\`ADD\`: a **checksum of the copied files' contents** (not their timestamps),
- build args used by the step.

If a step with the same key exists, it's reused (\`CACHED\`). The first step whose key changed is **rebuilt, and so is every step after it**.

Things that do **not** invalidate the cache, often to people's surprise:
- \`RUN apt-get update\` or \`RUN curl https://...\`: the text didn't change, so the old result is reused even if the internet has newer packages. Use \`--no-cache\` or \`--pull\` for fresh base images and packages (scheduled rebuilds in CI pick up security fixes).
- touching a file without changing it: only content matters.

## Order your Dockerfile for the cache
The single most effective optimization:

\`\`\`dockerfile
COPY package.json package-lock.json ./   # changes rarely
RUN npm ci                               # slow: minutes
COPY . .                                 # changes on every edit
\`\`\`

Editing your code only invalidates the last \`COPY\`, so \`npm ci\` comes from the cache and a rebuild takes a second. With \`COPY . .\` first, every code change would reinstall every dependency. The same pattern works everywhere: \`requirements.txt\` / \`pip install\`, \`go.mod\` / \`go mod download\`, \`pom.xml\` / \`mvn dependency:go-offline\`, \`Cargo.toml\` / a dummy build.

## Cache mounts: keep the package manager's cache between builds
Even when \`npm ci\` must rerun, it doesn't have to redownload everything. BuildKit can mount a persistent cache directory into one \`RUN\` step, **outside** the image:

\`\`\`dockerfile
RUN --mount=type=cache,target=/root/.npm npm ci
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN --mount=type=cache,target=/go/pkg/mod go mod download
\`\`\`

## The cache in CI
CI runners usually start empty, so there's no local cache. Export and import it: \`docker buildx build --cache-to type=registry,ref=ghcr.io/you/app:buildcache --cache-from type=registry,ref=...\`, or \`type=gha\` on GitHub Actions. Part 5 shows a full pipeline.

## Seeing what happened
- \`docker build --progress=plain .\` prints every step and whether it was \`CACHED\`.
- \`docker history IMAGE\` shows each layer's size and the instruction that made it.
- \`docker builder prune\` clears the build cache; \`docker system df\` shows how big it is.`,
    keyPoints: [
      "RUN, COPY and ADD each create a layer; layers are immutable and additive, so deleting later never shrinks an image.",
      "A step's cache key chains the previous key, the instruction text and (for COPY) the checksum of the copied files' contents.",
      "The first changed step and every step after it are rebuilt, so order instructions from rarely to frequently changing.",
      "Copy dependency manifests and install dependencies before copying source code; that one change makes rebuilds seconds instead of minutes.",
      "RUN apt-get update is cached forever unless the line or a step before it changes: rebuild with --pull/--no-cache regularly. Cache mounts keep package caches across builds.",
    ],
    code: [
      {
        title: "Watch the cache work",
        note: "Dependencies first, code last.",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
# Dependencies first: these lines change rarely...
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# ...the code last: it changes all the time
COPY app.js .
CMD ["node", "app.js"]` },
          { path: "package.json", lang: "json", code: `{
  "name": "quest-shop",
  "version": "1.0.0",
  "private": true
}` },
          { path: "package-lock.json", lang: "json", code: `{
  "name": "quest-shop",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "quest-shop",
      "version": "1.0.0"
    }
  }
}` },
          { path: "app.js", lang: "javascript", code: `console.log("shop v1");` },
        ],
        variants: [{ lang: "bash", code: `# Build, then print one line per COPY/RUN step: did it RUN, or come from the cache?
build() {
  docker build --progress=plain -t quest-cache "$@" . 2>&1 | awk '
    /^#[0-9]+ \\[[0-9]+\\/[0-9]+\\] (COPY|RUN)/ { n = $1; $1 = ""; step[n] = $0 }
    /^#[0-9]+ (CACHED|DONE)/ && ($1 in step) {
      split(step[$1], part, /[[\\/]/)
      print part[2] "\\t" ($2 == "CACHED" ? "  cached" : "  RAN   ") step[$1]
    }' | sort -n | cut -f 2-
}
# The cache remembers every build it has ever done, so make each edit unique:
stamp="$(date +%s)-$RANDOM"

echo "1) first build (--no-cache: as if we'd never built it):"
build --no-cache
echo "2) build again, nothing changed:"
build
echo "3) edit app.js and build:"
echo "console.log('shop v2'); // edit $stamp" > app.js
build
echo "4) change package.json and build:"
cat > package.json <<JSON
{
  "name": "quest-shop",
  "version": "1.0.0",
  "description": "edit $stamp",
  "private": true
}
JSON
build
docker run --rm quest-cache` }],
        explain: `- The \`build\` function runs \`docker build --progress=plain\` and turns BuildKit's output into one line per \`COPY\`/\`RUN\` step: \`CACHED\` or \`RAN\`. (Real projects would just read the progress output.)
- 1) \`--no-cache\` runs everything. 2) Nothing changed, so everything is cached.
- 3) Only \`app.js\` changed: the first two steps are still cached, and only \`COPY app.js\` reruns. **\`npm ci\` didn't run.**
- 4) \`package.json\` changed, so its \`COPY\` reruns, which invalidates \`npm ci\` and everything after it.
- The cache compares **file contents**, and remembers every build it has ever done. The \`stamp\` just makes this demo's edits new each time you run it.`,
        output: `1) first build (--no-cache: as if we'd never built it):
  RAN    [3/5] COPY package.json package-lock.json ./
  RAN    [4/5] RUN npm ci --omit=dev
  RAN    [5/5] COPY app.js .
2) build again, nothing changed:
  cached [3/5] COPY package.json package-lock.json ./
  cached [4/5] RUN npm ci --omit=dev
  cached [5/5] COPY app.js .
3) edit app.js and build:
  cached [3/5] COPY package.json package-lock.json ./
  cached [4/5] RUN npm ci --omit=dev
  RAN    [5/5] COPY app.js .
4) change package.json and build:
  RAN    [3/5] COPY package.json package-lock.json ./
  RAN    [4/5] RUN npm ci --omit=dev
  RAN    [5/5] COPY app.js .
shop v2`,
      },
      {
        title: "The slow way: COPY everything first",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
# Everything at once: ANY edit to ANY file changes this layer...
COPY . .
# ...so this slow step re-runs on every single code change
RUN npm ci --omit=dev
CMD ["node", "app.js"]` },
          { path: "package.json", lang: "json", code: `{
  "name": "quest-shop",
  "version": "1.0.0",
  "private": true
}` },
          { path: "package-lock.json", lang: "json", code: `{
  "name": "quest-shop",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "quest-shop",
      "version": "1.0.0"
    }
  }
}` },
          { path: "app.js", lang: "javascript", code: `console.log("shop v1");` },
        ],
        variants: [{ lang: "bash", code: `build() {
  docker build --progress=plain -t quest-naive "$@" . 2>&1 | awk '
    /^#[0-9]+ \\[[0-9]+\\/[0-9]+\\] (COPY|RUN)/ { n = $1; $1 = ""; step[n] = $0 }
    /^#[0-9]+ (CACHED|DONE)/ && ($1 in step) {
      split(step[$1], part, /[[\\/]/)
      print part[2] "\\t" ($2 == "CACHED" ? "  cached" : "  RAN   ") step[$1]
    }' | sort -n | cut -f 2-
}
build > /dev/null
echo "edit one line of app.js and build:"
echo "console.log('shop v2'); // edit $(date +%s)-$RANDOM" > app.js
build` }],
        explain: `- \`COPY . .\` puts every file into one layer, so changing **any** file, even one line of \`app.js\`, changes its checksum.
- Everything after it reruns, including the dependency install. With a real project that's minutes per build, for every developer, on every change.
- Compare with the previous sample: same files, same result, only the order differs.`,
        output: `edit one line of app.js and build:
  RAN    [3/4] COPY . .
  RAN    [4/4] RUN npm ci --omit=dev`,
      },
    ],
    interview: [
      {
        q: "How does the Docker build cache work, and how do you make builds fast?",
        a: "Each instruction's cache key is derived from the previous step's key, the instruction itself, and for `COPY`/`ADD` the **content checksums** of the files copied. If a matching result exists it's reused; the first miss rebuilds that step and **all following steps**. To make builds fast: order instructions from least to most frequently changing; copy dependency manifests (`package*.json`, `requirements.txt`, `go.mod`) and install dependencies *before* copying source; keep the context small with `.dockerignore`; use BuildKit **cache mounts** (`RUN --mount=type=cache,...`) for package manager caches; use multi-stage builds so stages build in parallel; and in CI export/import the cache (`--cache-to/--cache-from`, registry or GitHub Actions backends).",
        freq: "very-common",
      },
      {
        q: "Why might a Docker build use outdated packages, and how do you avoid it?",
        a: "Cache keys depend on the instruction **text**, not on the outside world. `RUN apt-get update && apt-get install -y curl` is cached as long as that line and the steps before it are unchanged, so you keep getting the packages from the first build, security fixes included or not. Likewise the base image tag is resolved from the local copy. Fixes: rebuild periodically with `--pull` (fresh base image) and `--no-cache`, pin versions explicitly and bump them (Renovate/Dependabot), and keep `apt-get update` in the same `RUN` as `install` so a changed package list always re-updates.",
        freq: "common",
      },
      {
        q: "An image is 1.2 GB although the app is 20 MB. Where do you look?",
        a: "`docker history --no-trunc IMAGE` (or the `dive` tool) shows each layer's size and the instruction that created it. Usual culprits: a heavy base image (full `node`/`python` instead of `-slim`/alpine/distroless); build tools and compilers left in the final image (fix with multi-stage builds); package manager caches (`/var/lib/apt/lists`, `~/.npm`, `pip` cache) not cleaned in the same `RUN`; files deleted in a later layer (still present below); a huge build context copied in by `COPY . .` (`.git`, `node_modules`, data files) without `.dockerignore`; and dev dependencies installed in production.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which Dockerfile order gives the fastest rebuilds after a code change?",
        options: ["COPY . . then RUN npm ci", "COPY package*.json ./, RUN npm ci, then COPY . .", "RUN npm ci, then COPY package*.json ./", "Order doesn't matter with BuildKit"],
        answer: 1,
        explain: "Dependencies are installed from manifests that rarely change; code edits only invalidate the final COPY.",
      },
      {
        q: "You edit app.js. In `FROM node; COPY package.json .; RUN npm ci; COPY app.js .; RUN npm run build`, which steps rerun?",
        options: ["All of them", "COPY app.js and RUN npm run build", "Only RUN npm run build", "Only COPY app.js"],
        answer: 1,
        explain: "The first changed step (COPY app.js) and every step after it are rebuilt.",
      },
      {
        q: "What does the cache key of a COPY step depend on?",
        options: ["The files' modification times", "The contents of the copied files (and the previous step)", "The current date", "The size of the build context"],
        answer: 1,
        explain: "BuildKit checksums the content. Touching a file without changing it keeps the cache.",
      },
      {
        q: "Your Dockerfile has `RUN apt-get update && apt-get install -y openssl`, unchanged for 6 months. Do new builds get the latest openssl?",
        options: ["Yes, apt-get update always runs", "No: the step is cached, so you get the packages from the first build", "Only on Mondays", "Only if openssl is pinned"],
        answer: 1,
        explain: "The instruction text didn't change, so the cached layer is reused. Rebuild with --no-cache/--pull regularly.",
      },
      {
        q: "What does `RUN --mount=type=cache,target=/root/.npm npm ci` do?",
        options: ["Stores node_modules in the image cache", "Gives npm a persistent download cache that survives between builds but isn't part of the image", "Disables the layer cache", "Mounts the host's node_modules"],
        answer: 1,
        explain: "Cache mounts keep package caches across builds without adding them to any layer.",
      },
    ],
  },

  // ------------------------------------------------------------------ CMD, ENTRYPOINT, PID 1
  {
    id: "dk-cmd-entrypoint",
    title: "CMD, ENTRYPOINT and PID 1",
    tagline: "How CMD and ENTRYPOINT combine, why the shell form breaks docker stop, what's special about PID 1, graceful shutdown with SIGTERM, and when you need --init.",
    difficulty: "intermediate",
    minutes: 25,
    visualizers: ["containerlife"],
    concept: `## Explain it like I'm 10 🧸
When it's time to go home from the playground, the teacher first says "**please** get your things and line up" (that's **SIGTERM**, a polite request). Kids who listen grab their bags and go. If a kid ignores it, after ten minutes the teacher **picks them up and carries them out** (that's **SIGKILL**: no choice, no time to grab the bag).

In a container, Docker is the teacher and the **first program**, PID 1, is the kid who's supposed to hear the message. Now imagine you put a **messenger** in front of your program: a shell. The teacher talks to the messenger, the messenger doesn't pass it on, and your program never hears "please go home". Ten minutes later it gets carried out mid-game and loses its unsaved work. That's what the shell form of CMD does.

## ENTRYPOINT + CMD = the command
A container runs \`ENTRYPOINT\` followed by \`CMD\`:

| Dockerfile | \`docker run img\` | \`docker run img world\` |
|---|---|---|
| \`CMD ["echo", "hi"]\` | \`echo hi\` | \`world\` (replaces everything) |
| \`ENTRYPOINT ["echo"]\` + \`CMD ["hi"]\` | \`echo hi\` | \`echo world\` |
| \`ENTRYPOINT ["echo", "hi"]\` | \`echo hi\` | \`echo hi world\` |

So: **ENTRYPOINT is the program, CMD is its default arguments.** Words after the image name replace CMD; \`--entrypoint\` replaces the ENTRYPOINT. Use CMD alone for normal apps (easy to override with a shell for debugging), ENTRYPOINT + CMD for images that behave like a command-line tool (\`docker run mytool --help\`).

Official images often use an entrypoint **script** (\`docker-entrypoint.sh\`) that prepares things (creates the database on first start, fixes permissions) and then ends with \`exec "$@"\` to *replace itself* with the CMD. That \`exec\` is essential, for the reason below.

## PID 1 is special
The first process in a PID namespace has two jobs no other process has:
1. **Signals**: the kernel doesn't apply default signal actions to PID 1. A normal process dies on SIGTERM if it has no handler; PID 1 just **ignores** it. So your app must install a SIGTERM handler, or it can only be killed with SIGKILL.
2. **Zombies**: when any process's parent dies, the orphan is re-parented to PID 1, which must \`wait()\` for it when it exits. An app that never does leaves **zombie** processes piling up.

## Why the shell form breaks docker stop
\`CMD npm start\` or \`CMD echo starting && node server.js\` is the **shell form**: Docker runs \`/bin/sh -c "..."\`, so **sh is PID 1** and your app is its child. \`docker stop\` sends SIGTERM to sh, which doesn't forward it. Nothing happens for 10 seconds, then SIGKILL: in-flight requests are dropped, files aren't flushed, database connections aren't closed, and the exit code is **137**. Every deploy and every scale-down in Kubernetes does this to your users.

The fixes:
- Use the **exec form**: \`CMD ["node", "server.js"]\`. Your app is PID 1 and receives SIGTERM.
- In entrypoint scripts, start the app with \`exec\`: \`exec node server.js\`, \`exec "$@"\`.
- Don't start through wrappers that swallow signals (\`npm start\`, some process managers); run the binary directly.
- Handle SIGTERM in your app: stop accepting new work, finish in-flight requests, close connections, exit 0.

## --init and tini
If your app spawns child processes or you can't add signal handling, put a tiny init in front of it: \`docker run --init\` (Compose: \`init: true\`) runs **tini** as PID 1. It forwards signals to your process and reaps zombies. Images can also install tini and use \`ENTRYPOINT ["tini", "--"]\`.

## Graceful shutdown, end to end
1. The orchestrator decides to stop a container (deploy, scale down, node drain).
2. In Kubernetes the pod is removed from the Service endpoints; Docker sends **SIGTERM** (or the image's \`STOPSIGNAL\`; nginx uses SIGQUIT for graceful shutdown).
3. The app stops accepting connections and finishes current work within the grace period (\`docker stop -t\`, Compose \`stop_grace_period\`, Kubernetes \`terminationGracePeriodSeconds\`, 30 s by default).
4. It exits with 0. Anything still running when the grace period ends gets SIGKILL.`,
    keyPoints: [
      "The container runs ENTRYPOINT + CMD: ENTRYPOINT is the program, CMD its default arguments; arguments to docker run replace CMD.",
      "PID 1 ignores signals it has no handler for, and must reap zombie processes.",
      "Shell-form CMD makes /bin/sh PID 1, which doesn't forward SIGTERM: docker stop waits the full timeout and SIGKILLs (exit 137).",
      "Use exec-form CMD/ENTRYPOINT, exec in entrypoint scripts, and handle SIGTERM in your app for graceful shutdown.",
      "docker run --init (tini) forwards signals and reaps zombies when your app can't.",
    ],
    code: [
      {
        title: "Shell form vs exec form under docker stop",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "server.js", lang: "javascript", code: `const http = require("http");
const server = http.createServer((req, res) => res.end("ok\\n")).listen(3000);

// Graceful shutdown: finish what we're doing, then exit.
process.on("SIGTERM", () => {
  console.log("SIGTERM received: closing the server");
  server.close(() => process.exit(0));
});` },
          { path: "Dockerfile.shell", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
COPY server.js .
# shell form: Docker runs  /bin/sh -c "echo starting && node server.js"
CMD echo starting && node server.js` },
          { path: "Dockerfile.exec", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
COPY server.js .
# exec form: Docker runs node directly, no shell in between
CMD ["node", "server.js"]` },
        ],
        variants: [{ lang: "bash", code: `for form in shell exec; do
  docker build -q -t quest-$form -f Dockerfile.$form . > /dev/null
  docker run -d --name quest-$form quest-$form > /dev/null
  sleep 1
  echo "== $form form"
  echo "PID 1 is: $(docker exec quest-$form cat /proc/1/cmdline | tr '\\0' ' ')"
  start=$(date +%s)
  docker stop -t 3 quest-$form > /dev/null          # SIGTERM, then SIGKILL after 3 s
  took=$(( $(date +%s) - start ))
  [ "$took" -ge 2 ] && echo "stop: waited for the timeout, then killed" || echo "stop: exited right away"
  echo "exit code: $(docker inspect -f '{{.State.ExitCode}}' quest-$form)"
  docker logs quest-$form
done` }],
        explain: `- Both images run the same server, which handles SIGTERM properly. Only the CMD line differs.
- \`/proc/1/cmdline\` shows PID 1. With the shell form it's \`/bin/sh -c ...\`: the shell, not node.
- \`docker stop -t 3\` sends SIGTERM and waits up to 3 s. The shell ignores it, so Docker has to SIGKILL: exit code **137**, and our "SIGTERM received" line never appears in the logs.
- With the exec form, node is PID 1, gets SIGTERM, closes the server and exits with **0** right away.`,
        output: `== shell form
PID 1 is: /bin/sh -c echo starting && node server.js 
stop: waited for the timeout, then killed
exit code: 137
starting
== exec form
PID 1 is: node server.js 
stop: exited right away
exit code: 0
SIGTERM received: closing the server`,
      },
      {
        title: "ENTRYPOINT is the program, CMD the default arguments",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
WORKDIR /app
COPY greet.js .
# ENTRYPOINT = the program. CMD = its default arguments.
ENTRYPOINT ["node", "greet.js"]
CMD ["world"]` },
          { path: "greet.js", lang: "javascript", code: `const name = process.argv[2] ?? "nobody";
console.log(\`Hello, \${name}!\`);` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-greet . > /dev/null

docker run --rm quest-greet                 # node greet.js world
docker run --rm quest-greet Docker          # words after the image REPLACE CMD
docker run --rm quest-greet "Ada Lovelace"
docker run --rm --entrypoint node quest-greet --version   # replace the program itself` }],
        explain: `- No arguments: the container runs \`node greet.js world\`, ENTRYPOINT plus CMD.
- Anything after the image name **replaces CMD only**: \`node greet.js Docker\`. The image behaves like a command-line tool.
- \`--entrypoint node\` swaps the program itself; the remaining words become its arguments. That's also how you get a shell in an image with an entrypoint: \`docker run -it --entrypoint sh IMAGE\`.`,
        output: `Hello, world!
Hello, Docker!
Hello, Ada Lovelace!
v20.20.2`,
      },
      {
        title: "Who is PID 1 with --init?",
        docker: true,
        images: ["node:20"],
        vary: ["^\\s+\\d+ ps$"],
        variants: [{ lang: "bash", code: `# Without --init, your program is PID 1
docker run --rm node:20 ps -o pid,comm
echo ---
# With --init, a tiny init process (tini) is PID 1: it forwards signals and reaps zombies
docker run --rm --init node:20 ps -o pid,comm` }],
        explain: `- Without \`--init\`, the command you run (\`ps\` here) is PID 1 and carries PID 1's duties.
- With \`--init\`, Docker injects \`docker-init\` (tini) as PID 1 and runs your command as its child. tini forwards every signal it receives and reaps zombies, then exits with your process's exit code.
- Use it for apps that spawn subprocesses (shell scripts, headless browsers, test runners) or that can't install a SIGTERM handler.`,
        output: `  PID COMMAND
    1 ps
---
  PID COMMAND
    1 docker-init
    7 ps`,
      },
    ],
    interview: [
      {
        q: "Why does docker stop take 10 seconds and then kill my app?",
        a: "`docker stop` sends SIGTERM to **PID 1** and waits 10 s before SIGKILL. If it always takes the full 10 s, PID 1 isn't acting on SIGTERM. Usual causes: the **shell form** of CMD/ENTRYPOINT (`/bin/sh -c` is PID 1 and doesn't forward signals); an entrypoint script that starts the app without `exec`; a wrapper like `npm start`; or an app without a SIGTERM handler (PID 1 ignores signals with no handler). Fix with exec-form CMD, `exec` in scripts, a SIGTERM handler that drains and exits, and `--init`/tini when there are child processes. The symptom in logs is exit code 137 instead of 0.",
        freq: "very-common",
      },
      {
        q: "What's special about PID 1 in a container?",
        a: "Two things. **Signals**: the kernel doesn't apply default dispositions to PID 1 in its namespace, so SIGTERM/SIGINT without a handler are ignored rather than terminating it (SIGKILL from the parent namespace still works). **Reaping**: orphaned processes are re-parented to PID 1, which must `wait()` on them; otherwise they remain as zombies, consuming PIDs (and hitting `pids.max`). Real init systems handle both; app processes often don't. That's what `tini`/`docker run --init`/`dumb-init` solve.",
        freq: "common",
      },
      {
        q: "When would you use ENTRYPOINT instead of CMD?",
        a: "Use **CMD** for typical services: it's the default command and is trivially overridden (`docker run img sh` for debugging). Use **ENTRYPOINT** when the image *is* a command: the executable is fixed and users pass arguments (`docker run img --version`), with CMD supplying default arguments. Also for an entrypoint **script** that does setup (render config from env, wait for dependencies, run migrations, fix permissions) and then `exec \"$@\"` to hand PID 1 to the CMD. Always use the exec (JSON) form.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "A Dockerfile has `ENTRYPOINT [\"node\", \"cli.js\"]` and `CMD [\"--help\"]`. What runs with `docker run img build`?",
        options: ["node cli.js --help build", "node cli.js build", "build", "node cli.js --help"],
        answer: 1,
        explain: "Arguments after the image replace CMD and are appended to ENTRYPOINT.",
      },
      {
        q: "With `CMD npm start`, who is PID 1?",
        options: ["node", "npm", "/bin/sh", "docker-init"],
        answer: 2,
        explain: "The shell form runs /bin/sh -c \"npm start\". The shell is PID 1 and doesn't forward SIGTERM.",
      },
      {
        q: "Your exec-form app has no SIGTERM handler. What happens on docker stop?",
        options: ["It exits immediately with 143", "PID 1 ignores the unhandled SIGTERM, so it's SIGKILLed after the timeout", "Docker restarts it", "It gets SIGINT instead"],
        answer: 1,
        explain: "PID 1 doesn't get default signal actions. Install a handler that shuts down and exits.",
      },
      {
        q: "What does `docker run --init` add?",
        options: ["A systemd init system", "A tiny init (tini) as PID 1 that forwards signals and reaps zombies", "An init container that runs before the app", "Automatic restarts"],
        answer: 1,
        explain: "tini is a minimal init: it runs your command as a child, forwards signals and reaps orphans.",
      },
      {
        q: "Why do entrypoint scripts end with `exec \"$@\"`?",
        options: ["To run the command in the background", "To replace the script process with the CMD, so the app becomes PID 1 and receives signals", "To restart on failure", "To print the command"],
        answer: 1,
        explain: "exec replaces the shell with the program instead of running it as a child.",
      },
    ],
  },

  // ------------------------------------------------------------------ SMALL & SECURE
  {
    id: "dk-small-images",
    title: "Small, secure images with multi-stage builds",
    tagline: "Multi-stage builds, scratch and distroless, slim vs alpine, running as a non-root user, and why secrets in a layer stay there forever (plus BuildKit secret mounts).",
    difficulty: "intermediate",
    minutes: 30,
    visualizers: ["layers"],
    concept: `## Explain it like I'm 10 🧸
To make a wooden toy you need a **workshop**: saws, hammers, sandpaper, piles of sawdust. But when you give the toy to a friend, you don't hand them the whole workshop. You hand them **just the toy**, in a small box.

A **multi-stage build** does exactly that. Stage 1 is the workshop: a big image with compilers and tools that builds your program. Stage 2 is the gift box: a tiny image that receives **only the finished program**. The workshop stays behind.

And one more rule for gift boxes: never put a **secret** in one, not even for a second, not even if you take it out again. Every layer of an image is a photo, and the photo of the moment the secret was inside is kept forever.

## Why small matters
- **Security**: every package in an image is attack surface and a source of CVE reports. An image without a shell, package manager or compiler gives an attacker very little to work with.
- **Speed**: smaller images pull faster, which means faster deploys, faster autoscaling and faster CI.
- **Cost and clarity**: less storage and bandwidth, and fewer things to patch.

## Multi-stage builds
\`\`\`dockerfile
FROM golang:1.23 AS build          # the workshop
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app .

FROM gcr.io/distroless/static-debian12   # the gift box
COPY --from=build /out/app /app
USER nonroot
ENTRYPOINT ["/app"]
\`\`\`
Each \`FROM\` starts a new stage. \`COPY --from=build\` takes files from an earlier stage. Only the **last** stage (or the one picked with \`--target\`) becomes the image. BuildKit builds independent stages in parallel and **skips stages the target doesn't need**.

Typical recipes:
- **Go, Rust, C**: build a static binary, ship on \`scratch\` (empty) or distroless \`static\`. A few MB.
- **Java**: build with a JDK + Maven/Gradle, ship the jar on a JRE-only image (\`eclipse-temurin:21-jre\`), or a jlink-ed runtime.
- **Node.js**: install all dependencies and build (TypeScript, bundler) in one stage, then \`npm ci --omit=dev\` into a clean runtime stage with only \`dist/\` and production \`node_modules\`.
- **Python**: build wheels in a stage with compilers, install them into a slim runtime (or a venv copied across).
- **Frontends**: build static files with Node, serve them from \`nginx\` or any static server.

## Choosing the final base
| Base | Size | Has a shell? | Notes |
|---|---|---|---|
| \`node:20\`, \`python:3.12\` | ~1 GB | yes | full Debian + compilers: great for build stages |
| \`-slim\` variants | 100-300 MB | yes | Debian minus extras: a safe default runtime |
| \`alpine\` | 5-50 MB | yes (busybox) | **musl** libc: some native packages misbehave or must be compiled |
| **distroless** | 2-50 MB | **no** | just a runtime and its libraries (\`static\`, \`base\`, \`java\`, \`nodejs\`, \`python3\`) |
| \`scratch\` | 0 | no | completely empty: static binaries only. Add CA certificates and timezone data yourself if needed |

No shell means no \`docker exec sh\`. Debug with an ephemeral toolbox container instead (Part 5 shows how).

## Run as a non-root user
By default a container runs as **root** (UID 0). It's not full host root (capabilities are dropped and namespaces fence it in) but if an attacker breaks out through a kernel or runtime bug, being root makes it far worse, and root inside can modify everything in the container. Add a user:
- official images often include one: \`USER node\` (Node), \`USER nonroot\` (distroless);
- otherwise \`RUN useradd --uid 10001 --no-create-home app\` then \`USER 10001\` (a numeric UID lets Kubernetes verify \`runAsNonRoot\`);
- \`COPY --chown=app:app\` and \`chown\` the directories the app must write, because \`WORKDIR\` and \`COPY\` create root-owned files by default;
- ports below 1024 need privileges, so listen on 8080 instead of 80.

## Secrets: never in a layer
Every layer is a tarball anyone with the image can extract (\`docker save\`, or just pulling it). So:
- \`COPY id_rsa\` followed by \`RUN rm id_rsa\` leaves the key in the COPY layer;
- \`ARG TOKEN\` / \`ENV TOKEN\` values appear in \`docker history\` and the image config;
- use **BuildKit secret mounts**: \`RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci\` with \`docker build --secret id=npmrc,src=$HOME/.npmrc\`. The file exists only while that one RUN executes;
- for private git repos, \`--mount=type=ssh\` forwards your SSH agent instead of copying keys.
Runtime secrets (database passwords) are injected when the container starts, never built in (Part 5).

## Hardening checklist
Minimal base, multi-stage, pinned versions (or digests), non-root \`USER\`, no secrets in layers, \`.dockerignore\`, \`HEALTHCHECK\`, and scan images in CI (Trivy, Grype, Docker Scout).`,
    keyPoints: [
      "Multi-stage builds compile in a big stage and COPY --from only the result into a small final stage; only the last stage ships.",
      "Smaller images mean fewer vulnerabilities, faster pulls and faster deploys: slim, alpine (musl!), distroless (no shell) or scratch (empty).",
      "Containers run as root by default: add USER (numeric UID), chown what the app writes, and listen on ports above 1024.",
      "Anything ever put in a layer stays in the image, even if a later layer deletes it. ARG and ENV values are visible in history.",
      "Pass build-time secrets with RUN --mount=type=secret (or type=ssh); they never become part of a layer.",
    ],
    code: [
      {
        title: "From a 1.6 GB workshop to a 1 MB image",
        docker: true,
        images: ["node:20"],
        vary: ["\\d+(\\.\\d+)?[kMG]?B$"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `# ---- stage 1: the workshop. Big, full of tools (gcc, make, headers ...)
FROM node:20 AS build
WORKDIR /src
COPY hello.c .
# -static: put everything the program needs inside the binary itself
RUN gcc -O2 -static -o hello hello.c

# ---- stage 2: the delivery box. "scratch" is a completely empty image.
FROM scratch
# Take ONLY the finished program from the workshop
COPY --from=build /src/hello /hello
# Don't run as root (any number works; there's no /etc/passwd in scratch)
USER 10001
ENTRYPOINT ["/hello"]` },
          { path: "hello.c", lang: "c", code: `#include <stdio.h>

int main(void) {
    puts("Hello from a 1 MB image!");
    return 0;
}` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-tiny . > /dev/null
docker run --rm quest-tiny

# Compare sizes: the workshop image vs what we ship
docker images node:20 --format 'node:20 (build stage) {{.Size}}'
docker images quest-tiny --format 'quest-tiny (final)    {{.Size}}'

# There's nothing else inside: no shell, no ls, no package manager to attack
docker run --rm --entrypoint /bin/sh quest-tiny -c 'echo hi' 2>&1 | grep -o 'no such file or directory'` }],
        explain: `- The \`build\` stage uses \`node:20\` only because it happens to include \`gcc\`; a real C project would use \`gcc\` or \`debian\` images. \`-static\` puts the C library inside the binary, so it needs nothing else to run.
- \`FROM scratch\` starts from nothing at all. \`COPY --from=build\` takes just the one file. The final image is the size of the program.
- There's no \`/bin/sh\` in the image, so trying to run one fails. That's the point: an attacker who gets in finds no shell, no tools, nothing to install packages with.
- \`USER 10001\`: even this tiny program doesn't run as root.`,
        output: `Hello from a 1 MB image!
node:20 (build stage) 1.57GB
quest-tiny (final)    1.02MB
no such file or directory`,
      },
      {
        title: "Run as a non-root user",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `FROM node:20-slim
# WORKDIR creates /app owned by root, so hand it over to the "node" user (uid 1000),
# which the official node images already include
WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node app.js .
# Everything from here on, including the running container, uses this user
USER node
CMD ["node", "app.js"]` },
          { path: "app.js", lang: "javascript", code: `const fs = require("fs");
const { execSync } = require("child_process");

console.log(execSync("id").toString().trim());
fs.writeFileSync("/app/notes.txt", "allowed: I own /app\\n");
console.log(fs.readFileSync("/app/notes.txt", "utf8").trim());
try {
  fs.writeFileSync("/etc/evil.txt", "pwned");
} catch (e) {
  console.log(\`blocked: \${e.code} writing /etc/evil.txt\`);
}` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-nonroot . > /dev/null
docker run --rm quest-nonroot
echo ---
# The default for most images is root. Compare:
docker run --rm node:20-slim id` }],
        explain: `- \`USER node\` makes every later instruction, and the container, run as UID 1000.
- \`WORKDIR\` and \`COPY\` create files owned by **root**, so the app couldn't write to \`/app\` until the \`chown\` line handed it over. Forgetting this is the most common error when switching to non-root (\`EACCES: permission denied\`).
- Writing to \`/etc\` is refused: a compromised app can't tamper with the rest of the container.
- The last line shows the default: plain \`node:20-slim\` runs as root.`,
        output: `uid=1000(node) gid=1000(node) groups=1000(node)
allowed: I own /app
blocked: EACCES writing /etc/evil.txt
---
uid=0(root) gid=0(root) groups=0(root)`,
      },
      {
        title: "A deleted secret is still in the image",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile.leaky", lang: "dockerfile", code: `FROM node:20-slim
# Copy the key in, use it, delete it... looks safe?
COPY api_key.txt /tmp/api_key.txt
RUN echo "using key $(cut -c1-7 /tmp/api_key.txt)..." && rm /tmp/api_key.txt` },
          { path: "Dockerfile.safe", lang: "dockerfile", code: `FROM node:20-slim
# The secret is mounted for this one RUN step only. It never becomes part of a layer.
RUN --mount=type=secret,id=api_key \\
    echo "using key $(cut -c1-7 /run/secrets/api_key)..."` },
          { path: "api_key.txt", lang: "text", code: `sk_live_TOP_SECRET_42` },
        ],
        variants: [{ lang: "bash", code: `# Search every layer of an image for the secret
search() {
  rm -rf layers && mkdir layers
  docker save "$1" | tar -x -C layers
  found=no
  for blob in layers/blobs/sha256/*; do
    if tar -xOf "$blob" 2> /dev/null | grep -q TOP_SECRET; then found=yes; fi
  done
  echo "$1: secret found in a layer? $found"
}

docker build -q -t quest-leaky -f Dockerfile.leaky . > /dev/null
docker run --rm quest-leaky ls /tmp/api_key.txt 2>&1   # the file is gone from the final filesystem...
search quest-leaky                       # ...but not from the image

docker build -q -t quest-safe -f Dockerfile.safe --secret id=api_key,src=api_key.txt . > /dev/null
search quest-safe` }],
        explain: `- \`docker save\` exports an image as plain files: JSON plus one tarball per layer. The \`search\` function unpacks every layer and greps for the secret, which is exactly what an attacker with your image would do.
- In the leaky image the file is gone from the final filesystem, but the \`COPY\` layer still contains it. Anyone who can pull the image can read the key.
- \`RUN --mount=type=secret,id=api_key\` makes the file appear at \`/run/secrets/api_key\` only while that RUN executes, and \`--secret id=api_key,src=...\` provides it at build time. No layer ever contains it.`,
        output: `ls: cannot access '/tmp/api_key.txt': No such file or directory
quest-leaky: secret found in a layer? yes
quest-safe: secret found in a layer? no`,
      },
    ],
    interview: [
      {
        q: "What is a multi-stage build and why use it?",
        a: "A Dockerfile with several `FROM` stages, where later stages `COPY --from=<stage>` artifacts out of earlier ones and only the final (or `--target`) stage becomes the image. You compile/bundle in a full-featured build stage (compilers, dev dependencies, test tools) and ship only the artifact on a minimal runtime (slim, distroless, scratch). Benefits: images shrink from hundreds of MB to a few MB, there are far fewer packages to exploit or patch, no build tools or source code ship to production, and BuildKit builds independent stages in parallel and can run a test stage in CI with `--target test`.",
        freq: "very-common",
      },
      {
        q: "Alpine, slim or distroless: how do you choose a base image?",
        a: "**slim** (Debian with fewer packages) is the safe default: glibc, `apt`, a shell for debugging, moderate size. **alpine** is tiny but uses **musl** libc and busybox, so prebuilt native modules/wheels may not work, DNS and threading behave slightly differently, and Python builds can be slower; great for static binaries and simple scripts. **distroless** contains only the language runtime and its libraries (no shell, no package manager), giving the smallest attack surface for production, at the cost of debugging via ephemeral containers. `scratch` is for fully static binaries. Pin versions, and keep the full image for build stages.",
        freq: "common",
      },
      {
        q: "How do you use a secret (private npm token, SSH key) during a build without leaking it?",
        a: "Never `COPY` it or pass it as `ARG`/`ENV`: layers and image history are readable by anyone with the image, and deleting it in a later step doesn't remove it from earlier layers. Use **BuildKit secret mounts**: `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci` with `docker build --secret id=npmrc,src=$HOME/.npmrc`; the file exists only during that RUN. For git over SSH use `--mount=type=ssh` with `docker build --ssh default`, which forwards the agent socket. In CI, feed secrets from the CI secret store. Then verify with `docker history`/image scanning.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In a multi-stage Dockerfile, which stage becomes the image by default?",
        options: ["The first", "The last", "The largest", "All of them, merged"],
        answer: 1,
        explain: "Only the final stage ships (or the one named with --target). Earlier stages are just build steps.",
      },
      {
        q: "What does `COPY --from=build /out/app /app` do?",
        options: ["Downloads the app from a registry called build", "Copies a file from the earlier stage named build", "Copies from the build context's build folder", "Builds the app"],
        answer: 1,
        explain: "--from takes files from another stage (or any image), not from the build context.",
      },
      {
        q: "Why might an app that works on node:20-slim fail on node:20-alpine?",
        options: ["Alpine doesn't support Node", "Alpine uses musl libc, so prebuilt native modules for glibc may not load", "Alpine images can't run as root", "Alpine has no networking"],
        answer: 1,
        explain: "Native addons and wheels built for glibc can break on musl. Test, or rebuild them for alpine.",
      },
      {
        q: "After switching to `USER node`, the app fails with EACCES writing to /app. Why?",
        options: ["The node user can't run node", "WORKDIR and COPY created /app as root, so the non-root user can't write there", "USER disables the filesystem", "Ports below 1024 are blocked"],
        answer: 1,
        explain: "chown the directories the app writes (or COPY --chown) before switching user.",
      },
      {
        q: "How do you use an npm token during `npm ci` without it ending up in the image?",
        options: ["ARG NPM_TOKEN", "COPY .npmrc, then RUN rm .npmrc", "RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci", "ENV NPM_TOKEN in the final stage only"],
        answer: 2,
        explain: "Secret mounts exist only during the RUN and never enter a layer. ARG/ENV and deleted files are recoverable.",
      },
    ],
  },
];
