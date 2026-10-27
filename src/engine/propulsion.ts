// Spec section: "Propulsion". One rocket equation for every craft, player and real missions alike.
import { G0, GAME_RULES } from './constants';
import { DESTINATIONS, lookup, PARTS } from './data';
import { makeMeter } from './meter';
import type { Design, Meter, Sourced } from './types';

/** Δv = Isp · g₀ · ln(m_wet / m_dry)  [m/s] */
export function deltaVCapability(isp_s: number, mWet_kg: number, mDry_kg: number): number {
  return isp_s * G0.value * Math.log(mWet_kg / mDry_kg);
}

/** m_prop = m_dry · (e^(Δv / (Isp · g₀)) − 1)  [kg] — answers "carry X kg more propellant". */
export function propellantForDeltaV(dv_ms: number, isp_s: number, mDry_kg: number): number {
  return mDry_kg * (Math.exp(dv_ms / (isp_s * G0.value)) - 1);
}

/** Propellant used by a burn of Δv starting from mass m₀: m₀(1 − e^(−Δv/(Isp·g₀)))  [kg] */
export function propellantBurned(m0_kg: number, dv_ms: number, isp_s: number): number {
  return m0_kg * (1 - Math.exp(-dv_ms / (isp_s * G0.value)));
}

/** Tank and feed-system dry mass = 12% of propellant mass (game rule). */
export function tankMass(mProp_kg: number): number {
  return GAME_RULES.tankFraction.value * mProp_kg;
}

export interface DeltaVBudget {
  arrival_ms: number;
  orbitTransfer_ms: number;
  trajectoryCorrections_ms: number;
  maintenance_ms: number;
  lifetimeReserve_ms: number;
  other_ms: number;
  total_ms: number;
}

/**
 * Required Δv = arrival burn + capture→science orbit transfer + trajectory corrections (50 m/s)
 * + orbit maintenance over the science phase + lifetime reserve + other fixed manoeuvres.
 * Lifetime reserve = maintenance rate × (planned lifetime − science phase): propellant kept for the extended mission.
 */
export function deltaVBudget(p: {
  arrival_ms: number;
  orbitTransfer_ms?: number;
  scienceDays: number;
  lifetimeDays?: number;
  other_ms?: number;
  /** A low lunar orbit: one burn pair per whole sidereal period of science instead of the generic rate. */
  stationKeeping?: StationKeeping;
}): DeltaVBudget {
  const sk = p.stationKeeping;
  const rate = sk ? (sk.pair_ms * 365.25) / sk.period_days : GAME_RULES.orbitMaintenance_msPerYear.value;
  const orbitTransfer_ms = p.orbitTransfer_ms ?? 0;
  const trajectoryCorrections_ms = GAME_RULES.trajectoryCorrection_ms.value;
  const maintenance_ms = sk ? sk.pair_ms * Math.floor(p.scienceDays / sk.period_days) : rate * (p.scienceDays / 365.25);
  const lifetimeReserve_ms = rate * (Math.max(0, (p.lifetimeDays ?? p.scienceDays) - p.scienceDays) / 365.25);
  const other_ms = p.other_ms ?? 0;
  return {
    arrival_ms: p.arrival_ms,
    orbitTransfer_ms,
    trajectoryCorrections_ms,
    maintenance_ms,
    lifetimeReserve_ms,
    other_ms,
    total_ms: p.arrival_ms + orbitTransfer_ms + trajectoryCorrections_ms + maintenance_ms + lifetimeReserve_ms + other_ms,
  };
}

export interface StationKeeping {
  /** Δv of one burn pair (m/s) and the time between pairs (days). */
  pair_ms: number;
  period_days: number;
}

/**
 * Station-keeping for a low lunar orbit (spec: Moon orbit): mascons pull a 50 km orbit down, so LRO held 50 ± 20 km
 * with a burn pair every sidereal period. It applies to Moon orbits whose mean altitude is inside that band.
 */
export function stationKeeping(design: Pick<Design, 'destination' | 'captureOrbit' | 'scienceOrbit'>): StationKeeping | undefined {
  const dest = DESTINATIONS[design.destination];
  const sk = dest.stationKeeping;
  if (!sk) return undefined;
  const o = design.scienceOrbit ?? design.captureOrbit;
  const mean = (o.periapsis_km + o.apoapsis_km) / 2;
  if (mean > sk.meanAltitude_km.value + sk.altitudeBand_km.value) return undefined;
  return { pair_ms: sk.pairDeltaV_ms.value, period_days: dest.orbitPeriod_days.value };
}

/** Margin = (capability − required) / required. */
export function deltaVMeter(capability_ms: number, required_ms: number, inputs: Record<string, Sourced<number>>): Meter {
  return makeMeter(
    required_ms,
    capability_ms,
    (capability_ms - required_ms) / required_ms,
    'Δv = Isp·g₀·ln(m_wet/m_dry); margin = (capability − required)/required',
    inputs,
  );
}

/** Ion engines are limited to cruise and rendezvous (impulsive-burn assumption, spec: Assumptions 5). */
export function engineBlockers(engineId: string, missionType: 'orbiter' | 'rendezvous'): string[] {
  const engine = lookup(PARTS.engines, engineId, 'engine');
  if (!engine.canCapture && missionType === 'orbiter') {
    return [`The ${engine.name} engine cannot do a fast capture burn. Choose a chemical engine for an orbiter.`];
  }
  return [];
}
