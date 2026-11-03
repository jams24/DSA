// The six roadmap sections of a language track. A plain module (not "use client") so both
// server pages and client components can import the values.
import { BookOpen, Briefcase, Cpu, Hammer, Package, Sprout } from "lucide-react";
import type { Stage } from "@/content/types";

export const STAGES: { id: Stage; icon: typeof BookOpen; blurb: string }[] = [
  { id: "Foundations", icon: Sprout, blurb: "Install it, run it, and learn the syntax, types and building blocks." },
  { id: "Core", icon: BookOpen, blurb: "The everyday language: OOP or composition, errors, collections, generics, testing." },
  { id: "Advanced", icon: Cpu, blurb: "Concurrency, memory, the runtime under the hood, and modern features." },
  { id: "Ecosystem", icon: Package, blurb: "The libraries and API frameworks teams actually ship with." },
  { id: "Projects", icon: Hammer, blurb: "Build real programs step by step, with every file explained." },
  { id: "Interview", icon: Briefcase, blurb: "The language questions interviewers ask, with model answers." },
];
