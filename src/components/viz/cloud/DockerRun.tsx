"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { C, Narration, Segmented, StepControls, useStepper } from "../kit";

type Comp = "cli" | "dockerd" | "registry" | "containerd" | "shim" | "runc" | "kernel" | "app";

interface Frame {
  active: Comp[];
  note: string;
  layers: { digest: string; size: string; state: "todo" | "pulling" | "cached" | "done" }[];
  ns: string[];
  cgroup: string[];
  fs: string[];
  net: string[];
  pid1?: string;
  tone?: "good" | "info";
}

const COMPS: { id: Comp; label: string; sub: string }[] = [
  { id: "cli", label: "docker CLI", sub: "client" },
  { id: "dockerd", label: "dockerd", sub: "REST API daemon" },
  { id: "registry", label: "registry", sub: "Docker Hub / ECR" },
  { id: "containerd", label: "containerd", sub: "images + lifecycle" },
  { id: "shim", label: "containerd-shim", sub: "parent per container" },
  { id: "runc", label: "runc", sub: "OCI runtime" },
  { id: "kernel", label: "Linux kernel", sub: "namespaces, cgroups" },
  { id: "app", label: "nginx (PID 1)", sub: "your process" },
];

const LAYERS = [
  { digest: "sha256:a2318d…", size: "29.1 MB" },
  { digest: "sha256:7c1e4f…", size: "41.9 MB" },
  { digest: "sha256:0b2c9d…", size: "0.6 KB" },
  { digest: "sha256:e45a71…", size: "1.4 KB" },
];

function build(cached: boolean): Frame[] {
  const frames: Frame[] = [];
  let layers: Frame["layers"] = LAYERS.map((l, i) => ({ ...l, state: cached || i === 0 ? "cached" : "todo" }));
  const ns: string[] = [];
  const cgroup: string[] = [];
  const fs: string[] = [];
  const net: string[] = [];
  const proc: { pid1?: string } = {};
  const push = (active: Comp[], note: string, tone?: Frame["tone"]) =>
    frames.push({ active, note, layers: layers.map((l) => ({ ...l })), ns: [...ns], cgroup: [...cgroup], fs: [...fs], net: [...net], pid1: proc.pid1, tone });

  push(["cli"], "You type: docker run -d -p 8080:80 --memory 256m --cpus 0.5 nginx:1.27. The CLI does no container work itself. It turns the command into REST calls on the Docker socket (/var/run/docker.sock).");
  push(["cli", "dockerd"], "POST /containers/create and /start go to dockerd. dockerd resolves nginx:1.27 to an image manifest digest and checks its local image store.");
  if (cached) push(["dockerd"], "Every layer digest is already in the local content store, so nothing is downloaded. This is why the second docker run of an image starts in well under a second.");
  else {
    push(["dockerd", "registry"], "Not all layers are local. dockerd fetches the manifest from the registry: a list of layer digests plus a config blob. Layer 1 (the debian base) is already cached from another image, so it is skipped.");
    for (let i = 1; i < LAYERS.length; i++) {
      layers = layers.map((l, k) => (k === i ? { ...l, state: "pulling" } : l));
      push(["dockerd", "registry"], `Pulling layer ${i + 1} (${LAYERS[i].size}). Layers are content-addressed tarballs: the digest is the SHA-256 of the content, so it is verified on download and shared by every image that uses it.`);
      layers = layers.map((l, k) => (k === i ? { ...l, state: "done" } : l));
    }
  }
  push(["dockerd", "containerd"], "dockerd hands the container spec to containerd over gRPC. containerd unpacks the layers into snapshots and writes an OCI bundle: a config.json (process, env, mounts, limits) plus a root filesystem.");
  fs.push("lowerdir = 4 read-only image layers", "upperdir = new empty writable layer", "merged = what the container sees as /");
  push(["containerd"], "The root filesystem is an overlayfs mount: the read-only image layers stacked as lowerdir, plus a fresh writable upperdir. Writes are copy-on-write into the upper layer and disappear with the container. Use volumes for data.");
  push(["containerd", "shim"], "containerd starts a containerd-shim for this container. The shim becomes the container's parent, so dockerd and containerd can restart or upgrade without killing running containers, and it keeps stdout/stderr and the exit code.");
  push(["shim", "runc"], "The shim calls runc create with the bundle. runc is the low-level OCI runtime: a small binary that asks the kernel for isolation and then exec's your process.");
  for (const n of ["pid: own process tree, the app will be PID 1", "net: own interfaces, IP and port space", "mnt: own mount table, root = the overlay", "uts: own hostname", "ipc: own shared memory", "user: optional root → unprivileged host UID"]) ns.push(n);
  push(["runc", "kernel"], "runc calls clone()/unshare() to create new namespaces. Namespaces limit what the process can SEE: its own PIDs, network stack, mounts, hostname and IPC.");
  cgroup.push("memory.max = 256 MiB (above it: OOM kill)", "cpu.max = 50000 100000 (half a CPU)", "pids.max = limit on forks");
  push(["runc", "kernel"], "runc creates a cgroup and writes the limits from --memory and --cpus. cgroups limit what the process can USE. Exceed memory.max and the kernel OOM-kills it; exceed cpu.max and it is throttled, not killed.");
  push(["runc", "kernel"], "runc also drops Linux capabilities (no CAP_SYS_ADMIN), applies a seccomp profile that blocks ~40 dangerous syscalls, and an AppArmor/SELinux profile. A container is a process with its privileges narrowed.");
  net.push("veth pair: eth0 (container) ↔ vethXXXX (host)", "vethXXXX attached to bridge docker0 (172.17.0.1)", "container eth0 = 172.17.0.2", "iptables DNAT: host :8080 → 172.17.0.2:80", "iptables MASQUERADE: outbound traffic NATs to the host IP");
  push(["dockerd", "kernel"], "Networking: a veth pair connects the container's network namespace to the docker0 bridge on the host. -p 8080:80 becomes an iptables DNAT rule; outbound traffic is masqueraded to the host IP.");
  proc.pid1 = "nginx: master process (PID 1 in the container, e.g. PID 48213 on the host)";
  push(["runc", "app"], "runc pivots into the overlay root, then exec's the image's ENTRYPOINT/CMD. nginx is now PID 1 inside its PID namespace. On the host it is just another process with a normal PID: ps aux on the host shows it.");
  push(["shim", "app"], "runc exits; it was only needed to set things up. The shim stays as the parent, collecting logs and the exit status. docker stop sends SIGTERM to PID 1, then SIGKILL after 10 seconds.", "good");
  return frames;
}

export default function DockerRun() {
  const [cached, setCached] = useState<"cold" | "warm">("cold");
  const frames = useMemo(() => build(cached === "warm"), [cached]);
  const s = useStepper(frames, 1500);
  const f = s.frame;

  return (
    <div className="space-y-4">
      <Segmented
        value={cached}
        onChange={setCached}
        options={[
          { value: "cold", label: "Image not pulled yet" },
          { value: "warm", label: "Image already cached" },
        ]}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COMPS.map((c) => {
          const on = f.active.includes(c.id);
          return (
            <div
              key={c.id}
              className={clsx("rounded-xl border-2 px-3 py-2 transition", on ? "shadow-sm" : "opacity-60")}
              style={{ borderColor: on ? C.active : "#e2e8f0", background: on ? `${C.active}12` : "#fff" }}
            >
              <div className="font-mono text-xs font-semibold" style={{ color: on ? C.active : C.text }}>
                {c.label}
              </div>
              <div className="text-[10px] text-faint">{c.sub}</div>
            </div>
          );
        })}
      </div>

      <Narration tone={f.tone ?? "info"}>{f.note}</Narration>

      <div className="grid gap-3 md:grid-cols-2">
        <Box title="Image layers">
          {f.layers.map((l, i) => (
            <div key={l.digest} className="flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className="truncate">
                {i + 1}. {l.digest} <span className="text-faint">{l.size}</span>
              </span>
              <span
                className="shrink-0 rounded px-1.5 font-semibold"
                style={{ color: l.state === "cached" ? C.done : l.state === "done" ? C.active : l.state === "pulling" ? C.compare : C.faint, background: l.state === "pulling" ? `${C.compare}1a` : undefined }}
              >
                {l.state === "cached" ? "cached" : l.state === "done" ? "pulled ✓" : l.state === "pulling" ? "pulling…" : "missing"}
              </span>
            </div>
          ))}
        </Box>
        <Box title="Root filesystem (overlayfs)" empty="not mounted yet">
          {f.fs.map((x) => (
            <Item key={x} text={x} color={C.pivot} />
          ))}
        </Box>
        <Box title="Namespaces: what it can see" empty="none yet: still a normal process">
          {f.ns.map((x) => (
            <Item key={x} text={x} color={C.active} />
          ))}
        </Box>
        <Box title="cgroup: what it can use" empty="no limits yet">
          {f.cgroup.map((x) => (
            <Item key={x} text={x} color={C.compare} />
          ))}
        </Box>
        <Box title="Network" empty="no interfaces yet">
          {f.net.map((x) => (
            <Item key={x} text={x} color={C.sky} />
          ))}
        </Box>
        <Box title="Process" empty="not started">
          {f.pid1 && <Item text={f.pid1} color={C.done} />}
        </Box>
      </div>

      <StepControls s={s} />
    </div>
  );
}

function Box({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="mb-1.5 text-[10px] font-semibold tracking-wider text-faint uppercase">{title}</div>
      <div className="space-y-1">{has ? children : <div className="text-xs text-faint italic">{empty}</div>}</div>
    </div>
  );
}

function Item({ text, color }: { text: string; color: string }) {
  return (
    <div className="flex gap-1.5 font-mono text-[11px] text-ink">
      <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span>{text}</span>
    </div>
  );
}
