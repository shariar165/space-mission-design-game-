// ⓘ: opens the Sourced<T> record behind a number: its value, unit, source, link and whether it is a
// game estimate (spec rule 2: never present an estimate as NASA data).
import { useEffect, useId, useRef, useState } from 'react';
import type { Sourced } from '../../engine/types';
import { sourcedValue } from '../format';

export function SourceInfo({ s, title }: { s: Sourced<unknown>; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);
  const computed = s.source.startsWith('Computed by the engine');
  return (
    <span className="info-wrap" ref={ref}>
      <button
        type="button"
        className={`info-btn${s.isGameEstimate ? ' est' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Source${title ? ` of ${title}` : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          // Fixed position from the button, so the popover is never clipped by a scrolling panel.
          const b = e.currentTarget.getBoundingClientRect();
          const width = Math.min(300, window.innerWidth - 16);
          const up = b.bottom + 260 > window.innerHeight && b.top > 260;
          setPos({ top: up ? b.top - 8 : b.bottom + 8, left: Math.max(8, Math.min(b.left - 12, window.innerWidth - width - 8)), up });
          setOpen((o) => !o);
        }}
      >
        i
      </button>
      {open && (
        <span
          className="popover"
          id={id}
          role="dialog"
          style={{ top: pos.top, left: pos.left, transform: pos.up ? 'translateY(-100%)' : undefined }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="popover-head">
            <span className="kicker">Source</span>
            <button type="button" className="popover-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </span>
          {title && <span className="h3">{title}</span>}
          <span className="popover-value">{sourcedValue(s)}</span>
          {s.isGameEstimate ? (
            <span className="badge est">GAME ESTIMATE · NOT NASA DATA</span>
          ) : computed ? (
            <span className="badge calc">COMPUTED BY THE ENGINE</span>
          ) : (
            <span className="badge nasa">PUBLISHED SOURCE</span>
          )}
          <span className="popover-src">{s.source}</span>
          {s.unit && <span className="faint mono">unit: {s.unit}</span>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer">
              Open source ↗
            </a>
          )}
        </span>
      )}
    </span>
  );
}
