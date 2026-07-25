import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, API_BASE } from '../auth/api-client.js';

type AnalyticsTab = 'overview' | 'visitors' | 'search' | 'ux' | 'consent' | 'advertising';

async function getJson<T>(path: string): Promise<T> {
  const response = await adminApi.fetch(`${API_BASE}/api/v1/analytics/admin${path}`);
  if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
  return response.json() as Promise<T>;
}

interface Overview {
  range: { from: string; to: string };
  totals: { events: number; sessions: number; newVisitors: number; consentDecisions: number };
  eventTypes: { type: string; count: number }[];
  search: { total: number; zeroResults: number; zeroResultRate: number };
}

interface Visitor {
  id: string;
  accountPrincipalId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  linkedAt?: string;
  countryCode?: string;
  locale?: string;
  _count: { sessions: number; consentRecords: number };
}

interface JourneyEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  path?: string;
  entityType?: string;
  entityId?: string;
  sellerId?: string;
  offerId?: string;
  metadata?: Record<string, unknown>;
}

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'visitors', label: 'Visitantes' },
  { id: 'search', label: 'Búsquedas' },
  { id: 'ux', label: 'UX' },
  { id: 'consent', label: 'Consentimiento' },
  { id: 'advertising', label: 'Publicidad' },
];

export function AnalyticsView() {
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [days, setDays] = useState(30);
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const query = `?from=${encodeURIComponent(from)}`;
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visitor Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">Analítica propia, journeys, privacidad y atribución.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Periodo
          <select className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option>
          </select>
        </label>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm ${tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewPanel query={query} />}
      {tab === 'visitors' && <VisitorsPanel />}
      {tab === 'search' && <SearchPanel query={query} />}
      {tab === 'ux' && <EventPanel query={query} title="Diagnóstico UX" filters={['web_vital', 'client_error']} />}
      {tab === 'consent' && <ConsentPanel query={query} />}
      {tab === 'advertising' && <EventPanel query={query} title="Publicidad y afiliación" filters={['affiliate_click', 'ad_impression', 'ad_click']} />}
    </div>
  );
}

function OverviewPanel({ query }: { query: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-overview', query],
    queryFn: () => getJson<Overview>(`/overview${query}`),
  });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorPanel />;
  const cards = [
    ['Eventos', data.totals.events], ['Sesiones', data.totals.sessions],
    ['Visitantes nuevos', data.totals.newVisitors], ['Decisiones de consentimiento', data.totals.consentDecisions],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{Number(value).toLocaleString('es')}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Eventos principales</h2>
          <div className="mt-3 space-y-2">{data.eventTypes.map((row) => (
            <div key={row.type} className="flex items-center justify-between text-sm">
              <code className="text-slate-600">{row.type}</code><strong>{row.count.toLocaleString('es')}</strong>
            </div>
          ))}</div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Salud de búsquedas</h2>
          <p className="mt-4 text-4xl font-bold">{(data.search.zeroResultRate * 100).toFixed(1)}%</p>
          <p className="text-sm text-slate-500">sin resultados ({data.search.zeroResults} de {data.search.total})</p>
        </section>
      </div>
    </>
  );
}

function VisitorsPanel() {
  const [selected, setSelected] = useState<string>();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-visitors'],
    queryFn: () => getJson<Visitor[]>('/visitors?limit=100'),
  });
  const journey = useQuery({
    queryKey: ['analytics-journey', selected],
    queryFn: () => getJson<JourneyEvent[]>(`/visitors/${selected}/journey?limit=200`),
    enabled: Boolean(selected),
  });
  if (isLoading) return <Loading />;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="p-3">Visitante</th><th className="p-3">Última actividad</th><th className="p-3">Sesiones</th><th className="p-3">Cuenta</th>
          </tr></thead>
          <tbody>{(data ?? []).map((visitor) => (
            <tr key={visitor.id} onClick={() => setSelected(visitor.id)}
              className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${selected === visitor.id ? 'bg-amber-50' : ''}`}>
              <td className="p-3 font-mono text-xs">{visitor.id.slice(0, 12)}…</td>
              <td className="p-3">{new Date(visitor.lastSeenAt).toLocaleString('es')}</td>
              <td className="p-3">{visitor._count.sessions}</td>
              <td className="p-3">{visitor.accountPrincipalId ? 'Vinculada' : 'Anónimo'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Journey</h2>
          {selected && <button type="button" className="rounded-lg border px-3 py-1.5 text-xs"
            onClick={() => {
              void getJson<unknown>(`/visitors/${selected}/export`).then((payload) => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url; link.download = `visitor-${selected}.json`; link.click();
                URL.revokeObjectURL(url);
              });
            }}>Exportar JSON</button>}
        </div>
        {!selected && <p className="mt-3 text-sm text-slate-500">Selecciona un visitante.</p>}
        {journey.isLoading && <Loading />}
        <ol className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
          {(journey.data ?? []).map((event) => (
            <li key={event.eventId} className="border-l-2 border-amber-400 pl-3">
              <div className="flex justify-between gap-3"><code className="text-xs font-semibold">{event.eventType}</code>
                <time className="text-[11px] text-slate-400">{new Date(event.occurredAt).toLocaleString('es')}</time></div>
              <p className="mt-1 break-all text-xs text-slate-600">{event.path ?? event.entityId ?? '—'}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function SearchPanel({ query }: { query: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-search', query],
    queryFn: () => getJson<{ query: string; count: number; zeroResults: number }[]>(`/search${query}`),
  });
  if (isLoading) return <Loading />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr><th className="p-3">Consulta</th><th className="p-3">Eventos</th><th className="p-3">Sin resultados</th></tr>
      </thead><tbody>{(data ?? []).map((row) => (
        <tr key={row.query} className="border-t"><td className="p-3">{row.query}</td><td className="p-3">{row.count}</td><td className="p-3">{row.zeroResults}</td></tr>
      ))}</tbody></table>
    </div>
  );
}

function ConsentPanel({ query }: { query: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-consent', query],
    queryFn: () => getJson<{ total: number; categories: Record<string, { granted: number; denied: number }> }>(`/consent${query}`),
  });
  if (isLoading) return <Loading />;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">Decisiones registradas: {data?.total ?? 0}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{Object.entries(data?.categories ?? {}).map(([key, counts]) => {
        const total = counts.granted + counts.denied;
        return <div key={key} className="rounded-lg border p-3"><div className="flex justify-between text-sm"><code>{key}</code>
          <strong>{total ? Math.round(counts.granted / total * 100) : 0}%</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${total ? counts.granted / total * 100 : 0}%` }} /></div>
        </div>;
      })}</div>
    </div>
  );
}

function EventPanel({ query, title, filters }: { query: string; title: string; filters: string[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-events-panel', query, filters],
    queryFn: () => getJson<Overview>(`/overview${query}`),
  });
  if (isLoading) return <Loading />;
  const rows = (data?.eventTypes ?? []).filter((row) => filters.includes(row.type));
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">{title}</h2>
    <div className="mt-4 space-y-3">{rows.length ? rows.map((row) =>
      <div key={row.type} className="flex justify-between"><code>{row.type}</code><strong>{row.count}</strong></div>)
      : <p className="text-sm text-slate-500">Sin eventos en este periodo.</p>}</div>
  </section>;
}

function Loading() { return <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Cargando analítica…</p>; }
function ErrorPanel() { return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">No se pudo cargar la analítica.</p>; }
