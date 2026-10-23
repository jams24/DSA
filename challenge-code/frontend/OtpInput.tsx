import { useRef, useState } from "react";

export default function OtpInput({ length = 6, onComplete }: { length?: number; onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => inputs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const update = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== "")) onComplete(next.join(""));
  };

  // Writing from position i lets typing, autofill and paste share one code path.
  const fill = (i: number, text: string) => {
    const chars = text.replace(/\D/g, "").slice(0, length - i).split("");
    if (chars.length === 0) return;
    const next = [...digits];
    chars.forEach((c, k) => (next[i + k] = c));
    update(next);
    focus(i + chars.length);
  };

  return (
    <div role="group" aria-label="One-time code" style={{ display: "flex", gap: 8 }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"} // lets iOS/Android offer the SMS code
          aria-label={`Digit ${i + 1}`}
          maxLength={length} // >1 so autofill can drop the whole code into the first box
          style={{ width: 40, textAlign: "center", fontSize: 24 }}
          onFocus={(e) => e.target.select()}
          onChange={(e) => fill(i, e.target.value.slice(d ? 1 : 0) || e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            fill(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              const next = [...digits];
              if (next[i]) next[i] = "";
              else if (i > 0) {
                next[i - 1] = "";
                focus(i - 1);
              }
              setDigits(next);
            } else if (e.key === "ArrowLeft") focus(i - 1);
            else if (e.key === "ArrowRight") focus(i + 1);
          }}
        />
      ))}
    </div>
  );
}
