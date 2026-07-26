import { playerFitSlots, type PlayerSlot } from '../player-fit.js';

export interface PlayerFitPanelProps {
  minPlayers: number;
  maxPlayers: number;
  locale: 'es' | 'en';
}

const COPY = {
  es: { title: 'Jugadores', players: 'jugadores', no: 'No', ok: 'OK', good: 'Bien' },
  en: { title: 'Players', players: 'players', no: 'No', ok: 'OK', good: 'Good' },
} as const;

/**
 * "How well does this play at N?" — one panel, both hosts.
 *
 * Styled with inline CSS variables rather than utility classes so the same
 * component renders identically in the Next server-rendered pages and the Vite
 * SPA, without either app's Tailwind build needing to know about it.
 *
 * The apex and the SPA each had their own copy of this, and they had drifted:
 * the SPA had learned to group large ranges while the apex still drew one tile
 * per seat, so a 1–99 party game rendered ninety-nine tiles a few pixels wide.
 * Grouping now lives in `playerFitSlots`, which both get by construction.
 */
export function PlayerFitPanel({ minPlayers, maxPlayers, locale }: PlayerFitPanelProps) {
  const t = COPY[locale];
  const slots = playerFitSlots(minPlayers, maxPlayers);
  const badge =
    minPlayers === maxPlayers
      ? `${minPlayers} ${t.players}`
      : `${minPlayers}–${maxPlayers} ${t.players}`;

  const tone = (kind: PlayerSlot['kind']) => {
    if (kind === 'no') {
      return {
        background: 'var(--bg-subtle, var(--muted))',
        border: '1px dashed var(--border-strong, var(--border))',
        color: 'var(--tx-faint, var(--subtle-foreground))',
        label: t.no,
        labelColor: 'var(--tx-faint, var(--subtle-foreground))',
        strike: true,
        bold: false,
      };
    }
    if (kind === 'min') {
      return {
        background: 'color-mix(in srgb, var(--game-token-ochre-bg) 18%, var(--bg-raised, var(--card)))',
        border: '1px solid color-mix(in srgb, var(--game-token-ochre-bg) 42%, transparent)',
        color: 'var(--game-token-ochre-edge)',
        label: t.ok,
        labelColor: 'var(--game-token-ochre-edge)',
        strike: false,
        bold: false,
      };
    }
    return {
      background: 'var(--game-token-forest-bg)',
      border: undefined,
      color: 'var(--game-token-forest-fg)',
      label: t.good,
      labelColor: 'var(--game-token-forest-bg)',
      strike: false,
      bold: true,
    };
  };

  return (
    <div
      style={{
        marginTop: '1rem',
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'var(--bg-raised, var(--card))',
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{t.title}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--game-token-forest-edge)',
            background: 'color-mix(in srgb, var(--game-token-forest-bg) 16%, var(--bg-raised, var(--card)))',
            border: '1px solid color-mix(in srgb, var(--game-token-forest-bg) 42%, transparent)',
            padding: '3px 9px',
            borderRadius: 7,
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </span>
      </div>

      {/* Tiles share the row evenly and never shrink below a legible width;
          with at most 8 of them that fits a 320px screen. */}
      <div style={{ display: 'flex', gap: 8 }}>
        {slots.map((slot) => {
          const style = tone(slot.kind);
          return (
            <div key={`${slot.start}-${slot.end}`} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
              <div
                style={{
                  height: 38,
                  borderRadius: 9,
                  background: style.background,
                  border: style.border,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: slot.label.length > 3 ? 12 : 14,
                  color: style.color,
                  textDecoration: style.strike ? 'line-through' : undefined,
                  overflow: 'hidden',
                }}
              >
                {slot.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  color: style.labelColor,
                  marginTop: 5,
                  fontWeight: style.bold ? 700 : undefined,
                }}
              >
                {style.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
