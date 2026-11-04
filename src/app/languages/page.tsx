import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Code2, Timer } from "lucide-react";
import { LANGUAGE_TRACKS, contentStats } from "@/content";
import { LanguageCards } from "@/components/world/LanguageRoadmap";
import { STAGES } from "@/components/world/stages";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Language Academy",
  description: "Learn Java, C++, Go and Python from your first program to concurrency, the runtime, libraries, REST APIs and guided projects, with interview questions for each.",
};

const EXTRAS: Record<string, { versions: string; jobs: string }> = {
  java: { versions: "JAVA 25 LTS · SPRING BOOT", jobs: "Backend services at banks, e-commerce and big tech; Android heritage; Kafka, Spark and Elasticsearch are all JVM." },
  cpp: { versions: "C++23 · CMAKE", jobs: "Trading systems, game engines, browsers, databases, embedded, robotics and ML runtimes: anywhere every microsecond and byte counts." },
  go: { versions: "GO 1.24+ · NET/HTTP", jobs: "Cloud infrastructure and backend APIs: Kubernetes, Docker, Terraform and Prometheus are written in Go." },
  python: { versions: "PYTHON 3.12–3.14 · FASTAPI", jobs: "Backend APIs, data engineering, machine learning and AI, automation and DevOps tooling: FastAPI and Django serve the web, PyTorch and pandas power the data work." },
};

// One column per language track, keyed by world id.
const COMPARE: { row: string; cells: Record<string, string> }[] = [
  {
    row: "Learning curve",
    cells: { java: "Gentle to medium: verbose but predictable", cpp: "Steep: you manage lifetimes and undefined behavior", go: "Gentle: 25 keywords, one way to do most things", python: "Gentlest syntax; the depth is in the data model and async" },
  },
  {
    row: "Memory",
    cells: { java: "Garbage collected (G1, ZGC)", cpp: "Manual, made safe with RAII and smart pointers", go: "Garbage collected, low-latency concurrent GC", python: "Reference counting plus a cycle collector" },
  },
  {
    row: "Concurrency",
    cells: { java: "Threads, executors, CompletableFuture, virtual threads", cpp: "std::thread, mutexes, atomics, coroutines", go: "Goroutines and channels, built into the language", python: "asyncio, threads (with the GIL), processes; free-threaded builds" },
  },
  {
    row: "Speed",
    cells: { java: "Fast after JIT warm-up", cpp: "Fastest; zero-cost abstractions", go: "Fast; quick startup, small static binaries", python: "Slowest for pure-Python loops; fast through C libraries like NumPy" },
  },
  {
    row: "Build and deps",
    cells: { java: "Maven or Gradle, Maven Central", cpp: "CMake + vcpkg or Conan", go: "go build + modules, built in", python: "uv or pip, pyproject.toml, PyPI" },
  },
  {
    row: "API frameworks",
    cells: { java: "Spring Boot, Quarkus, Micronaut, Javalin", cpp: "Drogon, Crow, cpp-httplib, Boost.Beast", go: "net/http, chi, Gin, Echo, Fiber", python: "FastAPI, Django + DRF, Flask, Litestar" },
  },
  {
    row: "In coding interviews",
    cells: { java: "Very common; rich collections", cpp: "Common for systems, games, HFT; STL is fast to write", go: "Growing; popular at infra and cloud companies", python: "The most popular choice: concise, with a rich standard library" },
  },
];

export default function LanguagesPage() {
  const extras = Object.fromEntries(
    LANGUAGE_TRACKS.map((w) => {
      const s = contentStats([w]);
      return [w.id, { ...EXTRAS[w.id], projects: w.lessons.filter((l) => l.project).map((l) => l.title), libraries: s.libraries, samples: s.samples }];
    }),
  );
  const total = contentStats(LANGUAGE_TRACKS);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10">
      <SectionTitle eyebrow="Language Academy" title="Learn Java, C++, Go and Python, from zero to interview-ready">
        {total.lessons} chapters, {total.samples} runnable code samples with walkthroughs, {total.projects} guided projects, {total.libraries} libraries explained and {total.interview} interview
        questions. Every program here was compiled and run before it was published.
      </SectionTitle>

      <LanguageCards extras={extras} />

      <section className="pt-16">
        <SectionTitle eyebrow="How a track works" title="Six parts, beginner to job-ready" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((s, i) => (
            <div key={s.id} className="panel relative p-5">
              <div className="absolute top-4 right-4 font-pixel text-[10px] text-faint">0{i + 1}</div>
              <s.icon className="text-cyan" size={22} />
              <h3 className="mt-3 font-display font-semibold text-ink">{s.id}</h3>
              <p className="mt-1 text-sm text-dim">{s.blurb}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-dim">
          Every chapter has a <b className="text-ink">Learn</b> page with explained examples, a <b className="text-ink">Code</b> tab of complete programs with their output and a line-by-line walkthrough,{" "}
          <b className="text-ink">Interview</b> questions with model answers, and a <b className="text-ink">Quiz</b> for XP and stars. Projects add a step-by-step <b className="text-ink">Build</b> tab;
          ecosystem chapters add a searchable <b className="text-ink">Toolbox</b>.
        </p>
      </section>

      <section className="pt-16">
        <SectionTitle eyebrow="Choosing" title="Which language should you learn?">
          All four are excellent. Pick the one your target jobs use. If you have no constraint: Python is the easiest start and the favourite for coding interviews, data and AI; Go is the quickest
          route to cloud and infrastructure work; Java has the most backend jobs; and C++ teaches you how the machine really works.
        </SectionTitle>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 text-xs tracking-wider text-faint uppercase" />
                {LANGUAGE_TRACKS.map((w) => (
                  <th key={w.id} className="px-4 py-3 font-display text-base text-ink">
                    {w.emoji} {w.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.row} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{r.row}</td>
                  {LANGUAGE_TRACKS.map((w) => (
                    <td key={w.id} className="px-4 py-3 text-dim">
                      {r.cells[w.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pt-16">
        <SectionTitle eyebrow="Then practice" title="Turn the language into offers" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: "/challenges", icon: Code2, title: "Coding challenges", text: "Build APIs, an LRU cache, a rate limiter and more, with tested Python, Java and Go solutions.", color: "#7c3aed" },
            { href: "/leetcode-150", icon: Briefcase, title: "LeetCode Top 150", text: "Every problem with a step-through simulation and a Java solution.", color: "#ea580c" },
            { href: "/interview/mock", icon: Timer, title: "Mock interview", text: "Timed rounds that mix language, coding and design questions.", color: "#0d9488" },
          ].map((m) => (
            <Link key={m.href} href={m.href} className="group panel p-5 transition hover:-translate-y-1">
              <m.icon style={{ color: m.color }} />
              <h3 className="mt-3 font-display text-lg font-semibold text-ink">{m.title}</h3>
              <p className="mt-1 text-sm text-dim">{m.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
