import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface Row {
  rank: number;
  id: string;
  username: string;
  avatar: string;
  xp: number;
  streak: number;
}

export async function GET(req: Request) {
  const period = new URL(req.url).searchParams.get("period") === "week" ? "week" : "all";
  const me = await getSessionUserId();
  let rows: Row[];
  let myRank: Row | null = null;

  if (period === "all") {
    const users = await prisma.user.findMany({
      where: { xp: { gt: 0 } },
      orderBy: [{ xp: "desc" }, { createdAt: "asc" }],
      take: 50,
      select: { id: true, username: true, avatar: true, xp: true, streak: true },
    });
    rows = users.map((u, i) => ({ rank: i + 1, ...u }));
    if (me && !rows.some((r) => r.id === me)) {
      const u = await prisma.user.findUnique({
        where: { id: me },
        select: { id: true, username: true, avatar: true, xp: true, streak: true },
      });
      if (u) myRank = { rank: (await prisma.user.count({ where: { xp: { gt: u.xp } } })) + 1, ...u };
    }
  } else {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sums = await prisma.xpEvent.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 50,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: sums.map((s) => s.userId) } },
      select: { id: true, username: true, avatar: true, streak: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    rows = sums
      .filter((s) => byId.has(s.userId))
      .map((s, i) => ({ rank: i + 1, ...byId.get(s.userId)!, xp: s._sum.amount ?? 0 }));
  }

  return Response.json({ period, rows, me, myRank });
}
