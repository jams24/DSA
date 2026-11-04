// Compiles and runs the Java, C++, Go and Python programs in the Language Academy.
// Run with: npm run languages:test [filter]
//
// Code samples: every java / cpp / go variant that has an entry point, and every python variant, is
// compiled and run. When the sample declares `output`, stdout must match it exactly (trailing
// whitespace ignored). Samples with `noCheck` are skipped and the reason is printed. Python samples
// that define test_ functions run under pytest instead, and ones importing a third-party package that
// isn't installed are skipped with the package name.
//
// Projects: the latest version of every file across the steps is written to a temp directory and
// the project's `verify` command runs there (bash). It's skipped when a tool it needs is missing.
//
// Toolchains (override with env vars):
//   LANG_JAVA     java launcher, JDK 21+ (default: java)
//   LANG_CXX      C++23 compiler command (default: clang++ -std=c++23)
//   LANG_GO       go (default: go)
//   LANG_PYTHON   Python 3.12+ interpreter (default: python3); point it at a virtualenv to run the samples
//                 that use third-party packages (pydantic, pytest, httpx, SQLAlchemy, numpy, pandas ...)
//   LANG_NET=1    also run samples/projects marked as needing the network (third-party deps)
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LANGUAGE_TRACKS } from "../src/content";
import type { CodeSample, Lesson } from "../src/content/types";

const JAVA = process.env.LANG_JAVA ?? "java";
const CXX = (process.env.LANG_CXX ?? "clang++ -std=c++23").split(" ");
const GO = process.env.LANG_GO ?? "go";
const PY = process.env.LANG_PYTHON ?? "python3";
const NET = process.env.LANG_NET === "1";
const only = process.argv[2];

const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const pyVersion = (() => {
  try {
    return execFileSync(PY, ["-c", "import sys; print(*sys.version_info[:2])"], { encoding: "utf8" }).trim().split(" ").map(Number);
  } catch {
    return [0, 0];
  }
})();
const olderPython = (min: string) => {
  const [a, b] = min.split(".").map(Number);
  return pyVersion[0] < a || (pyVersion[0] === a && pyVersion[1] < b);
};
const tools = { java: has(JAVA, ["-version"]), cpp: has(CXX[0], ["--version"]), go: has(GO, ["version"]), python: has(PY, ["--version"]) };

const norm = (s: string) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");

function run(cmd: string, args: string[], cwd: string, input?: string) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 120_000,
    input,
    env: { ...process.env, GOFLAGS: "-mod=mod", PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1" },
  });
}

const isPytest = (code: string) => /^(?:async\s+)?def test_|^class Test/m.test(code);

/** Top-level packages a Python sample imports that the interpreter can't find (stdlib excluded). */
function missingPythonModules(code: string): string[] {
  const mods = new Set<string>();
  for (const m of code.matchAll(/^\s*(?:from\s+([\w.]+)\s+import\b|import\s+([\w.]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.]+(?:\s+as\s+\w+)?)*))/gm)) {
    if (m[1]?.startsWith(".")) continue;
    for (const part of (m[1] ?? m[2]).split(",")) mods.add(part.trim().split(/\s+/)[0].split(".")[0]);
  }
  if (!mods.size) return [];
  const probe = "import sys, importlib.util\nprint(' '.join(m for m in sys.argv[1:] if m not in sys.stdlib_module_names and importlib.util.find_spec(m) is None))";
  return execFileSync(PY, ["-c", probe, ...mods], { encoding: "utf8" }).trim().split(/\s+/).filter(Boolean);
}

function hasMain(lang: string, code: string) {
  if (lang === "java") return /static\s+void\s+main\s*\(|^\s*void\s+main\s*\(/m.test(code);
  if (lang === "cpp") return /\bint\s+main\s*\(/.test(code);
  if (lang === "go") return /^package main\b/m.test(code) && /^func main\(\)/m.test(code);
  if (lang === "python") return true;
  return false;
}

function runSample(lang: string, code: string, dir: string): string {
  if (lang === "java") {
    // source-file mode runs the first top-level class; name the file after it so javac's public-class rule holds
    const file = `${/^public\s+(?:final\s+|abstract\s+|sealed\s+)*(?:class|record|interface|enum)\s+(\w+)/m.exec(code)?.[1] ?? "Main"}.java`;
    writeFileSync(join(dir, file), code);
    return run(JAVA, [file], dir);
  }
  if (lang === "cpp") {
    writeFileSync(join(dir, "main.cpp"), code);
    run(CXX[0], [...CXX.slice(1), "-Wall", "-Wextra", "-Werror", "-g", "-fsanitize=address,undefined", "-pthread", "main.cpp", "-o", "main"], dir);
    return run(join(dir, "main"), [], dir);
  }
  if (lang === "python") {
    if (isPytest(code)) {
      writeFileSync(join(dir, "test_sample.py"), code);
      return run(PY, ["-m", "pytest", "-q", "-p", "no:cacheprovider", "test_sample.py"], dir);
    }
    writeFileSync(join(dir, "main.py"), code);
    return run(PY, ["main.py"], dir);
  }
  writeFileSync(join(dir, "go.mod"), "module sample\n\ngo 1.24\n");
  writeFileSync(join(dir, "main.go"), code);
  if (/^import \(|^import "/m.test(code) && /"[a-z0-9.-]+\.[a-z]+\//.test(code)) run(GO, ["mod", "tidy"], dir);
  run(GO, ["vet", "."], dir);
  return run(GO, ["run", "."], dir);
}

let passed = 0;
let skipped = 0;
const failures: string[] = [];

function checkSample(where: string, s: CodeSample) {
  for (const v of s.variants) {
    if (!["java", "cpp", "go", "python"].includes(v.lang) || !hasMain(v.lang, v.code)) continue;
    const label = `${where} · "${s.title}"`;
    if (s.noCheck && !(NET && s.noCheck.startsWith("net:"))) {
      skipped++;
      console.log(`  ⏭  ${label}: ${s.noCheck}`);
      continue;
    }
    if (!tools[v.lang as keyof typeof tools]) {
      skipped++;
      console.log(`  ⏭  ${label}: no ${v.lang} toolchain`);
      continue;
    }
    if (v.lang === "python" && s.minPython && olderPython(s.minPython)) {
      skipped++;
      console.log(`  ⏭  ${label}: needs Python ${s.minPython}+ (${PY} is ${pyVersion.join(".")})`);
      continue;
    }
    if (v.lang === "python") {
      const missing = missingPythonModules(v.code);
      if (missing.length) {
        skipped++;
        console.log(`  ⏭  ${label}: needs ${missing.join(", ")} (not installed for ${PY})`);
        continue;
      }
    }
    const pytest = v.lang === "python" && isPytest(v.code);
    const dir = mkdtempSync(join(tmpdir(), "lang-"));
    try {
      const out = runSample(v.lang, v.code, dir);
      if (pytest) {
        passed++;
        console.log(`  ✓ ${label} (pytest: ${out.trim().split("\n").pop()})`);
      } else if (s.output !== undefined && norm(out) !== norm(s.output)) {
        failures.push(`${label}: output differs\n--- expected\n${norm(s.output)}\n--- actual\n${norm(out)}`);
        console.log(`  ✗ ${label}`);
      } else {
        passed++;
        console.log(`  ✓ ${label}${s.output === undefined ? " (ran, output not pinned)" : ""}`);
      }
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      failures.push(`${label}: ${(err.stderr || err.stdout || err.message).slice(0, 2500)}`);
      console.log(`  ✗ ${label}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

function checkProject(where: string, l: Lesson) {
  const p = l.project!;
  const label = `${where} · project`;
  if (!p.verify) {
    skipped++;
    console.log(`  ⏭  ${label}: no verify command`);
    return;
  }
  if (p.verify.startsWith("net:") && !NET) {
    skipped++;
    console.log(`  ⏭  ${label}: needs the network (LANG_NET=1)`);
    return;
  }
  if (p.requires?.length) {
    const probe = "import sys, importlib.util\nprint(' '.join(m for m in sys.argv[1:] if importlib.util.find_spec(m) is None))";
    const missing = tools.python ? execFileSync(PY, ["-c", probe, ...p.requires], { encoding: "utf8" }).trim() : "python";
    if (missing) {
      skipped++;
      console.log(`  ⏭  ${label}: needs ${missing.split(/\s+/).join(", ")} (not installed for ${PY})`);
      return;
    }
  }
  const cmd = p.verify.replace(/^net:\s*/, "");
  const tool = cmd.trim().split(/\s+/)[0];
  if (["mvn", "cmake"].includes(tool) && !has(tool, ["--version"])) {
    skipped++;
    console.log(`  ⏭  ${label}: ${tool} not installed`);
    return;
  }
  const files = new Map<string, string>();
  for (const st of p.steps) for (const f of st.files) files.set(f.path, f.code);
  const dir = mkdtempSync(join(tmpdir(), "proj-"));
  try {
    for (const [path, code] of files) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), code.endsWith("\n") ? code : `${code}\n`);
    }
    execSync(cmd, {
      cwd: dir,
      shell: "/bin/bash",
      stdio: "pipe",
      timeout: 600_000,
      env: { ...process.env, JAVA_CMD: JAVA, CXX_CMD: CXX.join(" "), GO_CMD: GO, PY_CMD: PY, PYTHONDONTWRITEBYTECODE: "1" },
    });
    passed++;
    console.log(`  ✓ ${label} (${files.size} files)`);
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message: string };
    failures.push(`${label}: ${(err.stderr?.toString() || "") + (err.stdout?.toString() || "") || err.message}`.slice(0, 4000));
    console.log(`  ✗ ${label}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const w of LANGUAGE_TRACKS) {
  console.log(`${w.emoji} ${w.title}`);
  for (const l of w.lessons) {
    const where = `${w.id}/${l.id}`;
    if (only && !where.includes(only)) continue;
    for (const s of l.code ?? []) checkSample(where, s);
    if (l.project) checkProject(where, l);
  }
}

console.log(`\n${passed} passed, ${skipped} skipped, ${failures.length} failed`);
if (failures.length) {
  console.error(`\n${failures.join("\n\n")}`);
  process.exit(1);
}
