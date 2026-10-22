// Server-side bridge between the database and the pure game engine.

import type { Prisma } from "@prisma/client";
import type { Outcome, PlayerState, PlayerStats } from "./game/engine";

type Tx = Prisma.TransactionClient;

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
}

export async function loadPlayer(tx: Tx, userId: string): Promise<{ user: PublicUser; state: PlayerState } | null> {
  const u = await tx.user.findUnique({
    where: { id: userId },
    include: { progress: true, achievements: true, cards: true },
  });
  if (!u) return null;
  const state: PlayerState = {
    xp: u.xp,
    streak: u.streak,
    bestStreak: u.bestStreak,
    lastActiveDay: u.lastActiveDay,
    stats: (u.stats ?? {}) as PlayerStats,
    achievements: u.achievements.map((a) => a.achievementId),
    progress: Object.fromEntries(
      u.progress.map((p) => [
        p.lessonId,
        {
          read: p.read,
          visualized: p.visualized,
          bestScore: p.bestScore,
          stars: p.stars,
          completedAt: p.completedAt?.toISOString() ?? null,
        },
      ]),
    ),
    cards: Object.fromEntries(
      u.cards.map((c) => [c.cardId, { box: c.box, dueAt: c.dueAt.toISOString(), reviews: c.reviews }]),
    ),
  };
  return { user: { id: u.id, username: u.username, avatar: u.avatar }, state };
}

/** Row-locks the user so concurrent actions for one player apply sequentially. */
export async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

/** Writes only what changed between `before` and the outcome's state. */
export async function persistOutcome(tx: Tx, userId: string, before: PlayerState, outcome: Outcome) {
  const after = outcome.state;

  await tx.user.update({
    where: { id: userId },
    data: {
      xp: after.xp,
      streak: after.streak,
      bestStreak: after.bestStreak,
      lastActiveDay: after.lastActiveDay,
      stats: after.stats as Prisma.InputJsonValue,
    },
  });

  for (const [lessonId, e] of Object.entries(after.progress)) {
    const prev = before.progress[lessonId];
    if (
      prev &&
      prev.read === e.read &&
      prev.visualized === e.visualized &&
      prev.bestScore === e.bestScore &&
      prev.stars === e.stars
    )
      continue;
    const data = {
      read: e.read,
      visualized: e.visualized,
      bestScore: e.bestScore,
      stars: e.stars,
      completedAt: e.completedAt ? new Date(e.completedAt) : null,
    };
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, ...data },
      update: data,
    });
  }

  for (const [cardId, c] of Object.entries(after.cards)) {
    const prev = before.cards[cardId];
    if (prev && prev.box === c.box && prev.reviews === c.reviews && prev.dueAt === c.dueAt) continue;
    const data = { box: c.box, reviews: c.reviews, dueAt: new Date(c.dueAt) };
    await tx.cardReview.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, ...data },
      update: data,
    });
  }

  if (outcome.newAchievements.length) {
    await tx.userAchievement.createMany({
      data: outcome.newAchievements.map((achievementId) => ({ userId, achievementId })),
      skipDuplicates: true,
    });
  }

  if (outcome.grants.length) {
    await tx.xpEvent.createMany({
      data: outcome.grants.map((g) => ({ userId, amount: g.amount, reason: g.reason.slice(0, 190) })),
    });
  }
}
