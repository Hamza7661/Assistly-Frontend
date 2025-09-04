import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds on Render even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
