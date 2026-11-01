// Team Fly (spec: Team mode, mockup T4): the danger card's vote as the screen shows it, the team's lines on the
// teletype, and the one-flight guarantee: the flight the screen runs (its clock stepping in small slices, each order
// applied where the team sends it) is the very mission the team log replays.
import { describe, expect, it } from 'vitest';
import * as ops from '../src/engine/ops/index';
import type { OpsState } from '../src/engine/ops/types';
import { shelfFor } from '../src/engine/pack';
import { cardVote, opRole, teamFlightLines, withTeamLines, type TeamTxLine } from '../src/engine/team/fly';
import type { TeamAct, TeamAction } from '../src/engine/team/log';
import { initialTeamState, teamDesign } from '../src/engine/team/reduce';
import { replayTeam, stepSession, type TeamSession } from '../src/engine/team/replay';
import { holderOf, ROLE_IDS, TEAM_RULES, type RoleId, type Team } from '../src/engine/team/roles';
import { defaultTeam } from '../src/engine/team/setup';
import { starterDesign } from '../src/ui/starters';

const base = starterDesign('mars', '2028-11-15');
const shelf = shelfFor('mars');
const day = { date: base.launchDate, arrivalDate: base.arrivalDate };
// Seed 19 draws a solar storm in cruise (Comms & Ops recommends) and an insertion anomaly (the Engineer).
const opts = { seed: 19 };

let seq = 0;
const act = (seat: TeamAction['seat'], role: RoleId, a: TeamAct, t?: number): TeamAction => ({ seq: ++seq, seat, role, act: a, ...(t !== undefined ? { t } : {}) });

/** Launched, flown live to the first danger card with a choice. */
function toCard(team: Team): { sess: TeamSession; id: string; type: string; options: string[] } {
  let sess: TeamSession = { team: initialTeamState(base, shelf) };
  sess = stepSession(sess, act(team.seats[0]!.id, 'flight-director', { kind: 'setup', team }), opts).session;
  sess = stepSession(sess, act(holderOf(team, 'flight-director') ?? 'p1', 'flight-director', { kind: 'launch', day }), opts).session;
  let o = sess.ops!;
  while (o.status === 'flying') {
    o = ops.advanceOperations(o);
    const d = ops.openDecisions(o).find((x) => x.kind === 'hazard' && (x.hazardOptions?.length ?? 0) >= 2);
    if (d) return { sess: { ...sess, ops: o }, id: d.id, type: o.hazards.find((h) => h.id === d.hazardId)!.type, options: d.hazardOptions!.map((x) => x.id) };
  }
  throw new Error('no danger card with a choice');
}

describe('cardVote: whose turn on a danger card', () => {
  it('four players: the related role recommends, the other two vote, then the Flight Director calls', () => {
    const four = defaultTeam(4);
    const { sess, id, type, options } = toCard(four);
    const [a, b] = options as [string, string];
    const role = TEAM_RULES.hazardRoles.value[type]!;
    const rec = holderOf(four, role)!;
    let s = sess;
    let v = cardVote(s.team, id, type);
    expect(v.stage).toBe('recommend');
    expect(v.recommender).toEqual({ role, seat: rec });
    expect(v.director).toBe('p1');
    // the Flight Director's seat is not a voter: the three others are
    expect(v.voters.map((x) => x.seat)).toEqual(['p2', 'p3', 'p4']);
    expect(v.waiting).toBe(3);
    expect(v.leans).toBeUndefined();

    const t = s.ops!.t;
    s = stepSession(s, act(rec, role, { kind: 'recommend', decisionId: id, optionId: a }, t), opts).session;
    v = cardVote(s.team, id, type);
    expect(v.stage).toBe('vote');
    expect(v.recommend).toBe(a);
    expect(v.voters.find((x) => x.seat === rec)).toMatchObject({ voice: a, recommender: true });
    expect(v.waiting).toBe(2);
    expect(v.tally).toEqual({ [a]: 1 });
    expect(v.leans).toBe(a);

    const others = four.seats.filter((x) => x.id !== 'p1' && x.id !== rec);
    s = stepSession(s, act(others[0]!.id, others[0]!.roles[0]!, { kind: 'vote', decisionId: id, optionId: b }, t), opts).session;
    v = cardVote(s.team, id, type);
    // 1–1: the team leans to the recommendation
    expect(v.tally).toEqual({ [a]: 1, [b]: 1 });
    expect(v.leans).toBe(a);
    s = stepSession(s, act(others[1]!.id, others[1]!.roles[0]!, { kind: 'vote', decisionId: id, optionId: b }, t), opts).session;
    v = cardVote(s.team, id, type);
    expect(v.stage).toBe('call');
    expect(v.waiting).toBe(0);
    expect(v.leans).toBe(b);

    s = stepSession(s, act('p1', 'flight-director', { kind: 'call', decisionId: id, optionId: a }, t), opts).session;
    v = cardVote(s.team, id, type);
    expect(v.stage).toBe('settled');
    expect(v.result).toEqual({ optionId: a, how: 'call' });
    // the Flight Director's voice is counted: 2–2, the recommendation leads
    expect(v.tally).toEqual({ [a]: 2, [b]: 2 });
  });

  it('a team of one: no voters, and the recommendation settles it', () => {
    const solo = defaultTeam(1);
    const { sess, id, type, options } = toCard(solo);
    expect(cardVote(sess.team, id, type)).toMatchObject({ stage: 'recommend', solo: true, voters: [], waiting: 0, director: 'p1' });
    const role = TEAM_RULES.hazardRoles.value[type]!;
    const s = stepSession(sess, act('p1', role, { kind: 'recommend', decisionId: id, optionId: options[0]! }, sess.ops!.t), opts).session;
    expect(cardVote(s.team, id, type)).toMatchObject({ stage: 'settled', result: { optionId: options[0], how: 'solo' } });
  });

  it('two players: the Flight Director’s seat may be the one that recommends; the other seat votes', () => {
    const duo = defaultTeam(2); // p1: FD + Comms, p2: Engineer + Science
    const { sess, id, type } = toCard(duo);
    const v = cardVote(sess.team, id, type);
    expect(v.voters.map((x) => x.seat)).toEqual(['p2']);
    expect(v.voters[0]!.roles).toEqual(['spacecraft-engineer', 'science-lead']);
    // seed 19's first card is a solar storm: Comms & Ops, held by the Flight Director's seat
    expect(type).toBe('solar-storm');
    expect(v.recommender).toEqual({ role: 'comms-ops', seat: 'p1' });
  });
});

describe('orders from the console go as their role', () => {
  it('power plan: Engineer; pictures: Science Lead; dishes: Comms & Ops; standing orders and the extension: Flight Director', () => {
    expect(opRole({ kind: 'command', command: { kind: 'power-plan', plan: { instruments: {}, heaters: 1, radio: true } } })).toBe('spacecraft-engineer');
    expect(opRole({ kind: 'command', command: { kind: 'observe', targetId: 'olympus-mons' } })).toBe('science-lead');
    expect(opRole({ kind: 'dsn', fromDay: 1, toDay: 1, booking: { dish: 70, hours: 4 } })).toBe('comms-ops');
    expect(opRole({ kind: 'command', command: { kind: 'standing-orders', orders: {} } })).toBe('flight-director');
    expect(opRole({ kind: 'decide', decisionId: 'extension', optionId: 'end' })).toBe('flight-director');
  });
});

describe('the team on the teletype', () => {
  it('lists the accepted entries sent in flight; refused ones and pre-launch messages are left out', () => {
    const four = defaultTeam(4);
    const { sess, id, type, options } = toCard(four);
    const role = TEAM_RULES.hazardRoles.value[type]!;
    const rec = holderOf(four, role)!;
    const t = sess.ops!.t;
    const log: TeamAction[] = [
      act('p1', 'flight-director', { kind: 'say', quick: 'good-call' }), // before launch: no time
      act('p2', 'spacecraft-engineer', { kind: 'say', quick: 'need-power' }, t),
      act('p3', 'science-lead', { kind: 'recommend', decisionId: id, optionId: options[0]! }, t), // refused unless Science owns it
      act(rec, role, { kind: 'recommend', decisionId: id, optionId: options[0]! }, t),
    ];
    let s = sess;
    for (const a of log) s = stepSession(s, a, opts).session;
    const lines = teamFlightLines(s.team, log);
    const kinds = lines.map((l) => [l.role, l.what.kind]);
    expect(kinds[0]).toEqual(['spacecraft-engineer', 'say']);
    expect(kinds.at(-1)).toEqual([role, 'recommend']);
    expect(lines.every((l) => l.at === t)).toBe(true);
    expect(lines.at(-1)!.what).toEqual({ kind: 'recommend', decisionId: id, optionId: options[0], hazardType: type });
    expect(lines).toHaveLength(role === 'science-lead' ? 3 : 2);
  });

  it('merges with the robot’s feed by time; at the same time the robot’s line comes first; max keeps the newest', () => {
    const robot = (at: number) => ({ from: 'robot' as const, at });
    const team = (at: number, n: number): TeamTxLine => ({ from: 'team', at, seq: n, seat: 'p1', role: 'flight-director', what: { kind: 'say', quick: 'agree' } });
    const rows = withTeamLines([robot(1), robot(5), robot(9)], [team(5, 1), team(7, 2)]);
    expect(rows.map((r) => `${r.from}@${r.at}`)).toEqual(['robot@1', 'robot@5', 'team@5', 'team@7', 'robot@9']);
    expect(withTeamLines([robot(1), robot(5)], [team(3, 1)], 2).map((r) => r.at)).toEqual([3, 5]);
  });
});

describe('one flight: the screen’s flight is the mission the team log replays', () => {
  it('a clock in small slices, a vote and orders sent through the log end where replayTeam ends', () => {
    const four = defaultTeam(4);
    let sess: TeamSession = { team: initialTeamState(base, shelf) };
    const log: TeamAction[] = [];
    const send = (a: Omit<TeamAction, 'seq'>) => {
      const e = { ...a, seq: log.length + 1 } as TeamAction;
      log.push(e);
      const r = stepSession(sess, e, opts);
      sess = r.session;
      return r.refused;
    };
    send({ seat: 'p1', role: 'flight-director', act: { kind: 'setup', team: four } });
    send({ seat: 'p1', role: 'flight-director', act: { kind: 'launch', day } });
    // the screen's own flight, started from the same design and seed
    let live: OpsState = ops.startOperations(teamDesign(sess.team), opts);
    let cards = 0;
    let ordered = false;
    for (let guard = 0; guard < 5000 && live.status === 'flying'; guard++) {
      live = ops.advanceOperations(live, { days: 3.7 });
      const d = ops.openDecisions(live).find((x) => x.kind === 'hazard' && !x.commanded && (x.hazardOptions?.length ?? 0) >= 2);
      if (d) {
        const type = live.hazards.find((h) => h.id === d.hazardId)!.type;
        const role = TEAM_RULES.hazardRoles.value[type]!;
        const opt = d.hazardOptions!.map((o) => o.id);
        const t = live.t;
        expect(send({ seat: holderOf(four, role)!, role, t, act: { kind: 'recommend', decisionId: d.id, optionId: opt[0]! } })).toBeUndefined();
        const voter = four.seats.find((x) => x.id !== 'p1' && !x.roles.includes(role))!;
        expect(send({ seat: voter.id, role: voter.roles[0]!, t, act: { kind: 'vote', decisionId: d.id, optionId: opt[1]! } })).toBeUndefined();
        expect(send({ seat: 'p1', role: 'flight-director', t, act: { kind: 'call', decisionId: d.id, optionId: opt[1]! } })).toBeUndefined();
        // the screen sends the same decision when it sees the vote settled
        live = ops.decide(live, d.id, sess.team.votes[d.id]!.result!.optionId).state;
        cards++;
      }
      if (!ordered && live.t > 30) {
        // the Engineer's power plan, through the log and on the screen's flight, at the same time
        const plan = { instruments: {}, heaters: 0.5, radio: true };
        const op = { kind: 'command' as const, command: { kind: 'power-plan' as const, plan } };
        expect(send({ seat: 'p2', role: 'spacecraft-engineer', t: live.t, act: { kind: 'ops', op } })).toBeUndefined();
        live = ops.applyOpsAction(live, op);
        ordered = true;
      }
      // the team's copy is never behind: compare at every step where it is advanced to the screen's time
      if (d) expect(ops.advanceTo(sess.ops!, live.t).actions).toEqual(live.actions);
    }
    expect(cards).toBeGreaterThan(0);
    expect(ordered).toBe(true);
    const fin = ops.finishOperations(live);
    const rep = replayTeam(base, shelf, opts, log).ops!;
    expect(rep.actions).toEqual(fin.actions);
    expect(rep.status).toBe(fin.status);
    expect(rep.t).toBeCloseTo(fin.t, 9);
    expect(rep.hazards.map((h) => [h.id, h.choice?.optionId, h.outcomeDone])).toEqual(fin.hazards.map((h) => [h.id, h.choice?.optionId, h.outcomeDone]));
    expect(ops.operationsDebrief(rep).stars).toBe(ops.operationsDebrief(fin).stars);
    expect(ROLE_IDS).toHaveLength(4);
  });
});
