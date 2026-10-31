// What the player has done, kept in this browser only (a per-player convenience, like the level stars): the
// Notebook's flight facts and the Daily results. Every read and write survives missing storage.
import type { DailyGrid } from '../engine/daily';
import { emptyFacts, type NotebookFacts } from '../engine/notebook';
import { teamProblem, type Team } from '../engine/team/roles';
import { cleanRobotName } from './sdWords';

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

/** The robot's name, chosen on the name screen or Pack (empty means the default); cleaned again when read. */
const ROBOT_KEY = 'sd.robot';
export const loadRobotName = (): string => {
  const v = read<{ name?: unknown }>(ROBOT_KEY, {});
  return typeof v.name === 'string' ? cleanRobotName(v.name) : '';
};
export const saveRobotName = (name: string) => write(ROBOT_KEY, { name });

// The language of the words (`sd.lang`) is saved by lang.ts itself: this module imports sdWords, which needs lang.

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

/** Today's DONKI snapshot (the file's text), so the Daily stays the same all day (ui/donki.ts). */
const DONKI_KEY = 'sd.donki';
export const loadDonkiCache = (todayIso: string): string | undefined => {
  const v = read<{ date?: unknown; text?: unknown }>(DONKI_KEY, {});
  return v.date === todayIso && typeof v.text === 'string' ? v.text : undefined;
};
export const saveDonkiCache = (date: string, text: string) => write(DONKI_KEY, { date, text });

/** The Mars globe: '3d' or '2d' when the player flipped the toggle (absent: the device decides). */
const GLOBE_KEY = 'sd.globe';
export const loadGlobeMode = (): '2d' | '3d' | undefined => {
  const v = read<{ mode?: unknown }>(GLOBE_KEY, {});
  return v.mode === '2d' || v.mode === '3d' ? v.mode : undefined;
};
export const saveGlobeMode = (mode: '2d' | '3d') => write(GLOBE_KEY, { mode });

/** Team mode: the crew last set up (seats, call signs, roles), so the next team starts from it. */
const TEAM_KEY = 'sd.team';
export const loadTeam = (): Team | undefined => {
  const v = read<{ seats?: unknown }>(TEAM_KEY, {});
  const team = { seats: Array.isArray(v.seats) ? (v.seats as Team['seats']) : [] };
  try {
    const p = teamProblem(team);
    // a crew saved mid-handover (a player left without a role) is still a fine place to start
    return p === undefined || p === 'no-role' ? team : undefined;
  } catch {
    return undefined;
  }
};
export const saveTeam = (team: Team) => write(TEAM_KEY, { seats: team.seats });
