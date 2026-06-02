import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';

export function StepBusinessInfo({ data, onNext }: StepProps) {
  const info = data.businessInfo ?? {};
  const [businessName, setBusinessName] = useState(info.businessName ?? '');
  const [legalName, setLegalName] = useState(info.legalName ?? '');
  const [country, setCountry] = useState(info.country ?? 'MX');
  const [taxId, setTaxId] = useState(info.taxIdentifier ?? '');
  const [currency, setCurrency] = useState(info.currency ?? 'MXN');
  const [timezone, setTimezone] = useState(info.timezone ?? 'America/Mexico_City');
  const canContinue = businessName.trim().length >= 2;

  return (
    <div className="wizard-step-form">
      <label>Nombre comercial *
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Mi Tienda" />
      </label>
      <label>Razón social
        <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Mi Tienda S.A. de C.V." />
      </label>
      <div className="wizard-row">
        <label>País
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="MX">🇲🇽 México</option>
            <option value="AR">🇦🇷 Argentina</option>
            <option value="CL">🇨🇱 Chile</option>
            <option value="CO">🇨🇴 Colombia</option>
          </select>
        </label>
        <label>Moneda
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="MXN">MXN — Peso Mexicano</option>
            <option value="ARS">ARS — Peso Argentino</option>
            <option value="CLP">CLP — Peso Chileno</option>
          </select>
        </label>
      </div>
      <label>RFC / ID Fiscal
        <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="XAXX010101000" />
      </label>
      <label>Zona horaria
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
          <option value="America/Monterrey">Monterrey (UTC-6)</option>
          <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
          <option value="America/Santiago">Santiago (UTC-4)</option>
        </select>
      </label>
      <div className="wizard-actions">
        <button className="wizard-btn-primary" disabled={!canContinue}
          onClick={() => onNext({ businessInfo: { businessName, legalName, country, taxIdentifier: taxId, currency, timezone } })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
