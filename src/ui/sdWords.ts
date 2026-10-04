// Words for the Signal Delay screens (design: docs/design/signal-delay). Numbers come from the engine and are only
// formatted here, through format.ts. Cadet reads short uppercase lines; Engineer adds the numbers.
import type { FailureEffect, OpsPhase } from '../engine/data';
import type { ComingUpKind, ConsoleOutcome, FlyChip } from '../engine/ops/index';
import type { DeckCard, PackBlockerCode, PartId } from '../engine/pack';
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
