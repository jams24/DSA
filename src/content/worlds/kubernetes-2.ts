import type { Lesson } from "../types";

export const kubernetesPart2: Lesson[] = [
  // ------------------------------------------------------------------ NETWORKING
  {
    id: "k8s-networking",
    title: "Services, DNS, Ingress & Network Policies",
    tagline: "ClusterIP, kube-proxy, CoreDNS, the CNI, Ingress vs Gateway API, and locking traffic down.",
    difficulty: "advanced",
    minutes: 18,
    visualizers: ["k8snet"],
    concept: `
## The Kubernetes network model
Three rules, implemented by the **CNI plugin** (Calico, Cilium, Flannel, AWS VPC CNI…):
1. Every pod gets its **own IP**.
2. Pods can reach every other pod **without NAT**, across nodes.
3. Agents on a node can reach all pods on that node.

Pod IPs are ephemeral: pods die and come back with new IPs. That's why **Services** exist.

## Services
A Service is a stable virtual IP and DNS name in front of a **label selector**. The **EndpointSlice** controller keeps the list of *ready* pod IPs that match the selector.
| Type | What it adds |
|---|---|
| **ClusterIP** (default) | A virtual IP reachable inside the cluster |
| **NodePort** | Also opens a port (30000–32767) on every node |
| **LoadBalancer** | Also provisions a cloud load balancer pointing at the nodes or pods |
| **Headless** (\`clusterIP: None\`) | No virtual IP; DNS returns the pod IPs directly |
| **ExternalName** | A DNS CNAME to something outside the cluster |

## How a ClusterIP works
No process listens on a ClusterIP. **kube-proxy** on every node watches Services and EndpointSlices and programs **iptables** rules (or **IPVS**, or eBPF maps when Cilium replaces kube-proxy). A packet to the ClusterIP is **DNATed** to one ready pod chosen at random, then the CNI routes it. Consequences:
- Balancing is **per connection**, not per request. Long-lived HTTP/2 or gRPC connections pin to one pod; use client-side balancing (headless + gRPC's round robin) or a service mesh.
- \`externalTrafficPolicy: Local\` keeps the client source IP and avoids a second hop, but only nodes with local pods receive traffic.

## DNS
**CoreDNS** serves \`<service>.<namespace>.svc.cluster.local\`. Pods' \`resolv.conf\` has search domains and \`ndots:5\`, so a name like \`api.example.com\` is first tried as \`api.example.com.<ns>.svc.cluster.local\` and so on: several wasted lookups per external call. Use fully qualified names with a trailing dot for hot external calls, or lower ndots. **NodeLocal DNSCache** cuts latency and conntrack pressure at scale.

## Getting traffic in: Ingress and Gateway API
- **Ingress** is an L7 routing object (host and path rules, TLS) that an **ingress controller** (nginx, Traefik, HAProxy, a cloud LB controller) implements. Anything beyond basics lives in vendor-specific annotations. The community ingress-nginx project has been retired, which pushes new clusters toward the Gateway API.
- **Gateway API** is the successor: \`GatewayClass\` (the implementation), \`Gateway\` (listeners, owned by the platform team) and \`HTTPRoute\`/\`GRPCRoute\` (owned by app teams), with header matching, weighted traffic splitting and cross-namespace delegation in the spec itself.
- **cert-manager** issues and renews TLS certificates (e.g. Let's Encrypt) into Secrets.

## NetworkPolicy
By default, **all pods can talk to all pods**. A NetworkPolicy selects pods and switches them to default-deny for the directions in \`policyTypes\`, allowing only what its rules list (by pod labels, namespace labels or CIDRs, plus ports).
- Start with a **default-deny** per namespace, then allow each flow.
- If you deny egress, **allow DNS** to kube-dns on port 53, or nothing resolves.
- Enforcement is done by the CNI. A plugin without policy support (plain Flannel) accepts the objects and silently ignores them.
- NetworkPolicy is L3/L4. For L7 rules (HTTP methods, paths) and identity-based mTLS, use Cilium policies or a service mesh.
`,
    keyPoints: [
      "Every pod has a routable IP; the CNI plugin makes pod-to-pod traffic work across nodes without NAT.",
      "A Service = stable virtual IP + DNS name over the ready pods matching a selector (EndpointSlices).",
      "kube-proxy DNATs ClusterIP traffic to a random ready pod, per connection, so long-lived gRPC needs client-side balancing.",
      "Ingress/Gateway API do L7 routing and TLS at the edge; Gateway API splits platform and app ownership.",
      "Pods are open to each other by default. Use default-deny NetworkPolicies and remember to allow DNS.",
    ],
    code: [
      {
        title: "Service, Gateway API route and a default-deny policy",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: v1
kind: Service
metadata: { name: api, namespace: shop }
spec:
  selector: { app: api }
  ports: [{ name: http, port: 80, targetPort: http }]   # named port on the pod
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: api, namespace: shop }
spec:
  parentRefs: [{ name: public, namespace: infra }]      # Gateway owned by the platform team
  hostnames: ["shop.example.com"]
  rules:
    - matches: [{ path: { type: PathPrefix, value: /api } }]
      backendRefs:
        - { name: api, port: 80, weight: 90 }
        - { name: api-canary, port: 80, weight: 10 }     # traffic split, no annotations
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: shop }
spec:
  podSelector: {}                                        # every pod in the namespace
  policyTypes: [Ingress, Egress]
  egress:
    - to: [{ namespaceSelector: {}, podSelector: { matchLabels: { k8s-app: kube-dns } } }]
      ports: [{ protocol: UDP, port: 53 }, { protocol: TCP, port: 53 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: api-allow-frontend, namespace: shop }
spec:
  podSelector: { matchLabels: { app: api } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: frontend } } }]
      ports: [{ port: 8080 }]
`,
          },
        ],
      },
      {
        title: "Debug a Service that doesn't answer",
        variants: [
          {
            lang: "bash",
            code: `
kubectl get svc api -o wide                       # selector, ports
kubectl get endpointslices -l kubernetes.io/service-name=api   # empty = selector mismatch or no ready pods
kubectl run tmp --rm -it --image=nicolaka/netshoot -- bash
  dig api.shop.svc.cluster.local                  # DNS
  curl -sv http://api.shop/healthz                # via the ClusterIP
  curl -sv http://10.244.2.7:8080/healthz         # straight to a pod IP: isolates kube-proxy vs app
sudo iptables-save | grep -i 'shop/api'           # on a node: the KUBE-SVC / KUBE-SEP chains
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "How does a request to a ClusterIP Service reach a pod?",
        a: "The client resolves `api.shop.svc.cluster.local` via **CoreDNS** to the ClusterIP. The ClusterIP is virtual: **kube-proxy** on every node has programmed iptables/IPVS rules (or Cilium eBPF maps) from the Service and its **EndpointSlices**. When the packet leaves the client pod, the rules on the *client's* node **DNAT** it to a randomly chosen **ready** pod IP and target port. The **CNI** routes it to that pod, possibly on another node, without further NAT. conntrack reverses the translation on replies. Balancing happens once per connection.",
        freq: "very-common",
      },
      {
        q: "Your gRPC service has 10 replicas but one pod gets almost all the traffic. Why?",
        a: "gRPC uses long-lived **HTTP/2 connections** that multiplex many requests. kube-proxy balances **per connection**, so each client opens one connection to the ClusterIP, gets pinned to one pod, and all its requests go there. New replicas get nothing until clients reconnect. Fixes: **client-side load balancing** with a **headless Service** (DNS returns all pod IPs) and gRPC's `round_robin` policy; an **L7 proxy/mesh** (Envoy, Linkerd, Istio) that balances per request; or setting `MaxConnectionAge` on the server so clients periodically reconnect and rebalance.",
        freq: "common",
      },
      {
        q: "Ingress vs Gateway API vs a LoadBalancer Service?",
        a: "A **LoadBalancer Service** gives one cloud L4 load balancer per Service: simple, but expensive and with no host/path routing. **Ingress** is an L7 routing object (hosts, paths, TLS) implemented by an ingress controller behind a single LB; anything advanced needs controller-specific annotations, and one object mixes platform and app concerns. **Gateway API** is the successor: role-oriented (`GatewayClass` → `Gateway` for the platform team, `HTTPRoute`/`GRPCRoute` for app teams), portable features in the spec (header matching, weighted splits, timeouts), and cross-namespace delegation. New clusters should prefer Gateway API.",
        freq: "common",
      },
      {
        q: "How would you isolate namespaces so a compromised pod can't reach the database?",
        a: "Use a CNI that enforces **NetworkPolicy** (Calico, Cilium). Apply a **default-deny** for ingress and egress in each namespace, then explicitly allow: frontend → api on 8080, api → database on 5432, everyone → kube-dns on 53, and any required egress (via CIDR or an egress gateway). Database pods accept only from pods labelled `app=api` in the `shop` namespace (podSelector + namespaceSelector). Add L7 or identity-based policies (Cilium, or a mesh with mTLS and authorization policies) for stronger guarantees, and test policies, since a missing rule just looks like a timeout.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Who programs the rules that make a ClusterIP work on each node?",
        options: ["CoreDNS", "kube-proxy (or an eBPF replacement like Cilium)", "The scheduler", "etcd"],
        answer: 1,
        explain: "kube-proxy watches Services and EndpointSlices and writes iptables/IPVS rules. CoreDNS only maps names to the ClusterIP.",
      },
      {
        q: "A Service has healthy pods but `kubectl get endpointslices` shows no endpoints. Most likely cause?",
        options: ["CoreDNS is down", "The Service selector doesn't match the pods' labels", "kube-proxy crashed", "The pods have no CPU limits"],
        answer: 1,
        explain: "Endpoints come from the selector. Empty endpoints = selector mismatch, or no pods are Ready.",
      },
      {
        q: "You add an egress default-deny policy and every service suddenly fails to connect by name. Why?",
        options: ["NetworkPolicies block loopback", "DNS (port 53 to kube-dns) is now denied too", "Services require ingress rules", "The CNI must be restarted"],
        answer: 1,
        explain: "Egress default-deny blocks DNS queries. Add an explicit allow rule for kube-dns on UDP/TCP 53.",
      },
      {
        q: "What does a headless Service (clusterIP: None) return from DNS?",
        options: ["A single virtual IP", "The IPs of the individual ready pods", "The node IPs", "An external CNAME"],
        answer: 1,
        explain: "With no ClusterIP, DNS returns pod IPs directly, used for StatefulSets and client-side balancing.",
      },
    ],
  },

  // ------------------------------------------------------------------ STATE
  {
    id: "k8s-state",
    title: "Config, Secrets, Storage & StatefulSets",
    tagline: "ConfigMaps, Secrets done safely, PV/PVC/StorageClass, and running stateful systems on Kubernetes.",
    difficulty: "advanced",
    minutes: 17,
    visualizers: ["statefulset"],
    concept: `
## ConfigMaps and Secrets
Both hold key-value data that pods consume as **environment variables** or **mounted files**.
- Env vars are read once at startup; changing the ConfigMap does nothing until the pod restarts. Mounted files update in place (eventually), but your app must re-read them. A common pattern: put a hash of the config in a pod annotation (Helm's \`checksum/config\`) so config changes trigger a rollout.
- **Secrets are only base64-encoded**, not encrypted. Protect them by: enabling **encryption at rest** in etcd (ideally with a KMS provider), tight **RBAC** (\`get\`/\`list\` on secrets is effectively admin in many namespaces), and preferring mounted files over env vars.
- Keep the source of truth outside the cluster: **External Secrets Operator** syncs from AWS Secrets Manager, GCP Secret Manager or Vault; **Sealed Secrets** / **SOPS** let you commit encrypted secrets to Git; the **Secrets Store CSI driver** mounts them directly. Better still, use **workload identity** (IRSA, GKE Workload Identity) so pods get short-lived cloud credentials and there's no secret at all.

## Storage objects
| Object | Who creates it | What it is |
|---|---|---|
| **PersistentVolume (PV)** | Admin or a provisioner | A piece of real storage: an EBS volume, a PD, an NFS share |
| **PersistentVolumeClaim (PVC)** | The app | A request: "10 Gi, ReadWriteOnce, class fast-ssd" |
| **StorageClass** | Admin | How to provision dynamically: CSI driver, disk type, reclaim policy, binding mode |

A **CSI driver** does the actual attach/mount. Important details:
- **Access modes**: \`ReadWriteOnce\` (one node at a time, the norm for block disks), \`ReadWriteOncePod\`, \`ReadOnlyMany\`, \`ReadWriteMany\` (needs a shared filesystem such as NFS or EFS).
- **volumeBindingMode: WaitForFirstConsumer** delays provisioning until the pod is scheduled, so the disk is created in the pod's zone. With \`Immediate\`, a disk can land in zone a and the pod can never run in zone b.
- **reclaimPolicy**: \`Delete\` removes the disk when the PVC is deleted; \`Retain\` keeps it. Use Retain (and snapshots) for anything precious.
- Block volumes are **zonal**: a pod with an EBS-backed PVC can only move to nodes in the same zone.

## StatefulSets
Deployments treat pods as interchangeable cattle. A **StatefulSet** gives each replica an identity:
- **Stable names**: \`db-0\`, \`db-1\`, \`db-2\`, plus stable DNS through a headless Service: \`db-0.db.ns.svc.cluster.local\`.
- **A PVC per replica** from \`volumeClaimTemplates\`. When \`db-1\` is rescheduled, it reattaches \`data-db-1\`.
- **Ordering**: by default pods are created in order 0→N (each waits for the previous to be Ready) and removed in reverse. \`podManagementPolicy: Parallel\` drops the ordering.
- **PVCs are kept** on scale-down and deletion by default, so data survives (and costs money) until you delete them.

Try deleting pods and scaling in the visualizer: the StatefulSet's pods come back with the same name and data, while the Deployment's emptyDir data disappears.

## Should you run databases on Kubernetes?
StatefulSets give identity and storage, not database **operations**: failover, backups, upgrades and resharding. That's what **operators** add (CloudNativePG, Strimzi for Kafka, Vitess, the various Redis and MongoDB operators). Reasonable rule: use a managed database (RDS, Cloud SQL) unless you need portability, have the skills, or run at a scale where it's cheaper, and if you self-host, use a mature operator, not a hand-rolled StatefulSet.
`,
    keyPoints: [
      "ConfigMap env vars need a restart to change; mounted files update but the app must re-read them.",
      "Secrets are base64, not encryption: enable etcd encryption, lock down RBAC, or sync from an external secret store.",
      "PVC = request, PV = real storage, StorageClass = how to provision it. Use WaitForFirstConsumer for zonal disks.",
      "StatefulSets give stable names, stable DNS, a PVC per replica and ordered rollout; PVCs outlive the pods.",
      "For real databases, use a managed service or a mature operator: StatefulSets alone don't do failover or backups.",
    ],
    code: [
      {
        title: "A StatefulSet with its headless Service and per-pod storage",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: fast-ssd }
provisioner: ebs.csi.aws.com
parameters: { type: gp3 }
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer     # create the disk in the pod's zone
allowVolumeExpansion: true
---
apiVersion: v1
kind: Service
metadata: { name: db }
spec:
  clusterIP: None                           # headless: db-0.db, db-1.db, ...
  selector: { app: db }
  ports: [{ port: 5432 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: db }
spec:
  serviceName: db
  replicas: 3
  selector: { matchLabels: { app: db } }
  template:
    metadata: { labels: { app: db } }
    spec:
      containers:
        - name: postgres
          image: postgres:17
          envFrom: [{ configMapRef: { name: db-config } }]
          volumeMounts:
            - { name: data, mountPath: /var/lib/postgresql/data }
            - { name: creds, mountPath: /etc/db-creds, readOnly: true }   # secret as files
      volumes:
        - name: creds
          secret: { secretName: db-credentials }
  volumeClaimTemplates:                     # one PVC per pod: data-db-0, data-db-1, ...
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: fast-ssd
        resources: { requests: { storage: 100Gi } }
`,
          },
        ],
      },
    ],
    interview: [
      {
        q: "Deployment vs StatefulSet: when do you use each?",
        a: "**Deployment** for stateless, interchangeable replicas: random pod names, parallel rollout, any pod can serve any request, and shared or no storage. **StatefulSet** when each replica needs an **identity**: stable names (`kafka-0`), stable per-pod DNS via a headless Service, a **dedicated PVC** that follows the pod across reschedules, and **ordered** startup, scale-down and rolling updates. Typical users: databases, Kafka, ZooKeeper/etcd, Elasticsearch, anything with leader election or sharding by member. Remember StatefulSets don't handle failover, backups or rebalancing; operators do.",
        freq: "very-common",
      },
      {
        q: "Are Kubernetes Secrets secure? How do you manage secrets properly?",
        a: "Out of the box they're just **base64** in etcd, readable by anyone with `get secrets` RBAC in the namespace (and by anyone who can create a pod there, since a pod can mount any secret in its namespace). Hardening: **encryption at rest** with a KMS provider, least-privilege **RBAC**, mount as **files** not env vars, audit logging. Source of truth outside the cluster: **External Secrets Operator** / Secrets Store CSI driver pulling from Vault or a cloud secret manager, or **Sealed Secrets/SOPS** for GitOps. Best of all, avoid static secrets with **workload identity** (IRSA, GKE Workload Identity) and Vault dynamic credentials that expire.",
        freq: "very-common",
      },
      {
        q: "A StatefulSet pod is stuck Pending after its node died, and describe says 'volume node affinity conflict'. What happened?",
        a: "Its PVC is bound to a **zonal** block volume (e.g. EBS in us-east-1a). When the node died, the only nodes with free capacity are in other zones, so the pod can't be scheduled where its disk lives. Fixes: make sure each zone has capacity (one node group per zone, so the autoscaler can add a node in the right zone); use `WaitForFirstConsumer` binding so new volumes follow scheduling; for databases, rely on **replication across zones** (an operator promotes a replica elsewhere) rather than moving the disk; or use regional/replicated storage if the platform supports it.",
        freq: "occasional",
      },
    ],
    quiz: [
      {
        q: "You update a ConfigMap that a Deployment consumes through env vars. What happens to running pods?",
        options: ["They get the new values immediately", "Nothing until the pods are restarted", "They restart automatically", "The Deployment rolls back"],
        answer: 1,
        explain: "Env vars are fixed at container start. Roll the Deployment (or hash the config into an annotation) to pick up changes.",
      },
      {
        q: "What is the stable DNS name of the second pod of StatefulSet 'kafka' with headless Service 'kafka' in namespace 'data'?",
        options: ["kafka-2.data.svc", "kafka-1.kafka.data.svc.cluster.local", "kafka.data.svc.cluster.local/1", "kafka-b.kafka.data"],
        answer: 1,
        explain: "Ordinals start at 0, so the second pod is kafka-1, addressed as <pod>.<service>.<namespace>.svc.cluster.local.",
      },
      {
        q: "Why use volumeBindingMode: WaitForFirstConsumer for EBS-backed StorageClasses?",
        options: ["It makes disks faster", "The disk is created in the zone where the pod gets scheduled, avoiding unschedulable pods", "It enables ReadWriteMany", "It encrypts the volume"],
        answer: 1,
        explain: "With Immediate binding, the disk's zone is chosen before scheduling, and the pod may never fit in that zone.",
      },
      {
        q: "You scale a StatefulSet from 3 to 1. What happens to the PVCs data-db-1 and data-db-2?",
        options: ["They're deleted with the pods", "They're kept by default, and reattached if you scale back up", "They're merged into data-db-0", "They become ReadWriteMany"],
        answer: 1,
        explain: "PVCs from volumeClaimTemplates are retained on scale-down by default (configurable via persistentVolumeClaimRetentionPolicy).",
      },
    ],
  },

  // ------------------------------------------------------------------ GITOPS
  {
    id: "gitops-helm",
    title: "Helm, Kustomize & GitOps with Argo CD",
    tagline: "Package manifests, layer environments, and let a controller reconcile the cluster from Git.",
    difficulty: "intermediate",
    minutes: 15,
    visualizers: ["gitops", "rollout"],
    concept: `
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
`,
    keyPoints: [
      "Helm = templates + values, packaged and versioned as releases you can upgrade and roll back.",
      "Kustomize = plain YAML base + per-environment overlays, no templating.",
      "GitOps: Git holds the desired state and an in-cluster controller pulls and reconciles it continuously.",
      "Argo CD: automated sync applies commits, selfHeal reverts drift, prune deletes removed resources.",
      "CI builds images; promotion is a PR that bumps the tag in the config repo.",
    ],
    code: [
      {
        title: "An Argo CD Application rendering a Kustomize overlay",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: shop-prod, namespace: argocd }
spec:
  project: shop
  source:
    repoURL: https://github.com/acme/shop-deploy.git
    targetRevision: main
    path: overlays/prod                 # base/ + overlays/{dev,staging,prod}/
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
    automated:
      prune: true                       # delete what was removed from Git
      selfHeal: true                    # revert manual kubectl edits
    syncOptions: [CreateNamespace=true]
---
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources: [../../base]
images:
  - name: myorg/shop
    newTag: "2.7.1"                     # CI opens a PR that bumps this line
patches:
  - target: { kind: Deployment, name: shop }
    patch: |
      - op: replace
        path: /spec/replicas
        value: 12
`,
          },
        ],
      },
      {
        title: "Helm day to day",
        variants: [
          {
            lang: "bash",
            code: `
helm upgrade --install shop ./charts/shop -n shop -f values-prod.yaml --atomic --timeout 5m
helm diff upgrade shop ./charts/shop -f values-prod.yaml   # (helm-diff plugin) review first
helm history shop -n shop
helm rollback shop 41 -n shop
helm template shop ./charts/shop -f values-prod.yaml | kubeconform -strict   # validate in CI
`,
          },
        ],
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
    ],
  },

  // ------------------------------------------------------------------ OPERATORS & SECURITY
  {
    id: "k8s-extending-security",
    title: "Operators, CRDs, RBAC & Cluster Security",
    tagline: "Extend the API with your own controllers, then lock the cluster down: RBAC, admission, pod security and supply chain.",
    difficulty: "advanced",
    minutes: 17,
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
    concept: `
## Extending Kubernetes
Everything in Kubernetes is a **resource** stored by the API server plus a **controller** that reconciles it. You can add both:
- A **CustomResourceDefinition (CRD)** adds a new type (\`PostgresCluster\`, \`Certificate\`, \`KafkaTopic\`) with an OpenAPI schema. You get kubectl, RBAC, watch and storage for free.
- A **controller** watches those objects and runs a reconcile loop: read desired state (spec), observe actual state, act to converge, write \`status\`. Reconcile must be **idempotent** and **level-triggered**: it gets "something changed, look again", not a precise diff, and must handle being run repeatedly or after a crash.
- An **operator** = CRDs + controller that encodes operational knowledge: provisioning, failover, backups, upgrades. Examples: cert-manager, CloudNativePG, Strimzi (Kafka), Prometheus Operator. Built with **Kubebuilder** / controller-runtime (Go) or the Operator SDK.

Useful patterns: **finalizers** (block deletion until cleanup such as deleting a cloud resource is done; a stuck finalizer is why objects hang in Terminating), **owner references** (garbage-collect children with the parent), and **status conditions**.

## Who can do what: RBAC
Requests pass **authentication** (certificates, OIDC tokens, ServiceAccount tokens) → **authorization** (RBAC) → **admission** → storage.
- **Role / ClusterRole** list allowed verbs on resources; **RoleBinding / ClusterRoleBinding** grant them to users, groups or **ServiceAccounts**.
- Least privilege: namespace-scoped Roles where possible; no wildcard verbs; be careful with \`secrets\`, \`pods/exec\`, \`create pods\` (which can mount any secret in the namespace) and anything that edits RBAC itself (escalation).
- Each workload gets its own **ServiceAccount**, with short-lived projected tokens. Set \`automountServiceAccountToken: false\` when a pod doesn't call the API.
- \`kubectl auth can-i --as=system:serviceaccount:shop:api list secrets\` checks permissions.

## Admission control
Mutating and validating **admission webhooks** (and built-in **ValidatingAdmissionPolicy** with CEL) enforce rules on every object: required labels, no \`:latest\` tags, images only from your registry, resource requests required. **Kyverno** and **OPA Gatekeeper** are the common policy engines.

## Pod security
- **Pod Security Admission** enforces the Pod Security Standards per namespace label: \`privileged\`, \`baseline\`, \`restricted\`.
- \`securityContext\`: \`runAsNonRoot\`, \`readOnlyRootFilesystem\`, \`allowPrivilegeEscalation: false\`, drop \`ALL\` capabilities, \`seccompProfile: RuntimeDefault\`.
- Never mount the host's Docker/containerd socket or use \`privileged: true\` / \`hostPath\` / \`hostNetwork\` for ordinary apps: each one is a path to node takeover.

## Supply chain and runtime
Scan images in CI; sign them (cosign/Sigstore) and **verify signatures at admission**; pin by digest; generate SBOMs. At runtime, **Falco** or Tetragon detect suspicious syscalls (a shell spawned in a container, writes to /etc). Keep the control plane private, enable **audit logging**, encrypt Secrets at rest, and upgrade regularly (Kubernetes supports roughly the latest three minor versions).
`,
    keyPoints: [
      "CRD = new API type; controller = reconcile loop; operator = both, encoding operational know-how.",
      "Reconcile loops must be idempotent and level-triggered. Finalizers block deletion until cleanup is done.",
      "RBAC: Roles/ClusterRoles bound to users and ServiceAccounts. Watch out for secrets, pods/exec and create pods.",
      "Admission (Kyverno, Gatekeeper, ValidatingAdmissionPolicy) enforces policy on every object.",
      "Restricted Pod Security, non-root, read-only rootfs, no privileged/hostPath, signed images verified at admission.",
    ],
    code: [
      {
        title: "Least-privilege RBAC and a restricted pod",
        variants: [
          {
            lang: "yaml",
            code: `
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    pod-security.kubernetes.io/enforce: restricted   # Pod Security Admission
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: config-reader, namespace: shop }
rules:
  - apiGroups: [""]
    resources: [configmaps]
    resourceNames: [feature-flags]                  # one object, not all
    verbs: [get, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: api-config-reader, namespace: shop }
subjects: [{ kind: ServiceAccount, name: api, namespace: shop }]
roleRef: { kind: Role, name: config-reader, apiGroup: rbac.authorization.k8s.io }
---
# in the pod template
spec:
  serviceAccountName: api
  securityContext: { runAsNonRoot: true, seccompProfile: { type: RuntimeDefault } }
  containers:
    - name: api
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: [ALL] }
`,
          },
        ],
      },
      {
        title: "The heart of a controller (controller-runtime)",
        variants: [
          {
            lang: "go",
            code: `
func (r *CacheReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var c cachev1.Cache
    if err := r.Get(ctx, req.NamespacedName, &c); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err) // deleted: nothing to do
    }

    // Desired state, derived only from the spec: safe to run any number of times
    sts := desiredStatefulSet(&c)
    if err := ctrl.SetControllerReference(&c, sts, r.Scheme); err != nil {
        return ctrl.Result{}, err
    }
    if _, err := controllerutil.CreateOrUpdate(ctx, r.Client, sts, func() error {
        sts.Spec.Replicas = &c.Spec.Replicas
        return nil
    }); err != nil {
        return ctrl.Result{}, err // returned errors are retried with back-off
    }

    c.Status.ReadyReplicas = sts.Status.ReadyReplicas
    return ctrl.Result{RequeueAfter: time.Minute}, r.Status().Update(ctx, &c)
}
`,
          },
        ],
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
        q: "How would you secure a multi-tenant Kubernetes cluster?",
        a: "**Identity & access**: SSO via OIDC, namespace-scoped RBAC per team, no cluster-admin for humans day-to-day, ServiceAccount per workload with minimal rights. **Isolation**: namespace per tenant, **ResourceQuotas/LimitRanges**, **default-deny NetworkPolicies**, Pod Security Admission at `restricted`. **Admission policy** (Kyverno/Gatekeeper): trusted registries only, signed images, required requests, no privileged/hostPath/hostNetwork. **Secrets**: encryption at rest via KMS, external secret stores, workload identity. **Supply chain**: scanning, SBOMs, signature verification. **Runtime**: Falco/Tetragon, audit logs shipped off-cluster. For truly untrusted tenants, use sandboxed runtimes (gVisor, Kata) or separate clusters, since namespaces are a soft boundary.",
        freq: "common",
      },
      {
        q: "A namespace has been stuck in Terminating for an hour. What's going on?",
        a: "Some object inside it (or the namespace itself) has a **finalizer** that hasn't been removed. Finalizers are keys in `metadata.finalizers` that block deletion until their controller finishes cleanup. If that controller is gone (uninstalled operator) or failing (can't delete a cloud resource), the object never goes away. Debug: `kubectl get ns X -o yaml` (status conditions list remaining resources/finalizers), then `kubectl api-resources --verbs=list --namespaced -o name | xargs -n1 kubectl get -n X`. Fix the controller, or, if you're sure the external resource is cleaned up, remove the finalizer with a patch. Also check for unavailable aggregated APIs (a broken metrics-server APIService blocks namespace deletion).",
        freq: "occasional",
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
        q: "What is a finalizer?",
        options: ["A hook that runs after a container exits", "A key that blocks an object's deletion until a controller removes it after cleanup", "The last container in a pod", "An admission webhook"],
        answer: 1,
        explain: "Finalizers implement pre-delete cleanup; a missing controller leaves objects stuck in Terminating.",
      },
    ],
  },

  // ------------------------------------------------------------------ DEBUGGING
  {
    id: "k8s-debugging",
    title: "Debugging Kubernetes in Production",
    tagline: "A systematic playbook for broken pods, silent Services, sick nodes and slow clusters.",
    difficulty: "intermediate",
    minutes: 15,
    visualizers: ["podstatus", "incident"],
    concept: `
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
Mitigate first (roll back, scale up, cordon a bad node), then find the root cause. Write a blameless post-mortem and turn the lesson into an alert, a policy (admission rule) or a runbook entry.
`,
    keyPoints: [
      "get → describe (Events) → logs --previous. Follow Deployment → ReplicaSet → Pod → container → node.",
      "Each status has a short list of causes: Pending = scheduling, ImagePullBackOff = image/auth, CrashLoopBackOff = app exits.",
      "Exit 137 = SIGKILL (OOM or liveness), 143 = SIGTERM, 1 = app error.",
      "Traffic issues: DNS → Service → EndpointSlices → pod IP → NetworkPolicy → Ingress, in that order.",
      "kubectl debug adds an ephemeral container (or a node shell) for images without a shell.",
    ],
    code: [
      {
        title: "The debugging toolkit",
        variants: [
          {
            lang: "bash",
            code: `
# What's broken, and what changed?
kubectl get pods -n shop -o wide | grep -v Running
kubectl get events -n shop --sort-by=.lastTimestamp | tail -20
kubectl rollout history deploy/checkout -n shop

# One pod
kubectl describe pod checkout-6c8f9-x2l7q -n shop        # Events, Last State, exit code
kubectl logs checkout-6c8f9-x2l7q -n shop --previous     # the crashed attempt
kubectl get pod checkout-6c8f9-x2l7q -n shop -o jsonpath='{.status.containerStatuses[*].lastState}'

# No shell in the image? Attach an ephemeral debug container
kubectl debug -it checkout-6c8f9-x2l7q -n shop --image=nicolaka/netshoot --target=app

# Traffic path
kubectl get endpointslices -n shop -l kubernetes.io/service-name=checkout
kubectl run -n shop dbg --rm -it --image=nicolaka/netshoot -- curl -sv http://checkout/healthz

# Nodes
kubectl describe node node-3 | sed -n '/Conditions/,/Addresses/p'
kubectl debug node/node-3 -it --image=ubuntu -- chroot /host journalctl -u kubelet --since -15m

# Mitigate fast
kubectl rollout undo deploy/checkout -n shop
kubectl cordon node-3 && kubectl drain node-3 --ignore-daemonsets --delete-emptydir-data
`,
          },
        ],
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
