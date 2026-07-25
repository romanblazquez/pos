import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Root Vitest config. Domain, RWP, payments and platform libraries ship
 * co-located `*.spec.ts` unit tests. `vite-tsconfig-paths` resolves the
 * `@retail-os/*` aliases declared in tsconfig.base.json so tests import
 * libraries exactly the way application code does.
 */
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['tsconfig.base.json'] })],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'libs/**/*.{spec,test}.ts',
      'apps/api/src/**/*.{spec,test}.ts',
      'apps/marketplace/src/**/*.{spec,test}.ts',
      'apps/web/src/**/*.{spec,test}.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**'],
    coverage: {
      provider: 'v8',
      include: ['libs/**/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.spec.ts'],
    },
  },
});
