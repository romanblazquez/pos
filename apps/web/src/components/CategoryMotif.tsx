// Category motifs — one original symbol per shelf (design system §06).
//
// Lucide-grade geometry: 24×24 box, 1.6 stroke, round caps/joins, drawn to stay
// legible from a 30px favicon to a 280px card. Each motif renders the category's
// art-direction line (see CATEGORY_IDENTITY) as pure mechanics — never a box,
// logo, or licensed character.
//
// Colour comes from `currentColor`, so callers set the accent on a parent.

/** The design system's meeple, reused for the player-count shelves. */
const MEEPLE =
  'M12 3.1a3.15 3.15 0 0 0-3.15 3.15c0 1.18.65 2.2 1.6 2.75-2.06.69-3.6 2.16-3.6 4.12 0 .86.67 1.45 1.55 1.45h.62l-.46 4.06c-.07.62.4 1.16 1.03 1.16h1.13l.78-3.8h.46l.78 3.8h1.13c.62 0 1.1-.54 1.03-1.16l-.46-4.06h.62c.88 0 1.55-.59 1.55-1.45 0-1.96-1.54-3.43-3.6-4.12.95-.55 1.6-1.57 1.6-2.75A3.15 3.15 0 0 0 12 3.1Z';

/** Motif bodies, keyed by `CategoryIdentity.motif`. */
const MOTIFS: Record<string, React.ReactNode> = {
  // Dos bandos, un tablero — simetría tensa cara a cara.
  'two-player': (
    <>
      <path d={MEEPLE} fill="currentColor" stroke="none" transform="translate(1.2 5.2) scale(.46)" />
      <path d={MEEPLE} fill="currentColor" stroke="none" transform="translate(22.8 5.2) scale(-.46 .46)" />
      <path d="M12 3.5v17" strokeDasharray="2 2.4" opacity=".55" />
    </>
  ),

  // Abanico de cartas en movimiento — manejo de mano, ritmo rápido.
  cards: (
    <>
      <rect x="9.4" y="7" width="8.2" height="12" rx="1.6" transform="rotate(14 13.5 13)" />
      <rect x="7.8" y="6.2" width="8.2" height="12" rx="1.6" />
      <rect x="4.2" y="7" width="8.2" height="12" rx="1.6" transform="rotate(-14 8.3 13)" />
    </>
  ),

  // Dados en el aire justo antes del resultado — azar bajo control.
  dice: (
    <>
      <rect x="6.2" y="6.2" width="12.4" height="12.4" rx="2.6" transform="rotate(-12 12.4 12.4)" />
      <circle cx="10" cy="10.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="14.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="9.4" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),

  // Grupo, risas y turnos rápidos — energía alta, reglas mínimas.
  party: (
    <>
      <circle cx="12" cy="13.6" r="3.1" />
      <path d="M12 6.4V3.6M17.6 8.6l2-2M6.4 8.6l-2-2M19.4 14.6h2.4M2.2 14.6h2.4M16.6 19.2l1.7 1.7M7.4 19.2l-1.7 1.7" />
    </>
  ),

  // Mapa modular, obreros y rutas — la jugada de tres turnos atrás.
  strategy: (
    <>
      <path d="M8.6 3.8h6.8l3.4 5.9-3.4 5.9H8.6L5.2 9.7Z" />
      <path d="M12 15.6v4.6" strokeDasharray="2 2" />
      <circle cx="12" cy="9.7" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="20.9" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),

  // Cubos, tracks y cadenas de producción — el motor antes que el conflicto.
  economic: (
    <>
      <rect x="3.4" y="4.4" width="5.2" height="5.2" rx="1.1" />
      <rect x="15.4" y="4.4" width="5.2" height="5.2" rx="1.1" />
      <rect x="9.4" y="14.4" width="5.2" height="5.2" rx="1.1" />
      <path d="M8.6 7h6.8M17.6 9.8 13.4 14M6.2 9.8 10.4 14" strokeDasharray="2 2" opacity=".75" />
    </>
  ),

  // Un mundo encantado emerge del tablero — castillos, runas, criaturas.
  fantasy: (
    <>
      <path d="M4.6 20.4V9.2l2.6 1.8V7.4l2.6 1.8V6l2.2-2.4L14.2 6v3.2l2.6-1.8V11l2.6-1.8v11.2Z" />
      <path d="M10.6 20.4v-3.6a1.4 1.4 0 0 1 2.8 0v3.6" fill="none" />
    </>
  ),

  // Piezas distintas convergen en un objetivo compartido — se gana en equipo.
  cooperative: (
    <>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 3.2v4.4M12 16.4v4.4M3.2 12h4.4M16.4 12h4.4" />
      <path d="m6.4 6.4 2.4 2.4M17.6 6.4l-2.4 2.4M6.4 17.6l2.4-2.4M17.6 17.6l-2.4-2.4" opacity=".5" />
    </>
  ),

  // Un mapa que se despliega — brújula, hallazgos, avance narrativo.
  adventure: (
    <>
      <path d="M3.4 6.6 9 4.4l6 2.2 5.6-2.2v13l-5.6 2.2-6-2.2-5.6 2.2Z" />
      <path d="M9 4.4v13M15 6.6v13" opacity=".45" />
      <path d="m14.4 9.6-1.6 3.6-3.6 1.6 1.6-3.6Z" fill="currentColor" stroke="none" />
    </>
  ),

  // Una posición, una luz cálida — inmersión completa para uno.
  solo: (
    <>
      <circle cx="12" cy="12" r="8.4" strokeDasharray="1.6 2.6" opacity=".5" />
      <path d={MEEPLE} fill="currentColor" stroke="none" transform="translate(5.4 5.4) scale(.55)" />
    </>
  ),

  // El tablero cambia de capítulo en capítulo — decisiones que persisten.
  legacy: (
    <>
      <path d="M4.4 5.4a1.6 1.6 0 0 1 1.6-1.6h12a1.6 1.6 0 0 1 1.6 1.6v13.2a1.6 1.6 0 0 0-1.6-1.6H6a1.6 1.6 0 0 1-1.6-1.6Z" />
      <path d="M12 17v3.2" />
      <path d="M12 20.2h4.2a1.6 1.6 0 0 0 1.6-1.6" opacity=".6" />
      <path d="M8.2 8.2h7.6M8.2 11.4h5" opacity=".7" />
    </>
  ),

  // El mazo crece carta a carta — el motor se construye solo.
  deckbuilding: (
    <>
      <rect x="3.8" y="9.8" width="8.4" height="10.4" rx="1.5" />
      <path d="M6.2 7.6h6.6a1.5 1.5 0 0 1 1.5 1.5v8.6" opacity=".55" />
      <path d="M8.6 5.4h6.6a1.5 1.5 0 0 1 1.5 1.5v8.6" opacity=".3" />
      <path d="M18.8 15.4v5.2M16.2 18h5.2" />
    </>
  ),

  // Algo espera en la oscuridad — tensión, no sangre.
  horror: (
    <>
      <path d="M12 3.4c-4 0-6.6 3-6.6 6.8 0 4.4 3 6.2 3 9.2v1.2h7.2v-1.2c0-3 3-4.8 3-9.2 0-3.8-2.6-6.8-6.6-6.8Z" />
      <path d="M9.4 10.6a1 1 0 1 0 .01 0M14.6 10.6a1 1 0 1 0 .01 0" fill="currentColor" stroke="none" />
      <path d="M10 16.4h4" opacity=".7" />
    </>
  ),

  // Órbitas, colonias y el largo viaje — el futuro como tablero.
  scifi: (
    <>
      <circle cx="12" cy="12" r="4.4" />
      <ellipse cx="12" cy="12" rx="9.4" ry="3.6" transform="rotate(-24 12 12)" />
      <circle cx="19.4" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),

  // Forma pura, sin tema — la partida es la idea.
  abstract: (
    <>
      <circle cx="9.2" cy="9.2" r="5" />
      <rect x="10.4" y="10.4" width="9.4" height="9.4" rx="1.4" />
    </>
  ),

  // Frentes, flancos y terreno — la historia se juega en hexágonos.
  wargame: (
    <>
      <path d="M9 3.8h6l3 5.2-3 5.2H9L6 9Z" />
      <path d="M12 14.2v6M12 20.2l-2.6-2.6M12 20.2l2.6-2.6" />
      <path d="M6.4 6.2 3.6 9l2.8 2.8M17.6 6.2 20.4 9l-2.8 2.8" opacity=".55" />
    </>
  ),

  // Dos alturas en la misma mesa — el juego que cruza generaciones.
  family: (
    <>
      <path d={MEEPLE} fill="currentColor" stroke="none" transform="translate(1.6 2.6) scale(.5)" />
      <path d={MEEPLE} fill="currentColor" stroke="none" transform="translate(13.4 8.4) scale(.36)" />
      <path d="M3.6 20.6h16.8" opacity=".55" />
    </>
  ),

  // Una pista lleva a otra — lo que se deduce, no lo que se ve.
  deduction: (
    <>
      <circle cx="10.4" cy="10.4" r="5.6" />
      <path d="m14.6 14.6 5.4 5.4" />
      <path d="M8 10.4h4.8M10.4 8v4.8" opacity=".5" />
    </>
  ),

  // La última curva antes de meta — todo se decide en la línea.
  sports: (
    <>
      <path d="M5.2 3.8v16.4" />
      <path d="M5.2 4.6h13.6v7.2H5.2Z" />
      <path d="M8.6 4.6v7.2M12 4.6v7.2M15.4 4.6v7.2" opacity=".45" />
      <path d="M7.4 16.6h9.6" strokeDasharray="2 2.2" opacity=".7" />
    </>
  ),

  // Vías que conectan ciudades — la red importa más que el vagón.
  trains: (
    <>
      <rect x="6.2" y="4.6" width="11.6" height="9.6" rx="2" />
      <path d="M9.4 7.8h5.2" opacity=".7" />
      <circle cx="9.4" cy="17.2" r="1.6" />
      <circle cx="14.6" cy="17.2" r="1.6" />
      <path d="M3.4 20.8h17.2" strokeDasharray="2 2.4" opacity=".6" />
    </>
  ),

  // Columnas de otra época — el pasado como escenario.
  history: (
    <>
      <path d="M4.2 8.4 12 4.2l7.8 4.2" />
      <path d="M7 10.4v7.2M12 10.4v7.2M17 10.4v7.2" />
      <path d="M4.6 20h14.8" />
    </>
  ),

  // Una ficha aún sin estante — el hueco es honesto, no decorativo.
  other: (
    <>
      <circle cx="12" cy="12" r="8.2" strokeDasharray="2 2.6" opacity=".7" />
      <path d="M12 15.6v.05" strokeWidth="2" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 1.9-2.5 3.3" />
    </>
  ),
};

export function CategoryMotif({
  motif,
  size = 24,
  className,
}: {
  motif: string;
  size?: number;
  className?: string;
}) {
  const body = MOTIFS[motif] ?? MOTIFS.abstract;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
