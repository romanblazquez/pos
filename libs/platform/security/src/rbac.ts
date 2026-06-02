/**
 * RBAC — role-based access control matrix for Retail OS.
 *
 * Permissions are fine-grained verbs (`sales.refund`, `inventory.adjust`); roles
 * bundle them. The same matrix gates launcher visibility, RWP intents and (on the
 * roadmap) NestJS route guards. Designed multi-tenant: a principal is always
 * scoped to a tenant + store.
 */
export type Permission =
  | 'sales.create'
  | 'sales.refund'
  | 'sales.discount'
  | 'inventory.view'
  | 'inventory.adjust'
  | 'customers.view'
  | 'customers.manage'
  | 'reports.view'
  | 'admin.manage';

export type Role = 'cashier' | 'supervisor' | 'store_manager' | 'admin';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  cashier: ['sales.create', 'customers.view', 'inventory.view'],
  supervisor: ['sales.create', 'sales.refund', 'sales.discount', 'customers.view', 'inventory.view'],
  store_manager: [
    'sales.create',
    'sales.refund',
    'sales.discount',
    'inventory.view',
    'inventory.adjust',
    'customers.view',
    'customers.manage',
    'reports.view',
  ],
  admin: [
    'sales.create',
    'sales.refund',
    'sales.discount',
    'inventory.view',
    'inventory.adjust',
    'customers.view',
    'customers.manage',
    'reports.view',
    'admin.manage',
  ],
};

export interface Principal {
  userId: string;
  tenantId: string;
  storeId: string;
  roles: Role[];
}

export function permissionsFor(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role]) set.add(p);
  return set;
}

export function can(principal: Principal, permission: Permission): boolean {
  return permissionsFor(principal.roles).has(permission);
}
