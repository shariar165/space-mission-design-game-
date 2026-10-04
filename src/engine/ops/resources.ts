// Daily resources (spec: Mission operations, "Power" and "Data and the DSN"): the power plan and on-board load
// shedding, the downlink, and DSN bookings with the published aperture fee.
import { GAME_RULES } from '../constants';
import { OPERATIONS } from '../data';
import type { Design } from '../types';
import type { DsnBooking, EnvDay, OpsEnvironment, PowerPlan } from './types';

/** Every instrument on, heaters at their full need, radio on: the plan the Power meter assumes. */
export function defaultPowerPlan(env: OpsEnvironment): PowerPlan {
  return { instruments: Object.fromEntries(env.loads.instruments.map((i) => [i.id, 1])), heaters: 1, radio: true };
}

/** One pass a day on the design's ground dish, for the spec's default pass length (8 h). */
export function defaultBooking(design: Design): DsnBooking {
  return { dish: design.comms.groundDish_m, hours: GAME_RULES.dsnPassHours.value };
}

export interface Loads {
  bus: number;
  heaters: number;
  instruments: number;
  radio: number;
}

/** What the plan asks for on a day (W). Instruments draw only while science is on. */
export function demand(env: OpsEnvironment, day: EnvDay, plan: PowerPlan, opts: { scienceOn: boolean; lost?: string[] }): Loads {
  const lost = new Set(opts.lost ?? []);
  const instruments = opts.scienceOn
    ? env.loads.instruments.reduce((s, i) => s + (lost.has(i.id) ? 0 : Math.max(0, Math.min(1, plan.instruments[i.id] ?? 0)) * i.power_W), 0)
    : 0;
  return {
    bus: env.loads.bus_W,
    heaters: Math.max(0, plan.heaters) * day.heaterNeed_W,
    instruments,
    radio: plan.radio ? env.loads.radio_W : 0,
  };
}

/**
 * On-board fault protection, with no delay: the bus is never shed; then heaters, then radio, then instruments get
 * what is left (so instruments are shed first, then radio, then heaters).
 */
export function shedLoads(available_W: number, d: Loads): Loads {
  let rest = available_W;
  const take = (want: number) => {
    const got = Math.max(0, Math.min(want, rest));
    rest -= got;
    return got;
  };
  const bus = take(d.bus);
  const heaters = take(d.heaters);
  const radio = take(d.radio);
  const instruments = take(d.instruments);
  return { bus, heaters, instruments, radio };
}

/** Downlink capacity for a day (bits): link rate to the booked dish × booked hours; zero in a conjunction. */
export function downlinkCapacity_bitsPerDay(day: EnvDay, booking: DsnBooking): number {
  if (day.conjunction || booking.hours <= 0) return 0;
  return (booking.dish === 70 ? day.rate70_bps : day.rate34_bps) * booking.hours * 3600;
}

/** DSN aperture fee per hour ($, FY09): AF = R_B [A_W (0.9 + F_C/10)] (NASA MO&CS Eq. 2-1). */
export function apertureFee_perHour(dish: 34 | 70): number {
  const d = OPERATIONS.dsn;
  const aw = dish === 70 ? d.apertureWeight70.value : d.apertureWeight34.value;
  return d.baseRate_perHour.value * aw * (0.9 + d.contactsPerWeek.value / 10);
}

/** Cost of one day's pass ($M, FY09): fee × (pass hours + set-up and tear-down). */
export function dsnDayCost_M(b: DsnBooking): number {
  if (b.hours <= 0) return 0;
  return (apertureFee_perHour(b.dish) * (b.hours + OPERATIONS.dsn.passOverhead_h.value)) / 1e6;
}

/** What a booking costs beyond the default pass already inside the operations cost ($M). Never a refund. */
export function dsnExtraCost_M(b: DsnBooking, standard: DsnBooking): number {
  return Math.max(0, dsnDayCost_M(b) - dsnDayCost_M(standard));
}
