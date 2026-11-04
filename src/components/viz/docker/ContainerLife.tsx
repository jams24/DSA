"use client";

import { useState } from "react";
import { C, Narration, Segmented, SmallBtn, Stat } from "../kit";

// The container lifecycle as a state machine you drive with real docker commands: create, start,
// pause, stop, kill, restart, rm. App events (crash, clean exit, OOM) and restart policies show
// what Docker does on its own, and the writable layer shows which commands keep or lose files.
type State = "none" | "created" | "running" | "paused" | "exited" | "removed";
type Policy = "no" | "on-failure" | "always" | "unless-stopped";

interface Box {
  exitCode: number | null;
  restarts: number;
  oom: boolean;
  manual: boolean; // stopped by you: restart policies leave it alone (until the daemon restarts, for "always")
  files: string[];
}
interface Line {
  cmd: string;
  out: string;
  tone: "info" | "good" | "bad" | "warn";
}

// A vertical flow that stays readable on a phone: image → created → running → exited down the
// middle, paused on the left, removed on the right. Labels sit beside the lines, never between boxes.
const W = 100;
const H = 36;
const NODES: Record<State, { x: number; y: number; label: string }> = {
  none: { x: 170, y: 14, label: "image" },
  created: { x: 170, y: 94, label: "created" },
  running: { x: 170, y: 174, label: "running" },
  paused: { x: 14, y: 174, label: "paused" },
  exited: { x: 170, y: 254, label: "exited" },
  removed: { x: 360, y: 174, label: "removed" },
};
type Anchor = "start" | "middle" | "end";
const EDGES: { id: string; from: [number, number]; to: [number, number]; label: string; at: [number, number]; anchor: Anchor }[] = [
  { id: "none>created", from: [220, 50], to: [220, 94], label: "create", at: [228, 76], anchor: "start" },
  { id: "created>running", from: [220, 130], to: [220, 174], label: "start", at: [228, 156], anchor: "start" },
  { id: "running>paused", from: [170, 186], to: [114, 186], label: "pause", at: [142, 180], anchor: "middle" },
  { id: "paused>running", from: [114, 198], to: [170, 198], label: "unpause", at: [142, 213], anchor: "middle" },
  { id: "running>exited", from: [206, 210], to: [206, 254], label: "stop · kill · exit", at: [200, 236], anchor: "end" },
  { id: "exited>running", from: [234, 254], to: [234, 210], label: "start · restart", at: [240, 236], anchor: "start" },
  { id: "created>removed", from: [270, 112], to: [410, 174], label: "rm", at: [346, 137], anchor: "start" },
  { id: "running>removed", from: [270, 192], to: [360, 192], label: "rm -f", at: [315, 186], anchor: "middle" },
  { id: "exited>removed", from: [270, 272], to: [410, 210], label: "rm", at: [346, 258], anchor: "start" },
];

const fresh = (): Box => ({ exitCode: null, restarts: 0, oom: false, manual: false, files: [] });

export default function ContainerLife() {
  const [state, setState] = useState<State>("none");
  const [box, setBox] = useState<Box>(fresh);
  const [sigterm, setSigterm] = useState<"handles" | "ignores">("handles");
  const [policy, setPolicy] = useState<Policy>("no");
  const [log, setLog] = useState<Line[]>([]);
  const [edge, setEdge] = useState<string[]>([]);

  const say = (cmd: string, out: string, tone: Line["tone"] = "info") => setLog((l) => [...l.slice(-5), { cmd, out, tone }]);
  const go = (to: State, edges: string[], patch: Partial<Box> = {}) => {
    setState(to);
    setEdge(edges);
    setBox((b) => ({ ...b, ...patch }));
  };
  // every time the app runs, it writes a file into the container's writable layer
  const started = (b: Box, n = b.files.length + 1) => ({ files: [...b.files, `/tmp/cache-${n}`] });

  // what a restart policy does when the process ends on its own
  const autoRestart = (code: number) => policy === "always" || policy === "unless-stopped" || (policy === "on-failure" && code !== 0);

  function processEnded(cmd: string, code: number, why: string, oom = false) {
    if (autoRestart(code)) {
      go("running", ["running>exited", "exited>running"], { ...started(box), exitCode: code, restarts: box.restarts + 1, oom, manual: false });
      say(cmd, `${why} (exit ${code}). Restart policy "${policy}" starts it again: restart #${box.restarts + 1}. Same container, same files.`, "warn");
    } else {
      go("exited", ["running>exited"], { exitCode: code, oom, manual: false });
      say(cmd, `${why} (exit ${code}). ${policy === "on-failure" && code === 0 ? 'Exit 0 is a success, so "on-failure" leaves it stopped.' : `Restart policy "${policy}": it stays exited.`}`, code === 0 ? "info" : "bad");
    }
  }

  const notRunning = (cmd: string) => say(cmd, "Error response from daemon: container web is not running", "bad");
  const none = (cmd: string) => say(cmd, "Error: No such container: web", "bad");
  // app events need a running process
  const idle = () =>
    say(
      "(app event)",
      state === "none" || state === "removed" ? "No container is running yet: try docker run -d first." : `The container is ${state}: only a running app can crash, finish or run out of memory.`,
    );

  const cmds: { label: string; run: () => void }[] = [
    {
      label: "docker create",
      run: () => {
        if (state !== "none" && state !== "removed") return say("docker create --name web app:1.0", 'Error: the container name "/web" is already in use', "bad");
        setBox(fresh());
        go("created", ["none>created"]);
        say("docker create --name web app:1.0", "3f9a1c2b7e4d. The writable layer and the config exist, but no process is running yet.");
      },
    },
    {
      label: "docker run -d",
      run: () => {
        if (state !== "none" && state !== "removed") return say("docker run -d --name web app:1.0", 'Error: the container name "/web" is already in use', "bad");
        go("running", ["none>created", "created>running"], { ...fresh(), ...started(fresh()) });
        say("docker run -d --name web app:1.0", "run = create + start. The app is PID 1 and wrote /tmp/cache-1 into the writable layer.", "good");
      },
    },
    {
      label: "docker start",
      run: () => {
        if (state === "none" || state === "removed") return none("docker start web");
        if (state === "running") return say("docker start web", "web (it was already running: nothing to do)");
        if (state === "paused") return say("docker start web", "Error: cannot start a paused container, try unpause instead", "bad");
        go("running", [state === "created" ? "created>running" : "exited>running"], { ...started(box), exitCode: null, oom: false, manual: false });
        say("docker start web", `web. A new process starts in the SAME container: ${box.files.length ? `its earlier files (${box.files.join(", ")}) are still there.` : "first run."}`, "good");
      },
    },
    {
      label: "docker pause",
      run: () => {
        if (state !== "running") return state === "paused" ? say("docker pause web", "Error: container web is already paused", "bad") : notRunning("docker pause web");
        go("paused", ["running>paused"]);
        say("docker pause web", "The cgroup freezer stops every process mid-instruction. Memory stays allocated; no CPU is used.");
      },
    },
    {
      label: "docker unpause",
      run: () => {
        if (state !== "paused") return say("docker unpause web", "Error: container web is not paused", "bad");
        go("running", ["paused>running"]);
        say("docker unpause web", "Thawed: the processes carry on exactly where they were.", "good");
      },
    },
    {
      label: "docker stop",
      run: () => {
        if (state === "paused") return say("docker stop web", "Unpause it first: a frozen process can't react to SIGTERM.", "warn");
        if (state !== "running") return state === "exited" || state === "created" ? say("docker stop web", "web (not running: nothing to stop)") : none("docker stop web");
        if (sigterm === "handles") {
          go("exited", ["running>exited"], { exitCode: 0, manual: true });
          say("docker stop web", "SIGTERM → the app finishes its requests and exits by itself in 0.3 s. Exit code 0. You stopped it, so no restart policy kicks in.", "good");
        } else {
          go("exited", ["running>exited"], { exitCode: 137, manual: true });
          say("docker stop web", "SIGTERM is ignored (shell-form CMD, or no handler in PID 1)… 10 s later Docker sends SIGKILL. Exit code 137 = 128 + 9.", "bad");
        }
      },
    },
    {
      label: "docker kill",
      run: () => {
        if (state === "paused") return say("docker kill web", "Unpause it first, then kill it.", "warn");
        if (state !== "running") return notRunning("docker kill web");
        go("exited", ["running>exited"], { exitCode: 137, manual: true });
        say("docker kill web", "SIGKILL right away: no cleanup, no goodbye. Exit code 137.", "bad");
      },
    },
    {
      label: "docker restart",
      run: () => {
        if (state === "none" || state === "removed") return none("docker restart web");
        if (state === "paused") return say("docker restart web", "Unpause it first.", "warn");
        go("running", state === "running" ? ["running>exited", "exited>running"] : [state === "created" ? "created>running" : "exited>running"], {
          ...started(box),
          exitCode: null,
          oom: false,
          manual: false,
        });
        say("docker restart web", "stop (SIGTERM, then SIGKILL after the timeout) + start. Same container, so the files in its writable layer survive.", "good");
      },
    },
    {
      label: "docker rm",
      run: () => {
        if (state === "none" || state === "removed") return none("docker rm web");
        if (state === "running" || state === "paused")
          return say("docker rm web", "Error: cannot remove container web: container is running: stop the container before removing or force remove", "bad");
        go("removed", [`${state}>removed`], { files: [] });
        say("docker rm web", `web. The writable layer is deleted${box.files.length ? `, and with it ${box.files.join(", ")}` : ""}. Keep data in volumes!`, "warn");
      },
    },
    {
      label: "docker rm -f",
      run: () => {
        if (state === "none" || state === "removed") return none("docker rm -f web");
        go("removed", [state === "running" || state === "paused" ? "running>removed" : `${state}>removed`], { files: [] });
        say("docker rm -f web", "SIGKILL (if it was running), then delete the container and its writable layer.", "warn");
      },
    },
  ];

  const events: { label: string; run: () => void }[] = [
    { label: "app crashes", run: () => (state === "running" ? processEnded("(the app throws an uncaught error)", 1, "The process died") : idle()) },
    { label: "app finishes", run: () => (state === "running" ? processEnded("(the app's main function returns)", 0, "The process finished") : idle()) },
    {
      label: "hits memory limit",
      run: () => (state === "running" ? processEnded("(the app uses more than --memory)", 137, "The kernel's OOM killer sent SIGKILL: OOMKilled = true", true) : idle()),
    },
    {
      label: "Docker daemon restarts",
      run: () => {
        const cmd = "(the host reboots, or dockerd restarts)";
        if (state === "none" || state === "removed") return say(cmd, "No container to bring back.");
        // "on-failure" only reacts to the app failing, not to the daemon restarting
        const comesBack = policy === "always" || (policy === "unless-stopped" && !(state === "exited" && box.manual));
        if (state === "running" || state === "paused" || (state === "exited" && comesBack)) {
          if (comesBack) {
            go("running", state === "exited" ? ["exited>running"] : ["running>exited", "exited>running"], { ...started(box), exitCode: null, manual: false });
            say(cmd, `Restart policy "${policy}": Docker starts it again on boot${state === "exited" && policy === "always" ? ', even though you had stopped it ("unless-stopped" would respect that)' : ""}.`, "good");
          } else {
            go("exited", ["running>exited"], { exitCode: sigterm === "handles" ? 0 : 137 }); // dockerd stops its containers on shutdown
            say(cmd, `Restart policy "${policy}": after the reboot it stays down until someone starts it${policy === "on-failure" ? ' ("on-failure" only reacts to the app failing)' : ""}.`, "bad");
          }
        } else say(cmd, `It stays ${state}${state === "exited" && policy === "unless-stopped" ? ': you stopped it yourself, and "unless-stopped" respects that' : ""}.`);
      },
    },
  ];

  const color = (s: State) =>
    ({ none: C.muted, created: C.sky, running: C.done, paused: C.compare, exited: C.bad, removed: C.faint })[s];
  const last = log[log.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-dim">
        <span className="flex flex-wrap items-center gap-2">
          On SIGTERM the app
          <Segmented
            value={sigterm}
            onChange={setSigterm}
            options={[
              { value: "handles", label: "shuts down cleanly" },
              { value: "ignores", label: "ignores it" },
            ]}
          />
        </span>
        <span className="flex flex-wrap items-center gap-2">
          --restart
          <Segmented value={policy} onChange={setPolicy} options={(["no", "on-failure", "always", "unless-stopped"] as Policy[]).map((p) => ({ value: p, label: p }))} />
        </span>
      </div>

      <svg viewBox="0 0 474 304" className="mx-auto block w-full max-w-[560px] rounded-xl border border-line bg-panel" role="img" aria-label="Container state diagram">
        <defs>
          {["on", "off"].map((k) => (
            <marker key={k} id={`life-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={k === "on" ? C.active : C.base} />
            </marker>
          ))}
        </defs>
        {EDGES.map((e) => {
          const on = edge.includes(e.id);
          return (
            <g key={e.id}>
              <line
                x1={e.from[0]}
                y1={e.from[1]}
                x2={e.to[0]}
                y2={e.to[1]}
                stroke={on ? C.active : C.base}
                strokeWidth={on ? 2.4 : 1.4}
                markerEnd={`url(#life-arrow-${on ? "on" : "off"})`}
              />
              <text x={e.at[0]} y={e.at[1]} fontSize={12.5} textAnchor={e.anchor} fill={on ? C.active : C.muted} fontWeight={on ? 600 : 400}>
                {e.label}
              </text>
            </g>
          );
        })}
        {(Object.keys(NODES) as State[]).map((s) => {
          const n = NODES[s];
          const cur = s === state;
          return (
            <g key={s}>
              <rect
                x={n.x}
                y={n.y}
                width={W}
                height={H}
                rx={10}
                fill={cur ? `${color(s)}22` : "#ffffff"}
                stroke={cur ? color(s) : C.base}
                strokeWidth={cur ? 2.4 : 1.4}
                strokeDasharray={s === "none" ? "4 3" : undefined}
              />
              <text x={n.x + W / 2} y={n.y + H / 2 + 5} fontSize={14.5} fontWeight={600} textAnchor="middle" fill={cur ? color(s) : C.muted}>
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="space-y-2">
        <div className="text-[10px] tracking-wider text-faint uppercase">You type</div>
        <div className="flex flex-wrap gap-1.5">
          {cmds.map((c) => (
            <SmallBtn key={c.label} onClick={c.run} className="font-mono">
              {c.label}
            </SmallBtn>
          ))}
        </div>
        <div className="pt-1 text-[10px] tracking-wider text-faint uppercase">Things that just happen</div>
        <div className="flex flex-wrap gap-1.5">
          {events.map((c) => (
            <SmallBtn key={c.label} onClick={c.run} tone={c.label.startsWith("Docker") ? "primary" : "danger"}>
              {c.label}
            </SmallBtn>
          ))}
          <SmallBtn
            onClick={() => {
              setState("none");
              setBox(fresh());
              setLog([]);
              setEdge([]);
            }}
          >
            reset
          </SmallBtn>
        </div>
      </div>

      <Narration tone={last?.tone ?? "info"}>
        {last ? last.out : "Start with docker create or docker run -d. Each button is a real command; try the wrong ones too, and you'll get Docker's real error."}
      </Narration>

      <div className="flex flex-wrap gap-3">
        <Stat label="status" value={state === "none" ? "—" : state} color={color(state)} />
        <Stat label="exit code" value={box.exitCode ?? "—"} color={box.exitCode ? C.bad : C.text} />
        <Stat label="restart count" value={box.restarts} color={box.restarts ? C.compare : C.text} />
        <Stat label="OOMKilled" value={box.oom ? "true" : "false"} color={box.oom ? C.bad : C.muted} />
      </div>
      <div className="rounded-xl border border-line bg-panel px-3 py-2 text-xs">
        <span className="text-faint">writable layer: </span>
        <span className="font-mono" style={{ color: box.files.length ? C.text : C.faint }}>
          {box.files.length ? box.files.join("  ") : state === "removed" ? "deleted with the container" : "empty"}
        </span>
      </div>
      {log.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-[#0f172a] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed" style={{ fontVariantLigatures: "none" }}>
          {log.map((l, i) => (
            <div key={i}>
              <div className="text-[#e2e8f0]">
                <span className="text-[#64748b]">$ </span>
                {l.cmd}
              </div>
              <div style={{ color: l.tone === "bad" ? "#fda4af" : l.tone === "good" ? "#6ee7b7" : l.tone === "warn" ? "#fcd34d" : "#94a3b8" }}>{l.out}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
