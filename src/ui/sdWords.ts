// Words for the Signal Delay screens (design: docs/design/signal-delay). Numbers come from the engine and are only
// formatted here, through format.ts. Cadet reads short uppercase lines; Engineer adds the numbers.
import type { FailureEffect, OpsPhase } from '../engine/data';
import type { ComingUpKind, ConsoleOutcome, FlyChip, RobotMessage, VoiceKind } from '../engine/ops/index';
import type { DeckCard, PackBlockerCode, PartId } from '../engine/pack';
import type { Hurt, ReportPanel, Saved } from '../engine/ops/report';
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
  'solar-storm': { title: 'SOLAR STORM', short: 'STORM', line: 'The Sun spits particles that fry electronics.', icon: 'storm' },
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

export const REPORT_STAMP: Record<'complete' | 'lost' | 'not-launched', { word: string[]; color: string }> = {
  complete: { word: ['MISSION', 'COMPLETE'], color: 'var(--sd-ok)' },
  lost: { word: ['ROBOT', 'LOST'], color: 'var(--sd-red)' },
  'not-launched': { word: ['NOT', 'LAUNCHED'], color: 'var(--sd-red)' },
};

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
  { icon: 'star', title: 'REACH THE END', body: 'When the mission ends you get your report and stars. In a hurry? FINISH MISSION lets the robot fly the rest.' },
];

export const HOW_TO_PLAY = { label: 'HOW TO PLAY', sub: 'New here? Learn the game in one minute.' };

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
  you: 'YOU',
};

/** The log line while a solar storm crosses space toward the robot, and while it hits. */
export const stormLine = (phase: 'coming' | 'hitting', name: string, hitsIn: string) =>
  phase === 'coming' ? `THE SUN ERUPTED. A SOLAR STORM HITS ${name} IN ${hitsIn}.` : `SOLAR STORM ON ${name}. PARTICLES EVERYWHERE.`;

// ---------------------------------------------------------------------------
// The robot's voice. It reports in the first person; every line reached Earth one light time after it was sent.

/** Names the 🎲 button cycles through on Pack (the first is the default). */
export const ROBOT_NAMES = ['PIP', 'NOVA', 'ZIPPY', 'BOLT', 'COMET', 'SPARKY', 'ORBIT', 'BEEP', 'ASTRO', 'DOT', 'RUSTY', 'TWINKLE'];
/** Longest robot name (letters), so it fits over the robot on the map. */
export const ROBOT_NAME_MAX = 10;

/** A typed name made safe for the map: capitals, letters, digits, spaces and dashes, at most ROBOT_NAME_MAX. */
export const cleanRobotName = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, ROBOT_NAME_MAX);

/** The name to show: the player's, or the default when the field was left empty. */
export const robotNameOr = (name: string | undefined) => (name && name.trim() ? name.trim() : ROBOT_NAMES[0]!);

/** The next suggestion after the current name. */
export const nextRobotName = (name: string) => ROBOT_NAMES[(ROBOT_NAMES.indexOf(name) + 1) % ROBOT_NAMES.length]!;

export const ROBOT_WORDS = {
  nameLabel: 'YOUR ROBOT’S NAME',
  suggest: 'Suggest a name',
  radio: (name: string) => `${name} SAYS`,
  took: (dest: string, delay: string) => `FROM ${dest} · TOOK ${delay} TO REACH YOU`,
  lastMessage: (name: string) => `LAST MESSAGE FROM ${name}`,
};

type Line = (dest: string) => string;
const HIT_LINES: Record<string, Line[]> = {
  'solar-storm': [() => 'Storm’s here! Particles are pinging off my panels!', () => 'Another solar storm. I can feel it in my circuits.'],
  'mars-dust-storm': [() => 'Dust storm below! The air is puffing up toward my orbit.'],
  debris: [() => 'Whoa! Something tiny just went whizzing past me!'],
  'reaction-wheel': [() => 'One of my spinning wheels is grinding. Ouch.'],
  'memory-corruption': [() => 'My memory feels… scrambled. Running checks.'],
  'radiation-damage': [(d) => `So much radiation around ${d}. My circuits are tingling.`],
};

const VOICE: Record<Exclude<VoiceKind, 'hit'>, Line[]> = {
  launch: [(d) => `Liftoff! I can feel the rocket shaking. Next stop: ${d}!`],
  'launch-failed': [() => 'The rocket… didn’t make it. I never left the ground.'],
  halfway: [(d) => `Halfway to ${d}! Earth looks like a tiny blue dot from here.`],
  arrived: [(d) => `I made it to ${d}! Firing my engine to slow down…`],
  science: [(d) => `Instruments on. ${d} looks amazing from up here!`],
  'heading-home': [() => 'Sample on board. Turning around… I’m coming home!'],
  'bonus-time': [() => 'Bonus time! Thanks for keeping me flying.'],
  dark: [
    (d) => `It’s getting dark. ${d} is blocking the Sun, so I’m running on battery.`,
    () => 'Shadow season again. Battery on, heaters down a bit.',
    () => 'Dark again. I know the drill by now.',
  ],
  conjunction: [() => 'The Sun is right between us. I can’t hear you for a while. See you on the other side!'],
  'conjunction-end': [() => 'I can hear you again! Did you miss me?'],
  saved: [() => 'That worked! Thanks for the quick thinking.', () => 'Phew. Your order got here just in time.', () => 'All good up here. Nice call, Mission Control!'],
  hurt: [() => 'That didn’t go well. I’m hurt, but I’m still flying.', () => 'Ow. Something broke. I’ll keep going as best I can.'],
  'instrument-lost': [() => 'I lost one of my instruments. I’ll do what I can with the rest.'],
  'safe-mode': [() => 'I switched to safe mode to protect myself. Waiting for your orders…'],
  brownout: [() => 'Not enough power! I’m switching things off to stay alive.'],
  'wheel-spare': [() => 'A wheel gave up, but my spare took over. Still pointing straight!'],
  'out-of-fuel': [() => 'My tank is empty. I can’t steer any more.'],
  'prime-complete': [() => 'Mission done! All my science is on its way to you.'],
  'last-words': [() => 'My battery is low… and it’s getting dark. Goodbye, Mission Control.'],
};

/** What the robot says, in its own words. */
export function robotSays(m: RobotMessage, destName: string): string {
  const lines = m.kind === 'hit' ? (HIT_LINES[m.values.hazardType ?? ''] ?? [() => 'Trouble up here! Something just went wrong.']) : VOICE[m.kind];
  return lines[m.seq % lines.length]!(destName);
}

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
