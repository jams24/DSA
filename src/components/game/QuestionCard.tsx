"use client";

import { clsx } from "clsx";
import { Check, X } from "lucide-react";
import type { QuizQuestion } from "@/content/types";
import { InlineMd } from "@/components/ui";

export function QuestionCard({
  q,
  selected,
  revealed,
  onSelect,
  header,
  disabled,
}: {
  q: QuizQuestion;
  selected: number | null;
  revealed: boolean;
  onSelect: (i: number) => void;
  header?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      {header}
      <h3 className="font-display text-lg leading-snug font-semibold text-ink sm:text-xl">
        <InlineMd text={q.q} />
      </h3>
      <div className="mt-5 grid gap-2.5">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === selected;
          const state = !revealed ? (isPicked ? "picked" : "idle") : isAnswer ? "right" : isPicked ? "wrong" : "dim";
          return (
            <button
              key={i}
              type="button"
              disabled={revealed || disabled}
              onClick={() => onSelect(i)}
              className={clsx(
                "group flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
                state === "idle" && "border-line-2 bg-panel-2 hover:-translate-y-0.5 hover:border-cyan/60 hover:bg-panel-3",
                state === "picked" && "border-cyan bg-cyan/10",
                state === "right" && "border-emerald bg-emerald/10 shadow-[0_0_20px_-6px_#059669]",
                state === "wrong" && "animate-shake border-rose bg-rose/10",
                state === "dim" && "border-line bg-panel opacity-50",
              )}
            >
              <span
                className={clsx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg border font-pixel text-[9px]",
                  state === "right" ? "border-emerald bg-emerald text-[#ffffff]" : state === "wrong" ? "border-rose bg-rose text-[#ffffff]" : "border-line-2 text-dim",
                )}
              >
                {state === "right" ? <Check size={14} /> : state === "wrong" ? <X size={14} /> : String.fromCharCode(65 + i)}
              </span>
              <span className="text-[15px] text-[#334155]">
                <InlineMd text={opt} />
              </span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div
          className={clsx(
            "mt-4 animate-pop rounded-xl border px-4 py-3 text-sm",
            selected === q.answer ? "border-emerald/40 bg-emerald/[0.07] text-[#065f46]" : "border-amber/40 bg-amber/[0.07] text-[#92400e]",
          )}
        >
          <span className="mr-1 font-semibold">{selected === q.answer ? "Correct!" : selected === -1 ? "Time's up." : "Not quite."}</span>
          <InlineMd text={q.explain} />
        </div>
      )}
    </div>
  );
}
