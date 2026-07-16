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

  // ── Batch 2: full-catalogue coverage (2026-07-16) ──────────────────────────
  'the-white-castle-371942': {
    authorId: 'nuria-es',
    es: 'Una caja pequeña con un puente elegante donde colocáis dados que van bajando: cada uno abre una acción distinta según dónde caiga. Me fascina cuánta decisión meten en tan poco espacio, y lo bonito que queda montado.',
    en: 'A small box with an elegant bridge where you place dice that slide down, each opening a different action depending on where it lands. I love how much decision they pack into so little space, and how lovely it looks set up.',
  },
  'calico-283155': {
    authorId: 'nuria-es',
    es: 'Un puzle precioso y sorprendentemente cruel: coser una manta de gatos parece dulce hasta que os peleáis por el último parche que os cuadra. Abstracto de los buenos, de los que se ven tan bien como se piensan.',
    en: 'A gorgeous, surprisingly mean little puzzle: quilting a blanket of cats looks sweet until you are fighting for the one patch that fits. Abstract at its best — the kind that looks as good as it plays.',
  },
  'potion-explosion-180974': {
    authorId: 'nuria-es',
    es: 'Sacar una canica y ver estallar toda la cadena es de esos placeres físicos que ningún juego digital os dará. Detrás del gancho táctil hay un puzle de colección muy majo. Entra por las manos.',
    en: 'Pulling one marble and watching the whole chain explode is one of those physical pleasures no screen will ever give you. Behind the tactile hook sits a tidy little set-collection puzzle. It gets you through your hands.',
  },
  'knarr-379629': {
    authorId: 'nuria-es',
    es: 'Un motorcito vikingo limpísimo: dos decisiones por turno y aun así notáis crecer la máquina. Me gusta lo poco que estorba —ni tiempos muertos ni reglas de más— y lo bien que cabe en cualquier hueco de la tarde.',
    en: 'A spotless little Viking engine: two choices a turn and yet you feel the machine grow. I love how little it gets in the way — no downtime, no spare rules — and how neatly it fits any gap in the afternoon.',
  },
  'mille-fiori-346501': {
    authorId: 'nuria-es',
    es: 'Knizia haciendo lo que mejor sabe: encadenar cartas de vidrio veneciano hasta que un solo turno enciende medio tablero. Elegante, medido y con esa satisfacción de ver la cascada correr. Un euro de relojero.',
    en: "Knizia doing what he does best: chaining Venetian-glass cards until one turn lights up half the board. Elegant, measured, with that satisfaction of watching the cascade run. A watchmaker's euro.",
  },
  'splendor-marvel-293296': {
    authorId: 'nuria-es',
    es: 'El motor de gemas de siempre, tan limpio como recordáis, pero con la carrera por el Guantelete que mantiene a todos vigilando. Si Splendor os gustaba, esta capa extra le sienta de maravilla sin ensuciarlo.',
    en: 'The same gem engine, as clean as you remember, but with the race for the Gauntlet keeping everyone watching. If you liked Splendor, this extra layer suits it beautifully without muddying it.',
  },
  '7-wonders-architects-346703': {
    authorId: 'nuria-es',
    es: 'La versión que dejo a quien nunca ha jugado a 7 Wonders: robas una carta, la juegas y ya está. Conserva la sensación de construir una maravilla sin una sola regla de más. Puerta de entrada de diseño impecable.',
    en: 'The version I hand to anyone who has never touched 7 Wonders: draw a card, play it, done. It keeps the feel of raising a wonder without a single spare rule. A gateway of impeccable design.',
  },
  'darwin-s-journey-322289': {
    authorId: 'mateo-ar',
    es: 'De los euros más densos que tengo, y de los que más me gusta enseñar despacio. Mandás a tus naturalistas a las Galápagos y todo se encadena: educación, cartas, sellos. Si te va el peso pesado, no te lo pierdas.',
    en: 'One of the heaviest euros I own, and one I most enjoy teaching slowly. You send naturalists to the Galápagos and everything links up — schooling, cards, stamps. If you go for the heavy stuff, do not miss it.',
  },
  'dwellings-of-eldervale-271055': {
    authorId: 'mateo-ar',
    es: 'Un bicho grande que mezcla colocación, dados y algo de pelea, con una producción que quita el aliento. No es el euro más fino, pero cuando querés algo épico en la mesa cumple como pocos. A mí me ganó por lo temático.',
    en: 'A big beast mixing worker placement, dice and a bit of a scrap, with production that takes your breath away. Not the tightest euro, but when you want something epic on the table, few deliver like it. The theme won me over.',
  },
  '7-wonders-68448': {
    authorId: 'mateo-ar',
    es: 'El draft que le enseñó a media generación qué es armar una civilización en tres rondas. Escala hasta siete sin alargarse porque todos juegan a la vez. Un clásico moderno que sigo sacando sin pensarlo.',
    en: 'The draft that taught half a generation what building a civilisation in three rounds feels like. It scales to seven without dragging because everyone plays at once. A modern classic I still bring out without a second thought.',
  },
  'it-s-a-wonderful-world-271324': {
    authorId: 'mateo-ar',
    es: 'Un motor de cartas rapidísimo que se siente como un Terraforming ligero y comprimido. Drafteás, decidís qué reciclar y ves tu producción dispararse. Ideal para esa noche que querés estrategia pero sin tres horas por delante.',
    en: 'A lightning-fast card engine that feels like a lean, compressed Terraforming. You draft, decide what to recycle, and watch your production take off. Perfect for the night you want strategy but not three hours of it.',
  },
  'earth-350184': {
    authorId: 'mateo-ar',
    es: 'Para mí es lo que Wingspan quería ser para el jugador de motor: cada carta que ponés dispara acciones en cadena por toda la mesa. Un tapiz enorme y muy satisfactorio, con un solitario que aguanta solo. Me tiene enganchado.',
    en: 'For me it is what Wingspan wanted to be for the engine player: every card you lay fires a chain of actions across the table. A huge, deeply satisfying tableau, with a solo mode that stands on its own. It has me hooked.',
  },
  'carpe-diem-245934': {
    authorId: 'mateo-ar',
    es: 'Feld en formato apretado: drafteás losetas dando vueltas a un anillo y todo alimenta cinco marcadores a la vez. Sin relleno, pura ensalada de puntos bien armada. De esos que terminás y ya querés la revancha.',
    en: 'Feld in tight format: you draft tiles around a ring and everything feeds five tracks at once. No filler, just a well-built point salad. The kind you finish and immediately want the rematch.',
  },
  'honey-buzz-284742': {
    authorId: 'mateo-ar',
    es: 'Debajo de las abejas monas hay una economía chiquita y muy pulida: recuperás obreras, drafteás panales y dónde encajás cada hexágono cambia lo que podés hacer. Un peso medio que rinde más de lo que aparenta.',
    en: 'Under the cute bees sits a small, well-polished economy: you retrieve workers, draft comb tiles, and where you slot each hexagon changes what you can do. A medium weight that gives back more than it lets on.',
  },
  'forest-shuffle-391163': {
    authorId: 'sofia-mx',
    es: 'Un motor de cartas del bosque que se explica en dos minutos y engancha a toda la familia. Emparejas árboles y animalitos y de pronto tu ecosistema puntúa solo. Bonito, ágil y perfecto para la mesa de un domingo.',
    en: 'A forest card engine you can teach in two minutes that pulls the whole family in. You pair trees and little animals and suddenly your ecosystem scores itself. Pretty, quick, and perfect for a Sunday table.',
  },
  'just-one-254640': {
    authorId: 'sofia-mx',
    es: 'El cooperativo de palabras que pone a todos a reír. Escriben una pista cada quien, y las repetidas se borran, así que hay que pensar distinto al de al lado. En casa siempre acaba en carcajada. Un fijo para gente nueva.',
    en: 'The word co-op that gets everyone laughing. You each write one clue, matching ones cancel out, so you have to think differently from your neighbour. At home it always ends in giggles. A staple for new faces.',
  },
  'stone-age-34635': {
    authorId: 'sofia-mx',
    es: 'Mi puerta de entrada favorita a la colocación de trabajadores: mandas a tu tribu a cazar, cortar madera y tener bebés, con dados que dan justo la emoción necesaria. Cálido, claro y muy amable con quien empieza.',
    en: 'My favourite gateway to worker placement: you send your tribe to hunt, chop wood and have babies, with dice that add just the right spark. Warm, clear, and very kind to newcomers.',
  },
  'carcassonne-822': {
    authorId: 'sofia-mx',
    es: 'El clásico de losetas que casi todos jugamos primero, y con razón. Vas colocando el paisaje y peleando ciudades y caminos sin darte cuenta. Sigue siendo de los mejores para sentar a la familia entera. Nunca pasa de moda.',
    en: 'The tile-laying classic most of us played first, and for good reason. You build the landscape and quietly fight over cities and roads. It is still one of the best for sitting the whole family down. It never goes out of style.',
  },
  'sushi-go-party-192291': {
    authorId: 'sofia-mx',
    es: 'La versión grande del querido juego de bolsillo, para hasta ocho y con menú a la carta. Drafteas sushi, te quedas uno y pasas el resto, y no hay dos partidas iguales. Colorido, monísimo y un éxito en cualquier reunión.',
    en: 'The big version of the beloved pocket game, for up to eight and with an à la carte menu. You draft sushi, keep one, pass the rest, and no two games play alike. Colourful, adorable, and a hit at any gathering.',
  },
  'sushi-go-133473': {
    authorId: 'sofia-mx',
    es: 'Quince minutos de puro gustito: pasas la mano, juntas conjuntos y guardas hueco para el postre. Es el que llevo de viaje y el que uso para enseñar el draft a quien nunca lo probó. Chiquito y encantador.',
    en: 'Fifteen minutes of pure delight: pass the hand, gather sets, and save room for pudding. It is the one I take travelling and the one I use to teach drafting to anyone who has never tried it. Tiny and charming.',
  },
  'flamecraft-336986': {
    authorId: 'sofia-mx',
    es: 'Puro confort de mesa: un pueblo de dragoncitos artesanos a los que pones a trabajar en sus tiendas. Hay decisión de verdad bajo tanta ternura, pero nada muerde. Perfecto para una noche tranquila, y un regalo precioso.',
    en: 'Pure comfort gaming: a town of little artisan dragons you put to work in their shops. There is real decision under all the cuteness, but nothing bites. Perfect for a quiet night, and a lovely gift.',
  },
  'hitster-318243': {
    authorId: 'sofia-mx',
    es: 'Escaneas, suena una canción y tienes que colocarla en tu línea del tiempo: ¿antes o después? No hay nada que preparar y en un minuto toda la fiesta está cantando y discutiendo. El rompehielos más fácil que abrirás.',
    en: 'You scan, a song plays, and you slot it into your timeline: before or after? There is nothing to set up, and within a minute the whole party is singing and arguing. The easiest icebreaker you will ever open.',
  },
  'flip-7-420087': {
    authorId: 'sofia-mx',
    es: 'Giras cartas persiguiendo puntos y, si sale una repetida, revientas y lo pierdes todo. ¿Te plantas o tientas la suerte una vez más? Escala a un montón de gente y da tantas risas que siempre cae "una más".',
    en: 'You flip cards chasing points and, if a duplicate turns up, you bust and lose it all. Do you bank it or push your luck once more? It scales to a big crowd and gets so many laughs that it always turns into "one more".',
  },
  'spicy-299169': {
    authorId: 'sofia-mx',
    es: 'Un juego de faroles precioso: juegas una carta boca abajo y la cantas, aunque estés mintiendo descaradamente. Alguien te desafía y se lleva el montón el que se equivoca. Pequeño, con cara de póker y muy para regalar.',
    en: 'A gorgeous little bluffing game: you play a card face down and call it, even if you are lying through your teeth. Someone challenges, and whoever is wrong takes the pile. Small, poker-faced, and very giftable.',
  },
  'rhino-hero-super-battle-218333': {
    authorId: 'sofia-mx',
    es: 'Construir un rascacielos tembloroso y mandar monitos superhéroes a trepar por él es pura tensión de dedos. Peques y grandes chillan igual cuando todo se tambalea. Habilidad de la buena para toda la familia.',
    en: 'Building a wobbly skyscraper and sending superhero monkeys climbing up it is pure white-knuckle fun. Kids and grown-ups shriek alike when it all teeters. Dexterity done right, for the whole family.',
  },
  'zombie-kittens-362202': {
    authorId: 'sofia-mx',
    es: 'La secuela de Exploding Kittens con un giro travieso: que te eliminen no te deja fuera, vuelves como zombi. Rápido, tonto en el mejor sentido y con esa segunda vida que mantiene a todos en el caos hasta el final.',
    en: 'The Exploding Kittens sequel with a cheeky twist: getting knocked out does not put you out, you come back as a zombie. Fast, silly in the best way, with that second life keeping everyone in the chaos to the end.',
  },
  'junk-art-revolution-448188': {
    authorId: 'sofia-mx',
    es: 'Apilar chatarra de colores en esculturas imposibles nunca falla en una mesa animada. Trae un puñado de minijuegos, así que no aburre, y funciona igual con peques que con amigos. Manual, ruidoso y muy divertido.',
    en: 'Stacking colourful junk into impossible sculptures never fails at a lively table. It brings a bundle of mini-games, so it never gets stale, and works as well with kids as with friends. Hands-on, loud, and a lot of fun.',
  },
  'cats-knocking-things-off-ledges-459990': {
    authorId: 'sofia-mx',
    es: 'Hace exactamente lo que dice el título: eres un gato que tira cosas de las repisas a capirotazos. Absurdo, rapidísimo y con una puntería que peques y adultos disfrutan igual. El aperitivo perfecto para abrir la noche.',
    en: 'It does exactly what the title says: you are a cat flicking things off shelves. Absurd, lightning-quick, and with an aim that kids and adults enjoy in equal measure. The perfect opener for the night.',
  },
  'dixit-odyssey-92828': {
    authorId: 'sofia-mx',
    es: 'La versión de fiesta del Dixit de siempre: hasta doce personas y cartas nuevas de ensueño. La magia es la misma —una pista, ni muy obvia ni muy rara— pero pensada para mesas grandes. Perfecto cuando la casa se llena.',
    en: 'The party-sized version of the Dixit you know: up to twelve people and new dreamlike cards. The magic is the same — one clue, neither too obvious nor too cryptic — but built for big tables. Perfect when the house fills up.',
  },
  'iss-vanguard-325494': {
    authorId: 'eoin-ie',
    es: 'Una campaña de ciencia ficción enorme donde tu tripulación baja a planetas y todo tiene consecuencias. Es un compromiso —tiempo, mesa, un grupo fijo— pero la sensación de misión a misión es de las mejores que conozco.',
    en: 'A huge sci-fi campaign where your crew drops onto planets and everything has consequences. It is a commitment — time, table, a steady group — but the mission-to-mission feel is some of the best I know.',
  },
  'micromacro-crime-city-318977': {
    authorId: 'eoin-ie',
    es: 'Un mapa gigante en blanco y negro y una lupa: rastreas crímenes hacia adelante y hacia atrás por las calles. No hay dados ni montaje, solo observación pura y decenas de historias escondidas a la vista. No se parece a nada.',
    en: 'One giant black-and-white map and a magnifying glass: you trace crimes back and forth through the streets. No dice, no setup, just pure observation and dozens of stories hiding in plain sight. It is unlike anything else.',
  },
  'micromacro-crime-city-full-house-338834': {
    authorId: 'eoin-ie',
    es: 'Más casos y una ciudad nueva, y no necesita nada del original. Misma lupa, mismo placer de reconstruir un crimen mirando bien. Si el primero te atrapó, este es más de lo mismo bueno; si no lo probaste, empieza por cualquiera.',
    en: 'More cases and a whole new city, and it needs nothing from the original. Same magnifying glass, same joy of piecing a crime together by looking closely. If the first one caught you, this is more of the same good stuff; if not, start with either.',
  },
  'mysterium-181304': {
    authorId: 'eoin-ie',
    es: 'Una sesión de espiritismo hecha cooperativo: un fantasma mudo os pasa visiones oníricas y el resto interpreta para dar con el culpable. Atmosférico, precioso y con esa gracia de discutir qué demonios significa cada carta.',
    en: 'A séance turned co-op: a silent ghost feeds you dreamlike visions and the rest read them to name the culprit. Atmospheric, gorgeous, with all the fun of arguing over what on earth each card means.',
  },
  'take-time-440540': {
    authorId: 'eoin-ie',
    es: 'Un cooperativo callado y astuto sobre decir mucho menos de lo que querrías. Vais leyendo las pistas racionadas de los demás hasta coincidir, y cuando el grupo hace clic, da gustazo. Pequeño, tranquilo y para gente que se conoce.',
    en: 'A quiet, clever co-op about saying far less than you would like. You read one another\'s rationed clues until you line up, and when the group clicks, it is a joy. Small, calm, and for people who know each other.',
  },
  'keep-the-heroes-out-333255': {
    authorId: 'eoin-ie',
    es: 'Le da la vuelta al dungeon: sois los monstruos defendiendo la guarida de unos héroes codiciosos. Un tower defense cooperativo con puzles tensos y un arte de dibujos adorable. Fresco, divertido y con buen solitario.',
    en: 'It flips the dungeon: you are the monsters defending your lair from greedy heroes. A co-operative tower defence with tense puzzles and gloriously cute art. Fresh, funny, and with a solid solo mode.',
  },
  'hanabi-98778': {
    authorId: 'eoin-ie',
    es: 'El cooperativo que sostienes al revés: todos ven tu mano menos tú. Con un puñado de pistas montáis fuegos artificiales en orden, confiando en lo que os dicen los demás. Un rompecabezas de equipo elegante y tenso. Cabe en un bolsillo.',
    en: 'The co-op you hold backwards: everyone sees your hand but you. With a handful of hints you build fireworks in order, trusting what the others tell you. An elegant, tense team puzzle. It fits in a pocket.',
  },
  'turing-machine-356123': {
    authorId: 'kasia-pl',
    es: 'Un ordenador de papel que descifras solo con lógica: sin app, sin pilas, sin solucionario. Interrogas a la máquina con tarjetas perforadas hasta deducir el código. Para quien de niño adoraba los pasatiempos de lógica, es un caramelo.',
    en: 'A paper computer you crack with logic alone — no app, no batteries, no answer key. You interrogate the machine with punched cards until you deduce the code. For anyone who loved logic puzzles as a kid, it is candy.',
  },
  'finspan-436126': {
    authorId: 'kasia-pl',
    es: 'El primo submarino de Wingspan, más ágil pero con un motor con más músculo del que esperas. Bajas peces por las capas del océano encadenando huevos y comida. El solitario me tiene enganchada; tranquilo y adictivo a partes iguales.',
    en: "Wingspan's underwater cousin, quicker but with more muscle in the engine than you expect. You play fish down through the ocean layers, chaining eggs and food. The solo mode has me hooked — calm and addictive in equal measure.",
  },
  'kinfire-delve-vainglory-s-grotto-391795': {
    authorId: 'kasia-pl',
    es: 'Todo un dungeon crawl cooperativo metido en una cajita de cartas. Tiras dados, gestionas la luz y avanzas por el mazo hacia el jefe antes de quedarte sin recursos. Sola o para dos, es un remate de noche perfecto. Me encanta lo mucho que cabe aquí.',
    en: 'A whole co-op dungeon crawl squeezed into one small box of cards. You roll dice, manage the light, and push through the deck toward a boss before your resources run out. Solo or for two, it is a perfect nightcap. I love how much fits in here.',
  },
  'kinfire-chronicles-night-s-fall-364655': {
    authorId: 'kasia-pl',
    es: 'La aventura cooperativa grande de la línea: exploras un mundo precioso por misiones ramificadas, afinando tu mazo de acciones. Una velada entera de rol sin director de juego. Si te va la progresión y la historia, es un juegazo.',
    en: 'The big co-op adventure of the line: you explore a beautiful world through branching quests, tuning your action deck. A whole evening of role-playing with no Game Master. If you love progression and story, it is a standout.',
  },
  'kinfire-delve-scorn-s-stockade-404538': {
    authorId: 'kasia-pl',
    es: 'Otra caja Delve independiente: nueva mazmorra, nuevo jefe, misma tensión de bajar por el mazo apostando cuánto arriesgar. Compacta, rejugable y perfecta para noches en solitario. Para mí, el "coge y explora" ideal de la mochila.',
    en: 'Another stand-alone Delve box: new dungeon, new boss, same tension of pushing through the deck gambling on how far to go. Compact, replayable, and perfect for solo nights. For me, the ideal pick-up-and-crawl in the bag.',
  },
  'kinfire-delve-callous-lab-406174': {
    authorId: 'kasia-pl',
    es: 'Un capítulo Delve más, autoconclusivo, con su propia mazmorra y su jefe amenazante. Combates con dados, racionas la luz y decides hasta dónde adentrarte. Ajustado, portátil y muy rejugable. Otro bocado excelente para jugar sola.',
    en: 'One more Delve chapter, self-contained, with its own dungeon and menacing boss. You fight with dice, ration the light, and decide how deep to go. Tight, portable, and richly replayable. Another excellent bite to play solo.',
  },
  'skull-king-150145': {
    authorId: 'dave-us',
    es: 'Bazas con una promesa cruel: apuestas exactamente cuántas vas a ganar, ni una más ni una menos. Piratas, sirenas y el propio Rey Calavera te vuelan los planes. Se enseña en dos minutos y da más risa cuanta más gente metes.',
    en: 'Trick-taking with a cruel promise: you bid exactly how many you will win, no more, no fewer. Pirates, mermaids and the Skull King himself blow up your plans. Teaches in two minutes and gets funnier the more people you cram in.',
  },
  'toy-battle-434654': {
    authorId: 'dave-us',
    es: 'Un duelo de quince minutos de soldaditos y tanques de juguete peleando por zonas. Sin tiempos muertos ni reglamento eterno, solo control de área agresivo que se reinicia rápido y pide revancha. Estrategia en caja chica.',
    en: 'A fifteen-minute duel of toy soldiers and tanks fighting over zones. No downtime, no endless rulebook, just aggressive area control that resets fast and begs for a rematch. Strategy in a small box.',
  },
  'can-t-stop-41': {
    authorId: 'dave-us',
    es: 'El "tienta a la suerte" reducido a una pregunta angustiosa: ¿tiras otra vez o te plantas? Casi cincuenta años y sigue dando la emoción de apostar más pura que hay. La mesa entera gime y grita con cada tirada. Un clásico intocable.',
    en: 'Push-your-luck boiled down to one agonising question: roll again or stop? Nearly fifty years old and it still delivers the purest gambling thrill there is. The whole table groans and cheers with every throw. An untouchable classic.',
  },
  'las-vegas-royale-271319': {
    authorId: 'dave-us',
    es: 'Tiras un puñado de dados y los apuestas en los casinos, peleando por la mayoría, y los empates se anulan enteros. Ruidoso, cambiante y con presencia de verdad en la mesa. La edición de lujo de un clásico de dados que siempre cae bien.',
    en: 'You roll a fistful of dice and bet them on casinos, fighting for the majority, and ties cancel out entirely. Loud, swingy, with real presence on the table. The deluxe edition of a dice classic that always goes down well.',
  },
  'deep-sea-adventure-169654': {
    authorId: 'dave-us',
    es: 'Una cajita de pura codicia: todos compartís un tanque de aire y cada tesoro que agarras se lo quema al equipo entero. Tienta demasiado hondo y te ahogas con todo el botín. La mesa gime con cada paso. Pequeño y brutal.',
    en: 'A tiny box of pure greed: you all share one air tank, and every treasure you grab burns air for the whole crew. Push too deep and you drown with the lot. The table groans with every step. Small and brutal.',
  },
  'disney-villainous-wicked-to-the-core-271518': {
    authorId: 'dave-us',
    es: 'Juegas al villano: Hades, el Dr. Facilier o la Reina Malvada, cada uno con su tablero y su plan perverso. La gracia es avanzar tu intriga mientras los rivales te sueltan héroes encima. Funciona solo o mezclado. Un caramelo para fans de Disney.',
    en: 'You play the villain — Hades, Dr. Facilier or the Evil Queen, each with their own board and wicked plan. The fun is advancing your scheme while rivals drop heroes on you. Works alone or mixed in. A treat for Disney fans.',
  },
  'disney-villainous-evil-comes-prepared-284760': {
    authorId: 'dave-us',
    es: 'Otro capítulo independiente con Scar, Ratigan e Yzma, cada uno con su condición de victoria retorcida. Sigues tu trama privada mientras estorbas la de los demás, y no hay dos villanos iguales. Temático a tope y muy rejugable.',
    en: 'Another stand-alone chapter with Scar, Ratigan and Yzma, each with their own twisted win condition. You follow your private plot while gumming up everyone else\'s, and no two villains feel alike. Deeply thematic and very replayable.',
  },
  'disney-villainous-the-worst-takes-it-all-256382': {
    authorId: 'dave-us',
    es: 'La expansión que sube el villaneo hasta seis jugadores, con Gastón, el Rey Cornudo y más. Necesita una caja base, pero premia a quien ya adora la serie con duelos más grandes y caóticos. La elección para las noches Villainous en grande.',
    en: 'The expansion that swells the villainy to six players, with Gaston, the Horned King and more. It needs a base box, but rewards anyone who already loves the series with bigger, more chaotic showdowns. The pick for large Villainous nights.',
  },
  'arkham-horror-lovecraft-letter-424784': {
    authorId: 'dave-us',
    es: 'Love Letter con un giro lovecraftiano: cartas de Locura que te dan poder a cambio de arriesgar la eliminación. Esa tensión entre ir seguro o apostar por el poder prohibido le da chispa nueva a un clásico. Rápido, afilado y muy rejugable.',
    en: 'Love Letter with a Lovecraftian twist: Insanity cards that hand you power in exchange for risking elimination. That tension between playing safe and gambling on forbidden power gives an old classic new spark. Fast, sharp, and very replayable.',
  },
  'zombicide-white-death-383496': {
    authorId: 'dave-us',
    es: 'Una montaña de miniaturas y una horda de muertos vivientes en un mundo de fantasía helado. Te mueves, buscas equipo y arrasas zombis, pero cada ruido atrae a más. Gloriosamente excesivo y pensado para grandes noches cooperativas. Justo mi rollo.',
    en: 'A mountain of miniatures and a horde of undead in a frozen fantasy world. You move, hunt for gear and blast zombies, but every noise draws more. Gloriously excessive and built for big co-op nights. Right up my alley.',
  },
  'zombicide-white-death-eternal-empire-385623': {
    authorId: 'dave-us',
    es: 'Una expansión que vuelca más miniaturas, enemigos y escenarios en el White Death, así que necesita el juego base. Está pensada de lleno para quien ya cayó rendido ante la horda y quiere más mapas y más monstruos que arrasar. Ampliación generosa.',
    en: 'An expansion that pours more miniatures, foes and scenarios into White Death, so it needs the base game. It is aimed squarely at anyone already smitten with the horde who wants more maps and more monsters to grind through. A generous top-up.',
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
