'use client';

import * as React from 'react';

export interface ResponsiveFilterPanelLabels {
  /** Accessible name of the sheet, and of the trigger button. */
  open: string;
  /** Heading shown in the sheet, and the trigger's visible text. */
  title: string;
  close: string;
  apply: string;
}

export interface ResponsiveFilterPanelProps {
  children: React.ReactNode;
  labels: ResponsiveFilterPanelLabels;
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
   * Pass a no-op (or a scroll) in the SPA, where filters apply on change and
   * there is no form to submit.
   */
  onApply?: () => void;
}

/**
 * Desktop: renders `children` as the filter rail, untouched.
 * Mobile (<861px): collapses them behind a trigger button into a dismissible
 * bottom sheet.
 *
 * 861px rather than Tailwind's lg (1024px) because FormAutoSubmit uses the same
 * breakpoint — the sheet and the submit-batching have to switch together.
 */
export function ResponsiveFilterPanel({ children, labels, activeCount, onApply }: ResponsiveFilterPanelProps) {
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

  const applyFilters = () => {
    setOpen(false);
    if (onApply) {
      onApply();
      return;
    }
    modalRef.current?.closest('form')?.requestSubmit();
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
        <SlidersIcon />
        <span>{labels.title}</span>
        {activeCount > 0 && <span className="mobile-filter-count">{activeCount}</span>}
      </button>

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
          <span><SlidersIcon /><b>{labels.title}</b></span>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={labels.close}>
            <CloseIcon />
          </button>
        </header>
        <div className="mobile-filter-scroll">{children}</div>
        <footer className="mobile-filter-footer">
          <button type="button" className="mobile-filter-apply" onClick={applyFilters}>{labels.apply}</button>
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
