// Sanity checks for course content. Run with: npm run validate
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORLDS } from "../src/content";
import { LC150 } from "../src/content/leetcode150";
import { LC_GUIDE, LC_PATTERNS } from "../src/content/leetcode150-guide";
import { BOSS_HEARTS, BOSS_HP } from "../src/lib/game/engine";
import { CHALLENGES } from "../src/content/challenges";
import { OUT as CHALLENGE_CODE_OUT, renderChallengeCode } from "./gen-challenge-code";
import { validateSims } from "./validate-sims";

const errors: string[] = [];
const warn: string[] = [];
const registry = readFileSync(join(__dirname, "../src/components/viz/registry.tsx"), "utf8");
const vizIds = new Set([...registry.matchAll(/^\s{2}(\w+): \{ title:/gm)].map((m) => m[1]));

const worldIds = new Set<string>();
for (const w of WORLDS) {
  if (worldIds.has(w.id)) errors.push(`duplicate world id ${w.id}`);
  worldIds.add(w.id);
  const lessonIds = new Set<string>();
  let quizCount = 0;
  for (const l of w.lessons) {
    const where = `${w.id}/${l.id}`;
    if (l.id === "boss") errors.push(`${where}: lesson id 'boss' collides with the boss route`);
    if (lessonIds.has(l.id)) errors.push(`${where}: duplicate lesson id`);
    lessonIds.add(l.id);
    if (!l.concept.trim()) errors.push(`${where}: empty concept`);
    if (l.quiz.length < 3) warn.push(`${where}: only ${l.quiz.length} quiz questions`);
    if (l.interview.length < 2) warn.push(`${where}: only ${l.interview.length} interview questions`);
    quizCount += l.quiz.length;
    l.quiz.forEach((q, i) => {
      if (q.answer < 0 || q.answer >= q.options.length) errors.push(`${where} quiz #${i}: answer ${q.answer} out of range`);
      if (new Set(q.options).size !== q.options.length) errors.push(`${where} quiz #${i}: duplicate options`);
      if (!q.explain) errors.push(`${where} quiz #${i}: missing explanation`);
    });
    for (const v of l.visualizers ?? []) if (!vizIds.has(v)) errors.push(`${where}: unknown visualizer '${v}'`);
    if (!l.visualizers?.length && !l.diagram) warn.push(`${where}: no visualizer or diagram`);
    if (l.diagram) {
      const nodes = new Set(l.diagram.nodes.map((n) => n.id));
      const edge = (a: string, b: string) => l.diagram!.edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
      for (const e of l.diagram.edges) if (!nodes.has(e.from) || !nodes.has(e.to)) errors.push(`${where}: edge ${e.from}->${e.to} references a missing node`);
      for (const n of l.diagram.nodes) if (n.x < 70 || n.x > 930 || n.y < 30 || n.y > 530) warn.push(`${where}: node ${n.id} near canvas edge (${n.x},${n.y})`);
      for (const f of l.diagram.flows) {
        if (f.steps.length !== f.path.length - 1) errors.push(`${where} flow "${f.name}": ${f.path.length} nodes but ${f.steps.length} steps`);
        for (let i = 1; i < f.path.length; i++) {
          if (!nodes.has(f.path[i])) errors.push(`${where} flow "${f.name}": unknown node ${f.path[i]}`);
          else if (!edge(f.path[i - 1], f.path[i])) errors.push(`${where} flow "${f.name}": no edge ${f.path[i - 1]} -> ${f.path[i]}`);
        }
      }
    }
  }
  if (quizCount < BOSS_HP + BOSS_HEARTS) errors.push(`${w.id}: only ${quizCount} quiz questions; boss needs ${BOSS_HP + BOSS_HEARTS}`);
  console.log(`${w.emoji} ${w.title}: ${w.lessons.length} lessons, ${quizCount} quiz questions`);
}

// LeetCode Top Interview 150
const lcProblems = LC150.flatMap((c) => c.problems);
const lessonKeys = new Set(WORLDS.flatMap((w) => w.lessons.map((l) => `${w.id}/${l.id}`)));
if (lcProblems.length !== 150) errors.push(`LC150 has ${lcProblems.length} problems, expected 150`);
if (new Set(lcProblems.map((p) => p.slug)).size !== lcProblems.length) errors.push("LC150 has duplicate slugs");
for (const c of LC150) if (!lessonKeys.has(c.lesson)) errors.push(`LC150 category ${c.category} links to missing lesson ${c.lesson}`);
for (const p of lcProblems) if (!LC_GUIDE[p.slug]) errors.push(`LC150 ${p.slug} has no study guide (run python3 scripts/lc150/build.py)`);
for (const c of LC150) if (!LC_PATTERNS[c.category]) errors.push(`LC150 category ${c.category} has no pattern guide`);
console.log(`🧩 LeetCode Top Interview 150: ${lcProblems.length} problems in ${LC150.length} categories`);

// Practical coding challenges
const challengeSlugs = new Set<string>();
for (const c of CHALLENGES) {
  if (challengeSlugs.has(c.slug)) errors.push(`challenge ${c.slug}: duplicate slug`);
  challengeSlugs.add(c.slug);
  for (const [field, list] of Object.entries({ requirements: c.requirements, graded: c.graded, approach: c.approach, edgeCases: c.edgeCases, followUps: c.followUps }))
    if (list.length === 0) errors.push(`challenge ${c.slug}: empty ${field}`);
  if (c.solutions.length === 0) errors.push(`challenge ${c.slug}: no solutions`);
  for (const s of c.solutions) {
    for (const f of [s.file, s.test].filter((x): x is string => !!x))
      if (!existsSync(join(__dirname, "../challenge-code", f))) errors.push(`challenge ${c.slug}: missing file challenge-code/${f}`);
    if (s.run && s.run !== "tsc" && !s.test) errors.push(`challenge ${c.slug} · ${s.label}: run mode without a test`);
    if (!s.run && !s.notes) errors.push(`challenge ${c.slug} · ${s.label}: untested solutions must say why in notes`);
  }
}
if (!errors.some((e) => e.includes("missing file challenge-code/")) && readFileSync(CHALLENGE_CODE_OUT, "utf8") !== renderChallengeCode())
  errors.push("src/content/challenges/code.generated.ts is stale: run npm run challenges:gen");
const runnable = CHALLENGES.flatMap((c) => c.solutions).filter((s) => s.run).length;
console.log(`🛠️  Coding challenges: ${CHALLENGES.length} challenges, ${runnable} runnable solutions (run them with npm run challenges:test)`);

validateSims(errors).then((simStats) => {
  console.log(`▶️  Simulations: ${simStats.sims} problems, ${simStats.cases} examples traced and checked, ${simStats.frames} frames`);

  if (warn.length) console.log(`\n${warn.length} warning(s):\n  ${warn.join("\n  ")}`);
  if (errors.length) {
    console.error(`\n${errors.length} error(s):\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\n✓ content valid");
});
