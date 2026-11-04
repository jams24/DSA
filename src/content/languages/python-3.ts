import type { Lesson } from "../types";

// Python track, part 3: Advanced.

export const pyAdvanced: Lesson[] = [
  // ------------------------------------------------------------------ CONCURRENCY
  {
    id: "py-concurrency",
    stage: "Advanced",
    title: "Threads, processes and the GIL",
    tagline: "What the GIL really does, when threads help and when they don't, locks and queues, ThreadPoolExecutor vs ProcessPoolExecutor, free-threaded Python, and the classic thread-ordering puzzles.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["pygil"],
    concept: `
## Concurrency vs parallelism
**Concurrency** means several tasks are in progress at the same time, taking turns. **Parallelism** means several tasks execute at the same instant, on different CPU cores. Waiting for a network makes good use of concurrency; crunching numbers needs parallelism. Python has three tools, and choosing between them depends almost entirely on one thing: the GIL.

## The GIL
CPython's **Global Interpreter Lock** is a mutex that lets only one thread execute Python bytecode at a time, in each interpreter. It keeps reference counting and the internals simple and makes single-threaded code fast. Its consequences:
- A thread **releases** the GIL whenever it blocks on I/O (sockets, files, \`time.sleep\`, database drivers) and while many C extensions run heavy code (NumPy, hashlib on large inputs, zlib, image libraries). So **threads speed up I/O-bound work**.
- Pure-Python **CPU-bound** work doesn't speed up with threads: they take turns holding the GIL (it's handed over every 5 ms, \`sys.getswitchinterval()\`).
- The GIL does **not** make your code thread-safe. \`counter += 1\` is a read, an add and a write; a thread can be switched out between them and updates get lost. Protect shared state with a \`Lock\`, or don't share it.

Play with the simulator above: four tasks, CPU-bound or I/O-bound, on each of Python's execution models.

## Choosing a model
| Workload | Use | Why |
|---|---|---|
| I/O-bound, tens to hundreds of tasks, blocking libraries | \`ThreadPoolExecutor\` | simple, works with \`requests\`, DB drivers, file I/O |
| I/O-bound, thousands of connections | \`asyncio\` | one thread, tasks cost a few KB each |
| CPU-bound pure Python | \`ProcessPoolExecutor\` / \`multiprocessing\` | one interpreter and GIL per process, true parallelism |
| CPU-bound numeric | NumPy / pandas / Polars | vectorized C code that releases the GIL |
| CPU-bound, hot loop | Cython, mypyc, Rust (PyO3), Numba | compiled code, often 10–100× faster |

## The tools
- **threading**: \`Thread\`, plus synchronization primitives: \`Lock\` (mutual exclusion), \`RLock\` (re-entrant), \`Event\` (a flag threads wait on), \`Condition\` (wait until a predicate holds), \`Semaphore\` (at most N holders), \`Barrier\`.
- **queue.Queue**: a thread-safe FIFO for producer/consumer designs. Passing messages through queues avoids most locking bugs.
- **concurrent.futures**: the high-level API. \`ThreadPoolExecutor\` and \`ProcessPoolExecutor\` share one interface: \`submit()\` returns a \`Future\`, \`map()\` keeps input order, \`as_completed()\` yields futures as they finish, and exceptions are re-raised by \`future.result()\`.
- **multiprocessing**: \`Pool\`, \`Process\`, \`Queue\`, \`shared_memory\`. Processes don't share memory: arguments and results are **pickled** across, so the function and data must be picklable (no lambdas, no local functions) and large payloads cost time. On macOS and Windows (and, from 3.14, Linux) new processes **re-import** your main module, so process-starting code must be inside \`if __name__ == "__main__":\`.

## Beyond the GIL
- **Free-threaded Python** (PEP 703): a separate build (\`python3.13t\`, \`python3.14t\`) with no GIL, so threads run Python code in parallel. Experimental in 3.13, officially supported but still optional in 3.14. Single-threaded code runs a bit slower, and C extensions must declare support (otherwise importing them turns the GIL back on). Check with \`sys._is_gil_enabled()\`.
- **Subinterpreters**: since 3.12 each interpreter can have its own GIL, and 3.14 adds the \`concurrent.interpreters\` module and \`InterpreterPoolExecutor\`: parallelism inside one process, isolated like processes but cheaper.

## Pitfalls
- **Race conditions**: check-then-act (\`if balance >= x: balance -= x\`) must be atomic.
- **Deadlocks**: two threads each holding a lock the other needs. Acquire locks in a consistent order, hold them briefly, and use timeouts.
- Always \`join()\` threads or use executors in \`with\` blocks; mark background threads \`daemon=True\` only if they can be killed at any moment.
- Never share a database connection or an HTTP session across threads unless the library says it's thread-safe; use a pool.
`,
    keyPoints: [
      "The GIL lets one thread run Python bytecode at a time; it's released during blocking I/O",
      "Threads speed up I/O-bound work, not pure-Python CPU-bound work",
      "The GIL doesn't make code thread-safe: protect read-modify-write with a Lock",
      "ProcessPoolExecutor gives real parallelism; data is pickled between processes",
      "Prefer queues and executors over hand-managed threads and shared state",
      "Free-threaded builds (3.13t, 3.14t) and subinterpreters remove the single-GIL limit",
    ],
    code: [
      {
        title: "Race conditions, locks and events",
        variants: [{ lang: "python", code: `import threading
import time

counter = 0


def unsafe_increment(times: int) -> None:
    global counter
    for _ in range(times):
        value = counter      # 1. read
        time.sleep(0)        #    (let another thread run, as the OS may do at any moment)
        counter = value + 1  # 2. write back: overwrites anything other threads wrote meanwhile


threads = [threading.Thread(target=unsafe_increment, args=(1000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()  # wait for all of them
print("without a lock:", "lost updates" if counter < 4000 else "got lucky", "(expected 4000)")

# The fix: make read-modify-write atomic with a Lock.
counter = 0
lock = threading.Lock()


def safe_increment(times: int) -> None:
    global counter
    for _ in range(times):
        with lock:  # only one thread at a time inside this block
            value = counter
            time.sleep(0)
            counter = value + 1


threads = [threading.Thread(target=safe_increment, args=(1000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("with a lock:", counter)


# Shared objects with internal locking are simpler: no explicit lock needed.
class BankAccount:
    def __init__(self, balance: int) -> None:
        self.balance = balance
        self._lock = threading.Lock()

    def withdraw(self, amount: int) -> bool:
        with self._lock:  # check-then-act must be one atomic step
            if self.balance >= amount:
                time.sleep(0)
                self.balance -= amount
                return True
            return False


account = BankAccount(100)
results: list[bool] = []
workers = [threading.Thread(target=lambda: results.append(account.withdraw(30))) for _ in range(5)]
for w in workers:
    w.start()
for w in workers:
    w.join()
print("withdrawals that succeeded:", results.count(True), "balance:", account.balance)

# A thread can be a daemon (killed at exit) and receive a stop signal through an Event.
stop = threading.Event()
beats = 0


def heartbeat() -> None:
    global beats
    while not stop.wait(0.01):  # sleeps 10 ms, or returns True as soon as stop is set
        beats += 1


hb = threading.Thread(target=heartbeat, daemon=True)
hb.start()
time.sleep(0.1)
stop.set()
hb.join()
print("heartbeat stopped cleanly:", not hb.is_alive(), "| beat at least 3 times:", beats >= 3)` }],
        explain: `- \`unsafe_increment\` reads the counter, yields, then writes back \`value + 1\`. When another thread updated the counter in between, that update is overwritten: a **lost update**. Real code doesn't need the \`sleep(0)\`; the interpreter can switch threads between any two bytecodes, so the bug just shows up less often (and only under load, in production).
- \`with lock:\` makes the read-modify-write a critical section: exactly 4000.
- \`BankAccount.withdraw\` is **check-then-act**: checking the balance and subtracting must be one atomic step, or two threads can both see 100 and overdraw. With the lock, exactly three 30-unit withdrawals succeed and 10 is left.
- \`stop.wait(0.01)\` sleeps up to 10 ms but returns \`True\` as soon as the event is set: the standard way to stop a background thread promptly.`,
        output: `without a lock: lost updates (expected 4000)
with a lock: 4000
withdrawals that succeeded: 3 balance: 10
heartbeat stopped cleanly: True | beat at least 3 times: True`,
      },
      {
        title: "ThreadPoolExecutor for I/O-bound work",
        variants: [{ lang: "python", code: `import time
from concurrent.futures import ThreadPoolExecutor, as_completed


def fetch(url: str, delay: float) -> str:
    """Stand-in for a network call: time.sleep releases the GIL, like a socket read does."""
    time.sleep(delay)
    return f"{url} -> 200"


urls = [f"https://api.example.com/items/{i}" for i in range(8)]

start = time.perf_counter()
for url in urls:
    fetch(url, 0.1)
sequential = time.perf_counter() - start

start = time.perf_counter()
with ThreadPoolExecutor(max_workers=8) as pool:  # the with block waits for every task
    results = list(pool.map(fetch, urls, [0.1] * len(urls)))  # results come back in input order
threaded = time.perf_counter() - start

print(results[0], "...", results[-1])
print(f"sequential takes ~0.8 s: {0.75 < sequential < 1.5}")
print(f"8 threads take ~0.1 s:   {threaded < 0.4}")

# submit() returns a Future per task; as_completed yields them as they FINISH.
jobs = {"slow": 0.3, "fast": 0.1, "medium": 0.2}
with ThreadPoolExecutor() as pool:
    futures = {pool.submit(fetch, name, delay): name for name, delay in jobs.items()}
    print("completion order:", [futures[f] for f in as_completed(futures)])


# Exceptions are captured in the Future and re-raised by .result().
def flaky(n: int) -> int:
    if n == 3:
        raise ConnectionError(f"item {n} failed")
    return n * 10


with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(flaky, n) for n in range(5)]
    for f in futures:
        try:
            print("result:", f.result(timeout=5))
        except ConnectionError as e:
            print("error:", e)` }],
        explain: `- \`fetch\` sleeps like a network call would. Sleeping (like waiting on a socket) **releases the GIL**, so eight threads wait at the same time: 0.1 s instead of 0.8 s.
- \`pool.map\` returns results in **input** order. The \`with\` block shuts the pool down and waits for every task.
- \`submit\` returns a \`Future\`; \`as_completed\` yields futures in **completion** order, which is what you want to show progress or handle the fastest results first.
- An exception inside a task doesn't crash the pool: it's stored in the future and re-raised by \`result()\`. Always set a \`timeout\` when waiting on work that could hang.
- In real code, \`fetch\` would use \`requests\` or \`httpx\` with a shared session; a pool of 8 to 32 threads is a common size for I/O work.`,
        output: `https://api.example.com/items/0 -> 200 ... https://api.example.com/items/7 -> 200
sequential takes ~0.8 s: True
8 threads take ~0.1 s:   True
completion order: ['fast', 'medium', 'slow']
result: 0
result: 10
result: 20
error: item 3 failed
result: 40`,
      },
      {
        title: "ProcessPoolExecutor for CPU-bound work",
        note: "Timings depend on your machine; this needs at least 4 CPU cores to show the speed-up.",
        variants: [{ lang: "python", code: `import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def count_primes(limit: int) -> int:
    """Deliberately CPU-heavy pure-Python work."""
    count = 0
    for n in range(2, limit):
        if all(n % d for d in range(2, int(n**0.5) + 1)):
            count += 1
    return count


def timed(executor_cls, chunks: list[int]) -> tuple[list[int], float]:
    start = time.perf_counter()
    with executor_cls(max_workers=4) as pool:
        results = list(pool.map(count_primes, chunks))
    return results, time.perf_counter() - start


# Child processes import this file again, so code that starts processes
# must sit under this guard (required by the "spawn" and "forkserver" start methods, the defaults
# on macOS and Windows, and on Linux since 3.14).
if __name__ == "__main__":
    chunks = [150_000] * 4

    start = time.perf_counter()
    sequential_results = [count_primes(c) for c in chunks]
    sequential = time.perf_counter() - start

    thread_results, threaded = timed(ThreadPoolExecutor, chunks)
    process_results, processes = timed(ProcessPoolExecutor, chunks)

    print("primes below 150,000:", sequential_results[0])
    print("same answers everywhere:", sequential_results == thread_results == process_results)
    print("threads are no faster than one core (GIL):", threaded > sequential * 0.6)
    print("processes are much faster:", processes < sequential * 0.6)` }],
        explain: `- \`count_primes\` is pure-Python computation: it never releases the GIL.
- With four **threads**, only one runs bytecode at a time, so the total is about the same as doing it sequentially (often slightly worse).
- With four **processes**, each has its own interpreter and GIL and runs on its own core: roughly 3–4× faster, minus the start-up cost.
- \`pool.map(count_primes, chunks)\` pickles each argument, sends it to a worker process, and pickles the result back, so keep payloads small (send a file path or an ID, not a 1 GB DataFrame). The function must be importable at module level.
- The \`if __name__ == "__main__":\` guard matters: worker processes import this file, and without the guard each would start its own pool.
- Split work into a few big chunks: per-task overhead (pickling, IPC) dwarfs tiny tasks. \`map(..., chunksize=100)\` batches small items.`,
        output: `primes below 150,000: 13848
same answers everywhere: True
threads are no faster than one core (GIL): True
processes are much faster: True`,
      },
      {
        title: "Producer/consumer with queue.Queue",
        variants: [{ lang: "python", code: `import queue
import threading

tasks: queue.Queue[int | None] = queue.Queue(maxsize=10)  # bounded: producers wait when it's full
results: queue.Queue[tuple[str, int, int]] = queue.Queue()
SENTINEL = None


def worker(name: str) -> None:
    while True:
        n = tasks.get()  # blocks until an item is available
        try:
            if n is SENTINEL:
                return  # stop signal
            results.put((name, n, n * n))
        finally:
            tasks.task_done()


workers = [threading.Thread(target=worker, args=(f"w{i}",)) for i in range(3)]
for w in workers:
    w.start()

for n in range(1, 13):  # the producer
    tasks.put(n)
tasks.join()  # wait until every item has been processed (task_done called for each)

for _ in workers:  # one sentinel per worker
    tasks.put(SENTINEL)
for w in workers:
    w.join()

done = sorted(results.get() for _ in range(results.qsize()))
by_value = sorted(done, key=lambda r: r[1])
print("squares:", [sq for _, _, sq in by_value])
print("every item processed exactly once:", [n for _, n, _ in by_value] == list(range(1, 13)))` }],
        explain: `- \`Queue(maxsize=10)\` is thread-safe and **bounded**: a fast producer blocks in \`put()\` when consumers fall behind (back-pressure), instead of filling memory.
- Each worker loops on \`tasks.get()\`, which blocks until there's work. \`task_done()\` in a \`finally\` marks the item processed even if processing fails.
- \`tasks.join()\` waits until every item put so far has been marked done.
- Shutdown uses a **sentinel**: one \`None\` per worker, each worker exits when it receives one. (3.13 added \`Queue.shutdown()\` as an alternative.)
- Workers finish in any order, so the results are sorted before printing. In concurrent programs, never rely on the order in which threads happen to run.`,
        output: `squares: [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]
every item processed exactly once: True`,
      },
      {
        title: "Interview puzzles: making threads take turns",
        variants: [{ lang: "python", code: `# Classic interview puzzles (LeetCode 1114 and 1115): make threads run in a fixed order.
import threading


class Foo:
    """1114. Print in Order: first() then second() then third(), whatever order the threads start."""

    def __init__(self) -> None:
        self.first_done = threading.Event()
        self.second_done = threading.Event()

    def first(self, out: list[str]) -> None:
        out.append("first")
        self.first_done.set()

    def second(self, out: list[str]) -> None:
        self.first_done.wait()
        out.append("second")
        self.second_done.set()

    def third(self, out: list[str]) -> None:
        self.second_done.wait()
        out.append("third")


foo, out = Foo(), []
threads = [threading.Thread(target=fn, args=(out,)) for fn in (foo.third, foo.second, foo.first)]
for t in threads:
    t.start()  # started in reverse order on purpose
for t in threads:
    t.join()
print(out)


class FooBar:
    """1115. Print FooBar Alternately: two semaphores pass a turn back and forth."""

    def __init__(self, n: int) -> None:
        self.n = n
        self.foo_turn = threading.Semaphore(1)
        self.bar_turn = threading.Semaphore(0)

    def foo(self, out: list[str]) -> None:
        for _ in range(self.n):
            self.foo_turn.acquire()
            out.append("foo")
            self.bar_turn.release()

    def bar(self, out: list[str]) -> None:
        for _ in range(self.n):
            self.bar_turn.acquire()
            out.append("bar")
            self.foo_turn.release()


fb, out = FooBar(3), []
threads = [threading.Thread(target=fb.bar, args=(out,)), threading.Thread(target=fb.foo, args=(out,))]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("".join(out))


class ZeroEvenOdd:
    """1116. Print Zero Even Odd: one Condition, and each thread waits until it's its turn."""

    def __init__(self, n: int) -> None:
        self.n = n
        self.current = 1  # the next number to print
        self.zero_turn = True
        self.cond = threading.Condition()

    def _run(self, my_turn, emit) -> None:
        while True:
            with self.cond:  # wait_for releases the lock while sleeping, re-checks on every notify
                self.cond.wait_for(lambda: self.current > self.n or my_turn())
                if self.current > self.n:
                    return
                emit()
                self.cond.notify_all()

    def zero(self, out: list[str]) -> None:
        def emit():
            out.append("0")
            self.zero_turn = False

        self._run(lambda: self.zero_turn, emit)

    def number(self, out: list[str], parity: int) -> None:
        def emit():
            out.append(str(self.current))
            self.current += 1
            self.zero_turn = True

        self._run(lambda: not self.zero_turn and self.current % 2 == parity, emit)


zeo, out = ZeroEvenOdd(5), []
threads = [
    threading.Thread(target=zeo.number, args=(out, 0)),  # even
    threading.Thread(target=zeo.number, args=(out, 1)),  # odd
    threading.Thread(target=zeo.zero, args=(out,)),
]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("".join(out))` }],
        explain: `These are LeetCode's concurrency problems, and a favourite way to test whether you understand synchronization primitives.
- **Print in Order** (1114): two \`Event\`s. \`second()\` waits for \`first_done\`, \`third()\` waits for \`second_done\`. Even though the threads start in reverse order, the output is always \`first, second, third\`.
- **FooBar** (1115): two \`Semaphore\`s pass a "turn" back and forth. \`foo_turn\` starts at 1 and \`bar_turn\` at 0, so \`foo\` goes first; each thread releases the other's semaphore after printing.
- **Zero Even Odd** (1116): one \`Condition\` and shared state. \`wait_for(predicate)\` sleeps until the predicate is true, re-checking after every \`notify_all()\`, so each of the three threads acts only on its turn. The extra \`self.current > self.n\` check lets every thread exit at the end.

The same tools solve **Building H2O** (1117, a semaphore for H and one for O plus a \`Barrier(3)\`), **Fizz Buzz Multithreaded** (1195, a Condition) and **Dining Philosophers** (1226, acquire forks in a fixed global order to avoid deadlock).`,
        output: `['first', 'second', 'third']
foobarfoobarfoobar
0102030405`,
      },
    ],
    interview: [
      {
        q: "What is the GIL, and why does Python have it?",
        a: `The Global Interpreter Lock is a mutex in CPython that allows only one thread to execute Python bytecode at a time within an interpreter. It exists because CPython's memory management uses **reference counting**, which isn't thread-safe without locking; one global lock made the interpreter and C extensions simple and single-threaded code fast. Consequences: threads don't give parallel speed-ups for pure-Python CPU work, but they do for I/O, because blocking calls release the GIL. Workarounds: multiprocessing, C extensions that release the GIL (NumPy), subinterpreters with per-interpreter GILs (3.12+), and the free-threaded build (PEP 703, supported from 3.14).`,
        freq: "very-common",
      },
      {
        q: "Threads, processes or asyncio: how do you choose?",
        a: `- **I/O-bound, moderate concurrency, synchronous libraries** → threads (\`ThreadPoolExecutor\`).
- **I/O-bound, very high concurrency** (thousands of sockets), async libraries available → \`asyncio\`.
- **CPU-bound pure Python** → processes (\`ProcessPoolExecutor\`), or vectorize with NumPy, or compile the hot path (Cython, Rust).
- **Mixed**: asyncio for the I/O, with \`to_thread\` / \`run_in_executor\` for blocking or CPU-heavy pieces.
Then mention the costs: processes need pickling and more memory, threads need locks around shared state, asyncio needs async libraries all the way down.`,
        freq: "very-common",
      },
      {
        q: "If there's a GIL, why do you still need locks?",
        a: `The GIL only guarantees that a single bytecode instruction runs without interruption. Most operations take several instructions: \`counter += 1\` loads, adds and stores; \`if key not in d: d[key] = make()\` checks then acts. The interpreter can switch threads between them, so another thread can interleave and break the invariant. Some single operations on built-in types happen to be atomic in CPython (\`list.append\`, \`dict[k] = v\`), but that's an implementation detail, and free-threaded builds make reasoning about it even riskier. Use \`Lock\` for compound operations, or avoid shared mutable state with queues.`,
        freq: "common",
      },
      {
        q: "What are the costs and pitfalls of multiprocessing?",
        a: `Each process is a full interpreter: start-up time (spawn re-imports your main module) and tens of MB of memory each. Arguments and results are **pickled**, so the function must be importable at module level (no lambdas or closures), objects must be picklable, and large data is slow to transfer (use \`shared_memory\`, memory-mapped files, or pass paths instead). Process-starting code must be under \`if __name__ == "__main__":\`. Global state isn't shared: each process has its own copy. Exceptions in workers are re-raised in the parent through \`Future.result()\`.`,
        freq: "common",
      },
      {
        q: "What is free-threaded Python?",
        a: `A build of CPython without the GIL (PEP 703), installed as \`python3.13t\` or \`python3.14t\`. Threads then run Python code truly in parallel on multiple cores. It was experimental in 3.13 and became officially supported (but still optional, not the default) in 3.14. Making it work required thread-safe reference counting (biased reference counting), per-object locks inside built-in containers, and changes to the allocator. Costs: single-threaded code is somewhat slower, and C extensions must be rebuilt and declare support, or importing them re-enables the GIL. \`sys._is_gil_enabled()\` tells you which mode you're in.`,
        freq: "occasional",
      },
      {
        q: "How do you avoid deadlocks?",
        a: `A deadlock needs threads that each hold a lock while waiting for another held by someone else. Prevent it by: acquiring locks in a **consistent global order**; holding locks as briefly as possible and never calling unknown code (callbacks, I/O) while holding one; using \`acquire(timeout=...)\` so a stuck thread can back off; preferring a single lock or lock-free designs (queues, immutable data, one owner thread per resource); and using \`RLock\` when the same thread may re-enter. The Dining Philosophers problem is the classic illustration.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "Four threads each run a pure-Python loop that takes 1 s alone. On a standard (GIL) CPython with 8 cores, roughly how long do they take together?",
        options: ["~0.25 s", "~1 s", "~4 s", "~8 s"],
        answer: 2,
        explain: "Only one thread executes bytecode at a time, so CPU-bound threads take about as long as running sequentially.",
      },
      {
        q: "Which operation releases the GIL while it waits?",
        options: ["A for loop summing numbers", "time.sleep or a socket recv", "Appending to a list", "String concatenation"],
        answer: 1,
        explain: "Blocking system calls release the GIL so other threads can run Python code meanwhile.",
      },
      {
        q: "Why must process-pool code be inside if __name__ == \"__main__\": on macOS and Windows?",
        options: ["For speed", "Child processes re-import the main module; without the guard they would start pools recursively", "It's a style rule only", "To share global variables"],
        answer: 1,
        explain: "The spawn and forkserver start methods import the main module in each child.",
      },
      {
        q: "What does ThreadPoolExecutor.map return?",
        options: ["Results in completion order", "Results in input order", "A set of results", "Futures only"],
        answer: 1,
        explain: "map yields results in the order of its inputs; use submit + as_completed for completion order.",
      },
      {
        q: "Which can you NOT pass to ProcessPoolExecutor.submit as the function?",
        options: ["A module-level function", "A lambda", "A built-in like pow", "A function imported from another module"],
        answer: 1,
        explain: "Functions are pickled by reference to their module and name; lambdas and nested functions can't be pickled.",
      },
      {
        q: "Two threads must alternate strictly (A, B, A, B...). Which primitives fit best?",
        options: ["Two semaphores (or a Condition)", "One Event", "A daemon thread", "A ThreadPoolExecutor"],
        answer: 0,
        explain: "Each thread waits on its own semaphore and releases the other's, passing the turn back and forth.",
      },
    ],
    problems: [
      { title: "Print in Order", url: "https://leetcode.com/problems/print-in-order/", difficulty: "Easy", note: "two threading.Event objects" },
      { title: "Print FooBar Alternately", url: "https://leetcode.com/problems/print-foobar-alternately/", difficulty: "Medium", note: "two Semaphores passing the turn" },
      { title: "Print Zero Even Odd", url: "https://leetcode.com/problems/print-zero-even-odd/", difficulty: "Medium", note: "one Condition + wait_for(predicate)" },
      { title: "Building H2O", url: "https://leetcode.com/problems/building-h2o/", difficulty: "Medium", note: "Semaphore(2) for H, Semaphore(1) for O, Barrier(3)" },
      { title: "Fizz Buzz Multithreaded", url: "https://leetcode.com/problems/fizz-buzz-multithreaded/", difficulty: "Medium", note: "shared counter + Condition" },
      { title: "The Dining Philosophers", url: "https://leetcode.com/problems/the-dining-philosophers/", difficulty: "Medium", note: "acquire forks in a fixed order, or one global lock" },
    ],
  },

  // ------------------------------------------------------------------ ASYNC
  {
    id: "py-async",
    stage: "Advanced",
    title: "asyncio and the event loop",
    tagline: "Coroutines, await and the event loop, TaskGroup and gather, semaphores and worker queues, timeouts and cancellation, keeping blocking code off the loop, and async HTTP with httpx.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["pyasync"],
    concept: `
## The event loop
\`asyncio\` runs many tasks concurrently on **one thread**. An \`async def\` function is a **coroutine function**; calling it creates a coroutine object and runs nothing. \`await\` runs another awaitable and, if it has to wait (a socket, a timer), **suspends** the current coroutine and gives control back to the **event loop**, which resumes whichever task is ready. Switching happens only at \`await\`: this is **cooperative multitasking**.

Consequences:
- Thousands of concurrent connections cost a few KB each instead of an OS thread each.
- Between two \`await\`s your code runs alone, so most shared-state races disappear.
- One blocking call (\`time.sleep\`, \`requests.get\`, a long CPU loop) **freezes everything**: no other task, timer or request runs until it returns.

Step through the event loop above to watch tasks move between running, ready and suspended.

## Running things concurrently
\`\`\`python
async def main():
    async with asyncio.TaskGroup() as tg:      # 3.11+: structured concurrency
        t1 = tg.create_task(fetch("a"))
        t2 = tg.create_task(fetch("b"))
    print(t1.result(), t2.result())             # both finished when the block exits

asyncio.run(main())                             # the entry point: one per program
\`\`\`
- **\`TaskGroup\`** waits for all its tasks. If one fails, the others are **cancelled** and the errors are raised together as an \`ExceptionGroup\` (catch them with \`except*\`). Prefer it for new code.
- **\`gather(*aws)\`** returns results in argument order; with \`return_exceptions=True\` failures are returned instead of raised. On a failure it doesn't cancel the other tasks.
- **\`create_task\`** starts a task in the background. Keep a reference to it: the loop only holds weak references, so an unreferenced task can be garbage-collected mid-flight.
- **\`as_completed\`** yields results as they finish.

## Timeouts and cancellation
\`async with asyncio.timeout(2):\` (3.11+) or \`await asyncio.wait_for(aw, 2)\` cancel the work when the deadline passes and raise \`TimeoutError\`. Cancellation is delivered as \`asyncio.CancelledError\` **inside** the task, at its current \`await\`. Use \`try/finally\` for cleanup, and **re-raise** \`CancelledError\` if you catch it (it derives from \`BaseException\`, so \`except Exception\` doesn't swallow it).

## Blocking code
- Blocking I/O from a sync library: \`await asyncio.to_thread(func, *args)\` runs it in a thread pool.
- CPU-heavy work: \`await loop.run_in_executor(process_pool, func, *args)\`.
- Better: use async libraries: **httpx** or **aiohttp** (HTTP), **asyncpg**, **psycopg 3** or SQLAlchemy's asyncio extension (databases), **redis.asyncio**, **aiofiles**.
- \`asyncio.run(main(), debug=True)\` logs callbacks that hog the loop for more than 100 ms.

## Coordination primitives
\`asyncio.Lock\`, \`Semaphore\` (limit concurrency, e.g. at most 10 requests to one API), \`Event\`, \`Condition\`, \`Queue\` (worker pools, back-pressure with \`maxsize\`), \`Barrier\`. They are **not thread-safe**: to hand work to the loop from another thread use \`asyncio.run_coroutine_threadsafe(coro, loop)\` or \`loop.call_soon_threadsafe(...)\`.

## Async iteration and context managers
\`async for\` iterates over **async iterators** (\`__aiter__\`/\`__anext__\`), most easily written as **async generators** (\`async def\` with \`yield\`): paginated APIs, streaming responses, database cursors. \`async with\` uses \`__aenter__\`/\`__aexit__\`, or \`@contextlib.asynccontextmanager\`: connections, sessions, locks.

## asyncio or threads?
Use **asyncio** for servers and clients with many concurrent connections, websockets, and when your libraries are async (FastAPI, Starlette, httpx). Use **threads** for a moderate number of blocking calls, or when the libraries you need are synchronous. Libraries like **anyio** (used by FastAPI) and **trio** offer the same model with stricter structured concurrency. Since 3.14, \`python -m asyncio ps <pid>\` and \`pstree <pid>\` show the tasks of a running program.
`,
    keyPoints: [
      "async def creates coroutines; nothing runs until awaited or scheduled as a task",
      "The event loop switches tasks only at await: cooperative, single-threaded",
      "Use TaskGroup (3.11+) for structured concurrency; gather for simple fan-out",
      "Never block the loop: use async libraries, to_thread, or a process pool",
      "asyncio.timeout + CancelledError (always re-raise it) for deadlines",
      "Semaphore limits concurrency; Queue builds worker pools",
    ],
    code: [
      {
        title: "Coroutines, tasks, TaskGroup and gather",
        variants: [{ lang: "python", code: `import asyncio
import time


async def fetch(name: str, delay: float) -> str:
    print(f"start {name}")
    await asyncio.sleep(delay)  # suspends THIS coroutine; the event loop runs others meanwhile
    print(f"end   {name}")
    return f"{name}: ok"


async def sequential() -> float:
    start = time.perf_counter()
    await fetch("a", 0.2)  # awaiting one at a time: no overlap
    await fetch("b", 0.2)
    return time.perf_counter() - start


async def concurrent() -> float:
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:  # 3.11+: waits for every task when the block ends
        a = tg.create_task(fetch("a", 0.2))
        b = tg.create_task(fetch("b", 0.1))
    print(a.result(), "|", b.result())
    return time.perf_counter() - start


async def main() -> None:
    coro = fetch("x", 0)
    print(type(coro).__name__)  # calling an async function runs nothing yet...
    print(await coro)           # ...until it's awaited

    print("sequential ~0.4 s:", 0.35 < await sequential() < 0.6)
    print("concurrent ~0.2 s:", await concurrent() < 0.35)

    # gather runs awaitables concurrently and returns results in argument order.
    results = await asyncio.gather(fetch("p", 0.1), fetch("q", 0.05))
    print(results)

    # as_completed yields results as they finish, fastest first.
    for next_done in asyncio.as_completed([asyncio.sleep(0.15, "slow"), asyncio.sleep(0.05, "quick")]):
        print("got", await next_done)


asyncio.run(main())  # creates the event loop, runs main() to completion, closes the loop` }],
        explain: `- Calling \`fetch("x", 0)\` returns a **coroutine** object and prints nothing; \`await coro\` runs it.
- \`sequential()\` awaits one call after the other: 0.2 + 0.2 s.
- In \`concurrent()\`, \`tg.create_task\` schedules both; when the first awaits \`asyncio.sleep\`, the loop runs the second. \`b\` finishes first because its sleep is shorter. Leaving the \`async with\` block waits for both: ~0.2 s total.
- \`gather\` also runs its arguments concurrently and returns results in **argument** order, whichever finishes first.
- \`as_completed\` hands back results **as they finish**. (\`asyncio.sleep(delay, result)\` returns \`result\` after the delay.)
- \`asyncio.run(main())\` is the single entry point: it creates the loop, runs the coroutine and closes the loop.`,
        output: `coroutine
start x
end   x
x: ok
start a
end   a
start b
end   b
sequential ~0.4 s: True
start a
start b
end   b
end   a
a: ok | b: ok
concurrent ~0.2 s: True
start p
start q
end   q
end   p
['p: ok', 'q: ok']
got quick
got slow`,
      },
      {
        title: "Bounded concurrency: Semaphore and worker queues",
        variants: [{ lang: "python", code: `import asyncio
import random

random.seed(7)
active = 0
peak = 0


async def download(item: int, limit: asyncio.Semaphore) -> int:
    global active, peak
    async with limit:  # at most 3 downloads in flight, whatever the number of tasks
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(random.uniform(0.01, 0.05))
        active -= 1
        return item * 2


async def worker(name: str, queue: asyncio.Queue[int], results: list[tuple[int, str]]) -> None:
    while True:
        job = await queue.get()
        try:
            await asyncio.sleep(0.01)  # pretend to process the job
            results.append((job, name))
        finally:
            queue.task_done()


async def main() -> None:
    # 1. Many tasks, bounded concurrency with a Semaphore.
    limit = asyncio.Semaphore(3)
    doubled = await asyncio.gather(*(download(i, limit) for i in range(20)))
    print("downloaded:", len(doubled), "| first five:", doubled[:5], "| peak in flight:", peak)

    # 2. A fixed pool of workers pulling from a queue.
    queue: asyncio.Queue[int] = asyncio.Queue()
    results: list[tuple[int, str]] = []
    workers = [asyncio.create_task(worker(f"w{i}", queue, results)) for i in range(3)]
    for job in range(9):
        queue.put_nowait(job)
    await queue.join()  # wait until every job is marked done
    for w in workers:
        w.cancel()  # the workers loop forever: cancel them...
    await asyncio.gather(*workers, return_exceptions=True)  # ...and wait until they've stopped
    print("jobs done:", sorted(job for job, _ in results))
    print("work was shared:", len({name for _, name in results}) == 3)


asyncio.run(main())` }],
        explain: `- Creating 20 tasks at once is fine, but hitting an API with 20 parallel requests may not be. \`async with limit:\` lets at most 3 coroutines in at a time; \`peak\` confirms it never exceeded 3.
- \`gather(*(download(i, limit) for i in range(20)))\` still returns the 20 results in order.
- The second pattern is a fixed **pool of workers** reading from an \`asyncio.Queue\`: \`queue.join()\` waits until every job has been marked \`task_done()\`.
- The workers loop forever, so they're cancelled when the work is done, and \`gather(..., return_exceptions=True)\` waits for the cancellations to complete without raising them.`,
        output: `downloaded: 20 | first five: [0, 2, 4, 6, 8] | peak in flight: 3
jobs done: [0, 1, 2, 3, 4, 5, 6, 7, 8]
work was shared: True`,
      },
      {
        title: "Timeouts, cancellation and to_thread",
        variants: [{ lang: "python", code: `import asyncio
import time


async def slow_query() -> str:
    try:
        await asyncio.sleep(10)
        return "rows"
    except asyncio.CancelledError:
        print("query cancelled: cleaning up")
        raise  # always re-raise CancelledError, or cancellation silently breaks


def blocking_io(n: int) -> str:
    time.sleep(0.1)  # a blocking library call (no async version available)
    return f"report {n}"


async def main() -> None:
    # Timeouts (3.11+): the block's work is cancelled when the deadline passes.
    try:
        async with asyncio.timeout(0.1):
            await slow_query()
    except TimeoutError:
        print("timed out after 0.1 s")

    # wait_for is the older, single-awaitable form.
    try:
        await asyncio.wait_for(slow_query(), timeout=0.1)
    except TimeoutError:
        print("wait_for timed out too")

    # Cancelling a task explicitly.
    task = asyncio.create_task(slow_query())
    await asyncio.sleep(0.01)  # let it start
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("task.cancelled():", task.cancelled())

    # Blocking calls go to a worker thread so the loop stays responsive.
    start = time.perf_counter()
    reports = await asyncio.gather(*(asyncio.to_thread(blocking_io, n) for n in range(5)))
    print(reports, "| in parallel:", time.perf_counter() - start < 0.3)


asyncio.run(main())` }],
        explain: `- \`asyncio.timeout(0.1)\` cancels the work inside the block when the deadline passes and raises \`TimeoutError\` at the \`async with\`.
- Cancellation arrives **inside** \`slow_query\` as \`CancelledError\` at its \`await\`. It cleans up and **re-raises**: swallowing \`CancelledError\` leaves callers waiting forever and breaks timeouts and TaskGroups.
- \`wait_for\` is the older equivalent for a single awaitable.
- \`task.cancel()\` requests cancellation explicitly; awaiting the task then raises \`CancelledError\`, and \`task.cancelled()\` is \`True\`.
- \`asyncio.to_thread\` runs blocking functions in the default thread pool, so five 0.1 s blocking calls overlap and the loop stays free.`,
        output: `query cancelled: cleaning up
timed out after 0.1 s
query cancelled: cleaning up
wait_for timed out too
query cancelled: cleaning up
task.cancelled(): True
['report 0', 'report 1', 'report 2', 'report 3', 'report 4'] | in parallel: True`,
      },
      {
        title: "The classic bug: blocking the event loop",
        variants: [{ lang: "python", code: `import asyncio
import time


async def heartbeat(stop: asyncio.Event) -> float:
    """Ticks every 20 ms and reports the longest gap it saw between ticks."""
    longest, last = 0.0, time.perf_counter()
    while not stop.is_set():
        await asyncio.sleep(0.02)
        now = time.perf_counter()
        longest, last = max(longest, now - last), now
    return longest


async def handler_blocking() -> None:
    time.sleep(0.3)  # BUG: a blocking call inside a coroutine freezes the whole event loop


async def handler_fixed() -> None:
    await asyncio.to_thread(time.sleep, 0.3)  # the loop keeps running while a thread waits
    # (or, better, use an async library: await asyncio.sleep(...), httpx.AsyncClient, asyncpg...)


async def run(handler) -> None:
    stop = asyncio.Event()
    beat = asyncio.create_task(heartbeat(stop))
    await asyncio.sleep(0.05)
    await handler()
    stop.set()
    gap = await beat
    print(f"{handler.__name__}: heartbeat stalled for 0.3 s: {gap > 0.25}")


asyncio.run(run(handler_blocking))
asyncio.run(run(handler_fixed))

# asyncio's debug mode reports slow callbacks like this one:
#   asyncio.run(main(), debug=True)  ->  "Executing <Task ...> took 0.300 seconds"` }],
        explain: `- The \`heartbeat\` task should tick every 20 ms, like a health check, a websocket ping, or simply other users' requests.
- \`handler_blocking\` calls \`time.sleep(0.3)\`. It doesn't \`await\`, so the loop can't switch: the heartbeat is frozen for the full 0.3 s. In a web server, **every** request stalls. \`requests.get\`, a synchronous database driver or a long computation have exactly the same effect.
- \`handler_fixed\` hands the blocking call to a thread with \`await asyncio.to_thread(...)\`: the coroutine suspends, the loop keeps ticking.
- The visualizer's "blocking call" scenario shows the same thing step by step.`,
        output: `handler_blocking: heartbeat stalled for 0.3 s: True
handler_fixed: heartbeat stalled for 0.3 s: False`,
      },
      {
        title: "Async generators, async iterators and async context managers",
        variants: [{ lang: "python", code: `import asyncio
from contextlib import asynccontextmanager


async def paginate(pages: int):
    """An async generator: yields items while awaiting I/O between pages."""
    for page in range(1, pages + 1):
        await asyncio.sleep(0.01)  # fetch the next page
        for item in range(3):
            yield f"p{page}-{item}"


@asynccontextmanager
async def connection(name: str):
    print(f"open {name}")
    await asyncio.sleep(0.01)  # the async handshake
    try:
        yield {"name": name, "queries": 0}
    finally:
        await asyncio.sleep(0.01)  # the async close
        print(f"close {name}")


class Ticker:
    """A class-based async iterator: __aiter__ and an async __anext__."""

    def __init__(self, n: int) -> None:
        self.n = n

    def __aiter__(self):
        return self

    async def __anext__(self) -> int:
        if self.n == 0:
            raise StopAsyncIteration
        await asyncio.sleep(0.01)
        self.n -= 1
        return self.n


async def main() -> None:
    async for item in paginate(2):
        print(item, end=" ")
    print()

    firsts = [item async for item in paginate(3) if item.endswith("-0")]  # async comprehension
    print(firsts)

    async with connection("db") as conn:
        conn["queries"] += 1
        print("using", conn)

    print([n async for n in Ticker(3)])


asyncio.run(main())` }],
        explain: `- \`paginate\` is an **async generator**: it can \`await\` (fetching each page) and \`yield\` items. Consumers use \`async for\`, or an async comprehension \`[x async for x in ...]\`.
- \`@asynccontextmanager\` builds an async context manager from a generator: the handshake before \`yield\`, the close in \`finally\`, used with \`async with\`.
- \`Ticker\` shows the protocol by hand: \`__aiter__\` returns the iterator and the async \`__anext__\` raises \`StopAsyncIteration\` at the end.
- Real-world equivalents: streaming an HTTP response (\`async for chunk in response.aiter_bytes()\`), database cursors, message-queue consumers, \`async with session.begin():\`.`,
        output: `p1-0 p1-1 p1-2 p2-0 p2-1 p2-2 
['p1-0', 'p2-0', 'p3-0']
open db
using {'name': 'db', 'queries': 1}
close db
[2, 1, 0]`,
      },
      {
        title: "Concurrent HTTP requests with httpx.AsyncClient",
        note: "Needs httpx (pip install httpx). It uses a mock transport, so no network is required.",
        variants: [{ lang: "python", code: `import asyncio
import json

import httpx


# A fake API so the example runs offline: MockTransport routes requests to this function.
async def fake_api(request: httpx.Request) -> httpx.Response:
    await asyncio.sleep(0.05)  # network latency
    user_id = int(request.url.path.rsplit("/", 1)[-1])
    if user_id == 4:
        return httpx.Response(404, json={"detail": "not found"})
    return httpx.Response(200, json={"id": user_id, "name": f"user{user_id}"})


async def get_user(client: httpx.AsyncClient, user_id: int) -> dict | None:
    response = await client.get(f"/users/{user_id}")
    if response.status_code == 404:
        return None
    response.raise_for_status()  # turn other 4xx/5xx into exceptions
    return response.json()


async def main() -> None:
    # One client for the whole program: it pools connections (reuses TCP/TLS sessions).
    async with httpx.AsyncClient(
        base_url="https://api.example.com",
        transport=httpx.MockTransport(fake_api),  # remove this line to talk to a real server
        timeout=httpx.Timeout(5.0),  # always set timeouts on network calls
    ) as client:
        loop = asyncio.get_running_loop()
        start = loop.time()
        users = await asyncio.gather(*(get_user(client, i) for i in range(1, 6)))
        elapsed = loop.time() - start
    print(json.dumps(users))
    print("5 requests concurrently in ~0.05 s:", elapsed < 0.2)


asyncio.run(main())` }],
        explain: `- \`httpx.AsyncClient\` is used as an async context manager and shared for all requests: it keeps a **connection pool**, so requests to the same host reuse TCP and TLS connections.
- \`base_url\` and \`timeout\` are set once. Always set timeouts on network calls; the default of waiting forever is a classic outage cause.
- \`gather\` sends five requests concurrently: ~0.05 s instead of ~0.25 s.
- \`raise_for_status()\` turns 4xx/5xx responses into exceptions; here 404 is handled explicitly as "no such user".
- \`MockTransport\` routes requests to a local function, which is also how you **test** HTTP clients without a network. Remove the \`transport=\` line to call a real API.`,
        output: `[{"id": 1, "name": "user1"}, {"id": 2, "name": "user2"}, {"id": 3, "name": "user3"}, null, {"id": 5, "name": "user5"}]
5 requests concurrently in ~0.05 s: True`,
      },
    ],
    interview: [
      {
        q: "How does asyncio achieve concurrency on a single thread?",
        a: `Coroutines are functions that can suspend at \`await\`. The **event loop** keeps a queue of ready tasks and runs one at a time; when a task awaits something that isn't ready (a socket read, a timer), it suspends, registering interest with the OS's I/O notification mechanism (epoll, kqueue, IOCP), and the loop runs the next ready task. When the OS reports the socket is readable, the loop resumes the waiting task. Many tasks make progress while waiting on I/O, but only one runs Python code at any moment, and switches only happen at \`await\` points.`,
        freq: "very-common",
      },
      {
        q: "What happens if you call a blocking function inside a coroutine?",
        a: `The whole event loop stops until it returns: no other task runs, timers fire late, every connection served by that loop stalls, and health checks may fail. Common culprits: \`time.sleep\`, \`requests\`, synchronous database drivers, file I/O on slow disks, and heavy CPU work (JSON parsing huge payloads, image processing). Fixes: use the async equivalent (\`asyncio.sleep\`, httpx, asyncpg), offload with \`await asyncio.to_thread(fn)\` for blocking I/O, or \`loop.run_in_executor(process_pool, fn)\` for CPU work. \`asyncio.run(main(), debug=True)\` reports slow steps.`,
        freq: "very-common",
      },
      {
        q: "What's the difference between gather and TaskGroup?",
        a: `Both run awaitables concurrently. \`gather\` returns results in order; if one raises, the exception propagates to the awaiting code but the **other tasks keep running** (orphaned unless you cancel them), unless you pass \`return_exceptions=True\` to collect errors as values. \`TaskGroup\` (3.11+) is **structured concurrency**: when one task fails, the rest are cancelled, and the block raises an \`ExceptionGroup\` containing every failure; no task outlives the \`async with\` block. Prefer TaskGroup for new code, and gather with \`return_exceptions=True\` when partial results are acceptable.`,
        freq: "common",
      },
      {
        q: "How does cancellation work in asyncio?",
        a: `\`task.cancel()\` (or a timeout, or a TaskGroup failure) schedules a \`CancelledError\` to be thrown into the coroutine at its current \`await\`. The coroutine can run cleanup in \`finally\` or \`except CancelledError:\` but should re-raise it; swallowing it breaks timeouts and structured concurrency. \`CancelledError\` derives from \`BaseException\` (since 3.8), so \`except Exception\` doesn't catch it accidentally. \`asyncio.shield(aw)\` protects an inner operation from cancellation of the outer task.`,
        freq: "common",
      },
      {
        q: "How would you limit an async crawler to 10 concurrent requests?",
        a: `Either wrap each request in a shared \`asyncio.Semaphore(10)\` (\`async with sem: await client.get(url)\`) and create all the tasks, or start exactly 10 worker tasks that pull URLs from an \`asyncio.Queue\` (better when there are millions of URLs, since you don't create a task per URL up front). Share one \`httpx.AsyncClient\` with connection limits, set timeouts, add retries with backoff for transient errors, and respect rate limits (a token bucket).`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "async def f(): print(\"hi\"). What does calling f() (without await) print?",
        options: ["hi", "Nothing: it returns a coroutine object (and Python warns it was never awaited)", "None", "It raises SyntaxError"],
        answer: 1,
        explain: "Calling a coroutine function only creates the coroutine; it runs when awaited or wrapped in a task.",
      },
      {
        q: "Inside a coroutine, which call freezes every other task on the loop for 1 second?",
        options: ["await asyncio.sleep(1)", "time.sleep(1)", "await asyncio.to_thread(time.sleep, 1)", "asyncio.create_task(asyncio.sleep(1))"],
        answer: 1,
        explain: "time.sleep blocks the thread the event loop runs on; the others yield control back to the loop.",
      },
      {
        q: "A task in an asyncio.TaskGroup raises ValueError. What happens to the other tasks in the group?",
        options: ["They keep running", "They are cancelled, and the group raises an ExceptionGroup", "They are restarted", "The program exits"],
        answer: 1,
        explain: "TaskGroup cancels the remaining tasks and raises an ExceptionGroup with the failures.",
      },
      {
        q: "Your coroutine catches asyncio.CancelledError to close a connection. What should it do next?",
        options: ["return None", "Re-raise the CancelledError", "Retry the operation", "Call sys.exit()"],
        answer: 1,
        explain: "Re-raising lets the cancellation complete; swallowing it breaks timeouts and TaskGroups.",
      },
      {
        q: "Which is the right tool to cap concurrent requests to an API at 5?",
        options: ["asyncio.Lock", "asyncio.Semaphore(5)", "asyncio.Event", "time.sleep between requests"],
        answer: 1,
        explain: "A semaphore allows up to N holders at once.",
      },
    ],
  },

  // ------------------------------------------------------------------ INTERNALS
  {
    id: "py-internals",
    stage: "Advanced",
    title: "Memory, the garbage collector and performance",
    tagline: "How CPython stores objects, reference counting and the cycle collector, weak references, memory sizes and __slots__, and how to measure and speed up Python code.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["pyrefs"],
    concept: `
## What an object is
In CPython every value is a C struct that starts with a **reference count** and a **pointer to its type**. A variable is a name bound to a pointer to such an object, and containers hold pointers too. That's why assignment never copies, why \`a is b\` compares identities (addresses), and why \`sys.getsizeof(list_of_strings)\` doesn't include the strings.

Some objects are shared to save memory and time:
- **Small ints** from −5 to 256 are created once at start-up.
- **Interned strings**: identifiers, attribute names and many short literals share one copy (\`sys.intern\` interns explicitly; dict lookups on interned keys compare pointers first).
- \`None\`, \`True\`, \`False\`, \`...\` are singletons: test them with \`is\`.

Never rely on caching for other values: use \`==\` for equality.

## Memory management
1. **Reference counting**: every new reference increments the count, every lost reference decrements it, and at zero the object is freed **immediately** (its \`__del__\` or finalizers run). That's why files closed by going out of scope usually get closed promptly in CPython, though you should still use \`with\`.
2. **The cyclic garbage collector**: objects that reference each other (a parent and child, a doubly-linked list, an exception holding a traceback that holds the frame) never reach zero. The \`gc\` module periodically finds unreachable cycles and frees them. CPython 3.14 made the collector **incremental**, cutting pause times on large heaps.
3. **pymalloc**: small objects (up to 512 bytes) come from a fast pool allocator. Freed memory is reused by Python but not always returned to the operating system, so a process's resident size may not shrink after a peak.

Use **weak references** (\`weakref.ref\`, \`WeakValueDictionary\`, \`WeakSet\`) for caches and observers that shouldn't keep objects alive. Find leaks with \`tracemalloc\` (snapshots and diffs) or tools like memray.

## Sizes worth knowing (64-bit CPython)
| Object | Approximate size |
|---|---|
| reference (pointer) | 8 bytes |
| small \`int\` | 28 bytes |
| \`float\` | 24 bytes |
| empty \`list\` / \`dict\` | 56 / 64 bytes, then growing |
| instance with 2 attributes in \`__dict__\` | ~80–90 bytes in 3.12+ (over 150 before 3.11) |
| instance with \`__slots__\` | 32 bytes + 8 per slot |

A list of a million ints is ~8 MB of pointers plus ~28 MB of int objects; \`array('i')\` or a NumPy array stores the same as 4 MB of raw values.

## Why CPython is getting faster
- **3.11**: the **specializing adaptive interpreter** (PEP 659) rewrites hot bytecode into type-specialized versions (\`LOAD_ATTR_INSTANCE_VALUE\`, \`BINARY_OP_ADD_INT\`...), "zero-cost" exceptions, and cheaper frames: about 25% faster than 3.10 on average.
- **3.12–3.14**: more specialization, per-interpreter GIL, inline comprehensions, and an experimental **JIT** compiler (PEP 744). The JIT ships in the official macOS and Windows builds of 3.14, switched off by default (\`PYTHON_JIT=1\`).
- Alternative implementations: **PyPy** (tracing JIT, great for long-running pure-Python code), and compilers like **Cython** and **mypyc** that turn typed Python into C extensions.

## Making code fast
1. **Measure first.** \`timeit\` for micro-benchmarks, \`cProfile\` + \`pstats\` (or \`snakeviz\`) to find hot functions, sampling profilers (**py-spy**, **scalene**) for production processes without code changes.
2. **Fix the algorithm**: a set instead of a list for lookups, a dict instead of nested loops, a heap instead of repeated sorting. This beats any micro-optimization.
3. **Push loops into C**: built-ins (\`sum\`, \`max\`, \`sorted\`, \`"".join\`), comprehensions, \`collections\`, \`itertools\`, then NumPy/pandas/Polars for numbers.
4. **Avoid repeated work**: \`functools.cache\`, hoisting invariants out of loops, batching I/O.
5. Only then: \`__slots__\`, local-variable aliases in hot loops, and compiled extensions.
`,
    keyPoints: [
      "Every object has an identity, a type and a reference count",
      "Refcount zero frees immediately; the cyclic GC frees unreachable cycles",
      "Small ints and interned strings are shared: compare with ==, not is",
      "Containers store pointers; __slots__ and arrays shrink memory",
      "3.11+ specializing interpreter; 3.13+ experimental JIT",
      "Measure (timeit, cProfile, py-spy), fix the algorithm, then push loops into C",
    ],
    code: [
      {
        title: "Identity, caching, reference counts and the cycle collector",
        variants: [{ lang: "python", code: `import gc
import sys
import weakref

# Every value is an object with an identity, a type and a reference count.
x = [1, 2, 3]
print(type(x).__name__, isinstance(id(x), int))

# Small ints (-5 to 256) are cached by CPython: every 100 is the same object.
print(int("100") is int("100"), int("1000") is int("1000"))
# Strings can be interned (one shared copy); identifiers and many literals are interned automatically.
a = "".join(["hello", "_", "world"])
b = "".join(["hello", "_", "world"])
print(a == b, a is b, sys.intern(a) is sys.intern(b))
# Lesson: compare values with ==. Use \`is\` only for singletons: None, True, False, sentinels.

# Reference counting: each new reference increments the count.
data = object()
before = sys.getrefcount(data)
holder = [data, data]
print("refcount went up by", sys.getrefcount(data) - before)
del holder
print("back to where it was after del:", sys.getrefcount(data) == before)


class Node:
    def __init__(self, name: str) -> None:
        self.name = name
        self.other: "Node | None" = None


# When the count reaches zero, the object is freed immediately.
n = Node("solo")
weakref.finalize(n, print, "  freed solo")
print("deleting solo")
del n
print("after del")

# Reference cycles never reach zero: the cyclic garbage collector finds them.
gc.disable()  # (so the demo controls when the collector runs)
a_node, b_node = Node("a"), Node("b")
a_node.other, b_node.other = b_node, a_node
weakref.finalize(a_node, print, "  freed the a <-> b cycle")
del a_node, b_node
print("cycle unreachable but still alive")
found = gc.collect()
print("gc.collect() found unreachable objects:", found > 0)
gc.enable()

# A weak reference doesn't keep its target alive: the basis of caches that don't leak.
cache = weakref.WeakValueDictionary()
big = Node("big")
cache["big"] = big
print("in cache:", "big" in cache)
del big
print("in cache after del:", "big" in cache)` }],
        explain: `- \`int("100") is int("100")\` is \`True\` because ints from −5 to 256 are preallocated; \`1000\` creates two separate objects. The strings built with \`join\` are equal but distinct until interned.
- Putting \`data\` in a list twice adds two references; \`del holder\` frees the list, which drops them again.
- \`weakref.finalize\` registers a callback that runs when the object dies. \`del n\` drops the last reference and "freed solo" prints **immediately**, before "after del": reference counting frees deterministically.
- \`a_node\` and \`b_node\` point at each other, so after \`del\` their counts are still 1: they're unreachable but alive. Only \`gc.collect()\` (normally run automatically) finds and frees the cycle.
- A \`WeakValueDictionary\` entry disappears when the last strong reference to its value goes away: caches built this way can't leak.`,
        output: `list True
True False
True False True
refcount went up by 2
back to where it was after del: True
deleting solo
  freed solo
after del
cycle unreachable but still alive
  freed the a <-> b cycle
gc.collect() found unreachable objects: True
in cache: True
in cache after del: False`,
      },
      {
        title: "Memory: list growth, getsizeof, __slots__ and tracemalloc",
        variants: [{ lang: "python", code: `import sys
import tracemalloc

# Lists over-allocate so that append is amortized O(1): the size jumps, then stays flat.
items: list[int] = []
sizes = []
last = sys.getsizeof(items)
for i in range(20):
    items.append(i)
    size = sys.getsizeof(items)
    if size != last:
        sizes.append(len(items))
        last = size
print("list grew its buffer when length became:", sizes)

# A container stores pointers; getsizeof doesn't count what they point to.
words = ["a" * 1000, "b" * 1000]
print("list of two 1 KB strings looks tiny:", sys.getsizeof(words) < 100)
print("strings themselves:", all(sys.getsizeof(w) > 1000 for w in words))

# Compact types: a tuple is smaller than the equivalent list; array/bytes store raw values.
from array import array

nums = list(range(1000))
print("tuple < list:", sys.getsizeof(tuple(nums)) < sys.getsizeof(nums))
print("array('i') stores 4-byte ints:", array("i", nums).itemsize == 4)


class PointDict:
    def __init__(self, x: float, y: float) -> None:
        self.x, self.y = x, y


class PointSlots:
    __slots__ = ("x", "y")  # fixed attributes, no per-instance __dict__

    def __init__(self, x: float, y: float) -> None:
        self.x, self.y = x, y


def measure(cls) -> int:
    tracemalloc.start()
    points = [cls(1.5, 2.5) for _ in range(10_000)]  # same two floats each time: we measure the instances
    current, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    del points
    return current


with_dict, with_slots = measure(PointDict), measure(PointSlots)
print("instances with __slots__ are at least 25% smaller:", with_slots < with_dict * 0.75)
p = PointSlots(1, 2)
try:
    p.z = 3
except AttributeError:
    print("slots also forbid new attributes: p.z = 3 -> AttributeError")` }],
        explain: `- A list allocates spare capacity when it grows (here at lengths 1, 5, 9 and 17), so most \`append\`s don't reallocate: amortized O(1).
- \`sys.getsizeof\` measures only the container: a list holding two 1 KB strings is about 72 bytes, because it stores two pointers.
- Tuples are slightly smaller than lists (no spare capacity), and \`array('i')\` stores raw 4-byte ints instead of pointers to int objects.
- \`tracemalloc\` measures the memory actually allocated. For 10,000 two-attribute points, \`__slots__\` instances are 35–40% smaller. (Before 3.11 the difference was much larger; modern CPython already stores instance attributes compactly.)
- \`__slots__\` also forbids adding attributes not listed, which catches typos but prevents monkey-patching. Use it for classes with many instances; \`@dataclass(slots=True)\` generates it.`,
        output: `list grew its buffer when length became: [1, 5, 9, 17]
list of two 1 KB strings looks tiny: True
strings themselves: True
tuple < list: True
array('i') stores 4-byte ints: True
instances with __slots__ are at least 25% smaller: True
slots also forbid new attributes: p.z = 3 -> AttributeError`,
      },
      {
        title: "Measuring: timeit and cProfile",
        note: "The comparisons are printed as True/False because exact timings vary between machines.",
        variants: [{ lang: "python", code: `import cProfile
import pstats
import timeit

# timeit runs a snippet many times and reports the total; use it to compare alternatives.
setup = "data_list = list(range(10_000)); data_set = set(data_list)"
in_list = timeit.timeit("9_999 in data_list", setup=setup, number=1_000)
in_set = timeit.timeit("9_999 in data_set", setup=setup, number=1_000)
print("set membership is >100x faster than list:", in_list / in_set > 100)

loop = timeit.timeit("t = 0\\nfor i in range(10_000): t += i", number=200)
builtin = timeit.timeit("sum(range(10_000))", number=200)
print("sum() beats a Python loop:", loop / builtin > 2)

lst = timeit.timeit("q.pop(0)", setup="q = list(range(100_000))", number=50_000)
dq = timeit.timeit("q.popleft()", setup="from collections import deque; q = deque(range(100_000))", number=50_000)
print("deque.popleft beats list.pop(0):", lst / dq > 10)


# Profile before optimizing: cProfile counts every call.
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)


def fib_memo(n: int, memo: dict[int, int] | None = None) -> int:
    memo = {} if memo is None else memo
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib_memo(n - 1, memo) + fib_memo(n - 2, memo)
    return memo[n]


for func in (fib, fib_memo):
    profiler = cProfile.Profile()
    profiler.enable()
    result = func(20)
    profiler.disable()
    stats = pstats.Stats(profiler)
    calls = sum(nc for (_, _, name), (_, nc, *_rest) in stats.stats.items() if name == func.__name__)
    print(f"{func.__name__}(20) = {result} after {calls:,} calls")

# In a real program:  python -m cProfile -s cumtime app.py   (or a sampling profiler like py-spy)
# For hot loops: pick a better algorithm first, then built-ins, then numpy, then Cython/Rust.` }],
        explain: `- \`timeit\` runs a statement many times (with \`setup\` excluded from the measurement). From the command line: \`python -m timeit -s "xs = list(range(10_000))" "9_999 in xs"\`.
- Membership in a **set** is a hash lookup; in a **list** it's a linear scan: hundreds of times slower at 10,000 items.
- \`sum(range(...))\` runs its loop in C; the Python \`for\` loop executes several bytecodes per item.
- \`list.pop(0)\` shifts every remaining element (O(n)); \`deque.popleft()\` is O(1).
- \`cProfile\` counts every call: naive \`fib(20)\` makes 21,891 calls, the memoized version 39. Reading call counts and cumulative times this way is how you find what to optimize. \`pstats\` sorts and filters the results; \`snakeviz\` visualizes them.`,
        output: `set membership is >100x faster than list: True
sum() beats a Python loop: True
deque.popleft beats list.pop(0): True
fib(20) = 6765 after 21,891 calls
fib_memo(20) = 6765 after 39 calls`,
      },
    ],
    interview: [
      {
        q: "How does Python manage memory?",
        a: `CPython uses **reference counting** as the primary mechanism: each object tracks how many references point to it, and it's freed the moment the count hits zero. Reference cycles can't reach zero, so a **cyclic garbage collector** (the \`gc\` module) periodically finds groups of objects that are only reachable from each other and frees them; it's generational, and incremental since 3.14. Small objects come from **pymalloc**, a pool allocator that reuses memory internally (and doesn't always return it to the OS). Other implementations differ: PyPy uses a tracing GC with no reference counts.`,
        freq: "very-common",
      },
      {
        q: "What's the difference between is and ==?",
        a: `\`==\` compares **values** by calling \`__eq__\`. \`is\` compares **identity**: whether both names refer to the same object. Use \`is\` only for singletons (\`None\`, \`True\`, \`False\`, sentinel objects). \`a is b\` can be \`True\` for small ints and interned strings because CPython caches them, but that's an implementation detail: \`int("1000") is int("1000")\` is \`False\`. Python 3.8+ even emits a \`SyntaxWarning\` for \`is\` with a literal.`,
        freq: "very-common",
      },
      {
        q: "Can Python have memory leaks? How would you find one?",
        a: `Yes, in practice: objects kept reachable unintentionally. Typical causes: ever-growing module-level caches or lists, \`functools.lru_cache\` with no \`maxsize\` on methods (it also keeps \`self\` alive), event handlers or callbacks never unregistered, reference cycles involving objects whose cleanup is delayed, and C extensions that leak. Find them with \`tracemalloc\` (take snapshots, compare with \`snapshot.compare_to\`, look at the top allocation sites), \`gc.get_referrers\` and \`objgraph\` to see what holds an object, or memray for a full allocation profile. Fix with bounded caches, \`weakref\`, and explicit cleanup.`,
        freq: "common",
      },
      {
        q: "What does __slots__ do, and when would you use it?",
        a: `Declaring \`__slots__ = ("x", "y")\` replaces the per-instance \`__dict__\` with fixed storage for exactly those attributes. Benefits: less memory per instance (useful with millions of small objects) and slightly faster attribute access; assigning an undeclared attribute raises \`AttributeError\`. Costs: no dynamic attributes, care with multiple inheritance (only one base can have non-empty slots) and weak references (add \`"__weakref__"\`). \`@dataclass(slots=True)\` generates it for you.`,
        freq: "common",
      },
      {
        q: "A Python service is too slow. How do you approach it?",
        a: `1. **Measure** under realistic load: find where time goes with a profiler (py-spy on the live process, cProfile, or tracing/APM spans). Check whether it's CPU, I/O wait, or lock contention.
2. If it's **I/O**: batch queries, fix N+1 queries, add indexes, cache, go concurrent (asyncio/threads), reuse connections.
3. If it's **CPU**: better algorithms and data structures first; then built-ins and comprehensions; NumPy/pandas/Polars for numeric work; caching; then compiled code (Cython, mypyc, Rust via PyO3) or multiple processes.
4. Upgrade Python (3.11+ is much faster), and re-measure after every change.`,
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "When is an object freed in CPython if it's not part of a reference cycle?",
        options: ["At the next garbage collection", "Immediately when its reference count reaches zero", "When the program exits", "Every 5 seconds"],
        answer: 1,
        explain: "Reference counting frees objects deterministically; the cyclic GC only handles cycles.",
      },
      {
        q: "What does sys.getsizeof(list_of_strings) measure?",
        options: ["The list and all its strings", "Only the list object: header plus pointers", "The strings only", "The total process memory"],
        answer: 1,
        explain: "getsizeof is shallow: it doesn't follow references to the elements.",
      },
      {
        q: "Which is NOT a good use of `is`?",
        options: ["x is None", "flag is True in a sentinel check", "name is \"admin\"", "obj is MISSING (a sentinel object)"],
        answer: 2,
        explain: "String identity depends on interning; compare strings with ==.",
      },
      {
        q: "What's the first step when optimizing slow Python code?",
        options: ["Rewrite it in C", "Add __slots__ everywhere", "Profile to find where the time actually goes", "Use more threads"],
        answer: 2,
        explain: "Optimize what the profiler shows is hot; intuition is usually wrong.",
      },
      {
        q: "What made Python 3.11 about 25% faster than 3.10 on average?",
        options: ["Removing the GIL", "The specializing adaptive interpreter and cheaper frames", "A new garbage collector", "Compiling to machine code by default"],
        answer: 1,
        explain: "PEP 659 specializes hot bytecode by type at runtime; frames and exceptions also got cheaper.",
      },
    ],
  },

  // ------------------------------------------------------------------ MODERN
  {
    id: "py-modern",
    stage: "Advanced",
    title: "Modern Python: pattern matching and 3.11 to 3.14",
    tagline: "Structural pattern matching in depth, and the features of recent releases you should be using: tomllib, Self and override, PEP 701 f-strings, copy.replace, template strings and deferred annotations.",
    difficulty: "advanced",
    minutes: 35,
    concept: `
## Python keeps moving
A new Python version ships every October and is supported for five years. Each brings syntax, standard-library and speed improvements, so knowing what's new is part of writing idiomatic code (and a common interview topic). Highlights since 3.8:

| Version | Highlights |
|---|---|
| 3.8 | walrus \`:=\`, positional-only parameters \`/\`, \`f"{x=}"\` debugging |
| 3.9 | \`dict\` union \`d1 \\| d2\`, \`list[int]\` generics without \`typing\`, \`str.removeprefix\` |
| 3.10 | **structural pattern matching**, \`int \\| None\` union syntax, much better error messages |
| 3.11 | 10–60% faster, exception groups and \`except*\`, \`TaskGroup\`, \`asyncio.timeout\`, \`tomllib\`, \`Self\` |
| 3.12 | \`def f[T]()\` generics and \`type\` aliases, f-strings that can reuse quotes, \`itertools.batched\`, \`@override\` |
| 3.13 | new interactive REPL, experimental free-threaded build and JIT, \`copy.replace\`, \`warnings.deprecated\`, dead batteries removed (\`cgi\`, \`telnetlib\`...) |
| 3.14 | template strings \`t"..."\`, deferred evaluation of annotations, free-threading officially supported, \`except A, B\` without parentheses, \`compression.zstd\`, \`concurrent.interpreters\`, \`uuid7\` |

Python 3.15 follows the same yearly rhythm; read the official "What's New" page of every release you adopt.

## Structural pattern matching in depth
\`match subject:\` tries each \`case\` pattern **in order** and runs the first that matches. Patterns test the **shape** of data and bind names at the same time.

| Pattern | Example | Matches |
|---|---|---|
| literal | \`case 404:\` \`case "quit":\` \`case None:\` | equal value (\`None\`/\`True\`/\`False\` by identity) |
| capture | \`case x:\` | anything, binding it to \`x\` |
| wildcard | \`case _:\` | anything, binding nothing |
| value | \`case Color.RED:\` \`case http.HTTPStatus.OK:\` | \`==\` against a **dotted** name |
| sequence | \`case [x, y]:\` \`case [first, *rest]:\` | lists/tuples of that length (never \`str\`) |
| mapping | \`case {"type": "click", "pos": p}:\` | dicts containing **at least** these keys; \`**rest\` for the others |
| class | \`case Point(x=0, y=y):\` \`case str(s):\` | \`isinstance\`, then attributes (positional via \`__match_args__\`) |
| OR / AS | \`case "y" \\| "yes":\` \`case [*_] as items:\` | alternatives / bind the whole match |
| guard | \`case [x, y] if x == y:\` | the pattern, plus a condition |

Rules to remember:
- A **bare name is always a capture**. \`case RED:\` doesn't compare with a variable \`RED\`; it matches everything. Use dotted names (an \`Enum\`) for constants.
- Mapping patterns ignore extra keys; sequence patterns require the exact length unless there's a \`*rest\`.
- \`match\` shines for parsing commands, JSON messages, tokens and tree-shaped data (ASTs, nested configs). For a simple value-to-action lookup, a \`dict\` is still clearer.

## Template strings (3.14)
\`t"Hello {name}"\` looks like an f-string but evaluates to a \`string.templatelib.Template\`: the static strings and the interpolated values kept **separately**. A library can then escape values for HTML, parameterize SQL, quote shell arguments or produce structured logs, which makes injection bugs much harder to write. f-strings remain the tool for plain text.

## Deferred annotations (3.14)
Annotations are no longer evaluated when a function or class is defined but only when something asks for them (\`annotationlib.get_annotations\`, \`typing.get_type_hints\`). Forward references work without quotes, and modules with heavy annotations import faster. \`from __future__ import annotations\` is no longer needed for that purpose.

## Staying current
- Run the newest supported version you can, and test on the oldest version you support (a CI matrix).
- \`pyupgrade\` and ruff's \`UP\` rules rewrite old idioms (\`Optional[X]\` → \`X | None\`, \`List\` → \`list\`) automatically.
- Read deprecation warnings: run tests with \`-W error::DeprecationWarning\` to catch them early.
`,
    keyPoints: [
      "match/case matches shapes: literals, sequences, mappings, classes, OR, guards",
      "A bare name in a case is a capture; use dotted names for constants",
      "3.11: tomllib, Self, TaskGroup; 3.12: type params, PEP 701 f-strings, batched, override",
      "3.13: copy.replace, warnings.deprecated, free-threaded and JIT previews",
      "3.14: t-strings, deferred annotations, except A, B, zstd, uuid7",
      "Upgrade regularly; let ruff/pyupgrade modernize old idioms",
    ],
    code: [
      {
        title: "Structural pattern matching in depth",
        variants: [{ lang: "python", code: `from dataclasses import dataclass
from enum import Enum


# 1. Matching JSON-like data: dict patterns match a SUBSET of keys, and can check types.
def handle(event: dict) -> str:
    match event:
        case {"type": "click", "pos": [x, y]}:  # nested sequence pattern binds x and y
            return f"click at ({x}, {y})"
        case {"type": "key", "key": str(key)} if len(key) == 1:  # class pattern + guard
            return f"typed {key!r}"
        case {"type": "key", "key": "Enter" | "Return"}:  # OR-pattern of literals
            return "submit"
        case {"type": "scroll", "delta": int() | float() as delta}:  # capture with \`as\`
            return f"scroll by {delta}"
        case {"type": str(kind), **rest}:  # **rest collects the other keys
            return f"unknown {kind} event with {sorted(rest)}"
        case _:
            return "not an event"


for event in [
    {"type": "click", "pos": [3, 4]},
    {"type": "key", "key": "q"},
    {"type": "key", "key": "Enter", "shift": False},
    {"type": "scroll", "delta": -2.5},
    {"type": "resize", "w": 800, "h": 600},
    ["not", "a", "dict"],
]:
    print(handle(event))


# 2. Sequence patterns: parse a command line.
def command(line: str) -> str:
    match line.split():
        case []:
            return "empty"
        case ["go", ("north" | "south" | "east" | "west") as direction]:
            return f"walking {direction}"
        case ["get", item]:
            return f"picked up {item}"
        case ["drop", *items] if items:
            return f"dropped {', '.join(items)}"
        case ["quit" | "exit"]:
            return "bye"
        case [verb, *_]:
            return f"I don't know how to {verb}"


for line in ["", "go north", "go up", "get lamp", "drop sword shield", "exit"]:
    print(f"{line!r:22} -> {command(line)}")


# 3. Class patterns over a small expression tree: an evaluator in a few lines.
@dataclass
class Num:
    value: float


@dataclass
class BinOp:
    op: str
    left: "Num | BinOp"
    right: "Num | BinOp"


def evaluate(node) -> float:
    match node:
        case Num(value):  # positional: uses the dataclass's __match_args__
            return value
        case BinOp("+", left, right):
            return evaluate(left) + evaluate(right)
        case BinOp("*", left, right):
            return evaluate(left) * evaluate(right)
        case BinOp("/", _, Num(0)):
            raise ZeroDivisionError("division by literal zero")
        case BinOp("/", left, right):
            return evaluate(left) / evaluate(right)
        case BinOp(op=unknown):  # keyword form
            raise ValueError(f"unknown operator {unknown}")


tree = BinOp("+", Num(2), BinOp("*", Num(3), Num(4)))  # 2 + 3 * 4
print("2 + 3 * 4 =", evaluate(tree))
try:
    evaluate(BinOp("/", Num(1), Num(0)))
except ZeroDivisionError as e:
    print("error:", e)

# Gotcha: a bare name in a case is a CAPTURE pattern, never a comparison with a variable.
class Color(Enum):
    RED = "red"
    BLUE = "blue"


match Color("blue"):
    case Color.RED:  # a dotted name is a value pattern: compared with ==
        print("red")
    case other:  # a bare name matches ANYTHING and binds it (\`case RED:\` would do the same)
        print("captured", other)` }],
        explain: `- **Mapping patterns** match dicts that contain at least the listed keys: \`{"type": "key", "key": "Enter", "shift": False}\` matches the \`"Enter" | "Return"\` case even with the extra key.
- \`str(key)\` is a **class pattern** checking the type and binding the value; \`if len(key) == 1\` is a **guard** evaluated after the pattern matched.
- \`int() | float() as delta\` accepts either type and binds the value with \`as\`; \`**rest\` collects the remaining keys.
- **Sequence patterns** match lists of a given length: \`["go", ("north" | ...) as direction]\` matches only the four directions, so \`"go up"\` falls through to \`[verb, *_]\`. \`["drop", *items] if items\` requires at least one item.
- **Class patterns** use \`__match_args__\` (generated by \`@dataclass\`) for positional sub-patterns: \`BinOp("/", _, Num(0))\` matches a division by the literal zero, nested patterns and all. \`BinOp(op=unknown)\` uses the keyword form.
- The last block shows the classic mistake: a bare name **captures** anything. Compare against constants with dotted names such as \`Color.RED\`.`,
        output: `click at (3, 4)
typed 'q'
submit
scroll by -2.5
unknown resize event with ['h', 'w']
not an event
''                     -> empty
'go north'             -> walking north
'go up'                -> I don't know how to go
'get lamp'             -> picked up lamp
'drop sword shield'    -> dropped sword, shield
'exit'                 -> bye
2 + 3 * 4 = 14
error: division by literal zero
captured Color.BLUE`,
      },
      {
        title: "3.11 and 3.12 features you should use",
        variants: [{ lang: "python", code: `# Features from Python 3.11 and 3.12 worth knowing (everything here runs on 3.12+).
import tomllib
from datetime import UTC, datetime
from itertools import batched
from typing import Self, override

# tomllib (3.11): parse TOML config, e.g. pyproject.toml. (Read-only: use tomli-w to write.)
config = tomllib.loads("""
[server]
host = "0.0.0.0"
port = 8000
workers = [1, 2]

[database]
url = "postgresql://localhost/app"
pool = { min = 2, max = 10 }
""")
print(config["server"]["port"] + 1, config["database"]["pool"]["max"])

# datetime.UTC (3.11): always store timezone-aware UTC datetimes.
moment = datetime(2026, 11, 4, 9, 30, tzinfo=UTC)
print(moment.isoformat(), moment.tzinfo)

# PEP 701 f-strings (3.12): reuse the same quotes, nest, and span lines inside {}.
user = {"name": "Ada", "langs": ["python", "rust"]}
print(f"{user["name"]} codes in {", ".join(user["langs"])}")
width = 8
print(f"[{f"{3.14159:.2f}":>{width}}]")  # an f-string inside an f-string, with a computed width

# itertools.batched (3.12)
print(list(batched("ABCDEFG", 3)))


# typing.Self (3.11) and @override (3.12)
class Builder:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def add(self, part: str) -> Self:  # returns an instance of the subclass, for chaining
        self.parts.append(part)
        return self

    def build(self) -> str:
        return " ".join(self.parts)


class HtmlBuilder(Builder):
    @override  # the checker errors if Builder has no build(), e.g. after a rename
    def build(self) -> str:
        return "<p>" + super().build() + "</p>"


print(HtmlBuilder().add("hello").add("world").build())

# Also new since 3.10: much better error messages. A typo now produces
#   NameError: name 'lenght' is not defined. Did you mean: 'length'?
# and a traceback underlines the exact sub-expression that failed (3.11+).` }],
        explain: `- \`tomllib\` parses TOML (the format of \`pyproject.toml\`) into dicts; inline tables like \`pool = { min = 2, max = 10 }\` become nested dicts.
- \`datetime.UTC\` is a shorter alias for \`timezone.utc\`. Store timestamps as aware UTC datetimes and convert to local time only for display.
- PEP 701 (3.12) made f-strings part of the grammar: the same quote type can be reused inside \`{}\`, and f-strings nest with computed format specs.
- \`Self\` annotates methods returning their own class, so \`HtmlBuilder().add(...)\` is known to return an \`HtmlBuilder\` and chaining keeps the subclass type.
- \`@override\` documents intent and lets the type checker catch an override whose parent method was renamed or removed.`,
        output: `8001 10
2026-11-04T09:30:00+00:00 UTC
Ada codes in python, rust
[    3.14]
[('A', 'B', 'C'), ('D', 'E', 'F'), ('G',)]
<p>hello world</p>`,
      },
      {
        title: "3.13: copy.replace and warnings.deprecated",
        note: "Needs Python 3.13 or newer.",
        minPython: "3.13",
        variants: [{ lang: "python", code: `# Python 3.13 additions.
import copy
import warnings
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    debug: bool = False


# copy.replace: one function to "modify" immutable objects (dataclasses, namedtuples, datetimes...).
base = Config("localhost", 8000)
dev = copy.replace(base, debug=True)
print(base)
print(dev)


# warnings.deprecated: marks an API as deprecated for type checkers AND warns at runtime.
@warnings.deprecated("use connect() instead")
def open_connection(host: str) -> str:
    return f"connected to {host}"


with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter("always")
    print(open_connection("db"))
print(caught[0].category.__name__, "-", caught[0].message)` }],
        explain: `- \`copy.replace(obj, **changes)\` returns a modified copy of any object that supports it: dataclasses (where it works like \`dataclasses.replace\`), named tuples, \`datetime\` objects and \`SimpleNamespace\`. Classes can opt in with \`__replace__\`.
- \`@warnings.deprecated(...)\` (PEP 702) is understood by type checkers, so editors strike through calls to the old API, **and** emits a \`DeprecationWarning\` at runtime. The warning is recorded here with \`catch_warnings(record=True)\`.`,
        output: `Config(host='localhost', port=8000, debug=False)
Config(host='localhost', port=8000, debug=True)
connected to db
DeprecationWarning - use connect() instead`,
      },
      {
        title: "3.14: template strings, deferred annotations and more",
        note: "Needs Python 3.14 or newer.",
        minPython: "3.14",
        variants: [{ lang: "python", code: `# Python 3.14 additions.
import uuid
from compression import zstd
from string.templatelib import Interpolation, Template


# 1. Template strings (PEP 750): t"..." builds a Template, NOT a str. Code receives the static
#    parts and the interpolated values separately and decides how to combine them safely.
def html(template: Template) -> str:
    escape = {"<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"}
    out = []
    for part in template:  # iterating yields strings and Interpolation objects, in order
        if isinstance(part, Interpolation):
            out.append("".join(escape.get(ch, ch) for ch in str(part.value)))
        else:
            out.append(part)
    return "".join(out)


comment = '<script>alert("hi")</script>'
page = t"<p>{comment}</p>"
print(type(page).__name__, page.strings, [i.expression for i in page.interpolations])
print(html(page))  # the same idea gives safe SQL, shell commands and log formatting


# 2. Deferred annotations (PEP 649): annotations are evaluated only when asked for,
#    so a class can mention a name that's defined later without quotes.
class Employee:
    manager: Manager | None = None  # Manager doesn't exist yet: fine in 3.14


class Manager(Employee):
    reports: list[Employee]


print(Employee.__annotations__)

# 3. except without parentheses (PEP 758) when there's no "as" clause.
try:
    int("x")
except ValueError, TypeError:
    print("caught a ValueError or TypeError")

# 4. compression.zstd (PEP 784): fast modern compression in the standard library.
payload = b"python " * 1000
packed = zstd.compress(payload)
print(len(payload), "->", len(packed), "bytes |", zstd.decompress(packed) == payload)

# 5. uuid.uuid7: time-ordered UUIDs, good database primary keys (they sort by creation time).
a, b = uuid.uuid7(), uuid.uuid7()
print(a.version, a < b)` }],
        explain: `- \`t"<p>{comment}</p>"\` produces a \`Template\` with the static strings \`('<p>', '</p>')\` and one interpolation whose expression is \`comment\`. The \`html\` function escapes **only** the interpolated values, so the injected \`<script>\` becomes harmless text. An f-string would have produced the dangerous string immediately, with no chance to escape it.
- \`Employee\` annotates \`manager: Manager | None\` before \`Manager\` exists. With deferred evaluation (PEP 649) that's fine: annotations are computed when first requested.
- PEP 758 allows \`except ValueError, TypeError:\` without parentheses (only when there's no \`as\`).
- \`compression.zstd\` brings Zstandard compression to the standard library: 7,000 repetitive bytes shrink to 25.
- \`uuid.uuid7()\` generates time-ordered UUIDs: later IDs sort after earlier ones, which keeps database indexes compact.`,
        output: `Template ('<p>', '</p>') ['comment']
<p>&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;</p>
{'manager': __main__.Manager | None}
caught a ValueError or TypeError
7000 -> 25 bytes | True
7 True`,
      },
    ],
    interview: [
      {
        q: "How is match/case different from a switch statement?",
        a: `A C/Java \`switch\` compares one value against constants. Python's \`match\` does **structural** matching: it tests types and shapes (sequences of a given length, dicts containing keys, instances of a class with given attributes), destructures them, binds names, supports alternatives (\`|\`), captures (\`as\`) and guards (\`if\`). There's no fall-through: the first matching case runs. The main pitfall is that a bare name is a capture pattern, not a comparison with a variable.`,
        freq: "common",
      },
      {
        q: "What changed in recent Python versions that you use day to day?",
        a: `A good answer names a few and why they matter: 3.10's pattern matching and \`X | Y\` unions; 3.11's speed-up (~25%), exception groups and \`TaskGroup\` for structured concurrency, \`tomllib\`; 3.12's type-parameter syntax (\`def f[T]\`, \`type\` aliases) and f-string improvements; 3.13's free-threaded and JIT previews and the new REPL; 3.14's template strings for safe interpolation, deferred annotations, and officially supported free-threading. Mention how you upgrade: CI matrix across versions, \`pyupgrade\`/ruff rules, and reading deprecation warnings.`,
        freq: "common",
      },
      {
        q: "What are template strings (t-strings) for?",
        a: `A t-string \`t"..."\` (3.14, PEP 750) evaluates to a \`Template\` object that keeps the literal parts and the interpolated values separate, instead of joining them into a \`str\` like an f-string. Libraries can then process the values safely: escape them for HTML, turn them into SQL parameters, quote them for a shell, or emit structured logs with the values as fields. They bring the convenience of f-string syntax to places where f-strings cause injection bugs.`,
        freq: "occasional",
      },
      {
        q: "Why did Python change how annotations are evaluated in 3.14?",
        a: `Previously annotations were evaluated eagerly when a function or class was defined. That made forward references fail (a class referring to itself or a later class needed quotes), and evaluating large annotations slowed down imports. \`from __future__ import annotations\` (PEP 563) turned them into strings, which broke runtime users like pydantic in subtle ways. PEP 649/749 (3.14) makes evaluation **lazy**: annotations are computed only when requested, through \`annotationlib\`, which can return real values, forward references, or strings.`,
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "match {\"type\": \"click\", \"x\": 1, \"y\": 2}: case {\"type\": \"click\"}: ... Does the case match?",
        options: ["No, the dict has extra keys", "Yes, mapping patterns match if the listed keys are present", "Only with **rest", "SyntaxError"],
        answer: 1,
        explain: "Mapping patterns ignore extra keys; use **rest to capture them.",
      },
      {
        q: "MAX = 10; match n: case MAX: ... What does `case MAX:` do?",
        options: ["Compares n with 10", "Matches any value and binds it to the name MAX", "SyntaxError always", "Matches only the string \"MAX\""],
        answer: 1,
        explain: "A bare name is a capture pattern; use a dotted name (Limits.MAX) or a guard to compare.",
      },
      {
        q: "Does the sequence pattern case [a, b]: match the string \"ab\"?",
        options: ["Yes", "No, str, bytes and bytearray are excluded from sequence patterns", "Only in 3.12+", "Only with a guard"],
        answer: 1,
        explain: "Strings are deliberately not treated as sequences by match.",
      },
      {
        q: "What does t\"Hello {name}\" evaluate to in Python 3.14?",
        options: ["A str", "A string.templatelib.Template", "A bytes object", "A lambda"],
        answer: 1,
        explain: "Template strings keep the static parts and interpolations separate for safe processing.",
      },
      {
        q: "Which module parses TOML in the standard library (3.11+)?",
        options: ["toml", "tomllib", "configparser", "json"],
        answer: 1,
        explain: "tomllib reads TOML; writing requires a third-party package such as tomli-w.",
      },
    ],
  },
];
