import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
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
  plugins: [react(), tsconfigPaths({ root: repoRoot, projects: ['tsconfig.base.json'] })],
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
