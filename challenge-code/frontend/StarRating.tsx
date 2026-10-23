import { useState } from "react";

/** Radio-group semantics: arrow keys change the value, and screen readers announce "3 of 5 stars". */
export default function StarRating({ value, onChange, max = 5, readOnly = false }: { value: number; onChange?: (v: number) => void; max?: number; readOnly?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const set = (v: number) => {
    if (!readOnly) onChange?.(Math.max(0, Math.min(max, v)));
  };

  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      aria-readonly={readOnly}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          set(value + 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          set(value - 1);
        }
      }}
    >
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        return (
          <span
            key={star}
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            // roving tabindex: only the selected star (or the first, if none) is a tab stop
            tabIndex={readOnly ? -1 : star === (value || 1) ? 0 : -1}
            onClick={() => set(star === value ? 0 : star)} // clicking the current value clears it
            onMouseEnter={() => !readOnly && setHover(star)}
            style={{ cursor: readOnly ? "default" : "pointer", fontSize: 28, color: star <= shown ? "#f5a524" : "#ccc" }}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
