/**
 * One-time backfill for MktProduct.mechanics.
 *
 * Ingestion used to write only the blended `tags` column (categories and
 * mechanics merged, capped at 12 total) — see the fix in mkt-catalog.service.ts
 * and worker.ts that now also writes the clean `mechanics` column going
 * forward. This script recovers the best available answer for every product
 * imported/enriched before that fix landed.
 *
 * The original per-product BGG category/mechanic arrays were never stored
 * separately, so there is no way to perfectly reconstruct history — some
 * games already lost mechanics to the 12-item tags cap. Instead this
 * intersects each product's `tags` against BGG's own official mechanic
 * vocabulary (below): precision over recall. A tag that matches a known
 * mechanic name is trusted; nothing is guessed. Real mechanics that got
 * truncated out of `tags` before this backfill stay empty until the
 * product's next BGG re-enrichment, which now writes `mechanics` correctly.
 *
 * Usage: DATABASE_URL=... npx tsx apps/api/scripts/backfill-mechanics.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import Typesense from 'typesense';

const prisma = new PrismaClient();
const search = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST ?? 'localhost',
    port: Number(process.env.TYPESENSE_PORT ?? 8108),
    protocol: 'http',
  }],
  apiKey: process.env.TYPESENSE_API_KEY ?? 'dev-typesense-key',
  connectionTimeoutSeconds: 10,
});

// BGG's official boardgamemechanic taxonomy. Stable, rarely changes.
const KNOWN_MECHANICS = [
  'Action Drafting', 'Action Points', 'Action Queue', 'Action Retrieval', 'Action Timer',
  'Advantage Token', 'Alliances', 'Area Majority / Influence', 'Area Movement', 'Area-Impulse',
  'Auction/Bidding', 'Auction: Dutch', 'Auction: Dutch Priority', 'Auction: English',
  'Auction: Fixed Placement', 'Auction: Dexterity', 'Auction: Once Around', 'Auction: Sealed Bid',
  'Auction: Turn Order Until Pass', 'Automatic Resource Growth', 'Bag Building',
  'Betting and Bluffing', 'Bias', 'Bingo', 'Bribery', 'Campaign / Battle Card Driven',
  'Card Play Conflict Resolution', 'Catch the Leader', 'Chaining', 'Chit-Pull System',
  'Closed Drafting', 'Open Drafting', 'Command Cards', 'Commodity Speculation', 'Communication Limits',
  'Connections', 'Constrained Bidding', 'Contracts', 'Cooperative Game', 'Crayon Rail System',
  'Critical Hits and Failures', 'Cube Tower', 'Deck, Bag, and Pool Building', 'Deck Construction',
  'Deduction', 'Delayed Purchase', 'Dice Rolling', 'Different Dice Movement',
  'Elapsed Real Time Ending', 'Enclosure', 'End Game Bonuses', 'Events', 'Finale Ending',
  'Flicking', 'Follow', 'Force Commitment', 'Grid Coverage', 'Grid Movement', 'Hand Management',
  'Hexagon Grid', 'Hidden Movement', 'Hidden Roles', 'Hidden Victory Points',
  'Highest-Lowest Scoring', 'Hot Potato', 'I Cut, You Choose', 'Impulse Movement',
  'Increase Value of Unchosen Resources', 'Income', 'Interrupts', 'Investment', 'Kill Steal',
  'King of the Hill', 'Ladder Climbing', 'Layering', "Le Her", 'Legacy Game', 'Line Drawing',
  'Line of Sight', 'Loans', 'Lose a Turn', 'Mancala', 'Map Addition', 'Map Deformation',
  'Map Reduction', 'Market', 'Matching', 'Measurement Movement', 'Melding and Splaying',
  'Memory', 'Minimap Resolution', 'Modular Board', 'Move Through Deck', 'Movement Points',
  'Movement Template', 'Moving Multiple Units', 'Multi-Use Cards', 'Multiple Maps',
  'Narrative Choice / Paragraph', 'Negotiation', 'Neighbor Scope', 'Network and Route Building',
  'Once-Per-Game Abilities', 'Order Counters', 'Ordering', 'Ownership', 'Paper-and-Pencil',
  'Passed Action Token', 'Pattern Building', 'Pattern Movement', 'Pattern Recognition',
  'Physical Removal', 'Pick-up and Deliver', 'Pieces as Map', 'Player Elimination',
  'Player Judge', 'Point to Point Movement', 'Predictive Bid', "Prisoner's Dilemma",
  'Programmed Movement', 'Push Your Luck', 'Questions and Answers', 'Race', 'Random Production',
  'Ratio / Combat Results Table', 'Re-rolling and Locking', 'Real-Time', 'Relative Movement',
  'Removal', 'Resource Queue', 'Resource to Move', 'Rock-Paper-Scissors', 'Role Playing',
  'Roles with Asymmetric Information', 'Roll / Spin and Move', 'Rondel',
  'Scenario / Mission / Campaign Game', 'Score-and-Reset Game', 'Secret Unit Deployment',
  'Semi-Cooperative Game', 'Set Collection', 'Simulation', 'Simultaneous Action Selection',
  'Singing', 'Sitting Out', 'Slide/Push', 'Solo / Solitaire Game', 'Speed Matching', 'Spelling',
  'Square Grid', 'Stacking and Balancing', 'Stat Check Resolution', 'Static Capture',
  'Stock Holding', 'Storytelling', 'Sudden Death Ending', 'Take That', 'Targeted Clues',
  'Team-Based Game', 'Tech Trees / Tech Tracks', 'Three Dimensional Movement', 'Tile Placement',
  'Time Track', 'Track Movement', 'Trading', 'Traitor Game', 'Trick-taking', 'Tug of War',
  'Turn Order: Auction', 'Turn Order: Claim Action', 'Turn Order: Pass Order',
  'Turn Order: Progressive', 'Turn Order: Random', 'Turn Order: Role Order',
  'Turn Order: Stat-Based', 'Turn Order: Time Track', 'Variable Phase Order',
  'Variable Player Powers', 'Variable Set-up', 'Victory Points as a Resource', 'Voting',
  'Worker Placement', 'Worker Placement with Dice Workers',
  'Worker Placement, Different Worker Types', 'Zone of Control',
];

const CHUNK_SIZE = 1000;

async function main() {
  console.log(`Backfilling against ${KNOWN_MECHANICS.length} known mechanic names...`);

  // Explicit ARRAY[...] literal via Prisma.join rather than binding a JS array
  // to a single placeholder — the latter's cast behavior isn't guaranteed
  // across Prisma's PostgreSQL raw-query paths, this is unambiguous.
  const mechanicsLiteral = Prisma.join(KNOWN_MECHANICS.map((m) => Prisma.sql`${m}`));
  const updated = await prisma.$executeRaw`
    UPDATE "MktProduct"
    SET mechanics = COALESCE(
      ARRAY(SELECT unnest(tags) INTERSECT SELECT unnest(ARRAY[${mechanicsLiteral}]::text[])),
      ARRAY[]::text[]
    )
    WHERE array_length(tags, 1) > 0
      AND cardinality(mechanics) = 0
  `;
  console.log(`Postgres: ${updated} products backfilled.`);

  // Push the new field to every already-indexed document (storefront-eligible
  // products only — the same population the ranking scheduler indexes).
  const eligible = await prisma.mktProduct.findMany({
    where: {
      mechanics: { isEmpty: false },
      OR: [
        { canonicalStatus: 'verified' },
        { bggEnrichment: { is: { status: 'succeeded' } } },
      ],
    },
    select: { id: true, mechanics: true },
  });
  console.log(`Typesense: patching ${eligible.length} indexed documents...`);

  let patched = 0;
  for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
    const batch = eligible.slice(i, i + CHUNK_SIZE);
    try {
      await search.collections('mkt_products').documents().import(batch, { action: 'update' });
      patched += batch.length;
    } catch (err) {
      // Typesense throws on partial-batch failures (e.g. an id no longer
      // indexed) even though most of the batch succeeded — non-fatal, the
      // next full reindex or re-enrichment closes any remaining gap.
      console.warn(`Batch at offset ${i} had errors: ${String(err)}`);
    }
    if ((i / CHUNK_SIZE) % 10 === 0) console.log(`  ...${Math.min(i + CHUNK_SIZE, eligible.length)}/${eligible.length}`);
  }
  console.log(`Typesense: ${patched}/${eligible.length} documents patched.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
