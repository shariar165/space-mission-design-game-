// What the player has done, kept in this browser only (a per-player convenience, like the level stars): the
// Notebook's flight facts and the Daily results. Every read and write survives missing storage.
import type { DailyGrid } from '../engine/daily';
import { emptyFacts, type NotebookFacts } from '../engine/notebook';

const NOTEBOOK_KEY = 'sd.notebook';
const DAILY_KEY = 'sd.daily';

type Flights = Omit<NotebookFacts, 'progress'>;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : undefined;
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: this visit only */
  }
}

export function loadFlights(): Flights {
  const { progress: _p, ...empty } = emptyFacts();
  const v = read<Partial<Flights>>(NOTEBOOK_KEY, {});
  return { ...empty, ...v, hazards: { ...(v.hazards ?? {}) } };
}
export const saveFlights = (f: Flights) => write(NOTEBOOK_KEY, f);

export interface DailySave {
  played: string[];
  results: Record<string, DailyGrid>;
}
export const loadDaily = (): DailySave => {
  const v = read<Partial<DailySave>>(DAILY_KEY, {});
  return { played: Array.isArray(v.played) ? v.played : [], results: v.results ?? {} };
};
export const saveDaily = (d: DailySave) => write(DAILY_KEY, d);

/** Which help the player has already seen: level briefings ("brief:<level id>") and the flight coach ("coach"). */
const SEEN_KEY = 'sd.seen';
export const loadSeen = (): string[] => {
  const v = read<unknown>(SEEN_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
};
export const saveSeen = (seen: string[]) => write(SEEN_KEY, seen);

/** The robot's name, chosen on Pack (empty means the default). */
const ROBOT_KEY = 'sd.robot';
export const loadRobotName = (): string => {
  const v = read<{ name?: unknown }>(ROBOT_KEY, {});
  return typeof v.name === 'string' ? v.name : '';
};
export const saveRobotName = (name: string) => write(ROBOT_KEY, { name });

/** Sound on or off (on unless the player turned it off). */
const SOUND_KEY = 'sd.sound';
export const loadSoundOn = (): boolean => read<{ on?: unknown }>(SOUND_KEY, {}).on !== false;
export const saveSoundOn = (on: boolean) => write(SOUND_KEY, { on });

/** Postcards from space: the ids of every card earned so far (postcards.ts). */
const POSTCARDS_KEY = 'sd.postcards';
export const loadPostcards = (): string[] => {
  const v = read<{ earned?: unknown }>(POSTCARDS_KEY, {});
  return Array.isArray(v.earned) ? v.earned.filter((x): x is string => typeof x === 'string') : [];
};
export const savePostcards = (earned: string[]) => write(POSTCARDS_KEY, { earned });
