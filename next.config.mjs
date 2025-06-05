/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Disable telemetry that might be causing deploymentId errors
    telemetry: false,
  },
  // Disable Next.js analytics
  analyticsId: '',
};

export default nextConfig; 