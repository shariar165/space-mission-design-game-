// Mission extension decision after the prime mission (spec: Mission operations, "Mission extension"). Each option
// is projected from the fixed environment: Δv for orbit maintenance, power at the end, Jupiter dose, data sent home.
import { DESTINATIONS, OPERATIONS, PARTS } from '../data';
import { defaultBooking, defaultPowerPlan, demand, downlinkCapacity_bitsPerDay } from './resources';
import type { ExtensionOption, OpsEnvironment } from './types';

export const END_MISSION = 'end';

export function extensionOptions(
  env: OpsEnvironment,
  p: { deltaVLeft_ms: number; dose_rad: number; attitudeOk: boolean; primeScienceFraction: number; instrumentsLost: string[] },
): ExtensionOption[] {
  const rad = DESTINATIONS[env.design.destination].radiation;
  const plan = defaultPowerPlan(env);
  const booking = defaultBooking(env.design);
  const approved = p.primeScienceFraction >= OPERATIONS.extension.approvalScience.value;
  const lost = new Set(p.instrumentsLost);
  const produced = env.loads.instruments.reduce((s, i) => s + (lost.has(i.id) ? 0 : i.data_bitsPerDay), 0);
  const end: ExtensionOption = {
    id: END_MISSION,
    years: 0,
    days: 0,
    deltaVNeeded_ms: 0,
    deltaVLeft_ms: p.deltaVLeft_ms,
    powerMarginAtEnd: 0,
    expectedData_Gbit: 0,
    cost_M: 0,
    approved: true,
    blockedBy: [],
  };
  const extend = OPERATIONS.extension.optionYears.value.map((years): ExtensionOption => {
    const days = Math.min(Math.round(years * 365.25), env.horizonDay - env.primeEndDay);
    const endDay = env.primeEndDay + days;
    const eEnd = env.days[endDay]!;
    const need = demand(env, eEnd, plan, { scienceOn: true, lost: p.instrumentsLost });
    const required = need.bus + need.heaters + need.instruments + need.radio;
    const powerMarginAtEnd = (eEnd.available_W - required) / required;
    let data_bits = 0;
    let dose = p.dose_rad;
    for (let d = env.primeEndDay + 1; d <= endDay; d++) {
      const e = env.days[d]!;
      data_bits += Math.min(produced, downlinkCapacity_bitsPerDay(e, booking));
      dose += e.doseRate_radPerDay;
    }
    const deltaVNeeded_ms = env.maintenancePerDay_ms * days;
    const blockedBy: ExtensionOption['blockedBy'] = [];
    if (deltaVNeeded_ms > p.deltaVLeft_ms) blockedBy.push('deltaV');
    if (powerMarginAtEnd < 0) blockedBy.push('power');
    if (rad && dose >= rad.tolerance_rad.value) blockedBy.push('radiation');
    if (!p.attitudeOk) blockedBy.push('attitude');
    if (!approved) blockedBy.push('science-review');
    return {
      id: `extend-${years}`,
      years,
      days,
      deltaVNeeded_ms,
      deltaVLeft_ms: p.deltaVLeft_ms,
      powerMarginAtEnd,
      ...(rad ? { doseAtEnd_rad: dose, doseTolerance_rad: rad.tolerance_rad.value } : {}),
      expectedData_Gbit: data_bits / 1e9,
      cost_M: PARTS.operations.opsCost_M_per_year.value * (days / 365.25),
      approved,
      blockedBy,
    };
  });
  return [end, ...extend];
}
