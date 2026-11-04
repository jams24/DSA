import type { Lesson } from "../types";

// Operating Systems, part 1: the big picture.

export const osPart1: Lesson[] = [
  // ------------------------------------------------------------------ WHAT IS AN OS
  {
    id: "os-intro",
    part: "Part 1 · The big picture",
    title: "What is an operating system?",
    tagline: "The manager that shares one computer between many programs: what it does, the kernel, the kinds of OS, and how kernels are built.",
    difficulty: "beginner",
    minutes: 25,
    diagram: {
      title: "What happens when you run a program",
      nodes: [
        { id: "you", label: "You", kind: "client", x: 100, y: 120, sub: "keyboard + screen" },
        { id: "shell", label: "Shell", kind: "service", x: 300, y: 120, sub: "bash / zsh" },
        { id: "kernel", label: "Kernel", kind: "control", x: 520, y: 280, sub: "the OS core" },
        { id: "disk", label: "Disk", kind: "storage", x: 800, y: 120, sub: "file ./hello" },
        { id: "ram", label: "Memory", kind: "cache", x: 800, y: 440, sub: "RAM" },
        { id: "cpu", label: "CPU", kind: "node", x: 520, y: 470, sub: "runs instructions" },
        { id: "screen", label: "Terminal", kind: "external", x: 160, y: 430, sub: "draws text" },
      ],
      edges: [
        { from: "you", to: "shell", label: "types ./hello" },
        { from: "shell", to: "kernel", label: "fork + exec" },
        { from: "kernel", to: "disk", label: "read file" },
        { from: "kernel", to: "ram", label: "map pages" },
        { from: "kernel", to: "cpu", label: "schedule" },
        { from: "cpu", to: "ram", label: "fetch code" },
        { from: "kernel", to: "screen", label: "write()" },
        { from: "screen", to: "you" },
      ],
      flows: [
        {
          name: "Running ./hello",
          path: ["you", "shell", "kernel", "disk", "kernel", "ram", "cpu", "kernel", "screen", "you"],
          steps: [
            "You type ./hello and press Enter. The keyboard sends an interrupt, the kernel passes the keys to the terminal, and the shell reads the whole line.",
            "The shell asks the kernel to copy it (fork), and the copy asks the kernel to replace itself with the program (execve(\"./hello\")).",
            "The kernel finds the file through the file system and reads its header: where the code is, where to start.",
            "Back in the kernel: it throws away the old memory of the copied shell and builds a fresh, empty address space.",
            "It maps the program's code and data into memory. Nothing is copied yet: pages load from disk the first time they're touched.",
            "The scheduler puts the new process on a CPU core. The CPU starts fetching instructions from the program's entry point.",
            "The program calls printf, which calls write(): a system call that traps into the kernel, because only the kernel may touch devices.",
            "The kernel hands the bytes to the terminal, which draws \"Hello\". Then the program calls exit() and the kernel frees everything it owned.",
            "The shell was waiting (wait()) for its child. It wakes up and prints the prompt again.",
          ],
        },
        {
          name: "Two programs at once",
          path: ["cpu", "kernel", "ram", "kernel", "cpu"],
          steps: [
            "A hardware timer interrupts the CPU every few milliseconds. The CPU stops the running program and jumps into the kernel.",
            "The kernel saves the program's registers and picks another ready program to run next.",
            "It switches to that program's memory map, so the CPU now sees the other program's memory.",
            "It restores the other program's registers and returns. The switch took a few microseconds.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Imagine a busy **restaurant kitchen**. There's one big stove, one fridge, a pantry and a door to the dining room. Lots of cooks (the **programs**: your browser, a game, music) all want to use them at the same time.

If everyone just grabbed the stove, pans would crash, food would burn, and one greedy cook could hog everything. So the kitchen has a **head chef** who:
- gives every cook a **turn** at the stove, so fast that it looks like they all cook at once (that's **CPU scheduling**),
- gives every cook **their own counter space** that nobody else can mess with (that's **memory management**),
- keeps the **pantry labelled and organised** so food can be found again tomorrow (that's the **file system**),
- is the **only one allowed to talk to the waiters and the delivery van** (that's **device drivers**),
- and **throws out** any cook who breaks the rules (that's **protection**).

The **operating system** is that head chef. The kitchen is the **hardware**: CPU, memory, disk, keyboard, screen, network card.

## What an operating system really is
An **operating system (OS)** is the software that **manages the hardware** and **gives programs a simple, safe way to use it**. It has three big jobs (the book *Operating Systems: Three Easy Pieces* calls them its three pieces):

| Job | What it means | Examples you'll meet in this world |
|---|---|---|
| **Virtualisation** (the illusionist) | Turns one CPU into "a CPU for every program" and real RAM into "a private memory for every program" | processes, scheduling, virtual memory |
| **Concurrency** (the referee) | Lets many things happen at once without corrupting shared data | threads, locks, semaphores, deadlock |
| **Persistence** (the librarian) | Keeps data safe on disk even when power goes off | files, directories, file systems, journaling |

On top of those it provides **protection** (programs can't read each other's memory or wreck the disk), **devices** (one "write to file" works for SSDs, USB sticks and network drives) and a **user interface** (a shell or a desktop).

The OS turns messy hardware into clean **abstractions**:

| Hardware reality | Abstraction the OS gives you |
|---|---|
| A few CPU cores | **Processes** and **threads**, each acting as if it had its own CPU |
| One big array of RAM | A private **address space** per process |
| Disk sectors and flash blocks | **Files** and **directories** |
| A network card sending frames | **Sockets** that send and receive byte streams |
| Keyboards, screens, printers | **File descriptors** you read and write |

## The kernel and everything else
The **kernel** is the core of the OS: it's always in memory and runs in the CPU's **privileged mode**, so it can touch hardware directly. Everything else (your apps, the shell, the desktop, even most of the "OS" you see) runs in **user mode** and must **ask** the kernel for help through **system calls**.

| Runs in kernel mode | Runs in user mode |
|---|---|
| Scheduler, memory manager, file systems, network stack, device drivers | Apps, shell (bash), desktop, system services, the C library |

When people say "Linux", they often mean a whole system (kernel + tools + desktop). Strictly, **Linux is the kernel**; distributions like Ubuntu or Fedora add the rest.

## Kinds of operating systems
- **Desktop**: Windows, macOS, Linux distributions.
- **Mobile**: Android (Linux kernel underneath), iOS (Apple's XNU kernel, same as macOS).
- **Server and cloud**: overwhelmingly Linux. Nearly every website and cloud machine you use runs on it.
- **Embedded and real-time (RTOS)**: FreeRTOS, Zephyr, QNX, VxWorks. They run cars, routers, pacemakers and drones, where *missing a deadline* is a bug.
- Historical styles you'll hear about in interviews:
  - **Batch**: run one job after another, with no interaction.
  - **Multiprogramming**: keep several jobs in memory, and when one waits for I/O, run another.
  - **Time-sharing** (multitasking): switch so fast that many users feel they have the machine to themselves.
  - **Real-time**: guaranteed response times.
  - **Distributed**: many machines working as one.

## How kernels are built
| Design | Idea | Examples | Trade-off |
|---|---|---|---|
| **Monolithic** | Everything (drivers, file systems, networking) runs inside the kernel, in one address space | Linux, FreeBSD | Fast (plain function calls), but a buggy driver can crash the whole system |
| **Microkernel** | The kernel does only the minimum (scheduling, memory, message passing); drivers and file systems are ordinary processes | seL4, QNX, MINIX 3 | Robust and secure (a crashed driver restarts), but messages cost more than function calls |
| **Hybrid** | A microkernel-style design with performance-critical parts moved back into the kernel | Windows NT, macOS/iOS (XNU) | A pragmatic middle |
| **Unikernel** | The app and a tiny library OS are compiled into one image that runs on a hypervisor | MirageOS, Unikraft | Tiny and fast to boot, but runs one app with little isolation inside |

Linux is monolithic but **modular**: drivers can be loaded and unloaded at run time as **kernel modules** (\`lsmod\`, \`modprobe\`) without rebooting.

## A two-minute history
1. **1940s–50s, no OS**: one program at a time, loaded by hand with switches and punch cards.
2. **1960s, batch systems and multiprogramming**: the CPU stays busy while a job waits for tape.
3. **1969, Unix** at Bell Labs: "everything is a file", small tools joined with pipes, written in C so it could be ported. Its ideas are everywhere today.
4. **1980s–90s, personal computers**: MS-DOS, then Windows and Mac OS. **Linux** appears in 1991.
5. **2000s–now**: smartphones, then the cloud. Virtual machines and containers run thousands of isolated systems on shared hardware.

## Read the code samples
- The first sample shows the gap between your program and the kernel: \`printf\` collects text in a **buffer** inside your program, while \`write()\` hands it straight to the kernel.
- The second is a toy "OS" that shares one pretend CPU between three programs, which is exactly what a real scheduler does thousands of times a second.`,
    keyPoints: [
      "The OS manages hardware and gives programs safe, simple abstractions: processes, address spaces, files, sockets",
      "Its three pieces: virtualisation (CPU and memory), concurrency, persistence, plus protection",
      "The kernel runs in privileged mode; apps run in user mode and ask the kernel through system calls",
      "Linux is a monolithic kernel with loadable modules; microkernels move drivers into user space",
      "Time-sharing switches between programs so fast that each seems to have the CPU to itself",
    ],
    code: [
      {
        title: "printf vs write(): your program vs the kernel",
        linux: true,
        variants: [{ lang: "c", code: `// Two ways to print: the C library's printf, and the write() system call underneath it.
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void) {
    printf("1. printf: goes into a buffer inside my program first\\n");

    const char *msg = "2. write(): goes straight to the kernel\\n";
    write(STDOUT_FILENO, msg, strlen(msg));   // fd 1 = standard output

    printf("3. printf again (still in the buffer)\\n");
    return 0;                                  // exit flushes the buffer: lines 1 and 3 appear now
}` }],
        explain: `- **Look at the order of the output**: line 2 came *first*. \`printf\` doesn't talk to the kernel. It copies text into a **buffer** in your own program's memory (part of the C library).
- \`write(1, ...)\` is a **system call**: it goes straight to the kernel, which sends the bytes to the screen or pipe right away.
- When \`main\` returns, the C library **flushes** its buffer with one \`write()\`, so lines 1 and 3 come out together at the end.
- **In a terminal you'd see 1, 2, 3**, because when stdout is a terminal the C library flushes at every newline (*line buffering*). Here the output was captured through a pipe, so it's *fully buffered* (4 KiB or more). This exact surprise bites people who mix \`printf\` and \`write\`, or who \`fork()\` with unflushed output.
- Buffering exists because system calls are expensive (about 100× a function call; see the system-calls level). One \`write\` of 4 KiB beats 4,096 writes of one byte.
- Compile and run it yourself: \`gcc hello.c -o hello && ./hello\`, then \`./hello | cat\` to see the other order.`,
        output: `2. write(): goes straight to the kernel
1. printf: goes into a buffer inside my program first
3. printf again (still in the buffer)`,
      },
      {
        title: "A toy OS that shares one CPU",
        variants: [{ lang: "python", code: `# A toy operating system: three "programs" share ONE pretend CPU by taking turns.
from collections import deque

programs = {
    "music": ["load song", "play bar 1", "play bar 2"],
    "game": ["read keys", "move player", "draw frame", "read keys"],
    "chat": ["check messages", "show 1 new message"],
}

TIME_SLICE = 2                      # how many steps a program may run before it must give up the CPU
ready = deque(programs)             # the "ready queue": programs waiting for their turn
clock = 0

while ready:
    name = ready.popleft()
    print(f"[OS] t={clock}: {name} gets the CPU")
    for _ in range(TIME_SLICE):
        step = programs[name].pop(0)
        print(f"       {name}: {step}")
        clock += 1
        if not programs[name]:
            print(f"[OS] {name} is finished")
            break
    else:
        ready.append(name)          # time slice used up: go to the back of the line

print(f"[OS] all done at t={clock}. Each program felt like it had the CPU to itself.")` }],
        explain: `- Each program is just a list of steps. The **ready queue** holds the programs waiting for the CPU.
- The toy OS gives the front program a **time slice** of 2 steps, then moves it to the back of the line. This is **round-robin scheduling**, which you'll study properly in the CPU scheduling level.
- When a program has no steps left, it **finishes** and leaves the queue.
- Real computers do the same, but a step is millions of instructions and a slice is a few milliseconds. A hardware **timer interrupt** forces the switch, so a program can't refuse to give up the CPU.
- The final line is the whole point: **virtualisation**. Three programs, one CPU, and each one behaves as if it ran alone.`,
        output: `[OS] t=0: music gets the CPU
       music: load song
       music: play bar 1
[OS] t=2: game gets the CPU
       game: read keys
       game: move player
[OS] t=4: chat gets the CPU
       chat: check messages
       chat: show 1 new message
[OS] chat is finished
[OS] t=6: music gets the CPU
       music: play bar 2
[OS] music is finished
[OS] t=7: game gets the CPU
       game: draw frame
       game: read keys
[OS] game is finished
[OS] all done at t=9. Each program felt like it had the CPU to itself.`,
      },
      {
        title: "Meet your OS from the shell",
        note: "Commands to try on any Linux machine (or WSL, or a container). The output depends on your machine.",
        variants: [
          {
            lang: "bash",
            code: `uname -srm                 # kernel name, version and CPU architecture
cat /etc/os-release        # which distribution (Ubuntu, Debian, Fedora ...)
nproc                      # how many CPU cores the OS can schedule on
free -h                    # memory: total, used, and how much is page cache
ps -e --forest | head -20  # the process tree, starting from PID 1
lsmod | head               # kernel modules (drivers) loaded right now
ls /proc | head            # /proc: the kernel showing its data as files`,
          },
        ],
        explain: `- \`uname\` asks the kernel about itself through the \`uname()\` system call. You'll see something like \`Linux 6.8.0-45-generic x86_64\`.
- \`ps -e --forest\` shows that every process has a parent, all the way back to **PID 1** (\`systemd\` or \`init\`), the first program the kernel starts at boot.
- \`/proc\` isn't on disk at all: the kernel generates those "files" on the fly when you read them. You'll use it a lot in the Linux-in-practice level.`,
      },
    ],
    interview: [
      {
        q: "What is an operating system, and what are its main functions?",
        freq: "very-common",
        a: `Software that **manages hardware resources** and **provides services and abstractions** to programs. Main functions:
- **Process management**: create and schedule processes and threads, and handle synchronisation and IPC.
- **Memory management**: virtual memory, allocation, protection between processes.
- **Storage**: file systems, caching, disk I/O.
- **Device management**: drivers and a uniform I/O interface.
- **Protection and security**: users, permissions, isolation between processes and the kernel.
- **User interface**: a shell or GUI, plus system calls for programs.

A good one-liner: "it virtualises the CPU and memory, coordinates concurrency, and persists data, while protecting programs from each other."`,
      },
      {
        q: "What's the difference between the kernel and the operating system?",
        freq: "common",
        a: `The **kernel** is the privileged core: always resident, running in kernel mode, handling scheduling, memory, drivers, file systems and system calls. The **OS** in everyday language is the kernel *plus* the user-space pieces that make it usable: C library, shell, init system, utilities, often a GUI. Linux is a kernel; Ubuntu is an OS (distribution) built on it.`,
      },
      {
        q: "Monolithic kernel vs microkernel: what's the trade-off?",
        freq: "very-common",
        a: `- **Monolithic** (Linux): drivers, file systems and networking all run in kernel space and call each other directly. That's **fast**, but a bug in any driver can crash or compromise the whole system, and the trusted code base is huge.
- **Microkernel** (seL4, QNX, MINIX 3): the kernel keeps only address spaces, threads, scheduling and **IPC**. Drivers and file systems are user processes. That's **more reliable and secure** (a crashed driver restarts; seL4 is formally verified), but every service request is a message plus context switches, so it's **slower**.
- **Hybrid** (Windows NT, XNU) mixes the two. Linux softens its downside with **loadable modules**, and with user-space drivers where speed allows (FUSE file systems, DPDK networking).`,
      },
      {
        q: "Multiprogramming vs multitasking vs multiprocessing vs multithreading?",
        freq: "common",
        a: `- **Multiprogramming**: several programs in memory, so when one waits for I/O the CPU runs another. The goal is high CPU utilisation.
- **Multitasking (time-sharing)**: the CPU switches between programs on a timer, fast enough to feel interactive. The goal is responsiveness.
- **Multiprocessing**: more than one CPU or core, so things run truly in parallel.
- **Multithreading**: several threads of execution inside one process, sharing its memory.`,
      },
      {
        q: "What is a real-time operating system?",
        freq: "occasional",
        a: `An OS that guarantees **bounded response times**. **Hard real-time** means missing a deadline is a failure (airbags, pacemakers). **Soft real-time** means a missed deadline degrades quality (video, audio). RTOSes use priority-based **preemptive scheduling**, bounded interrupt latency, priority-inheritance locks, and avoid unpredictable things like demand paging. Examples: FreeRTOS, Zephyr, QNX, VxWorks, and Linux with PREEMPT_RT (merged into mainline in 6.12).`,
      },
      {
        q: "Why does printf output sometimes appear in a different order from write() output, or twice after fork()?",
        freq: "occasional",
        a: `\`printf\` writes into a user-space **stdio buffer**. It's flushed at newline only when stdout is a terminal (*line buffered*); to a pipe or file it's *fully buffered* and flushed when full, on \`fflush\` or at \`exit\`. \`write()\` bypasses the buffer, so it can overtake earlier \`printf\` text.

After \`fork()\`, the child gets a **copy** of the unflushed buffer, so both processes flush it and the text appears twice. Fixes: \`fflush(stdout)\` before \`fork\`, use \`_exit\` in the child, or \`setvbuf\` to change buffering.`,
      },
    ],
    quiz: [
      {
        q: "Which part of the OS runs in the CPU's privileged mode?",
        options: ["The shell", "The kernel", "The C library", "Every program the administrator starts"],
        answer: 1,
        explain: "Only the kernel runs in kernel (privileged) mode. Shells, libraries and even root's programs run in user mode and use system calls.",
      },
      {
        q: "The OS makes one CPU look like a separate CPU for every program. What is this called?",
        options: ["Persistence", "Virtualisation", "Paging", "Spooling"],
        answer: 1,
        explain: "Virtualising the CPU (processes + scheduling) and memory (address spaces) is the OS's first big job.",
      },
      {
        q: "Linux is best described as:",
        options: ["A microkernel", "A monolithic kernel with loadable modules", "An exokernel", "A hybrid kernel like Windows NT"],
        answer: 1,
        explain: "All core services run in kernel space, and drivers can be loaded at run time as modules.",
      },
      {
        q: "What is the main advantage of a microkernel?",
        options: ["Faster system calls", "Fewer context switches", "A crashing driver doesn't take down the kernel", "No need for IPC"],
        answer: 2,
        explain: "Drivers and services run as isolated user processes, so faults are contained, at the cost of IPC overhead.",
      },
      {
        q: "A program prints with printf and then calls write(). Its output goes to a pipe. What can happen?",
        options: ["write() text can appear before the printf text", "The printf text is lost", "The program crashes", "Both always appear in program order"],
        answer: 0,
        explain: "To a pipe, stdio is fully buffered: printf text waits in the buffer while write() goes straight to the kernel.",
      },
      {
        q: "Which OS style keeps several jobs in memory so the CPU can run one while another waits for I/O?",
        options: ["Batch", "Multiprogramming", "Real-time", "Single-tasking"],
        answer: 1,
        explain: "Multiprogramming overlaps I/O waits with computation to keep the CPU busy.",
      },
      {
        q: "Which of these is NOT an abstraction the OS provides?",
        options: ["Process", "File", "Socket", "Cache line"],
        answer: 3,
        explain: "Cache lines are a hardware detail the OS mostly leaves alone. Processes, files and sockets are OS abstractions.",
      },
    ],
  },

  // ------------------------------------------------------------------ HARDWARE
  {
    id: "os-hardware",
    title: "The hardware: CPU, memory and devices",
    tagline: "Fetch-decode-execute, registers, caches and the memory hierarchy, locality, buses, interrupts and DMA: what the OS is managing.",
    difficulty: "beginner",
    minutes: 25,
    visualizers: ["cpu", "latency"],
    concept: `## Explain it like I'm 10 🧸
The **CPU** is a super-fast worker who can only follow a recipe **one tiny step at a time**: "take the number from box A", "add box B to it", "if it's bigger than 10, go to step 7". It does **billions** of these steps every second.

The worker keeps things at different distances:
- a **sticky note in their hand** (registers): instant, but holds only a few numbers,
- a **desk** (CPU cache): very quick, small,
- a **bookshelf across the room** (RAM): big, but walking there takes ages compared with glancing at the hand,
- a **warehouse across town** (the SSD or hard disk): huge, keeps things even when the lights go off, but a trip there is *extremely* slow.

A good worker keeps what they're using **close by**. The operating system's job is to keep the right stuff on the desk and shelf and to send the slow trips to the warehouse in the background.

## The CPU: fetch, decode, execute
A CPU runs **machine instructions**, simple commands like \`ADD\`, \`LOAD\`, \`STORE\`, \`JUMP\`. Its heartbeat is the **instruction cycle**:
1. **Fetch** the instruction at the address in the **program counter (PC)**.
2. **Decode** it: which operation, which registers.
3. **Execute** it: the **ALU** (arithmetic logic unit) does the maths, or memory is read or written.
4. Move the PC to the next instruction (or somewhere else, for a jump), and repeat.

**Registers** are a handful of tiny, ultra-fast storage slots inside the CPU. x86-64 has 16 general-purpose ones (\`rax\`, \`rbx\` ...) and ARM64 has 31. Special ones:
- **PC / instruction pointer**: the next instruction.
- **SP, the stack pointer**: the top of the current stack.
- **Flags / status register**: zero, negative, carry, overflow, and *which privilege mode we're in*.

When the OS switches from one program to another, it saves **all of these registers** and loads the other program's set. That's a **context switch**.

Modern CPUs cheat to go faster, while pretending they don't:
- **Pipelining**: they work on several instructions at once, at different stages.
- **Superscalar and out-of-order execution**: several instructions per cycle, in whatever order is ready.
- **Branch prediction**: they guess which way an \`if\` goes and run ahead.
- **Multiple cores**: several CPUs on one chip.
- **Simultaneous multithreading** (Intel's *Hyper-Threading*): two instruction streams sharing one core.

## The memory hierarchy
| Level | Typical size | Typical latency | In the analogy |
|---|---|---|---|
| Registers | ~1 KiB | < 1 ns (0 extra cycles) | in your hand |
| L1 cache | 32–64 KiB per core | ~1 ns (4 cycles) | on the desk |
| L2 cache | 0.5–2 MiB per core | ~3–5 ns | desk drawer |
| L3 cache | 8–64 MiB shared | ~10–40 ns | shelf by the desk |
| RAM (DRAM) | 8–512 GiB | ~80–100 ns | bookshelf across the room |
| NVMe SSD | TBs | ~20–100 µs | warehouse in town |
| Hard disk | TBs | ~5–10 ms | warehouse in another city |

From L1 to a hard disk is roughly **ten million times** slower. If an L1 hit took 1 second, a disk read would take **4 months**. The latency visualizer lets you feel this.

**Caches** work because programs have **locality**:
- **Temporal locality**: what you used recently, you'll probably use again (loop variables, hot functions).
- **Spatial locality**: what's next to it, you'll probably use soon (the next array element).

Caches move memory in **cache lines** of 64 bytes. Read one \`int\` and its 15 neighbours come along for free. That's why walking an array **in order** is fast and jumping around is slow (see the second code sample: same work, about 15× different speed).

## Talking to devices
A device (disk, network card, keyboard, GPU) has a **controller** with its own registers and buffers. The CPU talks to it through:
- **Memory-mapped I/O**: device registers appear at special memory addresses. This is the normal way today.
- **Port I/O**: special \`in\`/\`out\` instructions (old x86 style).

How does the CPU know when the device is done?
| Method | How | Good for |
|---|---|---|
| **Polling** | The CPU keeps asking "done yet?" | Very fast devices where waiting is shorter than an interrupt (high-speed NVMe or networking at extreme rates) |
| **Interrupts** | The device raises a signal; the CPU pauses what it's doing and runs the OS's **interrupt handler** | Everything else: keyboard, disk completion, network packets |
| **DMA** (direct memory access) | The device copies data into RAM **by itself**, then interrupts once at the end | Big transfers: disk blocks, network packets, GPU buffers |

A special device matters most to the OS: the **timer**. It interrupts every few milliseconds, which lets the kernel take the CPU back from a program that never gives it up. Without it there'd be no preemptive multitasking.

## Other words you'll hear
- **Word size (32-bit vs 64-bit)**: how wide registers and addresses are. 64-bit pointers can address far more than 4 GiB.
- **Endianness**: the byte order of numbers in memory. x86 and ARM are **little-endian** (lowest byte first); network protocols use **big-endian** ("network byte order").
- **Bus / interconnect**: the wiring between CPU, memory and devices (PCIe for devices).
- **NUMA** (non-uniform memory access): on big servers each CPU socket has its own nearby RAM. Memory attached to the other socket is slower, so the OS tries to keep a thread near its memory.
- **Firmware** (BIOS/UEFI): code in a chip on the motherboard that starts the machine. That's the next level.`,
    keyPoints: [
      "The CPU repeats fetch → decode → execute, driven by the program counter",
      "Registers are the CPU's tiny working set; a context switch saves and restores them",
      "Memory hierarchy: registers → L1/L2/L3 → RAM → SSD → HDD, each level ~10× to 1000× slower",
      "Caches work because of temporal and spatial locality, and move 64-byte cache lines",
      "Devices signal completion with interrupts; DMA moves bulk data without the CPU",
      "The timer interrupt is what lets the OS preempt programs",
    ],
    code: [
      {
        title: "A tiny CPU: fetch, decode, execute",
        variants: [{ lang: "python", code: `# A tiny CPU: 4 registers, a program counter (PC) and the fetch -> decode -> execute loop.
# Program: add up the numbers 1..5 into register A.
PROGRAM = [
    ("LOAD", "A", 0),     # 0: A = 0        (the running total)
    ("LOAD", "B", 1),     # 1: B = 1        (the counter)
    ("LOAD", "C", 6),     # 2: C = 6        (stop when B reaches 6)
    ("ADD", "A", "B"),    # 3: A = A + B
    ("INC", "B", None),   # 4: B = B + 1
    ("JLT", "B", "C"),    # 5: if B < C jump back to instruction 3
    ("HALT", None, None), # 6: stop
]

regs = {"A": 0, "B": 0, "C": 0}
pc = 0      # program counter: which instruction is next
cycles = 0
while True:
    op, x, y = PROGRAM[pc]          # FETCH the instruction the PC points at
    pc += 1                         # point at the next one
    cycles += 1
    # DECODE + EXECUTE
    if op == "LOAD":
        regs[x] = y
    elif op == "ADD":
        regs[x] = regs[x] + regs[y]
    elif op == "INC":
        regs[x] += 1
    elif op == "JLT":
        if regs[x] < regs[y]:
            pc = 3                  # a jump just overwrites the PC
    elif op == "HALT":
        break
    if op in ("ADD", "HALT") or cycles <= 3:
        print(f"cycle {cycles:2}: {op:<4} -> A={regs['A']:2} B={regs['B']} C={regs['C']}")

print(f"done in {cycles} cycles: 1+2+3+4+5 = {regs['A']}")` }],
        explain: `- \`PROGRAM\` is our machine code: each tuple is one instruction. A real CPU stores these as bytes in memory.
- \`pc\` is the **program counter**. Every loop iteration **fetches** \`PROGRAM[pc]\`, moves \`pc\` on, then **decodes** (the \`if\`/\`elif\` chain) and **executes**.
- \`JLT\` ("jump if less than") is how loops and \`if\` statements work at the bottom: it just overwrites the PC.
- It printed only some cycles to keep the output short. Adding 1 to 5 took **19 cycles**. A 4 GHz CPU does 4,000,000,000 cycles a second, and real CPUs finish several instructions per cycle.
- Play with the CPU visualizer to step through the same idea with registers lighting up.`,
        output: `cycle  1: LOAD -> A= 0 B=0 C=0
cycle  2: LOAD -> A= 0 B=1 C=0
cycle  3: LOAD -> A= 0 B=1 C=6
cycle  4: ADD  -> A= 1 B=1 C=6
cycle  7: ADD  -> A= 3 B=2 C=6
cycle 10: ADD  -> A= 6 B=3 C=6
cycle 13: ADD  -> A=10 B=4 C=6
cycle 16: ADD  -> A=15 B=5 C=6
done in 19 cycles: 1+2+3+4+5 = 15`,
      },
      {
        title: "Caches in action: walking memory in order vs jumping around",
        linux: true,
        variants: [{ lang: "c", code: `// Same work, different order: walking memory in the order it's laid out is much faster,
// because the CPU loads memory into its caches 64 bytes (one cache line) at a time.
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N 4096   // a 4096 x 4096 grid of ints = 64 MiB, far bigger than any CPU cache

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}

int main(void) {
    int *grid = malloc(sizeof(int) * N * N);   // row r, column c lives at grid[r * N + c]
    if (!grid) return 1;
    for (long i = 0; i < (long)N * N; i++) grid[i] = 1;

    double t0 = now();
    long row_sum = 0;
    for (int r = 0; r < N; r++)          // row by row: neighbouring addresses, cache-friendly
        for (int c = 0; c < N; c++) row_sum += grid[r * N + c];
    double row_time = now() - t0;

    t0 = now();
    long col_sum = 0;
    for (int c = 0; c < N; c++)          // column by column: each step jumps 16 KiB ahead
        for (int r = 0; r < N; r++) col_sum += grid[r * N + c];
    double col_time = now() - t0;

    printf("row order:    sum = %ld\\n", row_sum);
    printf("column order: sum = %ld\\n", col_sum);
    printf("row order was faster: %s\\n", row_time < col_time ? "yes" : "no");
    fprintf(stderr, "row %.3f s, column %.3f s (%.1fx slower)\\n", row_time, col_time, col_time / row_time);
    free(grid);
    return 0;
}` }],
        explain: `- Both loops add up the same 16,777,216 numbers, so the sums are identical. Only the **order** differs.
- Row order reads addresses one after another. Each 64-byte cache line brings in 16 ints, and the CPU's **prefetcher** sees the pattern and loads the next lines early.
- Column order jumps \`4096 × 4 = 16 KiB\` every step, so almost every read is a **cache miss** (and often a TLB miss too, as you'll learn in the virtual-memory level).
- On the test machine the timing line (printed to stderr) said \`row 0.010 s, column 0.158 s (16.4x slower)\`. Your numbers will differ, but column order is always several times slower.
- The lesson for real code: store data the way you'll read it (arrays of structs vs structs of arrays), and loop over the last index innermost in C, C++, Java and NumPy row-major arrays.`,
        output: `row order:    sum = 16777216
column order: sum = 16777216
row order was faster: yes`,
      },
      {
        title: "Type sizes and endianness",
        linux: true,
        variants: [{ lang: "c", code: `// How big are the basic types, and in which order does the CPU store the bytes of a number?
#include <stdint.h>
#include <stdio.h>

int main(void) {
    printf("char %zu, short %zu, int %zu, long %zu, pointer %zu bytes\\n",
           sizeof(char), sizeof(short), sizeof(int), sizeof(long), sizeof(void *));

    uint32_t n = 0x01020304;                 // four bytes: 01 02 03 04
    unsigned char *bytes = (unsigned char *)&n;
    printf("0x01020304 sits in memory as: %02x %02x %02x %02x\\n", bytes[0], bytes[1], bytes[2], bytes[3]);
    printf("this CPU is %s-endian\\n", bytes[0] == 0x04 ? "little" : "big");
    return 0;
}` }],
        explain: `- On 64-bit Linux and macOS, \`long\` and pointers are 8 bytes. On 64-bit **Windows**, \`long\` is still 4 bytes (the "LLP64" model), which is why portable code uses \`int64_t\` and friends.
- The number \`0x01020304\` is stored with its **lowest byte first** (\`04 03 02 01\`): x86-64 and ARM64 are **little-endian**.
- Network protocols send numbers **big-endian**, so code calls \`htonl()\` and \`ntohl()\` to convert. Forgetting is a classic bug when parsing binary formats.`,
        output: `char 1, short 2, int 4, long 8, pointer 8 bytes
0x01020304 sits in memory as: 04 03 02 01
this CPU is little-endian`,
      },
    ],
    interview: [
      {
        q: "Explain the memory hierarchy and why caches work.",
        freq: "very-common",
        a: `Storage gets bigger, cheaper and slower as you move away from the CPU: registers, then L1, L2 and L3 caches, then DRAM, SSD and HDD. Caches keep recently and nearby used data close, and they work because real programs show **locality**:
- **Temporal locality**: data used recently is likely to be reused.
- **Spatial locality**: data near recently used data is likely to be used next.

Data moves in **cache lines** (64 B), and hardware **prefetchers** load lines ahead of sequential access. Hit rates above 95% make the average access time close to the cache's latency even though RAM is about 100× slower.`,
      },
      {
        q: "What is an interrupt? How is it different from polling?",
        freq: "very-common",
        a: `An **interrupt** is a hardware signal that makes the CPU stop the current instruction stream, save minimal state, and jump to an **interrupt handler** (an ISR) registered by the OS in the interrupt vector table. Afterwards it resumes the interrupted code.

**Polling** means the CPU repeatedly checks a device status register. It wastes cycles when events are rare, but avoids interrupt overhead when they're extremely frequent, so high-speed networking (NAPI, DPDK) and NVMe drivers switch to polling under load.`,
      },
      {
        q: "What is DMA and why do we need it?",
        freq: "common",
        a: `**Direct Memory Access**: the device controller transfers data directly between the device and RAM without the CPU copying each byte. The OS sets up a transfer (address, length, direction), the device does it, and it raises **one interrupt** when finished. Without DMA, the CPU would spend its time moving bytes for disks and network cards. An **IOMMU** restricts which memory each device may write, protecting against faulty or malicious devices.`,
      },
      {
        q: "Why does the OS need a hardware timer?",
        freq: "common",
        a: `Without it, a program in an infinite loop would keep the CPU forever: the kernel only runs when something enters it (a system call, an exception or an interrupt). The timer generates periodic or programmed interrupts, which lets the scheduler **preempt** the running task, enforce time slices, and keep track of time. Modern kernels can be "tickless" (\`NO_HZ\`), programming the timer only when needed to save power.`,
      },
      {
        q: "What is little-endian vs big-endian, and where does it matter?",
        freq: "occasional",
        a: `It's the byte order of multi-byte values in memory. **Little-endian** (x86, ARM) stores the least significant byte at the lowest address; **big-endian** stores the most significant first. It matters when bytes cross machines or files: network protocols (big-endian, use \`htonl\` and \`ntohl\`), binary file formats, and casting byte buffers to integers.`,
      },
      {
        q: "What happens to performance when you iterate a 2D array column by column in C?",
        freq: "occasional",
        a: `C stores 2D arrays **row-major**, so walking down a column touches addresses one row-width apart: each access lands on a different cache line (and possibly a different page), wasting most of each 64-byte line. You get many cache and TLB misses and typically run 5–20× slower than row order. Fix it by swapping the loops or transposing the data. It's the same reason struct-of-arrays layouts help vectorised code.`,
      },
    ],
    quiz: [
      {
        q: "Which register holds the address of the next instruction?",
        options: ["Stack pointer", "Program counter", "Accumulator", "Flags register"],
        answer: 1,
        explain: "The program counter (instruction pointer) points at the next instruction to fetch.",
      },
      {
        q: "Roughly how much slower is a RAM access than an L1 cache hit?",
        options: ["About 2×", "About 100×", "About 1,000,000×", "The same speed"],
        answer: 1,
        explain: "L1 is ~1 ns and DRAM ~100 ns.",
      },
      {
        q: "A loop reads a[0], a[1], a[2] ... in order. Which kind of locality does it exploit?",
        options: ["Temporal", "Spatial", "Neither", "Network locality"],
        answer: 1,
        explain: "Neighbouring addresses share cache lines and are prefetched: spatial locality.",
      },
      {
        q: "How big is a typical cache line on x86-64 and most ARM CPUs?",
        options: ["8 bytes", "64 bytes", "4 KiB", "1 MiB"],
        answer: 1,
        explain: "Caches move 64-byte lines.",
      },
      {
        q: "A network card wants to deliver a 9 KB packet into memory without the CPU copying it. What does it use?",
        options: ["Polling", "DMA", "A system call", "Paging"],
        answer: 1,
        explain: "DMA lets the device write directly into RAM and interrupt once when done.",
      },
      {
        q: "What lets the kernel take the CPU back from a program stuck in an infinite loop?",
        options: ["The program's next system call", "The timer interrupt", "The disk controller", "The cache"],
        answer: 1,
        explain: "The periodic timer interrupt enters the kernel regardless of what the program is doing.",
      },
      {
        q: "On a little-endian CPU, how is the 32-bit value 0x0A0B0C0D laid out in memory, lowest address first?",
        options: ["0A 0B 0C 0D", "0D 0C 0B 0A", "0B 0A 0D 0C", "It depends on the compiler"],
        answer: 1,
        explain: "Little-endian puts the least significant byte first.",
      },
    ],
  },

  // ------------------------------------------------------------------ BOOT
  {
    id: "os-boot",
    title: "How a computer boots",
    tagline: "From the power button to the login prompt: firmware (BIOS and UEFI), MBR and GPT, bootloaders, Secure Boot, the kernel, initramfs and PID 1.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "Booting Linux on a UEFI computer",
      nodes: [
        { id: "power", label: "Power button", kind: "client", x: 100, y: 90, sub: "CPU reset" },
        { id: "fw", label: "UEFI firmware", kind: "control", x: 330, y: 90, sub: "POST, finds disks" },
        { id: "esp", label: "EFI partition", kind: "storage", x: 580, y: 90, sub: "FAT32 on disk" },
        { id: "boot", label: "Bootloader", kind: "service", x: 830, y: 90, sub: "GRUB / systemd-boot" },
        { id: "kernel", label: "Linux kernel", kind: "node", x: 830, y: 300, sub: "vmlinuz" },
        { id: "initrd", label: "initramfs", kind: "cache", x: 580, y: 300, sub: "early drivers" },
        { id: "root", label: "Root file system", kind: "db", x: 330, y: 300, sub: "/ on ext4" },
        { id: "init", label: "systemd (PID 1)", kind: "control", x: 330, y: 480, sub: "starts services" },
        { id: "svc", label: "Services", kind: "worker", x: 580, y: 480, sub: "network, ssh, logs" },
        { id: "login", label: "Login", kind: "client", x: 830, y: 480, sub: "getty / desktop" },
      ],
      edges: [
        { from: "power", to: "fw" },
        { from: "fw", to: "esp", label: "load .efi" },
        { from: "esp", to: "boot" },
        { from: "boot", to: "kernel", label: "load + jump" },
        { from: "kernel", to: "initrd", label: "unpack" },
        { from: "initrd", to: "root", label: "mount" },
        { from: "root", to: "init", label: "exec /sbin/init" },
        { from: "init", to: "svc", label: "start units" },
        { from: "svc", to: "login" },
      ],
      flows: [
        {
          name: "Power on to login",
          path: ["power", "fw", "esp", "boot", "kernel", "initrd", "root", "init", "svc", "login"],
          steps: [
            "Power is stable, so the CPU resets and starts running code at a fixed address in the firmware chip. The firmware runs POST (checks RAM and devices).",
            "UEFI reads its boot entries (stored in NVRAM), finds the EFI System Partition on the disk, and loads the bootloader's .efi program from it. With Secure Boot on, it checks the signature first.",
            "The bootloader (GRUB) starts and shows its menu, or picks the default entry.",
            "It loads the compressed kernel (vmlinuz) and the initramfs into memory, passes the kernel command line (root=..., quiet), and jumps to the kernel.",
            "The kernel decompresses itself, sets up memory management, interrupts, the scheduler and built-in drivers, then unpacks the initramfs: a tiny temporary root file system.",
            "Programs in the initramfs load the drivers needed to reach the real disk (NVMe, RAID, LVM, encryption), then mount the real root file system.",
            "The kernel switches to the real root and runs /sbin/init, the very first user-space process: PID 1 (systemd on most distributions).",
            "systemd reads its unit files and starts services in parallel, following their dependencies: mount file systems, bring up networking, start logging, ssh and so on.",
            "Finally it starts getty (a text login prompt) or a display manager (a graphical login). The machine is booted.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Booting is like **waking up in the morning**:
1. ⏰ The **alarm** rings: you press the power button.
2. 🧠 Before anything else you **check you're OK**: arms, legs, eyes. The computer's firmware runs a quick self-test.
3. 📋 You **find today's plan** on the fridge. The firmware finds a small program on the disk called the **bootloader**.
4. 👕 The plan says "get dressed, go to school". The bootloader loads the **kernel**, the heart of the operating system.
5. 🏫 At school, the **headteacher** (the first process, **init**) opens every classroom: Wi-Fi, sound, the login screen.

The tricky part is the **chicken and egg**: the OS lives on the disk, but you need software to read the disk. Booting solves this in **stages**: each stage is just smart enough to load the next, bigger one. The word comes from "pulling yourself up by your own **boot**straps".

## Stage 1: firmware (BIOS or UEFI)
When power is stable, the CPU starts executing at a fixed **reset vector** address, which points into a flash chip on the motherboard holding the **firmware**.
- It runs **POST** (power-on self-test): checks the CPU, RAM and essential devices, and beeps or flashes an error code if something is broken.
- It initialises the chipset, memory controller and PCIe devices.
- It picks a **boot device** using the boot order (SSD, USB stick, network/PXE).

| | Legacy BIOS | UEFI (modern) |
|---|---|---|
| Era | 1981 IBM PC to about 2010 | Default on PCs since about 2012; Macs, servers, ARM |
| CPU mode at hand-off | 16-bit real mode, 1 MiB addressable | 32- or 64-bit, full memory |
| How it finds the OS | Loads the disk's first 512-byte sector (the **MBR**) and jumps into it | Reads a **FAT32 EFI System Partition** and runs a \`.efi\` program from it |
| Partition table | **MBR**: 4 primary partitions, 2 TiB limit | **GPT**: 128 partitions, enormous disks, backup copy, checksums |
| Security | None | **Secure Boot**: only runs signed bootloaders |

The **MBR** (master boot record) is the first sector of a disk: 446 bytes of boot code, a 4-entry **partition table**, and the 2-byte signature \`0x55 0xAA\`. The first code sample builds and parses one.

## Stage 2: the bootloader
A small program whose only job is to load the OS: **GRUB** (most Linux systems), **systemd-boot**, the **Windows Boot Manager**, or Apple's **iBoot**.
- It shows a menu (pick a kernel or another OS, which is how dual boot works).
- It loads the **kernel image** (\`/boot/vmlinuz-6.8.0-...\`) and the **initramfs** into RAM.
- It passes the **kernel command line**, e.g. \`root=UUID=... ro quiet splash\`.
- It jumps to the kernel's entry point.

**Secure Boot** creates a **chain of trust**: the firmware verifies the bootloader's signature, the bootloader verifies the kernel's, and the kernel verifies its modules'. Malware that rewrites the bootloader (a *bootkit*) fails the check.

## Stage 3: the kernel wakes up
1. Decompresses itself and switches the CPU into full 64-bit mode with **paging** turned on.
2. Sets up memory management, interrupt tables, the timer, and the **scheduler**.
3. Detects hardware (ACPI and PCI on PCs, a **device tree** on ARM boards) and initialises built-in drivers.
4. Unpacks the **initramfs**: a small temporary root file system in RAM with just enough tools and drivers to reach the real disk (for example NVMe, RAID, LVM or LUKS encryption).
5. Mounts the **real root file system** and switches to it.
6. Starts the first user-space program, \`/sbin/init\`: **PID 1**.

You can read this whole story afterwards with \`dmesg\` (the kernel's log) or \`journalctl -b\`.

## Stage 4: PID 1 and the services
PID 1 is special:
- It's the **ancestor of every other process**.
- If it dies, the kernel **panics**.
- It must **reap orphaned children**: when a process's parent dies, the process is re-parented to PID 1, which must \`wait()\` for it or it lingers as a zombie.

On most distributions PID 1 is **systemd**. It:
- reads **unit files** (\`nginx.service\`, \`ssh.service\` ...),
- starts them **in parallel** in dependency order,
- restarts crashed ones (\`Restart=on-failure\`),
- groups each service's processes in a **cgroup**, so it can track and limit them.

Older systems used **SysV init** scripts that ran one after another, numbered by **runlevel** (0 halt, 1 single-user, 3 multi-user, 5 graphical, 6 reboot). systemd **targets** play the same role (\`multi-user.target\`, \`graphical.target\`). Containers often run a tiny init such as \`tini\` or \`dumb-init\` as PID 1 for the same reaping job. The second code sample is a toy version.

Finally a **getty** prints \`login:\` on a text console, or a **display manager** (GDM, SDDM) shows the graphical login. \`systemd-analyze\` tells you how long each stage took.

## Other machines boot the same way
- **Phones (Android)**: boot ROM, then bootloader (with verified boot), Linux kernel, init, and **Zygote**, which pre-loads the Java runtime and forks every app.
- **Raspberry Pi**: the GPU firmware starts first, reads \`config.txt\`, and loads the kernel plus a **device tree**.
- **Cloud VMs**: the hypervisor provides virtual UEFI firmware, and \`cloud-init\` configures the machine on first boot.
- **Containers don't boot at all**. They're just processes on an already-running kernel, which is why they start in milliseconds.`,
    keyPoints: [
      "Booting is staged: firmware → bootloader → kernel → initramfs → real root → PID 1 → services",
      "BIOS loads the 512-byte MBR; UEFI runs a .efi program from the FAT32 EFI System Partition",
      "GPT replaces MBR: more partitions, larger disks, redundancy and checksums",
      "Secure Boot verifies signatures down the chain to stop bootkits",
      "initramfs holds the drivers needed to mount the real root file system",
      "PID 1 (systemd) starts services in dependency order and reaps orphaned processes",
    ],
    code: [
      {
        title: "Reading a disk's master boot record",
        variants: [{ lang: "python", code: `# The first 512 bytes of an old-style (MBR) disk: 446 bytes of boot code, a 4-entry partition
# table, and the magic signature 0x55 0xAA that tells the firmware "this disk is bootable".
import struct

def make_mbr():
    mbr = bytearray(512)
    mbr[0:3] = b"\\xeb\\x63\\x90"  # boot code starts with a jump instruction (we leave the rest empty)

    def entry(index, bootable, ptype, start_lba, sectors):
        off = 446 + 16 * index
        mbr[off] = 0x80 if bootable else 0x00                     # 0x80 = "boot from me"
        mbr[off + 4] = ptype                                       # what kind of partition
        mbr[off + 8:off + 16] = struct.pack("<II", start_lba, sectors)  # little-endian numbers

    entry(0, True, 0x83, 2048, 1_048_576)      # Linux, 512 MiB
    entry(1, False, 0x82, 1_050_624, 262_144)  # Linux swap, 128 MiB
    mbr[510:512] = b"\\x55\\xaa"
    return bytes(mbr)

TYPES = {0x83: "Linux", 0x82: "Linux swap", 0x07: "NTFS/exFAT", 0xEE: "GPT protective", 0xEF: "EFI system"}

disk = make_mbr()
print("signature ok:", disk[510:512] == b"\\x55\\xaa")
for i in range(4):
    raw = disk[446 + 16 * i: 446 + 16 * (i + 1)]
    status, ptype = raw[0], raw[4]
    if ptype == 0:
        continue  # empty slot
    start, count = struct.unpack("<II", raw[8:16])
    size_mib = count * 512 // (1024 * 1024)
    flag = "  <- boot" if status == 0x80 else ""
    print(f"partition {i + 1}: {TYPES.get(ptype, hex(ptype)):<10} starts at sector {start:>9,}, {size_mib} MiB{flag}")` }],
        explain: `- The MBR is exactly **512 bytes**: boot code (446), four 16-byte partition entries starting at byte **446**, and the signature \`55 AA\` at bytes 510–511.
- Each entry has a **status** byte (\`0x80\` = bootable), a **type** byte (\`0x83\` Linux, \`0x82\` swap, \`0x07\` NTFS, \`0xEE\` "this disk is really GPT") and the first sector plus sector count as **little-endian** 32-bit numbers. \`struct.unpack("<II", ...)\` decodes them (\`<\` means little-endian).
- Partitions usually start at sector **2048** (1 MiB) so they line up with SSD erase blocks.
- 32-bit sector numbers × 512 bytes is the famous **2 TiB limit** that GPT removed.
- On a real Linux machine you can read your own MBR with \`sudo dd if=/dev/sda bs=512 count=1 | xxd\` (read-only, but be careful with \`dd\`!).`,
        output: `signature ok: True
partition 1: Linux      starts at sector     2,048, 512 MiB  <- boot
partition 2: Linux swap starts at sector 1,050,624, 128 MiB`,
      },
      {
        title: "A tiny init: start services and reap them",
        linux: true,
        variants: [{ lang: "c", code: `// A tiny "init": the first program the kernel starts (PID 1) launches the system's services
// and then spends its life reaping children so they don't become zombies.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

struct service { const char *name; int exit_code; pid_t pid; int status; };

int main(void) {
    struct service svc[] = {{"network", 0, 0, 0}, {"logger", 0, 0, 0}, {"broken-app", 3, 0, 0}};
    int n = sizeof svc / sizeof svc[0];

    for (int i = 0; i < n; i++) {
        pid_t pid = fork();                      // clone this process...
        if (pid == 0) {                          // ...the child becomes the service
            usleep(1000 * (n - i));              // pretend to do some work
            _exit(svc[i].exit_code);             // a real service would execve() its program here
        }
        svc[i].pid = pid;
        printf("init: started %s\\n", svc[i].name);
    }

    for (int done = 0; done < n; done++) {
        int status;
        pid_t pid = wait(&status);               // block until ANY child exits, then collect it
        for (int i = 0; i < n; i++)
            if (svc[i].pid == pid) svc[i].status = WEXITSTATUS(status);
    }
    for (int i = 0; i < n; i++)
        printf("init: %s exited with code %d%s\\n", svc[i].name, svc[i].status, svc[i].status ? "  <- would restart it" : "");
    return 0;
}` }],
        explain: `- \`fork()\` creates a child process, a copy of init. A real init would then call \`execve()\` to turn the child into \`/usr/sbin/sshd\` or similar. Our "services" just pause and exit with a code.
- \`wait(&status)\` blocks until **any** child exits and collects its exit status. Until a parent does this, the dead child stays a **zombie** (an entry in the process table). PID 1 must reap all its children forever, including orphans the kernel hands it.
- \`WEXITSTATUS(status)\` extracts the code passed to \`_exit()\`. Non-zero means failure, and systemd would apply the unit's \`Restart=\` policy.
- The children may finish in any order, so the program records each status by PID and prints them in a fixed order.
- You'll build on \`fork\`, \`exec\` and \`wait\` properly in the processes level and the build-a-shell project.`,
        output: `init: started network
init: started logger
init: started broken-app
init: network exited with code 0
init: logger exited with code 0
init: broken-app exited with code 3  <- would restart it`,
      },
      {
        title: "Inspecting the boot of a Linux machine",
        note: "Read-only commands for a real Linux machine; output varies.",
        variants: [
          {
            lang: "bash",
            code: `systemd-analyze                    # firmware, loader, kernel, user space: time per stage
systemd-analyze blame | head       # slowest services
systemd-analyze critical-chain     # the chain of units that delayed boot
journalctl -b -p warning           # warnings and errors from this boot
dmesg | head -30                   # kernel messages: CPU, memory, drivers found
cat /proc/cmdline                  # the command line the bootloader gave the kernel
ls /sys/firmware/efi && echo UEFI  # the directory exists only on UEFI boots
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT  # disks, partitions, and where they're mounted`,
          },
        ],
        explain: `- A typical \`systemd-analyze\` line: \`Startup finished in 4.1s (firmware) + 2.3s (loader) + 1.8s (kernel) + 6.4s (userspace) = 14.6s\`.
- \`dmesg\` is the first place to look when hardware misbehaves: driver errors, disk resets, out-of-memory kills.
- On a UEFI system, \`lsblk\` shows a small \`vfat\` partition mounted at \`/boot/efi\`: that's the EFI System Partition.`,
      },
    ],
    interview: [
      {
        q: "Walk me through what happens when you press the power button.",
        freq: "very-common",
        a: `1. The CPU resets and runs **firmware** (UEFI/BIOS) from flash: POST, initialise RAM and devices, pick a boot device.
2. **BIOS**: load the 512-byte MBR and jump into it. **UEFI**: read the FAT32 EFI System Partition and run the bootloader's \`.efi\` file, verifying its signature if **Secure Boot** is on.
3. The **bootloader** (GRUB) loads the kernel image and initramfs into RAM, passes the command line, and jumps to the kernel.
4. The **kernel** decompresses, enables paging, sets up interrupts, the scheduler and drivers, unpacks the **initramfs**, loads the storage drivers, and mounts the real root file system.
5. It execs **PID 1** (systemd), which starts services in dependency order and finally a login prompt or display manager.`,
      },
      {
        q: "BIOS vs UEFI, and MBR vs GPT?",
        freq: "common",
        a: `**BIOS** is 1980s firmware: it hands off in 16-bit real mode and boots by running the code in the first disk sector. **UEFI** is a modern firmware specification: 32/64-bit, has drivers, reads FAT file systems, boots \`.efi\` executables, supports **Secure Boot**, and has a proper boot manager.

**MBR** partitioning allows 4 primary partitions and 2 TiB per disk (32-bit sector numbers). **GPT** allows 128 partitions and 8 ZiB, stores a backup header at the end of the disk, and has CRC checksums. UEFI normally uses GPT; BIOS normally uses MBR.`,
      },
      {
        q: "What is initramfs and why is it needed?",
        freq: "common",
        a: `A compressed archive the bootloader loads alongside the kernel and the kernel unpacks into a RAM-based root file system. It contains the drivers and tools needed to **find and mount the real root**: storage drivers (NVMe, RAID), LVM, decrypting LUKS volumes (prompting for a password), network root for diskless machines. Without it, every possible storage driver would have to be compiled into the kernel. After mounting the real root it \`switch_root\`s and execs \`/sbin/init\`.`,
      },
      {
        q: "Why is PID 1 special?",
        freq: "common",
        a: `- It's the first user-space process and the **ancestor** of all others.
- **Orphaned processes are re-parented to it**, so it must reap them with \`wait()\` or zombies accumulate.
- If PID 1 exits, the kernel **panics**.
- Signals the process hasn't set handlers for are **ignored** for PID 1 (it has no default actions). That's why \`docker stop\` on a container whose PID 1 doesn't handle SIGTERM waits 10 seconds and then SIGKILLs it. Use \`tini\` or \`--init\`, or handle signals yourself.`,
      },
      {
        q: "What is Secure Boot, and what does it protect against?",
        freq: "occasional",
        a: `A UEFI feature where the firmware only runs bootloaders signed by keys in its database. The bootloader (often the Microsoft-signed \`shim\` on Linux) verifies the kernel, and the kernel can require signed modules. It blocks **bootkits and rootkits** that modify early boot code to hide below the OS. It doesn't protect a running system from user-space malware; **measured boot** with a TPM complements it by recording hashes of each stage.`,
      },
    ],
    quiz: [
      {
        q: "Where does the CPU start executing after power-on?",
        options: ["At the kernel's main function", "At a reset vector in the firmware chip", "In the bootloader on the disk", "In the initramfs"],
        answer: 1,
        explain: "The CPU's reset vector points into the motherboard's firmware flash.",
      },
      {
        q: "How big is the master boot record?",
        options: ["64 bytes", "512 bytes", "4 KiB", "1 MiB"],
        answer: 1,
        explain: "One 512-byte sector: 446 bytes of code, a 64-byte partition table, and the 0x55AA signature.",
      },
      {
        q: "Which is a limitation of MBR partitioning that GPT removes?",
        options: ["It can't boot Linux", "Disks bigger than 2 TiB and more than 4 primary partitions", "It requires Secure Boot", "It only works on SSDs"],
        answer: 1,
        explain: "MBR uses 32-bit sector numbers (2 TiB) and has only 4 primary entries.",
      },
      {
        q: "What does UEFI load from the EFI System Partition?",
        options: ["The kernel directly, always", "A .efi bootloader program", "The MBR", "systemd"],
        answer: 1,
        explain: "UEFI runs a .efi executable such as grubx64.efi or systemd-bootx64.efi (Linux can also be built as an EFI stub).",
      },
      {
        q: "What is the initramfs used for?",
        options: ["Storing user files", "Holding drivers and tools needed to mount the real root file system", "Swapping memory to disk", "Saving the BIOS settings"],
        answer: 1,
        explain: "It's a temporary root in RAM that prepares and mounts the real root.",
      },
      {
        q: "What happens to a process whose parent exits?",
        options: ["It's killed immediately", "It's re-parented to PID 1 (or a subreaper)", "It becomes PID 1", "It keeps a dangling parent forever"],
        answer: 1,
        explain: "Orphans are adopted by init (or the nearest subreaper), which reaps them when they exit.",
      },
      {
        q: "Why do containers start in milliseconds while VMs take seconds?",
        options: ["Containers use faster disks", "Containers don't boot a kernel; they're processes on the host's already-running kernel", "VMs have no bootloader", "Containers skip the file system"],
        answer: 1,
        explain: "A container is an isolated process; there's no firmware, bootloader or kernel start-up.",
      },
    ],
  },

  // ------------------------------------------------------------------ SYSCALLS
  {
    id: "os-syscalls",
    title: "Kernel mode, user mode and system calls",
    tagline: "Privilege levels, traps, interrupts and exceptions, how a system call travels into the kernel and back, errno, the cost of crossing, the vDSO and strace.",
    difficulty: "beginner",
    minutes: 30,
    diagram: {
      title: "The journey of a system call",
      nodes: [
        { id: "app", label: "Your program", kind: "client", x: 100, y: 110, sub: "user mode" },
        { id: "libc", label: "C library", kind: "service", x: 330, y: 110, sub: "write() wrapper" },
        { id: "trap", label: "Trap instruction", kind: "gateway", x: 580, y: 110, sub: "syscall / svc #0" },
        { id: "entry", label: "Kernel entry", kind: "control", x: 830, y: 110, sub: "save registers" },
        { id: "table", label: "Syscall table", kind: "registry", x: 830, y: 330, sub: "number → handler" },
        { id: "vfs", label: "sys_write → VFS", kind: "service", x: 580, y: 330, sub: "check fd, copy data" },
        { id: "driver", label: "Driver", kind: "worker", x: 330, y: 330, sub: "tty / disk / socket" },
        { id: "dev", label: "Device", kind: "external", x: 100, y: 330, sub: "screen, disk, NIC" },
        { id: "check", label: "Permission check", kind: "monitor", x: 580, y: 490, sub: "valid pointer? allowed?" },
      ],
      edges: [
        { from: "app", to: "libc", label: "call write()" },
        { from: "libc", to: "trap", label: "number + args in registers" },
        { from: "trap", to: "entry", label: "switch to kernel mode" },
        { from: "entry", to: "table" },
        { from: "table", to: "vfs" },
        { from: "vfs", to: "driver" },
        { from: "driver", to: "dev" },
        { from: "vfs", to: "check" },
        { from: "check", to: "entry", dashed: true, label: "return -EFAULT" },
      ],
      flows: [
        {
          name: "write(1, \"hi\\n\", 3)",
          path: ["app", "libc", "trap", "entry", "table", "vfs", "driver", "dev"],
          steps: [
            "Your program calls the ordinary C function write(1, \"hi\\n\", 3).",
            "The libc wrapper puts the syscall number (64 for write on ARM64, 1 on x86-64) and the three arguments into specific registers.",
            "It executes the trap instruction (syscall on x86-64, svc #0 on ARM64). The CPU switches to kernel mode and jumps to the kernel's entry point. User code can't choose where it lands.",
            "The kernel saves the program's registers, switches to the thread's kernel stack, and looks up the syscall number.",
            "The syscall table maps 64 (or 1) to sys_write.",
            "sys_write checks that fd 1 is open for writing, copies the 3 bytes from user memory with copy_from_user (validating the pointer), and calls the file's write operation through the VFS.",
            "For a terminal, the tty driver queues the bytes for the screen. The kernel then restores the registers, puts the return value (3) in the result register, and returns to user mode with sysret / eret.",
          ],
        },
        {
          name: "write() with a bad pointer",
          path: ["app", "libc", "trap", "entry", "table", "vfs", "check", "entry"],
          steps: [
            "The program passes a pointer to memory it doesn't own, e.g. (char *)8.",
            "Same as before: number and arguments into registers.",
            "Trap into kernel mode.",
            "Save registers, find the handler.",
            "sys_write is chosen.",
            "Before touching user memory, the kernel validates the address range.",
            "The address isn't mapped for this process, so the copy fails safely. The kernel returns -EFAULT, libc stores 14 in errno and returns -1. The kernel never crashes because of a bad user pointer.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Think of a **bank**. Customers (your programs) can't walk into the **vault** (the hardware) and grab money. Instead they go to the **counter** and fill in a form: "please withdraw £10 from account 42". The **teller** (the kernel) checks the form is valid and that it's really your account, goes into the vault, and hands you the result.

- The **counter window** is the **system call** interface. It's the *only* way in.
- The teller works in a **special mode** with keys to the vault (**kernel mode**). Customers are always in **user mode**.
- If you fill in the form wrong ("account 999 that doesn't exist"), the teller says **no** and tells you why (**errno**), and the bank keeps running.

## Two modes: user and kernel
The CPU itself enforces the split. A bit in a special register records the current **privilege level**:
- x86 has **rings 0–3**: the kernel runs in ring 0, apps in ring 3.
- ARM has **exception levels**: EL0 for apps, EL1 for the kernel, EL2 for a hypervisor, EL3 for secure firmware.

In **user mode** the CPU **refuses** privileged instructions: talking to devices directly, changing page tables, disabling interrupts, halting the CPU. Trying one causes a fault, and the kernel usually kills the program. User code can also only touch memory that its page tables mark as user-accessible, so it can't read the kernel or other programs.

## Three ways into the kernel
| Way in | Triggered by | Example |
|---|---|---|
| **System call** (a deliberate *trap*) | The program, on purpose | \`read\`, \`write\`, \`fork\`, \`mmap\` |
| **Exception** (a fault) | The current instruction going wrong | divide by zero, page fault, invalid instruction, segmentation fault |
| **Interrupt** | Hardware, at any moment | timer tick, disk finished, network packet arrived, key pressed |

All three switch the CPU to kernel mode and jump to a handler the kernel registered at boot, **not** to an address the program chooses. That's what makes it safe.

## A system call, step by step
Take \`write(1, "hi\\n", 3)\`:
1. Your code calls the C library's \`write\` function, an ordinary function call.
2. The **wrapper** puts the **syscall number** and arguments into agreed registers. The numbers depend on the architecture: on x86-64 \`write\` is 1, in \`rax\`, with arguments in \`rdi\`, \`rsi\`, \`rdx\`; on ARM64 it's 64, in \`x8\`, with arguments in \`x0\`–\`x2\`.
3. It executes the **trap instruction** (\`syscall\` on x86-64, \`svc #0\` on ARM64). The CPU switches to kernel mode and jumps to the kernel's entry code.
4. The kernel **saves the user registers**, switches to a per-thread **kernel stack**, and uses the number as an index into the **syscall table**.
5. The handler (\`sys_write\`) **validates everything**: is fd 1 open for writing? Is the buffer inside the caller's memory? Then it copies the data in (\`copy_from_user\`) and does the work.
6. It puts the result in the return register (bytes written, or a negative error code), restores the registers, and returns to user mode (\`sysret\` / \`eret\`).
7. If the result was an error such as \`-ENOENT\`, the C wrapper stores \`ENOENT\` in the global **\`errno\`** and returns **-1**.

Follow both flows in the diagram: one succeeds, one passes a bad pointer and gets \`EFAULT\`.

## The most important system calls
| Area | Calls |
|---|---|
| Processes | \`fork\`/\`clone\`, \`execve\`, \`exit\`, \`wait4\`, \`getpid\`, \`kill\` |
| Files and I/O | \`open\`/\`openat\`, \`read\`, \`write\`, \`close\`, \`lseek\`, \`stat\`, \`fsync\`, \`ioctl\` |
| Memory | \`mmap\`, \`munmap\`, \`brk\`, \`mprotect\` |
| Communication | \`pipe\`, \`socket\`, \`connect\`, \`accept\`, \`sendmsg\`, \`recvmsg\`, \`shmget\` |
| Waiting for events | \`poll\`, \`epoll_wait\`, \`io_uring_enter\`, \`futex\` |
| Time and info | \`clock_gettime\`, \`nanosleep\`, \`uname\` |

Linux has about **450** system calls. **POSIX** standardises the common ones, so the same C code runs on Linux, macOS and the BSDs. Windows has its own native API (\`NtWriteFile\` ...), usually reached through the Win32 library.

## Crossing costs something
A trivial system call costs roughly **50–200 ns**, and more on CPUs that need Spectre/Meltdown mitigations. A function call costs about **1 ns**. The third code sample measures it (about 160× on the test machine). That's why:
- the C library **buffers** \`printf\` and \`fwrite\` output and makes one big \`write\` instead of many small ones,
- \`read\` with a 64 KiB buffer beats reading byte by byte,
- servers batch work (\`writev\`, \`sendmmsg\`, \`io_uring\` submitting many requests in one call),
- Linux maps a small read-only page called the **vDSO** into every process, so \`clock_gettime\` and \`gettimeofday\` can read the time **without** trapping at all.

## Watching system calls with strace
\`strace\` shows every system call a program makes, with arguments and results:
\`\`\`text
$ strace -f -e trace=openat,read,write ./hello
openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libc.so.6", O_RDONLY|O_CLOEXEC) = 3
read(3, "\\177ELF\\2\\1\\1\\3\\0\\0\\0\\0\\0\\0\\0\\0\\3\\0>\\0\\1\\0\\0\\0"..., 832) = 832
write(1, "2. write(): goes straight to the"..., 40) = 40
write(1, "1. printf: goes into a buffer in"..., 91) = 91
+++ exited with 0 +++
\`\`\`
- \`strace -c\` summarises time per syscall.
- \`strace -p <pid>\` attaches to a running process: "it's stuck" usually turns out to be a \`read\` on a socket or a \`futex\` wait.
- On macOS use \`dtruss\`; on Windows, Process Monitor.`,
    keyPoints: [
      "The CPU enforces user vs kernel mode; privileged instructions fault in user mode",
      "Programs enter the kernel only via system calls, exceptions and interrupts, always at kernel-chosen entry points",
      "A syscall puts a number and arguments in registers, traps, and is dispatched through the syscall table",
      "The kernel validates every argument, especially user pointers (EFAULT instead of a crash)",
      "Errors come back as -1 plus errno; always check return values",
      "Syscalls cost ~100× a function call, hence buffering, batching and the vDSO",
    ],
    code: [
      {
        title: "Three ways to write: printf, write() and raw syscall()",
        linux: true,
        variants: [{ lang: "c", code: `// Three ways to print "hi", from the most convenient to the most raw.
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/syscall.h>
#include <unistd.h>

int main(void) {
    printf("1. printf (C library: formats, buffers, then calls write)\\n");
    fflush(stdout);                                   // empty the buffer now so the order stays 1-2-3

    write(1, "2. write() (a thin libc wrapper around the system call)\\n", 56);

    // syscall() puts the call number and arguments into registers and runs the CPU's trap
    // instruction (\`syscall\` on x86-64, \`svc #0\` on ARM64). SYS_write is 1 on x86-64, 64 on ARM64.
    long n = syscall(SYS_write, 1, "3. syscall(SYS_write, ...) (no wrapper at all)\\n", 47);
    printf("the kernel says it wrote %ld bytes\\n", n);
    return 0;
}` }],
        explain: `- All three end in the same kernel function, \`sys_write\`. The difference is how much help you get on the way.
- \`fflush(stdout)\` pushes \`printf\`'s buffer out with a \`write\` right now, so the lines stay in order (remember the intro sample).
- \`syscall(SYS_write, ...)\` is libc's generic "make system call number N" helper. \`SYS_write\` comes from \`<sys/syscall.h>\` and is a different number on each CPU architecture, which is one reason to use the named wrappers.
- The return value is the number of bytes the kernel accepted: 47. For pipes and sockets it can be **less** than you asked for (a *short write*), so robust code loops until everything is written.`,
        output: `1. printf (C library: formats, buffers, then calls write)
2. write() (a thin libc wrapper around the system call)
3. syscall(SYS_write, ...) (no wrapper at all)
the kernel says it wrote 47 bytes`,
      },
      {
        title: "When system calls fail: -1 and errno",
        linux: true,
        variants: [{ lang: "c", code: `// System calls report failure by returning -1 and setting errno to a reason code.
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static void report(const char *what, long result) {
    if (result == -1)
        printf("%-28s -> -1, errno %d (%s): %s\\n", what, errno, errno == ENOENT ? "ENOENT" : errno == EBADF ? "EBADF" : errno == EACCES ? "EACCES" : errno == EFAULT ? "EFAULT" : "?", strerror(errno));
    else
        printf("%-28s -> %ld (success)\\n", what, result);
}

int main(void) {
    report("open(\\"/no/such/file\\")", open("/no/such/file", O_RDONLY));
    report("write(99, ...) bad fd", write(99, "x", 1));
    int zero = open("/dev/zero", O_RDONLY);
    char *volatile bad = (char *)8;              // an address the program does not own
    report("read(zero, bad pointer, 10)", read(zero, bad, 10));
    close(zero);
    int fd = open("/dev/null", O_WRONLY);
    report("open(\\"/dev/null\\")", fd);
    report("write(fd, \\"hello\\", 5)", write(fd, "hello", 5));
    report("close(fd)", close(fd));
    report("close(fd) again", close(fd));
    return 0;
}` }],
        explain: `- Every failing call returned **-1**, and \`errno\` says why. \`strerror\` turns the code into text (\`perror("open")\` prints it with a prefix).
- \`EFAULT\` shows the kernel **protecting itself**: we handed it a garbage pointer, and instead of crashing it checked the address and refused.
- The second \`close(fd)\` fails with \`EBADF\`. Double-closing is a real bug in threaded programs: another thread may have opened a new file that got the same number in between, and you just closed *their* file.
- \`errno\` is only meaningful **right after a call fails**: successful calls may leave old values in it. It's thread-local, so threads don't overwrite each other's.
- Other common codes: \`EACCES\` (permission denied), \`EINTR\` (a signal interrupted the call; retry), \`EAGAIN\` (would block, try later), \`ENOMEM\`, \`EEXIST\`, \`EPIPE\` (the reader went away).`,
        output: `open("/no/such/file")        -> -1, errno 2 (ENOENT): No such file or directory
write(99, ...) bad fd        -> -1, errno 9 (EBADF): Bad file descriptor
read(zero, bad pointer, 10)  -> -1, errno 14 (EFAULT): Bad address
open("/dev/null")            -> 3 (success)
write(fd, "hello", 5)        -> 5 (success)
close(fd)                    -> 0 (success)
close(fd) again              -> -1, errno 9 (EBADF): Bad file descriptor`,
      },
      {
        title: "Measuring the cost of a system call",
        linux: true,
        note: "The timing line goes to stderr and varies by machine; the pinned output is just the verdict.",
        variants: [{ lang: "c", code: `// How expensive is crossing into the kernel? Compare a plain function call with a real system call.
#define _GNU_SOURCE
#include <stdio.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1e9 + t.tv_nsec;   // nanoseconds
}

__attribute__((noinline)) static long plain_function(long x) {
    __asm__ volatile("" ::: "memory");   // stop the compiler from optimising the call away
    return x + 1;
}

int main(void) {
    const int N = 1000000;
    long sink = 0;

    double t0 = now();
    for (int i = 0; i < N; i++) sink += plain_function(i);
    double fn_ns = (now() - t0) / N;

    t0 = now();
    for (int i = 0; i < N; i++) sink += syscall(SYS_getppid);   // a trivial syscall: "who is my parent?"
    double sys_ns = (now() - t0) / N;

    printf("a system call costs more than a function call: %s\\n", sys_ns > fn_ns * 5 ? "yes" : "no");
    fprintf(stderr, "function call %.1f ns, system call %.1f ns (%.0fx), sink=%ld\\n", fn_ns, sys_ns, sys_ns / fn_ns, sink);
    return 0;
}` }],
        explain: `- \`getppid\` does almost nothing in the kernel, so the time measured is mostly the **round trip**: trap, save registers, dispatch, return.
- On the test machine stderr showed \`function call 0.9 ns, system call 145.2 ns (163x)\`.
- \`__attribute__((noinline))\` and the empty \`asm volatile\` stop the optimiser from deleting the function call. Benchmarks that the compiler can see through measure nothing.
- This cost is why high-performance servers try to make **fewer, bigger** system calls, and why \`io_uring\` lets a program queue many I/O requests and submit them with a single call (or none, using a kernel polling thread).`,
        output: `a system call costs more than a function call: yes`,
      },
      {
        title: "Python's os module is system calls with nicer names",
        variants: [{ lang: "python", code: `# Python's os module is a thin layer over system calls: these map one-to-one.
import os

fd = os.open("notes.tmp", os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o644)  # open(2)
print("open  -> file descriptor", fd >= 3 and "3 or higher (0, 1, 2 are stdin, stdout, stderr)")
print("write ->", os.write(fd, b"kernel, please store this\\n"), "bytes")             # write(2)
os.close(fd)                                                                          # close(2)

fd = os.open("notes.tmp", os.O_RDONLY)
print("read  ->", os.read(fd, 100))                                                   # read(2)
print("lseek ->", os.lseek(fd, 7, os.SEEK_SET), "(jumped to byte 7)")                # lseek(2)
print("read  ->", os.read(fd, 6))
os.close(fd)

info = os.stat("notes.tmp")                                                           # stat(2)
print("stat  -> size", info.st_size, "bytes, mode", oct(info.st_mode & 0o777))
os.unlink("notes.tmp")                                                                # unlink(2)
print("exists after unlink?", os.path.exists("notes.tmp"))` }],
        explain: `- \`os.open\`, \`os.read\`, \`os.write\`, \`os.lseek\`, \`os.stat\` and \`os.unlink\` each make the system call of the same name and return what the kernel returned. Errors become \`OSError\` exceptions carrying \`errno\`.
- The file descriptor is a small integer: **0, 1 and 2** are already taken by stdin, stdout and stderr, so the first file you open gets 3.
- \`lseek\` moves the file's **offset**: the kernel remembers, per open file, where the next read or write happens.
- The high-level \`open()\` builtin adds buffering and text decoding on top, just like C's \`fopen\`/\`printf\` sit on top of \`open\`/\`write\`.`,
        output: `open  -> file descriptor 3 or higher (0, 1, 2 are stdin, stdout, stderr)
write -> 26 bytes
read  -> b'kernel, please store this\\n'
lseek -> 7 (jumped to byte 7)
read  -> b' pleas'
stat  -> size 26 bytes, mode 0o644
exists after unlink? False`,
      },
    ],
    interview: [
      {
        q: "What is a system call? Walk through what happens during one.",
        freq: "very-common",
        a: `A system call is the controlled entry point through which a user program asks the kernel to do something privileged.
1. The libc wrapper loads the syscall number and arguments into registers.
2. It executes a trap instruction (\`syscall\` on x86-64, \`svc\` on ARM64). The CPU switches to kernel mode and jumps to a fixed entry point.
3. The kernel saves user registers, switches to the kernel stack, and dispatches through the **syscall table**.
4. The handler validates arguments (file descriptors, permissions, user pointers via \`copy_from_user\`) and does the work, possibly blocking the thread.
5. It writes the return value, restores registers, and returns to user mode (\`sysret\`). On error, libc sets \`errno\` and returns -1.`,
      },
      {
        q: "What's the difference between a trap, an exception and an interrupt?",
        freq: "common",
        a: `- **Interrupt**: asynchronous, from hardware (timer, NIC, disk). It can arrive between any two instructions and isn't caused by the running code.
- **Exception / fault**: synchronous, caused by the current instruction (page fault, divide by zero, illegal instruction). Faults like page faults can be fixed and the instruction **retried**.
- **Trap**: a synchronous exception raised **on purpose**, such as the syscall instruction or a breakpoint (\`int3\`). Execution continues *after* the instruction.

All three switch to kernel mode via a handler table set up by the kernel.`,
      },
      {
        q: "Why do we need two CPU modes? What can't user mode do?",
        freq: "very-common",
        a: `For **protection and isolation**: a buggy or malicious program must not be able to take over the machine or read other programs' data. In user mode the CPU refuses **privileged instructions** (I/O instructions, loading page-table registers, disabling interrupts, \`hlt\`, model-specific registers), and the MMU blocks access to pages not marked user-accessible, including kernel memory. The only way to do privileged work is to ask the kernel through a system call, where it can check permissions.`,
      },
      {
        q: "Why are system calls expensive, and how do systems reduce the cost?",
        freq: "common",
        a: `A syscall means a mode switch, saving and restoring registers, pipeline disruption, and on many CPUs Spectre/Meltdown mitigations (page-table switching with KPTI, buffer flushes). It also pollutes the caches and TLB. A trivial one costs about 100 ns vs about 1 ns for a function call.

Ways to reduce the cost:
- **Buffering** in libraries (stdio).
- **Batching** (\`readv\`/\`writev\`, \`sendmmsg\`).
- **io_uring**: shared submission and completion rings, one syscall for many operations.
- The **vDSO**: \`clock_gettime\` without trapping.
- **mmap**: access file data as memory.
- Kernel bypass (DPDK, SPDK) for extreme cases.`,
      },
      {
        q: "What is the difference between a library call and a system call?",
        freq: "common",
        a: `A **library call** (\`printf\`, \`strlen\`, \`malloc\`, \`fopen\`) is an ordinary function in user space. It may make zero, one or many system calls: \`strlen\` makes none; \`malloc\` usually none, occasionally \`brk\` or \`mmap\`; \`printf\` usually none until the buffer flushes with \`write\`. A **system call** crosses into the kernel. \`ltrace\` shows library calls; \`strace\` shows system calls.`,
      },
      {
        q: "What is the vDSO?",
        freq: "occasional",
        a: `The **virtual dynamic shared object**: a small shared library the kernel maps into every process. Its functions (\`clock_gettime\`, \`gettimeofday\`, \`time\`, \`getcpu\`) read kernel-maintained data from a shared read-only page entirely in user mode, avoiding a syscall for very frequent, read-only operations. libc calls it automatically.`,
      },
      {
        q: "A process seems hung. How do you see what it's doing at the system-call level?",
        freq: "common",
        a: `- \`strace -p <pid>\` (add \`-f\` for threads) shows the call it's blocked in: \`read(5, ...)\` on a socket, \`futex(...)\` (waiting on a lock), \`epoll_wait\`, \`wait4\` and so on.
- \`cat /proc/<pid>/stack\` (as root) and \`/proc/<pid>/wchan\` show the kernel function it sleeps in.
- \`ls -l /proc/<pid>/fd\` tells you what fd 5 is.
- The state in \`ps\`/\`top\` helps too: \`S\` is interruptible sleep, \`D\` is uninterruptible (usually disk or NFS I/O).
- \`perf trace\` is a lower-overhead alternative to strace.`,
      },
    ],
    quiz: [
      {
        q: "What happens if a user-mode program executes a privileged instruction, such as disabling interrupts?",
        options: ["It runs normally", "The CPU raises an exception and the kernel usually kills the program", "The kernel silently ignores it", "The machine reboots"],
        answer: 1,
        explain: "The CPU faults (general protection on x86), and the kernel typically sends SIGSEGV or SIGILL.",
      },
      {
        q: "How does a failing system call report the reason in C?",
        options: ["It throws an exception", "It returns -1 and sets errno", "It returns NULL and prints to stderr", "It returns the error string"],
        answer: 1,
        explain: "The wrapper returns -1 and stores the error code in the thread-local errno.",
      },
      {
        q: "A program passes a pointer to unmapped memory to read(). What happens?",
        options: ["The kernel crashes", "read() returns -1 with errno EFAULT", "The kernel maps the memory for it", "The data goes to a random address"],
        answer: 1,
        explain: "The kernel validates user pointers and fails the call safely with EFAULT.",
      },
      {
        q: "Which of these is an interrupt rather than a trap or exception?",
        options: ["A page fault", "Executing the syscall instruction", "The network card signalling a received packet", "Dividing by zero"],
        answer: 2,
        explain: "Interrupts are asynchronous hardware events; the others are caused by the running instruction.",
      },
      {
        q: "Why does clock_gettime() usually not trap into the kernel on Linux?",
        options: ["It's not a real system call", "It's served by the vDSO from a shared page in user space", "The CPU caches the result", "glibc calls the BIOS instead"],
        answer: 1,
        explain: "The vDSO reads kernel-updated time data without a mode switch.",
      },
      {
        q: "What does strace show?",
        options: ["CPU cache misses", "Every system call a process makes, with arguments and return values", "Library function calls only", "Network packets"],
        answer: 1,
        explain: "strace traces system calls (ltrace traces library calls; perf traces hardware events).",
      },
      {
        q: "Which privilege level does the Linux kernel run at on x86-64?",
        options: ["Ring 0", "Ring 1", "Ring 3", "EL0"],
        answer: 0,
        explain: "The kernel runs in ring 0; user programs run in ring 3 (on ARM: EL1 vs EL0).",
      },
    ],
  },
];
