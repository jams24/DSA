import type { Lesson } from "../types";

// Kubernetes, part 5: operating a cluster. Kustomize, Helm and GitOps; RBAC and pod security; controllers and CRDs; debugging.

export const kubernetesPart5: Lesson[] = [
  // ------------------------------------------------------------------ GITOPS
  {
    id: "gitops-helm",
    part: "Part 5 · Operating Kubernetes",
    title: "Kustomize, Helm and GitOps",
    tagline: "One app, many environments: Kustomize overlays, Helm charts, previewing changes with kubectl diff, and letting Argo CD or Flux sync the cluster from Git.",
    difficulty: "intermediate",
    minutes: 22,
    visualizers: ["gitops"],
    concept: `## Explain it like I'm 10 🧸
You have one recipe for pancakes, and three kitchens: at home, at grandma's and at school. Grandma's needs a bigger batch; school has no eggs, so they use a banana. You could write three complete recipes, but when you improve the batter you'd have to fix all three, and you'd forget one.

Better: keep **one base recipe**, plus a small **note for each kitchen**: "grandma's: double everything", "school: swap eggs for banana". That's **Kustomize**: a base folder of YAML plus small **overlays** per environment.

**Helm** is the other way: a recipe with **blanks** to fill in ("use ___ eggs"), plus a list of answers for each kitchen. It's great for sharing recipes with strangers, who only need to fill in the blanks.

And **GitOps** means the recipe book lives in one shared notebook (**Git**), and a robot in each kitchen checks the notebook every few minutes and makes the kitchen match it. Nobody cooks from memory. If someone changes something in the kitchen by hand, the robot notices and puts it back.

## The problem
Raw YAML doesn't scale: the same app runs in dev, staging and three production regions with different replicas, images, domains and resources. Copy-pasting manifests drifts; \`kubectl apply\` from laptops leaves no audit trail.

## Helm: templating + packaging
A **chart** is a directory of Go templates plus \`values.yaml\`. \`helm install\` renders templates with values and applies them as a **release**, which Helm tracks (as Secrets in the namespace) so it can **upgrade** and **roll back**.
- Strengths: parameterised, versioned, distributed through registries (OCI), with a huge ecosystem of third-party charts (Prometheus, cert-manager, databases).
- Weaknesses: templated YAML is hard to read, values files become an API you must maintain, and hooks add hidden ordering.

## Kustomize: patching, no templates
Kustomize starts from plain YAML (**base**) and applies **overlays** per environment: patches, name prefixes, labels, image tags, generated ConfigMaps. Built into \`kubectl apply -k\`. Great for your own apps; teams often combine both (render a Helm chart, then patch it with Kustomize).

## GitOps
The core principles:
1. The desired state is **declarative**, and lives in **Git**.
2. A controller **in the cluster** (Argo CD or Flux) **pulls** it and continuously **reconciles** live state toward it.
3. Every change is a commit: reviewed, audited, and revertible with \`git revert\`.

Compared to push-based CI deploys, the cluster doesn't need to expose credentials to CI, drift is detected automatically, and disaster recovery is "point a new cluster at the repo".

## Argo CD in practice
- An **Application** maps a Git path (plain YAML, Helm or Kustomize) to a cluster and namespace. **ApplicationSets** generate Applications per cluster, environment or directory.
- **Sync status**: Synced / OutOfSync (live differs from Git). **Health**: Healthy / Progressing / Degraded, from resource-specific checks (a Deployment is Progressing until its rollout completes).
- **Automated sync** applies new commits automatically. **selfHeal** also reverts manual changes in the cluster. **prune** deletes resources that were removed from Git (off by default, for safety).
- **Sync waves and hooks** order things such as "migrations before the Deployment".
- Pair with **Argo Rollouts** or Flagger for canary and blue/green with automated analysis.

Try it in the visualizer: commit a new version, then make a manual \`kubectl\` change and see what each setting does.

## Repo layout and promotion
Keep **application source** and **deployment config** in separate repos (or at least separate paths). CI builds and pushes the image, then opens a PR (or commits) that bumps the image tag in the config repo for the next environment. Promotion between environments is a PR. Secrets stay out of Git, or go in encrypted (Sealed Secrets, SOPS) or as references (External Secrets).

## Preview before you apply
\`kubectl diff -f\` (or \`-k\`) asks the API server to dry-run your change and shows exactly what would change in the live objects, defaults and all. Run it in pull requests and before every manual apply. \`kubectl apply --server-side\` and \`--dry-run=server\` are its relatives. Argo CD shows the same diff in its UI before a sync.`,
    keyPoints: [
      "Kustomize: a plain-YAML base plus per-environment overlays (patches, images, replicas, generated ConfigMaps); built into kubectl -k.",
      "configMapGenerator adds a content hash to the name, so config changes trigger rollouts automatically.",
      "Helm: templates + values, packaged as versioned charts; releases can be upgraded and rolled back.",
      "kubectl diff previews exactly what an apply would change; run it in pull requests.",
      "GitOps: Git holds desired state; Argo CD or Flux pull and reconcile it, detect drift, and can self-heal and prune.",
    ],
    code: [
      {
        title: "Kustomize: one base, two environments",
        note: "Render, apply, change prod's config and preview the diff.",
        k8s: true,
        images: ["node:20-slim"],
        vary: ["web-config-[a-z0-9]{10}"],
        files: [
          { path: "base/kustomization.yaml", lang: "yaml", code: `# The shared base: what every environment has in common
resources:
  - deployment.yaml
  - service.yaml
labels:
  - pairs: { app: web }
    includeSelectors: true` },
          { path: "base/deployment.yaml", lang: "yaml", code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: web
          image: node                # no tag here: each environment pins its own
          command: ["node", "-e", "require('http').createServer((q, s) => s.end(process.env.GREETING)).listen(8080)"]
          envFrom:
            - configMapRef: { name: web-config }` },
          { path: "base/service.yaml", lang: "yaml", code: `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  ports: [{ port: 80, targetPort: 8080 }]` },
          { path: "overlays/staging/kustomization.yaml", lang: "yaml", code: `namespace: quest-staging
resources: [../../base]
images:
  - name: node
    newTag: "20-slim"              # bump here first; prod follows once staging looks good
configMapGenerator:
  - name: web-config
    literals: [GREETING=hello from staging]` },
          { path: "overlays/prod/kustomization.yaml", lang: "yaml", code: `namespace: quest-prod
resources: [../../base]
images:
  - name: node
    newTag: "20-slim"
replicas:
  - name: web
    count: 3
configMapGenerator:                # the name gets a hash of the content: change the config -> new name -> rollout
  - name: web-config
    literals: [GREETING=hello from production]` },
        ],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-staging > /dev/null
kubectl create namespace quest-prod > /dev/null

# Render an overlay without applying it: plain YAML, no templates. The interesting lines:
kubectl kustomize overlays/prod | grep -E '^kind:|^  name:|^  namespace:|^  replicas:|image:|^  GREETING'

# Apply both environments from the same base
kubectl apply -k overlays/staging
kubectl apply -k overlays/prod
kubectl -n quest-staging rollout status deployment/web --timeout=120s > /dev/null
kubectl -n quest-prod rollout status deployment/web --timeout=120s > /dev/null
kubectl get deployments -A -l app=web -o custom-columns='NAMESPACE:.metadata.namespace,REPLICAS:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image' --sort-by=.metadata.namespace

# Change prod's config, then preview what would change in the cluster before applying (like a PR check)
sed -i.bak 's/hello from production/hello from production (v2)/' overlays/prod/kustomization.yaml
kubectl diff -k overlays/prod | grep -E '^[-+] ' | grep -vE 'generation|creationTimestamp|resourceVersion|uid:'` }],
        explain: `- The **base** is plain, valid YAML with no environment in it. Its \`labels\` transformer adds \`app: web\` to every object and to selectors.
- Each **overlay** points at the base and says what's different: the namespace, the image tag, the replica count, the config. \`kubectl kustomize\` renders the result without touching the cluster; \`kubectl apply -k\` applies it.
- \`configMapGenerator\` names the ConfigMap \`web-config-<hash of its content>\` and rewrites every reference to it. Change the greeting and the name changes, so the Deployment's pod template changes, so a rollout happens. No more "I changed the config but the pods didn't notice".
- \`kubectl diff -k\` shows the plan: the Deployment will point at a new ConfigMap, and a new ConfigMap will be created. (The old one stays until something prunes it: Argo CD's prune, or \`kubectl apply --prune\`.)`,
        output: `  GREETING: hello from production
kind: ConfigMap
  name: web-config-d2f78gd7hf
  namespace: quest-prod
kind: Service
  name: web
  namespace: quest-prod
kind: Deployment
  name: web
  namespace: quest-prod
  replicas: 3
        image: node:20-slim
configmap/web-config-9k977578dm created
service/web created
deployment.apps/web created
configmap/web-config-d2f78gd7hf created
service/web created
deployment.apps/web created
NAMESPACE       REPLICAS   IMAGE
quest-prod      3          node:20-slim
quest-staging   1          node:20-slim
-            name: web-config-d2f78gd7hf
+            name: web-config-hcc5bgk6h7
+  GREETING: hello from production (v2)
+  name: web-config-hcc5bgk6h7
+  namespace: quest-prod`,
      },
      {
        title: "The same app as a Helm chart",
        note: "Templates with blanks, values to fill them. (Not run here: Helm is a separate tool.)",
        variants: [
          {
            lang: "yaml",
            code: `
# charts/web/Chart.yaml
apiVersion: v2
name: web
version: 1.4.0            # the chart's version
appVersion: "2.7.1"       # the app's version
---
# charts/web/values.yaml: the defaults, overridden per environment with -f or --set
replicaCount: 1
image: { repository: registry.example.com/web, tag: "" }   # empty: use appVersion
greeting: hello
---
# charts/web/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-web
  labels: {{- include "web.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: {{- include "web.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "web.selectorLabels" . | nindent 8 }}
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    spec:
      containers:
        - name: web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          env:
            - name: GREETING
              value: {{ .Values.greeting | quote }}
`,
          },
          {
            lang: "bash",
            code: `
helm template web ./charts/web -f values-prod.yaml              # render locally, like kubectl kustomize
helm upgrade --install web ./charts/web -n shop -f values-prod.yaml --atomic --wait --timeout 5m
helm history web -n shop                                         # every release revision
helm rollback web 41 -n shop                                     # back to revision 41
helm install monitoring oci://ghcr.io/prometheus-community/charts/kube-prometheus-stack   # third-party charts
`,
          },
        ],
        explain: `- \`{{ .Values.x }}\` are the blanks; \`values.yaml\` holds defaults; each environment passes its own values file.
- The \`checksum/config\` annotation is Helm's version of Kustomize's hashed names: when the config changes, the pod template changes, so the pods roll.
- \`--atomic\` rolls back automatically if the upgrade doesn't become healthy within the timeout.
- Helm stores each release revision as a Secret in the namespace, which is how \`history\` and \`rollback\` work.`,
      },
      {
        title: "GitOps: an Argo CD Application",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: web-prod, namespace: argocd }
spec:
  project: default
  source:
    repoURL: https://github.com/acme/web-deploy.git
    targetRevision: main
    path: overlays/prod                 # the Kustomize overlay from the first sample
  destination:
    server: https://kubernetes.default.svc
    namespace: web-prod
  syncPolicy:
    automated:
      selfHeal: true                    # undo manual kubectl changes
      prune: true                       # delete what was removed from Git
    syncOptions: [CreateNamespace=true]
`,
          },
        ],
        explain: `- Argo CD runs in the cluster, clones the repo, renders \`overlays/prod\` and compares it with the live objects every few minutes (or on a webhook).
- A merged pull request is a deploy; \`git revert\` is a rollback. CI builds and pushes the image, then opens a PR that bumps \`newTag\` in the overlay.
- Flux does the same with \`GitRepository\` and \`Kustomization\` objects.`,
      },
    ],
    interview: [
      {
        q: "What is GitOps and why use it over running kubectl apply in CI?",
        a: "GitOps means the desired state of the cluster is **declared in Git**, and an **in-cluster agent** (Argo CD, Flux) **pulls** and continuously **reconciles** it. Benefits over push-based CI: every change is a reviewed, audited commit; rollback is `git revert`; **drift detection** (and optional self-healing) catches manual changes; CI no longer needs cluster-admin credentials; and recreating a cluster is just pointing it at the repo. Costs: you need a separate config repo flow, secrets need special handling (Sealed Secrets, SOPS, External Secrets), and emergency hotfixes must go through Git too.",
        freq: "common",
      },
      {
        q: "Helm vs Kustomize: when would you use each?",
        a: "**Helm** when you need to **package and distribute** an app for others to install with many configurable options, or to consume third-party software (most of the ecosystem ships charts); it also tracks releases for upgrade/rollback. **Kustomize** for your **own apps across environments**: plain readable YAML, overlays patch what differs, no template language, built into kubectl. Many teams use both: Helm charts for third-party components, Kustomize overlays for in-house services, sometimes Kustomize patching rendered Helm output. Argo CD supports both natively.",
        freq: "common",
      },
      {
        q: "Someone hot-fixed production with kubectl edit, and Argo CD reverted it 3 minutes later, bringing the outage back. How do you prevent this?",
        a: "That's **selfHeal** doing its job: Git is the source of truth. The process fix is that emergency changes also go through Git: a fast-tracked PR (or a direct commit by on-call with post-review), which Argo CD then applies. Tooling options: Argo CD's **sync windows** or temporarily **disabling auto-sync** on that Application during an incident (documented in the runbook), making rollback a `git revert` that's as fast as kubectl, and restricting direct write access to production so manual edits are rare and audited. Also make deploys fast enough that 'fix forward via Git' is viable.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "In Argo CD, automated sync is on but selfHeal is off. Someone scales a Deployment with kubectl. What happens?",
        options: ["Argo CD reverts it immediately", "The app shows OutOfSync, but the change stays until the next Git commit or a manual sync", "Argo CD deletes the Deployment", "Git is updated with the new replica count"],
        answer: 1,
        explain: "Automated sync reacts to new commits; reverting live drift requires selfHeal.",
      },
      {
        q: "You delete a CronJob manifest from Git. With prune disabled, what does Argo CD do?",
        options: ["Deletes the CronJob", "Leaves it running and reports the app OutOfSync", "Recreates it from cache", "Fails the sync"],
        answer: 1,
        explain: "Prune is off by default to avoid accidental deletions, so removed resources are flagged rather than deleted.",
      },
      {
        q: "Where does Helm 3 store release history?",
        options: ["In Tiller", "In Secrets in the release namespace", "In the chart repository", "In etcd under /helm"],
        answer: 1,
        explain: "Helm 3 removed Tiller; each release revision is stored as a Secret in its namespace, enabling helm history and rollback.",
      },
      {
        q: "With Kustomize's configMapGenerator, you change a value in the generated ConfigMap. What happens on apply?",
        options: ["The ConfigMap is updated in place and pods keep running", "A ConfigMap with a new hashed name is created and the Deployment's reference changes, so pods roll", "Nothing until you restart pods", "kubectl rejects the change"],
        answer: 1,
        explain: "The name includes a hash of the content, so a change is a new object, and the template change triggers a rollout.",
      },
      {
        q: "What does kubectl diff -k overlays/prod do?",
        options: ["Applies the overlay", "Shows what would change in the live cluster if you applied it", "Compares two Git branches", "Validates YAML syntax only"],
        answer: 1,
        explain: "It's a server-side dry run compared with the live objects: the plan before the apply.",
      },
    ],
  },

  // ------------------------------------------------------------------ SECURITY
  {
    id: "k8s-extending-security",
    title: "RBAC, ServiceAccounts and Pod Security",
    tagline: "Who may do what: Roles and bindings, testing with kubectl auth can-i, ServiceAccount tokens from inside a pod, Pod Security Admission and securityContext.",
    difficulty: "intermediate",
    minutes: 22,
    visualizers: ["rbac"],
    concept: `## Explain it like I'm 10 🧸
In a big hotel, every person has a **key card**. The card says who you are: a guest, a cleaner, the manager. Each door checks: "is this card allowed in here?" A cleaner's card opens the rooms on their floor but not the safe; a guest's card opens one room.

In Kubernetes, every request to the API server comes with an identity (the key card): a person, or a program. Programs running in pods get their identity from a **ServiceAccount**. Then **RBAC** (role-based access control) decides: may this identity do *this verb* (get, list, create, delete...) on *this kind of thing* (pods, secrets...) in *this namespace*?

Two pieces make a rule:
- a **Role** is a list of permissions: "may read pods and their logs";
- a **RoleBinding** gives that list to someone: "the dashboard program gets pod-reader".

There's also a second guard at the hotel entrance: **Pod Security**. It checks every new pod *before* it moves in: "no master keys, no climbing through the walls". Pods that ask for dangerous powers (running as root, privileged mode) are turned away.

## Who can do what: RBAC
Requests pass **authentication** (certificates, OIDC tokens, ServiceAccount tokens) → **authorization** (RBAC) → **admission** → storage.
- **Role / ClusterRole** list allowed verbs on resources; **RoleBinding / ClusterRoleBinding** grant them to users, groups or **ServiceAccounts**.
- Least privilege: namespace-scoped Roles where possible; no wildcard verbs; be careful with \`secrets\`, \`pods/exec\`, \`create pods\` (which can mount any secret in the namespace) and anything that edits RBAC itself (escalation).
- Each workload gets its own **ServiceAccount**, with short-lived projected tokens. Set \`automountServiceAccountToken: false\` when a pod doesn't call the API.
- \`kubectl auth can-i --as=system:serviceaccount:shop:api list secrets\` checks permissions.

## The four RBAC objects
| Object | Scope | Contains |
|---|---|---|
| **Role** | one namespace | rules: apiGroups + resources (+ resourceNames) + verbs |
| **ClusterRole** | cluster-wide | same, plus cluster-scoped kinds (nodes, namespaces, PVs) and non-resource URLs |
| **RoleBinding** | one namespace | subjects → a Role, **or a ClusterRole applied only in that namespace** |
| **ClusterRoleBinding** | everywhere | subjects → a ClusterRole in every namespace |

RBAC is **allow-only**: no deny rules, permissions add up, and anything not allowed is forbidden. Built-in ClusterRoles \`view\`, \`edit\`, \`admin\` and \`cluster-admin\` cover most human needs; bind them per namespace with RoleBindings. Sub-resources are separate: \`pods/log\`, \`pods/exec\`, \`deployments/scale\`, \`websites/status\`.

## ServiceAccounts and tokens
Every namespace has a \`default\` ServiceAccount; give each workload its own (\`serviceAccountName\`). The kubelet mounts a **projected token** in \`/var/run/secrets/kubernetes.io/serviceaccount/\` with the cluster's CA and the namespace. The token is a signed JWT that's **bound to the pod** (it stops working when the pod is deleted), has an **expiry** and is refreshed automatically. Client libraries find it on their own ("in-cluster config"). Clouds can trust these tokens too (**workload identity**: IRSA and EKS Pod Identity on AWS, Workload Identity on GKE), so pods get cloud permissions without any stored keys.

## Admission control
Mutating and validating **admission webhooks** (and built-in **ValidatingAdmissionPolicy** with CEL) enforce rules on every object: required labels, no \`:latest\` tags, images only from your registry, resource requests required. **Kyverno** and **OPA Gatekeeper** are the common policy engines.

## Pod security
- **Pod Security Admission** enforces the Pod Security Standards per namespace label: \`privileged\`, \`baseline\`, \`restricted\`.
- \`securityContext\`: \`runAsNonRoot\`, \`readOnlyRootFilesystem\`, \`allowPrivilegeEscalation: false\`, drop \`ALL\` capabilities, \`seccompProfile: RuntimeDefault\`.
- Never mount the host's Docker/containerd socket or use \`privileged: true\` / \`hostPath\` / \`hostNetwork\` for ordinary apps: each one is a path to node takeover.

## Pod Security Standards, in short
| Level | Blocks |
|---|---|
| \`privileged\` | nothing |
| \`baseline\` | the known escapes: privileged containers, host namespaces and ports, hostPath, dangerous capabilities |
| \`restricted\` | everything in baseline, plus: must run as non-root, must drop ALL capabilities, no privilege escalation, seccomp RuntimeDefault |

Each namespace can \`enforce\` one level (reject), \`warn\` another (kubectl prints warnings) and \`audit\` a third (audit log). Roll out by warning first, then enforcing.

## Supply chain and runtime
Scan images in CI; sign them (cosign/Sigstore) and **verify signatures at admission**; pin by digest; generate SBOMs. At runtime, **Falco** or Tetragon detect suspicious syscalls (a shell spawned in a container, writes to /etc). Keep the control plane private, enable **audit logging**, encrypt Secrets at rest, and upgrade regularly (Kubernetes supports roughly the latest three minor versions).`,
    keyPoints: [
      "Every request is authenticated, then authorized by RBAC (allow-only rules: verbs on resources in namespaces), then admitted.",
      "Role/ClusterRole hold permissions; RoleBinding/ClusterRoleBinding grant them to users, groups or ServiceAccounts.",
      "Test with kubectl auth can-i --as=...; watch out for secrets, pods/exec, create pods and anything that edits RBAC.",
      "Pods get bound, expiring ServiceAccount tokens mounted as files; give each workload its own ServiceAccount.",
      "Pod Security Admission enforces privileged/baseline/restricted per namespace; securityContext makes pods pass restricted.",
    ],
    code: [
      {
        title: "A Role, a binding, and kubectl auth can-i",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "rbac.yaml", lang: "yaml", code: `# WHO: an identity for a program (people come from your login system; programs get ServiceAccounts)
apiVersion: v1
kind: ServiceAccount
metadata: { name: dashboard, namespace: quest-rbac }
---
# WHAT: a list of allowed actions (verbs) on kinds of objects (resources), in one namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: pod-reader, namespace: quest-rbac }
rules:
  - apiGroups: [""]                  # "" = the core group (pods, services, configmaps...)
    resources: [pods, pods/log]
    verbs: [get, list, watch]
---
# WHO gets WHAT: the binding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: dashboard-reads-pods, namespace: quest-rbac }
subjects:
  - { kind: ServiceAccount, name: dashboard, namespace: quest-rbac }
roleRef:
  { apiGroup: rbac.authorization.k8s.io, kind: Role, name: pod-reader }` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-rbac > /dev/null
kubectl create namespace quest-other > /dev/null
kubectl apply -f rbac.yaml

# Ask the API server: "would this be allowed?" (impersonating the ServiceAccount)
me=system:serviceaccount:quest-rbac:dashboard
check() { printf '%-42s %s\\n' "$*" "$(kubectl auth can-i "$@" --as=$me 2> /dev/null)"; }
check list pods -n quest-rbac
check get pods/log -n quest-rbac
check delete pods -n quest-rbac
check list secrets -n quest-rbac
check list pods -n quest-other
check list nodes

# Everything it may do in its namespace
kubectl auth can-i --list --as=$me -n quest-rbac | sed -nE 's/^(pods[^ ]*) .*(\\[[a-z ]+\\])$/\\1: \\2/p'` }],
        explain: `- The **ServiceAccount** is the identity, the **Role** lists allowed verbs on resources, the **RoleBinding** connects them, all in \`quest-rbac\`.
- \`kubectl auth can-i VERB RESOURCE --as=system:serviceaccount:NS:NAME\` asks the API server to evaluate RBAC for that identity. You need permission to impersonate (cluster admins have it).
- \`pods/log\` is a separate sub-resource and needs its own rule. Deleting pods, reading Secrets, anything in another namespace and cluster-scoped kinds like nodes are all **no**: never granted, so forbidden.
- \`can-i --list\` shows everything an identity may do in a namespace: a quick audit.`,
        output: `serviceaccount/dashboard created
role.rbac.authorization.k8s.io/pod-reader created
rolebinding.rbac.authorization.k8s.io/dashboard-reads-pods created
list pods -n quest-rbac                    yes
get pods/log -n quest-rbac                 yes
delete pods -n quest-rbac                  no
list secrets -n quest-rbac                 no
list pods -n quest-other                   no
list nodes                                 no
pods/log: [get list watch]
pods: [get list watch]`,
      },
      {
        title: "Calling the API from inside a pod",
        note: "The same thing every operator and controller does.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-token > /dev/null
kubectl -n quest-token create serviceaccount reader > /dev/null
kubectl -n quest-token create role pod-reader --verb=get,list --resource=pods > /dev/null
kubectl -n quest-token create rolebinding reader --role=pod-reader --serviceaccount=quest-token:reader > /dev/null

# A pod running as that ServiceAccount gets a short-lived token, mounted as a file
kubectl -n quest-token run app --image=node:20-slim --overrides='{"spec": {"serviceAccountName": "reader"}}' -- sleep 3600 > /dev/null
kubectl -n quest-token wait --for=condition=Ready pod/app --timeout=120s > /dev/null
kubectl -n quest-token exec app -- ls /var/run/secrets/kubernetes.io/serviceaccount

# From inside the pod, call the API server with that token, exactly like a controller or operator does
kubectl -n quest-token exec app -- node -e "
  const fs = require('fs'), https = require('https');
  const dir = '/var/run/secrets/kubernetes.io/serviceaccount';
  const call = (path) => new Promise((ok) => https.get({
      host: 'kubernetes.default.svc', path,
      ca: fs.readFileSync(dir + '/ca.crt'),
      headers: { Authorization: 'Bearer ' + fs.readFileSync(dir + '/token', 'utf8') },
    }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => ok([res.statusCode, JSON.parse(b)])); }));
  (async () => {
    let [code, body] = await call('/api/v1/namespaces/quest-token/pods');
    console.log('GET pods    ->', code, body.items.map((p) => p.metadata.name));
    [code, body] = await call('/api/v1/namespaces/quest-token/secrets');
    console.log('GET secrets ->', code, body.reason);
  })();"

# The token is a signed JWT: it says who it is, which pod it belongs to, and it expires
kubectl -n quest-token exec app -- node -e "
  const t = require('fs').readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8').split('.')[1];
  const c = JSON.parse(Buffer.from(t, 'base64url'));
  console.log('subject:      ', c.sub);
  console.log('bound to pod: ', c['kubernetes.io'].pod.name);
  console.log('expires:      ', c.exp > c.iat ? 'yes (the kubelet swaps in a fresh token before then)' : 'never');"` }],
        explain: `- The pod runs as ServiceAccount \`reader\`, so the kubelet mounts its token, the cluster's CA certificate and the namespace name.
- Inside the cluster, the API server is the Service \`kubernetes.default.svc\`. The app sends \`Authorization: Bearer <token>\` and verifies the server with \`ca.crt\`: that's all "in-cluster config" is.
- Listing pods works (**200**); listing Secrets is **403 Forbidden**: RBAC applies to programs exactly as to people.
- The token's claims name the ServiceAccount and the **pod** it's bound to; it expires and the kubelet swaps in a fresh one. A stolen token stops working when the pod is gone. If a pod never calls the API, set \`automountServiceAccountToken: false\`.`,
        output: `ca.crt
namespace
token
GET pods    -> 200 [ 'app' ]
GET secrets -> 403 Forbidden
subject:       system:serviceaccount:quest-token:reader
bound to pod:  app
expires:       yes (the kubelet swaps in a fresh token before then)`,
      },
      {
        title: "Pod Security Admission",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# Pod Security Admission: a namespace label decides how strict the rules are (privileged / baseline / restricted)
kubectl create namespace quest-locked > /dev/null
kubectl label namespace quest-locked pod-security.kubernetes.io/enforce=restricted > /dev/null

# A careless pod: runs as root, could gain privileges
kubectl -n quest-locked apply -f - 2>&1 <<'YAML' | sed -E 's/^Error from server \\(Forbidden\\): error when creating "STDIN": //; s/violates PodSecurity "restricted:latest": /violates PodSecurity "restricted":\\n  /; s/\\), /),\\n  /g'
apiVersion: v1
kind: Pod
metadata: { name: careless }
spec:
  containers:
    - { name: app, image: node:20-slim, command: ["sleep", "3600"] }
YAML

# The same pod, hardened. Accepted.
kubectl -n quest-locked apply -f - <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: hardened }
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000                    # the "node" user in this image
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: app
      image: node:20-slim
      command: ["sleep", "3600"]
      securityContext:
        allowPrivilegeEscalation: false
        capabilities: { drop: [ALL] }
YAML` }],
        explain: `- One label on the namespace, \`pod-security.kubernetes.io/enforce=restricted\`, and the API server checks every pod created there.
- A pod with no security settings breaks four rules at once, and the error lists exactly which fields to set. It's rejected at creation (for a Deployment, the ReplicaSet can't create pods: look at \`kubectl describe rs\`).
- The hardened pod sets them all and is accepted. These settings cost nothing for most apps, so make them the default in your templates.`,
        output: `pods "careless" is forbidden: violates PodSecurity "restricted":
  allowPrivilegeEscalation != false (container "app" must set securityContext.allowPrivilegeEscalation=false),
  unrestricted capabilities (container "app" must set securityContext.capabilities.drop=["ALL"]),
  runAsNonRoot != true (pod or container "app" must set securityContext.runAsNonRoot=true),
  seccompProfile (pod or container "app" must set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost")
pod/hardened created`,
      },
      {
        title: "What a hardened container can't do",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-ctx > /dev/null
kubectl -n quest-ctx apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: app }
spec:
  terminationGracePeriodSeconds: 1
  securityContext:
    runAsUser: 1000
    runAsNonRoot: true
  containers:
    - name: app
      image: node:20-slim
      command: ["sleep", "3600"]
      securityContext:
        readOnlyRootFilesystem: true         # an attacker can't drop tools into the image
        allowPrivilegeEscalation: false
        capabilities: { drop: [ALL] }
      volumeMounts: [{ name: tmp, mountPath: /tmp }]
  volumes:
    - name: tmp
      emptyDir: {}                           # the one writable place
YAML
kubectl -n quest-ctx wait --for=condition=Ready pod/app --timeout=120s > /dev/null
kubectl -n quest-ctx exec app -- sh -c '
  echo "whoami:            $(whoami)"
  touch /usr/local/bin/backdoor 2>/dev/null && echo "write to /usr:     allowed" || echo "write to /usr:     denied (read-only filesystem)"
  touch /tmp/cache 2>/dev/null && echo "write to /tmp:     allowed (emptyDir)" || echo "write to /tmp:     denied"
  echo "capabilities:      $(grep CapEff /proc/self/status | cut -f2)  (all zeros: none at all)"
  echo "no_new_privs:      $(grep NoNewPrivs /proc/self/status | cut -f2)  (setuid binaries cannot raise privileges)"'` }],
        explain: `- \`runAsUser: 1000\` runs the process as the image's \`node\` user, not root.
- \`readOnlyRootFilesystem\` blocks writes everywhere except mounted volumes, so an attacker can't drop tools into the image; the \`emptyDir\` at \`/tmp\` is the one writable place the app needs.
- Dropping \`ALL\` capabilities leaves the effective capability set at zero, and \`allowPrivilegeEscalation: false\` sets the kernel's \`no_new_privs\` flag, so setuid programs like \`sudo\` can't gain root.`,
        output: `whoami:            node
write to /usr:     denied (read-only filesystem)
write to /tmp:     allowed (emptyDir)
capabilities:      0000000000000000  (all zeros: none at all)
no_new_privs:      1  (setuid binaries cannot raise privileges)`,
      },
    ],
    interview: [
      {
        q: "How would you secure a multi-tenant Kubernetes cluster?",
        a: "**Identity & access**: SSO via OIDC, namespace-scoped RBAC per team, no cluster-admin for humans day-to-day, ServiceAccount per workload with minimal rights. **Isolation**: namespace per tenant, **ResourceQuotas/LimitRanges**, **default-deny NetworkPolicies**, Pod Security Admission at `restricted`. **Admission policy** (Kyverno/Gatekeeper): trusted registries only, signed images, required requests, no privileged/hostPath/hostNetwork. **Secrets**: encryption at rest via KMS, external secret stores, workload identity. **Supply chain**: scanning, SBOMs, signature verification. **Runtime**: Falco/Tetragon, audit logs shipped off-cluster. For truly untrusted tenants, use sandboxed runtimes (gVisor, Kata) or separate clusters, since namespaces are a soft boundary.",
        freq: "common",
      },
      {
        q: "Explain Role, ClusterRole, RoleBinding and ClusterRoleBinding. How would you give a team read-only access to their namespace?",
        a: "**Roles** (namespaced) and **ClusterRoles** (cluster-wide, or reusable templates) list rules: API groups, resources, optional resource names and verbs. **RoleBindings** grant a Role *or a ClusterRole* to subjects (users, groups, ServiceAccounts) within one namespace; **ClusterRoleBindings** grant a ClusterRole everywhere. RBAC is additive and allow-only. For read-only team access: a **RoleBinding in their namespace** to the built-in `view` ClusterRole, with the subject being their **group** from the identity provider (OIDC), not individual users. Verify with `kubectl auth can-i --list --as=jane --as-group=team-a -n team-a`. `view` deliberately excludes Secrets.",
        freq: "very-common",
      },
      {
        q: "How does a pod authenticate to the Kubernetes API, and to a cloud provider?",
        a: "To Kubernetes: the kubelet mounts a **projected ServiceAccount token** (a JWT signed by the API server, audience-scoped, bound to the pod, expiring and auto-refreshed) plus the CA bundle; client libraries use them against `https://kubernetes.default.svc`, and RBAC authorizes the ServiceAccount. To a cloud: **workload identity**: the cloud's IAM trusts the cluster's OIDC issuer, so the pod exchanges its projected token (with the cloud as audience) for short-lived cloud credentials mapped to its ServiceAccount (IRSA / EKS Pod Identity on AWS, GKE Workload Identity, Azure Workload Identity). No long-lived keys in Secrets. Disable token automount for pods that don't need the API.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "In what order does the API server process a write request?",
        options: ["Admission → authn → RBAC → etcd", "Authentication → authorization (RBAC) → admission → etcd", "RBAC → etcd → admission", "etcd → admission → RBAC"],
        answer: 1,
        explain: "Who are you, are you allowed, does the object pass policy (and get mutated), then it's persisted.",
      },
      {
        q: "Why is 'create pods' in a namespace a sensitive permission?",
        options: [
          "Pods are expensive",
          "A pod can mount any Secret and use any ServiceAccount in that namespace, so it grants access to those credentials",
          "It allows editing RBAC directly",
          "It disables admission",
        ],
        answer: 1,
        explain: "Creating a pod lets you read every Secret in the namespace by mounting it, and act as any ServiceAccount there.",
      },
      {
        q: "A RoleBinding in namespace team-a references the ClusterRole edit. Where can the subject edit things?",
        options: ["Everywhere", "Only in team-a", "Nowhere: RoleBindings can't reference ClusterRoles", "Only cluster-scoped objects"],
        answer: 1,
        explain: "A RoleBinding grants a ClusterRole's rules only within its own namespace: the usual way to reuse built-in roles.",
      },
      {
        q: "A namespace enforces the restricted Pod Security level. Which pod is rejected?",
        options: ["One running as UID 1000 with all capabilities dropped", "One with no securityContext at all", "One with readOnlyRootFilesystem: false", "One with resource limits"],
        answer: 1,
        explain: "restricted requires runAsNonRoot, dropping ALL capabilities, no privilege escalation and a seccomp profile. readOnlyRootFilesystem isn't required.",
      },
    ],
  },

  // ------------------------------------------------------------------ CONTROLLERS
  {
    id: "k8s-controllers",
    title: "Controllers, CRDs and operators",
    tagline: "How Kubernetes really works inside: watches, owner references and garbage collection, finalizers, and teaching the API a new kind of object.",
    difficulty: "advanced",
    minutes: 24,
    diagram: {
      title: "An operator reconciling a custom resource",
      nodes: [
        { id: "user", label: "kubectl / GitOps", sub: "applies a PostgresCluster", kind: "client", x: 90, y: 280 },
        { id: "api", label: "kube-apiserver", sub: "authn → RBAC → admission", kind: "control", x: 330, y: 280 },
        { id: "admission", label: "Admission webhooks", sub: "Kyverno / Gatekeeper", kind: "gateway", x: 330, y: 80 },
        { id: "etcd", label: "etcd", sub: "CRD objects stored like built-ins", kind: "db", x: 330, y: 480 },
        { id: "op", label: "Postgres operator", sub: "controller: watch → diff → act", kind: "control", x: 620, y: 280 },
        { id: "sts", label: "StatefulSet + Services", sub: "pods, PVCs, Secrets", kind: "node", x: 880, y: 160 },
        { id: "backup", label: "Object storage", sub: "WAL + base backups", kind: "storage", x: 880, y: 420 },
      ],
      edges: [
        { from: "user", to: "api", label: "HTTPS" },
        { from: "api", to: "admission", label: "validate/mutate", dashed: true },
        { from: "api", to: "etcd" },
        { from: "op", to: "api", label: "watch + patch" },
        { from: "op", to: "sts" },
        { from: "op", to: "backup" },
      ],
      flows: [
        {
          name: "Create a database",
          path: ["user", "api", "admission", "api", "etcd", "api", "op", "sts"],
          steps: [
            "You apply kind: PostgresCluster with spec.instances: 3. The API server knows this type because the operator installed a CustomResourceDefinition.",
            "Admission webhooks run: a policy engine checks that the object is allowed (e.g. requires backups, forbids public services) and can add defaults.",
            "Admitted. The API server validates against the CRD's OpenAPI schema.",
            "The object is stored in etcd like any built-in resource.",
            "The operator's controller has a watch on PostgresCluster objects and receives the event.",
            "It reconciles: compares spec (3 instances) with what exists (nothing).",
            "It creates the StatefulSet, Services, Secrets and PDB, then writes status back (phase, primary pod). The same loop handles failover, upgrades and resizing.",
          ],
        },
        {
          name: "The primary dies",
          path: ["sts", "op", "api", "op", "backup"],
          steps: [
            "The primary pod's node fails and its health checks stop answering. The operator notices through its watch and its own probes.",
            "It decides to fail over, encoding the runbook a human DBA would follow: promote the most up-to-date replica and patch the read-write Service to point at it.",
            "The API server confirms the change; clients reconnect to the new primary. The operator records the new primary in the resource's status.",
            "Continuous WAL archiving to object storage keeps point-in-time recovery possible throughout, and the old primary is rebuilt as a replica.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Every lesson so far had the same hidden helper: a little robot that **watches** one kind of thing and **fixes** it. The ReplicaSet robot watches ReplicaSets and counts pods. The Deployment robot watches Deployments and makes ReplicaSets. The endpoints robot watches pods and keeps Services' lists right. Each robot only does one small job, over and over: *look, compare, fix*.

Here's the exciting part: **you can build your own robot**. First you teach Kubernetes a new word, say **Website**, so people can write "I want a Website for blog.example.com with 2 copies" just like they write Deployments. That's a **CustomResourceDefinition (CRD)**. Then you write a robot (a **controller**) that watches Websites and makes the Deployments and Services they need. A CRD plus a smart controller that knows how to run some software (backups, upgrades, failover) is called an **operator**: a robot with an expert's know-how.

Two more ideas the robots rely on:
- **Owner references**: "this pod belongs to that ReplicaSet". When the owner is deleted, a cleaning robot (the **garbage collector**) deletes everything it owned.
- **Finalizers**: a "wait, don't delete me yet" sticky note. A robot that must clean something up first (a cloud disk, a DNS record) puts its note on the object, cleans up, then removes the note.

## Watches: how controllers learn about changes
Controllers don't poll. They **list** the objects once, then open a **watch**: one long HTTP request on which the API server streams \`ADDED\`, \`MODIFIED\` and \`DELETED\` events, each carrying the whole object and a \`resourceVersion\`. If the watch breaks, the controller resumes from the last resourceVersion, or re-lists if that's too old (\`410 Gone\`). Client libraries wrap this as **informers** with a local cache, so reads don't hit the API server, and a **work queue** that de-duplicates keys: ten quick changes to one object become one reconcile.

## Extending Kubernetes
Everything in Kubernetes is a **resource** stored by the API server plus a **controller** that reconciles it. You can add both:
- A **CustomResourceDefinition (CRD)** adds a new type (\`PostgresCluster\`, \`Certificate\`, \`KafkaTopic\`) with an OpenAPI schema. You get kubectl, RBAC, watch and storage for free.
- A **controller** watches those objects and runs a reconcile loop: read desired state (spec), observe actual state, act to converge, write \`status\`. Reconcile must be **idempotent** and **level-triggered**: it gets "something changed, look again", not a precise diff, and must handle being run repeatedly or after a crash.
- An **operator** = CRDs + controller that encodes operational knowledge: provisioning, failover, backups, upgrades. Examples: cert-manager, CloudNativePG, Strimzi (Kafka), Prometheus Operator. Built with **Kubebuilder** / controller-runtime (Go) or the Operator SDK.

Useful patterns: **finalizers** (block deletion until cleanup such as deleting a cloud resource is done; a stuck finalizer is why objects hang in Terminating), **owner references** (garbage-collect children with the parent), and **status conditions**.

## Owner references and garbage collection
\`metadata.ownerReferences\` points to the owning object (kind, name, uid; \`controller: true\` for the managing one). The garbage collector deletes dependents whose owners are gone. Deletion has three **propagation policies**:
- \`Background\` (default): delete the owner now; the GC removes dependents afterwards;
- \`Foreground\`: dependents first, owner last (the owner waits with a \`foregroundDeletion\` finalizer);
- \`Orphan\`: delete only the owner; dependents stay, with the reference removed (\`kubectl delete --cascade=orphan\`). Useful to replace a Deployment without touching its pods.

Owners must be in the same namespace as their dependents (or cluster-scoped).

## CustomResourceDefinitions
A CRD declares a group, versions, a kind and its names, and an **OpenAPI v3 schema**. The API server then serves the new kind with everything built in: kubectl, RBAC, watch, \`kubectl explain\`, server-side validation, **defaults**, printer columns, and the \`/status\` and \`/scale\` sub-resources. Add **CEL validation rules** (\`x-kubernetes-validations\`) for cross-field checks like "maxReplicas >= minReplicas". Version CRDs like any API (\`v1alpha1\` → \`v1\`), with a conversion webhook when the shape changes.

## Server-side apply in controllers
A controller that writes objects should say **"make it look like this"** rather than read-modify-write. Server-side apply (\`PATCH\` with \`application/apply-patch+yaml\` and a \`fieldManager\`) does that: the API server merges your intent, tracks which fields you own, and with \`force\` takes them back from anyone who changed them by hand. That's how drift gets corrected. Project 2 builds an operator this way.

## Building operators
Go with **Kubebuilder** / **controller-runtime** (the Operator SDK builds on it) is the standard; Python has **kopf**, Java has the Java Operator SDK. The rules don't change: reconcile from the whole current state, be idempotent, write status and conditions, use owner references for cleanup and finalizers only for **external** resources, and handle conflicts by retrying.`,
    keyPoints: [
      "Controllers list then watch the API server; informers cache objects locally and a work queue de-duplicates reconciles.",
      "Reconcile is level-triggered and idempotent: compute the desired state from the spec, compare with reality, act, write status.",
      "ownerReferences drive garbage collection; deletion propagates Background (default), Foreground or Orphan.",
      "Finalizers block deletion until a controller cleans up external resources; a missing controller leaves objects stuck in Terminating.",
      "A CRD adds a new kind with schema validation, defaults, printer columns and status; an operator is CRDs plus a controller with operational know-how.",
    ],
    code: [
      {
        title: "A watch: changes streamed as they happen",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-watch > /dev/null

# Controllers don't poll. They open a WATCH: one long HTTP request that streams every change as it happens.
kubectl get --raw '/api/v1/namespaces/quest-watch/configmaps?watch=true' > events.jsonl &
watcher=$!
sleep 1

kubectl -n quest-watch create configmap settings --from-literal=theme=light
kubectl -n quest-watch patch configmap settings -p '{"data": {"theme": "dark"}}'
kubectl -n quest-watch delete configmap settings
sleep 1
kill $watcher; wait $watcher 2> /dev/null

echo "what the watcher received:"
python3 - <<'PY'
import json
for line in open("events.jsonl"):
    event = json.loads(line)
    obj = event["object"]
    if obj["metadata"]["name"] == "settings":   # (every namespace also has a kube-root-ca.crt ConfigMap)
        print("  %-9s %s/%s  theme=%s" % (event["type"], obj["kind"], obj["metadata"]["name"], obj["data"]["theme"]))
PY` }],
        explain: `- \`?watch=true\` turns a normal GET into a stream: the response never ends, and each change arrives as one JSON line with \`type\` and the full \`object\`.
- \`kubectl get --watch\` (\`-w\`) is the same thing with nicer printing. Every controller in Kubernetes is built on this.
- Even a DELETED event carries the object's last state, so a controller knows what just went away.`,
        output: `configmap/settings created
configmap/settings patched
configmap "settings" deleted from quest-watch namespace
what the watcher received:
  ADDED     ConfigMap/settings  theme=light
  MODIFIED  ConfigMap/settings  theme=dark
  DELETED   ConfigMap/settings  theme=dark`,
      },
      {
        title: "Owner references, orphans and cascading deletes",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-owners > /dev/null
kubectl -n quest-owners create deployment web --image=node:20-slim --replicas=3 -- \\
  node -e "setInterval(() => {}, 1e9); process.on('SIGTERM', () => process.exit(0))" > /dev/null
kubectl -n quest-owners rollout status deployment/web --timeout=120s > /dev/null
count() { echo "deployments: $(kubectl -n quest-owners get deploy --no-headers 2>/dev/null | wc -l | tr -d ' '), replicasets: $(kubectl -n quest-owners get rs --no-headers 2>/dev/null | wc -l | tr -d ' '), pods: $(kubectl -n quest-owners get pods --no-headers 2>/dev/null | wc -l | tr -d ' ')"; }

# Every pod carries an ownerReference: "I belong to ReplicaSet web-xxxx"
kubectl -n quest-owners get pods -o jsonpath='{range .items[*]}{.metadata.ownerReferences[0].kind}{" controller="}{.metadata.ownerReferences[0].controller}{"\\n"}{end}' | sort | uniq -c | awk '{print $1 " pods owned by a " $2 ", " $3}'
echo "start:          $(count)"

# --cascade=orphan deletes ONLY the Deployment; what it owned is left behind (orphaned)
kubectl -n quest-owners delete deployment web --cascade=orphan > /dev/null
echo "orphan delete:  $(count)"

# Deleting the ReplicaSet normally: the garbage collector follows ownerReferences and removes the pods too
kubectl -n quest-owners delete rs --all --cascade=foreground > /dev/null
until [ "$(kubectl -n quest-owners get pods --no-headers 2>/dev/null | wc -l | tr -d ' ')" = 0 ]; do sleep 0.5; done
echo "cascade delete: $(count)"` }],
        explain: `- Each pod points at its ReplicaSet with \`controller=true\`: that ReplicaSet manages it.
- \`--cascade=orphan\` deletes just the Deployment. The ReplicaSet and its pods stay, running, now ownerless. (Create a Deployment with the same selector and it adopts them.)
- Deleting the ReplicaSet normally (\`foreground\` here) lets the garbage collector follow the references and delete the pods too.`,
        output: `3 pods owned by a ReplicaSet, controller=true
start:          deployments: 1, replicasets: 1, pods: 3
orphan delete:  deployments: 0, replicasets: 1, pods: 3
cascade delete: deployments: 0, replicasets: 0, pods: 0`,
      },
      {
        title: "A finalizer holds back a delete",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-final > /dev/null
# A finalizer is a "don't delete me yet" note. Some controller promised to clean up first (a cloud disk, a DNS record...).
kubectl -n quest-final apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: ConfigMap
metadata:
  name: bucket
  finalizers: [quest.dsa.dev/delete-cloud-bucket]
data: { region: eu-west-1 }
YAML

kubectl -n quest-final delete configmap bucket --wait=false
# Still here! Deletion is only "requested": deletionTimestamp is set and the finalizer blocks it.
kubectl -n quest-final get configmap bucket -o jsonpath='still exists: deletionTimestamp set={.metadata.deletionTimestamp}, finalizers={.metadata.finalizers}{"\\n"}' \\
  | sed -E 's/set=[0-9TZ:-]+/set=yes/'

# The controller does its cleanup, then removes its finalizer. Now the object really goes away.
kubectl -n quest-final patch configmap bucket --type=json -p='[{"op": "remove", "path": "/metadata/finalizers"}]' > /dev/null
kubectl -n quest-final get configmap bucket 2>&1 | sed -E 's/^Error from server \\(NotFound\\): //'
# (A namespace stuck in "Terminating" for hours is usually an object whose controller is gone, so nobody removes its finalizer.)` }],
        explain: `- The ConfigMap carries a finalizer, a promise that some controller will clean up first (here, an imaginary cloud bucket).
- \`kubectl delete\` only sets \`deletionTimestamp\`; the object stays (\`--wait=false\` stops kubectl from waiting forever). A real controller would see that timestamp in its watch, delete the bucket, then remove its finalizer.
- We play the controller and remove it by hand, and the object disappears. Doing that for real without the cleanup leaks the external resource: only do it when the controller is truly gone and you've cleaned up yourself.`,
        output: `configmap "bucket" deleted from quest-final namespace
still exists: deletionTimestamp set=yes, finalizers=["quest.dsa.dev/delete-cloud-bucket"]
configmaps "bucket" not found`,
      },
      {
        title: "A CustomResourceDefinition",
        note: "Teach the API server a new kind: Website.",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "crd.yaml", lang: "yaml", code: `# Teach the API server a new kind of object: Website
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: websites.quest.dsa.dev          # <plural>.<group>
spec:
  group: quest.dsa.dev
  scope: Namespaced
  names: { kind: Website, plural: websites, singular: website, shortNames: [ws] }
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:                # the API server validates every Website against this
          type: object
          properties:
            spec:
              type: object
              required: [domain]
              properties:
                domain: { type: string, pattern: '^[a-z0-9.-]+$' }
                replicas: { type: integer, minimum: 1, maximum: 5, default: 1 }
            status:
              type: object
              properties:
                ready: { type: boolean }
      subresources:
        status: {}                      # status is written separately, by the controller
      additionalPrinterColumns:         # extra columns for \`kubectl get websites\`
        - { name: Domain, type: string, jsonPath: .spec.domain }
        - { name: Replicas, type: integer, jsonPath: .spec.replicas }` }],
        variants: [{ lang: "bash", code: `kubectl apply -f crd.yaml
kubectl wait --for=condition=Established crd/websites.quest.dsa.dev --timeout=60s > /dev/null
kubectl create namespace quest-crd > /dev/null

# Now Website is a kind like any other: kubectl, RBAC, watch... all just work
kubectl -n quest-crd apply -f - <<'YAML'
apiVersion: quest.dsa.dev/v1
kind: Website
metadata: { name: blog }
spec: { domain: blog.example.com, replicas: 2 }
---
apiVersion: quest.dsa.dev/v1
kind: Website
metadata: { name: shop }
spec: { domain: shop.example.com }       # replicas left out: the schema's default fills it in
YAML
kubectl -n quest-crd get websites -o custom-columns='NAME:.metadata.name,DOMAIN:.spec.domain,REPLICAS:.spec.replicas'

# Bad input is rejected before it is ever stored
echo "a Website with a bad domain and 50 replicas:"
kubectl -n quest-crd apply -f - 2>&1 <<'YAML' | grep '^\\*' | sort   # sorted: the API server lists errors in no fixed order
apiVersion: quest.dsa.dev/v1
kind: Website
metadata: { name: huge }
spec: { domain: "Not A Domain!", replicas: 50 }
YAML
echo "(But nothing happens yet: no controller is watching Websites. That's what an operator adds.)"` }],
        explain: `- The CRD's name is \`<plural>.<group>\`. Once it's **Established**, \`kubectl get websites\` (or \`ws\`) works like any built-in kind.
- The schema's \`default: 1\` filled in \`replicas\` for \`shop\`: defaults are applied by the API server, so every client sees the same object.
- Invalid objects (a domain with spaces, 50 replicas) are rejected with clear messages before they're stored, so the controller never has to handle them.
- \`subresources.status\` makes \`/status\` a separate endpoint: users write the spec, the controller writes the status, and RBAC can tell them apart.
- A CRD alone stores data and does nothing else. Project 2 writes the controller that turns Websites into Deployments and Services.`,
        output: `customresourcedefinition.apiextensions.k8s.io/websites.quest.dsa.dev created
website.quest.dsa.dev/blog created
website.quest.dsa.dev/shop created
NAME   DOMAIN             REPLICAS
blog   blog.example.com   2
shop   shop.example.com   1
a Website with a bad domain and 50 replicas:
* spec.domain: Invalid value: "Not A Domain!": spec.domain in body should match '^[a-z0-9.-]+$'
* spec.replicas: Invalid value: 50: spec.replicas in body should be less than or equal to 5
(But nothing happens yet: no controller is watching Websites. That's what an operator adds.)`,
      },
    ],
    interview: [
      {
        q: "What is a Kubernetes operator, and when would you write one?",
        a: "An operator is a **custom controller** plus **CRDs** that manages an application the way a human operator would: you declare `kind: PostgresCluster, instances: 3, backups: daily`, and its reconcile loop creates StatefulSets, Services and Secrets, then handles **day-2 operations**: failover, backups, version upgrades, scaling, certificate rotation. Write one when the operational logic is complex, repeated across many instances, and expressible as reconcile-to-desired-state (internal platforms: \"give me a database/queue/tenant\"). Don't write one for a simple stateless app (Helm/Kustomize is enough) or when a mature community operator already exists.",
        freq: "common",
      },
      {
        q: "What does 'level-triggered' mean for a controller, and why does it matter?",
        a: "The controller reacts to the **current state** (the level), not to individual events (edges). When anything changes, it is told \"look at object X again\", re-reads desired and actual state, and converges. This matters because events can be **missed, duplicated or coalesced** (controller restarts, watch disconnects, many rapid updates), and because the controller itself can crash midway. A level-triggered, **idempotent** reconcile simply runs again and reaches the right state. Edge-triggered logic (\"on create, do A\") breaks under these conditions.",
        freq: "occasional",
      },
      {
        q: "A namespace has been stuck in Terminating for an hour. What's going on?",
        a: "Some object inside it (or the namespace itself) has a **finalizer** that hasn't been removed. Finalizers are keys in `metadata.finalizers` that block deletion until their controller finishes cleanup. If that controller is gone (uninstalled operator) or failing (can't delete a cloud resource), the object never goes away. Debug: `kubectl get ns X -o yaml` (status conditions list remaining resources/finalizers), then `kubectl api-resources --verbs=list --namespaced -o name | xargs -n1 kubectl get -n X`. Fix the controller, or, if you're sure the external resource is cleaned up, remove the finalizer with a patch. Also check for unavailable aggregated APIs (a broken metrics-server APIService blocks namespace deletion).",
        freq: "occasional",
      },
      {
        q: "How does garbage collection work in Kubernetes, and what are the deletion propagation policies?",
        a: "Dependents carry `ownerReferences` to their owners (e.g. Pod → ReplicaSet → Deployment). The **garbage collector** watches the graph and deletes objects whose owners no longer exist. On delete you choose **propagationPolicy**: `Background` (default: owner deleted immediately, dependents cleaned up asynchronously), `Foreground` (owner gets a `foregroundDeletion` finalizer and stays until dependents with `blockOwnerDeletion` are gone), or `Orphan` (only the owner is deleted; dependents remain with the reference stripped, e.g. `kubectl delete deploy x --cascade=orphan` to swap controllers without restarting pods). Operators set owner references on everything they create so deleting the custom resource cleans up, and use finalizers only for resources outside the cluster.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "What is a finalizer?",
        options: ["A hook that runs after a container exits", "A key that blocks an object's deletion until a controller removes it after cleanup", "The last container in a pod", "An admission webhook"],
        answer: 1,
        explain: "Finalizers implement pre-delete cleanup; a missing controller leaves objects stuck in Terminating.",
      },
      {
        q: "kubectl delete deployment web --cascade=orphan. What happens to its ReplicaSet and pods?",
        options: ["Deleted with it", "They keep running, without an owner", "They're moved to the default namespace", "The command is rejected"],
        answer: 1,
        explain: "Orphan propagation deletes only the owner and strips the ownerReference from dependents.",
      },
      {
        q: "Why do controllers use a watch instead of polling the API every second?",
        options: ["Polling is forbidden by RBAC", "A watch streams each change once, with low latency and far less load than repeated LISTs", "Watches are encrypted", "Polling can't see deleted objects"],
        answer: 1,
        explain: "List once, then watch: that's the informer pattern behind every controller.",
      },
      {
        q: "A CRD's schema sets default: 1 for spec.replicas. Who applies the default?",
        options: ["kubectl", "The API server, when the object is created or read", "The controller", "etcd"],
        answer: 1,
        explain: "Structural schema defaulting happens in the API server, so every client sees the same value.",
      },
    ],
  },

  // ------------------------------------------------------------------ DEBUGGING
  {
    id: "k8s-debugging",
    title: "Debugging Kubernetes",
    tagline: "A systematic playbook: read the status, follow the events, check the traffic path, and get a shell into images that don't have one.",
    difficulty: "intermediate",
    minutes: 22,
    visualizers: ["podstatus", "incident"],
    concept: `## Explain it like I'm 10 🧸
When your bike won't go, you don't take it all apart at once. You check things in order: are the tyres flat? Is the chain on? Are the brakes stuck? Each check is quick and rules out a whole family of problems.

Debugging Kubernetes is the same. The **STATUS** column is your first clue, like "the wheel won't turn". It tells you which family of problem you have: waiting for a place to run (Pending), can't get the image (ImagePullBackOff), keeps crashing (CrashLoopBackOff), running but not ready. Then you look at the **events** (what the cluster tried and what went wrong) and the **logs** (what the app itself said). And if traffic doesn't arrive, you walk the road it travels, step by step, until you find the broken bridge: the name, the Service, its list of pods, the pod itself, the locks on the doors.

## Work top-down, then narrow
1. **What's the symptom and blast radius?** One pod, one Deployment, one node, one zone, the whole cluster? Did something change (a deploy, a config, a node upgrade, a cert expiry)?
2. **Look at the objects**: \`kubectl get\` → \`describe\` (Events at the bottom are gold) → \`logs\` (\`--previous\` for crashed containers).
3. **Follow the chain**: Deployment → ReplicaSet → Pod → container → node. A Deployment that won't progress usually has a ReplicaSet whose pods fail for a reason shown on the pod.

Practise with the triage drill: eight real failure modes, each with the output you'd actually see.

## Pod status cheat sheet
| Status | Usual causes | First command |
|---|---|---|
| **Pending** | No node fits (requests, taints, affinity), unbound PVC, quota | \`describe pod\` → FailedScheduling |
| **ContainerCreating** (stuck) | Volume attach/mount, CNI can't assign an IP, image still pulling | \`describe pod\` events |
| **ImagePullBackOff / ErrImagePull** | Wrong tag, missing pull secret, registry rate limits, private registry | Event text: "not found" vs "unauthorized" |
| **CreateContainerConfigError** | Missing Secret/ConfigMap or key | \`describe pod\` |
| **CrashLoopBackOff** | App exits: bad config, failed migration, liveness kill, OOM | \`logs --previous\`, exit code |
| **OOMKilled** (exit 137) | Memory limit too low, leak, JVM heap > limit | metrics, \`describe\` Last State |
| **Running but 0/1 Ready** | Readiness failing: wrong port/path, app on 127.0.0.1, dependency down | \`describe\` probe events |
| **Terminating** (stuck) | Finalizers, node unreachable, a process ignoring SIGTERM past the grace period | \`get -o yaml\` finalizers, node status |
| **Evicted** | Node pressure: memory, disk (ephemeral storage, logs), PIDs | \`describe node\` Conditions |

## When the pod is fine but traffic isn't
Work the path: **DNS** (\`dig svc.ns.svc.cluster.local\` from a debug pod) → **Service** (selector, ports, \`targetPort\` matches a container port) → **EndpointSlices** (empty = selector mismatch or no Ready pods) → **pod IP directly** (bypasses kube-proxy) → **NetworkPolicy** (timeouts, not refusals) → **Ingress/Gateway** (controller logs, host/path rules, TLS secret).

## Debugging tools
- \`kubectl debug -it pod/x --image=nicolaka/netshoot --target=app\` attaches an **ephemeral container** that shares the pod's namespaces: perfect for distroless images with no shell.
- \`kubectl debug node/node-1 -it --image=ubuntu\` gets a shell on a node (host filesystem under /host).
- \`kubectl get events -A --sort-by=.lastTimestamp\`, \`kubectl top\`, \`kubectl rollout status/history/undo\`.
- \`kubectl port-forward\` to hit a pod from your laptop; \`crictl\` on the node to inspect containers when the kubelet is confused.

## Node and cluster problems
- **Node NotReady**: kubelet down, container runtime down, network partition, disk or memory pressure. Pods on it are evicted after the toleration (default 5 minutes). Check \`describe node\` conditions and \`journalctl -u kubelet\`.
- **Slow API / timeouts across the board**: an overloaded API server or etcd (too many objects, huge LIST calls from a buggy controller, etcd disk latency). Look at API server request latency and etcd fsync metrics.
- **Throttling**: high latency but low CPU usage → CFS throttling from CPU limits.
- **IP exhaustion**: with VPC-native CNIs (AWS VPC CNI), pods stay ContainerCreating when the subnet runs out of IPs.

## After the fire
Mitigate first (roll back, scale up, cordon a bad node), then find the root cause. Write a blameless post-mortem and turn the lesson into an alert, a policy (admission rule) or a runbook entry.`,
    keyPoints: [
      "get → describe (Events) → logs --previous. Follow Deployment → ReplicaSet → Pod → container → node.",
      "Each status has a short list of causes: Pending = scheduling, ImagePullBackOff = image/auth, CrashLoopBackOff = app exits.",
      "Exit 137 = SIGKILL (OOM or liveness), 143 = SIGTERM, 1 = app error.",
      "Traffic issues: DNS → Service → EndpointSlices → pod IP → NetworkPolicy → Ingress, in that order.",
      "kubectl debug adds an ephemeral container (or a node shell) for images without a shell.",
    ],
    code: [
      {
        title: "ImagePullBackOff",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-debug > /dev/null
# A typo in the image tag
kubectl -n quest-debug create deployment api --image=node:20-slimm -- sleep 3600 > /dev/null
kubectl -n quest-debug wait --for=jsonpath='{.status.containerStatuses[0].state.waiting.reason}'=ImagePullBackOff pod -l app=api --timeout=120s > /dev/null

# Step 1: the STATUS column tells you which family of problem it is
kubectl -n quest-debug get pods -o custom-columns='POD:.metadata.labels.app,READY:.status.containerStatuses[0].ready,STATUS:.status.containerStatuses[0].state.waiting.reason'
# Step 2: the Events (bottom of kubectl describe) tell you the details
kubectl -n quest-debug get events --field-selector reason=Failed -o jsonpath='{range .items[*]}{.message}{"\\n"}{end}' \\
  | grep -o 'Failed to pull image "[^"]*"' | sort -u
# Step 3: fix the cause, and the Deployment rolls out a working pod
kubectl -n quest-debug set image deployment/api node=node:20-slim > /dev/null
kubectl -n quest-debug rollout status deployment/api --timeout=120s | tail -n 1` }],
        explain: `- STATUS \`ImagePullBackOff\` says "the image can't be pulled, retrying with back-off" (\`ErrImagePull\` is the first failure).
- The **Failed** event names the exact image. The full message tells you which kind of failure: \`not found\` (typo, tag never pushed), \`unauthorized\` / \`denied\` (missing \`imagePullSecrets\`, wrong registry permissions), \`toomanyrequests\` (Docker Hub rate limit), or a network error (here: this test cluster is offline on purpose).
- Fixing the Deployment's image rolls out a working pod; the broken one is replaced.`,
        output: `POD   READY   STATUS
api   false   ImagePullBackOff
Failed to pull image "node:20-slimm"
deployment "api" successfully rolled out`,
      },
      {
        title: "Pending: compare what the pod wants with what nodes have",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-pend > /dev/null
kubectl label node quest-worker-1 quest-disktype=ssd > /dev/null
# The pod asks for a node label nobody has (sdd instead of ssd)
kubectl -n quest-pend run db --image=node:20-slim --overrides='{"spec": {"nodeSelector": {"quest-disktype": "sdd"}}}' -- sleep 3600 > /dev/null
sleep 2
kubectl -n quest-pend get pod db -o custom-columns='POD:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName'
kubectl -n quest-pend get pod db -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].message}{"\\n"}' | sed -E 's/\\. .*/./'
# Compare what the pod wants with what the nodes have
kubectl -n quest-pend get pod db -o jsonpath='pod wants:   quest-disktype={.spec.nodeSelector.quest-disktype}{"\\n"}'
echo "nodes have:  $(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.labels.quest-disktype}{" "}{end}' | xargs | sed 's/^/quest-disktype=/')"` }],
        explain: `- No node assigned and a \`PodScheduled=False\` condition: the scheduler couldn't place it. Its message (also in \`describe\`) counts the nodes and gives the reason for each group.
- "didn't match Pod's node affinity/selector" means: look at \`nodeSelector\` / affinity and compare with \`kubectl get nodes --show-labels\`. Here, \`sdd\` vs \`ssd\`.
- Other common messages: \`Insufficient cpu\` / \`memory\` (requests), \`had untolerated taint\`, \`didn't match pod anti-affinity rules\`, \`pod has unbound immediate PersistentVolumeClaims\`.`,
        output: `POD   STATUS    NODE
db    Pending   <none>
0/3 nodes are available: 3 node(s) didn't match Pod's node affinity/selector.
pod wants:   quest-disktype=sdd
nodes have:  quest-disktype=ssd`,
      },
      {
        title: "The pods are fine, the Service isn't",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-noep > /dev/null
kubectl -n quest-noep create deployment web --image=node:20-slim -- \\
  node -e "require('http').createServer((q, s) => s.end('it works')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
# A Service whose selector has a typo: app=wbe
kubectl -n quest-noep create service clusterip web --tcp=80:8080 --dry-run=client -o yaml \\
  | sed 's/app: web/app: wbe/' | kubectl apply -f - > /dev/null
kubectl -n quest-noep rollout status deployment/web --timeout=120s > /dev/null
kubectl -n quest-noep run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-noep wait --for=condition=Ready pod/client --timeout=120s > /dev/null
call() { kubectl -n quest-noep exec client -- node -e "fetch('http://web', { signal: AbortSignal.timeout(2000) }).then((r) => r.text()).then((t) => console.log('call:', t), (e) => console.log('call: failed,', e.cause?.code || 'timed out'))"; }

call
# The pods are fine. Does the Service have anyone to send traffic to?
echo "endpoints: [$(kubectl -n quest-noep get endpointslices -l kubernetes.io/service-name=web -o jsonpath='{.items[*].endpoints[*].addresses[0]}')]"
# Nobody. Compare the Service's selector with the pods' labels:
kubectl -n quest-noep get service web -o jsonpath='service selects: {.spec.selector}{"\\n"}'
kubectl -n quest-noep get pods -l '!run' -o jsonpath='pods have:       {.items[0].metadata.labels.app}{"\\n"}' | sed 's/have:       /have:       {"app":"/; s/$/"}/'

kubectl -n quest-noep patch service web -p '{"spec": {"selector": {"app": "web"}}}' > /dev/null
for _ in $(seq 1 20); do call | grep -q works && break; sleep 0.5; done
echo "after fixing the selector:"
call` }],
        explain: `- \`ECONNREFUSED\` from a Service with healthy pods: with **no endpoints**, kube-proxy rejects connections to the ClusterIP.
- The EndpointSlice is empty, so compare the Service's selector with the pods' labels: \`wbe\` vs \`web\`. (\`--dry-run=client -o yaml\` piped through \`sed\` was just a quick way to make the typo.)
- After the patch, the endpoints controller fills the slice and traffic flows, without touching the pods.`,
        output: `call: failed, ECONNREFUSED
endpoints: []
service selects: {"app":"wbe"}
pods have:       {"app":"web"}
after fixing the selector:
call: it works`,
      },
      {
        title: "kubectl debug: an ephemeral container",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "debug.sh", lang: "bash", code: `# runs INSIDE the ephemeral debug container
echo "PID 1 is: $(cat /proc/1/comm), started as: $(tr '\\0' ' ' < /proc/1/cmdline | cut -c1-30)..."
port=$(awk 'NR > 1 && $4 == "0A" { split($2, a, ":"); print a[2] }' /proc/1/net/tcp6 /proc/1/net/tcp | head -n 1)
echo "it is listening on port: $((0x$port))"
echo "its files, through /proc/1/root: $(ls /proc/1/root/usr/local/bin | tr '\\n' ' ')"` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-eph > /dev/null
# Production images are often minimal: no shell, no curl, no debugging tools. Pretend this one is.
kubectl -n quest-eph run app --image=node:20-slim -- \\
  node -e "require('http').createServer((q, s) => s.end('ok')).listen(8080)" > /dev/null
kubectl -n quest-eph wait --for=condition=Ready pod/app --timeout=120s > /dev/null

# kubectl debug adds a temporary "ephemeral" container to the RUNNING pod, from an image with your tools.
# --target=app shares the app container's process namespace: you see its processes, its network, its files.
kubectl -n quest-eph debug pod/app --image=node:20-slim --target=app -c debugger --profile=general -- sh -c "$(cat debug.sh)" > /dev/null
kubectl -n quest-eph wait --for=jsonpath='{.status.ephemeralContainerStatuses[0].state.terminated.reason}'=Completed pod/app --timeout=120s > /dev/null
kubectl -n quest-eph logs app -c debugger

# The app was never restarted, and the debug container stays listed in the pod (ephemeral containers can't be removed)
kubectl -n quest-eph get pod app -o jsonpath='app restarts: {.status.containerStatuses[0].restartCount}, ephemeral containers: {.spec.ephemeralContainers[*].name}{"\\n"}'` }],
        explain: `- \`kubectl debug pod/app --image=... --target=app\` adds a temporary container to the running pod. With \`--target\` it joins the app container's **process namespace**, so it sees the app as PID 1.
- Through \`/proc/1/\` it can read the app's command line, its open ports (\`/proc/1/net/tcp6\`, in hex: 0x1F90 is 8080) and even its files (\`/proc/1/root\`), with tools the app image doesn't have.
- Interactively you'd run \`kubectl debug -it pod/app --image=nicolaka/netshoot --target=app -- bash\` and poke around with curl, dig, tcpdump.
- The app isn't restarted. Ephemeral containers can't be removed from a pod; they disappear when the pod is replaced.
- \`kubectl debug node/NAME -it --image=ubuntu\` gives a shell on a node, with its filesystem under \`/host\`.`,
        output: `PID 1 is: node, started as: node -e require('http').create...
it is listening on port: 8080
its files, through /proc/1/root: corepack docker-entrypoint.sh node nodejs npm npx yarn yarnpkg 
app restarts: 0, ephemeral containers: debugger`,
      },
    ],
    interview: [
      {
        q: "A Deployment rollout is stuck: new pods never become Ready and the old ones are still running. How do you investigate?",
        a: "`kubectl rollout status` shows it waiting; `kubectl get rs` shows the new ReplicaSet with 0 ready. `describe` a new pod: is it **Pending** (no capacity for the surge pod: requests, quota), **ImagePullBackOff** (tag not pushed), **CrashLoopBackOff** (config change broke startup: `logs --previous`), or **Running 0/1** (readiness probe failing: wrong path/port, a new dependency not reachable, NetworkPolicy)? Because `maxUnavailable` keeps old pods serving, users may be fine: the rollout will hit **progressDeadlineSeconds** and report `ProgressDeadlineExceeded`. Mitigate with `kubectl rollout undo` (or revert the Git commit in GitOps), then fix forward.",
        freq: "very-common",
      },
      {
        q: "A Service returns 'connection refused' but the pods look healthy. Walk through your debugging.",
        a: "From a debug pod in the same namespace: (1) **DNS**: does the name resolve to the ClusterIP? (2) **EndpointSlices**: empty means the Service selector doesn't match the pod labels, or pods aren't Ready. (3) **Ports**: Service `port` → `targetPort` must match the port the container actually listens on (a named port helps). (4) **curl the pod IP directly**: if that's refused too, the app listens on 127.0.0.1 or a different port; if it works, look at kube-proxy rules. (5) **NetworkPolicy** typically causes timeouts rather than refusals. (6) If external, check the Ingress/Gateway rules and controller logs.",
        freq: "very-common",
      },
      {
        q: "Pods keep getting Evicted from one node. What do you check?",
        a: "`kubectl describe node` → **Conditions** (MemoryPressure, DiskPressure, PIDPressure) and the eviction events, plus the pod's eviction message (which resource). **Disk pressure** is the classic: container logs without rotation, emptyDir or writable-layer growth, too many unused images (image GC thresholds). Set **ephemeral-storage requests/limits**, rotate logs, ship logs off the node. **Memory pressure**: pods with low requests using much more (Burstable/BestEffort go first): raise requests to reflect reality. Also check for a DaemonSet or a node-level process (a runaway agent) consuming resources outside pods.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "`kubectl logs mypod` shows nothing useful for a CrashLoopBackOff pod. What should you run?",
        options: ["kubectl logs mypod --follow", "kubectl logs mypod --previous", "kubectl get events --watch", "kubectl top pod mypod"],
        answer: 1,
        explain: "--previous shows the logs of the last terminated container, the one that crashed.",
      },
      {
        q: "An image has no shell (distroless). How do you get a shell into the running pod's namespaces?",
        options: ["kubectl exec -it pod -- sh", "kubectl debug -it pod --image=busybox --target=app (ephemeral container)", "SSH into the pod", "Rebuild the image with a shell"],
        answer: 1,
        explain: "Ephemeral containers share the target container's process namespace and network, bringing their own tools.",
      },
      {
        q: "Which symptom usually points to a NetworkPolicy rather than a selector mismatch?",
        options: ["Connections time out", "Connection refused immediately", "DNS returns NXDOMAIN", "ImagePullBackOff"],
        answer: 0,
        explain: "Policies drop packets silently, so clients time out. Refusals come from nothing listening (or no endpoints).",
      },
      {
        q: "A rollout reports ProgressDeadlineExceeded. What does Kubernetes do automatically?",
        options: ["Rolls back to the previous ReplicaSet", "Nothing beyond marking the condition; you (or your tooling) must roll back", "Deletes the Deployment", "Scales to zero"],
        answer: 1,
        explain: "Deployments don't auto-rollback; Argo Rollouts/Flagger or your pipeline can act on the condition.",
      },
    ],
  },
];
