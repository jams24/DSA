import type { Lesson } from "../types";

// Operating Systems, part 2: processes and threads.

export const osPart2: Lesson[] = [
  // ------------------------------------------------------------------ PROCESSES
  {
    id: "os-processes",
    part: "Part 2 · Processes & threads",
    title: "Processes: programs in motion",
    tagline: "Program vs process, the PCB, process states, fork, exec and wait, exit codes, zombies, orphans, copy-on-write and the process tree.",
    difficulty: "beginner",
    minutes: 35,
    visualizers: ["procstate"],
    concept: `## Explain it like I'm 10 🧸
A **program** is like a **recipe in a cookbook**: just instructions sitting on a shelf (a file on disk). A **process** is **somebody actually cooking that recipe right now**: they have a counter with ingredients (memory), they know which step they're on (the program counter), and they're using pots and pans (open files).

Two people can cook the **same recipe** at the same time in two kitchens: two processes, one program. Open two browser windows and you may have two processes running the same browser program.

The OS keeps a **card for every cook**: who they are, which step they're on, what they're using, how important they are. That card is the **process control block**.

## Program vs process
| Program | Process |
|---|---|
| A file on disk (\`/usr/bin/python3\`) | A running instance of a program |
| Passive: just bytes | Active: has a CPU state, memory and open resources |
| One copy | Many processes can run the same program |

A process owns:
- an **address space** with **code (text)**, **data** (globals), the **heap** (\`malloc\`) and the **stack**,
- **CPU state**: the program counter, stack pointer and other registers,
- **open files and sockets** (its file-descriptor table),
- **identity**: PID, parent PID, user and group IDs, current directory, environment variables, signal handlers.

## The process control block (PCB)
The kernel keeps one record per process (Linux calls it \`task_struct\`; it's several kilobytes):
- **PID**, parent, children, process group and session
- **State** (running, ready, waiting ...) and **scheduling info**: priority, nice value, CPU time used
- **Saved registers**, so the process can resume exactly where it stopped
- A **memory map**: its page tables
- The **open-file table**, current directory, credentials, signal handlers
- **Accounting**: CPU time, memory and I/O statistics

## Process states
The textbook five-state model (try it in the visualizer):
| State | Meaning |
|---|---|
| **New** | Being created |
| **Ready** | Could run right now, waiting for a CPU, in the **ready queue** |
| **Running** | Executing on a CPU. With 8 cores, at most 8 processes run at once |
| **Waiting / blocked** | Can't continue until something happens: disk read, keypress, network packet, a lock, a timer |
| **Terminated** | Finished; waiting for its parent to collect the exit status |

The transitions that matter in interviews:
- **Ready → running**: the scheduler *dispatches* it.
- **Running → ready**: *preempted*. The timer fired, or a more important process woke up.
- **Running → waiting**: it made a call that must wait (\`read\` from disk, \`sleep\`, \`accept\`).
- **Waiting → ready**: the event happened (an interrupt says the disk finished).

There's **no "waiting → running"**: a woken process goes back in the queue first.

On Linux, \`ps\` shows the state letter:
- **R**: running or runnable
- **S**: interruptible sleep
- **D**: uninterruptible sleep, usually disk I/O
- **T**: stopped
- **Z**: zombie

## Creating processes: fork, exec, wait
Unix splits "start a new program" into two steps, which is unusual but powerful:
1. **\`fork()\`** makes a **copy** of the calling process. It returns **twice**: \`0\` in the child, and the child's PID in the parent.
2. **\`execve(path, argv, envp)\`** **replaces** the current program with a new one. Same PID, same open files, brand-new code, data and stack. If it succeeds it **never returns**.
3. **\`wait()\` / \`waitpid()\`** lets the parent sleep until a child ends and collect its **exit status**.
4. **\`exit(code)\`** ends the process. By convention 0 means success, 1–125 are the program's own errors, 126 is "found but not executable", 127 is "not found", and 128+N means "killed by signal N" (137 = SIGKILL, 143 = SIGTERM, 130 = Ctrl-C).

Why two steps? **Between fork and exec**, the child can rearrange its own environment before becoming the new program: redirect stdout to a file, connect a pipe, change directory, drop privileges, reset signal handlers. That's exactly how shells implement \`>\`, \`|\` and \`cd\` (you'll build one in the shell project). Windows does it in one call instead (\`CreateProcess\` with many parameters); \`posix_spawn\` is the one-call POSIX alternative.

## Copy-on-write: why fork is cheap
Copying a 2 GiB process byte by byte would be slow. Instead, fork gives the child **the same physical pages, marked read-only** in both processes. Only when either one **writes** to a page does the kernel copy **that one page** (copy-on-write, COW). Most children call \`exec\` right away and never copy anything. That's how the child in the first sample can change \`apples\` without affecting the parent.

## Zombies and orphans
- **Zombie**: a child that has **exited** but whose parent hasn't called \`wait\` yet. Its memory is freed, but its process-table entry (PID and exit status) remains so the parent can read it. One zombie is harmless; thousands can exhaust PIDs. Fix the parent so it reaps (handle \`SIGCHLD\`, call \`waitpid\`); killing the zombie itself does nothing, since it's already dead.
- **Orphan**: a process whose **parent died first**. It's adopted by **PID 1** (or a "subreaper" such as systemd's user manager), which reaps it when it exits.

## The process tree
Every process has a parent, all the way back to **PID 1**. Try \`pstree\` or \`ps -ef --forest\`:
\`\`\`text
systemd─┬─sshd───sshd───bash───python3
        ├─nginx───4*[nginx]
        └─postgres───6*[postgres]
\`\`\`
Process **groups** and **sessions** let the terminal send Ctrl-C to a whole pipeline at once (the foreground process group), which is the basis of shell **job control** (\`fg\`, \`bg\`, \`jobs\`).`,
    keyPoints: [
      "A program is a file; a process is a running instance with its own address space, registers and open files",
      "The kernel tracks each process in a PCB (task_struct on Linux)",
      "States: new, ready, running, waiting, terminated; waiting goes back to ready, never straight to running",
      "fork() clones (returns 0 in the child), exec() replaces the program, wait() collects the exit status",
      "Copy-on-write makes fork cheap: pages are only copied when written",
      "Zombie = exited but not reaped; orphan = parent died, adopted by PID 1",
    ],
    code: [
      {
        title: "fork(): one process becomes two",
        linux: true,
        variants: [{ lang: "c", code: `// fork() makes a copy of the running process. It returns TWICE: 0 in the child, the child's PID in the parent.
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    int apples = 10;
    pid_t me = getpid();
    printf("before fork: I am one process with %d apples\\n", apples);
    fflush(stdout);                       // otherwise the child inherits a copy of this unflushed text

    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 1;
    }
    if (pid == 0) {                       // ---- the child ----
        apples = 99;                      // changes the CHILD's copy only
        printf("child:  fork() returned 0, my parent is the process that forked: %s, I now have %d apples\\n",
               getppid() == me ? "yes" : "no", apples);
        return 7;                         // exit code for the parent to collect
    }
    int status;                           // ---- the parent ----
    waitpid(pid, &status, 0);             // wait for the child to finish
    printf("parent: fork() returned the child's PID (%s), I still have %d apples\\n",
           pid > 0 ? "a positive number" : "?", apples);
    printf("parent: child exited with code %d\\n", WEXITSTATUS(status));
    return 0;
}` }],
        explain: `- After \`fork()\` there are **two processes running the same code**. The only difference is the return value: \`0\` in the child, the child's PID (a positive number) in the parent, or -1 if it failed.
- The child set \`apples = 99\`, but the parent still has 10: each process has **its own copy** of memory. Copy-on-write means no copying actually happened until the child wrote to that page.
- \`waitpid(pid, &status, 0)\` makes the parent sleep until the child exits. \`WEXITSTATUS\` extracts the code the child returned (7).
- Without the wait, the two processes could print in either order. Never assume who runs first after a fork.
- \`fflush(stdout)\` before forking is important: otherwise unflushed \`printf\` text is copied into the child and printed twice.`,
        output: `before fork: I am one process with 10 apples
child:  fork() returned 0, my parent is the process that forked: yes, I now have 99 apples
parent: fork() returned the child's PID (a positive number), I still have 10 apples
parent: child exited with code 7`,
      },
      {
        title: "fork + exec + wait: how a shell runs a command",
        linux: true,
        variants: [{ lang: "c", code: `// How a shell runs a command: fork a child, the child execs the program, the parent waits.
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

static int run(char *const argv[]) {
    fflush(stdout);
    pid_t pid = fork();
    if (pid == 0) {
        execvp(argv[0], argv);            // replaces this process's program; only returns on failure
        fprintf(stderr, "%s: command not found\\n", argv[0]);
        _exit(127);                       // shells use 127 for "not found"
    }
    int status;
    waitpid(pid, &status, 0);
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    return 128 + WTERMSIG(status);        // killed by a signal: shells report 128 + signal number
}

int main(void) {
    char *echo[] = {"echo", "hello from a brand-new program", NULL};
    char *ls[] = {"ls", "/no/such/dir", NULL};
    char *nope[] = {"no-such-program", NULL};
    char *sh[] = {"sh", "-c", "kill -9 $$", NULL};   // a program that kills itself with SIGKILL (9)

    printf("exit status %d\\n", run(echo));
    printf("ls failed with status %d\\n", run(ls));
    printf("missing program: status %d\\n", run(nope));
    printf("killed by SIGKILL: status %d\\n", run(sh));
    return 0;
}` }],
        explain: `- \`execvp\` searches \`$PATH\` for the program and **replaces** the child's code with it. The line after \`execvp\` only runs if it failed, so it reports the error and uses exit code **127**, exactly like bash.
- Exit codes as a shell shows them in \`$?\`: \`0\` success, \`2\` (ls's own "trouble" code), \`127\` command not found, \`137 = 128 + 9\`, killed by SIGKILL.
- \`WIFEXITED\` / \`WIFSIGNALED\` tell you **how** the child ended: by calling exit, or by a signal.
- The error messages went to **stderr**, which isn't part of the pinned output (the shell would show them in your terminal).`,
        output: `hello from a brand-new program
exit status 0
ls failed with status 2
missing program: status 127
killed by SIGKILL: status 137`,
      },
      {
        title: "Catching a zombie in the act",
        linux: true,
        variants: [{ lang: "c", code: `// A child that has exited but hasn't been waited for is a ZOMBIE: dead, but still in the process table.
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static char state_of(pid_t pid) {                 // read the state letter from /proc/<pid>/stat (Linux)
    char path[64], buf[512];
    snprintf(path, sizeof path, "/proc/%d/stat", pid);
    FILE *f = fopen(path, "r");
    if (!f) return '-';                           // no such process any more
    size_t n = fread(buf, 1, sizeof buf - 1, f);
    fclose(f);
    buf[n] = '\\0';
    char *close_paren = strrchr(buf, ')');        // format: "pid (name) STATE ..."
    return close_paren ? close_paren[2] : '?';
}

int main(void) {
    pid_t pid = fork();
    if (pid == 0) {
        usleep(200 * 1000);                       // child: do 0.2 s of "work" (sleeping)...
        _exit(0);                                 // ...and finish
    }
    usleep(50 * 1000);
    printf("child while working: %c (S = sleeping)\\n", state_of(pid));
    usleep(400 * 1000);                           // the child has exited by now, but nobody has waited
    printf("child after exiting: %c (Z = zombie: dead but not reaped)\\n", state_of(pid));
    waitpid(pid, NULL, 0);                        // reap it: collect the exit status
    printf("child after waitpid: %c (gone: its process-table entry is freed)\\n", state_of(pid));
    return 0;
}` }],
        explain: `- \`/proc/<pid>/stat\` is the kernel's live view of a process. The letter after the name is the **state**.
- While the child naps it's **S** (sleeping). After it exits, it's **Z**: its memory is gone, but its entry stays until the parent reads the exit status.
- \`waitpid\` **reaps** it and the entry disappears.
- In real servers, zombies pile up when a parent forks workers but never waits. Handle \`SIGCHLD\` and call \`waitpid(-1, &st, WNOHANG)\` in a loop, or set \`SIGCHLD\` to \`SIG_IGN\` if you don't care about exit codes.`,
        output: `child while working: S (S = sleeping)
child after exiting: Z (Z = zombie: dead but not reaped)
child after waitpid: - (gone: its process-table entry is freed)`,
      },
      {
        title: "The same API in Python",
        linux: true,
        variants: [{ lang: "python", code: `# The same process API from Python: os.fork, os.execvp, os.waitpid.
import os
import sys

r, w = os.pipe()                       # a pipe so the child can send its answer back
pid = os.fork()
if pid == 0:                           # child
    os.close(r)
    os.write(w, f"child computed {sum(range(1, 101))}".encode())
    os._exit(0)                        # _exit: don't run the parent's cleanup code twice

os.close(w)
_, status = os.waitpid(pid, 0)
print("parent received:", os.read(r, 100).decode())
print("child exit code:", os.waitstatus_to_exitcode(status))

sys.stdout.flush()
pid = os.fork()
if pid == 0:
    os.execvp("python3", ["python3", "-c", "print('exec replaced the child with a new python3')"])
os.waitpid(pid, 0)
print("parent is still the original program")` }],
        explain: `- \`os.fork\`, \`os.execvp\` and \`os.waitpid\` are the same system calls. The child sends its result back through a **pipe** (more in the IPC level), because after fork the two processes no longer share variables.
- \`os._exit\` ends the child immediately without running \`atexit\` handlers or flushing the parent's buffered output a second time.
- \`os.waitstatus_to_exitcode\` decodes the status (negative if killed by a signal).
- In everyday Python use \`subprocess.run([...])\`, which does fork/exec/wait (via \`posix_spawn\` where possible), and \`multiprocessing\` for parallel work.`,
        output: `parent received: child computed 5050
child exit code: 0
exec replaced the child with a new python3
parent is still the original program`,
      },
    ],
    interview: [
      {
        q: "What is the difference between a program and a process?",
        freq: "very-common",
        a: `A **program** is passive: an executable file on disk. A **process** is an executing instance of a program, with its own address space (code, data, heap, stack), CPU context (registers, PC), open file descriptors, PID and credentials, tracked by the kernel in a PCB. One program can be running as many processes at once.`,
      },
      {
        q: "What does fork() return, and what does the child inherit?",
        freq: "very-common",
        a: `It returns **0 in the child**, the **child's PID in the parent**, and **-1** on failure (no child created).

**The child inherits** a copy of the address space (shared copy-on-write), open file descriptors (sharing the same file offsets), the current directory, environment, signal handlers and masks, resource limits, and user and group IDs.

**It doesn't inherit** its PID and PPID, pending signals, file locks (\`fcntl\` locks), timers, or **other threads**: only the thread that called fork exists in the child, which is why forking a multithreaded program is dangerous (a lock held by another thread stays locked forever).`,
      },
      {
        q: "Why does Unix separate fork() and exec()?",
        freq: "common",
        a: `Between the two calls the child can change its own environment with ordinary system calls before running the new program: redirect file descriptors (\`dup2\` for \`>\` and \`|\`), \`chdir\`, set limits, drop privileges, change signal dispositions. That keeps \`exec\` simple and makes the shell's features easy to build. The downsides are the cost of fork for huge processes (mitigated by copy-on-write and \`vfork\`/\`posix_spawn\`) and fork's awkward interaction with threads.`,
      },
      {
        q: "What is a zombie process? An orphan? How do you get rid of zombies?",
        freq: "very-common",
        a: `A **zombie** has exited but its parent hasn't called \`wait\`, so its PCB entry (PID and exit status) lingers. An **orphan** is still running but its parent has died. It's re-parented to PID 1 (or a subreaper), which reaps it later.

**Fixing zombies**: make the parent reap (a \`SIGCHLD\` handler with \`waitpid(-1, ..., WNOHANG)\` in a loop, or ignore \`SIGCHLD\`). If the parent can't be fixed, killing the **parent** turns the zombies into orphans that init reaps. \`kill -9\` on a zombie does nothing; it's already dead.`,
      },
      {
        q: "Describe the process states and the transitions between them.",
        freq: "very-common",
        a: `**New → Ready** (admitted), **Ready → Running** (dispatched by the scheduler), **Running → Ready** (preempted by the timer or a higher-priority task), **Running → Waiting** (blocks on I/O, a lock or a sleep), **Waiting → Ready** (the event completes, often via an interrupt), **Running → Terminated** (exit or killed). A waiting process can't go straight to running; it re-enters the ready queue. Linux adds stopped (T), uninterruptible sleep (D) and zombie (Z).`,
      },
      {
        q: "What is copy-on-write and why does it matter for fork()?",
        freq: "common",
        a: `After fork, parent and child **share the same physical pages, marked read-only**. On the first write to a page by either process, a **page fault** occurs and the kernel copies just that page for the writer. Fork therefore costs only copying page tables, not memory, and fork followed by exec copies almost nothing. COW is also used for \`mmap(MAP_PRIVATE)\` files, the zero page, and snapshot tricks such as Redis's \`BGSAVE\`, which forks so the child writes a consistent snapshot while the parent keeps serving.`,
      },
      {
        q: "What's in a process control block?",
        freq: "common",
        a: `Identity (PID, PPID, UID/GID), state, saved CPU context (PC, SP, general registers, flags), scheduling information (priority, policy, accounting), memory-management information (page-table pointer, memory regions), open file table, current directory, signal handlers and pending signals, and resource usage and limits. On Linux it's \`struct task_struct\`.`,
      },
    ],
    quiz: [
      {
        q: "What does fork() return in the child process?",
        options: ["The parent's PID", "The child's own PID", "0", "-1"],
        answer: 2,
        explain: "0 in the child, the child's PID in the parent, -1 on error.",
      },
      {
        q: "After execvp() succeeds, what happens to the code after the call?",
        options: ["It runs after the new program finishes", "It never runs: the process now runs the new program", "It runs in a new thread", "It runs in the parent"],
        answer: 1,
        explain: "exec replaces the program image; it only returns on failure.",
      },
      {
        q: "A process is blocked waiting for a disk read. When the read completes, which state does it move to?",
        options: ["Running", "Ready", "Terminated", "New"],
        answer: 1,
        explain: "The event makes it ready; the scheduler later dispatches it.",
      },
      {
        q: "What is a zombie process?",
        options: ["A process using 100% CPU", "A process whose parent died", "A process that exited but hasn't been waited for", "A process in uninterruptible sleep"],
        answer: 2,
        explain: "Its exit status is kept until the parent calls wait().",
      },
      {
        q: "A shell reports exit status 137. What happened?",
        options: ["The command wasn't found", "The program was killed by signal 9 (SIGKILL)", "A syntax error", "Permission denied"],
        answer: 1,
        explain: "128 + 9 = 137. It's common when the OOM killer or `kill -9` ends a process.",
      },
      {
        q: "Why is fork() fast even for a process using gigabytes of memory?",
        options: ["It only copies the stack", "Copy-on-write shares pages until someone writes", "The kernel compresses memory", "Fork doesn't create a new address space"],
        answer: 1,
        explain: "Only page tables are copied; data pages are copied lazily on write.",
      },
      {
        q: "Who adopts an orphaned process on Linux?",
        options: ["Nobody: it's killed", "PID 1 or the nearest subreaper", "Its oldest sibling", "The shell"],
        answer: 1,
        explain: "Orphans are re-parented to init (or a subreaper), which reaps them.",
      },
    ],
  },

  // ------------------------------------------------------------------ THREADS
  {
    id: "os-threads",
    title: "Threads: many workers, one house",
    tagline: "Threads vs processes, what's shared and what's private, pthreads, kernel vs user threads, 1:1 and M:N models, thread pools, and when threads help.",
    difficulty: "intermediate",
    minutes: 30,
    visualizers: ["jthreads"],
    concept: `## Explain it like I'm 10 🧸
A **process** is a **house**. **Threads** are the **people living in it**.
- Everyone in the house shares the **kitchen, fridge and living room** (the code, global variables, heap and open files). If one person eats the last cookie, it's gone for everybody.
- But each person has their **own to-do list and notebook** (their own **stack** and **registers**), so they can work on different things at the same time.
- Moving into a new house (a new process) is a big job. A new person joining the family (a new thread) is quick.
- The danger: two people grabbing the **same cookie jar** at once can cause a mess. That's why the next part of this world is about **locks**.

## What threads share and what they don't
| Shared by all threads in a process | Private to each thread |
|---|---|
| Code (text) | **Stack** (local variables, return addresses) |
| Global and static variables | **Registers**, including the program counter and stack pointer |
| Heap (\`malloc\`, \`new\`) | Thread ID |
| Open files, sockets, current directory | Signal mask, \`errno\` |
| Address space and page tables, PID, user ID | **Thread-local storage** (\`_Thread_local\`, \`threading.local\`) |

Because threads share memory, they can **communicate just by reading and writing variables**, which is fast and convenient. It's also exactly what makes them dangerous: unsynchronised access to shared data is a **race condition**.

## Threads vs processes
| | Processes | Threads |
|---|---|---|
| Memory | Separate address spaces | One shared address space |
| Creation cost | Higher (new page tables, PCB) | Lower (a new stack and kernel task) |
| Context switch | Changes page tables (TLB cost) | Same address space, cheaper |
| Communication | Pipes, sockets, shared memory (explicit) | Shared variables (needs locks) |
| Fault isolation | One crashing doesn't kill the others | A crash in any thread kills the whole process |
| Examples | Chrome tabs, PostgreSQL backends, gunicorn workers | Java and Go servers, MySQL connection threads, game engines |

On Linux, threads and processes are the **same kernel object** (a *task*), created by \`clone()\` with different flags. A thread is a task that shares memory, files and signal handlers with its siblings. That's why \`top -H\` lists threads individually, and each has its own TID.

## Kernel threads, user threads, and the models
- **Kernel-level threads**: the kernel knows about and schedules each one. They can run in parallel on many cores, and one blocking doesn't block the others. Linux pthreads and Java's platform threads work this way.
- **User-level threads** (green threads, fibers, coroutines): managed by a library or runtime in user space. Switching is very cheap, but the kernel sees only one thread, so a blocking system call can block them all unless the runtime is careful.

| Model | Mapping | Examples |
|---|---|---|
| **1:1** | Each user thread is a kernel thread | Linux pthreads (NPTL), Windows threads, Java platform threads |
| **N:1** | Many user threads on one kernel thread | Old green threads, a single asyncio event loop |
| **M:N** | Many user threads multiplexed over several kernel threads | **Go** goroutines, **Java virtual threads**, Erlang processes, Tokio tasks |

M:N gives you cheap threads (a goroutine starts at 2 KiB of stack; you can have millions) *and* multi-core parallelism. The runtime's scheduler parks a user thread when it would block, and runs another on the same kernel thread. The visualizer shows this with Java's platform vs virtual threads.

## The pthreads API in one table
| Call | Does |
|---|---|
| \`pthread_create(&t, attr, fn, arg)\` | Start a thread running \`fn(arg)\` |
| \`pthread_join(t, &ret)\` | Wait for it to finish and get its return value |
| \`pthread_detach(t)\` | Let it clean up by itself (no join needed) |
| \`pthread_mutex_lock/unlock\` | Mutual exclusion (next part) |
| \`pthread_cond_wait/signal\` | Wait for a condition (next part) |
| \`pthread_self()\`, \`gettid()\` | Who am I |

Compile with \`-pthread\`. C11 also has \`<threads.h>\`, and C++ has \`std::thread\`.

## When do threads help?
- **I/O-bound work** (waiting for network, disk or users): yes. While one thread waits, others run. Even Python's threads help here.
- **CPU-bound work** on several cores: yes, in C, C++, Rust, Go and Java. In CPython, the **GIL** lets only one thread run Python code at a time, so use processes or native extensions (free-threaded Python is changing this).
- **Too many threads** hurt: each kernel thread has a stack (8 MiB reserved by default on Linux, though only touched pages use RAM), and thousands of runnable threads waste time context-switching. Use a **thread pool** sized to the work: about the number of cores for CPU work, more for blocking I/O. Or use async I/O or M:N runtimes.

## Thread pools
Creating a thread per task is wasteful. A **pool** keeps N worker threads waiting on a **queue** of tasks. Examples: Java's \`ExecutorService\`, Python's \`ThreadPoolExecutor\`, a web server's request workers, the database connection threads. The pool also limits load: with 8 workers, at most 8 tasks run at once, and the rest wait in the queue (which must have a size limit, or memory explodes under overload).`,
    keyPoints: [
      "Threads share code, globals, heap and open files; each has its own stack, registers and thread-local storage",
      "Threads are cheaper to create and switch than processes, but a crash kills the whole process",
      "On Linux a thread is a task created by clone() sharing the address space",
      "Models: 1:1 (pthreads), N:1 (green threads), M:N (goroutines, Java virtual threads)",
      "Threads help I/O-bound work everywhere and CPU-bound work outside CPython's GIL",
      "Use thread pools with bounded queues instead of one thread per task",
    ],
    code: [
      {
        title: "pthread_create and pthread_join",
        linux: true,
        variants: [{ lang: "c", code: `// Threads: several flows of execution inside ONE process, sharing its memory.
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

struct job { int id; long from, to; long result; };

static void *sum_range(void *arg) {           // every thread runs this function on its own job
    struct job *j = arg;
    long s = 0;
    for (long x = j->from; x <= j->to; x++) s += x;
    j->result = s;                            // write the answer into memory the main thread can see
    return NULL;
}

int main(void) {
    enum { T = 4 };
    pthread_t tid[T];
    struct job jobs[T];
    long n = 1000000, chunk = n / T;

    for (int i = 0; i < T; i++) {             // split 1..1,000,000 into four ranges
        jobs[i] = (struct job){i, i * chunk + 1, (i + 1) * chunk, 0};
        pthread_create(&tid[i], NULL, sum_range, &jobs[i]);
    }
    long total = 0;
    for (int i = 0; i < T; i++) {
        pthread_join(tid[i], NULL);           // wait for thread i to finish
        printf("thread %d summed %7ld..%-7ld = %ld\\n", jobs[i].id, jobs[i].from, jobs[i].to, jobs[i].result);
        total += jobs[i].result;
    }
    printf("total = %ld (expected %ld)\\n", total, n * (n + 1) / 2);
    return 0;
}` }],
        explain: `- \`pthread_create(&tid[i], NULL, sum_range, &jobs[i])\` starts a new thread running \`sum_range(&jobs[i])\`. All four run **at the same time** on different cores.
- Each thread writes its answer into **its own** \`struct job\`, so no two threads write the same memory and no lock is needed. Giving each thread its own slot is the simplest way to avoid races.
- \`pthread_join\` waits for a thread to finish, like \`waitpid\` for processes. The main thread prints after joining, so the output order is fixed.
- Never pass \`&i\` (the loop variable) as the argument: by the time the thread reads it, the loop may have changed it. Pass a pointer to data that stays valid, or the value itself.`,
        output: `thread 0 summed       1..250000  = 31250125000
thread 1 summed  250001..500000  = 93750125000
thread 2 summed  500001..750000  = 156250125000
thread 3 summed  750001..1000000 = 218750125000
total = 500000500000 (expected 500000500000)`,
      },
      {
        title: "Shared vs private: globals, heap, stacks and thread-locals",
        linux: true,
        variants: [{ lang: "c", code: `// What threads share (globals, heap, open files) and what each has privately (stack, registers).
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

int shared_counter = 0;                       // one copy for the whole process
int *heap_box;                                // points into the heap: also shared
_Thread_local int per_thread = 0;             // thread-local storage: one copy PER THREAD
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
uintptr_t stack_addr[2];

static void *worker(void *arg) {
    int id = (int)(intptr_t)arg;
    int local = id * 100;                     // lives on THIS thread's stack
    stack_addr[id] = (uintptr_t)&local;
    per_thread = id + 1;
    pthread_mutex_lock(&lock);
    shared_counter++;
    *heap_box += 10;
    pthread_mutex_unlock(&lock);
    return (void *)(intptr_t)(local + per_thread);
}

int main(void) {
    heap_box = malloc(sizeof *heap_box);
    *heap_box = 0;
    pthread_t t[2];
    for (int i = 0; i < 2; i++) pthread_create(&t[i], NULL, worker, (void *)(intptr_t)i);
    void *ret[2];
    for (int i = 0; i < 2; i++) pthread_join(t[i], &ret[i]);

    printf("shared_counter = %d (both threads changed the same global)\\n", shared_counter);
    printf("*heap_box      = %d (both threads changed the same heap memory)\\n", *heap_box);
    printf("per_thread in main = %d (each thread had its own copy)\\n", per_thread);
    printf("return values: %ld and %ld\\n", (long)(intptr_t)ret[0], (long)(intptr_t)ret[1]);
    long gap = (long)(stack_addr[0] > stack_addr[1] ? stack_addr[0] - stack_addr[1] : stack_addr[1] - stack_addr[0]);
    printf("the two stacks are far apart (%s): each thread has its own stack\\n", gap > 64 * 1024 ? "more than 64 KiB" : "close");
    free(heap_box);
    return 0;
}` }],
        explain: `- Both threads incremented the **same** global and the **same** heap integer. The mutex makes those updates safe (the next part explains why it's needed).
- \`local\` lives on each thread's own **stack**. The two stacks are far apart in the address space, each with its own guard page.
- \`_Thread_local int per_thread\` gives every thread its own copy. Main's copy is still 0. \`errno\` is thread-local in exactly this way.
- A thread's return value comes back through \`pthread_join\`'s second argument.`,
        output: `shared_counter = 2 (both threads changed the same global)
*heap_box      = 20 (both threads changed the same heap memory)
per_thread in main = 0 (each thread had its own copy)
return values: 1 and 102
the two stacks are far apart (more than 64 KiB): each thread has its own stack`,
      },
      {
        title: "Threads are cheaper than processes",
        linux: true,
        note: "Timings go to stderr and vary; on the test machine: process 92.9 µs, thread 45.6 µs.",
        variants: [{ lang: "c", code: `// Creating a thread is much cheaper than creating a process.
#include <pthread.h>
#include <stdio.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1e6 + t.tv_nsec / 1e3;    // microseconds
}
static void *nothing(void *arg) { return arg; }

int main(void) {
    const int N = 2000;
    double t0 = now();
    for (int i = 0; i < N; i++) {
        pid_t pid = fork();
        if (pid == 0) _exit(0);
        waitpid(pid, NULL, 0);
    }
    double proc_us = (now() - t0) / N;

    t0 = now();
    for (int i = 0; i < N; i++) {
        pthread_t t;
        pthread_create(&t, NULL, nothing, NULL);
        pthread_join(t, NULL);
    }
    double thread_us = (now() - t0) / N;

    printf("creating + joining a thread is cheaper than fork + wait: %s\\n", thread_us < proc_us ? "yes" : "no");
    fprintf(stderr, "process %.1f us, thread %.1f us (%.1fx)\\n", proc_us, thread_us, proc_us / thread_us);
    return 0;
}` }],
        explain: `- A fork has to copy the page tables, file table and more, and the exit and wait add more work. A thread shares all that, so the kernel only sets up a stack and a task.
- Both take **tens of microseconds**, which is why servers create a pool of workers once instead of one per request.
- The gap is wider for big processes, whose page tables are larger to copy.`,
        output: `creating + joining a thread is cheaper than fork + wait: yes`,
      },
      {
        title: "Threads for waiting work (Python)",
        variants: [{ lang: "python", code: `# Threads shine when work WAITS (network, disk, sleep): while one waits, others run.
import threading
import time

results = {}

def download(name, seconds):
    time.sleep(seconds)              # stands in for waiting on the network
    results[name] = f"{name} done"

start = time.perf_counter()
threads = [threading.Thread(target=download, args=(f"file{i}", 0.2)) for i in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
elapsed = time.perf_counter() - start

print(sorted(results.values()))
print("5 downloads of 0.2 s each finished in well under 1 s:", elapsed < 0.6)
print("threads alive now:", threading.active_count(), "(just the main thread)")` }],
        explain: `- Five "downloads" that each wait 0.2 s finish in about 0.2 s total, because they wait **at the same time**. \`time.sleep\` (like socket reads) releases Python's GIL.
- The same trick wouldn't speed up a CPU-heavy loop in CPython: use \`multiprocessing\` or \`ProcessPoolExecutor\` for that (see the Python track's concurrency level).
- In real code prefer \`concurrent.futures.ThreadPoolExecutor\`, which gives you a pool and futures.`,
        output: `['file0 done', 'file1 done', 'file2 done', 'file3 done', 'file4 done']
5 downloads of 0.2 s each finished in well under 1 s: True
threads alive now: 1 (just the main thread)`,
      },
    ],
    interview: [
      {
        q: "Process vs thread: what's the difference?",
        freq: "very-common",
        a: `A **process** is an isolated execution environment with its own address space and resources. A **thread** is a unit of execution inside a process. Threads in a process share code, data, heap, open files and the address space, but each has its own stack, registers, PC and thread-local storage.

Threads are cheaper to create and switch between (no address-space change) and communicate through shared memory, but they need synchronisation, and one crashing thread kills the process. Processes give isolation and fault containment but need IPC to communicate.`,
      },
      {
        q: "What's the difference between user-level and kernel-level threads?",
        freq: "common",
        a: `**Kernel-level threads** are known to and scheduled by the kernel: true parallelism, and a blocking call blocks only that thread, but creating and switching costs a system call and kernel work. **User-level threads** are managed by a library: switching is a function call, and there can be millions, but the kernel sees one entity, so without care a blocking syscall blocks them all and there's no parallelism.

The **M:N** model (Go, Java virtual threads, Erlang) combines them: a runtime schedules many user threads over a pool of kernel threads and parks user threads that would block.`,
      },
      {
        q: "If threads share memory, what does each thread still need for itself?",
        freq: "common",
        a: `Its own **stack** (for calls and local variables), **register set** including PC and SP (saved on switches), a **thread ID**, a **signal mask**, scheduling state and priority, \`errno\`, and any **thread-local storage**.`,
      },
      {
        q: "How does Linux implement threads?",
        freq: "occasional",
        a: `Linux has no separate thread object: every thread is a **task** (\`task_struct\`). \`clone()\` creates tasks and chooses what to share via flags: \`CLONE_VM\` (address space), \`CLONE_FILES\`, \`CLONE_FS\`, \`CLONE_SIGHAND\`, \`CLONE_THREAD\` (same thread group, so the same PID to user space). pthreads (NPTL) calls clone with all of these; fork is essentially clone with nothing shared. Each thread has its own TID; \`getpid()\` returns the thread-group ID.`,
      },
      {
        q: "How many threads should a thread pool have?",
        freq: "common",
        a: `For **CPU-bound** work, about the number of cores (more just adds context switching). For **I/O-bound** work, more: roughly \`cores × (1 + wait time / compute time)\`, then tune by measuring. Bound the work queue to avoid unbounded memory growth, and decide what happens when it's full (block the caller, reject, or shed load). For very high I/O concurrency, async I/O or M:N runtimes beat huge pools.`,
      },
      {
        q: "What happens if one thread calls fork() in a multithreaded program?",
        freq: "occasional",
        a: `The child gets a copy of the whole address space but **only the calling thread**. Locks held by other threads at that moment stay locked forever in the child (those threads don't exist to unlock them), so calling \`malloc\` or \`printf\` in the child can deadlock. POSIX says the child should only call async-signal-safe functions until it calls \`exec\`. \`pthread_atfork\` handlers can help, but the usual advice is: fork early or only to exec immediately, or use \`posix_spawn\`.`,
      },
    ],
    quiz: [
      {
        q: "Which of these is private to each thread?",
        options: ["Global variables", "The heap", "The stack", "Open file descriptors"],
        answer: 2,
        explain: "Each thread has its own stack and registers; globals, heap and files are shared.",
      },
      {
        q: "One thread dereferences a NULL pointer and gets SIGSEGV. What happens to the other threads?",
        options: ["Only the faulty thread dies", "The whole process dies", "The others pause", "The kernel restarts the thread"],
        answer: 1,
        explain: "Threads share one process; a fatal signal kills the whole process.",
      },
      {
        q: "Go goroutines and Java virtual threads use which threading model?",
        options: ["1:1", "N:1", "M:N", "No threads at all"],
        answer: 2,
        explain: "Many lightweight user-level threads are multiplexed onto a smaller pool of kernel threads.",
      },
      {
        q: "Why is switching between two threads of the same process cheaper than switching between two processes?",
        options: ["Threads don't have registers", "The address space (page tables, TLB) doesn't change", "Threads never sleep", "The kernel isn't involved"],
        answer: 1,
        explain: "Same memory map: no page-table switch and less TLB disruption.",
      },
      {
        q: "On Linux, which system call creates both threads and processes?",
        options: ["exec", "clone", "spawn", "pthread"],
        answer: 1,
        explain: "clone() with different sharing flags; fork() and pthread_create are built on it.",
      },
      {
        q: "A CPU-bound pure-Python function is run in 4 threads on a 4-core machine. Roughly how much faster is it than 1 thread?",
        options: ["4×", "About the same (the GIL)", "16×", "It's slower by 4×"],
        answer: 1,
        explain: "The GIL lets one thread execute Python bytecode at a time (in standard CPython).",
      },
    ],
  },

  // ------------------------------------------------------------------ SCHEDULING
  {
    id: "os-scheduling",
    title: "CPU scheduling",
    tagline: "FCFS, SJF, SRTF, priority, round robin, MLFQ, Linux's CFS and EEVDF, real-time policies, multicore load balancing, and how to compute waiting times.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["cpusched"],
    complexity: [
      { op: "FCFS", time: "O(1) pick", note: "Simple; convoy effect: short jobs stuck behind long ones" },
      { op: "SJF / SRTF", time: "O(log n) with a heap", note: "Optimal average waiting time, but needs burst lengths; starves long jobs" },
      { op: "Priority", time: "O(log n) or O(1) with bitmap queues", note: "Starvation unless you add aging" },
      { op: "Round robin", time: "O(1) per slice", note: "Fair, good response; quantum too small = switching overhead" },
      { op: "CFS / EEVDF (Linux)", time: "O(log n) red-black tree", note: "Picks the task with the smallest virtual runtime / earliest eligible deadline" },
    ],
    concept: `## Explain it like I'm 10 🧸
There's **one slide** in the playground (the CPU) and a **line of kids** who all want a turn (the ready processes). The teacher (the scheduler) decides who goes next. Some ways to do it:
- **First come, first served**: whoever lined up first goes first. But if the first kid wants to slide 50 times, everyone else waits forever. 😩
- **Shortest turn first**: kids who only want one slide go first. The line moves fast on average, but the kid who wants 50 slides might *never* get a turn.
- **Taking turns** (round robin): everyone gets 2 slides, then goes to the back of the line. Fair, and nobody waits too long.
- **VIP kids first** (priority): important kids skip ahead. To be fair, kids who've waited a long time slowly become more important too (aging).

Real operating systems mix these ideas, thousands of times per second.

## What a scheduler tries to do
The scheduler picks which **ready** thread runs on each CPU next. Goals that pull in different directions:
| Metric | Meaning | Who cares |
|---|---|---|
| **CPU utilisation** | Keep the CPU busy | Everyone |
| **Throughput** | Jobs finished per second | Batch systems |
| **Turnaround time** | Finish time − arrival time | Batch jobs |
| **Waiting time** | Time spent in the ready queue = turnaround − burst | Exam questions 😄 |
| **Response time** | First run − arrival | Interactive apps: typing, clicking |
| **Fairness** | Each gets its share; no starvation | Multi-user systems |
| **Deadlines** | Finish before time T | Real-time systems |

**Preemptive** schedulers can take the CPU away (on a timer or when a more important task wakes). **Non-preemptive** (cooperative) ones wait until the task blocks or exits. Every modern desktop and server OS is preemptive.

Processes alternate **CPU bursts** and **I/O bursts**. **I/O-bound** tasks (editors, shells, servers) have short CPU bursts; **CPU-bound** tasks (compilers, video encoders) have long ones. A good scheduler lets I/O-bound tasks run quickly when they wake, so the system feels snappy, and lets CPU-bound tasks soak up the rest.

## The classic algorithms
Worked example (also in the simulator code sample). Lower priority number = more important:
| Process | Arrival | Burst | Priority |
|---|---|---|---|
| P1 | 0 | 7 | 3 |
| P2 | 2 | 4 | 1 |
| P3 | 4 | 1 | 4 |
| P4 | 5 | 4 | 2 |

| Algorithm | Gantt chart | Avg waiting |
|---|---|---|
| **FCFS** | P1 0–7, P2 7–11, P3 11–12, P4 12–16 | 4.75 |
| **SJF** (non-preemptive) | P1 0–7, P3 7–8, P2 8–12, P4 12–16 | 4.00 |
| **SRTF** (preemptive SJF) | P1 0–2, P2 2–4, P3 4–5, P2 5–7, P4 7–11, P1 11–16 | **3.00** |
| **Priority** (non-preemptive) | P1 0–7, P2 7–11, P4 11–15, P3 15–16 | 5.50 |
| **Round robin** (q = 2) | P1, P2, P1, P3, P2, P4, P1, P4, P1 | 5.00 (but avg response 1.5) |

- **FCFS**: simple and fair in arrival order, but suffers the **convoy effect**: one long job makes many short ones wait.
- **SJF**: provably gives the **minimum average waiting time**, but the OS can't know future burst lengths (it estimates them with an exponential average of past bursts, \`τ(n+1) = α·t(n) + (1−α)·τ(n)\`), and long jobs can **starve**.
- **SRTF**: preemptive SJF. Even better averages, more context switches, same starvation risk.
- **Priority**: run the most important first. **Starvation** of low priorities is fixed with **aging**: gradually raise the priority of tasks that have waited a long time.
- **Round robin (RR)**: each task gets a **time quantum** (e.g. 10 ms), then goes to the back of the queue. Great **response time** and fairness. If the quantum is too large it becomes FCFS; too small and you spend all your time context switching. Rule of thumb: most CPU bursts should finish within one quantum.

## Multi-level feedback queue (MLFQ)
How do you favour interactive jobs without knowing in advance which ones they are? **Learn from behaviour**:
1. Several queues, each with a priority; higher queues have **shorter** quanta.
2. New jobs start at the top.
3. Used your **whole slice**? You're probably CPU-bound, so you **drop** a level.
4. Gave up the CPU early (to wait for I/O)? You stay, keeping good responsiveness.
5. Every so often, **boost** everyone to the top, so long jobs don't starve and jobs that became interactive are rediscovered.

To stop a job from gaming rule 4 (sleeping just before its slice ends), real MLFQs track the **total CPU used at a level** rather than per slice. Windows and classic BSD/Solaris schedulers are MLFQ-style. The second code sample simulates one.

## How Linux does it: CFS, then EEVDF
From 2007 to 2023 Linux used the **Completely Fair Scheduler (CFS)**:
- Each task has a **virtual runtime** (\`vruntime\`): how much CPU it has used, scaled by its **weight**.
- The task with the **smallest vruntime** runs next. Tasks are kept in a **red-black tree** ordered by vruntime, so picking is O(log n) (cached leftmost: O(1)).
- **Weights come from nice values** (-20 to +19): nice 0 has weight 1024, and each nice step is about 1.25×, so nice 10 has weight 110. Two busy tasks at nice 0 and nice 10 on one core split it about **9:1** (the third sample measures this: 9.9).
- A task that slept (I/O-bound) has low vruntime, so it runs soon after waking: good interactivity without special cases.

Linux 6.6 replaced CFS with **EEVDF** (Earliest Eligible Virtual Deadline First). It keeps the weighted fairness but gives each task a **virtual deadline** based on its requested slice, so latency-sensitive tasks can ask for shorter slices and get picked sooner, with fewer heuristics.

Other Linux scheduling classes, checked in order:
- **SCHED_DEADLINE**: earliest-deadline-first with runtime, deadline and period budgets.
- **SCHED_FIFO / SCHED_RR**: real-time fixed priorities 1–99. They always beat normal tasks; FIFO runs until it blocks, RR adds a quantum among equals.
- **SCHED_OTHER / SCHED_NORMAL** (CFS/EEVDF), **SCHED_BATCH** and **SCHED_IDLE**.

A runaway SCHED_FIFO task can freeze a core, so by default the kernel reserves 5% of each second for normal tasks (\`sched_rt_runtime_us\`).

## Multicore scheduling
- Each CPU has its **own run queue** (no global lock), and a **load balancer** periodically moves tasks from busy cores to idle ones.
- **Processor affinity**: keep a task on the same core so its cache stays warm. *Soft* affinity is the default; *hard* affinity uses \`taskset\` / \`sched_setaffinity\`.
- The balancer is **NUMA- and cache-topology-aware**: it prefers to move tasks between cores that share an L3 cache, and keeps tasks near their memory.
- **Gang scheduling** (running a group's threads at the same time) matters for some parallel workloads and VMs.

## Real-time scheduling, briefly
For periodic tasks with deadlines:
- **Rate-monotonic (RM)**: fixed priorities, shorter period means higher priority. Guaranteed schedulable if utilisation ≤ n(2^(1/n) − 1), about 69% for many tasks.
- **Earliest deadline first (EDF)**: dynamic priorities. Schedulable up to 100% utilisation.

Also watch for **priority inversion**: a high-priority task waits for a lock held by a low-priority one while a medium task runs. The fix is **priority inheritance** (see the deadlock level, and the Mars Pathfinder story).`,
    keyPoints: [
      "Metrics: utilisation, throughput, turnaround, waiting, response time, fairness",
      "FCFS has the convoy effect; SJF/SRTF minimise average waiting time but can starve long jobs",
      "Priority scheduling needs aging to prevent starvation",
      "Round robin trades a bit of throughput for great response time; quantum size matters",
      "MLFQ learns which jobs are interactive from how they use their slices",
      "Linux: CFS (min vruntime in a red-black tree, nice → weight), EEVDF since 6.6, plus real-time classes",
    ],
    code: [
      {
        title: "A scheduling simulator: five algorithms, one workload",
        variants: [{ lang: "python", code: `# CPU scheduling simulator: FCFS, SJF, SRTF, Priority and Round Robin on the same four processes.
from collections import deque

# name: (arrival time, CPU burst, priority: lower number = more important)
JOBS = {"P1": (0, 7, 3), "P2": (2, 4, 1), "P3": (4, 1, 4), "P4": (5, 4, 2)}


def simulate(pick, preemptive=False, quantum=None):
    """Run one time unit at a time. \`pick\` chooses among ready jobs. Returns the timeline."""
    left = {p: b for p, (a, b, _) in JOBS.items()}
    timeline, t, current, used, queue = [], 0, None, 0, deque()
    while any(left.values()):
        for p, (a, _, _) in JOBS.items():          # new arrivals join the ready queue first
            if a == t:
                queue.append(p)
        if current and quantum and used == quantum:  # Round Robin: time slice used up
            queue.append(current)
            current = None
        if current is None or preemptive:
            ready = list(queue) + ([current] if current else [])
            if not ready:
                timeline.append("--")
                t += 1
                continue
            choice = queue[0] if quantum else min(ready, key=lambda p: (pick(p, left), JOBS[p][0], p))
            if choice != current:
                if current:
                    queue.append(current)
                queue.remove(choice)
                current, used = choice, 0
        timeline.append(current)
        left[current] -= 1
        used += 1
        t += 1
        if left[current] == 0:
            current = None
    return timeline


def report(name, timeline):
    blocks, start = [], 0
    for i in range(1, len(timeline) + 1):
        if i == len(timeline) or timeline[i] != timeline[start]:
            blocks.append(f"{timeline[start]} {start}-{i}")
            start = i
    finish = {p: max(i for i, x in enumerate(timeline) if x == p) + 1 for p in JOBS}
    first = {p: timeline.index(p) for p in JOBS}
    turnaround = {p: finish[p] - JOBS[p][0] for p in JOBS}
    waiting = {p: turnaround[p] - JOBS[p][1] for p in JOBS}
    response = {p: first[p] - JOBS[p][0] for p in JOBS}
    n = len(JOBS)
    print(f"{name}\\n  | " + " | ".join(blocks) + " |")
    print(f"  avg waiting {sum(waiting.values()) / n:.2f}   avg turnaround {sum(turnaround.values()) / n:.2f}"
          f"   avg response {sum(response.values()) / n:.2f}")


report("FCFS (first come, first served)", simulate(lambda p, left: JOBS[p][0]))
report("SJF (shortest job first, non-preemptive)", simulate(lambda p, left: JOBS[p][1]))
report("SRTF (shortest remaining time first, preemptive)", simulate(lambda p, left: left[p], preemptive=True))
report("Priority (non-preemptive, 1 = highest)", simulate(lambda p, left: JOBS[p][2]))
report("Round Robin (quantum = 2)", simulate(None, quantum=2))` }],
        explain: `- The simulation runs **one time unit per loop**. At each tick, new arrivals join the ready queue, then the policy decides who runs.
- Non-preemptive policies (FCFS, SJF, Priority) only choose when the CPU is free. **SRTF** re-chooses every tick, so P2 (4 units) preempts P1 (5 left) at t = 2.
- **Round robin** ignores burst lengths and just rotates the queue every 2 units. Arrivals at the same instant a slice ends join *before* the preempted process: a common convention, and exam questions say which one they use.
- Formulas: **turnaround = finish − arrival**, **waiting = turnaround − burst**, **response = first run − arrival**.
- Compare: SRTF wins on average waiting time (3.00), RR wins on response time among the fair policies, Priority is worst here because P3 (priority 4) waits until the end.
- Edit \`JOBS\` to check your answers to textbook exercises.`,
        output: `FCFS (first come, first served)
  | P1 0-7 | P2 7-11 | P3 11-12 | P4 12-16 |
  avg waiting 4.75   avg turnaround 8.75   avg response 4.75
SJF (shortest job first, non-preemptive)
  | P1 0-7 | P3 7-8 | P2 8-12 | P4 12-16 |
  avg waiting 4.00   avg turnaround 8.00   avg response 4.00
SRTF (shortest remaining time first, preemptive)
  | P1 0-2 | P2 2-4 | P3 4-5 | P2 5-7 | P4 7-11 | P1 11-16 |
  avg waiting 3.00   avg turnaround 7.00   avg response 0.50
Priority (non-preemptive, 1 = highest)
  | P1 0-7 | P2 7-11 | P4 11-15 | P3 15-16 |
  avg waiting 5.50   avg turnaround 9.50   avg response 5.50
Round Robin (quantum = 2)
  | P1 0-2 | P2 2-4 | P1 4-6 | P3 6-7 | P2 7-9 | P4 9-11 | P1 11-13 | P4 13-15 | P1 15-16 |
  avg waiting 5.00   avg turnaround 9.00   avg response 1.50`,
      },
      {
        title: "MLFQ: the scheduler learns who's interactive",
        variants: [{ lang: "python", code: `# Multi-level feedback queue (MLFQ): the scheduler LEARNS which jobs are interactive.
#   1. Always run a job from the highest non-empty level (0 is highest), preempting lower ones.
#   2. New jobs start at level 0.
#   3. Use up a whole time slice -> drop one level. Give up the CPU early (to wait for I/O) -> stay.
#   4. Every 20 ticks, boost every job back to level 0 (so long jobs can't starve).
QUANTUM = [2, 4, 8]                          # slice length per level: short at the top, long at the bottom

jobs = {
    "compiler": {"level": 0, "left": 24, "used": 0, "ready_at": 0},   # pure number crunching
    "editor":   {"level": 0, "left": 6,  "used": 0, "ready_at": 0},   # 1 tick of work per key press, then waits
}
timeline, editor_waits, t = [], [], 0
while any(j["left"] for j in jobs.values()):
    if t and t % 20 == 0:
        for j in jobs.values():
            j["level"], j["used"] = 0, 0
        print(f"t={t:2}: priority boost, everyone back to level 0")
    ready = [n for n, j in jobs.items() if j["left"] and j["ready_at"] <= t]
    if not ready:
        timeline.append(".")
        t += 1
        continue
    name = min(ready, key=lambda n: jobs[n]["level"])
    job = jobs[name]
    if name == "editor":
        editor_waits.append(t - job["ready_at"])
    timeline.append(name[0])
    job["left"] -= 1
    job["used"] += 1
    t += 1
    if name == "editor" and job["left"]:
        job["ready_at"] = t + 3              # waits 3 ticks for the next key press...
        job["used"] = 0                      # ...gave up the CPU early, so it keeps its level
    elif job["used"] == QUANTUM[job["level"]]:
        job["used"] = 0
        if job["level"] < len(QUANTUM) - 1:
            job["level"] += 1
            print(f"t={t:2}: {name} used a whole slice, drops to level {job['level']}")

print("timeline:", "".join(timeline), "(c = compiler, e = editor)")
print("editor waited", editor_waits, "ticks after each key press")
print(f"all work finished at t={t}")` }],
        explain: `- The **compiler** never gives the CPU back, so it uses whole slices and sinks to the bottom level, where slices are long (8 ticks): efficient for batch work.
- The **editor** runs 1 tick per key press, then waits. It always gives the CPU back early, so it **stays at level 0**, and because higher levels always win, it **preempts** the compiler the instant a key arrives.
- The only wait (2 ticks) is at the very start, before the scheduler has learned anything: both jobs were brand new at level 0, and the compiler happened to go first.
- At t = 20 the **priority boost** lifts the compiler back to the top. Without it, a steady stream of interactive jobs could starve the compiler forever.
- The timeline \`cceccc...\` shows the pattern: the editor slips in every 4 ticks.`,
        output: `t= 2: compiler used a whole slice, drops to level 1
t= 8: compiler used a whole slice, drops to level 2
t=20: priority boost, everyone back to level 0
t=22: compiler used a whole slice, drops to level 1
t=27: compiler used a whole slice, drops to level 2
timeline: cceccceccceccceccceccceccccccc (c = compiler, e = editor)
editor waited [2, 0, 0, 0, 0, 0] ticks after each key press
all work finished at t=30`,
      },
      {
        title: "Linux's fair scheduler and nice values",
        linux: true,
        note: "The ratio is printed to stderr; on the test machine it was 9.9 against a theoretical 9.3.",
        variants: [{ lang: "c", code: `// Linux's fair scheduler gives CPU time in proportion to weight, and "nice" sets the weight.
// Two identical busy loops share ONE core; one is nice 0 (weight 1024), the other nice 10 (weight 110).
#define _GNU_SOURCE
#include <sched.h>
#include <signal.h>
#include <stdio.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    volatile long *count = mmap(NULL, 2 * sizeof(long), PROT_READ | PROT_WRITE, MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    cpu_set_t one_cpu;
    CPU_ZERO(&one_cpu);
    CPU_SET(0, &one_cpu);
    pid_t kids[2];
    for (int i = 0; i < 2; i++) {
        kids[i] = fork();
        if (kids[i] == 0) {
            sched_setaffinity(0, sizeof one_cpu, &one_cpu);   // both children on CPU 0 only
            setpriority(PRIO_PROCESS, 0, i == 0 ? 0 : 10);    // child 1 is "nicer"
            for (;;) count[i]++;                              // burn CPU forever
        }
    }
    sleep(2);
    for (int i = 0; i < 2; i++) kill(kids[i], SIGKILL);
    for (int i = 0; i < 2; i++) waitpid(kids[i], NULL, 0);

    printf("nice 0 did much more work than nice 10: %s\\n", count[0] > 4 * count[1] ? "yes" : "no");
    fprintf(stderr, "nice 0: %ld loops, nice 10: %ld loops, ratio %.1f (weights 1024/110 = 9.3)\\n",
            count[0], count[1], (double)count[0] / count[1]);
    return 0;
}` }],
        explain: `- \`sched_setaffinity\` pins both children to **CPU 0**, so they must share one core. Otherwise each would get a core of its own and nice would make no difference.
- \`setpriority(PRIO_PROCESS, 0, 10)\` makes child 1 "nicer". Its weight drops from 1024 to 110.
- Both count as fast as they can for 2 seconds in shared memory (\`mmap MAP_SHARED\`), so the parent can compare the counts.
- The nice-0 child did about **9×** the work: CPU time in proportion to weight, exactly what fair scheduling promises.
- Try it on a server: \`nice -n 10 make -j8\` keeps a big build from making the machine sluggish, and \`renice\` changes a running process.`,
        output: `nice 0 did much more work than nice 10: yes`,
      },
    ],
    interview: [
      {
        q: "Compare FCFS, SJF, priority and round-robin scheduling.",
        freq: "very-common",
        a: `- **FCFS**: run in arrival order, non-preemptive. Simple, but the **convoy effect** hurts average waiting time.
- **SJF**: shortest next CPU burst first. **Optimal average waiting time**, but needs burst prediction and starves long jobs. Preemptive version: **SRTF**.
- **Priority**: most important first, preemptive or not. Low priorities **starve**; the fix is **aging**.
- **Round robin**: a fixed quantum, rotating the ready queue. Fair with good **response time**, more context switches. A large quantum degenerates to FCFS; a tiny one is all overhead.

Real schedulers combine them (MLFQ, CFS/EEVDF).`,
      },
      {
        q: "How do you calculate waiting time and turnaround time?",
        freq: "very-common",
        a: `Draw the Gantt chart, then for each process:
- **turnaround = completion − arrival**
- **waiting = turnaround − burst** (total time in the ready queue)
- **response = first time it runs − arrival**

Average over the processes. For preemptive algorithms, carefully track remaining burst times, and state your tie-breaking rule (arrival order, or new arrivals before a preempted process in RR).`,
      },
      {
        q: "What is starvation, and how does aging fix it?",
        freq: "common",
        a: `**Starvation**: a ready task waits indefinitely because others are always preferred (low priority under priority scheduling, long jobs under SJF). **Aging** gradually increases a task's priority the longer it waits, so it eventually runs. MLFQ's periodic priority boost and CFS's vruntime accounting are other ways to guarantee progress.`,
      },
      {
        q: "How does Linux's CFS decide which task to run?",
        freq: "common",
        a: `Each task accumulates **vruntime** = actual runtime × (1024 / weight), with weight derived from its nice value. Runnable tasks sit in a **red-black tree** keyed by vruntime, and CFS picks the leftmost (smallest vruntime), so whoever has had the least weighted CPU runs next. It aims to run every task once within a target latency, with a minimum granularity per slice. Waking tasks get their vruntime clamped near the minimum so sleepers don't monopolise the CPU.

Since Linux 6.6 the fair class uses **EEVDF**: it computes a virtual deadline from each task's slice and picks the eligible task (lag ≥ 0) with the earliest deadline, improving latency control.`,
      },
      {
        q: "What is a multi-level feedback queue?",
        freq: "common",
        a: `Multiple ready queues with different priorities and quanta. Jobs start at the top. Using a full quantum demotes a job (it's probably CPU-bound); yielding early keeps its level (interactive). A periodic boost resets everyone to prevent starvation and adapt to behaviour changes. Accounting total time per level prevents gaming. It approximates SJF without knowing burst lengths.`,
      },
      {
        q: "What is the convoy effect?",
        freq: "occasional",
        a: `Under FCFS, one long CPU-bound process holds the CPU while many short I/O-bound processes queue behind it. They finish their I/O and sit idle waiting for the CPU, then all block on I/O while the device sits idle. Utilisation of both CPU and devices drops. Preemption and shortest-job-style policies avoid it.`,
      },
      {
        q: "Preemptive vs non-preemptive scheduling?",
        freq: "common",
        a: `**Non-preemptive**: once running, a task keeps the CPU until it blocks, yields or exits. Simpler, with no mid-operation interruption, but one misbehaving task can hog the CPU. **Preemptive**: the OS can take the CPU away on a timer interrupt or when a higher-priority task becomes ready. That gives responsiveness and fairness, but needs synchronisation, since kernel and user data can be interrupted mid-update. All general-purpose OSes are preemptive; the Linux kernel itself is preemptible too (configurable).`,
      },
    ],
    quiz: [
      {
        q: "Which algorithm minimises the average waiting time for a known set of jobs that all arrive at time 0?",
        options: ["FCFS", "Shortest Job First", "Round robin", "Priority by arrival"],
        answer: 1,
        explain: "SJF is provably optimal for average waiting time.",
      },
      {
        q: "Jobs A (burst 10) and B (burst 2) arrive at time 0, A first. Under FCFS, what is the average waiting time?",
        options: ["1", "5", "6", "10"],
        answer: 1,
        explain: "A waits 0, B waits 10. Average 5. Under SJF it would be (0 + 2) / 2 = 1.",
      },
      {
        q: "What happens if the round-robin quantum is made very large?",
        options: ["It becomes SJF", "It behaves like FCFS", "Starvation of short jobs is eliminated", "Context switches increase"],
        answer: 1,
        explain: "If every burst finishes within the quantum, RR is just FCFS.",
      },
      {
        q: "How does aging prevent starvation?",
        options: ["It kills old processes", "It raises the priority of processes that have waited a long time", "It shortens the quantum", "It moves processes to swap"],
        answer: 1,
        explain: "Waiting tasks gradually become more important until they run.",
      },
      {
        q: "In Linux's CFS, which runnable task runs next?",
        options: ["The one with the highest nice value", "The one with the smallest virtual runtime", "The oldest one", "A random one"],
        answer: 1,
        explain: "The leftmost node of the vruntime-ordered red-black tree.",
      },
      {
        q: "In an MLFQ, a job that uses its entire time slice is usually:",
        options: ["Moved up a level", "Moved down a level", "Killed", "Kept at the same level"],
        answer: 1,
        explain: "Using full slices suggests a CPU-bound job, so it's demoted to a lower-priority queue with a longer quantum.",
      },
      {
        q: "Two CPU-bound tasks share one core with nice 0 and nice 10. Roughly how is the CPU divided?",
        options: ["50/50", "About 90/10", "100/0", "About 60/40"],
        answer: 1,
        explain: "Weights 1024 vs 110 give about 9:1.",
      },
      {
        q: "Which scheduling class always beats normal tasks on Linux?",
        options: ["SCHED_BATCH", "SCHED_IDLE", "SCHED_FIFO / SCHED_RR (real-time)", "SCHED_OTHER with nice -20"],
        answer: 2,
        explain: "Real-time classes are checked before the fair class (only SCHED_DEADLINE is above them).",
      },
    ],
  },

  // ------------------------------------------------------------------ CONTEXT SWITCH
  {
    id: "os-context-switch",
    title: "Interrupts and context switches",
    tagline: "What really happens when the CPU switches from one program to another: the timer interrupt, saving registers, switching page tables, the cost, and voluntary vs involuntary switches.",
    difficulty: "intermediate",
    minutes: 25,
    visualizers: ["ctxswitch"],
    concept: `## Explain it like I'm 10 🧸
You're doing **maths homework** when your mum calls you for dinner. Before you go, you put a **bookmark** in the book and write down "I was on question 7, the answer so far is 42". After dinner your sister uses the desk for her **reading**, and she leaves her own bookmark. When you come back, you read your note and carry on **exactly** where you left off.

That's a **context switch**: saving one task's "where was I?" (the CPU registers) and loading another's. The CPU does it thousands of times per second, so fast that every program seems to run all the time.

## What triggers a switch
The kernel only gets control when something enters it, so a switch happens at one of these moments:
| Trigger | Kind | Example |
|---|---|---|
| The task **blocks** | Voluntary | \`read()\` on an empty socket, \`sleep\`, waiting for a lock (\`futex\`), \`waitpid\` |
| The task **yields** or **exits** | Voluntary | \`sched_yield()\`, \`exit()\` |
| The **timer interrupt** says the slice is used up | Involuntary | A CPU hog after its time slice |
| A **higher-priority task wakes up** | Involuntary | A disk interrupt wakes an interactive task |

\`/proc/<pid>/status\` counts both kinds (\`voluntary_ctxt_switches\`, \`nonvoluntary_ctxt_switches\`), and the first code sample shows the difference. Lots of *involuntary* switches means CPU contention; lots of *voluntary* ones means the task waits a lot (I/O, locks).

## Interrupt handling, step by step
1. A device (say the timer) raises an interrupt line. The CPU **finishes the current instruction**.
2. The CPU **switches to kernel mode**, saves the minimal state (PC, flags, stack pointer) on the kernel stack, and jumps to the handler the kernel registered in the **interrupt descriptor table** (IDT, on x86) or vector table (ARM).
3. The handler's **top half** does the urgent part fast, with that interrupt masked: acknowledge the device, grab the data, schedule the rest.
4. The **bottom half** (*softirq*, *tasklet*, *workqueue* on Linux) does the slower work later, with interrupts enabled: processing network packets, waking waiting tasks.
5. Before returning to user mode, the kernel checks the **need_resched** flag. If the timer said the slice is over, or a more important task woke up, it calls the **scheduler** instead of going straight back.

## The switch itself
When the scheduler picks a different task:
1. **Save** the current task's registers (general registers, stack pointer, PC, flags, FPU/SIMD state) into its PCB or kernel stack.
2. **Switch the address space** if the new task is in a different process: load the new page-table root (\`CR3\` on x86, \`TTBR0\` on ARM). With **ASIDs/PCIDs**, the TLB can keep entries for several address spaces; without them it must be flushed.
3. **Switch kernel stacks**, then **restore** the new task's registers.
4. **Return to user mode** in the new task, exactly where it was interrupted. It never knows it was paused.

Switching between two **threads of the same process** skips step 2, which is why it's cheaper.

## What a switch costs
- **Direct cost**: about **1–5 µs** on modern hardware (the second sample measured about 0.9 µs including a pipe read and write).
- **Indirect cost**, often bigger: the new task finds **cold caches and TLB**. Its data was evicted while others ran, so it suffers misses for a while. The more often you switch, the more this hurts.
- That's why too many threads slow a system down, why schedulers have a minimum slice length, and why event loops (one thread, many connections) and M:N runtimes are popular for high concurrency.

## Mode switch is not a context switch
A **mode switch** (user → kernel → user, e.g. for a system call) doesn't necessarily change which task runs: \`getpid()\` enters and leaves the kernel in the same task. A **context switch** changes the running task. Interviewers like this distinction.

## Signals: interrupts for processes
**Signals** are the software version of interrupts, delivered to a process:
- \`SIGINT\`: Ctrl-C
- \`SIGTERM\`: please stop
- \`SIGKILL\`: stop now; it can't be caught
- \`SIGSEGV\`: bad memory access
- \`SIGCHLD\`: a child changed state

The kernel delivers a pending signal when the target next returns to user mode, by pushing a frame that makes it run its handler. More in the IPC level.`,
    keyPoints: [
      "The kernel only runs when entered: system call, exception or interrupt",
      "Voluntary switches: the task blocks or yields; involuntary: the timer or a higher-priority wakeup preempts it",
      "Interrupt handlers split into a fast top half and a deferred bottom half",
      "A context switch saves registers, switches page tables (for processes) and kernel stacks, then restores the next task",
      "Direct cost is about microseconds; the cache and TLB pollution afterwards often costs more",
      "A mode switch (syscall) is not a context switch",
    ],
    code: [
      {
        title: "Voluntary vs involuntary context switches",
        linux: true,
        variants: [{ lang: "c", code: `// Voluntary context switches: the process gives up the CPU (it sleeps or waits for I/O).
// Involuntary ones: the scheduler takes the CPU away because the time slice ran out.
#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static void report(const char *who) {
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);
    printf("%-34s voluntary %s, involuntary %s\\n", who,
           ru.ru_nvcsw >= 100 ? ">= 100" : "few", ru.ru_nivcsw >= 20 ? "many" : "few");
    fflush(stdout);                               // _exit() skips stdio cleanup, so flush by hand
}

static void spin(double seconds) {
    struct timespec a, b;
    clock_gettime(CLOCK_MONOTONIC, &a);
    do clock_gettime(CLOCK_MONOTONIC, &b);
    while ((b.tv_sec - a.tv_sec) + (b.tv_nsec - a.tv_nsec) / 1e9 < seconds);
}

int main(void) {
    cpu_set_t one;
    CPU_ZERO(&one);
    CPU_SET(0, &one);
    sched_setaffinity(0, sizeof one, &one);       // everything on CPU 0, so the hogs must take turns

    if (fork() == 0) {                            // child 1: sleeps a lot -> gives up the CPU itself
        for (int i = 0; i < 200; i++) usleep(1000);
        report("sleeper (200 x 1 ms naps):");
        _exit(0);
    }
    waitpid(-1, NULL, 0);
    fflush(stdout);

    pid_t hog = fork();
    if (hog == 0) { spin(1.0); _exit(0); }        // child 2: a rival hog on the same CPU
    if (fork() == 0) {                            // child 3: also never sleeps
        spin(1.0);
        report("CPU hog sharing a core with another:");
        _exit(0);
    }
    while (wait(NULL) > 0) {}
    return 0;
}` }],
        explain: `- The whole program is pinned to CPU 0 with \`sched_setaffinity\`, so the processes must take turns.
- The **sleeper** naps 200 times. Each nap blocks it, so it gives up the CPU itself: 200+ **voluntary** switches and almost no involuntary ones.
- The **hog** never blocks, and it shares the core with another hog. The scheduler takes the CPU away whenever its slice ends: many **involuntary** switches.
- \`getrusage\` reads the counters (\`ru_nvcsw\`, \`ru_nivcsw\`). Check any process with \`grep ctxt /proc/<pid>/status\`, or the whole machine with \`vmstat 1\` (the \`cs\` column).
- \`fflush(stdout)\` before \`_exit\` matters: \`_exit\` skips the C library's cleanup, so buffered text would be lost (which is exactly what happened in the first version of this sample).`,
        output: `sleeper (200 x 1 ms naps):         voluntary >= 100, involuntary few
CPU hog sharing a core with another: voluntary few, involuntary many`,
      },
      {
        title: "Measuring a context switch with a pipe ping-pong",
        linux: true,
        note: "On the test machine stderr showed 0.87 µs per switch. Yours will differ.",
        variants: [{ lang: "c", code: `// Measure a context switch: two processes on ONE CPU bounce a byte back and forth through pipes.
// Every hop blocks one process and wakes the other, so each round trip is two switches.
#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

int main(void) {
    int ping[2], pong[2];
    if (pipe(ping) || pipe(pong)) return 1;
    cpu_set_t one;
    CPU_ZERO(&one);
    CPU_SET(0, &one);
    sched_setaffinity(0, sizeof one, &one);      // inherited by the child

    const int ROUNDS = 20000;
    char b = 'x';
    if (fork() == 0) {
        for (int i = 0; i < ROUNDS; i++) {
            if (read(ping[0], &b, 1) != 1 || write(pong[1], &b, 1) != 1) _exit(1);
        }
        _exit(0);
    }
    struct timespec a, z;
    clock_gettime(CLOCK_MONOTONIC, &a);
    for (int i = 0; i < ROUNDS; i++) {
        if (write(ping[1], &b, 1) != 1 || read(pong[0], &b, 1) != 1) return 1;
    }
    clock_gettime(CLOCK_MONOTONIC, &z);
    wait(NULL);
    double us = ((z.tv_sec - a.tv_sec) * 1e9 + (z.tv_nsec - a.tv_nsec)) / 1e3 / (2.0 * ROUNDS);
    printf("%d round trips = %d context switches\\n", ROUNDS, 2 * ROUNDS);
    printf("one switch (plus a pipe read and write) takes microseconds, not nanoseconds: %s\\n", us > 0.3 && us < 100 ? "yes" : "no");
    fprintf(stderr, "%.2f us per switch\\n", us);
    return 0;
}` }],
        explain: `- Two processes on **one CPU** pass a byte back and forth. Each \`read\` blocks until the other side writes, so every hop forces a switch to the other process.
- 20,000 round trips = 40,000 switches. Dividing the elapsed time gives the cost of one switch **plus** a small pipe read and write, so it's an upper bound.
- Run them on **different** cores and you'd measure cross-core wakeup latency instead, which is often slower.
- Tools like \`perf bench sched pipe\` do exactly this.`,
        output: `20000 round trips = 40000 context switches
one switch (plus a pipe read and write) takes microseconds, not nanoseconds: yes`,
      },
    ],
    interview: [
      {
        q: "What happens during a context switch?",
        freq: "very-common",
        a: `1. An entry into the kernel (timer interrupt, blocking syscall, or wakeup of a higher-priority task) leads the scheduler to choose another task.
2. The kernel **saves the current task's CPU context**: general registers, PC, SP, flags, FPU/vector state lazily.
3. If the next task is in another process, it **switches the address space** (loads the page-table root; the TLB is flushed or tagged with PCID/ASID).
4. It **switches the kernel stack** and restores the next task's registers.
5. It **returns to user mode** in the next task.

The direct cost is a few µs; the indirect cost is cold caches and TLB.`,
      },
      {
        q: "Why are context switches expensive, and how can you reduce them?",
        freq: "common",
        a: `Direct work (saving and restoring state, scheduler logic, kernel entry and exit, Spectre mitigations) plus indirect costs: cache, TLB and branch-predictor pollution, and lost instruction-level parallelism.

To reduce them: fewer runnable threads (pools sized to cores), event-driven I/O instead of a thread per connection, batching, avoiding lock contention (each blocked lock wait is a voluntary switch), CPU pinning for latency-critical work, and M:N runtimes whose user-space switches are about 100 ns.`,
      },
      {
        q: "What's the difference between a mode switch and a context switch?",
        freq: "common",
        a: `A **mode switch** changes the CPU privilege level (user ↔ kernel) within the same task, e.g. a system call, and returns to the same task. A **context switch** changes which task runs on the CPU, saving one task's state and loading another's. Every context switch involves kernel mode, but most mode switches don't cause a context switch.`,
      },
      {
        q: "What are top halves and bottom halves in interrupt handling?",
        freq: "occasional",
        a: `The **top half** is the actual interrupt handler: it runs immediately with that interrupt line masked, so it must be quick. It acknowledges the device, copies urgent data, and schedules further work. The **bottom half** (softirqs, tasklets, threaded IRQs, workqueues on Linux) runs later with interrupts enabled and does the heavy processing, e.g. running a received packet through the TCP/IP stack. This keeps interrupt latency low for everyone.`,
      },
      {
        q: "Voluntary vs involuntary context switches: what do they tell you about a process?",
        freq: "occasional",
        a: `**Voluntary** switches happen when the task blocks (I/O, lock wait, sleep). High numbers mean it's I/O- or lock-bound. **Involuntary** switches happen when the scheduler preempts it (slice expired, higher-priority wakeup). High numbers mean CPU contention: more runnable tasks than cores. Check them with \`/proc/<pid>/status\`, \`pidstat -w\`, or \`vmstat\`.`,
      },
    ],
    quiz: [
      {
        q: "Which of these causes an involuntary context switch?",
        options: ["The task calls read() on an empty pipe", "The task calls sleep(1)", "The timer interrupt ends the task's time slice", "The task exits"],
        answer: 2,
        explain: "Preemption by the scheduler is involuntary; blocking, sleeping and exiting are voluntary.",
      },
      {
        q: "What does a context switch between two threads of the same process NOT need to do?",
        options: ["Save registers", "Switch the page tables (address space)", "Run the scheduler", "Restore the stack pointer"],
        answer: 1,
        explain: "Threads share the address space, so there's no page-table switch.",
      },
      {
        q: "Roughly how long does a direct context switch take on modern hardware?",
        options: ["A few nanoseconds", "A few microseconds", "A few milliseconds", "About a second"],
        answer: 1,
        explain: "On the order of 1–5 µs, plus indirect cache effects.",
      },
      {
        q: "A system call like getpid() enters the kernel and returns. Is that a context switch?",
        options: ["Yes, always", "No, it's a mode switch within the same task", "Only on multicore CPUs", "Only if it fails"],
        answer: 1,
        explain: "The same task continues; only the privilege mode changed.",
      },
      {
        q: "Why do interrupt handlers defer heavy work to a bottom half?",
        options: ["To save memory", "To keep the time with interrupts masked short", "Because bottom halves run in user mode", "To avoid the scheduler"],
        answer: 1,
        explain: "Short top halves keep interrupt latency low.",
      },
    ],
  },

  // ------------------------------------------------------------------ PROJECT: SHELL
  {
    id: "os-project-shell",
    title: "Project: build your own Unix shell",
    tagline: "A real shell in C, step by step: a read loop, quoting and $VARIABLES, fork/exec/wait, built-ins, redirection, pipes, background jobs, signals and a test suite.",
    difficulty: "intermediate",
    minutes: 90,
    diagram: {
      title: "How minishell runs  cat log.txt | grep error > errors.txt",
      nodes: [
        { id: "user", label: "You", kind: "client", x: 100, y: 100, sub: "type a line" },
        { id: "parse", label: "parse.c", kind: "service", x: 330, y: 100, sub: "tokens → pipeline" },
        { id: "exec", label: "exec.c", kind: "control", x: 580, y: 100, sub: "pipe + fork per command" },
        { id: "cat", label: "child 1: cat", kind: "worker", x: 400, y: 330, sub: "stdout → pipe" },
        { id: "pipe", label: "pipe", kind: "queue", x: 620, y: 330, sub: "kernel buffer" },
        { id: "grep", label: "child 2: grep", kind: "worker", x: 840, y: 330, sub: "stdin ← pipe" },
        { id: "file", label: "errors.txt", kind: "storage", x: 840, y: 490, sub: "stdout → file" },
        { id: "wait", label: "waitpid", kind: "monitor", x: 830, y: 100, sub: "collect $?" },
      ],
      edges: [
        { from: "user", to: "parse" },
        { from: "parse", to: "exec" },
        { from: "exec", to: "cat", label: "fork + exec" },
        { from: "cat", to: "pipe", label: "write" },
        { from: "pipe", to: "grep", label: "read" },
        { from: "grep", to: "file", label: "dup2(fd, 1)" },
        { from: "exec", to: "grep", label: "fork + exec" },
        { from: "exec", to: "wait" },
        { from: "grep", to: "wait", dashed: true, label: "exits" },
      ],
      flows: [
        {
          name: "Running a pipeline",
          path: ["user", "parse", "exec", "cat", "pipe", "grep", "file"],
          steps: [
            "getline() reads the text; the tokenizer splits it into words and the operators | and >.",
            "The parser builds a pipeline: command 1 = [cat, log.txt]; command 2 = [grep, error] with outfile errors.txt.",
            "exec.c creates a pipe, forks child 1, which dup2()s the pipe's write end onto its stdout and execs cat.",
            "cat writes into the pipe. The kernel buffers up to 64 KiB, and blocks cat if grep falls behind.",
            "Child 2 (also forked by the shell) dup2()s the read end onto its stdin, so grep reads what cat wrote.",
            "Child 2 opened errors.txt and dup2()ed it onto stdout before exec, so grep's output lands in the file. The shell waits for both and stores grep's exit status in $?.",
          ],
        },
      ],
    },
    concept: `## What you'll build
**minishell**: a working Unix shell in about 450 lines of C. By the end it handles:
\`\`\`text
minishell$ echo "hello   world" 'no $expansion here' $HOME
minishell$ cd /var/log
minishell$ sort < names.txt | uniq -c | sort -rn | head -3 > top3.txt
minishell$ make -j8 > build.log &
minishell$ nosuchcmd
minishell$ echo $?                          # 127
\`\`\`

A shell is the best project for really understanding processes: **every** feature maps straight onto the system calls from the last levels.
| Shell feature | System calls |
|---|---|
| Run a program | \`fork\`, \`execvp\`, \`waitpid\` |
| \`$?\` | \`WEXITSTATUS\` / \`WTERMSIG\` from the status |
| \`cd\` | \`chdir\`: must run **in the shell itself** |
| \`> file\`, \`< file\`, \`>> file\` | \`open\` + \`dup2\` in the child before exec |
| \`a \\| b\` | \`pipe\` + \`dup2\` in each child, closing unused ends |
| \`&\` | don't wait; reap later with \`waitpid(-1, ..., WNOHANG)\` |
| Ctrl-C kills the program, not the shell | \`signal(SIGINT, SIG_IGN)\` in the shell, \`SIG_DFL\` in children |

## The design
- **\`shell.h\`**: the shared types. A \`struct command\` has \`argv\`, \`infile\`, \`outfile\` and \`append\`; a \`struct pipeline\` is up to 16 commands plus a \`background\` flag.
- **\`parse.c\`**: text → tokens → pipeline. Handles \`'single'\` and \`"double"\` quotes, backslash escapes, \`$NAME\` and \`$?\`, comments, and syntax errors.
- **\`exec.c\`**: runs a pipeline: built-ins in-process, everything else via fork/exec with pipes and redirections, then waits.
- **\`builtins.c\`**: \`cd\`, \`pwd\`, \`exit\`.
- **\`main.c\`**: the read-parse-run loop, the prompt, signals, and \`$?\`.
- **\`tests/run_tests.sh\`**: 17 end-to-end tests that pipe scripts into the shell and compare output.

Work through the steps on the **Build** tab. Each step shows complete files and what to type to try it. You need Linux, macOS or WSL with a C compiler and \`make\`.`,
    keyPoints: [
      "A shell is a loop: read a line, parse it, fork/exec/wait, repeat",
      "cd, exit (and anything that changes the shell's own state) must be built-ins",
      "Redirection and pipes are just open/pipe + dup2 in the child between fork and exec",
      "Close every unused pipe end, or readers never see end-of-file",
      "The shell ignores SIGINT; children reset it so Ctrl-C stops them",
      "Exit statuses: 0 ok, 127 not found, 126 not executable, 128+N killed by signal N, 2 syntax error",
    ],
    project: {
      summary: `You'll write **minishell**, a small but real Unix shell, in six steps. Each step compiles and runs, so you can try it as you go. The finished shell passes a 17-test suite covering quoting, variables, exit codes, built-ins, redirection, multi-stage pipes, syntax errors, signals and background jobs.`,
      skills: [
        "fork, execvp, waitpid and exit statuses",
        "File descriptors, open, dup2 and pipe",
        "Writing a tokenizer and parser by hand",
        "Signals: SIGINT, SIGCHLD and their dispositions across exec",
        "Memory ownership in C (who frees each string)",
        "Testing a CLI program from bash",
      ],
      tree: `minishell/
├── Makefile
├── src/
│   ├── shell.h        # types: struct command, struct pipeline
│   ├── main.c         # the read → parse → run loop, prompt, signals
│   ├── parse.c        # tokenizer + parser: quotes, $VARS, | < > >> &
│   ├── exec.c         # fork/exec/wait, pipes, redirection, background jobs
│   └── builtins.c     # cd, pwd, exit
└── tests/
    └── run_tests.sh   # 17 end-to-end tests`,
      steps: [
        {
          title: "1. A loop that reads lines",
          explain: `Every shell is a **read–eval–print loop**. Start with the loop and nothing else.
- \`getline(&line, &cap, stdin)\` reads a whole line of any length, growing the buffer with \`realloc\` as needed. It returns -1 at **end of input**: Ctrl-D in a terminal, or the end of a script piped in.
- Only print the **prompt** when a human is typing: \`isatty(STDIN_FILENO)\` is true for a terminal and false for a pipe. That's also how bash decides.
- The prompt has no newline, so \`fflush(stdout)\` makes it appear before we block in \`getline\`.
- The \`Makefile\` compiles every \`src/*.c\` with warnings as errors, so later steps only add files. (Makefile recipe lines must start with a **tab**.)`,
          files: [
            { path: "Makefile", lang: "make", code: `CC ?= cc
CFLAGS ?= -std=gnu17 -Wall -Wextra -Werror -O2 -g
SRC = $(wildcard src/*.c)

minishell: $(SRC) $(wildcard src/*.h)
	$(CC) $(CFLAGS) -o $@ $(SRC)

test: minishell
	bash tests/run_tests.sh ./minishell

clean:
	rm -f minishell

.PHONY: test clean` },
            { path: "src/main.c", lang: "c", code: `// minishell, step 1: a loop that reads lines until the end of input.
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
    int interactive = isatty(STDIN_FILENO);        // print prompts only for a human at a terminal
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);                        // the prompt has no newline, so flush it ourselves
        }
        ssize_t len = getline(&line, &cap, stdin); // reads one line, growing \`line\` as needed
        if (len < 0) break;                        // Ctrl-D or end of a script
        if (len > 0 && line[len - 1] == '\\n') line[len - 1] = '\\0';
        printf("you typed: [%s]\\n", line);
    }
    free(line);
    return 0;
}` },
          ],
          run: `make
printf 'ls -l\\necho  hi  there\\n' | ./minishell
./minishell        # type a few lines, then Ctrl-D`,
          output: `you typed: [ls -l]
you typed: [echo  hi  there]`,
        },
        {
          title: "2. Split the line into words",
          explain: `Programs receive their arguments as an **array of strings** (\`argv\`). The shell builds it, and decides what counts as one word:
- Spaces separate words: \`echo  hi\` has 2 words, not 4.
- \`'single quotes'\` keep everything literally, spaces and \`$\` included.
- \`"double quotes"\` keep spaces but still expand \`$HOME\` and \`$?\` (and allow \`\\"\` inside).
- A backslash escapes the next character: \`back\\ slash\` is one word.
- \`$NAME\` is replaced by the environment variable (\`getenv\`). An unset variable outside quotes **disappears**, while \`""\` is a real empty argument.
- \`#\` starts a comment.

The word is built in a small growable \`struct buf\`. Ownership is simple: \`parse_line\` \`malloc\`s each word, the command owns them, and \`free_command\` frees them. \`last_status\` (what \`$?\` prints) is declared in \`shell.h\` and defined in \`main.c\`.`,
          files: [
            { path: "src/shell.h", lang: "c", code: `// minishell: shared types and the functions each file provides.
#ifndef SHELL_H
#define SHELL_H

#include <stdbool.h>

#define MAX_ARGS 64

struct command {                 // one program and its arguments, e.g.  grep -i error log.txt
    char *argv[MAX_ARGS + 1];    // argv[0] is the program name; the list ends with NULL
    int argc;
};

extern int last_status;          // exit status of the last command: what $? expands to

// parse.c: split a line into words. Returns the number of words, or -1 with *err set.
int parse_line(const char *line, struct command *c, const char **err);
void free_command(struct command *c);

#endif` },
            { path: "src/parse.c", lang: "c", code: `// parse.c (step 2): split a line into words, handling quotes, backslashes and $VARIABLES.
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "shell.h"

struct buf {                     // a growable string
    char *s;
    size_t len, cap;
};

static void put(struct buf *b, char c) {
    if (b->len + 2 > b->cap) {
        b->cap = b->cap ? b->cap * 2 : 32;
        b->s = realloc(b->s, b->cap);
    }
    b->s[b->len++] = c;
    b->s[b->len] = '\\0';
}

static void put_str(struct buf *b, const char *s) {
    while (*s) put(b, *s++);
}

// *p points at '$'. Append the value of $? or $NAME to b and move *p past the name.
static void expand(struct buf *b, const char **p) {
    const char *s = *p + 1;
    if (*s == '?') {
        char num[16];
        snprintf(num, sizeof num, "%d", last_status);
        put_str(b, num);
        *p = s + 1;
        return;
    }
    if (!isalpha((unsigned char)*s) && *s != '_') {  // a lone '$' is just a dollar sign
        put(b, '$');
        *p = s;
        return;
    }
    char name[128];
    size_t n = 0;
    while ((isalnum((unsigned char)*s) || *s == '_') && n < sizeof name - 1) name[n++] = *s++;
    name[n] = '\\0';
    const char *value = getenv(name);
    if (value) put_str(b, value);
    *p = s;
}

void free_command(struct command *c) {
    for (int i = 0; i < c->argc; i++) free(c->argv[i]);
    memset(c, 0, sizeof *c);
}

int parse_line(const char *p, struct command *c, const char **err) {
    memset(c, 0, sizeof *c);
    while (*p) {
        if (isspace((unsigned char)*p)) {
            p++;
            continue;
        }
        if (*p == '#') break;                        // a comment runs to the end of the line
        if (c->argc == MAX_ARGS) {
            *err = "too many arguments";
            goto fail;
        }
        struct buf b = {0};
        bool quoted = false;
        while (*p && !isspace((unsigned char)*p)) {
            if (*p == '\\'') {                        // '...': everything inside is literal
                const char *end = strchr(p + 1, '\\'');
                if (!end) {
                    free(b.s);
                    *err = "unclosed '";
                    goto fail;
                }
                for (p++; p < end; p++) put(&b, *p);
                p++;
                quoted = true;
            } else if (*p == '"') {                  // "...": literal, except $ expansion and \\" \\\\ \\$
                for (p++; *p && *p != '"';) {
                    if (*p == '\\\\' && strchr("\\"\\\\$", p[1]) && p[1]) {
                        put(&b, p[1]);
                        p += 2;
                    } else if (*p == '$') {
                        expand(&b, &p);
                    } else {
                        put(&b, *p++);
                    }
                }
                if (!*p) {
                    free(b.s);
                    *err = "unclosed \\"";
                    goto fail;
                }
                p++;
                quoted = true;
            } else if (*p == '\\\\' && p[1]) {         // \\x: take the next character literally
                put(&b, p[1]);
                p += 2;
            } else if (*p == '$') {
                expand(&b, &p);
            } else {
                put(&b, *p++);
            }
        }
        if (!b.s && quoted) put(&b, '\\0'), b.len = 0;   // "" is an empty argument...
        if (b.s) c->argv[c->argc++] = b.s;              // ...but an unset $VAR vanishes
    }
    return c->argc;
fail:
    free_command(c);
    return -1;
}` },
            { path: "src/main.c", lang: "c", code: `// minishell, step 2: split each line into words and show them.
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "shell.h"

int last_status = 0;

int main(void) {
    bool interactive = isatty(STDIN_FILENO);
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);
        }
        if (getline(&line, &cap, stdin) < 0) break;
        struct command cmd;
        const char *err = NULL;
        int n = parse_line(line, &cmd, &err);
        if (n < 0) {
            fprintf(stderr, "minishell: %s\\n", err);
            continue;
        }
        for (int i = 0; i < n; i++) printf("word %d: [%s]\\n", i, cmd.argv[i]);
        free_command(&cmd);
    }
    free(line);
    return 0;
}` },
          ],
          run: `make
./minishell <<'EOF'
echo "two   spaces" 'single $HOME' $HOME back\\ slash $NOPE "" # a comment
EOF`,
          output: `word 0: [echo]
word 1: [two   spaces]
word 2: [single $HOME]
word 3: [/home/you]
word 4: [back slash]
word 5: []`,
        },
        {
          title: "3. Run programs: fork, execvp, waitpid",
          explain: `Now the heart of every shell, exactly as in the processes level:
1. \`fork()\`: clone the shell.
2. In the child, \`execvp(argv[0], argv)\`: search \`$PATH\` and replace the child with the program. If it returns, it failed: print \`command not found\` and \`_exit(127)\` (or 126 for "found but not executable").
3. In the shell, \`waitpid(pid, &status, 0)\`, then turn the status into a number for \`$?\`: the exit code, or **128 + signal number** if a signal killed it.

\`fflush(stdout)\` before forking stops the child from inheriting (and later re-printing) text still sitting in the shell's stdio buffer. The child uses \`_exit\`, not \`exit\`, for the same reason.`,
          files: [
            { path: "src/shell.h", lang: "c", code: `// minishell: shared types and the functions each file provides.
#ifndef SHELL_H
#define SHELL_H

#include <stdbool.h>

#define MAX_ARGS 64

struct command {                 // one program and its arguments, e.g.  grep -i error log.txt
    char *argv[MAX_ARGS + 1];    // argv[0] is the program name; the list ends with NULL
    int argc;
};

extern int last_status;          // exit status of the last command: what $? expands to

// parse.c: split a line into words. Returns the number of words, or -1 with *err set.
int parse_line(const char *line, struct command *c, const char **err);
void free_command(struct command *c);

// exec.c: run the command as a new process and return its exit status.
int run_command(struct command *c);

#endif` },
            { path: "src/exec.c", lang: "c", code: `// exec.c (step 3): start a program in a child process and wait for it.
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#include "shell.h"

static int exit_code(int status) {
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);   // killed by a signal
    return 1;
}

int run_command(struct command *c) {
    fflush(stdout);                                // don't let the child inherit unflushed output
    pid_t pid = fork();                            // 1. clone the shell
    if (pid < 0) {
        perror("minishell: fork");
        return 1;
    }
    if (pid == 0) {                                // 2. the child becomes the program
        execvp(c->argv[0], c->argv);               //    searches $PATH; only returns if it failed
        int e = errno;
        fprintf(stderr, "minishell: %s: %s\\n", c->argv[0], e == ENOENT ? "command not found" : strerror(e));
        _exit(e == ENOENT ? 127 : 126);
    }
    int status;                                    // 3. the shell waits for it to finish
    if (waitpid(pid, &status, 0) < 0) {
        perror("minishell: waitpid");
        return 1;
    }
    return exit_code(status);
}` },
            { path: "src/main.c", lang: "c", code: `// minishell, step 3: run each line as a program.
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "shell.h"

int last_status = 0;

int main(void) {
    bool interactive = isatty(STDIN_FILENO);
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);
        }
        if (getline(&line, &cap, stdin) < 0) break;
        struct command cmd;
        const char *err = NULL;
        int n = parse_line(line, &cmd, &err);
        if (n < 0) {
            fprintf(stderr, "minishell: %s\\n", err);
            last_status = 2;                       // bash uses 2 for syntax errors
            continue;
        }
        if (n == 0) continue;                      // empty line or comment
        last_status = run_command(&cmd);
        free_command(&cmd);
    }
    free(line);
    return 0;
}` },
          ],
          run: `make
./minishell <<'EOF'
echo hello from a real program
ls /no/such/dir
echo "ls said $?"
nosuchcmd --flag
echo "status $?"
EOF`,
          output: `hello from a real program
ls: cannot access '/no/such/dir': No such file or directory
ls said 2
minishell: nosuchcmd: command not found
status 127`,
        },
        {
          title: "4. Built-ins: cd, pwd and exit",
          explain: `Try \`cd /tmp\` in step 3: it "works" and changes nothing. That's because \`/usr/bin/cd\` (if it exists) runs in a **child**, and a child can't change its parent's current directory. Each process has its own.

So the shell must run some commands **itself**, without forking:
- \`cd [dir]\` calls \`chdir()\` (no argument means \`$HOME\`), and reports errors with \`strerror(errno)\`.
- \`pwd\` calls \`getcwd()\`.
- \`exit [code]\` tells the main loop to stop. With no argument it exits with \`$?\` (exactly bash's rule), and the code is masked to 0–255 because that's all an exit status can hold.

Other real built-ins work the same way for the same reason: \`export\`, \`unset\`, \`source\`, \`alias\`, \`ulimit\`, \`umask\`, \`jobs\`/\`fg\`/\`bg\`.`,
          files: [
            { path: "src/shell.h", lang: "c", code: `// minishell: shared types and the functions each file provides.
#ifndef SHELL_H
#define SHELL_H

#include <stdbool.h>

#define MAX_ARGS 64

struct command {                 // one program and its arguments, e.g.  grep -i error log.txt
    char *argv[MAX_ARGS + 1];    // argv[0] is the program name; the list ends with NULL
    int argc;
};

extern int last_status;          // exit status of the last command: what $? expands to

// parse.c: split a line into words. Returns the number of words, or -1 with *err set.
int parse_line(const char *line, struct command *c, const char **err);
void free_command(struct command *c);

// exec.c: run the command and return its exit status.
int run_command(struct command *c, bool *should_exit);

// builtins.c: commands the shell runs itself instead of starting a program.
bool is_builtin(const char *name);
int run_builtin(struct command *c, bool *should_exit);

#endif` },
            { path: "src/builtins.c", lang: "c", code: `// builtins.c: commands that must run inside the shell process itself.
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "shell.h"

bool is_builtin(const char *name) {
    return strcmp(name, "cd") == 0 || strcmp(name, "pwd") == 0 || strcmp(name, "exit") == 0;
}

int run_builtin(struct command *c, bool *should_exit) {
    const char *name = c->argv[0];
    if (strcmp(name, "cd") == 0) {                 // a child process can't change OUR directory
        const char *dir = c->argc > 1 ? c->argv[1] : getenv("HOME");
        if (!dir) {
            fprintf(stderr, "minishell: cd: HOME not set\\n");
            return 1;
        }
        if (chdir(dir) < 0) {
            fprintf(stderr, "minishell: cd: %s: %s\\n", dir, strerror(errno));
            return 1;
        }
        return 0;
    }
    if (strcmp(name, "pwd") == 0) {
        char buf[4096];
        if (!getcwd(buf, sizeof buf)) {
            perror("minishell: pwd");
            return 1;
        }
        printf("%s\\n", buf);
        return 0;
    }
    *should_exit = true;                           // exit [code]
    return c->argc > 1 ? atoi(c->argv[1]) & 0xff : last_status;
}` },
            { path: "src/exec.c", lang: "c", code: `// exec.c (step 4): run built-ins in the shell, and other programs in a child process.
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#include "shell.h"

static int exit_code(int status) {
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);   // killed by a signal
    return 1;
}

int run_command(struct command *c, bool *should_exit) {
    if (is_builtin(c->argv[0])) return run_builtin(c, should_exit);   // no fork for cd, pwd, exit
    fflush(stdout);                                // don't let the child inherit unflushed output
    pid_t pid = fork();                            // 1. clone the shell
    if (pid < 0) {
        perror("minishell: fork");
        return 1;
    }
    if (pid == 0) {                                // 2. the child becomes the program
        execvp(c->argv[0], c->argv);               //    searches $PATH; only returns if it failed
        int e = errno;
        fprintf(stderr, "minishell: %s: %s\\n", c->argv[0], e == ENOENT ? "command not found" : strerror(e));
        _exit(e == ENOENT ? 127 : 126);
    }
    int status;                                    // 3. the shell waits for it to finish
    if (waitpid(pid, &status, 0) < 0) {
        perror("minishell: waitpid");
        return 1;
    }
    return exit_code(status);
}` },
            { path: "src/main.c", lang: "c", code: `// minishell, step 4: programs plus the built-ins cd, pwd and exit.
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "shell.h"

int last_status = 0;

int main(void) {
    bool interactive = isatty(STDIN_FILENO);
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);
        }
        if (getline(&line, &cap, stdin) < 0) break;
        struct command cmd;
        const char *err = NULL;
        int n = parse_line(line, &cmd, &err);
        if (n < 0) {
            fprintf(stderr, "minishell: %s\\n", err);
            last_status = 2;                       // bash uses 2 for syntax errors
            continue;
        }
        if (n == 0) continue;                      // empty line or comment
        bool should_exit = false;
        last_status = run_command(&cmd, &should_exit);
        free_command(&cmd);
        if (should_exit) break;
    }
    free(line);
    return last_status;
}` },
          ],
          run: `make
./minishell <<'EOF'
pwd
cd /usr/share
pwd
cd /nowhere
cd
pwd
exit 7
echo never printed
EOF
echo "exit status $?"`,
          output: `/home/you/minishell
/usr/share
minishell: cd: /nowhere: No such file or directory
/home/you
exit status 7`,
        },
        {
          title: "5. Redirection and pipes",
          explain: `The tokenizer now recognises the operators \`| < > >> &\`, and the parser groups words into a **pipeline** of commands, each with optional \`infile\`/\`outfile\`. It catches syntax errors like \`| wc\` or \`echo >\` (status 2, like bash).

**Redirection** (\`redirect()\` in \`exec.c\`): in the child, after fork and before exec, \`open\` the file and \`dup2(fd, STDOUT_FILENO)\`. Now fd 1 refers to the file, and the program writes there without knowing. \`>\` uses \`O_TRUNC\`, \`>>\` uses \`O_APPEND\`, and \`<\` replaces fd 0.

**Pipes**: for \`a | b | c\` the shell creates a pipe between each pair of neighbours and forks one child per command:
- child *i* \`dup2\`s the previous pipe's **read end** onto stdin, and its own pipe's **write end** onto stdout,
- then **closes every pipe fd** it doesn't use. If any process (including the shell!) keeps a write end open, the reader never gets end-of-file and the pipeline hangs forever. The parent closes its copies right after each fork.

The shell waits for **every** child and reports the **last** command's status (\`false | true\` is 0), like bash without \`pipefail\`. A built-in in a pipeline (\`pwd | tr / _\`) runs in a child; a lone built-in runs in the shell with its redirections applied and then undone using saved copies of fd 0 and 1.

\`&\` is already parsed; step 6 makes it work.`,
          files: [
            { path: "src/shell.h", lang: "c", code: `// minishell: shared types and the functions each file provides.
#ifndef SHELL_H
#define SHELL_H

#include <stdbool.h>

#define MAX_ARGS 64
#define MAX_CMDS 16

struct command {                 // one program in a pipeline, e.g.  grep -i error < log.txt
    char *argv[MAX_ARGS + 1];    // argv[0] is the program name; the list ends with NULL
    int argc;
    char *infile;                // < file   (NULL if none)
    char *outfile;               // > file or >> file   (NULL if none)
    bool append;                 // true for >>
};

struct pipeline {                // commands joined by |, e.g.  cat log | grep error | wc -l
    struct command cmds[MAX_CMDS];
    int ncmds;
    bool background;             // the line ended with &
};

extern int last_status;          // exit status of the last command: what $? expands to

// parse.c: turn a line of text into a pipeline. Returns the number of commands (0 for an empty
// line) or -1 with *err set to a message.
int parse_line(const char *line, struct pipeline *pl, const char **err);
void free_pipeline(struct pipeline *pl);

// exec.c: run a parsed pipeline and return its exit status.
int run_pipeline(struct pipeline *pl, bool *should_exit);
void reap_background(void);

// builtins.c: commands the shell runs itself instead of starting a program.
bool is_builtin(const char *name);
int run_builtin(struct command *c, bool *should_exit);

#endif` },
            { path: "src/parse.c", lang: "c", code: `// parse.c: split a line into tokens (words and operators), then group them into commands.
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "shell.h"

enum kind { WORD, PIPE, IN, OUT, APPEND, AMP };
struct token {
    enum kind kind;
    char *text;                  // only for WORD
};

struct buf {                     // a growable string
    char *s;
    size_t len, cap;
};

static void put(struct buf *b, char c) {
    if (b->len + 2 > b->cap) {
        b->cap = b->cap ? b->cap * 2 : 32;
        b->s = realloc(b->s, b->cap);
    }
    b->s[b->len++] = c;
    b->s[b->len] = '\\0';
}

static void put_str(struct buf *b, const char *s) {
    while (*s) put(b, *s++);
}

// *p points at '$'. Append the value of $? or $NAME to b and move *p past the name.
static void expand(struct buf *b, const char **p) {
    const char *s = *p + 1;
    if (*s == '?') {
        char num[16];
        snprintf(num, sizeof num, "%d", last_status);
        put_str(b, num);
        *p = s + 1;
        return;
    }
    if (!isalpha((unsigned char)*s) && *s != '_') {  // a lone '$' is just a dollar sign
        put(b, '$');
        *p = s;
        return;
    }
    char name[128];
    size_t n = 0;
    while ((isalnum((unsigned char)*s) || *s == '_') && n < sizeof name - 1) name[n++] = *s++;
    name[n] = '\\0';
    const char *value = getenv(name);
    if (value) put_str(b, value);
    *p = s;
}

static int tokenize(const char *p, struct token *toks, int max, const char **err) {
    int n = 0;
    while (*p) {
        if (isspace((unsigned char)*p)) {
            p++;
            continue;
        }
        if (*p == '#') break;                        // a comment runs to the end of the line
        if (n == max) {
            *err = "line too long";
            goto fail;
        }
        if (strchr("|<>&", *p)) {                    // an operator
            enum kind k = *p == '|' ? PIPE : *p == '<' ? IN : *p == '&' ? AMP : OUT;
            if (p[0] == '>' && p[1] == '>') {
                k = APPEND;
                p++;
            }
            p++;
            toks[n++] = (struct token){k, NULL};
            continue;
        }
        struct buf b = {0};                          // a word: read until space or an operator
        bool quoted = false;
        while (*p && !isspace((unsigned char)*p) && !strchr("|<>&", *p)) {
            if (*p == '\\'') {                        // '...': everything inside is literal
                const char *end = strchr(p + 1, '\\'');
                if (!end) {
                    free(b.s);
                    *err = "unclosed '";
                    goto fail;
                }
                for (p++; p < end; p++) put(&b, *p);
                p++;
                quoted = true;
            } else if (*p == '"') {                  // "...": literal, except $ expansion and \\" \\\\ \\$
                for (p++; *p && *p != '"';) {
                    if (*p == '\\\\' && strchr("\\"\\\\$", p[1]) && p[1]) {
                        put(&b, p[1]);
                        p += 2;
                    } else if (*p == '$') {
                        expand(&b, &p);
                    } else {
                        put(&b, *p++);
                    }
                }
                if (!*p) {
                    free(b.s);
                    *err = "unclosed \\"";
                    goto fail;
                }
                p++;
                quoted = true;
            } else if (*p == '\\\\' && p[1]) {         // \\x: take the next character literally
                put(&b, p[1]);
                p += 2;
            } else if (*p == '$') {
                expand(&b, &p);
            } else {
                put(&b, *p++);
            }
        }
        if (!b.s && quoted) put(&b, '\\0'), b.len = 0;   // "" is an empty argument...
        if (b.s) toks[n++] = (struct token){WORD, b.s};  // ...but an unset $VAR vanishes
    }
    return n;
fail:
    for (int i = 0; i < n; i++) free(toks[i].text);
    return -1;
}

void free_pipeline(struct pipeline *pl) {
    for (int i = 0; i < pl->ncmds; i++) {
        struct command *c = &pl->cmds[i];
        for (int j = 0; j < c->argc; j++) free(c->argv[j]);
        free(c->infile);
        free(c->outfile);
    }
    memset(pl, 0, sizeof *pl);
}

int parse_line(const char *line, struct pipeline *pl, const char **err) {
    struct token toks[256];
    memset(pl, 0, sizeof *pl);
    int n = tokenize(line, toks, 256, err);
    if (n <= 0) return n;                             // -1 error, 0 empty line
    struct command *c = &pl->cmds[0];
    pl->ncmds = 1;
    for (int i = 0; i < n; i++) {
        switch (toks[i].kind) {
        case WORD:
            if (c->argc == MAX_ARGS) {
                *err = "too many arguments";
                goto fail;
            }
            c->argv[c->argc++] = toks[i].text;       // the command now owns the string
            toks[i].text = NULL;
            break;
        case PIPE:
            if (c->argc == 0) {
                *err = "syntax error near '|'";
                goto fail;
            }
            if (pl->ncmds == MAX_CMDS) {
                *err = "too many commands in one pipeline";
                goto fail;
            }
            c = &pl->cmds[pl->ncmds++];
            break;
        case IN:
        case OUT:
        case APPEND: {
            if (i + 1 == n || toks[i + 1].kind != WORD) {
                *err = "syntax error: missing file name after < or >";
                goto fail;
            }
            char **slot = toks[i].kind == IN ? &c->infile : &c->outfile;
            free(*slot);                              // the last redirection wins, like in bash
            *slot = toks[i + 1].text;
            toks[i + 1].text = NULL;
            if (toks[i].kind != IN) c->append = toks[i].kind == APPEND;
            i++;
            break;
        }
        case AMP:
            if (i != n - 1) {
                *err = "syntax error: & must end the line";
                goto fail;
            }
            pl->background = true;
            break;
        }
    }
    if (c->argc == 0) {
        *err = pl->ncmds > 1 ? "syntax error: missing command after '|'" : "syntax error: missing command";
        goto fail;
    }
    return pl->ncmds;
fail:
    for (int i = 0; i < n; i++) free(toks[i].text);
    free_pipeline(pl);
    return -1;
}` },
            { path: "src/exec.c", lang: "c", code: `// exec.c (step 5): start the programs of a pipeline, wire up pipes and redirections, and wait for them.
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#include "shell.h"

// Point stdin/stdout at the files named by < and > (used in children, and around built-ins).
static int redirect(struct command *c) {
    if (c->infile) {
        int fd = open(c->infile, O_RDONLY);
        if (fd < 0) {
            fprintf(stderr, "minishell: %s: %s\\n", c->infile, strerror(errno));
            return -1;
        }
        dup2(fd, STDIN_FILENO);                    // fd 0 now refers to the file
        close(fd);
    }
    if (c->outfile) {
        int flags = O_WRONLY | O_CREAT | (c->append ? O_APPEND : O_TRUNC);
        int fd = open(c->outfile, flags, 0644);
        if (fd < 0) {
            fprintf(stderr, "minishell: %s: %s\\n", c->outfile, strerror(errno));
            return -1;
        }
        dup2(fd, STDOUT_FILENO);
        close(fd);
    }
    return 0;
}

static int exit_code(int status) {
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);   // e.g. 130 after Ctrl-C (SIGINT = 2)
    return 1;
}

// A built-in on its own runs in the shell process, with its redirections applied temporarily.
static int run_builtin_here(struct command *c, bool *should_exit) {
    int saved_in = dup(STDIN_FILENO), saved_out = dup(STDOUT_FILENO);
    int status = redirect(c) < 0 ? 1 : run_builtin(c, should_exit);
    fflush(stdout);
    dup2(saved_in, STDIN_FILENO);
    dup2(saved_out, STDOUT_FILENO);
    close(saved_in);
    close(saved_out);
    return status;
}

int run_pipeline(struct pipeline *pl, bool *should_exit) {
    if (pl->ncmds == 1 && !pl->background && is_builtin(pl->cmds[0].argv[0]))
        return run_builtin_here(&pl->cmds[0], should_exit);

    pid_t pids[MAX_CMDS];
    int prev_read = -1;                            // read end of the pipe from the previous command
    for (int i = 0; i < pl->ncmds; i++) {
        struct command *c = &pl->cmds[i];
        int fds[2] = {-1, -1};
        if (i < pl->ncmds - 1 && pipe(fds) < 0) {  // fds[0] = read end, fds[1] = write end
            perror("minishell: pipe");
            return 1;
        }
        fflush(stdout);                            // don't let the child inherit unflushed output
        pid_t pid = fork();
        if (pid < 0) {
            perror("minishell: fork");
            return 1;
        }
        if (pid == 0) {                            // ---- child ----
            if (prev_read != -1) {                 // read from the previous command
                dup2(prev_read, STDIN_FILENO);
                close(prev_read);
            }
            if (fds[1] != -1) {                    // write into the next command
                dup2(fds[1], STDOUT_FILENO);
                close(fds[1]);
                close(fds[0]);
            }
            if (redirect(c) < 0) _exit(1);         // < and > override the pipe, like in bash
            if (is_builtin(c->argv[0])) {          // e.g.  pwd | cat
                bool ignored;
                int status = run_builtin(c, &ignored);
                fflush(stdout);
                _exit(status);
            }
            execvp(c->argv[0], c->argv);           // only returns if it failed
            int e = errno;
            fprintf(stderr, "minishell: %s: %s\\n", c->argv[0], e == ENOENT ? "command not found" : strerror(e));
            _exit(e == ENOENT ? 127 : 126);
        }
        pids[i] = pid;                             // ---- parent ----
        if (prev_read != -1) close(prev_read);     // close our copies, or readers never see EOF
        if (fds[1] != -1) close(fds[1]);
        prev_read = fds[0];
    }
    int status = 0;
    for (int i = 0; i < pl->ncmds; i++)            // wait for every stage; report the last one
        waitpid(pids[i], i == pl->ncmds - 1 ? &status : NULL, 0);
    return exit_code(status);
}` },
            { path: "src/main.c", lang: "c", code: `// minishell, step 5: pipelines and redirection.
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "shell.h"

int last_status = 0;

int main(void) {
    bool interactive = isatty(STDIN_FILENO);       // print prompts only for a human at a terminal
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);
        }
        if (getline(&line, &cap, stdin) < 0) {     // Ctrl-D or end of a script
            if (interactive) printf("\\n");
            break;
        }
        struct pipeline pl;
        const char *err = NULL;
        int n = parse_line(line, &pl, &err);
        if (n < 0) {
            fprintf(stderr, "minishell: %s\\n", err);
            last_status = 2;                       // bash uses 2 for syntax errors
            continue;
        }
        if (n == 0) continue;                      // empty line or comment
        bool should_exit = false;
        last_status = run_pipeline(&pl, &should_exit);
        free_pipeline(&pl);
        if (should_exit) break;
    }
    free(line);
    return last_status;
}` },
          ],
          run: `make
./minishell <<'EOF'
printf "pear\\napple\\nfig\\napple\\n" > /tmp/fruit.txt
sort < /tmp/fruit.txt | uniq -c | sort -rn | head -n 2
echo extra >> /tmp/fruit.txt
grep -c . < /tmp/fruit.txt
cat /tmp/fruit.txt | tr a-z A-Z | grep P > /tmp/upper.txt
cat /tmp/upper.txt
EOF`,
          output: `      2 apple
      1 pear
5
PEAR
APPLE
APPLE`,
        },
        {
          title: "6. Signals, background jobs and a test suite",
          explain: `**Ctrl-C.** The terminal sends \`SIGINT\` to every process in the foreground group, the shell included. A shell that died on Ctrl-C would be useless, so \`main\` sets \`SIGINT\` and \`SIGQUIT\` to \`SIG_IGN\`. But *ignored* dispositions survive \`exec\`, so every child resets them to \`SIG_DFL\` before exec, or Ctrl-C couldn't stop \`sleep 100\` either. (Handled ones, set with a function, are reset by exec automatically.)

**Background jobs.** With \`&\`, the shell prints \`[bg] PID\` and doesn't wait. Before each prompt, \`reap_background()\` calls \`waitpid(-1, &status, WNOHANG)\` in a loop to collect finished jobs without blocking. Skip it and every background job becomes a zombie.

**Tests.** \`tests/run_tests.sh\` pipes small scripts into the shell and compares *everything* it prints (stdout and stderr) with the expected text. That covers quoting, \`$?\`, not-found, \`cd\`, redirection, two- and three-stage pipes, built-ins in pipes, syntax errors, comments, death by signal (\`143 = 128 + SIGTERM\`), a background job and \`exit 3\`. Run \`make test\`.

**Where to go next** is in the extensions list: \`;\` and \`&&\`/\`||\`, job control with process groups (\`setpgid\`, \`tcsetpgrp\`, \`fg\`, \`bg\`), \`export\`, globbing (\`*.c\` via \`glob()\`), \`2>\` and \`2>&1\`, command history with GNU readline, and scripts with \`if\`/\`while\`.`,
          files: [
            { path: "src/exec.c", lang: "c", code: `// exec.c: start the programs of a pipeline, wire up pipes and redirections, and wait for them.
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#include "shell.h"

// Point stdin/stdout at the files named by < and > (used in children, and around built-ins).
static int redirect(struct command *c) {
    if (c->infile) {
        int fd = open(c->infile, O_RDONLY);
        if (fd < 0) {
            fprintf(stderr, "minishell: %s: %s\\n", c->infile, strerror(errno));
            return -1;
        }
        dup2(fd, STDIN_FILENO);                    // fd 0 now refers to the file
        close(fd);
    }
    if (c->outfile) {
        int flags = O_WRONLY | O_CREAT | (c->append ? O_APPEND : O_TRUNC);
        int fd = open(c->outfile, flags, 0644);
        if (fd < 0) {
            fprintf(stderr, "minishell: %s: %s\\n", c->outfile, strerror(errno));
            return -1;
        }
        dup2(fd, STDOUT_FILENO);
        close(fd);
    }
    return 0;
}

static int exit_code(int status) {
    if (WIFEXITED(status)) return WEXITSTATUS(status);
    if (WIFSIGNALED(status)) return 128 + WTERMSIG(status);   // e.g. 130 after Ctrl-C (SIGINT = 2)
    return 1;
}

// A built-in on its own runs in the shell process, with its redirections applied temporarily.
static int run_builtin_here(struct command *c, bool *should_exit) {
    int saved_in = dup(STDIN_FILENO), saved_out = dup(STDOUT_FILENO);
    int status = redirect(c) < 0 ? 1 : run_builtin(c, should_exit);
    fflush(stdout);
    dup2(saved_in, STDIN_FILENO);
    dup2(saved_out, STDOUT_FILENO);
    close(saved_in);
    close(saved_out);
    return status;
}

int run_pipeline(struct pipeline *pl, bool *should_exit) {
    if (pl->ncmds == 1 && !pl->background && is_builtin(pl->cmds[0].argv[0]))
        return run_builtin_here(&pl->cmds[0], should_exit);

    pid_t pids[MAX_CMDS];
    int prev_read = -1;                            // read end of the pipe from the previous command
    for (int i = 0; i < pl->ncmds; i++) {
        struct command *c = &pl->cmds[i];
        int fds[2] = {-1, -1};
        if (i < pl->ncmds - 1 && pipe(fds) < 0) {  // fds[0] = read end, fds[1] = write end
            perror("minishell: pipe");
            return 1;
        }
        fflush(stdout);                            // don't let the child inherit unflushed output
        pid_t pid = fork();
        if (pid < 0) {
            perror("minishell: fork");
            return 1;
        }
        if (pid == 0) {                            // ---- child ----
            signal(SIGINT, SIG_DFL);               // the shell ignores Ctrl-C; programs shouldn't
            signal(SIGQUIT, SIG_DFL);
            if (prev_read != -1) {                 // read from the previous command
                dup2(prev_read, STDIN_FILENO);
                close(prev_read);
            }
            if (fds[1] != -1) {                    // write into the next command
                dup2(fds[1], STDOUT_FILENO);
                close(fds[1]);
                close(fds[0]);
            }
            if (redirect(c) < 0) _exit(1);         // < and > override the pipe, like in bash
            if (is_builtin(c->argv[0])) {          // e.g.  pwd | cat
                bool ignored;
                int status = run_builtin(c, &ignored);
                fflush(stdout);
                _exit(status);
            }
            execvp(c->argv[0], c->argv);           // only returns if it failed
            int e = errno;
            fprintf(stderr, "minishell: %s: %s\\n", c->argv[0], e == ENOENT ? "command not found" : strerror(e));
            _exit(e == ENOENT ? 127 : 126);
        }
        pids[i] = pid;                             // ---- parent ----
        if (prev_read != -1) close(prev_read);     // close our copies, or readers never see EOF
        if (fds[1] != -1) close(fds[1]);
        prev_read = fds[0];
    }
    if (pl->background) {
        printf("[bg] %d\\n", (int)pids[pl->ncmds - 1]);
        return 0;
    }
    int status = 0;
    for (int i = 0; i < pl->ncmds; i++)            // wait for every stage; report the last one
        waitpid(pids[i], i == pl->ncmds - 1 ? &status : NULL, 0);
    return exit_code(status);
}

// Collect background jobs that have finished, without blocking.
void reap_background(void) {
    int status;
    pid_t pid;
    while ((pid = waitpid(-1, &status, WNOHANG)) > 0)
        fprintf(stderr, "[done] %d exit %d\\n", (int)pid, exit_code(status));
}` },
            { path: "src/main.c", lang: "c", code: `// minishell: a small Unix shell. Reads a line, parses it, runs it, repeats.
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "shell.h"

int last_status = 0;

int main(void) {
    signal(SIGINT, SIG_IGN);                       // Ctrl-C should stop the running program, not us
    signal(SIGQUIT, SIG_IGN);
    bool interactive = isatty(STDIN_FILENO);       // print prompts only for a human at a terminal
    char *line = NULL;
    size_t cap = 0;
    for (;;) {
        reap_background();
        if (interactive) {
            printf("minishell$ ");
            fflush(stdout);
        }
        if (getline(&line, &cap, stdin) < 0) {     // Ctrl-D or end of a script
            if (interactive) printf("\\n");
            break;
        }
        struct pipeline pl;
        const char *err = NULL;
        int n = parse_line(line, &pl, &err);
        if (n < 0) {
            fprintf(stderr, "minishell: %s\\n", err);
            last_status = 2;                       // bash uses 2 for syntax errors
            continue;
        }
        if (n == 0) continue;                      // empty line or comment
        bool should_exit = false;
        last_status = run_pipeline(&pl, &should_exit);
        free_pipeline(&pl);
        if (should_exit) break;
    }
    free(line);
    return last_status;
}` },
            { path: "tests/run_tests.sh", lang: "bash", code: `#!/usr/bin/env bash
# Feed little scripts to minishell on stdin and compare everything it prints with what we expect.
set -u
SH=\${1:-./minishell}
pass=0
fail=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

check() {  # check NAME INPUT EXPECTED
    local actual
    actual=$(printf '%s\\n' "$2" | "$SH" 2>&1)
    if [[ "$actual" == "$3" ]]; then
        pass=$((pass + 1))
        echo "ok   $1"
    else
        fail=$((fail + 1))
        printf 'FAIL %s\\n  expected: %q\\n  actual:   %q\\n' "$1" "$3" "$actual"
    fi
}

check "runs a program"          'echo hello world'                       'hello world'
check "quotes keep spaces"      "echo 'a   b' \\"c   d\\" e\\\\ f"           'a   b c   d e f'
check "single quotes are literal" "echo '\\$HOME'"                        '$HOME'
check "variables expand"        'echo "home is $HOME"'                   "home is $HOME"
check "exit status in \\$?"      $'false\\necho $?\\ntrue\\necho $?'          $'1\\n0'
check "command not found"       $'nosuchcmd\\necho $?'                     $'minishell: nosuchcmd: command not found\\n127'
check "cd and pwd"              $'cd /usr\\npwd\\ncd /no/such\\necho $?'     $'/usr\\nminishell: cd: /no/such: No such file or directory\\n1'
check "redirect > >> <"         "echo one > $tmp/f"$'\\n'"echo two >> $tmp/f"$'\\n'"grep -c . < $tmp/f" '2'
check "two-stage pipe"          "printf 'b\\\\na\\\\nc\\\\n' | sort"           $'a\\nb\\nc'
check "three-stage pipe"        "printf 'x\\\\ny\\\\nx\\\\n' | sort | uniq | grep -c ." '2'
check "pipe status is the last" $'false | true\\necho $?'                 '0'
check "built-in in a pipe"      'pwd | tr / _'                            "$(pwd | tr / _)"
check "syntax errors"           $'| wc\\necho $?\\necho >'                  $'minishell: syntax error near \\'|\\'\\n2\\nminishell: syntax error: missing file name after < or >'
check "comments and blank lines" $'# nothing\\n\\necho done'               'done'
check "killed by a signal"      $'sh -c \\'kill -TERM $$\\'\\necho $?'      '143'

out=$(printf 'sleep 0.5 &\\necho right away\\n' | "$SH" 2>/dev/null)
if [[ "$out" =~ ^\\[bg\\]\\ [0-9]+$'\\n'right\\ away$ ]]; then pass=$((pass + 1)); echo "ok   background job"; else fail=$((fail + 1)); echo "FAIL background job: $out"; fi

printf 'exit 3\\n' | "$SH"
if [[ $? -eq 3 ]]; then pass=$((pass + 1)); echo "ok   exit code"; else fail=$((fail + 1)); echo "FAIL exit code"; fi

echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]` },
          ],
          run: `make test
./minishell        # try: sleep 30   then Ctrl-C   (the shell survives)`,
          output: `ok   runs a program
ok   quotes keep spaces
ok   single quotes are literal
ok   variables expand
ok   exit status in $?
ok   command not found
ok   cd and pwd
ok   redirect > >> <
ok   two-stage pipe
ok   three-stage pipe
ok   pipe status is the last
ok   built-in in a pipe
ok   syntax errors
ok   comments and blank lines
ok   killed by a signal
ok   background job
ok   exit code
17 passed, 0 failed`,
        },
      ],
      extensions: [
        "Sequencing: support `a ; b`, `a && b` and `a || b` (parse a list of pipelines with operators between them)",
        "stderr redirection: `2> file`, `2>> file` and `2>&1` (dup2 onto fd 2)",
        "Job control: put each pipeline in its own process group with setpgid, hand the terminal over with tcsetpgrp, and add jobs, fg and bg",
        "export NAME=value and unset as built-ins (setenv / unsetenv), plus `NAME=value cmd` for one command",
        "Globbing: expand *.c and file?.txt with glob(3) before exec",
        "Line editing and history with GNU readline or linenoise",
        "A heredoc (<<EOF) and command substitution $(...) using a pipe and a nested parse",
        "Run the tests under AddressSanitizer (make CFLAGS='-g -fsanitize=address') to prove there are no leaks",
      ],
      verify: `make CC="$CC_CMD" && bash tests/run_tests.sh ./minishell`,
      linux: true,
    },
    interview: [
      {
        q: "How does a shell implement a pipe between two commands?",
        freq: "very-common",
        a: `1. Call \`pipe(fds)\` to get a read end and a write end.
2. Fork the first child: \`dup2(fds[1], 1)\`, close both pipe fds, exec the first program.
3. Fork the second child: \`dup2(fds[0], 0)\`, close both, exec the second.
4. The parent **closes both ends** and waits for both children.

Closing unused ends is essential: the reader only sees EOF when **every** write end is closed. If the parent kept one open, \`grep\` would hang forever.`,
      },
      {
        q: "Why must cd be a shell built-in?",
        freq: "very-common",
        a: `The current working directory is a per-process attribute. An external \`cd\` program would run in a child, call \`chdir\` there, and exit, leaving the shell's directory unchanged. Anything that must modify the shell process itself (\`cd\`, \`exit\`, \`export\`, \`source\`, \`umask\`, \`ulimit\`) has to be a built-in.`,
      },
      {
        q: "How does output redirection (cmd > file) work?",
        freq: "common",
        a: `In the child, after \`fork\` and before \`exec\`: \`fd = open("file", O_WRONLY | O_CREAT | O_TRUNC, 0644)\`, then \`dup2(fd, 1)\` so file descriptor 1 now refers to the file, then \`close(fd)\`, then exec. The program writes to fd 1 as usual and the output lands in the file. It never knows. \`>>\` uses \`O_APPEND\`; \`<\` opens read-only and dup2s onto fd 0.`,
      },
      {
        q: "Why doesn't Ctrl-C kill the shell, but does kill the program it's running?",
        freq: "common",
        a: `The terminal driver sends SIGINT to the **foreground process group**. Job-control shells put each pipeline in its own process group and make it the foreground group (\`tcsetpgrp\`), so only the job gets the signal. Simple shells ignore SIGINT themselves (\`SIG_IGN\`) and reset it to \`SIG_DFL\` in children before exec, because an ignored disposition would otherwise be inherited across exec.`,
      },
      {
        q: "What does $? contain after a command is killed by a signal?",
        freq: "occasional",
        a: `\`128 + signal number\`: 130 for SIGINT (Ctrl-C), 137 for SIGKILL, 143 for SIGTERM, 139 for SIGSEGV. The shell computes it from \`waitpid\`'s status with \`WIFSIGNALED\` and \`WTERMSIG\`. Normal exits give \`WEXITSTATUS\` (0–255); not found is 127 and not executable is 126.`,
      },
    ],
    quiz: [
      {
        q: "A pipeline `producer | consumer` hangs after the producer exits. What's the most likely bug?",
        options: ["The pipe buffer is too small", "Some process (often the shell) still holds the pipe's write end open", "The consumer forgot to call fork", "dup2 was called twice"],
        answer: 1,
        explain: "The reader only sees EOF when every write end is closed.",
      },
      {
        q: "Where does a shell call dup2() to implement `ls > out.txt`?",
        options: ["In the parent, before fork", "In the child, between fork and exec", "In the parent, after waitpid", "Inside ls"],
        answer: 1,
        explain: "Changing fds in the child affects only the new program, not the shell.",
      },
      {
        q: "Which command must be a built-in?",
        options: ["ls", "echo", "cd", "grep"],
        answer: 2,
        explain: "cd changes the shell's own working directory. (echo is often a built-in for speed, but needn't be.)",
      },
      {
        q: "A shell ignores SIGINT with SIG_IGN and then execs a program without changing it. What happens when you press Ctrl-C?",
        options: ["The program dies", "The program also ignores it, because SIG_IGN survives exec", "The shell dies", "The kernel restarts the program"],
        answer: 1,
        explain: "Ignored dispositions are inherited across exec; handled ones are reset to default.",
      },
      {
        q: "What exit status does a shell report when the command isn't found?",
        options: ["1", "2", "126", "127"],
        answer: 3,
        explain: "127 = not found; 126 = found but not executable.",
      },
      {
        q: "What does reap_background() use to collect finished background jobs without blocking?",
        options: ["wait()", "waitpid(-1, &status, WNOHANG)", "kill(pid, 0)", "pause()"],
        answer: 1,
        explain: "WNOHANG returns immediately if no child has exited.",
      },
    ],
  },
];
