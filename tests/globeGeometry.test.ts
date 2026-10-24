// The hero Mars globe's drawing (spec: UI rule 41; sdGeometry). Pixel layout, not physics: the numbers on screen
// are the engine's, but the drawing must keep their order, show a dip, fit the moons and put each orbit where the
// target is. The 3D and flat globes both draw from these functions.
import { describe, expect, it } from 'vitest';
import {
  flyoverTheta,
  GLOBE_ALT,
  GLOBE_FLYOVER_ARC,
  GLOBE_MAX_TILT_DEG,
  GLOBE_SIDE_DEG,
  GLOBE_VIEW,
  globeFrame,
  globeNorth,
  globeOrbits,
  globePoint,
  globeVec,
  labelPlace,
  orbitAt,
  orbitBasis,
  orbitDrawRadius,
  periapsisAt,
  targetVec,
  transferApoAt,
  type GlobeTarget,
  type Vec3,
} from '../src/ui/sdGeometry';

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const km = (x: number) => x * 1000;
// MAVEN's science orbit (missions.json): 150 × 6,300 km, 75°
const orbit = { periapsis_m: km(150), apoapsis_m: km(6300), inclination_deg: 75 };

const limb: GlobeTarget = { id: 'limb', kind: 'limb', pass: { periapsis_m: km(125), apoapsis_m: km(6300) }, dips: true, moonTransfer: false };
const olympus: GlobeTarget = { id: 'olympus-mons', kind: 'surface', lat_deg: 18.4, lon_deg: -134, pass: { periapsis_m: km(133.3), apoapsis_m: km(6300) }, dips: true, moonTransfer: false };
const phobos: GlobeTarget = { id: 'phobos', kind: 'moon', moonOrbit_m: km(9375), pass: { periapsis_m: km(150), apoapsis_m: km(9375 - 3396.2) }, dips: false, moonTransfer: true };

describe('altitudes drawn compressed', () => {
  it('keeps the order of every altitude and starts at the surface', () => {
    expect(orbitDrawRadius(0)).toBe(1);
    const hs = [0, 115, 125, 150, 300, 1000, 5978.8, 6300, 20_060.8].map(km);
    const rs = hs.map(orbitDrawRadius);
    for (let i = 1; i < rs.length; i++) expect(rs[i]!).toBeGreaterThan(rs[i - 1]!);
  });

  it('a 25 km dip shows: 150 → 125 km moves the ring by 0.8 × 25/300 ≈ 0.067 Mars radii', () => {
    expect(orbitDrawRadius(km(150)) - orbitDrawRadius(km(125))).toBeCloseTo((GLOBE_ALT.lowSpan * 25) / GLOBE_ALT.lowBand_km, 9);
  });

  it('Deimos still fits: 1 + 0.8 + 0.5 √(19,760.8 / 3,396.2) ≈ 3.0 Mars radii', () => {
    expect(orbitDrawRadius(km(23_457 - 3396.2))).toBeCloseTo(1 + 0.8 + 0.5 * Math.sqrt(19_760.8 / 3396.2), 9);
    expect(orbitDrawRadius(km(23_457 - 3396.2))).toBeLessThan(3.1);
  });
});

describe('the view frame', () => {
  it('globeVec is the orthographic projection globePoint draws, with depth', () => {
    const v = globeVec(18.4, -134);
    const p = globePoint(18.4, -134);
    expect(v.x).toBeCloseTo(p.x, 12);
    expect(-v.y).toBeCloseTo(p.y, 12);
    expect(p.front).toBe(v.z > 0);
    expect(len(v)).toBeCloseTo(1, 12);
    // The view centre faces the viewer.
    const c = globeVec(GLOBE_VIEW.lat_deg, GLOBE_VIEW.lon_deg);
    expect(c.z).toBeCloseTo(1, 12);
  });

  it('a surface target is framed from the side (its dip shows in profile); the pole from no higher than the tilt limit', () => {
    const f = globeFrame(olympus);
    const v = globeVec(18.4, -134, f.view);
    // GLOBE_SIDE_DEG of longitude left of the view centre, at the target's own latitude: cos(angle off centre) = cos² lat · cos Δλ + sin² lat
    const lat = (18.4 * Math.PI) / 180;
    expect(v.z).toBeCloseTo(Math.cos(lat) ** 2 * Math.cos((GLOBE_SIDE_DEG * Math.PI) / 180) + Math.sin(lat) ** 2, 12);
    expect(v.x).toBeLessThan(0);
    expect(f.zoom).toBeGreaterThan(1);
    const pole = globeFrame({ ...olympus, id: 'north-polar-cap', lat_deg: 90, lon_deg: 0 });
    expect(pole.view.lat_deg).toBe(GLOBE_MAX_TILT_DEG);
    expect(globeFrame(phobos).zoom).toBeLessThan(1);
  });
});

describe('the orbit drawn for a target', () => {
  it('an orbit plane through an equatorial periapsis is tilted by the inclination (h · N = cos i)', () => {
    const north = globeNorth(GLOBE_VIEW);
    const peri = { x: 1, y: 0, z: 0 }; // on the equator
    const b = orbitBasis(peri, north, 75);
    const h = { x: b.p.y * b.q.z - b.p.z * b.q.y, y: b.p.z * b.q.x - b.p.x * b.q.z, z: b.p.x * b.q.y - b.p.y * b.q.x };
    expect(Math.abs(dot(h, north))).toBeCloseTo(Math.cos((75 * Math.PI) / 180), 9);
    expect(dot(b.p, b.q)).toBeCloseTo(0, 12);
  });

  it('a dip puts the lowered periapsis over the target, with the orbit now drawn behind it', () => {
    const { view } = globeFrame(olympus);
    const o = globeOrbits(orbit, olympus, view);
    expect(o.dragArc).toBe(true);
    expect(o.ghost!.rp).toBeCloseTo(orbitDrawRadius(km(150)), 12);
    expect(o.rp).toBeCloseTo(orbitDrawRadius(km(133.3)), 12);
    const p = periapsisAt(o);
    const t = targetVec(olympus, view);
    expect(dot(p, t) / (len(p) * len(t))).toBeCloseTo(1, 9);
    // The conic: r(0) = rp, r(π) = ra
    expect(len(orbitAt(o.rp, o.ra, o.basis, 0))).toBeCloseTo(o.rp, 12);
    expect(len(orbitAt(o.rp, o.ra, o.basis, Math.PI))).toBeCloseTo(o.ra, 12);
  });

  it('the limb dips too; with no target the orbit now is drawn with no drag arc', () => {
    expect(globeOrbits(orbit, limb, GLOBE_VIEW).dragArc).toBe(true);
    const o = globeOrbits(orbit, undefined, GLOBE_VIEW);
    expect(o.dragArc).toBe(false);
    expect(o.ghost).toBeUndefined();
  });

  it('a moon’s orbit change reaches the moon: the transfer’s apoapsis is where the moon is drawn', () => {
    const { view } = globeFrame(phobos);
    const o = globeOrbits(orbit, phobos, view);
    const apo = transferApoAt(o)!;
    const m = targetVec(phobos, view);
    expect(apo.x).toBeCloseTo(m.x, 9);
    expect(apo.y).toBeCloseTo(m.y, 9);
    expect(apo.z).toBeCloseTo(m.z, 9);
    expect(o.dragArc).toBe(false);
  });
});

describe('the flyover', () => {
  it('sweeps from before the periapsis to after it, and is over the target (θ = 0) at the middle', () => {
    expect(flyoverTheta(0)).toBeCloseTo(-GLOBE_FLYOVER_ARC, 12);
    expect(flyoverTheta(0.5)).toBe(0);
    expect(flyoverTheta(1)).toBeCloseTo(GLOBE_FLYOVER_ARC, 12);
    // It lingers: a tenth of the run either side of the middle covers (0.2)^1.8 ≈ 5.5% of the arc
    expect(flyoverTheta(0.6) / GLOBE_FLYOVER_ARC).toBeCloseTo(0.2 ** 1.8, 12);
  });
});

describe('globe labels stay inside the box', () => {
  // Desktop pads: 22 px for the target's label, 14 px for an orbit label; 8 px from the edge.
  it('the target label reads right, and flips left near the right edge', () => {
    expect(labelPlace('sel', 100, 800, 200, false)).toEqual({ x: 100, left: false, below: false });
    // 700 + 22 + 200 > 792: flips left (700 − 22 − 200 ≥ 8)
    expect(labelPlace('sel', 700, 800, 200, false)).toEqual({ x: 700, left: true, below: false });
  });

  it('an orbit label reads outward, unless that side is too narrow; if neither side fits it slides in', () => {
    expect(labelPlace('peri', 300, 800, 200, false).left).toBe(true);
    expect(labelPlace('peri', 600, 800, 150, false).left).toBe(false);
    // At x = 60 the outward (left) side has no room: it reads right (inward), below the target's marker.
    expect(labelPlace('peri', 60, 800, 200, false)).toEqual({ x: 60, left: false, below: true });
    // A 390-wide phone, a 300 px label at x = 200: neither side fits (pad 10); it slides to 390 − 8 − 300 − 10 = 72.
    expect(labelPlace('peri', 200, 390, 300, true)).toEqual({ x: 72, left: false, below: false });
  });
});
