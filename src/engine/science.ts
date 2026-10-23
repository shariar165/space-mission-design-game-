// Spec section: "Science targets and downlink". What a picture of a Mars target costs, from existing physics:
// vis-viva orbit changes (trajectory.ts), a MAVEN-fitted exponential upper atmosphere for drag, the camera's
// power, and the link budget for the downlink. Mission operations charges these when an OBSERVE order arrives.
import { mu } from './constants';
import { DESTINATIONS } from './data';
import { DEEP_DIP, MARS_ATMOSPHERE, MARS_MOONS, SCIENCE_CAMERA, type Target } from './targets';
import { orbitChangeDeltaV, orbitPeriod, visViva } from './trajectory';
import { gameEstimate, type Sourced } from './types';

/** Game rules for the science phase (registered in the data audit). */
export const SCIENCE_RULES = {
  busFace_m2: gameEstimate(4, 'm²', 'Game estimate (Science targets): the bus face added to the solar array for drag'),
  observeDays: gameEstimate(1, 'days', 'Game estimate (Science targets): a surface or moon target is shot within a day of the order'),
  lowestAlt_km: gameEstimate(115, 'km', 'Game estimate after MAVEN: its deep dips went no lower than about 115 km (Zurek et al. 2017)'),
  passStart_h: gameEstimate(6, 'h after midnight (spacecraft day)', 'Game estimate (Science targets): when each day\'s DSN pass opens'),
  cadetCampaign_days: gameEstimate(120, 'days', 'Game rule (Science targets): the Cadet Mars prime science campaign, so a run at 100× lasts about five minutes'),
} satisfies Record<string, Sourced<number>>;

const R_MARS = DESTINATIONS.mars.radius_km.value * 1000;
const MU_MARS = mu(DESTINATIONS.mars.gm_km3s2.value);
const KGKM3 = 1e-9; // kg/km³ → kg/m³

/** H = (h_nominal − h_deep) / ln(ρ_deep / ρ_nominal), from MAVEN's two published periapsis densities. */
export function scaleHeight_m(): number {
  const a = MARS_ATMOSPHERE;
  return ((a.nominalAlt_km.value - a.deepAlt_km.value) * 1000) / Math.log(a.deepDensity_kgkm3.value / a.nominalDensity_kgkm3.value);
}

/** ρ(h) = ρ_nominal · e^(−(h − h_nominal)/H)  [kg/m³] */
export function density_kgm3(alt_m: number): number {
  const a = MARS_ATMOSPHERE;
  return a.nominalDensity_kgkm3.value * KGKM3 * Math.exp(-(alt_m - a.nominalAlt_km.value * 1000) / scaleHeight_m());
}

/** Drag on one periapsis pass: Δv = (C_D A / 2m) · ρ_p · v_p · √(2π r_p H)  [m/s] */
export function dragDeltaVPerPass(o: { rp_m: number; ra_m: number; area_m2: number; mass_kg: number }): number {
  const rho = density_kgm3(o.rp_m - R_MARS);
  const vp = visViva(MU_MARS, o.rp_m, o.rp_m, o.ra_m);
  const cd = MARS_ATMOSPHERE.dragCoefficient.value;
  return ((cd * o.area_m2) / (2 * o.mass_kg)) * rho * vp * Math.sqrt(2 * Math.PI * o.rp_m * scaleHeight_m());
}

/** Periapsis passes per day: 86,400 s / T. */
export const passesPerDay = (rp_m: number, ra_m: number) => 86_400 / orbitPeriod(MU_MARS, rp_m, ra_m);

/** The range a target's resolution allows: resolution ÷ IFOV  [m]. */
export const altitudeNeeded_m = (t: Target) => t.resolution_m.value / (SCIENCE_CAMERA.ifov_urad.value * 1e-6);

/** Range to a point Δ of arc beyond the ground track, from altitude h: √(R² + (R+h)² − 2R(R+h) cos Δ)  [m] */
export const slantRange_m = (R: number, h: number, gap_rad: number) => Math.sqrt(R ** 2 + (R + h) ** 2 - 2 * R * (R + h) * Math.cos(gap_rad));

/** Downlink time of an image at a link rate  [s]. */
export const imageDownlink_s = (bits: number, rate_bps: number) => (rate_bps > 0 ? bits / rate_bps : Infinity);

export interface ObservationInput {
  /** Current orbit, radii from Mars' centre. */
  rp_m: number;
  ra_m: number;
  inclination_deg: number;
  area_m2: number;
  mass_kg: number;
  inDustSeason: boolean;
}

export interface ObservationPlan {
  /** False when no orbit the craft may fly can see the target well enough. */
  reachable: boolean;
  /** Periapsis altitude while observing (surface and limb), m; the current one for moons. */
  obsAlt_m: number;
  /** Orbit changes there and back (vis-viva), m/s. */
  dvOrbit_ms: number;
  /** Extra drag over the observation, against staying at the current periapsis, m/s. */
  dvDrag_ms: number;
  dv_ms: number;
  /** How long the observation lasts, days. */
  days: number;
  /** ρ at the observing periapsis ÷ MAVEN's nominal ρ: scales the drag-heating hazard (0 = no low pass). */
  dragFactor: number;
  /** Camera energy, Wh (charged as extra load on the observing day). */
  energy_Wh: number;
  imagingPasses: number;
  image_bits: number;
}

/** The lowest periapsis that sees a surface point at the needed range, or undefined if none does. */
function surfaceAltitude(t: Target, o: ObservationInput, need_m: number): number | undefined {
  const maxLat = o.inclination_deg <= 90 ? o.inclination_deg : 180 - o.inclination_deg;
  const gap = Math.max(0, Math.abs(t.lat_deg?.value ?? 0) - maxLat) * (Math.PI / 180);
  if (gap === 0) return need_m;
  // Solve s(h) = need for x = R + h: x² − 2R cos Δ x + R² − s² = 0 → x = R cos Δ + √(R² cos² Δ − R² + s²)
  const disc = R_MARS ** 2 * Math.cos(gap) ** 2 - R_MARS ** 2 + need_m ** 2;
  if (disc < 0) return undefined;
  const h = R_MARS * Math.cos(gap) + Math.sqrt(disc) - R_MARS;
  return h > 0 ? h : undefined;
}

/** What observing a target costs from the current orbit (spec: Science targets and downlink). */
export function observationPlan(t: Target, o: ObservationInput): ObservationPlan {
  const hp = o.rp_m - R_MARS;
  const lowest = SCIENCE_RULES.lowestAlt_km.value * 1000;
  const cam = SCIENCE_CAMERA;
  const imagingPasses = t.dust ? (o.inDustSeason ? cam.dustSeasonRepeats.value : cam.dustRepeats.value) : 1;
  const base = { imagingPasses, energy_Wh: cam.power_W.value * cam.imaging_h.value * imagingPasses, image_bits: t.image_Mbit.value * 1e6 };
  const there = (rp: number, ra: number) => 2 * orbitChangeDeltaV(MU_MARS, { rp: o.rp_m, ra: o.ra_m }, { rp, ra });

  if (t.kind === 'moon') {
    const a = MARS_MOONS[t.moon!].a_km.value * 1000;
    const dvOrbit_ms = there(o.rp_m, a);
    return { ...base, reachable: a > o.rp_m, obsAlt_m: hp, dvOrbit_ms, dvDrag_ms: 0, dv_ms: dvOrbit_ms, days: SCIENCE_RULES.observeDays.value, dragFactor: 0 };
  }

  const days = t.kind === 'limb' ? DEEP_DIP.days.value : SCIENCE_RULES.observeDays.value;
  const want = t.kind === 'limb' ? DEEP_DIP.alt_km.value * 1000 : surfaceAltitude(t, o, altitudeNeeded_m(t));
  const reachable = want !== undefined && want >= lowest;
  const obsAlt_m = reachable ? Math.min(hp, want) : hp;
  const lowered = obsAlt_m < hp;
  const dvOrbit_ms = lowered ? there(R_MARS + obsAlt_m, o.ra_m) : 0;
  const craft = { ra_m: o.ra_m, area_m2: o.area_m2, mass_kg: o.mass_kg };
  const dvDrag_ms = lowered
    ? (dragDeltaVPerPass({ ...craft, rp_m: R_MARS + obsAlt_m }) - dragDeltaVPerPass({ ...craft, rp_m: o.rp_m })) * passesPerDay(R_MARS + obsAlt_m, o.ra_m) * days
    : 0;
  // Only a pass flown lower than usual (or the deep dip) adds drag-heating risk; the usual orbit's is already flown.
  const dragFactor = lowered || t.kind === 'limb' ? density_kgm3(obsAlt_m) / (MARS_ATMOSPHERE.nominalDensity_kgkm3.value * KGKM3) : 0;
  return { ...base, reachable, obsAlt_m, dvOrbit_ms, dvDrag_ms, dv_ms: dvOrbit_ms + dvDrag_ms, days, dragFactor };
}
