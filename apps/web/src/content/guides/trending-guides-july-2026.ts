import type { Guide, GuideContent } from '../../lib/guides.js';

function withTranslation(base: Guide, locale: 'es' | 'en', translation: GuideContent): Guide {
  return { ...base, translations: { [locale]: translation } };
}

export const spielDesJahres2026 = withTranslation({
  slug: 'spiel-des-jahres-2026-ganadores-y-finalistas',
  title: 'Spiel des Jahres 2026: ganadores, finalistas y para quién es cada juego',
  description: 'Qué significan los premios Spiel des Jahres 2026 y qué ganador o finalista encaja con vuestra mesa, desde juegos familiares hasta estrategia avanzada.',
  authorId: 'nuria-es',
  originalLocale: 'es',
  intro: [
    'El Spiel des Jahres no es una clasificación absoluta: sus tres sellos señalan públicos distintos. En 2026, Dito ganó el premio familiar, Rebirth el Kennerspiel para mesas que quieren más decisión y La isla de los Mookies el infantil.',
    'Además del palmarés, importa mirar qué experiencia propone cada caja. Esta guía se centra en títulos premiados o destacados que ya podéis encontrar en el catálogo de Juegospedia, con una lectura práctica de su diseño y su público.',
  ],
  picks: [
    { gameSlug: 'rebirth-417197', blurb: 'Kennerspiel 2026. Colocación elegante sobre un mapa compartido: reglas contenidas, competencia visible y decisiones espaciales que crecen sin llenar la mesa de excepciones.' },
    { gameSlug: 'cozy-stickerville-456440', blurb: 'Finalista familiar de ritmo pausado y construcción con pegatinas. Encaja con mesas creativas que valoran una experiencia amable más que el enfrentamiento directo.' },
    { gameSlug: 'moon-colony-bloodbath-425549', blurb: 'Finalista del Kennerspiel. Una colonia sometida a desastres previsibles: planificar qué perder y cuándo convierte la destrucción en un problema estratégico.' },
    { gameSlug: 'toy-battle-434654', blurb: 'Recomendado por el jurado. Un duelo táctico compacto, fácil de desplegar y con suficiente lectura del rival para repetir partidas.' },
    { gameSlug: 'take-time-440540', blurb: 'Recomendado por el jurado. Cooperación contenida alrededor de cartas y comunicación limitada, ideal si buscáis tensión compartida sin una campaña enorme.' },
  ],
  sections: [
    { heading: 'Qué sello debéis buscar', paragraphs: ['Spiel des Jahres prioriza accesibilidad, claridad y capacidad de reunir a públicos distintos. Kennerspiel reconoce una experiencia más exigente, aunque todavía explicable en una noche. Kinderspiel evalúa el juego infantil como diseño completo, no como una versión recortada para adultos.', 'Si compráis para una ludoteca familiar, empezad por el sello rojo y las recomendaciones. Si vuestro grupo ya domina juegos modernos, Rebirth y Moon Colony Bloodbath son los candidatos más interesantes del lote disponible.'] },
    { heading: 'Cómo hemos preparado esta guía', paragraphs: ['La selección parte del palmarés oficial publicado por el jurado el 12 de julio de 2026. Los comentarios, comparaciones y recomendaciones son análisis original de Juegospedia; no reproducen las reseñas del jurado ni textos comerciales.'] },
  ],
  faq: [
    { q: '¿Cuál ganó el Spiel des Jahres 2026?', a: 'Dito, de Martin Ang, ganó el premio principal. Rebirth ganó el Kennerspiel y La isla de los Mookies el Kinderspiel.' },
    { q: '¿Rebirth es adecuado para principiantes?', a: 'Puede funcionar después de uno o dos juegos modernos más sencillos. Sus reglas son elegantes, pero la competencia espacial exige más atención que un título familiar.' },
  ],
  sources: [
    { label: 'Spiel des Jahres — Best of 2026 (palmarés oficial)', url: 'https://www.spiel-des-jahres.de/en/bestof2026/' },
  ],
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
}, 'en', {
  slug: 'spiel-des-jahres-2026-winners-and-nominees',
  title: 'Spiel des Jahres 2026: winners, finalists and who each game suits',
  description: 'What the 2026 Spiel des Jahres awards mean and which winner or finalist suits your table, from family games to advanced strategy.',
  authorId: 'nuria-es',
  intro: ['Spiel des Jahres is not one absolute ranking: its three seals address different audiences. Dito won the 2026 family award, Rebirth took the Kennerspiel, and Mookie Island won the children’s award.', 'The useful question is what experience each box offers. We focus on awarded and recommended games already present in Juegospedia’s catalogue.'],
  picks: [
    { gameSlug: 'rebirth-417197', blurb: 'The 2026 Kennerspiel winner. Elegant placement on a shared map, with contained rules, visible competition and spatial decisions that grow without exceptions.' },
    { gameSlug: 'cozy-stickerville-456440', blurb: 'A calm family finalist built around creative sticker placement. Best for tables valuing a gentle shared activity over confrontation.' },
    { gameSlug: 'moon-colony-bloodbath-425549', blurb: 'A Kennerspiel finalist about predictable disasters. Planning what to lose, and when, turns destruction into a strategic problem.' },
    { gameSlug: 'toy-battle-434654', blurb: 'Jury-recommended compact tactical duelling, quick to deploy and rich enough in opponent-reading for repeat plays.' },
    { gameSlug: 'take-time-440540', blurb: 'A jury recommendation offering focused co-operation, cards and limited communication without campaign-scale overhead.' },
  ],
  sections: [
    { heading: 'Which seal should you look for?', paragraphs: ['Spiel des Jahres rewards accessibility and clarity. Kennerspiel points to a more demanding but still teachable evening. Kinderspiel assesses children’s games as complete designs.', 'For a family library, begin with the red seal and recommendations. Experienced groups should look first at Rebirth and Moon Colony Bloodbath.'] },
    { heading: 'How this guide was prepared', paragraphs: ['The selection follows the official jury results published on 12 July 2026. All comparisons and recommendations here are original Juegospedia analysis, not copied jury or marketing text.'] },
  ],
  faq: [{ q: 'What won Spiel des Jahres 2026?', a: 'Dito by Martin Ang won the main award. Rebirth won Kennerspiel and Mookie Island won Kinderspiel.' }, { q: 'Is Rebirth for beginners?', a: 'It fits best after one or two lighter modern games. Rules are elegant, but spatial competition needs attention.' }],
  sources: [
    { label: 'Spiel des Jahres — Best of 2026 (official results)', url: 'https://www.spiel-des-jahres.de/en/bestof2026/' },
  ],
});

export const quickSetupSoloGames = withTranslation({
  slug: 'best-quick-setup-solo-board-games',
  title: 'The best quick-setup solo board games for a weeknight',
  description: 'Solo board games with meaningful decisions, modest table space and setup short enough that the game actually reaches the table after work.',
  authorId: 'kasia-pl',
  originalLocale: 'en',
  intro: ['Solo play is useful precisely when scheduling fails, so a forty-minute setup defeats the point. I measured these choices by friction: components to sort, rules state to recover and how quickly the first real decision arrives.', 'Quick does not mean shallow. Each game provides a system worth learning while respecting a small table and an ordinary weeknight.'],
  picks: [
    { gameSlug: 'under-falling-skies-306735', blurb: 'Dice placement creates a clean defence puzzle with almost no hidden upkeep. The campaign adds variety while individual battles remain compact.' },
    { gameSlug: 'cartographers-263918', blurb: 'A map sheet and a small deck produce a spatial puzzle that resets instantly. Ambush cards add just enough disruption to prevent routine.' },
    { gameSlug: 'cascadia-295947', blurb: 'Tiles and wildlife tokens create a calm optimisation problem. Setup is a few stacks, and scoring cards let you vary the puzzle.' },
    { gameSlug: 'final-girl-277659', blurb: 'More setup than the others, but still bounded and purpose-built for one. Choose this when you want drama and tactical card timing rather than meditative efficiency.' },
  ],
  sections: [{ heading: 'The hidden cost of solo setup', paragraphs: ['Sort time, table footprint and save-state complexity are part of a solo game’s weight. Cartographers wins on pure convenience; Under Falling Skies gives the best ratio of strategic density to space; Cascadia is easiest to pause; Final Girl offers the strongest narrative arc.', 'Store frequently used components in labelled bags and leave campaign material separated. A five-minute reset is often the difference between a game becoming a habit and remaining on the shelf.'] }],
  faq: [{ q: 'Which takes the least table space?', a: 'Cartographers. A player sheet, cards and pencils are enough.' }, { q: 'Which has the deepest campaign?', a: 'Under Falling Skies adds a structured campaign while keeping each battle compact.' }],
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
}, 'es', {
  slug: 'juegos-de-mesa-en-solitario-preparacion-rapida',
  title: 'Juegos en solitario de preparación rápida para una noche entre semana',
  description: 'Juegos en solitario con buenas decisiones, poco espacio y una preparación lo bastante breve para llegar a la mesa después del trabajo.',
  authorId: 'kasia-pl',
  intro: ['Jugar en solitario sirve cuando el calendario falla, así que una preparación de cuarenta minutos contradice la idea. He medido fricción: componentes, reglas que recuperar y tiempo hasta la primera decisión real.', 'Rápido no significa superficial. Cada juego ofrece un sistema que merece aprenderse sin exigir una mesa enorme.'],
  picks: [
    { gameSlug: 'under-falling-skies-306735', blurb: 'Colocación de dados para una defensa limpia, casi sin mantenimiento oculto. La campaña varía batallas que siguen siendo compactas.' },
    { gameSlug: 'cartographers-263918', blurb: 'Una hoja y una baraja producen un rompecabezas espacial que se reinicia al instante. Las emboscadas evitan la rutina.' },
    { gameSlug: 'cascadia-295947', blurb: 'Losetas y fauna forman una optimización tranquila. La preparación son unas pilas y las cartas de puntuación cambian el problema.' },
    { gameSlug: 'final-girl-277659', blurb: 'Tiene algo más de preparación, pero está diseñado para una persona. Elegidlo si queréis drama y ritmo de cartas.' },
  ],
  sections: [{ heading: 'El coste oculto de preparar una partida', paragraphs: ['Ordenar, ocupar mesa y guardar estado forman parte del peso. Cartographers gana en comodidad; Under Falling Skies en densidad por espacio; Cascadia se pausa mejor; Final Girl ofrece más narrativa.', 'Separad material de campaña y componentes frecuentes en bolsas etiquetadas. Cinco minutos de reinicio pueden convertir una caja en hábito.'] }],
  faq: [{ q: '¿Cuál ocupa menos mesa?', a: 'Cartographers: basta una hoja, cartas y lápices.' }, { q: '¿Cuál tiene la campaña más profunda?', a: 'Under Falling Skies añade campaña sin perder batallas compactas.' }],
});

export const cooperativeGamesForCouples = withTranslation({
  slug: 'mejores-juegos-cooperativos-para-parejas',
  title: 'Los mejores juegos cooperativos para parejas',
  description: 'Juegos cooperativos para dos que reparten bien la información y las decisiones, desde partidas de veinte minutos hasta retos estratégicos profundos.',
  authorId: 'sofia-mx',
  originalLocale: 'es',
  intro: ['Un cooperativo para parejas no debería convertir a una persona en copiloto silencioso. Busco información repartida, decisiones simultáneas o límites de comunicación que obliguen a escuchar sin que nadie dirija toda la partida.', 'También he mezclado duraciones. A veces queréis un reto de veinte minutos; otras, una noche completa. Lo importante es que ambos tengáis una responsabilidad visible.'],
  picks: [
    { gameSlug: 'sky-team-373106', blurb: 'Diseñado exclusivamente para dos. Piloto y copiloto colocan dados con comunicación limitada; cada aeropuerto modifica un problema que siempre pertenece a ambos.' },
    { gameSlug: 'codenames-duet-224037', blurb: 'Las pistas viajan en ambas direcciones y cada persona tiene información parcial. Fácil de sacar, flexible en duración y excelente para aprender cómo asocia palabras la otra persona.' },
    { gameSlug: 'spirit-island-162886', blurb: 'La opción profunda. Poderes asimétricos y problemas simultáneos reducen el efecto líder, aunque exige tiempo y ganas de aprender juntos.' },
    { gameSlug: 'pandemic-30549', blurb: 'Un clásico por una razón: objetivos claros y presión compartida. Funciona mejor si acordáis preguntar antes de mover las piezas del otro.' },
  ],
  sections: [{ heading: 'Cómo evitar el efecto líder', paragraphs: ['Elegid juegos con manos privadas, roles asimétricos o comunicación limitada. Sky Team y Codenames: Duet incorporan la separación en las reglas. Spirit Island crea tantos problemas paralelos que coordinar importa más que mandar.', 'En cooperativos de información abierta como Pandemic, usad una regla sencilla: quien lleva el turno propone primero y la otra persona aconseja después. La cooperación mejora cuando una sugerencia no sustituye a la decisión.'] }],
  faq: [{ q: '¿Cuál es mejor para empezar?', a: 'Codenames: Duet si os gustan las palabras; Sky Team si preferís un problema táctico y visual.' }, { q: '¿Cuál ofrece más profundidad?', a: 'Spirit Island, con espíritus asimétricos y dificultad ajustable.' }],
  publishedAt: '2026-07-26',
  updatedAt: '2026-07-26',
}, 'en', {
  slug: 'best-cooperative-board-games-for-couples',
  title: 'The best cooperative board games for couples',
  description: 'Two-player co-operative games that distribute information and decisions well, from twenty-minute sessions to deep strategic challenges.',
  authorId: 'sofia-mx',
  intro: ['A couples’ co-op should not make one person a silent co-pilot. I look for divided information, simultaneous decisions or communication limits that require listening without letting one player direct everything.', 'The list mixes lengths. Sometimes you want twenty minutes; sometimes a full evening. Both players should always own a visible responsibility.'],
  picks: [
    { gameSlug: 'sky-team-373106', blurb: 'Designed only for two. Pilot and co-pilot place dice with limited communication; every airport changes a problem that belongs equally to both.' },
    { gameSlug: 'codenames-duet-224037', blurb: 'Clues travel both ways and each player holds partial information. Quick to start, flexible in length and revealing about how your partner associates words.' },
    { gameSlug: 'spirit-island-162886', blurb: 'The deep option. Asymmetric powers and simultaneous problems reduce quarterbacking, but demand time and a willingness to learn together.' },
    { gameSlug: 'pandemic-30549', blurb: 'A classic for clear goals and shared pressure. It works best when each player is allowed to propose their own move before advice arrives.' },
  ],
  sections: [{ heading: 'How to avoid quarterbacking', paragraphs: ['Choose private hands, asymmetric roles or communication limits. Sky Team and Codenames: Duet put separation in the rules. Spirit Island creates enough parallel problems that co-ordination matters more than command.', 'In open-information games such as Pandemic, let the active player propose first and invite advice second. A suggestion should not replace a decision.'] }],
  faq: [{ q: 'Which is best for beginners?', a: 'Codenames: Duet for word play; Sky Team for a visual tactical problem.' }, { q: 'Which is deepest?', a: 'Spirit Island, with asymmetric spirits and adjustable difficulty.' }],
});

export const trendingGuidesJuly2026: readonly Guide[] = [
  spielDesJahres2026,
  quickSetupSoloGames,
  cooperativeGamesForCouples,
];
