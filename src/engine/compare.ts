// Comparisons the UI shows, computed here so the UI does no arithmetic:
// - designDelta: what changing one part does (catalogue cards: "+46 kg, +$7M, fixes nothing on cost").
// - compareWithRealMission: the Debrief's "Your design vs MAVEN", both through the same evaluateDesign.
//   Mass, power and Δv only: published cost figures use a different accounting basis (spec: MAVEN cost).
import { evaluateDesign, type FullEvaluation } from './index';
import { missionPreset, presetDesign, type MissionId } from './missions';
import { sourced, type Design, type DestinationId, type MeterStatus, type Sourced } from './types';

export type MeterKey = 'mass' | 'power' | 'deltaV' | 'data' | 'cost' | 'risk';
export const METER_KEYS: MeterKey[] = ['mass', 'power', 'deltaV', 'data', 'cost', 'risk'];

export interface DesignDelta {
  wetMass_kg: number;
  dryMass_kg: number;
  developmentCost_M: number;
  powerAvailable_W: number;
  powerRequired_W: number;
  deltaVCapability_ms: number;
  meters: Record<MeterKey, { marginBefore: number; marginAfter: number; statusBefore: MeterStatus; statusAfter: MeterStatus }>;
  /** Meters whose status gets better or worse with the change. */
  fixes: MeterKey[];
  breaks: MeterKey[];
  blockersAdded: string[];
  blockersRemoved: string[];
}

const RANK: Record<MeterStatus, number> = { ok: 0, warning: 1, over: 2 };

/** candidate − base for the numbers a part card shows. Pass baseEv to avoid evaluating the base again. */
export function designDelta(base: Design, candidate: Design, baseEv: FullEvaluation = evaluateDesign(base)): DesignDelta {
  const a = baseEv;
  const b = evaluateDesign(candidate);
  const meters = {} as DesignDelta['meters'];
  const fixes: MeterKey[] = [];
  const breaks: MeterKey[] = [];
  for (const k of METER_KEYS) {
    const before = a.meters[k];
    const after = b.meters[k];
    meters[k] = { marginBefore: before.margin, marginAfter: after.margin, statusBefore: before.status, statusAfter: after.status };
    if (RANK[after.status] < RANK[before.status]) fixes.push(k);
    if (RANK[after.status] > RANK[before.status]) breaks.push(k);
  }
  return {
    wetMass_kg: b.details.wetMass_kg - a.details.wetMass_kg,
    dryMass_kg: b.details.dryMass_kg - a.details.dryMass_kg,
    developmentCost_M: b.details.cost.development_M - a.details.cost.development_M,
    powerAvailable_W: b.details.power.available_W - a.details.power.available_W,
    powerRequired_W: b.details.power.required_W - a.details.power.required_W,
    deltaVCapability_ms: b.details.deltaVCapability_ms - a.details.deltaVCapability_ms,
    meters,
    fixes,
    breaks,
    blockersAdded: b.blockers.filter((x) => !a.blockers.includes(x)),
    blockersRemoved: a.blockers.filter((x) => !b.blockers.includes(x)),
  };
}

/** The real mission each destination is compared with (none yet for the Moon, Venus and Jupiter). */
export const REAL_MISSION_FOR: Partial<Record<DestinationId, MissionId>> = { mars: 'maven', bennu: 'osiris-rex' };

export type CompareMetric = 'wetMass' | 'dryMass' | 'propellant' | 'powerAtArrival' | 'deltaVCapability';

export interface CompareRow {
  metric: CompareMetric;
  unit: string;
  you: number;
  them: number;
  /** (you − them) / them */
  relDiff: number;
  /** Where the real mission's number comes from (ⓘ). */
  themSource: Sourced<number>;
}

export interface RealMissionComparison {
  missionId: MissionId;
  label: string;
  history: string;
  historyUrl?: string;
  rows: CompareRow[];
  /** Row with the largest |relDiff|. */
  biggestGap: CompareMetric;
}

const computed = (value: number, unit: string, what: string) =>
  sourced(value, unit, `Computed by the engine from the published preset: ${what}`);

export function compareWithRealMission(design: Design, ev: FullEvaluation = evaluateDesign(design)): RealMissionComparison | undefined {
  const id = REAL_MISSION_FOR[design.destination];
  if (!id) return undefined;
  const preset = missionPreset(id);
  const realDesign = presetDesign(id);
  const real = evaluateDesign(realDesign);
  const row = (metric: CompareMetric, unit: string, you: number, them: number, themSource: Sourced<number>): CompareRow => ({
    metric,
    unit,
    you,
    them,
    relDiff: (you - them) / them,
    themSource,
  });
  const rows: CompareRow[] = [
    row('wetMass', 'kg', ev.details.wetMass_kg, real.details.wetMass_kg, computed(real.details.wetMass_kg, 'kg', 'm_dry + m_prop')),
    row(
      'dryMass',
      'kg',
      ev.details.dryMass_kg,
      real.details.dryMass_kg,
      realDesign.asFlownDryMass_kg ?? computed(real.details.dryMass_kg, 'kg', 'mass roll-up'),
    ),
    row('propellant', 'kg', ev.details.propellant_kg, real.details.propellant_kg, preset.design.propellant_kg),
    row(
      'powerAtArrival',
      'W',
      ev.details.power.available_W,
      real.details.power.available_W,
      computed(real.details.power.available_W, 'W', 'P = S₀ (1 AU / r)² A η_sys on arrival day'),
    ),
    row(
      'deltaVCapability',
      'm/s',
      ev.details.deltaVCapability_ms,
      real.details.deltaVCapability_ms,
      computed(real.details.deltaVCapability_ms, 'm/s', 'Δv = Isp g₀ ln(m_wet / m_dry)'),
    ),
  ];
  const biggest = rows.reduce((x, y) => (Math.abs(y.relDiff) > Math.abs(x.relDiff) ? y : x));
  const out: RealMissionComparison = { missionId: id, label: preset.label, history: preset.history, rows, biggestGap: biggest.metric };
  if (preset.historyUrl) out.historyUrl = preset.historyUrl;
  return out;
}
