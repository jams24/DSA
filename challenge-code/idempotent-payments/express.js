const crypto = require("node:crypto");
const express = require("express");

const KEY_TTL_MS = 24 * 60 * 60 * 1000; // keep idempotency records for a day

/** `charge` is the side effect we must never run twice (e.g. a call to the card processor). */
function createApp({ charge }) {
  const app = express();
  app.use(express.json());
  // key -> { fingerprint, state: "in_progress" | "done", status, body, expires }
  // In production this is a database table with a unique index on (merchant_id, key).
  const records = new Map();

  app.post("/payments", async (req, res) => {
    const key = req.get("Idempotency-Key");
    if (!key || key.length > 255) return res.status(400).json({ error: "Idempotency-Key header is required" });
    const { amount, currency } = req.body ?? {};
    if (!Number.isInteger(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency ?? ""))
      return res.status(422).json({ error: "amount must be a positive integer (minor units) and currency an ISO code" });

    const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ amount, currency })).digest("hex");
    const now = Date.now();
    const existing = records.get(key);
    if (existing && existing.expires > now) {
      if (existing.fingerprint !== fingerprint)
        return res.status(422).json({ error: "Idempotency-Key was already used with a different request body" });
      if (existing.state === "in_progress") return res.status(409).json({ error: "a request with this key is still in progress" });
      return res.status(existing.status).set("Idempotent-Replayed", "true").json(existing.body);
    }

    // Claim the key *before* doing the side effect. Node runs this synchronously, so no other
    // request can slip in between the check above and this write. (With a DB: INSERT ... ON CONFLICT DO NOTHING.)
    records.set(key, { fingerprint, state: "in_progress", expires: now + KEY_TTL_MS });
    try {
      const result = await charge({ amount, currency });
      const body = { id: `pay_${crypto.randomUUID()}`, amount, currency, status: "succeeded", processorRef: result.ref };
      records.set(key, { fingerprint, state: "done", status: 201, body, expires: now + KEY_TTL_MS });
      res.status(201).json(body);
    } catch (err) {
      // A failure that definitely did not charge: release the key so the client can retry.
      // (If the outcome is unknown, e.g. a timeout, keep the key and reconcile with the processor instead.)
      records.delete(key);
      res.status(502).json({ error: "payment processor unavailable" });
    }
  });

  return app;
}

module.exports = { createApp };
