"use client";

import { useState } from "react";
import type { ArchDiagram } from "@/content/types";
import ArchitectureDiagram from "../ArchitectureDiagram";
import { Segmented } from "../kit";

type Pattern = "chain" | "route" | "parallel" | "orchestrator" | "evaluator" | "agent";

const PATTERNS: Record<Pattern, { label: string; use: string; tradeoff: string; example: string; diagram: ArchDiagram }> = {
  chain: {
    label: "Prompt chaining",
    use: "The task splits cleanly into fixed sequential steps.",
    tradeoff: "Each call is simpler and more accurate. Latency adds up, and code gates between steps catch errors early.",
    example: "Write an outline → check it covers the brief → write the document → translate it.",
    diagram: {
      title: "Prompt chaining",
      nodes: [
        { id: "in", label: "Input", kind: "client", x: 90, y: 260 },
        { id: "l1", label: "LLM 1: outline", kind: "model", x: 300, y: 260 },
        { id: "gate", label: "Gate (code)", sub: "schema / rules check", kind: "worker", x: 510, y: 260 },
        { id: "l2", label: "LLM 2: write", kind: "model", x: 720, y: 260 },
        { id: "out", label: "Output", kind: "client", x: 900, y: 420 },
        { id: "stop", label: "Stop / repair", kind: "external", x: 510, y: 450 },
      ],
      edges: [
        { from: "in", to: "l1" },
        { from: "l1", to: "gate" },
        { from: "gate", to: "l2", label: "pass" },
        { from: "l2", to: "out" },
        { from: "gate", to: "stop", label: "fail", dashed: true },
      ],
      flows: [
        { name: "Happy path", path: ["in", "l1", "gate", "l2", "out"], steps: ["A focused prompt produces an outline.", "Deterministic code validates it: required sections present, JSON parses, length OK.", "Only a valid outline reaches the second, focused prompt.", "Final output."] },
        { name: "Gate fails", path: ["in", "l1", "gate", "stop"], steps: ["The outline is generated.", "The check fails (missing a required section).", "Stop early or re-prompt with the error, before spending tokens on step 2."] },
      ],
    },
  },
  route: {
    label: "Routing",
    use: "Inputs fall into distinct categories that need different prompts, tools or models.",
    tradeoff: "Specialized handlers do better than one prompt that does everything, and cheap models take the easy traffic. The router's mistakes become your mistakes.",
    example: "Support tickets: refunds → refund flow with order tools; bugs → tech support; FAQs → small model.",
    diagram: {
      title: "Routing",
      nodes: [
        { id: "in", label: "Request", kind: "client", x: 90, y: 280 },
        { id: "router", label: "Router", sub: "classifier LLM or rules", kind: "gateway", x: 310, y: 280 },
        { id: "a", label: "Refund flow", sub: "prompt A + order tools", kind: "model", x: 590, y: 110 },
        { id: "b", label: "Tech support", sub: "prompt B + logs tool", kind: "model", x: 590, y: 280 },
        { id: "c", label: "FAQ", sub: "small, cheap model", kind: "model", x: 590, y: 450 },
        { id: "out", label: "Response", kind: "client", x: 870, y: 280 },
      ],
      edges: [
        { from: "in", to: "router" },
        { from: "router", to: "a" },
        { from: "router", to: "b" },
        { from: "router", to: "c" },
        { from: "a", to: "out" },
        { from: "b", to: "out" },
        { from: "c", to: "out" },
      ],
      flows: [
        { name: "“I was charged twice”", path: ["in", "router", "a", "out"], steps: ["The request arrives.", "Classified as billing/refund with high confidence.", "A specialized prompt with only the order and refund tools it needs."] },
        { name: "“What are your hours?”", path: ["in", "router", "c", "out"], steps: ["The request arrives.", "Classified as a simple FAQ.", "A small model answers for a fraction of the cost and latency."] },
      ],
    },
  },
  parallel: {
    label: "Parallelization",
    use: "Independent subtasks can run at once (sectioning), or you want several opinions (voting).",
    tradeoff: "Lower latency and more focused calls, but more total tokens. Voting buys reliability with compute.",
    example: "Review code with separate security, performance and style passes. Or run a guardrail check in parallel with the answer.",
    diagram: {
      title: "Parallelization",
      nodes: [
        { id: "in", label: "Input", kind: "client", x: 90, y: 280 },
        { id: "fan", label: "Fan out (code)", kind: "worker", x: 280, y: 280 },
        { id: "p1", label: "LLM: security review", kind: "model", x: 510, y: 110 },
        { id: "p2", label: "LLM: performance review", kind: "model", x: 510, y: 280 },
        { id: "p3", label: "LLM: style review", kind: "model", x: 510, y: 450 },
        { id: "agg", label: "Aggregate", sub: "merge or majority vote", kind: "worker", x: 730, y: 280 },
        { id: "out", label: "Output", kind: "client", x: 900, y: 440 },
      ],
      edges: [
        { from: "in", to: "fan" },
        { from: "fan", to: "p1" },
        { from: "fan", to: "p2" },
        { from: "fan", to: "p3" },
        { from: "p1", to: "agg" },
        { from: "p2", to: "agg" },
        { from: "p3", to: "agg" },
        { from: "agg", to: "out" },
      ],
      flows: [
        { name: "Sectioning", path: ["in", "fan", "p1", "agg", "out"], steps: ["A pull request arrives.", "Code sends it to three focused reviewers at the same time (only one path is highlighted).", "Each prompt does one job well instead of juggling all three.", "Findings are merged and deduplicated."] },
        { name: "Voting", path: ["in", "fan", "p2", "agg", "out"], steps: ["Is this content a policy violation?", "The same question goes to N samples or N different prompts.", "Each votes independently.", "Majority (or 'flag if any') sets the precision/recall trade-off."] },
      ],
    },
  },
  orchestrator: {
    label: "Orchestrator-workers",
    use: "You can't predict the subtasks in advance: the orchestrator decides them at runtime.",
    tradeoff: "Flexible, and each worker gets a clean context. Harder to debug, and the orchestrator's plan quality caps everything.",
    example: "A coding agent decides which files need edits, delegates each to a worker, then integrates the results.",
    diagram: {
      title: "Orchestrator-workers",
      nodes: [
        { id: "in", label: "Task", kind: "client", x: 90, y: 280 },
        { id: "orch", label: "Orchestrator LLM", sub: "plans & synthesizes", kind: "model", x: 320, y: 280 },
        { id: "w1", label: "Worker: api.py", kind: "model", x: 610, y: 110 },
        { id: "w2", label: "Worker: models.py", kind: "model", x: 610, y: 280 },
        { id: "w3", label: "Worker: tests", kind: "model", x: 610, y: 450 },
        { id: "out", label: "Result", kind: "client", x: 880, y: 280 },
      ],
      edges: [
        { from: "in", to: "orch" },
        { from: "orch", to: "w1" },
        { from: "orch", to: "w2" },
        { from: "orch", to: "w3" },
        { from: "orch", to: "out" },
      ],
      flows: [
        {
          name: "Dynamic delegation",
          path: ["in", "orch", "w1", "orch", "w2", "orch", "w3", "orch", "out"],
          steps: [
            "“Add a created_at field to orders everywhere.”",
            "The orchestrator inspects the repo and decides three subtasks (not hard-coded).",
            "The worker returns a diff for api.py.",
            "Next subtask, informed by the first result.",
            "The diff for models.py comes back.",
            "Tests are delegated last.",
            "Test changes come back.",
            "The orchestrator checks consistency and produces the final change.",
          ],
        },
      ],
    },
  },
  evaluator: {
    label: "Evaluator-optimizer",
    use: "There are clear evaluation criteria and iterative refinement measurably helps.",
    tradeoff: "Quality rises with each round, but latency and cost multiply. Cap the iterations, and prefer real checks (tests, compilers) over LLM opinions.",
    example: "Translate with nuance, or write code until the tests and a reviewer rubric both pass.",
    diagram: {
      title: "Evaluator-optimizer",
      nodes: [
        { id: "in", label: "Task", kind: "client", x: 90, y: 280 },
        { id: "gen", label: "Generator LLM", kind: "model", x: 360, y: 280 },
        { id: "ev", label: "Evaluator", sub: "rubric LLM and/or tests", kind: "monitor", x: 640, y: 280 },
        { id: "out", label: "Accepted output", kind: "client", x: 880, y: 440 },
      ],
      edges: [
        { from: "in", to: "gen" },
        { from: "gen", to: "ev", label: "draft" },
        { from: "ev", to: "out", label: "pass" },
      ],
      flows: [
        {
          name: "Refine until it passes",
          path: ["in", "gen", "ev", "gen", "ev", "out"],
          steps: ["The task and criteria go to the generator.", "Draft 1 is scored: 2 of 4 criteria pass, with specific feedback.", "The feedback goes back to the generator as the next instruction.", "Draft 2: all criteria pass (or the iteration cap is hit).", "Accepted."],
        },
      ],
    },
  },
  agent: {
    label: "Autonomous agent",
    use: "Open-ended problems where you can't predict the number of steps, and the environment gives feedback.",
    tradeoff: "The most capable and the least predictable: higher cost, compounding errors. Needs sandboxing, budgets, checkpoints and good tools.",
    example: "Fix this failing CI job. Research a question across dozens of sources. Operate a browser to complete a form.",
    diagram: {
      title: "Autonomous agent loop",
      nodes: [
        { id: "user", label: "User", kind: "client", x: 90, y: 280 },
        { id: "agent", label: "Agent", sub: "LLM in a loop", kind: "model", x: 370, y: 280 },
        { id: "env", label: "Environment", sub: "tools · files · APIs", kind: "external", x: 680, y: 130 },
        { id: "human", label: "Checkpoint", sub: "human or policy", kind: "control", x: 680, y: 430 },
        { id: "done", label: "Done", kind: "client", x: 900, y: 280 },
      ],
      edges: [
        { from: "user", to: "agent" },
        { from: "agent", to: "env", label: "act" },
        { from: "agent", to: "human", dashed: true },
        { from: "agent", to: "done" },
      ],
      flows: [
        {
          name: "Act, observe, repeat",
          path: ["user", "agent", "env", "agent", "env", "agent", "human", "agent", "done"],
          steps: [
            "A goal, not a script.",
            "The model picks an action (a tool call).",
            "The environment returns ground truth: output, errors, test results.",
            "It adjusts the plan based on what actually happened.",
            "More observations.",
            "Before a risky, irreversible step it pauses for approval.",
            "Approved (or redirected).",
            "It stops when the goal is met, or when a budget, turn limit or error threshold is reached.",
          ],
        },
      ],
    },
  },
};

export default function Patterns() {
  const [p, setP] = useState<Pattern>("chain");
  const cur = PATTERNS[p];
  return (
    <div className="space-y-4">
      <Segmented value={p} onChange={setP} options={(Object.keys(PATTERNS) as Pattern[]).map((k) => ({ value: k, label: PATTERNS[k].label }))} />
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { h: "Use when", t: cur.use },
          { h: "Trade-off", t: cur.tradeoff },
          { h: "Example", t: cur.example },
        ].map((c) => (
          <div key={c.h} className="rounded-xl border border-line bg-panel p-3 text-xs">
            <div className="font-semibold text-ink">{c.h}</div>
            <div className="mt-1 leading-relaxed text-dim">{c.t}</div>
          </div>
        ))}
      </div>
      <ArchitectureDiagram key={p} diagram={cur.diagram} />
    </div>
  );
}
