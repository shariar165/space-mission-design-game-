// Team mode: roles, seats and who may act as whom (spec: Team mode). One to four seats share one craft; each seat
// holds one or more of the four roles. A role nobody holds is open: any seat may act as it.
import teamJson from '../../data/team.json';
import { PACK, type PartId } from '../pack';
import type { Sourced } from '../types';

export const ROLE_IDS = ['flight-director', 'spacecraft-engineer', 'science-lead', 'comms-ops'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const SEAT_IDS = ['p1', 'p2', 'p3', 'p4'] as const;
export type SeatId = (typeof SEAT_IDS)[number];

export interface Seat {
  id: SeatId;
  /** From TEAM_RULES.callSigns: nobody types a name. */
  callSign: string;
  roles: RoleId[];
}

export interface Team {
  seats: Seat[];
}

/** Orders that go by role (a hazard response goes through the vote instead). */
export type OrderKind = 'power-plan' | 'standing-orders' | 'observe' | 'dsn';

const { partRoles, commandRoles, hazardRoles, callSigns, quick, scoreWeights } = teamJson;

export const TEAM_RULES = { partRoles, commandRoles, hazardRoles, callSigns, quick, scoreWeights } as unknown as {
  partRoles: Sourced<Record<string, RoleId>>;
  commandRoles: Sourced<Record<OrderKind, RoleId>>;
  hazardRoles: Sourced<Record<string, RoleId>>;
  callSigns: Sourced<string[]>;
  quick: Sourced<string[]>;
  scoreWeights: Sourced<{ objective: number; conflicts: number; votes: number }>;
};

/** The role a part belongs to (by its kind). */
export const partRole = (id: PartId): RoleId => TEAM_RULES.partRoles.value[PACK.parts[id].kind]!;

/** The role that recommends on a danger card (the Flight Director for a danger with no owner). */
export const hazardRole = (hazardType: string): RoleId => TEAM_RULES.hazardRoles.value[hazardType] ?? 'flight-director';

export const seatOf = (team: Team, id: SeatId): Seat | undefined => team.seats.find((s) => s.id === id);

/** The seat holding a role, if any. */
export const holderOf = (team: Team, role: RoleId): SeatId | undefined => team.seats.find((s) => s.roles.includes(role))?.id;

/** A seat may act as a role it holds, or as one nobody holds. */
export function mayActAs(team: Team, seat: SeatId, role: RoleId): boolean {
  const h = holderOf(team, role);
  return h === undefined ? seatOf(team, seat) !== undefined : h === seat;
}

export type TeamProblem = 'no-seats' | 'too-many-seats' | 'seat-id' | 'no-role' | 'role-twice' | 'call-sign';

/** Why a team cannot start, or undefined when it can. */
export function teamProblem(team: Team): TeamProblem | undefined {
  const seats = team.seats;
  if (seats.length === 0) return 'no-seats';
  if (seats.length > SEAT_IDS.length) return 'too-many-seats';
  if (new Set(seats.map((s) => s.id)).size !== seats.length || seats.some((s) => !SEAT_IDS.includes(s.id))) return 'seat-id';
  if (seats.some((s) => s.roles.length === 0)) return 'no-role';
  const roles = seats.flatMap((s) => s.roles);
  if (new Set(roles).size !== roles.length || roles.some((r) => !ROLE_IDS.includes(r))) return 'role-twice';
  const signs = seats.map((s) => s.callSign);
  if (new Set(signs).size !== signs.length || signs.some((c) => !TEAM_RULES.callSigns.value.includes(c))) return 'call-sign';
  return undefined;
}
