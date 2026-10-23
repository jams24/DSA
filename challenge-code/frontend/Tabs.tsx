import { useId, useRef, useState } from "react";

export interface Tab {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

/** WAI-ARIA tabs: one tab stop for the whole tablist (roving tabindex); arrows move between tabs. */
export default function Tabs({ tabs, defaultIndex = 0 }: { tabs: Tab[]; defaultIndex?: number }) {
  const [selected, setSelected] = useState(defaultIndex);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const move = (from: number, step: number) => {
    // skip disabled tabs, wrapping around the ends
    for (let i = 1; i <= tabs.length; i++) {
      const next = (from + step * i + tabs.length * i) % tabs.length;
      if (!tabs[next].disabled) {
        setSelected(next);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(i, 1),
      ArrowLeft: () => move(i, -1),
      Home: () => move(-1, 1),
      End: () => move(tabs.length, -1),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Sections">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === selected}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => setSelected(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        // Render every panel but hide the inactive ones, so their state survives switching tabs.
        <div key={t.label} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== selected} tabIndex={0}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
