"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { Flame, Menu, Volume2, VolumeX, X } from "lucide-react";
import { useGame, usePlayer } from "@/lib/game/store";
import { levelInfo } from "@/lib/game/levels";
import { Avatar, buttonClass } from "@/components/ui";

const NAV = [
  { href: "/worlds", label: "Worlds" },
  { href: "/arena", label: "Arena" },
  { href: "/questions", label: "Question Bank" },
  { href: "/cheatsheets", label: "Cheat Sheets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-cyan/40 bg-gradient-to-br from-cyan/25 to-violet/25 shadow-[0_0_18px_-4px_#22d3ee]">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="M5 4h6a6 6 0 0 1 0 12H8v4H5z" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="11" cy="10" r="2" fill="#f472b6" />
          <path d="M15 17l4 4" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="hidden leading-none min-[420px]:block">
        <span className="block font-pixel text-[11px] tracking-wider whitespace-nowrap text-ink">DSA QUEST</span>
        <span className="mt-1 block text-[10px] tracking-wide text-faint">interview RPG</span>
      </span>
    </Link>
  );
}

function PlayerChip() {
  const ready = useGame((s) => s.ready);
  const user = useGame((s) => s.user);
  const player = usePlayer();
  const info = levelInfo(player.xp);

  if (!ready) return <div className="shimmer h-10 w-44 rounded-xl bg-panel-2" />;

  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          "hidden items-center gap-1 rounded-xl border px-2.5 py-2 text-sm font-semibold sm:flex",
          player.streak > 0 ? "border-orange/40 bg-orange/10 text-orange" : "border-line bg-panel-2 text-faint",
        )}
        title={`${player.streak}-day streak`}
      >
        <Flame size={16} className={player.streak > 0 ? "fill-orange/60" : ""} />
        {player.streak}
      </div>
      <Link
        href="/profile"
        className="flex items-center gap-2.5 rounded-xl border border-line-2 bg-panel-2 py-1 pr-3 pl-1 transition hover:border-cyan/50"
      >
        <Avatar avatar={user?.avatar ?? "wizard"} size={32} />
        <div className="w-24">
          <div className="flex items-baseline justify-between">
            <span className="font-pixel text-[9px] text-amber">LV {info.level}</span>
            <span className="text-[10px] text-faint">{player.xp} XP</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-all duration-700" style={{ width: `${info.pct}%` }} />
          </div>
        </div>
      </Link>
      {!user && (
        <span className="hidden md:block">
          <Link href="/login" className={buttonClass("primary", "sm")}>
            Save progress
          </Link>
        </span>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const sound = useGame((s) => s.sound);
  const toggleSound = useGame((s) => s.toggleSound);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-white/[0.06] text-ink" : "text-dim hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="grid h-10 w-10 place-items-center rounded-xl text-dim transition hover:bg-white/5 hover:text-ink"
            aria-label={sound ? "Mute sound effects" : "Enable sound effects"}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <PlayerChip />
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-dim hover:bg-white/5 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-bg/95 px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-dim hover:bg-white/5 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
          <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-dim hover:bg-white/5 hover:text-ink">
            Profile & achievements
          </Link>
          <Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-cyan hover:bg-white/5 md:hidden">
            Sign in / save progress
          </Link>
        </nav>
      )}
    </header>
  );
}
