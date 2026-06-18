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
  cacheDir: resolve(repoRoot, 'node_modules/.vite/customer-display'),
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths({ root: repoRoot, projects: ['tsconfig.base.json'] }),
  ],
  resolve: {
    alias: { '@config': resolve(repoRoot, 'config') },
  },
  server: {
    port: 4201,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/apps/customer-display'),
    emptyOutDir: true,
  },
});
