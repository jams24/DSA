"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Catalog } from "@/content/types";
import { useGame } from "@/lib/game/store";

const CatalogContext = createContext<Catalog>([]);

export function useCatalog() {
  return useContext(CatalogContext);
}

export function GameProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  useEffect(() => {
    const store = useGame.getState();
    store.setCatalog(catalog);
    void useGame.persist.rehydrate();
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (!cancelled) store.setSession(d.user ?? null, d.state ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) useGame.getState().setReady();
      });
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
