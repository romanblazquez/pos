import type { Guide, GuideContent } from '../../lib/guides.js';

function bilingual(
  base: Guide,
  translatedLocale: 'es' | 'en',
  translation: GuideContent,
): Guide {
  return { ...base, translations: { [translatedLocale]: translation } };
}

export const mejoresPartyGames = bilingual({
  slug: 'mejores-party-games-para-grupos',
  title: 'Los mejores party games para grupos que quieren jugar de verdad',
  description: 'Party games para grupos grandes: fáciles de explicar, inclusivos y con decisiones suficientes para que la diversión no dependa solo de hacer ruido.',
  authorId: 'sofia-mx',
  originalLocale: 'es',
  intro: [
    'En una reunión familiar el juego compite con la comida, las conversaciones y quien llegó tarde. Por eso busco cajas que se expliquen mientras repartimos componentes, permitan entrar sin experiencia y den a todos algo que hacer.',
    'No seleccioné juegos solo porque hagan reír. También valoré que nadie quede eliminado, que una ronda no se alargue y que funcionen con personalidades distintas. Estos son los que vuelven a nuestra mesa.',
  ],
  picks: [
    { gameSlug: 'codenames-178900', blurb: 'Dos pistas pueden convertir una palabra corriente en una historia compartida. Escala muy bien, acepta espectadores y recompensa conocer cómo piensa vuestro equipo.' },
    { gameSlug: 'decrypto-225694', blurb: 'La opción para grupos que quieren más deducción. Hay que comunicar códigos sin regalar el patrón al rival; cada ronda reutiliza la información anterior y la tensión crece.' },
    { gameSlug: 'time-s-up-party-38713', blurb: 'La misma baraja pasa por descripción, una palabra y mímica. Esa repetición crea chistes propios del grupo y hace que hasta quien empezó tímido termine participando.' },
    { gameSlug: 'flip-7-420087', blurb: 'Tienta tu suerte con reglas que caben en un minuto. Decidir si pides otra carta mantiene a toda la mesa pendiente, incluso entre turnos.' },
  ],
  sections: [{ heading: 'Cómo elegir un party game para vuestro grupo', paragraphs: ['Para grupos mezclados, priorizad turnos simultáneos o muy breves y evitad conocimientos especializados. Codenames funciona mejor si disfrutáis las asociaciones; Decrypto, si queréis pensar; Time’s Up!, si el grupo se presta al espectáculo; Flip 7, si buscáis algo inmediato.', 'También importa el espacio. Los juegos de palabras necesitan poco tablero y sobreviven bien a una mesa con platos. Si alguien no quiere actuar, no lo forcéis: tener dos opciones de estilo hace una reunión mucho más inclusiva.'] }],
  faq: [
    { q: '¿Cuál funciona mejor con personas que casi no juegan?', a: 'Flip 7 y Time’s Up! se explican más rápido. Codenames añade un poco más de pensamiento sin exigir experiencia previa.' },
    { q: '¿Qué party game tiene más estrategia?', a: 'Decrypto. La información se acumula y obliga a construir pistas útiles para tu equipo pero opacas para el contrario.' },
  ],
  publishedAt: '2026-07-20', updatedAt: '2026-07-20',
}, 'en', {
  slug: 'best-party-games-for-groups',
  title: 'The best party games for groups who actually want to play',
  description: 'Easy-to-teach, inclusive party games for larger groups, with enough decisions that the fun does not depend on noise alone.',
  authorId: 'sofia-mx',
  intro: ['At a family gathering, a game competes with food, conversation and whoever arrived late. I look for boxes we can teach while dealing components, with no experience required and something for everyone to do.', 'These are not here merely because they produce laughs. Nobody is eliminated, rounds stay short, and different personalities can participate comfortably.'],
  picks: [
    { gameSlug: 'codenames-178900', blurb: 'Two clues can turn an ordinary word into a shared story. It scales well, welcomes spectators and rewards knowing how your team thinks.' },
    { gameSlug: 'decrypto-225694', blurb: 'For groups wanting more deduction. Communicate codes without exposing your pattern; every round reuses old information and raises the tension.' },
    { gameSlug: 'time-s-up-party-38713', blurb: 'The same deck passes through description, one word and mime. Repetition creates the group’s own jokes and draws quieter players in.' },
    { gameSlug: 'flip-7-420087', blurb: 'Push-your-luck rules in one minute. Choosing whether to take another card keeps the whole table invested between turns.' },
  ],
  sections: [{ heading: 'How to choose for your group', paragraphs: ['For mixed groups, favour simultaneous or very short turns and avoid specialist knowledge. Codenames suits word association; Decrypto suits thinkers; Time’s Up! suits performers; Flip 7 suits instant play.', 'Space matters too. Word games tolerate a table full of plates. Never force performance on a reluctant player: offering two styles makes the gathering more inclusive.'] }],
  faq: [{ q: 'Which is best for complete beginners?', a: 'Flip 7 and Time’s Up! teach fastest. Codenames adds thought without requiring hobby experience.' }, { q: 'Which has the most strategy?', a: 'Decrypto, because information accumulates and every clue must serve your team without helping the opponent.' }],
});

export const mejoresColocacionTrabajadores = bilingual({
  slug: 'mejores-juegos-colocacion-de-trabajadores',
  title: 'Los mejores juegos de colocación de trabajadores',
  description: 'Guía de colocación de trabajadores: desde una granja accesible hasta eurogames exigentes donde cada espacio y cada turno importan.',
  authorId: 'mateo-ar', originalLocale: 'es',
  intro: ['Poner un trabajador parece un gesto inocente hasta que descubrís que acabás de ocupar el único espacio que necesitaba el resto de la mesa. Ahí vive el género: planificar recursos, leer prioridades ajenas y aceptar que el plan perfecto no sobrevive al contacto con el rival.', 'Elegí juegos con decisiones tensas y economías distintas. No hace falta empezar por el más pesado; sí conviene elegir el nivel de bloqueo y exigencia que tu grupo disfruta.'],
  picks: [
    { gameSlug: 'agricola-revised-edition-200680', blurb: 'El clásico del hambre controlada. Cada acción mejora tu granja, pero alimentar a la familia marca el ritmo y vuelve cada espacio ocupado una pequeña tragedia.' },
    { gameSlug: 'viticulture-essential-edition-183394', blurb: 'Un punto de entrada amable: estaciones, visitantes y pedidos de vino construyen un motor fácil de visualizar, con suficiente competencia por acciones.' },
    { gameSlug: 'darwin-s-journey-322289', blurb: 'Trabajadores que se especializan mientras explorás, investigás y cumplís objetivos. Muchas rutas viables y una planificación deliciosa para grupos experimentados.' },
    { gameSlug: 'caverna-the-cave-farmers-102794', blurb: 'Más libertad y menos castigo que Agricola. La enorme variedad de habitaciones deja desarrollar una granja propia sin perder la tensión por los mejores espacios.' },
  ],
  sections: [{ heading: 'Bloqueo, escalado y duración', paragraphs: ['El bloqueo directo es parte del sabor, no un defecto. Agricola lo usa para apretar; Viticulture ofrece alternativas más suaves; Caverna abre tantas rutas que rara vez quedás sin plan. Mirá también el escalado: más jugadores no solo alargan la partida, cambian cuánto podés anticipar.', 'Para una primera compra, Viticulture es el puente más cómodo. Si tu grupo ya disfruta optimizar, Darwin’s Journey ofrece la mayor densidad de decisiones de esta lista.'] }],
  faq: [{ q: '¿Cuál es mejor para empezar?', a: 'Viticulture Essential Edition: la economía es intuitiva y las estaciones ordenan el turno.' }, { q: '¿Agricola o Caverna?', a: 'Agricola si querés presión y escasez; Caverna si preferís desarrollar una estrategia propia con más libertad.' }],
  publishedAt: '2026-07-21', updatedAt: '2026-07-21',
}, 'en', {
  slug: 'best-worker-placement-board-games',
  title: 'The best worker-placement board games',
  description: 'Worker-placement games from an approachable vineyard to demanding eurogames where every action space and turn matters.',
  authorId: 'mateo-ar',
  intro: ['Placing one worker looks harmless until you occupy the only space somebody else needed. That is the genre: plan resources, read rival priorities and accept that a perfect plan never survives contact with the table.', 'I chose distinct economies and levels of pressure. You need not begin with the heaviest box; choose how much blocking and calculation your group enjoys.'],
  picks: [
    { gameSlug: 'agricola-revised-edition-200680', blurb: 'The classic of controlled hunger. Every action improves the farm, but feeding the family sets the tempo and makes every occupied space hurt.' },
    { gameSlug: 'viticulture-essential-edition-183394', blurb: 'A welcoming entry point. Seasons, visitors and wine orders form an easy-to-read engine with enough competition for actions.' },
    { gameSlug: 'darwin-s-journey-322289', blurb: 'Workers specialise as you explore, research and complete objectives. Many viable paths and superb planning for experienced groups.' },
    { gameSlug: 'caverna-the-cave-farmers-102794', blurb: 'More freedom and less punishment than Agricola. Its rooms support a personal farm while the best spaces remain contested.' },
  ],
  sections: [{ heading: 'Blocking, scaling and length', paragraphs: ['Blocking is flavour, not a flaw. Agricola applies pressure, Viticulture offers softer alternatives, and Caverna keeps many routes open. Player count also changes predictability, not just length.', 'Viticulture is the easiest first purchase. For a group already comfortable with optimisation, Darwin’s Journey offers the densest decisions here.'] }],
  faq: [{ q: 'Which is best for beginners?', a: 'Viticulture Essential Edition: its economy is intuitive and seasons organise the round.' }, { q: 'Agricola or Caverna?', a: 'Agricola for pressure and scarcity; Caverna for a freer personal strategy.' }],
});

export const juegosColocacionLosetasBonitos = bilingual({
  slug: 'juegos-de-mesa-bonitos-colocacion-losetas',
  title: 'Juegos de mesa bonitos donde colocar cada loseta importa',
  description: 'Juegos de colocación de losetas con gran diseño visual: legibles, táctiles y con decisiones que justifican cada pieza sobre la mesa.',
  authorId: 'nuria-es', originalLocale: 'es',
  intro: ['Una mesa bonita no basta. El diseño visual tiene que ayudaros a leer el estado de la partida: distinguir regiones, anticipar patrones y entender por qué una pieza encaja o estorba. Cuando forma y función coinciden, colocar una loseta resulta especialmente satisfactorio.', 'He elegido cuatro juegos cuya presencia no es un adorno. El color, la retícula y la materialidad sostienen la mecánica y hacen que el tablero cuente vuestra partida al terminar.'],
  picks: [
    { gameSlug: 'azul-230802', blurb: 'Los azulejos tienen peso, color y propósito. El patrón es inmediatamente legible, pero tomar una colección equivocada puede llenar el suelo de puntos negativos.' },
    { gameSlug: 'cascadia-295947', blurb: 'Los hexágonos conectan hábitats mientras la fauna exige patrones distintos. Sereno a la vista, muy preciso en la decisión espacial.' },
    { gameSlug: 'harmonies-414317', blurb: 'Capas de fichas construyen altura, agua y vegetación. Es un pequeño paisaje tridimensional donde cada animal obliga a mirar el espacio de otra manera.' },
    { gameSlug: 'carcassonne-822', blurb: 'La retícula emerge sin tablero previo: caminos, ciudades y campos crecen con claridad ejemplar. Sigue siendo una lección de diseño visual décadas después.' },
  ],
  sections: [{ heading: 'Belleza que mejora la partida', paragraphs: ['La paleta debe separar información sin fatigar. Azul emplea contraste decorativo; Cascadia reserva símbolos y colores para hábitat y fauna; Carcassonne dibuja continuidad. Esa legibilidad reduce preguntas y deja espacio para decidir.', 'Si necesitáis accesibilidad cromática, revisad símbolos y contraste además del color. Cascadia ofrece redundancia visual especialmente útil; Harmonies depende algo más de reconocer tonos y alturas.'] }],
  faq: [{ q: '¿Cuál queda mejor como juego familiar?', a: 'Cascadia: es tranquilo, escala bien y permite ajustar la dificultad de los patrones.' }, { q: '¿Cuál tiene más interacción?', a: 'Carcassonne. Compartís el mismo paisaje y podéis competir por ciudades, caminos y campos.' }],
  publishedAt: '2026-07-22', updatedAt: '2026-07-22',
}, 'en', {
  slug: 'beautiful-tile-laying-board-games',
  title: 'Beautiful tile-laying games where every piece matters',
  description: 'Visually accomplished tile-laying games whose colour, grid and tactile design make their decisions easier to read.',
  authorId: 'nuria-es',
  intro: ['A beautiful table is not enough. Visual design should help you read regions, anticipate patterns and understand why a piece fits or obstructs. When form and function agree, placing a tile becomes especially satisfying.', 'These four use presence as more than decoration. Colour, grid and material support play, leaving a board that tells the story of your decisions.'],
  picks: [
    { gameSlug: 'azul-230802', blurb: 'Tiles have weight, colour and purpose. The pattern reads instantly, but taking the wrong set can fill your floor with penalties.' },
    { gameSlug: 'cascadia-295947', blurb: 'Hexagons connect habitats while wildlife asks for different patterns. Calm to view, exacting in spatial decisions.' },
    { gameSlug: 'harmonies-414317', blurb: 'Layered tokens build height, water and vegetation. Every animal asks you to read the small three-dimensional landscape differently.' },
    { gameSlug: 'carcassonne-822', blurb: 'A grid emerges without a board: roads, cities and fields grow with exemplary clarity. It remains a lesson in visual design.' },
  ],
  sections: [{ heading: 'Beauty that improves play', paragraphs: ['A palette should separate information without fatigue. Azul uses decorative contrast, Cascadia separates habitat and wildlife, and Carcassonne draws continuity. This legibility reduces questions and leaves room for decisions.', 'For colour accessibility, inspect symbols and contrast as well as hue. Cascadia provides useful visual redundancy; Harmonies relies more on recognising tone and height.'] }],
  faq: [{ q: 'Which is best for families?', a: 'Cascadia: calm, scalable and easy to adjust through different scoring patterns.' }, { q: 'Which has the most interaction?', a: 'Carcassonne, because everyone contributes to and contests the same landscape.' }],
});

export const bestCampaignBoardGames = bilingual({
  slug: 'best-campaign-board-games-for-a-regular-group',
  title: 'The best campaign board games for a group that will finish them',
  description: 'Campaign board games judged on continuity, setup, scenario variety and whether a regular group can realistically reach the ending.',
  authorId: 'eoin-ie', originalLocale: 'en',
  intro: ['Buying a campaign is easy. Getting the same people around a table for chapter twelve is the real boss battle. I favour campaigns that remember your choices without asking one player to become a full-time archivist.', 'Before choosing, agree on session length, who stores the box and how often you meet. A grand story is no use if setup consumes the only hour everyone had free.'],
  picks: [
    { gameSlug: 'pandemic-legacy-season-1-161936', blurb: 'Still the cleanest campaign gateway. Familiar Pandemic decisions acquire consequences, rules arrive gradually and each session moves the story without excessive upkeep.' },
    { gameSlug: 'iss-vanguard-325494', blurb: 'A vast science-fiction expedition split between ship management and planetary missions. Best for a committed group that enjoys narrative records and long arcs.' },
    { gameSlug: 'arkham-horror-the-card-game-463126', blurb: 'Deck construction and branching scenarios make failure interesting rather than terminal. Excellent at two, and easy to continue once decks are stored.' },
    { gameSlug: 'clank-legacy-acquisitions-incorporated-266507', blurb: 'A lively bridge between accessible deck-building and permanent campaign changes. The jokes are broad, but the evolving board gives the group real ownership.' },
  ],
  sections: [{ heading: 'Can your group support the campaign?', paragraphs: ['Count calendar friction as part of complexity. Pandemic Legacy tolerates shorter sessions and modest rules knowledge. ISS Vanguard asks for more storage, reading and continuity. Arkham is flexible with two reliable players; Clank Legacy welcomes a mixed-experience group.', 'Keep a one-page session note with the next objective, current rules exceptions and who owns which character. Ten minutes of organisation prevents a month’s gap from killing momentum.'] }],
  faq: [{ q: 'Which campaign should a new group start with?', a: 'Pandemic Legacy: Season 1. Its familiar core and gradual rules make continuity manageable.' }, { q: 'What works best with two players?', a: 'Arkham Horror: The Card Game, whose investigator decks and branching scenarios are excellent at two.' }],
  publishedAt: '2026-07-23', updatedAt: '2026-07-23',
}, 'es', {
  slug: 'mejores-juegos-de-campana-para-grupos',
  title: 'Los mejores juegos de campaña para un grupo que quiere terminarlos',
  description: 'Juegos de campaña valorados por continuidad, preparación, variedad y posibilidades reales de llegar al final con un grupo estable.',
  authorId: 'eoin-ie',
  intro: ['Comprar una campaña es fácil. Reunir a las mismas personas para el capítulo doce es el verdadero jefe final. Prefiero campañas que recuerdan decisiones sin convertir a un jugador en archivero a tiempo completo.', 'Antes de elegir, acordad duración, frecuencia y quién guarda la caja. Una gran historia no sirve si la preparación consume la única hora libre del grupo.'],
  picks: [
    { gameSlug: 'pandemic-legacy-season-1-161936', blurb: 'La entrada más limpia: decisiones conocidas adquieren consecuencias, las reglas llegan poco a poco y cada sesión mueve la historia sin demasiado mantenimiento.' },
    { gameSlug: 'iss-vanguard-325494', blurb: 'Una expedición de ciencia ficción enorme, dividida entre gestión de nave y misiones planetarias. Para grupos constantes que disfrutan registrar una historia larga.' },
    { gameSlug: 'arkham-horror-the-card-game-463126', blurb: 'Construcción de mazos y escenarios ramificados donde perder también produce historia. Excelente a dos y fácil de retomar con los mazos preparados.' },
    { gameSlug: 'clank-legacy-acquisitions-incorporated-266507', blurb: 'Un puente animado entre deck-building accesible y cambios permanentes. El tablero evoluciona y termina sintiéndose propio.' },
  ],
  sections: [{ heading: '¿Puede vuestro grupo sostener la campaña?', paragraphs: ['El calendario también es complejidad. Pandemic Legacy tolera sesiones breves; ISS Vanguard exige más almacenamiento y continuidad; Arkham funciona con dos jugadores fiables; Clank Legacy admite experiencia mezclada.', 'Guardad una nota con el próximo objetivo, excepciones actuales y personajes. Diez minutos de orden evitan que una pausa de un mes mate la campaña.'] }],
  faq: [{ q: '¿Por cuál debería empezar un grupo nuevo?', a: 'Pandemic Legacy: Season 1, por su núcleo conocido y reglas graduales.' }, { q: '¿Cuál funciona mejor a dos?', a: 'Arkham Horror: The Card Game, por sus mazos de investigador y escenarios ramificados.' }],
});

export const bestDeckBuildingGames = bilingual({
  slug: 'best-deck-building-board-games',
  title: 'The best deck-building games: five different reasons to improve a deck',
  description: 'Deck-building games compared by market tension, card efficiency, interaction and how clearly each purchase changes your next turn.',
  authorId: 'kasia-pl', originalLocale: 'en',
  intro: ['Deck-building is satisfying because improvement is measurable. A weak opening hand becomes a machine, but only if every purchase has a purpose and poor cards can be managed rather than merely endured.', 'I selected systems where the deck is doing genuinely different work: combat, worker placement, co-operation and tactical survival. The best choice depends on what you want the efficiency puzzle to produce.'],
  picks: [
    { gameSlug: 'dune-imperium-uprising-397598', blurb: 'Cards are both actions and access to worker spaces, so every purchase changes two systems. Tight competition makes efficiency visible immediately.' },
    { gameSlug: 'slay-the-spire-the-board-game-338960', blurb: 'A co-operative adaptation with careful upgrades and transparent combat maths. The deck remains small enough that each card choice matters.' },
    { gameSlug: 'clank-catacombs-365717', blurb: 'Deck improvement powers a noisy dungeon race. Modular exploration adds uncertainty while clank in the bag turns greed into a readable risk.' },
    { gameSlug: 'aeon-s-end-the-descent-412268', blurb: 'You never shuffle, so discard order becomes planning. Co-operative roles and a hostile market reward a group that coordinates purchases.' },
  ],
  sections: [{ heading: 'What makes deck-building decisions good?', paragraphs: ['A strong market offers trade-offs, not obvious upgrades. Card draw, removal, tempo and synergy should compete for the same limited currency. If one purchase is always correct, the market is only decoration.', 'Also consider handling. Aeon’s End rewards careful discard order; Slay the Spire requires managing upgraded cards; Clank is looser and faster; Dune: Imperium asks you to read both cards and board spaces.'] }],
  faq: [{ q: 'Which is easiest to learn?', a: 'Clank!: Catacombs is the most forgiving introduction here, with an intuitive adventure wrapped around the deck.' }, { q: 'Which is best solo?', a: 'Slay the Spire is the strongest fit if you want the deck itself to carry the solo tactical puzzle.' }],
  publishedAt: '2026-07-24', updatedAt: '2026-07-24',
}, 'es', {
  slug: 'mejores-juegos-de-construccion-de-mazos',
  title: 'Los mejores juegos de construcción de mazos',
  description: 'Deck-building comparado por tensión del mercado, eficiencia, interacción y cuánto cambia cada compra vuestro siguiente turno.',
  authorId: 'kasia-pl',
  intro: ['Construir un mazo satisface porque la mejora se puede medir. Una mano débil se convierte en máquina, pero solo si cada compra tiene propósito y las cartas malas se pueden gestionar.', 'He elegido sistemas donde el mazo hace trabajos distintos: combate, colocación, cooperación y supervivencia táctica. La mejor opción depende de qué queréis producir con el rompecabezas de eficiencia.'],
  picks: [
    { gameSlug: 'dune-imperium-uprising-397598', blurb: 'Las cartas son acciones y acceso a espacios, así que cada compra cambia dos sistemas. La competencia hace visible la eficiencia enseguida.' },
    { gameSlug: 'slay-the-spire-the-board-game-338960', blurb: 'Adaptación cooperativa con mejoras cuidadas y combate transparente. El mazo sigue siendo pequeño y cada carta importa.' },
    { gameSlug: 'clank-catacombs-365717', blurb: 'La mejora impulsa una carrera ruidosa por la mazmorra. La exploración modular añade incertidumbre y el ruido convierte la codicia en riesgo legible.' },
    { gameSlug: 'aeon-s-end-the-descent-412268', blurb: 'Nunca se baraja: el descarte es planificación. Roles cooperativos y mercado hostil premian coordinar las compras.' },
  ],
  sections: [{ heading: '¿Qué hace buenas las decisiones de mercado?', paragraphs: ['Un mercado fuerte ofrece compromisos, no mejoras obvias. Robo, eliminación, tempo y sinergia deben competir por la misma moneda. Si una compra siempre es correcta, el mercado es decorado.', 'Considerad también el manejo: Aeon’s End premia ordenar descartes; Slay the Spire gestiona mejoras; Clank es más rápido; Dune exige leer cartas y tablero.'] }],
  faq: [{ q: '¿Cuál es más fácil de aprender?', a: 'Clank!: Catacombs, porque envuelve el mazo en una aventura intuitiva.' }, { q: '¿Cuál funciona mejor en solitario?', a: 'Slay the Spire si queréis que el propio mazo sostenga el rompecabezas táctico.' }],
});

export const bestHorrorBoardGames = bilingual({
  slug: 'best-horror-board-games-that-build-real-tension',
  title: 'The best horror board games that build real tension',
  description: 'Horror board games chosen for pacing, uncertainty and decisions under pressure—not merely dark artwork and a box of miniatures.',
  authorId: 'dave-us', originalLocale: 'en',
  intro: ['A horror game needs more than black cards and tentacles, buddy. The table should know something bad is coming, understand just enough to worry, and still make a decision that might invite the disaster in.', 'I picked four very different kinds of fear: a solo slasher, app-driven investigation, tactical survival and campaign dread. Setup is part of the price, so I call out when the spectacle earns it.'],
  picks: [
    { gameSlug: 'final-girl-277659', blurb: 'A sharp solo slasher where dice create panic but card timing keeps you responsible. Modular feature films let you tune the killer, location and length.' },
    { gameSlug: 'mansions-of-madness-second-edition-205059', blurb: 'The app handles hidden information and scenario timing, leaving the table to investigate. Best when players accept atmosphere over perfect control.' },
    { gameSlug: 'zombicide-white-death-383496', blurb: 'Large-scale tactical survival with barricades, hordes and plenty to paint. The setup earns its keep when your group wants spectacle and co-operative problem-solving.' },
    { gameSlug: 'arkham-horror-the-card-game-463126', blurb: 'Campaign horror where failed tests and trauma persist. Deck choices express a character, and the scenario can hurt without simply ending the story.' },
  ],
  sections: [{ heading: 'Tension is a pacing system', paragraphs: ['Good horror alternates information and uncertainty. Final Girl shows the odds but not the result; Mansions hides scenario triggers; Zombicide makes noise and spawning visible; Arkham lets consequences travel into the next chapter.', 'Match overhead to the evening. Final Girl reaches the table fastest. Mansions needs an app and investigation time. Zombicide needs space. Arkham needs decks kept between sessions. No joke: storage can decide which game actually gets played.'] }],
  faq: [{ q: 'Which is best for solo play?', a: 'Final Girl is designed specifically for solo horror and offers the cleanest one-player experience.' }, { q: 'Which is best for a casual group?', a: 'Mansions of Madness, because the app carries rules and hidden information while players focus on the investigation.' }],
  publishedAt: '2026-07-25', updatedAt: '2026-07-25',
}, 'es', {
  slug: 'mejores-juegos-de-mesa-de-terror',
  title: 'Los mejores juegos de mesa de terror que crean tensión real',
  description: 'Juegos de terror elegidos por ritmo, incertidumbre y decisiones bajo presión, no solo por ilustraciones oscuras y miniaturas.',
  authorId: 'dave-us',
  intro: ['Un juego de terror necesita más que cartas negras y tentáculos. La mesa debe saber que algo malo se acerca, entender lo suficiente para preocuparse y tomar una decisión que quizá invite al desastre.', 'He elegido cuatro miedos distintos: slasher en solitario, investigación con app, supervivencia táctica y campaña. La preparación forma parte del precio.'],
  picks: [
    { gameSlug: 'final-girl-277659', blurb: 'Slasher en solitario donde los dados provocan pánico, pero el ritmo de las cartas mantiene la responsabilidad. Películas modulares cambian asesino y localización.' },
    { gameSlug: 'mansions-of-madness-second-edition-205059', blurb: 'La app controla información oculta y tiempos, dejando investigar a la mesa. Funciona si aceptáis atmósfera por encima del control perfecto.' },
    { gameSlug: 'zombicide-white-death-383496', blurb: 'Supervivencia táctica a gran escala con barricadas y hordas. La preparación compensa cuando el grupo quiere espectáculo y cooperación.' },
    { gameSlug: 'arkham-horror-the-card-game-463126', blurb: 'Terror de campaña donde fallos y traumas persisten. El mazo expresa al personaje y perder puede continuar la historia.' },
  ],
  sections: [{ heading: 'La tensión es un sistema de ritmo', paragraphs: ['El buen terror alterna información e incertidumbre. Final Girl muestra probabilidades; Mansions oculta disparadores; Zombicide hace visible el ruido; Arkham arrastra consecuencias.', 'Ajustad el mantenimiento a la noche. Final Girl sale rápido; Mansions exige app; Zombicide necesita espacio; Arkham conserva mazos. El almacenamiento decide qué juego vuelve a jugarse.'] }],
  faq: [{ q: '¿Cuál es mejor en solitario?', a: 'Final Girl, diseñado específicamente para terror a una persona.' }, { q: '¿Cuál funciona con un grupo casual?', a: 'Mansions of Madness, porque la app gestiona reglas e información oculta.' }],
});

export const editorBatchJuly2026: readonly Guide[] = [
  mejoresPartyGames,
  mejoresColocacionTrabajadores,
  juegosColocacionLosetasBonitos,
  bestCampaignBoardGames,
  bestDeckBuildingGames,
  bestHorrorBoardGames,
];
