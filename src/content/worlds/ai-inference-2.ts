import type { Lesson } from "../types";

export const aiInferencePart2: Lesson[] = [
  // ------------------------------------------------------------------ PARALLELISM
  {
    id: "model-parallelism",
    title: "Model Parallelism: Data, Tensor, Pipeline, Expert",
    tagline: "When one GPU isn't enough — four ways to split the work.",
    difficulty: "advanced",
    minutes: 15,
    visualizers: ["parallelism"],
    concept: `
## Why split
A 70B model needs ~140 GB in FP16 — more than any single 80 GB GPU — and frontier models are far larger. Even when a model fits, you may split it to cut latency or raise throughput.

## The four axes (toggle them in the visualizer)
**Data parallelism (DP)** — replicate the whole model; each replica handles different requests (inference) or a different shard of the batch (training, then all-reduce the gradients). Scales throughput linearly; requires the model to fit per replica. **ZeRO / FSDP** shard optimizer state, gradients and even weights across data-parallel ranks during training.

**Tensor parallelism (TP)** — split each layer's weight matrices across GPUs (Megatron-LM: column-parallel then row-parallel matmuls) so each GPU computes a slice of every layer; an **all-reduce** after attention and MLP blocks combines results. Reduces per-GPU memory **and per-token latency**, but communicates every layer → needs NVLink/NVSwitch; typically TP ≤ 8 within one server.

**Pipeline parallelism (PP)** — assign consecutive layers to different GPUs ("stages"); activations flow between neighbours. Light communication, works across nodes, but stages sit idle while the pipeline fills and drains — the **bubble** = (p − 1)/(m + p − 1) for p stages and m micro-batches. More micro-batches and schedules like 1F1B / interleaving shrink it.

**Expert parallelism (EP)** — in **Mixture-of-Experts** models, each MoE layer has many expert MLPs and a router sends each token to its top-k (e.g. 2 of 8, or 8 of 256). Experts are spread across GPUs, tokens are exchanged with **all-to-all** communication. Huge total parameters, small active compute per token (Mixtral 8×7B: ~47B total, ~13B active). Load balancing across experts is a key challenge.

Also: **sequence/context parallelism** splits long sequences across GPUs (ring attention) for million-token contexts.

## Combining them (3D/4D parallelism)
Large training runs use TP within a node, PP across nodes, DP (or FSDP) across groups of nodes, plus EP for MoE. Inference for a 70B model commonly uses **TP = 4 or 8** on one 8-GPU server with many DP replicas behind a load balancer.

## Communication is the tax
Interconnect bandwidth decides what's practical: NVLink/NVSwitch (hundreds of GB/s to TB/s per GPU) inside a server vs InfiniBand/RoCE (tens of GB/s per GPU) between servers. Overlap communication with computation wherever possible.
`,
    keyPoints: [
      "DP: full replicas, scale throughput.",
      "TP: split matrices, all-reduce per layer, needs NVLink, lowers latency.",
      "PP: split layers into stages, cheap comms, pipeline bubble.",
      "EP: MoE experts across GPUs with all-to-all routing.",
      "Real systems combine them; interconnect bandwidth decides the layout.",
    ],
    interview: [
      {
        q: "How would you serve a 70B model on 80 GB GPUs?",
        a: "FP16 weights are ~140 GB plus KV cache, so at least 2 GPUs; in practice **tensor parallelism across 4 or 8 GPUs** in one NVLink-connected server — it splits weights and KV memory, leaves room for large batches and lowers per-token latency. Alternatively quantize to FP8 (~70 GB) or INT4 (~35 GB) to fit fewer GPUs. Scale throughput by running multiple such replicas (data parallel) behind a router. Avoid pipeline parallelism across nodes for latency-sensitive serving unless the model doesn't fit otherwise.",
        freq: "very-common",
      },
      {
        q: "Tensor vs pipeline parallelism?",
        a: "Tensor parallelism splits each layer across GPUs; every GPU works on every token, so latency drops, but it needs an all-reduce in every layer → high-bandwidth interconnect, usually within a node. Pipeline parallelism splits the layer stack into stages; communication is only activations between neighbouring stages (works across nodes), but a single request flows through stages sequentially and stages idle during pipeline fill/drain (bubble), so it helps capacity more than latency. Large deployments use TP inside nodes and PP across them.",
        freq: "common",
      },
      {
        q: "What makes Mixture-of-Experts models efficient, and what's hard about serving them?",
        a: "Each token activates only a few experts (top-k routing), so FLOPs per token correspond to a much smaller dense model while total parameters (capacity) are large. Serving challenges: all experts must still be in memory (memory per token-of-compute is high), routing creates **all-to-all** communication across GPUs, expert load can be imbalanced (hot experts become stragglers), and small batches activate many experts at once, reducing the efficiency advantage. Expert parallelism plus large batches mitigate this.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Which parallelism requires an all-reduce within every transformer layer?",
        options: ["Data", "Tensor", "Pipeline", "None"],
        answer: 1,
        explain: "Each GPU holds a slice of every weight matrix.",
      },
      {
        q: "Pipeline bubble with 4 stages and 4 micro-batches ≈",
        options: ["0%", "25%", "43%", "75%"],
        answer: 2,
        explain: "(4 − 1) / (4 + 4 − 1) = 3/7 ≈ 43%.",
      },
      {
        q: "Data parallelism alone works only if…",
        options: ["The model fits on one GPU", "You use MoE", "The interconnect is NVLink", "Batch size is 1"],
        answer: 0,
        explain: "Each replica holds the full model.",
      },
      {
        q: "In an MoE layer, each token is processed by…",
        options: ["All experts", "Its top-k experts chosen by a router", "A random expert", "The first expert"],
        answer: 1,
        explain: "Sparse activation keeps compute per token low.",
      },
    ],
  },

  // ------------------------------------------------------------------ SERVING METRICS
  {
    id: "serving-metrics",
    title: "Serving Metrics, the Roofline & Capacity Planning",
    tagline: "TTFT, TPOT, goodput — and the math behind GPU sizing.",
    difficulty: "advanced",
    minutes: 15,
    visualizers: ["roofline", "vram"],
    concept: `
## The metrics that matter
| Metric | Meaning | Driven by |
|---|---|---|
| **TTFT** | time to first token | queueing + prefill (prompt length) |
| **TPOT / ITL** | time per output token | decode step time, batch size, KV length |
| **E2E latency** | TTFT + TPOT × (n − 1) | output length dominates |
| **Throughput** | output tokens/s per GPU (or per $) | batch size, quantization, kernels |
| **Goodput** | requests/s that meet SLOs | the metric to optimize |
| **p50 / p99** | distribution, not averages | tail latency is what users feel |

Typical chat SLOs: TTFT p99 < 1–2 s, TPOT < 50–100 ms (faster than reading speed ≈ 5–10 tokens/s is "fast enough" for humans; agents and code tools want much faster).

## The roofline model (move the sliders)
Achievable FLOP/s = **min(peak compute, memory bandwidth × arithmetic intensity)**, where arithmetic intensity (AI) = FLOPs per byte moved from memory.
- H100 SXM: ~989 TFLOP/s dense BF16 and 3.35 TB/s → ridge point ≈ 295 FLOP/byte.
- A forward pass reads each weight once and does ~2 FLOPs per weight per token; with 2-byte weights AI ≈ **tokens processed per pass**.
- **Decode** at batch 1: AI ≈ 1 → ~0.3% of peak compute. Batch 64 → AI ≈ 64 → still memory-bound but 64× the useful work.
- **Prefill** of a 2,000-token prompt: AI ≈ 2,000 → compute-bound.

## Capacity planning recipe
1. **Memory per replica** = weights + KV cache for target concurrency × context + overhead (calculator).
2. **Decode ceiling**: steps/s ≈ bandwidth ÷ (weights + KV bytes per step); tokens/s ≈ steps/s × batch.
3. **Requests/s per replica** ≈ tokens/s ÷ average output tokens (plus prefill cost for long prompts).
4. **Replicas** = peak requests/s ÷ per-replica capacity at the batch size that meets SLOs, + headroom (N+1, per zone).
5. Validate with load tests (realistic prompt/output length distributions!) — synthetic uniform lengths lie.

**Little's law** helps sanity-check: concurrency = arrival rate × time in system. 20 req/s × 10 s average generation = 200 concurrent sequences to hold in KV memory.

## Autoscaling signals
GPU utilization is misleading for LLMs (memory-bound work looks "busy"). Scale on **queue depth / waiting requests**, **KV-cache utilization**, and **TTFT p95**. GPU nodes are slow to start (minutes to load weights) → keep warm capacity, pre-pull images, load weights from fast local storage or peer-to-peer.
`,
    keyPoints: [
      "TTFT (prefill + queue), TPOT (decode), E2E = TTFT + TPOT·(n−1).",
      "Optimize goodput: throughput within latency SLOs; watch p99.",
      "Roofline: decode AI ≈ batch size → memory-bound; prefill compute-bound.",
      "Plan capacity from memory, bandwidth, output lengths and Little's law.",
      "Autoscale on queue depth, KV usage and TTFT — not GPU utilization.",
    ],
    interview: [
      {
        q: "How would you capacity-plan GPUs for an LLM chat product with 50 requests/s at peak?",
        a: "Gather distributions: prompt tokens (say 1,500 avg with RAG), output tokens (300 avg), SLOs (TTFT p95 < 1.5 s, TPOT < 60 ms). Pick a model/precision and measure a replica's sustained throughput at the batch size that meets SLOs — e.g. Llama-3-70B FP8 on 4×H100 sustaining ~2,500 output tok/s → ~8 req/s. 50 req/s ÷ 8 ≈ 7 replicas, +30–50% headroom and AZ redundancy → ~10 replicas (40 GPUs). Check KV memory: concurrency ≈ 50 req/s × ~6 s ≈ 300 sequences × ~2K tokens × 160 KB (FP8 GQA) ≈ 96 GB across replicas — fine. Then load-test and add prefix caching to cut prefill.",
        freq: "common",
      },
      {
        q: "Why is GPU utilization a poor autoscaling metric for LLM serving?",
        a: "nvidia-smi 'utilization' only says a kernel was running, not how efficiently — memory-bound decode keeps the GPU 'busy' at a tiny fraction of its FLOPs. A replica can show 100% utilization while having lots of headroom (small batch) or be completely saturated. Better signals: number of waiting requests, KV-cache occupancy, TTFT/TPOT percentiles versus SLO, and tokens/s versus measured max.",
        freq: "common",
      },
      {
        q: "Explain the roofline model in the context of LLM inference.",
        a: "Performance is capped by either compute (peak FLOP/s) or memory bandwidth × arithmetic intensity, whichever is lower. LLM forward passes read every weight once, so intensity ≈ tokens processed per pass (for 16-bit weights). Prefill processes many tokens → high intensity → compute-bound. Decode processes one token per sequence → intensity ≈ batch size → far below the ridge point (~300 FLOP/byte on H100) → memory-bound. Hence the levers: batch more, quantize (fewer bytes), use speculative decoding, and keep KV reads small (GQA).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which metric best captures 'useful' serving capacity?",
        options: ["GPU utilization", "Goodput (throughput meeting SLOs)", "Average latency", "Model size"],
        answer: 1,
        explain: "Throughput that violates SLOs isn't useful.",
      },
      {
        q: "On an H100, decode at batch size 8 is…",
        options: ["Compute-bound", "Memory-bound", "Network-bound", "Disk-bound"],
        answer: 1,
        explain: "AI ≈ 8 FLOP/byte, far below the ~295 ridge point.",
      },
      {
        q: "Little's law: 30 req/s, each in the system 4 s on average. Concurrency?",
        options: ["7.5", "34", "120", "4"],
        answer: 2,
        explain: "L = λW = 30 × 4.",
      },
      {
        q: "Which change most directly improves TTFT for long prompts shared across users?",
        options: ["Higher temperature", "Prefix caching", "Larger vocabulary", "Beam search"],
        answer: 1,
        explain: "Skip recomputing the shared prefix's prefill.",
      },
    ],
  },

  // ------------------------------------------------------------------ ATTENTION OPTIMIZATIONS
  {
    id: "attention-optimizations",
    title: "FlashAttention, GQA & Long Context",
    tagline: "Making attention fast and memory-light, and stretching context windows.",
    difficulty: "advanced",
    minutes: 13,
    visualizers: ["attention", "vram"],
    concept: `
## FlashAttention: IO-aware exact attention
Naive attention materializes the n × n score matrix in GPU HBM (slow, large), then reads it back for softmax and the value multiply — memory traffic dominates. **FlashAttention** (Dao et al.) tiles Q, K and V into blocks that fit in on-chip **SRAM**, computes attention block by block using an **online softmax** (running max and normalizer), and never writes the full score matrix to HBM.
- **Exact** (not an approximation), O(n) extra memory instead of O(n²).
- 2–4× faster attention, enables long contexts in training and prefill.
- FlashAttention-2/3 improve parallelism and use Hopper features (async, FP8). **FlashDecoding** splits the KV sequence across thread blocks to speed long-context decode.

Lesson: on modern GPUs, **memory movement**, not arithmetic, is often the bottleneck — kernel fusion (fusing layer norm, activation, residual, rotary embedding) cuts HBM round trips for the same reason.

## Shrinking K/V: MHA → GQA → MQA → MLA
- **Multi-head**: one K/V per query head.
- **Grouped-query**: groups of query heads share a K/V head (Llama-3: 8 KV heads) → KV cache and decode bandwidth shrink 4–8×.
- **Multi-query**: a single K/V head — maximal savings, some quality loss.
- **Multi-head latent attention** (DeepSeek): store a compressed latent and reconstruct K/V.

## Long context
- **RoPE scaling** (position interpolation, NTK-aware, YaRN) extends context beyond training length with light fine-tuning.
- **Sliding-window attention** (Mistral): each layer attends to the last W tokens; stacking layers still propagates information further. Bounded KV cache.
- **Attention sinks** (StreamingLLM): keep the first few tokens + a recent window for infinite streaming.
- **Sparse / ring attention**, and alternative architectures (state-space models like Mamba, hybrid models) attack the O(n²) cost.
- Reality check: long context ≠ good long-context use. Evaluate "needle in a haystack" and multi-hop retrieval; often **RAG + shorter context** is cheaper and better.

## Cost intuition
Prefill attention grows O(n²); a 128K-token prompt is enormously more expensive than 8K. KV cache grows O(n) per sequence — long contexts collapse batch sizes. Prefix caching and summarizing old conversation turns are practical mitigations.
`,
    keyPoints: [
      "FlashAttention: tiled, online softmax in SRAM — exact, O(n) memory, much faster.",
      "Memory movement often dominates; fuse kernels to avoid HBM round trips.",
      "GQA/MQA/MLA shrink the KV cache and decode bandwidth.",
      "RoPE scaling, sliding windows and attention sinks extend context.",
      "Long prompts: O(n²) prefill, O(n) KV per sequence — RAG is often cheaper.",
    ],
    interview: [
      {
        q: "What does FlashAttention do differently from standard attention?",
        a: "Standard attention computes the full n×n score matrix, writes it to GPU HBM, reads it back for softmax, writes the probabilities, and reads them again for the V multiplication — dominated by memory traffic and O(n²) memory. FlashAttention tiles Q, K, V into SRAM-sized blocks, computes partial attention per block and combines them with a numerically stable online softmax (tracking running max and sum), fusing everything into one kernel. The result is exact attention with O(n) memory and far fewer HBM accesses — typically several times faster, especially for long sequences.",
        freq: "common",
      },
      {
        q: "MHA vs MQA vs GQA?",
        a: "Multi-head attention keeps separate K/V projections per head — best quality, largest KV cache. Multi-query attention shares one K/V head across all query heads — smallest cache and fastest decode but measurable quality loss. Grouped-query attention is the middle ground: G groups of query heads share K/V (e.g. 64 query heads, 8 KV heads) — near-MHA quality with most of the memory savings. It's the default in modern open models.",
        freq: "common",
      },
      {
        q: "A customer wants 1M-token context. What are the costs and alternatives?",
        a: "Prefill attention is O(n²) — minutes of GPU time and very high TTFT; KV cache for a single sequence can exceed a GPU's memory (needs sequence/context parallelism, KV offloading or compression); throughput collapses because few sequences fit. Quality on long-range reasoning may also degrade. Alternatives: RAG to select relevant chunks, hierarchical summarization, prefix caching for reused documents, and evaluating whether the use case truly needs whole-document attention.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "FlashAttention is…",
        options: ["An approximation of attention", "Exact attention computed with an IO-aware tiled kernel", "A quantization method", "A new model architecture"],
        answer: 1,
        explain: "Same result, much less memory traffic.",
      },
      {
        q: "The 'online softmax' lets FlashAttention…",
        options: ["Skip the softmax", "Combine softmax results across blocks without the full score matrix", "Use integers", "Avoid the causal mask"],
        answer: 1,
        explain: "Running max and normalizer make block-wise softmax exact.",
      },
      {
        q: "Llama-3-70B has 64 query heads and 8 KV heads. Versus MHA, its KV cache is…",
        options: ["The same", "2× smaller", "8× smaller", "64× smaller"],
        answer: 2,
        explain: "64 / 8 = 8.",
      },
      {
        q: "Sliding-window attention bounds…",
        options: ["Vocabulary size", "The KV cache per layer to the window size", "Model parameters", "Batch size"],
        answer: 1,
        explain: "Only the last W tokens are attended to (and kept).",
      },
    ],
  },

  // ------------------------------------------------------------------ RAG
  {
    id: "rag-vector-search",
    title: "RAG & Vector Search",
    tagline: "Ground LLM answers in your data with embeddings and approximate nearest neighbours.",
    difficulty: "intermediate",
    minutes: 17,
    visualizers: ["vectorsearch"],
    concept: `
## Why RAG
LLMs don't know your private or recent data and they hallucinate. **Retrieval-Augmented Generation** fetches relevant passages at query time and puts them in the prompt, so answers are **grounded**, citeable and fresh — without retraining.

## The pipeline
**Indexing (offline)**
1. **Load & clean** documents (PDFs, wikis, tickets, code).
2. **Chunk** them (e.g. 300–800 tokens with overlap; split on headings/semantic boundaries; keep titles and metadata).
3. **Embed** each chunk with an embedding model → a vector (e.g. 768–3,072 dims).
4. **Index** vectors in a vector database with metadata (source, ACLs, timestamps).

**Query (online)**
1. Embed the user question (optionally rewrite it / generate sub-queries).
2. **Retrieve** top-k candidates by vector similarity (cosine / dot product), often **hybrid** with keyword search (BM25) for exact terms, IDs and names.
3. **Rerank** candidates with a cross-encoder for precision.
4. **Generate**: prompt the LLM with the top passages + instructions to cite sources and say "I don't know" when unsupported.

## Approximate nearest neighbour search (try the map)
Exact k-NN over 100M vectors is too slow, so vector DBs use **ANN** indexes:
- **HNSW**: a multi-layer proximity graph; search greedily descends from sparse top layers to the dense bottom layer. High recall, fast, memory-hungry (vectors + graph in RAM).
- **IVF**: cluster vectors (k-means); search only the closest clusters (nprobe).
- **PQ (product quantization)**: compress vectors into short codes for memory savings (IVF-PQ in FAISS), trading accuracy.
- **DiskANN / ScaNN** for very large or SSD-resident indexes.
Tune for **recall@k vs latency**: HNSW's \`efSearch\`, IVF's \`nprobe\`.

Stores: pgvector (Postgres), FAISS (library), Pinecone, Weaviate, Milvus, Qdrant, Elasticsearch/OpenSearch, Vespa.

## What breaks in production
- **Bad chunking** (answers split across chunks, tables mangled) — the #1 quality issue.
- **Retrieval misses** on exact identifiers → add BM25 / hybrid.
- **Stale index** → incremental updates, CDC pipelines, TTLs.
- **Permissions**: filter by the user's ACLs at query time (metadata filtering) — never leak documents across tenants.
- **Prompt injection** inside retrieved documents → treat retrieved text as data, constrain tools.
- **Evaluation**: measure retrieval (recall@k, MRR) and generation (faithfulness/groundedness, answer relevance) on a labelled set; LLM-as-judge plus human review.

## RAG vs fine-tuning vs long context
RAG for **knowledge** that changes or must be cited; fine-tuning for **behaviour/format/style** and domain language; long context for small corpora or one-off documents. They combine well.
`,
    keyPoints: [
      "RAG = retrieve relevant chunks, then generate grounded, cited answers.",
      "Chunking quality and hybrid (BM25 + vector) retrieval drive accuracy.",
      "ANN indexes (HNSW, IVF, PQ) trade a little recall for huge speedups.",
      "Rerank with a cross-encoder; filter by ACLs at query time.",
      "Evaluate retrieval (recall@k) and faithfulness separately.",
    ],
    interview: [
      {
        q: "Design a RAG system for answering questions over company documentation.",
        a: "Ingestion: connectors pull docs (Confluence, Drive, GitHub) incrementally; parse and clean; chunk by structure (headings) at ~500 tokens with overlap; attach metadata (source URL, ACL groups, updated_at); embed and upsert into a vector index plus a BM25 index. Query: authenticate the user; rewrite the query; hybrid retrieve top-50 with ACL filters; rerank to top-5 with a cross-encoder; prompt the LLM with passages, require citations and allow 'not found'. Ops: cache frequent queries/embeddings, monitor retrieval hit rate, collect thumbs-up/down, run an offline eval set (recall@k, faithfulness) on every change, and guard against prompt injection in documents.",
        freq: "very-common",
      },
      {
        q: "How does HNSW work?",
        a: "HNSW (Hierarchical Navigable Small World) builds a multi-layer graph: every vector is in the bottom layer, a random geometrically decreasing subset is in higher layers, and each node links to its nearest neighbours in each layer it belongs to. A search starts at an entry point in the top layer, greedily moves to neighbours closer to the query, drops a layer when no improvement is possible, and at the bottom layer does a best-first search with a candidate list of size efSearch. Upper layers provide long jumps, lower layers fine-grained navigation: ~logarithmic search with high recall.",
        freq: "common",
      },
      {
        q: "Why use hybrid search instead of vectors alone?",
        a: "Dense embeddings capture meaning and paraphrases but are weak at exact matches: product codes, error IDs, names, rare terms. Keyword search (BM25) nails exact tokens but misses synonyms. Hybrid retrieval runs both and fuses scores (e.g. reciprocal rank fusion), consistently improving recall; a reranker then orders the merged candidates precisely.",
        freq: "common",
      },
      {
        q: "How do you evaluate a RAG system?",
        a: "Separate the stages. **Retrieval**: with a labelled set of question → relevant chunks, measure recall@k, MRR/nDCG; check chunking and embeddings changes against it. **Generation**: faithfulness/groundedness (is every claim supported by the retrieved context?), answer relevance and correctness — via LLM-as-judge calibrated against human labels. **End to end**: task success, citations accuracy, latency and cost; online thumbs feedback and A/B tests. Track regressions per release.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "The most common root cause of poor RAG answers is…",
        options: ["Model too small", "Poor chunking / retrieval", "Too many GPUs", "High temperature only"],
        answer: 1,
        explain: "If the right passage isn't retrieved, the model can't use it.",
      },
      {
        q: "HNSW is a…",
        options: ["Hash table", "Multi-layer proximity graph for ANN search", "Tree of SSTables", "Tokenizer"],
        answer: 1,
        explain: "Greedy graph navigation from coarse to fine layers.",
      },
      {
        q: "To find an exact error code like 'ERR_4512', the best addition to vector search is…",
        options: ["Higher temperature", "Keyword (BM25) hybrid retrieval", "Bigger embeddings", "Quantization"],
        answer: 1,
        explain: "Exact tokens are what lexical search excels at.",
      },
      {
        q: "Per-user document permissions should be enforced…",
        options: ["In the prompt by asking the LLM", "By filtering retrieval on ACL metadata", "After generation", "Not needed"],
        answer: 1,
        explain: "Never let unauthorized chunks reach the model.",
      },
      {
        q: "Recall@k measures…",
        options: ["Answer fluency", "The fraction of relevant items found in the top k retrieved", "Latency", "Token cost"],
        answer: 1,
        explain: "A retrieval-quality metric.",
      },
    ],
  },

  // ------------------------------------------------------------------ ML SYSTEM DESIGN
  {
    id: "ml-system-design",
    title: "ML System Design: Recommendations & Ranking",
    tagline: "Candidate generation, ranking, feature stores and online evaluation.",
    difficulty: "advanced",
    minutes: 18,
    caseStudy: true,
    diagram: {
      title: "Two-stage recommendation system",
      nodes: [
        { id: "user", label: "User", kind: "client", x: 80, y: 280 },
        { id: "api", label: "Recs API", kind: "service", x: 270, y: 280 },
        { id: "cand", label: "Candidate gen", sub: "ANN + heuristics", kind: "search", x: 480, y: 130 },
        { id: "rank", label: "Ranker", sub: "GBDT / deep model", kind: "model", x: 480, y: 330 },
        { id: "fs", label: "Feature store", sub: "online (Redis)", kind: "cache", x: 720, y: 330 },
        { id: "rerank", label: "Re-rank / policy", sub: "diversity, rules", kind: "service", x: 270, y: 470 },
        { id: "log", label: "Event log", sub: "Kafka", kind: "queue", x: 720, y: 500 },
        { id: "train", label: "Training pipeline", sub: "offline features", kind: "worker", x: 900, y: 420 },
        { id: "emb", label: "Embedding index", kind: "storage", x: 720, y: 110 },
      ],
      edges: [
        { from: "user", to: "api" },
        { from: "api", to: "cand" },
        { from: "cand", to: "emb" },
        { from: "api", to: "rank" },
        { from: "rank", to: "fs" },
        { from: "rank", to: "rerank" },
        { from: "rerank", to: "user" },
        { from: "user", to: "log", label: "clicks", dashed: true },
        { from: "log", to: "train" },
        { from: "train", to: "fs", dashed: true },
        { from: "train", to: "emb", dashed: true },
      ],
      flows: [
        {
          name: "Serve recommendations",
          path: ["user", "api", "cand", "emb", "cand", "api", "rank", "fs", "rank", "rerank", "user"],
          steps: [
            "User opens the home feed: GET /recs?user=42.",
            "Stage 1 — candidate generation: narrow millions of items to ~1,000 cheaply.",
            "Two-tower model: nearest neighbours of the user embedding in the item embedding index (ANN), plus trending, follows, recently viewed.",
            "~1,000 candidates returned in a few ms.",
            "Hand them to the heavier ranker.",
            "Stage 2 — ranking: fetch features for (user, item) pairs.",
            "Online feature store returns precomputed features (user history stats, item CTR, freshness) with low latency.",
            "Model scores each candidate's probability of click / watch time / purchase (multi-task).",
            "Stage 3 — re-ranking: diversity, dedupe, business rules, ads blending, fairness, exploration.",
            "Top 20 rendered — every impression and click is logged.",
          ],
        },
        {
          name: "Learn from feedback",
          path: ["user", "log", "train", "fs"],
          steps: [
            "Impressions, clicks, dwell time and purchases stream into the event log.",
            "Training jobs join events with point-in-time-correct features (no future leakage), retrain models daily/hourly.",
            "Offline features materialize into the online store, and new models roll out behind A/B tests.",
          ],
        },
      ],
    },
    concept: `
## The ML system design framework
1. **Clarify the business goal** and translate it into an ML objective: "increase watch time" → predict P(watch > 30 s) or expected watch time. Choose online metrics (CTR, retention, revenue) and guardrails (latency, diversity, complaints).
2. **Data**: what labels exist (clicks, purchases, explicit ratings), how they're logged, biases (position bias, popularity bias, feedback loops).
3. **Features**: user (history, demographics), item (content, popularity), context (time, device), cross features; embeddings.
4. **Model**: start with a simple baseline (popularity, logistic regression, GBDT), then deep models (two-tower, DLRM, transformers over user history).
5. **Serving architecture**: latency budget, candidate generation → ranking → re-ranking.
6. **Evaluation**: offline (AUC, NDCG@k, recall@k, calibration) → online **A/B tests** (the source of truth).
7. **Monitoring & iteration**: data drift, training–serving skew, model freshness, retraining cadence.

## Why multi-stage
You can't run a heavy model over millions of items in 100 ms. **Candidate generation** (cheap, high recall: ANN over two-tower embeddings, collaborative filtering, rules) narrows to hundreds or thousands; **ranking** (expensive, high precision: deep model with many features) orders them; **re-ranking** applies business logic and diversity.

## Feature store
Consistent feature definitions for training (offline, historical, point-in-time correct joins) and serving (online, low-latency key-value). Prevents **training–serving skew** — the #1 silent ML bug — and enables feature reuse (Feast, Tecton, in-house).

## Pitfalls to mention
- **Data leakage** (features using information from after the label time).
- **Feedback loops**: the model only learns from what it showed → add exploration (epsilon-greedy, bandits).
- **Position bias**: items shown higher get clicked more regardless of relevance → log position, debias.
- **Cold start**: new users (popular/onboarding), new items (content features, exploration boosts).
- **Offline–online gap**: offline AUC gains don't always move online metrics → always A/B test.

## Serving & MLOps
Model registry and versioning, shadow deployments, canary rollouts, A/B infrastructure, feature/prediction logging, latency SLOs (p99), GPU/CPU inference choice, embedding refresh pipelines, and rollback plans.
`,
    keyPoints: [
      "Start from the business objective → ML objective → metrics and guardrails.",
      "Multi-stage: candidate generation (recall) → ranking (precision) → re-ranking (policy).",
      "Feature store keeps training and serving features consistent.",
      "Watch leakage, feedback loops, position bias, cold start.",
      "Offline metrics guide; online A/B tests decide.",
    ],
    interview: [
      {
        q: "Design a recommendation system for a video platform's home feed.",
        a: "Clarify goals (long-term watch time and satisfaction, not just clicks), scale (100M users, 10M videos) and latency (< 200 ms). Data: impressions, watches, likes, skips, searches. Architecture: (1) candidate generation from several sources — two-tower embedding ANN, collaborative filtering, subscriptions, trending, continuation — ~1,000 candidates; (2) ranking with a multi-task deep model predicting click, watch time, like, using user/item/context features from an online feature store; (3) re-ranking for diversity, freshness, policy and exploration. Training on logged data with point-in-time features; daily retraining plus real-time feature updates. Evaluate offline (NDCG, calibration) and online via A/B tests with guardrails; monitor drift and skew. Discuss cold start, position bias and feedback loops.",
        freq: "very-common",
      },
      {
        q: "What is training–serving skew and how do you prevent it?",
        a: "The model sees different feature values in production than in training — due to separate code paths computing features, different data freshness, missing values handled differently, or using future information in training (leakage). Prevent it with a shared feature definition (feature store) used for both offline training (point-in-time correct joins) and online serving, logging the exact features used at serving time and training on those logs, and monitoring feature distributions online vs offline.",
        freq: "common",
      },
      {
        q: "Your new model improves offline AUC but the A/B test shows no lift. Why?",
        a: "Possible reasons: the offline metric doesn't align with the online objective (AUC on clicks vs long-term engagement); offline evaluation on logged data is biased by the old model's choices (counterfactual / exposure bias); training–serving skew; the gain is in parts of the ranking that don't affect the top positions shown; novelty effects or insufficient test duration/power; downstream re-ranking dilutes the change. Investigate with segment analysis, interleaving experiments, and better offline metrics (top-k, calibrated, counterfactual estimators).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "The main purpose of candidate generation is…",
        options: ["Maximize precision", "Cheaply narrow millions of items to a high-recall set", "Apply business rules", "Train the model"],
        answer: 1,
        explain: "Heavy rankers can only score hundreds/thousands of items per request.",
      },
      {
        q: "A feature store primarily prevents…",
        options: ["Overfitting", "Training–serving skew", "Cold start", "Position bias"],
        answer: 1,
        explain: "Same definitions offline and online.",
      },
      {
        q: "Using a feature computed with data from after the label time causes…",
        options: ["Cold start", "Data leakage (inflated offline metrics)", "Position bias", "Latency"],
        answer: 1,
        explain: "The model learns from information it won't have in production.",
      },
      {
        q: "The final arbiter of whether a recommender change helps is…",
        options: ["Offline AUC", "A well-designed online A/B test", "Training loss", "Feature importance"],
        answer: 1,
        explain: "Offline metrics are proxies.",
      },
    ],
  },

  // ------------------------------------------------------------------ CASE: LLM SERVING
  {
    id: "case-llm-serving",
    title: "Case Study: Design an LLM Inference Service",
    tagline: "A ChatGPT-style API: routing, batching, caching, streaming and cost.",
    difficulty: "advanced",
    minutes: 22,
    caseStudy: true,
    diagram: {
      title: "LLM inference platform",
      nodes: [
        { id: "client", label: "Client / SDK", kind: "client", x: 80, y: 280 },
        { id: "gw", label: "API gateway", sub: "auth, token limits", kind: "gateway", x: 270, y: 280 },
        { id: "safety", label: "Safety filters", kind: "service", x: 270, y: 90 },
        { id: "router", label: "Router", sub: "model, prefix-aware", kind: "lb", x: 480, y: 280 },
        { id: "q", label: "Request queue", sub: "priority, admission", kind: "queue", x: 480, y: 470 },
        { id: "gpu1", label: "Replica A", sub: "vLLM · 4×H100 TP", kind: "gpu", x: 740, y: 160 },
        { id: "gpu2", label: "Replica B", sub: "vLLM · 4×H100 TP", kind: "gpu", x: 740, y: 400 },
        { id: "kv", label: "Prefix / KV cache", sub: "per replica + tiered", kind: "cache", x: 920, y: 280 },
        { id: "meter", label: "Usage metering", sub: "tokens → billing", kind: "db", x: 480, y: 80 },
      ],
      edges: [
        { from: "client", to: "gw", label: "HTTPS / SSE" },
        { from: "gw", to: "safety" },
        { from: "gw", to: "router" },
        { from: "router", to: "q" },
        { from: "router", to: "gpu1" },
        { from: "router", to: "gpu2" },
        { from: "q", to: "gpu2", dashed: true },
        { from: "gpu1", to: "kv" },
        { from: "gpu2", to: "kv" },
        { from: "gw", to: "meter", dashed: true },
      ],
      flows: [
        {
          name: "Chat completion (streaming)",
          path: ["client", "gw", "safety", "gw", "router", "gpu1", "kv", "gpu1", "router", "gw", "client"],
          steps: [
            "POST /v1/chat/completions {model, messages, stream: true} with an API key.",
            "Authenticate, check per-org rate limits in requests AND tokens per minute, run input safety classifiers.",
            "Input passes moderation.",
            "Route by model name; prefer the replica that already holds this conversation's prefix (prefix-aware / consistent-hash routing).",
            "Replica A's scheduler admits the request into its continuous batch if KV memory allows.",
            "Prefix cache hit on the system prompt + earlier turns → only new tokens need prefill (lower TTFT and cost).",
            "Decode streams tokens; the batch is re-formed every step as sequences finish.",
            "Tokens flow back through the router…",
            "…the gateway counts output tokens for metering and applies output filters…",
            "…and streams them to the client as Server-Sent Events. First token in ~300 ms, then ~30–60 tokens/s.",
          ],
        },
        {
          name: "Overload",
          path: ["client", "gw", "router", "q", "gpu2"],
          steps: [
            "Traffic spike.",
            "Gateway enforces token-based quotas; abusive or over-quota callers get 429 with Retry-After.",
            "Replicas report KV usage and queue depth; if all are full, requests wait in a priority queue (interactive > batch) with a deadline.",
            "When a slot frees up, the request is admitted. Autoscaler adds replicas on queue depth/TTFT — slowly (weights take minutes to load), so keep warm headroom.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: chat/completions API with streaming; multiple models (small/fast, large/smart); system prompts, tools/function calling, structured output; usage metering and billing; per-org rate limits.
**Non-functional**: TTFT p95 < ~1 s and smooth streaming for interactive traffic; high availability; cost efficiency (GPUs are the dominant cost); isolation between tenants; safety.

## 2. Estimates
10M requests/day, avg 1,500 input + 400 output tokens → ~120 req/s avg, ~350 peak; ~140K output tokens/s at peak. If one 4×H100 replica of a 70B FP8 model sustains ~3K output tokens/s within SLOs → ~50 replicas (200 GPUs) at peak + headroom. Prefix caching and a small-model tier for easy queries cut this dramatically.

## 3. Architecture (step through the diagram)
- **API gateway**: auth, request validation, **token-aware rate limiting** (estimate input tokens up front; reserve max_tokens; reconcile after), safety filters, metering.
- **Router**: chooses model and replica; **prefix-aware routing** (hash conversation/system-prompt prefix → same replica) maximizes KV-cache reuse; health and load aware (queue depth, KV usage).
- **Inference engines** (vLLM, TensorRT-LLM, SGLang, TGI): continuous batching, PagedAttention, prefix caching, quantization (FP8), speculative decoding, tensor parallelism within a node.
- **Queue & admission control**: priority classes (interactive vs batch), deadlines, preemption.
- **Streaming**: SSE/gRPC streams end to end; handle client disconnects (cancel generation to free GPU).
- **Model registry & rollout**: versioned weights in object storage, canary deployments, shadow traffic, rollback.

## 4. Deep dives
- **Latency**: chunked prefill or disaggregated prefill/decode pools to keep TPOT stable; speculative decoding for latency-sensitive tiers.
- **Throughput & cost**: maximize batch size within SLOs (goodput), FP8/INT4 quantization, route simple prompts to smaller models (**model cascades**), batch API at discount for offline jobs, spot/preemptible GPUs for batch tier.
- **Autoscaling**: scale on queue depth / KV utilization / TTFT; cold starts take minutes (weights tens of GB) → keep warm pools, fast weight loading (local NVMe, peer-to-peer), pre-provisioned capacity per region.
- **Multi-tenancy & fairness**: per-tenant quotas, weighted fair queueing, isolation for enterprise (dedicated replicas).
- **Reliability**: retries with idempotency for non-streaming calls, multi-region failover, graceful degradation to a smaller model.
- **Observability**: TTFT/TPOT/E2E percentiles, tokens/s per GPU, KV-cache hit rate, queue time, error rates by model and tenant, cost per 1K tokens.
- **Safety & security**: input/output classifiers, prompt-injection handling for tool use, PII redaction in logs, data retention controls.
`,
    keyPoints: [
      "Token-aware rate limiting and metering at the gateway.",
      "Prefix-aware routing + prefix caching cut TTFT and cost.",
      "Inference engine: continuous batching, PagedAttention, FP8, speculative decoding.",
      "Admission control and priority queues for overload; scale on queue depth/TTFT.",
      "Cost levers: batching, quantization, model cascades, batch tier.",
    ],
    interview: [
      {
        q: "Design an API like the OpenAI/Anthropic chat completions service.",
        a: "Clarify models, traffic, latency SLOs and tenancy. Edge: API gateway with auth, token-based rate limits (requests/min and tokens/min per org), validation, safety classifiers, usage metering. Routing: per-model pools; prefix-aware routing to reuse KV caches; load-aware selection by queue depth and KV usage. Serving: inference engines (vLLM/TRT-LLM) with continuous batching, PagedAttention, prefix caching, FP8 quantization, tensor parallelism on 4–8 GPUs per replica; streaming via SSE with cancellation on disconnect. Capacity: size replicas from tokens/s per replica at SLO-meeting batch sizes; autoscale on queue depth/TTFT with warm headroom. Deep dives: prefill/decode interference (chunked prefill, disaggregation), cascades to smaller models, batch API, multi-region failover, observability (TTFT/TPOT p99, cost per token) and safety.",
        freq: "very-common",
      },
      {
        q: "How do you rate limit an LLM API fairly?",
        a: "Requests per minute alone is unfair — one request can be 10 tokens or 100K. Limit **tokens per minute** too: estimate input tokens at the gateway (tokenize), reserve `max_tokens` for output against the bucket, then reconcile with actual usage after completion. Use token buckets per org/key/model in Redis, separate limits for input vs output (output is costlier), concurrency limits for long streams, and priority tiers. Return 429 with Retry-After and remaining-quota headers.",
        freq: "common",
      },
      {
        q: "How would you reduce the cost of serving an LLM by 50%?",
        a: "Measure first (cost per 1K tokens, GPU utilization of KV/batch). Then: raise batch sizes with continuous batching and PagedAttention; quantize to FP8/INT4 (fewer GPUs per replica, faster decode); enable prefix caching for repeated system prompts/RAG context; route easy requests to a smaller/distilled model (cascade with a confidence check); cap max_tokens and trim prompts; move non-interactive traffic to an offline batch tier on cheaper/spot capacity; use speculative decoding for latency so you can run larger batches; right-size TP degree; schedule capacity by region and time of day.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Why route a conversation's requests to the same replica?",
        options: ["Security", "To reuse its prefix KV cache and skip recomputing prefill", "Billing", "To avoid streaming"],
        answer: 1,
        explain: "Prefix-aware routing maximizes cache hits.",
      },
      {
        q: "A fair LLM rate limiter should account for…",
        options: ["Only requests per second", "Tokens (input and output), not just requests", "Only IP addresses", "Model temperature"],
        answer: 1,
        explain: "Request cost varies by orders of magnitude.",
      },
      {
        q: "When a client disconnects mid-stream, the server should…",
        options: ["Keep generating", "Cancel the generation to free GPU capacity", "Restart the request", "Switch models"],
        answer: 1,
        explain: "Otherwise you burn GPU time on unread tokens.",
      },
      {
        q: "Why is autoscaling LLM replicas slower than web servers?",
        options: ["DNS caching", "Loading tens of GB of weights onto GPUs takes minutes", "TLS handshakes", "Kubernetes limits"],
        answer: 1,
        explain: "Keep warm headroom and fast weight loading paths.",
      },
    ],
  },
];
