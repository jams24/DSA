// Level curve: reaching level L needs 50 * L * (L - 1) total XP
// (L2 = 100, L3 = 300, L5 = 1000, L10 = 4500, L15 = 10500).

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  title: string;
  current: number; // xp into this level
  needed: number; // xp span of this level
  pct: number;
}

const TITLES = [
  "Hello-World Hatchling",
  "Loop Initiate",
  "Array Adventurer",
  "Pointer Ranger",
  "Recursion Rogue",
  "Tree Climber",
  "Graph Explorer",
  "DP Sorcerer",
  "System Architect",
  "Consensus Keeper",
  "Shard Lord",
  "Inference Wizard",
  "Staff Engineer",
  "Principal Paladin",
  "Distributed Demigod",
];

export function titleForLevel(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1];
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = xp - base;
  const needed = next - base;
  return { level, title: titleForLevel(level), current, needed, pct: Math.min(100, (current / needed) * 100) };
}
