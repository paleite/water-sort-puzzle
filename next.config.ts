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

  // PWA Configuration
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
