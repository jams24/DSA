import type { Lesson } from "../types";

// Kubernetes, part 1: why it exists, how a cluster works, Pods, labels, and Deployments.

export const kubernetesPart1: Lesson[] = [
  // ------------------------------------------------------------------ WHY KUBERNETES
  {
    id: "k8s-why",
    part: "Part 1 · Kubernetes from zero",
    title: "Why Kubernetes exists",
    tagline: "From one container to thousands: what Kubernetes is, the promise of desired state, and why you talk to it through an API.",
    difficulty: "beginner",
    minutes: 18,
    visualizers: ["kube"],
    concept: `## Explain it like I'm 10 🧸
In Docker Dockyard you learned to pack an app in a **container** and run it on one computer. Now imagine your app gets famous. One computer isn't enough: you need fifty, in three buildings, and some of them break every week. Who decides which computer runs which container? Who notices when one crashes at 3 a.m. and starts a new one? Who swaps in the new version without anyone noticing?

Doing that by hand is like being the only teacher on a school trip with 500 kids. You'd never keep up. **Kubernetes** is the head teacher with a clipboard. You don't tell it *what to do* step by step. You write down *what you want*: "I want 3 copies of my web app running, always." Kubernetes keeps looking at the clipboard and at the real world, and whenever they don't match, it fixes the real world:
- a copy crashed? It starts a new one;
- a whole computer died? It moves its copies to the other computers;
- you changed the clipboard to "5 copies"? It starts 2 more.

That one idea, **you describe the result, Kubernetes keeps making it true**, is the whole secret. Everything else in this world is detail.

## The problem Kubernetes solves
Running one container is easy: \`docker run\`. Running a real product is not. You need to:
- place containers on machines with enough free CPU and memory (**scheduling**);
- restart them when they crash, and replace machines that die (**self-healing**);
- give each app a stable address while its containers come and go (**service discovery** and **load balancing**);
- ship new versions without downtime, and roll back bad ones (**rollouts**);
- add copies when traffic grows (**scaling**);
- hand out configuration, passwords and disks (**config, secrets, storage**).

A tool that does all this for a fleet of machines is a **container orchestrator**. Kubernetes (Greek for "helmsman", written **k8s**: k + 8 letters + s) is the one that won. Google built it from lessons learned running its internal system, Borg, and gave it to the Cloud Native Computing Foundation in 2015. Today every big cloud sells it as a service (EKS on AWS, GKE on Google Cloud, AKS on Azure), and it's the most asked-for skill in DevOps, SRE and platform engineering job ads.

## Desired state: the one big idea
With Docker you give **commands**: "run this container". If the machine reboots, the container is gone, and nobody remembers you wanted it.

With Kubernetes you **declare** what you want, in a file:

\`\`\`yaml
kind: Deployment
spec:
  replicas: 3          # "I want 3 copies"
\`\`\`

Kubernetes stores that wish and runs **control loops** that never stop: *look at what's real, compare with what's wanted, fix the difference, repeat*. A thermostat works the same way: you set 21 °C, and it keeps switching the heating on and off to get there. You never say "heat for 10 minutes".

| Imperative (commands) | Declarative (desired state) |
|---|---|
| "start 3 containers" | "there should be 3 containers" |
| if one dies, nothing happens | if one dies, a new one appears |
| you remember what you did | the cluster remembers what you want |
| scripts break when run twice | applying the same file twice is safe |

## Everything is an API
Kubernetes is, at its heart, a **database of wishes with an HTTP API in front of it**. Every Deployment, Pod and Service is a JSON object stored by the **API server**. \`kubectl\`, dashboards, CI pipelines and Kubernetes's own components all just read and write those objects over HTTPS. Each object has:
- a **spec**: what you asked for (written by you);
- a **status**: what is true right now (written by Kubernetes).

The first sample below shows the promise in action; the second shows that \`kubectl\` is just an HTTP client.

## What Kubernetes is not
- It doesn't build your images (Docker or a CI pipeline does).
- It isn't a platform-as-a-service with buttons for "deploy my Git repo"; many companies build that on top of it.
- It isn't always the right tool. One app on one server is simpler with Docker Compose. Kubernetes pays off when you have many services, many machines, or a team that needs self-service deployments.

## What this world covers
1. **Kubernetes from zero**: why, the architecture, Pods and labels, Deployments.
2. **Running apps**: Services and DNS, configuration and secrets, the pod lifecycle and probes, Jobs and DaemonSets.
3. **Resources and scheduling**: requests, limits and QoS, where pods land, autoscaling.
4. **Traffic and state**: Ingress and the Gateway API, NetworkPolicies, volumes and StatefulSets.
5. **Operating it**: Kustomize, Helm and GitOps, RBAC and pod security, controllers and CRDs, debugging.
6. **Projects and interviews**: deploy the shorty app from Docker Dockyard, write your own operator, and an interview drill.

Every sample is a real script, and its output came from running it on a real 3-node cluster (k3s). To follow along, install \`kubectl\` and create a local cluster with **kind**, **minikube**, **k3d** or Docker Desktop's built-in Kubernetes. The samples only use the \`node:20-slim\` and \`postgres:16-alpine\` images.`,
    keyPoints: [
      "Kubernetes is a container orchestrator: it schedules, heals, connects, scales and updates containers across many machines.",
      "You declare desired state (\"3 replicas\"); control loops keep comparing it with reality and fix the difference, forever.",
      "Every object has a spec (what you want) and a status (what is true); both live behind the API server.",
      "kubectl is just an HTTP client. Everything you can do with it, you can do with any HTTP request.",
      "It's powerful but complex: for one app on one server, Docker Compose is often enough.",
    ],
    code: [
      {
        title: "The promise: always 3 copies",
        note: "Delete a pod, change your mind about the count: the cluster keeps matching what you asked for.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-why > /dev/null

# Ask for 3 copies of a tiny web server. You say WHAT you want; Kubernetes works out HOW.
kubectl -n quest-why create deployment web --image=node:20-slim --replicas=3 -- \\
  node -e "require('http').createServer((q, s) => s.end('hi')).listen(8080); process.on('SIGTERM', () => process.exit(0))" > /dev/null
kubectl -n quest-why rollout status deployment/web --timeout=120s > /dev/null

pods() { kubectl -n quest-why get pods -o name | sort; }
count() { pods | wc -l | tr -d ' '; }
settle() {   # wait until exactly $1 pods exist and all are ready
  until [ "$(count)" = "$1" ]; do sleep 0.5; done
  kubectl -n quest-why wait --for=condition=Ready pods --all --timeout=120s > /dev/null
}
before=$(pods)
echo "running: $(count) pods"

# Delete one, like a crashed machine would. Kubernetes notices and replaces it.
kubectl -n quest-why delete $(echo "$before" | head -n 1) > /dev/null
settle 3
echo "after deleting one: $(count) pods, $(comm -13 <(echo "$before") <(pods) | wc -l | tr -d ' ') of them brand new"

# Change your mind: now you want 5. Then 2.
kubectl -n quest-why scale deployment/web --replicas=5 > /dev/null
settle 5
echo "after scaling to 5: $(count) pods"
kubectl -n quest-why scale deployment/web --replicas=2 > /dev/null
settle 2
echo "after scaling to 2: $(count) pods"` }],
        explain: `- \`kubectl create deployment web --replicas=3\` stores a wish: "3 copies of this container". It returns right away; the work happens in the background.
- \`rollout status\` waits until the wish is fulfilled.
- Deleting a pod is like a machine crashing. Kubernetes doesn't restart the old pod: it notices there are only 2 and creates a **brand new** one (a new name), because the Deployment still says 3.
- \`kubectl scale\` changes the wish. You never say "start 2 more" or "stop 3": you say the number you want, and Kubernetes works out the steps.
- In the real world you'd write this Deployment as a YAML file and \`kubectl apply\` it. That's coming in two lessons.`,
        output: `running: 3 pods
after deleting one: 3 pods, 1 of them brand new
after scaling to 5: 5 pods
after scaling to 2: 2 pods`,
      },
      {
        title: "kubectl is just an HTTP client",
        note: "-v=6 prints the requests kubectl makes. You can make the same calls yourself.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-api > /dev/null
kubectl -n quest-api create deployment web --image=node:20-slim --replicas=2 -- sleep 3600 > /dev/null
kubectl -n quest-api rollout status deployment/web --timeout=120s > /dev/null

# kubectl is just an HTTP client. -v=6 logs each request it sends to the API server:
kubectl -n quest-api get deployment web -v=6 2>&1 \\
  | sed -nE 's#.*verb="([A-Z]+)" url="https://[^/]+([^"]*)" status="([^"]*)".*#\\1 \\2  ->  \\3#p'
kubectl -n quest-api scale deployment web --replicas=3 -v=6 2>&1 \\
  | sed -nE 's#.*verb="([A-Z]+)" url="https://[^/]+([^"?]*)[^"]*" status="([^"]*)".*#\\1 \\2  ->  \\3#p'

# So you can make the same calls yourself:
kubectl get --raw /apis/apps/v1/namespaces/quest-api/deployments/web \\
  | python3 -c 'import json, sys; d = json.load(sys.stdin); print("kind:", d["kind"], "| spec.replicas:", d["spec"]["replicas"])'

# Every object has a spec (what you asked for) and a status (what is true right now)
kubectl -n quest-api rollout status deployment/web --timeout=120s > /dev/null
kubectl -n quest-api get deployment web -o jsonpath='spec.replicas:        {.spec.replicas}{"\\n"}status.readyReplicas: {.status.readyReplicas}{"\\n"}'` }],
        explain: `- \`-v=6\` makes kubectl log every HTTP request it sends. \`kubectl get deployment web\` is literally \`GET /apis/apps/v1/namespaces/quest-api/deployments/web\`.
- \`kubectl scale\` first reads the Deployment, then sends a **PATCH** to its \`/scale\` sub-resource. No magic: a REST API.
- \`kubectl get --raw\` sends any path you like and prints the JSON. Every dashboard, CI tool and operator talks to Kubernetes like this.
- **spec** vs **status**: \`spec.replicas\` is what you asked for (3); \`status.readyReplicas\` is what's true right now. Right after scaling, the status lags behind for a moment, until the controllers catch up.
- Namespaces (\`quest-api\` here) are folders for objects. Every sample in this world uses its own \`quest-*\` namespace so they can't collide.`,
        output: `GET /apis/apps/v1/namespaces/quest-api/deployments/web  ->  200 OK
GET /apis/apps/v1/namespaces/quest-api/deployments/web  ->  200 OK
PATCH /apis/apps/v1/namespaces/quest-api/deployments/web/scale  ->  200 OK
kind: Deployment | spec.replicas: 3
spec.replicas:        3
status.readyReplicas: 3`,
      },
    ],
    interview: [
      {
        q: "What problem does Kubernetes solve? When would you not use it?",
        a: "It orchestrates containers across a fleet of machines: **scheduling** them onto nodes with capacity, **self-healing** (restarting crashed containers, replacing pods from dead nodes), **service discovery and load balancing** (stable Service names in front of changing pods), **rolling updates and rollbacks**, **autoscaling**, and handing out **config, secrets and storage**, all driven by declarative desired state through one API. It also gives teams a common, self-service deployment interface. You might skip it for a single app or a small team: Docker Compose on one VM, or a managed platform (Cloud Run, ECS, App Service, Fly.io), is far less to operate. Kubernetes pays off with many services, many machines, multi-team platforms or portability needs.",
        freq: "very-common",
      },
      {
        q: "What does declarative mean in Kubernetes, and why does it matter?",
        a: "You describe the **end state** (\"3 replicas of image v2 with these limits\") instead of the steps to get there. Kubernetes stores it and **controllers** continuously reconcile actual state toward it. Benefits: **self-healing** (deviations are corrected automatically), **idempotency** (applying the same manifest twice is safe), **reviewable config in Git** (the manifest *is* the documentation, which enables GitOps), and **robustness to failures** (a controller that crashes picks up where reality is, not where a script stopped).",
        freq: "common",
      },
      {
        q: "What's the difference between a container, a pod and a node?",
        a: "A **container** is one isolated process with its own filesystem, from an image. A **pod** is Kubernetes's smallest deployable unit: one or more containers that are scheduled together on the same machine and share a network namespace (one IP, they talk over localhost) and volumes. A **node** is a machine (VM or physical) running the kubelet and a container runtime; it hosts many pods. Kubernetes schedules **pods** onto **nodes**, never single containers.",
        freq: "very-common",
      },
    ],
    quiz: [
      {
        q: "You delete one pod of a Deployment that wants 3 replicas. What happens?",
        options: ["Nothing until you run kubectl apply again", "The same pod is restarted with the same name", "A new pod with a new name is created to get back to 3", "The Deployment is deleted too"],
        answer: 2,
        explain: "The ReplicaSet's control loop sees 2 of 3 and creates a brand new pod. Pods are cattle, not pets.",
      },
      {
        q: "In a Kubernetes object, which part do you write and which part does Kubernetes write?",
        options: ["You write status, Kubernetes writes spec", "You write spec, Kubernetes writes status", "Both write spec", "Only kubectl can write either"],
        answer: 1,
        explain: "spec = desired state (yours); status = observed state (reported by controllers and the kubelet).",
      },
      {
        q: "kubectl talks to the cluster by…",
        options: ["SSH into every node", "HTTPS requests to the API server", "Writing directly to etcd", "The Docker socket"],
        answer: 1,
        explain: "It's a REST client of the kube-apiserver. Try kubectl -v=6 to see the requests.",
      },
      {
        q: "A thermostat set to 21 °C is a good analogy for…",
        options: ["A Kubernetes namespace", "A reconciliation (control) loop", "A container image", "A Service IP"],
        answer: 1,
        explain: "It keeps measuring reality and acting to reach the desired value, forever. That's exactly what controllers do.",
      },
    ],
  },

  // ------------------------------------------------------------------ ARCHITECTURE
  {
    id: "k8s-architecture",
    title: "How a cluster works",
    tagline: "The control plane, the nodes, and what really happens after kubectl apply: API server, etcd, scheduler, controllers and the kubelet.",
    difficulty: "beginner",
    minutes: 20,
    diagram: {
      title: "Inside a Kubernetes cluster",
      nodes: [
        { id: "kubectl", label: "kubectl / CI", sub: "apply manifests", kind: "client", x: 90, y: 280 },
        { id: "api", label: "kube-apiserver", sub: "authn · authz · admission", kind: "control", x: 330, y: 280 },
        { id: "etcd", label: "etcd", sub: "Raft key-value store", kind: "db", x: 330, y: 480 },
        { id: "ctrl", label: "controller-manager", sub: "Deployment, ReplicaSet, Node…", kind: "control", x: 600, y: 90 },
        { id: "sched", label: "kube-scheduler", sub: "filter → score → bind", kind: "control", x: 600, y: 280 },
        { id: "kubelet", label: "kubelet", sub: "agent on every node", kind: "node", x: 600, y: 470 },
        { id: "runtime", label: "containerd + runc", sub: "via CRI, CNI for networking", kind: "service", x: 870, y: 470 },
        { id: "registry", label: "Image registry", sub: "layers by digest", kind: "registry", x: 870, y: 260 },
      ],
      edges: [
        { from: "kubectl", to: "api", label: "HTTPS" },
        { from: "api", to: "etcd" },
        { from: "api", to: "ctrl", label: "watch" },
        { from: "api", to: "sched", label: "watch" },
        { from: "api", to: "kubelet", label: "watch" },
        { from: "kubelet", to: "runtime" },
        { from: "runtime", to: "registry", label: "pull" },
      ],
      flows: [
        {
          name: "kubectl apply a Deployment",
          path: ["kubectl", "api", "etcd", "api", "ctrl", "api", "sched", "api", "kubelet", "runtime", "registry", "runtime", "kubelet", "api"],
          steps: [
            "kubectl sends the Deployment manifest. The API server authenticates the caller, authorizes with RBAC, runs admission controllers (defaults, policies) and validates the schema.",
            "The object is persisted in etcd (replicated with Raft). This is the desired state. Nothing is running yet.",
            "Write committed: kubectl prints 'deployment.apps/web created'. Everything from here on is asynchronous.",
            "The Deployment controller is watching Deployments. It sees the new one and creates a ReplicaSet.",
            "The ReplicaSet controller sees 0 of 3 pods and creates 3 Pod objects with no node assigned (Pending).",
            "The scheduler is watching for pods with an empty nodeName.",
            "It filters nodes (resources, taints, affinity), scores the survivors, and writes a Binding: web-x7k2p → node-2.",
            "node-2's kubelet watches pods bound to its node and picks up the new one.",
            "Through the CRI, the kubelet asks containerd to create the pod sandbox (the CNI plugin wires up its network namespace and IP) and the containers.",
            "Image layers not already on the node are pulled by digest.",
            "Layers are unpacked. runc starts the process in its namespaces and cgroups.",
            "The container is running. The kubelet starts the startup and readiness probes.",
            "The kubelet reports Running and Ready. The EndpointSlice controller adds the pod IP to the Service, and traffic flows.",
          ],
        },
        {
          name: "A node dies",
          path: ["kubelet", "api", "ctrl", "api", "sched", "api", "kubelet"],
          steps: [
            "node-3's kubelet stops renewing its Lease (heartbeat). After the grace period (~40–50 s) the node controller marks it NotReady and taints it unreachable.",
            "Its pods are marked not Ready and pulled from Service endpoints. After their toleration expires (default 300 s), they are evicted.",
            "The ReplicaSet controller now counts 2 live pods for 3 desired and creates a replacement.",
            "The new pod is Pending, and the scheduler picks it up.",
            "It's bound to a healthy node with enough free capacity.",
            "That node's kubelet starts it. Self-healing without a human, because the desired state never changed.",
          ],
        },
      ],
    },
    concept: `## Explain it like I'm 10 🧸
Think of a cluster as a **restaurant**.
- The **API server** is the front counter. Every order goes through it, and it's the only one allowed to write in the order book.
- **etcd** is the order book: the single source of truth about what everyone wants and what's happening.
- The **scheduler** is the head waiter who decides which table (which **node**) each new guest (each **pod**) sits at, based on free space.
- The **controllers** are managers who keep reading the order book and fixing things: "table 4 ordered 3 pizzas but only 2 arrived, make another one".
- On every table there's a **kubelet**, a waiter who reads the order book for *their* table and makes sure exactly those dishes are served, using the kitchen (the **container runtime**) to cook them.

Nobody shouts orders at each other. Everyone just **watches the order book** and does their own small job. That's why the restaurant keeps working when one waiter gets sick: someone else reads the same book.

## Two halves
A cluster has a **control plane** (the brain: it stores state and makes decisions) and **worker nodes** (the muscles: they run your pods). Small clusters often run both on one machine; managed services (EKS, GKE, AKS) run the control plane for you, and you only see the nodes.

## Follow one kubectl command
The diagram above has the full story; the short version:
1. \`kubectl apply\` sends your Deployment to the **API server**, which checks who you are, whether you're allowed, and whether the object is valid, then saves it in **etcd**. kubectl returns. **Nothing is running yet.**
2. The **Deployment controller** notices and creates a **ReplicaSet**. The **ReplicaSet controller** notices *that* and creates **Pod** objects with no node.
3. The **scheduler** notices pods without a node and assigns each one.
4. The **kubelet** on that node notices a pod assigned to it and asks containerd to start the containers.
5. The kubelet reports back: Running, Ready.

Every arrow is "someone noticed a change in the API server". Components never call each other directly. The first sample shows this chain as **events**, the cluster's own log.

## The core idea: declarative desired state + control loops
You don't tell Kubernetes *what to do*; you tell it *what you want* ("3 replicas of web:v2, each with 500m CPU"). The spec is stored in etcd, and dozens of **controllers** run **reconciliation loops**: observe actual state → compare with desired → act to close the gap → repeat. This is why it self-heals, why it's eventually consistent, and why everything is asynchronous. \`kubectl apply\` returns long before your pods run.

## The control plane
- **kube-apiserver**: the front door and the **only** component that talks to etcd. Every request goes through authentication → authorization (**RBAC**) → **admission** (mutating webhooks set defaults or inject sidecars, validating webhooks enforce policy) → schema validation → persistence. Clients **watch** resources for changes instead of polling.
- **etcd**: a strongly consistent key-value store replicated with **Raft** (run 3 or 5 members: a majority must be alive). Back it up, because it *is* the cluster.
- **kube-scheduler**: assigns Pending pods to nodes. **Filter** (enough requested CPU/memory? taints tolerated? affinity rules? volume zone?) then **score** (spread, least allocated, image locality) then **bind**.
- **kube-controller-manager**: Deployment, ReplicaSet, Node (heartbeats, eviction), Job, EndpointSlice, ServiceAccount controllers and more, each a loop.
- **cloud-controller-manager**: talks to the cloud API to create load balancers, routes and volumes.

## The nodes
- **kubelet**: the node agent. It watches pods bound to its node, starts them through the container runtime (**CRI** → containerd), runs probes, reports status and enforces resource limits. It heartbeats via a Lease object.
- **kube-proxy**: programs iptables/IPVS rules so Service virtual IPs load-balance to pod IPs (or an eBPF dataplane like Cilium replaces it).
- **CNI plugin**: gives every pod an IP on a flat network where any pod can reach any other pod without NAT.

## Objects you must know
| Object | Purpose |
|---|---|
| **Pod** | Smallest unit: one or more containers sharing network and volumes, scheduled together |
| **ReplicaSet** | Keeps N identical pods running |
| **Deployment** | Manages ReplicaSets for rolling updates and rollbacks |
| **Service** | Stable virtual IP + DNS name in front of a changing set of pods (selected by **labels**) |
| **ConfigMap / Secret** | Configuration and credentials, mounted as files or env vars |
| **Namespace** | A scope for names, RBAC and quotas |

Labels and selectors glue everything together: a Service doesn't know about Deployments, it selects pods with \`app=web\`.

## Scheduling controls
- **requests** decide placement (the scheduler sums requests, not actual usage). **limits** are enforced at runtime.
- **Taints and tolerations** keep pods off nodes (GPU nodes, dedicated pools) unless they tolerate the taint.
- **Node affinity** pulls pods toward nodes. **Pod anti-affinity** and **topology spread constraints** spread replicas across nodes and zones so one failure can't take them all.
- **PriorityClasses** let important pods preempt less important ones when the cluster is full.

## Failure handling (try it in the simulator)
Pod crashes → the kubelet restarts it with exponential backoff (**CrashLoopBackOff** when it keeps failing). Pod deleted → the ReplicaSet creates a new one. Node dies → after the node-monitor grace period it's marked NotReady and tainted; pods are evicted after their toleration (300 s by default), then rescheduled elsewhere if capacity exists. If not, they stay **Pending** with an event like \`0/3 nodes are available: 3 Insufficient cpu\`, which is where a cluster autoscaler adds nodes.`,
    keyPoints: [
      "Control plane = API server + etcd + scheduler + controller manager. Nodes = kubelet + container runtime + kube-proxy/CNI.",
      "Only the API server talks to etcd; every other component watches the API server and acts on changes.",
      "kubectl apply only stores desired state. Controllers, the scheduler and the kubelet do the rest asynchronously.",
      "Each step leaves an event (kubectl get events): the best place to start when something doesn't happen.",
      "Nodes prove they're alive by renewing a Lease; a node that stops is marked NotReady and its pods are replaced elsewhere.",
    ],
    code: [
      {
        title: "Watch the chain reaction",
        note: "One command, six components. Events show who did what.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-arch > /dev/null

# One command sets off a chain reaction between the control plane and a node
kubectl -n quest-arch create deployment hello --image=node:20-slim -- sleep 3600 > /dev/null
kubectl -n quest-arch rollout status deployment/hello --timeout=120s > /dev/null

# Each step leaves an event: who did what, to which object?
# (events only have 1-second timestamps, so we put them in the order they must have happened)
kubectl -n quest-arch get events -o custom-columns='WHO:.reportingComponent,ACTED-ON:.involvedObject.kind,WHAT:.reason' --no-headers \\
  | awk 'BEGIN { split("ScalingReplicaSet SuccessfulCreate Scheduled Pulled Created Started", o); for (i in o) step[o[i]] = i }
         { printf "%d. %-22s %-11s %s\\n", step[$3], $1, $2, $3 }' | sort -u` }],
        explain: `- Every component records what it did as an **Event** object. \`kubectl get events\` (or the Events section at the bottom of \`kubectl describe\`) is the cluster's diary.
- The **deployment-controller** scaled up a new ReplicaSet; the **replicaset-controller** created a pod; the **default-scheduler** assigned it to a node; the **kubelet** on that node pulled the image (already there, so it's instant), created and started the container.
- Notice that kubectl isn't in the list. It only wrote one object; everything else was the control loops reacting to each other's changes.
- Events expire after an hour by default, so look at them soon after a problem.`,
        output: `1. deployment-controller  Deployment  ScalingReplicaSet
2. replicaset-controller  ReplicaSet  SuccessfulCreate
3. default-scheduler      Pod         Scheduled
4. kubelet                Pod         Pulled
5. kubelet                Pod         Created
6. kubelet                Pod         Started`,
      },
      {
        title: "Ask the API server about itself",
        k8s: true,
        images: ["node:20-slim"],
        vary: ["(?<=understands: )\\d+"],
        variants: [{ lang: "bash", code: `# The API server knows about many kinds of objects ("resources"), grouped into API groups
echo "kinds of objects this cluster understands: $(kubectl api-resources --no-headers | wc -l | tr -d ' ')"

# The "apps" group: the workload controllers you'll use most
kubectl api-resources --api-group=apps -o wide --no-headers | awk '{printf "%-22s %-10s %s\\n", $1, $2, $NF}'

# Health checks of the API server itself (and of its datastore, etcd)
kubectl get --raw='/readyz?verbose' | grep -E 'etcd|informer-sync|readyz check'` }],
        explain: `- \`kubectl api-resources\` lists every kind of object the API server knows. Around 60 are built in; add-ons and CRDs (lesson 17) add more, which is why the count depends on the cluster.
- Kinds are grouped into **API groups** with versions: Deployments live in \`apps/v1\`, Pods in the core group \`v1\`, Ingresses in \`networking.k8s.io/v1\`. That's the \`apiVersion:\` line at the top of every manifest.
- The last column shows the **verbs** you can use: \`get, list, watch, create, update, patch, delete\`. RBAC permissions (lesson 16) are written in exactly these words.
- \`/readyz\` is the API server's own health check, including its connection to **etcd**.`,
        output: `kinds of objects this cluster understands: 97
controllerrevisions    apps/v1    create,delete,deletecollection,get,list,patch,update,watch
daemonsets             ds         all
deployments            deploy     all
replicasets            rs         all
statefulsets           sts        all
[+]etcd ok
[+]etcd-readiness ok
[+]informer-sync ok
[+]poststarthook/crd-informer-synced ok
readyz check passed`,
      },
      {
        title: "Nodes and their heartbeats",
        k8s: true,
        images: ["node:20-slim"],
        vary: ["v\\d+\\.\\d+\\.\\d+\\+k3s\\d+", "containerd://[\\w.-]+"],
        variants: [{ lang: "bash", code: `# What each node reports about itself: the kubelet's version, the container runtime, its capacity
kubectl get nodes -o custom-columns='NODE:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion,RUNTIME:.status.nodeInfo.containerRuntimeVersion,MAX-PODS:.status.capacity.pods'

# Every node runs a kubelet, which keeps renewing a "lease" to say "I'm alive"
kubectl -n kube-node-lease get leases -o custom-columns='LEASE:.metadata.name,RENEWED-EVERY:.spec.leaseDurationSeconds' --no-headers \\
  | awk '{print $1 " lease, expires after " $2 " s without a renewal"}'` }],
        explain: `- Each node reports what it runs: the **kubelet** version, the **container runtime** (containerd here, as on almost every cluster today) and how many pods it accepts (110 by default).
- Every kubelet renews a **Lease** object every few seconds. If a node stops renewing for 40 s, the node controller marks it **NotReady**, takes its pods out of Services, and later replaces them on healthy nodes.
- This test cluster has 3 nodes: \`quest-server\` runs the control plane (and pods too, as small clusters often do) and two workers.`,
        output: `NODE             KUBELET        RUNTIME                   MAX-PODS
quest-server     v1.34.1+k3s1   containerd://2.1.4-k3s2   110
quest-worker-1   v1.34.1+k3s1   containerd://2.1.4-k3s2   110
quest-worker-2   v1.34.1+k3s1   containerd://2.1.4-k3s2   110
quest-server lease, expires after 40 s without a renewal
quest-worker-1 lease, expires after 40 s without a renewal
quest-worker-2 lease, expires after 40 s without a renewal`,
      },
    ],
    interview: [
      {
        q: "What happens when you run kubectl apply -f deployment.yaml?",
        a: "kubectl sends the manifest to the **API server**, which authenticates, authorizes (RBAC), runs mutating and validating **admission** webhooks, validates the schema and stores the object in **etcd**, then returns. Asynchronously: the **Deployment controller** (watching Deployments) creates or updates a **ReplicaSet**; the **ReplicaSet controller** creates Pod objects; the **scheduler** sees pods without a node, filters and scores nodes, and binds each pod; the **kubelet** on that node sees the binding, asks the runtime via CRI to create the sandbox (the CNI assigns the pod IP) and pull images, starts the containers and runs probes; when readiness passes, the **EndpointSlice controller** adds the pod to its Service, and kube-proxy or the dataplane routes traffic to it.",
        freq: "very-common",
      },
      {
        q: "Why is Kubernetes built around reconciliation loops instead of commands?",
        a: "Because distributed systems lose messages, crash and restart. A command (\"start pod X\") can fail halfway with no one to retry it. A **level-triggered** controller repeatedly compares the *whole* desired state with the *whole* actual state and acts on the difference, so a missed event, a crashed controller or a manual change is corrected on the next pass. It also makes everything composable: each controller owns one concern (ReplicaSet, Endpoint, Node, HPA) and they cooperate through shared state in the API server rather than by calling each other.",
        freq: "common",
      },
      {
        q: "A pod is stuck in Pending. How do you debug it?",
        a: "`kubectl describe pod` and read the Events. Typical causes: **Insufficient cpu/memory**: requests don't fit on any node (lower the requests, add nodes, check the cluster autoscaler); **untolerated taints** (the pod needs a toleration, or the only nodes with room are dedicated); **affinity / topology spread** rules that can't be satisfied; **PVC not bound** or a volume in a different zone from available nodes; **ResourceQuota** exceeded in the namespace; image pull problems show up later as ErrImagePull, not Pending. If there are no events at all, check whether the scheduler is healthy, or whether a custom `schedulerName` is set.",
        freq: "very-common",
      },
      {
        q: "What happens to pods when a node fails?",
        a: "The kubelet stops renewing its node Lease. After the node-monitor grace period (~40–50 s) the node controller sets the node **NotReady/Unknown** and adds the `unreachable` taint; its pods are marked not Ready and **removed from Service endpoints**, so traffic stops. Pods tolerate that taint for 300 s by default; then they're evicted, and their controllers (ReplicaSet, StatefulSet) create replacements, which the scheduler places on healthy nodes. StatefulSet pods are more cautious: a replacement with the same identity isn't started until the old one is confirmed gone, to avoid two writers. Shorten tolerations for faster failover if your app is stateless.",
        freq: "common",
      },
      {
        q: "What's the role of etcd, and what happens if it loses quorum?",
        a: "etcd stores every Kubernetes object: the cluster's entire desired and observed state. It uses Raft, so with 3 members it tolerates 1 failure and with 5 it tolerates 2. If quorum is lost, the API server can't write (or serve linearizable reads): no new deployments, no scheduling, no scaling, and controllers stall. **Already-running pods keep running**, because kubelets and the dataplane don't need the control plane to serve traffic (static stability). Recovery: restore quorum, or restore from an etcd snapshot, which is why regular snapshots and tested restores matter.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which component is the only one that reads and writes etcd directly?",
        options: ["kube-scheduler", "kubelet", "kube-apiserver", "kube-proxy"],
        answer: 2,
        explain: "Everything else goes through the API server and watches it.",
      },
      {
        q: "The scheduler decides whether a pod fits on a node based on…",
        options: ["Current CPU usage", "Resource requests", "Resource limits", "Pod priority only"],
        answer: 1,
        explain: "It sums requests against allocatable capacity, so actual usage doesn't matter for placement.",
      },
      {
        q: "kubectl apply returns successfully. Your pods are…",
        options: ["Running", "Not necessarily created yet: controllers act asynchronously", "Ready", "Scheduled"],
        answer: 1,
        explain: "apply only persists desired state. Reconciliation happens afterwards.",
      },
      {
        q: "How does a Service know which pods to send traffic to?",
        options: ["It's linked to a Deployment", "Label selectors", "Pod names", "Node IPs"],
        answer: 1,
        explain: "Any ready pod whose labels match the selector becomes an endpoint.",
      },
      {
        q: "A 3-member etcd cluster loses 2 members. Running pods…",
        options: ["Are all killed", "Keep running, but the cluster can't change state", "Move to other nodes", "Restart in a loop"],
        answer: 1,
        explain: "The data plane is statically stable, but nothing new can be scheduled or updated.",
      },
      {
        q: "Taints and tolerations are used to…",
        options: ["Attract pods to nodes", "Repel pods from nodes unless they tolerate the taint", "Limit CPU", "Encrypt traffic"],
        answer: 1,
        explain: "e.g. keep ordinary workloads off GPU nodes. Use node affinity to attract.",
      },
    ],
  },

  // ------------------------------------------------------------------ FIRST POD
  {
    id: "k8s-first-pod",
    title: "Your first Pod, YAML and labels",
    tagline: "Write a manifest, apply it, look inside with get, describe, logs and exec, and learn the sticky notes that glue Kubernetes together: labels and selectors.",
    difficulty: "beginner",
    minutes: 20,
    visualizers: ["labels"],
    concept: `## Explain it like I'm 10 🧸
A **pod** is a little capsule that holds one container (sometimes a few that must stay together, like a lunchbox with a sandwich *and* a juice box). Kubernetes never runs a container on its own: it always runs a pod, and the pod holds the container.

To ask for a pod you fill in a **form**, written in a format called **YAML**. The form says: what kind of thing you want (a Pod), its name, and what goes inside (which image, which command, which port). You hand the form in with \`kubectl apply\`.

Then there are **labels**: little sticky notes you put on things, like \`app=shop\` or \`env=prod\`. On their own they do nothing. But other things in Kubernetes **find** pods by their sticky notes. "Send website visitors to every pod with the note \`app=shop\`." It's like a teacher saying "everyone wearing a red hat, come here!": it doesn't matter what your name is, only what you're wearing.

## Anatomy of a manifest
Every Kubernetes object, of every kind, has the same four parts:

| Field | Means | Example |
|---|---|---|
| \`apiVersion\` | which API group and version defines this kind | \`v1\`, \`apps/v1\` |
| \`kind\` | the type of object | \`Pod\`, \`Deployment\`, \`Service\` |
| \`metadata\` | name, namespace, labels, annotations | \`name: hello\` |
| \`spec\` | what you want; different for every kind | containers, replicas, ports |

YAML rules that trip everyone up: **indentation is meaning** (always spaces, never tabs), \`- \` starts a list item, and \`key: value\` pairs nest under their parent by indentation. \`{ a: 1 }\` and \`[x, y]\` are a compact way to write the same thing on one line.

## The commands you'll use every day
| Command | What it does |
|---|---|
| \`kubectl apply -f file.yaml\` | create or update to match the file (safe to repeat) |
| \`kubectl get pods\` | a list with status; add \`-o wide\` for node and IP, \`-o yaml\` for everything |
| \`kubectl describe pod NAME\` | details plus **Events**: the first place to look when something's wrong |
| \`kubectl logs NAME\` | what the container printed (\`-f\` to follow, \`--previous\` for the last crash) |
| \`kubectl exec NAME -- CMD\` | run a command inside (\`-it ... -- sh\` for a shell) |
| \`kubectl port-forward pod/NAME 8080:80\` | a tunnel from your laptop to the pod |
| \`kubectl delete -f file.yaml\` | remove what the file describes |
| \`kubectl explain pod.spec\` | built-in documentation for every field |

## Pods are mortal
A pod gets an IP address and a name, runs, and one day dies: its node crashes, it's replaced in a rollout, it's evicted. **A pod is never resurrected.** A *new* pod with a new name and a new IP replaces it. That's why you almost never create bare pods like in the first sample: you create a **Deployment** (next lesson) that creates pods for you and replaces them when they die, and a **Service** that gives them a stable address.

Inside one pod, all containers share the **network** (same IP; they talk over \`localhost\`) and can share **volumes**. That's for tightly coupled helpers: a log shipper, a proxy. Two separate apps go in two separate pods.

## Labels and selectors
**Labels** are key/value pairs in \`metadata.labels\`. **Selectors** are queries over them:
- equality: \`app=shop\`, \`env!=prod\`;
- sets: \`tier in (web,api)\`, \`env notin (test)\`, \`!canary\` (doesn't have the label);
- several conditions with commas mean AND.

Selectors are how Kubernetes objects find each other. A **Service** sends traffic to pods matching its selector. A **Deployment** owns the pods matching its selector. A **NetworkPolicy** applies to pods matching its selector. Nothing is linked by name. That loose coupling is powerful (relabel a pod and it leaves the Service) and dangerous (a typo in a label and the Service has no pods). Try it in the visualizer.

Recommended labels: \`app.kubernetes.io/name\`, \`app.kubernetes.io/version\`, \`app.kubernetes.io/component\`, \`app.kubernetes.io/part-of\`. **Annotations** look like labels but can't be selected on: they're for notes and tool settings (build IDs, checksums, ingress options).

## Namespaces
A **namespace** is a folder for objects: names must be unique inside one, RBAC and quotas apply per namespace, and \`kubectl delete namespace\` removes everything inside. Most commands take \`-n NAMESPACE\`; without it you get \`default\`. Clusters start with \`default\`, \`kube-system\` (the cluster's own components), \`kube-public\` and \`kube-node-lease\`.`,
    keyPoints: [
      "Every object has apiVersion, kind, metadata and spec. YAML indentation is meaning: spaces only.",
      "kubectl apply makes the cluster match the file; get, describe (Events!), logs and exec are the everyday debugging tools.",
      "Pods are mortal: a dead pod is replaced by a new one with a new name and IP, never revived. Use Deployments, not bare pods.",
      "Containers in one pod share the network (localhost) and volumes; separate apps belong in separate pods.",
      "Labels are sticky notes; selectors query them. Services, Deployments and NetworkPolicies find pods by label, never by name.",
    ],
    code: [
      {
        title: "A Pod from a YAML file",
        note: "Apply it, reach it through a tunnel, read its logs, run a command in it, delete it.",
        k8s: true,
        images: ["node:20-slim"],
        vary: ["\\d+s$"],
        files: [{ path: "pod.yaml", lang: "yaml", code: `apiVersion: v1          # which version of the API this object uses
kind: Pod               # what kind of object
metadata:
  name: hello           # its name, unique in the namespace
  namespace: quest-pod
  labels:
    app: hello          # sticky notes other objects use to find it
spec:
  containers:
    - name: web
      image: node:20-slim
      command: ["node", "-e"]
      args:
        - |
          const http = require("http");
          http.createServer((req, res) => {
            console.log(req.method, req.url);
            res.end("Hello from " + require("os").hostname() + "!\\n");
          }).listen(8080);
          process.on("SIGTERM", () => process.exit(0));
      ports:
        - containerPort: 8080` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-pod > /dev/null
kubectl apply -f pod.yaml
kubectl -n quest-pod wait --for=condition=Ready pod/hello --timeout=120s > /dev/null
kubectl -n quest-pod get pod hello

# Reach it from your laptop through a tunnel: localhost:18080 -> the pod's port 8080
kubectl -n quest-pod port-forward pod/hello 18080:8080 > /dev/null &
tunnel=$!
for _ in $(seq 1 50); do curl -s localhost:18080 > /dev/null && break; sleep 0.1; done
curl -s localhost:18080/hi
kill $tunnel; wait $tunnel 2> /dev/null

kubectl -n quest-pod logs hello                      # what the app printed
kubectl -n quest-pod exec hello -- cat /etc/hostname # run a command inside it
kubectl -n quest-pod delete pod hello` }],
        explain: `- \`kubectl apply -f pod.yaml\` sends the form. \`kubectl wait --for=condition=Ready\` blocks until the container is running and ready.
- \`port-forward\` opens a tunnel from your laptop's port 18080 to the pod's port 8080, so \`curl\` on your machine reaches the app. It's a debugging tool; real traffic goes through Services and Ingress.
- The app's hostname is the **pod's name**, \`hello\`.
- \`kubectl logs\` shows what the app printed: the two requests it received. Containers should log to stdout, and Kubernetes collects it.
- \`kubectl exec\` runs a command in the running container: here, \`cat /etc/hostname\`. Use \`kubectl exec -it hello -- sh\` for an interactive shell.
- The \`args: |\` block is YAML's way of writing several lines of text: everything indented under it is one string.`,
        output: `pod/hello created
NAME    READY   STATUS    RESTARTS   AGE
hello   1/1     Running   0          1s
Hello from hello!
GET /
GET /hi
hello
pod "hello" deleted from quest-pod namespace`,
      },
      {
        title: "Labels and selectors",
        note: "Four pods, a few sticky notes, and queries that pick them out.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-labels > /dev/null

# Four pods with different labels (key=value sticky notes)
run() { kubectl -n quest-labels run "$1" --image=node:20-slim --labels="$2" -- sleep 3600 > /dev/null; }
run shop-web  app=shop,tier=web,env=prod
run shop-api  app=shop,tier=api,env=prod
run blog-web  app=blog,tier=web,env=prod
run shop-test app=shop,tier=web,env=test

names() { kubectl -n quest-labels get pods -l "$1" -o name | sed 's#pod/##' | sort | tr '\\n' ' '; echo; }
echo "app=shop:                   $(names app=shop)"
echo "app=shop,tier=web:          $(names app=shop,tier=web)"
echo "env!=prod:                  $(names 'env!=prod')"
echo "tier in (web,api),app=blog: $(names 'tier in (web,api),app=blog')"

# Labels can change at any time
kubectl -n quest-labels label pod blog-web env=test --overwrite > /dev/null
echo "env=test after relabelling: $(names env=test)"` }],
        explain: `- \`kubectl run NAME --labels=...\` creates a single pod with those labels: handy for experiments.
- \`-l\` (\`--selector\`) filters by label. Commas mean AND: \`app=shop,tier=web\` matches only pods that have **both**.
- \`env!=prod\` matches pods whose \`env\` isn't \`prod\`. \`tier in (web,api)\` is a set match.
- \`kubectl label --overwrite\` changes a label on a live pod. If a Service selected \`env=prod\`, \`blog-web\` would have just left it, instantly. That's how you pull a misbehaving pod out of traffic for debugging without killing it.`,
        output: `app=shop:                   shop-api shop-test shop-web 
app=shop,tier=web:          shop-test shop-web 
env!=prod:                  shop-test 
tier in (web,api),app=blog: blog-web 
env=test after relabelling: blog-web shop-test `,
      },
      {
        title: "The documentation is in the cluster",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `# Every field of every object is documented inside the cluster
kubectl explain pod.spec.restartPolicy` }],
        explain: `- \`kubectl explain\` describes any field of any kind, for **your** cluster's exact version, including CRDs.
- Walk the tree with dots: \`kubectl explain pod.spec.containers.livenessProbe\`. Add \`--recursive\` to see every field at once.
- In interviews and exams (CKA, CKAD) this beats searching the web.`,
        output: `KIND:       Pod
VERSION:    v1

FIELD: restartPolicy <string>
ENUM:
    Always
    Never
    OnFailure

DESCRIPTION:
    Restart policy for all containers within the pod. One of Always, OnFailure,
    Never. In some contexts, only a subset of those values may be permitted.
    Default to Always. More info:
    https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy
    
    Possible enum values:
     - \`"Always"\`
     - \`"Never"\`
     - \`"OnFailure"\`
    `,
      },
    ],
    interview: [
      {
        q: "What is a Pod, and why does Kubernetes schedule pods rather than containers?",
        a: "A Pod is a group of one or more containers that are always scheduled together on one node and share a **network namespace** (one IP, communicate via localhost, share the port space) and optionally **volumes**. It's the unit of scheduling, scaling and replacement. The grouping exists for tightly coupled helpers that must live next to the main container: init containers that prepare files, sidecars like service-mesh proxies or log shippers, adapters. Most pods have one app container. Separate services go in separate pods so they can scale and fail independently.",
        freq: "very-common",
      },
      {
        q: "How do labels, selectors and annotations differ?",
        a: "**Labels** are identifying key/value pairs used for **selection**: Services, Deployments, ReplicaSets, NetworkPolicies, PodDisruptionBudgets and `kubectl -l` all match pods by label selectors (equality like `app=web` or set-based like `tier in (web,api)`). **Annotations** are non-identifying metadata that can't be selected on: longer values for tools and humans (build info, checksums, ingress-controller options, `kubectl.kubernetes.io/last-applied-configuration`). Pitfall: a Deployment's `spec.selector` is immutable and must match its template labels; a Service's selector typo leaves it with zero endpoints.",
        freq: "common",
      },
      {
        q: "kubectl create vs kubectl apply?",
        a: "`create` is **imperative**: it creates the object and fails if it already exists. `apply` is **declarative**: it creates or updates the object to match the file, and is idempotent, so it's what you use in Git-based workflows. Modern `apply` can run **server-side** (`--server-side`): the API server tracks which **field manager** owns each field, merges changes from different tools and reports conflicts. Imperative commands (`create`, `run`, `scale`, `set image`) are great for experiments and exams, but they drift from what's in Git.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which four top-level fields does every Kubernetes object have?",
        options: ["name, image, ports, replicas", "apiVersion, kind, metadata, spec", "type, id, labels, data", "pod, node, service, volume"],
        answer: 1,
        explain: "Plus status, which Kubernetes fills in. spec's contents depend on the kind.",
      },
      {
        q: "Two containers in the same pod can talk to each other over…",
        options: ["localhost", "The node's public IP only", "A Service, which is required", "They can't communicate"],
        answer: 0,
        explain: "They share the pod's network namespace: same IP, same localhost.",
      },
      {
        q: "A Service selects app=shop. You run kubectl label pod shop-1 app=debug --overwrite. What happens?",
        options: ["Nothing until the Service is recreated", "shop-1 stops receiving the Service's traffic", "shop-1 is deleted", "The Service is renamed"],
        answer: 1,
        explain: "Selection is live: shop-1 no longer matches, so it's removed from the endpoints. (A Deployment selecting app=shop would also create a replacement.)",
      },
      {
        q: "Where do you look first when a pod isn't starting?",
        options: ["kubectl describe pod (the Events section)", "The node's /etc/hosts", "kubectl api-resources", "kubectl explain pod"],
        answer: 0,
        explain: "Events tell you whether it's stuck scheduling, pulling the image, mounting a volume or crashing.",
      },
    ],
  },

  // ------------------------------------------------------------------ DEPLOYMENTS
  {
    id: "k8s-workloads",
    title: "Deployments, ReplicaSets and rollouts",
    tagline: "Keep N copies running, update them with zero downtime, watch a bad release stall instead of breaking everything, and roll back in one command.",
    difficulty: "beginner",
    minutes: 20,
    visualizers: ["rollout", "kube"],
    concept: `## Explain it like I'm 10 🧸
You run a lemonade stand with 4 helpers. You want to switch to a new recipe, but you can't close the stand. So you swap the helpers **one at a time**: a new helper who knows the new recipe arrives, starts serving, and *then* one old helper goes home. Repeat until everyone uses the new recipe. Customers never see a closed stand.

And if the first new helper's lemonade is terrible? You stop swapping. Three old helpers are still serving the good stuff, and you send the new one home: that's a **rollback**.

A **Deployment** does exactly this for pods. You tell it "4 copies of version 2", and it swaps old pods for new ones a few at a time, only moving on when the new ones are **ready**.

## Three layers
- A **Deployment** holds your wish: the pod template (image, command, env...), the number of replicas and the update strategy.
- For each version of the template it creates a **ReplicaSet**, whose only job is to keep exactly N identical pods running. If one dies, it makes another.
- The ReplicaSet creates the **Pods**, and marks itself as their owner (\`ownerReferences\`).

You work with Deployments and almost never touch ReplicaSets yourself. The pod names show the layering: \`web-84564b5c7f-x2k9q\` is pod \`x2k9q\` of ReplicaSet \`web-84564b5c7f\`, whose middle part is a hash of the pod template.

## The pod template and the selector
\`spec.selector\` says which pods the Deployment owns; \`spec.template\` is the blueprint for new ones. The template's labels **must** match the selector, and the selector can't be changed after creation. Any change to the **template** (image, env, resources, labels...) starts a **rollout**; changing \`replicas\` only scales.

## Rolling updates
The default strategy, \`RollingUpdate\`, has two knobs:
- \`maxSurge\`: how many **extra** pods may exist during the update (default 25%, rounded up);
- \`maxUnavailable\`: how many may be **missing** (default 25%, rounded down).

With 4 replicas: up to 5 pods exist and at least 3 are available at every moment. \`maxSurge: 1, maxUnavailable: 0\` is the cautious setting: always full capacity, one new pod at a time. The other strategy, \`Recreate\`, kills all old pods first: downtime, but never two versions at once (sometimes needed for database schema changes).

A rollout only moves forward when new pods become **Ready**. That's why readiness probes (lesson 7) matter: without one, "running" counts as ready, and a broken app gets traffic.

## When a release is bad
If new pods never become ready (the image doesn't exist, the app crashes at start), the rollout **stalls**: \`maxUnavailable\` stops it from removing more old pods, so the old version keeps serving. After \`progressDeadlineSeconds\` (default 600 s) the Deployment reports \`ProgressDeadlineExceeded\`. It does **not** roll back on its own; you (or your CD tool) do:

\`\`\`bash
kubectl rollout status deployment/web     # wait and report
kubectl rollout history deployment/web    # list revisions
kubectl rollout undo deployment/web       # back to the previous one
kubectl rollout undo deployment/web --to-revision=2
kubectl rollout restart deployment/web    # new pods, same spec (e.g. to reload config)
kubectl rollout pause / resume ...        # batch several edits into one rollout
\`\`\`

Old ReplicaSets are kept (scaled to 0) for rollbacks; \`revisionHistoryLimit\` (default 10) decides how many.

## Fancier strategies
Deployments only do rolling updates. **Blue/green** (run both versions, switch traffic at once) and **canary** (send 5% of traffic to the new version, watch metrics, then go further) are built with two Deployments plus Service or Ingress tricks (lesson 12), or with tools like **Argo Rollouts** and **Flagger** that automate the analysis. Try all four strategies in the rollout visualizer.

## The workload family
| Kind | Use it for |
|---|---|
| **Deployment** | stateless apps: web servers, APIs, workers |
| **StatefulSet** | apps that need stable names and their own disks: databases, Kafka (lesson 14) |
| **DaemonSet** | one pod per node: log collectors, monitoring agents (lesson 8) |
| **Job / CronJob** | run to completion, once or on a schedule (lesson 8) |`,
    keyPoints: [
      "Deployment → ReplicaSet (one per template version) → Pods. You manage Deployments; ReplicaSets keep the pod count.",
      "Changing the pod template starts a rolling update; changing replicas only scales.",
      "maxSurge and maxUnavailable bound the extra and missing pods during a rollout; new pods must be Ready before old ones go.",
      "A bad release stalls the rollout but leaves the old pods serving; Kubernetes doesn't roll back by itself: kubectl rollout undo does.",
      "Canary and blue/green need extra tooling (two Deployments, Ingress weights, Argo Rollouts, Flagger).",
    ],
    code: [
      {
        title: "A Deployment and its owner chain",
        k8s: true,
        images: ["node:20-slim"],
        vary: ["web-[a-z0-9]{8,10}"],
        files: [{ path: "deployment.yaml", lang: "yaml", code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: quest-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web          # the Deployment owns the pods with this label...
  template:             # ...and creates new ones from this template
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: node:20-slim
          command: ["node", "-e", "require('http').createServer((q, s) => s.end('ok')).listen(8080); process.on('SIGTERM', () => process.exit(0))"]` }],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-deploy > /dev/null
kubectl apply -f deployment.yaml
kubectl -n quest-deploy rollout status deployment/web --timeout=120s | tail -n 1

# A Deployment manages a ReplicaSet, which manages the Pods. Follow the owner chain:
pod=$(kubectl -n quest-deploy get pods -l app=web -o name | head -n 1)
rs=$(kubectl -n quest-deploy get $pod -o jsonpath='{.metadata.ownerReferences[0].name}')
echo "a pod is owned by:          ReplicaSet $rs"
echo "that ReplicaSet is owned by: $(kubectl -n quest-deploy get rs $rs -o jsonpath='{.metadata.ownerReferences[0].kind} {.metadata.ownerReferences[0].name}')"

kubectl -n quest-deploy scale deployment/web --replicas=6
kubectl -n quest-deploy rollout status deployment/web --timeout=120s > /dev/null
kubectl -n quest-deploy get deployment web -o custom-columns='DEPLOYMENT:.metadata.name,WANTED:.spec.replicas,READY:.status.readyReplicas'` }],
        explain: `- The YAML is the real way to write a Deployment: \`selector.matchLabels\` and \`template.metadata.labels\` agree on \`app: web\`.
- Each pod's \`ownerReferences\` names its ReplicaSet, and the ReplicaSet's names the Deployment. The garbage collector uses this chain: delete the Deployment and everything under it goes too (lesson 17).
- \`process.on('SIGTERM', ...)\` makes the app exit as soon as Kubernetes asks it to stop. Without it, Node.js running as PID 1 ignores SIGTERM and every pod takes the full 30-second grace period to die. More in lesson 7.
- \`kubectl scale\` changes only \`replicas\`: no new ReplicaSet, no rollout.`,
        output: `deployment.apps/web created
deployment "web" successfully rolled out
a pod is owned by:          ReplicaSet web-84564b5c7f
that ReplicaSet is owned by: Deployment web
deployment.apps/web scaled
DEPLOYMENT   WANTED   READY
web          6        6`,
      },
      {
        title: "Roll out, break it, roll back",
        note: "A rolling update, then a release with an image that doesn't exist.",
        k8s: true,
        images: ["node:20-slim"],
        variants: [{ lang: "bash", code: `kubectl create namespace quest-rollout > /dev/null
# The app prints its version; $VERSION comes from the pod template
kubectl -n quest-rollout create deployment web --image=node:20-slim --replicas=4 -- \\
  node -e "console.log('version ' + (process.env.VERSION || 1)); setInterval(() => {}, 1e9); process.on('SIGTERM', () => process.exit(0))" > /dev/null

settle() {   # wait until the rollout is done and the old pods are gone
  kubectl -n quest-rollout rollout status deployment/web --timeout=120s | tail -n 1
  until [ "$(kubectl -n quest-rollout get pods --no-headers | wc -l | tr -d ' ')" = 4 ]; do sleep 0.5; done
}
versions() {
  for pod in $(kubectl -n quest-rollout get pods -o name); do kubectl -n quest-rollout logs "$pod"; done \\
    | sort | uniq -c | awk '{print "  " $1 " pods say: " $2 " " $3}'
}
settle; versions

# Rolling update: any change to the pod template creates a new ReplicaSet.
# New pods come up and old ones go, a few at a time, so the app never fully stops.
kubectl -n quest-rollout set env deployment/web VERSION=2 > /dev/null
settle; versions

# A broken release: an image that can't be pulled. The rollout stalls, but the old pods keep serving.
kubectl -n quest-rollout set image deployment/web node=node:does-not-exist > /dev/null
sleep 8
kubectl -n quest-rollout get deployment web -o custom-columns='WANTED:.spec.replicas,UP-TO-DATE:.status.updatedReplicas,AVAILABLE:.status.availableReplicas'
echo "new pods that can't pull their image: $(kubectl -n quest-rollout get pods --no-headers | grep -cE 'ErrImagePull|ImagePullBackOff')"

# Roll back to the previous version
kubectl -n quest-rollout rollout undo deployment/web > /dev/null
settle; versions
kubectl -n quest-rollout rollout history deployment/web | tail -n +3 | awk 'NF {print "revision " $1}'` }],
        explain: `- \`kubectl set env\` changes the pod template, so the Deployment creates a new ReplicaSet and swaps pods over. Every pod ends up saying \`version 2\`.
- \`set image ... node:does-not-exist\` is a broken release. With 4 replicas, the defaults allow 1 extra pod and 1 missing pod, so the Deployment starts 2 new pods (UP-TO-DATE 2) and takes 1 old one away (AVAILABLE 3). The new pods can't pull their image, so they never get Ready, and the rollout stops there. **Three old pods keep serving**: a bad release degrades capacity, not the whole app.
- \`rollout undo\` goes back to the previous ReplicaSet. History shows revisions 1, 3, 4: undo doesn't go back in time, it **re-applies** revision 2's template as the new revision 4.
- In real life, a CD tool runs \`rollout status\` with a timeout and calls \`undo\` when it fails.`,
        output: `deployment "web" successfully rolled out
  4 pods say: version 1
deployment "web" successfully rolled out
  4 pods say: version 2
WANTED   UP-TO-DATE   AVAILABLE
4        2            3
new pods that can't pull their image: 2
deployment "web" successfully rolled out
  4 pods say: version 2
revision 1
revision 3
revision 4`,
      },
    ],
    interview: [
      {
        q: "How do you achieve zero-downtime deployments in Kubernetes?",
        a: "Rolling update with `maxUnavailable: 0` and `maxSurge` > 0 so capacity never drops; a **readiness probe** so new pods only get traffic when ready; **graceful shutdown**: a preStop sleep of a few seconds (endpoint removal propagates asynchronously to kube-proxy and load balancers), then the app handles SIGTERM by finishing in-flight requests within `terminationGracePeriodSeconds`; **PodDisruptionBudgets** so drains don't remove too many replicas; backward-compatible changes so old and new versions can run side by side (API and schema: expand/contract migrations); connection draining on long-lived connections; and for extra safety, canary releases with automated rollback.",
        freq: "very-common",
      },
      {
        q: "What's the relationship between a Deployment, a ReplicaSet and a Pod?",
        a: "A **Deployment** declares the desired pod template, replica count and update strategy. For every distinct template it creates a **ReplicaSet** (named with a hash of the template), whose controller keeps exactly N matching **Pods** running. During a rolling update the Deployment controller scales the new ReplicaSet up and the old one down within `maxSurge`/`maxUnavailable`, waiting for readiness. Old ReplicaSets stay at 0 replicas as rollback targets (`revisionHistoryLimit`). Pods carry an `ownerReference` to their ReplicaSet, which is how garbage collection cascades deletes.",
        freq: "very-common",
      },
      {
        q: "A rollout is stuck halfway. What's happening and what do you do?",
        a: "New pods aren't becoming **Ready**, so the Deployment won't remove more old pods (maxUnavailable) and stays partly rolled out; after `progressDeadlineSeconds` it reports `ProgressDeadlineExceeded` but **doesn't roll back automatically**. Check `kubectl rollout status`, then `kubectl get pods` for the new ReplicaSet's pods: ImagePullBackOff (bad tag, registry auth), CrashLoopBackOff (`logs --previous`), Pending (requests don't fit, quota), or Running-but-not-Ready (readiness probe failing: wrong path or port, dependency down). Mitigate with `kubectl rollout undo`, then fix forward. In CD, gate on `rollout status --timeout` and undo automatically.",
        freq: "common",
      },
    ],
    quiz: [
      {
        q: "Which change starts a rolling update?",
        options: ["kubectl scale --replicas=10", "Changing the container image in the pod template", "Adding a label to the Deployment's metadata", "Deleting one pod"],
        answer: 1,
        explain: "Any change to spec.template makes a new ReplicaSet. Scaling and deleting pods don't.",
      },
      {
        q: "replicas: 4, maxSurge: 1, maxUnavailable: 0. During the rollout there are always…",
        options: ["Exactly 4 pods", "At least 4 available pods, at most 5 pods", "At least 3 available pods", "Between 0 and 8 pods"],
        answer: 1,
        explain: "maxUnavailable 0 keeps full capacity; maxSurge 1 allows one extra pod at a time.",
      },
      {
        q: "A new image can't be pulled. After 10 minutes, Kubernetes…",
        options: ["Rolls back automatically", "Marks the rollout ProgressDeadlineExceeded and leaves it as is", "Deletes the Deployment", "Retries with :latest"],
        answer: 1,
        explain: "It reports the failure; rolling back is up to you or your CD tool (kubectl rollout undo).",
      },
      {
        q: "Why are old ReplicaSets kept with 0 replicas?",
        options: ["They're leaked by a bug", "They're the rollback targets for rollout undo", "They hold the pods' logs", "They reserve node capacity"],
        answer: 1,
        explain: "revisionHistoryLimit (default 10) controls how many are kept.",
      },
    ],
  },
];
