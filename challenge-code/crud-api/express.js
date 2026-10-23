const express = require("express");

// Hand-rolled validation keeps the example dependency-free; in a real codebase use zod or joi.
function validateBook(body, { partial = false } = {}) {
  const errors = [];
  const rules = {
    title: (v) => typeof v === "string" && v.trim().length >= 1 && v.length <= 200,
    author: (v) => typeof v === "string" && v.trim().length >= 1 && v.length <= 100,
    year: (v) => Number.isInteger(v) && v >= 0 && v <= 2100,
    tags: (v) => Array.isArray(v) && v.length <= 10 && v.every((t) => typeof t === "string"),
  };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return ["body must be a JSON object"];
  for (const [field, ok] of Object.entries(rules)) {
    if (body[field] === undefined) {
      if (!partial && field !== "tags") errors.push(`${field} is required`);
    } else if (!ok(body[field])) errors.push(`${field} is invalid`);
  }
  for (const field of Object.keys(body)) if (!(field in rules)) errors.push(`unknown field ${field}`);
  return errors;
}

const encodeCursor = (id) => Buffer.from(String(id)).toString("base64url");
const decodeCursor = (s) => {
  const n = Number(Buffer.from(s, "base64url").toString());
  return Number.isInteger(n) && n >= 0 ? n : null;
};

function createApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  const books = new Map();
  let nextId = 1;

  const find = (req, res) => {
    const book = books.get(Number(req.params.id));
    if (!book) res.status(404).json({ error: `book ${req.params.id} not found` });
    return book;
  };

  app.post("/books", (req, res) => {
    const errors = validateBook(req.body);
    if (errors.length) return res.status(422).json({ errors });
    const book = { id: nextId++, tags: [], ...req.body, createdAt: new Date().toISOString() };
    books.set(book.id, book);
    res.status(201).location(`/books/${book.id}`).json(book);
  });

  app.get("/books", (req, res) => {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(422).json({ errors: ["limit must be 1-100"] });
    const after = req.query.cursor ? decodeCursor(String(req.query.cursor)) : 0;
    if (after === null) return res.status(400).json({ error: "invalid cursor" });
    const author = req.query.author?.toString().toLowerCase();

    // Map iterates in insertion order, and ids only grow, so this is already sorted by id.
    const rows = [...books.values()].filter((b) => b.id > after && (!author || b.author.toLowerCase() === author));
    const data = rows.slice(0, limit);
    res.json({ data, nextCursor: rows.length > limit ? encodeCursor(data[data.length - 1].id) : null });
  });

  app.get("/books/:id", (req, res) => {
    const book = find(req, res);
    if (book) res.json(book);
  });

  app.patch("/books/:id", (req, res) => {
    const book = find(req, res);
    if (!book) return;
    const errors = validateBook(req.body, { partial: true });
    if (errors.length) return res.status(422).json({ errors });
    Object.assign(book, req.body);
    res.json(book);
  });

  app.delete("/books/:id", (req, res) => {
    if (!find(req, res)) return;
    books.delete(Number(req.params.id));
    res.status(204).end();
  });

  // Malformed JSON lands here instead of Express's default HTML error page.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "malformed JSON" });
    next(err);
  });

  return app;
}

module.exports = { createApp };
