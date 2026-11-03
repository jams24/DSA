import type { Lesson } from "../types";

// Go track, part 2: Core.

export const goCore: Lesson[] = [
  // ------------------------------------------------------------------ INTERFACES
  {
    id: "go-interfaces",
    stage: "Core",
    title: "Interfaces: implicit, small and powerful",
    tagline: "How Go's implicit interfaces work, io.Reader and io.Writer, type assertions and switches, the nil-interface trap, and 'accept interfaces, return structs'.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Interfaces are satisfied implicitly
An interface is a set of method signatures. **Any type that has those methods implements it**, with no \`implements\` keyword:
\`\`\`go
type Shape interface {
    Area() float64
}
type Rect struct{ W, H float64 }
func (r Rect) Area() float64 { return r.W * r.H }   // Rect is now a Shape. That's it.
\`\`\`
This decouples packages: you can define an interface in *your* package that a type from *another* package already satisfies, without that package knowing about you.

## Interface values
An interface value holds two things: a **dynamic type** and a **dynamic value** (a pointer to the data). Calling a method looks up the dynamic type's implementation (via an internal table, like a vtable). \`%T\` prints the dynamic type.

## The most important interfaces in the standard library
| Interface | Method | Used by |
|---|---|---|
| \`io.Reader\` | \`Read(p []byte) (n int, err error)\` | Files, network connections, HTTP bodies, gzip, strings.Reader... |
| \`io.Writer\` | \`Write(p []byte) (n int, err error)\` | Files, sockets, buffers, hashes, HTTP responses... |
| \`fmt.Stringer\` | \`String() string\` | How \`fmt\` prints your type |
| \`error\` | \`Error() string\` | Every error |
| \`sort.Interface\` | \`Len\`, \`Less\`, \`Swap\` | \`sort.Sort\` (mostly replaced by \`slices.SortFunc\`) |
| \`http.Handler\` | \`ServeHTTP(w, r)\` | Every HTTP handler and middleware |

Because so much speaks \`io.Reader\`/\`io.Writer\`, small pieces compose: \`io.Copy(gzipWriter, file)\`, \`io.MultiWriter\`, \`io.TeeReader\`, \`bufio.Scanner\` over anything.

## Design guidance
- **Keep interfaces small**: one or two methods. "The bigger the interface, the weaker the abstraction."
- **Define interfaces where they're used** (the consumer), not where types are implemented.
- **Accept interfaces, return structs**: functions take the smallest interface they need (easy to test with fakes) and return concrete types (callers get the full API).
- Don't create an interface until you have two implementations or need a test fake.
- \`any\` (= \`interface{}\`) accepts anything but tells the reader nothing. Use it sparingly; generics often fit better.

## Type assertions and type switches
\`v, ok := x.(T)\` extracts the concrete type (\`ok\` is false if it isn't \`T\`; without \`ok\` a mismatch panics). A **type switch** branches on the dynamic type: \`switch v := x.(type) { case int: ... case string: ... }\`. You can also assert to another interface: \`if s, ok := x.(fmt.Stringer); ok\`.

## The nil interface trap
An interface is \`nil\` only if **both** its type and value are nil. Returning a nil \`*MyError\` as an \`error\` gives a non-nil interface (type \`*MyError\`, value nil), so \`err != nil\` is true. **Return a literal \`nil\` for "no error".**
`,
    keyPoints: [
      "Types implement interfaces implicitly by having the methods",
      "An interface value is a (dynamic type, value) pair",
      "io.Reader and io.Writer make the standard library composable",
      "Keep interfaces small and define them where they're consumed",
      "Accept interfaces, return structs",
      "v, ok := x.(T) and type switches inspect dynamic types",
      "An interface holding a nil pointer is not nil: return a plain nil",
    ],
    code: [
      {
        title: "Implicit interfaces, polymorphism and fmt.Stringer",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "cmp"
    "fmt"
    "math"
    "slices"
)

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Rect struct{ W, H float64 }

func (r Rect) Area() float64      { return r.W * r.H }
func (r Rect) Perimeter() float64 { return 2 * (r.W + r.H) }
func (r Rect) String() string     { return fmt.Sprintf("Rect(%gx%g)", r.W, r.H) } // fmt.Stringer

type Circle struct{ R float64 }

func (c Circle) Area() float64      { return math.Pi * c.R * c.R }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.R }

type Square struct{ Side float64 }

func (s Square) Area() float64      { return s.Side * s.Side }
func (s Square) Perimeter() float64 { return 4 * s.Side }

// Compile-time checks: the build fails if a type stops satisfying Shape.
var (
    _ Shape = Rect{}
    _ Shape = Circle{}
    _ Shape = Square{}
)

func describe(s Shape) string {
    return fmt.Sprintf("%-12T area %6.2f  perimeter %6.2f", s, s.Area(), s.Perimeter())
}

func main() {
    shapes := []Shape{Rect{3, 4}, Circle{1}, Square{2}, Rect{1, 10}}
    slices.SortFunc(shapes, func(a, b Shape) int { return cmp.Compare(a.Area(), b.Area()) })

    total := 0.0
    for _, s := range shapes {
        fmt.Println(describe(s))
        total += s.Area()
    }
    fmt.Printf("total area %.2f\\n", total)

    fmt.Println(Rect{3, 4}, Circle{2}) // Rect has String(); Circle prints its fields
}`,
          },
        ],
        output: `main.Circle  area   3.14  perimeter   6.28
main.Square  area   4.00  perimeter   8.00
main.Rect    area  10.00  perimeter  22.00
main.Rect    area  12.00  perimeter  14.00
total area 29.14
Rect(3x4) {2}`,
        explain: `- None of the shape types mention \`Shape\`; having \`Area\` and \`Perimeter\` is enough.
- \`var _ Shape = Rect{}\` costs nothing at run time but makes the compiler verify the interface is satisfied, a common idiom for types meant to implement an interface.
- \`%T\` prints the **dynamic type** stored in the interface.
- \`fmt\` checks whether a value implements \`fmt.Stringer\` and calls \`String()\` if so.`,
      },
      {
        title: "Type assertions, type switches and the nil interface trap",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
)

type Temperature float64

func (t Temperature) String() string { return fmt.Sprintf("%.1f°C", float64(t)) }

func kind(v any) string {
    switch x := v.(type) { // x has the matched type in each case
    case nil:
        return "nil"
    case int:
        return fmt.Sprintf("int %d (doubled: %d)", x, x*2)
    case string:
        return fmt.Sprintf("string %q of length %d", x, len(x))
    case error:
        return "error: " + x.Error()
    case fmt.Stringer: // matching an interface
        return "stringer: " + x.String()
    case []int:
        return fmt.Sprintf("slice of %d ints", len(x))
    default:
        return fmt.Sprintf("something else: %T", x)
    }
}

type NotFoundError struct{ Key string }

func (e *NotFoundError) Error() string { return e.Key + " not found" }

func buggyLookup(key string) error {
    var err *NotFoundError // a nil pointer
    if key != "ok" {
        err = &NotFoundError{key}
    }
    return err // BUG: wraps a nil *NotFoundError in a non-nil error interface
}

func fixedLookup(key string) error {
    if key != "ok" {
        return &NotFoundError{key}
    }
    return nil // a true nil interface
}

func main() {
    var anything any = 42
    n, ok := anything.(int)
    fmt.Println("as int:", n, ok)
    s, ok := anything.(string) // wrong type: zero value and false (no panic with the ok form)
    fmt.Printf("as string: %q %v\\n", s, ok)

    for _, v := range []any{nil, 7, "gopher", errors.New("boom"), Temperature(21.5), []int{1, 2}, 3.14} {
        fmt.Println(kind(v))
    }

    err := buggyLookup("ok")
    fmt.Printf("buggy: err == nil? %v (type %T, value %v)\\n", err == nil, err, err)
    err = fixedLookup("ok")
    fmt.Println("fixed: err == nil?", err == nil)

    var target *NotFoundError
    if errors.As(fixedLookup("user:9"), &target) {
        fmt.Println("missing key:", target.Key)
    }
}`,
          },
        ],
        output: `as int: 42 true
as string: "" false
nil
int 7 (doubled: 14)
string "gopher" of length 6
error: boom
stringer: 21.5°C
slice of 2 ints
something else: float64
buggy: err == nil? false (type *main.NotFoundError, value <nil>)
fixed: err == nil? true
missing key: user:9`,
        explain: `- The single-result form \`anything.(string)\` would **panic** on the wrong type; the two-result form is safe.
- Order matters in a type switch: \`errors.New("boom")\` is both an \`error\` and not a \`Stringer\`, and the first matching case wins.
- **The trap**: \`buggyLookup\` returns an interface whose type is \`*NotFoundError\` and whose value is nil. An interface is only \`nil\` when it holds no type at all, so the caller thinks an error happened. Return \`nil\` literally.
- \`errors.As\` finds a \`*NotFoundError\` inside the error and gives you its fields. It's the safe way to get at a custom error type, even when the error has been wrapped (next chapter).`,
      },
      {
        title: "io.Reader and io.Writer: composing small interfaces",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "bufio"
    "bytes"
    "crypto/sha256"
    "fmt"
    "io"
    "os"
    "strings"
)

// countWords works with ANY io.Reader: a file, a network connection, an HTTP body, a string...
func countWords(r io.Reader) (int, error) {
    sc := bufio.NewScanner(r)
    sc.Split(bufio.ScanWords)
    n := 0
    for sc.Scan() {
        n++
    }
    return n, sc.Err()
}

// upperWriter is a decorator: it wraps another io.Writer and upper-cases what passes through.
type upperWriter struct{ w io.Writer }

func (u upperWriter) Write(p []byte) (int, error) {
    return u.w.Write(bytes.ToUpper(p))
}

// countingWriter counts bytes and discards them.
type countingWriter struct{ n int }

func (c *countingWriter) Write(p []byte) (int, error) {
    c.n += len(p)
    return len(p), nil
}

func main() {
    n, _ := countWords(strings.NewReader("the quick brown fox jumps"))
    fmt.Println("words:", n)

    fmt.Fprintf(upperWriter{os.Stdout}, "hello, %s!\\n", "gopher") // Fprintf writes to any io.Writer

    var buf bytes.Buffer // a Reader AND a Writer
    counter := &countingWriter{}
    hash := sha256.New() // hashes are Writers too
    all := io.MultiWriter(&buf, counter, hash, upperWriter{os.Stdout})
    copied, err := io.Copy(all, strings.NewReader("one source, four destinations\\n"))
    fmt.Println("copied", copied, "bytes, err:", err)
    fmt.Printf("buffer holds %q, counter saw %d bytes, sha256 %x...\\n", buf.String(), counter.n, hash.Sum(nil)[:4])

    var seen strings.Builder
    tee := io.TeeReader(strings.NewReader("read once, recorded twice"), &seen)
    words, _ := countWords(tee)
    fmt.Println("tee: counted", words, "words and recorded:", seen.String())

    limited := io.LimitReader(strings.NewReader("only the first ten bytes"), 10)
    first, _ := io.ReadAll(limited)
    fmt.Printf("limited: %q\\n", first)
}`,
          },
        ],
        output: `words: 5
HELLO, GOPHER!
ONE SOURCE, FOUR DESTINATIONS
copied 30 bytes, err: <nil>
buffer holds "one source, four destinations\\n", counter saw 30 bytes, sha256 63689aed...
tee: counted 4 words and recorded: read once, recorded twice
limited: "only the f"`,
        explain: `- \`countWords\` doesn't care where the bytes come from. In tests you pass \`strings.NewReader\`; in production, an \`*os.File\` or \`http.Request.Body\`.
- \`upperWriter\` is the **decorator pattern** in four lines: wrap a Writer, transform, delegate.
- \`io.MultiWriter\` fans one stream out to many Writers, \`io.TeeReader\` copies whatever is read into a Writer, and \`io.LimitReader\` caps how much can be read (handy for untrusted input). All of them just compose the two one-method interfaces.`,
      },
    ],
    interview: [
      {
        q: "How do interfaces work in Go, and how are they different from Java's?",
        a: "Go interfaces are satisfied implicitly: a type implements an interface simply by having all its methods, with no declaration. This lets consumers define small interfaces describing exactly what they need, even for types from other packages, and avoids dependency cycles. At run time an interface value is a pair (itab/type pointer, data pointer); method calls go through the itab's function table. Java requires explicit `implements` and nominal typing, which ties implementations to the interface's package.",
        freq: "very-common",
      },
      {
        q: "Explain the nil interface problem.",
        a: "An interface value is nil only when both its dynamic type and value are nil. If a function returns a typed nil pointer (e.g. `var e *MyErr; return e`) as an `error`, the returned interface has type *MyErr and value nil, so `err != nil` is true even though the pointer is nil. Callers then treat it as an error and may call methods on a nil receiver. Fix: return the untyped `nil` explicitly when there's no error, and avoid declaring error return variables as concrete pointer types.",
        freq: "very-common",
      },
      {
        q: "What does 'accept interfaces, return structs' mean?",
        a: "Functions should take parameters as small interfaces describing only the behavior they use (io.Reader instead of *os.File, a Store interface instead of *PostgresStore), which makes them flexible and easy to test with fakes. They should return concrete types so callers get the full API and can choose their own abstractions; returning interfaces hides functionality and forces premature abstraction. Exceptions: returning error, or when the implementation is deliberately hidden (e.g. constructors of pluggable backends).",
        freq: "common",
      },
      {
        q: "Where should interfaces be defined?",
        a: "Usually in the package that consumes them, not the one that implements them. The consumer knows which methods it needs and can keep the interface minimal; the implementing package just exposes concrete types. This works because satisfaction is implicit. Large 'header' interfaces defined next to their only implementation (Java style) are an anti-pattern in Go, except for well-known shared abstractions like io.Reader.",
      },
    ],
    quiz: [
      {
        q: "How does a type declare that it implements an interface?",
        options: ["implements keyword", "It doesn't: having the methods is enough", "Embedding the interface", "A struct tag"],
        answer: 1,
        explain: "Satisfaction is implicit.",
      },
      {
        q: "`var e *MyErr = nil; var err error = e; err == nil` is...",
        options: ["true", "false", "A compile error", "A panic"],
        answer: 1,
        explain: "The interface holds a type (*MyErr), so it's not nil.",
      },
      {
        q: "What happens with `s := x.(string)` when x holds an int?",
        options: ["s is \"\"", "Panic", "Compile error", "s is \"42\""],
        answer: 1,
        explain: "Use s, ok := x.(string) to avoid the panic.",
      },
      {
        q: "Which is the most composable signature for a function that parses input?",
        options: ["func Parse(f *os.File)", "func Parse(r io.Reader)", "func Parse(path string)", "func Parse(b []byte, f *os.File)"],
        answer: 1,
        explain: "Any source of bytes works, including test strings.",
      },
      {
        q: "What does `var _ Shape = Rect{}` do?",
        options: ["Allocates a global", "Checks at compile time that Rect implements Shape", "Registers Rect", "Nothing"],
        answer: 1,
        explain: "A zero-cost compile-time assertion.",
      },
    ],
  },

  // ------------------------------------------------------------------ ERRORS
  {
    id: "go-errors",
    stage: "Core",
    title: "Errors as values, wrapping, panic and recover",
    tagline: "Return errors, add context with %w, inspect chains with errors.Is and errors.As, design sentinel and custom error types, and know when panic is appropriate.",
    difficulty: "intermediate",
    minutes: 30,
    concept: `
## Errors are ordinary values
Go has no exceptions for normal failures. A function that can fail returns an \`error\` as its **last** result, and the caller checks it **immediately**:
\`\`\`go
f, err := os.Open(path)
if err != nil {
    return fmt.Errorf("load config %s: %w", path, err)   // add context, keep the cause
}
defer f.Close()
\`\`\`
It's verbose, but every failure path is visible in the code, and there's no hidden control flow.

## Three ways to define errors
| Kind | Example | Check with |
|---|---|---|
| **Sentinel** (a package-level value) | \`var ErrNotFound = errors.New("not found")\` | \`errors.Is(err, ErrNotFound)\` |
| **Custom type** (carries data) | \`type ValidationError struct{ Field string }\` | \`errors.As(err, &target)\` |
| **Opaque** (just a message) | \`fmt.Errorf("parse line %d: bad header", n)\` | Only print it |

## Wrapping builds a chain
\`fmt.Errorf("...: %w", err)\` wraps \`err\`: the message gets your context and the original stays reachable.
- \`errors.Is(err, target)\` walks the chain looking for a value equal to \`target\`.
- \`errors.As(err, &target)\` walks the chain looking for a value of \`target\`'s type and assigns it.
- \`errors.Unwrap\` returns the next error. \`errors.Join(e1, e2)\` combines several errors (Go 1.20).
- Use \`%v\` instead of \`%w\` when you deliberately *don't* want callers depending on the cause (an implementation detail).

Good error messages read as a chain of context, lowercase and without punctuation: \`handle request: find user 42: sql: no rows in result set\`.

## Handle errors once
Either **handle** an error (log it, retry, fall back, return a 404) or **return** it with context. Not both: logging and returning produces duplicate log lines all the way up the stack.

## panic and recover
\`panic\` stops normal execution, runs deferred calls up the stack, and crashes the program unless a deferred function calls \`recover()\`. Use panics only for **programmer errors and impossible states** (an index out of range, a nil map write, a broken invariant during initialization), never for expected failures like a missing file or bad input.
- \`recover\` only works inside a deferred function in the panicking goroutine.
- HTTP servers recover per request so one bug doesn't kill the process; \`net/http\` does this for you.
- A panic in a goroutine you started that nobody recovers **crashes the whole program**.
`,
    keyPoints: [
      "Return error as the last result; check it immediately",
      "Wrap with fmt.Errorf(\"context: %w\", err) to keep the cause",
      "errors.Is for sentinel values, errors.As for error types",
      "Messages: lowercase, no punctuation, a chain of context",
      "Handle an error or return it, not both",
      "panic only for programmer errors; recover only in deferred functions",
      "An unrecovered panic in any goroutine crashes the program",
    ],
    code: [
      {
        title: "Sentinels, custom types, wrapping, Is and As",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
    "strings"
)

var ErrNotFound = errors.New("not found") // a sentinel: compare with errors.Is

type ValidationError struct { // a custom type: carries structured data
    Field   string
    Problem string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Problem }

var users = map[int]string{1: "ada@example.com"}

func findUser(id int) (string, error) {
    email, ok := users[id]
    if !ok {
        return "", fmt.Errorf("find user %d: %w", id, ErrNotFound)
    }
    return email, nil
}

func validateEmail(email string) error {
    if !strings.Contains(email, "@") {
        return &ValidationError{Field: "email", Problem: "must contain @"}
    }
    return nil
}

func handleProfile(id int) error {
    if _, err := findUser(id); err != nil {
        return fmt.Errorf("handle profile: %w", err) // more context, same cause
    }
    return nil
}

func statusCode(err error) int { // translate errors at the edge (e.g. HTTP)
    var ve *ValidationError
    switch {
    case err == nil:
        return 200
    case errors.Is(err, ErrNotFound):
        return 404
    case errors.As(err, &ve):
        return 400
    default:
        return 500
    }
}

func main() {
    err := handleProfile(42)
    fmt.Println(err)
    fmt.Println("is ErrNotFound:", errors.Is(err, ErrNotFound), "| status", statusCode(err))
    fmt.Println("unwrapped once:", errors.Unwrap(err))

    signup := fmt.Errorf("signup: %w", validateEmail("ada.example.com"))
    var ve *ValidationError
    if errors.As(signup, &ve) {
        fmt.Printf("invalid field %q: %s | status %d\\n", ve.Field, ve.Problem, statusCode(signup))
    }

    hidden := fmt.Errorf("handle profile: %v", ErrNotFound) // %v: message only, chain broken
    fmt.Printf("with %%v, errors.Is finds it? %v\\n", errors.Is(hidden, ErrNotFound))

    joined := errors.Join(validateEmail("x"), fmt.Errorf("age: %w", errors.New("must be positive")))
    fmt.Println("joined:\\n" + joined.Error())
    fmt.Println("statuses:", statusCode(nil), statusCode(errors.New("disk full")))
}`,
          },
        ],
        output: `handle profile: find user 42: not found
is ErrNotFound: true | status 404
unwrapped once: find user 42: not found
invalid field "email": must contain @ | status 400
with %v, errors.Is finds it? false
joined:
email: must contain @
age: must be positive
statuses: 200 500`,
        explain: `- Each layer adds context with \`%w\`, so the final message tells the whole story: \`handle profile: find user 42: not found\`.
- \`errors.Is\` and \`errors.As\` look through every wrapped layer, so \`statusCode\` works however deep the cause is.
- \`errors.As\` needs a **pointer to** a variable of the error type (here \`**ValidationError\`), because it assigns to it.
- Translating errors to HTTP status codes in one place, at the edge, keeps business code free of HTTP concerns.`,
      },
      {
        title: "panic, recover and deferred cleanup",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "errors"
    "fmt"
    "os"
    "path/filepath"
)

// safeDivide turns a panic into an ordinary error using a deferred recover.
func safeDivide(a, b int) (result int, err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("recovered: %v", r) // a deferred closure can set named results
        }
    }()
    return a / b, nil
}

func element(xs []int, i int) (v int, err error) {
    defer func() {
        if r := recover(); r != nil {
            err = fmt.Errorf("element %d: %v", i, r)
        }
    }()
    return xs[i], nil
}

// writeReport shows the idiom for not losing an error from Close.
func writeReport(path string, lines []string) (err error) {
    f, err := os.Create(path)
    if err != nil {
        return fmt.Errorf("write report: %w", err)
    }
    defer func() {
        if closeErr := f.Close(); closeErr != nil && err == nil {
            err = fmt.Errorf("write report: close: %w", closeErr)
        }
    }()
    for _, line := range lines {
        if _, err := fmt.Fprintln(f, line); err != nil {
            return fmt.Errorf("write report: %w", err)
        }
    }
    return nil
}

func mustPositive(n int) int { // "Must" functions panic: only for values known at startup
    if n <= 0 {
        panic(fmt.Sprintf("mustPositive: got %d", n))
    }
    return n
}

func main() {
    fmt.Println(safeDivide(10, 2))
    fmt.Println(safeDivide(1, 0))
    fmt.Println(element([]int{1, 2, 3}, 5))

    dir, err := os.MkdirTemp("", "errors-demo")
    if err != nil {
        fmt.Println(err)
        return
    }
    defer os.RemoveAll(dir) // deferred: runs when main returns
    path := filepath.Join(dir, "report.txt")
    fmt.Println("write:", writeReport(path, []string{"line 1", "line 2"}))
    data, _ := os.ReadFile(path)
    fmt.Printf("file contents: %q\\n", data)

    err = writeReport(filepath.Join(dir, "missing-dir", "x.txt"), nil)
    fmt.Println("error:", err != nil, "| is ErrNotExist:", errors.Is(err, os.ErrNotExist))

    workers := mustPositive(4)
    fmt.Println("workers:", workers)
    defer fmt.Println("deferred calls still run during a panic")
    defer func() { fmt.Println("recovered in main:", recover()) }()
    mustPositive(-1)
    fmt.Println("never printed")
}`,
          },
        ],
        output: `5 <nil>
0 recovered: runtime error: integer divide by zero
0 element 5: runtime error: index out of range [5] with length 3
write: <nil>
file contents: "line 1\\nline 2\\n"
error: true | is ErrNotExist: true
workers: 4
recovered in main: mustPositive: got -1
deferred calls still run during a panic`,
        explain: `- \`recover()\` returns the panic value only when called **directly in a deferred function**. Setting the named result \`err\` from the deferred closure turns the panic into a normal return.
- Runtime errors (division by zero, index out of range, nil dereference) are panics. Recovering them is useful at boundaries (one HTTP request, one job), not as everyday error handling.
- \`writeReport\` closes the file in a defer and still reports a \`Close\` error if nothing else failed. Writes can fail at close time when data is flushed.
- \`os.Create\` fails with an error wrapping \`os.ErrNotExist\` (via \`*fs.PathError\`), so \`errors.Is\` finds it.
- After the panic in \`main\`, deferred calls run in LIFO order: the recover runs first, then the earlier \`defer\`.`,
      },
    ],
    interview: [
      {
        q: "Why does Go use error values instead of exceptions?",
        a: "Errors are part of a function's signature and must be handled explicitly at each call site, making failure paths visible and local, with no hidden non-local jumps through the stack. That makes code easier to reason about and review, and keeps error handling flexible (errors are just values you can wrap, compare, aggregate). The costs are verbosity (`if err != nil` everywhere) and the possibility of ignoring errors (linters like errcheck help). Panics exist but are reserved for truly exceptional, programmer-error conditions.",
        freq: "very-common",
      },
      {
        q: "What's the difference between errors.Is and errors.As?",
        a: "errors.Is(err, target) reports whether any error in err's chain equals target (or has an Is(target) method returning true); it's for sentinel values like io.EOF or sql.ErrNoRows. errors.As(err, &target) finds the first error in the chain assignable to target's type and sets target to it; it's for custom error types carrying data (e.g. *fs.PathError, *ValidationError). Both traverse wrapping created with %w and errors.Join.",
        freq: "very-common",
      },
      {
        q: "When is panic appropriate in Go?",
        a: "For unrecoverable programmer errors and violated invariants (impossible states), and in 'Must' helpers used during initialization with constant inputs (regexp.MustCompile, template.Must). Not for expected failures (I/O, validation, network): those return errors. Library code should almost never panic across its API boundary. Servers recover panics at request boundaries to keep serving and log the stack; an unrecovered panic in any goroutine terminates the process.",
        freq: "common",
      },
      {
        q: "What makes a good error message in Go?",
        a: "Lowercase, no trailing punctuation, and context-rich: each layer prefixes what it was doing (`load config /etc/app.yaml: open: permission denied`), so the final message reads as a chain from high-level operation to root cause. Include identifiers (ids, paths) but not secrets. Wrap with %w when callers may need the cause; use %v to hide implementation details. Don't log and return the same error.",
      },
    ],
    quiz: [
      {
        q: "Which verb in fmt.Errorf keeps the wrapped error inspectable by errors.Is?",
        options: ["%v", "%s", "%w", "%e"],
        answer: 2,
        explain: "%w wraps; %v only formats the message.",
      },
      {
        q: "Where must recover() be called to stop a panic?",
        options: ["Anywhere in the same function", "Directly inside a deferred function", "In main only", "In an init function"],
        answer: 1,
        explain: "Otherwise it returns nil and does nothing.",
      },
      {
        q: "What happens if a goroutine panics and nothing recovers?",
        options: ["Only that goroutine dies", "The whole program crashes", "The panic is logged and ignored", "main receives an error"],
        answer: 1,
        explain: "Recover inside goroutines you start if they run untrusted work.",
      },
      {
        q: "To check for a *PathError anywhere in a chain, use...",
        options: ["errors.Is(err, &PathError{})", "errors.As(err, &pathErr)", "err.(*PathError)", "err == PathError"],
        answer: 1,
        explain: "As finds by type; a direct type assertion only checks the outer error.",
      },
      {
        q: "A function gets an error from a dependency. It should usually...",
        options: ["Log it and return it", "Return it wrapped with context (or handle it), not both", "Panic", "Ignore it"],
        answer: 1,
        explain: "Logging and returning duplicates logs at every layer.",
      },
    ],
  },

  // ------------------------------------------------------------------ GENERICS
  {
    id: "go-generics",
    stage: "Core",
    title: "Generics and iterators",
    tagline: "Type parameters and constraints (any, comparable, cmp.Ordered, ~int), generic data structures, when not to use generics, and range-over-func iterators (Go 1.23).",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Type parameters (Go 1.18+)
\`\`\`go
func Map[T, U any](xs []T, f func(T) U) []U { ... }
type Stack[T any] struct { items []T }
\`\`\`
Type parameters go in square brackets. Callers usually don't write them: \`Map(names, strings.ToUpper)\` infers \`T\` and \`U\`.

## Constraints are interfaces
A constraint says what a type parameter must support:
| Constraint | Allows |
|---|---|
| \`any\` | Every type (only operations valid for all types: assign, pass around) |
| \`comparable\` | Types supporting \`==\` and \`!=\`: map keys, set members |
| \`cmp.Ordered\` | Types supporting \`<\` \`>\`: integers, floats, strings |
| \`interface{ ~int \\| ~float64 }\` | A **type set**: those types, and (with \`~\`) any type whose underlying type is one of them |
| \`fmt.Stringer\` | Types with a \`String()\` method |

\`~int\` matters for custom types: \`type UserID int\` satisfies \`~int\` but not \`int\`.

## When to use generics
- **Yes**: containers and data structures (sets, stacks, caches, trees), functions over slices, maps and channels (\`Map\`, \`Filter\`, \`Keys\`), algorithms that are identical for many types.
- **No**: when an interface describes behavior better (\`io.Reader\` beats \`func Read[T Reader]\`), or when you have one concrete type. Write the concrete code first; generalize when duplication appears.
- The standard library now has generic packages: \`slices\`, \`maps\`, \`cmp\`, \`iter\`, \`sync/atomic\` types.

Limitations to know: methods can't have their own type parameters (only the type's), and there's no specialization.

## Iterators: range over functions (Go 1.23)
\`for x := range seq\` works when \`seq\` is a function that calls \`yield\` for each value:
\`\`\`go
func Countdown(n int) iter.Seq[int] {
    return func(yield func(int) bool) {
        for i := n; i >= 0; i-- {
            if !yield(i) {     // the loop body ran "break": stop
                return
            }
        }
    }
}
for i := range Countdown(3) { ... }
\`\`\`
- \`iter.Seq[V]\` yields one value per step; \`iter.Seq2[K, V]\` yields two (like index and value).
- Iterators are **lazy** and can be infinite: values are produced as the loop asks for them.
- Standard functions return or accept them: \`maps.Keys(m)\`, \`maps.All(m)\`, \`slices.Values(s)\`, \`slices.Collect(seq)\`, \`slices.Sorted(seq)\`, \`strings.SplitSeq\` and \`strings.Lines\` (Go 1.24).
`,
    keyPoints: [
      "Type parameters in brackets: func F[T any](...), type Box[T any] struct",
      "Constraints are interfaces: any, comparable, cmp.Ordered, type sets",
      "~T includes every type whose underlying type is T",
      "Use generics for containers and slice/map algorithms; interfaces for behavior",
      "Methods can't declare their own type parameters",
      "iter.Seq / iter.Seq2 functions work with for-range (Go 1.23)",
      "Iterators are lazy; return when yield returns false",
    ],
    code: [
      {
        title: "Generic functions and constraints",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "cmp"
    "fmt"
    "strconv"
    "strings"
)

func Map[T, U any](xs []T, f func(T) U) []U {
    out := make([]U, 0, len(xs))
    for _, x := range xs {
        out = append(out, f(x))
    }
    return out
}

func Filter[T any](xs []T, keep func(T) bool) []T {
    var out []T
    for _, x := range xs {
        if keep(x) {
            out = append(out, x)
        }
    }
    return out
}

func Reduce[T, A any](xs []T, initial A, f func(A, T) A) A {
    acc := initial
    for _, x := range xs {
        acc = f(acc, x)
    }
    return acc
}

type Number interface {
    ~int | ~int64 | ~float64 // ~ includes custom types built on these
}

func Sum[T Number](xs []T) T {
    var total T // the zero value of T
    for _, x := range xs {
        total += x
    }
    return total
}

func MaxOf[T cmp.Ordered](first T, rest ...T) T {
    best := first
    for _, x := range rest {
        best = max(best, x)
    }
    return best
}

func IndexOf[T comparable](xs []T, target T) int {
    for i, x := range xs {
        if x == target {
            return i
        }
    }
    return -1
}

type Celsius float64

func main() {
    words := []string{"go", "generics", "are", "handy"}
    lengths := Map(words, func(s string) int { return len(s) }) // T=string, U=int inferred
    fmt.Println(Map(words, strings.ToUpper), lengths)
    fmt.Println(Filter(lengths, func(n int) bool { return n > 2 }))
    fmt.Println(Reduce(words, "", func(acc string, w string) string { return acc + w[:1] }))
    fmt.Println(Map([]int{1, 2, 3}, strconv.Itoa), Sum([]float64{1.5, 2.25}))

    temps := []Celsius{21.5, 19, 23.25} // works thanks to ~float64
    fmt.Printf("total %.2f (type %T)\\n", Sum(temps), Sum(temps))

    fmt.Println(MaxOf(3, 9, 4), MaxOf("pear", "apple", "zucchini"), MaxOf(2.5))
    fmt.Println(IndexOf(words, "are"), IndexOf([]Celsius{1, 2}, 3))
    // Sum([]string{"a"})   // compile error: string does not satisfy Number
}`,
          },
        ],
        output: `[GO GENERICS ARE HANDY] [2 8 3 5]
[8 3 5]
ggah
[1 2 3] 3.75
total 63.75 (type main.Celsius)
9 zucchini 2.5
2 -1`,
        explain: `- Type arguments are **inferred** from the arguments in every call here.
- \`Sum(temps)\` returns a \`Celsius\`, not a \`float64\`: generic code preserves your types.
- \`var total T\` gives the zero value of whatever \`T\` is.
- \`MaxOf\` uses the built-in \`max\`, which works on any ordered type.
- The commented-out line shows the payoff of constraints: the error appears at the call site, in plain words.`,
      },
      {
        title: "Generic data structures: Stack, Set and Pair",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "cmp"
    "fmt"
    "maps"
    "slices"
)

type Stack[T any] struct {
    items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

func (s *Stack[T]) Pop() (T, bool) {
    var zero T
    if len(s.items) == 0 {
        return zero, false // can't return nil for an arbitrary T: return its zero value
    }
    v := s.items[len(s.items)-1]
    s.items = s.items[:len(s.items)-1]
    return v, true
}

func (s *Stack[T]) Len() int { return len(s.items) }

type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
    s := Set[T]{}
    for _, it := range items {
        s.Add(it)
    }
    return s
}
func (s Set[T]) Add(v T)           { s[v] = struct{}{} }
func (s Set[T]) Has(v T) bool      { _, ok := s[v]; return ok }
func (s Set[T]) Intersect(o Set[T]) Set[T] {
    out := Set[T]{}
    for v := range s {
        if o.Has(v) {
            out.Add(v)
        }
    }
    return out
}

// A function, not a method: methods can't add constraints, and sorting needs cmp.Ordered.
func Sorted[T cmp.Ordered](s Set[T]) []T { return slices.Sorted(maps.Keys(s)) }

type Pair[K comparable, V any] struct {
    Key K
    Val V
}

func (p Pair[K, V]) String() string { return fmt.Sprintf("%v=%v", p.Key, p.Val) }

func main() {
    var ints Stack[int] // the zero value is ready to use
    for i := range 3 {
        ints.Push(i * 10)
    }
    top, _ := ints.Pop()
    fmt.Println("popped", top, "left", ints.Len())

    names := &Stack[string]{}
    _, ok := names.Pop()
    fmt.Println("pop from empty:", ok)

    backend := NewSet("go", "java", "python", "rust")
    systems := NewSet("c", "cpp", "go", "rust", "zig")
    fmt.Println("both:", Sorted(backend.Intersect(systems)), "| has java:", backend.Has("java"))

    pairs := []Pair[string, int]{{"b", 2}, {"a", 1}, {"c", 3}}
    slices.SortFunc(pairs, func(x, y Pair[string, int]) int { return cmp.Compare(x.Key, y.Key) })
    fmt.Println(pairs)
}`,
          },
        ],
        output: `popped 20 left 2
pop from empty: false
both: [go rust] | has java: true
[a=1 b=2 c=3]`,
        explain: `- \`Stack[T]\` is instantiated for each element type you use: \`Stack[int]\` and \`Stack[string]\` are distinct types.
- \`Set[T]\` is a generic **map type** with methods; \`comparable\` is required because map keys need \`==\`.
- \`Sorted\` is a standalone function because it needs a stronger constraint (\`cmp.Ordered\`) than the type's own (\`comparable\`), and Go methods can't add constraints or type parameters.`,
      },
      {
        title: "Iterators: range over functions (Go 1.23+)",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "iter"
    "maps"
    "slices"
    "strings"
)

func Countdown(n int) iter.Seq[int] {
    return func(yield func(int) bool) {
        for i := n; i >= 0; i-- {
            if !yield(i) { // false means the loop body did "break": stop producing
                return
            }
        }
    }
}

func Fibonacci() iter.Seq[int] { // infinite: only safe because the consumer breaks
    return func(yield func(int) bool) {
        a, b := 0, 1
        for {
            if !yield(a) {
                return
            }
            a, b = b, a+b
        }
    }
}

// Filter and Take are lazy adapters: nothing runs until someone ranges over the result.
func Filter[T any](seq iter.Seq[T], keep func(T) bool) iter.Seq[T] {
    return func(yield func(T) bool) {
        for v := range seq {
            if keep(v) && !yield(v) {
                return
            }
        }
    }
}

func Take[T any](seq iter.Seq[T], n int) iter.Seq[T] {
    return func(yield func(T) bool) {
        if n <= 0 {
            return
        }
        count := 0
        for v := range seq {
            if !yield(v) {
                return
            }
            count++
            if count == n {
                return
            }
        }
    }
}

type Playlist struct{ songs []string }

func (p *Playlist) All() iter.Seq2[int, string] { // two values per step, like index and element
    return func(yield func(int, string) bool) {
        for i, s := range p.songs {
            if !yield(i+1, s) {
                return
            }
        }
    }
}

func main() {
    for i := range Countdown(3) {
        fmt.Print(i, " ")
    }
    fmt.Println("liftoff")

    evenFibs := Take(Filter(Fibonacci(), func(n int) bool { return n%2 == 0 }), 5)
    fmt.Println("first 5 even Fibonacci numbers:", slices.Collect(evenFibs))

    p := &Playlist{songs: []string{"Intro", "Main theme", "Finale"}}
    for n, song := range p.All() {
        fmt.Printf("%d. %s\\n", n, song)
    }

    stock := map[string]int{"pear": 3, "apple": 7, "kiwi": 0}
    fmt.Println("sorted keys:", slices.Sorted(maps.Keys(stock)))
    for word := range strings.FieldsSeq("lazy  splitting   without a slice") { // Go 1.24
        fmt.Print("[", word, "]")
    }
    fmt.Println()
}`,
          },
        ],
        output: `3 2 1 0 liftoff
first 5 even Fibonacci numbers: [0 2 8 34 144]
1. Intro
2. Main theme
3. Finale
sorted keys: [apple kiwi pear]
[lazy][splitting][without][a][slice]`,
        explain: `- The compiler rewrites \`for v := range seq { body }\` into a call to \`seq\` with a \`yield\` function containing your loop body. \`break\` makes \`yield\` return \`false\`, and a well-behaved iterator must then return.
- \`Fibonacci\` is infinite, yet the pipeline finishes: \`Take\` stops asking after 5 values. Laziness, like Java streams or Python generators.
- \`slices.Collect\` drains an iterator into a slice. \`maps.Keys\` returns an iterator (not a slice), and \`slices.Sorted\` collects and sorts it.`,
      },
    ],
    interview: [
      {
        q: "When should you use generics vs interfaces in Go?",
        a: "Use interfaces when you need behavior polymorphism: different types doing different things through the same methods (io.Reader, http.Handler). Use generics when the code is the same for many types and you want type safety without boxing: containers (Set[T], Cache[K,V]), algorithms over slices/maps/channels (Map, Filter, Max), and avoiding `any` plus type assertions. If you'd write a function taking an interface and only call its methods, keep the interface; if you'd copy-paste the same code for int and string, consider generics.",
        freq: "common",
      },
      {
        q: "What does the ~ in a constraint mean?",
        a: "~T denotes the set of all types whose underlying type is T. `interface{ ~int }` is satisfied by int and by defined types like `type UserID int` or `type Celsius float64` (for ~float64). Without ~, only the exact type matches. Constraints with type sets enable operators (+, <) inside generic functions, because every type in the set supports them.",
        freq: "common",
      },
      {
        q: "How do range-over-func iterators work?",
        a: "Since Go 1.23, for-range accepts functions of the form func(yield func(V) bool) (iter.Seq[V]) or with two values (iter.Seq2[K, V]). The compiler turns the loop body into the yield callback; the iterator calls yield for each value and must stop when yield returns false (the loop executed break or return). This gives a standard, lazy, composable iteration protocol for custom collections and adapters, used by maps.Keys, slices.Values, strings.SplitSeq and others. Pull-style iteration is available via iter.Pull.",
      },
      {
        q: "What are some limitations of Go generics?",
        a: "Methods can't have their own type parameters; there's no specialization or overloading per type; you can't use a type parameter's methods unless the constraint declares them; type switches on type parameters require converting to any first; and some operations (like ranging over a type parameter constrained by a mixed type set) are restricted. The implementation (GC shape stenciling with dictionaries) can make generic code slightly slower than hand-written concrete code in some cases.",
      },
    ],
    quiz: [
      {
        q: "Which constraint is required for a generic Set using map keys?",
        options: ["any", "comparable", "cmp.Ordered", "fmt.Stringer"],
        answer: 1,
        explain: "Map keys need ==.",
      },
      {
        q: "type UserID int. Does it satisfy interface{ int }?",
        options: ["Yes", "No, but it satisfies interface{ ~int }", "Only with a conversion", "Neither"],
        answer: 1,
        explain: "~int includes types whose underlying type is int.",
      },
      {
        q: "What should a Pop() method of Stack[T] return when the stack is empty?",
        options: ["nil", "The zero value of T and false", "A panic always", "-1"],
        answer: 1,
        explain: "nil isn't valid for every T.",
      },
      {
        q: "In an iter.Seq, what must the iterator do when yield returns false?",
        options: ["Call yield again", "Stop and return", "Panic", "Restart"],
        answer: 1,
        explain: "The loop body broke out; producing more values is an error.",
      },
      {
        q: "Can a method declare its own type parameters?",
        options: ["Yes", "No: only the receiver type's parameters", "Only on pointer receivers", "Only in Go 1.24"],
        answer: 1,
        explain: "Use a top-level generic function instead.",
      },
    ],
  },

  // ------------------------------------------------------------------ TESTING
  {
    id: "go-testing",
    stage: "Core",
    title: "Testing, benchmarks and fuzzing",
    tagline: "The built-in testing package: table-driven tests, subtests, helpers, fakes via interfaces, httptest, benchmarks with b.Loop, fuzzing, examples and coverage.",
    difficulty: "intermediate",
    minutes: 35,
    concept: `
## Testing is built in
Tests live next to the code in files ending with \`_test.go\` and are run by \`go test\`. No framework needed:
\`\`\`go
func TestSlugify(t *testing.T) {          // name starts with Test, takes *testing.T
    got := Slugify("Hello, World!")
    if got != "hello-world" {
        t.Errorf("Slugify() = %q, want %q", got, "hello-world")   // record failure, keep going
    }
}
\`\`\`
- \`t.Errorf\` / \`t.Error\` mark failure and continue; \`t.Fatalf\` / \`t.Fatal\` stop this test (use when continuing makes no sense).
- Write messages as \`got X, want Y\`: they must explain the failure without reading the test.

## Table-driven tests: the Go idiom
Put cases in a slice of structs and loop, running each as a **subtest** with \`t.Run(name, ...)\`:
- Adding a case is one line; each case reports separately; \`go test -run 'TestSlugify/unicode'\` runs one.
- \`t.Parallel()\` runs subtests concurrently.
- \`t.Helper()\` in helper functions makes failures point at the caller's line.
- \`t.Cleanup(func(){...})\`, \`t.TempDir()\`, \`t.Setenv()\` and (Go 1.24) \`t.Context()\` manage test resources.

## Fakes over mocks
Because interfaces are implicit and small, the easiest test double is a **hand-written fake** that implements the interface your code accepts: an in-memory store, a fixed clock, a recording notifier. Mock-generation tools (gomock, mockery) exist, but fakes usually produce clearer tests. **testify** (\`assert\`/\`require\`) is a popular, optional assertion library.

## HTTP code: net/http/httptest
- \`httptest.NewRecorder()\` + \`handler.ServeHTTP(rec, req)\` tests a handler without a network.
- \`httptest.NewServer(handler)\` starts a real server on a random local port for client code.

## Benchmarks, fuzzing, examples
- **Benchmarks**: \`func BenchmarkX(b *testing.B)\`, run with \`go test -bench=. -benchmem\`. Go 1.24's \`for b.Loop() { ... }\` handles timing and keeps the compiler from optimizing your code away.
- **Fuzzing** (Go 1.18): \`func FuzzX(f *testing.F)\` feeds random, mutated inputs to find crashes and broken invariants. Failing inputs are saved under \`testdata/fuzz\` and become regression tests.
- **Examples**: \`func ExampleSlugify()\` with an \`// Output:\` comment is compiled, run as a test and shown in the documentation.

## Useful flags
\`-v\` verbose, \`-run regex\`, \`-race\` data race detector, \`-cover\` / \`-coverprofile=c.out\` coverage, \`-count=1\` disable caching, \`-short\` skip slow tests, \`-shuffle=on\` random order.
`,
    keyPoints: [
      "Tests are TestXxx(t *testing.T) functions in _test.go files",
      "Table-driven tests + t.Run subtests are the Go idiom",
      "Failure messages: got X, want Y",
      "t.Helper, t.Cleanup, t.TempDir, t.Parallel manage tests",
      "Prefer small interfaces + hand-written fakes to mocks",
      "httptest.NewRecorder and NewServer test HTTP code",
      "Benchmarks (b.Loop), fuzz tests and examples are built in",
      "Run go test -race in CI",
    ],
    code: [
      {
        title: "A table-driven test with subtests and a helper",
        variants: [
          {
            lang: "go",
            code: `// slug/slug.go
package slug

import (
    "strings"
    "unicode"
)

// Slugify turns a title into a URL-friendly slug: "Hello, World!" -> "hello-world".
func Slugify(title string) string {
    var b strings.Builder
    pendingDash := false
    for _, r := range strings.ToLower(title) {
        switch {
        case unicode.IsLetter(r) || unicode.IsDigit(r):
            if pendingDash && b.Len() > 0 {
                b.WriteByte('-')
            }
            b.WriteRune(r)
            pendingDash = false
        default:
            pendingDash = true // collapse any run of other characters into one dash
        }
    }
    return b.String()
}`,
          },
          {
            lang: "go",
            code: `// slug/slug_test.go
package slug

import "testing"

func TestSlugify(t *testing.T) {
    tests := []struct {
        name  string
        input string
        want  string
    }{
        {"simple", "Hello World", "hello-world"},
        {"punctuation", "Hello, World!", "hello-world"},
        {"repeated separators", "Go  --  is   fun", "go-is-fun"},
        {"leading and trailing", "  ~Go 1.24~  ", "go-1-24"},
        {"unicode letters", "Café Ünïcode", "café-ünïcode"},
        {"empty", "", ""},
        {"only symbols", "!!!", ""},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel() // subtests run concurrently (each tt is a fresh variable since Go 1.22)
            assertEqual(t, Slugify(tt.input), tt.want)
        })
    }
}

func assertEqual(t *testing.T, got, want string) {
    t.Helper() // failures are reported at the caller's line
    if got != want {
        t.Errorf("got %q, want %q", got, want)
    }
}`,
          },
        ],
        explain: `Run it with \`go test ./slug -v\`:
\`\`\`text
=== RUN   TestSlugify
=== RUN   TestSlugify/simple
=== PAUSE TestSlugify/simple
...
--- PASS: TestSlugify (0.00s)
    --- PASS: TestSlugify/simple (0.00s)
    --- PASS: TestSlugify/punctuation (0.00s)
    ...
PASS
ok      example.com/app/slug    0.004s
\`\`\`
- The test file uses \`package slug\`, so it can test unexported code too. Use \`package slug_test\` (a "black-box" test) to test only the public API.
- Before Go 1.22, \`tt\` was one variable shared by all iterations, and parallel subtests would all see the last case. Since 1.22 each iteration has its own variable. You'll still see \`tt := tt\` in older code.
- \`go test -run 'TestSlugify/unicode' -v\` runs a single case.`,
      },
      {
        title: "Fakes via interfaces, and testing HTTP handlers with httptest",
        variants: [
          {
            lang: "go",
            code: `// greeter/greeter.go
package greeter

import (
    "encoding/json"
    "net/http"
    "time"
)

type Clock interface{ Now() time.Time } // a one-method interface: trivial to fake

type Greeter struct{ Clock Clock }

func (g Greeter) Greeting(name string) string {
    switch h := g.Clock.Now().Hour(); {
    case h < 12:
        return "Good morning, " + name
    case h < 18:
        return "Good afternoon, " + name
    default:
        return "Good evening, " + name
    }
}

func (g Greeter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    if name == "" {
        http.Error(w, \`{"error":"name is required"}\`, http.StatusBadRequest)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"greeting": g.Greeting(name)})
}`,
          },
          {
            lang: "go",
            code: `// greeter/greeter_test.go
package greeter

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    "time"
)

type fixedClock struct{ t time.Time } // the fake

func (c fixedClock) Now() time.Time { return c.t }

func at(hour int) fixedClock {
    return fixedClock{time.Date(2026, 11, 3, hour, 0, 0, 0, time.UTC)}
}

func TestGreeting(t *testing.T) {
    cases := map[int]string{9: "Good morning, Ada", 14: "Good afternoon, Ada", 21: "Good evening, Ada"}
    for hour, want := range cases {
        if got := (Greeter{Clock: at(hour)}).Greeting("Ada"); got != want {
            t.Errorf("at %d:00 got %q, want %q", hour, got, want)
        }
    }
}

func TestServeHTTP(t *testing.T) {
    g := Greeter{Clock: at(9)}

    rec := httptest.NewRecorder() // records status, headers and body
    g.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/greet?name=Grace", nil))
    if rec.Code != http.StatusOK {
        t.Fatalf("status = %d, want 200", rec.Code)
    }
    if got := strings.TrimSpace(rec.Body.String()); got != \`{"greeting":"Good morning, Grace"}\` {
        t.Errorf("body = %s", got)
    }

    rec = httptest.NewRecorder()
    g.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/greet", nil))
    if rec.Code != http.StatusBadRequest {
        t.Errorf("missing name: status = %d, want 400", rec.Code)
    }
}

func TestOverRealHTTP(t *testing.T) {
    srv := httptest.NewServer(Greeter{Clock: at(20)}) // a real server on 127.0.0.1:<random port>
    defer srv.Close()
    res, err := http.Get(srv.URL + "?name=Linus")
    if err != nil {
        t.Fatal(err)
    }
    defer res.Body.Close()
    if res.Header.Get("Content-Type") != "application/json" {
        t.Errorf("content type = %q", res.Header.Get("Content-Type"))
    }
}`,
          },
        ],
        explain: `- \`Greeter\` depends on a \`Clock\` **interface**, so the test controls time with a tiny fake. Code that calls \`time.Now()\` directly is hard to test.
- \`httptest.NewRecorder\` tests the handler as a plain function call: no ports, no flakiness, and very fast.
- \`httptest.NewServer\` is for testing **clients** or full stacks: it serves on a random free port and \`srv.URL\` tells you where.
- \`http.Error\` sets the status and writes the body (as \`text/plain\`); real APIs usually use a small JSON error helper instead.`,
      },
      {
        title: "Benchmarks, fuzzing and runnable examples",
        variants: [
          {
            lang: "go",
            code: `// slug/slug_extra_test.go
package slug

import (
    "fmt"
    "strings"
    "testing"
    "unicode/utf8"
)

func BenchmarkSlugify(b *testing.B) {
    title := strings.Repeat("The Quick Brown Fox! ", 20)
    for b.Loop() { // Go 1.24: times the loop and stops the compiler from optimizing the call away
        Slugify(title)
    }
}

func FuzzSlugify(f *testing.F) {
    for _, seed := range []string{"Hello, World!", "  ", "Café", "a--b"} {
        f.Add(seed) // seed corpus
    }
    f.Fuzz(func(t *testing.T, input string) {
        out := Slugify(input)
        if !utf8.ValidString(input) {
            return // skip invalid UTF-8 inputs
        }
        if strings.HasPrefix(out, "-") || strings.HasSuffix(out, "-") || strings.Contains(out, "--") {
            t.Errorf("Slugify(%q) = %q: bad dashes", input, out) // an invariant, not a fixed answer
        }
        if Slugify(out) != out {
            t.Errorf("Slugify is not idempotent for %q", input)
        }
    })
}

func ExampleSlugify() { // compiled, run by go test, and shown in the docs
    fmt.Println(Slugify("Go: Up & Running"))
    // Output: go-up-running
}`,
          },
          {
            lang: "bash",
            code: `go test ./... -v                       # all tests, verbose
go test ./slug -run 'TestSlugify/unicode'   # one subtest
go test ./... -race -count=1           # race detector, bypass the test cache
go test ./... -cover                   # coverage percentage per package
go test ./... -coverprofile=c.out && go tool cover -html=c.out   # see uncovered lines

go test ./slug -bench=. -benchmem      # benchmarks with allocation stats
# BenchmarkSlugify-11   465710   2510 ns/op   1464 B/op   8 allocs/op   (numbers vary by machine)

go test ./slug -fuzz=FuzzSlugify -fuzztime=30s   # fuzz for 30 seconds
# failing inputs are saved in testdata/fuzz/FuzzSlugify/ and re-run by plain go test`,
          },
        ],
        explain: `- A benchmark reports time per operation (\`ns/op\`) and, with \`-benchmem\`, bytes and allocations per operation. Compare runs with \`benchstat\` before claiming a speed-up.
- The fuzz test checks **properties** that must hold for every input (no leading, trailing or double dashes; running it twice changes nothing) rather than exact outputs.
- \`Example\` functions double as documentation that can't go stale: \`go test\` fails if the printed output doesn't match the \`// Output:\` comment.`,
      },
    ],
    interview: [
      {
        q: "What is a table-driven test and why is it idiomatic in Go?",
        a: "A test that defines its cases as a slice (or map) of structs with inputs and expected outputs, then loops over them, usually running each as a named subtest with t.Run. Benefits: adding cases is trivial, the test logic is written once, each case reports independently with its own name, cases can run in parallel and be selected with -run. It fits Go's preference for plain code over assertion DSLs.",
        freq: "very-common",
      },
      {
        q: "How do you mock dependencies in Go?",
        a: "Depend on small interfaces defined at the consumer (e.g. a Store or Clock interface) and inject implementations. In tests, pass a hand-written fake (an in-memory store, a fixed clock, a recording sender), which is often clearer than generated mocks. For HTTP, use httptest.NewServer to fake external services. Generated mocks (gomock, mockery) help when you need to assert specific call sequences. Avoid global state and package-level functions like time.Now() in code you want to test.",
        freq: "common",
      },
      {
        q: "t.Error vs t.Fatal?",
        a: "t.Error/t.Errorf mark the test failed and continue running it, so you see all failures at once. t.Fatal/t.Fatalf mark it failed and stop the test immediately (via runtime.Goexit), which is right when later code would be meaningless or panic (e.g. a nil response). t.Fatal must be called from the test's goroutine, not from goroutines it starts.",
      },
      {
        q: "What does go test -race do?",
        a: "Builds the code with the race detector (ThreadSanitizer instrumentation) that records memory accesses and synchronization events at run time and reports data races: two goroutines accessing the same variable concurrently with at least one write and no happens-before ordering. It only finds races that actually happen during the run, so it needs tests that exercise concurrency. It slows execution (2-20x) and uses more memory, so it's typically run in CI rather than production.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which file name makes go test pick up tests?",
        options: ["test_slug.go", "slug_test.go", "slug.test.go", "tests/slug.go"],
        answer: 1,
        explain: "Files ending in _test.go are only compiled for tests.",
      },
      {
        q: "What does t.Helper() change?",
        options: ["Runs the function in parallel", "Reports failures at the caller's line", "Skips the test", "Adds a timeout"],
        answer: 1,
        explain: "Makes helper-based failures point to the right place.",
      },
      {
        q: "How do you test an http.Handler without opening a port?",
        options: ["httptest.NewRecorder + ServeHTTP", "http.ListenAndServe", "curl", "net.Dial"],
        answer: 0,
        explain: "The recorder captures the response in memory.",
      },
      {
        q: "What does an Example function's `// Output:` comment do?",
        options: ["Nothing", "go test checks the printed output matches it", "It's a TODO", "Sets the log level"],
        answer: 1,
        explain: "Examples are executable documentation.",
      },
      {
        q: "What does fuzzing look for?",
        options: ["Slow code", "Inputs that crash the code or break stated properties", "Unused variables", "Data races"],
        answer: 1,
        explain: "Crashing inputs are saved as regression tests.",
      },
    ],
  },

  // ------------------------------------------------------------------ STANDARD LIBRARY
  {
    id: "go-stdlib",
    stage: "Core",
    title: "The standard library: JSON, time, files and logging",
    tagline: "encoding/json in depth, time and its reference-date layouts, reading and writing files with os, bufio and filepath, and structured logging with log/slog.",
    difficulty: "intermediate",
    minutes: 40,
    concept: `
## A batteries-included standard library
Go teams use the standard library for far more than in most languages: HTTP servers and clients, JSON, templates, crypto, compression, SQL interfaces, testing, structured logging and profiling all ship with Go and are stable for years (the **Go 1 compatibility promise**).

## encoding/json
- \`json.Marshal(v)\` / \`json.Unmarshal(data, &v)\`; \`json.NewEncoder(w)\` / \`json.NewDecoder(r)\` for streams (HTTP bodies, files, NDJSON).
- Only **exported** fields are encoded. Tags rename fields and set options: \`json:"name"\`, \`json:"name,omitempty"\`, \`json:"-"\`, \`json:",string"\`; Go 1.24 adds \`omitzero\` (omits zero structs and \`time.Time\`).
- Unknown JSON fields are **ignored** by default; \`decoder.DisallowUnknownFields()\` rejects them (good for APIs).
- Decoding into \`any\` gives \`map[string]any\`, \`[]any\`, \`string\`, \`bool\`, \`nil\`, and **\`float64\` for every number**. Use \`decoder.UseNumber()\` or proper structs.
- Custom encoding: implement \`MarshalJSON\`/\`UnmarshalJSON\` (or \`MarshalText\`/\`UnmarshalText\`).
- Go 1.25 added an experimental, faster \`encoding/json/v2\` (enable with \`GOEXPERIMENT=jsonv2\`).

## time
- \`time.Time\` is an instant with a location; \`time.Duration\` is an \`int64\` of nanoseconds (\`90 * time.Minute\`).
- **Layouts use a reference date** instead of \`%Y-%m-%d\` codes: \`Mon Jan 2 15:04:05 MST 2006\` (1 2 3 4 5 6 7 in order: month 1, day 2, hour 15 = 3 PM, minute 4, second 5, year 2006, zone -0700). So \`"2006-01-02"\` means YYYY-MM-DD. Prefer constants like \`time.RFC3339\` and \`time.DateOnly\`.
- Compare with \`Before\`/\`After\`/\`Equal\` (not \`==\`); \`time.Now()\` includes a **monotonic clock reading**, so measuring with \`time.Since(start)\` is safe even if the wall clock changes.
- Store and transmit times in UTC (RFC 3339); convert to a location only for display.

## Files and I/O
\`os.ReadFile\`/\`os.WriteFile\` for small files; \`os.Open\`/\`os.Create\`/\`os.OpenFile\` + \`bufio.Scanner\`/\`bufio.Writer\` for streaming; \`filepath.Join\`, \`filepath.WalkDir\`, \`os.MkdirAll\`, \`os.MkdirTemp\`; check \`errors.Is(err, fs.ErrNotExist)\`. \`//go:embed\` bundles files into the binary (templates, static assets, migrations). Go 1.24's \`os.Root\` restricts file access to a directory, preventing path traversal.

## log/slog: structured logging (Go 1.21)
\`slog.Info("order placed", "order_id", 42, "total", 99.5)\` produces key-value records; \`slog.NewJSONHandler\` emits JSON for log aggregators, \`NewTextHandler\` emits \`key=value\` for humans. \`logger.With("request_id", id)\` attaches context to every line. Levels: Debug, Info, Warn, Error.
`,
    keyPoints: [
      "json: only exported fields; tags rename and omit; decode into structs, not any",
      "DisallowUnknownFields for strict APIs; numbers in any become float64",
      "time layouts use the reference date Mon Jan 2 15:04:05 MST 2006",
      "Durations are typed: 90 * time.Minute; compare times with Before/After/Equal",
      "os.ReadFile/WriteFile for small files; bufio for streams; filepath for paths",
      "errors.Is(err, fs.ErrNotExist) checks for missing files",
      "log/slog gives structured, leveled logs with text or JSON handlers",
    ],
    code: [
      {
        title: "encoding/json: tags, custom marshaling, strict and streaming decoding",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "strconv"
    "strings"
    "time"
)

type Money int64 // cents

func (m Money) MarshalJSON() ([]byte, error) { // encode as a decimal string: "12.50"
    return []byte(strconv.Quote(fmt.Sprintf("%d.%02d", m/100, m%100))), nil
}

func (m *Money) UnmarshalJSON(data []byte) error {
    s, err := strconv.Unquote(string(data))
    if err != nil {
        return fmt.Errorf("money must be a string like \\"12.50\\": %w", err)
    }
    whole, frac, _ := strings.Cut(s, ".")
    cents, err := strconv.ParseInt(whole+(frac+"00")[:2], 10, 64)
    if err != nil {
        return fmt.Errorf("invalid money %q", s)
    }
    *m = Money(cents)
    return nil
}

type Item struct {
    SKU      string \`json:"sku"\`
    Quantity int    \`json:"qty"\`
    Price    Money  \`json:"price"\`
}

type Order struct {
    ID       int               \`json:"id"\`
    Customer string            \`json:"customer"\`
    Items    []Item            \`json:"items"\`
    PlacedAt time.Time         \`json:"placed_at"\`
    Notes    string            \`json:"notes,omitempty"\`
    Meta     map[string]string \`json:"meta,omitempty"\`
}

func main() {
    order := Order{
        ID: 1001, Customer: "ada",
        Items:    []Item{{"BOOK-1", 2, 1250}, {"PEN-7", 1, 199}},
        PlacedAt: time.Date(2026, 11, 3, 14, 30, 0, 0, time.UTC),
    }
    pretty, _ := json.MarshalIndent(order, "", "  ")
    fmt.Println(string(pretty))

    var back Order
    if err := json.Unmarshal(pretty, &back); err != nil {
        fmt.Println("error:", err)
    }
    fmt.Println("round trip:", back.Items[0].Price == 1250, back.PlacedAt.Equal(order.PlacedAt))

    strict := json.NewDecoder(strings.NewReader(\`{"id": 1, "customer": "x", "discount": 5}\`))
    strict.DisallowUnknownFields()
    var o Order
    fmt.Println("strict decode:", strict.Decode(&o))

    var loose map[string]any
    _ = json.Unmarshal([]byte(\`{"count": 3, "tags": ["a", "b"], "ok": true}\`), &loose)
    fmt.Printf("decoded into any: count is %T, tags is %T\\n", loose["count"], loose["tags"])

    var bad Item
    err := json.Unmarshal([]byte(\`{"sku": "X", "qty": "two"}\`), &bad)
    var typeErr *json.UnmarshalTypeError
    if errors.As(err, &typeErr) {
        fmt.Printf("type error: field %q expected %v\\n", typeErr.Field, typeErr.Type)
    }

    stream := json.NewDecoder(strings.NewReader("{\\"sku\\":\\"A\\",\\"qty\\":1,\\"price\\":\\"1.00\\"}\\n{\\"sku\\":\\"B\\",\\"qty\\":3,\\"price\\":\\"0.5\\"}\\n"))
    for {
        var it Item
        if err := stream.Decode(&it); err == io.EOF {
            break
        } else if err != nil {
            fmt.Println("error:", err)
            break
        }
        fmt.Printf("streamed %s x%d at %d cents\\n", it.SKU, it.Quantity, it.Price)
    }
}`,
          },
        ],
        output: `{
  "id": 1001,
  "customer": "ada",
  "items": [
    {
      "sku": "BOOK-1",
      "qty": 2,
      "price": "12.50"
    },
    {
      "sku": "PEN-7",
      "qty": 1,
      "price": "1.99"
    }
  ],
  "placed_at": "2026-11-03T14:30:00Z"
}
round trip: true true
strict decode: json: unknown field "discount"
decoded into any: count is float64, tags is []interface {}
type error: field "qty" expected int
streamed A x1 at 100 cents
streamed B x3 at 50 cents`,
        explain: `- \`Money\` controls its own JSON format by implementing \`json.Marshaler\` and \`json.Unmarshaler\`. Representing money as a decimal string avoids floating-point surprises in JavaScript clients.
- \`time.Time\` marshals as RFC 3339 automatically. \`notes\` and \`meta\` disappear thanks to \`omitempty\`.
- \`DisallowUnknownFields\` turns a typo in a client's request into a clear error instead of silently ignoring it.
- Decoding into \`any\` makes every number a \`float64\`, which loses precision above 2^53. Decode into structs.
- A \`json.Decoder\` reads values one after another from a stream: perfect for NDJSON logs or large files.`,
      },
      {
        title: "time: layouts, durations, zones and measuring",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "time"
)

func main() {
    t := time.Date(2026, time.November, 3, 14, 30, 0, 0, time.UTC)
    fmt.Println(t.Format(time.RFC3339))               // the format for APIs and storage
    fmt.Println(t.Format("Mon Jan 2 2006, 3:04 PM"))   // layouts are written with the reference date
    fmt.Println(t.Format(time.DateOnly), t.Weekday(), "day", t.YearDay())

    christmas, err := time.Parse(time.DateOnly, "2026-12-25")
    if err != nil {
        fmt.Println(err)
        return
    }
    until := christmas.Sub(t)
    fmt.Printf("until Christmas: %v (%.0f days)\\n", until, until.Hours()/24)

    meeting := 90 * time.Minute
    fmt.Println(meeting, meeting.Hours(), meeting.Minutes())
    fmt.Println("in 36h:", t.Add(36*time.Hour).Format(time.DateTime))
    fmt.Println("one month later:", t.AddDate(0, 1, 0).Format(time.DateOnly))
    fmt.Println("truncated to the day:", t.Truncate(24*time.Hour).Format(time.RFC3339))
    fmt.Println("before Christmas?", t.Before(christmas), "| equal to itself in another zone?", t.Equal(t.In(time.FixedZone("UTC+2", 2*3600))))

    if ny, err := time.LoadLocation("America/New_York"); err == nil { // uses the system's zone database
        fmt.Println("in New York:", t.In(ny).Format("2006-01-02 15:04 MST"))
    }

    d, _ := time.ParseDuration("1h15m30s")
    fmt.Println("parsed duration:", d, "=", d.Seconds(), "seconds")

    start := time.Now() // includes a monotonic reading: safe for measuring
    time.Sleep(15 * time.Millisecond)
    fmt.Println("slept at least 15ms:", time.Since(start) >= 15*time.Millisecond)

    select {
    case <-time.After(10 * time.Millisecond): // a timeout channel
        fmt.Println("timed out waiting, as expected")
    case <-make(chan struct{}): // never ready
    }
}`,
          },
        ],
        output: `2026-11-03T14:30:00Z
Tue Nov 3 2026, 2:30 PM
2026-11-03 Tuesday day 307
until Christmas: 1233h30m0s (51 days)
1h30m0s 1.5 90
in 36h: 2026-11-05 02:30:00
one month later: 2026-12-03
truncated to the day: 2026-11-03T00:00:00Z
before Christmas? true | equal to itself in another zone? true
in New York: 2026-11-03 09:30 EST
parsed duration: 1h15m30s = 4530 seconds
slept at least 15ms: true
timed out waiting, as expected`,
        explain: `- The layout \`"Mon Jan 2 2006, 3:04 PM"\` is literally how the reference moment would print. Memorize it as 01/02 03:04:05 PM '06 -0700.
- \`Sub\` returns a \`Duration\`; there's no "days" unit because days vary in length with DST, so we divide hours by 24 for display.
- \`Equal\` compares instants regardless of location; \`==\` compares the struct, including the location, and is almost always wrong for times.
- New York is on EST (UTC-5) because daylight saving time ended on November 1, 2026. In minimal containers, \`LoadLocation\` needs the zone database: install \`tzdata\` or \`import _ "time/tzdata"\` to embed it.
- \`time.After\` in a \`select\` is the classic timeout; the concurrency chapters use it heavily.`,
      },
      {
        title: "Files: read, write, scan, walk; and structured logs with slog",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "bufio"
    "errors"
    "fmt"
    "io/fs"
    "log/slog"
    "os"
    "path/filepath"
    "strings"
    "time"
)

func main() {
    dir, err := os.MkdirTemp("", "files-demo") // a fresh temporary directory
    if err != nil {
        fmt.Println(err)
        return
    }
    defer os.RemoveAll(dir)

    path := filepath.Join(dir, "notes.txt") // the right separator on every OS
    if err := os.WriteFile(path, []byte("first line\\nsecond line\\n"), 0o644); err != nil {
        fmt.Println(err)
        return
    }
    f, _ := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o644)
    w := bufio.NewWriter(f) // buffer small writes
    fmt.Fprintln(w, "third line")
    w.Flush() // don't forget, or the data stays in the buffer
    f.Close()

    in, _ := os.Open(path)
    sc := bufio.NewScanner(in) // line by line, without loading the whole file
    for n := 1; sc.Scan(); n++ {
        fmt.Printf("%d: %s\\n", n, sc.Text())
    }
    in.Close()

    _ = os.MkdirAll(filepath.Join(dir, "logs", "2026"), 0o755)
    _ = os.WriteFile(filepath.Join(dir, "logs", "2026", "nov.log"), []byte("ok\\n"), 0o644)
    _ = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error { // lexical order
        if err != nil {
            return err
        }
        rel, _ := filepath.Rel(dir, p)
        if d.IsDir() {
            rel += "/"
        }
        fmt.Println("  ", rel)
        return nil
    })

    info, _ := os.Stat(path)
    fmt.Println("size:", info.Size(), "| ext:", filepath.Ext(path), "| base:", filepath.Base(path))
    _, err = os.ReadFile(filepath.Join(dir, "missing.txt"))
    fmt.Println("missing file is ErrNotExist:", errors.Is(err, fs.ErrNotExist))

    // Structured logging. Dropping the time attribute keeps this output stable.
    noTime := func(groups []string, a slog.Attr) slog.Attr {
        if a.Key == slog.TimeKey && len(groups) == 0 {
            return slog.Attr{}
        }
        return a
    }
    text := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug, ReplaceAttr: noTime}))
    text.Info("server started", "port", 8080, "env", "dev")
    reqLog := text.With("request_id", "req-7f3a") // attached to every line from reqLog
    reqLog.Warn("slow request", "path", "/orders", slog.Duration("took", 1500*time.Millisecond),
        slog.Group("user", "id", 42, "plan", "pro"))
    reqLog.Debug("cache miss", "key", "orders:42")

    jsonLog := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{ReplaceAttr: noTime}))
    jsonLog.Error("payment failed", "order", 1001, "err", errors.New("card declined"), "retry", strings.Contains("yes", "y"))
}`,
          },
        ],
        output: `1: first line
2: second line
3: third line
   ./
   logs/
   logs/2026/
   logs/2026/nov.log
   notes.txt
size: 34 | ext: .txt | base: notes.txt
missing file is ErrNotExist: true
level=INFO msg="server started" port=8080 env=dev
level=WARN msg="slow request" request_id=req-7f3a path=/orders took=1.5s user.id=42 user.plan=pro
level=DEBUG msg="cache miss" request_id=req-7f3a key=orders:42
{"level":"ERROR","msg":"payment failed","order":1001,"err":"card declined","retry":true}`,
        explain: `- \`0o644\` is an octal file mode (owner read/write, others read). \`os.MkdirTemp\` plus \`defer os.RemoveAll\` is the pattern for scratch space; in tests use \`t.TempDir()\`.
- \`bufio.Writer\` batches small writes into fewer system calls, but you must \`Flush\`. \`bufio.Scanner\` reads line by line (raise its buffer with \`sc.Buffer\` for lines over 64 KB).
- \`filepath.WalkDir\` visits entries in lexical order and passes a cheap \`fs.DirEntry\` (no extra \`stat\` call per file).
- slog's \`With\` returns a logger that adds \`request_id\` to everything it logs. In production, set the handler once with \`slog.SetDefault(...)\` and log as JSON for tools like Loki, Datadog or CloudWatch.`,
      },
    ],
    interview: [
      {
        q: "How does Go's time formatting work?",
        a: "Instead of strftime codes, layouts are written using a specific reference time: Mon Jan 2 15:04:05 MST 2006 (the numbers 1-2-3-4-5-6-7 for month, day, hour, minute, second, year, zone offset -0700). You write the layout exactly as that reference moment would appear in your format, e.g. \"2006-01-02\" for ISO dates or \"3:04 PM\" for 12-hour times. Predefined layouts include time.RFC3339, time.DateOnly and time.DateTime. Parsing uses the same layouts.",
        freq: "common",
      },
      {
        q: "What are common encoding/json pitfalls?",
        a: "Unexported fields are silently skipped; unknown input fields are silently ignored unless DisallowUnknownFields is set; numbers decoded into interface{} become float64 (precision loss for large IDs; use UseNumber or typed structs); nil slices encode as null while empty slices encode as []; omitempty doesn't omit zero structs (Go 1.24's omitzero does); time.Time requires RFC 3339 strings; and decoding into an existing struct or map merges with its current contents rather than resetting it.",
        freq: "common",
      },
      {
        q: "Why use log/slog instead of the log package?",
        a: "slog (Go 1.21) produces structured logs: each record has a message plus typed key-value attributes and a level, emitted as JSON or logfmt-style text. Structured logs can be indexed, filtered and aggregated by log platforms (search by request_id, count errors by route) instead of parsed with regexes. It supports levels, contextual loggers via With, groups, and pluggable handlers, and third-party libraries (zap, zerolog) can act as handlers.",
      },
      {
        q: "time.Now() and the monotonic clock: why does it matter?",
        a: "time.Now() returns both a wall-clock reading and a monotonic clock reading. Operations like time.Since, Sub and comparisons between two Now() values use the monotonic reading, so measured durations stay correct even if the system's wall clock is adjusted (NTP, manual changes, leap smearing). The monotonic part is stripped by operations like t.Round(0), formatting/serialization, or creating times with time.Date, so it only matters for in-process measurements.",
      },
    ],
    quiz: [
      {
        q: "Which layout formats a date as 2026-11-03?",
        options: ["YYYY-MM-DD", "%Y-%m-%d", "2006-01-02", "yyyy-mm-dd"],
        answer: 2,
        explain: "Layouts use the reference date Jan 2 2006.",
      },
      {
        q: "A JSON number decoded into `any` has which Go type?",
        options: ["int", "float64", "json.Number", "string"],
        answer: 1,
        explain: "Unless you call decoder.UseNumber().",
      },
      {
        q: "How should you compare two time.Time values for the same instant?",
        options: ["t1 == t2", "t1.Equal(t2)", "t1.String() == t2.String()", "reflect.DeepEqual"],
        answer: 1,
        explain: "== also compares locations and monotonic readings.",
      },
      {
        q: "What must you call after writing through a bufio.Writer?",
        options: ["Close", "Flush", "Sync", "Nothing"],
        answer: 1,
        explain: "Buffered data isn't written until Flush.",
      },
      {
        q: "How do you check that an error means 'file does not exist'?",
        options: ["err.Error() == \"not found\"", "errors.Is(err, fs.ErrNotExist)", "err == nil", "os.IsFile(err)"],
        answer: 1,
        explain: "Works through wrapping (os.ErrNotExist is the same value).",
      },
    ],
  },
];
