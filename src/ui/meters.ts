// How each engine Meter is shown: title, what "used / limit" mean, and the Cadet one-liner.
// Every number is read from evaluateDesign()'s output; this file only chooses words and units.
import type { MeterKey } from '../engine/compare';
import { GAME_RULES } from '../engine/constants';
import { DESTINATIONS, LAUNCH_VEHICLES } from '../engine/data';
import type { FullEvaluation } from '../engine/index';
import { COST_CAPS } from '../engine/massCost';
import type { Design, Meter } from '../engine/types';
import * as f from './format';

export interface MeterView {
  title: string;
  sub: string;
  used: string;
  limit: string;
  /** Short value for the compact (mobile) card. */
  say: string;
}

export const METER_TITLES: Record<MeterKey, string> = {
  mass: 'Mass',
  power: 'Power',
  deltaV: 'Δv',
  data: 'Data',
  cost: 'Cost',
  risk: 'Risk',
};

const perDay = (b: number) => `${f.bits(b)}/day`;

export function meterView(key: MeterKey, m: Meter, ev: FullEvaluation, design: Design): MeterView {
  const dest = DESTINATIONS[design.destination];
  const lv = LAUNCH_VEHICLES[design.launchVehicleId];
  const lvName = lv?.name ?? design.launchVehicleId;
  switch (key) {
    case 'mass':
      return {
        title: 'Mass',
        sub: 'vs launch capacity',
        used: f.num(m.used),
        limit: f.kg(m.limit),
        say:
          m.status === 'over'
            ? `Too heavy: ${f.kg(-m.headroom)} more than the ${lvName} can send at C3 ${f.c3(ev.trajectory.c3)}.`
            : `The ${lvName} can lift ${f.kg(m.headroom)} more at this launch energy.`,
      };
    case 'power': {
      const rtg = design.power.type === 'rtg';
      const sun = dest.sunlightVsEarth.value;
      return {
        title: 'Power',
        sub: 'needed vs made',
        used: f.num(m.used),
        limit: f.watts(m.limit),
        say:
          m.status === 'over'
            ? `Short by ${f.watts(-m.headroom)} on arrival at ${dest.name}.`
            : rtg
              ? `RTGs make the same power at any distance from the Sun.`
              : `At ${dest.name} your panels get ${f.pct(sun, 1)} of the sunlight they get at Earth.`,
      };
    }
    case 'deltaV':
      return {
        title: 'Δv',
        sub: 'need vs have',
        used: f.num(m.used),
        limit: f.speed(m.limit),
        say:
          m.status === 'over'
            ? `Not enough propellant: ${f.speed(-m.headroom)} short of what the mission needs.`
            : m.status === 'warning'
              ? `Just enough propellant. One bad burn could cost you the orbit.`
              : `Enough propellant for every burn, with ${f.speed(m.headroom)} to spare.`,
      };
    case 'data':
      return {
        title: 'Data',
        sub: 'made vs sent home',
        used: f.bits(m.used),
        limit: perDay(m.limit),
        say:
          m.status === 'ok'
            ? `Every bit of science gets home, with room to spare.`
            : m.status === 'warning'
              ? `The radio barely keeps up with the instruments.`
              : `The radio cannot send home everything the instruments make.`,
      };
    case 'cost': {
      const cls = design.missionClass ?? 'discovery';
      const cap = COST_CAPS[cls];
      const className = cls === 'discovery' ? 'Discovery' : 'New Frontiers';
      return {
        title: 'Cost',
        sub: `vs ${className} cap`,
        used: f.money(m.used),
        limit: `${f.money(m.limit)} ${f.fiscalYear(cap.unit)}`.trim(),
        say:
          m.status === 'over'
            ? `${f.money(-m.headroom)} over the cap. Something has to go.`
            : `${f.money(m.headroom)} under the cap. Launch and operations are paid separately.`,
      };
    }
    case 'risk':
      return {
        title: 'Risk',
        sub: 'chance of losing the mission',
        used: f.pct(m.used),
        limit: `${f.pct(m.limit, 0)} max`,
        say: `A ${f.pct(m.used, 0)} chance of losing the mission, from launch to the end of science.`,
      };
  }
}

/** Fill fraction of a meter bar: the bar spans 0 … 1.25 × limit and the limit mark sits at 80%. Layout only. */
export function barGeometry(m: Meter): { fill: number; limitAt: number } {
  const span = 1.25 * Math.max(m.limit, 1e-12);
  return { fill: Math.max(0, Math.min(1, m.used / span)), limitAt: 0.8 };
}

/** One sentence for a meter in WARNING, used in the blockers panel. */
export function warningText(key: MeterKey, m: Meter): string {
  return `${METER_TITLES[key]} margin is only ${f.signedPct(m.margin)}. You can fly, but you are below the ${f.pct(GAME_RULES.marginWarning.value, 0)} safety margin.`;
}
