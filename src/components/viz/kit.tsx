"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Shared palette so every visualizer speaks the same visual language. */
export const C = {
  base: "#2a355d",
  baseFill: "#18213f",
  active: "#22d3ee",
  compare: "#fbbf24",
  swap: "#f472b6",
  done: "#34d399",
  pivot: "#a78bfa",
  bad: "#fb7185",
  dim: "#1e2747",
  text: "#e8ebf7",
  muted: "#9aa2c4",
  faint: "#636c93",
  lime: "#a3e635",
  orange: "#fb923c",
  sky: "#38bdf8",
} as const;

export interface Stepper<F> {
  i: number;
  frame: F;
  total: number;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  setSpeed: (s: number) => void;
  setI: (i: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

/** Steps through precomputed animation frames. Frames change identity => restart (and optionally auto-play). */
export function useStepper<F>(frames: F[], baseMs = 650, autoPlay = false): Stepper<F> {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seen, setSeen] = useState(frames);
  if (seen !== frames) {
    setSeen(frames);
    setI(0);
    setPlaying(autoPlay && frames.length > 1);
  }
  const last = Math.max(0, frames.length - 1);

  useEffect(() => {
    if (!playing) return;
    if (i >= last) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => Math.min(x + 1, last)), baseMs / speed);
    return () => clearTimeout(t);
  }, [playing, i, last, speed, baseMs]);

  return {
    i: Math.min(i, last),
    frame: frames[Math.min(i, last)],
    total: frames.length,
    playing,
    speed,
    atEnd: i >= last,
    setSpeed,
    setI: (n) => {
      setPlaying(false);
      setI(Math.max(0, Math.min(last, n)));
    },
    toggle: () => {
      if (i >= last) setI(0);
      setPlaying((p) => !p);
    },
    next: () => {
      setPlaying(false);
      setI((x) => Math.min(x + 1, last));
    },
    prev: () => {
      setPlaying(false);
      setI((x) => Math.max(x - 1, 0));
    },
    reset: () => {
      setPlaying(false);
      setI(0);
    },
  };
}

export function IconBtn({
  onClick,
  label,
  children,
  active,
  disabled,
  className,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-lg border transition disabled:opacity-30",
        active ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-line-2 bg-panel-3 text-dim hover:border-faint hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StepControls<F>({ s, onShuffle }: { s: Stepper<F>; onShuffle?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <IconBtn onClick={s.reset} label="Restart">
        <RotateCcw size={15} />
      </IconBtn>
      <IconBtn onClick={s.prev} label="Step back" disabled={s.i === 0}>
        <ChevronLeft size={17} />
      </IconBtn>
      <button
        type="button"
        onClick={s.toggle}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-cyan to-sky px-4 text-sm font-semibold text-[#03131a] shadow-[0_3px_0_0_#0e7490] active:translate-y-px"
      >
        {s.playing ? <Pause size={15} /> : <Play size={15} />}
        {s.playing ? "Pause" : s.atEnd && s.total > 1 ? "Replay" : "Play"}
      </button>
      <IconBtn onClick={s.next} label="Step forward" disabled={s.atEnd}>
        <ChevronRight size={17} />
      </IconBtn>
      {onShuffle && (
        <IconBtn onClick={onShuffle} label="New random input">
          <Shuffle size={15} />
        </IconBtn>
      )}
      <input
        type="range"
        className="neon-range mx-1 min-w-24 flex-1"
        min={0}
        max={Math.max(0, s.total - 1)}
        value={s.i}
        onChange={(e) => s.setI(Number(e.target.value))}
        aria-label="Scrub through steps"
      />
      <span className="w-16 text-right font-mono text-xs text-faint tabular-nums">
        {s.i + 1}/{s.total}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-line-2">
        {[0.5, 1, 2, 4].map((sp) => (
          <button
            key={sp}
            type="button"
            onClick={() => s.setSpeed(sp)}
            className={clsx("px-2 py-1.5 text-[11px] font-medium", s.speed === sp ? "bg-cyan/20 text-cyan" : "text-faint hover:text-ink")}
          >
            {sp}×
          </button>
        ))}
      </div>
    </div>
  );
}

export function Narration({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "good" | "bad" | "warn" }) {
  const toneCls = {
    info: "border-cyan/30 bg-cyan/[0.06]",
    good: "border-emerald/40 bg-emerald/[0.08]",
    bad: "border-rose/40 bg-rose/[0.08]",
    warn: "border-amber/40 bg-amber/[0.08]",
  }[tone];
  return (
    <div className={clsx("min-h-[3rem] rounded-xl border px-4 py-2.5 text-sm leading-relaxed text-[#d5dbf0]", toneCls)}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-dim">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color, boxShadow: `0 0 6px ${it.color}` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex flex-wrap rounded-xl border border-line-2 bg-panel p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            value === o.value ? "bg-panel-3 text-ink shadow-[inset_0_0_0_1px_#2a355d]" : "text-faint hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex min-w-40 flex-1 flex-col gap-1.5">
      <span className="flex justify-between text-xs text-dim">
        <span>{label}</span>
        <span className="font-mono text-ink tabular-nums">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        className="neon-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function SmallBtn({
  onClick,
  children,
  tone = "default",
  disabled,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "primary" | "danger" | "good";
  disabled?: boolean;
  className?: string;
}) {
  const t = {
    default: "border-line-2 bg-panel-3 text-ink hover:border-faint",
    primary: "border-cyan/50 bg-cyan/15 text-cyan hover:bg-cyan/25",
    danger: "border-rose/50 bg-rose/10 text-rose hover:bg-rose/20",
    good: "border-emerald/50 bg-emerald/10 text-emerald hover:bg-emerald/20",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition disabled:opacity-30", t, className)}
    >
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  onEnter,
  width = "w-40",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  width?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      placeholder={placeholder}
      className={clsx(
        "h-8 rounded-lg border border-line-2 bg-panel px-2.5 font-mono text-xs text-ink outline-none placeholder:text-faint focus:border-cyan/60",
        width,
        className,
      )}
    />
  );
}

export function Stat({ label, value, color = C.text }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function randomInts(n: number, lo = 5, hi = 99): number[] {
  return Array.from({ length: n }, () => lo + Math.floor(Math.random() * (hi - lo + 1)));
}

export function parseNums(s: string, max = 16): number[] | null {
  const nums = s
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (!nums.length || nums.some((n) => !Number.isFinite(n))) return null;
  return nums.slice(0, max).map((n) => Math.round(n));
}

/**
 * Drives a real-time simulation: `step(dtMs, nowMs)` mutates refs every animation frame,
 * and the component re-renders at roughly `fps`.
 */
export function useSimLoop(running: boolean, step: (dt: number, now: number) => void, fps = 30) {
  const stepRef = useRef(step);
  useLayoutEffect(() => {
    stepRef.current = step;
  });
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min(100, t - last);
      last = t;
      acc += dt;
      stepRef.current(dt, t);
      if (acc >= 1000 / fps) {
        acc = 0;
        force((x) => x + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, fps]);
}

export function PlayPause({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-cyan to-sky px-4 text-sm font-semibold text-[#03131a] shadow-[0_3px_0_0_#0e7490] active:translate-y-px"
    >
      {running ? <Pause size={15} /> : <Play size={15} />}
      {running ? "Pause" : "Run simulation"}
    </button>
  );
}
