import type { World } from "../types";
import { osPart1 } from "./os-1";
import { osPart2 } from "./os-2";
import { osPart3 } from "./os-3";
import { osPart4 } from "./os-4";
import { osPart5 } from "./os-5";
import { osPart6 } from "./os-6";

export const os: World = {
  id: "os",
  order: 12,
  title: "Kernel Kingdom",
  subtitle: "Operating systems from the power button up: processes, scheduling, concurrency, memory, file systems, I/O, security, containers and the OS interview",
  description:
    "How an operating system really works, explained so simply a 10-year-old could follow and deep enough for a systems interview. Boot a machine, trap into the kernel, fork processes and build your own shell, schedule a CPU, race threads and fix them with locks, deadlock philosophers, translate virtual addresses, evict pages, allocate memory, walk inodes, move a disk arm, multiplex sockets with epoll, and build a container from namespaces and cgroups. Every C sample runs on real Linux.",
  emoji: "🖥️",
  color: "#a21caf",
  boss: {
    name: "The Kernel Panic",
    title: "Lord of Deadlocks and Page Faults",
    emoji: "👾",
    taunt: "Your threads are racing, your locks are crossed, your pages are thrashing and PID 1 just died. Every segfault is mine!",
    defeat: "Mutex held, pages resident, zombies reaped, deadlock broken. The kernel is calm. You think like an operating system now.",
  },
  lessons: [...osPart1, ...osPart2, ...osPart3, ...osPart4, ...osPart5, ...osPart6],
};
