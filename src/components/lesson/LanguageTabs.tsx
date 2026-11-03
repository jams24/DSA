"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronLeft, ChevronRight, Copy, FileCode2, FolderTree, Hammer, Rocket, Search, Terminal } from "lucide-react";

// ---------- shared ----------

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-2 bg-panel text-dim hover:text-ink", className)}
      aria-label="Copy"
    >
      {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
    </button>
  );
}

export function OutputBox({ output, label = "Output" }: { output: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#1e293b] bg-[#0f172a]">
      <div className="flex items-center gap-2 border-b border-[#1e293b] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#94a3b8] uppercase">
        <Terminal size={12} /> {label}
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre text-[#e2e8f0]">{output.replace(/\n$/, "")}</pre>
    </div>
  );
}

// ---------- project build ----------

export interface RenderedProject {
  summaryHtml: string;
  skills: string[];
  treeHtml: string;
  extensions: string[];
  steps: {
    title: string;
    explainHtml: string;
    files: { path: string; lang: string; code: string; html: string }[];
    run?: string;
    runHtml?: string;
    output?: string;
  }[];
}

export function ProjectBuild({ project, storageKey, accent }: { project: RenderedProject; storageKey: string; accent: string }) {
  const [step, setStep] = useState(-1); // -1 = overview
  const [seen, setSeen] = useState<number[]>([]);
  const key = `dq-build:${storageKey}`;

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setSeen(JSON.parse(raw));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [key]);

  function open(i: number) {
    setStep(i);
    if (i >= 0 && !seen.includes(i)) {
      const next = [...seen, i];
      setSeen(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    }
    document.getElementById("build-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const total = project.steps.length;
  const s = step >= 0 ? project.steps[step] : null;

  return (
    <div className="space-y-5" id="build-top">
      <div className="panel p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs text-faint">
          <span className="flex items-center gap-1.5 font-semibold tracking-wider uppercase">
            <Hammer size={13} /> Build plan
          </span>
          <span>
            {seen.length}/{total} steps opened
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => open(-1)}
            className={clsx("shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition", step === -1 ? "border-[var(--accent)] bg-panel-3 text-ink" : "border-line-2 text-dim hover:text-ink")}
          >
            Overview
          </button>
          {project.steps.map((st, i) => (
            <button
              key={i}
              type="button"
              onClick={() => open(i)}
              title={st.title}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                step === i ? "border-[var(--accent)] bg-panel-3 text-ink" : "border-line-2 text-dim hover:text-ink",
              )}
            >
              <span
                className="grid h-4 w-4 place-items-center rounded text-[9px] font-bold"
                style={{ background: seen.includes(i) ? accent : "#e2e8f0", color: seen.includes(i) ? "#fff" : "#64748b" }}
              >
                {seen.includes(i) ? "✓" : i + 1}
              </span>
              <span className="max-w-[9rem] truncate">{st.title}</span>
            </button>
          ))}
        </div>
      </div>

      {!s && (
        <div className="space-y-5">
          <article className="prose-quest" dangerouslySetInnerHTML={{ __html: project.summaryHtml }} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel p-4">
              <h3 className="mb-3 font-display font-semibold text-ink">Skills you&apos;ll practice</h3>
              <ul className="space-y-1.5">
                {project.skills.map((k) => (
                  <li key={k} className="flex gap-2 text-sm text-[#334155]">
                    <span style={{ color: accent }}>◆</span>
                    {k}
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel min-w-0 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-ink">
                <FolderTree size={16} style={{ color: accent }} /> Finished project
              </h3>
              <div className="code-block overflow-x-auto text-[12px]" dangerouslySetInnerHTML={{ __html: project.treeHtml }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => open(0)}
            className="flex w-full items-center justify-between rounded-2xl border border-line-2 bg-panel-2 px-5 py-4 text-left transition hover:border-[var(--accent)]"
          >
            <span>
              <span className="block text-xs text-faint">Step 1 of {total}</span>
              <span className="font-display font-semibold text-ink">{project.steps[0].title}</span>
            </span>
            <ChevronRight className="text-dim" />
          </button>
        </div>
      )}

      {s && (
        <div className="space-y-5">
          <header>
            <div className="font-pixel text-[9px] tracking-widest" style={{ color: accent }}>
              STEP {step + 1} / {total}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">{s.title}</h2>
          </header>
          <article className="prose-quest" dangerouslySetInnerHTML={{ __html: s.explainHtml }} />
          {s.files.length > 0 && <FileTabs files={s.files} />}
          {s.run && s.runHtml && (
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Terminal size={15} style={{ color: accent }} /> Run it
                </span>
                <CopyBtn text={s.run} />
              </div>
              <div className="code-block overflow-x-auto p-3" dangerouslySetInnerHTML={{ __html: s.runHtml }} />
            </div>
          )}
          {s.output && <OutputBox output={s.output} label="You should see" />}

          {step === total - 1 && project.extensions.length > 0 && (
            <div className="panel neon-border p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display font-semibold text-ink">
                <Rocket size={16} style={{ color: accent }} /> It works. Now make it yours
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {project.extensions.map((x) => (
                  <li key={x} className="flex gap-2 text-sm text-[#334155]">
                    <span style={{ color: accent }}>◆</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
            <button type="button" onClick={() => open(step - 1)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-dim hover:bg-slate-900/5 hover:text-ink">
              <ChevronLeft size={16} /> {step === 0 ? "Overview" : "Previous step"}
            </button>
            {step < total - 1 && (
              <button
                type="button"
                onClick={() => open(step + 1)}
                className="ml-auto flex max-w-full items-center gap-2 rounded-xl border border-line-2 bg-panel-3 px-4 py-2 text-left text-sm text-ink transition hover:border-[var(--accent)]"
              >
                <span className="min-w-0 truncate">Step {step + 2}: {project.steps[step + 1].title}</span>
                <ChevronRight size={16} className="shrink-0" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FileTabs({ files }: { files: { path: string; lang: string; code: string; html: string }[] }) {
  const [i, setI] = useState(0);
  const f = files[Math.min(i, files.length - 1)];
  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-2 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-thin">
          {files.map((x, k) => (
            <button
              key={x.path}
              type="button"
              onClick={() => setI(k)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition",
                k === i ? "bg-panel-3 text-ink shadow-[inset_0_0_0_1px_#cbd5e1]" : "text-faint hover:text-ink",
              )}
            >
              <FileCode2 size={12} /> {x.path}
            </button>
          ))}
        </div>
        <CopyBtn text={f.code} />
      </header>
      <div className="code-block overflow-x-auto p-3" dangerouslySetInnerHTML={{ __html: f.html }} />
    </section>
  );
}

// ---------- toolbox ----------

export type RenderedToolbox = {
  category: string;
  blurb?: string;
  libs: { name: string; what: string; when: string; tag?: string; snippet?: { lang: string; code: string; html: string } }[];
}[];

const TAG_STYLE: Record<string, string> = {
  standard: "border-sky/40 bg-sky/10 text-sky",
  essential: "border-emerald/40 bg-emerald/10 text-emerald",
  popular: "border-violet/40 bg-violet/10 text-violet",
  rising: "border-amber/40 bg-amber/10 text-amber",
};
const TAG_LABEL: Record<string, string> = { standard: "built in", essential: "essential", popular: "popular", rising: "rising" };

export function Toolbox({ groups, accent }: { groups: RenderedToolbox; accent: string }) {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .filter((g) => cat === "all" || g.category === cat)
      .map((g) => ({
        ...g,
        libs: needle ? g.libs.filter((l) => `${l.name} ${l.what} ${l.when}`.toLowerCase().includes(needle)) : g.libs,
      }))
      .filter((g) => g.libs.length > 0);
  }, [groups, cat, q]);
  const count = groups.reduce((n, g) => n + g.libs.length, 0);

  return (
    <div className="space-y-6">
      <div className="panel space-y-3 p-3">
        <label className="flex items-center gap-2 rounded-xl border border-line-2 bg-panel px-3">
          <Search size={15} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${count} libraries…`}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...groups.map((g) => g.category)].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={clsx("rounded-lg border px-2.5 py-1 text-xs font-medium transition", cat === c ? "border-[var(--accent)] bg-panel-3 text-ink" : "border-line-2 text-dim hover:text-ink")}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && <p className="text-sm text-dim">Nothing matches “{q}”.</p>}

      {filtered.map((g) => (
        <section key={g.category}>
          <h3 className="font-display text-xl font-bold text-ink">{g.category}</h3>
          {g.blurb && <p className="mt-1 text-sm text-dim">{g.blurb}</p>}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {g.libs.map((l) => (
              <LibCard key={l.name} lib={l} accent={accent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LibCard({ lib, accent }: { lib: RenderedToolbox[number]["libs"][number]; accent: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="panel flex min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold [overflow-wrap:anywhere]" style={{ color: accent }}>
          {lib.name}
        </span>
        {lib.tag && <span className={clsx("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TAG_STYLE[lib.tag])}>{TAG_LABEL[lib.tag]}</span>}
      </div>
      <p className="mt-1.5 text-sm text-ink [overflow-wrap:anywhere]">{lib.what}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-dim [overflow-wrap:anywhere]">
        <span className="font-semibold text-[#334155]">When: </span>
        {lib.when}
      </p>
      {lib.snippet && (
        <div className="mt-3">
          <button type="button" onClick={() => setShow((x) => !x)} className="text-xs font-semibold hover:underline" style={{ color: accent }}>
            {show ? "Hide example" : "Show example"}
          </button>
          {show && <div className="code-block mt-2 overflow-x-auto rounded-lg border border-line p-2.5 text-[12px]" dangerouslySetInnerHTML={{ __html: lib.snippet.html }} />}
        </div>
      )}
    </div>
  );
}
