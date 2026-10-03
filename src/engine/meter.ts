import { GAME_RULES } from './constants';
import type { Meter, MeterStatus, Sourced } from './types';

/** Below 0% margin the design is over; below 10% it gets a warning (spec: Propulsion). */
export function marginStatus(margin: number): MeterStatus {
  if (margin < 0) return 'over';
  if (margin < GAME_RULES.marginWarning.value) return 'warning';
  return 'ok';
}

export function makeMeter(
  used: number,
  limit: number,
  margin: number,
  equation: string,
  inputs: Record<string, Sourced<number>>,
  calibrated?: boolean,
): Meter {
  const m: Meter = { used, limit, headroom: limit - used, margin, status: marginStatus(margin), equation, inputs };
  if (calibrated !== undefined) m.calibrated = calibrated;
  return m;
}
