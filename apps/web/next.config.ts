import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@orkesta/shared'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', process.env.APP_URL ?? ''],
    },
  },
};

export default nextConfig;
