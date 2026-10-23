const crypto = require("node:crypto");
const { promisify } = require("node:util");
const express = require("express");
const jwt = require("jsonwebtoken");

const scrypt = promisify(crypto.scrypt);
const TOKEN_TTL_S = 15 * 60;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected); // constant time: no timing side channel
}

// A real hash of a random password, so unknown emails cost the same time as wrong passwords.
const DUMMY_HASH = hashPassword(crypto.randomUUID());

/** secret comes from configuration (process.env.JWT_SECRET), never from source code */
function createApp({ secret }) {
  if (!secret || secret.length < 32) throw new Error("JWT secret must be at least 32 characters");
  const app = express();
  app.use(express.json());
  const users = new Map(); // email -> { id, email, passwordHash }

  function requireAuth(req, res, next) {
    const [scheme, token] = (req.get("authorization") ?? "").split(" ");
    if (scheme !== "Bearer" || !token) return res.status(401).set("WWW-Authenticate", "Bearer").json({ error: "missing bearer token" });
    try {
      // Pin the algorithm so a token signed with "none" or another algorithm is rejected.
      const claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
      req.user = [...users.values()].find((u) => u.id === claims.sub);
      if (!req.user) throw new Error("user no longer exists");
      next();
    } catch {
      res.status(401).set("WWW-Authenticate", 'Bearer error="invalid_token"').json({ error: "invalid or expired token" });
    }
  }

  app.post("/register", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({ error: "invalid email" });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(422).json({ error: "password must be 8-128 characters" });
    const key = email.toLowerCase();
    if (users.has(key)) return res.status(409).json({ error: "email already registered" });
    const user = { id: crypto.randomUUID(), email: key, passwordHash: await hashPassword(password) };
    users.set(key, user);
    res.status(201).json({ id: user.id, email: user.email });
  });

  app.post("/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") return res.status(422).json({ error: "email and password are required" });
    const user = users.get(email.toLowerCase());
    const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
    // Same message either way, so the endpoint can't be used to discover which emails exist.
    if (!user || !ok) return res.status(401).json({ error: "invalid email or password" });
    const accessToken = jwt.sign({ sub: user.id }, secret, { algorithm: "HS256", expiresIn: TOKEN_TTL_S });
    res.json({ accessToken, tokenType: "Bearer", expiresIn: TOKEN_TTL_S });
  });

  app.get("/me", requireAuth, (req, res) => res.json({ id: req.user.id, email: req.user.email }));

  return app;
}

module.exports = { createApp };
