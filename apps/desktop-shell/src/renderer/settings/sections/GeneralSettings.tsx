import { useState } from 'react';

export function GeneralSettings() {
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [country, setCountry] = useState('MX');
  const [currency, setCurrency] = useState('MXN');
  const [timezone, setTimezone] = useState('America/Mexico_City');

  return (
    <div className="settings-form">
      <section className="settings-section-group">
        <h2>Información del negocio</h2>
        <label>
          Nombre comercial
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Mi Tienda" />
        </label>
        <label>
          Razón social
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Mi Tienda S.A. de C.V." />
        </label>
        <label>
          RFC / ID Fiscal
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="XAXX010101000" />
        </label>
      </section>
      <section className="settings-section-group">
        <h2>Localización</h2>
        <label>
          País
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="MX">México</option>
            <option value="AR">Argentina</option>
            <option value="CL">Chile</option>
            <option value="CO">Colombia</option>
            <option value="BR">Brasil</option>
          </select>
        </label>
        <label>
          Moneda
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="MXN">Peso Mexicano (MXN)</option>
            <option value="ARS">Peso Argentino (ARS)</option>
            <option value="CLP">Peso Chileno (CLP)</option>
            <option value="COP">Peso Colombiano (COP)</option>
            <option value="BRL">Real Brasileño (BRL)</option>
          </select>
        </label>
        <label>
          Zona horaria
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="America/Mexico_City">México (GMT-6)</option>
            <option value="America/Monterrey">Monterrey (GMT-6)</option>
            <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
            <option value="America/Santiago">Santiago (GMT-4)</option>
            <option value="America/Bogota">Bogotá (GMT-5)</option>
          </select>
        </label>
      </section>
      <div className="settings-actions">
        <button className="settings-btn-primary" onClick={() => {/* TODO: persist via IPC */}}>
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
