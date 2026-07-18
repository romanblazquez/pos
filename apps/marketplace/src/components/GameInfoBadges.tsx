import { Clock3, Users } from 'lucide-react';

interface GameInfoBadgesProps {
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  playTimeMinutes?: number;
  bggRating?: number;
  bggWeight?: number;
  language?: string;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  es: '🇪🇸',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
};

function weightLabel(weight: number): { label: string; color: string; bg: string } {
  if (weight <= 2.0) return { label: 'Ligero', color: '#2C6B43', bg: '#E4EFE4' };
  if (weight <= 3.0) return { label: 'Medio', color: '#8A5A12', bg: '#F6EBD2' };
  if (weight <= 4.0) return { label: 'Pesado', color: '#8A2A12', bg: '#F6E1DC' };
  return { label: 'Experto', color: '#5A0A0A', bg: '#F3D6D6' };
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[--border] bg-[--bg-raised] px-3 py-1 font-mono text-xs font-medium text-[--tx-muted] ${className}`}>
      {children}
    </span>
  );
}

export function GameInfoBadges({
  minPlayers, maxPlayers, minAge, playTimeMinutes,
  bggRating, bggWeight, language,
}: GameInfoBadgesProps) {
  const hasSomething = minPlayers ?? maxPlayers ?? minAge ?? playTimeMinutes ?? bggRating ?? bggWeight ?? language;
  if (!hasSomething) return null;

  const playerStr = minPlayers && maxPlayers
    ? minPlayers === maxPlayers ? `${minPlayers} jugador${minPlayers > 1 ? 'es' : ''}` : `${minPlayers}–${maxPlayers} jugadores`
    : minPlayers ? `${minPlayers}+ jugadores` : null;

  const wInfo = bggWeight ? weightLabel(bggWeight) : null;
  const flag = language ? LANGUAGE_FLAGS[language.toLowerCase()] : null;

  return (
    <div className="flex flex-wrap gap-2 my-3">
      {playerStr && (
        <Pill className="text-[--success] bg-[--success-bg] border-transparent">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {playerStr}
        </Pill>
      )}

      {playTimeMinutes && (
        <Pill>
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {playTimeMinutes} min
        </Pill>
      )}

      {minAge && (
        <Pill>
          +{minAge} años
        </Pill>
      )}

      {bggRating && bggRating > 0 && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E7D3A6] bg-[#F6EBD2] px-3 py-1 font-mono text-xs font-semibold"
          style={{ color: '#B5852F' }}
        >
          ★ {bggRating.toFixed(1)}
          <span className="text-[--tx-faint] font-normal">BGG</span>
        </span>
      )}

      {bggWeight && wInfo && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold"
          style={{ color: wInfo.color, background: wInfo.bg, borderColor: `${wInfo.color}40` }}
        >
          {bggWeight.toFixed(1)} · {wInfo.label}
        </span>
      )}

      {flag && (
        <Pill>
          {flag} {language?.toUpperCase()}
        </Pill>
      )}
    </div>
  );
}
