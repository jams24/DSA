import type { World } from "../types";
import { aiInferencePart2 } from "./ai-inference-2";

export const aiInference: World = {
  id: "ai-inference",
  order: 7,
  title: "Neural Citadel",
  subtitle: "Transformers, LLM inference, KV cache, batching, quantization, RAG & ML system design",
  description:
    "AI infrastructure is now standard interview territory. Learn how LLMs actually run on GPUs, why decoding is memory-bound, and the tricks every serving stack uses — plus RAG and ML system design.",
  emoji: "🧠",
  color: "#0891b2",
  boss: {
    name: "The Hallucinating Oracle",
    title: "Confidently Wrong Since Token One",
    emoji: "🔮",
    taunt: "My answers are fluent, fast and completely made up. Can you even tell?",
    defeat: "Grounded... in retrieved context... my temperature drops to zero...",
  },
  lessons: [
    // ------------------------------------------------------------------ TRANSFORMERS
    {
      id: "transformer-basics",
      title: "Transformers 101: Tokens & Attention",
      tagline: "What actually happens between your prompt and the next token.",
      difficulty: "intermediate",
      minutes: 18,
      visualizers: ["tokenizer", "attention"],
      concept: `
## The pipeline
1. **Tokenize** the text into integer IDs (subword units, see the BPE visualizer).
2. **Embed**: look up a d-dimensional vector per token (d = 4,096 for Llama-3-8B). Add position information — modern LLMs rotate query/key vectors by position (**RoPE**) instead of adding position embeddings.
3. Pass through **L transformer blocks** (32 for 7–8B models, 80 for 70B). Each block:
   - **Self-attention**: every token gathers information from earlier tokens.
   - **MLP / feed-forward**: a per-token 2-layer network (often SwiGLU) — most of the parameters live here.
   - **Residual connections** around both and **normalization** (pre-norm, RMSNorm) for stable training.
4. **Unembed**: project the final hidden state to logits over the vocabulary (~32K–200K entries); softmax → next-token probabilities.

## Self-attention in one formula
Each token's vector is projected into a **query** (what am I looking for?), a **key** (what do I contain?) and a **value** (what do I pass on?):

**Attention(Q, K, V) = softmax(QKᵀ / √dₖ + mask) · V**

- QKᵀ scores every query against every key; dividing by √dₖ keeps softmax from saturating.
- The **causal mask** (−∞ above the diagonal) stops tokens from seeing the future — essential for left-to-right generation.
- **Multi-head attention** runs h smaller attentions in parallel (e.g. 32 heads × 128 dims) so different heads specialize: syntax, coreference, previous-token copying (play with the heads in the visualizer).
- Cost: O(n²·d) in sequence length n — the reason long context is expensive.

## Encoder vs decoder
- **Encoder-only** (BERT): bidirectional attention, great for embeddings and classification.
- **Decoder-only** (GPT, Llama, Claude-style chat models): causal attention, generate text token by token. Dominant for LLMs.
- **Encoder-decoder** (T5, original Transformer): translation, summarization.

## Parameter count intuition
Per block ≈ 4d² (attention projections) + 8d² (MLP with 4× expansion) = **12d²**. Llama-3-8B: 32 × 12 × 4096² ≈ 6.4B plus embeddings ≈ 8B. Memory for weights = params × bytes per param (FP16: 2 bytes → ~16 GB).

## Why tokens matter for engineering
Pricing, context limits, latency and rate limits are all **per token**. "~4 characters ≈ 1 token" for English; code, numbers and other languages tokenize less efficiently. Tokenization also explains classic model failures (counting letters in a word, arithmetic on long numbers).
`,
      keyPoints: [
        "Tokens → embeddings (+RoPE) → L × (attention + MLP) → logits.",
        "Attention = softmax(QKᵀ/√d + mask)·V; O(n²) in sequence length.",
        "Causal mask makes decoder-only generation possible.",
        "Multi-head: heads specialize in different relationships.",
        "≈12·L·d² parameters; weights memory = params × bytes.",
      ],
      complexity: [
        { op: "Self-attention (sequence n, width d)", time: "O(n² · d)", space: "O(n²) naive scores" },
        { op: "MLP per token", time: "O(d²)" },
        { op: "Forward pass FLOPs per token", time: "≈ 2 × params" },
      ],
      code: [
        {
          title: "Scaled dot-product attention (NumPy)",
          variants: [
            {
              lang: "python",
              code: `
import numpy as np

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)          # numerical stability
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

def causal_self_attention(X, Wq, Wk, Wv):
    """X: (n, d_model). Returns (n, d_head)."""
    Q, K, V = X @ Wq, X @ Wk, X @ Wv                 # (n, d_head) each
    d = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d)                    # (n, n)
    mask = np.triu(np.ones_like(scores), k=1).astype(bool)
    scores[mask] = -np.inf                           # no peeking at the future
    weights = softmax(scores)                        # each row sums to 1
    return weights @ V

n, d_model, d_head = 6, 16, 8
rng = np.random.default_rng(0)
X = rng.normal(size=(n, d_model))
out = causal_self_attention(X, *(rng.normal(size=(d_model, d_head)) for _ in range(3)))
print(out.shape)   # (6, 8)
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Explain self-attention to an engineer who's never seen it.",
          a: "Each token creates three vectors: a **query** (what it's looking for), a **key** (what it offers) and a **value** (the information it carries). For every token, we compare its query with every other token's key (dot products), scale and softmax them into weights that sum to 1, and output the weighted average of the values. So each token's new representation mixes in information from the tokens most relevant to it. Multiple heads do this in parallel with different projections, and stacking layers builds increasingly abstract relationships.",
          freq: "very-common",
        },
        {
          q: "Why divide by √d in attention?",
          a: "Dot products of d-dimensional vectors with unit-variance entries have variance ≈ d, so for large d the scores get large and softmax becomes extremely peaked, producing tiny gradients (saturation). Dividing by √d keeps the scores' variance ≈ 1, giving a smoother softmax and stable training.",
          freq: "common",
        },
        {
          q: "Why is attention O(n²), and why does that matter?",
          a: "Every token's query is compared with every key: n × n scores per head per layer. Doubling context quadruples attention compute (and naive memory for the score matrix). For long contexts (100K+ tokens) attention dominates cost, which motivates FlashAttention (IO-aware, no n² matrix in HBM), sliding-window/sparse attention, KV-cache compression and alternatives like state-space models.",
          freq: "common",
        },
        {
          q: "What's the difference between an encoder and a decoder transformer?",
          a: "Encoders use bidirectional (unmasked) attention: every token sees the whole input — good for understanding tasks and producing embeddings (BERT, embedding models). Decoders use causal attention: each token sees only the past, so they can generate autoregressively and cache past keys/values (GPT, Llama). Encoder-decoders (T5) encode the input bidirectionally and decode the output with causal self-attention plus cross-attention to the encoder.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "In attention, the output for a token is…",
          options: ["The maximum key", "A weighted average of value vectors", "The sum of all queries", "The token's own embedding"],
          answer: 1,
          explain: "Softmaxed query–key scores weight the values.",
        },
        {
          q: "The causal mask prevents…",
          options: ["Overfitting", "Tokens attending to future positions", "Gradient explosion", "Long sequences"],
          answer: 1,
          explain: "Decoders must not see tokens they haven't generated yet.",
        },
        {
          q: "Attention compute grows with sequence length n as…",
          options: ["O(n)", "O(n log n)", "O(n²)", "O(1)"],
          answer: 2,
          explain: "Every query against every key.",
        },
        {
          q: "Roughly how many FLOPs does a forward pass need per token?",
          options: ["params", "2 × params", "params²", "6 × params"],
          answer: 1,
          explain: "One multiply + one add per weight. (Training is ≈ 6 × params per token.)",
        },
        {
          q: "~How much memory do an 8B model's FP16 weights need?",
          options: ["8 GB", "16 GB", "32 GB", "64 GB"],
          answer: 1,
          explain: "8 × 10⁹ params × 2 bytes.",
        },
      ],
    },

    // ------------------------------------------------------------------ LLM INFERENCE
    {
      id: "llm-inference",
      title: "LLM Inference: Prefill, Decode & Sampling",
      tagline: "Two very different phases, and how the next token gets chosen.",
      difficulty: "intermediate",
      minutes: 16,
      visualizers: ["generation", "sampling"],
      concept: `
## Autoregressive generation
An LLM produces one token at a time: run the model, sample a token, append it, repeat until an end-of-sequence token or a length limit. Generating 500 tokens means 500 sequential forward passes — inherently serial.

## Two phases with opposite bottlenecks
**Prefill** — process the whole prompt in one forward pass. All prompt tokens are known, so they're processed **in parallel** as big matrix–matrix multiplies → **compute-bound**, high GPU utilization. Produces the KV cache for the prompt and the first output token. Its duration drives **time to first token (TTFT)**.

**Decode** — each step processes **one new token** per sequence, reusing cached keys/values. Each step must still stream **all the model weights** from GPU memory to do a tiny amount of math → **memory-bandwidth-bound**. Its speed is **time per output token (TPOT)**, also called inter-token latency.

Rule of thumb for a single sequence: decode tokens/s ≲ memory bandwidth ÷ model bytes. H100 (3.35 TB/s) with a 7B FP16 model (14 GB) → at most ~240 tokens/s, regardless of FLOPs. (See the roofline lesson.)

## Choosing the next token (try the sampling visualizer)
The model outputs **logits**; decoding strategies turn them into a choice:
- **Greedy**: take the argmax. Deterministic, can loop/repeat.
- **Temperature T**: softmax(logits / T). T < 1 sharpens, T > 1 flattens; T → 0 ≈ greedy.
- **Top-k**: sample only among the k most likely tokens.
- **Top-p (nucleus)**: sample from the smallest set whose probability mass ≥ p — adapts to confidence.
- **Min-p**, repetition/frequency/presence penalties, **logit bias**, and **constrained decoding** (grammars / JSON schemas) for structured output.
- **Beam search**: keep the b best partial sequences — useful for translation, rarely for chat.

Production chat typically uses temperature ~0.7 with top-p ~0.9–0.95; code and extraction tasks use low temperature.

## Streaming
Because decode is sequential, servers **stream** tokens as they're produced (Server-Sent Events / gRPC streams). Users perceive latency as TTFT plus reading speed, not total time — streaming is a UX necessity.

## Stopping
Stop at the EOS token, user-supplied stop sequences, or max tokens. Always cap \`max_tokens\`: output length is the dominant cost and latency driver.
`,
      keyPoints: [
        "Prefill: parallel, compute-bound, sets TTFT.",
        "Decode: one token per step, memory-bandwidth-bound, sets TPOT.",
        "Single-stream decode ceiling ≈ bandwidth ÷ model bytes.",
        "Temperature reshapes; top-k/top-p truncate the distribution.",
        "Stream tokens; always cap max_tokens.",
      ],
      complexity: [
        { op: "Prefill (n prompt tokens)", time: "1 forward pass, O(n²) attention" },
        { op: "Decode (m output tokens)", time: "m sequential passes" },
        { op: "End-to-end latency", time: "TTFT + TPOT × (m − 1)" },
      ],
      code: [
        {
          title: "A minimal sampling loop",
          variants: [
            {
              lang: "python",
              code: `
import numpy as np

def sample_next(logits, temperature=0.8, top_k=50, top_p=0.95, rng=np.random.default_rng()):
    if temperature == 0:
        return int(np.argmax(logits))                     # greedy
    logits = logits / temperature
    if top_k:
        cutoff = np.sort(logits)[-top_k]
        logits = np.where(logits < cutoff, -np.inf, logits)
    probs = np.exp(logits - logits.max())
    probs /= probs.sum()
    order = np.argsort(-probs)                             # nucleus filtering
    cum = np.cumsum(probs[order])
    keep = order[: np.searchsorted(cum, top_p) + 1]
    p = np.zeros_like(probs)
    p[keep] = probs[keep]
    return int(rng.choice(len(p), p=p / p.sum()))

def generate(model, prompt_ids, max_new=128, eos_id=2):
    ids, cache = list(prompt_ids), None
    logits, cache = model.forward(ids, cache)              # prefill: whole prompt at once
    for _ in range(max_new):
        nxt = sample_next(logits[-1])
        if nxt == eos_id:
            break
        ids.append(nxt)
        yield nxt                                          # stream it
        logits, cache = model.forward([nxt], cache)        # decode: one token, reuse KV cache
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why is LLM decoding memory-bound while prefill is compute-bound?",
          a: "In prefill, a prompt of n tokens is multiplied by each weight matrix at once (matrix × matrix), so each weight byte loaded from HBM is reused n times — plenty of arithmetic per byte. In decode, each step processes one token per sequence (matrix × vector): every weight is loaded to do ~2 FLOPs, far below the GPU's FLOPs-per-byte ratio (~300 on an H100). The GPU waits on memory. Batching many sequences raises reuse per weight and moves decode toward compute-bound.",
          freq: "very-common",
        },
        {
          q: "What are TTFT and TPOT, and what affects each?",
          a: "**TTFT (time to first token)** = queueing delay + prefill time (+ network). It grows with prompt length, load and how the scheduler interleaves prefills. **TPOT / ITL (time per output token)** = decode step time; it depends on model size/bandwidth, batch size (bigger batches slightly slow each step but raise throughput), KV-cache length and interference from other requests' prefills. End-to-end ≈ TTFT + TPOT × (output tokens − 1).",
          freq: "very-common",
        },
        {
          q: "Temperature vs top-p — what's the difference?",
          a: "Temperature rescales all logits before softmax: low values make the distribution peakier (more deterministic), high values flatter (more diverse and more errors). Top-p truncates the tail: keep only the most likely tokens whose cumulative probability reaches p, renormalize and sample — removing unlikely garbage while preserving diversity when the model is uncertain. They're often combined (e.g. T=0.7, p=0.9). For deterministic tasks use T≈0.",
          freq: "common",
        },
        {
          q: "How would you force an LLM to output valid JSON?",
          a: "Prompting alone isn't reliable. Use **constrained decoding**: compile a JSON schema or grammar into a state machine and, at each step, mask logits of tokens that would make the output invalid (Outlines, XGrammar, llama.cpp grammars, provider structured-output modes). Add validation + retry as a fallback, keep temperature low, and design schemas with enums to reduce freedom.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "Which phase determines time to first token?",
          options: ["Decode", "Prefill (plus queueing)", "Detokenization", "Sampling"],
          answer: 1,
          explain: "The whole prompt must be processed before the first token exists.",
        },
        {
          q: "Single-sequence decode speed is mainly limited by…",
          options: ["Tensor-core FLOPs", "GPU memory bandwidth", "CPU speed", "Disk I/O"],
          answer: 1,
          explain: "Every step streams all weights for very little math.",
        },
        {
          q: "Setting temperature very close to 0 makes sampling…",
          options: ["Uniform random", "Approximately greedy", "Fail", "Use beam search"],
          answer: 1,
          explain: "The highest logit dominates after scaling.",
        },
        {
          q: "Top-p = 0.9 means…",
          options: ["Keep the 90 most likely tokens", "Sample from the smallest set of tokens with ≥ 90% total probability", "Use 90% temperature", "Reject 10% of outputs"],
          answer: 1,
          explain: "Nucleus sampling adapts the candidate set to confidence.",
        },
        {
          q: "End-to-end latency for 200 output tokens ≈",
          options: ["TTFT", "TPOT × 200", "TTFT + TPOT × 199", "TTFT × 200"],
          answer: 2,
          explain: "First token after prefill, then one decode step per extra token.",
        },
      ],
    },

    // ------------------------------------------------------------------ KV CACHE
    {
      id: "kv-cache",
      title: "The KV Cache & PagedAttention",
      tagline: "The memory that makes decoding fast — and the reason GPUs run out of RAM.",
      difficulty: "advanced",
      minutes: 16,
      visualizers: ["paged", "vram"],
      concept: `
## Why cache keys and values
At decode step t, the new token's query must attend to the keys and values of **all** previous tokens. Those K/V vectors never change (causal attention), so recomputing them every step would make each step O(t) forward work and the whole generation O(n²). Instead, store them: the **KV cache**. Each step computes K/V only for the new token and appends it.

## How big is it?
**KV bytes per token = 2 (K and V) × layers × KV heads × head dim × bytes per element.**
- Llama-2-7B (32 layers, 32 KV heads, 128 dims, FP16): 2 × 32 × 32 × 128 × 2 = **512 KB per token** → a 4,096-token conversation ≈ 2 GB.
- Llama-3-8B uses **grouped-query attention** with 8 KV heads → 128 KB per token (4× smaller).
- Multiply by **every concurrent sequence**: 32 users × 8K tokens on Llama-2-7B ≈ 128 GB — more than the GPU.

The KV cache, not the weights, usually limits **how many requests fit** — and batch size is what drives throughput. Use the calculator to explore.

## Shrinking it
- **MQA / GQA**: share K/V across groups of query heads (Llama-3, Mistral). Minor quality cost, big memory win.
- **KV-cache quantization**: FP8 or INT4/INT8 for K/V.
- **Sliding-window attention** (Mistral) or attention sinks + recent window (StreamingLLM) for bounded memory.
- **Multi-head latent attention** (DeepSeek-V2/V3): compress K/V into a low-rank latent.
- **Offloading** cold KV to CPU memory or SSD for long idle conversations.

## PagedAttention (vLLM)
Naive servers allocate a contiguous KV region per request sized for the **maximum** length → most of it sits empty (internal fragmentation) and free gaps can't be used (external fragmentation); studies found 60–80% of KV memory wasted. **PagedAttention** splits the cache into fixed-size **blocks** (e.g. 16 tokens) allocated on demand and tracked by a per-sequence **block table**, exactly like OS virtual memory pages. Waste drops to < 1 block per sequence, batch sizes grow several-fold, and blocks can be **shared copy-on-write** across sequences with a common prefix (parallel sampling, beam search).

## Prefix caching
Many requests share a long prefix (system prompt, few-shot examples, a document in RAG, earlier turns of a chat). **Prefix caching** keeps those KV blocks and reuses them across requests → large TTFT and cost savings. Routing requests with the same prefix to the same server (cache-aware routing) maximizes hits; providers expose this as "prompt caching" discounts.
`,
      keyPoints: [
        "KV cache avoids recomputing past keys/values each decode step.",
        "Size = 2 × layers × KV heads × head_dim × bytes, per token, per sequence.",
        "KV memory limits concurrency, which limits throughput.",
        "GQA/MQA, KV quantization and sliding windows shrink it.",
        "PagedAttention: block-based allocation, ~no fragmentation, prefix sharing.",
      ],
      complexity: [
        { op: "Decode step with KV cache", time: "O(t) attention for step t" },
        { op: "Decode step without cache", time: "O(t²) recompute" },
        { op: "KV memory", time: "—", space: "O(layers · kv_heads · d · tokens · batch)" },
      ],
      code: [
        {
          title: "KV cache size calculator",
          variants: [
            {
              lang: "python",
              code: `
def kv_cache_bytes(layers, kv_heads, head_dim, tokens, batch=1, bytes_per_elem=2):
    return 2 * layers * kv_heads * head_dim * bytes_per_elem * tokens * batch

GB = 1e9
# Llama-2-7B: full multi-head attention
print(kv_cache_bytes(32, 32, 128, tokens=4096) / GB)             # ≈ 2.1 GB per sequence
# Llama-3-8B: grouped-query attention, 8 KV heads
print(kv_cache_bytes(32, 8, 128, tokens=8192, batch=32) / GB)    # ≈ 34 GB for 32 users
# Llama-3-70B: 80 layers, 8 KV heads, FP8 cache
print(kv_cache_bytes(80, 8, 128, tokens=32768, bytes_per_elem=1) / GB)  # ≈ 5.4 GB per sequence
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "What is the KV cache and why is it needed?",
          a: "During autoregressive decoding, each new token attends to the keys and values of all previous tokens. Those don't change, so instead of recomputing them for the whole sequence at every step, the server stores them per layer in GPU memory and only computes K/V for the newest token. This makes each decode step proportional to the current length instead of recomputing everything, at the cost of memory that grows linearly with sequence length and the number of concurrent sequences.",
          freq: "very-common",
        },
        {
          q: "Estimate the KV cache for 16 concurrent 8K-token chats on Llama-3-70B.",
          a: "Per token: 2 × 80 layers × 8 KV heads × 128 dims × 2 bytes (FP16) = 327,680 B ≈ 320 KB. × 8,192 tokens ≈ 2.7 GB per sequence. × 16 ≈ 43 GB — on top of ~141 GB of FP16 weights. So you need multiple GPUs (e.g. 4× H100 with tensor parallelism), and KV FP8 quantization or GQA (already used) are the main levers.",
          freq: "common",
        },
        {
          q: "What problem does PagedAttention solve?",
          a: "Memory fragmentation of the KV cache. Without it, servers reserve contiguous space for each request's maximum possible length; because actual lengths are unknown and vary, most reserved memory is unused and leftover gaps can't fit new requests, so batch sizes stay small. PagedAttention allocates fixed-size blocks on demand with a block table per sequence (non-contiguous, like OS paging), cutting waste to under a block per sequence and enabling copy-on-write sharing of common prefixes. Result: much larger batches and 2–4× throughput (vLLM paper).",
          freq: "very-common",
        },
        {
          q: "What is grouped-query attention?",
          a: "Instead of every query head having its own key/value head (multi-head attention), groups of query heads share one K/V head — e.g. 64 query heads and 8 KV heads in Llama-3-70B. Multi-query attention is the extreme (one K/V head). The KV cache and the memory bandwidth needed per decode step shrink by the group factor with little quality loss, which is why almost all modern LLMs use GQA.",
          freq: "common",
        },
      ],
      quiz: [
        {
          q: "KV cache size grows linearly with…",
          options: ["Vocabulary size", "Sequence length and number of concurrent sequences", "Temperature", "Number of MLP neurons"],
          answer: 1,
          explain: "Per token, per sequence, per layer.",
        },
        {
          q: "Llama-2-7B in FP16 stores about how much KV cache per token?",
          options: ["~4 KB", "~64 KB", "~512 KB", "~8 MB"],
          answer: 2,
          explain: "2 × 32 × 32 × 128 × 2 bytes = 524,288 bytes.",
        },
        {
          q: "Grouped-query attention reduces the KV cache by…",
          options: ["Quantizing weights", "Sharing K/V heads among groups of query heads", "Dropping old tokens", "Using CPU memory"],
          answer: 1,
          explain: "Fewer KV heads → proportionally smaller cache.",
        },
        {
          q: "PagedAttention is most analogous to…",
          options: ["Database sharding", "Virtual memory paging in an OS", "TCP congestion control", "Garbage collection"],
          answer: 1,
          explain: "Fixed-size blocks mapped via per-sequence tables.",
        },
        {
          q: "Prefix caching speeds up requests that…",
          options: ["Use high temperature", "Share a long common prefix like a system prompt", "Generate long outputs", "Use beam search"],
          answer: 1,
          explain: "The shared prefix's KV blocks are reused, skipping its prefill.",
        },
      ],
    },

    // ------------------------------------------------------------------ BATCHING
    {
      id: "batching",
      title: "Batching & Scheduling",
      tagline: "Static, dynamic and continuous batching — the biggest throughput lever.",
      difficulty: "intermediate",
      minutes: 13,
      visualizers: ["batching", "roofline"],
      concept: `
## Why batch at all
Decode is memory-bound: each step streams all the weights to produce one token per sequence. If 32 sequences share that step, the same weight traffic produces 32 tokens. Throughput rises almost linearly with batch size until compute or KV-cache memory runs out, while per-token latency rises only modestly. (Move the batch slider on the roofline.)

## Three generations of batching
**Static batching**: collect N requests, run them together until **all** finish. Short requests wait for the longest one (their slots idle, padding wasted); new requests wait for the whole batch.

**Dynamic batching** (classic model servers like Triton): form a batch from whatever arrives within a small time window. Good for fixed-size work (image classification), still bad for variable-length generation.

**Continuous / in-flight / iteration-level batching** (Orca, vLLM, TGI, TensorRT-LLM, SGLang): the scheduler re-forms the batch at **every decode step** — finished sequences leave immediately, waiting ones join. GPU slots stay busy, average latency drops, throughput rises several-fold. Compare both Gantt charts in the visualizer.

## Prefill/decode interference
A new request's prefill is a big compute burst; inserting it into a running decode batch stalls everyone's next token (latency spikes). Fixes:
- **Chunked prefill**: split long prompts into chunks interleaved with decode steps (vLLM, Sarathi).
- **Disaggregated serving**: run prefill and decode on **separate GPU pools** and ship the KV cache between them (DistServe, Splitwise, Mooncake) — each pool tuned for its bottleneck.

## Scheduling policies
- **Admission control** by KV-cache capacity (don't admit what you can't hold; preemption by swapping or recomputation when memory runs out).
- **Priorities / SLO-aware scheduling**: interactive chat vs batch jobs, per-tenant fairness.
- **Max batch tokens** budgets balance throughput vs latency.
- **Offline batch APIs**: run non-urgent jobs at huge batch sizes in off-peak capacity at a discount.

## Throughput vs latency
Bigger batches = more tokens per second per GPU (cheaper) but slower tokens per user. Serving is about operating at the batch size that maximizes **goodput** — throughput that still meets your TTFT/TPOT SLOs.
`,
      keyPoints: [
        "Batching amortizes weight reads across sequences: the key throughput lever.",
        "Static batching wastes slots waiting for the longest sequence.",
        "Continuous batching re-forms the batch every decode step.",
        "Chunked prefill / disaggregated prefill-decode avoid latency spikes.",
        "Tune batch size for goodput: throughput within latency SLOs.",
      ],
      interview: [
        {
          q: "What is continuous batching and why does it help?",
          a: "Instead of scheduling whole requests as a fixed batch, the server schedules at the granularity of individual decode iterations: after each step, finished sequences are removed and queued requests are inserted (after their prefill). Slots never sit idle waiting for the longest sequence, and new requests don't wait for a batch to drain. The GPU stays saturated, so throughput increases several times and average latency drops — it's the default in vLLM, TGI and TensorRT-LLM.",
          freq: "very-common",
        },
        {
          q: "Why does increasing batch size improve throughput but hurt latency?",
          a: "Each decode step must read all model weights from HBM; with a larger batch, that cost is shared by more sequences, so tokens per second per GPU rises nearly linearly while the step time grows slowly (more KV reads and compute). Each user waits slightly longer per token, and queueing/prefill interference increases TTFT. Past the compute-bound point or KV memory limit, throughput gains vanish. The operating point is chosen against latency SLOs.",
          freq: "common",
        },
        {
          q: "What is disaggregated prefill/decode serving?",
          a: "Running the compute-bound prefill phase and the memory-bound decode phase on different GPU pools. Prefill nodes process prompts and transfer the resulting KV cache (over NVLink/InfiniBand/RDMA) to decode nodes, which batch many sequences. Benefits: no prefill bursts stalling decodes (stable TPOT), independent scaling and hardware choices per phase. Cost: KV transfer bandwidth and orchestration complexity.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "In static batching, a finished short sequence…",
          options: ["Is replaced immediately", "Leaves its slot idle until the batch's longest sequence finishes", "Is restarted", "Speeds up the others"],
          answer: 1,
          explain: "That's the waste continuous batching eliminates.",
        },
        {
          q: "Continuous batching schedules at the granularity of…",
          options: ["Whole requests", "Individual decode iterations", "Minutes", "Tokens in the prompt only"],
          answer: 1,
          explain: "Iteration-level scheduling (Orca).",
        },
        {
          q: "Chunked prefill addresses…",
          options: ["Tokenization speed", "Long prefills stalling ongoing decodes", "Model accuracy", "Disk usage"],
          answer: 1,
          explain: "Interleave prompt chunks with decode steps.",
        },
        {
          q: "Decode arithmetic intensity is roughly proportional to…",
          options: ["Vocabulary size", "Batch size", "Temperature", "Number of layers"],
          answer: 1,
          explain: "More sequences reuse each loaded weight.",
        },
      ],
    },

    // ------------------------------------------------------------------ QUANTIZATION
    {
      id: "quantization",
      title: "Quantization",
      tagline: "Fewer bits per weight: smaller, faster, cheaper — if you handle the outliers.",
      difficulty: "advanced",
      minutes: 14,
      visualizers: ["quantization"],
      concept: `
## The idea
Store numbers with fewer bits. Weights trained in BF16/FP16 (2 bytes) can often run in **INT8/FP8 (1 byte)** or **INT4 (½ byte)** with small quality loss.
- **Memory**: 70B params × 2 B = 140 GB in FP16 → ~35 GB at 4-bit (fits one 48–80 GB GPU).
- **Speed**: decode is memory-bound, so reading half or a quarter of the bytes per step speeds decode up almost proportionally.
- **Cost**: fewer GPUs per model replica.

## How it works (see the lab)
Symmetric linear quantization: \`scale = max|w| / (2^(b−1) − 1)\`, \`q = round(w / scale)\` stored as a b-bit integer; dequantize as \`q × scale\`. The error is rounding noise of at most scale/2 per weight.

**Granularity matters**: one scale per tensor is cheap but a single **outlier** stretches the scale and crushes everyone else onto a few levels. Per-channel or **per-group** scales (e.g. every 64 or 128 weights) preserve precision at a small storage overhead.

## The outlier problem in LLMs
Transformers develop a few huge-magnitude **activation** channels (around 6.7B params and up). That's why naive INT8 of activations broke, and why methods exist:
- **LLM.int8()**: keep outlier columns in FP16, rest in INT8.
- **SmoothQuant**: migrate activation outliers into weights with a per-channel scaling so both quantize well (W8A8).
- **GPTQ**: post-training weight quantization layer by layer, using second-order information to compensate rounding errors (INT4/INT3).
- **AWQ**: protect the ~1% of weights that matter most (by activation magnitude) via scaling before quantizing.
- **FP8** (E4M3/E5M2) on H100/H200 and newer GPUs: hardware-native, often near-lossless for both weights and activations.

## Kinds of quantization
- **Weight-only** (W4A16): weights INT4, compute in FP16 — great for memory-bound decode.
- **Weight + activation** (W8A8, FP8): uses INT8/FP8 tensor cores — helps compute-bound prefill too.
- **KV-cache quantization**: FP8/INT8/INT4 cache → more concurrent sequences.
- **PTQ** (post-training) vs **QAT** (quantization-aware training, simulates quantization during training for better low-bit quality).

## Evaluate, don't assume
Measure perplexity and **task** benchmarks (code, math, long-context retrieval) — quantization degradation is often task-specific, and smaller models degrade more at the same bit width. Common ecosystems: GGUF/llama.cpp (CPU & Mac), bitsandbytes, AutoGPTQ/AWQ, TensorRT-LLM FP8, vLLM.
`,
      keyPoints: [
        "Fewer bits → less memory and bandwidth → faster decode, cheaper serving.",
        "scale = max|w| / (2^(b−1)−1); error ≤ scale/2 per weight.",
        "Per-group/per-channel scales protect against outliers.",
        "GPTQ/AWQ (weights), SmoothQuant/LLM.int8 (activations), FP8 (hardware).",
        "Always evaluate on target tasks; small models suffer more.",
      ],
      code: [
        {
          title: "Symmetric per-group INT4 quantization",
          variants: [
            {
              lang: "python",
              code: `
import numpy as np

def quantize(w, bits=4, group=128):
    qmax = 2 ** (bits - 1) - 1                      # 7 for INT4
    w = w.reshape(-1, group)
    scale = np.abs(w).max(axis=1, keepdims=True) / qmax
    scale[scale == 0] = 1
    q = np.clip(np.round(w / scale), -qmax - 1, qmax).astype(np.int8)
    return q, scale.astype(np.float16)               # store q (4 bits each) + one scale per group

def dequantize(q, scale):
    return (q.astype(np.float32) * scale).reshape(-1)

w = np.random.default_rng(0).normal(0, 0.02, size=4096).astype(np.float32)
q, s = quantize(w)
err = np.abs(w - dequantize(q, s)).mean()
print(f"mean abs error {err:.6f}; bytes {w.nbytes} -> {q.size // 2 + s.nbytes}")
`,
            },
          ],
        },
      ],
      interview: [
        {
          q: "Why does quantization speed up LLM inference?",
          a: "Decode is memory-bandwidth-bound: each step reads every weight from HBM. Storing weights in 8 or 4 bits instead of 16 cuts the bytes read per token by 2–4×, so tokens per second rise nearly proportionally (when kernels dequantize efficiently on the fly). It also frees memory for a larger KV cache → bigger batches → more throughput, and can let a model fit on fewer GPUs. With INT8/FP8 activations too, compute-bound prefill also speeds up via low-precision tensor cores.",
          freq: "very-common",
        },
        {
          q: "What's the problem with outliers in quantization, and how is it addressed?",
          a: "Linear quantization's step size is set by the maximum magnitude in the group. A few huge values (common in LLM activations and some weights) force a large step, so typical small values all round to zero or one level — big error. Solutions: finer granularity (per-channel/per-group scales), keeping outliers in higher precision (LLM.int8), shifting difficulty from activations to weights (SmoothQuant), salience-aware scaling (AWQ), error-compensating algorithms (GPTQ), rotations that spread outliers (QuaRot), or FP8 formats with wider dynamic range.",
          freq: "common",
        },
        {
          q: "Would you serve a 70B model in INT4 or an 8B model in FP16?",
          a: "Depends on quality needs and budget — measure. Generally a larger model quantized to 4-bit (with good methods like AWQ/GPTQ) outperforms a much smaller full-precision model on reasoning tasks, at ~35 GB vs ~16 GB memory and slower decode. If latency/cost dominate and the task is simple (classification, extraction), the small model may win. Evaluate both on your actual task set and check latency/throughput at target load.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "A 70B model's weights at INT4 need roughly…",
          options: ["17.5 GB", "35 GB", "70 GB", "140 GB"],
          answer: 1,
          explain: "70 × 10⁹ × 0.5 bytes.",
        },
        {
          q: "With 4-bit symmetric quantization, qmax is…",
          options: ["3", "7", "15", "127"],
          answer: 1,
          explain: "2^(4−1) − 1 = 7 (values −8…7).",
        },
        {
          q: "Per-group scales help because…",
          options: ["They use fewer bits", "One outlier only affects its own group's resolution", "They remove rounding", "They speed up training"],
          answer: 1,
          explain: "Localized scales keep precision for normal weights.",
        },
        {
          q: "Weight-only INT4 quantization mostly accelerates…",
          options: ["Prefill compute", "Memory-bound decode", "Tokenization", "Networking"],
          answer: 1,
          explain: "Fewer bytes to stream per decode step.",
        },
        {
          q: "Which method keeps outlier channels in FP16 and the rest in INT8?",
          options: ["GPTQ", "LLM.int8()", "AWQ", "QAT"],
          answer: 1,
          explain: "Mixed-precision decomposition of outlier features.",
        },
      ],
    },

    // ------------------------------------------------------------------ SPECULATIVE DECODING
    {
      id: "speculative-decoding",
      title: "Speculative Decoding",
      tagline: "Guess cheaply, verify in parallel, keep the output identical.",
      difficulty: "advanced",
      minutes: 12,
      visualizers: ["speculative"],
      concept: `
## The insight
In memory-bound decode, a forward pass over **k+1 tokens** costs about the same wall-clock time as over **1 token** — the weights are read once either way. So if we could *guess* the next few tokens, the big model could **check them all in one pass**.

## The algorithm
1. A cheap **draft** proposes k tokens autoregressively (a small model from the same family, or other drafters below).
2. The **target** model runs one forward pass over the prompt + k draft tokens, producing its own distribution at each position.
3. Accept draft tokens left to right using **rejection sampling**: accept token x with probability min(1, p_target(x) / p_draft(x)). At the first rejection, sample a replacement from the adjusted distribution and stop. If all k are accepted, sample one bonus token.
4. Each round yields between 1 and k+1 tokens for one target pass.

This acceptance rule makes the output distribution **exactly** the target model's — speculative decoding is lossless, unlike quantization or distillation.

## Expected speedup
With per-token acceptance rate α and k draft tokens, expected tokens per target pass = **(1 − α^(k+1)) / (1 − α)**. α = 0.8, k = 4 → ≈ 3.4 tokens per pass; minus the draft's cost, real speedups are typically **2–3×**. High α on predictable text (code, structured output, quoting the prompt); low α on creative text.

## Drafters
- **Small draft model** (e.g. 1B drafting for 70B) — must share the tokenizer.
- **Medusa**: extra decoding heads on the target predict tokens t+2, t+3… with tree attention to verify many candidates.
- **EAGLE**: a lightweight head drafts at the feature level — high acceptance.
- **Prompt lookup / n-gram drafting**: copy spans from the prompt (great for RAG, code edits, summarization).
- **Lookahead decoding**: Jacobi iteration, no draft model.

## Trade-offs
Extra memory for the draft model and its KV cache; more compute per step (wasted on rejected tokens); gains shrink at **large batch sizes** where decode becomes compute-bound — so it's most valuable for latency-sensitive, low-batch serving.
`,
      keyPoints: [
        "Verifying k tokens costs ≈ one decode step (memory-bound).",
        "Draft proposes, target verifies in one pass, accept the matching prefix.",
        "Rejection sampling keeps the target's distribution exactly — lossless.",
        "Tokens/pass = (1 − α^(k+1)) / (1 − α).",
        "Best at low batch sizes and predictable text.",
      ],
      interview: [
        {
          q: "How does speculative decoding speed up generation without changing outputs?",
          a: "A cheap draft model proposes several tokens; the large target model scores all of them in a single forward pass (nearly as cheap as one decode step because decoding is memory-bound). Draft tokens are accepted left to right with probability min(1, p_target/p_draft); at the first rejection we resample from a corrected distribution. This rejection-sampling scheme provably yields samples from exactly the target distribution, so quality is unchanged while multiple tokens are produced per expensive pass (2–3× typical).",
          freq: "common",
        },
        {
          q: "When does speculative decoding NOT help?",
          a: "When the acceptance rate is low (draft poorly aligned with the target, very creative/high-temperature text), when serving at large batch sizes where decode is already compute-bound (the extra verification work competes for compute), when the draft model is too slow relative to the target, or when memory is so tight that hosting a draft model reduces batch size. It's primarily a latency optimization for low-to-moderate load.",
          freq: "occasional",
        },
      ],
      quiz: [
        {
          q: "Why can the target verify k draft tokens cheaply?",
          options: ["It skips layers", "Decode is memory-bound: one pass reads the weights once for all k tokens", "It uses a smaller vocabulary", "Verification uses the CPU"],
          answer: 1,
          explain: "The weight read dominates; extra tokens add little time.",
        },
        {
          q: "Speculative decoding with proper rejection sampling changes the output distribution…",
          options: ["Slightly", "Not at all", "Toward the draft model", "Only at high temperature"],
          answer: 1,
          explain: "It's mathematically lossless.",
        },
        {
          q: "α = 0.5, k = 1: expected tokens per target pass?",
          options: ["1.0", "1.5", "2.0", "0.5"],
          answer: 1,
          explain: "(1 − 0.5²) / (1 − 0.5) = 0.75 / 0.5 = 1.5.",
        },
        {
          q: "Prompt-lookup (n-gram) drafting works especially well for…",
          options: ["Poetry", "Tasks that copy spans from the input, like code edits or RAG answers", "Image generation", "Training"],
          answer: 1,
          explain: "Draft tokens are copied from the prompt, so acceptance is high.",
        },
      ],
    },

    ...aiInferencePart2,
  ],
};
