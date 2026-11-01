// Team mode: the Mission Report's Team section (spec: Team mode, Team report). One row per role with its key
// decision and what it did, and the team score from the objective met, the conflicts resolved and the danger-card
// calls that matched the recommendation (TEAM_RULES.scoreWeights). The team score is reported on its own: it never
// changes the prime score or the stars.
import { objectiveResult, targetScience, type ObjectiveResult } from '../ops/observe';
import type { OpsState } from '../ops/types';
import { coversOf, PACK, type PartId } from '../pack';
import type { ObjectiveId } from '../objectives';
import type { TeamAction } from './log';
import { teamConflicts } from './negotiate';
import type { TeamState, VoteHow } from './reduce';
import { holderOf, ROLE_IDS, TEAM_RULES, type RoleId, type SeatId } from './roles';

export type KeyDecision =
  /** The Flight Director's objective, and whether it was met. */
  | { kind: 'objective'; objective: ObjectiveId; met: boolean }
  /** A danger card the role recommended on (the Flight Director: called), how it was settled and whether it went badly. */
  | {
      kind: 'card';
      hazardType: string;
      optionId: string;
      recommended: string;
      how: VoteHow;
      bad: boolean;
      /** Mission day the card was settled (the settling entry's time). */
      day?: number;
      /** Seats whose voice was the settled option, and seats that wanted another. */
      support: number;
      against: number;
    }
  /** The pictures the role ordered and the science home (0–1, with the objective's weights). */
  | { kind: 'observe'; ordered: string[]; home: string[]; science: number }
  /** DSN days the role booked. */
  | { kind: 'dsn'; days: number }
  /** A part the role packed, and the dangers it covered that really happened. */
  | { kind: 'part'; part: PartId; covered: string[] }
  | { kind: 'none' };

/** How the key decision turned out: good (met, held, all home, a part that was needed), bad, mixed, or none. */
export type RowVerdict = 'good' | 'bad' | 'mixed' | 'none';

export interface TeamRow {
  role: RoleId;
  seat?: SeatId;
  callSign?: string;
  key: KeyDecision;
  verdict: RowVerdict;
}

/** One part of the team score: its points and the most it can give, with the count behind it (n of `of`). */
export interface ScorePart {
  id: 'votes' | 'conflicts' | 'objective';
  points: number;
  max: number;
  n: number;
  of: number;
}

export interface TeamReport {
  rows: TeamRow[];
  objective?: ObjectiveResult;
  conflicts: { raised: number; resolved: number };
  votes: { total: number; agreed: number };
  /** 0–100. */
  score: number;
  /** The score in parts (agreements, conflicts solved, objective met); their points add up to `score`. */
  parts: ScorePart[];
  /** The most the score can be (the parts' maxima: 100). */
  max: number;
}

/**
 * Σ wᵢ sᵢ × 100: s_objective = 1 if met, s_conflicts = resolved ÷ raised (1 with none), s_votes = agreed ÷ total
 * (1 with none). With no objective (the Moon, the Daily) the other two share the score in proportion to their weights.
 */
export function teamScore(objectiveMet: boolean | undefined, conflicts: TeamReport['conflicts'], votes: TeamReport['votes']): number {
  return teamScoreParts(objectiveMet, conflicts, votes).reduce((a, x) => a + x.points, 0);
}

/**
 * The team score in its parts: each part's points are 100 wᵢ sᵢ (with no objective, the weights rescaled to share
 * 100) and `max` is 100 wᵢ, so the parts add up to `teamScore`.
 */
export function teamScoreParts(objectiveMet: boolean | undefined, conflicts: TeamReport['conflicts'], votes: TeamReport['votes']): ScorePart[] {
  const w = TEAM_RULES.scoreWeights.value;
  const scale = objectiveMet === undefined ? 100 / (w.conflicts + w.votes) : 100;
  const part = (id: ScorePart['id'], weight: number, n: number, of: number): ScorePart => ({ id, points: scale * weight * (of ? n / of : 1), max: scale * weight, n, of });
  return [
    part('votes', w.votes, votes.agreed, votes.total),
    part('conflicts', w.conflicts, conflicts.resolved, conflicts.raised),
    ...(objectiveMet === undefined ? [] : [part('objective', w.objective, objectiveMet ? 1 : 0, 1)]),
  ];
}

/** good: met, held, every picture home, a part whose danger came; bad: missed, went badly, none home. */
export function rowVerdict(k: KeyDecision): RowVerdict {
  switch (k.kind) {
    case 'objective':
      return k.met ? 'good' : 'bad';
    case 'card':
      return k.bad ? 'bad' : 'good';
    case 'observe':
      return k.home.length === k.ordered.length ? 'good' : k.home.length === 0 ? 'bad' : 'mixed';
    case 'dsn':
      return 'good';
    case 'part':
      return k.covered.length ? 'good' : 'none';
    case 'none':
      return 'none';
  }
}

/** The Team section, from the team log and the flown mission. */
export function teamReport(log: readonly TeamAction[], r: { team: TeamState; ops?: OpsState }): TeamReport {
  const { team: s, ops } = r;
  const objective = ops ? objectiveResult(ops) : undefined;
  const conflicts = teamConflicts(s.base, s.shelf, log);
  const settled = Object.values(s.votes).filter((v) => v.result && v.recommend);
  const votes = { total: settled.length, agreed: settled.filter((v) => v.result!.optionId === v.recommend!.optionId).length };
  // Only entries that were carried out count (refused ones stay in the log)
  const refused = new Set(s.refused.map((x) => x.seq));
  const done = log.filter((a) => !refused.has(a.seq));
  const recommender = (decisionId: string) => done.find((a) => a.act.kind === 'recommend' && a.act.decisionId === decisionId)?.role;
  const happened = new Set(ops?.hazards.filter((h) => h.onsetDone).map((h) => h.type) ?? []);
  const hazardOf = (decisionId: string) => {
    const dec = ops?.decisions.find((d) => d.id === decisionId);
    return ops?.hazards.find((h) => h.id === dec?.hazardId);
  };

  /** Cards the role recommended on (the Flight Director: the ones it called), a bad outcome first, then the latest. */
  const card = (role: RoleId): KeyDecision | undefined => {
    const mine = settled.filter((v) => (role === 'flight-director' ? v.result!.how === 'call' : recommender(v.decisionId) === role));
    const rows = mine.map((v) => ({ v, bad: hazardOf(v.decisionId)?.choice?.badOutcome === true }));
    const pick = rows.find((x) => x.bad) ?? rows.at(-1);
    if (!pick) return undefined;
    const chosen = pick.v.result!.optionId;
    const voices = Object.values(pick.v.voices).filter((o) => o !== undefined);
    const day = log.find((a) => a.seq === pick.v.result!.seq)?.t;
    return {
      kind: 'card',
      hazardType: pick.v.hazardType,
      optionId: chosen,
      recommended: pick.v.recommend!.optionId,
      how: pick.v.result!.how,
      bad: pick.bad,
      ...(day !== undefined ? { day } : {}),
      support: voices.filter((o) => o === chosen).length,
      against: voices.filter((o) => o !== chosen).length,
    };
  };
  const observe = (role: RoleId): KeyDecision | undefined => {
    const ordered = done.flatMap((a) => (a.role === role && a.act.kind === 'ops' && a.act.op.kind === 'command' && a.act.op.command.kind === 'observe' ? [a.act.op.command.targetId] : []));
    if (!ordered.length || !ops) return undefined;
    const ts = targetScience(ops);
    return { kind: 'observe', ordered, home: ts.home.filter((id) => ordered.includes(id)), science: ts.fraction };
  };
  const dsn = (role: RoleId): KeyDecision | undefined => {
    const days = done.reduce((n, a) => (a.role === role && a.act.kind === 'ops' && a.act.op.kind === 'dsn' ? n + a.act.op.toDay - a.act.op.fromDay + 1 : n), 0);
    return days > 0 ? { kind: 'dsn', days } : undefined;
  };
  /** The role's optional part that covered the most dangers that really happened (else the first it packed). */
  const part = (role: RoleId): KeyDecision | undefined => {
    const mine = s.packed.filter((q) => !PACK.parts[q.id].locked && s.owners[q.id] === role).map((q) => ({ part: q.id, covered: coversOf(q.id).filter((h) => happened.has(h)) }));
    const best = mine.reduce<(typeof mine)[number] | undefined>((a, b) => (!a || b.covered.length > a.covered.length ? b : a), undefined);
    return best ? { kind: 'part', ...best } : undefined;
  };
  const obj = (): KeyDecision | undefined => (s.objective ? { kind: 'objective', objective: s.objective, met: objective?.met ?? false } : undefined);

  const order: Record<RoleId, (() => KeyDecision | undefined)[]> = {
    'flight-director': [obj, () => card('flight-director'), () => part('flight-director')],
    'spacecraft-engineer': [() => card('spacecraft-engineer'), () => part('spacecraft-engineer')],
    'science-lead': [() => observe('science-lead'), () => card('science-lead'), () => part('science-lead')],
    'comms-ops': [() => card('comms-ops'), () => dsn('comms-ops'), () => part('comms-ops')],
  };
  const rows = ROLE_IDS.map((role): TeamRow => {
    const seatId = s.team ? holderOf(s.team, role) : undefined;
    const seat = s.team?.seats.find((x) => x.id === seatId);
    const key = order[role].reduce<KeyDecision | undefined>((k, f) => k ?? f(), undefined) ?? { kind: 'none' };
    return { role, ...(seat ? { seat: seat.id, callSign: seat.callSign } : {}), key, verdict: rowVerdict(key) };
  });
  const c = { raised: conflicts.length, resolved: conflicts.filter((x) => x.resolvedSeq !== undefined).length };
  const parts = teamScoreParts(objective?.met, c, votes);
  return { rows, ...(objective ? { objective } : {}), conflicts: c, votes, score: parts.reduce((a, x) => a + x.points, 0), parts, max: parts.reduce((a, x) => a + x.max, 0) };
}
