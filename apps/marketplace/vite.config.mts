import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  root: here,
  // Vite's default envDir is `root` (this app's own folder) — the actual .env
  // lives at the monorepo root, so without this every VITE_* var silently
  // fell back to its hardcoded default instead of being read at all.
  envDir: repoRoot,
  cacheDir: resolve(repoRoot, 'node_modules/.vite/marketplace'),
  plugins: [tailwindcss(), react(), tsconfigPaths({ root: repoRoot, projects: ['tsconfig.base.json'] })],
  server: {
    port: 4300,
    strictPort: true,
    fs: { allow: [repoRoot] },
    // Allow ngrok tunnel hostnames — needed to test MercadoPago's auto_return,
    // which requires a public https URL (rejects http://localhost).
    allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/apps/marketplace'),
    emptyOutDir: true,
  },
});
