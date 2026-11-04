"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, SmallBtn, Stat, TextInput } from "../kit";

type Labels = Record<string, string>;
type Op = "=" | "!=" | "in" | "notin" | "exists" | "!exists";
interface Req {
  key: string;
  op: Op;
  values: string[];
}

const START: { name: string; labels: Labels }[] = [
  { name: "shop-web-1", labels: { app: "shop", tier: "web", env: "prod", version: "v1" } },
  { name: "shop-web-2", labels: { app: "shop", tier: "web", env: "prod", version: "v2" } },
  { name: "shop-web-3", labels: { app: "shop", tier: "web", env: "prod", version: "v2", canary: "true" } },
  { name: "shop-db-0", labels: { app: "shop", tier: "db", env: "prod" } },
  { name: "shop-web-s1", labels: { app: "shop", tier: "web", env: "staging", version: "v2" } },
  { name: "blog-web-1", labels: { app: "blog", tier: "web", env: "prod" } },
  { name: "blog-web-2", labels: { app: "blog", tier: "web", env: "staging" } },
  { name: "debug", labels: { run: "debug" } },
];

const PRESETS: { label: string; sel: string; why: string }[] = [
  {
    label: "Service shop",
    sel: "app=shop,tier=web",
    why: "A Service sends traffic to every Ready pod that has ALL of these labels. The version doesn't matter, which is why a Service keeps working while a rollout swaps v1 for v2.",
  },
  {
    label: "ReplicaSet shop-v2",
    sel: "app=shop,version=v2",
    why: "A ReplicaSet counts the pods its selector matches and creates or deletes pods to reach its replica count. Deployments add pod-template-hash to keep each ReplicaSet's pods apart.",
  },
  {
    label: "Only prod",
    sel: "env=prod",
    why: "Equality-based: the label must exist and have exactly this value. kubectl get pods -l env=prod.",
  },
  {
    label: "Set-based",
    sel: "env in (prod,staging),tier notin (db)",
    why: "in and notin test a set of values. Note that notin (and !=) also match pods that don't have the key at all: debug has no tier label, but it's excluded here only because it has no env.",
  },
  {
    label: "No canaries",
    sel: "app=shop,!canary",
    why: "!key matches pods that don't have the label at all. A common trick: label a pod canary=true to keep it out of a selector.",
  },
  {
    label: "Has a version",
    sel: "version",
    why: "A bare key means the label exists, whatever its value.",
  },
  {
    label: "Typo",
    sel: "app=shpo",
    why: "Nothing matches, and nothing complains. A Service with this selector has no endpoints: the classic bug from the debugging lesson. Check with kubectl get endpointslices.",
  },
];

/** Parse a kubectl -l selector: k=v, k==v, k!=v, k in (a,b), k notin (a,b), k, !k (comma = AND). */
function parse(s: string): Req[] | string {
  if (!s.trim()) return [];
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  const key = "([A-Za-z0-9][A-Za-z0-9._/-]*)";
  const reqs: Req[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    let m: RegExpExecArray | null;
    if (!p) return "an empty requirement (two commas in a row?)";
    if ((m = new RegExp(`^${key}\\s+(in|notin)\\s*\\(([^)]*)\\)$`).exec(p))) {
      const values = m[3].split(",").map((v) => v.trim()).filter(Boolean);
      if (!values.length) return `"${p}" needs at least one value`;
      reqs.push({ key: m[1], op: m[2] as Op, values });
    } else if ((m = new RegExp(`^${key}\\s*(==|=|!=)\\s*([A-Za-z0-9._-]*)$`).exec(p))) {
      reqs.push({ key: m[1], op: m[2] === "!=" ? "!=" : "=", values: [m[3]] });
    } else if ((m = new RegExp(`^!\\s*${key}$`).exec(p))) {
      reqs.push({ key: m[1], op: "!exists", values: [] });
    } else if ((m = new RegExp(`^${key}$`).exec(p))) {
      reqs.push({ key: m[1], op: "exists", values: [] });
    } else return `can't parse "${p}"`;
  }
  return reqs;
}

function matches(r: Req, labels: Labels): boolean {
  const v = labels[r.key];
  switch (r.op) {
    case "=":
      return v === r.values[0];
    case "!=":
      return v !== r.values[0];
    case "in":
      return v !== undefined && r.values.includes(v);
    case "notin":
      return v === undefined || !r.values.includes(v);
    case "exists":
      return v !== undefined;
    case "!exists":
      return v === undefined;
  }
}

export default function LabelsViz() {
  const [pods, setPods] = useState(START);
  const [sel, setSel] = useState(PRESETS[0].sel);
  const [note, setNote] = useState<{ text: string; tone: "info" | "warn" }>({ text: PRESETS[0].why, tone: "info" });
  const reqs = useMemo(() => parse(sel), [sel]);
  const error = typeof reqs === "string" ? reqs : null;
  const keys = new Set(typeof reqs === "string" ? [] : reqs.map((r) => r.key));
  const hit = (labels: Labels) => typeof reqs !== "string" && reqs.every((r) => matches(r, labels));
  const matched = pods.filter((p) => hit(p.labels));

  const unlabel = (name: string, key: string) => {
    const before = pods.find((p) => p.name === name)!;
    const after = { ...before.labels };
    delete after[key];
    setPods((ps) => ps.map((p) => (p.name === name ? { ...p, labels: after } : p)));
    const was = hit(before.labels);
    const now = hit(after);
    setNote({
      tone: was !== now ? "warn" : "info",
      text:
        `$ kubectl label pod ${name} ${key}-   ` +
        (was && !now
          ? `${name} no longer matches the selector. If this were a Service, it would stop getting traffic; if a ReplicaSet, it would count one pod fewer and create a replacement, leaving this pod running on its own (handy for debugging a pod out of rotation).`
          : !was && now
            ? `${name} now matches: removing a label can add a pod to a selector that uses != , notin or !key.`
            : `Labels are just key/value pairs on the object; changing them is instant, and every selector re-evaluates.`),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="matched" value={error ? "–" : `${matched.length}/${pods.length}`} color={error ? C.bad : C.active} />
        <Stat label="requirements" value={error ? "–" : (reqs as Req[]).length} />
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <SmallBtn
            onClick={() => {
              setPods(START);
              setNote({ text: "Labels reset.", tone: "info" });
            }}
            className="h-full w-full justify-center"
          >
            reset labels
          </SmallBtn>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setSel(p.sel);
              setNote({ text: p.why, tone: "info" });
            }}
            className={clsx(
              "h-7 rounded-md border px-2 text-[11px] font-medium transition",
              sel === p.sel ? "border-cyan bg-cyan/10 text-cyan" : "border-line-2 text-dim hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-faint">kubectl get pods -l</span>
        <TextInput value={sel} onChange={setSel} placeholder="app=shop,tier!=db" width="w-full sm:w-80" className="min-w-0 flex-1" />
      </div>
      {error && <Narration tone="bad">Invalid selector: {error}</Narration>}

      <div className="grid gap-2 sm:grid-cols-2">
        {pods.map((p) => {
          const on = !error && hit(p.labels);
          return (
            <div
              key={p.name}
              className={clsx("min-w-0 rounded-xl border-2 p-2.5 transition", on ? "border-cyan bg-cyan/[0.06]" : "border-line bg-panel opacity-70")}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs font-semibold text-ink">{p.name}</span>
                <span className={clsx("shrink-0 text-[10px] font-semibold uppercase", on ? "text-cyan" : "text-faint")}>{on ? "selected" : "not selected"}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(p.labels).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    title={`kubectl label pod ${p.name} ${k}-`}
                    onClick={() => unlabel(p.name, k)}
                    className={clsx(
                      "rounded border px-1.5 py-0.5 font-mono text-[10.5px] transition hover:line-through",
                      keys.has(k) ? "border-amber/60 bg-amber/10 text-ink" : "border-line-2 text-dim",
                    )}
                  >
                    {k}={v}
                  </button>
                ))}
                {Object.keys(p.labels).length === 0 && <span className="text-[11px] text-faint">no labels</span>}
              </div>
            </div>
          );
        })}
      </div>

      <Narration tone={note.tone}>{note.text}</Narration>
      <p className="text-xs text-faint">Click a label to remove it from that pod. Labels used by the selector are highlighted. Comma means AND; there is no OR.</p>
    </div>
  );
}
