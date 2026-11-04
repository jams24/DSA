import type { Lesson } from "../types";

// Compilers, part 1: the big picture, and the machine every compiler is aiming at.

export const compilersPart1: Lesson[] = [
  // ------------------------------------------------------------------ WHAT IS A COMPILER
  {
    id: "comp-intro",
    part: "Part 1 · The big picture",
    title: "What a compiler is, and how it works",
    tagline: "Translators for programs: compilers, interpreters, bytecode VMs and JITs; the phases from source text to machine code; front, middle and back ends; and what really happens inside gcc hello.c.",
    difficulty: "beginner",
    minutes: 30,
    diagram: {
      title: "The compiler pipeline",
      nodes: [
        { id: "src", label: "Source code", kind: "client", x: 90, y: 110, sub: "x = 2 + 3 * y" },
        { id: "lexer", label: "Lexer", kind: "gateway", x: 270, y: 110, sub: "characters → tokens" },
        { id: "parser", label: "Parser", kind: "service", x: 450, y: 110, sub: "tokens → syntax tree" },
        { id: "sema", label: "Semantic analysis", kind: "control", x: 640, y: 110, sub: "names, scopes, types" },
        { id: "irgen", label: "IR generator", kind: "worker", x: 850, y: 110, sub: "tree → simple instructions" },
        { id: "opt", label: "Optimizer", kind: "model", x: 850, y: 300, sub: "same meaning, less work" },
        { id: "codegen", label: "Code generator", kind: "gpu", x: 850, y: 470, sub: "IR → assembly, registers" },
        { id: "asm", label: "Assembler + linker", kind: "registry", x: 560, y: 470, sub: "→ one executable file" },
        { id: "exe", label: "Executable", kind: "node", x: 270, y: 470, sub: "machine code the CPU runs" },
        { id: "interp", label: "Interpreter / VM", kind: "worker", x: 450, y: 300, sub: "runs the tree or bytecode now" },
      ],
      edges: [
        { from: "src", to: "lexer", label: "text" },
        { from: "lexer", to: "parser", label: "tokens" },
        { from: "parser", to: "sema", label: "AST" },
        { from: "sema", to: "irgen", label: "checked AST" },
        { from: "irgen", to: "opt", label: "IR" },
        { from: "opt", to: "codegen", label: "better IR" },
        { from: "codegen", to: "asm", label: "assembly" },
        { from: "asm", to: "exe", label: "machine code" },
        { from: "sema", to: "interp", label: "or run it", dashed: true },
      ],
      flows: [
        {
          name: "Compile ahead of time (C, Rust, Go)",
          path: ["src", "lexer", "parser", "sema", "irgen", "opt", "codegen", "asm", "exe"],
          steps: [
            "The lexer reads characters and groups them into tokens: x, =, 2, +, 3, *, y.",
            "The parser arranges the tokens into a tree that knows * happens before +.",
            "Semantic analysis checks the meaning: is y declared? Can you multiply these types?",
            "The front end is done. The tree becomes IR: small, simple instructions like t1 = 3 * y.",
            "The optimizer rewrites the IR to do less work without changing what it computes.",
            "The code generator picks real CPU instructions and decides which values live in registers.",
            "The assembler turns the text into machine-code bytes; the linker joins them with libraries.",
            "Out comes an executable. The compiler is no longer needed to run it.",
          ],
        },
        {
          name: "Interpret (Python, Ruby, your Pebble)",
          path: ["src", "lexer", "parser", "sema", "interp"],
          steps: [
            "The same front end: characters become tokens...",
            "...tokens become a tree...",
            "...and the tree is checked.",
            "Instead of producing machine code, an interpreter runs the tree (or bytecode made from it) right away.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Your computer's brain, the **CPU**, is a super-fast robot that only understands a tiny language of numbered commands like "put 5 in box 1", "add box 1 to box 2", "jump back 3 steps". Nobody wants to write games in that.

So we write in friendlier languages (Python, C, Java), and use a **translator**:
- A **compiler** is like a translator who takes your **whole book**, checks it for mistakes, and writes a complete copy in the robot's language. Later the robot reads the copy by itself, very fast, and the translator can go home.
- An **interpreter** is like a translator who **stands next to the robot** and reads your book aloud one sentence at a time, translating as they go. You can start immediately, but it's slower, and the translator has to be there every time.

Every translator works the same way you read a sentence: first you see the **letters**, then you group them into **words**, then you understand the **grammar** ("who did what to whom"), then you check it **makes sense** ("the sandwich ate the boy" is grammatical nonsense). Only then do you translate. A compiler does exactly these steps, and by the end of this world **you'll have built two of them**.

## What a compiler is
A **compiler** translates a program from one language (the **source**) into another (the **target**), keeping its **meaning** exactly the same. Usually the target is **machine code** for a CPU, but it doesn't have to be:
| Tool | Source | Target |
|---|---|---|
| \`gcc\`, \`clang\`, \`rustc\`, \`go build\` | C, Rust, Go | machine code (x86-64, ARM64) |
| \`javac\` | Java | JVM bytecode |
| CPython | Python | Python bytecode (then interpreted) |
| \`tsc\` | TypeScript | JavaScript (a **transpiler**: source to source) |
| Babel, Sass | new JavaScript, SCSS | older JavaScript, CSS |
| \`nvcc\`, shader compilers | CUDA, GLSL | GPU code |
| SQL query planners | SQL | an execution plan |

Two promises every compiler makes:
1. **Correctness**: the output does what the source says. Always. A compiler that's fast but occasionally wrong is useless.
2. **Diagnostics**: if the source is broken, explain what's wrong and where.

And one it tries to keep: **make the output fast** (or small).

## Compilers, interpreters and everything between
- An **ahead-of-time (AOT) compiler** translates everything before the program runs. Running is fast, there's no translator at run time, and many mistakes are caught early. But you wait for the build, and you need a separate build for every CPU and OS.
- An **interpreter** executes the program directly. It starts instantly and is easy to write, debug and port, but every operation pays for decoding and checking at run time: often **10–100× slower**.
- Most real languages are **hybrids**. Python and Java compile to **bytecode** (instructions for an imaginary machine), and a **virtual machine** runs it. Java's JVM, JavaScript's V8 and .NET then use a **JIT** (just-in-time) compiler that turns the hot parts into machine code **while the program runs**.

So "compiled language" vs "interpreted language" is really about the **implementation**, not the language: there are C interpreters and Python compilers. Even CPython compiles your code first; the sample below proves it.

## The phases
Read the diagram above. Every compiler, from a one-page toy to LLVM, has these phases:
1. **Lexical analysis** (lexer, scanner, tokenizer): characters → **tokens** (\`let\`, \`x\`, \`=\`, \`42\`, \`;\`). Throws away spaces and comments.
2. **Syntax analysis** (parser): tokens → a **syntax tree** (AST) that captures structure: what's inside what, and the order of operations.
3. **Semantic analysis**: does it make sense? Every name refers to something, types match, \`return\` is inside a function. Builds a **symbol table**.
4. **IR generation**: the tree becomes an **intermediate representation**: a simple, uniform language, often "three-address code" like \`t1 = b * c\`.
5. **Optimization**: rewrite the IR to compute the same results with less work: fold \`3 * 4\` into \`12\`, delete code that can't matter, move work out of loops, inline small functions.
6. **Code generation**: pick real CPU instructions, assign values to **registers**, lay out the stack.
7. **Assembly and linking**: turn assembly text into machine-code bytes and join your code with libraries into one executable.

These group into three **ends**:
- **Front end** (phases 1–3): understands the **source language**. Different for C, Rust and Swift.
- **Middle end** (4–5): works on IR, knows neither the source language nor the CPU.
- **Back end** (6–7): knows the **target machine**. Different for x86-64, ARM64 and RISC-V.

## Why an IR? The M × N problem
With M languages and N CPUs, writing a direct compiler for every pair takes **M × N** compilers. With a shared IR you write M front ends and N back ends: **M + N**. That's exactly **LLVM**'s design: Clang (C, C++), \`rustc\`, Swift, Zig and Julia all emit **LLVM IR**, and LLVM's back ends turn it into code for x86, ARM, RISC-V, WebAssembly and more. Every optimization written for the middle end helps every language at once.

## Your first compiler, in one page
The first sample is a complete compiler for arithmetic: **lexer**, **parser**, **code generator**, and a tiny **stack machine** to run the output. Read it top to bottom: it's the skeleton of everything in this world. Notice:
- The tree \`('+', 2, ('*', 3, ('-', 10, 4)))\` already "knows" the order of operations. No brackets needed any more.
- The generated code is a **post-order** walk of the tree: children first, then the operator.

## What "gcc hello.c" really does
One command runs **four programs**: the **preprocessor** (\`cpp\`: \`#include\`, \`#define\`), the **compiler proper** (\`cc1\`: C to assembly), the **assembler** (\`as\`: assembly to an object file) and the **linker** (\`ld\`: object files and libraries to an executable). The third sample runs them one at a time. You'll study each later in this world.

## Compilers that compile themselves
Most serious compilers are written **in their own language**: GCC in C++, \`rustc\` in Rust, Go's compiler in Go. This is **self-hosting**. The first version must be written in something else (or by hand); that version compiles the next, which compiles the next. This is **bootstrapping**, as in "pulling yourself up by your bootstraps". Self-hosting is also the best test: a compiler is a big, demanding program.

A **cross-compiler** runs on one machine and produces code for another: your laptop compiling for a phone, or for an embedded chip with no room for a compiler.

## What you'll build in this world
1. **Pebble**, a complete interpreter for a small language with functions, closures, lists and helpful error messages: lexer, Pratt parser, resolver, tree-walking interpreter, REPL and a test suite.
2. **pebblec**, a real compiler for Pebble that generates **LLVM IR** and produces **native executables** that run hundreds of times faster.

Along the way: automata and regular expressions, grammars, LL and LR parsing, type checking and type inference, bytecode VMs, SSA, optimization, x86-64 code generation, register allocation, linking, garbage collection and JITs.

## Books if you want more
- **Crafting Interpreters** (Robert Nystrom): the friendliest introduction; free online.
- **Engineering a Compiler** (Cooper & Torczon): the modern textbook.
- **Compilers: Principles, Techniques, and Tools** (Aho, Lam, Sethi, Ullman): "the Dragon Book", the classic, especially for lexing and parsing theory.`,
    keyPoints: [
      "A compiler translates a program into another language without changing its meaning; usually into machine code, but bytecode, JavaScript and GPU code are targets too",
      "Interpreters run programs directly: instant start, slower execution. Most real languages are hybrids: bytecode plus a VM, often with a JIT",
      "The phases: lexing → parsing → semantic analysis → IR → optimization → code generation → assembly and linking",
      "Front end = source language, middle end = IR, back end = target CPU. A shared IR turns M × N compilers into M + N",
      "gcc hello.c runs four programs: preprocessor, compiler, assembler, linker",
      "Self-hosting compilers are written in their own language and bootstrapped from an earlier version",
    ],
    code: [
      {
        title: "A complete compiler in one page",
        variants: [{ lang: "python", code: `# A whole compiler in one page: source text -> tokens -> tree -> instructions -> run.
# It only understands arithmetic, but every real compiler has these same phases.
import re

source = "2 + 3 * (10 - 4)"

# 1. LEXER: chop the text into tokens (the "words")
def lex(text):
    tokens = []
    for number, op in re.findall(r"\\s*(?:(\\d+)|(.))", text):
        tokens.append(("NUM", int(number)) if number else ("OP", op))
    return tokens

# 2. PARSER: arrange the tokens into a tree that respects * before +
def parse(tokens):
    pos = 0

    def peek():
        return tokens[pos][1] if pos < len(tokens) else None

    def take():
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    def expr():  # expr = term { (+|-) term }
        node = term()
        while peek() in ("+", "-"):
            node = (take()[1], node, term())
        return node

    def term():  # term = factor { (*|/) factor }
        node = factor()
        while peek() in ("*", "/"):
            node = (take()[1], node, factor())
        return node

    def factor():  # factor = NUM | ( expr )
        kind, value = take()
        if kind == "NUM":
            return value
        node = expr()
        take()  # the ")"
        return node

    return expr()

# 3. CODE GENERATOR: walk the tree and emit instructions for a stack machine
def codegen(node, out):
    if isinstance(node, int):
        out.append(("PUSH", node))
    else:
        op, left, right = node
        codegen(left, out)
        codegen(right, out)
        out.append(({"+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV"}[op],))
    return out

# 4. THE MACHINE: run the instructions with a stack
def run(code):
    stack = []
    for ins in code:
        if ins[0] == "PUSH":
            stack.append(ins[1])
        else:
            b, a = stack.pop(), stack.pop()
            stack.append({"ADD": a + b, "SUB": a - b, "MUL": a * b, "DIV": a // b}[ins[0]])
    return stack.pop()

tokens = lex(source)
tree = parse(tokens)
code = codegen(tree, [])
print("source:", source)
print("tokens:", " ".join(str(v) for _, v in tokens))
print("tree:  ", tree)
print("code:  ", "; ".join(" ".join(map(str, ins)) for ins in code))
print("result:", run(code))` }],
        explain: `- **Lexer**: one regular expression finds either a number or a single other character, skipping spaces. \`"10"\` becomes one token, not two: the lexer groups characters into meaningful units.
- **Parser**: three functions, one per precedence level. \`expr\` handles \`+\` and \`-\`, \`term\` handles \`*\` and \`/\`, \`factor\` handles numbers and brackets. Because \`expr\` calls \`term\` for its operands, \`*\` always binds tighter than \`+\`. This style is called **recursive descent**; you'll master it in Part 2.
- **Code generator**: a post-order walk. To compute \`a + b\`: code for a, code for b, then \`ADD\`. The brackets have vanished: the tree's shape replaced them.
- **Machine**: a stack. \`PUSH\` puts a number on it; \`SUB\` pops two and pushes the difference. Notice the operand order: the **second** pop is the left operand.
- This exact design, bytecode for a stack machine, is how CPython, the JVM and WebAssembly work.`,
        output: `source: 2 + 3 * (10 - 4)
tokens: 2 + 3 * ( 10 - 4 )
tree:   ('+', 2, ('*', 3, ('-', 10, 4)))
code:   PUSH 2; PUSH 3; PUSH 10; PUSH 4; SUB; MUL; ADD
result: 20`,
      },
      {
        title: "Python compiles your code too",
        variants: [{ lang: "python", code: `# Python is "interpreted", but it compiles your code first: to bytecode, which its virtual machine runs.
import dis

source = "x = 2 + 3 * 4\\nprint('x is', x)"

code = compile(source, "<demo>", "exec")  # lexing, parsing and code generation happen here
print("compile() returned a", type(code).__name__, "object")
print("names it uses:", code.co_names)

instructions = list(dis.get_instructions(code))
print("it loads the number 14 directly:", any(i.opname.startswith("LOAD") and i.argval == 14 for i in instructions))
print("it has no add or multiply instruction:", not any(i.opname == "BINARY_OP" for i in instructions))
exec(code)  # now the virtual machine runs the bytecode

try:
    compile("x = (2 + ", "<broken>", "exec")
except SyntaxError as e:
    print("a syntax error is caught at compile time, before anything runs:", e.msg)` }],
        explain: `- \`compile()\` runs CPython's lexer, parser and code generator and returns a **code object**: bytecode plus constants and names. Every \`.py\` file goes through this before it runs (cached as \`.pyc\` in \`__pycache__\`).
- The bytecode loads the constant **14** directly, and contains no add or multiply: the compiler **folded** \`2 + 3 * 4\` at compile time. Even an "interpreted" language optimizes.
- The syntax error is reported **before any code runs**. That's why a typo at the bottom of a Python file stops the whole file, even the lines above it.
- Try \`import dis; dis.dis(code)\` to see the instructions. Their names change between Python versions, which is one reason the sample checks the facts instead of printing them.`,
        output: `compile() returned a code object
names it uses: ('x', 'print')
it loads the number 14 directly: True
it has no add or multiply instruction: True
x is 14
a syntax error is caught at compile time, before anything runs: '(' was never closed`,
      },
      {
        title: "The four programs inside gcc hello.c",
        linux: true,
        variants: [{ lang: "bash", code: `# The four stages hidden inside one "gcc hello.c" command, run one at a time.
cat > hello.c <<'C'
#include <stdio.h>
#define GREETING "hello, compiler"

int main(void) {
    printf("%s\\n", GREETING);   // the preprocessor will replace GREETING
    return 0;
}
C

gcc -E hello.c -o hello.i    # 1. preprocess: paste in #includes, expand #defines, drop comments
gcc -S hello.i -o hello.s    # 2. compile:    C -> assembly text for this CPU
gcc -c hello.s -o hello.o    # 3. assemble:   assembly -> machine code in an object file
gcc hello.o -o hello         # 4. link:       object file + C library -> a program you can run

lines_c=$(wc -l < hello.c)
lines_i=$(wc -l < hello.i)
echo "1. preprocess: hello.c has $lines_c lines, hello.i has hundreds more: $([ "$lines_i" -gt 300 ] && echo yes)"
echo "   GREETING was replaced by its text: $([ "$(grep -c '"hello, compiler"' hello.i)" = 1 ] && echo yes); the comment was removed: $([ "$(grep -c 'preprocessor will' hello.i)" = 0 ] && echo yes)"
echo "2. compile: hello.s is assembly text. The function it calls: $(grep -oE '\\b(bl|call)[[:space:]]+[a-z_]+' hello.s | awk '{print $2}')"
echo "   (gcc noticed printf(\\"%s\\\\n\\", s) is just puts(s) and swapped it: the compiler optimises even here)"
echo "3. assemble: symbols in hello.o:"
nm hello.o | awk '{ if (NF == 3) print "   " $2, $3, "(T = defined here, in the text section)"; else print "   " $1, $2, "(U = undefined: the linker must find it)" }'
echo "4. link: the linker found puts in the C library. Running ./hello:"
./hello` }],
        explain: `- \`gcc -E\` stops after **preprocessing**. \`#include <stdio.h>\` pasted in hundreds of lines of declarations; \`GREETING\` was replaced by its text; the comment is gone. The compiler proper never sees \`#define\`.
- \`gcc -S\` stops after **compiling** to assembly. GCC noticed that \`printf("%s\\n", s)\` does the same as \`puts(s)\` and called \`puts\` instead: optimization happens even without \`-O\`.
- \`gcc -c\` stops after **assembling**. \`nm\` lists the object file's symbols: \`main\` is defined here (\`T\`, in the text section), \`puts\` is **undefined** (\`U\`): the object file says "I need puts from somewhere".
- The last command **links**: it finds \`puts\` in the C library and produces an executable. Run \`gcc -v hello.c\` to see the real programs (\`cc1\`, \`as\`, \`collect2\`/\`ld\`) it launches.`,
        output: `1. preprocess: hello.c has 7 lines, hello.i has hundreds more: yes
   GREETING was replaced by its text: yes; the comment was removed: yes
2. compile: hello.s is assembly text. The function it calls: puts
   (gcc noticed printf("%s\\n", s) is just puts(s) and swapped it: the compiler optimises even here)
3. assemble: symbols in hello.o:
   T main (T = defined here, in the text section)
   U puts (U = undefined: the linker must find it)
4. link: the linker found puts in the C library. Running ./hello:
hello, compiler`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a compiler and an interpreter?",
        freq: "very-common",
        a: `A **compiler** translates the whole program into another language (usually machine code) **before** it runs; the output runs without the compiler. An **interpreter** executes the program directly, translating as it goes, so it's needed at every run.

Trade-offs: compiled code runs much faster and many errors are caught at build time, but builds take time and output is per-platform. Interpreters start instantly, are portable and simpler to build, but are typically 10–100× slower. Most modern systems are **hybrids**: compile to bytecode, interpret it in a VM, and JIT-compile hot code (JVM, V8, .NET, PyPy). "Compiled" or "interpreted" describes an implementation, not a language.`,
      },
      {
        q: "What are the phases of a compiler?",
        freq: "very-common",
        a: `1. **Lexical analysis**: characters → tokens.
2. **Syntax analysis**: tokens → parse tree / AST, checking the grammar.
3. **Semantic analysis**: name resolution, type checking, building symbol tables.
4. **Intermediate code generation**: AST → IR (three-address code, SSA).
5. **Optimization**: machine-independent IR transformations.
6. **Code generation**: instruction selection, register allocation, instruction scheduling.
7. Then the **assembler** and **linker** produce the executable.

Phases 1–3 are the **front end**, 4–5 the **middle end**, 6 onwards the **back end**. Errors can come from every phase: lexical (bad character), syntax (missing bracket), semantic (type mismatch), link (undefined symbol).`,
      },
      {
        q: "Why do compilers use an intermediate representation instead of going straight from AST to assembly?",
        freq: "common",
        a: `- **Reuse (M × N → M + N)**: M front ends and N back ends share one IR, so a new language or a new CPU needs one new piece, not M or N. LLVM is the prime example.
- **Optimization is easier**: IR is simple and uniform (few instruction kinds, explicit temporaries, explicit control flow), so analyses like constant propagation and dead-code elimination are written once, independent of syntax and of the CPU.
- **Separation of concerns**: the front end worries about language rules, the back end about registers and instruction encodings.
- Compilers often use **several** IRs at different levels: Rust goes AST → HIR → MIR → LLVM IR → machine IR.`,
      },
      {
        q: "Is Python compiled or interpreted?",
        freq: "common",
        a: `Both. CPython **compiles** source to **bytecode** (cached in \`.pyc\` files), then its **virtual machine** interprets the bytecode. The compile step catches syntax errors and does small optimizations like constant folding, but types are checked at run time, so most errors only appear when the code runs.

Other implementations differ: **PyPy** adds a tracing JIT that compiles hot loops to machine code, and Python 3.13+ ships an experimental JIT. Java is similar: \`javac\` compiles to bytecode, the JVM interprets it and JIT-compiles hot methods.`,
      },
      {
        q: "What does it mean for a compiler to be self-hosting, and how do you bootstrap one?",
        freq: "occasional",
        a: `A **self-hosting** compiler is written in the language it compiles (GCC in C++, \`rustc\` in Rust, Go in Go). **Bootstrapping**: write a first compiler for (a subset of) the language in an existing language; use it to compile a version written in the new language; then that compiler compiles itself. Rust's first compiler was in OCaml; Go's was in C until Go 1.5.

Benefits: the compiler is a large real-world test of the language, and its developers use the language daily. A subtle risk is the "trusting trust" attack (Ken Thompson): a compromised compiler binary can insert a backdoor into every compiler it builds, invisible in the source. Reproducible builds and diverse double-compiling counter it.`,
      },
      {
        q: "What's a transpiler, and is it a real compiler?",
        freq: "occasional",
        a: `A **transpiler** (source-to-source compiler) translates between languages at a similar level: TypeScript → JavaScript, modern JS → older JS (Babel), Sass → CSS, or Cython → C. It's a real compiler: it lexes, parses, analyses (TypeScript's type checker is a big semantic analysis phase) and generates code, just with a high-level target. The output is meant to be fed to another tool: a browser, or a C compiler.`,
      },
      {
        q: "AOT vs JIT compilation: what are the trade-offs?",
        freq: "common",
        a: `**Ahead-of-time** (C, Rust, Go, GraalVM native image): no warm-up, predictable performance, small runtime, low memory, no compiler shipped with the program. But it must optimize without knowing the real inputs, and produces one binary per platform.

**Just-in-time** (JVM, V8, .NET, PyPy): starts by interpreting, profiles what actually happens, then compiles the hot code with **speculative** optimizations based on real types and branches (inlining virtual calls, specialising on the types seen), with **deoptimization** as a safety net. It can beat AOT on dynamic code, but pays warm-up time, memory for the compiler and profiles, and less predictable latency. Part 5 builds a tiny JIT.`,
      },
    ],
    quiz: [
      {
        q: "What must a compiler preserve above all else?",
        options: ["The program's speed", "The program's meaning", "The variable names", "The number of lines"],
        answer: 1,
        explain: "Correctness first: the output must do exactly what the source says. Optimizations are only allowed when they don't change observable behaviour.",
      },
      {
        q: "Which phase turns characters into tokens?",
        options: ["Parser", "Lexer", "Optimizer", "Linker"],
        answer: 1,
        explain: "The lexer (scanner) groups characters into tokens like identifiers, numbers and operators, and discards whitespace and comments.",
      },
      {
        q: "In the one-page compiler, why does `2 + 3 * (10 - 4)` produce the tree `('+', 2, ('*', 3, ...))` rather than `('*', ('+', 2, 3), ...)`?",
        options: [
          "The lexer reorders the tokens",
          "`expr` parses `term`s as its operands, so `*` groups before `+` gets them",
          "Python's operator precedence is used",
          "The code generator rearranges the tree",
        ],
        answer: 1,
        explain: "Each precedence level is its own function; the lower-precedence function calls the higher one for its operands, so higher-precedence operators end up deeper in the tree.",
      },
      {
        q: "What does LLVM's shared IR buy you, with M languages and N CPUs?",
        options: ["M × N compilers instead of M + N", "M + N pieces instead of M × N compilers", "Faster lexing", "No need for a linker"],
        answer: 1,
        explain: "Each language needs one front end to the IR and each CPU one back end from it: M + N components cover every combination.",
      },
      {
        q: "After `gcc -c hello.c`, `nm hello.o` shows `U puts`. What does U mean?",
        options: ["Unused", "Undefined here: the linker must find it elsewhere", "Unsigned", "User-defined"],
        answer: 1,
        explain: "U marks a symbol the object file references but doesn't define. The linker resolves it, here against the C library.",
      },
      {
        q: "CPython runs `x = 2 + 3 * 4`. What happens first?",
        options: [
          "Each character is executed as it's read",
          "The code is compiled to bytecode, and the constant 14 is folded at compile time",
          "It's compiled to x86 machine code",
          "It's sent to a JIT immediately",
        ],
        answer: 1,
        explain: "CPython compiles source to bytecode before running it, and its compiler folds constant expressions like `2 + 3 * 4` into 14.",
      },
      {
        q: "Which part of a compiler knows about the target CPU's registers?",
        options: ["The front end", "The middle end", "The back end", "The lexer"],
        answer: 2,
        explain: "Register allocation and instruction selection live in the back end. The front end knows the source language; the middle end works on target-independent IR.",
      },
      {
        q: "What is a cross-compiler?",
        options: [
          "A compiler that compiles two languages at once",
          "A compiler that runs on one platform and produces code for another",
          "A compiler written in its own language",
          "A compiler that checks code against a style guide",
        ],
        answer: 1,
        explain: "Cross-compilers build for a different target: phones, embedded chips, or ARM servers from an x86 laptop. A compiler written in its own language is self-hosting.",
      },
    ],
  },

  // ------------------------------------------------------------------ THE MACHINE
  {
    id: "comp-machine",
    title: "The machine a compiler targets",
    tagline: "What the output actually runs on: registers, memory and the fetch-decode-execute loop, instruction sets, assembly, the call stack and stack frames, calling conventions, and how numbers live in memory.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["cpu", "recursion"],
    concept: `## Explain it like I'm 10 🧸
Imagine the CPU as a **very fast, very obedient worker** at a desk:
- On the desk are a few **pockets** (**registers**). Things in pockets can be used instantly.
- Behind the worker is a **huge wall of numbered drawers** (**memory**). Fetching from a drawer is much slower than using a pocket.
- The worker has a **list of instructions** and a **finger** (the **program counter**) pointing at the next one. Over and over: read the instruction, do it, move the finger. Some instructions say "move your finger somewhere else" (a **jump**); that's how loops and if-statements work.
- When the worker starts a side task (calls a **function**), they write "where I was" on a sticky note and put it on a **pile** (the **stack**). When the side task ends, they take the top note and carry on from there. Side tasks inside side tasks just make the pile taller.

A compiler's job is to turn your nice program into that list of tiny instructions, and to use the pockets wisely.

## Registers, memory and the loop
A CPU has a small number of **registers** (x86-64 has 16 general-purpose ones: \`rax\`, \`rbx\`, \`rcx\`, \`rdx\`, \`rsi\`, \`rdi\`, \`rbp\`, \`rsp\`, \`r8\`–\`r15\`; ARM64 has 31: \`x0\`–\`x30\`), each holding 64 bits. Memory is a giant array of bytes, addressed by number. Arithmetic happens on registers; loads and stores move data between registers and memory.

The CPU runs one loop forever: **fetch** the instruction at the program counter (\`rip\` on x86-64, \`pc\` on ARM), **decode** it, **execute** it, advance. Step through it in the first visualizer.

Why registers matter: a register is read in **under a nanosecond**; a value in RAM can take **~100 ns** if it isn't cached. Keeping hot values in registers is one of a compiler's most important jobs (Part 5).

## Instruction sets, machine code and assembly
The set of instructions a CPU understands is its **instruction set architecture (ISA)**:
- **x86-64** (Intel, AMD): **CISC**: many instructions, variable length (1–15 bytes), instructions can read memory directly.
- **ARM64 / AArch64** (Apple silicon, phones, AWS Graviton): **RISC**: fixed 4-byte instructions, only loads and stores touch memory, lots of registers.
- **RISC-V**: an open, modular RISC design, popular in research and embedded chips.

**Machine code** is the bytes; **assembly** is the same thing as readable text, one instruction per line. An **assembler** translates assembly to bytes. Here's what clang produces for \`long square(long x) { return x * x; }\` with optimization:
\`\`\`asm
; x86-64 (Intel syntax)          ; ARM64
square:                          square:
    mov  rax, rdi                    mul  x0, x0, x0
    imul rax, rdi                    ret
    ret
\`\`\`
The argument arrives in a register (\`rdi\` / \`x0\`), the result leaves in a register (\`rax\` / \`x0\`). Those choices aren't the CPU's: they're the **calling convention**.

## The call stack and stack frames
Functions need somewhere to keep **local variables**, **saved registers** and the **return address**. They use the **stack**: a region of memory that grows **downwards**, with the **stack pointer** (\`rsp\`, \`sp\`) marking the top.
- \`call f\` pushes the **return address** (the instruction after the call) and jumps to \`f\`.
- \`f\` sets up its **stack frame**: room for its locals and anything it must save.
- \`ret\` pops the return address and jumps back.

Because every call gets its **own frame**, recursion just works: each \`fact(n)\` has its own \`n\`. The \`toy_cpu\` sample shows the stack growing as \`fact(4)\` calls \`fact(3)\`... (each frame holds a saved \`n\` and a return address), then shrinking as the answers come back. A **stack overflow** is what happens when recursion goes so deep the stack runs out.

Here is \`sum_to\` (a loop adding 1..n) compiled **without** optimization (\`-O0\`): every variable lives in the frame at a fixed offset from \`rbp\`, and is loaded and stored around every use:
\`\`\`asm
sum_to:
    push rbp                       ; save the caller's frame pointer
    mov  rbp, rsp                  ; our frame starts here
    mov  qword ptr [rbp - 8], rdi  ; n  lives at rbp-8
    mov  qword ptr [rbp - 16], 0   ; s  lives at rbp-16
    mov  qword ptr [rbp - 24], 1   ; i  lives at rbp-24
.LBB2_1:
    mov  rax, qword ptr [rbp - 24]
    cmp  rax, qword ptr [rbp - 8]  ; i <= n ?
    jg   .LBB2_4
    ...                            ; s += i; i++  (all through memory)
    jmp  .LBB2_1
.LBB2_4:
    mov  rax, qword ptr [rbp - 16] ; return s
    pop  rbp
    ret
\`\`\`
With \`-O1\` the loop **disappears**: clang recognised the pattern and computes \`n(n+1)/2\`-style arithmetic with \`lea\`, \`mul\` and \`shld\`, in about ten instructions with no loop. That gap between naive and optimized code is what the middle and back end of a compiler are for.

## Calling conventions (the ABI)
Separately compiled code (your program, the C library, a Rust crate) can only call each other if they agree on the rules. The **System V AMD64 ABI** (Linux, macOS on x86-64):
| Rule | x86-64 System V | ARM64 (AAPCS64) |
|---|---|---|
| Integer arguments | \`rdi, rsi, rdx, rcx, r8, r9\`, then the stack | \`x0\`–\`x7\`, then the stack |
| Return value | \`rax\` (and \`rdx\`) | \`x0\` (and \`x1\`) |
| Callee-saved (must be preserved) | \`rbx, rbp, r12–r15\` | \`x19\`–\`x28\`, frame pointer \`x29\` |
| Caller-saved (may be clobbered) | \`rax, rcx, rdx, rsi, rdi, r8–r11\` | \`x0\`–\`x17\` (\`x18\` is reserved on some platforms) |
| Return address | pushed on the stack by \`call\` | in the **link register** \`x30\` |
| Stack alignment | 16 bytes at every \`call\` | 16 bytes always |

Windows x64 uses different registers (\`rcx, rdx, r8, r9\` plus 32 bytes of "shadow space"). Mixing conventions up is a classic source of crashes in hand-written assembly and JITs. You'll obey these rules yourself when you generate x86-64 in Part 5.

## A program's memory layout
When the OS loads an executable, its address space looks like this (low addresses at the bottom):
\`\`\`text
┌──────────────┐ high addresses
│    stack     │ ↓ grows down: frames, locals, return addresses
│      ...     │
│    heap      │ ↑ grows up: malloc / new
│    .bss      │ globals that start at zero (take no space in the file)
│    .data     │ initialised globals:  int counter = 5;
│   .rodata    │ constants and string literals
│    .text     │ machine code
└──────────────┘ low addresses
\`\`\`
The compiler decides what goes in which **section**; the linker and loader decide the addresses (Part 5).

## How data is represented
- **Integers** use **two's complement**: to negate, flip all bits and add one. So 8-bit \`-1\` is \`11111111\`, and the same \`add\` instruction works for signed and unsigned numbers. A 64-bit signed integer ranges from −2⁶³ to 2⁶³−1; going past wraps around (in C, signed overflow is **undefined behaviour**, which compilers exploit to optimize).
- **Division** on CPUs rounds **towards zero** (\`-7 / 2 = -3\`), while Python rounds **down** (\`-7 // 2 = -4\`). Your compiler in Part 6 has to bridge that gap.
- **Endianness**: x86 and ARM (normally) are **little-endian**: the number \`0x12345678\` is stored in memory as the bytes \`78 56 34 12\`.
- **Alignment**: an 8-byte value should live at an address divisible by 8. Compilers insert **padding** in structs to keep fields aligned.
- **Floating point**: IEEE 754, in separate registers (\`xmm0\`–\`xmm15\` on x86-64, \`d0\`–\`d31\` on ARM64). \`0.1 + 0.2 != 0.3\` on every one of them.`,
    keyPoints: [
      "CPUs loop forever: fetch the instruction at the program counter, decode it, execute it. Jumps make ifs and loops",
      "Registers are tiny and instant; memory is huge and slow. Keeping values in registers is a compiler's job",
      "An ISA is the CPU's instruction set: x86-64 is CISC, ARM64 and RISC-V are RISC. Assembly is machine code as text",
      "call pushes a return address, ret pops it; each call gets its own stack frame, which is why recursion works",
      "Calling conventions fix where arguments and results go and which registers survive a call (System V: rdi, rsi, rdx..., result in rax)",
      "Two's complement integers, little-endian bytes, alignment and padding: how data actually sits in memory",
    ],
    code: [
      {
        title: "A toy CPU running recursive factorial",
        variants: [{ lang: "python", code: `# A toy CPU: a few registers, a stack in memory, and a list of instructions.
# Real CPUs work the same way, just with billions of transistors and many more instructions.

program = """
        mov  r0, 4        ; the argument: fact(4)
        call fact
        print r0          ; the answer comes back in r0
        halt
fact:   cmp  r0, 1        ; if n <= 1 the answer is 1
        jle  base
        push r0           ; save n on the stack: the recursive call will overwrite r0
        sub  r0, 1
        call fact         ; r0 = fact(n - 1)
        pop  r1           ; get n back
        mul  r0, r1       ; r0 = n * fact(n - 1)
        ret
base:   mov  r0, 1
        ret
"""

# "assembler": turn text into (op, args) and find the address of each label
code, labels = [], {}
for line in program.strip().splitlines():
    line = line.split(";")[0].strip()
    if ":" in line:
        label, line = line.split(":", 1)
        labels[label.strip()] = len(code)
        line = line.strip()
    if line:
        op, *rest = line.split(None, 1)
        args = [a.strip() for a in rest[0].split(",")] if rest else []
        code.append((op, args))

reg = {"r0": 0, "r1": 0}
memory = [0] * 16
sp = len(memory)  # the stack starts at the top of memory and grows down
pc = 0            # program counter: which instruction runs next
flag = 0          # result of the last cmp
depth = 0
val = lambda a: reg[a] if a in reg else int(a)

while True:
    op, args = code[pc]
    pc += 1
    if op == "mov":
        reg[args[0]] = val(args[1])
    elif op in ("sub", "mul"):
        reg[args[0]] = reg[args[0]] - val(args[1]) if op == "sub" else reg[args[0]] * val(args[1])
    elif op == "cmp":
        flag = reg[args[0]] - val(args[1])
    elif op == "jle":
        pc = labels[args[0]] if flag <= 0 else pc
    elif op == "push":
        sp -= 1
        memory[sp] = reg[args[0]]
    elif op == "pop":
        reg[args[0]] = memory[sp]
        sp += 1
    elif op == "call":
        sp -= 1
        memory[sp] = pc  # the return address: where to continue afterwards
        print(f"{'  ' * depth}call fact with r0 = {reg['r0']}   stack: {memory[sp:]}")
        depth += 1
        pc = labels[args[0]]
    elif op == "ret":
        depth -= 1
        pc = memory[sp]
        sp += 1
        print(f"{'  ' * depth}return {reg['r0']}")
    elif op == "print":
        print("result:", reg[args[0]])
    elif op == "halt":
        break` }],
        explain: `- The first loop is an **assembler**: it strips comments, records the address of each **label** (\`fact\`, \`base\`) and turns lines into \`(op, args)\` pairs. Real assemblers also do this two-step dance, because a jump may refer to a label further down.
- The main loop is **fetch-decode-execute**: read \`code[pc]\`, advance \`pc\`, then act on the opcode.
- \`call\` pushes the **return address** (the current \`pc\`, already pointing past the call) and jumps; \`ret\` pops it. That's exactly what x86's \`call\`/\`ret\` do.
- Reading the trace: when \`fact(3)\` is called the stack is \`[9, 4, 2]\`: the return address 9 (back into \`fact\`, after its recursive call), the saved \`n = 4\`, and the return address 2 (back into the main program). Every level adds a saved \`n\` and a return address.
- \`push r0\` before the recursive call matters: the callee overwrites \`r0\`, so the caller **saves** what it still needs. That's the caller-saved register rule from the ABI table, done by hand.`,
        output: `call fact with r0 = 4   stack: [2]
  call fact with r0 = 3   stack: [9, 4, 2]
    call fact with r0 = 2   stack: [9, 3, 9, 4, 2]
      call fact with r0 = 1   stack: [9, 2, 9, 3, 9, 4, 2]
      return 1
    return 2
  return 6
return 24
result: 24`,
      },
    ],
    interview: [
      {
        q: "What is a stack frame, and what does it typically contain?",
        freq: "very-common",
        a: `The region of the call stack belonging to one active function call. Typically: the **return address** (pushed by \`call\`), the saved **frame pointer** of the caller, saved **callee-saved registers** the function uses, its **local variables** and spills, and outgoing **arguments** beyond the register ones. It's created in the **prologue** (\`push rbp; mov rbp, rsp; sub rsp, N\`) and torn down in the **epilogue** (\`leave; ret\`). Optimizing compilers often omit the frame pointer and address locals relative to \`rsp\`.`,
      },
      {
        q: "What's a calling convention? Give the main rules of the x86-64 System V ABI.",
        freq: "common",
        a: `The contract between caller and callee: where arguments go, where the result comes back, which registers must survive the call, and how the stack is laid out. Without it, separately compiled code couldn't call each other.

System V x86-64: integer/pointer args in \`rdi, rsi, rdx, rcx, r8, r9\` (then the stack), floats in \`xmm0–xmm7\`; return in \`rax\` (\`rdx\` for the high half); callee-saved \`rbx, rbp, r12–r15\`; everything else caller-saved; the stack is 16-byte aligned at the \`call\`; there's a 128-byte **red zone** below \`rsp\` that leaf functions may use without moving \`rsp\`. Windows x64 differs (\`rcx, rdx, r8, r9\`, 32-byte shadow space).`,
      },
      {
        q: "Caller-saved vs callee-saved registers: what's the difference and why have both?",
        freq: "common",
        a: `**Caller-saved** (volatile) registers may be overwritten by any call; if the caller needs a value across a call, it must save it first. **Callee-saved** (non-volatile) registers must have the same value when the function returns; if the callee wants to use one, it saves and restores it.

Having both is a compromise: short-lived temporaries go in caller-saved registers (no cost if no call happens), long-lived values in callee-saved ones (saved once in the prologue, not around every call). Register allocators use this split when choosing registers for values that live across calls.`,
      },
      {
        q: "CISC vs RISC: what's the difference?",
        freq: "occasional",
        a: `**CISC** (x86): many complex, variable-length instructions; arithmetic can read and write memory directly; fewer registers historically. **RISC** (ARM, RISC-V, MIPS): fewer, simpler, fixed-length instructions; a **load/store** architecture (only loads and stores touch memory); many registers; simpler decoding and pipelining.

The line has blurred: modern x86 CPUs decode instructions into RISC-like **micro-ops** internally, and ARM has grown many instructions. Compilers care because instruction selection and register allocation differ: more registers means fewer spills.`,
      },
      {
        q: "What's two's complement and why is it used?",
        freq: "common",
        a: `The standard representation of signed integers: the most significant bit has weight −2ⁿ⁻¹. To negate: invert all bits and add 1. Benefits: only **one zero**, and **addition, subtraction and multiplication are the same circuits** for signed and unsigned numbers (only comparisons, division and widening differ). An n-bit value ranges from −2ⁿ⁻¹ to 2ⁿ⁻¹−1, and overflow wraps around. In C, signed overflow is undefined behaviour, which lets compilers assume \`i + 1 > i\`.`,
      },
      {
        q: "What causes a stack overflow?",
        freq: "common",
        a: `The stack is a fixed-size region (often 8 MB for the main thread on Linux, less for other threads). Each call pushes a frame; **unbounded or very deep recursion**, or a **huge local array**, exhausts it. The next push touches a **guard page**, causing a segmentation fault (or a \`StackOverflowError\` / \`RecursionError\` in managed languages, which check the depth themselves). Fixes: iterate instead of recursing, use an explicit stack on the heap, rely on **tail-call** optimization where the language guarantees it, or raise the limit.`,
      },
      {
        q: "What's endianness? Which do x86 and ARM use?",
        freq: "occasional",
        a: `The order of bytes in a multi-byte value in memory. **Little-endian** stores the least significant byte at the lowest address (\`0x12345678\` → \`78 56 34 12\`); **big-endian** stores the most significant first. x86 is little-endian; ARM is bi-endian but runs little-endian almost everywhere; network protocols use big-endian ("network byte order", hence \`htonl\`). It matters when reading binary files, sending data over a network, or casting between pointer types.`,
      },
    ],
    quiz: [
      {
        q: "What does the program counter hold?",
        options: ["The number of instructions run so far", "The address of the next instruction to execute", "The top of the stack", "The result of the last comparison"],
        answer: 1,
        explain: "The PC (rip on x86-64) points at the next instruction. Jumps, calls and returns work by changing it.",
      },
      {
        q: "What does `call f` do on x86-64?",
        options: [
          "Jumps to f and forgets where it came from",
          "Pushes the return address on the stack, then jumps to f",
          "Copies f's code into the caller",
          "Saves all registers, then jumps to f",
        ],
        answer: 1,
        explain: "call pushes the address of the next instruction and jumps; ret pops it and jumps back. Saving registers is the job of the code, following the calling convention.",
      },
      {
        q: "Under the System V x86-64 ABI, where does a function find its first integer argument?",
        options: ["rax", "rdi", "On the stack", "rbx"],
        answer: 1,
        explain: "Integer arguments go in rdi, rsi, rdx, rcx, r8, r9, in that order. The result comes back in rax.",
      },
      {
        q: "Why does recursion work at all?",
        options: [
          "Because the compiler turns it into a loop",
          "Because each call gets its own stack frame, with its own locals and return address",
          "Because registers are infinite",
          "Because the heap stores every call",
        ],
        answer: 1,
        explain: "Each active call has a separate frame, so fact(4)'s n and fact(3)'s n don't collide.",
      },
      {
        q: "In the toy CPU, why does `fact` do `push r0` before its recursive call?",
        options: [
          "To pass the argument",
          "Because the recursive call will overwrite r0, and fact still needs n afterwards",
          "To align the stack",
          "To print it later",
        ],
        answer: 1,
        explain: "r0 holds both the argument and the result, so the callee clobbers it. The caller saves n on the stack and pops it back into r1 after the call.",
      },
      {
        q: "How is the 32-bit value 0x12345678 laid out in memory on a little-endian CPU?",
        options: ["12 34 56 78", "78 56 34 12", "87 65 43 21", "56 78 12 34"],
        answer: 1,
        explain: "Little-endian puts the least significant byte first, at the lowest address.",
      },
      {
        q: "What does C's `-7 / 2` evaluate to on a typical CPU, compared with Python's `-7 // 2`?",
        options: ["-3 and -4", "-4 and -3", "-4 and -4", "-3 and -3"],
        answer: 0,
        explain: "Hardware division truncates towards zero (-3); Python's floor division rounds down (-4). A compiler for a Python-like language must add a correction.",
      },
      {
        q: "Which section of an executable holds string literals and other constants?",
        options: [".text", ".rodata", ".bss", "the heap"],
        answer: 1,
        explain: ".rodata is read-only data. .text holds code, .data initialised globals, .bss zero-initialised globals.",
      },
    ],
  },
];
