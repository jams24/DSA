"use client";

import { useMemo, useState } from "react";
import { C, Narration, Segmented, Slider, StepControls, useStepper } from "../kit";

// CPU scheduling on one core, one time unit per frame: FCFS, SJF, SRTF, Priority and Round Robin.
type Algo = "fcfs" | "sjf" | "srtf" | "prio" | "rr";
interface Job {
  name: string;
  arrival: number;
  burst: number;
  prio: number;
}
const WORKLOADS: Record<string, { label: string; jobs: Job[]; note: string }> = {
  textbook: {
    label: "Textbook",
    note: "The worked example from the lesson.",
    jobs: [
      { name: "P1", arrival: 0, burst: 7, prio: 3 },
      { name: "P2", arrival: 2, burst: 4, prio: 1 },
      { name: "P3", arrival: 4, burst: 1, prio: 4 },
      { name: "P4", arrival: 5, burst: 4, prio: 2 },
    ],
  },
  convoy: {
    label: "Convoy",
    note: "One long job arrives just before three short ones: watch FCFS suffer.",
    jobs: [
      { name: "Big", arrival: 0, burst: 10, prio: 2 },
      { name: "A", arrival: 1, burst: 1, prio: 1 },
      { name: "B", arrival: 1, burst: 1, prio: 1 },
      { name: "C", arrival: 2, burst: 2, prio: 1 },
    ],
  },
  starve: {
    label: "Starvation",
    note: "A low-priority job keeps losing to newcomers under Priority scheduling.",
    jobs: [
      { name: "Low", arrival: 0, burst: 3, prio: 5 },
      { name: "H1", arrival: 0, burst: 3, prio: 1 },
      { name: "H2", arrival: 3, burst: 3, prio: 1 },
      { name: "H3", arrival: 6, burst: 3, prio: 1 },
      { name: "H4", arrival: 9, burst: 3, prio: 1 },
    ],
  },
};
const COLORS = [C.active, C.pivot, C.compare, C.swap, C.lime, C.sky];
const ALGOS: { value: Algo; label: string }[] = [
  { value: "fcfs", label: "FCFS" },
  { value: "sjf", label: "SJF" },
  { value: "srtf", label: "SRTF" },
  { value: "prio", label: "Priority" },
  { value: "rr", label: "Round robin" },
];

interface Frame {
  t: number;
  timeline: (string | null)[];
  queue: string[];
  running: string | null;
  left: Record<string, number>;
  note: string;
}

function simulate(jobs: Job[], algo: Algo, quantum: number): Frame[] {
  const left: Record<string, number> = Object.fromEntries(jobs.map((j) => [j.name, j.burst]));
  const byName = Object.fromEntries(jobs.map((j) => [j.name, j]));
  const queue: string[] = [];
  const timeline: (string | null)[] = [];
  const frames: Frame[] = [];
  let current: string | null = null;
  let used = 0;
  const key = (n: string) => (algo === "sjf" ? byName[n].burst : algo === "srtf" ? left[n] : algo === "prio" ? byName[n].prio : byName[n].arrival);
  for (let t = 0; t < 200 && Object.values(left).some((v) => v > 0); t++) {
    const arrivals = jobs.filter((j) => j.arrival === t).map((j) => j.name);
    queue.push(...arrivals);
    let note = arrivals.length ? `t=${t}: ${arrivals.join(", ")} arrive${arrivals.length === 1 ? "s" : ""}. ` : `t=${t}: `;
    if (current && algo === "rr" && used === quantum) {
      queue.push(current);
      note += `${current}'s ${quantum}-unit slice is over: back of the queue. `;
      current = null;
    }
    const preemptive = algo === "srtf";
    if (current === null || preemptive) {
      const ready: string[] = [...queue, ...(current ? [current] : [])];
      if (ready.length) {
        const choice: string = algo === "rr" ? queue[0] : [...ready].sort((a, b) => key(a) - key(b) || byName[a].arrival - byName[b].arrival || a.localeCompare(b))[0];
        if (choice !== current) {
          if (current) {
            queue.push(current);
            note += `${choice} (${left[choice]} left) preempts ${current} (${left[current]} left). `;
          } else {
            const why =
              algo === "fcfs" ? "it arrived first" : algo === "sjf" ? `shortest burst (${byName[choice].burst})` : algo === "srtf" ? `least time left (${left[choice]})` : algo === "prio" ? `highest priority (${byName[choice].prio})` : "front of the queue";
            note += `CPU free: run ${choice} because ${why}. `;
          }
          queue.splice(queue.indexOf(choice), 1);
          current = choice;
          used = 0;
        }
      }
    }
    if (current) {
      left[current]--;
      used++;
      if (left[current] === 0) note += `${current} finishes at t=${t + 1}.`;
      else if (!note.includes(current)) note += `${current} keeps running (${left[current]} left).`;
    } else {
      note += "Nothing is ready: the CPU idles.";
    }
    timeline.push(current);
    frames.push({ t: t + 1, timeline: [...timeline], queue: [...queue], running: current, left: { ...left }, note });
    if (current && left[current] === 0) current = null;
  }
  return frames;
}

function metrics(jobs: Job[], timeline: (string | null)[]) {
  return jobs.map((j) => {
    const finish = timeline.lastIndexOf(j.name) + 1;
    const first = timeline.indexOf(j.name);
    const turnaround = finish - j.arrival;
    return { name: j.name, turnaround, waiting: turnaround - j.burst, response: first - j.arrival };
  });
}

export default function CpuSched() {
  const [algo, setAlgo] = useState<Algo>("fcfs");
  const [wl, setWl] = useState("textbook");
  const [quantum, setQuantum] = useState(2);
  const jobs = WORKLOADS[wl].jobs;
  const frames = useMemo(() => simulate(jobs, algo, quantum), [jobs, algo, quantum]);
  const s = useStepper(frames, 500);
  const f = s.frame;
  const total = frames[frames.length - 1].timeline.length;
  const color = (n: string) => COLORS[jobs.findIndex((j) => j.name === n) % COLORS.length];
  const done = s.atEnd;
  const m = metrics(jobs, f.timeline);
  const compare = useMemo(
    () =>
      ALGOS.map((a) => {
        const tl = simulate(jobs, a.value, quantum).at(-1)!.timeline;
        const mm = metrics(jobs, tl);
        return { ...a, wait: mm.reduce((x, r) => x + r.waiting, 0) / mm.length, resp: mm.reduce((x, r) => x + r.response, 0) / mm.length };
      }),
    [jobs, quantum],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented value={algo} onChange={setAlgo} options={ALGOS} />
        <Segmented value={wl} onChange={setWl} options={Object.entries(WORKLOADS).map(([value, v]) => ({ value, label: v.label }))} />
        {algo === "rr" && (
          <div className="w-40">
            <Slider label="quantum" value={quantum} min={1} max={6} onChange={setQuantum} />
          </div>
        )}
      </div>
      <p className="text-xs text-dim">{WORKLOADS[wl].note}</p>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              {["job", "arrives", "burst", "priority", "left", "waiting", "turnaround", "response"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {jobs.map((j, i) => (
              <tr key={j.name} className="border-t border-line" style={{ background: f.running === j.name ? `${color(j.name)}14` : undefined }}>
                <td className="px-2 py-1 font-bold" style={{ color: color(j.name) }}>
                  {j.name}
                </td>
                <td className="px-2 py-1">{j.arrival}</td>
                <td className="px-2 py-1">{j.burst}</td>
                <td className="px-2 py-1">{j.prio}</td>
                <td className="px-2 py-1">{f.left[j.name]}</td>
                <td className="px-2 py-1">{f.left[j.name] === 0 ? m[i].waiting : "–"}</td>
                <td className="px-2 py-1">{f.left[j.name] === 0 ? m[i].turnaround : "–"}</td>
                <td className="px-2 py-1">{m[i].response >= 0 && f.timeline.includes(j.name) ? m[i].response : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">Gantt chart</div>
        <div className="flex h-10 overflow-hidden rounded-lg border border-line">
          {Array.from({ length: total }, (_, i) => {
            const n = f.timeline[i];
            return (
              <div
                key={i}
                className="flex flex-1 items-center justify-center border-r border-white/60 font-mono text-[10px] font-bold text-white last:border-r-0"
                style={{ background: i >= f.timeline.length ? "#f1f5f9" : n ? color(n) : C.dim }}
              >
                {i < f.timeline.length && n && (i === 0 || f.timeline[i - 1] !== n) ? n : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-0.5 flex font-mono text-[9px] text-faint">
          {Array.from({ length: total + 1 }, (_, i) => (
            <div key={i} className="flex-1 text-left" style={{ flex: i === total ? "0 0 auto" : undefined }}>
              {i % 2 === 0 || total < 14 ? i : ""}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-faint">ready queue:</span>
        {f.queue.length ? (
          f.queue.map((n) => (
            <span key={n} className="rounded-md px-2 py-0.5 font-mono font-bold text-white" style={{ background: color(n) }}>
              {n}
            </span>
          ))
        ) : (
          <span className="text-faint">empty</span>
        )}
      </div>

      <Narration tone={done ? "good" : "info"}>
        {done
          ? `Done at t=${total}. Average waiting ${(m.reduce((x, r) => x + r.waiting, 0) / m.length).toFixed(2)}, average response ${(m.reduce((x, r) => x + r.response, 0) / m.length).toFixed(2)}.`
          : f.note}
      </Narration>
      <StepControls s={s} />

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs">
          <thead className="bg-panel-2 text-faint">
            <tr>
              <th className="px-2 py-1.5 text-left">this workload</th>
              {compare.map((c) => (
                <th key={c.value} className="px-2 py-1.5 text-left" style={{ color: c.value === algo ? C.active : undefined }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-t border-line">
              <td className="px-2 py-1 font-sans text-faint">avg waiting</td>
              {compare.map((c) => (
                <td key={c.value} className="px-2 py-1" style={{ color: c.wait === Math.min(...compare.map((x) => x.wait)) ? C.done : undefined }}>
                  {c.wait.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="px-2 py-1 font-sans text-faint">avg response</td>
              {compare.map((c) => (
                <td key={c.value} className="px-2 py-1" style={{ color: c.resp === Math.min(...compare.map((x) => x.resp)) ? C.done : undefined }}>
                  {c.resp.toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
