// Science Targets and Downlink view models (spec: UI rules 39–40, 46). What the Fly & Survive screen shows after
// arrival at Mars or on Moon 3: one card per target with its costs from the observation plan, the order's travel
// time, and the pictures on their way down. Pure functions of the state; the UI formats only.
import { SCIENCE_RULES } from '../science';
import { MARS_MOONS, type Target, type TargetBody } from '../targets';
import { gameEstimate, type Sourced } from '../types';
import { inMoratorium, oneWayAt } from './commands';
import { segmentsFromFraction } from './fly';
import { countsForScience, hasTargets, imageOf, OBSERVE_RULES, observationFor, onFarSide, scienceOrbitOf, scienceReturned, targetScience, targetsOf } from './observe';
import { defaultBooking, downlinkCapacity_bitsPerDay } from './resources';
import { deltaVLeft_ms, deltaVStillNeeded_ms } from './timeline';
import type { DsnBooking, ImageRecord, OpsState } from './types';

/** Display game rules of the Science Targets panel (registered in the data audit). */
export const SCIENCE_VIEW_RULES = {
  sharpBelow_m: gameEstimate(10, 'm per pixel', 'Game rule (Science Targets): a picture at 10 m per pixel or finer reads SHARP (three bars)'),
  goodBelow_m: gameEstimate(60, 'm per pixel', 'Game rule (Science Targets): finer than 60 m per pixel reads GOOD (two bars); coarser reads FAIR'),
  riskMedium: gameEstimate(0.02, 'probability', 'Game rule (Science Targets): a drag-heating chance of 2% or more during the observation reads MEDIUM risk'),
  riskHigh: gameEstimate(0.1, 'probability', 'Game rule (Science Targets): 10% or more reads HIGH risk'),
} satisfies Record<string, Sourced<number>>;

export type TargetState = 'ready' | 'ordered' | 'observing' | 'on-board' | 'sent' | 'home' | 'refused';
export type TargetBlocker = 'ordered' | 'fuel' | 'unreachable' | 'blackout' | 'not-flying';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface TargetCard {
  id: string;
  /** 1–6, the order on the design's cards and globe. */
  ordinal: number;
  kind: Target['kind'];
  /** Surface targets: where the marker sits (deg); moons: their orbit radius (m). */
  lat_deg?: number;
  lon_deg?: number;
  moonOrbit_m?: number;
  /** Image quality bars, 1–3, from the resolution the picture needs. */
  quality: 1 | 2 | 3;
  resolution_m: number;
  image_bits: number;
  dust: boolean;
  /** Costs from the observation plan: Δv (m/s) and camera energy (Wh), and how long the observation lasts. */
  dv_ms: number;
  energy_Wh: number;
  days: number;
  /** The same costs on the five-segment tiles: fuel against the Δv to spare, energy against the battery. */
  fuelSegments: number;
  powerSegments: number;
  /** The orbit flown while observing (altitudes, m): a dip lowers the periapsis, a moon raises the apoapsis. */
  pass: { periapsis_m: number; apoapsis_m: number };
  /** The pass flies lower than the orbit now (the globe draws the ring dipping to it). */
  dips: boolean;
  /** The pass moves the apoapsis to a moon's orbit and back (the globe draws the orbit-change path). */
  moonTransfer: boolean;
  /** ρ at the observing periapsis ÷ MAVEN's nominal ρ (0: no low pass): what scales the drag-heating hazard. */
  dragFactor: number;
  /** Chance of a drag-heating hazard during the observation, and its level. */
  risk: number;
  riskLevel: RiskLevel;
  state: TargetState;
  /** Why OBSERVE cannot be sent for this target now (none: it can). */
  blocker?: TargetBlocker;
  /** Science weight, 0–1. */
  weight: number;
  /** Moon: the craft over this target is hidden from Earth, so the robot observes it alone (spec: Moon orbit). */
  farSide: boolean;
}

export interface ScienceTargetsView {
  /** The craft is in orbit with targets (Mars, Moon 3) and flying: the panel can open. */
  available: boolean;
  /** Which globe: Mars, or the Moon (spec: UI rule 44). */
  body: TargetBody;
  /** The science orbit now: periapsis and apoapsis altitudes (m) and inclination (deg). */
  orbit: { periapsis_m: number; apoapsis_m: number; inclination_deg: number };
  cards: TargetCard[];
  /** Seconds an order sent now takes to reach the craft (one-way light time). */
  orderTakes_s: number;
  /** Targets ordered so far (not refused). */
  ordered: number;
  /** Science returned so far, 0–1. */
  science: number;
}

function stateOf(s: OpsState, id: string): TargetState {
  const im = imageOf(s, id);
  if (im) {
    if (im.status === 'sent') return im.homeAt !== undefined && im.homeAt <= s.t + 1e-12 ? 'home' : 'sent';
    return im.status === 'observing' ? 'observing' : 'on-board';
  }
  const inFlight = s.commands.some((c) => c.status === 'in-flight' && c.command.kind === 'observe' && c.command.targetId === id);
  if (inFlight) return 'ordered';
  return s.images.some((x) => x.targetId === id && x.status === 'refused') ? 'refused' : 'ready';
}

const quality = (res_m: number): 1 | 2 | 3 => (res_m <= SCIENCE_VIEW_RULES.sharpBelow_m.value ? 3 : res_m < SCIENCE_VIEW_RULES.goodBelow_m.value ? 2 : 1);

/** The Science Targets panel (spec: UI rule 39). */
export function scienceTargetsView(s: OpsState): ScienceTargetsView {
  const env = s.env;
  const phase = env.days[Math.min(Math.floor(s.t), env.horizonDay)]?.phase;
  const available = hasTargets(env) && s.status === 'flying' && (phase === 'science' || phase === 'extended');
  const spare = Math.max(0, deltaVLeft_ms(s) - deltaVStillNeeded_ms(s));
  const blackout = inMoratorium(env, s.t);
  const o = scienceOrbitOf(env);
  const orbit = { periapsis_m: o.periapsis_km * 1000, apoapsis_m: o.apoapsis_km * 1000, inclination_deg: o.inclination_deg };
  const cards = targetsOf(env).map((t, i): TargetCard => {
    const plan = observationFor(s, t);
    const state = stateOf(s, t.id);
    const expected = OBSERVE_RULES.dragHeatingRate_perDay.value * plan.dragFactor * plan.days;
    const risk = 1 - Math.exp(-expected);
    const riskLevel: RiskLevel = plan.dragFactor === 0 ? 'none' : risk >= SCIENCE_VIEW_RULES.riskHigh.value ? 'high' : risk >= SCIENCE_VIEW_RULES.riskMedium.value ? 'medium' : 'low';
    const blocker: TargetBlocker | undefined =
      state !== 'ready' && state !== 'refused'
        ? 'ordered'
        : !available
          ? 'not-flying'
          : blackout
            ? 'blackout'
            : !plan.reachable
              ? 'unreachable'
              : plan.dv_ms > spare
                ? 'fuel'
                : undefined;
    return {
      id: t.id,
      ordinal: i + 1,
      kind: t.kind,
      ...(t.lat_deg ? { lat_deg: t.lat_deg.value } : {}),
      ...(t.lon_deg ? { lon_deg: t.lon_deg.value } : {}),
      ...(t.moon ? { moonOrbit_m: MARS_MOONS[t.moon].a_km.value * 1000 } : {}),
      quality: quality(t.resolution_m.value),
      resolution_m: t.resolution_m.value,
      image_bits: plan.image_bits,
      dust: t.dust,
      dv_ms: plan.dv_ms,
      energy_Wh: plan.energy_Wh,
      pass: { periapsis_m: plan.obsAlt_m, apoapsis_m: plan.obsApo_m },
      dips: plan.obsAlt_m < orbit.periapsis_m - 1e-6,
      moonTransfer: t.kind === 'moon',
      dragFactor: plan.dragFactor,
      days: plan.days,
      fuelSegments: plan.dv_ms > 0 ? segmentsFromFraction(plan.dv_ms / Math.max(spare, 1e-9)) : 0,
      powerSegments: segmentsFromFraction(plan.energy_Wh / Math.max(env.battery_Wh, 1e-9)),
      risk,
      riskLevel,
      state,
      ...(blocker ? { blocker } : {}),
      weight: t.weight.value,
      farSide: onFarSide(env, t),
    };
  });
  return {
    available,
    body: env.design.destination === 'moon' ? 'moon' : 'mars',
    orbit,
    cards,
    orderTakes_s: oneWayAt(env, s.t),
    ordered: s.images.filter((im) => im.status !== 'refused').length + s.commands.filter((c) => c.status === 'in-flight' && c.command.kind === 'observe').length,
    science: scienceReturned(s),
  };
}

// ---------------------------------------------------------------------------
// Downlink

const bookingOn = (s: OpsState, day: number): DsnBooking => s.dsn[day] ?? defaultBooking(s.env.design);

/** The next DSN pass that can carry pictures (now, if one is open): opening and closing time (days) and the dish. */
export function nextPass(s: OpsState, from = s.t): { open: number; close: number; dish: 34 | 70; rate_bps: number } | undefined {
  const env = s.env;
  for (let day = Math.max(0, Math.floor(from)); day <= env.horizonDay; day++) {
    const e = env.days[day]!;
    const b = bookingOn(s, day);
    const rate = b.hours > 0 ? downlinkCapacity_bitsPerDay(e, b) / (b.hours * 3600) : 0;
    if (!(rate > 0)) continue;
    const open = day + SCIENCE_RULES.passStart_h.value / 24;
    const close = open + b.hours / 24;
    if (close <= from + 1e-12) continue;
    return { open, close, dish: b.dish, rate_bps: rate };
  }
  return undefined;
}

export type DownlinkRowState = 'ordered' | 'observing' | 'waiting' | 'coming-down' | 'on-its-way' | 'home';

export interface DownlinkRow {
  targetId: string;
  state: DownlinkRowState;
  /** Share of the picture's bits already sent, 0–1. */
  sent: number;
  bits: number;
  /** Seconds until it reaches Earth (on its way). */
  homeIn_s?: number;
}

export interface DownlinkView {
  rows: DownlinkRow[];
  /** Pictures not yet home. */
  waiting: number;
  home: number;
  /** The next pass: seconds until it opens (0 while open), until it closes, the dish. */
  pass?: { openIn_s: number; closesIn_s: number; open: boolean; dish: 34 | 70; rate_bps: number; openAt: number };
  /** The picture to print: the last one home (its arrival time, days). */
  latestHome?: { targetId: string; homeAt: number; sentAt: number };
  /** One-way light time now (s): how old the print is when it starts. */
  oneWay_s: number;
}

function rowOf(s: OpsState, im: ImageRecord): DownlinkRow {
  const base = { targetId: im.targetId, sent: im.bits > 0 ? im.sentBits / im.bits : 0, bits: im.bits };
  if (im.status === 'observing') return { ...base, state: 'observing' };
  if (im.status === 'on-board') return { ...base, state: im.sentBits > 0 ? 'coming-down' : 'waiting' };
  if (im.homeAt !== undefined && im.homeAt <= s.t + 1e-12) return { ...base, state: 'home' };
  return { ...base, state: 'on-its-way', homeIn_s: Math.max(0, ((im.homeAt ?? s.t) - s.t) * 86_400) };
}

/** The Downlink drawer (spec: UI rule 40). */
export function downlinkView(s: OpsState): DownlinkView {
  const imgs = s.images.filter((im) => im.status !== 'refused');
  // Orders still crossing space come first in the queue: the robot has not heard them yet.
  const ordered = s.commands
    .filter((c) => c.status === 'in-flight' && c.command.kind === 'observe')
    .map((c): DownlinkRow => ({ targetId: c.command.kind === 'observe' ? c.command.targetId : '', state: 'ordered', sent: 0, bits: 0 }));
  const rows = [...imgs.map((im) => rowOf(s, im)), ...ordered];
  const p = nextPass(s);
  const homes = imgs.filter((im) => im.homeAt !== undefined && im.homeAt <= s.t + 1e-12).sort((a, b) => a.homeAt! - b.homeAt!);
  const last = homes[homes.length - 1];
  return {
    rows,
    waiting: rows.filter((r) => r.state !== 'home').length,
    home: rows.filter((r) => r.state === 'home').length,
    ...(p
      ? { pass: { openIn_s: Math.max(0, (p.open - s.t) * 86_400), closesIn_s: Math.max(0, (p.close - s.t) * 86_400), open: s.t >= p.open - 1e-12, dish: p.dish, rate_bps: p.rate_bps, openAt: p.open } }
      : {}),
    ...(last ? { latestHome: { targetId: last.targetId, homeAt: last.homeAt!, sentAt: last.sentAt! } } : {}),
    oneWay_s: oneWayAt(s.env, s.t),
  };
}

/** The next moment a picture changes state: taken, its pass opening while one waits, or reaching Earth. */
export function nextImageT(s: OpsState): number | undefined {
  let next: number | undefined;
  const after = (x: number | undefined) => {
    if (x !== undefined && x > s.t + 1e-9 && (next === undefined || x < next)) next = x;
  };
  for (const im of s.images) {
    if (im.status === 'observing') after(im.takenAt);
    if (im.status === 'sent') after(im.homeAt);
  }
  if (s.images.some((im) => im.status === 'on-board')) after(nextPass(s)?.open);
  return next;
}

export { countsForScience };

// ---------------------------------------------------------------------------
// Mission Album (spec: UI rule 43): the report opens with one frame per target.

export type AlbumEnding = 'complete' | 'lost' | 'extended';
/** Why a frame is empty. */
export type AlbumWhy = 'never-ordered' | 'order-lost' | 'refused-fuel' | 'refused-unreachable' | 'refused' | 'never-taken' | 'never-sent' | 'still-possible';

export interface AlbumFrame {
  targetId: string;
  /** Share of the mission science (0–1). */
  weight: number;
  status: 'home' | 'partial' | 'missing';
  /** Partial: share of the bits that made it home (0–1). */
  sent?: number;
  why?: AlbumWhy;
  /** The day the picture was taken (never sent) or sent (home). */
  day?: number;
}

export interface MissionAlbum {
  ending: AlbumEnding;
  frames: AlbumFrame[];
  /** Targets home, and how many there are. */
  returned: number;
  total: number;
  /** Science returned, 0–1 (the main score, spec: Scoring). */
  science: number;
  /** The day of the loss (lost) or of the last prime-mission day. */
  day: number;
}

/** The album, at Mars only (undefined elsewhere: no targets). */
export function missionAlbum(s: OpsState): MissionAlbum | undefined {
  if (!hasTargets(s.env)) return undefined;
  const ending: AlbumEnding = s.status === 'lost' ? 'lost' : s.extension ? 'extended' : 'complete';
  const day = ending === 'lost' ? Math.floor(s.failureT ?? s.t) : s.env.primeEndDay + 1;
  const ts = targetScience(s);
  const targets = targetsOf(s.env);
  const frames = targets.map((t): AlbumFrame => {
    const base = { targetId: t.id, weight: t.weight.value };
    const im = imageOf(s, t.id);
    if (im && countsForScience(s, im)) return { ...base, status: 'home', day: Math.floor(im.sentAt!) };
    const part = ts.partial.find((p) => p.targetId === t.id);
    if (part) return { ...base, status: 'partial', sent: part.fraction };
    const missing = (why: AlbumWhy, d?: number): AlbumFrame => ({ ...base, status: 'missing', why: ending === 'extended' && why === 'never-ordered' ? 'still-possible' : why, ...(d !== undefined ? { day: d } : {}) });
    if (im) return im.status === 'observing' ? missing('never-taken') : missing('never-sent', Math.floor(im.takenAt));
    if (s.commands.some((c) => c.command.kind === 'observe' && c.command.targetId === t.id && c.status === 'in-flight')) return missing('order-lost');
    const refused = s.images.find((x) => x.targetId === t.id && x.status === 'refused');
    if (refused) return missing(refused.reason === 'fuel' ? 'refused-fuel' : refused.reason === 'unreachable' ? 'refused-unreachable' : 'refused');
    return missing('never-ordered');
  });
  return { ending, frames, returned: ts.home.length, total: targets.length, science: ts.fraction, day };
}
