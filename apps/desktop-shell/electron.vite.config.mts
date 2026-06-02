import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const paths = () => tsconfigPaths({ root: repoRoot, projects: [resolve(repoRoot, 'tsconfig.base.json')] });

/**
 * Electron shell build. `externalizeDepsPlugin` keeps node/native modules
 * (better-sqlite3) out of the bundle. The renderer hosts the Odoo-style
 * launcher; the POS app is loaded into its own BrowserWindow from the Vite dev
 * server (dev) or the built bundle (prod).
 */
export default defineConfig({
  main: {
    // nanoid v5 is ESM-only; bundle it into the CJS main process instead of
    // externalizing it. better-sqlite3 stays external (native module).
    plugins: [externalizeDepsPlugin({ exclude: ['nanoid'] }), paths()],
    build: {
      outDir: resolve(here, 'out/main'),
      lib: { entry: resolve(here, 'src/main/main.ts') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(), paths()],
    build: {
      outDir: resolve(here, 'out/preload'),
      lib: { entry: resolve(here, 'src/preload/preload.ts') },
    },
  },
  renderer: {
    root: resolve(here, 'src/renderer'),
    plugins: [react(), paths()],
    build: {
      outDir: resolve(here, 'out/renderer'),
      rollupOptions: { input: resolve(here, 'src/renderer/index.html') },
    },
  },
});
