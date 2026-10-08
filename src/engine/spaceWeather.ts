// The Daily's real Sun (spec UI rule 37). The DONKI GitHub Action saves NASA DONKI solar flares (FLR) and CMEs from
// the last 7 days as public/data/donki-latest.json; this module reads that snapshot, keeps the strong events
// (M/X flares, fast CMEs; a flare and a CME DONKI links count as one storm), and replays the real week across the
// flight: an event a fraction f into the week strikes the same fraction of the way from the start of cruise to the
// end of the prime mission. Pure: the UI does the fetching.
import spaceWeatherJson from '../data/spaceWeather.json';
import { HAZARDS } from './data';
import type { Candidate, OpsEnvironment } from './ops/types';
import type { Sourced } from './types';

type S = Sourced<number>;
export const SPACE_WEATHER = spaceWeatherJson as unknown as {
  donki: { apiBase: Sourced<string>; viewerBase: Sourced<string>; windowDays: S; maxAge_days: S; loadTimeout_ms: S };
  storms: { flareMinFlux_Wm2: S; xFlux_Wm2: S; cmeMinSpeed_kms: S; strongCmeSpeed_kms: S; maxStorms: S };
};

// ---------------------------------------------------------------------------
// The snapshot (scripts/fetch-donki.mjs writes it)

export interface DonkiSnapshot {
  fetchedAt: string;
  source: { base: string; announcement: string };
  window: { startDate: string; endDate: string };
  flr: { url: string; records: unknown[] };
  cme: { url: string; records: unknown[] };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDay = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`));
const isList = (x: unknown): x is { url: string; records: unknown[] } => isObj(x) && typeof x.url === 'string' && Array.isArray(x.records);

/** The snapshot file's text as a snapshot, or undefined when it is anything else (a web page, bad JSON, wrong shape). */
export function readSnapshot(text: string): DonkiSnapshot | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObj(json) || typeof json.fetchedAt !== 'string' || !isObj(json.window) || !isObj(json.source)) return undefined;
  const w = json.window;
  if (!isDay(w.startDate) || !isDay(w.endDate) || w.endDate < w.startDate) return undefined;
  if (!isList(json.flr) || !isList(json.cme)) return undefined;
  return json as unknown as DonkiSnapshot;
}

const DAY_MS = 86_400_000;
const dayMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Fresh while the window ended no more than maxAge_days before today (and not after it). */
export function isFresh(s: DonkiSnapshot, todayIso: string): boolean {
  const { window: w } = s; // the snapshot's DONKI window (not the DOM)
  const age = Math.round((dayMs(todayIso) - dayMs(w.endDate)) / DAY_MS);
  return age >= 0 && age <= SPACE_WEATHER.donki.maxAge_days.value;
}

// ---------------------------------------------------------------------------
// Records → storms

/**
 * GOES peak flux of a flare class ("M2.3" → 2.3 × 10⁻⁵ W/m²). NOAA's classes are a log scale, a factor of ten per
 * letter: X = 10⁻⁴ and M = 10⁻⁵ (spaceWeather.json), so C = 10⁻⁶, B = 10⁻⁷ and A = 10⁻⁸ W/m².
 */
export function flareFlux_Wm2(classType: string): number | undefined {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(classType.trim());
  if (!m) return undefined;
  const steps = 'ABCMX'.indexOf(m[1]!) - 'ABCMX'.indexOf('M');
  return Number(m[2]) * SPACE_WEATHER.storms.flareMinFlux_Wm2.value * 10 ** steps;
}

/** DONKI times are "2024-05-10T06:54Z" (UTC, minutes). */
const timeMs = (t: unknown) => (typeof t === 'string' ? Date.parse(t) : NaN);

interface Event {
  id: string;
  kind: 'flare' | 'cme';
  time: string;
  ms: number;
  link: string;
  linked: string[];
  classType?: string;
  speed_kms?: number;
  /** 2 for X flares and CMEs at strongCmeSpeed_kms or more, else 1. */
  tier: number;
  /** Value over its tier's threshold (flux / threshold, or speed / threshold). */
  strength: number;
}

const linkedIds = (r: Record<string, unknown>) =>
  Array.isArray(r.linkedEvents) ? r.linkedEvents.filter(isObj).map((e) => e.activityID).filter((x): x is string => typeof x === 'string') : [];

const linkOf = (r: Record<string, unknown>, type: 'FLR' | 'CME') =>
  typeof r.link === 'string' && r.link.startsWith('http') ? r.link : `${SPACE_WEATHER.donki.viewerBase.value}${type}/`;

function flareEvent(r: unknown): Event | undefined {
  if (!isObj(r) || typeof r.flrID !== 'string' || typeof r.classType !== 'string') return undefined;
  const flux = flareFlux_Wm2(r.classType);
  const st = SPACE_WEATHER.storms;
  if (flux === undefined || flux < st.flareMinFlux_Wm2.value) return undefined;
  const time = typeof r.peakTime === 'string' ? r.peakTime : r.beginTime;
  const ms = timeMs(time);
  if (Number.isNaN(ms)) return undefined;
  const x = flux >= st.xFlux_Wm2.value;
  return {
    id: r.flrID,
    kind: 'flare',
    time: time as string,
    ms,
    link: linkOf(r, 'FLR'),
    linked: linkedIds(r),
    classType: r.classType.trim(),
    tier: x ? 2 : 1,
    strength: flux / (x ? st.xFlux_Wm2.value : st.flareMinFlux_Wm2.value),
  };
}

/** A CME's speed: the analysis DONKI marks most accurate, else the first one. */
function cmeSpeed(r: Record<string, unknown>): number | undefined {
  if (!Array.isArray(r.cmeAnalyses)) return undefined;
  const list = r.cmeAnalyses.filter(isObj);
  const a = list.find((x) => x.isMostAccurate === true) ?? list[0];
  return a && typeof a.speed === 'number' && Number.isFinite(a.speed) ? a.speed : undefined;
}

function cmeEvent(r: unknown): Event | undefined {
  if (!isObj(r) || typeof r.activityID !== 'string') return undefined;
  const speed = cmeSpeed(r);
  const st = SPACE_WEATHER.storms;
  if (speed === undefined || speed < st.cmeMinSpeed_kms.value) return undefined;
  const ms = timeMs(r.startTime);
  if (Number.isNaN(ms)) return undefined;
  const strong = speed >= st.strongCmeSpeed_kms.value;
  return {
    id: r.activityID,
    kind: 'cme',
    time: r.startTime as string,
    ms,
    link: linkOf(r, 'CME'),
    linked: linkedIds(r),
    speed_kms: speed,
    tier: strong ? 2 : 1,
    strength: speed / (strong ? st.strongCmeSpeed_kms.value : st.cmeMinSpeed_kms.value),
  };
}

export interface RealStorm {
  /** The storm's DONKI id: the flare's when a flare is in it, else the CME's. */
  id: string;
  kind: 'flare' | 'cme' | 'flare+cme';
  /** DONKI time of the storm (flare peak, or CME start; the earlier of the two when merged). */
  time: string;
  date: string;
  classType?: string;
  speed_kms?: number;
  /** The DONKI record page (the flare's when merged). */
  link: string;
  /** Every DONKI event in the storm, sorted. */
  eventIds: string[];
  /** Where the storm falls in the snapshot's window, 0 (start) to 1 (end). */
  windowFraction: number;
}

/** The snapshot's strong events as storms: linked pairs merged, the strongest `maxStorms` kept, in time order. */
export function realStorms(s: DonkiSnapshot, opts: { maxStorms?: number } = {}): RealStorm[] {
  const events = [...s.flr.records.map(flareEvent), ...s.cme.records.map(cmeEvent)].filter((e): e is Event => !!e);
  const byId = new Map(events.map((e) => [e.id, e]));
  // Group linked qualifying events (DONKI lists links on one or both sides).
  const group = new Map<string, Event[]>();
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) continue;
    const members: Event[] = [];
    const stack = [e];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      members.push(x);
      for (const id of x.linked) {
        const y = byId.get(id);
        if (y && !seen.has(y.id)) stack.push(y);
      }
      for (const y of events) if (!seen.has(y.id) && y.linked.includes(x.id)) stack.push(y);
    }
    group.set(e.id, members);
  }
  const { window: w } = s;
  const start = dayMs(w.startDate);
  const length = dayMs(w.endDate) + DAY_MS - start;
  const storms = [...group.values()].map((m) => {
    const flare = m.filter((x) => x.kind === 'flare').sort((a, b) => b.tier - a.tier || b.strength - a.strength)[0];
    const cme = m.filter((x) => x.kind === 'cme').sort((a, b) => b.tier - a.tier || b.strength - a.strength)[0];
    const first = m.reduce((a, b) => (b.ms < a.ms ? b : a));
    const lead = flare ?? cme!;
    const storm: RealStorm = {
      id: lead.id,
      kind: flare && cme ? 'flare+cme' : flare ? 'flare' : 'cme',
      time: first.time,
      date: new Date(first.ms).toISOString().slice(0, 10),
      ...(flare?.classType ? { classType: flare.classType } : {}),
      ...(cme?.speed_kms !== undefined ? { speed_kms: cme.speed_kms } : {}),
      link: lead.link,
      eventIds: m.map((x) => x.id).sort(),
      windowFraction: Math.min(1 - 1e-9, Math.max(0, (first.ms - start) / length)),
    };
    const tier = Math.max(...m.map((x) => x.tier));
    const strength = Math.max(...m.filter((x) => x.tier === tier).map((x) => x.strength));
    return { storm, tier, strength, ms: first.ms };
  });
  const cap = opts.maxStorms ?? SPACE_WEATHER.storms.maxStorms.value;
  return storms
    .sort((a, b) => b.tier - a.tier || b.strength - a.strength || a.ms - b.ms)
    .slice(0, cap)
    .sort((a, b) => a.ms - b.ms || a.storm.id.localeCompare(b.storm.id))
    .map((x) => x.storm);
}

const fmtNum = (x: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x);

/** The storm's ⓘ: what DONKI recorded, which events, and the link to the record. */
export function stormSourced(storm: RealStorm): Sourced<string> {
  const parts = [
    storm.classType ? `${storm.classType} solar flare` : undefined,
    storm.speed_kms !== undefined ? `a coronal mass ejection at ${fmtNum(storm.speed_kms)} km/s` : undefined,
  ].filter(Boolean);
  return {
    value: `${parts.join(' with ')} on ${storm.time.replace('T', ' ').replace('Z', ' UTC')}`.replace(/^./, (c) => c.toUpperCase()),
    unit: '',
    source: `NASA DONKI (CCMC Space Weather Database Of Notifications, Knowledge, Information): ${storm.eventIds.join(', ')}`,
    url: storm.link,
    isGameEstimate: false,
  };
}

// ---------------------------------------------------------------------------
// Replay across the flight

/**
 * The onset day of a real storm: cruiseStart + f × (primeEndDay − cruiseStart), moved to the start of the next day a
 * solar storm can strike when it lands on one it cannot (launch or the arrival burn).
 */
export function stormOnset(env: OpsEnvironment, storm: RealStorm): number {
  const phases = HAZARDS['solar-storm']!.phases;
  const cruiseStart = Math.max(0, env.days.findIndex((d) => d.phase === 'cruise'));
  const onset = cruiseStart + storm.windowFraction * (env.primeEndDay - cruiseStart);
  const day = env.days[Math.floor(onset)];
  if (day && phases.includes(day.phase)) return onset;
  const next = env.days.find((d) => d.day > Math.floor(onset) && phases.includes(d.phase));
  return next ? next.day : onset;
}

/**
 * The solar-storm stream of a live Daily: one candidate per real storm, judged when Earth is warned (onset − lead),
 * always accepted (uAccept 0: it happened), each with its own outcome draw from the solar-storm stream.
 */
export function stormCandidates(env: OpsEnvironment, storms: RealStorm[], rng: () => number): Candidate[] {
  const lead = HAZARDS['solar-storm']!.warningLead_days.value;
  return storms
    .map((storm) => ({ storm, onset: stormOnset(env, storm) }))
    .sort((a, b) => a.onset - b.onset)
    .map(({ storm, onset }) => ({ t: Math.max(0, onset - lead), uAccept: 0, uOutcome: rng(), real: storm }));
}
