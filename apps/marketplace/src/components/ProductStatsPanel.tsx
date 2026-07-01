import { useQuery } from '@tanstack/react-query';
import { useIntl } from 'react-intl';
import type { ReactNode } from 'react';
import { BarChart3, Clock3, Layers, ShieldCheck, Star, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function fetchSalesByYear(slug: string): Promise<{ year: number; count: number }[]> {
  const res = await fetch(`${API}/api/v1/products/${slug}/sales-by-year`);
  if (!res.ok) return [];
  return res.json() as Promise<{ year: number; count: number }[]>;
}

export interface ProductStatsProps {
  slug: string;
  minAge?: number;
  playTimeMinutes?: number;
  bggRating?: number;
  bggWeight?: number;
  minPlayers?: number;
  maxPlayers?: number;
  bggRank?: number | null;
  bggUsersRated?: number | null;
  isExpansion?: boolean;
}

/**
 * Consolidates what used to be three separately-scattered blocks (a chip
 * row, ComplexityMeter, PlayerCountFit) into one panel, and adds the
 * previously-unexposed BGG rank/ratings-count/expansion fields plus a live
 * sales-by-year figure — but only renders whichever of these actually has
 * data, instead of showing empty stat tiles.
 */
export function ProductStatsPanel({
  slug, minAge, playTimeMinutes, bggRating, bggWeight, minPlayers, maxPlayers,
  bggRank, bggUsersRated, isExpansion,
}: ProductStatsProps) {
  const intl = useIntl();
  const { data: salesByYear } = useQuery({
    queryKey: ['product-sales-by-year', slug],
    queryFn: () => fetchSalesByYear(slug),
  });

  const hasChips = minAge || playTimeMinutes || bggRating;
  const hasSocialProof = (bggRank && bggRank > 0) || (bggUsersRated && bggUsersRated > 0) || isExpansion;
  const hasSales = salesByYear && salesByYear.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasChips && (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {minAge ? <Chip icon={<ShieldCheck className="h-5 w-5" />} value={`${minAge}+`} label={intl.formatMessage({ id: 'product.minAge' })} /> : null}
          {playTimeMinutes ? <Chip icon={<Clock3 className="h-5 w-5" />} value={`${playTimeMinutes}m`} label={intl.formatMessage({ id: 'product.duration' })} /> : null}
          {bggRating ? <Chip icon={<Star className="h-5 w-5 fill-current" />} value={bggRating.toFixed(1)} label={intl.formatMessage({ id: 'product.bggRating' })} /> : null}
        </div>
      )}

      {hasSocialProof && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[--border] bg-[--bg-raised] px-4 py-3 shadow-sm">
          {bggRank && bggRank > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[--tx]">
              <TrendingUp className="h-4 w-4 text-[--accent]" aria-hidden="true" />
              {intl.formatMessage({ id: 'product.bggRank' }, { rank: bggRank })}
            </span>
          )}
          {bggRank && bggRank > 0 && bggUsersRated && bggUsersRated > 0 && <span className="text-[--tx-faint]">·</span>}
          {bggUsersRated && bggUsersRated > 0 && (
            <span className="text-sm text-[--tx-muted]">
              {intl.formatMessage({ id: 'product.bggUsersRated' }, { count: bggUsersRated })}
            </span>
          )}
          {isExpansion && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[--accent] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[--tx]">
              <Layers className="h-3 w-3" aria-hidden="true" />
              {intl.formatMessage({ id: 'product.isExpansion' })}
            </span>
          )}
        </div>
      )}

      {minPlayers && maxPlayers && <PlayerCountFit minPlayers={minPlayers} maxPlayers={maxPlayers} />}

      {bggWeight ? <ComplexityMeter weight={bggWeight} /> : null}

      {hasSales && <SalesByYear rows={salesByYear} />}
    </div>
  );
}

function SalesByYear({ rows }: { rows: { year: number; count: number }[] }) {
  const intl = useIntl();
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="rounded-[14px] border border-[--border] bg-[--bg-raised] p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[--accent]" aria-hidden="true" />
        <span className="font-display font-bold text-[15px] text-[--tx]">{intl.formatMessage({ id: 'product.salesByYear' })}</span>
      </div>
      <div className="flex items-end gap-3">
        {rows.map((r) => (
          <div key={r.year} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-[--tx]">{r.count}</span>
            <div className="h-16 w-full rounded-md bg-[--bg-subtle] flex items-end overflow-hidden">
              <div
                className="w-full rounded-md bg-emerald-500 dark:bg-emerald-600"
                style={{ height: `${Math.max(8, (r.count / max) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase text-[--tx-faint]">{r.year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <span className="flex flex-1 min-w-[110px] flex-col items-center gap-1.5 rounded-[13px] border border-[--border] bg-[--bg-raised] px-3 py-[15px] text-center shadow-sm">
      <span className="text-[--accent]">{icon}</span>
      <span className="font-display text-[21px] font-extrabold leading-tight tracking-[-0.02em] text-[--tx]">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-[1px] text-[--tx-faint]">{label}</span>
    </span>
  );
}

function ComplexityMeter({ weight }: { weight: number }) {
  const intl = useIntl();
  const pct = (weight / 5) * 100;
  const band =
    weight < 2 ? intl.formatMessage({ id: 'product.complexityLight' }) :
    weight < 2.5 ? intl.formatMessage({ id: 'product.complexityMediumLight' }) :
    weight < 3.5 ? intl.formatMessage({ id: 'product.complexityMedium' }) :
    weight < 4.5 ? intl.formatMessage({ id: 'product.complexityHeavy' }) : intl.formatMessage({ id: 'product.complexityExpert' });
  return (
    <div className="rounded-[14px] border border-[--border] bg-[--bg-raised] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-bold text-[15px] text-[--tx]">{intl.formatMessage({ id: 'product.complexity' })}</span>
        <span className="font-mono text-[12px] rounded-[7px] border px-2 py-0.5
                         border-[#E7D3A6] bg-[#F6EBD2] text-[#8A5A12] dark:border-[#D7A654]/30 dark:bg-[#D7A654]/15 dark:text-[#E0BC72]">
          {weight.toFixed(1)} / 5 · {band}
        </span>
      </div>
      <div className="relative h-3 rounded-full"
           style={{ background: 'linear-gradient(90deg,#3E7C53 0%,#C0852F 42%,#B4502E 72%,#7E2A20 100%)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb,var(--tx) 12%,transparent)' }}>
        <div className="absolute top-1/2 rounded-sm"
             style={{ left: `${pct}%`, width: 3, height: 24, background: 'var(--tx)', transform: 'translateX(-50%) translateY(-50%)', boxShadow: '0 0 0 3px var(--bg-raised)' }} />
      </div>
      <div className="flex justify-between mt-2.5 font-mono text-[10.5px] uppercase">
        <span className="font-bold text-[#3E7C53] dark:text-[#7FC79A]">{intl.formatMessage({ id: 'product.complexityLight' })}</span>
        <span className="text-[--tx-faint]">{intl.formatMessage({ id: 'product.complexityMedium' })}</span>
        <span className="text-[--tx-faint]">{intl.formatMessage({ id: 'product.complexityHeavy' })}</span>
        <span className="text-[--tx-faint]">{intl.formatMessage({ id: 'product.complexityExpert' })}</span>
      </div>
    </div>
  );
}

function PlayerCountFit({ minPlayers, maxPlayers }: { minPlayers: number; maxPlayers: number }) {
  const intl = useIntl();
  const counts = Array.from({ length: maxPlayers }, (_, i) => i + 1);
  const badge = minPlayers === maxPlayers
    ? intl.formatMessage({ id: 'product.playersCount' }, { count: minPlayers })
    : intl.formatMessage({ id: 'product.playersBadge' }, { range: `${minPlayers}–${maxPlayers}` });

  function slotStyle(n: number): { cellClass: string; labelClass: string; label: string; strikethrough?: boolean } {
    if (n < minPlayers) {
      return {
        cellClass: 'bg-[#EDE4D2] border border-dashed border-[#D8CCB3] text-[#B6A98C] dark:bg-[#312B20] dark:border-[#4A4233] dark:text-[#8A7E68]',
        labelClass: 'text-[#B6A98C] dark:text-[#8A7E68]',
        label: 'No',
        strikethrough: true,
      };
    }
    if (n === minPlayers && minPlayers < maxPlayers) {
      return {
        cellClass: 'bg-[#F6EBD2] border border-[#E7D3A6] text-[#8A5A12] dark:bg-[#D7A654]/15 dark:border-[#D7A654]/30 dark:text-[#E0BC72]',
        labelClass: 'text-[#8A5A12] dark:text-[#E0BC72]',
        label: 'OK',
      };
    }
    if (n <= maxPlayers) {
      return {
        cellClass: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
        labelClass: 'font-bold text-[#2C6B43] dark:text-[#7FC79A]',
        label: 'Best',
      };
    }
    return {
      cellClass: 'bg-[#EDE4D2] border border-[#E0D4BC] text-[#9A8E79] dark:bg-[#312B20] dark:border-[#4A4233] dark:text-[#9A8E79]',
      labelClass: 'text-[#9A8E79]',
      label: 'Ext',
    };
  }

  return (
    <div className="rounded-[14px] border border-[--border] bg-[--bg-raised] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display font-bold text-[15px] text-[--tx]">{intl.formatMessage({ id: 'product.playersLabel' })}</span>
        <span className="font-mono text-[12px] rounded-[7px] border px-2 py-0.5
                         border-[#CBE0CD] bg-[#E4EFE4] text-[#2C6B43] dark:border-[#5CA877]/30 dark:bg-[#5CA877]/15 dark:text-[#7FC79A]">
          {badge}
        </span>
      </div>
      <div className="flex gap-2">
        {counts.map((n) => {
          const s = slotStyle(n);
          return (
            <div key={n} className="flex-1 text-center">
              <div className={`h-[38px] rounded-[9px] grid place-items-center font-mono font-bold text-[14px] ${s.cellClass} ${s.strikethrough ? 'line-through' : ''}`}>
                {n}
              </div>
              <div className={`font-mono text-[9px] uppercase mt-[5px] ${s.labelClass}`}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
