"use client";

import { clsx } from "clsx";
import { Pencil, Play } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { SIM_LOADERS } from "@/content/sims";
import { fmt } from "@/lib/sim/build";
import { TraceLimit, Tracer, type Frame, type Sim } from "@/lib/sim/types";
import { Narration, SmallBtn, StepControls, useStepper } from "@/components/viz/kit";
import { PanelView } from "./Panels";

interface Run {
  frames: Frame[];
  answer?: unknown;
  error?: string;
  truncated?: boolean;
}

export function runSim(sim: Sim, args: unknown[]): Run {
  const t = new Tracer();
  try {
    const answer = (sim.run as (t: Tracer, ...a: unknown[]) => unknown)(t, ...structuredClone(args));
    return { frames: t.frames, answer };
  } catch (e) {
    if (e instanceof TraceLimit) return { frames: t.frames, truncated: true };
    return { frames: t.frames, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Loose shape check so custom input has the same kinds of values as the examples. */
function sameShape(v: unknown, like: unknown): boolean {
  if (like === null || v === null) return true;
  if (Array.isArray(like)) {
    if (!Array.isArray(v)) return false;
    const sample = like.find((x) => x !== null);
    return sample === undefined || v.every((x) => sameShape(x, sample));
  }
  return typeof v === typeof like;
}

const show = (v: unknown) => (typeof v === "string" ? JSON.stringify(v) : fmt(v));

export function SimPlayer({ slug, category }: { slug: string; category: string }) {
  const [sim, setSim] = useState<Sim | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = SIM_LOADERS[category];
    if (!load) return;
    load().then((m) => alive && setSim(m.SIMS[slug] ?? null));
    return () => {
      alive = false;
    };
  }, [slug, category]);

  if (sim === null) return null;
  if (!sim) return <div className="h-72 animate-pulse rounded-2xl border border-line bg-panel-2" />;
  return <Player key={slug} sim={sim} />;
}

function Player({ sim }: { sim: Sim }) {
  const uid = useId().replace(/:/g, "");
  const [pick, setPick] = useState(0);
  const [custom, setCustom] = useState<unknown[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const args = useMemo(() => custom ?? sim.cases[pick].slice(0, sim.params.length), [custom, pick, sim]);
  const run = useMemo(() => runSim(sim, args), [sim, args]);
  const s = useStepper(run.frames, 900);
  const f = s.frame;

  function startEdit() {
    setDraft(args.map((a) => JSON.stringify(a)));
    setErr(null);
    setEditing(true);
  }

  function apply() {
    try {
      const parsed = draft.map((d, i) => {
        if (d.length > 300) throw new Error(`${sim.params[i]} is too long for a step-by-step trace. Keep it small.`);
        const v: unknown = JSON.parse(d);
        if (!sameShape(v, sim.cases[0][i])) throw new Error(`${sim.params[i]} should look like ${JSON.stringify(sim.cases[0][i])}`);
        return v;
      });
      const r = runSim(sim, parsed);
      if (r.error && !r.frames.length) throw new Error(r.error);
      setCustom(parsed);
      setEditing(false);
      setErr(null);
    } catch (e) {
      setErr(e instanceof SyntaxError ? "That isn't valid JSON. Use the same format as the examples." : e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-line-2 bg-panel p-1">
          {sim.cases.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCustom(null);
                setEditing(false);
                setPick(i);
              }}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                !custom && pick === i ? "bg-panel-3 text-ink shadow-[inset_0_0_0_1px_#cbd5e1]" : "text-faint hover:text-ink",
              )}
            >
              Example {i + 1}
            </button>
          ))}
          {custom && <span className="rounded-lg bg-panel-3 px-3 py-1.5 text-xs font-medium text-ink shadow-[inset_0_0_0_1px_#cbd5e1]">Your input</span>}
        </div>
        <SmallBtn onClick={editing ? () => setEditing(false) : startEdit} tone={editing ? "default" : "primary"}>
          <Pencil size={13} /> {editing ? "Cancel" : "Try your own input"}
        </SmallBtn>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-xl border border-cyan/30 bg-cyan/[0.04] p-3">
          {sim.params.map((name, i) => (
            <label key={name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="w-28 shrink-0 font-mono text-xs font-semibold text-dim">{name}</span>
              <input
                value={draft[i] ?? ""}
                onChange={(e) => setDraft((d) => d.map((x, k) => (k === i ? e.target.value : x)))}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                spellCheck={false}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line-2 bg-panel px-2.5 font-mono text-xs text-ink outline-none focus:border-cyan/60"
              />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <SmallBtn onClick={apply} tone="primary">
              <Play size={13} /> Run it
            </SmallBtn>
            {err ? <span className="text-xs text-rose">{err}</span> : <span className="text-xs text-faint">JSON, same format as LeetCode. Small inputs trace best.</span>}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto font-mono text-xs whitespace-nowrap text-dim scrollbar-thin">
          {sim.params.map((name, i) => (
            <span key={name}>
              {i > 0 && <span className="text-faint">, </span>}
              <span className="text-faint">{name} = </span>
              <span className="text-ink">{show(args[i])}</span>
            </span>
          ))}
        </div>
      )}

      {f ? (
        <>
          <div className="flex flex-wrap gap-2.5">
            {f.panels.map((p, i) => (
              <PanelView key={`${p.kind}-${i}`} p={p} uid={`${uid}-${i}`} />
            ))}
          </div>
          <Narration tone={f.tone}>
            {f.note}
          </Narration>
          <StepControls s={s} />
        </>
      ) : null}
      {run.truncated && s.atEnd && <p className="text-xs text-amber">The trace stopped after {run.frames.length} steps. Try a smaller input to see it finish.</p>}
      {run.error && <p className="text-xs text-rose">{run.error}</p>}
    </div>
  );
}
