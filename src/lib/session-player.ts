import bcrypt from "bcryptjs";
import { GuestState } from "./api-schemas";
import { prisma } from "./db";
import { emptyState, mergeGuest, type Outcome, type PlayerState } from "./game/engine";
import { catalog } from "./grade";
import { loadPlayer, lockUser, persistOutcome, type PublicUser } from "./player";

export const TX = { timeout: 30_000, maxWait: 10_000 };

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** Parses untrusted guest state; returns null when absent, empty or malformed. */
export function parseGuest(raw: unknown): PlayerState | null {
  if (!raw) return null;
  const parsed = GuestState.safeParse(raw);
  if (!parsed.success) return null;
  const g = parsed.data;
  if (Object.keys(g.progress).length > 400 || Object.keys(g.cards).length > 3000) return null;
  if (g.xp <= 0 && Object.keys(g.progress).length === 0 && Object.keys(g.cards).length === 0) return null;
  return { ...emptyState(), ...g, progress: g.progress, cards: g.cards, stats: g.stats };
}

/** Loads the player, optionally folding guest progress in, inside one locked transaction. */
export async function loadWithGuest(
  userId: string,
  guest: PlayerState | null,
): Promise<{ user: PublicUser; state: PlayerState; merged: Outcome | null } | null> {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const loaded = await loadPlayer(tx, userId);
    if (!loaded) return null;
    if (!guest) return { ...loaded, merged: null };
    const outcome = mergeGuest(loaded.state, guest, catalog());
    await persistOutcome(tx, userId, loaded.state, outcome);
    return { user: loaded.user, state: outcome.state, merged: outcome };
  }, TX);
}
