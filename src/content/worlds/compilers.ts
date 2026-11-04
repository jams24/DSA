import type { World } from "../types";
import { compilersPart1 } from "./compilers-1";
import { compilersPart2 } from "./compilers-2";
import { compilersPart3 } from "./compilers-3";
import { compilersPart4 } from "./compilers-4";
import { compilersPart5 } from "./compilers-5";
import { compilersPart6 } from "./compilers-6";

export const compilers: World = {
  id: "compilers",
  order: 13,
  title: "Compiler Forge",
  subtitle: "Compilers from first principles: lexing, automata, parsing, types, interpreters, bytecode VMs, SSA, optimization, LLVM, code generation, register allocation, linking, garbage collection, JITs, and building your own compiler",
  description:
    "How source code becomes a running program, explained so simply a 10-year-old could follow and deep enough for a compilers interview. Lex characters into tokens, turn regular expressions into automata, parse with recursive descent, Pratt and LR tables, resolve scopes and infer types, walk trees and run bytecode, build SSA and optimize it, emit LLVM IR and real x86-64, allocate registers, link object files, collect garbage and JIT-compile hot code. Then build two real projects: the Pebble interpreter, and pebblec, a compiler that turns Pebble into native executables.",
  emoji: "⚒️",
  color: "#c2410c",
  boss: {
    name: "The Undefined Behaviour",
    title: "Miscompiler of Worlds",
    emoji: "🐉",
    taunt: "Your grammar is ambiguous, your registers are spilling, your linker can't find main and I just optimized your bounds check away. Nothing you write means what you think!",
    defeat: "Tokens lexed, trees parsed, types checked, SSA optimized, registers allocated, symbols linked. Your compiler runs. You speak the machine's language now.",
  },
  lessons: [...compilersPart1, ...compilersPart2, ...compilersPart3, ...compilersPart4, ...compilersPart5, ...compilersPart6],
};
