// Shared engine types. See docs/SCIENCE_SPEC.md, "Engine structure for Claude Code".
// The engine works in SI internally (m, s, kg, W); data files keep the units they were
// published in, and each Sourced value states its unit.

/** Every constant and catalogue value carries its source (spec rule 2). */
export interface Sourced<T> {
  value: T;
  unit: string;
  source: string;
  url?: string;
  /** True for game values and for spec values marked "approx." / "to verify". */
  isGameEstimate: boolean;
}

export function sourced<T>(
  value: T,
  unit: string,
  source: string,
  opts: { url?: string; isGameEstimate?: boolean } = {},
): Sourced<T> {
  const s: Sourced<T> = { value, unit, source, isGameEstimate: opts.isGameEstimate ?? false };
  if (opts.url !== undefined) s.url = opts.url;
  return s;
}

/** Shorthand for a game value (labelled "game estimate" in the UI, never as NASA data). */
export function gameEstimate<T>(value: T, unit: string, source: string, url?: string): Sourced<T> {
  return sourced(value, unit, source, { url, isGameEstimate: true });
}

export type DestinationId = 'moon' | 'venus' | 'mars' | 'bennu' | 'jupiter';
export type MissionClass = 'discovery' | 'newFrontiers';

export interface Design {
  destination: DestinationId;
  launchVehicleId: string;
  launchDate: string;
  arrivalDate: string;
  busId: string;
  instrumentIds: string[];
  power: { type: 'solar' | 'rtg'; arrayArea_m2?: number; rtgCount?: number };
  comms: { dishDiameter_m: number; txPower_W: number; groundDish_m: 34 | 70 };
  engineId: string;
  propellant_kg: number;
  captureOrbit: { periapsis_km: number; apoapsis_km: number };
  // --- Additions to the spec interface (documented in README) ---
  /** Cost cap class. Defaults to 'discovery'. */
  missionClass?: MissionClass;
  /** Science operations length, used for orbit maintenance Δv. Defaults to 365 days. */
  scienceDays?: number;
  /** Planned total lifetime at the target incl. extended mission (≥ scienceDays). Sizes the lifetime Δv reserve. */
  lifetimeDays?: number;
  /** Science orbit (altitudes, km). Defaults to the capture orbit, i.e. no orbit-change burn. */
  scienceOrbit?: { periapsis_km: number; apoapsis_km: number };
  /** 'direct' (default) uses Lambert between the dates; a fixed route uses a published real-mission route. */
  trajectoryOption?: 'direct' | 'nasa-earth-flyby';
  /**
   * Real-mission presets only: published, as-built dry mass. The 30% concept growth
   * margin is for concept designs and is not added on top of a flown mass.
   */
  asFlownDryMass_kg?: Sourced<number>;
}

export type MeterStatus = 'ok' | 'warning' | 'over';

export interface Meter {
  used: number;
  limit: number;
  /** limit − used, in the meter's own units (e.g. kg of launch capacity left). */
  headroom: number;
  margin: number;
  status: MeterStatus;
  equation: string;
  inputs: Record<string, Sourced<number>>;
  /** False when the model behind the meter has no real anchor yet (Comms). */
  calibrated?: boolean;
}

export interface Evaluation {
  meters: {
    mass: Meter;
    power: Meter;
    deltaV: Meter;
    data: Meter;
    cost: Meter;
    /** Added when risk.ts is built. */
    risk?: Meter;
  };
  /** Plain-language reasons the craft cannot launch, e.g. "Too heavy by 120 kg". */
  blockers: string[];
  /** Non-blocking messages, e.g. "gravity assists are not modelled". */
  notes: string[];
  trajectory: {
    c3: number; // km²/s²
    vInfArr: number; // km/s
    flightDays: number;
    path: [number, number][]; // heliocentric (or Earth-centred for the Moon) ecliptic x, y in m
    method: 'lambert' | 'hohmann' | 'fixed-route';
    /** Longest flight the model allows (< 1 revolution of the Hohmann transfer orbit); absent for the Moon. */
    maxFlightDays?: number;
  };
  /** Extra computed values the Debrief and validation need. */
  details: {
    dryMass_kg: number;
    wetMass_kg: number;
    deltaVCapability_ms: number;
    deltaVRequired_ms: number;
    launchCapacity_kg: number;
    solarPowerRange_W?: { atPerihelion: number; atAphelion: number };
    earthDistanceAtArrival_m: number;
    lightDelayAtArrival_s: number;
  };
}

export type Vec3 = [number, number, number];
