import { ActionRequest } from "@/lib/api-schemas";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyAction } from "@/lib/game/engine";
import { catalog, grade } from "@/lib/grade";
import { loadPlayer, lockUser, persistOutcome } from "@/lib/player";
import { TX } from "@/lib/session-player";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = ActionRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid action" }, { status: 400 });

  const now = new Date();
  const graded = grade(parsed.data, now);
  if ("error" in graded) return Response.json({ error: graded.error }, { status: 400 });

  const outcome = await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const loaded = await loadPlayer(tx, userId);
    if (!loaded) return null;
    const result = applyAction(loaded.state, graded.action, catalog(), now);
    await persistOutcome(tx, userId, loaded.state, result);
    return result;
  }, TX);

  if (!outcome) return Response.json({ error: "Account not found" }, { status: 401 });
  return Response.json({ outcome, detail: graded.detail ?? null });
}
