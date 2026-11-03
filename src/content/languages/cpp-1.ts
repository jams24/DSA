import type { Lesson } from "../types";

// C++ track, part 1: Foundations.

export const cppFoundations: Lesson[] = [
  // ------------------------------------------------------------------ START
  {
    id: "cpp-start",
    stage: "Foundations",
    title: "Getting started: from source to native binary",
    tagline: "What C++ is good at, how the compiler and linker turn your code into an executable, and your first programs.",
    difficulty: "beginner",
    minutes: 25,
    diagram: {
      title: "How main.cpp becomes a running program",
      nodes: [
        { id: "src", label: "main.cpp", kind: "client", x: 90, y: 300, sub: "your source code" },
        { id: "hdr", label: "Headers", kind: "registry", x: 250, y: 110, sub: "<vector>, \"shop.h\"" },
        { id: "pre", label: "Preprocessor", kind: "service", x: 250, y: 300, sub: "#include, #define" },
        { id: "comp", label: "Compiler", kind: "service", x: 420, y: 300, sub: "parse, optimize, codegen" },
        { id: "obj", label: "main.o", kind: "storage", x: 590, y: 300, sub: "object file" },
        { id: "libs", label: "Libraries", kind: "registry", x: 590, y: 110, sub: "libc++, .a, .so" },
        { id: "link", label: "Linker", kind: "control", x: 750, y: 300, sub: "resolve symbols" },
        { id: "exe", label: "./app", kind: "node", x: 900, y: 300, sub: "native executable" },
        { id: "cpu", label: "OS + CPU", kind: "worker", x: 900, y: 470, sub: "runs machine code" },
      ],
      edges: [
        { from: "src", to: "pre" },
        { from: "hdr", to: "pre", label: "copied in" },
        { from: "pre", to: "comp", label: "translation unit" },
        { from: "comp", to: "obj", label: "machine code" },
        { from: "obj", to: "link" },
        { from: "libs", to: "link" },
        { from: "link", to: "exe" },
        { from: "exe", to: "cpu", label: "./app" },
      ],
      flows: [
        {
          name: "Build and run",
          path: ["src", "pre", "comp", "obj", "link", "exe", "cpu"],
          steps: [
            "The preprocessor runs first: every #include is replaced by the full text of that header, and macros are expanded. One .cpp plus everything it includes is a 'translation unit'.",
            "The compiler parses and type-checks the translation unit, optimizes it (-O2), and generates machine code for your CPU. Syntax and type errors stop the build here.",
            "Each .cpp becomes its own object file containing machine code plus a list of symbols it defines and symbols it still needs (like std::println or a function in another file).",
            "The linker combines all object files and libraries, matching every 'needed' symbol to exactly one definition. A missing definition is a link error: 'undefined reference to ...'.",
            "The result is a native executable for one OS and CPU architecture. No virtual machine or interpreter is needed to run it.",
            "The OS loads it into memory and the CPU executes your instructions directly. That's where C++ gets its speed, and why bugs like reading freed memory can crash the process.",
          ],
        },
        {
          name: "A link error",
          path: ["src", "pre", "comp", "obj", "link"],
          steps: [
            "main.cpp includes shop.h, which declares double price(int id); but nobody compiled shop.cpp, which defines it.",
            "The compiler is happy: a declaration is enough to type-check the call price(42).",
            "main.o records 'I need a symbol called price(int)'.",
            "The linker can't find any object file defining price(int): 'undefined reference to price(int)'. Fix: add shop.cpp to the build (or link the library that contains it).",
          ],
        },
      ],
    },
    concept: `
## Why C++?
C++ compiles to **native machine code** with **zero-cost abstractions**: classes, templates and lambdas compile down to code as fast as hand-written C, and you control exactly where memory lives. It's used where performance, latency or hardware control matters:
- **Game engines** (Unreal), graphics, VR
- **Trading systems** and exchanges (microsecond latency)
- **Browsers** (Chrome, Firefox), **databases** (MySQL, MongoDB, ClickHouse), compilers (LLVM)
- **Embedded**, automotive, robotics, aerospace
- **AI infrastructure**: PyTorch, TensorFlow and llama.cpp cores, CUDA kernels

The price: you're responsible for lifetimes and correctness. Modern C++ (C++11 and later) makes that far safer with **RAII**, smart pointers, containers and value semantics. This track teaches that modern style from day one.

## The standards
C++ is an ISO standard updated every three years: **C++11** (the "modern C++" revolution: auto, lambdas, move semantics, smart pointers), C++14, **C++17** (optional, variant, string_view, filesystem), **C++20** (concepts, ranges, coroutines, modules, \`<=>\`), **C++23** (\`std::print\`, \`std::expected\`, more ranges), and **C++26** (reflection, contracts, \`std::execution\`). This track targets **C++20/23**, which current GCC, Clang and MSVC support well.

## Tools
- **Compiler**: GCC (\`g++\`, Linux), **Clang** (\`clang++\`, macOS via Xcode command-line tools, Linux), or MSVC (Visual Studio on Windows).
- **Editor**: VS Code with clangd, CLion, or Visual Studio.
- **Build system** for real projects: **CMake** (covered in the tooling chapter).

## Compiling by hand
\`\`\`bash
clang++ -std=c++23 -Wall -Wextra -g -o hello hello.cpp     # or g++ with the same flags
./hello
\`\`\`
| Flag | Meaning |
|---|---|
| \`-std=c++23\` | Which language version |
| \`-Wall -Wextra\` | Turn on warnings. **Always.** Treat them as bugs (\`-Werror\` in CI) |
| \`-g\` | Debug info, for debuggers and readable sanitizer reports |
| \`-O2\` | Optimize (release builds) |
| \`-fsanitize=address,undefined\` | Catch memory errors and undefined behavior at run time (debug builds) |

## Anatomy of a program
\`\`\`cpp
#include <print>          // bring in a library header

int main() {              // execution starts here; returns 0 for success
    std::println("Hello, {}!", "world");   // std:: = the standard library namespace
}
\`\`\`
- \`#include\` pastes a header's declarations into your file.
- Everything in the standard library lives in namespace \`std\`. Avoid \`using namespace std;\` in headers (it pollutes every file that includes them).
- Statements end with \`;\`, blocks use \`{ }\`.
- \`std::println\` (C++23) uses \`{}\` placeholders like Python's format strings. You'll also see the older \`std::cout << "text" << value << '\\n';\` everywhere.

## Headers and source files
Real programs split code into **headers** (\`.h\`/\`.hpp\`: declarations, "what exists") and **source files** (\`.cpp\`: definitions, "how it works"). Each \`.cpp\` compiles separately; the linker joins them (see the diagram). Headers use \`#pragma once\` so they're included only once per translation unit.

## Three kinds of errors
1. **Compile errors**: syntax and type mistakes. Read the *first* error; later ones are often consequences.
2. **Link errors**: something declared but never defined (or defined twice).
3. **Run-time errors**: crashes, wrong output, and **undefined behavior** (reading out of bounds, using freed memory, signed overflow). UB doesn't always crash: it may "work" until it doesn't. That's why we compile with sanitizers while learning.
`,
    keyPoints: [
      "C++ compiles to native code: no VM, no garbage collector",
      "Pipeline: preprocessor → compiler (one translation unit per .cpp) → linker → executable",
      "Compile with -std=c++23 -Wall -Wextra -g; add -fsanitize=address,undefined while developing",
      "Headers declare, .cpp files define; #pragma once prevents double inclusion",
      "Missing definitions are link errors, not compile errors",
      "std::println (C++23) and std::cout both print; everything standard lives in namespace std",
      "Undefined behavior may appear to work: sanitizers expose it",
    ],
    code: [
      {
        title: "Hello, C++",
        variants: [
          {
            lang: "cpp",
            code: `#include <iostream>
#include <print>

int main() {
    std::cout << "Hello, C++!" << '\\n';          // classic iostreams, works everywhere
    std::println("Hello again from C++{}!", 23);  // C++23: format-style printing
    return 0;                                      // 0 means success (optional in main)
}`,
          },
        ],
        output: `Hello, C++!
Hello again from C++23!`,
        explain: `- Save as \`hello.cpp\`, build with \`clang++ -std=c++23 -Wall -Wextra -o hello hello.cpp\` (or \`g++\`), run with \`./hello\`.
- \`'\\n'\` ends the line. You'll see \`std::endl\` too: it also flushes the output buffer, which is slower in loops.
- If your compiler is older and lacks \`<print>\`, use \`std::cout\` or \`std::format\` from \`<format>\` (C++20).`,
      },
      {
        title: "A first real program: functions, loops and formatting",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>

// Declared before use: C++ reads top to bottom.
double to_fahrenheit(double celsius) {
    return celsius * 9.0 / 5.0 + 32.0;
}

int main() {
    std::println("{:>8} {:>11}", "Celsius", "Fahrenheit");   // > right-aligns in a width
    for (int c = -10; c <= 40; c += 10) {
        std::println("{:>8} {:>11.1f}", c, to_fahrenheit(c)); // .1f: one decimal place
    }

    int total = 0;
    int n = 1;
    while (total + n <= 100) {
        total += n;
        ++n;
    }
    std::println("1 + 2 + ... + {} = {} (the largest such sum <= 100)", n - 1, total);
}`,
          },
        ],
        output: ` Celsius  Fahrenheit
     -10        14.0
       0        32.0
      10        50.0
      20        68.0
      30        86.0
      40       104.0
1 + 2 + ... + 13 = 91 (the largest such sum <= 100)`,
        explain: `- \`to_fahrenheit(c)\` passes an \`int\`; it's converted to \`double\` automatically.
- \`9.0 / 5.0\` matters: \`9 / 5\` would be integer division (1).
- Format specs come after a colon: \`{:>8}\` (right-align in 8 characters), \`{:.1f}\` (fixed, one decimal), \`{:08.3f}\`, \`{:x}\` (hex), \`{:<10}\` (left-align).`,
      },
      {
        title: "Command-line arguments",
        variants: [
          {
            lang: "cpp",
            code: `#include <cstddef>
#include <print>
#include <span>
#include <string_view>

int main(int argc, char* argv[]) {
    // argv is a C array of C strings; a span gives it a size and bounds.
    std::span<char*> args(argv, static_cast<std::size_t>(argc));
    std::println("program name comes first; {} extra argument(s)", args.size() - 1);
    for (std::string_view arg : args.subspan(1)) {
        std::println("arg: {} ({} chars)", arg, arg.size());
    }
}`,
          },
        ],
        output: `program name comes first; 0 extra argument(s)`,
        explain: `- Run \`./args hello world\` and you get two \`arg:\` lines.
- \`argc\` counts arguments including the program name; \`argv\` holds them as \`char*\` C strings.
- \`std::string_view\` is a cheap, non-owning view of characters: perfect for reading arguments without copying.`,
      },
      {
        title: "Splitting a program into header and source files",
        noCheck: "multi-file example: build it with the commands below",
        variants: [
          {
            lang: "cpp",
            code: `// ---- shop.h : declarations (what exists) ----
#pragma once
#include <string>

struct Item {
    std::string name;
    double price;
};

double total_with_tax(const Item& item, int quantity);

// ---- shop.cpp : definitions (how it works) ----
#include "shop.h"

double total_with_tax(const Item& item, int quantity) {
    constexpr double tax_rate = 0.08;
    return item.price * quantity * (1 + tax_rate);
}

// ---- main.cpp ----
#include <print>
#include "shop.h"

int main() {
    Item book{"C++ Primer", 49.99};
    std::println("{} x3 = \${:.2f}", book.name, total_with_tax(book, 3));
}`,
          },
          {
            lang: "bash",
            code: `# compile each .cpp to an object file, then link
clang++ -std=c++23 -Wall -Wextra -c shop.cpp -o shop.o
clang++ -std=c++23 -Wall -Wextra -c main.cpp -o main.o
clang++ shop.o main.o -o shop
./shop                                   # C++ Primer x3 = $161.97

# or in one step
clang++ -std=c++23 -Wall -Wextra shop.cpp main.cpp -o shop

# forget shop.cpp and you get a LINK error:
clang++ -std=c++23 main.cpp -o shop
# undefined reference to 'total_with_tax(Item const&, int)'`,
          },
        ],
        explain: `- The header lets \`main.cpp\` *call* \`total_with_tax\` without seeing its body.
- Changing \`shop.cpp\` only recompiles \`shop.cpp\`; changing \`shop.h\` recompiles everything that includes it. Build systems track this for you.`,
      },
    ],
    interview: [
      {
        q: "What happens when you compile and run a C++ program?",
        a: "The **preprocessor** expands `#include`s and macros, producing a translation unit per `.cpp`. The **compiler** parses, type-checks, optimizes and emits an object file of machine code with a symbol table (defined and undefined symbols). The **linker** combines object files and libraries, resolving each undefined symbol to exactly one definition, and produces an executable (or a static/shared library). At run time the OS loader maps the executable and its shared libraries into memory, runs static initializers, and calls `main`. There's no VM: the CPU executes the generated instructions directly.",
        freq: "very-common",
      },
      {
        q: "What is undefined behavior and why does it matter?",
        a: "Behavior the standard places no requirements on: out-of-bounds access, use after free, dereferencing null, signed integer overflow, data races, reading uninitialized variables, and more. The compiler is allowed to assume UB never happens and optimize accordingly, so UB can produce bizarre results, security vulnerabilities, or code that works in debug and fails in release. Avoid it with safe abstractions (containers, smart pointers, `at()` while learning), warnings, sanitizers (ASan, UBSan, TSan) and static analysis.",
        freq: "very-common",
      },
      {
        q: "What's the difference between a declaration and a definition?",
        a: "A declaration introduces a name and its type (`double price(int id);`, `extern int count;`, `class Widget;`) so it can be used. A definition provides the actual entity: the function body, the storage for a variable, the full class. You can declare something many times but define it once per program (the One Definition Rule), with exceptions for inline functions, templates and class definitions in headers, which must be identical everywhere.",
        freq: "common",
      },
      {
        q: "C++ vs C vs Rust vs Java: when would you choose C++?",
        a: "C++ when you need native performance with high-level abstractions and a mature ecosystem: game engines, trading, browsers, databases, embedded, HPC, ML runtimes, or when integrating with large existing C++ codebases. C is smaller and simpler, used for kernels and very constrained systems. Rust offers similar performance with compile-time memory safety, increasingly chosen for new systems code. Java and Go trade some control and latency predictability (garbage collection) for productivity and safety. Many systems mix them.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which step reports 'undefined reference to foo()'?",
        options: ["The preprocessor", "The compiler", "The linker", "The CPU at run time"],
        answer: 2,
        explain: "The linker matches symbols across object files and libraries.",
      },
      {
        q: "What does #include do?",
        options: ["Links a library", "Pastes the header's text into the file before compiling", "Downloads a package", "Imports a module at run time"],
        answer: 1,
        explain: "It's textual inclusion by the preprocessor.",
      },
      {
        q: "Which flags should you always use while learning?",
        options: ["-O3 only", "-Wall -Wextra (and sanitizers in debug builds)", "-w", "No flags"],
        answer: 1,
        explain: "Warnings and sanitizers catch most beginner bugs early.",
      },
      {
        q: "What does `9 / 5` evaluate to in C++?",
        options: ["1.8", "1", "2", "It doesn't compile"],
        answer: 1,
        explain: "Integer division truncates toward zero.",
      },
      {
        q: "What is a translation unit?",
        options: ["A .cpp file plus everything it includes, after preprocessing", "A compiled executable", "A namespace", "A header file alone"],
        answer: 0,
        explain: "The compiler processes one translation unit at a time.",
      },
    ],
  },

  // ------------------------------------------------------------------ BASICS
  {
    id: "cpp-basics",
    stage: "Foundations",
    title: "Types, variables, strings and control flow",
    tagline: "Built-in types and their pitfalls, auto, const and constexpr, std::string and string_view, enums, and every kind of loop and branch.",
    difficulty: "beginner",
    minutes: 30,
    concept: `
## Fundamental types
| Type | Typical size | Notes |
|---|---|---|
| \`bool\` | 1 byte | \`true\` / \`false\` |
| \`char\` | 1 byte | A byte; may be signed or unsigned depending on platform |
| \`int\` | 4 bytes | -2,147,483,648 to 2,147,483,647 on mainstream platforms |
| \`long long\` | 8 bytes | At least 64 bits |
| \`double\` | 8 bytes | ~15-16 significant digits. Default for decimals |
| \`float\` | 4 bytes | ~7 digits. Graphics, ML, memory-bound code |
| \`std::size_t\` | 8 bytes (64-bit) | Unsigned; sizes and indexes (\`v.size()\` returns it) |

Sizes are only guaranteed as minimums. When the exact width matters (file formats, protocols), use **\`<cstdint>\`**: \`std::int32_t\`, \`std::uint8_t\`, \`std::int64_t\`.

## Pitfalls that bite everyone
- **Signed overflow is undefined behavior**: \`INT_MAX + 1\` isn't guaranteed to wrap. **Unsigned** arithmetic wraps around (well defined): \`0u - 1\` is 4294967295.
- **Mixing signed and unsigned**: \`-1 < v.size()\` is **false**, because \`-1\` converts to a huge unsigned number. The compiler warns (\`-Wsign-compare\`): listen to it.
- **Integer division truncates**: \`7 / 2 == 3\`. Write \`7.0 / 2\` for 3.5.
- **Floating point is approximate**: \`0.1 + 0.2 != 0.3\`. Never use \`double\` for money; use integer cents.
- **Uninitialized variables** hold garbage: \`int x;\` then reading \`x\` is UB. Always initialize.

## Initialization
\`\`\`cpp
int a = 5;          // copy initialization
int b{5};           // brace (uniform) initialization: rejects narrowing
int c{};            // value-initialized: 0
int d{3.7};         // ERROR: narrowing double -> int is not allowed with braces
auto e = 3.7;       // auto deduces double
\`\`\`
Prefer braces or \`auto x = ...\`: both avoid many accidental conversions.

## const, constexpr and auto
- \`const\` means "won't change after initialization". Make everything \`const\` that can be.
- \`constexpr\` means "known at **compile time**": \`constexpr int buffer_size = 4 * 1024;\`. Functions can be \`constexpr\` too.
- \`auto\` lets the compiler deduce the type from the initializer. Great for long type names (iterators, lambdas); be explicit when the type documents intent.

## Strings
- **\`std::string\`** owns its characters, grows as needed, and has value semantics (copying copies the text). Methods: \`size\`, \`substr\`, \`find\`, \`replace\`, \`starts_with\`/\`ends_with\` (C++20), \`contains\` (C++23), \`+\`, \`+=\`, comparison operators.
- **\`std::string_view\`** (C++17) is a **non-owning view**: a pointer plus a length. Use it for read-only string parameters: it accepts \`std::string\`, literals and substrings without copying. Never return a \`string_view\` into a temporary string (it would dangle).
- C strings (\`const char*\`, null-terminated) still appear at C API boundaries; use \`.c_str()\` to pass a \`std::string\` to them.
- Conversions: \`std::stoi\`, \`std::stod\`, \`std::to_string\`, and the fast, non-throwing \`std::from_chars\`/\`std::to_chars\`.

## Enums
Prefer **scoped enums** (\`enum class Color { Red, Green };\`): names don't leak into the surrounding scope and they don't silently convert to \`int\`. With \`-Wall\`, a \`switch\` over an enum warns if you forget a value.

## Control flow
\`if\`/\`else\`, \`switch\`, \`for\`, range-based \`for (auto x : container)\`, \`while\`, \`do ... while\`, \`break\`, \`continue\`, and the ternary \`cond ? a : b\`. Modern additions:
- \`if (auto it = m.find(k); it != m.end())\`: an initializer scoped to the \`if\` (C++17).
- **Structured bindings**: \`for (const auto& [key, value] : map)\` (C++17).
`,
    keyPoints: [
      "int is usually 32 bits; use <cstdint> types when the width matters",
      "Signed overflow is UB; unsigned wraps; mixing them breaks comparisons",
      "Always initialize; braces {} forbid narrowing conversions",
      "const by default; constexpr for compile-time values",
      "std::string owns text; std::string_view is a cheap read-only view (don't let it dangle)",
      "Prefer enum class; switch over enums warns on missing cases",
      "Use if-with-initializer and structured bindings for tighter, clearer code",
    ],
    code: [
      {
        title: "Numbers: sizes, limits, overflow and conversions",
        note: "Sizes shown are for 64-bit Linux and macOS",
        variants: [
          {
            lang: "cpp",
            code: `#include <cstdint>
#include <limits>
#include <print>

int main() {
    std::println("sizes in bytes: bool={} char={} int={} long long={} double={} pointer={}",
                 sizeof(bool), sizeof(char), sizeof(int), sizeof(long long), sizeof(double), sizeof(void*));
    std::println("int range: {} .. {}", std::numeric_limits<int>::min(), std::numeric_limits<int>::max());

    std::int64_t big = 3'000'000'000;               // ' separates digits for readability
    std::println("an int64 holds {}", big);

    unsigned int u = 0;
    u = u - 1;                                      // unsigned arithmetic wraps: well defined
    std::println("0u - 1 = {}", u);

    std::println("7 / 2 = {}, 7 % 2 = {}, 7.0 / 2 = {}", 7 / 2, 7 % 2, 7.0 / 2);
    std::println("0.1 + 0.2 = {:.17f}", 0.1 + 0.2);

    auto count = 42;                                // int
    auto ratio = 0.75;                              // double
    constexpr int area = 12 * 12;                   // computed at compile time
    // int narrowed{ratio};                         // compile error: braces forbid narrowing
    int truncated = static_cast<int>(ratio * 10);   // explicit conversion: 7
    std::println("count={} ratio={} area={} truncated={}", count, ratio, area, truncated);

    int value{};                                    // value-initialized to 0
    std::println("value-initialized int: {}", value);
}`,
          },
        ],
        output: `sizes in bytes: bool=1 char=1 int=4 long long=8 double=8 pointer=8
int range: -2147483648 .. 2147483647
an int64 holds 3000000000
0u - 1 = 4294967295
7 / 2 = 3, 7 % 2 = 1, 7.0 / 2 = 3.5
0.1 + 0.2 = 0.30000000000000004
count=42 ratio=0.75 area=144 truncated=7
value-initialized int: 0`,
        explain: `- \`3'000'000'000\` doesn't fit in a 32-bit \`int\`, so we use \`std::int64_t\`.
- \`static_cast<int>(x)\` is the explicit, searchable way to convert. Avoid C-style \`(int)x\` casts.
- We *don't* demonstrate signed overflow: \`INT_MAX + 1\` is undefined behavior, and UBSan would stop the program.`,
      },
      {
        title: "std::string and std::string_view",
        variants: [
          {
            lang: "cpp",
            code: `#include <algorithm>
#include <cctype>
#include <print>
#include <string>
#include <string_view>
#include <vector>

// Read-only parameter: string_view accepts std::string, literals and substrings without copying.
std::vector<std::string_view> split(std::string_view text, char sep) {
    std::vector<std::string_view> parts;
    while (true) {
        auto pos = text.find(sep);
        parts.push_back(text.substr(0, pos));     // a view into the caller's characters
        if (pos == std::string_view::npos) break;
        text.remove_prefix(pos + 1);
    }
    return parts;
}

int main() {
    std::string name = "Bjarne";
    name += " Stroustrup";                         // strings are mutable values
    std::println("'{}' has {} chars; first='{}', last='{}'", name, name.size(), name.front(), name.back());
    std::println("find(\\"Strou\\") = {}, substr(7, 5) = {}", name.find("Strou"), name.substr(7, 5));

    std::string copy = name;                       // a real, independent copy
    copy[0] = 'b';
    std::println("{} | {}", name, copy);

    std::string upper = name;
    std::ranges::transform(upper, upper.begin(), [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    std::println("{}", upper);

    std::println("starts_with(\\"Bj\\")={} ends_with(\\"up\\")={} contains(\\"rou\\")={}",
                 name.starts_with("Bj"), name.ends_with("up"), name.contains("rou"));

    for (std::string_view part : split("2026-11-03", '-')) std::print("[{}]", part);
    std::println("");

    int n = std::stoi("41") + 1;
    std::string s = "answer=" + std::to_string(n);
    std::println("{} (length {})", s, s.length());
    std::println("compare: {} {}", std::string("apple") < std::string("banana"), name == "Bjarne Stroustrup");
}`,
          },
        ],
        output: `'Bjarne Stroustrup' has 17 chars; first='B', last='p'
find("Strou") = 7, substr(7, 5) = Strou
Bjarne Stroustrup | bjarne Stroustrup
BJARNE STROUSTRUP
starts_with("Bj")=true ends_with("up")=true contains("rou")=true
[2026][11][03]
answer=42 (length 9)
compare: true true`,
        explain: `- \`std::string\` copies are deep: changing \`copy\` doesn't affect \`name\`. That's **value semantics**, the C++ default.
- \`split\` returns views into the literal \`"2026-11-03"\`, which lives for the whole program, so they're safe. Views into a temporary \`std::string\` would dangle.
- \`std::toupper\` takes an \`unsigned char\` value; passing a plain negative \`char\` is undefined behavior, hence the lambda parameter type.
- \`name.find(...)\` returns \`std::string::npos\` when nothing is found.`,
      },
      {
        title: "Control flow, enums and structured bindings",
        variants: [
          {
            lang: "cpp",
            code: `#include <map>
#include <print>
#include <string>
#include <string_view>

enum class Light { Red, Yellow, Green };

std::string_view action(Light light) {
    switch (light) {                         // -Wall warns if a value is missing
        case Light::Red: return "stop";
        case Light::Yellow: return "slow down";
        case Light::Green: return "go";
    }
    return "unknown";
}

int main() {
    for (int i = 1; i <= 15; ++i) {
        if (i % 15 == 0) std::print("FizzBuzz ");
        else if (i % 3 == 0) std::print("Fizz ");
        else if (i % 5 == 0) std::print("Buzz ");
        else std::print("{} ", i);
    }
    std::println("");

    for (Light l : {Light::Red, Light::Yellow, Light::Green}) std::print("{} ", action(l));
    std::println("");

    int n = 27;
    int steps = 0;
    while (n != 1) {
        n = (n % 2 == 0) ? n / 2 : 3 * n + 1;   // ternary operator
        ++steps;
    }
    std::println("Collatz sequence from 27 reaches 1 after {} steps", steps);

    int tries = 0;
    do {
        ++tries;
    } while (tries < 3);                      // body runs at least once
    std::println("do-while ran {} times", tries);

    std::map<std::string, int> stock{{"apple", 3}, {"pear", 0}, {"kiwi", 12}};
    for (const auto& [fruit, qty] : stock) {  // structured bindings (C++17)
        if (qty == 0) continue;
        std::println("{:<6} {:>3}", fruit, qty);
    }
    if (auto it = stock.find("pear"); it != stock.end() && it->second == 0) {   // if with initializer
        std::println("{} is sold out", it->first);
    }
}`,
          },
        ],
        output: `1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz
stop slow down go
Collatz sequence from 27 reaches 1 after 111 steps
do-while ran 3 times
apple    3
kiwi    12
pear is sold out`,
        explain: `- \`std::map\` keeps keys sorted, so iteration goes apple, kiwi, pear.
- \`for (Light l : {...})\` loops over a brace list: handy for small fixed sets.
- \`it\` exists only inside the \`if\`: the C++17 initializer keeps scopes tight.
- In \`switch\`, forgetting \`break\` between non-returning cases falls through to the next case; \`-Wimplicit-fallthrough\` warns, and \`[[fallthrough]];\` marks it as intentional.`,
      },
    ],
    interview: [
      {
        q: "Why is signed integer overflow undefined behavior while unsigned overflow wraps?",
        a: "Historically, hardware used different signed representations, so the standard didn't define overflow; today it lets compilers optimize, assuming `i + 1 > i` for signed `i` (useful for loop analysis and vectorization). Unsigned integers are defined as arithmetic modulo 2^N, so they wrap. Consequences: never rely on signed wrap-around; check before operating (`if (a > INT_MAX - b)`) or use wider types, `__builtin_add_overflow`, or C++26 saturating arithmetic. UBSan detects signed overflow at run time.",
        freq: "common",
      },
      {
        q: "What's the difference between std::string and std::string_view?",
        a: "`std::string` owns a mutable, growable buffer and manages its memory (with small-string optimization for short strings). `std::string_view` is just a pointer and a length referring to characters owned by someone else: cheap to copy, read-only, no allocation, and it can view substrings without copying. Use `string_view` for read-only parameters; use `string` to store text. The danger is lifetime: a view must not outlive the characters it points to (returning a view of a local or temporary string dangles), and it isn't guaranteed to be null-terminated, so don't pass `.data()` to C APIs expecting a C string.",
        freq: "very-common",
      },
      {
        q: "const vs constexpr?",
        a: "`const` means the object can't be modified after initialization, but its value may only be known at run time (`const int n = read_input();`). `constexpr` means the value can be computed at compile time (a `constexpr` variable must be initialized with a constant expression), so it can be used for array sizes, template arguments and `static_assert`. A `constexpr` function can run at compile time when given constant arguments and at run time otherwise; `consteval` (C++20) forces compile-time evaluation.",
        freq: "common",
      },
      {
        q: "Why prefer enum class over plain enum?",
        a: "Scoped enums don't inject their enumerator names into the enclosing scope (no clashes between `Color::Red` and `Light::Red`), don't implicitly convert to integers (no accidental arithmetic or comparisons between unrelated enums), and can have a specified underlying type (`enum class Op : std::uint8_t`). Use `static_cast` or C++23 `std::to_underlying` when you really need the number.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What does `int x{2.5};` do?",
        options: ["x = 2", "x = 3", "Compile error: narrowing", "x = 2.5"],
        answer: 2,
        explain: "Brace initialization forbids narrowing conversions.",
      },
      {
        q: "`unsigned int u = 0; u - 1` equals...",
        options: ["-1", "Undefined behavior", "4294967295 (wraps)", "0"],
        answer: 2,
        explain: "Unsigned arithmetic is modulo 2^32 here.",
      },
      {
        q: "Which is undefined behavior?",
        options: ["Unsigned overflow", "Signed int overflow", "Dividing doubles by zero", "Comparing two strings"],
        answer: 1,
        explain: "Signed overflow is UB; unsigned wraps; floating division by zero gives inf/nan under IEEE 754.",
      },
      {
        q: "What's the main risk with std::string_view?",
        options: ["It's slow", "It can dangle if the viewed characters are destroyed", "It can't hold spaces", "It copies the string"],
        answer: 1,
        explain: "It doesn't own the characters it points to.",
      },
      {
        q: "Why is `-1 < v.size()` false?",
        options: ["size() is negative", "-1 is converted to a huge unsigned value", "Operator precedence", "It's true"],
        answer: 1,
        explain: "Comparing signed with unsigned converts the signed value to unsigned.",
      },
      {
        q: "What does `constexpr int n = 10 * 10;` guarantee?",
        options: ["n is computed at compile time", "n is mutable", "n lives on the heap", "Nothing"],
        answer: 0,
        explain: "constexpr variables are compile-time constants.",
      },
    ],
  },

  // ------------------------------------------------------------------ MEMORY
  {
    id: "cpp-memory",
    stage: "Foundations",
    title: "Pointers, references and memory",
    tagline: "The stack and the heap, pointers vs references, passing arguments, arrays, vector and span, and the memory bugs sanitizers catch.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["cppmemory"],
    concept: `
## Where objects live
| Storage | Created by | Lifetime | Notes |
|---|---|---|---|
| **Automatic** (the stack) | Local variables | Until the end of their \`{ }\` block | Fast; freed automatically, in reverse order |
| **Dynamic** (the heap) | \`new\`, or containers and smart pointers internally | Until explicitly freed | Flexible size and lifetime; someone must own it |
| **Static** | Globals, \`static\` locals | The whole program | Initialized once |

**Step through the memory visualizer**: watch stack frames push and pop, heap blocks get allocated, and what happens when nobody frees them (a leak) or someone keeps a pointer to a dead object (dangling).

## Pointers and references
\`\`\`cpp
int a = 1;
int* p = &a;     // p holds a's ADDRESS. *p reads or writes a
int& r = a;      // r is another NAME for a (an alias)
*p = 2;  r = 3;  // both change a
\`\`\`
| | Pointer \`T*\` | Reference \`T&\` |
|---|---|---|
| Can be null | Yes (\`nullptr\`) | No: must bind to an object |
| Can be re-seated | Yes | No: bound for life |
| Syntax | \`*p\`, \`p->member\` | Used like the object itself |
| Use for | Optional or re-seatable non-owning links, C APIs | Parameters and aliases |

## Passing arguments
| Signature | Meaning | Use for |
|---|---|---|
| \`void f(int x)\` | Copy | Small, cheap types (numbers, pointers, \`string_view\`) |
| \`void f(const std::string& s)\` | Read-only, no copy | Large objects you only read |
| \`void f(std::string& s)\` | Modify the caller's object | Out-parameters (prefer returning values) |
| \`void f(std::string s)\` | Take your own copy (caller can \`std::move\` into it) | When you'll store it |
| \`void f(Widget* w)\` | Optional, non-owning | "May be null" |

**Return values by value.** The compiler elides the copy (and moves otherwise), so returning a \`std::vector\` is cheap.

## new and delete: know them, avoid them
\`\`\`cpp
int* p = new int(42);   // allocate on the heap
delete p;               // you must free it exactly once
int* arr = new int[10];
delete[] arr;           // arrays need delete[]
\`\`\`
Every \`new\` needs exactly one matching \`delete\` on every code path, including when exceptions fly. That's nearly impossible to get right by hand, so **modern C++ code almost never writes \`new\`/\`delete\`**: use \`std::vector\`, \`std::string\`, \`std::make_unique\` and friends, which free memory automatically (RAII, next chapter).

## Arrays
- C arrays (\`int a[5]\`) have a fixed size, don't know their own length, and **decay** to a pointer when passed to functions.
- **\`std::array<int, 5>\`**: fixed size, knows its size, can be copied and compared. Lives wherever you declare it (often the stack).
- **\`std::vector<int>\`**: the default dynamic array. Elements are contiguous on the heap; it grows automatically (doubling its capacity, see the dynamic array visualizer in the Foundations world).
- **\`std::span<const int>\`** (C++20): a non-owning view of contiguous elements. Take it as a parameter to accept arrays, vectors and slices of them uniformly.
- \`v[i]\` doesn't check bounds (fast; out of range is UB). \`v.at(i)\` checks and throws \`std::out_of_range\`.

## The classic memory bugs
| Bug | Example | Detected by |
|---|---|---|
| **Leak** | \`new\` without \`delete\` | ASan's LeakSanitizer, Valgrind |
| **Dangling pointer/reference** | Returning \`&local\`; keeping a reference into a vector that reallocates | ASan (use-after-return/free), compiler warnings |
| **Use after free** | Reading through a pointer after \`delete\` | ASan |
| **Double free** | \`delete\` twice | ASan |
| **Buffer overflow** | \`arr[10]\` on a 10-element array | ASan |
| **Null dereference** | \`*p\` when \`p == nullptr\` | Crash (segfault), UBSan |
| **Uninitialized read** | \`int x; f(x);\` | MemorySanitizer, Valgrind, warnings |

Compile debug builds with \`-fsanitize=address,undefined -g\`: these bugs turn into clear reports with stack traces instead of mysterious crashes later.
`,
    keyPoints: [
      "Locals live on the stack and die at the end of their block, in reverse order",
      "A pointer holds an address (nullable, re-seatable); a reference is an alias (never null)",
      "Pass small types by value, large read-only ones by const&, optional ones by pointer",
      "Avoid raw new/delete: containers and smart pointers free memory automatically",
      "std::vector is the default container; std::array for fixed sizes; std::span to view either",
      "[] is unchecked (UB out of range); at() checks and throws",
      "Debug with -fsanitize=address,undefined -g",
    ],
    code: [
      {
        title: "Pointers, references and the three ways to pass arguments",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>

void by_value(int x) {                         // x is a local copy
    x = 100;
    std::println("  inside by_value: x={}", x);
}
void by_reference(int& x) { x = 100; }         // changes the caller's variable
void by_pointer(int* x) {
    if (x != nullptr) *x = 200;                // pointers can be null: check first
}

int main() {
    int a = 1;
    int& ref = a;          // another name for a
    int* ptr = &a;         // the address of a
    ref = 2;
    std::println("a={} ref={} *ptr={} ptr points at a: {}", a, ref, *ptr, ptr == &a);
    *ptr = 3;
    std::println("after *ptr = 3, a={}", a);

    int b = 10;
    ptr = &b;              // a pointer can be re-seated; a reference cannot
    std::println("ptr now points at b: *ptr={}, a is still {}", *ptr, a);

    by_value(a);
    std::println("after by_value:     a={}", a);
    by_reference(a);
    std::println("after by_reference: a={}", a);
    by_pointer(&a);
    std::println("after by_pointer:   a={}", a);
    by_pointer(nullptr);   // safe, thanks to the check

    int arr[4] = {10, 20, 30, 40};
    int* p = arr;          // a C array decays to a pointer to its first element
    std::println("p[2]={} *(p + 3)={} sizeof(arr)={} sizeof(p)={}", p[2], *(p + 3), sizeof(arr), sizeof(p));

    const int limit = 5;
    const int* read_only = &limit;   // pointer to const: *read_only can't be changed
    int* const fixed = &b;           // const pointer: fixed can't point elsewhere
    *fixed = 11;
    std::println("*read_only={} b={}", *read_only, b);
}`,
          },
        ],
        output: `a=2 ref=2 *ptr=2 ptr points at a: true
after *ptr = 3, a=3
ptr now points at b: *ptr=10, a is still 3
  inside by_value: x=100
after by_value:     a=3
after by_reference: a=100
after by_pointer:   a=200
p[2]=30 *(p + 3)=40 sizeof(arr)=16 sizeof(p)=8
*read_only=5 b=11`,
        explain: `- \`&a\` takes an address; \`*ptr\` follows it (dereferences).
- \`sizeof(arr)\` is the whole array (16 bytes); after decay, \`sizeof(p)\` is just a pointer (8 bytes). That's why functions taking C arrays need a separate size parameter, and why \`std::span\` exists.
- Read pointer declarations right to left: \`const int*\` is "pointer to const int"; \`int* const\` is "const pointer to int".`,
      },
      {
        title: "Lifetimes: stack objects, raw new/delete, and automatic cleanup",
        variants: [
          {
            lang: "cpp",
            code: `#include <memory>
#include <print>

struct Tracer {
    int id;
    explicit Tracer(int i) : id(i) { std::println("  construct #{}", id); }
    ~Tracer() { std::println("  destroy   #{}", id); }
};

Tracer make_on_stack(int id) {
    return Tracer(id);                      // returned by value: no copy, constructed in the caller
}

int main() {
    std::println("stack objects die at the end of their block, in reverse order:");
    {
        Tracer first(1);
        Tracer second(2);
    }

    std::println("raw new/delete (avoid):");
    Tracer* raw = new Tracer(3);
    delete raw;                             // forget this: leak. Do it twice: crash.

    std::println("unique_ptr frees automatically:");
    {
        auto owned = std::make_unique<Tracer>(4);
        std::println("  using #{}", owned->id);
    }

    std::println("returned by value:");
    Tracer t = make_on_stack(5);
    std::println("end of main");
}`,
          },
        ],
        output: `stack objects die at the end of their block, in reverse order:
  construct #1
  construct #2
  destroy   #2
  destroy   #1
raw new/delete (avoid):
  construct #3
  destroy   #3
unique_ptr frees automatically:
  construct #4
  using #4
  destroy   #4
returned by value:
  construct #5
end of main
  destroy   #5`,
        explain: `- Destructors run automatically and **deterministically** when an object's lifetime ends. Unlike a garbage collector, you know exactly when.
- Reverse order matters: \`second\` may depend on \`first\`, so it's destroyed first.
- \`unique_ptr\` holds the heap object and deletes it in its own destructor: the heap object now has a stack-like lifetime. That's RAII, the most important idea in C++ (next chapter).
- \`make_on_stack\` returns a prvalue, so C++17 guarantees no copy or move happens.`,
      },
      {
        title: "std::vector, std::array and std::span",
        variants: [
          {
            lang: "cpp",
            code: `#include <array>
#include <cstddef>
#include <numeric>
#include <print>
#include <span>
#include <stdexcept>
#include <vector>

// One function for arrays, vectors and slices of them.
double average(std::span<const int> values) {
    if (values.empty()) return 0.0;
    return std::accumulate(values.begin(), values.end(), 0.0) / static_cast<double>(values.size());
}

int main() {
    std::array<int, 4> fixed{4, 8, 15, 16};      // size fixed at compile time
    std::vector<int> grow{23, 42};               // elements on the heap, can grow
    grow.push_back(7);
    grow.insert(grow.begin(), 1);                // O(n): shifts everything right

    std::println("fixed={} grow={}", fixed, grow);
    std::println("averages: fixed {:.2f}, grow {:.2f}, first two of fixed {:.1f}",
                 average(fixed), average(grow), average(std::span(fixed).first(2)));

    std::println("grow: size={} front={} back={} at(1)={}", grow.size(), grow.front(), grow.back(), grow.at(1));
    try {
        std::println("{}", grow.at(10));         // bounds-checked
    } catch (const std::out_of_range&) {
        std::println("at(10) threw std::out_of_range");
    }
    // grow[10] would NOT be checked: undefined behavior

    std::vector<int> copy = grow;                // vectors copy deeply
    copy[0] = 99;
    std::println("grow[0]={} copy[0]={} equal? {}", grow[0], copy[0], grow == copy);

    for (std::size_t i = 0; i < fixed.size(); ++i) fixed[i] *= 2;   // size_t index: no sign warnings
    for (int& x : grow) x += 1;                                       // reference: modify in place
    std::println("fixed={} grow={}", fixed, grow);
}`,
          },
        ],
        output: `fixed=[4, 8, 15, 16] grow=[1, 23, 42, 7]
averages: fixed 10.75, grow 18.25, first two of fixed 6.0
grow: size=4 front=1 back=7 at(1)=23
at(10) threw std::out_of_range
grow[0]=1 copy[0]=99 equal? false
fixed=[8, 16, 30, 32] grow=[2, 24, 43, 8]`,
        explain: `- \`std::println\` can print ranges directly (C++23).
- \`average\` takes \`std::span<const int>\`, so it accepts a \`std::array\`, a \`std::vector\`, a C array, or a sub-range, with no copying and no templates.
- \`for (int& x : grow)\` binds a reference to each element; \`for (int x : grow)\` would modify copies.
- \`std::accumulate\` starts from \`0.0\` so the sum is a \`double\`; starting from \`0\` would sum as \`int\`.`,
      },
      {
        title: "Bugs that sanitizers catch",
        noCheck: "deliberately buggy: compile it with -fsanitize=address to watch it get caught",
        variants: [
          {
            lang: "cpp",
            code: `// clang++ -std=c++23 -g -fsanitize=address,undefined bugs.cpp -o bugs && ./bugs
#include <print>
#include <vector>

int* dangling() {
    int local = 42;
    return &local;               // BUG: local dies when the function returns (the compiler warns)
}

int main() {
    std::vector<int> v{1, 2, 3};
    int& first = v[0];
    v.push_back(4);              // may reallocate the buffer...
    std::println("{}", first);   // BUG: ...so 'first' refers to freed memory: heap-use-after-free

    int* p = new int[3];
    p[3] = 7;                    // BUG: one past the end: heap-buffer-overflow
    delete[] p;

    int big = 2'147'483'647;
    big += 1;                    // BUG: signed overflow (UBSan: "signed integer overflow")
    std::println("{}", big);
}`,
          },
          {
            lang: "text",
            code: `==41721==ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000010
READ of size 4 at 0x602000000010 thread T0
    #0 0x1000034a0 in main bugs.cpp:14
0x602000000010 is located 0 bytes inside of 12-byte region [0x602000000010,0x60200000001c)
freed by thread T0 here:
    #1 0x100003320 in std::vector<int>::push_back(int&&) vector:1543
    #2 0x100003478 in main bugs.cpp:13
previously allocated by thread T0 here:
    #2 0x1000032f4 in main bugs.cpp:11
SUMMARY: AddressSanitizer: heap-use-after-free bugs.cpp:14 in main`,
          },
        ],
        explain: `- The report says *what* happened (use after free), *where* the bad read is (line 14), where the memory was **freed** (inside \`push_back\`, line 13) and where it was **allocated** (line 11). That's usually enough to fix the bug in a minute.
- Without the sanitizer this program might print \`1\`, print garbage, or crash, differently on each machine. That unpredictability is what "undefined behavior" means.
- Rule from this bug: **don't keep references, pointers or iterators into a vector across operations that may reallocate it** (push_back, insert, resize).`,
      },
    ],
    interview: [
      {
        q: "Pointer vs reference?",
        a: "A pointer is an object holding an address: it can be null, can be re-seated to point elsewhere, supports arithmetic, and is dereferenced with `*`/`->`. A reference is an alias for an existing object: it must be initialized, can't be null (in valid programs), can't be re-seated, and is used with ordinary syntax. Use references for parameters and aliases that must refer to something; use pointers (or `std::optional<std::reference_wrapper<T>>`) when 'nothing' is a valid state or you need re-seating; and use smart pointers, not raw pointers, for ownership.",
        freq: "very-common",
      },
      {
        q: "Stack vs heap allocation?",
        a: "Stack (automatic) allocation is a pointer bump in the current frame: extremely fast, freed automatically when the scope ends, cache-friendly, but limited in size (often 1 to 8 MB per thread) and lifetime. Heap allocation (via `new`/`malloc`, used internally by containers) supports dynamic sizes and lifetimes beyond a scope, but costs more (allocator bookkeeping, possible locking, fragmentation) and someone must free it. Prefer stack objects and containers; use the heap when size is unknown at compile time, data is large, or it must outlive the scope.",
        freq: "very-common",
      },
      {
        q: "What's the difference between delete and delete[]? new and malloc?",
        a: "`new T` allocates and constructs one object; `delete` destroys and frees it. `new T[n]` constructs an array and stores its count; `delete[]` destroys all n elements and frees it. Mixing them is undefined behavior. `malloc` only allocates raw bytes (no constructors, returns `void*`, returns null on failure) and pairs with `free`; `new` calls constructors, is type-safe, and throws `std::bad_alloc` on failure. Modern code avoids both directly and uses containers and `std::make_unique`.",
        freq: "common",
      },
      {
        q: "What is a dangling reference, and how do you avoid one?",
        a: "A reference or pointer to an object whose lifetime has ended: returning a reference to a local, a `string_view` to a temporary string, an iterator or reference into a vector that reallocated, a lambda capturing a local by reference that outlives the scope. Avoid by returning by value, being explicit about ownership (smart pointers), not storing views of temporaries, re-fetching references after container mutations, capturing by value in long-lived lambdas, and using compiler warnings plus AddressSanitizer.",
        freq: "very-common",
      },
      {
        q: "How should you pass a std::vector to a function?",
        a: "By `const std::vector<T>&` (or better, `std::span<const T>`) when the function only reads it. By non-const reference `std::vector<T>&` when it must modify the caller's vector (often clearer to return a new value). By value `std::vector<T>` when the function needs its own copy to keep, letting callers `std::move` into it to avoid copying. Never by value 'just because': that copies every element.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "When is a local variable's destructor called?",
        options: ["When the garbage collector runs", "At the end of its enclosing block", "When the program exits", "Never"],
        answer: 1,
        explain: "Automatic objects die deterministically at the end of their scope.",
      },
      {
        q: "Which can be null?",
        options: ["A reference", "A pointer", "Both", "Neither"],
        answer: 1,
        explain: "References must bind to an object; pointers can be nullptr.",
      },
      {
        q: "What's the difference between v[i] and v.at(i) on a vector?",
        options: ["None", "at() checks bounds and throws; [] doesn't check (UB if out of range)", "[] is slower", "at() returns a copy"],
        answer: 1,
        explain: "operator[] is unchecked for speed.",
      },
      {
        q: "You hold `int& r = v[0];` then call `v.push_back(x)`. Is r still safe to use?",
        options: ["Yes, always", "No: push_back may reallocate and r would dangle", "Only for ints", "Only if v is const"],
        answer: 1,
        explain: "Reallocation moves elements to a new buffer and frees the old one.",
      },
      {
        q: "Which parameter type accepts a std::vector<int>, a std::array<int, N> and a C array without copying?",
        options: ["std::vector<int>", "std::span<const int>", "int", "std::list<int>"],
        answer: 1,
        explain: "span is a non-owning view of any contiguous sequence.",
      },
      {
        q: "What does `delete` on memory from `new int[10]` cause?",
        options: ["Nothing wrong", "Undefined behavior: you need delete[]", "A compile error", "A memory leak only"],
        answer: 1,
        explain: "Array new must be paired with delete[].",
      },
    ],
  },

  // ------------------------------------------------------------------ CLASSES
  {
    id: "cpp-classes",
    stage: "Foundations",
    title: "Classes, constructors and RAII",
    tagline: "Encapsulation and invariants, constructors and destructors, const member functions, operator overloading, and RAII: the idea that makes C++ safe.",
    difficulty: "beginner",
    minutes: 35,
    concept: `
## class and struct
Both define a type with data members and member functions. The only difference is the default access: \`struct\` members are public, \`class\` members private. Convention: \`struct\` for plain data bundles, \`class\` when there's an **invariant** to protect.

\`\`\`cpp
class Account {
public:                                   // the interface
    explicit Account(std::string owner);  // constructor
    void deposit(long long cents);
    long long balance() const;            // const: promises not to modify the object
private:                                  // the implementation
    std::string owner_;
    long long balance_ = 0;               // default member initializer
};
\`\`\`
An **invariant** is a rule that's always true for valid objects ("balance is never negative"). Private data plus public member functions that check their inputs keep it true.

## Constructors
- Initialize members in the **member initializer list**: \`Account(std::string o) : owner_(std::move(o)), balance_(0) {}\`. It initializes directly instead of assigning afterwards (required for \`const\` and reference members). Members are initialized in **declaration order**, whatever order you write the list in.
- Mark single-argument constructors **\`explicit\`** to prevent surprising implicit conversions (\`Account a = "bob";\`).
- \`= default\` asks for the compiler-generated version; \`= delete\` forbids an operation (\`Account(const Account&) = delete;\` makes it non-copyable).
- **Aggregates** (structs with public data and no constructors) can be initialized with braces, even with **designated initializers** (C++20): \`Point p{.x = 1, .y = 2};\`.

## Destructors and RAII
A destructor (\`~Account()\`) runs automatically when the object's lifetime ends: at the end of its scope, when its owner is destroyed, or during **stack unwinding** when an exception passes through.

**RAII** ("Resource Acquisition Is Initialization") ties a resource to an object's lifetime: acquire it in the constructor, release it in the destructor. Then cleanup happens on *every* exit path: normal return, early return, \`break\`, or exception. The standard library is built on it:
| Resource | RAII type |
|---|---|
| Heap memory | \`std::vector\`, \`std::string\`, \`std::unique_ptr\` |
| A mutex lock | \`std::lock_guard\`, \`std::scoped_lock\` |
| A file | \`std::ifstream\` / \`std::ofstream\` |
| A thread | \`std::jthread\` (joins on destruction) |
| Your own (sockets, DB transactions, GPU buffers) | A small class with a destructor |

C++ has no \`finally\` because it doesn't need one.

## const correctness
Member functions that don't modify the object are marked \`const\`, so they can be called on \`const\` objects and references. Pass large objects as \`const T&\` and the compiler enforces that you only call their \`const\` methods. \`[[nodiscard]]\` makes the compiler warn when a caller ignores a return value that matters.

## Static members
\`static\` data members belong to the class, not each object (one shared copy; \`static inline\` lets you define it in the class). \`static\` member functions have no \`this\`.

## Operator overloading
Give your types natural syntax: \`a + b\`, \`a == b\`, \`std::cout << a\`.
- C++20's **\`operator<=>\`** ("spaceship") defaulted gives you \`<\`, \`<=\`, \`>\`, \`>=\` (and \`= default\` \`==\` gives \`!=\`) comparing members in order.
- Overload operators only where the meaning is obvious. A \`std::formatter\` specialization lets \`std::println\` print your type.

## The rule of zero (preview)
If your class only holds members that manage themselves (\`std::string\`, \`std::vector\`, \`std::unique_ptr\`), **don't write** a destructor, copy or move operations: the compiler-generated ones do the right thing. Write them only for a class that directly manages a resource (rule of three/five, covered in the move semantics chapter).
`,
    keyPoints: [
      "struct = public by default, class = private by default; classes protect invariants",
      "Use member initializer lists; members initialize in declaration order",
      "Mark single-argument constructors explicit",
      "RAII: acquire in the constructor, release in the destructor; cleanup runs on every path",
      "Mark non-modifying member functions const",
      "= delete forbids operations (e.g. copying); = default asks for the generated one",
      "Default operator<=> for comparisons; specialize std::formatter to print your types",
      "Rule of zero: let members manage resources so you write no special functions",
    ],
    code: [
      {
        title: "A class that protects its invariant",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>
#include <stdexcept>
#include <string>
#include <utility>

class Account {
public:
    explicit Account(std::string owner, long long opening_cents = 0)
        : owner_(std::move(owner)), balance_(opening_cents) {
        if (opening_cents < 0) throw std::invalid_argument("opening balance can't be negative");
        ++open_accounts_;
    }
    ~Account() { --open_accounts_; }

    Account(const Account&) = delete;              // accounts can't be copied
    Account& operator=(const Account&) = delete;

    void deposit(long long cents) {
        if (cents <= 0) throw std::invalid_argument("deposit must be positive");
        balance_ += cents;
    }

    [[nodiscard]] bool withdraw(long long cents) {  // the caller must check the result
        if (cents <= 0 || cents > balance_) return false;
        balance_ -= cents;
        return true;
    }

    [[nodiscard]] long long balance() const { return balance_; }    // const: read-only
    [[nodiscard]] const std::string& owner() const { return owner_; }
    static int open_accounts() { return open_accounts_; }

private:
    std::string owner_;
    long long balance_;
    static inline int open_accounts_ = 0;           // one counter shared by all accounts
};

void print_statement(const Account& a) {            // const&: only const members are callable
    std::println("{}: \${}.{:02}", a.owner(), a.balance() / 100, a.balance() % 100);
}

int main() {
    Account ada("Ada", 10'000);
    ada.deposit(2'550);
    std::println("withdraw $200: {}", ada.withdraw(20'000) ? "ok" : "declined");
    std::println("withdraw $50: {}", ada.withdraw(5'000) ? "ok" : "declined");
    print_statement(ada);

    try {
        ada.deposit(-5);
    } catch (const std::invalid_argument& e) {
        std::println("rejected: {}", e.what());
    }

    {
        Account temp("Temp");
        std::println("open accounts: {}", Account::open_accounts());
    }
    std::println("open accounts: {}", Account::open_accounts());
    // Account copy = ada;   // compile error: copy constructor is deleted
}`,
          },
        ],
        output: `withdraw $200: declined
withdraw $50: ok
Ada: $75.50
rejected: deposit must be positive
open accounts: 2
open accounts: 1`,
        explain: `- The balance can only change through \`deposit\`/\`withdraw\`, which validate their input: the "never negative" invariant holds for every \`Account\` that exists.
- Throwing from the constructor means a half-built object never exists.
- Money is stored as integer cents: \`10'000\` is $100.00.
- \`print_statement\` takes \`const Account&\`: no copy (copying is deleted anyway), and it can only call \`const\` members.`,
      },
      {
        title: "RAII: cleanup on every path, even exceptions",
        variants: [
          {
            lang: "cpp",
            code: `#include <print>
#include <stdexcept>
#include <string>
#include <utility>

// Rolls back automatically unless commit() was called.
class Transaction {
public:
    explicit Transaction(std::string name) : name_(std::move(name)) { std::println("BEGIN {}", name_); }
    ~Transaction() {
        if (!committed_) std::println("ROLLBACK {}", name_);
    }
    Transaction(const Transaction&) = delete;
    Transaction& operator=(const Transaction&) = delete;

    void commit() {
        committed_ = true;
        std::println("COMMIT {}", name_);
    }

private:
    std::string name_;
    bool committed_ = false;
};

void transfer(int amount) {
    Transaction tx("transfer " + std::to_string(amount));
    std::println("  debit A by {}", amount);
    if (amount > 100) throw std::runtime_error("limit exceeded");   // early exit via exception
    if (amount == 0) return;                                          // early exit via return
    std::println("  credit B by {}", amount);
    tx.commit();
}

int main() {
    transfer(50);
    transfer(0);
    try {
        transfer(500);
    } catch (const std::exception& e) {
        std::println("caught: {}", e.what());
    }
}`,
          },
        ],
        output: `BEGIN transfer 50
  debit A by 50
  credit B by 50
COMMIT transfer 50
BEGIN transfer 0
  debit A by 0
ROLLBACK transfer 0
BEGIN transfer 500
  debit A by 500
ROLLBACK transfer 500
caught: limit exceeded`,
        explain: `- The rollback runs for the early \`return\` **and** for the exception, without a single \`try\` or \`finally\` in \`transfer\`.
- When an exception propagates, C++ **unwinds the stack**: destructors of every fully constructed local run, in reverse order, before the \`catch\` block executes.
- Destructors should not throw (they're \`noexcept\` by default); throwing during unwinding calls \`std::terminate\`.
- The same pattern gives you \`std::lock_guard\` (unlock), file streams (close) and \`std::jthread\` (join).`,
      },
      {
        title: "Value types: comparisons, operators and formatting",
        variants: [
          {
            lang: "cpp",
            code: `#include <compare>
#include <format>
#include <print>
#include <set>
#include <string>

struct Version {
    int major = 0;
    int minor = 0;
    int patch = 0;
    auto operator<=>(const Version&) const = default;   // ==, !=, <, <=, >, >= member by member
};

template <>
struct std::formatter<Version> : std::formatter<std::string> {    // teach std::format/println
    auto format(const Version& v, std::format_context& ctx) const {
        return std::formatter<std::string>::format(std::format("v{}.{}.{}", v.major, v.minor, v.patch), ctx);
    }
};

struct Vec2 {
    double x = 0;
    double y = 0;
    Vec2 operator+(Vec2 o) const { return {x + o.x, y + o.y}; }
    Vec2 operator*(double k) const { return {x * k, y * k}; }
    Vec2& operator+=(Vec2 o) {
        x += o.x;
        y += o.y;
        return *this;
    }
    bool operator==(const Vec2&) const = default;
};

int main() {
    Version current{.major = 2, .minor = 10, .patch = 1};          // designated initializers (C++20)
    Version next{.major = 2, .minor = 11};
    std::println("{} < {}: {}", current, next, current < next);
    std::println("{} == {}: {}", current, Version{2, 10, 1}, current == Version{2, 10, 1});

    std::set<Version> releases{{1, 0, 0}, {2, 10, 1}, {1, 9, 3}, {2, 0, 0}};
    for (const Version& v : releases) std::print("{} ", v);       // sorted by operator<
    std::println("");

    Vec2 position{1, 2};
    Vec2 velocity{0.5, -1};
    position += velocity * 2;
    std::println("position = ({}, {}), back at start? {}", position.x, position.y, position == Vec2{1, 2});
}`,
          },
        ],
        output: `v2.10.1 < v2.11.0: true
v2.10.1 == v2.10.1: true
v1.0.0 v1.9.3 v2.0.0 v2.10.1
position = (2, 0), back at start? false`,
        explain: `- Defaulted \`<=>\` compares \`major\`, then \`minor\`, then \`patch\`: exactly semantic-version ordering, with no hand-written comparisons. Note that 2.10 > 2.9, unlike comparing the strings.
- \`std::set\` uses \`operator<\` to keep elements sorted.
- \`Version{2, 10, 1}\` is aggregate initialization in member order; designated initializers name the members and leave the rest at their defaults.
- Operators returning \`*this\` by reference (like \`+=\`) allow chaining, matching built-in types.`,
      },
    ],
    interview: [
      {
        q: "What is RAII?",
        a: "Resource Acquisition Is Initialization: bind the lifetime of a resource (memory, file, socket, lock, transaction) to the lifetime of an object. The constructor acquires it and the destructor releases it, so release happens automatically and deterministically when the object goes out of scope, on every path including exceptions. It's how the standard library manages memory (`vector`, `unique_ptr`), locks (`lock_guard`) and threads (`jthread`), and it's why C++ needs neither a garbage collector nor `finally`.",
        freq: "very-common",
      },
      {
        q: "What is the member initializer list and why use it?",
        a: "The `: member(value), ...` part of a constructor that initializes members directly before the constructor body runs. Assigning in the body would first default-construct and then assign (wasteful for strings and vectors) and is impossible for `const` members, references and types without default constructors. Members are always initialized in their declaration order, regardless of the list's order, so keep the list in the same order to avoid using an uninitialized member (`-Wreorder` warns).",
        freq: "common",
      },
      {
        q: "What does a const member function guarantee?",
        a: "It promises not to modify the object's observable state: inside it, `this` is a pointer to const, so members can't be changed (except those marked `mutable`, for caches or mutexes). Only const member functions can be called on const objects or through const references, which is how const-correctness propagates through APIs. It also documents intent and enables thread-safe concurrent reads by convention.",
        freq: "common",
      },
      {
        q: "Why mark a constructor explicit?",
        a: "A single-argument (or defaulted-arguments) constructor doubles as an implicit conversion. Without `explicit`, `void send(Account a); send(\"bob\");` might compile by silently constructing an Account from a string. `explicit` forbids implicit conversions, requiring `Account(\"bob\")`. The usual guideline is to make single-argument constructors explicit unless the conversion is genuinely natural (like `std::string` from a string literal).",
        freq: "common",
      },
      {
        q: "struct vs class in C++?",
        a: "The only language difference is default access (public for struct, private for class) and default inheritance access (public vs private). By convention, `struct` is used for passive data aggregates without invariants and `class` for types with invariants and behavior behind a private implementation.",
      },
    ],
    quiz: [
      {
        q: "In what order are data members initialized?",
        options: ["The order in the initializer list", "Declaration order in the class", "Alphabetical", "Random"],
        answer: 1,
        explain: "Always declaration order, whatever the initializer list says.",
      },
      {
        q: "An exception is thrown inside a function with a local RAII object. What happens to it?",
        options: ["It leaks", "Its destructor runs during stack unwinding", "It's destroyed at program exit", "It's copied to the catch block"],
        answer: 1,
        explain: "Stack unwinding destroys every fully constructed local object.",
      },
      {
        q: "How do you make a class non-copyable?",
        options: ["Make the destructor private", "Declare the copy constructor and copy assignment = delete", "Use struct", "Add a const member"],
        answer: 1,
        explain: "Deleted functions can't be called; the compiler reports an error.",
      },
      {
        q: "What does `auto operator<=>(const T&) const = default;` give you?",
        options: ["Only ==", "All six comparisons, comparing members in declaration order", "Hashing", "Printing"],
        answer: 1,
        explain: "Defaulted three-way comparison generates the relational operators (and == when defaulted).",
      },
      {
        q: "Which member functions can you call on a `const Account&`?",
        options: ["All of them", "Only those marked const", "Only static ones", "None"],
        answer: 1,
        explain: "const-correctness: a const object exposes only its const interface.",
      },
    ],
  },
];
