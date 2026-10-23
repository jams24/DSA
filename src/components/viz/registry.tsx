"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function Loading() {
  return <div className="shimmer h-72 rounded-xl border border-line bg-panel-2" />;
}

type Loader = () => Promise<{ default: ComponentType }>;
const lazy = (load: Loader) => dynamic(load, { ssr: false, loading: Loading });

interface Entry {
  title: string;
  blurb: string;
  C: ComponentType;
}

export const VISUALIZERS: Record<string, Entry> = {
  // Foundations
  bigo: { title: "Growth of functions", blurb: "Toggle curves and feel how fast each complexity class explodes.", C: lazy(() => import("./foundations/BigO")) },
  array: { title: "Dynamic array", blurb: "Watch shifting on insert/delete and doubling on resize.", C: lazy(() => import("./foundations/DynamicArray")) },
  hashtable: { title: "Hash table", blurb: "Hash keys into buckets, collide, probe and rehash.", C: lazy(() => import("./foundations/HashTable")) },
  linkedlist: { title: "Linked list", blurb: "Insert, delete and reverse by rewiring pointers.", C: lazy(() => import("./foundations/LinkedList")) },
  stackqueue: { title: "Stack & queue", blurb: "LIFO vs FIFO, a ring-buffer queue and the bracket matcher.", C: lazy(() => import("./foundations/StackQueue")) },
  recursion: { title: "Recursion tree & call stack", blurb: "See every call of fib(n), then prune it with memoization.", C: lazy(() => import("./foundations/Recursion")) },
  // Trees & graphs
  traversal: { title: "Tree traversals", blurb: "Pre, in, post and level order — with the stack or queue that drives each.", C: lazy(() => import("./trees/Traversal")) },
  bst: { title: "Binary search tree", blurb: "Insert, search and all three delete cases. Then break it with sorted input.", C: lazy(() => import("./trees/BST")) },
  heap: { title: "Binary heap", blurb: "Sift up, sift down, O(n) heapify and heap sort on the backing array.", C: lazy(() => import("./trees/Heap")) },
  trie: { title: "Trie (prefix tree)", blurb: "Insert words, search, and autocomplete a prefix.", C: lazy(() => import("./trees/Trie")) },
  grid: { title: "BFS vs DFS vs A* on a grid", blurb: "Draw walls and watch each search explore. Then count islands.", C: lazy(() => import("./trees/GraphGrid")) },
  dijkstra: { title: "Dijkstra's algorithm", blurb: "Min-heap, relaxation and the shortest-path tree, step by step.", C: lazy(() => import("./trees/Dijkstra")) },
  topo: { title: "Topological sort (Kahn's algorithm)", blurb: "Order courses by prerequisites — and detect a cycle.", C: lazy(() => import("./trees/Topo")) },
  unionfind: { title: "Union-Find", blurb: "Union by rank and path compression on a live forest.", C: lazy(() => import("./trees/UnionFind")) },
  // Algorithms
  sorting: { title: "Sorting algorithms", blurb: "Step through six sorts, or race them on the same input.", C: lazy(() => import("./algorithms/Sorting")) },
  binarysearch: { title: "Binary search", blurb: "Exact match, lower bound, and binary search on the answer.", C: lazy(() => import("./algorithms/BinarySearch")) },
  dp: { title: "Dynamic programming tables", blurb: "Watch coin change, LCS and knapsack tables fill cell by cell.", C: lazy(() => import("./algorithms/DP")) },
  nqueens: { title: "Backtracking: N-Queens", blurb: "Place, prune, recurse, undo — the backtracking loop made visible.", C: lazy(() => import("./algorithms/NQueens")) },
  greedy: { title: "Greedy interval scheduling", blurb: "Three greedy rules, one correct. See which one wins.", C: lazy(() => import("./algorithms/Greedy")) },
  bits: { title: "Bit manipulation playground", blurb: "Flip bits, combine with AND/OR/XOR and try the classic tricks.", C: lazy(() => import("./algorithms/Bits")) },
  // Patterns
  twopointers: { title: "Two pointers", blurb: "Pair sums, container with most water and in-place dedupe.", C: lazy(() => import("./patterns/TwoPointers")) },
  slidingwindow: { title: "Sliding window", blurb: "Variable and fixed windows with a live hash map of counts.", C: lazy(() => import("./patterns/SlidingWindow")) },
  fastslow: { title: "Fast & slow pointers", blurb: "Floyd's tortoise and hare: detect a cycle, then find where it starts.", C: lazy(() => import("./patterns/FastSlow")) },
  prefixsum: { title: "Prefix sums", blurb: "O(1) range queries and counting subarrays with a hash map.", C: lazy(() => import("./patterns/PrefixSum")) },
  monostack: { title: "Monotonic stack", blurb: "Daily temperatures: every index pushed and popped once.", C: lazy(() => import("./patterns/MonoStack")) },
  intervals: { title: "Merge intervals", blurb: "Sort by start, then sweep and merge.", C: lazy(() => import("./patterns/Intervals")) },
  // System design
  latency: { title: "Latency numbers", blurb: "Every engineer's mental model of how slow things are, on a log scale.", C: lazy(() => import("./system/Latency")) },
  estimator: { title: "Back-of-envelope calculator", blurb: "Turn users and actions into QPS, storage and bandwidth.", C: lazy(() => import("./system/Estimator")) },
  loadbalancer: { title: "Load balancer simulator", blurb: "Five balancing algorithms, a slow server, and a kill switch.", C: lazy(() => import("./system/LoadBalancer")) },
  cache: { title: "Cache eviction policies", blurb: "LRU vs LFU vs FIFO on the same access pattern.", C: lazy(() => import("./system/Cache")) },
  ratelimiter: { title: "Rate limiter showdown", blurb: "Token bucket, fixed window and sliding log on identical traffic.", C: lazy(() => import("./system/RateLimiter")) },
  sharding: { title: "Sharding & rebalancing", blurb: "Mod-N vs range vs consistent hashing — then add a shard.", C: lazy(() => import("./system/Sharding")) },
  queue: { title: "Partitioned log (Kafka-style)", blurb: "Keys, partitions, consumer groups, offsets and lag.", C: lazy(() => import("./system/MessageQueue")) },
  // Distributed systems
  retries: { title: "Retry storms", blurb: "What retry policy does to a recovering server — with and without jitter.", C: lazy(() => import("./distributed/Retries")) },
  cap: { title: "CAP under a partition", blurb: "Cut the network, then choose: stay consistent or stay available.", C: lazy(() => import("./distributed/CAP")) },
  replication: { title: "Replication lag & consistency", blurb: "Read-your-writes and monotonic reads, broken and fixed.", C: lazy(() => import("./distributed/Replication")) },
  clocks: { title: "Lamport & vector clocks", blurb: "Build a space-time diagram and compare events for causality.", C: lazy(() => import("./distributed/Clocks")) },
  quorum: { title: "Quorum reads & writes", blurb: "Tune N, R and W, crash replicas, and catch stale reads.", C: lazy(() => import("./distributed/Quorum")) },
  consistenthash: { title: "Consistent hashing ring", blurb: "Add and remove servers, add virtual nodes, count moved keys.", C: lazy(() => import("./distributed/ConsistentHash")) },
  raft: { title: "Raft consensus simulator", blurb: "Elections, heartbeats, log replication, crashes and partitions — live.", C: lazy(() => import("./distributed/Raft")) },
  fencing: { title: "Leases & fencing tokens", blurb: "Why a GC pause breaks naive distributed locks.", C: lazy(() => import("./distributed/Fencing")) },
  twophase: { title: "2PC vs Sagas", blurb: "Atomic commit, the blocking problem, and compensating transactions.", C: lazy(() => import("./distributed/TwoPhase")) },
  gossip: { title: "Gossip protocol", blurb: "Epidemic spread to every node in O(log N) rounds.", C: lazy(() => import("./distributed/Gossip")) },
  lsm: { title: "LSM-tree storage engine", blurb: "Memtable, SSTables, compaction and the read path.", C: lazy(() => import("./distributed/LSM")) },
  bloom: { title: "Bloom filter", blurb: "Definitely-not or maybe, from a few bits and hash functions.", C: lazy(() => import("./distributed/Bloom")) },
  crdt: { title: "CRDTs", blurb: "Offline replicas that always converge — vs last-writer-wins losing data.", C: lazy(() => import("./distributed/CRDT")) },
  mapreduce: { title: "MapReduce word count", blurb: "Map, combine, shuffle, reduce — the batch processing blueprint.", C: lazy(() => import("./distributed/MapReduce")) },
  // AI inference
  tokenizer: { title: "BPE tokenizer", blurb: "Learn merge rules from a corpus and watch words become tokens.", C: lazy(() => import("./ai/Tokenizer")) },
  attention: { title: "Self-attention heatmap", blurb: "Three heads, a causal mask and a softmax temperature to play with.", C: lazy(() => import("./ai/Attention")) },
  sampling: { title: "Decoding & sampling", blurb: "Temperature, top-k and top-p reshape the next-token distribution.", C: lazy(() => import("./ai/Sampling")) },
  generation: { title: "Prefill, decode & the KV cache", blurb: "Step through generation with and without caching keys and values.", C: lazy(() => import("./ai/Generation")) },
  paged: { title: "PagedAttention", blurb: "Contiguous KV allocation vs vLLM-style paging on the same workload.", C: lazy(() => import("./ai/PagedKV")) },
  batching: { title: "Static vs continuous batching", blurb: "GPU slot timelines for the same 12 requests.", C: lazy(() => import("./ai/Batching")) },
  quantization: { title: "Quantization lab", blurb: "Bits, scales and outliers — see the rounding error.", C: lazy(() => import("./ai/Quantization")) },
  speculative: { title: "Speculative decoding", blurb: "Draft, verify, accept — tokens per expensive forward pass.", C: lazy(() => import("./ai/Speculative")) },
  parallelism: { title: "Model parallelism", blurb: "Data, tensor, pipeline and expert parallelism across 4 GPUs.", C: lazy(() => import("./ai/Parallelism")) },
  vram: { title: "GPU memory calculator", blurb: "Weights + KV cache + overhead for real models and GPUs.", C: lazy(() => import("./ai/VRAM")) },
  roofline: { title: "Roofline: why decode is memory-bound", blurb: "Arithmetic intensity, batch size and the ridge point on an H100.", C: lazy(() => import("./ai/Roofline")) },
  vectorsearch: { title: "Vector search", blurb: "Exact k-NN vs HNSW-style graph search on an embedding map.", C: lazy(() => import("./ai/VectorSearch")) },
  // Infrastructure, DevOps & SRE
  handshake: { title: "Connection setup: DNS, TCP, TLS, QUIC", blurb: "Count the round trips before the first byte for HTTP/1.1, HTTP/2 and HTTP/3.", C: lazy(() => import("./infra/Handshake")) },
  congestion: { title: "TCP congestion control", blurb: "Slow start, AIMD and the sawtooth: Reno vs Tahoe under loss.", C: lazy(() => import("./infra/Congestion")) },
  cidr: { title: "CIDR & subnet calculator", blurb: "See network vs host bits, carve a VPC into subnets and test membership.", C: lazy(() => import("./infra/Cidr")) },
  incident: { title: "On-call drill", blurb: "Get paged, run Linux and kubectl commands, find the root cause.", C: lazy(() => import("./infra/Incident")) },
  layers: { title: "Docker build cache", blurb: "Instruction order, cache invalidation and multi-stage image size.", C: lazy(() => import("./infra/Layers")) },
  kube: { title: "Kubernetes cluster simulator", blurb: "Scale, kill pods, fail and drain nodes. Watch the controllers reconcile.", C: lazy(() => import("./infra/Kube")) },
  hpa: { title: "Horizontal Pod Autoscaler", blurb: "Target utilization, startup time and stabilization vs real traffic.", C: lazy(() => import("./infra/Autoscaler")) },
  rollout: { title: "Deployment strategies", blurb: "Ship a buggy release with recreate, rolling, blue/green and canary.", C: lazy(() => import("./infra/Rollout")) },
  percentiles: { title: "Latency percentiles & the tail", blurb: "Mean vs p99, why you can't average percentiles, and fan-out.", C: lazy(() => import("./infra/Percentiles")) },
  slo: { title: "SLOs & error budgets", blurb: "Nines, dependency math, burn rates and multi-window alerts.", C: lazy(() => import("./infra/Slo")) },
  // Agents, LLM frontier & AI engineering
  agentloop: { title: "Inside an agent harness", blurb: "Step through a coding agent's loop: tool calls, permissions, hooks, subagents and compaction.", C: lazy(() => import("./agents/AgentLoop")) },
  context: { title: "Context budget & prompt caching", blurb: "Why agent sessions get expensive, and how caching and compaction fix it.", C: lazy(() => import("./agents/ContextBudget")) },
  moe: { title: "Mixture-of-Experts router", blurb: "Top-k routing, load balancing, capacity and dropped tokens.", C: lazy(() => import("./agents/MoE")) },
  reasoning: { title: "Test-time compute", blurb: "Majority voting and best-of-N with a verifier vs a single sample.", C: lazy(() => import("./agents/Reasoning")) },
  patterns: { title: "Agentic workflow patterns", blurb: "Chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer, agents.", C: lazy(() => import("./agents/Patterns")) },
  hybrid: { title: "Hybrid search & reranking", blurb: "BM25 + embeddings fused with reciprocal rank fusion, then a cross-encoder.", C: lazy(() => import("./agents/HybridSearch")) },
  evals: { title: "Eval statistics", blurb: "pass@k vs pass^k, and whether a benchmark gain is real or noise.", C: lazy(() => import("./agents/Evals")) },
  injection: { title: "Prompt injection & the lethal trifecta", blurb: "Poison an email agent, then find the defenses that actually stop exfiltration.", C: lazy(() => import("./agents/Injection")) },
  cascade: { title: "Model routing & cascades", blurb: "Router vs cascade vs one big model: cost against quality.", C: lazy(() => import("./agents/Cascade")) },
  lora: { title: "Fine-tuning memory: full vs LoRA vs QLoRA", blurb: "Trainable parameters, adapter size and what fits on one GPU.", C: lazy(() => import("./agents/LoRA")) },
};
