import type { Lesson } from "../types";

// Java track, part 1: Foundations.

export const javaFoundations: Lesson[] = [
  // ------------------------------------------------------------------ START
  {
    id: "java-start",
    stage: "Foundations",
    title: "Hello, Java: the JDK, the JVM and your first program",
    tagline: "Install a JDK, compile and run code three different ways, and see what happens between javac and the CPU.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "From Hello.java to machine code",
      nodes: [
        { id: "src", label: "Hello.java", kind: "client", x: 100, y: 300, sub: "your source code" },
        { id: "javac", label: "javac", kind: "service", x: 280, y: 300, sub: "the compiler" },
        { id: "cls", label: "Hello.class", kind: "storage", x: 460, y: 300, sub: "bytecode" },
        { id: "jars", label: "Library .jar files", kind: "registry", x: 460, y: 110, sub: "the classpath" },
        { id: "loader", label: "Class loader", kind: "control", x: 650, y: 200, sub: "load, verify, link" },
        { id: "interp", label: "Interpreter", kind: "worker", x: 650, y: 420, sub: "runs bytecode" },
        { id: "jit", label: "JIT compiler", kind: "model", x: 860, y: 420, sub: "C1 then C2" },
        { id: "cpu", label: "CPU", kind: "node", x: 860, y: 200, sub: "native machine code" },
      ],
      edges: [
        { from: "src", to: "javac", label: "javac Hello.java" },
        { from: "javac", to: "cls", label: "emits" },
        { from: "cls", to: "loader", label: "java Hello" },
        { from: "jars", to: "loader", label: "-cp" },
        { from: "loader", to: "interp", label: "main()" },
        { from: "interp", to: "jit", label: "hot method", dashed: true },
        { from: "jit", to: "cpu", label: "optimized code" },
        { from: "interp", to: "cpu", label: "slow path" },
      ],
      flows: [
        {
          name: "Compile and run",
          path: ["src", "javac", "cls", "loader", "interp", "cpu"],
          steps: [
            "javac checks types and syntax, then compiles your source. Errors here are compile-time errors: the program never starts.",
            "The output is Hello.class: platform-independent bytecode, not machine code. The same .class runs on Linux, macOS and Windows.",
            "`java Hello` starts a JVM. The class loader finds Hello.class, verifies the bytecode is safe, and links it.",
            "The JVM calls your public static void main(String[] args). At first, bytecode is interpreted instruction by instruction.",
            "The interpreter executes on the real CPU. Correct, but slower than native code.",
          ],
        },
        {
          name: "A hot loop gets JIT-compiled",
          path: ["interp", "jit", "cpu"],
          steps: [
            "The JVM counts calls and loop iterations. Once a method is 'hot', the JIT compiler (C1 quickly, then C2 aggressively) compiles it to native code using real runtime profiles.",
            "From then on that method runs as optimized machine code, often as fast as C++. This is why Java programs 'warm up'.",
          ],
        },
        {
          name: "Using a library",
          path: ["jars", "loader", "interp"],
          steps: [
            "Libraries ship as .jar files (zip archives of .class files). Maven or Gradle downloads them and puts them on the classpath.",
            "Classes are loaded lazily, the first time your code touches them.",
          ],
        },
      ],
    },
    concept: `
## What Java is
Java is a **statically typed, object-oriented, garbage-collected** language. You compile source code to **bytecode**, and the **Java Virtual Machine (JVM)** runs that bytecode on any operating system. That's the famous "write once, run anywhere".

Why learn it:
- **Jobs**: it's one of the most-used backend languages. Banks, e-commerce, Netflix, LinkedIn, Uber and most of the Fortune 500 run Java services.
- **Ecosystem**: Spring Boot, Kafka, Elasticsearch, Spark, Hadoop, Cassandra and Android's heritage are all JVM.
- **Performance**: after warm-up, the JIT compiler produces code that competes with C++.
- **Interviews**: Java is a top choice for coding interviews thanks to its rich, predictable collections library.

## JDK, JRE, JVM
| Piece | What it is | You need it to… |
|---|---|---|
| **JVM** | The virtual machine that loads and executes bytecode, manages memory and runs the garbage collector | run anything |
| **JRE** | JVM + the standard library | run Java programs (no longer shipped separately) |
| **JDK** | JRE + developer tools: \`javac\`, \`jshell\`, \`jar\`, \`jcmd\`, \`javadoc\` | write Java. **Install this.** |

## Which version?
Java ships every 6 months; every 2 years one release is **LTS** (long-term support): 8, 11, 17, **21**, **25**. Use **Java 21 or 25** for new code. Everything in this track runs on 21 unless a sample says it needs 25.

Install a JDK build such as **Eclipse Temurin** (adoptium.net), or use **SDKMAN!** to switch versions:
\`\`\`bash
sdk install java 25-tem      # macOS / Linux
java -version                # openjdk version "25" ...
javac -version
\`\`\`

## Your first program
\`\`\`java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
\`\`\`
- \`public class Hello\`: all Java code lives inside a **class**. A public class must be in a file with the same name: \`Hello.java\`.
- \`public static void main(String[] args)\`: the **entry point**. \`public\` so the JVM can call it, \`static\` so no object is needed first, \`void\` because it returns nothing, \`args\` holds the command-line arguments.
- \`System.out.println\`: print a line to standard output.
- Statements end with \`;\` and blocks use \`{ }\`. Java is **case-sensitive**.

## Three ways to run it
\`\`\`bash
# 1. Classic: compile, then run the class
javac Hello.java        # creates Hello.class
java Hello              # note: no .class extension

# 2. Single-file source launcher (Java 11+): compiles in memory and runs
java Hello.java

# 3. Interactive REPL for experiments
jshell
jshell> 2 + 3
$1 ==> 5
\`\`\`

## Java 25: less ceremony for small programs
Java 25 finalized **compact source files** and **instance main methods**. A small program no longer needs a class declaration or \`static\`:
\`\`\`java
void main() {
    IO.println("Hello, Java 25!");
}
\`\`\`
It's still Java: the compiler wraps it in an implicit class. Real applications keep the classic form, so learn both.

## How your code actually runs
Use the diagram on the Visualize tab: \`javac\` produces bytecode; the JVM's **class loader** loads and verifies it; the **interpreter** starts executing immediately; methods that run often get compiled to native code by the **JIT** (just-in-time) compiler. The JVM also owns the **heap** and the **garbage collector**, so you allocate objects with \`new\` and never free them yourself.

## Naming and layout conventions
- Classes \`PascalCase\`, methods and variables \`camelCase\`, constants \`UPPER_SNAKE_CASE\`, packages \`lowercase.dotted\` (reverse domain: \`com.example.billing\`).
- One top-level public class per file. Packages map to folders: \`com/example/billing/Invoice.java\`.
- Real projects use the **Maven standard layout**: \`src/main/java\` for code, \`src/test/java\` for tests (covered in the tooling chapter).

## Tools you'll want
- **IntelliJ IDEA** (Community edition is free) is the most popular Java IDE. VS Code with the "Extension Pack for Java" is a good lighter option.
- Let the IDE format your code, organize imports and show warnings. Read the warnings.
`,
    keyPoints: [
      "javac compiles .java to bytecode (.class); the JVM runs bytecode on any OS",
      "Install a JDK (21 or 25 LTS); the JDK includes javac, java, jshell, jar",
      "public static void main(String[] args) is the classic entry point",
      "A public class must live in a file of the same name",
      "java Hello.java runs a single file without a separate compile step",
      "The JIT compiles hot code to native: Java gets faster as it warms up",
      "Memory is managed by the garbage collector: you never call free",
    ],
    code: [
      {
        title: "Hello, Java (the classic form)",
        variants: [
          {
            lang: "java",
            code: `public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
        System.out.println("Arguments received: " + args.length);
    }
}`,
          },
        ],
        output: `Hello, Java!
Arguments received: 0`,
        explain: `- Save as \`Hello.java\`, then \`java Hello.java\` (or \`javac Hello.java && java Hello\`).
- \`args\` is an array of the words after the class name: \`java Hello.java a b\` prints \`Arguments received: 2\`.
- \`+\` with a \`String\` on either side means concatenation: the number is converted to text.`,
      },
      {
        title: "A first real program: a temperature table",
        variants: [
          {
            lang: "java",
            code: `public class Temperatures {
    public static void main(String[] args) {
        System.out.println("Celsius  Fahrenheit");
        for (int c = -10; c <= 40; c += 10) {
            double f = c * 9.0 / 5 + 32;
            System.out.printf("%7d  %10.1f%n", c, f);
        }
    }
}`,
          },
        ],
        output: `Celsius  Fahrenheit
    -10        14.0
      0        32.0
     10        50.0
     20        68.0
     30        86.0
     40       104.0`,
        explain: `- \`int c\` is a whole number; \`double f\` is a 64-bit floating-point number.
- \`c * 9.0 / 5\`: using \`9.0\` (a double) makes the whole expression floating-point. With \`9 / 5\` you'd get integer division (\`1\`) and wrong answers.
- \`printf\` formats: \`%7d\` = integer right-aligned in 7 characters, \`%10.1f\` = decimal in 10 characters with 1 digit after the point, \`%n\` = the platform's newline.`,
      },
      {
        title: "Java 25: a compact source file",
        note: "Needs JDK 25 or newer",
        variants: [
          {
            lang: "java",
            code: `// No class, no static, no String[] args: Java 25 adds them for you.
String greet(String name) {
    return "Hello, " + name + "!";
}

void main() {
    IO.println(greet("Java 25"));
    var langs = java.util.List.of("Java", "C++", "Go");
    IO.println("Learning " + langs.size() + " languages: " + langs);
}`,
          },
        ],
        output: `Hello, Java 25!
Learning 3 languages: [Java, C++, Go]`,
        explain: `- Methods declared at the top level become members of an **implicit class**, so \`main\` can call \`greet\` directly.
- \`IO.println\` is a new convenience class in \`java.lang\` for simple console programs.
- \`var\` lets the compiler infer the type (\`List<String>\`). It's still statically typed.`,
      },
    ],
    interview: [
      {
        q: "What's the difference between the JDK, the JRE and the JVM?",
        a: "The **JVM** executes bytecode: it loads classes, interprets and JIT-compiles them, and manages memory with a garbage collector. The **JRE** is the JVM plus the standard class library: everything needed to *run* Java. The **JDK** is the JRE plus development tools (`javac`, `jshell`, `jar`, `jcmd`, `javadoc`): everything needed to *build* Java. Since Java 11 vendors ship only the JDK (or custom runtimes built with `jlink`).",
        freq: "very-common",
      },
      {
        q: "Is Java compiled or interpreted?",
        a: "Both. `javac` compiles source to platform-independent **bytecode** ahead of time. At run time the JVM first **interprets** bytecode, profiles it, and **JIT-compiles** hot methods to native machine code (tiered compilation: C1 for fast startup, C2 for peak performance). Optimizations like inlining and escape analysis use real runtime data. You can also compile ahead-of-time to a native executable with GraalVM `native-image`.",
        freq: "very-common",
      },
      {
        q: "Why is main `public static void`?",
        a: "`public` so the JVM, which lives outside your class, can call it. `static` so it can be called without creating an instance first: there's no object yet when the program starts. `void` because the exit status is set with `System.exit(code)`, not a return value. `String[] args` receives command-line arguments. Since Java 25, instance `void main()` methods are also allowed; the launcher creates the object for you.",
        freq: "common",
      },
      {
        q: "What does 'write once, run anywhere' mean, and where does it break down?",
        a: "Bytecode targets the JVM, not a CPU or OS, so the same `.jar` runs on any platform with a compatible JVM. It breaks down at the edges: native libraries (JNI) are platform-specific, file paths and line separators differ (use `Path` and `%n`), and behavior can depend on the JVM version. Containers made the promise less central: today you usually ship the JVM together with the app.",
      },
    ],
    quiz: [
      {
        q: "What does `javac Hello.java` produce?",
        options: ["A native executable", "Hello.class containing bytecode", "A .jar file", "Assembly code"],
        answer: 1,
        explain: "javac compiles to JVM bytecode in a .class file. The JVM then interprets and JIT-compiles it at run time.",
      },
      {
        q: "Which tool do you need to install to write and compile Java?",
        options: ["The JRE", "The JVM", "The JDK", "Maven"],
        answer: 2,
        explain: "The JDK contains the compiler (javac) and other dev tools on top of the runtime.",
      },
      {
        q: "Your class `public class Invoice` is saved in `Billing.java`. What happens when you compile?",
        options: ["It compiles fine", "Compile error: a public class must be in Invoice.java", "Runtime error", "The class is renamed Billing"],
        answer: 1,
        explain: "A public top-level class must be declared in a file with the same name.",
      },
      {
        q: "Why does a Java service often get faster during its first minutes in production?",
        options: ["The garbage collector frees memory", "The JIT compiles hot methods to optimized native code", "The OS caches the .jar", "Bytecode is recompiled by javac"],
        answer: 1,
        explain: "The JVM profiles running code and JIT-compiles hot paths. This 'warm-up' is why benchmarks discard the first iterations.",
      },
      {
        q: "Which command compiles and runs a single source file in one step (Java 11+)?",
        options: ["javac -run Hello.java", "java Hello.java", "jshell Hello", "jar Hello.java"],
        answer: 1,
        explain: "The source-file launcher compiles the file in memory and runs its first class.",
      },
    ],
  },

  // ------------------------------------------------------------------ BASICS
  {
    id: "java-basics",
    stage: "Foundations",
    title: "Types, variables, strings & control flow",
    tagline: "Primitives vs references, the overflow and floating-point traps, String done right, and modern switch.",
    difficulty: "beginner",
    minutes: 30,
    visualizers: ["jmemory"],
    concept: `
## Two kinds of types
Every Java variable is either a **primitive** (holds the value itself) or a **reference** (holds a pointer to an object on the heap).

| Primitive | Size | Range / notes | Default |
|---|---|---|---|
| \`byte\` | 8 bit | −128 to 127 | 0 |
| \`short\` | 16 bit | −32,768 to 32,767 | 0 |
| \`int\` | 32 bit | about ±2.1 billion. **The default choice** | 0 |
| \`long\` | 64 bit | about ±9.2 × 10¹⁸. Literals end in \`L\`: \`3_000_000_000L\` | 0L |
| \`float\` | 32 bit | ~7 decimal digits. Rarely used | 0.0f |
| \`double\` | 64 bit | ~15 digits. **The default for decimals** | 0.0 |
| \`char\` | 16 bit | one UTF-16 code unit: \`'A'\` | '\\u0000' |
| \`boolean\` | — | \`true\` / \`false\` | false |

Everything else (\`String\`, arrays, your classes, \`Integer\`) is a **reference type**. A reference can be \`null\`; a primitive can't.

## Variables
\`\`\`java
int count = 0;                 // declare + initialize
final double TAX_RATE = 0.2;   // final: can't be reassigned
var names = new ArrayList<String>();  // var: type inferred (local variables only)
long population = 8_100_000_000L;     // underscores for readability
\`\`\`
Local variables must be assigned before use; the compiler checks. Fields get the defaults in the table above.

## The traps every Java developer hits
- **Integer overflow wraps silently**: \`Integer.MAX_VALUE + 1\` is \`-2147483648\`. Use \`long\`, or \`Math.addExact\` to throw on overflow.
- **Integer division truncates**: \`7 / 2 == 3\`. Make one side a double: \`7 / 2.0 == 3.5\`.
- **\`%\` keeps the sign of the left side**: \`-7 % 3 == -1\`. Use \`Math.floorMod(-7, 3) == 2\` for a always-positive result.
- **Floating point is binary**: \`0.1 + 0.2 == 0.30000000000000004\`. **Never use double for money**: use \`long\` cents or \`BigDecimal\`.
- **Casting truncates**: \`(int) 3.99 == 3\`. Use \`Math.round\` to round.
- **Boxed integers and \`==\`**: \`Integer\` is an object. \`==\` compares references, and only values −128..127 are cached, so \`Integer x = 128, y = 128; x == y\` is \`false\`. Use \`equals\`.

## Operators in one breath
Arithmetic \`+ - * / %\`, compound \`+= -= *=\`, increment \`i++\` (use old value, then add) vs \`++i\`, comparison \`== != < <= > >=\`, logical \`&& || !\` (short-circuiting), ternary \`cond ? a : b\`, bitwise \`& | ^ ~ << >> >>>\`.

## Strings
\`String\` is an **immutable** object. Every "modification" returns a new string.
\`\`\`java
String s = "Hello, Java";
s.length();            // 11
s.charAt(0);           // 'H'
s.substring(7);        // "Java"     (begin inclusive, end exclusive)
s.indexOf("Java");     // 7, or -1 if absent
s.contains("Java");    // true
s.toUpperCase();       // "HELLO, JAVA"
"  hi  ".strip();      // "hi"  (Unicode-aware trim)
"a,b,c".split(",");    // ["a", "b", "c"]
String.join("-", "a", "b");   // "a-b"
"ab".repeat(3);        // "ababab"
"".isEmpty(); " ".isBlank();  // true, true
"%s is %d".formatted("Ada", 36);
\`\`\`
**Compare strings with \`equals\`, never \`==\`.** \`==\` checks whether two references point at the same object (see the "Strings are immutable" scenario in the visualizer).

Building a string in a loop with \`+\` creates a new object every iteration. Use a **\`StringBuilder\`**:
\`\`\`java
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++) sb.append(i).append(',');
String csv = sb.toString();
\`\`\`
**Text blocks** (Java 15+) hold multi-line text without escapes:
\`\`\`java
String json = """
    {"name": "Ada", "active": true}
    """;
\`\`\`

## Control flow
\`\`\`java
if (score >= 90) grade = "A";
else if (score >= 80) grade = "B";
else grade = "C";

// switch EXPRESSION (Java 14+): no fall-through, returns a value, compiler checks enums are covered
String kind = switch (day) {
    case SATURDAY, SUNDAY -> "weekend";
    case FRIDAY -> {
        log("almost there");
        yield "almost weekend";     // yield returns from a block
    }
    default -> "weekday";
};

for (int i = 0; i < 10; i++) { ... }      // classic for
for (String name : names) { ... }          // enhanced for: arrays and any Iterable
while (queue.size() > 0) { ... }
do { line = read(); } while (line != null); // runs at least once
\`\`\`
\`break\` exits the loop, \`continue\` skips to the next iteration, and a **labeled break** (\`outer: for ... break outer;\`) exits nested loops. Prefer the arrow \`switch\`: the old \`case X:\` form falls through to the next case unless you remember \`break\`.
`,
    keyPoints: [
      "8 primitives hold values; everything else is a reference that can be null",
      "int overflow wraps silently; integer division truncates",
      "Never use double for money: long cents or BigDecimal",
      "Compare objects (including String and Integer) with equals, not ==",
      "String is immutable; build strings in loops with StringBuilder",
      "Prefer switch expressions with -> : no fall-through, returns a value",
      "var infers local variable types but Java stays statically typed",
    ],
    code: [
      {
        title: "Numbers: overflow, division, rounding and boxing",
        variants: [
          {
            lang: "java",
            code: `import java.math.BigDecimal;

public class Numbers {
    public static void main(String[] args) {
        int max = Integer.MAX_VALUE;
        System.out.println("int max:      " + max);
        System.out.println("max + 1:      " + (max + 1));     // wraps around!
        System.out.println("as long:      " + ((long) max + 1));
        System.out.println("7 / 2:        " + (7 / 2));       // integer division
        System.out.println("7 / 2.0:      " + (7 / 2.0));
        System.out.println("-7 % 3:       " + (-7 % 3));      // sign of the dividend
        System.out.println("floorMod:     " + Math.floorMod(-7, 3));
        System.out.println("0.1 + 0.2:    " + (0.1 + 0.2));
        System.out.println("(int) 3.99:   " + (int) 3.99);    // truncates
        System.out.println("round(3.5):   " + Math.round(3.5));
        char c = 'A';
        System.out.println("'A' + 1:      " + (c + 1));       // char promotes to int
        System.out.println("(char) 66:    " + (char) 66);
        BigDecimal total = new BigDecimal("0.10").add(new BigDecimal("0.20"));
        System.out.println("BigDecimal:   " + total);

        Integer a = 127, b = 127, x = 128, y = 128;
        System.out.println("127 == 127:   " + (a == b));      // cached objects
        System.out.println("128 == 128:   " + (x == y));      // different objects!
        System.out.println("128 equals:   " + x.equals(y));
    }
}`,
          },
        ],
        output: `int max:      2147483647
max + 1:      -2147483648
as long:      2147483648
7 / 2:        3
7 / 2.0:      3.5
-7 % 3:       -1
floorMod:     2
0.1 + 0.2:    0.30000000000000004
(int) 3.99:   3
round(3.5):   4
'A' + 1:      66
(char) 66:    B
BigDecimal:   0.30
127 == 127:   true
128 == 128:   false
128 equals:   true`,
        explain: `- \`(long) max + 1\` casts *before* adding, so the addition happens in 64 bits. \`(long) (max + 1)\` would cast the already-overflowed result.
- \`new BigDecimal("0.10")\`: always build BigDecimal from a **String**. \`new BigDecimal(0.1)\` captures the binary error: 0.1000000000000000055511151231257827…
- Autoboxing turns \`127\` into \`Integer.valueOf(127)\`, which returns a cached object for −128..127. That's the only reason the first \`==\` is true. It's a famous interview trick question.`,
      },
      {
        title: "Strings: the methods you'll use daily",
        variants: [
          {
            lang: "java",
            code: `public class Strings {
    public static void main(String[] args) {
        String t = "  Hello, Java  ".strip();
        System.out.println("[" + t + "] length=" + t.length());
        System.out.println(t.toUpperCase() + " | " + t.substring(7) + " | " + t.indexOf("Java"));
        System.out.println(t.contains("Java") + " " + t.startsWith("Hell") + " " + t.charAt(0));
        System.out.println(String.join("-", "a", "b", "c") + " " + "ab".repeat(3));
        String[] parts = "red,green,blue".split(",");
        System.out.println(parts.length + " parts, second = " + parts[1]);

        String a = "java";
        String b = new String("java");
        System.out.println("a == b: " + (a == b) + ", a.equals(b): " + a.equals(b));
        System.out.println("equalsIgnoreCase: " + "JAVA".equalsIgnoreCase(a));

        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= 5; i++) {
            sb.append(i);
            if (i < 5) sb.append(',');
        }
        System.out.println(sb.reverse());

        String json = """
            {
              "name": "Ada",
              "langs": ["Java", "Go"]
            }
            """;
        System.out.print(json);
        System.out.println("%s is %d years old".formatted("Ada", 36));
    }
}`,
          },
        ],
        output: `[Hello, Java] length=11
HELLO, JAVA | Java | 7
true true H
a-b-c ababab
3 parts, second = green
a == b: false, a.equals(b): true
equalsIgnoreCase: true
5,4,3,2,1
{
  "name": "Ada",
  "langs": ["Java", "Go"]
}
Ada is 36 years old`,
        explain: `- \`strip()\` removes leading and trailing whitespace (prefer it over the older \`trim()\`).
- Indexes are zero-based, and \`substring(begin, end)\` excludes \`end\`.
- The text block's indentation is measured from the closing \`"""\`: the common leading whitespace is removed, so the JSON comes out flush left.
- \`StringBuilder\` is mutable, so \`append\` and \`reverse\` change it in place. Not thread-safe; that's fine for local variables.`,
      },
      {
        title: "Control flow: FizzBuzz, switch expressions, loops and labels",
        variants: [
          {
            lang: "java",
            code: `public class ControlFlow {
    enum Day { MON, TUE, WED, THU, FRI, SAT, SUN }

    public static void main(String[] args) {
        StringBuilder line = new StringBuilder();
        for (int i = 1; i <= 15; i++) {
            String word = i % 15 == 0 ? "FizzBuzz" : i % 3 == 0 ? "Fizz" : i % 5 == 0 ? "Buzz" : String.valueOf(i);
            line.append(word).append(' ');
        }
        System.out.println(line.toString().strip());

        for (Day d : Day.values()) {
            String kind = switch (d) {
                case SAT, SUN -> "weekend";
                case FRI -> {
                    String mood = "almost weekend";
                    yield mood;
                }
                default -> "weekday";
            };
            if (d == Day.MON || d == Day.FRI || d == Day.SUN) System.out.println(d + ": " + kind);
        }

        int n = 27, steps = 0;
        while (n != 1) {
            n = (n % 2 == 0) ? n / 2 : 3 * n + 1;
            steps++;
        }
        System.out.println("Collatz(27) reaches 1 in " + steps + " steps");

        outer:
        for (int r = 0; r < 5; r++) {
            for (int c = 0; c < 5; c++) {
                if (r * c == 6) {
                    System.out.println("first r*c == 6 at (" + r + ", " + c + ")");
                    break outer;
                }
            }
        }
    }
}`,
          },
        ],
        output: `1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz
MON: weekday
FRI: almost weekend
SUN: weekend
Collatz(27) reaches 1 in 111 steps
first r*c == 6 at (2, 3)`,
        explain: `- Check \`% 15\` first in FizzBuzz, or 15 would print "Fizz".
- The switch expression must be **exhaustive**: for an enum, either list every constant or add \`default\`.
- \`break outer\` leaves both loops at once. Without the label, \`break\` only exits the inner loop.`,
      },
    ],
    interview: [
      {
        q: "Why does `Integer a = 128, b = 128; a == b` print false but the same with 127 prints true?",
        a: "Autoboxing calls `Integer.valueOf`, which returns **cached** instances for −128..127. For 127 both variables reference the same cached object, so `==` (reference comparison) is true. 128 isn't cached, so two different objects are created and `==` is false. Always compare wrapper types with `equals` (or unbox to `int`). The same trap applies to `Long`, `Short` and `Character`.",
        freq: "very-common",
      },
      {
        q: "Why is String immutable in Java, and what are the consequences?",
        a: "Immutability makes strings **safe to share**: they can be interned in the string pool, used as `HashMap` keys (the hash can be cached), passed across threads without locking, and trusted in security-sensitive APIs (a file name can't change after it's checked). The cost: every concatenation creates a new object, so building strings in a loop with `+` is O(n²). Use `StringBuilder` (or `String.join` / `Collectors.joining`). The compiler already turns a single `a + b + c` expression into efficient code.",
        freq: "very-common",
      },
      {
        q: "What's the difference between `==` and `equals()`?",
        a: "`==` compares **values** for primitives and **references** (identity) for objects: are these the same object? `equals()` compares **logical equality** as defined by the class: `String` compares characters, `List` compares elements. `Object.equals` defaults to identity, so your own classes must override it (and `hashCode`) to get value semantics. Records do it for you.",
        freq: "very-common",
      },
      {
        q: "How should you represent money in Java?",
        a: "Not with `double` or `float`: they're binary fractions, so 0.1 can't be represented exactly and errors accumulate. Use `long` amounts in the smallest unit (cents), or `BigDecimal` constructed from strings with an explicit `RoundingMode` for division. Store the currency alongside the amount (or use the JSR 354 Money API, `javax.money`).",
        freq: "common",
      },
      {
        q: "What's the difference between `i++` and `++i`?",
        a: "Both add 1 to `i`. As an *expression*, `i++` evaluates to the old value and `++i` to the new value: `int i = 5; int a = i++; // a = 5, i = 6` and `int b = ++i; // b = 7, i = 7`. On its own line, like in a `for` loop, there's no difference. Neither is atomic: `count++` on a shared field is a read-modify-write race between threads.",
      },
    ],
    quiz: [
      {
        q: "What does `System.out.println(7 / 2);` print?",
        options: ["3.5", "3", "4", "3.0"],
        answer: 1,
        explain: "Both operands are int, so integer division truncates toward zero.",
      },
      {
        q: "What is `Integer.MAX_VALUE + 1`?",
        options: ["An ArithmeticException", "2147483648", "-2147483648", "0"],
        answer: 2,
        explain: "int arithmetic wraps around on overflow. Math.addExact would throw instead.",
      },
      {
        q: "Which is the correct way to check that two strings have the same text?",
        options: ["s1 == s2", "s1.equals(s2)", "s1.compareTo(s2) == 1", "s1.hashCode() == s2.hashCode()"],
        answer: 1,
        explain: "equals compares characters. == compares references; equal hash codes don't guarantee equal strings.",
      },
      {
        q: "Which type should hold an account balance?",
        options: ["double", "float", "BigDecimal (or long cents)", "int dollars"],
        answer: 2,
        explain: "Binary floating point can't represent most decimal fractions exactly.",
      },
      {
        q: "What does this print? `String s = \"hi\"; s.toUpperCase(); System.out.println(s);`",
        options: ["HI", "hi", "Hi", "It doesn't compile"],
        answer: 1,
        explain: "Strings are immutable. toUpperCase returns a NEW string, which this code throws away.",
      },
      {
        q: "What's the main advantage of the arrow form `case X -> ...` in switch?",
        options: ["It's faster at run time", "No fall-through between cases, and it can be used as an expression", "It allows null cases only", "It works only with strings"],
        answer: 1,
        explain: "Arrow cases don't fall through, and a switch expression yields a value and must be exhaustive.",
      },
    ],
  },

  // ------------------------------------------------------------------ METHODS & ARRAYS
  {
    id: "java-methods",
    stage: "Foundations",
    title: "Methods, arrays & pass-by-value",
    tagline: "Write reusable methods, overload them, recurse, work with arrays, and understand exactly what Java copies.",
    difficulty: "beginner",
    minutes: 25,
    visualizers: ["jmemory"],
    concept: `
## Methods
A method is a named block of code with parameters and a return type.
\`\`\`java
//  modifiers  return type  name   parameters
    static     int          add   (int a, int b) {
        return a + b;
    }
\`\`\`
- \`void\` means "returns nothing".
- \`static\` methods belong to the class (\`Math.max(a, b)\`). Non-static (instance) methods belong to an object (\`name.length()\`). In the next chapter we write instance methods.
- Keep methods **short and focused**: one job, a verb name (\`calculateTax\`, \`isValid\`), ideally under ~20 lines.

### Overloading
Same name, different parameter lists. The compiler picks the best match at compile time:
\`\`\`java
static int add(int a, int b) { return a + b; }
static double add(double a, double b) { return a + b; }
add(2, 3);     // int version
add(2.5, 3);   // double version (3 widens to 3.0)
\`\`\`
The return type alone can't distinguish overloads.

### Varargs
\`static int sum(int... nums)\` accepts zero or more ints; inside, \`nums\` is an \`int[]\`. Only the last parameter can be varargs. \`String.format\` and \`List.of\` use it.

### Recursion
A method that calls itself. Every recursive method needs a **base case** that stops, and each call must move toward it. Each call gets its own **stack frame**, so very deep recursion throws \`StackOverflowError\` (Java doesn't eliminate tail calls). Recursion is natural for trees, divide and conquer and backtracking.

## Arrays
Fixed-size, zero-indexed, and they know their \`length\` (a field, not a method).
\`\`\`java
int[] scores = {72, 95, 61};          // literal
String[] names = new String[3];       // [null, null, null]: defaults
int[][] grid = new int[3][4];         // 3 rows × 4 columns
scores[0] = 80;
scores.length;                        // 3
scores[3];                            // ArrayIndexOutOfBoundsException
\`\`\`
The \`java.util.Arrays\` helpers: \`toString\`, \`deepToString\` (2D), \`sort\` (dual-pivot quicksort for primitives, stable merge sort for objects), \`binarySearch\` (on a sorted array), \`fill\`, \`copyOf\`, \`copyOfRange\`, \`equals\`, \`asList\`, \`stream\`.

Arrays are **objects**: a variable holds a reference. Printing an array directly shows something like \`[I@1b6d3586\`. Use \`Arrays.toString\`. In practice you'll use \`ArrayList\` (resizable) most of the time; arrays matter for performance, primitives, and interview problems.

## Java is always pass-by-value
This is the #1 Java fundamentals interview question. **Every argument is copied into the parameter.**
- For a **primitive**, the value is copied. The method can't change the caller's variable.
- For an **object**, the *reference* is copied. Both point at the **same object**, so the method **can mutate** it (\`p.x = 99\` is visible to the caller), but **reassigning** the parameter (\`p = new Point()\`) only changes the local copy.

That's why a \`swap(a, b)\` method can't swap the caller's variables in Java. Step through the **Pass-by-value** scenario in the visualizer: watch the frames, the copied reference and the object it points to.

## Scope and lifetime
Local variables live in the method's stack frame and disappear when it returns. Objects live on the heap as long as something references them; then the garbage collector reclaims them.
`,
    keyPoints: [
      "Overloading = same name, different parameter types; chosen at compile time",
      "Varargs (int... xs) is an array inside the method; must be the last parameter",
      "Recursion needs a base case; too deep → StackOverflowError",
      "Arrays are fixed-size objects with a length field; use Arrays.toString to print",
      "Java is ALWAYS pass-by-value; for objects the value copied is the reference",
      "A method can mutate an object it receives but can't re-point the caller's variable",
    ],
    complexity: [
      { op: "Array access a[i]", time: "O(1)", space: "O(1)" },
      { op: "Arrays.sort (primitives)", time: "O(n log n)", space: "O(log n)", note: "dual-pivot quicksort" },
      { op: "Arrays.sort (objects)", time: "O(n log n)", space: "O(n)", note: "stable TimSort" },
      { op: "Arrays.binarySearch", time: "O(log n)", note: "array must be sorted" },
      { op: "Arrays.copyOf", time: "O(n)", space: "O(n)" },
    ],
    code: [
      {
        title: "Arrays: create, sort, search, copy",
        variants: [
          {
            lang: "java",
            code: `import java.util.Arrays;

public class ArraysDemo {
    public static void main(String[] args) {
        int[] scores = {72, 95, 61, 88, 79};
        System.out.println("length = " + scores.length + ", first = " + scores[0]);

        int[] sorted = Arrays.copyOf(scores, scores.length);  // sort a copy
        Arrays.sort(sorted);
        System.out.println(Arrays.toString(scores) + " -> " + Arrays.toString(sorted));
        System.out.println("index of 88 = " + Arrays.binarySearch(sorted, 88));

        int sum = 0;
        for (int s : scores) sum += s;
        System.out.printf("average = %.1f%n", (double) sum / scores.length);

        String[] names = new String[3];
        boolean[] flags = new boolean[2];
        System.out.println(Arrays.toString(names) + " " + Arrays.toString(flags));

        int[][] grid = new int[3][4];
        grid[1][2] = 7;
        for (int[] row : grid) System.out.println(Arrays.toString(row));
        System.out.println(Arrays.deepToString(new int[][] {{1, 2}, {3}}));

        try {
            System.out.println(scores[5]);
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("Oops: " + e.getMessage());
        }
    }
}`,
          },
        ],
        output: `length = 5, first = 72
[72, 95, 61, 88, 79] -> [61, 72, 79, 88, 95]
index of 88 = 3
average = 79.0
[null, null, null] [false, false]
[0, 0, 0, 0]
[0, 0, 7, 0]
[0, 0, 0, 0]
[[1, 2], [3]]
Oops: Index 5 out of bounds for length 5`,
        explain: `- \`Arrays.sort\` sorts in place, so we copied first to keep the original order.
- \`(double) sum / scores.length\`: cast one operand to avoid integer division.
- New arrays are filled with defaults: \`null\` for references, \`false\`, \`0\`.
- A 2D array is an array of arrays; rows can even have different lengths ("jagged").`,
      },
      {
        title: "Methods: overloading, varargs and recursion",
        variants: [
          {
            lang: "java",
            code: `public class Methods {
    static int add(int a, int b) { return a + b; }
    static double add(double a, double b) { return a + b; }

    static int sum(int... nums) {
        int total = 0;
        for (int n : nums) total += n;
        return total;
    }

    static long factorial(int n) {
        if (n <= 1) return 1;            // base case
        return n * factorial(n - 1);     // recursive case
    }

    static int binarySearch(int[] a, int target, int lo, int hi) {
        if (lo > hi) return -1;
        int mid = lo + (hi - lo) / 2;    // avoids int overflow of (lo + hi)
        if (a[mid] == target) return mid;
        return a[mid] < target ? binarySearch(a, target, mid + 1, hi) : binarySearch(a, target, lo, mid - 1);
    }

    static boolean isPalindrome(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            if (s.charAt(i++) != s.charAt(j--)) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        System.out.println(add(2, 3) + " " + add(2.5, 3));
        System.out.println(sum() + " " + sum(1, 2, 3) + " " + sum(new int[] {4, 5}));
        System.out.println("10! = " + factorial(10));
        int[] sorted = {2, 5, 8, 12, 16, 23, 38};
        System.out.println("23 at index " + binarySearch(sorted, 23, 0, sorted.length - 1));
        System.out.println(isPalindrome("racecar") + " " + isPalindrome("java"));
    }
}`,
          },
        ],
        output: `5 5.5
0 6 9
10! = 3628800
23 at index 5
true false`,
        explain: `- \`add(2.5, 3)\` picks the double overload: \`3\` widens to \`3.0\`.
- A varargs method accepts nothing, a list of values, or an existing array.
- \`factorial\` returns \`long\` because 13! already overflows an \`int\`. 21! overflows a \`long\` too; use \`BigInteger\` beyond that.
- \`lo + (hi - lo) / 2\` is the overflow-safe midpoint: a classic bug that lived in the JDK's own binary search for nine years.`,
      },
      {
        title: "Pass-by-value, proven",
        variants: [
          {
            lang: "java",
            code: `public class PassByValue {
    static class Point {
        int x, y;
        Point(int x, int y) { this.x = x; this.y = y; }
    }

    static void bump(int n) { n++; }

    static void move(Point p) {
        p.x = 99;               // mutates the caller's object
        p = new Point(0, 0);    // re-points only the local copy
    }

    static void swap(Point a, Point b) {   // can't work in Java
        Point t = a;
        a = b;
        b = t;
    }

    static void fill(int[] arr) { arr[0] = 42; }

    public static void main(String[] args) {
        int count = 1;
        Point pt = new Point(1, 2);
        bump(count);
        move(pt);
        System.out.println(count + " " + pt.x);

        Point a = new Point(1, 1), b = new Point(2, 2);
        swap(a, b);
        System.out.println("after swap: a.x=" + a.x + " b.x=" + b.x);

        int[] arr = {1, 2, 3};
        fill(arr);
        System.out.println("arr[0] = " + arr[0]);
    }
}`,
          },
        ],
        output: `1 99
after swap: a.x=1 b.x=2
arr[0] = 42`,
        explain: `- \`count\` stays 1: \`bump\` incremented its own copy.
- \`pt.x\` becomes 99 because \`move\` received a copy of the *reference* and used it to change the shared object. The \`new Point(0, 0)\` was invisible to \`main\`.
- \`swap\` only swapped its local copies of the references.
- Arrays are objects, so \`fill\` can change elements of the caller's array.`,
      },
    ],
    interview: [
      {
        q: "Is Java pass-by-value or pass-by-reference?",
        a: "**Always pass-by-value.** For primitives the value is copied. For objects, the value of the variable *is a reference*, and that reference is copied. So a method can mutate the object the caller passed (`list.add(x)` is visible outside), but can't make the caller's variable point to a different object (`list = new ArrayList<>()` inside the method has no effect outside). That's also why you can't write a working `swap(a, b)` for the caller's variables in Java.",
        freq: "very-common",
      },
      {
        q: "What's the difference between method overloading and overriding?",
        a: "**Overloading**: same method name, different parameter lists, in the same class (or a subclass). Resolved at **compile time** from the static types of the arguments. **Overriding**: a subclass provides a new implementation of an inherited method with the same signature. Resolved at **run time** from the actual object's class (dynamic dispatch). Use `@Override` so the compiler catches signature mistakes.",
        freq: "very-common",
      },
      {
        q: "What causes a StackOverflowError, and how do you avoid it?",
        a: "Each method call pushes a frame on the thread's stack (default ~512 KB–1 MB). Unbounded or very deep recursion exhausts it. Causes: a missing or unreachable base case, or legitimately deep recursion (a linked list of 1 million nodes processed recursively). Fixes: fix the base case, convert to an explicit loop with your own `Deque` as a stack, or (rarely) increase the stack size with `-Xss` or a `Thread` constructor argument. Java doesn't do tail-call elimination.",
      },
      {
        q: "Array vs ArrayList?",
        a: "An **array** has a fixed length, can hold primitives directly (`int[]`), and has the least overhead. An **ArrayList** is a resizable list backed by an array that grows by 50% when full; it holds only objects (so `ArrayList<Integer>` boxes every number) and offers a rich API (`add`, `remove`, `contains`, streams). Use `ArrayList` by default; use arrays for fixed-size, performance-sensitive or primitive-heavy code.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "After `void reset(int[] a) { a = new int[3]; }` is called with `arr = {1, 2, 3}`, what's `arr[0]`?",
        options: ["0", "1", "null", "It doesn't compile"],
        answer: 1,
        explain: "Reassigning the parameter only changes the local copy of the reference. The caller's array is untouched.",
      },
      {
        q: "After `void set(int[] a) { a[0] = 9; }` is called with `arr = {1, 2, 3}`, what's `arr[0]`?",
        options: ["1", "9", "0", "It throws"],
        answer: 1,
        explain: "The copied reference points at the same array, so writing an element is visible to the caller.",
      },
      {
        q: "Which pair is a valid overload?",
        options: ["int f(int x) and long f(int x)", "int f(int x) and int f(long x)", "int f(int x) and int f(int y)", "void f() and int f()"],
        answer: 1,
        explain: "Overloads must differ in parameter types (or count). Return type and parameter names don't count.",
      },
      {
        q: "What does `new String[2]` contain?",
        options: ["Two empty strings", "[null, null]", "Nothing: its length is 0", "Random memory"],
        answer: 1,
        explain: "New arrays are filled with default values: null for references.",
      },
      {
        q: "What's wrong with `int mid = (lo + hi) / 2;` for large arrays?",
        options: ["Nothing", "lo + hi can overflow int and become negative", "It rounds up", "Division by zero"],
        answer: 1,
        explain: "With indexes above ~1 billion the sum overflows. Use lo + (hi - lo) / 2 or (lo + hi) >>> 1.",
      },
    ],
  },

  // ------------------------------------------------------------------ OOP
  {
    id: "java-oop",
    stage: "Foundations",
    title: "Classes, objects, records & enums",
    tagline: "Model your domain: constructors, encapsulation, static members, equals/hashCode, records and enums with behavior.",
    difficulty: "beginner",
    minutes: 30,
    concept: `
## Classes and objects
A **class** is a blueprint: fields (state) plus methods (behavior). An **object** is one instance of it, created with \`new\`.
\`\`\`java
public class BankAccount {
    private final String owner;     // field: state
    private long balanceCents;

    public BankAccount(String owner) {   // constructor: same name, no return type
        this.owner = owner;              // 'this' = the object being built
    }

    public void deposit(long cents) {    // method: behavior
        if (cents <= 0) throw new IllegalArgumentException("must be positive");
        balanceCents += cents;
    }

    public long balanceCents() { return balanceCents; }
}

BankAccount acc = new BankAccount("Ada");   // allocate on the heap, run the constructor
acc.deposit(5_00);
\`\`\`
- If you write no constructor, Java adds an empty no-arg one. Write one, and the default disappears.
- Constructors can call each other with \`this(...)\` to avoid duplication.

## Encapsulation
Make fields **private** and expose behavior through methods. The class then **guards its invariants**: the balance can only change through \`deposit\`/\`withdraw\`, which validate input. Don't add a setter for every field by reflex; ask what operations make sense.

| Modifier | Class | Package | Subclass | Everyone |
|---|---|---|---|---|
| \`private\` | ✓ | | | |
| *(none)* package-private | ✓ | ✓ | | |
| \`protected\` | ✓ | ✓ | ✓ | |
| \`public\` | ✓ | ✓ | ✓ | ✓ |

Start with the most restrictive level that works.

## static: belongs to the class
\`static\` fields are shared by all instances (one copy); \`static\` methods run without an object and can't use \`this\`. Typical uses: constants (\`static final\`), counters, factory methods (\`List.of\`), utility classes (\`Math\`). Avoid mutable static state: it's global state that makes testing and concurrency harder.

## final
- \`final\` field: assigned exactly once (in the constructor), then fixed. Prefer it.
- \`final\` local variable: can't be reassigned.
- \`final\` class: can't be subclassed (\`String\` is final). \`final\` method: can't be overridden.

**Immutable objects** (all fields final, no setters, defensive copies of mutable inputs) are simpler to reason about and automatically thread-safe.

## Every class extends Object
So every object has \`toString()\`, \`equals(Object)\`, \`hashCode()\` and \`getClass()\`. The defaults use **identity**: two different objects are never equal, and \`toString\` prints \`BankAccount@1b6d3586\`.

### The equals/hashCode contract
If you override \`equals\`, you **must** override \`hashCode\` so that equal objects have equal hash codes. \`HashMap\` and \`HashSet\` find the bucket with \`hashCode\` first, then compare with \`equals\`. Break the contract and \`set.contains(x)\` returns false for an equal object (see the code tab). Rules for equals: reflexive, symmetric, transitive, consistent, and \`x.equals(null)\` is false.

## Records (Java 16+): data classes in one line
\`\`\`java
public record Point(int x, int y) {}
\`\`\`
This generates private final fields, a constructor, accessors \`x()\` and \`y()\` (no "get" prefix), and correct \`equals\`, \`hashCode\` and \`toString\`. Records are **immutable** and can't extend another class (they can implement interfaces). Add a **compact constructor** to validate or normalize:
\`\`\`java
public record Email(String value) {
    public Email {
        if (!value.contains("@")) throw new IllegalArgumentException("bad email");
        value = value.toLowerCase();
    }
}
\`\`\`
Use records for DTOs, API requests and responses, map keys, and value objects.

## Enums: a fixed set of instances
\`\`\`java
enum Plan {
    FREE(0), PRO(1200), TEAM(4900);
    private final int priceCents;
    Plan(int priceCents) { this.priceCents = priceCents; }
    int priceCents() { return priceCents; }
}
\`\`\`
Enums are full classes: fields, constructors, methods, even per-constant behavior. They're type-safe (no magic strings), work in \`switch\`, and have \`values()\`, \`valueOf("PRO")\`, \`ordinal()\` and \`name()\`. \`EnumMap\` and \`EnumSet\` are very fast collections keyed by enums. An enum with one constant is also the simplest correct **singleton**.

## Object lifecycle
\`new\` allocates on the heap and runs the constructor. When nothing references the object any more, it becomes eligible for **garbage collection**. Never rely on \`finalize()\` (deprecated for removal); release resources such as files and sockets explicitly with try-with-resources (exceptions chapter).
`,
    keyPoints: [
      "Fields private, behavior public: the class protects its own invariants",
      "Prefer final fields and immutable objects",
      "static members belong to the class; avoid mutable static state",
      "Override equals AND hashCode together, or HashMap/HashSet break",
      "Records give you constructor, accessors, equals, hashCode, toString for free",
      "Enums are classes: fields, constructors and methods, type-safe constants",
      "Access levels: private < package-private < protected < public",
    ],
    code: [
      {
        title: "Encapsulation: a bank account that protects its balance",
        variants: [
          {
            lang: "java",
            code: `import java.util.ArrayList;
import java.util.List;

public class Bank {
    public static void main(String[] args) {
        BankAccount acc = new BankAccount("Ada", 100);
        acc.deposit(50);
        acc.withdraw(30);
        System.out.println(acc);
        try {
            acc.withdraw(500);
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
        System.out.println("history = " + acc.history());
        System.out.println("accounts opened = " + BankAccount.opened());
    }
}

class BankAccount {
    private static int opened = 0;              // one counter shared by all accounts
    private final String owner;                 // set once
    private long balanceCents;                  // only methods below can change it
    private final List<String> history = new ArrayList<>();

    BankAccount(String owner, long initialDollars) {
        if (owner == null || owner.isBlank()) throw new IllegalArgumentException("owner required");
        this.owner = owner;
        this.balanceCents = initialDollars * 100;
        opened++;
    }

    void deposit(long dollars) {
        if (dollars <= 0) throw new IllegalArgumentException("deposit must be positive");
        balanceCents += dollars * 100;
        history.add("+" + dollars);
    }

    void withdraw(long dollars) {
        if (dollars * 100 > balanceCents) throw new IllegalArgumentException("insufficient funds");
        balanceCents -= dollars * 100;
        history.add("-" + dollars);
    }

    long balance() { return balanceCents / 100; }

    List<String> history() { return List.copyOf(history); }   // callers can't modify ours

    static int opened() { return opened; }

    @Override
    public String toString() { return owner + ": $" + balance(); }
}`,
          },
        ],
        output: `Ada: $120
Rejected: insufficient funds
history = [+50, -30]
accounts opened = 1`,
        explain: `- The balance has no setter. The only ways to change it are \`deposit\` and \`withdraw\`, which validate. That's encapsulation: invalid states can't be created from outside.
- \`List.copyOf\` returns an unmodifiable copy, so a caller can't do \`acc.history().clear()\`.
- \`println(acc)\` calls \`toString()\` automatically.
- A file can hold several top-level classes, but only one public one (\`Bank\`, matching the file name).`,
      },
      {
        title: "equals and hashCode: what breaks without them",
        variants: [
          {
            lang: "java",
            code: `import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

public class Equality {
    static class BadPoint {
        final int x, y;
        BadPoint(int x, int y) { this.x = x; this.y = y; }

        @Override
        public boolean equals(Object o) {
            return o instanceof BadPoint p && p.x == x && p.y == y;
        }
        // hashCode() not overridden: the contract is broken
    }

    static class Point {
        final int x, y;
        Point(int x, int y) { this.x = x; this.y = y; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Point p)) return false;
            return x == p.x && y == p.y;
        }

        @Override
        public int hashCode() { return Objects.hash(x, y); }
    }

    record RPoint(int x, int y) {}   // all of the above, generated

    public static void main(String[] args) {
        Set<BadPoint> bad = new HashSet<>();
        bad.add(new BadPoint(1, 2));
        System.out.println("BadPoint found: " + bad.contains(new BadPoint(1, 2)));

        Set<Point> good = new HashSet<>();
        good.add(new Point(1, 2));
        System.out.println("Point found: " + good.contains(new Point(1, 2)));

        Set<RPoint> recs = new HashSet<>();
        recs.add(new RPoint(1, 2));
        System.out.println("record found: " + recs.contains(new RPoint(1, 2)) + ", prints " + new RPoint(1, 2));
    }
}`,
          },
        ],
        output: `BadPoint found: false
Point found: true
record found: true, prints RPoint[x=1, y=2]`,
        explain: `- \`HashSet.contains\` hashes first. \`BadPoint\` inherits identity-based \`hashCode\`, so the two equal points land in different buckets and \`equals\` is never even called.
- \`o instanceof Point p\` is **pattern matching** (Java 16+): test and cast in one step.
- \`Objects.hash(x, y)\` combines fields. Use the same fields in \`equals\` and \`hashCode\`.
- Records generate both methods correctly. Prefer them for value types.`,
      },
      {
        title: "Records with validation, and enums with behavior",
        variants: [
          {
            lang: "java",
            code: `import java.util.Arrays;
import java.util.List;

public class RecordsAndEnums {
    record Money(long cents, String currency) {
        Money {                                       // compact constructor
            if (cents < 0) throw new IllegalArgumentException("negative amount");
            currency = currency.toUpperCase();        // normalize before fields are set
        }

        Money plus(Money other) {
            if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
            return new Money(cents + other.cents, currency);   // immutable: return a new one
        }

        @Override
        public String toString() { return "%s %d.%02d".formatted(currency, cents / 100, cents % 100); }
    }

    enum Plan {
        FREE(0, 1), PRO(1200, 5), TEAM(4900, 50);

        private final int priceCents;
        private final int seats;

        Plan(int priceCents, int seats) {
            this.priceCents = priceCents;
            this.seats = seats;
        }

        boolean fits(int users) { return users <= seats; }

        Plan upgrade() { return this == TEAM ? TEAM : values()[ordinal() + 1]; }
    }

    public static void main(String[] args) {
        Money a = new Money(1050, "usd");
        Money b = new Money(275, "USD");
        System.out.println(a + " + " + b + " = " + a.plus(b));
        System.out.println("equal? " + a.equals(new Money(1050, "USD")));

        for (Plan p : Plan.values())
            System.out.println(p + " $" + p.priceCents / 100 + " seats=" + p.seats + " fits 3: " + p.fits(3) + " -> upgrade " + p.upgrade());
        System.out.println("PRO ordinal = " + Plan.valueOf("PRO").ordinal());
        List<Plan> paid = Arrays.stream(Plan.values()).filter(p -> p.priceCents > 0).toList();
        System.out.println("paid plans = " + paid);
    }
}`,
          },
        ],
        output: `USD 10.50 + USD 2.75 = USD 13.25
equal? true
FREE $0 seats=1 fits 3: false -> upgrade PRO
PRO $12 seats=5 fits 3: true -> upgrade TEAM
TEAM $49 seats=50 fits 3: true -> upgrade TEAM
PRO ordinal = 1
paid plans = [PRO, TEAM]`,
        explain: `- The compact constructor runs before the fields are assigned, so \`currency = currency.toUpperCase()\` changes what gets stored. That's why \`"usd"\` equals \`"USD"\` later.
- \`plus\` never mutates: it returns a new \`Money\`. Immutable values are safe to share.
- Each enum constant calls the constructor once, when the enum class loads.
- Careful with \`ordinal()\`: it changes if you reorder constants. Never persist it; store \`name()\` instead.`,
      },
    ],
    interview: [
      {
        q: "What is the equals/hashCode contract and what happens if you break it?",
        a: "If `a.equals(b)` then `a.hashCode() == b.hashCode()` must hold (the reverse isn't required: collisions are allowed). `equals` must also be reflexive, symmetric, transitive, consistent, and false for null. Hash-based collections (`HashMap`, `HashSet`) locate the bucket by `hashCode` and only then call `equals`. Override `equals` without `hashCode` and two equal keys land in different buckets: lookups miss, sets hold duplicates. Also never use mutable fields in the hash of an object stored in a hash collection; mutate it and it's lost in the wrong bucket.",
        freq: "very-common",
      },
      {
        q: "What are records and when would you use them?",
        a: "Records (Java 16) are transparent, immutable data carriers: `record Point(int x, int y)` generates private final fields, a canonical constructor, accessors, and value-based `equals`/`hashCode`/`toString`. Use them for DTOs, API request/response bodies, events, map keys and value objects. Limits: they can't extend a class (they implicitly extend `java.lang.Record`), all fields are final, and fields are exactly the components. Validation goes in a compact constructor. They pair well with sealed interfaces and pattern matching.",
        freq: "very-common",
      },
      {
        q: "How do you make a class immutable?",
        a: "Make the class `final` (or the constructor private with factories) so subclasses can't add mutability; make every field `private final`; don't provide setters; **defensively copy** mutable inputs in the constructor and mutable outputs in getters (`List.copyOf`); and don't leak `this` during construction. Benefits: thread safety without locks, safe sharing and caching, safe use as map keys. `String`, `Integer`, `LocalDate` and records are immutable.",
        freq: "common",
      },
      {
        q: "What does `static` mean on a field, a method and a nested class?",
        a: "A static **field** has one copy per class, shared by all instances. A static **method** runs without an instance, so it can't use `this` or instance fields. A static **nested class** doesn't hold a reference to an outer instance (unlike an inner class, which does and can leak it); prefer static nested classes unless you need the outer instance. Static state is effectively global: it complicates testing and needs synchronization when mutable.",
        freq: "common",
      },
      {
        q: "Why are enums a good way to implement a singleton?",
        a: "`enum Registry { INSTANCE; ... }` is created exactly once by the class loader (thread-safe lazy initialization for free), can't be instantiated by reflection, and serialization preserves the single instance automatically. Hand-written singletons need double-checked locking with `volatile` or the holder idiom, plus `readResolve` for serialization. In application code, dependency injection (one bean per container) has mostly replaced singletons.",
      },
    ],
    quiz: [
      {
        q: "You override equals() in a class but not hashCode(). What breaks?",
        options: ["Nothing", "Printing the object", "HashMap/HashSet lookups with equal keys", "The constructor"],
        answer: 2,
        explain: "Hash-based collections use hashCode to pick a bucket. Equal objects with different hashes are never compared.",
      },
      {
        q: "Which statement about records is FALSE?",
        options: ["Their fields are final", "They generate equals and hashCode", "They can extend another class", "They can implement interfaces"],
        answer: 2,
        explain: "Records implicitly extend java.lang.Record and can't extend anything else.",
      },
      {
        q: "What can a static method NOT do?",
        options: ["Call other static methods", "Use `this` or instance fields directly", "Take parameters", "Return a value"],
        answer: 1,
        explain: "There's no instance when a static method runs, so there's no `this`.",
      },
      {
        q: "Which access modifier lets other classes in the same package, but not subclasses elsewhere, see a member?",
        options: ["private", "package-private (no modifier)", "protected", "public"],
        answer: 1,
        explain: "No modifier means package-private. protected additionally allows subclasses in other packages.",
      },
      {
        q: "Why is persisting `enum.ordinal()` to a database a bad idea?",
        options: ["It's slow", "Ordinals change if constants are reordered or inserted", "Ordinals are random", "It's not serializable"],
        answer: 1,
        explain: "Store name() (or an explicit code field) so reordering the enum doesn't corrupt data.",
      },
    ],
  },
];
