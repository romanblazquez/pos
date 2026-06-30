import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container">
      <section className="catalog-empty" style={{ marginBlock: '4rem' }}>
        <p className="section-kicker">404</p>
        <h1 className="page-title">No encontramos esta página</h1>
        <p className="muted">Puede que el enlace haya cambiado o que el contenido ya no esté disponible.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '.75rem', marginTop: '1.25rem' }}>
          <Link href="/es">Volver al inicio</Link>
          <Link href="/es/buscar">Buscar juegos</Link>
        </div>
      </section>
    </main>
  );
}
