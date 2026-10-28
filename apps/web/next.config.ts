import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Bitta .env repo ildizida (prod'da muhit o'zgaruvchilari Coolify'dan keladi, fayl yo'q — jim o'tadi).
loadEnv({ path: [path.resolve(process.cwd(), '../../.env.local'), path.resolve(process.cwd(), '../../.env')], quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker: faqat kerakli fayllar (.next/standalone) — image 1.3 GB o'rniga ~0.3 GB, deploy tez, disk o'smaydi (BARQARORLIK 3.4).
  // Monorepo: kuzatish ildizi — repo (packages/* ham kiradi)
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@adone/core', '@adone/db'],
  serverExternalPackages: ['pg'],
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};

export default nextConfig;
