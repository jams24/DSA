import { useId, useState } from "react";

export interface Section {
  title: string;
  content: React.ReactNode;
}

export default function Accordion({ sections, allowMultiple = false, defaultOpen = [] }: { sections: Section[]; allowMultiple?: boolean; defaultOpen?: number[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(defaultOpen));
  const id = useId();

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      {sections.map((s, i) => {
        const expanded = open.has(i);
        return (
          <div key={s.title}>
            <h3 style={{ margin: 0 }}>
              {/* a real <button> gives keyboard + screen reader support for free */}
              <button id={`${id}-h-${i}`} aria-expanded={expanded} aria-controls={`${id}-p-${i}`} onClick={() => toggle(i)} style={{ width: "100%", textAlign: "left" }}>
                {s.title} <span aria-hidden>{expanded ? "−" : "+"}</span>
              </button>
            </h3>
            <div id={`${id}-p-${i}`} role="region" aria-labelledby={`${id}-h-${i}`} hidden={!expanded}>
              {s.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
