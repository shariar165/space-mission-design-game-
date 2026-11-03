// A phone controller's view (spec: Online room; mockups T6c–f). Each phone shows only its own role: what the room's
// danger card waits for (the turn strip and its four dots, one per role) and what this phone may do on it now. The
// numbers on the role's panels come from the engine views the console already uses (flyTiles, flyCard, dsnOptions,
// nextPass, scienceTargetsView); this module only answers "whose turn is it, and is it mine".
import { consoleView, dsnOptions, type ConsoleCommand } from '../ops/console';
import { missionProgress } from '../ops/fly';
import { nextPass } from '../ops/scienceView';
import type { OpsState } from '../ops/types';
import { cardVote, type CardStage, type CardVoteView } from './fly';
import type { TeamState } from './reduce';
import { ROLE_IDS, type RoleId, type SeatId } from './roles';

const DAY_S = 86_400;

/** What this phone may do on the open danger card. */
export type CardAction = 'recommend' | 'vote' | 'call' | 'wait' | 'done';

export interface CardTurn {
  decisionId: string;
  hazardType: string;
  vote: CardVoteView;
  /** The roles the card waits for now (the dots light in their colours). */
  waitingOn: RoleId[];
  /** One dot per role, in role order: lit while the card waits for it. */
  dots: { role: RoleId; on: boolean }[];
  /** What this phone may do now. */
  action: CardAction;
  /** This phone's voice on the card so far. */
  mine?: string;
}

const rolesOf = (s: TeamState, seat: SeatId): RoleId[] => s.team?.seats.find((x) => x.id === seat)?.roles ?? [];

/** The card the flight shows now (an open danger), seen from one seat. */
export function cardTurn(s: TeamState, ops: OpsState, seat: SeatId): CardTurn | undefined {
  const card = consoleView(ops).alert;
  if (!card) return undefined;
  const vote = cardVote(s, card.decisionId, card.type);
  const mineRoles = rolesOf(s, seat);
  const waitingOn = waitingRoles(s, vote);
  const isDirector = vote.director === seat;
  const voter = vote.voters.find((v) => v.seat === seat);
  const recommends = vote.recommender.seat === undefined ? true : vote.recommender.seat === seat;
  const action: CardAction =
    vote.stage === 'settled'
      ? 'done'
      : vote.stage === 'recommend'
        ? recommends && mineRoles.length > 0
          ? 'recommend'
          : 'wait'
        : isDirector
          ? 'call'
          : voter && voter.voice === undefined
            ? 'vote'
            : 'wait';
  const mine = isDirector ? vote.result?.optionId : voter?.voice;
  return {
    decisionId: card.decisionId,
    hazardType: card.type,
    vote,
    waitingOn,
    dots: ROLE_IDS.map((role) => ({ role, on: waitingOn.includes(role) })),
    action,
    ...(mine !== undefined ? { mine } : {}),
  };
}

/** The Flight Director's tiles: the mission day and how long the mission still runs. */
export function directorView(ops: OpsState): { day: number; endsIn_s: number } {
  return { day: consoleView(ops).clock.day, endsIn_s: missionProgress(ops).daysLeft * DAY_S };
}

/** Comms & Ops' panel (mockup T6f): the next DSN pass, the light time, the orders on their way, the big-dish key. */
export interface CommsView {
  /** Seconds of mission time to the next pass (absent: none in view). */
  passIn_s?: number;
  passDish?: 34 | 70;
  oneWay_s: number;
  /** Orders still crossing to the craft, oldest first. */
  queue: ConsoleCommand[];
  /** The 70 m dish for the first day a booking can still be made; absent when it cannot be booked now. */
  book?: { day: number; dish: 70; hours: number; booked: boolean };
}

export function commsView(ops: OpsState): CommsView {
  const v = consoleView(ops);
  const pass = nextPass(ops);
  const dsn = dsnOptions(ops);
  const big = dsn.options.find((o) => o.dish === 70);
  return {
    ...(pass ? { passIn_s: Math.max(0, pass.open - ops.t) * DAY_S, passDish: pass.dish } : {}),
    oneWay_s: v.clock.oneWay_s,
    queue: v.commands.filter((c) => c.status === 'in-flight'),
    ...(big && !dsn.refused && ops.status === 'flying' ? { book: { day: dsn.day, dish: 70 as const, hours: big.hours, booked: big.booked } } : {}),
  };
}

function waitingRoles(s: TeamState, v: CardVoteView): RoleId[] {
  const stage: CardStage = v.stage;
  if (stage === 'recommend') return [v.recommender.role];
  if (stage === 'vote') {
    const out = new Set<RoleId>();
    for (const x of v.voters) if (x.voice === undefined) for (const r of rolesOf(s, x.seat)) out.add(r);
    return ROLE_IDS.filter((r) => out.has(r));
  }
  if (stage === 'call') return v.director ? ['flight-director'] : [];
  return [];
}
