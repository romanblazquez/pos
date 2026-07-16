import type { Guide } from '../../lib/guides.js';

// Byline: Kasia Nowak (PL), written natively in English. This guide has NO human
// `translations` block on purpose — its Spanish version is produced automatically
// by Google Translate (tools/content/translate-guides.ts → translations.gen.json),
// demonstrating auto-translation from an English-original editorial.
export const bestSoloBoardGames: Guide = {
  slug: 'best-solo-board-games',
  title: 'The best solo board games',
  authorId: 'kasia-pl',
  originalLocale: 'en',
  description:
    'A guide to the best solo board games: single-player modes with real depth, clever automas and puzzles worth an evening, with prices compared across stores.',
  intro: [
    'A good solo mode is not a consolation prize. The best ones give you a real opponent to outwit or a tight optimisation puzzle to lose an evening to, and they set up and pack away without any fuss. I play most of my games alone, at the kitchen table, and these are the boxes I reach for again and again.',
    'Every game below shines with one player, whether through a built-in automa, a beat-your-own-score challenge, or a cooperative system that scales down cleanly. Each pick links to its product page, where you can compare prices across verified stores.',
  ],
  picks: [
    {
      gameSlug: 'spirit-island-162886',
      blurb:
        'The gold standard for solo play. You defend a living island as elemental spirits, and controlling one or two spirits alone turns the whole game into a pure, brain-burning puzzle. The difficulty scales precisely, so it grows with you for years.',
    },
    {
      gameSlug: 'terraforming-mars-167791',
      blurb:
        'A beat-the-clock solo challenge: terraform the planet within a fixed number of generations. It becomes a tense optimisation race against the calendar, and the huge card pool means no two attempts play the same.',
    },
    {
      gameSlug: 'ark-nova-342942',
      blurb:
        'Its solo mode is a benchmark. You race a scoring track rather than a live rival, and squeezing efficiency out of the rotating action row alone is deeply satisfying. This is the heavy game I solo most often.',
    },
    {
      gameSlug: 'wingspan-266192',
      blurb:
        'The Automa runs a believable opponent with almost no upkeep, so you get all of the gentle engine-building with none of the fuss. A perfect wind-down game for a quiet evening on your own.',
    },
    {
      gameSlug: 'cascadia-295947',
      blurb:
        'A calm, quick tile puzzle that works beautifully as a personal-best chase. Set it up in a minute, spend forty on a tidy optimisation problem, and try to beat your last score. Ideal for a short solo session.',
    },
    {
      gameSlug: 'dwellings-of-eldervale-271055',
      blurb:
        'When you want a solo epic with spectacle, this delivers: a full worker-placement and combat engine against an automated rival, wrapped in oversized fantasy components. Bigger and pricier, but a real event on the table.',
    },
  ],
  sections: [
    {
      heading: 'What makes a great solo game?',
      paragraphs: [
        'Two things, mostly. First, low upkeep: if running the opponent takes longer than your own turn, the game gets in its own way. The best automas (Wingspan, Ark Nova) resolve in seconds. Second, a meaningful goal — a smart rival to beat or a score to chase — so your decisions carry weight.',
        'It also helps when a game teaches itself solo. Learning the rules alone, at your own pace, is one of the quiet joys of the hobby, and every title here rewards that kind of patient, careful play.',
      ],
    },
  ],
  faq: [
    {
      q: 'Are solo board games actually fun on your own?',
      a: 'Absolutely. Modern solo modes are designed as first-class experiences, not afterthoughts. Games like Spirit Island and Ark Nova are, for many players, best enjoyed alone as a pure puzzle.',
    },
    {
      q: 'Which solo game should a beginner start with?',
      a: 'Cascadia and Wingspan are the gentlest starting points: quick to learn, low upkeep and genuinely relaxing. From there, Terraforming Mars and Ark Nova offer a much heavier challenge.',
    },
  ],
  publishedAt: '2026-02-10',
  updatedAt: '2026-05-30',
};
