import type { Lesson } from "../types";

// Java track, part 3: Advanced.

export const javaAdvanced: Lesson[] = [
  // ------------------------------------------------------------------ CONCURRENCY
  {
    id: "java-concurrency",
    stage: "Advanced",
    title: "Concurrency & virtual threads",
    tagline: "Threads, races and the memory model, locks and atomics, executors, CompletableFuture, concurrent collections, and Java 21's virtual threads.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["jthreads"],
    concept: `
## Why concurrency is hard
Two things go wrong when threads share mutable data:
1. **Race conditions (atomicity).** \`count++\` is three steps: read, add, write. Two threads can both read 41 and both write 42, losing an update.
2. **Visibility.** Each core caches values, and the compiler and CPU reorder instructions. Without synchronization, one thread may *never see* another thread's write. A \`while (!stopped)\` loop can spin forever.

The **Java Memory Model** defines when a write is guaranteed visible: when there's a **happens-before** relationship. You get one from: releasing then acquiring the same lock, writing then reading a \`volatile\` field, \`Thread.start()\` (everything before it is visible to the new thread), \`Thread.join()\`, and handing objects through concurrent collections or futures.

## The toolbox, from simple to specialized
| Tool | Gives you | Use for |
|---|---|---|
| **Immutability** (records, \`final\`, \`List.of\`) | No shared *mutable* state at all | The default. Immutable objects are always thread-safe |
| **\`synchronized\`** | Mutual exclusion + visibility (intrinsic lock, reentrant) | Small critical sections |
| **\`volatile\`** | Visibility and ordering for one variable, **not** atomic \`++\` | Flags (\`stopped\`), safe publication |
| **Atomics** (\`AtomicInteger\`, \`AtomicReference\`, \`LongAdder\`) | Lock-free atomic updates via CAS | Counters, sequence numbers, lock-free state |
| **\`ReentrantLock\`**, \`ReadWriteLock\`, \`StampedLock\` | tryLock with timeout, interruptible waits, fairness, read/write split | When synchronized isn't flexible enough |
| **Concurrent collections** | Thread-safe data structures with atomic compound ops | Shared maps, queues, lists |
| **Synchronizers** (\`CountDownLatch\`, \`Semaphore\`, \`CyclicBarrier\`) | Coordination | Wait for N tasks; limit concurrency; phases |

## Executors: don't manage threads by hand
\`\`\`java
try (ExecutorService pool = Executors.newFixedThreadPool(8)) {   // AutoCloseable since Java 19
    Future<Report> f = pool.submit(() -> buildReport(id));
    Report r = f.get(2, TimeUnit.SECONDS);                       // blocks, with a timeout
}   // close() waits for submitted tasks to finish
\`\`\`
A \`ThreadPoolExecutor\` is configured by **core size, max size, queue and rejection policy**. An unbounded queue (what \`newFixedThreadPool\` uses) can grow until you run out of memory under overload. In production prefer a bounded queue and an explicit rejection policy. \`ScheduledExecutorService\` runs periodic jobs.

## CompletableFuture: composing async work
\`\`\`java
CompletableFuture<Quote> quote =
    supplyAsync(() -> priceService.price(sku), ioPool)                    // start
        .thenCombine(supplyAsync(() -> shipping.cost(country), ioPool),   // run in parallel, join
                     (price, ship) -> new Quote(price + ship))
        .thenApply(this::applyDiscount)                                   // transform
        .orTimeout(2, TimeUnit.SECONDS)
        .exceptionally(e -> Quote.unavailable());                          // recover
\`\`\`
\`thenApply\` maps, \`thenCompose\` chains another async call (like \`flatMap\`), \`thenCombine\` merges two, \`allOf\`/\`anyOf\` wait for many. Without an executor argument, async stages run on the **common ForkJoinPool**, which is sized for CPU work: always pass your own executor for blocking I/O.

## Concurrent collections
- **\`ConcurrentHashMap\`**: lock striping at the bucket level, lock-free reads. Use its **atomic compound operations** (\`merge\`, \`compute\`, \`computeIfAbsent\`), never "check then put" (\`if (!map.containsKey(k)) map.put(k, v)\` is a race).
- **\`BlockingQueue\`** (\`ArrayBlockingQueue\`, \`LinkedBlockingQueue\`): \`put\` blocks when full and \`take\` blocks when empty. That's the **producer-consumer** pattern with built-in back-pressure.
- **\`CopyOnWriteArrayList\`**: copies the array on every write. Great for read-mostly listener lists.
- \`Collections.synchronizedList(...)\` locks every call but compound actions (iterate, check-then-act) still need external locking. Prefer the concurrent classes.

## Virtual threads (Java 21)
A **platform thread** is a wrapper around an OS thread: ~1 MB of stack, expensive to create, limited to a few thousand. A **virtual thread** is a lightweight thread managed by the JVM: a few hundred bytes to start, millions are fine. When a virtual thread blocks on I/O, \`sleep\` or a lock, the JVM **unmounts** it from its carrier (OS) thread, which immediately runs another virtual thread. **Compare both models in the visualizer.**
\`\`\`java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request r : requests) executor.submit(() -> handle(r));   // one cheap thread per task
}
Thread.ofVirtual().name("worker").start(task);
\`\`\`
Rules of thumb:
- They make **blocking, thread-per-request code scale** like async code, without callbacks. They don't make CPU-bound work faster.
- **Never pool them**: create one per task. To limit concurrency (say, 10 calls to a fragile API), use a \`Semaphore\`.
- Pinning: in Java 21 to 23, blocking inside \`synchronized\` pinned the carrier thread. **Java 24 fixed this** (JEP 491). Native calls still pin.
- Be careful with large \`ThreadLocal\` caches: with millions of threads they multiply. **\`ScopedValue\`** (final in Java 25) is the lighter way to pass request context.
- Spring Boot turns them on with \`spring.threads.virtual.enabled=true\`.

**Structured concurrency** (\`StructuredTaskScope\`, still a preview API) treats a group of subtasks as one unit: if one fails, the others are cancelled, and none outlive their scope.

## Deadlock, livelock and starvation
A **deadlock** needs four conditions at once: mutual exclusion, hold-and-wait, no preemption, and a circular wait. Break the circle: **always acquire locks in a global order** (by account id, for example), or use \`tryLock(timeout)\` and back off. Find deadlocks with a thread dump (\`jcmd <pid> Thread.print\`, which reports "Found one Java-level deadlock").

## Practical rules
1. Prefer immutability and confinement (data owned by one thread) over locking.
2. Use the highest-level tool that works: concurrent collections and executors before locks, locks before \`wait\`/\`notify\`.
3. Keep critical sections small; never call unknown code (callbacks, I/O) while holding a lock.
4. Handle \`InterruptedException\`: restore the flag with \`Thread.currentThread().interrupt()\` or rethrow. Don't swallow it.
5. Concurrency bugs hide in testing. Reason about happens-before, and test under load.
`,
    keyPoints: [
      "count++ is read-modify-write: not atomic, even when the field is volatile",
      "volatile = visibility; synchronized/locks = visibility + mutual exclusion",
      "Use AtomicInteger/LongAdder for counters, ConcurrentHashMap.merge/compute for maps",
      "Use executors, not raw threads; ExecutorService is AutoCloseable since Java 19",
      "CompletableFuture: thenApply, thenCompose, thenCombine, allOf, exceptionally; pass your own executor for I/O",
      "BlockingQueue gives producer-consumer with back-pressure",
      "Virtual threads: cheap, one per task, never pooled; great for blocking I/O, not for CPU work",
      "Prevent deadlock with a global lock order or tryLock with timeout",
    ],
    code: [
      {
        title: "A race condition and three correct fixes",
        variants: [
          {
            lang: "java",
            code: `import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;

public class Counters {
    static final int THREADS = 4;
    static final int PER_THREAD = 100_000;

    static int unsafeCount = 0;
    static int lockedCount = 0;
    static final Object LOCK = new Object();
    static final AtomicInteger atomicCount = new AtomicInteger();
    static final LongAdder adderCount = new LongAdder();

    /** Starts THREADS threads that each run body PER_THREAD times, and waits for all of them. */
    static void hammer(Runnable body) throws InterruptedException {
        Thread[] threads = new Thread[THREADS];
        for (int t = 0; t < THREADS; t++) {
            threads[t] = new Thread(() -> {
                for (int i = 0; i < PER_THREAD; i++) body.run();
            });
            threads[t].start();
        }
        for (Thread t : threads) t.join();       // join() also makes their writes visible to us
    }

    public static void main(String[] args) throws InterruptedException {
        hammer(() -> unsafeCount++);                               // read, add, write: three steps
        hammer(() -> { synchronized (LOCK) { lockedCount++; } });  // one thread at a time
        hammer(atomicCount::incrementAndGet);                      // lock-free compare-and-swap
        hammer(adderCount::increment);                             // striped cells, best under contention

        int expected = THREADS * PER_THREAD;
        System.out.println("expected      " + expected);
        System.out.println("synchronized  " + lockedCount);
        System.out.println("AtomicInteger " + atomicCount.get());
        System.out.println("LongAdder     " + adderCount.sum());
        System.out.println("unsafe count is never more than expected: " + (unsafeCount <= expected));
    }
}`,
          },
        ],
        output: `expected      400000
synchronized  400000
AtomicInteger 400000
LongAdder     400000
unsafe count is never more than expected: true`,
        explain: `- Print \`unsafeCount\` yourself: it's usually far below 400,000 and **different every run**. That non-determinism is what makes races so nasty to debug.
- Making the field \`volatile\` would *not* fix it: volatile makes writes visible but \`++\` is still three separate steps.
- \`AtomicInteger\` retries a compare-and-swap until it wins. \`LongAdder\` spreads updates across cells and sums them on read, so it scales better when many threads update and few read.`,
      },
      {
        title: "Executors, futures and virtual threads",
        variants: [
          {
            lang: "java",
            code: `import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class ExecutorsDemo {
    static int slowSquare(int x) throws InterruptedException {
        Thread.sleep(50);                              // pretend this is a network call
        return x * x;
    }

    public static void main(String[] args) throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(4)) {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 1; i <= 8; i++) {
                int n = i;                             // effectively final copy for the lambda
                futures.add(pool.submit(() -> slowSquare(n)));
            }
            int sum = 0;
            for (Future<Integer> f : futures) sum += f.get();   // waits for each result
            System.out.println("sum of squares 1..8 = " + sum);
        }

        long start = System.nanoTime();
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 10_000; i++) {
                results.add(executor.submit(() -> {
                    Thread.sleep(Duration.ofMillis(200));   // blocking is fine: the carrier is released
                    return 1;
                }));
            }
            int done = 0;
            for (Future<Integer> f : results) done += f.get();
            long ms = Duration.ofNanos(System.nanoTime() - start).toMillis();
            System.out.println(done + " blocking tasks finished in under 10 seconds: " + (ms < 10_000));
        }

        Thread vt = Thread.ofVirtual().name("worker-1").start(() -> {
            Thread me = Thread.currentThread();
            System.out.println("hello from " + me.getName() + ", virtual = " + me.isVirtual());
        });
        vt.join();
    }
}`,
          },
        ],
        output: `sum of squares 1..8 = 204
10000 blocking tasks finished in under 10 seconds: true
hello from worker-1, virtual = true`,
        explain: `- 10,000 tasks that each block for 200 ms would take **500 seconds** on a pool of 4 platform threads. On virtual threads they all sleep at the same time and finish in well under a second, using only a handful of OS threads.
- \`try (ExecutorService ...)\` calls \`close()\`, which waits for every submitted task: no forgotten \`shutdown()\`.
- \`Future.get()\` blocks and rethrows a task failure wrapped in \`ExecutionException\`.`,
      },
      {
        title: "CompletableFuture: parallel calls, combining and recovering",
        variants: [
          {
            lang: "java",
            code: `import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class Checkout {
    static void pause(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();       // restore the interrupt flag
        }
    }

    static CompletableFuture<Double> price(String sku, Executor io) {
        return CompletableFuture.supplyAsync(() -> {
            pause(100);
            return sku.equals("lamp") ? 30.0 : 40.0;
        }, io);
    }

    static CompletableFuture<Double> shipping(String country, Executor io) {
        return CompletableFuture.supplyAsync(() -> {
            pause(80);
            if (country.equals("AQ")) throw new IllegalArgumentException("we don't ship to " + country);
            return 5.0;
        }, io);
    }

    static CompletableFuture<String> quote(String sku, String country, Executor io) {
        return price(sku, io)
            .thenCombine(shipping(country, io), Double::sum)        // both calls run in parallel
            .thenApply(total -> "%s to %s: $%.2f".formatted(sku, country, total))
            .exceptionally(e -> "%s to %s: unavailable (%s)".formatted(sku, country, e.getCause().getMessage()));
    }

    public static void main(String[] args) {
        try (var io = Executors.newVirtualThreadPerTaskExecutor()) {
            var a = quote("book", "US", io);
            var b = quote("book", "AQ", io);
            var c = quote("lamp", "NG", io)
                .thenCompose(q -> CompletableFuture.supplyAsync(() -> q + " + gift wrap", io));   // chain another async step
            CompletableFuture.allOf(a, b, c).join();
            System.out.println(a.join());
            System.out.println(b.join());
            System.out.println(c.join());

            var slow = CompletableFuture.supplyAsync(() -> { pause(500); return "late answer"; }, io)
                .completeOnTimeout("cached answer", 100, TimeUnit.MILLISECONDS);
            System.out.println("with a 100 ms budget: " + slow.join());
        }
    }
}`,
          },
        ],
        output: `book to US: $45.00
book to AQ: unavailable (we don't ship to AQ)
lamp to NG: $35.00 + gift wrap
with a 100 ms budget: cached answer`,
        explain: `- \`thenCombine\` waits for two independent futures and merges their results, so price and shipping are fetched **concurrently**. Total latency is the slower call, not the sum.
- When a stage throws, the failure skips the following \`thenApply\` and lands in \`exceptionally\`, wrapped in a \`CompletionException\` (hence \`getCause()\`).
- \`thenCompose\` is for a step that is itself async (it avoids \`CompletableFuture<CompletableFuture<T>>\`).
- \`completeOnTimeout\` supplies a fallback; \`orTimeout\` fails with a \`TimeoutException\` instead.`,
      },
      {
        title: "Producer-consumer with a BlockingQueue",
        variants: [
          {
            lang: "java",
            code: `import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicLong;

public class Pipeline {
    record Job(int id) {}

    static final Job POISON = new Job(-1);                     // tells a worker to stop

    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<Job> queue = new ArrayBlockingQueue<>(3);  // bounded: producers wait when it's full
        int workers = 3;
        CountDownLatch finished = new CountDownLatch(workers);
        ConcurrentHashMap<String, Integer> perWorker = new ConcurrentHashMap<>();
        AtomicLong idSum = new AtomicLong();

        for (int w = 0; w < workers; w++) {
            String name = "worker-" + w;
            Thread.ofPlatform().name(name).start(() -> {
                try {
                    while (true) {
                        Job job = queue.take();                  // waits while the queue is empty
                        if (job == POISON) break;
                        idSum.addAndGet(job.id());
                        perWorker.merge(name, 1, Integer::sum);  // atomic per key
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    finished.countDown();
                }
            });
        }

        for (int i = 1; i <= 100; i++) queue.put(new Job(i));      // waits while the queue is full
        for (int w = 0; w < workers; w++) queue.put(POISON);       // one stop signal per worker
        finished.await();                                          // wait for all workers

        int processed = perWorker.values().stream().mapToInt(Integer::intValue).sum();
        System.out.println("jobs processed: " + processed);
        System.out.println("sum of job ids: " + idSum.get());
        System.out.println("all workers stopped: " + (finished.getCount() == 0));
    }
}`,
          },
        ],
        output: `jobs processed: 100
sum of job ids: 5050
all workers stopped: true`,
        explain: `- The bounded queue gives **back-pressure**: a fast producer can't flood memory, it simply waits in \`put\`.
- A **poison pill** per worker is a simple, reliable shutdown signal.
- \`CountDownLatch\` lets the main thread wait until every worker has counted down.
- How the 100 jobs split between workers changes every run; the totals don't. That's the property to test in concurrent code.`,
      },
      {
        title: "Avoiding deadlock with a global lock order",
        variants: [
          {
            lang: "java",
            code: `import java.util.concurrent.locks.ReentrantLock;

public class Transfers {
    static class Account {
        final int id;
        long balance;
        final ReentrantLock lock = new ReentrantLock();

        Account(int id, long balance) {
            this.id = id;
            this.balance = balance;
        }
    }

    // Deadlock-prone version: thread 1 locks A then B, thread 2 locks B then A -> both wait forever.
    // Fix: always lock the account with the smaller id first, whatever the transfer direction.
    static void transfer(Account from, Account to, long amount) {
        Account first = from.id < to.id ? from : to;
        Account second = first == from ? to : from;
        first.lock.lock();
        try {
            second.lock.lock();
            try {
                if (from.balance >= amount) {
                    from.balance -= amount;
                    to.balance += amount;
                }
            } finally {
                second.lock.unlock();
            }
        } finally {
            first.lock.unlock();                           // always unlock in finally
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Account a = new Account(1, 1_000);
        Account b = new Account(2, 1_000);
        Thread t1 = new Thread(() -> { for (int i = 0; i < 50_000; i++) transfer(a, b, 3); });
        Thread t2 = new Thread(() -> { for (int i = 0; i < 50_000; i++) transfer(b, a, 3); });
        t1.start();
        t2.start();
        t1.join();
        t2.join();
        System.out.println("total is conserved: " + (a.balance + b.balance));
        System.out.println("finished without deadlock");
    }
}`,
          },
        ],
        output: `total is conserved: 2000
finished without deadlock`,
        explain: `- Lock ordering breaks the **circular wait** condition, so a deadlock becomes impossible.
- \`ReentrantLock\` must be released in \`finally\`; \`synchronized\` releases automatically. \`lock.tryLock(50, TimeUnit.MILLISECONDS)\` is the other escape hatch: give up, back off and retry.
- Swap the ordering for a naive \`from.lock; to.lock\` and the program will (eventually) hang. A thread dump would then show "Found one Java-level deadlock".`,
      },
    ],
    interview: [
      {
        q: "What's the difference between synchronized and volatile?",
        a: "`volatile` guarantees **visibility and ordering** for a single variable: a write is immediately visible to subsequent reads in other threads (it creates a happens-before edge), and it prevents certain reorderings. It does **not** make compound actions like `count++` or check-then-act atomic. `synchronized` provides **mutual exclusion** (only one thread holds the monitor) plus visibility: everything a thread did before releasing the lock is visible to the next thread that acquires it. Use volatile for simple flags and safe publication of immutable objects; use synchronized, locks or atomics when you need atomic updates.",
        freq: "very-common",
      },
      {
        q: "What are virtual threads and when should you use them?",
        a: "Virtual threads (Java 21) are threads scheduled by the JVM rather than the OS. They're cheap to create (a small heap-allocated stack that grows as needed), so you can have millions. When a virtual thread blocks on I/O, sleep or a lock, the JVM unmounts it and its carrier OS thread runs another virtual thread. Use them for **I/O-bound, thread-per-request** workloads (web handlers, calls to databases and APIs): you keep simple blocking code yet scale like reactive code. They don't speed up CPU-bound work. Don't pool them; cap concurrency with a Semaphore; be wary of pinning by native calls (and by synchronized before Java 24) and of heavy ThreadLocal usage.",
        freq: "very-common",
      },
      {
        q: "How does ConcurrentHashMap achieve thread safety?",
        a: "Since Java 8 it uses a table of bins where reads are lock-free (volatile reads of nodes) and writes use CAS to insert into an empty bin or `synchronized` on the bin's first node otherwise, so threads updating different bins don't contend. Resizing is done cooperatively by multiple threads. It disallows null keys and values (null would be ambiguous with 'absent'). Its compound methods `compute`, `computeIfAbsent` and `merge` are atomic per key, which is how you should do check-then-act on it. Iterators are weakly consistent and never throw ConcurrentModificationException.",
        freq: "very-common",
      },
      {
        q: "What is a deadlock and how do you prevent it?",
        a: "Two or more threads each hold a lock the other needs, so all wait forever. It requires four conditions together: mutual exclusion, hold and wait, no preemption, and circular wait. Prevent it by breaking one: acquire locks in a consistent global order (by id or identity hash), use `tryLock` with a timeout and back off, hold fewer locks (one coarse lock, or lock-free structures), and never call external code while holding a lock. Detect with a thread dump (`jcmd <pid> Thread.print` or jstack), which reports Java-level deadlocks.",
        freq: "common",
      },
      {
        q: "Runnable vs Callable? Future vs CompletableFuture?",
        a: "`Runnable.run()` returns nothing and can't throw checked exceptions; `Callable.call()` returns a value and can throw. A `Future` is a handle to a pending result: you can only block on `get()`, poll `isDone()` or `cancel()`. A `CompletableFuture` can also be completed manually and **composed** without blocking: `thenApply`, `thenCompose`, `thenCombine`, `allOf`, `exceptionally`, `orTimeout`, so you build pipelines of dependent async steps.",
        freq: "common",
      },
      {
        q: "How do you size a thread pool?",
        a: "For CPU-bound work, about the number of cores (`Runtime.getRuntime().availableProcessors()`, or +1). For blocking I/O, more threads than cores: roughly cores × (1 + wait time / compute time), or simply virtual threads with a Semaphore to cap concurrency against the downstream resource. Always bound the queue and pick a rejection policy (`CallerRunsPolicy` gives natural back-pressure), name your threads, and measure under realistic load. Pool size should also respect downstream limits such as the database connection pool.",
        freq: "common",
      },
      {
        q: "What does happens-before mean?",
        a: "It's the Java Memory Model's guarantee about visibility and ordering: if action A happens-before action B, then A's effects are visible to B. Edges come from program order within a thread, unlocking then locking the same monitor, writing then reading the same volatile, `Thread.start` (the starter's prior actions before the new thread), the end of a thread before another thread's `join` returns, and actions before handing an object through a concurrent collection or completing a future. Without such an edge, a thread may see stale or reordered values: a data race.",
      },
    ],
    quiz: [
      {
        q: "Does making `int count` volatile make `count++` thread-safe?",
        options: ["Yes", "No: ++ is still read-modify-write", "Only on 64-bit JVMs", "Only with virtual threads"],
        answer: 1,
        explain: "volatile gives visibility, not atomicity. Use AtomicInteger or a lock.",
      },
      {
        q: "Which is the right way to count words from many threads in a ConcurrentHashMap?",
        options: ["if (!map.containsKey(w)) map.put(w, 1); else map.put(w, map.get(w) + 1);", "map.merge(w, 1, Integer::sum)", "synchronized (w) { map.put(w, 1); }", "map.putIfAbsent(w, map.get(w) + 1)"],
        answer: 1,
        explain: "merge is atomic per key. The check-then-put version is a race.",
      },
      {
        q: "What's the main benefit of virtual threads?",
        options: ["Faster CPU-bound math", "Massive numbers of blocking tasks without exhausting OS threads", "They replace locks", "They run on the GPU"],
        answer: 1,
        explain: "Blocked virtual threads release their carrier OS thread.",
      },
      {
        q: "How should you limit how many virtual threads call a fragile API at once?",
        options: ["Use a fixed pool of virtual threads", "Use a Semaphore", "Use Thread.sleep", "You can't"],
        answer: 1,
        explain: "Virtual threads should never be pooled; a Semaphore caps concurrent access.",
      },
      {
        q: "Which BlockingQueue method waits when the queue is full?",
        options: ["offer", "add", "put", "poll"],
        answer: 2,
        explain: "put blocks; offer returns false; add throws.",
      },
      {
        q: "What reliably prevents deadlock between two locks?",
        options: ["Making fields volatile", "Acquiring locks in a consistent global order", "Using more threads", "Calling System.gc()"],
        answer: 1,
        explain: "A global order breaks the circular-wait condition.",
      },
    ],
  },

  // ------------------------------------------------------------------ JVM
  {
    id: "java-jvm",
    stage: "Advanced",
    title: "Inside the JVM: memory, GC and the JIT",
    tagline: "Class loading, the heap and stacks, generational garbage collection, choosing a collector, memory leaks and the tools that find them.",
    difficulty: "advanced",
    minutes: 35,
    visualizers: ["jgc"],
    concept: `
## What happens when you run \`java -jar app.jar\`
1. **Class loading.** Classes are loaded lazily, the first time they're needed, by a chain of class loaders: **bootstrap** (core \`java.base\`), **platform** (other JDK modules) and **application** (your classpath). Each loader asks its parent first (*parent delegation*), so nobody can replace \`java.lang.String\`.
2. **Linking.** The bytecode is **verified** (it can't corrupt memory), static fields get default values (**preparation**), and symbolic references are resolved.
3. **Initialization.** Static initializers run, once, on first active use, thread-safely. That's why the *holder idiom* gives you a lazy, thread-safe singleton for free.
4. **Execution.** Bytecode starts in the **interpreter**. Hot methods are compiled to machine code by the **JIT**: C1 quickly, then C2 aggressively, using profiling data (tiered compilation).

## Runtime memory areas
| Area | Per | Holds |
|---|---|---|
| **Heap** | JVM | Every object and array. Managed by the GC. Sized by \`-Xms\`/\`-Xmx\` |
| **Thread stacks** | Thread | Frames: local variables, operand stack. \`StackOverflowError\` when exhausted (\`-Xss\`) |
| **Metaspace** | JVM | Class metadata (native memory, grows on demand) |
| **Code cache** | JVM | JIT-compiled machine code |
| **Direct / native memory** | JVM | NIO direct buffers, thread stacks, GC structures, native libraries |

A container's memory limit must cover **all** of these, not just \`-Xmx\`. In containers prefer \`-XX:MaxRAMPercentage=75\` over a hard-coded \`-Xmx\`.

## Garbage collection
An object is **alive** if it's reachable from a **GC root**: local variables on thread stacks, static fields, JNI references. Everything else is garbage, even cycles of objects pointing to each other. (No reference counting.)

**The generational hypothesis**: most objects die young. So the heap is split:
- **Young generation** = **Eden** (new objects) + two **Survivor** spaces. A **minor GC** copies the few live objects out of Eden into a survivor space and wipes Eden in one go. Cheap, because cost is proportional to *live* objects.
- Objects that survive enough minor GCs are **promoted** to the **old generation**. A **major/full GC** marks and compacts it: more expensive.

**Play with the GC visualizer**: allocate, watch minor GCs promote survivors, then hold references with the "leak" and watch the old generation fill up until \`OutOfMemoryError\`.

## Choosing a collector
| Collector | Flag | Character | Good for |
|---|---|---|---|
| **G1** (default) | \`-XX:+UseG1GC\` | Region-based, mostly concurrent marking, pause-time goal (\`-XX:MaxGCPauseMillis=200\`) | Most services |
| **ZGC** | \`-XX:+UseZGC\` | Concurrent compaction, **sub-millisecond pauses** regardless of heap size; generational since 21 (default since 23) | Latency-sensitive services, huge heaps |
| **Shenandoah** | \`-XX:+UseShenandoahGC\` | Concurrent compaction, low pauses | Similar to ZGC (Red Hat builds) |
| **Parallel** | \`-XX:+UseParallelGC\` | Stop-the-world, maximum throughput | Batch jobs |
| **Serial** | \`-XX:+UseSerialGC\` | Single-threaded, tiny footprint | Small containers, CLIs |

Start with the default (G1). Measure GC with logs (\`-Xlog:gc*\`) before changing anything. Most "GC problems" are allocation or leak problems.

## The JIT's tricks
- **Inlining**: small or hot methods are copied into the caller, removing call overhead and enabling everything else.
- **Escape analysis**: an object that never escapes a method may be **scalar-replaced** (its fields live in registers and no heap allocation happens at all).
- **Devirtualization**: if only one implementation of an interface has been seen, the call becomes direct (with a guard; **deoptimization** undoes it if a new class shows up).
- Loop unrolling, bounds-check elimination, lock elision, intrinsics (e.g. \`System.arraycopy\`, \`String.equals\` map to special CPU instructions).

Consequences: Java programs have a **warm-up** period, and naive microbenchmarks lie. Use **JMH** to benchmark.

## Memory leaks in a garbage-collected language
The GC frees *unreachable* objects. A leak is an object that is **still reachable but no longer needed**:
- Ever-growing static maps and caches (use a bounded cache: Caffeine, or an LRU \`LinkedHashMap\`)
- Listeners and callbacks registered but never removed
- \`ThreadLocal\` values in pooled threads that are never \`remove()\`d
- Unclosed resources (connections, streams) holding buffers
- Non-static inner classes and lambdas capturing a large outer object

Symptoms: old generation keeps growing after every full GC, then \`OutOfMemoryError: Java heap space\`. Diagnose with a **heap dump** (\`-XX:+HeapDumpOnOutOfMemoryError\` or \`jcmd <pid> GC.heap_dump\`) opened in **Eclipse MAT**, and look at the dominator tree.

Reference strength also matters: **strong** (normal), **soft** (cleared under memory pressure), **weak** (cleared at the next GC: \`WeakHashMap\` keys), **phantom** (post-mortem cleanup via \`Cleaner\`).

## Startup and footprint
Class Data Sharing (CDS) and the **AOT cache** (Java 24+) cut startup by reusing pre-parsed classes and profiles from a training run. Java 25 adds **compact object headers** (\`-XX:+UseCompactObjectHeaders\`), shrinking every object's header from 12 to 8 bytes. **GraalVM native image** compiles ahead of time into a native binary that starts in milliseconds (a good fit for CLIs and serverless), at the cost of build time and some dynamic features.
`,
    keyPoints: [
      "Classes load lazily via bootstrap → platform → application loaders, with parent delegation",
      "Heap = objects (GC-managed); stack = per-thread frames; metaspace = class metadata",
      "Reachable from a GC root = alive; cycles are collected fine",
      "Most objects die young: cheap minor GCs in Eden, survivors promoted to old gen",
      "G1 is the default; ZGC for sub-millisecond pauses; Parallel for throughput",
      "The JIT inlines, removes allocations (escape analysis) and devirtualizes after warm-up",
      "Leaks = reachable but unneeded objects: unbounded caches, listeners, ThreadLocals",
      "Tools: jcmd, JFR + JMC, heap dumps in Eclipse MAT, async-profiler; benchmark with JMH",
    ],
    code: [
      {
        title: "The string pool, the Integer cache and identity",
        variants: [
          {
            lang: "java",
            code: `public class Identity {
    public static void main(String[] args) {
        String a = "hello";
        String b = "hello";                    // same literal: the same pooled object
        String c = new String("hello");        // explicitly a new heap object
        String d = c.intern();                 // the pooled copy
        String e = "hel" + "lo";               // constant expression: folded at compile time
        String prefix = "hel";
        String f = prefix + "lo";              // computed at run time: a new object

        System.out.println("literal == literal       " + (a == b));
        System.out.println("literal == new String    " + (a == c));
        System.out.println("literal == intern()      " + (a == d));
        System.out.println("compile-time constant    " + (a == e));
        System.out.println("run-time concatenation   " + (a == f));
        System.out.println("equals() in every case   " + (a.equals(c) && a.equals(f)));

        Integer x = 127, y = 127;              // autoboxing uses Integer.valueOf
        Integer p = 128, q = 128;
        System.out.println("Integer 127 == 127       " + (x == y));
        System.out.println("Integer 128 == 128       " + (p == q));
        System.out.println("Integer 128 equals 128   " + p.equals(q));
    }
}`,
          },
        ],
        output: `literal == literal       true
literal == new String    false
literal == intern()      true
compile-time constant    true
run-time concatenation   false
equals() in every case   true
Integer 127 == 127       true
Integer 128 == 128       false
Integer 128 equals 128   true`,
        explain: `- \`==\` on objects compares **references** (is it the same object?), \`equals\` compares **values**.
- String literals are interned in the string pool, so equal literals share one object. Strings built at run time are new objects.
- \`Integer.valueOf\` caches -128 to 127, so boxed small numbers *happen* to be identical and larger ones aren't. Code that compares boxed numbers with \`==\` passes tests with small ids and fails in production. Always use \`equals\`.`,
      },
      {
        title: "Lazy class loading and static initialization order",
        variants: [
          {
            lang: "java",
            code: `public class Loading {
    static class Config {
        static {
            System.out.println("  [Config is being initialized]");
        }
        static final String NAME = "orders";            // compile-time constant: copied into callers
        static final String REGION = loadRegion();      // computed: needs initialization

        static String loadRegion() {
            System.out.println("  [loading region from the environment]");
            return "eu-west";
        }
    }

    static class Lazy {                                  // the initialization-on-demand holder idiom
        static {
            System.out.println("  [Lazy holder initialized]");
        }
        static final Lazy INSTANCE = new Lazy();
    }

    public static void main(String[] args) {
        System.out.println("main starts");
        System.out.println("name = " + Config.NAME);     // constant: does NOT initialize Config
        System.out.println("region = " + Config.REGION); // first real use: runs the static block
        System.out.println("region = " + Config.REGION); // already initialized: runs nothing
        System.out.println("singleton: " + (Lazy.INSTANCE == Lazy.INSTANCE));
        System.out.println("String's loader is bootstrap: " + (String.class.getClassLoader() == null));
        System.out.println("java.sql's loader: " + java.sql.Connection.class.getClassLoader().getName());
    }
}`,
          },
        ],
        output: `main starts
name = orders
  [Config is being initialized]
  [loading region from the environment]
region = eu-west
region = eu-west
  [Lazy holder initialized]
singleton: true
String's loader is bootstrap: true
java.sql's loader: platform`,
        explain: `- Classes initialize **lazily** on first active use, exactly once, and the JVM makes initialization thread-safe. The holder idiom turns that into a lazy singleton with no locking code.
- \`static final\` fields holding compile-time constants are inlined by \`javac\`, so reading \`Config.NAME\` doesn't even touch the class.
- Static initializers run top to bottom: the static block, then \`REGION\`.
- Core classes come from the bootstrap loader (shown as \`null\`), other JDK modules from the platform loader.`,
      },
      {
        title: "Stack depth, recursion and StackOverflowError",
        variants: [
          {
            lang: "java",
            code: `public class Recursion {
    static int depth = 0;

    static void forever() {
        depth++;
        forever();                                  // no base case
    }

    static long recursiveSum(long n) {
        return n == 0 ? 0 : n + recursiveSum(n - 1);   // one stack frame per call
    }

    static long iterativeSum(long n) {
        long total = 0;
        for (long i = 1; i <= n; i++) total += i;      // constant stack space
        return total;
    }

    public static void main(String[] args) throws InterruptedException {
        try {
            forever();
        } catch (StackOverflowError e) {
            System.out.println("StackOverflowError after more than 1,000 frames: " + (depth > 1_000));
        }

        System.out.println("recursive sum to 1,000: " + recursiveSum(1_000));
        try {
            recursiveSum(10_000_000);
        } catch (StackOverflowError e) {
            System.out.println("recursive sum to 10,000,000: StackOverflowError");
        }
        System.out.println("iterative sum to 10,000,000: " + iterativeSum(10_000_000));

        // A thread can ask for a bigger stack (here 512 MB) when deep recursion is unavoidable.
        Thread big = new Thread(null, () -> System.out.println("on a 512 MB stack: " + recursiveSum(1_000_000)), "big-stack", 512L * 1024 * 1024);
        big.start();
        big.join();
    }
}`,
          },
        ],
        output: `StackOverflowError after more than 1,000 frames: true
recursive sum to 1,000: 500500
recursive sum to 10,000,000: StackOverflowError
iterative sum to 10,000,000: 50000005000000
on a 512 MB stack: 500000500000`,
        explain: `- Each thread has its own fixed-size stack (often 512 KB to 1 MB by default, set with \`-Xss\`). Every call pushes a frame; deep recursion runs out.
- Java has **no tail-call optimization**, so even a tail-recursive method uses one frame per call. Convert deep recursion (DFS on a huge graph, say) into a loop with an explicit \`ArrayDeque\` stack.
- \`StackOverflowError\` is an \`Error\`: catching it is fine for a demo, not for production logic.`,
      },
      {
        title: "A classic memory leak, and the bounded-cache fix",
        variants: [
          {
            lang: "java",
            code: `import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

public class Caches {
    // LEAK: a static map that only ever grows. Every entry stays reachable from a GC root
    // (the static field), so the GC can never free it. In production: OutOfMemoryError.
    static final Map<String, byte[]> SESSIONS = new HashMap<>();

    // FIX: a bounded LRU cache. accessOrder=true moves an entry to the end on every get().
    static class LruCache<K, V> extends LinkedHashMap<K, V> {
        private final int capacity;

        LruCache(int capacity) {
            super(16, 0.75f, true);
            this.capacity = capacity;
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity;                  // evict the least recently used entry
        }
    }

    public static void main(String[] args) {
        for (int i = 0; i < 10_000; i++) SESSIONS.put("session-" + i, new byte[1024]);
        System.out.println("leaky map: " + SESSIONS.size() + " entries, about " + SESSIONS.size() / 1024 + " MB and growing");

        LruCache<String, String> cache = new LruCache<>(3);
        cache.put("a", "A");
        cache.put("b", "B");
        cache.put("c", "C");
        cache.get("a");                                // a becomes most recently used
        cache.put("d", "D");                           // over capacity: evicts b
        System.out.println("LRU keys, oldest first: " + cache.keySet());
        cache.get("c");
        cache.put("e", "E");                           // evicts a
        System.out.println("LRU keys, oldest first: " + cache.keySet());
    }
}`,
          },
        ],
        output: `leaky map: 10000 entries, about 9 MB and growing
LRU keys, oldest first: [c, a, d]
LRU keys, oldest first: [d, c, e]`,
        explain: `- The GC is not the problem in a leak: these objects are genuinely reachable. The fix is a **bounded** structure or explicit removal.
- \`LinkedHashMap\` with \`accessOrder = true\` and \`removeEldestEntry\` is a complete LRU cache in a dozen lines (and a favorite interview question).
- In real services use **Caffeine** for caching: size and time-based eviction, near-optimal hit rates, statistics.`,
      },
      {
        title: "JVM flags and diagnostic commands",
        variants: [
          {
            lang: "bash",
            code: `# Production-style launch in a container
java -XX:MaxRAMPercentage=75 \\
     -XX:+UseZGC \\
     -Xlog:gc*:file=/var/log/app/gc.log:time,uptime:filecount=5,filesize=20m \\
     -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dumps \\
     -XX:+ExitOnOutOfMemoryError \\
     -jar app.jar
# (on Java 21 add -XX:+ZGenerational; generational ZGC is the default from Java 23)

jcmd                                   # list running JVMs and their pids
jcmd <pid> VM.flags                    # effective flags, including ergonomic defaults
jcmd <pid> GC.heap_info                # heap regions and usage
jcmd <pid> Thread.print > threads.txt  # thread dump: stuck threads, deadlocks
jcmd <pid> GC.heap_dump /tmp/heap.hprof   # then open in Eclipse MAT or VisualVM
jstat -gcutil <pid> 1000               # GC utilization every second

# Java Flight Recorder: low-overhead profiling that is safe in production
jcmd <pid> JFR.start duration=60s filename=/tmp/app.jfr
jfr summary /tmp/app.jfr               # then open the file in JDK Mission Control

java -XX:+PrintFlagsFinal -version | grep -E "MaxHeapSize|UseG1GC|ThreadStackSize"`,
          },
        ],
        explain: `- \`-XX:+ExitOnOutOfMemoryError\` lets the orchestrator restart a broken instance instead of leaving it limping.
- A **thread dump** answers "why is it stuck?", a **heap dump** answers "what's using the memory?", and a **JFR recording** answers "where is the time going?".`,
      },
    ],
    interview: [
      {
        q: "Explain the JVM memory areas.",
        a: "The **heap** (shared) holds all objects and arrays and is managed by the GC, typically split into young (Eden + survivor spaces) and old generations. Each thread has a **stack** of frames holding local variables and partial results, plus a program counter; stack overflow throws `StackOverflowError`. **Metaspace** (native memory, replaced PermGen in Java 8) holds class metadata. The **code cache** holds JIT-compiled code. There is also native memory for direct buffers, thread stacks and GC bookkeeping, which is why a container needs headroom above `-Xmx`.",
        freq: "very-common",
      },
      {
        q: "How does garbage collection work in Java?",
        a: "The GC finds live objects by tracing from **GC roots** (stack locals, static fields, JNI handles); everything unreachable is garbage, including cyclic structures. Most collectors are **generational**: new objects go to Eden; a minor GC copies survivors to a survivor space (cost proportional to live objects, and most die young); objects surviving several cycles are promoted to the old generation, which is collected less often by marking and compacting. Modern collectors (G1, ZGC, Shenandoah) do most marking and even compaction concurrently with the application to keep pauses short.",
        freq: "very-common",
      },
      {
        q: "Can Java have memory leaks? Give examples.",
        a: "Yes: objects that remain reachable but are no longer needed. Common causes: static collections or caches that grow without bound, listeners/observers registered and never removed, ThreadLocals in thread pools not cleared, unclosed resources, inner classes or lambdas capturing large outer objects, and classloader leaks in app servers on redeploy. Diagnose with heap usage after full GCs trending upward, then a heap dump analyzed in Eclipse MAT (dominator tree, paths to GC roots). Fix with bounded caches (Caffeine), weak references where appropriate, try-with-resources and `ThreadLocal.remove()`.",
        freq: "very-common",
      },
      {
        q: "G1 vs ZGC vs Parallel GC?",
        a: "**G1** (default) divides the heap into regions, collects the regions with the most garbage first, and targets a pause-time goal: a balanced choice for most services. **ZGC** performs marking, relocation and compaction concurrently using colored pointers and load barriers, keeping pauses under a millisecond even for terabyte heaps, at some cost in CPU and throughput: best for latency-sensitive systems. **Parallel** uses stop-the-world multi-threaded collection for maximum throughput: good for batch processing where pauses don't matter. Choose based on measured latency and throughput requirements.",
        freq: "common",
      },
      {
        q: "What is the JIT compiler and what optimizations does it do?",
        a: "The JVM starts by interpreting bytecode and profiles it. Frequently executed (hot) methods are compiled to native code: C1 compiles quickly with light optimization, then C2 recompiles the hottest code aggressively using the profile (tiered compilation). Optimizations include inlining, escape analysis with scalar replacement (eliminating allocations), devirtualization of monomorphic call sites, loop unrolling, bounds-check and null-check elimination, lock elision and intrinsics. Speculative optimizations are protected by guards and undone (deoptimization) if assumptions break. This is why Java code needs warm-up and why benchmarks should use JMH.",
        freq: "common",
      },
      {
        q: "What's the difference between `==` and `equals` for strings and boxed numbers?",
        a: "`==` compares references; `equals` compares contents. String literals are interned so identical literals are the same object, but strings built at run time are not, so `==` gives inconsistent results. `Integer.valueOf` caches values from -128 to 127, so `Integer a = 127, b = 127; a == b` is true but with 128 it's false. Always compare objects with `equals` (or `Objects.equals` for nulls).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Where are Java objects allocated?",
        options: ["On the thread stack", "On the heap", "In metaspace", "In the code cache"],
        answer: 1,
        explain: "Objects live on the heap (the JIT may avoid allocation entirely via escape analysis, but semantically they're heap objects).",
      },
      {
        q: "Two objects reference each other but nothing else references them. What happens?",
        options: ["They leak forever", "They're collected: they're unreachable from GC roots", "They're collected only by a full GC with reference counting", "The JVM throws an error"],
        answer: 1,
        explain: "Tracing GCs handle cycles; reachability from roots is all that matters.",
      },
      {
        q: "Why are minor GCs cheap?",
        options: ["They don't pause threads", "Most young objects are dead, and copying cost depends on live objects", "They run on the GPU", "They skip Eden"],
        answer: 1,
        explain: "The generational hypothesis: copying the few survivors is fast.",
      },
      {
        q: "Which collector targets sub-millisecond pauses on large heaps?",
        options: ["Serial", "Parallel", "ZGC", "CMS"],
        answer: 2,
        explain: "ZGC does nearly all work concurrently.",
      },
      {
        q: "`Integer a = 1000, b = 1000;` what is `a == b`?",
        options: ["true", "false", "Compile error", "NullPointerException"],
        answer: 1,
        explain: "Only -128 to 127 are cached; 1000 gives two different objects.",
      },
      {
        q: "Which tool answers 'what is using all the memory?'",
        options: ["A thread dump", "A heap dump analyzed in Eclipse MAT", "javac -verbose", "jshell"],
        answer: 1,
        explain: "Heap dumps show objects, sizes and what keeps them alive.",
      },
    ],
  },

  // ------------------------------------------------------------------ MODERN JAVA
  {
    id: "java-modern",
    stage: "Advanced",
    title: "Modern Java: 17 to 25",
    tagline: "Records, sealed types and pattern matching for data-oriented code, plus sequenced collections, stream gatherers, scoped values and the rest of the newest features.",
    difficulty: "advanced",
    minutes: 30,
    concept: `
## Java's release train
A new Java version ships every **six months** (March and September). Every two years one is a **Long-Term Support** (LTS) release that vendors patch for years. Most companies run an LTS:
| LTS | Year | Headline features |
|---|---|---|
| **8** | 2014 | Lambdas, streams, \`Optional\`, \`java.time\` |
| **11** | 2018 | \`var\` in lambdas, \`HttpClient\`, single-file \`java Hello.java\` |
| **17** | 2021 | **Records**, **sealed** classes, **text blocks**, **switch expressions**, \`instanceof\` patterns |
| **21** | 2023 | **Virtual threads**, **pattern matching for switch**, **record patterns**, **sequenced collections** |
| **25** | 2025 | **Compact source files** and instance \`main\`, **module imports**, **flexible constructor bodies**, **scoped values**, compact object headers |

Features usually arrive as **previews** first (enable with \`--enable-preview\`) and become final a release or two later. Don't ship previews to production.

## Data-oriented programming
Modern Java lets you model data as data:
- **Records** for immutable data carriers (equals, hashCode, toString and accessors generated).
- **Sealed interfaces** for a closed set of alternatives ("a payment is a card OR a bank transfer OR a wallet").
- **Pattern matching** (\`switch\` with type and record patterns, guards with \`when\`) for operations over them, checked for exhaustiveness by the compiler.

Compared with classic OOP (add a virtual method to each class), this keeps each **operation in one place**, which suits code where the set of types is stable but operations keep growing: evaluators, validators, API results, events, state machines.

## Small features you'll use daily
- **\`var\`** (10): local type inference, \`var users = new ArrayList<User>();\`. Use when the type is obvious from the right-hand side.
- **Text blocks** (15): multi-line strings with \`"""\` for JSON, SQL, HTML. Indentation is stripped based on the closing delimiter.
- **Switch expressions** (14): \`int days = switch (month) { case FEB -> 28; case APR, JUN, SEP, NOV -> 30; default -> 31; };\` with no fall-through and \`yield\` for blocks.
- **\`instanceof\` patterns** (16): \`if (o instanceof String s && s.length() > 3)\`.
- **Helpful NPE messages** (14), **\`Stream.toList()\`** (16), **\`String.formatted\`** (15).
- **Sequenced collections** (21): \`getFirst()\`, \`getLast()\`, \`addFirst()\`, \`reversed()\` on lists, deques, \`LinkedHashSet\` and \`LinkedHashMap\` (plus \`firstEntry()\`, \`pollLastEntry()\`).
- **Unnamed variables \`_\`** (22): \`catch (NumberFormatException _)\`, \`(_, value) -> ...\`, \`case Circle _ ->\`.
- **Stream gatherers** (24): custom intermediate operations; built-ins \`windowFixed\`, \`windowSliding\`, \`scan\`, \`fold\`, \`mapConcurrent\`.
- **Markdown doc comments** (23): \`///\` comments written in Markdown.

## Java 25 highlights
- **Compact source files and instance main**: \`void main() { IO.println("Hi"); }\` is a complete program.
- **Module import declarations**: \`import module java.base;\` imports every package a module exports.
- **Flexible constructor bodies**: validate or compute arguments *before* calling \`super(...)\`.
- **Scoped values**: immutable, inheritable per-request context, a lighter and safer replacement for many \`ThreadLocal\` uses, especially with virtual threads.
- **Compact object headers**, **generational Shenandoah**, and **AOT** ergonomics that improve startup.
- Still in preview: structured concurrency, primitive types in patterns, stable values.

Releases after 25 (26 shipped in March 2026) keep refining these, for example HTTP/3 support in \`HttpClient\`. Check the "JDK N" JEP list when you upgrade.

## Upgrading
Move LTS to LTS. Run your tests on the new JDK in CI first, update build plugins (Maven compiler/surefire, Gradle), bump libraries that use bytecode tricks (Mockito, Lombok, ByteBuddy, Spring), and watch for removed APIs (\`jdeprscan\`, \`jdeps\`). Tools like **OpenRewrite** automate many migrations.
`,
    keyPoints: [
      "New release every 6 months; LTS every 2 years: 8, 11, 17, 21, 25",
      "Records + sealed interfaces + pattern switch = data-oriented programming",
      "Record patterns deconstruct nested data; `when` adds guards; exhaustiveness is checked",
      "Sequenced collections (21): getFirst, getLast, reversed",
      "Unnamed variables `_` (22) for values you don't use",
      "Stream gatherers (24): windowFixed, windowSliding, scan, fold, mapConcurrent",
      "Java 25: compact source files, module imports, flexible constructors, scoped values",
      "Previews need --enable-preview and aren't for production",
    ],
    code: [
      {
        title: "An expression evaluator: sealed records and nested patterns",
        variants: [
          {
            lang: "java",
            code: `import java.util.Map;
import java.util.NoSuchElementException;

public class Calculator {
    sealed interface Expr permits Num, Var, Add, Mul, Neg {}
    record Num(double value) implements Expr {}
    record Var(String name) implements Expr {}
    record Add(Expr left, Expr right) implements Expr {}
    record Mul(Expr left, Expr right) implements Expr {}
    record Neg(Expr inner) implements Expr {}

    static double eval(Expr e, Map<String, Double> env) {
        return switch (e) {
            case Num n -> n.value();
            case Var(String name) -> {
                Double v = env.get(name);
                if (v == null) throw new NoSuchElementException("unbound variable " + name);
                yield v;
            }
            case Add(Expr l, Expr r) -> eval(l, env) + eval(r, env);
            case Mul(Expr l, Expr r) -> eval(l, env) * eval(r, env);
            case Neg(Expr inner) -> -eval(inner, env);
        };
    }

    static String show(Expr e) {
        return switch (e) {
            case Num(double v) when v == Math.rint(v) -> String.valueOf((long) v);
            case Num(double v) -> String.valueOf(v);
            case Var(String name) -> name;
            case Add(Expr l, Expr r) -> "(" + show(l) + " + " + show(r) + ")";
            case Mul(Expr l, Expr r) -> show(l) + " * " + show(r);
            case Neg(Expr inner) -> "-" + show(inner);
        };
    }

    static Expr simplify(Expr e) {
        return switch (e) {
            case Add(Num(double a), Num(double b)) -> new Num(a + b);       // nested record patterns
            case Mul(Num(double z), Expr _) when z == 0 -> new Num(0);
            case Mul(Expr _, Num(double z)) when z == 0 -> new Num(0);
            case Mul(Num(double one), Expr x) when one == 1 -> simplify(x);
            case Neg(Neg(Expr x)) -> simplify(x);
            case Add(Expr l, Expr r) -> new Add(simplify(l), simplify(r));
            case Mul(Expr l, Expr r) -> new Mul(simplify(l), simplify(r));
            case Neg(Expr x) -> new Neg(simplify(x));
            case Num _, Var _ -> e;
        };
    }

    public static void main(String[] args) {
        Expr expr = new Mul(new Add(new Var("x"), new Num(2)), new Neg(new Var("y")));
        System.out.println(show(expr) + " = " + eval(expr, Map.of("x", 3.0, "y", 4.0)));

        Expr messy = new Add(new Mul(new Num(1), new Var("x")), new Mul(new Var("y"), new Num(0)));
        System.out.println(show(messy) + "  simplifies to  " + show(simplify(messy)));
        System.out.println(show(simplify(new Neg(new Neg(new Add(new Num(2), new Num(3.5)))))));

        try {
            eval(new Var("z"), Map.of());
        } catch (NoSuchElementException ex) {
            System.out.println("error: " + ex.getMessage());
        }
    }
}`,
          },
        ],
        output: `(x + 2) * -y = -20.0
(1 * x + y * 0)  simplifies to  (x + 0)
5.5
error: unbound variable z`,
        explain: `- The whole language is five records and one sealed interface. Each operation (\`eval\`, \`show\`, \`simplify\`) is one exhaustive \`switch\`: add a \`Div\` record and the compiler points at every switch that must handle it.
- \`case Add(Num(double a), Num(double b))\` matches *and* deconstructs two levels at once: no casts, no getters.
- \`_\` (Java 22) marks components we don't care about, and \`case Num _, Var _\` handles two types in one branch.
- Cases are tried top to bottom, so specific patterns (\`Neg(Neg(...))\`) must come before general ones (\`Neg(...)\`). The compiler rejects the reverse order as unreachable.`,
      },
      {
        title: "Sequenced collections, unnamed variables, text blocks and var",
        variants: [
          {
            lang: "java",
            code: `import java.util.*;

public class Everyday {
    enum Month { JAN, FEB, APR, JUN }

    static int days(Month m, boolean leap) {
        return switch (m) {                            // switch expression: no fall-through, must be exhaustive
            case FEB -> leap ? 29 : 28;
            case APR, JUN -> 30;
            case JAN -> 31;
        };
    }

    public static void main(String[] args) {
        var steps = new ArrayList<>(List.of("build", "test", "deploy"));   // var: type inferred
        steps.addFirst("checkout");                                         // Java 21
        System.out.println(steps.getFirst() + " ... " + steps.getLast() + ", reversed " + steps.reversed());

        var recent = new LinkedHashMap<String, Integer>();
        recent.put("home", 1);
        recent.put("search", 2);
        recent.put("cart", 3);
        System.out.println("first " + recent.firstEntry() + ", last " + recent.lastEntry() + ", newest first " + recent.reversed().keySet());

        int valid = 0;
        for (String raw : List.of("10", "x", "30")) {
            try {
                Integer.parseInt(raw);
                valid++;
            } catch (NumberFormatException _) {                             // Java 22: unnamed variable
                // ignored on purpose
            }
        }
        System.out.println("valid numbers: " + valid);
        Map<String, Integer> stock = new TreeMap<>(Map.of("pen", 4, "book", 2));
        stock.forEach((_, qty) -> System.out.print(qty + " "));
        System.out.println();

        System.out.println("Feb in a leap year: " + days(Month.FEB, true) + ", June: " + days(Month.JUN, false));

        String user = "ada";
        String json = """
            {
              "user": "%s",
              "roles": ["admin", "dev"]
            }""".formatted(user);                                        // text block (Java 15)
        System.out.println(json);
    }
}`,
          },
        ],
        output: `checkout ... deploy, reversed [deploy, test, build, checkout]
first home=1, last cart=3, newest first [cart, search, home]
valid numbers: 2
2 4
Feb in a leap year: 29, June: 30
{
  "user": "ada",
  "roles": ["admin", "dev"]
}`,
        explain: `- Before Java 21, getting the last element of a list was \`list.get(list.size() - 1)\` and of a \`LinkedHashSet\` it needed iteration. Sequenced collections give one API for anything with a defined order.
- \`reversed()\` returns a **view**, not a copy.
- In the text block, the indentation common to all lines (set by the closing \`"""\`) is removed. Putting \`"""\` right after the last line avoids a trailing newline.
- The enum switch covers every constant, so it needs no \`default\`.`,
      },
      {
        title: "Stream gatherers: windows, running totals and concurrency (Java 24+)",
        note: "Gatherers are final in Java 24. On Java 21, use a loop or a library like StreamEx.",
        variants: [
          {
            lang: "java",
            code: `import java.util.List;
import java.util.Objects;
import java.util.stream.Gatherer;
import java.util.stream.Gatherers;
import java.util.stream.Stream;

public class GatherersDemo {
    /** A custom gatherer: drop an element when it equals the one just before it. */
    static <T> Gatherer<T, ?, T> dedupeConsecutive() {
        return Gatherer.<T, Object[], T>ofSequential(
            () -> new Object[] {null},                       // state: the previous element
            (state, element, downstream) -> {
                if (Objects.equals(state[0], element)) return true;    // skip, keep going
                state[0] = element;
                return downstream.push(element);
            });
    }

    public static void main(String[] args) {
        List<Integer> readings = List.of(3, 5, 4, 9, 12, 8, 7, 15);

        System.out.println("batches of 3:    " + readings.stream().gather(Gatherers.windowFixed(3)).toList());
        System.out.println("sliding sums:    " + readings.stream()
            .gather(Gatherers.windowSliding(3))
            .map(w -> w.stream().mapToInt(Integer::intValue).sum())
            .toList());
        System.out.println("running total:   " + readings.stream().gather(Gatherers.scan(() -> 0, Integer::sum)).toList());
        System.out.println("max via fold:    " + readings.stream().gather(Gatherers.fold(() -> Integer.MIN_VALUE, Math::max)).findFirst().orElseThrow());
        System.out.println("deduped:         " + Stream.of("a", "a", "b", "b", "b", "a", "c", "c").gather(dedupeConsecutive()).toList());

        // Up to 4 calls at a time on virtual threads, results in the original order.
        List<String> upper = Stream.of("alpha", "beta", "gamma", "delta", "epsilon")
            .gather(Gatherers.mapConcurrent(4, s -> {
                try {
                    Thread.sleep(50L * s.length());            // pretend to call a slow service
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return s.toUpperCase();
            }))
            .toList();
        System.out.println("mapConcurrent:   " + upper);
    }
}`,
          },
        ],
        output: `batches of 3:    [[3, 5, 4], [9, 12, 8], [7, 15]]
sliding sums:    [12, 18, 25, 29, 27, 30]
running total:   [3, 8, 12, 21, 33, 41, 48, 63]
max via fold:    15
deduped:         [a, b, a, c]
mapConcurrent:   [ALPHA, BETA, GAMMA, DELTA, EPSILON]`,
        explain: `- A **gatherer** is to intermediate operations what a collector is to terminal ones: a pluggable building block. It has optional state, an *integrator* called per element, and can push zero, one or many results downstream.
- \`windowSliding(3)\` gives every run of three consecutive readings: the basis of moving averages.
- \`mapConcurrent\` is the simplest way to fan out blocking calls with a concurrency limit while keeping order.
- Returning \`true\` from the integrator means "keep sending me elements"; returning \`false\` short-circuits the stream.`,
      },
      {
        title: "Java 25: module imports, flexible constructors and scoped values",
        note: "Needs JDK 25.",
        variants: [
          {
            lang: "java",
            code: `import module java.base;                   // Java 25: every package java.base exports (java.util, java.time, ...)

public class Java25 {
    static class Money {
        final long cents;
        final String currency;

        Money(long cents, String currency) {
            this.cents = cents;
            this.currency = currency;
        }
    }

    static class Payment extends Money {
        final String reference;

        Payment(long cents, String currency, String reference) {
            // Java 25: statements before super(...). Validate first instead of after the parent ran.
            if (cents <= 0) throw new IllegalArgumentException("amount must be positive: " + cents);
            String code = currency.strip().toUpperCase(Locale.ROOT);
            super(cents, code);
            this.reference = reference;
        }
    }

    static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();

    static void log(String message) {
        String id = REQUEST_ID.isBound() ? REQUEST_ID.get() : "-";
        System.out.println("[" + id + "] " + message);
    }

    static void chargeCard(Payment p) {
        log("charging " + p.cents + " " + p.currency + " for " + p.reference);   // no request id parameter needed
    }

    public static void main(String[] args) {
        Payment p = new Payment(4_999, " usd ", "order-17");
        ScopedValue.where(REQUEST_ID, "req-42").run(() -> {
            log("handling checkout");
            chargeCard(p);
            ScopedValue.where(REQUEST_ID, "req-42/retry").run(() -> log("rebound for a nested call"));
            log("back in the outer scope");
        });
        log("outside any request");

        try {
            new Payment(0, "usd", "order-18");
        } catch (IllegalArgumentException e) {
            log("rejected: " + e.getMessage());
        }
        List<String> imported = List.of("List", "Locale");               // both came from the module import
        log("no java.util imports needed for " + imported);
    }
}`,
          },
        ],
        output: `[req-42] handling checkout
[req-42] charging 4999 USD for order-17
[req-42/retry] rebound for a nested call
[req-42] back in the outer scope
[-] outside any request
[-] rejected: amount must be positive: 0
[-] no java.util imports needed for [List, Locale]`,
        explain: `- **Flexible constructor bodies** let a subclass check its arguments before the parent constructor runs. The prologue can't touch \`this\` yet.
- A **scoped value** is bound for the duration of \`run(...)\` and visible to every method called inside it, then automatically unbound. Unlike \`ThreadLocal\` it's immutable (rebind, don't set) and it's cheap to inherit into child threads in structured concurrency.
- \`import module\` is handy in scripts and teaching; in big codebases explicit imports are still clearer.`,
      },
    ],
    interview: [
      {
        q: "What problem do records solve, and what are their limits?",
        a: "Records (Java 16) are concise, immutable **data carriers**: from `record Point(int x, int y)` the compiler generates private final fields, a canonical constructor, accessors `x()` and `y()`, and value-based `equals`, `hashCode` and `toString`. Limits: fields are final (shallowly; a `List` component can still be mutated unless you copy it with `List.copyOf` in a compact constructor), records can't extend classes (they extend `Record`) though they can implement interfaces, and they can't declare extra instance fields. They're ideal for DTOs, value objects, map keys and pattern matching.",
        freq: "very-common",
      },
      {
        q: "What's new in Java 21 that matters for backend developers?",
        a: "Virtual threads (scalable blocking code), pattern matching for `switch` and record patterns (exhaustive, type-safe branching over sealed hierarchies), sequenced collections (`getFirst`, `getLast`, `reversed`), generational ZGC, and the key encapsulation API. Since Java 21 is an LTS, frameworks like Spring Boot 3.2+ embraced virtual threads with a single property. Previewed then: string templates (later withdrawn), unnamed variables and structured concurrency.",
        freq: "common",
      },
      {
        q: "What does Java 25 add?",
        a: "Java 25 (September 2025) is the latest LTS. Finalized features include compact source files and instance `main` methods (simpler programs and teaching), module import declarations, flexible constructor bodies (code before `super(...)`), scoped values (a safer ThreadLocal alternative for virtual threads), compact object headers (smaller objects), generational Shenandoah, and AOT command-line ergonomics and method profiling for faster startup. Structured concurrency, primitive patterns and stable values remained previews.",
        freq: "common",
      },
      {
        q: "Explain data-oriented programming in Java.",
        a: "Model data as immutable, transparent values (records), represent alternatives as sealed interfaces, and write operations as exhaustive pattern-matching switches rather than virtual methods spread across classes. Validate at construction so illegal states are unrepresentable. It complements OOP: use it where the set of variants is stable and operations change often (protocol messages, ASTs, domain events, results), and classic polymorphism where new variants are added often and operations are stable.",
      },
      {
        q: "What is a stream gatherer?",
        a: "Introduced as final in Java 24, `Stream.gather(Gatherer)` adds custom intermediate operations, just as `collect(Collector)` allows custom terminal ones. A gatherer has an optional initializer for state, an integrator invoked per element that can push zero or more elements downstream and can short-circuit, an optional combiner for parallel streams, and a finisher. Built-ins in `Gatherers` include `windowFixed`, `windowSliding`, `fold`, `scan` and `mapConcurrent`.",
      },
    ],
    quiz: [
      {
        q: "Which Java versions are LTS releases?",
        options: ["9, 13, 17, 21", "8, 11, 17, 21, 25", "Every release", "11, 16, 21, 26"],
        answer: 1,
        explain: "LTS ships every two years: 17 (2021), 21 (2023), 25 (2025).",
      },
      {
        q: "`case Add(Num(double a), Num(double b)) ->` is an example of...",
        options: ["A generic method", "A nested record pattern", "A lambda", "Method overloading"],
        answer: 1,
        explain: "Record patterns can nest to deconstruct several levels at once.",
      },
      {
        q: "What does `list.reversed()` return in Java 21?",
        options: ["A reversed copy", "A reversed view of the same list", "Nothing, it reverses in place", "A stream"],
        answer: 1,
        explain: "Sequenced collection reversed() returns a view backed by the original.",
      },
      {
        q: "Which gatherer gives running totals [3, 8, 12] for [3, 5, 4]?",
        options: ["windowFixed", "fold", "scan", "mapConcurrent"],
        answer: 2,
        explain: "scan emits every intermediate accumulation; fold emits only the final one.",
      },
      {
        q: "What do flexible constructor bodies (Java 25) allow?",
        options: ["Multiple constructors", "Statements before super(...), such as validation", "Constructors in interfaces", "Async constructors"],
        answer: 1,
        explain: "Code that doesn't touch `this` can now run before the superclass constructor.",
      },
      {
        q: "What is ScopedValue designed to replace in many cases?",
        options: ["HashMap", "ThreadLocal", "synchronized", "Optional"],
        answer: 1,
        explain: "Immutable, scoped, cheap-to-inherit context, ideal with virtual threads.",
      },
    ],
  },
];
