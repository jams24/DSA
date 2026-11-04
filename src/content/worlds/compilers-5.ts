import type { Lesson } from "../types";

// Compilers, part 5: the back end. Code generation, register allocation, linking and loading,
// runtimes and garbage collection, and JIT compilation.

export const compilersPart5: Lesson[] = [
  // ------------------------------------------------------------------ CODE GENERATION
  {
    id: "comp-codegen",
    part: "Part 5 · The back end",
    title: "Code generation: from IR to x86-64",
    tagline: "The back end's jobs: instruction selection by tree tiling, the stack-machine strategy, prologues and epilogues, the calling convention in practice, stack alignment, division and comparisons on x86, instruction scheduling, and peephole optimization.",
    difficulty: "advanced",
    minutes: 50,
    visualizers: ["cpu"],
    diagram: {
      title: "Inside a back end",
      nodes: [
        { id: "ir", label: "Optimised IR", kind: "client", x: 110, y: 130, sub: "unlimited virtual registers" },
        { id: "isel", label: "Instruction selection", kind: "service", x: 330, y: 130, sub: "cover the IR with real instructions" },
        { id: "sched", label: "Scheduling", kind: "worker", x: 560, y: 130, sub: "order instructions to hide latency" },
        { id: "ra", label: "Register allocation", kind: "control", x: 800, y: 130, sub: "16 real registers, spills" },
        { id: "frame", label: "Frame lowering", kind: "cache", x: 800, y: 400, sub: "prologue, epilogue, stack slots" },
        { id: "peep", label: "Peephole + emission", kind: "gpu", x: 560, y: 400, sub: "tidy up, encode bytes" },
        { id: "obj", label: "Object file", kind: "storage", x: 330, y: 400, sub: "machine code + relocations" },
      ],
      edges: [
        { from: "ir", to: "isel" },
        { from: "isel", to: "sched", label: "machine instructions" },
        { from: "sched", to: "ra" },
        { from: "ra", to: "frame", label: "spill slots" },
        { from: "frame", to: "peep" },
        { from: "peep", to: "obj" },
      ],
      flows: [
        {
          name: "Compile t3 = a[i] + 1",
          path: ["ir", "isel", "sched", "ra", "frame", "peep", "obj"],
          steps: [
            "The IR says: load from a + i * 8, then add 1. Values live in unlimited virtual registers.",
            "Instruction selection notices x86 can do the address maths inside the load: mov v1, [a + i*8].",
            "The scheduler moves the load as early as possible, so its memory latency overlaps other work.",
            "The register allocator maps a, i, v1 onto real registers, spilling to the stack if it runs out.",
            "Frame lowering adds the prologue and epilogue and gives spilled values their stack slots.",
            "A peephole pass removes leftovers like mov rax, rax, and the instructions are encoded as bytes.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
The middle end produced a clean recipe, but written for an imaginary kitchen with **unlimited bowls** and **any utensil you like**. The back end has to cook it in a **real kitchen**: only 16 bowls (registers), and only the utensils this particular kitchen has (the CPU's instructions).

So the back end does three things: it picks the **best real utensil** for each step (sometimes one fancy utensil does three steps at once!), it decides **which bowl** holds what (and puts things in the fridge, the memory, when bowls run out), and it writes the final instructions in the CPU's own language.

## The back end's jobs
1. **Instruction selection**: choose machine instructions that implement each IR operation.
2. **Instruction scheduling**: order them so the CPU stays busy.
3. **Register allocation**: map unlimited virtual registers onto the real ones (next lesson).
4. **Frame lowering**: prologue, epilogue, stack slots for spills and locals, the calling convention.
5. **Emission**: write assembly text, or encode bytes into an object file.

## The simplest strategy: treat the CPU as a stack machine
The first sample generates x86-64 the way the earliest compilers did, and the way Chibicc and many teaching compilers still do:
- every expression leaves its result in **\`rax\`**;
- for \`a - b\`: compute \`b\`, **\`push rax\`**; compute \`a\` into \`rax\`; **\`pop rdi\`**; \`sub rax, rdi\`;
- every variable lives in the stack frame at a fixed offset from \`rbp\`: \`[rbp-8]\`, \`[rbp-16]\`...

It's easy to get right and works for any expression, but it's slow: lots of memory traffic and pushes. Real compilers keep values in registers. Still, it's how you should write your first native back end.

## Prologue, epilogue and the frame
\`\`\`asm
fib:
    push rbp            ; save the caller's frame pointer
    mov  rbp, rsp       ; our frame starts here
    sub  rsp, 16        ; room for locals (rounded to 16)
    mov  [rbp-8], rdi   ; the argument n arrives in rdi; give it a home
    ...
.Lret:
    mov  rsp, rbp       ; drop the frame
    pop  rbp            ; restore the caller's frame pointer
    ret
\`\`\`
Every \`return\` jumps to the shared epilogue label. Locals are addressed relative to \`rbp\`, which doesn't move while pushes and pops shift \`rsp\`.

## The calling convention in practice
Recall System V x86-64: arguments in \`rdi, rsi, rdx, rcx, r8, r9\`, result in \`rax\`, and **\`rsp\` must be a multiple of 16 at every \`call\`**. That last rule bites: if you've pushed an odd number of temporaries when you make a call, you must adjust \`rsp\` by 8 first (the sample does \`sub rsp, 8\` / \`add rsp, 8\`). Get it wrong and the program works... until a library function uses an aligned SSE instruction and crashes with a mysterious segfault. On macOS, C symbols also get a leading underscore (\`_main\`, \`_printf\`).

## x86 quirks a code generator must know
- **Division**: \`idiv\` divides the 128-bit value in \`rdx:rax\` by its operand. First **\`cqo\`** sign-extends \`rax\` into \`rdx\`. The quotient lands in \`rax\`, the remainder in \`rdx\`. It truncates toward zero, and dividing by zero (or \`INT64_MIN / -1\`) **traps**, killing the process with SIGFPE.
- **Comparisons**: \`cmp\` sets flags; \`setl al\` turns "less than" into a byte 0 or 1; \`movzx\` widens it. In a branch, skip the materialised bool: \`cmp\` then \`jl\`.
- **Two-operand form**: \`add rax, rdi\` means \`rax = rax + rdi\`: the destination is also a source, so the allocator sometimes needs an extra copy. (ARM64 and RISC-V have three operands: \`add x0, x1, x2\`.)
- **Addressing modes**: \`[base + index*scale + offset]\` with scale 1, 2, 4 or 8, in almost any instruction.

## Instruction selection by tiling
Look at the IR as **trees**, and the instructions as **tiles** (patterns) that each cover part of a tree. Instruction selection = covering the tree with tiles at minimum cost. The array access \`a[i] + 1\`:
\`\`\`text
    (+)                 one tile per node: 9 instructions
   /   \\                big tiles:          mov r1, [a + i*8]
(load)   1                                 add r1, 1
  |
 (+)
/    \\
a    (*)
    /   \\
    i     8
\`\`\`
**Maximal munch** (yes, the lexer rule again!) greedily picks the **biggest** tile that fits at the root, then recurses: fast and good enough for CISC machines like x86. Optimal tiling uses **dynamic programming** over the tree (BURS, iburg). LLVM's SelectionDAG and GlobalISel match patterns written in TableGen. A favourite trick: \`lea\` ("load effective address") computes \`p + k*4 + 12\` in **one** instruction without touching memory, so compilers use it for ordinary arithmetic.

## Instruction scheduling
Modern CPUs **pipeline** instructions: a load takes ~4 cycles from L1 cache, a multiply 3, a divide 20–40. If the next instruction needs the result, the CPU waits. **Scheduling** reorders independent instructions to fill those gaps (**list scheduling** over the dependence graph). Out-of-order CPUs do a lot of this in hardware, so scheduling matters most on simpler, in-order cores (phones, embedded).

## Peephole optimization
A final pass slides a small "window" over the instructions and replaces wasteful patterns:
| Before | After |
|---|---|
| \`push rax\` / \`pop rdi\` | \`mov rdi, rax\` |
| \`mov rax, rax\` | (delete) |
| \`mov rax, 0\` | \`xor eax, eax\` (shorter, and breaks dependencies) |
| \`imul rax, 8\` | \`shl rax, 3\` |
| \`jmp L\` / \`L:\` | \`L:\` |

Run the sample's output through a peephole pass and it shrinks noticeably: look for \`push rax\` followed directly by \`pop rdi\`.

## Assembly or object code?
Most compilers write **assembly text** and run an assembler (GCC does). Others encode **bytes** directly into an object file (LLVM's integrated assembler, Go, JITs, which have no time to spare). Either way, the output contains **relocations** for addresses that aren't known yet: the linker's job, two lessons from now.`,
    keyPoints: [
      "The back end selects instructions, schedules them, allocates registers, lowers the frame and emits code",
      "The simplest native strategy treats the CPU as a stack machine: results in rax, temporaries pushed and popped",
      "Functions need a prologue and epilogue; the System V ABI requires rsp to be 16-byte aligned at every call",
      "x86 division uses cqo then idiv (quotient in rax, remainder in rdx) and traps on divide by zero",
      "Instruction selection tiles IR trees with instruction patterns; maximal munch picks the biggest tile; lea and addressing modes do a lot in one instruction",
      "Scheduling hides latency; peephole optimization cleans up small wasteful patterns",
    ],
    code: [
      {
        title: "A compiler that emits real x86-64 assembly",
        variants: [{ lang: "python", code: `# A code generator straight to x86-64 assembly (Intel syntax, the System V calling convention used
# by Linux and macOS). Like the first compilers, it treats the CPU as a stack machine: every
# expression leaves its value in rax, and pending values wait on the real stack (push / pop).
# Assemble it with a 2-line C runtime that provides print_int:
#   python3 x86_codegen.py > out.s && cc out.s runtime.c -o out && ./out      (x86-64 Linux)
#   python3 x86_codegen.py --macos > out.s && cc -arch x86_64 out.s runtime.c -o out && ./out
import re
import sys

PREFIX = "_" if "--macos" in sys.argv else ""  # macOS puts an underscore before C symbol names
ARG_REGS = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"]  # where the first 6 integer arguments go


def read(text):
    tokens = re.findall(r"\\(|\\)|[^\\s()]+", text)
    pos = 0

    def item():
        nonlocal pos
        pos += 1
        if tokens[pos - 1] != "(":
            t = tokens[pos - 1]
            return int(t) if t.isdigit() else t
        out = []
        while tokens[pos] != ")":
            out.append(item())
        pos += 1
        return out

    prog = []
    while pos < len(tokens):
        prog.append(item())
    return prog


class Gen:
    def __init__(self):
        self.out, self.labels = [], 0

    def emit(self, line):
        self.out.append(line if line.endswith(":") else "    " + line)

    def label(self):
        self.labels += 1
        return f".L{self.labels}"

    def function(self, name, params, body):
        self.slots, self.depth = {}, 0           # variable -> offset from rbp; values pushed so far
        for s in [*params, *(x[1] for x in self.lets(body))]:
            self.slots.setdefault(s, -8 * (len(self.slots) + 1))
        frame = (len(self.slots) * 8 + 15) // 16 * 16  # keep rsp 16-byte aligned, as the ABI requires
        self.ret = self.label()
        self.emit(f".globl {PREFIX}{name}")
        self.emit(f"{PREFIX}{name}:")
        self.emit("push rbp")                    # prologue: save the caller's frame pointer...
        self.emit("mov rbp, rsp")                # ...and start our own frame
        if frame:
            self.emit(f"sub rsp, {frame}")       # room for the locals
        for p, reg in zip(params, ARG_REGS):
            self.emit(f"mov [rbp{self.slots[p]}], {reg}")
        for s in body:
            self.stmt(s)
        self.emit("xor eax, eax")                # falling off the end returns 0
        self.emit(f"{self.ret}:")
        self.emit("mov rsp, rbp")                # epilogue: drop the frame and return
        self.emit("pop rbp")
        self.emit("ret")

    def lets(self, body):
        for s in body:
            if s[0] == "let":
                yield s
            if s[0] in ("if", "while"):
                yield from self.lets([x for x in s[2:] if x != "else"])

    def push(self):
        self.emit("push rax")
        self.depth += 1

    def pop(self, reg):
        self.emit(f"pop {reg}")
        self.depth -= 1

    def expr(self, e):
        if isinstance(e, int):
            self.emit(f"mov rax, {e}")
        elif isinstance(e, str):
            self.emit(f"mov rax, [rbp{self.slots[e]}]")
        elif e[0] == "call":
            for a in e[2:]:                        # evaluate the arguments, parking each on the stack
                self.expr(a)
                self.push()
            for reg in reversed(ARG_REGS[:len(e) - 2]):
                self.pop(reg)
            pad = self.depth % 2 == 1              # an odd number of pushes would misalign the stack
            if pad:
                self.emit("sub rsp, 8")
            self.emit(f"call {PREFIX}{e[1]}")
            if pad:
                self.emit("add rsp, 8")
        else:
            self.expr(e[2])                        # right side first, park it...
            self.push()
            self.expr(e[1])                        # ...left side ends up in rax
            self.pop("rdi")
            op = e[0]
            if op == "+":
                self.emit("add rax, rdi")
            elif op == "-":
                self.emit("sub rax, rdi")
            elif op == "*":
                self.emit("imul rax, rdi")
            elif op in ("/", "%"):
                self.emit("cqo")                   # sign-extend rax into rdx:rax for the division
                self.emit("idiv rdi")              # quotient -> rax, remainder -> rdx
                if op == "%":
                    self.emit("mov rax, rdx")
            else:
                cc = {"==": "e", "!=": "ne", "<": "l", "<=": "le", ">": "g", ">=": "ge"}[op]
                self.emit("cmp rax, rdi")
                self.emit(f"set{cc} al")           # al = 1 if the condition holds
                self.emit("movzx eax, al")

    def stmt(self, s):
        op = s[0]
        if op in ("let", "set"):
            self.expr(s[2])
            self.emit(f"mov [rbp{self.slots[s[1]]}], rax")
        elif op == "print":
            self.expr(["call", "print_int", s[1]])
        elif op == "return":
            self.expr(s[1])
            self.emit(f"jmp {self.ret}")
        elif op == "if":
            body = s[2:]
            then, other = (body[:body.index("else")], body[body.index("else") + 1:]) if "else" in body else (body, [])
            l_else, l_end = self.label(), self.label()
            self.expr(s[1])
            self.emit("test rax, rax")
            self.emit(f"jz {l_else}")
            for x in then:
                self.stmt(x)
            self.emit(f"jmp {l_end}")
            self.emit(f"{l_else}:")
            for x in other:
                self.stmt(x)
            self.emit(f"{l_end}:")
        elif op == "while":
            l_top, l_end = self.label(), self.label()
            self.emit(f"{l_top}:")
            self.expr(s[1])
            self.emit("test rax, rax")
            self.emit(f"jz {l_end}")
            for x in s[2:]:
                self.stmt(x)
            self.emit(f"jmp {l_top}")
            self.emit(f"{l_end}:")


program = read("""
(fn fib (n)
  (if (< n 2) (return n))
  (return (+ (call fib (- n 1)) (call fib (- n 2)))))
(let i 0)
(while (< i 25)
  (if (== (% i 8) 0) (print (call fib i)))
  (set i (+ i 1)))
""")
g = Gen()
g.emit(".intel_syntax noprefix")
g.emit(".text")
for s in program:
    if s[0] == "fn":
        g.function(s[1], s[2], s[3:])
g.function("main", [], [s for s in program if s[0] != "fn"])
print("\\n".join(g.out))` }],
        explain: `- \`function\` assigns every parameter and \`let\` a slot at \`rbp - 8\`, \`rbp - 16\`..., and rounds the frame up to 16 bytes. Parameters are copied from the ABI registers (\`rdi\` for \`n\`) into their slots so they can be read and assigned like any variable.
- \`expr\` leaves every result in \`rax\`. A binary operator evaluates the **right** side first and pushes it, then the left side into \`rax\`, then pops the right into \`rdi\`. Read the \`n - 2\` sequence in \`fib\`: \`mov rax, 2\`, \`push rax\`, \`mov rax, [rbp-8]\`, \`pop rdi\`, \`sub rax, rdi\`.
- Calls evaluate the arguments onto the stack and pop them into the argument registers. The second \`call fib\` is wrapped in \`sub rsp, 8\` / \`add rsp, 8\` because one temporary (the first call's result) is still pushed: without that, \`rsp\` would be misaligned at the call.
- \`i % 8\` uses \`cqo\` and \`idiv rdi\`, then takes the remainder from \`rdx\`. Comparisons use \`cmp\`, \`setl\`/\`sete\` and \`movzx\`.
- Assembled and linked with a tiny C file providing \`print_int\`, the program prints 0, 21, 987 and 46368 (fib of 0, 8, 16, 24). You can try it on any x86-64 Linux machine, or on an Apple silicon Mac with \`cc -arch x86_64\` and Rosetta, using \`--macos\` for the underscores.
- Spot the waste: \`push rax\` immediately followed by \`pop rdi\`, the dead \`jmp .L3\` after \`jmp .L1\`, the empty \`.L2:\`. A peephole pass would clean these up.`,
        output: `    .intel_syntax noprefix
    .text
    .globl fib
fib:
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov [rbp-8], rdi
    mov rax, 2
    push rax
    mov rax, [rbp-8]
    pop rdi
    cmp rax, rdi
    setl al
    movzx eax, al
    test rax, rax
    jz .L2
    mov rax, [rbp-8]
    jmp .L1
    jmp .L3
.L2:
.L3:
    mov rax, 2
    push rax
    mov rax, [rbp-8]
    pop rdi
    sub rax, rdi
    push rax
    pop rdi
    call fib
    push rax
    mov rax, 1
    push rax
    mov rax, [rbp-8]
    pop rdi
    sub rax, rdi
    push rax
    pop rdi
    sub rsp, 8
    call fib
    add rsp, 8
    pop rdi
    add rax, rdi
    jmp .L1
    xor eax, eax
.L1:
    mov rsp, rbp
    pop rbp
    ret
    .globl main
main:
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov rax, 0
    mov [rbp-8], rax
.L5:
    mov rax, 25
    push rax
    mov rax, [rbp-8]
    pop rdi
    cmp rax, rdi
    setl al
    movzx eax, al
    test rax, rax
    jz .L6
    mov rax, 0
    push rax
    mov rax, 8
    push rax
    mov rax, [rbp-8]
    pop rdi
    cqo
    idiv rdi
    mov rax, rdx
    pop rdi
    cmp rax, rdi
    sete al
    movzx eax, al
    test rax, rax
    jz .L7
    mov rax, [rbp-8]
    push rax
    pop rdi
    call fib
    push rax
    pop rdi
    call print_int
    jmp .L8
.L7:
.L8:
    mov rax, 1
    push rax
    mov rax, [rbp-8]
    pop rdi
    add rax, rdi
    mov [rbp-8], rax
    jmp .L5
.L6:
    xor eax, eax
.L4:
    mov rsp, rbp
    pop rbp
    ret`,
      },
      {
        title: "Instruction selection by tree tiling",
        variants: [{ lang: "python", code: `# Instruction selection by tree tiling ("maximal munch"): cover the IR tree with the BIGGEST
# instruction patterns that fit. x86 has rich addressing modes, so one instruction can do a lot:
#   lea rax, [rbx + rcx*8 + 16]     computes  rbx + rcx * 8 + 16  in ONE instruction
#   mov rax, [rbx + rcx*8 + 16]     and loads from that address in one instruction too
# The tree for  a[i] + 1  (a is an array of 8-byte numbers):  (+ (load (+ a (* i 8))) 1)

regs = iter(f"r{n}" for n in range(1, 99))


def address(t):
    """Try to match base + index*scale + offset; return the x86 address text or None."""
    if not (isinstance(t, tuple) and t[0] == "+"):
        return None
    base, rest, offset = t[1], t[2], 0
    if isinstance(rest, tuple) and rest[0] == "+" and isinstance(rest[2], int):  # base + (index*s + k)
        rest, offset = rest[1], rest[2]
    if isinstance(rest, tuple) and rest[0] == "*" and rest[2] in (1, 2, 4, 8) and isinstance(base, str):
        return f"[{base} + {rest[1]}*{rest[2]}" + (f" + {offset}]" if offset else "]")
    return None


def munch(t, out, big_tiles=True):
    """Emit instructions for tree t and return the register (or name) holding the result."""
    if isinstance(t, (str, int)):
        if isinstance(t, int):
            r = next(regs)
            out.append(f"mov {r}, {t}")
            return r
        return t
    op = t[0]
    if big_tiles and op == "load" and (addr := address(t[1])):       # one tile: load with addressing
        r = next(regs)
        out.append(f"mov {r}, {addr}")
        return r
    if big_tiles and op == "+" and (addr := address(t)):             # one tile: lea
        r = next(regs)
        out.append(f"lea {r}, {addr}")
        return r
    if big_tiles and op in "+*" and isinstance(t[2], int):           # one tile: op with an immediate
        a = munch(t[1], out, big_tiles)
        r = next(regs)
        out += [f"mov {r}, {a}", f"{'add' if op == '+' else 'imul'} {r}, {t[2]}"]
        return r
    if op == "load":                                                 # small tiles only
        a = munch(t[1], out, big_tiles)
        r = next(regs)
        out.append(f"mov {r}, [{a}]")
        return r
    a, b = munch(t[1], out, big_tiles), munch(t[2], out, big_tiles)
    r = next(regs)
    out += [f"mov {r}, {a}", f"{'add' if op == '+' else 'imul'} {r}, {b}"]
    return r


tree = ("+", ("load", ("+", "a", ("*", "i", 8))), 1)
for big in (False, True):
    regs = iter(f"r{n}" for n in range(1, 99))
    code = []
    result = munch(tree, code, big)
    print(("big tiles (maximal munch)" if big else "one small tile per tree node") + f": {len(code)} instructions")
    for ins in code:
        print("    " + ins)

regs = iter(f"r{n}" for n in range(1, 99))
code = []
munch(("+", "p", ("+", ("*", "k", 4), 12)), code)
print("p + k*4 + 12 as a single lea:", code[0])` }],
        explain: `- The tree \`(+ (load (+ a (* i 8))) 1)\` is \`a[i] + 1\` for an array of 8-byte values.
- With **one small tile per node**, every multiply, add and load is its own instruction: 9 instructions and 6 registers.
- \`address()\` recognises the pattern \`base + index * scale (+ offset)\` with a scale of 1, 2, 4 or 8, which x86 can compute **inside** an instruction. Matching it at the \`load\` turns three nodes into one \`mov r1, [a + i*8]\`.
- \`munch\` tries the biggest tiles first (maximal munch), falling back to smaller ones: 3 instructions instead of 9.
- The \`lea\` example computes \`p + k*4 + 12\` in one instruction without accessing memory: compilers use \`lea\` for plain arithmetic all the time.`,
        output: `one small tile per tree node: 9 instructions
    mov r1, 8
    mov r2, i
    imul r2, r1
    mov r3, a
    add r3, r2
    mov r4, [r3]
    mov r5, 1
    mov r6, r4
    add r6, r5
big tiles (maximal munch): 3 instructions
    mov r1, [a + i*8]
    mov r2, r1
    add r2, 1
p + k*4 + 12 as a single lea: lea r1, [p + k*4 + 12]`,
      },
    ],
    interview: [
      {
        q: "What does a compiler back end do?",
        freq: "common",
        a: `It turns target-independent IR into machine code for a specific CPU: **instruction selection** (map IR operations to the target's instructions, exploiting addressing modes and complex instructions), **instruction scheduling** (reorder for pipelines and latencies), **register allocation** (map virtual registers to physical ones, spilling to memory), **frame lowering** (stack layout, prologue/epilogue, callee-saved registers, the calling convention), late **peephole** optimizations, and **emission** (assembly text or encoded bytes with relocations and debug info).`,
      },
      {
        q: "How does instruction selection work?",
        freq: "occasional",
        a: `Represent the IR as expression trees or a DAG and each machine instruction as a **pattern** with a cost. Cover the tree with patterns so every node is covered and the total cost is minimal. **Maximal munch** greedily matches the largest pattern at the root, top-down: simple and near-optimal for many targets. **Dynamic programming** (BURS, iburg) finds the optimal tiling bottom-up. DAG-based selectors (LLVM's SelectionDAG) handle shared subexpressions; LLVM's GlobalISel works on generic machine IR. Patterns are typically generated from target descriptions (TableGen, \`.md\` files in GCC).`,
      },
      {
        q: "What's in a function prologue and epilogue on x86-64?",
        freq: "common",
        a: `**Prologue**: \`push rbp; mov rbp, rsp\` (set up the frame pointer, optional with \`-fomit-frame-pointer\`), \`sub rsp, N\` to reserve space for locals and spills (keeping 16-byte alignment), and saving any **callee-saved** registers the function uses (\`rbx, r12–r15\`). **Epilogue**: restore those registers, \`mov rsp, rbp; pop rbp\` (or \`leave\`), \`ret\`. Leaf functions may skip most of it and use the 128-byte red zone below \`rsp\`. Stack canaries (\`-fstack-protector\`) add a guard value check before returning.`,
      },
      {
        q: "Why must the stack be 16-byte aligned at a call on x86-64, and what happens if it isn't?",
        freq: "occasional",
        a: `The System V ABI guarantees \`rsp\` is 16-byte aligned at the \`call\` (so \`rsp + 8\` is aligned at function entry), letting callees use aligned SSE/AVX loads and stores (\`movaps\`) for locals and spills without checking. If generated code misaligns it (an odd number of 8-byte pushes before a call), things work until a callee, often inside libc (\`printf\` with floating point), executes an aligned instruction on a misaligned address and the process crashes with a segfault. Code generators track pushes and pad with \`sub rsp, 8\`.`,
      },
      {
        q: "What is peephole optimization?",
        freq: "occasional",
        a: `A late, local pass that examines a small sliding window of consecutive instructions and replaces patterns with cheaper equivalents: remove redundant moves and loads after stores, replace \`push\`/\`pop\` pairs with \`mov\`, \`mov reg, 0\` with \`xor reg, reg\`, multiplications by powers of two with shifts, jumps to the next instruction, jumps to jumps, and use special instructions (\`inc\`, \`lea\`, fused compare-and-branch). Cheap, simple, and it cleans up the leftovers of earlier phases.`,
      },
    ],
    quiz: [
      {
        q: "In the stack-machine strategy, where does every expression leave its result?",
        options: ["On the stack", "In rax", "In rdi", "In memory at [rbp-8]"],
        answer: 1,
        explain: "rax holds the current value; pending values are pushed on the real stack while the other side is computed.",
      },
      {
        q: "Why does the generated fib wrap its second `call fib` in `sub rsp, 8` / `add rsp, 8`?",
        options: [
          "To pass an extra argument",
          "One temporary is still pushed, so rsp would not be 16-byte aligned at the call",
          "To make room for the return value",
          "It's a bug",
        ],
        answer: 1,
        explain: "The ABI requires 16-byte alignment at every call; an odd number of 8-byte pushes breaks it.",
      },
      {
        q: "On x86-64, after `cqo; idiv rdi`, where is the remainder?",
        options: ["rax", "rdx", "rdi", "On the stack"],
        answer: 1,
        explain: "The quotient goes to rax and the remainder to rdx. That's how % is compiled.",
      },
      {
        q: "How many instructions does maximal munch need for `a[i] + 1` in the tiling sample?",
        options: ["1", "3", "6", "9"],
        answer: 1,
        explain: "The addressing mode `[a + i*8]` covers the add, the multiply and the load in a single mov.",
      },
      {
        q: "What does `lea rax, [rbx + rcx*4 + 12]` do?",
        options: [
          "Loads 8 bytes from memory",
          "Computes `rbx + rcx * 4 + 12` into rax without touching memory",
          "Jumps to that address",
          "Stores rax at that address",
        ],
        answer: 1,
        explain: "Load effective address: the address calculation without the load, often used for plain arithmetic.",
      },
      {
        q: "What is the goal of instruction scheduling?",
        options: [
          "To use fewer registers",
          "To order instructions so the CPU isn't waiting on slow results (loads, multiplies)",
          "To make the code shorter",
          "To check types",
        ],
        answer: 1,
        explain: "Independent work fills the gaps while a slow instruction's result is on its way.",
      },
      {
        q: "Which is a typical peephole optimization?",
        options: ["Inlining a function", "Replacing `push rax; pop rdi` with `mov rdi, rax`", "Building SSA", "Type inference"],
        answer: 1,
        explain: "A peephole pass rewrites small local patterns of consecutive instructions.",
      },
    ],
  },

  // ------------------------------------------------------------------ REGISTER ALLOCATION
  {
    id: "comp-regalloc",
    title: "Register allocation",
    tagline: "Fitting unlimited variables into 16 registers: live ranges and interference, graph colouring (Chaitin–Briggs), linear scan for JITs, spilling and its cost, coalescing copies, caller- and callee-saved registers, and SSA-based allocation.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["regalloc"],
    concept: `## Explain it like I'm 10 🧸
You're doing a big jigsaw puzzle on a **tiny desk** that only fits **3 pieces** at a time. The rest of the pieces wait in the **box on the floor**. Getting a piece from the box is slow (you have to bend down!), so you want the pieces you're about to use on the desk.

The trick: once you've finished with a piece, it can go back in the box and **its spot on the desk is free** for another piece. Two pieces can share the same spot, as long as you never need **both at the same time**. And if you really have too many pieces at once, you pick one you won't need for a while and put it on the floor: that's a **spill**.

Registers are the desk. Memory is the floor. **Register allocation** is deciding which piece goes where.

## The problem
The IR uses as many virtual registers (temporaries) as it likes. The CPU has a handful: 16 general-purpose registers on x86-64 (minus \`rsp\` and often \`rbp\`), 31 on ARM64. A register is read in a fraction of a nanosecond; a memory access costs a load or store, often several cycles even when cached. So the allocator must:
- give every value a **register** whenever possible;
- **spill** some values to the stack when there aren't enough, choosing ones that hurt least;
- respect the **calling convention** (arguments and results in fixed registers, which registers survive calls);
- remove copies (\`mov rbx, rax\`) by giving both sides the **same** register.

## Liveness and interference
A variable is **live** from where it's defined to its last use (liveness analysis, from the optimization lesson). Two variables **interfere** if they're live at the same moment: then they need **different** registers. Variables that are never live together can share one.
\`\`\`text
    a = load x       a  b  c  d  e  f  g
    b = load y       │  │
    c = a + b        │  │  │
    d = a * 2        │  │  │  │
    e = c + d           │     │  │
    f = b - 1           │        │  │
    g = e * f                       │  │
    return g                           │
\`\`\`
(Each column shows a variable's **live range**.) At the moment \`d\` is defined, \`b\`, \`c\` and \`d\` are all live: at least 3 registers are needed there without spilling. That maximum number of simultaneously live values is called the **register pressure**.

## Graph colouring (Chaitin, Briggs)
Build the **interference graph**: one node per variable, an edge between interfering variables. Allocating k registers is **colouring** the graph with k colours so no edge joins two nodes of the same colour. Colouring is NP-complete in general, but a beautiful heuristic works well:
1. **Simplify**: a node with **fewer than k** neighbours can always be coloured, whatever its neighbours get. Remove it and push it on a stack. Removing nodes lowers other nodes' degrees, so repeat.
2. **Spill**: if every remaining node has ≥ k neighbours, pick one (cheap to spill: rarely used, long-lived, not in a loop), remove it as a **potential** spill, and continue.
3. **Select**: pop nodes one by one and give each a colour none of its already-coloured neighbours has. Briggs' **optimistic** colouring: a potential spill may still find a free colour; only if it doesn't is it really spilled.
4. **Spill code**: rewrite the program with a load before every use and a store after every definition of spilled variables, and repeat the whole process (the new short ranges are easy to colour).

Graph colouring gives excellent allocations and is used by GCC and many ahead-of-time compilers, but building the graph is O(n²) in the worst case: too slow for JITs.

## Linear scan (Poletto and Sarkar)
Treat each variable's live range as an **interval** over a linear order of the instructions. Walk the intervals sorted by start:
1. **expire** intervals that have ended, freeing their registers;
2. if a register is free, take it;
3. otherwise **spill** the active interval that **ends furthest in the future** (it would hold the register longest), unless the new one ends even later, in which case spill the new one.

It runs in nearly linear time and produces allocations within a few percent of graph colouring, which is why **JITs** (HotSpot's C1, V8, LuaJIT, Cranelift's earlier allocator) use it. Refinements split intervals so a variable can live in a register for part of its life and in memory for the rest. LLVM's default allocator ("greedy") is a related priority-based design with live-range splitting.

## Spilling and its cost
A spilled variable lives in a **stack slot**: every use becomes a load, every definition a store (the second sample shows exactly these). Spill choice matters enormously: spilling a variable used inside a hot loop can make the loop several times slower. Allocators weight uses by **loop depth** (a use inside a loop nested twice counts as 100 uses) and prefer **rematerialisation** (just recompute a constant instead of storing and reloading it).

## Coalescing
Copies like \`b = a\` (from out-of-SSA translation, or moving arguments into \`rdi\`) are free if \`a\` and \`b\` get the **same** register. **Coalescing** merges their nodes in the interference graph when they don't interfere. Done aggressively, merging can make the graph uncolourable, so allocators use **conservative** rules (Briggs, George) that only merge when it can't cause a spill.

## Calls and the calling convention
- Arguments must be in \`rdi, rsi...\` and results in \`rax\` at specific points: **precoloured** nodes in the graph.
- A value live **across a call** must not be in a caller-saved register (the callee may overwrite it), so it interferes with all of them. Allocators place such values in **callee-saved** registers (saved once in the prologue) or spill them around the call.

## SSA and register allocation
SSA programs have **chordal** interference graphs, which can be coloured optimally in polynomial time, and the maximum register pressure tells you exactly how many registers are needed. Modern research allocators (and some production ones) allocate **directly on SSA**, separating "decide what to spill" from "assign registers".`,
    keyPoints: [
      "Registers are few and fast; the allocator maps unlimited virtual registers onto them and spills the rest to the stack",
      "Two variables live at the same time interfere and need different registers; the maximum live at once is the register pressure",
      "Graph colouring: simplify nodes with fewer than k neighbours, spill when stuck, then select colours (Chaitin–Briggs)",
      "Linear scan walks live intervals in order and spills the one ending furthest away: fast enough for JITs",
      "Spilling adds a load per use and a store per definition; weight spill costs by loop depth",
      "Coalescing removes copies by merging non-interfering nodes; values live across calls go in callee-saved registers",
    ],
    code: [
      {
        title: "Linear-scan register allocation",
        variants: [{ lang: "python", code: `# Linear-scan register allocation (Poletto and Sarkar), the fast allocator used by JIT compilers.
# 1. Find each variable's live interval: from where it's defined to its last use.
# 2. Walk the intervals in order of start. Free the registers of intervals that have ended.
#    If no register is free, SPILL (keep in memory) the interval that ends furthest away.
code = [
    "a = load x",
    "b = load y",
    "c = a + b",
    "d = a * 2",
    "e = c + d",
    "f = b - 1",
    "g = e * f",
    "return g",
]

intervals = {}
for i, ins in enumerate(code):
    words = ins.replace("=", " ").split()
    for w in words:
        if w.isalpha() and len(w) == 1 and w not in "xy":
            start, _ = intervals.get(w, (i, i))
            intervals[w] = (start, i)

print("live intervals (instruction numbers):")
for v, (s, e) in intervals.items():
    print(f"  {v}: {s}-{e}  " + " " * (3 * s) + "-" * (3 * (e - s) + 1))


def linear_scan(k):
    regs = [f"R{n}" for n in range(1, k + 1)]
    free, active, where = list(regs), [], {}
    for v, (start, end) in sorted(intervals.items(), key=lambda kv: kv[1][0]):
        for a in [a for a in active if intervals[a][1] <= start]:   # expire intervals that are over
            active.remove(a)
            free.append(where[a])
        if free:
            where[v] = free.pop(0)
            active.append(v)
        else:
            victim = max(active, key=lambda a: intervals[a][1])     # the one needed furthest in the future
            if intervals[victim][1] > end:
                where[v], where[victim] = where[victim], "stack"    # steal its register
                active.remove(victim)
                active.append(v)
            else:
                where[v] = "stack"
    return where


for k in (3, 2):
    where = linear_scan(k)
    spilled = [v for v, r in where.items() if r == "stack"]
    print(f"\\n{k} registers: " + ", ".join(f"{v}->{r}" for v, r in where.items()))
    print("  spilled to memory: " + (", ".join(spilled) if spilled else "nothing"))
    if spilled:
        print("  every use of a spilled variable now costs a load, every definition a store:")
        for ins in code:
            words = ins.split()
            loads = [w for w in words[1:] if w in spilled]
            line = " ".join(where.get(w, w) if w not in spilled else f"[{w}]" for w in words)
            print(f"    {line}" + ("   <- memory access" if loads or words[0] in spilled else ""))` }],
        explain: `- The intervals come straight from the code: \`b\` is defined at instruction 1 and last used at 5, so its interval is 1–5. The bars make the overlap visible.
- With **3 registers** no spill is needed, and registers are **reused** as intervals end: \`a\` and \`d\` and \`f\` all get R1 at different times.
- With **2 registers**, when \`c\` starts (at 2) both \`a\` and \`b\` are active. The victim is the active interval that ends **furthest away**: \`b\` (ends at 5) loses its register to \`c\`, and lives on the stack.
- The rewritten code shows the cost: every instruction that touches \`b\` now accesses memory. In a loop, that's the difference between fast and slow code.`,
        output: `live intervals (instruction numbers):
  a: 0-3  ----------
  b: 1-5     -------------
  c: 2-4        -------
  d: 3-4           ----
  e: 4-6              -------
  f: 5-6                 ----
  g: 6-7                    ----

3 registers: a->R1, b->R2, c->R3, d->R1, e->R3, f->R1, g->R2
  spilled to memory: nothing

2 registers: a->R1, b->stack, c->R2, d->R1, e->R2, f->R1, g->R2
  spilled to memory: b
  every use of a spilled variable now costs a load, every definition a store:
    R1 = load x
    [b] = load y   <- memory access
    R2 = R1 + [b]   <- memory access
    R1 = R1 * 2
    R2 = R2 + R1
    R1 = [b] - 1   <- memory access
    R2 = R2 * R1
    return R2`,
      },
      {
        title: "Graph-colouring register allocation",
        variants: [{ lang: "python", code: `# Register allocation as graph colouring (Chaitin and Briggs), used by GCC and many AOT compilers.
# Two variables that are live at the same time INTERFERE: they can't share a register.
# Draw an edge between them; then colour the graph with k colours (= k registers).
code = [
    "a = load x",
    "b = load y",
    "c = a + b",
    "d = a * 2",
    "e = c + d",
    "f = b - 1",
    "g = e * f",
    "return g",
]
VARS = "abcdefg"

# Liveness, walking backwards through the straight-line code.
live, live_after = set(), []
for ins in reversed(code):
    live_after.append(set(live))
    lhs, _, rhs = ins.partition(" = ") if " = " in ins else ("", "", ins)
    live = (live - {lhs}) | {w for w in rhs.split() if w in VARS}
live_after.reverse()

# A variable defined at an instruction interferes with everything live right after it.
graph = {v: set() for v in VARS}
for ins, after in zip(code, live_after):
    lhs = ins.split(" = ")[0] if " = " in ins else None
    for other in after - {lhs}:
        if lhs:
            graph[lhs].add(other)
            graph[other].add(lhs)
print("interference graph:")
for v in VARS:
    print(f"  {v}: {' '.join(sorted(graph[v]))}")


def colour(k):
    g = {v: set(n) for v, n in graph.items()}
    stack, order = [], []
    while g:
        # SIMPLIFY: a node with fewer than k neighbours can ALWAYS be coloured later. Remove it.
        easy = [v for v in sorted(g) if len(g[v]) < k]
        if easy:
            v, how = easy[0], "simplify"
        else:  # stuck: every node has >= k neighbours. Push one optimistically as a spill candidate.
            v, how = max(sorted(g), key=lambda x: len(g[x])), "spill candidate"
        order.append(f"{v}({how})" if how != "simplify" else v)
        stack.append(v)
        for n in g.pop(v):
            g[n].discard(v)
    colours, spilled = {}, []
    for v in reversed(stack):  # SELECT: pop and give each node a colour its neighbours don't use
        used = {colours[n] for n in graph[v] if n in colours}
        free = [c for c in range(k) if c not in used]
        if free:
            colours[v] = free[0]
        else:
            spilled.append(v)
    return order, colours, spilled


for k in (3, 2):
    order, colours, spilled = colour(k)
    print(f"\\nk = {k}: removal order {' '.join(order)}")
    print("  registers: " + ", ".join(f"{v}=R{c + 1}" for v, c in sorted(colours.items())))
    print("  spilled:   " + (", ".join(spilled) if spilled else "none, every variable got a register"))` }],
        explain: `- Liveness is computed backwards through the code, then each definition gets an edge to everything live right after it: that's the **interference graph**. \`b\` interferes with four variables: it's live for a long time.
- With **k = 3**, \`simplify\` can always find a node with fewer than 3 neighbours, so the graph colours without spills. The **select** phase pops in reverse removal order, giving each node the lowest register its neighbours don't use.
- With **k = 2**, after removing \`f\`, \`e\` and \`g\`, every remaining node has 2 or more neighbours: stuck. \`b\`, the node with the most neighbours, becomes a **spill candidate**. On the way back up, \`b\` finds no free colour, so it's really spilled.
- Both allocators spill the same variable here: the long-lived \`b\`. On bigger programs they differ, and graph colouring usually wins slightly, at a higher compile-time cost.`,
        output: `interference graph:
  a: b c
  b: a c d e
  c: a b d
  d: b c
  e: b f
  f: e
  g: 

k = 3: removal order a c b d e f g
  registers: a=R1, b=R3, c=R2, d=R1, e=R2, f=R1, g=R1
  spilled:   none, every variable got a register

k = 2: removal order f e g b(spill candidate) a c d
  registers: a=R1, c=R2, d=R1, e=R1, f=R2, g=R1
  spilled:   b`,
      },
    ],
    interview: [
      {
        q: "What is register allocation and why is it important?",
        freq: "very-common",
        a: `Assigning the program's (unbounded) virtual registers / temporaries to the CPU's limited physical registers, deciding which values to keep in memory (spill) when there aren't enough, and inserting the necessary loads and stores. It matters because registers are an order of magnitude faster than even L1-cached memory, so a poor allocation (spills in hot loops, unnecessary copies) can slow code several times. It's one of the most performance-critical phases of a back end.`,
      },
      {
        q: "Explain graph-colouring register allocation.",
        freq: "common",
        a: `Build an **interference graph** (nodes = live ranges, edges = live at the same time); allocating k registers = k-colouring it. Chaitin's algorithm: repeatedly **simplify** (remove a node with degree < k, push it on a stack); when none exists, choose a **spill** candidate by cost/degree and remove it; then **select** colours by popping the stack. Briggs' improvement: spill candidates are pushed optimistically and only spilled if no colour is free at select time. Spilled nodes get loads/stores, and the process repeats. Add **coalescing** (merging copy-related nodes conservatively) and precoloured nodes for ABI registers.`,
      },
      {
        q: "Graph colouring vs linear scan: when would you use each?",
        freq: "common",
        a: `**Graph colouring** produces high-quality allocations and handles coalescing well, but building and colouring the interference graph can be O(n²) time and memory: fine for ahead-of-time compilers (GCC). **Linear scan** sorts live intervals and assigns registers in one pass, spilling the interval ending furthest away: near-linear time, slightly worse code, ideal for **JIT compilers** where compile time is run time (HotSpot C1, V8, LuaJIT). Modern compilers blend ideas: LLVM's greedy allocator uses priorities and live-range splitting; second-chance binpacking, SSA-based allocators.`,
      },
      {
        q: "What is spilling, and how does an allocator decide what to spill?",
        freq: "common",
        a: `Spilling stores a value in a stack slot instead of a register, adding a load before each use and a store after each definition (or after the single definition in SSA). Heuristics estimate **spill cost** = sum of (uses + defs) weighted by execution frequency, typically 10^loop depth or profile counts, divided by how much spilling helps (interference degree or interval length). Prefer spilling values with long ranges and few uses, never those used in tight loops. Cheaper alternatives: **rematerialisation** (recompute constants or simple address calculations instead of reloading) and **live-range splitting** (spill only in the part of the range under pressure).`,
      },
      {
        q: "What's register coalescing?",
        freq: "occasional",
        a: `Eliminating a copy \`b = a\` by assigning \`a\` and \`b\` the same register, i.e. merging their interference-graph nodes when they don't interfere. It's essential after out-of-SSA translation and for moving arguments into ABI registers. Aggressive coalescing can raise node degrees and cause spills, so allocators use **conservative coalescing**: Briggs' test (the merged node has fewer than k neighbours of significant degree) or George's test, and iterated register coalescing interleaves simplify and coalesce.`,
      },
    ],
    quiz: [
      {
        q: "When do two variables interfere?",
        options: [
          "When they have the same name",
          "When they're live at the same time, so they can't share a register",
          "When one is defined before the other",
          "When they're in different functions",
        ],
        answer: 1,
        explain: "Interference means simultaneous liveness; non-interfering variables can reuse the same register.",
      },
      {
        q: "In graph colouring, why can a node with fewer than k neighbours be removed safely?",
        options: [
          "It's dead",
          "Whatever colours its neighbours get, at least one of the k colours will be left for it",
          "It will be spilled",
          "It has no uses",
        ],
        answer: 1,
        explain: "With at most k − 1 neighbours, they can use at most k − 1 colours.",
      },
      {
        q: "In linear scan, when no register is free, which interval is usually spilled?",
        options: [
          "The newest one",
          "The one that ends furthest in the future",
          "The shortest one",
          "A random one",
        ],
        answer: 1,
        explain: "It would occupy the register longest; giving it up frees the register for more work.",
      },
      {
        q: "In the linear-scan sample with 2 registers, why does `b` get spilled?",
        options: [
          "It's defined second",
          "When c needs a register, b is the active interval that ends furthest away (at 5)",
          "It's used only once",
          "It's a constant",
        ],
        answer: 1,
        explain: "a ends at 3 and b at 5; b is the better victim.",
      },
      {
        q: "Why do JIT compilers prefer linear scan over graph colouring?",
        options: [
          "It gives better code",
          "It's much faster to run, and compile time is part of the program's run time in a JIT",
          "Graph colouring doesn't support x86",
          "Linear scan never spills",
        ],
        answer: 1,
        explain: "Near-linear allocation time matters more than the last few percent of code quality.",
      },
      {
        q: "What does a spill cost at run time?",
        options: [
          "Nothing",
          "A store after each definition and a load before each use of the spilled value",
          "A function call",
          "A recompilation",
        ],
        answer: 1,
        explain: "Memory accesses replace register accesses, which is why spills in loops are expensive.",
      },
      {
        q: "A value is live across a function call. Where should it go?",
        options: [
          "A caller-saved register like rcx",
          "A callee-saved register (like rbx) or a stack slot",
          "rax",
          "Anywhere",
        ],
        answer: 1,
        explain: "The callee may overwrite caller-saved registers; callee-saved ones are preserved for you.",
      },
    ],
  },

  // ------------------------------------------------------------------ LINKING AND LOADING
  {
    id: "comp-linking",
    title: "Linking and loading",
    tagline: "From object files to a running process: separate compilation, symbols and relocations, ELF sections, what the linker does in two passes, undefined and duplicate symbols, static vs dynamic libraries, the PLT and GOT, the dynamic loader, and name mangling.",
    difficulty: "intermediate",
    minutes: 40,
    diagram: {
      title: "From source files to a running program",
      nodes: [
        { id: "mainc", label: "main.c", kind: "client", x: 100, y: 110, sub: "calls square()" },
        { id: "mathc", label: "mathlib.c", kind: "client", x: 100, y: 430, sub: "defines square(), calls" },
        { id: "cc", label: "Compiler + assembler", kind: "service", x: 290, y: 270, sub: "one file at a time" },
        { id: "maino", label: "main.o", kind: "storage", x: 480, y: 110, sub: "U square, U calls, U printf" },
        { id: "matho", label: "mathlib.o", kind: "storage", x: 480, y: 430, sub: "T square, B calls" },
        { id: "ld", label: "Linker", kind: "control", x: 660, y: 270, sub: "resolve symbols, patch relocations" },
        { id: "exe", label: "prog (ELF)", kind: "node", x: 850, y: 430, sub: "still needs libc.so.6" },
        { id: "loader", label: "Dynamic loader", kind: "gpu", x: 850, y: 270, sub: "ld.so, at start-up" },
        { id: "libc", label: "libc.so.6", kind: "registry", x: 850, y: 100, sub: "printf, malloc, ..." },
      ],
      edges: [
        { from: "mainc", to: "cc" },
        { from: "mathc", to: "cc" },
        { from: "cc", to: "maino" },
        { from: "cc", to: "matho" },
        { from: "maino", to: "ld" },
        { from: "matho", to: "ld" },
        { from: "ld", to: "exe", label: "writes" },
        { from: "ld", to: "libc", label: "checks printf exists", dashed: true },
        { from: "exe", to: "loader", label: "./prog" },
        { from: "loader", to: "libc", label: "maps into memory" },
      ],
      flows: [
        {
          name: "Build: gcc main.c mathlib.c",
          path: ["mainc", "cc", "maino", "ld", "exe"],
          steps: [
            "main.c is compiled on its own. The compiler has no idea where square or calls will be.",
            "So main.o lists them as undefined symbols, with relocations: holes where their addresses go.",
            "The linker merges main.o with mathlib.o, finds every symbol's final address, and patches each hole.",
            "Out comes an executable. printf still comes from libc.so.6, so that's recorded as NEEDED.",
          ],
        },
        {
          name: "Run: ./prog",
          path: ["exe", "loader", "libc"],
          steps: [
            "The kernel maps prog and starts the dynamic loader named in its header (on Linux, ld-linux).",
            "The loader maps libc.so.6, then resolves printf's address through the GOT and PLT, often lazily at the first call.",
          ],
        },
        {
          name: "Forgot mathlib.c: gcc main.c",
          path: ["mainc", "cc", "maino", "ld"],
          steps: [
            "main.c compiles fine: a declaration of square is enough for the compiler.",
            "main.o still has undefined square and calls.",
            "No object file defines them: 'undefined reference to square'. A link error, not a compile error.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Imagine a class writing a **story book** together. Each kid writes one chapter at home. Sam's chapter says "...and then the dragon from **Amira's chapter** appeared". Sam doesn't know which **page** Amira's dragon will end up on, so Sam leaves a blank: "see page ____".

When all the chapters arrive, someone glues them into one book, numbers the pages, and goes back to fill in every blank with the real page number. If a blank mentions a dragon that **nobody wrote**, there's a problem. If **two** kids wrote a dragon with the same name, that's a problem too.

The kids are the **compiler** (each file on its own). The person gluing and filling in the blanks is the **linker**. The blanks are **relocations**.

## Separate compilation
Big programs have thousands of source files. Compiling each **separately** into an **object file** (\`.o\`) means a change to one file only recompiles that file, and files can be compiled in parallel. But when \`main.c\` calls \`square\`, which lives in \`mathlib.c\`, the compiler can't know its address. It needs only a **declaration** (\`int square(int x);\`, usually from a header) to check the call's types, and leaves the address for later.

## What's in an object file
On Linux, objects and executables use the **ELF** format (macOS uses Mach-O, Windows PE/COFF). An object file contains:
- **sections**: \`.text\` (machine code), \`.data\` (initialised globals), \`.bss\` (zero-initialised globals: just a size, no bytes in the file), \`.rodata\` (constants and string literals);
- a **symbol table**: the names this file **defines** (with their section and offset) and the names it **references** but doesn't define;
- **relocations**: "at offset 0x1a in \`.text\`, put the address of \`square\`" (with a type saying how: absolute, PC-relative, via the GOT...);
- debug info (DWARF), if compiled with \`-g\`.

\`nm\` shows symbols: **T** = defined in text (code), **D** = initialised data, **B** = bss, **R** = read-only data, **U** = undefined. \`objdump -dr\` and \`readelf -rW\` show relocations.

## What the linker does
Two passes, as in the second sample:
1. **Layout and symbol resolution**: concatenate all the \`.text\` sections, all the \`.data\` sections and so on; now every symbol has a final address. Build a global symbol table, matching every undefined reference to exactly **one** definition.
2. **Relocation**: go through every relocation and patch the bytes with the final address.

Then write the executable, with a header saying where each segment goes in memory and where execution starts (\`_start\`, which calls \`main\`).

## The two classic link errors
- **undefined reference to \`square\`**: something uses a symbol that no input defines. You forgot a file or a library (\`-lm\`), misspelt a name, or (in C++) declared a function you never defined.
- **multiple definition of \`square\`**: two inputs define the same global symbol. Classic cause: defining (not just declaring) a function or variable in a header included by two files. Fix: declare in the header, define in exactly one \`.c\` file, or make it \`static\` (file-local symbols aren't exported) or \`inline\`.

Both are **link errors**: the compiler was perfectly happy with each file.

## Static and dynamic libraries
- A **static library** (\`libfoo.a\`) is an archive of object files. The linker copies in only the objects that resolve some undefined symbol. The result is self-contained but bigger, and every program has its own copy. **Order matters** on the command line: \`gcc main.o -lfoo\` works, \`gcc -lfoo main.o\` may not, because the linker only pulls from a library what's needed **so far**.
- A **shared library** (\`libfoo.so\`, \`.dylib\`, \`.dll\`) is linked at **run time**. The executable just records that it **NEEDS** it (\`libc.so.6\` in the first sample). Many programs share one copy in memory, and the library can be updated without relinking (security fixes!). Costs: a little start-up time and an indirection on calls.

## Position-independent code, the GOT and the PLT
A shared library can be loaded at **any** address, so its code can't contain absolute addresses. It's compiled as **position-independent code** (\`-fPIC\`): addresses are computed relative to the current instruction (\`rip\`-relative addressing). For symbols in **other** libraries:
- the **GOT** (global offset table) is a table of addresses filled in by the loader; code loads a pointer from the GOT instead of using an address directly;
- the **PLT** (procedure linkage table) holds small stubs: \`call printf@plt\` jumps through the GOT. With **lazy binding**, the first call goes into the loader, which looks up \`printf\`, writes its address into the GOT, and jumps there; later calls go straight through.

Modern executables are also position-independent (**PIE**) so the OS can load them at a random address (**ASLR**), making exploits harder.

## Loading
\`./prog\` asks the kernel to \`execve\` it. The kernel maps the executable's segments into a new address space and, because it's dynamically linked, starts the **dynamic loader** (\`/lib64/ld-linux-x86-64.so.2\`) named in the header. The loader maps every NEEDED library (recursively), applies their relocations, runs initialisers (C++ global constructors), and jumps to \`_start\`, which sets up the C runtime and calls \`main\`. \`ldd prog\` lists the libraries; \`LD_DEBUG=bindings ./prog\` shows the loader at work.

## Name mangling
C++ allows **overloading** (\`print(int)\` and \`print(double)\`), namespaces and templates, but the linker only matches **plain names**. So the compiler **mangles** the full signature into the symbol: \`print(int)\` becomes \`_Z5printi\`, \`print(double)\` \`_Z5printd\`. \`c++filt\` decodes them. \`extern "C"\` turns mangling off so C and C++ can call each other. Rust mangles too.

## Link-time optimization
Normally the optimizer only sees one file at a time, so it can't inline \`square\` into \`main\`. With **LTO** (\`-flto\`), object files contain **IR** instead of machine code, and the linker runs the optimizer over the **whole program**: cross-file inlining, dead function removal, constant propagation. ThinLTO makes this scale to huge programs.`,
    keyPoints: [
      "Each source file compiles separately to an object file; calls to other files leave holes called relocations",
      "Object files have sections (.text, .data, .bss, .rodata), a symbol table (T, D, B defined; U undefined) and relocations",
      "The linker lays out sections, resolves every undefined symbol to exactly one definition, then patches relocations",
      "'undefined reference' = no definition anywhere; 'multiple definition' = two definitions of one global symbol",
      "Static libraries are copied in; shared libraries are loaded at run time via the dynamic loader, the GOT and the PLT",
      "C++ mangles names to encode signatures; extern \"C\" turns that off; LTO optimizes across files at link time",
    ],
    code: [
      {
        title: "Separate compilation, symbols, relocations and link errors",
        linux: true,
        variants: [{ lang: "bash", code: `# Separate compilation and linking: two source files, two object files, one program.
cat > main.c <<'C'
#include <stdio.h>
int square(int x);          // declared here, defined in another file
extern int calls;           // a global variable that lives in the other file
int main(void) {
    int s = square(7);      // not inside printf(...): C doesn't fix the order arguments are evaluated in
    printf("square(7) = %d after %d call(s)\\n", s, calls);
    return 0;
}
C
cat > mathlib.c <<'C'
int calls = 0;
int square(int x) { calls++; return x * x; }
C

gcc -O1 -c main.c -o main.o        # compile each file on its own: no idea where square() is yet
gcc -O1 -c mathlib.c -o mathlib.o

echo "symbols in main.o (U = undefined here, T = code, D/B = data):"
nm main.o | awk '{ print "   " (NF == 3 ? $2 " " $3 : $1 " " $2) }'
echo "symbols in mathlib.o:"
nm mathlib.o | awk '{ print "   " (NF == 3 ? $2 " " $3 : $1 " " $2) }'
echo "relocations in main.o: holes the linker must fill with real addresses:"
readelf -rW main.o | awk '/R_(X86_64|AARCH64)/ { sub(/[+-].*/, "", $5); if ($5 !~ /^\\./) print $5 }' | sort -u | sed 's/^/   /'
echo "   (plus one for the format string, which lives in a read-only data section)"

gcc main.o mathlib.o -o prog       # link: merge the sections, resolve symbols, patch relocations
echo "after linking, square is at a real address: $(nm prog | awk '$3 == "square" { print "yes" }')"
echo "still needed from shared libraries at run time: $(readelf -dW prog | awk '/NEEDED/ { gsub(/[\\[\\]]/, "", $5); print $5 }')"
./prog

echo "what happens when a definition is missing:"
gcc main.o -o broken 2>&1 | grep -oE "undefined reference to .(square|calls)." | sort -u | sed 's/^/   /'
echo "and when two files define the same thing:"
cp mathlib.c again.c && gcc -c again.c -o again.o
gcc main.o mathlib.o again.o -o broken 2>&1 | grep -oE "multiple definition of .(square|calls)." | sort -u | sed 's/^/   /'` }],
        explain: `- \`gcc -c\` compiles each file **alone**. \`main.o\` defines \`main\` (T) and has three undefined symbols (U): \`square\` and \`calls\` (from the other file) and \`printf\` (from libc). \`mathlib.o\` defines \`square\` in text and \`calls\` in **bss**, since it starts at 0.
- The **relocations** in \`main.o\` are the holes for exactly those symbols, plus one for the format string, which sits in another section of the same file and also needs its final address.
- After linking, \`square\` has a real address and \`main\`'s calls are patched. \`printf\` is still external: the executable records that it **needs** \`libc.so.6\`, and the dynamic loader supplies it at run time.
- Linking \`main.o\` alone gives **undefined reference** errors; linking a copy of \`mathlib.c\` alongside the original gives **multiple definition**. Neither is a compile error.
- The comment in \`main.c\` is a real C gotcha: in \`printf("...", square(7), calls)\`, C doesn't specify which argument is evaluated first, so \`calls\` might be read before \`square\` runs. Computing \`s\` first makes the order explicit.`,
        output: `symbols in main.o (U = undefined here, T = code, D/B = data):
   U calls
   T main
   U printf
   U square
symbols in mathlib.o:
   B calls
   T square
relocations in main.o: holes the linker must fill with real addresses:
   calls
   printf
   square
   (plus one for the format string, which lives in a read-only data section)
after linking, square is at a real address: yes
still needed from shared libraries at run time: libc.so.6
square(7) = 49 after 1 call(s)
what happens when a definition is missing:
   undefined reference to \`calls'
   undefined reference to \`square'
and when two files define the same thing:
   multiple definition of \`calls'
   multiple definition of \`square'`,
      },
      {
        title: "A tiny linker",
        variants: [{ lang: "python", code: `# A tiny linker. Each "object file" has code, data, a symbol table (the names it defines and where)
# and relocations (places in its code that need the address of some symbol, still unknown).
# The linker lays out all the code, then all the data, works out every symbol's final address,
# then patches each relocation with it.
main_o = {
    "name": "main.o",
    "code": ["push rbp", "call ????", "mov eax, [????]", "call ????", "ret"],  # ???? = unknown address
    "code_symbols": {"main": 0},                       # main starts at instruction 0 of this file
    "data_symbols": {},
    "relocs": [(1, "square"), (2, "calls"), (3, "printf")],  # (instruction index, symbol it needs)
}
math_o = {
    "name": "mathlib.o",
    "code": ["inc [????]", "imul eax, eax", "ret"],
    "code_symbols": {"square": 0},
    "data_symbols": {"calls": 0},                      # an 8-byte global at offset 0 of its data
    "relocs": [(0, "calls")],
}
libc = {"name": "libc", "code": ["(printf's code)"], "code_symbols": {"printf": 0}, "data_symbols": {}, "relocs": []}
CODE_BASE, DATA_BASE, INS_SIZE, VAR_SIZE = 0x1000, 0x4000, 4, 8  # pretend every instruction is 4 bytes


def link(objects):
    # Pass 1: layout and symbol resolution.
    symbols, starts, code_at, data_at = {}, [], CODE_BASE, DATA_BASE
    for obj in objects:
        starts.append(code_at)
        found = [(n, code_at + i * INS_SIZE) for n, i in obj["code_symbols"].items()]
        found += [(n, data_at + i * VAR_SIZE) for n, i in obj["data_symbols"].items()]
        for name, addr in found:
            if name in symbols:
                raise SystemExit(f"error: multiple definition of '{name}' (in {obj['name']} too)")
            symbols[name] = addr
        code_at += len(obj["code"]) * INS_SIZE
        data_at += len(obj["data_symbols"]) * VAR_SIZE
    # Pass 2: relocation. Fill every hole with the final address.
    image = []
    for obj, start in zip(objects, starts):
        code = list(obj["code"])
        for index, name in obj["relocs"]:
            if name not in symbols:
                raise SystemExit(f"error: undefined reference to '{name}' (needed by {obj['name']})")
            code[index] = code[index].replace("????", hex(symbols[name]))
        image += [(start + INS_SIZE * i, ins, obj["name"]) for i, ins in enumerate(code)]
    return symbols, image


symbols, image = link([main_o, math_o, libc])
print("symbol table:", ", ".join(f"{n}={hex(a)}" for n, a in symbols.items()))
for addr, ins, owner in image:
    print(f"  {hex(addr)}  {ins:<20} ({owner})")

for objects in ([main_o, libc], [main_o, math_o, math_o, libc]):
    try:
        link(objects)
    except SystemExit as e:
        print(e)` }],
        explain: `- Each "object file" has code with \`????\` holes, a symbol table for code and data, and a list of **relocations** (which instruction needs which symbol).
- **Pass 1** lays out all code from \`0x1000\` and all data from \`0x4000\`, so every symbol gets a final address: \`square\` lands right after \`main\`'s five instructions, at \`0x1014\`. A second definition of a name is an error right here.
- **Pass 2** patches every hole. Both \`main.o\` and \`mathlib.o\` refer to \`calls\`, and both get \`0x4000\`: that's how two files share one global variable.
- The two error runs are exactly gcc's two link errors, found at the exact same stages.`,
        output: `symbol table: main=0x1000, square=0x1014, calls=0x4000, printf=0x1020
  0x1000  push rbp             (main.o)
  0x1004  call 0x1014          (main.o)
  0x1008  mov eax, [0x4000]    (main.o)
  0x100c  call 0x1020          (main.o)
  0x1010  ret                  (main.o)
  0x1014  inc [0x4000]         (mathlib.o)
  0x1018  imul eax, eax        (mathlib.o)
  0x101c  ret                  (mathlib.o)
  0x1020  (printf's code)      (libc)
error: undefined reference to 'square' (needed by main.o)
error: multiple definition of 'square' (in mathlib.o too)`,
      },
    ],
    interview: [
      {
        q: "What does a linker do?",
        freq: "very-common",
        a: `It combines object files and libraries into an executable or shared library: (1) **symbol resolution**: match each undefined symbol reference to exactly one definition across all inputs (reporting undefined or multiply defined symbols); (2) **layout**: merge sections of the same kind and assign final addresses; (3) **relocation**: patch every reference in code and data with final addresses (or with GOT/PLT entries for dynamic symbols). It also pulls needed members from static archives, records shared-library dependencies, sets the entry point, and can garbage-collect unused sections (\`--gc-sections\`) or run LTO.`,
      },
      {
        q: "Static vs dynamic linking: pros and cons?",
        freq: "very-common",
        a: `**Static**: library code is copied into the executable. Self-contained (easy deployment, e.g. Go binaries, containers from scratch), no load-time symbol lookup, enables whole-program optimization; but bigger binaries, no sharing of memory between processes, and security fixes require relinking every program.

**Dynamic**: the executable references \`.so\`/\`.dll\` files loaded at run time. Smaller binaries, one shared copy in memory, libraries can be updated independently, plugins via \`dlopen\`; but "DLL hell"/version mismatches, slightly slower start-up and calls through the PLT, and the program depends on the target system's libraries.`,
      },
      {
        q: "What causes 'undefined reference' and 'multiple definition' errors, and how do you fix them?",
        freq: "common",
        a: `**Undefined reference**: a symbol is used but no linked input defines it: a missing source file or library (\`-lm\`, \`-lpthread\`), wrong library order on the command line (put libraries after the objects that use them), a typo, a declared-but-never-defined function, C/C++ name mangling mismatch (missing \`extern "C"\`), or a template defined only in a \`.cpp\`. **Multiple definition**: two inputs define the same strong global symbol, typically a function or variable **defined** in a header included by several files. Fix by declaring (\`extern\`) in the header and defining once, or using \`static\`/\`inline\`/anonymous namespaces.`,
      },
      {
        q: "What are the GOT and PLT?",
        freq: "common",
        a: `Mechanisms for calling and accessing symbols in shared libraries from position-independent code. The **GOT** (Global Offset Table) is a data table of addresses, filled in by the dynamic loader; code reaches external variables and functions indirectly through it with PC-relative loads. The **PLT** (Procedure Linkage Table) is a set of small stubs: a call to \`printf@plt\` jumps through \`printf\`'s GOT entry. With **lazy binding**, the GOT entry initially points back into the PLT, which calls the loader's resolver on the first call; the resolver patches the GOT so later calls go direct. Full RELRO / \`-z now\` binds everything at start-up and makes the GOT read-only for security.`,
      },
      {
        q: "What is a relocation?",
        freq: "occasional",
        a: `A record in an object file saying "this location needs to be patched with (a function of) the address of symbol S": e.g. \`R_X86_64_PC32 square-4\` at offset 0x1a in \`.text\`. They exist because the compiler and assembler don't know final addresses. The linker processes them after layout (static relocations); for position-independent shared objects, some remain for the dynamic loader (dynamic relocations, mostly GOT entries). Relocation types encode how to compute the value: absolute, PC-relative, GOT-relative, TLS offsets, and so on.`,
      },
      {
        q: "What is name mangling and why does C++ need it?",
        freq: "common",
        a: `Encoding extra information (namespace, class, parameter types, template arguments, const-ness) into a symbol name, because linkers and object formats only match flat names but C++ allows several entities with the same name (overloading, namespaces, templates). \`void ns::f(int)\` becomes \`_ZN2ns1fEi\` under the Itanium ABI (Linux, macOS); MSVC uses its own scheme. \`c++filt\` demangles. \`extern "C"\` disables it so C code (and other languages' FFIs) can call the function by its plain name, at the price of no overloading.`,
      },
    ],
    quiz: [
      {
        q: "Why can `main.c` compile even though `square` is defined in another file?",
        options: [
          "The compiler reads all files at once",
          "A declaration is enough to type-check the call; the address is left as a relocation for the linker",
          "square is a built-in",
          "It can't",
        ],
        answer: 1,
        explain: "That's separate compilation: object files leave holes the linker fills in.",
      },
      {
        q: "In `nm` output, what does `U square` mean?",
        options: ["square is unused", "square is used here but defined elsewhere", "square is unsigned", "square is in the user section"],
        answer: 1,
        explain: "U = undefined in this object file; the linker must find the definition.",
      },
      {
        q: "Why did `calls` show up as B (bss) in mathlib.o?",
        options: [
          "It's a function",
          "It's a global initialised to zero, so it goes in .bss, which takes no space in the file",
          "It's read-only",
          "It's undefined",
        ],
        answer: 1,
        explain: ".bss holds zero-initialised globals; only its size is stored.",
      },
      {
        q: "You get `undefined reference to 'sqrt'` although you included math.h. What's the likely fix?",
        options: ["Include math.h twice", "Link the math library with -lm (after your object files)", "Declare sqrt yourself", "Compile with -O2"],
        answer: 1,
        explain: "The header only declares sqrt; the definition lives in libm, which must be linked.",
      },
      {
        q: "What is the PLT used for?",
        options: [
          "Storing local variables",
          "Stubs that call functions in shared libraries through GOT entries, resolved by the dynamic loader",
          "Printing",
          "Holding string constants",
        ],
        answer: 1,
        explain: "call printf@plt goes through a stub that jumps via the GOT, lazily filled in on the first call.",
      },
      {
        q: "Why does C++ mangle `print(int)` into something like `_Z5printi`?",
        options: [
          "To hide the source",
          "Overloaded functions share a name, but the linker needs a unique symbol for each",
          "To make names shorter",
          "For compression",
        ],
        answer: 1,
        explain: "The parameter types become part of the symbol, so print(int) and print(double) don't clash.",
      },
      {
        q: "What does link-time optimization (LTO) enable?",
        options: [
          "Faster linking",
          "Optimizing across files, e.g. inlining a function from another file",
          "Smaller headers",
          "Dynamic linking",
        ],
        answer: 1,
        explain: "With IR in the object files, the optimizer can see the whole program at link time.",
      },
    ],
  },

  // ------------------------------------------------------------------ RUNTIMES AND GC
  {
    id: "comp-runtime",
    title: "Runtimes and garbage collection",
    tagline: "What the compiled code leans on at run time: object layout and tagging, virtual dispatch with vtables, exceptions and unwinding, and memory management from reference counting to mark-sweep, copying, generational and concurrent collectors.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["jgc", "allocator"],
    concept: `## Explain it like I'm 10 🧸
Your compiled program is like a car the compiler built. But the car still needs a **pit crew** while it races: someone to fetch new parts (memory) when it asks, someone to clean up parts it threw away, and someone to rescue it if it spins off the track (errors). That pit crew is the **runtime**: code that ships with every program.

The biggest job is **cleaning up**. Imagine a room full of toys connected by strings. You're holding a few strings in your hand. Any toy you can reach by following strings from your hand is still being played with. Any toy you **can't reach** is forgotten, so it can go back in the box. That's exactly what a **garbage collector** does with memory.

## What a runtime provides
Every compiled language needs some code it didn't write itself:
- **start-up**: \`_start\` sets up the stack, arguments and environment, then calls \`main\` (C's \`crt0\`);
- **memory management**: \`malloc\`/\`free\`, or a garbage collector;
- **dynamic dispatch**, **exceptions**, **type information** (for \`instanceof\`, reflection, debuggers);
- **threads**, and in Go, the **scheduler** for goroutines;
- helper routines for operations the CPU lacks (128-bit division, \`memcpy\`, string concatenation, Pebble's \`print\`).

C's runtime is tiny. Java's (the JVM) and Go's are large. Your pebblec's runtime is just \`printf\` plus one function for division by zero.

## Representing values
A dynamically typed language must know each value's type at run time. Two common tricks:
- **Boxing**: every value is a pointer to a heap object whose header holds its type. Simple, but every integer is an allocation (CPython's \`int\` is an object of 28+ bytes).
- **Tagging**: steal a few bits of a machine word. In OCaml and many Lisps, a word ending in 1 is a small integer (shifted left by one) and a word ending in 0 is a pointer. V8 does the same (**Smis**). **NaN-boxing** (LuaJIT, JavaScriptCore, SpiderMonkey) hides pointers and integers inside the unused bit patterns of a 64-bit floating-point NaN, so every value fits in 8 bytes with no allocation.

## Objects and virtual dispatch
A class instance is laid out like a struct: fields at fixed offsets, plus a hidden pointer to the class's **vtable**, a table of function pointers for its methods. \`shape.area()\` compiles to: load the vtable pointer, load the entry for \`area\` at a fixed index, call it. Subclasses get their own vtable with overridden entries in the same slots. Interfaces with several implementations use **itables**; dynamic languages without fixed layouts use **hidden classes** (V8 "maps") plus **inline caches** to make property access almost as fast.

## Exceptions
When \`throw\` happens, the runtime must find the nearest matching \`catch\`, running destructors and \`finally\` blocks on the way out: **stack unwinding**. Modern C++, Rust panics and Java use **zero-cost** exceptions: no work at all on the normal path; the compiler emits **tables** mapping code ranges to cleanup and handler code (\`.eh_frame\`, LSDA), and the unwinder reads them only when an exception is actually thrown. The price is paid when throwing, which is why exceptions should be exceptional.

## Manual memory management and its bugs
C and C++ make the programmer call \`free\`/\`delete\`. The classic bugs: **leaks** (never freed), **use-after-free**, **double free**, **buffer overflows**. They cause most security vulnerabilities in C/C++ code. Rust prevents them at compile time with **ownership** and **borrowing**: the compiler inserts the frees itself (at the end of each owner's scope) and rejects programs that might use freed memory.

## Reference counting
Each object counts how many references point at it; when the count drops to zero, free it (and decrement everything **it** points to). Used by CPython, Swift (ARC), Objective-C, Rust's \`Rc\`/\`Arc\`, C++'s \`shared_ptr\`.
- Good: memory is freed **immediately** and predictably; no pauses.
- Bad: every pointer copy updates a counter (and with threads, an atomic one); and **cycles leak**: two objects pointing at each other never reach zero, even when nothing else can reach them (first sample). Fixes: **weak references** (Swift's \`weak\`), or a backup cycle collector, which is what CPython has (second sample).

## Tracing garbage collection
Instead of counting, **trace**: start from the **roots** (global variables, local variables in every stack frame, registers) and follow every pointer. Everything reached is **live**; everything else is garbage. Cycles are no problem.
- **Mark-sweep**: mark every reachable object, then sweep the whole heap and free unmarked ones. Doesn't move objects; the heap fragments over time. (Go, Ruby, CPython's cycle collector.)
- **Mark-compact**: after marking, slide live objects together to remove holes.
- **Copying** (Cheney's algorithm): split memory into two halves; copy live objects from the current half to the other, packed together, leaving **forwarding addresses** so pointers can be updated; then the whole old half is free. Cost proportional to **live** objects only, and allocation becomes a pointer bump. Uses twice the memory.
- **Generational**: most objects **die young** (the generational hypothesis). Allocate in a small **young generation** (eden), collect it often with a fast copying collector, and **promote** survivors to an **old generation** collected rarely. Needs a **write barrier**: when an old object is made to point at a young one, record it so the young collection treats it as a root. Java (G1, ZGC), .NET and V8 are generational. The \`jgc\` visualizer above lets you watch this.
- **Incremental and concurrent** collectors interleave or run marking alongside the program to keep pauses short, using **tri-colour marking** (white = not yet seen, grey = seen but its pointers not scanned, black = done) and barriers so the program can't hide a white object behind a black one. ZGC and Shenandoah keep pauses under a millisecond on huge heaps.

## How the compiler helps the GC
A precise GC must know **which stack slots and registers hold pointers** at any moment it might run. The compiler emits **stack maps** for **safepoints** (calls, allocations, loop back edges), where threads may stop for a collection. It also inserts **write barriers** and **allocation fast paths** (bump a pointer, compare with a limit) inline. Conservative collectors (Boehm GC) skip stack maps and treat anything that looks like a pointer as one.

## Escape analysis
If the compiler can prove an object never **escapes** the function that created it (never stored in the heap, never returned), it can allocate it on the **stack**, or replace it with plain local variables (**scalar replacement**), so the GC never sees it. Go and HotSpot do this; it's why short-lived objects in hot Java code can be nearly free.`,
    keyPoints: [
      "The runtime is code shipped with every program: start-up, memory management, dispatch, exceptions, type info",
      "Dynamic values are boxed (heap objects with a type header) or tagged (spare bits, Smis, NaN-boxing)",
      "Virtual calls load a function pointer from the object's vtable; zero-cost exceptions use unwind tables read only when throwing",
      "Reference counting frees immediately but leaks cycles; tracing GCs start from roots and free everything unreachable",
      "Mark-sweep, mark-compact and copying collectors; generational GC collects the young often, with write barriers",
      "Compilers support the GC with stack maps at safepoints, write barriers and escape analysis",
    ],
    code: [
      {
        title: "Reference counting, mark-sweep and copying, side by side",
        variants: [{ lang: "python", code: `# Three ways a language runtime frees memory automatically, on the same little heap.
# Objects A..G point at each other; the "roots" are what the program can still reach directly
# (local variables and globals). Anything not reachable from a root is garbage.
heap = {
    "A": ["B", "C"],
    "B": ["D"],
    "C": [],
    "D": [],
    "E": ["F"],        # E and F point at each other: a cycle that nobody else references
    "F": ["E"],
    "G": ["C"],        # G points at C, but nothing points at G
}
roots = ["A"]

# 1. Reference counting (CPython, Swift, Rust's Rc): every object counts how many references
#    point at it, and is freed the moment its count drops to zero.
counts = {o: 0 for o in heap}
for o in heap:
    for ref in heap[o]:
        counts[ref] += 1
for r in roots:
    counts[r] += 1
freed, work = [], [o for o in heap if counts[o] == 0]
while work:
    o = work.pop()
    freed.append(o)
    for ref in heap[o]:  # freeing an object drops the counts of what it points at
        counts[ref] -= 1
        if counts[ref] == 0:
            work.append(ref)

# 2. Mark and sweep (Go, Ruby, CPython's cycle collector): mark everything reachable, free the rest.
marked, stack = set(), list(roots)
while stack:
    o = stack.pop()
    if o not in marked:
        marked.add(o)
        stack += heap[o]
leaked = sorted(set(heap) - marked - set(freed))
print("reference counting frees:", sorted(freed), " but leaks the unreachable cycle:", leaked)
print("mark and sweep marks:    ", sorted(marked), " frees:", sorted(set(heap) - marked))

# 3. Copying (Cheney's algorithm, the young generation of the JVM, V8 and .NET): copy the live
#    objects into a fresh space, packed together; everything left behind is garbage, for free.
#    The to-space itself is the work queue: scan it left to right.
to_space, forward = [], {}


def copy(o):
    if o not in forward:  # not copied yet: copy it and leave a forwarding address behind
        forward[o] = len(to_space)
        to_space.append([o, list(heap[o])])
    return forward[o]


new_roots = [copy(r) for r in roots]
scan = 0
while scan < len(to_space):
    name, refs = to_space[scan]
    to_space[scan][1] = [copy(r) for r in refs]  # fix up pointers to the NEW addresses
    scan += 1
print("copying collector moved: ", [f"{n}@{i}" for i, (n, _) in enumerate(to_space)],
      " pointers now:", {n: refs for n, refs in to_space})
print("cost: mark-sweep touches every object (to sweep); copying touches only live ones")` }],
        explain: `- The heap is a dictionary of objects and the pointers they hold; \`roots\` are what the program can reach directly. A, B, C and D are reachable; E and F only point at each other; G points at C but nothing points at G.
- **Reference counting** frees G (count 0) at once. But E and F each hold the other's count at 1 forever: the classic **cycle leak**, computed here as "unreachable but not freed".
- **Mark-sweep** follows pointers from the roots with a stack (a depth-first search) and frees everything unmarked, cycle included.
- **Copying** (Cheney) copies A first, then **scans the copies themselves** as a queue: each pointer it finds is copied (if not yet) and rewritten to the **new** address. Afterwards A, B, C, D sit packed at 0–3, pointers updated (\`A: [1, 2]\` means B is at 1, C at 2). Garbage was never touched at all.`,
        output: `reference counting frees: ['G']  but leaks the unreachable cycle: ['E', 'F']
mark and sweep marks:     ['A', 'B', 'C', 'D']  frees: ['E', 'F', 'G']
copying collector moved:  ['A@0', 'B@1', 'C@2', 'D@3']  pointers now: {'A': [1, 2], 'B': [3], 'C': [], 'D': []}
cost: mark-sweep touches every object (to sweep); copying touches only live ones`,
      },
      {
        title: "CPython uses both: reference counting plus a cycle collector",
        variants: [{ lang: "python", code: `# CPython uses BOTH: reference counting frees most objects instantly, and a separate cycle
# collector (the gc module) finds groups of objects that only reference each other.
import gc
import weakref


class Node:
    def __init__(self, name):
        self.name, self.other = name, None


gc.disable()  # turn off the automatic cycle collector so we can watch it work by hand

a = Node("a")
watch_a = weakref.ref(a)  # a weak reference doesn't keep the object alive; it tells us if it is
del a
print("a plain object is freed as soon as its last reference goes:", watch_a() is None)

x, y = Node("x"), Node("y")
x.other, y.other = y, x  # a cycle: each keeps the other's reference count above zero
watch_x = weakref.ref(x)
del x, y
print("after del, the cycle is unreachable but still alive:", watch_x() is not None)
gc.collect()             # the cycle collector traces from the roots and frees what it can't reach
print("after gc.collect(), the cycle is gone:", watch_x() is None)
gc.enable()` }],
        explain: `- A **weak reference** (\`weakref.ref\`) lets us watch an object without keeping it alive: calling it returns the object, or \`None\` once it's been freed.
- \`del a\` drops the last reference, so the count hits zero and the object is freed **immediately**: reference counting at work.
- \`x\` and \`y\` point at each other. After \`del\`, nothing can reach them, but their counts are still 1: alive and leaked.
- \`gc.collect()\` runs CPython's **cycle collector**, a tracing collector that only looks at container objects. It finds the unreachable cycle and frees it. Normally it runs automatically (it's generational, too); we turned it off with \`gc.disable()\` to watch it.`,
        output: `a plain object is freed as soon as its last reference goes: True
after del, the cycle is unreachable but still alive: True
after gc.collect(), the cycle is gone: True`,
      },
    ],
    interview: [
      {
        q: "How does a garbage collector decide what's garbage?",
        freq: "very-common",
        a: `Tracing collectors use **reachability**: start from the **roots** (globals, thread stacks, registers, JNI handles...) and follow every reference; reachable objects are live, the rest is garbage, regardless of cycles. **Reference counting** instead frees an object when its count of incoming references drops to zero, which can't detect unreachable **cycles** without help (weak references or a backup tracing collector).`,
      },
      {
        q: "Compare reference counting with tracing garbage collection.",
        freq: "common",
        a: `**Reference counting**: immediate, deterministic reclamation (good for resources like files), no long pauses, memory released incrementally; but overhead on every pointer write (atomic increments with threads), **cycles leak**, and freeing a large structure can cause a cascading pause. **Tracing**: no per-write counting, handles cycles, allocation can be a pointer bump, throughput is usually better; but reclamation is delayed, needs extra memory headroom, and collections pause the program unless incremental or concurrent. CPython, Swift and Rust's Rc use counting; Java, Go, .NET and JS engines trace.`,
      },
      {
        q: "What is generational garbage collection and why does it work?",
        freq: "very-common",
        a: `It's based on the **weak generational hypothesis**: most objects die young. The heap is split into a **young generation** (small, collected frequently with a fast copying collector, cost proportional to survivors, which are few) and an **old generation** (collected rarely, usually with mark-sweep/compact). Survivors of a few young collections are **promoted**. To collect the young generation without scanning the old one, a **write barrier** records old-to-young pointers (card table or remembered set), which act as extra roots. Used by the JVM, .NET, V8, CPython's cycle collector.`,
      },
      {
        q: "What's a write barrier?",
        freq: "occasional",
        a: `A small piece of code the compiler inserts around pointer stores (\`obj.field = value\`) to tell the GC about them. Generational GCs use it to record old-to-young references (marking a card in a card table); incremental/concurrent GCs use it to maintain the tri-colour invariant (e.g. greying the new target, or the old value in snapshot-at-the-beginning) so concurrent marking doesn't miss live objects. It's a fast path of a few instructions, sometimes with a slower out-of-line path.`,
      },
      {
        q: "How are virtual method calls implemented?",
        freq: "common",
        a: `Each class with virtual methods has a **vtable**: an array of function pointers, one slot per virtual method, with overriding subclasses replacing entries in the same slots. Each object stores a hidden **vptr** to its class's vtable. \`obj->area()\` compiles to: load vptr from the object, load the function pointer at area's fixed slot, indirect call with \`obj\` as the hidden \`this\` argument. Costs: an indirect (possibly mispredicted) branch and lost inlining, which JITs recover with **inline caches** and **devirtualization** when only one type is seen.`,
      },
      {
        q: "How do zero-cost exceptions work?",
        freq: "occasional",
        a: `The compiler emits **unwind tables** (DWARF CFI in \`.eh_frame\`) describing how to restore each frame's registers, plus a **language-specific data area** listing, for each call-site range, the cleanup (destructors) and catch handlers. On the normal path nothing extra executes. On \`throw\`, the runtime allocates the exception, then a two-phase unwinder walks the stack using the tables: phase 1 searches for a matching handler, phase 2 unwinds frames running cleanups, then transfers control to the handler. Throwing is slow (table lookups, possibly symbol resolution), so exceptions should be rare.`,
      },
      {
        q: "What's escape analysis?",
        freq: "occasional",
        a: `A compiler analysis that determines whether an object can be referenced outside the function (or thread) that created it: stored in a field or global, returned, passed to unknown code. If it doesn't escape, the compiler can allocate it on the **stack**, **scalar-replace** it (keep its fields in registers, no allocation at all), and remove its locks. Go uses it to decide stack vs heap (\`go build -gcflags=-m\` shows decisions); HotSpot C2 and Graal use it to eliminate allocations in hot code.`,
      },
    ],
    quiz: [
      {
        q: "What are the 'roots' of a tracing garbage collector?",
        options: [
          "The first objects ever allocated",
          "References the program can use directly: globals, local variables on every stack, registers",
          "The biggest objects",
          "The objects with the highest reference counts",
        ],
        answer: 1,
        explain: "Everything reachable from the roots is live; the rest is garbage.",
      },
      {
        q: "Why does pure reference counting leak E and F in the sample?",
        options: [
          "They're too big",
          "They point at each other, so their counts never reach zero even though nothing else can reach them",
          "They're roots",
          "Reference counting never frees anything",
        ],
        answer: 1,
        explain: "Cycles keep each other's counts above zero. Tracing doesn't care, which is why CPython adds a cycle collector.",
      },
      {
        q: "What does a copying collector's cost depend on?",
        options: ["The total heap size", "The number of live objects", "The number of dead objects", "The number of pointers in dead objects"],
        answer: 1,
        explain: "Only live objects are copied; dead ones are left behind and the whole old space is reused.",
      },
      {
        q: "What does the generational hypothesis say?",
        options: [
          "Old objects die first",
          "Most objects die young",
          "All objects live equally long",
          "Objects never die",
        ],
        answer: 1,
        explain: "So collecting a small young generation often reclaims a lot of memory for little work.",
      },
      {
        q: "Why do generational collectors need a write barrier?",
        options: [
          "To make writes faster",
          "To record pointers from old objects to young ones, so a young collection can treat them as roots",
          "To prevent writes to old objects",
          "To count references",
        ],
        answer: 1,
        explain: "Otherwise a young object referenced only from the old generation would look unreachable and be freed.",
      },
      {
        q: "How does `shape.area()` find the right method in C++ or Java?",
        options: [
          "It searches all classes by name",
          "Through the object's vtable pointer: load the function pointer at area's slot, then call it",
          "With a switch statement over all subclasses",
          "The linker decides",
        ],
        answer: 1,
        explain: "Each class has a vtable; overriding methods occupy the same slots, so one indexed load finds the right one.",
      },
      {
        q: "What is NaN-boxing?",
        options: [
          "A way to handle division by zero",
          "Packing pointers and integers into unused bit patterns of 64-bit floating-point NaNs, so every value fits in 8 bytes",
          "A garbage collection algorithm",
          "A way to box floats on the heap",
        ],
        answer: 1,
        explain: "Used by LuaJIT and JavaScript engines to avoid allocating for every number.",
      },
      {
        q: "If escape analysis proves an object never leaves its function, what can the compiler do?",
        options: [
          "Delete the function",
          "Allocate it on the stack or replace it with local variables, so the GC never sees it",
          "Make it global",
          "Nothing",
        ],
        answer: 1,
        explain: "No heap allocation, no GC work: often a big win for short-lived temporary objects.",
      },
    ],
  },

  // ------------------------------------------------------------------ JIT
  {
    id: "comp-jit",
    title: "JIT compilation",
    tagline: "Compiling while the program runs: executable memory and W^X, emitting machine code bytes, tiered compilation, profiling and type feedback, speculation, guards and deoptimization, inline caches, tracing JITs, and how V8, HotSpot, PyPy and LuaJIT work.",
    difficulty: "advanced",
    minutes: 45,
    diagram: {
      title: "Tiers of a modern JIT (V8, HotSpot)",
      nodes: [
        { id: "bc", label: "Bytecode", kind: "client", x: 100, y: 270, sub: "from the parser" },
        { id: "interp", label: "Interpreter", kind: "service", x: 290, y: 270, sub: "starts at once, collects feedback" },
        { id: "profile", label: "Type feedback", kind: "db", x: 290, y: 460, sub: "types seen, branches taken, call counts" },
        { id: "baseline", label: "Baseline compiler", kind: "worker", x: 480, y: 110, sub: "quick, simple machine code" },
        { id: "opt", label: "Optimizing compiler", kind: "gpu", x: 680, y: 270, sub: "speculates, inlines, SSA" },
        { id: "code", label: "Optimized code", kind: "node", x: 880, y: 270, sub: "fast, protected by guards" },
        { id: "deopt", label: "Deoptimization", kind: "monitor", x: 680, y: 460, sub: "a guard failed" },
      ],
      edges: [
        { from: "bc", to: "interp" },
        { from: "interp", to: "profile", label: "records" },
        { from: "interp", to: "baseline", label: "warm" },
        { from: "baseline", to: "opt", label: "hot" },
        { from: "profile", to: "opt", label: "assumptions" },
        { from: "opt", to: "code" },
        { from: "code", to: "deopt", label: "guard fails" },
        { from: "deopt", to: "interp", label: "resume here" },
      ],
      flows: [
        {
          name: "A function gets hot",
          path: ["bc", "interp", "baseline", "opt", "code"],
          steps: [
            "Execution starts immediately in the interpreter, with no compile delay.",
            "After a few calls the function is warm: a baseline compiler produces simple machine code quickly.",
            "After thousands of calls it's hot: worth spending real compile time on.",
            "The optimizing compiler produces fast code specialised for what actually happened so far.",
          ],
        },
        {
          name: "Speculation uses the profile",
          path: ["interp", "profile", "opt"],
          steps: [
            "Every operation the interpreter runs records what it saw: x was always a small integer.",
            "The optimizer bets it stays that way: integer add, no type checks, inline the callee. A guard checks the bet.",
          ],
        },
        {
          name: "The bet goes wrong",
          path: ["code", "deopt", "interp"],
          steps: [
            "x is suddenly a string. The guard fails.",
            "Deoptimize: rebuild the interpreter's frame from the optimized one and continue there. Later, maybe recompile with the new facts.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Remember the two translators: one translates your whole book **before** reading (compiler), one reads aloud sentence by sentence (interpreter). A **JIT** is a translator who starts reading aloud straight away, but keeps a **tally** of which pages you ask for again and again. Page 12, twenty times already? It quickly writes a **perfect translation** of page 12, and next time just reads that, super fast.

Even better, it **guesses**. "Every time you've asked about page 12, the hero was a cat. I'll write the fast version assuming it's a cat." If one day the hero is a dog, it notices, says "oops", throws the fast version away, and goes back to careful reading. That's **speculation** and **deoptimization**: the secret of fast JavaScript.

## Machine code at run time
A JIT generates machine code **while the program runs** and then jumps into it. The mechanics are surprisingly simple (first sample):
1. get memory with \`mmap\`;
2. write instruction **bytes** into it (an encoder for each instruction, or a whole compiler back end);
3. make it **executable** with \`mprotect\`;
4. flush the instruction cache (needed on ARM, harmless on x86);
5. cast the address to a function pointer and **call** it.

**W^X** (write xor execute): memory should never be writable and executable at the same time, or a memory-corruption bug could write code and run it. JITs flip pages between writable and executable (Apple silicon enforces it with per-thread permissions, \`MAP_JIT\`). Some platforms (iOS for normal apps, some consoles) forbid JITs entirely, so engines ship an interpreter-only mode.

## Why JIT at all?
An AOT compiler must produce code that works for **every** possible input. A JIT sees the **actual** program running on **actual** data. In a dynamic language, \`a + b\` might be integers, floats, strings or objects with a custom \`+\`: AOT code must check every case every time. But at a particular \`+\` in a real program, it's usually **always** the same types. A JIT can compile just that case.

## Tiered compilation
Compiling takes time, which in a JIT is the user's time. So engines use **tiers** (diagram above):
| Tier | V8 (JavaScript) | HotSpot (Java) | Job |
|---|---|---|---|
| 0 | Ignition interpreter | interpreter | start instantly, collect profiles |
| 1 | Sparkplug (baseline) | C1 | quick, unoptimised machine code |
| 2 | Maglev (mid-tier) | C1 with profiling | fast, decent code |
| 3 | TurboFan | C2 (or Graal) | maximum optimization, using the profiles |

Functions move up when **counters** (calls, loop iterations) pass thresholds. Long-running loops can be upgraded **in the middle** of running: **on-stack replacement** (OSR) swaps the interpreter frame for an optimized one at a loop back edge.

## Profiling, speculation and guards
Lower tiers record **type feedback**: which types each operation saw, which branches were taken, which functions each call site called. The optimizing tier **speculates** that the future looks like the past:
- \`a + b\` was always two small integers → emit a plain integer \`add\`, plus a **guard** (a type check) and an overflow check;
- this call site always called \`Circle.area\` → **inline** it, behind a guard that the receiver is a Circle;
- this branch was never taken → don't even compile it; put a guard that bails out if it ever is.

Guards are cheap (a compare and a rarely taken branch), and they unlock everything else: inlining, constant folding, register allocation of unboxed numbers, loop optimizations.

## Deoptimization
When a guard fails, the optimized code is **wrong** for this situation. The JIT **deoptimizes**: using metadata recorded at compile time, it reconstructs the interpreter's state (which bytecode we're at, the value of every local, including ones the optimizer had folded away or kept in registers) and continues in the interpreter. The function may later be reoptimized with the wider type information. In the second sample, \`poly(2.5)\` fails the "int" guard, falls back, and recompiles. Frequent deopt/reopt cycles ("deopt loops") are a real performance problem in JavaScript, which is why consistent types make JS faster.

## Inline caches and hidden classes
In JavaScript, \`obj.x\` could be anywhere: objects are dictionaries. V8 gives objects with the same layout a shared **hidden class** (map) that records where each property lives. An **inline cache** at each \`obj.x\` remembers "last time, the map was M and x was at offset 12": next time, compare the map (one instruction) and load directly. **Monomorphic** sites (one map) are fastest; **polymorphic** (a few) are OK; **megamorphic** (many) fall back to slow lookup. The same idea speeds up method calls in Smalltalk, Self (where it was invented), Ruby and CPython 3.11+.

## Tracing JITs
Instead of compiling whole **methods**, a **tracing JIT** records the actual path taken through a hot **loop** (a **trace**), across function calls, with guards wherever execution could have gone differently, and compiles that straight-line trace. Very effective for loop-heavy code; tricky with branchy code. LuaJIT, PyPy (which traces the **interpreter** running your program: a meta-tracing JIT generated from an interpreter written in RPython), and early Firefox (TraceMonkey) are tracing JITs.

## JIT vs AOT
- JITs can **beat** AOT compilers on dynamic code, thanks to profile-driven speculation.
- AOT wins on **start-up time**, **memory** (no compiler or profiles at run time), **predictability** and **platforms that forbid JITs**.
- The lines blur: AOT compilers use **profile-guided optimization** (PGO) from training runs, and Java offers AOT (GraalVM native image) while .NET has ReadyToRun plus tiered JIT.
- **Copy-and-patch** (CPython 3.13's experimental JIT) is a newer, cheap technique: precompile templates of machine code for each bytecode with Clang at build time, then at run time copy them and patch in the holes (constants, jump targets), like a tiny linker.`,
    keyPoints: [
      "A JIT writes machine code into memory, makes it executable (never writable and executable at once: W^X), and calls it",
      "Tiered compilation: interpret first, then baseline-compile warm code, then heavily optimize hot code",
      "Lower tiers record type feedback; the optimizing tier speculates on it, protected by cheap guards",
      "A failed guard deoptimizes: rebuild the interpreter frame and continue there, maybe recompile later",
      "Hidden classes plus inline caches make property access in dynamic languages nearly as fast as a struct field",
      "Tracing JITs compile hot loop paths (LuaJIT, PyPy); method JITs compile whole functions (V8, HotSpot)",
    ],
    code: [
      {
        title: "A real JIT in one page of C",
        linux: true,
        variants: [{ lang: "c", code: `// A real JIT in one page: write machine-code bytes into memory WHILE the program runs, make that
// memory executable, and call it like any C function. V8, the JVM and LuaJIT do exactly this,
// with a full compiler choosing the bytes.
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>

typedef long (*fn_t)(long);

// "Compile" f(x) = x * k + c, where k and c are only known at run time.
static size_t emit(uint8_t *buf, int32_t k, int32_t c) {
#if defined(__x86_64__)
    uint8_t code[] = {
        0x48, 0x69, 0xC7, 0, 0, 0, 0,  // imul rax, rdi, k     (the argument arrives in rdi)
        0x48, 0x05, 0, 0, 0, 0,        // add  rax, c
        0xC3,                          // ret                  (the result goes back in rax)
    };
    memcpy(code + 3, &k, 4);
    memcpy(code + 9, &c, 4);
#elif defined(__aarch64__)
    uint32_t code[] = {                // each AArch64 instruction is exactly 4 bytes
        0xD2800001u | (uint32_t)k << 5,   // movz x1, #k        (k < 65536)
        0x9B017C00u,                      // mul  x0, x0, x1    (the argument arrives in x0)
        0x91000000u | (uint32_t)c << 10,  // add  x0, x0, #c    (c < 4096)
        0xD65F03C0u,                      // ret                (the result goes back in x0)
    };
#else
#error "this JIT only knows x86-64 and AArch64"
#endif
    memcpy(buf, code, sizeof code);
    return sizeof code;
}

int main(void) {
    // 1. get a page of memory we can write to
    uint8_t *mem = mmap(NULL, 4096, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (mem == MAP_FAILED) { perror("mmap"); return 1; }

    int32_t k = 7, c = 3;  // pretend these came from the user, a config file, or profiling
    size_t n = emit(mem, k, c);

    // 2. flip it to read + execute. Never writable AND executable at once ("W^X"): that
    //    would let a memory-corruption bug inject code. Then sync the instruction cache.
    if (mprotect(mem, 4096, PROT_READ | PROT_EXEC) != 0) { perror("mprotect"); return 1; }
    __builtin___clear_cache((char *)mem, (char *)mem + n);

    // 3. call the bytes as a function
    fn_t f = (fn_t)(void *)mem;
    printf("compiled f(x) = x * %d + %d into machine code at run time, then called it:\\n", k, c);
    for (long x = 0; x <= 100; x += 25)
        printf("  f(%ld) = %ld\\n", x, f(x));
    munmap(mem, 4096);
    return 0;
}` }],
        explain: `- \`emit\` writes the **bytes** of \`f(x) = x * k + c\` for the CPU it's running on. On x86-64, \`48 69 C7 <k>\` is \`imul rax, rdi, k\`: the constant is pasted into the instruction. On AArch64, each instruction is a 32-bit word with \`k\` and \`c\` shifted into their fields. \`k\` and \`c\` are only known at **run time**, which is the point: the code is specialised for them.
- The page starts **read + write**, and \`mprotect\` flips it to **read + execute** before running it: W^X, never both.
- \`__builtin___clear_cache\` makes sure the CPU's instruction cache sees the new bytes. ARM CPUs keep separate instruction and data caches and need this; x86 keeps them coherent.
- Casting the address to \`long (*)(long)\` and calling it works because the bytes follow the **calling convention**: the argument arrives in \`rdi\` / \`x0\`, the result goes back in \`rax\` / \`x0\`.
- This is the bottom layer of every JIT. V8, HotSpot and LuaJIT have assemblers that write these bytes for thousands of instruction forms, with a full optimizing compiler choosing them.`,
        output: `compiled f(x) = x * 7 + 3 into machine code at run time, then called it:
  f(0) = 3
  f(25) = 178
  f(50) = 353
  f(75) = 528
  f(100) = 703`,
      },
      {
        title: "Tiers, guards and deoptimization",
        variants: [{ lang: "python", code: `# How a modern JIT behaves (V8, HotSpot, PyPy, CPython 3.13+'s experimental JIT):
#   start by INTERPRETING, count calls, and once a function is HOT compile it to faster code,
#   SPECIALISED for the types seen so far, behind a GUARD. If the guard fails, DEOPTIMISE.
# Here "faster code" is Python source built from the AST, so the speed-up is real but modest.
import time

# poly(x) = 3 * x * x + 2 * x + 1, as an AST
AST = ("+", ("+", ("*", ("*", 3, "x"), "x"), ("*", 2, "x")), 1)
HOT = 3


def interpret(node, x):
    if node == "x":
        return x
    if not isinstance(node, tuple):
        return node
    a, b = interpret(node[1], x), interpret(node[2], x)
    return a + b if node[0] == "+" else a * b


def to_source(node):
    if not isinstance(node, tuple):
        return str(node)
    return f"({to_source(node[1])} {node[0]} {to_source(node[2])})"


class Function:
    def __init__(self, ast):
        self.ast, self.calls, self.compiled, self.seen_type = ast, 0, None, None

    def __call__(self, x):
        self.calls += 1
        if self.compiled:
            if type(x) is self.seen_type:              # the guard: still the type we specialised for?
                return self.compiled(x), "compiled"
            self.compiled = None                       # deoptimise: throw the fast code away
            return interpret(self.ast, x), f"guard failed ({type(x).__name__}), deoptimised"
        if self.calls >= HOT:
            self.seen_type = type(x)
            src = f"def fast(x):\\n    return {to_source(self.ast)}\\n"
            namespace = {}
            exec(compile(src, "<jit>", "exec"), namespace)
            self.compiled = namespace["fast"]
            return self.compiled(x), f"hot after {self.calls} calls: compiled for {self.seen_type.__name__}"
        return interpret(self.ast, x), "interpreted"


poly = Function(AST)
for x in [1, 2, 3, 4, 5, 2.5, 6]:
    value, how = poly(x)
    print(f"poly({x}) = {value:<6} {how}")
print("generated source:", to_source(AST))

N = 100_000
t0 = time.perf_counter()
for i in range(N):
    interpret(AST, i)
t1 = time.perf_counter()
fast = Function(AST)
for i in range(HOT):
    fast(i)
for i in range(N):
    fast.compiled(i)
t2 = time.perf_counter()
print(f"compiled code beats the tree-walking interpreter: {(t1 - t0) > 2 * (t2 - t1)}")` }],
        explain: `- \`Function\` starts in the **interpreter** tier, walking the AST. It counts calls; at \`HOT = 3\` it "compiles": it generates Python source from the AST and compiles that with \`exec\`. Here Python bytecode stands in for machine code, but the life cycle is the real one.
- The compiled version is **specialised** for the type seen (\`int\`) and protected by a **guard**: \`type(x) is self.seen_type\`.
- \`poly(2.5)\` fails the guard: the fast code is thrown away (**deoptimization**) and that call is interpreted. The function is still hot, so the next call, \`poly(6)\`, recompiles it for the type it sees then (an int again).
- The timing line shows the compiled code beats tree-walking the same AST by more than 2×, even in this toy. Real JITs gain 10–100× over their interpreters because they emit machine code and exploit types far more deeply.`,
        output: `poly(1) = 6      interpreted
poly(2) = 17     interpreted
poly(3) = 34     hot after 3 calls: compiled for int
poly(4) = 57     compiled
poly(5) = 86     compiled
poly(2.5) = 24.75  guard failed (float), deoptimised
poly(6) = 121    hot after 7 calls: compiled for int
generated source: ((((3 * x) * x) + (2 * x)) + 1)
compiled code beats the tree-walking interpreter: True`,
      },
    ],
    interview: [
      {
        q: "How does a JIT compiler work?",
        freq: "very-common",
        a: `It compiles code to machine code **during execution**. Typically: start by interpreting (or with a quick baseline compile), collect **profiles** (execution counts, types, branch directions, call targets); when a method or loop gets hot, compile it with an optimizing compiler that **speculates** based on the profile, inserting **guards**; place the code in executable memory (respecting W^X) and patch dispatch so future calls use it; on guard failure, **deoptimize** back to the interpreter, possibly recompiling later. On-stack replacement upgrades long-running loops mid-execution.`,
      },
      {
        q: "What is deoptimization and why do JITs need it?",
        freq: "common",
        a: `Transferring execution from optimized code back to a less optimized tier (usually the interpreter) when an assumption the optimizer relied on becomes false: a type guard fails, a class is loaded that overrides an inlined method, a never-taken branch is taken. The compiler records **deopt metadata** at each guard: how to reconstruct the interpreter frame (bytecode index, values of locals and stack slots, re-materialising objects that were scalar-replaced). Deoptimization is what makes aggressive speculation **safe**: without it, the JIT could only do optimizations valid for all possible inputs.`,
      },
      {
        q: "What's an inline cache?",
        freq: "common",
        a: `A per-call-site (or per-property-access) cache that remembers the result of the last dynamic lookup keyed by the receiver's type or hidden class: e.g. "if the object's map is M, property x is at offset 12" or "if the receiver's class is C, call C.area directly". Next time, a single comparison checks the key and skips the expensive lookup. Sites are **monomorphic**, **polymorphic** (a small list of entries) or **megamorphic** (fall back to a generic lookup). The cache contents also serve as **type feedback** for the optimizing compiler, which inlines the common case.`,
      },
      {
        q: "Tracing JIT vs method JIT?",
        freq: "occasional",
        a: `A **method JIT** (V8's TurboFan, HotSpot, .NET RyuJIT) compiles whole functions, using profiles to speculate and inline; it handles branchy code well. A **tracing JIT** (LuaJIT, PyPy, TraceMonkey) records the sequence of operations actually executed through a hot loop, across calls, as a linear **trace** with guards at every branch point, and compiles it; this gives aggressive specialisation and simple optimization of straight-line code, but branchy loops cause many side traces ("trace explosion"). PyPy is a **meta-tracing** JIT: it traces the interpreter itself, so any interpreter written in RPython gets a JIT for free.`,
      },
      {
        q: "Why can a JIT sometimes produce faster code than an ahead-of-time compiler?",
        freq: "common",
        a: `It optimizes for the **actual** workload: real types (removing dynamic checks), real call targets (devirtualising and inlining across modules and dynamically loaded code), real branch probabilities (code layout, which paths to optimize), and real constants (e.g. configuration values that never change). It can specialise for the exact CPU (AVX-512 if present) and re-optimize when behaviour changes. AOT compilers must stay correct for all inputs and can only approximate this with profile-guided optimization from training runs.`,
      },
      {
        q: "What is W^X and why does it matter for JITs?",
        freq: "occasional",
        a: `**Write xor execute**: a memory page may be writable or executable, but never both. It blocks a whole class of exploits where an attacker writes shellcode into a buffer and jumps to it. JITs conflict with it because they generate code, so they write code into writable pages and then flip them to executable (\`mprotect\`), use dual mappings (one writable view, one executable view of the same physical memory), or per-thread permission switching (Apple's \`MAP_JIT\` with \`pthread_jit_write_protect_np\`). Platforms that forbid runtime code generation (iOS apps, some consoles) force interpreter-only modes.`,
      },
    ],
    quiz: [
      {
        q: "In the C JIT, why is the page switched from read+write to read+execute before calling it?",
        options: [
          "Executable memory is faster",
          "W^X: memory should never be writable and executable at once, so a bug can't inject and run code",
          "mmap requires it",
          "To save memory",
        ],
        answer: 1,
        explain: "Write the code, then make it executable. Never both at the same time.",
      },
      {
        q: "Why does the JIT call `__builtin___clear_cache` after writing code?",
        options: [
          "To free memory",
          "So the CPU's instruction cache sees the new bytes (required on ARM)",
          "To zero the page",
          "To flush stdout",
        ],
        answer: 1,
        explain: "ARM has separate instruction and data caches that aren't kept coherent automatically.",
      },
      {
        q: "What's the point of starting in an interpreter tier?",
        options: [
          "Interpreters produce better code",
          "No compile delay at start-up, and it collects profiles that later tiers use",
          "To check syntax",
          "Because machine code can't run at first",
        ],
        answer: 1,
        explain: "Most code runs rarely; only hot code is worth compiling, and the interpreter finds out which.",
      },
      {
        q: "What is a guard in JIT-compiled code?",
        options: [
          "A lock",
          "A cheap check that the optimizer's assumption (like 'x is an int') still holds",
          "A stack canary",
          "A garbage collector barrier",
        ],
        answer: 1,
        explain: "If it fails, the code deoptimizes instead of computing a wrong answer.",
      },
      {
        q: "In the tiered sample, what happens at `poly(2.5)`?",
        options: [
          "It's compiled for float",
          "The int guard fails, the compiled code is thrown away, and the call is interpreted",
          "It crashes",
          "It returns an int",
        ],
        answer: 1,
        explain: "Deoptimization: fall back safely, then recompile on a later call.",
      },
      {
        q: "A JavaScript property access site that always sees objects with the same hidden class is...",
        options: ["Megamorphic", "Monomorphic, the fastest case for an inline cache", "Polymorphic", "Deoptimized"],
        answer: 1,
        explain: "One map: one compare and a direct load.",
      },
      {
        q: "What does a tracing JIT compile?",
        options: [
          "Whole source files",
          "The path actually taken through a hot loop, recorded as a linear trace with guards",
          "Only function calls",
          "Every function on first call",
        ],
        answer: 1,
        explain: "LuaJIT and PyPy record what really runs and compile that straight-line trace.",
      },
      {
        q: "What is on-stack replacement (OSR)?",
        options: [
          "Replacing the call stack with a heap",
          "Switching a running loop from interpreted to optimized code in the middle of its execution",
          "Swapping two stack frames",
          "A garbage collection technique",
        ],
        answer: 1,
        explain: "A function called once but looping a billion times still gets optimized code.",
      },
    ],
  },
];
