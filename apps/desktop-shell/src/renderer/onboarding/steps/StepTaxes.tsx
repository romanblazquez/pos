import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';

export function StepTaxes({ data, onNext, onBack }: StepProps) {
  const t = data.taxes ?? {};
  const [taxName, setTaxName] = useState(t.taxName ?? 'IVA');
  const [rate, setRate] = useState(t.countryDefault ?? 16);
  const [inclusive, setInclusive] = useState(t.inclusiveInPrice ?? false);
  const [showOnReceipt, setShowOnReceipt] = useState(t.receiptShowTax ?? true);

  return (
    <div className="wizard-step-form">
      <p className="wizard-hint">
        Configura el impuesto principal de tu país. En México el IVA es del 16% y generalmente está incluido en el precio.
      </p>
      <label>Nombre del impuesto
        <input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="IVA" />
      </label>
      <label>Tasa (%)
        <input type="number" min={0} max={100} step={0.5} value={rate}
          onChange={(e) => setRate(Number(e.target.value))} />
      </label>
      <label className="wizard-toggle">
        <input type="checkbox" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} />
        <span>Precio incluye impuesto (precio final incluye IVA)</span>
      </label>
      <label className="wizard-toggle">
        <input type="checkbox" checked={showOnReceipt} onChange={(e) => setShowOnReceipt(e.target.checked)} />
        <span>Mostrar desglose de IVA en el ticket</span>
      </label>
      <div className="wizard-actions">
        <button className="wizard-btn-secondary" onClick={onBack}>← Atrás</button>
        <button className="wizard-btn-primary"
          onClick={() => onNext({ taxes: { taxName, countryDefault: rate, inclusiveInPrice: inclusive, receiptShowTax: showOnReceipt } })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
