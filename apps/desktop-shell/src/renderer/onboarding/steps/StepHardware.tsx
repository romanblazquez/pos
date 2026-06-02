import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';

export function StepHardware({ data, onNext, onBack, onSkip }: StepProps) {
  const hw = data.hardware ?? {};
  const [barcode, setBarcode] = useState(hw.barcodeScanner ?? false);
  const [printer, setPrinter] = useState(hw.receiptPrinter ?? false);
  const [cashDrawer, setCashDrawer] = useState(hw.cashDrawer ?? false);
  const [display, setDisplay] = useState(hw.customerDisplay ?? false);

  return (
    <div className="wizard-step-form">
      <p className="wizard-hint">Indica qué hardware tienes conectado. Puedes cambiar esto después.</p>
      {[
        { label: '📷 Escáner de código de barras', val: barcode, set: setBarcode },
        { label: '🖨️ Impresora de tickets', val: printer, set: setPrinter },
        { label: '💰 Cajón de efectivo', val: cashDrawer, set: setCashDrawer },
        { label: '🖥️ Pantalla para cliente', val: display, set: setDisplay },
      ].map(({ label, val, set }) => (
        <label key={label} className="wizard-toggle">
          <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} />
          <span>{label}</span>
        </label>
      ))}
      <div className="wizard-actions">
        <button className="wizard-btn-secondary" onClick={onBack}>← Atrás</button>
        <button className="wizard-btn-secondary" onClick={onSkip}>Omitir</button>
        <button className="wizard-btn-primary"
          onClick={() => onNext({ hardware: { barcodeScanner: barcode, receiptPrinter: printer, cashDrawer, customerDisplay: display, extra: {} } })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
