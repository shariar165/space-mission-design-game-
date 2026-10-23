// The flat Mars globe (spec: UI rule 41): the NASA surface map drawn orthographically on a canvas, with a marker
// for each science target. It is the fallback when WebGL is missing or slow, and the globe in component tests.
// Pixel layout only: the projection lives in sdGeometry.
import { useEffect, useRef } from 'react';
import { MARS_GLOBE } from '../../../engine/targets';
import type { TargetCard } from '../../../engine/ops/index';
import { GLOBE_LIMB_AT, GLOBE_MOON_AT, GLOBE_MOON_RING, globeLatLon, globePoint, ringPoint } from '../../sdGeometry';
import * as f from '../../format';
import { SCIENCE, targetName } from '../../sdWords';

export const globeSrc = () => `${import.meta.env.BASE_URL}${MARS_GLOBE.file}`;

/** The surface map's pixels, loaded once and shared by every globe on the page. */
let mapPixels: Promise<ImageData | undefined> | undefined;
function loadMap(): Promise<ImageData | undefined> {
  mapPixels ??= new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(undefined);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      if (!g) return resolve(undefined);
      g.drawImage(img, 0, 0);
      resolve(g.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = () => resolve(undefined);
    img.src = globeSrc();
  });
  return mapPixels;
}

/** Draw the lit globe into a square canvas: each pixel samples the equirectangular map (lon −180…180). */
function paint(canvas: HTMLCanvasElement, map: ImageData) {
  const n = canvas.width;
  const g = canvas.getContext('2d');
  if (!g) return;
  const out = g.createImageData(n, n);
  const lon0 = MARS_GLOBE.lon0_deg.value;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const ll = globeLatLon((2 * (i + 0.5)) / n - 1, (2 * (j + 0.5)) / n - 1);
      if (!ll) continue;
      const u = Math.min(map.width - 1, Math.max(0, Math.floor(((ll.lon_deg - lon0) / 360) * map.width)));
      const v = Math.min(map.height - 1, Math.max(0, Math.floor(((90 - ll.lat_deg) / 180) * map.height)));
      const k = (v * map.width + u) * 4;
      const shade = 0.35 + 0.65 * Math.pow(ll.z, 0.45);
      const o = (j * n + i) * 4;
      out.data[o] = map.data[k]! * shade;
      out.data[o + 1] = map.data[k + 1]! * shade;
      out.data[o + 2] = map.data[k + 2]! * shade;
      out.data[o + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
}

/** Where a target's marker sits, as a fraction of the box (0–1 each way; the disc fills the middle 62%). */
export function markerAt(c: TargetCard): { left: number; top: number; front: boolean } {
  const disc = 0.31;
  if (c.kind === 'surface') {
    const p = globePoint(c.lat_deg ?? 0, c.lon_deg ?? 0);
    return { left: 0.5 + p.x * disc, top: 0.5 + p.y * disc, front: p.front };
  }
  if (c.kind === 'limb') return { left: 0.5 + Math.cos(GLOBE_LIMB_AT) * disc, top: 0.5 - Math.sin(GLOBE_LIMB_AT) * disc, front: true };
  const moon = c.id === 'deimos' ? 'deimos' : 'phobos';
  const r = ringPoint(GLOBE_MOON_RING[moon], GLOBE_MOON_AT[moon]);
  return { left: 0.5 + r.x * disc, top: 0.5 + r.y * disc, front: true };
}

interface Props {
  cards: TargetCard[];
  selected?: string;
  onPick?: (id: string) => void;
  /** Disc size in CSS px. */
  size: number;
  /** Markers appear one by one (arrival transition): how many show. */
  shown?: number;
  className?: string;
}

export function MarsGlobe2D({ cards, selected, onPick, size, shown = cards.length, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void loadMap().then((map) => {
      if (live && map && ref.current) paint(ref.current, map);
    });
    return () => {
      live = false;
    };
  }, []);
  const ringPath = (radius: number) => {
    const pts = Array.from({ length: 73 }, (_, i) => ringPoint(radius, (i / 72) * 2 * Math.PI));
    return pts.map((p, i) => `${i ? 'L' : 'M'}${(50 + p.x * 31).toFixed(2)} ${(50 + p.y * 31).toFixed(2)}`).join(' ');
  };
  const sel = cards.find((c) => c.id === selected);
  const selAt = sel ? markerAt(sel) : undefined;
  return (
    <div className={`sci-globe${className ? ` ${className}` : ''}`} style={{ width: size / 0.62, height: size / 0.62 }}>
      <svg className="sci-globe-rings" viewBox="0 0 100 100" aria-hidden="true">
        <path d={ringPath(GLOBE_MOON_RING.phobos)} />
        <path d={ringPath(GLOBE_MOON_RING.deimos)} />
      </svg>
      <canvas ref={ref} className="sci-globe-disc" width={Math.round(size * 1.5)} height={Math.round(size * 1.5)} role="img" aria-label={SCIENCE.globeCredit} />
      <div className="sci-globe-edge" />
      {cards.slice(0, shown).map((c) => {
        const at = markerAt(c);
        const state = c.id === selected ? ' on' : c.state === 'home' || c.state === 'sent' ? ' done' : c.state !== 'ready' && c.state !== 'refused' ? ' ordered' : '';
        return (
          <button
            key={c.id}
            type="button"
            className={`sci-mark${state}${at.front ? '' : ' behind'}`}
            style={{ left: `${at.left * 100}%`, top: `${at.top * 100}%` }}
            aria-label={targetName(c.id)}
            aria-pressed={c.id === selected}
            onClick={() => onPick?.(c.id)}
          >
            {f.num(c.ordinal)}
          </button>
        );
      })}
      {sel && selAt && (
        <span className={`sci-mark-label${selAt.left > 0.6 ? ' left' : ''}`} style={{ left: `${selAt.left * 100}%`, top: `${selAt.top * 100}%` }}>
          {targetName(sel.id)}
        </span>
      )}
    </div>
  );
}
