import { useXPInfo } from '../hooks/useXP.js';

// Meeple SVG icon
function MeepleIcon({ size }: { size: number }) {
  const s = size * 0.45;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {/* Head */}
      <circle cx="12" cy="4.5" r="3" />
      {/* Body */}
      <path d="M7 10c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2l1 5H4l1-5z" />
      {/* Legs */}
      <path d="M5 15l-1 5h5l1-3 1 3h5l-1-5H5z" />
    </svg>
  );
}

export function XPProgressRing({ xp, size = 76 }: { xp: number; size?: number }) {
  const { tier, pct } = useXPInfo(xp);

  const trackColor = '#EDE4D2';
  const fillColor = tier.color;
  const deg = Math.round((pct / 100) * 360);

  const ringStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `conic-gradient(${fillColor} ${deg}deg, ${trackColor} ${deg}deg)`,
    padding: 5,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const innerStyle: React.CSSProperties = {
    width: size - 10,
    height: size - 10,
    borderRadius: '50%',
    background: 'var(--bg-raised)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: fillColor,
  };

  return (
    <div style={ringStyle} role="img" aria-label={`${xp} XP — ${tier.name} (${pct}%)`}>
      <div style={innerStyle}>
        <MeepleIcon size={size} />
      </div>
    </div>
  );
}
