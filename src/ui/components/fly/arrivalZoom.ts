// The arrival transition (spec: UI rule 42; presentation only). About two seconds, ease-in-out:
//   0.0–1.0 s  the 2D map zooms into Mars (the dot moves to where the globe will be and grows to its size) while
//              the rest of the map fades;
//   1.0–1.4 s  the flat Mars dot crossfades into the globe at the same place and size;
//   1.4–2.0 s  the camera eases back: the globe settles to its size, the panel and the rings come up, and the
//              target markers appear one by one.
// Going back to the map plays it in reverse. Under prefers-reduced-motion it is an instant cut. The hook only sets
// CSS custom properties on the screen's root (styles in sd-science.css) and counts the markers shown.
import { useEffect, useRef, useState, type RefObject } from 'react';

export const ZOOM_MS = 2000;
const ZOOM_END = 0.5;
const FADE_END = 0.7;
/** The globe starts this much larger and eases back (the camera pulling away). */
const PULL_BACK = 0.12;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));

export type ZoomDirection = 'in' | 'out';

interface Rects {
  /** Mars on the map: centre and radius (px). */
  mx: number;
  my: number;
  mr: number;
  /** The globe's disc: centre and radius (px). */
  gx: number;
  gy: number;
  gr: number;
  /** The map's top-left corner (the transform origin is measured from it). */
  sx: number;
  sy: number;
}

function measure(root: HTMLElement): Rects | undefined {
  // Measure the map and the globe as they are laid out, without any transition transform on them.
  for (const [k, v] of [['--zs', '1'], ['--zt-x', '0px'], ['--zt-y', '0px'], ['--globe-scale', '1']] as const) root.style.setProperty(k, v);
  const dot = root.querySelector('.crt-dest-disc')?.getBoundingClientRect();
  const map = root.querySelector('.crt-map')?.getBoundingClientRect();
  const globe = root.querySelector('.sci-globe')?.getBoundingClientRect();
  if (!dot || !map || !globe || !dot.width || !globe.width) return undefined;
  return {
    mx: dot.left + dot.width / 2,
    my: dot.top + dot.height / 2,
    mr: dot.width / 2,
    gx: globe.left + globe.width / 2,
    gy: globe.top + globe.height / 2,
    gr: globe.width * 0.31,
    sx: map.left,
    sy: map.top,
  };
}

/** Write the transition's state at progress p (0 = the map, 1 = the globe) as CSS variables. */
function paint(root: HTMLElement, r: Rects | undefined, p: number) {
  const z = easeInOut(seg(p, 0, ZOOM_END));
  const fade = easeInOut(seg(p, ZOOM_END, FADE_END));
  const back = easeInOut(seg(p, FADE_END, 1));
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  if (r) {
    const s = 1 + (r.gr / r.mr - 1) * z;
    set('--zo-x', `${r.mx - r.sx}px`);
    set('--zo-y', `${r.my - r.sy}px`);
    set('--zt-x', `${(r.gx - r.mx) * z}px`);
    set('--zt-y', `${(r.gy - r.my) * z}px`);
    set('--zs', String(s));
  }
  set('--map-rest', String(1 - z));
  set('--map-out', String(1 - fade));
  set('--globe-in', String(fade));
  set('--globe-scale', String(1 + PULL_BACK * (1 - back)));
  set('--sci-chrome', String(back));
}

/**
 * Run the transition on `root` when `direction` changes; `onDone` fires at the end. Returns whether it is running
 * and how many of `markers` show (they appear one by one in the last part).
 */
export function useArrivalZoom(root: RefObject<HTMLElement | null>, direction: ZoomDirection | undefined, markers: number, still: boolean, onDone: () => void) {
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState(markers);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const el = root.current;
    if (!direction || !el) return;
    if (still) {
      setShown(markers);
      done.current();
      return;
    }
    setRunning(true);
    let raf = 0;
    let rects: Rects | undefined;
    // Wall-clock time (Date, not the frame's timestamp), so a test's fake clock can run the transition too.
    const t0 = Date.now();
    const step = () => {
      rects ??= measure(el);
      const k = Math.min(1, (Date.now() - t0) / ZOOM_MS);
      const p = direction === 'in' ? k : 1 - k;
      paint(el, rects, p);
      setShown(Math.round(markers * seg(p, FADE_END, 1)));
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        setRunning(false);
        setShown(markers);
        done.current();
      }
    };
    paint(el, undefined, direction === 'in' ? 0 : 1);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [direction]); // eslint-disable-line react-hooks/exhaustive-deps
  return { running, shown };
}
