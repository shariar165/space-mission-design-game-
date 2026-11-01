// Team Setup and the Mission Objective (spec: Team mode, mockup screens T1 and T2). The crew helpers the setup
// screen calls (how many players, who holds which role, call signs from the preset list), the objective cards (what
// each objective counts, which parts do its science, the role it leans on) and the objective vote's view: the Flight
// Director picks, the other roles agree or object, then the Flight Director locks it or overrules.
import { OBJECTIVES, objectiveMatched, targetWeight, type ObjectiveId, type Objective } from '../objectives';
import { PACK, type PartId } from '../pack';
import { TARGETS } from '../targets';
import type { Design } from '../types';
import { OBJECTIVE_VOTERS, objectiveAutoAgrees, type TeamState } from './reduce';
import { holderOf, ROLE_IDS, SEAT_IDS, TEAM_RULES, type RoleId, type SeatId, type Team } from './roles';

const SIGNS = () => TEAM_RULES.callSigns.value;

/** The starting crew for one to four players: the default roles, and the first call signs on the list. */
export function defaultTeam(players: number): Team {
  const roles = TEAM_RULES.defaultRoles.value[String(players)];
  if (!roles) throw new Error(`no default crew for ${players} players`);
  return { seats: roles.map((r, i) => ({ id: SEAT_IDS[i]!, callSign: SIGNS()[i]!, roles: [...r] })) };
}

/** A new player count: the default roles again; seats kept keep their call sign, new seats take the first free one. */
export function setPlayers(team: Team, players: number): Team {
  const next = defaultTeam(players);
  const kept = team.seats.slice(0, players).map((s) => s.callSign);
  const free = SIGNS().filter((c) => !kept.includes(c));
  return { seats: next.seats.map((s, i) => ({ ...s, callSign: kept[i] ?? free.shift()! })) };
}

/** The seat's next call sign on the list that no other seat has (round the list). */
export function nextCallSign(team: Team, seat: SeatId): Team {
  const signs = SIGNS();
  const me = team.seats.find((s) => s.id === seat);
  if (!me) return team;
  const taken = new Set(team.seats.filter((s) => s.id !== seat).map((s) => s.callSign));
  const at = signs.indexOf(me.callSign);
  for (let k = 1; k <= signs.length; k++) {
    const c = signs[(at + k) % signs.length]!;
    if (!taken.has(c)) return { seats: team.seats.map((s) => (s.id === seat ? { ...s, callSign: c } : s)) };
  }
  return team;
}

const inRoleOrder = (roles: RoleId[]) => ROLE_IDS.filter((r) => roles.includes(r));

/** HELD BY: hand a role to the next seat round the table (an open role goes to the first seat). */
export function handRole(team: Team, role: RoleId): Team {
  const n = team.seats.length;
  if (n <= 1) return team;
  const at = team.seats.findIndex((s) => s.roles.includes(role));
  const to = (at + 1) % n;
  return {
    seats: team.seats.map((s, i) => ({
      ...s,
      roles: i === to ? inRoleOrder([...s.roles, role]) : s.roles.filter((r) => r !== role),
    })),
  };
}

export interface CrewView {
  players: number;
  /** Seats holding two roles or more (none in a team of one). */
  doubled: SeatId[];
  /** Seats holding no role: the team cannot start until each has one. */
  idle: SeatId[];
}

export function crewView(team: Team): CrewView {
  const n = team.seats.length;
  return {
    players: n,
    doubled: n > 1 ? team.seats.filter((s) => s.roles.length > 1).map((s) => s.id) : [],
    idle: team.seats.filter((s) => s.roles.length === 0).map((s) => s.id),
  };
}

/** On a shared screen a role's keys act as its holder, or as the first seat when nobody holds it. */
export const actorFor = (team: Team, role: RoleId): SeatId => holderOf(team, role) ?? team.seats[0]!.id;

export interface ObjectiveCard {
  id: ObjectiveId;
  /** Its Mars targets, each with its share of the science when a matching part flies (they sum to the rule's share). */
  targets: { id: string; share: number }[];
  /** The Pack parts whose instrument does its science (any one is enough). */
  parts: PartId[];
  /** The role it leans on hardest, and why. */
  strain: Objective['strain'];
  /** This craft already carries one of the parts. */
  matched: boolean;
}

const PART_OF_INSTRUMENT = (Object.keys(PACK.parts) as PartId[]).filter((id) => PACK.parts[id].instrumentId);

/** The three objective cards for a Mars design (spec: Mission objectives). */
export function objectiveCards(design: Design): ObjectiveCard[] {
  return OBJECTIVES.map((o) => {
    const flown: Design = { ...design, destination: 'mars', objective: o.id, instrumentIds: [o.instruments[0]!] };
    return {
      id: o.id,
      targets: TARGETS.filter((t) => t.body === 'mars' && o.favours.includes(t.kind)).map((t) => ({ id: t.id, share: targetWeight(flown, t) })),
      parts: PART_OF_INSTRUMENT.filter((id) => o.instruments.includes(PACK.parts[id].instrumentId!)),
      strain: o.strain,
      matched: objectiveMatched(design, o),
    };
  });
}

export interface ObjectiveVoteView {
  objective?: ObjectiveId;
  /** The three other roles: who holds each, whether it agrees by itself, and its voice. */
  voters: { role: RoleId; seat?: SeatId; auto: boolean; voice?: 'agree' | 'object' }[];
  /** Voices still to come. */
  waiting: number;
  objectors: RoleId[];
  /** What happens next: the FD picks, the team votes, the FD locks, the FD overrules, or it is locked. */
  next: 'pick' | 'wait' | 'lock' | 'overrule' | 'locked';
  locked?: 'agreed' | 'overruled';
}

/** The objective vote as the screen shows it (needs the team set up). */
export function objectiveVote(s: TeamState): ObjectiveVoteView {
  const team = s.team ?? { seats: [] };
  const voters = OBJECTIVE_VOTERS.map((role) => {
    const auto = team.seats.length > 0 && objectiveAutoAgrees(team, role);
    const voice = s.objective ? (auto ? 'agree' : s.objectiveVoices[role]) : undefined;
    const seat = holderOf(team, role);
    return { role, auto, ...(seat ? { seat } : {}), ...(voice ? { voice } : {}) };
  });
  const waiting = s.objective ? voters.filter((v) => !v.voice).length : voters.length;
  const objectors = voters.filter((v) => v.voice === 'object').map((v) => v.role);
  const next = s.objectiveLocked ? 'locked' : !s.objective ? 'pick' : waiting > 0 ? 'wait' : objectors.length ? 'overrule' : 'lock';
  return {
    ...(s.objective ? { objective: s.objective } : {}),
    voters,
    waiting,
    objectors,
    next,
    ...(s.objectiveLocked ? { locked: s.objectiveLocked.how } : {}),
  };
}
