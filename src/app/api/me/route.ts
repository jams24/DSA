import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadPlayer } from "@/lib/player";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ user: null });
  const loaded = await loadPlayer(prisma, userId);
  if (!loaded) return Response.json({ user: null });
  return Response.json(loaded);
}
