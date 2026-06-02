#!/usr/bin/env node
/**
 * One-off generator for per-library Nx `project.json` + `tsconfig.json`.
 * Every Retail OS library lives at libs/<group>/<name> (3 levels under root),
 * so the relative paths are uniform. Existing files are left untouched.
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const libs = [
  ['libs/domain/inventory', 'inventory', ['type:domain', 'scope:inventory']],
  ['libs/domain/sales', 'sales', ['type:domain', 'scope:sales']],
  ['libs/domain/customers', 'customers', ['type:domain', 'scope:customers']],
  ['libs/domain/promotions', 'promotions', ['type:domain', 'scope:promotions']],
  ['libs/domain/payments', 'payments-domain', ['type:domain', 'scope:payments']],
  ['libs/rwp/rwp-core', 'rwp-core', ['type:lib', 'scope:rwp']],
  ['libs/rwp/rwp-bus', 'rwp-bus', ['type:lib', 'scope:rwp']],
  ['libs/rwp/rwp-electron-adapter', 'rwp-electron-adapter', ['type:lib', 'scope:rwp']],
  ['libs/platform/saga', 'saga', ['type:lib', 'scope:platform']],
  ['libs/platform/app-registry', 'app-registry', ['type:lib', 'scope:platform']],
  ['libs/platform/workspace-engine', 'workspace-engine', ['type:lib', 'scope:platform']],
  ['libs/platform/security', 'security', ['type:lib', 'scope:platform']],
  ['libs/payments/payment-orchestrator', 'payment-orchestrator', ['type:lib', 'scope:payments']],
  ['libs/payments/provider-mercadopago', 'provider-mercadopago', ['type:lib', 'scope:payments']],
  ['libs/payments/provider-codi', 'provider-codi', ['type:lib', 'scope:payments']],
  ['libs/sync/sync-engine', 'sync-engine', ['type:lib', 'scope:sync']],
  ['libs/data/local-db', 'local-db', ['type:lib', 'scope:data']],
  ['libs/data/db-postgres', 'db-postgres', ['type:lib', 'scope:data']],
  ['libs/shared/shared-types', 'shared-types', ['type:lib', 'scope:shared']],
  ['libs/shared/observability', 'observability', ['type:lib', 'scope:shared']],
  ['libs/shared/ui-react', 'ui-react', ['type:ui', 'scope:shared']],
];

const tsconfig = {
  extends: '../../../tsconfig.base.json',
  compilerOptions: { composite: false, noEmit: true },
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['node_modules', 'dist', '**/*.spec.ts'],
};

for (const [dir, name, tags] of libs) {
  mkdirSync(join(dir, 'src'), { recursive: true });
  const tsPath = join(dir, 'tsconfig.json');
  if (!existsSync(tsPath)) writeFileSync(tsPath, JSON.stringify(tsconfig, null, 2) + '\n');

  const projPath = join(dir, 'project.json');
  if (!existsSync(projPath)) {
    const project = {
      name,
      $schema: '../../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `${dir}/src`,
      projectType: 'library',
      tags,
      targets: {
        typecheck: {
          executor: 'nx:run-commands',
          options: { command: 'tsc --noEmit -p tsconfig.json', cwd: dir },
        },
        test: {
          executor: 'nx:run-commands',
          options: { command: `vitest run ${dir}` },
        },
      },
    };
    writeFileSync(projPath, JSON.stringify(project, null, 2) + '\n');
  }
  console.log('configured', dir);
}
