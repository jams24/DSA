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
  | "text";

export interface CodeVariant {
  lang: Lang;
  code: string;
}

export interface CodeSample {
  title: string;
  note?: string;
  variants: CodeVariant[];
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
  | "model";

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
}

export interface CatalogWorld {
  id: string;
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
