// Layout helpers for the Operations Console (pixels only, like meters.ts): no physics, no game numbers.
import { useEffect, useRef, useState } from 'react';

/**
 * Put timeline labels on staggered lanes so they never overlap (the mockup's "two staggered lanes").
 * Each item sits at a fraction of the strip; a label that fits no lane is drawn as a bare marker.
 */
export function packLanes<T extends { left: number }>(
  items: T[],
  widthPx: number,
  labelPx: (item: T) => number,
  lanes = 3,
  gapPx = 10,
): (T & { lane: number; showLabel: boolean })[] {
  const ends = Array.from({ length: lanes }, () => -Infinity);
  return items.map((it) => {
    const x = it.left * widthPx;
    let lane = ends.findIndex((end) => end + gapPx <= x);
    let showLabel = true;
    if (lane < 0) {
      showLabel = false;
      lane = ends.indexOf(Math.min(...ends));
    }
    ends[lane] = x + (showLabel ? labelPx(it) : 24);
    return { ...it, lane, showLabel };
  });
}

/** Rough label width for a line of text at the strip's font size. */
export const textPx = (s: string, perChar = 6.8) => 30 + s.length * perChar;

/** Width of an element, kept up to date (falls back to a desktop width in tests). */
export function useWidth<E extends HTMLElement>(fallback = 1000) {
  const ref = useRef<E>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** The player asked for less motion. */
export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

/** CSS percentage for a 0–1 fraction from the engine (formatting only). */
export const cssPct = (fraction: number) => `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(2)}%`;
