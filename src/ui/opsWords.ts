// Words for the Operations Console (Cadet and Engineer). Numbers come from the engine (ops/console.ts) and are
// only formatted here, through format.ts. Event messages arrive as codes with values (spec: messages are data).
import type { ConsoleChip, ConsoleGauges, SignalState } from '../engine/ops/console';
import type { FailureEffect, OpsPhase } from '../engine/data';
import type { ResponseBlocker } from '../engine/ops/responses';
import type { ExtensionOption, OpsEvent } from '../engine/ops/types';
import type { MeterStatus } from '../engine/types';
import * as f from './format';

export const OPS_PHASE: Record<OpsPhase, string> = {
  launch: 'Launch',
  cruise: 'Cruise',
  arrival: 'Arrival',
  science: 'Science orbit',
  return: 'Trip home',
  extended: 'Extended mission',
};

export const CHIP: Record<ConsoleChip, { label: string; tone: MeterStatus }> = {
  nominal: { label: 'ALL SYSTEMS GO', tone: 'ok' },
  hazard: { label: 'HAZARD · DECISION', tone: 'over' },
  'safe-mode': { label: 'SAFE MODE', tone: 'warning' },
  'conjunction-soon': { label: 'CONJUNCTION AHEAD', tone: 'warning' },
  blackout: { label: 'NO CONTACT', tone: 'over' },
  decision: { label: 'DECISION', tone: 'warning' },
  lost: { label: 'CRAFT LOST', tone: 'over' },
  complete: { label: 'MISSION COMPLETE', tone: 'ok' },
  'not-launched': { label: 'NOT LAUNCHED', tone: 'over' },
};

export const STATUS_LABEL: Record<MeterStatus, string> = { ok: 'OK', warning: 'WARNING', over: 'OVER LIMIT' };

export type GaugeKey = keyof ConsoleGauges;
export const GAUGE_NAME: Record<GaugeKey, { cadet: string; engineer: string }> = {
  power: { cadet: 'Battery', engineer: 'Power today' },
  fuel: { cadet: 'Fuel tank', engineer: 'Δv left' },
  recorder: { cadet: 'Photos waiting', engineer: 'Recorder' },
  budget: { cadet: 'Ops budget', engineer: 'Budget reserve' },
};

/** The Cadet sentence under each gauge. */
export function gaugeLine(k: GaugeKey, g: ConsoleGauges, destName: string): string {
  switch (k) {
    case 'power': {
      const p = g.power;
      if (p.status === 'over') return 'Not enough power today: the craft is switching things off.';
      if (p.status === 'warning') return 'Very little power to spare today.';
      if (p.inEclipseSeason) return `Healthy. Recharges after every trip through ${destName}’s shadow.`;
      return 'Full sunshine. Plenty of power today.';
    }
    case 'fuel': {
      const x = g.fuel;
      if (x.status === 'over') return 'Not enough fuel for the burns still planned!';
      if (x.status === 'warning') return 'Enough for the burns ahead, with only a thin cushion left.';
      return 'Enough for every burn still planned, with fuel to spare.';
    }
    case 'recorder': {
      const r = g.recorder;
      if (r.status === 'over') return 'Memory is full: new photos are being lost.';
      if (r.daysToFull !== undefined && r.status === 'warning') return `Memory is full in about ${f.num(r.daysToFull)} days. Send photos home or slow the science.`;
      if (r.photosWaiting < 1) return 'Everything is home.';
      return `About ${f.photos(r.photosWaiting)} photos waiting to go home.`;
    }
    case 'budget': {
      const b = g.budget;
      if (b.status === 'over') return 'Over budget: extra calls and fixes cost more than the reserve.';
      if (b.status === 'warning') return 'The reserve is nearly spent.';
      return 'Reserve for extra calls home and for fixing problems.';
    }
  }
}

export const SIGNAL_LINE: Record<SignalState, string> = {
  downlink: 'Photos and news travelling home',
  uplink: 'Your command is on its way',
  blocked: 'The Sun blocks the radio',
  none: 'Radio silent',
};

export const BLOCKER: Record<ResponseBlocker, string> = {
  deltaV: 'Not enough fuel to spare',
  budget: 'Not enough money left in the reserve',
  scienceDays: 'Not enough science days left',
  power: 'Not enough spare power today',
  'one-time': 'Already used once this mission',
};

export const FAILURE_EFFECT: Record<FailureEffect, string> = {
  craft: 'the craft could be lost',
  instrument: 'an instrument could break',
  'stored-data': 'the photos on board could be wiped',
  'safe-mode': 'the craft could drop into safe mode',
};

export const RISK_WORD = ['', 'VERY LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY HIGH'] as const;

/** A friendlier Cadet line for a response, where the data label is technical. */
export const OPTION_BLURB: Record<string, string> = {
  'solar-storm.shelter': 'Switch the instruments off and wait it out.',
  'solar-storm.keep-observing': 'Measure the storm up close. An instrument might be damaged.',
  'cme-shock.safe-mode': 'Shut down to the basics until the shock has passed.',
  'cme-shock.keep-observing': 'Watch the shock hit Mars, as MAVEN did. An instrument might be damaged.',
  'mars-dust-storm.raise-periapsis': 'Burn a little fuel to stay above the swelling air.',
  'mars-dust-storm.wait-it-out': 'Stop taking pictures until the dust settles.',
  'mars-dust-storm.carry-on': 'Keep flying as planned and hope the air stays thin.',
  'debris.hide': 'Time the orbit so the planet shields you.',
  'debris.edge-on': 'Turn the panels edge-on and close the instruments.',
  'debris.ignore': 'Do nothing and hope nothing hits.',
  'reaction-wheel.thrusters': 'Point with the thrusters: costs fuel.',
  'reaction-wheel.hybrid': 'Learn to point with the wheels that are left.',
  'reaction-wheel.carry-on': 'Keep going on the remaining wheels.',
  'memory-corruption.backup-computer': 'Switch to the spare computer (once only).',
  'memory-corruption.patch': 'Engineers write a fix and send it up.',
  'memory-corruption.reboot': 'Turn it off and on again.',
  'insertion-anomaly.trim-burn': 'Fire the thrusters to finish the capture.',
  'insertion-anomaly.accept-orbit': 'Keep the longer orbit and change the science plan.',
  'insertion-anomaly.hold': 'Let the craft look after itself.',
};

export const EXTENSION_BLOCKER: Record<ExtensionOption['blockedBy'][number], string> = {
  deltaV: 'Not enough fuel for the orbit trims',
  power: 'Not enough power at the end',
  radiation: 'The electronics would take too much radiation',
  attitude: 'The craft can no longer point properly',
  'science-review': 'NASA review: not enough science sent home yet',
};

export const COMMAND_KIND: Record<'power-plan' | 'respond' | 'standing-orders', string> = {
  'power-plan': 'New power plan',
  respond: 'Hazard response',
  'standing-orders': 'New standing orders',
};

/** One line for the event feed. */
export function eventLine(e: OpsEvent, ctx: { destName: string; optionLabel: (hazardId: string, optionId: string) => string }): string | undefined {
  const v = e.values;
  switch (e.code) {
    case 'launch':
      return 'Launch! Your craft is on its way.';
    case 'launch-failed':
      return 'The rocket failed on launch day.';
    case 'phase-start':
      return `${OPS_PHASE[v.phase as OpsPhase] ?? 'A new phase'} begins.`;
    case 'burn':
      return v.kind === 'maintenance' ? undefined : `Engine burn: ${f.speed(Number(v.dv_ms))}.`;
    case 'conjunction-start':
      return 'Solar conjunction: no radio contact until the Sun moves away.';
    case 'conjunction-end':
      return 'Contact is back after the conjunction.';
    case 'eclipse-season-start':
      return `Eclipse season: the craft passes through ${ctx.destName}’s shadow every orbit.`;
    case 'eclipse-season-end':
      return 'Eclipse season over: full sunshine again.';
    case 'hazard-warning':
      return 'Warning: something is heading for your craft.';
    case 'decision-open':
      return v.decisionId === 'extension' ? 'Prime mission complete: time to decide what comes next.' : 'A decision is waiting for you.';
    case 'command-sent':
      return 'Command sent: now it crosses space at the speed of light.';
    case 'command-refused':
      return v.reason === 'conjunction' ? `Command refused: no contact until day ${f.num(Number(v.retryAfterDay))}.` : 'Command refused.';
    case 'command-executed':
      return v.optionId ? `Craft carried out: ${ctx.optionLabel(String(v.hazardId), String(v.optionId))}.` : 'Craft carried out your command.';
    case 'command-too-late':
      return 'Your command arrived too late.';
    case 'deadline-missed':
      return v.by === 'standing-order' ? 'No command in time: the craft followed its standing order.' : 'No command in time: fault protection chose for you.';
    case 'response-outcome':
      return v.bad ? 'It went wrong.' : 'It worked.';
    case 'instrument-lost':
      return 'An instrument has stopped working.';
    case 'stored-data-lost':
      return `Stored data lost: ${f.bits(Number(v.bits))}.`;
    case 'safe-mode':
      return `Safe mode until day ${f.num(Math.floor(Number(v.until)))}.`;
    case 'load-shed':
      return 'Not enough power: the craft switched loads off.';
    case 'brownout':
      return 'Brownout: the craft’s computer lost power!';
    case 'dsn-booked':
      return `Call home booked: ${f.num(Number(v.dish))} m dish.`;
    case 'dsn-refused':
      return 'Booking refused.';
    case 'craft-lost':
      return 'Contact lost. The craft is gone.';
    case 'prime-complete':
      return 'Prime mission complete!';
    case 'extension-decided':
      return Number(v.years) > 0 ? 'Mission extended.' : 'The mission is retiring with honour.';
    case 'mission-complete':
      return 'Mission complete.';
    case 'out-of-propellant':
      return 'Out of fuel for a planned burn.';
    case 'wheel-spare-took-over':
      return 'A reaction wheel failed; the spare took over.';
    default:
      return undefined;
  }
}
