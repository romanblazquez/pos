import { useShelf, type ShelfStatus } from '../context/ShelfContext.js';

interface ShelfAction {
  status: ShelfStatus;
  label: string;
  icon: string;
  activeClass: string;
}

const ACTIONS: ShelfAction[] = [
  { status: 'wishlist', label: 'Wishlist', icon: '♡', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600' },
  { status: 'owned', label: 'Tengo', icon: '📦', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600' },
  { status: 'want-to-play', label: 'Jugado', icon: '🎲', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600' },
  { status: 'for-trade', label: 'Trade', icon: '🔄', activeClass: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-600' },
];

const ACTIVE_ICONS: Partial<Record<ShelfStatus & string, string>> = {
  wishlist: '♥',
  owned: '📦',
  'want-to-play': '🎲',
  'for-trade': '🔄',
};

export function ShelfButtons({ slug, name }: { slug: string; name: string }) {
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
      {ACTIONS.map((action) => {
        const isActive = currentStatus === action.status;
        const icon = isActive && action.status ? (ACTIVE_ICONS[action.status] ?? action.icon) : action.icon;
        return (
          <button
            key={action.status}
            onClick={() => handleToggle(action.status)}
            title={isActive ? `Quitar de ${action.label}` : `Agregar a ${action.label}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all
              ${isActive
                ? action.activeClass
                : 'border-[--border] bg-[--bg-subtle] text-[--tx-muted] hover:bg-[--bg-hover] hover:text-[--tx]'
              }`}
          >
            <span>{icon}</span>
            <span className="font-mono text-xs">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
