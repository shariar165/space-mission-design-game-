// Team mode: the one action log (spec: Team mode). Every entry names the seat, the role it acts as and the action.
// Local play and (later) online play write the same entries through a Transport; the mission is a function of the
// base design, the seed and this log (replay.ts).
import type { ObjectiveId } from '../objectives';
import type { OpsOp } from '../ops/types';
import type { CalendarDay, PartId } from '../pack';
import type { RoleId, SeatId, Team } from './roles';

export type { OpsOp };

export type TeamAct =
  /** The first entry: who plays and which roles each seat holds. */
  | { kind: 'setup'; team: Team }
  | { kind: 'objective'; objective: ObjectiveId }
  | { kind: 'pack'; part: PartId }
  | { kind: 'unpack'; part: PartId }
  /** The Flight Director launches on this day: the design is fixed from here on. */
  | { kind: 'launch'; day: CalendarDay }
  /** An order to the craft or the ground (observe, power plan, standing orders, DSN booking, the extension). */
  | { kind: 'ops'; op: OpsOp }
  /** Danger cards: the related role recommends, the others vote, the Flight Director calls. */
  | { kind: 'recommend'; decisionId: string; optionId: string }
  | { kind: 'vote'; decisionId: string; optionId: string }
  | { kind: 'call'; decisionId: string; optionId: string }
  /** A preset quick message (TEAM_RULES.quick): there is no free text. */
  | { kind: 'say'; quick: string };

export interface TeamAction {
  /** Order in the log, given by the transport. */
  seq: number;
  seat: SeatId;
  /** The role the seat acts as. */
  role: RoleId;
  /** Mission time the action was sent at (actions in flight). */
  t?: number;
  act: TeamAct;
}
