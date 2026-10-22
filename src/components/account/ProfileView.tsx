"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import { buildAchievements } from "@/lib/game/achievements";
import { levelInfo } from "@/lib/game/levels";
import { overallProgress, worldProgress } from "@/lib/game/progress";
import { useGame, usePlayer } from "@/lib/game/store";
import { useCatalog } from "@/components/game/GameProvider";
import { AVATAR_EMOJI, Avatar, Button, LinkButton, ProgressBar, SectionTitle } from "@/components/ui";

export function ProfileView() {
  const catalog = useCatalog();
  const player = usePlayer();
  const user = useGame((s) => s.user);
  const ready = useGame((s) => s.ready);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const achievements = useMemo(() => buildAchievements(catalog), [catalog]);
  const info = levelInfo(player.xp);
  const prog = overallProgress(catalog, player);

  if (!ready) return <div className="shimmer panel h-96" />;

  async function setAvatar(avatar: string) {
    if (!user) return;
    setSaving(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatar }) });
    if (res.ok) {
      const { user: u } = await res.json();
      useGame.setState({ user: u });
    }
    setSaving(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    useGame.getState().setSession(null, null);
    router.push("/");
  }

  const unlocked = new Set(player.achievements);

  return (
    <div className="space-y-12">
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <Avatar avatar={user?.avatar ?? "wizard"} size={88} />
          <div className="min-w-0 flex-1">
            <div className="font-pixel text-[10px] text-violet">LEVEL {info.level}</div>
            <h1 className="font-display text-3xl font-bold text-ink">{user?.username ?? "Guest Adventurer"}</h1>
            <div className="text-amber">{info.title}</div>
            <div className="mt-4 max-w-md">
              <div className="mb-1 flex justify-between text-xs text-dim">
                <span>{player.xp.toLocaleString()} XP</span>
                <span>
                  {info.current}/{info.needed} → LV {info.level + 1}
                </span>
              </div>
              <ProgressBar value={info.pct} color="#a78bfa" height={10} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { k: "Levels", v: `${prog.done}/${prog.total}` },
              { k: "Stars", v: prog.stars },
              { k: "Streak", v: `${player.streak}🔥` },
              { k: "Best streak", v: player.bestStreak },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-line bg-panel-2 px-4 py-2">
                <div className="font-mono text-lg font-semibold text-ink">{s.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-faint">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {user ? (
            <>
              <span className="text-xs text-dim">Avatar:</span>
              {Object.keys(AVATAR_EMOJI).map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={saving}
                  onClick={() => setAvatar(a)}
                  className={clsx("grid h-9 w-9 place-items-center rounded-lg border text-lg", user.avatar === a ? "border-cyan bg-cyan/10" : "border-line-2 hover:border-faint")}
                >
                  {AVATAR_EMOJI[a]}
                </button>
              ))}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={logout}>
                <LogOut size={14} /> Sign out
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-dim">Guest progress is stored only in this browser.</span>
              <LinkButton href="/login" size="sm" className="ml-auto">
                Create account to save it
              </LinkButton>
            </>
          )}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Campaign" title="World progress" />
        <div className="grid gap-3 md:grid-cols-2">
          {catalog.map((w) => {
            const p = worldProgress(w, player);
            return (
              <Link key={w.id} href={`/worlds/${w.id}`} className="panel flex items-center gap-4 p-4 transition hover:border-line-2">
                <span className="text-3xl">{w.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{w.title}</span>
                    <span className="font-mono text-xs text-dim">
                      {p.done}/{p.total} · {p.stars}★ {p.boss > 0 ? "· boss ✓" : ""}
                    </span>
                  </div>
                  <ProgressBar value={p.pct} color={w.color} height={6} className="mt-2" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Trophy room" title={`Achievements · ${unlocked.size}/${achievements.length}`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {achievements.map((a) => {
            const got = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                className={clsx("panel flex items-start gap-3 p-4 transition", got ? "border-amber/40 bg-amber/[0.05]" : "opacity-55")}
              >
                <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-2xl", got ? "border-amber/50 bg-amber/10" : "border-line-2 grayscale")}>
                  {got ? a.emoji : "🔒"}
                </span>
                <div className="min-w-0">
                  <div className={clsx("font-display text-sm font-semibold", got ? "text-ink" : "text-dim")}>{a.name}</div>
                  <div className="text-xs text-dim">{a.description}</div>
                  {a.xp > 0 && <div className="mt-1 text-[10px] text-cyan">+{a.xp} XP</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
