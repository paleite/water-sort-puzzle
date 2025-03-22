import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  reactStrictMode: true,

  experimental: {
    reactCompiler: true,
  },

  output: "export",
};

export default nextConfig;
