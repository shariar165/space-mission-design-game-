// Display formatting only: unit conversion and rounding, following the spec's display rules
// ("Constants and units"). No physics here; every value comes from the engine.
import type { Sourced } from '../engine/types';

const nf = (digits: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const num = (x: number, digits = 0): string => (Number.isFinite(x) ? nf(digits).format(x) : '∞');

/** Prefix + or − (a true minus sign), unless the value rounds to zero as shown. */
const withSign = (x: number, abs: string) => (!/[1-9]/.test(abs) ? abs : `${x > 0 ? '+' : '−'}${abs}`);

export const kg = (x: number) => `${num(x)} kg`;
export const watts = (x: number) => `${num(x)} W`;
export const signedKg = (x: number) => withSign(x, kg(Math.abs(x)));
export const signedWatts = (x: number) => withSign(x, watts(Math.abs(x)));

/** Speeds in m/s below 10 km/s, km/s above (spec display rules). */
export function speed(ms: number): string {
  return Math.abs(ms) < 10_000 ? `${num(ms)} m/s` : `${num(ms / 1000, 2)} km/s`;
}

/** Distances in million km. */
export const millionKm = (m: number) => `${num(m / 1e9, 1)} million km`;

/** Light delay in minutes. */
export const minutes = (s: number) => `${num(s / 60, 1)} min`;

/** Cost in $M; the fiscal year is taken from the Sourced unit, e.g. "$M (FY2019)". */
export function money(M: number, digits = 0): string {
  return `$${num(M, digits)}M`;
}
export const signedMoney = (M: number) => withSign(M, money(Math.abs(M), Math.abs(M) < 10 ? 1 : 0));
export function fiscalYear(unit: string): string {
  return /FY\d{4}/.exec(unit)?.[0] ?? '';
}

export const pct = (fraction: number, digits = 1) => `${num(fraction * 100, digits)}%`;
/** Signed percentage; above ±1000% the decimals are dropped (they carry no meaning there). */
export const signedPct = (fraction: number, digits = 1) =>
  Number.isFinite(fraction)
    ? withSign(fraction, pct(Math.abs(fraction), Math.abs(fraction) >= 10 ? 0 : digits))
    : fraction > 0
      ? '+∞'
      : '−∞';

/** Data volumes: bits → Gbit (or Mbit when small). */
export function bits(b: number): string {
  if (!Number.isFinite(b)) return '∞';
  return b >= 1e9 ? `${num(b / 1e9, 2)} Gbit` : `${num(b / 1e6, 0)} Mbit`;
}
export const gbit = (g: number) => `${num(g, g < 10 ? 2 : 0)} Gbit`;

export const days = (d: number) => `${num(d)} days`;

/** C3 in km²/s². */
export const c3 = (x: number) => `${num(x, 1)} km²/s²`;

/** A Sourced number with its own unit, converting only very large SI lengths for readability. */
export function sourcedValue(s: Sourced<unknown>): string {
  const v = s.value;
  if (typeof v !== 'number') return Array.isArray(v) ? `${v.length} points` : String(v);
  if (s.unit === 'm' && Math.abs(v) >= 1e7) return millionKm(v);
  if (s.unit === 'fraction' || s.unit === 'probability') return pct(v, Math.abs(v) < 0.01 ? 2 : 1);
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 3;
  const unit = s.unit.startsWith('$M') ? 'M' : s.unit;
  if (s.unit.startsWith('$M')) return `$${num(v, digits)}${unit}`;
  return `${num(v, digits)} ${unit}`.trim();
}

/** camelCase / snake_case input keys → readable labels. */
export function label(key: string): string {
  const special: Record<string, string> = {
    S0: 'Solar irradiance S₀',
    g0: 'Standard gravity g₀',
    etaSys: 'System efficiency η_sys',
    isp: 'Specific impulse Isp',
    c3: 'Launch energy C3',
  };
  if (special[key]) return special[key];
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const isoDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
