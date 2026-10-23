"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Slider, Stat } from "../kit";

const DOCS: Record<number, string> = {
  1: "Refund failed with error E-4012 (card expired)",
  2: "How to request a refund for a damaged item",
  3: "Return policy: 30 days, original packaging",
  4: "Error code reference: E-4000 to E-4099 (payments)",
  5: "Shipping delays during the holidays",
  6: "Getting your money back when an order arrives broken",
  7: "Updating the card on your account",
  8: "Gift card balance and expiry dates",
};

interface Query {
  text: string;
  bm25: number[];
  vector: number[];
  relevant: number[];
  rerank: Record<number, number>;
  note: string;
}

const QUERIES: Query[] = [
  {
    text: "refund failed E-4012",
    bm25: [1, 4, 2, 7, 8, 3, 6, 5],
    vector: [2, 6, 1, 3, 7, 4, 5, 8],
    relevant: [1, 4, 7],
    rerank: { 1: 0.97, 4: 0.88, 7: 0.71, 2: 0.35, 6: 0.2, 3: 0.1, 8: 0.15, 5: 0.02 },
    note: "Exact identifiers like E-4012 are where keyword search shines. Embeddings blur them into 'refund-ish' text.",
  },
  {
    text: "my order showed up smashed, can I get my money back?",
    bm25: [6, 5, 8, 2, 3, 1, 7, 4],
    vector: [6, 2, 3, 1, 5, 7, 8, 4],
    relevant: [6, 2, 3],
    rerank: { 6: 0.95, 2: 0.83, 3: 0.62, 1: 0.3, 5: 0.12, 8: 0.05, 7: 0.08, 4: 0.03 },
    note: "Paraphrases ('smashed' vs 'damaged', 'money back' vs 'refund') are where embeddings shine. BM25 matches 'order' to shipping delays.",
  },
  {
    text: "gift card expired",
    bm25: [8, 7, 1, 4, 3, 2, 5, 6],
    vector: [8, 7, 3, 2, 1, 6, 4, 5],
    relevant: [8],
    rerank: { 8: 0.96, 7: 0.4, 1: 0.22, 3: 0.1, 2: 0.05, 4: 0.04, 5: 0.01, 6: 0.02 },
    note: "Easy queries work with anything. Measure on the hard ones.",
  },
];

const recall = (top: number[], rel: number[]) => rel.filter((d) => top.slice(0, 3).includes(d)).length / rel.length;

export default function HybridSearch() {
  const [qi, setQi] = useState("0");
  const [k, setK] = useState(60);
  const [rerank, setRerank] = useState(true);
  const q = QUERIES[Number(qi)];
  const rrf = Object.keys(DOCS)
    .map(Number)
    .map((d) => ({ d, score: 1 / (k + q.bm25.indexOf(d) + 1) + 1 / (k + q.vector.indexOf(d) + 1) }))
    .sort((a, b) => b.score - a.score || a.d - b.d);
  const hybrid = rrf.map((x) => x.d);
  const reranked = [...hybrid].sort((a, b) => q.rerank[b] - q.rerank[a]);

  const cols = [
    { title: "BM25 (keywords)", ids: q.bm25, score: (d: number) => `#${q.bm25.indexOf(d) + 1}`, color: C.compare },
    { title: "Vector (embeddings)", ids: q.vector, score: (d: number) => `#${q.vector.indexOf(d) + 1}`, color: C.pivot },
    { title: `Hybrid: RRF (k=${k})`, ids: hybrid, score: (d: number) => rrf.find((x) => x.d === d)!.score.toFixed(4), color: C.active },
    ...(rerank ? [{ title: "Hybrid + cross-encoder rerank", ids: reranked, score: (d: number) => q.rerank[d].toFixed(2), color: C.done }] : []),
  ];

  return (
    <div className="space-y-4">
      <Segmented value={qi} onChange={setQi} options={QUERIES.map((x, i) => ({ value: String(i), label: `“${x.text.length > 28 ? x.text.slice(0, 26) + "…" : x.text}”` }))} />
      <div className="flex flex-wrap items-end gap-4">
        <Slider label="RRF constant k (higher = flatter: rank 1 vs rank 5 matters less)" value={k} min={1} max={100} onChange={setK} />
        <label className="flex items-center gap-2 pb-1 text-xs text-dim">
          <input type="checkbox" checked={rerank} onChange={(e) => setRerank(e.target.checked)} className="accent-[#059669]" />
          Rerank the fused top 8 with a cross-encoder
        </label>
      </div>
      <div className={clsx("grid gap-2", rerank ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        {cols.map((c) => (
          <div key={c.title} className="rounded-xl border border-line bg-panel p-2.5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold" style={{ color: c.color }}>
              <span>{c.title}</span>
              <span className="font-mono">R@3 {Math.round(recall(c.ids, q.relevant) * 100)}%</span>
            </div>
            <ol className="space-y-1">
              {c.ids.slice(0, 5).map((d, i) => {
                const rel = q.relevant.includes(d);
                return (
                  <li key={d} className={clsx("flex gap-2 rounded-md border px-2 py-1 text-[11px] leading-snug", i < 3 ? "border-line-2" : "border-transparent opacity-60", rel && "bg-emerald/[0.08]")}>
                    <span className="font-mono text-faint">{i + 1}</span>
                    <span className={clsx("flex-1", rel ? "text-ink" : "text-dim")}>
                      {rel && "✓ "}
                      {DOCS[d]}
                    </span>
                    <span className="font-mono text-faint">{c.score(d)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="BM25 recall@3" value={`${Math.round(recall(q.bm25, q.relevant) * 100)}%`} color={C.compare} />
        <Stat label="vector recall@3" value={`${Math.round(recall(q.vector, q.relevant) * 100)}%`} color={C.pivot} />
        <Stat label="hybrid recall@3" value={`${Math.round(recall(hybrid, q.relevant) * 100)}%`} color={C.active} />
        <Stat label="+ rerank recall@3" value={rerank ? `${Math.round(recall(reranked, q.relevant) * 100)}%` : "–"} color={C.done} />
      </div>
      <Narration tone="info">
        {q.note} <b>Reciprocal rank fusion</b> adds 1/(k + rank) from each retriever. It needs no score calibration between BM25 and cosine similarity, and documents that both retrievers like float to the top. A cross-encoder reranker then reads query and document <i>together</i>, which is too slow for millions of docs but ideal for the top 20–100.
      </Narration>
    </div>
  );
}
