import type { StepProps } from '../OnboardingWizard.js';

export function StepFinish({ data, onNext }: StepProps) {
  const checks = [
    { label: 'Información del negocio', ok: !!data.businessInfo?.businessName },
    { label: 'Tienda configurada', ok: !!data.storeInfo?.storeName },
    { label: 'Proveedor de pagos', ok: data.connectedProviders.length > 0 },
    { label: 'Impuestos configurados', ok: !!data.taxes?.taxName },
  ];
  const allRequired = checks.every((c) => c.ok);

  return (
    <div className="wizard-step-form">
      <div className="wizard-finish-hero">
        <span className="wizard-finish-icon">🎉</span>
        <h2>{allRequired ? '¡Tu plataforma está lista!' : 'Casi listo'}</h2>
        <p>
          {allRequired
            ? 'Puedes empezar a cobrar con Retail OS. Explora el POS, configura tu inventario y gestiona tus clientes.'
            : 'Completa los pasos pendientes para activar todas las funciones.'}
        </p>
      </div>
      <div className="wizard-checks">
        {checks.map((c) => (
          <div key={c.label} className={`wizard-check${c.ok ? ' ok' : ' missing'}`}>
            <span>{c.ok ? '✓' : '✗'}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="wizard-actions">
        <button className="wizard-btn-primary" onClick={() => onNext()}>
          {allRequired ? 'Ir al POS' : 'Completar después'}
        </button>
      </div>
    </div>
  );
}
