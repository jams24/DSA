import type { Lesson } from "../types";

// Go track, part 3: Advanced.

export const goAdvanced: Lesson[] = [
  // ------------------------------------------------------------------ CONCURRENCY
  {
    id: "go-concurrency",
    stage: "Advanced",
    title: "Goroutines, channels and select",
    tagline: "Go's concurrency toolkit: goroutines, unbuffered and buffered channels, close and range, select with timeouts, WaitGroup, Mutex, atomics, the race detector, worker pools and pipelines.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["gochan"],
    concept: `
## Goroutines
\`go f(x)\` starts \`f\` running **concurrently** in a new goroutine and returns immediately. Goroutines are not OS threads: they start with a tiny stack (a few KB) that grows as needed, and the Go runtime multiplexes thousands or millions of them onto a few threads (the next chapters explain how).

When \`main\` returns, the program exits, **even if other goroutines are still running**. You must wait for the work you started.

## Channels: typed pipes between goroutines
\`\`\`go
ch := make(chan int)      // unbuffered
jobs := make(chan Job, 100) // buffered, capacity 100
ch <- 42                  // send
v := <-ch                 // receive
v, ok := <-ch             // ok is false once ch is closed and empty
close(ch)                 // only the sender closes
for v := range ch { }     // receive until closed
\`\`\`
| Operation | Unbuffered | Buffered (not full / not empty) | Closed | nil channel |
|---|---|---|---|---|
| Send | Blocks until a receiver takes it | Doesn't block | **panic** | Blocks forever |
| Receive | Blocks until a sender sends | Doesn't block | Zero value, \`ok == false\` | Blocks forever |

An unbuffered send is a **handoff**: both goroutines meet, which also synchronizes them. A buffered channel is a queue that decouples their speeds. Use the visualizer to watch both, plus a deadlock and a goroutine leak.

Channel direction types document intent: \`chan<- int\` can only send, \`<-chan int\` can only receive.

## select
\`select\` waits on several channel operations and runs whichever is ready first (randomly if several are):
\`\`\`go
select {
case msg := <-inbox:    handle(msg)
case <-time.After(time.Second): return errTimeout
case <-ctx.Done():      return ctx.Err()
default:                // optional: makes select non-blocking
}
\`\`\`

## Shared memory: the sync package
"Don't communicate by sharing memory; share memory by communicating." Channels are great for passing ownership of data and signaling. For protecting shared state, a **mutex** is often simpler:
- \`sync.WaitGroup\`: wait for a group of goroutines (\`Add\`, \`Done\`, \`Wait\`; Go 1.25 adds \`wg.Go(f)\`).
- \`sync.Mutex\` / \`sync.RWMutex\`: one writer at a time, or many readers. Keep critical sections small and \`defer mu.Unlock()\`.
- \`sync/atomic\`: \`atomic.Int64\`, \`atomic.Bool\`, \`atomic.Pointer[T]\` for single counters and flags.
- \`sync.Once\` / \`sync.OnceValue\`, \`sync.Pool\` (reuse temporary objects), \`sync.Map\` (for specific read-mostly cases), \`sync.Cond\` (rare).

## Data races and the race detector
A **data race** is two goroutines accessing the same memory at the same time, with at least one write and no synchronization. Races cause corrupted values, crashes and "impossible" bugs. **Concurrent map writes are detected by the runtime and crash the program.**
\`\`\`go
count := 0
for range 1000 { go func() { count++ }() }   // RACE: read-modify-write without a lock
\`\`\`
\`go test -race\` / \`go run -race\` instrument memory accesses and report races with both stack traces. Run it in CI.

## Patterns
- **Worker pool**: N goroutines read from one \`jobs\` channel and write to \`results\`. Bounds concurrency (database connections, API rate limits).
- **Pipeline**: stages connected by channels, each stage a goroutine that ranges over its input and closes its output.
- **Fan-out / fan-in**: several workers read one channel; a merge function combines their outputs into one channel.
- **Ownership rule**: the goroutine that *sends* on a channel closes it, after all sends. Receivers never close.
`,
    keyPoints: [
      "go f() starts a goroutine; main returning ends the program",
      "Unbuffered channels hand off and synchronize; buffered ones queue",
      "Only senders close; sending on a closed channel panics",
      "range over a channel stops when it's closed and drained",
      "select waits on several channels; time.After gives timeouts",
      "WaitGroup waits, Mutex protects state, atomic for counters",
      "Run tests with -race; concurrent map writes crash the runtime",
      "Worker pools bound concurrency; pipelines chain stages with channels",
    ],
    complexity: [
      { op: "Start a goroutine", time: "~1 µs", space: "a few KB of stack (grows on demand)", note: "Cheap, not free: bound them for unbounded input" },
      { op: "Channel send/receive (uncontended)", time: "tens of ns", note: "Plus scheduling cost when a goroutine has to block and wake" },
      { op: "Mutex lock/unlock (uncontended)", time: "~10-20 ns", note: "Contention is what hurts: shard state or shorten critical sections" },
      { op: "atomic.Int64.Add", time: "a few ns", note: "Still a cache-line ping-pong under heavy contention" },
    ],
    code: [
      {
        title: "Goroutines with WaitGroup, Mutex and atomic",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "sync"
    "sync/atomic"
    "time"
)

type SafeCounter struct {
    mu     sync.Mutex
    counts map[string]int
}

func (c *SafeCounter) Inc(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.counts[key]++ // without the lock: a data race, and the runtime may crash on concurrent map writes
}

func (c *SafeCounter) Get(key string) int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return c.counts[key]
}

func main() {
    // 1. Start goroutines, then wait for all of them.
    var wg sync.WaitGroup
    results := make([]int, 5) // each goroutine writes only its own index: no lock needed
    for i := range 5 {
        wg.Add(1) // before starting the goroutine, never inside it
        go func() {
            defer wg.Done()
            time.Sleep(time.Duration(5-i) * time.Millisecond) // they finish in reverse order
            results[i] = i * i
        }()
    }
    wg.Wait()
    fmt.Println("squares:", results)

    // 2. A mutex protects a shared map.
    c := SafeCounter{counts: map[string]int{}}
    for range 100 {
        wg.Add(1)
        go func() {
            defer wg.Done()
            c.Inc("hits")
        }()
    }
    wg.Wait()
    fmt.Println("hits:", c.Get("hits"))

    // 3. An atomic counter: no lock for a single number.
    var ops atomic.Int64
    for range 50 {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for range 1000 {
                ops.Add(1)
            }
        }()
    }
    wg.Wait()
    fmt.Println("ops:", ops.Load())

    // 4. Goroutines finish in whatever order their work takes, not the order they started.
    done := make(chan int)
    for i := 1; i <= 3; i++ {
        go func() {
            time.Sleep(time.Duration(4-i) * 20 * time.Millisecond)
            done <- i
        }()
    }
    fmt.Println("finished:", <-done, <-done, <-done)
}`,
          },
        ],
        output: `squares: [0 1 4 9 16]
hits: 100
ops: 50000
finished: 3 2 1`,
        explain: `- \`wg.Add(1)\` must happen **before** \`go\`, otherwise \`Wait\` might run before the goroutine registers itself.
- Since Go 1.22 each loop iteration has its own \`i\`, so the closures capture the right value. In older code you'll see \`go func(i int) { ... }(i)\`.
- Writing to *different* indexes of a slice from different goroutines is safe; writing to the same map is not.
- Try deleting the \`c.mu.Lock()\` lines and running \`go run -race .\`: the race detector prints both conflicting goroutines' stacks.`,
      },
      {
        title: "Channels: handoffs, buffers, close and range, select and timeouts",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "time"
)

func producer(n int) <-chan int { // returns a receive-only channel
    out := make(chan int)
    go func() {
        defer close(out) // the sender closes: "no more values"
        for i := 1; i <= n; i++ {
            out <- i
        }
    }()
    return out
}

func main() {
    // Unbuffered: the send blocks until a receiver takes the value.
    ping := make(chan string)
    go func() { ping <- "ping" }()
    fmt.Println("received:", <-ping)

    // Buffered: sends succeed without a receiver until the buffer is full.
    jobs := make(chan string, 2)
    jobs <- "a"
    jobs <- "b"
    fmt.Println("buffered:", len(jobs), "of", cap(jobs))
    select {
    case jobs <- "c":
        fmt.Println("sent c")
    default: // with a default case, select never blocks
        fmt.Println("buffer full, c dropped")
    }
    fmt.Println(<-jobs, <-jobs)

    // range receives until the channel is closed and drained.
    sum := 0
    for v := range producer(5) {
        sum += v
    }
    fmt.Println("sum:", sum)

    // A closed channel still delivers buffered values, then zero values with ok == false.
    closed := make(chan int, 1)
    closed <- 7
    close(closed)
    v, ok := <-closed
    fmt.Println(v, ok)
    v, ok = <-closed
    fmt.Println(v, ok)

    // select + time.After: a timeout.
    slow := make(chan string, 1) // buffered, so the sender can finish even if nobody reads: no leak
    go func() {
        time.Sleep(200 * time.Millisecond)
        slow <- "slow result"
    }()
    select {
    case r := <-slow:
        fmt.Println(r)
    case <-time.After(50 * time.Millisecond):
        fmt.Println("timeout after 50ms")
    }

    // A ticker plus a stop signal: the shape of most background loops.
    ticker := time.NewTicker(10 * time.Millisecond)
    defer ticker.Stop()
    stop := time.After(55 * time.Millisecond)
    ticks := 0
loop:
    for {
        select {
        case <-ticker.C:
            ticks++
        case <-stop:
            break loop // a plain break would only leave the select
        }
    }
    fmt.Println("ticked several times:", ticks >= 3)
}`,
          },
        ],
        output: `received: ping
buffered: 2 of 2
buffer full, c dropped
a b
sum: 15
7 true
0 false
timeout after 50ms
ticked several times: true`,
        explain: `- If \`slow\` were **unbuffered**, the goroutine would block forever on \`slow <- ...\` after the timeout because nobody receives any more: a **goroutine leak**. The visualizer's "select + timeout" scenario shows exactly this, and the fix.
- \`select\` with \`default\` is a non-blocking send or receive: useful for "drop if busy" or "check without waiting".
- Labeled \`break loop\` exits the \`for\`; an unlabeled \`break\` inside \`select\` only exits the \`select\`.
- Always \`Stop\` tickers you create (since Go 1.23 unreferenced tickers are collected, but stopping is still clearer).`,
      },
      {
        title: "A worker pool and a fan-out / fan-in pipeline",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "slices"
    "strings"
    "sync"
    "time"
)

type Job struct {
    ID   int
    Text string
}

type Result struct {
    JobID, Words, Worker int
}

func worker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
    defer wg.Done()
    for j := range jobs { // ends when jobs is closed and drained
        time.Sleep(2 * time.Millisecond) // pretend this is slow I/O
        results <- Result{JobID: j.ID, Words: len(strings.Fields(j.Text)), Worker: id}
    }
}

// Pipeline stages: each receives from one channel and returns its own output channel.
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            out <- n
        }
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in {
            out <- n * n
        }
    }()
    return out
}

func merge(chans ...<-chan int) <-chan int { // fan-in
    out := make(chan int)
    var wg sync.WaitGroup
    for _, c := range chans {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for v := range c {
                out <- v
            }
        }()
    }
    go func() { wg.Wait(); close(out) }() // close only after every input is drained
    return out
}

func main() {
    texts := []string{"go is fun", "channels connect goroutines", "share memory by communicating",
        "do not communicate by sharing memory", "a b c d e f", "hello"}

    jobs := make(chan Job)
    results := make(chan Result)
    var wg sync.WaitGroup
    for w := 1; w <= 3; w++ { // a fixed pool: at most 3 jobs run at once
        wg.Add(1)
        go worker(w, jobs, results, &wg)
    }
    go func() {
        for i, t := range texts {
            jobs <- Job{ID: i, Text: t}
        }
        close(jobs) // no more work: the workers' range loops end
    }()
    go func() { wg.Wait(); close(results) }() // all workers done: no more results

    var all []Result
    helpers := map[int]bool{}
    for r := range results {
        all = append(all, r)
        helpers[r.Worker] = true
    }
    slices.SortFunc(all, func(a, b Result) int { return a.JobID - b.JobID }) // results arrive in any order
    for _, r := range all {
        fmt.Printf("job %d: %d words\\n", r.JobID, r.Words)
    }
    fmt.Println("more than one worker helped:", len(helpers) > 1)

    src := generate(1, 2, 3, 4, 5, 6)
    var squares []int
    for v := range merge(square(src), square(src)) { // fan-out to two stages, fan back in
        squares = append(squares, v)
    }
    slices.Sort(squares)
    fmt.Println("squares:", squares)
}`,
          },
        ],
        output: `job 0: 3 words
job 1: 3 words
job 2: 4 words
job 3: 6 words
job 4: 6 words
job 5: 1 words
more than one worker helped: true
squares: [1 4 9 16 25 36]`,
        explain: `- Three goroutines own the closing duties: the feeder closes \`jobs\`, a waiter closes \`results\` after \`wg.Wait()\`, and each pipeline stage closes its own output. Get this wrong and you either deadlock (nobody closes) or panic (someone sends after close).
- Results arrive in completion order, so we sort by \`JobID\`. If order matters, write into \`results[i]\` by index instead.
- Both \`square\` stages read from the **same** channel, so each number goes to exactly one of them: that's fan-out. \`merge\` is fan-in.
- For CPU-bound work, size the pool around \`runtime.NumCPU()\`; for I/O-bound work, size it to what the downstream system can handle.`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a goroutine and an OS thread?",
        a: "Goroutines are user-space tasks managed by the Go runtime. They start with a small (a few KB), growable stack instead of a fixed 1-8 MB one, are created and switched in user space (around a microsecond, no syscall), and are multiplexed M:N onto a small number of OS threads by the scheduler (G-M-P model). Blocking on channels, mutexes or network I/O parks the goroutine, not the thread. That's why a Go server can run hundreds of thousands of goroutines, while the same number of OS threads would exhaust memory.",
        freq: "very-common",
      },
      {
        q: "Buffered vs unbuffered channels?",
        a: "An unbuffered channel has no capacity: a send blocks until a receiver is ready, so the two goroutines synchronize at the handoff (a happens-before edge). A buffered channel has capacity N: sends block only when the buffer is full and receives only when it's empty, which decouples producer and consumer speeds and can smooth bursts. Buffering doesn't fix logic bugs; choose unbuffered by default and add buffering for a specific reason (a known number of results, a semaphore, avoiding a leak when the receiver may leave).",
        freq: "very-common",
      },
      {
        q: "What happens when you send to or receive from a closed or nil channel?",
        a: "Closed: sending panics; receiving returns any remaining buffered values, then the zero value immediately with ok == false; closing again panics. Nil: both sending and receiving block forever (useful in select to disable a case by setting the channel variable to nil); closing a nil channel panics. Only the sender side should close, and only when no more sends can happen.",
        freq: "very-common",
      },
      {
        q: "What is a goroutine leak and how do you prevent it?",
        a: "A goroutine that never exits because it's blocked forever: sending on a channel nobody reads (e.g. the receiver timed out), receiving from a channel nobody closes, or waiting on a lock or condition that never happens. Leaks accumulate memory and resources. Prevention: give every goroutine a clear exit path (context cancellation via select on ctx.Done(), closing input channels), use buffered channels when the receiver may give up, make sure loops over channels terminate, and test with goleak or by checking runtime.NumGoroutine / pprof goroutine profiles.",
        freq: "common",
      },
      {
        q: "When would you use a mutex instead of channels?",
        a: "Use a mutex to protect shared state accessed by several goroutines (a cache, a counter, a map of sessions): it's simpler and faster than funneling every access through a goroutine. Use channels to transfer ownership of data, to signal events (done, cancel), and to build pipelines or worker pools. The Go wiki's rule of thumb: channels for orchestration and passing data, mutexes for guarding state.",
        freq: "common",
      },
      {
        q: "How does Go's race detector work, and what are its limits?",
        a: "Enabled with -race, it compiles the program with ThreadSanitizer instrumentation: every memory access and synchronization event is recorded with vector clocks, and it reports accesses from different goroutines that aren't ordered by happens-before, with one being a write. It has no false positives but only detects races that actually occur in that execution, slows the program 2-20x and increases memory 5-10x, so it's run in tests and CI or occasional canary builds, not normal production.",
      },
    ],
    quiz: [
      {
        q: "What happens to running goroutines when main returns?",
        options: ["main waits for them", "They keep running in the background", "The program exits and they stop", "They're moved to a daemon thread"],
        answer: 2,
        explain: "Wait for them explicitly (WaitGroup, channels, errgroup).",
      },
      {
        q: "Sending on a closed channel...",
        options: ["Is ignored", "Blocks forever", "Panics", "Reopens the channel"],
        answer: 2,
        explain: "That's why only the sender closes, after its last send.",
      },
      {
        q: "Where should wg.Add(1) be called?",
        options: ["Inside the goroutine", "Before the go statement", "After wg.Wait", "Anywhere"],
        answer: 1,
        explain: "Otherwise Wait may return before the goroutine registers.",
      },
      {
        q: "Receiving from a nil channel...",
        options: ["Returns the zero value", "Panics", "Blocks forever", "Returns ok == false"],
        answer: 2,
        explain: "Handy in select: setting a channel to nil disables its case.",
      },
      {
        q: "Which tool finds data races?",
        options: ["go vet", "go test -race", "gofmt", "go mod tidy"],
        answer: 1,
        explain: "The race detector reports both conflicting accesses.",
      },
      {
        q: "In `for { select { case <-stop: break } }`, what does break do?",
        options: ["Exits the for loop", "Exits only the select", "Is a compile error", "Closes stop"],
        answer: 1,
        explain: "Use a labeled break or return to leave the loop.",
      },
    ],
    problems: [
      { title: "Print in Order", url: "https://leetcode.com/problems/print-in-order/", difficulty: "Easy", note: "signal with closed channels" },
      { title: "Print FooBar Alternately", url: "https://leetcode.com/problems/print-foobar-alternately/", difficulty: "Medium", note: "two unbuffered channels as turns" },
      { title: "Print Zero Even Odd", url: "https://leetcode.com/problems/print-zero-even-odd/", difficulty: "Medium", note: "three goroutines, three channels" },
      { title: "Building H2O", url: "https://leetcode.com/problems/building-h2o/", difficulty: "Medium", note: "buffered channels as semaphores" },
      { title: "The Dining Philosophers", url: "https://leetcode.com/problems/the-dining-philosophers/", difficulty: "Medium", note: "lock ordering avoids deadlock" },
    ],
  },

  // ------------------------------------------------------------------ PATTERNS
  {
    id: "go-patterns",
    stage: "Advanced",
    title: "Production concurrency: context, errgroup and shutdown",
    tagline: "context for cancellation and deadlines, bounded parallelism with errgroup and semaphores, sync.Once, rate limiting, graceful HTTP shutdown and avoiding goroutine leaks.",
    difficulty: "advanced",
    minutes: 40,
    concept: `
## context.Context: cancellation that flows through your program
Every request-scoped operation (an HTTP handler, a database query, an outgoing API call) should accept a \`ctx context.Context\` as its **first parameter**. A context carries:
- a **cancellation signal**: \`ctx.Done()\` is a channel that closes when the work should stop; \`ctx.Err()\` says why (\`context.Canceled\` or \`context.DeadlineExceeded\`);
- an optional **deadline**: \`context.WithTimeout(ctx, 2*time.Second)\`;
- **request-scoped values** (a request ID, an auth principal), used sparingly.

Contexts form a **tree**: cancelling a parent cancels every child. \`net/http\` gives each request \`r.Context()\`, cancelled when the client disconnects; \`database/sql\`, \`http.NewRequestWithContext\`, gRPC and most libraries accept it. So one cancel stops the whole tree of work.

Rules:
- Always \`defer cancel()\` after \`WithCancel\`/\`WithTimeout\`, or the timer and goroutines leak until the parent ends.
- Don't store contexts in structs; pass them explicitly.
- Never pass \`nil\`; use \`context.Background()\` at the top (main, tests) or \`context.TODO()\` as a placeholder.
- Context values are for request-scoped data crossing API boundaries, not for optional function parameters. Use an unexported key type.

## Bounded parallelism: errgroup and semaphores
\`golang.org/x/sync/errgroup\` is the standard way to run a group of goroutines that can fail: \`g.Go(func() error {...})\` starts one, \`g.Wait()\` waits for all and returns the **first error**, \`errgroup.WithContext\` cancels the others when one fails, and \`g.SetLimit(n)\` bounds how many run at once. You'll build a small version yourself below to see how it works. A **buffered channel of size N** is the simplest semaphore: send to acquire a slot, receive to release.

## One-time initialization
\`sync.Once\` runs a function exactly once even if called from many goroutines; \`sync.OnceValue(f)\` and \`sync.OnceValues(f)\` (Go 1.21) wrap a function so its result is computed once and cached.

## Rate limiting
- A **token bucket** allows bursts up to a capacity and refills at a steady rate. \`golang.org/x/time/rate\` provides \`rate.NewLimiter(r, burst)\` with \`Allow()\` and \`Wait(ctx)\`.
- \`time.Ticker\` gives a simple fixed pace for a single loop.
- Per-client limiting keeps one limiter per API key or IP (with eviction).

## Graceful shutdown
In Kubernetes or systemd, your process gets **SIGTERM** before it's killed. A graceful server stops accepting connections, finishes in-flight requests, then exits:
\`\`\`go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
go srv.ListenAndServe()
<-ctx.Done()                                      // wait for a signal
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)                         // drain in-flight requests
\`\`\`
Background workers should watch the same context and stop cleanly.

## Avoiding leaks
Every goroutine you start needs an owner and an exit: a closed input channel, a cancelled context, or a buffered channel so its last send can't block. Tools: \`runtime.NumGoroutine\`, the pprof goroutine profile, and \`go.uber.org/goleak\` in tests. Go 1.25 adds \`testing/synctest\` for testing concurrent code with a fake clock.
`,
    keyPoints: [
      "Pass ctx context.Context as the first parameter of request-scoped work",
      "Cancelling a parent context cancels all its children",
      "Always defer cancel() after WithCancel/WithTimeout",
      "errgroup: first error wins, cancels the rest, SetLimit bounds concurrency",
      "A buffered channel of size N is a semaphore",
      "sync.Once / OnceValue for lazy one-time initialization",
      "Graceful shutdown: signal.NotifyContext + srv.Shutdown(ctx)",
      "Every goroutine needs an owner and an exit path",
    ],
    code: [
      {
        title: "context: timeouts, cancellation trees, causes and values",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "sync/atomic"
    "time"
)

type ctxKey string // an unexported key type: no other package can collide with it

const requestIDKey ctxKey = "request_id"

// slowQuery does its work but gives up as soon as ctx is done.
func slowQuery(ctx context.Context, d time.Duration) (string, error) {
    select {
    case <-time.After(d):
        return "rows", nil
    case <-ctx.Done():
        return "", fmt.Errorf("query: %w", ctx.Err())
    }
}

func handle(ctx context.Context) string {
    id, _ := ctx.Value(requestIDKey).(string)
    return "handling " + id
}

func main() {
    // 1. A deadline shared by several calls.
    ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
    defer cancel() // releases the timer even if we finish early
    _, err := slowQuery(ctx, 10*time.Millisecond)
    fmt.Println("fast query err:", err)
    _, err = slowQuery(ctx, time.Second)
    fmt.Println("slow query err:", err)
    fmt.Println("is DeadlineExceeded:", errors.Is(err, context.DeadlineExceeded))

    // 2. One cancel stops every goroutine watching the context.
    ctx2, cancel2 := context.WithCancel(context.Background())
    var wg sync.WaitGroup
    var stopped atomic.Int32
    for range 4 {
        wg.Add(1)
        go func() {
            defer wg.Done()
            ticker := time.NewTicker(time.Millisecond)
            defer ticker.Stop()
            for {
                select {
                case <-ticker.C: // do a unit of work
                case <-ctx2.Done():
                    stopped.Add(1)
                    return
                }
            }
        }()
    }
    time.Sleep(10 * time.Millisecond)
    cancel2()
    wg.Wait()
    fmt.Println("workers stopped:", stopped.Load(), "| reason:", ctx2.Err())

    // 3. Cancelling a parent cancels its children (not the other way round).
    parent, cancelParent := context.WithCancel(context.Background())
    child, cancelChild := context.WithTimeout(parent, time.Hour)
    defer cancelChild()
    cancelParent()
    <-child.Done()
    fmt.Println("child cancelled by its parent:", child.Err())

    // 4. A cause explains why (Go 1.20); values carry request-scoped data.
    ctx3, cancel3 := context.WithCancelCause(context.Background())
    cancel3(errors.New("client disconnected"))
    fmt.Println("err:", ctx3.Err(), "| cause:", context.Cause(ctx3))
    fmt.Println(handle(context.WithValue(context.Background(), requestIDKey, "req-42")))

    // 5. AfterFunc runs a callback on cancellation; WithoutCancel detaches (both Go 1.21).
    ctx4, cancel4 := context.WithCancel(context.Background())
    fired := make(chan struct{})
    context.AfterFunc(ctx4, func() { close(fired) })
    detached := context.WithoutCancel(ctx4) // e.g. for an audit log that must finish anyway
    cancel4()
    <-fired
    fmt.Println("AfterFunc ran; detached context still alive:", detached.Err() == nil)
}`,
          },
        ],
        output: `fast query err: <nil>
slow query err: query: context deadline exceeded
is DeadlineExceeded: true
workers stopped: 4 | reason: context canceled
child cancelled by its parent: context canceled
err: context canceled | cause: client disconnected
handling req-42
AfterFunc ran; detached context still alive: true`,
        explain: `- The 50ms deadline covers **both** queries: the first used 10ms, so the second had about 40ms left before \`ctx.Done()\` closed.
- Workers check \`ctx.Done()\` in the same \`select\` as their work: the standard shape of a cancellable loop.
- A child context can only shorten its parent's lifetime, never extend it.
- \`context.Cause\` lets you record *why* something was cancelled, which is far easier to debug than a bare \`context canceled\`.`,
      },
      {
        title: "Bounded parallelism: a hand-built errgroup, semaphores and sync.OnceValue",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "context"
    "fmt"
    "sync"
    "sync/atomic"
    "time"
)

// Group is a small version of golang.org/x/sync/errgroup with SetLimit built in.
type Group struct {
    wg      sync.WaitGroup
    sem     chan struct{} // a buffered channel used as a semaphore
    errOnce sync.Once
    err     error
    cancel  context.CancelCauseFunc
}

func WithContext(ctx context.Context, limit int) (*Group, context.Context) {
    ctx, cancel := context.WithCancelCause(ctx)
    return &Group{sem: make(chan struct{}, limit), cancel: cancel}, ctx
}

func (g *Group) Go(f func() error) {
    g.sem <- struct{}{} // acquire a slot: blocks while 'limit' tasks are running
    g.wg.Add(1)
    go func() {
        defer func() { <-g.sem; g.wg.Done() }() // release the slot
        if err := f(); err != nil {
            g.errOnce.Do(func() { // only the first error is kept...
                g.err = err
                g.cancel(err) // ...and it cancels everyone else
            })
        }
    }()
}

func (g *Group) Wait() error {
    g.wg.Wait()
    g.cancel(nil)
    return g.err
}

type Page struct {
    Name  string
    Delay time.Duration
    Fail  bool
}

var running, peak, cancelled atomic.Int32

func fetch(ctx context.Context, p Page) (int, error) {
    now := running.Add(1)
    defer running.Add(-1)
    for { // record the highest concurrency seen
        old := peak.Load()
        if now <= old || peak.CompareAndSwap(old, now) {
            break
        }
    }
    select {
    case <-time.After(p.Delay):
    case <-ctx.Done():
        cancelled.Add(1)
        return 0, context.Cause(ctx)
    }
    if p.Fail {
        return 0, fmt.Errorf("fetch %s: status 500", p.Name)
    }
    return len(p.Name) * 100, nil
}

var loadConfig = sync.OnceValue(func() map[string]string { // runs at most once, result cached
    fmt.Println("(loading config)")
    return map[string]string{"region": "eu-west-1"}
})

func main() {
    pages := []Page{{"home", 20 * time.Millisecond, false}, {"about", 15 * time.Millisecond, false},
        {"blog", 25 * time.Millisecond, false}, {"pricing", 10 * time.Millisecond, false}, {"docs", 5 * time.Millisecond, false}}
    g, ctx := WithContext(context.Background(), 2)
    sizes := make([]int, len(pages))
    for i, p := range pages {
        g.Go(func() error {
            n, err := fetch(ctx, p)
            sizes[i] = n // each goroutine owns one index
            return err
        })
    }
    fmt.Println("all ok:", g.Wait(), sizes, "| never more than 2 at once:", peak.Load() <= 2)

    failing := []Page{{"slow-a", time.Second, false}, {"broken", 5 * time.Millisecond, true},
        {"slow-b", time.Second, false}, {"slow-c", time.Second, false}}
    start := time.Now()
    g, ctx = WithContext(context.Background(), 3)
    for _, p := range failing {
        g.Go(func() error { _, err := fetch(ctx, p); return err })
    }
    err := g.Wait()
    fmt.Println("first error:", err)
    fmt.Println("others cancelled:", cancelled.Load(), "| finished well under 1s:", time.Since(start) < 500*time.Millisecond)

    var wg sync.WaitGroup
    for range 10 {
        wg.Add(1)
        go func() { defer wg.Done(); _ = loadConfig() }()
    }
    wg.Wait()
    fmt.Println("region:", loadConfig()["region"])
}`,
          },
        ],
        output: `all ok: <nil> [400 500 400 700 400] | never more than 2 at once: true
first error: fetch broken: status 500
others cancelled: 3 | finished well under 1s: true
(loading config)
region: eu-west-1`,
        explain: `- \`Go\` blocks the caller while the semaphore is full, so the loop itself is throttled, exactly like \`errgroup.SetLimit\`.
- In the failing run, "broken" fails after 5ms and cancels the shared context. The two slow fetches already running return immediately, and "slow-c" (which got the freed slot) sees a cancelled context at once. The whole group finishes in about 5ms instead of a second.
- \`sync.Once\` guarantees the first error is recorded exactly once, even if several tasks fail together.
- Ten goroutines call \`loadConfig\`, but "(loading config)" prints once: \`sync.OnceValue\` makes concurrent callers wait for the first call and share its result.`,
      },
      {
        title: "Rate limiting and graceful HTTP shutdown",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "context"
    "fmt"
    "io"
    "net"
    "net/http"
    "sync"
    "time"
)

// TokenBucket allows bursts of up to 'capacity' and refills 'rate' tokens per second.
type TokenBucket struct {
    mu             sync.Mutex
    tokens, cap    float64
    ratePerSecond  float64
    last           time.Time
}

func NewTokenBucket(capacity, ratePerSecond float64) *TokenBucket {
    return &TokenBucket{tokens: capacity, cap: capacity, ratePerSecond: ratePerSecond, last: time.Now()}
}

func (b *TokenBucket) Allow() bool {
    b.mu.Lock()
    defer b.mu.Unlock()
    now := time.Now()
    b.tokens = min(b.cap, b.tokens+now.Sub(b.last).Seconds()*b.ratePerSecond) // refill lazily
    b.last = now
    if b.tokens >= 1 {
        b.tokens--
        return true
    }
    return false
}

func main() {
    limiter := NewTokenBucket(3, 10) // burst of 3, then one request per 100ms
    var burst []bool
    for range 5 {
        burst = append(burst, limiter.Allow())
    }
    fmt.Println("burst of 5:", burst)
    time.Sleep(250 * time.Millisecond) // about 2.5 tokens come back
    fmt.Println("after 250ms:", limiter.Allow(), limiter.Allow(), limiter.Allow())

    mux := http.NewServeMux()
    mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
        time.Sleep(100 * time.Millisecond) // a request that is still running during shutdown
        fmt.Fprint(w, "finished slow work")
    })
    ln, err := net.Listen("tcp", "127.0.0.1:0") // port 0: the OS picks a free port
    if err != nil {
        fmt.Println(err)
        return
    }
    url := "http://" + ln.Addr().String() + "/slow"
    srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
    serveErr := make(chan error, 1)
    go func() { serveErr <- srv.Serve(ln) }()

    body := make(chan string, 1)
    go func() { // an in-flight request
        res, err := http.Get(url)
        if err != nil {
            body <- "error: " + err.Error()
            return
        }
        defer res.Body.Close()
        b, _ := io.ReadAll(res.Body)
        body <- string(b)
    }()
    time.Sleep(30 * time.Millisecond) // let the request reach the handler

    fmt.Println("shutting down while a request is in flight...")
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    fmt.Println("Shutdown returned:", srv.Shutdown(ctx)) // stop accepting, wait for in-flight requests
    fmt.Println("in-flight request got:", <-body)
    fmt.Println("Serve returned:", <-serveErr)
    _, err = http.Get(url)
    fmt.Println("new requests fail:", err != nil)
}`,
          },
        ],
        output: `burst of 5: [true true true false false]
after 250ms: true true false
shutting down while a request is in flight...
Shutdown returned: <nil>
in-flight request got: finished slow work
Serve returned: http: Server closed
new requests fail: true`,
        explain: `- The token bucket refills **lazily** from the elapsed time on each call, so it needs no background goroutine. \`golang.org/x/time/rate\` works the same way and adds \`Wait(ctx)\` and reservations.
- \`srv.Shutdown\` closes the listener, waits for the in-flight \`/slow\` request to finish (it still gets its full response), then returns. \`Serve\` returns \`http.ErrServerClosed\`, which a real \`main\` treats as a normal exit.
- In production, the trigger is \`signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)\` instead of the \`Sleep\`; the next chapters' project wires that up.
- \`ReadHeaderTimeout\` protects against clients that open connections and send headers slowly (Slowloris). \`go vet\`-style linters flag servers without it.`,
      },
      {
        title: "The real errgroup (golang.org/x/sync)",
        noCheck: "needs the golang.org/x/sync module, which the offline test environment doesn't provide",
        variants: [
          {
            lang: "go",
            code: `package fetch

import (
    "context"
    "fmt"
    "io"
    "net/http"

    "golang.org/x/sync/errgroup" // go get golang.org/x/sync
)

// FetchAll downloads every URL with at most 8 requests in flight.
// The first failure cancels the remaining requests.
func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(8)
    bodies := make([][]byte, len(urls))
    for i, u := range urls {
        g.Go(func() error {
            req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
            if err != nil {
                return err
            }
            res, err := http.DefaultClient.Do(req)
            if err != nil {
                return fmt.Errorf("fetch %s: %w", u, err)
            }
            defer res.Body.Close()
            if res.StatusCode != http.StatusOK {
                return fmt.Errorf("fetch %s: status %d", u, res.StatusCode)
            }
            bodies[i], err = io.ReadAll(res.Body)
            return err
        })
    }
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return bodies, nil
}`,
          },
        ],
        explain: `This is what production code uses instead of the hand-built \`Group\`. Notice the request is created **with the group's context**, so when one fetch fails, the HTTP client aborts the others mid-flight.`,
      },
    ],
    interview: [
      {
        q: "What is context.Context for, and what are the rules for using it?",
        a: "It carries cancellation signals, deadlines and request-scoped values across API boundaries and goroutines. Rules: accept it as the first parameter (ctx context.Context) of functions doing request-scoped or blocking work; never store it in structs or pass nil (use context.Background or TODO); always call the cancel function returned by WithCancel/WithTimeout/WithDeadline (defer cancel()); derive child contexts rather than creating new roots inside request handling; use values only for request-scoped metadata (trace IDs, auth), with unexported key types; and check ctx.Done() in long loops and selects.",
        freq: "very-common",
      },
      {
        q: "How do you limit the number of goroutines running at once?",
        a: "Options: a worker pool (N goroutines ranging over a jobs channel), a semaphore (a buffered channel of capacity N: send before starting work, receive after), errgroup.Group with SetLimit(N), or golang.org/x/sync/semaphore for weighted limits. Bounding matters because unbounded goroutines for unbounded input can exhaust memory, file descriptors, database connections or a downstream API's rate limit.",
        freq: "very-common",
      },
      {
        q: "How do you implement graceful shutdown of a Go HTTP service?",
        a: "Use signal.NotifyContext to get a context cancelled on SIGINT/SIGTERM, run srv.ListenAndServe in a goroutine (treating http.ErrServerClosed as normal), wait for the signal, then call srv.Shutdown with a timeout context: it closes listeners, closes idle connections and waits for active requests to finish. Also stop background workers via the same context and wait for them (WaitGroup/errgroup), flush logs/metrics, and close database pools. In Kubernetes, also fail the readiness probe first and keep the shutdown timeout below terminationGracePeriodSeconds.",
        freq: "common",
      },
      {
        q: "What does errgroup give you over a plain WaitGroup?",
        a: "Error propagation (Wait returns the first non-nil error), automatic cancellation of a derived context when any task fails (WithContext), and bounded concurrency (SetLimit, TryGo). With a WaitGroup you'd hand-roll an error channel or mutex-protected error, a cancel func, and a semaphore. Note errgroup returns only the first error; collect all errors yourself (or with errors.Join) when you need them.",
      },
      {
        q: "How would you implement a rate limiter?",
        a: "A token bucket: tokens accumulate at rate r up to burst b; each request consumes one or is rejected/delayed. Implement lazily by computing refill from elapsed time on each call under a mutex, or use golang.org/x/time/rate (Allow, Wait(ctx), Reserve). For per-client limits keep a map of limiters keyed by API key/IP with expiry. For a distributed service, store counters centrally (Redis with a Lua script or sliding window) so all instances share the limit.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "What must you do with the cancel function from context.WithTimeout?",
        options: ["Ignore it if the timeout fires", "Always call it, usually with defer", "Pass it to children", "Call it before using ctx"],
        answer: 1,
        explain: "It releases the timer and child resources.",
      },
      {
        q: "If a parent context is cancelled, its children are...",
        options: ["Unaffected", "Cancelled too", "Given a new deadline", "Converted to Background"],
        answer: 1,
        explain: "Cancellation flows down the tree.",
      },
      {
        q: "errgroup.Wait() returns...",
        options: ["All errors joined", "The first non-nil error", "The last error", "Only panics"],
        answer: 1,
        explain: "And WithContext cancels the rest on that first error.",
      },
      {
        q: "What does http.Server.Shutdown do with in-flight requests?",
        options: ["Kills them", "Waits for them to finish (until ctx expires)", "Returns 503", "Retries them"],
        answer: 1,
        explain: "New connections are refused; active ones drain.",
      },
      {
        q: "A buffered channel of capacity 5 used as a semaphore allows...",
        options: ["5 goroutines in total", "At most 5 holders at the same time", "5 messages per second", "Unlimited goroutines"],
        answer: 1,
        explain: "Send to acquire, receive to release.",
      },
    ],
  },

  // ------------------------------------------------------------------ RUNTIME
  {
    id: "go-runtime",
    stage: "Advanced",
    title: "Under the hood: scheduler, memory, GC and profiling",
    tagline: "The G-M-P scheduler, growable stacks, escape analysis and allocations, the concurrent garbage collector with GOGC and GOMEMLIMIT, the memory model, and finding bottlenecks with pprof.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["gosched"],
    concept: `
## The scheduler: G, M and P
- **G** (goroutine): a function plus its stack and state.
- **M** (machine): an OS thread that executes Go code.
- **P** (processor): a scheduling context with a **local run queue** of runnable Gs. There are \`GOMAXPROCS\` Ps (by default, the number of CPUs; Go 1.25 also respects container CPU limits).

An M must hold a P to run Go code. Each P runs Gs from its local queue; when it's empty, it checks the **global queue** and the **netpoller**, then **steals** half the queue of another P. When a G makes a blocking **syscall**, its M blocks with it, so the P is handed to another M to keep the other Gs running. Network I/O doesn't block threads at all: the G parks and the netpoller (epoll/kqueue) wakes it when the socket is ready. Since Go 1.14, long-running goroutines are **asynchronously preempted** (about every 10ms), so a tight loop can't starve others. Step through all of this in the visualizer.

## Stacks and escape analysis
Each goroutine starts with a small stack (around 2-8 KB) that the runtime **grows by copying** when needed, so deep recursion is fine and goroutines stay cheap.

The compiler's **escape analysis** decides whether a value can live on the stack (free when the function returns) or must be **heap-allocated** (managed by the GC). A value escapes when its address outlives the function: returned pointers, values stored in long-lived structures or interfaces, closures captured by goroutines, or sizes unknown at compile time. See its decisions with \`go build -gcflags=-m\`.

Fewer heap allocations means less GC work. Common fixes: preallocate slices and maps (\`make([]T, 0, n)\`), use \`strings.Builder\`, return values instead of pointers for small structs, reuse buffers with \`sync.Pool\`.

## The garbage collector
Go's GC is **concurrent, tri-color mark and sweep**, non-generational and non-moving. It runs mostly alongside your code (using about 25% of CPU while marking) with very short stop-the-world pauses (typically well under a millisecond), using a write barrier to track pointer changes during marking.
- **GOGC** (default 100) sets how much the heap may grow before the next cycle: 100 means "collect when the heap has doubled since the last live size". Higher means fewer collections but more memory.
- **GOMEMLIMIT** (Go 1.19) sets a soft memory limit: the GC works harder as the total approaches it. In containers, set it to about 90% of the memory limit. \`GOGC=off\` plus \`GOMEMLIMIT\` collects only when needed.
- Go 1.25 introduced the "Green Tea" collector as an experiment, made the default in Go 1.26, which improves marking locality on many-core machines.

## The memory model, briefly
Without synchronization there's no guarantee one goroutine sees another's writes, or sees them in order. A **happens-before** relationship comes from: channel sends before the matching receive completes, \`Unlock\` before a later \`Lock\`, \`wg.Done\` before \`Wait\` returns, \`Once\`, and atomics. If two goroutines access a variable and one writes, they need one of these.

## Profiling: measure before optimizing
| Tool | Answers |
|---|---|
| \`go test -bench . -benchmem\` | How fast is this function, how many allocations? |
| CPU profile (\`pprof\`) | Where is CPU time spent? |
| Heap profile | Who allocates, what's retained? |
| Goroutine profile | How many goroutines, where are they blocked (leaks)? |
| Mutex / block profiles | Where do goroutines wait for locks and channels? |
| \`runtime/trace\` + \`go tool trace\` | Scheduling, GC pauses and latency over time |

\`import _ "net/http/pprof"\` exposes live profiles at \`/debug/pprof/\` (on an internal port only). **PGO**: put a production CPU profile at \`default.pgo\` in your main package and \`go build\` uses it to inline and optimize hot paths (typically 2-14% faster).
`,
    keyPoints: [
      "G (goroutine), M (OS thread), P (scheduling context); GOMAXPROCS Ps",
      "Idle Ps steal work; blocking syscalls hand the P to another M",
      "Network I/O parks goroutines on the netpoller, not threads",
      "Goroutines are preempted asynchronously since Go 1.14",
      "Escape analysis decides stack vs heap: check with -gcflags=-m",
      "Concurrent mark-sweep GC; tune with GOGC and GOMEMLIMIT",
      "happens-before comes from channels, locks, WaitGroup, Once, atomics",
      "Profile with pprof and benchmarks before optimizing",
    ],
    code: [
      {
        title: "Goroutines are cheap: counting them, their stacks and preemption",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "runtime"
    "sync"
    "time"
)

func main() {
    fmt.Println("GOMAXPROCS matches the CPU count:", runtime.GOMAXPROCS(0) == runtime.NumCPU())
    fmt.Println("goroutines at start:", runtime.NumGoroutine())

    var before, during runtime.MemStats
    runtime.ReadMemStats(&before)

    const n = 10_000
    release := make(chan struct{})
    var started sync.WaitGroup
    started.Add(n)
    for range n {
        go func() {
            started.Done()
            <-release // park until released: a parked goroutine uses no CPU
        }()
    }
    started.Wait()
    fmt.Println("goroutines while parked:", runtime.NumGoroutine())
    runtime.ReadMemStats(&during)
    perG := float64(during.StackInuse-before.StackInuse) / n
    fmt.Println("stack per goroutine is a few KB:", perG >= 1024 && perG <= 16*1024)

    close(release) // closing wakes every receiver at once
    deadline := time.Now().Add(2 * time.Second)
    for runtime.NumGoroutine() > 1 && time.Now().Before(deadline) {
        time.Sleep(time.Millisecond)
    }
    fmt.Println("goroutines after release:", runtime.NumGoroutine())

    var depth func(int) int // deep recursion: the stack grows by copying, no stack overflow
    depth = func(k int) int {
        if k == 0 {
            return 0
        }
        return 1 + depth(k-1)
    }
    fmt.Println("recursion depth reached:", depth(1_000_000))

    runtime.GOMAXPROCS(1) // one P: only one goroutine runs Go code at a time
    go func() {
        for { // a tight loop with no function calls or channel operations
        }
    }()
    time.Sleep(20 * time.Millisecond)
    fmt.Println("main still runs alongside a spinning goroutine: async preemption")
}`,
          },
        ],
        output: `GOMAXPROCS matches the CPU count: true
goroutines at start: 1
goroutines while parked: 10001
stack per goroutine is a few KB: true
goroutines after release: 1
recursion depth reached: 1000000
main still runs alongside a spinning goroutine: async preemption`,
        explain: `- Ten thousand parked goroutines cost a few KB each. Ten thousand OS threads would reserve gigabytes of stack address space.
- A million-deep recursion works because the stack starts small and is **copied to a bigger one** when it runs out (up to a 1 GB maximum by default).
- With a single P, the spinning goroutine would have starved \`main\` forever before Go 1.14. Now the runtime's monitor thread (sysmon) preempts any goroutine running longer than about 10ms with a signal.
- \`GOMAXPROCS\` limits threads running Go code simultaneously, not the number of goroutines.`,
      },
      {
        title: "Escape analysis and allocations, measured",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "strconv"
    "strings"
    "testing"
)

type Point struct{ X, Y int }

// Package-level "sinks" stop the compiler from optimizing the work away.
var (
    sinkPoint Point
    sinkPtr   *Point
    sinkInts  []int
    sinkStr   string
    sinkMap   map[int]int
)

//go:noinline
func pointValue(x, y int) Point { return Point{x, y} } // copied to the caller: stays on the stack

//go:noinline
func pointPtr(x, y int) *Point { return &Point{x, y} } // its address outlives the call: heap

func appendGrow(n int) []int {
    var s []int
    for i := range n {
        s = append(s, i) // reallocates and copies whenever capacity runs out
    }
    return s
}

func appendPrealloc(n int) []int {
    s := make([]int, 0, n) // one allocation of the right size
    for i := range n {
        s = append(s, i)
    }
    return s
}

func concat(n int) string {
    s := ""
    for i := range n {
        s += strconv.Itoa(i % 10) // every += builds a brand new string
    }
    return s
}

func builder(n int) string {
    var b strings.Builder
    b.Grow(n) // reserve once
    for i := range n {
        b.WriteString(strconv.Itoa(i % 10))
    }
    return b.String()
}

func main() {
    allocs := func(f func()) float64 { return testing.AllocsPerRun(200, f) } // average heap allocations per call

    fmt.Printf("%-28s %4.0f\\n", "return a small struct:", allocs(func() { sinkPoint = pointValue(1, 2) }))
    fmt.Printf("%-28s %4.0f\\n", "return a pointer:", allocs(func() { sinkPtr = pointPtr(1, 2) }))
    fmt.Printf("%-28s %4.0f\\n", "append 1000, no capacity:", allocs(func() { sinkInts = appendGrow(1000) }))
    fmt.Printf("%-28s %4.0f\\n", "append 1000, preallocated:", allocs(func() { sinkInts = appendPrealloc(1000) }))
    fmt.Printf("%-28s %4.0f\\n", "string += 100 times:", allocs(func() { sinkStr = concat(100) }))
    fmt.Printf("%-28s %4.0f\\n", "strings.Builder, 100 writes:", allocs(func() { sinkStr = builder(100) }))
    fmt.Printf("%-28s %4.0f\\n", "map, 1000 inserts:", allocs(func() {
        m := map[int]int{}
        for i := range 1000 {
            m[i] = i
        }
        sinkMap = m
    }))
    fmt.Printf("%-28s %4.0f\\n", "map with size hint:", allocs(func() {
        m := make(map[int]int, 1000)
        for i := range 1000 {
            m[i] = i
        }
        sinkMap = m
    }))
}`,
          },
        ],
        output: `return a small struct:          0
return a pointer:               1
append 1000, no capacity:      12
append 1000, preallocated:      1
string += 100 times:           99
strings.Builder, 100 writes:    1
map, 1000 inserts:             22
map with size hint:             6`,
        explain: `- \`testing.AllocsPerRun\` counts heap allocations, so you can see escape analysis at work. (It's in the \`testing\` package but works in any program.)
- Ask the compiler directly: \`go build -gcflags=-m .\` prints lines like \`&Point{...} escapes to heap\` for \`pointPtr\` and nothing for \`pointValue\`.
- Growing a slice from empty reallocates about a dozen times on the way to 1000 elements; the right capacity up front needs one. Maps behave the same way: a size hint avoids most of the rehashing.
- \`s += ...\` in a loop is quadratic: each step allocates and copies a new string. The single-digit strings in this example don't allocate at all (Go keeps them static), so \`strings.Builder\` needs exactly one allocation.
- These counts come from Go 1.24 and can shift between versions. Measure with benchmarks (\`-benchmem\`) on your own code instead of memorizing numbers.`,
      },
      {
        title: "Tuning the GC and writing profiles",
        variants: [
          {
            lang: "go",
            code: `package main

import (
    "fmt"
    "os"
    "path/filepath"
    "runtime"
    "runtime/debug"
    "runtime/pprof"
)

var sink []byte

func churn(mb int) { // allocate garbage: 1 KB at a time, mb megabytes in total
    for range mb * 1024 {
        sink = make([]byte, 1024)
    }
}

func gcCycles(f func()) uint32 {
    var before, after runtime.MemStats
    runtime.ReadMemStats(&before)
    f()
    runtime.ReadMemStats(&after)
    return after.NumGC - before.NumGC
}

func fib(n int) int {
    if n < 2 {
        return n
    }
    return fib(n-1) + fib(n-2)
}

func main() {
    runtime.GC()
    atDefault := gcCycles(func() { churn(200) })

    old := debug.SetGCPercent(400) // like GOGC=400: let the heap grow 5x before collecting
    atGOGC400 := gcCycles(func() { churn(200) })
    fmt.Println("default GOGC is", old, "| GOGC=400 ran fewer collections:", atGOGC400 < atDefault)

    debug.SetGCPercent(-1) // like GOGC=off
    off := gcCycles(func() { churn(64) })
    fmt.Println("collections with the GC off:", off)

    debug.SetMemoryLimit(32 << 20) // like GOMEMLIMIT=32MiB: the GC turns on as the limit approaches
    limited := gcCycles(func() { churn(200) })
    fmt.Println("GC off + 32 MiB limit, collections happened:", limited > 0)
    debug.SetGCPercent(100)
    debug.SetMemoryLimit(-1 >> 1)

    dir, err := os.MkdirTemp("", "pprof-demo")
    if err != nil {
        fmt.Println(err)
        return
    }
    defer os.RemoveAll(dir)

    cpuFile, _ := os.Create(filepath.Join(dir, "cpu.prof"))
    if err := pprof.StartCPUProfile(cpuFile); err != nil {
        fmt.Println(err)
        return
    }
    fmt.Println("fib(32) =", fib(32)) // the work we profile
    pprof.StopCPUProfile()
    cpuFile.Close()

    heapFile, _ := os.Create(filepath.Join(dir, "heap.prof"))
    runtime.GC() // up-to-date heap statistics
    _ = pprof.WriteHeapProfile(heapFile)
    heapFile.Close()

    for _, name := range []string{"cpu.prof", "heap.prof"} {
        info, err := os.Stat(filepath.Join(dir, name))
        fmt.Printf("%s written: %v\\n", name, err == nil && info.Size() > 0)
    }
}`,
          },
          {
            lang: "bash",
            code: `# Inspect a CPU profile: top functions, then an interactive web UI with a flame graph
go tool pprof -top cpu.prof
go tool pprof -http=:8081 cpu.prof

# Profiles straight from tests and benchmarks
go test -bench=. -cpuprofile=cpu.prof -memprofile=mem.prof ./...

# A live service that imports _ "net/http/pprof" (serve it on an internal-only port!)
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30   # CPU for 30s
go tool pprof http://localhost:6060/debug/pprof/heap                 # live heap
curl 'http://localhost:6060/debug/pprof/goroutine?debug=2'            # every goroutine's stack: find leaks

# Execution trace: scheduling, GC pauses, blocking
curl -o trace.out 'http://localhost:6060/debug/pprof/trace?seconds=5' && go tool trace trace.out

# Escape analysis decisions, and profile-guided optimization
go build -gcflags=-m ./...
cp cpu.prof ./cmd/server/default.pgo && go build ./cmd/server   # PGO uses it automatically

# Tune the GC without code changes
GOGC=200 GOMEMLIMIT=900MiB ./server
GODEBUG=gctrace=1 ./server    # one line per GC cycle: heap sizes, pause times, CPU use`,
          },
        ],
        output: `default GOGC is 100 | GOGC=400 ran fewer collections: true
collections with the GC off: 0
GC off + 32 MiB limit, collections happened: true
fib(32) = 2178309
cpu.prof written: true
heap.prof written: true`,
        explain: `- With \`GOGC=100\`, a program with a tiny live heap collects every few megabytes of allocation; \`GOGC=400\` lets the heap grow further between cycles, trading memory for less GC CPU.
- \`GOGC=off\` alone would let the heap grow without bound. Combined with \`GOMEMLIMIT\`, the GC stays idle until memory approaches the limit: a common setting for containers with a known memory budget.
- \`go tool pprof -http\` opens a browser UI with a flame graph: wide bars are where the time goes. For this program it would show \`main.fib\` taking nearly all the samples.
- \`GODEBUG=gctrace=1\` is the quickest way to see whether GC is a problem at all before tuning anything.`,
      },
    ],
    interview: [
      {
        q: "Explain Go's G-M-P scheduler.",
        a: "G is a goroutine, M an OS thread, P a logical processor holding a local run queue; GOMAXPROCS sets the number of Ps. An M needs a P to run Go code. Each P schedules Gs from its local queue (with a runnext slot for locality), periodically checking the global queue; idle Ps steal half of another P's queue (work stealing). On a blocking syscall the M detaches from its P, which is handed to another (possibly new) M so other goroutines keep running. Network I/O uses the netpoller (epoll/kqueue/IOCP), parking goroutines without blocking threads. The sysmon thread handles preemption of long-running Gs (async, signal-based since 1.14) and retakes Ps from long syscalls.",
        freq: "very-common",
      },
      {
        q: "How does Go's garbage collector work?",
        a: "It's a concurrent, non-generational, non-moving tri-color mark-and-sweep collector. A cycle starts when the heap reaches a target set by GOGC (default: double the live heap) or when approaching GOMEMLIMIT. After a short stop-the-world to enable the write barrier, marking runs concurrently with the program (dedicated workers use ~25% of CPU, and allocating goroutines do 'mark assist' work if they allocate quickly), then another short STW ends marking, and sweeping happens lazily. Pauses are typically sub-millisecond. You reduce GC cost by allocating less, and tune with GOGC/GOMEMLIMIT.",
        freq: "very-common",
      },
      {
        q: "What is escape analysis, and why does it matter for performance?",
        a: "A compile-time analysis deciding whether a variable can be allocated on the goroutine's stack or must go to the heap because a reference may outlive the function (returned pointers, storing into heap objects, interface conversions of non-constant values, closures captured by goroutines, unknown-size allocations). Stack allocation is nearly free and needs no GC; heap allocations cost allocation time and GC work. `go build -gcflags=-m` shows decisions. Reducing escapes in hot paths (return values not pointers, preallocate, avoid needless interfaces) lowers latency and GC pressure.",
        freq: "common",
      },
      {
        q: "How would you investigate high memory usage or latency in a Go service?",
        a: "First check metrics (RSS, heap in use, GC frequency/pauses via runtime/metrics or GODEBUG=gctrace=1, goroutine count). Then collect profiles via net/http/pprof: heap (inuse_space for retained memory, alloc_space for churn), goroutine (leaks, stuck goroutines), CPU (hot paths, GC share), mutex and block (contention), and execution traces for latency outliers. Compare profiles over time with -base. Fix the biggest contributors (leaks, unbounded caches, excess allocations), verify with benchmarks, then consider GOGC/GOMEMLIMIT tuning and PGO.",
        freq: "common",
      },
      {
        q: "What does 'happens-before' mean in the Go memory model?",
        a: "It's the ordering guarantee that determines whether a read is guaranteed to observe a write. Within one goroutine, program order applies. Across goroutines, ordering is only established by synchronization: a channel send happens before the corresponding receive completes; closing a channel happens before a receive that returns because it's closed; an Unlock happens before the next Lock; sync.Once's function completes before any Do returns; WaitGroup Done before Wait returns; and atomic operations are sequentially consistent. Without such an edge, concurrent conflicting accesses are a data race and the result is undefined.",
      },
    ],
    quiz: [
      {
        q: "In G-M-P, what does P represent?",
        options: ["A process", "A scheduling context with a run queue", "A goroutine", "A page of memory"],
        answer: 1,
        explain: "GOMAXPROCS sets how many Ps exist.",
      },
      {
        q: "What happens to a P when its M blocks in a syscall?",
        options: ["It waits", "It's handed to another M", "It's destroyed", "Its goroutines are cancelled"],
        answer: 1,
        explain: "So other goroutines keep running.",
      },
      {
        q: "GOGC=100 means...",
        options: ["GC every 100ms", "Collect when the heap grows 100% over the live heap", "Use 100 MB max", "100 GC workers"],
        answer: 1,
        explain: "Higher values collect less often and use more memory.",
      },
      {
        q: "Which command shows escape analysis decisions?",
        options: ["go vet -escape", "go build -gcflags=-m", "go tool pprof", "go env"],
        answer: 1,
        explain: "Look for 'escapes to heap' and 'moved to heap'.",
      },
      {
        q: "Since Go 1.14, a goroutine in a tight loop without function calls...",
        options: ["Blocks all others on its P forever", "Is preempted asynchronously", "Is killed", "Runs on its own thread"],
        answer: 1,
        explain: "Signal-based async preemption.",
      },
    ],
  },
];
