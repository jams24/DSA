import type { Lesson } from "../types";

// Go track, part 1: Foundations.

export const goFoundations: Lesson[] = [
  // ------------------------------------------------------------------ GETTING STARTED
  {
    id: "go-start",
    stage: "Foundations",
    title: "Getting started: how Go code becomes a program",
    tagline: "Install Go, write and run your first program, and understand modules, packages, the go command and the single static binary it produces.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "From source code to a running Go binary",
      nodes: [
        { id: "src", label: "Your code", kind: "client", x: 100, y: 270, sub: "package main + your packages" },
        { id: "mod", label: "go.mod / go.sum", kind: "registry", x: 260, y: 110, sub: "dependencies + checksums" },
        { id: "proxy", label: "Module proxy", kind: "external", x: 480, y: 70, sub: "proxy.golang.org + sum.golang.org" },
        { id: "cache", label: "Module cache", kind: "storage", x: 700, y: 110, sub: "~/go/pkg/mod" },
        { id: "compiler", label: "Compiler", kind: "service", x: 400, y: 300, sub: "parse, type-check, optimize" },
        { id: "linker", label: "Linker", kind: "worker", x: 620, y: 300, sub: "your code + deps + runtime" },
        { id: "binary", label: "Static binary", kind: "node", x: 820, y: 300, sub: "one file, no VM needed" },
        { id: "os", label: "OS + CPU", kind: "control", x: 820, y: 480, sub: "runtime: scheduler + GC" },
      ],
      edges: [
        { from: "src", to: "mod", label: "imports" },
        { from: "mod", to: "proxy", label: "download" },
        { from: "proxy", to: "cache" },
        { from: "cache", to: "compiler", label: "dependency source" },
        { from: "src", to: "compiler" },
        { from: "compiler", to: "linker", label: "object files" },
        { from: "linker", to: "binary" },
        { from: "binary", to: "os", label: "exec" },
      ],
      flows: [
        {
          name: "go run .",
          path: ["src", "compiler", "linker", "binary", "os"],
          steps: [
            "go run compiles every package in your module that main imports. The compiler is fast: it parses, type-checks and optimizes each package once and caches the result.",
            "The linker combines your packages, standard library packages and the Go runtime (scheduler, garbage collector, memory allocator) into one executable.",
            "The result is a single, statically linked binary. go run puts it in a temporary directory; go build writes it next to you.",
            "The OS runs it like any native program: no interpreter, no virtual machine. The runtime inside starts goroutines and the GC.",
          ],
        },
        {
          name: "Adding a dependency",
          path: ["src", "mod", "proxy", "cache", "compiler", "linker", "binary"],
          steps: [
            "You import github.com/go-chi/chi/v5 in a file. go get (or go mod tidy) records the module and its version in go.mod.",
            "The go command downloads the module from the module proxy and checks its hash against the public checksum database.",
            "The module is stored read-only in the module cache, and its hash is recorded in go.sum so every future build verifies it.",
            "The compiler reads the dependency's source from the cache. Go always builds dependencies from source.",
            "The linker includes only the packages you actually use.",
            "Still one binary: deploying means copying one file.",
          ],
        },
        {
          name: "Cross-compiling for Linux on ARM",
          path: ["src", "compiler", "linker", "binary"],
          steps: [
            "GOOS=linux GOARCH=arm64 go build tells the toolchain to target another platform. No extra compiler is needed.",
            "The compiler emits ARM64 code; the linker uses the Linux versions of the runtime and standard library.",
            "You get a Linux binary from your Mac or Windows machine, ready for a Raspberry Pi, an ARM cloud server or a tiny container image.",
          ],
        },
      ],
    },
    concept: `
## Why Go?
Go was designed at Google (2009) for large teams building servers. Its goals: **fast builds**, **simple language** (25 keywords; easy to read anyone's code), **built-in concurrency** (goroutines and channels), and **easy deployment** (one static binary). It powers Docker, Kubernetes, Terraform, Prometheus, etcd, CockroachDB, Caddy and most cloud-native infrastructure, plus countless backend APIs.

## Install and check
Download from go.dev/dl or use a package manager (\`brew install go\`, \`winget install GoLang.Go\`). Then:
\`\`\`bash
go version          # go version go1.24.x ...
go env GOPATH       # where the module cache lives (~/go)
\`\`\`
Editor: VS Code with the official Go extension, or GoLand. Both use **gopls**, the Go language server.

## Modules and packages
- A **package** is a directory of \`.go\` files that share a \`package name\` line. \`package main\` with a \`func main()\` builds an executable.
- A **module** is a tree of packages with a \`go.mod\` file at its root, declaring the module path (e.g. \`github.com/you/app\`), the Go version, and dependencies.
- Import packages by path: \`import "github.com/you/app/internal/store"\`. Packages under \`internal/\` can only be imported by code in the same module.
- **Exported** names start with an **uppercase letter** (\`store.New\`); lowercase names are private to the package. No \`public\`/\`private\` keywords.

## The go command does everything
| Command | Does |
|---|---|
| \`go mod init github.com/you/app\` | Start a module |
| \`go run .\` | Compile and run |
| \`go build\` / \`go install\` | Build a binary / build and install it to ~/go/bin |
| \`go test ./...\` | Run all tests (the testing framework is built in) |
| \`go fmt ./...\` (gofmt) | Format code: **one official style**, no debates |
| \`go vet ./...\` | Catch suspicious code (wrong Printf verbs, copied locks...) |
| \`go get pkg@version\` / \`go mod tidy\` | Add / sync dependencies |
| \`go doc fmt.Println\` | Read documentation |

## What makes Go different
- **No classes, no inheritance**: structs, methods and interfaces, with composition by embedding.
- **Errors are values**: functions return \`(result, error)\`; no exceptions.
- **Garbage collected**, with pointers but no pointer arithmetic.
- **Concurrency is built in**: \`go f()\` starts a goroutine; channels connect them.
- **Fast compilation** and a rich standard library: an HTTP server, JSON, crypto and testing come in the box.
`,
    keyPoints: [
      "Go compiles to one static binary that includes its runtime",
      "A module (go.mod) contains packages; package main + func main() is a program",
      "Uppercase names are exported, lowercase are package-private",
      "go run, build, test, fmt, vet and mod cover the whole workflow",
      "Dependencies are versioned in go.mod and verified by go.sum",
      "Cross-compile with GOOS and GOARCH",
    ],
    code: [
      {
        title: "Hello, Go",
        variants: [
          {
            lang: "go",
            code: `package main // an executable program lives in package main

import (
    "fmt"
    "os"
    "strings"
)

func main() { // execution starts here
    fmt.Println("Hello, Go!")

    name := "gopher" // := declares a variable and infers its type (string)
    fmt.Printf("Hello, %s! Your name has %d letters.\\n", name, len(name))
    fmt.Println(strings.ToUpper(name), strings.Repeat("go", 3))

    if len(os.Args) > 1 { // os.Args[0] is the program itself
        fmt.Println("arguments:", os.Args[1:])
    } else {
        fmt.Println("no arguments: try go run . alice bob")
    }
}`,
          },
        ],
        output: `Hello, Go!
Hello, gopher! Your name has 6 letters.
GOPHER gogogo
no arguments: try go run . alice bob`,
        explain: `- Save it as \`main.go\` in a folder, run \`go mod init hello\` once, then \`go run .\`.
- \`fmt.Println\` prints its arguments separated by spaces; \`fmt.Printf\` uses verbs: \`%s\` string, \`%d\` integer, \`%v\` any value, \`%q\` quoted, \`%T\` type.
- Unused imports and unused local variables are **compile errors** in Go. It keeps code clean (and \`gopls\` adds or removes imports for you on save).
- Braces are mandatory, and the opening brace must be on the same line: \`gofmt\` enforces one style for everyone.`,
      },
      {
        title: "A real project layout",
        noCheck: "a multi-file module; build it with go build ./...",
        variants: [
          {
            lang: "text",
            code: `hello/
├── go.mod                    module github.com/you/hello
├── cmd/
│   └── hello/
│       └── main.go           package main: wiring, flags, startup
└── internal/
    └── greet/
        ├── greet.go          package greet: the logic
        └── greet_test.go     tests live next to the code`,
          },
          {
            lang: "go",
            code: `// internal/greet/greet.go
package greet

import "fmt"

// Hello returns a greeting. It's exported (uppercase), so other packages can call it.
func Hello(name string) string {
    if name == "" {
        name = defaultName
    }
    return fmt.Sprintf("Hello, %s!", name)
}

const defaultName = "world" // unexported: only visible inside package greet`,
          },
          {
            lang: "go",
            code: `// cmd/hello/main.go
package main

import (
    "fmt"
    "os"

    "github.com/you/hello/internal/greet" // module path + directory
)

func main() {
    name := ""
    if len(os.Args) > 1 {
        name = os.Args[1]
    }
    fmt.Println(greet.Hello(name))
}`,
          },
        ],
        explain: `- \`cmd/<name>/\` holds each executable; \`internal/\` holds packages no other module may import. Small programs can just keep \`main.go\` at the root.
- Build and run with \`go run ./cmd/hello Ada\`, install with \`go install ./cmd/hello\`.
- A package name is the last element of its import path, used as the prefix: \`greet.Hello\`.`,
      },
      {
        title: "The everyday commands",
        variants: [
          {
            lang: "bash",
            code: `go mod init github.com/you/hello     # create go.mod
go run ./cmd/hello Ada                # compile + run
go build -o bin/hello ./cmd/hello     # build a binary
go test ./...                         # run every test in the module
go test -race ./...                   # ...with the data race detector
go vet ./...                          # static checks
gofmt -l . && go fmt ./...            # list unformatted files, then format
go get github.com/go-chi/chi/v5@latest  # add a dependency
go mod tidy                           # add missing / remove unused requirements

GOOS=linux GOARCH=amd64 go build -o bin/hello-linux ./cmd/hello   # cross-compile
CGO_ENABLED=0 go build -ldflags="-s -w" ./cmd/hello               # fully static, smaller binary
go doc strings.Fields                 # documentation in the terminal`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "What are Go's main design goals and trade-offs?",
        a: "Simplicity and readability at scale (small language, one formatting style, explicit error handling), fast compilation, efficient concurrency (cheap goroutines scheduled by the runtime, channels), and simple deployment (statically linked binaries, easy cross-compilation), with garbage collection for safety. Trade-offs: less expressive than Rust/Scala/Java (no inheritance, generics only since 1.18 and deliberately limited, no exceptions or sum types), verbose error handling, and a GC that adds some latency and memory overhead compared to C++/Rust.",
        freq: "common",
      },
      {
        q: "What's the difference between a package and a module?",
        a: "A package is a directory of .go files compiled together, sharing a namespace (package name); it's the unit of encapsulation (exported = uppercase). A module is a collection of packages released and versioned together, defined by go.mod at its root, with a module path that prefixes its packages' import paths and a list of required dependency versions. go.sum records cryptographic hashes of dependencies for reproducible, verified builds.",
        freq: "common",
      },
      {
        q: "How does Go decide what's exported?",
        a: "By capitalization: identifiers (functions, types, struct fields, methods, constants, variables) starting with an uppercase letter are exported from their package; lowercase ones are package-private. This also matters for encoding/json, which only (un)marshals exported struct fields. The internal/ directory convention adds module-level privacy: packages under internal/ can only be imported by code rooted at internal's parent.",
      },
    ],
    quiz: [
      {
        q: "What makes a Go program executable?",
        options: ["A class with a main method", "package main with a func main()", "A Makefile", "An init() function"],
        answer: 1,
        explain: "go build produces a binary for package main.",
      },
      {
        q: "Which identifier can another package use?",
        options: ["total", "_total", "Total", "total_"],
        answer: 2,
        explain: "Uppercase first letter = exported.",
      },
      {
        q: "What does a Go binary need installed on the target machine to run?",
        options: ["The Go toolchain", "A JVM", "Usually nothing: it's statically linked with its runtime", "Python"],
        answer: 2,
        explain: "That's why Go containers can be tiny.",
      },
      {
        q: "What happens if you import a package and never use it?",
        options: ["A warning", "Compile error", "It's removed silently", "Runtime panic"],
        answer: 1,
        explain: "Unused imports and local variables are errors in Go.",
      },
      {
        q: "Which file records dependency checksums?",
        options: ["go.mod", "go.sum", "go.lock", "vendor.json"],
        answer: 1,
        explain: "go.mod lists versions; go.sum verifies their content.",
      },
    ],
  },

  // ------------------------------------------------------------------ BASICS
  {
    id: "go-basics",
    stage: "Foundations",
    title: "Variables, types, control flow and functions",
    tagline: "Zero values, constants and iota, the one loop Go has, switch, functions with multiple returns, closures, defer, and strings, bytes and runes.",
    difficulty: "beginner",
    minutes: 35,
    concept: `
## Variables and zero values
\`\`\`go
var count int           // declared with its zero value: 0
var name = "Ada"        // type inferred: string
age := 36               // short declaration (inside functions): the most common form
a, b := 1, "two"        // several at once
\`\`\`
Every type has a **zero value**, used whenever you don't initialize: \`0\` for numbers, \`""\` for strings, \`false\` for bools, \`nil\` for pointers, slices, maps, channels, functions and interfaces. There's no "uninitialized" memory in Go. Good Go types make their zero value useful (\`var mu sync.Mutex\` and \`var sb strings.Builder\` are ready to use).

## Basic types
| Kind | Types |
|---|---|
| Integers | \`int\` (64-bit on 64-bit platforms), \`int8\`...\`int64\`, \`uint\`, \`uint8\` (= \`byte\`)...\`uint64\` |
| Floats | \`float64\` (default), \`float32\` |
| Text | \`string\` (immutable UTF-8 bytes), \`rune\` (= \`int32\`, a Unicode code point), \`byte\` |
| Other | \`bool\`, \`complex128\` |

**No implicit conversions**, not even \`int\` to \`int64\` or \`int\` to \`float64\`: write \`float64(n)\`. That's a whole class of bugs gone.

## Constants and iota
\`const Pi = 3.14159\` is an **untyped constant**: exact, and it adapts to where it's used. \`iota\` counts up inside a \`const\` block, which is how Go makes enums:
\`\`\`go
type Weekday int
const (
    Sunday Weekday = iota   // 0
    Monday                  // 1
    Tuesday                 // 2
)
\`\`\`

## Control flow
- **\`for\` is the only loop**: \`for i := 0; i < n; i++\`, \`for cond\` (a while loop), \`for\` (forever), \`for i, v := range slice\`, \`for i := range 10\` (Go 1.22+).
- **\`if\` with a short statement**: \`if v, err := parse(s); err == nil { ... }\`: \`v\` and \`err\` exist only inside the if/else.
- **\`switch\`** needs no \`break\` (cases don't fall through), can match several values (\`case "sat", "sun":\`), and \`switch { case x < 0: ... }\` replaces if/else chains.
- Labels with \`break outer\` / \`continue outer\` exit nested loops.

## Functions
- **Multiple return values**: \`func divide(a, b float64) (float64, error)\`. The idiom for errors (next chapters).
- **Named results** document what's returned and allow a bare \`return\`. Use them sparingly.
- **Variadic**: \`func sum(nums ...int)\`; call with \`sum(1, 2, 3)\` or \`sum(slice...)\`.
- Functions are values: assign them, pass them, return them. **Closures** capture variables from the surrounding scope.
- **\`defer f()\`** runs \`f\` when the surrounding function returns (in LIFO order), even on panic. Used for cleanup: \`defer file.Close()\`, \`defer mu.Unlock()\`.

## Strings, bytes and runes
A \`string\` is a read-only sequence of **bytes**, usually UTF-8. \`len(s)\` counts bytes, \`s[i]\` is a byte, and \`for i, r := range s\` decodes **runes** (characters). Build strings efficiently with \`strings.Builder\`; convert numbers with \`strconv\`.
`,
    keyPoints: [
      "Every type has a zero value: 0, \"\", false or nil",
      ":= declares and infers inside functions; var works everywhere",
      "No implicit numeric conversions: write float64(n)",
      "iota builds enum-like constant sequences",
      "for is the only loop; range iterates slices, maps, strings, channels and ints",
      "Functions return multiple values; (result, error) is the idiom",
      "defer runs cleanup when the function returns, in LIFO order",
      "len(string) counts bytes; range over a string yields runes",
    ],
    code: [
      {
        title: "Variables, zero values, constants and conversions",
        variants: [
          {
            lang: "go",
            code: `package main

import "fmt"

const Pi = 3.14159 // untyped constant: adapts to the context

type Weekday int

const (
    Sunday Weekday = iota // 0, then each line adds 1
    Monday
    Tuesday
)

func main() {
    var count int // every variable starts at its zero value
    var name string
    var ready bool
    var ratio float64
    var scores []int
    fmt.Printf("zero values: %d %q %t %v %v (nil: %t)\\n", count, name, ready, ratio, scores, scores == nil)

    age := 36 // short declaration: type inferred
    height, unit := 1.65, "m"
    fmt.Println(age, height, unit)
    fmt.Printf("types: %T %T %T\\n", age, height, Pi)

    var big int64 = 1 << 40
    small := int32(big >> 30) // explicit conversion: Go never converts numbers implicitly
    average := float64(age) / 2
    fmt.Println(big, small, average)

    fmt.Println("integer division:", 7/2, "float division:", 7.0/2, "remainder:", 7%3)
    var b uint8 = 255
    b++ // unsigned integers wrap around
    fmt.Println("uint8 255 + 1 =", b)
    fmt.Println("Monday =", Monday, "Tuesday =", Tuesday)
}`,
          },
        ],
        output: `zero values: 0 "" false 0 [] (nil: true)
36 1.65 m
types: int float64 float64
1099511627776 1024 18
integer division: 3 float division: 3.5 remainder: 1
uint8 255 + 1 = 0
Monday = 1 Tuesday = 2`,
        explain: `- A \`nil\` slice prints as \`[]\` and is ready to use: \`append\` works on it.
- \`Pi\` has no fixed type until it's used; \`%T\` reports its default type, \`float64\`.
- Writing \`float64(age) / 2\` is required: \`age / 2.0\` with an \`int\` variable is a compile error.
- Constants created with \`iota\` get the custom type \`Weekday\`, so you can add methods to it (a \`String()\` method makes them print as names).`,
      },
      {
        title: "Control flow: for, if, switch and labels",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "strconv"
)

func classify(n int) string {
    switch { // a switch with no value replaces an if/else chain
    case n < 0:
        return "negative"
    case n == 0:
        return "zero"
    case n%2 == 0:
        return "even"
    default:
        return "odd"
    }
}

func main() {
    for i := 0; i < 3; i++ { // the classic three-part loop
        fmt.Print(i, " ")
    }
    fmt.Println()

    n := 1
    for n < 100 { // a "while" loop
        n *= 3
    }
    fmt.Println("first power of 3 >= 100:", n)

    for i := range 3 { // Go 1.22+: range over an integer
        fmt.Print("tick", i, " ")
    }
    fmt.Println()

    if v, err := strconv.Atoi("42"); err == nil { // v and err exist only in this if/else
        fmt.Println("parsed", v)
    }

    switch day := "sat"; day {
    case "sat", "sun": // several values; no fallthrough, no break needed
        fmt.Println(day, "is the weekend")
    default:
        fmt.Println(day, "is a weekday")
    }

    fmt.Println(classify(-3), classify(0), classify(4), classify(7))

    grid := [][]int{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}
outer:
    for r, row := range grid {
        for c, v := range row {
            if v == 5 {
                fmt.Printf("found 5 at row %d, col %d\\n", r, c)
                break outer // leaves both loops
            }
        }
    }
}`,
          },
        ],
        output: `0 1 2
first power of 3 >= 100: 243
tick0 tick1 tick2
parsed 42
sat is the weekend
negative zero even odd
found 5 at row 1, col 1`,
        explain: `- \`fmt.Print("tick", i)\` adds spaces only between operands when neither is a string, which is why it prints \`tick0\`.
- Go's \`switch\` evaluates cases top to bottom and stops at the first match. Use the \`fallthrough\` keyword in the rare case you want C behavior.
- Labels (\`outer:\`) name a loop so \`break\` or \`continue\` can target it.`,
      },
      {
        title: "Functions: multiple results, variadics, closures and defer",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
)

func divide(a, b float64) (float64, error) { // two results: the value and an error
    if b == 0 {
        return 0, errors.New("division by zero")
    }
    return a / b, nil
}

func stats(nums ...int) (lo, hi int, avg float64) { // variadic input, named results
    if len(nums) == 0 {
        return // returns the zero values: 0, 0, 0
    }
    lo, hi = nums[0], nums[0]
    sum := 0
    for _, n := range nums {
        lo = min(lo, n) // min and max are built in since Go 1.21
        hi = max(hi, n)
        sum += n
    }
    return lo, hi, float64(sum) / float64(len(nums))
}

func counter() func() int { // returns a closure
    count := 0 // captured: lives on as long as the closure does
    return func() int {
        count++
        return count
    }
}

func trace(name string) func() {
    fmt.Println("enter", name)
    return func() { fmt.Println("exit", name) }
}

func work() {
    defer trace("work")() // trace runs now; the function it returns runs when work returns
    fmt.Println("  working...")
}

func main() {
    if q, err := divide(10, 4); err == nil {
        fmt.Println("10 / 4 =", q)
    }
    if _, err := divide(1, 0); err != nil {
        fmt.Println("error:", err)
    }

    lo, hi, avg := stats(4, 8, 15, 16, 23, 42)
    fmt.Println("min", lo, "max", hi, "avg", avg)
    nums := []int{3, 1, 2}
    _, top, _ := stats(nums...) // spread a slice; _ discards values
    fmt.Println("max of slice:", top)

    next := counter()
    fmt.Println(next(), next(), next())

    work()

    fmt.Print("deferred calls run last-in, first-out:")
    func() {
        for i := range 3 {
            defer fmt.Print(" ", i)
        }
    }()
    fmt.Println()
}`,
          },
        ],
        output: `10 / 4 = 2.5
error: division by zero
min 4 max 42 avg 18
max of slice: 3
1 2 3
enter work
  working...
exit work
deferred calls run last-in, first-out: 2 1 0`,
        explain: `- \`(value, error)\` returns are how Go reports failure: check \`err != nil\` right away. More in the errors chapter.
- \`_\` (the blank identifier) discards a value you don't need. Go won't let you ignore a declared variable otherwise.
- The closure returned by \`counter\` keeps its own \`count\`. Each call to \`counter()\` creates a new one.
- \`defer\` evaluates the function and its arguments **immediately** but runs the call at return time. That's why \`defer trace("work")()\` prints "enter" first, and why deferred calls in a loop run in reverse.`,
      },
      {
        title: "Strings, bytes and runes",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "strconv"
    "strings"
    "unicode/utf8"
)

func main() {
    s := "héllo, 世界"
    fmt.Println("bytes:", len(s), "characters:", utf8.RuneCountInString(s))
    fmt.Println("s[0] =", s[0], string(s[0]), "| s[1] =", s[1], "(the first byte of é)")

    for i, r := range s { // range decodes UTF-8: i is the byte offset, r the rune
        if r > 127 {
            fmt.Printf("%c at byte %d (U+%04X, %d bytes)\\n", r, i, r, utf8.RuneLen(r))
        }
    }

    runes := []rune(s) // convert to index by character
    fmt.Println("third character:", string(runes[2]), "| reversed:", reverse("abc"))

    fmt.Println(strings.Fields("  split   on spaces "), strings.Split("a,b,c", ","))
    fmt.Println(strings.Contains(s, "世"), strings.HasPrefix(s, "hé"), strings.Index(s, "l"), strings.ReplaceAll("a-b-c", "-", "+"))
    fmt.Println(strings.Join([]string{"x", "y", "z"}, " | "), strings.TrimSpace("  padded  ")+"!")

    var sb strings.Builder // efficient concatenation; the zero value is ready to use
    for i := range 3 {
        fmt.Fprintf(&sb, "[%d]", i)
    }
    fmt.Println(sb.String())

    n, err := strconv.Atoi("123")
    f, _ := strconv.ParseFloat("2.5", 64)
    _, bad := strconv.Atoi("12a")
    fmt.Println(n+1, f*2, err, bad)
    fmt.Println(strconv.Itoa(42)+"!", strconv.Quote("tab\\there"), fmt.Sprintf("%05.1f|%-6s|%x", 3.14159, "go", 255))

    b := []byte("hello") // strings are immutable; byte slices are not
    b[0] = 'H'
    fmt.Println(string(b))
}

func reverse(s string) string {
    r := []rune(s)
    for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
        r[i], r[j] = r[j], r[i] // parallel assignment swaps without a temp
    }
    return string(r)
}`,
          },
        ],
        output: `bytes: 14 characters: 9
s[0] = 104 h | s[1] = 195 (the first byte of é)
é at byte 1 (U+00E9, 2 bytes)
世 at byte 8 (U+4E16, 3 bytes)
界 at byte 11 (U+754C, 3 bytes)
third character: l | reversed: cba
[split on spaces] [a b c]
true true 3 a+b+c
x | y | z padded!
[0][1][2]
124 5 <nil> strconv.Atoi: parsing "12a": invalid syntax
42! "tab\\there" 003.1|go    |ff
Hello`,
        explain: `- \`é\` takes 2 bytes and each Chinese character 3, so 9 characters occupy 14 bytes. Indexing a string gives bytes; \`range\` and \`[]rune\` give characters.
- \`strings.Index\` returns a **byte** offset (3, because é is 2 bytes).
- Errors are ordinary values you can print: \`strconv.Atoi\` explains exactly what failed.
- \`%05.1f\` pads with zeros to width 5 with 1 decimal, \`%-6s\` left-aligns in 6 columns, \`%x\` prints hexadecimal.`,
      },
    ],
    interview: [
      {
        q: "What are zero values and why do they matter?",
        a: "Every variable in Go is initialized to its type's zero value if not explicitly set: 0, 0.0, \"\", false, nil for pointers/slices/maps/channels/functions/interfaces, and recursively zeroed structs. There's no uninitialized memory. Idiomatic Go designs types whose zero value is useful (sync.Mutex, bytes.Buffer, strings.Builder, a nil slice you can append to), which removes the need for constructors in many cases. Gotcha: a nil map can be read but writing to it panics.",
        freq: "common",
      },
      {
        q: "How does defer work? What are its evaluation rules?",
        a: "defer schedules a function call to run when the surrounding function returns, whether normally or by panic. Deferred calls run in LIFO order. The function value and its arguments are evaluated when the defer statement executes, not when the call runs, so `defer fmt.Println(i)` captures the current i. Deferred closures can read and modify named result parameters (used to wrap errors or recover from panics). Typical uses: closing files, unlocking mutexes, ending trace spans.",
        freq: "very-common",
      },
      {
        q: "What's the difference between a byte and a rune? What does len(s) return?",
        a: "A byte (uint8) is one byte of data; a rune (int32) is a Unicode code point. Strings are immutable byte sequences, conventionally UTF-8, so len(s) returns the number of bytes, not characters, and s[i] is a byte. Ranging over a string decodes UTF-8 and yields (byte offset, rune) pairs; utf8.RuneCountInString counts characters; []rune(s) converts for character indexing (allocating).",
        freq: "common",
      },
      {
        q: "Why doesn't Go have implicit numeric conversions or a ternary operator?",
        a: "Both are deliberate simplicity choices. Implicit conversions (int to float, int32 to int64, signed to unsigned) cause subtle bugs like overflow, precision loss and sign errors, so Go requires explicit conversions everywhere. The ternary operator is omitted because nested ternaries hurt readability; Go prefers a plain if/else. Untyped constants make the explicit-conversion rule painless for literals.",
      },
    ],
    quiz: [
      {
        q: "What's the zero value of a string?",
        options: ["nil", "\"\" (empty string)", "\" \"", "undefined"],
        answer: 1,
        explain: "Strings can't be nil in Go.",
      },
      {
        q: "How many loop keywords does Go have?",
        options: ["One: for", "Two: for and while", "Three", "None"],
        answer: 0,
        explain: "for covers counting, while-style and infinite loops, and range.",
      },
      {
        q: "`for i := range 3 { defer fmt.Print(i) }` prints...",
        options: ["012", "210", "333", "Nothing"],
        answer: 1,
        explain: "Arguments are evaluated at defer time; calls run in LIFO order.",
      },
      {
        q: "len(\"世界\") is...",
        options: ["2", "4", "6", "1"],
        answer: 2,
        explain: "Each of these characters is 3 bytes in UTF-8.",
      },
      {
        q: "`var x int = 5; var y float64 = x` does what?",
        options: ["y is 5.0", "Compile error: no implicit conversion", "y is 0", "Runtime panic"],
        answer: 1,
        explain: "Write float64(x).",
      },
      {
        q: "In `switch`, what happens after a case matches?",
        options: ["It falls through to the next case", "The switch ends (no break needed)", "It re-evaluates", "It panics"],
        answer: 1,
        explain: "Use the fallthrough keyword explicitly if needed.",
      },
    ],
  },

  // ------------------------------------------------------------------ SLICES & MAPS
  {
    id: "go-collections",
    stage: "Foundations",
    title: "Arrays, slices and maps",
    tagline: "How slices really work (pointer, length, capacity), append and the shared-array trap, maps with comma-ok, and the slices and maps packages.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["goslice"],
    concept: `
## Arrays: fixed size, value semantics
\`[5]int\` is an array of exactly 5 ints; the size is part of the type. Arrays are **values**: assigning or passing one copies all elements. You'll rarely use them directly; they're the storage under slices.

## Slices: the workhorse
A slice is a small **header** of three fields: a **pointer** to an underlying array, a **length** (elements you can access) and a **capacity** (space available from the pointer to the end of the array).
\`\`\`go
s := []int{1, 2, 3}          // a slice literal (allocates the array for you)
s = make([]int, 0, 100)      // length 0, capacity 100: preallocated
t := s[1:3]                  // a new header viewing the same array: no copy
\`\`\`
- **\`append(s, x)\`** writes into spare capacity if there is any. Otherwise it allocates a bigger array (about 2x for small slices), copies, and returns a header pointing there. **Always use the result**: \`s = append(s, x)\`.
- Because slices can share an array, **writing through one slice is visible through another**, and two \`append\`s on the same base can overwrite each other. Watch it happen in the visualizer. Use \`slices.Clone\` or the full slice expression \`s[a:b:b]\` (which caps the capacity) to avoid surprises.
- A **nil slice** (\`var s []int\`) has length 0 and works with \`len\`, \`range\` and \`append\`. Prefer it to \`[]int{}\` unless you need JSON \`[]\` instead of \`null\`.
- Passing a slice to a function copies the header, not the elements: the function can modify elements, but its own \`append\` may not be visible to the caller.

## Maps
\`\`\`go
ages := map[string]int{"ada": 36}
ages["grace"] = 85                 // insert or update
age, ok := ages["linus"]           // comma-ok: 0, false when missing
delete(ages, "ada")
\`\`\`
- Maps are hash tables: O(1) average get, set and delete.
- Reading a missing key returns the **zero value**, which makes counting easy (\`counts[w]++\`). Use comma-ok to tell "missing" from "zero".
- **Iteration order is random** on purpose. Sort the keys when order matters.
- A nil map can be read but **writing panics**: create maps with \`make\` or a literal.
- Maps are **not safe for concurrent writes**: use a \`sync.Mutex\` (or \`sync.Map\` for special cases).
- A set is \`map[T]struct{}\` (an empty struct takes no memory) or \`map[T]bool\`.

## The slices and maps packages (Go 1.21+)
\`slices.Sort\`, \`slices.SortFunc\`, \`slices.Contains\`, \`slices.Index\`, \`slices.Max\`, \`slices.Reverse\`, \`slices.BinarySearch\`, \`slices.Equal\`, \`slices.Clone\`, \`slices.Compact\`; and with Go 1.23 iterators: \`slices.Sorted(maps.Keys(m))\`, \`slices.Collect\`.
`,
    keyPoints: [
      "Arrays have a fixed size and are copied by value",
      "A slice is a header: pointer + length + capacity over an array",
      "Always assign append's result: s = append(s, x)",
      "Slices can share a backing array: writes and appends can affect each other",
      "make([]T, 0, n) preallocates; s[a:b:b] limits capacity",
      "Missing map keys give the zero value; use v, ok := m[k] to check",
      "Map iteration order is random; writing to a nil map panics",
      "Maps aren't safe for concurrent writes",
    ],
    complexity: [
      { op: "slice index / len / cap", time: "O(1)" },
      { op: "append", time: "amortized O(1)", note: "O(n) when it reallocates" },
      { op: "insert/delete in the middle (slices.Insert/Delete)", time: "O(n)" },
      { op: "slices.Sort", time: "O(n log n)" },
      { op: "slices.BinarySearch on sorted data", time: "O(log n)" },
      { op: "map get / set / delete", time: "O(1) average" },
    ],
    code: [
      {
        title: "Slices: length, capacity, append and sharing",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "slices"
)

func main() {
    arr := [5]int{1, 2, 3, 4, 5} // an array: the size is part of the type
    view := arr[1:4]             // a slice viewing arr[1], arr[2], arr[3]
    fmt.Println(view, "len", len(view), "cap", cap(view))
    view[0] = 99 // writes through to the array
    fmt.Println("array after writing through the slice:", arr)

    copied := arr // arrays are values: this copies all 5 ints
    copied[0] = -1
    fmt.Println("original", arr[0], "copy", copied[0])

    var nums []int // nil slice: ready to append
    lastCap := -1
    fmt.Print("capacity grows: ")
    for i := range 20 {
        nums = append(nums, i)
        if cap(nums) != lastCap {
            fmt.Print(cap(nums), " ")
            lastCap = cap(nums)
        }
    }
    fmt.Println()

    base := make([]int, 3, 10) // len 3, cap 10: room to grow in place
    a := append(base, 4)       // fits: writes into base's array at index 3
    b := append(base, 5)       // ALSO writes index 3 of the same array!
    fmt.Println("the shared-array trap:", a, b)

    safe := append(base[:3:3], 6) // full slice expression: cap 3 forces a new array
    safe[0] = 100
    fmt.Println("after a capped append:", base, safe)

    clone := slices.Clone(a) // an independent copy
    clone[0] = 7
    fmt.Println("clone is independent:", a[0], clone[0])

    dst := make([]int, 2)
    n := copy(dst, []int{9, 8, 7}) // copies min(len(dst), len(src)) elements
    fmt.Println("copied", n, "->", dst)

    words := []string{"pear", "apple", "fig", "banana"}
    slices.Sort(words)
    i, found := slices.BinarySearch(words, "fig")
    fmt.Println(words, "fig at", i, found, "| contains kiwi:", slices.Contains(words, "kiwi"))
    fmt.Println("max", slices.Max([]int{3, 9, 2}), "| index of 9:", slices.Index([]int{3, 9, 2}, 9))
    fmt.Println("compact:", slices.Compact([]int{1, 1, 2, 2, 2, 3, 1}))
}`,
          },
        ],
        output: `[2 3 4] len 3 cap 4
array after writing through the slice: [1 99 3 4 5]
original 1 copy -1
capacity grows: 1 2 4 8 16 32
the shared-array trap: [0 0 0 5] [0 0 0 5]
after a capped append: [0 0 0] [100 0 0 6]
clone is independent: 0 7
copied 2 -> [9 8]
[apple banana fig pear] fig at 2 true | contains kiwi: false
max 9 | index of 9: 1
compact: [1 2 3 1]`,
        explain: `- \`view\` has capacity 4 because it can extend to the end of \`arr\` (indices 1 to 4).
- **The trap**: \`a\` and \`b\` share \`base\`'s array, so the second append overwrote the first, and both print \`5\` at index 3. This is the bug the visualizer's "Shared backing array" scenario shows step by step.
- \`base[:3:3]\` sets capacity to 3, so append must allocate a new array and \`base\` stays untouched.
- \`slices.Compact\` removes only *consecutive* duplicates: sort first to deduplicate fully.`,
      },
      {
        title: "Maps: comma-ok, counting, grouping and sorted output",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "maps"
    "slices"
    "strings"
)

func main() {
    ages := map[string]int{"ada": 36, "alan": 41}
    ages["grace"] = 85 // insert
    ages["ada"]++      // update in place

    age, ok := ages["linus"] // comma-ok: was the key there?
    fmt.Println("linus:", age, ok)
    if a, ok := ages["ada"]; ok {
        fmt.Println("ada:", a)
    }
    delete(ages, "alan")
    fmt.Println(len(ages), ages) // fmt prints maps with sorted keys

    text := "the cat and the dog and the bird"
    counts := map[string]int{}
    for _, w := range strings.Fields(text) {
        counts[w]++ // missing keys start at 0
    }
    for _, w := range slices.Sorted(maps.Keys(counts)) { // range order is random: sort the keys
        fmt.Printf("%s=%d ", w, counts[w])
    }
    fmt.Println()

    byLength := map[int][]string{}
    for w := range counts {
        byLength[len(w)] = append(byLength[len(w)], w) // appending to a nil slice works
    }
    for _, n := range slices.Sorted(maps.Keys(byLength)) {
        group := byLength[n]
        slices.Sort(group)
        fmt.Println(n, "letters:", group)
    }

    seen := map[string]struct{}{} // a set: struct{} takes no memory
    for _, w := range strings.Fields(text) {
        seen[w] = struct{}{}
    }
    _, hasCat := seen["cat"]
    fmt.Println("distinct words:", len(seen), "has cat:", hasCat)

    type point struct{ x, y int } // structs with comparable fields can be keys
    visited := map[point]bool{{0, 0}: true, {1, 2}: true}
    fmt.Println("visited (1,2):", visited[point{1, 2}], "visited (5,5):", visited[point{5, 5}])

    var nilMap map[string]int
    fmt.Println("reading a nil map is fine:", nilMap["x"])
    defer func() { fmt.Println("recovered:", recover()) }()
    nilMap["x"] = 1 // writing to a nil map panics
}`,
          },
        ],
        output: `linus: 0 false
ada: 37
2 map[ada:37 grace:85]
and=2 bird=1 cat=1 dog=1 the=3
3 letters: [and cat dog the]
4 letters: [bird]
distinct words: 5 has cat: true
visited (1,2): true visited (5,5): false
reading a nil map is fine: 0
recovered: assignment to entry in nil map`,
        explain: `- \`counts[w]++\` works on a missing key because the read returns the zero value 0. That idiom replaces the "if key exists" dance from other languages.
- Range over a map visits keys in a **random order that changes between runs**. Go randomizes it on purpose so nobody depends on it. \`slices.Sorted(maps.Keys(m))\` (Go 1.23) collects the keys and sorts them.
- Keys must be **comparable** (\`==\` works): strings, numbers, pointers, and structs or arrays of comparable types. Slices, maps and functions can't be keys.
- The last line panics; the deferred \`recover\` catches it so the program can print the message. Panics and recover are covered in the errors chapter.`,
      },
    ],
    interview: [
      {
        q: "Explain how slices work internally.",
        a: "A slice is a 3-word header: a pointer to an element of an underlying array, a length and a capacity. Slicing (s[i:j]) creates a new header over the same array without copying. append writes into spare capacity when len < cap; otherwise it allocates a larger array (doubling for small slices, about 1.25x for large ones, rounded to allocator size classes), copies the elements and returns a header to the new array, which is why you must assign its result. Passing a slice to a function copies only the header, so element writes are shared but appends may not be visible to the caller.",
        freq: "very-common",
      },
      {
        q: "What's the shared backing array problem and how do you avoid it?",
        a: "Multiple slices can reference the same array. If two appends are done on slices derived from the same base with spare capacity, both write into the same positions and overwrite each other; modifying an element through one slice also changes it through others. Avoid it by copying (slices.Clone, copy, append([]T(nil), s...)), by using the full slice expression s[low:high:max] to cap the capacity so append must reallocate, and by not retaining sub-slices of large arrays you don't own (which also leaks memory).",
        freq: "common",
      },
      {
        q: "nil slice vs empty slice?",
        a: "`var s []int` is nil (no backing array); `s := []int{}` is non-nil with length 0. Both have len 0, can be ranged over and appended to, so most code treats them the same, and idiomatic Go prefers returning nil. Differences: s == nil is true only for the nil slice, encoding/json encodes nil as null and empty as [], and reflect.DeepEqual distinguishes them.",
        freq: "common",
      },
      {
        q: "Why is map iteration order random, and are maps thread-safe?",
        a: "The language spec leaves order unspecified, and the runtime deliberately randomizes the starting point of each iteration so programs can't accidentally depend on an order that could change with the implementation or map growth. Sort keys when you need determinism. Maps are not safe for concurrent use when any goroutine writes: concurrent writes can corrupt the map, and the runtime detects many cases and crashes with 'concurrent map writes'. Protect maps with sync.Mutex/RWMutex, or use sync.Map for specific patterns (append-only caches, disjoint key sets).",
        freq: "very-common",
      },
    ],
    quiz: [
      {
        q: "What does a slice header contain?",
        options: ["Only a pointer", "Pointer, length and capacity", "A copy of all elements", "A hash"],
        answer: 1,
        explain: "That's why passing a slice is cheap.",
      },
      {
        q: "Why must you write `s = append(s, x)`?",
        options: ["Style only", "append may return a header to a new array", "append modifies s in place always", "To avoid a panic"],
        answer: 1,
        explain: "When capacity runs out, the result points somewhere else.",
      },
      {
        q: "`v := m[\"missing\"]` for a map[string]int gives...",
        options: ["A panic", "0", "nil", "An error"],
        answer: 1,
        explain: "Use v, ok := m[k] to know if the key was present.",
      },
      {
        q: "What happens when you write to a nil map?",
        options: ["It's created automatically", "Panic", "Nothing", "Compile error"],
        answer: 1,
        explain: "Create it with make or a literal first.",
      },
      {
        q: "Which can't be a map key?",
        options: ["string", "a struct of ints", "[]int", "a pointer"],
        answer: 2,
        explain: "Slices aren't comparable.",
      },
      {
        q: "What does s[1:3:3] change compared to s[1:3]?",
        options: ["The length", "The capacity (limited to 2)", "Nothing", "It copies the elements"],
        answer: 1,
        explain: "The third index caps capacity so append reallocates.",
      },
    ],
    problems: [
      { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "Easy", note: "map[int]int" },
      { title: "Group Anagrams", url: "https://leetcode.com/problems/group-anagrams/", difficulty: "Medium", note: "map[[26]int][]string" },
      { title: "Top K Frequent Elements", url: "https://leetcode.com/problems/top-k-frequent-elements/", difficulty: "Medium", note: "counting map + buckets" },
      { title: "Rotate Array", url: "https://leetcode.com/problems/rotate-array/", difficulty: "Medium", note: "slices.Reverse three times" },
    ],
  },

  // ------------------------------------------------------------------ STRUCTS
  {
    id: "go-structs",
    stage: "Foundations",
    title: "Structs, methods, pointers and embedding",
    tagline: "Model data with structs, attach methods with value or pointer receivers, use pointers safely, compose with embedding, and tag fields for JSON.",
    difficulty: "beginner",
    minutes: 35,
    concept: `
## Structs
\`\`\`go
type User struct {
    ID    int
    Name  string
    email string            // lowercase: only visible inside this package
}
u := User{ID: 1, Name: "Ada"}   // named fields (preferred); missing ones get zero values
p := &User{Name: "Grace"}       // a pointer to a new User
\`\`\`
Structs are **values**: assigning or passing one copies all its fields. Two structs are \`==\` if all fields are equal (when every field is comparable).

## Methods and receivers
A method is a function with a **receiver**:
\`\`\`go
func (u User) Greeting() string { return "Hi " + u.Name }   // value receiver: works on a copy
func (u *User) Rename(name string) { u.Name = name }        // pointer receiver: can modify
\`\`\`
**Use a pointer receiver** when the method modifies the receiver, when the struct is large, or when it contains something that must not be copied (like a \`sync.Mutex\`). **Be consistent**: if any method needs a pointer receiver, give all of them pointer receivers. Go automatically takes the address (\`u.Rename(...)\` works on an addressable \`u\`) or dereferences (\`p.Greeting()\` on a pointer).

## Pointers
\`&x\` takes an address, \`*p\` dereferences, \`new(T)\` allocates a zeroed \`T\` and returns \`*T\`. There's **no pointer arithmetic**, and it's safe to return a pointer to a local variable: the compiler's **escape analysis** moves it to the heap when needed. Dereferencing a \`nil\` pointer panics.

## Constructors
Go has no constructors. By convention a \`NewThing(...)\` function validates input and returns \`*Thing\` (often with an \`error\`). Better yet, make the zero value useful so no constructor is needed.

## Embedding: composition, not inheritance
\`\`\`go
type Logger struct{ prefix string }
func (l Logger) Log(msg string) { fmt.Println(l.prefix + msg) }

type Server struct {
    Logger          // embedded: Server "has a" Logger and gets its methods
    Addr string
}
s.Log("started")    // promoted from Logger
\`\`\`
Embedded fields' methods and fields are **promoted** to the outer type, which helps it satisfy interfaces. But it's not inheritance: there's no virtual dispatch back to the outer type, and \`Server\` isn't a \`Logger\`.

## Struct tags
Backtick-quoted metadata read by libraries via reflection: \`json:"name,omitempty"\`, \`db:"user_id"\`, \`validate:"required,email"\`.
`,
    keyPoints: [
      "Structs are values: assignment copies every field",
      "Pointer receivers modify the receiver; value receivers get a copy",
      "Be consistent: if one method needs a pointer receiver, use pointers for all",
      "Returning a pointer to a local is safe: escape analysis moves it to the heap",
      "NewX functions act as constructors; better, make the zero value useful",
      "Embedding promotes fields and methods: composition, not inheritance",
      "Struct tags configure JSON, databases and validation",
    ],
    code: [
      {
        title: "Structs, methods and value vs pointer receivers",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
)

// Money in integer cents: never use float64 for money.
type Account struct {
    Owner        string
    balanceCents int64 // unexported: only methods in this package can touch it
}

func NewAccount(owner string, cents int64) (*Account, error) { // the "constructor" convention
    if owner == "" {
        return nil, errors.New("owner is required")
    }
    if cents < 0 {
        return nil, errors.New("opening balance must not be negative")
    }
    return &Account{Owner: owner, balanceCents: cents}, nil
}

func (a *Account) Deposit(cents int64) error { // pointer receiver: modifies the account
    if cents <= 0 {
        return fmt.Errorf("deposit must be positive, got %d", cents)
    }
    a.balanceCents += cents
    return nil
}

func (a *Account) Withdraw(cents int64) error {
    if cents > a.balanceCents {
        return fmt.Errorf("insufficient funds: balance %s, requested %s", formatCents(a.balanceCents), formatCents(cents))
    }
    a.balanceCents -= cents
    return nil
}

func (a *Account) Balance() string { return formatCents(a.balanceCents) }

func formatCents(c int64) string { return fmt.Sprintf("$%d.%02d", c/100, c%100) }

type Point struct{ X, Y int }

func (p Point) Add(q Point) Point { return Point{p.X + q.X, p.Y + q.Y} } // value receiver: p is a copy
func (p *Point) Scale(k int)      { p.X *= k; p.Y *= k }

func main() {
    acct, err := NewAccount("Ada", 10_000)
    if err != nil {
        fmt.Println("error:", err)
        return
    }
    _ = acct.Deposit(2_550)
    fmt.Println(acct.Owner, "has", acct.Balance())
    if err := acct.Withdraw(50_000); err != nil {
        fmt.Println("error:", err)
    }
    if _, err := NewAccount("", 5); err != nil {
        fmt.Println("error:", err)
    }

    p := Point{1, 2}
    q := p // a full copy
    q.X = 100
    fmt.Println("p", p, "q", q, "equal?", p == q)
    fmt.Println("p.Add:", p.Add(Point{10, 10}), "p unchanged:", p)
    p.Scale(3) // Go takes &p automatically
    fmt.Printf("after Scale: %v, with field names: %+v\\n", p, p)

    ptr := &p
    ptr.X = 0 // automatic dereference: same as (*ptr).X
    fmt.Println("through the pointer:", p)

    config := struct { // an anonymous struct for one-off data
        Host string
        Port int
    }{"localhost", 8080}
    fmt.Printf("%+v\\n", config)
}`,
          },
        ],
        output: `Ada has $125.50
error: insufficient funds: balance $125.50, requested $500.00
error: owner is required
p {1 2} q {100 2} equal? false
p.Add: {11 12} p unchanged: {1 2}
after Scale: {3 6}, with field names: {X:3 Y:6}
through the pointer: {0 6}
{Host:localhost Port:8080}`,
        explain: `- \`10_000\` uses digit separators for readability.
- \`balanceCents\` is unexported, so code in other packages must go through \`Deposit\` and \`Withdraw\`, which enforce the rules. That's Go's encapsulation: at the package level, by capitalization.
- \`Add\` returns a new \`Point\` and leaves \`p\` alone; \`Scale\` changes \`p\` through a pointer.
- \`%+v\` prints struct field names; \`%#v\` prints Go syntax.`,
      },
      {
        title: "Embedding and composition",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "strings"
)

type Logger struct {
    Prefix string
    lines  int
}

func (l *Logger) Log(format string, args ...any) {
    l.lines++
    fmt.Printf(l.Prefix+format+"\\n", args...)
}

type Metrics struct {
    counts map[string]int
}

func (m *Metrics) Inc(name string) {
    if m.counts == nil {
        m.counts = map[string]int{}
    }
    m.counts[name]++
}

// Server is composed of a Logger and Metrics. Their methods are promoted to Server.
type Server struct {
    *Logger // embedded pointer
    Metrics // embedded value
    Addr    string
}

func (s *Server) Handle(path string) {
    s.Inc("requests")                 // promoted from Metrics
    s.Log("handled %s on %s", path, s.Addr) // promoted from Logger
}

// Shadowing: an outer method with the same name hides the embedded one.
type QuietServer struct {
    Server
}

func (q *QuietServer) Log(format string, args ...any) {
    q.Server.Log(strings.ToUpper("(quiet) ")+format, args...) // call the embedded one explicitly
}

func main() {
    srv := &Server{Logger: &Logger{Prefix: "[api] "}, Addr: ":8080"}
    srv.Handle("/users")
    srv.Handle("/orders")
    fmt.Println("requests:", srv.counts["requests"], "log lines:", srv.lines)

    quiet := &QuietServer{Server{Logger: &Logger{Prefix: "[q] "}, Addr: ":9090"}}
    quiet.Log("hello %d", 42)          // QuietServer.Log
    quiet.Handle("/x")                 // Server.Handle calls s.Log: the EMBEDDED Logger's, not QuietServer's
}`,
          },
        ],
        output: `[api] handled /users on :8080
[api] handled /orders on :8080
requests: 2 log lines: 2
[q] (QUIET) hello 42
[q] handled /x on :9090`,
        explain: `- Promoted methods make \`srv.Log(...)\` a shortcut for \`srv.Logger.Log(...)\`, and promoted fields work the same way (\`srv.lines\`).
- **Embedding is not inheritance.** In the last line, \`Server.Handle\` calls \`s.Log\`, and \`s\` is a \`*Server\`, so it uses the embedded \`Logger\`'s method. \`QuietServer\`'s override is never seen. There's no virtual dispatch from embedded types back to the outer type. For behavior that varies, use an **interface** field instead.
- \`Metrics\`' zero value is usable because \`Inc\` lazily creates the map: a common trick.`,
      },
      {
        title: "Pointers, escape analysis and struct tags",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "encoding/json"
    "fmt"
)

func doubleValue(n int)    { n *= 2 }  // gets a copy
func doublePointer(n *int) { *n *= 2 } // modifies the caller's variable

func newCounter() *int {
    c := 0
    return &c // safe in Go: escape analysis puts c on the heap
}

type User struct {
    ID       int      \`json:"id"\`
    Name     string   \`json:"name"\`
    Email    string   \`json:"email,omitempty"\` // left out when empty
    Tags     []string \`json:"tags"\`
    Password string   \`json:"-"\` // never serialized
    note     string   // unexported fields are ignored by encoding/json
}

func main() {
    x := 5
    doubleValue(x)
    fmt.Println("after doubleValue:", x)
    doublePointer(&x)
    fmt.Println("after doublePointer:", x)

    c := newCounter()
    *c += 3
    fmt.Println("counter:", *c)

    p := new(int) // allocates a zeroed int, returns *int
    fmt.Println("new(int):", *p, "| p is nil?", p == nil)

    var missing *User
    fmt.Println("nil pointer:", missing == nil) // dereferencing it would panic

    u := User{ID: 1, Name: "Ada", Password: "secret", note: "internal"}
    data, err := json.Marshal(u)
    if err != nil {
        panic(err)
    }
    fmt.Println(string(data))

    var back User
    _ = json.Unmarshal([]byte(\`{"id":2,"name":"Grace","email":"grace@navy.mil","tags":["admiral"]}\`), &back)
    fmt.Printf("%+v\\n", back)
}`,
          },
        ],
        output: `after doubleValue: 5
after doublePointer: 10
counter: 3
new(int): 0 | p is nil? false
nil pointer: true
{"id":1,"name":"Ada","tags":null}
{ID:2 Name:Grace Email:grace@navy.mil Tags:[admiral] Password: note:}`,
        explain: `- Go passes **everything by value**: \`doubleValue\` gets a copy, while \`doublePointer\` gets a copy of the *address* and modifies the original through it.
- Returning \`&c\` from \`newCounter\` would be a dangling pointer in C. In Go the compiler sees that \`c\` outlives the function and allocates it on the heap. See its decisions with \`go build -gcflags=-m\`.
- \`json:"-"\` keeps the password out of the output, \`omitempty\` drops the empty email, and a nil slice encodes as \`null\` (an empty slice would give \`[]\`).
- \`json.Unmarshal\` needs a **pointer** (\`&back\`) so it can fill in the struct.`,
      },
    ],
    interview: [
      {
        q: "When should you use a pointer receiver vs a value receiver?",
        a: "Pointer receivers when the method mutates the receiver, when the struct is large (avoid copying), or when it contains fields that must not be copied (sync.Mutex, sync.WaitGroup, anything with a noCopy). Value receivers for small immutable values (like time.Time or a Point) where copying is cheap and semantics should be value-like. Be consistent across a type's methods. Note method sets: a value of type T only has value-receiver methods in its method set, so if an interface is satisfied by pointer-receiver methods, only *T implements it.",
        freq: "very-common",
      },
      {
        q: "Is Go pass-by-value or pass-by-reference?",
        a: "Always pass-by-value: every argument is copied. Some types are small headers that refer to shared data, so copying them shares the underlying data: slices (pointer/len/cap), maps and channels (pointers to runtime structures), pointers, interfaces and functions. So a function can modify a slice's elements or a map's entries, but reassigning the parameter or appending beyond capacity doesn't affect the caller.",
        freq: "very-common",
      },
      {
        q: "Is embedding the same as inheritance?",
        a: "No. Embedding is composition with automatic delegation: the embedded type's fields and methods are promoted so they can be accessed directly on the outer type, which can help satisfy interfaces. But there's no subtype relationship (a Server is not a Logger and can't be passed where a Logger is expected), and no virtual dispatch: methods of the embedded type always operate on the embedded value and never call 'overridden' methods of the outer type. Polymorphism in Go comes from interfaces.",
        freq: "common",
      },
      {
        q: "What is escape analysis?",
        a: "A compile-time analysis that decides whether a variable can live on the goroutine's stack (cheap, freed automatically when the function returns) or must be allocated on the heap (managed by the GC) because a reference to it outlives the function: returned pointers, values stored in heap objects or interfaces, closures captured by goroutines, or sizes unknown at compile time. It's why returning &local is safe. Inspect it with `go build -gcflags=-m`; reducing escapes in hot paths reduces GC pressure.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "`func (p Point) Move() { p.X++ }` called as `pt.Move()` changes pt?",
        options: ["Yes", "No: the method works on a copy", "Only if pt is a pointer", "Compile error"],
        answer: 1,
        explain: "Use a pointer receiver to modify.",
      },
      {
        q: "Is returning the address of a local variable safe in Go?",
        options: ["No, it dangles", "Yes: escape analysis moves it to the heap", "Only for ints", "Only with new()"],
        answer: 1,
        explain: "The compiler handles lifetimes.",
      },
      {
        q: "Which struct field does encoding/json ignore?",
        options: ["Name string", "name string (unexported)", "Name string `json:\"name\"`", "Tags []string"],
        answer: 1,
        explain: "Only exported fields are visible to other packages, including encoding/json.",
      },
      {
        q: "A struct embeds Logger. Can you pass the struct to a function expecting Logger?",
        options: ["Yes", "No: embedding isn't subtyping", "Only with a pointer", "Only if Logger is an interface"],
        answer: 1,
        explain: "Pass s.Logger instead, or accept an interface.",
      },
      {
        q: "What does `json:\"email,omitempty\"` do?",
        options: ["Renames the field and omits it when empty", "Makes it required", "Encrypts it", "Hides it always"],
        answer: 0,
        explain: "Use json:\"-\" to always omit.",
      },
    ],
  },
];
