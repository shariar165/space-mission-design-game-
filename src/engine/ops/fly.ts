// Fly & Survive view model (Signal Delay design, spec "UI rules"). What the flight screen shows beyond the
// Operations Console view: five-segment resource tiles, the Systems health, the danger card's relative times and
// cost chips, the Coming Up ribbon and the eclipse planning card. Pure functions of the state; the UI formats only.
import { scienceGoal_Gbit } from '../scoring';
import { OPERATIONS } from '../data';
import { gameEstimate, type MeterStatus, type Sourced } from '../types';
import { consoleView, powerPlanPreview, type AlertOption, type OpsConsoleView, type PowerPlanPreview } from './console';
import type { EclipseSeason, OpsState, PowerPlan } from './types';

/** Display game rules of the Fly & Survive screen (registered in the data audit). */
export const FLY_RULES = {
  gaugeSegments: gameEstimate(5, 'segments', 'Game rule (Fly & Survive): each resource tile shows five segments'),
  powerFullMargin: gameEstimate(0.3, 'fraction', 'Game rule (Fly & Survive): the power tile is full at a 30% margin, the top of the scoring band (Scoring: 10–30%)'),
  comingUpWindow_days: gameEstimate(150, 'days', 'Game rule (Fly & Survive): the Coming Up ribbon shows the next 150 days (about five months)'),
  monthTick_days: gameEstimate(30, 'days', 'Game rule (Fly & Survive): one ribbon tick per 30 days, read as "1 month"'),
  systemsPenalty: gameEstimate(
    1,
    'segments',
    'Game rule (Fly & Survive): the Systems tile loses one segment per reaction wheel lost, instrument lost, safe mode now, brownout streak and degraded pointing',
  ),
  minimumChip: gameEstimate(1, 'segments', 'Game rule (Fly & Survive): a cost on a choice always shows at least one segment, so no cost reads as free'),
  eclipseCardLead_days: gameEstimate(3, 'days', 'Game rule (Fly & Survive): the eclipse planning card opens this many days before a season'),
  savePowerHeaters: gameEstimate(0.5, 'fraction of heater need', 'Game rule (Fly & Survive): "Save power" runs the heaters at half their need through an eclipse season'),
} satisfies Record<string, Sourced<unknown>>;

const DAY_S = 86_400;
const SEG = () => FLY_RULES.gaugeSegments.value;
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : x > 0 ? 1 : 0);

/** Segments for a margin: full at the top of the scoring band, empty only when the margin is negative. */
export function segmentsFromMargin(margin: number): number {
  if (!(margin >= 0)) return 0;
  return Math.max(1, Math.round(SEG() * Math.min(1, margin / FLY_RULES.powerFullMargin.value)));
}

/** Segments for a fill fraction: empty only when nothing is left. */
export function segmentsFromFraction(f: number): number {
  const x = clamp01(f);
  if (x <= 0) return 0;
  return Math.max(1, Math.round(SEG() * x));
}

// ---------------------------------------------------------------------------
// Tiles

export interface FlyTile {
  segments: number;
  status: MeterStatus;
  /** One segment or none (the data tile is never an alarm: it starts empty). */
  low: boolean;
}

export interface SystemsHealth {
  health: number;
  wheelsLost: number;
  instrumentsLost: number;
  safeMode: boolean;
  brownout: boolean;
  degraded: boolean;
}

export interface FlyTiles {
  power: FlyTile & { margin: number; available_W: number; required_W: number };
  fuel: FlyTile & { propellantLeft_kg: number; deltaVLeft_ms: number };
  data: FlyTile & { sent_Gbit: number; goal_Gbit: number };
  systems: FlyTile & SystemsHealth;
}

function safeModeNow(s: OpsState): boolean {
  if (!(s.t < s.pausedUntil)) return false;
  const safe = [...s.events].reverse().find((e) => e.code === 'safe-mode');
  return safe !== undefined && Number(safe.values.until) >= s.pausedUntil - 1e-9;
}

/** The craft's health out of five: what has broken or is struggling right now (game rule). */
export function systemsHealth(s: OpsState): SystemsHealth {
  const wheelsLost = Math.max(0, OPERATIONS.reactionWheels.installed.value - s.wheelsWorking);
  const instrumentsLost = s.instrumentsLost.length;
  const safeMode = safeModeNow(s);
  const brownout = s.brownoutStreak > 0;
  const degraded = s.attitude === 'degraded';
  const penalty = FLY_RULES.systemsPenalty.value * (wheelsLost + instrumentsLost + (safeMode ? 1 : 0) + (brownout ? 1 : 0) + (degraded ? 1 : 0));
  const health = s.status === 'lost' ? 0 : Math.max(0, Math.min(SEG(), SEG() - penalty));
  return { health, wheelsLost, instrumentsLost, safeMode, brownout, degraded };
}

const tileStatus = (segments: number): MeterStatus => (segments === 0 ? 'over' : segments <= 1 ? 'warning' : 'ok');

function goalGbit(s: OpsState): number {
  const sci = s.env.timeline.find((w) => w.phase === 'science')!;
  return scienceGoal_Gbit(
    s.env.loads.instruments.reduce((a, i) => a + i.data_bitsPerDay, 0),
    sci.endDay - sci.startDay + 1,
  );
}

export function flyTiles(s: OpsState, v: OpsConsoleView = consoleView(s)): FlyTiles {
  const g = v.gauges;
  const power = segmentsFromMargin(g.power.margin);
  const fuel = segmentsFromFraction(g.fuel.fill);
  const sent = s.downlinkedPrime_bits / 1e9;
  const goal = goalGbit(s);
  const data = segmentsFromFraction(goal > 0 ? sent / goal : 0);
  const h = systemsHealth(s);
  return {
    power: { segments: power, status: g.power.status, low: power <= 1, margin: g.power.margin, available_W: g.power.limit, required_W: g.power.used },
    fuel: { segments: fuel, status: g.fuel.status, low: fuel <= 1, propellantLeft_kg: g.fuel.propellantLeft_kg, deltaVLeft_ms: g.fuel.limit },
    data: { segments: data, status: 'ok', low: false, sent_Gbit: sent, goal_Gbit: goal },
    systems: { segments: h.health, status: tileStatus(h.health), low: h.health <= 1, ...h },
  };
}

// ---------------------------------------------------------------------------
// Danger card

export interface FlyChip {
  gauge: 'fuel' | 'data' | 'coins';
  /** Change in segments (fuel, data) or coins; always negative for a cost. */
  delta: number;
}

export interface FlyOption extends AlertOption {
  chips: FlyChip[];
  /** Risk-bar steps above the hazard's safest option (0 for the safest): shown as "⚠ +n risk". */
  riskIncrease: number;
}

export interface FlyCard {
  /** Seconds until the danger strikes (0 if it already has). */
  onsetIn_s: number;
  /** Seconds until an order sent now reaches the craft: team reaction + one-way light time. */
  orderTakes_s: number;
  /** Seconds until the deadline after which the craft decides by itself. */
  deadlineIn_s: number;
  options: FlyOption[];
}

/** A cost as a drop in segments, at least one segment (FLY_RULES.minimumChip). */
function segmentDrop(before: number, after: number): number {
  return Math.min(-FLY_RULES.minimumChip.value, after - before);
}

export function flyCard(s: OpsState, v: OpsConsoleView = consoleView(s)): FlyCard | undefined {
  const a = v.alert;
  if (!a) return undefined;
  const g = v.gauges;
  const loaded = s.env.ev.details.propellant_kg;
  const propLeft = g.fuel.propellantLeft_kg;
  const goal = goalGbit(s) * 1e9;
  const sent = s.downlinkedPrime_bits;
  const lost = new Set(s.instrumentsLost);
  const perDay = s.env.loads.instruments.reduce((x, i) => x + (lost.has(i.id) ? 0 : Math.max(0, Math.min(1, s.plan.instruments[i.id] ?? 0)) * i.data_bitsPerDay), 0);
  const minLevel = Math.min(...a.options.map((o) => o.riskLevel));
  const fuelNow = segmentsFromFraction(loaded > 0 ? propLeft / loaded : 0);
  // Data as a share of the goal: the days lost are science that is never collected.
  const dataShare = (bits: number) => (goal > 0 ? (SEG() * bits) / goal : 0);
  return {
    onsetIn_s: Math.max(0, a.onset - s.t) * DAY_S,
    orderTakes_s: Math.max(0, a.arrivesIfSent - s.t) * DAY_S,
    deadlineIn_s: Math.max(0, a.deadline - s.t) * DAY_S,
    options: a.options.map((o) => {
      const chips: FlyChip[] = [];
      if (o.fuel_kg > 0) chips.push({ gauge: 'fuel', delta: segmentDrop(fuelNow, segmentsFromFraction(loaded > 0 ? (propLeft - o.fuel_kg) / loaded : 0)) });
      const days = o.cost.scienceDays?.value ?? 0;
      if (days > 0) {
        const now = Math.round(dataShare(sent + days * perDay));
        const after = Math.round(dataShare(sent));
        chips.push({ gauge: 'data', delta: segmentDrop(now, after) });
      }
      if (o.coins > 0) chips.push({ gauge: 'coins', delta: -o.coins });
      return { ...o, chips, riskIncrease: o.riskLevel - minLevel };
    }),
  };
}

// ---------------------------------------------------------------------------
// Coming Up ribbon

export type ComingUpKind = 'eclipse' | 'conjunction' | 'course-fix' | 'arrival' | 'dust-season';

export interface ComingUpItem {
  kind: ComingUpKind;
  day: number;
  endDay?: number;
  inDays: number;
  /** Position along the ribbon (0 = now, 1 = the end of the window). */
  left: number;
  /** Worth a card or a plan (amber); the others are information (green). */
  important: boolean;
}

export interface ComingUp {
  days: number;
  /** The window in months (FLY_RULES.monthTick_days), for "NEXT 5 MONTHS". */
  months: number;
  /** One tick per month (FLY_RULES.monthTick_days), counted from now. */
  ticks: { inDays: number; months: number; left: number }[];
  items: ComingUpItem[];
}

/** Foreseeable events of the next window (FLY_RULES): never a hazard Earth has not seen. */
export function comingUp(s: OpsState): ComingUp {
  const env = s.env;
  const span = FLY_RULES.comingUpWindow_days.value;
  const day = Math.max(0, Math.min(Math.floor(s.t), env.horizonDay));
  const items: ComingUpItem[] = [];
  const add = (kind: ComingUpKind, d: number, important: boolean, endDay?: number) => {
    const inDays = d - day;
    if (inDays <= 0 || inDays > span) return;
    items.push({ kind, day: d, inDays, left: inDays / span, important, ...(endDay !== undefined ? { endDay } : {}) });
  };
  for (const w of env.conjunctions) add('conjunction', w.startDay, true, w.endDay);
  for (const e of env.eclipseSeasons) add('eclipse', e.startDay, true, e.endDay);
  for (const b of env.burns.slice(s.burnsDone)) {
    if (b.kind === 'trajectory-correction' || b.kind === 'route-manoeuvre') add('course-fix', b.day, false);
    else if (b.kind === 'arrival') add('arrival', b.day, true);
  }
  // Mars dust-storm season (Ls inside the season bounds), once the craft is at Mars.
  if (env.design.destination === 'mars') {
    const a = OPERATIONS.marsDust.seasonStartLs_deg.value;
    const z = OPERATIONS.marsDust.seasonEndLs_deg.value;
    const inSeason = (ls: number | undefined) => ls !== undefined && ls >= a && ls < z;
    for (let d = Math.max(day + 1, env.arrivalDay + 1); d <= Math.min(day + span, env.horizonDay); d++) {
      if (inSeason(env.days[d]?.ls_deg) && !inSeason(env.days[d - 1]?.ls_deg)) add('dust-season', d, false);
    }
  }
  items.sort((x, y) => x.inDays - y.inDays);
  const step = FLY_RULES.monthTick_days.value;
  const ticks: ComingUp['ticks'] = [];
  for (let d = step, m = 1; d < span; d += step, m++) ticks.push({ inDays: d, months: m, left: d / span });
  return { days: span, months: Math.round(span / step), ticks, items };
}

// ---------------------------------------------------------------------------
// Eclipse planning card

export interface EclipseCardOption {
  id: 'keep-warm' | 'save-power';
  plan: PowerPlan;
  preview: PowerPlanPreview;
  /** Power segments through the season's longest eclipse (battery depth-of-discharge margin). */
  eclipseSegments: number;
}

export interface EclipseCard {
  season: EclipseSeason;
  inDays: number;
  options: [EclipseCardOption, EclipseCardOption];
}

/** A few days before an eclipse season: keep the plan in force (warm) or turn the heaters down (save power). */
export function eclipseCard(s: OpsState): EclipseCard | undefined {
  if (s.status !== 'flying') return undefined;
  const day = Math.floor(s.t);
  const season = s.env.eclipseSeasons.find((e) => e.startDay > day && e.startDay - day <= FLY_RULES.eclipseCardLead_days.value);
  if (!season) return undefined;
  const opt = (id: EclipseCardOption['id'], plan: PowerPlan): EclipseCardOption => {
    const preview = powerPlanPreview(s, plan);
    return { id, plan, preview, eclipseSegments: segmentsFromMargin(preview.eclipse?.margin ?? preview.today.margin) };
  };
  return {
    season,
    inDays: season.startDay - day,
    options: [opt('keep-warm', s.plan), opt('save-power', { ...s.plan, heaters: FLY_RULES.savePowerHeaters.value })],
  };
}

/** After an order lands, before its outcome is known: seconds until the danger strikes and the outcome lands. */
export function outcomeIn_s(s: OpsState, hazardId: string): number | undefined {
  const rec = s.hazards.find((h) => h.id === hazardId);
  if (!rec || rec.outcomeDone || rec.resolveAt === undefined) return undefined;
  return Math.max(0, rec.resolveAt - s.t) * DAY_S;
}

export interface MissionProgress {
  /** Share of the mission flown, 0–1 (prime mission, or prime + extension once one is chosen). */
  fraction: number;
  /** Mission days not yet started. */
  daysLeft: number;
  /** The mission's last day. */
  endDay: number;
}

/** How far the flight is: the progress bar and "mission ends in …" (days 0 … endDay). */
export function missionProgress(s: OpsState): MissionProgress {
  const endDay = s.extension ? s.extension.endDay : s.env.primeEndDay;
  const total = endDay + 1;
  const over = s.status === 'complete' || s.status === 'lost' || s.status === 'not-launched';
  if (over) return { fraction: 1, daysLeft: 0, endDay };
  return { fraction: clamp01(s.t / total), daysLeft: Math.max(0, total - Math.floor(s.t + 1e-9)), endDay };
}

/** How the tiles are counted (Engineer equations drawer). */
export const TILE_EQUATION = 'segments = N × min(1, margin / m_full), at least one while ≥ 0 · systems = N − k × (wheels lost + instruments lost + safe mode + brownout + degraded)';
