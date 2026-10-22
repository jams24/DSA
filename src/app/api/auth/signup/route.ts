import { Prisma } from "@prisma/client";
import { SignupRequest } from "@/lib/api-schemas";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashPassword, loadWithGuest, parseGuest } from "@/lib/session-player";

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return Response.json({ error: "Too many sign-ups from this network. Try again later." }, { status: 429 });
  }
  const parsed = SignupRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { username, password, avatar, guest } = parsed.data;

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { username, avatar, passwordHash: await hashPassword(password) },
    });
    userId = user.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "That username is taken" }, { status: 409 });
    }
    throw e;
  }

  const loaded = await loadWithGuest(userId, parseGuest(guest));
  await createSession(userId);
  return Response.json({ user: loaded!.user, state: loaded!.state, merged: loaded!.merged });
}
