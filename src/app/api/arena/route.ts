import { allQuestions } from "@/content";
import { sample } from "@/lib/random";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const worlds = (params.get("worlds") ?? "").split(",").filter(Boolean);
  const n = Math.max(1, Math.min(80, Number(params.get("n")) || 40));
  const pool = worlds.length ? allQuestions().filter((q) => worlds.includes(q.worldId)) : allQuestions();
  return Response.json({ questions: sample(pool, n) });
}
