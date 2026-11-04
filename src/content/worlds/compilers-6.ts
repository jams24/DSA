import type { Lesson } from "../types";

// Compilers, part 6: build your own compiler (pebblec: Pebble to native code through LLVM IR),
// then the interview wrap-up.

export const compilersPart6: Lesson[] = [
  // ------------------------------------------------------------------ PROJECT: THE COMPILER
  {
    id: "comp-project-compiler",
    part: "Part 6 · Build your own compiler",
    title: "Project: build pebblec, a native compiler",
    tagline: "Turn Pebble programs into real executables: reuse the interpreter's front end, add a static type checker, generate LLVM IR for functions, loops, short-circuit logic and Python-style division, drive clang, and prove it correct by testing it against the interpreter.",
    difficulty: "advanced",
    minutes: 150,
    diagram: {
      title: "Inside pebblec",
      nodes: [
        { id: "src", label: "collatz.pb", kind: "client", x: 100, y: 120, sub: "a Pebble program" },
        { id: "front", label: "Pebble front end", kind: "gateway", x: 300, y: 120, sub: "lexer + parser, reused" },
        { id: "checker", label: "checker.py", kind: "control", x: 510, y: 120, sub: "int, bool, void" },
        { id: "codegen", label: "codegen.py", kind: "service", x: 720, y: 120, sub: "AST + types → LLVM IR" },
        { id: "llvm", label: "clang / LLVM", kind: "gpu", x: 880, y: 300, sub: "optimise, select, allocate, link" },
        { id: "exe", label: "./collatz", kind: "node", x: 720, y: 460, sub: "a native executable" },
        { id: "errors", label: "Errors", kind: "monitor", x: 510, y: 330, sub: "file:line:col, exit 65" },
        { id: "interp", label: "Pebble interpreter", kind: "worker", x: 300, y: 380, sub: "the reference for testing" },
      ],
      edges: [
        { from: "src", to: "front" },
        { from: "front", to: "checker", label: "AST" },
        { from: "checker", to: "codegen", label: "AST + types" },
        { from: "codegen", to: "llvm", label: "collatz.ll" },
        { from: "llvm", to: "exe" },
        { from: "checker", to: "errors", label: "type error", dashed: true },
        { from: "front", to: "interp", label: "same AST", dashed: true },
      ],
      flows: [
        {
          name: "python -m pebblec collatz.pb",
          path: ["src", "front", "checker", "codegen", "llvm", "exe"],
          steps: [
            "The interpreter's lexer and parser turn the source into the very same AST the interpreter runs.",
            "The checker gives every expression a type and every function a return type, or stops with an error.",
            "The code generator writes LLVM IR: one function per Pebble function, a stack slot per variable.",
            "clang optimises the IR, selects ARM64 or x86-64 instructions, allocates registers and links with libc.",
            "Out comes a native program that finds the longest Collatz chain below a million in a fraction of a second.",
          ],
        },
        {
          name: "A type error: ok + true",
          path: ["src", "front", "checker", "errors"],
          steps: [
            "The program parses fine: it's valid Pebble.",
            "But '+' needs two ints, and true is a bool.",
            "pebblec prints file:line:col and the source line, exits with 65, and writes no executable.",
          ],
        },
        {
          name: "Testing: one tree, two back ends",
          path: ["src", "front", "interp"],
          steps: [
            "The test suite parses the same program once for each implementation.",
            "The interpreter's output is the reference: the compiled program must print exactly the same thing.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
In the last project you built a **reader**: Pebble reads your program and acts it out, line by line, every time you run it. Now you'll build a **translator**: pebblec translates your program **once** into the computer's own language, and from then on the computer runs it directly, with nobody reading over its shoulder. That's why it's about **100 times faster**.

And here's the best part: you don't need to start from scratch. The part that **understands** Pebble (the lexer and the parser) is already written. You only need the part that **checks** the program makes sense and the part that **writes** the translation.

## What you'll build
**pebblec** compiles Pebble programs to native executables, like \`gcc\` or \`rustc\` do:
\`\`\`text
$ python -m pebblec examples/native/collatz.pb
$ ./examples/native/collatz
longest chain below 1000000 starts at 837799 with 525 numbers
\`\`\`
It's a real compiler with every phase from this world:
| Phase | In pebblec | Lesson |
|---|---|---|
| Lexing and parsing | reused from the Pebble interpreter | Parts 2 and 3 |
| Semantic analysis | \`checker.py\`: scopes, types, return analysis | Semantic analysis, Type checking |
| IR generation | \`codegen.py\`: LLVM IR with basic blocks, branches, a phi | IRs, LLVM |
| Optimization | LLVM's passes, via \`clang -O2\` | Optimization |
| Back end and linking | LLVM and the system linker, via \`clang\` | Part 5 |
| Driver | \`__main__.py\`: options, errors, exit codes | Linking, the Pebble CLI |

## Which Pebble does it compile?
The interpreter checks types while the program runs: every \`+\` looks at its operands first. Native code can't afford that, and doesn't need to: a CPU's \`add\` just adds two 64-bit numbers. So a compiler wants to know every type **before** the program runs. pebblec compiles a **statically typed subset** of Pebble:
- two types: \`int\` (64 bits) and \`bool\`; string literals only as \`print\` arguments;
- functions declared at the top level, with int parameters, returning an int, a bool or nothing;
- conditions must be bools (in Pebble every int is truthy, so \`while n\` would loop forever);
- no lists, closures, anonymous functions or \`nil\`: those need a **runtime** (memory allocation and garbage collection, from the runtimes lesson). They're the first extensions below.

Every program pebblec accepts means **exactly** the same thing to the interpreter. That's a design rule, and the tests enforce it.

## Why LLVM IR, and not assembly?
You could write x86-64 assembly directly, as the code generation lesson did. Generating **LLVM IR** instead gives you, for free: every CPU LLVM supports (the same pebblec works on an Apple silicon Mac, an Intel laptop and a Raspberry Pi), a world-class optimizer, register allocation, and the assembler and linker driver. It's what Rust, Swift, Zig and Julia do. The IR is plain **text**, so the code generator is just Python building strings.

We use the trick from the LLVM lesson: give every variable a stack slot (\`alloca\`), and \`load\`/\`store\` it. No SSA construction needed: LLVM's **mem2reg** pass turns the slots into registers and phis.

## How the build goes
Four steps, each ending with passing tests: 59 (the interpreter's, still green), then 80, 88 and finally 95. You need Python 3.11+, pytest and **clang**:
- **macOS**: \`xcode-select --install\` (Apple's clang works);
- **Ubuntu/Debian**: \`sudo apt install clang\`;
- **Windows**: use WSL with Ubuntu, then as above.

Start from your finished Pebble interpreter: pebblec is a second package **in the same project**, importing \`pebble.parser\`.

## The payoff
Same program, same machine: \`examples/native/fib.pb\` (up to \`fib(30)\`, 1.6 million calls) takes about **15 seconds** in the Pebble interpreter and about **0.1 seconds** compiled. The Collatz search (130 million loop iterations) is out of reach for the interpreter and takes well under a second native.`,
    keyPoints: [
      "pebblec reuses the interpreter's front end: a compiler and an interpreter can share everything up to the AST",
      "Native code needs types before run time, so pebblec compiles a statically typed subset: int, bool, void functions",
      "The checker works out return types first (a fixpoint handles mutual recursion), then checks every expression",
      "The code generator emits LLVM IR: allocas for variables, blocks and branches for control flow, a phi for and/or",
      "Pebble's floor division and division-by-zero error need extra code: sdiv truncates and would trap",
      "Differential testing against the interpreter catches miscompilations; clang does optimization, codegen and linking",
    ],
    interview: [
      {
        q: "Tell me about a compiler (or interpreter) you've built.",
        freq: "common",
        a: `Structure it like any project story: **what** (a compiler for a small language to native code through LLVM IR, sharing its front end with a tree-walking interpreter), **design decisions** (a statically typed subset so code needs no run-time type checks; alloca-per-variable IR and mem2reg instead of building SSA; LLVM for portability and optimization; Pebble's semantics as the specification), **hard parts** (inferring return types for mutually recursive functions with a fixpoint; floor division and division by zero, because \`sdiv\` truncates and division by zero is undefined; short-circuit operators needing a phi; LLVM's rule that every block ends in a terminator), **testing** (unit tests per phase, end-to-end examples, differential testing against the interpreter on random programs) and **results** (100× faster than the interpreter on recursive code). Then say what you'd do next: a runtime for lists and strings, closures, overflow checks.`,
      },
      {
        q: "Why target LLVM IR instead of generating assembly yourself?",
        freq: "common",
        a: `LLVM gives you, from one IR: dozens of targets (x86-64, ARM64, RISC-V, WebAssembly), a mature optimizer (inlining, SROA/mem2reg, GVN, LICM, vectorization), instruction selection, register allocation, scheduling, debug info and object file emission. Writing those yourself is years of work. IR is typed and verified, so mistakes are caught early (\`opt -passes=verify\`). The costs: LLVM is big and compiles slowly (a problem for debug builds and JITs, which is why Go, Cranelift and Zig's self-hosted back end exist), and its semantics (undefined behaviour, poison) leak into your language unless you're careful, as with division by zero.`,
      },
      {
        q: "How do you know your compiler generates correct code?",
        freq: "common",
        a: `Layers of testing: **unit tests** per phase (type errors with exact messages and lines, IR snippets), **end-to-end tests** that compile and run example programs and compare output and exit codes, **regression tests** for every bug found, and **differential testing**: generate many random valid programs and compare the compiler's output with a reference (an interpreter, another compiler, or the same compiler at -O0 vs -O2). Csmith found hundreds of bugs in GCC and LLVM this way. Also: run the IR verifier, test at several optimization levels, and use sanitizers on the generated code.`,
      },
      {
        q: "Why does a compiler for a dynamic language have a harder job than one for a static language?",
        freq: "occasional",
        a: `Without static types, the compiler doesn't know what \`a + b\` means: ints, floats, strings, objects with an overloaded \`+\`. AOT code must check the types on every operation and box values (or tag them), allocate for numbers, and call generic runtime routines, which is why naive compilation of Python barely beats interpretation. The solutions: restrict the language to a typed subset (pebblec, Cython, RPython), add type annotations, infer types (Hindley–Milner, flow analysis), or **JIT compile** using observed types with guards and deoptimization (V8, PyPy).`,
      },
    ],
    quiz: [
      {
        q: "Why does pebblec insist that `while` conditions are bools?",
        options: [
          "LLVM can't branch on integers",
          "In Pebble every int is truthy, so `while n` would mean something surprising; requiring a bool keeps compiled and interpreted meaning identical",
          "To make the parser simpler",
          "Bools are faster than ints",
        ],
        answer: 1,
        explain: "Every program pebblec accepts must mean exactly what it means to the interpreter.",
      },
      {
        q: "LLVM's `sdiv` gives -3 for `-7 / 2`. What does pebblec's compiled code print, and why?",
        options: [
          "-3, because that's what the CPU does",
          "-4, because the generated code adjusts the quotient when the remainder's sign differs from the divisor's",
          "-3.5",
          "It refuses to compile it",
        ],
        answer: 1,
        explain: "Pebble rounds down like Python's floor division, so the code generator adds a fix-up after `sdiv`.",
      },
      {
        q: "pebblec gives every variable an `alloca` and loads and stores it. Why isn't that slow?",
        options: [
          "Stack memory is as fast as registers",
          "LLVM's mem2reg pass turns the slots into SSA registers (with phis) before optimizing further",
          "It is slow, but nobody cares",
          "clang ignores allocas",
        ],
        answer: 1,
        explain: "That's the same strategy clang uses for C: simple front end, let LLVM build SSA.",
      },
      {
        q: "Why does `a and b` need a `phi` instruction in the generated IR?",
        options: [
          "Because and is a function call",
          "The result comes from two different blocks: false if a was false (b never ran), or b's value",
          "To compute both sides in parallel",
          "phi is LLVM's and instruction",
        ],
        answer: 1,
        explain: "Short-circuiting means two paths into the end block, and phi picks the value by which block we came from.",
      },
      {
        q: "In the differential test, what is the reference that the compiled program is checked against?",
        options: [
          "Hand-written expected outputs",
          "The Pebble interpreter running the same random programs",
          "GCC",
          "The LLVM verifier",
        ],
        answer: 1,
        explain: "Two implementations of one language must agree; any difference is a bug in one of them.",
      },
    ],
    project: {
      summary: `You'll build **pebblec**, a compiler from Pebble to native machine code, on top of the Pebble interpreter you built earlier. It reuses the interpreter's lexer and parser, adds a static type checker and an LLVM IR code generator, and uses clang for optimization, code generation and linking. The finished compiler turns \`.pb\` files into executables that run around 100 times faster than the interpreter, and its tests prove that both always agree.

Work **inside your finished Pebble project** (all of its files are the starting point, and its 59 tests must keep passing). Add each step's files in order and run the commands shown. You need **Python 3.11+**, **pytest** and **clang** (see "How the build goes" above).`,
      skills: [
        "Reusing a front end: one AST, two back ends (interpreter and compiler)",
        "Designing a statically typed subset of a dynamic language",
        "Type checking with return-type inference for mutually recursive functions",
        "Generating LLVM IR: functions, allocas, basic blocks, branches, phi and select",
        "Matching a language's semantics exactly: floor division, division by zero, short circuits",
        "Driving clang as a back end and building a compiler CLI with good errors",
        "Differential testing of a compiler against an interpreter",
      ],
      tree: `pebble/                  # your finished Pebble interpreter project, plus:
├── hello.ll             # step 1: LLVM IR written by hand
├── pebblec/
│   ├── __init__.py      # compile_to_llvm(): parse, check, generate
│   ├── __main__.py      # python -m pebblec: .pb → .ll → native executable
│   ├── checker.py       # static types: int, bool and void
│   └── codegen.py       # the checked AST → LLVM IR text
├── examples/native/
│   ├── fib.pb   primes.pb   collatz.pb   fizzbuzz.pb
└── tests/               # the interpreter's tests, plus:
    ├── conftest.py      # run_native: compile, link and run a program
    ├── test_checker.py   test_codegen.py
    └── test_pebblec.py`,
      steps: [
        {
          title: "1. Set up: a compiler package next to the interpreter",
          explain: `First, make sure the back end you're going to rely on works, and meet the language you're going to generate.
- \`pebblec/__init__.py\` is just a docstring for now. Putting the compiler in the **same project** as the interpreter means \`from pebble.parser import parse\` works: the lexer, parser and AST are shared. Any compiler you ever write should start by reusing a front end if one exists.
- \`hello.ll\` is LLVM IR written by hand. Read it top to bottom:
  - \`@msg\` is a global **constant array of 21 bytes**: the 19 characters, \`\\0A\` (a newline, in hex) and \`\\00\`, the zero byte that ends every C string. Get the length wrong and clang refuses the file.
  - \`declare i32 @printf(ptr, ...)\` says printf exists somewhere else (in the C library) and takes a pointer plus any number of arguments. The linker will find it.
  - \`define i32 @main()\` is the program's entry point, with one basic block, \`entry\`, which calls printf and returns 0.
- \`clang hello.ll\` does everything from Part 5 in one command: optimization, instruction selection, register allocation, assembling and linking. \`-Wno-override-module\` silences a warning that clang is filling in the target CPU, because our file doesn't name one.

Try it: change the message (and the length!), or remove \`ret i32 0\` and read the error.`,
          files: [
            { path: "pebblec/__init__.py", lang: "python", code: `"""pebblec: compile Pebble to LLVM IR, then let clang turn the IR into a native executable.

The front end (lexer, parser, AST) is the interpreter's: a compiler and an interpreter for the same
language can share everything up to the tree."""` },
            { path: "hello.ll", lang: "llvm", code: `; The smallest useful LLVM program, written by hand. pebblec will generate files just like this.
@msg = private unnamed_addr constant [21 x i8] c"hello from LLVM IR!\\0A\\00"

declare i32 @printf(ptr, ...)

define i32 @main() {
entry:
  %n = call i32 (ptr, ...) @printf(ptr @msg)
  ret i32 0
}` },
          ],
          run: `python -m pytest -q                      # the interpreter's 59 tests still pass
clang -Wno-override-module hello.ll -o hello && ./hello
python -c 'import pebblec; print(pebblec.__doc__.splitlines()[0])'`,
          output: `59 passed
hello from LLVM IR!
pebblec: compile Pebble to LLVM IR, then let clang turn the IR into a native executable.`,
        },
        {
          title: "2. Static types: the checker",
          explain: `The interpreter discovers types as it runs. A compiler must know them **before**: \`add i64\` and \`and i1\` are different instructions, and there's no room for a check on every operation. \`checker.py\` is the semantic analysis phase.
- The docstring states the subset. \`TypeError_\` is a \`PebbleError\`, so it carries a line and column and prints just like the interpreter's errors.
- **Return types come first.** Functions can call each other in any order, even recursively, so each call needs its callee's return type before that callee's body is checked. \`guess_return_type\` reads the **shape** of the return statements: \`return n % 2 == 0\` is obviously a bool, \`return x * x\` an int, a function with no \`return value\` is \`void\`.
- Mutual recursion needs more: \`is_even\` returns \`is_odd(...)\`, whose type isn't known yet. The \`while changed\` loop in \`check\` repeats until nothing new is learned: in round one \`is_odd\` gets \`bool\` (from \`return false\`), in round two so does \`is_even\`. This **fixpoint** iteration is the same idea as the data-flow analyses in the optimization lesson.
- Then every statement is checked with a stack of scopes. \`expr\` records each expression's type in \`self.types\`, keyed by the node itself: the code generator will read it to choose \`i64\` or \`i1\`.
- \`always_returns\` implements Java's "missing return statement" check: an \`if\` returns on all paths only if both branches do; loops never count, because they might not run. That's why a function that returns a value can end with \`unreachable\` in step 3.
- \`value()\` versus \`expr()\`: a void call is fine as a statement, but not where a value is needed (\`let x = hi();\`).
- The tests cover 17 different errors, each with its exact message and line, plus mutual recursion and the type of every expression.`,
          files: [
            { path: "pebblec/checker.py", lang: "python", code: `"""The type checker. Native code needs to know every value's type before the program runs, so
pebblec compiles a statically typed subset of Pebble:
  - two types, int (64-bit) and bool; string literals only as print arguments
  - functions are declared at the top level, take ints, and return int, bool or nothing (void)
  - conditions must be bools: in Pebble every int is true, so \`while n\` is almost always a bug
  - no lists, lambdas, closures or nil (the interpreter has them; a compiler needs a runtime for those)
Every program pebblec accepts means the same thing to the interpreter. The checker records the type
of every expression in \`types\`, for the code generator."""
from pebble.errors import PebbleError
from pebble.nodes import (Assign, Binary, Block, Call, Expr, ExprStmt, FnDecl, If, Index, Lambda, Let,
                          ListLit, Literal, Print, Return, Stmt, Unary, Var, While)


class TypeError_(PebbleError):
    kind = "type error"


ARITH = {"+", "-", "*", "/", "%"}
ORDER = {"<", "<=", ">", ">="}
GIVES_BOOL = ORDER | {"==", "!=", "and", "or"}


def returns_in(stmts: list[Stmt]):
    """Every return statement in a function body."""
    for s in stmts:
        match s:
            case Return():
                yield s
            case If(_, then, otherwise):
                yield from returns_in(then)
                yield from returns_in(otherwise or [])
            case While(_, body) | Block(body):
                yield from returns_in(body)


def always_returns(stmts: list[Stmt]) -> bool:
    """Does every path through these statements end at a return? (javac calls the failure
    "missing return statement".) Loops don't count: the checker can't know they run at all."""
    for s in stmts:
        match s:
            case Return():
                return True
            case If(_, then, otherwise) if otherwise is not None and always_returns(then) and always_returns(otherwise):
                return True
            case Block(body) if always_returns(body):
                return True
    return False


def shape(e: Expr, known: dict[str, str | None], local: dict[str, str]) -> str | None:
    """The type an expression obviously has from its shape alone, or None if we can't tell yet."""
    match e:
        case Binary(op) if op in GIVES_BOOL:
            return "bool"
        case Unary("!") | Literal(bool()):
            return "bool"
        case Binary(op) if op in ARITH:
            return "int"
        case Unary("-") | Literal(int()):
            return "int"
        case Call(Var(name)):
            return known.get(name)
        case Var(name):
            return local.get(name)
    return None


def guess_return_type(fn: FnDecl, known: dict[str, str | None]) -> str | None:
    """Guess a function's return type from what its return statements look like, so that calls
    (including recursive ones) have a type before the body is checked. The first return whose type
    is clear decides; the checker then verifies that every return agrees."""
    if all(r.value is None for r in returns_in(fn.fn.body)):
        return "void"
    found: list[str] = []
    local = {p: "int" for p in fn.fn.params}

    def walk(stmts):
        for s in stmts:
            match s:
                case Let(name, value) if (t := shape(value, known, local)) is not None:
                    local[name] = t
                case Return(value) if value is not None and (t := shape(value, known, local)):
                    found.append(t)
                case If(_, then, otherwise):
                    walk(then)
                    walk(otherwise or [])
                case While(_, body) | Block(body):
                    walk(body)
    walk(fn.fn.body)
    return found[0] if found else None


class Checker:
    def __init__(self):
        self.types: dict[Expr, str] = {}                 # expression -> "int" | "bool" | "string" | "void"
        self.functions: dict[str, tuple[int, str]] = {}  # name -> (number of params, return type)
        self.scopes: list[dict[str, str]] = [{}]         # the first scope holds the globals
        self.current: tuple[str, str] | None = None      # (function name, return type)

    def error(self, message: str, node):
        raise TypeError_(message, node.line, getattr(node, "col", 0))

    def check(self, program: list[Stmt]) -> dict[Expr, str]:
        fns = [s for s in program if isinstance(s, FnDecl)]
        known: dict[str, str | None] = {}
        for f in fns:  # declare every function first: they can call each other in any order
            if f.name in known:
                self.error(f"function '{f.name}' is already defined", f)
            known[f.name] = None
        changed = True
        while changed:  # repeat until nothing new is learned: is_even's guess can come from is_odd's
            changed = False
            for f in fns:
                if known[f.name] is None and (t := guess_return_type(f, known)) is not None:
                    known[f.name], changed = t, True  # each name is set at most once, so this ends
        self.functions = {f.name: (len(f.fn.params), known[f.name] or "int") for f in fns}
        for s in program:
            self.stmt(s)
        return self.types

    # ---------------------------------------------------------------- statements
    def lookup(self, var: Var) -> str:
        for scope in reversed(self.scopes):
            if var.name in scope:
                return scope[var.name]
        if var.name in self.functions:
            self.error(f"'{var.name}' is a function; pebblec can only call functions, not store them", var)
        self.error(f"undefined variable '{var.name}'", var)

    def block(self, stmts: list[Stmt]) -> None:
        self.scopes.append({})
        for s in stmts:
            self.stmt(s)
        self.scopes.pop()

    def stmt(self, s: Stmt) -> None:
        match s:
            case Let(name, value):
                if name in self.scopes[-1]:
                    self.error(f"'{name}' is already declared in this scope", s)
                self.scopes[-1][name] = self.value(value)
            case Assign(Var() as target, value):
                want, have = self.lookup(target), self.value(value)
                if want != have:
                    self.error(f"'{target.name}' is {want}; can't assign a {have}", s)
            case Assign():
                self.error("pebblec doesn't support lists", s)
            case Print(values):
                for v in values:
                    if isinstance(v, Literal) and isinstance(v.value, str):
                        self.types[v] = "string"
                    else:
                        self.value(v)
            case If(cond, then, otherwise):
                self.condition(cond, "if")
                self.block(then)
                if otherwise is not None:
                    self.block(otherwise)
            case While(cond, body):
                self.condition(cond, "while")
                self.block(body)
            case FnDecl(name, fn):
                if self.current is not None or len(self.scopes) > 1:
                    self.error("pebblec only supports functions declared at the top level", s)
                ret = self.functions[name][1]
                self.current = (name, ret)
                self.scopes.append({p: "int" for p in fn.params})  # parameters are ints
                for x in fn.body:
                    self.stmt(x)
                self.scopes.pop()
                self.current = None
                if ret != "void" and not always_returns(fn.body):
                    self.error(f"'{name}' might reach its end without returning a value", s)
            case Return(value):
                if self.current is None:
                    self.error("'return' outside a function", s)
                name, want = self.current
                if value is None:
                    if want != "void":
                        self.error(f"'{name}' returns {want}; a bare 'return' returns nothing", s)
                elif (have := self.value(value)) != want:
                    self.error(f"'{name}' returns {want}, but this returns {have}", s)
            case ExprStmt(expr):
                self.expr(expr)  # the one place a void call is fine: its result isn't used
            case Block(stmts):
                self.block(stmts)

    def condition(self, cond: Expr, where: str) -> None:
        if (t := self.value(cond)) != "bool":
            self.error(f"the condition of '{where}' must be a bool, got {t}", cond)

    def value(self, e: Expr) -> str:
        """Check an expression whose value is used, so it must be an int or a bool."""
        t = self.expr(e)
        if t == "string":
            self.error("pebblec only supports strings as print arguments", e)
        if t == "void":
            self.error(f"'{e.callee.name}' doesn't return a value", e)
        return t

    # ---------------------------------------------------------------- expressions
    def expr(self, e: Expr) -> str:
        t = self.infer(e)
        self.types[e] = t
        return t

    def infer(self, e: Expr) -> str:
        match e:
            case Literal(bool()):
                return "bool"
            case Literal(int()):
                return "int"
            case Literal(str()):
                return "string"
            case Literal(None):
                self.error("pebblec doesn't support nil", e)
            case Var():
                return self.lookup(e)
            case Unary("-", operand):
                if (t := self.value(operand)) != "int":
                    self.error(f"can't negate a {t}", e)
                return "int"
            case Unary("!", operand):
                if (t := self.value(operand)) != "bool":
                    self.error(f"'!' needs a bool, got {t}", e)
                return "bool"
            case Binary(op, left, right):
                a, b = self.value(left), self.value(right)
                if op in ("and", "or"):
                    if (a, b) != ("bool", "bool"):
                        self.error(f"'{op}' needs two bools, got {a} and {b}", e)
                    return "bool"
                if op in ("==", "!="):
                    if a != b:
                        self.error(f"can't compare {a} with {b}", e)
                    return "bool"
                if (a, b) != ("int", "int"):
                    self.error(f"'{op}' needs two ints, got {a} and {b}", e)
                return "bool" if op in ORDER else "int"
            case Call(Var(name) as callee, args):
                if name not in self.functions:
                    self.error(f"undefined function '{name}'", callee)
                arity, ret = self.functions[name]
                if len(args) != arity:
                    self.error(f"'{name}' takes {arity} argument(s), got {len(args)}", e)
                for a in args:
                    if (t := self.value(a)) != "int":
                        self.error(f"arguments are ints in pebblec, got {t}", e)
                return ret
            case Call():
                self.error("pebblec can only call functions by name", e)
            case ListLit() | Index():
                self.error("pebblec doesn't support lists", e)
            case Lambda():
                self.error("pebblec doesn't support anonymous functions or closures", e)
        raise AssertionError(e)` },
            { path: "tests/test_checker.py", lang: "python", code: `import pytest

from pebble.parser import parse
from pebblec.checker import Checker, TypeError_


def check(src: str) -> Checker:
    checker = Checker()
    checker.check(parse(src))
    return checker


@pytest.mark.parametrize("src, message, line", [
    ("let x = 1 + true;", "'+' needs two ints, got int and bool", 1),
    ("let b = true;\\nb = 5;", "'b' is bool; can't assign a int", 2),
    ("if 1 == true { }", "can't compare int with bool", 1),
    ("let n = 3;\\nwhile n { n = n - 1; }", "the condition of 'while' must be a bool, got int", 2),
    ('let s = "text";', "pebblec only supports strings as print arguments", 1),
    ("fn f(a) { return a; }\\nprint f(1, 2);", "'f' takes 1 argument(s), got 2", 2),
    ("fn f(a) { return a; }\\nprint f(true);", "arguments are ints in pebblec, got bool", 2),
    ("fn even(n) { return n % 2 == 0; }\\nlet x = even(4) + 1;", "'+' needs two ints, got bool and int", 2),
    ("fn f(n) { if n > 0 { return true; } return n; }", "'f' returns bool, but this returns int", 1),
    ("fn f(n) {\\n  if n > 0 { return 1; }\\n}", "'f' might reach its end without returning a value", 1),
    ('fn hi() { print "hi"; }\\nlet x = hi();', "'hi' doesn't return a value", 2),
    ("print missing;", "undefined variable 'missing'", 1),
    ("print nope(1);", "undefined function 'nope'", 1),
    ("let xs = [1, 2];", "pebblec doesn't support lists", 1),
    ("let f = fn(x) { return x; };", "pebblec doesn't support anonymous functions or closures", 1),
    ("fn outer() { fn inner() { } }", "pebblec only supports functions declared at the top level", 1),
    ("let a = 1;\\nlet a = 2;", "'a' is already declared in this scope", 2),
])
def test_type_errors_are_caught_at_compile_time(src, message, line):
    with pytest.raises(TypeError_) as e:
        check(src)
    assert (e.value.message, e.value.line) == (message, line)


def test_return_types_are_worked_out_before_bodies_are_checked():
    checker = check("""
        fn is_even(n) { if n == 0 { return true; } return is_odd(n - 1); }
        fn is_odd(n) { if n == 0 { return false; } return is_even(n - 1); }
        fn has_factor(n) { let found = false; let d = 2; while d < n { if n % d == 0 { found = true; } d = d + 1; } return found; }
        print is_even(10), has_factor(9);
    """)
    assert checker.functions == {"is_even": (1, "bool"), "is_odd": (1, "bool"), "has_factor": (1, "bool")}


def test_every_expression_gets_a_type():
    program = parse("let x = 1 + 2 * 3; print x > 5;")
    checker = Checker()
    types = checker.check(program)
    assert types[program[0].value] == "int"       # 1 + 2 * 3
    assert types[program[1].values[0]] == "bool"  # x > 5
    assert len(types) == 8                        # 1, 2, 3, 2 * 3, 1 + 2 * 3, x, 5, x > 5


def test_both_branches_returning_counts_as_always_returning():
    assert check("fn sign(n) { if n < 0 { return -1; } else { return 1; } }").functions["sign"] == (1, "int")


def test_functions_without_a_value_return_are_void():
    assert check('fn hi(n) { print "hi", n; } hi(1);').functions["hi"] == (1, "void")` },
          ],
          run: `python -m pytest -q
python - <<'PY'
from pebble.errors import PebbleError
from pebble.parser import parse
from pebblec.checker import Checker

checker = Checker()
checker.check(parse("""
fn is_even(n) { if n == 0 { return true; } return is_odd(n - 1); }
fn is_odd(n) { if n == 0 { return false; } return is_even(n - 1); }
fn greet(n) { print "hello", n; }
greet(4);
"""))
print(checker.functions)
for bad in ["let x = 1 + true;", "let n = 3;\\nwhile n { n = n - 1; }",
            "fn f(n) {\\n  if n > 0 { return 1; }\\n}", "let xs = [1, 2];"]:
    try:
        Checker().check(parse(bad))
    except PebbleError as err:
        print(err)
PY`,
          output: `80 passed
{'is_even': (1, 'bool'), 'is_odd': (1, 'bool'), 'greet': (1, 'void')}
1:0: type error: '+' needs two ints, got int and bool
2:7: type error: the condition of 'while' must be a bool, got int
1:4: type error: 'f' might reach its end without returning a value
1:0: type error: pebblec doesn't support lists`,
        },
        {
          title: "3. LLVM IR: the code generator",
          explain: `The heart of the compiler: a checked AST in, LLVM IR text out. Read the output of the run below next to the code.
- **The module**: declarations of the C functions we call (\`printf\`, \`dprintf\`, \`exit\`), globals and string constants, a helper for division by zero, one \`define\` per Pebble function and \`main\`. Pebble functions are named \`@pb.square\`, so a Pebble function called \`printf\` or \`main\` can't clash with C's.
- **Variables**: each local gets an \`alloca\` in the entry block and is read with \`load\` and written with \`store\`, exactly like \`clang -O0\`. Names get a counter (\`%x.1\`) because inner blocks can shadow outer variables. Top-level \`let\`s become LLVM **globals** (\`@g.n\`) because functions may read and write them. \`main\` is generated **first**, so the globals exist before function bodies refer to them.
- **Blocks**: LLVM has no fall-through: every basic block must end with exactly one terminator (\`br\`, \`ret\` or \`unreachable\`). \`FunctionBuilder.start\` adds the \`br\` into a new block if needed, and \`emit\` drops instructions after a terminator (code after \`return\` can never run, and LLVM rejects it).
- **Control flow**: \`if\` becomes \`br i1 %c, label %then, label %else\` and an \`endif\` block; \`while\` becomes a condition block, a body block that branches back, and an end block: the control-flow graph from the IR lesson.
- **and / or** must not evaluate the right side when the left decides. Two paths reach the end block, so the result is a **phi**: \`phi i1 [ false, %left ], [ %b, %right ]\`. Note \`from_right = f.block\`: evaluating the right side may itself have created blocks, and the phi must name the block we **actually** came from.
- **Division** is where semantics bite. LLVM's \`sdiv\` truncates toward zero (\`-7 / 2\` is -3) but Pebble rounds down (-4), so \`divide\` subtracts 1 when the remainder is non-zero and its sign differs from the divisor's (the same fix applies to \`%\`). Division by zero is **undefined behaviour** in LLVM (on x86 the CPU traps; on ARM64 it quietly gives 0), so pebblec checks first and calls \`@pebble.div_zero\`, which prints the line to stderr and exits with 70, like the interpreter.
- **print** becomes one \`printf\` call with a format string built at compile time: \`%lld\` for ints, \`%s\` plus a \`select\` between \`"true"\` and \`"false"\` for bools, and literal text pasted in with \`%\` doubled.
- \`__init__.py\` now ties the phases together in \`compile_to_llvm\`. \`conftest.py\` adds a \`run_native\` fixture: compile, link and run a program, returning its exit code and output.
- \`test_random_programs_agree_with_the_interpreter\` is **differential testing**: 300 random, well-typed statements full of nested arithmetic, comparisons and logic, run by the interpreter (the reference) and by native code. Any difference is a compiler bug. The depth limit keeps numbers within 64 bits: Pebble's ints never overflow, but \`i64\` does (an extension below).

The last command in the run shows LLVM's optimizer at work: at \`-O2\`, \`square\` is inlined, \`7 * 7\` and \`49 > 40\` are folded, and the whole program becomes a single \`printf\` with constants.`,
          files: [
            { path: "pebblec/codegen.py", lang: "python", code: `"""The code generator: a checked AST in, LLVM IR text out.

Like clang -O0, every variable lives in a stack slot (alloca) and is loaded and stored; LLVM's
mem2reg pass turns the slots into SSA registers and phis, and -O2 does the rest."""
from pebble.nodes import (Assign, Binary, Block, Call, Expr, ExprStmt, FnDecl, If, Let, Literal, Print,
                          Return, Stmt, Unary, Var, While)

from .checker import Checker

LLTYPE = {"int": "i64", "bool": "i1", "void": "void"}
ARITH = {"+": "add", "-": "sub", "*": "mul"}
COMPARE = {"<": "slt", "<=": "sle", ">": "sgt", ">=": "sge", "==": "eq", "!=": "ne"}


def c_string(text: str) -> tuple[str, int]:
    """Encode text as an LLVM string constant: printable ASCII as is, everything else as \\\\XX."""
    data = text.encode("utf-8") + b"\\0"
    body = "".join(chr(b) if 32 <= b < 127 and chr(b) not in '"\\\\' else f"\\\\{b:02X}" for b in data)
    return f'c"{body}"', len(data)


class FunctionBuilder:
    """Collects one function's instructions, tracking the current block and temporary names."""

    def __init__(self):
        self.lines: list[str] = []
        self.allocas: list[str] = []
        self.counter = 0
        self.block = "entry"
        self.terminated = False

    def tmp(self) -> str:
        self.counter += 1
        return f"%t{self.counter}"

    def label(self, hint: str) -> str:
        self.counter += 1
        return f"{hint}.{self.counter}"

    def emit(self, line: str) -> None:
        if self.terminated:  # code after a return or branch can never run; LLVM forbids it
            return
        self.lines.append("  " + line)
        if line.startswith(("ret ", "br ", "unreachable")):
            self.terminated = True

    def start(self, label: str) -> None:
        if not self.terminated:  # LLVM has no fall-through: every block ends with a branch
            self.lines.append(f"  br label %{label}")
        self.lines.append(f"{label}:")
        self.block, self.terminated = label, False


class CodeGen:
    def __init__(self, checker: Checker):
        self.types = checker.types
        self.functions = checker.functions
        self.header: list[str] = []
        self.strings: dict[str, str] = {}
        self.globals: dict[str, tuple[str, str]] = {}  # name -> (pointer, type)

    # ---------------------------------------------------------------- module
    def module(self, program: list[Stmt]) -> str:
        # main first: its top-level lets create the globals that functions may read and write
        main = self.main([s for s in program if not isinstance(s, FnDecl)])
        bodies = [self.function(s) for s in program if isinstance(s, FnDecl)]
        div_zero_message = self.string("line %lld: runtime error: division by zero\\n")
        prelude = [
            "; generated by pebblec",
            "declare i32 @printf(ptr, ...)",
            "declare i32 @dprintf(i32, ptr, ...)",
            "declare void @exit(i32)",
            "",
            *self.header,
            "",
            "define internal void @pebble.div_zero(i64 %line) {",
            f"  call i32 (i32, ptr, ...) @dprintf(i32 2, ptr {div_zero_message}, i64 %line)",  # 2 = stderr
            "  call void @exit(i32 70)",
            "  unreachable",
            "}",
        ]
        return "\\n".join(prelude + [""] + bodies + [main]) + "\\n"

    def string(self, text: str) -> str:
        if text not in self.strings:
            name = f"@.str.{len(self.strings)}"
            const, n = c_string(text)
            self.header.append(f"{name} = private unnamed_addr constant [{n} x i8] {const}")
            self.strings[text] = name
        return self.strings[text]

    def function(self, decl: FnDecl) -> str:
        ret = LLTYPE[self.functions[decl.name][1]]
        f = self.f = FunctionBuilder()
        self.scopes = [{}]
        for p in decl.fn.params:  # copy each parameter into a slot, so it can be assigned to
            slot = self.slot(p, "int")
            f.emit(f"store i64 %arg.{p}, ptr {slot}")
        for s in decl.fn.body:
            self.stmt(s)
        # The checker proved a value-returning function always returns, so the end can't be reached;
        # but LLVM still wants every block (like the empty one after an if/else) to end somehow.
        f.emit("ret void" if ret == "void" else "unreachable")
        params = ", ".join(f"i64 %arg.{p}" for p in decl.fn.params)  # prefixed: can't clash with a label
        return "\\n".join([f"define internal {ret} @pb.{decl.name}({params}) {{", "entry:", *f.allocas, *f.lines, "}", ""])

    def main(self, stmts: list[Stmt]) -> str:
        f = self.f = FunctionBuilder()
        self.scopes = []  # top-level lets become LLVM globals
        for s in stmts:
            self.stmt(s)
        f.emit("ret i32 0")
        return "\\n".join(["define i32 @main() {", "entry:", *f.allocas, *f.lines, "}"])

    # ---------------------------------------------------------------- variables
    def slot(self, name: str, typ: str) -> str:
        if not self.scopes:  # a global
            ptr = f"@g.{name}"
            self.header.append(f"{ptr} = internal global {LLTYPE[typ]} 0")
            self.globals[name] = (ptr, typ)
            return ptr
        ptr = f"%{name}.{self.f.counter + 1}"  # unique, because nested blocks may shadow names
        self.f.counter += 1
        self.f.allocas.append(f"  {ptr} = alloca {LLTYPE[typ]}")  # allocas belong in the entry block
        self.scopes[-1][name] = (ptr, typ)
        return ptr

    def find(self, name: str) -> tuple[str, str]:
        for scope in reversed(self.scopes):
            if name in scope:
                return scope[name]
        return self.globals[name]

    # ---------------------------------------------------------------- statements
    def block(self, stmts: list[Stmt]) -> None:
        self.scopes.append({})
        for s in stmts:
            self.stmt(s)
        self.scopes.pop()

    def stmt(self, s: Stmt) -> None:
        f = self.f
        match s:
            case Let(name, value):
                typ = self.types[value]
                v = self.expr(value)
                f.emit(f"store {LLTYPE[typ]} {v}, ptr {self.slot(name, typ)}")
            case Assign(Var(name), value):
                ptr, typ = self.find(name)
                f.emit(f"store {LLTYPE[typ]} {self.expr(value)}, ptr {ptr}")
            case Print(values):
                self.print(values)
            case If(cond, then, otherwise):
                c = self.expr(cond)  # an i1: the checker made sure it's a bool
                l_then, l_else, l_end = f.label("then"), f.label("else"), f.label("endif")
                f.emit(f"br i1 {c}, label %{l_then}, label %{l_else}")
                f.start(l_then)
                self.block(then)
                f.emit(f"br label %{l_end}")
                f.start(l_else)
                self.block(otherwise or [])
                f.start(l_end)
            case While(cond, body):
                l_cond, l_body, l_end = f.label("while.cond"), f.label("while.body"), f.label("while.end")
                f.start(l_cond)
                c = self.expr(cond)  # an i1: the checker made sure it's a bool
                f.emit(f"br i1 {c}, label %{l_body}, label %{l_end}")
                f.start(l_body)
                self.block(body)
                f.emit(f"br label %{l_cond}")
                f.start(l_end)
            case Return(None):
                f.emit("ret void")
            case Return(value):
                f.emit(f"ret {LLTYPE[self.types[value]]} {self.expr(value)}")
            case ExprStmt(expr):
                self.expr(expr)
            case Block(stmts):
                self.block(stmts)

    def print(self, values: list[Expr]) -> None:
        """One printf per print statement: string literals go straight into the format string."""
        fmt, args = [], []
        for v in values:
            typ = self.types[v]
            if typ == "string":
                fmt.append(v.value.replace("%", "%%"))
            elif typ == "int":
                fmt.append("%lld")
                args.append(f"i64 {self.expr(v)}")
            else:
                b, t = self.expr(v), self.f.tmp()
                self.f.emit(f"{t} = select i1 {b}, ptr {self.string('true')}, ptr {self.string('false')}")
                fmt.append("%s")
                args.append(f"ptr {t}")
        t = self.f.tmp()
        self.f.emit(f"{t} = call i32 (ptr, ...) @printf(ptr {self.string(' '.join(fmt) + chr(10))}"
                    + "".join(", " + a for a in args) + ")")

    # ---------------------------------------------------------------- expressions
    def expr(self, e: Expr) -> str:
        """Emit the code for e and return the LLVM value holding the result."""
        f = self.f
        match e:
            case Literal(bool() as b):
                return "true" if b else "false"
            case Literal(int() as n):
                return str(n)
            case Var(name):
                ptr, typ = self.find(name)
                t = f.tmp()
                f.emit(f"{t} = load {LLTYPE[typ]}, ptr {ptr}")
                return t
            case Unary("-", operand):
                v, t = self.expr(operand), f.tmp()
                f.emit(f"{t} = sub i64 0, {v}")
                return t
            case Unary("!", operand):
                v, t = self.expr(operand), f.tmp()
                f.emit(f"{t} = xor i1 {v}, true")
                return t
            case Binary("and" | "or" as op, left, right):
                return self.short_circuit(op, left, right)
            case Binary("/" | "%" as op, left, right):
                return self.divide(op, self.expr(left), self.expr(right), e.line)
            case Binary(op, left, right):
                a, b, t = self.expr(left), self.expr(right), f.tmp()
                if op in ARITH:
                    f.emit(f"{t} = {ARITH[op]} i64 {a}, {b}")
                else:
                    f.emit(f"{t} = icmp {COMPARE[op]} {LLTYPE[self.types[left]]} {a}, {b}")
                return t
            case Call(Var(name), args):
                vals = ", ".join(f"i64 {self.expr(a)}" for a in args)
                ret = self.functions[name][1]
                if ret == "void":
                    f.emit(f"call void @pb.{name}({vals})")
                    return ""  # no value; the checker only allows this as a statement
                t = f.tmp()
                f.emit(f"{t} = call {LLTYPE[ret]} @pb.{name}({vals})")
                return t
        raise AssertionError(e)

    def short_circuit(self, op: str, left: Expr, right: Expr) -> str:
        """a and b: only evaluate b if a is true. The result is a phi of the two ways in."""
        f = self.f
        a = self.expr(left)
        from_left = f.block
        l_rhs, l_end = f.label(f"{op}.rhs"), f.label(f"{op}.end")
        if op == "and":
            f.emit(f"br i1 {a}, label %{l_rhs}, label %{l_end}")
        else:
            f.emit(f"br i1 {a}, label %{l_end}, label %{l_rhs}")
        f.start(l_rhs)
        b = self.expr(right)
        from_right = f.block  # evaluating b may itself have created blocks
        f.emit(f"br label %{l_end}")
        f.start(l_end)
        t = f.tmp()
        skipped = "false" if op == "and" else "true"
        f.emit(f"{t} = phi i1 [ {skipped}, %{from_left} ], [ {b}, %{from_right} ]")
        return t

    def divide(self, op: str, a: str, b: str, line: int) -> str:
        """Pebble rounds division DOWN (like Python): -7 / 2 is -4. The CPU's idiv (and LLVM's sdiv)
        rounds toward zero: -3. So fix the result up when the remainder's sign differs from b's."""
        f = self.f
        is_zero, l_bad, l_ok = f.tmp(), f.label("div.zero"), f.label("div.ok")
        f.emit(f"{is_zero} = icmp eq i64 {b}, 0")
        f.emit(f"br i1 {is_zero}, label %{l_bad}, label %{l_ok}")
        f.start(l_bad)
        f.emit(f"call void @pebble.div_zero(i64 {line})")
        f.emit("unreachable")
        f.start(l_ok)
        q, r, x, rnz, neg, fix = (f.tmp() for _ in range(6))
        f.emit(f"{q} = sdiv i64 {a}, {b}")
        f.emit(f"{r} = srem i64 {a}, {b}")
        f.emit(f"{rnz} = icmp ne i64 {r}, 0")
        f.emit(f"{x} = xor i64 {r}, {b}")
        f.emit(f"{neg} = icmp slt i64 {x}, 0")       # signs differ
        f.emit(f"{fix} = and i1 {rnz}, {neg}")
        adjusted, result = f.tmp(), f.tmp()
        if op == "/":
            f.emit(f"{adjusted} = sub i64 {q}, 1")
            f.emit(f"{result} = select i1 {fix}, i64 {adjusted}, i64 {q}")
        else:
            f.emit(f"{adjusted} = add i64 {r}, {b}")
            f.emit(f"{result} = select i1 {fix}, i64 {adjusted}, i64 {r}")
        return result` },
            { path: "pebblec/__init__.py", lang: "python", code: `"""pebblec: compile Pebble to LLVM IR, then let clang turn the IR into a native executable.

The front end (lexer, parser, AST) is the interpreter's: a compiler and an interpreter for the same
language can share everything up to the tree."""
from pebble.errors import PebbleError
from pebble.parser import parse

from .checker import Checker
from .codegen import CodeGen

__all__ = ["compile_to_llvm", "PebbleError"]


def compile_to_llvm(src: str) -> str:
    program = parse(src)                     # front end, shared with the interpreter: LexError / ParseError
    checker = Checker()
    checker.check(program)                   # semantic analysis: TypeError_
    return CodeGen(checker).module(program)  # IR generation; LLVM is the rest of the back end` },
            { path: "tests/conftest.py", lang: "python", code: `import os
import shlex
import subprocess

import pytest

from pebblec import compile_to_llvm

CC = shlex.split(os.environ.get("PEBBLEC_CC") or os.environ.get("CLANG_CMD") or "clang")


@pytest.fixture
def run_native(tmp_path):
    """Compile Pebble source all the way to a native executable, run it, return (exit code, stdout, stderr)."""
    def go(src: str, opt: str = "2"):
        ll, exe = tmp_path / "prog.ll", tmp_path / "prog"
        ll.write_text(compile_to_llvm(src))
        subprocess.run([*CC, f"-O{opt}", "-Wno-override-module", str(ll), "-o", str(exe)], check=True,
                       capture_output=True, text=True)
        r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=60)
        return r.returncode, r.stdout, r.stderr
    return go` },
            { path: "tests/test_codegen.py", lang: "python", code: `import io
import random

from pebble import run
from pebble.errors import PebbleRuntimeError
from pebblec import compile_to_llvm


def test_the_ir_uses_stack_slots_and_one_function_per_pebble_function():
    ir = compile_to_llvm("fn square(x) { return x * x; } print square(7);")
    assert "define internal i64 @pb.square(i64 %arg.x)" in ir
    assert "%x.1 = alloca i64" in ir
    assert "mul i64" in ir
    assert "define i32 @main()" in ir


def test_arithmetic_comparisons_and_printing(run_native):
    code, out, _ = run_native('print 1 + 2 * 3, 10 - 4 - 3, -(2 * 3), 7 > 3, 2 == 3, !false, "50%";')
    assert (code, out) == (0, "7 3 -6 true false true 50%\\n")


def test_division_rounds_down_like_the_interpreter(run_native):
    _, out, _ = run_native("print -7 / 2, -7 % 2, 7 / -2, 7 % -2, -7 / -2, 6 / 3;")
    assert out == f"{-7 // 2} {-7 % 2} {7 // -2} {7 % -2} {-7 // -2} {6 // 3}\\n"


def test_division_by_zero_is_a_runtime_error(run_native):
    code, out, err = run_native('print "before";\\nlet zero = 0;\\nprint 1 / zero;\\nprint "after";')
    assert (code, out, err) == (70, "before\\n", "line 3: runtime error: division by zero\\n")


def test_and_or_short_circuit(run_native):
    _, out, _ = run_native("""
        fn loud(n) { print "called", n; return n; }
        print false and loud(1) == 1;
        print true or loud(2) == 2;
        print true and loud(3) == 3;
    """)
    assert out == "false\\ntrue\\ncalled 3\\ntrue\\n"


def test_scopes_shadowing_globals_and_while(run_native):
    _, out, _ = run_native("""
        let counter = 0;
        fn bump(by) { counter = counter + by; return counter; }
        let x = 1;
        if true { let x = 2; print x; }
        print x;
        let i = 0;
        while i < 5 { bump(i); i = i + 1; }
        print counter;
    """)
    assert out == "2\\n1\\n10\\n"


def test_void_functions_and_if_else_returns(run_native):
    _, out, _ = run_native("""
        fn greet(n) { if n > 1 { print "hello again", n; return; } print "hello", n; }
        fn sign(n) { if n < 0 { return -1; } else if n == 0 { return 0; } else { return 1; } }
        greet(1);
        greet(2);
        print sign(-9), sign(0), sign(9);
    """)
    assert out == "hello 1\\nhello again 2\\n-1 0 1\\n"


def test_random_programs_agree_with_the_interpreter(run_native):
    """Differential testing: the interpreter is the reference. Generate random (well-typed) programs,
    run them both ways and demand the same output. Real compiler teams find miscompilations this way."""
    rng = random.Random(42)

    def int_expr(depth):  # depth 3 at most: 8 factors of 50 still fit in 64 bits, so nothing overflows
        if depth == 0 or rng.random() < 0.3:
            return str(rng.randint(-50, 50))
        return f"({int_expr(depth - 1)} {rng.choice('+-*/%')} {int_expr(depth - 1)})"

    def bool_expr(depth):
        r = rng.random()
        if depth == 0 or r < 0.4:
            return f"{int_expr(3)} {rng.choice(['<', '<=', '>', '>=', '==', '!='])} {int_expr(3)}"
        if r < 0.55:
            return f"!({bool_expr(depth - 1)})"
        return f"({bool_expr(depth - 1)} {rng.choice(['and', 'or'])} {bool_expr(depth - 1)})"

    statements = []
    while len(statements) < 300:
        stmt = f"print {int_expr(3) if rng.random() < 0.5 else bool_expr(3)};"
        try:
            run(stmt, out=io.StringIO())
        except PebbleRuntimeError:
            continue  # it divides by zero somewhere: skip it
        statements.append(stmt)
    src = "\\n".join(statements)
    expected = io.StringIO()
    run(src, out=expected)
    _, out, _ = run_native(src, opt="0")
    assert out == expected.getvalue()` },
          ],
          run: `python -m pytest -q
python - <<'PY'
from pebblec import compile_to_llvm
ir = compile_to_llvm("""
fn square(x) { return x * x; }
let n = 7;
print n, "squared is", square(n), square(n) > 40;
""")
open("square.ll", "w").write(ir)
print(ir)
PY
clang -Wno-override-module -O0 square.ll -o square && ./square
# what LLVM's optimiser makes of it: the whole program folds into one printf
clang -Wno-override-module -O2 -S -emit-llvm square.ll -o - | grep -A3 "@main()"`,
          output: `88 passed
; generated by pebblec
declare i32 @printf(ptr, ...)
declare i32 @dprintf(i32, ptr, ...)
declare void @exit(i32)

@g.n = internal global i64 0
@.str.0 = private unnamed_addr constant [5 x i8] c"true\\00"
@.str.1 = private unnamed_addr constant [6 x i8] c"false\\00"
@.str.2 = private unnamed_addr constant [25 x i8] c"%lld squared is %lld %s\\0A\\00"
@.str.3 = private unnamed_addr constant [44 x i8] c"line %lld: runtime error: division by zero\\0A\\00"

define internal void @pebble.div_zero(i64 %line) {
  call i32 (i32, ptr, ...) @dprintf(i32 2, ptr @.str.3, i64 %line)
  call void @exit(i32 70)
  unreachable
}

define internal i64 @pb.square(i64 %arg.x) {
entry:
  %x.1 = alloca i64
  store i64 %arg.x, ptr %x.1
  %t2 = load i64, ptr %x.1
  %t3 = load i64, ptr %x.1
  %t4 = mul i64 %t2, %t3
  ret i64 %t4
}

define i32 @main() {
entry:
  store i64 7, ptr @g.n
  %t1 = load i64, ptr @g.n
  %t2 = load i64, ptr @g.n
  %t3 = call i64 @pb.square(i64 %t2)
  %t4 = load i64, ptr @g.n
  %t5 = call i64 @pb.square(i64 %t4)
  %t6 = icmp sgt i64 %t5, 40
  %t7 = select i1 %t6, ptr @.str.0, ptr @.str.1
  %t8 = call i32 (ptr, ...) @printf(ptr @.str.2, i64 %t1, i64 %t3, ptr %t7)
  ret i32 0
}

7 squared is 49 true
define noundef i32 @main() local_unnamed_addr #0 {
entry:
  %t8 = tail call i32 (ptr, ...) @printf(ptr nonnull dereferenceable(1) @.str.2, i64 7, i64 49, ptr nonnull @.str.0)
  ret i32 0`,
        },
        {
          title: "4. A real compiler: the driver, examples and end-to-end tests",
          explain: `Finally, package it as a tool you'd actually use: \`python -m pebblec program.pb\`.
- \`__main__.py\` is the **driver**, like the \`gcc\` command that runs \`cc1\`, \`as\` and \`ld\` for you. It reads the source, calls \`compile_to_llvm\`, writes \`program.ll\` next to the output (keep it: reading it is how you debug the compiler), and runs clang at \`-O2\` to produce \`program\`. Options: \`-o\` for the output name, \`-O0\` to \`-O3\`, and \`--emit-llvm\` to print the IR and stop.
- The C compiler comes from \`$PEBBLEC_CC\`, then \`$CLANG_CMD\`, then plain \`clang\`. \`shlex.split\` lets it be a command with arguments, like \`xcrun clang\`.
- Errors look exactly like the interpreter's: \`file:line:col: kind: message\`, the source line, and a caret when the column is known. The exit code is 65 and **no executable is written**. A missing file exits with 66.
- The examples cover the whole subset: recursion (\`fib\`), a function returning a bool (\`primes\`), a million iterations of nested loops (\`collatz\`), and \`else if\` chains with \`and\` (\`fizzbuzz\`).
- \`test_pebblec.py\` runs the real command, like a user. The most important test runs one program through **both** \`python -m pebble\` and \`python -m pebblec\`: mutual recursion, a void function, negative division and modulo, \`and\`/\`or\`/\`!\`, and demands identical output.

You've built a compiler. Time it against the interpreter: \`time python -m pebble examples/native/fib.pb\` takes about 15 seconds; \`python -m pebblec examples/native/fib.pb && time ./examples/native/fib\` about a tenth of a second. Then pick an extension: each one teaches the next big idea in compilers.`,
          files: [
            { path: "pebblec/__main__.py", lang: "python", code: `"""The compiler driver.

    python -m pebblec program.pb              -> ./program, a native executable
    python -m pebblec program.pb -o fast -O2  -> choose the output name and LLVM's optimisation level
    python -m pebblec program.pb --emit-llvm  -> print the LLVM IR instead

The C compiler is $PEBBLEC_CC, else $CLANG_CMD, else clang."""
import argparse
import os
import pathlib
import shlex
import subprocess
import sys

from . import compile_to_llvm
from pebble.errors import PebbleError


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="pebblec", description="Compile a Pebble program to a native executable.")
    ap.add_argument("source")
    ap.add_argument("-o", dest="output", help="output file (default: the source name without .pb)")
    ap.add_argument("-O", dest="opt", default="2", choices=["0", "1", "2", "3"], help="optimisation level")
    ap.add_argument("--emit-llvm", action="store_true", help="print the LLVM IR and stop")
    args = ap.parse_args(argv)

    path = pathlib.Path(args.source)
    try:
        src = path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"pebblec: can't open {path}: {e.strerror}", file=sys.stderr)
        return 66
    try:
        ir = compile_to_llvm(src)
    except PebbleError as err:
        print(f"{path}:{err}", file=sys.stderr)
        lines = src.split("\\n")
        if 1 <= err.line <= len(lines):
            print(f"    {lines[err.line - 1]}", file=sys.stderr)
            if err.col:
                print(f"    {' ' * (err.col - 1)}^", file=sys.stderr)
        return 65
    if args.emit_llvm:
        sys.stdout.write(ir)
        return 0

    output = pathlib.Path(args.output or path.with_suffix(""))
    ll = output.with_suffix(".ll")
    ll.write_text(ir, encoding="utf-8")
    cc = shlex.split(os.environ.get("PEBBLEC_CC") or os.environ.get("CLANG_CMD") or "clang")
    # clang takes LLVM IR directly: it runs LLVM's optimiser, code generator, assembler and the linker
    r = subprocess.run([*cc, f"-O{args.opt}", "-Wno-override-module", str(ll), "-o", str(output)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(f"pebblec: {cc[0]} failed:\\n{r.stderr}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))` },
            { path: "examples/native/fib.pb", lang: "javascript", code: `// Recursion, compiled to native code.
fn fib(n) {
  if n < 2 { return n; }
  return fib(n - 1) + fib(n - 2);
}

let i = 0;
while i <= 30 {
  if i % 10 == 0 { print "fib", i, "=", fib(i); }
  i = i + 1;
}` },
            { path: "examples/native/primes.pb", lang: "javascript", code: `// Counting primes by trial division: a function that returns bool.
fn is_prime(n) {
  if n < 2 { return false; }
  let d = 2;
  while d * d <= n {
    if n % d == 0 { return false; }
    d = d + 1;
  }
  return true;
}

let count = 0;
let n = 0;
while n < 100000 {
  if is_prime(n) { count = count + 1; }
  n = n + 1;
}
print "primes below 100000:", count;
print "is 97 prime?", is_prime(97), "is 91 prime?", is_prime(91);` },
            { path: "examples/native/collatz.pb", lang: "javascript", code: `// Which starting number below a million has the longest Collatz chain?
fn chain(n) {
  let steps = 1;
  while n != 1 {
    if n % 2 == 0 { n = n / 2; } else { n = 3 * n + 1; }
    steps = steps + 1;
  }
  return steps;
}

let best = 1;
let best_len = 1;
let start = 1;
while start < 1000000 {
  let len = chain(start);
  if len > best_len { best = start; best_len = len; }
  start = start + 1;
}
print "longest chain below 1000000 starts at", best, "with", best_len, "numbers";` },
            { path: "examples/native/fizzbuzz.pb", lang: "javascript", code: `// The classic, with else-if chains and logical operators.
let i = 1;
while i <= 15 {
  if i % 3 == 0 and i % 5 == 0 { print "FizzBuzz"; }
  else if i % 3 == 0 { print "Fizz"; }
  else if i % 5 == 0 { print "Buzz"; }
  else { print i; }
  i = i + 1;
}` },
            { path: "tests/test_pebblec.py", lang: "python", code: `import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent


def tool(name, *args):
    return subprocess.run([sys.executable, "-m", name, *args], cwd=ROOT, capture_output=True, text=True, timeout=120)


@pytest.mark.parametrize("example, expected", [
    ("fib", "fib 0 = 0\\nfib 10 = 55\\nfib 20 = 6765\\nfib 30 = 832040\\n"),
    ("primes", "primes below 100000: 9592\\nis 97 prime? true is 91 prime? false\\n"),
    ("collatz", "longest chain below 1000000 starts at 837799 with 525 numbers\\n"),
    ("fizzbuzz", "1\\n2\\nFizz\\n4\\nBuzz\\nFizz\\n7\\n8\\nFizz\\nBuzz\\n11\\nFizz\\n13\\n14\\nFizzBuzz\\n"),
])
def test_examples_compile_to_native_programs(tmp_path, example, expected):
    exe = tmp_path / example
    r = tool("pebblec", f"examples/native/{example}.pb", "-o", str(exe))
    assert r.returncode == 0, r.stderr
    assert (tmp_path / f"{example}.ll").exists()  # the IR is kept next to the program, to read
    assert subprocess.run([str(exe)], capture_output=True, text=True, timeout=60).stdout == expected


def test_the_interpreter_and_the_compiler_agree(tmp_path):
    prog = tmp_path / "both.pb"
    prog.write_text("""
fn gcd(a, b) { while b != 0 { let t = b; b = a % b; a = t; } return a; }
fn is_even(n) { if n == 0 { return true; } return is_odd(n - 1); }
fn is_odd(n) { if n == 0 { return false; } return is_even(n - 1); }
fn report(n) { print "report", n, n / 7, n % 7; }
let total = 0;
let i = -20;
while i <= 20 {
  if i != 0 { total = total + 100 / i + 100 % i; }
  i = i + 1;
}
print "total", total, "gcd", gcd(1071, 462), is_even(10), is_odd(10);
print 7 > 3 and !(2 == 3), false or 1 < 0;
report(-50);
""")
    interpreted = tool("pebble", str(prog))
    compiled = tool("pebblec", str(prog), "-o", str(tmp_path / "both"))
    assert compiled.returncode == 0, compiled.stderr
    native = subprocess.run([str(tmp_path / "both")], capture_output=True, text=True)
    assert interpreted.returncode == native.returncode == 0
    assert interpreted.stdout == native.stdout
    assert "report -50 -8 6" in native.stdout


def test_emit_llvm_prints_the_ir():
    r = tool("pebblec", "examples/native/fib.pb", "--emit-llvm")
    assert r.returncode == 0 and "define internal i64 @pb.fib(i64 %arg.n)" in r.stdout


def test_compile_errors_point_at_the_source(tmp_path):
    bad = tmp_path / "bad.pb"
    bad.write_text("let ok = 1;\\nlet total = ok + true;\\n")
    r = tool("pebblec", str(bad))
    assert r.returncode == 65
    assert r.stderr.splitlines()[0] == f"{bad}:2:0: type error: '+' needs two ints, got int and bool"
    assert not (tmp_path / "bad").exists()` },
          ],
          run: `python -m pytest -q
python -m pebblec examples/native/collatz.pb
ls examples/native
./examples/native/collatz
printf 'let ok = 1;\\nlet total = ok + true;\\n' > bad.pb
python -m pebblec bad.pb; echo "exit $?"`,
          output: `95 passed
collatz
collatz.ll
collatz.pb
fib.pb
fizzbuzz.pb
primes.pb
longest chain below 1000000 starts at 837799 with 525 numbers
bad.pb:2:0: type error: '+' needs two ints, got int and bool
    let total = ok + true;
exit 65`,
        },
      ],
      extensions: [
        "Overflow checks: Pebble's ints never overflow, but i64 does. Use LLVM's llvm.sadd.with.overflow.i64 (and the sub and mul versions) and report a runtime error with exit code 70",
        "Lists: write a small C runtime (pb_list_new, pb_list_push, pb_list_get with bounds checks), declare its functions in the IR, and link runtime.c with clang",
        "Strings as values: a string type in the checker, runtime functions for concatenation and str(), and printing them",
        "Closures: closure conversion turns every lambda into a top-level function plus a heap-allocated environment struct; then you need memory management (reference counting, or the Boehm GC)",
        "Replace LLVM with your own back end: the x86-64 stack-machine generator from the code generation lesson, then linear-scan register allocation",
        "Debug info: emit !dbg metadata so lldb and gdb can step through .pb source lines",
        "Compile to WebAssembly with clang --target=wasm32 and run Pebble programs in a browser",
        "Infer parameter types with Hindley–Milner (the type inference lesson) instead of assuming ints",
      ],
      verify: "$CLANG_CMD --version > /dev/null && $PY_CMD -m pytest -q -p no:cacheprovider",
      requires: ["pytest"],
      buildsOn: "comp-project-interpreter",
    },
  },

  // ------------------------------------------------------------------ INTERVIEW WRAP-UP
  {
    id: "comp-interview",
    title: "The compilers interview: putting it all together",
    tagline: "What happens when you compile and run a C program, from source to process: the question bank by topic, the flags and tools to know, the classic expression-evaluator coding question, how to reason through any compiler question, and where to go next.",
    difficulty: "advanced",
    minutes: 40,
    diagram: {
      title: "gcc -O2 hello.c, end to end",
      nodes: [
        { id: "src", label: "hello.c", kind: "client", x: 90, y: 100, sub: "#include <stdio.h>" },
        { id: "cpp", label: "Preprocessor", kind: "gateway", x: 290, y: 100, sub: "#include, #define → hello.i" },
        { id: "fe", label: "Front end", kind: "service", x: 500, y: 100, sub: "lex, parse, check types" },
        { id: "mid", label: "Optimizer", kind: "worker", x: 710, y: 100, sub: "IR, SSA, passes" },
        { id: "be", label: "Back end", kind: "gpu", x: 880, y: 280, sub: "select, allocate → hello.s" },
        { id: "as", label: "Assembler", kind: "control", x: 710, y: 450, sub: "hello.s → hello.o" },
        { id: "ld", label: "Linker", kind: "registry", x: 500, y: 450, sub: "+ crt1.o, libc → hello" },
        { id: "loader", label: "Kernel + ld.so", kind: "monitor", x: 290, y: 450, sub: "execve, map, relocate" },
        { id: "run", label: "Running process", kind: "node", x: 90, y: 450, sub: "main() prints" },
      ],
      edges: [
        { from: "src", to: "cpp" },
        { from: "cpp", to: "fe", label: "one long C file" },
        { from: "fe", to: "mid", label: "IR" },
        { from: "mid", to: "be", label: "optimised IR" },
        { from: "be", to: "as", label: "assembly" },
        { from: "as", to: "ld", label: "object file" },
        { from: "ld", to: "loader", label: "./hello" },
        { from: "loader", to: "run" },
      ],
      flows: [
        {
          name: "gcc -O2 hello.c -o hello",
          path: ["src", "cpp", "fe", "mid", "be", "as", "ld"],
          steps: [
            "The preprocessor pastes in stdio.h (hundreds of lines) and expands macros: gcc -E shows the result.",
            "The front end lexes, parses and type-checks, reporting errors with line numbers, then lowers the AST to IR (GIMPLE in GCC).",
            "The optimizer runs dozens of passes over SSA form: inlining, constant propagation, dead code elimination.",
            "The back end selects instructions, allocates registers and writes assembly: gcc -S stops here.",
            "The assembler encodes instructions into an object file with symbols and relocations: gcc -c stops here.",
            "The linker adds the C start-up files, resolves printf against libc and writes the executable.",
          ],
        },
        {
          name: "./hello",
          path: ["ld", "loader", "run"],
          steps: [
            "The shell forks and calls execve: the kernel maps the program and its dynamic loader.",
            "ld.so maps libc and binds printf; _start calls main, which runs and prints.",
          ],
        },
        {
          name: "A missing semicolon",
          path: ["src", "cpp", "fe"],
          steps: [
            "The preprocessor doesn't care: it works on lines and tokens, not grammar.",
            "The parser expects ';' and reports file:line:col. Nothing after the front end runs.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've learned the whole journey: from letters you type, to tokens, to trees, to checked trees, to a tidy recipe (IR), to a faster recipe (optimization), to instructions for one particular kitchen (machine code), glued together with other people's work (linking), and finally cooked (run). An interview just asks you to **tell that story**, and zoom in on any part of it.

## The big question: what happens when you compile and run a program?
Be ready to walk it end to end (the diagram above), with the flags that show each stage:
| Stage | Command to see it | Output |
|---|---|---|
| Preprocess | \`gcc -E hello.c\` | C with headers pasted in, macros expanded |
| Compile | \`gcc -S -O2 hello.c\` | \`hello.s\`, assembly |
| Assemble | \`gcc -c hello.c\` | \`hello.o\`, an object file |
| Link | \`gcc hello.o -o hello\` | an executable |
| Everything, kept | \`gcc -save-temps -v hello.c\` | all intermediate files, and the exact commands run |

Then running it: \`fork\` + \`execve\`, the dynamic loader maps libc, \`_start\` calls \`main\`. Interviewers love it when you mention one surprising detail per stage: \`printf("hi\\n")\` gets compiled into \`puts("hi")\`; \`main\` isn't the first code to run; the program finds \`printf\` through the PLT.

## The question bank
| Topic | What interviewers ask | Lesson |
|---|---|---|
| Big picture | Compiler vs interpreter vs JIT, phases, is Python compiled, bootstrapping | What a compiler is |
| The machine | Stack frames, calling conventions, caller- vs callee-saved, endianness | The machine |
| Lexing and regex | Tokens, maximal munch, DFA vs NFA, ReDoS | Lexing, Automata |
| Parsing | Grammars, ambiguity, precedence, recursive descent, Pratt, LL vs LR | Grammars, Parsing, LR |
| Semantics | Scopes, symbol tables, static vs dynamic typing, type inference | Semantic analysis, Types |
| Execution | Tree-walkers, closures, bytecode, stack vs register VMs | Interpreters, Bytecode |
| Middle end | SSA, CFGs, the classic optimizations, undefined behaviour | IR, Optimization, LLVM |
| Back end | Instruction selection, register allocation, peephole | Code generation, Register allocation |
| Linking | Static vs dynamic, undefined reference, GOT and PLT, name mangling | Linking |
| Runtime | GC algorithms, reference counting vs tracing, vtables, exceptions | Runtimes |
| JIT | Tiers, inline caches, deoptimization, V8 and HotSpot | JIT |

Every lesson in this world ends with interview questions. Answer them **out loud** before revealing the answer.

## The coding question: evaluate an expression
The most common compiler-flavoured coding interview is "**implement a calculator**": evaluate \`"2 + 3 * (4 - 1)"\` (LeetCode's Basic Calculator I–III). You already know the answer, and it's a mini compiler:
1. **Tokenise**: numbers (several digits!), operators, parentheses; skip spaces.
2. **Parse with precedence**: either recursive descent with one function per level (\`expr\` handles \`+ -\`, \`term\` handles \`* /\`, \`factor\` handles numbers, unary minus and parentheses), or Pratt parsing, or Dijkstra's **shunting-yard** with two stacks.
3. **Evaluate** while parsing (no tree needed), or build a tree and walk it.
4. Discuss: left associativity (\`8 - 3 - 2\`), unary minus, division rounding, errors (unbalanced parentheses), and complexity: O(n) time and O(depth) space.

Variants: evaluate with variables, simplify or differentiate expressions, validate brackets (a stack, the reason regular expressions can't), decode \`3[a2[c]]\` (recursive descent again), or a tiny regex matcher.

## Flags and tools worth knowing
- **Optimization levels**: \`-O0\` (fast compile, debuggable), \`-O1\`, \`-O2\` (the usual release choice), \`-O3\` (more inlining and vectorization, bigger code, not always faster), \`-Os\`/\`-Oz\` (small code), plus \`-march=native\`, \`-flto\` (whole-program) and **PGO** (\`-fprofile-generate\`, then \`-fprofile-use\`).
- **Look at the code**: Compiler Explorer (godbolt.org) shows assembly per source line for hundreds of compilers; \`gcc -S -fverbose-asm\`, \`clang -S -emit-llvm\`, \`objdump -d\`.
- **Ask the optimizer**: \`clang -Rpass=inline -Rpass-missed=loop-vectorize\`, \`gcc -fopt-info-vec\`.
- **Catch bugs the compiler can't**: \`-Wall -Wextra\`, sanitizers (\`-fsanitize=address,undefined,thread\`), \`-g\` for debug info.
- **Inspect binaries**: \`nm\`, \`readelf\`/\`otool\`, \`ldd\`, \`c++filt\`, \`strings\`.

## How to answer any compiler question
1. **Place it** in the pipeline: "Register allocation is in the back end, after instruction selection."
2. **Define** it in one sentence.
3. **Why** it exists: the problem it solves.
4. **How**, naming the data structure: the token stream, the AST, the symbol table, the CFG, SSA, the interference graph, the GOT.
5. **Trade-offs**: "graph colouring gives better code, linear scan compiles faster, so JITs use linear scan."
6. **A real example**: "V8 does this", "that's why my program broke at -O2", "I did this in my compiler".

## Common traps
- "Python is interpreted, not compiled." (CPython compiles to bytecode first; PyPy JIT-compiles.)
- "Java is slow because it's interpreted." (Hot code is JIT-compiled, often to excellent machine code.)
- "\`-O3\` is always faster than \`-O2\`." (Bigger code can be slower; measure.)
- "It works at \`-O0\` and breaks at \`-O2\`, so the compiler is buggy." (Usually undefined behaviour or a data race in the program.)
- "\`volatile\` makes it thread-safe." (It stops the compiler from removing or caching accesses; it gives no atomicity or ordering between threads.)
- "The \`inline\` keyword makes the compiler inline." (It's mostly about the one-definition rule; the optimizer decides.)
- "Undefined reference is a compile error." (It's a link error: every file compiled fine.)
- "Garbage collection means no memory leaks." (Reachable but unused objects still leak.)

## Where to go next
- Extend **Pebble** and **pebblec**: the project extensions are a full course on their own (runtimes, closures, GC, your own back end).
- Read: *Crafting Interpreters* (Nystrom, free online: a tree-walker and a bytecode VM in C), *Engineering a Compiler* (Cooper and Torczon), *Compilers: Principles, Techniques, and Tools* (the "Dragon Book"), *Modern Compiler Implementation* (Appel).
- Build along: LLVM's **Kaleidoscope** tutorial, Rui Ueyama's **chibicc** (a C compiler in small commits), **QBE** and **Cranelift** as lighter back ends than LLVM, **MLIR** for domain-specific compilers (machine learning).
- Contribute: compiler projects (LLVM, GCC, CPython, Rust, Go, V8) all label "good first issues", and fixing a bad error message is a great start.`,
    keyPoints: [
      "Tell the end-to-end story: preprocess, compile (front, middle, back end), assemble, link, load and run, with the flags that show each stage",
      "Know the question bank across lexing, parsing, semantics, interpreters, IR and optimization, back end, linking, runtimes and JITs",
      "The classic coding question is an expression evaluator: tokenise, parse with precedence, evaluate",
      "Know your tools: -O levels, LTO, PGO, Compiler Explorer, -S and -emit-llvm, optimization remarks, sanitizers",
      "Answer by placing the topic in the pipeline, defining it, explaining why and how, trade-offs, and a real example",
      "Avoid the traps: Python compiles to bytecode, -O3 isn't always faster, volatile isn't thread safety, link errors aren't compile errors",
    ],
    interview: [
      {
        q: "What happens when you compile and run a C program, from source code to output?",
        freq: "very-common",
        a: `\`gcc\` is a driver for four tools. (1) The **preprocessor** handles \`#include\` and \`#define\`, producing one long translation unit. (2) The **compiler proper** (\`cc1\`) lexes and parses it into an AST, type-checks it, lowers it to IR (GIMPLE, then RTL; LLVM IR for clang), optimizes in SSA form, then selects instructions, allocates registers and emits **assembly**. (3) The **assembler** encodes it into an **object file** with sections, a symbol table and relocations. (4) The **linker** combines it with the C start-up files and libraries, resolves symbols such as \`printf\` (dynamically, from libc), patches relocations and writes an ELF executable. When you run it, the shell forks, \`execve\` maps the program and the dynamic loader, which maps libc and resolves symbols; \`_start\` sets up and calls \`main\`; \`printf\` buffers and \`write\`s to file descriptor 1; \`exit\` flushes and the shell reaps the process.`,
      },
      {
        q: "Implement a calculator that evaluates expressions like 2 + 3 * (4 - 1). How do you approach it?",
        freq: "very-common",
        a: `Clarify first: which operators, unary minus, spaces, integer division rounding, invalid input. Then: **tokenise** (multi-digit numbers, operators, parentheses), and **parse with precedence** using recursive descent:
\`\`\`python
def expr():          # handles + and -, left-associative
    v = term()
    while peek() in "+-":
        v = v + term() if next_tok() == "+" else v - term()
    return v
def term():          # handles * and /
    v = factor()
    while peek() in "*/":
        v = v * factor() if next_tok() == "*" else int(v / factor())
    return v
def factor():        # numbers, unary minus, parentheses
    t = next_tok()
    if t == "-": return -factor()
    if t == "(":
        v = expr(); expect(")"); return v
    return int(t)
\`\`\`
Each precedence level is a function, so \`*\` binds tighter than \`+\`, and the loops make operators left-associative. O(n) time, O(nesting depth) stack. Alternatives: shunting-yard (operator and value stacks) or Pratt parsing (a binding-power table), which scale better to many operators. Mention testing edge cases: \`8 - 3 - 2\`, \`-(2 + 3)\`, deep nesting, division by zero.`,
      },
      {
        q: "What do -O0, -O2, -O3 and -Os do? Which would you ship?",
        freq: "common",
        a: `**-O0**: no optimization, fastest compile, every variable in memory, ideal for debugging. **-O1**: cheap optimizations. **-O2**: nearly all optimizations that don't trade size for speed (inlining of small functions, GVN, LICM, scheduling, vectorization in recent compilers): the standard release setting. **-O3**: more aggressive inlining, loop unrolling and vectorization: sometimes faster, sometimes slower because of code bloat and instruction-cache pressure. **-Os/-Oz**: optimize for size (embedded, mobile, WebAssembly). Ship -O2 by default, measure -O3 and PGO/LTO on real workloads, and consider \`-march\` only when you control the target CPU. Keep \`-g\` for symbols even in release builds (it doesn't change the generated code).`,
      },
      {
        q: "What does volatile do in C/C++, and why isn't it enough for thread safety?",
        freq: "common",
        a: `\`volatile\` tells the compiler that every read and write of the variable is an observable side effect: it must not cache the value in a register, merge, remove or reorder those accesses relative to other volatile accesses. It exists for **memory-mapped hardware registers** and variables changed by signal handlers or \`setjmp\`. It does **not** make operations atomic (\`x++\` is still read-modify-write), and it doesn't stop the CPU or the compiler from reordering **other** memory accesses around it, so it provides no happens-before ordering. For threads, use \`std::atomic\`/\`_Atomic\` (which also emit the right memory barriers) or locks. (Java's and C#'s \`volatile\` are different: they do provide visibility and ordering.)`,
      },
      {
        q: "How does a debugger map machine code back to your source lines and variables?",
        freq: "occasional",
        a: `With \`-g\`, the compiler emits **debug information** (DWARF on Linux and macOS, PDB on Windows) alongside the code: a **line table** mapping instruction addresses to file:line:column, descriptions of types, functions and scopes, and **location lists** saying where each variable lives at each address (a register, a stack offset, or "optimized out"). A breakpoint replaces an instruction with a trap (\`int3\` on x86); when it hits, the debugger looks up the address in the line table, unwinds the stack using call-frame information, and reads variables from their recorded locations. Optimized code makes this fuzzy: variables live in registers only part of the time, lines are interleaved, and inlined functions need special records.`,
      },
      {
        q: "A hot loop is slower than expected. How do you check what the compiler did with it?",
        freq: "occasional",
        a: `Look at the generated code: Compiler Explorer, \`-S\`, or \`perf annotate\` on the real binary to see which instructions are hot. Ask the optimizer: \`-Rpass=loop-vectorize -Rpass-missed=loop-vectorize -Rpass-analysis=loop-vectorize\` (clang) or \`-fopt-info-vec-missed\` (gcc) explain why a loop wasn't vectorized (possible aliasing, a function call, a loop-carried dependency, unknown trip count), and \`-Rpass=inline\` shows inlining decisions. Typical fixes: \`restrict\` or local copies to rule out aliasing, simpler loop bounds, structure-of-arrays layouts, making a call inlinable, removing a branch, and checking the build actually uses \`-O2\` and the intended \`-march\`.`,
      },
      {
        q: "Static vs dynamic typing: what changes for the compiler?",
        freq: "common",
        a: `With **static types**, the compiler knows every value's representation at compile time: it can use machine integers and floats directly, lay out structs with fixed offsets, resolve most calls statically, report type errors before running, and optimize aggressively. With **dynamic types**, values carry their type at run time (boxing or tagging), every operation dispatches on types, and fields are looked up by name, so a straightforward compiler gains little over an interpreter. High-performance dynamic language implementations recover speed with **JITs** that speculate on observed types (V8, PyPy, LuaJIT), or by inferring types statically where possible. Gradual typing (TypeScript, Python annotations) mostly helps tooling, not code generation, unless the compiler trusts the types (Cython, mypyc).`,
      },
      {
        q: "Compile error, link error, runtime error: give an example of each and say which phase finds it.",
        freq: "common",
        a: `**Compile errors** come from the front end analysing one file: a syntax error (missing \`;\`, found by the parser), an undeclared variable (name resolution), passing a string where an int is expected (the type checker). **Link errors** come from the linker combining files: \`undefined reference to 'sqrt'\` (forgot \`-lm\`), \`multiple definition of 'config'\` (a variable defined in a header). **Runtime errors** happen while running: division by zero, null pointer dereference, out-of-bounds access, stack overflow from unbounded recursion, an uncaught exception. Some languages move errors earlier: Rust catches use-after-free and data races at compile time, and a good type system turns many runtime errors into compile errors.`,
      },
      {
        q: "How would you add a new feature, like a for loop, to an existing compiler?",
        freq: "occasional",
        a: `Work through the pipeline. **Specify** the semantics first (scope of the loop variable, evaluation order, \`break\`/\`continue\`). **Lexer**: a new keyword. **Parser**: a grammar rule and an AST node. Then decide where it disappears: the cheapest route is **desugaring** in the parser or a lowering pass (\`for i in a..b { body }\` becomes \`let i = a; while i < b { body; i = i + 1; }\` in a new scope), so the checker, IR generator and optimizer need no changes. A dedicated node is needed if the feature has special semantics (a fresh variable per iteration, for closures) or diagnostics should mention it. Add tests at every level: parse trees, type errors, generated code, end-to-end output, and differential tests against the interpreter.`,
      },
    ],
    quiz: [
      {
        q: "In which order do gcc's stages run?",
        options: [
          "Compile, preprocess, link, assemble",
          "Preprocess, compile, assemble, link",
          "Preprocess, assemble, compile, link",
          "Link, compile, assemble, preprocess",
        ],
        answer: 1,
        explain: "Text (hello.i), then assembly (hello.s), then an object file (hello.o), then an executable.",
      },
      {
        q: "Which gcc flag stops after producing assembly code?",
        options: ["-E", "-S", "-c", "-o"],
        answer: 1,
        explain: "-E stops after preprocessing, -S after compiling to assembly, -c after assembling an object file.",
      },
      {
        q: "Every file compiles, but the build fails with `undefined reference to 'parse_config'`. Which stage failed?",
        options: ["The preprocessor", "The parser", "The linker", "The assembler"],
        answer: 2,
        explain: "Each file only declared parse_config; the linker found no definition in any input.",
      },
      {
        q: "What does `volatile` guarantee in C?",
        options: [
          "Atomic access from several threads",
          "Every read and write really happens; the compiler won't cache, remove or merge them",
          "The variable lives in a register",
          "The variable is never optimized",
        ],
        answer: 1,
        explain: "Meant for hardware registers and signal handlers. For threads you need atomics or locks.",
      },
      {
        q: "A program works at -O0 but prints garbage at -O2. What's the most likely cause?",
        options: [
          "A bug in the compiler",
          "Undefined behaviour (or a data race) in the program, which the optimizer is entitled to assume never happens",
          "-O2 is broken on this CPU",
          "Not enough memory",
        ],
        answer: 1,
        explain: "Compiler bugs exist but are rare; try -fsanitize=undefined,address first.",
      },
      {
        q: "What does `-g` add to a binary?",
        options: [
          "Garbage collection",
          "Debug information: line tables, variable locations and types, so a debugger can map machine code back to source",
          "Global optimizations",
          "A GUI",
        ],
        answer: 1,
        explain: "DWARF (or PDB) data lives beside the code. It doesn't change the instructions generated.",
      },
      {
        q: "In a recursive descent calculator, how is `*` made to bind tighter than `+`?",
        options: [
          "By evaluating right to left",
          "The `+` level calls the `*` level for its operands, so products are complete before sums",
          "By sorting the tokens",
          "With a regular expression",
        ],
        answer: 1,
        explain: "One function per precedence level: expr calls term, term calls factor.",
      },
      {
        q: "Which statement about CPython is true?",
        options: [
          "It runs source code line by line with no compilation",
          "It compiles source to bytecode, which its virtual machine interprets",
          "It compiles to native machine code ahead of time",
          "It has no compiler",
        ],
        answer: 1,
        explain: "The .pyc files in __pycache__ are that bytecode (and 3.13 adds an experimental JIT).",
      },
    ],
  },
];
