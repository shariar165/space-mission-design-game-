// Team mode (spec: Team mode). One action log for everyone: each entry names the seat, the role it acts as and the
// action. Permissions decide who may do what (an empty role is open to anyone); danger cards go recommend → vote →
// the Flight Director's call (majority with no FD); the mission is a function of (base design, seed, team log).
import { describe, expect, it } from 'vitest';
import * as ops from '../src/engine/ops/index';
import { HAZARDS } from '../src/engine/data';
import { END_MISSION } from '../src/engine/ops/extension';
import { PACK, initialPack, shelfFor, type PartId } from '../src/engine/pack';
import { ROLE_IDS, TEAM_RULES, holderOf, mayActAs, partRole, teamProblem, type Team } from '../src/engine/team/roles';
import { applyTeamAction, initialTeamState, teamDesign, type TeamState } from '../src/engine/team/reduce';
import { replayTeam, stepSession, type TeamSession } from '../src/engine/team/replay';
import { LocalTransport } from '../src/engine/team/transport';
import type { TeamAct, TeamAction } from '../src/engine/team/log';
import type { OpsState } from '../src/engine/ops/types';
import { starterDesign } from '../src/ui/starters';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const day = { date: base.launchDate, arrivalDate: base.arrivalDate };

const duo: Team = {
  seats: [
    { id: 'p1', callSign: TEAM_RULES.callSigns.value[0]!, roles: ['flight-director', 'science-lead'] },
    { id: 'p2', callSign: TEAM_RULES.callSigns.value[1]!, roles: ['spacecraft-engineer', 'comms-ops'] },
  ],
};
const trio: Team = {
  seats: [
    { id: 'p1', callSign: TEAM_RULES.callSigns.value[0]!, roles: ['flight-director'] },
    { id: 'p2', callSign: TEAM_RULES.callSigns.value[1]!, roles: ['spacecraft-engineer'] },
    { id: 'p3', callSign: TEAM_RULES.callSigns.value[2]!, roles: ['science-lead', 'comms-ops'] },
  ],
};

let seq = 0;
const act = (seat: TeamAction['seat'], role: TeamAction['role'], a: TeamAct, t?: number): TeamAction => ({ seq: ++seq, seat, role, act: a, ...(t !== undefined ? { t } : {}) });

/** Apply a list of pre-flight actions and return the state (throws on an unexpected refusal). */
function preflight(team: Team, ...rest: TeamAction[]): TeamState {
  let s = applyTeamAction(initialTeamState(base, shelf), act('p1', 'flight-director', { kind: 'setup', team })).state;
  for (const a of rest) {
    const r = applyTeamAction(s, a);
    if (r.refused) throw new Error(`refused ${a.act.kind}: ${r.refused}`);
    s = r.state;
  }
  return s;
}

describe('team rules (data)', () => {
  it('four roles, in the order the setup screen shows them', () => {
    expect(ROLE_IDS).toEqual(['flight-director', 'spacecraft-engineer', 'science-lead', 'comms-ops']);
  });

  it('every part on every shelf, every command and every hazard belongs to a role', () => {
    for (const id of Object.keys(PACK.parts) as PartId[]) expect(ROLE_IDS).toContain(partRole(id));
    for (const k of ['power-plan', 'standing-orders', 'observe'] as const) expect(ROLE_IDS).toContain(TEAM_RULES.commandRoles.value[k]);
    for (const h of Object.keys(HAZARDS)) expect(ROLE_IDS, h).toContain(TEAM_RULES.hazardRoles.value[h]);
  });

  it('instruments are the Science Lead’s, the dish Comms & Ops’, power, fuel and kit the Engineer’s', () => {
    expect(partRole('camera')).toBe('science-lead');
    expect(partRole('sniffer')).toBe('science-lead');
    expect(partRole('dish')).toBe('comms-ops');
    for (const id of ['solar', 'battery', 'tank', 'shield', 'engine'] as PartId[]) expect(partRole(id)).toBe('spacecraft-engineer');
    expect(partRole('computer')).toBe('flight-director');
  });

  it('every rule is a game rule (listed in TODO_DATA.md), and the score weights sum to 1', () => {
    for (const r of Object.values(TEAM_RULES)) expect(r.isGameEstimate).toBe(true);
    const w = TEAM_RULES.scoreWeights.value;
    expect(w.objective + w.conflicts + w.votes).toBeCloseTo(1, 12);
  });
});

describe('team setup', () => {
  it('one to four seats, each with at least one role, no role held twice, call signs from the list', () => {
    expect(teamProblem(duo)).toBeUndefined();
    expect(teamProblem({ seats: [{ id: 'p1', callSign: TEAM_RULES.callSigns.value[0]!, roles: [...ROLE_IDS] }] })).toBeUndefined();
    expect(teamProblem({ seats: [] })).toBe('no-seats');
    expect(teamProblem({ seats: [duo.seats[0]!, { ...duo.seats[1]!, roles: ['flight-director'] }] })).toBe('role-twice');
    expect(teamProblem({ seats: [{ ...duo.seats[0]!, roles: [] }] })).toBe('no-role');
    expect(teamProblem({ seats: [{ ...duo.seats[0]!, callSign: 'Bob' }] })).toBe('call-sign');
    expect(teamProblem({ seats: [duo.seats[0]!, { ...duo.seats[1]!, callSign: duo.seats[0]!.callSign }] })).toBe('call-sign');
  });

  it('an empty role is open to anyone; a held one only to its holder', () => {
    const pair: Team = { seats: [duo.seats[0]!, { ...duo.seats[1]!, roles: ['comms-ops'] }] };
    expect(holderOf(pair, 'spacecraft-engineer')).toBeUndefined();
    expect(mayActAs(pair, 'p1', 'spacecraft-engineer')).toBe(true);
    expect(mayActAs(pair, 'p2', 'spacecraft-engineer')).toBe(true);
    expect(mayActAs(pair, 'p2', 'science-lead')).toBe(false);
    expect(mayActAs(pair, 'p1', 'science-lead')).toBe(true);
  });
});

describe('permissions before launch', () => {
  it('the part’s role packs it; another role is refused and the refusal is logged', () => {
    const s = preflight(duo, act('p2', 'spacecraft-engineer', { kind: 'pack', part: 'tank' }));
    expect(s.packed.some((q) => q.id === 'tank')).toBe(true);
    expect(s.owners.tank).toBe('spacecraft-engineer');
    const wrongRole = applyTeamAction(s, act('p2', 'spacecraft-engineer', { kind: 'pack', part: 'camera' }));
    expect(wrongRole.refused).toBe('wrong-role');
    const notYours = applyTeamAction(s, act('p2', 'science-lead', { kind: 'pack', part: 'camera' }));
    expect(notYours.refused).toBe('not-your-role');
    expect(notYours.state.refused.at(-1)).toEqual({ seq: seq, reason: 'not-your-role' });
    expect(notYours.state.packed).toEqual(s.packed);
  });

  it('the starting pack is owned by the parts’ roles; a locked part cannot be unpacked; off-shelf parts are refused', () => {
    const s = preflight(duo);
    expect(s.packed).toEqual(initialPack(base, shelf));
    expect(s.owners.sniffer).toBe('science-lead');
    expect(applyTeamAction(s, act('p2', 'spacecraft-engineer', { kind: 'unpack', part: 'engine' })).refused).toBe('locked');
    expect(shelf).not.toContain('radar');
    expect(applyTeamAction(s, act('p1', 'science-lead', { kind: 'pack', part: 'radar' })).refused).toBe('not-on-shelf');
  });

  it('only the Flight Director sets the objective and launches; the design carries the objective and the day', () => {
    expect(applyTeamAction(preflight(duo), act('p2', 'flight-director', { kind: 'objective', objective: 'moons' })).refused).toBe('not-your-role');
    const s = preflight(duo, act('p1', 'flight-director', { kind: 'objective', objective: 'moons' }));
    expect(teamDesign(s).objective).toBe('moons');
    const r = applyTeamAction(s, act('p1', 'flight-director', { kind: 'launch', day }));
    expect(r.launch).toBe(true);
    expect(teamDesign(r.state).launchDate).toBe(base.launchDate);
    expect(applyTeamAction(r.state, act('p2', 'spacecraft-engineer', { kind: 'pack', part: 'tank' })).refused).toBe('launched');
  });

  it('setup comes first and only once; flight actions wait for the launch', () => {
    const s = preflight(duo);
    expect(applyTeamAction(s, act('p1', 'flight-director', { kind: 'setup', team: duo })).refused).toBe('already-set-up');
    expect(applyTeamAction(initialTeamState(base, shelf), act('p1', 'flight-director', { kind: 'pack', part: 'tank' })).refused).toBe('no-team');
    expect(applyTeamAction(s, act('p1', 'science-lead', { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: 'phobos' } } })).refused).toBe('not-launched');
  });

  it('quick messages are ids from the list, from any seat; there is no free text', () => {
    const say = act('p2', 'comms-ops', { kind: 'say', quick: TEAM_RULES.quick.value[0]! });
    const s = preflight(duo, say);
    expect(s.feed).toEqual([{ seq: say.seq, seat: 'p2', quick: TEAM_RULES.quick.value[0] }]);
    expect(applyTeamAction(s, act('p2', 'comms-ops', { kind: 'say', quick: 'hello there' })).refused).toBe('unknown-message');
    expect(applyTeamAction(s, act('p2', 'science-lead', { kind: 'say', quick: TEAM_RULES.quick.value[0]! })).refused).toBe('not-your-role');
  });
});

// ---------------------------------------------------------------------------
// In flight

// Seed 19 draws a solar storm in cruise (Comms & Ops recommends) and an insertion anomaly (the Engineer).
const SEED = 19;
const opts = { seed: SEED };

/** A launched session and the first open hazard decision, flown live (the clock stops at each new decision). */
function toFirstHazard(team: Team): { sess: TeamSession; decisionId: string; hazardType: string; options: string[] } {
  let sess: TeamSession = { team: initialTeamState(base, shelf) };
  const first = team.seats[0]!.id;
  sess = stepSession(sess, act(first, 'flight-director', { kind: 'setup', team }), opts).session;
  sess = stepSession(sess, act(first, 'flight-director', { kind: 'launch', day }), opts).session;
  let o = sess.ops!;
  while (o.status === 'flying') {
    o = ops.advanceOperations(o);
    const d = ops.openDecisions(o).find((x) => x.kind === 'hazard' && (x.hazardOptions?.length ?? 0) >= 2);
    if (d) {
      const type = o.hazards.find((h) => h.id === d.hazardId)!.type;
      return { sess: { ...sess, ops: o }, decisionId: d.id, hazardType: type, options: d.hazardOptions!.map((x) => x.id) };
    }
  }
  throw new Error('no hazard with a choice for this seed');
}

const holder = (team: Team, type: string) => {
  const role = TEAM_RULES.hazardRoles.value[type]!;
  return { role, seat: holderOf(team, role) ?? 'p1' };
};

describe('danger cards: recommend, vote, call', () => {
  it('the related role recommends; another role is refused', () => {
    const { sess, decisionId, hazardType, options } = toFirstHazard(trio);
    const h = holder(trio, hazardType);
    const other = ROLE_IDS.find((r) => r !== h.role && r !== 'flight-director')!;
    const t = sess.ops!.t;
    const bad = stepSession(sess, act(holderOf(trio, other)!, other, { kind: 'recommend', decisionId, optionId: options[0]! }, t), opts);
    expect(bad.refused).toBe('wrong-role');
    const ok = stepSession(sess, act(h.seat, h.role, { kind: 'recommend', decisionId, optionId: options[0]! }, t), opts);
    expect(ok.refused).toBeUndefined();
    expect(ok.session.team.votes[decisionId]!.recommend).toEqual({ seat: h.seat, optionId: options[0] });
    // nothing is sent yet: the Flight Director has not called it
    expect(ok.session.ops!.decisions.find((d) => d.id === decisionId)!.commanded).toBe(false);
  });

  it('the Flight Director’s call sends the one decision, at the time of the call; votes that differ are counted', () => {
    const { sess, decisionId, hazardType, options } = toFirstHazard(trio);
    const h = holder(trio, hazardType);
    const t = sess.ops!.t;
    let s = stepSession(sess, act(h.seat, h.role, { kind: 'recommend', decisionId, optionId: options[0]! }, t), opts).session;
    const voter = trio.seats.find((x) => x.id !== h.seat && !x.roles.includes('flight-director'))!;
    s = stepSession(s, act(voter.id, voter.roles[0]!, { kind: 'vote', decisionId, optionId: options[1]! }, t), opts).session;
    expect(stepSession(s, act('p2', 'flight-director', { kind: 'call', decisionId, optionId: options[1]! }, t), opts).refused).toBe('not-your-role');
    const called = stepSession(s, act('p1', 'flight-director', { kind: 'call', decisionId, optionId: options[1]! }, t), opts);
    expect(called.session.team.votes[decisionId]!.result).toMatchObject({ optionId: options[1], how: 'call' });
    expect(called.session.ops!.actions.at(-1)).toEqual({ t, kind: 'decide', decisionId, optionId: options[1] });
    expect(called.session.ops!.decisions.find((d) => d.id === decisionId)!.commanded).toBe(true);
    expect(stepSession(called.session, act('p1', 'flight-director', { kind: 'call', decisionId, optionId: options[0]! }, t), opts).refused).toBe('settled');
  });

  it('with no Flight Director the majority decides once every seat has a voice; a tie goes to the recommendation', () => {
    const noFd: Team = { seats: [{ ...trio.seats[1]! }, { ...trio.seats[2]! }] };
    const { sess, decisionId, hazardType, options } = toFirstHazard(noFd);
    const h = holder(noFd, hazardType);
    const t = sess.ops!.t;
    const [a, b] = options as [string, string];
    let s = stepSession(sess, act(h.seat, h.role, { kind: 'recommend', decisionId, optionId: a }, t), opts).session;
    const other = noFd.seats.find((x) => x.id !== h.seat)!;
    const done = stepSession(s, act(other.id, other.roles[0]!, { kind: 'vote', decisionId, optionId: b }, t), opts).session;
    // one voice each: 1–1 → the recommendation
    expect(done.team.votes[decisionId]!.result).toMatchObject({ optionId: a, how: 'tie' });
    expect(done.ops!.actions.at(-1)).toMatchObject({ kind: 'decide', optionId: a });
    s = stepSession(sess, act(h.seat, h.role, { kind: 'recommend', decisionId, optionId: a }, t), opts).session;
    const agreed = stepSession(s, act(other.id, other.roles[0]!, { kind: 'vote', decisionId, optionId: a }, t), opts).session;
    expect(agreed.team.votes[decisionId]!.result).toMatchObject({ optionId: a, how: 'majority' });
  });

  it('a team of one skips the vote: the recommendation is the call', () => {
    const solo: Team = { seats: [{ id: 'p1', callSign: TEAM_RULES.callSigns.value[0]!, roles: [...ROLE_IDS] }] };
    const { sess, decisionId, hazardType, options } = toFirstHazard(solo);
    const role = TEAM_RULES.hazardRoles.value[hazardType]!;
    const r = stepSession(sess, act('p1', role, { kind: 'recommend', decisionId, optionId: options[0]! }, sess.ops!.t), opts);
    expect(r.session.team.votes[decisionId]!.result).toMatchObject({ optionId: options[0], how: 'solo' });
    expect(r.session.ops!.decisions.find((d) => d.id === decisionId)!.commanded).toBe(true);
  });

  it('a hazard cannot be answered around the vote; ops commands go by role', () => {
    const { sess, decisionId, options } = toFirstHazard(trio);
    const t = sess.ops!.t;
    expect(stepSession(sess, act('p1', 'flight-director', { kind: 'ops', op: { kind: 'decide', decisionId, optionId: options[0]! } }, t), opts).refused).toBe('use-vote');
    expect(stepSession(sess, act('p2', 'spacecraft-engineer', { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: 'phobos' } } }, t), opts).refused).toBe('wrong-role');
    const dsn = { kind: 'dsn' as const, fromDay: Math.floor(t) + 10, toDay: Math.floor(t) + 11, booking: { dish: 70 as const, hours: 8 } };
    expect(stepSession(sess, act('p3', 'comms-ops', { kind: 'ops', op: dsn }, t), opts).refused).toBeUndefined();
    expect(stepSession(sess, act('p2', 'spacecraft-engineer', { kind: 'ops', op: dsn }, t), opts).refused).toBe('wrong-role');
  });
});

describe('transport', () => {
  it('LocalTransport numbers each action, hands it to every listener and keeps the log', () => {
    const tr = new LocalTransport();
    const got: number[] = [];
    const off = tr.subscribe((a) => got.push(a.seq));
    tr.send({ seat: 'p1', role: 'flight-director', act: { kind: 'setup', team: duo } });
    tr.send({ seat: 'p2', role: 'comms-ops', act: { kind: 'say', quick: TEAM_RULES.quick.value[1]! } });
    off();
    tr.send({ seat: 'p1', role: 'flight-director', act: { kind: 'say', quick: TEAM_RULES.quick.value[2]! } });
    expect(got).toEqual([1, 2]);
    expect(tr.log().map((a) => a.seq)).toEqual([1, 2, 3]);
    expect(Object.isFrozen(tr.log())).toBe(true);
  });
});

describe('replay: the mission is (base design, seed, team log)', () => {
  /** A three-seat session flown live through LocalTransport: pack, objective, launch, a vote, an observe, a DSN booking. */
  function live(): { log: readonly TeamAction[]; final: TeamSession } {
    const tr = new LocalTransport();
    let sess: TeamSession = { team: initialTeamState(base, shelf) };
    tr.subscribe((a) => (sess = stepSession(sess, a, opts).session));
    const t = () => sess.ops?.t;
    tr.send({ seat: 'p1', role: 'flight-director', act: { kind: 'setup', team: trio } });
    tr.send({ seat: 'p2', role: 'spacecraft-engineer', act: { kind: 'pack', part: 'tank' } });
    tr.send({ seat: 'p3', role: 'science-lead', act: { kind: 'pack', part: 'spectrometer' } });
    tr.send({ seat: 'p2', role: 'science-lead', act: { kind: 'pack', part: 'camera' } }); // refused, still logged
    tr.send({ seat: 'p1', role: 'flight-director', act: { kind: 'objective', objective: 'moons' } });
    tr.send({ seat: 'p3', role: 'comms-ops', act: { kind: 'say', quick: TEAM_RULES.quick.value[0]! } });
    tr.send({ seat: 'p1', role: 'flight-director', act: { kind: 'launch', day } });
    // Fly live, stopping at each decision the way the screen does; answer hazards by vote.
    let guard = 0;
    let observed = false;
    while (sess.ops!.status === 'flying' && guard++ < 200) {
      const sci = sess.ops!.env.timeline.find((w) => w.phase === 'science')!;
      // the clock stops at each new decision, and once on the first science day to order a picture
      sess = { ...sess, ops: ops.advanceOperations(sess.ops!, observed ? {} : { until: sci.startDay + 0.1 }) };
      const o = sess.ops!;
      if (!observed && o.t >= sci.startDay) {
        observed = true;
        tr.send({ seat: 'p3', role: 'science-lead', t: t(), act: { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: 'phobos' } } } });
        tr.send({ seat: 'p3', role: 'comms-ops', t: t(), act: { kind: 'ops', op: { kind: 'dsn', fromDay: Math.floor(o.t) + 10, toDay: Math.floor(o.t) + 11, booking: { dish: 70, hours: 8 } } } });
      }
      for (const d of ops.openDecisions(sess.ops!)) {
        if (d.kind === 'extension') {
          tr.send({ seat: 'p1', role: 'flight-director', t: t(), act: { kind: 'ops', op: { kind: 'decide', decisionId: d.id, optionId: END_MISSION } } });
          continue;
        }
        const type = sess.ops!.hazards.find((h) => h.id === d.hazardId)!.type;
        const h = holder(trio, type);
        const opt = d.hazardOptions!;
        tr.send({ seat: h.seat, role: h.role, t: t(), act: { kind: 'recommend', decisionId: d.id, optionId: opt[0]!.id } });
        const voter = h.seat === 'p2' ? { seat: 'p3' as const, role: 'science-lead' as const } : { seat: 'p2' as const, role: 'spacecraft-engineer' as const };
        tr.send({ ...voter, t: t(), act: { kind: 'vote', decisionId: d.id, optionId: opt.at(-1)!.id } });
        tr.send({ seat: 'p1', role: 'flight-director', t: t(), act: { kind: 'call', decisionId: d.id, optionId: d.safestOptionId! } });
      }
    }
    return { log: tr.log(), final: sess };
  }

  it('replaying the log rebuilds the same design, flight, debrief and team state', () => {
    const { log, final } = live();
    expect(log.some((a) => a.act.kind === 'call')).toBe(true);
    const r = replayTeam(base, shelf, opts, log);
    expect(r.design).toEqual(teamDesign(final.team));
    expect(r.design.objective).toBe('moons');
    const flown = ops.finishOperations(final.ops!) as OpsState;
    expect(r.ops).toEqual(flown);
    expect(ops.operationsDebrief(r.ops!)).toEqual(ops.operationsDebrief(flown));
    expect(r.team).toEqual(final.team);
    expect(r.team.refused.map((x) => x.reason)).toEqual(['not-your-role']);
  });

  it('the same log twice gives the same mission (deterministic)', () => {
    const { log } = live();
    expect(replayTeam(base, shelf, opts, log)).toEqual(replayTeam(base, shelf, opts, log));
  });
});
