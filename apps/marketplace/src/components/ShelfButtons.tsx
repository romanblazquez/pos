import { useIntl } from 'react-intl';
import { useShelf, type ShelfStatus } from '../context/ShelfContext.js';
import { SHELF_STATUS_META, SHELF_STATUS_ORDER } from '../shelf-meta.js';

const ACTIVE_CLASS = 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600';

export function ShelfButtons({ slug, name }: { slug: string; name: string }) {
  const intl = useIntl();
  const { getShelfStatus, setShelfStatus } = useShelf();
  const currentStatus = getShelfStatus(slug);

  function handleToggle(status: ShelfStatus) {
    if (currentStatus === status) {
      setShelfStatus(slug, name, null);
    } else {
      setShelfStatus(slug, name, status);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SHELF_STATUS_ORDER.map((status) => {
        const meta = SHELF_STATUS_META[status];
        const isActive = currentStatus === status;
        const icon = isActive ? (meta.activeIcon ?? meta.icon) : meta.icon;
        const label = intl.formatMessage({ id: meta.labelKey });
        return (
          <button
            key={status}
            onClick={() => handleToggle(status)}
            title={isActive ? intl.formatMessage({ id: 'shelf.remove' }, { label }) : intl.formatMessage({ id: 'shelf.add' }, { label })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all
              ${isActive
                ? ACTIVE_CLASS
                : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'
              }`}
          >
            <span>{icon}</span>
            <span className="font-mono text-xs">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
