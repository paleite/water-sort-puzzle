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

  // Set basePath for GitHub Pages
  basePath: process.env.NODE_ENV === "production" ? "/water-sort-puzzle" : "",
};

export default nextConfig;
