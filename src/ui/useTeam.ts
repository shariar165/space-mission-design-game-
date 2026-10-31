// Team mode on one shared screen (spec: Team mode). Every team action goes through one Transport (LocalTransport
// now, an online one later) and each log entry is applied with the engine's stepSession, the same function replay
// uses, so what the screen shows is always (base design, seed, team log).
import { useCallback, useRef, useState } from 'react';
import type { StartOptions } from '../engine/ops/index';
import type { PartId } from '../engine/pack';
import type { TeamAct, TeamAction } from '../engine/team/log';
import { initialTeamState } from '../engine/team/reduce';
import { stepSession, type TeamSession } from '../engine/team/replay';
import type { RoleId, Team } from '../engine/team/roles';
import { actorFor } from '../engine/team/setup';
import { LocalTransport, type Transport } from '../engine/team/transport';
import type { Design } from '../engine/types';

export interface TeamPlay {
  /** The session so far (absent until a team starts). */
  session?: TeamSession;
  /** A new session: the setup entry is the log's first. */
  start: (team: Team, base: Design, shelf: PartId[], opts: StartOptions) => void;
  /**
   * Act as a role: on a shared screen the role's holder (or the first seat, for an open role) sends it. In flight,
   * `t` is the mission time on screen: the team's flight is flown to it before the entry applies.
   */
  send: (role: RoleId, act: TeamAct, t?: number) => void;
  /** The seed and options the team's flight starts with (Fly & Survive flies the same mission). */
  opts?: StartOptions;
  /** End the session (leaving Team mode). */
  stop: () => void;
  /** The log so far, in order (empty before a start). */
  log: readonly TeamAction[];
  /** The session as of the last entry sent (read at once, before the screen re-renders). */
  current: () => TeamSession | undefined;
}

export function useTeam(): TeamPlay {
  const transport = useRef<Transport | undefined>(undefined);
  const live = useRef<TeamSession | undefined>(undefined);
  const unsubscribe = useRef<(() => void) | undefined>(undefined);
  const [session, setSession] = useState<TeamSession>();
  const [opts, setOpts] = useState<StartOptions>();

  const stop = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = undefined;
    transport.current = undefined;
    live.current = undefined;
    setSession(undefined);
    setOpts(undefined);
  }, []);

  const start = useCallback(
    (team: Team, base: Design, shelf: PartId[], opts: StartOptions) => {
      stop();
      const t = new LocalTransport();
      live.current = { team: initialTeamState(base, shelf) };
      unsubscribe.current = t.subscribe((a) => {
        live.current = stepSession(live.current!, a, opts).session;
        setSession(live.current);
      });
      transport.current = t;
      setOpts(opts);
      t.send({ seat: actorFor(team, 'flight-director'), role: 'flight-director', act: { kind: 'setup', team } });
    },
    [stop],
  );

  const send = useCallback((role: RoleId, act: TeamAct, t?: number) => {
    const team = live.current?.team.team;
    if (!transport.current || !team) return;
    transport.current.send({ seat: actorFor(team, role), role, act, ...(t !== undefined ? { t } : {}) });
  }, []);

  // the log is read on each render: every entry re-renders through setSession
  const log = transport.current?.log() ?? [];
  const current = useCallback(() => live.current, []);
  return { ...(session ? { session } : {}), start, send, stop, log, current, ...(opts ? { opts } : {}) };
}
