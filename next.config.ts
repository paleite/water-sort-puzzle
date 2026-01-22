import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: true,

  // Enable typed routes for better type safety
  typedRoutes: true,

  // React Compiler support (Next.js 16)
  // Automatically optimizes React components for better performance
  reactCompiler: true,

  output: "export",

  // Set basePath for GitHub Pages
  basePath: process.env.NODE_ENV === "production" ? "/water-sort-puzzle" : "",

  images: {
    unoptimized: true,
  },

  // Set Turbopack root to workspace root to avoid lockfile detection issues
  // This tells Next.js where the workspace root is when multiple lockfiles exist
  // In Nx monorepos, we need to point to the workspace root (where pnpm-lock.yaml is)
  turbopack: {
    root: resolve(__dirname),
  },
};

export default nextConfig;
