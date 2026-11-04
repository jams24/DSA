// Compiles and runs the Java, C++, Go and Python programs in the Language Academy, and the C, Python
// and shell samples in the Operating Systems and Compilers worlds.
// Run with: npm run languages:test [filter]     (filter matches "<world>/<lesson>", e.g. "os/" or "python/py-web")
//
// Code samples: every java / cpp / go variant that has an entry point, and every python variant, is
// compiled and run. When the sample declares `output`, stdout must match it exactly (trailing
// whitespace ignored). Samples with `noCheck` are skipped and the reason is printed. Python samples
// that define test_ functions run under pytest instead, and ones importing a third-party package that
// isn't installed are skipped with the package name.
//
// Projects: the latest version of every file across the steps is written to a temp directory and
// the project's `verify` command runs there (bash). It's skipped when a tool it needs is missing. A project
// that `buildsOn` an earlier lesson's project starts from that project's finished files.
//
// Toolchains (override with env vars):
//   LANG_JAVA     java launcher, JDK 21+ (default: java)
//   LANG_CXX      C++23 compiler command (default: clang++ -std=c++23)
//   LANG_GO       go (default: go)
//   LANG_PYTHON   Python 3.12+ interpreter (default: python3); point it at a virtualenv to run the samples
//                 that use third-party packages (pydantic, pytest, httpx, SQLAlchemy, numpy, pandas ...)
//   LANG_CC       C compiler (default: cc)
//   LANG_CLANG    clang, used to compile and run LLVM IR (.ll) samples and the compiler project (default: clang)
//   LANG_LINUX_IMAGE  samples and projects marked `linux` (they use /proc, epoll, namespaces ...) run natively on
//                 Linux; elsewhere they run in this Docker image if it's set (any local image with gcc, bash
//                 and python3, e.g. node:20 or gcc:14; never pulled), and are skipped otherwise
//   LANG_NET=1    also run samples/projects marked as needing the network (third-party deps)
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { WORLDS } from "../src/content";
import type { CodeSample, Lesson, World } from "../src/content/types";

/** Core worlds whose code samples are runnable programs (the language tracks are always included). */
const CODE_WORLDS = new Set(["os", "compilers"]);

const JAVA = process.env.LANG_JAVA ?? "java";
const CXX = (process.env.LANG_CXX ?? "clang++ -std=c++23").split(" ");
const GO = process.env.LANG_GO ?? "go";
const PY = process.env.LANG_PYTHON ?? "python3";
const CC = (process.env.LANG_CC ?? "cc").split(" ");
const CLANG = (process.env.LANG_CLANG ?? "clang").split(" ");
const LINUX = process.platform === "linux";
const LINUX_IMAGE = process.env.LANG_LINUX_IMAGE;
const C_FLAGS = ["-std=gnu17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-pthread"];
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
const tools = {
  java: has(JAVA, ["-version"]),
  cpp: has(CXX[0], ["--version"]),
  go: has(GO, ["version"]),
  python: has(PY, ["--version"]),
  c: has(CC[0], ["--version"]),
  llvm: has(CLANG[0], ["--version"]),
  bash: true,
};
const docker = (() => {
  if (LINUX || !LINUX_IMAGE) return false;
  try {
    return execFileSync("docker", ["images", "-q", LINUX_IMAGE], { encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
})();

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
  if (lang === "c") return /\bint\s+main\s*\(/.test(code);
  if (lang === "llvm") return /^define\s[^@\n]*@main\(/m.test(code);
  if (lang === "python" || lang === "bash") return true;
  return false;
}

/** Run a shell command in the Linux image with `dir` mounted at /w (no network, image never pulled). */
function runInLinux(dir: string, cmd: string, privileged = false): string {
  if (!docker) return run("bash", ["-c", cmd], dir);
  const args = ["run", "--rm", "--pull", "never", "--network", "none", ...(privileged ? ["--privileged"] : []), "-v", `${dir}:/w`, "-w", "/w"];
  return run("docker", [...args, LINUX_IMAGE!, "bash", "-c", cmd], dir);
}

function runLinuxSample(lang: string, code: string, dir: string, privileged = false): string {
  const file = lang === "c" ? "main.c" : lang === "python" ? "main.py" : "main.sh";
  writeFileSync(join(dir, file), code);
  const cmd = lang === "c" ? `gcc ${C_FLAGS.join(" ")} main.c -o main && ./main` : lang === "python" ? "python3 main.py" : "bash main.sh";
  return runInLinux(dir, cmd, privileged);
}

function runSample(lang: string, code: string, dir: string): string {
  if (lang === "llvm") {
    writeFileSync(join(dir, "main.ll"), code);
    run(CLANG[0], [...CLANG.slice(1), "-Wno-override-module", "main.ll", "-o", "main"], dir);
    return run(join(dir, "main"), [], dir);
  }
  if (lang === "c") {
    writeFileSync(join(dir, "main.c"), code);
    run(CC[0], [...CC.slice(1), ...C_FLAGS, "main.c", "-o", "main"], dir);
    return run(join(dir, "main"), [], dir);
  }
  if (lang === "bash") {
    writeFileSync(join(dir, "main.sh"), code);
    return run("bash", ["main.sh"], dir);
  }
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

function checkSample(where: string, s: CodeSample, world: string) {
  for (const v of s.variants) {
    const runnable = ["java", "cpp", "go", "python"].includes(v.lang) || (CODE_WORLDS.has(world) && ["c", "bash", "llvm"].includes(v.lang));
    if (!runnable || !hasMain(v.lang, v.code)) continue;
    if (v.lang === "bash" && !s.linux) continue; // shell snippets in other samples are commands to read, not programs
    const label = `${where} · "${s.title}"${s.variants.length > 1 ? ` [${v.lang}]` : ""}`;
    if (s.noCheck && !(NET && s.noCheck.startsWith("net:"))) {
      skipped++;
      console.log(`  ⏭  ${label}: ${s.noCheck}`);
      continue;
    }
    if (s.linux && !LINUX && !docker) {
      skipped++;
      console.log(`  ⏭  ${label}: Linux only (set LANG_LINUX_IMAGE to a local Docker image with gcc and python3)`);
      continue;
    }
    if (s.privileged && !docker && process.getuid?.() !== 0) {
      skipped++;
      console.log(`  ⏭  ${label}: needs root (run as root, or use LANG_LINUX_IMAGE with Docker)`);
      continue;
    }
    if (!s.linux && !tools[v.lang as keyof typeof tools]) {
      skipped++;
      console.log(`  ⏭  ${label}: no ${v.lang} toolchain`);
      continue;
    }
    if (v.lang === "python" && !s.linux && s.minPython && olderPython(s.minPython)) {
      skipped++;
      console.log(`  ⏭  ${label}: needs Python ${s.minPython}+ (${PY} is ${pyVersion.join(".")})`);
      continue;
    }
    if (v.lang === "python" && !s.linux) {
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
      const out = s.linux ? runLinuxSample(v.lang, v.code, dir, s.privileged) : runSample(v.lang, v.code, dir);
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

function checkProject(where: string, l: Lesson, w: World) {
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
  if (p.linux && !LINUX && !docker) {
    skipped++;
    console.log(`  ⏭  ${label}: Linux only (set LANG_LINUX_IMAGE)`);
    return;
  }
  const cmd = p.verify.replace(/^net:\s*/, "");
  const tool = cmd.trim().split(/\s+/)[0];
  if (["mvn", "cmake"].includes(tool) && !has(tool, ["--version"])) {
    skipped++;
    console.log(`  ⏭  ${label}: ${tool} not installed`);
    return;
  }
  if (cmd.includes("$CLANG_CMD") && !tools.llvm) {
    skipped++;
    console.log(`  ⏭  ${label}: clang not installed (set LANG_CLANG)`);
    return;
  }
  const files = new Map<string, string>();
  const chain: NonNullable<Lesson["project"]>[] = [];
  for (let q: Lesson["project"] = p; q; q = q.buildsOn ? w.lessons.find((x) => x.id === q!.buildsOn)?.project : undefined) chain.unshift(q);
  for (const q of chain) for (const st of q.steps) for (const f of st.files) files.set(f.path, f.code);
  const dir = mkdtempSync(join(tmpdir(), "proj-"));
  try {
    for (const [path, code] of files) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), code.endsWith("\n") ? code : `${code}\n`);
    }
    if (p.linux) {
      runInLinux(dir, cmd.replaceAll("$CC_CMD", "gcc").replaceAll("$PY_CMD", "python3"));
      passed++;
      console.log(`  ✓ ${label} (${files.size} files, Linux)`);
      return;
    }
    execSync(cmd, {
      cwd: dir,
      shell: "/bin/bash",
      stdio: "pipe",
      timeout: 600_000,
      env: { ...process.env, JAVA_CMD: JAVA, CXX_CMD: CXX.join(" "), GO_CMD: GO, PY_CMD: PY, CC_CMD: CC.join(" "), CLANG_CMD: CLANG.join(" "), PYTHONDONTWRITEBYTECODE: "1" },
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

for (const w of WORLDS.filter((w) => w.track === "language" || CODE_WORLDS.has(w.id))) {
  if (only && !w.lessons.some((l) => `${w.id}/${l.id}`.includes(only))) continue;
  console.log(`${w.emoji} ${w.title}`);
  for (const l of w.lessons) {
    const where = `${w.id}/${l.id}`;
    if (only && !where.includes(only)) continue;
    for (const s of l.code ?? []) checkSample(where, s, w.id);
    if (l.project) checkProject(where, l, w);
  }
}

console.log(`\n${passed} passed, ${skipped} skipped, ${failures.length} failed`);
if (failures.length) {
  console.error(`\n${failures.join("\n\n")}`);
  process.exit(1);
}
