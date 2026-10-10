// Mission Report (Signal Delay design, screen 03): the mission as a 4-panel comic, what saved you and what hurt
// you, and the comparison with the real NASA mission. Codes and values only: the words live in the UI.
import { compareWithRealMission, REAL_MISSION_FOR, type CompareMetric, type CompareRow } from '../compare';
import { HAZARDS, type FailureEffect, type OpsPhase } from '../data';
import type { FullEvaluation } from '../index';
import { missionPreset, type MissionId } from '../missions';
import { PACK, type PartId } from '../pack';
import { SCORE_GRADES, type Category } from '../scoring';
import type { Design, Sourced } from '../types';
import { effectiveFailureChance } from './responses';
import type { HazardRecord, OpsState, ResponseSource } from './types';
import { operationsDebrief } from './index';

export type PanelKind = 'launch' | 'launch-failed' | 'not-launched' | 'hazard' | 'arrival' | 'conjunction' | 'lost' | 'complete';

export interface ReportPanel {
  kind: PanelKind;
  /** Mission day of the moment. */
  day: number;
  hazardType?: string;
  optionId?: string;
  by?: ResponseSource;
  bad?: boolean;
  effect?: FailureEffect;
  /** Arrival: the capture burn (m/s). */
  dv_ms?: number;
  /** Conjunction: the length of the radio blackout (days). */
  blackoutDays?: number;
  /** Lost: the phase it happened in. */
  phase?: OpsPhase;
}

/** The moment the mission stopped being flown for the report: the loss, or the end of the prime mission. */
function endDay(s: OpsState): number {
  if (s.status === 'lost') return Math.floor(s.failureT ?? s.t);
  return Math.min(Math.floor(s.t), s.env.primeEndDay);
}

const answered = (s: OpsState) => s.hazards.filter((h): h is HazardRecord & { choice: NonNullable<HazardRecord['choice']> } => !!h.choice && h.outcomeDone);
const chanceOf = (s: OpsState, h: HazardRecord & { choice: NonNullable<HazardRecord['choice']> }) =>
  effectiveFailureChance(s.env.design, h.type, HAZARDS[h.type]!.options.find((o) => o.id === h.choice.optionId)?.failureChance.value ?? 0, h.real?.severity);

/**
 * Four key moments in time order: launch first, the end last (lost or prime mission complete), and the two most
 * significant moments between: bad outcomes, then other answered hazards (riskiest first), then the arrival burn,
 * then the first solar conjunction.
 */
export function reportPanels(s: OpsState): ReportPanel[] {
  const env = s.env;
  if (s.status === 'not-launched') return [{ kind: 'not-launched', day: 0 }];
  if (s.status === 'lost' && (s.failureT ?? 1) === 0) return [{ kind: 'launch-failed', day: 0 }];
  const end = endDay(s);
  const candidates: { p: ReportPanel; rank: number }[] = [];
  for (const h of answered(s)) {
    if (h.onset > end + 1) continue;
    const opt = HAZARDS[h.type]!.options.find((o) => o.id === h.choice.optionId);
    candidates.push({
      p: {
        kind: 'hazard',
        day: Math.floor(h.onset),
        hazardType: h.type,
        optionId: h.choice.optionId,
        by: h.choice.by,
        bad: h.choice.badOutcome ?? false,
        ...(opt ? { effect: opt.failureEffect } : {}),
      },
      rank: (h.choice.badOutcome ? 0 : 1) + (1 - chanceOf(s, h)) * 0.5,
    });
  }
  const arrivalBurn = env.burns.find((b) => b.kind === 'arrival');
  if (arrivalBurn && end >= env.arrivalDay) candidates.push({ p: { kind: 'arrival', day: env.arrivalDay, dv_ms: arrivalBurn.dv_ms }, rank: 2 });
  const conj = env.conjunctions.find((w) => w.startDay <= end);
  if (conj) candidates.push({ p: { kind: 'conjunction', day: conj.startDay, blackoutDays: conj.endDay - conj.startDay + 1 }, rank: 3 });
  const middle = candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2)
    .map((c) => c.p)
    .sort((a, b) => a.day - b.day);
  const last: ReportPanel =
    s.status === 'lost' ? { kind: 'lost', day: end, ...(s.failedPhase ? { phase: s.failedPhase } : {}) } : { kind: 'complete', day: env.primeEndDay };
  return [{ kind: 'launch', day: 0 }, ...middle, last];
}

export type Saved =
  | { code: 'part'; part: PartId; hazardType: string }
  | { code: 'autopilot'; hazardType: string }
  | { code: 'choice'; hazardType: string; optionId: string }
  | { code: 'quiet' };

export type Hurt =
  | { code: 'bad-outcome'; hazardType: string; optionId: string; effect: FailureEffect }
  | { code: 'category'; category: Category; score: number }
  | { code: 'nothing' };

/** What saved you (a packed protection, the autopilot, or a good call) and what hurt you (a bad outcome, or the weakest score). */
export function reportVerdict(s: OpsState): { saved: Saved; hurt: Hurt } {
  const kit = s.env.design.kit;
  const hs = answered(s);
  const good = hs.filter((h) => !h.choice.badOutcome);
  const bad = hs.filter((h) => h.choice.badOutcome);
  let saved: Saved = { code: 'quiet' };
  const protectedHit = good.find((h) => kit?.hazardFactor?.[h.type] !== undefined);
  const part = protectedHit && (Object.entries(PACK.parts) as [PartId, (typeof PACK.parts)[PartId]][]).find(([, p]) => p.hazardFactor?.[protectedHit.type]);
  if (protectedHit && part) saved = { code: 'part', part: part[0], hazardType: protectedHit.type };
  else {
    const auto = kit?.autopilot ? good.find((h) => h.choice.by === 'standing-order') : undefined;
    if (auto) saved = { code: 'autopilot', hazardType: auto.type };
    else if (good.length) {
      const best = [...good].sort((a, b) => chanceOf(s, b) - chanceOf(s, a))[0]!;
      saved = { code: 'choice', hazardType: best.type, optionId: best.choice.optionId };
    }
  }
  let hurt: Hurt = { code: 'nothing' };
  const worst = bad[0];
  const worstOpt = worst && HAZARDS[worst.type]!.options.find((o) => o.id === worst.choice.optionId);
  if (worst && worstOpt) hurt = { code: 'bad-outcome', hazardType: worst.type, optionId: worst.choice.optionId, effect: worstOpt.failureEffect };
  else {
    const d = operationsDebrief(s);
    const weakest = [...d.breakdown].sort((a, b) => a.score - b.score)[0];
    if (weakest && weakest.score < SCORE_GRADES.fairFrom.value) hurt = { code: 'category', category: weakest.category, score: weakest.score };
  }
  return { saved, hurt };
}

export interface ReportCompare {
  missionId: MissionId;
  label: string;
  history: string;
  historyUrl?: string;
  launch: { you: string; them: Sourced<string> };
  scienceDays: { you: number; them?: Sourced<number> };
  rows: CompareRow[];
  biggestGap: CompareMetric;
}

/** You vs the real mission: launch date and planned science life from the preset, then mass, power and Δv (spec UI rule 5). */
export function reportCompare(design: Design, ev: FullEvaluation): ReportCompare | undefined {
  const id = REAL_MISSION_FOR[design.destination];
  const c = compareWithRealMission(design, ev);
  if (!id || !c) return undefined;
  const preset = missionPreset(id);
  return {
    missionId: id,
    label: c.label,
    history: c.history,
    ...(c.historyUrl ? { historyUrl: c.historyUrl } : {}),
    launch: { you: ev.details.launchDate, them: preset.design.launchDate },
    scienceDays: { you: ev.details.scienceDays, ...(preset.design.scienceDays ? { them: preset.design.scienceDays } : {}) },
    rows: c.rows,
    biggestGap: c.biggestGap,
  };
}
