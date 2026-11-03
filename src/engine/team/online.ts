// The Online Mission Room's protocol (spec: Online room). The host screen runs the engine and owns the one log; each
// phone sends role-tagged actions; the host checks each one (the protocol version, a known phone, the rate limit and
// the role) and puts the accepted ones on the log, then broadcasts each entry with its place (seq). Phones rebuild the
// mission from (base design, seed, log) with the same stepSession, so every screen shows one mission.
//
// OnlineHost is the Transport the host's useTeam runs on (it wraps a LocalTransport, so delivery on the host stays
// synchronous). OnlineClient is a phone's Transport: its log is the host's entries in seq order; a gap asks the host
// to catch it up. Time in flight is the host's: an entry's mission time is stamped by the host, and the host shares
// its clock (RoomClock) so a phone shows the same day.
import type { OpsOp } from '../ops/types';
import type { PartId } from '../pack';
import type { Design } from '../types';
import type { TeamAct, TeamAction } from './log';
import { applyTeamAction, initialTeamState, type TeamRefusal, type TeamState } from './reduce';
import { Listeners, type OpenRelay, type Peer, type Relay, type RelayStatus } from './relay';
import { mayActAs, type RoleId, type SeatId, type Team } from './roles';
import {
  clockAt,
  dropPhone,
  handAway,
  hostGone,
  joinRoom,
  leaveRoom,
  ONLINE_RULES,
  openRoom,
  pickRole,
  rateGate,
  reclaim,
  roomView,
  setStage,
  startRoom,
  type RoomClock,
  type RoomRefusal,
  type RoomSeat,
  type RoomStage,
  type RoomState,
  type RoomView,
} from './room';
import { LocalTransport, type Transport } from './transport';

export const PROTOCOL = ONLINE_RULES.protocol.value;

/** The relay channel of a room code. */
export const channelFor = (code: string) => `sd-room-${code}`;

/** The mission every screen rebuilds: the base design, the shelf and the seed (the log is the rest). */
export interface RoomMission {
  base: Design;
  shelf: PartId[];
  seed: number;
}

/** What phones see of the room: seats without their tokens. */
export interface RoomPublic {
  code: string;
  resume: string;
  stage: RoomStage;
  started: boolean;
  seats: { seat: SeatId; callSign: string; role?: RoleId; linked: boolean }[];
}

type Base = { v: number; from: string };

export type PhoneMsg =
  | (Base & { type: 'hello'; since: number; takeOver?: SeatId })
  | (Base & { type: 'pick'; role?: RoleId })
  | (Base & { type: 'act'; nonce: number; role: RoleId; act: TeamAct })
  | (Base & { type: 'bye' })
  /** A heartbeat: a phone that has sent nothing for beat_s is still here. */
  | (Base & { type: 'beat' });

export type HostMsg =
  | (Base & { type: 'room'; room: RoomPublic; last: number })
  | (Base & { type: 'welcome'; to: string; seat: SeatId; callSign: string })
  | (Base & { type: 'sync'; to: string; mission: RoomMission; entries: TeamAction[]; clock?: RoomClock })
  | (Base & { type: 'entry'; entry: TeamAction })
  | (Base & { type: 'clock'; clock: RoomClock; last: number })
  | (Base & { type: 'refused'; to: string; nonce?: number; reason: RoomRefusal | TeamRefusal })
  | (Base & { type: 'closed'; reason: 'expired' | 'ended' })
  /** The host screen's heartbeat, with its log's length (a phone that missed the last entries asks for them). */
  | (Base & { type: 'pulse'; last: number });

export type RoomMsg = PhoneMsg | HostMsg;

/** A message without its version and sender (the sending end adds them). */
type Body<T> = T extends unknown ? Omit<T, 'v' | 'from'> : never;

const isHostMsg = (m: RoomMsg): m is HostMsg => m.type === 'room' || m.type === 'welcome' || m.type === 'sync' || m.type === 'entry' || m.type === 'clock' || m.type === 'refused' || m.type === 'closed' || m.type === 'pulse';

/** The host screen's flight: the mission time now, and how to send an order the way the console sends it. */
export interface FlightLink {
  t(): number;
  /** Run a phone's order through the screen's own console (it logs it at the mission time). False: not sent. */
  op(op: OpsOp): boolean;
}

/** Everything the host browser keeps under the resume code. */
export interface RoomSave {
  code: string;
  resume: string;
  mission: RoomMission;
  log: TeamAction[];
  stage: RoomStage;
  seats: RoomSeat[];
  handed: RoomState['handed'];
  savedAt: number;
}

export interface Deps {
  open: OpenRelay<RoomMsg>;
  now: () => number;
  rand: () => number;
}

/** The team and the launch as the log has them so far (setup, hand and launch entries; their checks need no flight). */
function teamFold(s: TeamState, a: TeamAction): TeamState {
  return a.act.kind === 'setup' || a.act.kind === 'hand' || a.act.kind === 'launch' ? applyTeamAction(s, a).state : s;
}

const randomKey = (rand: () => number) => Array.from({ length: 16 }, () => Math.floor(rand() * 16).toString(16)).join('');

// ---------------------------------------------------------------------------------------------------------------

export class OnlineHost implements Transport {
  readonly key: string;
  private relay: Relay<RoomMsg>;
  private local: LocalTransport;
  private room: RoomState;
  private teamState: TeamState;
  private flight: FlightLink | undefined;
  private clock: RoomClock | undefined;
  private clockSent = 0;
  /** The clock the phones run on (the last one shared). */
  private sent: RoomClock | undefined;
  private peers: Peer[] = [];
  /** Keys presence has shown at least once, and the keys in its last list. */
  private seen = new Set<string>();
  private present = new Set<string>();
  /** When each phone was last heard from (any message), and when the host last sent one. */
  private heard = new Map<string, number>();
  private postedAt = 0;
  private changes = new Listeners<void>();
  status: RelayStatus = 'connecting';

  constructor(
    private deps: Deps,
    readonly mission: RoomMission,
    code: string,
    resume: string,
    saved?: RoomSave,
  ) {
    this.key = `host-${randomKey(deps.rand)}`;
    const now = deps.now();
    this.local = new LocalTransport(saved?.log ?? []);
    this.teamState = (saved?.log ?? []).reduce(teamFold, initialTeamState(mission.base, mission.shelf));
    this.room = saved
      ? { ...openRoom(code, resume, now), started: true, stage: saved.stage, handed: { ...saved.handed }, seats: saved.seats.map((x) => ({ ...x, linked: false, awaySince: now })) }
      : openRoom(code, resume, now);
    this.local.subscribe((a) => this.onEntry(a));
    this.relay = deps.open(channelFor(code), { key: this.key, kind: 'host' });
    this.relay.onStatus((s) => {
      this.status = s;
      if (s === 'open') this.broadcastRoom();
      this.changed();
    });
    this.relay.onPeers((p) => this.onPeers(p));
    this.relay.onMessage((m) => this.onMessage(m));
  }

  /** Reopen a saved room (the host's resume code): the same code, seats waiting for their phones. */
  static resume(deps: Deps, saved: RoomSave): OnlineHost {
    return new OnlineHost(deps, saved.mission, saved.code, saved.resume, saved);
  }

  // ---- Transport (the host's own useTeam) ----
  send(a: Omit<TeamAction, 'seq'>): void {
    this.local.send(a);
  }
  subscribe(listener: (a: TeamAction) => void): () => void {
    return this.local.subscribe(listener);
  }
  log(): readonly TeamAction[] {
    return this.local.log();
  }

  // ---- the host screen ----
  view(): RoomView {
    return roomView(this.room, this.deps.now(), this.teamState.team);
  }
  get state(): RoomState {
    return this.room;
  }
  get team(): Team | undefined {
    return this.teamState.team;
  }
  onChange(fn: () => void): () => void {
    return this.changes.add(fn);
  }

  /** START MISSION: the team for the log's first entry (the host's useTeam sends it through this transport). */
  start(): Team | undefined {
    const r = startRoom(this.room, this.deps.now());
    if (!r.team) return undefined;
    this.room = r.state;
    this.broadcastRoom();
    this.changed();
    return r.team;
  }

  setStage(stage: RoomStage): void {
    if (this.room.stage === stage) return;
    this.room = setStage(this.room, stage);
    this.broadcastRoom();
    this.changed();
  }

  /** The host screen's flight (undefined when it leaves the flight). */
  link(flight: FlightLink | undefined): void {
    this.flight = flight;
  }

  /**
   * The flight clock: shared at once when it starts, stops or changes speed, when it has drifted from what the phones
   * run on (an order in transit runs it faster), and again every clockResync_s.
   */
  setClock(c: RoomClock): void {
    const prev = this.clock;
    this.clock = c;
    const turned = !prev || prev.running !== c.running || prev.speed !== c.speed || (!c.running && prev.t !== c.t);
    const drifted = this.sent !== undefined && Math.abs(clockAt(this.sent, c.at) - c.t) >= ONLINE_RULES.clockDrift_days.value;
    if (turned || drifted || c.at - this.clockSent >= ONLINE_RULES.clockResync_s.value * 1000) {
      this.clockSent = c.at;
      this.sent = c;
      this.post({ type: 'clock', clock: c, last: this.local.log().length });
    }
  }

  /** Free a lobby slot (a phone that should not be there). */
  free(seat: SeatId): void {
    const x = this.room.seats.find((y) => y.seat === seat);
    if (!x || this.room.started) return;
    this.room = leaveRoom(this.room, x.token, this.deps.now());
    this.broadcastRoom();
    this.changed();
  }

  /** HAND NOW: an away phone's roles go to the Flight Director (or the first linked phone) without waiting. */
  handNow(seat: SeatId): void {
    const team = this.teamState.team;
    if (!team) return;
    const r = handAway(this.room, team, seat);
    this.room = r.state;
    for (const h of r.hands) this.local.send({ seat: h.seat, role: h.role, act: h.act, ...this.stamp() });
    this.broadcastRoom();
    this.changed();
  }

  /** Called about once a second: holds that ran out hand their roles on. Returns whether the room has expired. */
  tick(): 'open' | 'expired' {
    const now = this.deps.now();
    // a phone not heard from for silentDrop_s has dropped, even while the relay still lists it
    let silent = false;
    for (const x of this.room.seats) {
      const at = this.heard.get(x.token);
      if (x.linked && at !== undefined && now - at >= ONLINE_RULES.silentDrop_s.value * 1000) {
        this.room = dropPhone(this.room, x.token, now);
        silent = true;
      }
    }
    if (silent) {
      this.broadcastRoom();
      this.changed();
    }
    if (now - this.postedAt >= ONLINE_RULES.beat_s.value * 1000) this.post({ type: 'pulse', last: this.local.log().length });
    const v = this.view();
    for (const seat of v.due) this.handNow(seat);
    if (v.closesIn_s <= 0) {
      this.close('expired');
      return 'expired';
    }
    return 'open';
  }

  close(reason: 'expired' | 'ended' = 'ended'): void {
    this.post({ type: 'closed', reason });
    this.relay.close();
  }

  /** What the host browser keeps under the resume code. */
  save(): RoomSave {
    return { code: this.room.code, resume: this.room.resume, mission: this.mission, log: [...this.local.log()], stage: this.room.stage, seats: this.room.seats, handed: this.room.handed, savedAt: this.deps.now() };
  }


  // ---- the relay ----
  private changed() {
    this.changes.emit();
  }

  private post(m: Body<HostMsg>) {
    this.postedAt = this.deps.now();
    this.relay.send({ ...m, v: PROTOCOL, from: this.key } as HostMsg);
  }

  private publicRoom(): RoomPublic {
    const r = this.room;
    return { code: r.code, resume: r.resume, stage: r.stage, started: r.started, seats: r.seats.map((x) => ({ seat: x.seat, callSign: x.callSign, linked: x.linked, ...(x.role ? { role: x.role } : {}) })) };
  }

  private broadcastRoom() {
    this.post({ type: 'room', room: this.publicRoom(), last: this.local.log().length });
  }

  private stamp(): { t?: number } {
    return this.teamState.launched && this.flight ? { t: this.flight.t() } : {};
  }

  /**
   * Presence decides who is here, with two allowances for a real relay, whose presence settles in steps: a phone is
   * dropped only once presence has shown it (its hello can arrive first), and a phone presence shows again (absent
   * from the list before) is linked again, with its roles back (it may never have noticed it was gone, so it sends no
   * hello). A phone that went silent (tick) while still listed comes back with its next message instead.
   */
  private onPeers(peers: Peer[]) {
    this.peers = peers;
    const here = new Set(peers.map((p) => p.key));
    for (const k of here) this.seen.add(k);
    const before = this.present;
    this.present = here;
    const now = this.deps.now();
    let changed = false;
    for (const x of this.room.seats) {
      if (x.linked && this.seen.has(x.token) && !here.has(x.token)) {
        this.room = dropPhone(this.room, x.token, now);
        changed = true;
      } else if (!x.linked && here.has(x.token) && !before.has(x.token)) {
        this.relink(x.token, x.seat, now);
        changed = true;
      }
    }
    if (changed) {
      this.broadcastRoom();
      this.changed();
    }
  }

  /** A phone that was away is here again (heard from, or back in presence). */
  private relink(token: string, seat: SeatId, now: number) {
    this.heard.set(token, now);
    this.room = joinRoom(this.room, token, now).state;
    this.giveBack(seat);
  }

  /** A phone back from away gets back the roles handed on while it was gone. */
  private giveBack(seat: SeatId) {
    const team = this.teamState.team;
    if (!team) return;
    const back = reclaim(this.room, team, seat);
    this.room = back.state;
    for (const h of back.hands) this.local.send({ seat: h.seat, role: h.role, act: h.act, ...this.stamp() });
  }

  private onMessage(m: RoomMsg) {
    if (isHostMsg(m)) return; // another host on this code: the UI picks a fresh code when it sees one (peers)
    const now = this.deps.now();
    this.heard.set(m.from, now);
    if (m.v !== PROTOCOL) return this.post({ type: 'refused', to: m.from, reason: 'protocol' });
    const gate = rateGate(this.room, m.from, now);
    this.room = gate.state;
    if (!gate.ok) return this.post({ type: 'refused', to: m.from, ...(m.type === 'act' ? { nonce: m.nonce } : {}), reason: 'too-fast' });
    // a phone that went silent is heard from again (a hello handles its own return)
    const away = this.room.seats.find((x) => x.token === m.from && !x.linked);
    if (away && m.type !== 'hello' && m.type !== 'bye') {
      this.relink(away.token, away.seat, now);
      this.broadcastRoom();
      this.changed();
    }

    switch (m.type) {
      case 'hello': {
        const was = this.room.seats.find((x) => x.token === m.from);
        const r = joinRoom(this.room, m.from, now, m.takeOver);
        if (r.refused) return this.post({ type: 'refused', to: m.from, reason: r.refused });
        this.room = r.state;
        const me = this.room.seats.find((x) => x.token === m.from)!;
        this.post({ type: 'welcome', to: m.from, seat: me.seat, callSign: me.callSign });
        const log = this.local.log();
        this.post({ type: 'sync', to: m.from, mission: this.mission, entries: log.filter((a) => a.seq > m.since), ...(this.clock ? { clock: this.clock } : {}) });
        if (!was?.linked || m.takeOver) this.giveBack(me.seat);
        this.broadcastRoom();
        return this.changed();
      }
      case 'pick': {
        const r = pickRole(this.room, m.from, m.role);
        if (r.refused) return this.post({ type: 'refused', to: m.from, reason: r.refused });
        this.room = r.state;
        this.broadcastRoom();
        return this.changed();
      }
      case 'beat':
        return;
      case 'bye': {
        this.heard.delete(m.from);
        this.room = leaveRoom(this.room, m.from, now);
        this.broadcastRoom();
        return this.changed();
      }
      case 'act': {
        const me = this.room.seats.find((x) => x.token === m.from);
        const team = this.teamState.team;
        const no = (reason: RoomRefusal | TeamRefusal) => this.post({ type: 'refused', to: m.from, nonce: m.nonce, reason });
        if (!me || !me.linked) return no('unknown-phone');
        if (!team || !this.room.started) return no('no-team');
        if (m.act.kind === 'setup') return no('already-set-up');
        if (!mayActAs(team, me.seat, m.role)) return no('not-your-role');
        if (m.act.kind === 'ops') {
          if (!this.flight || !this.teamState.launched) return no('not-launched');
          if (!this.flight.op(m.act.op)) return no('not-launched');
          return;
        }
        this.local.send({ seat: me.seat, role: m.role, act: m.act, ...this.stamp() });
        return;
      }
    }
  }

  /** Every entry on the log (the phones' and the host screen's own) reaches the phones. */
  private onEntry(a: TeamAction) {
    this.teamState = teamFold(this.teamState, a);
    this.room = { ...this.room, activeAt: this.deps.now() };
    this.post({ type: 'entry', entry: a });
    this.changed();
  }

  /** Another host screen is on this code (a clash of codes): the UI opens a fresh one. */
  clash(): boolean {
    return this.peers.some((p) => p.kind === 'host' && p.key !== this.key);
  }
}

// ---------------------------------------------------------------------------------------------------------------

/** Where a phone stands. */
export type PhoneStatus =
  /** Reaching the relay or the room. */
  | 'connecting'
  /** In the room: lobby or mission. */
  | 'linked'
  /** The phone's own link dropped (it tries again): mockup T7c. */
  | 'lost'
  /** The host screen is gone (its grace ran out) or closed the room: mockup T7d. */
  | 'closed'
  /** The relay never answered: mockup T7e. */
  | 'offline'
  /** The host said no (room full, already started, old version). */
  | 'refused';

export interface PhoneState {
  status: PhoneStatus;
  code: string;
  room?: RoomPublic;
  me?: { seat: SeatId; callSign: string };
  mission?: RoomMission;
  clock?: RoomClock;
  /** When the host screen left the channel (ms). */
  hostAwaySince?: number;
  /** When this phone's link dropped (ms). */
  lostSince?: number;
  closed?: 'host-left' | 'expired' | 'ended';
  refused?: RoomRefusal | TeamRefusal;
  /** The last action the host turned down (SLOW DOWN, not your role). */
  bounced?: { nonce: number; reason: RoomRefusal | TeamRefusal; at: number };
}

export class OnlineClient implements Transport {
  private relay: Relay<RoomMsg>;
  private entries = new Map<number, TeamAction>();
  private next = 1;
  private listeners = new Listeners<TeamAction>();
  private changes = new Listeners<void>();
  private hostKey: string | undefined;
  private nonce = 0;
  private asked = 0;
  private askedAt = 0;
  private hostHere = false;
  /** When this phone last sent a message and last heard its host; whether the host went silent (not left presence). */
  private postedAt = 0;
  private heardHostAt = 0;
  private hostSilent = false;
  state: PhoneState;

  constructor(
    private deps: Deps,
    code: string,
    readonly token: string,
    private takeOver?: SeatId,
  ) {
    this.state = { status: 'connecting', code };
    this.relay = deps.open(channelFor(code), { key: token, kind: 'phone' });
    this.relay.onStatus((s) => this.onStatus(s));
    this.relay.onPeers((p) => this.onPeers(p));
    this.relay.onMessage((m) => this.onMessage(m));
  }

  // ---- Transport ----
  /** Send an action as one of this phone's roles (the seat is the host's to check; the time is the host's to stamp). */
  send(a: Omit<TeamAction, 'seq'>): void {
    this.act(a.role, a.act);
  }
  subscribe(listener: (a: TeamAction) => void): () => void {
    return this.listeners.add(listener);
  }
  log(): readonly TeamAction[] {
    return Object.freeze(Array.from({ length: this.next - 1 }, (_, i) => this.entries.get(i + 1)!));
  }

  // ---- the phone screen ----
  onChange(fn: () => void): () => void {
    return this.changes.add(fn);
  }
  pick(role?: RoleId): void {
    this.post({ type: 'pick', ...(role ? { role } : {}) });
  }
  act(role: RoleId, act: TeamAct): number {
    const nonce = ++this.nonce;
    this.post({ type: 'act', nonce, role, act });
    return nonce;
  }
  /** RETRY NOW, or a phone back on the network: say hello again (a rejoin: the host catches the log up). */
  hello(): void {
    this.post({ type: 'hello', since: this.next - 1, ...(this.takeOver ? { takeOver: this.takeOver } : {}) });
  }
  leave(): void {
    this.post({ type: 'bye' });
    this.relay.close();
  }
  /**
   * Called about once a second: a heartbeat when this phone has sent nothing for beat_s; a host screen not heard from
   * for silentDrop_s has left (even while the relay still lists it); a host gone longer than its grace ends the room.
   */
  tick(): void {
    const now = this.deps.now();
    if (this.state.status === 'linked') {
      if (this.state.me && now - this.postedAt >= ONLINE_RULES.beat_s.value * 1000) this.post({ type: 'beat' });
      if (this.state.room && this.heardHostAt > 0 && this.state.hostAwaySince === undefined && now - this.heardHostAt >= ONLINE_RULES.silentDrop_s.value * 1000) {
        this.hostSilent = true;
        this.set({ hostAwaySince: now });
      }
    }
    const s = this.state;
    if (s.status !== 'closed' && s.hostAwaySince !== undefined && s.room && hostGone(s.hostAwaySince, this.deps.now())) this.set({ status: 'closed', closed: 'host-left' });
  }
  /** The mission time on this phone now (the host's clock run on). */
  missionT(): number | undefined {
    return this.state.clock ? clockAt(this.state.clock, this.deps.now()) : undefined;
  }

  // ---- the relay ----
  private set(p: Partial<PhoneState>) {
    this.state = { ...this.state, ...p };
    this.changes.emit();
  }

  private post(m: Body<PhoneMsg>) {
    this.postedAt = this.deps.now();
    this.relay.send({ ...m, v: PROTOCOL, from: this.token } as PhoneMsg);
  }

  private onStatus(s: RelayStatus) {
    if (s === 'offline') return this.set({ status: 'offline' });
    if (s === 'connecting') {
      if (this.state.status === 'linked') this.set({ status: 'lost', lostSince: this.deps.now() });
      return;
    }
    // open (again): say hello; the host answers with the room and the entries missed
    if (this.state.status === 'lost') {
      const { lostSince: _l, ...rest } = this.state;
      this.state = { ...rest, status: 'linked' };
    }
    this.hello();
  }

  private onPeers(peers: Peer[]) {
    const host = peers.some((p) => p.kind === 'host');
    if (!host && this.hostHere) this.set({ hostAwaySince: this.deps.now() });
    if (host && !this.hostHere) {
      if (this.state.hostAwaySince !== undefined) {
        const { hostAwaySince: _h, ...rest } = this.state;
        this.state = rest;
        // the host screen is back (a reload or a resume): pin its new key and rejoin
        this.hostKey = undefined;
        if (this.state.status === 'closed' && this.state.closed === 'host-left') this.state = { ...this.state, status: 'connecting' };
        this.hello();
        this.changes.emit();
      }
    }
    this.hostHere = host;
  }

  private onMessage(m: RoomMsg) {
    if (!isHostMsg(m)) return;
    if (m.v !== PROTOCOL) return this.set({ status: 'refused', refused: 'protocol' });
    // pin the host: the first host that answers is the room's (another key is ignored while it is here)
    if (this.hostKey === undefined) this.hostKey = m.from;
    else if (m.from !== this.hostKey) return;
    this.heardHostAt = this.deps.now();
    if (this.hostSilent) {
      // the host that went silent is heard again: rejoin (the hello catches up what was lost)
      this.hostSilent = false;
      const { hostAwaySince: _h, ...rest } = this.state;
      this.state = this.state.status === 'closed' && this.state.closed === 'host-left' ? { ...rest, status: 'connecting' } : rest;
      this.hello();
      this.changes.emit();
    }
    if ('to' in m && m.to !== this.token) return;
    switch (m.type) {
      case 'room':
        this.set({ room: m.room, ...(this.state.status === 'connecting' && this.state.me ? { status: 'linked' } : {}) });
        return this.behind(m.last);
      case 'welcome':
        return this.set({ me: { seat: m.seat, callSign: m.callSign }, status: 'linked' });
      case 'sync': {
        this.set({ mission: m.mission, ...(m.clock ? { clock: m.clock } : {}) });
        for (const e of m.entries) this.take(e);
        return;
      }
      case 'entry':
        return this.take(m.entry);
      case 'clock':
        this.set({ clock: m.clock });
        return this.behind(m.last);
      case 'refused':
        if (m.nonce !== undefined || m.reason === 'taken') return this.set({ bounced: { nonce: m.nonce ?? 0, reason: m.reason, at: this.deps.now() } });
        if (m.reason === 'too-fast') return; // a hello sent too fast: the next try will do
        return this.set({ status: 'refused', refused: m.reason });
      case 'closed':
        return this.set({ status: 'closed', closed: m.reason });
      case 'pulse':
        return this.behind(m.last);
    }
  }

  /** An entry from the host: keep it, hand on every entry now in order, and ask for any that went missing. */
  private take(e: TeamAction) {
    if (e.seq < this.next || this.entries.has(e.seq)) return;
    this.entries.set(e.seq, e);
    let moved = false;
    while (this.entries.has(this.next)) {
      const a = this.entries.get(this.next)!;
      this.next++;
      moved = true;
      this.listeners.emit(a);
    }
    // a gap: entries after it came, the one before did not (lost on the way)
    if (this.entries.size >= this.next) this.catchUp();
    if (moved) this.changes.emit();
  }

  /** The host's log is longer than ours (its last entries never came): ask for the rest. */
  private behind(last: number) {
    if (last > this.next - 1) this.catchUp();
  }

  /** Ask the host for the entries after ours: once per gap, and again if the answer is lost too. */
  private catchUp() {
    const now = this.deps.now();
    if (this.asked === this.next && now - this.askedAt < ONLINE_RULES.retryEvery_s.value * 1000) return;
    this.asked = this.next;
    this.askedAt = now;
    this.hello();
  }
}

/** A phone token: random, kept in the phone's browser, never a name. */
export const phoneToken = (rand: () => number) => `ph-${randomKey(rand)}`;

/** The phone's own seat in the room's public view. */
export const mySeat = (s: PhoneState) => (s.me && s.room ? s.room.seats.find((x) => x.seat === s.me!.seat) : undefined);
