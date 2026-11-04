import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The Docker lessons moved from the Kubernetes world to the Docker world
  async redirects() {
    return ["docker-internals", "docker-networking", "docker-compose"].map((id) => ({
      source: `/worlds/kubernetes/${id}`,
      destination: `/worlds/docker/${id}`,
      permanent: true,
    }));
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
