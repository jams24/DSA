import type { World } from "../types";
import { dockerPart1 } from "./docker-1";
import { dockerPart2 } from "./docker-2";
import { dockerPart3 } from "./docker-3";
import { dockerPart4 } from "./docker-4";
import { dockerPart5 } from "./docker-5";
import { dockerPart6 } from "./docker-6";

export const docker: World = {
  id: "docker",
  order: 10,
  title: "Docker Dockyard",
  subtitle: "Docker from your first container to production: images, Dockerfiles, the build cache, PID 1, volumes, networking, Compose, namespaces and cgroups, overlayfs, the engine, security, CI/CD, two projects and the Docker interview",
  description:
    "Docker explained so simply a 10-year-old could follow, and deep enough for a DevOps or backend interview. Run, stop and inspect containers, build images layer by layer, make builds fast and images small and safe, keep data in volumes, connect containers on networks, describe a whole stack in Compose, then open the box: namespaces, cgroups, copy-on-write layers, containerd and runc. Harden, monitor and ship containers through CI, deploy a real app with Compose, and build your own Docker in Python. Every sample runs against a real Docker engine.",
  emoji: "🐳",
  color: "#0369a1",
  boss: {
    name: "The Kraken of :latest",
    title: "Hoarder of 2 GB Images and Leaked Secrets",
    emoji: "🦑",
    taunt: "Your images run as root, your secrets hide in layer three, your app ignores SIGTERM and nobody knows which :latest is in production. Every container in this harbour is mine!",
    defeat: "Pinned tags, slim layers, non-root users, healthy checks and a clean exit code 0. The harbour is calm. You don't just use containers now: you could build one.",
  },
  lessons: [...dockerPart1, ...dockerPart2, ...dockerPart3, ...dockerPart4, ...dockerPart5, ...dockerPart6],
};
