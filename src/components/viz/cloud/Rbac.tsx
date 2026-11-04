"use client";

import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Narration, Segmented } from "../kit";

type Verb = "get" | "list" | "create" | "delete";
type Resource = "pods" | "pods/log" | "pods/exec" | "deployments" | "secrets" | "nodes";
type Ns = "shop" | "staging";

interface Rule {
  resources: Resource[];
  verbs: Verb[];
}
interface Role {
  kind: "Role" | "ClusterRole";
  name: string;
  namespace?: Ns;
  rules: Rule[];
}
interface Binding {
  kind: "RoleBinding" | "ClusterRoleBinding";
  name: string;
  namespace?: Ns;
  subject: string;
  role: string;
}
interface Subject {
  id: string;
  label: string;
  as: string;
  /** names a binding can refer to: the user or ServiceAccount, plus its groups */
  matches: string[];
}

const READ: Verb[] = ["get", "list"];
const ALL: Verb[] = ["get", "list", "create", "delete"];

const ROLES: Role[] = [
  { kind: "Role", name: "pod-reader", namespace: "shop", rules: [{ resources: ["pods"], verbs: READ }, { resources: ["pods/log"], verbs: ["get"] }] },
  { kind: "ClusterRole", name: "view", rules: [{ resources: ["pods", "pods/log", "deployments"], verbs: READ }] },
  {
    kind: "ClusterRole",
    name: "edit",
    rules: [
      { resources: ["pods", "deployments", "secrets"], verbs: ALL },
      { resources: ["pods/log"], verbs: ["get"] },
      { resources: ["pods/exec"], verbs: ["create"] },
    ],
  },
  { kind: "ClusterRole", name: "node-reader", rules: [{ resources: ["nodes"], verbs: READ }] },
];

const BINDINGS: Binding[] = [
  { kind: "RoleBinding", name: "dashboard-reads-pods", namespace: "shop", subject: "ServiceAccount shop/dashboard", role: "pod-reader" },
  { kind: "RoleBinding", name: "team-a-edit", namespace: "shop", subject: "Group team-a", role: "edit" },
  { kind: "ClusterRoleBinding", name: "ci-view-all", subject: "ServiceAccount ci/deployer", role: "view" },
  { kind: "RoleBinding", name: "ci-deploys-staging", namespace: "staging", subject: "ServiceAccount ci/deployer", role: "edit" },
  { kind: "ClusterRoleBinding", name: "oncall-nodes", subject: "Group oncall", role: "node-reader" },
];

const SUBJECTS: Subject[] = [
  { id: "dashboard", label: "SA dashboard", as: "system:serviceaccount:shop:dashboard", matches: ["ServiceAccount shop/dashboard"] },
  { id: "deployer", label: "SA ci/deployer", as: "system:serviceaccount:ci:deployer", matches: ["ServiceAccount ci/deployer"] },
  { id: "jane", label: "jane (team-a)", as: "jane --as-group=team-a", matches: ["User jane", "Group team-a"] },
  { id: "sam", label: "sam (oncall)", as: "sam --as-group=oncall", matches: ["User sam", "Group oncall"] },
];

const TRY: { s: string; v: Verb; r: Resource; ns: Ns }[] = [
  { s: "dashboard", v: "get", r: "pods/log", ns: "shop" },
  { s: "dashboard", v: "list", r: "pods", ns: "staging" },
  { s: "deployer", v: "get", r: "secrets", ns: "shop" },
  { s: "deployer", v: "delete", r: "deployments", ns: "staging" },
  { s: "jane", v: "create", r: "pods/exec", ns: "shop" },
  { s: "jane", v: "list", r: "nodes", ns: "shop" },
  { s: "sam", v: "list", r: "nodes", ns: "shop" },
];

const CLUSTER_SCOPED: Resource[] = ["nodes"];

type Line = { binding: Binding; role: Role; reason: string; allows: boolean };

function evaluate(subject: Subject, verb: Verb, res: Resource, ns: Ns, enabled: Record<string, boolean>) {
  const lines: Line[] = [];
  for (const b of BINDINGS) {
    if (!enabled[b.name] || !subject.matches.includes(b.subject)) continue;
    const role = ROLES.find((r) => r.name === b.role)!;
    let reason: string;
    let allows = false;
    if (b.kind === "RoleBinding" && CLUSTER_SCOPED.includes(res)) {
      reason = `a RoleBinding only grants inside namespace ${b.namespace}; ${res} aren't in any namespace, so only a ClusterRoleBinding can grant them`;
    } else if (b.kind === "RoleBinding" && b.namespace !== ns) {
      reason = `this RoleBinding is in namespace ${b.namespace}, not ${ns}`;
    } else {
      const rule = role.rules.find((r) => r.resources.includes(res) && r.verbs.includes(verb));
      allows = !!rule;
      reason = rule
        ? `rule: ${rule.verbs.join(", ")} on ${rule.resources.join(", ")}`
        : `${role.kind} ${role.name} has no rule for ${verb} on ${res}`;
    }
    lines.push({ binding: b, role, reason, allows });
  }
  return { allowed: lines.some((l) => l.allows), lines };
}

export default function Rbac() {
  const [sid, setSid] = useState("dashboard");
  const [verb, setVerb] = useState<Verb>("get");
  const [res, setRes] = useState<Resource>("pods/log");
  const [ns, setNs] = useState<Ns>("shop");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(BINDINGS.map((b) => [b.name, true])));
  const subject = SUBJECTS.find((s) => s.id === sid)!;
  const { allowed, lines } = evaluate(subject, verb, res, ns, enabled);
  const scoped = !CLUSTER_SCOPED.includes(res);
  const cmd = `kubectl auth can-i ${verb} ${res}${scoped ? ` -n ${ns}` : ""} --as=${subject.as}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TRY.map((t, k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSid(t.s);
              setVerb(t.v);
              setRes(t.r);
              setNs(t.ns);
            }}
            className="h-7 rounded-md border border-line-2 px-2 font-mono text-[10.5px] text-dim transition hover:border-cyan/50 hover:text-ink"
          >
            {t.s}: {t.v} {t.r}
            {CLUSTER_SCOPED.includes(t.r) ? "" : ` in ${t.ns}`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Row label="who">
          <Segmented value={sid} onChange={setSid} options={SUBJECTS.map((s) => ({ value: s.id, label: s.label }))} />
        </Row>
        <Row label="verb">
          <Segmented value={verb} onChange={setVerb} options={(["get", "list", "create", "delete"] as Verb[]).map((v) => ({ value: v, label: v }))} />
        </Row>
        <Row label="resource">
          <Segmented
            value={res}
            onChange={setRes}
            options={(["pods", "pods/log", "pods/exec", "deployments", "secrets", "nodes"] as Resource[]).map((r) => ({ value: r, label: r }))}
          />
        </Row>
        <Row label="namespace">
          <Segmented value={ns} onChange={setNs} options={(["shop", "staging"] as Ns[]).map((n) => ({ value: n, label: n }))} />
          {!scoped && <span className="text-[11px] text-faint">(ignored: nodes are cluster-scoped)</span>}
        </Row>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-line bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">
        <span className="text-[#7dd3fc]">$ {cmd}</span>
        {"\n"}
        <span className={allowed ? "text-[#6ee7b7]" : "text-[#fda4af]"}>{allowed ? "yes" : "no"}</span>
      </pre>

      <div className="space-y-1.5">
        {lines.map((l) => (
          <div
            key={l.binding.name}
            className={clsx("min-w-0 rounded-lg border px-3 py-2 text-xs", l.allows ? "border-emerald/50 bg-emerald/[0.06]" : "border-line bg-panel")}
          >
            <div className="font-mono break-words text-ink">
              {l.binding.kind} {l.binding.name}
              {l.binding.namespace ? ` (ns ${l.binding.namespace})` : " (all namespaces)"} → {l.role.kind} {l.role.name}
            </div>
            <div className={clsx("mt-0.5 break-words", l.allows ? "text-emerald" : "text-dim")}>
              {l.allows ? "✓ allows it: " : "✗ "}
              {l.reason}
            </div>
          </div>
        ))}
        {lines.length === 0 && <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs text-dim">No enabled binding mentions {subject.label}.</div>}
      </div>

      <Narration tone={allowed ? "good" : "bad"}>
        {allowed
          ? res === "pods/exec" || res === "secrets"
            ? "Allowed, and worth a second look: exec gives a shell in every pod (with whatever secrets they hold), and reading Secrets reveals credentials. Grant these sparingly."
            : "Allowed: at least one binding gives this subject a role with a matching rule. Permissions only add up; any one grant is enough."
          : "Forbidden. RBAC has no deny rules: a request is refused simply because no binding grants it. To allow it, bind a role with a matching rule, in the right namespace (or cluster-wide for cluster-scoped kinds)."}
      </Narration>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink">Bindings in this cluster (switch one off to see what it was granting)</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BINDINGS.map((b) => (
            <label key={b.name} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px]">
              <input type="checkbox" className="mt-0.5" checked={enabled[b.name]} onChange={(e) => setEnabled((x) => ({ ...x, [b.name]: e.target.checked }))} />
              <span className="min-w-0 break-words">
                <span className="font-mono text-ink">{b.name}</span>
                <span className="text-dim">
                  {" "}
                  {b.subject} → {b.role}
                  {b.namespace ? ` in ${b.namespace}` : " everywhere"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-faint">{label}</span>
      {children}
    </div>
  );
}
