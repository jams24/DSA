// Step-through simulations for the LeetCode 150 problems, one module per category so each
// problem page only downloads the tracers for its own category.
import type { Sim } from "@/lib/sim/types";

type SimModule = { SIMS: Record<string, Sim> };

export const SIM_LOADERS: Record<string, () => Promise<SimModule>> = {
  "Array / String": () => import("./array-string"),
  "Two Pointers": () => import("./two-pointers"),
};
