import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Enable filesystem caching for `next build`
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
