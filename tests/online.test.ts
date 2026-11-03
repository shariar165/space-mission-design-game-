// The Online Mission Room (spec: Online room). The host screen owns the log; phones send role-tagged actions; the
// host checks each one and broadcasts the accepted entries; every phone rebuilds the same mission from (base design,
// seed, log). Played here over MemoryHub, an in-memory relay that can delay, drop, reorder and cut messages, with a
// fake wall clock, so the room's holds, hand-overs, catch-up, expiry and resume are all exercised without a network.
import { describe, expect, it } from 'vitest';
import * as ops from '../src/engine/ops/index';
import { END_MISSION } from '../src/engine/ops/extension';
import { shelfFor } from '../src/engine/pack';
import type { TeamAct, TeamAction } from '../src/engine/team/log';
import { opRole } from '../src/engine/team/fly';
import { cardTurn } from '../src/engine/team/controller';
import { initialTeamState } from '../src/engine/team/reduce';
import { replayTeam, sessionAt, stepSession, type TeamSession } from '../src/engine/team/replay';
import { MemoryHub } from '../src/engine/team/relay';
import { holderOf, TEAM_RULES, type RoleId, type SeatId } from '../src/engine/team/roles';
import { actorFor } from '../src/engine/team/setup';
import { OnlineClient, OnlineHost, PROTOCOL, channelFor, phoneToken, type RoomMission, type RoomMsg } from '../src/engine/team/online';
import {
  ONLINE_RULES,
  cleanResumeCode,
  cleanRoomCode,
  clockAt,
  makeResumeCode,
  makeRoomCode,
  retryView,
  teamFromSeats,
  validResumeCode,
  validRoomCode,
} from '../src/engine/team/room';
import { starterDesign } from '../src/ui/starters';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const day = { date: base.launchDate, arrivalDate: base.arrivalDate };
const SEED = 19;
const mission: RoomMission = { base, shelf, seed: SEED };
const opts = { seed: SEED };

/** A small seeded generator (mulberry32), so every run draws the same codes, tokens and jitter. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A room on an in-memory relay with a fake wall clock, the host's own session (as the host's useTeam keeps it) and phones. */
function setup(n: number, seed = 1) {
  const hub = new MemoryHub<RoomMsg>();
  const clock = { ms: 1_700_000_000_000 };
  const rand = seeded(seed);
  const deps = { open: hub.open, now: () => clock.ms, rand };
  const host = new OnlineHost(deps, mission, 'MARS-7K2', 'K7QB-000');
  const phones = Array.from({ length: n }, () => new OnlineClient(deps, 'MARS-7K2', phoneToken(rand)));
  hub.flush();
  return { hub, clock, deps, host, phones };
}

/** The host screen's session, kept the way useTeam keeps it (stepSession on each entry). */
function hostSession(host: OnlineHost) {
  const box: { sess: TeamSession } = { sess: { team: initialTeamState(base, shelf) } };
  host.subscribe((a) => (box.sess = stepSession(box.sess, a, opts).session));
  return box;
}

/** A phone's session: its own replay of the entries it has (what the phone screen shows). */
function phoneSession(p: OnlineClient) {
  const box: { sess: TeamSession } = { sess: { team: initialTeamState(base, shelf) } };
  p.subscribe((a) => (box.sess = stepSession(box.sess, a, opts).session));
  return box;
}

const ROLES: RoleId[] = ['flight-director', 'spacecraft-engineer', 'science-lead', 'comms-ops'];

describe('room codes', () => {
  it('a room code is a space word and three characters without look-alikes (MARS-7K2)', () => {
    const rand = seeded(7);
    for (let i = 0; i < 200; i++) {
      const c = makeRoomCode(rand);
      expect(c).toMatch(/^[A-Z]{4}-[A-Z0-9]{3}$/);
      expect(validRoomCode(c)).toBe(true);
      expect(c.slice(5)).not.toMatch(/[01OIL]/);
    }
    expect(validRoomCode('MARS-7K2')).toBe(true);
    expect(validRoomCode('MARS-0K2')).toBe(false); // 0 is not in the alphabet
    expect(validRoomCode('PLUT-7K2')).toBe(false); // not a code word
  });

  it('what a player types is cleaned: lower case, no dash, spaces', () => {
    expect(cleanRoomCode('mars7k2')).toBe('MARS-7K2');
    expect(cleanRoomCode(' Mars - 7k2 ')).toBe('MARS-7K2');
    expect(cleanResumeCode('k7qb2x4')).toBe('K7QB-2X4');
  });

  it('a resume code is seven characters without look-alikes (K7QB-2X4), the same all mission', () => {
    const rand = seeded(3);
    for (let i = 0; i < 100; i++) {
      const c = makeResumeCode(rand);
      expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{3}$/);
      expect(c).not.toMatch(/[01OIL]/);
      expect(validResumeCode(c)).toBe(true);
    }
    expect(validResumeCode('K7QB-2X4')).toBe(true);
    expect(validResumeCode('K7QB-0X4')).toBe(false); // 0 is not in the alphabet
  });

  it('every room rule is a game rule (listed in TODO_DATA.md)', () => {
    for (const r of Object.values(ONLINE_RULES)) expect(r.isGameEstimate).toBe(true);
    expect(ONLINE_RULES.maxSeats.value).toBe(4);
    expect(ONLINE_RULES.seatHold_s.value).toBe(45); // the mockup's T7c hold
  });

  it("a phone's clock runs on from the host's last reading; a held clock stays put", () => {
    // 100 mission days a minute for 30 s = 50 days
    expect(clockAt({ t: 10, speed: 100, running: true, at: 0 }, 30_000)).toBeCloseTo(60, 12);
    expect(clockAt({ t: 10, speed: 100, running: false, at: 0 }, 30_000)).toBe(10);
  });

  it('the offline screens count down to the next try', () => {
    // retryEvery_s = 10: 3.2 s after a failure, the next try is in 7 s (rounded up)
    expect(retryView(1000, 2, 4200)).toEqual({ tries: 2, nextIn_s: 7 });
  });
});

describe('the lobby', () => {
  it('phones join with the code, get the next seat and call sign, and the fifth is turned away', () => {
    const { host, phones, hub, deps } = setup(4);
    expect(host.status).toBe('open');
    phones.forEach((p, i) => {
      expect(p.state.status).toBe('linked');
      expect(p.state.me).toEqual({ seat: `p${i + 1}`, callSign: TEAM_RULES.callSigns.value[i] });
    });
    expect(host.view().linked).toBe(4);
    const fifth = new OnlineClient(deps, 'MARS-7K2', 'ph-fifth');
    hub.flush();
    expect(fifth.state.status).toBe('refused');
    expect(fifth.state.refused).toBe('full');
  });

  it('each phone picks a free role; a taken role bounces; START needs a Flight Director', () => {
    const { host, phones, hub } = setup(3);
    phones[1]!.pick('science-lead');
    hub.flush();
    expect(host.view().canStart).toBe(false);
    expect(host.view().message).toEqual({ kind: 'need-director' });
    expect(host.start()).toBeUndefined();
    phones[2]!.pick('science-lead');
    hub.flush();
    expect(phones[2]!.state.bounced?.reason).toBe('taken');
    expect(phones[2]!.state.status).toBe('linked');
    phones[0]!.pick('flight-director');
    hub.flush();
    const v = host.view();
    expect(v.canStart).toBe(true);
    // nobody picked the Engineer or Comms & Ops: the Flight Director's phone will hold them
    expect(v.message).toEqual({ kind: 'empty', roles: ['spacecraft-engineer', 'comms-ops'], director: TEAM_RULES.callSigns.value[0] });
    expect(phones[2]!.state.room?.seats.find((s) => s.seat === 'p2')?.role).toBe('science-lead');
  });

  it('the team at START: each phone its role, the Flight Director the roles nobody picked; a phone with no role sits out', () => {
    const team = teamFromSeats([
      { token: 'a', seat: 'p1', callSign: 'COMET', role: 'science-lead', linked: true },
      { token: 'b', seat: 'p2', callSign: 'ORBIT', role: 'flight-director', linked: true },
      { token: 'c', seat: 'p3', callSign: 'NOVA', linked: true },
    ]);
    expect(team).toEqual({
      seats: [
        { id: 'p1', callSign: 'COMET', roles: ['science-lead'] },
        { id: 'p2', callSign: 'ORBIT', roles: ['flight-director', 'spacecraft-engineer', 'comms-ops'] },
      ],
    });
    expect(teamFromSeats([{ token: 'a', seat: 'p1', callSign: 'COMET', role: 'science-lead', linked: true }])).toBeUndefined();
  });

  it('a phone from an older version is told to reload', () => {
    const { hub, phones } = setup(1);
    const raw = hub.open(channelFor('MARS-7K2'), { key: 'ph-old', kind: 'phone' });
    const got: RoomMsg[] = [];
    raw.onMessage((m) => got.push(m));
    raw.send({ type: 'hello', v: PROTOCOL + 1, from: 'ph-old', since: 0 });
    hub.flush();
    expect(got.some((m) => m.type === 'refused' && m.to === 'ph-old' && m.reason === 'protocol')).toBe(true);
    expect(phones[0]!.state.status).toBe('linked');
  });

  it('a relay that never answers is offline (the room offers local co-op)', () => {
    const hub = new MemoryHub<RoomMsg>();
    hub.offline = true;
    const deps = { open: hub.open, now: () => 0, rand: seeded(1) };
    const host = new OnlineHost(deps, mission, 'MARS-7K2', 'K7QB-000');
    const phone = new OnlineClient(deps, 'MARS-7K2', 'ph-x');
    expect(host.status).toBe('offline');
    expect(phone.state.status).toBe('offline');
  });
});

/** Four phones, one role each, started; the host keeps its session. */
function started(seed = 1) {
  const room = setup(4, seed);
  room.phones.forEach((p, i) => p.pick(ROLES[i]));
  room.hub.flush();
  const host = hostSession(room.host);
  const team = room.host.start()!;
  // the host's useTeam sends the setup entry through the host transport
  room.host.send({ seat: actorFor(team, 'flight-director'), role: 'flight-director', act: { kind: 'setup', team } });
  room.hub.flush();
  return { ...room, box: host };
}

/** Let time pass the way the screens do: every second each phone and the host screen tick (heartbeats, holds). */
function pass(room: { clock: { ms: number }; host: OnlineHost; phones: OnlineClient[]; hub: MemoryHub<RoomMsg> }, seconds: number) {
  for (let i = 0; i < seconds; i++) {
    room.clock.ms += 1000;
    for (const p of room.phones) p.tick();
    room.hub.flush();
    room.host.tick();
    room.hub.flush();
  }
}

describe('acting from a phone', () => {
  it('the host checks the role: a phone acting as a role it does not hold bounces, and nothing is logged', () => {
    const { phones, hub, host } = started();
    const before = host.log().length;
    const n = phones[1]!.act('flight-director', { kind: 'objective', objective: 'moons' });
    hub.flush();
    expect(phones[1]!.state.bounced).toMatchObject({ nonce: n, reason: 'not-your-role' });
    expect(host.log().length).toBe(before);
    phones[0]!.act('flight-director', { kind: 'objective', objective: 'moons' });
    hub.flush();
    expect(host.log().length).toBe(before + 1);
    // every phone has the same log as the host
    for (const p of phones) expect(p.log()).toEqual(host.log());
  });

  it('a phone that taps too fast is slowed down (a token bucket: the burst, then the steady rate)', () => {
    const { phones, hub, host, clock } = started();
    const before = host.log().length;
    const say: TeamAct = { kind: 'say', quick: TEAM_RULES.quick.value[0]! };
    for (let i = 0; i < 20; i++) phones[2]!.act('science-lead', say);
    hub.flush();
    // the bucket was not full: the pick and the hello spent two of the eight
    const burst = ONLINE_RULES.burst.value;
    const got = host.log().length - before;
    expect(got).toBeLessThanOrEqual(burst);
    expect(got).toBeGreaterThanOrEqual(burst - 2);
    expect(phones[2]!.state.bounced?.reason).toBe('too-fast');
    clock.ms += 1000; // rate_perS = 2: two more after a second
    for (let i = 0; i < 5; i++) phones[2]!.act('science-lead', say);
    hub.flush();
    expect(host.log().length - before - got).toBe(ONLINE_RULES.rate_perS.value);
  });
});

/**
 * One Mars mission, played from four phones over a relay that reorders every delivery and loses one entry in seven
 * on its way to the Science Lead's phone. The phones pick the objective, vote on it, pack, launch, order a picture and
 * a DSN pass from the console roles, and vote on every danger card; the host flies the clock like the screen does.
 */
function playMission(seed: number) {
  const room = started(seed);
  const { hub, phones, host, box } = room;
  hub.jitter = seeded(seed + 100);
  let n = 0;
  hub.drop = (m, to) => m.type === 'entry' && to.key === phones[2]!.token && ++n % 7 === 0;
  const [fd, eng, sci, com] = phones as [OnlineClient, OnlineClient, OnlineClient, OnlineClient];
  const go = () => hub.flush();
  // The host screen's flight: the session's flight is the screen's (as in tests/teamFly.test.ts)
  const flight = {
    t: () => box.sess.ops?.t ?? 0,
    op: (op: Parameters<typeof opRole>[0]) => {
      const team = box.sess.team.team!;
      const role = opRole(op);
      host.send({ seat: actorFor(team, role), role, act: { kind: 'ops', op }, t: box.sess.ops!.t });
      return true;
    },
  };
  host.link(flight);

  fd.act('flight-director', { kind: 'objective', objective: 'moons' });
  go();
  for (const [p, r] of [[eng, 'spacecraft-engineer'], [sci, 'science-lead'], [com, 'comms-ops']] as const) {
    p.act(r, { kind: 'objective-voice', voice: 'agree' });
    go();
  }
  fd.act('flight-director', { kind: 'objective-lock' });
  eng.act('spacecraft-engineer', { kind: 'pack', part: 'tank' });
  go();
  sci.act('science-lead', { kind: 'pack', part: 'spectrometer' });
  go();
  host.setStage('pack');
  fd.act('flight-director', { kind: 'launch', day });
  go();
  host.setStage('fly');
  expect(box.sess.team.launched).toBe(true);

  let guard = 0;
  let observed = false;
  const phoneOf = (seat: SeatId) => phones[Number(seat.slice(1)) - 1]!;
  while (box.sess.ops!.status === 'flying' && guard++ < 300) {
    const sci0 = box.sess.ops!.env.timeline.find((w) => w.phase === 'science')!;
    box.sess = { ...box.sess, ops: ops.advanceOperations(box.sess.ops!, observed ? {} : { until: sci0.startDay + 0.1 }) };
    room.clock.ms += 250;
    host.setClock({ t: box.sess.ops!.t, speed: 100, running: false, at: room.clock.ms });
    go();
    const o = box.sess.ops!;
    if (!observed && o.t >= sci0.startDay) {
      observed = true;
      sci.act('science-lead', { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: 'phobos' } } });
      go();
      com.act('comms-ops', { kind: 'ops', op: { kind: 'dsn', fromDay: Math.floor(o.t) + 10, toDay: Math.floor(o.t) + 10, booking: { dish: 70, hours: 8 } } });
      go();
    }
    for (const d of ops.openDecisions(box.sess.ops!)) {
      if (d.kind === 'extension') {
        fd.act('flight-director', { kind: 'ops', op: { kind: 'decide', decisionId: d.id, optionId: END_MISSION } });
        go();
        continue;
      }
      const team = box.sess.team.team!;
      const opt = d.hazardOptions!;
      const type = box.sess.ops!.hazards.find((h) => h.id === d.hazardId)!.type;
      const recRole = TEAM_RULES.hazardRoles.value[type]!;
      phoneOf(holderOf(team, recRole)!).act(recRole, { kind: 'recommend', decisionId: d.id, optionId: opt[0]!.id });
      go();
      for (const [p, r] of [[eng, 'spacecraft-engineer'], [sci, 'science-lead'], [com, 'comms-ops']] as const) {
        if (r === recRole) continue;
        p.act(r, { kind: 'vote', decisionId: d.id, optionId: opt.at(-1)!.id });
        go();
      }
      fd.act('flight-director', { kind: 'call', decisionId: d.id, optionId: d.safestOptionId! });
      go();
    }
  }
  // the end of the flight: the host's last clock tells every phone how long the log is
  hub.drop = undefined;
  room.clock.ms += ONLINE_RULES.retryEvery_s.value * 1000;
  host.setClock({ t: box.sess.ops!.t, speed: 0, running: false, at: room.clock.ms });
  go();
  return { ...room, dropped: n };
}

describe('one mission, many screens', () => {
  it('every phone ends with the host’s log, and each rebuilds the same mission (catch-up after lost entries)', () => {
    const { host, phones, dropped } = playMission(5);
    expect(dropped).toBeGreaterThan(3); // the Science Lead's phone really lost entries on the way
    const hostLog = host.log();
    expect(hostLog.length).toBeGreaterThanOrEqual(15);
    expect(replayTeam(base, shelf, opts, hostLog).team.refused).toEqual([]);
    // the votes and orders really happened through the phones
    expect(hostLog.some((a) => a.act.kind === 'call')).toBe(true);
    expect(hostLog.some((a) => a.act.kind === 'ops' && a.act.op.kind === 'dsn' && a.seat === 'p4')).toBe(true);
    const want = replayTeam(base, shelf, opts, hostLog);
    for (const p of phones) {
      expect(p.log()).toEqual(hostLog);
      expect(replayTeam(p.state.mission!.base, p.state.mission!.shelf, { seed: p.state.mission!.seed }, p.log())).toEqual(want);
    }
  });

  it('the same seeds play the same mission twice (determinism through the relay)', () => {
    const a = playMission(9).host.log();
    const b = playMission(9).host.log();
    expect(a).toEqual(b);
    expect(replayTeam(base, shelf, opts, a)).toEqual(replayTeam(base, shelf, opts, b));
  });

  it("a phone's own replay at the host's clock shows the card, and whose turn it is", () => {
    const room = started(3);
    const { hub, host, box, phones } = room;
    host.link({ t: () => box.sess.ops?.t ?? 0, op: () => false });
    phones[0]!.act('flight-director', { kind: 'launch', day });
    hub.flush();
    let o = box.sess.ops!;
    while (o.status === 'flying' && !ops.openDecisions(o).some((d) => d.kind === 'hazard' && (d.hazardOptions?.length ?? 0) >= 2)) o = ops.advanceOperations(o);
    box.sess = { ...box.sess, ops: o };
    room.clock.ms += 1000;
    host.setClock({ t: o.t, speed: 100, running: false, at: room.clock.ms });
    hub.flush();
    const dec = ops.openDecisions(o).find((d) => d.kind === 'hazard')!;
    const type = o.hazards.find((h) => h.id === dec.hazardId)!.type;
    const recRole = TEAM_RULES.hazardRoles.value[type]!;
    // each phone replays its log and flies on to the host's clock
    const views = phones.map((p, i) => {
      const s = phoneSession(p);
      for (const a of p.log()) s.sess = stepSession(s.sess, a, opts).session;
      const at = sessionAt(s.sess, p.missionT()!);
      return cardTurn(at.team, at.ops!, `p${i + 1}` as SeatId)!;
    });
    const recIdx = ROLES.indexOf(recRole);
    expect(views[recIdx]!.action).toBe('recommend');
    for (const [i, v] of views.entries()) {
      expect(v.decisionId).toBe(dec.id);
      expect(v.waitingOn).toEqual([recRole]);
      expect(v.dots.filter((d) => d.on).map((d) => d.role)).toEqual([recRole]);
      if (i !== recIdx) expect(v.action).toBe('wait');
    }
  });
});

describe('a phone drops out', () => {
  it('its role is held (the clock holds), then passes to the Flight Director, and comes back when the phone does', () => {
    const { hub, host, phones, clock, box } = started(4);
    const eng = phones[1]!;
    hub.cut(eng.token);
    hub.flush();
    expect(eng.state.status).toBe('lost');
    let v = host.view();
    expect(v.holding).toBe(true);
    expect(v.message).toMatchObject({ kind: 'away', role: 'spacecraft-engineer', holdLeft_s: ONLINE_RULES.seatHold_s.value });
    pass({ clock, host, phones, hub }, 20);
    expect(host.view().message).toMatchObject({ kind: 'away', holdLeft_s: ONLINE_RULES.seatHold_s.value - 20 });
    // meanwhile the others keep talking: the dropped phone misses these entries
    phones[0]!.act('flight-director', { kind: 'objective', objective: 'surface' });
    hub.flush();
    pass({ clock, host, phones, hub }, 26); // past the 45 s hold
    v = host.view();
    expect(v.holding).toBe(false);
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p1');
    expect(v.message).toMatchObject({ kind: 'handed', role: 'spacecraft-engineer', heldBy: TEAM_RULES.callSigns.value[0] });
    // the phone comes back: the role returns to it, and it catches up on everything it missed
    hub.heal(eng.token);
    hub.flush();
    expect(eng.state.status).toBe('linked');
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p2');
    expect(host.view().message).toEqual({ kind: 'running' });
    expect(eng.log()).toEqual(host.log());
  });

  it('presence that has not yet shown a phone does not drop it (its hello can arrive first)', () => {
    const { hub, host, deps } = setup(0);
    hub.hide('ph-slow');
    const slow = new OnlineClient(deps, 'MARS-7K2', 'ph-slow');
    hub.flush();
    expect(slow.state.status).toBe('linked');
    // a presence list without it (the relay has not caught up) leaves its seat linked
    hub.hide('ph-other');
    hub.flush();
    expect(host.state.seats.find((x) => x.token === 'ph-slow')?.linked).toBe(true);
    hub.show('ph-slow');
    hub.flush();
    expect(host.state.seats.find((x) => x.token === 'ph-slow')?.linked).toBe(true);
  });

  it('a presence glitch: a phone left out of one presence list and back in the next keeps its seat and its roles', () => {
    const { hub, host, phones, clock, box } = started(4);
    const eng = phones[1]!;
    hub.hide(eng.token);
    hub.flush();
    expect(host.view().holding).toBe(true);
    // the phone never noticed (it is still connected); presence shows it again
    hub.show(eng.token);
    hub.flush();
    expect(host.view().holding).toBe(false);
    expect(host.view().message).toEqual({ kind: 'running' });
    // past a hold (its messages lost too, or its heartbeat would bring it back): its role went to the Flight Director,
    // and comes back with the phone
    hub.hide(eng.token);
    hub.drop = (m) => m.from === eng.token;
    hub.flush();
    pass({ clock, host, phones, hub }, ONLINE_RULES.seatHold_s.value + 1);
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p1');
    hub.drop = undefined;
    hub.show(eng.token);
    hub.flush();
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p2');
    expect(eng.log()).toEqual(host.log());
    // and its actions go through again
    const n = host.log().length;
    eng.act('spacecraft-engineer', { kind: 'say', quick: 'good-call' });
    hub.flush();
    expect(host.log().length).toBe(n + 1);
  });

  it('a phone whose network is gone while the relay still lists it is dropped once it goes silent, and its next word brings it back', () => {
    const room = started(12);
    const { hub, host, phones, box } = room;
    const eng = phones[1]!;
    // the relay keeps it in presence (as a real one does for a minute or more), but nothing gets through either way
    hub.drop = (m, to) => m.from === eng.token || to.key === eng.token;
    pass(room, ONLINE_RULES.silentDrop_s.value - 1);
    expect(host.view().holding).toBe(false);
    pass(room, 2);
    expect(host.view().holding).toBe(true);
    expect(host.view().message).toMatchObject({ kind: 'away', role: 'spacecraft-engineer' });
    expect(host.view().linked).toBe(3); // the others' heartbeats keep them linked
    pass(room, ONLINE_RULES.seatHold_s.value);
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p1');
    // the network is back: its next heartbeat relinks it, its role comes back, and it catches up
    hub.drop = undefined;
    pass(room, ONLINE_RULES.beat_s.value + 1);
    expect(host.view().holding).toBe(false);
    expect(holderOf(box.sess.team.team!, 'spacecraft-engineer')).toBe('p2');
    expect(eng.log()).toEqual(host.log());
  });

  it('a host screen whose network is gone while the relay still lists it ends the room after the silence and the grace; it comes back when heard again', () => {
    const room = started(13);
    const { hub, host, phones } = room;
    hub.drop = (m) => m.from === host.key;
    pass(room, ONLINE_RULES.silentDrop_s.value + ONLINE_RULES.hostGrace_s.value - 1);
    expect(phones[0]!.state.status).toBe('linked');
    pass(room, 2);
    for (const p of phones) {
      expect(p.state.status).toBe('closed');
      expect(p.state.closed).toBe('host-left');
    }
    hub.drop = undefined;
    pass(room, ONLINE_RULES.beat_s.value + 1);
    for (const p of phones) {
      expect(p.state.status).toBe('linked');
      expect(p.log()).toEqual(host.log());
    }
  });

  it('HAND NOW passes the role at once; a new phone may take over a seat that is away', () => {
    const { hub, host, phones, box, deps } = started(6);
    hub.cut(phones[3]!.token);
    hub.flush();
    host.handNow('p4');
    hub.flush();
    expect(holderOf(box.sess.team.team!, 'comms-ops')).toBe('p1');
    const fresh = new OnlineClient(deps, 'MARS-7K2', 'ph-new', 'p4');
    hub.flush();
    expect(fresh.state.status).toBe('linked');
    expect(fresh.state.me?.seat).toBe('p4');
    expect(holderOf(box.sess.team.team!, 'comms-ops')).toBe('p4');
    expect(fresh.log()).toEqual(host.log());
    // a new phone cannot simply join a mission under way
    const late = new OnlineClient(deps, 'MARS-7K2', 'ph-late');
    hub.flush();
    expect(late.state.refused).toBe('started');
  });
});

describe('the host screen leaves', () => {
  it('the phones wait out the grace, then show the room ended with its resume code; a resumed room flies on', () => {
    const { hub, host, phones, clock, deps } = started(8);
    phones[0]!.act('flight-director', { kind: 'objective', objective: 'atmosphere' });
    hub.flush();
    const save = host.save();
    hub.cut(host.key);
    hub.flush();
    clock.ms += (ONLINE_RULES.hostGrace_s.value - 1) * 1000;
    for (const p of phones) p.tick();
    expect(phones[0]!.state.status).toBe('linked'); // a reload is not the end
    clock.ms += 2000;
    for (const p of phones) p.tick();
    for (const p of phones) {
      expect(p.state.status).toBe('closed');
      expect(p.state.closed).toBe('host-left');
      expect(p.state.room?.resume).toBe('K7QB-000');
    }
    // the host types the resume code: the same room code, the same log; the phones rejoin by themselves
    const again = OnlineHost.resume(deps, save);
    hub.flush();
    expect(again.log()).toEqual(save.log);
    expect(again.view().linked).toBe(4);
    for (const p of phones) {
      expect(p.state.status).toBe('linked');
      expect(p.log()).toEqual(again.log());
    }
  });

  it('a room closes when its time is up, or when it sits idle with no phone linked', () => {
    const a = started(10);
    a.clock.ms += ONLINE_RULES.roomTtl_h.value * 3600 * 1000;
    expect(a.host.tick()).toBe('expired');
    a.hub.flush();
    for (const p of a.phones) expect(p.state.closed).toBe('expired');

    const b = setup(1, 11);
    b.phones[0]!.leave();
    b.hub.flush();
    expect(b.host.view().linked).toBe(0);
    expect(b.host.view().closeWhy).toBe('idle');
    b.clock.ms += ONLINE_RULES.idleClose_min.value * 60 * 1000;
    expect(b.host.tick()).toBe('expired');
  });
});

describe('hand: a role passes to another seat', () => {
  const s0 = () => {
    const team = teamFromSeats([
      { token: 'a', seat: 'p1', callSign: 'COMET', role: 'flight-director', linked: true },
      { token: 'b', seat: 'p2', callSign: 'ORBIT', role: 'spacecraft-engineer', linked: true },
      { token: 'c', seat: 'p3', callSign: 'NOVA', role: 'science-lead', linked: true },
    ])!;
    let sess: TeamSession = { team: initialTeamState(base, shelf) };
    sess = stepSession(sess, { seq: 1, seat: 'p1', role: 'flight-director', act: { kind: 'setup', team } }, opts).session;
    return sess;
  };
  const hand = (seat: SeatId, role: RoleId, what: RoleId, to: SeatId, seq = 2): TeamAction => ({ seq, seat, role, act: { kind: 'hand', role: what, to } });

  it('its holder gives it on, or the Flight Director moves it', () => {
    const a = stepSession(s0(), hand('p2', 'spacecraft-engineer', 'spacecraft-engineer', 'p1'), opts);
    expect(a.refused).toBeUndefined();
    expect(holderOf(a.session.team.team!, 'spacecraft-engineer')).toBe('p1');
    const b = stepSession(s0(), hand('p1', 'flight-director', 'science-lead', 'p2'), opts);
    expect(b.refused).toBeUndefined();
    expect(a.session.team.team!.seats.find((x) => x.id === 'p1')!.roles).toEqual(['flight-director', 'spacecraft-engineer', 'comms-ops']);
    expect(holderOf(b.session.team.team!, 'science-lead')).toBe('p2');
  });

  it('anyone else is refused, and so is a hand to the holder or to a seat not in the team', () => {
    expect(stepSession(s0(), hand('p3', 'science-lead', 'spacecraft-engineer', 'p3'), opts).refused).toBe('wrong-role');
    expect(stepSession(s0(), hand('p3', 'spacecraft-engineer', 'spacecraft-engineer', 'p3'), opts).refused).toBe('not-your-role');
    expect(stepSession(s0(), hand('p1', 'flight-director', 'science-lead', 'p3'), opts).refused).toBe('already-held');
    expect(stepSession(s0(), hand('p1', 'flight-director', 'science-lead', 'p4'), opts).refused).toBe('unknown-seat');
  });
});
