// The flat globe (spec: UI rules 41, 44): the body's NASA surface map drawn orthographically on a canvas, with the same
// orbit drawing and labels as the 3D globe (sdGeometry: globeFrame, globeOrbits). It is the fallback when WebGL is
// missing or slow, and the globe in component tests. Same interactions, no camera motion: picking a target re-centres
// the view at once. The orbiter still flies over a target when an OBSERVE order lands. The Moon (spec: UI rule 45)
// adds Earth, the signal line and the far-side and shadow arcs from the engine, lit by the real Sun. Pixel layout only.
import { useEffect, useRef, useState } from 'react';
import { linkUpOnRing, type MoonOrbitView } from '../../../engine/ops/index';
import { TARGET_SETS, type GlobeMap, type TargetBody } from '../../../engine/targets';
import {
  behindGlobe,
  bodyToView,
  GLOBE_DRAG_ARC,
  GLOBE_FLYOVER_ARC,
  GLOBE_FLYOVER_MS,
  globeDiscPx,
  globeFrame,
  globeLatLon,
  globeOrbits,
  flyoverTheta,
  lunarRing,
  moonEarthAt,
  moonFrame,
  moonLayout,
  moonRing,
  MOON_SCENE,
  orbitAt,
  orbitPoints,
  periapsisAt,
  ringArc,
  ringSplit,
  signalEnd,
  targetVec,
  trimAt,
  transferApoAt,
  type GlobeView,
  type Vec3,
} from '../../sdGeometry';
import { SCIENCE } from '../../sdWords';
import { globeLabels, GlobeMarks, moonLabels, MoonMarks, type GlobeProps, type ScreenAt } from './GlobeMarks';

export const globeSrc = (body: TargetBody) => `${import.meta.env.BASE_URL}${TARGET_SETS[body].globe.file}`;

/** Each body's surface map pixels, loaded once and shared by every globe on the page. */
const mapPixels = new Map<TargetBody, Promise<ImageData | undefined>>();
function loadMap(body: TargetBody): Promise<ImageData | undefined> {
  let pixels = mapPixels.get(body);
  if (pixels) return pixels;
  pixels = new Promise((resolve) => {
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
    img.src = globeSrc(body);
  });
  mapPixels.set(body, pixels);
  return pixels;
}

/** Draw the lit globe into a square canvas: each pixel samples the equirectangular map (lon −180…180). */
/** Draw the globe into a square canvas, lit from the viewer, or by the Sun (view frame) when one is given. */
function paint(canvas: HTMLCanvasElement, map: ImageData, view: GlobeView, globe: GlobeMap, sun?: Vec3) {
  const n = canvas.width;
  const g = canvas.getContext('2d');
  if (!g) return;
  const out = g.createImageData(n, n);
  const lon0 = globe.lon0_deg.value;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const ll = globeLatLon((2 * (i + 0.5)) / n - 1, (2 * (j + 0.5)) / n - 1, view);
      if (!ll) continue;
      const u = Math.min(map.width - 1, Math.max(0, Math.floor((((((ll.lon_deg - lon0) % 360) + 360) % 360) / 360) * map.width)));
      const v = Math.min(map.height - 1, Math.max(0, Math.floor(((90 - ll.lat_deg) / 180) * map.height)));
      const k = (v * map.width + u) * 4;
      const lit = sun ? Math.max(0, ((2 * (i + 0.5)) / n - 1) * sun.x - ((2 * (j + 0.5)) / n - 1) * sun.y + ll.z * sun.z) : 0;
      const shade = sun ? MOON_SCENE.nightGlow + (1 - MOON_SCENE.nightGlow) * lit : 0.35 + 0.65 * Math.pow(ll.z, 0.45);
      const o = (j * n + i) * 4;
      out.data[o] = map.data[k]! * shade;
      out.data[o + 1] = map.data[k + 1]! * shade;
      out.data[o + 2] = map.data[k + 2]! * shade;
      out.data[o + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
}

/** Flyover progress 0–1 while the orbiter passes over a target (the middle at once under reduced motion). */
export function useFlyoverProgress(fly: GlobeProps['flyover'], still: boolean): number | undefined {
  const [k, setK] = useState<number>();
  useEffect(() => {
    if (!fly) return setK(undefined);
    if (still) return setK(0.5);
    // Wall-clock time (Date), so a test's fake clock can run it too.
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const x = Math.min(1, (Date.now() - t0) / GLOBE_FLYOVER_MS);
      setK(x);
      if (x < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fly?.n, fly?.targetId, still]); // eslint-disable-line react-hooks/exhaustive-deps
  return k;
}

/** An SVG path through view-frame points, split where the globe hides them. */
function paths(pts: Vec3[], to: (v: Vec3) => ScreenAt): { front: string; back: string } {
  let front = '';
  let back = '';
  let prev: boolean | undefined;
  for (const v of pts) {
    const a = to(v);
    const hidden = !a.front;
    const xy = `${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
    if (hidden) back += `${prev === true ? 'L' : 'M'}${xy}`;
    else front += `${prev === false ? 'L' : 'M'}${xy}`;
    prev = hidden;
  }
  return { front, back };
}

/**
 * The orbiter's angle on the Moon's ring: a sped-up lap from where the engine puts the craft (MOON_SCENE.lapS a lap),
 * restarting when the plane changes; the engine's angle itself under reduced motion.
 */
export function useLap(theta0: number, key: string, still: boolean): number {
  const [th, setTh] = useState(theta0);
  useEffect(() => {
    setTh(theta0);
    if (still) return;
    const t0 = Date.now();
    const id = setInterval(() => setTh(theta0 + (2 * Math.PI * (Date.now() - t0)) / (MOON_SCENE.lapS * 1000)), 80);
    return () => clearInterval(id);
  }, [key, still]); // eslint-disable-line react-hooks/exhaustive-deps
  return th;
}

/** The Moon's disc at the overview, where the arrival transition lands (rule 42). */
export function moonAnchor(m: MoonOrbitView, w: number, h: number, phone: boolean) {
  const { view, zoom } = moonFrame(m.now, undefined);
  const l = moonLayout(w, h, phone, zoom, moonEarthAt(m.earth.dir, view));
  return { left: l.cx - l.r, top: l.cy - l.r, width: 2 * l.r, height: 2 * l.r };
}

function MoonGlobe2D({ p, m, className }: { p: GlobeProps; m: MoonOrbitView; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const focusId = p.flyover?.targetId ?? (p.overview ? undefined : p.selected);
  const focus = p.cards.find((c) => c.id === focusId);
  const { view, zoom } = moonFrame(m.now, focus);
  const E = moonEarthAt(m.earth.dir, view);
  const { cx, cy, r } = moonLayout(p.w, p.h, p.phone, zoom, E);
  const px = Math.max(16, Math.min(1100, Math.round(2 * r * 1.5)));
  const sun = bodyToView(m.sun, view);

  useEffect(() => {
    let live = true;
    void loadMap('moon').then((map) => {
      if (live && map && ref.current) paint(ref.current, map, view, TARGET_SETS.moon.globe, sun);
    });
    return () => {
      live = false;
    };
  }, [view.lat_deg, view.lon_deg, px, sun.x.toFixed(2), sun.y.toFixed(2), sun.z.toFixed(2)]); // eslint-disable-line react-hooks/exhaustive-deps

  const to = (v: Vec3): ScreenAt => ({ x: cx + v.x * r, y: cy - v.y * r, front: !behindGlobe(v) });
  // A target's pass (polar, through it) when one is picked; the orbit flown now otherwise.
  const pass = focus ? m.passes[focus.id] : undefined;
  const plane = pass ?? m.now;
  const ring = lunarRing(plane, view, p.orbit.periapsis_m);
  const split = ringSplit(ring);
  const near = paths(split.near, to);
  const far = paths(split.far, to);
  const shade = !focus && ring.shadow ? paths(ringArc(ring, ring.shadow), to) : undefined;

  const k = useFlyoverProgress(p.flyover, p.still);
  const lap = useLap(pass ? -GLOBE_FLYOVER_ARC : m.now.theta, focus?.id ?? 'now', p.still);
  const th = k !== undefined ? flyoverTheta(k) : lap;
  const craft = orbitAt(ring.r, ring.r, ring.basis, th);
  const linked = linkUpOnRing(plane, th);
  const robot = to(craft);
  const earth = to(E);
  const robotHidden = !robot.front;
  const end = to(signalEnd(E, craft, linked));
  const brk = { x: earth.x + (end.x - earth.x) * MOON_SCENE.breakAt, y: earth.y + (end.y - earth.y) * MOON_SCENE.breakAt };
  let angle = Math.atan2(end.y - earth.y, end.x - earth.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  const er = MOON_SCENE.earthRadius * r;

  const marks: Record<string, ScreenAt> = {};
  for (const c of p.cards) marks[c.id] = to(targetVec(c, view));
  const labels = moonLabels(m, focus !== undefined, p.trimTag ?? false);
  const peri = focus ? to(orbitAt(ring.r, ring.r, ring.basis, 0)) : undefined;
  return (
    <div
      className={`sci-globe flat moon${className ? ` ${className}` : ''}${p.flyover ? ' flyover' : ''}${linked ? '' : ' lost'}`}
      data-globe="2d"
      data-focus={focus?.id ?? 'overview'}
      data-link={linked ? 'up' : 'lost'}
      {...(p.flyover ? { 'data-flyover': p.flyover.targetId } : {})}
    >
      <div className="sci-globe-anchor" style={moonAnchor(m, p.w, p.h, p.phone)} />
      <svg className="sci-globe-orbits back" width={p.w} height={p.h} aria-hidden="true">
        <path className="ring" d={near.back} />
      </svg>
      <canvas
        ref={ref}
        className="sci-globe-disc"
        width={px}
        height={px}
        style={{ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r }}
        role="img"
        aria-label={SCIENCE.globeCredit.moon}
      />
      <div className="sci-globe-edge" style={{ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r }} />
      <span className={`sci-earth${earth.front ? '' : ' behind'}`} style={{ left: earth.x, top: earth.y, width: 2 * er, height: 2 * er }} aria-hidden="true" />
      <svg className="sci-globe-orbits" width={p.w} height={p.h} aria-hidden="true">
        <path className="far" d={far.front + far.back} />
        <path className="ring" d={near.front} />
        {shade && <path className="shadow" d={shade.front} />}
        {earth.front && <line className={`signal${linked ? '' : ' lost'}`} x1={earth.x} y1={earth.y} x2={end.x} y2={end.y} />}
        <circle className={`robot${robotHidden ? ' behind' : ''}`} cx={robot.x} cy={robot.y} r={p.phone ? 4 : 5} />
      </svg>
      <GlobeMarks
        p={p}
        labels={globeLabels(focus, p.orbit, p.engineer)}
        at={{ marks, ...(focus ? { sel: marks[focus.id]! } : {}), ...(peri ? { peri } : {}), robot, ...(p.flyover ? { scan: marks[p.flyover.targetId]! } : {}) }}
      />
      <MoonMarks
        p={p}
        labels={labels}
        linked={linked}
        at={{
          earth: { ...earth, r: er },
          brk: { ...brk, front: true, angle },
          ...(labels.trim ? { trim: to(trimAt(ring)) } : {}),
        }}
      />
    </div>
  );
}

export function Globe2D(p: GlobeProps & { className?: string }) {
  if (p.body === 'moon' && p.moon) return <MoonGlobe2D p={p} m={p.moon} {...(p.className ? { className: p.className } : {})} />;
  return <MarsGlobe2D {...p} />;
}

function MarsGlobe2D(p: GlobeProps & { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const focusId = p.flyover?.targetId ?? (p.overview ? undefined : p.selected);
  const focus = p.cards.find((c) => c.id === focusId);
  const { view, zoom } = globeFrame(focus, p.body);
  const rD = globeDiscPx(p.w, p.h, p.phone);
  const r = rD * zoom;
  const cx = p.w / 2;
  const cy = p.h / 2;
  const px = Math.max(16, Math.min(1100, Math.round(2 * r * 1.5)));

  useEffect(() => {
    let live = true;
    void loadMap(p.body).then((map) => {
      if (live && map && ref.current) paint(ref.current, map, view, TARGET_SETS[p.body].globe);
    });
    return () => {
      live = false;
    };
  }, [view.lat_deg, view.lon_deg, px, p.body]); // eslint-disable-line react-hooks/exhaustive-deps

  const to = (v: Vec3): ScreenAt => ({ x: cx + v.x * r, y: cy - v.y * r, front: !behindGlobe(v) });
  const o = globeOrbits(p.orbit, focus, view);
  const ring = paths(orbitPoints(o.rp, o.ra, o.basis), to);
  const ghost = o.ghost && paths(orbitPoints(o.ghost.rp, o.ghost.ra, o.basis), to);
  const transfer = o.transfer && paths(orbitPoints(o.transfer.rp, o.transfer.ra, o.basis), to);
  const drag = o.dragArc ? paths(orbitPoints(o.rp, o.ra, o.basis, -GLOBE_DRAG_ARC, GLOBE_DRAG_ARC, 40), to) : undefined;
  const moons = p.cards.filter((c) => c.kind === 'moon' && c.moonOrbit_m).map((c) => ({ id: c.id, d: paths(moonRing(c.moonOrbit_m!, view), to) }));
  const k = useFlyoverProgress(p.flyover, p.still);
  // The orbiter waits a little before the periapsis; in a flyover it sweeps across it.
  const th = k !== undefined ? flyoverTheta(k) : -GLOBE_FLYOVER_ARC;
  const robot = to(orbitAt(o.rp, o.ra, o.basis, th));

  const marks: Record<string, ScreenAt> = {};
  for (const c of p.cards) marks[c.id] = to(targetVec(c, view));
  const apo = transferApoAt(o);
  const at = {
    marks,
    ...(focus ? { sel: marks[focus.id]! } : {}),
    peri: to(periapsisAt(o)),
    ...(apo ? { apo: to(apo) } : {}),
    robot,
    ...(p.flyover ? { scan: marks[p.flyover.targetId]! } : {}),
  };
  const tone = focus?.riskLevel ?? 'none';
  return (
    <div
      className={`sci-globe flat${p.className ? ` ${p.className}` : ''}${p.flyover ? ' flyover' : ''}`}
      data-globe="2d"
      data-focus={focus?.id ?? 'overview'}
      {...(p.flyover ? { 'data-flyover': p.flyover.targetId } : {})}
    >
      <div className="sci-globe-anchor" style={{ left: cx - rD, top: cy - rD, width: 2 * rD, height: 2 * rD }} />
      <svg className="sci-globe-orbits back" width={p.w} height={p.h} aria-hidden="true">
        {moons.map((m) => (
          <path key={m.id} className="moon" d={m.d.back} />
        ))}
        {ghost && <path className="ghost" d={ghost.back} />}
        {transfer && <path className="transfer" d={transfer.back} />}
        <path className="ring" d={ring.back} />
      </svg>
      <canvas
        ref={ref}
        className="sci-globe-disc"
        width={px}
        height={px}
        style={{ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r }}
        role="img"
        aria-label={SCIENCE.globeCredit[p.body]}
      />
      <div className="sci-globe-edge" style={{ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r }} />
      <svg className="sci-globe-orbits" width={p.w} height={p.h} aria-hidden="true">
        {moons.map((m) => (
          <path key={m.id} className="moon" d={m.d.front} />
        ))}
        {ghost && <path className="ghost" d={ghost.front} />}
        {transfer && <path className="transfer" d={transfer.front} />}
        <path className="ring" d={ring.front} />
        {drag && <path className={`drag ${tone}`} d={drag.front} />}
        <circle className="robot" cx={robot.x} cy={robot.y} r={p.phone ? 4 : 5} />
      </svg>
      <GlobeMarks p={p} labels={globeLabels(focus, p.orbit, p.engineer)} at={at} />
    </div>
  );
}
