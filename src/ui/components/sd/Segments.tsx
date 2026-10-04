import type { CSSProperties } from 'react';
// Five-segment bar (resource tiles). The segment count comes from the engine (flyTiles).
interface Props {
  on: number;
  total: number;
  color: string;
  className?: string;
}

export function Segments({ on, total, color, className = '' }: Props) {
  return (
    <span className={`sd-segs ${className}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`sd-seg${i < on ? ' on' : ''}`} style={i < on ? ({ '--seg-col': color } as CSSProperties) : undefined} />
      ))}
    </span>
  );
}
