import type { World } from "../types";
import { cppFoundations } from "./cpp-1";
import { cppCore } from "./cpp-2";
import { cppAdvanced } from "./cpp-3";
import { cppEcosystem } from "./cpp-4";
import { cppProjects } from "./cpp-5";

export const cpp: World = {
  id: "cpp",
  track: "language",
  order: 16,
  title: "C++",
  subtitle: "From your first compile to move semantics, templates, concurrency and a Boost.Beast REST API",
  description:
    "A complete modern C++ course (C++20 and C++23). Learn how code becomes a native binary, then master types, pointers and references, RAII, smart pointers, the STL, algorithms and ranges. Go deep on move semantics, templates and concepts, threads and atomics, and the newest standards. Finish with the libraries and web frameworks C++ teams use, two guided projects (a persistent key-value store and a JSON REST API) and the questions C++ interviewers ask.",
  emoji: "⚙️",
  color: "#4f46e5",
  boss: {
    name: "The Segfault Golem",
    title: "Guardian of Dangling Pointers",
    emoji: "🗿",
    taunt: "Your pointer dangles, your vector reallocated under your reference, your destructor isn't virtual, and that signed overflow? Undefined. Core dumped!",
    defeat: "RAII everywhere, ownership crystal clear, sanitizers silent. The Golem crumbles into well-defined behavior.",
  },
  lessons: [...cppFoundations, ...cppCore, ...cppAdvanced, ...cppEcosystem, ...cppProjects],
};
