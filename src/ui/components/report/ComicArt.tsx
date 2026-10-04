// Comic panel art for the Mission Report (design: Mission Report, the four panels). Drawings only; captions and
// every number come from the engine through the report screen.
import type { PanelKind } from '../../../engine/ops/report';

function Craft({ t, flame }: { t: string; flame?: boolean }) {
  return (
    <g transform={t}>
      {flame && (
        <>
          <path d="M-34 -4 L-58 0 L-34 4 Z" fill="var(--sd-amber)" />
          <path d="M-30 -2.5 L-44 0 L-30 2.5 Z" fill="#ffe08a" />
        </>
      )}
      <rect x="-27" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1" />
      <rect x="10" y="-6" width="17" height="12" fill="var(--sd-panel-blue)" stroke="var(--sd-panel-edge)" strokeWidth="1" />
      <rect x="-8" y="-8" width="16" height="16" rx="2" fill="var(--sd-bus-gold)" stroke="var(--sd-bus-edge)" strokeWidth="1" />
      <path d="M-7 -8 q7 -10 14 0 z" fill="var(--sd-paper)" />
    </g>
  );
}

const STARS = (
  <>
    <circle cx="30" cy="40" r="1.6" fill="var(--sd-paper)" />
    <circle cx="290" cy="60" r="1.2" fill="var(--sd-paper)" />
    <circle cx="210" cy="24" r="1.8" fill="var(--sd-paper)" />
    <circle cx="80" cy="150" r="1.1" fill="var(--sd-paper)" />
    <circle cx="320" cy="180" r="1.5" fill="var(--sd-paper)" />
    <circle cx="140" cy="210" r="1.2" fill="var(--sd-paper)" />
  </>
);

export function ComicArt({ kind, sound, destColor }: { kind: PanelKind; sound?: string; destColor: string }) {
  return (
    <svg viewBox="0 0 340 300" preserveAspectRatio="xMidYMid slice" className="rp-art" aria-hidden="true">
      {STARS}
      {(kind === 'launch' || kind === 'launch-failed' || kind === 'not-launched') && (
        <>
          <circle cx="170" cy="470" r="230" fill="var(--sd-earth)" />
          <path d="M40 270 q40 -30 90 -20 q20 20 -10 40 z M200 250 q60 -20 100 10 l-10 40 h-80 z" fill="var(--sd-land)" />
          {kind === 'launch' && (
            <>
              <path d="M170 236 q-24 30 -60 64 M170 236 q24 30 60 64" stroke="var(--sd-paper)" strokeOpacity=".35" strokeWidth="14" fill="none" strokeLinecap="round" />
              <path d="M162 190 h16 l6 26 q-14 30 -28 0 z" fill="var(--sd-amber)" />
              <path d="M165 196 h10 l3 14 q-8 16 -16 0 z" fill="#ffe08a" />
            </>
          )}
          <g transform={kind === 'launch-failed' ? 'rotate(24 170 140)' : undefined}>
            <rect x="158" y="96" width="24" height="96" fill="var(--sd-paper)" />
            <path d="M158 96 L170 64 L182 96 Z" fill="var(--sd-red)" />
            <path d="M158 168 L144 194 L158 190 Z M182 168 L196 194 L182 190 Z" fill="var(--sd-red)" />
            <rect x="158" y="128" width="24" height="6" fill="var(--sd-paper-ink)" />
          </g>
          {kind === 'launch-failed' && (
            <text x="200" y="90" className="rp-sound" transform="rotate(-8 200 90)">
              KA-BOOM
            </text>
          )}
        </>
      )}
      {kind === 'hazard' && (
        <>
          <circle cx="-30" cy="150" r="120" fill="var(--sd-sun)" />
          <circle cx="-30" cy="150" r="100" fill="var(--sd-sun-core)" />
          <path d="M120 40 A150 150 0 0 1 120 260" stroke="var(--sd-amber)" strokeWidth="7" fill="none" strokeDasharray="14 10" />
          <path d="M170 20 A190 190 0 0 1 170 280" stroke="var(--sd-amber)" strokeOpacity=".6" strokeWidth="6" fill="none" strokeDasharray="12 12" />
          <Craft t="translate(262 150) scale(2.4)" />
          <path d="M240 98 l10 10 -8 4 12 12 M286 196 l-10 -8 8 -4 -12 -12" stroke="var(--sd-alarm)" strokeWidth="4" fill="none" strokeLinejoin="round" />
          <text x="226" y="250" className="rp-sound" transform="rotate(-8 236 250)">
            {sound ?? 'ZZZT!'}
          </text>
        </>
      )}
      {(kind === 'arrival' || kind === 'complete') && (
        <>
          <ellipse cx="250" cy="190" rx="170" ry="60" fill="none" stroke="var(--sd-paper)" strokeOpacity=".5" strokeWidth="2.5" strokeDasharray="6 8" transform="rotate(-18 250 190)" />
          <circle cx="260" cy="210" r="110" fill={destColor} />
          <circle cx="225" cy="180" r="22" fill="rgba(0,0,0,.25)" />
          <circle cx="290" cy="240" r="14" fill="rgba(0,0,0,.25)" />
          <Craft t="translate(96 92) scale(2.1) rotate(-18)" flame={kind === 'arrival'} />
          <text x="20" y="268" className="rp-sound" transform="rotate(-6 20 268)">
            {kind === 'arrival' ? 'FWOOOSH' : 'BEEP BEEP'}
          </text>
        </>
      )}
      {(kind === 'conjunction' || kind === 'lost') && (
        <>
          <circle cx="170" cy="160" r="70" fill="var(--sd-sun)" />
          <circle cx="170" cy="160" r="56" fill="var(--sd-sun-core)" />
          <circle cx="36" cy="160" r="18" fill="var(--sd-earth)" />
          <path d="M26 154 q6 -8 14 -4 q2 6 -6 8 z" fill="var(--sd-land)" />
          <circle cx="304" cy="160" r="16" fill={destColor} />
          <path d="M58 160 H96" stroke="var(--sd-crt-hi)" strokeWidth="4" strokeDasharray="6 6" />
          <path d="M108 148 l20 24 M128 148 l-20 24" stroke="var(--sd-alarm)" strokeWidth="6" strokeLinecap="round" />
          <Craft t={kind === 'lost' ? 'translate(300 118) scale(1.3) rotate(40)' : 'translate(300 118) scale(1.3)'} />
          <text x="248" y="250" className="rp-dots">
            . . .
          </text>
        </>
      )}
    </svg>
  );
}
