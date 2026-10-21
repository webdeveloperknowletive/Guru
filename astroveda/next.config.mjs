import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    const backend = (
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      (process.env.NEXT_PUBLIC_API_BASE_URL ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, '') : null) ||
      'http://localhost:5000'
    ).replace(/\/+$/, '');

    return [
      {
        source: '/static/:path*',
        destination: `${backend}/static/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

