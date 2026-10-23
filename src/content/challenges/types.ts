// Practical interview challenges: the build-something tasks companies give in live-coding rounds and
// take-homes, as opposed to algorithm puzzles. Reference solutions with a `run` mode are executed by
// `npm run challenges:test` (see scripts/test-challenges.ts).
// Source files live in challenge-code/ so they can be run as real programs.

export type Track = "backend" | "frontend" | "language";

/** How the test runner executes (or type-checks) a solution. */
export type RunMode = "python" | "python-deps" | "node" | "node-deps" | "java" | "go" | "tsc";

export interface Solution {
  /** language or framework family, used for filtering: "Python", "Java", "Go", "TypeScript", "JavaScript", "React", "Vue" */
  stack: string;
  /** tab label, e.g. "FastAPI" or "Spring Boot" */
  label: string;
  /** shiki language id */
  lang: string;
  /** path under challenge-code/; the source is embedded by `npm run challenges:gen` */
  file: string;
  run?: RunMode;
  /** test file under challenge-code/, run against the solution; see scripts/test-challenges.ts for each mode's convention */
  test?: string;
  notes?: string;
}

export interface Challenge {
  slug: string;
  title: string;
  track: Track;
  difficulty: "Easy" | "Medium" | "Hard";
  frequency: "Very common" | "Common" | "Occasional";
  format: "Live coding" | "Take-home" | "Live or take-home";
  /** suggested time box */
  time: string;
  /** one line for the list */
  summary: string;
  /** the task as an interviewer would hand it to you (markdown) */
  prompt: string;
  requirements: string[];
  /** what the interviewer is grading */
  graded: string[];
  approach: string[];
  edgeCases: string[];
  followUps: string[];
  solutions: Solution[];
}
