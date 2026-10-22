"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Catalog } from "@/content/types";
import type { ActionRequest } from "@/lib/api-schemas";
import { setSoundEnabled, sfx } from "@/lib/sound";
import { buildAchievements } from "./achievements";
import { applyAction, emptyState, type GameAction, type Outcome, type PlayerState } from "./engine";

export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
}

export interface Toast {
  id: number;
  kind: "xp" | "achievement" | "info" | "error";
  title: string;
  body?: string;
  emoji?: string;
}

interface GameStore {
  ready: boolean;
  catalog: Catalog;
  user: PublicUser | null;
  remote: PlayerState | null;
  guest: PlayerState;
  sound: boolean;
  toasts: Toast[];
  levelUp: { from: number; to: number } | null;

  setCatalog: (c: Catalog) => void;
  setSession: (user: PublicUser | null, state: PlayerState | null) => void;
  setReady: () => void;
  play: (request: ActionRequest, local: GameAction) => Promise<Outcome | null>;
  announce: (o: Outcome) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  clearLevelUp: () => void;
  toggleSound: () => void;
  clearGuest: () => void;
}

let toastId = 0;

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ready: false,
      catalog: [],
      user: null,
      remote: null,
      guest: emptyState(),
      sound: true,
      toasts: [],
      levelUp: null,

      setCatalog: (catalog) => set({ catalog }),
      setSession: (user, state) => set({ user, remote: user ? state : null }),
      setReady: () => set({ ready: true }),

      async play(request, local) {
        const { user, catalog } = get();
        let outcome: Outcome;
        if (user) {
          try {
            const res = await fetch("/api/action", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(request),
            });
            if (res.status === 401) {
              set({ user: null, remote: null });
              get().toast({ kind: "error", title: "Session expired", body: "Sign in again to keep saving progress." });
              return null;
            }
            const data = await res.json();
            if (!res.ok) {
              get().toast({ kind: "error", title: "Couldn't save", body: data.error ?? "Something went wrong" });
              return null;
            }
            outcome = data.outcome;
            set({ remote: outcome.state });
          } catch {
            get().toast({ kind: "error", title: "Offline?", body: "Progress could not be saved. Check your connection." });
            return null;
          }
        } else {
          outcome = applyAction(get().guest, local, catalog);
          set({ guest: outcome.state });
        }
        get().announce(outcome);
        return outcome;
      },

      announce(o) {
        const { toast, catalog } = get();
        if (o.xpGained > 0) {
          sfx.xp();
          toast({ kind: "xp", title: `+${o.xpGained} XP`, emoji: "✨" });
        }
        if (o.newAchievements.length) {
          const defs = buildAchievements(catalog);
          o.newAchievements.forEach((id, i) => {
            const a = defs.find((d) => d.id === id);
            if (!a) return;
            setTimeout(() => {
              sfx.achievement();
              toast({ kind: "achievement", title: a.name, body: a.description, emoji: a.emoji });
            }, 400 + i * 700);
          });
        }
        if (o.levelUp) setTimeout(() => set({ levelUp: o.levelUp }), 300);
      },

      toast(t) {
        const id = ++toastId;
        set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }));
        setTimeout(() => get().dismiss(id), t.kind === "achievement" ? 5200 : 3200);
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      clearLevelUp: () => set({ levelUp: null }),
      toggleSound: () =>
        set((s) => {
          setSoundEnabled(!s.sound);
          return { sound: !s.sound };
        }),
      clearGuest: () => set({ guest: emptyState() }),
    }),
    {
      name: "dsa-quest",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ guest: s.guest, sound: s.sound }),
      skipHydration: true,
      onRehydrateStorage: () => (s) => {
        if (s) setSoundEnabled(s.sound);
      },
    },
  ),
);

/** The active player's state: the account when signed in, otherwise local guest progress. */
export function usePlayer(): PlayerState {
  return useGame((s) => (s.user && s.remote ? s.remote : s.guest));
}

export function playerSnapshot(): PlayerState {
  const s = useGame.getState();
  return s.user && s.remote ? s.remote : s.guest;
}
