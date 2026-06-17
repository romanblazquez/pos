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
  cacheDir: resolve(repoRoot, 'node_modules/.vite/seller-portal'),
  plugins: [tailwindcss(), react(), tsconfigPaths({ root: repoRoot, projects: ['tsconfig.base.json'] })],
  server: {
    port: 4400,
    strictPort: true,
    fs: { allow: [repoRoot] },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: resolve(repoRoot, 'dist/apps/seller-portal'),
    emptyOutDir: true,
  },
});
