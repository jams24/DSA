import type { Lesson } from "../types";

// Operating Systems, part 6: security, virtualization, real Linux and the interview.

export const osPart6: Lesson[] = [
  // ------------------------------------------------------------------ SECURITY
  {
    id: "os-security",
    part: "Part 6 · Security, containers & real Linux",
    title: "OS security: users, permissions and sandboxes",
    tagline: "Protection rings, users and groups, rwx permission bits, umask, setuid, least privilege, capabilities, ACLs, MAC (SELinux, AppArmor), seccomp, ASLR, NX and stack canaries.",
    difficulty: "intermediate",
    minutes: 40,
    visualizers: ["perms"],
    concept: `## Explain it like I'm 10 🧸
An operating system is like a **block of flats** with a **caretaker**:
- Every person has an **ID card** (a **user ID**) and belongs to some **clubs** (**groups**).
- Every room has a **sign on the door** saying who may **look inside** (read), **change things** (write) and **use it** (execute): the owner, club members, and everyone else.
- The caretaker (**root**) has a master key that opens every door. That's handy, and dangerous: if a burglar steals the caretaker's keys, every room is open. So good programs **give the master key back** as soon as they don't need it.
- Some rooms are **sandboxes**: a guest inside is allowed only a short list of actions, and anything else gets them thrown out.

The OS's job is to make sure that **one program can't touch what isn't its own**, even when it's buggy or evil.

## The foundation: hardware protection
Everything rests on what you learned in Part 1 and Part 4:
- **CPU modes** (rings): user code can't run privileged instructions, change page tables or talk to devices. It must ask the kernel through **system calls**, and the kernel checks every request.
- **Virtual memory**: a process can't even name another process's memory.
- **Timer interrupts**: a program can't hog the CPU forever.

## Users, groups and permission bits
Every process runs with a **UID** and **GIDs**; every file has an owner, a group and **permission bits**:
\`\`\`text
-rw-r-----  1 ann staff  4096 report.txt
 └┬┘└┬┘└┬┘
  │  │  └── others: ---  (nothing)
  │  └───── group:  r--  (read)
  └──────── owner:  rw-  (read, write)
\`\`\`
Each triple is three bits: **r = 4, w = 2, x = 1**. So \`rw-r-----\` is \`6 4 0\`: \`chmod 640 report.txt\`. Common modes: 644 (files), 755 (programs and directories), 600 (private keys), 700 (private directories).

The kernel checks **only one** triple: the **owner** bits if you're the owner, else the **group** bits if you're in the group, else the **others** bits. It doesn't fall through, so an owner with \`---\` is locked out even if the group has \`rwx\`. Root (UID 0) skips the checks entirely. Try it in the visualizer.

For **directories**: **r** = list the names, **w** = create, delete and rename entries, **x** = enter it and use names inside it (needed on every directory along a path).

**umask** removes bits from new files: with the usual \`022\`, a file created with 666 becomes 644.

## Special bits
| Bit | On a file | On a directory |
|---|---|---|
| **setuid** (4000) | The program runs with the **file owner's** UID. \`passwd\` is setuid root so it can update \`/etc/shadow\` | (ignored) |
| **setgid** (2000) | Runs with the file's group | New files inherit the directory's group (shared project folders) |
| **sticky** (1000) | (unused) | Only a file's owner may delete it: \`/tmp\` is \`drwxrwxrwt\` |

setuid-root programs are a favourite target: any bug in them runs as root. Modern systems minimise them.

## Least privilege
**Give every component only the access it needs, for as short a time as possible.** Patterns:
- **Drop privileges**: start as root to bind port 80 or read a key, then \`setgid\` and \`setuid\` to an unprivileged user. Order matters: groups first, user last (after \`setuid\`, you can't change groups any more), and check the return values. Our sample shows the user can't climb back to root.
- **Privilege separation**: split a program so only a tiny part runs privileged (OpenSSH, Chrome).
- **Capabilities**: Linux splits root's power into about 40 **capabilities**: \`CAP_NET_BIND_SERVICE\` (ports below 1024), \`CAP_SYS_ADMIN\` (mounts, namespaces: "the new root"), \`CAP_NET_ADMIN\`, \`CAP_DAC_OVERRIDE\` (ignore file permissions), \`CAP_SYS_PTRACE\`. Give a web server just \`CAP_NET_BIND_SERVICE\` instead of full root (\`setcap\`, or Docker's \`--cap-drop ALL --cap-add NET_BIND_SERVICE\`).

## Beyond rwx: ACLs and mandatory access control
- **ACLs** (\`setfacl\`, \`getfacl\`): permissions for specific extra users and groups on one file.
- **DAC vs MAC**: the rwx system is **discretionary**: the owner decides. **Mandatory** access control (SELinux on Red Hat and Android, AppArmor on Ubuntu) adds system-wide policy that even root and owners can't override: "the web server may read \`/var/www\` and nothing else", whatever the file permissions say.

## Sandboxing: seccomp
**seccomp** restricts which **system calls** a process may make. A small **BPF program** runs on every syscall and returns allow, fail with an error, or **kill**. Our sample blocks \`openat\` (fails with EPERM) and kills the process on \`mkdirat\` (SIGSYS, "Bad system call").
- Docker applies a default seccomp profile blocking ~40 dangerous calls (\`mount\`, \`reboot\`, \`kexec_load\`, loading kernel modules...).
- Chrome's renderers, systemd services (\`SystemCallFilter=\`), Firefox and OpenSSH use it.
- Since every attack on the kernel goes through system calls, fewer allowed calls means a smaller attack surface.

## Memory-safety defences
Most real exploits start with a memory bug in C or C++ (a buffer overflow, use-after-free). The OS and compiler make them much harder to exploit:
| Defence | Stops |
|---|---|
| **NX / DEP** (no-execute pages) | Running injected code on the stack or heap |
| **ASLR** | Knowing where code, libraries and the stack are. Our sample shows stack, heap and libc move on every run |
| **Stack canaries** (\`-fstack-protector\`) | A secret value before the return address; overwriting it aborts the program |
| **PIE**, **RELRO**, **\`_FORTIFY_SOURCE\`** | Fixed code addresses, overwritten function pointers, unchecked string functions |
| **CFI**, shadow stacks (Intel CET) | Hijacking returns and indirect calls |

Attackers answer with **return-oriented programming** (chaining existing code snippets) plus an information leak to defeat ASLR, which is why defences are layered, and why memory-safe languages (Rust, Go, Java) matter.

## Other classic OS attack surfaces
- **TOCTOU** races (Part 3): check a file, then an attacker swaps it before you use it.
- **Privilege escalation** through a kernel bug or a misconfigured setuid binary, sudo rule or writable cron job.
- **Side channels**: Spectre and Meltdown (2018) leaked kernel memory through CPU caches and speculative execution. The fixes (KPTI, separate kernel page tables, and retpolines) cost performance on every system call.`,
    keyPoints: [
      "Hardware protection (CPU modes, virtual memory, timer) underlies all OS security",
      "Permission bits: r=4, w=2, x=1 for owner, group and others; only the first matching class is checked",
      "Root bypasses permission checks; umask strips bits from new files; setuid runs as the file's owner",
      "Least privilege: drop privileges (groups first, user last), privilege separation, Linux capabilities",
      "MAC (SELinux, AppArmor) enforces system-wide policy that owners can't override",
      "seccomp filters system calls with a BPF program; Docker uses it by default",
      "NX, ASLR, stack canaries and CFI make memory bugs much harder to exploit",
    ],
    code: [
      {
        title: "Permission bits, umask and dropping root",
        linux: true,
        privileged: true,
        variants: [{ lang: "c", code: `// Users, permission bits and dropping privileges: what root can do, and what a normal user can't.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

static void show(const char *path, const char *note) {
    struct stat st;
    stat(path, &st);
    char m[10];
    for (int i = 0; i < 9; i++) m[i] = (st.st_mode & (0400 >> i)) ? "rwxrwxrwx"[i] : '-';
    m[9] = 0;
    printf("%-12s -%s  owner uid %d  %s\\n", path, m, (int)st.st_uid, note);
}

static const char *try_open(const char *path, int flags) {
    int fd = open(path, flags);
    if (fd < 0) return errno == EACCES ? "EACCES (permission denied)" : strerror(errno);
    close(fd);
    return "ok";
}

int main(void) {
    umask(022);                                                    // new files: take away write for group and others
    close(open("/tmp/secret", O_CREAT | O_WRONLY | O_TRUNC, 0600)); // only the owner may read or write
    close(open("/tmp/public", O_CREAT | O_WRONLY | O_TRUNC, 0666)); // asks for rw for everyone...
    show("/tmp/secret", "(0600)");
    show("/tmp/public", "(asked for 0666; umask 022 removed the w's)");
    printf("as root, uid %d: read secret -> %s\\n", (int)getuid(), try_open("/tmp/secret", O_RDONLY));
    fflush(stdout);

    if (fork() == 0) {
        // drop privileges for good: supplementary groups, then the group, then the user LAST
        if (setgroups(0, NULL) != 0 || setgid(1000) != 0 || setuid(1000) != 0) {
            perror("dropping privileges");
            _exit(1);
        }
        printf("as uid %d: read secret  -> %s\\n", (int)getuid(), try_open("/tmp/secret", O_RDONLY));
        printf("as uid %d: read public  -> %s\\n", (int)getuid(), try_open("/tmp/public", O_RDONLY));
        printf("as uid %d: write public -> %s\\n", (int)getuid(), try_open("/tmp/public", O_WRONLY));
        printf("as uid %d: setuid(0) to become root again -> %s\\n", (int)getuid(), setuid(0) == 0 ? "ok?!" : "EPERM (there's no way back)");
        fflush(stdout);
        _exit(0);
    }
    wait(NULL);
    unlink("/tmp/secret");
    unlink("/tmp/public");
    return 0;
}` }],
        explain: `- \`umask(022)\` means "never give group or others write permission by default". The file opened with 0666 ends up 0644.
- Root opens the 0600 secret. Here root happens to be the owner, but it would succeed anyway: UID 0 skips read and write permission checks.
- The child drops to UID 1000 with \`setgroups\`, \`setgid\` and then \`setuid\`. Now the secret is \`EACCES\`, the public file is readable (others have \`r\`) but not writable.
- \`setuid(0)\` fails with EPERM: once a process gives up root this way, it can't get it back. That's the point of dropping privileges.
- Checking the return value of \`setuid\` matters: famous vulnerabilities came from programs that ignored a failed \`setuid\` and carried on as root.`,
        output: `/tmp/secret  -rw-------  owner uid 0  (0600)
/tmp/public  -rw-r--r--  owner uid 0  (asked for 0666; umask 022 removed the w's)
as root, uid 0: read secret -> ok
as uid 1000: read secret  -> EACCES (permission denied)
as uid 1000: read public  -> ok
as uid 1000: write public -> EACCES (permission denied)
as uid 1000: setuid(0) to become root again -> EPERM (there's no way back)`,
      },
      {
        title: "The kernel's permission check (Python)",
        variants: [{ lang: "python", code: `# How the kernel decides "may this user open this file?": owner, then group, then others.
def allowed(mode, file_uid, file_gid, uid, groups, want):
    if uid == 0:
        return "yes (root skips the check)"
    bits = {"r": 4, "w": 2, "x": 1}[want]
    if uid == file_uid:
        who, triple = "owner", (mode >> 6) & 7
    elif file_gid in groups:
        who, triple = "group", (mode >> 3) & 7
    else:
        who, triple = "others", mode & 7
    ok = bool(triple & bits)            # only ONE triple is checked: the first that matches
    return f"{'yes' if ok else 'no '} (checked the {who} bits: {triple:03b})"


def rwx(mode):
    return "".join(c if mode & (1 << (8 - i)) else "-" for i, c in enumerate("rwxrwxrwx"))


# report.txt belongs to ann (uid 1000) and group staff (gid 50), mode 640: rw-r-----
mode, owner, group = 0o640, 1000, 50
print("report.txt", rwx(mode), "owner ann, group staff")
for name, uid, groups in [("ann", 1000, {1000}), ("bob (in staff)", 1001, {1001, 50}), ("eve", 1002, {1002}), ("root", 0, {0})]:
    for want in "rw":
        print(f"  {name:15} {want}: {allowed(mode, owner, group, uid, groups, want)}")

# a surprise: owner bits are checked even when they're stricter than the group's
mode = 0o070
print("weird.txt", rwx(mode), "owner ann, group staff")
print("  ann             r:", allowed(mode, owner, group, 1000, {1000, 50}, "r"))
print("  bob (in staff)  r:", allowed(mode, owner, group, 1001, {1001, 50}, "r"))` }],
        explain: `- \`(mode >> 6) & 7\` extracts the owner triple, \`(mode >> 3) & 7\` the group triple and \`mode & 7\` the others triple.
- The kernel picks **one** class, the first that matches: owner, else group, else others. Bob is in \`staff\`, so he gets the group's \`r--\`: he can read but not write. Eve gets nothing.
- The surprise at the end: \`weird.txt\` is \`---rwx---\`. Ann owns it and is also in \`staff\`, but she's checked as the **owner**, and the owner bits are empty, so she's denied while Bob is allowed. (Ann can still \`chmod\` it, because owners may always change permissions.)`,
        output: `report.txt rw-r----- owner ann, group staff
  ann             r: yes (checked the owner bits: 110)
  ann             w: yes (checked the owner bits: 110)
  bob (in staff)  r: yes (checked the group bits: 100)
  bob (in staff)  w: no  (checked the group bits: 100)
  eve             r: no  (checked the others bits: 000)
  eve             w: no  (checked the others bits: 000)
  root            r: yes (root skips the check)
  root            w: yes (root skips the check)
weird.txt ---rwx--- owner ann, group staff
  ann             r: no  (checked the owner bits: 000)
  bob (in staff)  r: yes (checked the group bits: 111)`,
      },
      {
        title: "A seccomp sandbox",
        linux: true,
        variants: [{ lang: "c", code: `// seccomp: a BPF filter decides, for every system call, whether to allow it, fail it or kill the process.
// Docker runs every container under a filter like this (blocking about 40 dangerous calls).
#include <errno.h>
#include <fcntl.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>

#if defined(__x86_64__)
#define MY_ARCH AUDIT_ARCH_X86_64
#elif defined(__aarch64__)
#define MY_ARCH AUDIT_ARCH_AARCH64
#endif

static void sandbox(void) {
    struct sock_filter rules[] = {
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),   // load the CPU architecture
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, MY_ARCH, 1, 0),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),                       // wrong architecture: kill
        BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),     // load the syscall number
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_openat, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | EPERM),                      // openat: fail with EPERM
        BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_mkdirat, 0, 1),
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),                       // mkdirat: kill the process
        BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW),                              // everything else: allow
    };
    struct sock_fprog prog = {.len = sizeof rules / sizeof rules[0], .filter = rules};
    prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0);    // required: a filtered process may never gain privileges
    if (prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &prog) != 0) perror("seccomp");
}

int main(void) {
    fflush(stdout);
    pid_t kid = fork();
    if (kid == 0) {
        sandbox();
        printf("child: in the sandbox, write() still works\\n");
        int fd = open("/etc/hostname", O_RDONLY);
        printf("child: open() -> %d, errno %s\\n", fd, errno == EPERM ? "EPERM (blocked by the filter)" : strerror(errno));
        fflush(stdout);
        syscall(__NR_mkdirat, AT_FDCWD, "/tmp/nope", 0700);   // on the kill list
        printf("child: this line never prints\\n");
        fflush(stdout);
        _exit(0);
    }
    int status;
    waitpid(kid, &status, 0);
    if (WIFSIGNALED(status))
        printf("parent: the child was killed by signal %d (%s) when it called mkdir\\n", WTERMSIG(status), strsignal(WTERMSIG(status)));
    else
        printf("parent: the child exited normally?!\\n");
    return 0;
}` }],
        explain: `- The filter is a tiny program in classic **BPF** that the kernel runs on every system call. It first checks the CPU architecture (syscall numbers differ between x86 and ARM), then the syscall number.
- \`openat\` returns \`EPERM\`: the program gets a normal error and can handle it. \`mkdirat\` is on the kill list: the kernel ends the process with **SIGSYS** ("Bad system call") before the call runs.
- \`PR_SET_NO_NEW_PRIVS\` is required first: it guarantees the process (and its children) can never gain privileges, for example by running a setuid program, so an unprivileged user can't use a filter to confuse one.
- Filters stack: this one runs on top of Docker's default filter. That's also why the older "strict" mode can't be used here: a process already under a filter can't switch modes.`,
        output: `child: in the sandbox, write() still works
child: open() -> -1, errno EPERM (blocked by the filter)
parent: the child was killed by signal 31 (Bad system call) when it called mkdir`,
      },
      {
        title: "ASLR in action",
        linux: true,
        variants: [{ lang: "c", code: `// ASLR: run the same program twice and compare where its stack, heap and libc landed.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
    (void)argv;
    int local;
    void *heap = malloc(16);
    if (argc > 1) {                                    // the "report" mode: print three addresses
        printf("%p %p %p\\n", (void *)&local, heap, (void *)&printf);
        return 0;
    }
    char a[200] = "", b[200] = "";
    FILE *p = popen("./main report", "r");             // run ourselves twice
    fgets(a, sizeof a, p);
    pclose(p);
    p = popen("./main report", "r");
    fgets(b, sizeof b, p);
    pclose(p);
    void *s1, *h1, *l1, *s2, *h2, *l2;
    sscanf(a, "%p %p %p", &s1, &h1, &l1);
    sscanf(b, "%p %p %p", &s2, &h2, &l2);
    printf("stack moved between runs: %s\\n", s1 != s2 ? "yes" : "no");
    printf("heap moved between runs:  %s\\n", h1 != h2 ? "yes" : "no");
    printf("libc moved between runs:  %s\\n", l1 != l2 ? "yes" : "no");
    FILE *f = fopen("/proc/sys/kernel/randomize_va_space", "r");
    int level = -1;
    if (f) {
        if (fscanf(f, "%d", &level) != 1) level = -1;
        fclose(f);
    }
    printf("/proc/sys/kernel/randomize_va_space = %d (2 = full randomisation)\\n", level);
    free(heap);
    return 0;
}` }],
        explain: `- The program runs itself twice (\`popen("./main report")\`) and each copy prints the address of a stack variable, a heap block and the \`printf\` function in libc.
- All three differ between runs: the kernel placed the stack, the heap and the shared libraries at random addresses.
- An attacker who overflows a buffer now has to guess where to jump. Real exploits therefore first need an **information leak** that reveals one address.
- \`randomize_va_space = 2\` means full randomisation; 0 turns it off (debuggers like \`gdb\` turn it off for the program they run, so crashes are reproducible).`,
        output: `stack moved between runs: yes
heap moved between runs:  yes
libc moved between runs:  yes
/proc/sys/kernel/randomize_va_space = 2 (2 = full randomisation)`,
      },
    ],
    interview: [
      {
        q: "Explain Unix file permissions. What does chmod 754 mean?",
        freq: "very-common",
        a: `Each file has an owner, a group and three permission triples (owner, group, others) of read (4), write (2) and execute (1). 754 = owner \`rwx\` (7), group \`r-x\` (5), others \`r--\` (4). The kernel uses the owner bits if your UID matches, else the group bits if you're in the file's group, else the others bits; root bypasses checks. On directories, r lists names, w creates or deletes entries, x allows traversal. Special bits: setuid (4000), setgid (2000), sticky (1000).`,
      },
      {
        q: "What is the principle of least privilege? How do you apply it to a server?",
        freq: "very-common",
        a: `Every component should have only the permissions it needs, only for as long as it needs them, so a compromise does limited damage. For a server: run as a dedicated unprivileged user; if it needs a privileged port, grant only \`CAP_NET_BIND_SERVICE\` or bind and then drop privileges; restrict file access (ownership, read-only file systems); apply seccomp and AppArmor/SELinux profiles; in containers, drop all capabilities, run as non-root, use a read-only root file system; scope credentials and network access tightly.`,
      },
      {
        q: "What does the setuid bit do, and why is it risky?",
        freq: "common",
        a: `A setuid executable runs with the effective UID of the file's owner instead of the user who launched it, so \`passwd\` (owned by root) can modify \`/etc/shadow\` on behalf of a normal user. It's risky because any vulnerability in that program (a buffer overflow, an unsafe environment variable, a TOCTOU race, a command injection) gives the attacker the owner's privileges, often root. Minimise setuid binaries, prefer capabilities or a privileged helper service, and audit with \`find / -perm -4000\`.`,
      },
      {
        q: "What are Linux capabilities?",
        freq: "common",
        a: `A split of root's all-powerful privileges into about 40 independent units: \`CAP_NET_BIND_SERVICE\`, \`CAP_NET_ADMIN\`, \`CAP_SYS_ADMIN\`, \`CAP_DAC_OVERRIDE\`, \`CAP_SYS_PTRACE\`, \`CAP_CHOWN\` and so on. A process can hold just the ones it needs; files can carry capabilities (\`setcap\`) instead of being setuid root. Containers drop most capabilities by default; \`--privileged\` gives them all back, which is why it's dangerous. \`CAP_SYS_ADMIN\` is so broad it's nearly equivalent to root.`,
      },
      {
        q: "What is seccomp and how do containers use it?",
        freq: "occasional",
        a: `A Linux mechanism that filters a process's system calls with a BPF program evaluated on each call, returning allow, an errno, trap, log or kill. It reduces the kernel attack surface available to a compromised process. Docker and Kubernetes apply a default profile blocking around 40 rarely needed, dangerous syscalls (\`mount\`, \`kexec_load\`, \`init_module\`, \`reboot\`, \`unshare\` without privileges...). Filters are inherited and can only be tightened, and require \`no_new_privs\` (or \`CAP_SYS_ADMIN\`) to install.`,
      },
      {
        q: "How do ASLR, NX and stack canaries protect against buffer overflows?",
        freq: "common",
        a: `A classic stack overflow overwrites the return address to jump to injected code. **NX** marks the stack and heap non-executable, so injected bytes can't run. **Stack canaries** place a random value before the saved return address and check it on return; an overflow that reaches the return address destroys the canary and the program aborts. **ASLR** randomises where the stack, heap, libraries and (with PIE) the program are, so the attacker can't know which address to jump to (for example, for return-to-libc or ROP gadgets). Attackers combine info leaks and ROP to bypass them, hence additional layers like CFI and shadow stacks.`,
      },
      {
        q: "What's the difference between DAC and MAC?",
        freq: "occasional",
        a: `**Discretionary** access control: the owner of an object decides who may access it (Unix permission bits, ACLs); root overrides everything. **Mandatory** access control: a central policy, set by the administrator and enforced by the kernel, constrains all subjects including root and owners: SELinux (labels and type enforcement), AppArmor (path-based profiles), SMACK. MAC limits damage when a privileged process is compromised: a hacked web server confined by SELinux still can't read \`/etc/shadow\`.`,
      },
    ],
    quiz: [
      {
        q: "What does chmod 640 give the group?",
        options: ["rwx", "rw-", "r--", "---"],
        answer: 2,
        explain: "6 = rw- for the owner, 4 = r-- for the group, 0 = --- for others.",
      },
      {
        q: "A file is ---rwx--- and you're its owner and in its group. Can you read it?",
        options: ["Yes, through the group bits", "No: as the owner, only the owner bits are checked", "Only as root", "Only if it's a directory"],
        answer: 1,
        explain: "The kernel checks one class, the first that matches, and doesn't fall through.",
      },
      {
        q: "With umask 027, a program creates a file with mode 666. What mode does it get?",
        options: ["666", "640", "644", "600"],
        answer: 1,
        explain: "666 with the bits of 027 removed: rw- r-- --- = 640.",
      },
      {
        q: "Why does /tmp have the sticky bit?",
        options: ["To make it faster", "So users can only delete their own files in a world-writable directory", "To keep files in RAM", "To stop root"],
        answer: 1,
        explain: "Without it, anyone with write permission on /tmp could delete anyone's files.",
      },
      {
        q: "A web server needs port 443 but nothing else that root can do. Best option?",
        options: ["Run it as root", "Give it only CAP_NET_BIND_SERVICE (or bind as root, then drop privileges)", "chmod 777 the binary", "Disable the firewall"],
        answer: 1,
        explain: "Least privilege: grant the one capability it needs.",
      },
      {
        q: "A seccomp filter returns SECCOMP_RET_KILL_PROCESS for a syscall. What does the process see?",
        options: ["An EPERM error", "It's killed with SIGSYS", "The call runs anyway", "A warning in the log"],
        answer: 1,
        explain: "The kernel terminates it before the system call executes.",
      },
      {
        q: "What does ASLR make harder for an attacker?",
        options: ["Reading files", "Knowing the addresses of code, libraries and the stack", "Sending network packets", "Guessing passwords"],
        answer: 1,
        explain: "Exploits that jump to known addresses become guesses; attackers need an info leak.",
      },
      {
        q: "When dropping root privileges, which order is correct?",
        options: ["setuid, then setgid", "setgroups and setgid first, setuid last", "Only setuid is needed", "Order doesn't matter"],
        answer: 1,
        explain: "After setuid to a normal user, you no longer have permission to change groups.",
      },
    ],
  },

  // ------------------------------------------------------------------ VIRTUALIZATION
  {
    id: "os-virtualization",
    title: "Virtual machines and containers",
    tagline: "Hypervisors (type 1 and 2), trap-and-emulate, hardware virtualization, paravirtualization, containers vs VMs, namespaces, cgroups, overlay file systems, and how docker run builds a container.",
    difficulty: "advanced",
    minutes: 45,
    visualizers: ["dockerrun"],
    concept: `## Explain it like I'm 10 🧸
**A virtual machine** is like building **pretend houses inside one big warehouse**. Each pretend house has its own walls, its own kitchen, its own front door, even its own **caretaker** (its own operating system). The people inside think it's a real house. A warehouse manager (the **hypervisor**) shares out the space, water and electricity.

**A container** is cheaper: one big house, one caretaker (one kernel), but every family gets their own **rooms with blinkers on**. Each family sees only its own rooms, its own toys and its own family members, and has a **budget** for electricity and water. They think they're alone, but they share the same plumbing.
- Blinkers = **namespaces** (what you can **see**).
- Budgets = **cgroups** (how much you can **use**).

## Virtual machines
A **hypervisor** (virtual machine monitor) runs several **guest** operating systems on one physical machine, each believing it has its own CPU, memory and devices.
| Type | Runs on | Examples |
|---|---|---|
| **Type 1** (bare metal) | Directly on the hardware | KVM (part of Linux), Xen, VMware ESXi, Hyper-V, AWS Nitro |
| **Type 2** (hosted) | As an app on a normal OS | VirtualBox, VMware Workstation, Parallels, QEMU without KVM |

**How can a guest kernel run privileged instructions?** The classic answer is **trap-and-emulate**: run the guest kernel in user mode; when it tries a privileged instruction, the CPU **traps** to the hypervisor, which emulates it. Old x86 had instructions that silently behaved differently instead of trapping, so VMware used **binary translation**, and Xen used **paravirtualization** (modifying the guest kernel to call the hypervisor directly with **hypercalls**).

Since 2005, CPUs have **hardware virtualization** (Intel VT-x, AMD-V, ARM's EL2): a new "guest mode" where the guest kernel runs at full speed in its own ring 0, and only specific events cause a **VM exit** to the hypervisor. **Nested page tables** (EPT, NPT) translate guest-virtual → guest-physical → host-physical in hardware. **virtio** devices give guests fast paravirtual disks and network cards. That's why VMs today run at near-native speed.

## Containers
A container is **just a normal Linux process** with a different view of the system. There's **no guest kernel**: every container shares the host's kernel. Three kernel features make it work.

### 1. Namespaces: what a process can see
| Namespace | Isolates | Effect inside the container |
|---|---|---|
| **PID** | Process IDs | The container's first process is PID 1 and can't see the host's processes |
| **Mount** | The mount table | Its own root file system |
| **Network** | Interfaces, IPs, routes, ports | Its own \`eth0\` and \`localhost\`; port 80 isn't the host's port 80 |
| **UTS** | Hostname | Its own hostname |
| **IPC** | System V IPC, POSIX queues | Separate shared memory |
| **User** | UID and GID mappings | Root inside can be an unprivileged user outside ("rootless containers") |
| **Cgroup** | The view of the cgroup tree | Sees its own cgroup as the root |
| **Time** | Boot and monotonic clocks | Its own clock offsets |

They're created with \`clone()\` or \`unshare()\` flags (\`CLONE_NEWPID\`...) and joined with \`setns()\`. Our sample creates a child in new PID, UTS and mount namespaces: it is PID 1, has its own hostname, and its own \`/proc\` shows only itself. \`ls -l /proc/self/ns\` lists your process's namespaces.

### 2. Control groups (cgroups): how much a process can use
cgroups (v2 today) organise processes in a tree under \`/sys/fs/cgroup\` and apply limits per group:
- **memory.max**: hard memory limit. Exceed it and the kernel's OOM killer kills a process in the group: Docker's "OOMKilled", exit code **137** (128 + SIGKILL 9). Our sample shows it.
- **cpu.max**: \`quota period\`, for example \`20000 100000\` is 20% of one CPU. Our busy loop got exactly that. Exceeding it means **throttling**, not killing. Kubernetes CPU limits are this.
- **cpu.weight**: relative share when CPUs are contended (Kubernetes CPU requests).
- **io.max**, **pids.max** (stops fork bombs) and more.

### 3. A layered root file system
An image is a stack of read-only **layers** (one per Dockerfile instruction). **overlayfs** merges them with a thin writable layer on top: reads fall through to the lower layers, writes **copy the file up** into the top layer. Ten containers from one image share the same layers on disk and in the page cache.

Add **capabilities** dropped to a minimum, a **seccomp** profile and an AppArmor or SELinux profile (all from the security level), and you have a container. \`runc\`, the low-level runtime under Docker, containerd and Kubernetes, is the program that makes these system calls. The visualizer follows \`docker run\` through every layer down to runc.

## VMs vs containers
| | Virtual machine | Container |
|---|---|---|
| Kernel | Its own guest kernel | Shares the host's kernel |
| Isolation | Strong: hardware-enforced boundary | Weaker: one kernel bug can break out |
| Start time | Seconds to minutes | Milliseconds |
| Overhead | A whole OS per VM (hundreds of MiB) | Just the process |
| Density | Tens per host | Hundreds or thousands per host |
| Different OS? | Yes (Windows on Linux) | No: Linux containers need a Linux kernel (Docker Desktop on a Mac runs a small Linux VM) |

They're often **combined**: cloud providers run your containers inside VMs, and **microVMs** like **Firecracker** (AWS Lambda, Fargate) and **gVisor** (a user-space kernel) give container speed with VM-like isolation.

## Why "root in a container" still matters
Without a user namespace, root inside a container **is** root on the host's kernel, just with fewer capabilities and limited visibility. Escapes come from kernel bugs, \`--privileged\`, mounting the Docker socket (\`/var/run/docker.sock\` gives control of the host), or sensitive host paths. Run as a non-root user, drop capabilities, never mount the Docker socket into untrusted containers, and keep the kernel patched.`,
    keyPoints: [
      "A hypervisor runs guest OSes; type 1 runs on hardware (KVM, Xen, ESXi), type 2 on a host OS",
      "VT-x/AMD-V and nested page tables let guests run at near-native speed; virtio speeds up devices",
      "A container is a normal process with namespaces (what it sees) and cgroups (what it can use)",
      "PID, mount, network, UTS, IPC, user, cgroup and time namespaces isolate different resources",
      "cgroup memory.max causes OOM kills (exit 137); cpu.max throttles",
      "Images are read-only layers merged by overlayfs with a copy-on-write top layer",
      "Containers share the host kernel: faster and denser than VMs, but weaker isolation",
    ],
    code: [
      {
        title: "A container in miniature: namespaces with clone()",
        linux: true,
        privileged: true,
        variants: [{ lang: "c", code: `// A container in miniature: clone() a child into new PID, UTS (hostname) and mount namespaces.
#define _GNU_SOURCE
#include <dirent.h>
#include <sched.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/wait.h>
#include <unistd.h>

static char stack[1024 * 1024];

static int child(void *arg) {
    (void)arg;
    sethostname("tiny-box", 8);                      // only changes the hostname in OUR UTS namespace
    mount("none", "/", NULL, MS_REC | MS_PRIVATE, NULL);     // don't let mounts leak back out
    mount("proc", "/proc", "proc", 0, NULL);          // a fresh /proc that shows only our PID namespace
    char host[64];
    gethostname(host, sizeof host);
    printf("inside:  my PID is %d, my hostname is %s\\n", (int)getpid(), host);
    int procs = 0;
    DIR *d = opendir("/proc");                        // every numeric directory in /proc is a process
    for (struct dirent *e; (e = readdir(d));)
        if (e->d_name[0] >= '0' && e->d_name[0] <= '9') procs++;
    closedir(d);
    printf("inside:  /proc lists %d process: just me. The host's processes are invisible\\n", procs);
    fflush(stdout);
    return 0;
}

int main(void) {
    char before[64], after[64];
    gethostname(before, sizeof before);
    fflush(stdout);
    pid_t pid = clone(child, stack + sizeof stack, CLONE_NEWPID | CLONE_NEWUTS | CLONE_NEWNS | SIGCHLD, NULL);
    if (pid < 0) {
        perror("clone (needs root / CAP_SYS_ADMIN)");
        return 1;
    }
    waitpid(pid, NULL, 0);
    gethostname(after, sizeof after);
    printf("outside: the child's real PID is not 1: %s\\n", pid != 1 ? "yes" : "no");
    printf("outside: my hostname is unchanged: %s\\n", strcmp(before, after) == 0 ? "yes" : "no");
    return 0;
}` }],
        explain: `- \`clone()\` is the system call behind both \`fork\` and \`pthread_create\`. With \`CLONE_NEWPID | CLONE_NEWUTS | CLONE_NEWNS\` the child starts in three **new namespaces**. It needs \`CAP_SYS_ADMIN\`, so this sample runs as root in a privileged container.
- Inside, \`getpid()\` returns **1**: the child is the init process of its own PID namespace. Outside, the parent sees its real PID, which isn't 1.
- \`sethostname\` changes the hostname only in the child's UTS namespace; the parent's hostname is untouched.
- Mounting a fresh \`/proc\` (in the private mount namespace) shows only the processes in the new PID namespace: one. Without that mount, \`ps\` would read the old \`/proc\` and see everything.
- Add a network namespace, a cgroup, an overlay root file system with \`pivot_root\`, dropped capabilities and seccomp, and this is what \`runc\` does.`,
        output: `inside:  my PID is 1, my hostname is tiny-box
inside:  /proc lists 1 process: just me. The host's processes are invisible
outside: the child's real PID is not 1: yes
outside: my hostname is unchanged: yes`,
      },
      {
        title: "cgroups v2: memory and CPU limits by hand",
        linux: true,
        privileged: true,
        variants: [{ lang: "bash", code: `# Control groups (cgroup v2): cap a group of processes at 50 MiB of memory and 20% of one CPU.
set -e
cd /sys/fs/cgroup
# The "no internal processes" rule: move ourselves out of the root before enabling controllers for children.
mkdir -p init && echo $$ > init/cgroup.procs
echo "+memory +cpu" > cgroup.subtree_control
mkdir -p demo
echo $((50 * 1024 * 1024)) > demo/memory.max            # hard limit: 50 MiB
[ -f demo/memory.swap.max ] && echo 0 > demo/memory.swap.max
echo "20000 100000" > demo/cpu.max                      # 20 ms of CPU every 100 ms = 20% of a core

# 1) a process that tries to use 200 MiB inside the group
set +e
bash -c 'echo $$ > /sys/fs/cgroup/demo/cgroup.procs; exec python3 -c "x = b\\"x\\" * (200 << 20); print(\\"allocated?!\\")"'
code=$?
set -e
echo "python asked for 200 MiB in a 50 MiB group: exit code $code ($( [ $code -eq 137 ] && echo 'killed by SIGKILL: 128 + 9'))"
echo "memory.events says oom_kill $(awk '/^oom_kill /{print $2}' demo/memory.events)"

# 2) a busy loop for one second of wall-clock time
before=$(awk '/^usage_usec/{print $2}' demo/cpu.stat)
timeout 1 bash -c 'echo $$ > /sys/fs/cgroup/demo/cgroup.procs; while :; do :; done' || true
after=$(awk '/^usage_usec/{print $2}' demo/cpu.stat)
pct=$(( (after - before) / 10000 ))
echo "busy loop for 1 s got about 20% of a CPU: $( [ $pct -ge 12 ] && [ $pct -le 28 ] && echo yes || echo "no ($pct%)")"` }],
        explain: `- cgroup v2 is a file system: creating a directory under \`/sys/fs/cgroup\` creates a group, and writing to its files sets limits. Writing a PID into \`cgroup.procs\` moves that process into the group.
- The "no internal processes" rule says a group can't both contain processes and give controllers to child groups, so the script first moves itself into an \`init\` group, then enables the memory and cpu controllers for children.
- \`memory.max\` = 50 MiB. The Python process tries to build a 200 MiB bytes object; the kernel's OOM killer kills it, the exit code is **137**, and \`memory.events\` counts the \`oom_kill\`. This is exactly a Kubernetes "OOMKilled" pod.
- \`cpu.max\` = "20000 100000": 20 ms of CPU per 100 ms period. A busy loop running for a full second is charged only about 0.2 s of CPU: it's **throttled**, not killed.`,
        output: `python asked for 200 MiB in a 50 MiB group: exit code 137 (killed by SIGKILL: 128 + 9)
memory.events says oom_kill 1
busy loop for 1 s got about 20% of a CPU: yes`,
      },
    ],
    interview: [
      {
        q: "What's the difference between a virtual machine and a container?",
        freq: "very-common",
        a: `A **VM** virtualises hardware: a hypervisor runs a complete guest OS with its own kernel, giving strong isolation (a hardware-enforced boundary) at the cost of memory, boot time and density. A **container** virtualises the OS: it's a group of normal processes on the host kernel, isolated with namespaces, limited with cgroups, and given its own root file system (image layers via overlayfs), plus capabilities and seccomp. Containers start in milliseconds and are very dense but share the kernel, so isolation is weaker; Linux containers need a Linux kernel.`,
      },
      {
        q: "What are namespaces and cgroups?",
        freq: "very-common",
        a: `Both are Linux kernel features that containers are built on. **Namespaces** control what a process can **see**: PID (own process tree, PID 1), mount (own file system tree), network (own interfaces and ports), UTS (hostname), IPC, user (UID mapping, rootless), cgroup and time. **cgroups** control what a group of processes can **use** and account for it: memory limits (OOM kill on exceeding), CPU quota and weight (throttling), I/O bandwidth, number of PIDs, plus freezing and statistics.`,
      },
      {
        q: "A container exits with code 137. What happened?",
        freq: "common",
        a: `137 = 128 + 9: the main process was killed by SIGKILL. Most often the cgroup memory limit was exceeded and the OOM killer fired (\`docker inspect\` shows \`OOMKilled: true\`, Kubernetes shows \`OOMKilled\`). It can also be \`docker kill\`, or SIGKILL after the SIGTERM grace period expired on stop. Check memory usage vs limit, look for leaks, raise the limit, or make the runtime cgroup-aware (JVM \`MaxRAMPercentage\`).`,
      },
      {
        q: "How does hardware-assisted virtualization work?",
        freq: "occasional",
        a: `CPUs add a guest mode (Intel VT-x "VMX non-root", AMD-V, ARM EL1 under EL2) so a guest kernel runs natively in its own privileged ring. The hypervisor configures which events cause a **VM exit** (I/O instructions, certain register writes, interrupts, EPT violations); the CPU saves guest state into a control structure (VMCS) and jumps to the hypervisor, which handles it and resumes with a VM entry. **Nested paging** (EPT/NPT) lets the MMU walk both guest and host page tables, avoiding shadow page tables. Paravirtual drivers (virtio) and device passthrough (SR-IOV, IOMMU) minimise exits for I/O.`,
      },
      {
        q: "What is the difference between a CPU limit and a CPU request in Kubernetes, at the cgroup level?",
        freq: "common",
        a: `A **request** becomes \`cpu.weight\` (shares): a relative priority used only when the CPU is contended, plus a scheduling guarantee. A **limit** becomes \`cpu.max\` (CFS quota per period, typically 100 ms): once the container uses its quota in a period, it's **throttled** until the next period, even if the node is idle. That's why tight CPU limits cause latency spikes in multithreaded apps, and why many teams set requests but avoid CPU limits. Memory limits, by contrast, cause OOM kills.`,
      },
      {
        q: "How does Docker's layered file system work?",
        freq: "common",
        a: `Each Dockerfile instruction that changes files creates a read-only layer (a tarball of changes, content-addressed). At run time, overlayfs stacks the image's layers as lower directories and adds an empty writable upper directory. Reads find the topmost version of a file; writes trigger **copy-up** of the file into the upper layer; deletes create whiteout files. Containers from the same image share all lower layers on disk and in the page cache; the upper layer disappears with the container unless committed, which is why data belongs in volumes.`,
      },
      {
        q: "Is a container a security boundary?",
        freq: "occasional",
        a: `A partial one. All containers share the host kernel, so a kernel vulnerability, a privileged container, a mounted Docker socket, extra capabilities or sensitive host mounts can lead to a host compromise. Hardening: run as non-root (and use user namespaces), drop all capabilities, keep seccomp and AppArmor/SELinux on, read-only root file system, no privilege escalation, patch the kernel. For untrusted multi-tenant code, add a stronger boundary: gVisor, Kata Containers or Firecracker microVMs.`,
      },
    ],
    quiz: [
      {
        q: "Which of these is a type 1 (bare-metal) hypervisor?",
        options: ["VirtualBox", "KVM", "Parallels Desktop", "Docker"],
        answer: 1,
        explain: "KVM turns the Linux kernel itself into the hypervisor; VirtualBox and Parallels are hosted.",
      },
      {
        q: "What does a container share with the host that a VM doesn't?",
        options: ["The disk", "The kernel", "The CPU", "Nothing"],
        answer: 1,
        explain: "Containers are host processes; VMs run their own guest kernel.",
      },
      {
        q: "Which namespace makes a container's first process PID 1?",
        options: ["UTS", "PID", "Mount", "User"],
        answer: 1,
        explain: "A new PID namespace starts numbering at 1.",
      },
      {
        q: "A container goes over its cgroup memory.max. What happens?",
        options: ["It's throttled", "The OOM killer kills a process in it (exit 137)", "It swaps forever", "Nothing"],
        answer: 1,
        explain: "Memory can't be throttled like CPU; exceeding the hard limit triggers the OOM killer.",
      },
      {
        q: "cpu.max is set to 50000 100000. How much CPU can the group use?",
        options: ["50 CPUs", "Half of one CPU", "100%", "5%"],
        answer: 1,
        explain: "50 ms of CPU time per 100 ms period = 0.5 CPU; beyond that it's throttled.",
      },
      {
        q: "A container writes to a file that came from its image. Where does the change go?",
        options: ["Into the image layer", "Into the container's writable top layer (copy-up)", "Nowhere", "Into every container"],
        answer: 1,
        explain: "overlayfs copies the file up; image layers stay read-only and shared.",
      },
      {
        q: "Why can't a Linux container run on a Mac's kernel directly?",
        options: ["Licences", "Containers use the host's kernel, and Linux containers need a Linux kernel", "Macs have no CPUs", "Docker forbids it"],
        answer: 1,
        explain: "Docker Desktop runs a small Linux VM to host them.",
      },
    ],
  },

  // ------------------------------------------------------------------ LINUX IN PRACTICE
  {
    id: "os-linux",
    title: "Linux in practice: observing and debugging a live system",
    tagline: "/proc and /sys, systemd and journald, load average, top and vmstat, free and the page cache, ss, lsof, strace, perf, eBPF, dmesg, ulimits, sysctl and the 60-second performance checklist.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["incident"],
    concept: `## Explain it like I'm 10 🧸
A doctor doesn't guess what's wrong. They take your **temperature**, listen to your **heart**, check your **blood pressure**, then decide. When a computer is "slow" or "broken", engineers do the same: they check the **vital signs** of the operating system, one by one. Everything you learned in this world (processes, scheduling, memory, files, I/O) shows up in these tools. This level is the doctor's toolkit.

## Everything is in /proc and /sys
\`ps\`, \`top\`, \`free\` and friends just read files:
| File | What it tells you |
|---|---|
| \`/proc/PID/status\`, \`/proc/PID/stat\` | State (R running, S sleeping, D disk wait, Z zombie), memory (VmRSS), threads, context switches |
| \`/proc/PID/fd/\` | Every open file descriptor |
| \`/proc/PID/maps\`, \`smaps_rollup\` | The address space (Part 4) |
| \`/proc/loadavg\` | Load averages and running/total tasks |
| \`/proc/meminfo\` | Memory: MemTotal, MemAvailable, Cached, Dirty, swap |
| \`/proc/pressure/{cpu,memory,io}\` | **PSI**: how much time tasks spent stalled waiting for each resource |
| \`/sys/fs/cgroup/...\` | Per-container limits and usage (Part 6) |
| \`/sys/block/DEV/queue/scheduler\` | The I/O scheduler (Part 5) |

Our Python sample is a tiny \`ps\` built from these files.

## systemd, journald and the boot
On most distributions **systemd** is PID 1 (Part 1): it starts **units** (services, mounts, timers) in dependency order, restarts crashed services, and puts each service in its own **cgroup**, so \`systemctl status nginx\` shows every process of a service and its memory.
\`\`\`bash
systemctl status nginx          # running? recent logs, PID, memory, cgroup
systemctl restart nginx
journalctl -u nginx -f          # follow a service's logs
journalctl -b -p err            # errors since boot
systemd-analyze blame           # what slowed down the boot
\`\`\`

## The vital signs
**Load average** (\`uptime\`, \`top\`): the average number of tasks **running or waiting to run** over 1, 5 and 15 minutes. On Linux it also counts tasks in **uninterruptible sleep** (state D, usually waiting for disk or NFS). Compare it with the number of CPUs: a load of 8 on an 8-core machine is busy but fine; 40 means work is queueing (or many tasks are stuck in D).

**CPU time breakdown** (\`top\`, \`vmstat\`, \`mpstat\`):
| Field | Meaning | High means |
|---|---|---|
| **us** | User code | Your app is computing |
| **sy** | Kernel code | Lots of system calls, context switches, or kernel work |
| **wa** | Idle while I/O is outstanding | Waiting on disk |
| **st** | Stolen by the hypervisor | A noisy neighbour on a cloud VM |
| **si/hi** | Soft/hard interrupts | Heavy networking |

A process at "200% CPU" in \`top\` uses two cores' worth, as our sample measures with \`getrusage\`.

**Memory** (\`free -h\`): don't panic at low "free" memory. Linux uses spare RAM for the **page cache**. The number that matters is **available** (free + reclaimable cache). Real trouble looks like: swap in/out activity (\`vmstat\` si/so columns), major page faults, memory PSI rising, or OOM-killer messages in \`dmesg\`.

## The 60-second checklist
When someone says "the server is slow", run these in order (Brendan Gregg's classic list):
\`\`\`bash
uptime                  # load averages: rising or falling?
dmesg -T | tail         # OOM kills, disk errors, dropped packets
vmstat 1                # r (run queue), si/so (swapping), us/sy/wa/st
mpstat -P ALL 1         # one hot CPU? (a single-threaded bottleneck)
pidstat 1               # which processes use CPU
iostat -xz 1            # disk utilisation, await latency, queue size
free -m                 # available memory
sar -n DEV 1            # network throughput
sar -n TCP,ETCP 1       # connection rates and retransmits
top                     # the overview
\`\`\`
Think with the **USE method**: for every resource (CPU, memory, disk, network), check **U**tilisation, **S**aturation (queueing) and **E**rrors.

## Looking inside a process
| Tool | Shows | Example |
|---|---|---|
| \`ps\` / \`pstree\` | Processes, states, parents | \`ps -eo pid,ppid,stat,rss,cmd --sort=-rss\` |
| \`lsof\` | Open files and sockets | \`lsof -p PID\`, \`lsof -i :8080\` |
| \`ss\` | Sockets and connection states | \`ss -tlnp\` (who listens where), \`ss -s\` |
| \`strace\` | Every **system call** a process makes | \`strace -f -e trace=open,connect -p PID\`; \`strace -c\` for a summary |
| \`ltrace\` | Library calls | |
| \`gdb\` | Stacks, variables | \`gdb -p PID\` then \`thread apply all bt\` (deadlocks!) |
| \`perf\` | Where CPU time goes (sampling profiler) | \`perf top\`, \`perf record -g\` → flame graph |
| **eBPF** tools (bcc, bpftrace) | Safe programs inside the kernel | \`execsnoop\` (new processes), \`opensnoop\`, \`biolatency\`, \`tcpretrans\`, \`runqlat\` |

\`strace\` is the superpower that ties this whole world together: you can **watch** a program open files, map memory, fork, exec, wait, read sockets and call epoll. "Permission denied" or "No such file" mysteries are often solved in seconds by finding the failing \`openat\`.

## Limits and tuning knobs
- **ulimit** (per process): open files (\`ulimit -n\`, a classic "Too many open files" fix), processes, stack size, core dumps. systemd services set them with \`LimitNOFILE=\`.
- **sysctl** (kernel-wide): \`vm.swappiness\`, \`vm.overcommit_memory\`, \`net.core.somaxconn\` (listen backlog), \`fs.file-max\`, \`kernel.pid_max\`. Set in \`/etc/sysctl.d/\`.

## Classic incidents and their causes
| Symptom | Usually | Where to look |
|---|---|---|
| Process killed, exit 137 | OOM killer (host or cgroup) | \`dmesg\`, \`memory.events\`, \`kubectl describe\` |
| "Too many open files" | fd leak or low ulimit | \`ls /proc/PID/fd \| wc -l\`, \`ulimit -n\` |
| Disk full but files deleted | Deleted files still open | \`lsof +L1\` |
| High load, low CPU use | Tasks stuck in D state (disk or NFS) | \`ps -eo stat,cmd \| grep ^D\`, \`iostat\` |
| Latency spikes, CPU looks fine | cgroup CPU throttling, GC pauses, swapping | \`cpu.stat\` nr_throttled, PSI |
| Zombie processes piling up | Parent never calls \`wait\` | \`ps -eo stat,ppid\` |
| "No space left on device" with free space | Out of inodes | \`df -i\` |

Practise exactly this in the visualizer: you get paged, run commands, and find the root cause.`,
    keyPoints: [
      "ps, top and free read /proc and /sys; /proc/PID shows a process's state, memory, fds and maps",
      "systemd is PID 1: it manages services as units in cgroups; journalctl reads their logs",
      "Load average counts runnable and uninterruptible tasks; compare it with the CPU count",
      "us, sy, wa and st split CPU time; 'available' memory matters, not 'free'",
      "Run the 60-second checklist and the USE method: utilisation, saturation, errors per resource",
      "strace shows system calls, perf shows CPU hot spots, eBPF tools trace the kernel safely",
      "Classic incidents: OOM (137), fd limits, deleted-but-open files, D-state tasks, throttling, zombies, inodes",
    ],
    code: [
      {
        title: "A tiny ps, built from /proc (Python)",
        linux: true,
        variants: [{ lang: "python", code: `# A tiny "ps": everything ps and top show comes from reading files in /proc.
import os
import subprocess
import time

sleeper = subprocess.Popen(["sleep", "5"])          # give ourselves a child to find
time.sleep(0.2)


def info(pid):
    with open(f"/proc/{pid}/stat") as f:
        raw = f.read()
    name = raw[raw.index("(") + 1: raw.rindex(")")]  # the name can contain spaces, so use the parentheses
    fields = raw[raw.rindex(")") + 2:].split()
    state, ppid = fields[0], int(fields[1])
    with open(f"/proc/{pid}/status") as f:
        status = dict(line.split(":", 1) for line in f)
    return name, state, ppid, int(status["Threads"]), status["VmRSS"].strip() if "VmRSS" in status else "-"


me = os.getpid()
pids = sorted(int(p) for p in os.listdir("/proc") if p.isdigit())
names = {}
for pid in pids:
    name, state, ppid, threads, rss = info(pid)
    names[pid] = name
    if pid == me:
        print(f"me:      {name}, state {state} (running), {threads} thread(s)")
    elif pid == sleeper.pid:
        print(f"child:   {name}, state {state} (sleeping), parent is {'me' if ppid == me else ppid}")
with open("/proc/loadavg") as f:
    parts = f.read().split()
print(f"/proc/loadavg has 5 fields: 1, 5 and 15 minute load, running/total tasks, last PID: {len(parts) == 5}")
with open("/proc/meminfo") as f:
    mem = {line.split(":")[0]: int(line.split()[1]) for line in f}
print(f"MemAvailable <= MemTotal: {mem['MemAvailable'] <= mem['MemTotal']}")
sleeper.kill()
sleeper.wait()` }],
        explain: `- Every process is a directory \`/proc/PID\`. \`/proc/PID/stat\` is one line of fields; the name is in parentheses and may contain spaces, so it's cut out first, then the rest is split: state, then parent PID.
- \`/proc/PID/status\` is the human-friendly version: \`Threads\`, \`VmRSS\`, \`voluntary_ctxt_switches\` and many more.
- The program starts a \`sleep\` child and finds it: state **S** (sleeping, waiting for its timer) with our PID as its parent. We are state **R**: running, because we're the one reading \`/proc\`.
- \`/proc/loadavg\` and \`/proc/meminfo\` are where \`uptime\` and \`free\` get their numbers.`,
        output: `me:      python3, state R (running), 1 thread(s)
child:   sleep, state S (sleeping), parent is me
/proc/loadavg has 5 fields: 1, 5 and 15 minute load, running/total tasks, last PID: True
MemAvailable <= MemTotal: True`,
      },
      {
        title: "What \"200% CPU\" means",
        linux: true,
        note: "On the test machine: wall 0.50 s, user 1.01 s, sys 0.00 s, 201% CPU (printed to stderr).",
        variants: [{ lang: "c", code: `// CPU accounting: how top knows a process uses "200% CPU". Burn two cores and measure ourselves.
#include <pthread.h>
#include <stdio.h>
#include <sys/resource.h>
#include <time.h>

static volatile int stop;
static void *burn(void *arg) {
    (void)arg;
    volatile unsigned long x = 0;
    while (!stop) x++;
    return NULL;
}

static double now(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}

int main(void) {
    double wall0 = now();
    pthread_t t[2];
    for (int i = 0; i < 2; i++) pthread_create(&t[i], NULL, burn, NULL);
    struct timespec half = {0, 500000000};
    nanosleep(&half, NULL);                        // main sleeps: it uses no CPU meanwhile
    stop = 1;
    for (int i = 0; i < 2; i++) pthread_join(t[i], NULL);
    double wall = now() - wall0;
    struct rusage ru;
    getrusage(RUSAGE_SELF, &ru);                   // the kernel's count of our CPU time (all threads)
    double user = ru.ru_utime.tv_sec + ru.ru_utime.tv_usec / 1e6;
    double sys = ru.ru_stime.tv_sec + ru.ru_stime.tv_usec / 1e6;
    double cores = (user + sys) / wall;
    fprintf(stderr, "wall %.2f s, user %.2f s, sys %.2f s, %.0f%% CPU\\n", wall, user, sys, cores * 100);
    printf("2 busy threads for half a second: about 200%% CPU in top: %s\\n", cores > 1.7 && cores < 2.1 ? "yes" : "no");
    printf("almost all of it is user time, not kernel time: %s\\n", user > 5 * sys ? "yes" : "no");
    return 0;
}` }],
        explain: `- Two threads spin for half a second of **wall-clock** time, while the main thread sleeps.
- \`getrusage\` returns the CPU time the kernel charged to the whole process: about 1 second of **user** time, because two cores each ran for 0.5 s. CPU time ÷ wall time = 2.0, shown as **200%** by \`top\`.
- Almost no **sys** (kernel) time: the loop makes no system calls. A program with high sys time is busy in the kernel (lots of syscalls, page faults or context switches) and \`strace -c\` or \`perf\` would show where.`,
        output: `2 busy threads for half a second: about 200% CPU in top: yes
almost all of it is user time, not kernel time: yes`,
      },
    ],
    interview: [
      {
        q: "A Linux server is slow. Walk me through how you'd investigate.",
        freq: "very-common",
        a: `Clarify the symptom (latency, errors, which service, since when, any change or deploy). Then check resources with the USE method: \`uptime\` (load trend), \`dmesg\` (OOM kills, I/O errors), \`vmstat 1\` (run queue, swapping, us/sy/wa/st), \`mpstat\` (one saturated core?), \`pidstat\`/\`top\` (which process), \`iostat -xz\` (disk utilisation and await), \`free\` (available memory), \`ss\`/\`sar -n\` (network, retransmits). Narrow down to a process and use \`strace\`, \`perf\`, \`lsof\`, logs or eBPF tools to find the cause; check recent changes. Mitigate first (roll back, scale out, restart), then fix the root cause.`,
      },
      {
        q: "What does load average mean on Linux?",
        freq: "very-common",
        a: `The exponentially-damped average number of tasks that are runnable (running or waiting for a CPU) **or** in uninterruptible sleep (state D, typically waiting on disk or NFS), over the last 1, 5 and 15 minutes. Interpret it relative to the CPU count: load equal to the number of cores means fully busy; much higher means queueing. High load with low CPU usage points to D-state tasks (I/O or lock problems), not CPU saturation. PSI (\`/proc/pressure\`) gives a more direct "time stalled" measure.`,
      },
      {
        q: "free shows only 200 MB free on a 16 GB machine. Is that a problem?",
        freq: "common",
        a: `Usually not. Linux uses otherwise idle RAM as page cache (and buffers) to speed up file access, and reclaims it instantly when applications need memory. The "available" column estimates memory usable without swapping. Real memory pressure shows up as low "available", swap activity (\`vmstat\` si/so), many major faults, rising memory PSI, kswapd CPU usage, or OOM kills.`,
      },
      {
        q: "What is strace and when would you use it?",
        freq: "common",
        a: `A tool that uses \`ptrace\` to print every system call a process makes, with arguments, return values and errors. Use it to find which file a program fails to open (\`ENOENT\`, \`EACCES\`), what config it really reads, where it's blocked (stuck in \`futex\`, \`read\` or \`connect\`), and why it's slow (\`strace -c\` counts and times syscalls). It slows the target down a lot, so be careful in production; eBPF tools (\`opensnoop\`, \`execsnoop\`, \`bpftrace\`) are low-overhead alternatives.`,
      },
      {
        q: "Your service logs 'Too many open files'. What's going on and how do you fix it?",
        freq: "common",
        a: `The process hit its file descriptor limit (\`RLIMIT_NOFILE\`, often 1024 by default). Either it legitimately needs more (many connections) or it leaks fds (sockets, files not closed). Check the count with \`ls /proc/PID/fd | wc -l\` and the limit in \`/proc/PID/limits\`; see what kind they are with \`lsof -p PID\`. If it's growing without bound, fix the leak (close in \`finally\`, use context managers). Otherwise raise the limit (\`ulimit -n\`, \`LimitNOFILE=\` in the systemd unit, container ulimits).`,
      },
      {
        q: "What are the process states you see in ps, and what's a D state?",
        freq: "occasional",
        a: `**R** running or runnable, **S** interruptible sleep (waiting for an event, wakes on signals), **D** uninterruptible sleep (waiting inside the kernel, usually on disk or network file system I/O; signals, even SIGKILL, are deferred until it returns), **T** stopped (SIGSTOP or a debugger), **Z** zombie (exited, not yet reaped by its parent), **I** idle kernel thread. Many D-state tasks mean an I/O or storage problem and inflate the load average.`,
      },
    ],
    quiz: [
      {
        q: "Where do ps and top get their information?",
        options: ["From the BIOS", "By reading files in /proc", "From systemd only", "By asking each process"],
        answer: 1,
        explain: "Each process has a /proc/PID directory; /proc/stat, /proc/meminfo and others cover the system.",
      },
      {
        q: "An 8-core server has a load average of 8. What does that suggest?",
        options: ["It's broken", "About fully busy, but not overloaded", "It's idle", "8 processes crashed"],
        answer: 1,
        explain: "Roughly one runnable task per core.",
      },
      {
        q: "free -h shows little 'free' but plenty 'available'. What's using the memory?",
        options: ["A leak", "Mostly the page cache, which Linux reclaims when needed", "Swap", "The GPU"],
        answer: 1,
        explain: "Unused RAM is wasted RAM; the cache gives it back on demand.",
      },
      {
        q: "A program says 'Permission denied' but doesn't say which file. Fastest way to find out?",
        options: ["Reinstall it", "strace -f -e trace=openat and look for EACCES", "Reboot", "chmod 777 everything"],
        answer: 1,
        explain: "strace shows the exact failing system call and path.",
      },
      {
        q: "In top, high 'wa' means:",
        options: ["The CPU is waiting with I/O outstanding", "Web traffic", "Warnings in the log", "Too many threads"],
        answer: 0,
        explain: "iowait: CPUs idle while disk requests are pending.",
      },
      {
        q: "df shows 40% free space, but writes fail with 'No space left on device'. Likely cause?",
        options: ["A bad disk", "The file system ran out of inodes", "The CPU is too slow", "A firewall"],
        answer: 1,
        explain: "Millions of tiny files can exhaust inodes; check df -i.",
      },
      {
        q: "Which tool samples where a process spends CPU time, to build a flame graph?",
        options: ["lsof", "perf", "ss", "df"],
        answer: 1,
        explain: "perf record -g, then fold the stacks into a flame graph.",
      },
    ],
  },

  // ------------------------------------------------------------------ THE INTERVIEW
  {
    id: "os-interview",
    title: "The OS interview: putting it all together",
    tagline: "What happens when you run a command, from keypress to output: the questions interviewers love, the numbers to know, and how to reason through any OS question.",
    difficulty: "advanced",
    minutes: 40,
    visualizers: ["latency"],
    diagram: {
      title: "What happens when you type ls and press Enter",
      nodes: [
        { id: "kbd", label: "Keyboard", kind: "client", x: 100, y: 80, sub: "interrupt" },
        { id: "tty", label: "Terminal + tty", kind: "gateway", x: 330, y: 80, sub: "line discipline" },
        { id: "shell", label: "Shell (bash)", kind: "service", x: 580, y: 80, sub: "read, parse, fork" },
        { id: "kernel", label: "Kernel", kind: "control", x: 580, y: 300, sub: "fork, execve, page faults" },
        { id: "ls", label: "ls process", kind: "worker", x: 330, y: 300, sub: "getdents, write" },
        { id: "fs", label: "File system", kind: "storage", x: 100, y: 300, sub: "inodes, page cache" },
        { id: "sched", label: "Scheduler", kind: "monitor", x: 850, y: 300, sub: "picks who runs" },
        { id: "screen", label: "Screen", kind: "external", x: 330, y: 490, sub: "pixels" },
      ],
      edges: [
        { from: "kbd", to: "tty", label: "keypress" },
        { from: "tty", to: "shell", label: "read() returns" },
        { from: "shell", to: "kernel", label: "fork + execve" },
        { from: "kernel", to: "sched" },
        { from: "kernel", to: "ls", label: "start at _start" },
        { from: "ls", to: "fs", label: "openat, getdents" },
        { from: "ls", to: "tty", label: "write(1, ...)" },
        { from: "tty", to: "screen", dashed: true, label: "draw" },
        { from: "shell", to: "sched", dashed: true, label: "waitpid sleeps" },
      ],
      flows: [
        {
          name: "From keypress to running program",
          path: ["kbd", "tty", "shell", "kernel", "sched", "kernel", "ls"],
          steps: [
            "Each key press raises an interrupt; the keyboard driver passes the characters to the terminal's tty layer, which echoes them and buffers the line until Enter.",
            "The shell was asleep in read() on the terminal. Enter completes the line, read() returns \"ls\\n\" and the shell is woken up.",
            "The shell parses the line, searches PATH for ls, and calls fork(): a copy-on-write clone of itself. The child calls execve(\"/usr/bin/ls\").",
            "execve replaces the child's address space with the new program: the kernel maps the ELF file's segments, sets up a stack with argv and envp, and marks the child runnable.",
            "The scheduler picks the ls process to run on a core; meanwhile the parent shell blocks in waitpid().",
            "The kernel returns to user mode at the program's entry point. The dynamic loader maps libc, and the first touches of code and data cause page faults that load pages from the page cache.",
          ],
        },
        {
          name: "From running program to text on screen",
          path: ["ls", "fs", "ls", "tty", "screen"],
          steps: [
            "ls calls openat(\".\") and getdents64() through system calls. The VFS looks up the directory's inode and reads its entries, from the page cache if it was used recently.",
            "ls sorts the names and formats them into columns in user space, without the kernel's help.",
            "ls calls write(1, ...): fd 1 is the terminal, inherited from the shell. The tty layer receives the bytes.",
            "The terminal emulator renders the characters. ls calls exit(); it becomes a zombie until the shell's waitpid() collects its status, then the shell prints the next prompt.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You've explored the whole kingdom: the **power button** and the boot, the **processes** and the **scheduler** taking turns on the CPU, the **locks** that stop threads fighting, the **memory** tricks, the **file cabinets** of the file system, the **doorbells** of I/O, the **security guards** and the **pretend houses** of containers. In an interview, people ask you to **connect the pieces**: "what happens when...?" This level is your map for doing exactly that.

## The master question: "What happens when you run a program?"
Follow the diagram's two flows, and mention each layer as you pass it:
1. **Input**: keyboard interrupt → driver → tty → the shell's blocking \`read\` returns (interrupts, blocking I/O, wake-ups).
2. **Process creation**: \`fork\` (copy-on-write) → \`execve\` (load the ELF, map segments, build the stack) → the parent \`waitpid\`s (Part 2).
3. **Scheduling**: the new task is runnable; the scheduler gives it a core; context switch (Part 2).
4. **Memory**: demand paging, page faults pulling code from the page cache, the dynamic loader mapping \`libc.so\`, the heap growing with \`brk\` (Part 4).
5. **System calls**: \`openat\`, \`getdents64\`, \`write\`: user → kernel mode and back (Part 1).
6. **File system**: path lookup, dentry cache, inodes, the page cache (Part 5).
7. **Exit**: \`exit\` → zombie → the parent reaps it → the next prompt.

Interviewers don't expect every detail; they want to see that you know the **layers** and can go **deeper** on any one of them when asked.

## The question bank by topic
| Topic | The questions you must be able to answer | Level |
|---|---|---|
| Basics | Kernel vs user mode, system calls, interrupts vs traps, monolithic vs microkernel | Part 1 |
| Processes | Process vs thread, fork/exec/wait, zombies and orphans, PCB, context switch cost | Part 2 |
| Scheduling | FCFS, SJF, RR, priority, MLFQ, CFS, starvation and aging, compute waiting times | Part 2 |
| Concurrency | Race conditions, mutex vs semaphore vs spinlock, condition variables, producer-consumer, deadlock conditions and prevention | Part 3 |
| Memory | Virtual memory, paging, TLB, page faults, page replacement (FIFO/LRU/OPT), thrashing, stack vs heap, fragmentation | Part 4 |
| Storage | Inodes, hard vs soft links, file descriptors, page cache and fsync, journaling, RAID, disk scheduling | Part 5 |
| I/O | Blocking vs non-blocking vs async, select/poll/epoll, DMA, event loops | Part 5 |
| IPC | Pipes, sockets, shared memory, signals, SIGTERM vs SIGKILL | Part 5 |
| Security & containers | Permissions, setuid, capabilities, seccomp, ASLR, VMs vs containers, namespaces and cgroups | Part 6 |
| Practice | Debugging a slow or broken Linux box | Part 6 |

Every lesson in this world ends with interview questions. Go back to them and answer **out loud** before revealing the answer.

## Numbers every engineer should know
Open the visualizer for the full chart on a log scale. The ones OS questions lean on:
| Operation | Time |
|---|---|
| L1 cache hit | ~1 ns |
| Main memory access | ~100 ns |
| System call (simple) | ~100 ns (more with Spectre mitigations) |
| Mutex lock, uncontended | ~20 ns |
| Context switch | ~1–5 µs (plus cache and TLB refill) |
| Minor page fault | ~0.1–1 µs |
| Thread creation | ~10–50 µs |
| Process fork + exit | ~50–100 µs |
| SSD random read | ~20–100 µs |
| Major page fault (SSD) | ~100 µs |
| HDD seek | ~5–10 ms |
| Default time slice | a few ms |

Use them to reason: "a context switch is a few microseconds, so 100,000 switches per second costs a large fraction of a core"; "a syscall per byte would be ruinous, so buffering exists".

## How to answer any OS question
1. **Define** it in one sentence. ("A page fault is an exception the MMU raises when a translation is missing or not permitted.")
2. **Explain why it exists**: the problem it solves.
3. **Walk the mechanism** step by step, naming the data structures (page table, PCB, inode, run queue).
4. **Trade-offs** and alternatives. ("Spinlock vs mutex depends on the critical section length and whether the holder can sleep.")
5. **Real-world anchor**: Linux names, a tool, a bug you've seen. ("That's why my container got OOMKilled with exit 137.")

## Common traps
- Saying \`malloc\` or \`printf\` are system calls (they're library functions that sometimes make syscalls).
- "Threads share everything" (they each have their own stack and registers).
- "A semaphore is a mutex" (no owner; counting).
- "Virtual memory means using the disk as RAM" (that's swapping, one use of it; isolation and mapping are the core).
- "More frames always means fewer page faults" (not with FIFO: Belady).
- "\`rm\` deletes the file" (it removes a name).
- "Containers are lightweight VMs" (they're processes sharing the host kernel).
- "\`kill -9\` first" (it skips all cleanup; send SIGTERM first).`,
    keyPoints: [
      "Answer 'what happens when you run a program' layer by layer: tty, fork/exec, scheduler, memory, syscalls, file system, exit",
      "Know the question bank: processes, scheduling, concurrency, memory, storage, I/O, IPC, security, containers, debugging",
      "Use latency numbers to reason about costs: syscalls, context switches, page faults, disk access",
      "Structure answers: definition, why it exists, mechanism, trade-offs, real-world anchor",
      "Avoid classic traps: malloc isn't a syscall, threads have private stacks, rm removes a name, containers aren't VMs",
    ],
    interview: [
      {
        q: "What happens when you type a command like ls in a terminal and press Enter?",
        freq: "very-common",
        a: `Keyboard interrupts deliver characters to the tty driver, which echoes and buffers the line; on Enter, the shell's blocking \`read\` returns. The shell parses the line, finds \`/usr/bin/ls\` via PATH, and \`fork\`s (copy-on-write). The child applies any redirections and calls \`execve\`: the kernel loads the ELF, maps its segments and the dynamic loader, builds the stack with argv/envp, and returns to user mode at the entry point. The loader maps shared libraries; page faults bring pages in from the page cache. The scheduler runs it on a CPU. ls makes system calls (\`openat\`, \`getdents64\`, \`fstat\`) through the VFS and file system, formats output, and \`write\`s to fd 1, the terminal. It exits; the parent shell, blocked in \`waitpid\`, reaps the zombie, stores \`$?\` and prints the prompt.`,
      },
      {
        q: "What is the kernel, and what is the difference between kernel mode and user mode?",
        freq: "very-common",
        a: `The kernel is the core of the OS: it manages the CPU (scheduling), memory (virtual memory), devices (drivers), files and networking, and enforces isolation and security. The CPU runs in **user mode** for applications, where privileged instructions, device access and other processes' memory are forbidden, and in **kernel mode** for the kernel, with full access. Applications cross into the kernel only through controlled entry points: system calls, exceptions (page faults) and interrupts.`,
      },
      {
        q: "Explain the difference between a process, a thread and a coroutine.",
        freq: "very-common",
        a: `A **process** has its own address space and resources and is isolated from others. A **thread** is a schedulable unit inside a process: threads share memory and files but have their own stacks and registers, and are scheduled by the kernel (preemptively, potentially in parallel). A **coroutine** (or green thread, goroutine, async task) is a user-space unit of execution scheduled cooperatively by a runtime, switching only at await/yield points; millions are cheap, and M:N runtimes map them onto kernel threads.`,
      },
      {
        q: "How would you design a thread-safe bounded queue, and what OS primitives does it use underneath?",
        freq: "common",
        a: `A ring buffer protected by a mutex, with two condition variables (not full, not empty), waiting in while loops (Part 3). Underneath on Linux: the mutex is a futex (an atomic compare-and-swap in user space, \`futex(WAIT/WAKE)\` syscalls only on contention); condition variables are also futex-based; blocked threads sleep on kernel wait queues and the scheduler wakes them, which costs a context switch. Lock-free alternatives use CAS on head and tail indexes.`,
      },
      {
        q: "Why is a context switch expensive?",
        freq: "common",
        a: `Direct costs: entering the kernel, saving and restoring registers, running the scheduler, and for a process switch, loading a new page-table root (with TLB flushes unless PCIDs are used). Indirect costs are usually bigger: the new task finds caches, the TLB and branch predictors filled with the old task's state, so it runs slowly until they warm up. Typical total: a few microseconds. Hence thread pools, event loops, and avoiding thousands of runnable threads.`,
      },
      {
        q: "How does the OS give each process the illusion of having all the memory to itself?",
        freq: "very-common",
        a: `Virtual memory: each process has its own page tables mapping its virtual pages to physical frames, walked by the MMU on every access (cached in the TLB). Pages can be anywhere in RAM, shared (libraries, copy-on-write), not yet allocated (demand paging), or swapped out; missing pages cause page faults that the kernel resolves transparently. Permissions in page table entries enforce isolation and protection.`,
      },
      {
        q: "If you had to make a single-threaded server handle 10,000 connections, what would you do?",
        freq: "common",
        a: `Use non-blocking sockets with an event loop on epoll (kqueue on BSD/macOS): register sockets once, \`epoll_wait\` for ready ones, handle each without blocking, and keep per-connection state machines (or async/await coroutines). Offload blocking or CPU-heavy work to a thread pool. Raise the file descriptor limit, tune the listen backlog, and consider multiple event loops (one per core, with \`SO_REUSEPORT\`) to use all CPUs. This is the nginx, Redis and Node.js model.`,
      },
      {
        q: "What's the difference between a mutex, a semaphore, a spinlock and a condition variable, in one breath each?",
        freq: "very-common",
        a: `**Mutex**: an owned lock for mutual exclusion; waiters sleep. **Semaphore**: an unowned counter; wait decrements or sleeps, post increments and wakes; good for pools and signalling. **Spinlock**: a lock whose waiters busy-loop; only for very short sections where sleeping is impossible or costlier. **Condition variable**: lets a thread sleep, with a mutex held, until another thread signals that a condition may have changed; always re-check in a while loop.`,
      },
    ],
    quiz: [
      {
        q: "When you run ls from bash, which system calls create and start the new program?",
        options: ["open and read", "fork and execve", "mmap and brk", "socket and connect"],
        answer: 1,
        explain: "fork clones the shell; execve replaces the child's program with ls.",
      },
      {
        q: "Which is NOT a system call?",
        options: ["read", "fork", "printf", "mmap"],
        answer: 2,
        explain: "printf is a C library function; it eventually calls write.",
      },
      {
        q: "Roughly how long does a context switch take?",
        options: ["1 ns", "A few microseconds", "10 ms", "1 second"],
        answer: 1,
        explain: "Microseconds directly, plus the hidden cost of cold caches and TLB.",
      },
      {
        q: "A process is blocked in read() on a terminal. What wakes it up?",
        options: ["The scheduler, every time slice", "The keyboard interrupt handler and tty layer when a line is ready", "A timer", "The shell"],
        answer: 1,
        explain: "The interrupt delivers input; the waiting task is moved to the ready queue.",
      },
      {
        q: "After ls exits but before bash calls waitpid, ls is:",
        options: ["Running", "A zombie", "An orphan", "Swapped out"],
        answer: 1,
        explain: "Its exit status waits in the process table until the parent reaps it.",
      },
      {
        q: "Why does running ls a second time often feel faster?",
        options: ["The CPU learned it", "Its code and the directory data are now in the page cache", "Bash compiles it", "The disk spins faster"],
        answer: 1,
        explain: "Recently used file pages stay in RAM; no disk I/O needed.",
      },
      {
        q: "Which statement about containers is true?",
        options: ["Each container has its own kernel", "Containers are processes isolated by namespaces and limited by cgroups", "Containers need hardware virtualization", "Containers can't share files"],
        answer: 1,
        explain: "They share the host kernel; VMs are the ones with their own kernel.",
      },
      {
        q: "In an interview you're asked about a topic you half-know. What's the best approach?",
        options: ["Guess confidently", "Define what you know, reason from first principles about the mechanism and trade-offs, and say what you'd check", "Change the subject", "Say nothing"],
        answer: 1,
        explain: "Interviewers value clear reasoning and honesty over memorised trivia.",
      },
    ],
  },
];
