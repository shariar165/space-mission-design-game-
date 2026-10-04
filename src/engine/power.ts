// Spec section: "Power". Solar inverse-square with one calibrated efficiency, RTG, heaters, batteries.
import { AU_M, S0 } from './constants';
import { PARTS } from './data';
import { sunDistance } from './ephemeris';
import { makeMeter } from './meter';
import { sourced, type Design, type Meter, type Sourced } from './types';

/** η_sys = 0.20, calibrated from MAVEN's 12 m² producing 1,150–1,700 W across the Mars orbit. */
export const ETA_SYS = sourced(
  0.2,
  'fraction',
  'Calibrated from NASA Science: MAVEN (12 m², 1,150–1,700 W at Mars) with Mars perihelion/aphelion from the Mars Fact Sheet; gives 0.199 and 0.196',
  { url: 'https://science.nasa.gov/mission/maven/' },
);

/** P = S₀ (1 AU / r)² · A · η_sys · cos θ · (1 − d)^t */
export function solarPower(p: {
  area_m2: number;
  sunDistance_m: number;
  eta?: number;
  sunAngle_rad?: number;
  degradationPerYear?: number;
  years?: number;
}): number {
  const eta = p.eta ?? ETA_SYS.value;
  const cosTheta = Math.cos(p.sunAngle_rad ?? 0);
  const degr = (1 - (p.degradationPerYear ?? 0)) ** (p.years ?? 0);
  return S0.value * (AU_M / p.sunDistance_m) ** 2 * p.area_m2 * eta * cosTheta * degr;
}

/** Sunlight relative to Earth's: (1 AU / r)². */
export function sunlightFraction(sunDistance_m: number): number {
  return (AU_M / sunDistance_m) ** 2;
}

/** η that makes the equation give power P for array area A at distance r (θ = 0, t = 0). */
export function calibrateEta(power_W: number, area_m2: number, sunDistance_m: number): number {
  return power_W / (S0.value * sunlightFraction(sunDistance_m) * area_m2);
}

export const rtgPower = (count: number): number => count * PARTS.power.rtgPower_W.value;
export const rtgMass = (count: number): number => count * PARTS.power.rtgMass_kg.value;

/** Heater power rises as sunlight falls (game rule): base × (1 + k·(1 − s)), s = sunlight fraction ≤ 1. */
export function heaterPower(base_W: number, sunlight: number): number {
  const k = PARTS.power.heaterSunlightFactor.value;
  return base_W * (1 + k * (1 - Math.min(1, sunlight)));
}

/**
 * Longest eclipse in an orbit (cylindrical shadow, Sun in the orbit plane, shadow centred on apoapsis —
 * the worst case, because the craft is slowest there). Radii from the body centre.
 */
export function longestEclipse_s(mu: number, bodyRadius: number, rp: number, ra: number): number {
  const a = (rp + ra) / 2;
  const e = (ra - rp) / (ra + rp);
  const p = a * (1 - e * e);
  const n = Math.sqrt(mu / a ** 3);
  const y = (nu: number) => (p * Math.sin(nu)) / (1 + e * Math.cos(nu)); // distance from the shadow axis
  const meanAnomaly = (nu: number) => {
    const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
    return E - e * Math.sin(E);
  };
  // y(ν) peaks at cos ν = −e and falls to 0 at apoapsis (ν = π).
  const nuPeak = Math.acos(-e);
  let nuEntry: number;
  if (y(nuPeak) <= bodyRadius) {
    nuEntry = Math.PI / 2; // whole night-side half of the orbit is in shadow
  } else {
    let lo = nuPeak;
    let hi = Math.PI;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (y(mid) > bodyRadius) lo = mid;
      else hi = mid;
    }
    nuEntry = Math.max(Math.PI / 2, (lo + hi) / 2);
  }
  return (2 * (Math.PI - meanAnomaly(nuEntry))) / n;
}

/** Battery mass = energy needed / specific energy (game value for Li-ion). */
export function batteryMass(eclipse_s: number, load_W: number): number {
  return (eclipse_s / 3600) * load_W / PARTS.power.batterySpecificEnergy_Wh_per_kg.value;
}

/** Margin = (available − required) / required. */
export function powerMeter(available_W: number, required_W: number, inputs: Record<string, Sourced<number>>): Meter {
  return makeMeter(
    required_W,
    available_W,
    (available_W - required_W) / required_W,
    'P = S₀(1 AU/r)²·A·η_sys·cosθ·(1−d)^t (or RTG count × 110 W); margin = (available − required)/required',
    inputs,
  );
}

/**
 * Power on a date: available (solar with degradation since launch, or RTG) and required (base load + heaters,
 * which rise as sunlight falls). Shared by evaluateDesign and Mission operations.
 */
export function powerOnDay(design: Design, jd: number, years: number, baseRequired_W: number, heaterBase_W: number) {
  const rSun = sunDistance(design.destination, jd);
  const available_W =
    design.power.type === 'solar'
      ? solarPower({
          area_m2: design.power.arrayArea_m2 ?? 0,
          sunDistance_m: rSun,
          degradationPerYear: PARTS.power.solarDegradation_perYear.value,
          years,
        })
      : rtgPower(design.power.rtgCount ?? 0);
  const heaters_W = heaterPower(heaterBase_W, sunlightFraction(rSun));
  return { rSun, available_W, heaters_W, required_W: baseRequired_W + heaters_W };
}
