const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { analyzeFile, endpoint } = require("./solution.cjs");

const sample = `10.0.0.1 - - [10/Oct/2026:13:55:36 +0000] "GET /api/users/42 HTTP/1.1" 200 512 0.120
10.0.0.2 - - [10/Oct/2026:13:55:37 +0000] "GET /api/users/7?fields=name HTTP/1.1" 200 128 0.080
10.0.0.1 - - [10/Oct/2026:13:55:38 +0000] "POST /api/orders HTTP/1.1" 201 64 0.300
garbage line
10.0.0.3 - - [10/Oct/2026:13:55:39 +0000] "GET /api/users/9 HTTP/1.1" 500 0 1.500
10.0.0.1 - - [10/Oct/2026:13:55:40 +0000] "GET /health HTTP/1.1" 200 2 0.001
10.0.0.2 - - [10/Oct/2026:13:55:41 +0000] "POST /api/orders HTTP/1.1" 503 0 2.000
10.0.0.1 - - [10/Oct/2026:13:55:42 +0000] "GET /api/users/42 HTTP/1.1" 200 512 0.100
10.0.0.4 - - [10/Oct/2026:13:55:43 +0000] "GET /api/orders/3f2a1b4c-1111-2222-3333-444455556666 HTTP/1.1" 404 0 0.010
`;

(async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "logs-")), "access.log");
  fs.writeFileSync(file, sample);
  const r = await analyzeFile(file, 2);
  assert.deepEqual(r, {
    requests: 8,
    malformed: 1,
    errorRate: 0.25,
    topEndpoints: [
      { endpoint: "GET /api/users/:id", count: 4, p95Ms: 1500 },
      { endpoint: "POST /api/orders", count: 2, p95Ms: 2000 },
    ],
  });
  assert.equal(endpoint("GET", "/a/12/b/3f2a1b4c-1111-2222-3333-444455556666"), "GET /a/:id/b/:id");
  console.log("ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
