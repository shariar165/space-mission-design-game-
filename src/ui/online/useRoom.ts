// The Online Mission Room in React (spec: Online room). useRoomHost runs on the host screen: it opens a room on the
// relay, ticks it once a second (holds that run out, expiry, a code clash), keeps its mission under the resume code,
// and retries a relay that is offline. useRoomPhone runs on a phone: it joins with the code, keeps the phone's random
// token for a rejoin, replays the room's log into a session (stepSession, as the host does) and flies that session on
// to the host's clock for the controller. Every number on screen still comes from the engine.
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceTo } from '../../engine/ops/index';
import { OnlineClient, OnlineHost, phoneToken, type Deps, type PhoneState, type RoomMission } from '../../engine/team/online';
import { initialTeamState } from '../../engine/team/reduce';
import { sessionAt, stepSession, type TeamSession } from '../../engine/team/replay';
import type { TeamAct } from '../../engine/team/log';
import type { RoleId, SeatId } from '../../engine/team/roles';
import { makeResumeCode, makeRoomCode, resumeFresh, retryView, type RoomView } from '../../engine/team/room';
import { loadOnline, loadRooms, saveOnline, saveRooms } from '../saves';
import { roomOpener, type NoRelay } from './relay';

const TICK_MS = 1000;
/** How often a phone's controller flies its session on to the host's clock. */
const PHONE_FRAME_MS = 500;

export type HostPhase = 'idle' | 'opening' | 'open' | 'offline' | 'closed';

export interface RoomHost {
  phase: HostPhase;
  /** Why the relay is offline: not set up, the code could not load, or it did not answer. */
  why?: NoRelay | 'no-answer';
  host?: OnlineHost;
  view?: RoomView;
  /** The offline screen's countdown (TRY n · AUTO IN m:ss). */
  retry: { tries: number; nextIn_s: number };
  open: (mission: RoomMission) => void;
  /** Reopen a saved room by its resume code; false when this browser has no such room (or it is too old). */
  resume: (code: string) => boolean;
  retryNow: () => void;
  close: () => void;
}

export function useRoomHost(): RoomHost {
  const host = useRef<OnlineHost | undefined>(undefined);
  const mission = useRef<RoomMission | undefined>(undefined);
  const saved = useRef<string | undefined>(undefined);
  const [phase, setPhase] = useState<HostPhase>('idle');
  const [why, setWhy] = useState<RoomHost['why']>();
  const [, bump] = useState(0);
  const failed = useRef({ at: 0, tries: 0 });
  const off = useRef<(() => void)[]>([]);

  const drop = useCallback(() => {
    for (const f of off.current) f();
    off.current = [];
    host.current?.close('ended');
    host.current = undefined;
  }, []);

  const offline = useCallback((w: RoomHost['why']) => {
    failed.current = { at: Date.now(), tries: failed.current.tries + 1 };
    setWhy(w);
    setPhase('offline');
  }, []);

  /** Wire a host: re-render on each change, follow the relay's status, keep the mission under its resume code. */
  const adopt = useCallback(
    (h: OnlineHost) => {
      host.current = h;
      const keep = () => {
        if (!h.state.started) return;
        const rooms = loadRooms();
        const now = Date.now();
        for (const [k, r] of Object.entries(rooms)) if (!resumeFresh(r.savedAt, now)) delete rooms[k];
        rooms[h.state.resume] = h.save();
        saveRooms(rooms);
        saved.current = h.state.resume;
      };
      off.current.push(
        h.onChange(() => {
          if (h.status === 'offline') offline('no-answer');
          else if (h.status === 'open') setPhase((p) => (p === 'opening' || p === 'offline' ? 'open' : p));
          keep();
          bump((n) => n + 1);
        }),
      );
      if (h.status === 'open') setPhase('open');
      else if (h.status === 'offline') offline('no-answer');
    },
    [offline],
  );

  const deps = (open: Deps['open']): Deps => ({ open, now: Date.now, rand: Math.random });

  const open = useCallback(
    (m: RoomMission) => {
      drop();
      mission.current = m;
      setPhase('opening');
      void roomOpener().then((o) => {
        if (mission.current !== m) return;
        if (typeof o === 'string') return offline(o);
        adopt(new OnlineHost(deps(o), m, makeRoomCode(Math.random), makeResumeCode(Math.random)));
      });
    },
    [adopt, drop, offline],
  );

  const resume = useCallback(
    (code: string) => {
      const save = loadRooms()[code];
      if (!save || !resumeFresh(save.savedAt, Date.now())) return false;
      drop();
      mission.current = save.mission;
      setPhase('opening');
      void roomOpener().then((o) => {
        if (typeof o === 'string') return offline(o);
        adopt(OnlineHost.resume(deps(o), save));
      });
      return true;
    },
    [adopt, drop, offline],
  );

  const retryNow = useCallback(() => {
    const s = saved.current ? loadRooms()[saved.current] : undefined;
    if (s && host.current?.state.started) return void resume(s.resume);
    if (mission.current) open(mission.current);
  }, [open, resume]);

  const close = useCallback(() => {
    drop();
    mission.current = undefined;
    setPhase('idle');
  }, [drop]);

  // Once a second: holds run out, the room may expire, a code clash opens a fresh room, an offline relay is retried.
  useEffect(() => {
    if (phase === 'idle' || phase === 'closed') return;
    const id = setInterval(() => {
      const h = host.current;
      if (phase === 'offline') {
        // a relay that is not set up never comes: no point trying again
        if (why !== 'not-set-up' && retryView(failed.current.at, failed.current.tries, Date.now()).nextIn_s <= 0) retryNow();
        return bump((n) => n + 1);
      }
      if (!h) return;
      if (!h.state.started && h.clash() && mission.current) return open(mission.current);
      if (h.tick() === 'expired') setPhase('closed');
      bump((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, open, retryNow]);

  useEffect(() => drop, [drop]);

  const h = host.current;
  return {
    phase,
    ...(why ? { why } : {}),
    ...(h ? { host: h, view: h.view() } : {}),
    retry: retryView(failed.current.at, failed.current.tries, Date.now()),
    open,
    resume,
    retryNow,
    close,
  };
}

// ---------------------------------------------------------------------------------------------------------------

export interface RoomPhone {
  token: string;
  client?: OnlineClient;
  state?: PhoneState;
  why?: NoRelay;
  /** The room's mission as this phone's replay of the log has it. */
  session?: TeamSession;
  /** The session flown on to the host's clock: what the controller shows. */
  at?: TeamSession;
  retry: { tries: number; nextIn_s: number };
  join: (code: string, takeOver?: SeatId) => void;
  pick: (role?: RoleId) => void;
  act: (role: RoleId, act: TeamAct) => void;
  retryNow: () => void;
  leave: () => void;
}

function storedToken(): string {
  const v = loadOnline();
  if (v.token) return v.token;
  const token = phoneToken(Math.random);
  saveOnline({ token });
  return token;
}

export function useRoomPhone(): RoomPhone {
  const [token] = useState(storedToken);
  const client = useRef<OnlineClient | undefined>(undefined);
  const live = useRef<TeamSession | undefined>(undefined);
  const [session, setSession] = useState<TeamSession>();
  const [at, setAt] = useState<TeamSession>();
  const [why, setWhy] = useState<NoRelay>();
  const [, bump] = useState(0);
  const failed = useRef({ at: 0, tries: 0 });
  const last = useRef<{ code: string; takeOver?: SeatId } | undefined>(undefined);
  const off = useRef<(() => void)[]>([]);

  const drop = useCallback(() => {
    for (const f of off.current) f();
    off.current = [];
    client.current = undefined;
    live.current = undefined;
    setSession(undefined);
    setAt(undefined);
  }, []);

  const join = useCallback(
    (code: string, takeOver?: SeatId) => {
      drop();
      last.current = { code, ...(takeOver ? { takeOver } : {}) };
      saveOnline({ token, code });
      setWhy(undefined);
      void roomOpener().then((o) => {
        if (last.current?.code !== code) return;
        if (typeof o === 'string') {
          failed.current = { at: Date.now(), tries: failed.current.tries + 1 };
          setWhy(o);
          return bump((n) => n + 1);
        }
        const c = new OnlineClient({ open: o, now: Date.now, rand: Math.random }, code, token, takeOver);
        client.current = c;
        off.current.push(
          c.subscribe((a) => {
            const m = c.state.mission;
            if (!m) return;
            const s = live.current ?? { team: initialTeamState(m.base, m.shelf) };
            live.current = stepSession(s, a, { seed: m.seed }).session;
            setSession(live.current);
          }),
          c.onChange(() => {
            if (c.state.status === 'offline') failed.current = { at: Date.now(), tries: failed.current.tries + 1 };
            bump((n) => n + 1);
          }),
        );
        bump((n) => n + 1);
      });
    },
    [drop, token],
  );

  const retryNow = useCallback(() => {
    if (last.current) join(last.current.code, last.current.takeOver);
  }, [join]);

  const leave = useCallback(() => {
    client.current?.leave();
    last.current = undefined;
    saveOnline({ token });
    drop();
    bump((n) => n + 1);
  }, [drop, token]);

  // Twice a second: fly the session on to the host's clock; wait out a dropped host; retry an offline relay.
  useEffect(() => {
    const id = setInterval(() => {
      const c = client.current;
      if ((!c && why) || c?.state.status === 'offline') {
        if (why !== 'not-set-up' && retryView(failed.current.at, failed.current.tries, Date.now()).nextIn_s <= 0) retryNow();
        return bump((n) => n + 1);
      }
      if (!c) return;
      c.tick();
      const s = live.current;
      const t = c.missionT();
      if (s?.ops && t !== undefined) {
        setAt((prev) => (prev?.ops && prev.team === s.team && t >= prev.ops.t ? (t > prev.ops.t ? { ...prev, ops: advanceTo(prev.ops, t) } : prev) : sessionAt(s, t)));
      } else setAt(s);
    }, PHONE_FRAME_MS);
    return () => clearInterval(id);
  }, [why, retryNow]);

  // a new entry: start the controller's view from the session again (it is flown on at the next frame)
  useEffect(() => setAt(session), [session]);

  useEffect(() => drop, [drop]);

  const c = client.current;
  return {
    token,
    ...(c ? { client: c, state: c.state } : {}),
    ...(why ? { why } : {}),
    ...(session ? { session } : {}),
    ...(at ? { at } : {}),
    retry: retryView(failed.current.at, failed.current.tries, Date.now()),
    join,
    pick: (role) => c?.pick(role),
    act: (role, a) => c?.act(role, a),
    retryNow,
    leave,
  };
}
