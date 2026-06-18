import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

/**
 * POS app — React + Vite. Runs standalone in the browser (offline demo) and is
 * also loaded by the Electron shell inside a secure BrowserWindow. The
 * `@retail-os/*` workspace libraries resolve through tsconfig paths.
 */
export default defineConfig({
  root: here,
  // Vite's default envDir is `root` (this app's own folder) — the actual .env
  // lives at the monorepo root, so without this every VITE_* var silently
  // fell back to its hardcoded default instead of being read at all.
  envDir: repoRoot,
  cacheDir: resolve(repoRoot, 'node_modules/.vite/pos'),
  plugins: [tailwindcss(), react(), tsconfigPaths({ root: repoRoot, projects: ['tsconfig.base.json'] })],
  resolve: {
    alias: { '@config': resolve(repoRoot, 'config') },
  },
  server: {
    port: 4200,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/apps/pos'),
    emptyOutDir: true,
  },
});
