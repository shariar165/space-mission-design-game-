// Spec section: "Constants and units". Each constant is Sourced; SI copies are derived below.
import { gameEstimate, sourced, type Sourced } from './types';

const MARS_FACT_SHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html';
const EARTH_FACT_SHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html';

export const G0 = sourced(9.80665, 'm/s²', 'SI definition (exact)');
export const AU = sourced(149_597_870.7, 'km', 'IAU 2012 definition (exact)');
export const SPEED_OF_LIGHT = sourced(299_792.458, 'km/s', 'SI definition (exact)');
export const S0 = sourced(1361.0, 'W/m²', 'NASA Mars/Earth Fact Sheet (solar irradiance at 1 AU)', {
  url: MARS_FACT_SHEET,
});
export const MU_SUN = gameEstimate(
  1.32712e11,
  'km³/s²',
  'Approximate; confirm on the NASA Sun Fact Sheet (spec: Constants)',
  'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
);
export const MU_EARTH = sourced(398_600, 'km³/s²', 'NASA Mars/Earth Fact Sheet', { url: MARS_FACT_SHEET });
export const R_EARTH = sourced(6378.1, 'km', 'NASA Mars/Earth Fact Sheet (equatorial radius)', {
  url: MARS_FACT_SHEET,
});
/** Obliquity of the ecliptic at J2000 (rotates J2000 equatorial vectors into the ecliptic frame). */
export const OBLIQUITY_J2000 = sourced(23.43928, 'deg', 'JPL Solar System Dynamics: Approximate Positions of the Planets (obliquity at J2000)', {
  url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
});
export const EARTH_ORBIT_PERIOD = sourced(365.256, 'days', 'NASA Earth Fact Sheet (sidereal orbit period)', {
  url: EARTH_FACT_SHEET,
});

/** Game rules from the spec (Assumptions 8 and the Power/Comms sections). Labelled "game estimate". */
export const GAME_RULES = {
  massGrowthMargin: gameEstimate(0.3, 'fraction', 'Game rule: 30% mass growth margin at concept stage (spec: Mass and cost)'),
  tankFraction: gameEstimate(0.12, 'fraction of propellant mass', 'Game rule: tank + feed system = 12% of propellant mass (spec: Propulsion)'),
  trajectoryCorrection_ms: gameEstimate(50, 'm/s', 'Game rule: fixed 50 m/s for trajectory corrections (spec: Propulsion)'),
  orbitMaintenance_msPerYear: gameEstimate(20, 'm/s per year', 'Game estimate for orbit maintenance; not in spec, to be sourced'),
  marginWarning: gameEstimate(0.1, 'fraction', 'Game rule: warning below 10% margin (spec: Propulsion)'),
  dsnPassHours: gameEstimate(8, 'h/day', 'Game rule: one 8-hour DSN pass per day (spec: Communications)'),
  earthParkingOrbitAlt_km: gameEstimate(185, 'km', 'Game estimate: typical low Earth parking orbit for trans-lunar injection'),
} as const;

export const CONSTANTS: Record<string, Sourced<number>> = {
  G0,
  AU,
  SPEED_OF_LIGHT,
  S0,
  MU_SUN,
  MU_EARTH,
  R_EARTH,
  EARTH_ORBIT_PERIOD,
  OBLIQUITY_J2000,
  ...GAME_RULES,
};

// ---- SI conversions (engine works in m, s, kg, W) ----
export const km = (x_km: number): number => x_km * 1000;
export const days = (d: number): number => d * 86_400;
export const toDays = (s: number): number => s / 86_400;
/** km³/s² → m³/s² */
export const mu = (x_km3s2: number): number => x_km3s2 * 1e9;

export const AU_M = km(AU.value);
export const C_MS = km(SPEED_OF_LIGHT.value);
export const MU_SUN_SI = mu(MU_SUN.value);
export const MU_EARTH_SI = mu(MU_EARTH.value);
export const R_EARTH_M = km(R_EARTH.value);
