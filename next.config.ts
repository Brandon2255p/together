import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // a self-contained server in .next/standalone, for the Docker image (Vercel ignores it)
  output: "standalone",
};

export default nextConfig;
