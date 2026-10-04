// Hazards drawn from rate models (spec: Mission operations, "Hazards drawn from rates"). Every hazard is a
// non-homogeneous Poisson process λ(t, state), drawn by thinning from its own seeded stream: candidates at a bound
// rate λ̄, accepted when u < λ(t, state)/λ̄. All draws are made at the start, so a player decision changes the odds
// of what comes next but never reshuffles the future.
import { AU_M } from '../constants';
import { DESTINATIONS, OPERATIONS } from '../data';
import { julianDate } from '../ephemeris';
import { BASE_RISK, makeRng, marginFactor } from '../risk';
import type { Candidate } from './types';
import { solarLongitude } from './predictable';

const YEAR_DAYS = 365.25;

/** FNV-1a 32-bit hash of a stream name. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** An independent random stream per hazard: the seed mixed with the stream name's hash (mulberry32, as the Monte Carlo). */
export function subRng(seed: number, name: string): () => number {
  return makeRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ fnv1a(name)) >>> 0);
}

/**
 * Candidate times on [0, horizon] for a Poisson process at the bound rate λ̄ (per day). Gaps are −ln(1 − u)/λ̄.
 * Each candidate carries its acceptance and outcome draws.
 */
export function drawCandidates(rng: () => number, bound_perDay: number, horizon_days: number, maxCount = 100_000): Candidate[] {
  const out: Candidate[] = [];
  if (!(bound_perDay > 0)) return out;
  let t = 0;
  while (out.length < maxCount) {
    t += -Math.log(1 - rng()) / bound_perDay;
    if (!(t <= horizon_days)) break;
    out.push({ t, uAccept: rng(), uOutcome: rng() });
  }
  return out;
}

/** Thinning: the candidates a rate λ(t) ≤ λ̄ accepts. */
export function thin(candidates: Candidate[], rate_perDay: (t: number) => number, bound_perDay: number): Candidate[] {
  return candidates.filter((c) => c.uAccept < rate_perDay(c.t) / bound_perDay);
}

// ---------------------------------------------------------------------------
// Solar storms

const cycleShape = (s: [string, string]) => ({ min: julianDate(s[0]), max: julianDate(s[1]) });

/**
 * Solar activity A(t) ∈ [0, 1]: (1 − cos)/2 rising from a cycle minimum (0) to its maximum (1), then
 * (1 + cos)/2 falling to the next minimum. Cycles 24 and 25 are published; earlier dates repeat cycle 24's shape
 * and later dates cycle 25's, every 11 years.
 */
export function solarActivity(jd: number): number {
  const L = OPERATIONS.solarCycle.length_years.value * YEAR_DAYS;
  const c25 = cycleShape(OPERATIONS.solarCycle.cycle25.value);
  const c = jd >= c25.min ? c25 : cycleShape(OPERATIONS.solarCycle.cycle24.value);
  const rise = c.max - c.min;
  const phase = jd - (c.min + Math.floor((jd - c.min) / L) * L);
  if (phase < rise) return (1 - Math.cos((Math.PI * phase) / rise)) / 2;
  return (1 + Math.cos((Math.PI * (phase - rise)) / (L - rise))) / 2;
}

/** λ_max at 1 AU (per day), from the cycle mean: λ_max(1 + ρ)/2 = N / L. */
export function stormRateMax_perDay(): number {
  const sw = OPERATIONS.spaceWeather;
  const L = OPERATIONS.solarCycle.length_years.value * YEAR_DAYS;
  return (2 * sw.strongStormsPerCycle.value) / (L * (1 + sw.quietToActiveRatio.value));
}

/** λ = λ_max (ρ + (1 − ρ) A(t)) (1 AU / r)^n  (per day). */
export function stormRate_perDay(jd: number, sunDistance_m: number): number {
  const sw = OPERATIONS.spaceWeather;
  const rho = sw.quietToActiveRatio.value;
  return stormRateMax_perDay() * (rho + (1 - rho) * solarActivity(jd)) * (AU_M / sunDistance_m) ** sw.distanceExponent.value;
}

// ---------------------------------------------------------------------------
// Mars global dust storms

const inDustSeason = (ls: number) => {
  const d = OPERATIONS.marsDust;
  return ls >= d.seasonStartLs_deg.value && ls < d.seasonEndLs_deg.value;
};

let seasonDaysCache: number | undefined;
/** Length of the dust season in days, from Ls over one Mars year (Kepler's equation through the ephemeris). */
export function dustSeasonDays(): number {
  if (seasonDaysCache !== undefined) return seasonDaysCache;
  const T = DESTINATIONS.mars.orbitPeriod_days.value;
  const step = 0.25;
  let n = 0;
  for (let t = 0; t < T; t += step) if (inDustSeason(solarLongitude('mars', 2451545.0 + t))) n++;
  seasonDaysCache = n * step;
  return seasonDaysCache;
}

/** Constant inside the season, zero outside; one storm per 3 Mars years on average (per day). */
export function dustStormRate_perDay(ls_deg: number): number {
  if (!inDustSeason(ls_deg)) return 0;
  return OPERATIONS.marsDust.globalStormsPerMarsYear.value / dustSeasonDays();
}

// ---------------------------------------------------------------------------
// Debris, wheels, memory, radiation damage, orbit insertion

export const debrisRate_perDay = (): number => OPERATIONS.debris.rate_perYear.value / YEAR_DAYS;

/** Weibull hazard per wheel: h(t) = (β/η)(t/η)^(β−1)  (per year, t in years). */
export function wheelHazard_perYear(age_years: number): number {
  const w = OPERATIONS.reactionWheels;
  const b = w.weibullShape.value;
  const eta = w.weibullScale_years.value;
  return (b / eta) * (Math.max(0, age_years) / eta) ** (b - 1);
}

/** Dose rate the memory model is scaled to (rad/day): the Jupiter reference dose rate, or 1 where there is none. */
export function memoryDoseRef_radPerDay(): number {
  const rad = DESTINATIONS.jupiter.radiation;
  return rad ? rad.doseRateRef_radPerHour.value * 24 : 1;
}

/** λ = λ₀ (1 + k_storm·[storm active]) (1 + k_rad·Ḋ/Ḋ_ref) × k_cold on a cold day  (per day). */
export function memoryRate_perDay(p: { stormActive: boolean; doseRate_radPerDay: number; cold: boolean; coldFactor?: number }): number {
  const m = OPERATIONS.memory;
  return (
    (m.baseRate_perYear.value / YEAR_DAYS) *
    (1 + m.stormFactor.value * (p.stormActive ? 1 : 0)) *
    (1 + m.radiationFactor.value * (p.doseRate_radPerDay / memoryDoseRef_radPerDay())) *
    (p.cold ? coldMultiplier(p.coldFactor) : 1)
  );
}

/** The cold-day hardware hazard factor, softened by a packed heater: 1 + (k_cold − 1) × coldFactor. */
export function coldMultiplier(coldFactor = 1): number {
  return 1 + (OPERATIONS.power.coldHazardFactor.value - 1) * coldFactor;
}

/** Orbit-insertion anomaly on the arrival day: p = p_base,arrival × f(Δv margin left), as the Risk model. */
export function insertionAnomalyChance(deltaVMargin: number): number {
  return Math.min(1, BASE_RISK.arrival.value * marginFactor(deltaVMargin));
}
