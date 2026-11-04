import type { Lesson } from "../types";

// Operating Systems, part 5: storage, I/O and inter-process communication.

export const osPart5: Lesson[] = [
  // ------------------------------------------------------------------ FILE SYSTEMS
  {
    id: "os-filesystems",
    part: "Part 5 · Storage, I/O & IPC",
    title: "File systems: inodes, directories and journaling",
    tagline: "Files vs names, inodes and data blocks, directories, hard and symbolic links, file descriptors, the VFS, the page cache, fsync, journaling, copy-on-write file systems and mounting.",
    difficulty: "intermediate",
    minutes: 45,
    visualizers: ["inode"],
    concept: `## Explain it like I'm 10 🧸
A disk is like a huge **warehouse of numbered boxes** (blocks), all the same size. A file system is the warehouse's **filing system**:
- Each file gets an **index card** (an **inode**) that says how big the file is, who owns it, when it changed, and **which boxes** hold its contents, in order.
- A **folder** (directory) is just a special file containing a **list of names**, each with the number of an index card: "homework.txt → card 52".
- So a file's **name isn't part of the file**. It's an entry in a folder's list. Two lists can point at the **same card**: that's a **hard link**, two names for one file.
- A **shortcut** (symbolic link) is a tiny file whose content is just a **path** written down: "go look at /home/ann/homework.txt". If that file is deleted, the shortcut points at nothing.

Play with the visualizer: create a file, grow it, link it, delete names, and watch the index cards and boxes.

## Inodes: everything about a file except its name
| An inode stores | Not stored in the inode |
|---|---|
| Type (file, directory, symlink, device...), permissions, owner, group | The **name** (that lives in the directory) |
| Size, timestamps (modified, changed, accessed) | |
| **Link count**: how many names point here | |
| **Block pointers**: where the data is | |

Classic Unix inodes (ext2/ext3) have **12 direct pointers**, then a **single indirect** pointer (to a block full of pointers), a **double indirect** and a **triple indirect**. Small files are fast (direct pointers); huge files still fit. Modern ext4 uses **extents** instead: "blocks 5,000 to 5,999", one entry for a whole contiguous run.

\`ls -i\` shows inode numbers, \`stat file\` shows everything in the inode, and \`df -i\` shows how many inodes are left. A disk can run out of inodes before it runs out of space, if it holds millions of tiny files.

## Directories and path lookup
A directory is a file of **(name, inode number)** entries. To open \`/home/ann/notes.txt\` the kernel:
1. Starts at the **root** inode (always a known number, 2 on ext4).
2. Reads the root directory's blocks and finds \`home\` → its inode.
3. Reads \`home\`'s blocks, finds \`ann\`, and so on, checking **execute (search) permission** on every directory along the way.
4. Ends at the inode of \`notes.txt\`.

That's several disk reads, so the kernel caches results in the **dentry cache** (directory entry cache). Our toy file system in Python does exactly these lookups.

## Hard links vs symbolic links
| | Hard link (\`ln a b\`) | Symbolic link (\`ln -s a b\`) |
|---|---|---|
| What it is | Another directory entry for the **same inode** | A separate small file containing a **path** |
| Survives deleting the original name? | **Yes**: the data stays while any name remains | **No**: it dangles |
| Across file systems? | No (inode numbers are per file system) | Yes |
| To directories? | No (it could create loops) | Yes |

\`rm\` really calls \`unlink()\`: it removes a **name** and decrements the link count. The data is freed only when the link count is **0** *and* no process still has the file open. That's why deleting a huge log file that a process still writes to doesn't free any space until the process closes it (\`lsof | grep deleted\` finds them).

## File descriptors: three layers
When a process calls \`open()\`, three kernel objects are involved:
1. The process's **file descriptor table**: small integers (0, 1, 2 are stdin, stdout, stderr; new ones get the **lowest free number**).
2. The system-wide **open file table**: each entry is an *open file description* holding the **current offset** and the flags (read/write, append, non-blocking).
3. The **inode** (in the inode cache).

Two separate \`open()\`s of the same file get **separate offsets**. \`dup()\` and \`fork()\` make two descriptors share **one** open file description, so they **share the offset**. That's how a shell's \`> file 2>&1\` works, and why a parent and child writing to the same log file don't overwrite each other.

## The VFS: one API, many file systems
The kernel's **virtual file system** layer gives every file system the same interface (\`open\`, \`read\`, \`write\`, \`stat\`...). Behind it: ext4, XFS, Btrfs, ZFS, NFS (over the network), FAT on a USB stick, and **pseudo file systems** like \`/proc\` (process info generated on the fly), \`/sys\` (devices), \`tmpfs\` (files in RAM) and \`overlayfs\` (the layered root file system of every Docker container). "Everything is a file" works because of the VFS.

**Mounting** attaches a file system to a directory: \`mount /dev/sdb1 /mnt/usb\` makes the USB stick's root appear at \`/mnt/usb\`. \`findmnt\` shows the mount tree.

## The page cache, and when data is really on disk
Reads and writes normally go through the **page cache**, file data cached in RAM:
- \`write()\` copies your bytes into the cache and returns **immediately**. The pages are marked **dirty** and written to disk later (Linux flushes after about 30 seconds, or under memory pressure).
- \`read()\` of recently used data comes straight from RAM. That's why the second \`grep\` over a big directory is so much faster. \`free -h\` shows the cache as "buff/cache".
- If the power fails before the flush, those writes are **lost**. Databases call **\`fsync()\`** to force a file's data to stable storage before saying "committed". It's slow (milliseconds) because it waits for the device.
- \`O_DIRECT\` bypasses the page cache entirely (databases with their own caches use it).

## Crash consistency and journaling
Creating a file changes several blocks: the inode bitmap, the inode, the directory, the block bitmap and the data. If the machine crashes halfway, the file system can be left **inconsistent**: a block marked used that nobody owns, or a directory pointing to garbage. Old systems ran a slow \`fsck\` scan of the whole disk after every crash.

**Journaling** (ext4, XFS, NTFS) borrows the database trick of a **write-ahead log**:
1. Write a description of all the changes to a **journal** area.
2. Write a **commit** record.
3. Apply the changes to their real locations (**checkpoint**).
4. After a crash, **replay** committed transactions from the journal and ignore uncommitted ones. Recovery takes seconds.

ext4's default \`data=ordered\` mode journals only **metadata**, but writes file data before committing the metadata that points to it.

**Copy-on-write file systems** (ZFS, Btrfs, APFS) never overwrite in place: they write new blocks and then atomically switch a pointer at the top. The bonus is cheap **snapshots** (keep the old pointer) and **checksums** on every block to detect silent corruption.

## Commands to explore
\`\`\`bash
stat notes.txt           # the inode: size, blocks, links, times
ls -li                   # inode numbers and link counts
ln notes.txt backup      # a hard link: same inode
ln -s notes.txt link     # a symlink: new inode containing a path
df -h; df -i             # free space and free inodes per file system
du -sh dir               # space actually used
lsof -p PID              # a process's open files
ls -l /proc/PID/fd       # its file descriptor table
\`\`\``,
    keyPoints: [
      "An inode holds a file's metadata and block pointers, but not its name",
      "A directory is a file of (name, inode number) entries; path lookup walks them from the root",
      "Hard links are extra names for one inode; symlinks are small files containing a path",
      "Data is freed when the link count is 0 and no process has the file open",
      "fd table → open file description (offset, flags) → inode; dup and fork share the offset",
      "Writes land in the page cache and reach disk later; fsync forces them out",
      "Journaling replays a write-ahead log after a crash; copy-on-write file systems add snapshots and checksums",
    ],
    code: [
      {
        title: "Hard links, symlinks and what rm really does",
        linux: true,
        variants: [{ lang: "c", code: `// Inodes, hard links and symbolic links: a file's NAME is not the file.
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static ino_t seen[4];                     // inode numbers are big and vary, so name them A, B, ...

static char letter(ino_t ino) {
    int i = 0;
    while (seen[i] && seen[i] != ino) i++;
    seen[i] = ino;
    return (char)('A' + i);
}

static void show(const char *path) {
    struct stat st;
    if (lstat(path, &st) != 0) {
        printf("  %-9s does not exist\\n", path);
        return;
    }
    printf("  %-9s inode %c  links=%lu  %s, %ld bytes\\n", path, letter(st.st_ino),
           (unsigned long)st.st_nlink, S_ISLNK(st.st_mode) ? "symlink" : "regular file", (long)st.st_size);
}

int main(void) {
    chdir("/tmp");
    unlink("diary.txt"); unlink("backup"); unlink("shortcut");
    int fd = open("diary.txt", O_CREAT | O_WRONLY | O_TRUNC, 0644);
    write(fd, "Dear diary\\n", 11);
    close(fd);
    struct stat a, b, c;

    link("diary.txt", "backup");          // a second NAME for the same inode
    symlink("diary.txt", "shortcut");     // a tiny file that contains the PATH "diary.txt"
    printf("after ln and ln -s:\\n");
    show("diary.txt"); show("backup"); show("shortcut");
    stat("diary.txt", &a); stat("backup", &b); lstat("shortcut", &c);
    printf("diary.txt and backup are the same inode: %s\\n", a.st_ino == b.st_ino ? "yes" : "no");
    printf("shortcut is a different inode: %s\\n", a.st_ino != c.st_ino ? "yes" : "no");

    unlink("diary.txt");                  // rm only removes a NAME
    printf("after rm diary.txt:\\n");
    show("diary.txt"); show("backup"); show("shortcut");
    char buf[64] = {0};
    fd = open("backup", O_RDONLY);
    read(fd, buf, sizeof buf - 1);
    close(fd);
    printf("backup still holds the data: %s", buf);
    printf("following the symlink works: %s\\n", open("shortcut", O_RDONLY) >= 0 ? "yes" : "no: it dangles");
    unlink("backup"); unlink("shortcut");
    return 0;
}` }],
        explain: `- \`link("diary.txt", "backup")\` adds a second **name** for the same inode, so both show the same inode and a link count of 2. (Inode numbers vary, so the program names them A and B.)
- \`symlink\` creates a **new** inode of type symlink whose 9 bytes of content are the path \`diary.txt\`. \`lstat\` looks at the link itself, \`stat\` would follow it.
- \`unlink("diary.txt")\` (what \`rm\` calls) removes one name. The inode survives with 1 link, and \`backup\` still reads "Dear diary".
- The symlink still exists, but the path inside it leads nowhere: \`open\` fails. It **dangles**.`,
        output: `after ln and ln -s:
  diary.txt inode A  links=2  regular file, 11 bytes
  backup    inode A  links=2  regular file, 11 bytes
  shortcut  inode B  links=1  symlink, 9 bytes
diary.txt and backup are the same inode: yes
shortcut is a different inode: yes
after rm diary.txt:
  diary.txt does not exist
  backup    inode A  links=1  regular file, 11 bytes
  shortcut  inode B  links=1  symlink, 9 bytes
backup still holds the data: Dear diary
following the symlink works: no: it dangles`,
      },
      {
        title: "File descriptors and shared offsets",
        linux: true,
        variants: [{ lang: "c", code: `// File descriptors, open file descriptions and offsets: open twice vs dup vs fork.
#include <fcntl.h>
#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

static long where(int fd) { return (long)lseek(fd, 0, SEEK_CUR); }

int main(void) {
    int w = open("/tmp/abc.txt", O_CREAT | O_WRONLY | O_TRUNC, 0644);
    write(w, "abcdefghij", 10);
    close(w);

    int a = open("/tmp/abc.txt", O_RDONLY);
    int b = open("/tmp/abc.txt", O_RDONLY);          // a second, independent open
    int c = dup(a);                                   // a second NUMBER for the same open file
    char ch;
    read(a, &ch, 1); read(a, &ch, 1); read(a, &ch, 1);
    printf("fds a=%d b=%d c=%d (the lowest free numbers, after 0, 1 and 2)\\n", a, b, c);
    printf("after 3 reads on a: offset of a=%ld, b=%ld, c=%ld\\n", where(a), where(b), where(c));

    fflush(stdout);                                   // empty the buffer BEFORE fork, or the child gets a copy
    if (fork() == 0) {                                // the child inherits a (and its offset)
        read(a, &ch, 1);
        printf("child read '%c' through a\\n", ch);
        fflush(stdout);                               // _exit() skips stdio's buffers
        _exit(0);
    }
    wait(NULL);
    printf("after the child read once: offset of a=%ld (shared with the child)\\n", where(a));
    read(b, &ch, 1);
    printf("b reads from its own offset: '%c'\\n", ch);
    unlink("/tmp/abc.txt");
    return 0;
}` }],
        explain: `- The new descriptors are 3, 4 and 5: \`open\` always returns the **lowest free number**, and 0, 1 and 2 are taken by stdin, stdout and stderr. (That's how a shell redirects: close 1, then open a file, and it becomes 1.)
- \`a\` and \`b\` are two separate \`open\`s: separate offsets. \`c = dup(a)\` shares \`a\`'s offset, so it's at 3 too.
- The forked child reads through its copy of \`a\` and gets \`d\`, and the parent's offset moves to 4: after \`fork\`, they share the open file description.
- \`b\` was never touched, so it reads \`a\`, from offset 0.
- The \`fflush(stdout)\` calls matter: \`_exit\` skips stdio's buffers, and without flushing before \`fork\` the child would inherit (and print) a copy of the parent's unflushed output.`,
        output: `fds a=3 b=4 c=5 (the lowest free numbers, after 0, 1 and 2)
after 3 reads on a: offset of a=3, b=0, c=3
child read 'd' through a
after the child read once: offset of a=4 (shared with the child)
b reads from its own offset: 'a'`,
      },
      {
        title: "A sparse file: 1 GiB that takes no space",
        linux: true,
        variants: [{ lang: "c", code: `// A 1 GiB file that uses almost no disk: the file system only stores blocks that were written.
#include <fcntl.h>
#include <stdio.h>
#include <sys/stat.h>
#include <unistd.h>

int main(void) {
    int fd = open("/tmp/sparse.img", O_CREAT | O_RDWR | O_TRUNC, 0644);
    lseek(fd, (1L << 30) - 5, SEEK_SET);          // jump almost 1 GiB forward...
    write(fd, "end!\\n", 5);                       // ...and write 5 bytes there
    struct stat st;
    fstat(fd, &st);
    printf("apparent size: %ld MiB (what ls -l shows)\\n", (long)(st.st_size >> 20));
    printf("really stored: under 1 MiB (what du shows): %s\\n", st.st_blocks * 512L < (1L << 20) ? "yes" : "no");
    char c = 'x';
    pread(fd, &c, 1, 12345);                      // read from the hole
    printf("reading the hole gives zero bytes: %s\\n", c == 0 ? "yes" : "no");
    close(fd);
    unlink("/tmp/sparse.img");
    return 0;
}` }],
        explain: `- \`lseek\` jumps almost 1 GiB past the end, and \`write\` puts 5 bytes there. The file's **size** is now 1 GiB.
- But the file system allocates blocks only for what was written. \`st_blocks\` (512-byte units) shows the real usage: a few KiB. \`ls -l\` and \`du\` disagree for exactly this reason.
- Reading the **hole** returns zeros without touching the disk. VM disk images and database files use sparse files to grow lazily.`,
        output: `apparent size: 1024 MiB (what ls -l shows)
really stored: under 1 MiB (what du shows): yes
reading the hole gives zero bytes: yes`,
      },
      {
        title: "A toy file system (Python)",
        variants: [{ lang: "python", code: `# A toy file system: inodes, data blocks, a block bitmap and directories that map names to inodes.
BLOCK = 32                     # bytes per block (tiny, so files span several blocks)
disk = [b""] * 32              # the "disk": 32 blocks
used = [False] * 32            # the block bitmap
inodes = {}                    # inode number -> {"type", "size", "blocks", "links"}


def alloc_block():
    b = used.index(False)
    used[b] = True
    return b


def new_inode(kind):
    ino = len(inodes)
    inodes[ino] = {"type": kind, "size": 0, "blocks": [], "links": 0}
    return ino


def write_file(ino, data):
    node = inodes[ino]
    for b in node["blocks"]:
        used[b] = False
    node["blocks"] = []
    for i in range(0, len(data), BLOCK):
        b = alloc_block()
        disk[b] = data[i:i + BLOCK]
        node["blocks"].append(b)
    node["size"] = len(data)


def read_file(ino):
    return b"".join(disk[b] for b in inodes[ino]["blocks"])[: inodes[ino]["size"]]


def entries(dir_ino):           # a directory is a file of "name=inode" lines
    text = read_file(dir_ino).decode()
    return dict(line.split("=") for line in text.splitlines()) if text else {}


def add_entry(dir_ino, name, ino):
    e = entries(dir_ino)
    e[name] = str(ino)
    write_file(dir_ino, "".join(f"{k}={v}\\n" for k, v in e.items()).encode())
    inodes[ino]["links"] += 1


def lookup(path):
    ino = 0                                  # inode 0 is the root directory "/"
    trail = ["/ -> inode 0"]
    for part in path.strip("/").split("/"):
        ino = int(entries(ino)[part])        # read the directory's blocks, find the name
        trail.append(f"{part} -> inode {ino}")
    print(f"lookup {path}: " + ", ".join(trail))
    return ino


root = new_inode("dir")
inodes[root]["links"] = 1
docs = new_inode("dir")
add_entry(root, "docs", docs)
notes = new_inode("file")
add_entry(docs, "notes.txt", notes)
write_file(notes, b"Operating systems are just programs that manage other programs!")
hello = new_inode("file")
add_entry(root, "hello.txt", hello)
write_file(hello, b"hi\\n")
print("root directory's data:", " ".join(read_file(root).decode().split()))

ino = lookup("/docs/notes.txt")
node = inodes[ino]
print(f"inode {ino}: {node['type']}, {node['size']} bytes in blocks {node['blocks']}, {node['links']} link(s)")
print("contents:", read_file(ino).decode())
add_entry(root, "same-notes.txt", ino)       # a hard link: a second name, same inode
print(f"after a hard link, inode {ino} has {inodes[ino]['links']} links")
print("blocks in use:", "".join("#" if u else "." for u in used))` }],
        explain: `- The "disk" is 32 blocks of 32 bytes, with a **bitmap** saying which blocks are used. Inodes record type, size, the list of block numbers and the link count.
- A **directory is just a file** whose data is lines of \`name=inode\`. The root's data really is \`docs=1 hello.txt=3\`.
- \`lookup\` starts at inode 0 (the root) and reads one directory per path component, exactly what the kernel does (with a dentry cache to skip the disk).
- \`notes.txt\` is 63 bytes, so it needs 2 blocks. A hard link only adds a directory entry and bumps the inode's link count; no data is copied.`,
        output: `root directory's data: docs=1 hello.txt=3
lookup /docs/notes.txt: / -> inode 0, docs -> inode 1, notes.txt -> inode 2
inode 2: file, 63 bytes in blocks [2, 3], 1 link(s)
contents: Operating systems are just programs that manage other programs!
after a hard link, inode 2 has 2 links
blocks in use: ######..........................`,
      },
    ],
    interview: [
      {
        q: "What is an inode? What does it contain?",
        freq: "very-common",
        a: `The on-disk data structure describing a file: its type, permissions, owner and group, size, timestamps, link count, and pointers to its data blocks (direct and indirect pointers, or extents). It does **not** contain the file's name: names live in directory entries that map names to inode numbers. Every file and directory has exactly one inode; a file system has a fixed (or dynamically grown) number of them.`,
      },
      {
        q: "What's the difference between a hard link and a symbolic link?",
        freq: "very-common",
        a: `A **hard link** is another directory entry pointing to the same inode: all names are equal, the data persists until the last name is removed (and no process has it open), it can't cross file systems or point to directories. A **symbolic link** is a separate inode whose content is a path; it can point anywhere (other file systems, directories, non-existent paths), but breaks (dangles) if the target is removed or moved.`,
      },
      {
        q: "What happens, step by step, when you call open(\"/home/ann/notes.txt\", O_RDONLY)?",
        freq: "common",
        a: `A system call traps into the kernel. The VFS resolves the path component by component from the root (or the current directory), using the dentry cache and reading directory blocks on misses, and checks search permission on each directory and read permission on the file. It allocates an open file description (offset 0, flags) pointing to the in-memory inode, puts a pointer to it in the lowest free slot of the process's fd table, and returns that number. Subsequent \`read\`s go through the page cache.`,
      },
      {
        q: "You deleted a 50 GB log file but df shows no space was freed. Why?",
        freq: "common",
        a: `\`rm\` only removed the name. A process (the one writing the log) still has the file open, so the inode and its blocks aren't freed until the last descriptor is closed. Find it with \`lsof | grep deleted\` (or \`ls -l /proc/*/fd\`), then restart the process or truncate the file through \`/proc/PID/fd/N\`. Prevention: use log rotation that signals the process to reopen its log (\`copytruncate\` or a reopen signal).`,
      },
      {
        q: "What does fsync do and why do databases need it?",
        freq: "common",
        a: `\`write\` only copies data into the page cache; it reaches the disk later. \`fsync(fd)\` blocks until the file's data and metadata are on stable storage (including flushing the drive's volatile cache). A database must fsync its write-ahead log before acknowledging a commit; otherwise a power loss could lose "committed" transactions. Directory changes (creating or renaming a file) need an fsync of the directory too. \`fdatasync\` skips non-essential metadata, and group commit batches many transactions per fsync to amortise the cost.`,
      },
      {
        q: "How does journaling make a file system crash-safe?",
        freq: "common",
        a: `Before modifying metadata in place, the file system writes the intended changes as a transaction to a journal (write-ahead log), then a commit record. Only then does it write the changes to their final locations. After a crash, it replays committed transactions and discards incomplete ones, so metadata is always consistent without a full fsck. ext4 journals metadata by default (\`data=ordered\` writes data blocks before committing the metadata that references them); \`data=journal\` also journals data at a throughput cost. Copy-on-write file systems avoid in-place updates entirely.`,
      },
      {
        q: "After fork, the parent and child both write to the same open log file. Do they overwrite each other?",
        freq: "occasional",
        a: `No, as long as the file was opened before the fork: both descriptors refer to the same open file description and share one offset, so writes go one after another. With \`O_APPEND\`, every write atomically seeks to the end first, which also protects separate opens and other processes. Interleaving of lines can still happen if each write isn't a single \`write\` call (stdio buffering).`,
      },
    ],
    quiz: [
      {
        q: "Where is a file's name stored?",
        options: ["In its inode", "In a directory entry", "In the superblock", "In the first data block"],
        answer: 1,
        explain: "Directories map names to inode numbers; the inode itself has no name.",
      },
      {
        q: "A file has 2 hard links. You rm one of them. What happens to the data?",
        options: ["It's deleted", "It stays; the link count drops to 1", "It becomes a symlink", "It moves to the trash"],
        answer: 1,
        explain: "Data is freed only when the link count reaches 0 (and nobody has it open).",
      },
      {
        q: "What happens to a symlink when its target is deleted?",
        options: ["It's deleted too", "It points to nothing (dangles)", "It becomes a hard link", "It keeps a copy of the data"],
        answer: 1,
        explain: "A symlink only stores a path; the path no longer resolves.",
      },
      {
        q: "Your program closes fd 1 and then opens a file. Which fd does open return?",
        options: ["3", "1", "0", "A random number"],
        answer: 1,
        explain: "open returns the lowest free descriptor, which is how shells redirect stdout.",
      },
      {
        q: "After `int c = dup(a)`, reading through a moves the offset of c?",
        options: ["Yes, they share one open file description", "No, they're independent", "Only after fork", "Only for pipes"],
        answer: 0,
        explain: "dup and fork share the open file description, including its offset.",
      },
      {
        q: "write() returned successfully, then the power failed. Is the data on disk?",
        options: ["Always", "Not necessarily: it may still be dirty in the page cache", "Never", "Only on SSDs"],
        answer: 1,
        explain: "Use fsync to force data to stable storage before relying on it.",
      },
      {
        q: "What does a journaling file system replay after a crash?",
        options: ["Every write since boot", "Committed transactions from its log", "The whole disk", "Nothing"],
        answer: 1,
        explain: "Committed transactions are reapplied; incomplete ones are discarded.",
      },
      {
        q: "ls -l says a file is 1 GiB but du says 8 KiB. Why?",
        options: ["du is broken", "It's a sparse file with a hole", "It's compressed in RAM", "It's a symlink"],
        answer: 1,
        explain: "Only written blocks are allocated; holes read as zeros.",
      },
    ],
  },

  // ------------------------------------------------------------------ DISKS
  {
    id: "os-disks",
    title: "Disks, SSDs, scheduling and RAID",
    tagline: "How hard drives and SSDs work, seek and rotational latency, disk-arm scheduling (FCFS, SSTF, SCAN, LOOK), flash translation layers, NVMe queues, Linux I/O schedulers and RAID levels.",
    difficulty: "intermediate",
    minutes: 35,
    visualizers: ["diskarm"],
    complexity: [
      { op: "HDD random 4 KiB read", time: "~5–10 ms", note: "Seek + half a rotation; ~100–200 IOPS" },
      { op: "HDD sequential", time: "~150–250 MB/s", note: "No seeking: the head just reads as the platter spins" },
      { op: "SATA SSD random read", time: "~100 µs", note: "~50–100k IOPS, limited by the SATA interface" },
      { op: "NVMe SSD random read", time: "~10–100 µs", note: "Hundreds of thousands to millions of IOPS with deep queues" },
    ],
    concept: `## Explain it like I'm 10 🧸
A **hard drive** is a **record player** with a spinning shiny disc and a tiny arm that reads it. To read something, the arm must **swing** to the right ring (that's slow), then **wait** for the right spot to spin underneath (also slow). If ten people ask for things all over the disc, the order you serve them in matters a lot: zig-zagging back and forth wastes time, like a lift going up and down for every single button press.

An **SSD** has no moving parts: it's a big grid of **memory chips**. Every spot is equally fast to reach, so the order matters much less. But SSDs have a quirk: they can't overwrite a spot directly. They must erase a whole **block** first, like a whiteboard where you can only wipe the entire board.

## Hard disk drives (HDD)
A drive has **platters** spinning at 5,400–15,000 RPM, each surface with a **head** on an **arm**. Data sits in concentric **tracks**, divided into **sectors** (512 B or 4 KiB). The same track on every surface forms a **cylinder**.

Time to read one random sector:
| Part | Typical | Why |
|---|---|---|
| **Seek** | 4–10 ms | Move the arm to the right track |
| **Rotational latency** | ~4 ms at 7,200 RPM | Wait half a rotation on average (one rotation = 8.3 ms) |
| **Transfer** | microseconds | Read the bits as they pass |

So a hard disk manages only about **100–200 random reads per second**, but **sequential** reads are fast (200 MB/s), because there's no seeking. That's why databases, logs and file systems work so hard to make I/O **sequential**: append-only logs, LSM trees, large contiguous extents.

## Disk-arm scheduling
When many requests are waiting, the OS (or the drive) can reorder them to reduce seeking. The classic exam setup: head at cylinder **53**, queue **98, 183, 37, 122, 14, 124, 65, 67**, cylinders 0–199.
| Algorithm | Idea | Total head movement |
|---|---|---|
| **FCFS** | In arrival order | 640 |
| **SSTF** | Closest request next (shortest seek time first) | 236, but far-away requests can **starve** |
| **SCAN** (elevator) | Sweep to one end serving requests, then reverse | 331 (going up first) |
| **C-SCAN** | Sweep up, jump back to 0, sweep up again: more uniform waits | 382 (counting the return) |
| **LOOK** | SCAN, but reverse at the last request instead of the edge | 299 |
| **C-LOOK** | C-SCAN, but jump from the last request to the lowest one | 322 |

Step through each in the visualizer. In the real world, the drive itself reorders requests (**NCQ**, native command queueing), because only the drive knows the true geometry.

## SSDs and flash
Flash memory is read and written in **pages** (4–16 KiB) but erased only in **erase blocks** (hundreds of pages, MiBs). A page can't be overwritten until its whole block is erased. Each cell survives only a limited number of erase cycles (thousands for TLC and QLC flash). So the SSD's controller runs a **flash translation layer** (FTL), a little operating system of its own:
- **Out-of-place writes**: a "rewrite" goes to a fresh page, and the FTL updates its map from logical to physical pages (like virtual memory!). The old page is marked stale.
- **Garbage collection**: copy the live pages out of a mostly-stale block, then erase it. That copying causes **write amplification**: the flash writes more than you asked.
- **Wear levelling**: spread erases across all blocks so none wears out early.
- **TRIM** (\`fstrim\`, the \`discard\` mount option): the OS tells the SSD which pages are free after files are deleted, so garbage collection doesn't copy dead data.
- **Over-provisioning**: hidden spare capacity gives GC room to work.

**NVMe** connects SSDs directly over PCIe with up to 64K **queues** of 64K commands each, ideally one queue per CPU core, so cores submit I/O without sharing a lock. That's how a single drive delivers a million IOPS.

## Linux I/O schedulers
The block layer (\`blk-mq\`) can reorder and merge requests before they reach the device. \`cat /sys/block/nvme0n1/queue/scheduler\` shows the choice:
- **none**: send requests straight through. The default for fast NVMe drives, where reordering costs more than it saves.
- **mq-deadline**: sorts requests but gives each a deadline, so none starve. Good for HDDs and SATA SSDs.
- **bfq**: fair sharing between processes, good for desktops (your music doesn't stutter during a big copy).
- **kyber**: latency targets for fast devices.

Merging adjacent requests into one big request is often the biggest win of all.

## RAID: many disks acting as one
| Level | How | Usable (4 × 2 TB) | Survives | Good for |
|---|---|---|---|---|
| **RAID 0** | Stripe blocks across disks | 8 TB | Nothing: any failure loses everything | Speed, scratch data |
| **RAID 1** | Mirror: every block on two disks | 4 TB | One disk per mirror | Simple redundancy, fast reads |
| **RAID 5** | Stripe + one **parity** block per stripe (rotating) | 6 TB | Any 1 disk | Capacity with redundancy; slow small writes |
| **RAID 6** | Two parity blocks | 4 TB | Any 2 disks | Big arrays where rebuilds take days |
| **RAID 10** | Stripe across mirrored pairs | 4 TB | One per pair | Databases: fast and redundant |

**Parity is XOR**: \`P = D1 ⊕ D2 ⊕ D3\`. Lose any one block and XOR the rest to get it back; our sample rebuilds "ATIN" from the other blocks. RAID 5's weakness: a small write must read old data and parity, then write new data and parity (**4 I/Os**, the "write penalty"). During a rebuild of a big disk, a second failure loses everything, which is why large arrays use RAID 6.

**RAID is not a backup.** It protects against a disk dying, not against \`rm -rf\`, ransomware or a fire.`,
    keyPoints: [
      "HDD access = seek + rotational latency + transfer; random I/O is ~100× slower than sequential",
      "Disk-arm scheduling: FCFS, SSTF (fast but starves), SCAN/C-SCAN (elevator), LOOK/C-LOOK",
      "Flash can't overwrite in place: the FTL remaps writes, garbage-collects blocks and levels wear",
      "TRIM tells the SSD which pages are free; write amplification shortens SSD life",
      "NVMe uses many deep queues over PCIe; Linux uses 'none' for NVMe and mq-deadline or bfq for slower devices",
      "RAID 0 stripes, 1 mirrors, 5/6 add XOR parity, 10 stripes mirrors; RAID is not a backup",
    ],
    code: [
      {
        title: "Disk-arm scheduling algorithms (Python)",
        variants: [{ lang: "python", code: `# Disk-arm scheduling: total head movement for FCFS, SSTF, SCAN, C-SCAN, LOOK and C-LOOK.
QUEUE = [98, 183, 37, 122, 14, 124, 65, 67]
HEAD, MAX = 53, 199                         # cylinders 0..199; elevators sweep UP first


def fcfs(q, h):
    return list(q)


def sstf(q, h):                             # always the closest request next
    left, order = list(q), []
    while left:
        nxt = min(left, key=lambda c: abs(c - h))
        order.append(nxt)
        left.remove(nxt)
        h = nxt
    return order


def scan(q, h):                             # elevator: go up to the end, then come back down
    return sorted(c for c in q if c >= h) + [MAX] + sorted((c for c in q if c < h), reverse=True)


def c_scan(q, h):                           # go up to the end, jump to 0, go up again
    return sorted(c for c in q if c >= h) + [MAX, 0] + sorted(c for c in q if c < h)


def look(q, h):                             # like SCAN, but turn at the last request
    return sorted(c for c in q if c >= h) + sorted((c for c in q if c < h), reverse=True)


def c_look(q, h):                           # like C-SCAN, but jump from the last request to the lowest
    return sorted(c for c in q if c >= h) + sorted(c for c in q if c < h)


print(f"head at {HEAD}, requests {QUEUE}")
for name, algo in [("FCFS", fcfs), ("SSTF", sstf), ("SCAN", scan), ("C-SCAN", c_scan), ("LOOK", look), ("C-LOOK", c_look)]:
    path = [HEAD] + algo(QUEUE, HEAD)
    moved = sum(abs(b - a) for a, b in zip(path, path[1:]))
    print(f"{name:7} {moved:4} cylinders   {' -> '.join(map(str, path))}")` }],
        explain: `- Each function returns the **order** in which the head visits cylinders; the total movement is the sum of the jumps.
- **FCFS** zig-zags across the disk: 640 cylinders. **SSTF** greedily picks the nearest request: 236, the shortest here, but under constant load a far-away request might wait forever.
- **SCAN** and **LOOK** behave like a lift: up through every request, then back down. **C-SCAN** and **C-LOOK** only serve on the way up, then jump back, so requests at both ends wait about equally long.
- The SCAN family here sweeps **upward** first. Textbooks sometimes start downward (SCAN toward 0 gives 236), so always check the direction in an exam question.`,
        output: `head at 53, requests [98, 183, 37, 122, 14, 124, 65, 67]
FCFS     640 cylinders   53 -> 98 -> 183 -> 37 -> 122 -> 14 -> 124 -> 65 -> 67
SSTF     236 cylinders   53 -> 65 -> 67 -> 37 -> 14 -> 98 -> 122 -> 124 -> 183
SCAN     331 cylinders   53 -> 65 -> 67 -> 98 -> 122 -> 124 -> 183 -> 199 -> 37 -> 14
C-SCAN   382 cylinders   53 -> 65 -> 67 -> 98 -> 122 -> 124 -> 183 -> 199 -> 0 -> 14 -> 37
LOOK     299 cylinders   53 -> 65 -> 67 -> 98 -> 122 -> 124 -> 183 -> 37 -> 14
C-LOOK   322 cylinders   53 -> 65 -> 67 -> 98 -> 122 -> 124 -> 183 -> 14 -> 37`,
      },
      {
        title: "RAID levels and XOR parity (Python)",
        variants: [{ lang: "python", code: `# RAID: what 4 disks of 2 TB give you, and how RAID 5 rebuilds a dead disk with XOR parity.
from functools import reduce

DISKS, SIZE = 4, 2
for level, usable, survives in [
    ("RAID 0 (striping)", DISKS * SIZE, "0 failures"),
    ("RAID 1 (mirror, 2+2)", DISKS * SIZE // 2, "1 per mirror pair"),
    ("RAID 5 (1 parity)", (DISKS - 1) * SIZE, "any 1 disk"),
    ("RAID 6 (2 parity)", (DISKS - 2) * SIZE, "any 2 disks"),
    ("RAID 10 (mirrored stripes)", DISKS * SIZE // 2, "1 per mirror pair"),
]:
    print(f"{level:27} usable {usable} TB, survives {survives}")

data = [b"OPER", b"ATIN", b"G-SY"]                     # one stripe across three data disks
xor = lambda a, b: bytes(x ^ y for x, y in zip(a, b))
parity = reduce(xor, data)                             # the fourth disk stores the XOR
print("stripe:", [d.decode() for d in data], "parity:", parity.hex())
lost = 1
survivors = [d for i, d in enumerate(data) if i != lost] + [parity]
rebuilt = reduce(xor, survivors)                       # XOR of everything else = the missing block
print(f"disk {lost} dies; XOR of the others rebuilds {rebuilt.decode()!r}: {rebuilt == data[lost]}")` }],
        explain: `- The table is the classic capacity versus safety trade-off for four 2 TB disks.
- A RAID 5 stripe stores three data blocks and their **XOR** as parity. XOR has a magic property: \`a ⊕ b ⊕ b = a\`. So XOR-ing the surviving blocks with the parity gives back the missing one.
- Real arrays rotate which disk holds the parity in each stripe, so parity writes don't all hammer one disk (that fixed-parity layout is RAID 4).`,
        output: `RAID 0 (striping)           usable 8 TB, survives 0 failures
RAID 1 (mirror, 2+2)        usable 4 TB, survives 1 per mirror pair
RAID 5 (1 parity)           usable 6 TB, survives any 1 disk
RAID 6 (2 parity)           usable 4 TB, survives any 2 disks
RAID 10 (mirrored stripes)  usable 4 TB, survives 1 per mirror pair
stripe: ['OPER', 'ATIN', 'G-SY'] parity: 49295f45
disk 1 dies; XOR of the others rebuilds 'ATIN': True`,
      },
    ],
    interview: [
      {
        q: "Why is random I/O so much slower than sequential I/O on a hard disk?",
        freq: "very-common",
        a: `Each random access pays a **seek** (moving the arm, several ms) plus **rotational latency** (waiting for the sector to spin under the head, ~4 ms at 7,200 RPM), so only ~100–200 random operations per second are possible. Sequential access pays those once and then streams data at full speed (~200 MB/s). Systems therefore favour sequential patterns: write-ahead logs, LSM trees, large extents, read-ahead and request merging.`,
      },
      {
        q: "Compare the disk scheduling algorithms SSTF, SCAN and C-SCAN.",
        freq: "common",
        a: `**SSTF** picks the closest pending request: low total seek, but requests far from the head can starve. **SCAN** (elevator) sweeps in one direction serving requests to the end, then reverses: no starvation, but requests just behind the head wait a full round trip, and middle cylinders get better service. **C-SCAN** serves only in one direction and jumps back, giving more uniform waiting times. **LOOK/C-LOOK** turn at the last request instead of the disk edge. Modern drives reorder internally (NCQ), and SSDs don't need seek-based scheduling.`,
      },
      {
        q: "How does an SSD handle writes, and what is write amplification?",
        freq: "common",
        a: `Flash pages can't be overwritten; blocks of many pages must be erased first, and each block survives a limited number of erases. The FTL writes updates to fresh pages, remaps logical addresses, and marks old pages stale. Garbage collection later copies live pages out of a block so it can be erased. Those extra copies mean the device physically writes more than the host requested: **write amplification**, which costs performance and endurance. TRIM, over-provisioning and sequential write patterns reduce it.`,
      },
      {
        q: "Explain RAID 0, 1, 5 and 10. Which would you choose for a database?",
        freq: "common",
        a: `RAID 0 stripes for speed with no redundancy. RAID 1 mirrors for redundancy at 50% capacity. RAID 5 stripes with one distributed parity block per stripe: survives one failure with (n−1)/n capacity, but small writes cost 4 I/Os and rebuilds are slow and risky on large disks. RAID 10 stripes across mirrored pairs: fast reads and writes, quick rebuilds, 50% capacity. For a write-heavy database, RAID 10 is the usual choice. Either way, RAID isn't a backup.`,
      },
      {
        q: "Which Linux I/O scheduler would you use for an NVMe drive, and why?",
        freq: "occasional",
        a: `Usually **none**: NVMe devices have no seek penalty, many hardware queues and very low latency, so reordering in software adds CPU cost and latency without benefit. **mq-deadline** fits HDDs and SATA SSDs (sorting plus starvation protection), **bfq** fits interactive desktops (per-process fairness), **kyber** suits fast devices when you want latency targets. Check and set it in \`/sys/block/DEV/queue/scheduler\`.`,
      },
    ],
    quiz: [
      {
        q: "What usually dominates the time of a random read on a hard disk?",
        options: ["Data transfer", "Seek time and rotational latency", "The CPU", "The page cache"],
        answer: 1,
        explain: "Moving the arm and waiting for the platter take milliseconds; transfer takes microseconds.",
      },
      {
        q: "Head at 53, queue 98, 183, 37, 122, 14, 124, 65, 67. Which request does SSTF serve first?",
        options: ["98", "37", "65", "14"],
        answer: 2,
        explain: "65 is 12 cylinders away, the closest.",
      },
      {
        q: "Which algorithm can starve requests far from the head?",
        options: ["FCFS", "SSTF", "SCAN", "C-LOOK"],
        answer: 1,
        explain: "A steady stream of nearby requests can keep the head from ever moving away.",
      },
      {
        q: "Why can't an SSD overwrite a flash page in place?",
        options: ["It can", "Flash must be erased in large blocks before pages can be written again", "The OS forbids it", "Because of TRIM"],
        answer: 1,
        explain: "The FTL writes to fresh pages and garbage-collects old blocks instead.",
      },
      {
        q: "RAID 5 across 5 disks of 4 TB gives how much usable space?",
        options: ["20 TB", "16 TB", "12 TB", "10 TB"],
        answer: 1,
        explain: "One disk's worth goes to parity: (5 − 1) × 4 = 16 TB.",
      },
      {
        q: "Data blocks are 1010, 0110 and 1100. What is the XOR parity?",
        options: ["0000", "0011", "1111", "0101"],
        answer: 0,
        explain: "1010 ⊕ 0110 = 1100, and 1100 ⊕ 1100 = 0000.",
      },
      {
        q: "What does TRIM do?",
        options: ["Defragments an HDD", "Tells the SSD which pages no longer hold useful data", "Shrinks a partition", "Speeds up the CPU"],
        answer: 1,
        explain: "Garbage collection can then skip copying dead pages.",
      },
    ],
  },

  // ------------------------------------------------------------------ I/O MODELS
  {
    id: "os-io-models",
    title: "I/O: interrupts, DMA, blocking and epoll",
    tagline: "Device drivers, polling vs interrupts, DMA, blocking vs non-blocking I/O, select/poll/epoll, edge vs level triggering, event loops, io_uring, zero-copy and the C10K problem.",
    difficulty: "advanced",
    minutes: 40,
    diagram: {
      title: "An event-loop server with epoll",
      nodes: [
        { id: "clients", label: "Clients", kind: "client", x: 110, y: 110, sub: "10,000 connections" },
        { id: "nic", label: "Network card", kind: "external", x: 350, y: 110, sub: "DMA + interrupt" },
        { id: "kernel", label: "Kernel TCP stack", kind: "control", x: 600, y: 110, sub: "socket buffers" },
        { id: "epoll", label: "epoll ready list", kind: "queue", x: 850, y: 110, sub: "only ready sockets" },
        { id: "loop", label: "Event loop thread", kind: "service", x: 850, y: 340, sub: "epoll_wait()" },
        { id: "handler", label: "Request handler", kind: "worker", x: 600, y: 340, sub: "read, work, write" },
        { id: "db", label: "Database", kind: "db", x: 350, y: 340, sub: "async query" },
      ],
      edges: [
        { from: "clients", to: "nic", label: "packets" },
        { from: "nic", to: "kernel", label: "interrupt" },
        { from: "kernel", to: "epoll", label: "socket readable" },
        { from: "epoll", to: "loop", label: "wake up" },
        { from: "loop", to: "handler", label: "callback" },
        { from: "handler", to: "db", label: "send query" },
        { from: "db", to: "epoll", dashed: true, label: "reply ready" },
        { from: "handler", to: "kernel", label: "write()" },
      ],
      flows: [
        {
          name: "A request arrives",
          path: ["clients", "nic", "kernel", "epoll", "loop", "handler"],
          steps: [
            "A client sends a request. The network card copies the packet into RAM by DMA, without the CPU's help.",
            "The card raises an interrupt. The kernel's driver and TCP stack process the packet and append the bytes to that socket's receive buffer.",
            "The socket just became readable, so the kernel adds it to the epoll instance's ready list. The other 9,999 idle connections cost nothing.",
            "The event loop was asleep in epoll_wait(). It wakes up and gets back only the ready sockets.",
            "The loop calls the handler for that connection, which reads the request with a non-blocking read() that returns at once.",
          ],
        },
        {
          name: "Waiting for the database without blocking",
          path: ["handler", "db", "epoll", "loop", "handler", "kernel", "nic", "clients"],
          steps: [
            "The handler sends a query over another socket and returns to the loop immediately instead of waiting.",
            "Meanwhile the loop serves other connections. When the database's reply arrives, its socket becomes ready.",
            "epoll_wait() returns the database socket.",
            "The loop resumes the handler that was waiting for this reply (in Node.js, the promise resolves; in Python, the coroutine continues).",
            "The handler writes the response into the client's socket buffer with write().",
            "The kernel's TCP stack sends it; the card transmits it by DMA.",
            "The client gets its answer. One thread handled thousands of connections because it never sat waiting.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You ordered a pizza. How do you know when it's here?
- **Blocking**: stand by the front door and do **nothing else** until it arrives.
- **Polling** (non-blocking): every minute, run to the door and check. You can do homework in between, but you waste time running back and forth.
- **Interrupt**: do your homework; the **doorbell rings** when the pizza arrives.
- **epoll**: you ordered **100** pizzas from different shops. Instead of checking 100 doors, a **helper** watches them all and tells you exactly which ones have arrived.
- **Async I/O** (io_uring): you hand the helper a list: "when pizza 7 comes, put it on the table". You only check the table.

## Talking to devices
The CPU talks to devices through **device controllers** (a disk controller, a network card), using registers mapped into memory (**memory-mapped I/O**) or special I/O ports. The kernel's **device drivers** know each device's language and present a standard interface to the rest of the kernel. In Linux, devices appear as files: **block devices** (\`/dev/nvme0n1\`, random access in blocks) and **character devices** (\`/dev/tty\`, \`/dev/null\`, streams of bytes); network interfaces are separate.

How does the CPU learn that a device has finished?
| Method | How | Good when |
|---|---|---|
| **Polling** (busy-waiting) | The CPU keeps reading a status register | The device is extremely fast (high-end NVMe and networking use polling modes) |
| **Interrupts** | The device signals the CPU, which runs an interrupt handler | Devices are slow relative to the CPU (keyboards, most disks) |
| **DMA** (direct memory access) | The device copies data to or from RAM itself, then interrupts once at the end | Moving lots of data without the CPU copying every byte |

At very high rates, interrupts become a flood (an **interrupt storm**). Linux networking switches between interrupts and polling (**NAPI**): one interrupt, then poll while packets keep coming.

## Blocking and non-blocking I/O
- **Blocking** (the default): \`read()\` on a socket with no data puts the thread to **sleep** until data arrives. Simple to write, but one thread can wait on only one thing. A thread per connection works for hundreds of connections, not for hundreds of thousands (each thread costs memory and scheduling).
- **Non-blocking** (\`O_NONBLOCK\`): \`read()\` returns **-1 with \`EAGAIN\`** if there's nothing yet. Now one thread can juggle many sockets, but it must not spin checking them all; it needs to know **which** ones are ready.

## I/O multiplexing: select, poll and epoll
| API | How it works | Cost per call | Notes |
|---|---|---|---|
| **select** | Pass bitmaps of fds; the kernel scans them all | O(n) | Limited to fd numbers below 1024; bitmaps rebuilt every call |
| **poll** | Pass an array of fds | O(n) | No fd limit, still scans everything |
| **epoll** (Linux) | Register fds **once**; the kernel keeps a **ready list** | O(ready) | Scales to millions of connections |
| **kqueue** (BSD, macOS) | Like epoll, also handles timers, signals, files | O(ready) | |
| **IOCP** (Windows) | Completion-based: you're told when an operation has **finished** | O(completed) | |

With epoll, \`epoll_ctl(ADD)\` registers interest, and \`epoll_wait()\` sleeps until at least one fd is ready, returning only those. Our sample watches 6 connections, writes to 3, and gets exactly those 3 back.

**Level- vs edge-triggered**: level-triggered (the default) keeps reporting a socket as long as data remains. Edge-triggered (\`EPOLLET\`) reports only the **change** from not-ready to ready, so you must read until \`EAGAIN\` or you'll never be told again. Edge-triggered saves wake-ups but is easier to get wrong.

## The event loop
An event loop is: \`while (true) { ready = epoll_wait(...); for each ready fd: run its callback }\`. Callbacks must **never block**: one slow callback freezes every connection. This is the architecture of **nginx, Redis, Node.js** (libuv), Python's **asyncio**, Netty and Rust's Tokio. \`async\`/\`await\` is syntax that lets you write the callbacks as straight-line code.

This solved the famous **C10K problem** (2001): how to serve 10,000 simultaneous connections on one machine. Thread-per-connection ran out of memory and drowned in context switches; event loops with epoll handled it easily. Today, servers handle millions.

Mix CPU-heavy or blocking work (a slow library, a big computation) into an event loop and you must hand it to a **thread pool**: Node's libuv does this for file I/O and DNS, and asyncio offers \`run_in_executor\`.

## True asynchronous I/O: io_uring
epoll tells you when you *can* read; you still make the \`read\` system call yourself. **io_uring** (Linux 5.1+) uses two **ring buffers shared** between your process and the kernel: you put requests ("read 4 KiB from fd 7 into this buffer") in the **submission queue**, and the kernel puts results in the **completion queue**. Many operations need **no system call at all**, and it works for regular files, which epoll can't help with (files are always "ready"). Databases and high-performance servers are adopting it. It's also a big kernel attack surface, so container runtimes often block it.

## Zero-copy
Sending a file over a socket the naive way copies data twice through user space: disk → page cache → your buffer (\`read\`) → socket buffer (\`write\`). **\`sendfile()\`** and **\`splice()\`** move data from the page cache to the socket **inside the kernel**. That's how nginx and Kafka serve files so fast. \`mmap\` is another way to avoid a copy.

## Buffering everywhere
There are buffers at every level: **stdio** in your program (\`printf\` is line-buffered to a terminal, fully buffered to a pipe, which is why our C samples call \`fflush\` before \`fork\`), the kernel's **socket buffers** and **page cache**, and the **device's own cache**. A "write" is only durable after \`fsync\`. A "read" may never touch the device.`,
    keyPoints: [
      "Drivers talk to device controllers; devices signal completion by interrupts, or are polled; DMA moves data without the CPU",
      "Blocking I/O sleeps the thread; non-blocking I/O returns EAGAIN when nothing is ready",
      "select and poll scan every fd each call; epoll and kqueue return only ready fds",
      "Level-triggered keeps reporting readiness; edge-triggered reports changes, so read until EAGAIN",
      "Event loops (nginx, Redis, Node, asyncio) serve many connections per thread; never block inside a callback",
      "io_uring submits and completes I/O through shared rings; sendfile and splice avoid copies",
    ],
    code: [
      {
        title: "Non-blocking reads and EAGAIN",
        linux: true,
        variants: [{ lang: "c", code: `// Blocking vs non-blocking reads: an empty pipe either puts you to sleep or says "try again".
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void) {
    int p[2];
    pipe(p);
    fcntl(p[0], F_SETFL, fcntl(p[0], F_GETFL) | O_NONBLOCK);   // make the read end non-blocking
    char buf[32];
    ssize_t n = read(p[0], buf, sizeof buf);
    printf("read on an empty non-blocking pipe: %zd, errno = %s\\n", n, errno == EAGAIN ? "EAGAIN (nothing yet, try later)" : strerror(errno));
    write(p[1], "data!", 5);
    n = read(p[0], buf, sizeof buf);
    printf("after a write: read returned %zd bytes: %.*s\\n", n, (int)n, buf);
    close(p[1]);
    n = read(p[0], buf, sizeof buf);
    printf("after the writer closes: read returns %zd (end of file)\\n", n);
    return 0;
}` }],
        explain: `- \`fcntl(..., O_NONBLOCK)\` switches the pipe's read end to non-blocking mode.
- Reading an empty pipe returns **-1** with \`errno = EAGAIN\`: "nothing yet". A blocking read would have put the thread to sleep instead.
- Once data is written, the read succeeds immediately with 5 bytes.
- When every writer has closed its end, \`read\` returns **0**: end of file. Telling "no data yet" (EAGAIN) from "no data ever" (0) apart is essential in event loops.`,
        output: `read on an empty non-blocking pipe: -1, errno = EAGAIN (nothing yet, try later)
after a write: read returned 5 bytes: data!
after the writer closes: read returns 0 (end of file)`,
      },
      {
        title: "epoll: one thread, many connections",
        linux: true,
        variants: [{ lang: "c", code: `// One thread watching many connections with epoll: only the ready ones are returned.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <unistd.h>

#define CLIENTS 6

int main(void) {
    int server[CLIENTS], client[CLIENTS];
    int ep = epoll_create1(0);
    for (int i = 0; i < CLIENTS; i++) {
        int sv[2];
        socketpair(AF_UNIX, SOCK_STREAM, 0, sv);              // a connected pair: like an accepted TCP socket
        client[i] = sv[0];
        server[i] = sv[1];
        struct epoll_event ev = {.events = EPOLLIN, .data.u32 = i};
        epoll_ctl(ep, EPOLL_CTL_ADD, server[i], &ev);         // "tell me when this one is readable"
    }
    int order[] = {4, 1, 5};                                  // only three clients say something
    for (int k = 0; k < 3; k++) {
        char msg[32];
        int n = snprintf(msg, sizeof msg, "hello from %d", order[k]);
        write(client[order[k]], msg, n);
    }
    struct epoll_event ready[CLIENTS];
    int n = epoll_wait(ep, ready, CLIENTS, 1000);             // sleeps until at least one is ready
    printf("watching %d connections, epoll_wait says %d are ready\\n", CLIENTS, n);
    int ids[CLIENTS];
    for (int k = 0; k < n; k++) ids[k] = (int)ready[k].data.u32;
    for (int a = 0; a < n; a++)                               // sort, so the output is stable
        for (int b = a + 1; b < n; b++)
            if (ids[b] < ids[a]) { int t = ids[a]; ids[a] = ids[b]; ids[b] = t; }
    for (int k = 0; k < n; k++) {
        char buf[64];
        ssize_t got = read(server[ids[k]], buf, sizeof buf - 1);
        buf[got] = 0;
        write(server[ids[k]], buf, got);                      // echo it back
        printf("  connection %d: \\"%s\\" -> echoed\\n", ids[k], buf);
    }
    n = epoll_wait(ep, ready, CLIENTS, 0);                    // nothing new: returns 0 right away
    printf("after handling them, ready connections: %d\\n", n);
    return 0;
}` }],
        explain: `- Six \`socketpair\`s stand in for six accepted TCP connections. Each server end is registered once with \`epoll_ctl(EPOLL_CTL_ADD)\`, with the connection number stored in \`data.u32\`.
- Only clients 4, 1 and 5 send something. \`epoll_wait\` returns exactly **3** events, and the loop never even looks at the idle connections. With 10,000 idle connections the cost would be the same.
- Each ready connection is read and echoed. After that, \`epoll_wait\` with a timeout of 0 returns 0: nothing is ready.
- A real server also registers its **listening** socket (readable means "a new connection is waiting to be accepted") and uses non-blocking sockets throughout.`,
        output: `watching 6 connections, epoll_wait says 3 are ready
  connection 1: "hello from 1" -> echoed
  connection 4: "hello from 4" -> echoed
  connection 5: "hello from 5" -> echoed
after handling them, ready connections: 0`,
      },
      {
        title: "An asyncio server: three clients at once (Python)",
        variants: [{ lang: "python", code: `# One thread, many clients: an asyncio server handles three slow clients at the same time.
import asyncio
import time


async def handle(reader, writer):
    name = (await reader.readline()).decode().strip()
    await asyncio.sleep(0.2)                 # pretend to wait for a database: other clients run meanwhile
    writer.write(f"hello, {name}\\n".encode())
    await writer.drain()
    writer.close()


async def client(port, name):
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    writer.write(f"{name}\\n".encode())
    reply = (await reader.readline()).decode().strip()
    writer.close()
    return reply


async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    start = time.perf_counter()
    replies = await asyncio.gather(*(client(port, n) for n in ["ann", "bob", "cat"]))
    took = time.perf_counter() - start
    print(replies)
    print(f"3 clients x 0.2 s of waiting, served in about 0.2 s, not 0.6 s: {took < 0.45}")
    server.close()
    await server.wait_closed()


asyncio.run(main())` }],
        explain: `- \`asyncio.start_server\` runs an event loop on top of epoll (kqueue on macOS). Each connection gets a \`handle\` coroutine.
- Every \`await\` is a point where the coroutine **pauses** and the loop runs someone else. While Ann's handler sleeps 0.2 s (a stand-in for a database query), Bob's and Cat's handlers run.
- So three clients that each need 0.2 s of waiting are all served in about 0.2 s total, by **one thread**.
- Calling \`time.sleep(0.2)\` instead of \`await asyncio.sleep(0.2)\` would block the whole loop, and it would take 0.6 s: the classic event-loop mistake.`,
        output: `['hello, ann', 'hello, bob', 'hello, cat']
3 clients x 0.2 s of waiting, served in about 0.2 s, not 0.6 s: True`,
      },
    ],
    interview: [
      {
        q: "What's the difference between blocking, non-blocking and asynchronous I/O?",
        freq: "very-common",
        a: `**Blocking**: the call doesn't return until the operation can complete; the thread sleeps meanwhile. **Non-blocking**: the call returns immediately, with EAGAIN if it can't proceed; you retry later, usually after a readiness notification (select/poll/epoll). **Asynchronous**: you submit the operation and are notified when it has **completed**, with the data already in your buffer (io_uring, Windows IOCP, POSIX AIO). epoll is readiness-based (you still do the read); io_uring is completion-based.`,
      },
      {
        q: "Why is epoll more scalable than select or poll?",
        freq: "very-common",
        a: `select and poll take the whole list of fds on **every** call: the kernel copies it in, checks every fd, and you scan the results, so each call is O(n) in watched fds even if one is ready (select also caps fds below 1024). epoll keeps the interest set inside the kernel (registered once with \`epoll_ctl\`) and maintains a ready list updated by callbacks when sockets become ready, so \`epoll_wait\` is O(number ready). With 100k mostly-idle connections that's the difference between scanning 100k fds per event and touching only the active ones.`,
      },
      {
        q: "What is the difference between level-triggered and edge-triggered epoll?",
        freq: "common",
        a: `**Level-triggered** (default): epoll_wait reports an fd as long as its condition holds, so if you read only part of the data you'll be told again. **Edge-triggered** (\`EPOLLET\`): you're notified only when the state changes from not-ready to ready; you must drain the fd (read until EAGAIN) or you may never be woken for the remaining data. Edge-triggered reduces repeated wake-ups and pairs well with non-blocking sockets and multiple threads (with \`EPOLLONESHOT\`), but is easier to misuse.`,
      },
      {
        q: "What is DMA and why is it important?",
        freq: "common",
        a: `Direct Memory Access lets a device controller transfer data between the device and RAM without the CPU moving each byte. The driver sets up the transfer (addresses, length), the device performs it, and raises one interrupt when done. Without DMA, the CPU would spend its time copying data (programmed I/O). DMA is how disks, NICs and GPUs reach high throughput. An IOMMU restricts which memory each device may access, for safety and virtualisation.`,
      },
      {
        q: "How does Node.js handle thousands of connections with a single thread?",
        freq: "common",
        a: `It runs an event loop (libuv) over the OS's readiness API (epoll, kqueue, IOCP). Sockets are non-blocking; when one is ready, the loop runs its JavaScript callback, which does a little work and returns. Waiting is free: there's no thread parked per connection. Operations without a good async OS API (file system calls, DNS lookups, crypto) run in libuv's thread pool, with completions fed back to the loop. CPU-heavy JavaScript blocks everything, so it belongs in worker threads.`,
      },
      {
        q: "What is io_uring and how does it differ from epoll?",
        freq: "occasional",
        a: `io_uring is a Linux async I/O interface built on two ring buffers shared between user space and the kernel: a submission queue (SQ) for requests and a completion queue (CQ) for results. You batch many operations (reads, writes, accepts, sends, even fsync) and the kernel completes them, optionally with a kernel thread polling the SQ so no syscalls are needed at all. Unlike epoll, which only signals readiness, io_uring performs the I/O itself and works for regular files and block devices. It reduces syscall overhead and copies, at the cost of complexity and a larger attack surface.`,
      },
      {
        q: "What is zero-copy and where is it used?",
        freq: "occasional",
        a: `Avoiding copies of data between kernel and user space (and between buffers). With \`read\` + \`write\`, a file sent over a socket is copied from the page cache to a user buffer and back into a socket buffer, with two syscalls per chunk. \`sendfile()\` (and \`splice()\`) transfers from the page cache to the socket inside the kernel; with NIC support (scatter-gather DMA) the CPU barely touches the data. Kafka, nginx and web servers use it for static files; \`mmap\` and \`MSG_ZEROCOPY\` are related techniques.`,
      },
    ],
    quiz: [
      {
        q: "A non-blocking read on a socket with no data returns:",
        options: ["0", "-1 with errno EAGAIN", "It sleeps", "A random byte"],
        answer: 1,
        explain: "0 would mean end of file; EAGAIN means try again later.",
      },
      {
        q: "Why does epoll_wait scale better than select with 100,000 idle connections?",
        options: ["It uses more threads", "It returns only ready fds instead of scanning all of them", "It uses UDP", "It's written in assembly"],
        answer: 1,
        explain: "The interest set lives in the kernel and readiness is tracked as events happen.",
      },
      {
        q: "With edge-triggered epoll, what must you do when a socket is reported readable?",
        options: ["Read once", "Read until EAGAIN", "Close it", "Call select"],
        answer: 1,
        explain: "You won't be notified again until new data arrives, so drain it now.",
      },
      {
        q: "What does DMA let a device do?",
        options: ["Run code on the CPU", "Copy data to or from RAM without the CPU moving each byte", "Skip interrupts forever", "Encrypt data"],
        answer: 1,
        explain: "The CPU sets up the transfer and gets one interrupt when it's done.",
      },
      {
        q: "Inside an asyncio coroutine, you call time.sleep(2). What happens?",
        options: ["Only that coroutine waits", "The whole event loop freezes for 2 seconds", "It's converted to await automatically", "An exception"],
        answer: 1,
        explain: "time.sleep blocks the thread; use await asyncio.sleep.",
      },
      {
        q: "What does sendfile() avoid?",
        options: ["Using the network", "Copying file data through a user-space buffer", "Using the page cache", "TCP handshakes"],
        answer: 1,
        explain: "The kernel moves data from the page cache to the socket directly.",
      },
      {
        q: "The C10K problem was about:",
        options: ["10,000 CPU cores", "Serving 10,000 concurrent connections on one server", "Files bigger than 10 KB", "10,000 system calls"],
        answer: 1,
        explain: "Thread-per-connection didn't scale; event loops with epoll and kqueue did.",
      },
    ],
  },

  // ------------------------------------------------------------------ IPC
  {
    id: "os-ipc",
    title: "Inter-process communication and signals",
    tagline: "Pipes, FIFOs, Unix domain sockets, shared memory, message queues, memory-mapped files, signals and their handlers, passing file descriptors, and which IPC to choose.",
    difficulty: "intermediate",
    minutes: 35,
    diagram: {
      title: "Ways for two processes to talk",
      nodes: [
        { id: "a", label: "Process A", kind: "service", x: 140, y: 280, sub: "own address space" },
        { id: "b", label: "Process B", kind: "service", x: 860, y: 280, sub: "own address space" },
        { id: "pipe", label: "Pipe", kind: "queue", x: 500, y: 70, sub: "one-way byte stream" },
        { id: "sock", label: "Unix socket", kind: "gateway", x: 500, y: 200, sub: "two-way, can pass fds" },
        { id: "shm", label: "Shared memory", kind: "cache", x: 500, y: 340, sub: "same physical pages" },
        { id: "sig", label: "Signal", kind: "monitor", x: 500, y: 470, sub: "a tiny notification" },
      ],
      edges: [
        { from: "a", to: "pipe", label: "write()" },
        { from: "pipe", to: "b", label: "read()" },
        { from: "a", to: "sock", label: "send" },
        { from: "sock", to: "b", label: "recv" },
        { from: "a", to: "shm", label: "store" },
        { from: "shm", to: "b", label: "load" },
        { from: "a", to: "sig", label: "kill()" },
        { from: "sig", to: "b", label: "handler runs" },
      ],
      flows: [
        {
          name: "A pipe",
          path: ["a", "pipe", "b"],
          steps: [
            "A writes bytes into the pipe. The kernel copies them into a buffer (64 KiB on Linux); if it's full, A blocks.",
            "B reads them in the same order. If the pipe is empty, B blocks; when A closes its end, B reads end-of-file.",
          ],
        },
        {
          name: "Shared memory",
          path: ["a", "shm", "b"],
          steps: [
            "Both processes map the same physical pages. A stores a value with an ordinary memory write: no system call, no copy.",
            "B sees it immediately with an ordinary load. It's the fastest IPC, but they need a lock or atomics, or they race.",
          ],
        },
        {
          name: "A signal",
          path: ["a", "sig", "b"],
          steps: [
            "A calls kill(pid_of_B, SIGTERM). The kernel marks the signal pending for B.",
            "Next time B returns from the kernel, its SIGTERM handler runs (or the default action: terminate). Signals carry no data, just a number.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Every process lives in its **own house** with its own memory, and can't see inside anyone else's (that's the whole point of virtual memory). So how do two programs talk?
- A **pipe** is a **tube** between two houses: drop notes in one end, they come out the other end in order.
- A **socket** is a **telephone line**: both sides can talk and listen, and it works between houses on the same street (Unix sockets) or across the world (network sockets).
- **Shared memory** is a **shared garden** between two houses: both can walk in and see the same things instantly, but they must agree on rules, or they'll trample each other's flowers (race conditions).
- A **signal** is **knocking on the door**: it doesn't carry a message, just "hey, something happened!" (or, for SIGKILL, the police knocking the door down).

## The IPC menu
| Mechanism | Direction | Data | Between | Speed | Typical use |
|---|---|---|---|---|---|
| **Pipe** (\`pipe()\`, shell pipelines) | One way | Byte stream | Related processes (parent/child) | Fast (one copy each way) | Shell pipelines |
| **FIFO** (named pipe, \`mkfifo\`) | One way | Byte stream | Any processes, by path | Fast | Simple local plumbing |
| **Unix domain socket** | Two way | Stream or datagram | Any local processes | Fast | Docker's API, PostgreSQL, X11, systemd; can pass fds and check the peer's identity |
| **TCP/UDP socket** | Two way | Stream or datagram | Across machines | Slower (network stack) | Everything networked |
| **Shared memory** (\`mmap MAP_SHARED\`, \`shm_open\`) | Both | Raw memory | Any processes | **Fastest** (no copies) | Databases (PostgreSQL's shared buffers), browsers, video |
| **Message queue** (POSIX \`mq_open\`) | Both | Discrete messages with priorities | Any processes | Medium | Simple job queues |
| **Memory-mapped file** | Both | File contents | Any processes | Fast | Sharing data that should also persist |
| **Signal** | One way | Just a number | Any processes (with permission) | Notification only | Stop, reload config, child exited |

## Pipes in detail
\`pipe(fds)\` creates a kernel buffer with a read end \`fds[0]\` and a write end \`fds[1]\`. After \`fork\`, the parent and child each close the end they don't use. Rules worth knowing:
- Reading an **empty** pipe blocks; reading after **all writers closed** returns 0 (EOF). So forgetting to close an unused write end means the reader never sees EOF and hangs. This is the number one pipe bug.
- Writing to a **full** pipe (64 KiB on Linux) blocks: **back-pressure**, which keeps a fast producer from flooding a slow consumer.
- Writing when **all readers closed** raises **SIGPIPE** (which kills the writer by default). That's why \`yes | head -1\` stops.
- Writes of up to \`PIPE_BUF\` (4 KiB) are **atomic**: lines from several writers never interleave mid-message.

You built pipelines in the shell project of Part 2.

## Unix domain sockets
Same API as network sockets (\`socket\`, \`bind\`, \`connect\`, \`send\`, \`recv\`), but addressed by a **file path** (\`/var/run/docker.sock\`) and never touching the network stack. Two special powers:
- **Passing file descriptors** (\`SCM_RIGHTS\`): send an **open file** to another process. The receiver gets a new fd number for the same open file description. Our sample hands an open file from parent to child. This is how privilege-separated programs work: a privileged helper opens a file and hands over just that fd.
- **Peer credentials** (\`SO_PEERCRED\`): learn the PID and user ID of the process on the other end, so the server can trust it.

## Shared memory
Map the **same physical pages** into two address spaces: \`mmap(MAP_SHARED | MAP_ANONYMOUS)\` before a \`fork\`, or \`shm_open("/name")\` + \`mmap\` between unrelated processes (it appears in \`/dev/shm\`). After setup, communication is plain memory loads and stores: **no system calls, no copies**.

The catch: everything from Part 3 applies **across processes**. Our sample shows two processes losing updates on a shared counter, exactly as two threads did. Use atomics, or process-shared mutexes and semaphores (\`PTHREAD_PROCESS_SHARED\`, \`sem_init(&s, 1, n)\`), and put the lock inside the shared region.

## Signals
A signal is an asynchronous notification sent to a process by the kernel or by another process (\`kill\`). Each has a number and a default action:
| Signal | Default | Sent when |
|---|---|---|
| **SIGINT** (2) | Terminate | You press Ctrl+C |
| **SIGTERM** (15) | Terminate | \`kill PID\`, \`docker stop\`, Kubernetes pod shutdown: "please exit cleanly" |
| **SIGKILL** (9) | Terminate, **can't be caught or ignored** | \`kill -9\`, the OOM killer, after the shutdown grace period |
| **SIGSEGV** (11) | Core dump | Invalid memory access |
| **SIGCHLD** | Ignore | A child process stopped or exited |
| **SIGPIPE** | Terminate | Writing to a pipe or socket with no reader |
| **SIGHUP** | Terminate | Terminal closed; by convention, daemons reload their config |
| **SIGSTOP** / **SIGCONT** | Stop / continue | Ctrl+Z, \`fg\`; SIGSTOP can't be caught either |
| **SIGUSR1/2** | Terminate | Whatever your program decides |

Handling them correctly:
- Use \`sigaction\` (not the old \`signal\`).
- A handler interrupts your code **at any instruction**, so it may only call **async-signal-safe** functions (\`write\`, \`_exit\`, setting a \`volatile sig_atomic_t\` flag). Calling \`printf\` or \`malloc\` in a handler can deadlock if the signal arrived while the main code was inside \`malloc\`.
- The common pattern: the handler just **sets a flag**, and the main loop checks it. Or use \`signalfd\` to receive signals as readable data in your epoll loop.
- Graceful shutdown: on SIGTERM, stop accepting work, finish what's in flight, flush, exit. Kubernetes sends SIGTERM, waits the grace period (30 s by default), then sends SIGKILL.
- **PID 1 in a container** gets no default signal actions, so a program that doesn't install a SIGTERM handler ignores \`docker stop\` and gets killed 10 seconds later. Tiny init processes like \`tini\` (\`docker run --init\`) fix this.

## Choosing an IPC
- Parent ↔ child, streaming: **pipe**.
- Local client/server with requests and replies: **Unix domain socket** (easy to switch to TCP later).
- Large data, highest speed, same machine: **shared memory** plus a synchronisation primitive (often signalled through a socket or eventfd).
- Across machines: **TCP**, HTTP, gRPC, or a message broker like Kafka or RabbitMQ.
- "Something happened" notifications: **signals** (or eventfd, or a byte on a pipe).`,
    keyPoints: [
      "Processes are isolated, so they need IPC: pipes, FIFOs, sockets, shared memory, message queues, signals",
      "Pipes are one-way byte streams with back-pressure; close unused ends or readers never see EOF",
      "Unix domain sockets are local, two-way, and can pass file descriptors and peer credentials",
      "Shared memory is the fastest IPC but needs atomics or process-shared locks",
      "Signals are asynchronous numbered notifications; SIGKILL and SIGSTOP can't be caught",
      "Signal handlers may only call async-signal-safe functions; set a flag and handle it in the main loop",
    ],
    code: [
      {
        title: "Shared memory between processes (and its race)",
        linux: true,
        variants: [{ lang: "c", code: `// Shared memory between two PROCESSES: fast, but the race conditions come along too.
#include <stdatomic.h>
#include <stdio.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>

#define N 2000000
struct shared {
    volatile long plain;
    atomic_long safe;
};

int main(void) {
    struct shared *s = mmap(NULL, sizeof *s, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    s->plain = 0;
    atomic_init(&s->safe, 0);
    pid_t kid = fork();                       // MAP_SHARED: the child sees the SAME page, not a copy
    for (int i = 0; i < N; i++) {
        s->plain++;
        atomic_fetch_add(&s->safe, 1);
    }
    if (kid == 0) _exit(0);
    waitpid(kid, NULL, 0);
    printf("both processes added %d each\\n", N);
    printf("plain counter lost updates: %s\\n", s->plain < 2 * N ? "yes" : "no (lucky)");
    printf("atomic counter: %ld\\n", (long)atomic_load(&s->safe));
    return 0;
}` }],
        explain: `- \`mmap(MAP_SHARED | MAP_ANONYMOUS)\` before \`fork\` gives both processes the **same physical page**. Unlike normal memory after fork, there's no copy-on-write: writes are visible to both.
- Both processes increment both counters two million times. The plain \`++\` loses updates, exactly like threads in Part 3, because it's still load, add, store.
- The atomic counter is exactly 4,000,000: \`atomic_fetch_add\` works across processes because it operates on the physical memory both share.
- For bigger critical sections, put a mutex inside the shared region and initialise it with the \`PTHREAD_PROCESS_SHARED\` attribute.`,
        output: `both processes added 2000000 each
plain counter lost updates: yes
atomic counter: 4000000`,
      },
      {
        title: "Unix domain sockets: requests, replies and passing an fd",
        linux: true,
        variants: [{ lang: "c", code: `// A Unix domain socket pair: a request/response conversation, then passing an open file to another process.
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

static void send_fd(int sock, int fd) {                     // the fd travels as "ancillary data"
    char byte = 'F';
    struct iovec iov = {.iov_base = &byte, .iov_len = 1};
    char ctrl[CMSG_SPACE(sizeof(int))] = {0};
    struct msghdr msg = {.msg_iov = &iov, .msg_iovlen = 1, .msg_control = ctrl, .msg_controllen = sizeof ctrl};
    struct cmsghdr *c = CMSG_FIRSTHDR(&msg);
    c->cmsg_level = SOL_SOCKET;
    c->cmsg_type = SCM_RIGHTS;
    c->cmsg_len = CMSG_LEN(sizeof(int));
    memcpy(CMSG_DATA(c), &fd, sizeof(int));
    sendmsg(sock, &msg, 0);
}

static int recv_fd(int sock) {
    char byte;
    struct iovec iov = {.iov_base = &byte, .iov_len = 1};
    char ctrl[CMSG_SPACE(sizeof(int))];
    struct msghdr msg = {.msg_iov = &iov, .msg_iovlen = 1, .msg_control = ctrl, .msg_controllen = sizeof ctrl};
    recvmsg(sock, &msg, 0);
    int fd;
    memcpy(&fd, CMSG_DATA(CMSG_FIRSTHDR(&msg)), sizeof(int));
    return fd;
}

int main(void) {
    int sv[2];
    socketpair(AF_UNIX, SOCK_STREAM, 0, sv);
    int f = open("/tmp/secret.txt", O_CREAT | O_RDWR | O_TRUNC, 0600);
    write(f, "the treasure is under the oak tree\\n", 35);
    close(f);

    if (fork() == 0) {                                    // the "calculator service"
        close(sv[0]);
        char req[64] = {0};
        read(sv[1], req, sizeof req - 1);
        int a, b;
        sscanf(req, "add %d %d", &a, &b);
        char resp[32];
        int n = snprintf(resp, sizeof resp, "%d", a + b);
        write(sv[1], resp, n);
        int got = recv_fd(sv[1]);                         // a NEW fd number in this process, same open file
        char text[64] = {0};
        pread(got, text, sizeof text - 1, 0);
        printf("child read through the passed fd: %s", text);
        fflush(stdout);
        _exit(0);
    }
    close(sv[1]);
    write(sv[0], "add 2 3", 7);
    char resp[32] = {0};
    read(sv[0], resp, sizeof resp - 1);
    printf("parent asked \\"add 2 3\\", child answered %s\\n", resp);
    fflush(stdout);
    int fd = open("/tmp/secret.txt", O_RDONLY);
    send_fd(sv[0], fd);
    wait(NULL);
    unlink("/tmp/secret.txt");
    return 0;
}` }],
        explain: `- \`socketpair(AF_UNIX, SOCK_STREAM)\` creates two connected sockets: a private phone line between parent and child. (Unrelated processes would \`bind\` and \`connect\` to a path instead.)
- The child acts as a tiny service: it reads "add 2 3" and answers "5".
- Then the parent sends an **open file descriptor**. \`sendmsg\` with a \`SCM_RIGHTS\` control message makes the kernel install a new fd in the child that refers to the same open file.
- The child reads the secret file through the passed fd. In a real system the child might not even have permission to open that file itself: the fd is the permission.`,
        output: `parent asked "add 2 3", child answered 5
child read through the passed fd: the treasure is under the oak tree`,
      },
      {
        title: "Signals: handlers, graceful shutdown and SIGKILL",
        linux: true,
        variants: [{ lang: "c", code: `// Signals: catching SIGUSR1 and SIGTERM, and why SIGKILL can't be caught.
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static volatile sig_atomic_t got_usr1, got_term;
static void on_usr1(int s) { (void)s; got_usr1++; }
static void on_term(int s) { (void)s; got_term = 1; }

int main(void) {
    sigset_t block, old;
    sigemptyset(&block);
    sigaddset(&block, SIGUSR1);
    sigaddset(&block, SIGTERM);
    sigprocmask(SIG_BLOCK, &block, &old);                 // hold signals until we're ready to wait

    pid_t kid = fork();
    if (kid == 0) {
        struct sigaction sa = {0};
        sa.sa_handler = on_usr1;
        sigaction(SIGUSR1, &sa, NULL);
        sa.sa_handler = on_term;
        sigaction(SIGTERM, &sa, NULL);
        printf("child: sigaction(SIGKILL) is refused: %s\\n", sigaction(SIGKILL, &sa, NULL) == -1 ? "yes" : "no");
        fflush(stdout);
        kill(getppid(), SIGUSR1);                         // "I'm ready"
        while (!got_term) sigsuspend(&old);               // sleep until a signal arrives
        printf("child: got SIGUSR1 %d time(s), then SIGTERM: saving work and exiting cleanly\\n", (int)got_usr1);
        fflush(stdout);
        _exit(3);
    }
    int sig;
    sigwait(&block, &sig);                                // wait for the child's "ready"
    kill(kid, SIGUSR1);
    usleep(50000);
    kill(kid, SIGTERM);                                   // a polite request to stop
    int status;
    waitpid(kid, &status, 0);
    printf("parent: child exited with code %d\\n", WEXITSTATUS(status));

    fflush(stdout);
    kid = fork();
    if (kid == 0) {
        for (;;) pause();                                 // a stubborn process
    }
    kill(kid, SIGKILL);                                   // not a request: the kernel just removes it
    waitpid(kid, &status, 0);
    printf("parent: second child was killed by signal %d (%s)\\n", WTERMSIG(status), strsignal(WTERMSIG(status)));
    return 0;
}` }],
        explain: `- The parent **blocks** SIGUSR1 and SIGTERM before forking, so the child's "I'm ready" signal can't arrive before the parent waits for it with \`sigwait\`. Without that, a signal could slip through the gap: a classic race.
- The child installs handlers with \`sigaction\`. The handlers only update \`volatile sig_atomic_t\` flags; the real work happens in the main code.
- \`sigsuspend\` atomically unblocks the signals and sleeps until one arrives. On SIGTERM, the child "saves its work" and exits with code 3: a **graceful shutdown**.
- Installing a handler for SIGKILL fails, and the second child, stuck in \`pause()\`, is killed instantly by signal 9. That's why \`kill -9\` is the last resort: no cleanup runs at all.`,
        output: `child: sigaction(SIGKILL) is refused: yes
child: got SIGUSR1 1 time(s), then SIGTERM: saving work and exiting cleanly
parent: child exited with code 3
parent: second child was killed by signal 9 (Killed)`,
      },
      {
        title: "Pipes and queues between Python processes",
        variants: [{ lang: "python", code: `# Inter-process communication in Python: a Pipe for two processes, a Queue for a pool of workers.
import multiprocessing as mp


def doubler(conn):
    while (n := conn.recv()) is not None:
        conn.send(n * 2)


def worker(tasks, results):
    for n in iter(tasks.get, None):
        results.put((n, n * n))


if __name__ == "__main__":
    parent, child = mp.Pipe()
    p = mp.Process(target=doubler, args=(child,))
    p.start()
    for n in [1, 2, 21]:
        parent.send(n)
        print(f"sent {n}, got back {parent.recv()}")
    parent.send(None)
    p.join()

    tasks, results = mp.Queue(), mp.Queue()
    workers = [mp.Process(target=worker, args=(tasks, results)) for _ in range(3)]
    for w in workers:
        w.start()
    for n in range(1, 9):
        tasks.put(n)
    for _ in workers:
        tasks.put(None)                      # one "stop" message per worker
    squares = sorted(results.get() for _ in range(8))
    for w in workers:
        w.join()
    print("3 worker processes computed:", squares)` }],
        explain: `- \`mp.Pipe()\` gives two connection objects, built on a socketpair or pipe. \`send\` pickles a Python object into bytes; \`recv\` unpickles it on the other side.
- The doubler process loops until it receives \`None\`, a common "stop" message.
- \`mp.Queue\` is a pipe plus a feeder thread and a lock, safe for many producers and consumers. Three workers take numbers and put back squares.
- One \`None\` per worker shuts them all down. The results come back in any order, so they're sorted before printing.
- \`if __name__ == "__main__"\` is required on macOS and Windows, where child processes start fresh and re-import the script.`,
        output: `sent 1, got back 2
sent 2, got back 4
sent 21, got back 42
3 worker processes computed: [(1, 1), (2, 4), (3, 9), (4, 16), (5, 25), (6, 36), (7, 49), (8, 64)]`,
      },
    ],
    interview: [
      {
        q: "What IPC mechanisms do you know, and when would you use each?",
        freq: "very-common",
        a: `**Pipes** for one-way streams between related processes (shell pipelines); **FIFOs** for the same between unrelated ones; **Unix domain sockets** for local client-server communication (bidirectional, can pass fds, check peer credentials); **TCP sockets** across machines; **shared memory** for the highest throughput with explicit synchronisation; **message queues** for discrete prioritised messages; **memory-mapped files** for shared persistent data; **signals** for simple notifications. Higher-level: gRPC/HTTP, or brokers like Kafka and RabbitMQ.`,
      },
      {
        q: "Why is shared memory the fastest IPC, and what's the catch?",
        freq: "common",
        a: `After setup, processes communicate with ordinary loads and stores on the same physical pages: no system calls and no copying through the kernel, unlike pipes and sockets (which copy data into and out of a kernel buffer). The catch: synchronisation is entirely your problem. You need atomics or process-shared mutexes/semaphores to avoid races, a way to signal "data ready" (futex, eventfd, a socket), careful memory layout (no pointers, since addresses may differ between processes), and cleanup of named segments.`,
      },
      {
        q: "What happens when you press Ctrl+C in a terminal running a program?",
        freq: "common",
        a: `The terminal driver (line discipline) sees the interrupt character and sends **SIGINT** to every process in the terminal's foreground process group (so a whole pipeline gets it). Each process runs its SIGINT handler if it has one (Python raises \`KeyboardInterrupt\`), otherwise the default action terminates it. The shell, which was waiting, sees the children die from a signal and prints a new prompt; \`$?\` becomes 130 (128 + 2).`,
      },
      {
        q: "What's the difference between SIGTERM and SIGKILL?",
        freq: "very-common",
        a: `**SIGTERM** (15) is a request to terminate: the process can catch it, clean up (finish requests, flush data, release locks, remove temporary files) and exit, or even ignore it. **SIGKILL** (9) can't be caught, blocked or ignored: the kernel removes the process immediately with no cleanup. Orchestrators send SIGTERM first and SIGKILL after a grace period (\`docker stop\`: 10 s; Kubernetes: \`terminationGracePeriodSeconds\`, 30 s by default).`,
      },
      {
        q: "What can you safely do inside a signal handler?",
        freq: "common",
        a: `Only call **async-signal-safe** functions (\`write\`, \`_exit\`, \`kill\`, \`sigaction\` and a list of others) and modify \`volatile sig_atomic_t\` variables or lock-free atomics. The handler can interrupt the main program anywhere, including inside \`malloc\` or \`printf\` while they hold internal locks, so calling them from the handler can deadlock or corrupt state. The standard pattern is to set a flag (or write a byte to a self-pipe, or use \`signalfd\`) and handle the event in the main loop. Also save and restore \`errno\`.`,
      },
      {
        q: "A pipeline hangs: the reader never sees end-of-file. What's the likely bug?",
        freq: "occasional",
        a: `Some process still has the pipe's **write end** open: usually the parent (or the reader itself) forgot to close its copy after forking. EOF is only delivered when every write end is closed. The fix is to close unused pipe ends in every process right after fork (and use \`O_CLOEXEC\`/\`pipe2\` so exec'd programs don't inherit stray fds).`,
      },
    ],
    quiz: [
      {
        q: "Which IPC lets two processes exchange data with no system calls once it's set up?",
        options: ["Pipe", "Shared memory", "Unix socket", "Signal"],
        answer: 1,
        explain: "Both map the same physical pages and use normal memory loads and stores.",
      },
      {
        q: "A pipe's reader is blocked forever even though the writer exited. Why?",
        options: ["The pipe is full", "Another process still holds the write end open", "Pipes don't support EOF", "SIGPIPE"],
        answer: 1,
        explain: "EOF only arrives when every write end is closed.",
      },
      {
        q: "Which signal can a process NOT catch?",
        options: ["SIGTERM", "SIGINT", "SIGKILL", "SIGUSR1"],
        answer: 2,
        explain: "SIGKILL and SIGSTOP can't be caught, blocked or ignored.",
      },
      {
        q: "What special ability do Unix domain sockets have?",
        options: ["They're faster than RAM", "They can pass open file descriptors between processes", "They work across the internet", "They never block"],
        answer: 1,
        explain: "SCM_RIGHTS ancillary messages transfer fds.",
      },
      {
        q: "Inside a signal handler, which call is safe?",
        options: ["printf", "malloc", "write", "fopen"],
        answer: 2,
        explain: "write is async-signal-safe; the others take locks or touch global state.",
      },
      {
        q: "Kubernetes wants to stop a pod. What does the container's main process receive first?",
        options: ["SIGKILL", "SIGTERM, then SIGKILL after the grace period", "SIGINT", "Nothing"],
        answer: 1,
        explain: "SIGTERM gives the process a chance to shut down gracefully.",
      },
      {
        q: "Two processes increment a counter in shared memory with plain ++. What can happen?",
        options: ["Nothing bad", "Lost updates, just like with threads", "A segmentation fault", "The kernel serialises them"],
        answer: 1,
        explain: "Shared memory brings shared-memory races; use atomics or process-shared locks.",
      },
    ],
  },
];
