'use client';

import * as React from 'react';
import { cn } from '../lib/utils.js';

export interface FilterSheetLabels {
  /** Accessible name of the trigger and the sheet. */
  open: string;
  /** Heading inside the sheet. */
  title: string;
  /** Optional context line below the heading, such as the result count. */
  subtitle?: string;
  close: string;
  apply: string;
}

interface FilterSheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: FilterSheetLabels;
  activeCount: number;
  apply: () => void;
  modalRef: React.RefObject<HTMLDivElement>;
  closeRef: React.RefObject<HTMLButtonElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const FilterSheetContext = React.createContext<FilterSheetContextValue | null>(null);

function useFilterSheet(component: string) {
  const ctx = React.useContext(FilterSheetContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <FilterSheet>.`);
  return ctx;
}

export interface FilterSheetProps {
  children: React.ReactNode;
  labels: FilterSheetLabels;
  /** Drives the badge on the trigger. 0 hides it. */
  activeCount: number;
  /**
   * Called when "apply" is tapped, after the sheet closes.
   *
   * Omit it in the SEO app: the default submits the closest <form>, which is
   * that app's whole contract — the panel is one no-JS GET form and the sheet
   * deliberately batches (FormAutoSubmit bails below 861px), so apply is what
   * actually runs the query.
   *
   * Pass a no-op in the SPA, where filters apply on change and there is no form.
   */
  onApply?: () => void;
}

/**
 * Holds the sheet's state. Renders no markup of its own, so it can wrap a whole
 * page: the trigger belongs beside the search field while the panel belongs in
 * the sidebar, and they are not nestable.
 *
 * It is a client component, but its children are just slots — server components
 * pass straight through, which is what keeps the SEO app's filter rail
 * server-rendered.
 */
export function FilterSheet({ children, labels, activeCount, onApply }: FilterSheetProps) {
  const [open, setOpen] = React.useState(false);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  const apply = React.useCallback(() => {
    setOpen(false);
    if (onApply) {
      onApply();
      return;
    }
    modalRef.current?.closest('form')?.requestSubmit();
  }, [onApply]);

  const value = React.useMemo<FilterSheetContextValue>(
    () => ({ open, setOpen, labels, activeCount, apply, modalRef, closeRef, triggerRef }),
    [open, labels, activeCount, apply],
  );

  return <FilterSheetContext.Provider value={value}>{children}</FilterSheetContext.Provider>;
}

/**
 * Icon-only button that opens the sheet. Hidden above 861px, where the rail is
 * always visible. Place it next to the search field's submit button.
 */
export function FilterSheetTrigger({ className }: { className?: string }) {
  const { open, setOpen, labels, activeCount, triggerRef } = useFilterSheet('FilterSheetTrigger');
  return (
    <button
      ref={triggerRef}
      type="button"
      className={cn('mobile-filter-trigger', className)}
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={labels.open}
    >
      <SlidersIcon />
      {activeCount > 0 && <span className="mobile-filter-count">{activeCount}</span>}
    </button>
  );
}

/**
 * Wraps the filter rail. Desktop: renders `children` untouched as the sidebar.
 * Below 861px: hides them behind the trigger in a dismissible bottom sheet.
 *
 * 861px rather than Tailwind's lg (1024px) because FormAutoSubmit uses the same
 * breakpoint — the sheet and the submit-batching have to switch together.
 */
export function FilterSheetPanel({ children }: { children: React.ReactNode }) {
  const { open, setOpen, labels, apply, modalRef, closeRef } = useFilterSheet('FilterSheetPanel');
  return (
    <div className="responsive-filter-panel">
      {/* A plain sibling rather than a portal (cf. the nav drawer): in the SEO
          app the panel must stay inside the <form> for the no-JS submit to
          work, and a fixed sibling escapes the layout just as well. */}
      {open && <div className="mobile-filter-scrim" aria-hidden="true" onClick={() => setOpen(false)} />}

      <div
        ref={modalRef}
        className={`mobile-filter-modal${open ? ' is-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label={labels.open}
      >
        <header className="mobile-filter-header">
          <span>
            <SlidersIcon />
            <span className="mobile-filter-heading">
              <b>{labels.title}</b>
              {labels.subtitle ? <small>{labels.subtitle}</small> : null}
            </span>
          </span>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={labels.close}>
            <CloseIcon />
          </button>
        </header>
        <div className="mobile-filter-scroll">{children}</div>
        <footer className="mobile-filter-footer">
          <button type="button" className="mobile-filter-apply" onClick={apply}>{labels.apply}</button>
        </footer>
      </div>
    </div>
  );
}

// Inlined rather than imported from lucide-react: this lib is consumed by both a
// Next build and a Vite build, and two icons aren't worth the shared dependency.
function SlidersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}
