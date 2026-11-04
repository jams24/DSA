import type { Lesson } from "../types";

// Python track, part 1: Foundations.

export const pyFoundations: Lesson[] = [
  // ------------------------------------------------------------------ GETTING STARTED
  {
    id: "py-start",
    stage: "Foundations",
    title: "Getting started: how Python runs your code",
    tagline: "Install Python, run your first script, and understand the interpreter, bytecode, virtual environments, pip and uv, and how a real project is laid out.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "From main.py to a running program (CPython)",
      nodes: [
        { id: "src", label: "main.py", kind: "client", x: 90, y: 280, sub: "your source code" },
        { id: "parser", label: "Parser", kind: "service", x: 290, y: 280, sub: "text → tokens → AST" },
        { id: "compiler", label: "Compiler", kind: "service", x: 490, y: 280, sub: "AST → bytecode" },
        { id: "pyc", label: "__pycache__", kind: "storage", x: 490, y: 470, sub: ".pyc bytecode cache" },
        { id: "vm", label: "Interpreter loop", kind: "worker", x: 700, y: 280, sub: "runs bytecode, specializes hot code" },
        { id: "venv", label: ".venv", kind: "registry", x: 700, y: 90, sub: "site-packages for this project" },
        { id: "pypi", label: "PyPI", kind: "external", x: 920, y: 90, sub: "pip / uv install" },
        { id: "os", label: "OS + CPU", kind: "control", x: 910, y: 420, sub: "memory, files, sockets" },
      ],
      edges: [
        { from: "src", to: "parser", label: "read" },
        { from: "parser", to: "compiler", label: "AST" },
        { from: "compiler", to: "vm", label: "code objects" },
        { from: "compiler", to: "pyc", label: "cache imports", dashed: true },
        { from: "pyc", to: "vm", label: "reuse if unchanged" },
        { from: "vm", to: "venv", label: "import: search sys.path" },
        { from: "venv", to: "compiler", label: "module source" },
        { from: "pypi", to: "venv", label: "wheels" },
        { from: "vm", to: "os", label: "system calls" },
      ],
      flows: [
        {
          name: "python main.py",
          path: ["src", "parser", "compiler", "vm", "os"],
          steps: [
            "CPython reads main.py and the parser turns the text into tokens and then an abstract syntax tree. Syntax errors (a missing colon, bad indentation) are reported here, before anything runs.",
            "The compiler turns the AST into bytecode: simple stack-machine instructions grouped into code objects (one per module, function and class body).",
            "The interpreter loop executes the bytecode instruction by instruction. Since 3.11 it rewrites hot instructions into faster versions specialized for the types it sees.",
            "Built-in operations end up in C code that talks to the operating system: printing, reading files, opening sockets.",
          ],
        },
        {
          name: "import requests",
          path: ["vm", "venv", "compiler", "pyc", "vm"],
          steps: [
            "An import statement asks the import system to search the directories in sys.path: your project, the standard library, then the active environment's site-packages.",
            "The first time, the module's source is compiled to bytecode like your own code.",
            "The bytecode is written to __pycache__/*.pyc, so the next start can skip parsing and compiling if the source hasn't changed.",
            "The module's top-level code runs once, and the module object is cached in sys.modules: importing it again anywhere is just a dictionary lookup.",
          ],
        },
        {
          name: "uv add requests",
          path: ["pypi", "venv", "compiler", "vm"],
          steps: [
            "uv (or pip) resolves versions, downloads a wheel (a zip of ready-to-use files, possibly with compiled C extensions) from PyPI and unpacks it into .venv/lib/python3.x/site-packages.",
            "Nothing is compiled at install time for pure-Python packages: the next import compiles the source to bytecode on demand.",
            "Your code can now import requests. Other projects never see it, because each has its own virtual environment.",
          ],
        },
      ],
    },
    concept: `
## Why Python?
Python is the most used programming language in the world for a reason: it reads almost like pseudocode, it has a library for everything, and the same language runs a five-line script, a Django web app serving millions of users (Instagram), a data pipeline, or the training loop of a large AI model. You'll meet it in backend development, data engineering, machine learning, automation, DevOps tooling and scientific computing. In interviews, Python is the fastest language to write correct solutions in: no type declarations, built-in lists, dicts, sets, heaps and big integers.

The trade-off: Python is **interpreted and dynamically typed**, so pure-Python code runs slower than Java, Go or C++ (often 10–100x on tight loops). In practice the heavy lifting is done by libraries written in C, C++ or Rust (NumPy, pandas, PyTorch, pydantic-core, orjson), and Python becomes the glue.

## Install and check
This track uses **Python 3.12 or newer** (3.14 is current). Get it from python.org, your package manager (\`brew install python\`), or let **uv** manage versions for you:
\`\`\`bash
python3 --version            # Python 3.14.x
uv python install 3.14       # uv can download and manage interpreters
python3                      # the REPL: type code, see results (exit() or Ctrl-D to leave)
python3 hello.py alice bob   # run a script with arguments
python3 -m http.server 8000  # -m runs a module as a script (here: a file server)
\`\`\`
Editor: VS Code with the Python + Pylance extensions, or PyCharm.

## How Python runs your code
"Python" the language is implemented by **CPython**, the reference interpreter written in C (there are others: PyPy with a JIT, MicroPython for microcontrollers). CPython never turns your program into machine code ahead of time:
1. The **parser** turns source text into an abstract syntax tree (AST).
2. The **compiler** turns the AST into **bytecode**: simple instructions for a stack-based virtual machine, stored in *code objects*. For imported modules the bytecode is cached in \`__pycache__/*.pyc\` so the next start is faster.
3. The **interpreter loop** (in \`ceval.c\`) executes the bytecode one instruction at a time. Since 3.11 it *specializes* hot instructions for the types it actually sees, which made Python 10–60% faster; 3.13 added an experimental JIT.

Errors like a wrong type or a misspelled name are found only when that line runs. That's why tests, linters (ruff) and type checkers (mypy) matter so much in Python.

## Virtual environments: one per project
Installing packages globally leads to version clashes between projects. A **virtual environment** is a folder with its own \`site-packages\`; activate it and \`pip\` installs there:
\`\`\`bash
python3 -m venv .venv          # create
source .venv/bin/activate      # activate (Windows: .venv\\Scripts\\activate)
pip install requests           # installs into .venv only
pip freeze > requirements.txt  # pin what you installed
deactivate
\`\`\`
**uv** (from Astral, written in Rust) does the same 10–100x faster and manages the whole project:
\`\`\`bash
uv init myapp && cd myapp      # pyproject.toml + .python-version + hello.py
uv add requests                # adds to pyproject.toml, updates uv.lock, syncs .venv
uv run main.py                 # runs inside the project's environment
\`\`\`
Packages come from **PyPI**, the Python Package Index (600,000+ projects).

## A real project layout
\`\`\`text
myapp/
  pyproject.toml        # name, version, dependencies, tool settings (ruff, pytest, mypy)
  src/myapp/__init__.py # makes the folder a package
  src/myapp/cli.py
  tests/test_cli.py
\`\`\`
- A **module** is one \`.py\` file; a **package** is a folder of modules (with \`__init__.py\`).
- \`import myapp.cli\` runs that file's top-level code once and caches it in \`sys.modules\`.
- \`if __name__ == "__main__":\` is true only when the file is run directly, so the same file can be both a script and an importable module.

## Style: PEP 8, enforced by tools
Indentation is part of the syntax (4 spaces per level; never tabs). Names are \`snake_case\` for functions and variables, \`PascalCase\` for classes and \`UPPER_CASE\` for constants. Don't argue about formatting: run **ruff** (\`ruff format\` + \`ruff check\`), the formatter and linter most projects now use.

## Python compared with Java and Go
| | Python | Java / Go |
|---|---|---|
| Typing | Dynamic: names have no type; optional type hints checked by tools | Static: the compiler checks types |
| Running | Interpreted bytecode | Compiled (JVM bytecode + JIT / native binary) |
| Blocks | Indentation | Braces |
| Memory | Reference counting + cycle-collecting GC | Tracing GC |
| Concurrency | Threads limited by the GIL, multiprocessing, asyncio | Real parallel threads / goroutines |
`,
    keyPoints: [
      "CPython compiles source to bytecode, then an interpreter loop executes it",
      "Imported modules are cached as .pyc files and in sys.modules",
      "Errors like a wrong type surface only when that line runs: test and lint",
      "One virtual environment per project; packages come from PyPI via pip or uv",
      "Indentation is syntax: 4 spaces per level, formatted by ruff",
      "if __name__ == \"__main__\": lets a file be both a script and a module",
    ],
    code: [
      {
        title: "Hello, Python",
        variants: [{ lang: "python", code: `import sys


def main() -> None:
    print("Hello, Python!")

    name = "pythonista"  # no declaration and no type: assignment binds a name to an object
    print(f"Hello, {name}! Your name has {len(name)} letters.")
    print(name.upper(), name.title(), "py" * 3)

    if len(sys.argv) > 1:  # sys.argv[0] is the script's own name
        print("arguments:", sys.argv[1:])
    else:
        print("no arguments: try  python hello.py alice bob")

    print("Python 3.12 or newer:", sys.version_info >= (3, 12))


if __name__ == "__main__":  # true when run as a script, false when imported as a module
    main()` }],
        explain: `- \`import sys\` loads a standard-library module; its functions and data are accessed as \`sys.something\`.
- \`def main() -> None:\` defines a function. The colon opens a block and **indentation** (4 spaces) marks what belongs to it: no braces, no semicolons. \`-> None\` is a type hint saying the function returns nothing.
- \`name = "pythonista"\` creates a string object and binds a name to it. There's no declaration and no type.
- An **f-string** (\`f"..."\`) evaluates the expressions inside \`{}\`: \`len(name)\` is 10.
- Strings come with methods: \`upper()\`, \`title()\`; \`"py" * 3\` repeats a string.
- \`sys.argv\` is the list of command-line arguments; slicing \`[1:]\` skips the script name. Run \`python3 hello.py alice bob\` and you'll see \`arguments: ['alice', 'bob']\`.
- \`sys.version_info >= (3, 12)\` compares tuples element by element, a handy way to check the version.
- The last two lines are the standard entry point: when you run the file, Python sets \`__name__\` to \`"__main__"\`; when another module imports it, \`__name__\` is \`"hello"\` and \`main()\` doesn't run.`,
        output: `Hello, Python!
Hello, pythonista! Your name has 10 letters.
PYTHONISTA Pythonista pypypy
no arguments: try  python hello.py alice bob
Python 3.12 or newer: True`,
      },
      {
        title: "What the interpreter actually runs: bytecode",
        note: "The disassembly differs between Python versions, so this sample's output isn't shown.",
        variants: [{ lang: "python", code: `import dis


def average(numbers: list[float]) -> float:
    total = sum(numbers)
    return total / len(numbers)


print(average([3, 4, 5]))

code = average.__code__  # the compiled code object behind the function
print("parameters:", code.co_varnames[: code.co_argcount])
print("local names:", code.co_varnames)
print("global/builtin names:", code.co_names)
print("annotations are just data:", average.__annotations__)

dis.dis(average)  # the bytecode the interpreter loop executes (opcodes differ between versions)` }],
        explain: `Every function has a **code object** (\`func.__code__\`) holding its bytecode, constants and names. The first lines print 4.0 and then the names the compiler recorded:
\`\`\`text
parameters: ('numbers',)
local names: ('numbers', 'total')
global/builtin names: ('sum', 'len')
annotations are just data: {'numbers': list[float], 'return': <class 'float'>}
\`\`\`
Then \`dis.dis\` disassembles the bytecode. On Python 3.14:
\`\`\`text
  4           RESUME                   0

  5           LOAD_GLOBAL              1 (sum + NULL)
              LOAD_FAST_BORROW         0 (numbers)
              CALL                     1
              STORE_FAST               1 (total)

  6           LOAD_FAST_BORROW         1 (total)
              LOAD_GLOBAL              3 (len + NULL)
              LOAD_FAST_BORROW         0 (numbers)
              CALL                     1
              BINARY_OP               11 (/)
              RETURN_VALUE
\`\`\`
Read it as a stack machine: push \`sum\`, push \`numbers\`, call with 1 argument, store the result in the local slot \`total\`. Two things to notice:
- **Locals** (\`LOAD_FAST\`) are array slots, while **globals and built-ins** (\`LOAD_GLOBAL\`) need dictionary lookups. That's why code inside functions runs faster than the same code at module level.
- Type hints are stored in \`__annotations__\` but never checked: \`average(["a"])\` would only fail inside \`sum\`.`,
      },
      {
        title: "Batteries included: the standard library",
        variants: [{ lang: "python", code: `# "Batteries included": everything here ships with Python. No installs.
import json
import math
import random
import statistics
from collections import Counter
from datetime import date, timedelta
from pathlib import PurePosixPath

print(math.sqrt(16), math.isqrt(17), math.comb(5, 2), round(math.pi, 4))
print(2**100)  # ints never overflow: they grow as needed

rng = random.Random(42)  # a seeded generator gives the same "random" sequence every run
rolls = [rng.randint(1, 6) for _ in range(10)]
print("rolls:", rolls, "mean:", statistics.mean(rolls))

words = "the quick brown fox jumps over the lazy dog the end".split()
print(Counter(words).most_common(2))

launch = date(2026, 1, 15)
print(launch + timedelta(days=30), launch.strftime("%A"))

path = PurePosixPath("/srv/app/logs/access.log.gz")
print(path.name, path.suffixes, path.parent)

order = {"id": 7, "items": ["book", "pen"], "paid": True, "coupon": None}
text = json.dumps(order)
print(text)
print(json.loads(text) == order)` }],
        explain: `Python ships with a huge standard library. A taste:
- \`math\` for functions (\`isqrt\` is the integer square root, \`comb(5, 2)\` counts combinations) and \`2**100\` shows that ints grow without overflowing.
- \`random.Random(42)\` is a generator with a fixed **seed**: the same "random" numbers every run, which makes tests and simulations reproducible. \`statistics\` has mean, median, stdev and quantiles.
- \`collections.Counter\` counts anything iterable.
- \`datetime\` does date arithmetic: 30 days after 15 January 2026 is 14 February, and \`strftime("%A")\` names the weekday.
- \`pathlib\` treats paths as objects: name, suffixes and parent without string slicing.
- \`json.dumps\`/\`json.loads\` convert between Python objects and JSON text (\`True\` becomes \`true\`, \`None\` becomes \`null\`).`,
        output: `4.0 4 10 3.1416
1267650600228229401496703205376
rolls: [6, 1, 1, 6, 3, 2, 2, 2, 6, 1] mean: 3
[('the', 3), ('quick', 1)]
2026-02-14 Thursday
access.log.gz ['.log', '.gz'] /srv/app/logs
{"id": 7, "items": ["book", "pen"], "paid": true, "coupon": null}
True`,
      },
    ],
    interview: [
      {
        q: "Is Python compiled or interpreted?",
        a: `Both, in stages. CPython **compiles** source code to **bytecode** (cached in \`__pycache__/*.pyc\` for imported modules), then **interprets** that bytecode in a virtual-machine loop. Nothing is compiled to machine code ahead of time, unlike Go or C++. Since 3.11 the interpreter specializes hot bytecode for the types it observes, and 3.13 added an experimental JIT. Other implementations differ: PyPy has a tracing JIT and is often several times faster on pure-Python loops.`,
        freq: "very-common",
      },
      {
        q: "What does if __name__ == \"__main__\": do?",
        a: `Every module has a \`__name__\`. When you run a file directly, Python sets it to \`"__main__"\`; when the file is imported, it's the module's name. Putting the entry-point call under this check lets the same file work as a script **and** as an importable module, without running the script's side effects on import (which also matters for \`multiprocessing\`, which re-imports the main module in child processes).`,
        freq: "very-common",
      },
      {
        q: "What is a virtual environment, and why use one?",
        a: `A directory with its own \`site-packages\` (and a link to an interpreter). Activating it makes \`python\` and \`pip\` use that directory, so each project gets its own dependency versions without conflicts or admin rights. Create it with \`python -m venv .venv\` or let \`uv\` manage it; record dependencies in \`pyproject.toml\` with a lock file (\`uv.lock\`) or \`requirements.txt\` so builds are reproducible.`,
        freq: "common",
      },
      {
        q: "What's the difference between a module and a package?",
        a: `A **module** is a single \`.py\` file (or a compiled extension); a **package** is a directory of modules, normally with an \`__init__.py\` that runs when the package is imported. Imports are cached in \`sys.modules\`, so a module's top-level code runs once per process. A **distribution** (what \`pip install\` fetches from PyPI, as a wheel) can contain several packages.`,
        freq: "common",
      },
      {
        q: "What is PEP 8 and how do teams enforce it?",
        a: `PEP 8 is Python's style guide: 4-space indentation, \`snake_case\` for functions and variables, \`PascalCase\` for classes, \`UPPER_CASE\` for constants, a line limit (79 in the PEP; most teams use 88–120), imports at the top. Teams enforce it automatically with a formatter and a linter, typically **ruff** (or black + flake8) running in pre-commit hooks and CI, so code review can focus on logic.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "What does CPython execute?",
        options: ["Native machine code produced ahead of time", "Bytecode, in an interpreter loop", "Java bytecode on the JVM", "The source text, line by line"],
        answer: 1,
        explain: "CPython compiles source to bytecode and runs it in its evaluation loop. (Jython runs on the JVM; PyPy adds a JIT.)",
      },
      {
        q: "With a virtual environment activated, where does pip install a package?",
        options: ["Into the system Python's site-packages", "Into the environment's own site-packages", "Into the current directory", "Into ~/.cache only"],
        answer: 1,
        explain: "That's the whole point: each environment has its own site-packages, so projects don't share or break each other's dependencies.",
      },
      {
        q: "A file tools.py is imported with `import tools`. What is `__name__` inside it?",
        options: ["\"__main__\"", "\"tools\"", "\"tools.py\"", "None"],
        answer: 1,
        explain: "__name__ is \"__main__\" only for the file that was run directly. Imported modules get their module name.",
      },
      {
        q: "Which statement about Python's type system is true?",
        options: ["Static and strong", "Dynamic and weak", "Dynamic and strong", "Static and weak"],
        answer: 2,
        explain: "Names have no fixed type (dynamic), but operations between incompatible types raise TypeError instead of silently converting (strong).",
      },
      {
        q: "What does __pycache__ contain?",
        options: ["Downloaded wheels", "Compiled bytecode (.pyc) for imported modules", "Machine code from the JIT", "The virtual environment"],
        answer: 1,
        explain: "CPython caches the bytecode of imported modules so it can skip parsing and compiling when the source hasn't changed.",
      },
    ],
  },

  // ------------------------------------------------------------------ BASICS
  {
    id: "py-basics",
    stage: "Foundations",
    title: "Variables, types, strings and control flow",
    tagline: "Names and objects, numbers, truthiness, strings and f-strings, and every way to branch and loop, from for-else to the walrus operator and match.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["pyrefs"],
    concept: `
## Names, objects and types
In Python, a **variable is a name bound to an object**. \`x = 42\` creates an int object and binds the name \`x\` to it. Names have no type; objects do. That's **dynamic typing**: \`x\` can later be bound to a string. But Python is also **strongly typed**: \`"1" + 1\` raises \`TypeError\` instead of silently converting.

Every object has an **identity** (\`id(obj)\`, its address in CPython), a **type** (\`type(obj)\`) and a **value**. \`==\` compares values; \`is\` compares identity (use \`is\` only for \`None\`, \`True\`, \`False\` and sentinels). Objects are either **mutable** (list, dict, set, most class instances) or **immutable** (int, float, str, tuple, frozenset). Assignment never copies: \`b = a\` is a second name for the same object. Play with the visualizer to see why this matters.

## Numbers
| Type | Examples | Notes |
|---|---|---|
| \`int\` | \`42\`, \`-7\`, \`1_000_000\`, \`0xff\`, \`0b1010\` | Unlimited size: \`2**100\` just works |
| \`float\` | \`3.14\`, \`1e-9\`, \`float("inf")\` | 64-bit IEEE 754: \`0.1 + 0.2 != 0.3\` |
| \`complex\` | \`2+3j\` | Built in |
| \`Decimal\`, \`Fraction\` | \`Decimal("0.10")\` | Exact decimal / rational arithmetic (money!) |

\`/\` always returns a float (\`7 / 2 == 3.5\`); \`//\` is floor division (\`-7 // 2 == -4\`, rounds toward minus infinity); \`%\` is the remainder with the sign of the divisor; \`**\` is power. \`round()\` uses banker's rounding (ties to even).

## Booleans, None and truthiness
\`True\`/\`False\` are the bool values; \`None\` means "no value". In an \`if\` or \`while\`, every object is **truthy** except: \`False\`, \`None\`, zero (\`0\`, \`0.0\`), and empty containers (\`""\`, \`[]\`, \`{}\`, \`set()\`, \`range(0)\`). So write \`if items:\` rather than \`if len(items) > 0:\`. \`and\`/\`or\` short-circuit and return one of their operands: \`name = user_input or "anonymous"\`.

## Strings
\`str\` is an immutable sequence of Unicode characters. Single and double quotes are the same; triple quotes span lines. Index from the end with negative numbers and slice with \`s[start:stop:step]\` (stop excluded). The everyday methods: \`split\`, \`join\`, \`strip\`, \`replace\`, \`startswith\`, \`find\`, \`lower\`/\`upper\`, \`count\`. Because strings are immutable, building one in a loop with \`+=\` copies every time; collect pieces in a list and \`"".join(parts)\`.

**f-strings** are the way to format: \`f"{name}: {score:.1f}"\`. After the colon comes a **format spec**: alignment (\`<\`, \`>\`, \`^\`), width, thousands separator (\`,\`), precision (\`.2f\`), percent (\`%\`), binary/hex (\`b\`, \`x\`). \`f"{x=}"\` prints the expression and its value, handy for debugging.

Text vs bytes: \`str\` holds characters; \`bytes\` holds raw bytes (\`b"..."\`). Convert with \`.encode("utf-8")\` and \`.decode("utf-8")\`: always at the edges of your program (files, network).

## Control flow
- \`if / elif / else\`, and the one-line conditional expression \`a if cond else b\`.
- \`for item in iterable:\` loops over **anything iterable** (lists, strings, dicts, files, generators). For counting loops use \`range(start, stop, step)\`.
- \`enumerate(xs)\` gives \`(index, item)\` pairs; \`zip(a, b)\` walks several sequences in step. You almost never need \`range(len(xs))\`.
- \`while cond:\` repeats; \`break\` exits, \`continue\` skips to the next iteration.
- Loops can have an \`else\` that runs only if the loop **wasn't** broken: perfect for "search, and handle not found".
- The walrus operator \`:=\` assigns inside an expression: \`while (line := f.readline()):\`.
- \`match\` (3.10+) matches the **shape** of data: sequences, mappings, classes, literals, with \`|\` alternatives and \`if\` guards. It's much more than a switch statement (more in the Modern Python chapter).
- \`pass\` is a placeholder statement that does nothing.

## Getting input
\`input("prompt")\` reads a line as a string; convert explicitly: \`age = int(input("Age? "))\`. For real command-line programs, use \`sys.argv\` or \`argparse\` (see the CLI project).
`,
    keyPoints: [
      "Variables are names bound to objects; objects have identity, type and value",
      "== compares values, is compares identity (use is for None)",
      "/ is true division, // floors toward minus infinity, ints never overflow",
      "Empty containers, 0, None and False are falsy",
      "f-strings with format specs: f\"{total:>10,.2f}\"",
      "Loop with for over iterables, enumerate and zip; for-else handles not found",
    ],
    code: [
      {
        title: "Numbers, truthiness and strings",
        variants: [{ lang: "python", code: `from decimal import Decimal
from fractions import Fraction

# --- numbers -------------------------------------------------------------
print(7 / 2, 7 // 2, 7 % 2, -7 // 2, divmod(17, 5), 2**10)  # / is always float division
print(0.1 + 0.2, 0.1 + 0.2 == 0.3)  # binary floating point can't store 0.1 exactly
print(Decimal("0.1") + Decimal("0.2"), Fraction(1, 3) + Fraction(1, 6))  # exact alternatives
print(round(2.5), round(3.5), round(2.675, 2))  # banker's rounding; 2.675 is really 2.67499...
print(int("42") + 1, float("3.5"), int(3.99), int("ff", 16), bin(10), hex(255))
print(1_000_000 * 3, 10**20 + 1)  # underscores for readability; ints have unlimited size

# --- truthiness ----------------------------------------------------------
for value in [0, 0.0, "", [], {}, None, "0", [0], -1]:
    print(repr(value), "->", bool(value), end=" | ")
print()

# --- strings: immutable sequences of Unicode characters ------------------
s = "Python rocks"
print(s[0], s[-1], s[0:6], s[7:], s[::-1], len(s))
print(s.lower(), s.upper(), s.replace("rocks", "rules"), s.split(), "-".join(["a", "b", "c"]))
print(s.startswith("Py"), "rock" in s, s.find("rocks"), s.count("o"))
print("  padded  ".strip() + "|", "title case".title(), "42".zfill(5), "ab" * 3)
print("café".encode("utf-8"), len("café"), len("café".encode("utf-8")))  # str vs bytes
print(r"C:\\new\\table", "C:\\\\new\\\\table" == r"C:\\new\\table")  # raw strings keep backslashes` }],
        explain: `- \`/\` always gives a float; \`//\` floors **toward minus infinity**, so \`-7 // 2\` is \`-4\`, not \`-3\` (Java and Go truncate toward zero and give \`-3\`). \`divmod\` returns the quotient and remainder at once.
- Floats are binary IEEE 754 numbers, so \`0.1 + 0.2\` is \`0.30000000000000004\`. Compare floats with \`math.isclose\`, and use \`Decimal\` (built from **strings**) for money or \`Fraction\` for exact ratios.
- \`round\` uses banker's rounding (ties go to the even neighbour: \`round(2.5) == 2\`), and \`2.675\` is stored as 2.67499..., so it rounds down.
- Conversions are explicit: \`int("42")\`, \`int("ff", 16)\`, \`int(3.99)\` truncates to 3.
- The truthiness line: zero, empty and \`None\` are falsy; the string \`"0"\` and the list \`[0]\` are truthy because they're non-empty.
- Strings: negative indexes count from the end, \`s[::-1]\` reverses, \`find\` returns -1 when missing (\`index\` would raise).
- \`"café"\` is 4 characters but 5 bytes in UTF-8: \`é\` takes two.
- Raw strings \`r"..."\` don't treat backslashes as escapes: handy for Windows paths and regular expressions.`,
        output: `3.5 3 1 -4 (3, 2) 1024
0.30000000000000004 False
0.3 1/2
2 4 2.67
43 3.5 3 255 0b1010 0xff
3000000 100000000000000000001
0 -> False | 0.0 -> False | '' -> False | [] -> False | {} -> False | None -> False | '0' -> True | [0] -> True | -1 -> True | 
P s Python rocks skcor nohtyP 12
python rocks PYTHON ROCKS Python rules ['Python', 'rocks'] a-b-c
True True 7 2
padded| Title Case 00042 ababab
b'caf\\xc3\\xa9' 4 5
C:\\new\\table True`,
      },
      {
        title: "Branching and looping, the Pythonic way",
        variants: [{ lang: "python", code: `def classify(n: int) -> str:
    if n < 0:
        return "negative"
    elif n == 0:
        return "zero"
    elif n % 2 == 0:
        return "even"
    else:
        return "odd"


print([classify(n) for n in (-3, 0, 4, 7)])

# for loops iterate over any iterable; range(start, stop, step) excludes stop
for i in range(1, 16):
    print("FizzBuzz" if i % 15 == 0 else "Fizz" if i % 3 == 0 else "Buzz" if i % 5 == 0 else i, end=" ")
print()

# enumerate gives (index, item); zip walks several iterables in step
fruits = ["apple", "banana", "cherry"]
prices = [1.20, 0.50, 3.00]
for i, (fruit, price) in enumerate(zip(fruits, prices), start=1):
    print(f"{i}. {fruit:<7} \${price:.2f}")


# for ... else: the else runs only if the loop finished WITHOUT break
def first_divisor(n: int) -> int | None:
    for d in range(2, int(n**0.5) + 1):
        if n % d == 0:
            break
    else:
        return None  # no divisor found: n is prime
    return d


print(first_divisor(91), first_divisor(97))

# while loops, with the walrus operator := (assign inside an expression)
queue = [3, 1, 4, 1, 5]
while (item := queue.pop()) != 4:
    print("popped", item)

# chained comparisons read like math
x = 5
print(1 < x <= 5, 1 < x < 5, x == 5 != 6)


# match (3.10+): structural pattern matching on shape and values
def describe(command: str) -> str:
    match command.split():
        case ["go", direction]:
            return f"moving {direction}"
        case ["take", *items] if items:
            return f"taking {', '.join(items)}"
        case ["quit" | "exit"]:
            return "bye"
        case _:
            return f"unknown command: {command!r}"


for c in ["go north", "take key lamp", "exit", "dance"]:
    print(describe(c))` }],
        explain: `- \`if / elif / else\` chains; each branch ends with a colon and an indented block.
- FizzBuzz uses chained **conditional expressions** (\`a if cond else b\`); \`end=" "\` makes \`print\` stay on the same line.
- \`enumerate(zip(fruits, prices), start=1)\` numbers pairs from two lists; the \`(fruit, price)\` in the loop header unpacks each pair. \`:<7\` left-aligns in 7 columns and \`:.2f\` shows two decimals.
- \`first_divisor\` shows **for-else**: the \`else\` runs only if the loop ended without \`break\`. 91 = 7 × 13; 97 is prime, so the function returns \`None\`.
- The **walrus** \`:=\` pops and tests in one expression; the loop stops when it pops the 4.
- \`1 < x <= 5\` is a **chained comparison** meaning \`1 < x and x <= 5\`.
- \`match\` destructures the list of words: \`["go", direction]\` matches exactly two words and binds the second; \`["take", *items] if items\` matches "take" followed by at least one item; \`"quit" | "exit"\` is an alternative; \`_\` matches anything. \`!r\` in the f-string formats with \`repr\`, adding the quotes.`,
        output: `['negative', 'zero', 'even', 'odd']
1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz 
1. apple   $1.20
2. banana  $0.50
3. cherry  $3.00
7 None
popped 5
popped 1
True False True
moving north
taking key, lamp
bye
unknown command: 'dance'`,
      },
      {
        title: "f-strings and the format-spec mini-language",
        variants: [{ lang: "python", code: `# f-strings: {expression:format-spec}. The spec is [fill][align][sign][width][,][.precision][type]
items = [("Keyboard", 3, 49.99), ("Monitor", 1, 219.0), ("USB-C cable", 12, 7.5)]

print(f"{'Item':<12}{'Qty':>5}{'Price':>10}{'Total':>11}")
print("-" * 38)
grand = 0.0
for name, qty, price in items:
    total = qty * price
    grand += total
    print(f"{name:<12}{qty:>5}{price:>10.2f}{total:>11,.2f}")
print("-" * 38)
print(f"{'Grand total':<27}{grand:>11,.2f}")

n = 1234567.891
print(f"{n:,.2f} | {n:_.0f} | {n:.3e} | {0.256:.1%} | {42:08b} | {255:#x} | {7:+d}")
print(f"[{'left':<10}] [{'right':>10}] [{'center':^10}] [{'pad':*^9}]")

user, score = "ada", 97
print(f"{user=}, {score=}, {score / 100 = :.0%}")  # = prints the expression too (debugging)
print(f"{user!r} vs {user!s}", f"{'nested ' + user.upper()}")
width = 6
print(f"{3.14159:{width}.2f}|")  # format specs can contain expressions too` }],
        explain: `A format spec after the colon controls the layout: \`{name:<12}\` left-aligns in 12 columns, \`{qty:>5}\` right-aligns, and \`{total:>11,.2f}\` right-aligns with thousands separators and two decimals. That's enough to print aligned reports without any library.

| Spec | Meaning | Example output |
|---|---|---|
| \`,.2f\` | thousands separator, 2 decimals | \`1,234,567.89\` |
| \`_.0f\` | underscore separator, no decimals | \`1_234_568\` |
| \`.3e\` | scientific notation | \`1.235e+06\` |
| \`.1%\` | multiply by 100, add % | \`25.6%\` |
| \`08b\` | binary, zero-padded to 8 | \`00101010\` |
| \`#x\` | hex with 0x prefix | \`0xff\` |
| \`*^9\` | center in 9 columns, fill with * | \`***pad***\` |

\`f"{score=}"\` prints \`score=97\` (the expression text, then the value), and works with expressions and specs too: \`{score / 100 = :.0%}\`. \`!r\` uses \`repr()\` (quotes strings), \`!s\` uses \`str()\`. Specs can contain nested fields like \`{3.14159:{width}.2f}\`.`,
        output: `Item          Qty     Price      Total
--------------------------------------
Keyboard        3     49.99     149.97
Monitor         1    219.00     219.00
USB-C cable    12      7.50      90.00
--------------------------------------
Grand total                     458.97
1,234,567.89 | 1_234_568 | 1.235e+06 | 25.6% | 00101010 | 0xff | +7
[left      ] [     right] [  center  ] [***pad***]
user='ada', score=97, score / 100 = 97%
'ada' vs ada nested ADA
  3.14|`,
      },
      {
        title: "Names, objects and mutability",
        note: "Step through the same ideas in the visualizer above.",
        variants: [{ lang: "python", code: `# Variables are NAMES bound to OBJECTS. Every object has an identity (id), a type and a value.
a = [1, 2, 3]
b = a  # no copy: a second name for the same list
b.append(4)
print(a, a is b, a == b)

c = list(a)  # a new list with the same contents
print(c == a, c is a)

a = a + [5]  # builds a NEW list and rebinds a; b still points at the old one
print(a, b)

d = b
d += [6]  # += on a list mutates in place (it calls list.extend)
print(b, d is b)

t = (1, 2)
u = t
u += (3,)  # tuples are immutable, so += builds a new tuple and rebinds u
print(t, u, t is u)


def append_twice(items: list[int], value: int) -> None:
    items.append(value)  # mutates the caller's list: same object
    items = [value]  # rebinding the parameter does NOT affect the caller
    items.append(value)


nums = [0]
append_twice(nums, 9)
print(nums)

# Python is dynamically typed (names have no type) but strongly typed (no silent conversions)
x = 10
x = "ten"
print(type(x).__name__)
try:
    print("1" + 1)
except TypeError as e:
    print("TypeError:", e)` }],
        explain: `- \`b = a\` doesn't copy: both names point at one list, so \`b.append(4)\` shows up in \`a\`, and \`a is b\` is True.
- \`list(a)\` creates a new list with equal contents: \`==\` is True, \`is\` is False.
- \`a = a + [5]\` creates a new list and **rebinds** \`a\`; \`b\` keeps the old one.
- But \`d += [6]\` **mutates** the list in place (\`list.__iadd__\` is \`extend\`), so \`b\` changes and \`d is b\` stays True. For immutable tuples, \`u += (3,)\` must create a new tuple, so \`t\` is untouched.
- Inside \`append_twice\`, \`items.append(value)\` mutates the caller's list, then \`items = [value]\` rebinds only the local name. The caller sees one 9, not two. This is "pass by object reference" (also called pass by assignment).
- Dynamic typing lets \`x\` be rebound from an int to a str, but strong typing makes \`"1" + 1\` a \`TypeError\`.`,
        output: `[1, 2, 3, 4] True True
True False
[1, 2, 3, 4, 5] [1, 2, 3, 4]
[1, 2, 3, 4, 6] True
(1, 2) (1, 2, 3) False
[0, 9]
str
TypeError: can only concatenate str (not "int") to str`,
      },
    ],
    interview: [
      {
        q: "What's the difference between == and is?",
        a: `\`==\` calls \`__eq__\` and compares **values**; \`is\` compares **identity** (same object, same \`id\`). Two equal lists are \`==\` but not \`is\`. Use \`is\` only for singletons: \`x is None\`, \`x is True\`, sentinel objects. Don't rely on \`is\` for numbers or strings: CPython caches small ints (-5 to 256) and interns some strings, so \`a is b\` may be True or False depending on how the values were created.`,
        freq: "very-common",
      },
      {
        q: "Is Python pass-by-value or pass-by-reference?",
        a: `Neither exactly: it's **pass by object reference** (or "pass by assignment"). The parameter becomes a new name bound to the same object the caller passed. If the function **mutates** that object (\`lst.append\`, \`d[k] = v\`), the caller sees it. If it **rebinds** the parameter (\`lst = []\`), only the local name changes. Immutable arguments (ints, strings, tuples) therefore behave like pass-by-value.`,
        freq: "very-common",
      },
      {
        q: "Which built-in types are mutable, and why does it matter?",
        a: `Mutable: \`list\`, \`dict\`, \`set\`, \`bytearray\` and most user-defined objects. Immutable: \`int\`, \`float\`, \`bool\`, \`str\`, \`bytes\`, \`tuple\`, \`frozenset\`, \`None\`. It matters because (1) aliasing: changes through one name show up through every name; (2) only immutable (hashable) objects can be dict keys or set members; (3) mutable default arguments and class attributes are shared; (4) immutable objects are safe to share between threads and to cache.`,
        freq: "very-common",
      },
      {
        q: "Why is 0.1 + 0.2 != 0.3, and how do you handle money?",
        a: `Floats are binary fractions (IEEE 754 doubles); 0.1 has no exact binary representation, so tiny errors appear. Compare floats with \`math.isclose(a, b)\`. For money use \`decimal.Decimal\` constructed from strings (\`Decimal("19.99")\`) with explicit rounding (\`quantize\`), or store integer cents.`,
        freq: "common",
      },
      {
        q: "What values are falsy in Python?",
        a: `\`False\`, \`None\`, numeric zero (\`0\`, \`0.0\`, \`0j\`, \`Decimal(0)\`), and empty sequences and collections (\`""\`, \`b""\`, \`[]\`, \`()\`, \`{}\`, \`set()\`, \`range(0)\`). Any object can define its truthiness with \`__bool__\` or \`__len__\`. Beware of \`if not x:\` when \`0\` or \`""\` are valid values; use \`if x is None:\` instead.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What do 7 // 2 and -7 // 2 evaluate to?",
        options: ["3 and -3", "3 and -4", "3.5 and -3.5", "4 and -4"],
        answer: 1,
        explain: "// is floor division: it rounds toward minus infinity, so -3.5 becomes -4.",
      },
      {
        q: "What does f\"{1234.5678:,.2f}\" produce?",
        options: ["1234.57", "1,234.57", "1,234.5678", "1.23e+03"],
        answer: 1,
        explain: ", adds a thousands separator and .2f shows two decimals.",
      },
      {
        q: "Which value is truthy?",
        options: ["0", "\"\"", "\"0\"", "[]"],
        answer: 2,
        explain: "\"0\" is a non-empty string, so it's truthy. Only empty strings are falsy.",
      },
      {
        q: "a = [1, 2]; b = a; b.append(3). What is a?",
        options: ["[1, 2]", "[1, 2, 3]", "[3]", "An error"],
        answer: 1,
        explain: "b = a binds a second name to the same list, so the append is visible through a.",
      },
      {
        q: "When does the else block of a for loop run?",
        options: ["When the loop body raises", "When the loop finishes without hitting break", "Only when the iterable is empty", "Never: for has no else"],
        answer: 1,
        explain: "for-else's else runs when the loop completes normally; a break skips it. It's ideal for search loops.",
      },
      {
        q: "What happens with \"1\" + 1?",
        options: ["\"11\"", "2", "TypeError", "None"],
        answer: 2,
        explain: "Python is strongly typed: it won't silently convert. Use str(1) or int(\"1\") explicitly.",
      },
    ],
  },

  // ------------------------------------------------------------------ COLLECTIONS
  {
    id: "py-collections",
    stage: "Foundations",
    title: "Lists, tuples, dicts and sets",
    tagline: "The four built-in collections, how they work inside, their Big-O costs, comprehensions, and the collections module you'll use in every interview.",
    difficulty: "beginner",
    minutes: 40,
    visualizers: ["hashtable"],
    concept: `
## The four built-in collections
| | Ordered | Mutable | Duplicates | Lookup by | Use for |
|---|---|---|---|---|---|
| \`list\` \`[1, 2]\` | yes | yes | yes | index | sequences you change |
| \`tuple\` \`(1, 2)\` | yes | no | yes | index | fixed records, dict keys, returning several values |
| \`dict\` \`{"k": 1}\` | insertion order | yes | unique keys | key | mapping, counting, grouping, caching |
| \`set\` \`{1, 2}\` | no | yes | no | membership | dedupe, fast \`in\`, set algebra |

Literals are cheap to write; the empty set is \`set()\` because \`{}\` is an empty dict.

## Lists are dynamic arrays
A list stores **references** to objects in a contiguous array that over-allocates, so \`append\` is amortized O(1). Inserting or removing at the front (\`insert(0, x)\`, \`pop(0)\`) shifts every element: O(n). Need a queue? Use \`collections.deque\`. \`x in some_list\` scans linearly; if you test membership often, use a set.

Slicing (\`xs[1:4]\`, \`xs[::-1]\`) always builds a **new** list (a shallow copy). \`sort()\` sorts in place and returns \`None\`; \`sorted()\` returns a new list and works on any iterable. Python's sort is **Timsort**: O(n log n), stable (equal keys keep their order), and very fast on partly sorted data. Sort by anything with \`key=\`: \`sorted(users, key=lambda u: (u.age, u.name))\`.

## Tuples and unpacking
Tuples are immutable lists. Their real power is **unpacking**: \`x, y = point\`, \`a, b = b, a\` (swap), \`first, *rest = items\`, and functions returning \`return total, count\`. \`typing.NamedTuple\` (or a dataclass) gives fields names.

## Dicts are hash tables
A dict hashes the key to find a slot: get, set, delete and \`in\` are **O(1) on average**. Keys must be **hashable** (immutable: str, int, tuple of hashables; not lists or dicts). Since Python 3.7 dicts remember insertion order. Must-know operations:
- \`d.get(k, default)\` instead of \`d[k]\` when the key may be missing (\`d[k]\` raises \`KeyError\`).
- \`for k, v in d.items():\` to loop over pairs.
- \`d1 | d2\` merges (right side wins), \`d.setdefault(k, [])\`, \`d.pop(k, None)\`.
- Comprehensions: \`{name: len(name) for name in names}\`.

## Sets
Sets are dicts without values: O(1) membership, automatic de-duplication, and algebra: \`a & b\` (both), \`a | b\` (either), \`a - b\` (only in a), \`a ^ b\` (exactly one). Their iteration order is arbitrary, so \`sorted(s)\` before printing. \`frozenset\` is the immutable, hashable version.

## Comprehensions
\`[expr for x in xs if cond]\` builds a list in one readable line (and runs faster than an append loop). The same syntax makes dicts \`{k: v for ...}\`, sets \`{x for ...}\`, and with parentheses a lazy **generator expression** that builds nothing: \`sum(x * x for x in nums)\`. If it doesn't fit on one or two lines, use a normal loop.

## The \`collections\` module and friends
| Tool | What it gives you | Interview use |
|---|---|---|
| \`Counter\` | dict of counts, \`most_common(k)\`, \`+\`/\`-\` | anagrams, frequencies, top-k |
| \`defaultdict(list)\` | auto-created values | grouping, adjacency lists |
| \`deque\` | O(1) at both ends, \`maxlen\` | BFS queue, sliding windows |
| \`heapq\` | min-heap on a list | top-k, Dijkstra, merge k sorted lists, scheduling |
| \`bisect\` | binary search on sorted lists | insertion points, ranges |
| \`OrderedDict\` | \`move_to_end\`, \`popitem(last=False)\` | LRU cache |
| \`NamedTuple\`, \`dataclass\` | lightweight records | clean code |

## Copies: shallow vs deep
\`list(xs)\`, \`xs[:]\`, \`xs.copy()\`, \`dict(d)\` and \`copy.copy\` make **shallow** copies: a new container whose slots point at the **same** inner objects. For nested mutable data use \`copy.deepcopy\`, or build fresh objects. The classic trap: \`[[0] * 3] * 3\` creates three references to **one** row; write \`[[0] * 3 for _ in range(3)]\`. Step through it in the visualizer.
`,
    keyPoints: [
      "list = dynamic array: append and index O(1), insert/pop at the front O(n)",
      "dict and set = hash tables: O(1) average lookups; keys must be hashable",
      "Tuples are immutable records; unpack them with a, b = pair",
      "Comprehensions build lists, dicts and sets in one readable expression",
      "Counter, defaultdict, deque, heapq and bisect solve most interview problems",
      "Copies are shallow unless you use copy.deepcopy",
    ],
    complexity: [
      { op: "list: index, len, append, pop()", time: "O(1)", note: "append is amortized O(1)" },
      { op: "list: insert(0, x), pop(0), remove(x)", time: "O(n)", note: "elements shift" },
      { op: "x in list, list.index(x)", time: "O(n)", note: "linear scan" },
      { op: "slice xs[a:b], copy", time: "O(b − a)" },
      { op: "sort / sorted", time: "O(n log n)", note: "Timsort, stable" },
      { op: "dict / set: get, set, in, del", time: "O(1) average", note: "O(n) worst case with many collisions" },
      { op: "deque: append, appendleft, pop, popleft", time: "O(1)" },
      { op: "heapq: heappush, heappop", time: "O(log n)", note: "heapify is O(n), peek heap[0] is O(1)" },
      { op: "bisect on a sorted list", time: "O(log n)", note: "insort is O(n) because of the insert" },
      { op: "s += piece in a loop vs \"\".join(parts)", time: "O(n²) vs O(n)" },
    ],
    code: [
      {
        title: "Lists and tuples",
        variants: [{ lang: "python", code: `# list: ordered, mutable, a dynamic array of references
nums = [5, 3, 8, 1]
nums.append(9)  # amortized O(1)
nums.insert(0, 7)  # O(n): shifts every element
nums.extend([2, 6])
print(nums, len(nums), nums[0], nums[-1])
print(nums.pop(), nums.pop(0), nums)  # pop() is O(1), pop(0) is O(n)
print(nums[1:4], nums[::2], nums[::-1])  # slices make new lists
nums[1:3] = [30, 80, 10]  # slice assignment can change the length
print(nums, nums.index(80), 80 in nums)  # \`in\` on a list is a linear scan
del nums[0]
nums.remove(10)  # removes the first matching value
print(nums)

sorted_copy = sorted(nums)  # new list
nums.sort(reverse=True)  # in place, returns None
print(sorted_copy, nums)

# tuple: ordered and immutable. Use it for fixed records and as dict keys
point = (3, 4)
x, y = point  # unpacking
first, *rest = [1, 2, 3, 4]  # star-unpacking collects the rest
print(x, y, first, rest)
a, b = 1, 2
a, b = b, a  # swap without a temporary
print(a, b, (1,), type((1)).__name__)  # a 1-tuple needs the trailing comma

from typing import NamedTuple


class Point(NamedTuple):
    x: float
    y: float

    def dist(self) -> float:
        return (self.x**2 + self.y**2) ** 0.5


p = Point(3, 4)
print(p, p.x, p.dist(), p._replace(y=0), tuple(p))` }],
        explain: `- \`append\` adds at the end; \`insert(0, ...)\` has to shift everything right. \`pop()\` removes from the end (cheap); \`pop(0)\` from the front (expensive).
- Slices create new lists: \`[::2]\` takes every second element, \`[::-1]\` reverses. Slice **assignment** (\`nums[1:3] = [30, 80, 10]\`) can replace a range with a different number of elements.
- \`remove\` deletes the first matching **value**; \`del nums[0]\` deletes by **index**.
- \`sorted()\` returns a new list; \`.sort()\` sorts in place and returns \`None\` (a common bug: \`nums = nums.sort()\`).
- Tuples: \`first, *rest\` collects the remainder into a list; \`a, b = b, a\` swaps. \`(1)\` is just the int 1 in parentheses; a one-element tuple needs a comma: \`(1,)\`.
- \`NamedTuple\` gives a tuple named fields, a nice \`repr\`, and methods, while still unpacking like a tuple. \`_replace\` returns a modified copy.`,
        output: `[7, 5, 3, 8, 1, 9, 2, 6] 8 7 6
6 7 [5, 3, 8, 1, 9, 2]
[3, 8, 1] [5, 8, 9] [2, 9, 1, 8, 3, 5]
[5, 30, 80, 10, 1, 9, 2] 2 True
[30, 80, 1, 9, 2]
[1, 2, 9, 30, 80] [80, 30, 9, 2, 1]
3 4 1 [2, 3, 4]
2 1 (1,) int
Point(x=3, y=4) 3 5.0 Point(x=3, y=0) (3, 4)`,
      },
      {
        title: "Dicts and sets",
        variants: [{ lang: "python", code: `# dict: a hash table from keys to values. Insertion order is preserved (guaranteed since 3.7)
stock = {"apple": 5, "banana": 0}
stock["cherry"] = 12  # add or overwrite: O(1) on average
print(stock, stock["apple"], len(stock))
print(stock.get("kiwi"), stock.get("kiwi", 0))  # get never raises KeyError
try:
    stock["kiwi"]
except KeyError as e:
    print("KeyError:", e)

for fruit, qty in stock.items():
    print(f"{fruit}={qty}", end=" ")
print()
print(list(stock.keys()), list(stock.values()))

stock.setdefault("kiwi", 3)  # insert only if missing
stock.update({"apple": 7, "date": 4})
del stock["banana"]
print(stock)
print(stock.pop("date"), "date" in stock)

defaults = {"host": "localhost", "port": 8080, "debug": False}
overrides = {"port": 9000, "debug": True}
print(defaults | overrides)  # merge (3.9+): right side wins
print({k: v for k, v in defaults.items() if isinstance(v, str)})  # dict comprehension

# keys must be hashable (immutable): str, int, tuple of hashables... not list
grid = {(0, 0): "start", (2, 3): "treasure"}
print(grid[(2, 3)])
try:
    {[1, 2]: "nope"}
except TypeError:
    print("TypeError: a list is unhashable, so it can't be a key")

# set: unordered collection of unique hashable items, O(1) membership tests
seen = set()
for word in "to be or not to be".split():
    seen.add(word)
print(sorted(seen), "be" in seen)  # sorted() because set order is arbitrary

python_devs = {"ana", "ben", "cho", "dev"}
go_devs = {"cho", "dev", "eli"}
print(sorted(python_devs & go_devs))  # intersection
print(sorted(python_devs | go_devs))  # union
print(sorted(python_devs - go_devs))  # difference
print(sorted(python_devs ^ go_devs))  # symmetric difference
print({x % 3 for x in range(10)}, frozenset({1, 2}) | {3})` }],
        explain: `- Square brackets read or write a key; reading a missing key raises \`KeyError\`, so use \`.get(key, default)\` when absence is normal.
- \`.items()\` yields \`(key, value)\` pairs in insertion order. \`.keys()\` and \`.values()\` are live **views**; wrap them in \`list()\` to snapshot.
- \`setdefault\` inserts only when missing; \`update\` merges in place; \`pop\` removes and returns.
- \`defaults | overrides\` builds a merged dict where the right side wins: the usual pattern for configuration.
- Tuple keys like \`(2, 3)\` are perfect for grids and memo tables; a list can't be a key because it's mutable (unhashable).
- Sets drop duplicates automatically and support algebra. Their order isn't meaningful (it depends on hashes), so the sample sorts before printing.`,
        output: `{'apple': 5, 'banana': 0, 'cherry': 12} 5 3
None 0
KeyError: 'kiwi'
apple=5 banana=0 cherry=12 
['apple', 'banana', 'cherry'] [5, 0, 12]
{'apple': 7, 'cherry': 12, 'kiwi': 3, 'date': 4}
4 False
{'host': 'localhost', 'port': 9000, 'debug': True}
{'host': 'localhost'}
treasure
TypeError: a list is unhashable, so it can't be a key
['be', 'not', 'or', 'to'] True
['cho', 'dev']
['ana', 'ben', 'cho', 'dev', 'eli']
['ana', 'ben']
['ana', 'ben', 'eli']
{0, 1, 2} frozenset({1, 2, 3})`,
      },
      {
        title: "The interview toolbox: Counter, defaultdict, deque, heapq, bisect",
        variants: [{ lang: "python", code: `import bisect
import heapq
from collections import Counter, OrderedDict, defaultdict, deque

# Counter: counting made trivial
votes = Counter("abracadabra")
print(votes.most_common(3), votes["a"], votes["z"])  # missing keys count as 0
votes.update("aaz")
print(votes["a"], votes["z"], (Counter("aab") + Counter("bc")))

# defaultdict: values created on first access. Great for grouping and graphs
by_length = defaultdict(list)
for w in ["go", "java", "rust", "c", "python", "lua"]:
    by_length[len(w)].append(w)
print(dict(by_length))

graph = defaultdict(set)
for u, v in [("a", "b"), ("a", "c"), ("b", "d")]:
    graph[u].add(v)
    graph[v].add(u)
print(sorted(graph["a"]), sorted(graph["d"]))

# deque: O(1) append and pop at BOTH ends (a list's pop(0) is O(n)). The queue for BFS
q = deque([1, 2, 3])
q.appendleft(0)
q.append(4)
print(q)
print(q.popleft(), q.pop(), q)
recent = deque(maxlen=3)  # keeps only the last 3 items
for i in range(6):
    recent.append(i)
print(list(recent))

# heapq: a binary min-heap stored in a plain list. push/pop O(log n), peek O(1)
tasks = []
for priority, name in [(3, "write docs"), (1, "fix prod bug"), (2, "review PR")]:
    heapq.heappush(tasks, (priority, name))
print(tasks[0], heapq.heappop(tasks), heapq.heappop(tasks))
nums = [9, 1, 8, 2, 7, 3]
print(heapq.nlargest(2, nums), heapq.nsmallest(2, nums))
max_heap = [-n for n in nums]  # no max-heap: negate the keys
heapq.heapify(max_heap)  # O(n)
print(-heapq.heappop(max_heap))

# bisect: binary search on a sorted list, O(log n)
scores = [10, 20, 30, 40]
print(bisect.bisect_left(scores, 30), bisect.bisect_right(scores, 30), bisect.bisect(scores, 25))
bisect.insort(scores, 25)
print(scores)

# OrderedDict: remembers order and can move keys to the end. A tiny LRU cache:
cache = OrderedDict()
for key in ["a", "b", "c", "a", "d"]:
    if key in cache:
        cache.move_to_end(key)
    cache[key] = True
    if len(cache) > 3:
        cache.popitem(last=False)  # evict the least recently used
print(list(cache))` }],
        explain: `- \`Counter("abracadabra")\` counts letters; \`most_common(3)\` returns the top three. Counters add and subtract.
- \`defaultdict(list)\` creates an empty list the first time a key is touched, so grouping is one line; \`defaultdict(set)\` builds an undirected graph.
- \`deque\` is a double-ended queue: use it for BFS (\`popleft\` is O(1)). With \`maxlen\` it becomes a sliding window that drops old items.
- \`heapq\` turns a list into a **min-heap**: the smallest item is always at index 0. Tuples compare element by element, so \`(priority, name)\` pops the lowest priority first. For a max-heap, push negated values. \`nlargest\`/\`nsmallest\` solve top-k directly.
- \`bisect_left\`/\`bisect_right\` find where a value would be inserted to keep the list sorted: \`bisect_left(scores, 30)\` is 2 (before the existing 30) and \`bisect_right\` is 3 (after it).
- The \`OrderedDict\` block is a complete LRU cache with capacity 3: accessing a key moves it to the end, and when the cache is too big the oldest key is evicted from the front. After the sequence a, b, c, a, d, the least recently used key b is gone.`,
        output: `[('a', 5), ('b', 2), ('r', 2)] 5 0
7 1 Counter({'a': 2, 'b': 2, 'c': 1})
{2: ['go'], 4: ['java', 'rust'], 1: ['c'], 6: ['python'], 3: ['lua']}
['b', 'c'] ['b']
deque([0, 1, 2, 3, 4])
0 4 deque([1, 2, 3])
[3, 4, 5]
(1, 'fix prod bug') (1, 'fix prod bug') (2, 'review PR')
[9, 8] [1, 2]
9
2 3 2
[10, 20, 25, 30, 40]
['c', 'a', 'd']`,
      },
      {
        title: "Comprehensions, sorting and the built-in helpers",
        variants: [{ lang: "python", code: `nums = [3, -1, 4, -1, 5, -9, 2, 6]

squares = [n * n for n in nums]  # list comprehension
positives = [n for n in nums if n > 0]  # with a filter
signs = ["+" if n > 0 else "-" for n in nums]  # if/else goes BEFORE the for
print(squares, positives, "".join(signs))

matrix = [[1, 2, 3], [4, 5, 6]]
print([x for row in matrix for x in row])  # nested: same order as nested for loops
print([[row[i] for row in matrix] for i in range(3)])  # transpose
print(list(zip(*matrix)))  # ...or with zip

words = ["Python", "is", "fun", "and", "practical"]
print({w: len(w) for w in words})  # dict comprehension
print({len(w) for w in words})  # set comprehension
print(sum(len(w) for w in words))  # generator expression: no list built

# sorting with a key function. Python's sort (Timsort) is stable: ties keep their order
people = [("ana", 31), ("ben", 25), ("cho", 31), ("dev", 25)]
print(sorted(people, key=lambda p: p[1]))
print(sorted(people, key=lambda p: (-p[1], p[0])))  # age descending, then name
print(sorted(words, key=str.lower), sorted(words, key=len, reverse=True)[:2])
print(max(words, key=len), min(people, key=lambda p: p[1]))

print(any(n > 5 for n in nums), all(n != 0 for n in nums))  # short-circuit
print(list(map(abs, nums)), list(filter(None, [0, 1, "", "a", None])))` }],
        explain: `- A filter goes at the end (\`if n > 0\`); an if/else that **transforms** each element goes before the \`for\`.
- Nested comprehensions read like nested loops written in the same order. \`zip(*matrix)\` transposes by unpacking the rows as separate arguments.
- Dict and set comprehensions use braces. The set of lengths \`{9, 2, 3, 6}\` prints in hash order, not insertion order.
- \`sum(len(w) for w in words)\` uses a **generator expression**: values are produced one at a time, with no intermediate list.
- Sorting: \`key=lambda p: (-p[1], p[0])\` sorts by age descending, then name ascending. Because Timsort is **stable**, ben stays before dev when sorting by age alone.
- \`max(words, key=len)\` returns the element, not the length. \`any\`/\`all\` stop as soon as the answer is known. \`filter(None, xs)\` keeps the truthy items.`,
        output: `[9, 1, 16, 1, 25, 81, 4, 36] [3, 4, 5, 2, 6] +-+-+-++
[1, 2, 3, 4, 5, 6]
[[1, 4], [2, 5], [3, 6]]
[(1, 4), (2, 5), (3, 6)]
{'Python': 6, 'is': 2, 'fun': 3, 'and': 3, 'practical': 9}
{9, 2, 3, 6}
23
[('ben', 25), ('dev', 25), ('ana', 31), ('cho', 31)]
[('ana', 31), ('cho', 31), ('ben', 25), ('dev', 25)]
['and', 'fun', 'is', 'practical', 'Python'] ['practical', 'Python']
practical ('ben', 25)
True True
[3, 1, 4, 1, 5, 9, 2, 6] [1, 'a']`,
      },
    ],
    interview: [
      {
        q: "How is a Python list implemented, and what does that mean for performance?",
        a: `A list is a **dynamic array of pointers** to objects. Indexing and \`len\` are O(1). \`append\` is amortized O(1) because the array over-allocates and occasionally grows and copies (growth factor about 1.125 plus a constant). Inserting or deleting anywhere but the end shifts elements: O(n). \`x in lst\` is a linear scan. Because a list stores pointers, a list of a million ints costs the pointers plus a million int objects; for numeric data use \`array\` or NumPy.`,
        freq: "very-common",
      },
      {
        q: "How does a dict work, and why must keys be hashable?",
        a: `A dict is a **hash table**: \`hash(key)\` picks a slot, and collisions are resolved by open addressing (probing other slots). Since 3.6 CPython stores entries in a compact, insertion-ordered array plus a sparse index table, which saves memory and gives ordered iteration (guaranteed since 3.7). Lookups are O(1) on average. A key's hash must never change while it's in the dict, or it would be looked for in the wrong slot, so keys must be immutable/hashable, and objects that compare equal must have equal hashes.`,
        freq: "very-common",
      },
      {
        q: "List or tuple: when do you use which?",
        a: `Use a **list** for a variable-length sequence of similar items that you'll modify. Use a **tuple** for a fixed-size record whose positions mean something (\`(lat, lon)\`, a database row), for returning several values, and wherever you need hashability (dict keys, set members). Tuples are immutable, slightly smaller and faster to create, and signal intent. For named fields, use \`NamedTuple\` or a dataclass.`,
        freq: "common",
      },
      {
        q: "How do you implement a stack, a queue and a priority queue in Python?",
        a: `- **Stack**: a list with \`append\` and \`pop()\`, both O(1).
- **Queue**: \`collections.deque\` with \`append\` and \`popleft()\`, both O(1). Never \`list.pop(0)\` (O(n)). For threads, use \`queue.Queue\`; for asyncio, \`asyncio.Queue\`.
- **Priority queue**: \`heapq\` on a list of \`(priority, counter, item)\` tuples; the counter breaks ties so items themselves never get compared. For a max-heap, negate the priority.`,
        freq: "common",
      },
      {
        q: "What's the difference between a shallow and a deep copy?",
        a: `A **shallow** copy (\`lst.copy()\`, \`lst[:]\`, \`list(lst)\`, \`dict(d)\`, \`copy.copy\`) creates a new outer container whose elements are the **same** objects as the original. A **deep** copy (\`copy.deepcopy\`) recursively copies the elements too, using a memo dict to handle shared references and cycles. Shallow is enough when the elements are immutable; nested mutable structures need deep copies (or rebuilding). Classic bug: \`[[0] * n] * m\` shares one row m times.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What's the average time complexity of `x in s` when s is a set?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        answer: 0,
        explain: "Sets are hash tables: membership hashes x and checks one slot (plus rare probing).",
      },
      {
        q: "What's the time complexity of lst.pop(0) on a list of n items?",
        options: ["O(1)", "O(log n)", "O(n)", "Amortized O(1)"],
        answer: 2,
        explain: "Every remaining element shifts one slot left. Use collections.deque.popleft() for O(1).",
      },
      {
        q: "Which of these can be a dictionary key?",
        options: ["[1, 2]", "{1: 2}", "(1, 2)", "{1, 2}"],
        answer: 2,
        explain: "Keys must be hashable. Tuples of hashable values are; lists, dicts and sets are mutable and unhashable.",
      },
      {
        q: "grid = [[0] * 2] * 2; grid[0][0] = 1. What is grid?",
        options: ["[[1, 0], [0, 0]]", "[[1, 0], [1, 0]]", "[[1, 1], [0, 0]]", "An error"],
        answer: 1,
        explain: "* 2 on the outer list copies the reference to the same inner list, so both rows are one object.",
      },
      {
        q: "nums = [3, 1, 2]; result = nums.sort(). What is result?",
        options: ["[1, 2, 3]", "[3, 1, 2]", "None", "A sorted iterator"],
        answer: 2,
        explain: "list.sort() sorts in place and returns None. Use sorted(nums) for a new list.",
      },
      {
        q: "Which structure should a BFS use as its queue?",
        options: ["list with pop(0)", "collections.deque", "set", "heapq"],
        answer: 1,
        explain: "deque gives O(1) append and popleft. list.pop(0) makes BFS O(n²).",
      },
    ],
    problems: [
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "Easy", note: "dict of value → index, one pass" },
      { title: "Valid Anagram", url: "https://leetcode.com/problems/valid-anagram/", difficulty: "Easy", note: "Counter(s) == Counter(t)" },
      { title: "Group Anagrams", url: "https://leetcode.com/problems/group-anagrams/", difficulty: "Medium", note: "defaultdict(list) keyed by tuple(sorted(word))" },
      { title: "Top K Frequent Elements", url: "https://leetcode.com/problems/top-k-frequent-elements/", difficulty: "Medium", note: "Counter.most_common(k) or heapq.nlargest" },
      { title: "Longest Consecutive Sequence", url: "https://leetcode.com/problems/longest-consecutive-sequence/", difficulty: "Medium", note: "set lookups, start only at sequence heads" },
    ],
  },

  // ------------------------------------------------------------------ FUNCTIONS
  {
    id: "py-functions",
    stage: "Foundations",
    title: "Functions, scope, closures and decorators",
    tagline: "Every kind of parameter, the mutable-default trap, LEGB scoping, closures and late binding, decorators with and without arguments, and functools.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["pyrefs"],
    concept: `
## Defining and calling functions
\`\`\`python
def area(width: float, height: float = 1.0) -> float:
    """Return the area of a rectangle."""  # docstring: shown by help(area)
    return width * height
\`\`\`
A function without \`return\` returns \`None\`. Return several values as a tuple (\`return lo, hi\`) and unpack at the call site. Type hints (\`: float\`, \`-> float\`) document intent and power editors and type checkers, but Python does not enforce them at runtime.

## Parameters: all the kinds
\`\`\`python
def f(pos_only, /, normal, *args, kw_only, **kwargs): ...
\`\`\`
- **Positional or keyword** (\`normal\`): \`f(1, 2)\` or \`f(1, normal=2)\`.
- **Defaults**: \`def connect(host, port=5432)\`. Defaults are evaluated **once**, when \`def\` runs. A mutable default (\`items=[]\`) is shared by every call: use \`None\` and create the list inside.
- **\`*args\`** collects extra positional arguments into a tuple; **\`**kwargs\`** collects extra keyword arguments into a dict.
- **Keyword-only** (after \`*\` or \`*args\`): forces readable call sites like \`send(msg, retries=3)\`.
- **Positional-only** (before \`/\`): lets you rename parameters later without breaking callers.
- At the call site, \`*seq\` and \`**mapping\` unpack arguments: \`connect(*args, **options)\`.

Arguments are passed by **object reference** ("pass by assignment"): the function gets a new name for the same object. Mutating it (\`items.append(x)\`) is visible to the caller; rebinding the parameter (\`items = []\`) is not.

## Functions are objects
You can store functions in variables, lists and dicts, pass them to other functions and return them. That's why \`sorted(words, key=len)\` works. \`lambda x: x * 2\` is a small anonymous function limited to a single expression; use \`def\` for anything bigger. Comprehensions are usually clearer than \`map\`/\`filter\`.

## Scope: LEGB
Python looks a name up in four scopes, in order: **L**ocal (the current function), **E**nclosing functions, **G**lobal (the module), **B**uilt-in (\`len\`, \`print\`). Assigning to a name inside a function makes it local to that function, so to **rebind** an outer name you must declare it: \`global counter\` for module level, \`nonlocal count\` for an enclosing function. Prefer returning values over mutating globals.

## Closures
A nested function that uses variables of its enclosing function **closes over** them: it keeps them alive after the outer function returns. Closures give you factories (\`make_multiplier(3)\`), counters and callbacks with private state. Gotcha: closures capture **variables, not values**. \`[lambda: i for i in range(3)]\` produces three functions that all return 2. Bind the value now with a default argument (\`lambda i=i: i\`) or \`functools.partial\`.

## Decorators
\`@decorator\` above a \`def\` is shorthand for \`func = decorator(func)\`. A decorator takes a function and returns a replacement, usually a \`wrapper(*args, **kwargs)\` that does something before and after calling the original. Use them for cross-cutting concerns: logging, timing, retries, caching, authentication checks, registering routes (\`@app.get("/")\` in FastAPI is a decorator). Rules:
1. Always decorate the wrapper with \`@functools.wraps(func)\` so the name, docstring and signature survive.
2. A decorator **with arguments** (\`@retry(times=3)\`) is a function that returns a decorator: three nested levels.
3. Stacked decorators apply bottom-up: \`@a @b def f\` means \`a(b(f))\`.

## functools: the function toolbox
- \`@cache\` / \`@lru_cache(maxsize=N)\`: memoization in one line, the fastest way to write top-down dynamic programming. Arguments must be hashable.
- \`partial(func, arg)\`: pre-fill arguments.
- \`reduce\`: fold a sequence (prefer \`sum\`, \`max\`, \`math.prod\`, \`"".join\` when they fit).
- \`singledispatch\`: pick an implementation by argument type.
- \`operator.itemgetter\` / \`attrgetter\`: fast key functions for sorting.
`,
    keyPoints: [
      "*args collects positional arguments, **kwargs keyword arguments",
      "Defaults are evaluated once: never use a mutable default",
      "Names resolve Local → Enclosing → Global → Built-in; nonlocal/global to rebind",
      "Closures capture variables, not values (late binding)",
      "A decorator returns a replacement function; always use functools.wraps",
      "@functools.cache memoizes in one line",
    ],
    code: [
      {
        title: "Every kind of parameter",
        variants: [{ lang: "python", code: `def greet(name, greeting="Hello", punctuation="!"):  # parameters with defaults come last
    return f"{greeting}, {name}{punctuation}"


print(greet("Ada"))
print(greet("Ada", "Hi"))
print(greet("Ada", punctuation="?"))  # keyword arguments: any order, self-documenting


def stats(*numbers):  # *args collects extra positional arguments into a tuple
    return min(numbers), max(numbers), sum(numbers) / len(numbers)


lo, hi, avg = stats(4, 8, 15, 16, 23, 42)  # returning a tuple = returning several values
print(lo, hi, avg)


def tag(name, /, *children, cls=None, **attrs):
    # name is positional-only (before /), cls is keyword-only (after *children),
    # **attrs collects any other keyword arguments into a dict
    attrs_text = "".join(f' {k}="{v}"' for k, v in attrs.items())
    cls_text = f' class="{cls}"' if cls else ""
    return f"<{name}{cls_text}{attrs_text}>{''.join(children)}</{name}>"


print(tag("a", "docs", href="/docs", cls="link"))
print(tag("p", "one ", "two"))


def connect(host, port, *, timeout=5.0, retries=3):  # bare * makes the rest keyword-only
    return f"{host}:{port} timeout={timeout} retries={retries}"


print(connect("db", 5432, retries=5))
try:
    connect("db", 5432, 1.0)  # a positional timeout is rejected: call sites stay readable
except TypeError as e:
    print("TypeError:", e)

args = ["db", 5432]
options = {"timeout": 1.5}
print(connect(*args, **options))  # unpack a list into positional and a dict into keyword args


def add_item(item, bucket=[]):  # BUG: the default list is created once, when def runs
    bucket.append(item)
    return bucket


print(add_item("a"), add_item("b"))  # both calls share the same list


def add_item_fixed(item, bucket=None):  # the idiom: default to None, create inside
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket


print(add_item_fixed("a"), add_item_fixed("b"))` }],
        explain: `- \`greet\` shows defaults and **keyword arguments**: \`greet("Ada", punctuation="?")\` skips \`greeting\` and names what it sets.
- \`*numbers\` packs any number of positional arguments into a tuple. Returning \`min, max, avg\` returns one tuple, unpacked into three names.
- \`tag(name, /, *children, cls=None, **attrs)\` uses every kind: \`name\` is positional-only, \`children\` collects the rest of the positional arguments, \`cls\` can only be passed by keyword, and \`**attrs\` collects other keywords into a dict (\`href="/docs"\`).
- The bare \`*\` in \`connect\` makes \`timeout\` and \`retries\` keyword-only, so \`connect("db", 5432, 1.0)\` is rejected with a clear \`TypeError\`. Call sites like \`connect(host, port, retries=5)\` stay readable.
- \`*args\` and \`**options\` at a **call** unpack a list and a dict into arguments.
- The mutable default: both calls to \`add_item\` return the **same** list object, so they print \`['a', 'b'] ['a', 'b']\`. The \`None\` idiom creates a fresh list per call.`,
        output: `Hello, Ada!
Hi, Ada!
Hello, Ada?
4 42 18.0
<a class="link" href="/docs">docs</a>
<p>one two</p>
db:5432 timeout=5.0 retries=5
TypeError: connect() takes 2 positional arguments but 3 were given
db:5432 timeout=1.5 retries=3
['a', 'b'] ['a', 'b']
['a'] ['b']`,
      },
      {
        title: "Scope, closures and late binding",
        variants: [{ lang: "python", code: `# Name lookup follows LEGB: Local, Enclosing function, Global (module), Built-in.
x = "global"


def outer():
    x = "enclosing"

    def inner():
        return x  # not local here, so found in the enclosing function

    return inner()


print(outer(), x, len("builtin len"))


# A closure is a function that remembers variables from the scope where it was defined.
def make_counter(start=0):
    count = start

    def increment(step=1):
        nonlocal count  # rebind the enclosing variable (without nonlocal, count += 1 fails)
        count += step
        return count

    return increment


c1, c2 = make_counter(), make_counter(100)
print(c1(), c1(), c1(5), c2(), c1.__closure__[0].cell_contents)


def make_multiplier(factor):
    return lambda n: n * factor  # lambda: a one-expression anonymous function


double, triple = make_multiplier(2), make_multiplier(3)
print(double(21), triple(7))

# Late binding: closures look variables up when CALLED, not when defined.
callbacks = [lambda: i for i in range(3)]
print([f() for f in callbacks])  # all see the final i

callbacks = [lambda i=i: i for i in range(3)]  # fix 1: bind the current value as a default
print([f() for f in callbacks])

from functools import partial

callbacks = [partial(lambda i: i, i) for i in range(3)]  # fix 2: partial freezes the argument
print([f() for f in callbacks])

total = 0


def add_to_total(n):
    global total  # needed to REBIND a module-level name from inside a function
    total += n


add_to_total(5)
add_to_total(7)
print(total)` }],
        explain: `- \`inner\` doesn't assign \`x\`, so lookup goes Local (not found), then Enclosing (found: "enclosing"). The module-level \`x\` is untouched.
- \`make_counter\` returns \`increment\`, which closes over \`count\`. Each call to \`make_counter\` creates a separate \`count\`, so \`c1\` and \`c2\` don't interfere. \`nonlocal\` is required because \`count += step\` assigns; without it Python would treat \`count\` as a new local and raise \`UnboundLocalError\`. The closure's cell is visible in \`c1.__closure__\`.
- \`make_multiplier\` returns lambdas that remember \`factor\`.
- Late binding: the three lambdas all look up \`i\` when called, after the loop has finished, so they all return 2. Binding the current value with a default argument (\`i=i\`) or with \`functools.partial\` fixes it.
- \`global total\` lets the function rebind the module-level name. Use it sparingly: returning values is easier to test.`,
        output: `enclosing global 11
1 2 7 101 7
42 21
[2, 2, 2]
[0, 1, 2]
[0, 1, 2]
12`,
      },
      {
        title: "Decorators: wrapping, arguments, registration, stacking",
        variants: [{ lang: "python", code: `import functools


# A decorator is a function that takes a function and returns a replacement.
def logged(func):
    @functools.wraps(func)  # copy __name__, __doc__, etc. onto the wrapper
    def wrapper(*args, **kwargs):
        print(f"-> {func.__name__}{args}")
        result = func(*args, **kwargs)
        print(f"<- {func.__name__} returned {result!r}")
        return result

    return wrapper


@logged  # same as: add = logged(add)
def add(a, b):
    """Add two numbers."""
    return a + b


add(2, 3)
print(add.__name__, add.__doc__)


# A decorator with arguments is a function that RETURNS a decorator: three levels.
def retry(times, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    print(f"attempt {attempt} failed: {e}")
                    if attempt == times:
                        raise

        return wrapper

    return decorator


calls = {"n": 0}


@retry(times=3, exceptions=(ConnectionError,))
def flaky_fetch():
    calls["n"] += 1
    if calls["n"] < 3:
        raise ConnectionError("timeout")
    return "data"


print(flaky_fetch())


# Decorators can also register functions instead of wrapping them.
ROUTES = {}


def route(path):
    def register(func):
        ROUTES[path] = func
        return func  # returned unchanged

    return register


@route("/")
def home():
    return "home page"


@route("/about")
def about():
    return "about page"


print({path: fn() for path, fn in ROUTES.items()})


# Stacked decorators apply bottom-up: @a @b def f  ==  f = a(b(f))
def bold(func):
    return lambda: f"<b>{func()}</b>"


def italic(func):
    return lambda: f"<i>{func()}</i>"


@bold
@italic
def hello():
    return "hi"


print(hello())` }],
        explain: `- \`logged\` wraps any function: \`*args, **kwargs\` accept whatever the original takes and pass it on. \`@functools.wraps(func)\` keeps \`add.__name__\` as "add" and its docstring; without it they'd be "wrapper" and \`None\`, breaking debugging, \`help()\` and frameworks that inspect signatures.
- \`retry(times=3, ...)\` is a **decorator factory**: calling it returns the actual decorator, which returns the wrapper. The wrapper re-raises on the last attempt so failures aren't swallowed. Here the fake fetch fails twice and succeeds on the third try.
- \`route\` doesn't wrap at all: it **registers** the function in a dict and returns it unchanged. Flask's \`@app.route\` and FastAPI's \`@app.get\` work like this.
- Stacking: \`@bold\` above \`@italic\` means \`bold(italic(hello))\`, so italic is applied first (innermost).`,
        output: `-> add(2, 3)
<- add returned 5
add Add two numbers.
attempt 1 failed: timeout
attempt 2 failed: timeout
data
{'/': 'home page', '/about': 'about page'}
<b><i>hi</i></b>`,
      },
      {
        title: "functools: cache, lru_cache, partial, reduce, singledispatch",
        variants: [{ lang: "python", code: `import functools
import operator
from dataclasses import dataclass


@functools.cache  # memoize: results are stored by argument
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)


print(fib(90), fib.cache_info())


@functools.lru_cache(maxsize=2)  # bounded: evicts the least recently used result
def square(n: int) -> int:
    print(f"  computing {n}^2")
    return n * n


for n in [2, 3, 2, 4, 3]:
    square(n)
print(square.cache_info())

# partial: fix some arguments now, pass the rest later
parse_hex = functools.partial(int, base=16)
print(parse_hex("ff"), parse_hex("1a"))

# reduce: fold a sequence into one value (often sum, max or math.prod is clearer)
print(functools.reduce(operator.mul, [1, 2, 3, 4, 5]), functools.reduce(lambda a, b: a * 10 + b, [4, 2, 7]))


@dataclass
class Employee:
    name: str
    dept: str
    salary: int


staff = [Employee("ana", "eng", 120), Employee("ben", "ops", 90), Employee("cho", "eng", 135)]
print([e.name for e in sorted(staff, key=operator.attrgetter("dept", "salary"))])
rows = [("x", 3), ("y", 1), ("z", 2)]
print(sorted(rows, key=operator.itemgetter(1)))


# singledispatch: choose an implementation by the type of the first argument
@functools.singledispatch
def describe(value) -> str:
    return f"something: {value!r}"


@describe.register
def _(value: int) -> str:
    return f"an int with {value.bit_length()} bits"


@describe.register
def _(value: list) -> str:
    return f"a list of {len(value)} items"


print(describe(255), "|", describe([1, 2]), "|", describe(3.5))` }],
        explain: `- Naive recursive \`fib(90)\` would make about 10¹⁸ calls; with \`@cache\` each \`n\` is computed once: 91 misses and 88 hits. This is top-down dynamic programming in one line.
- \`lru_cache(maxsize=2)\` keeps only the 2 most recently used results. The trace shows 3 being recomputed because 4 evicted it.
- \`partial(int, base=16)\` makes a new callable with \`base\` pre-filled.
- \`reduce\` folds left to right: \`((((1*2)*3)*4)*5) = 120\`, and the second one builds the number 427 from digits.
- \`attrgetter("dept", "salary")\` returns a tuple key: department first, then salary. \`itemgetter(1)\` sorts rows by their second field.
- \`singledispatch\` picks the registered implementation from the type of the first argument, falling back to the base function for other types (here, float).`,
        output: `2880067194370816120 CacheInfo(hits=88, misses=91, maxsize=None, currsize=91)
  computing 2^2
  computing 3^2
  computing 4^2
  computing 3^2
CacheInfo(hits=1, misses=4, maxsize=2, currsize=2)
255 26
120 427
['ana', 'cho', 'ben']
[('y', 1), ('z', 2), ('x', 3)]
an int with 8 bits | a list of 2 items | something: 3.5`,
      },
    ],
    interview: [
      {
        q: "What are *args and **kwargs?",
        a: `In a function definition, \`*args\` collects extra **positional** arguments into a tuple and \`**kwargs\` collects extra **keyword** arguments into a dict. At a call site the same symbols **unpack**: \`f(*items, **options)\`. They're how decorators and wrappers forward any signature: \`def wrapper(*args, **kwargs): return func(*args, **kwargs)\`. The names are convention; the stars matter.`,
        freq: "very-common",
      },
      {
        q: "Explain the mutable default argument pitfall.",
        a: `Default values are evaluated **once**, when \`def\` executes, and stored on the function (\`func.__defaults__\`). If the default is mutable (\`[]\`, \`{}\`, \`set()\`), every call that doesn't pass the argument shares and mutates the same object, so state leaks between calls. Fix: \`def f(items=None): if items is None: items = []\`. Linters (ruff rule B006) catch it. The same applies to mutable class attributes shared by all instances.`,
        freq: "very-common",
      },
      {
        q: "What is a closure? What's the late-binding gotcha?",
        a: `A closure is a nested function that references variables from its enclosing function; Python keeps those variables alive in **cells** after the outer function returns. Closures capture **variables, not values**, and look them up at call time. So \`[lambda: i for i in range(3)]\` creates three functions that all return 2 (the last value of \`i\`). Fix by binding the current value: \`lambda i=i: i\` or \`functools.partial(f, i)\`.`,
        freq: "common",
      },
      {
        q: "What is a decorator? Write one that times a function.",
        a: `A decorator is a callable that takes a function and returns a replacement; \`@timed\` above \`def f\` means \`f = timed(f)\`.
\`\`\`python
import functools, time

def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            print(f"{func.__name__} took {time.perf_counter() - start:.3f}s")
    return wrapper
\`\`\`
Points interviewers look for: \`*args/**kwargs\` forwarding, \`functools.wraps\`, returning the result, \`perf_counter\` (monotonic, high resolution), and \`try/finally\` so the time is logged even on exceptions. A decorator with arguments adds one more level of nesting.`,
        freq: "very-common",
      },
      {
        q: "Explain LEGB, global and nonlocal.",
        a: `Name lookup goes **L**ocal, **E**nclosing (outer functions), **G**lobal (the module), **B**uilt-in. Scope is decided at compile time: if a function **assigns** to a name anywhere, that name is local throughout the function, which is why reading it before assigning raises \`UnboundLocalError\`. \`global x\` makes assignments rebind the module-level \`x\`; \`nonlocal x\` rebinds the nearest enclosing function's \`x\`. Mutating an outer object (\`items.append\`) needs neither, because it doesn't rebind the name.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "def f(a, b=[]): b.append(a); return b. What does f(2) return after f(1) was called?",
        options: ["[2]", "[1, 2]", "[2, 1]", "TypeError"],
        answer: 1,
        explain: "The default list is created once and shared, so it still holds 1 when 2 is appended.",
      },
      {
        q: "fs = [lambda: i for i in range(3)]. What is fs[0]()?",
        options: ["0", "1", "2", "NameError"],
        answer: 2,
        explain: "Closures look up i when called; by then the comprehension has finished and i is 2.",
      },
      {
        q: "@d1 above @d2 above def f(): ... is equivalent to:",
        options: ["f = d2(d1(f))", "f = d1(d2(f))", "f = d1(f); f = d2(f)", "f = (d1, d2)(f)"],
        answer: 1,
        explain: "Decorators apply bottom-up: the one closest to def wraps first.",
      },
      {
        q: "What does functools.wraps do in a decorator?",
        options: ["Caches the results", "Copies the wrapped function's name, docstring and other metadata onto the wrapper", "Makes the wrapper thread-safe", "Times the call"],
        answer: 1,
        explain: "Without it, the decorated function reports the wrapper's name and loses its docstring and signature info.",
      },
      {
        q: "def f(a, *, b): ... What does f(1, 2) do?",
        options: ["Sets b = 2", "Raises TypeError", "Ignores the 2", "Sets a = (1, 2)"],
        answer: 1,
        explain: "Parameters after a bare * are keyword-only: call it as f(1, b=2).",
      },
    ],
  },
];
