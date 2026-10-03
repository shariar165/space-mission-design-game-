// Spec section: "Communications". Scaled link budget anchored to one published link (MRO), DSN gains from 810-005.
import { C_MS, GAME_RULES } from './constants';
import { makeMeter } from './meter';
import { gameEstimate, sourced, type Meter, type Sourced } from './types';

const MRO = 'DESCANSO Design and Performance Summary Series, Article 12: Mars Reconnaissance Orbiter Telecommunications (Taylor, Lee, Shambayati, JPL, Sept 2006)';
const MRO_URL = 'https://descanso.jpl.nasa.gov/DPSummary/MRO_092106.pdf';
const DSN_101 = 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101I.pdf';
const DSN_104 = 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/104/104Q.pdf';

/**
 * The reference link (spec: Communications): MRO's X-band design point. "At a maximum distance from Earth
 * (400 million km), the orbiter is designed to send data at a rate of at least 500 kbps", with a 100-watt
 * X-band TWTA and a 3-meter high-gain antenna. The article does not name the ground station for that figure;
 * 34 m is inferred (MRO schedules two 34-m stations daily; a 34-m link budget with 810-005 gains matches it),
 * so that one value stays a labelled estimate.
 */
export const REFERENCE_LINK = {
  rate_bps: sourced(500_000, 'bit/s', `${MRO}: at least 500 kbps at maximum distance`, { url: MRO_URL }),
  txPower_W: sourced(100, 'W (RF)', `${MRO}: 100-watt X-band TWTA (100 W nominal RF output)`, { url: MRO_URL }),
  dishDiameter_m: sourced(3, 'm', `${MRO}: 3-meter-diameter high-gain antenna`, { url: MRO_URL }),
  groundDish_m: gameEstimate(
    34,
    'm',
    `Inferred: ${MRO} does not name the station for the 500 kbps figure; MRO schedules two 34-m stations daily, and a 34-m link budget (DSN 810-005 gains) is consistent with it`,
    MRO_URL,
  ),
  distance_m: sourced(400e9, 'm', `${MRO}: maximum distance from Earth, 400 million km`, { url: MRO_URL }),
};

/** DSN X-band receive gains (DSN Telecommunications Link Design Handbook 810-005), X-only configuration. */
export const DSN_X_BAND_GAIN_DBI: Record<34 | 70, Sourced<number>> = {
  34: sourced(68.24, 'dBi', 'DSN 810-005 module 104 Rev. Q, Table 6: DSS-24 34-m BWG X-band receive gain (8425 MHz), X-only mode', { url: DSN_104 }),
  70: sourced(74.55, 'dBi', 'DSN 810-005 module 101 Rev. I, Table 2: DSS-14 70-m X-band receive gain (8420 MHz), X-only configuration', { url: DSN_101 }),
};

/** The link is anchored to a published mission (MRO); only the anchor's station pairing is inferred. */
export const COMMS_CALIBRATED = true;

const dbRatio = (dB: number) => 10 ** (dB / 10);

/**
 * R = R_ref · (P_t/P_t,ref) · (D_sc/D_sc,ref)² · (G_gs/G_gs,ref) · (d_ref/d)²
 * Spacecraft antenna gain scales with diameter squared (same efficiency as the reference); the ground term
 * is the ratio of the DSN 810-005 X-band gains.
 */
export function dataRate(p: { txPower_W: number; dishDiameter_m: number; groundDish_m: 34 | 70; distance_m: number }): number {
  const r = REFERENCE_LINK;
  const refGround = r.groundDish_m.value as 34 | 70;
  return (
    r.rate_bps.value *
    (p.txPower_W / r.txPower_W.value) *
    (p.dishDiameter_m / r.dishDiameter_m.value) ** 2 *
    dbRatio(DSN_X_BAND_GAIN_DBI[p.groundDish_m].value - DSN_X_BAND_GAIN_DBI[refGround].value) *
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
  const m = makeMeter(
    produced_bits,
    downlinked_bits,
    produced_bits > 0 ? (downlinked_bits - produced_bits) / produced_bits : Infinity,
    'R = R_ref·(P_t/P_t,ref)·(D_sc/D_sc,ref)²·(G_gs/G_gs,ref)·(d_ref/d)²; volume = R × pass length',
    inputs,
    COMMS_CALIBRATED,
  );
  // The downlink limit rests on the reference link; its one estimated value is the inferred station pairing.
  m.limitSource = REFERENCE_LINK.groundDish_m;
  return m;
}
