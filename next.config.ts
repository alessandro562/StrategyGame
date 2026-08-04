import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lo stato vive interamente su Redis: nessuna route deve essere pre-renderizzata.
  experimental: {},
};

export default nextConfig;
