// Team mode: applying one log entry (spec: Team mode). Pure: the state in is never changed. Each entry is checked
// against the phase (before or after launch) and the role it needs; a refusal is kept in the state, like a refused
// command in Mission operations, because it is itself something that happened. Danger cards are settled here: the
// Flight Director's call, or with no Flight Director the majority once every seat has spoken (a tie goes to the
// recommendation, then to the craft's own default), or at once for a team of one.
import type { ObjectiveId } from '../objectives';
import type { OpsOp, OpsState } from '../ops/types';
import { defaultResponse } from '../ops/responses';
import { buildPackDesign, initialPack, onDay, packPart, PACK, unpackPart, type CalendarDay, type Packed, type PartId } from '../pack';
import type { Design } from '../types';
import type { TeamAction } from './log';
import { hazardRole, holderOf, mayActAs, partRole, seatOf, teamProblem, TEAM_RULES, type RoleId, type SeatId, type Team } from './roles';

export type VoteHow = 'call' | 'majority' | 'tie' | 'solo';

export interface Vote {
  decisionId: string;
  hazardType: string;
  recommend?: { seat: SeatId; optionId: string };
  /** One voice per seat; the recommender's voice is its recommendation. */
  voices: Partial<Record<SeatId, string>>;
  result?: { optionId: string; how: VoteHow; seq: number };
}

export interface TeamState {
  base: Design;
  shelf: PartId[];
  team?: Team;
  objective?: ObjectiveId;
  /** The other roles' voices on the objective (cleared by a new pick). */
  objectiveVoices: Partial<Record<RoleId, 'agree' | 'object'>>;
  /** Locked by the Flight Director: everyone agreed, or an objection was overruled. */
  objectiveLocked?: { how: 'agreed' | 'overruled'; seq: number };
  packed: Packed;
  /** Who packed each part (the starting pack belongs to the parts' roles). */
  owners: Partial<Record<PartId, RoleId>>;
  day?: CalendarDay;
  launched: boolean;
  votes: Record<string, Vote>;
  feed: { seq: number; seat: SeatId; quick: string; t?: number }[];
  refused: { seq: number; reason: TeamRefusal }[];
}

export type TeamRefusal =
  | 'already-set-up'
  | 'bad-team'
  | 'no-team'
  | 'unknown-seat'
  | 'launched'
  | 'not-launched'
  | 'wrong-role'
  | 'not-your-role'
  | 'not-on-shelf'
  | 'locked'
  | 'already-packed'
  | 'not-packed'
  | 'no-room'
  | 'no-objective-here'
  | 'no-objective'
  | 'objective-locked'
  | 'auto-agree'
  | 'waiting-votes'
  | 'use-vote'
  | 'unknown-decision'
  | 'unknown-option'
  | 'settled'
  | 'already-recommended'
  | 'no-recommendation'
  | 'already-voted'
  | 'unknown-message'
  | 'no-director';

export interface TeamResult {
  state: TeamState;
  refused?: TeamRefusal;
  /** Orders the entry sends to the craft or the ground, applied at the current mission time. */
  emit: OpsOp[];
  /** The Flight Director launched: start Mission operations with teamDesign(state). */
  launch?: boolean;
}

export function initialTeamState(base: Design, shelf: PartId[]): TeamState {
  const packed = initialPack(base, shelf);
  return {
    base,
    shelf,
    packed,
    owners: Object.fromEntries(packed.map((q) => [q.id, partRole(q.id)])),
    objectiveVoices: {},
    launched: false,
    votes: {},
    feed: [],
    refused: [],
  };
}

/** The design the team flies: the packed nose, on the launch day, with the objective (Mars only). */
export function teamDesign(s: TeamState): Design {
  const packed = buildPackDesign(s.base, s.packed);
  const d = s.day ? onDay(packed, s.day) : packed;
  return s.objective && s.base.destination === 'mars' ? { ...d, objective: s.objective } : d;
}

const clone = (s: TeamState): TeamState => ({
  ...s,
  packed: [...s.packed],
  owners: { ...s.owners },
  objectiveVoices: { ...s.objectiveVoices },
  votes: Object.fromEntries(Object.entries(s.votes).map(([k, v]) => [k, { ...v, voices: { ...v.voices } }])),
  feed: [...s.feed],
  refused: [...s.refused],
});

/** The roles that vote on the Flight Director's objective. */
export const OBJECTIVE_VOTERS: RoleId[] = ['spacecraft-engineer', 'science-lead', 'comms-ops'];

/** A role the Flight Director's own player holds agrees with the pick by itself (and so does everyone in a team of one). */
export function objectiveAutoAgrees(team: Team, role: RoleId): boolean {
  if (team.seats.length === 1) return true;
  const fd = holderOf(team, 'flight-director');
  return fd !== undefined && holderOf(team, role) === fd;
}

/** The role an order needs, or a refusal (hazard responses go through the vote). */
function orderRole(op: OpsOp, ops: OpsState): RoleId | 'use-vote' {
  if (op.kind === 'dsn') return TEAM_RULES.commandRoles.value.dsn;
  if (op.kind === 'decide') {
    const dec = ops.decisions.find((d) => d.id === op.decisionId);
    return dec?.kind === 'extension' ? 'flight-director' : 'use-vote';
  }
  return op.command.kind === 'respond' ? 'use-vote' : TEAM_RULES.commandRoles.value[op.command.kind];
}

/** Settle a card by majority (no Flight Director): the most voices; a tie goes to the recommendation, then the default. */
function majority(v: Vote, ops: OpsState): { optionId: string; how: VoteHow } {
  const count = new Map<string, number>();
  for (const o of Object.values(v.voices)) if (o !== undefined) count.set(o, (count.get(o) ?? 0) + 1);
  const top = Math.max(...count.values());
  const leaders = [...count].filter(([, n]) => n === top).map(([o]) => o);
  if (leaders.length === 1) return { optionId: leaders[0]!, how: 'majority' };
  if (v.recommend && leaders.includes(v.recommend.optionId)) return { optionId: v.recommend.optionId, how: 'tie' };
  const dec = ops.decisions.find((d) => d.id === v.decisionId)!;
  const hz = ops.hazards.find((h) => h.id === dec.hazardId);
  return { optionId: defaultResponse(dec.hazardOptions!, hz ? ops.standingOrders[hz.type] : undefined, ops.env.design.kit?.autopilot).option.id, how: 'tie' };
}

/**
 * Apply one log entry. `ops` is the flight at the entry's time (absent before launch): danger cards and orders need
 * it to know what is open.
 */
export function applyTeamAction(state: TeamState, a: TeamAction, ops?: OpsState): TeamResult {
  const s = clone(state);
  const refuse = (reason: TeamRefusal): TeamResult => {
    s.refused.push({ seq: a.seq, reason });
    return { state: s, refused: reason, emit: [] };
  };
  const done = (emit: OpsOp[] = [], launch?: boolean): TeamResult => ({ state: s, emit, ...(launch ? { launch } : {}) });
  const act = a.act;

  if (act.kind === 'setup') {
    if (s.team) return refuse('already-set-up');
    if (teamProblem(act.team)) return refuse('bad-team');
    s.team = act.team;
    return done();
  }
  const team = s.team;
  if (!team) return refuse('no-team');
  if (!seatOf(team, a.seat)) return refuse('unknown-seat');
  /** The entry needs `role`: the seat must act as it, and may (it holds it, or nobody does). */
  const needs = (role: RoleId) => (a.role !== role ? 'wrong-role' : mayActAs(team, a.seat, role) ? undefined : 'not-your-role');

  switch (act.kind) {
    case 'objective': {
      if (s.launched) return refuse('launched');
      if (s.base.destination !== 'mars') return refuse('no-objective-here');
      if (s.objectiveLocked) return refuse('objective-locked');
      const r = needs('flight-director');
      if (r) return refuse(r);
      s.objective = act.objective;
      s.objectiveVoices = {};
      return done();
    }
    case 'objective-voice':
    case 'objective-lock': {
      if (s.launched) return refuse('launched');
      if (s.base.destination !== 'mars') return refuse('no-objective-here');
      if (!s.objective) return refuse('no-objective');
      if (s.objectiveLocked) return refuse('objective-locked');
      if (act.kind === 'objective-voice') {
        if (a.role === 'flight-director') return refuse('wrong-role');
        if (objectiveAutoAgrees(team, a.role)) return refuse('auto-agree');
        if (!mayActAs(team, a.seat, a.role)) return refuse('not-your-role');
        if (act.voice === 'none') delete s.objectiveVoices[a.role];
        else s.objectiveVoices[a.role] = act.voice;
        return done();
      }
      const r = needs('flight-director');
      if (r) return refuse(r);
      const voices = OBJECTIVE_VOTERS.map((v) => (objectiveAutoAgrees(team, v) ? 'agree' : s.objectiveVoices[v]));
      if (voices.some((v) => v === undefined)) return refuse('waiting-votes');
      s.objectiveLocked = { how: voices.includes('object') ? 'overruled' : 'agreed', seq: a.seq };
      return done();
    }
    case 'pack':
    case 'unpack': {
      if (s.launched) return refuse('launched');
      if (!s.shelf.includes(act.part)) return refuse('not-on-shelf');
      if (PACK.parts[act.part].locked) return refuse('locked');
      const has = s.packed.some((q) => q.id === act.part);
      if (act.kind === 'pack' && has) return refuse('already-packed');
      if (act.kind === 'unpack' && !has) return refuse('not-packed');
      const r = needs(partRole(act.part));
      if (r) return refuse(r);
      if (act.kind === 'unpack') {
        s.packed = unpackPart(s.packed, act.part);
        delete s.owners[act.part];
        return done();
      }
      const p = packPart(s.packed, act.part);
      if (!p) return refuse('no-room');
      s.packed = p;
      s.owners[act.part] = a.role;
      return done();
    }
    case 'launch': {
      if (s.launched) return refuse('launched');
      const r = needs('flight-director');
      if (r) return refuse(r);
      s.day = act.day;
      s.launched = true;
      return done([], true);
    }
    case 'say': {
      if (!mayActAs(team, a.seat, a.role)) return refuse('not-your-role');
      if (!TEAM_RULES.quick.value.includes(act.quick)) return refuse('unknown-message');
      s.feed.push({ seq: a.seq, seat: a.seat, quick: act.quick, ...(a.t !== undefined ? { t: a.t } : {}) });
      return done();
    }
  }

  // In flight
  if (!s.launched || !ops) return refuse('not-launched');
  if (act.kind === 'ops') {
    const role = orderRole(act.op, ops);
    if (role === 'use-vote') return refuse(role);
    const r = needs(role);
    if (r) return refuse(r);
    return done([act.op]);
  }

  const dec = ops.decisions.find((d) => d.id === act.decisionId);
  if (!dec || dec.kind !== 'hazard') return refuse('unknown-decision');
  const vote: Vote = s.votes[dec.id] ?? { decisionId: dec.id, hazardType: ops.hazards.find((h) => h.id === dec.hazardId)!.type, voices: {} };
  if (vote.result || dec.commanded) return refuse('settled');
  if (!dec.hazardOptions!.some((o) => o.id === act.optionId)) return refuse('unknown-option');
  const settle = (optionId: string, how: VoteHow) => {
    vote.result = { optionId, how, seq: a.seq };
    s.votes[dec.id] = vote;
    return done([{ kind: 'decide', decisionId: dec.id, optionId }]);
  };
  const everyoneSpoke = () => team.seats.every((x) => vote.voices[x.id] !== undefined);
  const noDirector = holderOf(team, 'flight-director') === undefined;

  if (act.kind === 'recommend') {
    if (vote.recommend) return refuse('already-recommended');
    const r = needs(hazardRole(vote.hazardType));
    if (r) return refuse(r);
    vote.recommend = { seat: a.seat, optionId: act.optionId };
    vote.voices[a.seat] = act.optionId;
    s.votes[dec.id] = vote;
    if (team.seats.length === 1) return settle(act.optionId, 'solo');
    if (noDirector && everyoneSpoke()) {
      const m = majority(vote, ops);
      return settle(m.optionId, m.how);
    }
    return done();
  }
  if (!vote.recommend) return refuse('no-recommendation');
  if (act.kind === 'vote') {
    if (!mayActAs(team, a.seat, a.role)) return refuse('not-your-role');
    if (vote.voices[a.seat] !== undefined) return refuse('already-voted');
    vote.voices[a.seat] = act.optionId;
    s.votes[dec.id] = vote;
    if (noDirector && everyoneSpoke()) {
      const m = majority(vote, ops);
      return settle(m.optionId, m.how);
    }
    return done();
  }
  // call: only a Flight Director who is there; without one the majority decides
  if (noDirector) return refuse('no-director');
  const r = needs('flight-director');
  if (r) return refuse(r);
  vote.voices[a.seat] ??= act.optionId;
  return settle(act.optionId, 'call');
}
