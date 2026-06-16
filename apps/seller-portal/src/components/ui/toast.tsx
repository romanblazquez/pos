import { useState, useCallback, useEffect, createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const colors: Record<ToastType, string> = {
    success: 'bg-slate-900 text-white',
    error:   'bg-red-600 text-white',
    info:    'bg-slate-700 text-white',
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error:   '✕',
    info:    'i',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
                  transition-all duration-300 max-w-sm ${colors[toast.type]}
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold shrink-0">
        {icons[toast.type]}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-xs ml-1">✕</button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
