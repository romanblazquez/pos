import type { SettingsSection } from './provider-types.js';

/**
 * SettingsRegistry — the runtime extensibility point for the Settings app.
 *
 * Each Retail OS module (inventory, CRM, accounting, payments) registers its
 * own settings page here at module boot. The Settings app reads from the
 * registry and renders the navigation tree dynamically — no code change
 * required when a new module lands.
 */
export class SettingsRegistry {
  private readonly sections = new Map<string, SettingsSection>();

  register(section: SettingsSection): void {
    this.sections.set(section.id, section);
  }

  unregister(sectionId: string): void {
    this.sections.delete(sectionId);
  }

  getAll(): SettingsSection[] {
    return [...this.sections.values()];
  }

  getByModule(moduleId: string): SettingsSection[] {
    return this.getAll().filter((s) => s.moduleId === moduleId);
  }

  getById(id: string): SettingsSection | undefined {
    return this.sections.get(id);
  }
}

/** Built-in platform sections always registered at startup. */
export const PLATFORM_SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'general', moduleId: 'platform', label: 'General', icon: '🏪', route: '/settings/general', permission: 'admin.manage' },
  { id: 'store', moduleId: 'platform', label: 'Tienda', icon: '🏬', route: '/settings/store', permission: 'admin.manage' },
  { id: 'payments', moduleId: 'platform', label: 'Pagos', icon: '💳', route: '/settings/payments', permission: 'admin.manage' },
  { id: 'hardware', moduleId: 'platform', label: 'Hardware', icon: '🖨️', route: '/settings/hardware', permission: 'admin.manage' },
  { id: 'taxes', moduleId: 'platform', label: 'Impuestos', icon: '📋', route: '/settings/taxes', permission: 'admin.manage' },
  { id: 'users', moduleId: 'platform', label: 'Usuarios', icon: '👥', route: '/settings/users', permission: 'admin.manage' },
  { id: 'security', moduleId: 'platform', label: 'Seguridad', icon: '🔒', route: '/settings/security', permission: 'admin.manage' },
  { id: 'integrations', moduleId: 'platform', label: 'Integraciones', icon: '🔗', route: '/settings/integrations', permission: 'admin.manage' },
  { id: 'developer', moduleId: 'platform', label: 'Herramientas Dev', icon: '🛠️', route: '/settings/developer' },
];
