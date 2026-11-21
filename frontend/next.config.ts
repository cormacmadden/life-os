import type { NextConfig } from "next";

// Where the Next.js server reaches the FastAPI backend. Rewrites are resolved
// at build time, so the Docker build passes BACKEND_INTERNAL_URL (the compose
// service name); `npm run dev` falls back to a backend on localhost.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  // Pass /api paths to FastAPI untouched (it has its own slash rules)
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_INTERNAL_URL}/api/:path*` },
      { source: "/health", destination: `${BACKEND_INTERNAL_URL}/health` },
    ];
  },
};

export default nextConfig;
