/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds even with ESLint errors
    ignoreDuringBuilds: true,
  },
  devIndicators: false,
  typescript: {
    // Allow production builds even with type errors
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig
