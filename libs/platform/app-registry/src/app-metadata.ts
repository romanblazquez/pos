/**
 * Application metadata — the contract every Retail OS module publishes so the
 * Odoo-style launcher can discover, categorize, permission-gate and open it.
 * Mirrors the metadata shape required by the platform spec.
 */
export interface AppMetadata {
  id: string;
  name: string;
  version: string;
  icon: string;
  /** Permissions a user must hold for the app to appear/launch. */
  permissions: string[];
  category: AppCategory;
  /** How the shell opens it: a dev URL (React/Angular app) or an internal route. */
  entryPoint: { kind: 'url'; url: string; devPort?: number } | { kind: 'route'; path: string };
  /** Declared RWP capabilities for wiring and the interop graph. */
  capabilities: {
    publishes?: string[];
    subscribes?: string[];
    raisesIntents?: string[];
    handlesIntents?: string[];
  };
  description?: string;
}

export type AppCategory =
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'reporting'
  | 'administration'
  | 'finance';
