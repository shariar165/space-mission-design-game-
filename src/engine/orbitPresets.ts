// Science-orbit presets on the Mars Pack (spec UI rule 59). A Cadet picks one of three orbits to do the science from:
// stay in the capture orbit (no burn), MAVEN's science orbit (missions.json, sourced) or a high orbit near Deimos'
// (pack.json, a game rule). The pick only edits the design's science orbit (its orientation is kept), so
// evaluateDesign and Mission operations fly it with no new physics. The cards' numbers are the engine's own.
import { mu } from './constants';
import { DESTINATIONS } from './data';
import { evaluateDesign } from './index';
import { missionPreset } from './missions';
import { PACK } from './pack';
import { density_kgm3, observationPlan } from './science';
import { MARS_ATMOSPHERE, TARGETS } from './targets';
import type { Design, DestinationId, MeterStatus, Sourced } from './types';

export type OrbitPresetId = 'capture' | 'maven' | 'high';
type Orbit = { periapsis_km: Sourced<number>; apoapsis_km: Sourced<number> };

const DATA = PACK as unknown as { orbitPresets: { high: Orbit } };

/** The fixed presets' altitudes (the capture orbit is the design's own arrival orbit). */
export const ORBIT_PRESETS: Record<'maven' | 'high', Orbit> = {
  maven: { periapsis_km: missionPreset('maven').design.scienceOrbit!.periapsis_km, apoapsis_km: missionPreset('maven').design.scienceOrbit!.apoapsis_km },
  high: DATA.orbitPresets.high,
};

const IDS: OrbitPresetId[] = ['capture', 'maven', 'high'];

/** The presets a destination offers: Mars only (the Moon levels keep LRO's orbit). */
export const orbitPresets = (destination: DestinationId): OrbitPresetId[] => (destination === 'mars' ? IDS : []);

/** The altitudes a preset flies for this design (km). */
function altitudes(design: Design, id: OrbitPresetId): { periapsis_km: number; apoapsis_km: number } {
  if (id === 'capture') return { periapsis_km: design.captureOrbit.periapsis_km, apoapsis_km: design.captureOrbit.apoapsis_km };
  return { periapsis_km: ORBIT_PRESETS[id].periapsis_km.value, apoapsis_km: ORBIT_PRESETS[id].apoapsis_km.value };
}

/** The design flying a preset: the science orbit's altitudes change, its orientation stays. */
export function withOrbit(design: Design, id: OrbitPresetId | string): Design {
  const alt = altitudes(design, id as OrbitPresetId);
  return { ...design, scienceOrbit: { ...(design.scienceOrbit ?? {}), ...alt } };
}

/** The preset a design flies (undefined: an orbit set some other way, e.g. in the Build Bay). */
export function orbitIdOf(design: Design): OrbitPresetId | undefined {
  const so = design.scienceOrbit ?? design.captureOrbit;
  return IDS.find((id) => {
    const a = altitudes(design, id);
    return Math.abs(a.periapsis_km - so.periapsis_km) < 1e-6 && Math.abs(a.apoapsis_km - so.apoapsis_km) < 1e-6;
  });
}

export interface OrbitCard {
  id: OrbitPresetId;
  periapsis_km: number;
  apoapsis_km: number;
  /** Δv to change from the capture orbit to this one (vis-viva, the Δv budget's own term). */
  orbitChange_ms: number;
  /** The Δv meter's margin flying this orbit: fuel left over for pictures and trouble. */
  fuelMargin: number;
  /** The Δv meter's status flying this orbit. */
  fuelStatus: MeterStatus;
  /** Round trip from this orbit to each moon's orbit and back (the OBSERVE order's own cost), m/s. */
  moons: { phobos_ms: number; deimos_ms: number };
  /** Air density at periapsis ÷ MAVEN's nominal (the drag-heating scale): ≈ 1 at 150 km. */
  drag: number;
  /** The longest shadow this orbit can fly through (the battery is sized for it), s. */
  longestShadow_s: number;
  picked: boolean;
  /** Where the altitudes come from (ⓘ): MAVEN's published orbit, the game rule, or the design's capture orbit. */
  source?: Sourced<number>;
}

const KGKM3 = 1e-9;

/** One card per preset, read against the packed craft (each flown through evaluateDesign). */
export function orbitCards(design: Design): OrbitCard[] {
  const dest = DESTINATIONS[design.destination];
  const R = dest.radius_km.value * 1000;
  const picked = orbitIdOf(design);
  const moonTrip = (id: 'phobos' | 'deimos', rp_m: number, ra_m: number, inclination_deg: number) =>
    observationPlan(TARGETS.find((t) => t.id === id)!, { rp_m, ra_m, inclination_deg, area_m2: 1, mass_kg: 1, inDustSeason: false }).dvOrbit_ms;
  return orbitPresets(design.destination).map((id) => {
    const d = withOrbit(design, id);
    const ev = evaluateDesign(d);
    const so = d.scienceOrbit!;
    const rp = R + so.periapsis_km * 1000;
    const ra = R + so.apoapsis_km * 1000;
    const inc = so.inclination_deg ?? 0;
    return {
      id,
      periapsis_km: so.periapsis_km,
      apoapsis_km: so.apoapsis_km,
      orbitChange_ms: ev.details.deltaVBudget.orbitTransfer_ms,
      fuelMargin: ev.meters.deltaV.margin,
      fuelStatus: ev.meters.deltaV.status,
      moons: { phobos_ms: moonTrip('phobos', rp, ra, inc), deimos_ms: moonTrip('deimos', rp, ra, inc) },
      drag: density_kgm3(so.periapsis_km * 1000) / (MARS_ATMOSPHERE.nominalDensity_kgkm3.value * KGKM3),
      longestShadow_s: ev.details.power.battery.sizedForEclipse_s,
      picked: id === picked,
      ...(id === 'capture' ? {} : { source: ORBIT_PRESETS[id].apoapsis_km }),
    };
  });
}
