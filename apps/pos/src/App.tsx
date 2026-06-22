import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCart } from './store/cart-store.js';
import { dataClient } from './platform/data-client.js';
import { isInShell } from './platform/bridge.js';
import { ProductGrid } from './components/ProductGrid.js';
import { CartPanel } from './components/CartPanel.js';
import { PaymentDialog } from './components/PaymentDialog.js';
import { Badge } from '@retail-os/ui-react';

export function App() {
  const init = useCart((s) => s.init);
  const ready = useCart((s) => s.ready);
  const terminal = useCart((s) => s.terminal);
  const sale = useCart((s) => s.sale);
  const newSale = useCart((s) => s.newSale);
  useCart((s) => s.rev);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        newSale();
      }
      if (event.key === 'F9' && sale && !sale.isEmpty) {
        event.preventDefault();
        setCharging(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newSale, sale]);

  // TanStack Query — poll the offline sync status for the status bar.
  const sync = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => dataClient.getSyncStatus(),
    refetchInterval: 4000,
  });

  if (!ready || !sale) {
    return (
      <div className="grid h-full place-items-center bg-background text-sm text-muted-foreground">
        Iniciando Retail OS POS…
      </div>
    );
  }

  return (
    <div className="grid h-full min-w-[720px] grid-rows-[56px_minmax(0,1fr)] bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b bg-card px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">◆</span>
          <div>
            <strong className="block text-sm leading-none">Retail OS</strong>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">POS</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-xs font-medium text-muted-foreground">
            {terminal?.storeId} · {terminal?.deviceId}
          </span>
          <SyncBadge
            online={sync.data?.online ?? false}
            pending={sync.data?.pending ?? 0}
            inShell={isInShell()}
          />
        </div>
      </header>

      <main className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(340px,390px)] gap-px bg-border">
        <ProductGrid />
        <CartPanel onCharge={() => setCharging(true)} />
      </main>

      {charging && (
        <PaymentDialog
          sale={sale}
          onClose={() => setCharging(false)}
          onCompleted={() => {
            setCharging(false);
            newSale();
            void sync.refetch();
          }}
        />
      )}
    </div>
  );
}

function SyncBadge({ online, pending, inShell }: { online: boolean; pending: number; inShell: boolean }) {
  const label = !inShell ? 'Navegador (memoria)' : online ? 'En línea' : 'Offline';
  const variant = !inShell ? 'secondary' : online ? 'success' : 'warning';
  return (
    <Badge variant={variant} className="h-7 gap-2 rounded-full px-3">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
      {pending > 0 && <span>· {pending} por sincronizar</span>}
    </Badge>
  );
}
