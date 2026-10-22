import { LoginRequest } from "@/lib/api-schemas";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loadWithGuest, parseGuest, verifyPassword } from "@/lib/session-player";

export async function POST(req: Request) {
  const parsed = LoginRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter your username and password" }, { status: 400 });
  const { username, password, guest } = parsed.data;

  if (!rateLimit(`login:${clientIp(req)}:${username.toLowerCase()}`, 10, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const user = username.includes("@")
    ? await prisma.user.findUnique({ where: { email: username.toLowerCase() } })
    : await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return Response.json({ error: "Wrong username or password" }, { status: 401 });
  }

  const loaded = await loadWithGuest(user.id, parseGuest(guest));
  await createSession(user.id);
  return Response.json({ user: loaded!.user, state: loaded!.state, merged: loaded!.merged });
}
