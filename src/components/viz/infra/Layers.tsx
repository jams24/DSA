"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, Stat, StepControls, useStepper } from "../kit";

type File = "naive" | "ordered" | "multi";
type Change = "none" | "src" | "deps" | "base";
type Input = "base" | "deps" | "src" | "stage" | null;

interface Instr {
  text: string;
  input: Input;
  cost: number; // seconds when rebuilt
  size: number; // MB added to the image
  stage: 0 | 1;
}

const FILES: Record<File, Instr[]> = {
  naive: [
    { text: "FROM node:22", input: "base", cost: 20, size: 1100, stage: 0 },
    { text: "WORKDIR /app", input: null, cost: 0.1, size: 0, stage: 0 },
    { text: "COPY . .", input: "src", cost: 1, size: 60, stage: 0 },
    { text: "RUN npm ci", input: null, cost: 45, size: 310, stage: 0 },
    { text: "RUN npm run build", input: null, cost: 25, size: 40, stage: 0 },
    { text: 'CMD ["npm", "start"]', input: null, cost: 0, size: 0, stage: 0 },
  ],
  ordered: [
    { text: "FROM node:22", input: "base", cost: 20, size: 1100, stage: 0 },
    { text: "WORKDIR /app", input: null, cost: 0.1, size: 0, stage: 0 },
    { text: "COPY package.json package-lock.json ./", input: "deps", cost: 0.2, size: 1, stage: 0 },
    { text: "RUN npm ci", input: null, cost: 45, size: 310, stage: 0 },
    { text: "COPY . .", input: "src", cost: 1, size: 60, stage: 0 },
    { text: "RUN npm run build", input: null, cost: 25, size: 40, stage: 0 },
    { text: 'CMD ["npm", "start"]', input: null, cost: 0, size: 0, stage: 0 },
  ],
  multi: [
    { text: "FROM node:22 AS build", input: "base", cost: 20, size: 1100, stage: 0 },
    { text: "WORKDIR /app", input: null, cost: 0.1, size: 0, stage: 0 },
    { text: "COPY package.json package-lock.json ./", input: "deps", cost: 0.2, size: 1, stage: 0 },
    { text: "RUN npm ci", input: null, cost: 45, size: 310, stage: 0 },
    { text: "COPY . .", input: "src", cost: 1, size: 60, stage: 0 },
    { text: "RUN npm run build", input: null, cost: 25, size: 40, stage: 0 },
    { text: "FROM node:22-slim", input: "base", cost: 8, size: 230, stage: 1 },
    { text: "WORKDIR /app", input: null, cost: 0.1, size: 0, stage: 1 },
    { text: "COPY package.json package-lock.json ./", input: "deps", cost: 0.2, size: 1, stage: 1 },
    { text: "RUN npm ci --omit=dev", input: null, cost: 28, size: 120, stage: 1 },
    { text: "COPY --from=build /app/dist ./dist", input: "stage", cost: 0.3, size: 38, stage: 1 },
    { text: "USER node", input: null, cost: 0, size: 0, stage: 1 },
    { text: 'CMD ["node", "dist/server.js"]', input: null, cost: 0, size: 0, stage: 1 },
  ],
};

const CHANGES: { value: Change; label: string }[] = [
  { value: "none", label: "Nothing changed" },
  { value: "src", label: "Edited src/app.ts" },
  { value: "deps", label: "Added a dependency" },
  { value: "base", label: "Base image patched" },
];

interface Step {
  hit: boolean;
  why: string;
}

function build(file: File, change: Change): Step[] {
  const instrs = FILES[file];
  const missed = [false, false];
  return instrs.map((ins) => {
    let hit: boolean;
    let why: string;
    if (ins.input === "base") {
      hit = change !== "base";
      why = hit ? "Base image already in the local cache." : "The base image digest changed (security patch). It's pulled, and every layer built on top of it is now invalid.";
    } else if (missed[ins.stage]) {
      hit = false;
      why = `A layer above changed, so the cache for everything below it is invalid${ins.cost >= 20 ? `: ${ins.text.replace("RUN ", "")} runs again (${ins.cost} s)` : ""}. Order instructions from least to most frequently changing.`;
    } else if (ins.input === "deps") {
      hit = change !== "deps";
      why = hit ? "COPY checksums the files it copies: package.json and the lockfile are unchanged, so this is a cache hit." : "package.json and the lockfile changed, so this layer and everything after it rebuild. Expected: dependencies really changed.";
    } else if (ins.input === "src") {
      hit = change !== "src" && change !== "deps";
      why = hit
        ? "No file in the build context changed, so it's a cache hit."
        : file === "naive"
          ? "COPY . . includes every source file, so one edited line invalidates this layer and forces `npm ci` below it to reinstall all dependencies."
          : "Your edit changed the copied files, so this layer misses. Dependencies were installed above it and stay cached.";
    } else if (ins.input === "stage") {
      hit = !missed[0];
      why = hit ? "The build stage produced identical output, so this is a cache hit." : "The build stage produced new files in /app/dist, so the copy misses. Only the compiled output crosses into the runtime image, not the compilers or dev dependencies.";
    } else {
      hit = true;
      why = "Same instruction on the same parent layer: reused from cache.";
    }
    if (!hit) missed[ins.stage] = true;
    return { hit, why };
  });
}

function summarize(file: File, change: Change) {
  const steps = build(file, change);
  const instrs = FILES[file];
  const time = steps.reduce((a, s, i) => a + (s.hit ? 0 : instrs[i].cost), 0) + 0.5;
  const finalStage = file === "multi" ? 1 : 0;
  const size = instrs.filter((x) => x.stage === finalStage).reduce((a, x) => a + x.size, 0);
  return { time, size, rebuilt: steps.filter((s) => !s.hit).length };
}

export default function Layers() {
  const [file, setFile] = useState<File>("naive");
  const [change, setChange] = useState<Change>("src");
  const steps = useMemo(() => build(file, change), [file, change]);
  const s = useStepper(steps, 700, true);
  const instrs = FILES[file];
  const done = steps.slice(0, s.i + 1);
  const elapsed = done.reduce((a, st, i) => a + (st.hit ? 0 : instrs[i].cost), 0);
  const all = (Object.keys(FILES) as File[]).map((f) => ({ f, ...summarize(f, change) }));
  const finalStage = file === "multi" ? 1 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Segmented
          value={file}
          onChange={setFile}
          options={[
            { value: "naive", label: "Naive Dockerfile" },
            { value: "ordered", label: "Cache-friendly order" },
            { value: "multi", label: "Multi-stage" },
          ]}
        />
        <Segmented value={change} onChange={setChange} options={CHANGES} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-[#f8fafd] p-2">
        <div className="min-w-[480px] space-y-1">
          {instrs.map((ins, i) => {
            const st = steps[i];
            const shown = i <= s.i;
            const firstOfStage = file === "multi" && i > 0 && ins.stage !== instrs[i - 1].stage;
            return (
              <div key={i}>
                {firstOfStage && <div className="my-2 border-t border-dashed border-line-2 pt-1 text-[10px] text-faint">runtime stage: only this part ships</div>}
                <div
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 font-mono text-xs transition",
                    i === s.i && "ring-2 ring-cyan/40",
                    ins.stage !== finalStage && "opacity-70",
                  )}
                  style={{ background: shown ? (st.hit ? `${C.done}14` : `${C.compare}1a`) : "transparent" }}
                >
                  <span className="w-5 text-right text-faint">{i + 1}</span>
                  <span className="flex-1 text-ink">{ins.text}</span>
                  <span className="w-16 text-right text-faint">{ins.size ? `${ins.size} MB` : ""}</span>
                  <span
                    className="w-24 rounded-md px-2 py-0.5 text-center text-[10px] font-bold"
                    style={{
                      color: !shown ? C.faint : st.hit ? C.done : C.compare,
                      background: !shown ? "transparent" : st.hit ? `${C.done}1a` : `${C.compare}22`,
                    }}
                  >
                    {!shown ? "…" : st.hit ? "CACHED" : `BUILD ${ins.cost < 1 ? "<1" : ins.cost} s`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StepControls s={s} />
      <Narration tone={steps[s.i].hit ? "good" : "warn"}>
        <span className="font-semibold">Line {s.i + 1}. </span>
        {steps[s.i].why}
      </Narration>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="build time so far" value={`${elapsed.toFixed(1)} s`} color={C.compare} />
        <Stat label="layers rebuilt" value={done.filter((x) => !x.hit).length} />
        <Stat label="final image size" value={`${(instrs.filter((x) => x.stage === finalStage).reduce((a, x) => a + x.size, 0) / 1000).toFixed(2)} GB`} color={C.active} />
      </div>

      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">Same change, all three Dockerfiles</div>
        <table className="w-full text-left text-xs">
          <thead className="text-faint">
            <tr>
              <th className="py-1 font-medium">Dockerfile</th>
              <th className="py-1 text-right font-medium">rebuild time</th>
              <th className="py-1 text-right font-medium">layers rebuilt</th>
              <th className="py-1 text-right font-medium">image size</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {all.map((r) => (
              <tr key={r.f} className={clsx("border-t border-line", r.f === file && "font-semibold text-ink")}>
                <td className="py-1.5 font-sans">{r.f === "naive" ? "Naive" : r.f === "ordered" ? "Cache-friendly" : "Multi-stage"}</td>
                <td className="py-1.5 text-right">{r.time.toFixed(1)} s</td>
                <td className="py-1.5 text-right">{r.rebuilt}</td>
                <td className="py-1.5 text-right">{(r.size / 1000).toFixed(2)} GB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
