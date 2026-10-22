import type { Metadata } from "next";
import { Leaderboard } from "@/components/account/Leaderboard";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <SectionTitle eyebrow="Hall of fame" title="Leaderboard">
        XP is earned by clearing levels, defeating bosses, finishing daily challenges and battling in the Arena.
      </SectionTitle>
      <Leaderboard />
    </div>
  );
}
