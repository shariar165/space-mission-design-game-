// Starter designs: the craft the player begins with in Build Bay. These are design INPUTS (part choices
// and sizes), not data. Mars and Bennu start from the real NASA presets as concept designs (the 30%
// growth margin applies; the as-flown dry mass is dropped). Launch and arrival dates always come from
// the engine's launch-window search, never from a hard-coded date.
import { presetDesign } from '../engine/missions';
import { bestLaunchWindow } from '../engine/trajectory';
import type { Design, DestinationId } from '../engine/types';

type Parts = Omit<Design, 'destination' | 'launchDate' | 'arrivalDate'>;

function concept(fromPreset: Design): Parts {
  const { asFlownDryMass_kg: _flown, lifetimeDays: _life, destination: _d, launchDate: _l, arrivalDate: _a, trajectoryOption: _t, ...parts } =
    fromPreset;
  return parts;
}

const GENERIC: Record<'moon' | 'venus' | 'jupiter', Parts> = {
  moon: {
    launchVehicleId: 'atlas-v-401',
    busId: 'small-bus',
    instrumentIds: ['camera', 'spectrometer'],
    power: { type: 'solar', arrayArea_m2: 6 },
    comms: { dishDiameter_m: 1, txPower_W: 40, groundDish_m: 34 },
    engineId: 'hydrazine-mono',
    propellant_kg: 350,
    scienceDays: 365,
    captureOrbit: { periapsis_km: 50, apoapsis_km: 1800 },
  },
  venus: {
    launchVehicleId: 'atlas-v-401',
    busId: 'medium-bus',
    instrumentIds: ['radar', 'spectrometer'],
    power: { type: 'solar', arrayArea_m2: 6 },
    comms: { dishDiameter_m: 2, txPower_W: 100, groundDish_m: 34 },
    engineId: 'biprop-mmh-nto',
    propellant_kg: 1300,
    scienceDays: 365,
    captureOrbit: { periapsis_km: 300, apoapsis_km: 60000 },
  },
  jupiter: {
    launchVehicleId: 'atlas-v-411',
    busId: 'medium-bus',
    instrumentIds: ['camera', 'magnetometer'],
    power: { type: 'rtg', rtgCount: 6 },
    comms: { dishDiameter_m: 2.5, txPower_W: 100, groundDish_m: 70 },
    engineId: 'biprop-mmh-nto',
    propellant_kg: 1600,
    scienceDays: 730,
    captureOrbit: { periapsis_km: 300000, apoapsis_km: 8000000 },
  },
};

const windowCache = new Map<string, { launchDate: string; arrivalDate: string }>();

/** Launch and arrival dates for the next window on or after `fromDate` (Moon: launch any day). */
export function launchWindow(destination: DestinationId, fromDate: string): { launchDate: string; arrivalDate: string } {
  if (destination === 'moon') return { launchDate: fromDate, arrivalDate: fromDate };
  const key = `${destination}|${fromDate}`;
  let w = windowCache.get(key);
  if (!w) {
    const b = bestLaunchWindow(destination, fromDate);
    w = { launchDate: b.launchDate, arrivalDate: b.arrivalDate };
    windowCache.set(key, w);
  }
  return w;
}

export function starterDesign(destination: DestinationId, fromDate: string): Design {
  const parts =
    destination === 'mars' ? concept(presetDesign('maven')) : destination === 'bennu' ? concept(presetDesign('osiris-rex')) : GENERIC[destination];
  return { destination, ...launchWindow(destination, fromDate), ...structuredClone(parts) };
}

export const today = () => new Date().toISOString().slice(0, 10);

/** A default mission name; the player can rename it. */
export function defaultMissionName(destination: DestinationId): string {
  const names: Record<DestinationId, string> = {
    moon: 'Silver Lantern',
    venus: 'Cloud Diver',
    mars: 'Red Atmosphere',
    bennu: 'Pebble Catcher',
    jupiter: 'Storm Watcher',
  };
  return names[destination];
}
