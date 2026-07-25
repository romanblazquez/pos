'use client';

import * as React from 'react';
import {
  ANALYTICS_CONSENT_EVENT, applyDecisions, grantAll, hasDecided, withdrawAll,
  type BrowserAnalytics, type ConsentDecisions,
} from '@retail-os/analytics-contracts';

export function ConsentBanner({
  analytics,
  locale = 'es',
}: {
  analytics: BrowserAnalytics;
  locale?: 'es' | 'en';
}) {
  const [open, setOpen] = React.useState(() => !hasDecided(analytics.getConsent()));
  const [details, setDetails] = React.useState(false);
  const [decisions, setDecisions] = React.useState<ConsentDecisions>(analytics.getConsent().decisions);
  const es = locale === 'es';

  React.useEffect(() => {
    const show = () => {
      setDecisions(analytics.getConsent().decisions);
      setOpen(true);
      setDetails(true);
    };
    window.addEventListener('juegospedia:open-privacy', show);
    return () => window.removeEventListener('juegospedia:open-privacy', show);
  }, [analytics]);

  if (!open) return null;
  const save = (next: ConsentDecisions) => {
    void analytics.setConsent(applyDecisions(analytics.getConsent(), next, 'explicit'));
    setOpen(false);
  };
  const labels: [(Exclude<keyof ConsentDecisions, 'necessary' | 'sessionReplay'> & string), string][] = [
    ['functional', es ? 'Funcionalidad' : 'Functionality'],
    ['analytics', es ? 'Analítica de uso' : 'Usage analytics'],
    ['uxDiagnostics', es ? 'Diagnóstico de experiencia' : 'UX diagnostics'],
    ['personalization', es ? 'Personalización' : 'Personalization'],
    ['advertisingStorage', es ? 'Almacenamiento publicitario' : 'Advertising storage'],
    ['advertisingUserData', es ? 'Datos para publicidad' : 'Advertising user data'],
    ['advertisingPersonalization', es ? 'Publicidad personalizada' : 'Personalized advertising'],
  ];

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-2xl"
      style={{
        position: 'fixed', left: '0.75rem', right: '0.75rem', bottom: '0.75rem',
        zIndex: 100, maxWidth: '42rem', marginInline: 'auto',
      }}
      role="dialog" aria-modal="false" aria-label={es ? 'Privacidad' : 'Privacy'}>
      <h2 className="font-display text-lg font-bold">{es ? 'Tu privacidad, tus reglas' : 'Your privacy, your rules'}</h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {es
          ? 'Usamos analítica propia para mejorar Juegospedia. Lo opcional permanece apagado hasta que tú lo aceptes.'
          : 'We use first-party analytics to improve Juegospedia. Optional uses stay off until you accept them.'}
      </p>
      {details && (
        <div className="mt-4 max-h-60 space-y-3 overflow-y-auto rounded-xl bg-[var(--muted)] p-3">
          <div className="flex items-center justify-between text-sm"><span>{es ? 'Necesario' : 'Necessary'}</span><span>{es ? 'Siempre activo' : 'Always on'}</span></div>
          {labels.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <input type="checkbox" checked={decisions[key]}
                onChange={(event) => setDecisions({ ...decisions, [key]: event.target.checked })}
                className="h-5 w-5 accent-[var(--primary)]" />
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
          onClick={() => save(grantAll())}>{es ? 'Aceptar opcionales' : 'Accept optional'}</button>
        <button type="button" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          onClick={() => { void analytics.setConsent(withdrawAll(analytics.getConsent())); setOpen(false); }}>
          {es ? 'Solo necesarias' : 'Necessary only'}
        </button>
        <button type="button" className="px-3 py-2 text-sm underline"
          onClick={() => details ? save(decisions) : setDetails(true)}>
          {details ? (es ? 'Guardar preferencias' : 'Save preferences') : (es ? 'Configurar' : 'Manage')}
        </button>
      </div>
    </section>
  );
}

export function openPrivacyPreferences(): void {
  window.dispatchEvent(new Event('juegospedia:open-privacy'));
}

export { ANALYTICS_CONSENT_EVENT };
