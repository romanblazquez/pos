import {
  Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardDescription,
  CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@retail-os/ui-react';
import { Database, ShieldAlert } from 'lucide-react';

type Status = 'Activo' | 'Propuesto' | 'Bloqueado';

interface DataField {
  group: string;
  field: string;
  example: string;
  purpose: string;
  source: string;
  basis: string;
  retention: string;
  status: Status;
}

const FIELDS: DataField[] = [
  { group: 'Identidad', field: 'ID anónimo (HMAC)', example: 'v_7c2…', purpose: 'Sesiones y journey', source: 'Cookie propia', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Identidad', field: 'ID de sesión (HMAC)', example: 's_a91…', purpose: 'Agrupar eventos', source: 'Browser SDK', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Identidad', field: 'ID de cuenta', example: 'principal_…', purpose: 'Vincular tras login', source: 'Autenticación', basis: 'Servicio solicitado', retention: 'Hasta borrado', status: 'Activo' },
  { group: 'Identidad', field: 'Correo / teléfono', example: 'usuario@… / +34…', purpose: 'Resolución de identidad', source: 'Cuenta', basis: 'Revisión DPO', retention: 'Por definir', status: 'Bloqueado' },
  { group: 'Red', field: 'País', example: 'ES', purpose: 'Mercado y cumplimiento regional', source: 'Cabecera CDN', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Red', field: 'Región', example: 'MD', purpose: 'Rendimiento regional', source: 'Cabecera CDN', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Red', field: 'Dirección IP completa', example: '203.0.113.42', purpose: 'Geolocalización, fraude y diagnóstico', source: 'Conexión HTTP', basis: 'Requiere evaluación y minimización', retention: 'Por definir', status: 'Propuesto' },
  { group: 'Red', field: 'Ciudad / coordenadas', example: 'Madrid / 40.41,-3.70', purpose: 'Análisis geográfico preciso', source: 'Proveedor GeoIP o permiso GPS', basis: 'Consentimiento / revisión DPO', retention: 'Por definir', status: 'Propuesto' },
  { group: 'Dispositivo', field: 'Clase de dispositivo', example: 'mobile', purpose: 'UX responsive', source: 'User-Agent reducido', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Dispositivo', field: 'Familia de navegador', example: 'Chrome', purpose: 'Compatibilidad', source: 'User-Agent reducido', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Dispositivo', field: 'Sistema operativo', example: 'Android', purpose: 'Compatibilidad', source: 'User-Agent reducido', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Dispositivo', field: 'User-Agent completo', example: 'Mozilla/5.0 (…) Chrome/…', purpose: 'Diagnóstico de versión exacta', source: 'Cabecera HTTP', basis: 'Requiere evaluación de fingerprinting', retention: 'Por definir', status: 'Propuesto' },
  { group: 'Dispositivo', field: 'Viewport y zona horaria', example: '390×844 / Europe/Madrid', purpose: 'UX y localización', source: 'Browser SDK', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Journey', field: 'Página y ruta', example: '/es/juegos-de-mesa/catan', purpose: 'Navegación y embudos', source: 'Browser SDK', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Journey', field: 'Host de referencia', example: 'google.com', purpose: 'Adquisición', source: 'Referrer reducido', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Journey', field: 'Evento y fecha', example: 'game_viewed · 12:42:08', purpose: 'Timeline', source: 'Browser SDK', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Journey', field: 'Juego, categoría y guía', example: 'catan / strategy', purpose: 'Interés de catálogo', source: 'Instrumentación', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Búsqueda', field: 'Consulta normal completa', example: 'juego cooperativo para dos', purpose: 'Search intelligence', source: 'Buscador', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Búsqueda', field: 'Entrada sensible detectada', example: 'correo, teléfono, tarjeta, texto largo', purpose: 'Evitar PII accidental', source: 'Validador del colector', basis: 'No almacenar contenido', retention: 'Solo métrica agregada', status: 'Bloqueado' },
  { group: 'Comercio', field: 'Oferta, vendedor y posición', example: 'offer_… / seller_… / 2', purpose: 'Conversión y ranking', source: 'Instrumentación', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Comercio', field: 'Precio y moneda', example: '89900 MXN minor units', purpose: 'Rendimiento comercial', source: 'Catálogo', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'Atribución', field: 'UTM source/medium/campaign', example: 'newsletter / email / verano', purpose: 'Atribución', source: 'Landing URL', basis: 'Analítica/marketing', retention: 'Ventana + 395 días', status: 'Activo' },
  { group: 'Atribución', field: 'Click ID publicitario', example: 'gclid / wbraid / gbraid', purpose: 'Ads y conversiones', source: 'Landing URL', basis: 'Marketing', retention: 'Por definir', status: 'Propuesto' },
  { group: 'Atribución', field: 'Clic afiliado y destino', example: 'partner / amazon.es', purpose: 'Ingresos afiliados', source: 'Redirect propio', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'UX', field: 'Web Vitals', example: 'LCP 1,820 ms · good', purpose: 'Rendimiento', source: 'Browser SDK', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'UX', field: 'Error cliente clasificado', example: 'TypeError / ProductCard / non-fatal', purpose: 'Fiabilidad', source: 'Error boundary', basis: 'Analítica', retention: '395 días', status: 'Activo' },
  { group: 'UX', field: 'Stack trace completo', example: 'at component (…) + URL', purpose: 'Diagnóstico exacto', source: 'Browser', basis: 'Requiere scrubber y revisión DPO', retention: 'Por definir', status: 'Propuesto' },
  { group: 'Preferencias', field: 'Preferencia explícita', example: 'players=2 / complexity=light', purpose: 'Personalización', source: 'Usuario', basis: 'Personalización', retention: 'Hasta retirada/expiración', status: 'Activo' },
  { group: 'Publicidad', field: 'Impresión, clic y placement', example: 'gam_hero_01 / non_personalized', purpose: 'Rendimiento publicitario', source: 'Adaptador de ads', basis: 'Marketing', retention: '395 días', status: 'Activo' },
  { group: 'Publicidad', field: 'ID de advertising del dispositivo', example: 'GAID / IDFA', purpose: 'Personalización cross-app', source: 'Plataforma', basis: 'Consentimiento explícito y revisión DPO', retention: 'Por definir', status: 'Bloqueado' },
  { group: 'Consentimiento', field: 'Decisiones y versión de política', example: 'analytics=true · policy 1.0', purpose: 'Prueba de consentimiento', source: 'CMP', basis: 'Obligación legal', retention: '2.190 días', status: 'Activo' },
];

const variant: Record<Status, 'default' | 'secondary' | 'destructive'> = {
  Activo: 'default',
  Propuesto: 'secondary',
  Bloqueado: 'destructive',
};

export function GovernanceCatalog() {
  const counts = FIELDS.reduce<Record<Status, number>>((acc, row) => {
    acc[row.status] += 1;
    return acc;
  }, { Activo: 0, Propuesto: 0, Bloqueado: 0 });

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertTitle>Catálogo completo para PO y Data Governance</AlertTitle>
        <AlertDescription>
          Esta tabla no oculta capacidades: muestra lo que se recopila hoy y lo que técnicamente se podría recopilar.
          “Propuesto” y “Bloqueado” son especificaciones para revisión; no indican que esos valores ya estén almacenados.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.entries(counts) as [Status, number][]).map(([status, count]) => (
          <Card key={status} className="gap-2 py-4">
            <CardHeader className="px-5"><CardDescription>{status}</CardDescription></CardHeader>
            <CardContent className="flex items-center justify-between px-5">
              <span className="font-display text-3xl font-bold">{count}</span>
              <Badge variant={variant[status]}>{status === 'Activo' ? 'Se almacena' : 'Pendiente'}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b py-5">
          <div className="flex items-center gap-2"><Database className="size-5 text-primary" /><CardTitle>Inventario de datos</CardTitle></div>
          <CardDescription>Campo, ejemplo sintético, finalidad, origen, base de tratamiento y retención.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Área</TableHead><TableHead>Dato</TableHead><TableHead>Ejemplo</TableHead>
              <TableHead>Finalidad</TableHead><TableHead>Origen</TableHead><TableHead>Base</TableHead>
              <TableHead>Retención</TableHead><TableHead>Estado</TableHead>
            </TableRow></TableHeader>
            <TableBody>{FIELDS.map((row) => (
              <TableRow key={`${row.group}-${row.field}`}>
                <TableCell><Badge variant="outline">{row.group}</Badge></TableCell>
                <TableCell className="min-w-48 font-medium">{row.field}</TableCell>
                <TableCell className="min-w-48 font-mono text-xs text-muted-foreground">{row.example}</TableCell>
                <TableCell className="min-w-48 text-sm">{row.purpose}</TableCell>
                <TableCell className="min-w-36 text-sm">{row.source}</TableCell>
                <TableCell className="min-w-48 text-sm">{row.basis}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{row.retention}</TableCell>
                <TableCell><Badge variant={variant[row.status]}>{row.status}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
