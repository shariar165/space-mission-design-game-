// ⓘ: opens the Sourced<T> record behind a number: its value, unit, source, link and whether it is a
// game estimate (spec rule 2: never present an estimate as NASA data). In Bangla a cited text is shown translated
// (cited.ts); ⓘ keeps the record as it is: the English original, its source and its link (spec UI rule 48).
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Sourced } from '../../engine/types';
import { hasBangla } from '../cited';
import { sourcedValue } from '../format';
import { lang } from '../lang';
import { SOURCE_WORDS } from '../sdWords';

export function SourceInfo({ s, title }: { s: Sourced<unknown>; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const ref = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const id = useId();
  // Once open, keep the whole popover on screen: a long cited text can be taller than the room below the button.
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    const h = el.getBoundingClientRect().height;
    const now = pos.up ? pos.top - h : pos.top;
    const top = Math.max(8, Math.min(now, window.innerHeight - h - 8));
    if (top !== now) setPos({ ...pos, top, up: false });
  }, [open, pos]);
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
  const original = lang() === 'bn' && hasBangla(s.value);
  return (
    <span className="info-wrap" ref={ref}>
      <button
        type="button"
        className={`info-btn${s.isGameEstimate ? ' est' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={SOURCE_WORDS.label(title)}
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
          ref={pop}
          id={id}
          role="dialog"
          style={{ top: pos.top, left: pos.left, transform: pos.up ? 'translateY(-100%)' : undefined }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="popover-head">
            <span className="kicker">{SOURCE_WORDS.kicker}</span>
            <button type="button" className="popover-close" aria-label={SOURCE_WORDS.close} onClick={() => setOpen(false)}>
              ×
            </button>
          </span>
          {title && <span className="h3">{title}</span>}
          {original && <span className="popover-orig">{SOURCE_WORDS.original}</span>}
          <span className="popover-value" {...(original ? { lang: 'en' } : {})}>
            {sourcedValue(s)}
          </span>
          {s.isGameEstimate ? (
            <span className="badge est">{SOURCE_WORDS.estimate}</span>
          ) : computed ? (
            <span className="badge calc">{SOURCE_WORDS.computed}</span>
          ) : (
            <span className="badge nasa">{SOURCE_WORDS.published}</span>
          )}
          <span className="popover-src" lang="en">
            {s.source}
          </span>
          {s.unit && <span className="faint mono">{SOURCE_WORDS.unit(s.unit)}</span>}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer">
              {SOURCE_WORDS.open}
            </a>
          )}
        </span>
      )}
    </span>
  );
}
