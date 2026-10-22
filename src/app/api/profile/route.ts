import { ProfileRequest } from "@/lib/api-schemas";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = ProfileRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid avatar" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: parsed.data.avatar },
    select: { id: true, username: true, avatar: true },
  });
  return Response.json({ user });
}
