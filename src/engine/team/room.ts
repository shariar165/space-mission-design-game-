// The Online Mission Room's model (spec: Online room; mockups T6, T7). Pure: the clock (`now`, in ms) and the dice
// (`rand`) are passed in. The host screen keeps one RoomState: which phone (a random token, never a name) sits in which
// seat with which call sign and role, who is linked, who dropped and since when, the roles handed on while a phone
// was away, each phone's rate limit, and when the room expires. Everything the room screens show comes from roomView,
// so the UI never computes a number. The mission itself is still (base design, seed, team log): the room only decides
// who may send which entry, and when the host's clock must hold.
import onlineJson from '../../data/online.json';
import type { Sourced } from '../types';
import type { TeamAct } from './log';
import { holderOf, ROLE_IDS, SEAT_IDS, TEAM_RULES, type RoleId, type SeatId, type Team } from './roles';

const { protocol, maxSeats, seatHold_s, hostGrace_s, roomTtl_h, idleClose_min, resumeTtl_days, connectTimeout_s, retryEvery_s, clockResync_s, clockDrift_days, rate_perS, burst, codeWords, codeAlphabet } = onlineJson;

/** The room's rules (online.json; every one a game rule, listed in TODO_DATA.md). */
export const ONLINE_RULES = { protocol, maxSeats, seatHold_s, hostGrace_s, roomTtl_h, idleClose_min, resumeTtl_days, connectTimeout_s, retryEvery_s, clockResync_s, clockDrift_days, rate_perS, burst, codeWords, codeAlphabet } as unknown as {
  protocol: Sourced<number>;
  maxSeats: Sourced<number>;
  seatHold_s: Sourced<number>;
  hostGrace_s: Sourced<number>;
  roomTtl_h: Sourced<number>;
  idleClose_min: Sourced<number>;
  resumeTtl_days: Sourced<number>;
  connectTimeout_s: Sourced<number>;
  retryEvery_s: Sourced<number>;
  clockResync_s: Sourced<number>;
  clockDrift_days: Sourced<number>;
  rate_perS: Sourced<number>;
  burst: Sourced<number>;
  codeWords: Sourced<string[]>;
  codeAlphabet: Sourced<string>;
};

/** The relay the site talks through (public: the publishable key is meant to be in a web page). */
export const RELAY_CONFIG: { provider: string; url: string; publishableKey: string } = onlineJson.relay;

/** The relay is set up (a project URL and its publishable key are in online.json). */
export const relayConfigured = (): boolean => RELAY_CONFIG.url.length > 0 && RELAY_CONFIG.publishableKey.length > 0;

const MS = (s: number) => s * 1000;

// ---------------------------------------------------------------------------------------------------------------
// Codes

const pick = <T>(xs: readonly T[], rand: () => number): T => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))]!;

/** A room code: a space word and three characters, e.g. MARS-7K2. */
export function makeRoomCode(rand: () => number): string {
  const abc = [...ONLINE_RULES.codeAlphabet.value];
  return `${pick(ONLINE_RULES.codeWords.value, rand)}-${pick(abc, rand)}${pick(abc, rand)}${pick(abc, rand)}`;
}

/**
 * A resume code: seven characters from the alphabet, e.g. K7QB-2X4. It is made when the room opens and keys the
 * room's save in the host's browser, so it stays the same all mission (the mockup's day suffix would change).
 */
export function makeResumeCode(rand: () => number): string {
  const abc = [...ONLINE_RULES.codeAlphabet.value];
  const n = (k: number) => Array.from({ length: k }, () => pick(abc, rand)).join('');
  return `${n(4)}-${n(3)}`;
}

/** What a player typed, as a room code: upper case, spaces and dashes dropped, the dash put back after the word. */
export function cleanRoomCode(typed: string): string {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4, 7)}` : s;
}

/** A code the relay can be asked about: a code word and three characters from the alphabet. */
export function validRoomCode(code: string): boolean {
  const m = /^([A-Z]{4})-([A-Z0-9]{3})$/.exec(code);
  if (!m) return false;
  const abc = ONLINE_RULES.codeAlphabet.value;
  return ONLINE_RULES.codeWords.value.includes(m[1]!) && [...m[2]!].every((c) => abc.includes(c));
}

/** A resume code as makeResumeCode writes it. */
export function validResumeCode(code: string): boolean {
  const abc = ONLINE_RULES.codeAlphabet.value;
  return /^[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(code) && [...code.replace('-', '')].every((c) => abc.includes(c));
}

/** What a player typed, as a resume code. */
export function cleanResumeCode(typed: string): string {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4, 7)}` : s;
}

// ---------------------------------------------------------------------------------------------------------------
// The room

/** Where the room's mission is (the host screen's step). */
export type RoomStage = 'lobby' | 'objective' | 'pack' | 'fly' | 'report';

export interface RoomSeat {
  /** The phone's random token (kept in its browser): never a name. */
  token: string;
  seat: SeatId;
  callSign: string;
  /** The role picked in the lobby (after the start, the team's roles are the log's). */
  role?: RoleId;
  linked: boolean;
  /** When the phone dropped (ms), while it is away. */
  awaySince?: number;
}

export interface RoomState {
  code: string;
  resume: string;
  openedAt: number;
  /** The last thing sent or a phone linked (ms): an idle room closes. */
  activeAt: number;
  stage: RoomStage;
  started: boolean;
  seats: RoomSeat[];
  /** Roles handed on from a seat that was away: they go back when it returns. */
  handed: Partial<Record<RoleId, SeatId>>;
  buckets: Record<string, { tokens: number; at: number }>;
}

export function openRoom(code: string, resume: string, now: number): RoomState {
  return { code, resume, openedAt: now, activeAt: now, stage: 'lobby', started: false, seats: [], handed: {}, buckets: {} };
}

export type RoomRefusal = 'full' | 'started' | 'taken' | 'unknown-phone' | 'too-fast' | 'not-your-role' | 'no-director' | 'protocol' | 'closed' | 'not-away';

type Out = { state: RoomState; refused?: RoomRefusal };

const seatOfToken = (s: RoomState, token: string) => s.seats.find((x) => x.token === token);

/**
 * A phone says hello. A known token is a rejoin: it links again (and keeps its seat). A new token takes the next free
 * seat and call sign, in the lobby only; after the start it may only take over a seat that is away (`takeOver`).
 */
export function joinRoom(state: RoomState, token: string, now: number, takeOver?: SeatId): Out {
  const s = { ...state, seats: state.seats.map((x) => ({ ...x })), activeAt: now };
  const me = seatOfToken(s, token);
  if (me) {
    me.linked = true;
    delete me.awaySince;
    return { state: s };
  }
  if (takeOver) {
    const away = s.seats.find((x) => x.seat === takeOver && !x.linked);
    if (!away) return { state: state, refused: 'not-away' };
    away.token = token;
    away.linked = true;
    delete away.awaySince;
    return { state: s };
  }
  if (s.started) return { state: state, refused: 'started' };
  if (s.seats.length >= ONLINE_RULES.maxSeats.value) return { state: state, refused: 'full' };
  const seat = SEAT_IDS.find((id) => !s.seats.some((x) => x.seat === id))!;
  const callSign = TEAM_RULES.callSigns.value.find((c) => !s.seats.some((x) => x.callSign === c))!;
  s.seats.push({ token, seat, callSign, linked: true });
  return { state: s };
}

/** A phone picks a role in the lobby (or none, to change its mind). A role another phone holds is taken. */
export function pickRole(state: RoomState, token: string, role: RoleId | undefined): Out {
  const me = seatOfToken(state, token);
  if (!me) return { state, refused: 'unknown-phone' };
  if (state.started) return { state, refused: 'started' };
  if (role && state.seats.some((x) => x.token !== token && x.role === role)) return { state, refused: 'taken' };
  const set = (x: RoomSeat): RoomSeat => {
    const { role: _old, ...rest } = x;
    return role ? { ...rest, role } : rest;
  };
  return { state: { ...state, seats: state.seats.map((x) => (x.token === token ? set(x) : x)) } };
}

/** A phone left the lobby (LEAVE ROOM), or the host freed its slot: the seat is gone. After the start a seat stays (away). */
export function leaveRoom(state: RoomState, token: string, now: number): RoomState {
  if (!state.started) return { ...state, seats: state.seats.filter((x) => x.token !== token), activeAt: now };
  return dropPhone(state, token, now);
}

/** A phone's link dropped (the relay's presence says it is gone). */
export function dropPhone(state: RoomState, token: string, now: number): RoomState {
  return { ...state, seats: state.seats.map((x) => (x.token === token && x.linked ? { ...x, linked: false, awaySince: now } : x)) };
}

/** START MISSION: needs a Flight Director. Returns the team for the log's setup entry. */
export function startRoom(state: RoomState, now: number): { state: RoomState; team?: Team; refused?: RoomRefusal } {
  if (state.started) return { state, refused: 'started' };
  const team = teamFromSeats(state.seats);
  if (!team) return { state, refused: 'no-director' };
  return { state: { ...state, started: true, stage: 'objective', activeAt: now }, team };
}

/**
 * The team the room starts with: each phone holds the role it picked, and the Flight Director's phone also holds every
 * role nobody picked (mockup T6a: "START NOW AND COMET HOLDS ENG + COM"). A phone that picked nothing sits out (it
 * may get a role handed to it later). Undefined without a Flight Director.
 */
export function teamFromSeats(seats: readonly RoomSeat[]): Team | undefined {
  const fd = seats.find((x) => x.role === 'flight-director');
  if (!fd) return undefined;
  const picked = new Set(seats.map((x) => x.role).filter((r): r is RoleId => r !== undefined));
  const extra = ROLE_IDS.filter((r) => !picked.has(r));
  const holders = seats.filter((x) => x.role !== undefined);
  return {
    seats: [...holders]
      .sort((a, b) => SEAT_IDS.indexOf(a.seat) - SEAT_IDS.indexOf(b.seat))
      .map((x) => ({ id: x.seat, callSign: x.callSign, roles: x === fd ? ROLE_IDS.filter((r) => r === 'flight-director' || extra.includes(r)) : [x.role!] })),
  };
}

export function setStage(state: RoomState, stage: RoomStage): RoomState {
  return state.stage === stage ? state : { ...state, stage };
}

/** One action from a phone: the steady rate with a burst (a token bucket per phone). */
export function rateGate(state: RoomState, token: string, now: number): { state: RoomState; ok: boolean } {
  const cap = ONLINE_RULES.burst.value;
  const b = state.buckets[token] ?? { tokens: cap, at: now };
  const tokens = Math.min(cap, b.tokens + ((now - b.at) / 1000) * ONLINE_RULES.rate_perS.value);
  if (tokens < 1) return { state: { ...state, buckets: { ...state.buckets, [token]: { tokens, at: now } } }, ok: false };
  return { state: { ...state, activeAt: now, buckets: { ...state.buckets, [token]: { tokens: tokens - 1, at: now } } }, ok: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Hand-overs while a phone is away

/** A hand entry the host sends for the room: as `seat` (the role's holder gives it on), acting as `role`. */
export interface RoomHand {
  seat: SeatId;
  role: RoleId;
  act: Extract<TeamAct, { kind: 'hand' }>;
}

const linkedSeats = (s: RoomState) => s.seats.filter((x) => x.linked);

/** Who takes a role from an away seat: the Flight Director's seat, or (if that is the one away) the first linked seat. */
function heir(team: Team, s: RoomState, away: SeatId): SeatId | undefined {
  const fd = holderOf(team, 'flight-director');
  const inTeam = new Set(team.seats.map((x) => x.id));
  if (fd && fd !== away && linkedSeats(s).some((x) => x.seat === fd)) return fd;
  return linkedSeats(s).find((x) => x.seat !== away && inTeam.has(x.seat))?.seat;
}

/** HAND NOW (or the hold ran out): every role of the away seat goes to its heir; the room remembers where each came from. */
export function handAway(state: RoomState, team: Team, away: SeatId): { state: RoomState; hands: RoomHand[] } {
  const roles = team.seats.find((x) => x.id === away)?.roles ?? [];
  const to = heir(team, state, away);
  if (!to || roles.length === 0) return { state, hands: [] };
  const hands = roles.map((role) => ({ seat: away, role, act: { kind: 'hand' as const, role, to } }));
  const handed = { ...state.handed };
  for (const r of roles) handed[r] ??= away;
  return { state: { ...state, handed }, hands };
}

/** A phone came back: the roles handed on from its seat go back to it, from whoever holds them now. */
export function reclaim(state: RoomState, team: Team, seat: SeatId): { state: RoomState; hands: RoomHand[] } {
  const roles = ROLE_IDS.filter((r) => state.handed[r] === seat);
  const hands: RoomHand[] = [];
  for (const role of roles) {
    const now = holderOf(team, role);
    if (now && now !== seat) hands.push({ seat: now, role, act: { kind: 'hand', role, to: seat } });
  }
  const handed = { ...state.handed };
  for (const r of roles) delete handed[r];
  return { state: { ...state, handed }, hands };
}

// ---------------------------------------------------------------------------------------------------------------
// What the room screens show

export type SlotStatus = 'open' | 'linked' | 'away' | 'handed';

export interface RoomSlot {
  role: RoleId;
  seat?: SeatId;
  callSign?: string;
  status: SlotStatus;
  /** Away: seconds left before the role passes on. */
  holdLeft_s?: number;
  /** Handed: the call sign holding it for the away phone. */
  heldBy?: string;
}

export type RoomMessage =
  | { kind: 'need-director' }
  | { kind: 'empty'; roles: RoleId[]; director: string }
  | { kind: 'ready' }
  /** A phone is away: its role is held (the bar runs down, `holdFraction` 1 → 0); HAND NOW gives it to `heir`. */
  | { kind: 'away'; callSign: string; role: RoleId; seat: SeatId; holdLeft_s: number; holdFraction: number; heir?: string }
  | { kind: 'handed'; callSign: string; role: RoleId; heldBy: string }
  | { kind: 'running' };

export interface RoomView {
  code: string;
  resume: string;
  stage: RoomStage;
  started: boolean;
  slots: RoomSlot[];
  /** Phones linked now, and the most there can be. */
  linked: number;
  max: number;
  /** START MISSION is lit: a Flight Director has joined. */
  canStart: boolean;
  message: RoomMessage;
  /** The flight's clock must hold: a phone is away and its role is still held for it. */
  holding: boolean;
  /** Seats whose hold ran out with roles still on them: the host hands those roles on now. */
  due: SeatId[];
  /** Seconds before the room closes (time limit or idle), and why it would. */
  closesIn_s: number;
  closeWhy: 'time' | 'idle';
}

const left_s = (since: number, hold_s: number, now: number) => Math.max(0, Math.ceil(hold_s - (now - since) / 1000));

export function roomView(s: RoomState, now: number, team?: Team): RoomView {
  const hold = ONLINE_RULES.seatHold_s.value;
  const seatBy = (id?: SeatId) => s.seats.find((x) => x.seat === id);
  const slots: RoomSlot[] = ROLE_IDS.map((role) => {
    if (!s.started || !team) {
      const x = s.seats.find((y) => y.role === role);
      return x ? { role, seat: x.seat, callSign: x.callSign, status: x.linked ? 'linked' : 'away', ...(x.awaySince !== undefined ? { holdLeft_s: left_s(x.awaySince, hold, now) } : {}) } : { role, status: 'open' };
    }
    const from = s.handed[role];
    const holder = seatBy(holderOf(team, role));
    if (from !== undefined && holder && holder.seat !== from) {
      const owner = seatBy(from)!;
      return { role, seat: owner.seat, callSign: owner.callSign, status: 'handed', heldBy: holder.callSign };
    }
    if (!holder) return { role, status: 'open' };
    return {
      role,
      seat: holder.seat,
      callSign: holder.callSign,
      status: holder.linked ? 'linked' : 'away',
      ...(holder.awaySince !== undefined ? { holdLeft_s: left_s(holder.awaySince, hold, now) } : {}),
    };
  });
  const linked = s.seats.filter((x) => x.linked).length;
  const director = s.seats.find((x) => x.role === 'flight-director');
  const awaySlots = slots.filter((x) => x.status === 'away');
  const handedSlot = slots.find((x) => x.status === 'handed');
  const holding = s.started && awaySlots.some((x) => (x.holdLeft_s ?? 0) > 0);
  const due = s.started && team ? [...new Set(awaySlots.filter((x) => (x.holdLeft_s ?? 0) <= 0).map((x) => x.seat!))] : [];
  let message: RoomMessage;
  if (awaySlots.length && s.started) {
    const a = awaySlots[0]!;
    const to = team ? heir(team, s, a.seat!) : undefined;
    const heirSign = s.seats.find((x) => x.seat === to)?.callSign;
    message = { kind: 'away', callSign: a.callSign!, role: a.role, seat: a.seat!, holdLeft_s: a.holdLeft_s ?? 0, holdFraction: (a.holdLeft_s ?? 0) / hold, ...(heirSign ? { heir: heirSign } : {}) };
  } else if (handedSlot) message = { kind: 'handed', callSign: handedSlot.callSign!, role: handedSlot.role, heldBy: handedSlot.heldBy! };
  else if (s.started) message = { kind: 'running' };
  else if (!director) message = { kind: 'need-director' };
  else {
    const empty = slots.filter((x) => x.status === 'open').map((x) => x.role);
    message = empty.length ? { kind: 'empty', roles: empty, director: director.callSign } : { kind: 'ready' };
  }
  const byTime = s.openedAt + MS(ONLINE_RULES.roomTtl_h.value * 3600) - now;
  const byIdle = linked === 0 ? s.activeAt + MS(ONLINE_RULES.idleClose_min.value * 60) - now : Infinity;
  return {
    code: s.code,
    resume: s.resume,
    stage: s.stage,
    started: s.started,
    slots,
    linked,
    max: ONLINE_RULES.maxSeats.value,
    canStart: !s.started && director !== undefined,
    message,
    holding,
    due,
    closesIn_s: Math.max(0, Math.ceil(Math.min(byTime, byIdle) / 1000)),
    closeWhy: byIdle < byTime ? 'idle' : 'time',
  };
}

/** The host's grace for itself: the phones end the room this long after the host screen dropped. */
export const hostGone = (since: number, now: number): boolean => now - since >= MS(ONLINE_RULES.hostGrace_s.value);

/** Seconds a phone still waits for a dropped host screen. */
export const hostGraceLeft_s = (since: number, now: number): number => left_s(since, ONLINE_RULES.hostGrace_s.value, now);

/** The offline screens' countdown: the next try of a relay that is not answering. */
export function retryView(failedAt: number, tries: number, now: number): { tries: number; nextIn_s: number } {
  return { tries, nextIn_s: left_s(failedAt, ONLINE_RULES.retryEvery_s.value, now) };
}

/** A saved room (the host's resume code) is still good. */
export const resumeFresh = (savedAt: number, now: number): boolean => now - savedAt < MS(ONLINE_RULES.resumeTtl_days.value * 86400);

// ---------------------------------------------------------------------------------------------------------------
// The flight clock the host shares

export interface RoomClock {
  /** Mission time (days) at `at`. */
  t: number;
  /** Mission days a minute while it runs. */
  speed: number;
  running: boolean;
  /** Wall time (ms) the clock was read on the host. */
  at: number;
}

/** A phone's mission time now: the host's last clock, run on at its speed (a held clock stays put). */
export function clockAt(c: RoomClock, now: number): number {
  return c.running ? c.t + (c.speed * Math.max(0, now - c.at)) / 60_000 : c.t;
}

