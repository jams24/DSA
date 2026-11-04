import type { Lesson } from "../types";

// Kubernetes, part 2: running apps. Services and DNS, configuration, the pod lifecycle, Jobs and DaemonSets.

export const kubernetesPart2: Lesson[] = [
  // ------------------------------------------------------------------ SERVICES & DNS
  {
    id: "k8s-networking",
    part: "Part 2 · Running apps",
    title: "Services and DNS",
    tagline: "Pods come and go with new IPs; a Service gives them one stable name. ClusterIP, EndpointSlices, readiness, NodePort, LoadBalancer and headless Services.",
    difficulty: "beginner",
    minutes: 22,
    visualizers: ["k8snet"],
    concept: `## Explain it like I'm 10 🧸
Pods are like substitute teachers: they keep changing. Every new pod gets a new name and a new address (IP). If your shop's website had to know the address of every pod that serves it, it would be lost every time one was replaced.

So the school has a **front desk**. You don't look for a particular teacher; you go to the desk marked "Maths" and it sends you to whichever maths teacher is free right now. In Kubernetes that desk is a **Service**:
- it has a **name** that never changes, like \`web\`, and a fixed address;
- it keeps a list of the pods behind it, by looking for a **label** (\`app=web\`);
- each request (well, each connection) goes to one of the pods on the list;
- pods that are sick (not **ready**) are taken off the list, so nobody is sent to them.

And there's a **phone book**, the cluster's DNS: type \`web\` and it tells you the desk's address.

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

## EndpointSlices and readiness
A Service is a selector plus a port mapping; the **list of pods** lives in separate **EndpointSlice** objects, kept up to date by a controller. Each endpoint has a \`ready\` condition that follows the pod's **readiness probe**. Not-ready pods stay in the slice, marked \`ready: false\`, and get **no traffic**. That's how a pod that's starting up, warming a cache or overloaded is taken out of rotation **without being restarted**. When a Service has healthy pods but traffic fails, look at its EndpointSlices first: empty means the selector doesn't match any pods (often a label typo), and all \`false\` means readiness is failing.

## Ports, named
\`port\` is the Service's port; \`targetPort\` is the container's port (a number, or the **name** of a container port such as \`http\`, so you can change the number in one place); \`nodePort\` only exists for NodePort and LoadBalancer Services.

## Reaching a Service from outside
Inside the cluster, ClusterIP is all you need. From outside:
- **NodePort**: every node opens the same port (30000-32767) and forwards it to the Service. Simple, but users would need node IPs and odd ports.
- **LoadBalancer**: asks the cloud for a real load balancer with a public IP in front of the NodePorts. One per Service, which gets expensive.
- **Ingress / Gateway API** (lesson 12): one load balancer for many Services, routing by host name and path.
- \`kubectl port-forward\`: a tunnel from your laptop, for debugging only.`,
    keyPoints: [
      "Every pod gets its own IP, but pod IPs change; a Service gives a stable virtual IP and DNS name in front of a label selector.",
      "kube-proxy programs iptables/IPVS so connections to the ClusterIP are DNATed to a ready pod. Balancing is per connection, not per request.",
      "EndpointSlices list the matching pods; readiness decides which ones get traffic. An empty slice means a selector or label mismatch.",
      "DNS: web, web.namespace and web.namespace.svc.cluster.local all resolve; the short name only works in the same namespace.",
      "NodePort opens a port on every node; LoadBalancer adds a cloud load balancer; headless (clusterIP: None) returns pod IPs from DNS.",
    ],
    code: [
      {
        title: "One name, three pods",
        note: "A Service spreads connections over its pods; DNS finds it by name.",
        k8s: true,
        images: ["node:20-slim"],
        files: [
          { path: "web.yaml", lang: "yaml", code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: quest-svc
spec:
  replicas: 3
  selector:
    matchLabels: { app: web }
  template:
    metadata:
      labels: { app: web }
    spec:
      containers:
        - name: web
          image: node:20-slim
          # each pod answers with its own name
          command: ["node", "-e", "require('http').createServer((q, s) => s.end(require('os').hostname())).listen(8080); process.on('SIGTERM', () => process.exit(0))"]
          ports:
            - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: quest-svc
spec:
  selector: { app: web }     # send traffic to pods with this label
  ports:
    - port: 80               # the Service's port
      targetPort: 8080       # the pods' port` },
          { path: "ask.js", lang: "javascript", code: `// Call a URL n times, each on a fresh connection, and count who answered
const http = require("http");
const [url, n] = [process.argv[2], Number(process.argv[3] || 1)];
const get = () => new Promise((ok, fail) =>
  http.get(url, { agent: false }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => ok(b)); }).on("error", fail));
(async () => {
  const seen = {};
  for (let i = 0; i < n; i++) { const who = await get(); seen[who] = (seen[who] || 0) + 1; }
  console.log(\`\${n} requests to \${url} -> answered by \${Object.keys(seen).length} different pod(s)\`);
})().catch((e) => { console.log(\`\${url} -> \${e.code || e.message}\`); });` },
        ],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-svc > /dev/null
kubectl apply -f web.yaml
kubectl -n quest-svc rollout status deployment/web --timeout=120s > /dev/null

# A client pod to make requests from inside the cluster
kubectl -n quest-svc run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-svc wait --for=condition=Ready pod/client --timeout=120s > /dev/null
kubectl -n quest-svc cp ask.js client:/ask.js
ask() { kubectl -n quest-svc exec client -- node /ask.js "$@"; }

# The Service gets one stable virtual IP and a DNS name; requests are spread over the pods
kubectl -n quest-svc get service web -o custom-columns='NAME:.metadata.name,TYPE:.spec.type,PORT:.spec.ports[0].port'
ask http://web 30
ask http://web.quest-svc 30
ask http://web.quest-svc.svc.cluster.local 30

# Why does the short name "web" work? The pod's DNS search list:
kubectl -n quest-svc exec client -- grep search /etc/resolv.conf

# From another namespace the short name doesn't resolve, the full one does
kubectl create namespace quest-other > /dev/null
kubectl -n quest-other run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-other wait --for=condition=Ready pod/client --timeout=120s > /dev/null
kubectl -n quest-other cp ask.js client:/ask.js
kubectl -n quest-other exec client -- node /ask.js http://web
kubectl -n quest-other exec client -- node /ask.js http://web.quest-svc 30` }],
        explain: `- The Service \`web\` selects \`app: web\` and maps its port 80 to the pods' port 8080. Each pod answers with its own name, so the client can count who answered.
- \`ask.js\` opens a **new connection** per request (\`agent: false\`). With a kept-alive connection every request would go to the same pod: kube-proxy balances **connections**, not requests.
- \`web\`, \`web.quest-svc\` and the fully qualified \`web.quest-svc.svc.cluster.local\` are the same Service. The short forms work thanks to the **search** list in the pod's \`/etc/resolv.conf\`.
- From another namespace, plain \`web\` becomes \`web.quest-other.svc.cluster.local\`, which doesn't exist (ENOTFOUND). Across namespaces, always use \`service.namespace\`.`,
        output: `deployment.apps/web created
service/web created
NAME   TYPE        PORT
web    ClusterIP   80
30 requests to http://web -> answered by 3 different pod(s)
30 requests to http://web.quest-svc -> answered by 3 different pod(s)
30 requests to http://web.quest-svc.svc.cluster.local -> answered by 3 different pod(s)
search quest-svc.svc.cluster.local svc.cluster.local cluster.local
http://web -> ENOTFOUND
30 requests to http://web.quest-svc -> answered by 3 different pod(s)`,
      },
      {
        title: "Readiness takes a pod out of rotation",
        note: "Not ready means no traffic, not a restart.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-ready > /dev/null
# 3 pods; each is "ready" only while the file /tmp/ready exists
kubectl -n quest-ready apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: web
          image: node:20-slim
          command: ["sh", "-c", "touch /tmp/ready; exec node -e \\"require('http').createServer((q, s) => s.end(require('os').hostname())).listen(8080); process.on('SIGTERM', () => process.exit(0))\\""]
          readinessProbe:
            exec: { command: ["test", "-f", "/tmp/ready"] }
            periodSeconds: 1
---
apiVersion: v1
kind: Service
metadata: { name: web }
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080 }]
YAML
kubectl -n quest-ready rollout status deployment/web --timeout=120s > /dev/null

# The Service's address book is a list of EndpointSlices, kept up to date by a controller
slice() {
  kubectl -n quest-ready get endpointslices -l kubernetes.io/service-name=web \\
    -o jsonpath='{range .items[*].endpoints[*]}{.conditions.ready}{"\\n"}{end}' | sort | uniq -c \\
    | awk '{printf "%s%s endpoint(s) ready=%s", sep, $1, $2; sep=", "} END {print ""}'
}
until [ "$(slice)" = "3 endpoint(s) ready=true" ]; do sleep 0.5; done
echo "all ready:      $(slice)"

# One pod stops being ready (overloaded, warming a cache...). It is NOT restarted, just taken out of rotation.
pod=$(kubectl -n quest-ready get pods -l app=web -o name | sort | head -n 1)
kubectl -n quest-ready exec $pod -- rm /tmp/ready
kubectl -n quest-ready wait --for=condition=Ready=false $pod --timeout=60s > /dev/null
until [ "$(slice)" = "1 endpoint(s) ready=false, 2 endpoint(s) ready=true" ]; do sleep 0.5; done
echo "one not ready:  $(slice)"
kubectl -n quest-ready get $pod -o jsonpath='that pod: READY={.status.containerStatuses[0].ready} RESTARTS={.status.containerStatuses[0].restartCount}{"\\n"}'

# It recovers, and goes back into rotation
kubectl -n quest-ready exec $pod -- touch /tmp/ready
until [ "$(slice)" = "3 endpoint(s) ready=true" ]; do sleep 0.5; done
echo "recovered:      $(slice)"` }],
        explain: `- Each pod's readiness probe checks for a file every second; we delete it in one pod to simulate "I'm overloaded" or "my cache is cold".
- The EndpointSlice keeps the pod but marks it \`ready=false\`, so kube-proxy stops sending it new connections. \`RESTARTS=0\`: readiness never restarts anything.
- Put the file back and the pod rejoins. This is exactly what happens during a rolling update: new pods only get traffic once they're ready.`,
        output: `all ready:      3 endpoint(s) ready=true
one not ready:  1 endpoint(s) ready=false, 2 endpoint(s) ready=true
that pod: READY=false RESTARTS=0
recovered:      3 endpoint(s) ready=true`,
      },
      {
        title: "NodePort and LoadBalancer",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-np > /dev/null
kubectl -n quest-np create deployment web --image=node:20-slim -- \\
  node -e "require('http').createServer((q, s) => s.end('hello from the web pod')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
kubectl -n quest-np rollout status deployment/web --timeout=120s > /dev/null
kubectl -n quest-np run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-np wait --for=condition=Ready pod/client --timeout=120s > /dev/null

# fetch a URL from inside the cluster (a new Service takes a moment to be wired up on every node, so retry)
get() {
  for _ in $(seq 1 40); do
    kubectl -n quest-np exec client -- node -e "fetch('$1', { signal: AbortSignal.timeout(2000) }).then(r => r.text()).then(console.log)" 2> /dev/null && return
    sleep 0.5
  done
  echo "(no answer)"
}

# NodePort: open the same port on EVERY node, even nodes that don't run the pod
kubectl -n quest-np expose deployment web --name=web-np --type=NodePort --port=80 --target-port=8080 > /dev/null
port=$(kubectl -n quest-np get service web-np -o jsonpath='{.spec.ports[0].nodePort}')
[ "$port" -ge 30000 ] && [ "$port" -le 32767 ] && echo "nodePort: a port in 30000-32767"
echo "the pod runs on 1 node; let's knock on all 3:"
for node in $(kubectl get nodes -o name | sort); do
  ip=$(kubectl get $node -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')
  echo "  \${node#node/}:NODEPORT -> $(get http://$ip:$port)"
done

# LoadBalancer: ask the cloud (here: k3s's built-in servicelb) for an external address
kubectl -n quest-np expose deployment web --name=web-lb --type=LoadBalancer --port=8081 --target-port=8080 > /dev/null
kubectl -n quest-np wait --for=jsonpath='{.status.loadBalancer.ingress}' service/web-lb --timeout=120s > /dev/null
lb=$(kubectl -n quest-np get service web-lb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "web-lb got an external IP:"
echo "  EXTERNAL-IP:8081 -> $(get http://$lb:8081)"
kubectl -n quest-np get services -o custom-columns='NAME:.metadata.name,TYPE:.spec.type,NODE-PORT?:.spec.ports[0].nodePort' --sort-by=.metadata.name \\
  | sed -E 's/ 3[0-9]{4}$/ yes (30000-32767)/'` }],
        explain: `- \`kubectl expose\` is a shortcut that writes a Service for a Deployment.
- A NodePort Service gets a random port in 30000-32767 on **every** node. The web pod runs on one node, yet all three answer: kube-proxy forwards from any node to wherever the pod is.
- A LoadBalancer Service asks the "cloud" for an external address. On AWS or GCP that's a real load balancer; this k3s cluster has a tiny built-in one (servicelb) that uses the nodes' own IPs. On kind or minikube, the EXTERNAL-IP stays \`<pending>\` unless you install MetalLB or run \`minikube tunnel\`.
- Note that the LoadBalancer Service has a nodePort too: cloud load balancers usually send traffic to the NodePorts.
- The first requests to a brand-new Service are retried: it takes a moment for every node's kube-proxy to program its rules.`,
        output: `nodePort: a port in 30000-32767
the pod runs on 1 node; let's knock on all 3:
  quest-server:NODEPORT -> hello from the web pod
  quest-worker-1:NODEPORT -> hello from the web pod
  quest-worker-2:NODEPORT -> hello from the web pod
web-lb got an external IP:
  EXTERNAL-IP:8081 -> hello from the web pod
NAME     TYPE           NODE-PORT?
web-lb   LoadBalancer   yes (30000-32767)
web-np   NodePort       yes (30000-32767)`,
      },
      {
        title: "Headless Services return the pods themselves",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-headless > /dev/null
kubectl -n quest-headless create deployment db --image=node:20-slim --replicas=3 -- sleep 3600 > /dev/null
kubectl -n quest-headless rollout status deployment/db --timeout=120s > /dev/null

# A normal Service: DNS returns ONE virtual IP.  A headless one (clusterIP: None): every ready pod's IP.
kubectl -n quest-headless expose deployment db --name=db --port=5432 > /dev/null
kubectl -n quest-headless expose deployment db --name=db-headless --port=5432 --cluster-ip=None 2> /dev/null > /dev/null
kubectl -n quest-headless run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-headless wait --for=condition=Ready pod/client --timeout=120s > /dev/null
lookup() {
  kubectl -n quest-headless exec client -- node -e "
    require('dns').lookup('$1', { all: true }, (err, addrs) => console.log('$1'.padEnd(12), '->', addrs.length, 'address(es)'))"
}
lookup db
lookup db-headless
pods=$(kubectl -n quest-headless get pods -l app=db -o jsonpath='{.items[*].status.podIP}' | tr ' ' '\\n' | sort)
dns=$(kubectl -n quest-headless exec client -- node -e "require('dns').lookup('db-headless', { all: true }, (e, a) => console.log(a.map(x => x.address).sort().join('\\n')))")
[ "$pods" = "$dns" ] && echo "the headless addresses are exactly the 3 pod IPs"
[ "$(kubectl -n quest-headless get service db -o jsonpath='{.spec.clusterIP}')" = "$(kubectl -n quest-headless exec client -- node -e "require('dns').lookup('db', (e, a) => console.log(a))")" ] \\
  && echo "the normal one is the Service's ClusterIP"` }],
        explain: `- A normal Service name resolves to **one** virtual IP, and kube-proxy does the balancing.
- With \`clusterIP: None\` (\`--cluster-ip=None\`) there's no virtual IP: DNS returns **every ready pod's IP**, and the client decides. Used by databases (talk to a specific member), StatefulSets (\`db-0.db\`, lesson 14) and gRPC clients that balance requests themselves.`,
        output: `db           -> 1 address(es)
db-headless  -> 3 address(es)
the headless addresses are exactly the 3 pod IPs
the normal one is the Service's ClusterIP`,
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
        q: "Explain ClusterIP, NodePort, LoadBalancer and headless Services.",
        a: "**ClusterIP** (default): a virtual IP and DNS name reachable only inside the cluster; kube-proxy DNATs connections to ready pods. **NodePort**: a ClusterIP plus the same port (30000-32767) opened on every node, forwarding to the Service, so external clients can reach `nodeIP:nodePort`. **LoadBalancer**: a NodePort plus a cloud load balancer provisioned by the cloud controller (one per Service, so many Services usually share an Ingress or Gateway instead). **Headless** (`clusterIP: None`): no virtual IP; DNS returns the ready pod IPs (and per-pod names for StatefulSets), for clients that need specific members or do their own balancing. **ExternalName** is a DNS CNAME to an outside name.",
        freq: "very-common",
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
        q: "What does a headless Service (clusterIP: None) return from DNS?",
        options: ["A single virtual IP", "The IPs of the individual ready pods", "The node IPs", "An external CNAME"],
        answer: 1,
        explain: "With no ClusterIP, DNS returns pod IPs directly, used for StatefulSets and client-side balancing.",
      },
      {
        q: "A pod in namespace shop calls http://payments and gets ENOTFOUND, but payments runs in namespace billing. Fix?",
        options: ["Use http://payments.billing", "Restart CoreDNS", "Add a NetworkPolicy", "Use the pod IP"],
        answer: 0,
        explain: "Short names only resolve in the caller's namespace (via the DNS search list). Use service.namespace.",
      },
    ],
  },

  // ------------------------------------------------------------------ CONFIG
  {
    id: "k8s-config",
    title: "ConfigMaps and Secrets",
    tagline: "Keep configuration out of the image: env vars vs mounted files, live updates, why base64 isn't encryption, and immutable config.",
    difficulty: "beginner",
    minutes: 18,
    diagram: {
      title: "Where a pod's configuration comes from",
      nodes: [
        { id: "git", label: "Git / CI", kind: "client", x: 110, y: 120, sub: "manifests, never real secrets" },
        { id: "api", label: "API server", kind: "control", x: 380, y: 120, sub: "stores ConfigMaps & Secrets" },
        { id: "etcd", label: "etcd", kind: "db", x: 380, y: 330, sub: "encrypt Secrets at rest!" },
        { id: "vault", label: "Secret manager", kind: "external", x: 110, y: 330, sub: "Vault, AWS/GCP secrets" },
        { id: "kubelet", label: "kubelet", kind: "node", x: 650, y: 120, sub: "on the pod's node" },
        { id: "env", label: "Env vars", kind: "service", x: 860, y: 60, sub: "read once at start" },
        { id: "files", label: "Mounted files", kind: "storage", x: 860, y: 250, sub: "refreshed while running" },
        { id: "app", label: "Your app", kind: "service", x: 650, y: 400, sub: "reads config" },
      ],
      edges: [
        { from: "git", to: "api", label: "kubectl apply" },
        { from: "vault", to: "api", label: "External Secrets", dashed: true },
        { from: "api", to: "etcd" },
        { from: "api", to: "kubelet", label: "watch" },
        { from: "kubelet", to: "env" },
        { from: "kubelet", to: "files" },
        { from: "env", to: "app", dashed: true },
        { from: "files", to: "app" },
      ],
      flows: [
        {
          name: "Change a ConfigMap",
          path: ["git", "api", "kubelet", "files", "app"],
          steps: [
            "You change the ConfigMap in Git and apply it.",
            "The API server stores the new version. The kubelets on nodes running pods that use it see the change.",
            "Within about a minute, the kubelet swaps the mounted files atomically (a symlink flip).",
            "The app sees new files, if it re-reads them. Env vars never change in a running container: that needs a restart.",
          ],
        },
        {
          name: "A secret from a vault",
          path: ["vault", "api", "kubelet", "files", "app"],
          steps: [
            "The real password lives in a secret manager. An operator (External Secrets) copies it into a Kubernetes Secret.",
            "The Secret is stored in etcd, which should be encrypted at rest. Only pods (and people) with RBAC access can read it.",
            "The kubelet mounts it into the pod as a file on a tmpfs: it's never written to the node's disk.",
            "The app reads the file. Rotate the password in the vault and the file updates by itself.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
You bake one cake recipe for many parties. Some parties want chocolate, some vanilla, and the birthday child's name is different every time. You don't write a new recipe for each party: you keep **one recipe** and a **little card** next to it that says "flavour: chocolate, name: Mia".

A container image is the recipe. It should be the same everywhere: on your laptop, in testing, in production. The things that change (which database to use, the website's address, whether debugging is on) go on the card. In Kubernetes the card is a **ConfigMap**. For things that must stay secret, like passwords, there's a special card, a **Secret**, that fewer people are allowed to read.

Your app can read the card in two ways: as **environment variables** (copied once when the app starts, like reading the card at the start of the party) or as **files** (a folder the app can look into any time, and Kubernetes updates the folder when the card changes).

## ConfigMaps
A ConfigMap is a bag of key/value pairs, where a value can be a short string (\`LOG_LEVEL: debug\`) or a whole file (\`settings.json: |...\`). Create one from YAML, or quickly with \`kubectl create configmap NAME --from-literal=K=V --from-file=path\`. Pods use it as:
- **env**: one key with \`valueFrom.configMapKeyRef\`, or every key at once with \`envFrom\`;
- **a volume**: each key becomes a file in a folder;
- **command-line arguments**, via an env var: \`args: ["--level=$(LOG_LEVEL)"]\`.

## Env vars vs files
| | Env vars | Mounted files |
|---|---|---|
| When read | once, at container start | whenever the app reads them |
| ConfigMap changes | ignored until a restart | updated in place (up to about a minute) |
| Visible in | \`ps e\`, crash dumps, child processes | only the file |
| Good for | simple settings | config files, secrets, certificates |

Updated files only help if the app re-reads them (some apps watch the file, others need a signal). The common trick for "restart when config changes": put a hash of the config in a pod annotation (Helm's \`checksum/config\`) or use generated, content-hashed names (Kustomize's \`configMapGenerator\`, lesson 15): new config, new name, new rollout. A file mounted with \`subPath\` never updates.

## Secrets
A Secret looks almost exactly like a ConfigMap: \`data\` holds the values **base64-encoded**, \`stringData\` lets you write them in plain text. Types include \`Opaque\` (anything), \`kubernetes.io/tls\` (a certificate and key), \`kubernetes.io/dockerconfigjson\` (registry login for \`imagePullSecrets\`) and \`kubernetes.io/service-account-token\`.

**base64 is an encoding, not encryption.** Anyone who can \`get\` a Secret can read it, as the second sample shows. What actually makes Secrets safer than ConfigMaps:
- RBAC can grant ConfigMaps without Secrets;
- mounted Secrets live on a **tmpfs** (memory), never on the node's disk;
- etcd can **encrypt Secrets at rest** (configure it; managed clusters often use a KMS).

## ConfigMaps and Secrets
Both hold key-value data that pods consume as **environment variables** or **mounted files**.
- Env vars are read once at startup; changing the ConfigMap does nothing until the pod restarts. Mounted files update in place (eventually), but your app must re-read them. A common pattern: put a hash of the config in a pod annotation (Helm's \`checksum/config\`) so config changes trigger a rollout.
- **Secrets are only base64-encoded**, not encrypted. Protect them by: enabling **encryption at rest** in etcd (ideally with a KMS provider), tight **RBAC** (\`get\`/\`list\` on secrets is effectively admin in many namespaces), and preferring mounted files over env vars.
- Keep the source of truth outside the cluster: **External Secrets Operator** syncs from AWS Secrets Manager, GCP Secret Manager or Vault; **Sealed Secrets** / **SOPS** let you commit encrypted secrets to Git; the **Secrets Store CSI driver** mounts them directly. Better still, use **workload identity** (IRSA, GKE Workload Identity) so pods get short-lived cloud credentials and there's no secret at all.

## Immutable ConfigMaps and Secrets
\`immutable: true\` freezes the data: edits are rejected, and kubelets stop watching it, which saves API-server load in big clusters. To change it, create \`settings-v2\` and point the Deployment at it. That gives every config change a rollout and a one-command rollback.

## Size and limits
ConfigMaps and Secrets are capped at **1 MiB** each, and they're stored in etcd: they're for config, not data. Big files belong in the image, a volume or object storage.`,
    keyPoints: [
      "Keep the image the same everywhere; put what varies per environment in ConfigMaps and Secrets.",
      "Env vars are copied once at start; mounted files are updated in place (eventually). Changing env-based config needs a rollout.",
      "Secrets are base64-encoded, not encrypted: protect them with RBAC, encryption at rest and an external secret manager.",
      "Mount secrets as files (tmpfs, not in env, not in ps); avoid subPath for config that must update.",
      "immutable: true plus versioned names (settings-v2) turns every config change into a reviewable rollout with easy rollback.",
    ],
    code: [
      {
        title: "Env vars vs mounted files",
        note: "Change a ConfigMap under a running pod and see which one follows.",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "app.yaml", lang: "yaml", code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: settings
  namespace: quest-config
data:
  GREETING: "Hello"               # a simple key/value
  settings.json: |                # a whole file
    { "theme": "light", "maxItems": 10 }
---
apiVersion: v1
kind: Pod
metadata:
  name: app
  namespace: quest-config
spec:
  terminationGracePeriodSeconds: 1
  containers:
    - name: app
      image: node:20-slim
      command: ["sleep", "3600"]
      env:
        - name: GREETING          # copied in ONCE, when the container starts
          valueFrom:
            configMapKeyRef: { name: settings, key: GREETING }
      volumeMounts:
        - name: config            # the ConfigMap as files in a folder, kept up to date
          mountPath: /config
  volumes:
    - name: config
      configMap: { name: settings }` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-config > /dev/null
kubectl apply -f app.yaml
kubectl -n quest-config wait --for=condition=Ready pod/app --timeout=120s > /dev/null
show() {
  echo "  env GREETING:        $(kubectl -n quest-config exec app -- printenv GREETING)"
  echo "  file settings.json:  $(kubectl -n quest-config exec app -- cat /config/settings.json)"
}
echo "before:"; show

# Change the ConfigMap while the pod is running
kubectl -n quest-config patch configmap settings --type=merge \\
  -p '{"data": {"GREETING": "Bonjour", "settings.json": "{ \\"theme\\": \\"dark\\", \\"maxItems\\": 50 }\\n"}}'
# the kubelet refreshes mounted files after a short while (seconds up to about a minute)
for _ in $(seq 1 120); do kubectl -n quest-config exec app -- grep -q dark /config/settings.json 2> /dev/null && break; sleep 1; done
echo "after the change:"; show
echo "-> files follow the ConfigMap; env vars need a restart (kubectl rollout restart)"

# What the folder looks like: each key is a file (symlinks to an atomically swapped directory)
kubectl -n quest-config exec app -- ls /config` }],
        explain: `- \`GREETING\` is copied into the environment when the container starts. Changing the ConfigMap later has no effect on it.
- The \`config\` volume shows each key as a file in \`/config\`. The kubelet refreshes it after the change; on this cluster it took about a minute, which is typical (it depends on the kubelet's sync period and cache).
- The swap is atomic: the kubelet writes a new hidden folder and flips a symlink, so the app never sees a half-written file.
- To pick up env changes, roll the pods: \`kubectl rollout restart deployment/NAME\`.`,
        output: `configmap/settings created
pod/app created
before:
  env GREETING:        Hello
  file settings.json:  { "theme": "light", "maxItems": 10 }
configmap/settings patched
after the change:
  env GREETING:        Hello
  file settings.json:  { "theme": "dark", "maxItems": 50 }
-> files follow the ConfigMap; env vars need a restart (kubectl rollout restart)
GREETING
settings.json`,
      },
      {
        title: "base64 is not encryption",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-secret > /dev/null
kubectl -n quest-secret create secret generic db-login --from-literal=username=app --from-literal=password='s3cr3t!'

# A Secret's values are base64-ENCODED, not encrypted. Anyone who can read the object can read them:
kubectl -n quest-secret get secret db-login -o jsonpath='{.data.password}'; echo "   <- stored like this"
kubectl -n quest-secret get secret db-login -o jsonpath='{.data.password}' | base64 -d; echo "        <- one command later"

# Use it in a pod as files (preferred: not visible in \`ps\` or crash dumps, and they update)
kubectl -n quest-secret apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: app }
spec:
  terminationGracePeriodSeconds: 1
  containers:
    - name: app
      image: node:20-slim
      command: ["sleep", "3600"]
      volumeMounts: [{ name: creds, mountPath: /etc/db, readOnly: true }]
  volumes:
    - name: creds
      secret: { secretName: db-login, defaultMode: 0400 }   # read-only for the owner
YAML
kubectl -n quest-secret wait --for=condition=Ready pod/app --timeout=120s > /dev/null
kubectl -n quest-secret exec app -- sh -c 'ls /etc/db; stat -L -c "%A %n" /etc/db/password; echo "password: $(cat /etc/db/password)"'` }],
        explain: `- \`kubectl create secret generic --from-literal\` base64-encodes the values for you.
- \`base64 -d\` decodes them. Treat "can read Secrets" as "knows the passwords" when you write RBAC rules.
- Mounted as a volume, each key is a file. \`defaultMode: 0400\` makes them readable only by the file's owner. The files live in memory (tmpfs), not on the node's disk.
- Prefer files to env vars for secrets: env vars leak into crash reports, \`/proc/PID/environ\`, child processes and debug pages.`,
        output: `secret/db-login created
czNjcjN0IQ==   <- stored like this
s3cr3t!        <- one command later
password
username
-r-------- /etc/db/password
password: s3cr3t!`,
      },
      {
        title: "Immutable config",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-immutable > /dev/null
# immutable: true means "this can never change": no accidental edits, and the kubelet stops watching it
kubectl -n quest-immutable apply -f - <<'YAML'
apiVersion: v1
kind: ConfigMap
metadata: { name: settings-v1 }
immutable: true
data:
  theme: light
YAML
kubectl -n quest-immutable patch configmap settings-v1 --type=merge -p '{"data": {"theme": "dark"}}' 2>&1 \\
  | sed -E 's/.*(field is immutable when \`immutable\` is set).*/error: \\1/'
# To change it, make settings-v2 and point the Deployment at it: a rollout, with an easy undo
kubectl -n quest-immutable create configmap settings-v2 --from-literal=theme=dark` }],
        explain: `- With \`immutable: true\` the API server rejects any change to the data.
- The pattern: name ConfigMaps by version (\`settings-v1\`, \`settings-v2\`) and change the reference in the Deployment. The change becomes a normal rollout, and \`kubectl rollout undo\` brings the old config back.`,
        output: `configmap/settings-v1 created
error: field is immutable when \`immutable\` is set
configmap/settings-v2 created`,
      },
    ],
    interview: [
      {
        q: "Are Kubernetes Secrets secure? How do you manage secrets properly?",
        a: "Out of the box they're just **base64** in etcd, readable by anyone with `get secrets` RBAC in the namespace (and by anyone who can create a pod there, since a pod can mount any secret in its namespace). Hardening: **encryption at rest** with a KMS provider, least-privilege **RBAC**, mount as **files** not env vars, audit logging. Source of truth outside the cluster: **External Secrets Operator** / Secrets Store CSI driver pulling from Vault or a cloud secret manager, or **Sealed Secrets/SOPS** for GitOps. Best of all, avoid static secrets with **workload identity** (IRSA, GKE Workload Identity) and Vault dynamic credentials that expire.",
        freq: "very-common",
      },
      {
        q: "You updated a ConfigMap but the app still uses the old values. Why, and how do you fix it properly?",
        a: "If the app reads it through **env vars**, they were copied at container start and never change; if it's mounted with **subPath**, the file never updates; if it's a normal volume, the kubelet updates the files after a delay (up to a minute or so), but the app must **re-read** them. Fixes: restart the pods (`kubectl rollout restart`); better, make config changes produce a rollout automatically: a config hash annotation on the pod template (Helm `checksum/config`), Kustomize `configMapGenerator` (content-hashed names), or immutable, versioned ConfigMaps referenced by the Deployment. Or have the app watch the file and reload on change.",
        freq: "common",
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
        q: "kubectl get secret db -o yaml shows password: czNjcjN0IQ==. That value is…",
        options: ["AES-encrypted", "base64-encoded: anyone who can read it can decode it", "A hash that can't be reversed", "A reference to a vault"],
        answer: 1,
        explain: "base64 is just an encoding. Protect Secrets with RBAC, encryption at rest and external secret stores.",
      },
      {
        q: "Why mount secrets as files rather than env vars?",
        options: ["Files are encrypted by Kubernetes", "Env vars leak into process listings, crash dumps and child processes, and never update", "Env vars are limited to 8 characters", "Files load faster"],
        answer: 1,
        explain: "Mounted secrets live on a tmpfs, can be permission-restricted and get refreshed when rotated.",
      },
      {
        q: "What does immutable: true on a ConfigMap give you?",
        options: ["Encryption", "Edits are rejected and kubelets stop watching it, so changes become new, versioned objects", "It can be larger than 1 MiB", "It's copied to every namespace"],
        answer: 1,
        explain: "Less API load, no accidental edits, and config changes become explicit rollouts.",
      },
    ],
  },

  // ------------------------------------------------------------------ POD LIFECYCLE
  {
    id: "pod-lifecycle",
    title: "Pod lifecycle, probes and graceful shutdown",
    tagline: "CrashLoopBackOff, liveness vs readiness vs startup probes, init containers and native sidecars, and shutting down without dropping a single request.",
    difficulty: "intermediate",
    minutes: 24,
    visualizers: ["probes"],
    concept: `## Explain it like I'm 10 🧸
A pod's life is like a shop's day. In the morning the shopkeeper unlocks the door, switches the lights on and fills the shelves (**starting up**). Only then is the shop **ready** for customers. During the day, a manager walks past now and then and checks: is the shopkeeper still awake? If the shopkeeper has fallen asleep and won't wake up, the manager sends a new one (**liveness**: restart). If the shop is just very busy, the manager doesn't fire anyone: they stop sending new customers for a moment (**readiness**: take it out of traffic).

At closing time, a good shop doesn't slam the door on customers who are paying. It turns the sign to "closed", serves everyone still inside, then locks up (**graceful shutdown**). Kubernetes gives each pod a polite warning (**SIGTERM**) and some time. If the shopkeeper ignores it, after 30 seconds the lights are switched off anyway (**SIGKILL**).

And if a shopkeeper keeps fainting every morning? The manager waits longer and longer before sending the next one: 10 seconds, 20, 40... That waiting is **CrashLoopBackOff**. It isn't the problem itself; it tells you "this keeps crashing, go read the logs".

## Phases and container states
A pod's **phase** is coarse: \`Pending\` (accepted, not yet running: scheduling or pulling images), \`Running\`, \`Succeeded\`, \`Failed\` or \`Unknown\` (node lost). The real detail is in each **container state**: \`Waiting\` (with a reason such as \`ContainerCreating\`, \`ImagePullBackOff\`, \`CrashLoopBackOff\`), \`Running\` or \`Terminated\` (with an exit code and reason such as \`OOMKilled\` or \`Error\`). The STATUS column in \`kubectl get pods\` shows the most interesting of these.

**restartPolicy** (\`Always\` for Deployments, \`OnFailure\`/\`Never\` for Jobs) decides what the kubelet does when a container exits. Restarts use an **exponential back-off**: 10 s, 20 s, 40 s… capped at 5 minutes, reset after 10 minutes of healthy running. That waiting state is **CrashLoopBackOff**. It's a symptom: the cause is in \`kubectl logs --previous\` and the exit code.

## Init and sidecar containers
- **Init containers** run to completion, in order, before app containers start: wait for a dependency, run migrations, fetch config.
- **Sidecars** (log shippers, proxies) run alongside the app. Native sidecars (an init container with \`restartPolicy: Always\`, stable since 1.33) start before the app and stop after it, which fixes old problems such as Jobs that never finished because the proxy kept running.

## The three probes
| Probe | Question | On failure |
|---|---|---|
| **startupProbe** | Has the app finished starting? | Keep waiting; restart only after the full budget |
| **livenessProbe** | Is the process stuck beyond repair? | **Restart** the container |
| **readinessProbe** | Can it serve traffic right now? | **Remove from Service endpoints**, no restart |

Probes can be \`httpGet\`, \`tcpSocket\`, \`exec\` or \`grpc\`, tuned by \`periodSeconds\`, \`timeoutSeconds\`, \`failureThreshold\` and \`initialDelaySeconds\`. Until the startup probe passes, the other two don't run.

## Probe anti-patterns
- **No startup probe on a slow starter.** Liveness kills the app before it ever finishes starting, forever. Use a startup probe with a generous budget (\`failureThreshold × periodSeconds\`) rather than a huge \`initialDelaySeconds\`, which also delays detection of real hangs.
- **Liveness that checks dependencies.** If liveness pings the database, a DB outage restarts every pod at once and turns a partial outage into a total one. Liveness checks only the process itself; dependency checks (if any) go in readiness.
- **Identical liveness and readiness.** A pod that is merely busy fails both, gets restarted, and the remaining pods take more load and fail too: a cascading restart storm.
- **Expensive probes.** A probe that runs a query every second on 300 pods is a load test you didn't plan.

## Graceful termination
When a pod is deleted (rolling update, scale-down, node drain), two things happen **in parallel**:
1. The endpoints controller removes the pod from Service endpoints, and every node's kube-proxy and every ingress controller must catch up.
2. The kubelet runs the **preStop** hook, then sends **SIGTERM** to PID 1 in each container, waits up to **terminationGracePeriodSeconds** (default 30 s), then SIGKILLs.

Because (1) takes time to propagate, a pod that exits immediately on SIGTERM still receives a few requests and they fail. That's the source of those mysterious 502s during deploys. The fix:
- a short \`preStop\` sleep (5–10 s) so traffic stops arriving before shutdown starts;
- the app handles SIGTERM: stop accepting connections, finish in-flight requests, close pools, exit;
- grace period longer than preStop + drain time.

**PodDisruptionBudgets** (\`minAvailable\` / \`maxUnavailable\`) stop voluntary disruptions such as node drains from taking down too many replicas at once.

## Exit codes worth knowing
| Exit code | Usually means |
|---|---|
| 0 | finished normally (fine for Jobs; a restart loop for Deployments) |
| 1 | the app's own error: read the logs |
| 126 / 127 | command not executable / not found (typo in \`command\`, missing binary) |
| 137 | killed with SIGKILL (128 + 9): **OOMKilled**, a failed liveness probe, or the grace period ran out |
| 143 | ended by SIGTERM (128 + 15): normal shutdown when the app doesn't handle it |

## PID 1 and signals
The container's main process is **PID 1**, and the kernel doesn't apply default signal actions to PID 1: if your app doesn't install a SIGTERM handler, SIGTERM does **nothing**, and every shutdown waits the full grace period before SIGKILL. Handle SIGTERM in the app (all samples here do), use \`exec\` in shell entrypoints so the app *is* PID 1, or add a tiny init (\`tini\`, Docker's \`--init\`, or \`shareProcessNamespace\`).`,
    keyPoints: [
      "CrashLoopBackOff is a symptom with exponential back-off (10 s up to 5 min): read logs --previous and the exit code.",
      "Startup probe guards slow starts; liveness restarts a stuck process; readiness removes a pod from traffic without restarting it.",
      "Liveness must never check dependencies, or a database blip restarts every pod at once.",
      "On deletion, endpoint removal and SIGTERM happen in parallel: a preStop pause plus a SIGTERM handler avoid dropped requests.",
      "Init containers run to completion first; native sidecars (init containers with restartPolicy: Always) start before and stop after the app.",
    ],
    code: [
      {
        title: "CrashLoopBackOff",
        note: "An app that dies 2 seconds after starting.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-crash > /dev/null
# An app that crashes 2 seconds after it starts (say, a typo in its config)
kubectl -n quest-crash run app --image=node:20-slim -- \\
  node -e "console.log('starting...'); setTimeout(() => { console.error('FATAL: DATABASE_URL is not set'); process.exit(1); }, 2000)" > /dev/null

# Kubernetes restarts it, waiting longer each time (10s, 20s, 40s ... up to 5 min): CrashLoopBackOff
kubectl -n quest-crash wait --for=jsonpath='{.status.containerStatuses[0].state.waiting.reason}'=CrashLoopBackOff pod/app --timeout=120s > /dev/null
kubectl -n quest-crash get pod app -o custom-columns='NAME:.metadata.name,STATUS:.status.containerStatuses[0].state.waiting.reason'
kubectl -n quest-crash get pod app -o jsonpath='last exit code: {.status.containerStatuses[0].lastState.terminated.exitCode} ({.status.containerStatuses[0].lastState.terminated.reason}){"\\n"}'
[ "$(kubectl -n quest-crash get pod app -o jsonpath='{.status.containerStatuses[0].restartCount}')" -ge 1 ] && echo "restarts: 1 or more, and counting"

# CrashLoopBackOff is the symptom. The cause is in the logs of the run that crashed:
kubectl -n quest-crash logs app --previous` }],
        explain: `- The container exits with code 1. The pod's \`restartPolicy\` is \`Always\`, so the kubelet restarts it, waiting longer after each crash: that waiting state is \`CrashLoopBackOff\`.
- \`lastState.terminated\` keeps the previous run's exit code and reason (\`Error\` for a non-zero exit, \`OOMKilled\` for memory, \`Completed\` for 0).
- \`kubectl logs --previous\` shows the logs of the run that crashed. Without \`--previous\` you often see the new run, which may not have printed anything yet. Here the cause is right there: a missing environment variable.`,
        output: `NAME   STATUS
app    CrashLoopBackOff
last exit code: 1 (Error)
restarts: 1 or more, and counting
starting...
FATAL: DATABASE_URL is not set`,
      },
      {
        title: "Liveness restarts a frozen app",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-live > /dev/null
# A server that freezes (stops answering) after 6 seconds, but its process keeps running
kubectl -n quest-live apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: app }
spec:
  terminationGracePeriodSeconds: 1
  containers:
    - name: app
      image: node:20-slim
      command: ["node", "-e"]
      args:
        - |
          const start = Date.now();
          require("http").createServer((req, res) => {
            if (Date.now() - start > 6000) return;   // frozen: never answers
            res.end("ok");
          }).listen(8080);
      livenessProbe:
        httpGet: { path: /healthz, port: 8080 }
        periodSeconds: 2
        timeoutSeconds: 1
        failureThreshold: 2       # 2 misses in a row = restart
      readinessProbe:
        httpGet: { path: /healthz, port: 8080 }
        periodSeconds: 2
        timeoutSeconds: 1
YAML
kubectl -n quest-live wait --for=condition=Ready pod/app --timeout=120s > /dev/null
echo "started:      ready=$(kubectl -n quest-live get pod app -o jsonpath='{.status.containerStatuses[0].ready}')"

# Readiness fails first (traffic stops), then liveness fails twice: the kubelet kills and restarts it
kubectl -n quest-live wait --for=jsonpath='{.status.containerStatuses[0].restartCount}'=1 pod/app --timeout=120s > /dev/null
kubectl -n quest-live get pod app -o jsonpath='restarted:    restarts={.status.containerStatuses[0].restartCount}, last exit: {.status.containerStatuses[0].lastState.terminated.exitCode} ({.status.containerStatuses[0].lastState.terminated.reason}){"\\n"}'
kubectl -n quest-live get events --field-selector involvedObject.name=app,reason=Unhealthy -o jsonpath='{range .items[*]}{.message}{"\\n"}{end}' \\
  | sed -E 's/: Get .*/: (timed out)/' | sort -u
kubectl -n quest-live get events --field-selector involvedObject.name=app,reason=Killing -o jsonpath='{range .items[*]}{.message}{"\\n"}{end}' | sort -u` }],
        explain: `- The server stops answering after 6 seconds but its process keeps running, the classic deadlock or hang. Nothing crashes, so without a probe Kubernetes would never notice.
- Readiness and liveness both call \`/healthz\` with a 1-second timeout. Readiness fails first and takes the pod out of Services; after 2 failed liveness checks in a row (\`failureThreshold: 2\`) the kubelet kills the container and starts a new one.
- Exit code **137** = 128 + 9: it was killed with SIGKILL. (The app ignored SIGTERM because Node.js as PID 1 has no default handler, so after the 1-second grace period it got SIGKILL.)
- The **Unhealthy** and **Killing** events record why. In real life, liveness should be cheaper and more patient than this demo: a restart is a big hammer.`,
        output: `started:      ready=true
restarted:    restarts=1, last exit: 137 (Error)
Liveness probe failed: (timed out)
Readiness probe failed: (timed out)
Container app failed liveness probe, will be restarted`,
      },
      {
        title: "Graceful shutdown: preStop, then SIGTERM",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "server.js", lang: "javascript", code: `const http = require("http");
const server = http.createServer((req, res) => res.end("ok")).listen(8080);
console.log("app: listening on 8080");

process.on("SIGTERM", () => {
  console.log("app: SIGTERM received, stop taking new connections, finish the ones in flight");
  server.close(() => {
    console.log("app: all requests done, closing the database pool... bye!");
    process.exit(0);
  });
});` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-stop > /dev/null
kubectl -n quest-stop create configmap server --from-file=server.js > /dev/null
kubectl -n quest-stop apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: app }
spec:
  terminationGracePeriodSeconds: 30      # the whole budget: preStop + SIGTERM handling
  containers:
    - name: app
      image: node:20-slim
      command: ["node", "/app/server.js"]
      volumeMounts: [{ name: code, mountPath: /app }]
      lifecycle:
        preStop:                         # runs BEFORE the SIGTERM: give load balancers time to stop sending traffic here
          exec:                          # (writing to /proc/1/fd/1 makes its message show up in the pod's logs)
            command: ["sh", "-c", "echo 'preStop: waiting 3s for traffic to drain' > /proc/1/fd/1; sleep 3"]
  volumes:
    - name: code
      configMap: { name: server }
YAML
kubectl -n quest-stop wait --for=condition=Ready pod/app --timeout=120s > /dev/null

# Follow its logs, then delete it like a rolling update would
kubectl -n quest-stop logs -f app > shutdown.log &
sleep 1
started=$(date +%s)
kubectl -n quest-stop delete pod app > /dev/null      # returns once the pod is gone
took=$(( $(date +%s) - started ))
wait
cat shutdown.log
[ "$took" -ge 3 ] && [ "$took" -lt 10 ] && echo "deleting took a few seconds (preStop + shutdown), not the full 30"` }],
        explain: `- When a pod is deleted, the kubelet first runs the **preStop** hook and waits for it, then sends **SIGTERM**. Meanwhile, in parallel, the pod is removed from Service endpoints, which takes a moment to reach every node. The 3-second pause covers that gap, so no new request arrives at a server that's already closing.
- The app's SIGTERM handler stops accepting connections (\`server.close\`), lets in-flight requests finish, cleans up and exits 0.
- Deletion took a few seconds, not the 30-second \`terminationGracePeriodSeconds\`: that's the **maximum**, after which SIGKILL ends it regardless.
- Kubernetes 1.30+ also has a built-in \`preStop: { sleep: { seconds: 5 } }\` action, so you don't need a shell in the image. The shorty project (lesson 19) uses it.`,
        output: `app: listening on 8080
preStop: waiting 3s for traffic to drain
app: SIGTERM received, stop taking new connections, finish the ones in flight
app: all requests done, closing the database pool... bye!
deleting took a few seconds (preStop + shutdown), not the full 30`,
      },
      {
        title: "Init containers and a native sidecar",
        note: "A Job with setup, a helper that runs alongside, and the main work.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-sidecar > /dev/null
# A Job whose main container does some work, with a log-shipping helper that runs forever.
# Declared as a native sidecar (an init container with restartPolicy: Always), the helper
# starts BEFORE the main container and is stopped AFTER it, so the Job can still complete.
kubectl -n quest-sidecar apply -f - > /dev/null <<'YAML'
apiVersion: batch/v1
kind: Job
metadata: { name: report }
spec:
  template:
    spec:
      restartPolicy: Never
      initContainers:
        - name: setup                           # a classic init container: runs to completion first
          image: node:20-slim
          command: ["sh", "-c", "echo 'setup: downloading the report template'; echo template > /work/template"]
          volumeMounts: [{ name: work, mountPath: /work }]
        - name: log-shipper                     # a native sidecar
          image: node:20-slim
          restartPolicy: Always
          command: ["sh", "-c", "echo 'log-shipper: up, shipping logs'; trap 'echo log-shipper: flushed and stopped; exit 0' TERM; while true; do sleep 1; done"]
      containers:
        - name: main
          image: node:20-slim
          command: ["sh", "-c", "echo \\"main: found $(cat /work/template), building the report\\"; sleep 2; echo 'main: done'"]
          volumeMounts: [{ name: work, mountPath: /work }]
      volumes:
        - name: work
          emptyDir: {}
YAML
kubectl -n quest-sidecar wait --for=condition=Complete job/report --timeout=120s
pod=$(kubectl -n quest-sidecar get pods -l job-name=report -o name)
for c in setup log-shipper main; do kubectl -n quest-sidecar logs $pod -c $c; done
kubectl -n quest-sidecar get $pod -o jsonpath='{range .status.initContainerStatuses[*]}{.name}: exit {.state.terminated.exitCode}{"\\n"}{end}{range .status.containerStatuses[*]}{.name}: exit {.state.terminated.exitCode}{"\\n"}{end}'` }],
        explain: `- \`setup\` is a classic **init container**: it must finish successfully before anything else starts. It writes a file into a shared \`emptyDir\` volume that \`main\` reads.
- \`log-shipper\` is a **native sidecar**: an init container with \`restartPolicy: Always\`. It starts before \`main\` and keeps running next to it. When \`main\` finishes, Kubernetes stops the sidecar (SIGTERM, which its \`trap\` handles), so the Job can complete.
- Before native sidecars, a forever-running helper in \`containers\` kept Jobs "running" forever. That was a classic problem with service-mesh proxies in batch jobs.`,
        output: `job.batch/report condition met
setup: downloading the report template
log-shipper: up, shipping logs
log-shipper: flushed and stopped
main: found template, building the report
main: done
setup: exit 0
log-shipper: exit 0
main: exit 0`,
      },
    ],
    interview: [
      {
        q: "What's the difference between liveness, readiness and startup probes?",
        a: "**Readiness** answers \"can this pod take traffic now?\"; failing it removes the pod from Service endpoints but doesn't restart it (warming caches, temporarily overloaded, dependency down). **Liveness** answers \"is the process irrecoverably stuck?\"; failing it makes the kubelet **restart** the container (deadlocks). **Startup** protects slow-starting apps: liveness and readiness don't run until it passes, so a 60-second JVM boot isn't killed by liveness. Key rule: liveness must not depend on external dependencies, or a database blip restarts your whole fleet.",
        freq: "very-common",
      },
      {
        q: "Users see 502 errors during every rolling deployment. What's going on and how do you fix it?",
        a: "On pod deletion, **endpoint removal and SIGTERM happen in parallel**. kube-proxy rules, ingress controllers and load balancers take a moment to stop sending traffic, but the app exits immediately on SIGTERM, so in-flight and newly routed requests fail. Fixes: (1) a **preStop hook** that sleeps 5–15 s so routing updates first; (2) the app handles **SIGTERM gracefully**, stops accepting, drains in-flight requests and closes connections; (3) **terminationGracePeriodSeconds** larger than both; (4) a correct **readiness probe** plus `maxUnavailable: 0, maxSurge: 1` so new pods are ready before old ones go; (5) if behind a cloud LB, enable connection draining / pod readiness gates. Also check the app actually receives SIGTERM (exec form, PID 1).",
        freq: "very-common",
      },
      {
        q: "A pod is in CrashLoopBackOff. Walk me through debugging it.",
        a: "1) `kubectl describe pod` → look at **Last State: Terminated**, the **exit code** and Events. 2) `kubectl logs <pod> --previous` for the crashed attempt's output. 3) Interpret the exit code: **1** app error (config, missing env var, failed migration), **137** SIGKILL (OOMKilled if the reason says so, or a liveness kill), **139** segfault, **143** SIGTERM. 4) Check whether **liveness** is killing it (Events show \"Liveness probe failed\"): needs a startup probe or a less aggressive probe. 5) Check config: missing Secret/ConfigMap keys, wrong command/args, a read-only filesystem the app writes to. 6) If logs are empty, run the image with an overridden command (`kubectl debug` or `command: [sleep, infinity]`) and poke around.",
        freq: "very-common",
      },
      {
        q: "What is a PodDisruptionBudget and when doesn't it protect you?",
        a: "A PDB sets `minAvailable` or `maxUnavailable` for pods matching a selector. The **eviction API** honours it, so `kubectl drain`, cluster-autoscaler scale-down and node upgrades wait rather than evict too many replicas at once. It does **not** protect against involuntary disruptions: node crashes, OOM kills, kernel panics, or someone running `kubectl delete pod` directly (deletes bypass eviction). Also, a PDB with `maxUnavailable: 0` (or minAvailable = replicas) blocks drains forever, a common cause of stuck node upgrades.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "A readiness probe fails 3 times in a row. What does Kubernetes do?",
        options: ["Restarts the container", "Removes the pod from Service endpoints until it passes again", "Deletes the pod", "Reschedules it to another node"],
        answer: 1,
        explain: "Readiness only gates traffic. Restarts come from liveness (or startup) failures.",
      },
      {
        q: "Your liveness probe calls the database. The database goes down for 2 minutes. What happens?",
        options: ["Nothing, the pods keep serving", "Every pod gets restarted repeatedly, though restarting can't fix the database", "Only one pod restarts", "Kubernetes fails over the database"],
        answer: 1,
        explain: "Liveness failures restart containers. Dependency checks belong in readiness at most, never liveness.",
      },
      {
        q: "What's the default terminationGracePeriodSeconds?",
        options: ["5", "10", "30", "300"],
        answer: 2,
        explain: "30 seconds between SIGTERM (after preStop) and SIGKILL, unless you set it.",
      },
      {
        q: "What does an exit code of 137 tell you?",
        options: ["The app returned an error", "The process was killed with SIGKILL (128 + 9), often an OOM kill or a liveness kill", "A segmentation fault", "A graceful SIGTERM shutdown"],
        answer: 1,
        explain: "Exit codes above 128 mean killed by signal (code − 128). 9 is SIGKILL; check the Reason field for OOMKilled.",
      },
      {
        q: "Your Node.js app takes exactly 30 seconds to stop every time. The most likely cause?",
        options: ["The image is too big", "It doesn't handle SIGTERM, and as PID 1 the signal is ignored until SIGKILL", "The readiness probe is too slow", "The node is overloaded"],
        answer: 1,
        explain: "PID 1 gets no default signal handling. Add a SIGTERM handler, or use exec/tini.",
      },
    ],
  },

  // ------------------------------------------------------------------ JOBS
  {
    id: "k8s-jobs",
    title: "Jobs, CronJobs and DaemonSets",
    tagline: "Work that finishes (Jobs), work on a schedule (CronJobs) and one pod on every node (DaemonSets): retries, parallelism and indexes.",
    difficulty: "intermediate",
    minutes: 18,
    diagram: {
      title: "Run-to-completion and per-node workloads",
      nodes: [
        { id: "cron", label: "CronJob", kind: "control", x: 120, y: 110, sub: "schedule: 0 3 * * *" },
        { id: "job", label: "Job", kind: "control", x: 380, y: 110, sub: "completions, parallelism" },
        { id: "p1", label: "Pod (index 0)", kind: "worker", x: 650, y: 60, sub: "exit 0 = success" },
        { id: "p2", label: "Pod (index 1)", kind: "worker", x: 650, y: 170, sub: "exit 3 = retry" },
        { id: "ds", label: "DaemonSet", kind: "control", x: 120, y: 400, sub: "one pod per node" },
        { id: "n1", label: "node-1 agent", kind: "node", x: 420, y: 330, sub: "logs, metrics" },
        { id: "n2", label: "node-2 agent", kind: "node", x: 620, y: 420, sub: "logs, metrics" },
        { id: "n3", label: "node-3 agent", kind: "node", x: 840, y: 330, sub: "new node? new pod" },
      ],
      edges: [
        { from: "cron", to: "job", label: "creates on schedule" },
        { from: "job", to: "p1" },
        { from: "job", to: "p2" },
        { from: "ds", to: "n1" },
        { from: "ds", to: "n2" },
        { from: "ds", to: "n3", dashed: true },
      ],
      flows: [
        {
          name: "A nightly backup",
          path: ["cron", "job", "p1"],
          steps: [
            "At 03:00 the CronJob controller creates a Job from its jobTemplate (unless the previous one is still running and concurrencyPolicy is Forbid).",
            "The Job creates a pod and watches it; a failed pod is replaced, up to backoffLimit times. When the pod exits 0 the Job is Complete, and the CronJob keeps the last few Jobs so you can read their logs.",
          ],
        },
        {
          name: "A node joins the cluster",
          path: ["ds", "n3"],
          steps: [
            "The DaemonSet controller sees a new node that matches its selector and tolerations, and creates its agent pod there. Remove the node and the pod goes with it.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Some jobs never end: a shop stays open all day, every day. That's a **Deployment**: if a worker leaves, a new one takes their place.

Other jobs are **finished** when they're done: "wash these 6 cars". You don't want a new car washer forever; you want 6 clean cars, and then everyone goes home. If a washer slips and drops the sponge, they try again, but not forever: after a few failed tries, you give up and call someone. That's a **Job**.

Some jobs happen **on a schedule**: "take the bins out every Tuesday at 7". That's a **CronJob**: it starts a new Job at each time on the calendar.

And some jobs must be done **in every room**: "check the smoke alarm in each room of the house". Add a room, and the alarm check happens there too. That's a **DaemonSet**: exactly one pod on every node.

## Jobs
A Job creates pods until enough of them **succeed** (exit 0). The knobs:
| Field | Meaning |
|---|---|
| \`completions\` | how many successful pods are needed (default 1) |
| \`parallelism\` | how many run at the same time |
| \`completionMode: Indexed\` | each pod gets \`JOB_COMPLETION_INDEX\` 0..N-1: a static split of the work |
| \`backoffLimit\` | how many failures before the Job gives up (default 6) |
| \`activeDeadlineSeconds\` | a time limit for the whole Job |
| \`ttlSecondsAfterFinished\` | delete the finished Job (and its pods) after this long |
| \`podFailurePolicy\` | treat some exit codes as "don't retry" or "ignore" |

The pod's \`restartPolicy\` must be \`Never\` or \`OnFailure\`. With \`Never\`, each retry is a **new pod** and the failed ones stay around for their logs; with \`OnFailure\`, the same pod's container restarts. Retries back off exponentially (10 s, 20 s, 40 s...).

**Make jobs idempotent.** A pod can be retried after doing half its work, and in rare cases (a node that vanishes and comes back) two copies can run at once. Write each piece so that doing it twice is harmless: upserts instead of inserts, "if not already processed".

For a dynamic queue of work, run \`parallelism: N\` workers that pull from a real queue (Redis, SQS, Kafka) until it's empty. **KEDA** can scale Jobs or Deployments on queue length.

## CronJobs
A CronJob creates a Job from its \`jobTemplate\` on a cron \`schedule\` (\`minute hour day-of-month month day-of-week\`). Set \`timeZone\`, or it's the controller's time zone (usually UTC).
- \`concurrencyPolicy\`: \`Allow\` (default), \`Forbid\` (skip if the last run is still going) or \`Replace\`.
- \`startingDeadlineSeconds\`: how late a missed run may still start (after a controller outage, say).
- \`successfulJobsHistoryLimit\` / \`failedJobsHistoryLimit\`: how many old Jobs to keep.
- \`suspend: true\` pauses it without deleting it.

Cron schedules are "at least once, roughly on time", not exact: a run can be late, skipped or (rarely) doubled. Monitor that the job **actually succeeded recently**, not just that it exists.

## DaemonSets
A DaemonSet runs **one pod per matching node**, added and removed as nodes come and go. It's how node-level agents are installed: log collectors (Fluent Bit, Vector), metrics agents (node-exporter, Datadog), CNI plugins (Cilium, Calico), storage drivers and kube-proxy itself.
- Limit it to some nodes with a \`nodeSelector\` or affinity (only GPU nodes, say).
- It needs **tolerations** to run on tainted nodes, including control-plane nodes.
- Updates roll node by node (\`maxUnavailable\`, default 1).
- Agents often need host access: \`hostPath\` volumes, \`hostNetwork\`, extra privileges. Review them carefully; a DaemonSet is on every machine.`,
    keyPoints: [
      "Jobs run pods until completions succeed; parallelism runs several at once; backoffLimit caps the retries.",
      "Indexed Jobs give each pod JOB_COMPLETION_INDEX to split work statically; queues suit dynamic work.",
      "Jobs can retry or (rarely) run twice: make the work idempotent.",
      "CronJobs create Jobs on a schedule: set timeZone and concurrencyPolicy, test with kubectl create job --from=cronjob/NAME.",
      "DaemonSets run one pod per node for node agents; they need tolerations for tainted nodes.",
    ],
    code: [
      {
        title: "An Indexed Job: 6 pieces of work, 2 at a time",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-jobs > /dev/null
# A Job runs pods until enough of them SUCCEED. Here: 6 thumbnails to make, 2 at a time.
# Indexed mode gives each pod a number (0-5), so each knows which piece of work is its own.
kubectl -n quest-jobs apply -f - <<'YAML'
apiVersion: batch/v1
kind: Job
metadata: { name: thumbnails }
spec:
  completions: 6
  parallelism: 2
  completionMode: Indexed
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: work
          image: node:20-slim
          command: ["sh", "-c", "echo \\"made thumbnail for photo-$JOB_COMPLETION_INDEX.jpg\\"; sleep 1"]
YAML
kubectl -n quest-jobs wait --for=condition=Complete job/thumbnails --timeout=180s
kubectl -n quest-jobs get job thumbnails -o custom-columns='JOB:.metadata.name,SUCCEEDED:.status.succeeded,FAILED:.status.failed'
for pod in $(kubectl -n quest-jobs get pods -l job-name=thumbnails -o name); do kubectl -n quest-jobs logs $pod; done | sort` }],
        explain: `- \`completions: 6\` with \`parallelism: 2\`: the Job keeps 2 pods running until 6 have succeeded.
- \`completionMode: Indexed\` gives each pod a number in \`$JOB_COMPLETION_INDEX\` (and in its hostname), so pod 3 knows it must make \`photo-3.jpg\`.
- \`kubectl wait --for=condition=Complete\` is how scripts and CI wait for a Job. Check \`condition=Failed\` too, or a failing Job makes you wait for the whole timeout.`,
        output: `job.batch/thumbnails created
job.batch/thumbnails condition met
JOB          SUCCEEDED   FAILED
thumbnails   6           <none>
made thumbnail for photo-0.jpg
made thumbnail for photo-1.jpg
made thumbnail for photo-2.jpg
made thumbnail for photo-3.jpg
made thumbnail for photo-4.jpg
made thumbnail for photo-5.jpg`,
      },
      {
        title: "Retries and giving up",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-fail > /dev/null
# A job that always fails. backoffLimit: 2 means "retry twice, then give up"
kubectl -n quest-fail apply -f - > /dev/null <<'YAML'
apiVersion: batch/v1
kind: Job
metadata: { name: flaky }
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never          # a failed pod stays (for its logs); a new pod is the retry
      containers:
        - name: work
          image: node:20-slim
          command: ["sh", "-c", "echo 'cannot reach the payment API'; exit 3"]
YAML
kubectl -n quest-fail wait --for=condition=Failed job/flaky --timeout=180s > /dev/null
kubectl -n quest-fail get job flaky -o jsonpath='{range .status.conditions[?(@.type=="Failed")]}job failed, reason: {.reason}{"\\n"}{end}'
echo "pods it tried: $(kubectl -n quest-fail get pods -l job-name=flaky --no-headers | wc -l | tr -d ' ') (1 + 2 retries)"
kubectl -n quest-fail get pods -l job-name=flaky -o jsonpath='{range .items[*]}{.status.containerStatuses[0].state.terminated.exitCode}{"\\n"}{end}' \\
  | sort | uniq -c | awk '{print "  " $1 " exited with code " $2}'` }],
        explain: `- The pod always exits 3. With \`restartPolicy: Never\`, every retry is a new pod, so you can read each failed attempt's logs.
- After the first failure plus 2 retries (\`backoffLimit: 2\`) the Job gets the condition \`Failed\` with reason \`BackoffLimitExceeded\`. Retries wait 10 s, then 20 s: that's why this took about half a minute.
- With \`podFailurePolicy\` you can say "exit code 3 means a bug, don't retry" and fail fast.`,
        output: `job failed, reason: BackoffLimitExceeded
pods it tried: 3 (1 + 2 retries)
  3 exited with code 3`,
      },
      {
        title: "A CronJob, tested without waiting",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-cron > /dev/null
# Every night at 03:00 (cron syntax: minute hour day-of-month month day-of-week)
kubectl -n quest-cron apply -f - <<'YAML'
apiVersion: batch/v1
kind: CronJob
metadata: { name: backup }
spec:
  schedule: "0 3 * * *"
  timeZone: "Etc/UTC"
  concurrencyPolicy: Forbid          # never run two backups at once
  successfulJobsHistoryLimit: 3      # keep the last 3 finished jobs (and their logs)
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: node:20-slim
              command: ["sh", "-c", "echo 'backup: dumped 1,204 rows to backup.sql'"]
YAML
kubectl -n quest-cron get cronjob backup -o custom-columns='NAME:.metadata.name,SCHEDULE:.spec.schedule,SUSPENDED:.spec.suspend'

# Don't wait until 3 a.m. to test it: start a Job from its template right now
kubectl -n quest-cron create job backup-test --from=cronjob/backup
kubectl -n quest-cron wait --for=condition=Complete job/backup-test --timeout=120s > /dev/null
kubectl -n quest-cron logs job/backup-test

# Pause it (during a migration, say) without deleting it
kubectl -n quest-cron patch cronjob backup -p '{"spec": {"suspend": true}}' > /dev/null
kubectl -n quest-cron get cronjob backup -o custom-columns='NAME:.metadata.name,SUSPENDED:.spec.suspend'` }],
        explain: `- The schedule \`0 3 * * *\` means minute 0 of hour 3, every day, in \`Etc/UTC\`.
- \`kubectl create job NAME --from=cronjob/backup\` runs the exact jobTemplate right now. Use it to test, and to re-run a failed night by hand.
- \`kubectl logs job/backup-test\` reads the logs of the Job's pod.
- \`suspend: true\` pauses the schedule. Remember to turn it back on.`,
        output: `cronjob.batch/backup created
NAME     SCHEDULE    SUSPENDED
backup   0 3 * * *   false
job.batch/backup-test created
backup: dumped 1,204 rows to backup.sql
NAME     SUSPENDED
backup   true`,
      },
      {
        title: "A DaemonSet: one agent per node",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-ds > /dev/null
# A DaemonSet runs exactly one copy on every node: log collectors, monitoring agents, network plugins
kubectl -n quest-ds apply -f - > /dev/null <<'YAML'
apiVersion: apps/v1
kind: DaemonSet
metadata: { name: node-agent }
spec:
  selector: { matchLabels: { app: node-agent } }
  template:
    metadata: { labels: { app: node-agent } }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: agent
          image: node:20-slim
          command: ["sh", "-c", "echo \\"collecting logs on $NODE_NAME\\"; sleep 3600"]
          env:
            - name: NODE_NAME
              valueFrom: { fieldRef: { fieldPath: spec.nodeName } }   # which node am I on?
YAML
kubectl -n quest-ds rollout status daemonset/node-agent --timeout=120s | tail -n 1
kubectl -n quest-ds get daemonset node-agent -o custom-columns='NAME:.metadata.name,NODES:.status.desiredNumberScheduled,READY:.status.numberReady'
for pod in $(kubectl -n quest-ds get pods -l app=node-agent -o name); do kubectl -n quest-ds logs $pod; done | sort` }],
        explain: `- There's no \`replicas\`: the number of pods is the number of nodes it may run on.
- The **downward API** (\`fieldRef: spec.nodeName\`) tells the pod which node it's on. It can also expose the pod's name, namespace, IP, labels and resource limits.
- It landed on the control-plane node too because this cluster doesn't taint it. Most production clusters do, and then the DaemonSet needs a toleration to run there.`,
        output: `daemon set "node-agent" successfully rolled out
NAME         NODES   READY
node-agent   3       3
collecting logs on quest-server
collecting logs on quest-worker-1
collecting logs on quest-worker-2`,
      },
    ],
    interview: [
      {
        q: "How do Jobs handle failures, and how do you design a job that's safe to retry?",
        a: "A Job retries failed pods (new pods with `restartPolicy: Never`, container restarts with `OnFailure`) with exponential back-off until `backoffLimit` failures, then marks itself Failed (`BackoffLimitExceeded`); `activeDeadlineSeconds` caps total runtime and `podFailurePolicy` can fail fast on specific exit codes or ignore disruptions like node drains. Since a pod can be retried after partial progress, and rarely run twice concurrently, the work must be **idempotent**: upserts with natural keys, checkpoints, \"skip if already processed\" markers, idempotency keys for external calls, and writing to a temp location then atomically renaming or committing.",
        freq: "common",
      },
      {
        q: "A CronJob didn't run last night. How do you investigate?",
        a: "`kubectl get cronjob` (SCHEDULE, SUSPEND, LAST SCHEDULE) and `describe` for events. Common causes: `suspend: true`; `concurrencyPolicy: Forbid` with the previous run still going (stuck job: check its pods); the controller was down past `startingDeadlineSeconds`; too many missed schedules (over 100 makes the controller stop scheduling it); wrong time zone (no `timeZone`, so UTC); the Job ran but failed (`kubectl get jobs`, then `logs job/NAME`); history limits deleted the evidence. Fix, then `kubectl create job --from=cronjob/NAME` to run it now, and add monitoring on 'last successful run' (e.g. kube-state-metrics' `kube_cronjob_status_last_successful_time`).",
        freq: "occasional",
      },
      {
        q: "When do you use a DaemonSet instead of a Deployment?",
        a: "When you need exactly one pod per node (or per node in a subset) because the work is tied to the node itself: collecting the node's logs and metrics, networking (CNI agents, kube-proxy), storage drivers (CSI node plugins), security agents. A Deployment spreads N replicas wherever there's room, which doesn't guarantee coverage. DaemonSets follow nodes automatically as the cluster scales, need tolerations for tainted nodes (control plane, GPU pools) and usually host access, so they deserve a security review.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "completions: 10, parallelism: 3. How many pods run at the same time at most?",
        options: ["10", "3", "13", "1"],
        answer: 1,
        explain: "parallelism caps concurrent pods; the Job continues until 10 have succeeded.",
      },
      {
        q: "Which restartPolicy is NOT allowed in a Job's pod template?",
        options: ["Never", "OnFailure", "Always", "All are allowed"],
        answer: 2,
        explain: "Always would restart a finished pod forever, so a Job could never complete.",
      },
      {
        q: "How do you run a CronJob's job right now, to test it?",
        options: ["kubectl run --from-cron", "kubectl create job test --from=cronjob/NAME", "Change the schedule to * * * * * and wait", "kubectl rollout restart cronjob/NAME"],
        answer: 1,
        explain: "It creates a Job from the CronJob's jobTemplate immediately.",
      },
      {
        q: "A node is added to the cluster. A DaemonSet…",
        options: ["Ignores it until you scale up", "Automatically starts its pod there (if selectors and taints allow)", "Moves an existing pod there", "Needs a restart"],
        answer: 1,
        explain: "DaemonSets track the set of eligible nodes.",
      },
    ],
  },
];
