"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Narration, Segmented, SmallBtn, Stat } from "../kit";

type Cmd = "uptime" | "top" | "free" | "df" | "iostat" | "ss" | "dmesg" | "pods" | "rs" | "logs" | "dig";
type Cause = "cpu" | "oom" | "disk" | "io" | "ports" | "dns";

const COMMANDS: { id: Cmd; label: string }[] = [
  { id: "uptime", label: "uptime" },
  { id: "top", label: "top -bn1 | head" },
  { id: "free", label: "free -m" },
  { id: "df", label: "df -h" },
  { id: "iostat", label: "iostat -xz 1 2" },
  { id: "ss", label: "ss -s" },
  { id: "dmesg", label: "dmesg -T | tail -4" },
  { id: "logs", label: "journalctl -u api -n 4" },
  { id: "dig", label: "dig payments.internal" },
  { id: "pods", label: "kubectl get pods" },
  { id: "rs", label: "kubectl get rs -l app=api" },
];

const CAUSES: { id: Cause; label: string }[] = [
  { id: "cpu", label: "CPU saturation from a bad deploy" },
  { id: "oom", label: "Memory leak → OOM kills" },
  { id: "disk", label: "Disk full" },
  { id: "io", label: "Disk I/O saturation" },
  { id: "ports", label: "Ephemeral port exhaustion" },
  { id: "dns", label: "DNS resolution failure" },
];

const top = (load: string, cpu: string, rows: string) => `top - 14:02:13 up 41 days,  3:12,  1 user,  load average: ${load}
Tasks: 187 total,   2 running, 185 sleeping,   0 stopped,   0 zombie
%Cpu(s): ${cpu}
MiB Mem :  15990.1 total,   6120.4 free,   5210.8 used,   4658.9 buff/cache

    PID USER      %CPU  %MEM  S     TIME+ COMMAND
${rows}`;

const BASE: Record<Cmd, string> = {
  uptime: " 14:02:11 up 41 days,  3:12,  1 user,  load average: 0.82, 0.91, 0.88",
  top: top(
    "0.82, 0.91, 0.88",
    "18.2 us,  3.1 sy, 77.9 id,  0.4 wa,  0.0 st",
    `   2314 api       61.3  25.0  S  812:44.1 java
    988 root       4.0   0.5  S   22:10.9 kubelet
    731 root       1.7   0.3  S    9:41.2 containerd`,
  ),
  free: `               total        used        free      shared  buff/cache   available
Mem:           15990        5210        6120          12        4658       10412
Swap:              0           0           0`,
  df: `Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p1   97G   41G   56G  43% /
/dev/nvme1n1    493G  212G  281G  43% /var/lib/data
tmpfs           7.9G     0  7.9G   0% /dev/shm`,
  iostat: `Device     r/s     w/s    rkB/s    wkB/s  r_await  w_await  aqu-sz  %util
nvme0n1    2.1    14.3     38.0    402.1     0.41     0.88    0.02    1.9
nvme1n1   12.4    88.0    210.2   3120.4     0.52     1.10    0.11    7.8`,
  ss: `Total: 412
TCP:   268 (estab 182, closed 41, orphaned 0, timewait 38)

Transport Total     IP        IPv6
UDP       9         7         2
TCP       227       201       26`,
  dmesg: `[Mon Oct 20 09:14:02 2026] cni0: port 4(veth3a91c2e) entered forwarding state
[Mon Oct 20 09:14:02 2026] IPv6: ADDRCONF(NETDEV_CHANGE): veth3a91c2e: link becomes ready
[Tue Oct 21 02:00:01 2026] EXT4-fs (nvme1n1): mounted filesystem with ordered data mode
[Tue Oct 21 02:00:03 2026] audit: type=1400 apparmor="STATUS" operation="profile_replace"`,
  logs: `14:01:58 api[2314]: INFO  GET /v1/orders 200 41ms
14:01:58 api[2314]: INFO  POST /v1/checkout 200 188ms
14:01:59 api[2314]: INFO  GET /v1/orders/9921 200 12ms
14:02:00 api[2314]: INFO  GET /healthz 200 1ms`,
  dig: `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 4412
payments.internal.      30      IN      A       10.0.12.41
;; Query time: 2 msec
;; SERVER: 10.0.0.2#53(10.0.0.2)`,
  pods: `NAME                  READY   STATUS    RESTARTS   AGE
api-7d9f8c6b5-2kxlp   1/1     Running   0          3d
api-7d9f8c6b5-8hq4z   1/1     Running   0          3d
api-7d9f8c6b5-wm2rt   1/1     Running   0          3d`,
  rs: `NAME            DESIRED   CURRENT   READY   AGE
api-7d9f8c6b5   3         3         3       3d
api-5c8b7f9d4   0         0         0       10d`,
};

interface Scenario {
  alert: string;
  cause: Cause;
  out: Partial<Record<Cmd, string>>;
  explain: string;
}

const SCENARIOS: Scenario[] = [
  {
    alert: "🔥 api p99 latency 4.2 s (SLO: 300 ms), started 12 minutes ago. Error rate normal.",
    cause: "cpu",
    out: {
      uptime: " 14:02:11 up 41 days,  3:12,  1 user,  load average: 15.82, 13.40, 6.11",
      top: top(
        "15.82, 13.40, 6.11",
        "97.8 us,  1.9 sy,  0.0 id,  0.0 wa,  0.3 st",
        `   9120 api      391.2  27.1  R   46:51.8 java
    988 root       2.1   0.5  S   22:10.9 kubelet
    731 root       0.7   0.3  S    9:41.2 containerd`,
      ),
      rs: `NAME            DESIRED   CURRENT   READY   AGE
api-6f4d9b7c8   3         3         3       12m
api-7d9f8c6b5   0         0         0       3d`,
      pods: `NAME                  READY   STATUS    RESTARTS   AGE
api-6f4d9b7c8-q8n2w   1/1     Running   0          12m
api-6f4d9b7c8-tz5kd   1/1     Running   0          11m
api-6f4d9b7c8-x7plm   1/1     Running   0          11m`,
      logs: `14:01:57 api[9120]: WARN  slow request GET /v1/search?q=aaaaaaaaaaaaaaaaaaaaaaaa! 3912ms
14:01:58 api[9120]: WARN  slow request GET /v1/orders 2210ms
14:01:59 api[9120]: WARN  slow request POST /v1/checkout 4105ms
14:02:00 api[9120]: WARN  slow request GET /healthz 980ms`,
    },
    explain:
      "Load average ~16 on 4 vCPUs, 98% user CPU, zero iowait: the app itself is burning the CPU. A new ReplicaSet appeared 12 minutes ago, exactly when latency rose. Mitigate first with `kubectl rollout undo deploy/api`, then profile the new build (flame graph). That search query hints at catastrophic regex backtracking. Most incidents follow a change, so always check what was deployed.",
  },
  {
    alert: "⚠️ api returning 502 on ~2% of requests in bursts every few minutes.",
    cause: "oom",
    out: {
      pods: `NAME                  READY   STATUS      RESTARTS      AGE
api-7d9f8c6b5-2kxlp   1/1     Running     7 (3m ago)    3d
api-7d9f8c6b5-8hq4z   0/1     OOMKilled   8 (12s ago)   3d
api-7d9f8c6b5-wm2rt   1/1     Running     6 (9m ago)    3d`,
      dmesg: `[Wed Oct 22 13:49:11 2026] java invoked oom-killer: gfp_mask=0xcc0(GFP_KERNEL), order=0
[Wed Oct 22 13:49:11 2026] Memory cgroup out of memory: Killed process 30871 (java) total-vm:9123456kB, anon-rss:4192880kB
[Wed Oct 22 14:01:58 2026] java invoked oom-killer: gfp_mask=0xcc0(GFP_KERNEL), order=0
[Wed Oct 22 14:01:58 2026] Memory cgroup out of memory: Killed process 31502 (java) total-vm:9120112kB, anon-rss:4194012kB`,
      logs: `14:01:41 api[31502]: WARN  heap usage 96% after full GC (3.9 GiB / 4.0 GiB)
14:01:52 api[31502]: WARN  GC pause 2.8 s
14:02:05 api[31790]: INFO  Starting api v2026.10.14 ...
14:02:14 api[31790]: INFO  Started in 9.1 s`,
    },
    explain:
      "`OOMKilled` with climbing restart counts, plus the kernel's `Memory cgroup out of memory: Killed process (java)`. The container hits its 4 GiB limit and the kernel kills it, so in-flight requests get 502s. Restarts every few minutes with heap ~96% after full GC means a leak. Buy time with more replicas or a higher limit, then take a heap dump to find the unbounded cache or listener. Also size the JVM to the container (-XX:MaxRAMPercentage) so the GC works before the kernel kills it.",
  },
  {
    alert: "❌ api: POST /v1/uploads failing 100%. Reads still work.",
    cause: "disk",
    out: {
      df: `Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p1   97G   97G     0 100% /
/dev/nvme1n1    493G  212G  281G  43% /var/lib/data
tmpfs           7.9G     0  7.9G   0% /dev/shm`,
      logs: `14:01:58 api[2314]: ERROR write /tmp/upload-77812: no space left on device
14:01:58 api[2314]: ERROR POST /v1/uploads 500 3ms
14:01:59 api[2314]: ERROR log rotation failed: ENOSPC
14:02:00 api[2314]: INFO  GET /v1/orders 200 39ms`,
    },
    explain:
      "`df -h` shows / at 100% and writes fail with ENOSPC while reads keep working. Find the culprit with `du -xh / | sort -h | tail` (usually unrotated logs or temp files), then free space. Gotcha: deleting a file a process still holds open frees nothing until the process closes it (`lsof +L1`). Prevent it with logrotate or log shipping, alerts at 80%, and check inodes too (`df -i`).",
  },
  {
    alert: "🐢 api p99 latency 2.4 s, but the CPU dashboard shows the host mostly idle.",
    cause: "io",
    out: {
      uptime: " 14:02:11 up 41 days,  3:12,  1 user,  load average: 9.40, 8.82, 5.10",
      top: top(
        "9.40, 8.82, 5.10",
        " 6.1 us,  2.0 sy, 39.6 id, 52.3 wa,  0.0 st",
        `  30112 root      12.4   0.1  D    8:02.7 tar czf /var/lib/data/backup.tgz
   2314 api        9.8  25.0  D  812:50.3 java
   1203 root       0.3   0.0  D    0:41.0 jbd2/nvme1n1-8`,
      ),
      iostat: `Device     r/s     w/s    rkB/s     wkB/s  r_await  w_await  aqu-sz  %util
nvme0n1    2.0    15.1     36.0     410.0     0.44     0.91    0.02    2.1
nvme1n1  210.4  3104.0  26930.1  397312.0    96.20   182.40   64.10  100.0`,
    },
    explain:
      "High load with an idle CPU is the tell. Linux load average also counts tasks in uninterruptible sleep (state D, usually waiting on disk). `top` shows 52% iowait and processes in D state; `iostat -x` shows nvme1n1 at 100% util with 182 ms write latency and a 64-deep queue. A backup `tar` is saturating the data disk. Stop or `ionice` it now; long term, back up from a snapshot or replica, off-peak, or buy more IOPS.",
  },
  {
    alert: "⚠️ api: ~8% of calls to payments fail instantly (no timeout), mostly at peak traffic.",
    cause: "ports",
    out: {
      ss: `Total: 28956
TCP:   28713 (estab 190, closed 28420, orphaned 0, timewait 28398)

Transport Total     IP        IPv6
UDP       9         7         2
TCP       293       267       26`,
      logs: `14:01:58 api[2314]: ERROR dial tcp 10.0.12.41:443: connect: cannot assign requested address
14:01:58 api[2314]: ERROR POST /v1/checkout 502 1ms
14:01:59 api[2314]: ERROR dial tcp 10.0.12.41:443: connect: cannot assign requested address
14:02:00 api[2314]: INFO  POST /v1/checkout 200 201ms`,
    },
    explain:
      "~28k sockets in TIME_WAIT, and `connect: cannot assign requested address`. Every outbound connection to the same destination IP:port needs a unique local ephemeral port. Linux's default range (32768–60999) holds ~28k, and each closed connection keeps its port in TIME_WAIT for 60 s. Opening a new connection per request exhausts them at ~470 req/s. Fix: keep-alive and connection pooling. Stopgaps: widen `ip_local_port_range`, enable `tcp_tw_reuse`.",
  },
  {
    alert: "⚠️ api: every call to payments.internal takes exactly ~5 s then fails. Other calls are fine.",
    cause: "dns",
    out: {
      dig: `;; communications error to 10.0.0.2#53: timed out
;; communications error to 10.0.0.2#53: timed out
;; no servers could be reached`,
      logs: `14:01:53 api[2314]: ERROR lookup payments.internal on 10.0.0.2:53: read udp 10.0.4.17:48812->10.0.0.2:53: i/o timeout
14:01:53 api[2314]: ERROR POST /v1/checkout 504 5004ms
14:01:58 api[2314]: ERROR lookup payments.internal on 10.0.0.2:53: i/o timeout
14:01:59 api[2314]: INFO  GET /v1/orders 200 40ms`,
    },
    explain:
      "`dig` can't reach the resolver at 10.0.0.2 and the app logs show lookup i/o timeouts. The suspiciously exact 5 s is the resolver timeout (resolv.conf default `timeout:5`). Calls that use cached or already-open connections still work, which is why only some calls fail. Check /etc/resolv.conf and the resolver (CoreDNS pods, their CPU, conntrack). In Kubernetes, `ndots:5` makes external names try several search domains first, multiplying queries. Mitigate: scale CoreDNS, add NodeLocal DNSCache. It's always DNS.",
  },
];

export default function Incident() {
  const [idx, setIdx] = useState("0");
  const [ran, setRan] = useState<Cmd[]>([]);
  const [guess, setGuess] = useState<Cause | null>(null);
  const [wrong, setWrong] = useState<Cause[]>([]);
  const sc = SCENARIOS[Number(idx)];
  const solved = guess === sc.cause;
  const stars = Math.max(1, (ran.length <= 3 ? 3 : ran.length <= 5 ? 2 : 1) - wrong.length);

  function pick(i: string) {
    setIdx(i);
    setRan([]);
    setGuess(null);
    setWrong([]);
  }
  function run(c: Cmd) {
    if (solved) return;
    setRan((r) => [c, ...r.filter((x) => x !== c)]);
  }
  function diagnose(c: Cause) {
    if (solved) return;
    setGuess(c);
    if (c !== sc.cause && !wrong.includes(c)) setWrong((w) => [...w, c]);
  }

  return (
    <div className="space-y-4">
      <Segmented value={idx} onChange={pick} options={SCENARIOS.map((_, i) => ({ value: String(i), label: `Incident #${i + 1}` }))} />
      <div className="rounded-xl border border-rose/40 bg-rose/[0.06] px-4 py-3 text-sm font-medium text-ink">
        <span className="mr-2 font-pixel text-[9px] tracking-widest text-rose uppercase">Page</span>
        {sc.alert}
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-wrap content-start gap-1.5 lg:flex-col">
          {COMMANDS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => run(c.id)}
              disabled={solved}
              className={clsx(
                "rounded-lg border px-2.5 py-1.5 text-left font-mono text-[11px] transition disabled:opacity-50",
                ran.includes(c.id) ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-line-2 bg-panel text-ink hover:border-cyan/50",
              )}
            >
              $ {c.label}
            </button>
          ))}
        </div>
        <div className="h-[330px] overflow-auto rounded-xl border border-[#1e293b] bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#cbd5e1]">
          {ran.length === 0 && <div className="text-[#64748b]">You&apos;re on the api host. Run commands to investigate; fewer commands = more stars.</div>}
          {ran.map((c) => (
            <div key={c} className="mb-3">
              <div className="text-[#5eead4]">$ {COMMANDS.find((x) => x.id === c)!.label}</div>
              <pre className="whitespace-pre text-[#e2e8f0]">{sc.out[c] ?? BASE[c]}</pre>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">Your diagnosis</div>
        <div className="flex flex-wrap gap-1.5">
          {CAUSES.map((c) => (
            <SmallBtn key={c.id} onClick={() => diagnose(c.id)} disabled={solved && c.id !== sc.cause} tone={solved && c.id === sc.cause ? "good" : wrong.includes(c.id) ? "danger" : "default"}>
              {c.label}
            </SmallBtn>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="commands run" value={ran.length} />
        <Stat label="wrong guesses" value={wrong.length} color={wrong.length ? "#e11d48" : undefined} />
        <Stat label="rating" value={solved ? "★".repeat(stars) + "☆".repeat(3 - stars) : "–"} color="#d97706" />
      </div>
      <Narration tone={solved ? "good" : guess ? "bad" : "info"}>
        {solved
          ? sc.explain.split("`").map((part, i) =>
              i % 2 ? (
                <code key={i} className="rounded bg-slate-900/[0.06] px-1 font-mono text-[12px]">
                  {part}
                </code>
              ) : (
                part
              ),
            )
          : guess
            ? "Not quite: the evidence doesn't support that. Which command would prove or rule it out?"
            : "Work like an SRE: form a hypothesis from the alert, run the command that tests it, and stop as soon as the evidence is conclusive. Mitigate first, root-cause later."}
      </Narration>
    </div>
  );
}
