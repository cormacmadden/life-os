import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize bundle splitting
  webpack: (config, { dev, isServer }) => {
    // Enable production optimizations in dev mode
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20
            },
            // React/React-DOM in separate chunk
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 30
            },
            // Recharts in separate chunk
            recharts: {
              name: 'recharts',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](recharts)[\\/]/,
              priority: 25
            },
            // Common chunk
            common: {
              name: 'common',
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },

  // Reduce build times and improve hot reload
  reactStrictMode: true,
  
  // Optimize images
  images: {
    unoptimized: true, // Faster dev builds
  },
};

export default nextConfig;
