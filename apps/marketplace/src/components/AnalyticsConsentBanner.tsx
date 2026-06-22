import { useState } from 'react';
import {
  analyticsConfigured,
  getAnalyticsConsent,
  updateAnalyticsConsent,
} from '../analytics.js';
import { Button } from './ui/index.js';

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(
    () => analyticsConfigured() && getAnalyticsConsent() === null,
  );

  if (!visible) return null;

  function choose(consent: 'granted' | 'denied') {
    updateAnalyticsConsent(consent);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-xl border border-[--border] bg-[--bg-raised] p-4 shadow-2xl sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[--tx]">Ayúdanos a mejorar Juegospedia</p>
        <p className="mt-1 text-xs leading-5 text-[--tx-muted]">
          Usamos Google Analytics para entender búsquedas, filtros y compras. No activamos
          publicidad personalizada y puedes rechazar la medición.
        </p>
      </div>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <Button variant="outline" size="sm" onClick={() => choose('denied')}>
          Rechazar
        </Button>
        <Button size="sm" onClick={() => choose('granted')}>
          Aceptar analítica
        </Button>
      </div>
    </div>
  );
}
