import type { World } from "../types";
import { goFoundations } from "./go-1";
import { goCore } from "./go-2";
import { goAdvanced } from "./go-3";
import { goEcosystem } from "./go-4";
import { goProjects } from "./go-5";

export const go: World = {
  id: "go",
  track: "language",
  order: 17,
  title: "Go",
  subtitle: "From your first goroutine to production HTTP services, the scheduler and idiomatic interviews",
  description:
    "A complete course in Go (1.24 and newer). Learn how Go builds a single static binary, then master slices, maps, structs, interfaces, errors as values, generics, iterators and table-driven tests. Go deep on goroutines, channels, select, context and the runtime's scheduler and garbage collector. Finish with the libraries Go teams use, net/http and the web frameworks, two guided projects (a concurrent CLI and a production-style REST API) and the questions Go interviewers ask.",
  emoji: "🐹",
  color: "#0284c7",
  boss: {
    name: "The Deadlock Daemon",
    title: "Keeper of Leaked Goroutines",
    emoji: "😈",
    taunt: "fatal error: all goroutines are asleep - deadlock! Your nil map panics, your loop captures the wrong variable, your interface isn't nil, and your goroutines never return!",
    defeat: "Every channel closed by its sender, every goroutine bound to a context, every error wrapped with %w. The Daemon is garbage collected.",
  },
  lessons: [...goFoundations, ...goCore, ...goAdvanced, ...goEcosystem, ...goProjects],
};
