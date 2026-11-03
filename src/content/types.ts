// Shape of the course content. Everything here is plain serializable data so it can be
// passed from server components into client components unchanged.

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Lang =
  | "python"
  | "javascript"
  | "typescript"
  | "java"
  | "cpp"
  | "go"
  | "sql"
  | "yaml"
  | "bash"
  | "dockerfile"
  | "hcl"
  | "properties"
  | "xml"
  | "json"
  | "cmake"
  | "kotlin"
  | "proto"
  | "make"
  | "text";

export interface CodeVariant {
  lang: Lang;
  code: string;
}

export interface CodeSample {
  title: string;
  note?: string;
  variants: CodeVariant[];
  /** markdown shown under the code: a walkthrough of how it works */
  explain?: string;
  /** exactly what the program prints; checked by `npm run languages:test` */
  output?: string;
  /** don't compile/run this sample in `npm run languages:test` (needs third-party deps, or shows a bug on purpose) */
  noCheck?: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** index into options */
  answer: number;
  explain: string;
}

export type Frequency = "very-common" | "common" | "occasional";

export interface InterviewQA {
  q: string;
  /** markdown */
  a: string;
  freq?: Frequency;
}

export interface PracticeProblem {
  title: string;
  url?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  note?: string;
}

export interface ComplexityRow {
  op: string;
  time: string;
  space?: string;
  note?: string;
}

export type ArchNodeKind =
  | "client"
  | "dns"
  | "cdn"
  | "lb"
  | "gateway"
  | "service"
  | "worker"
  | "cache"
  | "db"
  | "queue"
  | "storage"
  | "search"
  | "gpu"
  | "external"
  | "model"
  | "node"
  | "control"
  | "monitor"
  | "registry";

export interface ArchNode {
  id: string;
  label: string;
  kind: ArchNodeKind;
  /** position on a 1000 x 560 canvas */
  x: number;
  y: number;
  sub?: string;
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface ArchFlow {
  name: string;
  /** ordered node ids a request visits */
  path: string[];
  /** one caption per hop (path.length - 1 entries) */
  steps: string[];
}

export interface ArchDiagram {
  title: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
  flows: ArchFlow[];
}

/** One file in a project step. Steps always show whole files, so the latest version of each path is the finished project. */
export interface ProjectFile {
  path: string;
  lang: Lang;
  code: string;
}

export interface ProjectStep {
  title: string;
  /** markdown: what this step builds and why */
  explain: string;
  files: ProjectFile[];
  /** commands to try after the step */
  run?: string;
  /** what you should see */
  output?: string;
}

export interface ProjectGuide {
  /** markdown: what you'll build */
  summary: string;
  skills: string[];
  /** finished file tree */
  tree: string;
  steps: ProjectStep[];
  /** stretch goals once it works */
  extensions: string[];
  /**
   * bash run by `npm run languages:test` in a directory holding the finished files. $JAVA_CMD, $CXX_CMD and
   * $GO_CMD point at the toolchains. Prefix with "net:" when it downloads dependencies.
   */
  verify?: string;
}

export interface Library {
  name: string;
  /** one line: what it is */
  what: string;
  /** when to reach for it, and what to compare it with */
  when: string;
  tag?: "standard" | "essential" | "popular" | "rising";
  snippet?: CodeVariant;
}

export interface LibraryGroup {
  category: string;
  blurb?: string;
  libs: Library[];
}

/** Section of a language track roadmap. */
export type Stage = "Foundations" | "Core" | "Advanced" | "Ecosystem" | "Projects" | "Interview";

export interface Lesson {
  id: string;
  title: string;
  tagline: string;
  difficulty: Difficulty;
  minutes: number;
  /** keys into the client visualizer registry */
  visualizers?: string[];
  diagram?: ArchDiagram;
  /** markdown */
  concept: string;
  keyPoints: string[];
  complexity?: ComplexityRow[];
  code?: CodeSample[];
  interview: InterviewQA[];
  quiz: QuizQuestion[];
  problems?: PracticeProblem[];
  /** system-design style case study (counts toward the case-study achievement) */
  caseStudy?: boolean;
  /** language tracks: which roadmap section the lesson belongs to */
  stage?: Stage;
  /** a guided build, shown on the Build tab */
  project?: ProjectGuide;
  /** a library catalog, shown on the Toolbox tab */
  toolbox?: LibraryGroup[];
}

export interface Boss {
  name: string;
  title: string;
  emoji: string;
  taunt: string;
  defeat: string;
}

export interface World {
  id: string;
  /** "language" tracks live under /languages instead of /worlds */
  track?: "language";
  order: number;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  /** hex accent color */
  color: string;
  boss: Boss;
  lessons: Lesson[];
}

// ---- lightweight catalog shipped to the client (no lesson bodies) ----

export interface CatalogLesson {
  id: string;
  key: string; // `${worldId}/${lessonId}`
  title: string;
  tagline: string;
  difficulty: Difficulty;
  minutes: number;
  caseStudy?: boolean;
  hasVisualizer: boolean;
  stage?: Stage;
  kind?: "project" | "toolbox";
}

export interface CatalogWorld {
  id: string;
  track?: "language";
  order: number;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  color: string;
  boss: Boss;
  lessons: CatalogLesson[];
}

export type Catalog = CatalogWorld[];

/** A quiz question with a stable id, used by boss battles, arena and the daily challenge. */
export interface PooledQuestion extends QuizQuestion {
  id: string; // `${worldId}/${lessonId}#${index}`
  worldId: string;
  lessonTitle: string;
}

export interface FlashCard {
  id: string; // `${worldId}/${lessonId}~${index}`
  worldId: string;
  lessonTitle: string;
  q: string;
  a: string;
  freq?: Frequency;
}
