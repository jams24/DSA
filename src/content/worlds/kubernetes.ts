import type { World } from "../types";
import { kubernetesPart1 } from "./kubernetes-1";
import { kubernetesPart2 } from "./kubernetes-2";
import { kubernetesPart3 } from "./kubernetes-3";
import { kubernetesPart4 } from "./kubernetes-4";
import { kubernetesPart5 } from "./kubernetes-5";
import { kubernetesPart6 } from "./kubernetes-6";

export const kubernetes: World = {
  id: "kubernetes",
  order: 11,
  title: "The Orchestration Citadel",
  subtitle: "Kubernetes from your first pod to production: architecture, Deployments, Services and DNS, config, probes, Jobs, resources, scheduling, autoscaling, Ingress, NetworkPolicies, storage, GitOps, RBAC, operators, debugging, two projects and the Kubernetes interview",
  description:
    "Kubernetes explained so simply a 10-year-old could follow, and deep enough for a DevOps, platform or SRE interview. Start with why it exists and how a cluster works, run pods and Deployments, connect them with Services, feed them config and secrets, and keep them healthy with probes. Size requests and limits, steer the scheduler, autoscale, open the front door with Ingress, fence traffic with NetworkPolicies and keep data on PersistentVolumes. Then operate it: Kustomize, Helm and GitOps, RBAC and Pod Security, controllers and CRDs, and a debugging playbook. Run the Docker world's app on a cluster and build your own operator. Every sample runs against a real Kubernetes cluster.",
  emoji: "☸️",
  color: "#2563eb",
  boss: {
    name: "The OOMKilled Hydra",
    title: "Warden of the Pending Queue",
    emoji: "🐉",
    taunt: "Cut off one pod and two more crash in its place! Your limits are too low, your probes too eager, your Service selects nothing at all, and a finalizer holds your namespace hostage!",
    defeat: "Requests sized… probes tuned… endpoints ready… 0/0 pods pending. The citadel is yours, operator. You don't just use the robots now: you've built one.",
  },
  lessons: [...kubernetesPart1, ...kubernetesPart2, ...kubernetesPart3, ...kubernetesPart4, ...kubernetesPart5, ...kubernetesPart6],
};
