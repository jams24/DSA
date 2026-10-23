const fs = require("node:fs");
const readline = require("node:readline");

const LINE = /^(\S+) \S+ \S+ \[[^\]]+\] "([A-Z]+) (\S+) [^"]*" (\d{3}) (?:\d+|-) (\d+(?:\.\d+)?)$/;
const ID = /\/(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27})(?=\/|$)/g;

const endpoint = (method, path) => `${method} ${path.split("?")[0].replace(ID, "/:id")}`;
const percentile = (sorted, p) => sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];

/** Accepts any (async) iterable of lines, e.g. readline over a file stream. */
async function analyze(lines, k = 3) {
  let requests = 0;
  let malformed = 0;
  let errors = 0;
  const stats = new Map(); // endpoint -> latencies in seconds
  for await (const raw of lines) {
    const m = LINE.exec(raw.trim());
    if (!m) {
      malformed++;
      continue;
    }
    const [, , method, path, status, secs] = m;
    const ep = endpoint(method, path);
    if (!stats.has(ep)) stats.set(ep, []);
    stats.get(ep).push(Number(secs));
    requests++;
    if (status[0] === "5") errors++;
  }
  const top = [...stats]
    .sort(([a, x], [b, y]) => y.length - x.length || (a < b ? 1 : -1))
    .slice(0, k)
    .map(([ep, lat]) => ({ endpoint: ep, count: lat.length, p95Ms: Math.round(percentile(lat.sort((a, b) => a - b), 95) * 1000) }));
  return { requests, malformed, errorRate: requests ? Math.round((errors / requests) * 1e4) / 1e4 : 0, topEndpoints: top };
}

const analyzeFile = (file, k) => analyze(readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity }), k);

module.exports = { analyze, analyzeFile, endpoint };
