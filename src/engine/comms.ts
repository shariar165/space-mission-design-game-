// Spec section: "Communications". Scaled link budget anchored to one reference link, plus light delay.
import { C_MS, GAME_RULES } from './constants';
import { makeMeter } from './meter';
import { gameEstimate, type Meter, type Sourced } from './types';

const PLACEHOLDER = 'PLACEHOLDER reference link — replace with a published DESCANSO telecom summary (spec: Communications)';

/**
 * The reference link. Spec: pick one mission whose data rate, distance, transmitter power and both
 * antenna sizes are published. Not chosen yet, so every value is a placeholder and the meter is uncalibrated.
 */
export const REFERENCE_LINK = {
  rate_bps: gameEstimate(200_000, 'bit/s', PLACEHOLDER, 'https://descanso.jpl.nasa.gov/'),
  txPower_W: gameEstimate(100, 'W (RF)', PLACEHOLDER),
  dishDiameter_m: gameEstimate(2, 'm', PLACEHOLDER),
  groundDish_m: gameEstimate(34, 'm', `${PLACEHOLDER}; DSN parameters from DSN 810-005`, 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/'),
  distance_m: gameEstimate(1.5e11, 'm', PLACEHOLDER),
};

/** Until the reference link is filled in, the Comms meter shows "uncalibrated" in Engineer mode. */
export const COMMS_CALIBRATED = false;

/** R = R_ref · (P_t/P_t,ref) · (D_sc/D_sc,ref)² · (D_gs/D_gs,ref)² · (d_ref/d)² */
export function dataRate(p: { txPower_W: number; dishDiameter_m: number; groundDish_m: number; distance_m: number }): number {
  const r = REFERENCE_LINK;
  return (
    r.rate_bps.value *
    (p.txPower_W / r.txPower_W.value) *
    (p.dishDiameter_m / r.dishDiameter_m.value) ** 2 *
    (p.groundDish_m / r.groundDish_m.value) ** 2 *
    (r.distance_m.value / p.distance_m) ** 2
  );
}

/** Volume = R × DSN pass length (default one 8-hour pass per day). */
export function dataPerDay_bits(rate_bps: number, passHours = GAME_RULES.dsnPassHours.value): number {
  return rate_bps * passHours * 3600;
}

/** t = d / c */
export function lightDelay_s(distance_m: number): number {
  return distance_m / C_MS;
}

/** Science data produced per day vs data downlinked per day. Margin = (downlinked − produced)/produced. */
export function dataMeter(produced_bits: number, downlinked_bits: number, inputs: Record<string, Sourced<number>>): Meter {
  return makeMeter(
    produced_bits,
    downlinked_bits,
    produced_bits > 0 ? (downlinked_bits - produced_bits) / produced_bits : Infinity,
    'R = R_ref·(P_t/P_t,ref)·(D_sc/D_sc,ref)²·(D_gs/D_gs,ref)²·(d_ref/d)²; volume = R × pass length',
    inputs,
    COMMS_CALIBRATED,
  );
}
