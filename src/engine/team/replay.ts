// Team mode: a session is the team state plus the flight (spec: Team mode). Live play and replay apply log entries
// through the same stepSession, so the mission is a function of (base design, seed, team log): replayTeam rebuilds it.
import { advanceTo, applyOpsAction, finishOperations, startOperations, type StartOptions } from '../ops/index';
import type { OpsState } from '../ops/types';
import type { PartId } from '../pack';
import type { Design } from '../types';
import type { TeamAction } from './log';
import { applyTeamAction, initialTeamState, teamDesign, type TeamRefusal, type TeamState } from './reduce';

export interface TeamSession {
  team: TeamState;
  /** The flight, from the Flight Director's launch on. */
  ops?: OpsState;
}

/**
 * Apply one log entry: fly on to its time, apply it, start the flight on a launch, and send its orders at the
 * current mission time. Live play calls this with the flight already at that time, so nothing is flown twice.
 */
export function stepSession(sess: TeamSession, a: TeamAction, opts: StartOptions): { session: TeamSession; refused?: TeamRefusal } {
  let ops = sess.ops && a.t !== undefined ? advanceTo(sess.ops, a.t) : sess.ops;
  const r = applyTeamAction(sess.team, a, ops);
  if (r.launch) ops = startOperations(teamDesign(r.state), opts);
  for (const op of r.emit) ops = applyOpsAction(ops!, op);
  return { session: { team: r.state, ...(ops ? { ops } : {}) }, ...(r.refused ? { refused: r.refused } : {}) };
}

/** Rebuild a team mission from its log, then fly it to the end the way FINISH MISSION does. */
export function replayTeam(
  base: Design,
  shelf: PartId[],
  opts: StartOptions,
  log: readonly TeamAction[],
): { design: Design; ops?: OpsState; team: TeamState } {
  let sess: TeamSession = { team: initialTeamState(base, shelf) };
  for (const a of log) sess = stepSession(sess, a, opts).session;
  return { design: teamDesign(sess.team), team: sess.team, ...(sess.ops ? { ops: finishOperations(sess.ops) } : {}) };
}
