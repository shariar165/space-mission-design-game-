// Words for the Signal Delay screens (design: docs/design/signal-delay). Numbers come from the engine and are only
// formatted here, through format.ts. Cadet reads short uppercase lines; Engineer adds the numbers.
import type { FailureEffect, OpsPhase } from '../engine/data';
import type { ComingUpKind, ConsoleOutcome, FlyChip, RobotMessage, VoiceKind } from '../engine/ops/index';
import type { DeckCard, PackBlockerCode, PartId } from '../engine/pack';
import type { FinalTransmission, Hurt, ReportPanel, Saved } from '../engine/ops/report';
import type { Category } from '../engine/scoring';
import type { LessonCategory, LessonUnlock } from '../engine/notebook';
import type { SDIconName } from './components/sd/SDIcon';
import * as f from './format';

export const GAME_NAME = 'SIGNAL DELAY';

// ---------------------------------------------------------------------------
// Fly & Survive

export type TileKey = 'power' | 'fuel' | 'data' | 'systems';
export const TILE: Record<TileKey, { name: string; icon: SDIconName; help: string }> = {
  power: { name: 'POWER', icon: 'power', help: 'Power to spare today' },
  fuel: { name: 'FUEL', icon: 'fuel', help: 'Fuel left in the tank' },
  data: { name: 'DATA', icon: 'data', help: 'Science sent home, against the goal' },
  systems: { name: 'SYSTEMS', icon: 'sys', help: 'How healthy the robot is' },
};

/** Short card labels in the design's voice; the engine's own label is the fallback. */
export const OPTION_SHORT: Record<string, string> = {
  'solar-storm.shelter': 'SHIELD UP',
  'solar-storm.keep-observing': 'KEEP WORKING',
  'cme-shock.safe-mode': 'SAFE MODE',
  'cme-shock.keep-observing': 'WATCH IT HIT',
  'mars-dust-storm.raise-periapsis': 'CLIMB HIGHER',
  'mars-dust-storm.wait-it-out': 'WAIT IT OUT',
  'mars-dust-storm.carry-on': 'CARRY ON',
  'debris.hide': 'HIDE BEHIND THE PLANET',
  'debris.edge-on': 'TURN EDGE-ON',
  'debris.ignore': 'DO NOTHING',
  'reaction-wheel.thrusters': 'USE THRUSTERS',
  'reaction-wheel.hybrid': 'NEW POINTING PLAN',
  'reaction-wheel.carry-on': 'KEEP GOING',
  'memory-corruption.backup-computer': 'SPARE COMPUTER',
  'memory-corruption.patch': 'SEND A PATCH',
  'memory-corruption.reboot': 'REBOOT',
  'insertion-anomaly.trim-burn': 'TRIM BURN',
  'insertion-anomaly.accept-orbit': 'KEEP THIS ORBIT',
  'insertion-anomaly.hold': 'HOLD STILL',
};

export const optionShort = (type: string, id: string, label: string) => OPTION_SHORT[`${type}.${id}`] ?? label.toUpperCase();

export const EFFECT_ICON: Record<FailureEffect, SDIconName> = { craft: 'sys', instrument: 'camera', 'stored-data': 'data', 'safe-mode': 'sys' };
export const CHIP_ICON: Record<FlyChip['gauge'], SDIconName> = { fuel: 'fuel', data: 'data', coins: 'star' };

/** "IN 30 HOURS", or "NOW" once the danger has struck. */
export const arrivesWords = (s: number) => (s < 60 ? 'NOW' : `IN ${f.durationWords(s)}`);

export const COMING: Record<ComingUpKind, { label: (dest: string) => string; short: (dest: string) => string; icon: SDIconName }> = {
  eclipse: { label: () => 'ECLIPSE SEASON', short: () => 'DARK', icon: 'eclipse' },
  conjunction: { label: () => 'SUN BLOCKS RADIO', short: () => 'SUN', icon: 'conj' },
  'course-fix': { label: () => 'COURSE FIX', short: () => 'FIX', icon: 'burn' },
  arrival: { label: (d) => `ARRIVE AT ${d.toUpperCase()}`, short: (d) => d.toUpperCase(), icon: 'orbit' },
  'dust-season': { label: () => 'DUST STORM SEASON', short: () => 'DUST', icon: 'dust' },
};

export const monthsWords = (m: number) => `${f.num(m)} ${m === 1 ? 'MONTH' : 'MONTHS'}`;
export const monthsShort = (m: number) => `${f.num(m)}MO`;

/** The CRT log line when nothing else is happening. */
export function quietLine(phase: OpsPhase, dest: string): string {
  const d = dest.toUpperCase();
  switch (phase) {
    case 'launch':
      return 'LIFTOFF. THE ROBOT IS ON ITS WAY.';
    case 'cruise':
      return `CRUISING TO ${d}. ALL QUIET.`;
    case 'arrival':
      return `ARRIVING AT ${d}.`;
    case 'science':
      return `IN ORBIT AT ${d}. SCIENCE RUNNING.`;
    case 'return':
      return 'HEADING HOME.';
    case 'extended':
      return 'EXTENDED MISSION. STILL FLYING.';
  }
}

export const milestoneLine = (kind: 'arrival' | 'prime-end' | 'extension-end' | undefined, inDays: number | undefined, dest: string): string => {
  if (kind === 'arrival' && inDays !== undefined) return `${dest.toUpperCase()} IN ${f.num(inDays)} ${inDays === 1 ? 'DAY' : 'DAYS'}`;
  if (kind === 'prime-end' && inDays !== undefined) return `SCIENCE ENDS IN ${f.num(inDays)} DAYS`;
  if (kind === 'extension-end' && inDays !== undefined) return `EXTENSION ENDS IN ${f.num(inDays)} DAYS`;
  return `AT ${dest.toUpperCase()}`;
};

const EFFECT_LINE: Record<FailureEffect, string> = {
  craft: 'CONTACT LOST. THE ROBOT IS GONE.',
  instrument: 'AN INSTRUMENT IS BROKEN FOR GOOD.',
  'stored-data': 'THE PHOTOS ON BOARD WERE WIPED.',
  'safe-mode': 'THE ROBOT HID IN SAFE MODE.',
};

/** The INCOMING teletype after an order lands: what happened, in short lines. */
export function resultLines(o: ConsoleOutcome, shortLabel: string): string[] {
  const lines: string[] = [];
  if (o.by === 'standing-order') lines.push(`NO ORDER IN TIME. THE ROBOT FOLLOWED ITS STANDING ORDER: ${shortLabel}.`);
  else if (o.by === 'fault-protection') lines.push(`NO ORDER IN TIME. THE ROBOT CHOSE: ${shortLabel}.`);
  else lines.push(`ORDER CARRIED OUT: ${shortLabel}.`);
  lines.push(o.bad ? `${o.title.toUpperCase()} HIT HARD.` : `${o.title.toUpperCase()} PASSED.`);
  if (o.bad) lines.push(EFFECT_LINE[o.failureEffect]);
  else lines.push('ALL SYSTEMS SAFE.');
  if (o.scienceDaysLost > 0) lines.push(`YOU MISSED ${f.num(o.scienceDaysLost)} ${o.scienceDaysLost === 1 ? 'DAY' : 'DAYS'} OF SCIENCE.`);
  if (o.deltaV_ms > 0) lines.push(`ENGINE FIRED: ${f.speed(o.deltaV_ms).toUpperCase()}.`);
  return lines;
}

export const RESULT_EFFECT_CHIP: Record<FailureEffect, string> = {
  craft: 'ROBOT LOST',
  instrument: 'INSTRUMENT LOST',
  'stored-data': 'PHOTOS WIPED',
  'safe-mode': 'SAFE MODE',
};

// ---------------------------------------------------------------------------
// Pack


export const PART_LOOK: Record<PartId, { name: string; short: string; icon: SDIconName; color: string }> = {
  computer: { name: 'Flight computer', short: 'BRAIN', icon: 'computer', color: 'var(--sd-part-brain)' },
  engine: { name: 'Main engine', short: 'ENGINE', icon: 'burn', color: 'var(--sd-part-drive)' },
  camera: { name: 'Camera', short: 'CAMERA', icon: 'camera', color: 'var(--sd-part-science)' },
  spectrometer: { name: 'Spectrometer', short: 'SPECTRO', icon: 'data', color: 'var(--sd-part-science)' },
  magnetometer: { name: 'Magnetometer', short: 'MAG', icon: 'orbit', color: 'var(--sd-part-science)' },
  radar: { name: 'Radar sounder', short: 'RADAR', icon: 'data', color: 'var(--sd-part-science)' },
  sniffer: { name: 'Air sniffer (MAVEN suite)', short: 'SNIFFER', icon: 'data', color: 'var(--sd-part-science)' },
  dish: { name: 'Big dish antenna', short: 'DISH', icon: 'dish', color: 'var(--sd-part-science)' },
  solar: { name: 'Extra solar panel', short: 'SOLAR', icon: 'panel', color: 'var(--sd-part-power)' },
  battery: { name: 'Big battery', short: 'BATTERY', icon: 'battery', color: 'var(--sd-part-power)' },
  tank: { name: 'Extra fuel tank', short: 'FUEL', icon: 'tank', color: 'var(--sd-part-drive)' },
  heater: { name: 'Heater pack', short: 'HEAT', icon: 'heater', color: 'var(--sd-part-guard)' },
  shield: { name: 'Radiation shield', short: 'SHIELD', icon: 'shield', color: 'var(--sd-part-guard)' },
  bumper: { name: 'Debris bumper', short: 'BUMPER', icon: 'shield', color: 'var(--sd-part-guard)' },
  spare: { name: 'Spare computer', short: 'SPARE', icon: 'computer', color: 'var(--sd-part-brain)' },
  autopilot: { name: 'Autopilot chip', short: 'AUTO', icon: 'computer', color: 'var(--sd-part-brain)' },
};

/** Science parts earn data (the green star badge). */
export const SCIENCE_PARTS: PartId[] = ['camera', 'spectrometer', 'magnetometer', 'radar', 'sniffer', 'dish'];

export const DANGER_LOOK: Record<string, { title: string; short: string; line: string; icon: SDIconName }> = {
  eclipse: { title: 'ECLIPSE SEASON', short: 'ECLIPSE', line: 'The planet hides the Sun. Power runs low.', icon: 'eclipse' },
  conjunction: { title: 'SUN IN THE WAY', short: 'SUN', line: 'No calls home for about two weeks.', icon: 'conj' },
  'solar-storm': { title: 'RADIATION STORM', short: 'STORM', line: 'The Sun spits fast particles that fry electronics.', icon: 'storm' },
  'cme-shock': { title: 'CME SHOCK', short: 'CME', line: 'A cloud of solar plasma slams into Mars.', icon: 'storm' },
  'mars-dust-storm': { title: 'DUST STORM', short: 'DUST', line: 'Mars air swells and drags on low orbits.', icon: 'dust' },
  debris: { title: 'COMET DUST', short: 'DEBRIS', line: 'Tiny grains hit faster than bullets.', icon: 'debris' },
  'reaction-wheel': { title: 'WHEEL FAILURE', short: 'WHEEL', line: 'A spinning wheel that points the robot wears out.', icon: 'sys' },
  'memory-corruption': { title: 'MEMORY GLITCH', short: 'MEMORY', line: 'Radiation flips bits in the computer.', icon: 'computer' },
  'insertion-anomaly': { title: 'ARRIVAL BURN GOES WRONG', short: 'ARRIVAL', line: 'The braking burn does not go to plan.', icon: 'orbit' },
};

export const dangerLook = (id: string, title: string) => DANGER_LOOK[id] ?? { title: title.toUpperCase(), short: title.toUpperCase(), line: '', icon: 'sys' as SDIconName };

export function deckWhen(c: DeckCard): string {
  if (c.kind === 'eclipse' || c.kind === 'conjunction') return 'CERTAIN · YOU CAN SEE IT COMING';
  return c.detectedBy === 'earth' ? 'SURPRISE · WITH A WARNING' : 'SURPRISE · NO WARNING';
}

export const STAMP: Record<DeckCard['stamp'], { word: string; short: string; color: string }> = {
  covered: { word: 'COVERED', short: 'OK', color: 'var(--sd-ok)' },
  some: { word: 'SOME COVER', short: 'SOME', color: 'var(--sd-soso)' },
  none: { word: 'NOT COVERED', short: 'NONE', color: 'var(--sd-bad)' },
};

export const PACK_BLOCKER: Record<PackBlockerCode, string> = {
  'too-heavy': 'TOO HEAVY FOR THIS ROCKET',
  'no-power': 'NOT ENOUGH POWER',
  'no-fuel': 'NOT ENOUGH FUEL TO GET THERE',
  'no-capture': 'THIS ENGINE CANNOT BRAKE INTO ORBIT',
  'flight-too-long': 'THAT FLIGHT IS TOO LONG FOR THE GAME',
  'no-science': 'PACK AT LEAST ONE INSTRUMENT',
  other: 'NOT READY TO LAUNCH',
};

export const NO_ROOM = 'NO ROOM IN THE NOSE';

export const DAY_WORDS: Record<'good' | 'soso' | 'bad', { msg: (dest: string) => string; short: string }> = {
  good: { msg: (d) => `GOOD DAY · ${d.toUpperCase()} IS IN REACH`, short: 'GOOD' },
  soso: { msg: () => 'SO-SO · LITTLE TO SPARE', short: 'SO-SO' },
  bad: { msg: (d) => `BAD DAY · ${d.toUpperCase()} IS OUT OF REACH`, short: 'BAD' },
};

/** The Launch Day step, and the one-line launch day on Pack (spec UI rules 24 and 26). */
export const LAUNCH_DAY_WORDS = {
  title: 'LAUNCH DAY',
  sub: 'Six weeks of launch days. Green: an easy trip. Amber: little to spare. Red: out of reach.',
  line: 'LAUNCH DAY',
  auto: 'BEST DAY · PICKED FOR YOU',
  yours: 'YOUR PICK',
  change: 'CHANGE ▸',
  arrives: 'ARRIVES',
  flight: 'FLIGHT',
  best: 'BEST DAY',
  useBest: 'USE THE BEST DAY',
  working: 'WORKING OUT THE LAUNCH DAYS…',
  c3: 'C3 · v∞ ARRIVAL',
  margins: 'MARGINS · MASS · Δv',
};

export const WEIGHT_WORDS: Record<'ok' | 'warning' | 'over', string> = {
  ok: 'LIGHT ENOUGH',
  warning: 'NEARLY TOO HEAVY',
  over: 'TOO HEAVY FOR THIS ROCKET',
};

/** "NOV 1" from an ISO date. */
export const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
/** "NOV–DEC 2013" for the calendar head. */
export function monthSpan(fromIso: string, toIso: string): string {
  const m = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const y = toIso.slice(0, 4);
  return m(fromIso) === m(toIso) ? `${m(fromIso)} ${y}` : `${m(fromIso)}–${m(toIso)} ${y}`;
}

// ---------------------------------------------------------------------------
// Mission Report


const hazardTitle = (type: string, title: string) => (DANGER_LOOK[type]?.title ?? title.toUpperCase());

export interface PanelWords {
  head: string;
  text: string;
}

/** Caption for a comic panel. `label` gives a choice's short label, `title` a hazard's engine title. */
export function panelWords(
  p: ReportPanel,
  ctx: { dest: string; rocket: string; label: (type: string, id: string) => string; title: (type: string) => string; autopilot: boolean; sent_Gbit: number },
): PanelWords {
  const day = `DAY ${f.num(p.day)}`;
  switch (p.kind) {
    case 'launch':
      return { head: `${day} · LIFTOFF`, text: `Off the pad on an ${ctx.rocket}. The robot is on its own now.` };
    case 'launch-failed':
      return { head: `${day} · LAUNCH FAILED`, text: 'The rocket failed on launch day. Rockets are not perfect.' };
    case 'not-launched':
      return { head: `${day} · NOT LAUNCHED`, text: 'The craft never left the ground.' };
    case 'hazard': {
      const t = hazardTitle(p.hazardType!, ctx.title(p.hazardType!));
      const label = ctx.label(p.hazardType!, p.optionId!);
      const how = p.bad ? `It went wrong: ${RESULT_EFFECT_CHIP[p.effect ?? 'safe-mode'].toLowerCase()}.` : 'It worked.';
      const who =
        p.by === 'standing-order' ? `The robot followed its order: ${label}.` : p.by === 'fault-protection' ? `No order in time. The robot chose: ${label}.` : `You chose: ${label}.`;
      return { head: `${day} · ${t}`, text: `${who} ${how}` };
    }
    case 'arrival':
      return { head: `${day} · ARRIVE AT ${ctx.dest.toUpperCase()}`, text: `A long braking burn. ${ctx.dest} caught you.` };
    case 'conjunction':
      return {
        head: `${day} · SUN IN THE WAY`,
        text: `No radio for ${f.num(p.blackoutDays ?? 0)} days. ${ctx.autopilot ? 'The autopilot flew alone.' : 'The robot waited it out.'}`,
      };
    case 'lost':
      return { head: `${day} · CONTACT LOST`, text: 'The robot went silent. Nobody heard it again.' };
    case 'complete':
      return { head: `${day} · MISSION COMPLETE`, text: `Science done: ${f.gbit(ctx.sent_Gbit)} sent home.` };
  }
}

export const PANEL_SOUND: Partial<Record<string, string>> = {
  'solar-storm': 'ZZZT!',
  'cme-shock': 'WHUMP!',
  'mars-dust-storm': 'WHOOOSH',
  debris: 'PING!',
  'reaction-wheel': 'GRRRK',
  'memory-corruption': 'BEEP?',
  'insertion-anomaly': 'FWUMP',
};

export const STAR_WORDS = (dest: string) => [`REACHED ${dest.toUpperCase()}`, 'SCIENCE GOAL', 'MARGINS IN THE BAND'] as const;

const CATEGORY_WORD: Record<Category, string> = {
  science: 'science sent home',
  success: 'mission phases',
  budget: 'the budget',
  deltaV: 'the fuel margin',
  power: 'the power margin',
  mass: 'the weight margin',
  crisis: 'crisis handling',
};
export const CATEGORY_NAME: Record<Category, string> = {
  science: 'SCIENCE',
  success: 'SUCCESS',
  budget: 'BUDGET',
  deltaV: 'Δv MARGIN',
  power: 'POWER MARGIN',
  mass: 'MASS MARGIN',
  crisis: 'CRISIS HANDLING',
};

export function savedWords(v: Saved, ctx: { label: (type: string, id: string) => string; title: (type: string) => string }): { strong: string; rest: string } {
  switch (v.code) {
    case 'part':
      return { strong: `The ${PART_LOOK[v.part].name.toLowerCase()}`, rest: `. It made the ${hazardTitle(v.hazardType, ctx.title(v.hazardType)).toLowerCase()} far less dangerous.` };
    case 'autopilot':
      return { strong: 'The autopilot chip', rest: `. It answered the ${hazardTitle(v.hazardType, ctx.title(v.hazardType)).toLowerCase()} on its own.` };
    case 'choice':
      return { strong: `Choosing “${ctx.label(v.hazardType, v.optionId).toLowerCase()}”`, rest: ` when the ${hazardTitle(v.hazardType, ctx.title(v.hazardType)).toLowerCase()} came.` };
    case 'quiet':
      return { strong: 'Good planning', rest: '. Nothing went wrong this time.' };
  }
}

export function hurtWords(v: Hurt, ctx: { label: (type: string, id: string) => string; title: (type: string) => string }): { strong: string; rest: string } {
  switch (v.code) {
    case 'bad-outcome':
      return {
        strong: `“${ctx.label(v.hazardType, v.optionId).toLowerCase()}”`,
        rest: ` in the ${hazardTitle(v.hazardType, ctx.title(v.hazardType)).toLowerCase()}: ${RESULT_EFFECT_CHIP[v.effect].toLowerCase()}.`,
      };
    case 'category':
      return { strong: CATEGORY_WORD[v.category], rest: ` scored only ${f.num(v.score)} out of 100.` };
    case 'nothing':
      return { strong: 'Nothing big', rest: '. Every score was fair or better.' };
  }
}

export const REPORT_STAMP: Record<'complete' | 'extended' | 'lost' | 'not-launched', { word: string[]; color: string }> = {
  complete: { word: ['MISSION', 'COMPLETE'], color: 'var(--sd-ok)' },
  extended: { word: ['MISSION', 'EXTENDED'], color: 'var(--sd-soso)' },
  lost: { word: ['ROBOT', 'LOST'], color: 'var(--sd-red)' },
  'not-launched': { word: ['NOT', 'LAUNCHED'], color: 'var(--sd-red)' },
};

/**
 * FINAL TRANSMISSION (Mission Report, design TELETYPE 03): the robot's last message, line by line (engine
 * finalTransmission). Templates with named slots, like the robot's voice: {day} {dest} {name} {science} {hazard}
 * {when} {option} {part} {dv} {days} {fuel} {years} {delay}.
 */
export const FINAL_WORDS = {
  kicker: (day: string) => `TELETYPE 03 · RECEIVED DAY ${day}`,
  incomplete: 'INCOMPLETE',
  sent: (delay: string) => `SENT ${delay} BEFORE IT PRINTED`,
  title: (name: string) => `FINAL TRANSMISSION — ${name}`,
  opening: {
    complete: 'DAY {day}. I SAW {dest} FOR {science} DAYS.',
    lost: 'DAY {day}. THIS IS {name}. ARE YOU THERE?',
    extended: 'DAY {day}. PRIMARY MISSION COMPLETE. THE EXTENSION TOO.',
  },
  hurt: 'THE {hazard} ON DAY {when} HURT ME. {effect}',
  effect: {
    craft: 'I NEARLY DID NOT MAKE IT.',
    instrument: 'ONE INSTRUMENT NEVER WOKE UP.',
    'stored-data': 'THE DATA I WAS HOLDING IS GONE.',
    'safe-mode': 'I HID IN SAFE MODE FOR DAYS.',
  } satisfies Record<FailureEffect, string>,
  saved: {
    part: 'THE {part} TOOK THE {hazard} FOR ME.',
    autopilot: 'NO ORDER COULD REACH ME IN TIME. THE AUTOPILOT CHIP FLEW ME THROUGH THE {hazard}.',
    choice: 'ON DAY {when} YOU CHOSE {option}. IT SAVED ME.',
  },
  arrival: 'YOU SENT ME IN WITH A {dv} BURN. {dest} CAUGHT ME ON THE FIRST TRY.',
  conjunction: 'FOR {days} DAYS THE SUN STOOD BETWEEN US. I FLEW MYSELF.',
  quiet: 'NOTHING BROKE. NOT ONCE.',
  fuel: '{fuel} OF FUEL LEFT. BATTERY HOLDING.',
  extension: 'EXTENSION FLOWN: {years} MORE THAN PLANNED.',
  signOff: 'PRIMARY MISSION COMPLETE. {name} OUT.',
  cause: {
    hazard: 'THE {hazard} WAS TOO MUCH. SYSTEMS FAILING.',
    fuel: 'MY TANK IS EMPTY. I CANNOT HOLD MY COURSE.',
    power: 'NO POWER FOR {days} DAYS. BATTERY ALMOST GONE.',
    unknown: 'SOMETHING IS WRONG. SYSTEMS FAILING.',
  },
  /** Broken off mid-word on purpose: the signal ends here. */
  cutOff: 'TURNING MY ANTENNA TO WHERE EARTH SHOULD B',
  lost: '— SIGNAL LOST —',
  still: 'STILL HERE.',
  foot: {
    complete: 'The last words were already {delay} old when the paper moved.',
    lost: 'The Deep Space Network kept listening. Nothing else came.',
    extended: 'Not a goodbye after all: the mission is over, the robot is not.',
  },
  feed: 'FEED THE PAPER · MISSION REPORT ▾',
  label: 'Final transmission',
};

/** Every line of a final transmission, in words. */
export function finalLines(
  ft: FinalTransmission,
  ctx: { dest: string; name: string; title: (type: string) => string; label: (type: string, id: string) => string },
): string[] {
  const W = FINAL_WORDS;
  const years = (n: number) => `${f.num(n)} ${n === 1 ? 'YEAR' : 'YEARS'}`;
  return ft.lines.map((l) => {
    const v = l.values;
    const hazard = v.hazardType ? hazardTitle(v.hazardType, ctx.title(v.hazardType)).toUpperCase() : '';
    const slots: Record<string, string> = {
      dest: ctx.dest.toUpperCase(),
      name: ctx.name.toUpperCase(),
      hazard,
      ...(v.day !== undefined ? { day: f.dayPad(v.day), when: f.num(v.day) } : {}),
      ...(v.scienceDays !== undefined ? { science: f.num(v.scienceDays) } : {}),
      ...(v.dv_ms !== undefined ? { dv: f.speed(v.dv_ms).toUpperCase() } : {}),
      ...(v.days !== undefined ? { days: f.num(v.days) } : {}),
      ...(v.propellantLeft_kg !== undefined ? { fuel: f.kg(v.propellantLeft_kg).toUpperCase() } : {}),
      ...(v.years !== undefined ? { years: years(v.years) } : {}),
    };
    switch (l.kind) {
      case 'opening':
        return fill(W.opening[ft.ending], slots);
      case 'hurt':
        return fill(W.hurt, { ...slots, effect: v.effect ? W.effect[v.effect] : '' }).trim();
      case 'saved': {
        const s = v.saved!;
        if (s.code === 'part') return fill(W.saved.part, { ...slots, part: PART_LOOK[s.part].name.toUpperCase(), hazard: hazardTitle(s.hazardType, ctx.title(s.hazardType)).toUpperCase() });
        if (s.code === 'autopilot') return fill(W.saved.autopilot, { ...slots, hazard: hazardTitle(s.hazardType, ctx.title(s.hazardType)).toUpperCase() });
        if (s.code === 'choice') return fill(W.saved.choice, { ...slots, option: ctx.label(s.hazardType, s.optionId).toUpperCase() });
        return W.quiet;
      }
      case 'arrival':
        return fill(W.arrival, slots);
      case 'conjunction':
        return fill(W.conjunction, slots);
      case 'quiet':
        return W.quiet;
      case 'fuel':
        return fill(W.fuel, slots);
      case 'extension':
        return fill(W.extension, slots);
      case 'sign-off':
        return fill(W.signOff, slots);
      case 'cause':
        return fill(W.cause[v.cause ?? 'unknown'], slots);
      case 'cut-off':
        return W.cutOff;
    }
  });
}

// ---------------------------------------------------------------------------
// Notebook


export const CATEGORY_LOOK: Record<LessonCategory, { name: string; color: string }> = {
  signal: { name: 'SIGNAL', color: 'var(--sd-part-science)' },
  power: { name: 'POWER', color: 'var(--sd-part-power)' },
  weather: { name: 'SPACE WEATHER', color: 'var(--sd-part-guard)' },
  nav: { name: 'NAVIGATION', color: 'var(--sd-part-drive)' },
  people: { name: 'PEOPLE', color: 'var(--sd-part-brain)' },
};

/** Lesson titles and plain-English bodies (game copy; the real history is the Sourced text the lesson points at). */
export const LESSON_WORDS: Record<string, { title: string; body: string }> = {
  'safe-beats-curious': { title: 'SAFE BEATS CURIOUS', body: 'When a solar storm is coming, real teams switch instruments off. Missing a few days of science beats losing an instrument forever.' },
  'air-swells': { title: 'THE AIR SWELLS', body: 'A planet-wide dust storm heats Mars’s air and puffs it up. A low orbit suddenly drags through thicker air.' },
  'radiation-adds-up': { title: 'RADIATION ADDS UP', body: 'Electronics can only take so much radiation in a lifetime. Every day near a big planet’s belts spends some of it.' },
  'sun-gets-in-the-way': { title: 'THE SUN GETS IN THE WAY', body: 'Sometimes the Sun sits between Earth and your robot. Its noise scrambles radio, so nobody sends orders until it moves aside.' },
  'bits-flip': { title: 'BITS FLIP', body: 'A fast particle can flip a bit in the computer’s memory. Robots carry ways to check, patch or switch computers.' },
  'full-memory': { title: 'MEMORY FILLS UP', body: 'A robot that saves too many files can run out of room and get confused. Engineers fixed one from millions of km away.' },
  'batteries-hate-the-dark': { title: 'BATTERIES HATE THE DARK', body: 'In a planet’s shadow, solar panels make nothing. Batteries carry the robot, and they last longer if they are never drained deep.' },
  'wheels-wear-out': { title: 'WHEELS WEAR OUT', body: 'Spinning wheels point the robot without fuel, but they wear out. Spares and thrusters keep it pointing when one fails.' },
  'safe-mode-is-a-friend': { title: 'SAFE MODE IS A FRIEND', body: 'When a robot gets confused, it shuts off extras, points at the Sun and waits for help from Earth.' },
  'braking-is-scary': { title: 'BRAKING IS SCARY', body: 'Arriving means one long engine burn with no second chance. Teams plan what to do if it comes out wrong.' },
  'duck-the-dust': { title: 'DUCK THE DUST', body: 'Comet dust hits faster than bullets. Seen far ahead, a robot can hide behind the planet or turn its panels edge-on.' },
  'borrow-speed': { title: 'BORROW SPEED FROM A PLANET', body: 'When no rocket is strong enough, fly past a planet and steal a little of its speed: a gravity assist.' },
  'check-your-units': { title: 'CHECK YOUR UNITS', body: 'Two teams, two kinds of numbers, one lost spacecraft. Always agree on units out loud.' },
  'trust-but-test': { title: 'TRUST, BUT TEST', body: 'A sensor can lie: a shake can look like a landing. Test the software against everything the hardware might feel.' },
  'install-it-right': { title: 'INSTALL IT THE RIGHT WAY UP', body: 'A part fitted backwards can pass every check and still fail on the day. Test the whole craft, not just the parts.' },
};

/** How a hazard reads after "Face …" in an unlock hint. */
const HAZARD_PHRASE: Record<string, string> = {
  'solar-storm': 'a solar storm',
  'cme-shock': 'a CME shock',
  'mars-dust-storm': 'a dust storm',
  debris: 'comet dust',
  'reaction-wheel': 'a wheel failure',
  'memory-corruption': 'a memory glitch',
  'insertion-anomaly': 'an arrival burn anomaly',
  'radiation-damage': 'radiation damage',
};

export function unlockHint(u: LessonUnlock, ctx: { level: (id: string) => string; rescue: (id: string) => string; hazard: (id: string) => string }): string {
  switch (u.kind) {
    case 'face-hazard':
      return `Face ${HAZARD_PHRASE[u.id] ?? ctx.hazard(u.id).toLowerCase()}`;
    case 'finish-level':
      return `Earn a star on ${ctx.level(u.id)}`;
    case 'solve-rescue':
      return `Save ${ctx.rescue(u.id)} in Rescue History`;
    case 'conjunction':
      return 'Fly through a solar conjunction';
    case 'eclipse':
      return 'Fly through an eclipse season';
  }
}

// ---------------------------------------------------------------------------
// Briefings, coach panels, launch checklist and navigation (plain words for every player)

export interface Briefing {
  /** What the player has to do, in one or two sentences. */
  job: string;
  /** One tip that helps on this mission. */
  tip: string;
}

export const BRIEFING: Record<string, Briefing> = {
  'moon-1': {
    job: 'Send a small robot to the Moon and keep it charged while it takes pictures.',
    tip: 'Pack solar wings and a battery. The robot needs power in the Moon’s shadow too.',
  },
  'moon-2': {
    job: 'Reach the Moon with enough fuel to slow down and stay in orbit.',
    tip: 'Fuel is heavy, and the rocket has to lift every bit of it. Watch the weight meter.',
  },
  'moon-3': {
    job: 'Build the whole robot yourself: science, power, radio and fuel. Then fly it.',
    tip: 'Science parts collect data. A bigger dish sends it home faster.',
  },
  mars: {
    job: 'Fly a robot to Mars and keep it alive while it studies the planet.',
    tip: 'Mars is minutes away by radio, so your orders arrive late. Answer danger cards early.',
  },
  venus: {
    job: 'Send a radar robot to cloudy Venus without running out of money.',
    tip: 'Every choice costs coins. Cheap is good, but a robot that breaks earns nothing.',
  },
  bennu: {
    job: 'Meet a small asteroid, study it and bring a pebble sample home.',
    tip: 'An asteroid has almost no gravity. Spare fuel keeps you safe close to it.',
  },
  jupiter: {
    job: 'Find out if any rocket can send a robot straight from Earth to Jupiter.',
    tip: 'If nothing fits on the weight meter, that is the lesson: real missions swing past other planets first.',
  },
};

export const FREE_BRIEFING: Briefing = {
  job: 'Build any robot you like, launch it and keep it alive until the mission ends.',
  tip: 'Pack parts that cover the dangers on the right. Each one shows which danger it helps with.',
};

export const DAILY_BRIEFING: Briefing = {
  job: 'Today’s mission is the same for every player. Keep the robot alive and compare your result.',
  tip: 'You only get one try a day, so read each danger card before you choose.',
};

/** The Daily's space weather (spec UI rule 37): real DONKI storms, or the seeded stand-in when the file can't be read. */
export const LIVE_WEATHER = {
  live: 'LIVE SUN · NASA DONKI',
  /** The danger card's "arrives in" ⓘ title for a real CME. */
  prediction: 'NASA WSA-ENLIL MODEL PREDICTION',
  /** ENLIL severity on a real CME card. */
  severity: { direct: 'DIRECT HIT', glancing: 'GLANCING BLOW', minor: 'MINOR IMPACT' },
  /** Context: the flare a real storm came from. */
  fromFlare: (cls: string) => `From a ${cls} flare.`,
  offline: 'OFFLINE — SIMULATED WEATHER',
  homeLive: 'Same mission for everyone today, with this week’s real solar storms.',
  homeOffline: 'Same mission for everyone today. Offline — simulated weather.',
  briefLive: 'The solar storms on this flight really happened on the Sun this week. NASA’s DONKI database recorded them; tap ⓘ on a storm card to see the record.',
  briefOffline: 'Offline — simulated weather. The real space-weather file could not be read, so today’s storms are made up.',
  realKicker: 'DANGER CARD · REAL SUN',
  realEvent: 'REAL EVENT · NASA DONKI',
  realOn: 'REAL',
  shareLive: '☀️ real Sun · NASA DONKI',
  shareOffline: '☁️ offline · simulated weather',
};

/** The four steps of every mission. */
export const MISSION_STEPS_WORDS: { word: string; line: string }[] = [
  { word: 'PACK', line: 'Choose the parts that fit in the rocket nose.' },
  { word: 'LAUNCH', line: 'Pick a green launch day, flip ARM, press LAUNCH.' },
  { word: 'FLY', line: 'Let time run. Answer danger cards when they appear.' },
  { word: 'REPORT', line: 'See how you did and earn stars.' },
];

/** How the three stars are earned, in plain words (the rules are the engine's STAR_RULES). */
export const STAR_GOALS = (dest: string): string[] => [
  `Reach ${dest} and start the science.`,
  'Send lots of science home.',
  'Finish with spare power, fuel and weight (not too little, not too much).',
];

/** A real mission that flew there, for the briefing. */
export const REAL_MISSION_LINE = (label: string) => `Real NASA mission that flew there: ${label}.`;

export interface CoachPanel {
  icon: SDIconName;
  title: string;
  body: string;
}

/** How to fly: the coach panels on the first flight, the ? button and HOW TO PLAY. */
export const COACH: CoachPanel[] = [
  { icon: 'play', title: 'LET TIME RUN', body: 'Press 10×, 100× or 1000× at the bottom to fly. Press II to pause. Time keeps going after each card.' },
  { icon: 'storm', title: 'DANGER CARDS', body: 'When trouble is coming, time stops and a card appears. Pick an answer. Each one shows what it costs.' },
  { icon: 'dish', title: 'ORDERS TRAVEL SLOWLY', body: 'Your order crosses space at the speed of light. It can take minutes to reach the robot, so act early.' },
  { icon: 'power', title: 'WATCH THE FOUR BARS', body: 'Power, fuel, data and systems are at the top. Keep them out of the red.' },
  { icon: 'postcard', title: 'YOUR ROBOT WRITES HOME', body: 'Its messages cross space at the speed of light too. When its science reaches Earth, you get real NASA postcards.' },
  { icon: 'star', title: 'REACH THE END', body: 'When the mission ends you get your report and stars. In a hurry? FINISH MISSION lets the robot fly the rest.' },
];

export const HOW_TO_PLAY = { label: 'HOW TO PLAY', sub: 'New here? Learn the game in one minute.' };

/** MARS RIGHT NOW on Home (engine marsNow: today's JPL ephemeris, no internet needed). */
/** Home's second row (spec UI rule 28): the smaller keys after PLAY and the DAILY. */
export const HOME_WORDS = {
  more: 'More',
};

export const MARS_NOW = {
  title: 'MARS RIGHT NOW',
  away: 'away',
  takes: 'A message takes',
  oneWay: 'one way',
  next: 'Next solar conjunction',
  in: 'in',
  now: 'SOLAR CONJUNCTION NOW: the Sun is between Earth and Mars. Missions pause their orders.',
  until: 'until',
};

/** The Pack launch checklist, in order. */
export const LAUNCH_CHECKS = {
  packed: 'PACK PARTS THAT FIT',
  day: 'PICK A GREEN LAUNCH DAY',
  arm: 'FLIP THE ARM SWITCH',
  go: 'PRESS LAUNCH',
} as const;

export const NAV = {
  back: '◂ BACK',
  info: 'MISSION INFO',
  help: 'HOW TO FLY',
  start: 'GOT IT ▸',
  next: 'NEXT ▸',
  prev: '◂ PREV',
  finish: 'FINISH MISSION ▸▸',
};

export const FINISH_CONFIRM = {
  title: 'FINISH THE MISSION?',
  body: 'The robot flies the rest on its own. It answers any danger with its built-in plan, then you see your report.',
  yes: 'FINISH MISSION ▸▸',
  no: 'KEEP FLYING',
};

export const LEAVE_CONFIRM = {
  title: 'LEAVE THIS FLIGHT?',
  body: 'This flight ends and you go back to the last screen. You can launch again from there.',
  leave: '◂ LEAVE FLIGHT',
  finish: 'FINISH AND SEE REPORT ▸▸',
  stay: 'KEEP FLYING',
};

export const FLY_GOAL = 'GOAL: KEEP THE ROBOT ALIVE UNTIL THE MISSION ENDS';

/** The footer line under the progress bar. */
export const endsInWords = (daysLeft: number) => (daysLeft <= 0 ? 'MISSION OVER' : `MISSION ENDS IN ${f.num(daysLeft)} ${daysLeft === 1 ? 'DAY' : 'DAYS'}`);

/** The nudge when the clock is paused and nothing else is on screen. */
export const playNudge = (speedLabel: string) => `▶ PRESS ${speedLabel} TO LET TIME RUN`;

/** Labels on the CRT map. */
export const MAP_WORDS = {
  sun: 'SUN',
  storm: 'SOLAR STORM',
  order: 'YOUR ORDER',
  reply: 'ITS REPLY',
  you: 'YOU',
};

/** The log line while a solar storm crosses space toward the robot, and while it hits. */
export const stormLine = (phase: 'coming' | 'hitting', name: string, hitsIn: string) =>
  phase === 'coming' ? `THE SUN ERUPTED. A SOLAR STORM HITS ${name} IN ${hitsIn}.` : `SOLAR STORM ON ${name}. PARTICLES EVERYWHERE.`;

// ---------------------------------------------------------------------------
// The robot's voice. It reports in the first person; every line reached Earth one light time after it was sent.

/** Names the 🎲 button cycles through on Pack (the first is the default). */
export const ROBOT_NAMES = ['PIP', 'NOVA', 'ZIPPY', 'BOLT', 'COMET', 'SPARKY', 'ORBIT', 'BEEP', 'ASTRO', 'DOT', 'RUSTY', 'TWINKLE'];
/** Longest robot name (letters): the twelve cells of the name screen, and still short enough for the map. */
export const ROBOT_NAME_MAX = 12;

/**
 * A typed name made safe for the map: capitals, letters, digits, spaces and dashes, no leading space, at most
 * ROBOT_NAME_MAX. Saved names are cleaned again when read back (saves.ts), so storage can't smuggle anything in.
 */
export const cleanRobotName = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^ +/, '')
    .slice(0, ROBOT_NAME_MAX);

/** The name to show: the player's, or the default when the field was left empty. */
export const robotNameOr = (name: string | undefined) => (name && name.trim() ? name.trim() : ROBOT_NAMES[0]!);

/** The next suggestion after the current name. */
export const nextRobotName = (name: string) => ROBOT_NAMES[(ROBOT_NAMES.indexOf(name) + 1) % ROBOT_NAMES.length]!;

export const ROBOT_WORDS = {
  nameLabel: 'YOUR ROBOT’S NAME',
  suggest: 'Suggest a name',
  took: (dest: string, delay: string) => `FROM ${dest} · TOOK ${delay} TO REACH YOU`,
  lastMessage: (name: string) => `LAST MESSAGE FROM ${name}`,
};

/** NAME YOUR ROBOT (design screen 00), before the first mission. */
export const NAME_WORDS = {
  kicker: 'PAD 39A · PRE-LAUNCH',
  intro1: '> A NEW ROBOT IS WAITING ON THE PAD.',
  intro2: '> GIVE IT A NAME.',
  count: (n: string, max: string) => `NAME · ${n} / ${max}`,
  input: 'Robot name',
  /** The design's three suggestions. */
  suggestions: ['VOYA', 'TALLY', 'KESTREL'],
  suggestion: (n: string) => `SUGGESTION ${n}`,
  launch: 'LAUNCH INTO TODAY’S SKY',
  firstHead: (name: string, day: string) => `${name} · DAY ${day} · SENT JUST NOW`,
  noDelay: 'THE LAST TIME THERE IS NO DELAY',
  firstWords: 'SYSTEMS ON. FUEL FULL. READY WHEN YOU ARE.',
  load: (name: string) => `LOAD ${name}`,
  loadSub: 'Next: the packing bay',
  skip: (name: string) => `SKIP · CALL IT ${name}`,
  sky: 'TODAY’S SKY',
  skyLine: (date: string, minutes: string) => `TODAY · ${date} · MARS IS ${minutes} LIGHT-MINUTES AWAY`,
  skyPhone: (minutes: string) => `MARS IS ${minutes} LIGHT-MINUTES AWAY`,
  skyEng: (au: string, mkm: string, t: string) => `${au} · ${mkm} · t = d / c = ${t}`,
};

/**
 * Fill a word template: each {slot} becomes its value. The robot's lines are templates, not sentences glued from
 * pieces, so a translation (Bangla next) can move the slots wherever its grammar puts them.
 */
export const fill = (template: string, slots: Record<string, string>) => template.replace(/\{(\w+)\}/g, (all, k: string) => slots[k] ?? all);

/**
 * The robot's voice: terse uppercase telemetry, in the first person. Slots: {dest} {name} {option} {hazard}
 * {days} {dist} {fuel} {data} {dv} {burned} {dark} {pct} {years}. Each kind has one or more variants; the
 * message's seq picks one, so a repeated kind does not repeat itself word for word.
 */
export const VOICE: Record<Exclude<VoiceKind, 'hit' | 'status'>, string[]> = {
  launch: ['LIFTOFF. SYSTEMS ON. NEXT STOP: {dest}.'],
  'launch-failed': ['THE ROCKET FAILED. I NEVER LEFT THE PAD.'],
  halfway: ['HALFWAY TO {dest}. EARTH IS A BLUE DOT BEHIND ME.'],
  arrived: ['ARRIVED AT {dest}. ENGINE FIRED. IT CAUGHT ME.'],
  science: ['INSTRUMENTS ON. {dest} BELOW. MAPPING.'],
  'heading-home': ['SAMPLE STOWED. TURNING FOR HOME.'],
  'bonus-time': ['EXTENSION BEGINS. STILL HERE. STILL WORKING.'],
  dark: ['ECLIPSE SEASON. UP TO {dark} DARK EACH ORBIT. RUNNING ON BATTERY.', 'SHADOW SEASON AGAIN. {dark} DARK EACH ORBIT. HEATERS DOWN A LITTLE.', 'DARK AGAIN. I KNOW THE DRILL.'],
  conjunction: ['THE SUN IS BETWEEN US. NO ORDERS FOR A WHILE. FLYING MYSELF.'],
  'conjunction-end': ['THE SUN HAS MOVED ASIDE. I CAN HEAR YOU AGAIN.'],
  saved: ['{hazard} PASSED. ALL SYSTEMS SAFE.', 'THAT WORKED. NO DAMAGE.', 'ALL GOOD UP HERE.'],
  hurt: ['{hazard}: SOMETHING BROKE. STILL FLYING.', 'DAMAGE TAKEN. CARRYING ON AS BEST I CAN.'],
  'instrument-lost': ['LOST AN INSTRUMENT. WORKING WITH THE REST.'],
  'safe-mode': ['SAFE MODE. EVERYTHING NON-ESSENTIAL OFF. WAITING FOR ORDERS.'],
  brownout: ['BATTERY LOW. SWITCHING THINGS OFF TO STAY ALIVE.'],
  'wheel-spare': ['A WHEEL FAILED. THE SPARE TOOK OVER. STILL POINTING TRUE.'],
  'out-of-fuel': ['TANK EMPTY. I CAN NO LONGER STEER.'],
  'prime-complete': ['PRIMARY MISSION COMPLETE. ALL MY SCIENCE IS ON ITS WAY.'],
  'last-words': ['MY BATTERY IS LOW AND IT’S GETTING DARK.'],
  'order-received': ['ORDER RECEIVED. {option}. DONE.'],
  'acted-alone': ['NO ORDER CAME IN TIME. I CHOSE {option}.'],
  'order-too-late': ['YOUR ORDER CAME TOO LATE. I HAD ALREADY ACTED.'],
  'science-milestone': ['{pct} OF THE SCIENCE GOAL SENT HOME.'],
  extension: ['EXTENSION ORDER RECEIVED. {years} MORE. STILL HERE.'],
  'signing-off': ['{name} SIGNING OFF. THANK YOU, EARTH.'],
};

/** Lines with a different shape for some values: a burn on arrival, plans and standing orders, a full goal. */
export const VOICE_ALT = {
  arrivedBurn: 'ENGINE FIRED: {dv} OFF MY SPEED, {burned} OF FUEL. {dest} CAUGHT ME.',
  plan: 'ORDER RECEIVED. NEW POWER PLAN LOADED.',
  standing: 'ORDER RECEIVED. NEW STANDING ORDERS STORED.',
  standingChoice: 'NO NEW ORDER. FOLLOWING YOUR STANDING ORDER: {option}.',
  goalMet: 'SCIENCE GOAL MET. EVERYTHING I CAME FOR IS SENT HOME.',
  hitUnknown: 'TROUBLE UP HERE. SOMETHING JUST WENT WRONG.',
};

/** Routine status (VOICE_RULES.statusEvery_days): on the way, at the destination, and on the way home. */
export const STATUS_VOICE: Record<'cruise' | 'orbit' | 'home', string[]> = {
  cruise: ['CRUISE NOMINAL. {days} DAYS TO {dest}. {fuel} OF FUEL LEFT.', 'ALL QUIET. {dist} FROM EARTH. HOLDING COURSE.', 'STAR TRACKER LOCKED. {days} DAYS TO {dest}.'],
  orbit: ['ORBIT NOMINAL. {data} SENT HOME SO FAR.', 'ALL QUIET. MAPPING. {fuel} OF FUEL LEFT.', 'HEATERS CYCLING. {dist} FROM EARTH. HOLDING.'],
  home: ['HEADING HOME. ALL QUIET. {dist} FROM EARTH.'],
};

const HIT_VOICE: Record<string, string[]> = {
  'solar-storm': ['STORM HERE. PARTICLES HITTING MY PANELS.', 'ANOTHER SOLAR STORM. I CAN FEEL IT IN MY CIRCUITS.'],
  'cme-shock': ['THE CME HIT. AURORA BELOW ME.', 'SHOCK WAVE FROM THE SUN. EVERYTHING IS RATTLING.'],
  'mars-dust-storm': ['DUST STORM BELOW. THE AIR IS PUFFING UP TOWARD MY ORBIT.'],
  debris: ['SOMETHING TINY JUST WENT PAST ME. FAST.'],
  'reaction-wheel': ['ONE OF MY WHEELS IS GRINDING.'],
  'memory-corruption': ['MEMORY ERRORS. RUNNING CHECKS.'],
  'radiation-damage': ['HEAVY RADIATION AROUND {dest}. CIRCUITS TINGLING.'],
};

/** What a line needs besides the message: names, and how to say an option and a hazard. */
export interface VoiceContext {
  dest: string;
  name: string;
  option?: (hazardType: string, optionId: string) => string;
  hazard?: (hazardType: string) => string;
}

const years = (n: number) => `${f.num(n)} ${n === 1 ? 'YEAR' : 'YEARS'}`;

/** What the robot says, in its own words (uppercase telemetry). Every number is the message's, only formatted. */
export function robotSays(m: RobotMessage, ctx: VoiceContext): string {
  const v = m.values;
  const pick = (lines: string[]) => lines[m.seq % lines.length]!;
  const type = v.hazardType ?? '';
  const slots: Record<string, string> = {
    dest: ctx.dest.toUpperCase(),
    name: ctx.name.toUpperCase(),
    option: v.optionId ? (ctx.option ? ctx.option(type, v.optionId) : v.optionId.toUpperCase()) : '',
    hazard: type ? (ctx.hazard ? ctx.hazard(type) : type).toUpperCase() : '',
    ...(v.daysToArrival !== undefined ? { days: f.num(v.daysToArrival) } : {}),
    ...(v.earthDistance_m !== undefined ? { dist: f.millionKm(v.earthDistance_m).toUpperCase() } : {}),
    ...(v.propellantLeft_kg !== undefined ? { fuel: f.kg(v.propellantLeft_kg).toUpperCase() } : {}),
    ...(v.downlinked_bits !== undefined ? { data: f.bits(v.downlinked_bits).toUpperCase() } : {}),
    ...(v.dv_ms !== undefined ? { dv: f.speed(v.dv_ms).toUpperCase() } : {}),
    ...(v.propellant_kg !== undefined ? { burned: f.kg(v.propellant_kg).toUpperCase() } : {}),
    ...(v.longestEclipse_s !== undefined ? { dark: f.minutes(v.longestEclipse_s).toUpperCase() } : {}),
    ...(v.fraction !== undefined ? { pct: f.pct(v.fraction, 0) } : {}),
    ...(v.years !== undefined ? { years: years(v.years) } : {}),
  };
  let t: string;
  if (m.kind === 'hit') t = pick(HIT_VOICE[type] ?? [VOICE_ALT.hitUnknown]);
  else if (m.kind === 'status') {
    const where = v.phase === 'cruise' || v.phase === 'launch' ? 'cruise' : v.phase === 'return' ? 'home' : 'orbit';
    t = pick(STATUS_VOICE[where]);
  } else if (m.kind === 'arrived' && v.dv_ms !== undefined) t = VOICE_ALT.arrivedBurn;
  else if (m.kind === 'order-received' && v.commandKind === 'power-plan') t = VOICE_ALT.plan;
  else if (m.kind === 'order-received' && v.commandKind === 'standing-orders') t = VOICE_ALT.standing;
  else if (m.kind === 'acted-alone' && v.by === 'standing-order') t = VOICE_ALT.standingChoice;
  else if (m.kind === 'science-milestone' && (v.fraction ?? 0) >= 1) t = VOICE_ALT.goalMet;
  else t = pick(VOICE[m.kind]);
  return fill(t, slots);
}

/** The TRANSMISSIONS teletype (Fly & Survive), the robot's reply to an order, and the reply's trip home. */
export const TX_WORDS = {
  kicker: (name: string) => `TELETYPE 02 · ${name} ⇄ EARTH`,
  title: 'TRANSMISSIONS',
  keyRobot: (name: string) => `BLACK · ${name}`,
  keyYou: 'RED · YOU',
  fromEarth: (name: string) => `EARTH ▸ ${name}`,
  day: (day: string) => `DAY ${day}`,
  took: (delay: string) => `TOOK ${delay}`,
  /** On the pad there is no light time yet. */
  noDelay: 'NO DELAY · ON THE PAD',
  reply: 'REPLY',
  queued: (t: string) => `TEAM WRITING · LEAVES IN ${t}`,
  inFlight: (t: string) => `IN FLIGHT · ${t}`,
  replyInbound: 'DELIVERED · REPLY INBOUND',
  delivered: 'DELIVERED',
  tooLate: 'TOO LATE',
  order: (what: string) => `ORDER: ${what}.`,
  plan: 'NEW POWER PLAN',
  standing: 'NEW STANDING ORDERS',
  extend: (years: string) => `KEEP FLYING ${years}`,
  /** Footer: "Everything PIP says is 12 MINUTES old by the time it prints here." */
  footBefore: (name: string) => `Everything ${name} says is `,
  footAge: (age: string) => `${age} old`,
  footAfter: ' by the time it prints here.',
  empty: 'NOTHING YET. THE ROBOT IS STILL ON THE PAD.',
  log: '▾ LOG',
  close: '▴ CLOSE',
  logLabel: 'Transmissions log',
  replyFrom: (name: string, delay: string) => `REPLY FROM ${name} · TOOK ${delay}`,
  roundTrip: (t: string) => `YOUR ORDER WENT THERE AND BACK: ${t}`,
  roundTripEng: (t: string, name: string) => `ROUND TRIP 2t = ${t} · EARTH → ${name} → EARTH`,
  heard: (name: string) => `${name} HEARD YOU. REPLY ON ITS WAY`,
  replyReaches: 'REPLY REACHES EARTH IN',
  alreadyActed: 'IT HAS ALREADY ACTED. YOU JUST CAN’T SEE IT YET',
};

// ---------------------------------------------------------------------------
// Big moments and sound

export const SOUND_WORDS = { on: 'Sound on', off: 'Sound off' };

export const MOMENT_WORDS = {
  countdownK: 'LAUNCH IN',
  count: (n: number) => `T−${f.num(n)}`,
  liftoff: 'LIFTOFF!',
  skip: 'SKIP ▸',
  arrived: (dest: string, asteroid: boolean) => (asteroid ? `ARRIVED AT ${dest}!` : `IN ORBIT AT ${dest}!`),
  arrivedSub: (name: string) => `${name} FIRED ITS ENGINE AND WAS CAUGHT BY GRAVITY.`,
  arrivedSubBennu: (name: string) => `${name} SLOWED DOWN TO FLY BESIDE THE ASTEROID.`,
  storm: 'SOLAR STORM HIT!',
  stormSub: (name: string) => `PARTICLES FROM THE SUN ARE HITTING ${name}.`,
  launchFailed: 'LAUNCH FAILED',
};

// ---------------------------------------------------------------------------
// Postcards from space

export const POSTCARD_WORDS = {
  menu: 'POSTCARDS',
  menuSub: 'Real NASA pictures your robots sent home.',
  title: 'POSTCARDS FROM SPACE',
  sub: 'Real pictures from NASA missions. Your robot sends one home as its science reaches Earth.',
  toast: (dest: string) => `📮 POSTCARD FROM ${dest}!`,
  look: 'TAP TO LOOK',
  keep: 'KEEP FLYING ▸',
  close: 'CLOSE',
  credit: (c: string) => `IMAGE: ${c}`,
  report: 'POSTCARDS FROM THIS FLIGHT',
  none: 'No postcards this time: no science reached Earth.',
  locked: 'LOCKED',
  /** How a locked card is earned, from its unlock share (0 = first data, 1 = the whole goal). */
  hint: (dest: string, share: number) =>
    share <= 0 ? `Fly to ${dest} and send home your first science.` : share >= 1 ? `Send home all the science from ${dest}.` : `Send home half the science from ${dest}.`,
};

// ---------------------------------------------------------------------------
// Ranks and badges (engine ranks.ts)

export const RANK_WORDS: Record<string, string> = {
  cadet: 'CADET',
  'flight-controller': 'FLIGHT CONTROLLER',
  capcom: 'CAPCOM',
  'flight-director': 'FLIGHT DIRECTOR',
  'mission-legend': 'MISSION LEGEND',
};

export const CREW_WORDS = {
  title: 'CREW FILE',
  rank: 'YOUR RANK',
  toNext: (n: number, next: string) => `${f.num(n)}★ TO ${next}`,
  top: 'TOP RANK',
  stars: (n: number, max: number) => `${f.num(n)} OF ${f.num(max)} STARS`,
  badges: 'BADGES',
  open: 'Open your crew file',
  close: 'CLOSE',
  realJob: 'THE REAL JOB',
  promoted: 'PROMOTED!',
  newBadge: 'NEW BADGE',
  earned: 'EARNED',
  locked: 'NOT YET',
};

export const BADGE_WORDS: Record<string, { name: string; how: string }> = {
  'first-flight': { name: 'FIRST FLIGHT', how: 'Earn a star on any mission.' },
  'storm-survivor': { name: 'STORM SURVIVOR', how: 'Fly through a solar storm without losing an instrument.' },
  'through-the-sun': { name: 'THROUGH THE SUN', how: 'Keep flying while the Sun blocks your radio (a solar conjunction).' },
  'night-shift': { name: 'NIGHT SHIFT', how: 'Get through a whole eclipse season with no brownout.' },
  'bonus-time': { name: 'BONUS TIME', how: 'Ask for a mission extension at the end of a flight.' },
  'sample-home': { name: 'SAMPLE HOME', how: 'Bring a piece of asteroid Bennu back to Earth.' },
  shutterbug: { name: 'SHUTTERBUG', how: 'Collect all the postcards from one place.' },
  'daily-streak': { name: 'DAILY STREAK', how: 'Play the Daily mission three days in a row.' },
  rescuer: { name: 'RESCUER', how: 'Save a robot in Rescue History.' },
  'big-thinker': { name: 'BIG THINKER', how: 'Find out why no rocket flies straight to Jupiter.' },
};
