// Product-page "editor's take" — a short, persona-signed opinion shown on a
// game's page, beneath the catalogue description (see PLAYBOOK §7.3). Unlike the
// long guides, each take is written natively in BOTH locales (they are two or
// three sentences, and a bilingual storefront naturally shows both) — so there
// is no auto-translation flag here. The persona byline is assigned by fit:
// origin, weight and mood of the game vs. the writer's beat (authors.ts).

import { AUTHORS_BY_ID, type Author, type EditorialLocale } from './authors.js';

export interface EditorTake {
  authorId: string;
  es: string;
  en: string;
}

// Keyed by MktProduct slug. Only marquee games carry a take today; the section
// renders only when one exists, so partial coverage degrades gracefully.
export const TAKES: Readonly<Record<string, EditorTake>> = {
  'ark-nova-342942': {
    authorId: 'mateo-ar',
    es: 'Lo tuve semanas en la mesa de los martes y no se gastó: la hilera de acciones te obliga a tener paciencia justo cuando querrías correr. Si te va el euro con muchas piezas encajando, este es de los que se quedan.',
    en: "It sat on my Tuesday table for weeks and never wore thin — the action row makes you wait exactly when you want to sprint. If you love a heavy euro with a hundred parts clicking together, this one earns its spot.",
  },
  'terraforming-mars-167791': {
    authorId: 'mateo-ar',
    es: 'Sigue siendo mi vara de medir para los motores de cartas: arranca lento y de golpe tu tablero se enciende solo. Perdona algo de caos en el reparto, pero premia como pocos planificar tres turnos por delante.',
    en: "It's still my yardstick for card engines: a slow start, then your tableau lights up on its own. It forgives a little draw luck, but few games reward planning three turns ahead like this one.",
  },
  'brass-lancashire-28720': {
    authorId: 'mateo-ar',
    es: 'El que saco cuando quiero que el grupo sufra un poco. La doble era y el manejo de la deuda no se enseñan en una partida, pero cuando cae la ficha, no hay euro económico que le llegue.',
    en: "The one I bring out when I want the group to sweat. The two eras and the debt squeeze don't land in a single play, but once they click, no economic euro touches it.",
  },
  'scythe-169786': {
    authorId: 'mateo-ar',
    es: 'Mucho menos guerrero de lo que promete la caja: casi todo se gana con un motor bien afinado, no a tiros. Esa trampa temática es justo lo que lo hace tan bueno para enganchar a alguien a la estrategia media-alta.',
    en: 'Far less warlike than the box promises — most of it is won with a tuned engine, not with mechs trading blows. That bait-and-switch is exactly what makes it such a good on-ramp to heavier strategy.',
  },
  'dune-imperium-316554': {
    authorId: 'mateo-ar',
    es: 'La mezcla de mazo y colocación no debería funcionar tan limpia y sin embargo ahí está. Es de esos raros pesos medios que enseño en cinco minutos y sigo descubriendo después de veinte partidas.',
    en: "The deck-building and worker-placement blend shouldn't run this clean, and yet it does. It's one of those rare medium weights I can teach in five minutes and still be learning twenty games later.",
  },
  'wingspan-266192': {
    authorId: 'sofia-mx',
    es: 'Es el juego con el que convencí a media familia de que esto no era cosa de niños ni de cerebritos. Bonito, tranquilo y con esa chispa de ver tu motor de aves funcionar solo. Lo regalo sin miedo.',
    en: "It's the game I used to win over half my family, the ones who thought this was only for kids or big brains. Pretty, calm, with that spark of watching your bird engine run itself. I gift it without a second thought.",
  },
  'cascadia-295947': {
    authorId: 'sofia-mx',
    es: 'La puerta de entrada perfecta: se explica mientras repartes y a la segunda ronda ya nadie levanta la vista. Ideal para esas tardes en que quieres jugar en serio pero sin dolor de cabeza.',
    en: "The perfect gateway — you teach it while you deal, and by the second round nobody looks up. Ideal for those afternoons when you want to play properly but without the headache.",
  },
  'patchwork-163412': {
    authorId: 'sofia-mx',
    es: 'Mi juego para dos de cabecera. Parece un rompecabezas mono y de pronto estás peleando cada botón. En casa lo usamos de desempate cuando no nos ponemos de acuerdo en nada más.',
    en: 'My go-to two-player. It looks like a cute puzzle and suddenly you are fighting over every last button. At home it settles arguments when we cannot agree on anything else.',
  },
  'splendor-148228': {
    authorId: 'sofia-mx',
    es: 'El clásico que nunca falla en la mochila. No hay tema ni historia, solo el gustito de ver tu motorcito de gemas acelerar. Perfecto para enseñar a quien dice que no le gustan los juegos de mesa.',
    en: "The classic that never fails in the bag. No theme, no story, just the little thrill of watching your gem engine pick up speed. Perfect for teaching anyone who says they don't like board games.",
  },
  'kingdomino-204583': {
    authorId: 'sofia-mx',
    es: 'Quince minutos, reglas de servilleta y aun así hay decisión de verdad en cada dominó. En casa lo juegan desde los peques hasta la abuela, y esa mesa tan mezclada vale oro.',
    en: 'Fifteen minutes, napkin-sized rules, and still a real decision on every domino. At home everyone plays it, from the little ones to grandma, and that kind of mixed table is worth its weight in gold.',
  },
  'dixit-39856': {
    authorId: 'sofia-mx',
    es: 'Más que un juego es un rompehielos precioso. Sale cuando hay gente nueva en casa y a los diez minutos todos cuentan historias con esas cartas de ensueño. Se gana o se pierde, pero eso es lo de menos.',
    en: "It's less a game than a gorgeous icebreaker. It comes out when there are new faces at home, and ten minutes later everyone is telling stories with those dreamlike cards. You win or lose, but that's beside the point.",
  },
  'onitama-160477': {
    authorId: 'nuria-es',
    es: 'Un tablero de cuatro por cuatro y aun así podéis pasar la tarde leyendo dos jugadas por delante. Me encanta que las cartas pasen al rival: cada movimiento le regala vuestras opciones. Ajedrez de bolsillo, sin la enciclopedia de aperturas.',
    en: "A four-by-four board, and still you can spend an afternoon reading two moves ahead. I love that the cards pass to your opponent — every move hands them your options. Pocket chess, without the encyclopaedia of openings.",
  },
  '7-wonders-duel-173346': {
    authorId: 'nuria-es',
    es: 'Para mí mejora al original, y no lo digo a la ligera. Cada carta que tomáis es una que le negáis al otro, y esa tensión constante en media hora es de una elegancia que pocos duelos alcanzan.',
    en: 'For me it improves on the original, and I do not say that lightly. Every card you take is one you deny the other, and that constant tension in half an hour has an elegance few duels ever reach.',
  },
  'sky-team-373106': {
    authorId: 'nuria-es',
    es: 'Un cooperativo para dos, en silencio, colocando dados en una cabina: suena raro y funciona de maravilla. La tensión de aterrizar sin poder hablar es de las experiencias más finas que he tenido en mesa.',
    en: 'A silent two-player co-op about placing dice in a cockpit — it sounds odd and it works beautifully. The tension of landing a plane without being allowed to talk is one of the finest table experiences I have had.',
  },
  'harmonies-414317': {
    authorId: 'nuria-es',
    es: 'Entra por los ojos y se queda por el puzle. Apilar fichas para formar hábitats es de esos placeres táctiles que no esperas en un peso medio-ligero. Bonito de verdad, y más profundo de lo que aparenta.',
    en: 'It draws you in with its looks and keeps you with the puzzle. Stacking tokens into habitats is one of those tactile pleasures you do not expect in a lighter game. Genuinely lovely, and deeper than it lets on.',
  },
  'spirit-island-162886': {
    authorId: 'eoin-ie',
    es: 'El cooperativo que le puso el listón alto a todos los demás. Cuesta de aprender, no lo voy a negar, pero ganarle a un sistema tan listo en equipo no se parece a nada. Le doy la vuelta al relato colonial y encima juega de maravilla.',
    en: "The co-op that set the bar for everyone else. It's a brute to learn, I won't pretend otherwise, but beating a system this clever as a team is like nothing else. It flips the colonial story on its head and plays like a dream on top of it.",
  },
  'pandemic-30549': {
    authorId: 'eoin-ie',
    es: 'Sé que hay cooperativos más nuevos y brillantes, pero este sigue siendo el que saco para enseñar cómo se juega en equipo. La cuenta atrás de los brotes todavía aprieta. Un clásico por algo.',
    en: "I know there are shinier co-ops now, but this is still the one I reach for to teach a table how to pull together. The outbreak countdown still bites. A classic for a reason.",
  },
  'frosthaven-295770': {
    authorId: 'eoin-ie',
    es: 'No es un juego, es un hobby dentro del hobby. Meses de campaña, una caja que pesa como un ladrillo y un grupo fijo que quiera vivirlo. Si tenéis las dos cosas, no hay aventura cooperativa que se le acerque.',
    en: "It isn't a game, it's a hobby inside the hobby. Months of campaign, a box that weighs like a brick, and a steady group willing to live in it. If you have both, no co-op adventure comes close.",
  },
  'arcs-359871': {
    authorId: 'eoin-ie',
    es: 'Un juego de galaxia que no perdona y me tiene enganchado justo por eso. Las bazas mandando en un 4X es una idea rara que a nuestra mesa le cambió la cabeza. No es para todos, y ahí está su gracia.',
    en: 'A galactic game that gives no quarter, and I love it for exactly that. Trick-taking steering a 4X is a strange idea that rewired our table. Not for everyone, and that is the whole charm of it.',
  },
  'root-237182': {
    authorId: 'kasia-pl',
    es: 'Bajo esas ilustraciones tan tiernas se esconde uno de los juegos asimétricos más afilados que existen. Cada facción se juega distinta de verdad, y ahí está el reto: entender a los demás tanto como tu propio bando.',
    en: 'Under all that adorable art hides one of the sharpest asymmetric games there is. Every faction really does play differently, and that is the challenge — reading the others as well as you read your own side.',
  },
  'wyrmspan-410201': {
    authorId: 'kasia-pl',
    es: 'Sí, es el primo dragón de Wingspan, pero con más músculo en el motor y un solitario que me tiene enganchada. Si querías algo con la misma calma pero más para roer, aquí lo tienes.',
    en: "Yes, it's Wingspan's dragon cousin, but with more muscle in the engine and a solo mode I keep coming back to. If you wanted the same calm with more to chew on, here it is.",
  },
  'food-chain-magnate-175914': {
    authorId: 'kasia-pl',
    es: 'Brutal, sin red de seguridad y absolutamente brillante. No hay azar donde esconderte: si pierdes, fue tu plan. Lo reservo para la gente que quiere que un juego les muerda de verdad.',
    en: 'Brutal, no safety net, and absolutely brilliant. There is no luck to hide behind — if you lose, it was your plan. I save it for people who want a game to genuinely bite back.',
  },
  'cthulhu-death-may-die-253344': {
    authorId: 'dave-us',
    es: 'Aquí no vienes a sobrevivir con cuidado: vienes a volarle la cabeza a un dios antiguo a tiros. Miniaturas enormes, dados a puñados y risas en la mesa. Deja la estrategia fina en casa y pásalo en grande.',
    en: "You don't come here to survive carefully — you come to shoot an elder god in the face. Big minis, fistfuls of dice, and a loud table. Leave the fine strategy at home and just have a blast.",
  },
  'king-of-tokyo-70323': {
    authorId: 'dave-us',
    es: 'El que pongo cuando la mesa está llena y quiero ruido bueno. Monstruos, dados a lo Yahtzee y esa decisión tonta y genial de si te quedas en Tokio a comer golpes. Con los peques y con cervezas, siempre gana.',
    en: "The one I drop when the table's full and I want good noise. Monsters, Yahtzee dice, and that dumb-brilliant choice of whether to sit in Tokyo and eat the hits. With kids or with beers, it always lands.",
  },
};

/** Resolve a game's editor's take + its author for the given locale, or null. */
export function editorTake(
  slug: string,
  locale: EditorialLocale,
): { author: Author; text: string } | null {
  const take = TAKES[slug];
  if (!take) return null;
  const author = AUTHORS_BY_ID[take.authorId];
  if (!author) return null;
  return { author, text: take[locale] };
}
