import type { Metadata } from "next";
import { DailyChallenge } from "@/components/arena/DailyChallenge";

export const metadata: Metadata = { title: "Daily Challenge" };

export default function DailyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <DailyChallenge />
    </div>
  );
}
