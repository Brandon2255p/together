import type { NextConfig } from "next";

const buildCpus = Number(process.env.NEXT_BUILD_CPUS) || undefined;

const nextConfig: NextConfig = {
  typedRoutes: true,
  // a self-contained server in .next/standalone, for the Docker image (Vercel ignores it)
  output: "standalone",
  experimental: {
    // Build workers. Next defaults to one per core; the Dockerfile caps it so a build on a busy server doesn't run
    // out of memory (16 workers got the build killed on Coolify). Unset = Next's default.
    cpus: buildCpus,
  },
};

export default nextConfig;
