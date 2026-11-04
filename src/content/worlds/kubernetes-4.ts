import type { Lesson } from "../types";

// Kubernetes, part 4: traffic and state. Ingress and the Gateway API, NetworkPolicies, volumes and StatefulSets.

export const kubernetesPart4: Lesson[] = [
  // ------------------------------------------------------------------ INGRESS
  {
    id: "k8s-ingress",
    part: "Part 4 · Traffic and state",
    title: "Ingress and the Gateway API",
    tagline: "One entrance for many apps: routing by host and path with Ingress, and canaries and header matching with the Gateway API's HTTPRoutes.",
    difficulty: "intermediate",
    minutes: 22,
    diagram: {
      title: "From the internet to a pod",
      nodes: [
        { id: "user", label: "Browser", kind: "client", x: 90, y: 270, sub: "https://shop.example.com/cart" },
        { id: "dns", label: "DNS", kind: "external", x: 90, y: 470, sub: "shop.example.com → LB IP" },
        { id: "lb", label: "Cloud load balancer", kind: "gateway", x: 300, y: 270, sub: "one public IP" },
        { id: "ctrl", label: "Ingress controller", kind: "gateway", x: 520, y: 270, sub: "Traefik, NGINX, Envoy" },
        { id: "rules", label: "Ingress / HTTPRoute", kind: "control", x: 520, y: 70, sub: "host + path rules, TLS" },
        { id: "shop", label: "Service shop", kind: "service", x: 760, y: 160, sub: "→ shop pods" },
        { id: "blog", label: "Service blog", kind: "service", x: 760, y: 380, sub: "→ blog pods" },
        { id: "pods", label: "Pods", kind: "worker", x: 900, y: 270, sub: "the apps" },
      ],
      edges: [
        { from: "user", to: "dns", label: "lookup", dashed: true },
        { from: "user", to: "lb", label: "HTTPS" },
        { from: "lb", to: "ctrl", label: "NodePort / pod IP" },
        { from: "rules", to: "ctrl", label: "watched", dashed: true },
        { from: "ctrl", to: "shop", label: "Host: shop.example.com" },
        { from: "ctrl", to: "blog", label: "/blog" },
        { from: "shop", to: "pods" },
        { from: "blog", to: "pods" },
      ],
      flows: [
        {
          name: "A request for shop.example.com/cart",
          path: ["user", "lb", "ctrl", "shop", "pods"],
          steps: [
            "DNS points shop.example.com at the load balancer's public IP; the browser connects and sends the Host header.",
            "The cloud load balancer (made by a LoadBalancer Service) forwards to the ingress controller's pods.",
            "The controller terminates TLS, matches the Host header and path against every Ingress or HTTPRoute it watches, and picks the shop backend.",
            "It sends the request to one of the shop Service's ready pods (most controllers go straight to pod IPs from the EndpointSlices).",
          ],
        },
        {
          name: "Someone adds a route",
          path: ["rules", "ctrl", "blog"],
          steps: [
            "An app team applies an Ingress (or HTTPRoute) for /blog. The controller is watching those objects through the API.",
            "Within seconds it reloads its routing table: /blog now goes to the blog Service. No load balancer was created or changed.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
A big building has one front door and a receptionist. Visitors say "I'm here for the dentist on floor 3" or "the library", and the receptionist points them to the right room. Without a receptionist, every office would need its own door to the street: expensive, and confusing for visitors.

In Kubernetes, the **ingress controller** is the receptionist. It's just an app running in pods, behind one load balancer (one front door, one public IP). The **Ingress** objects are the sign by the door that tells it where to send people: "visitors for \`shop.example.com\` go to the shop; anyone asking for \`/blog\` goes to the blog".

The newer **Gateway API** is a better-organized version of the same idea: the building owner sets up the door (**Gateway**), and each office writes its own little sign (**HTTPRoute**), including fancy rules like "send 1 visitor in 5 to the new office we're trying out".

## Why not a LoadBalancer per Service?
Each LoadBalancer Service gets its own cloud load balancer: an IP, a monthly bill, and only layer-4 (TCP) routing. Real web apps want **layer-7** routing: by host name, by URL path, with TLS certificates, redirects and headers. An ingress controller gives you all of that, for every Service, behind **one** load balancer.

## Ingress
An Ingress is a list of **rules** (host + path → Service + port) plus optional **TLS** settings (which Secret holds the certificate for which hosts). Things to know:
- An Ingress does **nothing** without an **ingress controller** installed (ingress-nginx, Traefik, HAProxy, Contour, or your cloud's ALB/GCLB controller). \`ingressClassName\` says which one should handle it; one IngressClass can be the cluster default.
- \`pathType\`: \`Prefix\` (matches \`/blog\` and \`/blog/x\`, by path segment), \`Exact\`, or \`ImplementationSpecific\`. The longest matching path wins.
- Anything beyond basic routing (rewrites, timeouts, rate limits, auth) is done with **controller-specific annotations**, so Ingresses aren't portable between controllers.
- **cert-manager** watches Ingresses (or Gateways) and gets free TLS certificates from Let's Encrypt into Secrets, renewing them automatically.

## Gateway API
The successor, now the recommended API for new clusters (the community ingress-nginx project has been retired). It splits responsibilities between roles:
| Object | Owned by | Says |
|---|---|---|
| **GatewayClass** | the controller vendor | "Traefik / Envoy Gateway / Istio / a cloud LB implements Gateways" |
| **Gateway** | the platform team | listeners: ports, protocols, host names, TLS, which namespaces may attach routes |
| **HTTPRoute** (also GRPCRoute, TLSRoute...) | app teams | matches (path, headers, query, method), filters (redirects, rewrites, header changes) and **weighted backends** |

What it fixes compared with Ingress: header and method matching, traffic splitting by weight, request mirroring, cross-namespace rules with explicit permission (\`ReferenceGrant\`), and status conditions on every route (\`Accepted\`, \`ResolvedRefs\`) that tell you *why* a route doesn't work, all in the spec instead of annotations.

## Canary and blue/green with routes
Weighted \`backendRefs\` make **canary releases** easy: run \`checkout-v1\` and \`checkout-v2\` side by side, send 5% to v2, watch errors and latency, then 25%, 50%, 100%. A header match (\`x-beta: yes\`) lets testers reach v2 directly. **Blue/green** is the same with 0/100 weights flipped at once. Argo Rollouts and Flagger automate the steps and roll back on bad metrics.`,
    keyPoints: [
      "An ingress controller is an L7 proxy running in the cluster; Ingress objects are its routing rules (host, path, TLS).",
      "Without a controller, an Ingress does nothing. ingressClassName picks the controller.",
      "Advanced Ingress features live in controller-specific annotations, so Ingresses aren't portable.",
      "Gateway API splits roles: GatewayClass (implementation), Gateway (platform team), HTTPRoute (app teams), with header matching and weights built in.",
      "Weighted backendRefs give canary releases; route status conditions explain why a route isn't working.",
    ],
    code: [
      {
        title: "Ingress: routing by host and path",
        k8s: true,
        images: ["node:20-slim"],
        files: [
          { path: "apps.yaml", lang: "yaml", code: `# Two small apps, each with a Service
apiVersion: apps/v1
kind: Deployment
metadata: { name: shop, namespace: quest-ingress }
spec:
  selector: { matchLabels: { app: shop } }
  template:
    metadata: { labels: { app: shop } }
    spec:
      containers:
        - name: shop
          image: node:20-slim
          command: ["node", "-e", "require('http').createServer((q, s) => s.end('shop: you asked for ' + q.url)).listen(8080); process.on('SIGTERM', () => process.exit(0))"]
---
apiVersion: v1
kind: Service
metadata: { name: shop, namespace: quest-ingress }
spec:
  selector: { app: shop }
  ports: [{ port: 80, targetPort: 8080 }]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: blog, namespace: quest-ingress }
spec:
  selector: { matchLabels: { app: blog } }
  template:
    metadata: { labels: { app: blog } }
    spec:
      containers:
        - name: blog
          image: node:20-slim
          command: ["node", "-e", "require('http').createServer((q, s) => s.end('blog: you asked for ' + q.url)).listen(8080); process.on('SIGTERM', () => process.exit(0))"]
---
apiVersion: v1
kind: Service
metadata: { name: blog, namespace: quest-ingress }
spec:
  selector: { app: blog }
  ports: [{ port: 80, targetPort: 8080 }]` },
          { path: "ingress.yaml", lang: "yaml", code: `# One entrance for both: route by host name and by path
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: site
  namespace: quest-ingress
spec:
  ingressClassName: traefik          # which ingress controller should handle this
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: shop, port: { number: 80 } } }
    - host: example.com
      http:
        paths:
          - path: /blog
            pathType: Prefix
            backend: { service: { name: blog, port: { number: 80 } } }
          - path: /
            pathType: Prefix
            backend: { service: { name: shop, port: { number: 80 } } }` },
        ],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-ingress > /dev/null
kubectl apply -f apps.yaml > /dev/null
kubectl apply -f ingress.yaml
kubectl -n quest-ingress rollout status deployment/shop deployment/blog --timeout=120s > /dev/null

# The ingress controller (Traefik in this cluster) is itself a pod behind a Service.
# Ask it for different hosts and paths, as a browser would (the Host header carries the name).
kubectl -n quest-ingress run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-ingress wait --for=condition=Ready pod/client --timeout=120s > /dev/null
visit() {   # host, path
  for _ in $(seq 1 40); do
    out=$(kubectl -n quest-ingress exec client -- node -e "
      require('http').get({ host: 'traefik.kube-system', path: '$2', agent: false, headers: { Host: '$1' } }, (res) => {
        let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => console.log(res.statusCode, body));
      })")
    case "$out" in 200*) break ;; esac   # the controller needs a moment to pick up a new Ingress
    sleep 0.5
  done
  printf '%-36s -> %s\\n' "http://$1$2" "$out"
}
visit shop.example.com /cart
visit example.com /blog/hello-world
visit example.com /about
kubectl -n quest-ingress exec client -- node -e "
  require('http').get({ host: 'traefik.kube-system', path: '/', agent: false, headers: { Host: 'unknown.example.com' } }, (res) => console.log('http://unknown.example.com/'.padEnd(36), '->', res.statusCode, '(no rule matches)'))"` }],
        explain: `- Two apps, each with an ordinary ClusterIP Service. The Ingress maps \`shop.example.com\` to shop, and on \`example.com\` sends \`/blog\` to blog and everything else to shop: the longest matching prefix wins.
- This cluster's ingress controller is **Traefik**, reachable inside the cluster as the Service \`traefik.kube-system\`. The client sets the \`Host\` header, exactly what a browser does after DNS sends it to the load balancer.
- An unknown host gets a 404 from the controller itself: no rule matched.
- On kind or minikube, install ingress-nginx (or enable the minikube addon) and set \`ingressClassName: nginx\`.`,
        output: `ingress.networking.k8s.io/site created
http://shop.example.com/cart         -> 200 shop: you asked for /cart
http://example.com/blog/hello-world  -> 200 blog: you asked for /blog/hello-world
http://example.com/about             -> 200 shop: you asked for /about
http://unknown.example.com/          -> 404 (no rule matches)`,
      },
      {
        title: "Gateway API: a canary with a beta header",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-gateway > /dev/null
# Two versions of the same app: v1 (current) and v2 (the new release)
for v in v1 v2; do
  kubectl -n quest-gateway create deployment checkout-$v --image=node:20-slim -- \\
    node -e "require('http').createServer((q, s) => s.end('$v')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
  kubectl -n quest-gateway expose deployment checkout-$v --port=80 --target-port=8080 > /dev/null
done

# Gateway API: the cluster operator owns the Gateway (the entrance), app teams own the Routes
kubectl -n quest-gateway apply -f - <<'YAML'
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: public }
spec:
  gatewayClassName: traefik
  listeners:
    - name: web
      protocol: HTTP
      port: 8000                           # Traefik's "web" entrypoint
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: checkout }
spec:
  parentRefs: [{ name: public }]
  hostnames: ["shop.example.com"]
  rules:
    - matches: [{ headers: [{ name: x-beta, value: "yes" }] }]   # testers always get v2
      backendRefs: [{ name: checkout-v2, port: 80 }]
    - backendRefs:                                               # everyone else: a 80/20 canary
        - { name: checkout-v1, port: 80, weight: 80 }
        - { name: checkout-v2, port: 80, weight: 20 }
YAML
kubectl -n quest-gateway rollout status deployment/checkout-v1 deployment/checkout-v2 --timeout=120s > /dev/null
kubectl -n quest-gateway wait --for=condition=Programmed gateway/public --timeout=120s
kubectl -n quest-gateway get httproute checkout -o jsonpath='{range .status.parents[0].conditions[*]}route {.type}: {.status}{"\\n"}{end}'

kubectl -n quest-gateway run client --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-gateway wait --for=condition=Ready pod/client --timeout=120s > /dev/null
kubectl -n quest-gateway exec client -- node -e "
  const http = require('http');
  const get = (headers) => new Promise((ok) => http.get({ host: 'traefik.kube-system', path: '/', agent: false, headers: { Host: 'shop.example.com', ...headers } },
    (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => ok(res.statusCode === 200 ? b : 'HTTP ' + res.statusCode)); }));
  (async () => {
    while ((await get({})).startsWith('HTTP')) await new Promise((r) => setTimeout(r, 500));   // wait for the route
    const count = { v1: 0, v2: 0 };
    for (let i = 0; i < 400; i++) count[await get({})]++;
    console.log('400 normal requests: v1 got about', Math.round(count.v1 / 40) * 10 + '%,', 'v2 about', Math.round(count.v2 / 40) * 10 + '%');
    const beta = new Set();
    for (let i = 0; i < 20; i++) beta.add(await get({ 'x-beta': 'yes' }));
    console.log('20 requests with x-beta: yes -> all went to', [...beta].join(', '));
  })();"` }],
        explain: `- The **Gateway** \`public\` asks the \`traefik\` GatewayClass for an HTTP listener. Port 8000 is the port of Traefik's "web" entrypoint; other implementations take the port you want the world to see.
- The **HTTPRoute** attaches to it (\`parentRefs\`) for \`shop.example.com\`. Rules are checked most specific first: requests with \`x-beta: yes\` always go to v2; the rest are split 80/20 by \`weight\`.
- \`status.parents[].conditions\` says whether the Gateway accepted the route and whether the backends exist. When a route "does nothing", read these first.
- 400 requests land at about 80% / 20%. Raise v2's weight step by step to finish the rollout, or set it to 0 to roll back instantly.`,
        output: `gateway.gateway.networking.k8s.io/public created
httproute.gateway.networking.k8s.io/checkout created
gateway.gateway.networking.k8s.io/public condition met
route Accepted: True
route ResolvedRefs: True
400 normal requests: v1 got about 80%, v2 about 20%
20 requests with x-beta: yes -> all went to v2`,
      },
    ],
    interview: [
      {
        q: "Ingress vs Gateway API vs a LoadBalancer Service?",
        a: "A **LoadBalancer Service** gives one cloud L4 load balancer per Service: simple, but expensive and with no host/path routing. **Ingress** is an L7 routing object (hosts, paths, TLS) implemented by an ingress controller behind a single LB; anything advanced needs controller-specific annotations, and one object mixes platform and app concerns. **Gateway API** is the successor: role-oriented (`GatewayClass` → `Gateway` for the platform team, `HTTPRoute`/`GRPCRoute` for app teams), portable features in the spec (header matching, weighted splits, timeouts), and cross-namespace delegation. New clusters should prefer Gateway API.",
        freq: "common",
      },
      {
        q: "How would you do a canary release on Kubernetes?",
        a: "Run the new version as a separate Deployment (`app=checkout, version=v2`) next to v1 and split traffic: with the **Gateway API**, an HTTPRoute with weighted `backendRefs` (95/5), optionally a header match so testers always hit v2; with a service mesh, a VirtualService or HTTPRoute weight; with plain Services, replica ratios (crude: 1 of 20 pods). Watch error rate and latency per version, then step up (5 → 25 → 50 → 100) or set the weight to 0 to roll back. **Argo Rollouts** or **Flagger** automate the steps with metric analysis and automatic rollback. Make releases backward compatible (database migrations, API contracts), since both versions serve at once.",
        freq: "common",
      },
      {
        q: "An Ingress returns 404 for a host that should work. How do you debug it?",
        a: "Check the request reaches the right controller: DNS for the host points at the controller's load balancer; the Ingress has the right `ingressClassName` (or the class is the default) and shows an ADDRESS; `kubectl describe ingress` events. Then the rule: exact host spelling, `pathType` (Prefix matches whole segments; Exact needs the full path), path rewrites the app doesn't expect. Then the backend: Service name and port exist in the **same namespace** as the Ingress, and the Service has ready endpoints (`kubectl get endpointslices`); a missing backend is usually a 503, not a 404. Finally the controller's logs and its generated config. With Gateway API, the HTTPRoute's `Accepted`/`ResolvedRefs` conditions answer most of this directly.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "You create an Ingress in a cluster with no ingress controller installed. What happens?",
        options: ["Kubernetes creates a load balancer automatically", "Nothing: the object is stored but no one implements it", "The API server rejects it", "kube-proxy routes it"],
        answer: 1,
        explain: "Ingress is just configuration for a controller you install.",
      },
      {
        q: "In the Gateway API, which object do application teams usually own?",
        options: ["GatewayClass", "Gateway", "HTTPRoute", "IngressClass"],
        answer: 2,
        explain: "Platform teams own Gateways (listeners, TLS); app teams attach HTTPRoutes to them.",
      },
      {
        q: "Rules /blog (Prefix) and / (Prefix) both exist for the same host. A request for /blog/post goes to…",
        options: ["/ (it was defined first)", "/blog: the longest matching prefix wins", "Both", "Neither: 404"],
        answer: 1,
        explain: "Ingress and HTTPRoute both prefer the most specific match.",
      },
      {
        q: "Why put many Services behind one ingress controller instead of one LoadBalancer Service each?",
        options: ["LoadBalancer Services don't work with HTTPS", "One cloud load balancer and IP for all, plus L7 routing by host and path", "Ingress is faster than TCP", "It's required by Kubernetes"],
        answer: 1,
        explain: "Cost and features: each LoadBalancer is a billed L4 load balancer; an ingress controller does L7 routing for all.",
      },
    ],
  },

  // ------------------------------------------------------------------ NETWORK POLICY
  {
    id: "k8s-netpol",
    title: "NetworkPolicies",
    tagline: "Every pod can reach every pod until you say otherwise: default deny, allow by label, egress rules and the DNS gotcha.",
    difficulty: "intermediate",
    minutes: 18,
    visualizers: ["k8snet"],
    concept: `## Explain it like I'm 10 🧸
In a new school, every classroom door is unlocked and anyone can walk into any room. That's friendly, but if one troublemaker sneaks in, they can reach the head teacher's office, the cash box, everything.

A **NetworkPolicy** is a lock with a guest list, put on a door. "The kitchen: only the cooks may come in, and only through the back door." Once a room has a lock, anyone not on its list is stopped, quietly: no shouting, the door just doesn't open.

Locks can also be on the way **out**: "the kids in the art room may only go to the paint cupboard". But careful: if you forget to put "the school office" on that list, the kids can't even ask for directions. In Kubernetes, the office that gives directions is **DNS**, and forgetting it is the most common mistake.

## The default: everything is allowed
Out of the box, any pod can connect to any pod in any namespace. A compromised web pod can reach your database, your Redis and the internal admin API. NetworkPolicies let you shrink that.

## How a policy works
- \`podSelector\` picks the pods the policy **protects** (empty \`{}\` = every pod in the namespace).
- \`policyTypes\` says which directions it controls: \`Ingress\` (incoming), \`Egress\` (outgoing) or both.
- Once **any** policy selects a pod for a direction, that direction becomes **default deny** for the pod, and only what some policy's rules allow gets through. Policies **add up** (a union of allow lists); there's no "deny" rule.
- Rules list **who** (\`from\` / \`to\`: \`podSelector\`, \`namespaceSelector\`, both together, or \`ipBlock\` CIDRs) and **which ports**.
- Replies to allowed connections are always allowed: policies are about who may *start* a connection.

The selector syntax has a famous trap:
\`\`\`yaml
from:
  - namespaceSelector: { matchLabels: { team: a } }   # one item: pods in team-a namespaces
    podSelector: { matchLabels: { app: web } }        #   AND labelled app=web
  - podSelector: { matchLabels: { app: web } }        # a second item: OR app=web in THIS namespace
\`\`\`
One dash = AND, two dashes = OR. A misplaced dash opens a hole or closes the door.

## A good baseline
1. In each namespace, a **default-deny** for ingress (and, for sensitive namespaces, egress).
2. Allow each real flow explicitly: frontend → api on 8080, api → database on 5432.
3. If you deny egress, **allow DNS** (UDP and TCP 53 to kube-dns in kube-system) or nothing can resolve names.
4. Allow traffic from the ingress controller's namespace to the pods it serves, and from monitoring to metrics ports.

Namespaces get an automatic label \`kubernetes.io/metadata.name: NAME\`, which makes \`namespaceSelector\` rules easy.

## Who enforces it
The **CNI plugin** does, not Kubernetes itself. Calico, Cilium, Antrea, kube-router (built into k3s) and most cloud CNIs enforce policies; a plugin without support (plain Flannel, older kindnet) **accepts the objects and ignores them**, silently. Test your policies, like the samples do.

Standard NetworkPolicy is layer 3/4: IPs, ports, labels. For DNS-name rules ("may call api.stripe.com"), HTTP methods and paths, or cluster-wide policies, use the CNI's own policy types (CiliumNetworkPolicy, Calico GlobalNetworkPolicy) or a service mesh with mutual TLS and authorization policies.`,
    keyPoints: [
      "By default every pod can reach every pod; NetworkPolicies restrict that, enforced by the CNI plugin.",
      "A pod selected by any policy for a direction becomes default-deny for that direction; policies only add allows.",
      "Start with a default-deny per namespace, then allow each flow by pod and namespace labels and ports.",
      "Denying egress also blocks DNS: allow UDP/TCP 53 to kube-dns.",
      "One list item with namespaceSelector and podSelector means AND; two items mean OR. Test policies: unsupported CNIs ignore them silently.",
    ],
    code: [
      {
        title: "Default deny, then allow the frontend",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "policies.yaml", lang: "yaml", code: `# 1. Deny all incoming traffic to every pod in the namespace (an empty podSelector = all pods)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-ingress, namespace: quest-netpol }
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
# 2. Then open exactly what's needed: the api accepts port 8080, only from frontend pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: api-from-frontend, namespace: quest-netpol }
spec:
  podSelector: { matchLabels: { app: api } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { role: frontend } }
      ports:
        - { protocol: TCP, port: 8080 }` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-netpol > /dev/null
kubectl -n quest-netpol run api --image=node:20-slim --labels=app=api --port=8080 -- \\
  node -e "require('http').createServer((q, s) => s.end('api: here are your orders')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
kubectl -n quest-netpol expose pod api --port=80 --target-port=8080 > /dev/null
kubectl -n quest-netpol run frontend --image=node:20-slim --labels=role=frontend -- sleep 3600 > /dev/null
kubectl -n quest-netpol run intruder --image=node:20-slim --labels=role=batch -- sleep 3600 > /dev/null
kubectl -n quest-netpol wait --for=condition=Ready pod/api pod/frontend pod/intruder --timeout=120s > /dev/null

call() {   # from which pod
  kubectl -n quest-netpol exec "$1" -- node -e "
    fetch('http://api', { signal: AbortSignal.timeout(2000) }).then((r) => r.text()).then((t) => console.log('$1'.padEnd(9), '->', t),
      () => console.log('$1'.padEnd(9), '-> blocked (no answer)'))"
}
for _ in $(seq 1 40); do call frontend | grep -q orders && break; sleep 0.5; done   # wait for the new Service
echo "no policies: every pod can talk to every pod"
call frontend; call intruder

kubectl apply -f policies.yaml
sleep 3      # the network plugin programs the rules on each node
echo "with the policies:"
for _ in $(seq 1 20); do [ "$(call intruder)" = "intruder  -> blocked (no answer)" ] && break; done
call frontend; call intruder` }],
        explain: `- Before any policy, both the frontend and the "intruder" get the orders.
- \`default-deny-ingress\` selects every pod and allows nothing in. \`api-from-frontend\` then opens port 8080 of the api, only from pods labelled \`role=frontend\`.
- Blocked connections don't get an error: packets are dropped and the client **times out**. "Hangs then times out" is the signature of a NetworkPolicy; "connection refused" points elsewhere (nothing listening, no endpoints).
- The rules follow **labels**, not IPs: a new frontend pod is allowed the moment it starts.`,
        output: `no policies: every pod can talk to every pod
frontend  -> api: here are your orders
intruder  -> api: here are your orders
networkpolicy.networking.k8s.io/default-deny-ingress created
networkpolicy.networking.k8s.io/api-from-frontend created
with the policies:
frontend  -> api: here are your orders
intruder  -> blocked (no answer)`,
      },
      {
        title: "Egress: the DNS gotcha",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-egress > /dev/null
kubectl -n quest-egress run api --image=node:20-slim --labels=app=api -- \\
  node -e "require('http').createServer((q, s) => s.end('ok')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
kubectl -n quest-egress expose pod api --port=80 --target-port=8080 > /dev/null
kubectl -n quest-egress run worker --image=node:20-slim --labels=app=worker -- sleep 3600 > /dev/null
kubectl -n quest-egress wait --for=condition=Ready pod/api pod/worker --timeout=120s > /dev/null
try() {   # look up the name "api", then call it
  kubectl -n quest-egress exec worker -- node -e "
    const dns = new (require('dns').promises.Resolver)({ timeout: 1500, tries: 1 });
    dns.resolve4('api.quest-egress.svc.cluster.local').then(
      ([ip]) => fetch('http://' + ip, { signal: AbortSignal.timeout(2000) }).then((r) => r.text())
        .then((t) => console.log('DNS lookup ok, api says:', t), () => console.log('DNS lookup ok, api: no answer')),
      () => console.log('DNS lookup failed: the name can not even be looked up'))"
}
for _ in $(seq 1 40); do try | grep -q 'says: ok' && break; sleep 0.5; done   # wait for the new Service
try

# Lock down OUTGOING traffic too: the worker may only talk to the api...
kubectl -n quest-egress apply -f - > /dev/null <<'YAML'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: worker-egress }
spec:
  podSelector: { matchLabels: { app: worker } }
  policyTypes: [Egress]
  egress:
    - to: [{ podSelector: { matchLabels: { app: api } } }]
      ports: [{ protocol: TCP, port: 8080 }]
YAML
sleep 3
for _ in $(seq 1 20); do try | grep -q failed && break; done
try    # ...which also blocked DNS! The name "api" can't be looked up any more.

# The classic fix: also allow DNS to the cluster's DNS server (CoreDNS in kube-system)
kubectl -n quest-egress patch networkpolicy worker-egress --type=json -p='[{"op": "add", "path": "/spec/egress/-", "value":
  {"to": [{"namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": "kube-system"}}, "podSelector": {"matchLabels": {"k8s-app": "kube-dns"}}}],
   "ports": [{"protocol": "UDP", "port": 53}, {"protocol": "TCP", "port": 53}]}}]' > /dev/null
for _ in $(seq 1 30); do try | grep -q 'says: ok' && break; sleep 1; done
try` }],
        explain: `- The worker's egress policy allows only the api pods on 8080, which looks right, but now the worker can't even **look up** the name \`api\`: DNS queries to CoreDNS are outgoing traffic too, and they're denied.
- The fix adds a second egress rule: UDP and TCP port 53 to pods labelled \`k8s-app=kube-dns\` in the \`kube-system\` namespace (one list item, so namespace AND pod must match).
- The sample talks to the Service by its **ClusterIP**, and the policy allows the **pod** labels behind it: policies apply after kube-proxy has translated the Service IP to a pod IP.`,
        output: `DNS lookup ok, api says: ok
DNS lookup failed: the name can not even be looked up
DNS lookup ok, api says: ok`,
      },
    ],
    interview: [
      {
        q: "How would you isolate namespaces so a compromised pod can't reach the database?",
        a: "Use a CNI that enforces **NetworkPolicy** (Calico, Cilium). Apply a **default-deny** for ingress and egress in each namespace, then explicitly allow: frontend → api on 8080, api → database on 5432, everyone → kube-dns on 53, and any required egress (via CIDR or an egress gateway). Database pods accept only from pods labelled `app=api` in the `shop` namespace (podSelector + namespaceSelector). Add L7 or identity-based policies (Cilium, or a mesh with mTLS and authorization policies) for stronger guarantees, and test policies, since a missing rule just looks like a timeout.",
        freq: "common",
      },
      {
        q: "You applied a NetworkPolicy and now a service can't connect, but you're sure the policy allows it. What do you check?",
        a: "Read it as the CNI does: does the policy's `podSelector` select the **destination** pods (ingress) or the **source** pods (egress)? Do the `from`/`to` selectors match the other side's **labels** (and its namespace's labels for `namespaceSelector`: one list item means AND, separate items mean OR)? Is the **port** the pod's container port (policies see traffic after Service DNAT, so it's targetPort, not the Service port)? Is there an egress policy on the source that blocks it, including **DNS**? Are other policies also selecting these pods (they add up, but a default-deny elsewhere matters)? Then test from a pod with the right labels, and check the CNI actually enforces policies and its logs (Cilium's Hubble shows drops with the policy that caused them).",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "You add an egress default-deny policy and every service suddenly fails to connect by name. Why?",
        options: ["NetworkPolicies block loopback", "DNS (port 53 to kube-dns) is now denied too", "Services require ingress rules", "The CNI must be restarted"],
        answer: 1,
        explain: "Egress default-deny blocks DNS queries. Add an explicit allow rule for kube-dns on UDP/TCP 53.",
      },
      {
        q: "A namespace has no NetworkPolicies. Which pods can connect to its pods?",
        options: ["None", "Only pods in the same namespace", "Any pod in the cluster", "Only pods with the same labels"],
        answer: 2,
        explain: "Kubernetes networking is allow-all until a policy selects a pod.",
      },
      {
        q: "Two policies select the same pod: one allows from app=a, the other from app=b. Who can connect?",
        options: ["Only app=a (first wins)", "Only app=b (last wins)", "Both app=a and app=b", "Nobody: they conflict"],
        answer: 2,
        explain: "Policies are additive: the allowed set is the union of all rules.",
      },
      {
        q: "Your CNI is plain Flannel. You apply a default-deny policy. What happens?",
        options: ["All traffic is blocked", "The object is accepted but nothing is enforced", "The API server rejects it", "Only egress is blocked"],
        answer: 1,
        explain: "Enforcement is the CNI's job. Without support, policies are silently ignored, so test them.",
      },
    ],
  },

  // ------------------------------------------------------------------ STATE
  {
    id: "k8s-state",
    title: "Volumes, PersistentVolumes and StatefulSets",
    tagline: "Data that outlives a pod: emptyDir vs PersistentVolumeClaims, StorageClasses, and StatefulSets with stable names and a disk per replica.",
    difficulty: "intermediate",
    minutes: 22,
    visualizers: ["statefulset"],
    concept: `## Explain it like I'm 10 🧸
A pod is like a kid at a hotel. Anything they put in the hotel room (a drawing on the desk) is gone when they check out: the next guest gets a clean room. That's a container's own filesystem, and also an **emptyDir** volume: scratch space that lives exactly as long as the pod.

If the kid wants to keep their drawings, they rent a **locker** in the lobby. The locker isn't part of the room. When they check out and come back next week, in a different room, their drawings are still in their locker. In Kubernetes, asking for a locker is a **PersistentVolumeClaim** ("I need 1 GiB"), and the locker itself is a **PersistentVolume**, a real disk somewhere.

Now imagine a band where each musician has a **name** ("drummer", "singer") and their **own** locker. If the drummer goes home sick and comes back, they're still "drummer", and they open the drummer's locker, not just any locker. That's a **StatefulSet**: pods with fixed names (\`db-0\`, \`db-1\`) and a disk each that follows them.

## Volumes: the quick tour
A pod lists \`volumes\`; each container mounts some of them with \`volumeMounts\`.
| Volume | Lives as long as | Used for |
|---|---|---|
| \`emptyDir\` | the pod | scratch space, sharing files between containers, caches (\`medium: Memory\` for RAM) |
| \`configMap\`, \`secret\`, \`projected\`, \`downwardAPI\` | the pod (content from the API) | config files, credentials, pod metadata |
| \`persistentVolumeClaim\` | the **claim** | databases, uploads, anything that must survive |
| \`hostPath\` | the node | node agents only; a security risk for apps |
| \`ephemeral\` | the pod, but a real provisioned disk | big scratch space |

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

## Backups are your job
A PersistentVolume is one disk. It survives pod restarts, not mistakes (\`DROP TABLE\`), corruption, a deleted PVC with \`reclaimPolicy: Delete\`, or a lost zone. Use **VolumeSnapshots** (CSI), tools like **Velero** for cluster-level backup, and the database's own backups (\`pg_dump\`, WAL archiving), and test restores.`,
    keyPoints: [
      "emptyDir lives and dies with the pod; a PersistentVolumeClaim outlives it.",
      "PVC = a request, PV = the actual disk, StorageClass = how disks are made (CSI driver, type, reclaim policy, binding mode).",
      "WaitForFirstConsumer creates the disk in the zone where the pod is scheduled; block disks are zonal and ReadWriteOnce.",
      "StatefulSets give stable names (db-0), stable DNS through a headless Service, ordered startup and a PVC per replica.",
      "PVCs are kept when a StatefulSet scales down; disks aren't backups, so snapshot and back up.",
    ],
    code: [
      {
        title: "emptyDir vs a PersistentVolumeClaim",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-pvc > /dev/null
kubectl -n quest-pvc apply -f - <<'YAML'
# "I need 1 GiB of disk." The cluster's default StorageClass decides where it comes from
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: notes }
spec:
  accessModes: [ReadWriteOnce]       # one node at a time may mount it
  resources: { requests: { storage: 1Gi } }
YAML
kubectl get storageclass -o custom-columns='STORAGECLASS:.metadata.name,PROVISIONER:.provisioner,BINDING:.volumeBindingMode'

notes() {   # a pod with two volumes: an emptyDir (scratch space) and the claim
  kubectl -n quest-pvc apply -f - > /dev/null <<'YAML'
apiVersion: v1
kind: Pod
metadata: { name: notes }
spec:
  terminationGracePeriodSeconds: 1
  containers:
    - name: app
      image: node:20-slim
      command: ["sleep", "3600"]
      volumeMounts:
        - { name: scratch, mountPath: /scratch }
        - { name: notes, mountPath: /data }
  volumes:
    - name: scratch
      emptyDir: {}                     # lives and dies with the pod
    - name: notes
      persistentVolumeClaim: { claimName: notes }
YAML
  kubectl -n quest-pvc wait --for=condition=Ready pod/notes --timeout=120s > /dev/null
}
notes
kubectl -n quest-pvc get pvc notes -o custom-columns='CLAIM:.metadata.name,STATUS:.status.phase,SIZE:.status.capacity.storage'
kubectl -n quest-pvc exec notes -- sh -c 'echo "buy milk" > /scratch/todo.txt; echo "buy milk" > /data/todo.txt'

# The pod is deleted and a new one is made (a crash, a rollout, a node drain...)
kubectl -n quest-pvc delete pod notes > /dev/null
notes
kubectl -n quest-pvc exec notes -- sh -c 'echo "emptyDir: $(cat /scratch/todo.txt 2>/dev/null || echo "(gone)")"; echo "PVC:      $(cat /data/todo.txt)"'` }],
        explain: `- The PVC asks for 1 GiB. This cluster's default StorageClass, \`local-path\`, makes a folder on a node's disk; in a cloud it would be an EBS volume or a Persistent Disk. \`WaitForFirstConsumer\` means nothing is created until a pod uses the claim, so it can be created where the pod lands.
- The pod writes the same note into the emptyDir and onto the PVC. After the pod is deleted and recreated, the emptyDir note is gone and the PVC note is still there.
- With local-path, the PV is tied to one node, so the new pod is scheduled on the same node. Cloud disks are tied to a **zone** instead.`,
        output: `persistentvolumeclaim/notes created
STORAGECLASS   PROVISIONER             BINDING
local-path     rancher.io/local-path   WaitForFirstConsumer
CLAIM   STATUS   SIZE
notes   Bound    1Gi
emptyDir: (gone)
PVC:      buy milk`,
      },
      {
        title: "A StatefulSet: names, order and a disk each",
        k8s: true,
        images: ["node:20-slim"],
        files: [{ path: "db.yaml", lang: "yaml", code: `# The headless Service gives each pod its own DNS name: db-0.db, db-1.db, ...
apiVersion: v1
kind: Service
metadata: { name: db, namespace: quest-sts }
spec:
  clusterIP: None
  selector: { app: db }
  ports: [{ port: 5432 }]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: db, namespace: quest-sts }
spec:
  serviceName: db
  replicas: 3
  selector: { matchLabels: { app: db } }
  template:
    metadata: { labels: { app: db } }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: db
          image: node:20-slim
          # on first start, remember "who I was born as"; on later starts, read it back
          command: ["sh", "-c", "[ -f /data/born ] || echo \\"$(hostname), born on first start\\" > /data/born; sleep 3600"]
          volumeMounts: [{ name: data, mountPath: /data }]
  volumeClaimTemplates:                  # one PVC per pod: data-db-0, data-db-1, data-db-2
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        resources: { requests: { storage: 1Gi } }` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-sts > /dev/null
kubectl apply -f db.yaml 2> /dev/null > /dev/null
kubectl -n quest-sts rollout status statefulset/db --timeout=180s > /dev/null

# Stable names, created one at a time in order (db-0 must be Ready before db-1 starts)
kubectl -n quest-sts get pods -l app=db --sort-by=.metadata.creationTimestamp -o custom-columns='POD:.metadata.name' --no-headers | tr '\\n' ' ' | sed 's/ $/\\n/' | sed 's/^/created in order: /'
kubectl -n quest-sts get pvc --sort-by=.metadata.name -o custom-columns='PVC:.metadata.name,STATUS:.status.phase'

# Delete db-1: it comes back with the SAME name and the SAME disk
kubectl -n quest-sts delete pod db-1 > /dev/null
until kubectl -n quest-sts get pod db-1 > /dev/null 2>&1; do sleep 0.5; done
kubectl -n quest-sts wait --for=condition=Ready pod/db-1 --timeout=120s > /dev/null
kubectl -n quest-sts exec db-1 -- sh -c 'echo "db-1 is back, and its disk says: $(cat /data/born)"'

# Each pod can be reached by name: handy for "connect to the primary, db-0"
for i in 0 1 2; do
  ip=$(kubectl -n quest-sts exec db-2 -- node -e "require('dns').lookup('db-$i.db', (err, ip) => console.log(ip))")
  [ "$ip" = "$(kubectl -n quest-sts get pod db-$i -o jsonpath='{.status.podIP}')" ] && echo "db-$i.db -> the IP of pod db-$i"
done

# Scale down: pods go away from the highest number, but their PVCs are KEPT (data is precious)
kubectl -n quest-sts scale statefulset/db --replicas=1 > /dev/null
kubectl -n quest-sts wait --for=delete pod/db-2 pod/db-1 --timeout=120s > /dev/null
echo "after scaling to 1: pods: $(kubectl -n quest-sts get pods --no-headers | wc -l | tr -d ' '), PVCs: $(kubectl -n quest-sts get pvc --no-headers | wc -l | tr -d ' ')"` }],
        explain: `- Pods are named \`db-0\`, \`db-1\`, \`db-2\` and created **in order**, each after the previous one is Ready.
- \`volumeClaimTemplates\` gives each pod its own PVC, named \`data-db-N\`. Each pod writes "who I was born as" on its disk the first time it starts.
- Delete \`db-1\` and the StatefulSet recreates a pod called \`db-1\` that mounts \`data-db-1\` again: the note it reads is the one it wrote before.
- The headless Service \`db\` gives every pod its own DNS name, \`db-N.db\`, pointing at that pod's IP. That's how replicas find "the primary, db-0".
- Scaling down to 1 removes db-2, then db-1, but **keeps their PVCs**: scale back up and the data is still there. Delete the PVCs yourself when you're sure.`,
        output: `created in order: db-0 db-1 db-2
PVC         STATUS
data-db-0   Bound
data-db-1   Bound
data-db-2   Bound
db-1 is back, and its disk says: db-1, born on first start
db-0.db -> the IP of pod db-0
db-1.db -> the IP of pod db-1
db-2.db -> the IP of pod db-2
after scaling to 1: pods: 1, PVCs: 3`,
      },
    ],
    interview: [
      {
        q: "Deployment vs StatefulSet: when do you use each?",
        a: "**Deployment** for stateless, interchangeable replicas: random pod names, parallel rollout, any pod can serve any request, and shared or no storage. **StatefulSet** when each replica needs an **identity**: stable names (`kafka-0`), stable per-pod DNS via a headless Service, a **dedicated PVC** that follows the pod across reschedules, and **ordered** startup, scale-down and rolling updates. Typical users: databases, Kafka, ZooKeeper/etcd, Elasticsearch, anything with leader election or sharding by member. Remember StatefulSets don't handle failover, backups or rebalancing; operators do.",
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
      {
        q: "A pod writes files to an emptyDir volume and is then deleted and recreated by its Deployment. The files are…",
        options: ["Still there", "Gone: emptyDir lives exactly as long as the pod", "Moved to a PVC", "Kept on the node for a day"],
        answer: 1,
        explain: "Use a PersistentVolumeClaim for anything that must outlive the pod.",
      },
    ],
  },
];
