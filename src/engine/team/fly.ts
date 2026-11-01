// Team Fly (spec: Team mode, mockup screen T4). The view of a danger card's vote (whose turn it is: the related role
// recommends, the other seats vote, the Flight Director makes the final call), and the team's lines in flight for the
// TRANSMISSIONS teletype, merged with the robot's feed in time order. The vote itself is applied in reduce.ts; the
// flight on screen and the team's flight are the same mission because every order goes through the one log.
import type { OpsOp } from '../ops/types';
import type { FeedEntry } from '../ops/voice';
import type { TeamAction } from './log';
import type { TeamState, VoteHow } from './reduce';
import { hazardRole, holderOf, TEAM_RULES, type RoleId, type SeatId } from './roles';

export type CardStage = 'recommend' | 'vote' | 'call' | 'settled';

export interface CardVoter {
  seat: SeatId;
  roles: RoleId[];
  /** The option this seat chose (the recommender's is its recommendation). */
  voice?: string;
  recommender: boolean;
}

export interface CardVoteView {
  decisionId: string;
  stage: CardStage;
  /** The role that recommends on this danger, and the seat holding it (any seat when nobody does). */
  recommender: { role: RoleId; seat?: SeatId };
  recommend?: string;
  /** The seat that makes the final call (absent: no Flight Director, the majority decides). */
  director?: SeatId;
  /** The seats that vote: every seat but the Flight Director's (every seat when there is none). */
  voters: CardVoter[];
  /** Voices so far on each option, the Flight Director's included. */
  tally: Record<string, number>;
  /** The option with the most voices; a tie goes to the recommendation. */
  leans?: string;
  /** Voters still to speak. */
  waiting: number;
  result?: { optionId: string; how: VoteHow };
  /** A team of one: the recommendation is the call. */
  solo: boolean;
}

/** Where a danger card's vote stands (before the first entry too: then it waits for the recommendation). */
export function cardVote(s: TeamState, decisionId: string, hazardType: string): CardVoteView {
  const team = s.team ?? { seats: [] };
  const v = s.votes[decisionId];
  const role = hazardRole(hazardType);
  const recSeat = holderOf(team, role);
  const director = holderOf(team, 'flight-director');
  const voices = v?.voices ?? {};
  const voters: CardVoter[] = team.seats
    .filter((x) => x.id !== director)
    .map((x) => {
      const voice = voices[x.id];
      return { seat: x.id, roles: [...x.roles], ...(voice !== undefined ? { voice } : {}), recommender: v?.recommend?.seat === x.id };
    });
  const tally: Record<string, number> = {};
  for (const o of Object.values(voices)) if (o !== undefined) tally[o] = (tally[o] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((o) => tally[o] === top);
  const leans = leaders.length === 1 ? leaders[0] : v?.recommend && leaders.includes(v.recommend.optionId) ? v.recommend.optionId : undefined;
  const waiting = voters.filter((x) => x.voice === undefined).length;
  const stage: CardStage = v?.result ? 'settled' : !v?.recommend ? 'recommend' : waiting > 0 ? 'vote' : 'call';
  return {
    decisionId,
    stage,
    recommender: { role, ...(recSeat ? { seat: recSeat } : {}) },
    ...(v?.recommend ? { recommend: v.recommend.optionId } : {}),
    ...(director ? { director } : {}),
    voters,
    tally,
    ...(leans !== undefined && top > 0 ? { leans } : {}),
    waiting,
    ...(v?.result ? { result: { optionId: v.result.optionId, how: v.result.how } } : {}),
    solo: team.seats.length === 1,
  };
}

/** One team line on the teletype: a quick message, or a step of a danger card's vote. */
export interface TeamTxLine {
  from: 'team';
  /** Mission time it was sent. */
  at: number;
  seq: number;
  seat: SeatId;
  role: RoleId;
  what: { kind: 'say'; quick: string } | { kind: 'recommend' | 'vote' | 'call'; decisionId: string; optionId: string; hazardType?: string };
}

/** The team's accepted entries sent in flight (they carry a mission time), oldest first. */
export function teamFlightLines(s: TeamState, log: readonly TeamAction[]): TeamTxLine[] {
  const refused = new Set(s.refused.map((r) => r.seq));
  const out: TeamTxLine[] = [];
  for (const a of log) {
    if (a.t === undefined || refused.has(a.seq)) continue;
    const base = { from: 'team' as const, at: a.t, seq: a.seq, seat: a.seat, role: a.role };
    const x = a.act;
    if (x.kind === 'say') out.push({ ...base, what: { kind: 'say', quick: x.quick } });
    else if (x.kind === 'recommend' || x.kind === 'vote' || x.kind === 'call') {
      const type = s.votes[x.decisionId]?.hazardType;
      out.push({ ...base, what: { kind: x.kind, decisionId: x.decisionId, optionId: x.optionId, ...(type ? { hazardType: type } : {}) } });
    }
  }
  return out;
}

export type TxRow = FeedEntry | TeamTxLine;

/**
 * The robot's feed and the team's lines in one list, oldest first. At the same mission time the robot's line comes
 * first (the team answers what it has just heard). At most `max` of the newest rows.
 */
export function withTeamLines(entries: readonly FeedEntry[], lines: readonly TeamTxLine[], max = Infinity): TxRow[] {
  const out: TxRow[] = [];
  let i = 0;
  let j = 0;
  while (i < entries.length || j < lines.length) {
    const e = entries[i];
    const l = lines[j];
    if (e && (!l || e.at <= l.at)) {
      out.push(e);
      i++;
    } else {
      out.push(l!);
      j++;
    }
  }
  return Number.isFinite(max) ? out.slice(-max) : out;
}

/** The role an order on the console is sent as (an extension or any other decision: the Flight Director). */
export function opRole(op: OpsOp): RoleId {
  if (op.kind === 'dsn') return TEAM_RULES.commandRoles.value.dsn;
  if (op.kind === 'decide' || op.command.kind === 'respond') return 'flight-director';
  return TEAM_RULES.commandRoles.value[op.command.kind];
}
