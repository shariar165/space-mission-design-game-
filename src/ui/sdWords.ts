// Words for the Signal Delay screens (design: docs/design/signal-delay). Numbers come from the engine and are only
// formatted here, through format.ts. Cadet reads short uppercase lines; Engineer adds the numbers.
import type { FailureEffect, OpsPhase } from '../engine/data';
import type { ComingUpKind, ConsoleOutcome, FlyChip } from '../engine/ops/index';
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
