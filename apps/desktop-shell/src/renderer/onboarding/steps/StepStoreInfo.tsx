import { useState } from 'react';
import type { StepProps } from '../OnboardingWizard.js';

export function StepStoreInfo({ data, onNext, onBack }: StepProps) {
  const info = data.storeInfo ?? {};
  const [storeName, setStoreName] = useState(info.storeName ?? '');
  const [address, setAddress] = useState(info.storeAddress ?? '');
  const [storeType, setStoreType] = useState<'retail' | 'food_beverage' | 'services' | 'other'>(info.storeType ?? 'retail');
  const [stations, setStations] = useState(info.numberOfStations ?? 1);
  const canContinue = storeName.trim().length >= 2;

  return (
    <div className="wizard-step-form">
      <label>Nombre de la tienda *
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Tienda Centro" />
      </label>
      <label>Dirección
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Principal 123, Col. Centro, CDMX" />
      </label>
      <label>Tipo de negocio
        <select value={storeType} onChange={(e) => setStoreType(e.target.value as typeof storeType)}>
          <option value="retail">Venta al detalle</option>
          <option value="food_beverage">Alimentos y bebidas</option>
          <option value="services">Servicios</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label>Número de estaciones POS
        <input type="number" min={1} max={50} value={stations}
          onChange={(e) => setStations(Number(e.target.value))} />
      </label>
      <div className="wizard-actions">
        <button className="wizard-btn-secondary" onClick={onBack}>← Atrás</button>
        <button className="wizard-btn-primary" disabled={!canContinue}
          onClick={() => onNext({ storeInfo: { storeName, storeAddress: address, storeType, numberOfStations: stations } })}>
          Continuar →
        </button>
      </div>
    </div>
  );
}
