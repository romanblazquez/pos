import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';

export function StepImportProducts({ onNext, onBack, onSkip }: StepProps) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    // TODO: parse CSV/XLSX and call the products API
    setTimeout(() => { setImporting(false); setDone(true); }, 1500);
  }

  return (
    <div className="wizard-step-form">
      <p className="wizard-hint">
        Importa tu catálogo de productos desde un archivo CSV o Excel. También puedes empezar con el catálogo de demo
        y agregar productos manualmente después.
      </p>
      {done ? (
        <div className="wizard-success-msg">✓ Catálogo importado correctamente</div>
      ) : (
        <div className="import-drop-area">
          <span className="import-icon">📄</span>
          <p>Arrastra un CSV/Excel o haz clic para seleccionar</p>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} id="import-file" />
          <label htmlFor="import-file" className="wizard-btn-secondary" style={{ cursor: 'pointer' }}>
            {importing ? 'Importando…' : 'Seleccionar archivo'}
          </label>
        </div>
      )}
      <div className="wizard-actions">
        <button className="wizard-btn-secondary" onClick={onBack}>← Atrás</button>
        <button className="wizard-btn-secondary" onClick={onSkip}>Omitir</button>
        <button className="wizard-btn-primary" onClick={() => onNext({ importCompleted: done })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
