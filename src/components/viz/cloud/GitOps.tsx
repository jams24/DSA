"use client";

import { useRef, useState } from "react";
import { C, Narration, PlayPause, SmallBtn, Stat, useSimLoop } from "../kit";

interface State {
  image: string;
  replicas: number;
  cron: boolean; // a CronJob manifest exists
}

interface Ev {
  t: number;
  text: string;
  tone: string;
}

const POLL = 5000; // Argo CD polls Git every 3 minutes by default; shortened
const ROLLOUT = 2500;

const same = (a: State, b: State) => a.image === b.image && a.replicas === b.replicas && a.cron === b.cron;

export default function GitOps() {
  const [running, setRunning] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [selfHeal, setSelfHeal] = useState(false);
  const [prune, setPrune] = useState(false);
  const t = useRef(0);
  const git = useRef<State>({ image: "shop:v1", replicas: 3, cron: true });
  const seen = useRef<State>({ ...git.current }); // what Argo last fetched from Git
  const live = useRef<State>({ ...git.current });
  const commits = useRef<string[]>(["a1f3c9 initial manifests"]);
  const lastSyncedCommit = useRef(commits.current[0]);
  const nextPoll = useRef(POLL);
  const progressingUntil = useRef(0);
  const events = useRef<Ev[]>([{ t: 0, text: "Application shop: Synced, Healthy", tone: C.done }]);
  const log = (text: string, tone: string = C.muted) => {
    events.current = [{ t: t.current, text, tone }, ...events.current].slice(0, 8);
  };

  const sync = (why: string) => {
    const d = seen.current;
    const before = { ...live.current };
    live.current = { image: d.image, replicas: d.replicas, cron: prune ? d.cron : live.current.cron || d.cron };
    lastSyncedCommit.current = commits.current[0];
    if (before.image !== d.image) progressingUntil.current = t.current + ROLLOUT;
    const changes = [
      before.image !== d.image && `image ${before.image}→${d.image}`,
      before.replicas !== d.replicas && `replicas ${before.replicas}→${d.replicas}`,
      before.cron && !d.cron && (prune ? "deleted CronJob (prune)" : "CronJob left behind (prune off)"),
    ].filter(Boolean);
    log(`Sync (${why}): ${changes.join(", ") || "no changes"}`, C.active);
  };

  const refresh = (why: string) => {
    seen.current = { ...git.current };
    const newCommit = lastSyncedCommit.current !== commits.current[0];
    const drift = !same(live.current, seen.current);
    if (!drift) return;
    if (autoSync && newCommit) sync(`auto-sync, new commit ${commits.current[0].slice(0, 6)}`);
    else if (autoSync && selfHeal) sync("self-heal: live state drifted");
    else log(`${why}: OutOfSync${autoSync && !newCommit ? " (drift is ignored without selfHeal)" : ""}`, C.compare);
  };

  useSimLoop(running, (dt) => {
    t.current += dt;
    if (t.current >= nextPoll.current) {
      nextPoll.current = t.current + POLL;
      refresh("Poll");
    }
  });

  const commit = (msg: string, patch: Partial<State>) => {
    git.current = { ...git.current, ...patch };
    commits.current = [`${Math.random().toString(16).slice(2, 8)} ${msg}`, ...commits.current].slice(0, 5);
    log(`git push: ${msg}`, C.pivot);
  };
  const kubectl = (msg: string, patch: Partial<State>) => {
    live.current = { ...live.current, ...patch };
    log(`kubectl ${msg} (manual change in the cluster)`, C.bad);
  };

  const synced = same(live.current, seen.current) && same(seen.current, git.current);
  const outOfSync = !same(live.current, seen.current);
  const health = t.current < progressingUntil.current ? "Progressing" : "Healthy";
  const nextVersion = `shop:v${Number(git.current.image.split(":v")[1]) + 1}`;

  const tip = outOfSync
    ? selfHeal && autoSync
      ? { tone: "warn" as const, text: "Drift detected. With selfHeal on, Argo CD reverts the cluster to Git on the next refresh: manual kubectl changes don't survive." }
      : { tone: "bad" as const, text: "The cluster no longer matches Git. Without selfHeal, Argo CD only reports OutOfSync. Either commit the change to Git or sync manually." }
    : !same(seen.current, git.current)
      ? { tone: "info" as const, text: "Git has a new commit that Argo CD hasn't fetched yet. Polling takes up to 3 minutes in real life, which is why teams add a Git webhook." }
      : { tone: "good" as const, text: "Live state matches Git. In GitOps, Git is the source of truth and the only way to change production is a reviewed commit." };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlayPause running={running} onToggle={() => setRunning((r) => !r)} />
        <SmallBtn onClick={() => setAutoSync((x) => !x)} tone={autoSync ? "good" : "default"}>
          automated sync: {autoSync ? "on" : "off"}
        </SmallBtn>
        <SmallBtn onClick={() => setSelfHeal((x) => !x)} tone={selfHeal ? "good" : "default"}>
          selfHeal: {selfHeal ? "on" : "off"}
        </SmallBtn>
        <SmallBtn onClick={() => setPrune((x) => !x)} tone={prune ? "good" : "default"}>
          prune: {prune ? "on" : "off"}
        </SmallBtn>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold text-violet">Git:</span>
        <SmallBtn onClick={() => commit(`deploy ${nextVersion}`, { image: nextVersion })} tone="primary">
          commit {nextVersion}
        </SmallBtn>
        <SmallBtn onClick={() => commit(`scale to ${git.current.replicas === 3 ? 4 : 3}`, { replicas: git.current.replicas === 3 ? 4 : 3 })} tone="primary">
          commit replicas {git.current.replicas === 3 ? 4 : 3}
        </SmallBtn>
        <SmallBtn onClick={() => commit("remove CronJob", { cron: false })} tone="primary" disabled={!git.current.cron}>
          delete CronJob manifest
        </SmallBtn>
        <SmallBtn onClick={() => refresh("Webhook refresh")}>webhook: refresh now</SmallBtn>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold text-rose">Cluster:</span>
        <SmallBtn onClick={() => kubectl("scale deploy shop --replicas=8", { replicas: 8 })} tone="danger">
          kubectl scale to 8
        </SmallBtn>
        <SmallBtn onClick={() => kubectl("set image deploy/shop shop:hotfix", { image: "shop:hotfix" })} tone="danger">
          kubectl set image hotfix
        </SmallBtn>
        <SmallBtn onClick={() => sync("manual")}>Argo: Sync</SmallBtn>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="sync status" value={synced ? "Synced" : "OutOfSync"} color={synced ? C.done : C.compare} />
        <Stat label="health" value={health} color={health === "Healthy" ? C.done : C.sky} />
        <Stat label="next poll" value={`${Math.max(0, Math.ceil((nextPoll.current - t.current) / 1000))}s`} />
        <Stat label="synced commit" value={<span className="text-sm">{lastSyncedCommit.current.slice(0, 6)}</span>} />
      </div>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 pb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">
          <span>field</span>
          <span>desired (Git)</span>
          <span>live (cluster)</span>
        </div>
        <Row label="image" a={git.current.image} b={live.current.image} />
        <Row label="replicas" a={String(git.current.replicas)} b={String(live.current.replicas)} />
        <Row label="CronJob" a={git.current.cron ? "present" : "—"} b={live.current.cron ? "present" : "—"} />
        <div className="mt-2 border-t border-line pt-2 font-mono text-[10.5px] text-faint">
          git log: {commits.current.map((c, i) => (
            <span key={c} className={i === 0 ? "text-ink" : ""}>
              {i ? " · " : ""}
              {c}
            </span>
          ))}
        </div>
      </div>

      <Narration tone={tip.tone}>{tip.text}</Narration>

      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="space-y-0.5 font-mono text-[11px]">
          {events.current.map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-10 shrink-0 text-faint tabular-nums">{(e.t / 1000).toFixed(0)}s</span>
              <span style={{ color: e.tone }}>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-t border-line py-1.5 font-mono text-[11px]">
      <span className="text-faint">{label}</span>
      <span className="text-ink">{a}</span>
      <span style={{ color: a === b ? C.text : C.bad }} className={a === b ? "" : "font-semibold"}>
        {b}
      </span>
    </div>
  );
}
