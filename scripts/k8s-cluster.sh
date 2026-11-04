#!/usr/bin/env bash
# A throwaway 3-node Kubernetes cluster (k3s in Docker) for testing the Kubernetes world's samples.
#
#   scripts/k8s-cluster.sh up KUBECONFIG_PATH [IMAGE...]   start it; IMAGE... are extra local images to preload
#   scripts/k8s-cluster.sh load IMAGE...                    copy local Docker images onto every node
#   scripts/k8s-cluster.sh clean                            undo what samples did (quest-* objects, node labels and taints)
#   scripts/k8s-cluster.sh down                             delete it
#
# It runs fully offline: every image comes from the local Docker engine (never pulled), and registry pulls
# inside the cluster are disabled, so a sample that needs an image it didn't declare fails instead of
# quietly downloading it. The one-time setup is `docker pull` of the images listed below.
set -euo pipefail

K3S=${LANG_K3S_IMAGE:-rancher/k3s:v1.34.1-k3s1}
# what k3s v1.34.1 runs: pause, CoreDNS, local-path storage (+ its busybox helper), metrics-server, the service load balancer, Traefik
SYSTEM=(
  rancher/mirrored-pause:3.6
  rancher/mirrored-coredns-coredns:1.12.3
  rancher/local-path-provisioner:v0.0.32
  rancher/mirrored-library-busybox:1.36.1
  rancher/mirrored-metrics-server:v0.8.0
  rancher/klipper-lb:v0.4.13
  rancher/klipper-helm:v0.9.8-build20250709
  rancher/mirrored-library-traefik:3.3.6
)
NAME=k3s-quest
NODES=("$NAME-server" "$NAME-agent-1" "$NAME-agent-2")
CACHE=${TMPDIR:-/tmp}/dsa-quest-k3s
PORT=${LANG_K3S_PORT:-16443}

down() {
  docker rm -f "${NODES[@]}" > /dev/null 2>&1 || true
  docker network rm "$NAME" > /dev/null 2>&1 || true
}

missing() {
  local m=()
  for img in "$K3S" "${SYSTEM[@]}" "$@"; do docker image inspect "$img" > /dev/null 2>&1 || m+=("$img"); done
  echo "${m[@]+"${m[@]}"}"
}

# only this machine's platform: multi-platform images can reference blobs for other CPUs that were never pulled
PLATFORM=linux/$(docker version -f '{{.Server.Arch}}' 2>/dev/null || echo amd64)
save() { docker save --platform "$PLATFORM" "$@"; }

load() {
  for node in "${NODES[@]}"; do
    save "$@" | docker exec -i "$node" ctr -n k8s.io images import - > /dev/null
  done
}

up() {
  local kubeconfig=$1
  shift
  local need
  need=$(missing "$@")
  if [ -n "$need" ]; then
    echo "missing local images: $need" >&2
    exit 3
  fi
  down
  mkdir -p "$CACHE"
  # 1. one tarball with every image; k3s imports /var/lib/rancher/k3s/agent/images/*.tar on start
  local key tar
  key=$(for img in "${SYSTEM[@]}" "$@"; do docker image inspect -f '{{.Id}}' "$img"; done | shasum | cut -c1-12)
  tar="$CACHE/images-${PLATFORM#linux/}-$key.tar"
  [ -f "$tar" ] || save "${SYSTEM[@]}" "$@" > "$tar"
  mkdir -p "$CACHE/airgap-$key" && ln -f "$tar" "$CACHE/airgap-$key/images.tar"
  # 2. no registry access: every registry is "mirrored" to a dead endpoint, with no fallback
  printf 'mirrors:\n  "*":\n    endpoint: ["http://127.0.0.1:1"]\n' > "$CACHE/registries.yaml"
  # 3. Traefik (the bundled ingress controller) also serves the Gateway API
  mkdir -p "$CACHE/manifests"
  printf 'apiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: traefik\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    providers:\n      kubernetesGateway:\n        enabled: true\n' > "$CACHE/manifests/traefik-config.yaml"

  local common=(--privileged --tmpfs /run --tmpfs /var/run --network "$NAME" -e K3S_TOKEN=quest
    -v "$CACHE/airgap-$key:/var/lib/rancher/k3s/agent/images:ro" -v "$CACHE/registries.yaml:/etc/rancher/k3s/registries.yaml:ro")
  rm -f "$CACHE/kubeconfig.yaml"
  docker network create "$NAME" > /dev/null
  docker run -d --name "${NODES[0]}" --hostname quest-server "${common[@]}" -p "127.0.0.1:$PORT:6443" \
    -e K3S_KUBECONFIG_OUTPUT=/output/kubeconfig.yaml -e K3S_KUBECONFIG_MODE=644 -v "$CACHE:/output" \
    -v "$CACHE/manifests/traefik-config.yaml:/var/lib/rancher/k3s/server/manifests/traefik-config.yaml:ro" \
    "$K3S" server --node-name quest-server --tls-san 127.0.0.1 --disable-default-registry-endpoint > /dev/null
  for i in 1 2; do
    docker run -d --name "${NODES[$i]}" --hostname "quest-worker-$i" "${common[@]}" \
      "$K3S" agent --server "https://${NODES[0]}:6443" --node-name "quest-worker-$i" --disable-default-registry-endpoint > /dev/null
  done

  # 4. kubeconfig on the host, with a context named k3s-quest
  for _ in $(seq 1 90); do [ -s "$CACHE/kubeconfig.yaml" ] && break; sleep 1; done
  sed -e "s#https://127.0.0.1:6443#https://127.0.0.1:$PORT#" -e "s/: default$/: k3s-quest/" "$CACHE/kubeconfig.yaml" > "$kubeconfig"
  export KUBECONFIG=$kubeconfig

  # 5. wait for 3 Ready nodes and the system add-ons
  for _ in $(seq 1 120); do
    [ "$(kubectl get nodes --no-headers 2>/dev/null | grep -c ' Ready ')" = 3 ] && break
    sleep 1
  done
  kubectl wait --for=condition=Ready nodes --all --timeout=120s > /dev/null
  for _ in $(seq 1 120); do
    kubectl -n kube-system get deploy traefik > /dev/null 2>&1 && break
    sleep 1
  done
  kubectl -n kube-system rollout status deploy/coredns deploy/metrics-server deploy/local-path-provisioner deploy/traefik --timeout=180s > /dev/null
  kubectl -n kube-system wait --for=condition=Available apiservice/v1beta1.metrics.k8s.io --timeout=120s > /dev/null 2>&1 \
    || kubectl wait --for=condition=Available apiservice/v1beta1.metrics.k8s.io --timeout=120s > /dev/null
  echo "cluster ready: $(kubectl get nodes --no-headers | awk '{print $1}' | tr '\n' ' ')"
}

# Undo everything a sample did: quest-* namespaces and cluster-wide objects, node labels, taints and cordons.
clean() {
  local ns
  for ns in $(kubectl get ns -o name | sed -n 's#^namespace/\(quest-.*\)#\1#p'); do
    kubectl -n "$ns" delete pods --all --grace-period=0 --force > /dev/null 2>&1 || true
    kubectl delete ns "$ns" --timeout=120s > /dev/null 2>&1 || true
  done
  local kind obj
  for kind in clusterrolebinding clusterrole priorityclass storageclass ingressclass crd \
    validatingadmissionpolicybinding validatingadmissionpolicy validatingwebhookconfiguration mutatingwebhookconfiguration; do
    # quest* names, and CRDs in a quest.* API group (websites.quest.dsa.dev)
    for obj in $(kubectl get "$kind" -o name 2>/dev/null | grep -E '/quest|\.quest\.' || true); do kubectl delete "$obj" --timeout=60s > /dev/null 2>&1 || true; done
  done
  local node key
  for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'); do
    kubectl uncordon "$node" > /dev/null
    for key in $(kubectl get node "$node" -o jsonpath='{range .spec.taints[*]}{.key}{"\n"}{end}' | grep '^quest' | sort -u || true); do
      kubectl taint nodes "$node" "$key-" > /dev/null
    done
    for key in $(kubectl get node "$node" -o jsonpath='{.metadata.labels}' | python3 -c 'import json,sys; print("\n".join(k for k in json.load(sys.stdin) if k.startswith("quest")))'); do
      kubectl label nodes "$node" "$key-" > /dev/null
    done
  done
}

case "${1:-}" in
  up) shift; up "$@" ;;
  load) shift; load "$@" ;;
  clean) clean ;;
  down) down ;;
  missing) shift; missing "$@" ;;
  *) echo "usage: $0 up KUBECONFIG [IMAGE...] | load IMAGE... | down" >&2; exit 2 ;;
esac
