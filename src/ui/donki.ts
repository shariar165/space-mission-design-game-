// The Daily's space weather in the browser (spec UI rule 37). The game reads only its own static snapshot,
// data/donki-latest.json, which the DONKI GitHub Action writes from the CCMC DONKI-API once a day; it never calls
// CCMC. Missing, broken, stale or slow → offline, and the Daily flies seeded weather. A good snapshot is kept for
// the day (saves.ts), so a deploy later in the day cannot change a player's Daily. Engine: spaceWeather.ts.
import { isFresh, readSnapshot, realStorms, SPACE_WEATHER, type RealStorm } from '../engine/spaceWeather';
import { loadDonkiCache, saveDonkiCache } from './saves';

export const SNAPSHOT_PATH = 'data/donki-latest.json';

export type SpaceWeather = { status: 'live'; storms: RealStorm[]; window: { startDate: string; endDate: string } } | { status: 'offline' };

const OFFLINE: SpaceWeather = { status: 'offline' };

function live(text: string, todayIso: string): SpaceWeather | undefined {
  const snap = readSnapshot(text);
  if (!snap || !isFresh(snap, todayIso)) return undefined;
  return { status: 'live', storms: realStorms(snap), window: snap.window };
}

export async function loadSpaceWeather(todayIso: string, opts: { timeoutMs?: number } = {}): Promise<SpaceWeather> {
  const cached = loadDonkiCache(todayIso);
  const fromCache = cached !== undefined ? live(cached, todayIso) : undefined;
  if (fromCache) return fromCache;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? SPACE_WEATHER.donki.loadTimeout_ms.value);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${SNAPSHOT_PATH}`, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) return OFFLINE;
    const text = await res.text();
    const w = live(text, todayIso);
    if (!w) return OFFLINE;
    saveDonkiCache(todayIso, text);
    return w;
  } catch {
    return OFFLINE;
  } finally {
    clearTimeout(timer);
  }
}
