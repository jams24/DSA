import type { World } from "../types";
import { javaFoundations } from "./java-1";
import { javaCore } from "./java-2";
import { javaAdvanced } from "./java-3";
import { javaEcosystem } from "./java-4";
import { javaProjects } from "./java-5";

export const java: World = {
  id: "java",
  track: "language",
  order: 15,
  title: "Java",
  subtitle: "From your first class to Spring Boot APIs, virtual threads and the JVM",
  description:
    "A complete Java course for Java 21 and 25 LTS. Start with the JDK and syntax, master OOP, collections, generics, streams and exceptions, then go deep on concurrency, virtual threads, the JVM and garbage collection. Finish with the libraries and Spring Boot APIs real teams use, two guided projects, and the Java questions interviewers ask.",
  emoji: "☕",
  color: "#c2410c",
  boss: {
    name: "The NullPointer Wraith",
    title: "Haunter of Uninitialized Fields",
    emoji: "👻",
    taunt: "Cannot invoke \"String.length()\" because \"name\" is null. Your HashMap has no hashCode, your threads race, and your heap is full!",
    defeat: "equals and hashCode in harmony, virtual threads humming, Optional where it belongs. The JVM bows to you.",
  },
  lessons: [...javaFoundations, ...javaCore, ...javaAdvanced, ...javaEcosystem, ...javaProjects],
};
