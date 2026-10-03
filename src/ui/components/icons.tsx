import type { MeterStatus } from '../../engine/types';

export function StatusIcon({ status, size = 12 }: { status: MeterStatus | 'strong' | 'fair' | 'weak'; size?: number }) {
  if (status === 'ok' || status === 'strong') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 7.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'warning' || status === 'fair') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
        <path d="M7 1.5l6 10.5H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7 5.5v3M7 10.3v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M4.6 1h4.8L13 4.6v4.8L9.4 13H4.6L1 9.4V4.6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Check({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Star({ filled, size = 34 }: { filled: boolean; size?: number }) {
  const d = 'M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.5l7.1-.6z';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {filled ? <path d={d} style={{ fill: 'var(--acc)' }} /> : <path d={d} fill="none" style={{ stroke: 'var(--ink3)' }} strokeWidth="1.5" strokeDasharray="3 2" />}
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="5" style={{ fill: 'var(--bp)' }} />
      <ellipse cx="16" cy="16" rx="14" ry="7" transform="rotate(-25 16 16)" style={{ stroke: 'var(--bp)' }} strokeWidth="1.5" />
      <rect x="25" y="6" width="5" height="5" transform="rotate(45 27.5 8.5)" style={{ fill: 'var(--acc)' }} />
    </svg>
  );
}

export type PartKind = 'bus' | 'power' | 'instruments' | 'comms' | 'propulsion' | 'launcher';

export function PartIcon({ kind, size = 16 }: { kind: PartKind; size?: number }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;
  switch (kind) {
    case 'bus':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3" y="3" width="10" height="10" rx="1.5" {...s} />
        </svg>
      );
    case 'power':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.5" {...s} />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" {...s} strokeLinecap="round" />
        </svg>
      );
    case 'instruments':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2l6 6-6 6-6-6z" {...s} />
        </svg>
      );
    case 'comms':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 6a8 8 0 0 0 8 8M2 6l8 8M6 10l6-6M12 2v2h2" {...s} strokeLinecap="round" />
        </svg>
      );
    case 'propulsion':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 2h6v6l2 5H3l2-5z" {...s} strokeLinejoin="round" />
        </svg>
      );
    case 'launcher':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1c2 2 3 5 3 8v4H5V9c0-3 1-6 3-8zM5 11l-2 3h2M11 11l2 3h-2" {...s} strokeLinejoin="round" />
        </svg>
      );
  }
}
