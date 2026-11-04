import type { World } from "../types";
import { pyFoundations } from "./python-1";
import { pyCore } from "./python-2";
import { pyAdvanced } from "./python-3";
import { pyEcosystem } from "./python-4";
import { pyProjects } from "./python-5";

export const python: World = {
  id: "python",
  track: "language",
  order: 18,
  title: "Python",
  subtitle: "From your first script to asyncio, the GIL, FastAPI services and Pythonic interviews",
  description:
    "A complete course in modern Python (3.12 to 3.14). Learn how CPython runs your code, then master names and objects, the built-in collections, functions, closures and decorators, classes and the data model, exceptions and context managers, generators, type hints and pytest. Go deep on threads, processes and the GIL, asyncio and the event loop, memory and performance. Finish with the libraries Python teams use, FastAPI, Django and Flask, two guided projects (a log-analytics CLI and a production-style REST API) and the questions Python interviewers ask.",
  emoji: "🐍",
  color: "#a16207",
  boss: {
    name: "The Global Interpreter Lich",
    title: "Keeper of the GIL",
    emoji: "🧟",
    taunt: "Your default list is shared by every call, your lambdas all return the last i, your threads queue behind my lock, and one time.sleep froze your whole event loop!",
    defeat: "Defaults set to None, closures bound early, CPU work sent to processes, I/O awaited in a TaskGroup. The Lich's lock is released.",
  },
  lessons: [...pyFoundations, ...pyCore, ...pyAdvanced, ...pyEcosystem, ...pyProjects],
};
