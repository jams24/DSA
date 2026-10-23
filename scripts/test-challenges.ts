// Executes every practical-challenge reference solution that declares a `run` mode.
// Run with: npm run challenges:test
//
// Each solution is copied into its own temp directory under a fixed name, next to its test:
//   python            solution.py + check.py; the test does `from solution import ...`
//   python-deps       same, run with $CHALLENGE_PYTHON, an interpreter with fastapi + httpx + pyjwt installed
//   node              solution.cjs + check.cjs; the test does `require("./solution.cjs")`
//   node-deps         same, resolving express + jsonwebtoken from $CHALLENGE_NODE_PATH
//   java              Solution.java (no public top-level types) + Main.java (public class Main)
//   go                solution.go + main.go, both `package main`
//   tsc               component.tsx, type-checked in strict mode against this project's React types
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CHALLENGES } from "../src/content/challenges";
import type { RunMode, Solution } from "../src/content/challenges/types";

const ROOT = resolve(__dirname, "..");
const CODE = join(ROOT, "challenge-code");
const PY = process.env.CHALLENGE_PYTHON ?? "python3";
const NODE_PATH = process.env.CHALLENGE_NODE_PATH ?? "";
const only = process.argv[2];

const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const available: Record<RunMode, boolean> = {
  python: has("python3", ["--version"]),
  "python-deps": has(PY, ["-c", "import fastapi, httpx, jwt"]),
  node: true,
  "node-deps": hasExpress(),
  java: has("javac", ["-version"]),
  go: has("go", ["version"]),
  tsc: true,
};
function hasExpress() {
  try {
    execFileSync("node", ["-e", "require('express'); require('jsonwebtoken')"], { stdio: "ignore", env: { ...process.env, NODE_PATH } });
    return true;
  } catch {
    return false;
  }
}

function runOne(s: Solution, dir: string) {
  const opts = { cwd: dir, stdio: "pipe" as const, timeout: 120_000, env: { ...process.env, NODE_PATH } };
  const put = (from: string | undefined, to: string, fallback = "") => (from ? copyFileSync(join(CODE, from), join(dir, to)) : writeFileSync(join(dir, to), fallback));
  switch (s.run!) {
    case "python":
    case "python-deps":
      put(s.file, "solution.py");
      put(s.test, "check.py");
      execFileSync(s.run === "python-deps" ? PY : "python3", ["check.py"], opts);
      break;
    case "node":
    case "node-deps":
      put(s.file, "solution.cjs");
      put(s.test, "check.cjs", 'require("./solution.cjs");');
      execFileSync("node", ["check.cjs"], opts);
      break;
    case "java":
      put(s.file, "Solution.java");
      put(s.test, "Main.java", "public class Main { public static void main(String[] a) {} }");
      execFileSync("javac", ["-d", "out", "Solution.java", "Main.java"], opts);
      execFileSync("java", ["-ea", "-cp", "out", "Main"], opts);
      break;
    case "go":
      writeFileSync(join(dir, "go.mod"), "module challenge\n\ngo 1.22\n");
      put(s.file, "solution.go");
      put(s.test, "main.go", "package main\n\nfunc main() {}\n");
      execFileSync("go", ["vet", "."], opts);
      execFileSync("go", ["run", "."], opts);
      break;
    case "tsc":
      put(s.file, "component.tsx");
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            noUnusedLocals: true,
            jsx: "react-jsx",
            module: "esnext",
            moduleResolution: "bundler",
            target: "ES2022",
            lib: ["dom", "dom.iterable", "esnext"],
            skipLibCheck: true,
            types: [],
            paths: {
              react: [join(ROOT, "node_modules/@types/react")],
              "react/*": [join(ROOT, "node_modules/@types/react/*")],
              "react-dom": [join(ROOT, "node_modules/@types/react-dom")],
              "react-dom/*": [join(ROOT, "node_modules/@types/react-dom/*")],
            },
          },
          files: ["component.tsx"],
        }),
      );
      execFileSync(join(ROOT, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], opts);
      break;
  }
}

let passed = 0;
let skipped = 0;
const failures: string[] = [];
for (const c of CHALLENGES) {
  if (only && c.slug !== only) continue;
  for (const s of c.solutions) {
    if (!s.run) continue;
    const name = `${c.slug} · ${s.label}`;
    if (!available[s.run]) {
      skipped++;
      console.log(`- skip ${name} (${s.run} toolchain not available)`);
      continue;
    }
    const dir = mkdtempSync(join(tmpdir(), "challenge-"));
    try {
      runOne(s, dir);
      passed++;
      console.log(`✓ ${name}`);
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer; message: string };
      failures.push(`${name}\n${(err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? err.message)}`.trim());
      console.log(`✗ ${name}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
for (const f of failures) console.log(`\n✗ ${f}`);
console.log(`\n${passed} passed, ${failures.length} failed, ${skipped} skipped`);
process.exit(failures.length ? 1 : 0);
