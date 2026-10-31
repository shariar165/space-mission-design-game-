// Team Setup and the Mission Objective vote (spec: Team mode, screens T1 and T2). The crew helpers the setup screen
// calls (players, who holds which role, call signs), the objective cards (what each objective counts and needs), and
// the objective vote: the Flight Director picks, the other roles agree or object, then the Flight Director locks it
// (everyone agreed) or overrules (someone objected). Roles held by the Flight Director's own seat agree by themselves.
import { describe, expect, it } from 'vitest';
import { OBJECTIVE_IDS, OBJECTIVE_RULES } from '../src/engine/objectives';
import { shelfFor } from '../src/engine/pack';
import { applyTeamAction, initialTeamState, teamDesign, type TeamState } from '../src/engine/team/reduce';
import { ROLE_IDS, TEAM_RULES, holderOf, teamProblem, type RoleId, type SeatId, type Team } from '../src/engine/team/roles';
import { actorFor, crewView, defaultTeam, handRole, nextCallSign, objectiveCards, objectiveVote, setPlayers } from '../src/engine/team/setup';
import type { TeamAct, TeamAction } from '../src/engine/team/log';
import { starterDesign } from '../src/ui/starters';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const SIGNS = TEAM_RULES.callSigns.value;
const rolesOf = (t: Team) => t.seats.map((s) => s.roles);

let seq = 0;
const act = (seat: SeatId, role: RoleId, a: TeamAct): TeamAction => ({ seq: ++seq, seat, role, act: a });

/** A team set up, then these actions (throws on an unexpected refusal). */
function run(team: Team, ...rest: TeamAction[]): TeamState {
  let s = applyTeamAction(initialTeamState(base, shelf), act('p1', 'flight-director', { kind: 'setup', team })).state;
  for (const a of rest) {
    const r = applyTeamAction(s, a);
    if (r.refused) throw new Error(`refused ${a.act.kind}: ${r.refused}`);
    s = r.state;
  }
  return s;
}

describe('crew (Team Setup, T1)', () => {
  it('the default crews: one player holds all four; two split FD + Comms / Engineer + Science; three give Science + Comms to the third', () => {
    expect(rolesOf(defaultTeam(1))).toEqual([[...ROLE_IDS]]);
    expect(rolesOf(defaultTeam(2))).toEqual([
      ['flight-director', 'comms-ops'],
      ['spacecraft-engineer', 'science-lead'],
    ]);
    expect(rolesOf(defaultTeam(3))).toEqual([['flight-director'], ['spacecraft-engineer'], ['science-lead', 'comms-ops']]);
    expect(rolesOf(defaultTeam(4))).toEqual(ROLE_IDS.map((r) => [r]));
    for (const n of [1, 2, 3, 4]) {
      const t = defaultTeam(n);
      expect(teamProblem(t)).toBeUndefined();
      expect(t.seats.map((s) => s.callSign)).toEqual(SIGNS.slice(0, n));
    }
    expect(TEAM_RULES.defaultRoles.isGameEstimate).toBe(true);
  });

  it('a new player count keeps the call signs already picked; new seats take the first free sign', () => {
    let t = nextCallSign(defaultTeam(2), 'p2'); // p2: ORBIT → NOVA
    expect(t.seats.map((s) => s.callSign)).toEqual([SIGNS[0], SIGNS[2]]);
    t = setPlayers(t, 3);
    expect(t.seats.map((s) => s.callSign)).toEqual([SIGNS[0], SIGNS[2], SIGNS[1]]);
    expect(rolesOf(t)).toEqual(rolesOf(defaultTeam(3)));
    expect(setPlayers(t, 1).seats.map((s) => s.callSign)).toEqual([SIGNS[0]]);
  });

  it('a call sign steps to the next one nobody else has, and wraps round the list', () => {
    const t = defaultTeam(4); // COMET ORBIT NOVA PULSAR
    expect(nextCallSign(t, 'p1').seats[0]!.callSign).toBe(SIGNS[4]); // ORBIT, NOVA, PULSAR are taken
    const last = { seats: [{ ...t.seats[0]!, callSign: SIGNS[SIGNS.length - 1]! }] };
    expect(nextCallSign(last, 'p1').seats[0]!.callSign).toBe(SIGNS[0]);
  });

  it('HELD BY hands a role to the next player; a player left with none is named, and the team cannot start', () => {
    const t = handRole(defaultTeam(4), 'comms-ops'); // p4 → p1
    expect(holderOf(t, 'comms-ops')).toBe('p1');
    expect(t.seats[0]!.roles).toEqual(['flight-director', 'comms-ops']); // kept in role order
    expect(crewView(t)).toEqual({ players: 4, doubled: ['p1'], idle: ['p4'] });
    expect(teamProblem(t)).toBe('no-role');
    // round the table and back: p1 → p2 → p3 → p4
    const back = handRole(handRole(handRole(t, 'comms-ops'), 'comms-ops'), 'comms-ops');
    expect(back).toEqual(defaultTeam(4));
    expect(handRole(defaultTeam(1), 'science-lead')).toEqual(defaultTeam(1)); // one player keeps everything
  });

  it('the crew lines: who holds two roles (a team of one doubles nobody)', () => {
    expect(crewView(defaultTeam(1))).toEqual({ players: 1, doubled: [], idle: [] });
    expect(crewView(defaultTeam(2))).toEqual({ players: 2, doubled: ['p1', 'p2'], idle: [] });
    expect(crewView(defaultTeam(3))).toEqual({ players: 3, doubled: ['p3'], idle: [] });
    expect(crewView(defaultTeam(4))).toEqual({ players: 4, doubled: [], idle: [] });
  });

  it('on a shared screen a role’s keys act as its holder, or the first seat for an open role', () => {
    const t = defaultTeam(3);
    expect(actorFor(t, 'comms-ops')).toBe('p3');
    const open: Team = { seats: [{ id: 'p1', callSign: SIGNS[0]!, roles: ['flight-director'] }] };
    expect(actorFor(open, 'science-lead')).toBe('p1');
  });
});

describe('objective cards (T2)', () => {
  it('each objective names its targets with their share of the science, the parts that count, and the role it leans on', () => {
    const cards = objectiveCards(base);
    expect(cards.map((c) => c.id)).toEqual(OBJECTIVE_IDS);
    const by = Object.fromEntries(cards.map((c) => [c.id, c]));
    // atmosphere: the limb is the only favoured target: 0.20 × 0.6 / 0.20 = 0.6
    expect(by.atmosphere!.targets.map((t) => t.id)).toEqual(['limb']);
    expect(by.atmosphere!.targets[0]!.share).toBeCloseTo(0.6, 9);
    // surface: W = 0.18 + 0.16 + 0.14 = 0.48; Olympus 0.18 × 0.6 / 0.48 = 0.225, Valles 0.2, the cap 0.175
    expect(by.surface!.targets.map((t) => [t.id, Number(t.share.toFixed(4))])).toEqual([
      ['olympus-mons', 0.225],
      ['valles-marineris', 0.2],
      ['north-polar-cap', 0.175],
    ]);
    // moons: W = 0.32; Phobos 0.2 × 0.6 / 0.32 = 0.375, Deimos 0.12 × 0.6 / 0.32 = 0.225
    expect(by.moons!.targets.map((t) => [t.id, Number(t.share.toFixed(4))])).toEqual([
      ['phobos', 0.375],
      ['deimos', 0.225],
    ]);
    for (const c of cards) expect(c.targets.reduce((a, t) => a + t.share, 0)).toBeCloseTo(OBJECTIVE_RULES.share.value, 9);
    // the Pack parts whose instrument does the objective's science
    expect(by.atmosphere!.parts).toEqual(['sniffer']);
    expect(by.surface!.parts).toEqual(['camera', 'radar']);
    expect(by.moons!.parts).toEqual(['spectrometer']);
    // each objective leans hardest on a different role (team.json hazard and order owners)
    expect(cards.map((c) => c.strain.value)).toEqual([
      { role: 'science-lead', why: 'drag' },
      { role: 'comms-ops', why: 'data' },
      { role: 'spacecraft-engineer', why: 'fuel' },
    ]);
    expect(new Set(cards.map((c) => c.strain.value.role)).size).toBe(3);
    for (const c of cards) expect(c.strain.isGameEstimate).toBe(true);
  });

  it('matched says whether the craft already carries one of the parts', () => {
    const cam = { ...base, instrumentIds: ['camera'] };
    expect(objectiveCards(cam).map((c) => c.matched)).toEqual([false, true, false]);
  });
});

describe('objective vote (T2): FD picks, the others agree or object, FD locks or overrules', () => {
  const four = defaultTeam(4);
  const pick = (o: 'atmosphere' | 'surface' | 'moons') => act('p1', 'flight-director', { kind: 'objective', objective: o });

  it('before a pick there is nothing to vote on', () => {
    const s = run(four);
    expect(objectiveVote(s).next).toBe('pick');
    expect(applyTeamAction(s, act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' })).refused).toBe('no-objective');
    expect(applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-lock' })).refused).toBe('no-objective');
  });

  it('each of the three other roles votes as itself; the lock waits for every voice; all agree → LOCKED', () => {
    let s = run(four, pick('surface'));
    let v = objectiveVote(s);
    expect(v.voters.map((x) => [x.role, x.seat, x.auto])).toEqual([
      ['spacecraft-engineer', 'p2', false],
      ['science-lead', 'p3', false],
      ['comms-ops', 'p4', false],
    ]);
    expect([v.waiting, v.next]).toEqual([3, 'wait']);
    expect(applyTeamAction(s, act('p2', 'science-lead', { kind: 'objective-voice', voice: 'agree' })).refused).toBe('not-your-role');
    expect(applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-voice', voice: 'agree' })).refused).toBe('wrong-role');
    expect(applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-lock' })).refused).toBe('waiting-votes');
    s = run(
      four,
      pick('surface'),
      act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' }),
      act('p3', 'science-lead', { kind: 'objective-voice', voice: 'agree' }),
      act('p4', 'comms-ops', { kind: 'objective-voice', voice: 'agree' }),
    );
    v = objectiveVote(s);
    expect([v.waiting, v.objectors, v.next]).toEqual([0, [], 'lock']);
    expect(applyTeamAction(s, act('p2', 'flight-director', { kind: 'objective-lock' })).refused).toBe('not-your-role');
    const r = applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-lock' }));
    expect(r.refused).toBeUndefined();
    expect(objectiveVote(r.state)).toMatchObject({ next: 'locked', locked: 'agreed', objective: 'surface' });
    expect(teamDesign(r.state).objective).toBe('surface');
    // locked: no new pick, no new voice, no second lock
    expect(applyTeamAction(r.state, pick('moons')).refused).toBe('objective-locked');
    expect(applyTeamAction(r.state, act('p3', 'science-lead', { kind: 'objective-voice', voice: 'object' })).refused).toBe('objective-locked');
    expect(applyTeamAction(r.state, act('p1', 'flight-director', { kind: 'objective-lock' })).refused).toBe('objective-locked');
  });

  it('an objection names the role; the FD may overrule once every voice is in; a voice can change or be taken back', () => {
    let s = run(
      four,
      pick('atmosphere'),
      act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' }),
      act('p3', 'science-lead', { kind: 'objective-voice', voice: 'object' }),
    );
    expect(objectiveVote(s)).toMatchObject({ waiting: 1, objectors: ['science-lead'], next: 'wait' });
    s = run(
      four,
      pick('atmosphere'),
      act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' }),
      act('p3', 'science-lead', { kind: 'objective-voice', voice: 'object' }),
      act('p4', 'comms-ops', { kind: 'objective-voice', voice: 'agree' }),
    );
    expect(objectiveVote(s)).toMatchObject({ waiting: 0, objectors: ['science-lead'], next: 'overrule' });
    const over = applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-lock' })).state;
    expect(objectiveVote(over).locked).toBe('overruled');
    // changing a voice, and taking it back
    const changed = applyTeamAction(s, act('p3', 'science-lead', { kind: 'objective-voice', voice: 'agree' })).state;
    expect(objectiveVote(changed).next).toBe('lock');
    const none = applyTeamAction(s, act('p3', 'science-lead', { kind: 'objective-voice', voice: 'none' })).state;
    expect(objectiveVote(none)).toMatchObject({ waiting: 1, objectors: [] });
  });

  it('a new pick clears the voices', () => {
    const s = run(four, pick('atmosphere'), act('p3', 'science-lead', { kind: 'objective-voice', voice: 'object' }), pick('moons'));
    expect(objectiveVote(s)).toMatchObject({ objective: 'moons', waiting: 3, objectors: [] });
  });

  it('roles the Flight Director’s own player holds agree by themselves; a team of one locks at once', () => {
    const two = defaultTeam(2); // p1: FD + Comms, p2: Engineer + Science
    let s = run(two, pick('moons'));
    const v = objectiveVote(s);
    expect(v.voters.map((x) => [x.role, x.auto, x.voice])).toEqual([
      ['spacecraft-engineer', false, undefined],
      ['science-lead', false, undefined],
      ['comms-ops', true, 'agree'],
    ]);
    expect(v.waiting).toBe(2);
    expect(applyTeamAction(s, act('p1', 'comms-ops', { kind: 'objective-voice', voice: 'object' })).refused).toBe('auto-agree');
    s = run(
      two,
      pick('moons'),
      act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' }),
      act('p2', 'science-lead', { kind: 'objective-voice', voice: 'agree' }),
    );
    expect(objectiveVote(s).next).toBe('lock');
    const solo = run(defaultTeam(1), pick('surface'));
    expect(objectiveVote(solo)).toMatchObject({ waiting: 0, next: 'lock' });
    expect(objectiveVote(solo).voters.every((x) => x.auto)).toBe(true);
  });

  it('the Moon has no objective vote', () => {
    const moon = starterDesign('moon', '2028-11-15');
    let s = applyTeamAction(initialTeamState(moon, shelfFor('moon')), act('p1', 'flight-director', { kind: 'setup', team: four })).state;
    expect(applyTeamAction(s, act('p1', 'flight-director', { kind: 'objective-lock' })).refused).toBe('no-objective-here');
    s = applyTeamAction(s, act('p2', 'spacecraft-engineer', { kind: 'objective-voice', voice: 'agree' })).state;
    expect(s.refused.at(-1)?.reason).toBe('no-objective-here');
  });
});
