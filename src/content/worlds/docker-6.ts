import type { Lesson } from "../types";

// Docker, part 6: two projects (ship an app with Compose; build a container runtime) and the interview wrap-up.

export const dockerPart6: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT: COMPOSE
  {
    id: "dk-project-compose",
    part: "Part 6 · Projects & interview",
    title: "Project: ship a link shortener with Compose",
    tagline: "Build shorty, a link shortener with an API and Postgres: a tested multi-stage image, a hardened Compose stack with health checks, a secret, a volume and a private network, and an end-to-end smoke test that restarts, destroys and backs it up.",
    difficulty: "intermediate",
    minutes: 60,
    diagram: {
      title: "The shorty stack",
      nodes: [
        { id: "user", label: "You", kind: "client", x: 90, y: 280, sub: "curl or a browser" },
        { id: "port", label: "localhost:8080", kind: "gateway", x: 270, y: 280, sub: "the only published port" },
        { id: "api", label: "api", kind: "service", x: 490, y: 280, sub: "non-root, read-only, 256 MB" },
        { id: "build", label: "app/Dockerfile", kind: "registry", x: 490, y: 80, sub: "base → test → release" },
        { id: "secret", label: "db_password", kind: "storage", x: 490, y: 480, sub: "a file, never in git" },
        { id: "db", label: "db", kind: "db", x: 730, y: 280, sub: "postgres:16-alpine" },
        { id: "init", label: "db/init.sql", kind: "storage", x: 730, y: 80, sub: "runs on first start" },
        { id: "vol", label: "pgdata", kind: "storage", x: 900, y: 470, sub: "named volume" },
      ],
      edges: [
        { from: "user", to: "port" },
        { from: "port", to: "api", label: "8080 → 3000" },
        { from: "build", to: "api", label: "compose up --build" },
        { from: "api", to: "db", label: "db:5432, project network" },
        { from: "init", to: "db" },
        { from: "db", to: "vol", label: "/var/lib/postgresql/data" },
        { from: "secret", to: "api", label: "/run/secrets/db_password" },
        { from: "secret", to: "db", dashed: true },
      ],
      flows: [
        {
          name: "docker compose up --build",
          path: ["build", "api", "secret", "db", "init", "db", "api", "port"],
          steps: [
            "Compose builds app/Dockerfile. The test stage runs the unit tests; if one fails, the build fails and nothing starts.",
            "Both services get the password as a file mounted at /run/secrets/db_password.",
            "db starts first: Postgres reads POSTGRES_PASSWORD_FILE and creates the user.",
            "The pgdata volume is empty, so Postgres runs db/init.sql to create the links table.",
            "pg_isready passes: db is healthy. Only now does api start (depends_on: service_healthy).",
            "api connects to db:5432 on the project network, passes its own health check, and port 8080 opens on your machine.",
            "--wait returns once both services are healthy.",
          ],
        },
        {
          name: "Shorten and follow a link",
          path: ["user", "port", "api", "db", "vol"],
          steps: [
            "POST /links with a URL; later GET /hr6md2.",
            "Docker forwards localhost:8080 to the api container's port 3000.",
            "api inserts the link (or bumps its hit counter) with a parameterized query.",
            "Postgres writes to the named volume, which survives compose down, restarts and new images.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You're opening a tiny **shop that makes long web addresses short**. The shop has two workers:
- **api**, at the front counter, takes requests from customers;
- **db**, in the back room, keeps the notebook of every short link. Customers can never walk into the back room.

The **compose.yaml** file is the plan of the shop: who works there, which door is open to the street, where the notebook is kept so it survives when the shop closes for the night, and where the key to the back room is hidden. Then **one command** opens the whole shop, and another closes it.

## What you'll build
**shorty** is a link shortener: \`POST /links\` with a long URL returns a short code; \`GET /<code>\` redirects there and counts the visit. It uses only Node.js's built-in modules (even its Postgres client is under 200 lines of wire protocol), so everything builds offline from \`node:20-slim\` and \`postgres:16-alpine\`.

It brings together almost everything in this world:
| Lesson | Where it shows up |
|---|---|
| Dockerfiles, cache, .dockerignore | \`app/Dockerfile\` copies dependencies' manifest before code |
| Multi-stage builds | \`base → test → release\`: unit tests run inside the build |
| CMD, PID 1, signals | exec-form \`CMD\`, a SIGTERM handler that finishes requests and exits 0 |
| Small and safe images | \`USER node\`, no secrets in layers, \`HEALTHCHECK\` without curl |
| Volumes | the \`pgdata\` named volume, a bind-mounted \`init.sql\` |
| Networking | api reaches \`db\` by name; the database port isn't published |
| Compose | \`depends_on: condition: service_healthy\`, secrets, limits, restart policies |
| Security | read-only root filesystem, \`cap_drop: [ALL]\`, \`no-new-privileges\`, a secret file |
| Production | health checks, graceful shutdown, \`pg_dump\` backups |

## How you'll know it works
The last step is **smoke.sh**, an end-to-end test of the running stack, like a CI job would run: it builds and starts everything, shortens and follows links, checks the security settings, restarts the api, destroys and recreates every container, backs up the database, and verifies a clean shutdown. You need Docker with Compose v2 and \`curl\`.

Follow the steps on the **Build** tab.`,
    keyPoints: [
      "One compose.yaml describes the whole app: services, the private network, a named volume, a secret, health checks, limits and restart policies.",
      "A Dockerfile test stage makes a failing unit test fail docker compose up --build.",
      "depends_on with condition: service_healthy starts the api only when Postgres answers.",
      "Only the api's port is published; the database is reachable only by service name inside the project network.",
      "An end-to-end smoke test proves the stack survives restarts and compose down, and shuts down cleanly.",
    ],
    interview: [
      {
        q: "Walk me through how you'd containerize a web app with a database for production.",
        a: "**Image**: a multi-stage Dockerfile on a pinned slim base, dependency manifests copied before source for caching, tests in a build stage, `.dockerignore`, a non-root `USER`, exec-form `CMD`, a `HEALTHCHECK`, and SIGTERM handling for graceful shutdown. **Configuration** from environment variables, **secrets** as mounted files. **Database**: the official image with data on a named volume (or, in the cloud, a managed database), an init script for schema bootstrap (real projects use a migration tool), a health check, no published port. **Wiring**: Compose (or Kubernetes) with a private network, `depends_on: service_healthy` plus retry logic in the app, resource limits, restart policies, read-only filesystems and dropped capabilities. **Operations**: logs to stdout with rotation, backups with `pg_dump` tested by restoring, image builds and scans in CI with immutable tags.",
        freq: "very-common",
      },
      {
        q: "Why does the app retry its database connection even though Compose waits for the database to be healthy?",
        a: "`depends_on: service_healthy` only orders **startup**. Later the database can restart (crash, upgrade, `docker compose restart db`), fail over, or be briefly unreachable, and in Kubernetes there is no startup ordering at all. A resilient service retries connections with backoff and reports itself unhealthy (or not ready) while its dependency is down, instead of crashing and relying on restart loops.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In shorty, how does the api find the database?",
        options: ["Through localhost:5432", "By the service name db, through Compose's DNS on the project network", "Through a published port on the host", "Through an environment file"],
        answer: 1,
        explain: "Compose puts both services on one network where service names resolve.",
      },
      {
        q: "A unit test breaks. What happens on `docker compose up --build`?",
        options: ["The api starts with a warning", "The build fails in the test stage, so nothing is started", "Only the db starts and runs normally", "The tests are skipped"],
        answer: 1,
        explain: "The release stage copies a file from the test stage, so it can't be built until the tests pass.",
      },
      {
        q: "After `docker compose down` and `up`, are the links still there?",
        options: ["No, containers were deleted", "Yes, they're in the pgdata named volume", "Only if the image was rebuilt", "Only the first link"],
        answer: 1,
        explain: "down removes containers and networks, not volumes. down -v would delete them.",
      },
    ],
    project: {
      summary: `You'll build **shorty**, a link shortener with an HTTP API and a PostgreSQL database, packaged and run with Docker Compose. In five steps you write the app and its unit tests, a multi-stage Dockerfile that runs the tests during the build, a production-style \`compose.yaml\` (health checks, a secret, a named volume, a private network, resource limits, a read-only non-root api), and \`smoke.sh\`, an end-to-end test that makes 14 checks against the running stack.

You need **Docker** with Compose v2 and \`curl\`. No Node.js install is needed on your machine: everything runs in containers.`,
      skills: [
        "Writing a multi-stage Dockerfile with a test stage",
        "Composing an app and a database: networks, volumes, secrets, health checks",
        "Ordering startup with depends_on and service_healthy",
        "Hardening containers: non-root, read-only, no capabilities, limits",
        "Graceful shutdown on SIGTERM",
        "Backing up a containerized database",
        "Testing a whole stack end to end from bash",
      ],
      tree: `shorty/
├── compose.yaml            # the whole stack: api + db, volume, secret, limits
├── smoke.sh                # end-to-end test: 14 checks in 8 stages
├── .gitignore              # keeps secrets/ out of git
├── secrets/
│   └── db_password.txt     # generated by smoke.sh, never committed
├── db/
│   └── init.sql            # creates the links table on first start
└── app/
    ├── Dockerfile          # base → test → release
    ├── .dockerignore
    ├── package.json
    ├── links.js            # short codes and URL validation (pure logic)
    ├── db.js               # a tiny Postgres client: no npm packages needed
    ├── server.js           # the HTTP API, config, retries, graceful shutdown
    └── test/
        └── links.test.js   # unit tests`,
      steps: [
        {
          title: "1. The app's logic, with unit tests",
          explain: `Start with the part that has no network and no database, so it's easy to test.
- \`makeCode()\` picks 6 random characters from a 32-character alphabet without look-alikes (no \`l\`/\`1\`, \`o\`/\`0\`). Because 256 is a multiple of 32, \`byte % 32\` gives every character the same chance. 32⁶ is about a billion codes.
- \`isValidUrl()\` accepts only \`http:\` and \`https:\` URLs. Without this check, someone could shorten \`javascript:alert(1)\` and turn your domain into an attack tool.
- The tests use Node's built-in \`node:test\` runner, so there's nothing to install.

Run them in a throwaway container: your code is bind-mounted, and Node comes from the image.`,
          files: [
            { path: "app/package.json", lang: "json", code: `{
  "name": "shorty",
  "version": "1.0.0",
  "private": true,
  "description": "A link shortener with zero dependencies",
  "scripts": {
    "start": "node server.js",
    "test": "node --test test/"
  }
}` },
            { path: "app/links.js", lang: "javascript", code: `"use strict";
// The app's pure logic: no network, no database, so it's easy to unit test.
const crypto = require("node:crypto");

// 32 characters with no look-alikes (no l/1, o/0). 256 is a multiple of 32, so b % 32 is fair.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function makeCode(length = 6) {
  return Array.from(crypto.randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function isValidUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

module.exports = { ALPHABET, makeCode, isValidUrl };` },
            { path: "app/test/links.test.js", lang: "javascript", code: `"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { ALPHABET, makeCode, isValidUrl } = require("../links");

test("codes are 6 characters from the alphabet", () => {
  for (let i = 0; i < 1000; i++) {
    const code = makeCode();
    assert.strictEqual(code.length, 6);
    for (const ch of code) assert.ok(ALPHABET.includes(ch), \`unexpected \${ch}\`);
  }
});

test("codes are random", () => {
  const seen = new Set(Array.from({ length: 1000 }, () => makeCode()));
  assert.strictEqual(seen.size, 1000);
});

test("only http and https URLs are accepted", () => {
  assert.ok(isValidUrl("https://docs.docker.com/"));
  assert.ok(isValidUrl("http://example.com/a?b=c"));
  assert.ok(!isValidUrl("javascript:alert(1)"));
  assert.ok(!isValidUrl("ftp://example.com"));
  assert.ok(!isValidUrl("not a url"));
});` },
          ],
          run: `docker run --rm -v "$PWD/app":/app -w /app node:20-slim node --test test/`,
          output: `✔ codes are 6 characters from the alphabet (12ms)
✔ codes are random (3ms)
✔ only http and https URLs are accepted (0.5ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0`,
        },
        {
          title: "2. The database client and the HTTP server",
          explain: `**db.js** is a minimal PostgreSQL client so the project needs no npm packages (in real projects, use \`pg\`). It's worth skimming because it shows what a database driver does:
- every Postgres message is a 1-byte type, a 4-byte length and a body;
- login uses **SCRAM-SHA-256**: the password never crosses the network; client and server prove to each other that they know it (PBKDF2, HMACs and a nonce);
- queries use the **extended protocol** (Parse, Bind, Execute, Sync) so values travel separately from the SQL: no SQL injection possible.

**server.js** is the API, written the way containers like it:
- **configuration from the environment** (\`DB_HOST\`, \`PUBLIC_URL\`...), and the password from a **file** named by \`DB_PASSWORD_FILE\`;
- **retries** the database connection for 30 seconds instead of crashing while Postgres starts;
- logs to **stdout**, one line per request;
- \`GET /health\` runs \`SELECT 1\`, so "healthy" means "can really serve requests";
- on **SIGTERM** it stops accepting connections, lets in-flight requests finish, closes the database connection and exits 0.

It can't run yet: it needs a database. That's what the next two steps are for.`,
          files: [
            { path: "app/db.js", lang: "javascript", code: `"use strict";
// A tiny PostgreSQL client, so this project needs no npm packages and builds offline.
// It speaks just enough of Postgres's wire protocol for this app: SCRAM-SHA-256 login and
// parameterized queries. In your own projects, use the "pg" package instead.
const net = require("node:net");
const crypto = require("node:crypto");

const i16 = (n) => Buffer.from([(n >> 8) & 255, n & 255]);
const i32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
};
const cstr = (s) => Buffer.from(\`\${s}\\0\`);
// every message: a 1-byte type, a 4-byte length, then the body
const msg = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from(type), i32(body.length + 4), body]);
};

function pgError(body) {
  const fields = {};
  for (let i = 0; body[i]; ) {
    const end = body.indexOf(0, i + 1);
    fields[String.fromCharCode(body[i])] = body.toString("utf8", i + 1, end);
    i = end + 1;
  }
  return Object.assign(new Error(fields.M), { code: fields.C });
}

class Client {
  constructor({ host, port = 5432, user, password, database }) {
    Object.assign(this, { host, port, user, password, database });
    this.buf = Buffer.alloc(0);
    this.inbox = [];
    this.queue = Promise.resolve();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.sock = net.connect(this.port, this.host);
      this.sock.on("error", (e) => this.fail(e));
      this.sock.on("close", () => this.fail(new Error("connection closed")));
      this.sock.on("data", (d) => this.receive(d));
      this.sock.on("connect", () => {
        // the startup message has no type byte: length, protocol 3.0, then key/value pairs
        const body = Buffer.concat([i32(196608), cstr("user"), cstr(this.user), cstr("database"), cstr(this.database), Buffer.from([0])]);
        this.sock.write(Buffer.concat([i32(body.length + 4), body]));
        this.login().then(resolve, reject);
      });
      this.waiter = { resolve() {}, reject };
    });
  }

  receive(data) {
    this.buf = Buffer.concat([this.buf, data]);
    while (this.buf.length >= 5 && this.buf.length >= this.buf.readInt32BE(1) + 1) {
      const len = this.buf.readInt32BE(1);
      const m = { type: String.fromCharCode(this.buf[0]), body: this.buf.subarray(5, len + 1) };
      this.buf = this.buf.subarray(len + 1);
      if ("NSK".includes(m.type)) continue; // notices, server settings, cancel keys: not needed here
      const w = this.waiter;
      this.waiter = null;
      if (w) w.resolve(m);
      else this.inbox.push(m);
    }
  }

  fail(err) {
    this.error ??= err;
    const w = this.waiter;
    this.waiter = null;
    if (w) w.reject(err);
  }

  next() {
    if (this.inbox.length) return Promise.resolve(this.inbox.shift());
    if (this.error) return Promise.reject(this.error);
    return new Promise((resolve, reject) => (this.waiter = { resolve, reject }));
  }

  async login() {
    const hmac = (key, text) => crypto.createHmac("sha256", key).update(text).digest();
    let nonce, first, serverSignature;
    for (;;) {
      const m = await this.next();
      if (m.type === "E") throw pgError(m.body);
      if (m.type === "Z") return; // ReadyForQuery: we're in
      if (m.type !== "R") continue;
      const step = m.body.readInt32BE(0);
      if (step === 10) {
        // SASL: the server wants SCRAM-SHA-256. Send our random nonce.
        nonce = crypto.randomBytes(18).toString("base64");
        first = \`n=*,r=\${nonce}\`;
        const data = Buffer.from(\`n,,\${first}\`);
        this.sock.write(msg("p", cstr("SCRAM-SHA-256"), i32(data.length), data));
      } else if (step === 11) {
        // the server's nonce, salt and iteration count: prove we know the password without sending it
        const server = m.body.subarray(4).toString();
        const f = Object.fromEntries(server.split(",").map((kv) => [kv[0], kv.slice(2)]));
        if (!f.r.startsWith(nonce)) throw new Error("SCRAM: bad nonce from the server");
        const salted = crypto.pbkdf2Sync(this.password, Buffer.from(f.s, "base64"), Number(f.i), 32, "sha256");
        const clientKey = hmac(salted, "Client Key");
        const storedKey = crypto.createHash("sha256").update(clientKey).digest();
        const final = \`c=biws,r=\${f.r}\`;
        const authMessage = \`\${first},\${server},\${final}\`;
        const signature = hmac(storedKey, authMessage);
        const proof = Buffer.from(clientKey.map((b, i) => b ^ signature[i]));
        serverSignature = hmac(hmac(salted, "Server Key"), authMessage).toString("base64");
        this.sock.write(msg("p", Buffer.from(\`\${final},p=\${proof.toString("base64")}\`)));
      } else if (step === 12) {
        // and the server proves it knows the password too
        if (m.body.subarray(4).toString() !== \`v=\${serverSignature}\`) throw new Error("SCRAM: bad server signature");
      } else if (step !== 0) {
        throw new Error(\`unsupported authentication method \${step}\`);
      }
    }
  }

  // Parameterized query: the SQL and the values travel separately, so values can never be
  // run as SQL (no SQL injection). One query at a time, in order.
  query(sql, params = []) {
    const run = async () => {
      const values = params.map((p) => {
        if (p === null || p === undefined) return i32(-1);
        const b = Buffer.from(String(p));
        return Buffer.concat([i32(b.length), b]);
      });
      this.sock.write(
        Buffer.concat([
          msg("P", cstr(""), cstr(sql), i16(0)), // Parse
          msg("B", cstr(""), cstr(""), i16(0), i16(params.length), ...values, i16(0)), // Bind
          msg("D", Buffer.from("P"), cstr("")), // Describe the result columns
          msg("E", cstr(""), i32(0)), // Execute
          msg("S"), // Sync
        ]),
      );
      let columns = [];
      const rows = [];
      let error = null;
      for (;;) {
        const m = await this.next();
        if (m.type === "T") columns = parseColumns(m.body);
        else if (m.type === "D") rows.push(parseRow(m.body, columns));
        else if (m.type === "E") error = pgError(m.body);
        else if (m.type === "Z") {
          if (error) throw error;
          return rows;
        }
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  end() {
    if (!this.sock) return;
    this.sock.end(msg("X"));
  }
}

function parseColumns(body) {
  const columns = [];
  let i = 2;
  for (let n = body.readInt16BE(0); n > 0; n--) {
    const end = body.indexOf(0, i);
    columns.push({ name: body.toString("utf8", i, end), type: body.readInt32BE(end + 7) });
    i = end + 19;
  }
  return columns;
}

const INTEGER_TYPES = new Set([20, 21, 23]); // int8, int2, int4
function parseRow(body, columns) {
  const row = {};
  let i = 2;
  for (const col of columns) {
    const len = body.readInt32BE(i);
    i += 4;
    if (len === -1) {
      row[col.name] = null;
      continue;
    }
    const text = body.toString("utf8", i, i + len);
    i += len;
    row[col.name] = INTEGER_TYPES.has(col.type) ? Number(text) : col.type === 16 ? text === "t" : text;
  }
  return row;
}

module.exports = { Client };` },
            { path: "app/server.js", lang: "javascript", code: `"use strict";
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

let db;
async function connectWithRetry(attempts = 30) {
  for (let i = 1; ; i++) {
    try {
      db = new Client(config);
      await db.connect();
      console.log(\`connected to postgres at \${config.host}\`);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(\`database not ready (\${err.code ?? err.message}), retry \${i}/\${attempts}\`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
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

  if (req.method === "GET" && pathname === "/health") {
    await db.query("SELECT 1");
    return send(res, 200, { status: "ok" });
  }

  if (req.method === "POST" && pathname === "/links") {
    const body = await readJson(req);
    if (!body || !isValidUrl(body.url)) return send(res, 400, { error: "send JSON like {\\"url\\": \\"https://...\\"}" });
    const [row] = await db.query("INSERT INTO links (code, url) VALUES ($1, $2) RETURNING code, url", [makeCode(), body.url]);
    return send(res, 201, { ...row, short: \`\${PUBLIC_URL}/\${row.code}\` });
  }

  if (req.method === "GET" && pathname === "/links") {
    return send(res, 200, await db.query("SELECT code, url, hits FROM links ORDER BY id"));
  }

  const code = /^\\/([a-z0-9]{6})$/.exec(pathname)?.[1];
  if (req.method === "GET" && code) {
    const [row] = await db.query("UPDATE links SET hits = hits + 1 WHERE code = $1 RETURNING url", [code]);
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
      if (req.url !== "/health") console.log(\`\${req.method} \${req.url} -> \${res.statusCode}\`);
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
});` },
          ],
        },
        {
          title: "3. A Dockerfile that tests before it ships",
          explain: `Three stages:
- **base**: \`node:20-slim\`, \`package.json\` first (with npm dependencies, \`npm ci\` would go right after it, so code changes wouldn't reinstall them), then the app files.
- **test**: base plus the tests, and \`RUN node --test\`. A failing test fails this \`RUN\`, and so the build.
- **release**: base again (no test files), \`NODE_ENV=production\`, \`USER node\`, a \`HEALTHCHECK\` that uses Node's \`fetch\` (the slim image has no curl), and an exec-form \`CMD\` so node is PID 1 and receives SIGTERM.

One subtlety: BuildKit only builds the stages the target needs, and release doesn't need test... so release copies a marker file from test. Now \`docker build\` (and \`compose up --build\`) can't produce a release image without running the tests.

\`.dockerignore\` keeps \`node_modules\`, \`.env\` and \`.git\` out of the build context.`,
          files: [
            { path: "app/Dockerfile", lang: "dockerfile", code: `# ---- base: the runtime and the app's files
FROM node:20-slim AS base
WORKDIR /app
COPY package.json ./
COPY links.js db.js server.js ./

# ---- test: run the unit tests inside the image. If they fail, the build fails.
FROM base AS test
COPY test/ ./test/
RUN node --test test/ && touch /tmp/tests-passed

# ---- release: what actually runs
FROM base AS release
# BuildKit only builds the stages a target needs. Copying this file makes release depend on test,
# so a plain "docker build" (or compose up --build) always runs the tests first.
COPY --from=test /tmp/tests-passed /tmp/tests-passed
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=2s --start-period=20s --retries=3 \\
  CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]` },
            { path: "app/.dockerignore", lang: "text", code: `node_modules
npm-debug.log
.env
.git
Dockerfile
.dockerignore` },
          ],
          run: `docker build -q -t quest-shorty-api:1.0 ./app > /dev/null
docker image inspect quest-shorty-api:1.0 -f 'user: {{.Config.User}}, cmd: {{.Config.Cmd}}'`,
          output: `user: node, cmd: [node server.js]`,
        },
        {
          title: "4. compose.yaml: the database, the secret and the network",
          explain: `The Compose file describes the whole stack:
- **api** is built from \`./app\` and published on port 8080. It gets its settings from \`environment\` and the password from the \`db_password\` **secret**, mounted at \`/run/secrets/db_password\`.
- \`depends_on: db: condition: service_healthy\` waits until Postgres's health check (\`pg_isready\`) passes.
- **Hardening**: \`read_only: true\` (the app writes nothing to disk), \`cap_drop: [ALL]\` (it needs no capabilities), \`no-new-privileges\`, and limits of 256 MB and half a CPU. \`restart: unless-stopped\` brings it back after crashes and reboots.
- **db** uses the official image. \`POSTGRES_PASSWORD_FILE\` makes it read the same secret file. Its data lives in the **pgdata** named volume, and \`init.sql\` is bind-mounted into \`/docker-entrypoint-initdb.d/\`, which Postgres runs only when the data directory is empty.
- db has **no \`ports:\`**: it's reachable only from inside the project network, by the name \`db\`.
- The secret comes from \`secrets/db_password.txt\`, which \`.gitignore\` keeps out of git. Generate a random one.

Start everything, try it, and read the api's logs.`,
          files: [
            { path: "compose.yaml", lang: "yaml", code: `name: quest-shorty

services:
  api:
    build: ./app                  # built from app/Dockerfile (the tests run during the build)
    image: quest-shorty-api:1.0
    ports:
      - "8080:3000"               # the only published port
    environment:
      DB_HOST: db                 # the service name below: Compose's DNS resolves it
      DB_USER: shorty
      DB_NAME: shorty
      DB_PASSWORD_FILE: /run/secrets/db_password
      PUBLIC_URL: http://localhost:8080
    secrets:
      - db_password
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    # hardening: read-only filesystem, no Linux capabilities, no privilege escalation
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.50"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shorty
      POSTGRES_DB: shorty
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/001-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shorty -d shorty"]
      interval: 2s
      timeout: 3s
      retries: 30
    restart: unless-stopped
    # no "ports": the database is reachable only from inside the project network

volumes:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt` },
            { path: "db/init.sql", lang: "sql", code: `-- Runs once, when the database volume is empty (the first "compose up").
CREATE TABLE links (
  id         bigserial PRIMARY KEY,
  code       text        NOT NULL UNIQUE,
  url        text        NOT NULL,
  hits       integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);` },
            { path: ".gitignore", lang: "text", code: `# never commit secrets
secrets/` },
          ],
          run: `mkdir -p secrets
head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \\n' > secrets/db_password.txt
docker compose up -d --build --wait
docker compose ps --format '{{.Service}}: {{.State}} ({{.Health}})'
curl -s -X POST localhost:8080/links -H 'content-type: application/json' -d '{"url": "https://docs.docker.com/"}'
curl -si localhost:8080/hr6md2 | grep -iE '^(HTTP|location)'     # use the code you got
docker compose logs api --no-log-prefix
docker compose down          # add -v to delete the database too`,
          output: `api: running (healthy)
db: running (healthy)
{"code":"hr6md2","url":"https://docs.docker.com/","short":"http://localhost:8080/hr6md2"}
HTTP/1.1 302 Found
location: https://docs.docker.com/
connected to postgres at db
shorty listening on 3000
POST /links -> 201
GET /hr6md2 -> 302`,
        },
        {
          title: "5. smoke.sh: test the whole stack",
          explain: `Unit tests check functions; a **smoke test** checks that the deployed system works. \`smoke.sh\` drives the real stack the way an operator (or a CI job) would:
1. builds and starts everything, and waits until both services are healthy;
2. shortens a link, and checks that a \`javascript:\` URL is rejected;
3. follows the link twice, then checks the redirect, the hit counter and a 404;
4. checks the security settings from the outside: the api's user ID is 1000, its filesystem is read-only, and the database port isn't published;
5. restarts the api: it reconnects and the data is still there;
6. runs \`compose down\` (every container deleted) and \`up\` again: the link survived in the volume;
7. backs up the database with \`pg_dump\` through \`docker compose exec\`;
8. stops the api and checks that it exited **0** after logging its SIGTERM message, not 137.

\`set -euo pipefail\` stops at the first problem, \`fail\` prints the last logs to help you debug, and a \`trap\` runs \`docker compose down -v\` however the script ends, so it never leaves anything behind.`,
          files: [{ path: "smoke.sh", lang: "bash", code: `#!/usr/bin/env bash
# End-to-end test of the whole stack: build, start, use it, restart it, and tear it down.
set -euo pipefail
cd "$(dirname "$0")"

pass() { echo "  ok: $1"; }
fail() { echo "  FAILED: $1" >&2; docker compose logs --tail 30 >&2; exit 1; }
expect() { [ "$1" = "$2" ] && pass "$3" || fail "$3 (expected '$2', got '$1')"; }
up() { docker compose --progress quiet up -d --wait "$@"; }

# a random database password, created once and never committed
if [ ! -f secrets/db_password.txt ]; then
  mkdir -p secrets
  head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \\n' > secrets/db_password.txt
fi
trap 'docker compose --progress quiet down -v > /dev/null 2>&1 || true' EXIT

echo "1. build the image (unit tests run inside the build) and start the stack"
up --build
expect "$(docker compose ps --format '{{.Service}}={{.Health}}' | sort | tr '\\n' ' ')" "api=healthy db=healthy " "both services are healthy"

echo "2. shorten a link"
created=$(curl -s -X POST localhost:8080/links -H 'content-type: application/json' -d '{"url": "https://docs.docker.com/get-started/"}')
code=$(echo "$created" | sed -nE 's/.*"code":"([a-z0-9]{6})".*/\\1/p')
[ -n "$code" ] && pass "got a 6-character code" || fail "no code in: $created"
expect "$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8080/links -d '{"url": "javascript:alert(1)"}')" "400" "a bad URL is rejected"

echo "3. follow the short link twice"
expect "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "localhost:8080/$code")" "302 https://docs.docker.com/get-started/" "it redirects"
curl -s -o /dev/null "localhost:8080/$code"
expect "$(curl -s localhost:8080/links | grep -o '"hits":[0-9]*')" '"hits":2' "both visits were counted"
expect "$(curl -s -o /dev/null -w '%{http_code}' localhost:8080/zzzzzz)" "404" "an unknown code is a 404"

echo "4. security checks"
expect "$(docker compose exec api id -u)" "1000" "the api runs as a non-root user"
expect "$(docker compose exec api sh -c 'touch /app/x 2>&1 || echo read-only' | tail -n 1)" "read-only" "the api's filesystem is read-only"
docker compose ps db --format '{{.Ports}}' | grep -q -- '->' && fail "the database port is published" || pass "the database port is not published"

echo "5. restart the api: it reconnects, and nothing is lost"
docker compose restart api > /dev/null 2>&1
up
expect "$(curl -s localhost:8080/links | grep -o '"hits":[0-9]*')" '"hits":2' "the data is still there"

echo "6. destroy every container and start again: the data lives in the volume"
docker compose --progress quiet down
up
expect "$(curl -s localhost:8080/links | grep -o "\\"code\\":\\"$code\\"")" "\\"code\\":\\"$code\\"" "the link survived compose down"

echo "7. back up the database"
docker compose exec -T db pg_dump -U shorty shorty > backup.sql
grep -q "CREATE TABLE public.links" backup.sql && pass "backup.sql has the schema and data ($(grep -c . backup.sql) lines)"

echo "8. graceful shutdown"
docker compose stop api > /dev/null 2>&1
expect "$(docker inspect -f '{{.State.ExitCode}}' "$(docker compose ps -a -q api)")" "0" "the api exited cleanly on SIGTERM (exit code 0, not 137)"
docker compose logs api --no-log-prefix | grep -q "SIGTERM: finishing" && pass "it logged its shutdown"

echo "all checks passed"` }],
          run: `bash smoke.sh`,
          output: `1. build the image (unit tests run inside the build) and start the stack
  ok: both services are healthy
2. shorten a link
  ok: got a 6-character code
  ok: a bad URL is rejected
3. follow the short link twice
  ok: it redirects
  ok: both visits were counted
  ok: an unknown code is a 404
4. security checks
  ok: the api runs as a non-root user
  ok: the api's filesystem is read-only
  ok: the database port is not published
5. restart the api: it reconnects, and nothing is lost
  ok: the data is still there
6. destroy every container and start again: the data lives in the volume
  ok: the link survived compose down
7. back up the database
  ok: backup.sql has the schema and data (71 lines)
8. graceful shutdown
  ok: the api exited cleanly on SIGTERM (exit code 0, not 137)
  ok: it logged its shutdown
all checks passed`,
        },
      ],
      extensions: [
        "Put a reverse proxy (Caddy, nginx or Traefik) in front with HTTPS, and stop publishing the api's port",
        "Run three api replicas with docker compose up --scale api=3 behind the proxy, and watch the requests spread out",
        "Add a compose.override.yaml for development: a bind mount of the code and node --watch, or Compose's develop.watch",
        "Add Redis as a cache for popular codes, and measure the difference with a load generator like hey or k6",
        "Replace init.sql with real migrations (a migrate service that runs before the api, using depends_on: condition: service_completed_successfully)",
        "Build and push the image from GitHub Actions with the pipeline from the CI lesson, then deploy it to a server with docker compose pull && docker compose up -d",
        "Add a nightly backup service that writes pg_dump files to a backups volume, and practise restoring one",
        "Port the stack to Kubernetes (Deployment, Service, StatefulSet, Secret) in the Kubernetes world",
      ],
      verify: "bash smoke.sh",
      docker: true,
      images: ["node:20-slim", "postgres:16-alpine"],
    },
  },

  // ------------------------------------------------------------------ PROJECT: MINIDOCKER
  {
    id: "dk-project-minidocker",
    title: "Project: build your own Docker",
    tagline: "Write minidocker, a working container runtime in about 250 lines of Python and no libraries: namespaces with unshare, an overlayfs root with pivot_root, /proc and /dev, volumes, cgroup memory, CPU and process limits, OOM detection, and 12 tests that prove the isolation.",
    difficulty: "advanced",
    minutes: 75,
    diagram: {
      title: "What minidocker run does",
      nodes: [
        { id: "cli", label: "minidocker run", kind: "client", x: 90, y: 280, sub: "ROOTFS COMMAND" },
        { id: "parent", label: "Parent process", kind: "control", x: 300, y: 280, sub: "fork, wait, clean up" },
        { id: "cgroup", label: "cgroup", kind: "monitor", x: 300, y: 480, sub: "memory.max, pids.max, cpu.max" },
        { id: "child", label: "Child process", kind: "worker", x: 520, y: 280, sub: "unshare namespaces" },
        { id: "overlay", label: "overlayfs", kind: "storage", x: 520, y: 80, sub: "rootfs + tmpfs layer" },
        { id: "pivot", label: "pivot_root", kind: "node", x: 760, y: 80, sub: "merged becomes /" },
        { id: "app", label: "Your command", kind: "service", x: 760, y: 280, sub: "PID 1 in its own world" },
        { id: "kernel", label: "Kernel", kind: "node", x: 760, y: 480, sub: "enforces the limits" },
      ],
      edges: [
        { from: "cli", to: "parent" },
        { from: "parent", to: "cgroup", label: "create + limits" },
        { from: "parent", to: "child", label: "fork (new PID ns)" },
        { from: "child", to: "cgroup", label: "join" },
        { from: "child", to: "overlay", label: "mount" },
        { from: "overlay", to: "pivot" },
        { from: "pivot", to: "app", label: "execvpe" },
        { from: "app", to: "kernel", label: "syscalls" },
        { from: "kernel", to: "cgroup", label: "OOM kill", dashed: true },
      ],
      flows: [
        {
          name: "minidocker run rootfs sh",
          path: ["cli", "parent", "cgroup", "parent", "child", "cgroup", "child", "overlay", "pivot", "app"],
          steps: [
            "The CLI parses --memory, --pids, --cpus, --hostname and --volume.",
            "The parent creates /sys/fs/cgroup/minidocker-ID and writes the limits into its files.",
            "It mounts a tmpfs for the container's writable layer and unshares a new PID namespace.",
            "It forks: the child is PID 1 in the new PID namespace.",
            "The child moves itself into the cgroup: the limits apply from now on.",
            "It unshares mount, UTS, IPC and network namespaces, and sets the hostname.",
            "It mounts overlayfs: the rootfs folder as the read-only lower layer, the tmpfs as the upper.",
            "Volumes, /proc and a minimal /dev are mounted inside; pivot_root makes merged the new / and the old root is detached.",
            "Loopback comes up, and execvpe replaces the child with your command: still PID 1, now in its own world.",
          ],
        },
        {
          name: "Hitting the memory limit",
          path: ["app", "kernel", "cgroup", "parent"],
          steps: [
            "The command allocates more memory than memory.max allows.",
            "The kernel's OOM killer SIGKILLs it inside the cgroup and counts oom_kill in memory.events.",
            "The parent's waitpid sees signal 9 and returns exit code 137; it reads memory.events to report the OOM, then removes the layer and the cgroup.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've been using Docker like a **magic box**: you put a program in, and it runs alone in its own little world. In this project you **build the magic box yourself**.

It turns out there's no magic: you ask the Linux kernel, politely, a handful of times:
- "give this program its **own name tag, own list of friends, own network**" (namespaces);
- "here's a **folder of files**; make that its whole world" (overlayfs and pivot_root);
- "don't let it eat more than **this much**" (cgroups).

Then you start the program inside. That's a container, and you'll have written the thing that makes them.

## What you'll build
**minidocker** runs a command in a new container, with the same steps as runc:
\`\`\`bash
python3 minidocker.py run --hostname box --memory 64M --pids 50 --cpus 0.5 \\
    --volume ./data:/data rootfs sh
\`\`\`
- the command is **PID 1** and sees only its own processes;
- it has its own **hostname**, **IPC** and a **network namespace** with just loopback;
- its root is an **overlayfs**: a read-only "image" folder plus a throwaway writable layer, so writes vanish with the container and the image stays untouched;
- **volumes** bind-mount host folders in, so data survives;
- **cgroup v2** enforces memory (with OOM detection and exit code 137), process count and CPU limits.

It's about 250 lines of Python using only the standard library; the few system calls Python doesn't wrap (\`unshare\`, \`mount\`, \`pivot_root\`) are called through \`ctypes\`. Twelve tests check every promise above by running real containers.

## What you need
**Linux** with cgroup v2 (any distribution from the last few years), **root**, and **Python 3.9+**. On a Mac or Windows, run it inside a privileged Docker container, which is a Linux machine with root:
\`\`\`bash
docker run --rm -it --privileged -v "$PWD":/w -w /w node:20 bash
\`\`\`
(\`node:20\` is Debian with Python 3 and the tools \`mkrootfs.sh\` copies. Yes, you'll run containers inside a container: \`--privileged\` lets it create namespaces and cgroups.)

Then follow the steps on the **Build** tab.`,
    keyPoints: [
      "A container runtime is a short list of kernel requests: unshare namespaces, mount an overlayfs root, pivot_root, apply cgroup limits, exec.",
      "unshare(CLONE_NEWPID) affects the next child, so the runtime forks and the child becomes PID 1.",
      "pivot_root really swaps the root filesystem (chroot can be escaped), and the old root is detached.",
      "cgroup v2 limits are files: memory.max, pids.max, cpu.max; memory.events records OOM kills.",
      "Exit codes follow the shell convention: a command killed by signal N exits 128 + N.",
    ],
    interview: [
      {
        q: "If you had to write a minimal container runtime, what would it do?",
        a: "Prepare a root filesystem (unpack image layers, mount overlayfs with a writable upper layer), create a cgroup and write the limits, then create the process: `clone`/`unshare` with new PID, mount, UTS, IPC, network (and optionally user and cgroup) namespaces. In the child: join the cgroup, set the hostname, make mounts private, mount the overlay, volumes, `/proc`, `/dev` and `/sys`, `pivot_root` into it and detach the old root, set up networking (a veth pair into a bridge from the parent side, or just loopback), drop capabilities, apply a seccomp filter, switch user, then `execve` the entrypoint with the configured environment. The parent waits, forwards signals, records the exit status (128+N for signals, OOM from `memory.events`), and cleans up mounts and the cgroup. That's what runc does from an OCI `config.json`.",
        freq: "common",
      },
      {
        q: "Why pivot_root instead of chroot?",
        a: "`chroot` only changes how the calling process resolves `/`; the old root is still mounted and reachable. A root process can escape with classic tricks (chroot into a subdirectory while holding a file descriptor to an outside directory, then `fchdir` up). `pivot_root` moves the whole mount namespace's root: the new root becomes `/`, the old root is moved to a directory under it and can then be **unmounted** (`umount2(MNT_DETACH)`), so it no longer exists in the container's mount namespace at all. Combined with a private mount namespace, nothing of the host's filesystem remains visible except what you explicitly mounted.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "After `unshare(CLONE_NEWPID)`, why does minidocker fork?",
        options: ["To save memory", "A new PID namespace applies to the caller's next child, which becomes PID 1", "fork is needed for cgroups", "To run tests"],
        answer: 1,
        explain: "The caller itself stays in its old PID namespace.",
      },
      {
        q: "Where do a container's writes go in minidocker?",
        options: ["Into the rootfs folder", "Into the overlay's upper layer on a tmpfs, which is deleted afterwards", "Nowhere: writes fail", "Into /proc"],
        answer: 1,
        explain: "overlayfs copies files up into the writable layer; the image folder never changes.",
      },
      {
        q: "How does minidocker know a container was OOM-killed?",
        options: ["The command prints a message", "The oom_kill counter in the cgroup's memory.events", "Exit code 1", "It guesses"],
        answer: 1,
        explain: "Docker reads the same counter to set OOMKilled.",
      },
    ],
    project: {
      summary: `You'll build **minidocker**, a container runtime in about 250 lines of Python with no third-party libraries, in six steps: a tiny root filesystem to use as an image, the system calls Python doesn't wrap, the container's filesystem (overlayfs, volumes, \`/proc\`, \`/dev\`, \`pivot_root\`), cgroup limits, the \`run\` command, and 12 tests that start real containers to prove isolation, copy-on-write and limits.

You need **Linux with cgroup v2, root and Python 3.9+**. On a Mac or Windows, run everything inside \`docker run --rm -it --privileged -v "$PWD":/w -w /w node:20 bash\`.`,
      skills: [
        "Linux namespaces: pid, mount, uts, ipc, net",
        "Calling system calls from Python with ctypes",
        "overlayfs, bind mounts, mount propagation and pivot_root",
        "cgroup v2: memory, pids and cpu controllers",
        "fork, exec, waitpid and exit codes",
        "Testing a system tool end to end",
      ],
      tree: `minidocker/
├── mkrootfs.sh          # builds a tiny "image": 15 programs and their libraries
├── kernel.py            # unshare, mount, umount, pivot_root through ctypes
├── rootfs.py            # overlayfs, volumes, /proc, /dev, pivot_root, loopback
├── cgroups.py           # memory, pids and cpu limits (cgroup v2)
├── minidocker.py        # the CLI: run [--hostname --memory --pids --cpus -v] ROOTFS COMMAND
└── test_minidocker.py   # 12 tests: isolation, copy-on-write, limits`,
      steps: [
        {
          title: "1. An image is just a folder",
          explain: `A container image, unpacked, is a folder that looks like a tiny Linux system: \`/bin\`, \`/etc\`, \`/lib\`... We build one by hand so you can see there's nothing more to it.
- For each program, \`type -P\` finds its file (not the shell's built-in \`echo\`), and \`cp -L\` copies it, following symlinks.
- Programs need **shared libraries** at startup (\`libc.so.6\`, the dynamic loader...). \`ldd\` lists them, and we copy each one to the same path inside the folder.
- A minimal \`/etc/passwd\` and \`/etc/group\` let \`id\` and \`ps\` print \`root\`, and \`/tmp\` gets the sticky bit like on a real system.

The result is about 7 MB. The comment at the top shows the easy way when you have Docker: export a container's filesystem into a folder. (On x86-64 you'll also see a \`lib64\` folder, and slightly different counts.)`,
          files: [{ path: "mkrootfs.sh", lang: "bash", code: `#!/usr/bin/env bash
# Build a tiny "image": a root filesystem with a few programs and the shared libraries they need.
# (The easy way on a machine with Docker: docker export $(docker create ubuntu:24.04) | tar -x -C rootfs)
set -euo pipefail
root=\${1:-rootfs}
rm -rf "$root"
mkdir -p "$root"/{bin,etc,proc,dev,tmp,root}

for prog in sh ls cat echo hostname ps sleep touch rm mkdir id head tr wc env; do
  path=$(type -P "$prog")   # the program file (not the shell builtin)
  cp -L "$path" "$root/bin/$prog"
  # ldd lists the shared libraries a program loads at startup; copy each to the same path
  for lib in $(ldd "$path" | grep -o '/[^ ]*'); do
    mkdir -p "$root$(dirname "$lib")"
    cp -L "$lib" "$root$lib"
  done
done

echo "root:x:0:0:root:/root:/bin/sh" > "$root/etc/passwd"
echo "root:x:0:" > "$root/etc/group"
chmod 1777 "$root/tmp"
echo "built $root: $(find "$root" -type f | wc -l) files, $(du -sh "$root" | cut -f1)"` }],
          run: `bash mkrootfs.sh rootfs
ls rootfs`,
          output: `built rootfs: 29 files, 7.3M
bin
dev
etc
lib
proc
root
tmp`,
        },
        {
          title: "2. Talking to the kernel",
          explain: `Python's \`os\` module has \`fork\`, \`execvpe\` and \`mknod\`, but (before 3.12) no \`unshare\`, and no \`mount\` or \`pivot_root\` at all. \`ctypes\` can call any C function in libc:
- \`ctypes.CDLL(None, use_errno=True)\` opens the C library already loaded into Python;
- each wrapper turns Python strings into bytes, calls the function, and raises \`OSError\` with the real error message when it returns non-zero;
- \`pivot_root\` has no libc function, so we use the generic \`syscall()\` with its number, which differs between CPU architectures (155 on x86-64, 41 on ARM64).

The \`CLONE_NEW*\` flags choose which namespaces \`unshare\` creates. Try one: a new **UTS namespace** lets a process change its hostname without changing the machine's.`,
          files: [{ path: "kernel.py", lang: "python", code: `"""The few Linux system calls Python's os module doesn't wrap (in Python 3.11), called through ctypes."""
import ctypes
import os
import platform

libc = ctypes.CDLL(None, use_errno=True)

# unshare() flags: which namespaces to create
CLONE_NEWNS = 0x00020000   # mounts
CLONE_NEWUTS = 0x04000000  # hostname
CLONE_NEWIPC = 0x08000000  # shared memory, semaphores
CLONE_NEWPID = 0x20000000  # process IDs
CLONE_NEWNET = 0x40000000  # network stack

# mount() flags
MS_NOSUID, MS_NODEV, MS_NOEXEC = 2, 4, 8
MS_BIND, MS_REC, MS_PRIVATE = 4096, 16384, 1 << 18
MNT_DETACH = 2

# pivot_root has no libc wrapper, so call it by its system call number
SYS_PIVOT_ROOT = {"x86_64": 155, "aarch64": 41}[platform.machine()]


def _check(ret, what):
    if ret != 0:
        err = ctypes.get_errno()
        raise OSError(err, f"{what}: {os.strerror(err)}")


def _b(s):
    return s.encode() if s is not None else None


def unshare(flags):
    _check(libc.unshare(flags), "unshare")


def mount(source, target, fstype=None, flags=0, data=None):
    _check(libc.mount(_b(source), _b(target), _b(fstype), flags, _b(data)), f"mount {target}")


def umount(target):
    _check(libc.umount2(_b(target), MNT_DETACH), f"umount {target}")


def pivot_root(new_root, put_old):
    _check(libc.syscall(SYS_PIVOT_ROOT, _b(new_root), _b(put_old)), "pivot_root")` }],
          run: `python3 -c "
import socket, kernel
kernel.unshare(kernel.CLONE_NEWUTS)   # a new hostname namespace, just for this process
socket.sethostname('inside')
print('my hostname:', socket.gethostname())"
echo "the machine's hostname: $(hostname)"`,
          output: `my hostname: inside
the machine's hostname: 5b1e0c7d2f3a`,
        },
        {
          title: "3. The container's filesystem",
          explain: `\`setup_root\` runs **inside a new mount namespace** and turns the image folder into the container's \`/\`:
1. **Make every mount private.** Many systems mark \`/\` as "shared", which would copy our mounts back to the host. \`MS_REC | MS_PRIVATE\` stops that.
2. **overlayfs**: the image is the read-only \`lowerdir\`, the container's layer is the writable \`upperdir\` (copy-up and whiteouts, from the overlayfs lesson).
3. **Volumes**: bind mounts of host folders into the merged tree.
4. A fresh **\`/proc\`** (in the container's PID namespace it will list only the container's processes) and a tmpfs **\`/dev\`** with just \`null\`, \`zero\`, \`random\` and \`urandom\`, created with \`mknod\`.
5. **pivot_root**: \`merged\` becomes \`/\` and the old root moves to \`/.old_root\`, which we detach and delete. Unlike \`chroot\`, nothing of the host's filesystem remains reachable.

\`loopback_up()\` uses two \`ioctl\` calls to bring up \`lo\` in the new network namespace (it starts down).

Try it: a new mount namespace, a tmpfs for the layer, then \`ls\` runs with the image as its root.`,
          files: [{ path: "rootfs.py", lang: "python", code: `"""Build the container's world: its filesystem (overlayfs + pivot_root), /proc, /dev and network."""
import fcntl
import os
import socket
import struct

from kernel import MS_BIND, MS_NODEV, MS_NOEXEC, MS_NOSUID, MS_PRIVATE, MS_REC, mount, pivot_root, umount


def make_dev(root):
    """A tmpfs /dev with only the harmless devices, like Docker gives you."""
    mount("tmpfs", f"{root}/dev", "tmpfs", MS_NOSUID, "mode=755")
    for name, minor in [("null", 3), ("zero", 5), ("random", 8), ("urandom", 9)]:
        os.mknod(f"{root}/dev/{name}", 0o666 | 0o020000, os.makedev(1, minor))  # character devices 1:minor
        os.chmod(f"{root}/dev/{name}", 0o666)


def setup_root(image, layer_dir, volumes):
    """Called inside the new mount namespace. Afterwards / is the container's filesystem."""
    upper, work, merged = (f"{layer_dir}/{d}" for d in ("upper", "work", "merged"))
    # 1. Make every mount private, so nothing we mount from now on leaks back to the host
    mount(None, "/", None, MS_REC | MS_PRIVATE)
    # 2. overlayfs: the image (read-only, lowerdir) + this container's writable layer (upperdir)
    mount("overlay", merged, "overlay", 0, f"lowerdir={image},upperdir={upper},workdir={work}")
    # 3. volumes: bind-mount host folders into the container
    for host_dir, container_dir in volumes:
        os.makedirs(f"{merged}{container_dir}", exist_ok=True)
        mount(host_dir, f"{merged}{container_dir}", None, MS_BIND | MS_REC)
    # 4. a fresh /proc that shows only this PID namespace, and a minimal /dev
    mount("proc", f"{merged}/proc", "proc", MS_NOSUID | MS_NODEV | MS_NOEXEC)
    make_dev(merged)
    # 5. pivot_root: merged becomes /, the old / moves to /.old_root ... which we then detach.
    #    (chroot only changes how paths resolve and can be escaped; pivot_root really swaps the root.)
    os.makedirs(f"{merged}/.old_root", exist_ok=True)
    pivot_root(merged, f"{merged}/.old_root")
    os.chdir("/")
    umount("/.old_root")
    os.rmdir("/.old_root")


def loopback_up():
    """A new network namespace has only the loopback device, and it's down. Bring it up."""
    SIOCGIFFLAGS, SIOCSIFFLAGS, IFF_UP = 0x8913, 0x8914, 0x1
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        req = struct.pack("16sH14x", b"lo", 0)
        flags = struct.unpack("16sH14x", fcntl.ioctl(s, SIOCGIFFLAGS, req))[1]
        fcntl.ioctl(s, SIOCSIFFLAGS, struct.pack("16sH14x", b"lo", flags | IFF_UP))` }],
          run: `mkdir -p layer && python3 -c "
import os, kernel, rootfs
kernel.unshare(kernel.CLONE_NEWNS)       # a new mount namespace: our mounts stay private
kernel.mount('tmpfs', 'layer', 'tmpfs')
for d in ('upper', 'work', 'merged'):
    os.mkdir('layer/' + d)
rootfs.setup_root(os.path.abspath('rootfs'), os.path.abspath('layer'), [])
os.execv('/bin/ls', ['ls', '/', '/dev'])"`,
          output: `/:
bin
dev
etc
lib
proc
root
tmp

/dev:
null
random
urandom
zero`,
        },
        {
          title: "4. Limits with cgroups",
          explain: `With cgroup v2, a cgroup is a **directory** under \`/sys/fs/cgroup\`, and limits are numbers written into its files:
- \`memory.max\` in bytes, and \`memory.swap.max = 0\` so the process can't escape the limit by swapping;
- \`pids.max\`: the maximum number of processes and threads;
- \`cpu.max\`: "quota period" in microseconds: \`50000 100000\` = half a CPU.

A parent cgroup must **enable** the controllers for its children in \`cgroup.subtree_control\`. One catch: cgroup v2's "no internal processes" rule. Inside a container (like the \`node:20\` one on a Mac), our root cgroup already holds processes, so \`enable_controllers\` first moves them into an \`init/\` child group.

\`join\` writes \`0\` ("me") into \`cgroup.procs\`, and \`oom_killed\` reads the \`oom_kill\` counter from \`memory.events\`. A cgroup can be removed with \`rmdir\` once it's empty.`,
          files: [{ path: "cgroups.py", lang: "python", code: `"""cgroup v2 limits: a cgroup is a directory, and its limits are files you write numbers into."""
import os

CGROUP = "/sys/fs/cgroup"


def _write(path, text):
    with open(path, "w") as f:
        f.write(text)


def parse_size(text):
    units = {"K": 1 << 10, "M": 1 << 20, "G": 1 << 30}
    unit = text[-1].upper()
    return int(text[:-1]) * units[unit] if unit in units else int(text)


def enable_controllers():
    """Let child cgroups use the memory, pids and cpu controllers.

    cgroup v2's "no internal processes" rule: a group that holds processes can't hand controllers
    to its children. When we run inside a container, our root group holds processes, so move them
    into an init/ group first. (On a normal Linux host the real root group is exempt from the rule.)
    """
    wanted = "+memory +pids +cpu"
    try:
        _write(f"{CGROUP}/cgroup.subtree_control", wanted)
    except OSError:
        os.makedirs(f"{CGROUP}/init", exist_ok=True)
        for pid in open(f"{CGROUP}/cgroup.procs").read().split():
            try:
                _write(f"{CGROUP}/init/cgroup.procs", pid)
            except OSError:
                pass  # that process already exited
        _write(f"{CGROUP}/cgroup.subtree_control", wanted)


def create(cid, memory=None, pids=None, cpus=None):
    enable_controllers()
    path = f"{CGROUP}/minidocker-{cid}"
    os.mkdir(path)
    if memory:
        _write(f"{path}/memory.max", str(parse_size(memory)))
        _write(f"{path}/memory.swap.max", "0")  # no swapping our way out of the limit
    if pids:
        _write(f"{path}/pids.max", str(pids))
    if cpus:
        _write(f"{path}/cpu.max", f"{int(float(cpus) * 100_000)} 100000")  # quota per 100 ms period
    return path


def join(path):
    """Move the calling process into the cgroup ("0" means "me")."""
    _write(f"{path}/cgroup.procs", "0")


def oom_killed(path):
    events = dict(line.split() for line in open(f"{path}/memory.events"))
    return int(events.get("oom_kill", 0)) > 0


def remove(path):
    os.rmdir(path)  # works once every process in it has exited` }],
          run: `python3 -c "
import cgroups
path = cgroups.create('demo', memory='64M', pids=20, cpus='0.5')
for f in ('memory.max', 'pids.max', 'cpu.max'):
    print(f, '=', open(path + '/' + f).read().strip())
cgroups.remove(path)"`,
          output: `memory.max = 67108864
pids.max = 20
cpu.max = 50000 100000`,
        },
        {
          title: "5. minidocker run",
          explain: `Now put it together, in the order runc does it.

**The parent** creates the cgroup and a tmpfs for the container's writable layer, then calls \`unshare(CLONE_NEWPID)\`. A new PID namespace doesn't move the caller; it applies to its **next child**. So it forks, and the child is **PID 1** in the new namespace.

**The child** joins the cgroup first (so everything it does is limited), unshares the mount, UTS, IPC and network namespaces, sets the hostname, sets up the root filesystem and loopback, and finally \`execvpe\`s your command with a clean environment. \`exec\` replaces the program but keeps the PID: your command is PID 1.

**The parent** waits. A process killed by signal N gets exit code **128 + N**, like in a shell and in Docker (SIGKILL = 9, so 137). It checks \`memory.events\` to report an OOM kill, then unmounts the layer (everything the container wrote disappears) and removes the cgroup.

Run a shell in it, then a command that needs far more memory than allowed.`,
          files: [{ path: "minidocker.py", lang: "python", code: `#!/usr/bin/env python3
"""minidocker: a tiny container runtime. Linux only, run as root.

    python3 minidocker.py run [--hostname H] [--memory 64M] [--pids 50] [--cpus 0.5]
                              [--volume /host/dir:/container/dir] ROOTFS COMMAND [ARGS...]

The same steps runc takes:
  1. cgroup      a new control group with the memory, pids and cpu limits
  2. namespaces  new PID, mount, UTS (hostname), IPC and network namespaces
  3. filesystem  overlayfs (image + writable layer), /proc, /dev, volumes, then pivot_root
  4. exec        replace ourselves with the user's command: it is PID 1 in its own world
"""
import argparse
import os
import shutil
import socket
import sys
import uuid

import cgroups
from kernel import CLONE_NEWIPC, CLONE_NEWNET, CLONE_NEWNS, CLONE_NEWPID, CLONE_NEWUTS, mount, umount, unshare
from rootfs import loopback_up, setup_root

STATE = "/run/minidocker"


def run(args):
    cid = uuid.uuid4().hex[:12]
    hostname = args.hostname or cid
    image = os.path.abspath(args.rootfs)
    volumes = [(os.path.abspath(v.split(":")[0]), v.split(":")[1]) for v in args.volume]
    cgroup = cgroups.create(cid, args.memory, args.pids, args.cpus)

    # The writable layer lives on a tmpfs, so it vanishes with the container (like docker run --rm)
    layer_dir = f"{STATE}/{cid}"
    os.makedirs(layer_dir)
    mount("tmpfs", layer_dir, "tmpfs")
    for d in ("upper", "work", "merged"):
        os.mkdir(f"{layer_dir}/{d}")

    # A new PID namespace applies to our NEXT child: after fork, the child is PID 1 inside it
    unshare(CLONE_NEWPID)
    pid = os.fork()
    if pid == 0:  # ---- the child: becomes the container
        try:
            cgroups.join(cgroup)
            unshare(CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC | CLONE_NEWNET)
            socket.sethostname(hostname)
            setup_root(image, layer_dir, volumes)
            loopback_up()
            env = {"PATH": "/bin", "HOSTNAME": hostname, "HOME": "/root"}
            os.execvpe(args.command[0], args.command, env)  # never returns
        except OSError as e:
            print(f"minidocker: {e}", file=sys.stderr)
            os._exit(127)

    # ---- the parent: wait for the container, then clean up after it
    _, status = os.waitpid(pid, 0)
    code = os.waitstatus_to_exitcode(status)
    if code < 0:
        code = 128 - code  # killed by signal N -> exit code 128 + N, like docker (SIGKILL -> 137)
    if cgroups.oom_killed(cgroup):
        print("minidocker: the container was OOM-killed (it hit its memory limit)", file=sys.stderr)
    umount(layer_dir)
    shutil.rmtree(layer_dir)
    cgroups.remove(cgroup)
    return code


def main():
    parser = argparse.ArgumentParser(prog="minidocker")
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run a command in a new container")
    r.add_argument("--hostname")
    r.add_argument("--memory", help="memory limit, e.g. 64M")
    r.add_argument("--pids", type=int, help="maximum number of processes")
    r.add_argument("--cpus", help="CPU limit, e.g. 0.5")
    r.add_argument("--volume", "-v", action="append", default=[], help="/host/dir:/container/dir")
    r.add_argument("rootfs")
    r.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if os.geteuid() != 0:
        sys.exit("minidocker: must run as root (namespaces, mounts and cgroups need it)")
    if not args.command:
        sys.exit("minidocker: what should the container run?")
    sys.exit(run(args))


if __name__ == "__main__":
    main()` }],
          run: `python3 minidocker.py run --hostname box rootfs sh -c 'hostname; ps -e -o pid,comm; ls /'
python3 minidocker.py run --memory 32M rootfs sh -c 'x=$(head -c 100000000 /dev/zero | tr "\\0" a)'
echo "exit code: $?"`,
          output: `box
  PID COMMAND
    1 sh
    3 ps
bin
dev
etc
lib
proc
root
tmp
minidocker: the container was OOM-killed (it hit its memory limit)
exit code: 137`,
        },
        {
          title: "6. Prove it with tests",
          explain: `Each test starts a real container with \`minidocker.py run\` and checks one promise:
- **Isolation**: the command is PID 1 and alone; it has its own hostname (and the host's is unchanged); \`/\` contains exactly the image's folders; the network has loopback and no real network card; \`/dev\` has only four devices.
- **Copy-on-write**: a written file is visible inside but not in the image folder, and the next container starts clean; deleting an image file inside doesn't delete it from the image; a volume's writes reach the host.
- **Limits**: exit codes pass through; 100 MB in a 32 MB container is OOM-killed with 137; 15 background processes under \`--pids 10\` make \`fork\` fail; a CPU limit is accepted.

Some kernels add idle tunnel devices (\`tunl0\`, \`gre0\`...) to every new network namespace, so the network test checks for the absence of real interfaces instead of an exact list.`,
          files: [{ path: "test_minidocker.py", lang: "python", code: `"""Tests for minidocker: each one runs a real container. Run as root:  python3 -m unittest -v"""
import os
import socket
import subprocess
import tempfile
import unittest

ROOTFS = os.environ.get("ROOTFS", "rootfs")


def run(*args):
    """minidocker run ... -> (exit code, stdout, stderr)"""
    p = subprocess.run(["python3", "minidocker.py", "run", *args], capture_output=True, text=True, timeout=60)
    return p.returncode, p.stdout, p.stderr


class Isolation(unittest.TestCase):
    def test_command_is_pid_1(self):
        code, out, _ = run(ROOTFS, "ps", "-e", "-o", "pid,comm")
        self.assertEqual(code, 0)
        self.assertEqual(out.split(), ["PID", "COMMAND", "1", "ps"])

    def test_own_hostname(self):
        code, out, _ = run("--hostname", "box", ROOTFS, "hostname")
        self.assertEqual(out.strip(), "box")
        self.assertNotEqual(socket.gethostname(), "box")  # the host's name didn't change

    def test_own_filesystem(self):
        _, out, _ = run(ROOTFS, "ls", "/")
        self.assertEqual(out.split(), sorted(os.listdir(ROOTFS)))  # exactly the image's top-level folders
        self.assertNotIn("sys", out.split())  # and nothing from the host

    def test_only_loopback_network(self):
        _, out, _ = run(ROOTFS, "cat", "/proc/net/dev")
        interfaces = [line.split(":")[0].strip() for line in out.splitlines()[2:]]
        self.assertIn("lo", interfaces)
        # no real network card (some kernels also add idle tunnel devices like tunl0 to every namespace)
        self.assertFalse([i for i in interfaces if i.startswith(("eth", "en", "wl"))])

    def test_minimal_dev(self):
        _, out, _ = run(ROOTFS, "ls", "/dev")
        self.assertEqual(out.split(), ["null", "random", "urandom", "zero"])


class CopyOnWrite(unittest.TestCase):
    def test_writes_stay_in_the_container(self):
        code, out, _ = run(ROOTFS, "sh", "-c", "echo hello > /etc/greeting && cat /etc/greeting")
        self.assertEqual((code, out), (0, "hello\\n"))
        self.assertFalse(os.path.exists(f"{ROOTFS}/etc/greeting"))  # the image is untouched
        code, _, err = run(ROOTFS, "cat", "/etc/greeting")  # and the next container starts clean
        self.assertNotEqual(code, 0)
        self.assertIn("No such file", err)

    def test_deleting_an_image_file(self):
        code, _, _ = run(ROOTFS, "sh", "-c", "rm /bin/ls && ! test -e /bin/ls")
        self.assertEqual(code, 0)
        self.assertTrue(os.path.exists(f"{ROOTFS}/bin/ls"))

    def test_volume(self):
        with tempfile.TemporaryDirectory(dir=".") as host_dir:
            code, _, _ = run("--volume", f"{host_dir}:/data", ROOTFS, "sh", "-c", "echo saved > /data/out.txt")
            self.assertEqual(code, 0)
            with open(f"{host_dir}/out.txt") as f:
                self.assertEqual(f.read(), "saved\\n")


class Limits(unittest.TestCase):
    def test_exit_code_passes_through(self):
        self.assertEqual(run(ROOTFS, "sh", "-c", "exit 3")[0], 3)

    def test_memory_limit_oom_kill(self):
        # dash keeps the whole output of $(...) in memory: 100 MB in a 32 MB container
        code, out, err = run("--memory", "32M", ROOTFS, "sh", "-c", 'x=$(head -c 100000000 /dev/zero | tr "\\\\0" a); echo survived')
        self.assertEqual(code, 137)  # 128 + SIGKILL
        self.assertNotIn("survived", out)
        self.assertIn("OOM-killed", err)

    def test_pids_limit_stops_fork_bombs(self):
        code, out, err = run("--pids", "10", ROOTFS, "sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do sleep 2 & done; wait; echo done")
        self.assertIn("fork", err.lower())

    def test_cpu_limit_is_accepted(self):
        code, out, _ = run("--cpus", "0.25", ROOTFS, "sh", "-c", "echo ok")
        self.assertEqual((code, out), (0, "ok\\n"))


if __name__ == "__main__":
    unittest.main()` }],
          run: `python3 -m unittest -v`,
          output: `test_deleting_an_image_file (test_minidocker.CopyOnWrite.test_deleting_an_image_file) ... ok
test_volume (test_minidocker.CopyOnWrite.test_volume) ... ok
test_writes_stay_in_the_container (test_minidocker.CopyOnWrite.test_writes_stay_in_the_container) ... ok
test_command_is_pid_1 (test_minidocker.Isolation.test_command_is_pid_1) ... ok
test_minimal_dev (test_minidocker.Isolation.test_minimal_dev) ... ok
test_only_loopback_network (test_minidocker.Isolation.test_only_loopback_network) ... ok
test_own_filesystem (test_minidocker.Isolation.test_own_filesystem) ... ok
test_own_hostname (test_minidocker.Isolation.test_own_hostname) ... ok
test_cpu_limit_is_accepted (test_minidocker.Limits.test_cpu_limit_is_accepted) ... ok
test_exit_code_passes_through (test_minidocker.Limits.test_exit_code_passes_through) ... ok
test_memory_limit_oom_kill (test_minidocker.Limits.test_memory_limit_oom_kill) ... ok
test_pids_limit_stops_fork_bombs (test_minidocker.Limits.test_pids_limit_stops_fork_bombs) ... ok

----------------------------------------------------------------------
Ran 12 tests in 1.204s

OK`,
        },
      ],
      extensions: [
        "Real images: add a pull command that exports a Docker image (docker export) or unpacks an OCI layout (from the engine lesson) and stacks its layers as several lowerdirs",
        "Networking: create a veth pair, move one end into the container's namespace (ip link set ... netns PID from the parent), give it an IP on a bridge, and add NAT for internet access",
        "Drop capabilities with prctl/capset, and set no_new_privs before exec",
        "A seccomp filter that blocks a few syscalls (python-seccomp, or a hand-written BPF program)",
        "Run as a non-root user inside: setgroups, setgid, setuid after the mounts",
        "User namespaces: map container root to your own UID so minidocker works without sudo (rootless mode)",
        "Detached containers: minidocker run -d, a state directory per container, ps, logs and stop commands",
        "Read an OCI runtime bundle's config.json and run it, so your runtime can stand in for runc",
      ],
      verify: "bash mkrootfs.sh rootfs > /dev/null && python3 -m unittest -v",
      linux: true,
      privileged: true,
    },
  },

  // ------------------------------------------------------------------ INTERVIEW
  {
    id: "dk-interview",
    title: "The Docker interview: putting it all together",
    tagline: "The question bank by topic, the commands to know cold, a troubleshooting playbook for containers that exit, can't connect or get killed, the classic review-this-Dockerfile exercise, and where to go after Docker.",
    difficulty: "advanced",
    minutes: 35,
    diagram: {
      title: "\"My container doesn't work\": a troubleshooting playbook",
      nodes: [
        { id: "start", label: "It doesn't work", kind: "client", x: 90, y: 280, sub: "start here" },
        { id: "ps", label: "docker ps -a", kind: "control", x: 290, y: 280, sub: "Up or Exited?" },
        { id: "exited", label: "Exited (N)", kind: "worker", x: 500, y: 110, sub: "the exit code tells you why" },
        { id: "logs", label: "docker logs", kind: "monitor", x: 760, y: 60, sub: "the app's last words" },
        { id: "inspect", label: "docker inspect", kind: "monitor", x: 760, y: 220, sub: ".State: OOMKilled, Health" },
        { id: "running", label: "Up, unreachable", kind: "service", x: 500, y: 450, sub: "the process runs" },
        { id: "port", label: "docker port", kind: "gateway", x: 720, y: 450, sub: "published? listening on 0.0.0.0?" },
        { id: "net", label: "Networks + DNS", kind: "node", x: 900, y: 360, sub: "same network? service name?" },
      ],
      edges: [
        { from: "start", to: "ps" },
        { from: "ps", to: "exited" },
        { from: "exited", to: "logs" },
        { from: "exited", to: "inspect" },
        { from: "ps", to: "running" },
        { from: "running", to: "port" },
        { from: "port", to: "net" },
      ],
      flows: [
        {
          name: "It exits right away",
          path: ["start", "ps", "exited", "logs"],
          steps: [
            "docker ps hides stopped containers: always look with -a.",
            "Exited (0): the main process finished (no long-running command, or a daemon that forked into the background). 1: an app error. 127: command not found. 126: not executable.",
            "docker logs shows what it printed before dying: a missing environment variable, a failed connection, a stack trace.",
          ],
        },
        {
          name: "It gets killed",
          path: ["start", "ps", "exited", "inspect"],
          steps: [
            "The status says Exited (137), possibly with a restart count climbing.",
            "137 = 128 + 9: SIGKILL. It was killed, not crashed.",
            "OOMKilled: true means the memory limit (raise it, or find the leak). false: docker kill, or a stop timeout because SIGTERM was ignored.",
          ],
        },
        {
          name: "It runs but I can't reach it",
          path: ["start", "ps", "running", "port", "net"],
          steps: [
            "docker ps -a shows Up: the process is fine, the path to it isn't.",
            "Up but unreachable. Check docker exec ... to call it from inside: does the app answer at all?",
            "Is the port published (EXPOSE alone publishes nothing)? Is the app listening on 0.0.0.0? An app bound to 127.0.0.1 inside the container can't be reached from outside.",
            "From another container: are both on the same user-defined network, and do you use the service name? localhost is the container itself.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've learned how to pack a program into a **lunchbox** (an image), run it (a container), give it a **locker** for things it must keep (a volume), connect lunchboxes with **walkie-talkies** (networks), describe the whole picnic in one plan (Compose), and even how the lunchbox is made from **blinkers and a budget** (namespaces and cgroups). A Docker interview asks you to **explain these things simply**, then zoom in on one when asked "and how does that work?".

## The question bank
| Topic | What interviewers ask | Lesson |
|---|---|---|
| Basics | What is Docker, image vs container, container vs VM | Why containers exist |
| Lifecycle | Exit codes, stop vs kill, exec vs attach, why it exits immediately | Your first containers |
| Images | Tags vs digests, layers, registries, multi-platform | Images, tags and registries |
| Networking basics | -p vs EXPOSE, 0.0.0.0, env vars and config | Ports, environment and configuration |
| Dockerfile | RUN/CMD/ENTRYPOINT, COPY vs ADD, build context | Your first Dockerfile |
| Build speed | Layer cache, instruction order, cache mounts | Layers and the build cache |
| PID 1 | Signals, shell vs exec form, --init, entrypoint scripts | CMD, ENTRYPOINT and PID 1 |
| Image size and safety | Multi-stage, slim/alpine/distroless, non-root, build secrets | Small, secure images |
| Data | Volumes vs bind mounts vs tmpfs, backups | Volumes and bind mounts |
| Networking | Bridge, DNS, isolation, host mode, container:X | Container networking |
| Compose | depends_on and health, down -v, when to use Kubernetes | Docker Compose |
| Internals | Namespaces, cgroups, OOM vs throttling, pods | What a container really is |
| Storage | overlayfs, copy-up, whiteouts | Copy-on-write: how image layers stack |
| Architecture | dockerd, containerd, runc, OCI, dockershim | The engine |
| Security | Capabilities, --privileged, docker.sock, rootless, scanning | Container security |
| Operations | Limits, health checks, restart policies, logs, debugging | Running containers in production |
| CI/CD | Test stages, tags, buildx, caches, :latest | Docker in CI/CD |

## Commands to know cold
| Task | Command |
|---|---|
| Run, detached, named, published, with a volume | \`docker run -d --name web -p 8080:80 -v data:/data nginx:1.27\` |
| List everything (including stopped) | \`docker ps -a\`, \`docker images\`, \`docker volume ls\`, \`docker network ls\` |
| Look inside | \`docker logs -f web\`, \`docker exec -it web sh\`, \`docker inspect web\`, \`docker stats\` |
| Build and tag | \`docker build -t app:1.0 .\`, \`docker tag app:1.0 registry/app:1.0\`, \`docker push\` |
| Multi-platform | \`docker buildx build --platform linux/amd64,linux/arm64 --push -t ... .\` |
| Compose | \`docker compose up -d --build --wait\`, \`ps\`, \`logs -f\`, \`exec\`, \`down\` (\`-v\` deletes volumes) |
| Clean up | \`docker system df\`, \`docker system prune\`, \`docker builder prune\` |
| History and changes | \`docker history app:1.0\`, \`docker diff web\` |

## The classic exercise: review this Dockerfile
Many interviews hand you a Dockerfile and ask "what would you change?". The samples below are a typical bad one and a reviewed version. Practise finding **all ten** problems before reading the list.

## Answering well
- **Start simple, then go deeper.** "A container is an isolated process" first; namespaces, cgroups and overlayfs when they ask how.
- **Name the trade-off.** Alpine is small but uses musl; volumes persist but need backups; \`--network host\` is fast but loses isolation.
- **Bring a story.** A container that was OOM-killed, a build that took 10 minutes until you reordered the Dockerfile, a secret you found in an image layer.
- **Debug out loud.** For "it doesn't work" questions, walk the playbook in the diagram: \`ps -a\`, exit code, logs, inspect; or published port, listening address, network and DNS.

## Where to go next
- **Kubernetes** (the next world): Pods are namespace-sharing containers, Deployments do rolling updates, Services do the DNS and load balancing you set up by hand here.
- The **Operating systems** world's processes, memory, file systems and security lessons explain the kernel features under every container.
- Build something: containerize one of your own projects, end to end, with the Compose project as a template.`,
    keyPoints: [
      "Explain simply first (an isolated process from an image), then go deeper on request (namespaces, cgroups, overlayfs, runc).",
      "Troubleshoot in order: docker ps -a, exit code, logs, inspect; or published port, listening address, network and DNS.",
      "A good Dockerfile: pinned slim base, dependency files before code, npm ci or equivalent, no secrets, non-root USER, exec-form CMD, a health check.",
      "Never: :latest in production, secrets in images or env vars, --privileged or docker.sock for apps, unbounded containers.",
      "Kubernetes builds on exactly these ideas: pods share namespaces, and the images are the same OCI images.",
    ],
    code: [
      {
        title: "Review this Dockerfile",
        noCheck: "a deliberately bad Dockerfile: finding its problems is the exercise",
        variants: [{ lang: "dockerfile", code: `FROM node:latest
COPY . /app
WORKDIR /app
RUN apt-get update
RUN apt-get install -y curl vim
RUN npm install
ENV DB_PASSWORD=hunter2
EXPOSE 3000
CMD npm start` }],
        explain: `Ten problems:
1. \`node:latest\`: unpinned, so builds change without warning; and the full image is about 1 GB. Use a pinned slim tag (\`node:20-slim\`, or a digest).
2. \`COPY . /app\` **before** installing dependencies: every code change invalidates the cache and reinstalls everything.
3. No \`.dockerignore\`: \`node_modules\`, \`.git\` and \`.env\` from your laptop end up in the image.
4. \`apt-get update\` in its own \`RUN\`: it gets cached, so a later install uses stale package lists. Combine update and install in one \`RUN\`, and clean the lists.
5. \`curl\` and \`vim\` in production: bigger image, more vulnerabilities. Debug with a toolbox container instead.
6. \`npm install\`: may change versions and installs dev dependencies. Use \`npm ci --omit=dev\` with the lockfile.
7. \`ENV DB_PASSWORD=hunter2\`: the secret is in the image forever, visible to \`docker inspect\` and everyone who can pull it.
8. Runs as **root**: add \`USER node\` (and make sure it can write where it needs to).
9. \`CMD npm start\` in shell form: \`/bin/sh\` is PID 1, then npm; SIGTERM never reaches node, so \`docker stop\` waits 10 s and kills it. Use \`CMD ["node", "server.js"]\`.
10. No \`NODE_ENV=production\` and no \`HEALTHCHECK\`.`,
      },
      {
        title: "The reviewed version",
        docker: true,
        images: ["node:20-slim"],
        files: [
          { path: "Dockerfile", lang: "dockerfile", code: `# a pinned, slim base
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
# dependencies first, so code changes don't reinstall them; npm ci = exactly the lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
# no secrets here: DB_PASSWORD arrives at run time, as a mounted file
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=2s \\
  CMD ["node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
# exec form: node is PID 1 and receives SIGTERM
CMD ["node", "server.js"]` },
          { path: ".dockerignore", lang: "text", code: `node_modules
.git
.env
*.log` },
          { path: "server.js", lang: "javascript", code: `const http = require("http");

const server = http.createServer((req, res) => res.end(req.url === "/health" ? "ok\\n" : "shop\\n")).listen(3000);

// PID 1 gets no default signal handling: handle SIGTERM, or docker stop waits 10 s and kills
process.on("SIGTERM", () => server.close(() => process.exit(0)));` },
          { path: "package.json", lang: "json", code: `{
  "name": "shop",
  "version": "1.0.0",
  "private": true,
  "scripts": { "start": "node server.js" }
}` },
          { path: "package-lock.json", lang: "json", code: `{
  "name": "shop",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "shop",
      "version": "1.0.0"
    }
  }
}` },
          { path: ".env", lang: "properties", code: `DB_PASSWORD=hunter2` },
        ],
        variants: [{ lang: "bash", code: `docker build -q -t quest-reviewed . > /dev/null
docker run -d --name quest-reviewed quest-reviewed > /dev/null
sleep 1

echo "runs as:        $(docker exec quest-reviewed id -un)"
echo "PID 1:          $(docker exec quest-reviewed cat /proc/1/cmdline | tr '\\0' ' ' | sed 's/ $//')"
echo "files in /app:  $(docker exec quest-reviewed ls -A /app | tr '\\n' ' ' | sed 's/ $//')"
echo "DB_PASSWORD:    $(docker exec quest-reviewed printenv DB_PASSWORD || echo 'not in the image')"

start=$(date +%s)
docker stop quest-reviewed > /dev/null
[ $(( $(date +%s) - start )) -lt 3 ] && speed="right away" || speed="slowly (SIGTERM ignored?)"
echo "docker stop:    stopped $speed, exit code $(docker inspect -f '{{.State.ExitCode}}' quest-reviewed)"` }],
        explain: `- It runs as \`node\`, not root, and \`node server.js\` is PID 1, so it receives SIGTERM directly.
- \`/app\` holds only what the app needs. The \`.env\` file sitting next to the Dockerfile never reached the image (\`.dockerignore\`, and explicit \`COPY\`s), and no password is baked in: it arrives at run time as a mounted file.
- \`docker stop\` finishes immediately with exit code 0, because the app handles SIGTERM. Without the handler, node as PID 1 would ignore it and be killed after 10 seconds with 137.
- With dependencies, \`npm ci --omit=dev\` installs exactly the lockfile's versions, and the layer is reused until \`package*.json\` changes.`,
        output: `runs as:        node
PID 1:          node server.js
files in /app:  package-lock.json package.json server.js
DB_PASSWORD:    not in the image
docker stop:    stopped right away, exit code 0`,
      },
    ],
    interview: [
      {
        q: "Walk me through getting a code change into production with Docker.",
        a: "A commit triggers CI: `docker build` runs the Dockerfile's test stage (unit tests in the real runtime environment), then builds the release stage, using a remote layer cache so unchanged layers are reused. The image is scanned, tagged immutably (git SHA, plus semver for releases), optionally signed with SBOM/provenance, and pushed to a registry, often for amd64 and arm64 via buildx. Deployment updates the image reference, ideally by **digest**: a GitOps commit to Kubernetes manifests (Argo CD/Flux roll it out with readiness probes and rolling updates), or `docker compose pull && up -d` on a server, or a cloud service (ECS, Cloud Run). The same image goes through staging and production with different configuration; rollback = deploying the previous digest.",
        freq: "very-common",
      },
      {
        q: "ARG vs ENV?",
        a: "`ARG` is a **build-time** variable: set with `--build-arg`, available to the instructions after it in that stage, gone at run time (but visible in `docker history`, so never pass secrets as ARGs). `ENV` sets an environment variable in the **image**: available to later build steps and to every container at run time, overridable with `docker run -e`. A common pattern copies one into the other: `ARG VERSION` then `ENV APP_VERSION=$VERSION`. An `ARG` declared before `FROM` is only usable in `FROM` lines unless redeclared inside the stage.",
        freq: "common",
      },
      {
        q: "Docker vs Podman vs containerd vs CRI-O: what's the difference?",
        a: "**Docker Engine** (dockerd) is a full platform: API, builds (BuildKit), networks, volumes, Compose; it uses containerd and runc underneath. **containerd** is the lower-level daemon that manages images, snapshots and container lifecycles; Kubernetes uses it directly via CRI, and `nerdctl` gives it a Docker-like CLI. **CRI-O** is a minimal runtime built only for Kubernetes's CRI. **Podman** is a daemonless, rootless-by-default alternative with a Docker-compatible CLI, pods, and systemd integration; Buildah builds images for it. All of them run the same OCI images with OCI runtimes (runc, crun), so images move freely between them.",
        freq: "common",
      },
      {
        q: "How do containers on different hosts communicate?",
        a: "A bridge network is local to one host. Across hosts you either publish ports and use the hosts' addresses (simple, but you manage ports and discovery), or use an **overlay network**: Docker Swarm's overlay driver uses VXLAN to tunnel container traffic between hosts with built-in DNS. In Kubernetes, a **CNI plugin** (Calico, Cilium, Flannel...) gives every pod a routable IP across nodes (routing, VXLAN or eBPF), and **Services** provide stable virtual IPs and DNS names with load balancing via kube-proxy or eBPF. Service meshes add mTLS and traffic policy on top.",
        freq: "common",
      },
      {
        q: "How do you run database migrations in a containerized deployment?",
        a: "Treat them as a separate, one-off step that runs before the new app version receives traffic: a Compose service with the same image and a `migrate` command that the app `depends_on` with `condition: service_completed_successfully`; a Kubernetes **Job** (or Helm pre-upgrade hook, or an Argo CD sync wave) before the Deployment rolls out; or a CI/CD pipeline step. Avoid running migrations on every app container start: with several replicas they race (use the migration tool's lock if you must). Make migrations **backward compatible** (expand/contract: add columns first, remove them in a later release) so old and new pods can run side by side during a rolling update.",
        freq: "common",
      },
      {
        q: "How do you update a containerized app without downtime?",
        a: "Run the new version **next to** the old one and shift traffic only when it's ready. Orchestrators do this natively: Kubernetes Deployments perform rolling updates gated by **readiness probes** (`maxSurge`/`maxUnavailable`), Swarm services have `update_config`. With plain Docker/Compose on one server, `docker compose up -d` replaces containers (a brief gap), so use a reverse proxy (Traefik, Caddy, nginx) with blue-green: start the new container, wait for it to be healthy, switch the proxy, then stop the old one after it drains. The app must handle SIGTERM gracefully and the database schema must be compatible with both versions.",
        freq: "common",
      },
      {
        q: "Explain each part of `docker run -d --name web --restart unless-stopped -p 8080:80 -v data:/data -e MODE=prod --memory 512m nginx:1.27`.",
        a: "`-d` runs detached (in the background) and prints the container ID; `--name web` gives it a name for other commands and for DNS on user-defined networks; `--restart unless-stopped` restarts it after crashes and daemon/host restarts unless you stopped it; `-p 8080:80` publishes container port 80 on the host's port 8080 (all interfaces); `-v data:/data` mounts the named volume `data` (created if missing) at `/data`; `-e MODE=prod` sets an environment variable; `--memory 512m` caps memory via the cgroup (OOM kill beyond it); `nginx:1.27` is `docker.io/library/nginx:1.27`, pulled if missing, and its default CMD runs.",
        freq: "common",
      },
      {
        q: "What's the difference between `docker save`/`load` and `docker export`/`import`?",
        a: "`docker save` writes an **image** with all its layers, config, history and tags as a tar (OCI layout), and `docker load` restores it exactly: use it to move images without a registry (air-gapped hosts). `docker export` writes a **container's flattened filesystem** (one tar, no layers, no metadata like CMD, ENV or EXPOSE), and `docker import` creates a single-layer image from such a tar. Export/import is for filesystem snapshots or building base images from scratch, not for shipping images.",
        freq: "occasional",
      },
      {
        q: "What is Docker-in-Docker, and why do CI systems avoid it?",
        a: "Running a Docker daemon inside a container (the `docker:dind` image) so jobs can build and run containers. It needs `--privileged`, which gives the job full control of the host; nested overlay filesystems and cgroups cause storage and performance problems; and each job's layer cache starts empty. The other common approach, mounting the host's `docker.sock`, is also root on the host and lets jobs see each other's containers. Safer alternatives: **rootless BuildKit**, kaniko or buildah to build images without a daemon, remote BuildKit builders, Testcontainers against a dedicated Docker host, or ephemeral VMs per job (GitHub-hosted runners).",
        freq: "occasional",
      },
      {
        q: "What happens to running containers when the Docker daemon restarts or is upgraded?",
        a: "By default dockerd stops them on shutdown (SIGTERM, then SIGKILL after the timeout) and, on start, restarts the ones whose restart policy says so (`always`, `unless-stopped`; not `on-failure` or `no`). With **live-restore** enabled in `daemon.json`, containers keep running while the daemon is down, because their parent is the containerd **shim**, not dockerd; the daemon reconnects to them on start. That's the same design that lets Kubernetes nodes restart the kubelet or containerd without killing pods.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "A container shows `Exited (0)` a second after `docker run -d`. Most likely cause?",
        options: ["It ran out of memory", "Its main command finished: nothing long-running was started", "A port conflict", "The image is corrupt"],
        answer: 1,
        explain: "A container lives as long as its PID 1. Exit code 0 means it simply ended.",
      },
      {
        q: "Which is the best fix for slow rebuilds after every code change?",
        options: ["Use a bigger machine", "Copy dependency manifests and install them before copying the source", "Add --no-cache", "Use ADD instead of COPY"],
        answer: 1,
        explain: "Then code changes only invalidate the layers after the install.",
      },
      {
        q: "Your app in a container listens on 127.0.0.1:3000, published with -p 3000:3000. What do you see from the host?",
        options: ["It works", "Connection reset/refused: the app must listen on 0.0.0.0", "A 404", "A DNS error"],
        answer: 1,
        explain: "Published traffic arrives on the container's eth0, not on its loopback.",
      },
      {
        q: "Which value is available only during the build?",
        options: ["ENV", "ARG", "LABEL", "EXPOSE"],
        answer: 1,
        explain: "ARG exists at build time; ENV persists into containers.",
      },
      {
        q: "What does `--restart unless-stopped` do after the host reboots?",
        options: ["Nothing", "Starts the container again, unless you had stopped it by hand", "Recreates it from the image", "Deletes it"],
        answer: 1,
        explain: "always would restart even manually stopped containers when the daemon starts.",
      },
      {
        q: "What does Kubernetes use to run the images you build with Docker?",
        options: ["Docker Engine on every node", "A CRI runtime such as containerd or CRI-O, with runc", "A virtual machine per image", "Docker Compose"],
        answer: 1,
        explain: "The images are standard OCI images; dockershim was removed in 1.24.",
      },
    ],
  },
];
