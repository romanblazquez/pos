// Single source of truth for the platform's default market until per-tenant/
// per-request market resolution lands (i18n roadmap Phase 2). Every service
// that used to inline 'MXN'/'MX' should import from here instead, so the
// eventual switch to real TenantMarket resolution is a one-file change.
export const DEFAULT_COUNTRY_CODE = 'MX';
export const DEFAULT_CURRENCY_CODE = 'MXN';
export const DEFAULT_LANGUAGE_CODE = 'es';
export const DEFAULT_TIMEZONE = 'America/Mexico_City';

// Matches the stub tenant used elsewhere (see apps/api/src/catalog/catalog.controller.ts)
// until real JWT-derived tenant resolution lands.
export const DEFAULT_TENANT_ID = 'tenant-demo';
