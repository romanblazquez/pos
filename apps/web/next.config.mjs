import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Slim, self-contained server bundle for the Docker (Node) container.
  output: 'standalone',
  reactStrictMode: true,
  // In a pnpm monorepo, trace from the repo root so workspace deps are bundled
  // into the standalone output (otherwise the container is missing modules).
  // In Next 14 this lives under `experimental` (top-level only in Next 15).
  experimental: { outputFileTracingRoot: repoRoot },
  // SEO content correctness is enforced by the dedicated CI checks (Phase 5),
  // not by failing the production build on a lint/type nit during early phases.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Every image across the catalogue resolves to one of these two hosts
    // (checked against all 436 products: 316 self-hosted, 2 straight from BGG).
    // `hostname: '**'` would let anyone transcode arbitrary images through our
    // optimizer at our CPU's expense. A new seller CDN will 400 loudly here —
    // that's the intended failure: add the host rather than reopen the wildcard.
    remotePatterns: [
      { protocol: 'https', hostname: 'api.juegospedia.com' },
      { protocol: 'https', hostname: 'cf.geekdo-images.com' },
    ],
    // AVIF is deliberately NOT enabled. Covers are ~246px, so AVIF saves only
    // ~6KB each but costs 573ms to encode vs 18ms for WebP (measured on this
    // Pi) — a 48-cover shelf page would burn ~27 CPU-seconds on the same box
    // that serves the API. WebP already takes a 43KB PNG down to 17KB.
    formats: ['image/webp'],
  },
  // The shared design-system lib (@retail-os/ui-react) uses NodeNext-style `.js`
  // import specifiers that actually point at `.ts`/`.tsx` source. Vite resolves
  // these for the other apps; webpack/Next needs an explicit extension alias.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
