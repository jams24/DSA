import type { Lesson } from "../types";

// Operating Systems, part 3: concurrency.

export const osPart3: Lesson[] = [
  // ------------------------------------------------------------------ RACES AND LOCKS
  {
    id: "os-races",
    part: "Part 3 · Concurrency",
    title: "Race conditions and locks",
    tagline: "Why counter++ breaks with two threads, critical sections, atomic instructions, spinlocks vs mutexes, futexes, memory ordering, Peterson's algorithm and check-then-act bugs.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["race"],
    complexity: [
      { op: "Atomic add / CAS", time: "~5–50 ns", note: "One indivisible instruction; slower under contention because the cache line bounces between cores" },
      { op: "Uncontended mutex", time: "~20 ns", note: "A futex: one atomic instruction in user space, no system call" },
      { op: "Contended mutex", time: "µs", note: "The loser sleeps in the kernel (futex wait) and needs a context switch to wake up" },
      { op: "Spinlock", time: "ns if short, wasteful if long", note: "Burns CPU while waiting; only good when the critical section is tiny and the holder is running" },
    ],
    concept: `## Explain it like I'm 10 🧸
Two kids keep score on **one whiteboard**. The score is **5**. Both score a point at the same moment, so both run to the board:
1. Kid A **reads** the board: "5".
2. Kid B **reads** the board: "5".
3. Kid A thinks "5 + 1 = 6" and **writes 6**.
4. Kid B thinks "5 + 1 = 6" and **writes 6**.

Two points were scored, but the board says **6**, not 7. One point **vanished**. Nobody did anything "wrong": each kid did read, add, write. The problem is that their steps got **mixed together**. That's a **race condition**: the result depends on who happens to go first.

The fix: a **lock** on the whiteboard marker. Only the kid holding the marker can read-add-write. The other kid waits. Now the score is always 7.

Play with the visualizer: run the steps of two threads in any order you like, and find an order that loses an update. Then turn the lock on and try to break it.

## counter++ is three steps
On the CPU, \`counter++\` on a shared variable is really:
\`\`\`text
load  r1, [counter]     ; read memory into a register
add   r1, r1, 1         ; add in the register
store [counter], r1     ; write it back
\`\`\`
The scheduler can switch threads **between any two instructions**, and on a multicore machine both threads really run at the same instant. If both load before either stores, one update is lost. Our first sample runs two threads that each add 1 five million times: the total comes out around **5.2 million instead of 10 million**. Almost half the work disappeared.

## Words you need
| Word | Meaning |
|---|---|
| **Race condition** | The result depends on the timing of threads |
| **Data race** | Two threads access the same memory at the same time, at least one writes, with no synchronisation. Undefined behaviour in C, C++ and Rust |
| **Critical section** | The code that touches shared data and must run one thread at a time |
| **Mutual exclusion** | The guarantee that at most one thread is inside the critical section |
| **Atomic** | Happens all at once: no other thread can see it half done |
| **Lock / mutex** | An object that gives mutual exclusion: \`lock()\` to enter, \`unlock()\` to leave |

A correct solution to the critical-section problem needs three things:
1. **Mutual exclusion**: at most one thread inside.
2. **Progress**: if nobody is inside and someone wants in, someone gets in (no pointless blocking).
3. **Bounded waiting**: a waiting thread gets in after a limited number of others (no starvation).

## Hardware to the rescue: atomic instructions
Software alone can do mutual exclusion (Peterson's algorithm, below), but it's slow and fragile. Every modern CPU instead offers **atomic read-modify-write** instructions:
| Instruction | What it does atomically |
|---|---|
| **Test-and-set** | Set a flag to 1 and return the old value |
| **Compare-and-swap** (CAS) | "If the value is still X, change it to Y", and tell me if it worked |
| **Fetch-and-add** | Add N and return the old value |
| **Load-linked / store-conditional** | Read, then write only if nobody else wrote in between (ARM, RISC-V) |

On x86 these are \`lock xadd\`, \`lock cmpxchg\` and friends; on ARM they're \`ldxr\`/\`stxr\` loops or the newer \`ldadd\`/\`cas\`. In C you get them through \`<stdatomic.h>\` (\`atomic_fetch_add\`, \`atomic_compare_exchange_strong\`), in C++ through \`std::atomic\`, in Java through \`AtomicInteger\`, and in Go through \`sync/atomic\`.

With CAS you can build almost anything. Here's how a lock-free increment works:
\`\`\`c
long old, new;
do {
    old = atomic_load(&counter);
    new = old + 1;
} while (!atomic_compare_exchange_weak(&counter, &old, new));   // someone changed it? try again
\`\`\`

## Spinlocks vs mutexes (sleeping locks)
A **spinlock** is a loop around test-and-set: "keep trying until I get it". It's tiny and fast **if the wait is short**, but a waiting thread **burns a whole CPU** doing nothing useful. If the lock holder gets descheduled, the spinner wastes its entire time slice.

A **mutex** puts the waiter **to sleep** in the kernel and wakes it when the lock is free. No wasted CPU, but sleeping and waking costs a context switch (microseconds).

Linux's \`pthread_mutex\` is built on the **futex** ("fast userspace mutex"), which gives the best of both:
- **Fast path**: if the lock is free, one atomic instruction in user space takes it. No system call at all.
- **Slow path**: if it's taken, maybe spin briefly, then call \`futex(FUTEX_WAIT)\` to sleep in the kernel. \`unlock\` calls \`futex(FUTEX_WAKE)\` only if someone is waiting.

| Use a spinlock when... | Use a mutex when... |
|---|---|
| The critical section is a few instructions | The critical section may be long, or may block (I/O, \`malloc\`) |
| You're in the kernel and **can't sleep** (interrupt handlers) | You're in normal user code (almost always) |
| Threads are pinned to separate cores | There are more threads than cores |

In our benchmark with 4 threads hammering one counter, the atomic add took **0.08 s**, the mutex **0.21 s** and the hand-made spinlock **0.61 s**. Heavy contention punishes naive spinning.

Inside a single-core kernel, the oldest trick is to **disable interrupts**: if no interrupt can fire, the scheduler can't switch away. That doesn't work on multicore machines (the other cores keep running), and user programs aren't allowed to do it, so kernels use spinlocks with interrupts disabled.

## Memory ordering: the sneaky part
You might think "set a flag, then check the other thread's flag" is enough. But **compilers and CPUs reorder memory operations** for speed. Each CPU core has a **store buffer**: your write may sit there while your next read goes ahead, so another core sees the operations in a different order.

**Peterson's algorithm** gives mutual exclusion for two threads with only loads and stores, but it's only correct with **sequentially consistent** atomics. With plain variables, modern hardware breaks it. Locks and atomics include the right **memory barriers** (fences) so that everything written before \`unlock()\` is visible to the next thread after \`lock()\`. Rule of thumb: **never share data without a lock or an atomic**, and don't write your own synchronisation in production.

\`volatile\` in C does **not** make things thread-safe: it stops the compiler from caching a value in a register, but it gives no atomicity and no ordering. (Java's \`volatile\` is different: it does give visibility and ordering, but still not atomic \`++\`.)

## Check-then-act and TOCTOU
Races aren't only about counters. Any time you **check** something and then **act** on it, the world can change in between:
- "If the balance is ≥ 80, withdraw 80": two threads both see 100, both withdraw, balance −60.
- "If the file doesn't exist, create it": another process creates it in between. Use \`open(path, O_CREAT | O_EXCL)\` to make check-and-create one atomic step.
- **TOCTOU** (time of check to time of use) is a classic **security** bug: a program checks that \`/tmp/x\` is safe, then an attacker swaps it for a link to \`/etc/passwd\` before the program opens it.

The fix is always the same: make the check and the act **one atomic step**, with a lock, a transaction or an atomic system call.

## Finding races
Races are random, so testing alone rarely finds them. Use tools:
- **ThreadSanitizer**: compile with \`-fsanitize=thread\` (C, C++, Go has \`-race\`). It reports data races with both stack traces.
- **Helgrind** and **DRD** (Valgrind tools).
- Code review rule: for every shared variable, ask "which lock protects this?". Write it in a comment.`,
    keyPoints: [
      "A race condition is when the result depends on timing; counter++ is load, add, store, and interleavings lose updates",
      "A critical section needs mutual exclusion, progress and bounded waiting",
      "Hardware gives atomic read-modify-write instructions: test-and-set, compare-and-swap, fetch-and-add",
      "Spinlocks busy-wait (good for tiny sections and kernel code); mutexes sleep (good for everything else)",
      "Linux mutexes are futexes: no system call unless there's contention",
      "CPUs and compilers reorder memory operations; locks and atomics include the fences that make sharing correct",
      "volatile is not a lock; check-then-act and TOCTOU bugs need the check and act to be one atomic step",
    ],
    code: [
      {
        title: "Lost updates: two threads, one counter",
        linux: true,
        note: "On the test machine the first trial already ended at 5,230,847 instead of 10,000,000 (printed to stderr).",
        variants: [{ lang: "c", code: `// Two threads add 1 to the same counter millions of times. Without protection, updates get lost.
#include <pthread.h>
#include <stdio.h>

#define N 5000000
volatile long counter = 0;           // volatile: really load and store memory every time

static void *add(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++)
        counter++;                   // really three steps: load counter, add 1, store counter
    return NULL;
}

int main(void) {
    for (int trial = 1; trial <= 5; trial++) {
        counter = 0;
        pthread_t a, b;
        pthread_create(&a, NULL, add, NULL);
        pthread_create(&b, NULL, add, NULL);
        pthread_join(a, NULL);
        pthread_join(b, NULL);
        fprintf(stderr, "trial %d: counter = %ld (expected %d)\\n", trial, counter, 2 * N);
        if (counter != 2 * N) {
            printf("expected %d, but some updates were lost: yes\\n", 2 * N);
            return 0;
        }
    }
    printf("no updates lost this time (try again: races are random)\\n");
    return 0;
}` }],
        explain: `- Each thread runs \`counter++\` five million times. With two threads we should get ten million.
- \`volatile\` forces a real load and store every time (otherwise the optimiser would keep the counter in a register and the effect would be even worse). It does **not** make the increment atomic.
- The two cores constantly load the same old value and overwrite each other's results. Almost half the increments are lost.
- Races are random: the program tries up to five times, but on a multicore machine it fails on the very first try.`,
        output: `expected 10000000, but some updates were lost: yes`,
      },
      {
        title: "Three fixes: mutex, atomic, spinlock",
        linux: true,
        note: "Timings go to stderr; on the test machine with 4 threads: mutex 0.21 s, atomic 0.08 s, spinlock 0.61 s.",
        variants: [{ lang: "c", code: `// Three correct ways to share the counter: a mutex, an atomic add, and a spinlock built from scratch.
#include <pthread.h>
#include <stdatomic.h>
#include <stdio.h>
#include <time.h>

#define N 2000000
static long counter;
static pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
static atomic_long acounter;
static atomic_flag spin = ATOMIC_FLAG_INIT;   // a single bit: set or clear

static void *with_mutex(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++) {
        pthread_mutex_lock(&mutex);           // only one thread at a time gets past here...
        counter++;                            // ...so this is a critical section
        pthread_mutex_unlock(&mutex);
    }
    return NULL;
}

static void *with_atomic(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++)
        atomic_fetch_add(&acounter, 1);       // one indivisible read-modify-write instruction
    return NULL;
}

static void *with_spinlock(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++) {
        while (atomic_flag_test_and_set(&spin)) {}   // set the flag; if it WAS set, someone holds it: spin
        counter++;
        atomic_flag_clear(&spin);                     // release
    }
    return NULL;
}

static double run(void *(*fn)(void *)) {
    struct timespec a, b;
    clock_gettime(CLOCK_MONOTONIC, &a);
    pthread_t t[4];
    for (int i = 0; i < 4; i++) pthread_create(&t[i], NULL, fn, NULL);
    for (int i = 0; i < 4; i++) pthread_join(t[i], NULL);
    clock_gettime(CLOCK_MONOTONIC, &b);
    return (b.tv_sec - a.tv_sec) + (b.tv_nsec - a.tv_nsec) / 1e9;
}

int main(void) {
    double t1 = run(with_mutex);
    printf("mutex:     %ld\\n", counter);
    double t2 = run(with_atomic);
    printf("atomic:    %ld\\n", (long)atomic_load(&acounter));
    counter = 0;
    double t3 = run(with_spinlock);
    printf("spinlock:  %ld\\n", counter);
    printf("all three got exactly %d: %s\\n", 4 * N, counter == 4 * N && atomic_load(&acounter) == 4 * N ? "yes" : "no");
    fprintf(stderr, "mutex %.2f s, atomic %.2f s, spinlock %.2f s\\n", t1, t2, t3);
    return 0;
}` }],
        explain: `- **Mutex**: \`pthread_mutex_lock\` lets one thread at a time into the critical section. Correct and the right default.
- **Atomic**: \`atomic_fetch_add\` is a single indivisible instruction (\`lock xadd\` on x86, \`ldadd\` on ARM). For a single counter, this is the fastest fix.
- **Spinlock**: \`atomic_flag_test_and_set\` sets the flag and returns its old value. If the old value was "set", someone else holds the lock, so we loop. It works, but four threads spinning on one cache line is the slowest option here.
- All three get exactly 8,000,000. Correctness first; then pick the cheapest tool that's still correct.`,
        output: `mutex:     8000000
atomic:    8000000
spinlock:  8000000
all three got exactly 8000000: yes`,
      },
      {
        title: "Peterson's algorithm (mutual exclusion from scratch)",
        linux: true,
        variants: [{ lang: "c", code: `// Peterson's algorithm: mutual exclusion for two threads using only loads and stores.
// It needs sequentially consistent memory operations; with plain variables, modern CPUs and
// compilers reorder the stores and loads and the algorithm breaks.
#include <pthread.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdio.h>

static atomic_bool interested[2];
static atomic_int turn;
static long counter;
#define N 1000000

static void lock(int me) {
    int other = 1 - me;
    atomic_store(&interested[me], true);   // "I want to enter"
    atomic_store(&turn, other);            // "but you go first if you also want to"
    while (atomic_load(&interested[other]) && atomic_load(&turn) == other) {}   // wait politely
}

static void unlock(int me) { atomic_store(&interested[me], false); }

static void *worker(void *arg) {
    int me = *(int *)arg;
    for (int i = 0; i < N; i++) {
        lock(me);
        counter++;                         // critical section
        unlock(me);
    }
    return NULL;
}

int main(void) {
    pthread_t t[2];
    int ids[2] = {0, 1};
    for (int i = 0; i < 2; i++) pthread_create(&t[i], NULL, worker, &ids[i]);
    for (int i = 0; i < 2; i++) pthread_join(t[i], NULL);
    printf("counter = %ld (expected %d)\\n", counter, 2 * N);
    return 0;
}` }],
        explain: `- Each thread says "I'm interested" and then politely gives the turn to the other. It waits only if the other is interested **and** it's the other's turn.
- If both arrive together, both write \`turn\`; whoever wrote **last** loses and waits. So exactly one gets in: mutual exclusion, progress and bounded waiting, using only loads and stores.
- It's correct here only because \`atomic_store\` and \`atomic_load\` default to **sequentially consistent** ordering. With plain \`bool\` and \`int\`, the CPU's store buffer lets both threads read the other's flag as false, and both enter.
- Peterson is a classic exam and interview topic. In real code, use the hardware atomics and locks instead.`,
        output: `counter = 2000000 (expected 2000000)`,
      },
      {
        title: "Check-then-act: the double withdrawal (Python)",
        variants: [{ lang: "python", code: `# A "check-then-act" race: two withdrawals both see enough money, and both succeed.
import threading
import time


class Account:
    def __init__(self, balance):
        self.balance = balance
        self.lock = threading.Lock()

    def withdraw_unsafe(self, amount):
        if self.balance >= amount:      # CHECK
            time.sleep(0.01)            # (another thread runs here)
            self.balance -= amount      # ACT, based on a check that's no longer true
            return True
        return False

    def withdraw_safe(self, amount):
        with self.lock:                 # check and act as one atomic step
            if self.balance >= amount:
                time.sleep(0.01)
                self.balance -= amount
                return True
            return False


for method in ("withdraw_unsafe", "withdraw_safe"):
    acct = Account(100)
    results = []
    threads = [threading.Thread(target=lambda: results.append(getattr(acct, method)(80))) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print(f"{method:16} successful withdrawals: {results.count(True)}, balance left: {acct.balance}")` }],
        explain: `- Two threads each try to withdraw 80 from a balance of 100. Only one should succeed.
- In \`withdraw_unsafe\`, both threads **check** the balance (100 ≥ 80, fine) before either **acts**. Both withdraw, and the account ends at −60. The \`sleep\` just makes the bad timing certain; in production it happens rarely, which is worse.
- \`withdraw_safe\` holds the lock around the check **and** the act, so the second thread sees the updated balance (20) and is refused.
- Python's GIL doesn't save you: it protects the interpreter's internals, not your program's logic. Databases solve the same problem with transactions, \`SELECT ... FOR UPDATE\` or a conditional \`UPDATE ... WHERE balance >= 80\`.`,
        output: `withdraw_unsafe  successful withdrawals: 2, balance left: -60
withdraw_safe    successful withdrawals: 1, balance left: 20`,
      },
    ],
    interview: [
      {
        q: "What is a race condition? Give an example.",
        freq: "very-common",
        a: `A race condition is a bug where the outcome depends on the relative timing of threads or processes. Example: two threads run \`count++\` on a shared variable. The increment is load, add, store; if both load the old value before either stores, one increment is lost. Another: check-then-act, like two withdrawals that both see enough balance.

Fix: make the critical section mutually exclusive (a lock) or use an atomic operation, and make check-and-act one atomic step.`,
      },
      {
        q: "What's the difference between a mutex and a spinlock? When would you use each?",
        freq: "very-common",
        a: `Both give mutual exclusion. A **spinlock** busy-waits in a loop until the lock is free: no context switch, so it's fastest for very short critical sections when the holder is running on another core, but it wastes CPU and is terrible if the holder is descheduled. A **mutex** puts waiters to sleep and wakes them on unlock, which costs a context switch but no wasted CPU.

Use spinlocks in kernels (especially where sleeping is impossible, like interrupt handlers) and for tiny sections; use mutexes in application code. Linux mutexes (futexes) are adaptive: an atomic fast path, sometimes a short spin, then sleep.`,
      },
      {
        q: "What is a futex?",
        freq: "common",
        a: `A **fast userspace mutex**: a 32-bit integer in user memory plus a kernel wait queue keyed by its address. Locking an uncontended futex is one atomic instruction in user space, with no system call. Only when there's contention does a thread call \`futex(FUTEX_WAIT)\` to sleep, and the unlocker calls \`futex(FUTEX_WAKE)\` if there were waiters. glibc's pthread mutexes, condition variables and semaphores are built on it.`,
      },
      {
        q: "What is compare-and-swap and how do you use it?",
        freq: "common",
        a: `CAS(addr, expected, new) atomically checks whether \`*addr == expected\` and, if so, writes \`new\`, returning whether it succeeded. Lock-free algorithms use a retry loop: read the current value, compute the new one, CAS; if another thread changed it in between, the CAS fails and you retry. It's how atomic counters, lock-free stacks and queues, and the lock fast path itself are built.

Pitfall: the **ABA problem**. The value goes A to B and back to A, and the CAS succeeds even though things changed. Fixes: version counters (tagged pointers), hazard pointers, or garbage-collected memory.`,
      },
      {
        q: "Is volatile enough to make a shared counter thread-safe in C?",
        freq: "common",
        a: `No. In C and C++, \`volatile\` only stops the compiler from optimising away loads and stores (it was designed for memory-mapped hardware). It gives no atomicity, so \`count++\` is still load-add-store, and no ordering guarantees between threads. Use \`_Atomic\`/\`std::atomic\` or a mutex. In Java, \`volatile\` does give visibility and ordering, but \`count++\` on a volatile is still not atomic; use \`AtomicInteger\`.`,
      },
      {
        q: "What are the requirements for a solution to the critical-section problem?",
        freq: "occasional",
        a: `**Mutual exclusion** (at most one process in the critical section), **progress** (if none is inside, the choice of who enters next can't be postponed forever, and only those trying take part), and **bounded waiting** (a limit on how many times others can enter before a waiting process gets its turn). Peterson's algorithm satisfies all three for two processes, given sequentially consistent memory.`,
      },
      {
        q: "Why does memory ordering matter for synchronisation?",
        freq: "occasional",
        a: `Compilers and CPUs reorder loads and stores that look independent (store buffers, out-of-order execution, caches). Another thread can then see writes in a different order than the program wrote them, so "write data, then set ready = true" may be seen as ready-then-data. Locks and atomics with **acquire/release** semantics add the fences needed: everything before a release (unlock) is visible to a thread after the matching acquire (lock). x86 is relatively strict (TSO); ARM and POWER are weaker, so missing fences show up there first.`,
      },
    ],
    quiz: [
      {
        q: "Two threads each run `counter++` once on a shared counter that starts at 5. Without a lock, which final values are possible?",
        options: ["Only 7", "6 or 7", "5, 6 or 7", "Any number"],
        answer: 1,
        explain: "If both load 5 before either stores, both write 6; otherwise one sees the other's write and you get 7.",
      },
      {
        q: "What is a critical section?",
        options: ["Code that runs in kernel mode", "Code that accesses shared data and must not run in two threads at once", "The first line of main", "A section of memory that can't be paged out"],
        answer: 1,
        explain: "It's the part that touches shared state; mutual exclusion keeps it to one thread at a time.",
      },
      {
        q: "Which instruction is the basis of most lock-free algorithms?",
        options: ["NOP", "Compare-and-swap", "Jump", "Halt"],
        answer: 1,
        explain: "CAS lets you update a value only if nobody changed it since you read it, with a retry loop.",
      },
      {
        q: "A thread holds a spinlock and gets preempted. What do other threads wanting that lock do?",
        options: ["Sleep until it's released", "Spin and waste their CPU time until the holder runs again", "Steal the lock", "Crash"],
        answer: 1,
        explain: "That's the weakness of spinlocks: they assume the holder is running and will release soon.",
      },
      {
        q: "What does the futex fast path do when the mutex is free?",
        options: ["Makes a system call", "Takes the lock with one atomic instruction in user space", "Disables interrupts", "Sleeps for 1 ms"],
        answer: 1,
        explain: "Uncontended locking never enters the kernel; that's why mutexes are cheap when nobody is waiting.",
      },
      {
        q: "Why doesn't disabling interrupts work as a lock on a multicore machine?",
        options: ["It does work", "Other cores keep running and can still enter the critical section", "Interrupts can't be disabled", "It makes the code too fast"],
        answer: 1,
        explain: "Disabling interrupts only stops preemption on the current core.",
      },
      {
        q: "A program checks `access(path, W_OK)` and then calls `open(path)`. What class of bug is this?",
        options: ["Deadlock", "TOCTOU (time of check to time of use)", "Buffer overflow", "Memory leak"],
        answer: 1,
        explain: "The file can be swapped between the check and the use; make them one atomic operation instead.",
      },
      {
        q: "Which tool detects data races at run time in C, C++ and Go?",
        options: ["gprof", "ThreadSanitizer", "strace", "make"],
        answer: 1,
        explain: "Compile with -fsanitize=thread (or go test -race) and it reports racing accesses with stack traces.",
      },
    ],
  },

  // ------------------------------------------------------------------ SYNCHRONIZATION
  {
    id: "os-sync",
    title: "Semaphores, condition variables and classic problems",
    tagline: "Waiting for a condition, semaphores, monitors, producer-consumer, readers-writers, dining philosophers, barriers and priority inversion.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["philosophers"],
    concept: `## Explain it like I'm 10 🧸
A lock answers "**only one at a time, please**". But threads often need to **wait for something to happen**:
- A **bakery shelf** holds 4 cakes. The baker must **wait** when the shelf is full. Customers must **wait** when it's empty. That's the **producer-consumer** problem.
- A **bouncy castle** fits 3 kids. A **bouncer with 3 wristbands** lets kids in until the wristbands run out; the next kid waits until someone comes out and hands theirs back. That's a **semaphore**.
- A **library**: lots of people can **read** the same book at once, but someone **writing** in it needs it to themselves. That's **readers-writers**.
- Five **philosophers** around a table, with one fork between each pair. Everyone needs **two forks** to eat. If they all grab their left fork at the same moment, they all wait for the right one... **forever**. That's **deadlock**, and the visualizer shows it.

## Condition variables: "wake me when..."
A **condition variable** lets a thread sleep until another thread says "something changed". It's always used **with a mutex**:
\`\`\`c
pthread_mutex_lock(&m);
while (count == 0)                    // ALWAYS a while, never an if
    pthread_cond_wait(&not_empty, &m); // unlock m + sleep, atomically; re-lock when woken
take_item();
pthread_mutex_unlock(&m);
\`\`\`
- \`pthread_cond_wait\` **releases the mutex and sleeps in one atomic step**, so no wake-up can slip in between (a **lost wakeup**). When woken, it re-acquires the mutex before returning.
- \`pthread_cond_signal\` wakes **one** waiter; \`pthread_cond_broadcast\` wakes **all** of them.
- Why \`while\` and not \`if\`? **Spurious wakeups** are allowed (a thread may wake with nothing changed), and another thread may grab the item between the signal and your wake-up. Always re-check the condition.

## Semaphores
Edsger Dijkstra invented the **semaphore** in 1965: an integer counter with two atomic operations.
| Operation | Also called | Does |
|---|---|---|
| \`wait\` | **P**, down, acquire, \`sem_wait\` | If the count is > 0, decrement it and go on. Otherwise sleep until it is. |
| \`signal\` | **V**, up, release, \`sem_post\` | Increment the count and wake one sleeper. |

- A **counting semaphore** starting at N limits access to N things at once: a pool of 3 database connections, 10 parking spaces.
- A **binary semaphore** (0 or 1) works like a lock, but **anyone** may post it, not just the "owner". That makes it good for **signalling** ("the data is ready") and bad as a mutex (no ownership, so no priority inheritance or error checking).

Producer-consumer with semaphores uses three: \`empty\` (free slots, starts at N), \`full\` (filled slots, starts at 0) and a mutex for the buffer itself. The producer does \`wait(empty); lock; put; unlock; signal(full)\`, and the consumer does the mirror image.

## Monitors
A **monitor** packages shared data, a lock and condition variables together, so every method automatically runs with the lock held. Java's \`synchronized\` methods with \`wait()\`/\`notifyAll()\` are monitors, and so are C#'s \`lock\` and Python's \`threading.Condition\`. You can't forget to lock, because the language does it for you.

## The classic problems
| Problem | The challenge | Typical solution |
|---|---|---|
| **Producer-consumer** (bounded buffer) | Producers wait when full, consumers wait when empty | One mutex + two condition variables, or semaphores \`empty\`/\`full\` |
| **Readers-writers** | Many readers together, writers alone | A **read-write lock**. Watch for starvation: endless readers can starve writers, so most implementations let a waiting writer block new readers |
| **Dining philosophers** | Each needs two shared resources; a circular wait deadlocks | **Resource ordering** (always pick the lower-numbered fork first), a **waiter** (at most 4 may sit), or **try-lock and back off** |
| **Sleeping barber** | A waiting room with limited chairs | Semaphores counting customers and the barber's readiness |
| **Barrier** | N threads must all reach a point before any continues | \`pthread_barrier_t\`, Java's \`CyclicBarrier\`, \`threading.Barrier\` |

Real systems are full of these: a **job queue** between a web server and workers is producer-consumer; a **config cache** read by every request and occasionally reloaded is readers-writers; a **connection pool** is a counting semaphore; **Go channels** are bounded buffers with the locking built in.

## Priority inversion: the bug that hit Mars
Three tasks: **High**, **Medium** and **Low** priority. Low holds a lock. High wants the lock, so it waits for Low. Then Medium (which doesn't need the lock) becomes runnable and **preempts Low**, because it has higher priority. Now High is effectively waiting for Medium: priorities are **inverted**.

In 1997 this happened on NASA's **Mars Pathfinder**: a high-priority bus task kept missing its deadline, a watchdog noticed, and the lander kept **rebooting**. The fix, uploaded from Earth, enabled **priority inheritance**: while Low holds a lock that High wants, Low temporarily **inherits High's priority**, so Medium can't preempt it. Linux offers this with \`PTHREAD_PRIO_INHERIT\` mutexes; real-time systems also use **priority ceilings**.

## Beyond locks
- **Lock-free** data structures (built on CAS) guarantee that some thread always makes progress; **wait-free** ones guarantee every thread does. They're hard to write correctly; use the ones in your standard library (\`ConcurrentLinkedQueue\`, \`crossbeam\`).
- **Read-copy-update** (RCU) in the Linux kernel lets readers run with no locks at all: writers publish a new copy and free the old one once all readers have moved on.
- **Message passing** avoids shared memory: "don't communicate by sharing memory; share memory by communicating" (Go). Actors (Erlang, Akka) and channels are built this way.`,
    keyPoints: [
      "Condition variables let a thread sleep until a condition may have changed; always wait in a while loop, holding the mutex",
      "pthread_cond_wait atomically releases the mutex and sleeps, which prevents lost wakeups",
      "Semaphores count: wait (P) decrements or sleeps, post (V) increments and wakes; counting semaphores limit concurrency",
      "Monitors bundle data, a lock and condition variables (Java synchronized, Python Condition)",
      "Classic problems: producer-consumer, readers-writers, dining philosophers, sleeping barber, barriers",
      "Priority inversion: a medium task blocks a high one by preempting the low task that holds its lock; fix with priority inheritance",
    ],
    code: [
      {
        title: "Producer-consumer: a bounded buffer with condition variables",
        linux: true,
        variants: [{ lang: "c", code: `// Producer-consumer with a bounded buffer: one mutex and two condition variables.
#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>

#define CAP 4            // the buffer holds at most 4 items
#define ITEMS 1000       // each producer makes 1000 items
#define PRODUCERS 2
#define CONSUMERS 3

static int buf[CAP];
static int head, tail, count;
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
static pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
static int seen[PRODUCERS * ITEMS + 1];
static int producers_left = PRODUCERS;
static int max_count;

static void put(int item) {
    pthread_mutex_lock(&m);
    while (count == CAP)                      // ALWAYS a while loop, never an if: re-check after waking
        pthread_cond_wait(&not_full, &m);     // atomically: unlock m, sleep, re-lock m when woken
    buf[tail] = item;
    tail = (tail + 1) % CAP;
    count++;
    if (count > max_count) max_count = count;
    pthread_cond_signal(&not_empty);          // wake one consumer
    pthread_mutex_unlock(&m);
}

static bool get(int *item) {                  // returns false when everything has been consumed
    pthread_mutex_lock(&m);
    while (count == 0 && producers_left > 0)
        pthread_cond_wait(&not_empty, &m);
    if (count == 0) {                         // empty AND no producers left: we're done
        pthread_mutex_unlock(&m);
        return false;
    }
    *item = buf[head];
    head = (head + 1) % CAP;
    count--;
    pthread_cond_signal(&not_full);           // wake one producer
    pthread_mutex_unlock(&m);
    return true;
}

static void *producer(void *arg) {
    int id = *(int *)arg;
    for (int i = 1; i <= ITEMS; i++) put(id * ITEMS + i);   // items 1..2000, all different
    pthread_mutex_lock(&m);
    producers_left--;
    pthread_cond_broadcast(&not_empty);       // wake ALL consumers so they can notice we're finished
    pthread_mutex_unlock(&m);
    return NULL;
}

static void *consumer(void *arg) {
    long *sum = arg;
    int item;
    while (get(&item)) {
        *sum += item;
        __atomic_add_fetch(&seen[item], 1, __ATOMIC_RELAXED);
    }
    return NULL;
}

int main(void) {
    pthread_t p[PRODUCERS], c[CONSUMERS];
    int ids[PRODUCERS];
    long sums[CONSUMERS] = {0};
    for (int i = 0; i < CONSUMERS; i++) pthread_create(&c[i], NULL, consumer, &sums[i]);
    for (int i = 0; i < PRODUCERS; i++) {
        ids[i] = i;
        pthread_create(&p[i], NULL, producer, &ids[i]);
    }
    for (int i = 0; i < PRODUCERS; i++) pthread_join(p[i], NULL);
    for (int i = 0; i < CONSUMERS; i++) pthread_join(c[i], NULL);

    long total = sums[0] + sums[1] + sums[2];
    bool once = true;
    for (int i = 1; i <= PRODUCERS * ITEMS; i++) once = once && seen[i] == 1;
    int n = PRODUCERS * ITEMS;
    printf("consumed sum = %ld (expected %d)\\n", total, n * (n + 1) / 2);
    printf("every item consumed exactly once: %s\\n", once ? "yes" : "no");
    printf("the buffer never held more than %d items: %s\\n", CAP, max_count <= CAP ? "yes" : "no");
    return 0;
}` }],
        explain: `- The buffer holds only **4** items, but 2 producers push 2,000 items through it to 3 consumers. Producers must wait when it's full; consumers must wait when it's empty.
- \`put\` waits on \`not_full\` **in a while loop**, adds the item, then signals \`not_empty\` to wake a consumer. \`get\` is the mirror image.
- Shutting down cleanly is part of the problem: each producer decrements \`producers_left\` and **broadcasts**, so every sleeping consumer wakes, sees "empty and no producers left", and returns false.
- The checks prove it: the sum is exactly 1 + 2 + ... + 2000, every item was consumed once, and the buffer never overflowed.`,
        output: `consumed sum = 2001000 (expected 2001000)
every item consumed exactly once: yes
the buffer never held more than 4 items: yes`,
      },
      {
        title: "A counting semaphore as a bouncer",
        linux: true,
        variants: [{ lang: "c", code: `// A counting semaphore as a "bouncer": at most 3 threads may use the database at once.
#include <pthread.h>
#include <semaphore.h>
#include <stdio.h>
#include <unistd.h>

static sem_t slots;                      // counts free connections
static pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
static int inside, most_inside;

static void *worker(void *arg) {
    (void)arg;
    sem_wait(&slots);                    // P / down: take a slot, or sleep until one is free
    pthread_mutex_lock(&m);
    inside++;
    if (inside > most_inside) most_inside = inside;
    pthread_mutex_unlock(&m);

    usleep(20000);                       // "use the database connection" for 20 ms

    pthread_mutex_lock(&m);
    inside--;
    pthread_mutex_unlock(&m);
    sem_post(&slots);                    // V / up: give the slot back, waking one waiter
    return NULL;
}

int main(void) {
    sem_init(&slots, 0, 3);              // 3 slots, shared between threads (not processes)
    pthread_t t[10];
    for (int i = 0; i < 10; i++) pthread_create(&t[i], NULL, worker, NULL);
    for (int i = 0; i < 10; i++) pthread_join(t[i], NULL);
    printf("10 threads used the database, never more than 3 at once: %s\\n", most_inside <= 3 ? "yes" : "no");
    int v;
    sem_getvalue(&slots, &v);
    printf("free slots at the end: %d\\n", v);
    sem_destroy(&slots);
    return 0;
}` }],
        explain: `- \`sem_init(&slots, 0, 3)\` creates a semaphore with 3 permits. The middle argument 0 means "shared between threads"; 1 would mean between processes (it would then have to live in shared memory).
- Ten threads call \`sem_wait\`. The first three get in, and the rest **sleep** until someone calls \`sem_post\`.
- The program measures the most threads ever inside at once, and it's never more than 3. At the end all 3 permits are back.
- This is how connection pools, rate limiters and "at most N downloads at a time" are built. In Python it's \`threading.Semaphore(3)\`, in Java \`java.util.concurrent.Semaphore\`, in Go a buffered channel of size 3.`,
        output: `10 threads used the database, never more than 3 at once: yes
free slots at the end: 3`,
      },
      {
        title: "Readers-writers with pthread_rwlock",
        linux: true,
        variants: [{ lang: "c", code: `// Readers-writers: many readers may read together, but a writer needs the data to itself.
#include <pthread.h>
#include <stdio.h>
#include <unistd.h>

static pthread_rwlock_t lock = PTHREAD_RWLOCK_INITIALIZER;
static pthread_mutex_t stats = PTHREAD_MUTEX_INITIALIZER;
static int readers_in, writers_in, max_readers, bad;
static int price = 100;

static void note(int dr, int dw) {
    pthread_mutex_lock(&stats);
    readers_in += dr;
    writers_in += dw;
    if (readers_in > max_readers) max_readers = readers_in;
    if (writers_in > 1 || (writers_in && readers_in)) bad = 1;   // a writer must be alone
    pthread_mutex_unlock(&stats);
}

static void *reader(void *arg) {
    (void)arg;
    for (int i = 0; i < 5; i++) {
        pthread_rwlock_rdlock(&lock);    // shared: other readers may hold it too
        note(1, 0);
        volatile int p = price;
        (void)p;
        usleep(2000);
        note(-1, 0);
        pthread_rwlock_unlock(&lock);
    }
    return NULL;
}

static void *writer(void *arg) {
    (void)arg;
    for (int i = 0; i < 3; i++) {
        pthread_rwlock_wrlock(&lock);    // exclusive: waits until no readers or writers remain
        note(0, 1);
        price++;
        usleep(1000);
        note(0, -1);
        pthread_rwlock_unlock(&lock);
        usleep(3000);
    }
    return NULL;
}

int main(void) {
    pthread_t r[6], w[2];
    for (int i = 0; i < 6; i++) pthread_create(&r[i], NULL, reader, NULL);
    for (int i = 0; i < 2; i++) pthread_create(&w[i], NULL, writer, NULL);
    for (int i = 0; i < 6; i++) pthread_join(r[i], NULL);
    for (int i = 0; i < 2; i++) pthread_join(w[i], NULL);
    printf("several readers were inside at the same time: %s\\n", max_readers > 1 ? "yes" : "no");
    printf("a writer was ever inside with anyone else: %s\\n", bad ? "yes" : "no");
    printf("final price: %d (100 + 2 writers x 3 updates)\\n", price);
    return 0;
}` }],
        explain: `- \`pthread_rwlock_rdlock\` is a **shared** lock: many readers may hold it together. \`pthread_rwlock_wrlock\` is **exclusive**: it waits until every reader and writer has left.
- Separate bookkeeping (protected by its own mutex) records the most readers inside at once, and whether a writer was ever inside with anyone else. Several readers overlapped; a writer never had company.
- Read-write locks pay off when reads are **frequent and long** and writes are rare. For tiny critical sections a plain mutex is often faster, because an rwlock does more bookkeeping.
- Fairness matters: if readers keep arriving, a writer could wait forever. glibc's default prefers readers; the \`PTHREAD_RWLOCK_PREFER_WRITER_NONRECURSIVE_NP\` attribute changes that.`,
        output: `several readers were inside at the same time: yes
a writer was ever inside with anyone else: no
final price: 106 (100 + 2 writers x 3 updates)`,
      },
      {
        title: "Dining philosophers: deadlock and the fix (Python)",
        variants: [{ lang: "python", code: `# Dining philosophers: 5 philosophers, 5 forks, each needs the fork on their left AND right to eat.
import threading
import time

N = 5


def dinner(ordered, meals=3):
    forks = [threading.Lock() for _ in range(N)]
    all_holding_one = threading.Barrier(N)
    all_gave_up = threading.Barrier(N)
    eaten = [0] * N
    stuck = []

    def philosopher(i):
        left, right = i, (i + 1) % N
        # the fix: always pick up the LOWER-numbered fork first
        first, second = (min(left, right), max(left, right)) if ordered else (left, right)
        for meal in range(meals):
            forks[first].acquire()
            if not ordered and meal == 0:
                all_holding_one.wait()             # demo trick: make the unlucky timing happen every time
            else:
                time.sleep(0.002)                  # still a nasty pause, but ordering saves us
            if not forks[second].acquire(timeout=1):
                stuck.append(i)                    # waited a whole second: deadlock
                if not ordered:
                    all_gave_up.wait()             # demo trick: nobody lets go until all have given up
                forks[first].release()
                return
            eaten[i] += 1                          # eat!
            forks[second].release()
            forks[first].release()

    threads = [threading.Thread(target=philosopher, args=(i,)) for i in range(N)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return eaten, sorted(stuck)


eaten, stuck = dinner(ordered=False)
print("left fork first:   meals", eaten, "| stuck waiting:", stuck)
eaten, stuck = dinner(ordered=True)
print("lowest fork first: meals", eaten, "| stuck waiting:", stuck)` }],
        explain: `- Each philosopher \`i\` needs fork \`i\` and fork \`(i + 1) % 5\`. With "left fork first", the barrier makes everyone hold their left fork at the same moment, and then everyone waits for a right fork that's never released: **deadlock**. The timeout detects it and the demo reports all five stuck.
- The fix changes one line: always pick up the **lower-numbered** fork first. Philosopher 4 now reaches for fork 0 before fork 4, which breaks the circle. Someone can always finish eating, so everyone gets all 3 meals.
- The two "demo trick" lines only exist to make the unlucky timing happen on every run. Real deadlocks are rare and random, which is why they slip through testing.
- The visualizer runs the same dinner with a third fix: a **waiter** who lets at most 4 philosophers pick up forks.`,
        output: `left fork first:   meals [0, 0, 0, 0, 0] | stuck waiting: [0, 1, 2, 3, 4]
lowest fork first: meals [3, 3, 3, 3, 3] | stuck waiting: []`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a mutex and a semaphore?",
        freq: "very-common",
        a: `A **mutex** is a lock with an **owner**: the thread that locked it must unlock it, and it allows exactly one holder. That ownership enables priority inheritance, recursive locking and error checking. A **semaphore** is a **counter** with no owner: any thread can post it. A counting semaphore lets up to N threads in (resource pools); a binary semaphore is often used for **signalling** between threads ("data ready"), not for mutual exclusion.

Rule of thumb: protect data with a mutex; count resources or signal events with a semaphore.`,
      },
      {
        q: "Why must you call pthread_cond_wait in a while loop?",
        freq: "very-common",
        a: `Because when \`wait\` returns, the condition is **not guaranteed** to be true. **Spurious wakeups** are allowed by POSIX (and happen in practice), \`broadcast\` wakes several waiters but only one may find the item, and another thread may grab the mutex and consume the item between the signal and your wake-up (Mesa semantics). Re-checking the condition in a \`while\` loop handles all three.`,
      },
      {
        q: "Implement a bounded blocking queue.",
        freq: "very-common",
        a: `State: an array (ring buffer) of capacity N, head, tail and count, one mutex, and two condition variables \`notFull\` and \`notEmpty\`.

\`put(x)\`: lock; \`while (count == N) wait(notFull)\`; store at tail; advance tail; count++; \`signal(notEmpty)\`; unlock.

\`take()\`: lock; \`while (count == 0) wait(notEmpty)\`; read at head; advance head; count--; \`signal(notFull)\`; unlock; return.

Discuss: \`signal\` vs \`signalAll\` (with one condition per direction, signal is enough), a shutdown flag to wake blocked consumers, timeouts (\`offer\`/\`poll\`), and that Java's \`ArrayBlockingQueue\` and Go's buffered channels already do this.`,
      },
      {
        q: "Explain the dining philosophers problem and two solutions.",
        freq: "common",
        a: `Five philosophers share five forks, one between each pair, and need both neighbouring forks to eat. If each picks up the left fork first, they can all hold one fork and wait forever for the other: a **circular wait**, so deadlock.

Solutions: (1) **resource ordering**: number the forks and always pick up the lower number first, so a cycle is impossible; (2) a **waiter/arbitrator** or a semaphore allowing only 4 to try at once, so at least one can always get both forks; (3) **try-lock with back-off**: if the second fork is taken, put the first down and retry later (watch for livelock; add random back-off); (4) asymmetric: odd philosophers go left-first, even go right-first.`,
      },
      {
        q: "What is priority inversion and how is it solved?",
        freq: "common",
        a: `A high-priority task waits for a lock held by a low-priority task, while a medium-priority task preempts the low one, so the high task is effectively blocked by the medium one for an unbounded time. Mars Pathfinder suffered this in 1997 and kept resetting.

Fixes: **priority inheritance** (the lock holder temporarily runs at the highest priority of its waiters), **priority ceiling** (taking the lock raises the holder to a preset ceiling priority), or avoiding shared locks between priority levels.`,
      },
      {
        q: "How would you implement a read-write lock, and what's the starvation risk?",
        freq: "occasional",
        a: `State: \`readers\` (active count), \`writer\` (bool), \`waitingWriters\`, one mutex and two condition variables. \`readLock\`: wait while \`writer || waitingWriters > 0\` (writer preference), then readers++. \`readUnlock\`: readers--; if 0, signal a writer. \`writeLock\`: waitingWriters++; wait while \`writer || readers > 0\`; waitingWriters--; writer = true. \`writeUnlock\`: writer = false; broadcast.

Reader preference can starve writers when readers keep coming; writer preference can starve readers under constant writes. Fair (queue-ordered) locks avoid both at some throughput cost.`,
      },
    ],
    quiz: [
      {
        q: "What does `pthread_cond_wait(&cv, &m)` do?",
        options: ["Spins until the condition is true", "Atomically unlocks m and sleeps; re-locks m before returning", "Locks m twice", "Signals all waiting threads"],
        answer: 1,
        explain: "Releasing the mutex and sleeping as one step means a signal can't be lost in between.",
      },
      {
        q: "A semaphore starts at 3. Five threads call `sem_wait`. How many are blocked?",
        options: ["0", "2", "3", "5"],
        answer: 1,
        explain: "Three decrement it to 0 and pass; the other two sleep until someone posts.",
      },
      {
        q: "Why use `while (count == 0) wait(...)` instead of `if`?",
        options: ["It's faster", "Spurious wakeups and other threads may make the condition false again", "if doesn't compile", "It avoids deadlock"],
        answer: 1,
        explain: "When you wake up, re-check: the condition isn't guaranteed to hold.",
      },
      {
        q: "Which tool fits 'at most 10 concurrent downloads'?",
        options: ["A mutex", "A counting semaphore initialised to 10", "A spinlock", "A barrier of 10"],
        answer: 1,
        explain: "Each download takes a permit and returns it when done.",
      },
      {
        q: "In the readers-writers problem, who may be inside at the same time?",
        options: ["Only one reader", "Many readers, or exactly one writer", "Many writers", "One reader and one writer"],
        answer: 1,
        explain: "Readers don't conflict with each other; a writer needs exclusive access.",
      },
      {
        q: "Which change prevents the dining philosophers deadlock?",
        options: ["Make them eat faster", "Always pick up the lower-numbered fork first", "Add a sixth philosopher", "Use bigger forks"],
        answer: 1,
        explain: "A global order on resources makes a circular wait impossible.",
      },
      {
        q: "A low-priority task holds a lock that a high-priority task needs, and a medium task keeps running. What's the fix?",
        options: ["Priority inheritance", "Round-robin scheduling", "A bigger stack", "Spinlocks"],
        answer: 0,
        explain: "The holder temporarily inherits the waiter's high priority, so the medium task can't preempt it.",
      },
      {
        q: "What's the main practical difference between a mutex and a binary semaphore?",
        options: ["A mutex has an owner that must unlock it; a semaphore can be posted by anyone", "Semaphores are faster", "Mutexes count", "There is none"],
        answer: 0,
        explain: "Ownership allows priority inheritance and error checking; semaphores are good for signalling.",
      },
    ],
  },

  // ------------------------------------------------------------------ DEADLOCK
  {
    id: "os-deadlock",
    title: "Deadlock: prevention, avoidance and detection",
    tagline: "The four Coffman conditions, resource-allocation graphs, lock ordering, the Banker's algorithm, wait-for graphs, recovery, livelock and starvation.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["banker"],
    complexity: [
      { op: "Lock ordering (prevention)", time: "O(1) per lock", note: "The standard fix in practice; needs discipline across the codebase" },
      { op: "Banker's safety check", time: "O(n² × m)", note: "n processes, m resource types; needs every process's maximum in advance" },
      { op: "Wait-for graph cycle (detection)", time: "O(V + E)", note: "A DFS over threads and edges; databases run it on a timer" },
    ],
    concept: `## Explain it like I'm 10 🧸
Two cars meet on a **one-lane bridge** from opposite ends. Each needs the other to back up. Neither will. Both wait **forever**. That's a **deadlock**.

Or: Alice has the **crayons** and wants the **paper**. Bob has the **paper** and wants the **crayons**. Each says "I'll give you mine when I get yours". Nobody ever draws anything.

A deadlock is a group of threads where **everyone is waiting for something another one in the group holds**. Nobody can move, nobody will give up, and unless something from outside steps in, they wait forever.

## The four conditions (Coffman, 1971)
A deadlock can happen only if **all four** hold at the same time:
| # | Condition | In the crayon story |
|---|---|---|
| 1 | **Mutual exclusion**: a resource can be held by only one thread | Only one kid can hold the crayons |
| 2 | **Hold and wait**: a thread holds something while waiting for more | Alice keeps the crayons while asking for paper |
| 3 | **No preemption**: you can't take a resource away by force | Nobody snatches the paper from Bob |
| 4 | **Circular wait**: a cycle of threads, each waiting for the next | Alice waits for Bob, Bob waits for Alice |

**Break any one of the four and deadlock is impossible.** That's the whole strategy behind prevention.

## Resource-allocation graphs
Draw threads as circles and resources as squares. An arrow from a resource to a thread means "held by"; an arrow from a thread to a resource means "waiting for". If every resource has one instance, **a cycle means deadlock**. With several instances per resource, a cycle means deadlock is *possible* but not certain.

Simplify it to a **wait-for graph** (thread → thread: "T1 waits for a lock T2 holds"), and deadlock detection is just **cycle detection** with depth-first search, which you know from the graph worlds.

## Four ways to deal with deadlock
### 1. Prevention: break a condition
| Break... | How | Catch |
|---|---|---|
| Mutual exclusion | Make resources shareable (read-only data, lock-free structures) | Most resources can't be shared |
| Hold and wait | Request **everything at once**, or release everything before asking for more | Low utilisation; you must know your needs up front |
| No preemption | If you can't get the next lock, **release what you hold** and retry (\`pthread_mutex_trylock\`, \`tryLock(timeout)\`) | Can cause **livelock** without random back-off |
| Circular wait | **Lock ordering**: number every lock and always acquire in increasing order | Everyone must follow the order |

**Lock ordering is the fix you'll actually use.** For a bank transfer between two accounts, always lock the account with the **smaller ID first**, whatever the direction of the transfer. Our C sample deadlocks with opposite orders and works with the same order.

### 2. Avoidance: the Banker's algorithm
Dijkstra's **Banker's algorithm** is like a careful bank: each customer declares a **maximum** credit line up front. A loan is granted only if, afterwards, the bank could still let **every** customer finish in some order. That's a **safe state**.

The **safety check**:
1. \`work = available\`, and mark everyone unfinished.
2. Find an unfinished process whose \`need = max − allocation\` fits in \`work\`. Pretend it runs to completion and **returns** everything it holds: \`work += allocation\`.
3. Repeat. If everyone finishes, the state is **safe** and that order is a **safe sequence**. If you get stuck, it's **unsafe**.

To handle a **request**: if it exceeds the process's declared need, it's an error; if it exceeds what's available, wait; otherwise **pretend** to grant it and run the safety check. Safe: grant it. Unsafe: roll back and make the process wait.

Unsafe doesn't mean deadlocked; it means deadlock **could** happen. The Banker's algorithm is a textbook favourite but rarely used in real kernels: processes don't know their maximum needs, and the check is too slow to run on every lock.

### 3. Detection and recovery
Let deadlocks happen, **detect** them (cycle in the wait-for graph), then **recover**:
- **Kill** (abort) one thread or process in the cycle: the **victim**, chosen by cost (least work done, fewest locks held, lowest priority).
- **Roll back** to a checkpoint.
- **Preempt** a resource and give it to someone else.

This is exactly what **databases** do. PostgreSQL waits \`deadlock_timeout\` (1 s by default), then checks the wait-for graph and aborts one transaction with "deadlock detected". MySQL InnoDB detects it immediately. Your application must catch the error and **retry** the transaction.

### 4. Ignore it (the ostrich algorithm)
Most operating systems, including Linux and Windows, **don't** prevent or detect deadlocks between user programs' locks. They're rare, and the cure costs more than the disease. If your program deadlocks, it hangs, and you debug it. In the kernel, Linux uses **lockdep**, a checker that records lock orders seen at run time and warns about possible cycles before they ever deadlock.

## Livelock and starvation
- **Livelock**: threads keep **changing state** but make no progress. Two polite people in a corridor both step left, then both step right, forever. Try-lock-and-retry without **random back-off** can livelock.
- **Starvation**: a thread **never gets** a resource because others keep winning (a low-priority process under strict priority scheduling, a writer behind endless readers). Fix with **aging** or fair queues.

| | Threads blocked? | Progress? |
|---|---|---|
| Deadlock | Yes, all waiting | None |
| Livelock | No, busy running | None |
| Starvation | One unlucky thread waits | Others progress |

## Debugging a real deadlock
1. The program hangs with **0% CPU** (with 100% CPU, suspect a livelock or infinite loop instead).
2. Get **every thread's stack**: \`gdb -p PID\` then \`thread apply all bt\`; for Java, \`jstack PID\` (it even prints "Found one Java-level deadlock"); for Go, send SIGQUIT; for Python, \`py-spy dump\`.
3. Look for threads stuck in \`lock\`/\`futex_wait\`, and work out which lock each holds and wants. Draw the cycle.
4. Fix it with lock ordering, by shrinking critical sections (never call unknown code or do I/O while holding a lock), or with timeouts.`,
    keyPoints: [
      "Deadlock needs all four Coffman conditions: mutual exclusion, hold and wait, no preemption, circular wait",
      "Prevention breaks one condition; lock ordering (break circular wait) is the practical fix",
      "Avoidance (Banker's algorithm) only grants requests that leave the system in a safe state",
      "Detection finds a cycle in the wait-for graph; recovery aborts a victim or rolls back (databases do this)",
      "Most OSes ignore user-level deadlocks (the ostrich algorithm); Linux's lockdep checks kernel lock order",
      "Livelock: busy but no progress; starvation: one thread never gets its turn",
    ],
    code: [
      {
        title: "A real deadlock, and the lock-ordering fix",
        linux: true,
        variants: [{ lang: "c", code: `// Two bank transfers lock two accounts in opposite orders: a deadlock. Then the fix: one global order.
// Linux-only (pthread_mutex_timedlock, pthread_barrier_t).
#include <errno.h>
#include <pthread.h>
#include <stdio.h>
#include <time.h>

static pthread_mutex_t alice = PTHREAD_MUTEX_INITIALIZER, bob = PTHREAD_MUTEX_INITIALIZER;
static pthread_barrier_t both_hold_one, both_gave_up;
static int ordered, gave_up[2], done[2];

static void *transfer(void *arg) {
    int id = *(int *)arg;                       // 0: alice -> bob, 1: bob -> alice
    pthread_mutex_t *first = id == 0 ? &alice : &bob;
    pthread_mutex_t *second = id == 0 ? &bob : &alice;
    if (ordered) { first = &alice; second = &bob; }   // the fix: everyone locks alice before bob
    pthread_mutex_lock(first);
    if (!ordered) pthread_barrier_wait(&both_hold_one);   // demo trick: the unlucky timing, every time
    struct timespec t;
    clock_gettime(CLOCK_REALTIME, &t);
    t.tv_sec += 1;
    if (pthread_mutex_timedlock(second, &t) == ETIMEDOUT) {   // waited 1 s: we're stuck
        gave_up[id] = 1;
        if (!ordered) pthread_barrier_wait(&both_gave_up);
        pthread_mutex_unlock(first);
        return NULL;
    }
    done[id] = 1;                               // move the money
    pthread_mutex_unlock(second);
    pthread_mutex_unlock(first);
    return NULL;
}

static void run(const char *label) {
    pthread_t t[2];
    int ids[2] = {0, 1};
    gave_up[0] = gave_up[1] = done[0] = done[1] = 0;
    pthread_barrier_init(&both_hold_one, NULL, 2);
    pthread_barrier_init(&both_gave_up, NULL, 2);
    for (int i = 0; i < 2; i++) pthread_create(&t[i], NULL, transfer, &ids[i]);
    for (int i = 0; i < 2; i++) pthread_join(t[i], NULL);
    printf("%-22s transfers done: %d, stuck: %d\\n", label, done[0] + done[1], gave_up[0] + gave_up[1]);
    pthread_barrier_destroy(&both_hold_one);
    pthread_barrier_destroy(&both_gave_up);
}

int main(void) {
    run("opposite lock order:");
    ordered = 1;
    run("same lock order:");
    return 0;
}` }],
        explain: `- Transfer 0 locks alice then bob; transfer 1 locks bob then alice. The barrier makes each hold its first lock before reaching for the second, so they wait for each other: all four Coffman conditions hold.
- \`pthread_mutex_timedlock\` waits at most 1 second, so the program can **notice** the deadlock instead of hanging forever. Both transfers give up.
- With \`ordered = 1\`, both transfers lock **alice first, then bob**, whatever the direction. A cycle is impossible: whoever gets alice first also gets bob, finishes, and lets the other through.
- In real code you'd order by account ID: \`first = a->id < b->id ? a : b\`.`,
        output: `opposite lock order:   transfers done: 0, stuck: 2
same lock order:       transfers done: 2, stuck: 0`,
      },
      {
        title: "The Banker's algorithm (Python)",
        variants: [{ lang: "python", code: `# The Banker's algorithm: only grant a request if the system stays in a SAFE state.
R = 3                                            # resource types A, B, C
available = [3, 3, 2]
maximum = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]]
allocation = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]]


def need(p):
    return [maximum[p][r] - allocation[p][r] for r in range(R)]


def safe_sequence(avail, alloc):
    """Pretend to run processes one by one; return an order where everyone can finish, or None."""
    work, finished, order = list(avail), [False] * len(alloc), []
    progress = True
    while progress:
        progress = False
        for p in range(len(alloc)):
            n = [maximum[p][r] - alloc[p][r] for r in range(R)]
            if not finished[p] and all(n[r] <= work[r] for r in range(R)):
                work = [work[r] + alloc[p][r] for r in range(R)]   # p finishes and returns everything
                finished[p], progress = True, True
                order.append(f"P{p}")
    return order if all(finished) else None


def request(p, req):
    global available, allocation
    if any(req[r] > need(p)[r] for r in range(R)):
        return "error: asked for more than its declared maximum"
    if any(req[r] > available[r] for r in range(R)):
        return "must WAIT: not enough free right now"
    new_avail = [available[r] - req[r] for r in range(R)]
    new_alloc = [row[:] for row in allocation]
    new_alloc[p] = [new_alloc[p][r] + req[r] for r in range(R)]
    seq = safe_sequence(new_avail, new_alloc)
    if seq is None:
        return "DENIED: granting it would make the state unsafe"
    available, allocation = new_avail, new_alloc
    return "granted, still safe: " + " -> ".join(seq)


print("needs:", [need(p) for p in range(5)])
print("is the start safe?", " -> ".join(safe_sequence(available, allocation)))
print("P1 asks for (1, 0, 2):", request(1, [1, 0, 2]))
print("P4 asks for (3, 3, 0):", request(4, [3, 3, 0]))
print("P0 asks for (0, 2, 0):", request(0, [0, 2, 0]))
print("available now:", available)` }],
        explain: `- The classic textbook state: 5 processes, 3 resource types, and \`available = [3, 3, 2]\`. \`need = max − allocation\` is how much more each might still ask for.
- \`safe_sequence\` pretends to run processes one by one. P1 needs (1,2,2), which fits in (3,3,2), so it finishes and returns its allocation, and so on. Everyone finishes: the state is safe.
- **P1 asks for (1,0,2)**: it fits, and after granting it a safe order still exists, so it's granted. Available drops to (2,3,0).
- **P4 asks for (3,3,0)**: more A than is free right now, so it simply waits.
- **P0 asks for (0,2,0)**: it fits, but afterwards no process's need fits in (2,1,0). That's unsafe, so it's denied even though nothing is deadlocked yet.`,
        output: `needs: [[7, 4, 3], [1, 2, 2], [6, 0, 0], [0, 1, 1], [4, 3, 1]]
is the start safe? P1 -> P3 -> P4 -> P0 -> P2
P1 asks for (1, 0, 2): granted, still safe: P1 -> P3 -> P4 -> P0 -> P2
P4 asks for (3, 3, 0): must WAIT: not enough free right now
P0 asks for (0, 2, 0): DENIED: granting it would make the state unsafe
available now: [2, 3, 0]`,
      },
      {
        title: "Detecting deadlock: a cycle in the wait-for graph (Python)",
        variants: [{ lang: "python", code: `# Deadlock DETECTION: draw who-waits-for-whom, then look for a cycle with depth-first search.
def find_cycle(waits_for):
    WHITE, GREY, BLACK = 0, 1, 2                 # unvisited / on the current path / fully explored
    color = {t: WHITE for t in waits_for}
    path = []

    def dfs(t):
        color[t] = GREY
        path.append(t)
        for u in waits_for.get(t, []):
            if color.get(u, WHITE) == GREY:      # back to someone on our path: a cycle!
                return path[path.index(u):] + [u]
            if color.get(u, WHITE) == WHITE:
                found = dfs(u)
                if found:
                    return found
        path.pop()
        color[t] = BLACK
        return None

    for t in waits_for:
        if color[t] == WHITE:
            found = dfs(t)
            if found:
                return found
    return None


graph = {"T1": ["T2"], "T2": ["T3"], "T3": ["T1"], "T4": ["T1"], "T5": []}
cycle = find_cycle(graph)
print("deadlock cycle:", " -> ".join(cycle))
victim = "T3"                                     # recovery: abort one thread in the cycle
graph = {t: [u for u in us if u != victim] for t, us in graph.items() if t != victim}
print(f"after aborting {victim}:", find_cycle(graph) or "no cycle, everyone can make progress")` }],
        explain: `- Each key waits for the threads in its list: T1 waits for T2, T2 for T3, T3 for T1. T4 is waiting for T1, but it isn't part of the cycle: it's a victim of the deadlock, not a cause.
- DFS with three colours: **grey** means "on the current path". Reaching a grey node again means we went round a loop, which is a cycle and so a deadlock.
- **Recovery**: abort one thread in the cycle (here T3). Its locks are released, the cycle is gone, and T1, T2 and T4 can continue. Databases do exactly this and return a "deadlock detected" error to the aborted transaction.`,
        output: `deadlock cycle: T1 -> T2 -> T3 -> T1
after aborting T3: no cycle, everyone can make progress`,
      },
    ],
    interview: [
      {
        q: "What are the four necessary conditions for deadlock?",
        freq: "very-common",
        a: `**Mutual exclusion** (resources can't be shared), **hold and wait** (holding some while waiting for others), **no preemption** (resources can't be forcibly taken), and **circular wait** (a cycle of threads each waiting for the next). All four must hold; removing any one prevents deadlock.`,
      },
      {
        q: "How do you prevent deadlocks in practice?",
        freq: "very-common",
        a: `Mainly **lock ordering**: define a global order (by address, ID or hierarchy level) and always acquire in that order, which breaks circular wait. Also: hold as few locks as possible and for as short a time as possible; never call unknown code, callbacks or I/O while holding a lock; use \`tryLock\` with timeouts and back-off where ordering is impossible; prefer higher-level tools (concurrent collections, message passing, a single owner thread). Detect regressions with tools like Linux's lockdep, ThreadSanitizer's deadlock detector, or \`jstack\`.`,
      },
      {
        q: "Two threads transfer money between accounts A and B in opposite directions. How do you avoid deadlock?",
        freq: "very-common",
        a: `Each transfer must lock both accounts. If transfer(A→B) locks A then B and transfer(B→A) locks B then A, they can deadlock. Fix: always lock the account with the **smaller ID first**, regardless of transfer direction (and handle A == B). Alternatives: a single global lock (simple but serialises everything), \`tryLock\` with back-off, or doing the transfer in a database transaction and letting the database detect deadlocks and retry.`,
      },
      {
        q: "Explain the Banker's algorithm.",
        freq: "common",
        a: `A deadlock-avoidance algorithm. Each process declares its maximum need. The system tracks \`available\`, \`allocation\` and \`need = max − allocation\`. On a request, it pretends to grant it and runs the **safety algorithm**: starting with \`work = available\`, repeatedly find a process whose need ≤ work, assume it finishes and adds its allocation to work. If all can finish, the state is safe and the request is granted; otherwise the request waits. Cost is O(n²·m). Rarely used in general-purpose OSes because maximum needs are unknown and the check is expensive.`,
      },
      {
        q: "What's the difference between deadlock, livelock and starvation?",
        freq: "common",
        a: `**Deadlock**: threads are blocked forever waiting on each other; no CPU used, no progress. **Livelock**: threads are active and keep reacting to each other (for example, repeatedly backing off and retrying in lockstep) but none progresses. **Starvation**: some threads progress, but one is perpetually denied a resource (unfair locks, strict priorities). Fixes: lock ordering for deadlock, randomised back-off for livelock, fairness or aging for starvation.`,
      },
      {
        q: "Your service hangs in production. How do you check whether it's a deadlock?",
        freq: "common",
        a: `Check CPU: a deadlock usually shows near 0% CPU with requests piling up. Dump all thread stacks (\`jstack\`, \`gdb thread apply all bt\`, \`py-spy dump\`, Go's SIGQUIT or \`/debug/pprof/goroutine?debug=2\`). Look for threads blocked acquiring locks and map which lock each holds and waits for; a cycle confirms it. Java's thread dump detects monitor deadlocks automatically. Then fix the lock order, add timeouts, and add a regression test or lockdep-style checking. Restarting buys time but doesn't fix it.`,
      },
      {
        q: "How do databases handle deadlocks?",
        freq: "occasional",
        a: `They use **detection and recovery**. Transactions take row locks as they go, so two transactions updating the same rows in opposite orders can deadlock. The database builds a wait-for graph (PostgreSQL after \`deadlock_timeout\`, InnoDB immediately), finds the cycle, and aborts a victim transaction with an error (PostgreSQL: SQLSTATE 40P01). Applications must retry. To reduce deadlocks, update rows in a consistent order and keep transactions short.`,
      },
    ],
    quiz: [
      {
        q: "Which is NOT one of the four Coffman conditions?",
        options: ["Mutual exclusion", "Hold and wait", "Preemption", "Circular wait"],
        answer: 2,
        explain: "The condition is NO preemption; allowing preemption breaks it.",
      },
      {
        q: "Lock ordering prevents deadlock by breaking which condition?",
        options: ["Mutual exclusion", "Hold and wait", "No preemption", "Circular wait"],
        answer: 3,
        explain: "If everyone acquires in the same order, a cycle of waiting can't form.",
      },
      {
        q: "A wait-for graph has the edges T1 → T2, T2 → T3, T3 → T1 and T4 → T2. Which threads are in the deadlock cycle?",
        options: ["T1, T2, T3", "All four", "T4 only", "None"],
        answer: 0,
        explain: "T4 is blocked behind the cycle but isn't part of it.",
      },
      {
        q: "What does it mean for a state to be safe in the Banker's algorithm?",
        options: ["No process holds anything", "There is some order in which every process can finish", "All resources are free", "No requests are pending"],
        answer: 1,
        explain: "A safe sequence exists; unsafe means deadlock could happen, not that it has.",
      },
      {
        q: "Two threads keep releasing and retrying the same locks in lockstep and never progress, using lots of CPU. This is:",
        options: ["Deadlock", "Livelock", "A race condition", "Thrashing"],
        answer: 1,
        explain: "They're busy but stuck; random back-off breaks the symmetry.",
      },
      {
        q: "What does Linux do about deadlocks between locks in user programs?",
        options: ["Runs the Banker's algorithm", "Nothing: it ignores them (the ostrich approach)", "Kills a random process every second", "Prevents all circular waits"],
        answer: 1,
        explain: "General-purpose OSes leave user-level deadlocks to the program; the kernel uses lockdep for its own locks.",
      },
      {
        q: "PostgreSQL detects a deadlock between two transactions. What happens?",
        options: ["Both hang forever", "One transaction is aborted with an error and should be retried", "The database restarts", "Both commit"],
        answer: 1,
        explain: "Detection and recovery: a victim is rolled back so the other can proceed.",
      },
      {
        q: "Requesting all locks at once before starting breaks which condition?",
        options: ["Hold and wait", "Circular wait", "Mutual exclusion", "No preemption"],
        answer: 0,
        explain: "You never hold some while waiting for others.",
      },
    ],
  },
];
