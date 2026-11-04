import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Lessons that moved: Docker from the Kubernetes world to the Docker world, Kubernetes from infra to Kubernetes
  async redirects() {
    const moved = [
      ...["docker-internals", "docker-networking", "docker-compose"].map((id) => [`kubernetes/${id}`, `docker/${id}`]),
      ...["k8s-architecture", "k8s-workloads"].map((id) => [`infra/${id}`, `kubernetes/${id}`]),
    ];
    return moved.map(([from, to]) => ({ source: `/worlds/${from}`, destination: `/worlds/${to}`, permanent: true }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
