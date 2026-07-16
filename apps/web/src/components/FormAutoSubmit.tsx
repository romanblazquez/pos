'use client';
import { useEffect, useRef } from 'react';

// Placed inside a GET <form>, auto-submits on any radio/checkbox change so
// filter chips feel instant without converting the server component to a client one.
// Falls back gracefully: the "Aplicar filtros" submit button still works without JS.
export function FormAutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    function onChange(e: Event) {
      if (window.matchMedia('(max-width: 860px)').matches) return;
      const t = e.target as HTMLInputElement;
      if (t.type === 'text' || t.type === 'search') return;
      form!.requestSubmit();
    }
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, []);

  return <span ref={ref} aria-hidden="true" className="sr-only" />;
}
