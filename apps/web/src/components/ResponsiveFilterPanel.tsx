'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export function ResponsiveFilterPanel({ children, locale, activeCount }: {
  children: ReactNode;
  locale: 'es' | 'en';
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = locale === 'es'
    ? { open: 'Abrir filtros', title: 'Filtros', close: 'Cerrar filtros', apply: 'Ver resultados' }
    : { open: 'Open filters', title: 'Filters', close: 'Close filters', apply: 'View results' };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const applyFilters = () => {
    const form = modalRef.current?.closest('form');
    if (!form) return;
    setOpen(false);
    form.requestSubmit();
  };

  return (
    <div className="responsive-filter-panel">
      <button
        ref={triggerRef}
        type="button"
        className="mobile-filter-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span>{t.title}</span>
        {activeCount > 0 && <span className="mobile-filter-count">{activeCount}</span>}
      </button>

      {/* Scrim stays a plain sibling rather than a portal (see MobileMenu): the
          panel must remain inside the <form> for the no-JS GET submit to work,
          and a fixed sibling escapes the layout just as well. */}
      {open && <div className="mobile-filter-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}

      <div
        ref={modalRef}
        className={`mobile-filter-modal${open ? ' is-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label={t.open}
      >
        <header className="mobile-filter-header">
          <span><SlidersHorizontal size={18} aria-hidden="true" /><b>{t.title}</b></span>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t.close}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className="mobile-filter-scroll">{children}</div>
        <footer className="mobile-filter-footer">
          <button type="button" className="mobile-filter-apply" onClick={applyFilters}>{t.apply}</button>
        </footer>
      </div>
    </div>
  );
}
