import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCart } from './store/cart-store.js';
import { dataClient } from './platform/data-client.js';
import { isInShell } from './platform/bridge.js';
import { ProductGrid } from './components/ProductGrid.js';
import { CartPanel } from './components/CartPanel.js';
import { PaymentDialog } from './components/PaymentDialog.js';

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
    return <div className="boot">Iniciando Retail OS POS…</div>;
  }

  return (
    <div className="pos">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <strong>Retail OS</strong>
            <span className="tag">POS</span>
          </div>
        </div>
        <div className="meta">
          <span className="store">
            {terminal?.storeId} · {terminal?.deviceId}
          </span>
          <SyncBadge
            online={sync.data?.online ?? false}
            pending={sync.data?.pending ?? 0}
            inShell={isInShell()}
          />
        </div>
      </header>

      <main className="workspace">
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
  const cls = !inShell ? 'browser' : online ? 'online' : 'offline';
  return (
    <span className={`sync-badge ${cls}`}>
      <span className="dot" /> {label}
      {pending > 0 && <span className="pending">· {pending} por sincronizar</span>}
    </span>
  );
}
