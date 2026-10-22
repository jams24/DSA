"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Flame } from "lucide-react";
import { levelForXp } from "@/lib/game/levels";
import { useGame } from "@/lib/game/store";
import { Avatar } from "@/components/ui";
import { Segmented } from "@/components/viz/kit";

interface Row {
  rank: number;
  id: string;
  username: string;
  avatar: string;
  xp: number;
  streak: number;
}

export function Leaderboard() {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [data, setData] = useState<{ rows: Row[]; me: string | null; myRank: Row | null } | null>(null);
  const [error, setError] = useState(false);
  const user = useGame((s) => s.user);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => !cancel && setData(d))
      .catch(() => !cancel && setError(true));
    return () => {
      cancel = true;
    };
  }, [period, user?.id]);

  const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null);

  return (
    <div className="space-y-4">
      <Segmented
        value={period}
        onChange={(p) => {
          setData(null);
          setPeriod(p);
        }}
        options={[
          { value: "week", label: "This week" },
          { value: "all", label: "All time" },
        ]}
      />
      {!user && (
        <div className="rounded-xl border border-cyan/30 bg-cyan/[0.06] px-4 py-3 text-sm text-dim">
          Guests aren't ranked.{" "}
          <Link href="/login?next=/leaderboard" className="font-semibold text-cyan hover:underline">
            Create an account
          </Link>{" "}
          to put your name on the board.
        </div>
      )}
      <div className="panel overflow-hidden">
        {error && <div className="p-8 text-center text-dim">Couldn&apos;t load the leaderboard.</div>}
        {!data && !error && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="shimmer h-12 rounded-xl bg-panel-2" />
            ))}
          </div>
        )}
        {data && data.rows.length === 0 && <div className="p-10 text-center text-dim">No one has earned XP {period === "week" ? "this week" : "yet"}. Be the first!</div>}
        {data &&
          [...data.rows, ...(data.myRank ? [data.myRank] : [])].map((r, i) => {
            const me = r.id === data.me;
            return (
              <div
                key={`${r.id}-${i}`}
                className={clsx(
                  "flex items-center gap-4 border-b border-line px-4 py-3 last:border-0",
                  me && "bg-cyan/[0.07]",
                  data.myRank && r === data.myRank && "border-t-2 border-t-line-2",
                )}
              >
                <span className="w-8 text-center font-pixel text-xs text-dim">{medal(r.rank) ?? r.rank}</span>
                <Avatar avatar={r.avatar} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">
                    {r.username} {me && <span className="text-xs text-cyan">(you)</span>}
                  </div>
                  <div className="text-xs text-faint">{period === "all" ? `Level ${levelForXp(r.xp)}` : "XP earned in the last 7 days"}</div>
                </div>
                {r.streak > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange">
                    <Flame size={13} /> {r.streak}
                  </span>
                )}
                <span className="w-24 text-right font-mono font-semibold text-cyan">{r.xp.toLocaleString()} XP</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
