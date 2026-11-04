import type { Lesson } from "../types";

// Compilers, part 3: interpreters. Tree-walking, bytecode virtual machines, and Project 1: Pebble.

export const compilersPart3: Lesson[] = [
  // ------------------------------------------------------------------ TREE-WALKING INTERPRETERS
  {
    id: "comp-interpreter",
    part: "Part 3 · Interpreters & VMs",
    title: "Tree-walking interpreters",
    tagline: "Running the AST directly: evaluating expressions, executing statements, environments and scope chains, functions and call frames, closures, return as an exception, runtime values, truthiness, and runtime errors.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["recursion"],
    diagram: {
      title: "Calling a closure",
      nodes: [
        { id: "ast", label: "AST", kind: "client", x: 100, y: 270, sub: "a()" },
        { id: "eval", label: "Evaluator", kind: "service", x: 320, y: 270, sub: "match on the node kind" },
        { id: "envg", label: "Global environment", kind: "db", x: 580, y: 100, sub: "make_counter, a, b" },
        { id: "fnobj", label: "Closure a", kind: "storage", x: 850, y: 100, sub: "code of next + where it was made" },
        { id: "envc", label: "make_counter's frame", kind: "cache", x: 850, y: 300, sub: "count = 2" },
        { id: "envn", label: "Frame for this call", kind: "cache", x: 580, y: 450, sub: "parent: make_counter's frame" },
      ],
      edges: [
        { from: "ast", to: "eval", label: "walk" },
        { from: "eval", to: "envg", label: "look up a" },
        { from: "envg", to: "fnobj", label: "a holds" },
        { from: "fnobj", to: "envc", label: "captured" },
        { from: "envc", to: "envn", label: "parent link" },
        { from: "eval", to: "envn", label: "new frame per call" },
        { from: "envc", to: "envg", label: "parent link", dashed: true },
      ],
      flows: [
        {
          name: "Call a() a third time",
          path: ["ast", "eval", "envg", "fnobj", "envc", "envn"],
          steps: [
            "The evaluator reaches the call a().",
            "It looks up a, and finds it in the global environment.",
            "a holds a closure: the code of the inner function plus the environment it was created in.",
            "That environment is make_counter's frame, kept alive because the closure points at it. count = 2 lives there.",
            "The call gets a fresh frame whose parent is the captured frame (not the caller's). count = count + 1 follows the parent link and makes it 3.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've built a tree out of the program: \`(+ 1 (* 2 3))\`. Now **run** it. Here's the trick: ask the top of the tree "what's your value?". The \`+\` says: "I don't know yet, let me ask my children". The \`1\` says "1!". The \`*\` asks **its** children, gets 2 and 3, and says "6!". Now \`+\` can say "7!".

Every node just asks its children and combines the answers. That's a **tree-walking interpreter**: the program runs by walking its own tree, and the whole thing is one function that calls itself.

For variables, the interpreter keeps **notebooks** (**environments**): each one lists some names and their values, and has a **sticky note pointing at a bigger notebook** around it. To find a name, look in your notebook; if it's not there, follow the sticky note.

## The core: evaluate and execute
Two mutually recursive functions do everything:
- \`evaluate(expr, env)\` returns a **value**: a literal returns itself, a variable is looked up, \`a + b\` evaluates both sides and adds, a call evaluates the function and arguments and runs the body.
- \`execute(stmt, env)\` performs an **action**: \`let\` defines a variable, \`print\` prints, \`if\` evaluates the condition and executes one branch, \`while\` loops.

Python's \`match\` statement (or a visitor pattern in Java) makes this read almost like the language's specification.

## Runtime values
The interpreter needs a representation for every value the language has. In Python it's natural to reuse Python's own: \`int\`, \`str\`, \`bool\`, \`None\` for nil, \`list\`, and small classes for functions. Watch for the gaps between the two languages:
- In Python, \`True == 1\`. If your language says \`true == 1\` is false, compare the **types** too.
- **Division**: integer floor division, and **division by zero** must be your error, not Python's \`ZeroDivisionError\`.
- **Truthiness**: which values count as false? Pebble, Ruby and Lua say only \`nil\` and \`false\`. Python and JavaScript also treat \`0\`, \`""\` and empty lists as false. Pick a rule and apply it **everywhere** (if, while, and, or, !).

## Environments and scope chains
An **environment** is a dictionary plus a link to its **enclosing** environment:
\`\`\`python
class Environment:
    def __init__(self, enclosing=None):
        self.values, self.enclosing = {}, enclosing
\`\`\`
Entering a block creates a new environment linked to the current one; lookups walk the chain outwards. The chain at any moment mirrors the program's **lexical** nesting, as long as functions link to the right parent (next section).

## Functions and calls
A function declaration creates a **function value**: its parameters, its body and, crucially, the **environment it was declared in**. Calling it:
1. evaluate the callee and the arguments;
2. check it's callable and the argument count matches;
3. create a **new environment** for the call whose parent is the function's **captured** environment (not the caller's!), and bind the parameters there;
4. execute the body;
5. the result is whatever \`return\` produced, or nil.

Each call gets its own environment, so recursion works: \`fib(20)\` has 21,891 calls, each with its own \`n\` (open the visualizer).

**\`return\`** has to jump out of any number of nested statements (inside a \`while\` inside an \`if\`). The simplest implementation is a **Python exception**: \`return\` raises \`ReturnSignal(value)\`, and the call catches it. The same trick works for \`break\` and \`continue\`.

## Closures
Because a function value **captures** the environment where it was created, an inner function can keep using its outer function's variables **after the outer function has returned**:
\`\`\`text
fn make_counter() {
  let count = 0;
  return fn() { count = count + 1; return count; };
}
let a = make_counter();   // a's environment holds its own count
let b = make_counter();   // b gets a different count
\`\`\`
Calling \`a()\` three times gives 1, 2, 3, and \`b()\` still gives 1. The environment holding \`count\` is kept alive because the closure points at it: environments live on the **heap**, not a stack. Follow it step by step in the diagram above.

If calls used the **caller's** environment as the parent instead, you'd get **dynamic scoping**, and closures would break.

## Runtime errors
A dynamically typed language checks types **as it runs**: \`1 + "one"\`, calling a number, an index out of range, an undefined variable. Each error should say **what** and **where** (the line from the AST node), and stop the program cleanly with a non-zero exit code, never with a Python traceback from inside your interpreter.

Deep recursion is a special case: each Pebble call uses several Python frames, so Python's default limit of 1000 runs out quickly. Raise it, and turn Python's \`RecursionError\` into your own "stack overflow" message.

## How fast is it?
Tree-walking is the **simplest** design and has the best error messages, but it's the **slowest**: every node visit is a function call, a type dispatch and a dictionary lookup for variables. Typically **10–100× slower** than a bytecode VM in the same host language... which is the next lesson. Real tree-walkers: early Ruby (before 1.9), Bash, many template engines and configuration languages, and countless DSLs.`,
    keyPoints: [
      "evaluate(expr, env) returns values; execute(stmt, env) performs actions; both recurse over the AST",
      "Environments are dictionaries with a link to the enclosing environment; lookups walk the chain outwards",
      "A call creates a fresh environment whose parent is the function's captured environment, not the caller's",
      "Closures work because function values capture their defining environment, which lives on the heap",
      "return (and break, continue) can be implemented as exceptions that unwind to the right place",
      "Runtime errors must report what and where, never a host-language traceback",
    ],
    code: [
      {
        title: "A tree-walking interpreter with closures",
        variants: [{ lang: "python", code: `# A tree-walking interpreter: run the program by walking its AST directly.
# Environments are chained dictionaries, and functions remember the environment they were made in
# (closures), so make_counter below works.
import re


def read(text):
    tokens = re.findall(r'\\(|\\)|"[^"]*"|[^\\s()]+', text)
    pos = 0

    def item():
        nonlocal pos
        pos += 1
        if tokens[pos - 1] != "(":
            t = tokens[pos - 1]
            return int(t) if t.lstrip("-").isdigit() else t
        out = []
        while tokens[pos] != ")":
            out.append(item())
        pos += 1
        return out

    prog = []
    while pos < len(tokens):
        prog.append(item())
    return prog


class Env:
    def __init__(self, parent=None):
        self.vars, self.parent = {}, parent

    def find(self, name):
        env = self
        while env is not None:
            if name in env.vars:
                return env
            env = env.parent
        raise PebbleError(f"undefined variable '{name}'")


class Function:
    def __init__(self, name, params, body, closure):
        self.name, self.params, self.body, self.closure = name, params, body, closure


class ReturnSignal(Exception):  # "return" unwinds the Python stack back to the call
    def __init__(self, value):
        self.value = value


class PebbleError(Exception):
    pass


OPS = {"+": lambda a, b: a + b, "-": lambda a, b: a - b, "*": lambda a, b: a * b,
       "%": lambda a, b: a % b, "<": lambda a, b: a < b, "<=": lambda a, b: a <= b,
       ">": lambda a, b: a > b, ">=": lambda a, b: a >= b, "==": lambda a, b: a == b, "!=": lambda a, b: a != b}


def evaluate(e, env):
    if isinstance(e, int):
        return e
    if isinstance(e, str):
        if e.startswith('"'):
            return e[1:-1]
        if e in ("true", "false"):
            return e == "true"
        return env.find(e).vars[e]
    op = e[0]
    if op == "and":
        return evaluate(e[1], env) and evaluate(e[2], env)  # short-circuit: skip the right side
    if op == "or":
        return evaluate(e[1], env) or evaluate(e[2], env)
    if op == "call":
        fn = evaluate(e[1], env)
        args = [evaluate(a, env) for a in e[2:]]
        if not isinstance(fn, Function):
            raise PebbleError(f"{show(fn)} is not a function")
        if len(args) != len(fn.params):
            raise PebbleError(f"{fn.name} expects {len(fn.params)} argument(s), got {len(args)}")
        frame = Env(fn.closure)  # the new scope's parent is where the function was DEFINED
        frame.vars.update(zip(fn.params, args))
        try:
            execute_block(fn.body, frame)
        except ReturnSignal as r:
            return r.value
        return None
    if op == "-" and len(e) == 2:
        return -evaluate(e[1], env)
    if op == "!":
        return not evaluate(e[1], env)
    a, b = evaluate(e[1], env), evaluate(e[2], env)
    if op == "/":
        if b == 0:
            raise PebbleError("division by zero")
        return a // b
    if op == "+" and type(a) is not type(b):
        raise PebbleError(f"can't add {show(a)} and {show(b)}")
    return OPS[op](a, b)


def execute(s, env):
    op = s[0]
    if op == "let":
        env.vars[s[1]] = evaluate(s[2], env)
    elif op == "set":
        env.find(s[1]).vars[s[1]] = evaluate(s[2], env)  # update the variable where it lives
    elif op == "print":
        print(show(evaluate(s[1], env)))
    elif op == "fn":
        env.vars[s[1]] = Function(s[1], s[2], s[3:], env)  # capture the current environment
    elif op == "return":
        raise ReturnSignal(evaluate(s[1], env) if len(s) > 1 else None)
    elif op == "if":
        body = s[2:]
        then, other = (body[:body.index("else")], body[body.index("else") + 1:]) if "else" in body else (body, [])
        execute_block(then if evaluate(s[1], env) else other, Env(env))
    elif op == "while":
        while evaluate(s[1], env):
            execute_block(s[2:], Env(env))
    else:
        evaluate(s, env)


def execute_block(stmts, env):
    for s in stmts:
        execute(s, env)


def show(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, Function):
        return f"<fn {v.name}>"
    return "nil" if v is None else str(v)


program = read("""
(fn make_counter ()
  (let count 0)
  (fn next ()
    (set count (+ count 1))
    (return count))
  (return next))
(let a (call make_counter))
(let b (call make_counter))
(call a) (call a)
(print (call a))
(print (call b))
(print a)

(fn fib (n)
  (if (< n 2) (return n))
  (return (+ (call fib (- n 1)) (call fib (- n 2)))))
(print (call fib 20))

(let i 0)
(while (< i 3)
  (if (== (% i 2) 0) (print "even") else (print (+ "odd " "number")))
  (set i (+ i 1)))
(print (and (> i 5) (call undefined_function)))
""")
globals_ = Env()
execute_block(program, globals_)

for bad in ['(print (/ 10 (- 3 3)))', '(print (+ 1 "one"))', '(call 42)', '(print nope)']:
    try:
        execute_block(read(bad), globals_)
    except PebbleError as err:
        print(f"runtime error in {bad}: {err}")` }],
        explain: `- \`evaluate\` handles expressions and \`execute\` handles statements: two recursive functions are the entire interpreter.
- \`Env.find\` walks the parent chain. \`set\` uses it to update a variable **where it lives**, which is why \`count\` changes inside \`make_counter\`'s environment rather than creating a new local.
- \`execute\` for \`fn\` stores \`Function(..., env)\`: the current environment is **captured**. In \`call\`, the new frame's parent is \`fn.closure\`. Those two lines are what make \`a\` and \`b\` independent counters: 3 and 1.
- \`and\` returns early without evaluating the right side, so \`(call undefined_function)\` never runs and no error happens: short-circuit evaluation.
- Runtime errors are \`PebbleError\`s with a clear message: division by zero, \`1 + "one"\`, calling 42. In a real interpreter each would also carry the line number.`,
        output: `3
1
<fn next>
6765
even
odd number
even
false
runtime error in (print (/ 10 (- 3 3))): division by zero
runtime error in (print (+ 1 "one")): can't add 1 and one
runtime error in (call 42): 42 is not a function
runtime error in (print nope): undefined variable 'nope'`,
      },
    ],
    interview: [
      {
        q: "How does a tree-walking interpreter work?",
        freq: "common",
        a: `It executes the AST directly: a recursive \`evaluate(node, env)\` dispatches on the node type (literal → value, variable → environment lookup, binary → evaluate children then apply the operator, call → evaluate callee and arguments, create a frame, run the body), and an \`execute(stmt, env)\` does the same for statements. State lives in **environments** (scope chains). It's simple, portable and gives great error messages, but slow: per-node dispatch, pointer-chasing through the tree, and name lookups by string. Bytecode VMs fix most of that.`,
      },
      {
        q: "What's a closure, and how do you implement one in an interpreter?",
        freq: "very-common",
        a: `A closure is a function together with the **environment it was defined in**, so it can access variables from enclosing scopes even after those scopes have returned. In a tree-walking interpreter: when evaluating a function definition, create a function object holding the parameters, body and a **reference to the current environment**. When calling it, create the new environment with that captured environment as its parent. Because environments are heap objects kept alive by references, captured variables outlive their stack frame. Compiled implementations instead store captured variables in heap-allocated "boxes" or "upvalues" (Lua), or copy immutable ones into the closure object.`,
      },
      {
        q: "How would you implement return, break and continue in a tree-walking interpreter?",
        freq: "occasional",
        a: `They need non-local exits through arbitrarily nested statements. Common approaches: (1) **exceptions**: \`return\` raises a \`ReturnSignal(value)\` caught by the call; \`break\`/\`continue\` raise signals caught by the loop; simple, but exceptions can be slow in some hosts. (2) **Completion records**: every \`execute\` returns a status (normal, return with value, break, continue) that callers check and propagate; the approach the JavaScript spec uses. Bytecode VMs avoid both: they compile them into jumps and a \`RETURN\` instruction.`,
      },
      {
        q: "Why does an interpreter for a language with closures need environments on the heap?",
        freq: "occasional",
        a: `Because a closure may outlive the call that created its variables (\`make_counter\` returns, but the returned function still uses \`count\`). If locals lived only in a stack frame popped at return, the closure would point at freed memory. So captured variables must live in heap-allocated environments (or boxes) managed by a garbage collector. Optimizing compilers do **escape analysis** to keep non-captured variables on the stack or in registers and only heap-allocate the captured ones.`,
      },
      {
        q: "What's the difference between an environment and a stack frame?",
        freq: "occasional",
        a: `A **stack frame** is the run-time record of one active call (return address, locals, saved registers), created and destroyed in LIFO order. An **environment** maps names to values for a scope and links to an enclosing environment; it follows **lexical** nesting rather than the call order, and may outlive the call (closures). In a simple interpreter, each call creates an environment that plays the role of the frame's locals; in compiled code, locals are frame slots or registers, and only captured variables need environment-like heap storage.`,
      },
      {
        q: "How would you add a 'stack overflow' error to a tree-walking interpreter written in Python?",
        freq: "occasional",
        a: `Each interpreted call uses several host frames (evaluate → call → execute_block → execute → evaluate...), so deep but legitimate recursion can exhaust Python's recursion limit. Raise the limit for the interpreter (\`sys.setrecursionlimit\`), catch \`RecursionError\` at the top level, and report it as the language's own "stack overflow" error. More robust options: count the interpreted call depth yourself and fail at a fixed limit, or avoid host recursion entirely by compiling to bytecode with an explicit frame stack.`,
      },
    ],
    quiz: [
      {
        q: "To evaluate `(+ 1 (* 2 3))`, what does the `+` node do first?",
        options: ["Prints 7", "Evaluates its two children", "Looks up + in the environment", "Parses the expression"],
        answer: 1,
        explain: "Each node computes its value from its children's values: the evaluator is a post-order recursive walk.",
      },
      {
        q: "When a function is called, what should the new environment's parent be?",
        options: ["The caller's environment", "The environment where the function was defined", "Always the global environment", "None"],
        answer: 1,
        explain: "That's lexical scoping. Using the caller's environment would give dynamic scoping and break closures.",
      },
      {
        q: "In the sample, why does `a` print 3 while `b` prints 1?",
        options: [
          "a was called with a different argument",
          "Each make_counter() call created a separate environment with its own count, captured by its closure",
          "count is global",
          "b was defined later",
        ],
        answer: 1,
        explain: "Two calls, two environments, two counts. Each closure keeps its own alive.",
      },
      {
        q: "Why is `return` often implemented with an exception in a tree-walking interpreter?",
        options: [
          "Because return is an error",
          "It must jump out of any number of nested statements back to the call",
          "To print a stack trace",
          "Python requires it",
        ],
        answer: 1,
        explain: "A return inside a while inside an if must skip the rest of all of them; raising and catching at the call does that in one step.",
      },
      {
        q: "Why didn't `(and (> i 5) (call undefined_function))` cause an error?",
        options: [
          "undefined_function exists",
          "and short-circuits: the left side was false, so the right side was never evaluated",
          "Errors are ignored in and",
          "Calls are lazy",
        ],
        answer: 1,
        explain: "The interpreter only evaluates the right operand of and when the left one is true.",
      },
      {
        q: "If a language says only nil and false are falsey, what does `if 0 { ... }` do?",
        options: ["Skips the block", "Runs the block", "Raises an error", "It depends on the block"],
        answer: 1,
        explain: "0 is neither nil nor false, so it's truthy, as in Ruby and Lua. Python would skip it.",
      },
      {
        q: "Why must captured variables live on the heap rather than in a stack frame?",
        options: [
          "The heap is faster",
          "A closure can outlive the call that created the variable",
          "Stacks can't hold integers",
          "To save memory",
        ],
        answer: 1,
        explain: "make_counter has returned, yet the closure still reads and writes count.",
      },
    ],
  },

  // ------------------------------------------------------------------ BYTECODE VMs
  {
    id: "comp-bytecode",
    title: "Bytecode and virtual machines",
    tagline: "Compile once, run many times: designing an instruction set, stack vs register VMs, constant pools, local slots, jumps and backpatching, call frames, the dispatch loop, and how CPython, the JVM, Lua and WebAssembly do it.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["stackvm"],
    concept: `## Explain it like I'm 10 🧸
The tree-walker is like following a treasure map by walking around a huge garden every single time: slow. What if, the first time, you wrote down the route as a simple **numbered list** ("step 1: go to the oak. step 2: turn left. step 3: if it's raining, skip to step 7")? Next time, you just read down the list. That list is **bytecode**: short, numbered instructions that are quick to follow.

The **virtual machine** is a pretend computer that only understands your list. It has a **pile of numbers** (the stack): "push 2", "push 3", "add" means take the top two numbers off the pile and put back 5. Every instruction is tiny and simple, so the VM can rip through millions of them per second.

## Why bytecode?
A tree-walking interpreter re-does work on every run: following pointers between scattered nodes, dispatching on node types, looking variables up **by name** in dictionaries. A **bytecode compiler** does that work **once**:
- the tree becomes a **flat array** of compact instructions (cache-friendly);
- each local variable becomes a **slot number**: \`LOAD 0\` instead of searching dictionaries for \`"n"\`;
- control flow becomes **jumps**, so no recursion is needed to run a loop.

Result: usually several times faster than tree-walking, and the bytecode can be **saved** (\`.pyc\`, \`.class\`) or shipped (WebAssembly). Nearly every popular dynamic language works this way: CPython, Ruby (YARV), Lua, PHP, Erlang (BEAM), the JVM, .NET (CIL), and JavaScript engines' first tier.

## A stack machine
The simplest bytecode design uses an **operand stack**. Operands are pushed; operators pop their inputs and push their result. \`x = a + b * 2\` becomes:
\`\`\`text
LOAD a        stack: [a]
LOAD b        stack: [a, b]
CONST 2       stack: [a, b, 2]
MUL           stack: [a, b*2]
ADD           stack: [a + b*2]
STORE x       stack: []
\`\`\`
Code generation for a stack machine is a simple **post-order walk** of the AST: children first, then the operator. You did this in Part 1's one-page compiler.

## The pieces of a bytecode format
- **Opcodes**: one byte each (CPython has about 120). Operands follow: a constant index, a slot number, a jump target.
- **Constant pool**: literals (numbers, strings, nested functions) stored once per function; \`CONST 3\` pushes constant number 3. Equal constants are shared; careful with languages where \`True == 1\`.
- **Local slots**: the compiler assigns each local a number. Parameters take the first slots, so a call can copy arguments straight in.
- **Globals**: looked up by name (or by index into a global table).
- **Jumps**: \`JUMP target\`, \`JUMP_IF_FALSE target\`. A loop is a backward jump to the condition.

## Backpatching
When compiling \`if cond { A } else { B }\`, you must emit \`JUMP_IF_FALSE else_part\` **before** you know where \`else_part\` will be. Emit it with a placeholder, remember its address, compile \`A\`, and then **patch** the real target in. This **backpatching** is how every single-pass code generator handles forward jumps.
\`\`\`text
    <cond>
    JUMP_IF_FALSE  ?      ← patched to L1 once we know it
    <A>
    JUMP           ?      ← patched to L2
L1: <B>
L2: ...
\`\`\`

## Calls and frames
The VM keeps a **stack of call frames**. Each frame holds the function's bytecode, its own **program counter** and its **local slots**. \`CALL f 2\` pops two arguments into a new frame and starts executing \`f\` at instruction 0; \`RETURN\` pops the frame and leaves the result on the operand stack for the caller. No host-language recursion, so deep recursion only needs a bigger frame stack.

## The dispatch loop
The heart of every VM is a loop:
\`\`\`c
for (;;) {
    switch (*pc++) {
        case OP_CONST: push(constants[*pc++]); break;
        case OP_ADD:   { Value b = pop(), a = pop(); push(a + b); break; }
        case OP_JUMP:  pc = code + read_u16(pc); break;
        ...
    }
}
\`\`\`
Speeding it up is a classic topic:
- **Computed goto / direct threading**: each handler ends with \`goto *labels[*pc++]\`, so the CPU's branch predictor learns patterns per instruction (CPython, Ruby, Lua all use it when the C compiler supports it): often 15–25% faster.
- **Superinstructions**: merge common pairs (\`LOAD_FAST_LOAD_FAST\` in CPython 3.13) so fewer dispatches happen.
- **Inline caches** and **quickening**: rewrite a generic instruction into a specialised one after seeing what types it handles. CPython 3.11's "specializing adaptive interpreter" turns \`BINARY_OP\` into \`BINARY_OP_ADD_INT\` when it keeps seeing ints, giving 10–60% speedups.
- **Register-based VMs**: instructions name their operands directly (\`ADD r3, r1, r2\`) instead of pushing and popping. Fewer instructions (roughly 30–45% fewer dispatches), larger encodings. Lua 5 and Android's Dalvik/ART are register machines; the JVM, CPython and WebAssembly are stack machines.

## Bytecode you can inspect today
- Python: \`import dis; dis.dis(fn)\`
- Java: \`javap -c MyClass\`
- Lua: \`luac -l script.lua\`
- WebAssembly: \`wasm2wat module.wasm\`

The JVM adds **bytecode verification**: before running a class, it checks types on the operand stack along every path, so malicious bytecode can't forge pointers. That's why JVM bytecode is typed (\`iadd\`, \`ladd\`, \`aload\`), while CPython's isn't.

## The next step: JIT
Even a great interpreter pays for dispatch on every instruction. The final step is to compile the **hot** bytecode to machine code while the program runs: a **JIT** (Part 5).`,
    keyPoints: [
      "Bytecode compiles the tree once into a flat array of compact instructions; variables become slot numbers",
      "Stack machines push operands and let operators pop them; code generation is a post-order walk of the AST",
      "A function's bytecode has a constant pool, numbered local slots, and jumps for control flow",
      "Forward jumps are emitted with a placeholder and backpatched once the target is known",
      "The VM keeps a stack of frames (code, pc, slots); CALL pushes one, RETURN pops it",
      "Dispatch loop speed-ups: computed goto, superinstructions, quickening; register VMs need fewer instructions",
    ],
    code: [
      {
        title: "A bytecode compiler and stack VM",
        variants: [{ lang: "python", code: `# Compile the AST to bytecode once, then run it on a stack-based virtual machine.
# This is how CPython, the JVM, Lua, Ruby (YARV) and WebAssembly engines work.
import re


def read(text):
    tokens = re.findall(r'\\(|\\)|"[^"]*"|[^\\s()]+', text)
    pos = 0

    def item():
        nonlocal pos
        pos += 1
        if tokens[pos - 1] != "(":
            t = tokens[pos - 1]
            return int(t) if t.lstrip("-").isdigit() else t
        out = []
        while tokens[pos] != ")":
            out.append(item())
        pos += 1
        return out

    prog = []
    while pos < len(tokens):
        prog.append(item())
    return prog


class Code:
    """A compiled function: its instructions, constants and how many local slots it needs."""
    def __init__(self, name, params):
        self.name, self.arity = name, len(params)
        self.ins, self.consts = [], []
        self.locals = {p: i for i, p in enumerate(params)}  # each local variable gets a numbered slot


BINOPS = {"+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD", "<": "LT", "<=": "LE",
          ">": "GT", ">=": "GE", "==": "EQ", "!=": "NE"}


class Compiler:
    def __init__(self):
        self.functions = {}

    def emit(self, code, *ins):
        code.ins.append(list(ins))
        return len(code.ins) - 1  # the address, so jumps can be patched later

    def const(self, code, value):
        # reuse an existing slot, but compare types too: in Python, True == 1 and False == 0
        for i, c in enumerate(code.consts):
            if type(c) is type(value) and c == value:
                return self.emit(code, "CONST", i)
        code.consts.append(value)
        return self.emit(code, "CONST", len(code.consts) - 1)

    def expr(self, code, e):
        if isinstance(e, int) or (isinstance(e, str) and e.startswith('"')):
            self.const(code, e if isinstance(e, int) else e[1:-1])
        elif e in ("true", "false"):
            self.const(code, e == "true")
        elif isinstance(e, str):
            if e in code.locals:
                self.emit(code, "LOAD", code.locals[e])     # a local: just an index, no lookup by name
            else:
                self.emit(code, "GLOBAL", e)
        elif e[0] == "call":
            for a in e[2:]:
                self.expr(code, a)
            self.emit(code, "CALL", e[1], len(e) - 2)
        elif e[0] == "and":                                   # a and b: if a is false, skip b
            self.expr(code, e[1])
            jump = self.emit(code, "JUMP_IF_FALSE_KEEP", None)
            self.emit(code, "POP")
            self.expr(code, e[2])
            code.ins[jump][1] = len(code.ins)
        elif e[0] == "-" and len(e) == 2:
            self.expr(code, e[1])
            self.emit(code, "NEG")
        else:
            self.expr(code, e[1])
            self.expr(code, e[2])
            self.emit(code, BINOPS[e[0]])

    def stmt(self, code, s):
        op = s[0]
        if op in ("let", "set"):
            self.expr(code, s[2])
            if code.name == "<main>":
                self.emit(code, "STORE_GLOBAL", s[1])
            else:
                slot = code.locals.setdefault(s[1], len(code.locals))
                self.emit(code, "STORE", slot)
        elif op == "print":
            self.expr(code, s[1])
            self.emit(code, "PRINT")
        elif op == "return":
            self.expr(code, s[1])
            self.emit(code, "RETURN")
        elif op == "if":
            body = s[2:]
            then, other = (body[:body.index("else")], body[body.index("else") + 1:]) if "else" in body else (body, [])
            self.expr(code, s[1])
            to_else = self.emit(code, "JUMP_IF_FALSE", None)   # we don't know the target yet...
            self.block(code, then)
            to_end = self.emit(code, "JUMP", None)
            code.ins[to_else][1] = len(code.ins)                # ...so we patch it afterwards
            self.block(code, other)
            code.ins[to_end][1] = len(code.ins)
        elif op == "while":
            top = len(code.ins)
            self.expr(code, s[1])
            exit_jump = self.emit(code, "JUMP_IF_FALSE", None)
            self.block(code, s[2:])
            self.emit(code, "JUMP", top)                        # loop back to the condition
            code.ins[exit_jump][1] = len(code.ins)
        elif op == "fn":
            fn = Code(s[1], s[2])
            self.functions[s[1]] = fn
            self.block(fn, s[3:])
            self.const(fn, None)
            self.emit(fn, "RETURN")
        else:
            self.expr(code, s)
            self.emit(code, "POP")

    def block(self, code, stmts):
        for s in stmts:
            self.stmt(code, s)


def disassemble(code):
    print(f"== {code.name} ({code.arity} params, {len(code.locals)} local slots) ==")
    for addr, ins in enumerate(code.ins):
        arg = ""
        if ins[0] == "CONST":
            arg = f"{ins[1]}  ({code.consts[ins[1]]!r})"
        elif len(ins) > 1:
            arg = " ".join(map(str, ins[1:]))
        print(f"  {addr:>3}  {ins[0]:<20}{arg}")


def run(main, functions):
    executed = 0
    stack = []
    frames = [(main, 0, [])]  # (code, pc, local slots): one frame per active call
    globals_ = {}
    while frames:
        code, pc, slots = frames[-1]
        op, *args = code.ins[pc]
        pc += 1
        executed += 1
        if op == "CONST":
            stack.append(code.consts[args[0]])
        elif op == "LOAD":
            stack.append(slots[args[0]])
        elif op == "STORE":
            slots[args[0]] = stack.pop()
        elif op == "GLOBAL":
            stack.append(globals_[args[0]])
        elif op == "STORE_GLOBAL":
            globals_[args[0]] = stack.pop()
        elif op in ("ADD", "SUB", "MUL", "DIV", "MOD", "LT", "LE", "GT", "GE", "EQ", "NE"):
            b, a = stack.pop(), stack.pop()
            stack.append({"ADD": lambda: a + b, "SUB": lambda: a - b, "MUL": lambda: a * b, "DIV": lambda: a // b,
                          "MOD": lambda: a % b, "LT": lambda: a < b, "LE": lambda: a <= b, "GT": lambda: a > b,
                          "GE": lambda: a >= b, "EQ": lambda: a == b, "NE": lambda: a != b}[op]())
        elif op == "NEG":
            stack.append(-stack.pop())
        elif op == "JUMP":
            pc = args[0]
        elif op == "JUMP_IF_FALSE":
            if not stack.pop():
                pc = args[0]
        elif op == "JUMP_IF_FALSE_KEEP":
            if not stack[-1]:
                pc = args[0]
        elif op == "POP":
            stack.pop()
        elif op == "PRINT":
            v = stack.pop()
            print("true" if v is True else "false" if v is False else v)
        elif op == "CALL":
            fn, n = functions[args[0]], args[1]
            new_slots = stack[len(stack) - n:] + [None] * (len(fn.locals) - n)
            del stack[len(stack) - n:]
            frames[-1] = (code, pc, slots)            # remember where to come back to
            frames.append((fn, 0, new_slots))
            continue
        elif op == "RETURN":
            frames.pop()                               # the return value stays on top of the stack
            continue
        frames[-1] = (code, pc, slots)
    return executed


program = read("""
(fn fib (n)
  (if (< n 2) (return n))
  (return (+ (call fib (- n 1)) (call fib (- n 2)))))
(fn sum_to (n)
  (let total 0)
  (let i 1)
  (while (<= i n)
    (set total (+ total i))
    (set i (+ i 1)))
  (return total))
(print (call fib 20))
(print (call sum_to 100))
(print (and (> 1 2) (call fib 30)))
(print (and true 1))
""")
compiler = Compiler()
main = Code("<main>", [])
compiler.block(main, program)
compiler.const(main, None)
compiler.emit(main, "RETURN")
disassemble(compiler.functions["fib"])
disassemble(compiler.functions["sum_to"])
print("== running ==")
count = run(main, compiler.functions)
print(f"the VM executed {count:,} instructions")` }],
        explain: `- \`Code\` is a compiled function: \`ins\`, \`consts\` and \`locals\`, which maps each local name to a **slot number**. Parameters take the first slots, so \`CALL\` can copy arguments straight in.
- Look at \`sum_to\` in the disassembly: \`total\` is slot 1 and \`i\` slot 2. The loop is addresses 4–16: test the condition, \`JUMP_IF_FALSE 17\` to exit, the body, and \`JUMP 4\` back. No names, no dictionaries, no recursion.
- In \`fib\`, \`JUMP_IF_FALSE 7\` was emitted before the compiler knew where the \`if\` ended: it was **backpatched** (\`code.ins[to_else][1] = len(code.ins)\`). The \`JUMP 7\` at address 6 skips an empty else.
- Address 17–18 (\`CONST None; RETURN\`) is the implicit "fell off the end" return. In \`fib\` it's unreachable, which an optimizer would delete.
- \`and\` compiles to \`JUMP_IF_FALSE_KEEP\`: if the left value is false, keep it as the result and **skip** the right side. \`fib(30)\` (over a million calls) is never run.
- The constant pool compares **types** too: without that, \`true\` would reuse the slot of \`1\` (Python says \`True == 1\`) and print \`1\`.
- 220,234 instructions for \`fib(20)\` plus the rest: every one is a cheap list lookup and a small branch.`,
        output: `== fib (1 params, 1 local slots) ==
    0  LOAD                0
    1  CONST               0  (2)
    2  LT                  
    3  JUMP_IF_FALSE       7
    4  LOAD                0
    5  RETURN              
    6  JUMP                7
    7  LOAD                0
    8  CONST               1  (1)
    9  SUB                 
   10  CALL                fib 1
   11  LOAD                0
   12  CONST               0  (2)
   13  SUB                 
   14  CALL                fib 1
   15  ADD                 
   16  RETURN              
   17  CONST               2  (None)
   18  RETURN              
== sum_to (1 params, 3 local slots) ==
    0  CONST               0  (0)
    1  STORE               1
    2  CONST               1  (1)
    3  STORE               2
    4  LOAD                2
    5  LOAD                0
    6  LE                  
    7  JUMP_IF_FALSE       17
    8  LOAD                1
    9  LOAD                2
   10  ADD                 
   11  STORE               1
   12  LOAD                2
   13  CONST               1  (1)
   14  ADD                 
   15  STORE               2
   16  JUMP                4
   17  LOAD                1
   18  RETURN              
   19  CONST               2  (None)
   20  RETURN              
== running ==
6765
5050
false
1
the VM executed 220,234 instructions`,
      },
    ],
    interview: [
      {
        q: "Why compile to bytecode instead of interpreting the AST directly?",
        freq: "common",
        a: `Bytecode is a **linear, compact** representation: better cache locality than pointer-heavy trees, cheaper dispatch (one byte opcode), and the compiler can **resolve** names to slot indexes and constants to pool indexes once, ahead of time. Control flow becomes jumps, removing host recursion. It's also **portable and storable** (\`.pyc\`, \`.class\`, \`.wasm\`), can be **verified** (JVM), and is a natural input for a JIT. Typical speedup over a naive tree-walker is several times.`,
      },
      {
        q: "Stack-based vs register-based VMs: trade-offs?",
        freq: "common",
        a: `**Stack-based** (JVM, CPython, WebAssembly, .NET): operands implicit on an operand stack; instructions are short and the compiler is simple (post-order walk), but more instructions are executed (extra pushes, pops, loads). **Register-based** (Lua 5, Dalvik, Parrot): instructions name virtual registers explicitly (\`ADD r1 r2 r3\`), so fewer instructions are dispatched (studies show ~30–45% fewer) and fewer copies, at the cost of larger instructions and a register allocator in the compiler. With a good JIT the difference matters less, since both get translated into machine registers.`,
      },
      {
        q: "What is backpatching?",
        freq: "occasional",
        a: `A technique for emitting **forward jumps** in a single pass: emit the jump with a placeholder target, record its location, keep generating code, and once the target address is known, go back and fill it in. Used for if/else, loop exits, \`break\`, and short-circuit \`and\`/\`or\`. Assemblers use the same idea (or two passes) for forward label references, and linkers do it across files with relocations.`,
      },
      {
        q: "How does a bytecode interpreter's dispatch loop work, and how can it be made faster?",
        freq: "occasional",
        a: `A loop fetches the next opcode, dispatches to its handler (typically a \`switch\`), executes it, and repeats. Costs: the indirect branch per instruction is hard to predict, plus operand decoding and stack traffic. Speedups: **threaded code / computed goto** (each handler jumps directly to the next, giving the branch predictor per-opcode history), **superinstructions** (fused common sequences), **inline caching** and **quickening** (rewrite instructions into type-specialised versions at run time, as CPython 3.11+ does), keeping the top of stack in a register (stack caching), and ultimately a **JIT**.`,
      },
      {
        q: "What's in a JVM .class file, and what does bytecode verification check?",
        freq: "occasional",
        a: `A class file holds a **constant pool** (strings, class/method/field references, numeric constants), access flags, the class hierarchy, fields, and methods with their **bytecode**, max stack depth, local count, exception tables and attributes (line numbers, stack map frames). The **verifier** checks, by data-flow analysis over every path, that the operand stack never under- or overflows, that each instruction gets values of the right type (\`iadd\` gets two ints, no forging references from ints), that jumps land on instruction boundaries, and that locals are initialised before use. It's what lets the JVM run untrusted bytecode safely and the JIT trust types.`,
      },
      {
        q: "How does CPython 3.11+ speed up its interpreter?",
        freq: "occasional",
        a: `The **specializing adaptive interpreter** (PEP 659): instructions start generic; after running a few times, they're **quickened** into specialised forms based on what they actually saw, e.g. \`LOAD_ATTR\` → \`LOAD_ATTR_INSTANCE_VALUE\`, \`BINARY_OP\` → \`BINARY_OP_ADD_INT\`, with inline caches stored in the bytecode. If the guess stops holding, they de-specialise. Also: cheaper frames, zero-cost exception setup, and superinstructions. 3.13 added an experimental copy-and-patch **JIT** built on the same specialised instructions.`,
      },
    ],
    quiz: [
      {
        q: "What does `LOAD 0` do in the sample VM?",
        options: ["Loads constant 0", "Pushes the value in local slot 0 (the first parameter)", "Loads global variable 0", "Jumps to address 0"],
        answer: 1,
        explain: "Locals are numbered slots. The compiler resolved the name n to slot 0 once, so the VM never searches by name.",
      },
      {
        q: "On a stack machine, what is left on the stack after `CONST 2; CONST 3; MUL; CONST 1; ADD`?",
        options: ["[2, 3, 1]", "[7]", "[6, 1]", "[5]"],
        answer: 1,
        explain: "2 and 3 are multiplied to 6, then 1 is pushed and added: 7.",
      },
      {
        q: "Why does `JUMP_IF_FALSE` in an `if` need backpatching?",
        options: [
          "Jumps are slow",
          "When it's emitted, the compiler doesn't yet know the address of the code after the then-branch",
          "To make it a backwards jump",
          "Because the constant pool is full",
        ],
        answer: 1,
        explain: "Emit a placeholder, compile the branch, then fill in the target.",
      },
      {
        q: "How is a `while` loop represented in bytecode?",
        options: [
          "A LOOP instruction with a body",
          "A conditional jump out of the loop plus an unconditional jump back to the condition",
          "A recursive call",
          "It's unrolled",
        ],
        answer: 1,
        explain: "In the sample: test at 4–6, JUMP_IF_FALSE 17 to exit, body, JUMP 4 back.",
      },
      {
        q: "Which of these is a register-based VM?",
        options: ["The JVM", "CPython", "Lua 5", "WebAssembly"],
        answer: 2,
        explain: "Lua 5 (and Android's Dalvik) use registers; the JVM, CPython and WebAssembly are stack machines.",
      },
      {
        q: "Why did the sample's constant pool need to compare types, not just values?",
        options: [
          "To save memory",
          "Because in Python True == 1, so true would wrongly reuse the slot holding 1",
          "Strings and ints can't be compared",
          "The VM needs sorted constants",
        ],
        answer: 1,
        explain: "Host-language quirks leak into your language unless you guard against them.",
      },
      {
        q: "What does 'quickening' mean in an interpreter like CPython 3.11?",
        options: [
          "Compiling to machine code",
          "Rewriting a generic instruction into a type-specialised one after observing it at run time",
          "Removing comments",
          "Caching .pyc files",
        ],
        answer: 1,
        explain: "BINARY_OP becomes BINARY_OP_ADD_INT if it keeps seeing ints, skipping generic dispatch.",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT 1: PEBBLE
  {
    id: "comp-project-interpreter",
    title: "Project: build the Pebble interpreter",
    tagline: "Build a complete interpreter for a small language, step by step: lexer, Pratt parser, AST, tree-walking interpreter with closures and lists, a resolver, a CLI with good errors, a REPL and a 59-test suite.",
    difficulty: "intermediate",
    minutes: 120,
    diagram: {
      title: "Inside Pebble",
      nodes: [
        { id: "cli", label: "python -m pebble", kind: "client", x: 100, y: 270, sub: "a file, or the REPL" },
        { id: "lexer", label: "lexer.py", kind: "gateway", x: 300, y: 120, sub: "tokens with line:col" },
        { id: "parser", label: "parser.py", kind: "service", x: 520, y: 120, sub: "recursive descent + Pratt" },
        { id: "resolver", label: "resolver.py", kind: "control", x: 740, y: 120, sub: "scope depth of every local" },
        { id: "interp", label: "interpreter.py", kind: "worker", x: 740, y: 400, sub: "environments, closures, built-ins" },
        { id: "errors", label: "errors.py", kind: "monitor", x: 420, y: 400, sub: "file:line:col + caret, exit codes" },
      ],
      edges: [
        { from: "cli", to: "lexer", label: "source" },
        { from: "lexer", to: "parser", label: "tokens" },
        { from: "parser", to: "resolver", label: "AST" },
        { from: "resolver", to: "interp", label: "AST + depths" },
        { from: "lexer", to: "errors", label: "syntax error", dashed: true },
        { from: "parser", to: "errors", label: "syntax error", dashed: true },
        { from: "resolver", to: "errors", label: "error", dashed: true },
        { from: "interp", to: "errors", label: "runtime error", dashed: true },
        { from: "errors", to: "cli", label: "exit 65 / 70" },
      ],
      flows: [
        {
          name: "Run fib.pb",
          path: ["cli", "lexer", "parser", "resolver", "interp"],
          steps: [
            "The CLI reads the file and hands the text to the lexer.",
            "Tokens, each stamped with its line and column, go to the parser.",
            "The AST goes to the resolver, which records how many scopes up each local lives.",
            "The interpreter runs the tree, using those depths for exact, fast variable lookups.",
          ],
        },
        {
          name: "A typo: print (1 + 2;",
          path: ["cli", "lexer", "parser", "errors", "cli"],
          steps: [
            "The source is lexed fine: every character is a legal token.",
            "The parser expects ')' but finds ';'.",
            "It raises a ParseError carrying line 1, column 13.",
            "The CLI prints file:1:13, the source line and a caret, and exits with code 65. Nothing ran.",
          ],
        },
      ],
    },
    concept: `## What you'll build
**Pebble** is a small, dynamically typed language that is still a real language: variables and scopes, \`if\`/\`else if\`/\`else\`, \`while\`, functions, recursion, **closures** and anonymous functions, **lists** with indexing and assignment, strings, booleans, nil, built-ins (\`len\`, \`push\`, \`str\`, \`type\`), precise error messages, a command-line runner and an interactive REPL.
\`\`\`text
fn make_counter() {
  let count = 0;
  return fn() { count = count + 1; return count; };
}
let next = make_counter();
next(); next();
print "count is", next();          // count is 3

let squares = [];
let i = 1;
while i <= 5 { push(squares, i * i); i = i + 1; }
print squares, len(squares);       // [1, 4, 9, 16, 25] 5
\`\`\`

## The language, precisely
| Feature | Pebble |
|---|---|
| Values | integers (any size), strings, \`true\`/\`false\`, \`nil\`, lists, functions |
| Truthiness | only \`nil\` and \`false\` are false (like Ruby and Lua) |
| Arithmetic | \`+ - * / %\`; \`/\` rounds **down** like Python's \`//\`; \`+\` also joins strings and lists |
| Comparison | \`== !=\` (values of different types are never equal), \`< <= > >=\` on ints |
| Logic | \`and\`, \`or\` (short-circuit, return an operand), \`!\` |
| Statements | \`let\`, assignment (to variables and list elements), \`print a, b\`, \`if\`/\`else\`, \`while\`, \`fn name(...) { }\`, \`return\`, blocks |
| Functions | first-class values; \`fn(x) { ... }\` makes an anonymous one; closures capture variables |
| Errors | \`file:line:col: kind: message\`, the source line and a caret; exit code 65 for syntax errors, 70 at run time |

## How the build goes
Five steps, each ending with **passing tests** (9, then 27, 44, 50 and finally 59). Every step only **adds** files or replaces one file wholesale, so you can copy them in order. You need Python 3.11+ and pytest (\`pip install pytest\`).

Everything here was introduced in the lessons before: the lexer is Part 2's, the parser combines recursive descent with Pratt parsing, the interpreter is a tree-walker with environments, and the resolver is the scope analysis from the semantic analysis lesson. Now they all fit together.`,
    keyPoints: [
      "Pebble is a dynamically typed language with closures, lists, strings and good errors",
      "Five steps: lexer, parser, interpreter, resolver, CLI and REPL, each with its own tests",
      "The resolver fixes a real closure bug that name-based lookup has",
      "Errors print file:line:col, the source line and a caret, with exit codes 65 and 70",
    ],
    interview: [
      {
        q: "Walk me through how you'd build an interpreter for a small language.",
        freq: "common",
        a: `1. **Define the language**: values, truthiness, operators, statements, scoping, error behaviour.
2. **Lexer**: characters → tokens with positions; maximal munch; keyword table; strings with escapes.
3. **Parser**: recursive descent for statements, Pratt parsing for expressions; AST node classes carrying line numbers; errors with expected/found and a caret.
4. **Resolver** (optional but valuable): a static pass binding each variable use to its scope depth; catches use-in-own-initializer and \`return\` outside functions.
5. **Interpreter**: \`evaluate\`/\`execute\` over the AST, environments with parent links, function objects capturing their environment, \`return\` via an exception, runtime type checks.
6. **Driver**: file runner with exit codes, a REPL that keeps state, and tests per phase (lexer, parser, interpreter, end-to-end).

Then iterate: bytecode for speed, a standard library, a garbage collector if you leave the host language's.`,
      },
      {
        q: "Why does an interpreter need a resolver pass if it can just look variables up by name?",
        freq: "occasional",
        a: `Name lookup at run time follows the **dynamic** state of environments, which can differ from the **lexical** structure. Example: a function defined in a block reads \`a\`; later in the same block a new local \`a\` is declared; calling the function again now finds the new \`a\`, although lexically it should still see the outer one. A resolver computes, once, how many scopes up each use's declaration is, and the interpreter jumps exactly that many parents, fixing the bug and making lookups faster. It's also the natural place for static checks (redeclaration, read in own initializer, return outside function).`,
      },
      {
        q: "How do you test a language implementation?",
        freq: "occasional",
        a: `At every level: **unit tests** per phase (token streams, AST shapes or s-expressions for precedence and associativity, interpreter results), **error tests** asserting message, line and column, **end-to-end tests** running example programs through the CLI and comparing output and exit codes, and **REPL** tests via piped stdin. Then: **golden tests** (a directory of programs with expected output files), **fuzzing** the parser with random or mutated inputs to catch crashes, and **differential testing** against another implementation (Project 2 does this, comparing the compiler with this interpreter).`,
      },
    ],
    quiz: [
      {
        q: "In Pebble, what does `if 0 { print \"yes\"; }` print?",
        options: ["Nothing", "yes", "An error", "0"],
        answer: 1,
        explain: "Only nil and false are falsey in Pebble, so 0 is truthy.",
      },
      {
        q: "What does Pebble print for `print -7 / 2;`?",
        options: ["-3", "-4", "-3.5", "An error"],
        answer: 1,
        explain: "Pebble's / rounds down like Python's //, so -7 / 2 is -4.",
      },
      {
        q: "Which exit code does the Pebble CLI use for a syntax error?",
        options: ["0", "1", "65", "70"],
        answer: 2,
        explain: "65 (EX_DATAERR) for bad input such as syntax errors, 70 (EX_SOFTWARE) for runtime errors, following the BSD sysexits convention.",
      },
      {
        q: "Without the resolver, what goes wrong in the closure trap test?",
        options: [
          "Nothing",
          "The function sees a variable declared after it, in the same block, instead of the global it was written against",
          "It crashes",
          "Closures stop working entirely",
        ],
        answer: 1,
        explain: "Run-time name search finds the new local; the resolver's static depths keep the function bound to what was in scope where it was written.",
      },
    ],
    project: {
      summary: `You'll build **Pebble**, a complete interpreter, in five steps. Each step ends with a passing test suite, so you always know your code works before moving on. The finished interpreter runs closures, recursion, lists and string programs, reports errors like a real compiler, and has a REPL.

Create an empty folder (say \`pebble/\`), add each step's files in order, and run the commands shown. You need **Python 3.11 or newer** and **pytest**.`,
      skills: [
        "Writing a lexer with positions, maximal munch and escape handling",
        "Recursive descent for statements and Pratt parsing for expressions",
        "Designing AST node classes (dataclasses) and printing them",
        "Environments, call frames and closures in a tree-walking interpreter",
        "A static resolver pass that binds names to scopes",
        "Exit codes, carets and a REPL: making a language usable",
        "Testing each phase separately, then end to end",
      ],
      tree: `pebble/
├── pyproject.toml
├── pebble/
│   ├── __init__.py       # run(): the whole pipeline in one call
│   ├── __main__.py       # python -m pebble: run a file, or start the REPL
│   ├── errors.py         # every error carries a line and a column
│   ├── lexer.py          # characters → tokens
│   ├── nodes.py          # the AST node classes
│   ├── parser.py         # tokens → AST: recursive descent + Pratt
│   ├── resolver.py       # binds every local variable to its scope
│   └── interpreter.py    # runs the AST: environments, closures, built-ins
├── examples/
│   ├── fib.pb   closures.pb   primes.pb   sort.pb
└── tests/
    ├── test_lexer.py   test_parser.py   test_interpreter.py
    └── test_resolver.py   test_cli.py`,
      steps: [
        {
          title: "1. Tokens: errors and the lexer",
          explain: `Start where every compiler starts: turn characters into **tokens**.
- \`pyproject.toml\` tells pytest where the tests are and to put the project root on \`sys.path\`, so \`import pebble\` works from the tests.
- \`errors.py\` defines one base class, \`PebbleError(message, line, col)\`, and a subclass per phase. Its \`__str__\` gives the familiar \`line:col: kind: message\` format. Every later phase raises one of these, so the CLI can handle all errors the same way.
- \`lexer.py\` is the hand-written scanner from the lexing lesson, with three additions: \`nil\` and the list brackets \`[\` \`]\`; an error for numbers glued to letters (\`12abc\` is \`invalid number\`, not \`12\` then a name); and strict escapes: only \`\\n\`, \`\\t\`, \`\\"\` and \`\\\\\`.
- \`Token\` is a **frozen** dataclass: tokens never change after they're made.
- The tests check maximal munch (\`<=\` over \`<\`, \`iffy\` over \`if\`), escapes, positions across comments and newlines, and that every error reports the right line and column.`,
          files: [
            { path: "pyproject.toml", lang: "toml", code: `[project]
name = "pebble"
version = "1.0.0"
description = "A small, complete interpreter for the Pebble language"
requires-python = ">=3.11"

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]` },
            { path: "pebble/__init__.py", lang: "python", code: `"""Pebble: a small, complete interpreter. This file grows as the pipeline does."""` },
            { path: "pebble/errors.py", lang: "python", code: `"""Every error Pebble reports carries the line and column where it happened."""


class PebbleError(Exception):
    kind = "error"

    def __init__(self, message: str, line: int, col: int):
        super().__init__(message)
        self.message, self.line, self.col = message, line, col

    def __str__(self) -> str:
        return f"{self.line}:{self.col}: {self.kind}: {self.message}"


class LexError(PebbleError):
    kind = "syntax error"


class ParseError(PebbleError):
    kind = "syntax error"


class ResolveError(PebbleError):
    kind = "error"


class PebbleRuntimeError(PebbleError):
    kind = "runtime error"` },
            { path: "pebble/lexer.py", lang: "python", code: `"""The lexer: source text in, a list of tokens out."""
from dataclasses import dataclass

from .errors import LexError

KEYWORDS = {"let", "fn", "if", "else", "while", "return", "print", "true", "false", "nil", "and", "or"}
TWO_CHAR = {"==", "!=", "<=", ">="}
ONE_CHAR = set("+-*/%=<>!(){}[],;")
ESCAPES = {"n": "\\n", "t": "\\t", '"': '"', "\\\\": "\\\\"}


@dataclass(frozen=True)
class Token:
    kind: str  # "int", "string", "name", "keyword", "op" or "eof"
    text: str  # the lexeme; for strings, the value with escapes already decoded
    line: int
    col: int


def tokenize(src: str) -> list[Token]:
    tokens: list[Token] = []
    i, line, col = 0, 1, 1

    def advance(n: int = 1) -> None:
        nonlocal i, line, col
        for _ in range(n):
            if src[i] == "\\n":
                line, col = line + 1, 1
            else:
                col += 1
            i += 1

    while i < len(src):
        c = src[i]
        start_line, start_col = line, col
        if c in " \\t\\r\\n":
            advance()
        elif src.startswith("//", i):
            while i < len(src) and src[i] != "\\n":
                advance()
        elif c.isdigit():
            j = i
            while j < len(src) and src[j].isdigit():
                j += 1
            if j < len(src) and (src[j].isalpha() or src[j] == "_"):
                raise LexError(f"invalid number '{src[i:j + 1]}'", line, col)
            tokens.append(Token("int", src[i:j], start_line, start_col))
            advance(j - i)
        elif c.isalpha() or c == "_":
            j = i
            while j < len(src) and (src[j].isalnum() or src[j] == "_"):
                j += 1
            word = src[i:j]
            tokens.append(Token("keyword" if word in KEYWORDS else "name", word, start_line, start_col))
            advance(j - i)
        elif c == '"':
            advance()
            chars = []
            while i < len(src) and src[i] not in '"\\n':
                if src[i] == "\\\\":
                    if i + 1 >= len(src) or src[i + 1] not in ESCAPES:
                        raise LexError("unknown escape sequence in string", line, col)
                    advance()
                    chars.append(ESCAPES[src[i]])
                else:
                    chars.append(src[i])
                advance()
            if i >= len(src) or src[i] != '"':
                raise LexError("unterminated string", start_line, start_col)
            advance()
            tokens.append(Token("string", "".join(chars), start_line, start_col))
        elif src[i:i + 2] in TWO_CHAR:
            tokens.append(Token("op", src[i:i + 2], start_line, start_col))
            advance(2)
        elif c in ONE_CHAR:
            tokens.append(Token("op", c, start_line, start_col))
            advance()
        else:
            raise LexError(f"unexpected character {c!r}", line, col)
    tokens.append(Token("eof", "", line, col))
    return tokens` },
            { path: "tests/test_lexer.py", lang: "python", code: `import pytest

from pebble.errors import LexError
from pebble.lexer import tokenize


def kinds_and_texts(src):
    return [(t.kind, t.text) for t in tokenize(src)][:-1]  # drop the eof token


def test_numbers_names_keywords_and_operators():
    assert kinds_and_texts("let x1 = 42;") == [
        ("keyword", "let"), ("name", "x1"), ("op", "="), ("int", "42"), ("op", ";")]


def test_two_character_operators_win_over_one_character_ones():
    assert [t for _, t in kinds_and_texts("a<=b == c != d >= e")] == ["a", "<=", "b", "==", "c", "!=", "d", ">=", "e"]


def test_a_keyword_inside_a_longer_name_is_just_a_name():
    assert kinds_and_texts("iffy if") == [("name", "iffy"), ("keyword", "if")]


def test_strings_decode_escapes():
    assert kinds_and_texts(r'"tab\\there \\"q\\" \\\\ end\\n"') == [("string", 'tab\\there "q" \\\\ end\\n')]


def test_comments_and_whitespace_are_skipped_and_positions_are_tracked():
    tokens = tokenize("// a comment\\n  let y = 1; // another\\nprint y;")
    assert [(t.text, t.line, t.col) for t in tokens[:2]] == [("let", 2, 3), ("y", 2, 7)]
    assert (tokens[5].text, tokens[5].line, tokens[5].col) == ("print", 3, 1)
    assert tokens[-1].kind == "eof"


@pytest.mark.parametrize("src, message, line, col", [
    ('print "oops;', "unterminated string", 1, 7),
    ("let x = 5 @ 3;", "unexpected character '@'", 1, 11),
    ("let 9lives = 1;", "invalid number '9l'", 1, 5),
    (r'"bad \\q"', "unknown escape sequence in string", 1, 6),
])
def test_errors_say_where(src, message, line, col):
    with pytest.raises(LexError) as e:
        tokenize(src)
    assert (e.value.message, e.value.line, e.value.col) == (message, line, col)` },
          ],
          run: `python -m pytest -q
python -c 'from pebble.lexer import tokenize
for t in tokenize("let total = 10; // ten\\nprint total >= 3, \\"hi\\\\n\\";"): print(t.line, t.col, t.kind, repr(t.text))'`,
          output: `9 passed
1 1 keyword 'let'
1 5 name 'total'
1 11 op '='
1 13 int '10'
1 15 op ';'
2 1 keyword 'print'
2 7 name 'total'
2 13 op '>='
2 16 int '3'
2 17 op ','
2 19 string 'hi\\n'
2 25 op ';'
2 26 eof ''`,
        },
        {
          title: "2. Trees: the AST and the parser",
          explain: `Now turn tokens into a **tree**.
- \`nodes.py\` has one dataclass per kind of node: expressions (\`Literal\`, \`Var\`, \`Unary\`, \`Binary\`, \`Call\`, \`ListLit\`, \`Index\`, \`Lambda\`) and statements (\`Let\`, \`Assign\`, \`Print\`, \`If\`, \`While\`, \`FnDecl\`, \`Return\`, \`ExprStmt\`, \`Block\`). \`eq=False\` makes nodes compare and hash by **identity**: two different \`x\` variables are different keys in a dictionary, which the resolver needs in step 4.
- \`parser.py\` uses **recursive descent** for statements (\`statement()\` dispatches on the first token) and **Pratt parsing** for binary operators (\`expression(min_power)\` with the \`BINARY\` table). Unary operators are parsed in \`unary()\`, calls and indexing are postfix operators in \`postfix()\`.
- \`fn\` is used two ways: \`fn name(...)\` declares a function; \`fn(...)\` without a name is an anonymous function expression. The parser peeks one token ahead to tell them apart.
- \`else if\` is just \`else\` followed by an \`if\` statement wrapped in a list. Assignment parses an expression first, then checks it's a variable or list element.
- The tests compare trees as s-expressions (precedence, associativity, calls, unary minus) and check every syntax error's message, line and column.`,
          files: [
            { path: "pebble/nodes.py", lang: "python", code: `"""The abstract syntax tree. eq=False makes nodes hashable by identity, so the resolver can use
them as dictionary keys."""
from __future__ import annotations

from dataclasses import dataclass, field


# ---- expressions
@dataclass(eq=False)
class Literal:
    value: object  # an int, str, bool or None
    line: int = 0


@dataclass(eq=False)
class Var:
    name: str
    line: int = 0
    col: int = 0


@dataclass(eq=False)
class Unary:
    op: str
    operand: Expr
    line: int = 0


@dataclass(eq=False)
class Binary:
    op: str  # arithmetic, comparison, "and" or "or"
    left: Expr
    right: Expr
    line: int = 0


@dataclass(eq=False)
class Call:
    callee: Expr
    args: list[Expr]
    line: int = 0


@dataclass(eq=False)
class ListLit:
    items: list[Expr]
    line: int = 0


@dataclass(eq=False)
class Index:
    target: Expr
    index: Expr
    line: int = 0


@dataclass(eq=False)
class Lambda:
    params: list[str]
    body: list[Stmt]
    line: int = 0
    name: str = "<anonymous>"


Expr = Literal | Var | Unary | Binary | Call | ListLit | Index | Lambda


# ---- statements
@dataclass(eq=False)
class Let:
    name: str
    value: Expr
    line: int = 0
    col: int = 0


@dataclass(eq=False)
class Assign:
    target: Var | Index
    value: Expr
    line: int = 0


@dataclass(eq=False)
class Print:
    values: list[Expr]
    line: int = 0


@dataclass(eq=False)
class If:
    cond: Expr
    then: list[Stmt]
    otherwise: list[Stmt] | None = None
    line: int = 0


@dataclass(eq=False)
class While:
    cond: Expr
    body: list[Stmt]
    line: int = 0


@dataclass(eq=False)
class FnDecl:
    name: str
    fn: Lambda
    line: int = 0
    col: int = 0


@dataclass(eq=False)
class Return:
    value: Expr | None
    line: int = 0
    col: int = 0


@dataclass(eq=False)
class ExprStmt:
    expr: Expr
    line: int = 0


@dataclass(eq=False)
class Block:
    stmts: list[Stmt] = field(default_factory=list)
    line: int = 0


Stmt = Let | Assign | Print | If | While | FnDecl | Return | ExprStmt | Block` },
            { path: "pebble/parser.py", lang: "python", code: `"""The parser: tokens in, an AST out. Recursive descent for statements, precedence climbing
(Pratt parsing) for expressions."""
from .errors import ParseError
from .lexer import Token, tokenize
from .nodes import (Assign, Binary, Block, Call, Expr, ExprStmt, FnDecl, If, Index, Lambda, Let,
                    ListLit, Literal, Print, Return, Stmt, Unary, Var, While)

# binding power of each binary operator: higher binds tighter. All are left-associative.
BINARY = {"or": 1, "and": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4,
          "+": 5, "-": 5, "*": 6, "/": 6, "%": 6}


class Parser:
    def __init__(self, tokens: list[Token]):
        self.tokens, self.pos = tokens, 0

    # ---------------------------------------------------------------- helpers
    @property
    def tok(self) -> Token:
        return self.tokens[self.pos]

    def at(self, *texts: str) -> bool:
        return self.tok.kind in ("op", "keyword") and self.tok.text in texts

    def advance(self) -> Token:
        tok = self.tok
        if tok.kind != "eof":
            self.pos += 1
        return tok

    def expect(self, text: str, what: str | None = None) -> Token:
        if not self.at(text):
            self.error(f"expected {what or repr(text)}")
        return self.advance()

    def error(self, message: str):
        found = "end of input" if self.tok.kind == "eof" else repr(self.tok.text)
        raise ParseError(f"{message}, found {found}", self.tok.line, self.tok.col)

    def name(self) -> Token:
        if self.tok.kind != "name":
            self.error("expected a name")
        return self.advance()

    # ---------------------------------------------------------------- statements
    def program(self) -> list[Stmt]:
        stmts = []
        while self.tok.kind != "eof":
            stmts.append(self.statement())
        return stmts

    def block(self) -> list[Stmt]:
        self.expect("{")
        stmts = []
        while not self.at("}"):
            if self.tok.kind == "eof":
                self.error("missing '}'")
            stmts.append(self.statement())
        self.advance()
        return stmts

    def statement(self) -> Stmt:
        tok = self.tok
        if self.at("let"):
            self.advance()
            name = self.name()
            self.expect("=")
            value = self.expression()
            self.expect(";", "';' after the value")
            return Let(name.text, value, name.line, name.col)
        if self.at("print"):
            self.advance()
            values = [self.expression()]
            while self.at(","):
                self.advance()
                values.append(self.expression())
            self.expect(";", "';' after print")
            return Print(values, tok.line)
        if self.at("if"):
            return self.if_statement()
        if self.at("while"):
            self.advance()
            cond = self.expression()
            return While(cond, self.block(), tok.line)
        if self.at("fn") and self.tokens[self.pos + 1].kind == "name":  # a declaration, not a lambda
            self.advance()
            name = self.name()
            return FnDecl(name.text, self.function_rest(tok.line, name.text), name.line, name.col)
        if self.at("return"):
            self.advance()
            value = None if self.at(";") else self.expression()
            self.expect(";", "';' after return")
            return Return(value, tok.line, tok.col)
        if self.at("{"):
            return Block(self.block(), tok.line)
        expr = self.expression()
        if self.at("="):
            if not isinstance(expr, (Var, Index)):
                self.error("can only assign to a variable or a list element")
            self.advance()
            value = self.expression()
            self.expect(";", "';' after the assignment")
            return Assign(expr, value, tok.line)
        self.expect(";", "';' after the expression")
        return ExprStmt(expr, tok.line)

    def if_statement(self) -> If:
        line = self.advance().line
        cond = self.expression()
        then = self.block()
        otherwise = None
        if self.at("else"):
            self.advance()
            otherwise = [self.if_statement()] if self.at("if") else self.block()
        return If(cond, then, otherwise, line)

    def function_rest(self, line: int, name: str = "<anonymous>") -> Lambda:
        self.expect("(")
        params: list[str] = []
        while not self.at(")"):
            p = self.name()
            if p.text in params:
                raise ParseError(f"duplicate parameter '{p.text}'", p.line, p.col)
            params.append(p.text)
            if not self.at(")"):
                self.expect(",", "',' or ')'")
        self.advance()
        return Lambda(params, self.block(), line, name)

    # ---------------------------------------------------------------- expressions
    def expression(self, min_power: int = 1) -> Expr:
        left = self.unary()
        while self.tok.kind in ("op", "keyword") and BINARY.get(self.tok.text, 0) >= min_power:
            op = self.advance()
            right = self.expression(BINARY[op.text] + 1)  # +1 makes the operator left-associative
            left = Binary(op.text, left, right, op.line)
        return left

    def unary(self) -> Expr:
        if self.at("-", "!"):
            op = self.advance()
            return Unary(op.text, self.unary(), op.line)
        return self.postfix()

    def postfix(self) -> Expr:
        expr = self.primary()
        while self.at("(", "["):
            tok = self.advance()
            if tok.text == "(":
                args = []
                while not self.at(")"):
                    args.append(self.expression())
                    if not self.at(")"):
                        self.expect(",", "',' or ')'")
                self.advance()
                expr = Call(expr, args, tok.line)
            else:
                index = self.expression()
                self.expect("]")
                expr = Index(expr, index, tok.line)
        return expr

    def primary(self) -> Expr:
        tok = self.tok
        if tok.kind == "int":
            self.advance()
            return Literal(int(tok.text), tok.line)
        if tok.kind == "string":
            self.advance()
            return Literal(tok.text, tok.line)
        if tok.kind == "name":
            self.advance()
            return Var(tok.text, tok.line, tok.col)
        if self.at("true", "false", "nil"):
            self.advance()
            return Literal({"true": True, "false": False, "nil": None}[tok.text], tok.line)
        if self.at("("):
            self.advance()
            expr = self.expression()
            self.expect(")")
            return expr
        if self.at("["):
            self.advance()
            items = []
            while not self.at("]"):
                items.append(self.expression())
                if not self.at("]"):
                    self.expect(",", "',' or ']'")
            self.advance()
            return ListLit(items, tok.line)
        if self.at("fn"):
            self.advance()
            return self.function_rest(tok.line)
        self.error("expected an expression")


def parse(src: str) -> list[Stmt]:
    return Parser(tokenize(src)).program()` },
            { path: "tests/test_parser.py", lang: "python", code: `import pytest

from pebble.errors import ParseError
from pebble.nodes import Assign, Binary, Call, ExprStmt, FnDecl, If, Index, Lambda, Let, ListLit, Literal, Unary, Var
from pebble.parser import parse


def sx(e):
    """An expression as an s-expression, to check the shape of the tree."""
    match e:
        case Literal(value):
            return repr(value)
        case Var(name):
            return name
        case Unary(op, operand):
            return f"({op} {sx(operand)})"
        case Binary(op, left, right):
            return f"({op} {sx(left)} {sx(right)})"
        case Call(callee, args):
            return f"(call {' '.join(sx(x) for x in [callee, *args])})"
        case Index(target, index):
            return f"(index {sx(target)} {sx(index)})"
        case ListLit(items):
            return f"[{' '.join(sx(i) for i in items)}]"
        case Lambda(params):
            return f"(fn {' '.join(params)})"


def expr(src):
    [stmt] = parse(src + ";")
    assert isinstance(stmt, ExprStmt)
    return sx(stmt.expr)


@pytest.mark.parametrize("src, tree", [
    ("1 + 2 * 3", "(+ 1 (* 2 3))"),
    ("(1 + 2) * 3", "(* (+ 1 2) 3)"),
    ("10 - 4 - 3", "(- (- 10 4) 3)"),                       # left-associative
    ("-2 * -x", "(* (- 2) (- x))"),
    ("a < b == c", "(== (< a b) c)"),
    ("a or b and !c", "(or a (and b (! c)))"),
    ("f(1, g(2))[0](x)", "(call (index (call f 1 (call g 2)) 0) x)"),
    ('[1, "two", true, nil]', "[1 'two' True None]"),
    ("fn(a, b) { return a; }", "(fn a b)"),
])
def test_precedence_and_associativity(src, tree):
    assert expr(src) == tree


def test_statements():
    let, assign, setitem, fn, cond = parse("""
        let x = 1;
        x = x + 1;
        xs[0] = 5;
        fn add(a, b) { return a + b; }
        if x > 1 { print x; } else if x < 0 { print 0; } else { print 1; }
    """)
    assert isinstance(let, Let) and let.name == "x"
    assert isinstance(assign, Assign) and isinstance(assign.target, Var)
    assert isinstance(setitem, Assign) and isinstance(setitem.target, Index)
    assert isinstance(fn, FnDecl) and fn.fn.params == ["a", "b"]
    assert isinstance(cond, If) and isinstance(cond.otherwise[0], If)  # else if = an if inside the else


@pytest.mark.parametrize("src, message, line, col", [
    ("let x = 1 + ;", "expected an expression, found ';'", 1, 13),
    ("print (1 + 2;", "expected ')', found ';'", 1, 13),
    ("let = 5;", "expected a name, found '='", 1, 5),
    ("fn f(a b) {}", "expected ',' or ')', found 'b'", 1, 8),
    ("1 + 2 = 3;", "can only assign to a variable or a list element, found '='", 1, 7),
    ("fn f(a, a) {}", "duplicate parameter 'a'", 1, 9),
    ("if x {\\n  print x;\\n", "missing '}', found end of input", 3, 1),
    ("let y = 2\\nprint y;", "expected ';' after the value, found 'print'", 2, 1),
])
def test_syntax_errors_say_what_and_where(src, message, line, col):
    with pytest.raises(ParseError) as e:
        parse(src)
    assert (e.value.message, e.value.line, e.value.col) == (message, line, col)` },
          ],
          run: `python -m pytest -q
python -c 'from pebble.parser import parse
for stmt in parse("let x = 1 + 2 * 3;\\nif x > 5 { print x; }"): print(stmt)'`,
          output: `27 passed
Let(name='x', value=Binary(op='+', left=Literal(value=1, line=1), right=Binary(op='*', left=Literal(value=2, line=1), right=Literal(value=3, line=1), line=1), line=1), line=1, col=5)
If(cond=Binary(op='>', left=Var(name='x', line=2, col=4), right=Literal(value=5, line=2), line=2), then=[Print(values=[Var(name='x', line=2, col=18)], line=2)], otherwise=None, line=2)`,
        },
        {
          title: "3. Running it: the tree-walking interpreter",
          explain: `The biggest step: make programs **run**.
- \`Environment\` is a dictionary plus an \`enclosing\` link. \`find\` searches outwards by name; \`ancestor(depth)\` jumps exactly \`depth\` parents (used in step 4).
- \`Function\` is a **closure**: the \`Lambda\` node plus the environment it was created in. \`call()\` makes a new environment whose parent is \`fn.closure\` and binds the parameters there.
- \`execute\` and \`evaluate\` use Python's \`match\` statement: each \`case\` reads like the language specification. \`return\` raises \`ReturnSignal\`, caught in \`call()\`.
- \`binary()\` enforces Pebble's rules instead of Python's: \`==\` requires equal **types** (so \`1 == true\` is false even though Python says \`1 == True\`), \`+\` joins strings or lists, everything else needs ints, and division by zero is a \`PebbleRuntimeError\` with a line number.
- Built-ins (\`len\`, \`push\`, \`str\`, \`type\`) are \`Builtin\` objects in the global environment, called like any function.
- \`run()\` raises Python's recursion limit while the program runs (each Pebble call uses several Python frames) and turns \`RecursionError\` into a Pebble "stack overflow".
- \`__init__.py\` now has \`run(src)\`: parse, then interpret. The \`locals\` and \`resolved\` fields of \`Interpreter\` stay unused until step 4: \`scope_of\` falls back to searching by name.`,
          files: [
            { path: "pebble/interpreter.py", lang: "python", code: `"""The tree-walking interpreter: it runs a program by walking its AST."""
from __future__ import annotations

import operator
import sys
from typing import TextIO

from .errors import PebbleRuntimeError
from .nodes import (Assign, Binary, Block, Call, Expr, ExprStmt, FnDecl, If, Index, Lambda, Let,
                    ListLit, Literal, Print, Return, Stmt, Unary, Var, While)


ARITHMETIC = {"+": operator.add, "-": operator.sub, "*": operator.mul, "/": operator.floordiv,
              "%": operator.mod, "<": operator.lt, "<=": operator.le, ">": operator.gt, ">=": operator.ge}


class Environment:
    """One scope: its own variables, plus a link to the scope around it."""

    def __init__(self, enclosing: Environment | None = None):
        self.values: dict[str, object] = {}
        self.enclosing = enclosing

    def define(self, name: str, value: object) -> None:
        self.values[name] = value

    def ancestor(self, depth: int) -> Environment:
        env = self
        for _ in range(depth):
            env = env.enclosing
        return env

    def find(self, name: str) -> Environment | None:
        env = self
        while env is not None and name not in env.values:
            env = env.enclosing
        return env


class Function:
    """A closure: the function's code plus the environment it was created in."""

    def __init__(self, decl: Lambda, closure: Environment):
        self.decl, self.closure = decl, closure

    @property
    def arity(self) -> int:
        return len(self.decl.params)

    def __repr__(self) -> str:
        return f"<fn {self.decl.name}>"


class Builtin:
    def __init__(self, name: str, arity: int, fn):
        self.name, self.arity, self.fn = name, arity, fn

    def __repr__(self) -> str:
        return f"<builtin {self.name}>"


class ReturnSignal(Exception):
    """Raised by \`return\` and caught by the call that's returning."""

    def __init__(self, value: object):
        self.value = value


def show(value: object) -> str:
    """How print displays a value."""
    if value is None:
        return "nil"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, list):
        return "[" + ", ".join(repr_in_list(v) for v in value) + "]"
    return str(value)


def repr_in_list(value: object) -> str:
    return '"' + value + '"' if isinstance(value, str) else show(value)


def truthy(value: object) -> bool:
    return value is not None and value is not False  # only nil and false are false


def type_name(value: object) -> str:
    if value is None:
        return "nil"
    if isinstance(value, bool):
        return "bool"
    return {int: "int", str: "string", list: "list"}.get(type(value), "function")


class Interpreter:
    def __init__(self, out: TextIO | None = None):
        self.out = out or sys.stdout
        self.globals = Environment()
        self.locals: dict[Expr, int] = {}  # from the resolver: how many scopes up each local variable lives
        self.resolved = False              # True once the resolver has run (step 4)
        for b in [
            Builtin("len", 1, self._len),
            Builtin("push", 2, self._push),
            Builtin("str", 1, lambda line, v: show(v)),
            Builtin("type", 1, lambda line, v: type_name(v)),
        ]:
            self.globals.define(b.name, b)

    # ---------------------------------------------------------------- built-ins
    def _len(self, line: int, v: object) -> int:
        if not isinstance(v, (str, list)):
            raise PebbleRuntimeError(f"len() needs a string or a list, got {type_name(v)}", line, 0)
        return len(v)

    def _push(self, line: int, xs: object, v: object) -> None:
        if not isinstance(xs, list):
            raise PebbleRuntimeError(f"push() needs a list, got {type_name(xs)}", line, 0)
        xs.append(v)

    # ---------------------------------------------------------------- statements
    def run(self, program: list[Stmt]) -> None:
        old_limit = sys.getrecursionlimit()
        sys.setrecursionlimit(max(old_limit, 20_000))  # each Pebble call uses several Python frames
        try:
            for stmt in program:
                self.execute(stmt, self.globals)
        except RecursionError:
            raise PebbleRuntimeError("stack overflow (too much recursion)", 0, 0) from None
        finally:
            sys.setrecursionlimit(old_limit)

    def execute_block(self, stmts: list[Stmt], env: Environment) -> None:
        for stmt in stmts:
            self.execute(stmt, env)

    def execute(self, stmt: Stmt, env: Environment) -> None:
        match stmt:
            case Let(name, value):
                env.define(name, self.evaluate(value, env))
            case Assign(Var() as target, value):
                v = self.evaluate(value, env)
                self.scope_of(target, env).values[target.name] = v
            case Assign(Index() as target, value):
                xs, i = self.list_and_index(target, env)
                xs[i] = self.evaluate(value, env)
            case Print(values):
                print(" ".join(show(self.evaluate(v, env)) for v in values), file=self.out)
            case If(cond, then, otherwise):
                if truthy(self.evaluate(cond, env)):
                    self.execute_block(then, Environment(env))
                elif otherwise is not None:
                    self.execute_block(otherwise, Environment(env))
            case While(cond, body):
                while truthy(self.evaluate(cond, env)):
                    self.execute_block(body, Environment(env))
            case FnDecl(name, fn):
                env.define(name, Function(fn, env))  # capture env: this is what makes closures work
            case Return(value):
                raise ReturnSignal(None if value is None else self.evaluate(value, env))
            case ExprStmt(expr):
                self.evaluate(expr, env)
            case Block(stmts):
                self.execute_block(stmts, Environment(env))

    # ---------------------------------------------------------------- expressions
    def scope_of(self, var: Var, env: Environment) -> Environment:
        depth = self.locals.get(var)
        if depth is not None:
            return env.ancestor(depth)  # the resolver told us exactly where it lives
        if self.resolved:  # not a local, so it must be a global
            found = self.globals if var.name in self.globals.values else None
        else:              # no resolver: search outwards scope by scope
            found = env.find(var.name)
        if found is None:
            raise PebbleRuntimeError(f"undefined variable '{var.name}'", var.line, var.col)
        return found

    def evaluate(self, expr: Expr, env: Environment) -> object:
        match expr:
            case Literal(value):
                return value
            case Var(name):
                return self.scope_of(expr, env).values[name]
            case Unary("-", operand):
                v = self.evaluate(operand, env)
                if type(v) is not int:
                    raise PebbleRuntimeError(f"can't negate a {type_name(v)}", expr.line, 0)
                return -v
            case Unary("!", operand):
                return not truthy(self.evaluate(operand, env))
            case Binary("and", left, right):
                v = self.evaluate(left, env)
                return self.evaluate(right, env) if truthy(v) else v  # short-circuit
            case Binary("or", left, right):
                v = self.evaluate(left, env)
                return v if truthy(v) else self.evaluate(right, env)
            case Binary(op, left, right):
                return self.binary(op, self.evaluate(left, env), self.evaluate(right, env), expr.line)
            case Call(callee, args):
                return self.call(self.evaluate(callee, env), [self.evaluate(a, env) for a in args], expr.line)
            case ListLit(items):
                return [self.evaluate(i, env) for i in items]
            case Index():
                xs, i = self.list_and_index(expr, env)
                return xs[i]
            case Lambda():
                return Function(expr, env)
        raise AssertionError(f"unknown expression {expr!r}")

    def binary(self, op: str, a: object, b: object, line: int) -> object:
        if op == "==":
            return type(a) is type(b) and a == b  # 1 == true is false: no sneaky conversions
        if op == "!=":
            return not (type(a) is type(b) and a == b)
        if op == "+" and isinstance(a, str) and isinstance(b, str):
            return a + b
        if op == "+" and isinstance(a, list) and isinstance(b, list):
            return a + b
        if type(a) is not int or type(b) is not int:
            raise PebbleRuntimeError(f"'{op}' can't be used with {type_name(a)} and {type_name(b)}", line, 0)
        if op in ("/", "%") and b == 0:
            raise PebbleRuntimeError("division by zero", line, 0)
        return ARITHMETIC[op](a, b)

    def list_and_index(self, expr: Index, env: Environment) -> tuple[list, int]:
        xs, i = self.evaluate(expr.target, env), self.evaluate(expr.index, env)
        if not isinstance(xs, list):
            raise PebbleRuntimeError(f"can only index a list, not a {type_name(xs)}", expr.line, 0)
        if type(i) is not int:
            raise PebbleRuntimeError(f"list index must be an int, not a {type_name(i)}", expr.line, 0)
        if not 0 <= i < len(xs):
            raise PebbleRuntimeError(f"index {i} is out of range for a list of length {len(xs)}", expr.line, 0)
        return xs, i

    def call(self, fn: object, args: list[object], line: int) -> object:
        if not isinstance(fn, (Function, Builtin)):
            raise PebbleRuntimeError(f"can only call functions, not a {type_name(fn)}", line, 0)
        if len(args) != fn.arity:
            raise PebbleRuntimeError(f"{fn!r} expects {fn.arity} argument(s), got {len(args)}", line, 0)
        if isinstance(fn, Builtin):
            return fn.fn(line, *args)
        frame = Environment(fn.closure)  # a new scope whose parent is where the function was DEFINED
        for name, value in zip(fn.decl.params, args):
            frame.define(name, value)
        try:
            self.execute_block(fn.decl.body, frame)
        except ReturnSignal as r:
            return r.value
        return None` },
            { path: "pebble/__init__.py", lang: "python", code: `"""Pebble: a small, complete interpreter. run() is the whole pipeline in one call."""
from typing import TextIO

from .errors import LexError, ParseError, PebbleError, PebbleRuntimeError
from .interpreter import Interpreter
from .parser import parse

__all__ = ["run", "Interpreter", "PebbleError", "LexError", "ParseError", "PebbleRuntimeError"]


def run(src: str, out: TextIO | None = None, interpreter: Interpreter | None = None) -> Interpreter:
    """Lex, parse and run src. Pass an interpreter to keep variables between calls (the REPL)."""
    program = parse(src)                      # LexError / ParseError
    interp = interpreter or Interpreter(out)
    interp.run(program)                       # PebbleRuntimeError
    return interp` },
            { path: "tests/test_interpreter.py", lang: "python", code: `import io

import pytest

from pebble import run
from pebble.errors import PebbleRuntimeError


def output(src):
    out = io.StringIO()
    run(src, out)
    return out.getvalue().rstrip("\\n").split("\\n")


def test_arithmetic_and_printing():
    assert output("print 1 + 2 * 3, 7 / 2, -7 / 2, 7 % 3, (1 + 2) * 3;") == ["7 3 -4 1 9"]


def test_strings_booleans_and_nil():
    assert output('print "a" + "b", true, nil, !nil, 1 == 1, 1 == true, "x" != "y";') == [
        "ab true nil true true false true"]


def test_only_nil_and_false_are_falsey():
    assert output('if 0 { print "0 is true"; } if "" { print "empty is true"; } if nil { print "no"; }') == [
        "0 is true", "empty is true"]


def test_and_or_short_circuit():
    assert output("fn boom() { return 1 / 0; } print false and boom(), true or boom(), nil or 5;") == ["false true 5"]


def test_variables_scopes_and_shadowing():
    assert output("""
        let x = "outer";
        { let x = "inner"; print x; x = "changed"; print x; }
        print x;
        let i = 0; while i < 3 { i = i + 1; } print i;
    """) == ["inner", "changed", "outer", "3"]


def test_functions_and_recursion():
    assert output("""
        fn fact(n) { if n <= 1 { return 1; } return n * fact(n - 1); }
        fn nothing() {}
        print fact(20), nothing();
    """) == ["2432902008176640000 nil"]


def test_closures_keep_their_own_state():
    assert output("""
        fn counter() { let n = 0; return fn() { n = n + 1; return n; }; }
        let a = counter(); let b = counter();
        a(); a();
        print a(), b();
    """) == ["3 1"]


def test_lists_and_builtins():
    assert output("""
        let xs = [3, 1, 2];
        push(xs, 10); xs[0] = 7;
        print xs, len(xs), len("hey"), xs + [0], type(xs), type(len), str(42) + "!";
    """) == ["[7, 1, 2, 10] 4 3 [7, 1, 2, 10, 0] list function 42!"]


def test_deep_recursion_works():
    assert output("fn down(n) { if n == 0 { return 0; } return down(n - 1); } print down(2000);") == ["0"]


@pytest.mark.parametrize("src, message, line", [
    ("print 1 / 0;", "division by zero", 1),
    ('let a = 1;\\nprint a + "1";', "'+' can't be used with int and string", 2),
    ("print missing;", "undefined variable 'missing'", 1),
    ("let x = 5;\\n\\nx();", "can only call functions, not a int", 3),
    ("fn f(a) { return a; } f(1, 2);", "<fn f> expects 1 argument(s), got 2", 1),
    ("let xs = [1]; print xs[3];", "index 3 is out of range for a list of length 1", 1),
    ("print len(5);", "len() needs a string or a list, got int", 1),
    ("fn forever(n) { return forever(n + 1); } forever(0);", "stack overflow (too much recursion)", 0),
])
def test_runtime_errors(src, message, line):
    with pytest.raises(PebbleRuntimeError) as e:
        output(src)
    assert (e.value.message, e.value.line) == (message, line)` },
          ],
          run: `python -m pytest -q
python - <<'EOF'
from pebble import run
run("""
fn fib(n) { if n < 2 { return n; } return fib(n - 1) + fib(n - 2); }
let xs = [1, 2, 3];
push(xs, fib(10));
print "xs is", xs, "with", len(xs), "items";
print 7 / 2, -7 / 2, "a" + "b", 1 == true;
""")
EOF`,
          output: `44 passed
xs is [1, 2, 3, 55] with 4 items
3 -4 ab false`,
        },
        {
          title: "4. Scopes done right: the resolver",
          explain: `The interpreter from step 3 has a subtle bug. Look at this program:
\`\`\`text
let a = "global";
{
  fn show() { print a; }
  show();             // global
  let a = "local";
  show();             // should still be global!
}
\`\`\`
\`show\` was **written** where \`a\` meant the global, but searching by name at run time finds the new local \`a\` in the block's environment. Lexical scoping says the meaning of a name is fixed where it's written.

The **resolver** fixes this with one pass **before** running:
- It keeps a stack of scopes that mirrors **exactly** the environments the interpreter will create: one per block, one per function call (parameters and body together).
- For every \`Var\` it finds the declaration and records the **depth**: how many scopes up it is. It stores this in a dictionary keyed by the \`Var\` node itself (that's why nodes hash by identity).
- Variables not found in any local scope are **globals**, looked up in the global environment at run time. That keeps the REPL and functions that use globals defined later working.
- Each name is first **declared** (\`False\`: not ready) and then **defined** (\`True\`), so \`let a = a;\` in a local scope is caught.
- It also reports \`'return' outside a function\` and duplicate declarations in one local scope, **before** any code runs.

\`run()\` now resolves first and hands the depths to the interpreter (\`interp.resolved = True\`), whose \`scope_of\` then jumps straight to \`env.ancestor(depth)\`. The tests run the program above both ways.`,
          files: [
            { path: "pebble/resolver.py", lang: "python", code: `"""The resolver: a pass over the AST BEFORE running it. For every local variable it records how many
scopes up its declaration is, so lookups are exact (and fast), and it reports mistakes that can be
found without running the program."""
from .errors import ResolveError
from .nodes import (Assign, Binary, Block, Call, Expr, ExprStmt, FnDecl, If, Index, Lambda, Let,
                    ListLit, Literal, Print, Return, Stmt, Unary, Var, While)


class Resolver:
    def __init__(self):
        self.scopes: list[dict[str, bool]] = []  # local scopes only; globals are looked up at run time
        self.locals: dict[Expr, int] = {}
        self.in_function = 0

    def resolve(self, program: list[Stmt]) -> dict[Expr, int]:
        for stmt in program:
            self.stmt(stmt)
        return self.locals

    # scopes mirror EXACTLY the environments the interpreter creates
    def begin(self) -> None:
        self.scopes.append({})

    def end(self) -> None:
        self.scopes.pop()

    def declare(self, name: str, line: int, col: int) -> None:
        if self.scopes:
            if name in self.scopes[-1]:
                raise ResolveError(f"'{name}' is already declared in this scope", line, col)
            self.scopes[-1][name] = False  # declared, but not ready to read yet

    def define(self, name: str) -> None:
        if self.scopes:
            self.scopes[-1][name] = True

    def block(self, stmts: list[Stmt]) -> None:
        self.begin()
        for s in stmts:
            self.stmt(s)
        self.end()

    def function(self, fn: Lambda) -> None:
        self.in_function += 1
        self.begin()
        for p in fn.params:
            self.define(p)
        for s in fn.body:  # the body runs in the same environment as the parameters
            self.stmt(s)
        self.end()
        self.in_function -= 1

    def stmt(self, stmt: Stmt) -> None:
        match stmt:
            case Let(name, value):
                self.declare(name, stmt.line, stmt.col)
                self.expr(value)
                self.define(name)
            case Assign(target, value):
                self.expr(value)
                self.expr(target)
            case Print(values):
                for v in values:
                    self.expr(v)
            case If(cond, then, otherwise):
                self.expr(cond)
                self.block(then)
                if otherwise is not None:
                    self.block(otherwise)
            case While(cond, body):
                self.expr(cond)
                self.block(body)
            case FnDecl(name, fn):
                self.declare(name, stmt.line, stmt.col)
                self.define(name)  # defined before the body, so the function can call itself
                self.function(fn)
            case Return(value):
                if not self.in_function:
                    raise ResolveError("'return' outside a function", stmt.line, stmt.col)
                if value is not None:
                    self.expr(value)
            case ExprStmt(expr):
                self.expr(expr)
            case Block(stmts):
                self.block(stmts)

    def expr(self, expr: Expr) -> None:
        match expr:
            case Var(name):
                for depth, scope in enumerate(reversed(self.scopes)):
                    if name in scope:
                        if scope[name] is False:
                            raise ResolveError(f"can't read '{name}' in its own initializer", expr.line, expr.col)
                        self.locals[expr] = depth
                        return
                # not found in any local scope: it's a global, checked when the program runs
            case Unary(_, operand):
                self.expr(operand)
            case Binary(_, left, right):
                self.expr(left)
                self.expr(right)
            case Call(callee, args):
                self.expr(callee)
                for a in args:
                    self.expr(a)
            case ListLit(items):
                for i in items:
                    self.expr(i)
            case Index(target, index):
                self.expr(target)
                self.expr(index)
            case Lambda():
                self.function(expr)
            case Literal():
                pass` },
            { path: "pebble/__init__.py", lang: "python", code: `"""Pebble: a small, complete interpreter. run() is the whole pipeline in one call."""
from typing import TextIO

from .errors import LexError, ParseError, PebbleError, PebbleRuntimeError, ResolveError
from .interpreter import Interpreter
from .parser import parse
from .resolver import Resolver

__all__ = ["run", "Interpreter", "PebbleError", "LexError", "ParseError", "ResolveError", "PebbleRuntimeError"]


def run(src: str, out: TextIO | None = None, interpreter: Interpreter | None = None) -> Interpreter:
    """Lex, parse, resolve and run src. Pass an interpreter to keep variables between calls (the REPL)."""
    program = parse(src)                      # LexError / ParseError
    locals_ = Resolver().resolve(program)     # ResolveError
    interp = interpreter or Interpreter(out)
    interp.locals.update(locals_)
    interp.resolved = True
    interp.run(program)                       # PebbleRuntimeError
    return interp` },
            { path: "tests/test_resolver.py", lang: "python", code: `import io

import pytest

from pebble import run
from pebble.errors import ResolveError
from pebble.interpreter import Interpreter
from pebble.parser import parse

# A function should see the variables that were in scope where it was WRITTEN. Searching scopes by
# name at run time gets this wrong when a block declares a new variable after the function.
CLOSURE_TRAP = """
let a = "global";
{
  fn show() { print a; }
  show();
  let a = "local";
  show();
}
"""


def test_without_the_resolver_the_closure_sees_the_wrong_variable():
    out = io.StringIO()
    Interpreter(out).run(parse(CLOSURE_TRAP))  # no resolver: names are searched at run time
    assert out.getvalue().split() == ["global", "local"]


def test_with_the_resolver_the_closure_is_bound_where_it_was_written():
    out = io.StringIO()
    run(CLOSURE_TRAP, out)
    assert out.getvalue().split() == ["global", "global"]


@pytest.mark.parametrize("src, message", [
    ("{ let a = a; }", "can't read 'a' in its own initializer"),
    ("fn f() { let x = 1; let x = 2; }", "'x' is already declared in this scope"),
    ("return 5;", "'return' outside a function"),
])
def test_mistakes_found_before_running(src, message):
    out = io.StringIO()
    with pytest.raises(ResolveError) as e:
        run("print \\"this never prints\\";\\n" + src, out)
    assert e.value.message == message
    assert out.getvalue() == ""  # nothing ran: the resolver checks the whole program first


def test_globals_may_be_redeclared_and_used_before_definition_in_functions():
    out = io.StringIO()
    run("fn later() { return value; } let value = 1; let value = 2; print later();", out)
    assert out.getvalue() == "2\\n"` },
          ],
          run: `python -m pytest -q
python - <<'EOF'
from pebble import run
from pebble.interpreter import Interpreter
from pebble.parser import parse
trap = """
let a = "global";
{
  fn show() { print a; }
  show();
  let a = "local";
  show();
}
"""
print("without the resolver:")
Interpreter().run(parse(trap))
print("with the resolver:")
run(trap)
EOF`,
          output: `50 passed
without the resolver:
global
local
with the resolver:
global
global`,
        },
        {
          title: "5. A real tool: the CLI, the REPL and examples",
          explain: `Finally, make Pebble pleasant to use.
- \`python -m pebble file.pb\` runs \`__main__.py\`. \`run_file\` reads the file and maps errors to **exit codes**: 65 for syntax and resolve errors, 70 for runtime errors, 66 for a missing file, 64 for bad usage (the BSD \`sysexits.h\` convention, also used by Crafting Interpreters).
- \`report\` prints errors like a compiler: \`file:line:col: kind: message\`, then the source line and a **caret** under the column. Errors go to **stderr**, so they never mix with the program's output.
- The **REPL** keeps one \`Interpreter\` for the whole session, so variables and functions survive between lines. If the braces aren't balanced yet, it keeps reading lines (multi-line functions work). A line that isn't a statement, like \`x * 7\`, is wrapped in \`print\` so the REPL shows its value. Errors are reported and the session continues.
- The four example programs exercise recursion, closures and higher-order functions, lists and the sieve, and in-place sorting.
- \`test_cli.py\` runs everything as a subprocess, exactly like a user would: example outputs, exit codes, carets, a missing file, and a REPL session through piped stdin.

That's a complete interpreter. Try changing the language: the extensions below are all good next steps.`,
          files: [
            { path: "pebble/__main__.py", lang: "python", code: `"""The command line:  python -m pebble program.pb   runs a file;  python -m pebble   starts a REPL."""
import sys

from . import run
from .errors import PebbleError, PebbleRuntimeError
from .interpreter import Interpreter
from .lexer import tokenize


def report(err: PebbleError, src: str, filename: str) -> None:
    """Print the error like a compiler does: file:line:col, the source line, and a caret."""
    print(f"{filename}:{err}", file=sys.stderr)
    lines = src.split("\\n")
    if 1 <= err.line <= len(lines):
        print(f"    {lines[err.line - 1]}", file=sys.stderr)
        if err.col > 0:
            print(f"    {' ' * (err.col - 1)}^", file=sys.stderr)


def run_file(path: str) -> int:
    try:
        with open(path, encoding="utf-8") as f:
            src = f.read()
    except OSError as e:
        print(f"pebble: can't open {path}: {e.strerror}", file=sys.stderr)
        return 66
    try:
        run(src)
    except PebbleRuntimeError as err:
        report(err, src, path)
        return 70  # the conventional exit codes: 65 = bad input data, 70 = internal/runtime failure
    except PebbleError as err:
        report(err, src, path)
        return 65
    return 0


def repl() -> int:
    interp = Interpreter()
    interactive = sys.stdin.isatty()
    buffer = ""
    while True:
        if interactive:
            print("...... " if buffer else "pebble> ", end="", flush=True)
        line = sys.stdin.readline()
        if not line:
            return 0
        buffer += line
        src = buffer.strip()
        if not src:
            buffer = ""
            continue
        try:
            ops = [t.text for t in tokenize(src) if t.kind == "op"]
            if ops.count("{") > ops.count("}"):
                continue  # an unfinished block: keep reading lines until the braces balance
            if not src.endswith((";", "}")):
                src = f"print {src};"  # a bare expression: show its value
            run(src, interpreter=interp)
        except PebbleError as err:
            report(err, src, "<repl>")
        buffer = ""


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        print("usage: python -m pebble [program.pb]", file=sys.stderr)
        return 64
    return run_file(argv[0]) if argv else repl()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))` },
            { path: "examples/fib.pb", lang: "javascript", code: `// Recursion: the Fibonacci numbers.
fn fib(n) {
  if n < 2 { return n; }
  return fib(n - 1) + fib(n - 2);
}

let i = 0;
while i <= 10 {
  print "fib(" + str(i) + ") =", fib(i);
  i = i + 1;
}` },
            { path: "examples/closures.pb", lang: "javascript", code: `// Closures: functions that remember the variables around them.
fn make_counter() {
  let count = 0;
  return fn() {
    count = count + 1;
    return count;
  };
}

let a = make_counter();
let b = make_counter();
a(); a();
print "a:", a(), "b:", b();   // each counter has its own count

fn compose(f, g) {
  return fn(x) { return g(f(x)); };
}
let add_one = fn(x) { return x + 1; };
let double = fn(x) { return x * 2; };
print compose(add_one, double)(5), compose(double, add_one)(5);

fn map(xs, f) {
  let out = [];
  let i = 0;
  while i < len(xs) { push(out, f(xs[i])); i = i + 1; }
  return out;
}
print map([1, 2, 3, 4], double);` },
            { path: "examples/primes.pb", lang: "javascript", code: `// The sieve of Eratosthenes.
fn primes_up_to(n) {
  let is_prime = [];
  let i = 0;
  while i <= n { push(is_prime, i >= 2); i = i + 1; }
  let p = 2;
  while p * p <= n {
    if is_prime[p] {
      let m = p * p;
      while m <= n { is_prime[m] = false; m = m + p; }
    }
    p = p + 1;
  }
  let found = [];
  i = 0;
  while i <= n {
    if is_prime[i] { push(found, i); }
    i = i + 1;
  }
  return found;
}

let ps = primes_up_to(60);
print len(ps), "primes up to 60:", ps;` },
            { path: "examples/sort.pb", lang: "javascript", code: `// Lists: insertion sort, in place.
fn sort(xs) {
  let i = 1;
  while i < len(xs) {
    let key = xs[i];
    let j = i - 1;
    while j >= 0 and xs[j] > key {
      xs[j + 1] = xs[j];
      j = j - 1;
    }
    xs[j + 1] = key;
    i = i + 1;
  }
  return xs;
}

let numbers = [31, 4, 15, 9, 26, 5, 3, 58];
print "before:", numbers;
sort(numbers);
print "after: ", numbers;` },
            { path: "tests/test_cli.py", lang: "python", code: `import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent


def pebble(*args, stdin=None):
    return subprocess.run([sys.executable, "-m", "pebble", *args], cwd=ROOT, input=stdin,
                          capture_output=True, text=True, timeout=60)


@pytest.mark.parametrize("example, first, last", [
    ("fib.pb", "fib(0) = 0", "fib(10) = 55"),
    ("closures.pb", "a: 3 b: 1", "[2, 4, 6, 8]"),
    ("sort.pb", "before: [31, 4, 15, 9, 26, 5, 3, 58]", "after:  [3, 4, 5, 9, 15, 26, 31, 58]"),
    ("primes.pb", "17 primes up to 60: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]",
     "17 primes up to 60: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]"),
])
def test_examples(example, first, last):
    r = pebble(f"examples/{example}")
    lines = r.stdout.rstrip("\\n").split("\\n")
    assert r.returncode == 0, r.stderr
    assert (lines[0], lines[-1]) == (first, last)


def test_closures_example_composes_functions():
    assert "12 11" in pebble("examples/closures.pb").stdout


def test_syntax_error_exit_code_and_caret(tmp_path):
    bad = tmp_path / "bad.pb"
    bad.write_text("let x = 1;\\nprint x +;\\n")
    r = pebble(str(bad))
    assert r.returncode == 65
    assert r.stderr.splitlines() == [f"{bad}:2:10: syntax error: expected an expression, found ';'",
                                     "    print x +;", "             ^"]


def test_runtime_error_exit_code(tmp_path):
    bad = tmp_path / "crash.pb"
    bad.write_text('print "start";\\nprint 10 / (5 - 5);\\n')
    r = pebble(str(bad))
    assert (r.returncode, r.stdout) == (70, "start\\n")
    assert "crash.pb:2:0: runtime error: division by zero" in r.stderr


def test_missing_file():
    r = pebble("nope.pb")
    assert r.returncode == 66 and "can't open nope.pb" in r.stderr


def test_repl_keeps_state_prints_expressions_and_continues_unfinished_blocks():
    session = "let x = 20;\\nx + 22\\nfn twice(f) {\\n  return f(f(1));\\n}\\ntwice(fn(n) { return n * 10; })\\n1 / 0\\n\\"still alive\\"\\n"
    r = pebble(stdin=session)
    assert r.stdout.split("\\n")[:3] == ["42", "100", "still alive"]
    assert "division by zero" in r.stderr` },
          ],
          run: `python -m pytest -q
python -m pebble examples/closures.pb
printf 'let x = 6;\\nx * 7\\nfn sq(n) {\\n  return n * n;\\n}\\nsq(x)\\nprint y;\\n' | python -m pebble`,
          output: `59 passed
a: 3 b: 1
12 11
[2, 4, 6, 8]
42
36
<repl>:1:7: runtime error: undefined variable 'y'
    print y;
          ^`,
        },
      ],
      extensions: [
        "Add for loops (for i in range(10) { }) by desugaring them into while in the parser",
        "Add break and continue (exceptions, like return)",
        "Add maps/dictionaries: {\"a\": 1} literals, indexing and a keys() built-in",
        "Add string indexing, slicing and more built-ins (split, join, upper)",
        "Compile to bytecode and run it on a stack VM, like the bytecode lesson; measure the speedup",
        "Report several syntax errors per run with panic-mode recovery",
        "Add classes: methods, this, and instances as environments",
        "Write a Pebble program that tokenises Pebble",
      ],
      verify: "$PY_CMD -m pytest -q -p no:cacheprovider",
      requires: ["pytest"],
    },
  },
];
