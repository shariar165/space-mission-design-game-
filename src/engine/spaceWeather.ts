// The Daily's real Sun (spec UI rule 37). The DONKI GitHub Action saves NASA DONKI solar flares (FLR), CMEs and solar
// energetic particle events (SEP) from the last 7 days as public/data/donki-latest.json; this module turns that
// snapshot into dangers:
//   - an SEP is a solar radiation storm (the 'solar-storm' hazard, whose seeded rate is NOAA's S3/S4 count);
//   - a CME is a danger only when NASA's WSA-ENLIL model predicts it reaches Mars: a 'cme-shock' that arrives at the
//     predicted time, its severity set by ENLIL's glancing-blow / minor-impact flags;
//   - a flare is never a danger by itself: it is named on the card of the SEP or CME DONKI links it to.
// The real week is replayed across the flight: an event a fraction f into the week happens the same fraction of the
// way from the start of cruise to the end of the prime mission; a CME's shock then arrives after its real transit.
// Pure: the UI does the fetching.
import spaceWeatherJson from '../data/spaceWeather.json';
import { HAZARDS } from './data';
import type { Candidate, OpsEnvironment } from './ops/types';
import type { DestinationId, Sourced } from './types';

type S = Sourced<number>;
export const SPACE_WEATHER = spaceWeatherJson as unknown as {
  donki: { apiBase: Sourced<string>; viewerBase: Sourced<string>; windowDays: S; maxAge_days: S; loadTimeout_ms: S };
  storms: {
    enlilLocation: Sourced<Partial<Record<DestinationId, string>>>;
    trackedLocations: Sourced<string[]>;
    glancingFactor: S;
    minorFactor: S;
    maxStorms: S;
  };
};

// ---------------------------------------------------------------------------
// The snapshot (scripts/fetch-donki.mjs writes it)

interface RecordList {
  url: string;
  records: unknown[];
}
export interface DonkiSnapshot {
  fetchedAt: string;
  source: { base: string; announcement: string };
  window: { startDate: string; endDate: string };
  flr: RecordList;
  cme: RecordList;
  /** Absent in snapshots saved before SEP was fetched (read as no events). */
  sep: RecordList;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isDay = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T00:00:00Z`));
const isList = (x: unknown): x is RecordList => isObj(x) && typeof x.url === 'string' && Array.isArray(x.records);

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
  if (json.sep !== undefined && !isList(json.sep)) return undefined;
  return { ...(json as unknown as DonkiSnapshot), sep: isList(json.sep) ? json.sep : { url: '', records: [] } };
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
// Records → dangers

/** A predicted CME arrival at one location, from a WSA-ENLIL run. */
export interface EnlilImpact {
  location: string;
  /** DONKI time, "2024-05-13T23:50Z". */
  arrivalTime: string;
  isGlancingBlow: boolean;
  isMinorImpact: boolean;
}

export interface RealStorm {
  /** The DONKI id of the SEP or CME. */
  id: string;
  kind: 'sep' | 'cme';
  /** The hazard it becomes: SEP → solar radiation storm, CME with a Mars impact → CME shock. */
  hazard: 'solar-storm' | 'cme-shock';
  /** SEP event time or CME start time (DONKI). */
  time: string;
  date: string;
  /** Class of the flare DONKI links to it (the strongest), if any: context only. */
  flare?: string;
  /** CME speed from its most-accurate analysis (km/s). */
  speed_kms?: number;
  /** SEP: the instruments that saw it. */
  instruments?: string[];
  /** CME: the predicted arrival at the flown destination (NASA WSA-ENLIL model prediction, not an observation). */
  arrival?: {
    location: string;
    time: string;
    /** Eruption to arrival (days); the card's warning time. */
    transit_days: number;
    isGlancingBlow: boolean;
    isMinorImpact: boolean;
    /** The ENLIL run: when it finished, and its CCMC page. */
    modelCompletionTime: string;
    link: string;
  };
  /** CME: every tracked location the same ENLIL run predicts an impact at (for future levels). */
  impacts: EnlilImpact[];
  /** × every response's failure chance: 1 for SEPs and direct hits, glancing / minor factors (game estimates). */
  severity: number;
  /** The DONKI record page of the SEP or CME. */
  link: string;
  /** The SEP or CME and its linked flare, sorted. */
  eventIds: string[];
  /** Where the event falls in the snapshot's window, 0 (start) to 1 (end). */
  windowFraction: number;
}

/** DONKI times are "2024-05-10T06:54Z" (UTC, minutes). */
const timeMs = (t: unknown) => (typeof t === 'string' ? Date.parse(t) : NaN);
const str = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined);

const linkedIds = (r: Record<string, unknown>) =>
  Array.isArray(r.linkedEvents) ? r.linkedEvents.filter(isObj).map((e) => e.activityID).filter((x): x is string => typeof x === 'string') : [];

const linkOf = (r: Record<string, unknown>, type: 'FLR' | 'CME' | 'SEP') => {
  const l = str(r.link);
  return l && l.startsWith('http') ? l : `${SPACE_WEATHER.donki.viewerBase.value}${type}/`;
};

/** NOAA flare classes are a log scale (A < B < C < M < X, ×10 each): rank a class for "the strongest". */
const flareRank = (c: string) => {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)$/.exec(c.trim());
  return m ? 'ABCMX'.indexOf(m[1]!) * 1000 + Number(m[2]) : -1;
};

interface Flare {
  id: string;
  classType: string;
  linked: string[];
}

function flares(s: DonkiSnapshot): Flare[] {
  return s.flr.records
    .filter(isObj)
    .map((r) => ({ id: str(r.flrID), classType: str(r.classType), linked: linkedIds(r) }))
    .filter((f): f is Flare => !!f.id && !!f.classType);
}

/** The strongest flare DONKI links to an event, from either side of the link. */
function linkedFlare(all: Flare[], id: string, linked: string[]): Flare | undefined {
  return all.filter((f) => linked.includes(f.id) || f.linked.includes(id)).sort((a, b) => flareRank(b.classType) - flareRank(a.classType))[0];
}

/** The most-accurate analysis (else the first), as DONKI marks it. */
function bestAnalysis(r: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!Array.isArray(r.cmeAnalyses)) return undefined;
  const list = r.cmeAnalyses.filter(isObj);
  return list.find((x) => x.isMostAccurate === true) ?? list[0];
}

const impactOf = (x: Record<string, unknown>): EnlilImpact | undefined => {
  const location = str(x.location);
  const arrivalTime = str(x.arrivalTime);
  if (!location || !arrivalTime || Number.isNaN(timeMs(arrivalTime))) return undefined;
  return { location, arrivalTime, isGlancingBlow: x.isGlancingBlow === true, isMinorImpact: x.isMinorImpact === true };
};

/** The latest ENLIL run (by model completion) of an analysis that predicts an impact at `location`. */
function latestRunAt(a: Record<string, unknown>, location: string) {
  const runs = (Array.isArray(a.enlilList) ? a.enlilList.filter(isObj) : [])
    .map((e) => ({
      done: str(e.modelCompletionTime) ?? '',
      link: str(e.link) ?? '',
      impacts: (Array.isArray(e.impactList) ? e.impactList.filter(isObj) : []).map(impactOf).filter((x): x is EnlilImpact => !!x),
    }))
    .filter((e) => e.impacts.some((i) => i.location === location));
  return runs.sort((a, b) => timeMs(b.done) - timeMs(a.done) || b.done.localeCompare(a.done))[0];
}

const severityOf = (i: { isGlancingBlow: boolean; isMinorImpact: boolean }) => {
  const st = SPACE_WEATHER.storms;
  return Math.min(1, i.isGlancingBlow ? st.glancingFactor.value : 1, i.isMinorImpact ? st.minorFactor.value : 1);
};

/**
 * The snapshot's dangers at a destination: every SEP, and every CME whose most-accurate analysis has a WSA-ENLIL run
 * predicting an impact there (the latest such run counts). The `maxStorms` most severe are kept (ties: earlier
 * first), in time order.
 */
export function realStorms(s: DonkiSnapshot, opts: { maxStorms?: number; destination?: DestinationId } = {}): RealStorm[] {
  const location = SPACE_WEATHER.storms.enlilLocation.value[opts.destination ?? 'mars'];
  if (!location) return [];
  const tracked = SPACE_WEATHER.storms.trackedLocations.value;
  const { window: w } = s;
  const start = dayMs(w.startDate);
  const length = dayMs(w.endDate) + DAY_MS - start;
  const fraction = (ms: number) => Math.min(1 - 1e-9, Math.max(0, (ms - start) / length));
  const all = flares(s);
  const out: { storm: RealStorm; ms: number }[] = [];

  for (const r of s.sep.records.filter(isObj)) {
    const id = str(r.sepID);
    const time = str(r.eventTime);
    const ms = timeMs(time);
    if (!id || !time || Number.isNaN(ms)) continue;
    const flare = linkedFlare(all, id, linkedIds(r));
    const instruments = Array.isArray(r.instruments) ? r.instruments.filter(isObj).map((x) => str(x.displayName)).filter((x): x is string => !!x) : [];
    out.push({
      ms,
      storm: {
        id,
        kind: 'sep',
        hazard: 'solar-storm',
        time,
        date: new Date(ms).toISOString().slice(0, 10),
        ...(flare ? { flare: flare.classType } : {}),
        ...(instruments.length ? { instruments } : {}),
        impacts: [],
        severity: 1,
        link: linkOf(r, 'SEP'),
        eventIds: [id, ...(flare ? [flare.id] : [])].sort(),
        windowFraction: fraction(ms),
      },
    });
  }

  for (const r of s.cme.records.filter(isObj)) {
    const id = str(r.activityID);
    const time = str(r.startTime);
    const ms = timeMs(time);
    const a = bestAnalysis(r);
    if (!id || !time || Number.isNaN(ms) || !a) continue;
    const run = latestRunAt(a, location);
    if (!run) continue;
    const hit = run.impacts.filter((i) => i.location === location).sort((x, y) => timeMs(x.arrivalTime) - timeMs(y.arrivalTime))[0]!;
    const transit_days = (timeMs(hit.arrivalTime) - ms) / DAY_MS;
    if (!(transit_days > 0)) continue;
    const flare = linkedFlare(all, id, linkedIds(r));
    out.push({
      ms,
      storm: {
        id,
        kind: 'cme',
        hazard: 'cme-shock',
        time,
        date: new Date(ms).toISOString().slice(0, 10),
        ...(flare ? { flare: flare.classType } : {}),
        ...(typeof a.speed === 'number' && Number.isFinite(a.speed) ? { speed_kms: a.speed } : {}),
        arrival: {
          location,
          time: hit.arrivalTime,
          transit_days,
          isGlancingBlow: hit.isGlancingBlow,
          isMinorImpact: hit.isMinorImpact,
          modelCompletionTime: run.done,
          link: run.link,
        },
        impacts: run.impacts.filter((i) => tracked.includes(i.location)),
        severity: severityOf(hit),
        link: linkOf(r, 'CME'),
        eventIds: [id, ...(flare ? [flare.id] : [])].sort(),
        windowFraction: fraction(ms),
      },
    });
  }

  const cap = opts.maxStorms ?? SPACE_WEATHER.storms.maxStorms.value;
  return out
    .sort((a, b) => b.storm.severity - a.storm.severity || a.ms - b.ms || a.storm.id.localeCompare(b.storm.id))
    .slice(0, cap)
    .sort((a, b) => a.ms - b.ms || a.storm.id.localeCompare(b.storm.id))
    .map((x) => x.storm);
}

const fmtNum = (x: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x);
const utc = (t: string) => t.replace('T', ' ').replace('Z', ' UTC');
const sevWord = (s: RealStorm) =>
  !s.arrival ? '' : s.arrival.isMinorImpact ? 'minor impact' : s.arrival.isGlancingBlow ? 'glancing blow' : 'direct hit';

/** The storm's ⓘ: what DONKI observed (the SEP or CME, and the flare it came from), linked to the DONKI record. */
export function stormSourced(storm: RealStorm): Sourced<string> {
  const what =
    storm.kind === 'sep'
      ? `Solar energetic particle event on ${utc(storm.time)}${storm.instruments?.length ? `, seen by ${storm.instruments.join(', ')}` : ''}`
      : `Coronal mass ejection${storm.speed_kms !== undefined ? ` at ${fmtNum(storm.speed_kms)} km/s` : ''} on ${utc(storm.time)}`;
  return {
    value: `${what}${storm.flare ? `, from a ${storm.flare} solar flare` : ''}`,
    unit: '',
    source: `NASA DONKI (CCMC Space Weather Database Of Notifications, Knowledge, Information), observed: ${storm.eventIds.join(', ')}`,
    url: storm.link,
    isGameEstimate: false,
  };
}

/** A CME's ⓘ for the arrival time: NASA's WSA-ENLIL model prediction, labelled as a prediction. SEPs have none. */
export function predictionSourced(storm: RealStorm): Sourced<string> | undefined {
  const a = storm.arrival;
  if (!a) return undefined;
  return {
    value: `Shock reaches ${a.location} ${utc(a.time)} (${sevWord(storm)})`,
    unit: '',
    source: `NASA WSA-ENLIL model prediction (CCMC), run completed ${utc(a.modelCompletionTime)}, for DONKI CME ${storm.id}. A model forecast, not an observation`,
    ...(a.link ? { url: a.link } : {}),
    isGameEstimate: false,
  };
}

// ---------------------------------------------------------------------------
// Replay across the flight

const firstAllowedFrom = (env: OpsEnvironment, t: number, phases: readonly string[]) => {
  const day = env.days[Math.floor(t)];
  if (day && phases.includes(day.phase)) return t;
  const next = env.days.find((d) => d.day > Math.floor(t) && phases.includes(d.phase));
  return next ? next.day : t;
};

/** When Earth learns of the event: cruiseStart + f × (primeEndDay − cruiseStart). */
const replayed = (env: OpsEnvironment, storm: RealStorm) => {
  const cruiseStart = Math.max(0, env.days.findIndex((d) => d.phase === 'cruise'));
  return cruiseStart + storm.windowFraction * (env.primeEndDay - cruiseStart);
};

/**
 * The day a real danger strikes the craft. An SEP strikes at its replayed time; a CME's shock strikes its real ENLIL
 * transit after its replayed eruption. Either is moved to the start of the next day the hazard can strike when it
 * lands on one it cannot (launch or the arrival burn); a CME's warning moves with it.
 */
export function stormOnset(env: OpsEnvironment, storm: RealStorm): number {
  const phases = HAZARDS[storm.hazard]!.phases;
  return firstAllowedFrom(env, replayed(env, storm) + (storm.arrival?.transit_days ?? 0), phases);
}

/** When Earth is warned: an SEP warningLead_days before onset (game estimate); a CME at eruption (its real transit before). */
const warnedAt = (env: OpsEnvironment, storm: RealStorm, onset: number) =>
  Math.max(0, onset - (storm.arrival?.transit_days ?? HAZARDS[storm.hazard]!.warningLead_days.value));

/**
 * The live Daily's candidate streams, by hazard: one candidate per real danger, judged when Earth is warned, always
 * accepted (uAccept 0: it happened), each with an outcome draw from that hazard's stream, in time order.
 */
export function stormCandidates(env: OpsEnvironment, storms: RealStorm[], rng: (hazard: RealStorm['hazard']) => number): Record<RealStorm['hazard'], Candidate[]> {
  const out: Record<RealStorm['hazard'], Candidate[]> = { 'solar-storm': [], 'cme-shock': [] };
  const timed = storms.map((storm) => ({ storm, onset: stormOnset(env, storm) })).sort((a, b) => a.onset - b.onset || a.storm.id.localeCompare(b.storm.id));
  for (const { storm, onset } of timed) out[storm.hazard].push({ t: warnedAt(env, storm, onset), uAccept: 0, uOutcome: rng(storm.hazard), real: storm });
  // The clock walks each stream by warning time (a long CME transit can be warned before an earlier strike).
  for (const list of Object.values(out)) list.sort((a, b) => a.t - b.t);
  return out;
}
