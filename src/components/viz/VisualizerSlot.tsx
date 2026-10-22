"use client";

import type { ArchDiagram } from "@/content/types";
import ArchitectureDiagram from "./ArchitectureDiagram";
import { VISUALIZERS } from "./registry";

function Frame({ title, blurb, onInteract, children }: { title: string; blurb: string; onInteract?: () => void; children: React.ReactNode }) {
  return (
    <section className="panel p-4 sm:p-6" onPointerDownCapture={onInteract} onKeyDownCapture={onInteract}>
      <header className="mb-5 flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-cyan shadow-[0_0_10px_#22d3ee]" />
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          <p className="text-sm text-dim">{blurb}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function VisualizerSlot({ id, onInteract }: { id: string; onInteract?: () => void }) {
  const entry = VISUALIZERS[id];
  if (!entry) return null;
  const Viz = entry.C;
  return (
    <Frame title={entry.title} blurb={entry.blurb} onInteract={onInteract}>
      <Viz />
    </Frame>
  );
}

export function DiagramSlot({ diagram, onInteract }: { diagram: ArchDiagram; onInteract?: () => void }) {
  return (
    <Frame title={diagram.title} blurb="Pick a flow and step through the request hop by hop." onInteract={onInteract}>
      <ArchitectureDiagram diagram={diagram} />
    </Frame>
  );
}
