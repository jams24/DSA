import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { Difficulty } from "@/content/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-cyan to-sky text-[#03131a] font-semibold shadow-[0_4px_0_0_#0e7490,0_0_24px_-4px_rgb(34_211_238/0.6)] hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_0_#0e7490]",
  secondary:
    "bg-panel-3 text-ink border border-line-2 shadow-[0_4px_0_0_rgb(0_0_0/0.5)] hover:bg-[#1f2a50] hover:border-faint active:translate-y-[2px] active:shadow-[0_2px_0_0_rgb(0_0_0/0.5)]",
  ghost: "text-dim hover:text-ink hover:bg-white/5",
  danger:
    "bg-gradient-to-b from-rose to-pink text-[#2a0610] font-semibold shadow-[0_4px_0_0_#9f1239] active:translate-y-[2px] active:shadow-[0_2px_0_0_#9f1239]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-40",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function ProgressBar({
  value,
  color = "#22d3ee",
  className,
  height = 8,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-line", className)} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))`,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = "#22d3ee",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e2747" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Stars({ count, max = 3, size = 14, className }: { count: number; max?: number; size?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex gap-0.5", className)} aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
            fill={i < count ? "#fbbf24" : "#1e2747"}
            stroke={i < count ? "#f59e0b" : "#2a355d"}
            strokeWidth="1.2"
            style={i < count ? { filter: "drop-shadow(0 0 3px #fbbf24)" } : undefined}
          />
        </svg>
      ))}
    </span>
  );
}

const diffStyle: Record<Difficulty, { label: string; cls: string }> = {
  beginner: { label: "Beginner", cls: "text-emerald border-emerald/30 bg-emerald/10" },
  intermediate: { label: "Intermediate", cls: "text-amber border-amber/30 bg-amber/10" },
  advanced: { label: "Advanced", cls: "text-rose border-rose/30 bg-rose/10" },
};

export function DifficultyPill({ level }: { level: Difficulty }) {
  const d = diffStyle[level];
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[11px] font-medium", d.cls)}>{d.label}</span>;
}

export function Pill({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 rounded-full border border-line-2 bg-panel-2 px-2 py-0.5 text-[11px] text-dim", className)}
      style={style}
    >
      {children}
    </span>
  );
}

export const AVATAR_EMOJI: Record<string, string> = {
  wizard: "🧙",
  knight: "🛡️",
  ninja: "🥷",
  robot: "🤖",
  alien: "👾",
  dragon: "🐲",
  fox: "🦊",
  astronaut: "🧑‍🚀",
};

export function Avatar({ avatar, size = 36, className }: { avatar?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center rounded-xl border border-line-2 bg-gradient-to-br from-panel-3 to-panel", className)}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden
    >
      {AVATAR_EMOJI[avatar ?? ""] ?? "🧙"}
    </span>
  );
}

/** Minimal inline markdown: `code`, **bold**, *italic*. Used for quiz text on the client. */
export function InlineMd({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 1)
          return (
            <code key={i} className="rounded-md border border-violet/20 bg-violet/10 px-1 py-px font-mono text-[0.88em] text-[#d8ccff]">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("**") && p.endsWith("**") && p.length > 3)
          return (
            <strong key={i} className="font-semibold text-ink">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-cyan">{eyebrow}</div>}
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-dim">{children}</p>}
    </div>
  );
}
