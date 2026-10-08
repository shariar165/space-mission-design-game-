// Mars right now (Home; spec UI rule 36): today's Earth–Mars distance, the one-way light time and the next solar
// conjunction, from the same JPL approximate elements every flight uses. Runs offline: no API call.
import { AU_M, C_MS } from './constants';
import { earthDistance, julianDate, synodicPeriodDays } from './ephemeris';
import { bodyConjunctions } from './ops/predictable';

export interface MarsNow {
  date: string;
  distance_m: number;
  distance_AU: number;
  /** One-way light time, d / c (s). */
  lightTime_s: number;
  /** The commanding window (Sun within the threshold of Mars in Earth's sky) now or next. */
  conjunction: {
    now: boolean;
    startDate: string;
    /** The day of the smallest Sun–Earth–Mars angle. */
    closestDate: string;
    endDate: string;
    /** Whole days from `date` to `closestDate` (0 while the window is open). */
    inDays: number;
  };
}

const isoOfJd = (jd: number) => new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Search margin before today, so a window already open is found with its real start (windows last about two weeks). */
const LOOKBACK_DAYS = 30;

export function marsNow(dateIso: string): MarsNow {
  const date = dateIso.slice(0, 10);
  const jd = julianDate(date);
  const distance_m = earthDistance('mars', jd);
  const windows = bodyConjunctions('mars', jd - LOOKBACK_DAYS, jd + synodicPeriodDays('mars') + LOOKBACK_DAYS);
  const w = windows.find((x) => x.endJd >= jd);
  if (!w) throw new Error(`No Mars conjunction found within one synodic period of ${date}`);
  const now = w.startJd <= jd;
  const closestDate = isoOfJd(w.minJd);
  return {
    date,
    distance_m,
    distance_AU: distance_m / AU_M,
    lightTime_s: distance_m / C_MS,
    conjunction: {
      now,
      startDate: isoOfJd(w.startJd),
      closestDate,
      endDate: isoOfJd(w.endJd),
      inDays: now ? 0 : dayDiff(date, closestDate),
    },
  };
}
