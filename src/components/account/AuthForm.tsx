"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { useGame } from "@/lib/game/store";
import { AVATAR_EMOJI, Button } from "@/components/ui";

const AVATARS = Object.keys(AVATAR_EMOJI);

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("wizard");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guestXp = useGame((s) => s.guest.xp);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { guest } = useGame.getState();
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, avatar, guest: guest.xp > 0 || Object.keys(guest.progress).length ? guest : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      const store = useGame.getState();
      store.setSession(data.user, data.state);
      store.clearGuest();
      store.toast({ kind: "info", emoji: "🎮", title: mode === "signup" ? `Welcome, ${data.user.username}!` : `Welcome back, ${data.user.username}!`, body: data.merged?.xpGained ? `Guest progress saved (+${data.merged.xpGained} XP merged).` : undefined });
      if (data.merged) store.announce({ ...data.merged, xpGained: 0 });
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel neon-border p-6 sm:p-8" style={{ "--accent": "#0891b2" } as React.CSSProperties}>
      <div className="mb-6 text-center">
        <div className="font-pixel text-[10px] tracking-widest text-cyan">{mode === "signup" ? "NEW GAME" : "CONTINUE"}</div>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">{mode === "signup" ? "Create your player" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-dim">
          {mode === "signup" ? "Save progress, keep your streak and join the leaderboard." : "Pick up where you left off."}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-xl border border-line-2 bg-panel p-1">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={clsx("rounded-lg py-2 text-sm font-medium transition", mode === m ? "bg-panel-3 text-ink" : "text-faint hover:text-ink")}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-dim">{mode === "signup" ? "Username" : "Username or email"}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={mode === "signup" ? 20 : 120}
            pattern={mode === "signup" ? "[a-zA-Z0-9_]+" : undefined}
            className="h-11 w-full rounded-xl border border-line-2 bg-panel px-3 text-ink outline-none focus:border-cyan/60"
            placeholder={mode === "signup" ? "letters, numbers, _" : "your username or email"}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-dim">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? 8 : 1}
            className="h-11 w-full rounded-xl border border-line-2 bg-panel px-3 text-ink outline-none focus:border-cyan/60"
            placeholder={mode === "signup" ? "at least 8 characters" : ""}
          />
        </label>
        {mode === "signup" && (
          <div>
            <span className="mb-1.5 block text-xs text-dim">Choose your avatar</span>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={clsx(
                    "grid aspect-square place-items-center rounded-xl border-2 text-xl transition",
                    avatar === a ? "border-cyan bg-cyan/10" : "border-line-2 bg-panel hover:border-faint",
                  )}
                  aria-label={a}
                >
                  {AVATAR_EMOJI[a]}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <div className="rounded-xl border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">{error}</div>}
        {guestXp > 0 && (
          <div className="rounded-xl border border-emerald/30 bg-emerald/[0.07] px-3 py-2 text-xs text-[#065f46]">
            Your {guestXp} guest XP and level progress will be merged into this account.
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Loading…" : mode === "signup" ? "Start my quest" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
