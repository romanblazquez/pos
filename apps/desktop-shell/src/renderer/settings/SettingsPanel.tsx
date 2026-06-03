import { useState } from 'react';
import { PLATFORM_SETTINGS_SECTIONS, type SettingsSection } from '@retail-os/provider-manager';
import { PaymentProvidersSettings } from './sections/PaymentProvidersSettings.js';
import { DeveloperSettings } from './sections/DeveloperSettings.js';
import { GeneralSettings } from './sections/GeneralSettings.js';
import { IntegrationsPanel } from '../integrations/IntegrationsPanel.js';

/**
 * SettingsPanel — the main Settings application rendered inside Dockview.
 *
 * Architecture: extensible settings registry. At boot, platform modules register
 * `SettingsSection` entries via `SettingsRegistry`. This panel reads the registry
 * and renders the nav + active section. No code change needed when a new module
 * (inventory, CRM, accounting) registers its settings page.
 */
const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  general: GeneralSettings,
  payments: PaymentProvidersSettings,
  integrations: IntegrationsPanel,
  developer: DeveloperSettings,
};

export function SettingsPanel() {
  const [activeSectionId, setActiveSectionId] = useState('general');
  const sections = PLATFORM_SETTINGS_SECTIONS;
  const active = sections.find((s) => s.id === activeSectionId) ?? sections[0];
  const Component = SECTION_COMPONENTS[active.id] ?? PlaceholderSection;

  return (
    <div className="settings-shell">
      <nav className="settings-nav">
        <div className="settings-nav-header">
          <span className="settings-logo">⚙️</span>
          <strong>Configuración</strong>
        </div>
        {sections.map((section) => (
          <SettingsNavItem
            key={section.id}
            section={section}
            active={section.id === activeSectionId}
            onClick={() => setActiveSectionId(section.id)}
          />
        ))}
      </nav>
      <div className="settings-content">
        <header className="settings-content-header">
          <span className="settings-section-icon">{active.icon}</span>
          <div>
            <h1>{active.label}</h1>
          </div>
        </header>
        <div className="settings-section-body">
          <Component />
        </div>
      </div>
    </div>
  );
}

function SettingsNavItem({
  section,
  active,
  onClick,
}: {
  section: SettingsSection;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`settings-nav-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="settings-nav-icon">{section.icon}</span>
      <span>{section.label}</span>
    </button>
  );
}

function PlaceholderSection() {
  return (
    <div className="settings-placeholder">
      <p>Esta sección estará disponible próximamente.</p>
    </div>
  );
}
