// Pure edits to a Design (inputs only); evaluateDesign scores the result. Shared by the UI and the
// Cadet sizing in cadet.ts, so they live in the engine.
import type { Design } from './types';

const clampMin = (x: number, min: number) => (Number.isFinite(x) ? Math.max(min, x) : min);

export const withBus = (d: Design, busId: string): Design => ({ ...d, busId });
export const withEngine = (d: Design, engineId: string): Design => ({ ...d, engineId });
export const withLauncher = (d: Design, launchVehicleId: string): Design => {
  const { rideshareId: _ride, ...rest } = d;
  return { ...rest, launchVehicleId };
};
/** Ride as the secondary payload of a shared launch: the rocket is the shared one. */
export const withRideshare = (d: Design, rideshareId: string, vehicleId: string): Design => ({ ...d, rideshareId, launchVehicleId: vehicleId });
export const addInstrument = (d: Design, id: string): Design =>
  d.instrumentIds.includes(id) ? d : { ...d, instrumentIds: [...d.instrumentIds, id] };
export const removeInstrument = (d: Design, id: string): Design => ({ ...d, instrumentIds: d.instrumentIds.filter((x) => x !== id) });
export const withPowerType = (d: Design, type: 'solar' | 'rtg'): Design => ({
  ...d,
  power: {
    ...d.power,
    type,
    ...(type === 'rtg' && !d.power.rtgCount ? { rtgCount: 1 } : {}),
    ...(type === 'solar' && !d.power.arrayArea_m2 ? { arrayArea_m2: 1 } : {}),
  },
});
export const withArrayArea = (d: Design, a: number): Design => ({ ...d, power: { ...d.power, arrayArea_m2: clampMin(a, 0) } });
export const withRtgCount = (d: Design, n: number): Design => ({ ...d, power: { ...d.power, rtgCount: Math.round(clampMin(n, 0)) } });
export const withPropellant = (d: Design, kg: number): Design => ({ ...d, propellant_kg: clampMin(kg, 0) });
export const withDish = (d: Design, m: number): Design => ({ ...d, comms: { ...d.comms, dishDiameter_m: clampMin(m, 0.1) } });
export const withTxPower = (d: Design, W: number): Design => ({ ...d, comms: { ...d.comms, txPower_W: clampMin(W, 1) } });
export const withGroundDish = (d: Design, g: 34 | 70): Design => ({ ...d, comms: { ...d.comms, groundDish_m: g } });
export const withCaptureOrbit = (d: Design, periapsis_km: number, apoapsis_km: number): Design => ({
  ...d,
  captureOrbit: { periapsis_km: clampMin(periapsis_km, 0), apoapsis_km: clampMin(Math.max(apoapsis_km, periapsis_km), 0) },
});
export const withScienceOrbit = (d: Design, periapsis_km: number, apoapsis_km: number): Design => ({
  ...d,
  scienceOrbit: { periapsis_km: clampMin(periapsis_km, 0), apoapsis_km: clampMin(Math.max(apoapsis_km, periapsis_km), 0) },
});
export const withScienceDays = (d: Design, n: number): Design => {
  const scienceDays = Math.round(clampMin(n, 1));
  return { ...d, scienceDays, ...(d.lifetimeDays !== undefined ? { lifetimeDays: Math.max(d.lifetimeDays, scienceDays) } : {}) };
};
export const withDates = (d: Design, launchDate: string, arrivalDate: string): Design => ({ ...d, launchDate, arrivalDate });
export const withMissionClass = (d: Design, missionClass: NonNullable<Design['missionClass']>): Design => ({ ...d, missionClass });
