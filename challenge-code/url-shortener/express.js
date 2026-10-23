const crypto = require("node:crypto");
const express = require("express");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LEN = 7;
const RATE_LIMIT = 10; // creates per client per window
const WINDOW_MS = 60_000;

function createApp() {
  const app = express();
  app.use(express.json());

  const links = new Map(); // code -> { url, hits }
  const byUrl = new Map(); // url -> code
  const recent = new Map(); // client -> timestamps of recent creates

  function allow(client) {
    const now = Date.now();
    const q = (recent.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.set(client, q);
    if (q.length >= RATE_LIMIT) return false;
    q.push(now);
    return true;
  }

  function validUrl(s) {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function newCode() {
    for (;;) {
      let code = "";
      for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
      if (!links.has(code)) return code;
    }
  }

  app.post("/shorten", (req, res) => {
    if (!allow(req.ip)) {
      res.set("Retry-After", String(WINDOW_MS / 1000));
      return res.status(429).json({ error: "rate limit exceeded" });
    }
    const { url, alias } = req.body ?? {};
    if (typeof url !== "string" || !validUrl(url)) return res.status(400).json({ error: "url must be an absolute http(s) URL" });

    let code;
    let status = 201;
    if (alias !== undefined) {
      if (typeof alias !== "string" || !/^[A-Za-z0-9]{3,32}$/.test(alias)) return res.status(400).json({ error: "alias must be 3-32 letters or digits" });
      if (links.has(alias)) return res.status(409).json({ error: "alias already taken" });
      code = alias;
    } else if (byUrl.has(url)) {
      code = byUrl.get(url);
      status = 200;
    } else {
      code = newCode();
      byUrl.set(url, code);
    }
    if (!links.has(code)) links.set(code, { url, hits: 0 });
    res.status(status).json({ code, shortUrl: `${req.protocol}://${req.get("host")}/${code}`, url });
  });

  app.get("/stats/:code", (req, res) => {
    const link = links.get(req.params.code);
    if (!link) return res.status(404).json({ error: "unknown code" });
    res.json({ code: req.params.code, ...link });
  });

  app.get("/:code", (req, res) => {
    const link = links.get(req.params.code);
    if (!link) return res.status(404).json({ error: "unknown code" });
    link.hits++;
    res.redirect(302, link.url);
  });

  return app;
}

module.exports = { createApp };
