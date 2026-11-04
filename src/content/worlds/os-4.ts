import type { Lesson } from "../types";

// Operating Systems, part 4: memory.

export const osPart4: Lesson[] = [
  // ------------------------------------------------------------------ ADDRESS SPACE
  {
    id: "os-memory",
    part: "Part 4 · Memory",
    title: "Memory and the address space",
    tagline: "RAM vs addresses, the layout of a process (text, data, bss, heap, mmap, stack), stack frames and stack overflow, brk and mmap, and why every process thinks it owns all of memory.",
    difficulty: "beginner",
    minutes: 30,
    visualizers: ["cppmemory"],
    concept: `## Explain it like I'm 10 🧸
**RAM** is a gigantic street of **numbered mailboxes**. Each mailbox holds one byte, and its number is its **address**. A program reads and writes memory by saying "mailbox 4,096, please".

But if every program used the **real** mailbox numbers, programs would trample each other's mail, and a buggy game could read your password manager's memory. So the operating system plays a trick: it gives **every program its own pretend street**, numbered from 0 to an enormous number. Each program thinks it owns the whole street. Behind the scenes, the OS and the CPU quietly **translate** each pretend number to a real mailbox. That trick is **virtual memory**, and it's the topic of the next level.

This level is about what a program's pretend street looks like: which parts hold the code, the variables, the heap and the stack.

## The layout of a process
Every Linux process sees the same general layout, from low addresses to high:
\`\`\`text
high addresses   ┌──────────────────────────┐
                 │ kernel (you can't touch) │
                 ├──────────────────────────┤
                 │ stack  ↓ grows down      │  local variables, return addresses
                 │                          │
                 │ memory maps (mmap)       │  shared libraries, big mallocs, mapped files
                 │                          │
                 │ heap   ↑ grows up        │  malloc / new
                 ├──────────────────────────┤
                 │ .bss   zeroed globals    │
                 │ .data  initialised globals│
                 │ .rodata constants        │
                 │ .text  your code         │
low addresses    └──────────────────────────┘
\`\`\`
| Region | Holds | Permissions | Size |
|---|---|---|---|
| **.text** | Machine code | read + execute | Fixed when the program loads |
| **.rodata** | String literals, \`const\` tables | read only | Fixed |
| **.data** | Globals with a starting value (\`int x = 42;\`) | read + write | Fixed |
| **.bss** | Globals that start at zero (\`int y;\`) | read + write | Fixed; takes no space in the file |
| **Heap** | \`malloc\`, \`new\`, Python and Java objects | read + write | Grows on demand (\`brk\`) |
| **mmap area** | Shared libraries (libc), large \`malloc\`s, memory-mapped files, thread stacks | varies | Grows on demand |
| **Stack** | Function call frames: locals, arguments, return addresses | read + write | 8 MiB limit by default on Linux |

**Why the separate permissions?** Security. Code is **not writable** (so an attacker can't patch it), and the stack and heap are **not executable** (the NX bit), so injected bytes can't run as code. Memory regions are protected **page by page** by the hardware.

**ASLR** (address space layout randomisation) shifts each region by a random amount every run, so attackers can't guess where things are. That's why our sample prints the **order** of the regions, not their addresses: the addresses change on every run.

On 64-bit Linux the user half of the address space is **128 TiB**, and the gap between the heap and the stack is usually **terabytes** of unused, unmapped addresses. Unmapped addresses cost nothing.

## The stack, one frame at a time
Every function call pushes a **stack frame**: the return address, saved registers, arguments and local variables. Returning pops it. That's why local variables vanish when a function returns, and why returning a pointer to a local is a bug.
- The stack is **fast**: allocating a frame is one instruction (move the stack pointer).
- It's **small**: 8 MiB for the main thread on Linux (\`ulimit -s\`), often 1–2 MiB for other threads.
- Below the stack sits a **guard page** with no permissions. Recursing too deep runs into it, and the kernel sends **SIGSEGV**: a **stack overflow**. Our sample catches it after using 99% of the 8 MiB.

## The heap: brk and mmap
\`malloc\` is a **library function**, not a system call. It asks the kernel for big chunks and hands out small pieces:
- **\`brk\`/\`sbrk\`** moves the end of the heap up (the "program break"). glibc uses it for small allocations.
- **\`mmap\`** maps a fresh region anywhere. glibc uses it for big allocations (128 KiB and up, by default), which get their own mapping and go straight back to the kernel on \`free\`.

Allocation strategies and fragmentation have a whole level of their own later in this part.

## Stack vs heap
| | Stack | Heap |
|---|---|---|
| Allocation | Automatic (function call) | Explicit (\`malloc\`/\`new\`) or by a garbage collector |
| Speed | Very fast (move a pointer) | Slower (find a free block) |
| Lifetime | Until the function returns | Until freed or collected |
| Size | Small (MiBs) | Large (up to RAM + swap) |
| Bugs | Overflow from deep recursion or huge locals | Leaks, use-after-free, double free, fragmentation |

## Seeing it for real
\`\`\`bash
cat /proc/self/maps            # every region of the cat process, with permissions
pmap -x $$                     # the regions of your shell, with sizes
ulimit -s                      # the stack limit in KiB
size ./program                 # sizes of text, data and bss in a binary
\`\`\`
The visualizer (from the C++ track) steps through a program line by line, showing what lands on the stack, what lands on the heap, and how pointers connect them.`,
    keyPoints: [
      "Each process sees its own virtual address space; the OS and MMU map it onto real RAM",
      "Layout from low to high: text, rodata, data, bss, heap (grows up), mmap area, stack (grows down)",
      "Regions have page-level permissions: code is read+execute, data and stack are read+write but not executable",
      "ASLR randomises region addresses on every run to make attacks harder",
      "Stack frames hold locals and return addresses; deep recursion hits the guard page and causes a stack overflow",
      "malloc is a library: small blocks come from the brk heap, big ones from their own mmap",
    ],
    code: [
      {
        title: "Where does everything live?",
        linux: true,
        variants: [{ lang: "c", code: `// Where things live in a process's memory: code, constants, globals, heap, memory maps and the stack.
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>

int initialised_global = 42;          // .data: globals with a starting value
int zeroed_global;                    // .bss: globals that start at zero
const char message[] = "hello";       // .rodata: read-only constants

static void some_code(void) {}

struct place {
    const char *name;
    const void *addr;
};

int main(void) {
    int local = 7;                                            // the stack
    int *heap = malloc(sizeof *heap);                         // the heap
    void *mapped = mmap(NULL, 1 << 20, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    struct place p[] = {
        {"stack     (local variable)", &local},
        {"mmap      (mapped memory)", mapped},
        {"heap      (malloc)", heap},
        {".bss      (zeroed globals)", &zeroed_global},
        {".data     (initialised globals)", &initialised_global},
        {".rodata   (constants)", message},
        {".text     (code)", (const void *)some_code},
    };
    int n = sizeof p / sizeof p[0];
    for (int i = 0; i < n; i++)                               // sort by address, low to high
        for (int j = i + 1; j < n; j++)
            if (p[j].addr < p[i].addr) {
                struct place t = p[i];
                p[i] = p[j];
                p[j] = t;
            }
    printf("from LOW addresses to HIGH addresses:\\n");
    for (int i = 0; i < n; i++) printf("  %d. %s\\n", i + 1, p[i].name);
    printf("gap between heap and stack: more than 1 TiB of unused address space: %s\\n",
           (const char *)&local - (const char *)heap > (1L << 40) ? "yes" : "no");
    free(heap);
    munmap(mapped, 1 << 20);
    return 0;
}` }],
        explain: `- Each variable is a different kind: a local (stack), a \`malloc\` (heap), an \`mmap\` (memory map), a zeroed global (\`.bss\`), an initialised global (\`.data\`), a string constant (\`.rodata\`) and a function (\`.text\`).
- The program sorts their **addresses** and prints the order. The addresses change on every run because of ASLR, but the order doesn't: code at the bottom, the stack at the top.
- The last line shows how roomy a 64-bit address space is: more than a terabyte of nothing between the heap and the stack.`,
        output: `from LOW addresses to HIGH addresses:
  1. .text     (code)
  2. .rodata   (constants)
  3. .data     (initialised globals)
  4. .bss      (zeroed globals)
  5. heap      (malloc)
  6. mmap      (mapped memory)
  7. stack     (local variable)
gap between heap and stack: more than 1 TiB of unused address space: yes`,
      },
      {
        title: "Overflowing the stack (and catching it)",
        linux: true,
        variants: [{ lang: "c", code: `// How big is the stack? Recurse until it overflows, and catch the crash on a spare stack.
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>
#include <unistd.h>

static char *stack_top;
static volatile size_t deepest;
static volatile int stop;

static int dive(int depth) {
    volatile char frame[1024];               // every call takes about 1 KiB of stack
    frame[0] = (char)depth;
    size_t used = (size_t)(stack_top - (char *)frame);
    if (used > deepest) deepest = used;
    if (stop) return 0;
    return dive(depth + 1) + frame[0];       // not a tail call, so every frame stays
}

static void on_segv(int sig) {
    (void)sig;
    struct rlimit rl;
    getrlimit(RLIMIT_STACK, &rl);
    double used = deepest / 1024.0 / 1024.0, limit = rl.rlim_cur / 1024.0 / 1024.0;
    char msg[200];
    int n = snprintf(msg, sizeof msg,
                     "stack limit (ulimit -s): %.0f MiB\\n"
                     "SIGSEGV after using %.0f%% of it: the guard page below the stack was hit\\n",
                     limit, used / limit > 0.95 ? 99.0 : used / limit * 100);
    write(1, msg, n);                        // write(), not printf: we're inside a signal handler
    _exit(0);
}

int main(void) {
    char here;
    stack_top = &here;
    static char spare[64 * 1024];            // the signal handler needs a stack of its own
    stack_t ss = {.ss_sp = spare, .ss_size = sizeof spare};
    sigaltstack(&ss, NULL);
    struct sigaction sa = {.sa_handler = on_segv, .sa_flags = SA_ONSTACK};
    sigaction(SIGSEGV, &sa, NULL);
    return dive(0);
}` }],
        explain: `- \`dive\` calls itself forever, and every call reserves a 1 KiB array. \`volatile\` and the \`+ frame[0]\` after the call stop the compiler from optimising the frames away.
- After about 8,000 calls the stack reaches the **guard page**, and the kernel sends SIGSEGV.
- A signal handler normally runs on the same stack, which is full. \`sigaltstack\` gives it a **spare stack**, and \`SA_ONSTACK\` tells the kernel to use it.
- Inside a signal handler only async-signal-safe functions are allowed, which is why it formats into a buffer, calls \`write\` and exits with \`_exit\`.
- Real programs avoid this by converting deep recursion to a loop with an explicit stack, or by raising the limit (\`ulimit -s\`, or a bigger stack for a thread via \`pthread_attr_setstacksize\`).`,
        output: `stack limit (ulimit -s): 8 MiB
SIGSEGV after using 99% of it: the guard page below the stack was hit`,
      },
      {
        title: "Small malloc from the heap, big malloc from mmap",
        linux: true,
        variants: [{ lang: "c", code: `// glibc's malloc serves small blocks from the heap (grown with brk) and big ones straight from mmap.
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *region_of(uintptr_t addr) {
    static char name[300];
    char line[512];
    snprintf(name, sizeof name, "nothing: not mapped any more");
    FILE *f = fopen("/proc/self/maps", "r");
    while (fgets(line, sizeof line, f)) {
        unsigned long lo, hi;
        char path[256] = "";
        if (sscanf(line, "%lx-%lx %*s %*s %*s %*s %255s", &lo, &hi, path) >= 2 && addr >= lo && addr < hi) {
            snprintf(name, sizeof name, "%s", path[0] ? path : "its own anonymous mapping (mmap)");
            break;
        }
    }
    fclose(f);
    return name;
}

int main(void) {
    char *small = malloc(100);
    char *big = malloc(1 << 20);
    memset(small, 1, 100);
    memset(big, 1, 1 << 20);
    uintptr_t s = (uintptr_t)small, b = (uintptr_t)big;
    printf("malloc(100)   lives in: %s\\n", region_of(s));
    printf("malloc(1 MiB) lives in: %s\\n", region_of(b));
    printf("the big block starts 16 bytes into a page (after malloc's header): %s\\n", (b & 4095) == 16 ? "yes" : "no");
    free(big);
    free(small);
    printf("after free, the big block's address maps to: %s\\n", region_of(b));
    printf("after free, the small block's address maps to: %s (kept for reuse)\\n", region_of(s));
    return 0;
}` }],
        explain: `- \`region_of\` finds the line of \`/proc/self/maps\` whose address range contains a pointer, and prints its name.
- 100 bytes come from \`[heap]\`, the region \`brk\` grows. 1 MiB is above glibc's mmap threshold (128 KiB), so it gets **its own mapping**, and the pointer sits 16 bytes into a page, right after malloc's bookkeeping header.
- After \`free\`, the big block is **unmapped** and its memory goes straight back to the kernel. The small block's memory stays in the heap, ready for the next \`malloc\`. That's why a process's memory use often doesn't shrink after freeing lots of small objects.`,
        output: `malloc(100)   lives in: [heap]
malloc(1 MiB) lives in: its own anonymous mapping (mmap)
the big block starts 16 bytes into a page (after malloc's header): yes
after free, the big block's address maps to: nothing: not mapped any more
after free, the small block's address maps to: [heap] (kept for reuse)`,
      },
    ],
    interview: [
      {
        q: "Describe the memory layout of a process.",
        freq: "very-common",
        a: `From low to high addresses: **text** (code, read+execute), **rodata** (constants), **data** (initialised globals), **bss** (zero-initialised globals), the **heap** (dynamic allocation, grows up via brk), the **mmap region** (shared libraries, large allocations, file mappings, thread stacks), and the **stack** (call frames, grows down), with the kernel's portion at the top, inaccessible from user mode. ASLR randomises the bases, and each region has page-level permissions.`,
      },
      {
        q: "What's the difference between stack and heap memory?",
        freq: "very-common",
        a: `The **stack** holds function frames; allocation is automatic and very fast (adjusting the stack pointer), lifetime is tied to the call, and it's small (8 MiB main thread on Linux). The **heap** holds dynamically allocated objects with lifetimes beyond a single call; it's larger, managed by malloc/free or a GC, slower to allocate, and prone to leaks and fragmentation. Each thread has its own stack; all threads share the heap.`,
      },
      {
        q: "What causes a stack overflow and how do you fix it?",
        freq: "common",
        a: `Using more stack than the limit: usually unbounded or very deep recursion, or huge local arrays. The stack runs into a guard page and the process gets SIGSEGV (Java throws \`StackOverflowError\`, Python raises \`RecursionError\` earlier, at its own limit). Fixes: convert recursion to iteration with an explicit stack, use tail calls where guaranteed, move big buffers to the heap, or raise the limit (\`ulimit -s\`, thread stack size).`,
      },
      {
        q: "Is malloc a system call?",
        freq: "common",
        a: `No. \`malloc\` is a C library function that manages memory inside the process. It occasionally asks the kernel for more with \`brk\`/\`sbrk\` (extend the heap) or \`mmap\` (new regions; glibc uses this for allocations of 128 KiB or more), and splits those chunks into blocks. Most \`malloc\` and \`free\` calls never enter the kernel. Allocators like jemalloc, tcmalloc and mimalloc replace glibc's for better multithreaded performance.`,
      },
      {
        q: "What is ASLR and why does it matter?",
        freq: "occasional",
        a: `Address Space Layout Randomisation places the stack, heap, mmap region, shared libraries and (for PIE binaries) the executable at random offsets each run. Exploits often need to know where code or data lives (to jump to it or overwrite it); randomisation turns a reliable exploit into a guess. It's paired with **NX** (non-executable stack and heap) and **stack canaries**. Attackers counter it by leaking an address first, which is why info-leak bugs matter.`,
      },
    ],
    quiz: [
      {
        q: "Where does a local variable inside a function live?",
        options: ["The heap", "The stack", ".data", ".text"],
        answer: 1,
        explain: "Locals live in the function's stack frame and disappear when it returns.",
      },
      {
        q: "A global `int counter;` with no initial value goes in which section?",
        options: [".text", ".rodata", ".bss", "The stack"],
        answer: 2,
        explain: "Zero-initialised globals go in .bss, which takes no space in the executable file.",
      },
      {
        q: "Why is the .text section not writable?",
        options: ["To save memory", "So bugs and attackers can't modify the program's code", "Because disks are read-only", "It is writable"],
        answer: 1,
        explain: "Code pages are read+execute only; data pages are read+write but not executable.",
      },
      {
        q: "What does the stack hit when a recursion goes too deep?",
        options: ["The heap's free list", "A guard page with no permissions, causing SIGSEGV", "The kernel's scheduler", "Nothing; it grows forever"],
        answer: 1,
        explain: "The guard page turns a silent overwrite into a clean crash.",
      },
      {
        q: "glibc's malloc(1 MiB) typically gets its memory how?",
        options: ["From the stack", "From its own mmap mapping", "From .bss", "From swap only"],
        answer: 1,
        explain: "Large allocations (≥ 128 KiB by default) are mmapped directly and returned to the kernel on free.",
      },
      {
        q: "Why do the printed addresses of the heap and stack change every run?",
        options: ["A bug in printf", "ASLR randomises the layout", "The disk is fragmented", "The CPU is too fast"],
        answer: 1,
        explain: "Randomising addresses makes memory-corruption exploits much harder.",
      },
    ],
  },

  // ------------------------------------------------------------------ VIRTUAL MEMORY
  {
    id: "os-virtual-memory",
    title: "Virtual memory and paging",
    tagline: "Pages and frames, page tables, the MMU, multi-level tables, the TLB, page faults, demand paging, copy-on-write, swapping, huge pages and mmap.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["paging"],
    complexity: [
      { op: "TLB hit", time: "~1 cycle", note: "The translation is cached; most accesses never walk the tables" },
      { op: "TLB miss, page walk", time: "~10–100 ns", note: "4 memory reads on x86-64 (fewer if the page-table entries are cached)" },
      { op: "Minor page fault", time: "~0.1–1 µs", note: "The page is in RAM (or just needs zeroing); the kernel maps it" },
      { op: "Major page fault", time: "~0.1 ms (SSD) to 10 ms (HDD)", note: "The page must be read from disk or swap" },
    ],
    concept: `## Explain it like I'm 10 🧸
Think of a giant **library** where every reader gets their own **personal catalogue**. Your catalogue says "my book 1 is on shelf 523, my book 2 is on shelf 17". Someone else's catalogue says "my book 1 is on shelf 88". You both ask for "book 1" and get different books, and you can't even *name* someone else's book, because it isn't in your catalogue.
- Your **pretend address** is the **virtual address**.
- The **real shelf** is the **physical address**.
- The **catalogue** is the **page table**.
- The **librarian** who looks things up super fast is the **MMU** (memory management unit), a part of the CPU.

Books come in fixed-size boxes called **pages** (usually 4 KiB). Not every book needs to be on a shelf: rarely-read boxes can wait in the **basement** (the disk). If you ask for one, the librarian says "one moment!", fetches it, and you carry on: that's a **page fault**.

## Pages and frames
Virtual memory is cut into **pages**, and physical RAM into **frames** of the same size (4 KiB on x86 and most ARM systems). Any page can go into any frame, so a process's memory doesn't need to be contiguous in RAM. That kills **external fragmentation** of physical memory.

A virtual address splits into two parts:
\`\`\`text
virtual address  0x00403A2C
                 └─ page number (VPN) = 0x00403 ─┘└ offset = 0xA2C ┘
physical address = frame number from the page table + the same offset
\`\`\`
With 4 KiB pages the low **12 bits** are the offset (2¹² = 4096). The offset never changes; only the page number is translated.

## Page table entries
Each entry maps one page and carries flag bits the hardware checks on every access:
| Bit | Meaning |
|---|---|
| **Present** | The page is in RAM. If not, accessing it causes a page fault |
| **Read/Write** | Writable? Writing a read-only page causes a protection fault |
| **User/Supervisor** | May user mode touch it, or only the kernel? |
| **No-execute (NX)** | Code may not run from this page |
| **Accessed** | Set by hardware when read; page replacement uses it |
| **Dirty** | Set by hardware when written; a dirty page must be saved before it's evicted |

## Multi-level page tables
A flat table for a 32-bit address space needs 2²⁰ entries × 4 bytes = **4 MiB per process**, even for a tiny program. For 64-bit it would be absurd. So page tables are **trees**: the top level points to second-level tables, and so on. Only the parts that are actually used exist.
- 32-bit x86: 2 levels (10 + 10 bits, then 12 bits of offset).
- x86-64: **4 levels** (9 + 9 + 9 + 9 + 12 = 48-bit addresses), or 5 levels for 57-bit addresses on huge servers.
- The CPU register **CR3** (x86) or **TTBR0** (ARM) holds the address of the top-level table. Switching processes means loading a different value into it.

Our Python sample walks a two-level table by hand. The cost: a TLB miss on x86-64 means **four extra memory reads** before the real one.

## The TLB: the translation cache
Walking the tree on every access would make memory 5× slower. The **TLB** (translation lookaside buffer) caches recent translations: typically 64 entries in the first level and 1,000–2,000 in the second. Programs access memory with lots of **locality**, so the TLB hit rate is usually above 99%.
- On a **context switch** to another process, the TLB's entries belong to the old address space. Old CPUs **flushed** the TLB; modern ones tag entries with an address-space ID (**PCID** on x86, **ASID** on ARM) so they can stay.
- When the kernel changes a mapping, other cores might still have the old translation cached, so it sends them an interrupt to invalidate it: a **TLB shootdown**, a hidden cost of \`munmap\` in multithreaded programs.
- **Huge pages** (2 MiB or 1 GiB) cover far more memory per TLB entry. Databases and JVMs use them for big heaps; Linux's **transparent huge pages** (THP) does it automatically.

## Page faults
When the MMU can't translate an address, it raises a **page fault** exception and the kernel decides what it means:
| Kind | Cause | What the kernel does |
|---|---|---|
| **Minor** | The page is valid but not mapped yet: first touch of new memory, a shared library already in the page cache, copy-on-write | Grab a frame (zero it, or copy it), update the page table, retry the instruction. Microseconds |
| **Major** | The page's data is on disk: swapped out, or part of a memory-mapped file not yet read | Start disk I/O, put the process to sleep, run someone else, retry when the data arrives. Milliseconds |
| **Invalid** | No mapping at all, or the wrong permission | Send **SIGSEGV**: the famous segmentation fault |

## Demand paging, overcommit and copy-on-write
Linux is lazy, on purpose:
- **Demand paging**: \`malloc\` or \`mmap\` of 100 MiB only reserves **addresses**. RAM is assigned page by page when you first **touch** each page. Our sample proves it: RSS barely moves after \`mmap\`, then grows by 100 MiB when every page is touched, with exactly one fault per page.
- **Overcommit**: because of this, Linux lets processes reserve more memory than exists. If they all actually use it, the **OOM killer** picks a process to kill.
- **Copy-on-write** (COW): after \`fork\`, parent and child **share** every page, marked read-only. Only when one of them **writes** a page does the kernel copy it. Forking a 10 GiB process is fast, and a fork followed by \`exec\` copies almost nothing.
- **Zero page**: reading untouched anonymous memory maps a shared page full of zeros; only writing allocates a real frame.

## Swapping
When RAM runs short, the kernel picks pages that haven't been used recently and writes them to **swap** (a disk partition or file), freeing their frames. Clean pages of files (like program code) don't even need writing: they can be re-read from the file. If the working set of all running programs doesn't fit in RAM, the system **thrashes**, spending all its time swapping. That's the subject of the next level.

## mmap: files as memory
\`mmap\` maps a **file** into the address space. Reading the memory reads the file (via page faults that fill the **page cache**), and writing a shared mapping updates the file. Shared libraries are mmapped, so 100 processes using libc share one copy of its code in RAM. Databases like LMDB and MongoDB's old engine used mmap for their data files.

## Why it's all worth it
| Benefit | How |
|---|---|
| **Isolation** | Each process has its own page tables and can't even name another's memory |
| **Protection** | Per-page read/write/execute and user/kernel bits |
| **No external fragmentation** | Any page can go in any frame |
| **More memory than RAM** | Swap and demand paging |
| **Sharing** | Shared libraries, COW after fork, shared memory IPC |
| **Fast fork and lazy loading** | COW and demand paging |`,
    keyPoints: [
      "Virtual addresses split into a page number and an offset; the page table maps pages to physical frames",
      "Page table entries carry present, writable, user, NX, accessed and dirty bits checked by the MMU",
      "Page tables are multi-level trees (4 levels on x86-64) so unused regions cost nothing",
      "The TLB caches translations; PCIDs avoid flushing on context switches; huge pages cover more per entry",
      "Page faults: minor (map a page in RAM), major (read from disk), invalid (SIGSEGV)",
      "Linux uses demand paging, overcommit and copy-on-write; memory isn't allocated until it's touched",
      "When RAM is short, pages are swapped out; too little RAM for the working set causes thrashing",
    ],
    code: [
      {
        title: "Walking a page table by hand (Python)",
        variants: [{ lang: "python", code: `# Translate virtual addresses the way the MMU does: split the address, walk a two-level page
# table, and remember recent translations in a tiny TLB.
from collections import OrderedDict

# 32-bit addresses, 4 KiB pages: | 10 bits directory | 10 bits table | 12 bits offset |
page_directory = {
    0x001: {0x000: (0x2A1, False), 0x001: (0x2A2, False)},   # program code: read-only
    0x002: {0x3FF: (0x15C, True)},                           # heap: read-write
    0x3FF: {0x3FE: (0x07B, True)},                           # stack: read-write
}
tlb = OrderedDict()            # virtual page number -> (frame, writable); holds 3 entries
TLB_SIZE = 3
hits = misses = 0


def access(vaddr, write=False):
    global hits, misses
    vpn, offset = vaddr >> 12, vaddr & 0xFFF
    d, t = vpn >> 10, vpn & 0x3FF
    kind = "write" if write else "read "
    if vpn in tlb:
        hits += 1
        tlb.move_to_end(vpn)
        frame, writable = tlb[vpn]
        how = "TLB hit"
    else:
        misses += 1
        table = page_directory.get(d)
        if table is None or t not in table:
            return f"{kind} 0x{vaddr:08x}: TLB miss, walk dir[{d:#05x}] -> not present: PAGE FAULT (no mapping -> SIGSEGV)"
        frame, writable = table[t]
        evicted = ""
        if len(tlb) == TLB_SIZE:
            old, _ = tlb.popitem(last=False)
            evicted = f", evict VPN {old:#07x}"
        tlb[vpn] = (frame, writable)
        how = f"TLB miss, walk dir[{d:#05x}] -> table[{t:#05x}]{evicted}"
    if write and not writable:
        return f"{kind} 0x{vaddr:08x}: {how}, but the page is read-only: PROTECTION FAULT"
    return f"{kind} 0x{vaddr:08x}: {how} -> frame {frame:#05x} -> physical 0x{frame << 12 | offset:08x}"


for vaddr, write in [
    (0x00400A2C, False),   # fetch an instruction
    (0x00400A30, False),   # the next instruction: same page
    (0x00BFF010, True),    # write to the heap
    (0xFFFFEFF8, True),    # push onto the stack
    (0x00400B00, False),   # code again
    (0x00401004, False),   # code on the next page
    (0x00400010, True),    # a buggy write into the code
    (0x12345678, False),   # a wild pointer
]:
    print(access(vaddr, write))
print(f"TLB: {hits} hits, {misses} misses")
flat = 2**20 * 4
used = 4096 + len(page_directory) * 4096
print(f"one flat table for 32 bits: {flat // 1024} KiB per process; two levels, only what's used: {used // 1024} KiB")` }],
        explain: `- A 32-bit address is cut into 10 bits of **directory index**, 10 bits of **table index** and 12 bits of **offset**: \`vpn = vaddr >> 12\`, \`offset = vaddr & 0xFFF\`.
- The first access to a page is a **TLB miss**: walk the directory, then the table, to find the frame. The physical address is \`frame << 12 | offset\`.
- The second access to the same page is a **TLB hit**, with no walk at all. Real programs get above 99% hits because code and data are accessed in clusters.
- The TLB holds only 3 entries here, so loading a fourth evicts the least recently used one.
- Writing to the read-only code page is a **protection fault**, and the wild pointer \`0x12345678\` has no mapping, so it's a **page fault** the kernel turns into SIGSEGV.
- The last line is why tables are trees: one flat table would take 4 MiB per process, but this program needs only 16 KiB of tables.`,
        output: `read  0x00400a2c: TLB miss, walk dir[0x001] -> table[0x000] -> frame 0x2a1 -> physical 0x002a1a2c
read  0x00400a30: TLB hit -> frame 0x2a1 -> physical 0x002a1a30
write 0x00bff010: TLB miss, walk dir[0x002] -> table[0x3ff] -> frame 0x15c -> physical 0x0015c010
write 0xffffeff8: TLB miss, walk dir[0x3ff] -> table[0x3fe] -> frame 0x07b -> physical 0x0007bff8
read  0x00400b00: TLB hit -> frame 0x2a1 -> physical 0x002a1b00
read  0x00401004: TLB miss, walk dir[0x001] -> table[0x001], evict VPN 0x00bff -> frame 0x2a2 -> physical 0x002a2004
write 0x00400010: TLB hit, but the page is read-only: PROTECTION FAULT
read  0x12345678: TLB miss, walk dir[0x048] -> not present: PAGE FAULT (no mapping -> SIGSEGV)
TLB: 3 hits, 5 misses
one flat table for 32 bits: 4096 KiB per process; two levels, only what's used: 16 KiB`,
      },
      {
        title: "Demand paging and copy-on-write, measured",
        linux: true,
        variants: [{ lang: "c", code: `// Demand paging and copy-on-write: you don't really get memory until you touch it.
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

#define SIZE (100L << 20)                    // 100 MiB

static long rss_kib(void) {                  // resident set size: pages really in RAM
    FILE *f = fopen("/proc/self/status", "r");
    char line[256];
    long kib = -1;
    while (fgets(line, sizeof line, f))
        if (sscanf(line, "VmRSS: %ld kB", &kib) == 1) break;
    fclose(f);
    return kib;
}

static long smaps(const char *field) {      // a total from /proc/self/smaps_rollup, in KiB
    FILE *f = fopen("/proc/self/smaps_rollup", "r");
    char line[256], name[64];
    long kib, total = -1;
    while (fgets(line, sizeof line, f))
        if (sscanf(line, "%63s %ld", name, &kib) == 2 && !strcmp(name, field)) total = kib;
    fclose(f);
    return total;
}

static long faults(void) {                   // minor page faults so far
    struct rusage r;
    getrusage(RUSAGE_SELF, &r);
    return r.ru_minflt;
}

static int about(long got, long want) { return got >= want * 98 / 100 && got <= want * 103 / 100; }

int main(void) {
    long page = sysconf(_SC_PAGESIZE), pages = SIZE / page;
    printf("page size: %ld bytes, so 100 MiB is %ld pages\\n", page, pages);
    long r0 = rss_kib();
    char *m = mmap(NULL, SIZE, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    madvise(m, SIZE, MADV_NOHUGEPAGE);       // plain 4 KiB pages, so we can count them
    printf("after mmap: RSS grew by less than 1 MiB: %s\\n", rss_kib() - r0 < 1024 ? "yes" : "no");

    long f0 = faults(), r1 = rss_kib();
    for (long i = 0; i < SIZE; i += page) m[i] = 1;       // touch one byte in every page
    printf("touching every page: one page fault per page: %s\\n", about(faults() - f0, pages) ? "yes" : "no");
    printf("now RSS grew by about 100 MiB: %s\\n", about(rss_kib() - r1, 100 * 1024) ? "yes" : "no");
    fflush(stdout);

    pid_t pid = fork();
    if (pid == 0) {
        long sum = 0;
        for (long i = 0; i < SIZE; i += page) sum += m[i];  // reading: the pages are shared with the parent
        printf("child reads every page (sum %ld): still SHARED with the parent, nothing copied: %s\\n", sum,
               about(smaps("Shared_Dirty:"), 100 * 1024) && smaps("Private_Dirty:") < 10 * 1024 ? "yes" : "no");
        long c1 = faults();
        for (long i = 0; i < SIZE; i += page) m[i] = 2;     // writing: each page must be copied first
        long c2 = faults();
        printf("child writes every page: one copy-on-write fault per page: %s\\n", about(c2 - c1, pages) ? "yes" : "no");
        printf("now the child has its own PRIVATE copy of all 100 MiB: %s\\n",
               about(smaps("Private_Dirty:"), 100 * 1024) && smaps("Shared_Dirty:") < 10 * 1024 ? "yes" : "no");
        exit(0);
    }
    waitpid(pid, NULL, 0);
    printf("parent's memory is untouched by the child's writes: m[0] = %d\\n", m[0]);
    munmap(m, SIZE);
    return 0;
}` }],
        explain: `- **RSS** (resident set size, from \`/proc/self/status\`) is how much of the process is really in RAM. \`mmap\` of 100 MiB barely changes it: only addresses were reserved.
- Touching one byte per page causes **one minor page fault per page** (25,600 of them), and RSS grows by 100 MiB. \`madvise(MADV_NOHUGEPAGE)\` keeps the pages at 4 KiB; with transparent huge pages the kernel could map 2 MiB at a time with far fewer faults.
- After \`fork\`, the child **reads** every page: \`/proc/self/smaps_rollup\` shows the 100 MiB is still **shared** with the parent. Nothing was copied.
- When the child **writes** every page, each write hits a read-only page and faults, and the kernel copies that one page: 25,600 copy-on-write faults. Now the memory is **private** to the child.
- The parent still sees \`m[0] = 1\`: after the copy, the child's writes went to its own frames.`,
        output: `page size: 4096 bytes, so 100 MiB is 25600 pages
after mmap: RSS grew by less than 1 MiB: yes
touching every page: one page fault per page: yes
now RSS grew by about 100 MiB: yes
child reads every page (sum 25600): still SHARED with the parent, nothing copied: yes
child writes every page: one copy-on-write fault per page: yes
now the child has its own PRIVATE copy of all 100 MiB: yes
parent's memory is untouched by the child's writes: m[0] = 1`,
      },
      {
        title: "Two kinds of segmentation fault",
        linux: true,
        variants: [{ lang: "c", code: `// Two kinds of segmentation fault: nothing mapped at all, and a page you may read but not write.
#define _GNU_SOURCE
#include <setjmp.h>
#include <signal.h>
#include <stdio.h>
#include <sys/mman.h>
#include <unistd.h>

static sigjmp_buf back;
static volatile int code;
static void *volatile where;
static long page;
static char *ro;

static void on_segv(int sig, siginfo_t *info, void *ctx) {
    (void)sig;
    (void)ctx;
    code = info->si_code;                    // WHY the access failed
    where = info->si_addr;                   // WHICH address it tried
    siglongjmp(back, 1);                     // jump back into main instead of dying
}

int main(void) {
    struct sigaction sa = {.sa_sigaction = on_segv, .sa_flags = SA_SIGINFO};
    sigaction(SIGSEGV, &sa, NULL);
    page = sysconf(_SC_PAGESIZE);

    int *volatile nowhere = (int *)0x10;
    if (sigsetjmp(back, 1) == 0) {
        *nowhere = 1;
        puts("no crash?!");
    } else {
        printf("write to %p:           SIGSEGV %s\\n", where, code == SEGV_MAPERR ? "SEGV_MAPERR: nothing is mapped there" : "?");
    }

    ro = mmap(NULL, page, PROT_READ, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    printf("read the read-only page:  fine, it holds %d\\n", ro[0]);
    if (sigsetjmp(back, 1) == 0) {
        ((char *volatile)ro)[0] = 1;
        puts("no crash?!");
    } else {
        printf("write the read-only page: SIGSEGV %s, at that page: %s\\n",
               code == SEGV_ACCERR ? "SEGV_ACCERR: mapped, but not writable" : "?", where == ro ? "yes" : "no");
    }

    mprotect(ro, page, PROT_READ | PROT_WRITE);   // ask the kernel to change the page's permissions
    ro[0] = 5;
    printf("after mprotect(READ|WRITE): the write works, it holds %d\\n", ro[0]);
    munmap(ro, page);
    return 0;
}` }],
        explain: `- A \`SA_SIGINFO\` handler receives a \`siginfo_t\` saying **which address** failed (\`si_addr\`) and **why** (\`si_code\`). \`siglongjmp\` jumps back into \`main\` so the demo can continue.
- Writing to address \`0x10\`: nothing is mapped there (the first pages are deliberately left unmapped to catch NULL pointer bugs), so it's \`SEGV_MAPERR\`.
- A page mapped with \`PROT_READ\` can be read, but writing it gives \`SEGV_ACCERR\`: the mapping exists, the permission doesn't.
- \`mprotect\` changes a page's permissions. JIT compilers use it to write machine code (read+write) and then make it executable (read+execute).`,
        output: `write to 0x10:           SIGSEGV SEGV_MAPERR: nothing is mapped there
read the read-only page:  fine, it holds 0
write the read-only page: SIGSEGV SEGV_ACCERR: mapped, but not writable, at that page: yes
after mprotect(READ|WRITE): the write works, it holds 5`,
      },
    ],
    interview: [
      {
        q: "What is virtual memory and why do we use it?",
        freq: "very-common",
        a: `Each process gets its own virtual address space, which the MMU translates to physical memory through per-process page tables. Benefits: **isolation** (processes can't access each other's memory), **protection** (per-page permissions), **no external fragmentation** of RAM (pages map to any frame), using **more memory than physical RAM** (demand paging and swap), **sharing** (shared libraries, copy-on-write), and a simple uniform layout for every program.`,
      },
      {
        q: "Walk through what happens when a program reads a virtual address.",
        freq: "very-common",
        a: `The MMU splits the address into page number and offset and checks the **TLB**. On a hit, it has the frame and checks permissions; the physical address is frame + offset, which goes to the caches and RAM. On a miss, the hardware **walks the page table** (4 levels on x86-64, starting from CR3), caches the result in the TLB, and continues. If an entry isn't present or the permission is wrong, the CPU raises a **page fault**: the kernel either maps the page (minor), reads it from disk (major, the process sleeps), or sends SIGSEGV (invalid), then the instruction is retried.`,
      },
      {
        q: "What is a TLB and what happens to it on a context switch?",
        freq: "very-common",
        a: `The translation lookaside buffer is a small, fast cache of virtual-to-physical page translations inside the CPU. Without it, every memory access would need several extra memory reads. On a process switch, the translations belong to the old address space: older CPUs flush the TLB, causing misses afterwards; modern CPUs tag entries with a PCID/ASID so entries from several processes can coexist. Switching between threads of the same process keeps the same address space, so the TLB stays valid.`,
      },
      {
        q: "What's the difference between a minor and a major page fault?",
        freq: "common",
        a: `A **minor** fault is resolved without disk I/O: the page is already in RAM (page cache, shared library, COW copy, zero-fill of new memory), and the kernel just updates the page table (microseconds). A **major** fault needs I/O: the page is in swap or in a file not yet cached, so the process sleeps while the disk reads it (milliseconds). Many major faults mean the working set doesn't fit in RAM. See them with \`/usr/bin/time -v\`, \`ps -o min_flt,maj_flt\` or \`perf\`.`,
      },
      {
        q: "How does fork() avoid copying the whole address space?",
        freq: "common",
        a: `**Copy-on-write**: the kernel duplicates the page tables (not the pages), marks writable pages read-only in both processes, and increments each page's reference count. Reads are shared. On the first write by either side, a protection fault occurs; the kernel copies that single page, maps the copy writable for the writer, and resumes. Pages never written are never copied, so fork followed by exec copies almost nothing. \`vfork\` and \`posix_spawn\` go further and avoid even copying the page tables.`,
      },
      {
        q: "Why are page tables multi-level?",
        freq: "common",
        a: `A single flat table needs an entry for every possible page: 4 MiB per process for 32-bit, and an impossible 512 GiB for a 48-bit address space with 8-byte entries. A multi-level (radix tree) table only allocates lower-level tables for regions actually in use, so a sparse address space (code at the bottom, stack at the top, nothing between) costs a few pages of tables. The price is more memory reads per TLB miss, mitigated by the TLB and by caching upper-level entries.`,
      },
      {
        q: "What happens when you malloc 10 GB on a machine with 8 GB of RAM?",
        freq: "occasional",
        a: `With Linux's default heuristic overcommit, a large \`malloc\` usually **succeeds**: glibc mmaps the region and only addresses are reserved. Physical pages are assigned on first touch. If you actually write all 10 GB, RAM plus swap may run out; the kernel then tries reclaiming page cache and swapping, and if that fails, the **OOM killer** kills a process (picked by \`oom_score\`). With \`vm.overcommit_memory=2\` (strict), the allocation would fail upfront and \`malloc\` would return NULL.`,
      },
      {
        q: "What are huge pages and when would you use them?",
        freq: "occasional",
        a: `Pages of 2 MiB or 1 GiB instead of 4 KiB. One TLB entry then covers 512× (or 262,144×) more memory, which cuts TLB misses and page-walk cost for programs with large, randomly accessed memory: databases, JVM heaps, in-memory caches, VMs. Downsides: more internal fragmentation, slower page faults (zeroing 2 MiB), and THP's background compaction can cause latency spikes, which is why some databases recommend turning THP off and using explicit \`hugetlbfs\` pages instead.`,
      },
    ],
    quiz: [
      {
        q: "With 4 KiB pages, how many bits of a virtual address are the page offset?",
        options: ["4", "10", "12", "20"],
        answer: 2,
        explain: "2^12 = 4096; the offset is copied unchanged to the physical address.",
      },
      {
        q: "What does the TLB cache?",
        options: ["File contents", "Recent virtual-to-physical page translations", "System call results", "Instructions"],
        answer: 1,
        explain: "It avoids walking the page tables on every memory access.",
      },
      {
        q: "A process touches a freshly mmapped page for the first time. What kind of fault happens?",
        options: ["None", "A minor page fault", "A major page fault", "A segmentation fault"],
        answer: 1,
        explain: "Demand paging: the kernel assigns a zeroed frame on first touch, no disk I/O needed.",
      },
      {
        q: "Which page-table bit tells the OS that a page must be written back before being evicted?",
        options: ["Present", "Accessed", "Dirty", "NX"],
        answer: 2,
        explain: "The hardware sets the dirty bit on writes; clean pages can just be dropped.",
      },
      {
        q: "After fork(), the child writes to one page of a 1 GiB array. How much is copied?",
        options: ["1 GiB", "One page", "Nothing ever", "Half of it"],
        answer: 1,
        explain: "Copy-on-write copies only the page that was written.",
      },
      {
        q: "Why does x86-64 use a 4-level page table instead of one big table?",
        options: ["It's faster on every access", "Unused regions don't need table pages, saving huge amounts of memory", "It's required for TLBs", "To support 4 processes"],
        answer: 1,
        explain: "A sparse address space needs only a few small tables; a flat one would be gigantic.",
      },
      {
        q: "Writing to a page mapped read-only produces which si_code?",
        options: ["SEGV_MAPERR", "SEGV_ACCERR", "SIGBUS", "EFAULT"],
        answer: 1,
        explain: "ACCERR means the mapping exists but the access isn't permitted; MAPERR means no mapping.",
      },
      {
        q: "What does a PCID (or ASID) let the CPU do?",
        options: ["Run two processes at once", "Keep TLB entries of several address spaces without flushing on a switch", "Encrypt memory", "Skip page faults"],
        answer: 1,
        explain: "Tagged TLB entries survive context switches.",
      },
    ],
  },

  // ------------------------------------------------------------------ PAGE REPLACEMENT
  {
    id: "os-page-replacement",
    title: "Page replacement and thrashing",
    tagline: "When RAM is full, which page goes? FIFO, LRU, OPT, Clock, Belady's anomaly, working sets, thrashing, Linux's LRU lists and the OOM killer.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["pagerepl"],
    complexity: [
      { op: "FIFO", time: "O(1)", note: "A queue; ignores usage, suffers Belady's anomaly" },
      { op: "LRU (exact)", time: "O(1) with a hash map + linked list", note: "Great in theory; too costly to update on every memory access in hardware" },
      { op: "Clock (second chance)", time: "O(1) amortised", note: "Approximates LRU with one reference bit per page; what real kernels build on" },
      { op: "OPT (Belady)", time: "Needs the future", note: "The lower bound you measure other algorithms against" },
    ],
    concept: `## Explain it like I'm 10 🧸
Your desk has room for **3 books**. Your bookshelf (the disk) has all the rest, but walking to the shelf is **slow**. When you need a fourth book and the desk is full, you must **put one back**. Which one?
- **FIFO**: put back the book that's been on the desk **longest**. Fair, but silly if it's your favourite.
- **LRU**: put back the book you **haven't opened for the longest time**. Smart: books you used recently, you'll probably use again.
- **OPT**: put back the book you **won't need for the longest time in the future**. Perfect, but you'd need a time machine.
- **Clock**: walk around the desk; if a book has a "recently read" sticker, peel it off and give it a second chance; take the first book without a sticker.

Every walk to the shelf is a **page fault**. The goal is to walk as little as possible.

## The setup
RAM holds a fixed number of **frames**. When a page fault needs a frame and none is free, the OS must **evict** a page (writing it to swap first if it's **dirty**). We compare algorithms by counting page faults on a **reference string**, the sequence of pages a program touches.

The classic textbook string, with **3 frames**:
\`\`\`text
refs   7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1
FIFO   15 faults
LRU    12 faults
OPT     9 faults   (the best possible)
Clock  14 faults
\`\`\`
Step through each of them in the visualizer, frame by frame.

## The algorithms
| Algorithm | Evicts | Pros | Cons |
|---|---|---|---|
| **FIFO** | The page loaded earliest | Trivial | Evicts heavily used pages; Belady's anomaly |
| **OPT** (Belady's optimal) | The page used furthest in the future | Provably fewest faults | Needs the future; only a benchmark |
| **LRU** | The page unused for the longest | Close to OPT for most programs (locality) | Exact LRU needs a timestamp or list update on **every** memory access: too expensive in hardware |
| **Clock / second chance** | Sweeps a circular "hand"; a page with its **accessed bit** set gets the bit cleared and is skipped once | Cheap: uses the hardware's accessed bit | Only approximates LRU |
| **Enhanced clock** | Prefers pages that are not accessed **and not dirty** | Avoids costly write-backs | Slightly more bookkeeping |
| **LFU** | The least frequently used | Keeps popular pages | Old popular pages linger forever |

## Belady's anomaly
You'd expect **more frames → fewer faults**. For FIFO, that's **not guaranteed**. On the string \`1 2 3 4 1 2 5 1 2 3 4 5\`, FIFO gets **9 faults with 3 frames but 10 with 4**. LRU and OPT are **stack algorithms**: the pages held with N frames are always a subset of those held with N+1, so they never suffer the anomaly.

## Locality, working sets and thrashing
Programs don't touch memory randomly. They have **locality**:
- **Temporal**: something used now will probably be used again soon (loop variables, hot functions).
- **Spatial**: something near it will probably be used soon (array elements, the next instructions).

The **working set** is the set of pages a program uses in a recent window of time. If every running program's working set fits in RAM, page faults are rare. If not, the system **thrashes**: every process faults, waits for disk, gets descheduled, and evicts pages someone else needs next. The CPU sits idle while the disk is at 100%. Adding more processes makes it **worse**.

Our second sample shows the cliff: a loop over **5 pages** gets **50 faults out of 50 accesses** with LRU and 4 frames (every access evicts exactly the page needed next), but only **5 faults** with 5 frames. Fixes for thrashing: run fewer processes, add RAM, or improve locality. The OS can watch the **page-fault frequency**: too high means a process needs more frames, too low means it can spare some.

## What Linux actually does
- Pages live on **active** and **inactive** LRU lists, with separate lists for **anonymous** memory (heap, stack: must go to swap) and **file-backed** memory (page cache: can just be dropped if clean). Newer kernels use the **multi-generational LRU** (MGLRU).
- Background thread \`kswapd\` reclaims memory when free pages drop below a watermark, so most allocations never wait. If it can't keep up, the allocating process reclaims directly (**direct reclaim**: latency spikes).
- \`vm.swappiness\` (0–200) tunes whether to prefer evicting file pages or swapping anonymous pages.
- If nothing can be reclaimed, the **OOM killer** kills the process with the highest \`oom_score\` (mostly its memory use, adjustable through \`oom_score_adj\`). In containers, the **cgroup memory limit** triggers the OOM killer for just that container: the famous "OOMKilled" with exit code 137 in Kubernetes.

## Beyond the OS: the same idea everywhere
Page replacement is **cache eviction**. The same algorithms decide what stays in CPU caches, database buffer pools (PostgreSQL uses clock sweep), CDN caches, Redis (\`allkeys-lru\`) and browser caches. The LRU cache with a hash map and a doubly linked list is a famous interview question for exactly this reason.`,
    keyPoints: [
      "When no frame is free, the OS evicts a page; the goal is fewest page faults",
      "FIFO is simple but can evict hot pages and suffers Belady's anomaly",
      "OPT evicts the page used furthest in the future: optimal but impossible, used as a benchmark",
      "LRU approximates OPT using the past; Clock approximates LRU cheaply with the accessed bit",
      "Locality means working sets are small; when they don't fit in RAM the system thrashes",
      "Linux uses active/inactive (or multi-generational) LRU lists, kswapd, swappiness and the OOM killer",
    ],
    code: [
      {
        title: "FIFO, LRU, OPT and Clock on the classic string (Python)",
        variants: [{ lang: "python", code: `# Page replacement: FIFO, LRU, OPT (Belady's optimal) and Clock on the same reference string.
def simulate(refs, frames, choose_victim):
    mem, trace, faults = [], [], 0
    state = {"hand": 0, "ref": {}, "loaded": [], "last": {}}
    for i, page in enumerate(refs):
        state["last"][page] = i
        if page in mem:
            state["ref"][page] = 1
            trace.append(".")
            continue
        faults += 1
        trace.append("F")
        if len(mem) < frames:
            mem.append(page)
        else:
            slot = choose_victim(mem, refs, i, state)
            mem[slot] = page
        state["ref"][page] = 1
        state["loaded"].append(page)
    return faults, "".join(trace)


def fifo(mem, refs, i, s):              # evict the page that came in first
    return min(range(len(mem)), key=lambda k: max(j for j, p in enumerate(s["loaded"]) if p == mem[k]))


def lru(mem, refs, i, s):               # evict the page unused for the longest time
    return min(range(len(mem)), key=lambda k: max(j for j in range(i) if refs[j] == mem[k]))


def opt(mem, refs, i, s):               # evict the page needed furthest in the future (needs a crystal ball)
    def next_use(p):
        rest = refs[i + 1:]
        return rest.index(p) if p in rest else float("inf")
    return max(range(len(mem)), key=lambda k: next_use(mem[k]))


def clock(mem, refs, i, s):             # second chance: skip pages with the reference bit set, clearing it
    while True:
        k = s["hand"] % len(mem)
        s["hand"] += 1
        if s["ref"].get(mem[k]):
            s["ref"][mem[k]] = 0
        else:
            return k


refs = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1]
print("refs   " + "".join(str(p) for p in refs))
for name, algo in [("FIFO", fifo), ("LRU", lru), ("OPT", opt), ("Clock", clock)]:
    faults, trace = simulate(refs, 3, algo)
    print(f"{name:6} {trace}  {faults} faults with 3 frames")

belady = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]
for name, algo in [("FIFO", fifo), ("LRU", lru)]:
    f3, _ = simulate(belady, 3, algo)
    f4, _ = simulate(belady, 4, algo)
    print(f"Belady's string, {name}: 3 frames -> {f3} faults, 4 frames -> {f4} faults")` }],
        explain: `- \`simulate\` runs the reference string with a given number of frames and asks the policy which slot to evict on each fault. Each trace shows \`F\` for a fault and \`.\` for a hit.
- **FIFO** evicts the page loaded earliest; **LRU** evicts the page whose last use is oldest; **OPT** looks ahead and evicts the page whose next use is furthest away (or never comes); **Clock** sweeps a hand over the frames, clearing reference bits until it finds a page without one.
- The results, 15, 12, 9 and 14 faults, are the textbook numbers. OPT is the floor no real algorithm can beat.
- **Belady's anomaly**: FIFO gets *worse* with 4 frames (10 faults) than with 3 (9). LRU gets better (10 → 8), as stack algorithms always do.`,
        output: `refs   70120304230321201701
FIFO   FFFF.FFFFFF..FF..FFF  15 faults with 3 frames
LRU    FFFF.F.FFFF..F.F.F..  12 faults with 3 frames
OPT    FFFF.F.F..F..F...F..  9 faults with 3 frames
Clock  FFFF.F.FF.FF.FFF.F.F  14 faults with 3 frames
Belady's string, FIFO: 3 frames -> 9 faults, 4 frames -> 10 faults
Belady's string, LRU: 3 frames -> 10 faults, 4 frames -> 8 faults`,
      },
      {
        title: "Thrashing: the cliff when the working set doesn't fit (Python)",
        variants: [{ lang: "python", code: `# Thrashing: a loop over 5 pages, run 10 times. Watch what happens when RAM holds fewer than 5.
from collections import OrderedDict


def lru_faults(refs, frames):
    mem, faults = OrderedDict(), 0
    for p in refs:
        if p in mem:
            mem.move_to_end(p)
        else:
            faults += 1
            if len(mem) == frames:
                mem.popitem(last=False)
            mem[p] = True
    return faults


def opt_faults(refs, frames):
    mem, faults = set(), 0
    for i, p in enumerate(refs):
        if p in mem:
            continue
        faults += 1
        if len(mem) == frames:
            rest = refs[i + 1:]
            mem.remove(max(mem, key=lambda q: rest.index(q) if q in rest else len(rest)))
        mem.add(p)
    return faults


refs = [0, 1, 2, 3, 4] * 10        # a working set of 5 pages, 50 accesses
print("frames  LRU faults  OPT faults")
for frames in range(1, 7):
    lf, of = lru_faults(refs, frames), opt_faults(refs, frames)
    bar = "#" * (lf // 5)
    print(f"{frames:>6}  {lf:>10}  {of:>10}  {bar}")` }],
        explain: `- The program loops over 5 pages, 10 times: a working set of 5 pages.
- With 1 to 4 frames, **LRU faults on every single access**: the page it evicts is always the oldest, which is exactly the one the loop needs next. That's the worst case for LRU, and why databases scanning a big table use special policies to avoid flushing their caches.
- OPT degrades gradually, because it keeps the pages needed soonest.
- With 5 frames the whole working set fits: just the 5 compulsory faults to load each page once. Real systems show this cliff too: a little less memory than the working set and performance falls off a cliff.`,
        output: `frames  LRU faults  OPT faults
     1          50          50  ##########
     2          50          38  ##########
     3          50          27  ##########
     4          50          16  ##########
     5           5           5  #
     6           5           5  #`,
      },
    ],
    interview: [
      {
        q: "Compare FIFO, LRU and OPT page replacement.",
        freq: "very-common",
        a: `**FIFO** evicts the oldest-loaded page: O(1) and simple, but ignores usage, so it can evict hot pages, and it suffers Belady's anomaly. **OPT** evicts the page whose next use is furthest in the future: provably minimal faults, but needs future knowledge, so it's used as a benchmark. **LRU** evicts the least recently used page, approximating OPT by assuming the recent past predicts the future; it's excellent in practice but exact LRU is too expensive to maintain per memory access, so kernels approximate it with Clock and accessed bits.`,
      },
      {
        q: "What is Belady's anomaly?",
        freq: "common",
        a: `The counter-intuitive situation where giving FIFO **more** frames produces **more** page faults. Classic example: reference string 1,2,3,4,1,2,5,1,2,3,4,5 gives 9 faults with 3 frames and 10 with 4. It can't happen with **stack algorithms** like LRU and OPT, where the set of pages in memory with n frames is always a subset of the set with n+1 frames.`,
      },
      {
        q: "How does the Clock (second-chance) algorithm work?",
        freq: "common",
        a: `Frames are arranged in a circle with a hand. The hardware sets each page's accessed bit when it's used. On a fault, look at the page under the hand: if its accessed bit is 1, clear it (a second chance) and advance; if it's 0, evict that page and put the new one there. It approximates LRU with one bit per page and O(1) amortised cost. The enhanced version also considers the dirty bit, preferring clean, unreferenced pages.`,
      },
      {
        q: "What is thrashing, and how do you detect and fix it?",
        freq: "common",
        a: `Thrashing is when the combined working sets of running processes exceed physical memory, so processes constantly page-fault and evict each other's pages. The system spends its time on paging I/O: CPU utilisation drops, disk I/O and major faults spike, everything becomes extremely slow. Detect with \`vmstat\` (si/so swap columns), major-fault counters and pressure stall information (\`/proc/pressure/memory\`). Fix by reducing the multiprogramming level (fewer processes or smaller caches), adding RAM, improving locality, or setting memory limits so the OOM killer acts early instead of the machine grinding.`,
      },
      {
        q: "Design an LRU cache with O(1) get and put.",
        freq: "very-common",
        a: `Combine a **hash map** from key to node with a **doubly linked list** ordered by recency. \`get\`: look up the node, move it to the front, return its value. \`put\`: if the key exists, update and move to the front; otherwise insert a new node at the front, and if over capacity, remove the tail node and delete its key from the map. All operations are O(1). In Python, \`OrderedDict\` with \`move_to_end\` and \`popitem(last=False)\` does exactly this; in Java, \`LinkedHashMap\` with access order and \`removeEldestEntry\`.`,
      },
      {
        q: "A container keeps getting OOMKilled. What's happening and what do you check?",
        freq: "occasional",
        a: `Its memory cgroup hit its limit and the kernel's OOM killer killed a process inside it (exit code 137, SIGKILL). Check the container's actual working set vs its limit (\`kubectl top\`, cgroup \`memory.current\`/\`memory.peak\`), whether the limit is simply too low, whether there's a leak (memory growing without bound), and whether a runtime ignores the cgroup (old JVMs sized the heap from host RAM; set \`-XX:MaxRAMPercentage\`). Page cache from the app's file I/O counts too, though it's reclaimable.`,
      },
    ],
    quiz: [
      {
        q: "Which page does OPT (Belady's optimal) evict?",
        options: ["The oldest loaded page", "The least recently used page", "The page that will be used furthest in the future", "A random page"],
        answer: 2,
        explain: "It's optimal but needs to know the future, so it's a benchmark only.",
      },
      {
        q: "Which algorithm can suffer Belady's anomaly?",
        options: ["LRU", "OPT", "FIFO", "None of them"],
        answer: 2,
        explain: "FIFO isn't a stack algorithm, so more frames can mean more faults.",
      },
      {
        q: "What does the Clock algorithm do when the hand reaches a page whose accessed bit is 1?",
        options: ["Evicts it", "Clears the bit and moves on (a second chance)", "Writes it to disk", "Stops"],
        answer: 1,
        explain: "Recently used pages get skipped once; unused pages are evicted.",
      },
      {
        q: "Why don't real kernels implement exact LRU?",
        options: ["LRU is worse than FIFO", "Updating recency on every memory access is too expensive", "It's patented", "It needs the future"],
        answer: 1,
        explain: "Hardware only sets an accessed bit; kernels approximate LRU with it.",
      },
      {
        q: "A machine has high disk activity, low CPU use, and every process is slow. Most likely:",
        options: ["A CPU-bound workload", "Thrashing", "A deadlock", "A fast network"],
        answer: 1,
        explain: "Working sets don't fit in RAM, so processes spend their time waiting for page faults.",
      },
      {
        q: "Evicting a clean file-backed page is cheaper than evicting a dirty anonymous page. Why?",
        options: ["Clean pages are smaller", "A clean file page can be re-read from its file; a dirty anonymous page must be written to swap first", "Anonymous pages can't be evicted", "It isn't cheaper"],
        answer: 1,
        explain: "Clean pages are just dropped; dirty ones need a write first.",
      },
      {
        q: "A loop touches 5 pages over and over, and there are 4 frames. How many LRU faults per access?",
        options: ["None after warm-up", "One in five", "Every access faults", "Half"],
        answer: 2,
        explain: "LRU always evicts exactly the page the loop needs next: the worst case for LRU.",
      },
    ],
  },

  // ------------------------------------------------------------------ ALLOCATION
  {
    id: "os-allocation",
    title: "Memory allocators: malloc, buddy and slab",
    tagline: "How malloc finds a free block, first/best/worst fit, splitting and coalescing, internal vs external fragmentation, the buddy system, slab caches, arenas and memory bugs.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["allocator"],
    complexity: [
      { op: "First fit (free list)", time: "O(free blocks)", note: "Fast in practice; small holes pile up near the start" },
      { op: "Best fit", time: "O(free blocks), or O(log n) with a tree", note: "Least waste per allocation; leaves tiny unusable slivers" },
      { op: "Size classes / segregated lists", time: "O(1)", note: "What real mallocs do: one free list per size" },
      { op: "Buddy system", time: "O(log n) split and merge", note: "Fast coalescing; up to ~50% internal fragmentation" },
      { op: "Slab cache", time: "O(1)", note: "Preformatted objects of one type; no fragmentation within a slab" },
    ],
    concept: `## Explain it like I'm 10 🧸
Imagine a long **parking lot** for vehicles of every length: bikes, cars, buses.
- When a car arrives, the attendant finds an empty stretch long enough and **parks** it (\`malloc\`).
- When it leaves, that stretch becomes empty again (\`free\`).
- After a while the lot looks like Swiss cheese: lots of small gaps between parked cars. A **bus** arrives. There's enough empty space **in total**, but **no single gap** is long enough. The bus can't park! That's **external fragmentation**.
- If two neighbouring gaps join into one bigger gap when cars leave, that's **coalescing**.
- If the attendant only offers spots of fixed sizes (small, medium, large) and puts a bike in a medium spot, the leftover space in that spot is wasted: **internal fragmentation**.

## What an allocator does
\`malloc(n)\` must find **n free bytes**, fast, without wasting too much space, and \`free(p)\` must take them back. The allocator keeps a small **header** before each block (its size and whether it's free) and a **free list** linking the free blocks. Our C sample builds a complete one in about 50 lines.

**Placement policies**, for picking a free block:
| Policy | Picks | Notes |
|---|---|---|
| **First fit** | The first block that's big enough | Fast; small fragments collect at the start of the list |
| **Next fit** | Like first fit, but starts where the last search ended | Spreads allocations; often more fragmentation |
| **Best fit** | The smallest block that's big enough | Least leftover per allocation, but leaves tiny useless slivers |
| **Worst fit** | The largest block | Leaves big leftovers; usually worst in practice |

Then two key operations:
- **Splitting**: a big free block is cut into the allocated part and a smaller free remainder.
- **Coalescing**: when a block is freed, it **merges** with free neighbours, so holes don't stay small forever. Real allocators store a footer too ("boundary tags"), so the block *before* can be found in O(1).

Try all three policies in the visualizer and see which one makes a big allocation fail first.

## Two kinds of fragmentation
| | External | Internal |
|---|---|---|
| What | Free memory split into holes too small to use | Wasted space **inside** an allocated block |
| Cause | Variable-sized allocations and frees | Rounding up (alignment, size classes, page or power-of-two sizes) |
| Example | 576 free bytes, but no hole bigger than 464 | Asking for 34 KiB and getting a 64 KiB buddy block |
| Fixes | Coalescing, compaction (moving GCs), paging | Finer size classes, slabs |

Paging eliminates external fragmentation of **physical** memory (any page fits any frame) at the cost of internal fragmentation in the last page of each region. Moving garbage collectors (Java's, .NET's) **compact** the heap, which C's \`malloc\` can't do, because C programs hold raw pointers.

## The buddy system (the kernel's page allocator)
Memory is managed in blocks whose sizes are **powers of two**. To allocate, round up to a power of two and **split** a bigger block in halves until one is the right size. The two halves of a split are **buddies**. When a block is freed, if its buddy is also free, they **merge** back into the bigger block, possibly cascading all the way up.
- Finding a block's buddy is just flipping one address bit: \`buddy = address XOR size\`. Merging is cheap.
- The cost is **internal fragmentation**: a 66 KiB request takes a 128 KiB block.
- Linux's physical page allocator is a buddy system over orders 0 (one 4 KiB page) to 10 (4 MiB). \`cat /proc/buddyinfo\` shows how many free blocks exist of each order.

## Slab allocation (the kernel's object allocator)
The kernel allocates millions of **same-sized objects**: process descriptors, inodes, network buffers. A **slab allocator** keeps a **cache per object type**: a few pages carved into identical slots. Allocation pops a free slot, freeing pushes it back: O(1), no external fragmentation, and objects can stay half-initialised between uses. Linux uses **SLUB**; \`sudo slabtop\` shows the caches.

## User-space mallocs
- **glibc's ptmalloc**: **bins** of free chunks grouped by size, per-thread caches (**tcache**) for the smallest sizes, multiple **arenas** so threads don't fight over one lock, and \`mmap\` for big blocks.
- **jemalloc** (FreeBSD, Rust once, Facebook), **tcmalloc** (Google), **mimalloc** (Microsoft): size classes, per-thread or per-CPU caches, less fragmentation for long-running servers. Swapping the allocator (\`LD_PRELOAD=libjemalloc.so\`) can cut a server's memory a lot.
- **Arena** (region, bump) allocators: allocate by bumping a pointer, and free **everything at once** at the end of a request or compiler pass. Extremely fast; used in compilers, games and request handlers.

## Memory bugs (C and C++)
| Bug | What happens | Detect with |
|---|---|---|
| **Leak** | Memory never freed; usage grows until OOM | Valgrind, LeakSanitizer, heap profilers |
| **Use after free** | Reading or writing a freed block, which now belongs to someone else | AddressSanitizer (\`-fsanitize=address\`) |
| **Double free** | Freeing twice corrupts the free list; a classic exploit | ASan; glibc often aborts with "double free detected" |
| **Buffer overflow** | Writing past a block's end smashes the next header | ASan, \`_FORTIFY_SOURCE\`, bounds checks |
| **Uninitialised read** | \`malloc\` memory has leftover garbage | MemorySanitizer, Valgrind |

Garbage-collected languages (Java, Go, Python, JS) and Rust's ownership rules exist largely to make these bugs impossible.`,
    keyPoints: [
      "malloc keeps headers and a free list; free returns blocks to it",
      "Placement: first fit (fast), best fit (smallest hole), worst fit, next fit",
      "Splitting carves a block out of a bigger hole; coalescing merges free neighbours",
      "External fragmentation: free space split into unusable holes; internal: waste inside blocks",
      "The buddy system splits and merges power-of-two blocks (Linux's page allocator)",
      "Slab caches hand out same-sized kernel objects in O(1); user-space mallocs use size classes and per-thread caches",
      "Leaks, use-after-free, double free and overflows are caught by ASan, Valgrind and friends",
    ],
    code: [
      {
        title: "A tiny malloc: first fit, splitting and coalescing",
        linux: true,
        variants: [{ lang: "c", code: `// A tiny malloc: a first-fit free list inside one 1 KiB arena, with splitting and coalescing.
#include <stddef.h>
#include <stdio.h>

#define ARENA 1024
typedef struct block {
    size_t size;                 // payload bytes after this header
    int free;
    struct block *next;          // the next block in address order
} block;

static _Alignas(16) unsigned char arena[ARENA];
static block *head;

static size_t align16(size_t n) { return (n + 15) & ~(size_t)15; }
#define HDR align16(sizeof(block))   // 32 bytes of bookkeeping per block

static void *my_malloc(size_t n) {
    n = align16(n);
    for (block *b = head; b; b = b->next) {               // first fit: the first hole that's big enough
        if (!b->free || b->size < n) continue;
        if (b->size >= n + HDR + 16) {                     // plenty left over: split it
            block *rest = (block *)((unsigned char *)b + HDR + n);
            rest->size = b->size - n - HDR;
            rest->free = 1;
            rest->next = b->next;
            b->size = n;
            b->next = rest;
        }
        b->free = 0;
        return (unsigned char *)b + HDR;
    }
    return NULL;                                           // no hole is big enough
}

static void my_free(void *p) {
    block *b = (block *)((unsigned char *)p - HDR);
    b->free = 1;
    for (block *x = head; x; x = x->next)                  // coalesce: merge free neighbours
        while (x->free && x->next && x->next->free) {
            x->size += HDR + x->next->size;
            x->next = x->next->next;
        }
}

static void show(const char *what) {
    size_t total = 0, largest = 0;
    printf("%-20s", what);
    for (block *b = head; b; b = b->next) {
        printf(" [%s %zu]", b->free ? "free" : "used", b->size);
        if (b->free) {
            total += b->size;
            if (b->size > largest) largest = b->size;
        }
    }
    printf("   free %zu, largest hole %zu\\n", total, largest);
}

int main(void) {
    head = (block *)arena;
    head->size = ARENA - HDR;
    head->free = 1;
    head->next = NULL;
    show("start");
    void *a = my_malloc(100);
    show("a = malloc(100)");
    void *b = my_malloc(200);
    show("b = malloc(200)");
    void *c = my_malloc(100);
    show("c = malloc(100)");
    my_free(b);
    show("free(b)");
    void *d = my_malloc(50);
    show("d = malloc(50)");
    void *e = my_malloc(500);
    printf("e = malloc(500)      -> %s\\n", e ? "ok" : "NULL: enough free bytes in total, but no single hole is big enough");
    my_free(a);
    show("free(a)");
    my_free(d);
    show("free(d)");
    my_free(c);
    show("free(c)");
    return 0;
}` }],
        explain: `- The whole heap is one 1 KiB array. Each block starts with a 32-byte \`block\` header (size, free flag, next pointer), and sizes are rounded up to 16 bytes for alignment, so \`malloc(100)\` takes 112.
- \`my_malloc\` walks the list and takes the **first** free block that's big enough, **splitting** off the rest as a new free block when there's room.
- After \`free(b)\` there's a 208-byte hole in the middle. \`malloc(50)\` lands in it (first fit), leaving a 112-byte hole.
- Now there are **576 free bytes**, yet \`malloc(500)\` fails: the largest hole is 464. That's external fragmentation in one line.
- \`my_free\` **coalesces** free neighbours. Freeing a and d merges three blocks into one of 352, and freeing c reunites the whole arena.`,
        output: `start                [free 992]   free 992, largest hole 992
a = malloc(100)      [used 112] [free 848]   free 848, largest hole 848
b = malloc(200)      [used 112] [used 208] [free 608]   free 608, largest hole 608
c = malloc(100)      [used 112] [used 208] [used 112] [free 464]   free 464, largest hole 464
free(b)              [used 112] [free 208] [used 112] [free 464]   free 672, largest hole 464
d = malloc(50)       [used 112] [used 64] [free 112] [used 112] [free 464]   free 576, largest hole 464
e = malloc(500)      -> NULL: enough free bytes in total, but no single hole is big enough
free(a)              [free 112] [used 64] [free 112] [used 112] [free 464]   free 688, largest hole 464
free(d)              [free 352] [used 112] [free 464]   free 816, largest hole 464
free(c)              [free 992]   free 992, largest hole 992`,
      },
      {
        title: "The buddy system (Python)",
        variants: [{ lang: "python", code: `# A buddy allocator: 1024 KiB split into power-of-two blocks; freed buddies merge back together.
TOTAL, MIN = 1024, 64
blocks = {0: [TOTAL, None]}        # start address -> [size, owner or None if free]
asked = {}


def alloc(owner, kib):
    size = MIN
    while size < kib:
        size *= 2
    fits = sorted((s, a) for a, (s, o) in blocks.items() if o is None and s >= size)
    if not fits:
        return print(f"{owner} wants {kib}: no block big enough")
    s, a = fits[0]                 # the smallest free block that fits
    while s > size:                # split in half; the upper half becomes a free "buddy"
        s //= 2
        blocks[a + s] = [s, None]
    blocks[a] = [size, owner]
    asked[owner] = kib
    show(f"{owner} = alloc({kib})")


def free(owner):
    a = next(a for a, (s, o) in blocks.items() if o == owner)
    s = blocks[a][0]
    blocks[a][1] = None
    while s < TOTAL:
        buddy = a ^ s              # a block's buddy differs in exactly one address bit
        if blocks.get(buddy) != [s, None]:
            break
        del blocks[max(a, buddy)]
        a, s = min(a, buddy), s * 2
        blocks[a] = [s, None]
    show(f"free({owner})")


def show(label):
    cells = " ".join(f"[{o}:{s}]" if o else f"[{s}]" for a, (s, o) in sorted(blocks.items()))
    print(f"{label:15} {cells}")


show("start")
alloc("A", 34)
alloc("B", 66)
alloc("C", 35)
alloc("D", 67)
given = sum(s for s, o in blocks.values() if o)
print(f"asked for {sum(asked.values())} KiB, got {given} KiB: {given - sum(asked.values())} KiB lost to internal fragmentation")
for who in "CABD":
    free(who)` }],
        explain: `- All sizes are powers of two from 64 to 1024 KiB. A request of 34 is rounded up to 64.
- To serve A, the 1024 block is split into 512 + 512, then 256 + 256, 128 + 128, 64 + 64, and A gets the first 64. Each split leaves a free **buddy** behind.
- \`buddy = a ^ s\` flips the one address bit that distinguishes the two halves: the buddy of the 64-block at 0 is at 64, and the buddy of the 128-block at 128 is at 0.
- The four requests total 202 KiB but occupy 384 KiB: **internal fragmentation** is the price of easy merging.
- Freeing cascades: when A frees, it merges with C's freed block into 128; when B frees, that 128 merges into 256; when D frees, everything merges back into 1024.`,
        output: `start           [1024]
A = alloc(34)   [A:64] [64] [128] [256] [512]
B = alloc(66)   [A:64] [64] [B:128] [256] [512]
C = alloc(35)   [A:64] [C:64] [B:128] [256] [512]
D = alloc(67)   [A:64] [C:64] [B:128] [D:128] [128] [512]
asked for 202 KiB, got 384 KiB: 182 KiB lost to internal fragmentation
free(C)         [A:64] [64] [B:128] [D:128] [128] [512]
free(A)         [128] [B:128] [D:128] [128] [512]
free(B)         [256] [D:128] [128] [512]
free(D)         [1024]`,
      },
    ],
    interview: [
      {
        q: "How does malloc work?",
        freq: "very-common",
        a: `It manages memory obtained from the kernel (\`brk\` for the main heap, \`mmap\` for large blocks and extra arenas). Each chunk has a header with its size and flags. Free chunks are kept in lists (bins) by size; \`malloc\` finds a suitable chunk (using size classes, per-thread caches and a fit policy), splits it if it's too big, and returns a pointer past the header. \`free\` marks it free, coalesces with free neighbours, and puts it in a bin (or a per-thread cache); large mmapped chunks are returned directly with \`munmap\`. Locks or per-thread arenas handle concurrency.`,
      },
      {
        q: "What's the difference between internal and external fragmentation?",
        freq: "very-common",
        a: `**Internal**: wasted space inside allocated blocks, because the allocator handed out more than requested (alignment, size classes, power-of-two buddy blocks, the unused tail of a page). **External**: free memory exists in total but is split into non-contiguous holes too small for a request. Paging removes external fragmentation of physical memory; compaction (moving GCs) and coalescing reduce it in heaps; finer size classes reduce internal fragmentation.`,
      },
      {
        q: "Compare first fit, best fit and worst fit.",
        freq: "common",
        a: `**First fit** takes the first free block large enough: fast, and in simulations about as good as best fit for fragmentation, though small leftovers gather at the front. **Best fit** takes the smallest adequate block, minimising leftover per allocation but leaving many tiny unusable fragments and requiring a full scan (or a size-ordered tree). **Worst fit** takes the largest block to leave a usable remainder, but quickly destroys large blocks; it's generally worst. Real allocators mostly use segregated size classes, which approximate best fit in O(1).`,
      },
      {
        q: "Explain the buddy allocator. Why does Linux use it for pages?",
        freq: "common",
        a: `Memory is managed in power-of-two blocks with a free list per size (order). Allocation rounds up and splits larger blocks in halves until reaching the right order; freeing checks whether the block's buddy (address XOR size) is free and merges them, repeatedly. Splitting and merging are O(log n) and very cheap, and it naturally provides physically contiguous, aligned blocks (needed for DMA and huge pages). The downside is internal fragmentation up to nearly 50%, which is why the kernel layers the slab allocator on top for small objects.`,
      },
      {
        q: "What is a slab allocator?",
        freq: "occasional",
        a: `An allocator for many objects of the same size and type, introduced in SunOS and used by Linux (SLAB, now SLUB). Each object type has a cache made of slabs (one or more pages) divided into equal slots. Allocation and freeing are O(1) pops and pushes on a per-CPU free list, there's no external fragmentation within a slab, and objects can keep their initialised state between uses. It reduces both fragmentation and initialisation cost for hot kernel structures like inodes and task structs.`,
      },
      {
        q: "How would you find a memory leak in a long-running C++ or Go service?",
        freq: "common",
        a: `Confirm growth first (RSS over time, heap metrics). For C/C++: run with LeakSanitizer or Valgrind in tests, or use a heap profiler in production (jemalloc/tcmalloc heap profiles, \`heaptrack\`, eBPF tools like \`memleak\`) and compare snapshots to see which call stacks keep allocating without freeing. Be aware that RSS may not drop after frees (fragmentation, the allocator keeping memory), which isn't a leak. For Go: \`pprof\` heap profiles (\`inuse_space\`), and look for growing maps, goroutine leaks or forgotten caches. In GC languages a "leak" is usually a reachable reference you forgot to drop.`,
      },
    ],
    quiz: [
      {
        q: "There's 600 bytes free in total but malloc(400) fails. What's the cause?",
        options: ["Internal fragmentation", "External fragmentation: no single free hole is 400 bytes", "A memory leak", "The stack is full"],
        answer: 1,
        explain: "The free space exists, but it's split into holes that are each too small.",
      },
      {
        q: "A buddy allocator gets a request for 66 KiB. What block size does it hand out?",
        options: ["66 KiB", "64 KiB", "128 KiB", "1 MiB"],
        answer: 2,
        explain: "Sizes are powers of two, so 66 rounds up to 128; the extra 62 KiB is internal fragmentation.",
      },
      {
        q: "In a buddy system, the buddy of a 64 KiB block at address 128 KiB is at:",
        options: ["0", "64 KiB", "192 KiB", "256 KiB"],
        answer: 2,
        explain: "buddy = address XOR size = 128 XOR 64 = 192.",
      },
      {
        q: "Which placement policy picks the smallest free block that fits?",
        options: ["First fit", "Best fit", "Worst fit", "Next fit"],
        answer: 1,
        explain: "Best fit minimises the leftover, but tends to leave tiny slivers.",
      },
      {
        q: "What does coalescing do?",
        options: ["Moves allocated blocks together", "Merges adjacent free blocks into one bigger block", "Rounds sizes to powers of two", "Zeroes freed memory"],
        answer: 1,
        explain: "It keeps free holes from staying small after frees.",
      },
      {
        q: "Why can't C's malloc fix fragmentation by moving blocks, as Java's GC does?",
        options: ["Moving is slow", "C programs hold raw pointers that would become invalid", "The kernel forbids it", "It can"],
        answer: 1,
        explain: "A compacting GC can update every reference; C has no way to find and fix raw pointers.",
      },
      {
        q: "Which tool catches use-after-free and heap buffer overflows at run time?",
        options: ["AddressSanitizer", "gzip", "strace", "top"],
        answer: 0,
        explain: "Compile with -fsanitize=address; it reports the bad access with allocation and free stack traces.",
      },
    ],
  },
];
