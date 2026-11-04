import type { Lesson } from "../types";

// Compilers, part 4: the middle end. Intermediate representations, SSA, optimization and LLVM.

export const compilersPart4: Lesson[] = [
  // ------------------------------------------------------------------ IR, CFG, SSA
  {
    id: "comp-ir",
    part: "Part 4 · The middle end",
    title: "Intermediate representations: TAC, CFGs and SSA",
    tagline: "Lowering trees into three-address code, basic blocks and control-flow graphs, dominators and loops, static single assignment with phi functions, how SSA is built (dominance frontiers) and taken apart, and the IRs real compilers use.",
    difficulty: "advanced",
    minutes: 50,
    diagram: {
      title: "The control-flow graph of collatz",
      nodes: [
        { id: "b0", label: "B0: entry", kind: "client", x: 130, y: 70, sub: "steps = 0" },
        { id: "b1", label: "B1: loop test", kind: "control", x: 430, y: 70, sub: "t1 = n != 1" },
        { id: "b6", label: "B6: exit", kind: "node", x: 820, y: 70, sub: "return steps" },
        { id: "b2", label: "B2: is n even?", kind: "control", x: 430, y: 230, sub: "t2 = n % 2; t3 = t2 == 0" },
        { id: "b3", label: "B3: halve", kind: "worker", x: 200, y: 380, sub: "n = n / 2" },
        { id: "b4", label: "B4: 3n + 1", kind: "worker", x: 660, y: 380, sub: "t5 = 3 * n; n = t5 + 1" },
        { id: "b5", label: "B5: count", kind: "service", x: 430, y: 500, sub: "steps = steps + 1" },
      ],
      edges: [
        { from: "b0", to: "b1" },
        { from: "b1", to: "b2", label: "n != 1" },
        { from: "b1", to: "b6", label: "n == 1" },
        { from: "b2", to: "b3", label: "even" },
        { from: "b2", to: "b4", label: "odd" },
        { from: "b3", to: "b5" },
        { from: "b4", to: "b5" },
        { from: "b5", to: "b1", label: "back edge", dashed: true },
      ],
      flows: [
        {
          name: "One trip round the loop, n even",
          path: ["b0", "b1", "b2", "b3", "b5", "b1"],
          steps: [
            "Enter the function: steps = 0. B0 has one successor, so fall into B1.",
            "n isn't 1 yet, so the conditional branch goes to B2.",
            "n % 2 == 0: take the 'even' edge.",
            "Halve n, then jump to the merge block B5.",
            "Count the step and follow the back edge to B1. A back edge to a block that dominates its source means a loop.",
          ],
        },
        {
          name: "n is odd, then n reaches 1",
          path: ["b1", "b2", "b4", "b5", "b1", "b6"],
          steps: [
            "Test n != 1: still going.",
            "n is odd: take the other edge.",
            "Compute 3n + 1, then reach the same merge block B5. Two definitions of n meet here: SSA puts a phi in B5.",
            "Count the step and loop back.",
            "This time n == 1, so leave the loop and return steps.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Your program as a tree is great for understanding **what** it says, but awkward for figuring out how to make it **faster**. So the compiler rewrites it as a **recipe of tiny steps**, each doing exactly one thing: "t1 = n times 3", "t2 = t1 plus 1". No step does two things at once.

Then it chops the recipe into **chunks** that always run start to finish without any jumping in or out (**basic blocks**), and draws **arrows** showing which chunk can run next. That drawing is the **control-flow graph**: a map of every path your program could take. The diagram above is that map for a little function.

Finally, a clever trick: give every **new value** a **new name**, so \`n\` becomes \`n1\`, \`n2\`, \`n3\`. Now every name is set exactly **once**, and the compiler always knows exactly where each value came from. That's **SSA**, and nearly every modern compiler uses it.

## Why another representation?
The AST mirrors the source: nested expressions, \`while\` and \`if\` with bodies, many node kinds. Optimizers and code generators want something **simpler and more uniform**:
- few instruction kinds, each doing one operation;
- every intermediate result has a **name** (a temporary);
- control flow is **explicit**: labels and jumps, not nested statements.

This is the **intermediate representation** (IR). Real compilers often have **several**, from high to low level: Rust goes AST → HIR → MIR → LLVM IR → machine IR; GCC uses GENERIC → GIMPLE → RTL; V8 uses bytecode → Maglev IR / TurboFan's sea of nodes.

## Three-address code
**Three-address code** (TAC) has instructions with at most one operator and three "addresses" (names or constants):
\`\`\`text
x = y op z        x = op y        x = y
goto L            ifnot x goto L  return x
\`\`\`
**Lowering** an expression is a post-order walk that invents a temporary for every intermediate result: \`3 * n + 1\` becomes \`t5 = 3 * n\`, \`t6 = t5 + 1\`. Lowering control flow turns \`while\` and \`if\` into labels and conditional jumps (first sample). Notice the shape is close to assembly, but with **unlimited** named registers.

## Basic blocks and the control-flow graph
A **basic block** is a maximal straight-line run of instructions: control enters only at the top and leaves only at the bottom. To find them, mark **leaders**:
1. the first instruction;
2. every jump **target** (label);
3. every instruction right **after** a jump.

Each leader starts a block. Connect the blocks with **edges** for every jump and every fall-through, and you have the **control-flow graph** (CFG). Every analysis in the middle end runs on it.

## Dominators and loops
Block A **dominates** B if **every** path from the entry to B goes through A. The entry dominates everything; in collatz, B2 dominates B3, B4 and B5. Dominators are computed with another **fixed-point** iteration: \`dom(B) = {B} ∪ ⋂ dom(predecessors of B)\`. Each block's closest strict dominator is its **immediate dominator**, and these form the **dominator tree**.

Dominators find **loops**: an edge B5 → B1 where the target **dominates** the source is a **back edge**, and B1 is a **loop header**. Loop optimizations (moving work out of loops, unrolling, vectorising) all start from this.

## Static single assignment (SSA)
In **SSA form**, every variable is **assigned exactly once**. Each assignment creates a new version:
\`\`\`text
n = n / 2          →    n2 = n1 / 2
n = 3 * n + 1      →    t5 = 3 * n1;  n3 = t5 + 1
\`\`\`
But what's \`n\` in B5, where the paths from B3 (\`n2\`) and B4 (\`n3\`) **merge**? SSA adds a **φ (phi) function** at the start of the merge block:
\`\`\`text
B5:  n4 = phi(n2 from B3, n3 from B4)
\`\`\`
A phi picks the value that arrived along the edge actually taken. It isn't a real instruction: it's bookkeeping that later turns into copies on the incoming edges.

Why bother? Because with one definition per name, **every use points to exactly one definition**. Analyses that were complicated ("which assignments might reach this use?") become trivial lookups:
- **constant propagation**: if \`x1 = 5\`, every use of \`x1\` is 5. Done.
- **dead code**: a definition with no uses can be deleted.
- **value numbering**: two instructions with the same operator and operands compute the same value.

## Building SSA: dominance frontiers
Where do phis go? The classic algorithm (Cytron et al., 1991):
1. compute **dominators**;
2. compute each block's **dominance frontier**: the blocks where its dominance **ends**, the first merge points it reaches but doesn't dominate. In collatz, DF(B3) = DF(B4) = {B5};
3. a variable assigned in block X needs a phi in every block of DF(X), and since a phi is itself an assignment, repeat for the frontier of those blocks (the **iterated** dominance frontier);
4. **rename**: walk the dominator tree with a stack of current versions per variable, giving each assignment a new name and filling in phi arguments along the way.

The second sample does all four steps on collatz: phis for \`n\` and \`steps\` in the loop header B1, and for \`n\` in B5.

The easy way out, used by Clang and by your pebblec: emit every variable as a **stack slot** with loads and stores (no SSA needed), and let LLVM's **mem2reg** pass build SSA for you. You'll see that in the LLVM lesson.

**Leaving SSA**: real CPUs have no phi. Before register allocation, each phi becomes **copies** at the end of the predecessor blocks (\`n4 = n2\` at the end of B3, \`n4 = n3\` at the end of B4). Careful copy placement (the "lost copy" and "swap" problems) and a good register allocator remove most of those copies again.

## Other IR shapes you'll meet
- **Sea of nodes** (HotSpot C2, V8's TurboFan until recently, Graal): one graph for both data and control dependencies; instructions float freely until scheduling.
- **MLIR**: a framework for building many IR "dialects" at different levels (tensor ops, loops, LLVM), used by machine-learning compilers.
- **Stack-based IR**: WebAssembly and JVM bytecode are IRs too; JITs convert them to SSA.
- **CPS and ANF** in functional-language compilers: every intermediate value named, like TAC, plus explicit continuations.`,
    keyPoints: [
      "IR is simpler than the AST: few instruction kinds, named temporaries, explicit jumps. Real compilers lower through several IRs",
      "Three-address code has at most one operator per instruction; lowering is a post-order walk that invents temporaries",
      "Basic blocks start at the first instruction, jump targets and after jumps; the CFG connects them with edges",
      "A dominates B if every path to B goes through A; a back edge to a dominator marks a loop",
      "SSA assigns every name once; phi functions merge values where control flow joins",
      "Phis go at (iterated) dominance frontiers; front ends often emit stack slots and let mem2reg build SSA",
    ],
    code: [
      {
        title: "Lowering to three-address code and building the CFG",
        variants: [{ lang: "python", code: `# Lowering: turn the tree into three-address code (TAC), a flat list of tiny instructions that
# each do ONE thing, like "t1 = n % 2". Then cut it into basic blocks and connect them into a
# control-flow graph (CFG). Optimizers work on this form, not on the tree.
import re


def read(text):
    tokens = re.findall(r"\\(|\\)|[^\\s()]+", text)

    def item(i):
        if tokens[i] != "(":
            return (int(tokens[i]) if tokens[i].isdigit() else tokens[i]), i + 1
        out, i = [], i + 1
        while tokens[i] != ")":
            x, i = item(i)
            out.append(x)
        return out, i + 1
    return item(0)[0]


class Lowerer:
    def __init__(self):
        self.code, self.temps, self.labels = [], 0, 0

    def temp(self):
        self.temps += 1
        return f"t{self.temps}"

    def label(self):
        self.labels += 1
        return f"L{self.labels}"

    def expr(self, e):
        """Emit code for e and return the name (or constant) holding its value."""
        if not isinstance(e, list):
            return e
        a, b = self.expr(e[1]), self.expr(e[2])
        t = self.temp()
        self.code.append(f"{t} = {a} {e[0]} {b}")
        return t

    def stmt(self, s):
        if s[0] in ("let", "set"):
            self.code.append(f"{s[1]} = {self.expr(s[2])}")
        elif s[0] == "return":
            self.code.append(f"return {self.expr(s[1])}")
        elif s[0] == "while":
            top, done = self.label(), self.label()
            self.code.append(f"{top}:")
            self.code.append(f"ifnot {self.expr(s[1])} goto {done}")
            for x in s[2:]:
                self.stmt(x)
            self.code += [f"goto {top}", f"{done}:"]
        elif s[0] == "if":
            k = s.index("else")
            other, done = self.label(), self.label()
            self.code.append(f"ifnot {self.expr(s[1])} goto {other}")
            for x in s[2:k]:
                self.stmt(x)
            self.code += [f"goto {done}", f"{other}:"]
            for x in s[k + 1:]:
                self.stmt(x)
            self.code.append(f"{done}:")


fn = read("""
(fn collatz (n)
  (let steps 0)
  (while (!= n 1)
    (if (== (% n 2) 0)
      (set n (/ n 2))
     else
      (set n (+ (* 3 n) 1)))
    (set steps (+ steps 1)))
  (return steps))
""")
low = Lowerer()
for s in fn[3:]:
    low.stmt(s)
print("three-address code:")
for line in low.code:
    print(("  " if line.endswith(":") else "      ") + line)

# Basic blocks: straight-line runs with one way in (the top) and one way out (the bottom).
# A new block starts at the first instruction, at every label, and right after every jump.
blocks, current = [], []
for line in low.code:
    if line.endswith(":") and current:
        blocks.append(current)
        current = []
    current.append(line)
    if line.startswith(("goto", "ifnot", "return")):
        blocks.append(current)
        current = []
if current:
    blocks.append(current)
names = {b[0][:-1]: f"B{i}" for i, b in enumerate(blocks) if b[0].endswith(":")}

succ = {}
for i, b in enumerate(blocks):
    last, out = b[-1], []
    if last.startswith("goto"):
        out = [names[last.split()[1]]]
    elif last.startswith("ifnot"):
        out = [f"B{i + 1}", names[last.split()[-1]]]  # falls through, or jumps
    elif not last.startswith("return") and i + 1 < len(blocks):
        out = [f"B{i + 1}"]
    succ[f"B{i}"] = out
pred = {f"B{i}": [p for p, ss in succ.items() if f"B{i}" in ss] for i in range(len(blocks))}

print(f"\\n{len(blocks)} basic blocks:")
for i, b in enumerate(blocks):
    body = "; ".join(x for x in b if not x.endswith(":"))
    print(f"  B{i}  preds {','.join(pred[f'B{i}']) or '-':<6} succs {','.join(succ[f'B{i}']) or '-':<6} {body}")


def run_tac(code, env):
    """Interpret the TAC directly, to check that lowering kept the meaning."""
    labels = {line[:-1]: i for i, line in enumerate(code) if line.endswith(":")}
    pc = 0
    val = lambda x: env[x] if x in env else int(x)
    ops = {"+": int.__add__, "-": int.__sub__, "*": int.__mul__, "/": int.__floordiv__, "%": int.__mod__,
           "==": int.__eq__, "!=": int.__ne__, "<": int.__lt__}
    while True:
        parts = code[pc].split()
        pc += 1
        if parts[0] == "return":
            return val(parts[1])
        if parts[0] == "goto":
            pc = labels[parts[1]]
        elif parts[0] == "ifnot":
            if not val(parts[1]):
                pc = labels[parts[3]]
        elif len(parts) == 5:
            env[parts[0]] = ops[parts[3]](val(parts[2]), val(parts[4]))
        elif len(parts) == 3:
            env[parts[0]] = val(parts[2])


print("\\ncollatz(27) takes", run_tac(low.code, {"n": 27}), "steps")` }],
        explain: `- \`Lowerer.expr\` is a post-order walk: lower the operands first, then emit one instruction into a fresh temporary and return its name. \`(+ (* 3 n) 1)\` gives \`t5 = 3 * n\` and \`t6 = t5 + 1\`.
- \`while\` lowers to a label at the top, a conditional exit (\`ifnot t1 goto L2\`), the body and a \`goto\` back. \`if\` uses two labels. No nesting remains.
- The block-splitting loop applies the leader rules: a label starts a block, a jump or return ends one. B5 has **two predecessors** (B3, B4): the merge after the \`if\`. B1 has two as well: the entry and the back edge from B5.
- \`run_tac\` interprets the TAC to check that lowering kept the meaning: collatz(27) needs 111 steps, the known answer. Testing each transformation like this is how compiler writers stay sane.`,
        output: `three-address code:
      steps = 0
  L1:
      t1 = n != 1
      ifnot t1 goto L2
      t2 = n % 2
      t3 = t2 == 0
      ifnot t3 goto L3
      t4 = n / 2
      n = t4
      goto L4
  L3:
      t5 = 3 * n
      t6 = t5 + 1
      n = t6
  L4:
      t7 = steps + 1
      steps = t7
      goto L1
  L2:
      return steps

7 basic blocks:
  B0  preds -      succs B1     steps = 0
  B1  preds B0,B5  succs B2,B6  t1 = n != 1; ifnot t1 goto L2
  B2  preds B1     succs B3,B4  t2 = n % 2; t3 = t2 == 0; ifnot t3 goto L3
  B3  preds B2     succs B5     t4 = n / 2; n = t4; goto L4
  B4  preds B2     succs B5     t5 = 3 * n; t6 = t5 + 1; n = t6
  B5  preds B3,B4  succs B1     t7 = steps + 1; steps = t7; goto L1
  B6  preds B1     succs -      return steps

collatz(27) takes 111 steps`,
      },
      {
        title: "Building SSA: dominators, frontiers, phis, renaming",
        variants: [{ lang: "python", code: `# SSA (static single assignment): every variable is assigned exactly once. Where control flow
# merges, a phi function picks the version that came in along the edge we arrived by.
# This is the CFG of collatz from the previous sample; we convert it the classic way (Cytron et al.):
# dominators -> dominance frontiers -> where to put phis -> rename.
blocks = {
    "B0": ["steps = 0"],
    "B1": ["t1 = n != 1", "ifnot t1 goto B6"],
    "B2": ["t2 = n % 2", "t3 = t2 == 0", "ifnot t3 goto B4"],
    "B3": ["n = n / 2", "goto B5"],
    "B4": ["t5 = 3 * n", "n = t5 + 1"],
    "B5": ["steps = steps + 1", "goto B1"],
    "B6": ["return steps"],
}
succ = {"B0": ["B1"], "B1": ["B2", "B6"], "B2": ["B3", "B4"], "B3": ["B5"], "B4": ["B5"], "B5": ["B1"], "B6": []}
pred = {b: [p for p in blocks if b in succ[p]] for b in blocks}
VARS = {"n", "steps"}          # the variables assigned more than once (temporaries already are SSA)
order = list(blocks)

# 1. Dominators: A dominates B if every path from the entry to B goes through A.
dom = {b: set(order) for b in order}
dom["B0"] = {"B0"}
changed = True
while changed:
    changed = False
    for b in order[1:]:
        new = {b} | set.intersection(*(dom[p] for p in pred[b]))
        if new != dom[b]:
            dom[b], changed = new, True
idom = {b: max(dom[b] - {b}, key=lambda d: len(dom[d])) for b in order[1:]}  # the closest dominator
print("immediate dominators:", ", ".join(f"{b}<-{idom[b]}" for b in order[1:]))

# 2. Dominance frontier: where a block's dominance ENDS, i.e. the merge points it reaches.
df = {b: set() for b in order}
for b in order:
    if len(pred[b]) >= 2:
        for p in pred[b]:
            runner = p
            while runner != idom[b]:
                df[runner].add(b)
                runner = idom[runner]
print("dominance frontiers: ", ", ".join(f"{b}:{{{','.join(sorted(df[b]))}}}" for b in order if df[b]))

# 3. Phis: a variable defined in block X needs a phi in every block of X's frontier (iterated).
defs = {v: {b for b in order for ins in blocks[b] if ins.split()[0] == v} | ({"B0"} if v == "n" else set()) for v in VARS}
phis = {b: [] for b in order}
for v in sorted(VARS):
    work = list(defs[v])
    while work:
        x = work.pop()
        for y in sorted(df[x]):
            if v not in phis[y]:
                phis[y].append(v)
                if y not in defs[v]:
                    work.append(y)
print("phis needed:         ", ", ".join(f"{v} in {b}" for b in order for v in phis[b]))

# 4. Rename: walk the dominator tree, keeping a stack of the current version of each variable.
counter = {v: 0 for v in VARS}
stack = {v: ["n0"] if v == "n" else [] for v in VARS}  # n0 is the incoming parameter
phi_args = {(b, v): {} for b in order for v in phis[b]}
phi_names, out = {}, {b: [] for b in order}
children = {b: [c for c in order[1:] if idom[c] == b] for b in order}


def fresh(v):
    counter[v] += 1
    stack[v].append(f"{v}{counter[v]}")
    return stack[v][-1]


def rename(b):
    pushed = []
    for v in phis[b]:
        phi_names[b, v] = fresh(v)
        pushed.append(v)
    for ins in blocks[b]:
        words = ins.split()
        words = [w if i == 0 and len(words) > 1 and words[1] == "=" else (stack[w][-1] if w in VARS else w)
                 for i, w in enumerate(words)]
        if len(words) > 1 and words[1] == "=" and words[0] in VARS:
            words[0] = fresh(words[0])
            pushed.append(ins.split()[0])
        out[b].append(" ".join(words))
    for s in succ[b]:
        for v in phis[s]:
            phi_args[s, v][b] = stack[v][-1]
    for c in children[b]:
        rename(c)
    for v in pushed:
        stack[v].pop()


rename("B0")
print("\\nSSA form:")
for b in order:
    print(f"  {b}:")
    for v in phis[b]:
        args = ", ".join(f"{phi_args[b, v][p]} from {p}" for p in pred[b])
        print(f"      {phi_names[b, v]} = phi({args})")
    for ins in out[b]:
        print(f"      {ins}")` }],
        explain: `- **Dominators** come from the fixed-point equation; the immediate dominator is the strict dominator with the biggest dominator set (the closest one). B5's is B2: every path to B5 passes through B2, but not necessarily through B3 or B4.
- **Dominance frontiers**: for each merge block with 2+ predecessors, walk up from each predecessor until reaching the merge block's immediate dominator. B3 and B4 have frontier {B5}; B5 (and through it B1, B2) have {B1}, because of the back edge.
- **Phi placement**: \`n\` is assigned in B3 and B4, so it needs a phi in B5; that phi assigns \`n\` too, so B5's frontier B1 needs another. \`steps\` is assigned in B0 and B5, giving a phi in B1.
- **Renaming** walks the dominator tree with a stack per variable. After B3 pushes \`n2\`, B5's phi argument from B3 is \`n2\`; after returning, \`n2\` is popped so B4 sees \`n1\` again.
- Read the result: every name is assigned once, \`n1 = phi(n0 from B0, n4 from B5)\` merges the parameter with the loop's new value, and \`return steps2\` uses the header's version.`,
        output: `immediate dominators: B1<-B0, B2<-B1, B3<-B2, B4<-B2, B5<-B2, B6<-B1
dominance frontiers:  B1:{B1}, B2:{B1}, B3:{B5}, B4:{B5}, B5:{B1}
phis needed:          n in B1, steps in B1, n in B5

SSA form:
  B0:
      steps1 = 0
  B1:
      n1 = phi(n0 from B0, n4 from B5)
      steps2 = phi(steps1 from B0, steps3 from B5)
      t1 = n1 != 1
      ifnot t1 goto B6
  B2:
      t2 = n1 % 2
      t3 = t2 == 0
      ifnot t3 goto B4
  B3:
      n2 = n1 / 2
      goto B5
  B4:
      t5 = 3 * n1
      n3 = t5 + 1
  B5:
      n4 = phi(n2 from B3, n3 from B4)
      steps3 = steps2 + 1
      goto B1
  B6:
      return steps2`,
      },
    ],
    interview: [
      {
        q: "What is SSA form and why do compilers use it?",
        freq: "very-common",
        a: `**Static single assignment**: each variable is assigned exactly once in the program text; re-assignments create new versions (\`x1\`, \`x2\`), and **φ functions** at control-flow merge points select the version from the incoming edge. Benefits: each use has exactly **one reaching definition**, so def-use chains are explicit and sparse; many optimizations become simple and fast (constant propagation, dead code elimination, GVN, register allocation hints); and it separates distinct values that happened to share a name. LLVM, GCC (GIMPLE SSA), HotSpot, V8, Go and Swift all use SSA.`,
      },
      {
        q: "What is a basic block and how do you build a control-flow graph?",
        freq: "common",
        a: `A basic block is a maximal sequence of instructions with a single entry (the first instruction) and a single exit (the last): no jumps into the middle, no jumps out except at the end. Build: find **leaders** (the first instruction, every jump target, every instruction following a jump or branch), make each leader start a block running up to the next leader, then add edges from each block to its jump targets and, if it can fall through, to the next block. The CFG is the basis for data-flow analysis, loop detection and code layout.`,
      },
      {
        q: "What's a dominator? How are dominators used?",
        freq: "common",
        a: `Node A **dominates** B if every path from the entry to B passes through A. The **immediate** dominator is the closest strict dominator; these form the **dominator tree**. Uses: **loop detection** (a back edge is an edge whose target dominates its source; that target is the loop header), **SSA construction** (phis go at dominance frontiers; renaming walks the dominator tree), safe code motion (hoisting a computation into a block that dominates all its uses), and many optimizations' legality checks. Computed by iterative data flow or the faster Lengauer–Tarjan / Cooper–Harvey–Kennedy algorithms.`,
      },
      {
        q: "What is a φ (phi) function, and how is it removed before code generation?",
        freq: "common",
        a: `A pseudo-instruction at the start of a merge block, \`x3 = φ(x1 from B1, x2 from B2)\`, meaning "x3 gets x1 if we came from B1, x2 if from B2". It has no machine equivalent. **Out-of-SSA** translation replaces it with **copies** at the end of each predecessor (\`x3 = x1\` in B1, \`x3 = x2\` in B2), splitting **critical edges** (from a block with several successors to one with several predecessors) where needed, and handling parallel-copy semantics to avoid the lost-copy and swap problems. Register coalescing then eliminates most copies by giving the related names the same register.`,
      },
      {
        q: "Why do front ends like Clang emit allocas instead of building SSA directly?",
        freq: "occasional",
        a: `Building correct SSA requires dominance frontiers and renaming, which is fiddly in a front end that walks the AST in one pass. Instead, emit each local variable as a **stack slot** (\`alloca\`) with explicit \`load\` and \`store\`: trivially correct, no phis. LLVM's **mem2reg** (SROA) pass then promotes those slots to SSA registers, inserting phis with the standard algorithm. The front end stays simple, and all languages share one well-tested SSA builder. (An alternative is Braun et al.'s simple on-the-fly SSA construction, used by some JITs and Cranelift's front end.)`,
      },
      {
        q: "What's the difference between an AST and an IR like three-address code?",
        freq: "occasional",
        a: `The AST is **hierarchical** and close to the source: nested expressions, structured statements, language-specific node kinds. TAC is **linear** and close to the machine: one operation per instruction, explicit temporaries for every intermediate value, explicit jumps and labels for control flow, and a small fixed instruction set shared by all source constructs. TAC makes data flow and control flow explicit, so analyses and optimizations can be written once, generically.`,
      },
    ],
    quiz: [
      {
        q: "How many operators can one three-address-code instruction have?",
        options: ["None", "At most one", "At most three", "Any number"],
        answer: 1,
        explain: "x = y op z: one operation, up to three addresses. `3 * n + 1` takes two instructions.",
      },
      {
        q: "Which of these starts a new basic block?",
        options: [
          "Every assignment",
          "A jump target (label), or the instruction right after a jump",
          "Every function call",
          "Every 10 instructions",
        ],
        answer: 1,
        explain: "Those are the leader rules (plus the very first instruction).",
      },
      {
        q: "In collatz's CFG, why does B5 have two predecessors?",
        options: [
          "It's the loop header",
          "Both branches of the if (halve, or 3n + 1) continue into it",
          "It's the entry block",
          "Because of the return",
        ],
        answer: 1,
        explain: "B5 is where the if/else merges, which is exactly where SSA needs a phi for n.",
      },
      {
        q: "What does 'A dominates B' mean?",
        options: [
          "A comes before B in the code",
          "Every path from the entry to B passes through A",
          "A calls B",
          "A has more instructions than B",
        ],
        answer: 1,
        explain: "Dominance is about all paths, which is why it's the right tool for finding loops and placing phis.",
      },
      {
        q: "An edge B5 → B1 where B1 dominates B5 is...",
        options: ["A critical edge", "A back edge, marking a loop with header B1", "Dead code", "A function call"],
        answer: 1,
        explain: "Jumping back to a block that dominates you means you're going round a loop.",
      },
      {
        q: "In SSA, what does `n4 = phi(n2 from B3, n3 from B4)` mean?",
        options: [
          "n4 is the sum of n2 and n3",
          "n4 is n2 if control came from B3, and n3 if it came from B4",
          "n4 is whichever is larger",
          "Both assignments happen",
        ],
        answer: 1,
        explain: "A phi selects the value from the edge actually taken into the block.",
      },
      {
        q: "Why does SSA make constant propagation easy?",
        options: [
          "It removes all variables",
          "Each name has exactly one definition, so if that definition is a constant, every use is that constant",
          "It runs the program",
          "SSA forbids constants",
        ],
        answer: 1,
        explain: "No need to ask which of several assignments reaches a use: there's only one.",
      },
      {
        q: "Where does the classic algorithm place phi functions for a variable assigned in block X?",
        options: ["In X", "In X's dominance frontier (iterated)", "In the entry block", "After every use"],
        answer: 1,
        explain: "The frontier is where X's influence first merges with other paths.",
      },
    ],
  },

  // ------------------------------------------------------------------ OPTIMIZATION
  {
    id: "comp-optimization",
    title: "Optimization: making code faster without changing it",
    tagline: "The as-if rule, constant folding and propagation, algebraic simplification and strength reduction, common subexpressions and value numbering, copy propagation, dead code, inlining, loop optimizations, data-flow analysis and liveness, and how undefined behaviour feeds the optimizer.",
    difficulty: "advanced",
    minutes: 50,
    visualizers: ["optimizer"],
    concept: `## Explain it like I'm 10 🧸
Imagine your teacher gives you homework: "Work out 4 × 2, then add 0, then multiply x by that, then do it again, then add the two answers." A clever student notices: 4 × 2 is just 8, adding 0 does nothing, and why work out the same thing twice? They write down far fewer steps and get **exactly the same answer**.

An **optimizer** is that clever student. It looks at the compiler's recipe of tiny steps and removes the pointless ones, merges repeated ones, and replaces slow steps with fast ones. The golden rule: the answer must **never** change. Faster but wrong is useless.

## The as-if rule
An optimizer may transform the program in any way, **as long as its observable behaviour is the same**: the same output, the same side effects, in the same order. That's the **as-if rule** (C and C++ spell it out). It's why the compiler may delete a loop whose result is never used, but never a loop that prints.

Optimizations work at different **scopes**:
- **local**: inside one basic block;
- **global** (intraprocedural): across a whole function's CFG;
- **interprocedural**: across functions (inlining, constant arguments, dead functions); **link-time optimization** (LTO) does this across files.

## The classic passes
Each pass is small; run them together, **repeatedly**, until nothing changes (the first sample shrinks 12 instructions to 6):
| Pass | Before | After |
|---|---|---|
| **Constant folding** | \`b = 4 * 2\` | \`b = 8\` |
| **Constant propagation** | \`a = 4; b = a * 2\` | \`b = 4 * 2\` (then fold) |
| **Algebraic simplification** | \`c = b + 0\`, \`x * 1\` | \`c = b\` |
| **Strength reduction** | \`y * 2\`, \`i * 8\` | \`y + y\`, \`i << 3\` |
| **Common subexpression elimination** | \`d = x * c; e = x * c\` | \`e = d\` |
| **Copy propagation** | \`h = c; r = f + h\` | \`r = f + c\` |
| **Dead code elimination** | \`unused = f - 1\` (never read) | (gone) |
| **Unreachable code elimination** | code after \`return\`, \`if false { }\` | (gone) |

Passes **enable** each other: propagation creates folding opportunities, folding creates dead code, deleting dead code exposes more copies. Choosing the order (the **phase-ordering problem**) is a real art; compilers run some passes several times.

## Value numbering and GVN
CSE needs to know when two computations are **the same value**. **Value numbering** gives each distinct computation a number: \`x * c\` and \`c * x\` (commutative) get the same number, so the second can reuse the first. **Global value numbering** (GVN) does it across the whole function using SSA, where names never change meaning.

## Data-flow analysis
Many optimizations need facts about **all paths** through the CFG. The **data-flow framework** computes them:
- each block has **IN** and **OUT** sets;
- a **transfer function** says how a block changes the facts;
- a **meet** combines facts where paths join (union for "may", intersection for "must");
- iterate until nothing changes: a **fixed point**. Termination is guaranteed because the sets only grow (or shrink) within a finite **lattice**.

| Analysis | Direction | Question | Used for |
|---|---|---|---|
| **Liveness** | backward | will this variable be read later? | dead code, register allocation |
| **Reaching definitions** | forward | which assignments might reach here? | constant propagation (without SSA) |
| **Available expressions** | forward | has this been computed on every path? | global CSE |
| **Very busy expressions** | backward | will this be computed on every path? | code hoisting |

The liveness equations, solved in the second sample:
\`\`\`text
live_out[B] = ∪ live_in[S]  for every successor S
live_in[B]  = use[B] ∪ (live_out[B] − def[B])
\`\`\`

## Inlining: the most important optimization
**Inlining** replaces a call with the body of the called function. It saves the call overhead, but the real win is that it **exposes everything else**: constants flow into the body, branches fold, the callee's work combines with the caller's. Most other optimizations are local to a function, so inlining is what lets them see more. The cost is **code size**, so compilers use heuristics: always inline tiny functions, never inline huge or recursive ones, prefer hot call sites.

## Loop optimizations
Programs spend most of their time in loops, so loops get special attention:
- **Loop-invariant code motion** (LICM): move computations that don't change inside the loop to before it.
- **Induction variable** optimization: \`a[i]\` computed as \`base + i * 8\` becomes a pointer that's incremented by 8 (strength reduction in loops).
- **Unrolling**: do 4 iterations per trip to save branches and expose parallelism.
- **Vectorization**: use SIMD instructions to process 4, 8 or 16 elements per instruction.
- **Closed forms**: clang turns \`for (i = 1; i <= n; i++) s += i\` into the formula \`n(n+1)/2\`, as you saw in Part 1.
- **Tail-call elimination**: a recursive call in tail position becomes a jump, so recursion runs in constant stack space.

## Undefined behaviour and the optimizer
C and C++ say some operations (signed overflow, dereferencing null, reading uninitialised memory, out-of-bounds access) are **undefined behaviour**: the program has no meaning if they happen. Optimizers **assume they never happen**, which unlocks optimizations:
- \`x + 1 > x\` folds to \`true\` for signed \`int\` (overflow "can't happen");
- after \`*p = 1\`, a later check \`if (p == NULL)\` can be deleted.

This is also why buggy C code can behave very differently at \`-O0\` and \`-O2\`. Safe languages (Rust, Java, Python) define these cases, trading a little speed for predictability.

## Optimization levels
- \`-O0\`: no optimization; fastest compile, easiest debugging (every variable in memory).
- \`-O1\`: cheap, safe optimizations.
- \`-O2\`: almost everything that doesn't trade size for speed: the usual release setting.
- \`-O3\`: more aggressive inlining, unrolling and vectorization; sometimes bigger and not always faster.
- \`-Os\` / \`-Oz\`: optimize for size.

A wonderful way to learn: paste small functions into **Compiler Explorer** (godbolt.org) and watch what each compiler and level produces.`,
    keyPoints: [
      "The as-if rule: any transformation is allowed if observable behaviour stays the same",
      "Classic passes: constant folding and propagation, algebraic simplification, strength reduction, CSE, copy propagation, dead code elimination",
      "Passes enable each other, so compilers iterate them; ordering matters",
      "Data-flow analyses (liveness, reaching definitions, available expressions) iterate IN/OUT equations to a fixed point",
      "Inlining is the most important optimization because it exposes the callee to all the others",
      "Loops get LICM, induction variable optimization, unrolling and vectorization; C/C++ optimizers assume undefined behaviour never happens",
    ],
    code: [
      {
        title: "Five optimization passes, run to a fixed point",
        variants: [{ lang: "python", code: `# Classic optimisation passes on three-address code, run until nothing changes.
# Each pass is small and simple; together they shrink the code a lot. Real compilers run dozens.
import random

code = [
    "a = 4",
    "b = a * 2",          # constant folding: 4 * 2 is known at compile time
    "c = b + 0",          # algebraic identity: x + 0 is x
    "d = x * c",
    "e = x * c",          # common subexpression: same as d
    "f = d + e",
    "g = y * 2",          # strength reduction: a multiply by 2 is a cheaper add
    "unused = f - 1",     # dead code: nobody reads 'unused'
    "h = c",              # copy: uses of h can use c directly
    "r = f + h",
    "r2 = r + g",
    "return r2",
]


def parse(ins):
    """'d = x * c' -> ('d', ['x', '*', 'c'])"""
    lhs, rhs = ins.split(" = ") if " = " in ins else (None, ins)
    return lhs, rhs.split()


def is_const(x):
    return x.lstrip("-").isdigit()


def constant_fold(code):
    known, out = {}, []
    for ins in code:
        lhs, rhs = parse(ins)
        rhs = [known.get(w, w) for w in rhs]  # constant propagation: replace known names by values
        if len(rhs) == 3 and is_const(rhs[0]) and is_const(rhs[2]):
            a, op, b = int(rhs[0]), rhs[1], int(rhs[2])
            rhs = [str({"+": a + b, "-": a - b, "*": a * b}[op])]
        if lhs and len(rhs) == 1 and is_const(rhs[0]):
            known[lhs] = rhs[0]
        out.append(f"{lhs} = {' '.join(rhs)}" if lhs else " ".join(rhs))
    return out


def algebraic(code):
    out = []
    for ins in code:
        lhs, rhs = parse(ins)
        if len(rhs) == 3:
            a, op, b = rhs
            if (op in "+-" and b == "0") or (op == "*" and b == "1"):
                rhs = [a]
            elif op == "*" and b == "2":
                rhs = [a, "+", a]  # strength reduction
            elif op == "*" and "0" in (a, b):
                rhs = ["0"]
        out.append(f"{lhs} = {' '.join(rhs)}" if lhs else " ".join(rhs))
    return out


def copy_propagate(code):
    copies, out = {}, []
    for ins in code:
        lhs, rhs = parse(ins)
        rhs = [copies.get(w, w) for w in rhs]
        if lhs and len(rhs) == 1 and not is_const(rhs[0]):
            copies[lhs] = rhs[0]
        out.append(f"{lhs} = {' '.join(rhs)}" if lhs else " ".join(rhs))
    return out


def cse(code):
    """Local value numbering: if the same expression was computed before, reuse that name."""
    seen, out = {}, []
    for ins in code:
        lhs, rhs = parse(ins)
        key = tuple(rhs)
        if len(rhs) == 3 and rhs[1] in "+*":  # commutative: x * c is the same as c * x
            key = (min(rhs[0], rhs[2]), rhs[1], max(rhs[0], rhs[2]))
        if lhs and len(rhs) == 3 and key in seen:
            rhs = [seen[key]]
        elif lhs and len(rhs) == 3:
            seen[key] = lhs
        out.append(f"{lhs} = {' '.join(rhs)}" if lhs else " ".join(rhs))
    return out


def dead_code(code):
    """Walk backwards; keep an instruction only if something later needs what it computes."""
    live, out = set(), []
    for ins in reversed(code):
        lhs, rhs = parse(ins)
        if lhs is None or lhs in live:
            out.append(ins)
            live.discard(lhs)
            live |= {w for w in rhs if w.isidentifier() and w != "return"}
    return out[::-1]


def run(code, x, y):
    env = {"x": x, "y": y}
    for ins in code:
        lhs, rhs = parse(ins)
        vals = [str(env.get(w, w)) for w in rhs]
        if rhs[0] == "return":
            return env.get(rhs[1], rhs[1])
        env[lhs] = eval(" ".join(vals))  # fine here: our own tiny instructions


passes = [("constant folding + propagation", constant_fold), ("algebraic simplification", algebraic),
          ("copy propagation", copy_propagate), ("common subexpressions", cse), ("dead code elimination", dead_code)]
current, round_ = code, 0
print(f"before: {len(code)} instructions")
while True:
    round_ += 1
    before = current
    for name, p in passes:
        new = p(current)
        if new != current:
            print(f"round {round_}, {name}:")
            if len(new) == len(current):
                for old_ins, new_ins in zip(current, new):
                    if old_ins != new_ins:
                        print(f"    {old_ins:<16} => {new_ins}")
            else:
                for gone in [i for i in current if i not in new]:
                    print(f"    {gone:<16} => (deleted)")
        current = new
    if current == before:
        break
print(f"after: {len(current)} instructions")
for ins in current:
    print("    " + ins)

rng = random.Random(1)
same = all(run(code, x, y) == run(current, x, y) for x, y in ((rng.randint(-99, 99), rng.randint(-99, 99)) for _ in range(1000)))
print("same result as the original for 1000 random inputs:", same)` }],
        explain: `- \`constant_fold\` does propagation and folding together in one forward walk: once \`a\` is known to be 4, \`a * 2\` becomes \`4 * 2\` and folds to 8, which makes \`b\` known, and so on down the list.
- \`algebraic\` applies identities (\`x + 0\`, \`x * 1\`, \`x * 0\`) and **strength reduction** (\`y * 2\` → \`y + y\`).
- \`cse\` is **local value numbering**: \`e = x * 8\` computes the same thing as \`d\`, so it becomes the copy \`e = d\`. The key is sorted for \`+\` and \`*\` because they're commutative.
- \`dead_code\` walks **backwards** with a live set, keeping only instructions whose result is needed later (or that have effects, like \`return\`). That's liveness analysis inside one block.
- Round 2 shows passes enabling each other: the copy \`e = d\` (made by CSE) is propagated, which makes \`e\` dead.
- The last line is a **randomised equivalence check**: 1000 random inputs give the same result before and after. Compiler teams test optimizers this way (and with real programs, and with formal tools like Alive2).`,
        output: `before: 12 instructions
round 1, constant folding + propagation:
    b = a * 2        => b = 8
    c = b + 0        => c = 8
    d = x * c        => d = x * 8
    e = x * c        => e = x * 8
    h = c            => h = 8
    r = f + h        => r = f + 8
round 1, algebraic simplification:
    g = y * 2        => g = y + y
round 1, common subexpressions:
    e = x * 8        => e = d
round 1, dead code elimination:
    a = 4            => (deleted)
    b = 8            => (deleted)
    c = 8            => (deleted)
    unused = f - 1   => (deleted)
    h = 8            => (deleted)
round 2, copy propagation:
    f = d + e        => f = d + d
round 2, dead code elimination:
    e = d            => (deleted)
after: 6 instructions
    d = x * 8
    f = d + d
    g = y + y
    r = f + 8
    r2 = r + g
    return r2
same result as the original for 1000 random inputs: True`,
      },
      {
        title: "Liveness analysis on a CFG",
        variants: [{ lang: "python", code: `# Dataflow analysis: which variables are LIVE (still needed later) at each point of the program?
# Register allocation and dead-code elimination both depend on it. The CFG is collatz again.
blocks = {
    "B0": ["steps = 0"],
    "B1": ["t1 = n != 1", "ifnot t1"],
    "B2": ["t2 = n % 2", "t3 = t2 == 0", "ifnot t3"],
    "B3": ["n = n / 2"],
    "B4": ["t5 = 3 * n", "n = t5 + 1"],
    "B5": ["steps = steps + 1"],
    "B6": ["return steps"],
}
succ = {"B0": ["B1"], "B1": ["B2", "B6"], "B2": ["B3", "B4"], "B3": ["B5"], "B4": ["B5"], "B5": ["B1"], "B6": []}


def names(words):
    return {w for w in words if w.isidentifier() and w not in ("ifnot", "return")}


# use[B]: read in B before being written in B.   defs[B]: written in B.
use, defs = {}, {}
for b, code in blocks.items():
    use[b], defs[b] = set(), set()
    for ins in code:
        lhs, _, rhs = ins.partition(" = ") if " = " in ins else ("", "", ins)
        use[b] |= names(rhs.split()) - defs[b]
        if lhs:
            defs[b].add(lhs)

# The equations, solved by repeating until nothing changes (a backward analysis):
#   live_out[B] = union of live_in[S] for every successor S
#   live_in[B]  = use[B] + (live_out[B] - defs[B])
live_in = {b: set() for b in blocks}
live_out = {b: set() for b in blocks}
rounds = 0
while True:
    rounds += 1
    changed = False
    for b in reversed(list(blocks)):  # backwards order converges faster for a backward problem
        out = set().union(*(live_in[s] for s in succ[b]))
        inn = use[b] | (out - defs[b])
        if (inn, out) != (live_in[b], live_out[b]):
            live_in[b], live_out[b], changed = inn, out, True
    if not changed:
        break

fmt = lambda s: "{" + ", ".join(sorted(s)) + "}"
print(f"{'block':<6}{'use':<12}{'def':<16}{'live in':<16}live out")
for b in blocks:
    print(f"{b:<6}{fmt(use[b]):<12}{fmt(defs[b]):<16}{fmt(live_in[b]):<16}{fmt(live_out[b])}")
print(f"solved in {rounds} rounds")

# Instruction by instruction inside one block, walking backwards from its live-out set:
b = "B4"
live = set(live_out[b])
print(f"\\ninside {b}, bottom to top (live after each instruction):")
for ins in reversed(blocks[b]):
    print(f"  {ins:<14} live after: {fmt(live)}")
    lhs, _, rhs = ins.partition(" = ")
    live = (live - {lhs}) | names(rhs.split())
print(f"  {'(top)':<14} live before: {fmt(live)}")
print("t5 is live for one instruction only, so it can share a register with almost anything.")` }],
        explain: `- \`use[B]\` holds variables read **before** being written in B; \`defs[B]\` those written in B. In B4, \`n\` is read (by \`t5 = 3 * n\`) before being written, so it's in both.
- The two equations are applied to every block, in **reverse** order (it's a backward problem, so information flows from successors), until nothing changes: 3 rounds.
- Read the result: \`n\` and \`steps\` are live almost everywhere (the loop keeps needing them). At B6 only \`steps\` is live: \`n\` is dead once the loop ends.
- Inside B4, walking backwards shows \`t5\` is live for exactly one instruction. A register allocator can give \`t5\` the same register as any variable that isn't live at that moment. That's next part's topic.`,
        output: `block use         def             live in         live out
B0    {}          {steps}         {n}             {n, steps}
B1    {n}         {t1}            {n, steps}      {n, steps}
B2    {n}         {t2, t3}        {n, steps}      {n, steps}
B3    {n}         {n}             {n, steps}      {n, steps}
B4    {n}         {n, t5}         {n, steps}      {n, steps}
B5    {steps}     {steps}         {n, steps}      {n, steps}
B6    {steps}     {}              {steps}         {}
solved in 3 rounds

inside B4, bottom to top (live after each instruction):
  n = t5 + 1     live after: {n, steps}
  t5 = 3 * n     live after: {steps, t5}
  (top)          live before: {n, steps}
t5 is live for one instruction only, so it can share a register with almost anything.`,
      },
    ],
    interview: [
      {
        q: "Name some common compiler optimizations and explain what they do.",
        freq: "very-common",
        a: `- **Constant folding/propagation**: evaluate constant expressions at compile time and substitute known values.
- **Dead code elimination**: remove computations whose results are never used, and unreachable code.
- **Common subexpression elimination / GVN**: compute a repeated expression once.
- **Copy propagation**: replace uses of \`x\` after \`x = y\` with \`y\`.
- **Strength reduction**: replace expensive operations with cheaper ones (\`x * 8\` → \`x << 3\`, multiplications in loops by additions).
- **Inlining**: replace calls with the callee's body.
- **Loop-invariant code motion**, **unrolling**, **vectorization**.
- **Tail-call elimination**, **register allocation**, **instruction scheduling** in the back end.`,
      },
      {
        q: "Why is inlining considered the most important optimization?",
        freq: "common",
        a: `Directly it removes call overhead (argument moves, call/ret, prologue/epilogue, lost registers across calls). Much more importantly, it **enables other optimizations**: most passes are intraprocedural, so after inlining, constant arguments propagate into the body, branches on them fold, redundant work between caller and callee is shared, escape analysis can keep objects on the stack, and loops can be vectorised. Costs: code size growth (instruction cache pressure) and compile time, so compilers use cost models, profile data (hot call sites) and limits; recursive and very large functions aren't inlined.`,
      },
      {
        q: "What is liveness analysis and what is it used for?",
        freq: "common",
        a: `A **backward** data-flow analysis that computes, at each program point, which variables hold a value that **may be read later** before being overwritten. Equations: \`OUT[B] = ∪ IN[succ]\`, \`IN[B] = USE[B] ∪ (OUT[B] − DEF[B])\`, iterated to a fixed point. Uses: **register allocation** (two variables simultaneously live interfere and need different registers), **dead code elimination** (an assignment to a variable not live afterwards is dead), and warnings like "variable may be used uninitialised" (a variable live at the function entry).`,
      },
      {
        q: "How does data-flow analysis guarantee it terminates?",
        freq: "occasional",
        a: `The facts form a **lattice** of finite height (e.g., subsets of a finite set of variables), the transfer functions are **monotone** (more input facts never produce fewer output facts), and the iteration starts from the bottom (or top) element. Each iteration can only move values in one direction in the lattice, and a finite-height lattice allows only finitely many moves, so a **fixed point** is reached. Processing blocks in reverse postorder (forward problems) or postorder (backward) makes it converge in a few passes for typical CFGs.`,
      },
      {
        q: "How can undefined behaviour in C lead to surprising optimizations?",
        freq: "common",
        a: `The compiler assumes UB never happens and optimizes accordingly. Examples: \`if (x + 1 < x)\` (overflow check on signed int) is folded to false and removed; dereferencing a pointer then checking it for NULL lets the compiler delete the check; an infinite loop without side effects may be assumed to terminate (C++); out-of-bounds loop accesses can make the compiler assume the loop runs fewer times. Code that "worked" at -O0 breaks at -O2. Mitigations: sanitizers (\`-fsanitize=undefined,address\`), flags like \`-fwrapv\`, and writing checks that don't rely on UB (\`__builtin_add_overflow\`).`,
      },
      {
        q: "What does loop-invariant code motion do? When is it not safe?",
        freq: "occasional",
        a: `It moves computations whose operands don't change inside a loop to a **preheader** before the loop, so they run once instead of every iteration (\`len = strlen(s)\` in a loop condition, \`a * b\` with loop-invariant a and b). It's unsafe if the computation has **side effects**, can **trap** (division by a value that might be zero, a load from a pointer that's only valid if the loop runs) and the loop might not execute, or if a value it reads may be modified inside the loop (through aliasing pointers). Compilers prove safety with alias analysis or guard the hoisted code.`,
      },
    ],
    quiz: [
      {
        q: "What must every optimization preserve?",
        options: ["The number of instructions", "Observable behaviour: output, side effects and their order", "Variable names", "The original loop structure"],
        answer: 1,
        explain: "The as-if rule. Everything else (instruction count, names, structure) may change.",
      },
      {
        q: "Which pass turns `b = 4 * 2` into `b = 8`?",
        options: ["Dead code elimination", "Constant folding", "Copy propagation", "Inlining"],
        answer: 1,
        explain: "Folding evaluates operations whose operands are all known at compile time.",
      },
      {
        q: "Replacing `y * 2` with `y + y` (or `i * 8` with `i << 3`) is called...",
        options: ["Strength reduction", "Constant folding", "Vectorization", "Inlining"],
        answer: 0,
        explain: "Swapping an expensive operation for a cheaper equivalent one.",
      },
      {
        q: "In the sample, why does `e = x * 8` become `e = d`?",
        options: [
          "x is 8",
          "d already holds `x * 8`: common subexpression elimination reuses it",
          "e is dead",
          "Because of strength reduction",
        ],
        answer: 1,
        explain: "Value numbering spots the same operator applied to the same operands.",
      },
      {
        q: "Liveness is a backward analysis because...",
        options: [
          "It's computed after code generation",
          "Whether a variable is live depends on what happens LATER in the program",
          "Loops run backwards",
          "It starts at the entry block",
        ],
        answer: 1,
        explain: "Information flows from successors (future reads) to predecessors.",
      },
      {
        q: "Why is inlining so valuable beyond saving the call itself?",
        options: [
          "It makes code smaller",
          "It exposes the callee's code to the caller's context, so constants, folding and other passes can work across the old boundary",
          "It removes loops",
          "It speeds up compilation",
        ],
        answer: 1,
        explain: "Most passes only look inside one function; inlining widens their view.",
      },
      {
        q: "With signed ints in C, clang may fold `x + 1 > x` to `true`. Why is that allowed?",
        options: [
          "Because it's always mathematically true",
          "Signed overflow is undefined behaviour, so the optimizer may assume it never happens",
          "Because of the as-if rule alone",
          "It isn't allowed",
        ],
        answer: 1,
        explain: "With wrapping arithmetic, INT_MAX + 1 would be smaller; UB lets the compiler ignore that case.",
      },
      {
        q: "Why do compilers run optimization passes more than once?",
        options: [
          "To check for errors",
          "Passes enable each other: folding creates dead code, removing it exposes copies, and so on",
          "Each pass only works on half the code",
          "To warm the cache",
        ],
        answer: 1,
        explain: "The sample needed a second round: copy propagation after CSE made e dead.",
      },
    ],
  },

  // ------------------------------------------------------------------ LLVM
  {
    id: "comp-llvm",
    title: "LLVM: the compiler toolkit behind Clang, Rust and Swift",
    tagline: "LLVM IR from the inside: modules, functions, basic blocks, types, SSA values and phis; alloca, load and store; mem2reg; clang, opt, llc and lli; writing a front end that emits IR; and what -O2 really does to your code.",
    difficulty: "advanced",
    minutes: 45,
    diagram: {
      title: "One IR, many languages and CPUs",
      nodes: [
        { id: "c", label: "C / C++ / Objective-C", kind: "client", x: 120, y: 90, sub: "clang" },
        { id: "rust", label: "Rust", kind: "client", x: 120, y: 270, sub: "rustc" },
        { id: "other", label: "Swift, Zig, Julia, pebblec", kind: "client", x: 120, y: 450, sub: "any front end" },
        { id: "ir", label: "LLVM IR", kind: "queue", x: 340, y: 270, sub: ".ll text or .bc bitcode" },
        { id: "opt", label: "opt: the optimizer", kind: "model", x: 550, y: 270, sub: "mem2reg, inline, GVN, LICM, vectorize" },
        { id: "llc", label: "llc: the back end", kind: "gpu", x: 740, y: 270, sub: "instruction selection, registers" },
        { id: "x86", label: "x86-64", kind: "node", x: 900, y: 100, sub: "Intel, AMD" },
        { id: "arm", label: "ARM64", kind: "node", x: 900, y: 270, sub: "Apple silicon, phones, Graviton" },
        { id: "wasm", label: "WebAssembly", kind: "node", x: 900, y: 440, sub: "and RISC-V, GPUs, ..." },
      ],
      edges: [
        { from: "c", to: "ir", label: "front end" },
        { from: "rust", to: "ir", label: "front end" },
        { from: "other", to: "ir", label: "front end" },
        { from: "ir", to: "opt", label: "passes" },
        { from: "opt", to: "llc", label: "optimised IR" },
        { from: "llc", to: "x86", label: "target" },
        { from: "llc", to: "arm", label: "target" },
        { from: "llc", to: "wasm", label: "target" },
      ],
      flows: [
        {
          name: "clang -O2 hello.c on a Mac",
          path: ["c", "ir", "opt", "llc", "arm"],
          steps: [
            "Clang parses and type-checks C, then emits LLVM IR: every local as an alloca, very naive.",
            "The optimizer runs dozens of passes: mem2reg builds SSA, then inlining, GVN, loop passes...",
            "The back end selects ARM64 instructions, allocates registers and lays out the stack frame.",
            "Out comes an object file for Apple silicon, ready for the linker.",
          ],
        },
        {
          name: "pebblec compiles a Pebble program",
          path: ["other", "ir", "opt", "llc", "x86"],
          steps: [
            "Your compiler writes LLVM IR text: the only part you have to write.",
            "clang -O2 runs the same optimizer every C program gets.",
            "And the same back end.",
            "Native code for whatever machine you're on. Same IR, any CPU.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Imagine every country had to build its own airport **and** its own aeroplanes for every other country it wanted to fly to. Madness! Instead, everyone flies into **one big hub airport**, and the hub has planes to everywhere.

**LLVM** is that hub for programming languages. A language (C, Rust, Swift, your Pebble!) only needs to translate itself into **LLVM IR**, the hub's language. LLVM then makes the code fast and turns it into machine code for Intel, Apple, ARM phones, WebAssembly and more. Build one road into the hub, and you can reach every machine.

## What LLVM is
LLVM is a collection of compiler libraries and tools, started by Chris Lattner in 2000. Its center is **LLVM IR**, an SSA-based, typed, low-level language. Around it:
- **front ends** emit IR: Clang (C, C++, Objective-C), \`rustc\`, \`swiftc\`, Zig, Julia, Kotlin/Native, Flang (Fortran) and hundreds of hobby languages;
- the **optimizer** (\`opt\`) runs passes over IR;
- **back ends** (\`llc\`) generate code for x86-64, AArch64, ARM, RISC-V, WebAssembly, PowerPC, NVIDIA and AMD GPUs and more;
- plus a JIT (ORC), a linker (\`lld\`), a debugger (\`lldb\`), sanitizers and \`libc++\`.

## Reading LLVM IR
\`\`\`llvm
define i32 @square(i32 %x) {        ; a function: returns i32, takes one i32
entry:                                ; a basic block, named by its label
  %r = mul i32 %x, %x                 ; an SSA value: assigned once, never changed
  ret i32 %r                          ; every block ends with a terminator
}
\`\`\`
- A **module** (one \`.ll\` file) holds **globals** (\`@name\`), **function declarations** (\`declare i32 @printf(ptr, ...)\`) and **definitions**.
- **Local values** are \`%name\` (or numbered: \`%0\`, \`%1\`). Each is assigned **once**: LLVM IR is always in **SSA form**.
- Everything is **typed**: \`i1\` (a bool), \`i8\`, \`i32\`, \`i64\`, \`double\`, \`ptr\` (an opaque pointer), arrays \`[22 x i8]\`, structs \`{ i32, ptr }\`, vectors \`<4 x float>\`. There are no signed and unsigned **types**; instead the **operations** say it: \`sdiv\`/\`udiv\`, \`icmp slt\`/\`icmp ult\`.
- Functions are made of **basic blocks**; every block ends with exactly one **terminator**: \`br\`, \`ret\`, \`switch\`, \`unreachable\`. There's no fall-through: even "continue to the next block" is an explicit \`br\`.
- **phi** nodes merge values at the start of a block: \`%i = phi i32 [ 1, %entry ], [ %i.next, %body ]\`.
- Memory is explicit: \`alloca\` reserves a stack slot, \`load\` and \`store\` read and write it, \`getelementptr\` computes addresses inside arrays and structs.

## The alloca trick and mem2reg
Writing SSA directly from a front end is fiddly (you saw the algorithm last lesson). So front ends cheat: every local variable gets an \`alloca\` at the top of the function, every read is a \`load\` and every write a \`store\`. This is what \`clang -O0\` emits, and what pebblec emits. Then the **mem2reg** pass turns slots into SSA values and inserts the phis. Run on the sample's \`sum_to_alloca\`:
\`\`\`text
$ opt -passes=mem2reg -S sum.ll
define i32 @sum_to_alloca(i32 %n) {
entry:
  br label %cond
cond:
  %i.0 = phi i32 [ 1, %entry ], [ %iv.next, %body ]
  %total.0 = phi i32 [ 0, %entry ], [ %t.next, %body ]
  %done = icmp sgt i32 %i.0, %n
  br i1 %done, label %exit, label %body
body:
  %t.next = add i32 %total.0, %i.0
  %iv.next = add i32 %i.0, 1
  br label %cond
exit:
  ret i32 %total.0
}
\`\`\`
Exactly the hand-written phi version, every load and store gone. One rule makes this work: put **all allocas in the entry block**, so mem2reg can see them.

## The tools
| Command | What it does |
|---|---|
| \`clang -S -emit-llvm -O0 x.c\` | C to IR text (\`x.ll\`): see what a front end emits |
| \`clang x.ll -o x\` | IR straight to an executable (optimizer, back end, assembler, linker) |
| \`opt -passes=mem2reg -S x.ll\` | run chosen passes; \`opt -O2\` runs the standard pipeline |
| \`llc x.ll\` | IR to assembly for the host (or \`-mtriple=...\` for another target) |
| \`lli x.ll\` | run IR directly with LLVM's JIT |
| \`llvm-as\` / \`llvm-dis\` | text IR to and from binary **bitcode** (\`.bc\`) |
| \`opt -passes=verify\` | check the IR is well-formed (types, terminators, dominance) |

## What -O2 does to the collatz function
The second sample emits naive alloca-style IR for collatz. After \`opt -O2\`, the loop body becomes:
\`\`\`llvm
body2:
  %steps = phi i64 [ %t18, %body2 ], [ 0, %entry ]
  %n.cur = phi i64 [ %n.next, %body2 ], [ %n, %entry ]
  %0 = and i64 %n.cur, 1                ; n % 2 == 0  became a bit test
  %even = icmp eq i64 %0, 0
  %half = ashr exact i64 %n.cur, 1      ; n / 2       became a shift
  %t15 = mul i64 %n.cur, 3
  %t16 = add i64 %t15, 1
  %n.next = select i1 %even, i64 %half, i64 %t16   ; the if/else became a select: no branch
  %t18 = add i64 %steps, 1
  ...
\`\`\`
(names shortened). Look at what happened: **mem2reg** removed every load and store; **strength reduction** turned \`% 2\` into \`and\` and \`/ 2\` into a shift (\`exact\` because the number is known to be even); **if-conversion** replaced the whole \`if/else\` with a branch-free \`select\`; the loop test was **rotated** to the bottom. And in \`main\`, \`collatz(27)\` was **inlined** with the constant 27 flowing in. For \`sum.ll\`, \`-O2\` goes further: the loop runs at compile time, and \`main\` just prints the constant 5050.

## Writing a front end for LLVM
Your pebblec project does exactly this. The recipe:
1. Declare external functions you need (\`printf\`) and string constants (\`@.str = private constant [6 x i8] c"%lld\\0A\\00"\`: note the explicit length, including the terminating zero).
2. For each function: an \`entry:\` block holding all \`alloca\`s, then store each parameter into its slot.
3. Lower expressions to instructions returning SSA values (\`%t1 = add i64 %a, %b\`), statements to blocks and \`br\`s.
4. Make sure **every block ends in exactly one terminator**: after a \`return\` inside an \`if\`, start a new block for any code that follows; emit \`unreachable\` where control can't reach.
5. Hand the \`.ll\` file to \`clang\`.

You can also use the C++ API (\`IRBuilder\`), or bindings like \`llvmlite\` (Python) and \`inkwell\` (Rust), which build IR in memory instead of as text.

## LLVM's alternatives
- **GCC**: its own IRs (GENERIC, GIMPLE in SSA, RTL), also very mature.
- **Cranelift**: a fast-compiling code generator in Rust, used by Wasmtime and as an alternative \`rustc\` debug back end.
- **QBE**: a tiny back end ("70% of the performance in 10% of the code"), great for hobby compilers.
- **MLIR**: from the LLVM project, for building domain-specific IRs (machine learning, hardware).
- Or emit **C** and let a C compiler do the rest (Nim, early C++, many research languages).`,
    keyPoints: [
      "LLVM IR is a typed, SSA, low-level language; front ends emit it, opt optimises it, back ends turn it into machine code for many CPUs",
      "A module has globals (@), functions and declarations; functions are basic blocks that each end with one terminator",
      "Integer types have no sign; operations do (sdiv vs udiv, icmp slt vs ult)",
      "Front ends emit allocas, loads and stores; mem2reg promotes them to SSA values with phis. Keep allocas in the entry block",
      "Tools: clang -S -emit-llvm, opt, llc, lli, llvm-as/llvm-dis",
      "-O2 turned collatz's % and / into bit operations, the if/else into a select, and inlined it into main",
    ],
    code: [
      {
        title: "A complete program in LLVM IR",
        variants: [{ lang: "llvm", code: `; A complete program in LLVM IR. "clang sum.ll -o sum" turns it into a native program for YOUR CPU.
@fmt = private constant [22 x i8] c"%s: sum_to(100) = %d\\0A\\00"
@ssa_name = private constant [4 x i8] c"phi\\00"
@mem_name = private constant [7 x i8] c"alloca\\00"

declare i32 @printf(ptr, ...)

; 1 + 2 + ... + n, in SSA form. Each name (%i, %total) is assigned once; the phi nodes pick
; a value depending on which block we came from: the entry (first time) or the body (looping).
define i32 @sum_to(i32 %n) {
entry:
  br label %loop

loop:
  %i = phi i32 [ 1, %entry ], [ %i.next, %body ]
  %total = phi i32 [ 0, %entry ], [ %total.next, %body ]
  %done = icmp sgt i32 %i, %n            ; signed greater than
  br i1 %done, label %exit, label %body

body:
  %total.next = add i32 %total, %i
  %i.next = add i32 %i, 1
  br label %loop

exit:
  ret i32 %total
}

; The same function the way a front end usually emits it: every variable gets a stack slot
; (alloca) and is loaded and stored. No phis needed. The mem2reg pass turns this into the form above.
define i32 @sum_to_alloca(i32 %n) {
entry:
  %total = alloca i32
  %i = alloca i32
  store i32 0, ptr %total
  store i32 1, ptr %i
  br label %cond

cond:
  %iv = load i32, ptr %i
  %done = icmp sgt i32 %iv, %n
  br i1 %done, label %exit, label %body

body:
  %t = load i32, ptr %total
  %iv2 = load i32, ptr %i
  %t.next = add i32 %t, %iv2
  store i32 %t.next, ptr %total
  %iv.next = add i32 %iv2, 1
  store i32 %iv.next, ptr %i
  br label %cond

exit:
  %result = load i32, ptr %total
  ret i32 %result
}

define i32 @main() {
entry:
  %a = call i32 @sum_to(i32 100)
  %b = call i32 @sum_to_alloca(i32 100)
  %p1 = call i32 (ptr, ...) @printf(ptr @fmt, ptr @ssa_name, i32 %a)
  %p2 = call i32 (ptr, ...) @printf(ptr @fmt, ptr @mem_name, i32 %b)
  ret i32 0
}` }],
        explain: `- The string constant's type spells out its length: \`[22 x i8]\` is the 20 visible characters, the newline (\`\\0A\`) and the terminating zero (\`\\00\`). Get the length wrong and LLVM refuses the file.
- \`declare i32 @printf(ptr, ...)\` declares a C library function; the linker finds it in libc, exactly like \`U puts\` in Part 1.
- \`sum_to\` is hand-written SSA: \`%i\` and \`%total\` are defined by **phis** that choose between the start values (coming from \`entry\`) and the updated values (coming from \`body\`).
- \`sum_to_alloca\` is the same function as a front end would write it: two stack slots, loads and stores, no phis. Run \`opt -passes=mem2reg\` on it and you get the first version back (shown in the lesson).
- \`clang sum.ll -o sum\` does everything: optimise, generate code for your CPU, assemble, link. This file runs unchanged on an Intel Linux server and on an ARM Mac.`,
        output: `phi: sum_to(100) = 5050
alloca: sum_to(100) = 5050`,
      },
      {
        title: "A code generator that emits LLVM IR",
        variants: [{ lang: "python", code: `# A code generator that turns Pebble functions into LLVM IR text. Pipe its output into clang and
# you get a native executable:   python3 emit_llvm.py > out.ll && clang out.ll -o out && ./out
# Strategy: every variable gets a stack slot (alloca), exactly like clang -O0 does; LLVM's mem2reg
# pass later turns those slots into SSA registers with phis, so the front end stays simple.
import re


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


ARITH = {"+": "add", "-": "sub", "*": "mul", "/": "sdiv", "%": "srem"}
COMPARE = {"<": "slt", "<=": "sle", ">": "sgt", ">=": "sge", "==": "eq", "!=": "ne"}


class FunctionGen:
    def __init__(self, name, params):
        self.name, self.params = name, params
        self.lines, self.allocas, self.n, self.slots = [], [], 0, {}
        self.terminated = False  # a block must end with exactly one br or ret

    def tmp(self):
        self.n += 1
        return f"%t{self.n}"

    def new_label(self, hint):
        self.n += 1
        return f"{hint}{self.n}"

    def emit(self, line):
        if not self.terminated:
            self.lines.append("  " + line)
        self.terminated = line.startswith(("br ", "ret "))

    def start_block(self, label):
        if not self.terminated:  # fall into the new block explicitly: LLVM has no fall-through
            self.lines.append(f"  br label %{label}")
        self.lines.append(f"{label}:")
        self.terminated = False

    def slot(self, name):
        if name not in self.slots:
            self.slots[name] = f"%{name}.addr"
            self.allocas.append(f"  %{name}.addr = alloca i64")  # allocas go at the top of the entry block
        return self.slots[name]

    def expr(self, e):
        """Emit code for e; return (type, value)."""
        if isinstance(e, int):
            return "i64", str(e)
        if e in ("true", "false"):
            return "i1", "1" if e == "true" else "0"
        if isinstance(e, str):
            t = self.tmp()
            self.emit(f"{t} = load i64, ptr {self.slot(e)}")
            return "i64", t
        if e[0] == "call":
            args = ", ".join(f"i64 {self.expr(a)[1]}" for a in e[2:])
            t = self.tmp()
            self.emit(f"{t} = call i64 @{e[1]}({args})")
            return "i64", t
        (_, a), (_, b) = self.expr(e[1]), self.expr(e[2])
        t = self.tmp()
        if e[0] in ARITH:
            self.emit(f"{t} = {ARITH[e[0]]} i64 {a}, {b}")
            return "i64", t
        self.emit(f"{t} = icmp {COMPARE[e[0]]} i64 {a}, {b}")
        return "i1", t

    def stmt(self, s):
        op = s[0]
        if op in ("let", "set"):
            _, v = self.expr(s[2])
            self.emit(f"store i64 {v}, ptr {self.slot(s[1])}")
        elif op == "print":
            _, v = self.expr(s[1])
            t = self.tmp()
            self.emit(f"{t} = call i32 (ptr, ...) @printf(ptr @.fmt, i64 {v})")
        elif op == "return":
            _, v = self.expr(s[1])
            self.emit(f"ret i64 {v}")
        elif op == "if":
            body = s[2:]
            then, other = (body[:body.index("else")], body[body.index("else") + 1:]) if "else" in body else (body, [])
            _, c = self.expr(s[1])
            l_then, l_else, l_end = self.new_label("then"), self.new_label("else"), self.new_label("endif")
            self.emit(f"br i1 {c}, label %{l_then}, label %{l_else}")
            self.start_block(l_then)
            for x in then:
                self.stmt(x)
            self.emit(f"br label %{l_end}")
            self.start_block(l_else)
            for x in other:
                self.stmt(x)
            self.start_block(l_end)
        elif op == "while":
            l_cond, l_body, l_end = self.new_label("cond"), self.new_label("body"), self.new_label("endwhile")
            self.start_block(l_cond)
            _, c = self.expr(s[1])
            self.emit(f"br i1 {c}, label %{l_body}, label %{l_end}")
            self.start_block(l_body)
            for x in s[2:]:
                self.stmt(x)
            self.emit(f"br label %{l_cond}")
            self.start_block(l_end)

    def finish(self, body):
        params = ", ".join(f"i64 %{p}" for p in self.params)
        ret = "i32" if self.name == "main" else "i64"
        for p in self.params:  # copy each parameter into its own slot so it can be reassigned
            self.emit(f"store i64 %{p}, ptr {self.slot(p)}")
        for s in body:
            self.stmt(s)
        self.emit(f"ret {ret} 0")  # falling off the end returns 0
        return "\\n".join([f"define {ret} @{self.name}({params}) {{", "entry:", *self.allocas, *self.lines, "}"])


program = read("""
(fn collatz (n)
  (let steps 0)
  (while (!= n 1)
    (if (== (% n 2) 0) (set n (/ n 2)) else (set n (+ (* 3 n) 1)))
    (set steps (+ steps 1)))
  (return steps))
(print (call collatz 27))
""")
print('@.fmt = private constant [6 x i8] c"%lld\\\\0A\\\\00"')
print("declare i32 @printf(ptr, ...)")
main_body = []
for s in program:
    if s[0] == "fn":
        print()
        print(FunctionGen(s[1], s[2]).finish(s[3:]))
    else:
        main_body.append(s)
print()
print(FunctionGen("main", []).finish(main_body))` }],
        explain: `- Each variable gets a stack slot the first time it's seen (\`slot\`), and the \`alloca\`s are collected separately so they all land at the top of \`entry\`, where mem2reg wants them.
- \`expr\` returns a \`(type, value)\` pair, because comparisons produce \`i1\` and arithmetic \`i64\`. Values are fresh temporaries (\`%t5\`) or constants.
- \`emit\` and \`start_block\` enforce LLVM's block rules: nothing is emitted after a terminator, and a new block is always entered with an explicit \`br\`.
- \`/\` and \`%\` map to \`sdiv\` and \`srem\`, which round toward zero like C. Pebble rounds down, so pebblec (Project 2) adds a fix-up; for collatz the operands are positive and it doesn't matter.
- Save the output as \`collatz.ll\` and \`clang collatz.ll -o collatz && ./collatz\` prints 111, the same answer the TAC interpreter gave.`,
        output: `@.fmt = private constant [6 x i8] c"%lld\\0A\\00"
declare i32 @printf(ptr, ...)

define i64 @collatz(i64 %n) {
entry:
  %n.addr = alloca i64
  %steps.addr = alloca i64
  store i64 %n, ptr %n.addr
  store i64 0, ptr %steps.addr
  br label %cond1
cond1:
  %t4 = load i64, ptr %n.addr
  %t5 = icmp ne i64 %t4, 1
  br i1 %t5, label %body2, label %endwhile3
body2:
  %t6 = load i64, ptr %n.addr
  %t7 = srem i64 %t6, 2
  %t8 = icmp eq i64 %t7, 0
  br i1 %t8, label %then9, label %else10
then9:
  %t12 = load i64, ptr %n.addr
  %t13 = sdiv i64 %t12, 2
  store i64 %t13, ptr %n.addr
  br label %endif11
else10:
  %t14 = load i64, ptr %n.addr
  %t15 = mul i64 3, %t14
  %t16 = add i64 %t15, 1
  store i64 %t16, ptr %n.addr
  br label %endif11
endif11:
  %t17 = load i64, ptr %steps.addr
  %t18 = add i64 %t17, 1
  store i64 %t18, ptr %steps.addr
  br label %cond1
endwhile3:
  %t19 = load i64, ptr %steps.addr
  ret i64 %t19
}

define i32 @main() {
entry:
  %t1 = call i64 @collatz(i64 27)
  %t2 = call i32 (ptr, ...) @printf(ptr @.fmt, i64 %t1)
  ret i32 0
}`,
      },
    ],
    interview: [
      {
        q: "What is LLVM, and why has it been so successful?",
        freq: "common",
        a: `LLVM is a modular compiler infrastructure built around a well-specified, typed, SSA **intermediate representation**. Front ends (Clang, rustc, swiftc, Zig, Julia...) translate to LLVM IR; a shared optimizer and many back ends (x86, ARM, RISC-V, WebAssembly, GPUs) do the rest. Success factors: a **library-based design** (reuse pieces in JITs, static analysers, IDEs), a readable textual IR, a permissive licence, strong industry backing (Apple, Google, Intel, ARM...), and the M + N economics: every new language gets world-class optimization and many targets for free.`,
      },
      {
        q: "What does the mem2reg pass do?",
        freq: "common",
        a: `It promotes stack slots created by \`alloca\` (whose address doesn't escape, and that are only accessed by simple loads and stores) into SSA registers: it removes the allocas, loads and stores, and inserts **phi** nodes at the iterated dominance frontiers of the stores, renaming uses along the dominator tree. It lets front ends emit simple non-SSA code (every variable in memory) and still get SSA. In modern pipelines **SROA** (scalar replacement of aggregates) does this plus splitting structs and arrays into individual values.`,
      },
      {
        q: "Why does LLVM IR have no signed/unsigned integer types?",
        freq: "occasional",
        a: `Because signedness only matters for **some operations**, and two's complement makes add, sub, mul, load, store and bitwise ops identical for both. So types say only the width (\`i32\`), and the operations that differ encode it: \`sdiv\`/\`udiv\`, \`srem\`/\`urem\`, \`icmp slt\`/\`ult\`, \`ashr\`/\`lshr\`, \`sext\`/\`zext\`. This keeps the type system and the optimizer simpler. Flags like \`nsw\`/\`nuw\` (no signed/unsigned wrap) carry the source language's overflow guarantees for the optimizer.`,
      },
      {
        q: "How would you add a new programming language on top of LLVM?",
        freq: "occasional",
        a: `Write the **front end**: lexer, parser, semantic analysis and type checking, then lower the AST to LLVM IR (via the C++ \`IRBuilder\`, a binding like llvmlite/inkwell, or textual \`.ll\`): globals and string constants, functions with an \`entry\` block of allocas, expressions as SSA instructions, control flow as basic blocks and branches, calls into a small **runtime library** for what LLVM doesn't provide (printing, allocation, GC, exceptions). Then run the standard pass pipeline and emit object code (or JIT with ORC), and link against the runtime. Add debug info (DWARF via \`DIBuilder\`) for debugger support. Project 2 does a small version of exactly this.`,
      },
      {
        q: "What is a terminator instruction, and why must every basic block end with one?",
        freq: "occasional",
        a: `A terminator transfers control out of a block: \`ret\`, \`br\` (conditional or not), \`switch\`, \`indirectbr\`, \`invoke\` (call with exception edge), \`resume\`, \`unreachable\`. Requiring exactly one, at the end, makes the CFG **explicit** in the IR: a block's successors are read directly from its terminator, with no implicit fall-through. That makes analyses and transformations (reordering blocks, splitting edges) simple and safe. Front ends must therefore start a fresh block after any \`return\` or \`break\`, and emit \`unreachable\` where control can't reach.`,
      },
    ],
    quiz: [
      {
        q: "What does a front end have to produce to use LLVM?",
        options: ["Machine code", "LLVM IR", "Assembly for each CPU", "A bytecode interpreter"],
        answer: 1,
        explain: "That's the whole point: emit IR, and LLVM's optimizer and back ends do the rest.",
      },
      {
        q: "In LLVM IR, how many times can `%x` be assigned?",
        options: ["Any number", "Exactly once: LLVM IR is in SSA form", "Twice", "Once per basic block"],
        answer: 1,
        explain: "Re-assignment is expressed with new names, and phis where paths merge (or with memory via alloca).",
      },
      {
        q: "How does LLVM IR tell signed from unsigned division?",
        options: ["With i32 vs u32 types", "With different instructions: sdiv vs udiv", "It doesn't support unsigned", "With a flag on the function"],
        answer: 1,
        explain: "Integer types only have a width; operations where sign matters come in signed and unsigned versions.",
      },
      {
        q: "Why should all allocas be placed in the entry block?",
        options: [
          "LLVM requires it for correctness",
          "So mem2reg can promote them to SSA registers (and they're allocated once, not every loop iteration)",
          "To save memory",
          "Because the entry block runs last",
        ],
        answer: 1,
        explain: "mem2reg only promotes entry-block allocas; an alloca in a loop would also grow the stack each iteration.",
      },
      {
        q: "Why is `[22 x i8]` the right type for the 20-character string plus newline in sum.ll?",
        options: ["Strings need 2 extra bytes of padding", "20 characters + the newline + the terminating zero byte", "It's a typo", "Every string is 22 bytes"],
        answer: 1,
        explain: "C strings end with a 0 byte, and LLVM checks the declared length matches exactly.",
      },
      {
        q: "After `opt -O2`, collatz's if/else became a `select`. What does that do?",
        options: [
          "Picks one of two values based on a condition, without branching",
          "Calls a function",
          "Starts a new loop",
          "Selects a register",
        ],
        answer: 0,
        explain: "If-conversion computes both cheap sides and picks one, avoiding a hard-to-predict branch.",
      },
      {
        q: "Which tool runs LLVM IR directly, without producing an executable?",
        options: ["llc", "lli", "llvm-as", "lld"],
        answer: 1,
        explain: "lli interprets or JIT-compiles IR. llc produces assembly, llvm-as produces bitcode, lld links.",
      },
      {
        q: "Every LLVM basic block must end with...",
        options: ["A phi", "Exactly one terminator (br, ret, switch, unreachable...)", "A load", "Nothing in particular"],
        answer: 1,
        explain: "No fall-through: the terminator lists the block's successors explicitly.",
      },
    ],
  },
];
