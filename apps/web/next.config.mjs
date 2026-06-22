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
  // Remote product imagery comes from seller/catalog CDNs; allow https hosts.
  // Tighten to an explicit allowlist once the set of real image hosts is known.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
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
