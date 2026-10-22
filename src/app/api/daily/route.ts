import { connection } from "next/server";
import { dailyQuestions } from "@/content";
import { utcDay } from "@/lib/game/engine";

export async function GET() {
  await connection();
  const now = new Date();
  const day = utcDay(now);
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return Response.json({ day, resetsAt: next.toISOString(), questions: dailyQuestions(day) });
}
