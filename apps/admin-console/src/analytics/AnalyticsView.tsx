import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, AlertDescription, AlertTitle, Badge, Button,
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@retail-os/ui-react';
import { AlertCircle, BarChart3, Download, Search, ShieldCheck, Users } from 'lucide-react';
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
  regionCode?: string;
  locale?: string;
  sessions: { deviceClass?: string; browserFamily?: string; osFamily?: string }[];
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
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><BarChart3 className="size-5" /><Badge variant="outline">First-party</Badge></div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Visitor Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analítica propia, journeys, privacidad y atribución.</p>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Periodo</span>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger aria-label="Periodo" className="w-36 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as AnalyticsTab)}>
        <TabsList className="w-full justify-start overflow-x-auto bg-card">
          {TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><OverviewPanel query={query} /></TabsContent>
        <TabsContent value="visitors"><VisitorsPanel /></TabsContent>
        <TabsContent value="search"><SearchPanel query={query} /></TabsContent>
        <TabsContent value="ux"><EventPanel query={query} title="Diagnóstico UX" filters={['web_vital', 'client_error']} /></TabsContent>
        <TabsContent value="consent"><ConsentPanel query={query} /></TabsContent>
        <TabsContent value="advertising"><EventPanel query={query} title="Publicidad y afiliación" filters={['affiliate_click', 'ad_impression', 'ad_click']} /></TabsContent>
      </Tabs>
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
          <Card key={label} className="gap-2 py-5">
            <CardHeader className="px-5"><CardDescription className="text-xs font-semibold uppercase tracking-wide">{label}</CardDescription></CardHeader>
            <CardContent className="px-5"><p className="font-display text-3xl font-bold">{Number(value).toLocaleString('es')}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Eventos principales</CardTitle><CardDescription>Actividad capturada por el colector propio.</CardDescription></CardHeader>
          <CardContent className="space-y-2">{data.eventTypes.map((row) => (
            <div key={row.type} className="flex items-center justify-between text-sm">
              <code className="text-muted-foreground">{row.type}</code><Badge variant="secondary">{row.count.toLocaleString('es')}</Badge>
            </div>
          ))}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Salud de búsquedas</CardTitle><CardDescription>Consultas que no encontraron ningún juego.</CardDescription></CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-bold">{(data.search.zeroResultRate * 100).toFixed(1)}%</p>
            <p className="mt-1 text-sm text-muted-foreground">sin resultados ({data.search.zeroResults} de {data.search.total})</p>
            <Progress className="mt-4" value={data.search.zeroResultRate * 100} />
          </CardContent>
        </Card>
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
      <Card className="overflow-hidden py-0"><Table>
        <TableHeader><TableRow>
          <TableHead>Visitante</TableHead><TableHead>Ubicación</TableHead><TableHead>Dispositivo</TableHead><TableHead>Última actividad</TableHead><TableHead>Sesiones</TableHead><TableHead>Cuenta</TableHead>
        </TableRow></TableHeader>
        <TableBody>{(data ?? []).map((visitor) => (
          <TableRow key={visitor.id} onClick={() => setSelected(visitor.id)}
            data-state={selected === visitor.id ? 'selected' : undefined} className="cursor-pointer">
            <TableCell className="font-mono text-xs">{visitor.id.slice(0, 12)}…</TableCell>
            <TableCell>{visitor.countryCode
              ? <Badge variant="outline">{[visitor.regionCode, visitor.countryCode].filter(Boolean).join(' · ')}</Badge>
              : <span className="text-muted-foreground">No disponible</span>}</TableCell>
            <TableCell>
              <div className="text-xs font-medium">{visitor.sessions[0]?.deviceClass ?? 'Desconocido'}</div>
              <div className="text-xs text-muted-foreground">{[visitor.sessions[0]?.browserFamily, visitor.sessions[0]?.osFamily].filter(Boolean).join(' · ') || '—'}</div>
            </TableCell>
            <TableCell>{new Date(visitor.lastSeenAt).toLocaleString('es')}</TableCell>
            <TableCell><Badge variant="secondary">{visitor._count.sessions}</Badge></TableCell>
            <TableCell><Badge variant={visitor.accountPrincipalId ? 'default' : 'outline'}>{visitor.accountPrincipalId ? 'Vinculada' : 'Anónimo'}</Badge></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></Card>
      <Card className="gap-4">
        <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div><CardTitle>Journey</CardTitle><CardDescription>Secuencia cronológica del visitante.</CardDescription></div>
          {selected && <Button type="button" variant="outline" size="sm"
            onClick={() => {
              void getJson<unknown>(`/visitors/${selected}/export`).then((payload) => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url; link.download = `visitor-${selected}.json`; link.click();
                URL.revokeObjectURL(url);
              });
            }}><Download className="size-4" />Exportar JSON</Button>}
        </div>
        </CardHeader>
        <CardContent>
        {!selected && <p className="text-sm text-muted-foreground">Selecciona un visitante.</p>}
        {journey.isLoading && <Loading />}
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto">
          {(journey.data ?? []).map((event) => (
            <li key={event.eventId} className="border-l-2 border-primary pl-3">
              <div className="flex justify-between gap-3"><code className="text-xs font-semibold">{event.eventType}</code>
                <time className="text-[11px] text-muted-foreground">{new Date(event.occurredAt).toLocaleString('es')}</time></div>
              <p className="mt-1 break-all text-xs text-muted-foreground">{event.path ?? event.entityId ?? '—'}</p>
            </li>
          ))}
        </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function SearchPanel({ query }: { query: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-search', query],
    queryFn: () => getJson<{ query: string | null; protected: boolean; protectedReason?: string; count: number; zeroResults: number }[]>(`/search${query}`),
  });
  if (isLoading) return <Loading />;
  const protectedCount = (data ?? []).filter((row) => row.protected).reduce((total, row) => total + row.count, 0);
  return (
    <div className="space-y-4">
      {protectedCount > 0 && <Alert><ShieldCheck className="size-4" /><AlertTitle>{protectedCount} entradas privadas protegidas</AlertTitle>
        <AlertDescription>Se cuentan para las métricas, pero el texto sensible nunca se almacena. Las búsquedas normales aparecen completas.</AlertDescription>
      </Alert>}
      <Card className="overflow-hidden py-0"><Table>
        <TableHeader><TableRow><TableHead>Consulta</TableHead><TableHead>Eventos</TableHead><TableHead>Sin resultados</TableHead></TableRow></TableHeader>
        <TableBody>{(data ?? []).map((row, index) => (
          <TableRow key={`${row.query ?? row.protectedReason}-${index}`}>
            <TableCell>{row.protected
              ? <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><Badge variant="outline">Entrada privada · {protectedReasonLabel(row.protectedReason)}</Badge></span>
              : <span className="flex items-center gap-2"><Search className="size-4 text-muted-foreground" />{row.query}</span>}</TableCell>
            <TableCell>{row.count}</TableCell><TableCell>{row.zeroResults}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></Card>
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
    <Card>
      <CardHeader><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><CardTitle>Decisiones registradas: {data?.total ?? 0}</CardTitle></div>
        <CardDescription>Porcentaje de concesión por finalidad.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">{Object.entries(data?.categories ?? {}).map(([key, counts]) => {
        const total = counts.granted + counts.denied;
        const percentage = total ? Math.round(counts.granted / total * 100) : 0;
        return <Card key={key} className="gap-3 p-4"><div className="flex justify-between text-sm"><code>{key}</code>
          <Badge variant="secondary">{percentage}%</Badge></div>
          <Progress value={percentage} />
        </Card>;
      })}</CardContent>
    </Card>
  );
}

function EventPanel({ query, title, filters }: { query: string; title: string; filters: string[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-events-panel', query, filters],
    queryFn: () => getJson<Overview>(`/overview${query}`),
  });
  if (isLoading) return <Loading />;
  const rows = (data?.eventTypes ?? []).filter((row) => filters.includes(row.type));
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Eventos observados durante el periodo seleccionado.</CardDescription></CardHeader>
    <CardContent className="space-y-3">{rows.length ? rows.map((row) =>
      <div key={row.type} className="flex justify-between"><code>{row.type}</code><Badge variant="secondary">{row.count}</Badge></div>)
      : <p className="text-sm text-muted-foreground">Sin eventos en este periodo.</p>}</CardContent>
  </Card>;
}

function protectedReasonLabel(reason?: string) {
  const labels: Record<string, string> = {
    email: 'correo',
    phone: 'teléfono',
    'credit-card': 'número de pago',
    'numeric-run': 'número largo',
    'too-long': 'texto demasiado largo',
    'sensitive-input': 'dato sensible',
  };
  return labels[reason ?? 'sensitive-input'] ?? 'dato sensible';
}

function Loading() {
  return <Card><CardContent className="space-y-3 py-6">
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />Cargando analítica…</div>
    <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" />
  </CardContent></Card>;
}

function ErrorPanel() {
  return <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>No se pudo cargar la analítica</AlertTitle>
    <AlertDescription>Comprueba la conexión con la API e inténtalo de nuevo.</AlertDescription>
  </Alert>;
}
